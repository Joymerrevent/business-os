---
type: review
business: portfolio
status: active
created: {{ date }}
updated: {{ date }}
as_of: {{ week_end }}
verified: n/a
---

# 週次レビュー {{ week_id }}

対象：{{ week_start }} 〜 {{ week_end }}

## 今週の実績

{{ achievements }}

## 事業ごとの時間配分

| 事業 | 時間（おおよそ） | 所感 |
|---|---|---|
| {{ business_id }} | {{ hours }} | {{ note }} |

<!-- 行の雛形：事業ごとに 1 行ずつくり返し、このコメントは消す -->

## 来週の重点

{{ next_focus }}

## 現況の更新

{{ state_updates }}
