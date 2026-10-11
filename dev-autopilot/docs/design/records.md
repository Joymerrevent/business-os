---
status: draft
created: 2026-10-11
updated: 2026-10-11
source: ../dev-autopilot-requirements.md
---

# 記録の形

進行役が手元に残す記録を定める（要件 R1-4、R6-3、12 節「運用の規則」）。記録は集計と調査のためで、判定の正ではない（正は GitHub）。置き場は設定 `paths.records`。追跡しない。

## 1. ファイルの配置

```text
<paths.records>/
  runs/<実行 ID>.json          実行 1 回の記録
  sessions/<実行 ID>/<n>.json   AI のセッション 1 回の記録（実行の中の通し番号）
  sessions/<実行 ID>/<n>.jsonl  そのセッションの stream-json の生のイベント
  dry-run/<実行 ID>.md          dryRun のときに「書くつもりだった内容」を人が読む形で
  objections.md                 dry-run の間の人の異議（7 節の段階 1 の出口。投稿を始めたら GitHub の見出しに移る）
```

実行 ID は `YYYYMMDD-HHMMSS-<ホスト名>`。

## 2. 実行の記録（`runs/<実行 ID>.json`）

| 欄 | 型 | 意味 |
| --- | --- | --- |
| `runId` | string | 実行 ID |
| `startedAt` `endedAt` | ISO 8601 | 開始と終了 |
| `trigger` | `"cron"` \| `"manual"` | 起動の種類 |
| `stage` `dryRun` | integer, boolean | 設定の値 |
| `lock` | `{ acquired, takenOver, skipped }` | lock の取得、奪取、見送り |
| `check` | `{ fail: string[], warn: string[] }` | 点検の結果 |
| `baseline` | `{ sha, green }` | `origin/develop` の SHA と基線の結果 |
| `issues[]` | `{ number, stateBefore, step, result, reason, sessions: integer[] }` | Issue ごとに、組み立てた状態、進めた段、結果（`done` `carried` `needs-human` `skipped` `waiting`）、理由、使ったセッション |
| `intake` | `{ processed: integer[], skipped: integer[] }` | 受け入れた Issue と、上限で回した Issue |
| `selected` `waited` | `{ number, reason }[]` | 棚卸しで選んだ Issue と待たせた Issue（R1-4） |
| `writes[]` | `{ kind, target, dryRun }` | GitHub への書き込み（コメント・ラベル・欄・PR・push）。dryRun なら内容を `dry-run/` に |
| `usage` | `{ usd, byRole: { role: usd } }` | この実行の消費の合計 |
| `durationMs` | integer | 所要時間 |

## 3. セッションの記録（`sessions/<実行 ID>/<n>.json`）

要件 R1-4 の欄を固定する。

| 欄 | 型 | 意味 |
| --- | --- | --- |
| `runId` `seq` | string, integer | 実行 ID と通し番号 |
| `issue` | integer | Issue 番号 |
| `pr` | integer \| null | PR 番号 |
| `round` | integer \| null | ラウンド |
| `role` | `intake` \| `planner` \| `worker` \| `reviewer` \| `critic` | 役 |
| `requested` | `{ model, effort }` | 指定したモデルと effort |
| `actual` | `{ models: string[] }` | 実際に使われたモデル（`modelUsage` のキー、または `assistant` の `message.model`） |
| `modelMatch` | boolean | 指定と実際の一致（R3-3 の (5)） |
| `usd` | number | `total_cost_usd`、無ければ `assistant` の `usage` から見積もった値 |
| `turns` | integer | `num_turns` |
| `durationMs` | integer | 所要時間 |
| `terminated` | `null` \| `"time"` \| `"turns"` \| `"budget"` | 進行役か上限で止めた理由 |
| `execution` | `"ok"` \| `"failed"` | 実行の成否 |
| `work` | `"ok"` \| `"failed"` \| `"n/a"` | 作業の成否 |
| `failureKind` | string \| null | [判定の表][judgments]の 2 節の分類 |
| `contractValid` | boolean | 出力契約の検証の結果 |
| `escalated` | boolean | 2 ラウンド目のモデルの引き上げ（R4-2b）、計画役の `fable` への引き上げ |
| `sessionId` | string | Claude Code の `session_id` |

## 4. lock（`paths.lock`）

```json
{ "pid": 12345, "host": "mac-1", "startedAt": "2026-10-11T09:00:00+09:00", "runId": "…" }
```

PID が生きていなければ奪う（`startedAt` と `runId` を実行の記録の `lock.takenOver` に残す）。

## 5. 指標の算出

[判定の表][judgments]の 9 節の数え方で、GitHub から集計する。手元の記録は役ごとの消費・所要時間・実行の失敗の回数の集計に使う。

| 指標 | 元 |
| --- | --- |
| マージ率、往復の回数、revert 率、一致 | GitHub（PR・印・コメント） |
| 却下率、異議 | GitHub（人の固定の見出し）。dry-run の間は `objections.md` |
| 1 Issue あたりの利用枠、役ごとの消費、実行の失敗の回数、上限で止めた回数 | `sessions/` |
| 見送った実行、起動されなかった日 | `runs/` の `lock.skipped` と、`schedule.intervalMinutes` から期待される実行 ID の欠け |

## 6. 保持

記録は追跡せず、`setup` が置き場を作る。古い記録の削除は人が行う（進行役は消さない）。dry-run の記録は段階が進んでも消さない（段階の出口の証拠）。

[judgments]: ./judgments.md
