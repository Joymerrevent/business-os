// Skill の動作の検証（claude plugin eval のケース）の入口。pnpm eval:cases が呼ぶ。
//
// claude plugin eval は、ケースのフォルダ（evals/）が Plugin のルートの中にあることを求める（`..` も絶対パスも受け付けない）。
// business-os は配布物を plugin/ に閉じ、evals/ と fixtures/ をその外に置くので（ADR 20261009-02）、
// 一時フォルダに「配布物 + evals/ + fixtures/」を集めた Plugin を組み立て、それを対象に実行する。
// 結果（aggregate-result.json と report.html）はリポジトリの evals/results/<時刻>/ に置く。
//
// 終了コード：claude plugin eval のもの（0 合格、1 不合格）。ただし Plugin が読み込まれなかった実行（結果の suite.plugins が空）は、
// 点数が合格でも 1 にする（Skill の無い素のモデルの結果で通さない）。組み立てや起動の失敗は 2。
//
// 使い方：node evals/lib/cases/run.ts [claude plugin eval の引数 ...]（例：--case validate-start）
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

/** 一時的な Plugin に集めるもの（配布物の中身と、検証に要る開発物） */
const PLUGIN_DIR = "plugin";
const EVAL_PARTS = ["evals", "fixtures"] as const;

/**
 * 配布物（plugin/ の中身）を dest の直下に、evals/ と fixtures/ をその下に複製して、claude plugin eval の対象になる Plugin を組み立てる。
 * evals/results/（過去の実行の記録）は複製しない
 */
export const assemblePlugin = (root: string, dest: string): void => {
  const plugin = join(root, PLUGIN_DIR);
  if (!existsSync(join(plugin, ".claude-plugin", "plugin.json"))) {
    throw new Error(`配布物の Plugin がありません：${plugin}`);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(plugin, dest, { recursive: true });
  for (const part of EVAL_PARTS) {
    cpSync(join(root, part), join(dest, part), {
      recursive: true,
      filter: (source) =>
        !(
          basename(source) === "results" &&
          dirname(source) === join(root, "evals")
        ),
    });
  }
};

/** 実行の結果（aggregate-result.json）で、Plugin が読み込まれていたか */
export const pluginLoaded = (aggregatePath: string): boolean => {
  if (!existsSync(aggregatePath)) return false;
  const data = JSON.parse(readFileSync(aggregatePath, "utf8")) as {
    suite?: { plugins?: unknown };
  };
  const plugins = data.suite?.plugins;
  return Array.isArray(plugins) && plugins.length > 0;
};

const main = (): number => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsDir = join(repoRoot, "evals", "results", stamp);
  const dest = mkdtempSync(join(tmpdir(), "business-os-plugin-eval-"));
  try {
    assemblePlugin(repoRoot, dest);
    mkdirSync(resultsDir, { recursive: true });
    const run = spawnSync(
      "claude",
      [
        "plugin",
        "eval",
        dest,
        "--ablation",
        "none",
        "--runs",
        "1",
        "--scaffold",
        "--allow-tools",
        "Write",
        "Edit",
        "--trust-plugin",
        "--no-publish",
        "--output-dir",
        resultsDir,
        "--report",
        join(resultsDir, "report.html"),
        ...process.argv.slice(2),
      ],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    if (run.error !== undefined) {
      process.stderr.write(`claude を起動できません：${run.error.message}\n`);
      return 2;
    }
    const status = run.status ?? 2;
    process.stdout.write(`記録：${resultsDir}\n`);
    if (
      status <= 1 &&
      !pluginLoaded(join(resultsDir, "aggregate-result.json"))
    ) {
      process.stderr.write(
        "Plugin が読み込まれていません（結果の suite.plugins が空）。Skill の無い素のモデルの結果なので不合格にします\n",
      );
      return 1;
    }
    return status;
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
};

// テストから読み込んだときは動かさない
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(
      `検証を始められませんでした：${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  }
}
