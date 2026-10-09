---
"business-os": minor
---

CC が sandbox の中で Node 製の道具（`npx skills find` など）を使ったときに、通信の失敗が「見つからない」と黙って表示されないようにしました。

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
