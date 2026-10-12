# 決めていないこと

## 8. 決めていないこと

基本設計の中で決めてよいもの：

- レビュー側で `pnpm check` を実行するか（CI の結果を待つだけにするか）
- 実行の記録の置き場（`tmp/` か `evals/results/` と同じ扱いの新しいフォルダか。`setup` が作る「記録のフォルダ」の場所。S1）
- 自動化用の GitHub アカウントを分けるか（P9）。分けるなら machine user と GitHub App のどちらか。段階 3 で、1 つのアカウントで COMMENT のレビューと印の判定が動くことを実機で確かめてから決める
- クラウドの仕組みを、手元の cron の代わりか補助に使うか。2026-10-07 の公式の仕様で分かっている範囲：
  - Routine（`/schedule`）：Anthropic のクラウドで動き、GitHub のリポを clone して作業できる。起動は時刻・GitHub の webhook・API。最短 1 時間間隔。Routine 同士の連鎖は未サポート。利用枠を消費する
  - GitHub Actions の claude-code-action：PR のイベントで起動でき、`/code-review --comment` で行にコメントを書ける。レビュー AI だけをここに寄せる案がある
  - 外部のコード実行 sandbox（E2B など）：AI のセッションを Claude Code の sandbox（12 節の判断 1）の代わりに、使い捨てのクラウドの sandbox で動かす案。
    鍵と認証情報をクラウドに置くことになり、「手元の cron で始め、クラウドの仕組みを土台にしない」（2 節）と衝突する。段階 5 の出口を越えて専用マシンへの移行を決めるときの候補に留める
  - 判断の軸：専用マシンの保守の手間、利用枠と課金、鍵と認証情報をどこに置くか、進行役の判定を手元とクラウドで二重に持たないこと

## 見直しで見つけたこと（手順 3 で解く）

要件メモを話題ごとに分けて古い文を消す途中（2026-10-12）で見つけた食い違い。直さずに書き留め、手順 3 で解く。

- **ほかの Issue の作業場所を書き換えられる（要件定義書の D-13）。** 12 節の判断 1 は、書ける場所の一覧（「他の Issue の `.git/worktrees/**` は書けない」を含む）をやめ、sandbox の既定に任せた。
  同じ clone に複数の Issue の worktree があると、ある Issue の AI が別の Issue の `gitdir` や refs を書き換えられる（[05-safety.md][f05]）
- **AI の作業場所の clone に新しい commit が届かない（要件定義書の D-1）。** 進行役は AI の作業場所の clone で worktree を作る・消すだけなので、
  clone に無い commit（`develop` の新しい commit、人の push、載せ直しの結果）から worktree を作れない（[05-safety.md][f05]）
- **AI が書き換えた objects がレビューに届く。** AI が clone の objects のファイルを書き換えると、同じ clone から作ったレビュー用の worktree に書き換えた中身がエラーなしで出て、
  `git fetch origin` を実行しても直らない（[10-verified-facts.md][f10] の 18）。上の項目と一緒に解く
- **`commondir` を書き換えられるかが食い違っている。** 12 節の判断 1 は「AI は自分の `commondir` を書き換えられる」を前提に、進行役が worktree と親 clone の中で git を実行しないと決めている。
  一方、0b の 9 では sandbox が `commondir` を保護していて書けなかった（[10-verified-facts.md][f10]）。守りを多重の守りとして残すなら、前提の書き方を直す
- **段階 2 の Agent 欄（要件定義書の D-6）。** 4.10 節の遷移 5 と「段階による違い」は「段階 2 では Agent 欄を `human` にする」とし、
  同じ節の決まりは「進行役は Agent 欄を `human` にしない」としている（[01-issue-flow.md][f01]）
- **1 回の実行で進める「段」の数え方（要件定義書の D-2）。** R1-5 は段を 7 つ（受け入れ〜片付け）と定めて「1 回の実行で 1 段だけ」とするが、
  4.10 節の遷移表の 2c（承認の確定）・7（収束）・8b（載せ直し）が 7 つのどれに当たるかが無い。遷移 4 の「段階 2〜4 では計画と同じ実行で実装に入らない」は、
  段階 5 以降なら同じ実行で実装まで進むと読め、「1 段だけ」と食い違う。元の文は R2-9 の「段階 5 以降は同じ実行で続け」（[01-issue-flow.md][f01]、[02-implement-review-fix.md][f02]）
- **手元の記録を使うかどうか（要件定義書の D-7）。** R1-5 は「手元の記録は使わない」、運用の規則は「手元の記録は補助にする」としている。
  止まる遷移 B2・B3 の「同じ実行の失敗が 3 回」「累計の利用枠」は実行をまたいで数えるので、手元の記録が要る（[01-issue-flow.md][f01]）
- **検疫で見つかったときの印（要件定義書の D-14）。** I9 は「見つかったら下書きを作らない」と書いた直後に「下書きコメントに『混入の検査：有り（種類）』の行を必ず書く」としている。
  I12 も「有りなら下書きを作らない」。一方、4.12 節の `intake` の印は `quarantine=found` を持ち、下書きを作らないなら印を載せる場所が無い（[04-external-text-and-markers.md][f04]）
- **受け入れの対象とマイルストーンの候補（要件定義書の D-15）。** I12 は受け入れの対象を「マイルストーンが付いている Issue」に限りながら、マイルストーンの候補を出すことになっている。
  2 節の「人の関所」と 4.10 節の遷移 1〜2a は、起票されたら受け入れる流れで、マイルストーンを条件にしていない（[04-external-text-and-markers.md][f04]、[00-overview.md][f00]、[01-issue-flow.md][f01]）
- **準備の作業（5 節）が今どこまで済んでいるか。** 5 節は 2026-10-07 時点の「足りないもの」の一覧で、その後どこまで済んだかを確かめた記録が無い。
  P7 は、`dev-autopilot/` フォルダと構造仕様（`docs/design/architecture.md`）の表は済んでいるが、TypeScript の置き場（`src/` と tsconfig）はまだ無い（2026-10-12 に確認）。
  P5（`develop` の ruleset）や P6（署名の移行）なども 1 つずつ確かめ、済んだものを一覧から外す（[06-setup-and-stages.md][f06]）

## 要件定義書の 10 節から移したこと（手順 3 で解く）

[要件定義書][req]の 10 節「決めていないこと」（D-1〜D-16）のうち、上の節と 8 節に無いもの。文は要件定義書のまま写し、関係する要件のファイルを添えた。

- **D-3** pass なのに CI が赤・無い・保留のときの扱い。赤を修正に回して往復に数えるか、無い・保留は待つか（R4-3。[02-implement-review-fix.md][f02]）
- **D-4** 1 回の実行で `merge=ready` 1 件を超えた PR の扱い（`human` にすると一致の記録が汚れる）（R7-3b。[03-merge.md][f03]）
- **D-5** 基線が赤のとき。R2-8 は `needs-human`。進行中の Issue を続け、新規着手だけ止める案（R2-8、B2。[02-implement-review-fix.md][f02]、[01-issue-flow.md][f01]）
- **D-8** 印の体系の拡張。進行役の投稿すべてに印を付けるか（待ち・催促・警告・停止の理由）、署名の対象に種類・リポ・番号を含めるか、進行役の印が無効化されていたら `needs-human` にするか（4.12 節。[04-external-text-and-markers.md][f04]）
- **D-9** PR と Issue の結びつけ。`Closes #n` でなく head のブランチ名・同じリポ・作者・印の番号で引くか（R2-5b。[02-implement-review-fix.md][f02]）
- **D-10** AI の読み取り範囲と秘密の置き場。Read の許可を worktree に絞りホーム全体を `denyRead` にするか。PAT・鍵・deploy key の置き場。手動実行を `launchctl kickstart` にするか（6 節の (e)。[05-safety.md][f05]）
- **D-11** 権限確認の範囲。`needs-human` を外す・Status を戻す・`plan:*` を付ける操作の人と、渡す文の編集者。渡す文の最終編集が `agent-ready` より後なら `needs-human` にするか（I10、4.10 節の戻す手順。[04-external-text-and-markers.md][f04]、[01-issue-flow.md][f01]）
- **D-16** 要件定義書の 8 節で「未定」とした値（実行時間、受け入れの件数、費用の上限、再試行の間隔、Agent ツール、確信度のしきい値、置き場）をどこで決めるか（設定の項目の一覧は 10 節の守ること 2。[07-structure.md][f07]）

[f00]: ./00-overview.md
[f01]: ./01-issue-flow.md
[f02]: ./02-implement-review-fix.md
[f03]: ./03-merge.md
[f04]: ./04-external-text-and-markers.md
[f05]: ./05-safety.md
[f06]: ./06-setup-and-stages.md
[f07]: ./07-structure.md
[f10]: ./10-verified-facts.md
[req]: ../requirements.md
