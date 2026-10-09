---
type: review
business: portfolio
status: active
created: {{ date }}
updated: {{ date }}
as_of: {{ as_of }}
verified: n/a
---

# 月次締め {{ month_id }}

数字の基準日：{{ as_of }}（この文書の数字は全てこの日時点）

## 事業ごとの収支

| 事業 | 売上 | 費用 | 差額 | 数字の出どころ |
|---|---|---|---|---|
| {{ business_id }} | {{ revenue }} | {{ cost }} | {{ margin }} | {{ source }} |

<!-- 行の雛形：事業ごとに 1 行ずつくり返し、このコメントは消す -->

## 資金

- 全社の資金残高：{{ cash }}
- 来月の支払い予定：{{ payments }}

## 来月の期限

{{ deadlines }}

## KPI の見直し

{{ kpi_notes }}
