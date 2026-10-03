// 進行役（run.ts）の判定。claude を呼ばない純粋な関数だけを置き、test/evals/ で検査する。

export type Step = {
  name: string;
  ask: string;
  answer: string;
  optional?: boolean;
};

/** 台本どおりに進まなかったこと（不合格）。進行役そのものの失敗とは分ける */
export class ScriptFailure extends Error {}

const matches = (step: Step, text: string): boolean =>
  new RegExp(step.ask).test(text);

/**
 * 応答のうち、最初に答えを求める行（質問）から最後までを取り出す。
 * 質問の前の前置き（「git リポジトリです」など）で、誤って先の項目に合わないようにする。質問の行が無ければ全文を返す
 */
const QUESTION_LINE = /[？?]|ください|ですか|ますか|でしょうか/;
export const questionText = (text: string): string => {
  const lines = text.split("\n");
  const first = lines.findIndex((line) => QUESTION_LINE.test(line));
  return first === -1 ? text : lines.slice(first).join("\n");
};

/**
 * 今のターンの質問が、台本のどの項目にあたるかを決める。
 * 次の必須の項目を優先する（間の任意の項目は、同じターンで軽く確かめるだけでもよい）。
 * 必須の項目に合わなければ間の任意の項目、それにも合わなければ今の項目のくり返し（事業ごとに聞く場合など）とみなす。
 * さらに先の必須の項目まで 1 ターンで聞いていたら不合格にする。
 */
export const nextStep = (
  steps: Step[],
  position: number,
  text: string,
): number => {
  let required = position + 1;
  while (steps[required]?.optional === true) required += 1;
  let found = -1;
  if (steps[required] !== undefined && matches(steps[required], text)) {
    found = required;
  } else {
    for (let index = position + 1; index < required; index += 1) {
      const step = steps[index];
      if (step !== undefined && matches(step, text)) {
        found = index;
        break;
      }
    }
  }
  if (found === -1) {
    const current = steps[position];
    if (current !== undefined && matches(current, text)) return position;
    const expected = steps[required]?.name ?? "（台本の終わり）";
    throw new ScriptFailure(
      `質問が台本の順番と合いません。期待した項目：${expected}`,
    );
  }
  const later = steps
    .slice(Math.max(found, required) + 1)
    .filter((step) => step.optional !== true && matches(step, text))
    .map((step) => step.name);
  if (later.length > 0) {
    throw new ScriptFailure(
      `1 ターンで複数の項目を聞いています：${steps[found]?.name ?? ""}、${later.join("、")}`,
    );
  }
  return found;
};

/** 台本のファイル名の `*`（/ を含まない任意の文字列）を正規表現にする */
export const globToRegExp = (glob: string): RegExp =>
  new RegExp(
    `^${glob
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^/]*")}$`,
  );
