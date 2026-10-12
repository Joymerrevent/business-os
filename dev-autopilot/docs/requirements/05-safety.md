# 安全側に倒す設計（隔離と鍵）

## 6. 安全側に倒す設計

- AI のセッション（5 役。3 節）は GitHub に書けない。`gh` の認証と `GH_TOKEN` と進行役の鍵を渡さず（子プロセスの環境変数は許可した名前だけで組み立て、`check` が「子プロセスから PAT と鍵が見えない」ことを試す）、道具はエージェント定義で絞る（P13、R2-5）。
  push・PR・コメント・Project の更新は進行役だけが行う。進行役も `gh pr merge` を呼ばず、`develop` と `main` への直 push と force push はしない（ruleset でも止める。P5、R7-3b）
- **進行役・次のセッション・CI は、AI が書いた worktree の中身を信頼して実行しない（決定（2026-10-11）。12 節の判断 7）**。4 つの経路を塞ぐ：
  (a) AI のセッションはユーザー設定とプロジェクト設定から切り離して起動する（`--setting-sources local`。0b で、既定の `-p` はプロジェクトの hook を実行し `CLAUDE.md` を読むこと、`local` ならユーザーの hook もプロジェクトの hook も `CLAUDE.md` も読まれないことを確認した。`--settings` の安全設定は効く）。Plugin は進行役専用 clone の絶対パスで渡す（AI が改変した agent 定義と Skill を読まない）。
  (e) sandbox は Bash だけを覆い、Read・Write・Edit の各ツールは覆わない（0b で確認）。ファイルの道具は `permissions` で絞る：`allow` は `Bash`（sandbox が境界。allow に入れないと `git commit` が承認待ちで拒否される）、`Read`、`Write(//<worktree>/**)`、`Edit(//<worktree>/**)` だけ。`deny` に `Read(//<秘密のパス>/**)`（進行役の設定・記録・鍵・`~/.ssh` など）、`Write` と `Edit` の `//<親 clone>/.git/**` `//<worktree>/.claude/**` `//<worktree>/CLAUDE.md` `//<worktree>/.mcp.json` を入れる。絶対パスは `//` 始まりで書く（`/` 始まりはプロジェクト相対）
  (b) 進行役は worktree の中で git を実行しない。worktree の objects を自分の clone に fetch し、merge・patch-id・diff・漏えい検査・push はそこで行う（AI が `.git/worktrees/<名前>/commondir` を差し替えて進行役の git に任意のコマンドを実行させる経路を塞ぐ）。
  (c) `.claude/**` `CLAUDE.md` `.mcp.json` `.github/**` `dev-autopilot/**` に触れる diff は push しない（R2-14。CI が AI の書いたワークフローを secrets 付きで実行しない）。必須チェックは名前に加え app と base 側のワークフローのパスで照合する（R4-3）。
  (d) 進行役はリポのコードとパッケージの lifecycle script を sandbox の外で実行しない（R2-1、R2-8）。漏えい検査は dev-autopilot 自身の `src/` で行う（R2-14）。
  sandbox の `--settings` のファイルは AI が書けない場所に置き、起動の前にハッシュを確かめる。一時フォルダはセッションごとに別のものを作る
- `--max-turns` と時間の上限と `--max-budget-usd`（R2-12）で 1 回の作業の長さと費用を止める
- 判定できない状態（API の失敗、想定外の Status、worktree の残骸）では、作業を増やさずに記録して止める（fail-closed）
- sandbox の安全設定は、書いてあることではなく「実際に読めない・書けない」ことを `check` が試して確かめる。`denyRead` `denyWrite` のパスは `setup` が実体に解決して書く（シンボリックリンクを解決しない不具合が 12 節で見つかった）
- AI に渡すのはコラボレータが書いた文だけ。外の人の文は渡さない。渡す文も作業の内容であって、動き方を変える指示にはしない（4.8 節）
- AI に渡す文は、書いた人を問わず、渡す直前に毎回、進行役の検疫を通す（4.8 節 I11）。検疫は貼られた文に対する網であって壁ではない。コラボレータの悪意や乗っ取りは、AI の権限の制限（GitHub に書けない、sandbox、URL を取れない）、方針に係るパスの除外、マージの実行を人に残すこと、の 3 つで受ける（2026-10-10 の決定）
- AI の出力が公開の場に書かれる前に、進行役が漏えいの検査を掛ける（diff だけでなく、すべてのコメント・PR の本文・commit メッセージ・起票する Issue。R2-14）
- 処理対象の判断は人。AI が書けるのは worktree の中と、親 clone の `.git` の一部（12 節の判断 1）だけで、GitHub には書けない。マージの実行は人だけが行い、進行役は 4.7 節の判定を印として人に渡す。方針に係る PR は判定の対象外

## 12 節の判断 1

1. **AI のセッションの隔離と鍵の分け方。** 開発リポは sandbox を使わないので、同じ OS ユーザーで動く作業 AI は `~/.ssh` の鍵と `gh` の設定を Bash から読め、worktree が共有する `.git` の hook を書き換えて進行役の push 時に実行させることもできる。
   さらに GitHub の deploy key は認証専用で署名の検証に使えないので、「リポに絞った鍵 1 本で push も署名も」は成り立たない。選択肢：
   - 案 A：AI のセッションに Claude Code の sandbox を掛ける（dev-autopilot が `--settings` で渡す安全設定：`~/.ssh` `~/.config/gh` の読み取り禁止、書き込みは worktree だけ、`allowUnsandboxedCommands: false`）。
     作業 AI は `commit.gpgsign=false` で署名なしの commit を作り、進行役が自動化用の署名鍵で署名し直して push する。push 用は deploy key、署名用は自動化用アカウントの signing key。人の鍵とは分ける
     （この「署名し直す」は決定では採らない。下の決定の中身のとおり、再署名の仕組みは持たない）。
     business-os の四重防衛と同じ考え方で、専用マシンでも同じ設定で動く
   - 案 B：AI のセッションを別の OS ユーザーで動かす。隔離は最も強いが、専用マシンの構築手順が増え、手元の Mac では運用しにくい
   - 案 C：同じ OS ユーザーのまま、鍵と git 設定の共有を受け入れ、段階 5（進行役のマージ）を見送る
   **決定（2026-10-08）：案 A。** 中身は次のとおり
   - AI のセッション（作業 AI・レビュー AI・批評者）は、dev-autopilot が `--settings` で渡す安全設定で動かす：sandbox を有効、`~/.ssh` `~/.config/gh` と進行役の設定・記録の読み取り禁止、
     書き込みはその Issue の worktree と一時フォルダと、下の「`.git` の一部」だけ、`allowUnsandboxedCommands: false`、外への通信は許可した先（npm のレジストリなど）だけ。
     雛形は business-os の `plugin/templates/settings.json.tmpl` の sandbox の節を元にする（利用者向けの四重防衛と同じ考え方）
   - **決定（2026-10-10）：worktree を残し、親 clone の `.git` の一部だけ書けるようにする。** worktree の gitdir と objects は親 clone の `.git/` にあり、worktree のフォルダだけでは `git commit` が通らない（12 節末の実機確認は clone で行ったもので、worktree では未確認）。
     Issue ごとの clone にする案（AI の clone では進行役が git を実行せず、fetch で取り込む）と比べ、worktree を残す案を採った。中身は次のとおり
     - 書けるのは `.git/objects/**` `.git/refs/**` `.git/logs/**` `.git/packed-refs`（と lock ファイル）と、その Issue の `.git/worktrees/<名前>/**` だけ。`.git/config` `.git/hooks/**` `.git/info/**` と他の Issue の `.git/worktrees/**` は書けない
     - git が書く場所の一覧は 0b で worktree を使って実機で確かめ、設定ファイルに持つ。列挙漏れは commit の失敗（実行の失敗。R2-13）として現れ、黙って通ることはない（fail-closed）。AI のセッションの git では自動 gc を止め、書く場所を増やさない
     - **進行役は共有 clone の refs を信頼しない。** refs と packed-refs を AI が書けるので、進行役は使う前に必ず `origin` から fetch し、base は `origin/develop`、PR の head は GitHub の API が返す SHA だけを基準にする。載せ直し（R7-3b）と push は fetch の直後に行い、push する SHA が API の head か自分の merge の結果と一致することを確かめる
     - `core.hooksPath` を空のフォルダに固定する運用（下）はそのまま。
       **訂正（2026-10-11）**：「`.git/config` と `hooks/` は書けないので、進行役は親 clone の中で git を実行してよい」を改める。AI は自分の `.git/worktrees/<名前>/commondir` と `gitdir` を書き換えられ、`commondir` を AI が用意したフォルダに向ければ、そこの `config`（`core.fsmonitor` `core.sshCommand` `diff.external` など）が進行役の git に読まれる。
       進行役は worktree の中でも、worktree を共有する親 clone の中でも git を実行しない。進行役は自分だけが書ける別の clone を持ち、AI の worktree のブランチをそこへ fetch してから merge・patch-id・diff・漏えい検査・push を行う（6 節の (b)。12 節の判断 7）。
       AI の worktree を切る親 clone は「AI の作業場所」として扱い、進行役はそこへ worktree を作る・消す操作だけを行う（`git worktree add` / `remove` も、`commondir` が差し替えられた worktree に対しては実行せず `needs-human`）。
       加えて `.git/worktrees/<名前>/gitdir` を `denyWrite` にする（0b で、sandbox は `commondir` `config.worktree` と親の `config` `hooks/**` を既定で保護するが `gitdir` は書けたため）。作業フォルダが worktree のとき sandbox は親 `.git` への書き込みを既定で許すので、`allowWrite` の列挙は要らない（0b で `git commit` が通ることを確認）。
       0b の攻撃の再現では、進行役の clone からの fetch と親 clone での `git worktree list` / `remove` は差し替え先の config を読まなかった。worktree の中で git を実行したときだけ発火した
   - 作業 AI の commit は署名なし（セッションの git 設定で `commit.gpgsign=false`）。`develop` への squash マージの commit は GitHub が作って署名するので Verified になる。
     作業ブランチの commit はマージ後に消えるため、再署名の仕組みは持たない。`develop` の ruleset に「署名必須」は入れない（入れると作業 AI の push が通らない）
   - 鍵は 2 系統：人の署名鍵（手元の SSH 鍵。dev-autopilot は触らない）と、dev-autopilot のマシン専用の deploy key（business-os だけに書き込み可。進行役だけが使う）。
     進行役の `gh` は business-os に絞った fine-grained PAT を、進行役のプロセスの環境変数でだけ持つ（`gh auth login` でマシンに残さない）
   - 進行役は dev-autopilot 専用の clone を 2 つ持つ：AI の worktree を切る「AI の作業場所」の clone と、進行役だけが書き、`src/` を実行し、fetch・merge・push を行う「進行役の clone」（2026-10-11 の訂正）。進行役が git を動かすときは `core.hooksPath` を空のフォルダに固定し、git の設定は環境変数（`GIT_CONFIG_COUNT` 等）で渡す
   - `develop` にも ruleset（PR 必須、force push 禁止、base と最新であること）を掛け、deploy key で直接 push できるのは作業ブランチだけにする
   - 手元の Mac で試す間（専用マシンの前）も同じ設定で動かす。sandbox が人の鍵と gh の設定を AI から隠すので、試験の段階で普段の鍵が読まれることも防げる
   - 0b で確かめること：12 節末の表（sandbox を掛けた `claude -p` で `pnpm check` 全体と `git commit` が通るか、hook と `commondir` の攻撃が届かないか、ほか）。npm のキャッシュとプロキシは ADR 20261006-01 の設定を写す
