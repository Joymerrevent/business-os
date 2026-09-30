---
type: review
business: portfolio
status: active
created: {{ date }}
updated: {{ date }}
as_of: {{ as_of }}
verified: n/a
---

# 四半期レビュー {{ quarter_id }}

数字の基準日：{{ as_of }}（この文書の数字は全てこの日時点）

## 事業ごとの判断

| 事業 | 3 か月の推移 | 判断（継続 / 縮小 / 撤退） | 理由 |
|---|---|---|---|
| {{ business_id }} | {{ trend }} | {{ decision }} | {{ reason }} |

<!-- 行の雛形：事業ごとに 1 行ずつくり返し、このコメントは消す -->

## リスクの見直し

{{ risk_review }}

## 憲章の確認

最終確認日（`verified`）が 90 日を超えた憲章と、その扱い。

{{ charter_review }}

## 出した提案

{{ proposals }}
