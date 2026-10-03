---
id: 20261003-13
title: コミットの署名の流れは、質問の流れの進行役で company の安全設定を読み込み、Bash を許して検証する
type: decision
business: n/a
status: accepted
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: 2026-10-03
supersedes: n/a
---

# 20261003-13: コミットの署名の流れは、質問の流れの進行役で company の安全設定を読み込み、Bash を許して検証する

## 背景と問い

20261003-11 で、コミットの署名について次の 2 つを Skill の手順に入れた。

- `/onboard` は、macOS で署名付きコミットを使う利用者に、署名の agent のソケットへの接続を許すかを聞く（質問 20）
- どの Skill も、コミットが署名で失敗したら、設定を変えず、署名も外さずに止まり、`! git commit …` を示す（共通規約の「git」）

どちらも Skill の動作の検証（eval）では確かめていない。確かめたのは、実装の PR で手作業の実験を 1 回しただけである。
しかも eval の作業場所では、開発者の設定が流れを変えないように `commit.gpgsign=false` にしてあり、署名の流れを通らない。

今の検証の仕組みには、2 つの壁がある。

1. 20261003-02 の決定 2 は、Bash が要るケースを eval の対象外にした。`claude plugin eval` で Bash を許すと、
   Docker Desktop が `~/.docker` に置くシンボリックリンクのせいで実行が始まらないためである。
   2026-10-03 に同じ開発機で試し直したが、まだ始まらない（`the Docker (~/.docker, DOCKER_CONFIG) credential store on this machine holds a symbolic link inside it`）
2. 質問の流れの進行役（20261003-02 の決定 3）は `--setting-sources ""` で起動する。そのため、作業場所の company の `.claude/settings.json` も読み込まれず、
   **進行役の実行では sandbox が無効**になっている

署名の流れは、sandbox が署名の agent への接続を止めることから起きる。sandbox が無効なままでは、失敗も成功も再現しない。
一方、20261003-02 の決定 2 の見直しの条件「Bash が要る Skill が増えたとき」には当たる。コミットの手順は 10 個すべての Skill にある。

2026-10-03 に、Claude Code・macOS・haiku で、進行役と同じ起動の仕方（`claude -p --plugin-dir <business-os> --strict-mcp-config --output-format json`）を試した。
偽の署名プログラム（試験が用意した Unix ソケットに接続できたときだけ署名を書く Node のスクリプト）を `gpg.ssh.program` に設定し、
`git commit` と、書き込み禁止のファイルへの書き込みを実行させた。

| 設定の読み込み方 | sandbox の設定 | コミット | 書き込み禁止のファイル |
|---|---|---|---|
| `--setting-sources ""` と `--settings '<JSON>'` | ソケットの許可なし | 失敗（`connect EPERM <ソケット>`）。sandbox は効いている | **書けてしまった**。`--settings` で渡した `./` の相対パスの denyWrite が効かない |
| 同上 | `allowUnixSockets` にソケット | 通った（`gpgsig` 付き） | 書けてしまった |
| `--setting-sources project` と作業場所の `.claude/settings.json` | ソケットの許可は `.claude/settings.local.json` | **失敗**。`local` を読まないため、`.claude/settings.local.json` の許可が効かない | 止まった |
| `--setting-sources project,local` と作業場所の `.claude/settings.json` | 同上 | 通った（`gpgsig` 付き） | 止まった |

あわせて、sandbox の中から `.claude/settings.local.json` への追記は、試験の denyWrite に書いていなくても止まった（Claude Code が自身の設定のファイルを守っている）。

問い：署名の流れを、どの仕組みで、どこまで自動で検証するか。

## 判断の基準

- 実際の company と同じ安全設定（作業場所の `.claude/settings.json` と `.claude/settings.local.json`）の下で動かす
- 開発者の個人の設定（`~/.claude/settings.json`、`CLAUDE.md`）を読み込まない（20261003-02 の決定 3 の 6）
- 1Password などが入っていない開発機でも、同じ結果になる
- 長期トークンや `--privileged` のコンテナを要しない（20261003-02 の根拠 2）
- Bash を許しても、作業場所の外に書けない

## 検討した案

- 案 A：質問の流れの進行役で、署名のケースだけ `--setting-sources project,local` と Bash を許し、偽の署名プログラムと試験のソケットで動かす
- 案 B：`claude plugin eval` で Bash を許せるように、開発機の `~/.docker` を直す
- 案 C：`--privileged` のコンテナで `claude plugin eval` を動かす（20261003-02 で退けた案）
- 案 D：自動では検証せず、手で確かめる

## 決定

採用：**案 A**。進行役は `claude -p` で動き、`claude plugin eval` の Docker の検査を通らない。
作業場所の安全設定を読み込めば sandbox が実際の company と同じに効き、Bash を許しても作業場所の外には書けない。
偽の署名プログラムと試験のソケットを使うので、開発機に 1Password が無くても結果が同じになる。

1. 進行役の台本に、Bash を許すかの欄を足す（例：`"sandbox": true`）。この欄がある台本だけ、次のように起動する。ほかの台本の起動は変えない
   - `--setting-sources ""` の代わりに `--setting-sources project,local` を渡す（作業場所の `.claude/settings.json` と `.claude/settings.local.json` だけを読む）
   - `--allowedTools` に `Bash` を足す
   - macOS 以外では、その台本を実行せず「macOS でだけ動く」と表示して飛ばす（`allowUnixSockets` が macOS でしか効かないため）
2. 署名のケースの作業場所は、共通の scaffold に新しい種類として足す
   - 作業場所のリポジトリに `commit.gpgsign=true`、`gpg.format=ssh`、偽の `user.signingkey`、`gpg.ssh.program` に偽の署名プログラムを設定する
   - 偽の署名プログラムは `evals/lib/` に置く Node のスクリプトで、作業場所の中の決まった名前のソケットに接続できたときだけ署名のファイルを書く。
     接続できなければ、1Password と同じく `Could not connect to socket` を含む文言で失敗する
   - 進行役は、作業場所にそのソケットを開き、台本が終わるまで保つ
   - ソケットへの接続を許すケースは、作業場所の `.claude/settings.local.json` の `sandbox.network.allowUnixSockets` にそのパスを書く
3. 足すケースは次の 3 つ
   1. **署名の質問**（`/onboard` の初回）：環境変数 `SSH_AUTH_SOCK` を試験のソケットに向けて起動し、質問 20 が聞かれ、質問文にそのパスが入ることを確かめる。
      質問 21（書き出しの確認）で断る（20261003-02 の決定 3 の 4）
   2. **署名で失敗したら止まる**（文書を書いてコミットを聞く Skill。費用の小さい `/adr` を使う）：ソケットの許可なしで、質問のコミットに「コミットする」と答える。次を確かめる
      - コミットが増えていない
      - 進行役の最後の応答に `! git commit` が含まれる
      - 会話の記録の Bash の呼び出しに、`--no-gpg-sign`、`commit.gpgsign=false`、`git config` による書き換えが無い
   3. **許したソケットで通る**：2 と同じ流れで、`.claude/settings.local.json` にソケットを許す。コミットが 1 つ増え、`gpgsig` が付いていることを確かめる
4. 進行役に、質問の順番のほかに、終わった後の状態を確かめる判定を足す（コミットの数、最後の応答の文言、会話の記録に残る Bash の呼び出し）。
   判定の正典は台本に書き、進行役は台本の判定を実行するだけにする
5. 20261003-02 の決定 2 のうち、コミットは自動の検証に移す。`/check` と Obsidian のファイルのコピーは、今までどおり eval の対象外にする

## 影響

- 良い影響
  - 署名の流れ（質問、止まり方、許したときに通ること）を、実際の company と同じ安全設定の下で自動で確かめられる
  - 進行役の実行で、sandbox が効いていない状態を 1 つ減らせる
  - `claude plugin eval` の Docker の制約に関係なく動く
- 悪い影響
  - Bash を許すケースは、`claude plugin eval` の隔離（専用の作業場所と設定）の外で動く。守りは作業場所の sandbox だけになる
  - 進行役が、質問の順番のほかに、状態と会話の記録を判定するようになり、仕組みが大きくなる
  - macOS でしか動かない。Linux の開発機では 3 つのケースが飛ばされる
  - 3 つのケースの分だけ、実行のたびにメンテナの利用枠を使う
- その他
  - `--setting-sources project,local` で、開発者の `~/.claude/CLAUDE.md` が読み込まれないかは、実装時に確かめる（`""` では読み込まれないことを 20261003-02 で確かめた）
  - `--plugin-dir` の business-os の hook が、`project,local` でも走るかを実装時に確かめる
  - `.claude/settings.local.json` の中身を `/onboard` が書くこと（許したときの書き出し）は、Claude Code が `.claude/` への書き込みを守るため、今までどおり手で確かめる
  - `claude plugin eval` で Bash を許せるようになったら（Docker の検査が変わる、`~/.docker` を直す）、案 B に移すかを見直す

## 案ごとの長所と短所

### 案 A：進行役で安全設定を読み込み、Bash を許す

- 長所：試したとおりに動く。実際の company と同じ安全設定で動く。長期トークンもコンテナも要らない
- 短所：`claude plugin eval` の隔離が無い。macOS だけ。進行役の仕組みが大きくなる

### 案 B：開発機の `~/.docker` を直す

- 長所：`claude plugin eval` の隔離の中で、回答表のケースとして書ける
- 短所：Docker Desktop が置く標準のシンボリックリンクで止まるため、Docker Desktop を使う開発機ごとに手を入れることになる。直しても、Docker Desktop の更新で戻りうる

### 案 C：`--privileged` のコンテナで動かす

- 長所：Linux でも動く
- 短所：長期トークンの保管が要り、`allowUnixSockets` が Linux では効かないため、ソケットを許すケースが書けない（20261003-02 で退けた理由もそのまま残る）

### 案 D：手で確かめる

- 長所：仕組みが増えない
- 短所：10 個の Skill のコミットに関わる手順が、変更のたびに確かめられないまま残る

## 参考

- 関連 ADR：20261003-02（Skill の自動検証で残した 4 つの論点の扱い。決定 2 と決定 3 の起動の仕方を、署名のケースに限って改める）、
  20261003-11（コミットの署名を sandbox の中で通す方法）、20261003-01（Skill の動作は claude plugin eval で検証する）
- Claude Code 公式「Settings」<https://code.claude.com/docs/en/settings>（`--setting-sources`、設定の優先順位）
- Claude Code 公式「Sandboxing」<https://code.claude.com/docs/en/sandboxing>（`allowUnixSockets` は macOS だけ）
