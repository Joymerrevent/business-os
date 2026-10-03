// business-os の版。正典は package.json（changesets が更新する）。plugin.json の version は利用者に更新を届ける合図になる。
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

/**
 * SemVer の版を比べる。a < b なら負、a = b なら 0、a > b なら正。
 * 接尾辞（`-beta.0` など）の付いた版は、付いていない同じ版より小さい。接尾辞どうしは「.」で区切った識別子ごとに比べる
 */
export const compareVersions = (a: string, b: string): number => {
  const [coreA = "", preA] = a.split(/-(.*)/s);
  const [coreB = "", preB] = b.split(/-(.*)/s);
  const numsA = coreA.split(".").map(Number);
  const numsB = coreB.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (numsA[i] ?? 0) - (numsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (preA === undefined || preB === undefined) {
    if (preA === preB) return 0;
    return preA === undefined ? 1 : -1;
  }
  const idsA = preA.split(".");
  const idsB = preB.split(".");
  for (let i = 0; i < Math.max(idsA.length, idsB.length); i += 1) {
    const x = idsA[i];
    const y = idsB[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x) ? Number(x) : undefined;
    const ny = /^\d+$/.test(y) ? Number(y) : undefined;
    if (nx !== undefined && ny !== undefined) {
      if (nx !== ny) return nx - ny;
    } else if (nx !== undefined) return -1;
    else if (ny !== undefined) return 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};
