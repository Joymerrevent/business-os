---
id: 20260929-03
title: 憲章と育つ文書の分離
type: decision
business: n/a
status: accepted
created: 2026-09-30
updated: 2026-10-03
as_of: n/a
verified: 2026-10-03
supersedes: n/a
---

# 20260929-03: 憲章と育つ文書の分離

## 背景

会社の文書には性質が違う 2 種類がある。

- **稀に変わるもの**：会社は何者か、何を優先するか、何を承認制にするか、どんな事業があるか
- **毎日増えるもの**：日報、レビュー、台帳、調査メモ、SOP

前者を AI が勝手に書き換えると会社の方針が知らぬ間に変わる。後者を人間が全部書くと
運用が止まる。「誰が書くか」と「CC がどう読むか」が違うので、置き場を分ける。

## 決定

`company` リポの `docs/`（Obsidian の Vault root）を以下に分ける。

| フォルダ | 性質 | 書き手 | AI の直接書き込み |
|---|---|---|---|
| `charter/` | 憲章。会社概要・判断ルール・事業定義・実装リポの場所 | 人間 | **禁止**（`proposals/` 経由のみ） |
| `proposals/` | AI の提案。承認待ち | AI | 可 |
| `decisions/` | 意思決定記録（ADR） | AI が起票、人間が accepted | 可（status 変更は人間） |
| `operations/` | 台帳（期限・義務、リスク、事業別現況）、日報、レビュー | AI 主導 | 可 |
| `knowledge/` | 調査、SOP、育つ知識 | AI 主導 | 可 |
| `inbox/` | 人間の入口。未整理メモ、クリップ、添付 | 人間 | 整理を頼まれたときのみ |
| `dashboards/` | Obsidian Bases の雛形（任意アダプタ） | business-os が配置 | 可 |
| `archive/` | 完了・凍結したもの | — | 移動のみ |

読み方の違い：

- `charter/` は毎セッション読む（少ないから読める）。`CLAUDE.md` の「入り方」で指示する
- `operations/` `knowledge/` は必要なときだけ検索して読む（多いから全部は読めない）

CC 自身のメモ（auto memory）はこの分類の外。CC が自分のために `~/.claude/` 配下に持つもので、
人間向け文書ではない。business-os は関与しない。

## 根拠

- 先行事例は一貫して「核心コンテキスト（稀に変わる）」と「参照文書・SOP（育つ）」を分けている。
  Workflowsio の Company OS starter kit、AgriciDaniel/claude-obsidian の `_raw/` と `wiki/` 分離、
  Karpathy の LLM Wiki パターン（`sources/` は不変、`wiki/` は AI 生成）
- 2026 年 5 月版の business-os の `strategy/` と `wiki/` がこれに対応していた。名前を中身に合わせて改めた
- `core` という名前は「何の核か」が伝わらないため、**憲章（charter）**に改名した。
  「会社が何者で、何をどう決めるかを人間が定めた文書」という意味がそのまま
- `ops` → `operations`、`meta` → `dashboards` も同じ理由（中身を知らない人が見て分かる名前）

## 影響

- `charter/` への書き込み制御は 20260929-05（四重防衛）が担う
- 全フォルダの文書に統一フロントマター（`type` `business` `status` + 4 日付欄、20260929-09）を持たせ、
  Obsidian の Bases や `/check` がフォルダ横断で扱えるようにする
- `inbox/` の整理は `/retro` または人間の依頼で行い、整理後は `knowledge/` か `archive/` へ移す

## 参考

- Workflowsio/company-os-starter-kit：核心コンテキストと参照文書の分離
- AgriciDaniel/claude-obsidian：`_raw/`（人間入口）と `wiki/`（AI 整形）の分離
- 関連 ADR：20260929-02（CLAUDE.md）、20260929-05（承認）、20260929-09（日付欄）
