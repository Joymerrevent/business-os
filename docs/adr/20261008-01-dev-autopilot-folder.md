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

dev-autopilot をこのリポジトリのどこに置き、既存の規則（置き場所・文書の形式・検査）をどこまで適用するかを決める。
dev-autopilot の中身の設計判断（進行役の形、信頼の境界、鍵と隔離、レビューの判定、マージの条件など）は、この ADR では決めない。

## 判断の基準

- business-os の配布物に、dev-autopilot の Skill・agent・hook を混ぜない（利用者の CC で動くものに影響しない）
- 分離するときに、フォルダごと移せば済む（写しや supersede の作業が要らない）
- 分離後も dev-autopilot が単独で成り立つ規則（ADR の形式、Markdown の規約、検査）を持つ
- business-os の `pnpm check` が、dev-autopilot の TypeScript の型と vitest を引き続き検査する（壊れたまま `develop` に入らない）
- CLAUDE.md の絶対ルールに例外を作るときは、範囲を 1 つのフォルダに限り、ADR に理由を残す

## 検討した案

- 案 A：開発物のフォルダ `dev-autopilot/` を 1 つ足し、Plugin の形で閉じる。文書と ADR の規則はそのフォルダの中で独立させ、business-os の文書の検査から外す。型と vitest は `pnpm check` が見る
- 案 B：既存の置き場に分散する。Skill は `.claude/skills/`、進行役は `scripts/`、テストは `test/`、文書は `docs/adr/` と `docs/design/`
- 案 C：最初から別のリポジトリにし、business-os には設定ファイルだけを置く

## 決定

採用：**案 A**。分離を見越した要件（要件メモの 10 節）を満たしつつ、business-os の検査の網（型・vitest）を外さずに済むため。

1. **置き場所**：リポジトリ直下に開発物のフォルダ `dev-autopilot/` を 1 つ足す。中身は Plugin の形（`.claude-plugin/` `skills/` `agents/` `src/` `fixtures/` `test/` `docs/` `README.md`）で、
   business-os の `.claude-plugin/plugin.json` が指す配布物（`skills/` `agents/` `hooks/`）には入れない。business-os の中身を `dev-autopilot/` から import せず、逆もしない
2. **配布の扱い**：business-os の marketplace は `source: "./"` でリポジトリ全体を配るので、`dev-autopilot/` も `test/` `evals/` と同じく利用者に配られる。これを受け入れる。
   そのため `dev-autopilot/` にも業務の固有名詞・秘密を置かず、`check:leak` の対象に含める。Plugin の名札が入れ子になることは、2026-10-08 に `tmp/` に作った偽の Plugin（名札・agent 1 体・Skill 1 つ）で、`claude plugin validate` が通り `--plugin-dir` で agent と Skill が名前空間で動くことを確かめた。
   dev-autopilot 自身の名札での確認は、名札を置く実装の PR で行う
3. **文書と ADR の規則**：dev-autopilot の設計判断・構造仕様・使い方は `dev-autopilot/docs/` に置き、business-os の `docs/` には書かない。
   ADR の規則は、分離後も単独で成り立つよう、`dev-autopilot/docs/adr/README.md` に置く別の規則（MADR 4.0.0 の日本語版、`adr-<yyyymmdd>-<nnn>-<title>.md`、参照スタイルのリンク）に従う。
   business-os の `docs/adr/README.md` の規則（`YYYYMMDD-nn-<slug>.md`、4 日付欄、inline リンク）は `dev-autopilot/` に適用しない
4. **CLAUDE.md の絶対ルールの例外**：`dev-autopilot/` の中に限り、絶対ルール 3 のうち「Markdown のリンクは inline 形式」を適用しない（参照スタイルにする）。
   絶対ルール 2（bash を足さない、TypeScript を Node 24 で直接実行）と、シンボリックリンク禁止・相対パス・LF は `dev-autopilot/` にも適用する。
   この例外は、accepted の後に CLAUDE.md の絶対ルール 3 に 1 行で書く
5. **検査は 2 層**：business-os の `pnpm check` は、`dev-autopilot/**/*.ts` の型検査（tsconfig の include）と `dev-autopilot/**/*.test.ts` の vitest（vitest の include）を対象にする。
   `check:md`（markdownlint）は、`dev-autopilot/.markdownlint-cli2.jsonc` に MD054（リンクの形式）の設定を置き、入れ子の設定で `dev-autopilot/` の下だけ参照スタイルを許す
   （markdownlint-cli2 は下位フォルダの設定ファイルをそのフォルダ以下に適用する。root の `ignores` に足す方法より狭く、`dev-autopilot/` の Markdown がほかの規則で検査されなくなることも避けられる。2026-10-08 に `pnpm check:md` と pre-commit の両方で確かめた）。
   `check:adr` `check:docs` `check:usage` は `docs/` だけを見るので変えない。
   `check:shell` `check:leak` `check:format` `check:lint` は `dev-autopilot/` も対象のまま（bash を置かない、秘密を置かない、整形と lint は同じ）
6. **構造仕様と地図の更新**：accepted の後、[構造仕様の 3.1 節](../design/architecture.md#31-配布物と開発物)の開発物の列に `dev-autopilot/` を足し、「文書と ADR の規則はフォルダの中の規則に従う」と 1 行書く。
   CLAUDE.md の「何がどこにあるか」にも `dev-autopilot/` の 1 行を足し、「設計判断は `dev-autopilot/docs/adr/` が正典で、絶対ルール 1 はそのフォルダの ADR にも及ぶ」と書く（絶対ルール 1 の `docs/adr/` だけでは `dev-autopilot/docs/adr/` を覆わないため）
7. **分離の時期**：要件メモの段階 5（進行役のマージ）まで business-os で動かし、設定ファイルの項目だけで別のリポジトリに適用できると確かめてから分離する。分離するときは、この ADR を「分離した」ADR で置き換える

## 影響

- 良い影響
  - dev-autopilot の文書・規則・テストがフォルダに閉じ、分離がフォルダの移動で済む
  - business-os の配布物と利用者向けの文書に、dev-autopilot の記述が混ざらない
  - 型と vitest は `pnpm check` が見続けるので、dev-autopilot の壊れたコードが `develop` に入らない
- 悪い影響
  - リポジトリの中に Markdown と ADR の規則が 2 つ並ぶ。読む人は「どちらのフォルダか」で規則を使い分ける
  - `dev-autopilot/` も利用者に配られる。配布物の量が増える（テキストのみ）。分離後に `source` を絞る案は dev-autopilot 側で扱う
  - markdownlint の設定が 2 つになる（root と `dev-autopilot/` の入れ子）。リンクの形式以外の規則は root の設定が `dev-autopilot/` にも効く
- その他
  - dev-autopilot の ADR の起票 PR は、入れ子の markdownlint の設定（決定 5）を同じ PR に含める。設定が無いと pre-commit と `check:md` が参照スタイルのリンクで止まり、起票そのものができないため。
    起票 PR のマージは、この ADR の accepted の後にする
  - dev-autopilot の中身の設計判断は、`dev-autopilot/docs/adr/` の ADR（adr-20261008-001 〜 009）で決める。business-os 側が持つ dev-autopilot の ADR はこの 1 本だけ

## 案ごとの長所と短所

### 案 A：開発物のフォルダ `dev-autopilot/` に Plugin の形で閉じる

- 長所：分離がフォルダの移動で済む。配布物に混ざらない。型と vitest の検査は残る
- 短所：Markdown と ADR の規則が 2 つ並ぶ。`dev-autopilot/` も配布される

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
- 関連 ADR：20260929-01（シェル非依存）、20261002-01（役割エージェントは同梱しない。dev-autopilot の agent は `dev-autopilot/agents/` に置き、配布物の `agents/` には入れない）、20261003-06（ADR の形式）、20261003-07（実装リポの開発に要るものは実装リポに置く）
- 2026-10-08 の実機の確認（要件メモの 12 節）：入れ子の Plugin の名札と `--plugin-dir`、sandbox の `denyRead` がシンボリックリンクを解決しない不具合（Issue #80）
