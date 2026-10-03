// 進行役（run.ts）の判定。claude を呼ばない純粋な関数だけを置き、test/evals/ で検査する。

export type Step = {
  /** SKILL.md の質問の表の番号。利用者には質問 ID として見せる（ADR 20261003-08、20261003-10） */
  question: number;
  /** 記録とエラーの文に使う名前（質問の表の見出しと同じにする） */
  name: string;
  answer: string;
  /** 同じ質問を聞き返されたときの答え。無ければ answer をくり返す */
  clarify?: string;
  /** 条件によって聞かれない質問（例：既存の記録があるときだけの置き換えの質問） */
  optional?: boolean;
  /**
   * 事業ごとにくり返す質問。続けて並んだ perBusiness の項目は 1 つのまとまりで、
   * 1 つの事業についてまとまりを聞いてから、次の事業でまとまりの前の項目へ戻ってよい
   */
  perBusiness?: boolean;
};

/** 台本どおりに進まなかったこと（不合格）。進行役そのものの失敗とは分ける */
export class ScriptFailure extends Error {}

/**
 * 質問の先頭の「質問 <何問目>/<見込みの数>：<見出し>（質問 ID：<番号>）」（共通規約の質問の付け方）の質問 ID。
 * 全角・半角の ／ とコロンを受け付ける。
 * 何問目と見込みの数は、質問の先頭の行を見分ける目印にだけ使い、値は照合に使わない。
 * 前置きの文の「（質問 ID：2）は飛ばします」のような言及は、同じ行に何問目が無いので数えない
 */
const QUESTION_MARK =
  /質問\s*\d+\s*[/／]\s*\d+\s*[:：][^\n]*?質問\s*ID\s*[:：]\s*(\d+)/g;
/** 「（質問 ID：<番号> の確認）」（聞き返しの付け方） */
const CLARIFY_MARK = /質問\s*ID\s*[:：]\s*(\d+)\s*の確認/g;

const numbersOf = (pattern: RegExp, text: string): number[] => [
  ...new Set([...text.matchAll(pattern)].map((match) => Number(match[1]))),
];

/**
 * 今のターンの応答が、台本のどの項目にあたるかを、応答に付いた質問の番号で決める。
 * - 「質問 ID：N」が 1 つ：番号が N の項目。今の項目と同じ番号なら、くり返し（事業ごとに聞く場合など）
 * - 「（質問 ID：N の確認）」だけ：今の項目の聞き返し
 * - 今の項目が perBusiness で、N が同じまとまりの前の項目：次の事業についてのくり返し
 * - 番号が無い、2 つ以上の番号を聞いた、台本に無い番号、必須の項目を飛ばした：不合格
 */
export const nextStep = (
  steps: Step[],
  position: number,
  response: string,
): number => {
  const asked = numbersOf(QUESTION_MARK, response);
  const current = steps[position];
  if (asked.length === 0) {
    const clarified = numbersOf(CLARIFY_MARK, response);
    if (current !== undefined && clarified.includes(current.question)) {
      return position;
    }
    throw new ScriptFailure(
      "応答に質問 ID（「質問 ID：N」か「（質問 ID：N の確認）」）がありません",
    );
  }
  if (asked.length > 1) {
    throw new ScriptFailure(
      `1 ターンで複数の質問をしています：質問 ${asked.join("、")}`,
    );
  }
  const number = asked[0];
  if (current !== undefined && current.question === number) return position;
  if (current?.perBusiness === true) {
    let start = position;
    while (steps[start - 1]?.perBusiness === true) start -= 1;
    const back = steps.findIndex(
      (step, index) =>
        index >= start && index < position && step.question === number,
    );
    if (back !== -1) return back;
  }
  const found = steps.findIndex(
    (step, index) => index > position && step.question === number,
  );
  if (found === -1) {
    throw new ScriptFailure(
      `台本に無い質問、または前に戻った質問です：質問 ${String(number)}`,
    );
  }
  const skipped = steps
    .slice(position + 1, found)
    .filter((step) => step.optional !== true)
    .map((step) => `質問 ${step.question}（${step.name}）`);
  if (skipped.length > 0) {
    throw new ScriptFailure(`質問を飛ばしています：${skipped.join("、")}`);
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

/**
 * 作業場所の前後の中身（ファイル名 → 中身）を比べ、新しく作られた・変わったファイルのうち、許したもの以外を返す。
 * 許すものは台本の `allowedFilesAfterDecline`（`*` を使える）
 */
export const changedFiles = (
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
  allowedGlobs: readonly string[],
): string[] => {
  const allowed = allowedGlobs.map(globToRegExp);
  return [...after.keys()].filter(
    (file) =>
      before.get(file) !== after.get(file) &&
      !allowed.some((pattern) => pattern.test(file)),
  );
};
