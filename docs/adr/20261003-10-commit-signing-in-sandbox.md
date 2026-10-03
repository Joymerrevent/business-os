---
id: 20261003-10
title: コミットの署名に使う agent のソケットは利用者の個人設定で許し、署名で失敗したら人にコミットを頼む
type: decision
business: n/a
status: proposed
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: n/a
supersedes: n/a
---

# 20261003-10: コミットの署名に使う agent のソケットは利用者の個人設定で許し、署名で失敗したら人にコミットを頼む

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

公式ドキュメント（2026-10-03 時点）で確かめた事実：

- `sandbox.network.allowUnixSockets`（文字列の配列）で、sandbox の中のコマンドが接続してよい Unix ソケットのパスを指定できる。**macOS だけ**で効く。
  Linux / WSL2 では Unix ソケットを seccomp で制御し、パスごとの許可は無い
- `sandbox.network.allowAllUnixSockets` は、全ての Unix ソケットを開く
- `.claude/settings.local.json` と `.claude/settings.json` の配列の設定は、上書きでなく連結される
- 入力欄で `!` を付けて人が実行したコマンドは、多くのセッションで sandbox の外で動く（バックグラウンドのセッションなどは除く）
- `sandbox.excludedCommands` に合うコマンドは、sandbox の外で利用者と同じ権限で動く

問い：署名付きコミットを使う利用者が、company で Skill のコミットを通せるようにするか。通すなら、sandbox の守りをどこまで緩めるか。

## 判断の基準

- 雛形（全利用者に配る安全設定）は安全側のまま変えない。緩めるのは、必要な利用者が自分の手元でだけ行う
- 緩める範囲は、署名に要る 1 つのソケットに限る
- 緩めない利用者・緩められない環境（Linux / WSL2）でも、失敗したときに安全側へ倒れる（設定を書き換えて押し通さない）
- 署名を外してコミットを通さない（利用者が署名を求めている以上、署名の無いコミットを作らない）

## 検討した案

- 案 A：署名の agent のソケットを、利用者の個人設定（`.claude/settings.local.json`）の `allowUnixSockets` で許す
- 案 B：署名で失敗したら、設定を変えずに止め、人に `!` 付きでコミットしてもらう
- 案 C：`git commit` を `excludedCommands` に入れて sandbox の外で動かす
- 案 D：署名を外してコミットする（`--no-gpg-sign`、`-c commit.gpgsign=false`）
- 案 E：`allowAllUnixSockets` を雛形で有効にする

## 決定

採用：**案 A と案 B を組み合わせる**。雛形は変えず、macOS で署名を使う利用者だけが 1 つのソケットを許す（案 A）。
許さない利用者や Linux / WSL2 では、Skill が署名の失敗で止まり、人にコミットを頼む（案 B）。案 B が、案 A が効かないときの安全側の倒れ方になる。

1. `templates/settings.json.tmpl` は変えない。`allowUnixSockets` と `allowAllUnixSockets` を雛形に書かない
2. `/onboard` は、初回の「準備」で git の署名の設定を確かめる
   1. `git config --get commit.gpgsign` が `true` で、macOS のときだけ、署名の agent のソケットのパスを探す
      - `gpg.format` が `ssh` で、`gpg.ssh.program` が 1Password の `op-ssh-sign` なら、1Password の agent のソケット
        （`~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock`）
      - `gpg.format` が `ssh` で、それ以外なら環境変数 `SSH_AUTH_SOCK` のパス
      - `gpg.format` が `openpgp`（または未設定）なら `gpgconf --list-dirs agent-socket` のパス
      - パスが見つからない、またはソケットが存在しなければ、案 A を使わず案 B だけで動く
   2. 見つけたら、そのパスと「sandbox の中のコマンドがこの agent で署名・SSH 認証できるようになる」ことを示し、許すかを聞く（質問の表に 1 問足す。20261003-08）
   3. 「許す」なら、`.claude/settings.local.json` の `sandbox.network.allowUnixSockets` に、そのパスだけを足す。`.claude/settings.json` には書かない
      （`settings.local.json` は雛形の `.gitignore` で追跡しない。パスは利用者ごとに違う）
   4. Linux / WSL2 では聞かない。署名付きコミットを使っていれば「コミットは Skill の最後に人に頼むことになる」と伝える
3. `templates/skill-conventions.md` の「git」に、コミットが署名で失敗したときの手順を足す（全 Skill に効く）
   1. git の設定を変えない。署名を外すオプション（`--no-gpg-sign`、`-c commit.gpgsign=false`）を使わない。sandbox の外で再実行しようとしない
   2. ステージ済みのファイルはそのまま残し、人が入力欄で実行するコマンド（`! git commit -m "…"`）を示して止める
   3. `!` でも同じエラーになる場合は、通常のターミナルから実行するよう伝える
   4. 署名の失敗とわかるエラー（agent のソケットに接続できない、署名のプログラムの失敗）以外は、この手順の対象にしない
4. `docs/usage/` の導入の案内に、署名付きコミットを使う利用者向けの説明（macOS で許す設定、Linux / WSL2 では人がコミットすること）を足す

## 影響

- 良い影響
  - macOS で署名を使う利用者は、Skill の最後のコミットを今までどおり CC に任せられる
  - 雛形の安全設定は変わらない。署名を使わない利用者の守りは今と同じ
  - Linux / WSL2 や、許さなかった利用者でも、Skill が署名を外したり設定を書き換えたりせずに止まる
- 悪い影響
  - 許した利用者の環境では、sandbox の中のコマンドが署名の agent を使える。署名に加えて、その agent が持つ鍵での SSH 認証もできる。
    1Password の「使うたびに承認を求める」設定を使っていれば、使われるたびに人が気づける。ssh-agent では気づけない
  - Linux / WSL2 では、署名付きコミットのたびに人の手間が残る
  - `/onboard` の質問が 1 問増える（署名を使う macOS の利用者だけ）
- その他
  - `.claude/settings.local.json` は、business-os の保護対象（20260929-05 の 4 つ）に入っていない。sandbox を緩める設定を置けるファイルなので、
    CC が書き込んで守りを緩める経路になりうる。今回の決定は人の了承の後にだけ書くが、ファイルを保護対象に足すかは別の ADR で扱う
  - 起動時の軽い点検（20260929-06）は `settings.json` を雛形と比べる。`settings.local.json` の `allowUnixSockets` は点検の対象外のまま
  - 1Password のソケットのパスと、Claude Code の `allowUnixSockets` のパスで `~` が展開されるかは、実装時に実機で確かめる
    （公式ドキュメントでは、ファイルシステムのパスについて `~` がホームを指すとだけ書かれている）
  - Linux / WSL2 でパスごとの許可が使えるようになったら、案 A の対象を広げるかを見直す

## 案ごとの長所と短所

### 案 A：署名の agent のソケットを個人設定で許す

- 長所：緩める範囲が 1 つのソケットに限られる。雛形を変えない。許した利用者は人の手間が無くなる
- 短所：macOS だけ。agent が持つ鍵での SSH 認証も sandbox の中から使えるようになる

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

## 参考

- Claude Code 公式「Sandboxing」<https://code.claude.com/docs/en/sandboxing>（`allowUnixSockets`、`allowAllUnixSockets`、`excludedCommands`、`!` 付きのコマンドの扱い、`allowUnsandboxedCommands`）
- Claude Code 公式「Settings」<https://code.claude.com/docs/en/settings>（設定の優先順位、配列の設定の連結）
- 関連 ADR：20260929-05（ステージングと承認、四重防衛）、20260929-06（起動時セルフチェック）、20261003-08（Skill の質問の表）
- `docs/design/architecture.md` 3.1 節（開発リポで sandbox を使わない理由）
