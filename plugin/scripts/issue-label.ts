// Issue が作られたときに、報告の種類のラベルを付ける（.github/workflows/issue-label.yml が呼ぶ）。
// コネクタで作った Issue は、作った人に push の権限が無いとラベルが黙って捨てられ、フォームのラベルも付かないため（ADR 20261004-01）。
//
// 本文は誰でも書ける、信頼しない入力として扱う。決まった形の行と見出しだけを照合し、
// 照合した結果から決まったラベルの名前だけを付ける（本文に書かれたラベルの名前は使わない）。
// gh には引数の配列で渡し、シェルを通さない。
import { spawnSync } from "node:child_process";
import {
  kindFromLine,
  REPORT_FORMS,
  REPORT_KINDS,
  type ReportKind,
} from "./lib/report-forms.ts";

/** 本文から報告の種類を判別する。先頭の種類の行、無ければ見出しの並びから。判別できなければ undefined */
export const kindOf = (body: string): ReportKind | undefined => {
  const first = body.split("\n").find((line) => line.trim() !== "");
  const fromLine = first === undefined ? undefined : kindFromLine(first);
  if (fromLine !== undefined) return fromLine;
  const headings = new Set(
    body
      .split("\n")
      .filter((line) => line.startsWith("### "))
      .map((line) => line.slice(4).trim()),
  );
  // フォームから作った Issue は、各項目の label が「### 」の見出しになる。必須の最初の 2 項目の見出しで見分ける
  return REPORT_KINDS.find((kind) =>
    REPORT_FORMS[kind].fields.slice(0, 2).every((f) => headings.has(f.label)),
  );
};

export const labelsFor = (body: string): string[] => {
  const kind = kindOf(body);
  return kind === undefined ? [] : REPORT_FORMS[kind].labels;
};

const main = (): number => {
  const number = process.env["ISSUE_NUMBER"] ?? "";
  const repository = process.env["REPOSITORY"] ?? "";
  if (!/^\d+$/.test(number) || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    process.stderr.write("ISSUE_NUMBER か REPOSITORY がありません\n");
    return 2;
  }
  const labels = labelsFor(process.env["ISSUE_BODY"] ?? "");
  if (labels.length === 0) {
    process.stdout.write(
      `#${number}：報告の種類を判別できないため、ラベルを付けません\n`,
    );
    return 0;
  }
  const result = spawnSync(
    "gh",
    [
      "issue",
      "edit",
      number,
      "--repo",
      repository,
      "--add-label",
      labels.join(","),
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(
      `#${number}：ラベル（${labels.join(", ")}）を付けられませんでした：${result.stderr.trim()}\n`,
    );
    return 1;
  }
  process.stdout.write(
    `#${number}：ラベル（${labels.join(", ")}）を付けました\n`,
  );
  return 0;
};

// テストから読み込んだときは動かさない
if (process.argv[1]?.endsWith("issue-label.ts") === true) {
  process.exitCode = main();
}
