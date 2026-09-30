// PreToolUse hook：書き込みガードと Bash / PowerShell の意味解析（第三層の防衛）。
// 拒否は exit 2、確認は permissionDecision: "ask"、それ以外は無言で exit 0。
// 判定中の例外は必ず拒否に倒す（fail-closed）。
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  findCompanyRoot,
  isProtected,
  needsFrontmatter,
  readCompany,
  relativeKey,
  type Company,
} from "./lib/company.ts";
import {
  applyEdits,
  parseFrontmatter,
  touchesFrontmatter,
  type EditSpec,
} from "./lib/frontmatter.ts";
import { appendLog } from "./lib/log.ts";
import { frontmatterSchema } from "./lib/plugin.ts";
import { hasApprovingProposal } from "./lib/proposals.ts";
import { judgeCommands } from "./lib/rules.ts";
import { validate } from "./lib/schema.ts";
import { missingRules } from "./lib/settings.ts";
import { parsePowerShell, parseShell } from "./lib/shell.ts";

type Decision = { decision: "deny" | "ask" | "allow"; reason: string };
type HookInput = {
  cwd: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
};

const ALLOW: Decision = { decision: "allow", reason: "" };
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const COMMAND_TOOLS = new Set(["Bash", "PowerShell"]);

const parseInput = (raw: string): HookInput => {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("hook の入力がオブジェクトではありません");
  }
  const input = parsed as Record<string, unknown>;
  const { cwd, tool_name: toolName, tool_input: toolInput } = input;
  if (typeof cwd !== "string" || typeof toolName !== "string") {
    throw new Error("hook の入力に cwd か tool_name がありません");
  }
  if (typeof toolInput !== "object" || toolInput === null) {
    throw new Error("hook の入力に tool_input がありません");
  }
  return {
    cwd,
    tool_name: toolName,
    tool_input: toolInput as Record<string, unknown>,
  };
};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new Error(`${label} がありません`);
  return value;
};

/** 書き込み後の内容を組み立てる。組み立てられなければ undefined */
const contentAfter = (input: HookInput, path: string): string | undefined => {
  const toolInput = input.tool_input;
  if (input.tool_name === "Write") {
    return requireString(toolInput["content"], "Write の content");
  }
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  if (current === undefined) return undefined;
  if (input.tool_name === "Edit") {
    return applyEdits(current, [toolInput as unknown as EditSpec]);
  }
  if (input.tool_name === "MultiEdit" && Array.isArray(toolInput["edits"])) {
    return applyEdits(current, toolInput["edits"] as EditSpec[]);
  }
  return undefined;
};

const oldStrings = (input: HookInput): string[] => {
  const toolInput = input.tool_input;
  if (input.tool_name === "Edit") {
    return [asString(toolInput["old_string"])];
  }
  if (input.tool_name === "MultiEdit" && Array.isArray(toolInput["edits"])) {
    return (toolInput["edits"] as EditSpec[]).map((edit) =>
      asString(edit.old_string),
    );
  }
  return [];
};

/** docs/**.md のフロントマター検査 */
const checkFrontmatter = (input: HookInput, path: string): Decision => {
  if (input.tool_name === "NotebookEdit") return ALLOW;
  const after = contentAfter(input, path);
  if (after === undefined) {
    return oldStrings(input).some(touchesFrontmatter)
      ? {
          decision: "ask",
          reason:
            "編集後の内容を組み立てられず、フロントマターを変える編集かどうか判定できません",
        }
      : ALLOW;
  }
  const fm = parseFrontmatter(after);
  if (fm === undefined) {
    return {
      decision: "deny",
      reason:
        "docs/ の文書にはフロントマター（type / business / status と 4 つの日付欄）が必要です",
    };
  }
  const schema = frontmatterSchema();
  const errors = [...new Set(validate(schema, schema, fm.data))];
  if (errors.length > 0) {
    return {
      decision: "deny",
      reason: `フロントマターが規約に合いません：${errors.join("、")}。日付は YYYY-MM-DD か n/a で書きます`,
    };
  }
  if (existsSync(path)) {
    const before = parseFrontmatter(readFileSync(path, "utf8"));
    const created = before?.data["created"];
    if (created !== undefined && created !== fm.data["created"]) {
      return {
        decision: "deny",
        reason: `created（作成日）は書き換えられません（${created} のままにします）`,
      };
    }
  }
  return ALLOW;
};

const judgeWrite = (input: HookInput, company: Company): Decision => {
  const field =
    input.tool_name === "NotebookEdit" ? "notebook_path" : "file_path";
  const path = resolve(
    input.cwd,
    requireString(input.tool_input[field], `${input.tool_name} の ${field}`),
  );
  const key = relativeKey(company.root, path);
  if (key === undefined) return ALLOW;

  let protectedDecision: Decision = ALLOW;
  if (isProtected(key)) {
    if (company.state === "initializing") {
      // 導入前には守るべき憲章がまだ無いため、新規作成は通す。既存ファイルの上書き
      // （最後の state: active への切り替えを含む）だけ人間に確認する
      if (existsSync(path)) {
        protectedDecision = {
          decision: "ask",
          reason: `初期化中（/onboard）に既存の保護対象を書き換えます：${key}`,
        };
      }
    } else {
      const missing = missingRules(company.root);
      if (missing.length > 0) {
        return {
          decision: "deny",
          reason: `厳格モード：防衛設定（.claude/settings.json）が欠けているため、保護対象への書き込みを全て止めています。防衛設定を復旧してください（${missing.join("、")}）`,
        };
      }
      if (!hasApprovingProposal(company.root, key)) {
        return {
          decision: "deny",
          reason: `${key} は保護対象です。先に docs/proposals/ に提案を書き、/approve で承認を取ってください`,
        };
      }
    }
  }
  if (needsFrontmatter(key)) {
    const fm = checkFrontmatter(input, path);
    if (fm.decision !== "allow") return fm;
  }
  return protectedDecision;
};

const judgeCommand = (input: HookInput, company: Company): Decision => {
  const command = requireString(
    input.tool_input["command"],
    `${input.tool_name} の command`,
  );
  const dialect = input.tool_name === "PowerShell" ? "pwsh" : "sh";
  const commands =
    dialect === "pwsh" ? parsePowerShell(command) : parseShell(command);
  const verdict = judgeCommands(commands, dialect, {
    isDocsPath: (arg) => {
      // 変数やホームの展開を含むパスは解決できないため判定しない
      if (arg === "" || /[$~%`]/.test(arg)) return false;
      const key = relativeKey(company.root, resolve(input.cwd, arg));
      return key !== undefined && needsFrontmatter(key);
    },
  });
  return verdict ?? ALLOW;
};

const main = (): Decision | undefined => {
  if (process.env["BUSINESS_OS_HOOK_FAULT"] === "1") {
    throw new Error("BUSINESS_OS_HOOK_FAULT による例外の注入");
  }
  const input = parseInput(readFileSync(0, "utf8"));
  const root = findCompanyRoot(input.cwd);
  if (root === undefined) return undefined; // company ではない（対象外）
  const company = readCompany(root);
  let result = ALLOW;
  let target = "";
  if (WRITE_TOOLS.has(input.tool_name)) {
    target = asString(
      input.tool_input["file_path"] ?? input.tool_input["notebook_path"],
    );
    result = judgeWrite(input, company);
  } else if (COMMAND_TOOLS.has(input.tool_name)) {
    target = asString(input.tool_input["command"]);
    result = judgeCommand(input, company);
  }
  appendLog(root, {
    tool: input.tool_name,
    decision: result.decision,
    reason: result.reason,
    target,
  });
  return result;
};

try {
  const result = main();
  if (result?.decision === "deny") {
    process.stderr.write(`business-os: ${result.reason}\n`);
    process.exitCode = 2;
  } else if (result?.decision === "ask") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `business-os: ${result.reason}`,
        },
      }),
    );
  }
} catch (error) {
  process.stderr.write(
    `business-os: hook の内部エラーのため拒否しました（fail-closed）。${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
