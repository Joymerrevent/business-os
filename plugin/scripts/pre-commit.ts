// git の pre-commit フック（simple-git-hooks から呼ぶ）。bash を使わず Node で実行する。
// 1. lint-staged でステージ済みのファイルを lint・整形する
// 2. gitleaks でステージ済みの変更から秘密を探す。gitleaks が無ければ警告してコミットを通す
//    （CI と GitHub の Push Protection で必ず検査されるため）
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

const run = (command: string, args: string[]): SpawnSyncReturns<Buffer> =>
  spawnSync(command, args, {
    stdio: "inherit",
    // Windows では pnpm が pnpm.cmd のため、シェル経由で解決する
    shell: process.platform === "win32",
  });

const isMissing = (result: SpawnSyncReturns<Buffer>): boolean => {
  const error: unknown = result.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
};

const lintStaged = run("pnpm", ["exec", "lint-staged"]);
if (lintStaged.status !== 0) {
  process.exit(lintStaged.status ?? 1);
}

const gitleaks = run("gitleaks", [
  "git",
  "--pre-commit",
  "--staged",
  "--redact",
  "--no-banner",
]);
if (isMissing(gitleaks)) {
  process.stderr.write(
    [
      "pre-commit: gitleaks が見つからないため、秘密の検査を飛ばしました。",
      "  コミットは続行します（CI と GitHub の Push Protection で検査されます）。",
      "  インストール：macOS は `brew install gitleaks`、",
      "  Windows は `winget install --id Gitleaks.Gitleaks --exact`。",
      "",
    ].join("\n"),
  );
  process.exit(0);
}
process.exit(gitleaks.status ?? 1);
