// 雛形の permissions.ask の MCP の規則（hook が動かなかったときの予備）が、外部に影響が出る道具を拾い、
// 読む道具を拾わないことを確かめる。道具の名前は、公式の GitHub MCP サーバー v1.14.0 の README と、
// claude.ai の Gmail のコネクタの道具の一覧（2026-10-06 時点）から写した。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../helpers.ts";

const askRules = (): string[] => {
  const text = readFileSync(
    join(repoRoot, "templates", "settings.json.tmpl"),
    "utf8",
  );
  const settings = JSON.parse(text) as { permissions: { ask: string[] } };
  return settings.permissions.ask.filter((rule) => rule.startsWith("mcp__"));
};

/** 規則のワイルドカード（*）だけを解釈し、名前全体に合うかを見る */
const matches = (rule: string, tool: string): boolean => {
  const pattern = rule
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${pattern}$`).test(tool);
};

const asked = (tool: string): boolean =>
  askRules().some((rule) => matches(rule, tool));

const GITHUB_WRITE = [
  "actions_run_trigger",
  "add_comment_to_pending_review",
  "add_issue_comment",
  "add_reply_to_pull_request_comment",
  "assign_copilot_to_issue",
  "assign_copilot_to_issue_with_intent",
  "create_branch",
  "create_gist",
  "create_or_update_file",
  "create_pull_request",
  "create_pull_request_with_copilot",
  "create_repository",
  "create_repository_ruleset",
  "custom_properties_write",
  "delete_file",
  "delete_repository",
  "discussion_comment_write",
  "dismiss_notification",
  "fork_repository",
  "issue_write",
  "label_write",
  "manage_notification_subscription",
  "manage_repository_notification_subscription",
  "mark_all_notifications_read",
  "merge_pull_request",
  "projects_write",
  "pull_request_review_write",
  "push_files",
  "request_copilot_review",
  "star_repository",
  "sub_issue_write",
  "unstar_repository",
  "update_gist",
  "update_issue_comment",
  "update_pull_request",
  "update_pull_request_branch",
];

const GITHUB_READ = [
  "actions_get",
  "actions_list",
  "custom_properties_read",
  "get_commit",
  "get_file_contents",
  "get_me",
  "github_support_docs_search",
  "issue_read",
  "list_issues",
  "list_starred_repositories",
  "projects_get",
  "projects_list",
  "pull_request_read",
  "repository_ruleset_read",
  "search_code",
  "search_issues",
  "ui_get",
];

const GMAIL_WRITE = [
  "apply_sensitive_message_label",
  "apply_sensitive_thread_label",
  "create_draft",
  "create_label",
  "delete_draft",
  "delete_label",
  "forward",
  "label_message",
  "label_thread",
  "mark_message_spam",
  "mark_thread_spam",
  "reply",
  "send_message",
  "trash_message",
  "trash_thread",
  "unlabel_message",
  "unlabel_thread",
  "unmark_message_spam",
  "unmark_thread_spam",
  "untrash_message",
  "untrash_thread",
  "update_draft",
  "update_label",
  "update_message_labels",
];

const GMAIL_READ = [
  "get_draft",
  "get_message",
  "get_thread",
  "list_drafts",
  "list_labels",
  "search_threads",
];

describe("雛形の MCP の ask の規則（予備）", () => {
  it.each(GITHUB_WRITE)("GitHub MCP の %s を拾う", (tool) => {
    expect(asked(`mcp__github__${tool}`)).toBe(true);
  });

  it.each(GMAIL_WRITE)("Gmail のコネクタの %s を拾う", (tool) => {
    expect(asked(`mcp__claude_ai_Gmail__${tool}`)).toBe(true);
  });

  it.each([
    ...GITHUB_READ.map((t) => `mcp__github__${t}`),
    ...GMAIL_READ.map((t) => `mcp__claude_ai_Gmail__${t}`),
  ])("読む道具 %s は拾わない", (tool) => {
    expect(asked(tool)).toBe(false);
  });
});
