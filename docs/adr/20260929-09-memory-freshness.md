---
id: 20260929-09
title: 記憶は腐る前提で組む
type: decision
business: n/a
status: proposed
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
supersedes: n/a
---

# 20260929-09: 記憶は腐る前提で組む

## 背景

CC のメモも、business-os の文書も、時間が経つと記憶が腐る。腐り方は 3 種類。

- **矛盾**：3 月に「価格は 5,000 円」、6 月に「8,000 円に変更」と書き、両方残る
- **相対日付**：「昨日決めた」「先週から」が、1 ヶ月後に読むと意味が変わる
- **参照切れ**：「詳細は X 参照」と書いた X を消した、名前を変えた

CC 側には対策が入った。auto memory は既定で ON、Auto Dream がセッション間でメモリを統合し、
相対日付を絶対日付に変換し、矛盾した事実や古いメモリを削除する。gstack もセッション横断の
決定メモリと dream ステージキャッシュを追加した。「記憶は統合しないと腐る」は業界の共通認識。

CC ネイティブ層は自動で統合される。business-os が面倒を見るべきなのは、**人間が読む文書側**。

## 決定

### ルール 1：日付は絶対日付のみ

「昨日」「先週」を禁止。CC が書くときは `YYYY-MM-DD` 形式。Skill のテンプレートで担保する。

### ルール 2：全文書に 4 つの日付欄を必須にする

```yaml
---
created: 2026-10-05    # 作成日：このファイルを書いた日
updated: 2026-10-08    # 更新日：最後に内容を変えた日
as_of: 2026-09-30      # データ基準日：中身の数字・事実がいつ時点か
verified: 2026-10-05   # 最終確認日：人間が「まだ正しい」と確認した日
---
```

- 4 欄は**省略しない**。該当しない場合は `n/a` と書く。省略を許すと「忘れた」と「該当なし」が区別できない
- 値は `YYYY-MM-DD` か `n/a` のどちらか。欄の欠落・相対日付・空欄は `/check` がエラーにする
- `as_of` は数値を扱う文書（`/close` `/quarterly` の出力）で必須。他は `n/a` 可
- `verified` は憲章（`charter/`）で必須。他は `n/a` 可

### ルール 3：鮮度期限

| 対象 | 期限 | 超えたら |
|---|---|---|
| `charter/*` の `verified` | 90 日 | `/quarterly` が「まだ正しいか」を人間に確認 |
| `operations/state/*` の `updated` | 14 日 | `/check` が warn |
| `decisions/` の `status: proposed` | 30 日 | `/check` が warn |
| `proposals/` の `status: approving` | 24 時間 | 軽い点検と `/check` が検出 |

期限は初期値。事業の変化速度に応じて `/retro` で調整する。

### ルール 4：古い情報で黙って判断しない（鮮度ゲート）

CC が意思決定に関わる情報を読むとき、最終更新が期限より古ければ「この情報は X 日前のものです」と
明示してから使う。承認時に「根拠の鮮度」が見えるよう、提案には参照した文書の `as_of` / `updated` を添える。

### ルール 5：CC の Auto Dream を ON にする

CC 自身のメモは CC に統合させる。business-os 側で二重管理しない。

### 統一フロントマター

4 日付欄に加え、フォルダ横断で扱うための項目を持つ。

```yaml
type: charter | proposal | decision | daily | review | state | ledger | knowledge | inbox
business: portfolio | <事業ID> | n/a   # n/a は business-os の文書のみ
status: <文書種別ごとに定義>
```

定義は business-os の `templates/frontmatter.schema.json` に置き、`/check` が検証する。
台帳（期限・義務、リスク）は `type: ledger`。business-os の ADR も同じスキーマで `type: decision` とする。
雛形の置き場（business-os の `templates/`、company の `docs/_templates/`）は検査の対象外。
雛形は `{{ }}` などの置き換え記号を含み、書き出された後の文書が検査を受けるため。

## 根拠

- 「省略可」を「n/a 必須」に変えたのは利用者の指摘による。欄が常にあれば、欠落＝書き忘れと断定できる
- 3 種の日付（作成・更新・基準日）は月次締めのような文書で必ずずれる（10 月に 9 月末の数字をまとめる）。
  区別しないと後で必ず混乱する
- 「エージェントが判断し、スクリプトが検証する」分担は先行事例（eferro のフロントマター検証）と同じ
- 検討した代替案：日付管理を Obsidian 等のツールに任せる → ツール非依存の原則（20260929-10 の Markdown 中核）に反する。不採用

## 影響

- 全 Skill のテンプレートに 4 日付欄が入る。`as_of` は Skill が「いつ時点のデータか」を CC に問わせる
- `/check` に日付欄の検査が入る（20260929-06）
- Obsidian の Bases は 4 日付欄と `type` `business` `status` だけを前提に作る（鮮度ダッシュボード等）
- ADR / decisions / proposals の ID も日付ベース（`YYYYMMDD-nn`）で、鮮度をファイル名から読める

## 参考

- Claude Code auto memory / Auto Dream（2026）
- gstack v1.57.x：cross-session decision memory、dream-stage caching
- 関連 ADR：20260929-03（フォルダ）、20260929-06（検査）
