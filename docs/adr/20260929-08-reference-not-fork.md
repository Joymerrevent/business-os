---
id: 20260929-08
title: 既製フレームワークは参考にし、fork しない
type: decision
business: n/a
status: accepted
created: 2026-09-30
updated: 2026-10-03
as_of: n/a
verified: 2026-10-03
supersedes: n/a
---

# 20260929-08: 既製フレームワークは参考にし、fork しない

## 背景

2026 年には「Company OS」がジャンルとして定着し、gstack（Garry Tan、108K stars）、
JOINCLASS の AI-CEO Framework、Workflowsio の Company OS starter kit、Solopreneur OS など
「他人のフレームワーク」が多数ある。丸ごと入れたくなるが、gstack のレビューは
「fork して自分に合うコマンドだけ残し、語彙を自分に合わせろ」と結論している。
他人のフレームワークには自分に合わない部分が必ず混ざり、何が入っているか把握できなくなる。

## 決定

外部リソースの取り込み方を 3 区分に分ける。

| 区分 | 扱い | 対象例 | 条件 |
|---|---|---|---|
| そのまま入れる | 公式 Plugin としてインストールし、更新に追従 | `anthropics/skills`（文書生成、skill-creator）、Obsidian を使うなら `kepano/obsidian-skills` | 作者が公式または一次情報源で、メンテが継続し、汎用機能で語彙の衝突がない |
| fork して削る | リポを fork し、必要な Skill だけ残して語彙を書き換える | （現時点で該当なし） | 良い設計だが大半が不要で、用語が合わない |
| 参考にして自作 | SKILL.md を読んで設計思想だけ借り、business-os の Skill を自分で書く | gstack の `/office-hours` `/retro` `/review` の思想、JOINCLASS の承認パイプライン、Workflowsio のフォルダ責務、Solopreneur OS の 4 層分類 | business-os の中核部分 |

- **経営基盤 Skill（10 個）は全て自作**する。他人のコードを抱えると、セルフチェック（20260929-06）の
  対象外になり、静かな故障の温床になる
- **gstack は参考のみで fork しない**。ソフトウェア開発のスプリント用であり、経営運用用の business-os と重なる部分が少ない。
  fork のメンテコストに見合わない
- 第三者 Skill を入れる前に `gh skill preview` で中身を確認し、`--pin` でバージョンを固定する。
  監査された第三者 Skill の 36% に prompt injection が含まれていたという調査結果があるため、省略しない

## 根拠

- gstack のレビュー結論そのまま。MIT ライセンスは「fork して改変してよい」ためにある
- business-os の中核を自作にするのは、コードの全行を把握し、fail-closed テストの対象にするため
- 「参考にして自作」は、先行事例の**設計思想**（承認パイプライン、raw と wiki の分離、4 周期のレビュー）は
  借りつつ、**実装**は自分の環境と最新の CC 仕様に合わせるという分業
- 検討した代替案：gstack を fork して経営用に改造 → 35 コマンド中の大半を削る作業と、
  upstream 更新の追従で二重に手間。不採用

## 影響

- business-os の依存は「公式 Plugin」だけ。第三者 Plugin への依存を持たない
- `kepano/obsidian-skills` は Obsidian アダプタの導入手順で「任意」として案内する
- 先行事例の設計思想を借りた箇所は、各 Skill の SKILL.md か ADR に出典を残す

## 参考

- The Claude Codex「Garry Tan's gstack: a critical review after one month of use」（2026-05）
- Snyk「ToxicSkills」（2026-02）：第三者 Skill の 36% に prompt injection
- GitHub `gh skill`（2026-04）：preview / pin
- 関連 ADR：20260929-07（Skill）、20260929-10（Plugin）
