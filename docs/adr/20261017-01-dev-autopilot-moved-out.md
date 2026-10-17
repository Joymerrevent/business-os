---
id: 20261017-01
title: dev-autopilot を別のリポジトリ Joymerrevent/dev-autopilot に移したので、business-os から dev-autopilot/ と規則の例外を外す
type: decision
business: n/a
status: accepted
created: 2026-10-17
updated: 2026-10-17
as_of: n/a
verified: 2026-10-17
supersedes: 20261008-01
---

# 20261017-01: dev-autopilot を別のリポジトリ Joymerrevent/dev-autopilot に移したので、business-os から dev-autopilot/ と規則の例外を外す

## 背景と問い

[ADR 20261008-01](20261008-01-dev-autopilot-folder.md) は、自律開発ループ dev-autopilot を business-os の開発物のフォルダ `dev-autopilot/` に置き、設計判断と文書の規則をそのフォルダに閉じると決めた。
決定 7 は、別のリポジトリへ分離する時期と方法を dev-autopilot 側に任せ、分離したら business-os 側は `dev-autopilot/` と `check:dev-autopilot` の 1 行を消し、ADR 20261008-01 を「分離した」ADR で置き換えるとした。

dev-autopilot 側は、次の 2 本の ADR で分離を決めた（どちらも accepted）。

- [ADR-20261016-003](https://github.com/Joymerrevent/dev-autopilot/blob/develop/docs/adr/adr-20261016-003-move-to-own-repository-before-basic-design.md)：基本設計の前に、別のリポジトリ `Joymerrevent/dev-autopilot`（public）へ移す。ほかのリポへの適用と配布は段階 8 の後に決め、それまで当てる先は business-os だけにする
- [ADR-20261017-001](https://github.com/Joymerrevent/dev-autopilot/blob/develop/docs/adr/adr-20261017-001-carry-history-into-own-repository.md)：`dev-autopilot/` の履歴を新しいリポジトリへ引き継ぐ

2026-10-17 に、business-os の be22371 までの `dev-autopilot/` を、29 件の commit の履歴ごと `Joymerrevent/dev-autopilot` に移した。移した後は、business-os の `dev-autopilot/` を変更していない（ADR-20261016-003 の決定 1）。
新しいリポジトリでは、検査と CI を入れ、移した文書の参照と要件を直した（Joymerrevent/dev-autopilot の PR #1・#2）。

2026-10-17 の時点で、business-os の中で dev-autopilot に触れているのは次のところだけ。

- `dev-autopilot/`（`docs/` と `.markdownlint-cli2.jsonc`。コードは無い）
- CLAUDE.md の 2 か所（「何がどこにあるか」の 1 行と、絶対ルール 3 の例外）
- 構造仕様（`docs/design/architecture.md`）の 3 か所（構成の図、配布物と開発物の表、規則の文）
- ADR 20261008-01、[ADR 20261009-01](20261009-01-reference-style-links.md)（`dev-autopilot/` だけを inline のリンクの規則の対象外にする）、[ADR 20261009-02](20261009-02-plugin-subfolder-source.md)（背景で開発物の例に挙げる）、ADR の一覧

`check:dev-autopilot` は、dev-autopilot にコードが無いまま移したので、一度も足していない。

問い：business-os から何を外し、何を残すか。business-os の ADR と規則をどう直すか。移した後、business-os と dev-autopilot はどう結びつくか。

## 判断の基準

- dev-autopilot の文書の正本を 1 か所にする（同じ文書を 2 か所で直さない）
- 公開済みの履歴を書き換えない（CLAUDE.md の絶対ルール 6）。business-os の中の dev-autopilot の経緯は、business-os の履歴で読める
- 要らなくなった規則の例外を外し、business-os の中に規則を 2 組並べない
- 後から読む人（人と CC）が、business-os の地図から dev-autopilot の置き場を辿れる
- dev-autopilot が business-os を当てる先にするとき、business-os に入る変更は business-os の規則に従う

## 検討した案

- 案 A：`dev-autopilot/` を消し、CLAUDE.md と構造仕様の dev-autopilot の記述を消す。CLAUDE.md の地図には、移した先を指す 1 行を残す
- 案 B：`dev-autopilot/` の中身を消し、移した先を書いた README だけを残す
- 案 C：`dev-autopilot/` を消し、business-os のどこにも dev-autopilot を書かない

## 決定

採用：**案 A**。文書の正本が dev-autopilot のリポジトリの 1 か所になり、規則の例外が無くなる。地図に 1 行だけ残すので、後から読む人が移した先を辿れる。

1. **`dev-autopilot/` を消す**：フォルダごと消す。business-os の公開済みの履歴は書き換えず、消す前の中身は business-os の履歴（be22371 など）で読む
2. **CLAUDE.md**：「何がどこにあるか」の `dev-autopilot/` の 2 行を、次の 1 行に置き換える。
   「dev-autopilot（自律開発ループ）は別のリポジトリ `Joymerrevent/dev-autopilot` で開発する。business-os はその最初の当てる先（ADR 20261017-01）」。
   絶対ルール 3 の「`dev-autopilot/` の中だけは inline の規則を適用しない（ADR 20261008-01）」の行を消す
3. **構造仕様**（`docs/design/architecture.md`）：構成の図の `dev-autopilot/` の行、配布物と開発物の表の開発物の列の `dev-autopilot/`、「`dev-autopilot/` の文書と ADR の規則は、そのフォルダの中の規則に従う」の文を消す
4. **ADR 20261008-01 を置き換える**：status を `superseded`（この ADR）にし、決定の節の先頭に置き換えの追記を足す。本文は当時の決定の記録として残す
5. **ADR 20261009-01 の決定 2 を改める**：「規則の対象外は `dev-autopilot/` だけ」を、「対象外のフォルダは無い」に改める。
   ADR 20261009-01 の status は `accepted` のまま、タイトルの下に、決定 2 をこの ADR で改めた旨の注記を足す。決定 1・3・4（inline の規則とその理由、CLAUDE.md の文言、Skill の規約）は据え置く。
   決定 2 の「対象外のフォルダを増やすときは、同じ基準で ADR を起票する」も据え置く
6. **business-os と dev-autopilot の結びつき**：
   - dev-autopilot の設計判断は、dev-autopilot のリポジトリの ADR が正典。business-os 側が持つ dev-autopilot の ADR は、この 1 本だけにする（ADR 20261008-01 と同じ方針）
   - dev-autopilot が business-os を当てる先にするために足すもの（リポの設定 `.claude/dev-autopilot.json`、ラベル、ruleset など）は、dev-autopilot の `setup` が作る。
     business-os のファイルに入るものは business-os の PR で入れ、business-os の規則（CLAUDE.md の絶対ルール）に従う
   - business-os と dev-autopilot は、互いのコードを import しない（ADR 20261008-01 の決定 1 と同じ）
7. **進める順**：この ADR の承認の後、1〜5 を 1 つの PR で行い、ADR の一覧も直す（ADR 20261008-01 を superseded に、この ADR を足す）。
   ADR 20261009-02 は、背景で開発物の例として `dev-autopilot/` を挙げているだけで、決定は dev-autopilot に依らないので直さない

## 影響

- 良い影響
  - dev-autopilot の文書の正本が、dev-autopilot のリポジトリの 1 か所になる。business-os の中で古い写しを直してしまう心配が無くなる
  - CLAUDE.md の絶対ルール 3 の例外が無くなり、business-os の Markdown の規則が 1 組になる
  - business-os の PR と履歴が、business-os の変更だけになる
- 悪い影響
  - business-os の中では、dev-autopilot の文書を読めなくなる。地図の 1 行から移した先を辿る
  - business-os の過去の PR と commit に書かれた `dev-autopilot/` のパスは、消えたファイルを指す。中身は business-os の履歴で読む
- その他
  - business-os の `/verify-issue` から dev-autopilot の受け入れを呼ぶ形は、dev-autopilot 側で決める（dev-autopilot の UNDECIDED-43）。決めるまで、`/verify-issue` は dev-autopilot を呼ばない（今も呼んでいない）
  - dev-autopilot がほかのリポに当てられるようになっても、business-os 側の扱いは変わらない

## 案ごとの長所と短所

### 案 A：消して、地図に 1 行だけ残す

- 長所：正本が 1 か所になる。規則の例外が無くなる。後から移した先を辿れる
- 短所：business-os の中では dev-autopilot の文書を読めない

### 案 B：README だけを残す

- 長所：`dev-autopilot/` というフォルダの名前で、移した先を探せる
- 短所：中身の無いフォルダが開発物として残り、構造仕様の表と CLAUDE.md の地図に載せ続けることになる。README を直す人が、写しと正本を取り違えうる

### 案 C：どこにも書かない

- 長所：business-os の文書から dev-autopilot の記述が無くなり、最も簡単
- 短所：business-os の履歴や過去の PR で dev-autopilot を見た人が、今どこにあるかを辿れない

## 参考

- [ADR 20261008-01](20261008-01-dev-autopilot-folder.md)（この ADR で置き換える。決定 7 が置き換えを予定していた）
- [ADR 20261009-01](20261009-01-reference-style-links.md)（決定 2 を改める）、[ADR 20261009-02](20261009-02-plugin-subfolder-source.md)（直さない）
- dev-autopilot の [ADR-20261016-003](https://github.com/Joymerrevent/dev-autopilot/blob/develop/docs/adr/adr-20261016-003-move-to-own-repository-before-basic-design.md) と [ADR-20261017-001](https://github.com/Joymerrevent/dev-autopilot/blob/develop/docs/adr/adr-20261017-001-carry-history-into-own-repository.md)
- 移した先：<https://github.com/Joymerrevent/dev-autopilot>
