# 器の Skill の共通規約

business-os の Skill（`/onboard` など 10 個）は、実行の最初にこの文書を読み、ここに書いた規約に従う。
各 Skill の SKILL.md には、この規約との差分だけを書く。

## 場所

- company のルートは、作業ディレクトリから上位へ辿って `.business-os.json` があるディレクトリ
- 器のファイルは `${CLAUDE_SKILL_DIR}/../..` を器のルートとして参照する（例：雛形は `${CLAUDE_SKILL_DIR}/../../templates/`）
- 雛形の変数と書き出し先は `templates/README.md` にある

## 日付

- 日付は常に `YYYY-MM-DD` の絶対日付で書く。「今日」「昨日」「先週」などの相対日付を文書に残さない
- 今日の日付は、推測せず `date +%F`（Windows の PowerShell では `Get-Date -Format yyyy-MM-dd`）で確かめる

## フロントマター

- `docs/` 配下の全ての Markdown にフロントマターを付ける。定義は `templates/frontmatter.schema.json`
- `type` `business` `status` と、4 つの日付欄（`created` `updated` `as_of` `verified`）を省略しない。該当しない欄は `n/a`
- 既存の文書を変えたら `updated` を今日にする。`created` は書き換えない
- 数字を扱う文書（月次・四半期のレビュー）は `as_of` に「その数字がいつ時点か」を必ず書く
- 規約に合わない書き込みは器の hook が拒否する。拒否されたら理由を読んで直し、別の方法で書き込もうとしない

## 承認が要ること

次の 2 種類は、CC が単独で確定しない。

1. 外部に影響が出る行動（送信、投稿、支払い、公開、他人に見える変更）：実行の前に人間に確認する
2. 保護対象（`docs/charter/`、`CLAUDE.md`、`.claude/settings.json`、`.business-os.json`）の変更：
   `docs/proposals/` に提案を書き、人間が `/approve` で承認する。雛形は `templates/proposals/_template.md`

それ以外（日報、レビュー、台帳、調査メモ、提案、意思決定記録の起票）は CC が直接書いてよい。

## 古い情報で黙って判断しない

- 判断に使う文書の `updated`（数字なら `as_of`）が、次の期限より古ければ「この情報は N 日前のものです」と告げてから使う
  - 憲章（`docs/charter/`）の `verified`：90 日
  - 事業別の現況（`docs/operations/state/`）の `updated`：14 日
  - それ以外：30 日
- 提案には、参照した文書と、その `as_of` / `updated` を「根拠の鮮度」として書く

## 日報への実行記録

全ての Skill は、終わるときに当日の日報 `docs/operations/daily/YYYY-MM-DD.md` の「実行記録」に 1 行追記する。

```text
- HH:MM /<skill 名> — <結果を一言>
```

- 日報が無ければ `templates/operations/daily/_template.md` から作る（`/morning` 以外の Skill も作ってよい）
- この記録は `/retro` が Skill の実行回数を数える材料になる。省略しない

## git

- CC が行う git 操作は `git add` `git commit` `git push` だけ
- `git pull` `checkout` `merge` `stash` `rebase` など作業ツリーを変える操作は、人間に頼む
  （安全設定が、CC の起動するコマンドから憲章への書き込みを禁じており、途中で失敗するため）
- Skill が文書を書いたら、最後にコミットするかを人間に聞く。push は人間が頼んだときだけ

## 人への質問

- 選択肢がある質問は AskUserQuestion で聞く。自由記述が要る質問は、1 度に 1 つずつ聞く
- 利用者が「まだ決めていない」と答えたら、その文言をそのまま記録し、先へ進む
- 質問は本文脈（Skill を呼んだ会話）で行う。サブエージェントの中からは質問できない
