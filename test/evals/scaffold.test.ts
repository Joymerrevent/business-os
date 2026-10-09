// eval の共通の scaffold（evals/lib/scaffold.ts）のテスト。一時フォルダで実行し、作業場所の中身を確かめる。
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { manifestVersion } from "../../plugin/scripts/lib/version.ts";
import { repoRoot } from "../helpers.ts";

const scaffold = (cwd: string, ...args: string[]) =>
  spawnSync(
    process.execPath,
    [join(repoRoot, "evals", "lib", "scaffold.ts"), ...args],
    { cwd, encoding: "utf8" },
  );

describe("evals/lib/scaffold.ts", () => {
  let cwd = "";
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "business-os-scaffold-"));
  });
  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it("empty-repo は空の git リポジトリを作る", () => {
    const run = scaffold(cwd, "empty-repo");
    expect(run.status).toBe(0);
    expect(existsSync(join(cwd, ".git"))).toBe(true);
    expect(existsSync(join(cwd, ".business-os.json"))).toBe(false);
  });

  it("company-initializing は検証用の company を複製し、state を initializing にする", () => {
    const run = scaffold(cwd, "company-initializing");
    expect(run.status).toBe(0);
    expect(existsSync(join(cwd, ".git"))).toBe(true);
    expect(existsSync(join(cwd, "docs", "charter", "company.md"))).toBe(true);
    expect(existsSync(join(cwd, ".claude", "settings.json"))).toBe(true);
    const state = JSON.parse(
      readFileSync(join(cwd, ".business-os.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(state).toEqual({
      state: "initializing",
      pluginVersion: manifestVersion(repoRoot),
    });
  });

  it("company-active は導入済みの company を複製し、ケースの overlay/ を上書きで足す", () => {
    const run = scaffold(
      cwd,
      "company-active",
      join(repoRoot, "evals", "skills", "retro", "history", "overlay"),
    );
    expect(run.status).toBe(0);
    const state = JSON.parse(
      readFileSync(join(cwd, ".business-os.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(state["state"]).toBe("active");
    expect(
      existsSync(join(cwd, "docs", "operations", "daily", "2026-10-01.md")),
    ).toBe(true);
  });

  it("無い共通の環境や overlay/ を重ねようとすると失敗の終了コードを返す", () => {
    expect(scaffold(cwd, "company-active", "no-such-fixture").status).not.toBe(
      0,
    );
    expect(
      scaffold(cwd, "company-active", join(cwd, "no-such-overlay")).status,
    ).not.toBe(0);
  });

  it("知らない名前なら失敗の終了コードを返す", () => {
    const run = scaffold(cwd, "no-such-scaffold");
    expect(run.status).not.toBe(0);
  });
});
