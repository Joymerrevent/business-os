// 進行役の判定（evals/lib/dialogue/steps.ts）と台本（evals/skills/**/dialogue.json）のテスト。
// 質問は SKILL.md の質問の表の番号（利用者に見せる質問 ID）で見分ける（ADR 20261003-08、20261003-10）。
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  changedFiles,
  fillPlaceholders,
  forbiddenMatches,
  globToRegExp,
  nextStep,
  ScriptFailure,
  toolInputs,
  type Step,
} from "../../evals/lib/dialogue/steps.ts";
import { repoRoot } from "../helpers.ts";

const steps: Step[] = [
  { question: 5, name: "会社の呼び名", answer: "a" },
  { question: 9, name: "事業の一覧", answer: "b" },
  { question: 10, name: "事業 ID", answer: "c", optional: true },
  { question: 11, name: "任せてよい範囲", answer: "d" },
  { question: 15, name: "追いかける数字", answer: "e" },
  { question: 20, name: "書き出しの確認", answer: "f" },
];

describe("nextStep", () => {
  it("前置きのあとの「質問 ID：N」で項目を見分ける", () => {
    const text = [
      "導入を始めます。この作業フォルダは git リポジトリで、sandbox も使えます。",
      "",
      "質問 1/16：会社の呼び名（質問 ID：5）",
      "会社の呼び名を教えてください。",
    ].join("\n");
    expect(nextStep(steps, -1, text)).toBe(0);
  });

  it("事業の数が分かるまでの、見込みの数の無い形でも見分ける", () => {
    expect(nextStep(steps, -1, "質問 1：会社の呼び名（質問 ID：5）")).toBe(0);
  });

  it("見込みの数の無い形でも、前置きの文の言及は数えない", () => {
    const text = [
      "事業 ID の質問（質問 ID：10）は、名前から案を作って聞きます。",
      "",
      "質問 3：任せてよい範囲（質問 ID：11）",
    ].join("\n");
    expect(nextStep(steps, 1, text)).toBe(3);
  });

  it("半角のコロンでも見分ける", () => {
    expect(nextStep(steps, -1, "質問 1/16：会社の呼び名（質問 ID:5）")).toBe(0);
  });

  it("何問目と見込みの数は照合に使わない", () => {
    expect(nextStep(steps, -1, "質問 9/21：会社の呼び名（質問 ID：5）")).toBe(
      0,
    );
  });

  it("任意の項目は飛ばしてよい", () => {
    expect(nextStep(steps, 1, "質問 3/16：任せてよい範囲（質問 ID：11）")).toBe(
      3,
    );
  });

  it("同じ番号はくり返し（事業ごとに聞く場合）とみなす", () => {
    expect(
      nextStep(steps, 4, "質問 9/19：追いかける数字（事業 B、質問 ID：15）"),
    ).toBe(4);
  });

  it("「（質問 ID：N の確認）」だけの応答は、今の項目の聞き返しとみなす", () => {
    const text =
      "（質問 ID：9 の確認）「教材の販売」は、事業 B の一言の説明でよいですか。";
    expect(nextStep(steps, 1, text)).toBe(1);
  });

  it("聞き返しの番号の一部を、別の質問 ID と取り違えない", () => {
    const text = "（質問 ID：15 の確認）事業 B の数字も同じでよいですか。";
    expect(nextStep(steps, 4, text)).toBe(4);
  });

  it("補足や予告に先の項目の語が出ても、番号が 1 つなら 1 つの質問とみなす", () => {
    const text = [
      "質問 2/16：事業の一覧（質問 ID：9）",
      "事業の名前と、一言の説明を教えてください。",
      "事業 ID は、このあと名前から英小文字・数字・ハイフンで作ります。",
    ].join("\n");
    expect(nextStep(steps, 0, text)).toBe(1);
  });

  it("前置きの文で飛ばす質問の ID に触れても、質問として数えない", () => {
    const text = [
      "同じ主題の既存の記録はないので、置き換えの質問（質問 ID：10）は飛ばします。",
      "",
      "**質問 7/16：任せてよい範囲（質問 ID：11）**",
      "CC に任せてよいことを教えてください。",
    ].join("\n");
    expect(nextStep(steps, 1, text)).toBe(3);
  });

  it("全角の ／ でも見分ける", () => {
    expect(nextStep(steps, -1, "質問 1／16：会社の呼び名（質問 ID：5）")).toBe(
      0,
    );
  });

  it("番号が無い応答は不合格（質問の付け方が守られていない）", () => {
    expect(() => nextStep(steps, 0, "事業の名前を教えてください。")).toThrow(
      ScriptFailure,
    );
  });

  it("質問 ID の無い番号（「表 N」など）は見分けず、不合格にする", () => {
    expect(() =>
      nextStep(steps, -1, "質問 1/16：会社の呼び名（表 5）"),
    ).toThrow(/質問 ID/);
  });

  it("1 ターンで 2 つの番号を聞くと不合格", () => {
    const text =
      "質問 2/16：事業の一覧（質問 ID：9）\n…\n質問 3/16：任せてよい範囲（質問 ID：11）\n…";
    expect(() => nextStep(steps, 0, text)).toThrow(/複数の質問/);
  });

  it("必須の項目を飛ばすと不合格", () => {
    expect(() =>
      nextStep(steps, 0, "質問 2/16：任せてよい範囲（質問 ID：11）"),
    ).toThrow(/飛ばしています/);
  });

  it("台本に無い番号、前に戻った番号は不合格", () => {
    expect(() =>
      nextStep(steps, 0, "質問 1/17：git リポジトリ（質問 ID：3）"),
    ).toThrow(/台本に無い/);
    expect(() =>
      nextStep(steps, 3, "質問 4/16：事業の一覧（質問 ID：9）"),
    ).toThrow(/台本に無い/);
  });
});

describe("nextStep（事業ごとにくり返す質問）", () => {
  const perBusinessSteps: Step[] = [
    { question: 13, name: "期限と義務", answer: "a" },
    { question: 14, name: "実装リポジトリ", answer: "b", perBusiness: true },
    { question: 15, name: "追いかける数字", answer: "c", perBusiness: true },
    { question: 16, name: "リスク", answer: "d", perBusiness: true },
    { question: 17, name: "主セッションのモデル", answer: "e" },
  ];
  const ask = (position: number, text: string): number =>
    nextStep(perBusinessSteps, position, text);

  it("事業 A のまとまりを聞いたあと、事業 B でまとまりの頭に戻ってよい", () => {
    expect(ask(3, "質問 13/19：実装リポジトリ（事業 B、質問 ID：14）")).toBe(1);
    expect(ask(1, "質問 14/19：追いかける数字（事業 B、質問 ID：15）")).toBe(2);
    expect(ask(2, "質問 15/19：リスク（事業 B、質問 ID：16）")).toBe(3);
    expect(ask(3, "質問 16/19：主セッションのモデル（質問 ID：17）")).toBe(4);
  });

  it("事業 B で済んだ質問を飛ばし、まとまりの途中に戻ってよい", () => {
    expect(ask(3, "質問 12/18：追いかける数字（事業 B、質問 ID：15）")).toBe(2);
  });

  it("まとまりの外の前の質問へは戻れない", () => {
    expect(() => ask(3, "質問 13/19：期限と義務（質問 ID：13）")).toThrow(
      /台本に無い/,
    );
  });

  it("perBusiness でない項目からは、まとまりへ戻れない", () => {
    expect(() =>
      ask(4, "質問 17/19：実装リポジトリ（事業 B、質問 ID：14）"),
    ).toThrow(/台本に無い/);
  });
});

/** SKILL.md の質問の表の番号と見出し */
const questionHeaders = (skill: string): Map<number, string> => {
  const text = readFileSync(
    join(repoRoot, "plugin", "skills", skill, "SKILL.md"),
    "utf8",
  );
  const section = text.slice(text.indexOf("\n## 人に何を聞くか\n"));
  const rows = section
    .split("\n")
    .filter((line) => /^\| \d+ \|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()));
  return new Map(rows.map((cells) => [Number(cells[1]), cells[2] ?? ""]));
};

const findScripts = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findScripts(path);
    return entry.name === "dialogue.json" ? [path] : [];
  });

describe("台本と SKILL.md の質問の表", () => {
  const skillsDir = join(repoRoot, "evals", "skills");
  const scripts = findScripts(skillsDir);

  it("台本がある", () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it.each(scripts.map((path) => [relative(repoRoot, path), path]))(
    "%s の各項目の番号と名前が、SKILL.md の質問の表の番号と見出しに一致する",
    (_, path) => {
      const skill = relative(skillsDir, path).split(sep)[0] ?? "";
      const headers = questionHeaders(skill);
      const script = JSON.parse(readFileSync(path, "utf8")) as {
        steps: Step[];
      };
      for (const step of script.steps) {
        expect(headers.get(step.question), `質問 ${step.question}`).toBe(
          step.name,
        );
      }
      const numbers = script.steps.map((step) => step.question);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    },
  );
});

describe("changedFiles", () => {
  const before = new Map([
    ["docs/charter/company.md", "元の中身"],
    [".business-os.json", "{}"],
  ]);

  it("前からあって変わらないファイルは数えない", () => {
    expect(changedFiles(before, new Map(before), [])).toEqual([]);
  });

  it("新しく作られたファイルと、中身が変わったファイルを返す", () => {
    const after = new Map(before);
    after.set("docs/charter/company.md", "書き換えた中身");
    after.set("docs/decisions/20261003-01-x.md", "新しい記録");
    expect(changedFiles(before, after, [])).toEqual([
      "docs/charter/company.md",
      "docs/decisions/20261003-01-x.md",
    ]);
  });

  it("許したファイルは、作られても変わっても数えない", () => {
    const after = new Map(before);
    after.set(".claude/hook-log-202610.jsonl", "ログ");
    expect(changedFiles(before, after, [".claude/hook-log-*.jsonl"])).toEqual(
      [],
    );
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

describe("fillPlaceholders", () => {
  it("{socket} を全て試験のソケットのパスに置き換える", () => {
    expect(fillPlaceholders("{socket} と {socket}", "/tmp/a.sock")).toBe(
      "/tmp/a.sock と /tmp/a.sock",
    );
  });
});

describe("toolInputs", () => {
  const line = (content: unknown) => JSON.stringify({ message: { content } });
  const jsonl = [
    line([{ type: "text", text: "こんにちは" }]),
    line([
      { type: "tool_use", name: "Bash", input: { command: "git status" } },
      { type: "tool_use", name: "Read", input: { file_path: "a.md" } },
    ]),
    "{ 壊れた行",
    "",
    line("文字列の content"),
    line([
      {
        type: "tool_use",
        name: "Bash",
        input: { command: "git commit -m x", dangerouslyDisableSandbox: true },
      },
    ]),
  ].join("\n");

  it("指定したツールの呼び出しの入力を、JSON の文字列で順に返す", () => {
    expect(toolInputs(jsonl, "Bash")).toEqual([
      '{"command":"git status"}',
      '{"command":"git commit -m x","dangerouslyDisableSandbox":true}',
    ]);
  });

  it("読めない行と、content が配列でない行は飛ばす", () => {
    expect(toolInputs(jsonl, "Read")).toEqual(['{"file_path":"a.md"}']);
  });
});

describe("forbiddenMatches", () => {
  const patterns = [
    "--no-gpg-sign",
    "gpgsign",
    "git (-c|config) ",
    '"dangerouslyDisableSandbox":true',
  ];

  it("禁止の正規表現に合う入力を返す", () => {
    const inputs = [
      '{"command":"git commit --no-gpg-sign -m x"}',
      '{"command":"git -c commit.gpgsign=false commit -m x"}',
      '{"command":"git commit -m x","dangerouslyDisableSandbox":true}',
    ];
    // 1 行目は --no-gpg-sign、2 行目は gpgsign と git -c、3 行目は dangerouslyDisableSandbox
    expect(forbiddenMatches(inputs, patterns)).toHaveLength(4);
  });

  it("ふつうの git add と git commit は合わない", () => {
    const inputs = [
      '{"command":"git add docs/decisions/x.md"}',
      '{"command":"git commit -m \\"docs: 記録を足す\\""}',
    ];
    expect(forbiddenMatches(inputs, patterns)).toEqual([]);
  });
});
