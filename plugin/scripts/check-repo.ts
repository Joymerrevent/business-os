// business-os の検査の入口。package.json の check:* から 1 つずつ呼ぶ。
// 成否は終了コード：fail があれば 1、無ければ 0（warn は 0）。
//
// 使い方：node plugin/scripts/check-repo.ts <検査の名前>
import { REPO_CHECKS } from "./lib/repo-checks.ts";

const main = (): number => {
  const name = process.argv[2] ?? "";
  const check = REPO_CHECKS[name];
  if (check === undefined) {
    process.stderr.write(
      `使い方：node plugin/scripts/check-repo.ts <${Object.keys(REPO_CHECKS).join(" | ")}>\n`,
    );
    return 2;
  }
  const results = check();
  const fails = results.filter((r) => r.level === "fail");
  const warns = results.filter((r) => r.level === "warn");
  for (const r of [...fails, ...warns]) {
    process.stdout.write(
      `[${r.level}] ${r.category}：${r.name}${r.detail ? `（${r.detail}）` : ""}\n`,
    );
  }
  process.stdout.write(
    `${name}：fail ${fails.length} 件、warn ${warns.length} 件、pass ${results.length - fails.length - warns.length} 件\n`,
  );
  return fails.length > 0 ? 1 : 0;
};

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    `検査が内部エラーで止まりました：${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
