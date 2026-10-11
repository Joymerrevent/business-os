---
status: draft
created: 2026-10-11
updated: 2026-10-11
source: ../dev-autopilot-requirements.md
---

# 設定ファイルの項目

リポ固有の値はすべて 1 つの設定ファイルに置く（要件 10 節の 2、S3）。置き場は適用先のリポの `.claude/dev-autopilot.json`。`setup` が書き、`check` が項目の存在と型を確かめ、進行役が使う。秘密（PAT、署名の鍵）は書かず、環境変数で渡す。

## 1. 項目

| キー | 型 | 初期値（business-os） | 意味 | 根拠 |
| --- | --- | --- | --- | --- |
| `enabled` | boolean | `true` | `false` なら進行役は何もしない | 12 節「運用の規則」 |
| `dryRun` | boolean | `true` | GitHub への書き込みを記録にだけ残す | 12 節「運用の規則」 |
| `stage` | 1〜6 | `1` | 段階ごとの振る舞い（[状態の組み立て][state]の 4 節） | 7 節、4.10 節 |
| `github.owner` `github.repo` | string | `Joymerrevent` `business-os` | リポ | 10 節の 2 |
| `github.baseBranch` | string | `develop` | PR の向き先 | R2-5b |
| `github.botLogin` | string | メンテナのログイン | 進行役の投稿者（R3-5 の (a)） | R3-5 |
| `github.project.number` | integer | `7` | Project | R1-1 |
| `github.project.id` | string | API で引く | Project のノード ID | P1 |
| `github.project.status.fieldId` | string | API で引く | Status の欄 | P1 |
| `github.project.status.options` | object | `{ "todo": "<id>", "inProgress": …, "inReview": …, "readyToMerge": …, "blocked": …, "done": … }` | 選択肢の ID | P1 |
| `github.project.agent.fieldId` | string | API で引く | Agent 欄 | P2 |
| `github.project.agent.options` | object | `{ "worker": …, "reviewer": …, "human": …, "paused": … }` | 選択肢の ID | P2 |
| `labels.agentReady` `labels.needsHuman` `labels.fromReview` `labels.planFable` `labels.planOpus` | string | `agent-ready` `needs-human` `from-review` `plan:fable` `plan:opus` | ラベル名 | P4 |
| `labels.typeMap` | object | `{ "bug": "fix", "*": "feat" }` | Issue のラベル → ブランチの型 | R2-2 |
| `headings.instruction` `headings.reject` `headings.disagree` `headings.objection` | string | `## 作業指示` `## 却下 R<n>` `## 判定と違う判断` `## 異議` | 人の固定の見出し | 4.12 節 |
| `paths.home` | string（絶対） | `~/dev-autopilot` | 進行役のマシン上の置き場（[全体構成][arch]の 1 節） | 10 節の 3 |
| `paths.devAutopilot` | string（絶対） | `<home>/ctl/dev-autopilot` | 進行役の `src/` と Plugin の場所 | 10 節の 3 |
| `paths.worktrees` | string（絶対） | `<home>/wt` | worktree の置き場 | R2-1 |
| `paths.records` | string（絶対） | `<home>/records` | 記録 | R1-4 |
| `paths.lock` | string（絶対） | `<home>/lock` | lock | 12 節「運用の規則」 |
| `paths.settings` | string（絶対） | `<home>/settings` | AI の安全設定 | 判断 1 |
| `schedule.intervalMinutes` | integer | `1440` | 起動の間隔（launchd の plist と二重なので `check` がずれを検出する） | R6-1 |
| `limits.startPerRun` | integer | `1` | 1 回の実行で着手する件数 | R1-3 |
| `limits.wip` | integer | `1` | 進行中の Issue の上限 | R1-3 |
| `limits.runMinutes` | integer | `180` | 1 回の実行の所要時間 | R1-5 |
| `limits.intakePerRun` | integer | `5` | 1 回の実行で受け入れる件数 | I12 |
| `limits.rounds` | integer | `3` | 往復の上限 | R4-2 |
| `limits.session.minutes` `limits.session.turns` `limits.session.usd` | integer, integer, number | `45` `200` `5` | セッションの上限 | R2-12 |
| `limits.issueUsd` `limits.dayUsd` | number | `20` `30` | 1 Issue の累計と 1 日の利用枠 | R2-13、P8 |
| `limits.retries` `limits.retryIntervalRuns` | integer | `3` `1` | 実行の失敗の再試行の回数と間隔（実行の回数） | R2-13 |
| `limits.remindDays` | integer | `7` | 催促までの日数 | R7-2b |
| `models.<role>.model` `models.<role>.effort` | string | 下の表 | 役ごとのモデルと effort（別名。`haiku` だけ完全な ID） | 4.11 節 |
| `models.worker.escalateTo` | string | `opus` | 2 ラウンド目に上げる先 | R4-2b |
| `models.intake.fallback` | string | `sonnet` | 拒否の後のモデル | I12 |
| `models.allowAgentTool` | boolean | `false` | AI のセッションに Agent ツールを許すか | R2-13 |
| `models.criticConfidenceThreshold` | integer | `80` | 批評者の確信度のしきい値 | R3-7 |
| `quality.gate` | string | `pnpm check` | AI のセッションの中で使う品質ゲート | R2-4 |
| `ci.required[]` | `{ name, app, workflowPath }` | `check (ubuntu-latest)` `check (windows-latest)`（app `GitHub Actions`、`.github/workflows/ci.yml`）、`commitlint`（`.github/workflows/commitlint.yml`） | 必須チェック | R4-3 |
| `merge.allowlist[]` | string（glob） | `docs/usage/**` `.changeset/*.md` | 進行役が `ready` と判定してよいパス | R7-3 |
| `merge.policyPaths[]` | string（glob） | `docs/adr/**` `docs/design/**` `ROADMAP.md` `CLAUDE.md` `.claude/**` `dev-autopilot/**` `.claude-plugin/**` `.github/**` `plugin/hooks/**` `plugin/agents/**` `plugin/templates/**` `plugin/scripts/**` `package.json` `pnpm-lock.yaml` `pnpm-workspace.yaml` `.node-version` `tsconfig.json` `vitest.config.ts` `eslint.config.*` `commitlint.config.*` `.gitleaks.toml` `.gitignore` `.markdownlint*` | 方針に係るパス | R7-3 |
| `push.protectedPaths[]` | string（glob） | `.claude/**` `CLAUDE.md` `.mcp.json` `.github/**` `dev-autopilot/**` | 触れる diff を push しないパス | R2-14 |
| `leak.allowedEmails[]` `leak.allowedDomains[]` | string | リポの `check:leak` と同じ | 漏えい検査の許可リスト | R2-14 |
| `conventions.language` `conventions.conventionalCommits` `conventions.changeset` | string, boolean, boolean | `ja` `true` `true` | コミットと PR の規約 | R2-4 |
| `sandbox.allowedDomains[]` | string | `registry.npmjs.org` | AI の sandbox の通信の許可先 | 判断 1 |
| `sandbox.denyRead[]` | string（絶対） | `<home>/ctl/**` `<home>/records/**` `<home>/settings/**` `~/.ssh/**` `~/.config/gh/**`（実体のパスも） | 読み取り禁止（Bash と Read の両方に掛ける） | 6 節の (e) |
| `env.passthrough[]` | string | `HOME` `PATH` `USER` `LOGNAME` `TMPDIR` `TERM` `LANG` | 子プロセスに渡す環境変数の名前 | 6 節 |

役ごとのモデルの初期値（4.11 節）：

| 役 | `model` | `effort` |
| --- | --- | --- |
| `planner` | `opus`（`fable` は印・ラベル・自己申告で） | `xhigh`（`fable` は `high`） |
| `worker` | `opus` | `high` |
| `reviewer` | `opus` | `xhigh` |
| `critic` | `opus` | `high` |
| `intake` | `claude-haiku-5-5` | `medium` |

## 2. 環境変数

| 名前 | 中身 | 使う場所 |
| --- | --- | --- |
| `DEV_AUTOPILOT_GH_TOKEN` | fine-grained PAT（business-os だけ、Projects の読み書き） | `github.ts`（`GH_TOKEN` として `gh` に渡す） |
| `DEV_AUTOPILOT_SIGNING_KEY` | 印の署名の鍵（32 バイト以上の乱数） | `marker.ts` |
| `DEV_AUTOPILOT_DEPLOY_KEY` | deploy key の秘密鍵のパス（同期されないパス） | `git.ts`（`GIT_SSH_COMMAND`） |

どれも AI のセッションには渡さない（`env.passthrough` に含めない）。`check` は「子プロセスから見えない」ことを実際に試す。

## 3. 設定の検証（`check`）

| 検査 | 結果 |
| --- | --- |
| すべてのキーが存在し型が合う | 欠けは fail |
| `github.project.*` の ID が API で実在する | 無ければ fail |
| `labels.*` が リポに存在する | 無ければ fail |
| `ci.required` が空でない | 空は fail |
| `merge.allowlist` と `merge.policyPaths` が重ならない | 重なりは fail |
| `paths.*` が存在し、`ctl` が `origin/develop` を追跡している | 無ければ fail |
| `schedule.intervalMinutes` と launchd の plist が一致 | ずれは warn |
| `sandbox.denyRead` の各パスが実体に解決されている | リンクのままなら fail |

[state]: ./state-machine.md
[arch]: ./architecture.md
