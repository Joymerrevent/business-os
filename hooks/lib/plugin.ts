// business-os（Plugin）自身の場所と情報。hook のファイルの位置から求める（環境変数に頼らない）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** business-os のルート（hooks/lib/ の 2 つ上） */
export const pluginRoot = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** business-os の Skill（10 個、固定）。追加・削除は ADR で決める */
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
