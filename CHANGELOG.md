# business-os

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
