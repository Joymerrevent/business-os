---
id: 20260929-04
title: 器は事業非依存、/onboard で注入
status: proposed
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
supersedes: n/a
---

# 20260929-04: 器は事業非依存、/onboard で注入

## 背景

器（business-os）は公開 Plugin として配布し、友人にも使ってもらう。
事業名・顧客名・数値が器に混ざっていると、配るときに全部消す作業が要り、
事業を増減するたびに器を触ることになる。

2026 年 5 月版の「固有名詞排除の原則」（汎用ファイルに事業名を書かない）を、
一段押し進めて構造にする。

## 決定

1. 器の全ファイル（Skills、hooks、templates、docs）に **固有名詞を一切書かない**。
   「CEO」「事業」「顧客」などの汎用語だけを使う
2. 事業情報は `/onboard` Skill の **インタビュー**で注入する
   - CC が器の雛形を読み、会社概要・事業一覧・承認範囲・期限や義務・実装リポの場所・
     KPI 候補・Obsidian 使用可否を順に質問する
   - 回答から `company/CLAUDE.md`、`docs/charter/*`、`docs/operations/obligations.md`、
     `.claude/settings.json`、（選択時）`docs/.obsidian/` を生成する
   - 利用者は Markdown を手で書かない。質問に答えるだけ
3. 事業の追加・撤退も `/onboard` を再実行して行う。器は触らない
4. 器リポには `check:leak` を置き、固有名詞と秘密の混入を 2 層で検出する
   - CI と公開：gitleaks と汎用パターン（メール、電話、法人接尾、通貨付き金額、私有ドメイン）。汎用パターンは warn
   - ローカル：`/onboard` が `company/.leak-dict.json`（gitignore）に固有名詞の辞書を書く。
     `check:leak` は環境変数 `BUSINESS_OS_LEAK_DICT` が指す辞書があれば読み、器リポ内を検索する
5. 器と事業データは **リポを分ける**（`business-os` と `company`）。Plugin を更新しても事業データは触られない

## 根拠

- 先行事例が同じ方式に収束している。Workflowsio の starter kit は「CLAUDE.md とリポの全ファイルを
  読み、私の事業についてインタビューし、セクションごとに埋めてくれ」と CC に頼む導入を採用。
  Solopreneur OS も一度のインタビューで事業の輪郭を学び、以後すべての出力前に読む
- 利用者を「設計する側」ではなく「質問に答える側」に置ける。経営判断に集中できる
- 公開リポへの事業情報混入は、構造で防ぐ方が規約で防ぐより確実
- 検討した代替案：テンプレートをコピーして手で埋める → 手作業のミスと、更新の追従不能。不採用

## 影響

- `/onboard` は器の中核 Skill になる。質問項目の設計が器の品質を決める
- 5 事業でも 3 事業でも同じ器で動く。事業数は `charter/businesses/` のファイル数で表現する
- 友人が器を使うとき、その事業情報は友人自身の `company` リポに入る。器の作者には流れない
- 器のバージョンが上がったとき、`/onboard --migrate` で雛形の差分を `company` に反映する経路が要る
  （実装は 0.x の間に整える）

## 参考

- Workflowsio/company-os-starter-kit：インタビュー方式のセットアップ
- Solopreneur OS for Claude（Anfernee Tan）：プロファイル一回インタビュー
- 関連 ADR：20260929-03（フォルダ責務）、20260929-10（Plugin 配布、2 リポ分離）
