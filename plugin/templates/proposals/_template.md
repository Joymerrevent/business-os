---
id: {{ proposal_id }}
type: proposal
business: {{ business }}
status: proposed
target: {{ target }}
created: {{ today }}
updated: {{ today }}
as_of: n/a
verified: n/a
---

# {{ proposal_title }}

## 背景

{{ background }}

## 変更内容

{{ change_summary }}

## 差分

```diff
{{ diff }}
```

## 根拠の鮮度

参照した文書と、その `as_of` / `updated`。

{{ sources }}
