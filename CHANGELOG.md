# business-os

## 0.4.0

### Minor Changes

- 395a3d8: 外部のツール（MCP）の操作のうち、読むだけの操作（取得・一覧・検索）以外は、CC が実行する前に必ず確認が出るようにしました。
  
  - これまでは、名前が「送信・投稿・作成・支払い」の型に合う操作だけが確認の対象でした。GitHub の Issue の作成・PR のマージ・リポジトリの削除や、メールの返信・転送は、確認なしで実行できました
  - 読むだけと分からない操作は、安全のために確認が出ます
  - 新しく作る company の `.claude/settings.json` には、確認の対象にする操作の型（予備の規則）が増えます
  
  **導入済みの company の方へ**：確認は business-os の更新だけで効きます。あわせて、確認の仕組みが動かなかったときの予備として、
  `.claude/settings.json` に規則を足してください。足していない間は、起動時の点検と `/check` が「予備の規則が無い」と知らせます（作業は止まりません）。
  
  足し方は 2 つあります。どちらか一方で足りるので、足した後に `/check` で確かめてください。
  
  - `/onboard --migrate` を実行すると、CC が足す規則を提案に書きます。`/approve` で承認すると反映されます（反映の直前に権限確認が 1 回出ます）
  - 手で足す場合は、エディタで `.claude/settings.json` を開き、`permissions.ask` の `"mcp__*__pay_*"` の行末にカンマ（`,`）を足し、その次の行に次の内容を足します
  
  ```json
  "mcp__*__*write*", "mcp__*__issue_write", "mcp__*__delete*", "mcp__*__update*", "mcp__*__merge*",
  "mcp__*__push*", "mcp__*__reply*", "mcp__*__forward*", "mcp__*__trash*", "mcp__*__untrash*",
  "mcp__*__add_*", "mcp__*__assign*", "mcp__*__dismiss*", "mcp__*__fork*", "mcp__*__manage*",
  "mcp__*__mark*", "mcp__*__unmark*", "mcp__*__request*", "mcp__*__star*", "mcp__*__unstar*",
  "mcp__*__*trigger*", "mcp__*__label_*", "mcp__*__unlabel_*", "mcp__*__apply_*", "mcp__*__move*",
  "mcp__*__copy*", "mcp__*__share*", "mcp__*__upload*", "mcp__*__respond*"
  ```
- be694c7: business-os の不具合や要望を開発者に伝える `/report` を足しました。
  
  - CC が、伝えたいことを聞き取って Issue の下書きを作ります。不具合の報告には、business-os・Claude Code・Node の版、OS、設定が雛形と違うところ（名前だけ）を自動で足します
  - 下書きに、会社名や人名など事業データらしいものが見つかると、下書きを作らずに止めます。置き換えてから作り直します
  - 下書きはファイルに書き出すので、あなたが開いて中身を確かめ、承認してから送ります。承認した後に中身が変わっていれば送りません
  - GitHub のコネクタがあれば CC が送ります。無ければ、項目を入力済みの Issue 作成のページを示すので、ブラウザで送ってください
  - 安全装置が働かない不具合は、公開の Issue ではなく、非公開の報告の経路を案内します
  - `/check` と `/retro` は、business-os への報告や改善案があるときに `/report` を案内します
- 4da5bf9: CC が sandbox の中で Node 製の道具（`npx skills find` など）を使ったときに、通信の失敗が「見つからない」と黙って表示されないようにしました。
  
  - 新しく作る company の `.claude/settings.json` に、`env` の設定を 3 つ足します。許していない送り先に接続しようとすると、Claude Code の確認が出るようになります
  - `npx` が、安全装置（sandbox）の書き込みの制限の中で動くようになります
  - 「root 所有のファイル」と表示されて `sudo chown` を勧められても、CC は実行せず、あなたに伝えます
  - `/retro` は、Skill を作る提案の前に、既製の Skill を探します。入れるかどうかはあなたが決め、入れるときはあなたが版を固定して入れます
  
  **導入済みの company の方へ**：`.claude/settings.json` に `env` の 3 つが無い間は、起動時の点検と `/check` が知らせます（作業は止まりません）。
  足し方は 2 つあります。どちらか一方で足りるので、足した後に `/check` で確かめてください。
  
  - `/onboard --migrate` を実行すると、CC が足す設定を提案に書きます。`/approve` で承認すると反映されます（反映の直前に権限確認が 1 回出ます）
  - 手で足す場合は、エディタで `.claude/settings.json` を開き、`"model"` の行の次の行に次の内容を足します（`${TMPDIR}` はそのまま書きます）
  
  ```json
  "env": {
    "NODE_USE_ENV_PROXY": "1",
    "npm_config_cache": "${TMPDIR}/npm-cache",
    "DO_NOT_TRACK": "1"
  },
  ```
- b162bba: business-os が配布する Skill の数を固定しないようにしました。今後、どの事業でも使える業務の Skill（共通業務 Skill）や、business-os そのものを扱う Skill（サポート Skill）を足せるようになります。
  
  - `/retro` は、使われていない business-os の Skill があれば、名前と呼ばれた回数を「business-os への改善案」に書きます
  - business-os のリポジトリの Issues に、Skill の追加と、Skill の削除・統合を提案する専用のフォームができました

### Patch Changes

- e5c091b: `CLAUDE.md` を「地図」と呼ばず、「CC への指示書（`CLAUDE.md`）」と書くようにしました。
  
  - `/onboard` の書き出し前の一覧、`/retro` の提案、`/approve` の説明、新しく作る `CLAUDE.md` の見出しと判断ルールが対象です
  - `/onboard` の書き出し前の一覧は、1 行に 1 ファイルの表で示します
- e463769: 配布物を `plugin/` フォルダに集め、マーケットプレイスの `source` をそのフォルダに向けました。導入と更新の手順は変わりません。更新すると、利用者の環境に写るのは Skill・エージェント・hook・雛形などの配布物だけになり、business-os の開発にだけ使うテスト・検証・設計文書は写らなくなります。

## 0.3.0

### Minor Changes

- db3d465: コミットに署名する設定でも、Skill の最後のコミットで止まらないようにしました。あわせて、安全設定を上書きできる個人設定（`.claude/settings.local.json`）を保護します。
  
  - macOS で署名付きコミットを使っている場合、`/onboard` が署名の agent を見つけ、その agent への接続だけを許すかを聞きます。
    許すと `.claude/settings.local.json` に agent の場所を書き、CC がコミットまで行えます。導入済みの company では、`/onboard` の「コミットの署名を許す」から設定できます
  - 署名で失敗したときは、どの Skill も署名を外したり設定を書き換えたりせず、入力欄で実行するコマンドを示して止まります
  - `.claude/settings.local.json` を、憲章や `.claude/settings.json` と同じく CC が直接書き換えられない対象にしました
  - `.claude/settings.local.json` が sandbox を無効にしている、または読めない場合は、厳格モードになります。
    全ての Unix ソケットを許す設定や、sandbox の外で動かすコマンドがある場合は、起動時と `/check` で知らせます
  
  **更新後に必要な作業**：導入済みの company は、更新後の最初のセッションで厳格モードになります。
  `company/.claude/settings.json` に次の 2 行を手で足してください。
  
  - `sandbox.filesystem.denyWrite` に `"./.claude/settings.local.json"`
  - `permissions.ask` に `"Edit(./.claude/settings.local.json)"`

### Patch Changes

- d137a77: `/onboard` で承認が要ることを聞く質問を、用語の説明なしで読める文にしました。
  
  - 「地図」と書いていた箇所を「CC が毎回読む指示書（`CLAUDE.md`）」と書き、承認の対象に安全設定も挙げる
  - 承認と提案の説明（`docs/usage/operations.md`）も同じ書き方にそろえる
- 8630dd4: Skill の質問の先頭に付く番号の表記で、コロンと括弧を全角にそろえました。途中の質問から半角の `:` `(` に変わることがありました。
- 83bb3ed: Skill の質問の先頭に付く番号を、その回で何問目かと、全部で何問になりそうかの表示にしました。
  
  - 例：「質問 6/19：事業 ID（質問 ID：10）」。最初の質問は 1 問目から数えます
  - 括弧の中の質問 ID は、質問ごとに決まった番号で、どの回でも変わりません
  - 事業ごとに聞く質問がある Skill（`/onboard` など）は、事業の数が分かるまで全部の数を出さず、「質問 1：会社の呼び名（質問 ID：5）」と表示します
  - 全部の数は見込みで、聞かなくてよくなった質問や、答えによって増えた質問があると変わります
  - 答えが曖昧で聞き返すときは「（質問 ID：5 の確認）」が付きます
  - `/onboard` で事業ごとに聞く質問（実装リポジトリ・追いかける数字・リスク）は、1 つの事業について 3 問をまとめて聞いてから次の事業へ進みます

## 0.2.0

### Minor Changes

- f2812a9: 各 Skill が人に聞く質問を固定し、毎回同じ質問を同じ順で聞くようにしました。
  
  - 質問の先頭に「質問 3/21：任せてよい範囲」のような番号と見出しが付き、あと何問あるかが分かります
  - 質問文は Skill ごとに決まった文を使います。質問の前に、読んだ文書の要約や候補が添えられることがあります
  - 1 回に聞くのは 1 つの質問だけです。`/onboard` の「会社の呼び名・一行説明・目指すこと・優先順位」のように、まとめて聞いていた項目は 1 つずつ聞きます
  - 答えが曖昧で聞き返すときは「（質問 3 の確認）」が付きます
  - 選択肢の質問は、決まった見出しと選択肢で聞きます
- c40ae7c: 実装リポジトリの一覧を `docs/charter/repositories/README.md` に移し、実装リポジトリについての指示とメモの置き場を決めました。
  
  - 実装リポジトリを扱うときに CC が守ること（指示）は `docs/charter/repositories/<リポ名>/`、CC が調べたことや作業の記録（メモ）は `docs/knowledge/repositories/<リポ名>/` に置きます。実装リポジトリの開発に要ることは、これまでどおり実装リポジトリの中に置きます
  - 一覧の表に「指示」の列が増えました
  - company の地図（`CLAUDE.md`）に、一覧を毎回読むことと、実装リポジトリを扱うときの手順が増えました
  - 導入済みの company では、`/onboard --migrate` が `docs/charter/repositories.md` を新しい置き場へ移す提案を書きます。承認したあと、古い `docs/charter/repositories.md` は手で消してください

## 0.1.0

### Minor Changes

- 979d407: 最初のリリース（alpha）。1 人で複数の事業を運営する人が Claude Code を経営の手足として使うための Plugin。
  
  - 経営基盤の Skill 10 個（`/onboard` `/approve` `/check` `/adr` `/morning` `/weekly-review` `/close` `/quarterly` `/retro` `/validate`）
  - 憲章などを守る安全装置（書き込みのガード、コマンドの意味解析、毎セッションの軽い点検、週次の重い点検と実機の発火試験）
  - company の雛形と、フロントマターの規約
  - 任意の Obsidian アダプタ

### Patch Changes

- b12909c: 主セッション（CC）を会社の COO と位置づけ、人との対話を含まない大きな作業を作業者に任せる形にしました。

  - 作業者エージェント `worker` を同梱（`sonnet`、ファイルの読み書きと検索だけ。人との対話と外部への行動はしない）
  - `/onboard` で主セッションのモデルを聞く（既定は `best`。利用枠を節約するなら `opus`）
  - `/quarterly` と `/retro` の分析は作業者に任せる
