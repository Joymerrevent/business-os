---
status: proposed
created: 2026-10-11
updated: 2026-10-11
author: Claude Code（メンテナの依頼で起票）
decision-makers: メンテナ
consulted: 設計レビューの別セッション（実装可能性・安全側の 2 体）
informed: —
---

# PR と Issue は、head のブランチ名・同じリポ・作者・印の番号の 4 条件で結びつける

[要件定義書][req]の D-9 を決める。R2-5b の `Closes #<番号>` を人向けの表示に格下げし、進行役の判定には使わない。

## 背景と課題（Context and Problem Statement）

基本設計は PR を Issue に結びつけるのに `Closes #n` の参照（GraphQL の `closingIssuesReferences`）を使った。これには 2 つの問題がある。

1. リポの既定ブランチは `main` で、PR は `develop` 向けに作る。`Closes` による結びつけは既定ブランチ向けの PR にしか張られない可能性が高い（R7-4 の「`develop` 向けのため自動では閉じない」も同じ事情）。結びつかなければ、進行役は PR を「無い」と読み、実装の段を繰り返す
2. 公開リポでは外の人が fork から PR を出せる。本文に `Closes #n` と書けば、進行役がその PR をレビューし、修正の段で作業 AI の commit を外の人の commit の上に積む経路になる（4.8 節の表は「外の人の PR は dev-autopilot が扱わない」としている）

## 判断の決め手（Decision Drivers）

- 外の人の PR を取り込まない（4.8 節）
- 既定ブランチに依存しない
- 途中死の後に GitHub だけから PR を見つけられる（SF-9）

## 検討した選択肢（Considered Options）

問い：進行役はどの PR を「この Issue の PR」と見なすか。

- 案A：**4 条件で結びつける**。head のブランチ名が `<型>/issue-<n>`、同じリポ（`isCrossRepository` が偽）、作者が進行役のアカウント、PR 番号が進行役の署名付きの印に書かれている、をすべて満たす PR だけ。open・merged・closed をすべて読む
- 案B：**`Closes #n` で結びつける**。PR 本文の参照（`closingIssuesReferences`）を使う（基本設計の下書きの形）
- 案C：**ブランチ名だけで結びつける**。head のブランチ名が `<型>/issue-<n>` なら結びつける

## 決定（Decision Outcome）

採用した選択肢:「案A：4 条件で結びつける」。理由: 進行役が作った PR だけが 4 条件を満たす。外の人は同じリポのブランチに push できず、進行役のアカウントで作れず、署名付きの印を作れない。

中身：

- 進行役は PR を `repository.pullRequests(headRefName: "<型>/issue-<n>", states: [OPEN, MERGED, CLOSED])` で引き、4 条件で絞る。`Closes #n` は PR 本文に書くが（人向けの表示）、判定には使わない
- PR 番号を印に書く場所：PR を作った直後に、Issue に `note kind=pr ref=<PR 番号>` の印付きコメントを書く（ADR-007 の `note` に `pr` を足す）。途中死で PR はあるが印が無いときは、次回の実行で「作者が進行役で head が一致する open な PR」を見つけたら印を書いて再開する（復旧の手順）
- 4 条件に合わない PR（外の人の PR、人が手で作った PR）が同じブランチ名か同じ Issue 番号で見つかったら、その Issue を `needs-human` にして `note kind=stop reason=foreign-pr` を書く
- Issue 1 件に結びつく PR は 1 件。merged の PR があれば片付け（R7-4）へ、closed（未マージ）の PR があれば `needs-human`（人が閉じた意図を確かめる）

### 影響（Consequences）

- 良い点: 既定ブランチの設定に依存しない
- 良い点: 外の人の PR と人の手の PR を、判定に入れない
- 悪い点: PR の作成と印の投稿の間で死ぬと、次回に復旧の手順が要る（上に定めた）

### 確認方法（Confirmation）

- 結合テストで、fork からの PR（`isCrossRepository` が真）と、人が同じブランチ名で作った PR が結びつかず `needs-human` になることを検査する

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案A：4 条件

- 良い点: 進行役が作った PR だけに絞れる
- 悪い点: 条件が 4 つで、復旧の手順が要る

### 案B：`Closes #n`

- 悪い点: `develop` 向けでは張られない可能性が高い。外の人が本文に書ける
- 却下

### 案C：ブランチ名だけ

- 悪い点: 人が同じ名前のブランチで PR を作ると取り込む
- 却下

## 補足情報（More Information）

- 関連する要件：R2-2、R2-5b、R7-4、4.8 節の表、SF-9、ADR-20261011-007（`note` の印）
- 基本設計への反映：state-machine の 1 節（PR の取り方）・5 節（復旧できない組み合わせ）、judgments の 3 節

[req]: ../requirements.md
