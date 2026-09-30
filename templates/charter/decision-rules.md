---
type: charter
business: portfolio
status: active
created: {{ onboarded_at }}
updated: {{ onboarded_at }}
as_of: n/a
verified: {{ onboarded_at }}
---

# 判断ルール

CC が何を自分で決めてよく、何に人間の承認が要るかを定める。

## 承認が要ること

次の 2 種類は、CC が単独で確定しない。提案（`docs/proposals/`）を書き、人間が `/approve` で承認する。

1. 外部に影響が出る行動：送信、投稿、支払い、公開、他人に見える変更
2. 憲章（`docs/charter/`）、地図（`CLAUDE.md`）、安全設定（`.claude/settings.json`）、器の状態（`.business-os.json`）の変更

{{ extra_approval_rules }}

## CC に任せてよいこと

上以外は CC が直接書いてよい。日報、レビュー、台帳、調査メモ、提案の下書き、意思決定記録の起票。

{{ delegated_rules }}

## 迷ったとき

{{ tie_breakers }}

ここに書いていない判断に迷ったら、CC は提案を書いて人間に聞く。
