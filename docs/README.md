# docs — 開発者向けの入口

business-os を改良する人と CC のための地図です。利用者向けの案内は [usage/](usage/getting-started.md) にあります。

## 文書の地図

| 場所 | 中身 | 読む時 |
|---|---|---|
| [adr/](adr/README.md) | 設計判断の記録（ADR）と運用ルール。**設計の正典** | 変更を始める前に、関係する ADR を読む |
| [design/architecture.md](design/architecture.md) | 構造の仕様（配置、防衛、点検、フロントマター、Obsidian）と、実装時の検証の結果（第 11 節） | 触る箇所の節を読む |
| [usage/getting-started.md](usage/getting-started.md) | 利用者向け：導入から最初の 1 週間 | 利用者に見える動きを変えたとき |
| [usage/operations.md](usage/operations.md) | 利用者向け：日々の運用 | 同上 |

ルートの [CLAUDE.md](../CLAUDE.md) が開発ガイド（絶対ルール）、[CONTRIBUTING.md](../CONTRIBUTING.md) が参加の手順です。

## 検査

検査の一覧の正典は [package.json](../package.json) の `check:*` です。この文書には一覧を書きません。
`pnpm check` で全てを走らせ、成否は終了コードで見ます。

- business-os の検査の実装は `scripts/check-repo.ts` と `scripts/lib/repo-checks.ts`
- company の重い点検（`/check`）の実装は `scripts/check.ts` と `scripts/lib/company-checks.ts`、実機の発火試験は `scripts/lib/live-check.ts`
- hook の実装は `hooks/`。外部の依存を持たない（Plugin は利用者側で install されないため）

## 手で確かめるとき

- `claude --plugin-dir .` で、このリポジトリを Plugin として読み込める
- 検証用の company は `test/fixtures/company/`。手で試すときは、`/tmp` などに複製してから使い、フィクスチャを汚さない
- 本物の Claude Code で hook が動くかは、`node scripts/check.ts --company <複製した company> --live` を sandbox の外で実行して確かめる

## 文書の規約

- `docs/adr/` と `docs/design/` の文書に、フロントマター（`type` `business` `status` と 4 つの日付欄）を付ける。`business` は `n/a`
- 利用者向けの `docs/usage/` と、この `docs/README.md` には付けない（GitHub が表として描き、読みにくくなるため）
- `docs/usage/` には ADR の番号を書かない。根拠を残すときは HTML コメント（`<!-- 根拠: … -->`）に書く
- リンクは標準の inline 形式（`[text](path)`）

## リリース

開発専用の Skill `/release`（`.claude/skills/release/`）に従う。changeset → 版上げ → `plugin.json` への同期 → CHANGELOG →
`main` へのリリース PR → タグ `business-os--v<版>` → GitHub の Release（版に `-beta.N` などの接尾辞があるときだけ pre-release）。
