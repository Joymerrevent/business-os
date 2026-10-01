<!--
PR のタイトルは Conventional Commits の形で書きます（例：「feat: /morning に期限の色分けを足す」）。
- subject は日本語で始めて構いません。大文字の英単語（固有名詞・Phase など）で始めないでください（commitlint の subject-case で落ちます）
- squash マージでは、このタイトルがそのまま develop のコミットの subject になります
- PR は develop 向けに作ります（main 向けはリリース PR だけ）
- 事業データ（会社名・事業名・人名・金額）や認証情報を、本文にも差分にも含めないでください
-->

## 概要

## 変更

## 検証

- [ ] `pnpm check` が終了コード 0
- [ ] 利用者に影響する変更には changeset を付けた（`pnpm changeset`）
- [ ] 設計（`docs/adr/`）に反していない。反するなら ADR を proposed で起票した
