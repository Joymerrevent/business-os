// company の .claude/settings.json が、business-os の雛形（templates/settings.json.tmpl）の必須規則を含むかを確かめる。
// 必須規則の正典は雛形そのもの。ここに規則を書き写さない（写すと古くなるため）。
// .claude/settings.local.json は .claude/settings.json より優先されるため、sandbox の値の上書きもここで見る（ADR 20261003-11）。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginRoot } from "./plugin.ts";

type Settings = {
  sandbox?: {
    enabled?: unknown;
    allowUnsandboxedCommands?: unknown;
    excludedCommands?: unknown;
    filesystem?: { denyWrite?: unknown; denyRead?: unknown };
    network?: { allowUnixSockets?: unknown; allowAllUnixSockets?: unknown };
  };
  permissions?: { deny?: unknown; ask?: unknown };
};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

const readJson = (path: string): Settings => {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${path} の中身がオブジェクトではありません`);
  }
  return raw;
};

/** 雛形から必須規則を取り出す。MCP の ask 規則は /onboard が具体名に置き換えるため除く */
const requiredRules = (): Settings => {
  const template = readJson(
    join(pluginRoot(), "templates", "settings.json.tmpl"),
  );
  return {
    sandbox: {
      enabled: template.sandbox?.enabled,
      allowUnsandboxedCommands: template.sandbox?.allowUnsandboxedCommands,
      filesystem: {
        denyWrite: asStrings(template.sandbox?.filesystem?.denyWrite),
        denyRead: asStrings(template.sandbox?.filesystem?.denyRead),
      },
    },
    permissions: {
      deny: asStrings(template.permissions?.deny),
      ask: asStrings(template.permissions?.ask).filter(
        (rule) => !rule.startsWith("mcp__"),
      ),
    },
  };
};

/** 欠けている必須規則の説明を返す（空なら全てそろっている） */
export const missingRules = (root: string): string[] => {
  const path = join(root, ".claude", "settings.json");
  if (!existsSync(path)) return [".claude/settings.json がありません"];
  let actual: Settings;
  try {
    actual = readJson(path);
  } catch {
    return [".claude/settings.json を読めません"];
  }
  const required = requiredRules();
  const missing: string[] = [];
  if (actual.sandbox?.enabled !== required.sandbox?.enabled) {
    missing.push(
      `sandbox.enabled が ${String(required.sandbox?.enabled)} ではありません`,
    );
  }
  if (
    actual.sandbox?.allowUnsandboxedCommands !==
    required.sandbox?.allowUnsandboxedCommands
  ) {
    missing.push(
      `sandbox.allowUnsandboxedCommands が ${String(required.sandbox?.allowUnsandboxedCommands)} ではありません`,
    );
  }
  const lists: [string, unknown, unknown][] = [
    [
      "sandbox.filesystem.denyWrite",
      actual.sandbox?.filesystem?.denyWrite,
      required.sandbox?.filesystem?.denyWrite,
    ],
    [
      "sandbox.filesystem.denyRead",
      actual.sandbox?.filesystem?.denyRead,
      required.sandbox?.filesystem?.denyRead,
    ],
    ["permissions.deny", actual.permissions?.deny, required.permissions?.deny],
    ["permissions.ask", actual.permissions?.ask, required.permissions?.ask],
  ];
  for (const [label, have, need] of lists) {
    const present = new Set(asStrings(have));
    for (const rule of asStrings(need)) {
      if (!present.has(rule)) missing.push(`${label} に ${rule} がありません`);
    }
  }
  return [...missing, ...localOverrides(root, required)];
};

const LOCAL = ".claude/settings.local.json";

/** .claude/settings.local.json を読む。無ければ undefined、読めなければ例外 */
const readLocal = (root: string): Settings | undefined => {
  const path = join(root, ".claude", "settings.local.json");
  return existsSync(path) ? readJson(path) : undefined;
};

/** .claude/settings.local.json が sandbox の必須の値を上書きしていないか */
const localOverrides = (root: string, required: Settings): string[] => {
  let local: Settings | undefined;
  try {
    local = readLocal(root);
  } catch {
    return [`${LOCAL} を読めません`];
  }
  if (local === undefined) return [];
  const missing: string[] = [];
  for (const key of ["enabled", "allowUnsandboxedCommands"] as const) {
    const value = local.sandbox?.[key];
    if (value !== undefined && value !== required.sandbox?.[key]) {
      missing.push(
        `${LOCAL} が sandbox.${key} を ${JSON.stringify(value)} に上書きしています`,
      );
    }
  }
  return missing;
};

/**
 * .claude/settings.local.json の、sandbox を広く緩める設定（warn に使う）。
 * 読めないときは missingRules が欠落として扱うので、ここでは何も返さない
 */
export const localWarnings = (root: string): string[] => {
  let local: Settings | undefined;
  try {
    local = readLocal(root);
  } catch {
    return [];
  }
  const warnings: string[] = [];
  if (local?.sandbox?.network?.allowAllUnixSockets === true) {
    warnings.push(
      `${LOCAL} が sandbox.network.allowAllUnixSockets を有効にしています。sandbox の中から全ての Unix ソケットに接続できます`,
    );
  }
  const excluded = asStrings(local?.sandbox?.excludedCommands);
  if (excluded.length > 0) {
    warnings.push(
      `${LOCAL} の sandbox.excludedCommands にあるコマンドは sandbox の外で動きます：${excluded.join(", ")}`,
    );
  }
  return warnings;
};

/** .claude/settings.local.json で接続を許した Unix ソケットのパス（/check が示す） */
export const allowedSockets = (root: string): string[] => {
  try {
    return asStrings(readLocal(root)?.sandbox?.network?.allowUnixSockets);
  } catch {
    return [];
  }
};
