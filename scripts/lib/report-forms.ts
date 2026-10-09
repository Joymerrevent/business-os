// business-os のリポジトリの Issue のフォーム（.github/ISSUE_TEMPLATE/）の項目。報告の下書き（scripts/report.ts）と、
// ラベルを付けるワークフロー（scripts/issue-label.ts）が使う。フォームの id と label と一致することを check:forms が確かめる。

export type ReportKind =
  "bug-report" | "improvement" | "skill-add" | "skill-remove";

export type FormField = {
  id: string;
  /** フォームの label。本文の見出し（### <label>）になる */
  label: string;
  /** URL で事前に入力できるか（input と textarea だけ。dropdown は入らない） */
  prefill: boolean;
};

export type ReportForm = {
  /** フォームの name。本文の先頭の種類の行に使う */
  name: string;
  /** Issue に付けるラベル */
  labels: string[];
  fields: FormField[];
};

const field = (id: string, label: string, prefill = true): FormField => ({
  id,
  label,
  prefill,
});

export const REPORT_FORMS: Record<ReportKind, ReportForm> = {
  "bug-report": {
    name: "不具合の報告",
    labels: ["bug"],
    fields: [
      field("what", "起きたこと"),
      field("expected", "期待した動き"),
      field("repro", "再現の手順"),
      field("check", "/check の結果（任意）"),
      field("plugin-version", "business-os のバージョン"),
      field("os", "OS"),
      field("run-mode", "Claude Code の動かし方"),
      field("claude-version", "Claude Code のバージョン"),
      field("node-version", "Node.js のバージョン"),
      field(
        "settings-diff",
        ".claude/settings.json が雛形と違うところ（任意）",
      ),
      field("local-settings", ".claude/settings.local.json の有無（任意）"),
    ],
  },
  improvement: {
    name: "改善の提案",
    labels: ["enhancement"],
    fields: [
      field("problem", "困っていること"),
      field("proposal", "提案"),
      field("alternatives", "考えたほかの方法（任意）"),
    ],
  },
  "skill-add": {
    name: "Skill の追加の提案",
    labels: ["enhancement", "skill-add"],
    fields: [
      field("work", "Skill にしたい作業"),
      field("category", "分類", false),
      field("why-new-skill", "今ある Skill に手順を足すのでは済まない理由"),
      field("existing-skills", "既製の Skill を探したか"),
      field("external-tools", "外部のツールに頼るか"),
      field("usage", "使う人と頻度の見込み（任意）"),
    ],
  },
  "skill-remove": {
    name: "Skill の削除・統合の提案",
    labels: ["enhancement", "skill-remove"],
    fields: [
      field("skill", "対象の Skill"),
      field("reason", "当てはまる理由", false),
      field("detail", "詳しく"),
      field("action", "望む扱い", false),
    ],
  },
};

export const REPORT_KINDS = Object.keys(REPORT_FORMS) as ReportKind[];

export const isReportKind = (value: string): value is ReportKind =>
  (REPORT_KINDS as string[]).includes(value);

/** 本文の先頭の種類の行。ラベルを付けるワークフローがこの行を読む */
export const kindLine = (kind: ReportKind): string =>
  `報告の種類：${REPORT_FORMS[kind].name}（${kind}）`;

/** 本文の先頭の行から報告の種類を読む。決まった形でなければ undefined */
export const kindFromLine = (line: string): ReportKind | undefined => {
  const match = /^報告の種類：.+（([a-z-]+)）$/.exec(line.trim());
  const kind = match?.[1];
  return kind !== undefined && isReportKind(kind) ? kind : undefined;
};
