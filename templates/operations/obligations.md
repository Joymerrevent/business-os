---
type: ledger
business: portfolio
status: active
created: {{ onboarded_at }}
updated: {{ onboarded_at }}
as_of: {{ onboarded_at }}
verified: n/a
---

# 期限・義務台帳

税務、支払い、契約更新、許認可など、忘れると信用を失う期限と義務の一覧。
`/morning` が今日と直近の期限を、`/close` が来月の期限を、ここから拾う。

- 日付は `YYYY-MM-DD`。毎年・毎月のものは「頻度」に書き、「次回」を更新する
- 済んだものは「状態」を `済` にし、次回があれば行を足す

| 次回 | 内容 | 事業 | 頻度 | 状態 |
|---|---|---|---|---|
| {{ due }} | {{ obligation }} | {{ business_id }} | {{ frequency }} | {{ obligation_status }} |

<!-- 行の雛形：/onboard が期限・義務ごとに 1 行ずつくり返し、このコメントは消す -->
