---
max_turns: 60
timeout_seconds: 900
runs: 1
model: sonnet
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: |
  これは自動テストで、利用者はこの場にいない。質問は一切しない。
  Skill が利用者に聞く項目と確認には、利用者のメッセージにある回答表の答えを使う。
  回答表に無い項目は「まだ決めていない」とする。
---

/approve

回答表（質問されたらこの答えを使ってください。私はこの場にいません）：

- approving のまま残っている提案 20260928-01：proposed に戻す
- 提案 20260928-02：却下。理由は「判断ルールを変えるのはまだ早い」
- コミット：しない
