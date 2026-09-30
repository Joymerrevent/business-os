// company の .claude/settings.json が、器の雛形（templates/settings.json.tmpl）の必須規則を含むかを確かめる。
// 必須規則の正典は雛形そのもの。ここに規則を書き写さない（写すと古くなるため）。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginRoot } from "./plugin.ts";

type Settings = {
  sandbox?: {
    enabled?: unknown;
    allowUnsandboxedCommands?: unknown;
    filesystem?: { denyWrite?: unknown; denyRead?: unknown };
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
  return missing;
};
