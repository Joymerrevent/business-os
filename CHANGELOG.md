# business-os

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
