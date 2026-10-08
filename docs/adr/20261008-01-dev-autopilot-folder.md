---
id: 20261008-01
title: 自律開発ループ dev-autopilot を開発物のフォルダ dev-autopilot/ に置き、設計判断と文書の規則をそのフォルダに閉じる
type: decision
business: n/a
status: proposed
created: 2026-10-08
updated: 2026-10-08
as_of: 2026-10-08
verified: n/a
supersedes: n/a
---

# 20261008-01: 自律開発ループ dev-autopilot を開発物のフォルダ dev-autopilot/ に置き、設計判断と文書の規則をそのフォルダに閉じる

## 背景と問い

business-os の開発を、Issue を受けた AI が worktree で実装し、別の AI がレビューし、収束したら進行役が `develop` へマージする仕組み（dev-autopilot）で回したい。
要件は dev-autopilot の要件メモ `dev-autopilot/docs/dev-autopilot-requirements.md` にまとめた。2026-10-07〜08 の設計の議論と、別の文脈のレビュー AI 2 体の指摘を反映したものである。

dev-autopilot は business-os の開発にだけ使う道具で、business-os の利用者（company 側）の機能ではない。
また、将来は別のリポジトリ（独立した Plugin）に分離して、ほかの実装リポにも適用する前提で作る。

business-os のリポジトリは、配布物（`.claude-plugin/` `skills/` `agents/` `hooks/` `scripts/` `templates/` `adapters/`）と開発物（`.claude/` `test/` `evals/` `docs/` など）を
[構造仕様の 3.1 節](../design/architecture.md#31-配布物と開発物)で分け、開発専用の Skill は `.claude/skills/` に置くと決めている。
文書は `docs/adr/`（ADR）と `docs/design/`（構造仕様）が正典で、Markdown のリンクは inline 形式、bash スクリプトは足さない（CLAUDE.md の絶対ルール 2・3）。
inline 形式の規則は 2026-09-30 の PR #2 で入り、理由は記録されていない。同じ日に決めた構造仕様 9 節「リンクは標準 Markdown、`[[wikilink]]` は使わない」と
Obsidian アダプタの `useMarkdownLinks: true` から、company の文書を Obsidian で開いたときにリンクの追従（バックリンク・改名時の書き換え）が効く形に合わせたものと判断する。
Obsidian の公式ヘルプが内部リンクとして挙げる書式は Wikilink と Markdown リンクの 2 つだけで、参照スタイルは挙げられていない（2026-10-09 に確認）。

dev-autopilot をこのリポジトリのどこに置き、既存の規則（置き場所・文書の形式・検査）をどこまで適用するかを決める。
dev-autopilot の中身の設計判断（進行役の形、信頼の境界、鍵と隔離、レビューの判定、マージの条件など）は、この ADR では決めない。

## 判断の基準

- business-os の配布物に、dev-autopilot の Skill・agent・hook を混ぜない（利用者の CC で動くものに影響しない）
- 分離するときに、フォルダごと移せば済む（写しや supersede の作業が要らない）
- 分離後も dev-autopilot が単独で成り立つ規則（ADR の形式、Markdown の規約、検査）を持つ
- business-os の `pnpm check` を 1 回回せば dev-autopilot の検査も走る（壊れたまま `develop` に入らない）。ただし business-os の検査の設定（tsconfig・vitest）に dev-autopilot の項目を足さない
- CLAUDE.md の絶対ルールに例外を作るときは、範囲を 1 つのフォルダに限り、ADR に理由を残す

## 検討した案

- 案 A：開発物のフォルダ `dev-autopilot/` を 1 つ足し、そのフォルダに閉じる。文書と ADR の規則と検査をそのフォルダの中で独立させ、business-os の `pnpm check` は dev-autopilot の検査を呼ぶだけにする
- 案 B：既存の置き場に分散する。Skill は `.claude/skills/`、進行役は `scripts/`、テストは `test/`、文書は `docs/adr/` と `docs/design/`
- 案 C：最初から別のリポジトリにし、business-os には設定ファイルだけを置く

## 決定

採用：**案 A**。分離を見越した要件（要件メモの 10 節）を満たしつつ、business-os の `pnpm check` 1 回で dev-autopilot も検査される網を外さずに済むため。

この ADR が決めるのは、business-os が `dev-autopilot/` をどう扱うかだけである。`dev-autopilot/` の中の構成・文書の規則・検査の中身は dev-autopilot 側の ADR（`dev-autopilot/docs/adr/`）が決め、ここには書かない。

1. **置き場所**：リポジトリ直下に開発物のフォルダ `dev-autopilot/` を 1 つ足す。business-os の `.claude-plugin/plugin.json` が指す配布物（`skills/` `agents/` `hooks/`）には入れない。
   business-os の中身を `dev-autopilot/` から import せず、逆もしない
2. **配布の扱い**：business-os の marketplace は `source: "./"` でリポジトリ全体を配るので、`dev-autopilot/` も `test/` `evals/` と同じく利用者に配られる。これを受け入れる。
   そのため `dev-autopilot/` にも業務の固有名詞・秘密を置かず、`check:leak` の対象に含める。配布物を絞る再構成は別の ADR（20261009-02）で決める
3. **文書と ADR の規則を適用しない**：dev-autopilot の設計判断・構造仕様・使い方は `dev-autopilot/docs/` に置き、business-os の `docs/` には書かない。
   business-os の `docs/adr/README.md` の規則（ファイル名、フロントマターの 4 日付欄、本文の構成）と、`docs/` を見る検査（`check:adr` `check:docs` `check:usage`）は `dev-autopilot/` に適用しない。
   dev-autopilot の文書の規則は dev-autopilot 側が持つ
4. **CLAUDE.md の絶対ルールの例外**：`dev-autopilot/` の中に限り、絶対ルール 3 のうち「Markdown のリンクは inline 形式」を適用しない。
   絶対ルール 2（bash を足さない、TypeScript を Node 24 で直接実行）と、シンボリックリンク禁止・相対パス・LF は `dev-autopilot/` にも適用する。
   この例外は、accepted の後に CLAUDE.md の絶対ルール 3 に 1 行で書く
5. **検査は呼ぶだけ**：business-os の `package.json` に `check:dev-autopilot`（`pnpm --filter dev-autopilot check`）を 1 つ足し、`pnpm check` が正典という規則と CI は変えない。
   dev-autopilot を pnpm の workspace のパッケージにし、型検査・vitest・Markdown の検査は dev-autopilot 自身の `check` が回す。business-os の tsconfig と vitest の include には `dev-autopilot/` を足さない。
   リポジトリ全体の衛生の検査（`check:format` `check:lint` `check:leak` `check:shell` `check:md`）は root のまま `dev-autopilot/` にも効かせる。
   `check:md` のリンクの形式は、`dev-autopilot/` に置く入れ子の markdownlint の設定が決め、root の設定は変えない（markdownlint-cli2 は下位フォルダの設定ファイルをそのフォルダ以下に適用する。2026-10-08 に `pnpm check:md` と pre-commit の両方で確かめた）。
   workspace のパッケージを足すと root のロックファイルが変わるが、依存は root と共有するので増えない
6. **構造仕様と地図の更新**：accepted の後、[構造仕様の 3.1 節](../design/architecture.md#31-配布物と開発物)の開発物の列に `dev-autopilot/` を足し、「文書と ADR の規則はフォルダの中の規則に従う」と 1 行書く。
   CLAUDE.md の「何がどこにあるか」にも `dev-autopilot/` の 1 行を足し、「設計判断は `dev-autopilot/docs/adr/` が正典で、絶対ルール 1 はそのフォルダの ADR にも及ぶ」と書く（絶対ルール 1 の `docs/adr/` だけでは `dev-autopilot/docs/adr/` を覆わないため）
7. **分離**：別のリポジトリへ分離する時期と方法は dev-autopilot 側が決める。分離したら、business-os 側は `dev-autopilot/` と `check:dev-autopilot` の 1 行を消し、この ADR を「分離した」ADR で置き換える

## 影響

- 良い影響
  - dev-autopilot の文書・規則・検査がフォルダに閉じ、分離がフォルダの削除と `check:dev-autopilot` の 1 行の削除で済む
  - business-os の配布物と利用者向けの文書に、dev-autopilot の記述が混ざらない
  - business-os の `pnpm check` 1 回で dev-autopilot の検査も走るので、壊れたコードが `develop` に入らない。business-os は検査の中身を持たず、結果だけを見る
- 悪い影響
  - リポジトリの中に文書と検査の規則が 2 組並ぶ。読む人は「`dev-autopilot/` の中か」で規則を使い分ける
  - `dev-autopilot/` も利用者に配られる。配布物の量が増える（テキストのみ）。絞るのは ADR 20261009-02
  - CLAUDE.md の絶対ルール 3 に例外が 1 つ入る
- その他
  - dev-autopilot の ADR の起票 PR は、入れ子の markdownlint の設定を同じ PR に含める。設定が無いと pre-commit と `check:md` が参照スタイルのリンクで止まり、起票そのものができないため。
    起票 PR のマージは、この ADR の accepted の後にする
  - dev-autopilot の中身の設計判断は、`dev-autopilot/docs/adr/` の ADR で決める。business-os 側が持つ dev-autopilot の ADR はこの 1 本だけ

## 案ごとの長所と短所

### 案 A：開発物のフォルダ `dev-autopilot/` に閉じる

- 長所：分離がフォルダの削除と `check:dev-autopilot` の 1 行の削除で済む。配布物に混ざらない。検査の網は残る。business-os は中身を知らなくてよい
- 短所：文書と検査の規則が 2 組並ぶ。`dev-autopilot/` も配布される

### 案 B：既存の置き場に分散する

- 長所：規則が 1 つで済む。既存の検査がすべてそのまま効く
- 短所：分離するときに 5 か所から集め直す。`scripts/` と `test/` は配布物と開発物の境界があいまいになる。`docs/adr/` に dev-autopilot の判断が 9 本並び、business-os の判断と混ざる

### 案 C：最初から別のリポジトリにする

- 長所：規則の衝突が無い。配布物に入らない
- 短所：2 つ目の適用先ができる前に分離すると、固有の値がコードに残っていても気づけない（要件メモの 10 節）。開発の初期に 2 つのリポジトリを行き来する手間が増える

## 参考

- dev-autopilot の要件メモ `dev-autopilot/docs/dev-autopilot-requirements.md` の 10 節「分離を見越した構成」と 12 節の判断 3・5。
  要件メモと dev-autopilot の ADR 008 は markdownlint の例外を root の `ignores` で実現すると書いていたが、決定 5 の入れ子の設定で置き換えた（両方に訂正の注記を足す）
- [構造仕様 3.1 節](../design/architecture.md#31-配布物と開発物)
- 関連 ADR：20260929-01（シェル非依存）、20261002-01（役割エージェントは同梱しない。dev-autopilot の agent は `dev-autopilot/` の中に置き、配布物の `agents/` には入れない）、20261003-06（ADR の形式）、20261003-07（実装リポの開発に要るものは実装リポに置く）
- 2026-10-08 の実機の確認（要件メモの 12 節）：入れ子の Plugin の名札と `--plugin-dir`、sandbox の `denyRead` がシンボリックリンクを解決しない不具合（Issue #80）
