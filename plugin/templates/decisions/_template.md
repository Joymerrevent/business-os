---
id: {{ decision_id }}
type: decision
business: {{ business }}
status: proposed
created: {{ date }}
updated: {{ date }}
as_of: {{ as_of }}
verified: n/a
---

# {{ decision_title }}

## 背景

何が問題で、なぜ今決めるのか。

{{ background }}

## 決定

{{ decision }}

## 根拠

検討した他の選択肢と、選ばなかった理由。

{{ rationale }}

## 影響

この決定で何が変わるか。撤退条件があれば書く。

{{ consequences }}

## 根拠の鮮度

参照した文書と、その `as_of` / `updated`。

{{ sources }}
