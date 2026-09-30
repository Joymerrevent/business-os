---
type: review
business: portfolio
status: active
created: {{ date }}
updated: {{ date }}
as_of: {{ period_end }}
verified: n/a
---

# 振り返り {{ date }}

対象期間：{{ period_start }} 〜 {{ period_end }}

## Skill の実行回数

| Skill | 回数 |
|---|---|
| {{ skill }} | {{ count }} |

<!-- 行の雛形：Skill ごとに 1 行ずつくり返し、このコメントは消す -->

## 2 回以上くり返した依頼（Skill 化の候補）

{{ repeated_requests }}

## 使われていない Skill（削除・凍結の候補）

{{ unused_skills }}

## 地図と運用ルールへの提案

{{ rule_proposals }}

## 出した提案

{{ proposals }}
