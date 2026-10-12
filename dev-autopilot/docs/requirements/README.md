# dev-autopilot 要件

dev-autopilot（自律開発ループ）の要件を、話題ごとのファイルに分けて書く。

## ファイル

| ファイル | 話題 | 節の番号 |
| --- | --- | --- |
| [00-overview.md][f00] | 目的・前提・登場するもの | 1、2、3 |
| [01-issue-flow.md][f01] | Issue の流れと運用（棚卸し・並列・間隔・状態の遷移・運用の規則） | 4.1、4.5、4.6、4.10 |
| [02-implement-review-fix.md][f02] | 実装・レビュー・対応ループ・モデル | 4.2、4.3、4.4、4.11 |
| [03-merge.md][f03] | マージ | 4.7 |
| [04-external-text-and-markers.md][f04] | 外から入る文と印 | 4.8、4.12 |
| [05-safety.md][f05] | 安全側に倒す設計（隔離と鍵） | 6 |
| [06-setup-and-stages.md][f06] | 導入・準備・段階 | 4.9、5、7 |
| [07-structure.md][f07] | 分離を見越した構成 | 10 |
| [08-review-skill.md][f08] | レビューの Skill（change-review v2） | 9 |
| [09-undecided.md][f09] | 決めていないこと | — |
| [10-verified-facts.md][f10] | 実機で確かめた事実 | — |
| [11-records.md][f11] | 調査とレビューの記録（要件ではない） | 11 |

## 読み方

- 参照は、節の番号（「4.8 節」など。上の表）、要件の番号（R・I・S・P など。下の索引）、見出しの名前（「隔離と鍵の分け方」など）で書く。別のファイルを指す節の番号と見出しの名前は、参照先のファイルへのリンクにしてある
- まだ決めていないことは [09-undecided.md][f09] に集めてある。ADR で決めること、基本設計の中で決めてよいもの、確かめることに分けてある
- [11-records.md][f11] は調査とレビューの記録で、要件ではない

## 要件の番号の索引

| 番号 | 中身 | ファイル |
| --- | --- | --- |
| R1-n | 棚卸し（4.1 節） | [01-issue-flow.md][f01] |
| R2-n | 実装（4.2 節） | [02-implement-review-fix.md][f02] |
| R3-n | レビュー（4.3 節） | [02-implement-review-fix.md][f02] |
| R4-n | 対応ループ（4.4 節） | [02-implement-review-fix.md][f02] |
| R5-n | 並列と競合（4.5 節） | [01-issue-flow.md][f01] |
| R6-n | 間隔の運用（4.6 節） | [01-issue-flow.md][f01] |
| R7-n | マージ（4.7 節） | [03-merge.md][f03] |
| I1〜I12 | 外から入る文の扱い（4.8 節） | [04-external-text-and-markers.md][f04] |
| S1〜S4 | 導入と点検（4.9 節） | [06-setup-and-stages.md][f06] |
| S1〜S6（「9 節 S1」のように書く） | change-review を無人で使うには足りない点（9 節） | [08-review-skill.md][f08] |
| P1〜P15 | 準備の作業（5 節） | [06-setup-and-stages.md][f06] |
| 遷移 1〜10、B1〜B7 | Issue の状態の遷移と止まる遷移（4.10 節） | [01-issue-flow.md][f01] |
| D-n | ADR で決めること（番号は[要件定義書][req]の 10 節のもの） | [09-undecided.md][f09] |
| 「実機で確かめた事実」の 1〜19 | 実機で確かめた事実の表 | [10-verified-facts.md][f10] |

## 要件を変えるとき

- 選ぶ判断が要るもの（[09-undecided.md][f09] の「ADR で決めること」など）は、[ADR][adr] を `proposed` で起票し、メンテナが `accepted` にしてから、関係するファイルを直す
- 記述の誤りや言い回しは、PR で直接直す

## 元の文書

要件は、1 つのファイルだった[要件メモ][memo]（約 900 行。2026-10-07〜11 の検討の記録）と、要件メモから写した[要件定義書][req]（2026-10-11）に書かれていた。
2026-10-12〜13 に要件メモを話題ごとのファイルに分け、古い文と経緯の注記を消して整理し、2 つの文書は消した。2 つの文書へのリンクは、消す前の commit に固定してある。

[f00]: ./00-overview.md
[f01]: ./01-issue-flow.md
[f02]: ./02-implement-review-fix.md
[f03]: ./03-merge.md
[f04]: ./04-external-text-and-markers.md
[f05]: ./05-safety.md
[f06]: ./06-setup-and-stages.md
[f07]: ./07-structure.md
[f08]: ./08-review-skill.md
[f09]: ./09-undecided.md
[f10]: ./10-verified-facts.md
[f11]: ./11-records.md
[adr]: ../adr/README.md
[memo]: https://github.com/Joymerrevent/business-os/blob/b8bc13eef06d430e24483168cfa0ff8edc1987e0/dev-autopilot/docs/dev-autopilot-requirements.md
[req]: https://github.com/Joymerrevent/business-os/blob/b8bc13eef06d430e24483168cfa0ff8edc1987e0/dev-autopilot/docs/requirements.md
