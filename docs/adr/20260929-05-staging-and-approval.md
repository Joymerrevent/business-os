---
id: 20260929-05
title: ステージングと承認、四重防衛
status: proposed
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
supersedes: n/a
---

# 20260929-05: ステージングと承認、四重防衛

## 背景

CC は間違えるし、勘違いもする。「CC が勝手に確定していい範囲」と「人間の承認が要る範囲」を
最初から分けないと、会社の方針が知らぬ間に変わるか、承認疲れで運用が止まるかのどちらかになる。

2026 年 5 月版は bash の hook 1 層で `strategy/` を守っていた。その後、CC に OS レベルの
sandbox が整い、auto mode（多くの権限プロンプトを自動処理）が既定になった。
承認プロンプトに頼る設計ではなく、**deny と sandbox で守り、承認は要所に絞る**設計へ移る。

## 決定

### 承認が要る範囲（2 種類だけ）

1. **外部に影響が出る行動**：送信、投稿、支払い、公開、他人に見える変更
2. **憲章（`docs/charter/`）と地図（`CLAUDE.md`）、防衛設定（`.claude/settings.json`）、器の状態（`.business-os.json`）の変更**

それ以外（`operations/` `knowledge/` `proposals/` `decisions/`、CC 自身のメモ）は AI が直接書いてよい。

### 四重防衛

| 層 | 強制される場所 | 守るもの | 抜け穴 |
|---|---|---|---|
| 1. sandbox | OS | Bash とその全子プロセスからの保護対象への書き込み、秘密の読み取り | 未設定、統合ルールの誤り、native Windows 非対応 |
| 2. permissions | CC プロセス内 | 組み込みツール。保護対象への Edit は **ask**（人間確認）、危険コマンドは deny | Bash 経由は文字列一致のみ |
| 3. PreToolUse hook（TS） | CC プロセス内（自作） | 提案のない `charter/` Edit の拒否、フロントマター検査、Bash の意味解析。例外時は拒否（fail-closed） | hook 自身のバグ |
| 4. `proposals/` | 運用 | 止めた後の出口、判断の履歴 | 承認疲れ |

各層の抜け穴を別の層が埋める。1 層だけで済ませない。

保護対象は `docs/charter/**`、`CLAUDE.md`、`.claude/settings.json`、`.business-os.json` の 4 つ。

- permissions のファイル規則は `Edit(...)` で書く。`Edit` 規則が Write を含む全書き込みツールに効き、`Write(...)` 規則は判定に使われない
- sandbox は `allowUnsandboxedCommands: false` とし、失敗したコマンドを sandbox の外で再実行する逃げ道を塞ぐ
- native Windows では sandbox が動かない。第 2〜4 層の三重で動かし、軽い点検が毎セッション warn を出す

### company の状態

hook は `company` の `.business-os.json` の有無と `state` で振る舞いを変える。

| 状態 | 条件 | 保護対象への書き込み |
|---|---|---|
| 対象外 | `.business-os.json` が無い | hook は無言で通す。軽い点検も走らない |
| 初期化中 | `state: initializing` | hook が ask を返し、人間が確認する。フロントマター検査は有効 |
| 運用中 | `state: active` | 提案必須（下の `/approve` の流れ）。厳格モードあり |

`/onboard` は最初の行動として `.business-os.json` を `state: initializing` で作り、完了時に `active` にする。
再実行（`--migrate`、事業追加）は運用中の扱いで、提案経由で行う。新規ファイルも提案の `target` にできる。

### `/approve` の流れ

1. CC が憲章を変えたい → 直接 Edit は hook が止める → `docs/proposals/` に提案を書く（`status: proposed`）
2. 人間が `/approve` → CC が提案と差分を提示 → 人間が「承認」
3. CC が提案を `approving` に変更 → Edit を実行
4. Edit の瞬間に permissions の ask が人間に確認を出す → 人間が確認 → 反映 → 提案を `approved` に
5. 提案ファイルが履歴として残る

人間の判断は 2 回（承認、権限確認）。これ以上増やすと承認疲れ、減らすと AI が単独で憲章を書ける。

### 提案ファイルの形式

```yaml
---
id: 20260930-01
status: proposed        # proposed → approving → approved | rejected
target: docs/charter/company.md
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
---
```

本文は「背景」「変更内容」「差分」。`approving` のまま 24 時間以上経過したものは `/check` が検出する。

### 降格したもの

フロントマターの `ai_write: false` による制御は、CC の書き込み時に効かないため防衛層から外す。
`CLAUDE.md` への「charter は直接編集しない」という明記は残すが、防衛層には数えない。

## 根拠

- `.claudeignore` は 2026-09 時点でも存在せず、CC には gitignore 対象への組み込みブロックがない。
  秘密の保護は sandbox の denyRead と permissions の Read deny で行う
- 公式ドキュメントは「コマンド文字列に依存しないファイル・ネットワーク制御は sandbox、
  コマンド全文の検査は PreToolUse hook」と役割を整理している
- Anthropic 自身が 2026-09 に公開した commerce-agents blueprint は、書き込みを人が承認するまで
  すべてステージングし、何も自動で実行しない設計を採る。承認パイプラインは業界共通の必須部品
- gstack の最新リリースで fail-open だったガード 4 つが修正された。hook の例外は拒否側に倒す
- 検討した代替案：承認を全書き込みに広げる → 承認疲れで運用が止まる（原則 7 の失敗事例）。不採用

## 影響

- `company/.claude/settings.json` に sandbox と permissions の規則を持つ。`/onboard` が雛形から生成し、
  起動時セルフチェック（20260929-06）が欠落を検出する
- 逃げ道を塞いだ sandbox の中では、保護対象を更新する `git pull` / `checkout` / `merge` が失敗する。
  これらは CC を介さず人間が実行する
- 他のリポジトリで CC を使っても器の hook は干渉しない（`.business-os.json` が無ければ対象外）
- hook は TS で書き、fail-closed のテストを持つ（20260929-01、20260929-06）
- Bash の文字列規則は粗い網として扱う（20260930-01）
- 外部に影響が出る MCP ツールの ask 規則は、`/onboard` が接続済みツールを検出して具体名に置き換える

## 参考

- Claude Code 公式：permissions / sandbox / hooks の役割分担（2026）
- Anthropic commerce-agents blueprint（2026-09-02）：staged writes + human approval
- The Register（2026-01）：`.claudeignore` が機能しない報告
- 関連 ADR：20260929-06（セルフチェック）、20260930-01（Bash 規則）
