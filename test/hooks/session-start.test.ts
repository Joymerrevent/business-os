// SessionStart hook（軽い点検）のテスト。問題があるときだけ表示し、何も書かないことを確かめる。
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeCompany, makePlainDir, runHook, setState } from "../helpers.ts";

let root = "";
let home = "";
let cleanup = (): void => {};
let cleanupHome = (): void => {};

const start = (env: Record<string, string> = {}) =>
  runHook(
    "session-start",
    {
      session_id: "test",
      transcript_path: join(root, "transcript.jsonl"),
      cwd: root,
      hook_event_name: "SessionStart",
      source: "startup",
    },
    { HOME: home, USERPROFILE: home, ...env },
  );

/** 表示された点検結果の本文 */
const messageOf = (stdout: string): string => {
  if (stdout.trim() === "") return "";
  const parsed = JSON.parse(stdout) as { systemMessage?: string };
  return parsed.systemMessage ?? "";
};

beforeEach(() => {
  ({ root: home, cleanup: cleanupHome } = makePlainDir());
});
afterEach(() => {
  cleanup();
  cleanupHome();
});

describe("company ではないディレクトリ", () => {
  beforeEach(() => ({ root, cleanup } = makePlainDir()));

  it("何もせず無言", () => {
    const result = start();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("company", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it("何も書かない", () => {
    const before = readdirSync(root, { recursive: true }).length;
    start();
    expect(readdirSync(root, { recursive: true }).length).toBe(before);
  });

  it("settings.json の必須規則が欠けると厳格モードを知らせる", () => {
    writeFileSync(join(root, ".claude/settings.json"), "{}");
    const message = messageOf(start().stdout);
    expect(message).toContain("厳格モード");
  });

  it("初期化中なら /onboard の再開を促す", () => {
    setState(root, "initializing");
    expect(messageOf(start().stdout)).toContain("/onboard");
  });

  it("approving のまま 1 日以上たった提案を知らせる", () => {
    const path = join(root, "docs/proposals/20261001-01-approving-company.md");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        "updated: 2026-10-01",
        "updated: 2000-01-01",
      ),
    );
    expect(messageOf(start().stdout)).toContain("20261001-01");
  });

  it("器のバージョンが記録と違えば --migrate を促す", () => {
    const path = join(root, ".business-os.json");
    const data = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(path, JSON.stringify({ ...data, pluginVersion: "0.0.1" }));
    expect(messageOf(start().stdout)).toContain("--migrate");
  });

  it("利用者側に器と同名の Skill があれば知らせる", () => {
    mkdirSync(join(home, ".claude/skills/morning"), { recursive: true });
    expect(messageOf(start().stdout)).toContain("morning");
  });

  it("壊れた .business-os.json を知らせる（例外で止まらない）", () => {
    writeFileSync(join(root, ".business-os.json"), "{broken");
    const result = start();
    expect(result.status).toBe(0);
    expect(messageOf(result.stdout)).toContain(".business-os.json");
  });

  it("例外を注入しても表示して終わる（セッションは止めない）", () => {
    const result = start({ BUSINESS_OS_HOOK_FAULT: "1" });
    expect(result.status).toBe(0);
    expect(messageOf(result.stdout)).toContain("点検");
  });
});
