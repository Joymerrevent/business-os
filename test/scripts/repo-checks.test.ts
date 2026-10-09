// business-os の検査（scripts/lib/repo-checks.ts）のテスト。実際の business-os で fail が無いことと、
// business-os の一時コピーを壊すと fail になることを確かめる。
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
  checkAgents,
  checkAdrIndex,
  checkDocs,
  checkEvals,
  checkForms,
  checkHooks,
  checkLeak,
  checkShell,
  checkSkills,
  checkTemplates,
  checkUsage,
} from "../../plugin/scripts/lib/repo-checks.ts";
import { repoRoot } from "../helpers.ts";

type Check = (root?: string) => { level: string; name: string }[];
const failsOf = (check: Check, root?: string) =>
  check(root).filter((r) => r.level === "fail");

describe("実際の business-os", () => {
  it.each([
    ["skills", checkSkills],
    ["hooks", checkHooks],
    ["templates", checkTemplates],
    ["docs", checkDocs],
    ["adr", checkAdrIndex],
    ["usage", checkUsage],
    ["adapters", checkAdapters],
    ["agents", checkAgents],
    ["shell", checkShell],
    ["evals", checkEvals],
    ["forms", checkForms],
  ] as [string, Check][])("%s に fail が無い", (_, check) => {
    expect(failsOf(check)).toEqual([]);
  });
});

describe("壊した business-os の一時コピー", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "business-os-repo-"));
    for (const dir of ["plugin", "docs", ".claude-plugin", ".github"]) {
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
      "plugin/adapters/obsidian/bases/state.base",
      "      - as_of",
      "      - owner",
    );
    edit("plugin/adapters/obsidian/vault/app.json", "{", "{,");
    const fails = failsOf(checkAdapters, root).map((r) => r.name);
    expect(fails).toContain("plugin/adapters/obsidian/bases/state.base");
    expect(fails).toContain("plugin/adapters/obsidian/vault/app.json");
  });

  it("作業者に Bash を持たせる・版番号でモデルを書く・役割エージェントを同梱すると fail", () => {
    edit(
      "plugin/agents/worker.md",
      "tools: Read, Grep, Glob, Write, Edit",
      "tools: Read, Grep, Glob, Write, Edit, Bash",
    );
    edit("plugin/agents/worker.md", "model: sonnet", "model: claude-sonnet-5");
    writeFileSync(
      join(root, "plugin", "agents", "cfo.md"),
      "---\nname: cfo\ndescription: x\nmodel: opus\ntools: Read\n---\n",
    );
    const fails = failsOf(checkAgents, root);
    expect(fails.map((r) => r.name)).toContain("plugin/agents/worker.md");
    expect(fails.map((r) => r.name)).toContain("plugin/agents/");
  });

  describe("Skill の検証", () => {
    const addCase = (path: string) => {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, "case.yaml"), 'schema_version: "1.1"\n');
    };
    const levelOf = (name: string) =>
      checkEvals(root).find((r) => r.name === name)?.level;

    it("ケースの無い Skill は warn、対象外の /check は数えない", () => {
      expect(levelOf("plugin/skills/morning")).toBe("warn");
      expect(levelOf("plugin/skills/check")).toBeUndefined();
      expect(failsOf(checkEvals, root)).toEqual([]);
    });

    it("ケースのある Skill は pass", () => {
      addCase("evals/skills/morning/daily");
      expect(levelOf("evals/skills/morning")).toBe("pass");
      expect(levelOf("plugin/skills/morning")).toBeUndefined();
    });

    it("plugin/skills/ に無い名前の検証は fail（改名・削除の追従漏れ）", () => {
      addCase("evals/skills/mornings/daily");
      expect(failsOf(checkEvals, root).map((r) => r.name)).toContain(
        "evals/skills/mornings",
      );
    });

    it("対象外の Skill に検証があると fail（対象外の一覧が古い）", () => {
      addCase("evals/skills/check/run");
      expect(failsOf(checkEvals, root).map((r) => r.name)).toContain(
        "evals/skills/check",
      );
    });

    it("フォルダだけでケースが無ければ warn", () => {
      mkdirSync(join(root, "evals", "skills", "morning", "daily"), {
        recursive: true,
      });
      expect(levelOf("evals/skills/morning")).toBe("warn");
    });
  });

  describe("シェルスクリプト", () => {
    const add = (path: string, text: string) => {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
      spawnSync("git", ["add", "-A"], { cwd: root });
    };
    const shellFails = () => failsOf(checkShell, root).map((r) => r.name);

    it("evals/ の scaffold.sh が exec node の 1 行なら fail にならない", () => {
      add(
        "evals/skills/onboard/x/scaffold.sh",
        '#!/usr/bin/env bash\n# コメント\n\nexec node "$(dirname "$0")/../../lib/scaffold.ts" empty-repo\n',
      );
      expect(shellFails()).toEqual([]);
    });

    it("scaffold.sh に 2 行目の処理があると fail", () => {
      add(
        "evals/skills/onboard/x/scaffold.sh",
        '#!/usr/bin/env bash\ngit init -q\nexec node "$(dirname "$0")/../../lib/scaffold.ts" empty-repo\n',
      );
      expect(shellFails()).toContain("evals/skills/onboard/x/scaffold.sh");
    });

    it("scaffold.sh の 1 行が exec node でないと fail", () => {
      add(
        "evals/skills/onboard/x/scaffold.sh",
        "#!/usr/bin/env bash\ngit init -q\n",
      );
      expect(shellFails()).toContain("evals/skills/onboard/x/scaffold.sh");
    });

    it("evals/ の外の .sh と、拡張子の無い bash のファイルは fail", () => {
      add("scripts/setup.sh", "#!/usr/bin/env bash\necho hi\n");
      add("evals/skills/onboard/x/prepare.sh", "exec node x.ts\n");
      add("scripts/setup", "#!/bin/bash\necho hi\n");
      const fails = shellFails();
      expect(fails).toContain("scripts/setup.sh");
      expect(fails).toContain("evals/skills/onboard/x/prepare.sh");
      expect(fails).toContain("scripts/setup");
    });
  });

  it("Skill の節が欠けると fail", () => {
    edit("plugin/skills/morning/SKILL.md", "## 完了条件", "## 終わり");
    expect(failsOf(checkSkills, root).map((r) => r.name)).toContain(
      "plugin/skills/morning",
    );
  });

  it("disable-model-invocation が無いと fail", () => {
    edit("plugin/skills/adr/SKILL.md", "disable-model-invocation: true\n", "");
    expect(failsOf(checkSkills, root).map((r) => r.name)).toContain(
      "plugin/skills/adr",
    );
  });

  describe("質問の表", () => {
    const detailOf = () =>
      checkSkills(root).find(
        (r) => r.level === "fail" && r.name === "plugin/skills/morning",
      )?.detail ?? "";

    it("質問の表が無いと fail", () => {
      edit(
        "plugin/skills/morning/SKILL.md",
        "| 番号 | 見出し | 質問文 | 答えの形 | 選択肢 | 聞くとき |",
        "- 今日の優先事項の順番",
      );
      expect(detailOf()).toContain("質問の表");
    });

    it("番号が 1 からの連番でないと fail", () => {
      edit(
        "plugin/skills/morning/SKILL.md",
        "| 2 | 優先事項の変更 |",
        "| 3 | 優先事項の変更 |",
      );
      expect(detailOf()).toContain("連番でない");
    });

    it("見出しが 12 文字を超えると fail", () => {
      edit(
        "plugin/skills/morning/SKILL.md",
        "| 1 | 優先事項の順番 |",
        "| 1 | 今日の優先事項の順番を確かめる |",
      );
      expect(detailOf()).toContain("12 文字を超える");
    });

    it("答えの形が決まった形でない・選択肢の質問に選択肢が無いと fail", () => {
      edit(
        "plugin/skills/morning/SKILL.md",
        "| 選択肢（単一） | この順でよい / 変える |",
        "| 選択肢（単一） | — |",
      );
      edit(
        "plugin/skills/morning/SKILL.md",
        "| 自由記述 | — | 質問 1 で",
        "| 記述 | — | 質問 1 で",
      );
      const detail = detailOf();
      expect(detail).toContain("選択肢が無い");
      expect(detail).toContain("決まった形でない");
    });
  });

  it("配布する Skill の一覧に無い Skill を足すと fail", () => {
    mkdirSync(join(root, "plugin", "skills", "extra"));
    expect(failsOf(checkSkills, root).length).toBeGreaterThan(0);
  });

  it("hooks.json のパスに引用符が無いと fail", () => {
    edit(
      "plugin/hooks/hooks.json",
      '\\"${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use.ts\\"',
      "${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use.ts",
    );
    expect(failsOf(checkHooks, root).length).toBeGreaterThan(0);
  });

  it("Issue のフォームの項目の id を変えると fail", () => {
    edit(".github/ISSUE_TEMPLATE/bug-report.yml", "id: run-mode", "id: mode");
    expect(failsOf(checkForms, root).length).toBeGreaterThan(0);
  });

  it("URL で事前に入力する項目を dropdown にすると fail", () => {
    edit(
      ".github/ISSUE_TEMPLATE/bug-report.yml",
      "  - type: input\n    id: os",
      "  - type: dropdown\n    id: os",
    );
    expect(failsOf(checkForms, root).length).toBeGreaterThan(0);
  });

  it("PreToolUse の matcher から MCP の道具の型を外すと fail", () => {
    edit("plugin/hooks/hooks.json", "|mcp__.*", "");
    expect(failsOf(checkHooks, root).length).toBeGreaterThan(0);
  });

  it("README に無い変数を雛形に足すと fail", () => {
    edit(
      "plugin/templates/operations/risks.md",
      "# リスク台帳",
      "# リスク台帳 {{ undocumented_var }}",
    );
    expect(failsOf(checkTemplates, root).map((r) => r.name)).toContain(
      "plugin/templates/operations/risks.md",
    );
  });

  it("plugin/templates/ の直下以外の README.md も雛形として検査する", () => {
    edit(
      "plugin/templates/charter/repositories/README.md",
      "# 実装リポジトリ",
      "# 実装リポジトリ {{ undocumented_var }}",
    );
    expect(failsOf(checkTemplates, root).map((r) => r.name)).toContain(
      "plugin/templates/charter/repositories/README.md",
    );
  });

  it("雛形のフロントマターがスキーマに合わないと fail", () => {
    edit("plugin/templates/operations/risks.md", "type: ledger", "type: memo");
    expect(failsOf(checkTemplates, root).length).toBeGreaterThan(0);
  });

  it("ADR の一覧と status が食い違うと fail", () => {
    edit(
      "docs/adr/README.md",
      "| 20260929-01 | シェル非依存 | accepted |",
      "| 20260929-01 | シェル非依存 | proposed |",
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

  it("利用者向けの docs/usage/ はフロントマターが無くても fail にしない", () => {
    expect(
      readFileSync(join(root, "docs/usage/operations.md"), "utf8").startsWith(
        "---",
      ),
    ).toBe(false);
    expect(failsOf(checkDocs, root)).toEqual([]);
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
