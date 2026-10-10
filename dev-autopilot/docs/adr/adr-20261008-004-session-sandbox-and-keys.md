---
status: proposed
created: 2026-10-08
updated: 2026-10-10
author: Claude Code（メンテナの要件メモから起票）
decision-makers: メンテナ
consulted: 別の文脈のレビュー AI 2 体（安全側・実現性）
informed: n/a
---

# AI のセッションに sandbox を掛け、鍵は人用と自動化用に分け、作業 AI の commit は署名しない

## 背景と課題（Context and Problem Statement）

dev-autopilot では、進行役（Node のスクリプト）が `claude -p` で作業 AI・レビュー AI・批評者を起動し、作業 AI が worktree の中で commit を作り、進行役が push・PR の作成・マージを行う（[要件メモ][memo] 3 節、R2-5、R7-1、ADR「[GitHub への書き込みはすべて進行役が行い、AI は出力契約で結果を返す][adr-20261008-003-github-writes-by-orchestrator]」（ADR-20261008-003））。
AI のセッションをどう隔離し、鍵と署名をどう分けるかは、要件メモ 12 節「人の判断が要るもの」の 1 として人の判断に回されていた。論点は 4 つある。

- 開発リポ business-os は sandbox を使わない。同じ OS ユーザーで動く AI のセッションは、`~/.ssh` の鍵と `~/.config/gh` の認証情報を Bash から読める。`Read(~/.ssh/**)` の deny は Read ツールにしか効かない（P13）。
  レビュー AI は PR のコードを実行して確かめるので、作業 AI が書いたコードがレビュー AI の環境にある鍵やトークンを読み取れてしまう。
- worktree は `.git` を共有する。作業 AI が `.git/hooks` や `.git/config`（`core.fsmonitor` `core.sshCommand` など）を書き換えると、進行役が同じ `.git` で git を動かしたときに、仕込まれたコマンドが進行役の権限で実行される。
- GitHub の deploy key は認証専用で、署名の検証には使えない。「リポに絞った鍵 1 本で push も署名も」は成り立たない。
- 人の commit の署名は、パスワード管理ツールの SSH agent のソケットに頼っている（P6）。無人のマシンでは agent が無く、人の鍵を置けば AI から読める。

問い：AI のセッションから人の鍵と GitHub の認証情報を隠し、作業ブランチの commit と `develop` の commit の署名をどう扱い、自動化の鍵をどこまで絞るか。

## 判断の決め手（Decision Drivers）

- 実行する層（AI のセッション）に書き込みの権限と鍵を持たせず、GitHub への書き込みは進行役だけが行う（P13、R2-5）
- 人の鍵が漏れたときと自動化の鍵が漏れたときで、影響の範囲が分かれていること
- 作業ブランチの push が通ること。作業ブランチの commit に署名を求めると、署名鍵を AI のセッションに置くことになり、1 つ目の決め手と矛盾する
- 専用マシンの前に手元の Mac で試す間も、同じ設定で動くこと。試験の段階で普段の鍵が読まれないこと
- 設定に「書いてある」ではなく「実際に読めない・書けない」ことを機械で確かめられること（要件メモ 6 節、fail-closed）
- business-os の利用者向けの防衛（`plugin/templates/settings.json.tmpl` の sandbox の節）と同じ考え方で揃えること

## 検討した選択肢（Considered Options）

- 案 A: AI のセッションに Claude Code の sandbox を掛け、鍵を人用と自動化用の 2 系統に分ける
- 案 B: AI のセッションを別の OS ユーザーで動かす
- 案 C: 同じ OS ユーザーのまま鍵と git 設定の共有を受け入れ、段階 5（進行役のマージの判定）を見送る

## 決定（Decision Outcome）

採用した選択肢:「案 A」。理由: 人の鍵と GitHub の認証情報を AI のセッションから隠しつつ、手元の Mac と専用マシンの両方で同じ設定が使え、段階 5 まで進める唯一の選択肢だから（要件メモ 12 節の判断 1、2026-10-08 の決定）。中身は次のとおり。

1. **安全設定を `--settings` で渡し、プロジェクトの設定と hook は読まない。** AI のセッション（作業 AI・レビュー AI・批評者）は、`--setting-sources user` で起動し、dev-autopilot が `--settings` で渡す安全設定で動かす。
   プロジェクトの `.claude/settings.json` と hook は読まない。hook は Bash の外で動き sandbox が掛からないため、作業 AI が書き換えた hook がレビュー AI のセッションで動く経路を断つ。
   sandbox を有効にし、`denyRead` に `~/.ssh`・`~/.config/gh`・鍵と PAT の置き場（3）・進行役の設定と記録を入れ、書き込みは担当する Issue の worktree と一時フォルダと、commit に要る `.git/objects` `.git/worktrees/<名>` だけに絞り、`allowUnsandboxedCommands: false` とし、外への通信は許可した先（npm のレジストリなど）だけにする。
   雛形は business-os の `plugin/templates/settings.json.tmpl` の sandbox の節を元にする。npm のキャッシュとプロキシの設定は business-os の sandbox の既存の設定（ADR 20261006-01）を写す。
   `--setting-sources user` でプロジェクト設定と hook が読まれないことは、段階 0b の残る確認 (c)（ADR「[進行役は決定的なスクリプトにし、AI は作業・レビュー・批評の 3 つの役だけを担う][adr-20261008-001-orchestrator-and-ai-roles]」（ADR-20261008-001）の段階表）で実機で確かめる。
2. **作業 AI の commit は署名しない。** セッションの git 設定で `commit.gpgsign=false` にする。`develop` への squash マージの commit は GitHub が作って署名するので Verified になる。
   作業ブランチの commit はマージ後に消えるため、進行役が署名し直す仕組みは持たない。`develop` の ruleset に「署名必須」は入れない（入れると作業ブランチの push が通らない）。
3. **鍵は 2 系統、置き場は 1 つのフォルダ。** 人の署名鍵（手元の SSH 鍵。dev-autopilot は触らない）と、dev-autopilot のマシン専用の deploy key（business-os だけに書き込み可。進行役だけが使う）。
   deploy key と、business-os に絞った fine-grained PAT のファイルは、1 つのフォルダに置く。初期値は `~/.dev-autopilot/`（同期されないパス。権限 700）。安全設定の `denyRead` には `~/.dev-autopilot/**` を実体のパスで入れる。
   進行役は PAT を置き場のファイルから読み、子プロセスの環境変数に渡さない（AI のセッションには渡さず、`gh` には呼び出し 1 回ごとに該当の呼び出しにだけ渡す）。`gh auth login` でマシンに残さず、launchd の plist に秘密を書かない。AI のセッションには `GH_TOKEN` を渡さず、`gh` を認証しない（P13）。
4. **作業 AI が触った `.git` を信用せず、別の clone に取り込んでから push する。** 進行役は dev-autopilot 専用の clone を使い、そこから Issue ごとの worktree を切る。
   進行役は、作業 AI が触った worktree の `.git`（共有の `.git/worktrees/<名>` を含む）の config と hook を信用せず、別の clone に `git fetch <worktree のパス> <ブランチ>` で commit を取り込んでから push する。取り込みは objects だけで、作業 AI 側の config は読まない。
   `core.fsmonitor` `core.sshCommand` などの実行経路も作業 AI 側の `.git` で有効になりうるため、進行役は作業 AI 側の git を一切実行しない。進行役自身の clone では `core.hooksPath` を空のフォルダに固定する。
   denyWrite は worktree と、commit に要る `.git/objects` `.git/worktrees/<名>` に限る。denyWrite をそこまで絞ったときに作業 AI の commit が通るかは、段階 0b の残る確認 (a) で実機で確かめる。
5. **`develop` に ruleset を掛ける。** PR 必須・force push 禁止・base と最新であること（P5、R7-3b）。deploy key で直接 push できるのは作業ブランチだけになる。
6. **手元の Mac で試す間も同じ設定で動かす。** sandbox が人の鍵と gh の設定を AI から隠すので、試験の段階で普段の鍵が読まれることも防げる。
7. **`denyRead` のパスは実体に解決して書き、読めないことを試して確かめる。** sandbox の `denyRead` はシンボリックリンクを解決しない（補足情報の 0b の結果）。
   `setup` は `denyRead` と `denyWrite` の各パスを実体に解決してから書く（リンクの場合は両方のパスを書く）。`check` は「設定に書いてある」ではなく、sandbox の中で読み取りを試して「実際に読めない」ことを確かめる。鍵と PAT の置き場（3）も同じ方法で確かめる（段階 0b の残る確認 (b)）。
   dev-autopilot 用の鍵も人の新しい署名鍵も、同期フォルダに同期されないパスに置く。
8. **push の前に進行役が漏えいを検査する。** `check:leak` 相当の検査（鍵の形式、メールアドレス、機械上のパス）を diff に回し、引っかかれば push せず `needs-human` を付ける（R2-14）。

### 影響（Consequences）

- 良い点: 人の鍵・GitHub の認証情報・進行役の記録が AI のセッションから読めなくなり、作業 AI が書いたコードをレビュー AI が実行しても鍵が漏れない（P13 の解消）
- 良い点: deploy key は business-os への書き込みだけ、PAT は business-os に絞った権限だけで、どちらが漏れても影響は business-os の作業ブランチと Project の欄に留まる。置き場が 1 つのフォルダなので、`denyRead` と `check` の対象も 1 つで済む
- 良い点: 手元の Mac と専用マシンで同じ安全設定を使うので、環境ごとの手順の差が無い
- 良い点: 作業ブランチの push に署名を求めないので、署名鍵を AI のセッションに置かずに済む
- 良い点: 進行役が作業 AI 側の git を実行しないので、`.git` に仕込まれた hook や config が進行役の権限で動く経路が無い
- 悪い点: 作業ブランチの commit は署名なしになる。`develop` と `main` の commit は Verified のまま
- 悪い点: `denyRead` のパスの実体への解決、読み取りを試す点検、別の clone への取り込みと push、`--setting-sources user` の点検など、`setup` と `check` と進行役に実装が増える
- 悪い点: 人の署名の方式を変える必要がある（手元の SSH 鍵に移し、パスワード管理ツールの agent をやめる。P6）。business-os の利用者向けの雛形は変えない
- 中立: 自動化用の GitHub アカウントを分けるかは決めない（要件メモ 8 節）。分けても安全設定・鍵の系統・署名の扱いは変わらない

### 確認方法（Confirmation）

- 段階 0b（2026-10-08、macOS、Claude Code 2.1.285、`claude -p --output-format json`）で確認済み：sandbox を掛けた `claude -p` が `pnpm check:types` と署名なしの `git commit` を通し、`~/.ssh` の読み取りが `Operation not permitted` で止まる（補足情報の表）
- 段階 0b の残る確認のうち本 ADR に関わるもの（ADR-20261008-001 の段階表）：(a) denyWrite を worktree と `.git/objects` `.git/worktrees/<名>` に絞ったとき commit が通ること、(b) 鍵と PAT の置き場が sandbox で実際に読めないこと、(c) `--setting-sources user` でプロジェクト設定と hook が読まれないこと、(e) fine-grained PAT で Organization の Project を書けること
- `/dev-autopilot check`（S2）が毎回の実行の最初に確かめる：安全設定の `denyRead` が実体のパスを含むこと、sandbox の中で `~/.ssh`・`~/.config/gh`・鍵と PAT の置き場の実体が実際に読めないこと、`gh auth login` の状態が無く PAT が置き場のファイルにだけあること（権限 700）、AI のセッションの起動が `--setting-sources user` と `--settings` を持つこと、進行役の clone の `core.hooksPath` が空のフォルダを指すこと、`develop` の ruleset が存在すること。fail が 1 つでもあれば作業に入らない
- 進行役の判定（漏えいの検査、マージの条件）と、取り込みが作業 AI 側の git を実行しないこと（`git fetch <worktree のパス>` だけを使うこと）を vitest で検査する（R7-5）
- 段階 0c の出口：`check` が business-os で全項目 pass

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案 A: sandbox を掛け、鍵を 2 系統に分ける

要件メモ 12 節の判断 1 の案 A。原案は「進行役が自動化用の署名鍵で署名し直して push する」を含んでいたが、決定では再署名を落とした（作業ブランチの commit はマージ後に消え、`develop` の commit は GitHub が署名するため）。

- 良い点: 人の鍵と gh の設定を AI から隠せる。試験の段階から効く
- 良い点: business-os の利用者向けの四重防衛と同じ考え方で、雛形を元にできる
- 良い点: 専用マシンでも手元の Mac でも同じ設定で動く
- 良い点: deploy key が認証専用で署名を検証できない制約は、作業ブランチの署名を求めないことで回避できる
- 中立: `.git` の hook と config は sandbox だけでは防げない（commit に要る `.git` への書き込みは許すため）。別の clone への取り込みと、進行役が作業 AI 側の git を実行しないことで補う
- 悪い点: `denyRead` がシンボリックリンクを解決しない不具合があり、実体のパスの解決と読み取りの点検を `setup` と `check` が持つ必要がある
- 悪い点: 作業ブランチの commit は署名なし

### 案 B: 別の OS ユーザーで動かす

- 良い点: OS のユーザーの境界で隔離するので、隔離は最も強い。`~/.ssh` も `~/.config/gh` も別のホームになり、シンボリックリンクの解決の問題も起きない
- 悪い点: 専用マシンの構築手順が増える（ユーザーの作成、Node と `claude` と `pnpm` の二重の導入、worktree の置き場の権限）
- 悪い点: 手元の Mac では運用しにくい。試験の段階で別のユーザーを作り、切り替えて動かすことになる
- 悪い点: `.git` の hook と deploy key の制約は OS のユーザーを分けても残る。別の clone への取り込み、鍵の 2 系統は結局必要になる
- 中立: 案 A の上に重ねることはできる。専用マシンで隔離を強めたくなったときの追加の選択肢として残る

### 案 C: 同じ OS ユーザーのまま共有を受け入れ、段階 5 を見送る

- 良い点: 実装が最も少ない。sandbox の設定も鍵の用意も要らない
- 悪い点: 作業 AI とレビュー AI が人の鍵と gh の認証情報を Bash から読める。作業 AI が書いたコードをレビュー AI が実行する構造（R3-1）と両立しない
- 悪い点: 作業 AI が `.git/hooks` や `.git/config` を書き換えれば、進行役の push 時に人の権限で任意のコマンドが動く
- 悪い点: 段階 5（進行役のマージの判定）を見送るので、ループは「人が判定もマージもする」で止まり、要件メモ 1 節の目的に届かない
- 悪い点: 試験の段階でも普段の鍵が AI から読める状態になり、手元の Mac で試すこと自体が危険になる

## 補足情報（More Information）

### 段階 0b の実機の結果（2026-10-08）

要件メモ 12 節「0b で確かめる未確認」のうち、sandbox と鍵の決定に関わるもの。

| 確かめたこと | 結果 |
| --- | --- |
| sandbox を掛けた `claude -p` で `pnpm check:types` と署名なしの `git commit` が通るか | 通る。`~/.ssh` の読み取りは `Operation not permitted` で止まった |
| 未信頼の作業場所で `.claude/settings.json` の `permissions.deny` が効くか | 効く。deny に足した Bash のパターンが拒否され、`permission_denials` に記録された |
| fine-grained PAT で Organization 所有の Project の欄を書けるか | 残る確認 (e)。PAT の発行が人の作業なので、段階 0c の `check` で確かめる |

**見つかった不具合（🔴）：sandbox の `denyRead` はシンボリックリンクを解決しない。**
確かめた Mac では `~/.config` が同期フォルダ上の dotfiles へのシンボリックリンクで、`denyRead` に `~/.config/gh/**` と書いても `~/.config/gh/hosts.yml` が読めた（glob なしでも同じ）。実体のパスを書くと止まった。
`~/.ssh` も同じ dotfiles へのリンクだが、`~/.ssh/**` で止まった（リンクがパターンの先頭にあるときは解決され、途中にあると解決されないように見える）。
利用者向けの雛形 `plugin/templates/settings.json.tmpl` の `denyRead` にも同じ影響があるため、business-os の [Issue #80][issue-80] に起票した。決定の 7 は `denyRead` の不具合の結果から導いた。

### 据え置くもの・関連する決定

- business-os の利用者向けの署名の雛形（`plugin/templates/` の git 設定）は変えない。人の署名の方式の変更（P6）は dev-autopilot のマシンと人の手元に限る
- 自動化用の GitHub アカウントを分けるか（machine user か GitHub App か）は要件メモ 8 節の未決のまま。段階 3 で 1 つのアカウントで印の判定が動くことを確かめてから決める
- 段階 0b の残る確認は ADR-20261008-001 の段階表に (a)〜(e) として列挙してある。本 ADR に関わるのは (a) (b) (c) (e)
- 決定の反映先：`setup`（安全設定の生成、鍵と PAT の置き場の作成、ruleset の作成）、`check`（読み取りの点検、起動の引数の点検）、進行役（`--setting-sources user` と `--settings` での起動、別の clone への取り込みと push、PAT の読み込み、漏えいの検査）。実装は accepted の後に別の PR で行う

[memo]: ../dev-autopilot-requirements.md
[issue-80]: https://github.com/Joymerrevent/business-os/issues/80
[adr-20261008-001-orchestrator-and-ai-roles]: ./adr-20261008-001-orchestrator-and-ai-roles.md
[adr-20261008-003-github-writes-by-orchestrator]: ./adr-20261008-003-github-writes-by-orchestrator.md
