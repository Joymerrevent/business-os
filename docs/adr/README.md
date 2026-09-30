---
type: knowledge
business: n/a
status: active
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
---

# ADR（設計判断記録）の運用ルール

このフォルダには business-os（器）の設計判断を記録する。
「なぜそう決めたか」を、決めた当時の文脈ごと残すのが目的。

## ID とファイル名

```text
YYYYMMDD-nn-<slug>.md
```

- `YYYYMMDD`：起票日（判断を議論し始めた日）
- `nn`：同日内の連番（01 から）
- `<slug>`：英語の短い名前（kebab-case）

連番を全体で通さないのは、CC と人間、あるいは複数セッションが同日に起票しても
衝突しないようにするため。日付が名前に入るので、鮮度もファイル名から読める。

## status の遷移

```text
proposed → accepted
         → rejected
accepted → superseded（新しい ADR に置き換えられた）
```

**個人や AI が単独で `accepted` にしない。** 起票は誰でも（CC を含む）できるが、
`accepted` への変更はメンテナ（この器では JJ）が内容を確認して行う。
CC が「accepted に変えてよいか」と聞くのは構わない。勝手に変えるのは禁止。

## フロントマター

全 ADR に以下を持つ。日付は `YYYY-MM-DD`、該当しない欄は `n/a`。

```yaml
---
id: 20260929-01
title: シェル非依存
type: decision
business: n/a
status: proposed
created: 2026-09-30   # ファイルを書いた日
updated: 2026-09-30   # 最後に内容を変えた日
as_of: n/a            # 数値・事実の基準日（ADR は通常 n/a）
verified: n/a         # 人間が「まだ正しい」と確認した日
supersedes: n/a       # 置き換える ADR の id（あれば）
---
```

起票日（ID の日付）とファイル作成日（`created`）は一致しなくてよい。
議論した日と書き起こした日がずれることは普通にある。

## 本文の構成

1. **背景**：何が問題で、なぜ今決めるのか
2. **決定**：何を決めたか。箇条書きで具体的に
3. **根拠**：なぜその選択か。検討した他の選択肢と、捨てた理由
4. **影響**：この決定で何が変わるか。守るべき制約、増えるコスト
5. **参考**：出典、関連 ADR、外部リンク

## 利用者向け文書との関係

`docs/usage/` の文書には ADR の番号を書かない（利用者には意味を持たない）。
根拠を示したいときは HTML コメントで `<!-- 根拠: 20260929-05 -->` のように残す。

## 一覧

| id | title | status |
|---|---|---|
| 20260929-01 | シェル非依存 | proposed |
| 20260929-02 | CLAUDE.md は地図 | proposed |
| 20260929-03 | 憲章と育つ文書の分離 | proposed |
| 20260929-04 | 器は事業非依存、/onboard で注入 | proposed |
| 20260929-05 | ステージングと承認、四重防衛 | proposed |
| 20260929-06 | 起動時セルフチェック | proposed |
| 20260929-07 | 経営基盤 Skill は最初から、業務 Skill は育てる | proposed |
| 20260929-08 | 既製フレームワークは参考にし、fork しない | proposed |
| 20260929-09 | 記憶は腐る前提で組む | proposed |
| 20260929-10 | 最初から公開 Plugin | proposed |
| 20260930-01 | Bash の文字列規則は粗い網 | proposed |
