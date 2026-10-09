---
id: 20261009-01
title: business-os の Markdown のリンクは inline のままにし、dev-autopilot/ だけを規則の対象外にする
type: decision
business: n/a
status: accepted
created: 2026-10-09
updated: 2026-10-09
as_of: 2026-10-09
verified: 2026-10-09
supersedes: n/a
---

# 20261009-01: business-os の Markdown のリンクは inline のままにし、dev-autopilot/ だけを規則の対象外にする

## 背景と問い

CLAUDE.md の絶対ルール 3 は「Markdown のリンクは標準の inline 形式（`[text](path)`）。利用者個人の全体ルールよりこのリポの規約を優先する」と定め、
`.markdownlint-cli2.jsonc` の MD054 がリポジトリ全体に inline を強制している。規則は 2026-09-30 の PR #2 で入り、理由は記録されていない。

同じ日に決めた[構造仕様の 9 節](../design/architecture.md#9-フロントマター規約)「リンクは標準 Markdown、`[[wikilink]]` は使わない」と、
Obsidian アダプタの `useMarkdownLinks: true`（`adapters/obsidian/vault/app.json`）から、inline の規則は company の文書を Obsidian で開いたときに
リンクの追従（バックリンク、改名時の書き換え）が効く形に合わせたものと判断する。Obsidian の公式ヘルプが内部リンクとして挙げる書式は Wikilink と Markdown リンクの 2 つだけで、
参照スタイル（`[text][label]` と末尾の `[label]: path`）は挙げられていない（2026-10-09 に確認）。

一方で、business-os 自身の文書（`docs/` の ADR と構造仕様、README、CONTRIBUTING）は Obsidian で開く想定が無く、GitHub と Claude Code が読む。
メンテナの個人設定（`~/.claude`）は参照スタイルを標準にしており（差分が小さく、リンク先を一箇所で管理できる）、
`dev-autopilot/` は ADR 20261008-01 で規則の対象外とした（中の書式は dev-autopilot 側が決める）。
リポジトリの中に 2 つの書き方が「フォルダごとの例外」として並び始めている。

inline が要るのは Obsidian が開く文書だけである。business-os 自身の文書まで inline に縛る理由は無い。
どの文書を inline に保ち、どの文書を参照スタイルにするかを、Obsidian が開くかどうかで決め直す。

## 判断の基準

- company の文書で Obsidian のリンク追従が効くこと（利用者の運用を壊さない）
- business-os 自身の文書は、メンテナの個人設定と同じ書き方で書けること（例外を覚えなくてよい）
- 規則は「どの文書が company に入るか」という 1 つの基準で決まり、フォルダごとの例外を増やさないこと
- 検査（markdownlint と `check:docs` のリンク検査）が両方の書式を正しく扱うこと
- 置き換えの量が小さく、1 回の実装 PR で終わること

## 検討した案

- 案 A：company に展開される `templates/` と、Skill が company に書く文書の規約だけ inline を保ち、それ以外（business-os 自身の文書）は参照スタイルを標準にする
- 案 B：現状のまま。全体を inline にし、`dev-autopilot/` だけを規則の対象外にする
- 案 C：全体を参照スタイルにする（company の文書も含む）

## 決定

採用：**案 B**。inline が要る範囲（company に入る文書）と要らない範囲を分けることはできるが、分けると規則が 2 つ並び、
とくに Skill が company に書く文書の書式を規約の文だけで守ることになる（company 側の点検は inline のリンクだけを見るので、参照スタイルで書かれても静かに通る）。
置き換え 42 か所と `check:docs` の拡張という 1 回の手間と、以後ずっと続く書き分けの注意を、参照スタイルの利点（差分の小ささ、リンク先の一元管理）が上回らないと判断した。

1. **規則は変えない**：business-os の Markdown のリンクは inline 形式のまま（CLAUDE.md の絶対ルール 3、`.markdownlint-cli2.jsonc` の MD054）。
   理由を規則に添える：company の文書を Obsidian で開いたときにリンクの追従（バックリンク、改名時の書き換え）が効く形で、business-os 自身の文書もそれに揃える
2. **規則の対象外は `dev-autopilot/` だけ**：[ADR 20261008-01](20261008-01-dev-autopilot-folder.md) の決定 4 のとおり、`dev-autopilot/` にはこの規則を適用しない。
   `dev-autopilot/` の中の書式は dev-autopilot 側の ADR が決め、この ADR では触れない。対象外のフォルダを増やすときは、同じ基準（Obsidian で開かない、分離を前提にする）で ADR を起票する
3. **CLAUDE.md の文言**：accepted の後、絶対ルール 3 の「利用者個人の全体ルールよりこのリポの規約を優先する」に理由を 1 文足す：「company の文書を Obsidian で開いたときにリンクが追従する形に揃えるため」。
   同じ PR で ADR 20261008-01 の決定 4（`dev-autopilot/` は規則の対象外）の 1 行も足す
4. **Skill の規約**：`templates/skill-conventions.md` に「company の文書のリンクは inline（Obsidian が内部リンクとして追従する形）」と明記する。規則は変えないが、理由が文書に無い状態を直す

## 影響

- 良い影響
  - 規則が 1 つのまま（対象外は `dev-autopilot/` だけ）。Skill が company に書く文書の書式を、SKILL.md 自身の書き方と同じに保てる
  - 置き換えも検査の拡張も要らない。CLAUDE.md と規約への理由の追記だけで済む
- 悪い影響
  - business-os 自身の文書は、メンテナの個人設定（参照スタイル）と違う書き方のまま。business-os を編集するときだけ inline で書く
  - リンク先の変更は本文の各所を直す（参照スタイルの一元管理の利点は得られない）
- その他
  - inline の規則の理由（Obsidian のリンク追従）が、この ADR と CLAUDE.md に残る。2026-09-30 の PR #2 には理由が無かった
  - 案 A に戻すときは、この ADR を置き換える新しい ADR を起票する

## 案ごとの長所と短所

### 案 A：`templates/` と company に書く文書だけ inline、それ以外は参照スタイル

- 長所：inline が要る範囲だけを inline にする。メンテナの個人設定と一致する。例外の基準が 1 つ
- 短所：置き換えと検査の拡張が要る。2 つの書式が並ぶ

### 案 B：現状のまま（全体を inline、`dev-autopilot/` だけ対象外）

- 長所：変更が無い。検査もそのまま
- 短所：Obsidian が開かない文書まで inline に縛る（理由は「company の文書と揃える」）。メンテナの個人設定とは違う書き方になる。例外を増やすときは ADR で基準を示す

### 案 C：全体を参照スタイル

- 長所：書式が 1 つになる
- 短所：company の文書で Obsidian のリンク追従が効かなくなる恐れがある（公式ヘルプは参照スタイルを内部リンクに挙げていない）。利用者の運用を壊しうるので採らない

## 参考

- CLAUDE.md の絶対ルール 3（PR #2、2026-09-30）
- [構造仕様 9 節](../design/architecture.md#9-フロントマター規約)、[10 節](../design/architecture.md#10-obsidian-アダプタ)（Obsidian アダプタ）
- [ADR 20261008-01](20261008-01-dev-autopilot-folder.md)（`dev-autopilot/` を規則の対象外にした決定 4）
- Obsidian の公式ヘルプ「Internal links」（内部リンクの書式は Wikilink と Markdown リンク）
- メンテナの個人設定の規約：参照スタイル、強制するプロジェクトは MD054 の `inline: false`
