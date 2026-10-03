// eval のケースの作業場所を用意する共通の scaffold。各ケースの scaffold.sh が 1 行で呼ぶ（ADR 20261003-03）。
// 作業場所（カレントディレクトリ）に、ケースが前提にするファイルと git リポジトリを作る。
//
// 使い方：node evals/lib/scaffold.ts <作業場所の種類> [重ねるもの ...]
// 重ねるものは、共通の環境の名前（fixtures/<名前>/）か、ケースのフォルダの overlay/ のパス。
// 作業場所の用意のあと、書いた順に上書きで複製する（土台 → 共通の環境 → ケースの前提データ）
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { manifestVersion } from "../../scripts/lib/version.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const gitInit = (): void => {
  const run = spawnSync("git", ["init", "-q"], { encoding: "utf8" });
  if (run.status !== 0) {
    throw new Error(`git init に失敗しました：${run.stderr}`);
  }
  // 開発者の全体の設定がコミットの署名を求めていても、eval の作業場所では署名しない。
  // 署名の設定があると /onboard が署名の質問を足し、開発機ごとに質問の流れが変わるため
  const config = spawnSync("git", ["config", "commit.gpgsign", "false"], {
    encoding: "utf8",
  });
  if (config.status !== 0) {
    throw new Error(`git config に失敗しました：${config.stderr}`);
  }
};

const copyCompany = (): void => {
  cpSync(join(repoRoot, "fixtures", "company"), ".", {
    recursive: true,
  });
};

/** 作業場所の種類ごとの用意。ケースの scaffold.sh が名前で選ぶ */
const SCAFFOLDS: Record<string, () => void> = {
  /** 空の git リポジトリ（/onboard の初回） */
  "empty-repo": () => {
    gitInit();
  },
  /** 書き出しが済んだ初期化中の company（/onboard の再開と、導入の確定の確認） */
  "company-initializing": () => {
    copyCompany();
    const state = {
      state: "initializing",
      pluginVersion: manifestVersion(repoRoot),
    };
    writeFileSync(".business-os.json", `${JSON.stringify(state, null, 2)}\n`);
    gitInit();
  },
  /** 導入済み（state: active）の company。/onboard 以外の Skill の前提 */
  "company-active": () => {
    copyCompany();
    gitInit();
  },
};

/**
 * 重ねるものの指定を、実際のフォルダにする。
 * 絶対パスか、区切り（`/`、Windows では `\` も）を含めばケースのフォルダの overlay/ などのパス、
 * それ以外は共通の環境 fixtures/<名前>/ の名前とみなす
 */
const overlayDir = (spec: string): string =>
  isAbsolute(spec) || /[/\\]/.test(spec)
    ? resolve(spec)
    : join(repoRoot, "fixtures", spec);

const main = (): number => {
  const name = process.argv[2] ?? "";
  const scaffold = SCAFFOLDS[name];
  if (scaffold === undefined) {
    process.stderr.write(
      `使い方：node evals/lib/scaffold.ts <${Object.keys(SCAFFOLDS).join(" | ")}> [重ねるもの ...]\n`,
    );
    return 2;
  }
  const overlays = process.argv.slice(3).map(overlayDir);
  const missing = overlays.filter((dir) => !existsSync(dir));
  if (missing.length > 0) {
    process.stderr.write(`重ねるものがありません：${missing.join("、")}\n`);
    return 2;
  }
  scaffold();
  for (const dir of overlays) cpSync(dir, ".", { recursive: true });
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
