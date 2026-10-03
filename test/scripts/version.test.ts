// 版の同期と比較（scripts/lib/version.ts）と、版とリリースの検査（check:release）のテスト。
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkRelease } from "../../scripts/lib/repo-checks.ts";
import {
  compareVersions,
  syncPluginVersion,
} from "../../scripts/lib/version.ts";

let root = "";
const write = (pkg: string, manifest: string) => {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "business-os", version: pkg }),
  );
  writeFileSync(
    join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "business-os",
      version: manifest,
      description: "x",
    }),
  );
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "business-os-version-"));
  mkdirSync(join(root, ".claude-plugin"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("syncPluginVersion", () => {
  it("package.json の版を plugin.json に写し、ほかの欄は保つ", () => {
    write("0.1.0", "0.0.0");
    expect(syncPluginVersion(root)).toBe("0.1.0");
    const manifest = JSON.parse(
      readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(manifest).toEqual({
      name: "business-os",
      version: "0.1.0",
      description: "x",
    });
  });

  it("semver でない版は例外", () => {
    write("next", "0.0.0");
    expect(() => syncPluginVersion(root)).toThrow("semver");
  });
});

describe("compareVersions", () => {
  it.each([
    ["0.2.0", "0.1.0", 1],
    ["0.1.0", "0.2.0", -1],
    ["0.2.0", "0.2.0", 0],
    ["1.0.0", "0.10.0", 1],
    ["0.10.0", "0.9.0", 1],
    ["0.2.0-beta.0", "0.2.0", -1],
    ["0.2.0-beta.1", "0.2.0-beta.0", 1],
    ["0.2.0-beta.10", "0.2.0-beta.2", 1],
    ["0.2.0-alpha.1", "0.2.0-beta.0", -1],
  ])("%s と %s を比べると %i", (a, b, expected) => {
    expect(Math.sign(compareVersions(a, b))).toBe(expected);
  });
});

describe("checkRelease", () => {
  /** 一時フォルダを git リポジトリにして 1 つコミットし、渡した版のタグを打つ（署名は付けない） */
  const git = (...args: string[]) =>
    spawnSync(
      "git",
      [
        "-c",
        "user.name=test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "tag.gpgsign=false",
        ...args,
      ],
      { cwd: root, encoding: "utf8" },
    );
  const tagged = (...versions: string[]) => {
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "--allow-empty", "-m", "init");
    for (const version of versions) git("tag", `business-os--v${version}`);
  };
  const changelog = (version: string) =>
    writeFileSync(
      join(root, "CHANGELOG.md"),
      `# business-os\n\n## ${version}\n\n- 変更\n`,
    );
  const releasePr = { GITHUB_BASE_REF: "main" };
  const failsOf = (env: NodeJS.ProcessEnv) =>
    checkRelease(root, env)
      .filter((r) => r.level === "fail")
      .map((r) => r.name);

  it("版が一致していれば pass、食い違えば fail", () => {
    write("0.1.0", "0.1.0");
    expect(failsOf({})).toEqual([]);
    write("0.1.0", "0.0.0");
    expect(failsOf({})).toEqual(["package.json と plugin.json の version"]);
  });

  it("main 向けでない PR では、タグも CHANGELOG も見ない", () => {
    write("0.1.0", "0.1.0");
    expect(failsOf({ GITHUB_BASE_REF: "develop" })).toEqual([]);
  });

  it("main 向けの PR：版がタグより大きく、CHANGELOG に節があり、changeset が残っていなければ pass", () => {
    write("0.3.0", "0.3.0");
    changelog("0.3.0");
    mkdirSync(join(root, ".changeset"));
    writeFileSync(join(root, ".changeset", "README.md"), "x");
    tagged("0.1.0", "0.2.0");
    expect(failsOf(releasePr)).toEqual([]);
  });

  it("main 向けの PR：直近のタグと同じ版・小さい版は fail", () => {
    write("0.2.0", "0.2.0");
    changelog("0.2.0");
    tagged("0.1.0", "0.2.0");
    expect(failsOf(releasePr)).toEqual(["版が直近のタグより大きい"]);
  });

  it("main 向けの PR：CHANGELOG の節が無い・changeset が残っていると fail", () => {
    write("0.3.0", "0.3.0");
    changelog("0.2.0");
    mkdirSync(join(root, ".changeset"));
    writeFileSync(join(root, ".changeset", "some-change.md"), "x");
    tagged("0.2.0");
    expect(failsOf(releasePr)).toEqual([
      "CHANGELOG の版の節",
      "使い残しの changeset",
    ]);
  });

  it("main 向けの PR：タグを読めなければ fail（比べる基準が無いまま通さない）", () => {
    write("0.3.0", "0.3.0");
    changelog("0.3.0");
    tagged();
    expect(failsOf(releasePr)).toEqual(["直近のタグ"]);
  });
});
