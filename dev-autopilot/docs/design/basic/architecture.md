---
status: draft
created: 2026-10-11
updated: 2026-10-11
source: ../../dev-autopilot-requirements.md
---

# 進行役の全体構成

dev-autopilot の進行役（AI ではない Node のスクリプト）が、何をどこに置き、1 回の実行で何をどの順に行うかを定める。
判断は[要件メモ][req]に書いてあり、本書は要件番号（R・I・S・P と節番号）で根拠を示す。要件と食い違ったら要件メモに合わせて本書を直す。

## 1. 配置

進行役は、AI と共有しない専用の clone から動く（要件 6 節の (a)〜(d)、12 節の判断 1 と 7）。マシン上の置き場は設定ファイルで決める（[設定ファイルの項目][config]）。

```text
<devAutopilotHome>/                 進行役のマシン上の置き場（設定 paths.home）
  ctl/                              進行役の clone。進行役だけが書く。src/ はここから実行する
    dev-autopilot/src/              進行役のコード（origin/develop から来た版だけ）
    dev-autopilot/plugin/           --plugin-dir で AI のセッションに渡す Plugin（絶対パス）
  ai/                               AI の作業場所の親 clone。進行役は worktree を作る・消す操作だけを行う
    .git/worktrees/<name>/          AI の worktree の gitdir。sandbox が commondir・config.worktree を守り、gitdir は denyWrite
  wt/<型>-issue-<番号>/              作業 AI と計画役の worktree（Issue ごと）
  wt/review-<PR 番号>-<round>/       レビュー AI と批評者の worktree（ラウンドごとに作り直す）
  records/                          実行と セッションの記録（追跡しない。[記録の形][records]）
  lock                              多重起動を防ぐ lock（PID・ホスト名・起動時刻）
  settings/<role>.json              AI のセッションに --settings で渡す安全設定（進行役が起動前にハッシュを確かめる）
  tmp/<session-id>/                 セッションごとの一時フォルダ（sandbox の TMPDIR）
<business-os の clone>/.claude/dev-autopilot.json   リポ固有の設定（S3。設定ファイルは 1 つだけ）
```

進行役のプロセスの環境変数だけが持つもの：fine-grained PAT（`DEV_AUTOPILOT_GH_TOKEN`）、印の署名の鍵（`DEV_AUTOPILOT_SIGNING_KEY`）、deploy key のパス（`DEV_AUTOPILOT_DEPLOY_KEY`）。
AI のセッションにはどれも渡さない（6 節）。

## 2. 1 回の実行の流れ

cron（macOS は launchd）が `node ctl/dev-autopilot/src/main.ts` を起動する。人の `/dev-autopilot` の手動実行も同じ入口を通る。

| 順 | 処理 | 止まる条件 | 根拠 |
| --- | --- | --- | --- |
| 1 | lock を取る。既存の lock の PID が生きていれば「見送り」を記録して終了。死んでいれば奪う | 見送り | 12 節「運用の規則」 |
| 2 | 設定ファイルを読み、項目の存在と型を検証する。`enabled: false` なら終了。`dryRun` と `stage` を読む | 設定の不備は fail | S3、10 節の 2 |
| 3 | 点検（`check`）を回す。fail が 1 つでもあれば作業に入らず終了 | fail | S2 |
| 4 | `ctl` で `git fetch --prune origin`。`origin/develop` の最新 commit の必須チェックを読む（基線） | 基線が赤なら新規着手を止める（進行中は続ける） | R2-8 |
| 5 | GitHub から状態を読む：Project の項目（Status・Agent 欄）、Issue（ラベル・マイルストーン・依存・コメントと印）、PR（head・draft・必須チェック・コメントと印）。[状態の組み立て][state] | API の失敗は fail-closed（その実行を止める） | 12 節「運用の規則」 |
| 6 | 受け入れ（I12）を、上限の件数まで行う | 受け入れ AI の失敗は実行の失敗として持ち越し | I12 |
| 7 | 進行中の Issue（`In Progress` 以降で `Done` でない）ごとに次の段を決め、**1 段だけ**進める。WIP の順は Issue 番号の昇順 | 実行時間の上限に達したら残りは次回 | R1-5 |
| 8 | WIP の上限に空きがあれば、棚卸し（R1-1）で候補を選び、上限の件数まで着手する（段「計画」まで） | WIP 上限、1 回の着手件数 | R1-3 |
| 9 | 実行の記録を書き、lock を解放する | — | R1-4 |

`dryRun: true` のときは、GitHub への書き込み（コメント・ラベル・Project の欄・PR・push）を記録に「書くつもりだった内容」として残し、実際には書かない。読み取りと AI のセッションは行う。

## 3. 段の一覧

Issue ごとに 1 回の実行で進めるのは 1 段（R1-5）。各段の「入力・実行・GitHub への書き込み・失敗」を定める。判定の規則は[判定の表][judgments]、セッションの起動は[セッションの起動][sessions]、出力の形は[出力契約][contracts]にある。

| 段 | 入力 | 実行 | GitHub への書き込み | 失敗の扱い | 根拠 |
| --- | --- | --- | --- | --- | --- |
| 受け入れ | Project にあり `agent-ready` も受け入れの印も無く、マイルストーンがある Issue | 検疫（TypeScript）→ 受け入れ AI（`claude-haiku-5-5`、道具なし）→ 下書きの検疫 | 「受け入れの下書き」コメント＋`intake` の印 | 検疫で見つかれば `needs-human`。AI の失敗は持ち越し | I11、I12 |
| 承認の確定 | `agent-ready` が付き、`intake-final` の印が無い Issue | 付けた人の権限（I10）、渡す文の決定（I1）、ハッシュ、依存とマイルストーンの確定 | `intake-final` の印のコメント、依存（blocked by）、マイルストーン | 権限不足は `needs-human` | I10、I12、R1-1 |
| 計画 | 候補に選ばれた Issue（基線が緑） | `ai` に worktree を作る → 計画役（`opus` xhigh、`fable` は印・ラベル・自己申告で） | 計画コメント＋`plan` の印。Status `In Progress`、Agent `worker` | AI の失敗は持ち越し。ADR が要る等は `needs-human` | R2-9、R2-7 |
| 実装 | `plan` の印がある Issue（段階 2〜4 では計画の投稿が前回以前） | 計画を検疫して固定の指示文に入れ、作業 AI を worktree で起動。commit を `ctl` に fetch し、漏えい検査と保護パスの検査 | draft PR（`Closes #n`）、Status `In Review`、Agent `reviewer`（段階 2 は `human`） | 検査で引っかかれば push せず `needs-human` | R2-5、R2-14 |
| レビュー | `In Review` で、最新の head に対する `review` の印が無い PR | `ctl` から head で review 用 worktree を作る → レビュー AI → 批評者 → 統合 | レビュー結果のコメント＋`review` の印 | pass の 5 条件を満たさなければ印を書かず持ち越し | R3-1〜R3-7 |
| 修正 | 最新の印が `verdict=fix` で、往復の上限内の PR | 作業 AI（2 ラウンド目から `sonnet` → `opus`）を同じ worktree で起動。fetch・検査・push | 対応コメント＋`fix` の印。Agent `worker` → `reviewer` | 往復 3 回か振動で `needs-human` | R4-1、R4-2、R4-2b |
| 収束 | 最新の印が `verdict=pass` で head が一致し、CI 緑の PR | 🟢 を Issue に起票 → PR を ready | Issue（`from-review`）、PR の ready、Status `Ready to Merge`、Agent 空 | Issue 化に失敗したら ready にしない | R4-1b、R4-3 |
| マージ判定 | `Ready to Merge` で `merge` の印が無い PR | 許可一覧・diff の状態・漏えい検査の掛け直し・批評者が落とした 🔴 の有無 | マージ判定のコメント＋`merge` の印（段階 4 は記録だけ） | — | R7-2、R7-2b |
| 載せ直し | `develop` が進み、PR が base と最新でない | `ctl` で `git merge origin/develop`。patch-id の比較 | push。同一なら印の付け直し、違えば Status `In Review` に戻す | 衝突は修正の段へ | R7-3b、R7-3c |
| 片付け | マージされた PR | Issue を閉じる。worktree を消す。依存していた PR を載せ直しへ | Issue の close、Status `Done` | 消せない worktree は warn | R7-4 |
| 催促 | `merge` の印から 7 日、人の操作が無い PR | — | 催促のコメント（1 回だけ） | — | R7-2b |

## 4. モジュール構成

`dev-autopilot/src/` の構成。単体テストは対象の隣に置く（`xxx.test.ts`）。bash は置かない。

| ファイル | 責務 | 主な要件 |
| --- | --- | --- |
| `main.ts` | 入口。2 節の流れを順に呼ぶ。例外は記録して fail-closed | 12 節「運用の規則」 |
| `lock.ts` | lock の取得・奪取・解放 | 12 節「運用の規則」 |
| `config.ts` | 設定の読み込みと検証（[設定ファイルの項目][config]） | S3 |
| `check.ts` | 点検（S2）。`/dev-autopilot check` からも呼ぶ | S2 |
| `github.ts` | GraphQL と REST の薄い包み。読み取りと、`dryRun` を尊重する書き込み | 4.8 節、4.10 節 |
| `state.ts` | GitHub の状態から Issue ごとの状態と次の段を組み立てる（[状態の組み立て][state]） | R1-5、4.10 節 |
| `trust.ts` | 文の出どころの判定（I1、I10）、印の真正性（R3-5） | 4.8 節 |
| `marker.ts` | 印の形の定義（種類・欄・署名・解析）。要件 4.12 節と一致させる | 4.12 節 |
| `quarantine.ts` | 検疫（I11）。`intake` Skill も同じものを呼ぶ | I11 |
| `leak.ts` | 漏えい検査（R2-14）。worktree の `check:leak` は使わない | R2-14 |
| `select.ts` | 棚卸し（R1-1）と WIP の上限 | R1-1、R1-3 |
| `stages/intake.ts` `stages/plan.ts` `stages/work.ts` `stages/review.ts` `stages/fix.ts` `stages/converge.ts` `stages/merge-judge.ts` `stages/rebase.ts` `stages/cleanup.ts` | 3 節の各段 | 3 節 |
| `session.ts` | AI のセッションの起動・監視・停止・出力の解析（[セッションの起動][sessions]） | R2-12、R2-13 |
| `contracts.ts` | 出力契約の JSON スキーマと検証（[出力契約][contracts]） | R2-5 |
| `git.ts` | `ctl` と `ai` に対する git の操作（fetch・merge・patch-id・diff・push・worktree の作成と削除） | 6 節の (b)、R7-3c |
| `judge.ts` | 判定の表の実装（pass の条件、マージ判定、収束）（[判定の表][judgments]） | R3-3、R7-2 |
| `record.ts` | 実行と セッションの記録（[記録の形][records]） | R1-4 |

## 5. 信頼の境界

誰が何を書けるかの一覧。進行役の判定は、この表の「書ける人」を前提に組む。

| もの | 書ける人 | 進行役の扱い |
| --- | --- | --- |
| `ctl/` の中身 | 進行役だけ | 信頼する。`src/` と Plugin はここから実行・読み込みする |
| `ai/.git/objects` `refs` `packed-refs` `logs` | AI（sandbox の既定）と進行役 | 信頼しない。SHA は GitHub の API の head と照合する。push は `ctl` から `SHA:refs/heads/<branch>` の形 |
| `ai/.git/config` `hooks/**` `worktrees/<name>/commondir` `config.worktree` | 誰も書かない（sandbox の保護）。`gitdir` は denyWrite | 進行役は worktree の中でも `ai` の中でも git を実行しない（worktree の作成と削除だけ） |
| worktree の作業ファイル | AI（Bash と、worktree に絞った Write・Edit） | 作業の内容。実行しない。fetch して検査する |
| worktree の `.claude/**` `CLAUDE.md` `.mcp.json` `.github/**` `dev-autopilot/**` | AI が書けない（sandbox の保護と permissions の deny）か、書いても push しない | 触れる diff は push せず `needs-human` |
| GitHub の Issue・PR・Project | 進行役（印付き）と人 | 文の出どころは投稿者と署名付きの印で判定する（`trust.ts`） |
| 設定ファイルと `settings/<role>.json` | 人と `setup` | 起動前にハッシュを確かめる |

## 6. git の操作

進行役が git を動かす場所は `ctl` だけ。`ai` に対しては `git worktree add` と `git worktree remove` だけを行い、worktree の中では何も実行しない（0b で、worktree の中で git を実行したときだけ `commondir` の差し替えが発火することを確かめた）。

| 操作 | コマンドの形 | 備考 |
| --- | --- | --- |
| worktree を作る | `git -C ai worktree add -b <branch> wt/<name> <base の SHA>` | base は `ctl` で fetch した `origin/develop` の SHA |
| AI の commit を取り込む | `git -C ctl fetch <wt のパス> <branch>` | 差し替えられた config は読まれない（0b の 12） |
| 親 commit の照合 | `git -C ctl rev-parse FETCH_HEAD^` が API の head（初回は base）と一致 | 一致しなければ push しない |
| 載せ直し | `git -C ctl checkout -B <branch> <head の SHA>` → `git merge origin/develop` | 衝突したら中止し修正の段へ |
| patch-id | `git -C ctl diff origin/develop...<SHA> \| git patch-id --stable --verbatim` | 載せ直しの前後で比べる |
| 変更ファイルの一覧 | `git -C ctl diff --raw origin/develop...<SHA>` | API の `files` は使わない（ページ送りの漏れ） |
| push | `GIT_SSH_COMMAND="ssh -i <deploy key>" git -C ctl push origin <SHA>:refs/heads/<branch>` | ブランチ名でなく SHA を送る |
| git の設定 | `GIT_CONFIG_COUNT` で `core.hooksPath=<空のフォルダ>` `gc.auto=0` `commit.gpgsign=false` を渡す | 設定ファイルを書き換えない |

[req]: ../../dev-autopilot-requirements.md
[config]: ./config.md
[state]: ./state-machine.md
[judgments]: ./judgments.md
[sessions]: ./sessions.md
[contracts]: ./contracts.md
[records]: ./records.md
