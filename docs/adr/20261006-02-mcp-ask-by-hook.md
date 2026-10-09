---
id: 20261006-02
title: MCP の道具は、読むだけと分かるもの以外を hook が確認に回す。雛形の名前の型の規則は予備として広げて残す
type: decision
business: n/a
status: accepted
created: 2026-10-06
updated: 2026-10-09
as_of: 2026-10-06
verified: 2026-10-06
supersedes: n/a
---

# 20261006-02: MCP の道具は、読むだけと分かるもの以外を hook が確認に回す。雛形の名前の型の規則は予備として広げて残す

> **置き換えの案内（2026-10-09）**：決定 6.2（予備の規則を必須規則に含め、足していない company を `/check` の fail で気づかせる）と、影響の「既存の company は、雛形の `ask` の追加を人が足すまで `/check` が fail になる」は、[ADR 20261007-01](20261007-01-mcp-ask-rules-warn.md) で置き換えた。ほかの決定は変わらない。以下の本文は決めた当時の記録として残す。

## 背景と問い

雛形（`templates/settings.json.tmpl`）の `permissions.ask` は、外部に影響が出る MCP の道具を、道具の名前の型で確認の対象にしている（20260929-05）。

```json
"mcp__*__send_*", "mcp__*__post_*", "mcp__*__create_*", "mcp__*__pay_*"
```

あわせて `/onboard` が、その時点で接続されている MCP の道具のうち、送信・投稿・作成・支払いにあたるものを具体名で `ask` に足す（`skills/onboard/SKILL.md`）。

ADR 20261004-01 の検証で、名前がこの型に合わない外部への道具が確認なしで通ることが分かり、Issue #65 に起票した。2026-10-06 に確かめた事実（「実行」は手元で動かした結果、「文書」は公式の文書）：

- **公式の GitHub MCP サーバー（v1.14.0、2026-10-02）**（文書。README の道具の一覧 96 個を名前で分類した）：
  - 今の 4 つの型に合うのは 7 個。名前の先頭が `get_` `list_` `search_` `read_` の読む道具が 50 個
  - どちらにも当たらない 39 個は、確認なしで通る。うち 10 個は名前から読む道具と分かる（`issue_read`、`pull_request_read`、`actions_list` など）。
    残る 29 個は書き換える道具で、`delete_repository`（リポジトリの削除）、`merge_pull_request`（PR のマージ）、`push_files`（ファイルの push）、
    `issue_write`（Issue の作成と更新）、`add_issue_comment`、`delete_file`、`fork_repository`、`update_pull_request`、`actions_run_trigger`、`mark_all_notifications_read` などを含む
- **claude.ai の Gmail のコネクタ**（このセッションで使える道具の一覧）：`reply` と `forward` はメールを送るが、型に合わない
- **名前の末尾で読むかどうかは決められない**（文書）：GitHub MCP の `issue_read` と `pull_request_read` は読む道具だが、`mark_all_notifications_read` は通知の状態を書き換える。
  末尾の `_read` を「読むだけ」の印にすると、書き換える道具を通してしまう
- **規則の優先順位**（文書）：deny → ask → allow の順に判定し、ask に合えば、より狭い allow があっても確認が出る。
  そのため「`mcp__*` を ask にして、読む道具だけ allow で外す」形は作れない。allow のワイルドカードは `mcp__<サーバー>__` の後ろにしか書けない
- **hook の判定**（文書）：PreToolUse の hook は `permissionDecision` に `ask` を返して確認を出せる。hook の `matcher` は正規表現で、`mcp__.*` で全ての MCP の道具に合う。
  hook の判定は deny と ask の規則を飛ばせない（ask の規則に合えば、hook が何を返しても確認が出る）
- **hook の `ask` は auto モードでも確認を出す**（実行。2026-09-30、`docs/design/architecture.md` 第 11 節の項目 4）
- **hook が時間切れになると通す**（文書）：PreToolUse の hook が時間切れになると、呼び出しは止まらず通常の権限の判定に進む。
  business-os の hook は、判定中の例外では exit 2 で止める（fail-closed）が、時間切れは Claude Code の側で通る
- **接続されている道具の一覧は、点検から取れない**：SessionStart の hook も `/check` のスクリプトも、接続されている MCP の道具の一覧を受け取らない

問い：

1. 外部に影響が出る MCP の道具を、名前の付け方によらず確認に回すには、どうするか
2. 読む道具まで確認が出て運用が止まらないように、どこで線を引くか
3. 判定の仕組みが動かなかったときに、どう安全側へ倒すか

## 判断の基準

- 外部に影響が出る道具は、名前の付け方によらず確認が出る。分からない道具は確認に回す（推測で通さない）
- 読むだけの道具は、確認なしで使える（毎回の確認で、利用者が中身を見ずに承認する癖を付けない）
- 1 つの仕組みが動かなくても、別の仕組みで止まる（四重防衛、20260929-05）
- 新しい MCP サーバーや道具が増えても、手で規則を足さずに効く

## 検討した案

- 案 A：雛形の `ask` の名前の型を増やす（`*write*`、`delete_*`、`update_*`、`merge_*`、`push_*`、`reply*`、`forward*` など）
- 案 B：雛形の `ask` に `mcp__*` を足し、全ての MCP の道具で確認を出す
- 案 C：PreToolUse の hook で全ての MCP の道具を見て、読むだけと分かるもの以外に `ask` を返す。雛形の名前の型の規則は、hook が動かなかったときの予備として広げて残す
- 案 D：点検（起動時の点検・`/check`）で、`ask` の規則に合わない接続済みの道具を一覧にして知らせる

## 決定

採用：**案 C**。

外部に影響が出る道具を名前の型で数え上げる（案 A）と、型に無い動詞の道具が出るたびに確認なしで通る。数え上げる側を「読むだけと分かる道具」に変えれば、分からない道具は確認に回り、安全側へ倒れる。
`permissions` の規則では ask が allow より先に効くので、この「読むだけを外す」形は hook でしか書けない。
hook は時間切れで通ってしまうので、雛形の名前の型の規則を広げて予備に残し、二重にする。

1. business-os の PreToolUse の hook（`hooks/pre-tool-use.ts`）が、全ての MCP の道具を見る。`hooks/hooks.json` の `matcher` に `mcp__.*` を足す
2. hook は、道具の名前（`mcp__<サーバー>__<道具>` の最後の部分）で次のように判定する
   1. 名前の先頭が読む動詞（`get_`、`list_`、`search_`、`read_`）なら、何もしない（通常の権限の判定に任せる）
   2. 読むだけと確かめた道具の名前の一覧（コードで持つ。例：GitHub MCP の `issue_read`、`pull_request_read`）に入っていれば、何もしない
   3. それ以外は、`ask` を返す。理由には「外部に影響が出るかもしれない MCP の道具です」と道具の名前を示す
   - 名前の末尾（`_read` など）では判定しない（`mark_all_notifications_read` のような書き換える道具を通さないため）
   - 判定は全て `company/.claude/hook-log-YYYYMM.jsonl` に記録する（今の hook と同じ）
3. 雛形の `permissions.ask` の MCP の名前の型を、予備として広げる。今の 4 つに、少なくとも次を足す：`mcp__*__*write*`、`mcp__*__delete*`、`mcp__*__update*`、`mcp__*__merge*`、
   `mcp__*__push*`、`mcp__*__reply*`、`mcp__*__forward*`、`mcp__*__trash*`、`mcp__*__add_*`、`mcp__*__issue_write`（20261004-01）。
   最終の一覧は実装の PR で、公式の GitHub MCP と、よく使われるコネクタの道具の名前に照らして決める
4. `/onboard` が接続済みの道具を具体名で `ask` に足す手順は残す（3 つ目の網として）
5. hook の判定の対象は MCP の道具だけにし、Claude Code に組み込みの道具（Read、WebFetch など）には広げない
6. 既存の company への届き方
   1. hook の変更は business-os の版上げで届く（company の設定を変えなくてよい）
   2. 雛形の `ask` の追加は、CHANGELOG と `docs/usage/` の更新の案内で、人が `.claude/settings.json` に足す行を示す。
      `/check` の「settings.json が雛形の必須規則を含む」は `permissions.ask` を照合するので、足していない company では fail になり、気づける

## 影響

- 良い影響
  - 新しい MCP サーバーや、型に無い動詞の道具も、読むだけと分かるもの以外は確認に回る。手で規則を足さずに効く
  - 読む道具（GitHub MCP では 96 個のうち、名前の先頭で分かる 50 個と、一覧に入れた道具）は、確認なしで使える
  - hook が時間切れで通っても、広げた名前の型の規則と `/onboard` の具体名の規則で止まる道具がある
  - 判定が hook の記録に残るので、どの道具で確認が出たかを後から見られる
- 悪い影響
  - 読む動詞で始まらない読む道具（`query`、`fetch` などで始まるもの）でも確認が出る。一覧に足すまで、利用者の手間が増える
  - 名前の型の規則と、読むだけの道具の一覧の 2 つを保守する必要がある
  - 既存の company は、雛形の `ask` の追加を人が足すまで `/check` が fail になる（予備の規則は hook ほど広くないので、緊急ではない）
  - 道具の名前は読む動詞で始まっていても、実際には書き換える道具を作ることはできる（作者の名付けに頼る部分が残る）
- その他
  - MCP の仕様には、道具が読むだけかを示す注釈（`readOnlyHint`）がある。hook の入力にその注釈が含まれるかは確かめていない。含まれるなら、名前より注釈を優先する形を別の ADR で検討する
  - 確かめられていないもの：hook の `matcher` に `mcp__.*` を足したとき、claude.ai のコネクタの道具（`mcp__claude_ai_<サーバー>__<道具>`）にも hook が発火するか。実装の PR で確かめる
  - 案 D は、接続されている道具の一覧を点検が受け取れないため、今は作れない

## 案ごとの長所と短所

### 案 A：雛形の名前の型を増やす

- 長所：設定だけで済む。hook の時間切れに左右されない
- 短所：型に無い動詞の道具は確認なしで通る（数え上げる側が「危ない道具」なので、漏れが確認なしの側に倒れる）。新しい道具が出るたびに型を足す必要がある

### 案 B：`mcp__*` を ask にする

- 長所：漏れが無い。設定だけで済む
- 短所：読む道具でも毎回確認が出る。ask は allow より先に効くので、読む道具を外せない。確認が多すぎると、中身を見ずに承認する癖が付く

### 案 C：hook で読むだけと分かるもの以外を確認に回し、名前の型を予備に残す

- 長所：分からない道具は確認に回る（安全側に倒れる）。読む道具は通る。予備の規則と二重になる
- 短所：hook の実装と、読むだけの道具の一覧の保守が要る。hook の時間切れでは予備の規則だけになる

### 案 D：点検で一覧を出す

- 長所：利用者が自分の環境の穴に気づける
- 短所：接続されている道具の一覧を点検が受け取れず、今は作れない。作れても、知らせるだけで止めない

## 参考

- Issue #65
- github/github-mcp-server の README（v1.14.0、道具の一覧）<https://github.com/github/github-mcp-server>
- Claude Code 公式「Configure permissions」（規則の優先順位、ワイルドカード、hook の判定と規則の関係）<https://code.claude.com/docs/en/permissions>
- Claude Code 公式「Hooks reference」（`permissionDecision`、MCP の道具の `matcher`、時間切れ）<https://code.claude.com/docs/en/hooks>
- 関連 ADR：20260929-05（ステージングと承認、四重防衛。外部に影響が出る MCP の道具の ask の規則）、20260929-06（起動時セルフチェック）、20261004-01（business-os への報告の導線。`mcp__*__issue_write`）
- `docs/design/architecture.md` 第 7 節（防衛）と第 11 節（実機の確認。hook の ask が auto モードで効く）、`hooks/pre-tool-use.ts`、`skills/onboard/SKILL.md`
