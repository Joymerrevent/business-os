---
type: ledger
business: portfolio
status: active
created: {{ onboarded_at }}
updated: {{ onboarded_at }}
as_of: {{ onboarded_at }}
verified: n/a
---

# リスク台帳

各事業を止めかねない要因と、その兆候の一覧。`/quarterly` が見直し、`/validate` が新施策の判断に使う。

| リスク | 事業 | 兆候 | 備え | 状態 |
|---|---|---|---|---|
| {{ risk }} | {{ business_id }} | {{ risk_signal }} | {{ risk_mitigation }} | {{ risk_status }} |

<!-- 行の雛形：/onboard がリスクごとに 1 行ずつくり返し、このコメントは消す -->
