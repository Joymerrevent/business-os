# コントリビュートガイド

business-os への関心をありがとうございます。この文書は、器（business-os）の開発に参加する人向けです。

## 前提

- このリポジトリは公開 Plugin です。**事業名・人名・金額・認証情報を一切書きません。**
  例を書くときは「事業 A」「CEO」などの汎用語を使ってください
- 設計判断は [docs/adr/](docs/adr/README.md) が正典です。ADR に反する変更は、先に ADR を `proposed` で起票して相談してください
- 構造の仕様は [docs/design/architecture.md](docs/design/architecture.md) にあります

## 参加の流れ

このリポジトリは **PR の作成をコラボレーターに限定**しています。

- バグ報告・機能要望・質問 → [Issues](https://github.com/Joymerrevent/business-os/issues) へ。
  **事業データは絶対に貼らないでください**
- コードの変更を提案したい → まず Issue で方針を相談してください

行動の基準は [行動規範](CODE_OF_CONDUCT.md)（Contributor Covenant）に従います。

## 開発環境

- Node.js 24 系（`.node-version`）と pnpm（`package.json` の `packageManager`）を使います。npm は使いません
- bash スクリプトを追加しません。hook と scripts は TypeScript で書き、Node が直接実行します
- シンボリックリンクを使いません。パスは相対、改行は LF です

```sh
pnpm install   # git のフック（pre-commit / commit-msg）も設置される
pnpm check     # 検査の一括実行
```

検査の一覧は `package.json` の `check:*` が正典です。この文書には一覧を書きません。

> **成否は終了コードで見てください。`Done` の数を数えないこと。** `pnpm check` は複数の検査をまとめて走らせ、
> 失敗したものだけ `Failed` と出ます。通った数を数える読み方だと、1 本落ちても見逃します。

pre-commit は gitleaks で秘密を探します。gitleaks が入っていなければ警告してコミットを通します
（CI で必ず検査されます）。手元でも検査するなら `brew install gitleaks` で入れてください。

## コミットと PR

- [Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) に従います（commit-msg フックで検査）。
  subject は小文字か日本語で始めます
- PR は `develop` 向けに作ります
- 利用者に影響する変更には changeset を付けます（`pnpm changeset`）。`CHANGELOG.md` は changesets が作るので、手で編集しません
- 公開済みのコミットの履歴を書き換えません

## ローカルでの動作確認

```sh
claude --plugin-dir .
```

で、このリポジトリを Plugin として読み込めます。
