// business-os 自身の検査。package.json の check:* から scripts/check-repo.ts 経由で呼ぶ。
// 検査の一覧の正典は package.json。この文書やほかの文書に一覧を書き写さない。
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseFrontmatter } from "../../hooks/lib/frontmatter.ts";
import {
  DISTRIBUTED_SKILLS,
  frontmatterSchema,
  pluginRoot,
} from "../../hooks/lib/plugin.ts";
import { validate } from "../../hooks/lib/schema.ts";
import { dictionaryTerms, LEAK_PATTERNS } from "./leak-patterns.ts";
import type { CheckResult, Level } from "./company-checks.ts";
import { compareVersions, manifestVersion, packageVersion } from "./version.ts";

const result = (
  category: string,
  name: string,
  level: Level,
  detail = "",
): CheckResult => ({ category, name, level, detail });

const rel = (root: string, path: string): string =>
  relative(root, path).split(sep).join("/");

const walk = (dir: string, predicate: (path: string) => boolean): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === ".git") return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, predicate);
    return predicate(path) ? [path] : [];
  });
};

/** git が追跡しているファイル（リポジトリのルートからの相対パス） */
const trackedFiles = (root: string): string[] => {
  const run = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error("git ls-files を実行できません");
  return run.stdout.split("\0").filter((f) => f !== "");
};

// ---- Skill ----

const SKILL_SECTIONS = [
  "## 何をするか",
  "## 何を読むか",
  "## 何を書くか",
  "## 人に何を聞くか",
  "## 完了条件",
];

/** 質問の表の列（ADR 20261003-08） */
const QUESTION_COLUMNS = [
  "番号",
  "見出し",
  "質問文",
  "答えの形",
  "選択肢",
  "聞くとき",
];
const ANSWER_FORMS = new Set(["自由記述", "選択肢（単一）", "選択肢（複数）"]);
/** 見出しの上限（AskUserQuestion の header の上限） */
const QUESTION_HEADER_MAX = 12;

const tableCells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

/** 「人に何を聞くか」の節の質問の表を確かめ、問題の一覧を返す */
export const questionTableProblems = (text: string): string[] => {
  const start = text.indexOf("\n## 人に何を聞くか\n");
  if (start < 0) return [];
  const rest = text.slice(start + 1);
  const next = rest.indexOf("\n## ", 1);
  const section = next < 0 ? rest : rest.slice(0, next);
  const lines = section.split("\n").filter((line) => line.startsWith("|"));
  const [head, , ...rows] = lines;
  if (head === undefined) return ["質問の表が無い"];
  if (tableCells(head).join(",") !== QUESTION_COLUMNS.join(",")) {
    return [`質問の表の列が「${QUESTION_COLUMNS.join("・")}」ではない`];
  }
  if (rows.length === 0) return ["質問の表に行が無い"];
  const problems: string[] = [];
  rows.forEach((row, index) => {
    const [number, header, question, form, choices] = tableCells(row);
    const label = `質問 ${number ?? "?"}`;
    if (number !== String(index + 1)) {
      problems.push(
        `${label}：番号が 1 からの連番でない（${index + 1} のはず）`,
      );
    }
    if (!header) problems.push(`${label}：見出しが無い`);
    else if (Array.from(header).length > QUESTION_HEADER_MAX) {
      problems.push(
        `${label}：見出し「${header}」が ${QUESTION_HEADER_MAX} 文字を超える`,
      );
    }
    if (!question) problems.push(`${label}：質問文が無い`);
    if (form === undefined || !ANSWER_FORMS.has(form)) {
      problems.push(`${label}：答えの形「${form ?? ""}」が決まった形でない`);
    } else if (form !== "自由記述" && (!choices || choices === "—")) {
      problems.push(`${label}：選択肢の質問なのに選択肢が無い`);
    }
  });
  return problems;
};

export const checkSkills = (root: string = pluginRoot()): CheckResult[] => {
  const category = "Skill";
  const results: CheckResult[] = [];
  const dirs = readdirSync(join(root, "skills")).filter((name) =>
    statSync(join(root, "skills", name)).isDirectory(),
  );
  const expected = new Set<string>(DISTRIBUTED_SKILLS);
  const extra = dirs.filter((name) => !expected.has(name));
  const missing = DISTRIBUTED_SKILLS.filter((name) => !dirs.includes(name));
  if (extra.length > 0 || missing.length > 0) {
    results.push(
      result(
        category,
        "skills/ が配布する Skill の一覧（hooks/lib/plugin.ts）と一致する",
        "fail",
        [
          missing.length > 0 ? `無い：${missing.join(", ")}` : "",
          extra.length > 0
            ? `一覧に無い（足すなら ADR で決め、一覧に足す）：${extra.join(", ")}`
            : "",
        ]
          .filter((s) => s !== "")
          .join("、"),
      ),
    );
  }
  for (const name of DISTRIBUTED_SKILLS) {
    const path = join(root, "skills", name, "SKILL.md");
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    const problems: string[] = [];
    const fm = parseFrontmatter(text);
    if (fm === undefined) problems.push("フロントマターが無い");
    else {
      if (fm.data["name"] !== name)
        problems.push(`name（${fm.data["name"] ?? "なし"}）がフォルダ名と違う`);
      if (!fm.data["description"]) problems.push("description が無い");
      if (fm.data["disable-model-invocation"] !== "true")
        problems.push("disable-model-invocation: true が無い");
    }
    let last = -1;
    for (const section of SKILL_SECTIONS) {
      const index = text.indexOf(`\n${section}\n`);
      if (index < 0) problems.push(`「${section.slice(3)}」の節が無い`);
      else if (index < last)
        problems.push(`「${section.slice(3)}」の節の順番が違う`);
      else last = index;
    }
    problems.push(...questionTableProblems(text));
    results.push(
      problems.length === 0
        ? result(category, `skills/${name}`, "pass")
        : result(category, `skills/${name}`, "fail", problems.join("、")),
    );
  }
  return results;
};

// ---- hook ----

export const checkHooks = (root: string = pluginRoot()): CheckResult[] => {
  const category = "hook";
  const text = readFileSync(join(root, "hooks", "hooks.json"), "utf8");
  const config = JSON.parse(text) as {
    hooks?: Record<
      string,
      { matcher?: string; hooks?: { command?: string }[] }[]
    >;
  };
  const results: CheckResult[] = [];
  const commands = Object.values(config.hooks ?? {}).flatMap((groups) =>
    groups.flatMap((group) =>
      (group.hooks ?? []).map((hook) => hook.command ?? ""),
    ),
  );
  for (const command of commands) {
    const match = /"\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)"/.exec(command);
    if (match === null) {
      results.push(
        result(
          category,
          command,
          "fail",
          'パスを "${CLAUDE_PLUGIN_ROOT}/…" の形（二重引用符つき）で書いていません',
        ),
      );
      continue;
    }
    const script = match[1] ?? "";
    results.push(
      existsSync(join(root, script))
        ? result(category, script, "pass")
        : result(
            category,
            script,
            "fail",
            "hooks.json が指すスクリプトがありません",
          ),
    );
  }
  const matcher = (config.hooks?.["PreToolUse"] ?? [])
    .map((group) => group.matcher ?? "")
    .join("|");
  const tools = matcher.split("|");
  const missingTools = [
    "Write",
    "Edit",
    "Bash",
    "PowerShell",
    "mcp__.*",
  ].filter((tool) => !tools.includes(tool));
  results.push(
    missingTools.length === 0
      ? result(category, "PreToolUse の対象ツール", "pass")
      : result(
          category,
          "PreToolUse の対象ツール",
          "fail",
          `matcher に無い：${missingTools.join(", ")}`,
        ),
  );
  if (!config.hooks?.["SessionStart"]) {
    results.push(
      result(
        category,
        "SessionStart",
        "fail",
        "軽い点検の hook が登録されていません",
      ),
    );
  }
  return results;
};

// ---- Plugin ----

export const checkPlugin = (root: string = pluginRoot()): CheckResult[] => {
  const category = "Plugin";
  return [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"].map(
    (file) => {
      const run = spawnSync(
        "claude",
        ["plugin", "validate", join(root, file)],
        {
          encoding: "utf8",
          shell: process.platform === "win32",
        },
      );
      if (run.error !== undefined) {
        return result(
          category,
          file,
          "warn",
          "claude コマンドがありません（CI は @anthropic-ai/claude-code を入れて実行します）",
        );
      }
      const output = `${run.stdout}${run.stderr}`.trim();
      if (run.status === 0) return result(category, file, "pass");
      if (/log ?in|auth|credential|api key/i.test(output)) {
        return result(
          category,
          file,
          "warn",
          `認証が必要で実行できませんでした：${output.split("\n").slice(-1)[0] ?? ""}`,
        );
      }
      return result(
        category,
        file,
        "fail",
        output.split("\n").slice(-3).join(" "),
      );
    },
  );
};

// ---- 雛形 ----

const VARIABLE = /\{\{ ([a-z_]+) \}\}/g;

/** 変数の名前から、スキーマに合う見本の値を決める */
const sampleValue = (name: string): string => {
  if (
    /(^|_)(date|at|today|as_of|due|start|end)$/.test(name) ||
    name === "as_of"
  )
    return "2026-01-01";
  if (name === "business_id") return "biz-a";
  if (name === "business") return "portfolio";
  if (name === "proposal_id" || name === "decision_id") return "20260101-01";
  if (name === "target") return "docs/charter/company.md";
  if (name === "plugin_version") return "0.1.0";
  return "見本";
};

export const checkTemplates = (root: string = pluginRoot()): CheckResult[] => {
  const category = "雛形";
  const results: CheckResult[] = [];
  const dir = join(root, "templates");
  const readme = readFileSync(join(dir, "README.md"), "utf8");
  const documented = new Set(
    [...readme.matchAll(/`([a-z_]+)`/g)].map((m) => m[1] ?? ""),
  );
  const schema = frontmatterSchema();
  // 雛形の説明（templates/README.md）だけを外す。下のフォルダの README.md は書き出す雛形なので検査する
  const files = walk(
    dir,
    (path) =>
      path !== join(dir, "README.md") &&
      !path.endsWith("skill-conventions.md") &&
      !path.endsWith(".schema.json"),
  );
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const problems: string[] = [];
    const variables = [...text.matchAll(VARIABLE)].map((m) => m[1] ?? "");
    const undocumented = [
      ...new Set(variables.filter((v) => !documented.has(v))),
    ];
    if (undocumented.length > 0)
      problems.push(
        `templates/README.md に無い変数：${undocumented.join(", ")}`,
      );
    const filled = text.replace(VARIABLE, (_, name: string) =>
      sampleValue(name),
    );
    if (filled.includes("{{") || filled.includes("}}"))
      problems.push("変数の書き方が {{ snake_case }} になっていない箇所がある");
    if (file.endsWith(".json") || file.endsWith(".json.tmpl")) {
      try {
        JSON.parse(filled);
      } catch (error) {
        problems.push(
          `見本の値を入れると JSON として読めない：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (file.endsWith(".md")) {
      const fm = parseFrontmatter(filled);
      if (fm === undefined) problems.push("フロントマターが無い");
      else {
        const errors = [...new Set(validate(schema, schema, fm.data))];
        if (errors.length > 0)
          problems.push(
            `見本の値を入れるとスキーマに合わない：${errors.join("、")}`,
          );
      }
    }
    results.push(
      problems.length === 0
        ? result(category, rel(root, file), "pass")
        : result(category, rel(root, file), "fail", problems.join("、")),
    );
  }
  return results;
};

// ---- 漏洩 ----

/** 検査の対象外（生成物・ロックファイル・この検査の定義そのもの） */
const LEAK_SKIP = [
  /^pnpm-lock\.yaml$/,
  /^CHANGELOG\.md$/,
  /^\.changeset\//,
  /^scripts\/lib\/repo-checks\.ts$/,
  /^scripts\/lib\/leak-patterns\.ts$/,
  /^test\//,
  /^fixtures\//,
  /^evals\/skills\/.+\/overlay\//,
];

export const checkLeak = (root: string = pluginRoot()): CheckResult[] => {
  const category = "漏洩";
  const results: CheckResult[] = [];
  const files = trackedFiles(root).filter(
    (file) => !LEAK_SKIP.some((skip) => skip.test(file)),
  );
  const texts = files.flatMap((file) => {
    const path = join(root, file);
    if (!existsSync(path)) return [];
    const text = readFileSync(path, "utf8");
    return text.includes("\0") ? [] : [{ file, text }];
  });

  // 1. gitleaks（履歴を含む）
  const leaks = spawnSync(
    "gitleaks",
    ["git", "--no-banner", "--redact", "--exit-code", "1"],
    { cwd: root, encoding: "utf8" },
  );
  if (leaks.error !== undefined)
    results.push(
      result(
        category,
        "gitleaks",
        "warn",
        "gitleaks がありません（macOS は brew install gitleaks）",
      ),
    );
  else if (leaks.status === 0)
    results.push(result(category, "gitleaks", "pass"));
  else if (leaks.status === 1)
    results.push(
      result(
        category,
        "gitleaks",
        "fail",
        "秘密らしき文字列があります。gitleaks git を手で実行して確かめてください",
      ),
    );
  else
    results.push(
      result(
        category,
        "gitleaks",
        "fail",
        `gitleaks を実行できませんでした：${leaks.stderr.trim().split("\n").slice(-1)[0] ?? ""}`,
      ),
    );

  // 2. 固有名詞の辞書（手元のみ。company の /onboard が .leak-dict.json を書く）
  const dictPath = process.env["BUSINESS_OS_LEAK_DICT"];
  if (dictPath === undefined || dictPath === "") {
    results.push(
      result(
        category,
        "固有名詞の辞書",
        "pass",
        "BUSINESS_OS_LEAK_DICT が未設定のため辞書の検索はしていません",
      ),
    );
  } else {
    const terms = dictionaryTerms(
      JSON.parse(readFileSync(resolve(dictPath), "utf8")) as unknown,
    );
    const hits: string[] = [];
    for (const { file, text } of texts) {
      const lower = text.toLowerCase();
      for (const term of terms) {
        if (lower.includes(term.toLowerCase()))
          hits.push(`${file}（${term.length} 文字の語）`);
      }
    }
    results.push(
      hits.length === 0
        ? result(category, "固有名詞の辞書", "pass", `${terms.length} 語を検索`)
        : result(
            category,
            "固有名詞の辞書",
            "fail",
            `辞書の語が見つかりました：${[...new Set(hits)].join(", ")}`,
          ),
    );
  }

  // 3. 汎用のパターン（warn）
  for (const pattern of LEAK_PATTERNS) {
    const found: string[] = [];
    for (const { file, text } of texts) {
      for (const match of text.matchAll(pattern.regex)) {
        if (pattern.ignore?.(match[0]) === true) continue;
        const line = text.slice(0, match.index).split("\n").length;
        found.push(`${file}:${line}`);
      }
    }
    results.push(
      found.length === 0
        ? result(category, pattern.name, "pass")
        : result(
            category,
            pattern.name,
            "warn",
            `${found.length} 件（${found.slice(0, 5).join(", ")}${found.length > 5 ? " ほか" : ""}）。事業情報でないか確かめてください`,
          ),
    );
  }
  return results;
};

// ---- 文書（フロントマターとリンク） ----

export const checkDocs = (root: string = pluginRoot()): CheckResult[] => {
  const results: CheckResult[] = [];
  const schema = frontmatterSchema();
  // フロントマターを持つのは ADR と構造仕様だけ（利用者向けの docs/usage/ と入口の docs/README.md は持たない）
  const withFrontmatter = [
    ...walk(join(root, "docs", "adr"), (path) => path.endsWith(".md")),
    ...walk(join(root, "docs", "design"), (path) => path.endsWith(".md")),
  ];
  for (const file of withFrontmatter) {
    const path = rel(root, file);
    const problems: string[] = [];
    const fm = parseFrontmatter(readFileSync(file, "utf8"));
    if (fm === undefined) problems.push("フロントマターがありません");
    else {
      problems.push(...new Set(validate(schema, schema, fm.data)));
      const { created, updated, id } = fm.data;
      if (created !== undefined && updated !== undefined && updated < created)
        problems.push("updated が created より前です");
      const name = path.split("/").pop() ?? "";
      if (
        path.startsWith("docs/adr/2") &&
        (id === undefined || !name.startsWith(`${id}-`))
      ) {
        problems.push(`id（${id ?? "なし"}）がファイル名の先頭と一致しません`);
      }
    }
    results.push(
      problems.length === 0
        ? result("文書", path, "pass")
        : result("文書", path, "fail", problems.join("、")),
    );
  }
  const broken: string[] = [];
  const markdown = trackedFiles(root).filter(
    (file) =>
      file.endsWith(".md") && !/^(CHANGELOG\.md|\.changeset\/)/.test(file),
  );
  for (const file of markdown) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`\n]*`/g, "");
    for (const match of text.matchAll(
      /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    )) {
      const target = match[1] ?? "";
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#"))
        continue;
      const linkPath = decodeURIComponent(target.split("#")[0] ?? "");
      if (linkPath !== "" && !existsSync(resolve(dirname(path), linkPath)))
        broken.push(`${file} → ${target}`);
    }
  }
  results.push(
    broken.length === 0
      ? result("文書", "相対リンク", "pass", `${markdown.length} 本`)
      : result(
          "文書",
          "相対リンク",
          "fail",
          `リンク先がありません：${broken.join(", ")}`,
        ),
  );
  return results;
};

// ---- ADR の一覧 ----

type AdrEntry = { id: string; title: string; status: string };

const adrFiles = (root: string): AdrEntry[] =>
  walk(join(root, "docs", "adr"), (path) =>
    /[\\/]\d{8}-\d{2}-[^\\/]+\.md$/.test(path),
  ).map((file) => {
    const fm = parseFrontmatter(readFileSync(file, "utf8"));
    return {
      id: fm?.data["id"] ?? "",
      title: fm?.data["title"] ?? "",
      status: fm?.data["status"] ?? "",
    };
  });

export const checkAdrIndex = (root: string = pluginRoot()): CheckResult[] => {
  const category = "ADR";
  const readme = readFileSync(join(root, "docs", "adr", "README.md"), "utf8");
  const section = readme.split(/\n## 一覧\n/)[1] ?? "";
  const listed = new Map<string, AdrEntry>();
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length >= 5 && /^\d{8}-\d{2}$/.test(cells[1] ?? "")) {
      listed.set(cells[1] ?? "", {
        id: cells[1] ?? "",
        title: cells[2] ?? "",
        status: cells[3] ?? "",
      });
    }
  }
  const problems: string[] = [];
  const files = adrFiles(root);
  for (const file of files) {
    const entry = listed.get(file.id);
    if (entry === undefined) problems.push(`${file.id} が一覧にありません`);
    else {
      if (entry.title !== file.title)
        problems.push(
          `${file.id} の題が違います（一覧「${entry.title}」、ファイル「${file.title}」）`,
        );
      if (entry.status !== file.status)
        problems.push(
          `${file.id} の status が違います（一覧 ${entry.status}、ファイル ${file.status}）`,
        );
    }
  }
  for (const id of listed.keys()) {
    if (!files.some((file) => file.id === id))
      problems.push(`一覧の ${id} に対応するファイルがありません`);
  }
  return [
    problems.length === 0
      ? result(
          category,
          "docs/adr/README.md の一覧",
          "pass",
          `${files.length} 本`,
        )
      : result(
          category,
          "docs/adr/README.md の一覧",
          "fail",
          problems.join("、"),
        ),
  ];
};

// ---- 利用者向け文書 ----

export const checkUsage = (root: string = pluginRoot()): CheckResult[] => {
  const ids = adrFiles(root)
    .map((entry) => entry.id)
    .filter((id) => id !== "");
  const hits: string[] = [];
  for (const file of walk(join(root, "docs", "usage"), (path) =>
    path.endsWith(".md"),
  )) {
    const text = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    for (const id of ids) {
      if (text.includes(id)) hits.push(`${rel(root, file)}（${id}）`);
    }
  }
  return [
    hits.length === 0
      ? result("利用者向け文書", "docs/usage/ に ADR の番号が無い", "pass")
      : result(
          "利用者向け文書",
          "docs/usage/ に ADR の番号が無い",
          "fail",
          `ADR の番号は HTML コメントに移してください：${hits.join(", ")}`,
        ),
  ];
};

export const REPO_CHECKS: Record<string, (root?: string) => CheckResult[]> = {
  skills: checkSkills,
  hooks: checkHooks,
  plugin: checkPlugin,
  templates: checkTemplates,
  leak: checkLeak,
  docs: checkDocs,
  adr: checkAdrIndex,
  usage: checkUsage,
};

// ---- Obsidian アダプタ ----

/** Bases のダッシュボードが参照してよいノートのプロパティ（第 9 節のフロントマターだけ） */
const BASE_PROPERTIES = new Set([
  "type",
  "business",
  "status",
  "created",
  "updated",
  "as_of",
  "verified",
  "id",
  "target",
]);

export const checkAdapters = (root: string = pluginRoot()): CheckResult[] => {
  const category = "Obsidian アダプタ";
  const dir = join(root, "adapters", "obsidian");
  const results: CheckResult[] = [];
  for (const file of walk(join(dir, "vault"), (path) =>
    path.endsWith(".json"),
  )) {
    try {
      JSON.parse(readFileSync(file, "utf8"));
      results.push(result(category, rel(root, file), "pass"));
    } catch (error) {
      results.push(
        result(
          category,
          rel(root, file),
          "fail",
          `JSON として読めません：${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
  for (const file of walk(join(dir, "bases"), (path) =>
    path.endsWith(".base"),
  )) {
    const text = readFileSync(file, "utf8");
    const used = new Set<string>();
    // order の項目と、比較の左辺に出てくるプロパティ名
    for (const match of text.matchAll(/^\s*-\s+([a-z_.]+)\s*$/gm))
      used.add(match[1] ?? "");
    // 比較式は引用符で囲んでも囲まなくてもよい（Obsidian は保存し直すときに引用符を外す）
    for (const match of text.matchAll(
      /^\s*-\s+'?([a-z_.]+)\s*(?:==|!=|<=|>=|<|>)/gm,
    ))
      used.add(match[1] ?? "");
    for (const match of text.matchAll(/property:\s*([a-z_.]+)/g))
      used.add(match[1] ?? "");
    const unknown = [...used].filter((name) => {
      const bare = name.replace(/^note\./, "");
      return (
        !name.startsWith("file.") &&
        !name.startsWith("formula.") &&
        !BASE_PROPERTIES.has(bare)
      );
    });
    const problems: string[] = [];
    if (text.trim() === "") problems.push("中身が空です");
    if (!/^views:/m.test(text)) problems.push("views がありません");
    if (unknown.length > 0)
      problems.push(
        `第 9 節のフロントマターに無いプロパティを使っています：${unknown.join(", ")}`,
      );
    results.push(
      problems.length === 0
        ? result(category, rel(root, file), "pass")
        : result(category, rel(root, file), "fail", problems.join("、")),
    );
  }
  const schema = frontmatterSchema();
  for (const file of walk(join(dir, "templates"), (path) =>
    path.endsWith(".md"),
  )) {
    // Obsidian の置き換え記号に見本の値を入れてから、スキーマに照らす
    const filled = readFileSync(file, "utf8")
      .replace(/\{\{date(?::[^}]*)?\}\}/g, "2026-01-01")
      .replace(/\{\{[a-z]+\}\}/g, "見本");
    const fm = parseFrontmatter(filled);
    const errors =
      fm === undefined
        ? ["フロントマターがありません"]
        : [...new Set(validate(schema, schema, fm.data))];
    results.push(
      errors.length === 0
        ? result(category, rel(root, file), "pass")
        : result(category, rel(root, file), "fail", errors.join("、")),
    );
  }
  if (results.length === 0)
    results.push(
      result(
        category,
        "adapters/obsidian",
        "fail",
        "アダプタのファイルがありません",
      ),
    );
  return results;
};

REPO_CHECKS["adapters"] = checkAdapters;

// ---- 版とリリース（ADR 20261003-09） ----

/** リリースのタグの接頭辞。`claude plugin tag` が作る `<Plugin 名>--v<版>` */
const RELEASE_TAG_PREFIX = "business-os--v";

/** リリースのタグの版の一覧。タグを読めなければ undefined */
const releaseTagVersions = (root: string): string[] | undefined => {
  const run = spawnSync("git", ["tag", "--list", `${RELEASE_TAG_PREFIX}*`], {
    cwd: root,
    encoding: "utf8",
  });
  if (run.status !== 0) return undefined;
  return run.stdout
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith(RELEASE_TAG_PREFIX))
    .map((tag) => tag.slice(RELEASE_TAG_PREFIX.length));
};

/** リリース PR（main 向けの PR）でだけ確かめること */
const releasePrResults = (root: string, version: string): CheckResult[] => {
  const category = "リリース";
  const results: CheckResult[] = [];
  const tags = releaseTagVersions(root);
  if (tags === undefined || tags.length === 0) {
    results.push(
      result(
        category,
        "直近のタグ",
        "fail",
        `${RELEASE_TAG_PREFIX}* のタグを読めません。CI の checkout がタグを取っているか確かめてください（比べる基準が無いまま通さない）`,
      ),
    );
  } else {
    const latest = tags.reduce((max, tag) =>
      compareVersions(tag, max) > 0 ? tag : max,
    );
    results.push(
      compareVersions(version, latest) > 0
        ? result(
            category,
            "版が直近のタグより大きい",
            "pass",
            `${latest} → ${version}`,
          )
        : result(
            category,
            "版が直近のタグより大きい",
            "fail",
            `版 ${version} が直近のタグ ${RELEASE_TAG_PREFIX}${latest} より大きくありません。版上げ（pnpm release:version）を忘れていないか確かめてください`,
          ),
    );
  }
  const changelogPath = join(root, "CHANGELOG.md");
  const changelog = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf8")
    : "";
  results.push(
    changelog.split("\n").some((line) => line.trim() === `## ${version}`)
      ? result(category, "CHANGELOG の版の節", "pass", version)
      : result(
          category,
          "CHANGELOG の版の節",
          "fail",
          `CHANGELOG.md に「## ${version}」の節がありません`,
        ),
  );
  const changesetDir = join(root, ".changeset");
  const leftovers = existsSync(changesetDir)
    ? readdirSync(changesetDir).filter(
        (name) => name.endsWith(".md") && name !== "README.md",
      )
    : [];
  results.push(
    leftovers.length === 0
      ? result(category, "使い残しの changeset", "pass")
      : result(
          category,
          "使い残しの changeset",
          "fail",
          `.changeset/ に ${leftovers.join("、")} が残っています。版上げ（pnpm release:version）で消費してください`,
        ),
  );
  return results;
};

/**
 * 版とリリースの検査。版の一致と形は常に、版の大きさ・CHANGELOG・changeset は main 向けの PR でだけ確かめる。
 * main 向けかどうかは、GitHub Actions の pull_request で入る GITHUB_BASE_REF で見分ける
 */
export const checkRelease = (
  root: string = pluginRoot(),
  env: NodeJS.ProcessEnv = process.env,
): CheckResult[] => {
  const category = "版";
  let pkg: string;
  let manifest: string;
  try {
    pkg = packageVersion(root);
    manifest = manifestVersion(root);
  } catch (error) {
    return [
      result(
        category,
        "version",
        "fail",
        error instanceof Error ? error.message : String(error),
      ),
    ];
  }
  if (pkg !== manifest) {
    return [
      result(
        category,
        "package.json と plugin.json の version",
        "fail",
        `package.json ${pkg}、plugin.json ${manifest}。node scripts/sync-plugin-version.ts で写してください`,
      ),
    ];
  }
  const results = [
    result(category, "package.json と plugin.json の version", "pass", pkg),
  ];
  if (env["GITHUB_BASE_REF"] === "main") {
    results.push(...releasePrResults(root, pkg));
  }
  return results;
};

REPO_CHECKS["release"] = (root) => checkRelease(root);

// ---- 作業者エージェント ----

/** business-os が同梱するエージェント（作業者だけ。役割エージェントは同梱しない。ADR 20261002-01） */
const BUNDLED_AGENTS = ["worker.md"];
const MODEL_ALIASES = new Set(["fable", "best", "opus", "sonnet", "haiku"]);
/** 作業者が持ってはいけないツール（外部への行動、人との対話、さらなる委譲につながるもの） */
const FORBIDDEN_WORKER_TOOLS = [
  "Bash",
  "PowerShell",
  "WebFetch",
  "WebSearch",
  "Agent",
  "AskUserQuestion",
];

export const checkAgents = (root: string = pluginRoot()): CheckResult[] => {
  const category = "作業者エージェント";
  const dir = join(root, "agents");
  if (!existsSync(dir))
    return [
      result(category, "agents/", "fail", "agents/worker.md がありません"),
    ];
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
  const results: CheckResult[] = [];
  const extra = files.filter((name) => !BUNDLED_AGENTS.includes(name));
  if (extra.length > 0) {
    results.push(
      result(
        category,
        "agents/",
        "fail",
        `同梱するのは作業者だけです（役割エージェントは company で育てる）：${extra.join(", ")}`,
      ),
    );
  }
  for (const name of BUNDLED_AGENTS) {
    const path = join(dir, name);
    if (!existsSync(path)) {
      results.push(result(category, `agents/${name}`, "fail", "ありません"));
      continue;
    }
    const fm = parseFrontmatter(readFileSync(path, "utf8"));
    const problems: string[] = [];
    if (fm === undefined) problems.push("フロントマターがありません");
    else {
      if (fm.data["name"] !== name.replace(/\.md$/, ""))
        problems.push("name がファイル名と違います");
      if (!fm.data["description"]) problems.push("description がありません");
      const model = fm.data["model"] ?? "";
      if (!MODEL_ALIASES.has(model))
        problems.push(
          `model は別名（${[...MODEL_ALIASES].join(" / ")}）で書きます：${model || "なし"}`,
        );
      const tools = (fm.data["tools"] ?? "")
        .split(",")
        .map((tool) => tool.trim())
        .filter((tool) => tool !== "");
      if (tools.length === 0)
        problems.push(
          "tools を明示してください（省略すると全てのツールを受け継ぐ）",
        );
      const forbidden = tools.filter((tool) =>
        FORBIDDEN_WORKER_TOOLS.includes(tool),
      );
      if (forbidden.length > 0)
        problems.push(
          `作業者に持たせないツールがあります：${forbidden.join(", ")}`,
        );
    }
    results.push(
      problems.length === 0
        ? result(category, `agents/${name}`, "pass")
        : result(category, `agents/${name}`, "fail", problems.join("、")),
    );
  }
  return results;
};

REPO_CHECKS["agents"] = checkAgents;

// ---- シェルスクリプト ----

/** bash を許す唯一の場所：eval のケースの scaffold.sh（ADR 20261003-03） */
const SCAFFOLD_SH = /^evals\/.+\/scaffold\.sh$/;
const SHELL_EXTENSION = /\.(sh|bash|zsh|ksh)$/;
const SHELL_SHEBANG = /^#!.*\b(sh|bash|zsh|ksh|dash)\b/;

export const checkShell = (root: string = pluginRoot()): CheckResult[] => {
  const category = "シェルスクリプト";
  const results: CheckResult[] = [];
  for (const file of trackedFiles(root)) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const isShellByName = SHELL_EXTENSION.test(file);
    const isShellByShebang =
      !/\.[^/]+$/.test(file) &&
      SHELL_SHEBANG.test(readFileSync(path, "utf8").split("\n", 1)[0] ?? "");
    if (!isShellByName && !isShellByShebang) continue;
    if (!SCAFFOLD_SH.test(file)) {
      results.push(
        result(
          category,
          file,
          "fail",
          "bash などのシェルスクリプトは置けません。処理は TypeScript で書きます（例外は evals/ の scaffold.sh だけ）",
        ),
      );
      continue;
    }
    const commands = readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    const ok = commands.length === 1 && commands[0]?.startsWith("exec node ");
    results.push(
      ok
        ? result(category, file, "pass")
        : result(
            category,
            file,
            "fail",
            `scaffold.sh はコメントと空行を除いて「exec node …」の 1 行だけにします（今は ${commands.length} 行）`,
          ),
    );
  }
  if (results.length === 0) {
    results.push(result(category, "シェルスクリプトなし", "pass"));
  }
  return results;
};

REPO_CHECKS["shell"] = checkShell;

// ---- Skill の動作の検証（evals/skills/） ----

/** eval の対象外にする Skill と、その理由（ADR 20261003-02、20261003-04） */
const EVAL_EXCLUDED: Record<string, string> = {
  check: "Bash が要るため（判定のロジックは vitest で検査する）",
};

/** フォルダの下に eval のケース（case.yaml か prompt.md を持つフォルダ）があるか */
const hasEvalCase = (dir: string): boolean =>
  walk(dir, (path) => /[/\\](case\.yaml|prompt\.md)$/.test(path)).length > 0;

export const checkEvals = (root: string = pluginRoot()): CheckResult[] => {
  const category = "Skill の検証";
  const results: CheckResult[] = [];
  const evalsDir = join(root, "evals", "skills");
  const skills = new Set(
    readdirSync(join(root, "skills")).filter((name) =>
      statSync(join(root, "skills", name)).isDirectory(),
    ),
  );
  const tested = existsSync(evalsDir)
    ? readdirSync(evalsDir).filter((name) =>
        statSync(join(evalsDir, name)).isDirectory(),
      )
    : [];
  for (const name of tested) {
    const path = `evals/skills/${name}`;
    if (!skills.has(name)) {
      results.push(
        result(
          category,
          path,
          "fail",
          `skills/${name} がありません。Skill の名前を変えた・消したなら、検証のフォルダも合わせます`,
        ),
      );
    } else if (EVAL_EXCLUDED[name] !== undefined) {
      results.push(
        result(
          category,
          path,
          "fail",
          `/${name} は検証の対象外として登録されています。検証を足したなら、対象外の一覧から外します`,
        ),
      );
    } else if (!hasEvalCase(join(evalsDir, name))) {
      results.push(result(category, path, "warn", "ケースが 1 つもありません"));
    } else {
      results.push(result(category, path, "pass"));
    }
  }
  for (const name of skills) {
    if (tested.includes(name) || EVAL_EXCLUDED[name] !== undefined) continue;
    results.push(
      result(
        category,
        `skills/${name}`,
        "warn",
        `evals/skills/${name}/ に検証のケースがありません`,
      ),
    );
  }
  return results;
};

REPO_CHECKS["evals"] = checkEvals;
