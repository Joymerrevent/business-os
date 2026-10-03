// eval のケースの作業場所を用意する共通の scaffold。各ケースの scaffold.sh が 1 行で呼ぶ（ADR 20261003-03）。
// 作業場所（カレントディレクトリ）に、ケースが前提にするファイルと git リポジトリを作る。
//
// 使い方：node evals/lib/scaffold.ts <作業場所の種類>
import { spawnSync } from "node:child_process";
import { cpSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { manifestVersion } from "../../scripts/lib/version.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const gitInit = (): void => {
  const run = spawnSync("git", ["init", "-q"], { encoding: "utf8" });
  if (run.status !== 0) {
    throw new Error(`git init に失敗しました：${run.stderr}`);
  }
};

/** 作業場所の種類ごとの用意。ケースの scaffold.sh が名前で選ぶ */
const SCAFFOLDS: Record<string, () => void> = {
  /** 空の git リポジトリ（/onboard の初回） */
  "empty-repo": () => {
    gitInit();
  },
  /** 書き出しが済んだ初期化中の company（/onboard の再開と、導入の確定の確認） */
  "company-initializing": () => {
    cpSync(join(repoRoot, "test", "fixtures", "company"), ".", {
      recursive: true,
    });
    const state = {
      state: "initializing",
      pluginVersion: manifestVersion(repoRoot),
    };
    writeFileSync(".business-os.json", `${JSON.stringify(state, null, 2)}\n`);
    gitInit();
  },
};

const main = (): number => {
  const name = process.argv[2] ?? "";
  const scaffold = SCAFFOLDS[name];
  if (scaffold === undefined) {
    process.stderr.write(
      `使い方：node evals/lib/scaffold.ts <${Object.keys(SCAFFOLDS).join(" | ")}>\n`,
    );
    return 2;
  }
  scaffold();
  return 0;
};

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    `scaffold が止まりました：${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
