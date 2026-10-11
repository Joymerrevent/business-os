---
status: proposed
created: 2026-10-11
updated: 2026-10-11
author: Claude Code（メンテナの依頼で起票）
decision-makers: メンテナ
consulted: 設計レビューの別セッション（整合性の 1 体）
informed: —
---

# 基線が赤のときは新規の着手だけを止め、Issue に `needs-human` は付けない

[要件定義書][req]の D-5 を決める。R2-8 と 4.10 節の B2 を改める。

## 背景と課題（Context and Problem Statement）

R2-8 は「着手の前に基線（`origin/develop` の最新 commit の必須チェック）が緑であることを確かめ、赤なら着手せず `needs-human`」とし、B2 の契機に「基線が赤」を含める。
基線が赤なのは `develop` の問題で、着手しようとした Issue の問題ではない。Issue に `needs-human` を付けると、`develop` が直った後も人がラベルを外して Status を戻すまで再開しない。候補が 5 件あれば 5 件すべてに付くことになる。
一方で、進行中の Issue（すでに PR がある）は、載せ直しで赤い `develop` を取り込むと CI が赤になり、ADR-003 の規則で修正に回る。これは望ましくない。

## 判断の決め手（Decision Drivers）

- 壊れた基線の上に積まない（R2-8 の目的）
- Issue の状態を、その Issue と無関係な理由で変えない
- `develop` が直ったら人の操作なしで再開する

## 検討した選択肢（Considered Options）

問い：基線（`origin/develop` の必須チェック）が赤のとき、何を止め、Issue に何を付けるか。

- 案A：**新規の着手と載せ直しだけ止め、ラベルは付けない**。進行中の Issue のレビュー・修正・マージ判定は続ける。Issue に `needs-human` は付けず、実行の記録と点検の warn に「基線が赤」を残す
- 案B：**着手せず `needs-human` を付ける**。R2-8 のまま。候補の Issue に `needs-human` を付け、人がラベルを外すまで止める
- 案C：**実行全体を止める**。基線が赤なら、その実行では何も進めない

## 決定（Decision Outcome）

採用した選択肢:「案A：新規の着手と載せ直しだけ止め、ラベルは付けない」。理由: 基線の赤は `develop` の事情なので Issue の欄に書かず、`develop` が直れば次回の実行で自動的に再開する。進行中の Issue は赤い `develop` を取り込まない限り影響を受けない。

中身：

- 基線が赤のとき進行役が止めるもの：棚卸しでの新規の着手（行 13）、載せ直し（`origin/develop` を merge する操作）
- 続けるもの：受け入れ、承認の確定、計画（worktree は赤でない最後の緑の base ではなく、最新の `origin/develop` で作る。実装の段に入るのは基線が緑に戻ってから）、進行中の PR のレビュー・修正・収束・マージ判定・片付け
- 記録：実行の記録に `baseline: red` と赤いチェックの名前を残す。点検（S2）は warn に出す。連続 3 回の実行で赤のままなら、進行役が Issue でなく人に向けた通知（記録と点検の fail）を出す
- `needs-human` は付けない。B2 の契機から「基線が赤」を外す

### 影響（Consequences）

- 良い点: `develop` が直った翌日から自動で再開する
- 良い点: Issue の状態が `develop` の事情で汚れない
- 悪い点: 基線が赤いまま放置されると、新規の着手が止まったまま気づきにくい。点検の fail（3 回連続）で補う

### 確認方法（Confirmation）

- 結合テストで、基線が赤のときに新規の着手と載せ直しが起きず、進行中の PR のレビューは起きることを検査する

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案A：新規の着手と載せ直しだけ止める

- 良い点: 影響の範囲が「赤い base を取り込む操作」に限られる
- 悪い点: 「止めた理由」が Issue に出ないので、記録と点検で補う

### 案B：R2-8 のまま

- 悪い点: 候補のすべてに `needs-human` が付き、`develop` が直っても人がラベルを外すまで止まる
- 却下

### 案C：実行全体を止める

- 悪い点: 進行中のレビューや片付けまで止まる。`develop` と無関係な作業が滞る
- 却下

## 補足情報（More Information）

- 関連する要件：R2-8、4.10 節の B2、S2、R7-3b（載せ直し）
- 置き換える文言：R2-8 の「赤なら着手せず `needs-human`」→「赤なら新規の着手と載せ直しを止め、記録と点検に残す」。B2 の契機から「基線が赤」を外す
- 基本設計への反映：architecture の 2 節（順 4）、judgments の 1 節、state-machine の 3 節

[req]: ../requirements.md
