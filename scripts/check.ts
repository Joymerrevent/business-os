// 重い点検（/check）の入口。company に対して点検を行い、docs/operations/reviews/check-YYYYMMDD.md に書く。
// 全体の成否は終了コード：fail が 1 件でもあれば 1、それ以外は 0（warn は 0）。
//
// 使い方：node scripts/check.ts --company <company のルート> [--no-sandbox-probe] [--no-plugin-validate] [--no-write] [--today YYYY-MM-DD]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseFrontmatter } from "../hooks/lib/frontmatter.ts";
import {
  renderReport,
  runCompanyChecks,
  skillUsage,
} from "./lib/company-checks.ts";

const localToday = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const main = (): number => {
  const { values } = parseArgs({
    options: {
      company: { type: "string" },
      today: { type: "string" },
      "no-sandbox-probe": { type: "boolean", default: false },
      "no-plugin-validate": { type: "boolean", default: false },
      "no-write": { type: "boolean", default: false },
    },
  });
  if (values.company === undefined) {
    process.stderr.write(
      "使い方：node scripts/check.ts --company <company のルート>\n",
    );
    return 2;
  }
  const root = resolve(values.company);
  const today = values.today ?? localToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    process.stderr.write("--today は YYYY-MM-DD で指定してください\n");
    return 2;
  }
  const options = {
    today,
    sandboxProbe: !values["no-sandbox-probe"],
    pluginValidate: !values["no-plugin-validate"],
  };
  const results = runCompanyChecks(root, options);
  const usage = skillUsage(root, options);

  const reportPath = join(
    root,
    "docs",
    "operations",
    "reviews",
    `check-${today.replaceAll("-", "")}.md`,
  );
  let created = today;
  if (existsSync(reportPath)) {
    created =
      parseFrontmatter(readFileSync(reportPath, "utf8"))?.data["created"] ??
      today;
  }
  const report = renderReport(results, usage, options, created);
  if (!values["no-write"]) {
    mkdirSync(join(root, "docs", "operations", "reviews"), { recursive: true });
    writeFileSync(reportPath, report);
  }
  const fails = results.filter((r) => r.level === "fail");
  const warns = results.filter((r) => r.level === "warn");
  process.stdout.write(
    [
      `点検：fail ${fails.length} 件、warn ${warns.length} 件、pass ${results.length - fails.length - warns.length} 件`,
      ...[...fails, ...warns].map(
        (r) =>
          `- [${r.level}] ${r.category}：${r.name}${r.detail ? `（${r.detail}）` : ""}`,
      ),
      values["no-write"] ? "" : `レポート：${reportPath}`,
      "",
    ].join("\n"),
  );
  return fails.length > 0 ? 1 : 0;
};

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    `点検が内部エラーで止まりました：${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
