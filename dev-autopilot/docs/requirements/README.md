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

- 参照は、節の番号（「4.8 節」など。上の表）、要件の番号（FLOW-1 など。下の索引）、見出しの名前（「隔離と鍵の分け方」など）で書く。別のファイルを指す節の番号と見出しの名前は、参照先のファイルへのリンクにしてある
- まだ決めていないことは [09-undecided.md][f09] に集めてある。ADR で決めること、基本設計の中で決めてよいもの、確かめることに分けてある
- [11-records.md][f11] は調査とレビューの記録で、要件ではない

## 要件の番号の索引

要件の番号は、ファイル名の話題を頭にして、ファイルの中で 1 から順に振る。

| 番号 | 中身 | ファイル |
| --- | --- | --- |
| FLOW-n | 棚卸し、並列と競合、間隔の運用 | [01-issue-flow.md][f01] |
| IMPL-n | 実装、レビュー、対応ループ | [02-implement-review-fix.md][f02] |
| MERGE-n | マージ | [03-merge.md][f03] |
| TEXT-n | 外から入る文の扱い | [04-external-text-and-markers.md][f04] |
| SAFE-n | 安全側に倒す設計と、隔離と鍵の分け方 | [05-safety.md][f05] |
| SETUP-n | 導入と点検、準備の作業 | [06-setup-and-stages.md][f06] |
| STRUCT-n | 分離を見越した構成の守ること | [07-structure.md][f07] |
| REVIEW-n | change-review を v2 に組み直す方針 | [08-review-skill.md][f08] |

表の中だけで使う番号は、次のとおり。

| 番号 | 中身 | ファイル |
| --- | --- | --- |
| 遷移 1〜10、B1〜B7 | Issue の状態の遷移と、止まる遷移 | [01-issue-flow.md][f01] |
| S1〜S6 | change-review を無人で使うには足りない点 | [08-review-skill.md][f08] |
| D-n | ADR で決めること（番号は[要件定義書][req]の 10 節のもの） | [09-undecided.md][f09] |
| 1〜19 | 実機で確かめた事実 | [10-verified-facts.md][f10] |

## 古い番号との対応

[要件メモ][memo]と[要件定義書][req]、閉じた PR は古い番号で書かれている。古い番号は、次の表で新しい番号に読み替える。

| 古い番号 | 新しい番号 |
| --- | --- |
| R1-n（棚卸し） | R1-1 → FLOW-1、R1-2 → FLOW-2、R1-3 → FLOW-3、R1-5 → FLOW-4、R1-4 → FLOW-5 |
| R5-n（並列と競合） | R5-1 → FLOW-6、R5-2 → FLOW-7、R5-3 → FLOW-8、R5-4 → FLOW-9、R5-5 → FLOW-10 |
| R6-n（間隔の運用） | R6-1 → FLOW-11、R6-2 → FLOW-12、R6-3 → FLOW-13、R6-4 → FLOW-14 |
| R2-n（実装） | R2-1 → IMPL-1、R2-2 → IMPL-2、R2-3 → IMPL-3、R2-4 → IMPL-4、R2-5 → IMPL-5、R2-5b → IMPL-6、R2-6 → IMPL-7、R2-7 → IMPL-8、R2-8 → IMPL-9、R2-9 → IMPL-10、R2-10 → IMPL-11、R2-11 → IMPL-12、R2-12 → IMPL-13、R2-13 → IMPL-14、R2-14 → IMPL-15 |
| R3-n（レビュー） | R3-1 → IMPL-16、R3-2 → IMPL-17、R3-3 → IMPL-18、R3-4 → IMPL-19、R3-5 → IMPL-20、R3-6 → IMPL-21、R3-7 → IMPL-22 |
| R4-n（対応ループ） | R4-1 → IMPL-23、R4-2 → IMPL-24、R4-2b → IMPL-25、R4-1b → IMPL-26、R4-3 → IMPL-27、R4-4 → IMPL-28 |
| R7-n（マージ） | R7-1 → MERGE-1、R7-2 → MERGE-2、R7-2b → MERGE-3、R7-3 → MERGE-4、R7-3b → MERGE-5、R7-3c → MERGE-6、R7-4 → MERGE-7、R7-5 → MERGE-8、R7-6 → MERGE-9 |
| In（外から入る文の扱い） | I1 → TEXT-1、I2 → TEXT-2、I3 → TEXT-3、I4 → TEXT-4、I5 → TEXT-5、I6 → TEXT-6、I7 → TEXT-7、I8 → TEXT-8、I9 → TEXT-9、I10 → TEXT-10、I11 → TEXT-11、I12 → TEXT-12 |
| Sn（導入と点検） | S1 → SETUP-1、S2 → SETUP-2、S3 → SETUP-3、S4 → SETUP-4 |
| Pn（準備の作業） | P1 → SETUP-5、P2 → SETUP-6、P3 → SETUP-7、P4 → SETUP-8、P5 → SETUP-9、P6 → SETUP-10、P7 → SETUP-11、P8 → SETUP-12、P9 → SETUP-13、P10 → SETUP-14、P11 → SETUP-15、P12 → SETUP-16、P15 → SETUP-17、P13 → SETUP-18、P14 → SETUP-19 |

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
