# KICKOFF — business-os の実装開始

この文書は Claude Code（CC）への引き渡し文書。business-os リポジトリで CC を起動し、
この文書を最初に読ませて実装を始める。

## 前提

- `business-os` リポジトリは作成済み（公開、MIT、`develop` / `main` ブランチ）
- このリポジトリの `docs/adr/`、`docs/design/architecture.md`、`docs/usage/`、`CLAUDE.md`、
  `templates/CLAUDE.md.tmpl` は配置済み（本文書と同時に渡されたもの）
- Node 24、pnpm、gh CLI が使える
- 実装者は CC。設計判断者はメンテナ（JJ）

## 読む順序

1. `CLAUDE.md`（開発ガイド。絶対ルール 6 つ）
2. `docs/adr/README.md`（ADR の運用ルールと一覧）
3. `docs/adr/*.md` 11 本（設計原則。全て status: proposed）
4. `docs/design/architecture.md`（構造仕様。第 11 節「実装時の検証項目」を特に）
5. `docs/usage/`（利用者に何を約束しているか）

読み終えたら「読了。設計に不明点は N 件」と一言返し、不明点があれば列挙する。

## 進め方

**各フェーズの前に、作成予定のファイル一覧を提示してメンテナの承認を待つ。承認なしに作らない。**
これは器自身の原則（提案 → 承認）を、器の実装にも適用するもの。

### Phase 0：検証

`architecture.md` 第 11 節の 9 項目を、実装を始める前に確認する。

- 各項目について、確認方法・結果・設計への影響を報告する
- 設計と食い違いがあれば、実装を変える前に報告する。ADR に反する変更は起票が要る
- 結果は `docs/design/architecture.md` の第 11 節に「確認日と結果」として追記する
  （これは設計文書の更新なのでメンテナの承認を取る）

### Phase 1：リポジトリの衛生

porters-connect と同じ流儀で揃える。

- `package.json`（`check:*` の骨格、`check` がパターンで束ねる）、`.node-version`、`tsconfig.json`
  （`erasableSyntaxOnly`）、`.editorconfig`、`.gitignore`、`.gitattributes`（LF）、`.gitleaks.toml`
- `.markdownlint-cli2.jsonc`、`.prettierrc.json`、`eslint.config.mjs`、`commitlint.config.js`、
  `lint-staged.config.mjs`、Node 製のフック管理
- `README.md`（Status: Alpha を冒頭に。最短で動かすまで）、`CHANGELOG.md`、`CONTRIBUTING.md`、
  `SECURITY.md`、`CODE_OF_CONDUCT.md`、`LICENSE`
- `.changeset/` の初期化
- `.claude-plugin/plugin.json`（version 0.1.0、description に alpha）
- `.claude/settings.json`（器リポ用：秘密・固有名詞の混入を防ぐ deny / sandbox）

### Phase 2：テンプレートとスキーマ

- `templates/frontmatter.schema.json`（第 9 節）
- `templates/settings.json.tmpl`（第 7.2 節）
- `templates/charter/`、`templates/operations/`、`templates/proposals/_template.md`
- `templates/CLAUDE.md.tmpl` は配置済み。`{{ }}` の変数一覧を `/onboard` の質問項目と対応させる

### Phase 3：hooks とテスト

- `hooks/hooks.json`、`hooks/session-start.ts`（軽い点検 8 項目、厳格モード）、
  `hooks/pre-tool-use.ts`（第 7.3 節の判定）、`hooks/lib/`
- `test/`：hook の fail-closed テストを**先に**書く（合成入力で exit 2 / 0 を検証、例外注入で exit 2）
- `test/fixtures/company/`：検証用の company 相当リポ

### Phase 4：Skills

順序：`/onboard` → `/approve` → `/check` → `/adr` → `/morning` → `/weekly-review` → `/close` →
`/quarterly` → `/retro` → `/validate`。

- 各 SKILL.md は第 6.2 節の順（何をするか / 何を読むか / 何を書くか / 人に何を聞くか / 完了条件）
- `/onboard` の Obsidian 分岐は Phase 6 で有効化する。Phase 4 では「使わない」経路だけ動かす
- 3 つ作るごとに `test/fixtures/company/` で動作確認し、報告する

### Phase 5：検査と CI

- `scripts/check.ts`（重い点検 + `check:*` の共有実装）
- `package.json` の `check:*` を埋める（Skill 存在、hook fail-closed、`claude plugin validate`、
  テンプレート適合、漏洩、文書リンク、ADR 索引、利用者文書への ADR 番号混入）
- `.github/workflows/`：Linux と Windows で `pnpm check` + gitleaks + `pnpm audit --prod --audit-level high`
- `pnpm check` が緑になるまで Phase 6 に進まない

### Phase 6：Obsidian アダプタ

- `adapters/obsidian/`（第 10 節）
- `/onboard` の Obsidian 分岐を有効化。インストールは必ず承認を取る。「使わない」を選んだら
  関連ファイルを一切生成しない

### Phase 7：仕上げ

- `docs/README.md`（開発者向け入口）、`docs/usage/` の見直し（実装と食い違う記述の修正）
- `.claude/skills/release/SKILL.md`（開発専用）
- changeset を書き、`/release` で `0.1.0` を切る（pre-release）
- メンテナが ADR 11 本を `accepted` に変える（**CC は変えない**）

## 制約

- 器に固有名詞（事業名、人名、金額）を一切書かない。サンプル値も「事業 A」「CEO」など汎用語で
- bash スクリプトを追加しない。TypeScript を Node 24 が直接実行する
- シンボリックリンクを使わない
- ADR に反する実装をしない。反する必要があるなら、実装せずに ADR を `proposed` で起票して報告する
- ADR の `accepted` への変更は行わない
- 検査の一覧を文書に書かない。`package.json` が正典
- 成否は終了コードで判定する。Done の数を数えない
- 標準語の日本語で、簡潔・結論先出しで報告する

## 完了条件

- [ ] `pnpm check` が緑（Linux / Windows の CI 両方）
- [ ] `pnpm test` が緑（hook の fail-closed テストを含む）
- [ ] `claude --plugin-dir .` で読み込み、`test/fixtures/company/` に対して `/onboard` → `/morning` → `/check` が通る
- [ ] `/check` の「防衛の発火」分類が全て pass
- [ ] `test/fixtures/company/` の `CLAUDE.md` が 70 行以内
- [ ] 器リポに固有名詞・秘密が無い（`check:leak` が緑）
- [ ] `0.1.0` の pre-release が切られている
- [ ] Phase 0 の検証結果が `architecture.md` 第 11 節に反映されている

## 報告の形式

各フェーズの終わりに以下を報告する。

```text
Phase N 完了
- 作成: <ファイル一覧>
- 検査: pnpm check <終了コード> / pnpm test <終了コード>
- 設計との差分: <あれば。無ければ「なし」>
- 次のフェーズで承認が要るもの: <ファイル一覧>
```
