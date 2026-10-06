---
"business-os": minor
---

外部のツール（MCP）の操作のうち、読むだけの操作（取得・一覧・検索）以外は、CC が実行する前に必ず確認が出るようにしました。

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
