---
status: proposed
created: 2026-10-11
updated: 2026-10-11
author: Claude Code（メンテナの依頼で起票）
decision-makers: メンテナ
consulted: 設計レビューの別セッション（整合性・実装可能性の 2 体）
informed: —
---

# 段階 2 の Agent 欄は空にし、マージ後の片付けは `human` と `paused` の除外より先に行う

[要件定義書][req]の D-6 を決める。4.10 節の遷移 5 と「決まり」の矛盾を解く。

## 背景と課題（Context and Problem Statement）

4.10 節の遷移 5 は「段階 2 ではレビュー AI が無いので Agent 欄は `human`（人がレビューする）」とし、同じ節の決まりは「進行役は Agent 欄を `human` と `paused` にしない。この 2 つは人の意思表示」とする。両方は成り立たない。
さらに、進行役は Agent 欄が `human` の Issue に触らない（SF-11）ので、段階 2 で PR がマージされても片付け（Issue を閉じる、worktree を消す）が起きず、Issue は `In Review` のまま WIP の 1 枠を占め続ける。

## 判断の決め手（Decision Drivers）

- `human` と `paused` は人の意思表示という意味を保つ
- 段階 2 で「人がレビューする」ことが Project の表示から分かる
- マージされた PR の片付けはどの状態でも起きる

## 検討した選択肢（Considered Options）

問い：段階 2（人がレビューする）で draft PR を作ったとき、Agent 欄に何を書くか。片付けの判定を `human` と `paused` の除外より先に行うか。

- 案A：**空にし、片付けを除外より先に判定する**。段階は設定の `stage` で分かるので欄に書かない。「PR がマージされた → 片付け」を `human` と `paused` の除外より先に判定する
- 案B：**段階 2 だけ進行役が `human` を書く**。「進行役は `human` を書かない」の決まりに例外を設ける
- 案C：**`human-review` の値を足す**。Agent 欄の選択肢を増やし、段階 2 ではそれを書く

## 決定（Decision Outcome）

採用した選択肢:「案A：空にし、片付けを除外より先に判定する」。理由: 欄の意味を変えずに矛盾を解ける。「段階 2 では人がレビューする」は設定の `stage` と運用の文書で示す。

中身：

- 遷移 5（draft PR を作る）の Agent 欄は、段階 3 以降は `reviewer`、段階 2 は空
- 進行役が Agent 欄に書く値は `worker` `reviewer` と空だけ。`human` と `paused` は人だけが書く（決まりのまま）
- 次の段の決定（基本設計 state-machine の 3 節・4 節）では、「PR がマージされている → 片付け」を、`needs-human`・`human`・`paused` の除外より先に判定する。片付けは Issue を閉じ worktree を消すだけで、人の意思表示（`human`・`paused`）は上書きしない
- 段階 2 で人がレビューを終えてマージしたら、次回の実行で片付けが起きて `Done` になる

### 影響（Consequences）

- 良い点: 欄の意味が 1 つに保たれる
- 良い点: どの段階でもマージ後の片付けが止まらない
- 悪い点: 段階 2 の間は Project の Agent 欄だけでは「人の番」と分からない。Status が `In Review` で Agent 欄が空なら人の番、と運用の文書に書く

### 確認方法（Confirmation）

- 結合テストで、`human` の Issue の PR がマージされたときに片付けが起き、Agent 欄が `human` のまま残ることを検査する

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案A：空にし、片付けを先に判定

- 良い点: 既存の値と意味を変えない
- 悪い点: 段階 2 の表示が弱い

### 案B：段階 2 だけ進行役が `human` を書く

- 悪い点: 「人の意思表示」の意味が崩れ、人が付けた `human` と区別できない
- 却下

### 案C：値を足す

- 悪い点: 段階 2 の間だけのために欄の選択肢が増え、`setup` と点検の項目が増える
- 却下

## 補足情報（More Information）

- 関連する要件：R2-6、4.10 節（遷移 5、決まり）、SF-11、R7-4
- 置き換える文言：遷移 5 の「段階 2 は `human`」→「段階 2 は空」
- 基本設計への反映：state-machine の 3 節（先取りの順）・4 節（行 1 を除外より先に）

[req]: ../requirements.md
