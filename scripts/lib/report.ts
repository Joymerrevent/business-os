// 報告の下書き（/report）の部品。下書きの組み立て、事業データの検査、送る前の照合、Issue 作成の URL。
// 事業データが混ざったら下書きを作らず、承認の後に中身が変わったら送らない（安全側へ倒す。ADR 20261004-01）。
import { createHash } from "node:crypto";
import { LEAK_PATTERNS } from "./leak-patterns.ts";
import { kindLine, REPORT_FORMS, type ReportKind } from "./report-forms.ts";

export type ReportInput = {
  kind: ReportKind;
  title: string;
  fields: Record<string, string>;
};

export type Leak = { name: string; line: number };

/** URL の長さの上限（符号化した後）。ログインしていない状態で 6,500 文字まで受け付けた結果に、Cookie のぶんの余裕を見た値 */
export const URL_MAX_BYTES = 4000;

/** ホームのパスを ~ に置き換える（パスに利用者の名前が入るため） */
export const replaceHome = (text: string, home: string): string =>
  home.length > 1 ? text.split(home).join("~") : text;

/** 下書きの本文。先頭に種類の行、続けてフォームの項目の順に「### 見出し」と値 */
export const buildBody = (input: ReportInput): string => {
  const form = REPORT_FORMS[input.kind];
  const sections = form.fields
    .map((field) => ({ field, value: (input.fields[field.id] ?? "").trim() }))
    .filter(({ value }) => value !== "")
    .map(({ field, value }) => `### ${field.label}\n\n${value}`);
  return [kindLine(input.kind), "", ...sections.flatMap((s) => [s, ""])]
    .join("\n")
    .trimEnd();
};

/** 下書きのファイルの中身。1 行目が題、空行の後が本文 */
export const draftText = (title: string, body: string): string =>
  `# 題：${title}\n\n${body}\n`;

/** 下書きのファイルから題と本文を読む。形が崩れていれば undefined */
export const parseDraft = (
  text: string,
): { title: string; body: string } | undefined => {
  const [first, ...rest] = text.split("\n");
  const match = /^# 題：(.+)$/.exec(first ?? "");
  if (!match) return undefined;
  return { title: (match[1] ?? "").trim(), body: rest.join("\n").trim() };
};

export const sha256 = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

/** 事業データや個人の情報の混入を探す。見つかった型と行を返す（語そのものは返さない） */
export const findLeaks = (
  text: string,
  terms: string[],
  userName: string,
): Leak[] => {
  const leaks: Leak[] = [];
  const lineOf = (index: number): number =>
    text.slice(0, index).split("\n").length;
  for (const pattern of LEAK_PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      if (pattern.ignore?.(match[0]) === true) continue;
      leaks.push({ name: pattern.name, line: lineOf(match.index) });
    }
  }
  const lower = text.toLowerCase();
  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());
    if (index >= 0)
      leaks.push({ name: "固有名詞の辞書の語", line: lineOf(index) });
  }
  if (userName.length >= 2) {
    const index = lower.indexOf(userName.toLowerCase());
    if (index >= 0) leaks.push({ name: "利用者の名前", line: lineOf(index) });
  }
  return leaks;
};

/** 安全装置の不具合（/check の防衛の発火）を含むか。含むなら公開の Issue ではなく非公開の経路へ */
export const isSecurityReport = (text: string): boolean =>
  text.includes("防衛の発火");

/** Issue 作成の URL。長すぎる項目は入れず、入れなかった項目の id を返す（人がファイルから貼る） */
export const buildIssueUrl = (
  repo: string,
  input: ReportInput,
  maxBytes: number = URL_MAX_BYTES,
): { url: string; omitted: string[] } => {
  const form = REPORT_FORMS[input.kind];
  const included = form.fields.filter(
    (field) => field.prefill && (input.fields[field.id] ?? "").trim() !== "",
  );
  const omitted = form.fields
    .filter((field) => !field.prefill && (input.fields[field.id] ?? "") !== "")
    .map((field) => field.id);
  const make = (): string => {
    const params = new URLSearchParams({
      template: `${input.kind}.yml`,
      title: input.title,
    });
    for (const field of included)
      params.set(field.id, (input.fields[field.id] ?? "").trim());
    return `https://github.com/${repo}/issues/new?${params.toString()}`;
  };
  let url = make();
  while (Buffer.byteLength(url, "utf8") > maxBytes && included.length > 0) {
    // いちばん長い項目から URL の外に出す
    included.sort(
      (a, b) =>
        (input.fields[b.id] ?? "").length - (input.fields[a.id] ?? "").length,
    );
    const removed = included.shift();
    if (removed !== undefined) omitted.push(removed.id);
    url = make();
  }
  return { url, omitted };
};

/** 雛形と違う設定のキーの名前（値は返さない）。model は利用者が選ぶので除く */
export const differingKeys = (
  actual: unknown,
  template: unknown,
  prefix = "",
): string[] => {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObject(actual) || !isObject(template)) {
    return JSON.stringify(actual) === JSON.stringify(template)
      ? []
      : [prefix || "(全体)"];
  }
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(template)])];
  return keys
    .filter((key) => !(prefix === "" && (key === "model" || key === "$schema")))
    .flatMap((key) =>
      differingKeys(
        actual[key],
        template[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    );
};
