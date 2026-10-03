---
id: 20261003-11
title: コミットの署名に使う agent のソケットは保護した個人設定で許し、署名で失敗したら人にコミットを頼む
type: decision
business: n/a
status: accepted
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: 2026-10-03
supersedes: n/a
---

# 20261003-11: コミットの署名に使う agent のソケットは保護した個人設定で許し、署名で失敗したら人にコミットを頼む

## 背景と問い

company の `.claude/settings.json`（`templates/settings.json.tmpl` から `/onboard` が生成）は sandbox を有効にし、
`allowUnsandboxedCommands: false` で、失敗したコマンドを sandbox の外で再実行する逃げ道を塞いでいる（20260929-05）。

2026-10-03、署名付きコミット（`commit.gpgsign=true`、`gpg.format=ssh`、`gpg.ssh.program` に 1Password の `op-ssh-sign`）を使う macOS の環境で
`/onboard` を実行したところ、最後の `git commit` が `1Password: Could not connect to socket` で失敗した。
sandbox の中のコマンドは Unix ソケットに接続できず、署名の agent（1Password の SSH agent のソケット）に届かないため。

- 影響は `/onboard` に限らない。文書を書いた Skill は最後にコミットするかを聞く（`templates/skill-conventions.md` の「git」）。
  署名付きコミットを使う利用者の環境では、10 個の Skill のコミットがすべて失敗する
- 1Password に限らない。ssh-agent や gpg-agent で署名する場合も、ソケットへの接続が要る
- business-os の開発リポでは sandbox を使わない理由の一つに「コミットへの署名を sandbox が妨げる」を挙げている（`docs/design/architecture.md` 3.1 節）。
  company の側では、この問題を扱っていなかった

署名を通す方法を探すうちに、`.claude/settings.local.json` が守られていないことがわかった。

- business-os の保護対象は `docs/charter/**`、`CLAUDE.md`、`.claude/settings.json`、`.business-os.json` の 4 つ（20260929-05）。
  `.claude/settings.local.json` は、sandbox の denyWrite、permissions の ask、hook のどれの対象でもない
- `.claude/settings.local.json` は `.claude/settings.json` より優先される。`sandbox.enabled: false` や `allowUnsandboxedCommands: true` を書けば、
  company の安全設定の値を上書きできる。配列の設定（`excludedCommands` など）は連結されるので、sandbox の外で動くコマンドを足すこともできる
- 起動時の軽い点検と `/check`（20260929-06）は `.claude/settings.json` だけを雛形と比べる。`.claude/settings.local.json` で値を上書きされても気づけない
- つまり、CC が Write や Bash で `.claude/settings.local.json` を書けば、確認なしで四重防衛の第 1 層（sandbox）を外せる

公式ドキュメント（2026-10-03 時点）で確かめた事実：

- `sandbox.network.allowUnixSockets`（文字列の配列）で、sandbox の中のコマンドが接続してよい Unix ソケットのパスを指定できる。**macOS だけ**で効く。
  Linux / WSL2 では Unix ソケットを seccomp で制御し、パスごとの許可は無い
- `sandbox.network.allowAllUnixSockets` は、全ての Unix ソケットを開く
- 設定の優先順位は、高い順に managed、コマンドラインの `--settings`、`.claude/settings.local.json`、`.claude/settings.json`、利用者の `~/.claude/settings.json`。
  配列の設定は、上書きでなく連結される
- 入力欄で `!` を付けて人が実行したコマンドは、多くのセッションで sandbox の外で動く（バックグラウンドのセッションなどは除く）
- `sandbox.excludedCommands` に合うコマンドは、sandbox の外で利用者と同じ権限で動く

問い：

1. 署名付きコミットを使う利用者が、company で Skill のコミットを通せるようにするか。通すなら、sandbox の守りをどこまで緩めるか
2. sandbox を緩められる `.claude/settings.local.json` を、どう守るか

## 判断の基準

- 雛形（全利用者に配る安全設定）は安全側のまま変えない。緩めるのは、必要な利用者が自分の手元でだけ行う
- 緩める範囲は、署名に要る 1 つのソケットに限る
- 緩めない利用者・緩められない環境（Linux / WSL2）でも、失敗したときに安全側へ倒れる（設定を書き換えて押し通さない）
- 署名を外してコミットを通さない（利用者が署名を求めている以上、署名の無いコミットを作らない）
- 安全設定を上書きできるファイルは、`.claude/settings.json` と同じ強さで守る。CC だけで守りを緩める経路を残さない
- 守りが外れたら気づける（「設定がある」ではなく「効いている」を確かめる。20260929-06）

## 検討した案

署名を通す方法（問い 1）：

- 案 A：署名の agent のソケットを、利用者の個人設定（`.claude/settings.local.json`）の `allowUnixSockets` で許す
- 案 B：署名で失敗したら、設定を変えずに止め、人に `!` 付きでコミットしてもらう
- 案 C：`git commit` を `excludedCommands` に入れて sandbox の外で動かす
- 案 D：署名を外してコミットする（`--no-gpg-sign`、`-c commit.gpgsign=false`）
- 案 E：`allowAllUnixSockets` を雛形で有効にする

`.claude/settings.local.json` の守り方（問い 2）：

- 案 P：保護対象に加え（sandbox の denyWrite、permissions の ask、hook）、点検で上書きを見つける
- 案 Q：書き込みは止めず、点検で上書きを見つけるだけにする
- 案 R：この ADR では扱わず、別の ADR に回す

## 決定

採用：**案 A と案 B を組み合わせ、案 P で `.claude/settings.local.json` を守る**。

雛形は変えず、macOS で署名を使う利用者だけが 1 つのソケットを許す（案 A）。
許さない利用者や Linux / WSL2 では、Skill が署名の失敗で止まり、人にコミットを頼む（案 B）。案 B が、案 A が効かないときの安全側の倒れ方になる。
案 A はソケットの許可を `.claude/settings.local.json` に置く。そのため、`.claude/settings.local.json` は `.claude/settings.json` と同じ強さで守る（案 P）。
守らないまま案 A を採ると、sandbox を緩める設定の置き場を business-os が自ら勧めることになる。

1. `templates/settings.json.tmpl` の sandbox の値は変えない。`allowUnixSockets` と `allowAllUnixSockets` を雛形に書かない
2. `/onboard` は、初回の「準備」で git の署名の設定を確かめる
   1. `git config --get commit.gpgsign` が `true` で、macOS のときだけ、署名の agent のソケットのパスを探す
      - `gpg.format` が `ssh` で、`gpg.ssh.program` が 1Password の `op-ssh-sign` なら、1Password の agent のソケット
        （`~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock`）
      - `gpg.format` が `ssh` で、それ以外なら環境変数 `SSH_AUTH_SOCK` のパス
      - `gpg.format` が `openpgp`（または未設定）なら `gpgconf --list-dirs agent-socket` のパス
      - パスが見つからない、またはソケットが存在しなければ、案 A を使わず案 B だけで動く
   2. 見つけたら、そのパスと「sandbox の中のコマンドがこの agent で署名・SSH 認証できるようになる」ことを示し、許すかを聞く（質問の表に 1 問足す。20261003-08）
   3. 「許す」なら、`.claude/settings.local.json` の `sandbox.network.allowUnixSockets` に、そのパスだけを足す。`.claude/settings.json` には書かない
      （`.claude/settings.local.json` は雛形の `.gitignore` で追跡しない。パスは利用者ごとに違う）
      - `.claude/settings.local.json` がすでにあれば、中身を読んでキーを足す。ほかの設定を消さない
      - 書く順番は「4. 書き出し」の `.claude/settings.json` の直前にする（`.claude/settings.json` を書いた後は、permissions の ask が確認を出すため）
   4. Linux / WSL2 では聞かない。署名付きコミットを使っていれば「コミットは Skill の最後に人に頼むことになる」と伝える
3. `templates/skill-conventions.md` の「git」に、コミットが署名で失敗したときの手順を足す（全 Skill に効く）
   1. git の設定を変えない。署名を外すオプション（`--no-gpg-sign`、`-c commit.gpgsign=false`）を使わない。sandbox の外で再実行しようとしない
   2. ステージ済みのファイルはそのまま残し、人が入力欄で実行するコマンド（`! git commit -m "…"`）を示して止める
   3. `!` でも同じエラーになる場合は、通常のターミナルから実行するよう伝える
   4. 署名の失敗とわかるエラー（agent のソケットに接続できない、署名のプログラムの失敗）以外は、この手順の対象にしない
4. `.claude/settings.local.json` を保護対象に加える（保護対象は 20260929-05 の 4 つから 5 つになる）
   1. `templates/settings.json.tmpl` の `sandbox.filesystem.denyWrite` に `./.claude/settings.local.json` を、`permissions.ask` に `Edit(./.claude/settings.local.json)` を足す
   2. hook の保護対象（`hooks/lib/company.ts` の `isProtected`）に `.claude/settings.local.json` を足す。
      初期化中は新規作成を通し、既存ファイルの上書きは人間に確認する。運用中は、ほかの保護対象と同じく提案と `/approve` を経る
   3. 運用中に署名を使い始めた利用者は、`/onboard` の導入済みの流れで、`.claude/settings.local.json` を `target` にした提案を書く。
      提案に書くのは足すソケットのパスだけにする（`.claude/settings.local.json` のほかの設定を、追跡される提案に写さない）
5. 点検（起動時の軽い点検と `/check`）で `.claude/settings.local.json` も読み、安全設定の上書きを見つける
   1. `.claude/settings.local.json` の `sandbox.enabled` か `sandbox.allowUnsandboxedCommands` が雛形の値と違えば、必須規則の欠落として扱う（厳格モードになる）
   2. `.claude/settings.local.json` があって読めなければ、必須規則の欠落として扱う（`.claude/settings.json` を読めないときと同じ）
   3. `sandbox.network.allowAllUnixSockets` が `true`、または `sandbox.excludedCommands` が空でなければ、warn を出す
   4. `/check` は `sandbox.network.allowUnixSockets` に並ぶパスを示す（判定はしない。人が見て、覚えのないパスに気づけるようにする）
6. 既存の company への移り方
   1. この変更を含む版に上げると、既存の company の `.claude/settings.json` には決定 4.1 の 2 つの規則が無く、厳格モードになる
      （厳格モードは保護対象への書き込みを全て止めるので、CC は `.claude/settings.json` を直せない）
   2. CHANGELOG と `docs/usage/` の更新の案内に、人が `.claude/settings.json` に足す 2 行を示す。厳格モードの通知は、欠けている規則の名前を示す
7. `docs/usage/` の導入の案内に、署名付きコミットを使う利用者向けの説明（macOS で許す設定、Linux / WSL2 では人がコミットすること）を足す

## 影響

- 良い影響
  - macOS で署名を使う利用者は、Skill の最後のコミットを今までどおり CC に任せられる
  - 雛形の sandbox の値は変わらない。署名を使わない利用者の守りは今と同じか、強くなる
  - Linux / WSL2 や、許さなかった利用者でも、Skill が署名を外したり設定を書き換えたりせずに止まる
  - CC が `.claude/settings.local.json` を書いて sandbox を外す経路が塞がる。人が手で上書きした場合も、点検が見つける
- 悪い影響
  - 許した利用者の環境では、sandbox の中のコマンドが署名の agent を使える。署名に加えて、その agent が持つ鍵での SSH 認証もできる。
    1Password の「使うたびに承認を求める」設定を使っていれば、使われるたびに人が気づける。ssh-agent では気づけない
  - Linux / WSL2 では、署名付きコミットのたびに人の手間が残る
  - `/onboard` の質問が 1 問増える（署名を使う macOS の利用者だけ）
  - 既存の company は、版を上げた直後に厳格モードになり、人が `.claude/settings.json` に 2 行を足すまで保護対象を書けない
  - 運用中に `.claude/settings.local.json` を変えるたびに、提案と `/approve` が要る
- その他
  - Claude Code は、権限の確認で「今後は聞かない」を選ばれると、許可の規則を `.claude/settings.local.json` に書く。
    この書き込みはツールの呼び出しではないので、hook と permissions は関わらない。sandbox の denyWrite が Claude Code 自身の書き込みを止めないかを、実装時に確かめる
  - 1Password のソケットのパスと、`allowUnixSockets` のパスで `~` が展開されるかは、実装時に実機で確かめる
    （公式ドキュメントでは、ファイルシステムのパスについて `~` がホームを指すとだけ書かれている）
  - `.claude/settings.local.json` の permissions の規則（`allow` など）は、この ADR では点検しない。`.claude/settings.json` の deny と ask が allow より先に効く前提に立つ
  - Linux / WSL2 でパスごとの許可が使えるようになったら、案 A の対象を広げるかを見直す

## 案ごとの長所と短所

### 案 A：署名の agent のソケットを個人設定で許す

- 長所：緩める範囲が 1 つのソケットに限られる。雛形を変えない。許した利用者は人の手間が無くなる
- 短所：macOS だけ。agent が持つ鍵での SSH 認証も sandbox の中から使えるようになる。置き場の `.claude/settings.local.json` を守る必要が生まれる

### 案 B：署名で失敗したら止め、人にコミットを頼む

- 長所：sandbox を一切緩めない。どの OS でも同じ手順で止まる
- 短所：署名を使う利用者は、Skill を使うたびにコミットの手間が残る

### 案 C：`git commit` を `excludedCommands` に入れる

- 長所：どの OS でも人の手間が無くなる
- 短所：`git commit` は pre-commit などの git の hook を起動する。hook が sandbox の外で利用者と同じ権限で動き、憲章への書き込みや秘密の読み取りを止められなくなる

### 案 D：署名を外してコミットする

- 長所：設定を緩めずにコミットが通る
- 短所：利用者が求めた署名の無いコミットが残る。git の設定を CC が上書きすることになる

### 案 E：`allowAllUnixSockets` を雛形で有効にする

- 長所：設定が簡単で、ソケットのパスを探さなくてよい
- 短所：全利用者の sandbox から、Docker のソケットなど全ての Unix ソケットへ接続できるようになる。署名を使わない利用者の守りまで弱まる

### 案 P：保護対象に加え、点検で上書きを見つける

- 長所：CC だけで守りを緩める経路が無くなる。人が手で緩めた場合も気づける。`.claude/settings.json` と同じ仕組み（四重防衛）に乗る
- 短所：既存の company は版を上げると厳格モードになり、人の手作業が要る。`.claude/settings.local.json` を変えるたびに承認が要る

### 案 Q：点検で上書きを見つけるだけにする

- 長所：書き込みの承認が増えない。既存の company が厳格モードにならない
- 短所：CC が書いてから次の点検までは、守りが外れたまま動く。見つけるのは事後になる

### 案 R：別の ADR に回す

- 長所：この ADR の範囲が小さく保てる
- 短所：案 A が、守られていないファイルに sandbox を緩める設定を置くよう勧めることになる。別の ADR が決まるまで穴が残る

## 参考

- Claude Code 公式「Sandboxing」<https://code.claude.com/docs/en/sandboxing>（`allowUnixSockets`、`allowAllUnixSockets`、`excludedCommands`、`!` 付きのコマンドの扱い、`allowUnsandboxedCommands`）
- Claude Code 公式「Settings」<https://code.claude.com/docs/en/settings>（設定の優先順位、配列の設定の連結）
- 関連 ADR：20260929-05（ステージングと承認、四重防衛。保護対象を 5 つに広げる）、20260929-06（起動時セルフチェック）、20261003-08（Skill の質問の表）
- `docs/design/architecture.md` 3.1 節（開発リポで sandbox を使わない理由）、4.1 節（書き込み権限）
