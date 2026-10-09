// ラベルを付けるワークフロー（scripts/issue-label.ts）の判別のテスト。
// 決まった形だけを照合し、判別できないときはラベルを付けない（推測しない）ことを確かめる。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kindOf, labelsFor } from "../../plugin/scripts/issue-label.ts";
import { repoRoot } from "../helpers.ts";

describe("報告の種類のラベル", () => {
  it.each([
    ["報告の種類：不具合の報告（bug-report）\n\n### 起きたこと\n\nx", ["bug"]],
    ["報告の種類：改善の提案（improvement）", ["enhancement"]],
    [
      "報告の種類：Skill の追加の提案（skill-add）",
      ["enhancement", "skill-add"],
    ],
    [
      "報告の種類：Skill の削除・統合の提案（skill-remove）",
      ["enhancement", "skill-remove"],
    ],
  ])("先頭の種類の行から付ける：%s", (body, labels) => {
    expect(labelsFor(body)).toEqual(labels);
  });

  it("フォームから作った Issue は、見出しの並びから見分ける", () => {
    expect(kindOf("### 困っていること\n\nx\n\n### 提案\n\ny")).toBe(
      "improvement",
    );
    expect(
      kindOf(
        "### 起きたこと\n\nx\n\n### 期待した動き\n\ny\n\n### 再現の手順\n\nz",
      ),
    ).toBe("bug-report");
  });

  it("判別できなければラベルを付けない", () => {
    expect(labelsFor("何かが変です")).toEqual([]);
    expect(labelsFor("報告の種類：何か（security）")).toEqual([]);
    expect(labelsFor("### 起きたこと\n\nx")).toEqual([]);
  });

  it("本文に書かれたラベルの名前はそのまま使わない", () => {
    expect(
      labelsFor("報告の種類：不具合の報告（bug-report）\nlabel: wontfix"),
    ).toEqual(["bug"]);
  });

  it("ワークフローは本文を run: に埋め込まず、env で渡す", () => {
    const workflow = readFileSync(
      join(repoRoot, ".github", "workflows", "issue-label.yml"),
      "utf8",
    );
    const runLines = workflow
      .split("\n")
      .filter((line) => line.trim().startsWith("run:"));
    expect(runLines.join("\n")).not.toContain("github.event.issue");
    expect(workflow).toContain("ISSUE_BODY: ${{ github.event.issue.body }}");
  });
});
