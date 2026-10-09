// business-os（Plugin）自身の場所と情報。hook のファイルの位置から求める（環境変数に頼らない）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 配布物（Plugin）のルート（hooks/lib/ の 2 つ上）。利用者の環境では ${CLAUDE_PLUGIN_ROOT} と同じ場所 */
export const pluginRoot = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// 配布する Skill の一覧（分類ごと）。数は固定しない。足す・外すは Skill ごとに ADR で決め、ここに書く（ADR 20261004-02）。
// 一覧は点検の正本で、plugin/skills/ のフォルダと一致しなければ check:skills が fail にする。

/** 経営基盤 Skill：事業非依存で、会社を運営する以上必要な仕組み */
export const FOUNDATION_SKILLS = [
  "onboard",
  "approve",
  "check",
  "adr",
  "morning",
  "weekly-review",
  "close",
  "quarterly",
  "retro",
  "validate",
] as const;

/** 共通業務 Skill：事業非依存で、どの事業の利用者も日々行う業務の作業 */
export const COMMON_WORK_SKILLS: readonly string[] = [];

/** サポート Skill：事業の運営ではなく、business-os そのもの（導入・点検・報告など）を扱い、必要なときだけ呼ぶもの */
export const SUPPORT_SKILLS: readonly string[] = ["report"];

/** 配布する Skill の全て */
export const DISTRIBUTED_SKILLS: readonly string[] = [
  ...FOUNDATION_SKILLS,
  ...COMMON_WORK_SKILLS,
  ...SUPPORT_SKILLS,
];

export const pluginVersion = (): string => {
  const manifest = JSON.parse(
    readFileSync(join(pluginRoot(), ".claude-plugin", "plugin.json"), "utf8"),
  ) as { version?: unknown };
  if (typeof manifest.version !== "string") {
    throw new Error("plugin.json に version がありません");
  }
  return manifest.version;
};

/** フロントマターの JSON Schema */
export const frontmatterSchema = (): { [key: string]: unknown } =>
  JSON.parse(
    readFileSync(
      join(pluginRoot(), "templates", "frontmatter.schema.json"),
      "utf8",
    ),
  ) as { [key: string]: unknown };
