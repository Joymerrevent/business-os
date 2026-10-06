// SessionStart hook：軽い点検。毎セッション、読むだけで何も書かない。全部 OK なら無言。
// 項目の正典は ADR 20260929-06 の表。セッションを止めることはできないため、例外も表示して終える。
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { findCompanyRoot, readCompany, type Company } from "./lib/company.ts";
import { parseFrontmatter } from "./lib/frontmatter.ts";
import { FOUNDATION_SKILLS, pluginRoot, pluginVersion } from "./lib/plugin.ts";
import { readProposals } from "./lib/proposals.ts";
import {
  localWarnings,
  missingMcpAskRules,
  missingRules,
} from "./lib/settings.ts";

const REQUIRED_NODE_MAJOR = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

const readCwd = (): string => {
  const parsed: unknown = JSON.parse(readFileSync(0, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("hook の入力がオブジェクトではありません");
  }
  const cwd = (parsed as Record<string, unknown>)["cwd"];
  if (typeof cwd !== "string")
    throw new Error("hook の入力に cwd がありません");
  return cwd;
};

const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const daysBetween = (from: string, to: string): number =>
  Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

/** 1. Node のバージョン */
const checkNode = (): string[] => {
  const major = Number(process.versions.node.split(".")[0]);
  return major >= REQUIRED_NODE_MAJOR
    ? []
    : [
        `Node.js ${REQUIRED_NODE_MAJOR} 以上が必要です（現在 ${process.versions.node}）`,
      ];
};

/** 2. business-os の 10 Skill とフロントマター */
const checkSkills = (): string[] => {
  const broken: string[] = [];
  for (const name of FOUNDATION_SKILLS) {
    const path = join(pluginRoot(), "skills", name, "SKILL.md");
    if (!existsSync(path)) {
      broken.push(name);
      continue;
    }
    const fm = parseFrontmatter(readFileSync(path, "utf8"));
    if (!fm?.data["name"] || !fm.data["description"]) broken.push(name);
  }
  return broken.length === 0
    ? []
    : [
        `business-os の Skill が読み込めません（無い、または name / description が無い）：${broken.join(", ")}`,
      ];
};

/** 3. hooks.json が指すスクリプト */
const checkHookScripts = (): string[] => {
  const text = readFileSync(join(pluginRoot(), "hooks", "hooks.json"), "utf8");
  const missing = [...text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\\\s]+)/g)]
    .map((match) => match[1] ?? "")
    .filter((rel) => !existsSync(join(pluginRoot(), rel)));
  return missing.length === 0
    ? []
    : [`hooks.json が指すスクリプトがありません：${missing.join(", ")}`];
};

/** 4. 防衛設定（運用中のみ厳格モード） */
const checkSettings = (company: Company): string[] => {
  if (company.state !== "active") return [];
  const missing = missingRules(company.root);
  return missing.length === 0
    ? []
    : [
        `厳格モード：防衛設定（.claude/settings.json と .claude/settings.local.json）に足りない規則か上書きがあるため、憲章などの保護対象への書き込みを全て止めています。防衛設定を復旧してください（${missing.join("、")}）`,
      ];
};

/** 4b. 個人設定（.claude/settings.local.json）が sandbox を広く緩めていないか */
const checkLocalSettings = (company: Company): string[] =>
  localWarnings(company.root);

/** 4c. 雛形の MCP の確認の規則（予備）が .claude/settings.json にそろっているか */
const checkMcpAskRules = (company: Company): string[] => {
  const missing = missingMcpAskRules(company.root);
  return missing.length === 0
    ? []
    : [
        `.claude/settings.json の permissions.ask に、外部のツール（MCP）の操作を確認に回す予備の規則が ${String(missing.length)} 個ありません。business-os の更新の案内（CHANGELOG）に沿って足してください（${missing.join(", ")}）`,
      ];
};

/** 5. /onboard の完了 */
const checkState = (company: Company): string[] =>
  company.state === "initializing"
    ? [
        "/onboard が途中で止まっています（state: initializing）。/onboard を実行して再開してください",
      ]
    : [];

/** 6. approving のまま 24 時間（1 日）以上 */
const checkApproving = (company: Company): string[] => {
  const stale = readProposals(company.root).filter(
    (proposal) =>
      proposal.status === "approving" &&
      /^\d{4}-\d{2}-\d{2}$/.test(proposal.updated) &&
      daysBetween(proposal.updated, today()) >= 1,
  );
  return stale.length === 0
    ? []
    : [
        `承認の途中（approving）のまま 1 日以上たった提案があります：${stale.map((p) => p.id || p.file).join(", ")}。/approve で完了させるか却下してください`,
      ];
};

/** 7. business-os のバージョンの記録 */
const checkVersion = (company: Company): string[] => {
  const actual = pluginVersion();
  return company.pluginVersion === actual
    ? []
    : [
        `business-os が更新されています（記録 ${company.pluginVersion ?? "なし"} → 現在 ${actual}）。/onboard --migrate を実行してください`,
      ];
};

/** 8. hook の記録を書けるか（書き込みはせず、権限だけを見る） */
const checkLogWritable = (company: Company): string[] => {
  const dir = join(company.root, ".claude");
  try {
    accessSync(existsSync(dir) ? dir : company.root, constants.W_OK);
    return [];
  } catch {
    return [`hook の記録（${dir}）に書き込めません`];
  }
};

/** 9. sandbox が使える環境か */
const checkSandbox = (): string[] =>
  process.platform === "win32"
    ? [
        "この環境（native Windows）では CC の sandbox が動かないため、憲章の保護は hook と権限設定だけに頼っています。WSL での利用を勧めます",
      ]
    : [];

/** 10. business-os の Skill と同名の Skill が利用者側にないか */
const checkSkillNames = (company: Company): string[] => {
  const dirs = [
    join(company.root, ".claude", "skills"),
    join(homedir(), ".claude", "skills"),
  ];
  const clashes = FOUNDATION_SKILLS.filter((name) =>
    dirs.some((dir) => existsSync(join(dir, name))),
  );
  return clashes.length === 0
    ? []
    : [
        `business-os の Skill と同じ名前の Skill があり、そちらが優先されます：${clashes.join(", ")}。business-os の Skill は /business-os:<名前> で呼べます`,
      ];
};

const inspect = (): string[] | undefined => {
  if (process.env["BUSINESS_OS_HOOK_FAULT"] === "1") {
    throw new Error("BUSINESS_OS_HOOK_FAULT による例外の注入");
  }
  const root = findCompanyRoot(readCwd());
  if (root === undefined) return undefined;
  const problems = [
    ...checkNode(),
    ...checkSkills(),
    ...checkHookScripts(),
    ...checkSandbox(),
  ];
  let company: Company;
  try {
    company = readCompany(root);
  } catch (error) {
    return [
      ...problems,
      `.business-os.json を読めません（${error instanceof Error ? error.message : String(error)}）。書き込みは全て拒否されます`,
    ];
  }
  const checks = [
    checkSettings,
    checkLocalSettings,
    checkMcpAskRules,
    checkState,
    checkApproving,
    checkVersion,
    checkLogWritable,
    checkSkillNames,
  ];
  for (const check of checks) {
    try {
      problems.push(...check(company));
    } catch (error) {
      problems.push(
        `点検の一部が失敗しました：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return problems;
};

const report = (problems: string[]): void => {
  const message = [
    `business-os の点検で ${problems.length} 件の問題があります`,
    ...problems.map((p) => `- ${p}`),
  ].join("\n");
  process.stdout.write(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: message,
      },
    }),
  );
};

try {
  const problems = inspect();
  if (problems !== undefined && problems.length > 0) report(problems);
} catch (error) {
  report([
    `点検が内部エラーで止まりました：${error instanceof Error ? error.message : String(error)}`,
  ]);
}
