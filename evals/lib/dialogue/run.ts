// 質問の流れを確かめる進行役（ADR 20261003-02）。claude -p を 1 ターンずつ進め、台本どおりに答える。
// 各ターンの質問が台本の順番と合うか、1 ターンに 1 つの項目だけを聞いているかを判定し、成否を終了コードで返す。
// 終了コード：0 合格、1 不合格、2 進行役そのものの失敗（引数の誤り、claude が起動しない など）。
//
// 使い方：node evals/lib/dialogue/run.ts [台本の JSON ...] [--model <モデル>]
// 台本を指定しなければ、evals/skills/ の下の dialogue.json を全て実行する
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  globToRegExp,
  nextStep,
  questionText,
  ScriptFailure,
  type Step,
} from "./steps.ts";

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const skillsDir = join(repoRoot, "evals", "skills");
/** 1 回の台本で送るメッセージの上限。超えたら不合格（質問が終わらない） */
const MAX_MESSAGES = 25;
/** claude -p の 1 回の呼び出しの上限（ミリ秒） */
const CALL_TIMEOUT_MS = 10 * 60 * 1000;

type Script = {
  description: string;
  scaffold: string;
  firstMessage: string;
  steps: Step[];
  allowedFilesAfterDecline: string[];
};
type Turn = {
  sessionId: string;
  text: string;
  costUsd: number;
  isError: boolean;
};

const readScript = (path: string): Script => {
  const data = JSON.parse(readFileSync(path, "utf8")) as Script;
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    throw new Error(`${path} に steps がありません`);
  }
  return data;
};

/** 作業場所を用意する。eval のケースと同じ共通の scaffold を使う */
const prepareWorkspace = (scaffold: string): string => {
  const workspace = realpathSync(
    mkdtempSync(join(tmpdir(), "business-os-dialogue-")),
  );
  const run = spawnSync(
    process.execPath,
    [join(repoRoot, "evals", "lib", "scaffold.ts"), scaffold],
    { cwd: workspace, encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error(`scaffold に失敗しました：${run.stderr}`);
  }
  return workspace;
};

/** 利用者の設定・CLAUDE.md・Plugin・MCP を読まずに claude -p を 1 ターン進める */
const send = (
  workspace: string,
  message: string,
  model: string,
  sessionId: string | null,
): Turn => {
  const args = [
    "-p",
    message,
    "--plugin-dir",
    repoRoot,
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--output-format",
    "json",
    "--model",
    model,
    "--allowedTools",
    "Read",
    "Glob",
    "Grep",
    "Edit(./**)",
    ...(sessionId === null ? [] : ["--resume", sessionId]),
  ];
  const run = spawnSync("claude", args, {
    cwd: workspace,
    encoding: "utf8",
    timeout: CALL_TIMEOUT_MS,
  });
  if (run.status !== 0 && run.stdout.trim() === "") {
    throw new Error(
      `claude が失敗しました（終了コード ${String(run.status)}）：${run.stderr}`,
    );
  }
  const data = JSON.parse(run.stdout) as {
    session_id?: string;
    result?: string;
    total_cost_usd?: number;
    is_error?: boolean;
  };
  if (typeof data.session_id !== "string") {
    throw new Error("claude の出力に session_id がありません");
  }
  return {
    sessionId: data.session_id,
    text: data.result ?? "",
    costUsd: data.total_cost_usd ?? 0,
    isError: data.is_error === true,
  };
};

/** 作業場所に残ったファイル（.git を除く、作業場所からの相対パス） */
const listFiles = (dir: string, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    return entry.isDirectory()
      ? listFiles(join(dir, entry.name), path)
      : [path];
  });

/** claude が作業場所ごとに残す会話の記録のフォルダ。作業場所のパスの英数字以外を - にした名前になる */
const sessionDir = (workspace: string): string =>
  join(
    process.env["CLAUDE_CONFIG_DIR"] ?? join(homedir(), ".claude"),
    "projects",
    workspace.replace(/[^A-Za-z0-9]/g, "-"),
  );

/** evals/skills/ の下の台本（dialogue.json）を全て探す */
const findScripts = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findScripts(path);
    return entry.name === "dialogue.json" ? [path] : [];
  });

/** 台本の名前。evals/skills/<Skill 名>/<ケース名>/dialogue.json なら <Skill 名>-<ケース名> */
const scriptLabel = (scriptPath: string): string =>
  relative(skillsDir, dirname(scriptPath)).split(sep).join("-");

/** 台本を 1 つ実行し、0（合格）か 1（不合格）を返す */
const runScript = (scriptPath: string, model: string): number => {
  const label = scriptLabel(scriptPath);
  const script = readScript(scriptPath);
  const workspace = prepareWorkspace(script.scaffold);
  const log: string[] = [`# ${label}（${model}）`, ""];
  let cost = 0;
  let verdict = 1;
  try {
    let sessionId: string | null = null;
    let message = script.firstMessage;
    let position = -1;
    for (let count = 1; ; count += 1) {
      if (count > MAX_MESSAGES) {
        throw new ScriptFailure(
          `${MAX_MESSAGES} 回答えても台本の終わりに届きません`,
        );
      }
      const turn = send(workspace, message, model, sessionId);
      sessionId = turn.sessionId;
      cost += turn.costUsd;
      log.push(
        `## 送信 ${count}`,
        "",
        message,
        "",
        `## 応答（定価換算 ${turn.costUsd.toFixed(3)} USD）`,
        "",
        turn.text,
        "",
      );
      if (turn.isError)
        throw new ScriptFailure("claude がエラーで止まりました");
      if (position === script.steps.length - 1) break;
      position = nextStep(script.steps, position, questionText(turn.text));
      const step = script.steps[position];
      if (step === undefined) break;
      log.push(`→ 台本の項目：${step.name}`, "");
      message = step.answer;
    }
    const allowed = script.allowedFilesAfterDecline.map(globToRegExp);
    const extra = listFiles(workspace).filter(
      (file) => !allowed.some((pattern) => pattern.test(file)),
    );
    if (extra.length > 0) {
      throw new ScriptFailure(
        `書き出しを断ったのにファイルが書かれました：${extra.join("、")}`,
      );
    }
    verdict = 0;
    log.push("結果：合格");
  } catch (error) {
    if (!(error instanceof ScriptFailure)) throw error;
    log.push(`結果：不合格（${error.message}）`);
  } finally {
    const resultsDir = join(repoRoot, "evals", "results");
    mkdirSync(resultsDir, { recursive: true });
    const logPath = join(
      resultsDir,
      `dialogue-${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.md`,
    );
    writeFileSync(logPath, `${log.join("\n")}\n`);
    process.stdout.write(
      `${label}：${log.at(-1) ?? ""}\n記録：${logPath}\n費用（定価換算）：${cost.toFixed(3)} USD\n`,
    );
    rmSync(workspace, { recursive: true, force: true });
    const sessions = sessionDir(workspace);
    if (existsSync(sessions)) rmSync(sessions, { recursive: true });
  }
  return verdict;
};

const main = (): number => {
  const modelIndex = process.argv.indexOf("--model");
  const model =
    modelIndex === -1 ? "sonnet" : (process.argv[modelIndex + 1] ?? "sonnet");
  const given = process.argv
    .slice(2)
    .filter(
      (arg, index, all) => arg !== "--model" && all[index - 1] !== "--model",
    );
  const scripts = given.length > 0 ? given : findScripts(skillsDir);
  if (scripts.length === 0) {
    process.stderr.write("台本（dialogue.json）が見つかりません\n");
    return 2;
  }
  let verdict = 0;
  for (const scriptPath of scripts) {
    verdict = Math.max(verdict, runScript(scriptPath, model));
  }
  return verdict;
};

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    `進行役が止まりました：${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
