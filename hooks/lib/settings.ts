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

/**
 * 雛形の MCP の ask の規則（hook が時間切れで通ったときの予備）のうち、.claude/settings.json に無いもの（warn に使う）。
 * 必須規則（missingRules）には含めない。含めると、足していない company が厳格モードになり、保護対象への書き込みが全て止まるため。
 * 読めないときは missingRules が欠落として扱うので、ここでは何も返さない
 */
export const missingMcpAskRules = (root: string): string[] => {
  const path = join(root, ".claude", "settings.json");
  let actual: Settings;
  try {
    actual = readJson(path);
  } catch {
    return [];
  }
  const template = readJson(
    join(pluginRoot(), "templates", "settings.json.tmpl"),
  );
  const present = new Set(asStrings(actual.permissions?.ask));
  return asStrings(template.permissions?.ask).filter(
    (rule) => rule.startsWith("mcp__") && !present.has(rule),
  );
};

/**
 * 雛形の env（Node のプロキシ、npm のキャッシュの置き場など）のうち、.claude/settings.json に無いか値が違うもの（warn に使う）。
 * 無くても安全は損なわれず、通信の失敗が見えにくくなるだけなので、必須規則（厳格モード）には含めない（ADR 20261006-01）。
 * 読めないときは missingRules が欠落として扱うので、ここでは何も返さない
 */
export const missingEnv = (root: string): string[] => {
  let actual: { env?: unknown };
  try {
    actual = readJson(join(root, ".claude", "settings.json")) as {
      env?: unknown;
    };
  } catch {
    return [];
  }
  const template = readJson(
    join(pluginRoot(), "templates", "settings.json.tmpl"),
  ) as { env?: unknown };
  const asRecord = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const have = asRecord(actual.env);
  return Object.entries(asRecord(template.env))
    .filter(([key, value]) => have[key] !== value)
    .map(([key, value]) => `${key}=${String(value)}`);
};

/** .claude/settings.local.json で接続を許した Unix ソケットのパス（/check が示す） */
export const allowedSockets = (root: string): string[] => {
  try {
    return asStrings(readLocal(root)?.sandbox?.network?.allowUnixSockets);
  } catch {
    return [];
  }
};
