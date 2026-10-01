---
id: 20260929-02
title: CLAUDE.md は地図
type: decision
business: n/a
status: proposed
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
supersedes: n/a
---

# 20260929-02: CLAUDE.md は地図

## 背景

`CLAUDE.md` は CC がセッション開始のたびに必ず読むファイル。ここに手順や事実を
書き込み続けると、毎セッションの読み込みコストが増え、重要なルールが埋もれて
CC が見落とす。2026 年 9 月時点で CC は 1M トークンのコンテキストを持つが、
「入る」ことと「正しく従う」ことは別で、短い地図の方が精度が出る。

CC 側にも `/doctor prompt-audit` が追加され、古いパス・古いコマンド・矛盾する
指示ファイルを検出できるようになった。地図が短ければ監査も通りやすい。

## 決定

1. ルートの `CLAUDE.md` は **地図**に限定する。書くのは 3 種のみ
   - 自分は何者か（会社の一行説明）
   - 何がどこにあるか（フォルダの案内と、誰が書く場所か）
   - 絶対に守るルール（3〜5 個）
2. 目安 40 行、上限 70 行。70 行を超えたら週次点検（`/check`）が warn を出す
3. **手順は Skills に、事実は `docs/` に**書く。CLAUDE.md には書かない
4. 階層 CLAUDE.md（サブフォルダごと）は、そのフォルダで作業するときだけ必要な指示がある場合に限る
5. 検査項目の一覧など「写すと古くなるもの」は CLAUDE.md に書かず、正典（`package.json` 等）を指す
6. `/doctor prompt-audit` を週次点検に含め、地図の腐敗を検出する

## 根拠

- 先行事例（Team OS、Company OS starter kit 等）は一貫して「ルート CLAUDE.md は短いナビゲーション、
  詳細は Skill と参照文書へ」に収束している
- 2026 年 5 月版の business-os はルート 57 行で、この原則に沿っていた。維持する
- Anthropic が `/doctor prompt-audit` を出したことは、指示ファイルがモデル世代交代で
  陳腐化する問題を公式に認めたことを意味する。短く保つほど監査しやすい
- 検討した代替案：CLAUDE.md に全て書く → 読み込みコストと見落としの両方で不利。不採用

## 影響

- Skill の数が増えても CLAUDE.md は増えない。Skill 一覧は CC が Plugin から自動で認識する
- 事業情報は `docs/charter/` に置く（20260929-03、20260929-04）。CLAUDE.md には固有名詞を書かない
- CLAUDE.md の行数は `check:*` の対象。超過は「地図に手順を書き始めた」兆候として扱う

## 参考

- Claude Code `/doctor prompt-audit`（2026-09）
- Hannah Stulberg「Team OS」：ルート CLAUDE.md を 500 トークン以下に保つ運用
- Workflowsio/company-os-starter-kit：CLAUDE.md を「全てを指し示す 1 ファイル」と定義
- 関連 ADR：20260929-03（憲章と育つ文書）、20260929-07（Skill）
