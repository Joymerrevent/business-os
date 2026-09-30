---
name: close
description: 月次の締め。事業ごとの収支、全社の資金と来月の支払い予定、来月の期限を、数字の基準日（as_of）付きで月次レビューにまとめる。月初に前月分を締めるときに使う。
disable-model-invocation: true
---

# /close

## 何をするか

対象の月（既定は前月。月末の当日なら当月でもよい）を締め、`docs/operations/reviews/monthly-YYYY-MM.md` を書く。

数字は人間から聞く。**CC は数字を推測で埋めない。** 分からない数字は「未入力」と書く。
全ての数字に基準日（`as_of`）を付ける。数字の正確さより、「いつ時点の数字か」が正確であることを優先する。

## 何を読むか

1. `${CLAUDE_SKILL_DIR}/../../templates/skill-conventions.md`（共通規約。最初に必ず読む）
2. `${CLAUDE_SKILL_DIR}/../../templates/operations/reviews/monthly.md`（雛形）
3. 対象月の週次レビュー `docs/operations/reviews/weekly-*.md`
4. `data/` に数字のファイル（CSV など）があれば、その中身と更新日
5. `docs/operations/obligations.md`（来月の期限）
6. `docs/charter/businesses/*.md`（事業ごとの「追いかける数字」）

## 手順

1. 対象の月を確かめる（例：今日が 2026-10-02 なら 2026-09）
2. **数字の基準日（`as_of`）を最初に聞く**（例：「9 月末時点の数字ですか、今日時点ですか」）。答えを `YYYY-MM-DD` にする
3. 事業ごとに、売上・費用と、その数字の出どころ（会計ソフト、銀行明細、概算 など）を聞く。
   `data/` にファイルがあれば読み取った値を示し、正しいか確かめる。差額は CC が計算する
4. 全社の資金残高と、来月の支払い予定を聞く
5. `obligations.md` から来月の期限を拾って示す。対象月に済んだ義務があれば「済」にし、次回の行を足してよいか聞く
6. 事業ごとの「追いかける数字」（KPI）について、今月の値を聞く。KPI の定義を変えたいという話が出たら、
   `docs/charter/businesses/<事業 ID>.md` の変更として提案を書き、`/approve` を案内する
7. 月次レビューを書き出す。既にあれば `created` を変えずに更新する

## 何を書くか

- `docs/operations/reviews/monthly-YYYY-MM.md`（`as_of` 必須）
- `docs/operations/obligations.md`（済んだ義務と次回の行）
- KPI の定義の見直しにあたるときは提案（`docs/proposals/`）
- 日報への実行記録（例：`- 10:00 /close — 2026-09、as_of 2026-09-30、未入力 1 件`）

## 人に何を聞くか

- 数字の基準日
- 事業ごとの売上・費用とその出どころ、全社の資金残高、来月の支払い予定
- 済んだ義務の扱い、KPI の値
- 最後にコミットしてよいか

## 完了条件

- 月次レビューの `as_of` が日付で入り、本文の冒頭にも基準日が書かれている
- 推測で埋めた数字が無い（分からないものは「未入力」）
- 済んだ義務が台帳に反映されている
- 日報に実行記録が 1 行ある
