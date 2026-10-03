---
max_turns: 80
timeout_seconds: 1200
runs: 1
model: sonnet
allowed_tools: [Read, Glob, Grep, Skill, Agent]
append_system_prompt: |
  これは自動テストで、利用者はこの場にいない。質問は一切しない。
  Skill が利用者に聞く項目と確認には、利用者のメッセージにある回答表の答えを使う。
  回答表に無い項目は「まだ決めていない」とする。
---

/retro

回答表（質問されたらこの答えを使ってください。私はこの場にいません）：

- 対象期間：2026-09-28 から今日まで
- 提案の候補：すべて提案にする。優先度は高
- コミット：しない
