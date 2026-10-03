---
"business-os": minor
---

コミットに署名する設定でも、Skill の最後のコミットで止まらないようにしました。あわせて、安全設定を上書きできる個人設定（`.claude/settings.local.json`）を保護します。

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
