// 版の同期（scripts/lib/version.ts）と、版の一致の検査のテスト。
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkVersion } from "../../scripts/lib/repo-checks.ts";
import { syncPluginVersion } from "../../scripts/lib/version.ts";

let root = "";
const write = (pkg: string, manifest: string) => {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "business-os", version: pkg }),
  );
  writeFileSync(
    join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "business-os",
      version: manifest,
      description: "x",
    }),
  );
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "business-os-version-"));
  mkdirSync(join(root, ".claude-plugin"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("syncPluginVersion", () => {
  it("package.json の版を plugin.json に写し、ほかの欄は保つ", () => {
    write("0.1.0", "0.0.0");
    expect(syncPluginVersion(root)).toBe("0.1.0");
    const manifest = JSON.parse(
      readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(manifest).toEqual({
      name: "business-os",
      version: "0.1.0",
      description: "x",
    });
  });

  it("semver でない版は例外", () => {
    write("next", "0.0.0");
    expect(() => syncPluginVersion(root)).toThrow("semver");
  });
});

describe("checkVersion", () => {
  it("一致していれば pass、食い違えば fail", () => {
    write("0.1.0", "0.1.0");
    expect(checkVersion(root)[0]?.level).toBe("pass");
    write("0.1.0", "0.0.0");
    expect(checkVersion(root)[0]?.level).toBe("fail");
  });
});
