---
type: state
business: {{ business_id }}
status: active
created: {{ onboarded_at }}
updated: {{ onboarded_at }}
as_of: {{ onboarded_at }}
verified: n/a
---

# {{ business_name }} の現況

`/morning` と `/weekly-review` が読み、`/weekly-review` が更新する。更新が 14 日を超えると `/check` が警告する。

## 動いているもの

{{ state_running }}

## 待ち

{{ state_waiting }}

## 詰まり

{{ state_blocked }}
