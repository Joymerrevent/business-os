# business-os

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
