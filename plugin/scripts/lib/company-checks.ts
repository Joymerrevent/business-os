// company の重い点検（/check）。ADR 20260929-06 の「重い点検」の表を正典とする。
// 「設定がある」ではなく「効いている」を確かめる（hook に合成入力を渡す、sandbox に書き込みを試みる）。
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { readCompany, type Company } from "../../hooks/lib/company.ts";
import { parseFrontmatter } from "../../hooks/lib/frontmatter.ts";
import { frontmatterSchema, pluginRoot } from "../../hooks/lib/plugin.ts";
import { validate } from "../../hooks/lib/schema.ts";
import {
  allowedSockets,
  localWarnings,
  missingEnv,
  missingMcpAskRules,
  missingRules,
} from "../../hooks/lib/settings.ts";

export type Level = "pass" | "warn" | "fail";
export type CheckResult = {
  category: string;
  name: string;
  level: Level;
  detail: string;
};

export type CheckOptions = {
  /** 今日の日付（YYYY-MM-DD）。テストで固定するため */
  today: string;
  /** sandbox への書き込み試行を行うか（Claude Code の外で実行するときは false） */
  sandboxProbe: boolean;
  /** claude plugin validate を実行するか（claude コマンドが無い環境では false） */
  pluginValidate: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PROBE = "__business-os-check-probe__";

const daysBetween = (from: string, to: string): number =>
  Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

const isDate = (value: string | undefined): value is string =>
  value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);

const walkMarkdown = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    // .obsidian は Obsidian の設定、_templates は雛形の置き場（置き換え記号を含むため検査しない）
    if (
      name === ".obsidian" ||
      name === "_templates" ||
      name === "node_modules"
    )
      return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walkMarkdown(path);
    return name.endsWith(".md") ? [path] : [];
  });
};

const rel = (root: string, path: string): string =>
  relative(root, path).split(sep).join("/");

const result = (
  category: string,
  name: string,
  level: Level,
  detail = "",
): CheckResult => ({ category, name, level, detail });

// ---- 防衛の発火 ----

type HookCase = {
  name: string;
  input: Record<string, unknown>;
  env?: Record<string, string>;
  expect: "deny" | "ask" | "allow";
};

const runHook = (
  root: string,
  input: Record<string, unknown>,
  env: Record<string, string> = {},
): "deny" | "ask" | "allow" | "error" => {
  const run = spawnSync(
    process.execPath,
    [join(pluginRoot(), "hooks", "pre-tool-use.ts")],
    {
      input: JSON.stringify({
        cwd: root,
        hook_event_name: "PreToolUse",
        ...input,
      }),
      encoding: "utf8",
      env: { ...process.env, BUSINESS_OS_HOOK_FAULT: "", ...env },
    },
  );
  if (run.status === 2) return "deny";
  if (run.status !== 0) return "error";
  if (run.stdout.trim() === "") return "allow";
  try {
    const parsed = JSON.parse(run.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string };
    };
    return parsed.hookSpecificOutput?.permissionDecision === "ask"
      ? "ask"
      : "allow";
  } catch {
    return "error";
  }
};

const validDoc = (): string =>
  [
    "---",
    "type: knowledge",
    "business: portfolio",
    "status: draft",
    "created: 2026-01-01",
    "updated: 2026-01-01",
    "as_of: n/a",
    "verified: n/a",
    "---",
    "",
  ].join("\n");

export const checkHookFiring = (company: Company): CheckResult[] => {
  const root = company.root;
  const category = "防衛の発火";
  // 初期化中は保護対象の新規作成を通す（プローブは新規ファイル）
  const protectedExpect = company.state === "active" ? "deny" : "allow";
  const cases: HookCase[] = [
    {
      name: "提案の無い憲章への書き込みを止める",
      input: {
        tool_name: "Write",
        tool_input: {
          file_path: join(root, "docs", "charter", `${PROBE}.md`),
          content: validDoc(),
        },
      },
      expect: protectedExpect,
    },
    {
      name: "フロントマターの無い文書を止める",
      input: {
        tool_name: "Write",
        tool_input: {
          file_path: join(root, "docs", "knowledge", `${PROBE}.md`),
          content: "# x\n",
        },
      },
      expect: "deny",
    },
    {
      name: "正しい文書は通す",
      input: {
        tool_name: "Write",
        tool_input: {
          file_path: join(root, "docs", "knowledge", `${PROBE}.md`),
          content: validDoc(),
        },
      },
      expect: "allow",
    },
    {
      name: "内部の例外で止まる（fail-closed）",
      input: {
        tool_name: "Write",
        tool_input: {
          file_path: join(root, "docs", "knowledge", `${PROBE}.md`),
          content: validDoc(),
        },
      },
      env: { BUSINESS_OS_HOOK_FAULT: "1" },
      expect: "deny",
    },
    {
      name: "force push（フラグが後ろ）を止める",
      input: {
        tool_name: "Bash",
        tool_input: { command: "git push origin main -f" },
      },
      expect: "deny",
    },
  ];
  return cases.map((testCase) => {
    const actual = runHook(root, testCase.input, testCase.env);
    return actual === testCase.expect
      ? result(category, testCase.name, "pass")
      : result(
          category,
          testCase.name,
          "fail",
          `期待 ${testCase.expect}、実際 ${actual}`,
        );
  });
};

export const checkSandbox = (
  root: string,
  options: CheckOptions,
): CheckResult => {
  const category = "防衛の発火";
  const name = "sandbox が憲章への書き込みを止める";
  if (!options.sandboxProbe)
    return result(
      category,
      name,
      "warn",
      "この実行では試していません（--no-sandbox-probe）",
    );
  if (process.platform === "win32") {
    return result(
      category,
      name,
      "warn",
      "native Windows では sandbox が動きません。WSL での利用を勧めます",
    );
  }
  const dir = join(root, "docs", "charter");
  if (!existsSync(dir))
    return result(
      category,
      name,
      "fail",
      "docs/charter/ がありません（/onboard が未完了）",
    );
  const probe = join(dir, `.${PROBE}`);
  try {
    writeFileSync(probe, "probe");
  } catch {
    return result(category, name, "pass");
  }
  rmSync(probe, { force: true });
  return result(
    category,
    name,
    "fail",
    "書き込めてしまいました。sandbox が無効か、Claude Code の外で実行しています（外で実行するときは --no-sandbox-probe）",
  );
};

// ---- 設定の一致 ----

export const checkSettings = (
  root: string,
  options: CheckOptions,
): CheckResult[] => {
  const category = "設定の一致";
  const missing = missingRules(root);
  const results = [
    missing.length === 0
      ? result(category, "settings.json が雛形の必須規則を含む", "pass")
      : result(
          category,
          "settings.json が雛形の必須規則を含む",
          "fail",
          missing.join("、"),
        ),
  ];
  const mcpMissing = missingMcpAskRules(root);
  results.push(
    mcpMissing.length === 0
      ? result(
          category,
          "settings.json が外部のツール（MCP）の確認の予備の規則を含む",
          "pass",
        )
      : result(
          category,
          "settings.json が外部のツール（MCP）の確認の予備の規則を含む",
          "warn",
          `permissions.ask に無い規則：${mcpMissing.join(", ")}。/onboard --migrate で足す提案を書けます（/approve で反映。手で足してもかまいません）`,
        ),
  );
  const envMissing = missingEnv(root);
  results.push(
    envMissing.length === 0
      ? result(category, "settings.json が雛形の env を含む", "pass")
      : result(
          category,
          "settings.json が雛形の env を含む",
          "warn",
          `env に無いか値が違う設定：${envMissing.join(", ")}。sandbox の中の通信の失敗が見えにくくなります。/onboard --migrate で足す提案を書けます（/approve で反映。手で足してもかまいません）`,
        ),
  );
  const warnings = localWarnings(root);
  results.push(
    warnings.length === 0
      ? result(
          category,
          "settings.local.json が sandbox を広く緩めていない",
          "pass",
        )
      : result(
          category,
          "settings.local.json が sandbox を広く緩めていない",
          "warn",
          warnings.join("、"),
        ),
  );
  const sockets = allowedSockets(root);
  if (sockets.length > 0) {
    // 判定はしない。覚えのないパスに人が気づけるよう、一覧を示す
    results.push(
      result(
        category,
        "sandbox の中から接続できる Unix ソケット",
        "pass",
        sockets.join("、"),
      ),
    );
  }
  if (!options.pluginValidate) {
    results.push(
      result(
        category,
        "claude plugin validate が通る",
        "warn",
        "この実行では試していません（--no-plugin-validate）",
      ),
    );
    return results;
  }
  const validateRun = spawnSync(
    "claude",
    ["plugin", "validate", join(pluginRoot(), ".claude-plugin", "plugin.json")],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const name = "claude plugin validate が通る";
  if (validateRun.error !== undefined) {
    results.push(
      result(category, name, "warn", "claude コマンドを実行できませんでした"),
    );
  } else if (validateRun.status === 0) {
    results.push(result(category, name, "pass"));
  } else {
    const output = `${validateRun.stdout}${validateRun.stderr}`
      .trim()
      .split("\n")
      .slice(-3)
      .join(" ");
    results.push(result(category, name, "fail", output));
  }
  return results;
};

// ---- 文書の規約と鮮度 ----

export const checkDocuments = (
  root: string,
  options: CheckOptions,
): CheckResult[] => {
  const schema = frontmatterSchema();
  const conventions: CheckResult[] = [];
  const freshness: CheckResult[] = [];
  const files = walkMarkdown(join(root, "docs"));
  for (const file of files) {
    const path = rel(root, file);
    let fm;
    try {
      fm = parseFrontmatter(readFileSync(file, "utf8"));
    } catch (error) {
      conventions.push(
        result(
          "文書の規約",
          path,
          "fail",
          error instanceof Error ? error.message : String(error),
        ),
      );
      continue;
    }
    if (fm === undefined) {
      conventions.push(
        result("文書の規約", path, "fail", "フロントマターがありません"),
      );
      continue;
    }
    const data = fm.data;
    const errors = [...new Set(validate(schema, schema, data))];
    if (
      isDate(data["created"]) &&
      isDate(data["updated"]) &&
      data["updated"] < data["created"]
    ) {
      errors.push(
        `updated（${data["updated"]}）が created（${data["created"]}）より前です`,
      );
    }
    const name = path.split("/").pop() ?? "";
    if (
      (path.startsWith("docs/proposals/") ||
        path.startsWith("docs/decisions/")) &&
      !name.startsWith("_")
    ) {
      if (data["id"] === undefined || !name.startsWith(`${data["id"]}-`)) {
        errors.push(
          `id（${data["id"] ?? "なし"}）がファイル名の先頭と一致しません`,
        );
      }
    }
    if (
      /^docs\/operations\/reviews\/(monthly|quarterly)-/.test(path) &&
      !isDate(data["as_of"])
    ) {
      errors.push("月次・四半期のレビューは as_of（数字の基準日）が必須です");
    }
    if (errors.length > 0)
      conventions.push(result("文書の規約", path, "fail", errors.join("、")));

    // 鮮度（いずれも warn）
    const age = (date: string | undefined) =>
      isDate(date) ? daysBetween(date, options.today) : undefined;
    const verifiedAge = age(data["verified"]);
    if (
      path.startsWith("docs/charter/") &&
      verifiedAge !== undefined &&
      verifiedAge > 90
    ) {
      freshness.push(
        result(
          "鮮度",
          path,
          "warn",
          `最終確認（verified）から ${verifiedAge} 日。/quarterly で確かめてください`,
        ),
      );
    }
    const updatedAge = age(data["updated"]);
    if (
      path.startsWith("docs/operations/state/") &&
      updatedAge !== undefined &&
      updatedAge > 14
    ) {
      freshness.push(
        result(
          "鮮度",
          path,
          "warn",
          `更新から ${updatedAge} 日。/weekly-review で更新してください`,
        ),
      );
    }
    const createdAge = age(data["created"]);
    if (
      path.startsWith("docs/decisions/") &&
      data["status"] === "proposed" &&
      createdAge !== undefined &&
      createdAge > 30
    ) {
      freshness.push(
        result(
          "鮮度",
          path,
          "warn",
          `proposed のまま ${createdAge} 日。accepted か rejected に決めてください`,
        ),
      );
    }
    if (
      path.startsWith("docs/proposals/") &&
      data["status"] === "approving" &&
      updatedAge !== undefined &&
      updatedAge >= 1
    ) {
      freshness.push(
        result(
          "鮮度",
          path,
          "warn",
          "approving のまま 1 日以上。/approve で完了させてください",
        ),
      );
    }
  }
  if (conventions.length === 0) {
    conventions.push(
      result("文書の規約", `docs/ の文書 ${files.length} 本`, "pass"),
    );
  }
  if (freshness.length === 0)
    freshness.push(result("鮮度", "期限切れの文書なし", "pass"));
  return [...conventions, ...freshness];
};

// ---- リンク ----

export const checkLinks = (root: string): CheckResult[] => {
  const broken: string[] = [];
  for (const file of walkMarkdown(join(root, "docs"))) {
    const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const match of text.matchAll(
      /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    )) {
      const target = match[1] ?? "";
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#"))
        continue;
      const path = decodeURIComponent(target.split("#")[0] ?? "");
      if (path === "") continue;
      if (!existsSync(resolve(dirname(file), path))) {
        broken.push(`${rel(root, file)} → ${target}`);
      }
    }
  }
  return broken.length === 0
    ? [result("リンク", "docs/ の相対リンク", "pass")]
    : broken.map((link) =>
        result("リンク", link, "fail", "リンク先がありません"),
      );
};

// ---- 漏洩 ----

const git = (root: string, args: string[]) =>
  spawnSync("git", args, { cwd: root, encoding: "utf8" });

export const checkLeaks = (root: string): CheckResult[] => {
  const category = "漏洩";
  const results: CheckResult[] = [];
  const tracked = git(root, ["ls-files"]);
  if (tracked.status === 0) {
    const envFiles = tracked.stdout
      .split("\n")
      .filter((f) => /(^|\/)\.env(\.[^/]*)?$/.test(f));
    results.push(
      envFiles.length === 0
        ? result(category, ".env が git で追跡されていない", "pass")
        : result(
            category,
            ".env が git で追跡されていない",
            "fail",
            envFiles.join(", "),
          ),
    );
  } else {
    results.push(
      result(
        category,
        ".env が git で追跡されていない",
        "warn",
        "git リポジトリではありません",
      ),
    );
  }
  const leaks = spawnSync(
    "gitleaks",
    ["git", "--no-banner", "--redact", "--exit-code", "1"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  if (leaks.error !== undefined) {
    results.push(
      result(
        category,
        "gitleaks",
        "warn",
        "gitleaks が入っていません（macOS は brew install gitleaks）",
      ),
    );
  } else if (leaks.status === 0) {
    results.push(result(category, "gitleaks", "pass"));
  } else if (leaks.status === 1) {
    results.push(
      result(
        category,
        "gitleaks",
        "fail",
        "秘密らしき文字列が見つかりました。gitleaks git を手で実行して確かめてください",
      ),
    );
  } else {
    results.push(
      result(category, "gitleaks", "warn", "gitleaks を実行できませんでした"),
    );
  }
  return results;
};

// ---- Git ----

export const checkGit = (root: string): CheckResult[] => {
  const category = "Git";
  const status = git(root, ["status", "--porcelain"]);
  if (status.status !== 0)
    return [
      result(category, "git の状態", "warn", "git リポジトリではありません"),
    ];
  const results: CheckResult[] = [];
  const changes = status.stdout
    .split("\n")
    .filter((line) => line.trim() !== "").length;
  results.push(
    changes === 0
      ? result(category, "未コミットの変更", "pass")
      : result(
          category,
          "未コミットの変更",
          "warn",
          `${changes} 件。コミットするか、要らなければ戻してください`,
        ),
  );
  const ahead = git(root, ["rev-list", "--count", "@{u}..HEAD"]);
  if (ahead.status !== 0) {
    results.push(
      result(
        category,
        "未 push のコミット",
        "warn",
        "push 先（upstream）が設定されていません",
      ),
    );
  } else {
    const count = Number(ahead.stdout.trim());
    results.push(
      count === 0
        ? result(category, "未 push のコミット", "pass")
        : result(category, "未 push のコミット", "warn", `${count} 件`),
    );
  }
  const branch = git(root, ["branch", "--show-current"]).stdout.trim();
  results.push(
    branch === ""
      ? result(
          category,
          "現在のブランチ",
          "warn",
          "ブランチにいません（detached HEAD）",
        )
      : result(category, "現在のブランチ", "pass", branch),
  );
  return results;
};

// ---- 指示ファイル・Obsidian・利用統計 ----

export const checkInstructions = (root: string): CheckResult[] => {
  const path = join(root, "CLAUDE.md");
  if (!existsSync(path))
    return [result("指示ファイル", "CLAUDE.md", "fail", "ありません")];
  const lines = readFileSync(path, "utf8").split("\n").length;
  return [
    lines > 70
      ? result(
          "指示ファイル",
          "CLAUDE.md の行数",
          "warn",
          `${lines} 行（上限 70 行）。手順は Skill に、事実は docs/ に移してください`,
        )
      : result("指示ファイル", "CLAUDE.md の行数", "pass", `${lines} 行`),
  ];
};

export const checkObsidian = (root: string): CheckResult[] => {
  const vault = join(root, "docs", ".obsidian");
  if (!existsSync(vault)) return [];
  const ignore = existsSync(join(root, ".gitignore"))
    ? readFileSync(join(root, ".gitignore"), "utf8")
    : "";
  const results = [
    /workspace\*?\.json|workspace\.json/.test(ignore)
      ? result(
          "Obsidian",
          ".obsidian/workspace*.json が gitignore 済み",
          "pass",
        )
      : result(
          "Obsidian",
          ".obsidian/workspace*.json が gitignore 済み",
          "warn",
          ".gitignore に除外がありません",
        ),
  ];
  const dashboards = join(root, "docs", "dashboards");
  if (existsSync(dashboards)) {
    for (const name of readdirSync(dashboards).filter((n) =>
      n.endsWith(".base"),
    )) {
      if (readFileSync(join(dashboards, name), "utf8").trim() === "") {
        results.push(
          result("Obsidian", `dashboards/${name}`, "warn", "中身が空です"),
        );
      }
    }
  }
  return results;
};

export const skillUsage = (
  root: string,
  options: CheckOptions,
): Map<string, number> => {
  const counts = new Map<string, number>();
  const dir = join(root, "docs", "operations", "daily");
  if (!existsSync(dir)) return counts;
  for (const name of readdirSync(dir)) {
    const date = name.replace(/\.md$/, "");
    if (!isDate(date)) continue;
    const age = daysBetween(date, options.today);
    if (age < 0 || age >= 7) continue;
    for (const match of readFileSync(join(dir, name), "utf8").matchAll(
      /^- \d{1,2}:\d{2} \/([a-z0-9:-]+)/gm,
    )) {
      const skill = (match[1] ?? "").replace(/^business-os:/, "");
      counts.set(skill, (counts.get(skill) ?? 0) + 1);
    }
  }
  return counts;
};

// ---- まとめ ----

export const runCompanyChecks = (
  root: string,
  options: CheckOptions,
): CheckResult[] => {
  let company: Company;
  try {
    company = readCompany(root);
  } catch (error) {
    return [
      result(
        "設定の一致",
        ".business-os.json",
        "fail",
        error instanceof Error ? error.message : String(error),
      ),
    ];
  }
  return [
    ...checkHookFiring(company),
    checkSandbox(root, options),
    ...checkSettings(root, options),
    ...checkDocuments(root, options),
    ...checkLinks(root),
    ...checkLeaks(root),
    ...checkGit(root),
    ...checkInstructions(root),
    ...checkObsidian(root),
  ];
};

const LEVEL_LABEL: Record<Level, string> = {
  pass: "pass",
  warn: "warn",
  fail: "**fail**",
};

export const renderReport = (
  results: CheckResult[],
  usage: Map<string, number>,
  options: CheckOptions,
  created: string,
): string => {
  const count = (level: Level) =>
    results.filter((r) => r.level === level).length;
  const lines = [
    "---",
    "type: review",
    "business: portfolio",
    "status: active",
    `created: ${created}`,
    `updated: ${options.today}`,
    `as_of: ${options.today}`,
    "verified: n/a",
    "---",
    "",
    `# 点検 ${options.today}`,
    "",
    `結果：fail ${count("fail")} 件、warn ${count("warn")} 件、pass ${count("pass")} 件。`,
    "",
    "| 分類 | 項目 | 判定 | 詳細 |",
    "|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.category} | ${r.name.replaceAll("|", "\\|")} | ${LEVEL_LABEL[r.level]} | ${r.detail.replaceAll("|", "\\|")} |`,
    ),
    "",
    "## 利用統計（過去 7 日の Skill 実行回数）",
    "",
  ];
  if (usage.size === 0) {
    lines.push("実行記録がありません。");
  } else {
    lines.push("| Skill | 回数 |", "|---|---|");
    for (const [skill, n] of [...usage.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`| /${skill} | ${n} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
};
