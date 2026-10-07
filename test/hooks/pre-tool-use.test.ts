// PreToolUse hook の fail-closed テスト。合成した入力で deny（exit 2）/ ask / allow を確かめる。
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decisionOf,
  makeCompany,
  makePlainDir,
  runHook,
  setState,
  toolInput,
  validDoc,
} from "../helpers.ts";

let root = "";
let cleanup = (): void => {};

const write = (rel: string, content: string) =>
  decisionOf(
    runHook(
      "pre-tool-use",
      toolInput(root, "Write", { file_path: join(root, rel), content }),
    ),
  );
const edit = (rel: string, oldString: string, newString: string) =>
  decisionOf(
    runHook(
      "pre-tool-use",
      toolInput(root, "Edit", {
        file_path: join(root, rel),
        old_string: oldString,
        new_string: newString,
      }),
    ),
  );
const bash = (command: string, tool = "Bash") =>
  decisionOf(runHook("pre-tool-use", toolInput(root, tool, { command })));

afterEach(() => cleanup());

describe("company ではないディレクトリ（対象外）", () => {
  beforeEach(() => ({ root, cleanup } = makePlainDir()));

  it("何も判定せず無言で通す", () => {
    const result = runHook(
      "pre-tool-use",
      toolInput(root, "Write", {
        file_path: join(root, "docs/charter/company.md"),
        content: "x",
      }),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(bash("git push --force")).toBe("allow");
  });

  it("ログを書かない", () => {
    write("docs/x.md", "x");
    expect(existsSync(join(root, ".claude"))).toBe(false);
  });
});

describe("初期化中（state: initializing）", () => {
  beforeEach(() => {
    ({ root, cleanup } = makeCompany());
    setState(root, "initializing");
  });

  it("保護対象の新規作成は確認なしで通す", () => {
    expect(write("docs/charter/businesses/biz-c.md", validDoc("charter"))).toBe(
      "allow",
    );
    rmSync(join(root, "CLAUDE.md"));
    expect(write("CLAUDE.md", "# 地図\n")).toBe("allow");
  });

  it("既存の保護対象の上書きは ask（active への切り替えを含む）", () => {
    expect(write("CLAUDE.md", "# 地図\n")).toBe("ask");
    expect(write(".claude/settings.json", "{}")).toBe("ask");
    expect(write(".business-os.json", "{}")).toBe("ask");
    const content = readFileSync(join(root, "docs/charter/company.md"), "utf8");
    expect(write("docs/charter/company.md", content)).toBe("ask");
  });

  it("settings.local.json は、新規作成なら通し、上書きなら ask", () => {
    expect(write(".claude/settings.local.json", "{}")).toBe("allow");
    writeFileSync(join(root, ".claude/settings.local.json"), "{}");
    expect(write(".claude/settings.local.json", "{}")).toBe("ask");
  });

  it("新規作成でもフロントマターが規約に合わなければ拒否", () => {
    expect(write("docs/charter/businesses/biz-c.md", "# 本文だけ\n")).toBe(
      "deny",
    );
  });

  it("フロントマター検査は有効", () => {
    expect(write("docs/knowledge/x.md", "# 本文だけ\n")).toBe("deny");
    expect(write("docs/knowledge/x.md", validDoc())).toBe("allow");
  });

  it("Bash の解析は有効", () => {
    expect(bash("git push --force")).toBe("deny");
    expect(bash("rm -rf docs")).toBe("ask");
  });
});

describe("運用中（state: active）の保護対象", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it("approving の提案が target にしているファイルは通す", () => {
    const content = readFileSync(
      join(root, "docs/charter/company.md"),
      "utf8",
    ).replace("事業 A と事業 B を運営する", "事業 A を運営する");
    expect(write("docs/charter/company.md", content)).toBe("allow");
  });

  it("提案の無い憲章は拒否", () => {
    expect(
      write("docs/charter/repositories/README.md", validDoc("charter")),
    ).toBe("deny");
  });

  it("proposed（承認前）の提案では拒否", () => {
    expect(write("docs/charter/decision-rules.md", validDoc("charter"))).toBe(
      "deny",
    );
  });

  it("CLAUDE.md・settings.json・settings.local.json・.business-os.json は提案が無ければ拒否", () => {
    expect(write("CLAUDE.md", "# 地図\n")).toBe("deny");
    expect(write(".claude/settings.json", "{}")).toBe("deny");
    expect(write(".claude/settings.local.json", "{}")).toBe("deny");
    expect(write(".business-os.json", "{}")).toBe("deny");
  });

  it("大文字小文字を変えたパスでも拒否", () => {
    expect(
      write("Docs/Charter/repositories/README.md", validDoc("charter")),
    ).toBe("deny");
    expect(write("claude.md", "# 地図\n")).toBe("deny");
  });

  it("相対パスの寄り道（..）でも拒否", () => {
    expect(
      write(
        "docs/operations/../charter/repositories/README.md",
        validDoc("charter"),
      ),
    ).toBe("deny");
  });

  it("新規ファイルも提案が無ければ拒否", () => {
    expect(write("docs/charter/businesses/biz-c.md", validDoc("charter"))).toBe(
      "deny",
    );
  });

  it("実装リポの指示（charter/repositories/<リポ名>/）も提案が無ければ拒否", () => {
    expect(
      write(
        "docs/charter/repositories/biz-a-app/instructions.md",
        validDoc("charter"),
      ),
    ).toBe("deny");
  });

  it("実装リポのメモ（knowledge/repositories/<リポ名>/）は通す", () => {
    expect(
      write("docs/knowledge/repositories/biz-a-app/notes.md", validDoc()),
    ).toBe("allow");
  });

  it("company の外のファイルは判定しない", () => {
    const outside = makePlainDir();
    try {
      const result = runHook(
        "pre-tool-use",
        toolInput(root, "Write", {
          file_path: join(outside.root, "docs/charter/x.md"),
          content: "x",
        }),
      );
      expect(decisionOf(result)).toBe("allow");
    } finally {
      outside.cleanup();
    }
  });
});

describe("運用中のフロントマター検査", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it("正しいフロントマターは通す", () => {
    expect(
      write("docs/operations/daily/2026-10-01.md", validDoc("daily")),
    ).toBe("allow");
  });

  it("フロントマターが無い・欄の欠落・相対日付・空欄は拒否", () => {
    expect(write("docs/knowledge/x.md", "# 本文だけ\n")).toBe("deny");
    expect(
      write("docs/knowledge/x.md", validDoc().replace("verified: n/a\n", "")),
    ).toBe("deny");
    expect(
      write(
        "docs/knowledge/x.md",
        validDoc().replace("updated: 2026-10-01", "updated: 昨日"),
      ),
    ).toBe("deny");
    expect(
      write("docs/knowledge/x.md", validDoc().replace("as_of: n/a", "as_of:")),
    ).toBe("deny");
  });

  it("target が 2 ファイルの提案は拒否（1 件の提案につき 1 ファイル）", () => {
    const proposal = (target: string) =>
      [
        "---",
        "id: 20260930-01",
        "type: proposal",
        "business: portfolio",
        "status: proposed",
        `target: ${target}`,
        "created: 2026-09-30",
        "updated: 2026-09-30",
        "as_of: n/a",
        "verified: n/a",
        "---",
        "",
      ].join("\n");
    expect(
      write(
        "docs/proposals/20260930-01-x.md",
        proposal("docs/charter/a.md, docs/charter/b.md"),
      ),
    ).toBe("deny");
    expect(
      write("docs/proposals/20260930-01-x.md", proposal("docs/charter/a.md")),
    ).toBe("allow");
  });

  it("雛形の置き場（docs/_templates/）は検査しない", () => {
    expect(
      write(
        "docs/_templates/inbox-note.md",
        "---\ntype: inbox\ncreated: {{date:YYYY-MM-DD}}\n---\n# {{title}}\n",
      ),
    ).toBe("allow");
  });

  it("docs の外の Markdown は検査しない", () => {
    expect(write("notes.md", "# メモ\n")).toBe("allow");
  });

  it("既存ファイルの created を書き換えると拒否", () => {
    const path = "docs/operations/state/biz-a.md";
    const content = readFileSync(join(root, path), "utf8");
    expect(
      write(
        path,
        content.replace("created: 2026-09-28", "created: 2026-10-02"),
      ),
    ).toBe("deny");
  });

  it("Edit は編集後の内容で検査する", () => {
    const path = "docs/operations/state/biz-a.md";
    expect(
      edit(path, "まだ記録が無い\n\n## 待ち", "A を進めている\n\n## 待ち"),
    ).toBe("allow");
    expect(edit(path, "verified: n/a\n", "")).toBe("deny");
    expect(edit(path, "created: 2026-09-28", "created: 2026-09-01")).toBe(
      "deny",
    );
  });

  it("Edit の組み立てに失敗し、old_string がフロントマターに触れていれば ask", () => {
    const path = "docs/operations/state/biz-a.md";
    expect(edit(path, "status: paused\ncreated: 2026-09-28", "x")).toBe("ask");
  });

  it("Edit の組み立てに失敗しても、本文だけなら通す（Edit 自体が失敗する）", () => {
    const path = "docs/operations/state/biz-a.md";
    expect(edit(path, "存在しない本文", "x")).toBe("allow");
  });
});

describe("Bash の解析（拒否）", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it.each([
    "git push -f origin main",
    "git push origin main -f",
    "git push origin +main",
    "git push --force",
    "git push --force-with-lease",
    "git push --force-with-lease=main:abc123",
    "git push --force-if-includes",
    "git push -uf origin main",
    "git -C . push -f",
    "git -c core.editor=true push --force",
    "git push --no-verify",
    "git commit --no-verify -m x",
    "git commit -nm x",
    'sh -c "git push -f"',
    "bash -c 'git push --force'",
    "zsh -c 'git push origin +main'",
    "eval git push --force",
    "git status && git push --force",
    "git status; git push -f",
    "echo $(git push -f)",
    "echo `git push -f`",
    "FOO=1 git push -f",
    "env FOO=1 git push -f",
    "sudo git push -f",
    "sh -c 'bash -c \"git push -f\"'",
  ])("%s は拒否", (command) => {
    expect(bash(command)).toBe("deny");
  });

  it.each([
    "git push",
    "git push origin main",
    "git push -u origin feature",
    'echo "git push -f"',
    "git commit -m 'no --force here'",
    "git log --format=+%H",
    "git status",
  ])("%s は通す", (command) => {
    expect(bash(command)).toBe("allow");
  });
});

describe("Bash の解析（確認）", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it.each([
    "rm -rf docs/knowledge",
    "rm -r docs/knowledge",
    "rm -R docs/knowledge",
    "rm --recursive docs/knowledge",
    "rm -fr docs",
    "git reset --hard",
    "git reset --hard HEAD~1",
    "git clean -f",
    "git clean -fd",
    "git clean -xdf",
    "git clean --force",
    "git branch -D feature",
    "sh -c 'rm -rf x'",
  ])("%s は ask", (command) => {
    expect(bash(command)).toBe("ask");
  });

  it.each([
    "rm x.md",
    "git reset --soft HEAD~1",
    "git clean -n",
    "git branch -d x",
  ])("%s は通す", (command) => {
    expect(bash(command)).toBe("allow");
  });

  it("拒否と確認が混ざれば拒否", () => {
    expect(bash("rm -rf x && git push -f")).toBe("deny");
  });
});

describe("MCP の道具", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  const mcp = (tool: string) =>
    decisionOf(runHook("pre-tool-use", toolInput(root, tool, {})));

  it.each([
    "mcp__github__issue_write",
    "mcp__github__merge_pull_request",
    "mcp__github__delete_repository",
    "mcp__github__push_files",
    "mcp__github__add_issue_comment",
    "mcp__github__mark_all_notifications_read",
    "mcp__claude_ai_Gmail__reply",
    "mcp__claude_ai_Gmail__forward",
    "mcp__claude_ai_Gmail__send_message",
    "mcp__some_server__do_something",
    "mcp__broken",
    "mcp__server__",
  ])("%s は ask（読むだけと分からない道具）", (tool) => {
    expect(mcp(tool)).toBe("ask");
  });

  it.each([
    "mcp__github__get_file_contents",
    "mcp__github__list_issues",
    "mcp__github__search_code",
    "mcp__github__issue_read",
    "mcp__github__pull_request_read",
    "mcp__claude_ai_Gmail__search_threads",
    "mcp__claude_ai_Gmail__get_thread",
    "mcp__plugin_x_db__read_rows",
  ])("%s は通す（読むだけと分かる道具）", (tool) => {
    expect(mcp(tool)).toBe("allow");
  });

  it("確認の理由に道具の名前を示す", () => {
    const result = runHook(
      "pre-tool-use",
      toolInput(root, "mcp__github__issue_write", {}),
    );
    expect(result.stdout).toContain("mcp__github__issue_write");
  });
});

describe("MCP の道具（company ではないディレクトリ）", () => {
  beforeEach(() => ({ root, cleanup } = makePlainDir()));

  it("判定せず無言で通す", () => {
    const result = runHook(
      "pre-tool-use",
      toolInput(root, "mcp__github__issue_write", {}),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("シェルで docs/ の文書を書き換える操作", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it.each([
    "sed -i '' 's/a/b/' docs/operations/risks.md",
    "sed -i.bak -e 's/a/b/' docs/operations/risks.md",
    "perl -pi -e 's/a/b/' docs/operations/risks.md",
    "echo x > docs/knowledge/x.md",
    "echo x >> docs/operations/daily/2026-09-30.md",
    "cat > docs/knowledge/x.md <<'EOF'\n本文\nEOF",
    "echo x | tee docs/knowledge/x.md",
    // cd による移動は追わない（既知の限界。書いた後の違反は /check が拾う）
    "echo x > ./docs/knowledge/x.md",
    "sh -c 'echo x > docs/knowledge/x.md'",
  ])("%s は ask", (command) => {
    expect(bash(command)).toBe("ask");
  });

  it.each([
    "echo x > /tmp/x.md",
    "ls 2>/dev/null",
    "echo x >&2",
    "cat docs/operations/risks.md",
    "sed 's/a/b/' docs/operations/risks.md",
    "echo x > notes.md",
    "git diff > $TMPDIR/diff.txt",
  ])("%s は通す", (command) => {
    expect(bash(command)).toBe("allow");
  });

  it.each([
    "Set-Content -Path docs/knowledge/x.md -Value x",
    "'x' | Out-File docs/knowledge/x.md",
    "'x' > docs/knowledge/x.md",
    "Add-Content docs/operations/risks.md 'x'",
  ])("PowerShell：%s は ask", (command) => {
    expect(bash(command, "PowerShell")).toBe("ask");
  });

  it("PowerShell：2>$null は通す", () => {
    expect(bash("git status 2>$null", "PowerShell")).toBe("allow");
  });
});

describe("PowerShell の解析", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it.each([
    "git push -f",
    "git push origin +main",
    'pwsh -Command "git push --force"',
    'powershell -c "git push -f"',
    "Invoke-Expression 'git push -f'",
    "iex 'git push --force'",
    "git status; git push -f",
  ])("%s は拒否", (command) => {
    expect(bash(command, "PowerShell")).toBe("deny");
  });

  it.each([
    "Remove-Item -Recurse -Force docs",
    "Remove-Item docs -r",
    "rm -Recurse docs",
    "ri -rec docs",
    "del docs -Recurse",
  ])("%s は ask", (command) => {
    expect(bash(command, "PowerShell")).toBe("ask");
  });

  it.each([
    "Remove-Item x.md",
    "git push origin main",
    "Get-ChildItem -Recurse",
  ])("%s は通す", (command) => {
    expect(bash(command, "PowerShell")).toBe("allow");
  });
});

describe("厳格モード", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it("settings.json の必須規則が欠けると、提案があっても保護対象を拒否", () => {
    const settingsPath = join(root, ".claude/settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      sandbox: { enabled: boolean };
    };
    settings.sandbox.enabled = false;
    writeFileSync(settingsPath, JSON.stringify(settings));
    const content = readFileSync(join(root, "docs/charter/company.md"), "utf8");
    const result = runHook(
      "pre-tool-use",
      toolInput(root, "Write", {
        file_path: join(root, "docs/charter/company.md"),
        content,
      }),
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("防衛設定");
    // 保護対象以外は通常どおり
    expect(write("docs/knowledge/x.md", validDoc())).toBe("allow");
  });

  it("settings.json が無ければ厳格モード", () => {
    writeFileSync(join(root, ".claude/settings.json"), "");
    const content = readFileSync(join(root, "docs/charter/company.md"), "utf8");
    expect(write("docs/charter/company.md", content)).toBe("deny");
  });

  it("settings.local.json が sandbox を無効にすると厳格モード", () => {
    writeFileSync(
      join(root, ".claude/settings.local.json"),
      JSON.stringify({ sandbox: { enabled: false } }),
    );
    const content = readFileSync(join(root, "docs/charter/company.md"), "utf8");
    expect(write("docs/charter/company.md", content)).toBe("deny");
  });

  it("settings.local.json が逃げ道を開けると厳格モード", () => {
    writeFileSync(
      join(root, ".claude/settings.local.json"),
      JSON.stringify({ sandbox: { allowUnsandboxedCommands: true } }),
    );
    const content = readFileSync(join(root, "docs/charter/company.md"), "utf8");
    expect(write("docs/charter/company.md", content)).toBe("deny");
  });

  it("settings.local.json を読めなければ厳格モード", () => {
    writeFileSync(join(root, ".claude/settings.local.json"), "{");
    const content = readFileSync(join(root, "docs/charter/company.md"), "utf8");
    expect(write("docs/charter/company.md", content)).toBe("deny");
  });

  it("settings.local.json が雛形と同じ値やソケットの許可だけなら厳格モードにならない", () => {
    writeFileSync(
      join(root, ".claude/settings.local.json"),
      JSON.stringify({
        sandbox: {
          enabled: true,
          network: { allowUnixSockets: ["~/agent.sock"] },
        },
      }),
    );
    // 厳格モードなら deny になるところ、approving の提案がある憲章は通る
    const content = readFileSync(
      join(root, "docs/charter/company.md"),
      "utf8",
    ).replace("事業 A と事業 B を運営する", "事業 A を運営する");
    expect(write("docs/charter/company.md", content)).toBe("allow");
  });

  it("初期化中は厳格モードにならない", () => {
    setState(root, "initializing");
    writeFileSync(join(root, ".claude/settings.json"), "{}");
    // 厳格モードなら deny になるところ、初期化中は通常どおり（新規は allow、上書きは ask）
    expect(write("docs/charter/businesses/biz-c.md", validDoc("charter"))).toBe(
      "allow",
    );
    const content = readFileSync(join(root, "docs/charter/company.md"), "utf8");
    expect(write("docs/charter/company.md", content)).toBe("ask");
  });
});

describe("hook 自身の例外（fail-closed）", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it("例外を注入すると exit 2", () => {
    const result = runHook(
      "pre-tool-use",
      toolInput(root, "Write", {
        file_path: join(root, "docs/knowledge/x.md"),
        content: validDoc(),
      }),
      { BUSINESS_OS_HOOK_FAULT: "1" },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("business-os");
  });

  it("壊れた JSON を渡すと exit 2", () => {
    expect(runHook("pre-tool-use", "{not json").status).toBe(2);
  });

  it("空の入力は exit 2", () => {
    expect(runHook("pre-tool-use", "").status).toBe(2);
  });

  it("壊れた .business-os.json は exit 2", () => {
    writeFileSync(join(root, ".business-os.json"), "{broken");
    expect(write("docs/knowledge/x.md", validDoc())).toBe("deny");
  });

  it("未知の state は exit 2", () => {
    setState(root, "paused");
    expect(write("docs/knowledge/x.md", validDoc())).toBe("deny");
  });

  it("file_path が無い書き込みは exit 2", () => {
    const result = runHook(
      "pre-tool-use",
      toolInput(root, "Write", { content: "x" }),
    );
    expect(result.status).toBe(2);
  });
});

describe("ログ", () => {
  beforeEach(() => ({ root, cleanup } = makeCompany()));

  it("作業者（サブエージェント）からの呼び出しは、呼び出し元を記録する", () => {
    runHook("pre-tool-use", {
      ...toolInput(root, "Write", {
        file_path: join(root, "docs/knowledge/x.md"),
        content: "# 本文だけ\n",
      }),
      agent_type: "business-os:worker",
    });
    const file = readdirSync(join(root, ".claude")).find((f) =>
      f.startsWith("hook-log-"),
    );
    const entry = JSON.parse(
      readFileSync(join(root, ".claude", file ?? ""), "utf8")
        .trim()
        .split("\n")[0] ?? "{}",
    ) as { decision: string; agent?: string };
    expect(entry.decision).toBe("deny");
    expect(entry.agent).toBe("business-os:worker");
  });

  it("判定を月次のファイルに 1 行ずつ記録する", () => {
    write("docs/charter/repositories/README.md", validDoc("charter"));
    bash("git status");
    const files = readdirSync(join(root, ".claude")).filter((f) =>
      /^hook-log-\d{6}\.jsonl$/.test(f),
    );
    expect(files).toHaveLength(1);
    const lines = readFileSync(join(root, ".claude", files[0] ?? ""), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { decision: string; tool: string });
    expect(lines).toHaveLength(2);
    expect(lines[0]?.decision).toBe("deny");
    expect(lines[1]?.decision).toBe("allow");
  });
});
