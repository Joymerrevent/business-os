// claude plugin eval 用の一時的な Plugin の組み立て（evals/lib/cases/run.ts）のテスト。
// 配布物・evals/・fixtures/ が 1 つの Plugin に集まり、開発物と過去の記録が混ざらないこと、
// 組み立てた Plugin の中でも scaffold が plugin.json の版を読めること、Plugin の読み込みの判定を確かめる。
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assemblePlugin, pluginLoaded } from "../../evals/lib/cases/run.ts";
import { manifestVersion } from "../../plugin/scripts/lib/version.ts";
import { repoRoot } from "../helpers.ts";

describe("assemblePlugin", () => {
  let dest = "";
  beforeEach(() => {
    dest = mkdtempSync(join(tmpdir(), "business-os-eval-plugin-"));
  });
  afterEach(() => rmSync(dest, { recursive: true, force: true }));

  it("配布物を直下に、evals/ と fixtures/ をその下に集める", () => {
    assemblePlugin(repoRoot, dest);
    for (const path of [
      ".claude-plugin/plugin.json",
      "skills/morning/SKILL.md",
      "hooks/hooks.json",
      "templates/skill-conventions.md",
      "evals/lib/scaffold.ts",
      "evals/skills/validate/start/case.yaml",
      "fixtures/company/.business-os.json",
    ]) {
      expect(existsSync(join(dest, path)), path).toBe(true);
    }
  });

  it("開発物（test/ docs/ plugin/）と過去の記録（evals/results/）は集めない", () => {
    mkdirSync(join(repoRoot, "evals", "results"), { recursive: true });
    assemblePlugin(repoRoot, dest);
    for (const path of ["plugin", "test", "docs", "evals/results"]) {
      expect(existsSync(join(dest, path)), path).toBe(false);
    }
  });

  it("組み立てた Plugin の中の scaffold も plugin.json の版を読める", () => {
    assemblePlugin(repoRoot, dest);
    const cwd = mkdtempSync(join(tmpdir(), "business-os-eval-cwd-"));
    try {
      const run = spawnSync(
        process.execPath,
        [join(dest, "evals", "lib", "scaffold.ts"), "company-initializing"],
        { cwd, encoding: "utf8" },
      );
      expect(run.status, run.stderr).toBe(0);
      const state = JSON.parse(
        readFileSync(join(cwd, ".business-os.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(state["pluginVersion"]).toBe(manifestVersion(repoRoot));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("配布物の Plugin が無ければ例外", () => {
    const empty = mkdtempSync(join(tmpdir(), "business-os-no-plugin-"));
    try {
      expect(() => assemblePlugin(empty, dest)).toThrow(
        "配布物の Plugin がありません",
      );
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("pluginLoaded", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "business-os-eval-result-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const write = (suite: unknown) => {
    const path = join(dir, "aggregate-result.json");
    writeFileSync(path, JSON.stringify({ suite }));
    return path;
  };

  it("suite.plugins に Plugin があれば true", () => {
    expect(pluginLoaded(write({ plugins: [{ name: "business-os" }] }))).toBe(
      true,
    );
  });

  it("suite.plugins が空・無い・結果のファイルが無ければ false", () => {
    expect(pluginLoaded(write({ plugins: [] }))).toBe(false);
    expect(pluginLoaded(write({}))).toBe(false);
    expect(pluginLoaded(join(dir, "missing.json"))).toBe(false);
  });
});
