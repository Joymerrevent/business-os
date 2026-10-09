// business-os のリポジトリ（開発物）の場所。配布物のフォルダ plugin/ の親（ADR 20261009-02）。
// 利用者の環境には plugin/ だけが写るので、ここを使うのは開発でだけ動く検査とスクリプトに限る。
import { join } from "node:path";
import { pluginRoot } from "../../hooks/lib/plugin.ts";

/** リポジトリのルート（plugin/ の 1 つ上） */
export const repoRoot = (): string => join(pluginRoot(), "..");
