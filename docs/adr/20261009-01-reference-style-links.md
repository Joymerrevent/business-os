---
id: 20261009-01
title: business-os 自身の文書は参照スタイルのリンクを標準にし、company に展開される雛形と Skill が company に書く文書だけ inline を保つ
type: decision
business: n/a
status: proposed
created: 2026-10-09
updated: 2026-10-09
as_of: 2026-10-09
verified: n/a
supersedes: n/a
---

# 20261009-01: business-os 自身の文書は参照スタイルのリンクを標準にし、company に展開される雛形と Skill が company に書く文書だけ inline を保つ

## 背景と問い

CLAUDE.md の絶対ルール 3 は「Markdown のリンクは標準の inline 形式（`[text](path)`）。利用者個人の全体ルールよりこのリポの規約を優先する」と定め、
`.markdownlint-cli2.jsonc` の MD054 がリポジトリ全体に inline を強制している。規則は 2026-09-30 の PR #2 で入り、理由は記録されていない。

同じ日に決めた[構造仕様の 9 節](../design/architecture.md#9-フロントマター規約)「リンクは標準 Markdown、`[[wikilink]]` は使わない」と、
Obsidian アダプタの `useMarkdownLinks: true`（`adapters/obsidian/vault/app.json`）から、inline の規則は company の文書を Obsidian で開いたときに
リンクの追従（バックリンク、改名時の書き換え）が効く形に合わせたものと判断する。Obsidian の公式ヘルプが内部リンクとして挙げる書式は Wikilink と Markdown リンクの 2 つだけで、
参照スタイル（`[text][label]` と末尾の `[label]: path`）は挙げられていない（2026-10-09 に確認）。

一方で、business-os 自身の文書（`docs/` の ADR と構造仕様、README、CONTRIBUTING、`dev-autopilot/`）は Obsidian で開く想定が無く、GitHub と Claude Code が読む。
メンテナの個人設定（`~/.claude`）は参照スタイルを標準にしており（差分が小さく、リンク先を一箇所で管理できる）、
dev-autopilot の文書は ADR 20261008-01（PR #82、proposed）で `dev-autopilot/` に限り参照スタイルとした。
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
- 案 B：現状のまま。全体を inline にし、`dev-autopilot/` だけ例外にする
- 案 C：全体を参照スタイルにする（company の文書も含む）

## 決定

採用：**案 A**。inline が要る範囲は Obsidian が開く company の文書だけで、その範囲は `templates/` と Skill の書き方の規約で閉じているため。

1. **規則**：Markdown のリンクは参照スタイルを標準にする。本文は `[表示テキスト][ラベル]`、定義はファイル末尾に `[ラベル]: パス` をまとめる。裸の URL は autolink `<https://…>` でよい。
   inline を保つのは次の 2 つだけ
   - `templates/` の下（`/onboard` が company に展開する雛形）
   - Skill が company に書く文書。規約は `templates/skill-conventions.md` に「company の文書のリンクは inline（Obsidian が内部リンクとして追従する形）」と明記する
2. **CLAUDE.md の絶対ルール 3**を次に改める：「シンボリックリンクを使わない。パスは相対、改行は LF。
   Markdown のリンクは参照スタイル（`[text][label]` と末尾の `[label]: path`）。`templates/` と、Skill が company に書く文書だけ inline（Obsidian がリンクとして追従するため）」。
   「利用者個人の全体ルールよりこのリポの規約を優先する」の一文は外す（規約が一致するため）
3. **markdownlint**：root の `.markdownlint-cli2.jsonc` の MD054 を参照スタイル（`full` と `collapsed` を許し `inline` を禁じる）にし、
   `templates/.markdownlint-cli2.jsonc` に inline を強制する入れ子の設定を置く（入れ子の設定が効くことは ADR 20261008-01 の決定 5 で確認済み）。
   `dev-autopilot/.markdownlint-cli2.jsonc` は root と同じ内容になるので消す
4. **リンク検査**：`check:docs`（`scripts/lib/repo-checks.ts`）のリンク検査は inline（`[text](path)`）だけを読んでいる。参照スタイルの定義行（`[label]: path`）も読み、リンク先の存在を確かめるようにする。
   company の点検（`scripts/lib/company-checks.ts`）は company の文書が対象で inline のままなので変えない
5. **既存の文書の置き換え**：inline のリンクは `templates/` を除いてリポジトリ全体で 42 か所（2026-10-09 時点。`docs/` 配下は 14 か所）。実装の PR で機械的に参照スタイルへ置き換える。
   置き換えは accepted の後、ADR と構造仕様の本文を含めて行う（accepted の ADR の本文を書き換えるのではなく、リンクの書式だけを変える。決定の内容は変えない）
6. **構造仕様**：[9 節](../design/architecture.md#9-フロントマター規約)の「リンクは標準 Markdown」は company の文書の規約として残し、「business-os 自身の文書は参照スタイル」と 1 行足す
7. **ADR 20261008-01 との関係**：同 ADR の決定 4（`dev-autopilot/` に限り inline を適用しない）は、この ADR が accepted になれば不要になる。
   同 ADR が accepted なら決定 4 を改めた旨の注記を足し、proposed のままなら本文を直す

## 影響

- 良い影響
  - business-os 自身の文書の書き方が、メンテナの個人設定と一致する。フォルダごとの例外（`dev-autopilot/`）が消える
  - リンク先がファイル末尾に集まり、差分が小さくなる。リンク先の変更が 1 行で済む
  - inline を保つ範囲が「company に入る文書」という 1 つの基準で説明できる
- 悪い影響
  - 既存の文書 42 か所の置き換えと、`check:docs` のリンク検査の拡張が要る（1 回の実装 PR）
  - 2 つの書式がリポジトリに並ぶ状態は続く（`templates/` は inline）。読む人は「company に入る文書か」で見分ける
  - `templates/` の中の文書を business-os 側で編集するときだけ inline で書く
- その他
  - 利用者向けの `docs/usage/` も参照スタイルになる。GitHub の表示は変わらない
  - Skill の SKILL.md は Claude Code が読む文書で、どちらの書式でも読める。参照スタイルに揃える

## 案ごとの長所と短所

### 案 A：`templates/` と company に書く文書だけ inline、それ以外は参照スタイル

- 長所：inline が要る範囲だけを inline にする。メンテナの個人設定と一致する。例外の基準が 1 つ
- 短所：置き換えと検査の拡張が要る。2 つの書式が並ぶ

### 案 B：現状のまま（全体を inline、`dev-autopilot/` だけ例外）

- 長所：変更が無い。検査もそのまま
- 短所：Obsidian が開かない文書まで inline に縛る理由を説明できない。`dev-autopilot/` の例外が規則の外に残り、同じ例外が今後も増える

### 案 C：全体を参照スタイル

- 長所：書式が 1 つになる
- 短所：company の文書で Obsidian のリンク追従が効かなくなる恐れがある（公式ヘルプは参照スタイルを内部リンクに挙げていない）。利用者の運用を壊しうるので採らない

## 参考

- CLAUDE.md の絶対ルール 3（PR #2、2026-09-30）
- [構造仕様 9 節](../design/architecture.md#9-フロントマター規約)、[10 節](../design/architecture.md#10-obsidian-アダプタ)（Obsidian アダプタ）
- ADR 20261008-01（PR #82、proposed。`dev-autopilot/` の例外。この ADR で置き換える）
- Obsidian の公式ヘルプ「Internal links」（内部リンクの書式は Wikilink と Markdown リンク）
- メンテナの個人設定の規約：参照スタイル、強制するプロジェクトは MD054 の `inline: false`
