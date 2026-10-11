---
status: proposed
created: 2026-10-11
updated: 2026-10-11
author: Claude Code（メンテナの依頼で起票）
decision-makers: メンテナ
consulted: 設計レビューの別セッション（整合性・安全側の 2 体）
informed: —
---

# ラベルの付け外し・Status の戻し・渡す文の編集の操作者を権限確認し、`agent-ready` より後の編集は止める

[要件定義書][req]の D-11 を決める。I10 と I1 を広げる。

## 背景と課題（Context and Problem Statement）

I10 は、Issue の著者・作業指示の投稿者・`agent-ready` を付けた人・コメントを編集した人を権限確認の対象にする。次の操作は対象に無い。

- `needs-human` を外す（再開の合図）、Status を `Blocked` から戻す、`plan:fable` / `plan:opus` を付ける
- 渡す文（下書き、作業指示）を `agent-ready` の後に編集する

triage 権限でもラベルは付け外しでき、Project に書ける人は Status を戻せる。漏えい検査で止めた Issue から triage 権限の人が `needs-human` を外せば、作業が再開する。
また `intake-final` の印は「次回の実行の時点の渡す文」のハッシュを取るので、人が下書き X を読んで `agent-ready` を付けた後に、別の人が下書きを Y に編集すると、人が読んでいない Y で確定する。

## 判断の決め手（Decision Drivers）

- 人の関所（下書きを読んで承認する）が実際に効くこと
- push 未満の権限で作業を再開させない
- 権限確認の API 呼び出しを増やしすぎない

## 検討した選択肢（Considered Options）

問い：`needs-human` を外す・Status を戻す・`plan:*` を付ける操作の人と、渡す文の編集者を権限確認するか。`agent-ready` より後に編集された文をどう扱うか。

- 案A：**すべて権限確認し、承認より後の編集は止める**。上の操作者と編集者を確認し、渡す文の最終の編集時刻が `agent-ready` の付与より後なら `needs-human`
- 案B：**GitHub 側の権限で守る**。操作者は確認せず、リポの triage 権限を無くして防ぐ
- 案C：**今のまま**。渡す文の編集は、進行役が `intake-final` を投稿した後だけ検出する

## 決定（Decision Outcome）

採用した選択肢:「案A：すべて権限確認し、承認より後の編集は止める」。理由: GitHub 側の権限の設定は適用先のリポごとに違いうるので、進行役が確かめる。確認の回数は Issue ごとに数回で済む。

中身：

- 権限確認の対象に足すもの：`needs-human` を外した人、Status を `Blocked` から戻した人（Project の項目の変更者。GraphQL で取れなければ timeline の `IssueComment` でなく `ProjectV2ItemFieldValue` の更新者を見る。取れない場合は 0c で確かめ、取れなければ「人が戻したら `note kind=resume` のコメントを書く」運用に替える）、`plan:fable` / `plan:opus` を付けた人、渡す文（下書き・作業指示・本文）の編集者（`userContentEdits` の各 `editor`）
- 満たさない操作は無効として扱う：`needs-human` を外した人が push 未満なら付け直す。Status を戻した人が push 未満なら `Blocked` に戻す。`plan:*` を付けた人が push 未満なら無視する。編集者が push 未満なら `needs-human`
- 時刻の規則：渡す文の投稿時刻と最終の編集時刻（`lastEditedAt`）が、`agent-ready` の `LabeledEvent` の時刻より後なら `needs-human`（人が読んでいない文で確定しない）。人が自分で編集してから `agent-ready` を付け直す運用にする
- 権限の API は `GET /repos/{o}/{r}/collaborators/{user}/permission` の `role_name`（`admin` `maintain` `write` を push 以上とする。`permission` の欄は `maintain` を返さないので使わない）

### 影響（Consequences）

- 良い点: 人の関所が「読んだ文で確定する」ことを機械で保証できる
- 良い点: triage 権限の人が止めた Issue を再開させられない
- 悪い点: 人が下書きを直した後に `agent-ready` を付け直す手間が増える（直してから付ける順を運用の文書に書く）
- 悪い点: Status の変更者を API で取れるかは未確認（0c で確かめ、代替を用意した）

### 確認方法（Confirmation）

- 結合テストで、`agent-ready` の後に編集された下書きが `needs-human` になること、push 未満の操作者のラベル操作が無効になることを検査する

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案A：すべて確認し、時刻で止める

- 良い点: リポの権限設定に依存しない
- 悪い点: API 呼び出しと運用の手間が少し増える

### 案B：GitHub 側の権限で守る

- 悪い点: 適用先のリポごとに前提が変わる。`setup` で確かめられるが、進行役が信頼する根拠が外にある
- 却下

### 案C：いまのまま

- 悪い点: 人が読んでいない文で確定しうる
- 却下

## 補足情報（More Information）

- 関連する要件：I1、I10、I12、4.10 節の「戻す手順」、SF-11
- 置き換える文言：I10 の対象に上の操作者を足す。I1 に時刻の規則を足す
- 基本設計への反映：judgments の 3 節、state-machine の 1 節・3 節

[req]: ../requirements.md
