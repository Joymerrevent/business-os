---
id: 20260929-10
title: 最初から公開 Plugin
type: decision
business: n/a
status: proposed
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
supersedes: n/a
---

# 20260929-10: 最初から公開 Plugin

## 背景

business-os は自分で使いながら育て、友人にも試してもらい、完成度が上がったら広く配りたい。
CC の拡張機能の配り方は、2026 年 6〜9 月で **Plugin が正式な主経路**になった。
ディレクトリ提出ポータル、自動検証、レビュー状態、公開制御、公開後のアナリティクスが揃っている。

2026 年 5 月版の business-os は「Plugin 配布はテンプレートコピーに勝る」を原則に持っていたが、
Plugin 化は後回しにしていた。今回は最初から Plugin にする。

## 決定

1. business-os は **最初から公開 Plugin として作る**。ライセンスは MIT
2. バージョン `0.1.0` から始め、`0.x` の間は「開発中」を明示する
   - README 冒頭に `Status: Alpha (0.x)` と「仕様変更あり、本番利用は自己責任」
   - `plugin.json` の description に `(alpha)` を含める
   - GitHub Releases は 1.0 まで pre-release
3. 変更履歴は changesets で管理する。`/retro` の改善提案が `/approve` で承認されたら、
   `/release`（開発専用 Skill）が changeset → version → `plugin.json` 同期 → `CHANGELOG.md` → git tag を行う
4. business-os と事業データは **リポを分ける**。`business-os`（公開 Plugin）には事業情報・認証情報を一切含めない。
   事業データは各利用者の `company` リポ（非公開）に置く
5. 公開に伴う衛生を初日から入れる
   - gitleaks を pre-commit で実行、GitHub の Secret Scanning と Push Protection を有効化
   - `check:leak` で事業名・固有名詞の混入を検査
   - `SECURITY.md` に非公開の報告経路、`CODE_OF_CONDUCT.md`、`CONTRIBUTING.md`
   - Issues は公開、PR 作成はコラボレーター限定（porters-connect と同じ）
6. 友人が試すための導線を README に置く：`/plugin marketplace add` → `/plugin install` → `/onboard`
7. business-os の Plugin は **ユーザースコープ**でインストールする。プロジェクトスコープの Plugin には
   2026-03 時点でバグ報告があるため
8. `1.0` で公式ディレクトリへの提出を検討する

## 根拠

- Plugin にすると 1 コマンドで導入でき、business-os を改善したとき使っている人全員に更新が届く。
  テンプレートコピーでは更新が届かない
- 最初から公開すると、友人の環境（特に Windows）で動くかが早く分かり、
  「事業情報を business-os に混ぜない」規律（20260929-04）が構造で強制される
- 改良の履歴（CHANGELOG）を残したいという要求は、changesets と `/release` で自動化できる
- リポ分離は 20260929-03 / 04 が既に要求しており、Plugin 化の追加コストは小さい
- 検討した代替案：非公開で育てて後から公開 → 公開時に混入の洗い出しが必要になり、
  友人のフィードバックが遅れる。不採用

## 影響

- business-os のリポの構成は porters-connect の衛生（`pnpm check` の `check:*` 束ね、CI、changesets、ADR、
  4 層の docs）を継承する
- 日常で CC を起動するのは `company` 側。business-os のリポで起動するのは business-os を改良するときだけ。
  CC の auto memory は `company` 側に溜まり、business-os のリポには入らない
- business-os の CLAUDE.md は開発ガイドであり、友人向けの貢献ガイドにもなる
- business-os のバージョンを `company` に記録し、軽い点検で一致を確認する（20260929-06）

## 参考

- Claude Code changelog（2026-09）：Plugins を第三者拡張の主経路として正式化
- Joymerrevent/porters-connect：公開 OSS の衛生（changesets、check:*、SECURITY.md、ADR）
- 関連 ADR：20260929-04（事業非依存）、20260929-08（外部リソース）
