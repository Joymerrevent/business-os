// hook のテストで使う共通の道具。hook を別プロセスとして起動し、合成した入力を標準入力に渡す。
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const fixtureCompany = join(repoRoot, "test", "fixtures", "company");

export type HookResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export const runHook = (
  name: "pre-tool-use" | "session-start",
  input: unknown,
  env: Record<string, string> = {},
): HookResult => {
  const result = spawnSync(
    process.execPath,
    [join(repoRoot, "hooks", `${name}.ts`)],
    {
      input: typeof input === "string" ? input : JSON.stringify(input),
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: repoRoot,
        BUSINESS_OS_HOOK_FAULT: "",
        ...env,
      },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

/** 検証用の company を一時フォルダに複製して返す。テストの後で消す */
export const makeCompany = (): { root: string; cleanup: () => void } => {
  const root = mkdtempSync(join(tmpdir(), "business-os-company-"));
  cpSync(fixtureCompany, root, { recursive: true });
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** 一時フォルダ（company ではない）を返す */
export const makePlainDir = (): { root: string; cleanup: () => void } => {
  const root = mkdtempSync(join(tmpdir(), "business-os-plain-"));
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

export const setState = (root: string, state: string): void => {
  const path = join(root, ".business-os.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  writeFileSync(path, JSON.stringify({ ...data, state }, null, 2));
};

/** PreToolUse の入力を組み立てる */
export const toolInput = (
  cwd: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Record<string, unknown> => ({
  session_id: "test",
  transcript_path: join(cwd, "transcript.jsonl"),
  cwd,
  hook_event_name: "PreToolUse",
  tool_name: toolName,
  tool_input: toolInput,
});

/** hook の結果を deny / ask / allow に分類する */
export const decisionOf = (result: HookResult): "deny" | "ask" | "allow" => {
  if (result.status === 2) return "deny";
  if (result.status !== 0) return "deny";
  if (result.stdout.trim() === "") return "allow";
  const parsed = JSON.parse(result.stdout) as {
    hookSpecificOutput?: { permissionDecision?: string };
  };
  return parsed.hookSpecificOutput?.permissionDecision === "ask"
    ? "ask"
    : "allow";
};

export const validDoc = (type = "knowledge", status = "active"): string =>
  [
    "---",
    `type: ${type}`,
    "business: portfolio",
    `status: ${status}`,
    "created: 2026-10-01",
    "updated: 2026-10-01",
    "as_of: n/a",
    // 憲章は verified（人間の確認日）が必須
    `verified: ${type === "charter" ? "2026-10-01" : "n/a"}`,
    "---",
    "",
    "# 本文",
    "",
  ].join("\n");
