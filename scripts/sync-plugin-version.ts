// package.json の version を .claude-plugin/plugin.json に写す。/release で changeset version の後に呼ぶ。
//
// 使い方：node scripts/sync-plugin-version.ts
import { pluginRoot } from "../hooks/lib/plugin.ts";
import { syncPluginVersion } from "./lib/version.ts";

try {
  const version = syncPluginVersion(pluginRoot());
  process.stdout.write(`plugin.json の version を ${version} にしました\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
