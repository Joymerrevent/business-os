// 重い点検（/check）の入口。company に対して点検を行い、docs/operations/reviews/check-YYYYMMDD.md に書く。
// 全体の成否は終了コード：fail が 1 件でもあれば 1、それ以外は 0（warn は 0）。点検そのものが動かなければ 2。
//
// 使い方：
//   node scripts/check.ts --company <company のルート> [--no-sandbox-probe] [--no-plugin-validate] [--no-write] [--today YYYY-MM-DD]
//   node scripts/check.ts --company <company のルート> --live
//     本物の Claude Code（claude -p）を通した hook の発火試験だけを行う。sandbox の外（「!」付き）で実行する。
//     結果は、その日の点検レポートがあれば末尾に追記する。
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseFrontmatter } from "../hooks/lib/frontmatter.ts";
import {
  renderReport,
  runCompanyChecks,
  skillUsage,
  type CheckResult,
} from "./lib/company-checks.ts";
import { runLiveChecks } from "./lib/live-check.ts";

const pad = (n: number): string => String(n).padStart(2, "0");

const localToday = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const summarize = (label: string, results: CheckResult[]): string => {
  const fails = results.filter((r) => r.level === "fail");
  const warns = results.filter((r) => r.level === "warn");
  return [
    `${label}：fail ${fails.length} 件、warn ${warns.length} 件、pass ${results.length - fails.length - warns.length} 件`,
    ...[...fails, ...warns].map(
      (r) =>
        `- [${r.level}] ${r.category}：${r.name}${r.detail ? `（${r.detail}）` : ""}`,
    ),
  ].join("\n");
};

const runLive = (root: string, reportPath: string, write: boolean): number => {
  process.stdout.write(
    "本物の Claude Code（claude -p）で hook の発火を試しています（数十秒）…\n",
  );
  const results = runLiveChecks(root);
  process.stdout.write(`${summarize("発火試験", results)}\n`);
  if (write && existsSync(reportPath)) {
    const now = new Date();
    appendFileSync(
      reportPath,
      [
        "",
        `## 実機での発火試験（${pad(now.getHours())}:${pad(now.getMinutes())}）`,
        "",
        "| 項目 | 判定 | 詳細 |",
        "|---|---|---|",
        ...results.map(
          (r) =>
            `| ${r.name} | ${r.level === "fail" ? "**fail**" : r.level} | ${r.detail.replaceAll("|", "\\|")} |`,
        ),
        "",
      ].join("\n"),
    );
    process.stdout.write(`レポートに追記しました：${reportPath}\n`);
  }
  return results.some((r) => r.level === "fail") ? 1 : 0;
};

const main = (): number => {
  const { values } = parseArgs({
    options: {
      company: { type: "string" },
      today: { type: "string" },
      "no-sandbox-probe": { type: "boolean", default: false },
      "no-plugin-validate": { type: "boolean", default: false },
      "no-write": { type: "boolean", default: false },
      live: { type: "boolean", default: false },
    },
  });
  if (values.company === undefined) {
    process.stderr.write(
      "使い方：node scripts/check.ts --company <company のルート> [--live]\n",
    );
    return 2;
  }
  const root = resolve(values.company);
  const today = values.today ?? localToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    process.stderr.write("--today は YYYY-MM-DD で指定してください\n");
    return 2;
  }
  const reportPath = join(
    root,
    "docs",
    "operations",
    "reviews",
    `check-${today.replaceAll("-", "")}.md`,
  );
  if (values.live) return runLive(root, reportPath, !values["no-write"]);

  const options = {
    today,
    sandboxProbe: !values["no-sandbox-probe"],
    pluginValidate: !values["no-plugin-validate"],
  };
  const results = runCompanyChecks(root, options);
  const usage = skillUsage(root, options);
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
  process.stdout.write(
    [
      summarize("点検", results),
      values["no-write"] ? "" : `レポート：${reportPath}`,
      "",
    ].join("\n"),
  );
  return results.some((r) => r.level === "fail") ? 1 : 0;
};

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    `点検が内部エラーで止まりました：${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
