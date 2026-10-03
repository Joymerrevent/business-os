// 進行役の判定（evals/lib/dialogue/steps.ts）のテスト。応答の例は、実際の /onboard の応答で誤判定した形を写したもの。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  globToRegExp,
  nextStep,
  questionText,
  ScriptFailure,
  type Step,
} from "../../evals/lib/dialogue/steps.ts";
import { repoRoot } from "../helpers.ts";

const steps = (
  JSON.parse(
    readFileSync(
      join(
        repoRoot,
        "evals",
        "skills",
        "onboard",
        "first-run",
        "dialogue.json",
      ),
      "utf8",
    ),
  ) as { steps: Step[] }
).steps;
const indexOf = (name: string) => steps.findIndex((s) => s.name === name);
const judge = (position: number, text: string) =>
  nextStep(steps, position, questionText(text));

describe("questionText と nextStep", () => {
  it("質問の前の前置き（git リポジトリ）で、先の項目（実装リポジトリ）に合わない", () => {
    const text = [
      "導入を始めます。この作業ディレクトリは git リポジトリで、macOS なので sandbox も使えます。",
      "",
      "**質問 1:会社の呼び名を教えてください。**あわせて、一行説明、目指すこと、優先順位が決まっていれば教えてください。",
    ].join("\n");
    expect(judge(-1, text)).toBe(0);
  });

  it("質問の中身が箇条書きの行にあっても項目に合う", () => {
    const text = [
      "**質問 1：会社について教えてください。**",
      "- 会社の呼び名",
      "- 一行説明",
    ].join("\n");
    expect(judge(-1, text)).toBe(0);
  });

  it("事業 ID の軽い確認と次の質問が同じターンでも、次の必須の項目に進む", () => {
    const text = [
      "事業 ID は `business-a` と `business-b` で進めます。変えたい場合はお知らせください。",
      "",
      "**質問 3：任せる範囲と承認が要る範囲**",
      "1. CC に任せてよい作業はどこまでですか。",
    ].join("\n");
    expect(judge(indexOf("事業の一覧"), text)).toBe(
      indexOf("任せてよい範囲と承認が要る範囲"),
    );
  });

  it("事業 ID の作り方の説明（英小文字・数字・ハイフン）を、追いかける数字の質問と取り違えない", () => {
    const text = [
      "**質問 2：運営している事業の一覧を教えてください。**",
      "事業 ID は、名前から私が英小文字・数字・ハイフンで作ります（例：`business-a`）。そのあと確認します。",
    ].join("\n");
    expect(
      judge(indexOf("会社の呼び名・一行説明・目指すこと・優先順位"), text),
    ).toBe(indexOf("事業の一覧"));
  });

  it("「〜ですか。」で終わる書き出しの確認を、書き出す前の確認と判定する", () => {
    const text = [
      "全社のリスク（支払いの見落とし）も書きません。入れたい場合は言ってください。",
      "",
      "この内容で書き出してよいですか。",
    ].join("\n");
    expect(judge(indexOf("Obsidian を使うか"), text)).toBe(
      indexOf("書き出す前の確認"),
    );
  });

  it("事業ごとに同じ項目をくり返し聞くのは、今の項目のくり返しとみなす", () => {
    const position = indexOf("追いかける数字");
    expect(judge(position, "事業 B で追いかける数字を選んでください。")).toBe(
      position,
    );
  });

  it("1 ターンで 2 つの必須の項目を聞くと不合格", () => {
    const text = "期限や義務と、各事業の実装リポジトリの場所を教えてください。";
    expect(() =>
      judge(indexOf("任せてよい範囲と承認が要る範囲"), text),
    ).toThrow(ScriptFailure);
  });

  it("項目を飛ばすと不合格", () => {
    expect(() =>
      judge(
        indexOf("会社の呼び名・一行説明・目指すこと・優先順位"),
        "リスクを選んでください。",
      ),
    ).toThrow(ScriptFailure);
  });
});

describe("globToRegExp", () => {
  it("* は / を含まない任意の文字列に合い、. はそのままの文字に合う", () => {
    const pattern = globToRegExp(".claude/hook-log-*.jsonl");
    expect(pattern.test(".claude/hook-log-202610.jsonl")).toBe(true);
    expect(pattern.test(".claude/settings.json")).toBe(false);
    expect(globToRegExp(".business-os.json").test("xbusiness-osxjson")).toBe(
      false,
    );
  });
});
