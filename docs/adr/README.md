---
type: knowledge
business: n/a
status: active
created: 2026-09-30
updated: 2026-10-03
as_of: n/a
verified: n/a
---

# ADR（設計判断記録）の運用ルール

このフォルダには business-os の設計判断を記録する。
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
`accepted` への変更はメンテナが内容を確認して行う。
CC が「accepted に変えてよいか」と聞くのは構わない。勝手に変えるのは禁止。

## 新しい ADR の作り方

[`_template.md`](_template.md) をコピーし、`YYYYMMDD-nn-<slug>.md` として保存する。
フロントマターは以下の規則に沿って、各節は雛形の説明に沿って書き換える。保存したら、この README の一覧に 1 行足す。

## フロントマター

全 ADR に以下を持つ。日付は `YYYY-MM-DD`、該当しない欄は `n/a`。

- `id`：ファイル名の先頭（`YYYYMMDD-nn`）と同じ値
- `title`：決めたことを一文で。見出しと一覧の題にも同じ文を使う
- `type`：`decision`
- `business`：`n/a`
- `status`：起票時は `proposed`
- `created`：ファイルを書いた日
- `updated`：最後に内容を変えた日
- `as_of`：数値・事実の基準日（ADR は通常 `n/a`）
- `verified`：人間が「まだ正しい」と確認した日
- `supersedes`：置き換える ADR の id（無ければ `n/a`）

起票日（ID の日付）とファイル作成日（`created`）は一致しなくてよい。
議論した日と書き起こした日がずれることは普通にある。

## 本文の構成

20261003-06 以降の ADR は、MADR（Markdown Architectural Decision Records）の構成を日本語の見出しで使う。
節と各節に書くことは [`_template.md`](_template.md) が正本。

20260929-01 〜 20261003-05 の ADR は、それ以前の 5 節（背景・決定・根拠・影響・参考）で書かれている。
accepted の ADR は書き直さないので、2 つの形式が並ぶ。古い形式の ADR では、検討した他の選択肢は「根拠」の節にある。

## 利用者向け文書との関係

`docs/usage/` の文書には ADR の番号を書かない（利用者には意味を持たない）。
根拠を示したいときは HTML コメントで `<!-- 根拠: 20260929-05 -->` のように残す。

## 一覧

| id | title | status |
|---|---|---|
| 20260929-01 | シェル非依存 | accepted |
| 20260929-02 | CLAUDE.md は地図 | accepted |
| 20260929-03 | 憲章と育つ文書の分離 | accepted |
| 20260929-04 | business-os は事業非依存、/onboard で注入 | accepted |
| 20260929-05 | ステージングと承認、四重防衛 | accepted |
| 20260929-06 | 起動時セルフチェック | accepted |
| 20260929-07 | 経営基盤 Skill は最初から、業務 Skill は育てる | accepted |
| 20260929-08 | 既製フレームワークは参考にし、fork しない | accepted |
| 20260929-09 | 記憶は腐る前提で組む | accepted |
| 20260929-10 | 最初から公開 Plugin | accepted |
| 20260930-01 | Bash の文字列規則は粗い網 | accepted |
| 20261002-01 | 役割エージェントは同梱せず、主セッションを COO とする。作業は作業者へ委譲する | accepted |
| 20261003-01 | Skill の動作は claude plugin eval で CC が手元で検証する | accepted |
| 20261003-02 | Skill の自動検証で残した 4 つの論点の扱い | accepted |
| 20261003-03 | eval の scaffold に限り、TypeScript を呼ぶ 1 行の bash を許す | accepted |
| 20261003-04 | 共通の前提データを直下の fixtures/ に置き、evals/ を共通の道具と Skill ごとのテストに分ける | accepted |
| 20261003-05 | GitHub の pre-release は版の接尾辞があるときだけ付ける | accepted |
| 20261003-06 | 新しい ADR は MADR 形式で書き、既存の ADR は書き直さない | accepted |
| 20261003-07 | 実装リポの開発に要るものは実装リポに、経営側の文脈は company に置く | accepted |
| 20261003-08 | Skill が人に聞く質問は、SKILL.md の質問の表で番号・見出し・質問文を固定する | accepted |
| 20261003-09 | リリース PR が main にマージされたら、CI がタグを作って push する。GitHub の Release は CC か人が作る | accepted |
| 20261003-10 | 質問の先頭には、その回で何問目か・聞く見込みの数・質問 ID を付ける | accepted |
| 20261003-11 | コミットの署名に使う agent のソケットは保護した個人設定で許し、署名で失敗したら人にコミットを頼む | accepted |
| 20261003-12 | 事業ごとにくり返す質問がある Skill では、事業の数が分かるまで質問の数の見込みを出さない | accepted |
| 20261003-13 | コミットの署名の流れは、質問の流れの進行役で company の安全設定を読み込み、Bash を許して検証する | accepted |
| 20261004-01 | business-os への報告はサポート Skill の /report が受け持ち、検査済みの下書きを人がファイルで確かめて承認したら、CC が送る | accepted |
| 20261004-02 | 配布する Skill の数を 10 個に固定せず、分類ごとの追加の条件と ADR で増減を決める。一覧と実物の照合は続ける | accepted |
| 20261006-02 | MCP の道具は、読むだけと分かるもの以外を hook が確認に回す。雛形の名前の型の規則は予備として広げて残す | proposed |
