---
status: proposed
created: 2026-10-11
updated: 2026-10-11
author: Claude Code（メンテナの依頼で起票）
decision-makers: メンテナ
consulted: 設計レビューの別セッション（整合性・実装可能性・安全側の 3 体）
informed: —
---

# AI の worktree は「AI の作業場所」の clone に作り、進行役はそこへ fetch だけを行う

[要件定義書][req]の D-1 と D-13 を決める。R3-1 の「進行役が自分の clone から切る」を置き換え、SF-2 (b) と SF-5 を補う。

## 背景と課題（Context and Problem Statement）

進行役は専用の clone を 2 つ持つ（SF-5）。「進行役の clone」は進行役だけが書き、`src/` を実行し push を行う。「AI の作業場所」の clone は AI の worktree を切る。
作業フォルダが worktree のとき、Claude Code の sandbox は親 clone の `.git` への書き込みを既定で許す（付録 A）。そのため、worktree をどちらの clone に作るかで、AI が進行役の clone の `.git` を書けるかが決まる。

要件には 3 つの穴が残っていた。

1. R3-1 はレビュー用 worktree を「進行役が自分の clone から切る」と書いており、SF-5 と矛盾する。進行役の clone に worktree を作ると、AI がその `.git/refs` を書き換えられ、同じ実行で進行役が使う `origin/develop` の参照を汚せる
2. 「AI の作業場所」の clone には、base の SHA や人が push した commit の objects を届ける手順が無い。進行役はそこで `worktree add` と `remove` しか行わないと決めている（SF-2 (b)）ので、`worktree add <SHA>` が失敗する
3. 親 `.git` の書ける範囲について、判断 1 の当初は「他の Issue の `.git/worktrees/**` は書けない」とし、訂正では「sandbox が既定で許すので列挙は要らない」とした。並列（段階 6）で他の Issue の `gitdir` や refs を書ける状態になる（D-13）

## 判断の決め手（Decision Drivers）

- AI が進行役の clone に一切書けないこと（SF-2、SF-5）
- `commondir` の差し替えが進行役の git に届かないこと（付録 A：worktree の中で git を実行したときだけ発火する）
- 手順が少なく、0b で確かめた事実の範囲に収まること

## 検討した選択肢（Considered Options）

1. すべての worktree（作業用・レビュー用）を「AI の作業場所」の clone に作る。進行役はその clone に対し `git fetch origin`（読み取りだけ）と `worktree add --detach <SHA>` / `worktree remove --force` だけを行う。並列にするときは「AI の作業場所」の clone を Issue ごとに分ける
2. レビュー用だけ進行役の clone に作る（R3-1 の文言どおり）
3. 「AI の作業場所」の clone に objects を届けるため、進行役の clone から AI の clone へ `git push <パス>` する

## 決定（Decision Outcome）

採用した選択肢:「1」。理由: AI が書ける `.git` を「AI の作業場所」の clone に閉じ込め、進行役の clone には AI の手が届かない。`git fetch origin` は origin からの読み取りで、AI が書いた refs や config を使わない（fetch の実行場所は AI の clone だが、0b で `worktree list/remove` と同じく差し替え先の config を読まないことを確かめた操作に準ずる。0c で `fetch` も再現で確かめる）。

中身：

- 作業 AI・計画役・レビュー AI・批評者の worktree は、すべて「AI の作業場所」の clone（以下 `ai`）に作る
- 進行役が `ai` に対して行う操作は 3 つだけ：`git -C ai fetch --no-tags origin`、`git -C ai worktree add --detach <path> <SHA>`、`git -C ai worktree remove --force <path>`（その後 `branch -D`）。`<SHA>` は進行役の clone で fetch した `origin/develop` か、GitHub の API が返す PR の head
- 作業 AI の commit は、進行役の clone から `git fetch <worktree のパス> <ブランチ>` で取り込む（付録 A で発火しないことを確認済み）
- `commondir` が差し替えられた worktree（`cat` した中身が想定の相対パスでない）には `remove` も行わず、その Issue を `needs-human` にし、点検の warn に出す
- 並列（段階 6）に入るときは、`ai` を Issue ごとに別の clone にする（`ai/<Issue 番号>/`）。1 つの `ai` に同時に 2 つ以上の worktree を持たせない。これで「他の Issue の `.git/worktrees/**` を書ける」状態を作らない（D-13）。`allowWrite` の列挙は行わず、sandbox の既定に任せる
- `.git/worktrees/<名前>/gitdir` は `denyWrite` に入れる（SF-3 のまま）

### 影響（Consequences）

- 良い点: 進行役の clone は AI の書き込みから完全に切り離される。手順は fetch・add・remove の 3 つで、0b で確かめた範囲に収まる
- 良い点: 並列のときも、Issue の間で `.git` を共有しない
- 悪い点: `ai` で `git fetch origin` を実行する分だけ、進行役が AI の clone の中で git を 1 つ動かす。`fetch` は作業フォルダを持たず worktree の config を読まないが、0c で `commondir` の差し替えに対して発火しないことを確かめる
- 悪い点: 並列のときは clone が Issue の数だけ増える（business-os の大きさなら問題にならない）

### 確認方法（Confirmation）

- 0c の点検（S2）で、`ai` の `.git/config` と `hooks/` が sandbox から書けないこと、`commondir` を差し替えた worktree に対する `git -C ai fetch origin` が発火しないことを実際に試す
- 結合テストで、進行役が `ai` に対して上の 3 つ以外の git コマンドを発行しないことを、偽の git で記録して検査する

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 1. すべて `ai` に作り、進行役は fetch・add・remove だけ

- 良い点: 信頼の境界が「clone 単位」で単純
- 良い点: 0b の事実（fetch と worktree 操作は発火しない）に乗る
- 悪い点: `ai` で fetch を 1 つ実行する

### 2. レビュー用だけ進行役の clone に作る

- 悪い点: sandbox が親 `.git` への書き込みを許すので、AI が進行役の clone の refs を書ける。同じ実行の `git diff origin/develop...` が汚れ、漏えい検査と許可一覧の判定が空の差分を見る
- 却下

### 3. 進行役の clone から `ai` へ push で届ける

- 中立: `ai` で git を実行しないで済む
- 悪い点: `ai` の refs を進行役が書くことになり、AI が書き換えた refs との整合を毎回取る必要がある。push は receive-pack を `ai` で起動するので、結局 `ai` の中でコマンドが動く
- 却下

## 補足情報（More Information）

- 関連する要件：R2-1、R3-1、SF-2、SF-3、SF-5、付録 A（0b の 9・12）
- 置き換える文言：R3-1 の「進行役が自分の clone から切る」→「AI の作業場所の clone に切る」。SF-2 (b) の「親 clone に対しては worktree の作成と削除だけ」→「fetch origin と worktree の作成・削除だけ」
- 基本設計への反映：architecture の 1 節・3 節・6 節、sessions の 2 節

[req]: ../requirements.md
