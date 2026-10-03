# templates — company の雛形

`/onboard` がこのフォルダの雛形を読み、利用者の company リポジトリに書き出す。
このファイル自体は書き出さない。

## 変数の書き方

- 変数は `{{ snake_case }}`（波括弧の内側に空白を 1 つずつ）
- 表の中の変数は「行の雛形」。`/onboard` が項目ごとに行をくり返し、行の雛形の直後にある HTML コメントを消す
  - 台帳の行の `business_id` は、会社全体にかかる項目なら `portfolio` を入れる
- 書き出すときに全ての変数を埋める。**埋まっていない `{{ }}` を残さない**
- 利用者が「まだ決めていない」と答えた項目は、その文言をそのまま入れる（空欄にしない）
- 日付は `YYYY-MM-DD`。「今日」「昨日」などの相対日付を入れない

## 書き出し先

| 雛形 | 書き出し先（company 内） | 書き出す時 |
|---|---|---|
| `CLAUDE.md.tmpl` | `CLAUDE.md` | `/onboard` |
| `settings.json.tmpl` | `.claude/settings.json` | `/onboard`。MCP の ask 規則は接続済みのツール名に置き換える |
| `business-os.json.tmpl` | `.business-os.json` | `/onboard` の最初の行動（`state: initializing`）。完了時に `state: active` と `onboardedAt` を書く |
| `gitignore.tmpl` | `.gitignore` | `/onboard`。Obsidian を使うときだけ、アダプタが除外の行を足す |
| `gitattributes.tmpl` | `.gitattributes` | `/onboard` |
| `charter/company.md` `charter/decision-rules.md` | `docs/charter/` | `/onboard` |
| `charter/repositories/README.md` | `docs/charter/repositories/README.md` | `/onboard` |
| `charter/repositories/_template.md` | `docs/charter/repositories/<リポ名>/instructions.md` | 実装リポを扱うときの指示を足すとき。`docs/charter/` の下なので、導入後は提案として書く |
| `charter/businesses/_template.md` | `docs/charter/businesses/<事業 ID>.md` | `/onboard`（事業ごと） |
| `operations/obligations.md` `risks.md` | `docs/operations/` | `/onboard` |
| `operations/state/_template.md` | `docs/operations/state/<事業 ID>.md` | `/onboard`（事業ごと） |
| `proposals/_template.md` | `docs/proposals/<id>-<slug>.md` | CC が提案を書くとき |
| `operations/daily/_template.md` | `docs/operations/daily/YYYY-MM-DD.md` | `/morning`。日報が無いときは他の Skill も作る |
| `operations/reviews/weekly.md` `monthly.md` `quarterly.md` `retro.md` | `docs/operations/reviews/weekly-YYYY-Www.md` など | `/weekly-review` `/close` `/quarterly` `/retro` |
| `decisions/_template.md` | `docs/decisions/<id>-<slug>.md` | `/adr` `/validate` |
| `skill-conventions.md` | 書き出さない | business-os の Skill が最初に読む共通規約 |
| `frontmatter.schema.json` | 書き出さない | business-os の検査と hook が参照する |

## 変数と `/onboard` の質問の対応

`/onboard` の質問は、利用者向け文書「はじめる」の「聞かれること」と同じ順に並べる。

| `/onboard` の質問 | 変数 | 使う雛形 |
|---|---|---|
| 会社の呼び名、一行説明、目指すこと、優先順位 | `company_name` `company_summary` `company_goal` `company_priorities` | `CLAUDE.md.tmpl` `charter/company.md` |
| 運営している事業の一覧（名前と一言説明） | `business_name` `business_summary` `business_list` | `charter/company.md` `charter/businesses/_template.md` `operations/state/_template.md` |
| 〃（事業 ID） | `business_id` | 同上。CC が名前から英小文字・数字・ハイフンの ID を作り、利用者に確認する。`portfolio` は使わない |
| CC に任せてよい範囲と、承認が要る範囲 | `delegated_rules` `extra_approval_rules` `tie_breakers` | `charter/decision-rules.md`。承認が要る 2 種類は固定で、ここには追加分だけを入れる |
| 忘れてはいけない期限や義務 | `due` `obligation` `frequency` `obligation_status` | `operations/obligations.md`（行の雛形） |
| 各事業の実装リポジトリの場所 | `repo_name` `repo_path_macos` `repo_path_windows` `repo_purpose` `repo_instructions` | `charter/repositories/README.md`（行の雛形）。`repo_instructions` は、指示を書いた実装リポなら `[指示](<リポ名>/instructions.md)`、無ければ「無し」 |
| 各事業で追いかける数字（候補から選ぶ） | `business_kpis` | `charter/businesses/_template.md` |
| 主セッション（COO）のモデル。best 推奨（使える最上位）。利用枠を節約するなら opus | `main_model` | `settings.json.tmpl`。別名（`best` `fable` `opus` `sonnet` `haiku`）で書き、版番号を書かない。既定は `best` |
| ナレッジの閲覧に Obsidian を使うか | （変数なし） | 分岐のみ。使わない場合は Obsidian 関連のファイルを一切書き出さない |
| コミットの署名の agent への接続を許すか（macOS で、署名付きコミットを使うときだけ） | （変数なし） | 雛形は使わない。許したときだけ `.claude/settings.local.json` の `sandbox.network.allowUnixSockets` にソケットのパスを書く |

## 質問しない変数

| 変数 | 入れる値 |
|---|---|
| `onboarded_at` | `/onboard` を実行した日 |
| `plugin_version` | business-os の `.claude-plugin/plugin.json` の `version` |
| `business_exit_criteria` | 「まだ決めていない。`/quarterly` で決める」 |
| `risk` `risk_signal` `risk_mitigation` `risk_status` | 事業の一覧から CC がリスクの候補を挙げ、利用者が選んだもの。選ばなければ「まだ無い」の 1 行 |
| `state_running` `state_waiting` `state_blocked` | 「まだ記録が無い」 |
| `proposal_id` `proposal_title` `business` `target` `today` `background` `change_summary` `diff` `sources` | 提案を書くときに CC が埋める（`/onboard` では使わない） |
| `repo_role` `repo_rules` `today` | 実装リポを扱うときの指示（`charter/repositories/_template.md`）を書くときに、利用者に聞いて CC が埋める（`/onboard` では使わない） |

## Skill が書き出す雛形の変数

各 Skill が書き出すときに埋める（`/onboard` では使わない）。日付は全て `YYYY-MM-DD`。

| 雛形 | 変数 |
|---|---|
| `operations/daily/_template.md` | `date` `summary` `priorities` `pending_approvals` `deadlines` `questions` |
| `operations/reviews/weekly.md` | `date` `week_id` `week_start` `week_end` `achievements` `business_id` `hours` `note` `next_focus` `state_updates` |
| `operations/reviews/monthly.md` | `date` `as_of` `month_id` `business_id` `revenue` `cost` `margin` `source` `cash` `payments` `deadlines` `kpi_notes` |
| `operations/reviews/quarterly.md` | `date` `as_of` `quarter_id` `business_id` `trend` `decision` `reason` `risk_review` `charter_review` `proposals` |
| `operations/reviews/retro.md` | `date` `period_start` `period_end` `skill` `count` `repeated_requests` `unused_skills` `rule_proposals` `proposals` |
| `decisions/_template.md` | `decision_id` `business` `date` `as_of` `decision_title` `background` `decision` `rationale` `consequences` `sources` |
