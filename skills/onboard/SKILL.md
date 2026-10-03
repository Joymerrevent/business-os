---
name: onboard
description: 会社と事業の情報をインタビューで聞き取り、company リポジトリに地図（CLAUDE.md）・憲章・台帳・安全設定を書き出す。初回の導入、事業の追加・撤退、business-os の更新後の移行（--migrate）で使う。
disable-model-invocation: true
---

# /onboard

## 何をするか

利用者に会社と事業のことを順に質問し、答えから company リポジトリの初期の文書と安全設定を書き出す。
利用者は Markdown を手で書かない。質問に答えるだけでよい。

動き方は `.business-os.json` の状態で変わる。

| 状態 | 動き方 |
|---|---|
| `.business-os.json` が無い | 初回の導入。下の「初回の手順」をすべて行う |
| `state: initializing` | 前回の導入が途中で止まっている。書き出し済みのファイルを確かめ、足りないところから再開する |
| `state: active` | 導入済み。事業の追加・撤退、または `--migrate`（business-os の更新の反映）。保護対象は直接書かず、提案として書く |

## 何を読むか

1. `${CLAUDE_SKILL_DIR}/../../templates/skill-conventions.md`（共通規約。最初に必ず読む）
2. `${CLAUDE_SKILL_DIR}/../../templates/README.md`（雛形の変数と書き出し先、質問との対応）
3. `${CLAUDE_SKILL_DIR}/../../templates/` の各雛形
4. `${CLAUDE_SKILL_DIR}/../../.claude-plugin/plugin.json`（business-os のバージョン）
5. 導入済みなら、company の `docs/charter/` と `.business-os.json`

## 初回の手順

### 1. 準備

1. 作業ディレクトリが git リポジトリか確かめる。違えば質問 3 を聞き、「作る」なら `git init` する
2. sandbox が使える環境か確かめる（native Windows では使えない）。使えない環境なら質問 4 を聞き、「やめる」なら止める
3. コミットの署名の設定を確かめる（下の「コミットの署名」）
4. **最初の書き込みとして** `templates/business-os.json.tmpl` から `.business-os.json` を書き出す（`state: initializing`、`pluginVersion` は business-os のバージョン）。
   これ以降、business-os の hook は保護対象の新規作成を通し、既存ファイルの上書きだけ人間に確認を求める

### 2. インタビュー

質問 5〜20 を番号の順に聞く（下の「人に何を聞くか」の表）。項目と雛形の変数の対応は `templates/README.md` にある。

- 質問 10：事業 ID は、CC が事業の名前から英小文字・数字・ハイフンで作り、案を示してから聞く。`portfolio` は使わない
- 質問 14〜16：事業ごとにくり返す。質問 15・16 の選択肢は、CC が事業の説明から候補を 3〜5 個挙げる
- 質問 17：答えが無ければ `best`。別名のまま `.claude/settings.json` の `model` に書く（版番号を書かない）。あわせて次を伝える：
  「Fable は安全分類器で別のモデル（Opus）に自動で切り替わることがあります。その場合は `/model fable` で戻せます」
- 質問 18：native Windows なら、聞く前に次の事実を告げる：「Windows で Obsidian を使うなら、Claude Code も WSL ではなく
  Windows 上で直接動かす構成になり、Claude Code の sandbox が動きません。憲章の保護は hook と権限設定だけに頼ります」
  - 「使わない」と答えた場合：Obsidian 関連のファイルは一切書き出さない（`docs/.obsidian/`、`docs/dashboards/`、`docs/_templates/` を作らない）
  - 「使う」と答えた場合：**この時点で**インストールを確かめる（安全設定を書いた後は sandbox がインストールを止めるため）
    1. 入っているか確かめる（macOS：`/Applications/Obsidian.app` があるか、Windows：`winget list --id Obsidian.Obsidian --exact`）
    2. 無ければ、実行するコマンドを示して質問 19 を聞く。「インストールする」のときだけ実行する
       - macOS：`brew install --cask obsidian`
       - Windows：`winget install --id Obsidian.Obsidian --exact --accept-source-agreements --accept-package-agreements`
    3. Homebrew / winget が無い、またはインストールが失敗したら、<https://obsidian.md/download> から手で入れるよう案内して先へ進む
- 質問 20：「1. 準備」で署名の agent のソケットを見つけたときだけ聞く。質問文の `<ソケットのパス>` は見つけたパスに置き換える

答えに迷う項目は「まだ決めていない」でよいと伝える。その文言をそのまま書き出す。

### 3. 書き出す前の確認

書き出すファイルの一覧と、各ファイルの要点を示し、質問 21 を聞く。「直す」なら、直す点を聞いて案を作り直し、もう一度示す。

### 4. 書き出し

`templates/README.md` の「書き出し先」のとおりに書き出す。全ての `{{ }}` を埋め、行の雛形の直後にある HTML コメントを消す。

**書き出す順番を守る。`.claude/settings.json` は最後に書く。**
Claude Code は書き出された安全設定をその場で読み込み、`docs/charter/` への書き込みに権限の確認を出し始めるため、
先に書くと、残りの憲章を作るたびに確認が出てしまう。

1. `.gitignore`、`.gitattributes`、`.leak-dict.json`
   - `.leak-dict.json`：会社の呼び名、事業名、答えに出てきた人名・取引先名を `{"terms": [...]}` の形で書く（`.gitignore` 済み）
2. `CLAUDE.md`
3. `docs/charter/company.md`、`decision-rules.md`、`repositories/README.md`、`businesses/<事業 ID>.md`
   - `repositories/README.md` の「指示」の列は「無し」にする。実装リポを扱うときの指示（`repositories/<リポ名>/`）は `/onboard` では作らず、必要になったら提案として足す
4. `docs/operations/obligations.md`、`risks.md`、`state/<事業 ID>.md`、
   人間の入口 `docs/inbox/attachments/.gitkeep`（空のファイル。空のフォルダは git に残らないため置く。
   Obsidian の新規ノートと添付の置き場でもあり、フォルダが無いと Obsidian は `docs/` の直下にノートを作る）
5. Obsidian を使う場合だけ、business-os の `adapters/obsidian/` から次をコピーする（Bash の `cp` でそのまま複製してよい）
   - `vault/` の中身 → `docs/.obsidian/`
   - `bases/` の中身 → `docs/dashboards/`
   - `templates/` の中身 → `docs/_templates/`（雛形の置き場。置き換え記号を含むため business-os の検査の対象外）
   - `.gitignore` に `docs/.obsidian/workspace.json`、`docs/.obsidian/workspace-mobile.json`、`docs/.obsidian/cache/` を足す
6. 質問 20 で「許す」と答えた場合だけ、`.claude/settings.local.json` の `sandbox.network.allowUnixSockets` に、見つけたソケットのパスを 1 つ足す
   - `.claude/settings.local.json` がすでにあれば、中身を読んでキーを足す。ほかの設定を消さない（既存のファイルの上書きなので、hook が確認を出す）
   - `.claude/settings.json` には書かない（パスは利用者ごとに違い、`.claude/settings.local.json` は `.gitignore` 済み）
7. **最後に** `.claude/settings.json`
   - `ask` にある MCP の規則（`mcp__*__send_*` など）は残したうえで、
     この会話で使える MCP ツールのうち送信・投稿・作成・支払いにあたるものを具体名で追加する

保護対象（`CLAUDE.md`、`.claude/settings.json`、`.claude/settings.local.json`、`docs/charter/`）の新規作成には、business-os の hook は確認を出さない。
中身は「3. 書き出す前の確認」で了承を得たとおりに書き、了承の無い内容を足さない。

権限の確認で「No」を選ばれると、Claude Code は書き込みを取り消して会話を止める。止まったら、利用者の次の指示を待つ。
別の方法（Bash など）で書き込もうとしない。利用者が再開を指示したら、書き出し済みのファイルを確かめ、止まったところから続ける。

### 5. 仕上げ

1. 書き出した全ファイルに `{{` が残っていないことを確かめる（`docs/_templates/` の Obsidian の置き換え記号は除く）
2. 書き出した内容の要点をもう一度示し、`.business-os.json` を `state: active`、`onboardedAt` を今日にする。
   この書き換えで business-os の hook が人間に確認を求める。これが導入の確定の確認になる
3. 共通規約どおり日報に実行記録を 1 行追記する
4. 質問 22 を聞き、「コミットする」なら `git add` と `git commit` をする（push はしない）。
   署名で失敗したら、共通規約の「git」の手順に従う
5. Obsidian を使う場合は、開き方を案内する（CC は Obsidian を起動しない。sandbox がアプリの起動を止めるため）
   - 「入力欄で `! open -a Obsidian` を実行するか、Obsidian を手で起動してください」（Windows はスタートメニューから）
   - 「最初の画面で『保管庫としてフォルダを開く（Open folder as vault）』を選び、`<company の絶対パス>/docs` を選んでください。
     `company` そのものではなく、その中の `docs` です」
   - 「初めて開くときの確認の画面は、あなたが押してください」
6. 次にすることを案内する：「毎朝 `/morning`、週末に `/weekly-review` と `/check`。初回の `/check` は必ず実行してください」

## コミットの署名

署名付きコミットを使う環境では、company の sandbox が署名の agent への接続を止め、Skill の最後のコミットが失敗する。
macOS では、利用者が許せば、その agent のソケット 1 つだけに接続を許す。

1. `git config --get commit.gpgsign` が `true` でなければ、何もしない
2. macOS でなければ（Linux / WSL2）、質問 20 を聞かない。次を伝える：
   「コミットに署名する設定になっています。この環境では、Skill の最後のコミットはあなたに実行してもらうことになります」
3. macOS なら、署名の agent のソケットのパスを探す
   - `gpg.format` が `ssh` で、`gpg.ssh.program` が 1Password の `op-ssh-sign` なら：
     `~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock`
   - `gpg.format` が `ssh` で、それ以外なら：環境変数 `SSH_AUTH_SOCK` のパス
   - `gpg.format` が `openpgp` か未設定なら：`gpgconf --list-dirs agent-socket` のパス
4. パスが見つからない、またはそのパスにソケットが無ければ、質問 20 を聞かない。2 と同じことを伝える
5. 見つかったら、質問 20 を聞く。許したときの書き方は、初回は「4. 書き出し」の 6、導入済みは下の「コミットの署名を許す」

## 導入済み（state: active）のとき

- 最初に質問 1 を聞く（`--migrate` 付きで呼ばれたら聞かない）
- **事業の追加・撤退**：追加なら質問 9・10・14・15・16、撤退なら質問 2 を聞き、`docs/charter/` と `CLAUDE.md` の変更は
  `docs/proposals/` に提案として書く（新規ファイルも提案の `target` にできる）。台帳（`docs/operations/`）は直接書いてよい。
  書く前に質問 21、書いた後に質問 22 を聞く。最後に `/approve` を案内する
- **コミットの署名を許す**：「コミットの署名」の手順でソケットを探し、見つかれば質問 20 を聞く。
  「許す」なら、`.claude/settings.local.json` を `target` にした提案を書く。提案に書くのは足すソケットのパスだけにする
  （`.claude/settings.local.json` のほかの設定を、追跡される提案に写さない）。最後に `/approve` を案内する
- **`--migrate`**：business-os の雛形と company の文書を比べ、business-os の更新で増えた欄や規則を提案として書く。
  `.business-os.json` の `pluginVersion` の更新も提案にする。事業の中身は変えない
  - 雛形の安全設定の規則が company の `.claude/settings.json` に欠けていれば（厳格モード）、提案にしない。
    厳格モードでは承認しても書き込めないため、欠けている規則と、`.claude/settings.json` のどこに足すかを示し、人に手で足してもらう
  - 古い置き場の `docs/charter/repositories.md` があれば、同じ表に「指示」の列（値は「無し」）を足した内容で
    `docs/charter/repositories/README.md` を作る提案を書く。提案は新しいファイルを `target` にする。
    承認されたら、古い `docs/charter/repositories.md` を消すよう人間に案内する（CC は憲章のファイルを消さない）

## 何を書くか

- 初回：`.business-os.json`、`.gitignore`、`.gitattributes`、`.leak-dict.json`、`CLAUDE.md`、
  `docs/charter/`（会社概要・判断ルール・実装リポ・事業ごとの定義）、`docs/operations/`（期限・義務台帳、リスク台帳、事業別の現況）、
  Obsidian を使う場合は `docs/.obsidian/`・`docs/dashboards/`・`docs/_templates/`、
  コミットの署名を許した場合は `.claude/settings.local.json`、最後に `.claude/settings.json`
- 導入済み：台帳（`docs/operations/`）と、保護対象の変更の提案（`docs/proposals/`）
- 日報への実行記録（例：`- 10:00 /onboard — 初回の導入を完了（事業 2 件）`）

## 人に何を聞くか

表の番号の順に聞く。聞き方は共通規約の「人への質問」に従う。

| 番号 | 見出し | 質問文 | 答えの形 | 選択肢 | 聞くとき |
|---|---|---|---|---|---|
| 1 | 何をするか | 導入は済んでいます。何をしますか。 | 選択肢（単一） | 事業を追加する / 事業を撤退する / コミットの署名を許す / business-os の更新を反映する | 導入済みのとき（`--migrate` 付きなら聞かない） |
| 2 | 撤退する事業 | 撤退する事業はどれですか。 | 選択肢（単一） | CC が事業の一覧から挙げる | 質問 1 で「事業を撤退する」を選んだとき |
| 3 | git リポジトリ | この作業フォルダは git リポジトリではありません。`git init` で作ってよいですか。 | 選択肢（単一） | 作る / やめる | 初回で、作業フォルダが git リポジトリでないとき |
| 4 | sandbox | この環境では Claude Code の sandbox（OS による見張り）が動きません。憲章の保護は、business-os の hook と権限設定だけに頼ることになります。WSL での利用を勧めます。このまま続けますか。 | 選択肢（単一） | 続ける / やめる | 初回で、sandbox が使えない環境のとき |
| 5 | 会社の呼び名 | 会社の呼び名を教えてください。 | 自由記述 | — | 初回 |
| 6 | 一行説明 | 会社を一行で説明してください。 | 自由記述 | — | 初回 |
| 7 | 目指すこと | 会社として目指すことを教えてください。 | 自由記述 | — | 初回 |
| 8 | 優先順位 | 事業や活動の優先順位を教えてください。 | 自由記述 | — | 初回 |
| 9 | 事業の一覧 | 事業の名前と、一言の説明を教えてください。複数あれば全て挙げてください。 | 自由記述 | — | 初回、事業を追加するとき |
| 10 | 事業 ID | 事業 ID を、名前から上のとおり作りました。この ID でよいですか。 | 選択肢（単一） | この ID でよい / 直す | 初回、事業を追加するとき |
| 11 | 任せてよい範囲 | CC に任せてよいことを教えてください。 | 自由記述 | — | 初回 |
| 12 | 追加の承認 | 承認が要ることは次の 2 種類で、固定です。1 つは外部に影響が出る行動（送信・投稿・支払い・公開）、もう 1 つは会社の方針をまとめた憲章、CC が毎回読む指示書（`CLAUDE.md`）、安全設定の変更です。ほかに承認を必須にしたいことはありますか。 | 自由記述 | — | 初回 |
| 13 | 期限と義務 | 忘れてはいけない期限や義務（申告、支払い、契約更新、許認可）を、日付（YYYY-MM-DD）と一緒に教えてください。 | 自由記述 | — | 初回 |
| 14 | 実装リポジトリ | 事業の実装リポジトリの場所を、macOS と Windows のパスで教えてください。無ければ「無し」で構いません。 | 自由記述 | — | 初回、事業を追加するとき（事業ごと） |
| 15 | 追いかける数字 | 事業で追いかける数字を選んでください。 | 選択肢（複数） | CC が事業の説明から 3〜5 個挙げる | 初回、事業を追加するとき（事業ごと） |
| 16 | リスク | 事業のリスクの候補のうち、残すものを選んでください。 | 選択肢（複数） | CC が事業の説明から挙げる | 初回、事業を追加するとき（事業ごと） |
| 17 | 主セッションのモデル | 主セッションのモデル。best 推奨（使える最上位）。利用枠を節約するなら opus | 選択肢（単一） | best（推奨） / opus / fable / sonnet | 初回 |
| 18 | Obsidian | ナレッジの閲覧に Obsidian を使いますか。使わなくても business-os の動きは同じです。 | 選択肢（単一） | 使う（推奨） / 使わない | 初回 |
| 19 | Obsidian の導入 | Obsidian が入っていません。上のコマンドでインストールしてよいですか。 | 選択肢（単一） | インストールする / 自分で入れる | 質問 18 で「使う」を選び、Obsidian が入っていないとき |
| 20 | コミットの署名 | コミットに署名する設定になっています。CC が起動するコマンドは、そのままでは署名の agent（`<ソケットのパス>`）に接続できず、コミットが失敗します。この agent への接続だけを許しますか。許すと、CC が起動するコマンドはこの agent で署名と SSH 認証ができるようになります。許さない場合は、Skill の最後のコミットをあなたが実行します。 | 選択肢（単一） | 許す / 許さない | macOS で、署名の agent のソケットを見つけたとき（初回、または質問 1 で「コミットの署名を許す」を選んだとき） |
| 21 | 書き出しの確認 | この内容で書き出してよいですか。 | 選択肢（単一） | 書き出す / 直す | 書き出す前（ファイルの一覧と要点を示してから） |
| 22 | コミット | 書き出したファイルをコミットしてよいですか。 | 選択肢（単一） | コミットする / しない | 書き出した後 |

導入の確定（`state: active` への切り替え）の確認は、business-os の hook が出す。表には無い。

## 完了条件

- `.business-os.json` が `state: active` で、`pluginVersion` が business-os のバージョンと一致している
- 地図・憲章・台帳・現況・安全設定が書き出され、`{{` が残っていない（`docs/_templates/` の Obsidian の置き換え記号は除く）
- Obsidian を使わない場合、Obsidian 関連のファイルが 1 つも無い
- 質問 20 で「許す」と答えた場合、`.claude/settings.local.json` の `sandbox.network.allowUnixSockets` に見つけたソケットのパスがあり、
  それ以外の sandbox の値を足していない。許さなかった場合、`.claude/settings.local.json` に手を付けていない
- `docs/` 配下の全文書がフロントマターの規約に合っている（business-os の hook が書き込み時に確かめている）
- 日報に実行記録が 1 行ある
- 導入済みの場合は、保護対象への変更が全て提案（`status: proposed`）になっている
