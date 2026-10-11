---
status: draft
created: 2026-10-11
updated: 2026-10-11
source: ../dev-autopilot-requirements.md
---

# 状態の組み立てと次の段の決定

進行役は毎回の実行で、GitHub にある情報だけから Issue ごとの状態を組み立て直し、次に進める 1 段を決める（要件 R1-5、4.10 節、12 節「運用の規則」）。手元の記録は判定に使わない。本書はその入力・組み立て・決定表を定める。

## 1. 入力

Issue 1 件について読むもの。すべて GitHub の API から取る。

| 入力 | 取り方 | 用途 |
| --- | --- | --- |
| Project の Status と Agent 欄 | Project の項目（`fieldValueByName`） | 状態の主軸 |
| ラベル | Issue の `labels` | `agent-ready` `needs-human` `from-review` `plan:*` |
| マイルストーン | Issue の `milestone` | 候補の条件、受け入れの対象 |
| 依存 | REST `/issues/{n}/dependencies/blocked_by` | 待ち（B6・B7） |
| Issue の状態 | `state` `closed` 移動の有無 | I8 |
| Issue のコメント | `comments`（投稿者、`lastEditedAt`、本文） | 印（`intake` `intake-final` `plan`）、人の固定の見出し |
| ラベルを付けた人 | Issue の `timelineItems`（`LabeledEvent`） | I10 |
| PR | `Closes #n` で結びつく open な PR（head の SHA、`isDraft`、`baseRefName`、`mergedAt`） | PR の有無と段 |
| PR のコメント | `comments`（投稿者、`lastEditedAt`、本文） | 印（`review` `fix` `merge`）、人の固定の見出し |
| 必須チェック | head の SHA の `checkSuites` / `statusCheckRollup`（名前・app・ワークフローのパス・結論） | CI 緑 |
| base との差 | `ctl` で `git merge-base --is-ancestor origin/develop <head>` | 載せ直しが要るか |

印は `trust.ts` で R3-5 の 3 条件（投稿者が進行役のアカウント、`lastEditedAt` が null、署名が検証できる）を満たすものだけを採用し、種類ごとに**最新の 1 つ**を使う。満たさない印は無いものとして扱う。

## 2. 組み立てた状態

| 欄 | 値 | 由来 |
| --- | --- | --- |
| `status` | `Todo` `In Progress` `In Review` `Ready to Merge` `Blocked` `Done` | Project |
| `agent` | 空 `worker` `reviewer` `human` `paused` | Project |
| `labels` | 集合 | Issue |
| `milestone` | 有無と版 | Issue |
| `blocked` | 依存の相手に open が残っているか | REST |
| `intake` | `intake` の印の有無と値 | コメント |
| `approved` | `agent-ready` があり、付けた人が push 以上 | ラベルと timeline |
| `intakeFinal` | `intake-final` の印の有無と `brief` のハッシュ | コメント |
| `plan` | `plan` の印の有無、`head`、ハッシュ、投稿日時 | コメント |
| `pr` | 無し / draft / ready / merged と head の SHA、base と最新か | PR |
| `review` | 最新の `review` の印（round・head・verdict・dropped_high） | PR のコメント |
| `fix` | 最新の `fix` の印（round・head） | PR のコメント |
| `merge` | 最新の `merge` の印（head・merge・投稿日時） | PR のコメント |
| `ci` | head に対する必須チェックの結論：`green` `pending` `red` `missing` | チェック |
| `failures` | 同じ Issue の連続した実行の失敗の回数（記録から。判定でなく上限の数え上げにだけ使う） | 記録 |

## 3. 止まる条件の先取り

次の段を決める前に、どの段でも先に見る条件。1 つでも当たれば、その Issue はこの実行で何もしない（必要なら `needs-human` を付ける）。

| 条件 | 扱い | 根拠 |
| --- | --- | --- |
| `needs-human` がある | 触らない | R1-1、4.10 節 B1・B2 |
| `agent` が `human` か `paused` | 触らない（読むだけ） | 12 節「運用の規則」 |
| Issue が closed / 移動 / `agent-ready` が外れた / マイルストーンが外れた（`In Progress` 以降） | `needs-human`（worktree は残す） | I8 |
| `intakeFinal` のハッシュと、いま渡す文のハッシュが違う | `needs-human` | I4 |
| `blocked` が真 | 待つ（欄は変えない。理由を記録し、Issue に 1 回だけコメント） | R5-5、B6・B7 |
| `agent-ready` を付けた人が push 未満 | ラベルを無効として扱い `needs-human` | I10 |
| 復旧できない組み合わせ（下の 5 節） | `needs-human` | 12 節「運用の規則」 |

## 4. 次の段の決定表

上から順に最初に当たった行を採る。「段」は[全体構成][arch]の 3 節。

| # | 条件 | 次の段 | 根拠 |
| --- | --- | --- | --- |
| 1 | `pr` が merged | 片付け | R7-4 |
| 2 | `status` が `Ready to Merge`、`merge` の印があり、base と最新でない | 載せ直し | R7-3b、R7-3c |
| 3 | `status` が `Ready to Merge`、`merge` の印が無い（段階 4 は記録だけ） | マージ判定 | R7-2b |
| 4 | `status` が `Ready to Merge`、`merge` の印から 7 日、人の操作（マージ・`## 判定と違う判断`）が無く、催促が無い | 催促 | R7-2b |
| 5 | `status` が `In Review`、`review` の印が最新の head に対して `pass`、`ci` が `green` | 収束 | R4-3 |
| 6 | `status` が `In Review`、`review` の印が最新の head に対して `pass`、`ci` が `pending` | 待つ（次回に読む） | R4-3、R1-5 |
| 7 | `status` が `In Review`、`review` の印が最新の head に対して `pass`、`ci` が `red` か `missing` | 修正（CI の失敗をラウンドの指摘として渡す。往復に数える） | R4-3 |
| 8 | `status` が `In Review`、`review` の印が最新の head に対して `fix`、`fix` の印が同じ round で無い、往復が上限内 | 修正 | R4-1、R4-2 |
| 9 | `status` が `In Review`、`review` の印が `fix`、往復が上限に達した、または同じ指摘が 2 ラウンド続いた | `needs-human`（B1） | R4-2 |
| 10 | `status` が `In Review`、最新の head に対する `review` の印が無い（初回、修正後、載せ直しで差分が変わった後） | レビュー | R3-1 |
| 11 | `status` が `In Progress`、`pr` が無く、`plan` の印がある。段階 2〜4 では `plan` の投稿が前回以前の実行 | 実装 | R2-9、R2-5 |
| 12 | `status` が `In Progress`、`pr` が無く、`plan` の印が無い | 計画（worktree が無ければ作る） | R2-9 |
| 13 | `status` が `Todo`、`approved`、`intakeFinal` がある、`milestone` がある、`blocked` でない | 候補（棚卸しで選ばれれば計画へ。WIP と着手件数の上限に従う） | R1-1、R1-3 |
| 14 | `status` が `Todo`、`approved`、`intakeFinal` が無い | 承認の確定 | I12 |
| 15 | `status` が `Todo`、`approved` でない、`intake` の印が無い、`milestone` がある | 受け入れ（上限の件数まで） | I12 |
| 16 | それ以外 | 何もしない | — |

段階（設定 `stage`）による違い：

- 段階 1：行 15・14・13 だけを行う（13 は選定の結果を記録し、計画には進まない）
- 段階 2：行 11・12 まで。5〜10 は行わず、レビューは人（Agent 欄は `human`）
- 段階 3：行 10 を行う（レビューの印を書く）。修正（8）は人
- 段階 4：行 8・9 を行う。行 3 は記録だけで印を書かない（shadow）
- 段階 5 以降：全部

## 5. 復旧できない組み合わせ

次回の実行が GitHub の状態から復旧できない組み合わせ。見つけたら `needs-human` を付け、理由を Issue にコメントする。

| 組み合わせ | 例 |
| --- | --- |
| PR はあるが worktree が無い | マシンの入れ替え、人が消した |
| worktree はあるが Issue に結びつかない | 記録に無い名前 |
| `In Progress` なのに `intake-final` の印が無い | 人が手で Status を変えた |
| `review` の印の `head` がどの commit にも一致しない | force push（ruleset で禁じているので通常は起きない） |
| `merge` の印があるのに PR が draft | 人が手で戻した |

## 6. 遷移の正本との対応

要件 4.10 節の表（正常な順 1〜10、止まる遷移 B1〜B7）と本書の決定表の対応。

| 4.10 節 | 本書 |
| --- | --- |
| 1 | 入力（Project の自動追加は人の設定） |
| 2a | 行 15 |
| 2b | 人の操作（`approved` の入力） |
| 2c | 行 14 |
| 3 | 行 13（棚卸し） |
| 4 | 行 12 |
| 5 | 行 11 |
| 6 | 行 8・10 |
| 7 | 行 5 |
| 8 | 行 3 |
| 8b | 行 2 |
| 9 | 人の操作 |
| 10 | 行 1 |
| B1 | 行 9 |
| B2 | 3 節と各段の失敗 |
| B3 | 各段の「実行の失敗」（[判定の表][judgments]の 2 節） |
| B4・B5 | 3 節 |
| B6・B7 | 3 節の `blocked` |

[arch]: ./architecture.md
[judgments]: ./judgments.md
