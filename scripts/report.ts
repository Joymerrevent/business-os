// /report が呼ぶ、報告の下書きの入口。事業データの検査に引っかかったら下書きを作らない（安全側へ倒す）。
//
// 使い方：
//   node scripts/report.ts draft --company <dir>   標準入力に {"kind","title","fields"} の JSON を渡す
//   node scripts/report.ts inspect --company <dir> --file <下書き>   人が直した下書きを検査し直し、新しい要約値を返す
//   node scripts/report.ts verify --company <dir> --file <下書き> --sha256 <要約値>
//
// 終了コード：0 成功、1 止めた（事業データの混入・辞書が無い・中身が変わった）、2 使い方の誤り、3 安全装置の不具合（非公開の経路へ）
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, release, tmpdir, userInfo } from "node:os";
import { basename, join, resolve } from "node:path";
import { pluginRoot } from "../hooks/lib/plugin.ts";
import { dictionaryTerms } from "./lib/leak-patterns.ts";
import {
  buildBody,
  buildIssueUrl,
  differingKeys,
  draftText,
  findLeaks,
  isSecurityReport,
  parseDraft,
  unescapeHeadings,
  replaceHome,
  sha256,
  type ReportInput,
} from "./lib/report.ts";
import { isReportKind, REPORT_FORMS } from "./lib/report-forms.ts";

const SECURITY_URL = (repo: string): string =>
  `https://github.com/${repo}/security/advisories/new`;

class Stop extends Error {
  readonly code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

/** 文字列ならそのまま、それ以外は代わりの文字列 */
const asText = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const option = (args: string[], name: string): string => {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (value === undefined || value.startsWith("--")) {
    throw new Stop(`${name} を指定してください`, 2);
  }
  return value;
};

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8")) as unknown;

/** business-os のリポジトリ（owner/repo）。plugin.json の repository から読む */
const repository = (): string => {
  const manifest = readJson(
    join(pluginRoot(), ".claude-plugin", "plugin.json"),
  ) as { repository?: unknown };
  const match = /github\.com\/([^/]+\/[^/#?]+)/.exec(
    asText(manifest.repository, ""),
  );
  if (!match?.[1]) throw new Stop("plugin.json に repository がありません", 2);
  return match[1].replace(/\.git$/, "");
};

/** 固有名詞の辞書。無い・読めない・語が 1 つも無いときは止める（検査できないまま下書きを作らない） */
const leakTerms = (company: string): string[] => {
  const path = join(company, ".leak-dict.json");
  if (!existsSync(path)) {
    throw new Stop(
      "固有名詞の辞書（.leak-dict.json）が無いため、事業データの検査ができません。/onboard を実行してから、もう一度試してください",
      1,
    );
  }
  let terms: string[];
  try {
    terms = dictionaryTerms(readJson(path));
  } catch {
    throw new Stop(
      "固有名詞の辞書（.leak-dict.json）を読めないため、事業データの検査ができません",
      1,
    );
  }
  if (terms.length === 0) {
    throw new Stop(
      "固有名詞の辞書（.leak-dict.json）に語が 1 つも無いため、事業データの検査ができません。会社の呼び名や事業名を辞書に足してから、もう一度試してください",
      1,
    );
  }
  return terms;
};

const userName = (): string => {
  try {
    return userInfo().username;
  } catch {
    return basename(homedir());
  }
};

const run = (command: string, args: string[]): string => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "不明";
};

/** 不具合の報告に足す、環境の情報と設定の差（値は写さず、キーの名前だけ） */
const environment = (company: string): Record<string, string> => {
  const plugin = readJson(
    join(pluginRoot(), ".claude-plugin", "plugin.json"),
  ) as { version?: unknown };
  let recorded = "不明";
  try {
    recorded = asText(
      (
        readJson(join(company, ".business-os.json")) as {
          pluginVersion?: unknown;
        }
      ).pluginVersion,
      "不明",
    );
  } catch {
    // 記録が読めなくても報告は続ける
  }
  let settingsDiff = "読めませんでした";
  try {
    const keys = differingKeys(
      readJson(join(company, ".claude", "settings.json")),
      readJson(join(pluginRoot(), "templates", "settings.json.tmpl")),
    );
    settingsDiff = keys.length === 0 ? "無し" : keys.join("\n");
  } catch {
    // 読めないことをそのまま書く
  }
  let localSettings = "無し";
  const localPath = join(company, ".claude", "settings.local.json");
  if (existsSync(localPath)) {
    try {
      const local = readJson(localPath) as { sandbox?: unknown };
      const sandboxKeys =
        typeof local.sandbox === "object" && local.sandbox !== null
          ? differingKeys(local.sandbox, {}, "sandbox")
          : [];
      localSettings =
        sandboxKeys.length === 0
          ? "有り（sandbox のキーは無し）"
          : `有り（${sandboxKeys.join(", ")}）`;
    } catch {
      localSettings = "有り（読めませんでした）";
    }
  }
  return {
    "plugin-version": `${asText(plugin.version, "不明")}（company の記録：${recorded}）`,
    os: `${process.platform} ${release()}`,
    "claude-version": run("claude", ["--version"]),
    "node-version": process.version,
    "settings-diff": settingsDiff,
    "local-settings": localSettings,
  };
};

const parseInput = (raw: string): ReportInput => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Stop("標準入力が JSON ではありません", 2);
  }
  const input = parsed as {
    kind?: unknown;
    title?: unknown;
    fields?: unknown;
  };
  const kind = asText(input.kind, "");
  if (!isReportKind(kind)) {
    throw new Stop(
      "kind は bug-report / improvement / skill-add / skill-remove のどれかにしてください",
      2,
    );
  }
  if (typeof input.title !== "string" || input.title.trim() === "") {
    throw new Stop("title を書いてください", 2);
  }
  const fields: Record<string, string> = {};
  if (typeof input.fields === "object" && input.fields !== null) {
    for (const [key, value] of Object.entries(input.fields)) {
      if (typeof value === "string") fields[key] = value;
    }
  }
  return { kind, title: input.title.trim(), fields };
};

const checkLeaks = (text: string, company: string): void => {
  const leaks = findLeaks(text, leakTerms(company), userName());
  if (leaks.length > 0) {
    throw new Stop(
      `事業データや個人の情報らしいものが見つかったため、下書きを作りません（送りません）：${leaks
        .map((leak) => `${leak.line} 行目の${leak.name}`)
        .join("、")}。置き換えてから、もう一度試してください`,
      1,
    );
  }
};

const draft = (args: string[]): string => {
  const company = resolve(option(args, "--company"));
  const input = parseInput(readFileSync(0, "utf8"));
  const repo = repository();
  if (input.kind === "bug-report") {
    input.fields = { ...environment(company), ...input.fields };
  }
  const home = homedir();
  input.title = replaceHome(input.title, home);
  for (const key of Object.keys(input.fields)) {
    input.fields[key] = replaceHome(input.fields[key] ?? "", home);
  }
  const text = draftText(input.title, buildBody(input));
  if (isSecurityReport(text)) {
    throw new Stop(
      `安全装置の不具合（防衛の発火）は、公開の Issue ではなく非公開の経路で報告してください：${SECURITY_URL(repo)}`,
      3,
    );
  }
  checkLeaks(text, company);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const file = join(
    tmpdir(),
    `business-os-report-${stamp}-${randomBytes(4).toString("hex")}.md`,
  );
  writeFileSync(file, text);
  return JSON.stringify({ file, sha256: sha256(text) });
};

/** 人が直した下書きを検査し直し、承認を取り直すための新しい要約値を返す */
const inspect = (args: string[]): string => {
  const company = resolve(option(args, "--company"));
  const file = resolve(option(args, "--file"));
  if (!existsSync(file)) throw new Stop("下書きのファイルがありません", 1);
  const text = readFileSync(file, "utf8");
  if (isSecurityReport(text)) {
    throw new Stop(
      `安全装置の不具合（防衛の発火）は、公開の Issue ではなく非公開の経路で報告してください：${SECURITY_URL(repository())}`,
      3,
    );
  }
  checkLeaks(text, company);
  if (parseDraft(text) === undefined) {
    throw new Stop(
      "下書きのファイルの形が崩れています（1 行目は「# 題：」）",
      1,
    );
  }
  return JSON.stringify({ file, sha256: sha256(text) });
};

const verify = (args: string[]): string => {
  const company = resolve(option(args, "--company"));
  const file = resolve(option(args, "--file"));
  const expected = option(args, "--sha256");
  if (!existsSync(file)) throw new Stop("下書きのファイルがありません", 1);
  const text = readFileSync(file, "utf8");
  if (sha256(text) !== expected) {
    throw new Stop(
      "下書きのファイルの中身が、確かめたときから変わっています。送りません。もう一度確かめてもらってください",
      1,
    );
  }
  const repo = repository();
  if (isSecurityReport(text)) {
    throw new Stop(
      `安全装置の不具合（防衛の発火）は、公開の Issue ではなく非公開の経路で報告してください：${SECURITY_URL(repo)}`,
      3,
    );
  }
  checkLeaks(text, company);
  const parsed = parseDraft(text);
  if (parsed === undefined) {
    throw new Stop(
      "下書きのファイルの形が崩れています（1 行目は「# 題：」）",
      1,
    );
  }
  const kindMatch = /（([a-z-]+)）$/.exec(parsed.body.split("\n")[0] ?? "");
  const kind = kindMatch?.[1] ?? "";
  if (!isReportKind(kind)) {
    throw new Stop("下書きの先頭に報告の種類の行がありません", 1);
  }
  const fields = sectionsOf(parsed.body, kind);
  const { url, omitted } = buildIssueUrl(repo, {
    kind,
    title: parsed.title,
    fields,
  });
  const [owner, name] = repo.split("/");
  return JSON.stringify({
    owner,
    repo: name,
    title: parsed.title,
    body: parsed.body,
    url,
    omitted,
  });
};

/** 本文の「### 見出し」から、フォームの項目の値を読み戻す（URL の事前入力に使う） */
const sectionsOf = (
  body: string,
  kind: ReportInput["kind"],
): Record<string, string> => {
  const fields: Record<string, string> = {};
  const chunks = body.split(/^### /m).slice(1);
  for (const chunk of chunks) {
    const [heading, ...rest] = chunk.split("\n");
    const label = (heading ?? "").trim();
    const id = reportFieldId(kind, label);
    if (id !== undefined) fields[id] = unescapeHeadings(rest.join("\n").trim());
  }
  return fields;
};

const reportFieldId = (
  kind: ReportInput["kind"],
  label: string,
): string | undefined =>
  REPORT_FORMS[kind].fields.find((field) => field.label === label)?.id;

const main = (): number => {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "draft") process.stdout.write(`${draft(args)}\n`);
    else if (command === "inspect") process.stdout.write(`${inspect(args)}\n`);
    else if (command === "verify") process.stdout.write(`${verify(args)}\n`);
    else
      throw new Stop(
        "使い方：node scripts/report.ts <draft | inspect | verify> ...",
        2,
      );
    return 0;
  } catch (error) {
    if (error instanceof Stop) {
      process.stderr.write(`business-os: ${error.message}\n`);
      return error.code;
    }
    process.stderr.write(
      `business-os: 報告の下書きが内部エラーで止まりました（下書きは作っていません）：${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
};

process.exitCode = main();
