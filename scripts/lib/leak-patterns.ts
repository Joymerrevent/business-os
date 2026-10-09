// 事業データや個人の情報が混ざっていないかを見る型。business-os の check:leak と、報告の下書き（scripts/report.ts）が使う。
// このファイルは型そのものを書くので、check:leak の検査の対象から外す（repo-checks.ts の LEAK_SKIP）。

const ALLOWED_EMAILS = new Set([
  "noreply@anthropic.com",
  "conduct@joymerrevent.com",
]);
const ALLOWED_HOSTS = [
  "github.com",
  "raw.githubusercontent.com",
  "joymerrevent.com",
  "claude.com",
  "code.claude.com",
  "docs.claude.com",
  "anthropic.com",
  "contributor-covenant.org",
  "conventionalcommits.org",
  "json.schemastore.org",
  "json-schema.org",
  "unpkg.com",
  "editorconfig.org",
  "localhost",
];
const hostAllowed = (host: string): boolean =>
  ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );

export type LeakPattern = {
  name: string;
  regex: RegExp;
  ignore?: (match: string) => boolean;
};

export const LEAK_PATTERNS: LeakPattern[] = [
  {
    name: "メールアドレス",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    ignore: (m) =>
      ALLOWED_EMAILS.has(m.toLowerCase()) ||
      m.endsWith("@users.noreply.github.com"),
  },
  {
    name: "電話番号",
    regex: /(?<![\d-])(?:\+81[- ]?|0)\d{1,4}-\d{1,4}-\d{3,4}(?![\d-])/g,
  },
  {
    name: "法人格",
    regex: /株式会社|有限会社|合同会社|一般社団法人|一般財団法人/g,
  },
  {
    name: "通貨付きの金額",
    regex: /[¥￥]\s?\d|\d[\d,.]*\s?円|\$\s?\d[\d,]{2,}/g,
  },
  {
    name: "許可リストに無いドメイン",
    regex: /https?:\/\/([A-Za-z0-9.-]+)/g,
    ignore: (m) => hostAllowed(m.replace(/^https?:\/\//, "").toLowerCase()),
  },
];

/** 固有名詞の辞書（.leak-dict.json の terms）から、検索に使う語を取り出す（2 文字未満の語は誤検出が多いので除く） */
export const dictionaryTerms = (dict: unknown): string[] => {
  const terms =
    typeof dict === "object" && dict !== null
      ? (dict as { terms?: unknown }).terms
      : undefined;
  return Array.isArray(terms)
    ? terms.filter(
        (t): t is string => typeof t === "string" && t.trim().length >= 2,
      )
    : [];
};
