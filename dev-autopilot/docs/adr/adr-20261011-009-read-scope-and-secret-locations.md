---
status: proposed
created: 2026-10-11
updated: 2026-10-11
author: Claude Code（メンテナの依頼で起票）
decision-makers: メンテナ
consulted: 設計レビューの別セッション（安全側の 1 体）
informed: —
---

# AI の読み取りは worktree と必要な場所に絞り、秘密の置き場を決めて必ず拒否に入れ、手動実行は launchd を起こす

[要件定義書][req]の D-10 を決める。SF-2 (e) と SF-3 の読み取りの規則を置き換える。

## 背景と課題（Context and Problem Statement）

SF-2 (e) は Read ツールの許可を `Read`（全体）とし、拒否に「秘密のパス」を列挙する方式にしている。sandbox の `denyRead` も同じ方式（`~/.ssh` `~/.config/gh` と進行役の設定・記録）である。
この方式では、列挙に無いものが読める。PAT と署名の鍵の値を置く場所（launchd の plist の `EnvironmentVariables`、env ファイル）、deploy key のファイル、`~/.claude/projects/**`（他の案件の会話ログ）、`~/.npmrc` は列挙に無い。
Issue の文に紛れた指示で作業 AI が plist を Read すれば署名の鍵が漏れ、R3-5 の前提が崩れる。他の案件の会話ログを `docs/usage/` に写して commit すれば、漏えい検査（鍵の形式・メール・パス）を通って公開リポに出る。
また、人の Claude Code の中の Skill（`/dev-autopilot`）から進行役を手動で起動すると、人の側の AI のセッションの環境に PAT と鍵が入る。

## 判断の決め手（Decision Drivers）

- 列挙漏れが穴にならない（許可を絞り、拒否で補う）
- 秘密の置き場が設計に書かれ、点検で確かめられる
- 手元の Mac で試す間も人の環境を AI から隠す（SF-3）

## 検討した選択肢（Considered Options）

1. 読み取りの許可を「worktree と必要な場所」に絞る。sandbox の `denyRead` はホーム全体を基本にし、`allowRead` で必要な場所を開ける。秘密の置き場を決めて必ず拒否に入れる。手動実行は `launchctl kickstart` で launchd のジョブを起こす
2. 列挙の方式のまま、列挙を増やす
3. AI のセッションを別の OS ユーザーで動かす（要件の判断 1 の案 B）

## 決定（Decision Outcome）

採用した選択肢:「1」。理由: 列挙漏れが穴にならず、0b で確かめた permissions と sandbox の機能の範囲で実現できる。

中身：

- Read ツールの許可：`Read(//<worktree>/**)` と、設定の `read.allow` に列挙した場所（例：pnpm の store、Node の置き場、`/usr/**` `/opt/**` のような道具のパス）。`Read` の全体許可は外す。Grep・Glob も同じ範囲
- sandbox：`denyRead` に `~/` 全体を入れ、`allowRead` で worktree・`ai` の `.git`・pnpm の store・道具のパスを開ける（公式文書の「`denyRead: ["~/"]` と `allowRead: [...]`」の形）。`denyRead` には加えて進行役の置き場（`ctl` `records` `settings` `lock`）と秘密の置き場を実体のパスで入れる（ホームの外にあっても）
- 秘密の置き場：PAT と署名の鍵は launchd の plist の `EnvironmentVariables` に置かず、進行役だけが読める env ファイル（`<home>/secrets/env`、権限 600、同期されないパス）に置く。launchd のジョブは進行役の起動スクリプトを呼び、起動スクリプトがそのファイルを読んで環境変数に載せる。deploy key も `<home>/secrets/` に置く。`<home>/secrets/**` は `denyRead` と `Read` の deny の両方に入れる
- 手動実行：`/dev-autopilot` の Skill は進行役を直接起動せず、`launchctl kickstart -k <label>` で launchd のジョブを起こし、記録を読んで結果を表示する。人の Claude Code のセッションの環境に秘密を入れない
- 点検（S2）：`Read` の全体許可が無いこと、`<home>/secrets/**` と plist が sandbox の中からも Read ツールからも読めないこと、`~/.claude/projects/**` と `~/.npmrc` が読めないことを実際に試す

### 影響（Consequences）

- 良い点: 列挙漏れが読み取りの穴にならない
- 良い点: 秘密の置き場が 1 か所になり、点検で確かめられる
- 悪い点: `allowRead` に道具のパスを足す必要があり、0c で `pnpm check` と `git` が動く最小の一覧を確かめる手間がある
- 悪い点: 手動実行が launchd 経由になり、手元で `node src/main.ts` を直接動かす試験は別の手順（秘密を環境変数に載せた端末から）になる

### 確認方法（Confirmation）

- 0c で、`denyRead: ["~/"]` + `allowRead` の設定で `pnpm check` と `git commit` が通ることと、plist・env ファイル・`~/.claude/projects` が Bash と Read の両方から読めないことを実機で確かめる

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 1. 許可を絞り、秘密の置き場を決め、launchd を起こす

- 良い点: fail-closed
- 悪い点: `allowRead` の一覧の整備が要る

### 2. 列挙を増やす

- 悪い点: 新しい秘密が増えるたびに列挙が漏れる
- 却下

### 3. 別の OS ユーザー

- 良い点: 隔離が最も強い
- 悪い点: 要件の判断 1 で「手元の Mac で運用しにくい」として採らなかった。専用マシンに移るときに再検討する
- 見送り

## 補足情報（More Information）

- 関連する要件：SF-2 (e)、SF-3、S2、C-4（人が呼ぶ Skill）、付録 A（0b の 13・17）
- 置き換える文言：SF-2 (e) の「allow は `Bash` `Read` …」→「`Read(//<worktree>/**)` と設定の `read.allow`」。SF-3 に「`denyRead` はホーム全体を基本にし `allowRead` で開ける」を足す
- 基本設計への反映：sessions の 3 節、config（`read.allow`、`paths.secrets`）、architecture の 1 節

[req]: ../requirements.md
