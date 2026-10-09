// MCP の道具の判定。読むだけと分かる道具は通常の権限の判定に任せ、それ以外は確認（ask）に回す。
// 外部に影響が出る道具を名前で数え上げると、型に無い動詞の道具が確認なしで通る。
// 数え上げる側を「読むだけと分かる道具」にして、分からない道具を安全側（確認）に倒す（ADR 20261006-02）。
import type { Verdict } from "./rules.ts";

/** 読むだけと見なす、道具の名前の先頭の動詞。名前の末尾では判定しない（`mark_all_notifications_read` は書き換える） */
const READ_PREFIXES = ["get_", "list_", "search_", "read_"];

/** 名前の先頭の動詞では分からないが、読むだけと確かめた道具（公式の GitHub MCP サーバー v1.14.0 の README で確認） */
const READ_ONLY_TOOLS = new Set([
  "actions_get",
  "actions_list",
  "custom_properties_read",
  "github_support_docs_search",
  "issue_read",
  "projects_get",
  "projects_list",
  "pull_request_read",
  "repository_ruleset_read",
  "ui_get",
]);

export const isMcpTool = (toolName: string): boolean =>
  toolName.startsWith("mcp__");

/** `mcp__<サーバー>__<道具>` の道具の部分。形が崩れていれば undefined */
export const mcpToolPart = (toolName: string): string | undefined => {
  const parts = toolName.split("__");
  if (parts.length < 3 || parts[0] !== "mcp") return undefined;
  const tool = parts[parts.length - 1] ?? "";
  return tool === "" ? undefined : tool;
};

export const judgeMcp = (toolName: string): Verdict => {
  const tool = mcpToolPart(toolName);
  if (tool === undefined) {
    return {
      decision: "ask",
      reason: `MCP の道具の名前を読めません（${toolName}）。外部に影響が出るかもしれないので確認します`,
    };
  }
  if (READ_PREFIXES.some((prefix) => tool.startsWith(prefix))) return undefined;
  if (READ_ONLY_TOOLS.has(tool)) return undefined;
  return {
    decision: "ask",
    reason: `外部に影響が出るかもしれない MCP の道具です（${toolName}）`,
  };
};
