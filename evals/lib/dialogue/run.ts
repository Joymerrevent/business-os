// 質問の流れを確かめる進行役（ADR 20261003-02）。claude -p を 1 ターンずつ進め、台本どおりに答える。
// 各ターンの質問が台本の順番と合うか、1 ターンに 1 つの項目だけを聞いているかを判定し、成否を終了コードで返す。
// 終了コード：0 合格、1 不合格、2 進行役そのものの失敗（引数の誤り、claude が起動しない など）。
//
// 使い方：node evals/lib/dialogue/run.ts [台本の JSON ...] [--model <モデル>]
// 台本を指定しなければ、evals/skills/ の下の dialogue.json を全て実行する
//
// 台本に "sandbox": true があれば、作業場所の安全設定（.claude/settings.json と settings.local.json）を読み込み、
// Bash を許して起動する（ADR 20261003-13）。"signing" があれば、偽の署名プログラムと試験のソケットを用意する。
// どちらも macOS でだけ動かす（sandbox.network.allowUnixSockets が macOS でしか効かないため）
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
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
  changedFiles,
  fillPlaceholders,
  forbiddenMatches,
  nextStep,
  ScriptFailure,
  toolInputs,
  type Expect,
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
/** 同じ項目が続けて聞かれてよい回数。超えたら不合格（聞き返しが終わらない） */
const MAX_REPEATS = 3;
/** claude -p の 1 回の呼び出しの上限（ミリ秒） */
const CALL_TIMEOUT_MS = 10 * 60 * 1000;

type Script = {
  description: string;
  scaffold: string;
  firstMessage: string;
  steps: Step[];
  /** 作られても変わってもよいファイル（`*` を使える）。名前は断るケースの名残で、書くケースでも使う */
  allowedFilesAfterDecline: string[];
  /** 作業場所の安全設定を読み込み、Bash を許す */
  sandbox?: boolean;
  /** 偽の署名プログラムで署名する。allow なら settings.local.json で試験のソケットへの接続を許す */
  signing?: "deny" | "allow";
  /** 終わった後の状態の判定 */
  expect?: Expect;
};

/** 試験のソケット。偽の署名プログラムと、/onboard が探す SSH_AUTH_SOCK が指す */
type Agent = { path: string; child: ChildProcess; dir: string };
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
const prepareWorkspace = (scaffold: string, signing: boolean): string => {
  const workspace = realpathSync(
    mkdtempSync(join(tmpdir(), "business-os-dialogue-")),
  );
  const run = spawnSync(
    process.execPath,
    [
      join(repoRoot, "evals", "lib", "scaffold.ts"),
      scaffold,
      ...(signing ? ["--signing"] : []),
    ],
    { cwd: workspace, encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error(`scaffold に失敗しました：${run.stderr}`);
  }
  return workspace;
};

const git = (workspace: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: workspace, encoding: "utf8" });

/** 試験のソケットで待つ子のプロセス。接続されたら 1 行返して閉じるだけの、署名の agent の代わり */
const AGENT_SCRIPT = `
const { createServer } = require("node:net");
createServer((socket) => socket.end("ok\\n")).listen(process.argv[1]);
`;

/**
 * 試験のソケットを作業場所の外に開く（作業場所の中に置くと、ファイルの前後の比較で読めない）。
 * claude を spawnSync で待つ間は進行役のイベントループが止まるため、別のプロセスで待つ
 */
const openAgent = (): Agent => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "bos-agent-")));
  const path = join(dir, "agent.sock");
  const child = spawn(process.execPath, ["-e", AGENT_SCRIPT, path], {
    stdio: "ignore",
  });
  // 進行役が例外で止まっても、子のプロセスが進行役の終了を引き止めないようにする
  child.unref();
  const deadline = Date.now() + 5000;
  while (!existsSync(path)) {
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("試験のソケットを開けませんでした");
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
  return { path, child, dir };
};

const closeAgent = (agent: Agent): void => {
  agent.child.kill();
  rmSync(agent.dir, { recursive: true, force: true });
};

/** 偽の署名プログラムに試験のソケットを教え、allow なら settings.local.json で接続を許す */
const connectAgent = (
  workspace: string,
  agent: Agent,
  signing: "deny" | "allow",
): void => {
  const config = git(workspace, "config", "eval.agentSocket", agent.path);
  if (config.status !== 0) {
    throw new Error(`git config に失敗しました：${config.stderr}`);
  }
  if (signing !== "allow") return;
  const path = join(workspace, ".claude", "settings.local.json");
  const local = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
    : {};
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      { ...local, sandbox: { network: { allowUnixSockets: [agent.path] } } },
      null,
      2,
    )}\n`,
  );
};

/** 作業場所のリポジトリのコミットの数（コミットが無ければ 0） */
const commitCount = (workspace: string): number => {
  const run = git(workspace, "rev-list", "--count", "HEAD");
  return run.status === 0 ? Number(run.stdout.trim()) : 0;
};

/** 台本の終わった後の判定。外れたら ScriptFailure */
const checkExpect = (
  workspace: string,
  expect: Expect,
  finalText: string,
  bashInputs: string[],
  socket: string,
): void => {
  if (expect.commits !== undefined) {
    const count = commitCount(workspace);
    if (count !== expect.commits) {
      throw new ScriptFailure(
        `コミットの数が ${String(expect.commits)} ではなく ${String(count)} です`,
      );
    }
  }
  if (expect.signedHead === true) {
    const head = git(workspace, "cat-file", "-p", "HEAD");
    if (head.status !== 0 || !head.stdout.includes("\ngpgsig ")) {
      throw new ScriptFailure("最後のコミットに署名（gpgsig）がありません");
    }
  }
  for (const text of expect.finalTextIncludes ?? []) {
    const wanted = fillPlaceholders(text, socket);
    if (!finalText.includes(wanted)) {
      throw new ScriptFailure(`最後の応答に「${wanted}」がありません`);
    }
  }
  const used = forbiddenMatches(bashInputs, expect.forbiddenBashInputs ?? []);
  if (used.length > 0) {
    throw new ScriptFailure(
      `使ってはいけない Bash の呼び出しがあります：${used.join("、")}`,
    );
  }
};

/**
 * 利用者の設定・CLAUDE.md・Plugin・MCP を読まずに claude -p を 1 ターン進める。
 * sandbox なら、作業場所の安全設定（project と local）だけを読み、Bash を許す。
 * 利用者の設定（user）は、どちらでも読まない
 */
const send = (
  workspace: string,
  message: string,
  model: string,
  sessionId: string | null,
  sandbox: boolean,
  agent: Agent | undefined,
): Turn => {
  const args = [
    "-p",
    message,
    "--plugin-dir",
    repoRoot,
    "--setting-sources",
    sandbox ? "project,local" : "",
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
    ...(sandbox ? ["Bash"] : []),
    ...(sessionId === null ? [] : ["--resume", sessionId]),
  ];
  const run = spawnSync("claude", args, {
    cwd: workspace,
    encoding: "utf8",
    timeout: CALL_TIMEOUT_MS,
    env:
      agent === undefined
        ? process.env
        : { ...process.env, SSH_AUTH_SOCK: agent.path },
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

/** 作業場所の全ファイルの中身。scaffold の直後と終わった後を比べ、新しく作られた・変わったファイルを見つける */
const snapshot = (workspace: string): Map<string, string> =>
  new Map(
    listFiles(workspace).map((file) => [
      file,
      readFileSync(join(workspace, file), "utf8"),
    ]),
  );

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

/** 作業場所の会話の記録（JSON Lines）を全て読み、Bash の呼び出しの入力を返す */
const bashInputsOf = (workspace: string): string[] => {
  const dir = sessionDir(workspace);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      toolInputs(readFileSync(join(dir, name), "utf8"), "Bash"),
    );
};

/** 台本を 1 つ実行し、0（合格）か 1（不合格）を返す */
const runScript = (scriptPath: string, model: string): number => {
  const label = scriptLabel(scriptPath);
  const script = readScript(scriptPath);
  const sandbox = script.sandbox === true || script.signing !== undefined;
  if (sandbox && process.platform !== "darwin") {
    process.stdout.write(
      `${label}：飛ばしました（Bash と sandbox を使う台本は macOS でだけ動きます）\n`,
    );
    return 0;
  }
  const workspace = prepareWorkspace(
    script.scaffold,
    script.signing !== undefined,
  );
  const agent = script.signing === undefined ? undefined : openAgent();
  const socket = agent?.path ?? "";
  const log: string[] = [`# ${label}（${model}）`, ""];
  let cost = 0;
  let verdict = 1;
  try {
    if (agent !== undefined && script.signing !== undefined) {
      connectAgent(workspace, agent, script.signing);
    }
    const before = snapshot(workspace);
    let sessionId: string | null = null;
    let message = script.firstMessage;
    let position = -1;
    let repeats = 0;
    let finalText = "";
    for (let count = 1; ; count += 1) {
      if (count > MAX_MESSAGES) {
        throw new ScriptFailure(
          `${MAX_MESSAGES} 回答えても台本の終わりに届きません`,
        );
      }
      const turn = send(workspace, message, model, sessionId, sandbox, agent);
      sessionId = turn.sessionId;
      cost += turn.costUsd;
      finalText = turn.text;
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
      const next = nextStep(script.steps, position, turn.text);
      repeats = next === position ? repeats + 1 : 0;
      if (repeats >= MAX_REPEATS) {
        throw new ScriptFailure(
          `同じ項目で ${MAX_REPEATS} 回続けて聞かれ、先に進みません`,
        );
      }
      position = next;
      const step = script.steps[position];
      if (step === undefined) break;
      for (const text of step.responseIncludes ?? []) {
        const wanted = fillPlaceholders(text, socket);
        if (!turn.text.includes(wanted)) {
          throw new ScriptFailure(
            `質問 ${String(step.question)} の応答に「${wanted}」がありません`,
          );
        }
      }
      log.push(
        `→ 台本の項目：${step.name}${repeats > 0 ? "（くり返し・聞き返し）" : ""}`,
        "",
      );
      message =
        repeats > 0 && step.clarify !== undefined ? step.clarify : step.answer;
    }
    const extra = changedFiles(
      before,
      snapshot(workspace),
      script.allowedFilesAfterDecline,
    );
    if (extra.length > 0) {
      throw new ScriptFailure(
        `台本で許していないファイルが書かれた・変わりました：${extra.join("、")}`,
      );
    }
    if (script.expect !== undefined) {
      checkExpect(
        workspace,
        script.expect,
        finalText,
        bashInputsOf(workspace),
        socket,
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
    if (agent !== undefined) closeAgent(agent);
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
