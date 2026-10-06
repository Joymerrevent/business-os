---
"business-os": minor
---

外部のツール（MCP）の操作のうち、読むだけの操作（取得・一覧・検索）以外は、CC が実行する前に必ず確認が出るようにしました。

- これまでは、名前が「送信・投稿・作成・支払い」の型に合う操作だけが確認の対象でした。GitHub の Issue の作成・PR のマージ・リポジトリの削除や、メールの返信・転送は、確認なしで実行できました
- 読むだけと分からない操作は、安全のために確認が出ます
- 新しく作る company の `.claude/settings.json` には、確認の対象にする操作の型が増えます

**導入済みの company の方へ**：この版に上げると、`.claude/settings.json` に新しい規則が無いため、起動時の点検が「必須規則の欠落」を示し、
憲章などの保護対象への書き込みがすべて止まります（厳格モード）。CC は `.claude/settings.json` を書き換えられないので、
あなたがエディタで `.claude/settings.json` を開き、`permissions.ask` の `"mcp__*__pay_*"` の行末にカンマ（`,`）を足し、その次の行に次の内容を足してください。
足した後に `/check` で確かめてください。

```json
"mcp__*__*write*", "mcp__*__issue_write", "mcp__*__delete*", "mcp__*__update*", "mcp__*__merge*",
"mcp__*__push*", "mcp__*__reply*", "mcp__*__forward*", "mcp__*__trash*", "mcp__*__untrash*",
"mcp__*__add_*", "mcp__*__assign*", "mcp__*__dismiss*", "mcp__*__fork*", "mcp__*__manage*",
"mcp__*__mark*", "mcp__*__unmark*", "mcp__*__request*", "mcp__*__star*", "mcp__*__unstar*",
"mcp__*__*trigger*", "mcp__*__label_*", "mcp__*__unlabel_*", "mcp__*__apply_*", "mcp__*__move*",
"mcp__*__copy*", "mcp__*__share*", "mcp__*__upload*", "mcp__*__respond*"
```
