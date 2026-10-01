// 器の検査（scripts/lib/repo-checks.ts）のテスト。実際の器で fail が無いことと、
// 器の一時コピーを壊すと fail になることを確かめる。
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkAdapters,
  checkAdrIndex,
  checkDocs,
  checkHooks,
  checkLeak,
  checkSkills,
  checkTemplates,
  checkUsage,
} from "../../scripts/lib/repo-checks.ts";
import { repoRoot } from "../helpers.ts";

type Check = (root?: string) => { level: string; name: string }[];
const failsOf = (check: Check, root?: string) =>
  check(root).filter((r) => r.level === "fail");

describe("実際の器", () => {
  it.each([
    ["skills", checkSkills],
    ["hooks", checkHooks],
    ["templates", checkTemplates],
    ["docs", checkDocs],
    ["adr", checkAdrIndex],
    ["usage", checkUsage],
    ["adapters", checkAdapters],
  ] as [string, Check][])("%s に fail が無い", (_, check) => {
    expect(failsOf(check)).toEqual([]);
  });
});

describe("壊した器の一時コピー", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "business-os-repo-"));
    for (const dir of [
      "skills",
      "adapters",
      "hooks",
      "templates",
      "docs",
      "scripts",
      ".claude-plugin",
    ]) {
      cpSync(join(repoRoot, dir), join(root, dir), { recursive: true });
    }
    for (const file of [
      "README.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CODE_OF_CONDUCT.md",
      "LICENSE",
      "CLAUDE.md",
      "package.json",
    ]) {
      cpSync(join(repoRoot, file), join(root, file));
    }
    spawnSync("git", ["init", "-q"], { cwd: root });
    spawnSync("git", ["add", "-A"], { cwd: root });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const edit = (path: string, from: string, to: string) => {
    const full = join(root, path);
    const text = readFileSync(full, "utf8");
    expect(text).toContain(from);
    writeFileSync(full, text.replace(from, to));
  };

  it("壊す前は fail が無い", () => {
    for (const check of [
      checkSkills,
      checkHooks,
      checkTemplates,
      checkDocs,
      checkAdrIndex,
      checkUsage,
    ]) {
      expect(failsOf(check, root)).toEqual([]);
    }
  });

  it("ダッシュボードが第 9 節に無いプロパティを使うと fail、壊れた JSON も fail", () => {
    edit(
      "adapters/obsidian/bases/state.base",
      "      - as_of",
      "      - owner",
    );
    edit("adapters/obsidian/vault/app.json", "{", "{,");
    const fails = failsOf(checkAdapters, root).map((r) => r.name);
    expect(fails).toContain("adapters/obsidian/bases/state.base");
    expect(fails).toContain("adapters/obsidian/vault/app.json");
  });

  it("Skill の節が欠けると fail", () => {
    edit("skills/morning/SKILL.md", "## 完了条件", "## 終わり");
    expect(failsOf(checkSkills, root).map((r) => r.name)).toContain(
      "skills/morning",
    );
  });

  it("disable-model-invocation が無いと fail", () => {
    edit("skills/adr/SKILL.md", "disable-model-invocation: true\n", "");
    expect(failsOf(checkSkills, root).map((r) => r.name)).toContain(
      "skills/adr",
    );
  });

  it("11 個目の Skill を足すと fail", () => {
    mkdirSync(join(root, "skills", "extra"));
    expect(failsOf(checkSkills, root).length).toBeGreaterThan(0);
  });

  it("hooks.json のパスに引用符が無いと fail", () => {
    edit(
      "hooks/hooks.json",
      '\\"${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use.ts\\"',
      "${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use.ts",
    );
    expect(failsOf(checkHooks, root).length).toBeGreaterThan(0);
  });

  it("README に無い変数を雛形に足すと fail", () => {
    edit(
      "templates/operations/risks.md",
      "# リスク台帳",
      "# リスク台帳 {{ undocumented_var }}",
    );
    expect(failsOf(checkTemplates, root).map((r) => r.name)).toContain(
      "templates/operations/risks.md",
    );
  });

  it("雛形のフロントマターがスキーマに合わないと fail", () => {
    edit("templates/operations/risks.md", "type: ledger", "type: memo");
    expect(failsOf(checkTemplates, root).length).toBeGreaterThan(0);
  });

  it("ADR の一覧と status が食い違うと fail", () => {
    edit(
      "docs/adr/README.md",
      "| 20260929-01 | シェル非依存 | proposed |",
      "| 20260929-01 | シェル非依存 | accepted |",
    );
    expect(failsOf(checkAdrIndex, root).length).toBe(1);
  });

  it("利用者向け文書に ADR の番号があると fail、HTML コメントの中なら pass", () => {
    const path = join(root, "docs", "usage", "operations.md");
    writeFileSync(
      path,
      `${readFileSync(path, "utf8")}\n<!-- 根拠: 20260929-05 -->\n`,
    );
    expect(failsOf(checkUsage, root)).toEqual([]);
    writeFileSync(
      path,
      `${readFileSync(path, "utf8")}\n詳しくは 20260929-05 を参照。\n`,
    );
    expect(failsOf(checkUsage, root).length).toBe(1);
  });

  it("文書のリンク切れと、フロントマターの欠落は fail", () => {
    edit(
      "docs/usage/operations.md",
      "# 日々の運用",
      "# 日々の運用\n\n[無い](nowhere.md)",
    );
    edit("docs/adr/README.md", "type: knowledge\n", "");
    const fails = failsOf(checkDocs, root).map((r) => r.name);
    expect(fails).toContain("相対リンク");
    expect(fails).toContain("docs/adr/README.md");
  });

  it("固有名詞の辞書の語が見つかれば fail", () => {
    const dict = join(root, "dict.json");
    writeFileSync(dict, JSON.stringify({ terms: ["シェル非依存"] }));
    const previous = process.env["BUSINESS_OS_LEAK_DICT"];
    process.env["BUSINESS_OS_LEAK_DICT"] = dict;
    try {
      expect(failsOf(checkLeak, root).map((r) => r.name)).toContain(
        "固有名詞の辞書",
      );
    } finally {
      if (previous === undefined) delete process.env["BUSINESS_OS_LEAK_DICT"];
      else process.env["BUSINESS_OS_LEAK_DICT"] = previous;
    }
  });
});
