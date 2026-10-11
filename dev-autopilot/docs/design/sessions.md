---
status: draft
created: 2026-10-11
updated: 2026-10-11
source: ../dev-autopilot-requirements.md
---

# AI のセッションの起動

進行役が `claude -p` を起動する方法を定める。値は 0b（2026-10-11）の実機確認に基づく（要件 12 節末の表の 8〜14・17）。

## 1. 起動の形

```text
cd <cwd>
env -i <env.passthrough の変数だけ> \
  claude -p \
    --output-format stream-json --verbose \
    --settings <paths.settings>/<role>.json \
    --setting-sources local \
    --plugin-dir <paths.devAutopilot>/plugin \
    --agent dev-autopilot:<role> \
    --model <models.<role>.model> --effort <models.<role>.effort> \
    --max-turns <limits.session.turns> --max-budget-usd <limits.session.usd> \
    --permission-prompts none --no-session-persistence \
    "<固定の指示文>"
```

| 要素 | 理由 | 根拠 |
| --- | --- | --- |
| `env -i` と許可した名前だけ | PAT と署名の鍵を子プロセスに渡さない。`HOME` `PATH` `USER` `LOGNAME` `TMPDIR` `TERM` `LANG` でログイン状態は保たれる | 6 節、0b の 17 |
| `--setting-sources local` | ユーザー設定とプロジェクト設定（hook・`CLAUDE.md`・`.mcp.json`）を読まない。`--settings` は効く | 6 節の (a)、0b の 11 |
| `--settings` のファイル | 進行役の置き場にあり AI が書けない。起動前にハッシュを確かめる | 6 節 |
| `--plugin-dir` の絶対パス | AI が書き換えた agent 定義と Skill を読まない | 10 節の 3 |
| `--model` と `--effort` | 設定の値。`--model` はエージェント定義の `model` より優先 | 4.11 節、0b の 8 |
| `--output-format stream-json` | イベントごとの `usage` と `model` を記録に残す。途中で止めても消費が分かる | R2-13、0b の 14 |
| `--permission-prompts none` | 承認の要る操作は拒否される。Bash は `permissions.allow` で許す | 0b の 9 |
| `--no-session-persistence` | セッションを残さない | — |
| 時間の上限 | `setpgrp` で別のプロセスグループに起こし、`limits.session.minutes` で `SIGTERM` をグループに送る | R2-12、0b の 14 |
| `TMPDIR` | セッションごとの一時フォルダ `<home>/tmp/<session-id>/` を作って渡す | 6 節 |

## 2. 役ごとの違い

| 役 | cwd | エージェント定義の `tools` | `--tools` | 備考 |
| --- | --- | --- | --- | --- |
| 受け入れ AI | 空のフォルダ | `[]` | `""` | 読めるのは指示文だけ |
| 計画役 | Issue の worktree | `Read, Grep, Glob` | — | Bash・Write・Edit なし |
| 作業 AI | Issue の worktree | `Bash, Read, Write, Edit` | — | Agent は `models.allowAgentTool` が真のときだけ |
| レビュー AI | review 用 worktree | `Bash, Read, Write, Edit`（Write は worktree の中だけ） | — | 実行して確かめるため Bash が要る |
| 批評者 | レビュー AI と同じ worktree | `Bash, Read` | — | 再現を試みる |

エージェント定義（`plugin/agents/<role>.md`）の `model` は設定より優先度が低いので、定義には書かない。

## 3. 安全設定（`settings/<role>.json`）

`setup` が設定ファイルから生成する。パスは実体に解決して書く（シンボリックリンクを解決しない不具合。要件 12 節末）。worktree ごとに変わるパスは起動のたびに差し替える。

```json
{
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "failIfUnavailable": true,
    "filesystem": {
      "denyRead": ["<sandbox.denyRead の各パス（実体）>"],
      "denyWrite": ["<ai>/.git/worktrees/<name>/gitdir"]
    },
    "network": { "allowedDomains": ["<sandbox.allowedDomains>"] }
  },
  "permissions": {
    "allow": [
      "Bash",
      "Read",
      "Grep",
      "Glob",
      "Write(//<worktree>/**)",
      "Edit(//<worktree>/**)"
    ],
    "deny": [
      "Read(//<sandbox.denyRead の各パス>)",
      "Write(//<ai>/.git/**)",
      "Edit(//<ai>/.git/**)",
      "Write(//<worktree>/.claude/**)",
      "Edit(//<worktree>/.claude/**)",
      "Write(//<worktree>/CLAUDE.md)",
      "Edit(//<worktree>/CLAUDE.md)",
      "Write(//<worktree>/.mcp.json)",
      "Edit(//<worktree>/.mcp.json)",
      "WebFetch",
      "WebSearch"
    ]
  }
}
```

| 項目 | 効くもの | 根拠 |
| --- | --- | --- |
| `sandbox.filesystem.denyRead` | Bash の読み取り | 0b の 13（Read ツールには効かない） |
| `permissions.deny` の `Read(//…)` | Read ツール | 0b の 13。絶対パスは `//` 始まり |
| `permissions.allow` の `Write(//<worktree>/**)` | Write・Edit を worktree の中に限る。外は「outside allowed working directories」で拒否 | 0b の 13 |
| `permissions.deny` の `.git/**` `.claude/**` `CLAUDE.md` `.mcp.json` | Write・Edit の保護（`.git/hooks` と `.mcp.json` は Claude Code が既定でも拒む） | 0b の 9・13 |
| sandbox の既定の保護 | 親 `.git/config` `hooks/**` `worktrees/<name>/commondir` `config.worktree`、worktree の `.claude/settings.json` は Bash から書けない | 0b の 9 |
| `denyWrite` の `gitdir` | sandbox が守らない 1 つを足す | 0b の 9 |
| `network.allowedDomains` | npm のレジストリだけ。入れ子の `claude` の通信は拒否される（動作に影響なし） | 0b の 10 |

役ごとの違い：受け入れ AI は `permissions.allow` を空にし `--tools ""` を付ける。計画役は `Bash` `Write` `Edit` を allow に入れない。

## 4. 出力の解析

`stream-json` のイベントから記録と判定に使うもの。

| イベント | 使う欄 | 用途 |
| --- | --- | --- |
| `system` / `init` | `session_id` `model` | 記録 |
| `assistant` | `message.model` `message.usage` | 役ごとの消費の集計（途中で止めても残る） |
| `result` | `subtype` `is_error` `num_turns` `total_cost_usd` `modelUsage` `stop_reason` `result` `permission_denials` | 分類（[判定の表][judgments]の 2 節）、出力契約の解析（`result` の文） |

`result` が無い（進行役が止めた）ときは、`assistant` の `usage` の合計と「上限で停止」を記録する。

## 5. 失敗の分類

[判定の表][judgments]の 2 節のとおり。`subtype` の `error_max_turns` `error_max_budget_usd`、プロセスの停止、`is_error`、出力契約の不一致、`stop_reason: refusal` を「実行の失敗」、`stopped` を「作業の失敗」とする。

## 6. 0b で分かった制約

| 制約 | 設計への反映 |
| --- | --- |
| 別名 `haiku` は Haiku 4.5 に解ける | 受け入れ AI のモデルは完全な ID `claude-haiku-5-5` |
| `--json-schema` は `--agent` と併用すると `structured_output` が空 | 進行役が `result` の文を自分のスキーマで検証する |
| `--bare` は `--plugin-dir` の agent を読まない | 使わない。`--setting-sources local` で切り離す |
| Bash を `permissions.allow` に入れないと `git commit` と変数展開を含むコマンドが承認待ちで拒否される | allow に `Bash` を入れ、境界は sandbox に任せる |
| `pnpm install` の `prepare`（simple-git-hooks）は親 `.git/hooks` に書けず失敗するが install は成功する | 失敗を無視してよい（hook が仕込まれないので望ましい） |

[judgments]: ./judgments.md
