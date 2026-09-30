---
name: onboard
description: 会社と事業の情報をインタビューで聞き取り、company リポジトリに地図（CLAUDE.md）・憲章・台帳・安全設定を書き出す。初回の導入、事業の追加・撤退、器の更新後の移行（--migrate）で使う。
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
| `state: active` | 導入済み。事業の追加・撤退、または `--migrate`（器の更新の反映）。保護対象は直接書かず、提案として書く |

## 何を読むか

1. `${CLAUDE_SKILL_DIR}/../../templates/skill-conventions.md`（共通規約。最初に必ず読む）
2. `${CLAUDE_SKILL_DIR}/../../templates/README.md`（雛形の変数と書き出し先、質問との対応）
3. `${CLAUDE_SKILL_DIR}/../../templates/` の各雛形
4. `${CLAUDE_SKILL_DIR}/../../.claude-plugin/plugin.json`（器のバージョン）
5. 導入済みなら、company の `docs/charter/` と `.business-os.json`

## 初回の手順

### 1. 準備

1. 作業ディレクトリが git リポジトリか確かめる。違えば `git init` してよいか聞く
2. sandbox が使える環境か確かめる（native Windows では使えない）。使えない環境なら、次の事実を告げて、続けてよいか確認する
   - 「この環境では Claude Code の sandbox（OS による見張り）が動きません。憲章の保護は、器の hook と権限設定だけに頼ることになります。WSL での利用を勧めます」
3. **最初の書き込みとして** `templates/business-os.json.tmpl` から `.business-os.json` を書き出す（`state: initializing`、`pluginVersion` は器のバージョン）。
   これ以降、保護対象への書き込みは器の hook が人間に確認を求める

### 2. インタビュー

`templates/README.md` の「変数と /onboard の質問の対応」の順に聞く。1 度に 1 つずつ、短く聞く。

1. 会社の呼び名、一行説明、目指すこと、優先順位
2. 運営している事業の一覧（名前と一言説明）。事業 ID は CC が名前から英小文字・数字・ハイフンで作り、利用者に確認する
3. CC に任せてよい範囲と、承認が要る範囲。承認が要る 2 種類（外部に影響が出る行動、憲章と地図の変更）は固定だと伝え、追加があるかだけを聞く
4. 忘れてはいけない期限や義務（申告、支払い、契約更新、許認可）。日付は `YYYY-MM-DD` で確かめる
5. 各事業の実装リポジトリの場所（macOS と Windows のパス）。無ければ無しでよい
6. 各事業で追いかける数字。事業の説明から候補を 3〜5 個挙げ、選んでもらう（AskUserQuestion の複数選択）
7. 事業ごとのリスクの候補を CC が挙げ、残すものを選んでもらう
8. ナレッジの閲覧に Obsidian を使うか
   - 「使う」と答えた場合：「Obsidian の設定は次の版で用意します。今回は Obsidian 無しで導入します」と伝える。Obsidian 関連のファイルは一切書き出さない
   - 「使わない」と答えた場合：Obsidian 関連のファイルは一切書き出さない

答えに迷う項目は「まだ決めていない」でよいと伝える。その文言をそのまま書き出す。

### 3. 書き出す前の確認

書き出すファイルの一覧と、各ファイルの要点を示し、書き出してよいか聞く。

### 4. 書き出し

`templates/README.md` の「書き出し先」のとおりに書き出す。全ての `{{ }}` を埋め、行の雛形の直後にある HTML コメントを消す。

- `CLAUDE.md`、`.claude/settings.json`、`.gitignore`、`.gitattributes`
- `docs/charter/company.md`、`decision-rules.md`、`repositories.md`、`businesses/<事業 ID>.md`
- `docs/operations/obligations.md`、`risks.md`、`state/<事業 ID>.md`
- `.claude/settings.json` の `ask` にある MCP の規則（`mcp__*__send_*` など）は残したうえで、
  この会話で使える MCP ツールのうち送信・投稿・作成・支払いにあたるものを具体名で追加する
- `.leak-dict.json`：会社の呼び名、事業名、答えに出てきた人名・取引先名を `{"terms": [...]}` の形で書く（`.gitignore` 済み）

保護対象（`CLAUDE.md`、`.claude/settings.json`、`docs/charter/`）を書くたびに、器の hook が人間に確認を求める。
確認で「いいえ」と答えられたら、そのファイルの内容を直すか聞き、勝手に先へ進まない。

### 5. 仕上げ

1. 書き出した全ファイルに `{{` が残っていないことを確かめる
2. `.business-os.json` を `state: active`、`onboardedAt` を今日にする
3. 共通規約どおり日報に実行記録を 1 行追記する
4. コミットしてよいか聞き、よければ `git add` と `git commit` をする（push はしない）
5. 次にすることを案内する：「毎朝 `/morning`、週末に `/weekly-review` と `/check`。初回の `/check` は必ず実行してください」

## 導入済み（state: active）のとき

- **事業の追加・撤退**：新しい事業の質問（上の 2・5・6・7）だけをし、`docs/charter/` と `CLAUDE.md` の変更は
  `docs/proposals/` に提案として書く（新規ファイルも提案の `target` にできる）。台帳（`docs/operations/`）は直接書いてよい。最後に `/approve` を案内する
- **`--migrate`**：器の雛形と company の文書を比べ、器の更新で増えた欄や規則を提案として書く。
  `.business-os.json` の `pluginVersion` の更新も提案にする。事業の中身は変えない

## 人に何を聞くか

- 上のインタビューの項目
- 書き出す前の確認、保護対象の書き込みごとの確認（hook による）、コミットしてよいか

## 完了条件

- `.business-os.json` が `state: active` で、`pluginVersion` が器のバージョンと一致している
- 地図・憲章・台帳・現況・安全設定が書き出され、`{{` が残っていない
- `docs/` 配下の全文書がフロントマターの規約に合っている（器の hook が書き込み時に確かめている）
- 日報に実行記録が 1 行ある
- 導入済みの場合は、保護対象への変更が全て提案（`status: proposed`）になっている
