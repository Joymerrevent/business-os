// 器の版。正典は package.json（changesets が更新する）。plugin.json の version は利用者に更新を届ける合図になる。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const readVersion = (path: string): string => {
  const data = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown };
  if (typeof data.version !== "string" || !SEMVER.test(data.version)) {
    throw new Error(
      `${path} の version が semver ではありません：${String(data.version)}`,
    );
  }
  return data.version;
};

export const packageVersion = (root: string): string =>
  readVersion(join(root, "package.json"));

export const manifestVersion = (root: string): string =>
  readVersion(join(root, ".claude-plugin", "plugin.json"));

/** package.json の version を .claude-plugin/plugin.json に写し、写した版を返す */
export const syncPluginVersion = (root: string): string => {
  const version = packageVersion(root);
  const path = join(root, ".claude-plugin", "plugin.json");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  manifest["version"] = version;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return version;
};
