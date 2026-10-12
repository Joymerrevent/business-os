---
status: proposed
created: 2026-10-11
updated: 2026-10-12
author: Claude Code（メンテナの依頼で起票）
decision-makers: メンテナ
consulted: 設計レビューの別セッション（整合性・実装可能性・安全側の 3 体）
informed: —
---

# AI の作業場所は AI のセッションごとに origin から clone し直し、進行役は AI が触った clone からは fetch で取り込むだけにする

[要件定義書][req]の D-1 と D-13 を決める。R2-1・R3-1・SF-2 (b)・SF-5 の文言を改め、AI の作業場所の置き場と、人が AI の作業を見る方法を書き足す。

## 背景と課題（Context and Problem Statement）

次の 3 点は[要件メモ][memo]の 12 節の判断 1（2026-10-11 の訂正）で決まっており、本 ADR では選択肢にしない。

- 進行役は専用の clone を 2 種類持つ。「進行役の clone」（以下 `ctl`）は進行役だけが書き、`src/` を実行し、fetch・merge・push を行う。AI の worktree は「AI の作業場所」の clone から作る（SF-5）
- 作業フォルダが worktree のとき、Claude Code の sandbox は親 clone の `.git` への書き込みを既定で許す。AI は親 clone の objects・refs・`gitdir` を書ける（付録 A）
- 進行役は worktree の中で git を実行しない。AI の commit は `ctl` へ fetch で取り込む。`commondir` を差し替えても、別の clone からの fetch は発火しない（SF-2 (b)、付録 A）

要件には次の穴が残っていた。

1. 要件メモの R3-1 は、レビュー用 worktree を「進行役が自分の clone から切る」と書いていた。clone を 2 種類に分けた訂正に文言が追随しておらず、`ctl` に worktree を作ると AI が `ctl` の refs を書ける。要件定義書の R3-1 は作り元を書いていない
2. AI の作業場所の clone に新しい commit を届ける手順が無い。進行役は AI の作業場所の clone で worktree の作成と削除しか行わない（SF-2 (b)）ので、clone に無い commit（`develop` の新しい commit、人の push、進行役の載せ直しの結果）で worktree を作れない
3. 1 つの clone に複数の Issue の worktree があると、ある Issue の AI が他の Issue の `gitdir` や refs を書ける（D-13）
4. AI の作業場所の置き場、clone の作り方、人が AI の作業を見る方法が、要件にも基本設計にも無い

起票の後の試行（2026-10-12）で、次の 2 つの事実が分かった。手順と結果は「補足情報」に書く。

- AI が clone の objects のファイルを書き換えると、同じ clone から作った worktree には書き換えた中身がエラーなしで出る。`git fetch origin` を実行しても直らない。一方、書き換えた objects を別の clone へ送ると受け取り側の検査で失敗するので、`ctl` には書き換えた中身が入らない
- 手元の clone のパスから `git clone` すると、git は objects のファイルをハードリンクで共有する。`file://` か origin の URL から clone すると共有しない

1 つ目の事実から、作業 AI のセッションが触った clone からレビュー用 worktree を作ると、作業 AI がレビュー AI と批評者に PR と違う中身を読ませられる。

## 判断の決め手（Decision Drivers）

- AI が `ctl` に一切書けないこと（SF-2、SF-5）
- AI のセッションが、前のセッションの AI が細工した `.git` を読まないこと。とくにレビュー AI と批評者が、PR の本当の中身を読むこと
- 進行役が git を実行する clone を、AI がまだ触っていない clone に限ること。AI が触った clone には、0b で確かめた操作（別の clone からの fetch）しか行わないこと
- 手順が少なく、手元の記録に頼らないこと

## 検討した選択肢（Considered Options）

問い：AI のセッション（計画・実装・修正・レビュー）ごとに、作業場所をどう用意するか。前のセッションの後に増えた commit（載せ直しの結果、人の push、`develop` の新しい commit）をどう渡すか。

- 案A：**セッションごとに origin から clone し直す**。AI のセッションを起動するたびに origin の URL から新しい clone を作り、AI が触る前に新しい clone から worktree を作る。古い clone は、同じ名前で作り直す直前か片付けのときに、フォルダごと消す
- 案B：**Issue ごとの clone を使い続け、`git fetch origin` で届ける**。Issue ごとの clone を片付けまで使い続け、進行役が Issue ごとの clone で `git fetch --no-tags origin` を実行して新しい commit を届ける（本 ADR の 2026-10-11 の版が採っていた案）
- 案C：**Issue ごとの clone を使い続け、`ctl` から push で届ける**。clone の使い方は案B と同じで、新しい commit は `ctl` から `git push <パス>` で送る

## 決定（Decision Outcome）

採用した選択肢:「案A：セッションごとに origin から clone し直す」。理由: 進行役が git を実行する clone を、`ctl` と AI がまだ触っていない clone に限れる。AI が触った clone は `ctl` へ fetch で取り込む元にするだけなので、0b で確かめた操作の範囲に収まる。前のセッションの AI が細工した objects を、次のセッション（とくにレビュー AI と批評者）が読まない。

中身：

- 置き場：AI の作業場所は設定の `paths.home` の下に置く。人の clone の中にも、人の clone の worktree としても作らない（R2-1）

  ```text
  <paths.home>/
    ctl/                               進行役の clone
    ai/<型>-issue-<番号>/               計画役と作業 AI の clone（セッションごとに作り直す）
    ai/review-<PR 番号>-<ラウンド>/      レビュー AI と批評者の clone
    wt/<型>-issue-<番号>/               ai/<型>-issue-<番号>/ から作る worktree（AI の作業フォルダ）
    wt/review-<PR 番号>-<ラウンド>/      ai/review-<PR 番号>-<ラウンド>/ から作る worktree
  ```

- 手元の Mac で動かす間は、`paths.home` を人の clone と同じ階層のフォルダにしてよい（例：人の clone が `<リポ名>.worktrees/<リポ名>/` なら `<リポ名>.worktrees/autopilot/`）。人の作業場所と分けたくなったら `<リポ名>.autopilot/` に移す。移すときは実行を止め、`ctl` を移して `paths.home` を書き換える。AI の作業場所は次のセッションで作り直される
- clone は origin の URL から作る。手元の clone（`ctl` を含む）のパスからは作らない。パスから作ると git が objects のファイルをハードリンクで共有し、AI が書き換えると `ctl` の objects まで変わるおそれがある
- 作る手順は 2 つで、どちらも AI のセッションを起動する前に進行役が行う
  1. `git clone --no-checkout --no-tags <origin の URL> ai/<名前>`
  2. 計画役と作業 AI は `git -C ai/<名前> worktree add -b <ブランチ> wt/<名前> <SHA>`、レビュー AI と批評者は `git -C ai/<名前> worktree add --detach wt/<名前> <SHA>`。`<SHA>` は、計画と最初の実装では `ctl` で fetch した `origin/develop`、修正とレビューでは GitHub の API が返す PR の head
- 修正の段でも worktree を作り直す。前のセッションの作業フォルダの中身（commit していないファイル、ビルドの結果、`node_modules`）は引き継がない。作業 AI に引き継ぐのは commit と、進行役が渡すレビューの指摘だけ
- 取り込み：作業 AI の commit は `git -C ctl fetch <wt のパス> <ブランチ>` で取り込む（付録 A：発火しない）
- AI のセッションを起動した後の clone では、取り込みの fetch の元にする以外に git を実行しない。`git fetch origin`・`worktree remove`・`branch -D` も行わない
- 消す：AI の作業場所は、同じ名前で作り直す直前と、片付け（R7-4）のときに `ai/<名前>/` と `wt/<名前>/` をフォルダごと消す。git は実行しない。消す前に `ai/<名前>/.git/worktrees/<名前>/commondir` と `gitdir` をファイルとして読み、中身が作ったときと違えば、消さずに作業場所の Issue を `needs-human` にして点検の warn に出す
- 並列（D-13）：clone は Issue ごと・レビューのラウンドごとに別なので、Issue の間でも、作業とレビューの間でも `.git` を共有しない。WIP の上限を上げても同じ形のまま動き、段階 6 で形を切り替えない。`allowWrite` の列挙は行わず、sandbox の既定に任せる
- `.git/worktrees/<名前>/gitdir` は `denyWrite` に入れる（SF-3 のまま）
- 人の見方
  - AI のブランチは、進行役が push した後に、人の clone で fetch した `origin/<型>/issue-<番号>` として見る。差分は PR の画面で読む。人が引き継ぐとき（Agent 欄を `human` にしたとき）は、`origin/<型>/issue-<番号>` から手元のブランチを作る
  - `paths.home` の下の clone を、人の clone の remote に登録しない。AI が書いた refs と objects を、人の clone へ直接入れないため
  - `paths.home` の下のフォルダを、人のエディタのワークスペースに入れない。エディタと拡張機能（git の表示、lint の設定の読み込みなど）が、AI の書いた設定やコードを人の権限で sandbox の外で実行するおそれがあるため（試行していない）

### 影響（Consequences）

- 良い点: 進行役が git を実行するのは、`ctl` と AI がまだ触っていない clone だけになる。AI が触った clone には、0b で確かめた取り込みの fetch しか行わない
- 良い点: レビュー AI と批評者は、origin から取ってきたままの PR の中身を読む。作業 AI が objects を細工しても、レビュー用の clone には届かない
- 良い点: Issue の間でも作業とレビューの間でも `.git` を共有しないので、`allowWrite` の列挙も段階 6 での切り替えも要らない（D-13）
- 良い点: worktree を作り直すかどうかの判定が無く、手元の記録を使わない
- 悪い点: AI のセッションごとに clone と依存の導入（`pnpm install`）をやり直す。business-os の clone（`--no-checkout`）は 2026-10-12 の計測で約 1.5 秒。`pnpm install` の時間は計測していない
- 悪い点: 作業 AI は、前のセッションの作業フォルダに残したものを修正の段で使えない

### 確認方法（Confirmation）

- 0c の点検（S2）で次を実際に試す
  - AI が objects を書き換えた clone から `ctl` へ fetch すると失敗し、`ctl` に書き換えた中身が入らないこと
  - `ctl` と AI の作業場所の clone に、リンク数が 2 以上の objects のファイルが無いこと（`find <clone>/.git/objects -type f -links +1` の出力が空）
  - `.git/worktrees/<名前>/gitdir` が sandbox から書けないこと
- 結合テストで、偽の git を使って次を検査する
  - 進行役が、AI のセッションを起動した後の clone に対して、`ctl` からの取り込みの fetch 以外の git コマンドを発行しないこと
  - 消す前に読んだ `commondir` か `gitdir` が作ったときと違うと、消さずに `needs-human` になること

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案A：セッションごとに origin から clone し直す

- 良い点: 進行役は AI が触った clone で git を実行しない（取り込みの fetch を除く）
- 良い点: 前のセッションが細工した objects を、次のセッションが読まない
- 良い点: 片付けがフォルダの削除だけで済む
- 悪い点: セッションごとに clone と `pnpm install` をやり直す

### 案B：Issue ごとの clone を使い続け、`git fetch origin` で届ける

- 良い点: clone は Issue ごとに 1 回で済み、作業フォルダの中身を修正の段に引き継げる
- 悪い点: AI が書き換えた objects が clone に残る。`git fetch origin` は手元にある objects を取り直さないので直らず、同じ clone から作ったレビュー用 worktree に書き換えた中身が出る（2026-10-12 の試行）。作業 AI がレビュー AI に、PR と違う中身を読ませられる
- 悪い点: AI が触った clone の中で `fetch`・`worktree remove`・`branch -D` を実行する。`fetch` は 0b で確かめていない
- 却下

### 案C：Issue ごとの clone を使い続け、`ctl` から push で届ける

- 悪い点: AI が書き換えた objects が残る点は案B と同じ。push も、受け取り側がすでに持っている objects は送らない
- 悪い点: push は AI が触った clone の中で receive-pack を起動し、AI が触った clone の refs を進行役が書く
- 却下

## 補足情報（More Information）

- 関連する要件：R2-1、R3-1、R7-4、SF-2、SF-3、SF-5、付録 A（worktree で `git commit` が通ること、`commondir` の差し替えと fetch）
- 前提にした要件メモの決定：12 節の判断 1（2026-10-10 の決定と 2026-10-11 の訂正）。2026-10-10 の決定は「Issue ごとの clone にする案」を退けて worktree を残した。本 ADR も worktree を残す（sandbox が親の `.git` を守ることを 0b で確かめた形のため）。作り直すのは worktree の親の clone である
- 2026-10-12 の試行（git 2.50.1、使い捨てのリポジトリで実施）
  - commit した後に loose object のファイルを別の中身で書き換え、`git worktree add --detach` で取り出すと、終了コード 0 で書き換えた中身が出た。`git fsck` は hash-path mismatch を報告した
  - 同じ clone で `git fetch --no-tags origin` を実行し（終了コード 0）、書き換えたファイルを変えない新しい commit で worktree を作っても、書き換えた中身のままだった。origin から新しく clone して同じ commit で worktree を作ると、正しい中身が出た
  - 書き換えた clone を `file://` で別の場所へ clone すると、`did not receive expected object` で失敗した
  - 手元のパスから clone した objects のファイルはリンク数 2、`--no-hardlinks` と `file://` の URL から clone したものはリンク数 1 だった
- 要件定義書への反映（承認の後に行う）
  - R2-1：「AI の作業場所の clone から」→「AI のセッションごとに origin の URL から clone した AI の作業場所の clone から」
  - R3-1：「作業場所は進行役が PR の head（API の SHA）で切る専用の worktree」→「作業場所は、進行役がレビューのたびに origin の URL から clone し、PR の head（API の SHA）で切る専用の worktree」
  - SF-2 (b)：「親 clone に対しては worktree の作成と削除だけを行う（`commondir` が差し替えられた worktree には行わず `needs-human`）」→「AI の作業場所の clone では、AI のセッションを起動する前の clone と worktree の作成だけを行い、起動した後は `ctl` への取り込みの fetch の元にするだけにする。消すときはフォルダごと消し、`commondir` か `gitdir` が作ったときと違えば消さずに `needs-human`」
  - SF-5：「AI の作業場所」の clone は AI のセッションごとに origin の URL から作り直し、手元の clone のパスからは作らないことを書き足す
  - 10 節から D-1 と D-13 を消す
- 基本設計への反映（承認の後に行う）：architecture の 1 節（配置、`paths.home` の置き方、人の見方）、3 節（計画・実装・修正・レビュー・片付けでの作業場所の作り方と消し方）、6 節（git の操作の表）

[req]: ../requirements.md
[memo]: ../dev-autopilot-requirements.md
