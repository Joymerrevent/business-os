---
type: knowledge
business: n/a
status: active
created: 2026-09-30
updated: 2026-10-06
as_of: n/a
verified: n/a
---

# business-os 構造仕様

この文書は business-os の構造を定義する。設計判断の「なぜ」は `docs/adr/` にあり、
ここでは「何をどう配置するか」を書く。実装者（CC と人間）が参照する正典。

## 1. 目的と範囲

business-os は、1 人で複数事業を運営する人が Claude Code（CC）を「経営の手足」として使うための
**Plugin** である。事業に依存しない形で配布し、利用者は自分の事業情報を `/onboard` で注入する。

範囲に含むもの：Skill 10 個、hook、テンプレート、検査、Obsidian アダプタ、設計文書。
範囲に含まないもの：事業固有の Skill、事業データ、実装リポの中身。

## 2. 全体像

### 2.1 二つのリポジトリ

```text
business-os/   公開 Plugin。事業情報ゼロ。MIT。
company/       事業データ。非公開。利用者ごとに 1 つ。/onboard が生成する。
```

<!-- 根拠: 20260929-04, 20260929-10 -->

- 日常で CC を起動するのは `company/`。business-os はユーザースコープの Plugin として読み込まれる
- `business-os/` で CC を起動するのは、business-os そのものを改良するときだけ
- CC の auto memory はプロジェクト単位で `~/.claude/` 配下に保存されるため、`company/` に対応する記憶は
  `company/` にも business-os にも入らない

### 2.2 実行環境

| 項目 | 要件 |
|---|---|
| Claude Code | Plugin 対応版（2026-09 時点の 2.1 系以降） |
| Node.js | 24 系（TS の直接実行に必要。`.node-version` で固定） |
| OS | macOS、Linux、Windows（WSL 推奨。ネイティブは Obsidian を使う場合の選択肢で、防衛は三重になる。第 10.5 節） |
| Git | 必須。GitHub CLI（`gh`）は推奨 |
| Obsidian | 任意 |

<!-- 根拠: 20260929-01 -->

## 3. `business-os/` の構成

```text
business-os/
├── .claude-plugin/
│   ├── plugin.json              # Plugin メタデータ。name / version / description(alpha)
│   └── marketplace.json         # business-os 自身をマーケットプレイスとして公開する定義（/plugin marketplace add 用）
├── .claude/                     # business-os を CC で開発するときの設定（配布しない）
│   ├── settings.json            # 秘密の読み取りと force push などを拒否する permissions（sandbox は使わない。§3.1）
│   ├── settings.local.json      # 個人設定（gitignore）
│   └── skills/
│       └── release/SKILL.md     # 開発専用：changeset → version → CHANGELOG → tag
├── .changeset/                  # 変更履歴の元
├── .github/
│   ├── workflows/               # check + gitleaks + audit を Linux / Windows で
│   └── ISSUE_TEMPLATE/          # 不具合 / 提案 / 環境情報
├── agents/
│   └── worker.md                # 作業者エージェント（sonnet、ファイルの読み書きと検索のみ）。COO から委譲される
├── skills/                      # 配布される経営基盤 Skill（10 個）
│   ├── onboard/SKILL.md
│   ├── approve/SKILL.md
│   ├── check/SKILL.md
│   ├── adr/SKILL.md
│   ├── morning/SKILL.md
│   ├── weekly-review/SKILL.md
│   ├── close/SKILL.md
│   ├── quarterly/SKILL.md
│   ├── retro/SKILL.md
│   └── validate/SKILL.md
├── hooks/
│   ├── hooks.json               # hook の登録定義
│   ├── session-start.ts         # 軽い点検
│   ├── pre-tool-use.ts          # 書き込みガード、Bash 意味解析
│   └── lib/                     # フロントマター検証、日付検証、シェル引数解析
├── scripts/
│   ├── check.ts                 # 重い点検（company 向け）と check:*（business-os 向け）の共有実装
│   ├── lib/                     # 点検の中身（company-checks.ts など）
│   ├── sync-plugin-version.ts   # changesets の version を plugin.json へ同期
│   └── pre-commit.ts            # 開発用。git の pre-commit（lint-staged と gitleaks）
├── templates/                   # company の雛形。/onboard が展開する
│   ├── CLAUDE.md.tmpl
│   ├── settings.json.tmpl
│   ├── frontmatter.schema.json
│   ├── charter/                 # company.md / decision-rules.md / repositories/README.md・_template.md / businesses/_template.md
│   ├── operations/              # obligations.md / risks.md / state/_template.md / daily/_template.md / reviews/*.md
│   ├── decisions/_template.md   # company の意思決定記録
│   ├── proposals/_template.md
│   └── skill-conventions.md     # business-os の Skill の共通規約（書き出さない）
├── adapters/
│   └── obsidian/                # 第 10 節
├── fixtures/                    # vitest と eval が共有する前提データ（company/ が土台の検証用 company）
├── test/                        # hook の fail-closed テスト、check の単体テスト（vitest）
├── evals/                       # Skill の動作の検証。lib/ が共通の道具、skills/<Skill 名>/<ケース名>/ がケース
├── docs/
│   ├── README.md                # 開発者向け入口
│   ├── adr/                     # 設計判断記録
│   ├── design/                  # この文書
│   └── usage/                   # 利用者向け（入門 / 目的別 / 考え方 / リファレンス）
├── CLAUDE.md                    # 開発ガイド（第 5 節）
├── README.md                    # Status: Alpha を冒頭に。「最短で動かす」まで
├── CHANGELOG.md  CONTRIBUTING.md  SECURITY.md  CODE_OF_CONDUCT.md  LICENSE
├── .editorconfig  .node-version  .gitignore  .gitattributes  .gitleaks.toml
├── .markdownlint-cli2.jsonc  .prettierrc.json  .prettierignore  eslint.config.mjs
├── commitlint.config.js  lint-staged.config.mjs  tsconfig.json  vitest.config.ts
├── pnpm-workspace.yaml          # pnpm の設定（依存の熟成期間など）
└── package.json                 # check:* が検査の正典
```

### 3.1 配布物と開発物

| 配布物（Plugin に含まれる） | 開発物（business-os の開発にだけ使う） |
|---|---|
| `.claude-plugin/` `skills/` `agents/` `hooks/` `scripts/` `templates/` `adapters/` | `.claude/` `.changeset/` `.github/` `fixtures/` `test/` `evals/` `docs/` 設定ファイル群 |

配布専用 Skill は `skills/`、開発専用 Skill は `.claude/skills/` に置き、混ぜない。
`agents/` には作業者エージェント `worker` だけを置く。役割（視点）エージェントは同梱しない（ADR 20261002-01）。
business-os の開発リポジトリでは sandbox を使わない。sandbox で守るのは、business-os を入れて運用する company の側。
開発では `gh` の認証、`.claude/` を含むブランチの切り替え、`claude -p` での実機の試験、コミットへの署名を sandbox が妨げるため。

### 3.2 言語と実行方式

- hook / scripts は TypeScript。Node 24 が直接実行する。ビルドと `dist/` は持たない
- `tsconfig.json` で `erasableSyntaxOnly: true`、`allowImportingTsExtensions: true`
- `hooks.json` からの呼び出しは `node "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.ts"`（パスに空白を含む環境があるため二重引用符で囲む）
- 相対 import は拡張子 `.ts` まで書く（`import { x } from './lib/x.ts'`）。拡張子なしは Node が解決しない
- bash スクリプトは含めない。Git のフック（pre-commit / pre-push）も Node 製の管理ツール経由

<!-- 根拠: 20260929-01 -->

### 3.3 検査（`pnpm check`）

`package.json` の `check:*` をパターンで束ねる。**この文書にも README にも検査の一覧を書かない**
（写しが古くなるため）。正典は `package.json`。以下は分類の説明であり一覧ではない。

- Skill の存在とフロントマター、hook の存在と fail-closed、`claude plugin validate`
- テンプレートのフロントマターがスキーマに適合すること
- 秘密・固有名詞の混入（gitleaks + 独自辞書）
- 文書のリンク、ADR 索引、利用者文書への ADR 番号混入
- 成否は終了コード。Done の数を数えない

CI は同じ検査を Linux と Windows の両方で回し、`pnpm audit --prod --audit-level high` を足す。

<!-- 根拠: 20260929-06, porters-connect の規約 -->

## 4. `company/` の構成

```text
company/
├── CLAUDE.md                    # 地図（第 5 節）。Vault 外
├── .claude/
│   ├── settings.json            # sandbox / permissions（templates/settings.json.tmpl から生成）
│   ├── settings.local.json      # 利用者個人の設定。gitignore。署名の agent のソケットの許可を置く（§7.2）
│   └── skills/                  # 業務 Skill（事業固有。business-os の外で育てる）
├── .business-os.json            # business-os の状態（initializing / active）、バージョン記録、onboard 実施日
├── .leak-dict.json              # 固有名詞の辞書（business-os の check:leak が読む）。gitignore
├── .gitignore  .gitattributes
├── docs/                        # Obsidian Vault root。人間が読むものは全部ここ
│   ├── .obsidian/               # 任意アダプタ（使う人だけ）
│   ├── charter/                 # 憲章。人間メンテ
│   │   ├── company.md           # 会社概要・方針・優先順位
│   │   ├── decision-rules.md    # 承認範囲・判断委譲ルール
│   │   ├── repositories/
│   │   │   ├── README.md        # 実装リポの一覧（OS 別パス）と、フォルダの使い方
│   │   │   └── <リポ名>/         # 実装リポを扱うときに CC が守ること（指示）。必要時に作成
│   │   └── businesses/<id>.md   # 事業ごとの定義・KPI
│   ├── proposals/               # 承認待ち。YYYYMMDD-nn-<slug>.md
│   ├── decisions/               # ADR。YYYYMMDD-nn-<slug>.md
│   ├── operations/
│   │   ├── obligations.md       # 期限・義務台帳
│   │   ├── risks.md             # リスク台帳
│   │   ├── state/<id>.md        # 事業別の現況
│   │   ├── daily/YYYY-MM-DD.md  # 日報（/morning が作り、全 Skill が実行記録を追記）
│   │   └── reviews/             # weekly-YYYY-Www / monthly-YYYY-MM / quarterly-YYYY-Qn / check-YYYYMMDD / retro-YYYYMMDD
│   ├── knowledge/               # 調査・SOP・育つ知識
│   │   └── repositories/<リポ名>/ # 実装リポについて調べたこと・作業の記録。必要時に作成
│   ├── inbox/                   # 人間の入口。attachments/ を含む
│   ├── dashboards/              # Bases 雛形（Obsidian 使用時）
│   ├── _templates/              # Obsidian のテンプレート（Obsidian 使用時）。フロントマター検査の対象外
│   └── archive/
├── data/                        # Markdown 以外（CSV 等）。Vault 外。必要時に作成
└── scripts/                     # 事業固有の自動化。Vault 外。必要時に作成
```

### 4.1 書き込み権限

| フォルダ | 人間 | AI 直接 | AI 提案経由 |
|---|---|---|---|
| `CLAUDE.md` `docs/charter/` | ○ | × | ○ |
| `docs/proposals/` | 読む・承認 | ○ | — |
| `docs/decisions/` | status 変更 | ○（起票） | — |
| `docs/operations/` `docs/knowledge/` `docs/dashboards/` | ○ | ○ | — |
| `docs/inbox/` | ○ | 整理を頼まれたときのみ | — |
| `docs/archive/` | — | 移動のみ | — |
| `.claude/settings.json` `.claude/settings.local.json` `.business-os.json` | ○ | × | ○ |

<!-- 根拠: 20260929-03, 20260929-05, 20261003-11 -->

### 4.2 実装リポの参照

シンボリックリンクは使わない。`docs/charter/repositories/README.md` にパスを書く。

```markdown
| 事業 | リポ | macOS | Windows | 用途 | 指示 |
|---|---|---|---|---|---|
| <id> | <name> | ~/workspace/<name> | %USERPROFILE%\workspace\<name> | 実装 | [指示](<name>/instructions.md) または 無し |
```

CC は必要時に該当パスを `--add-dir` で読み込む。置き場は「その内容が、実装リポの開発に要るか」で分ける。

| 置くもの | 置き場所 | 書き手 |
|---|---|---|
| 実装リポの開発に要るもの（コードの規約・構成・検査の方法） | 実装リポの中（AI で開発していれば実装リポの CLAUDE.md など） | 実装リポの開発者 |
| 実装リポを扱うときに CC が守ること（指示） | `docs/charter/repositories/<リポ名>/` | 人間（CC は提案経由） |
| 調べたこと・作業の記録（メモ） | `docs/knowledge/repositories/<リポ名>/` | CC も書く |

- `README.md` は毎セッション読む。`<リポ名>/` は、その実装リポを `--add-dir` で読み込む前に中をすべて読む
- `--add-dir` で加えたフォルダの CLAUDE.md は既定で読み込まれない。実装リポのコードを変える作業は、実装リポで CC を起動して行う

<!-- 根拠: 20260929-01, 20261003-07 -->

## 5. CLAUDE.md

### 5.1 `company/CLAUDE.md`（地図）

`templates/CLAUDE.md.tmpl` から `/onboard` が生成する。目安 40 行、上限 70 行（超過は `/check` が warn）。
書くのは 3 種のみ：自分は何者か、何がどこにあるか、絶対に守るルール。

書かないもの：Skill の手順、事業の中身、検査の一覧。

### 5.2 `business-os/CLAUDE.md`（開発ガイド）

business-os を改良する CC と、貢献する人向け。配布物と開発物の区別、設計原則の所在（ADR）、検査の正典、
ローカル検証、リリース手順、コミット規約。

<!-- 根拠: 20260929-02 -->

## 6. Skills

### 6.1 経営基盤 Skill（10 個、固定）

| Skill | 起動 | 読む | 書く（直接） | 提案（承認要） | 人に聞く |
|---|---|---|---|---|---|
| `/onboard` | 初回、事業追加、`--migrate` | business-os の `templates/` | `CLAUDE.md`、`charter/*`、`operations/obligations.md`、`.claude/settings.json`、`.business-os.json`、（選択時）`docs/.obsidian/` `dashboards/` `_templates/`、（署名を許したとき）`.claude/settings.local.json` | — | 会社概要、事業一覧、承認範囲、期限・義務、実装リポの場所、Obsidian 使用可否、KPI 候補の選択、コミットの署名の agent への接続 |
| `/approve` | 人間が呼ぶ | `proposals/`（`status: proposed`） | 提案の status、承認内容を `charter/` へ反映（permissions の ask が最終確認） | — | 承認 / 却下 / 修正 |
| `/check` | 週次 | business-os の検査定義、`company` 全体 | `operations/reviews/check-YYYYMMDD.md` | 設定の修正 | 異常時のみ |
| `/adr` | 判断時 | `charter/decision-rules.md`、関連 ADR | `decisions/YYYYMMDD-nn-*.md`（`proposed`） | — | 決定内容、accepted への変更 |
| `/morning` | 毎朝 | `charter/company.md`、`operations/state/*`、`obligations.md`、`proposals/`、前日の daily | `operations/daily/YYYY-MM-DD.md`（既存なら追記） | — | 優先順位 |
| `/weekly-review` | 週末 | 今週の daily、`state/*`、`decisions/` | `operations/reviews/weekly-*.md`、`state/*` | 来週の優先順位変更 | 時間配分の実績、来週の重点 |
| `/close` | 月初 | 今月の weekly、`data/`、`obligations.md` | `operations/reviews/monthly-*.md`（`as_of` 必須） | KPI 定義の見直し | 数値の入力・確認 |
| `/quarterly` | 四半期初 | 3 ヶ月分の monthly、`charter/businesses/*`、`risks.md` | `operations/reviews/quarterly-*.md`（`as_of` 必須） | 各事業の継続 / 縮小 / 撤退、`charter/` の更新、`verified` の更新 | 各事業の判断 |
| `/retro` | 週次 or 月次 | セッションログ、daily、reviews、Skill 実行回数 | `operations/reviews/retro-*.md` | business-os への改善（Skill 化・削除・CLAUDE.md 追記）、運用ルール変更 | 提案の優先度 |
| `/validate` | 新施策前 | `charter/company.md`、`decision-rules.md`、`risks.md` | `decisions/` に検証結果（ADR 形式） | 施策の開始 / 見送り | 仮説、検証方法、撤退条件 |

<!-- 根拠: 20260929-07 -->

### 6.2 共通規約

- 全 Skill の出力は統一フロントマター（第 9 節）を持つ
- 全 Skill は実行記録を当日の `operations/daily/` に 1 行追記する（`/retro` が実行回数を数える）
- `/approve` は本セッションで動かす。`context: fork` の中では AskUserQuestion が使えず、承認の質問ができないため
- `/quarterly` `/retro` は分析を作業者 `worker`（Agent ツール、`business-os:worker`）に委譲し、人への質問と書き込みは本セッションで行う。
  `context: fork` は使わない（質問ができず、既定のバックグラウンド実行では編集を `/rewind` で戻せないため）
- 主セッションは COO として、人との対話を含まない大きな作業を作業者に委譲する（ADR 20261002-01）。絶対ルールにはしない

| COO（主セッション）が自分で行う | 作業者 `worker` に委譲する |
|---|---|
| 人との対話を含むもの（質問、承認、確認）、1〜2 ファイルの小さな読み書き、判断そのもの | 多数のファイルの読み込みと要約、調査、下書きの大量の生成、並列にできる独立した作業 |

- SKILL.md の `description` は日本語でよい。`name` はフォルダ名と一致させる
- Skill 本文は「何をするか」「何を読むか」「何を書くか」「人に何を聞くか」「完了条件」の順で書く
- 「人に何を聞くか」は質問の表（番号・見出し・質問文・答えの形・選択肢・聞くとき）にする。見出しは 12 文字以内。
  聞き方（「質問 <何問目>/<見込みの数>：見出し（質問 ID：<表の番号>）」を付ける、質問文をそのまま使う、1 ターンに 1 問）は共通規約の「人への質問」に書く。
  `check:skills` が表を検査し、質問の流れの進行役は質問 ID で質問を見分ける（ADR 20261003-08、20261003-10、20261003-12）

### 6.3 業務 Skill

事業固有の Skill は `company/.claude/skills/` に置く。business-os の更新で消えない。
`/retro` が「同じ依頼が 2 回あった」を検出して Skill 化を提案し、月次で使われていないものを剪定提案する。
役割エージェントも同じく `company/.claude/agents/` で育て、事業非依存と分かったものだけを ADR を経て business-os に昇格させる（20261002-01）。
COO（主セッション）が `/retro` で「同じ視点のレビューを 2 回頼んだ」を検出して提案する。

### 6.4 周期 Skill の起動

最初は人間が手で呼ぶ。`/retro` が「毎回呼んでいる」と確認した Skill から Routines に移す。

## 7. 防衛

### 7.1 四重防衛

| 層 | 強制される場所 | 設定の所在 |
|---|---|---|
| 1. sandbox | OS | `company/.claude/settings.json` |
| 2. permissions | CC プロセス内 | 同上 |
| 3. PreToolUse hook | CC プロセス内（business-os） | `business-os/hooks/pre-tool-use.ts` |
| 4. 承認パイプライン | 運用 | `company/docs/proposals/` と `/approve` |

native Windows では sandbox が動かない（Claude Code の sandbox は macOS / Linux / WSL2 のみ対応）。
native Windows では第 2〜4 層の三重で動かし、軽い点検が毎セッション warn を出す。
`/onboard` は sandbox が使えない環境を検出したら、その事実を告げて続行の確認を取る。

<!-- 根拠: 20260929-05 -->

### 7.2 `settings.json` の必須規則（`templates/settings.json.tmpl`）

```jsonc
{
  "env": {
    "NODE_USE_ENV_PROXY": "1",
    "npm_config_cache": "${TMPDIR}/npm-cache",
    "DO_NOT_TRACK": "1"
  },
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "denyWrite": ["./docs/charter/**", "./CLAUDE.md", "./.claude/settings.json", "./.claude/settings.local.json", "./.business-os.json"],
      "denyRead": ["./.env", "./.env.*", "~/.ssh/**", "~/.aws/**", "~/.config/gh/**"]
    }
  },
  "permissions": {
    "deny": [
      "Read(./.env)", "Read(./.env.*)",
      "Bash(git push -f:*)", "Bash(git push --force:*)"
    ],
    "ask": [
      "Edit(./docs/charter/**)", "Edit(./CLAUDE.md)",
      "Edit(./.claude/settings.json)", "Edit(./.claude/settings.local.json)", "Edit(./.business-os.json)",
      "Bash(rm -rf:*)",
      "mcp__*__send_*", "mcp__*__post_*", "mcp__*__create_*", "mcp__*__pay_*",
      "mcp__*__*write*", "mcp__*__issue_write", "mcp__*__delete*", "mcp__*__update*", "mcp__*__merge*",
      "mcp__*__push*", "mcp__*__reply*", "mcp__*__forward*", "mcp__*__trash*", "mcp__*__untrash*",
      "mcp__*__add_*", "mcp__*__assign*", "mcp__*__dismiss*", "mcp__*__fork*", "mcp__*__manage*",
      "mcp__*__mark*", "mcp__*__unmark*", "mcp__*__request*", "mcp__*__star*", "mcp__*__unstar*",
      "mcp__*__*trigger*", "mcp__*__label_*", "mcp__*__unlabel_*", "mcp__*__apply_*", "mcp__*__move*",
      "mcp__*__copy*", "mcp__*__share*", "mcp__*__upload*", "mcp__*__respond*"
    ],
    "allow": [
      "Edit(./docs/operations/**)", "Edit(./docs/knowledge/**)",
      "Edit(./docs/proposals/**)", "Edit(./docs/decisions/**)",
      "Bash(git add:*)", "Bash(git commit:*)", "Bash(git status:*)", "Bash(git diff:*)",
      "Bash(git push:*)"
    ]
  }
}
```

- ファイルの規則は `Edit(...)` だけで書く。`Edit` はすべての書き込み系ツール（Write を含む）に効き、
  `Write(...)` 規則は判定に使われない（Claude Code が起動時に警告を出す）
- `allowUnsandboxedCommands: false` で、sandbox で失敗したコマンドを sandbox の外で再実行する逃げ道を塞ぐ。
  そのため `charter/` などを更新する `git pull` / `checkout` / `merge` は sandbox 内で失敗する。これらは人が実行する
- MCP の道具の確認の本命は hook（§7.3）。`ask` の MCP パターンは、hook が時間切れで通ったときの予備として、動詞で網をかけたもの。
  公式の GitHub MCP と Gmail のコネクタの書き換える道具をすべて拾い、読む道具を拾わないことをテストで確かめる（`test/scripts/template-mcp-ask.test.ts`）。
  MCP の規則は必須規則の照合（厳格モード）に含めず、`.claude/settings.json` に無い予備の規則は、起動時の点検と `/check` が warn で示す（含めると、足していない company で保護対象への書き込みが全て止まるため）。
  `/onboard` は接続済みの MCP の道具のうち外部に影響が出るものを具体名で足す（3 つ目の網）

<!-- 根拠: 20261006-02 -->
- `company`（非公開）への通常 `git push` は allow。force は deny（粗い網）と hook（本命）で止める
- sandbox のキー名は実装初日に公式ドキュメントで確認する
- `.claude/settings.local.json` は `.claude/settings.json` より優先され、sandbox の値を上書きできる。
  そのため保護対象に含め（`denyWrite` と `ask`、hook）、点検で上書きを見つける（§8）
- 署名付きコミットは、sandbox が署名の agent のソケットへの接続を止めるため失敗する。
  macOS では、`/onboard` が利用者の了承を得て、`.claude/settings.local.json` の `sandbox.network.allowUnixSockets` にそのソケット 1 つだけを書く。
  雛形には書かない（パスは利用者ごとに違う）。Linux / WSL2 にはパスごとの許可が無いため、Skill は署名で失敗したら止め、人にコミットを頼む

<!-- 根拠: 20261003-11 -->

- `env` の 3 つは、sandbox の許可（通信先・書き込み先）を広げずに、sandbox の中の Node 製の道具を動かすためのもの
  - `NODE_USE_ENV_PROXY`：Node の `fetch` は sandbox のプロキシの環境変数を使わず、許可した通信先にも届かない（`ENOTFOUND`）。
    プロキシを通せば、許可していない通信先では Claude Code の確認が出て、黙った失敗にならない
  - `npm_config_cache`：npm と `npx` のキャッシュを sandbox の一時フォルダに置く。`${TMPDIR}` は npm が展開する。
    `~/.npm/_npx` を書き込み可にすると、sandbox の外で動くコードを sandbox の中から書き換えられるため、書き込み先を広げない
  - `DO_NOT_TRACK`：skills CLI などのテレメトリを止める
- 通信先（`sandbox.network.allowedDomains`）は雛形に書かない。必要になったときに Claude Code の確認で人が許す
- 雛形の `env` が `.claude/settings.json` に無いか値が違えば、起動時の点検と `/check` が warn で示す（必須規則には含めない）

<!-- 根拠: 20261006-01 -->

### 7.3 `pre-tool-use.ts` の判定

#### 対象の判定（company の状態）

hook は入力の `cwd` から上位へ辿り、`.business-os.json` のあるディレクトリを company のルートとする
（git リポのルートで探索を止める）。見つからなければ company ではない。

| 状態 | 条件 | hook の振る舞い |
|---|---|---|
| 対象外 | `.business-os.json` が無い | 何も判定せず無言で通す（exit 0）。ログも書かない |
| 初期化中 | `state: initializing` | 保護対象の新規作成は通す。既存ファイルの上書きは `permissionDecision: "ask"` で人間に確認（`active` への切り替えもこれで 1 回確認される）。フロントマター検査と Bash 解析は有効 |
| 運用中 | `state: active` | 下の表のとおり（提案必須、deny、厳格モード） |

`/onboard` は最初の行動として `.business-os.json` を `state: initializing` で作り、完了時に `active` にする。
再実行（`--migrate`、事業追加）は運用中の扱いで、提案経由で行う。新規ファイルも提案の `target` にできる。

保護対象：`docs/charter/**`、`CLAUDE.md`、`.claude/settings.json`、`.claude/settings.local.json`、`.business-os.json`

#### 運用中の判定

| 対象 | 判定 | 結果 |
|---|---|---|
| 保護対象への Write / Edit | `proposals/` に `status: approving` かつ `target` がそのファイルの提案があるか | 無ければ exit 2、「先に提案を書き、/approve で承認を取れ」 |
| `docs/**` への Write / Edit | 編集後の内容を組み立て、フロントマターに 4 日付欄と `type` `business` `status` があり、日付が `YYYY-MM-DD` か `n/a` か | 欠落・相対日付・空欄は exit 2。Edit で組み立てに失敗し、`old_string` がフロントマターの範囲に触れていれば ask |
| 既存ファイルへの Write / Edit | `created` を書き換えていないか | 書き換えは exit 2 |
| Bash（拒否） | 引数を解析し、`git push` に force 系フラグ（`-f` / `--force` / `--force-with-lease` / `--force-if-includes`、位置不問）、`+` 付き refspec、`--no-verify` があるか | 該当は exit 2 |
| Bash（確認） | `rm -r*`、`git reset --hard`、`git clean -f*`、`git branch -D` | 該当は ask |
| Bash（共通） | `sh -c` / `bash -c` / `eval` の内側も同じ規則で解析する | — |
| MCP の道具（状態によらない） | 道具の名前（`mcp__<サーバー>__<道具>` の最後の部分）の先頭が `get_` / `list_` / `search_` / `read_` か、読むだけと確かめた道具の一覧（`hooks/lib/mcp.ts`）に入っているか | どちらでもなければ ask。名前の末尾では判定しない |
| 厳格モード | `state: active` かつ、`settings.json` の必須規則が欠けているか、`settings.local.json` が sandbox の必須の値を上書きしている・読めない場合 | 保護対象への Write / Edit を提案の有無に関わらず全拒否 |
| hook 自身の例外 | 判定中に例外 | **exit 2（fail-closed）** |

拒否は exit 2、確認は JSON 出力の `hookSpecificOutput.permissionDecision: "ask"` で返す。
どちらも auto mode で効くことを確認済み（第 11 節）。

hook は作業者（サブエージェント）のツール呼び出しにも、主の会話と同じく発火する（公式の仕様）。

全判定を `company/.claude/hook-log-YYYYMM.jsonl` に 1 行ずつ記録する（月次でファイルを分ける。gitignore）。

hook の `matcher` は `Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|mcp__.*`。hook が時間切れになると Claude Code は呼び出しを通すので、
MCP の道具は `permissions.ask` の予備の規則（§7.2）でも止める。

<!-- 根拠: 20260929-05, 20260930-01, 20261006-02 -->

### 7.4 提案ファイル

```yaml
---
id: 20260930-01
type: proposal
business: portfolio
status: proposed          # proposed → approving → approved | rejected
target: docs/charter/company.md
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
---
## 背景
## 変更内容
## 差分
## 根拠の鮮度（参照した文書の as_of / updated）
```

status を変えるのは `/approve` だけ。`approving` のまま 24 時間超は軽い点検が検出する。

### 7.5 `/approve` の流れ

1. 提案一覧と差分を提示 → 人間が「承認」
2. status を `approving` に → Edit を実行 → permissions の ask で人間が最終確認
3. status を `approved` に → 提案ファイルは履歴として残る

人間の判断は 2 回。

### 7.6 Git 側の制御

- `business-os`（公開）：GitHub ruleset で force push 禁止、`main` への直接 push 禁止。
  設定済み（2026-09-30）：ruleset `protect-main`（deletion / non_fast_forward / pull_request）、
  PR 作成はコラボレーター限定、既定ブランチ `develop`、Secret Scanning と Push Protection 有効
- `company`（非公開）：プランが許せば同じ ruleset。使えない場合は pre-push hook（Node）で補う
- `company` は force push を必要としない運用。必要になったら CC を介さず人間が判断する

## 8. セルフチェック

### 8.1 軽い点検（`hooks/session-start.ts`）

毎セッション、1 秒未満、読むだけ、全部 OK なら無言。項目は ADR 20260929-06 の表を正典とする。
`.business-os.json` が無いディレクトリでは何もしない（company ではないため）。
`state: active` で項目 4（`settings.json` の必須規則）が異常なら厳格モードに入る。
`settings.local.json` が `sandbox.enabled` か `allowUnsandboxedCommands` を上書きしている、または読めない場合も、項目 4 の異常として扱う。
`settings.local.json` が `allowAllUnixSockets` を有効にしている、または `excludedCommands` が空でない場合は warn を出す（厳格モードにはしない）。
sandbox が使えない環境（native Windows 等）は厳格モードにせず、毎セッション warn を出す。

### 8.2 重い点検（`/check` → `scripts/check.ts`）

週次。判定は pass / warn / fail、全体は終了コード。出力は `operations/reviews/check-YYYYMMDD.md`。
分類は ADR 20260929-06 の表を正典とする。「設定がある」ではなく「効いている」を確認する
（hook への合成入力、sandbox への書き込み試行）。
「設定の一致」では、`settings.local.json` による上書き（fail）と広い緩め（warn）も見て、
`allowUnixSockets` で許したソケットのパスを一覧で示す（判定はしない）。

`/doctor prompt-audit` は範囲を company の指示ファイルに限定して呼ぶ（`/doctor prompt-audit ./CLAUDE.md` 等）。
範囲を指定しないと利用者の `~/.claude` 配下まで監査し、その中身がレポート経由で company に入るため。
レポートには要約（件数と対象ファイル）だけを書く。所要時間は数分かかる。

### 8.3 business-os のバージョン記録

`/onboard` は `company/.business-os.json` に business-os の状態・バージョン・実施日を書く。

```json
{ "state": "active", "pluginVersion": "0.1.0", "onboardedAt": "2026-10-01", "migratedAt": "n/a" }
```

軽い点検は Plugin の実バージョンと照合し、不一致なら `/onboard --migrate` を促す。

<!-- 根拠: 20260929-06 -->

## 9. フロントマター規約

`company/docs/**` の全 Markdown 文書と、business-os の `docs/adr/`・`docs/design/` に以下を持つ。定義は `templates/frontmatter.schema.json`。
business-os の利用者向けの文書（`docs/usage/`）と開発者向けの入口（`docs/README.md`）には付けない（GitHub が表として描き、マニュアルが読みにくくなるため）。

```yaml
---
type: charter | proposal | decision | daily | review | state | ledger | knowledge | inbox
business: portfolio | <事業ID> | n/a   # n/a は business-os の文書のみ
status: <type ごとに定義>
created: YYYY-MM-DD
updated: YYYY-MM-DD
as_of: YYYY-MM-DD | n/a     # 数値を扱う文書（review の monthly / quarterly）は必須
verified: YYYY-MM-DD | n/a  # charter は必須
---
```

| type | status の値 |
|---|---|
| charter | active / superseded |
| proposal | proposed / approving / approved / rejected |
| decision | proposed / accepted / rejected / superseded |
| daily | active |
| review | active |
| state | active / paused / closed |
| ledger | active |
| knowledge | draft / active / archived |
| inbox | unsorted |

- 4 日付欄は省略しない。該当なしは `n/a`
- `ledger` は台帳（`operations/obligations.md`、`operations/risks.md`）
- business-os の ADR（`docs/adr/`）は `type: decision`。business-os の ADR と構造仕様は `business: n/a` を使える
- 雛形の置き場（business-os の `templates/`、company の `docs/_templates/`）は検査の対象外（置き換え記号を含むため）。
  hook のフロントマター検査、`/check`、business-os の `check:docs` のいずれも対象にしない
- ID を持つ文書（decisions / proposals / business-os の adr）は `id: YYYYMMDD-nn` を追加し、ファイル名と一致させる
- リンクは標準 Markdown（`[text](relative/path.md)`）。`[[wikilink]]` は使わない

<!-- 根拠: 20260929-09 -->

## 10. Obsidian アダプタ

### 10.1 位置づけ

推奨だが任意。business-os の機能に関与しない。無くても、あっても、Skill と hook の挙動は同じ。

### 10.2 `adapters/obsidian/` の構成

```text
adapters/obsidian/
├── README.md              # 導入・Windows 構成（第 10.5 節の方針）・撤退
├── vault/                 # company/docs/.obsidian/ にコピー
│   ├── app.json  core-plugins.json  daily-notes.json  templates.json  graph.json  appearance.json
├── bases/                 # company/docs/dashboards/ にコピー
│   ├── proposals.base  decisions.base  state.base  freshness.base  reviews.base
└── templates/             # company/docs/_templates/ にコピー
    ├── inbox-note.md      # 人間が手で書くメモの雛形
    └── daily-note.md      # Daily Notes の雛形（人間が先に日報を開いてもフロントマター付きになる）
```

### 10.3 主要設定

| 設定 | 値 |
|---|---|
| Vault root | `company/docs/` |
| リンク形式 | 標準 Markdown、相対パス（`useMarkdownLinks: true`） |
| 新規ノート | `inbox/` |
| テンプレートの置き場 | `_templates/`（`templates.json`。検索とグラフからは除く） |
| 添付ファイル | `inbox/attachments/` |
| Daily Notes | `operations/daily/YYYY-MM-DD.md`（`/morning` と同じファイル。`/morning` は既存なら追記）。雛形は `_templates/daily-note` |
| コアプラグイン | file-explorer, global-search, switcher, graph, backlink, outgoing-link, tag-pane, properties, daily-notes, templates, bases, canvas, command-palette, outline, bookmarks |
| コミュニティプラグイン | ゼロ（利用者が任意で追加） |
| グラフの色 | フォルダ別（charter / proposals / decisions / operations / knowledge / inbox） |
| Git 除外 | `.obsidian/workspace.json` `workspace-mobile.json` `cache/` |

Bases の雛形は第 9 節のフロントマターだけを前提にする。

### 10.4 `/onboard` の Obsidian 分岐

1. 「ナレッジの閲覧に Obsidian を使いますか？（推奨）」
2. はい → OS 判定 → 未インストールなら承認を取り、macOS は `brew install --cask obsidian`、
   Windows は `winget install --id Obsidian.Obsidian --exact --accept-source-agreements --accept-package-agreements`。
   Homebrew / winget が無ければ手動インストールを案内。
   **インストールはこの質問の直後に行う**（`.claude/settings.json` を書いた後は company の sandbox がインストールを止めるため）
3. `vault/` を `docs/.obsidian/` に、`bases/` を `docs/dashboards/` に、`templates/` を `docs/_templates/` にコピー。
   `.gitignore` に除外を追記。`.claude/settings.json` より前に書く
4. 人間に Obsidian を起動してもらい（`! open -a Obsidian` か手で。sandbox がアプリの起動を止めるため CC は起動しない）、
   「保管庫としてフォルダを開く（Open folder as vault）」で `company/docs` を選ぶよう 1 回だけ案内する。
   `obsidian://open?path=` は未登録のフォルダを開けないため使わない
5. 初回起動時の確認ダイアログは人間が押す

「いいえ」を選んだ場合、Obsidian 関連ファイル（`docs/.obsidian/`・`docs/dashboards/`・`docs/_templates/`）を一切生成しない。

### 10.5 Windows

| 構成 | 位置づけ | 防衛 | Obsidian |
|---|---|---|---|
| WSL（WSL2） | 既定の推奨。macOS と同一手順 | 四重 | 使わない |
| ネイティブ Windows | Obsidian を使う場合の選択肢 | 三重（第一層の sandbox が無い） | 使う。`company` を Windows 側に置く |

- ネイティブ Windows では OS レベルの防衛（第一層）が無く、憲章の保護は hook と permissions に依存する。
  利用者向け文書と `adapters/obsidian/README.md` にこの事実を明示する
- WSL 上の `company` を Windows の Obsidian で開く構成は案内しない（ファイルシステム境界の問題）
- `/onboard` は sandbox が使えない環境を検出したら、その事実を告げて続行の確認を取る

### 10.6 撤退

`company/docs/.obsidian/` と `docs/dashboards/*.base` を消すだけ。文書は変わらない。

## 11. 実装時の検証項目

設計時点で「そのはず」に留まる事項。実装初日に確認し、結果を ADR か本文書に反映する。

確認日：2026-09-30。環境：macOS、Node 24.3.0、Claude Code 2.1.280（項目 12 のみ 2.1.285）、Obsidian 1.13.7。
CI：GitHub Actions の ubuntu-latest / windows-latest / macos-latest（Node 24.20〜24.21）。

| # | 検証 | 影響する箇所 | 結果 |
|---|---|---|---|
| 1 | `node hooks/xxx.ts` が macOS / Windows で直接動くか（Node 24） | 第 3.2 節 | 合格。3 OS とも終了コード 0、フラグ・警告なし |
| 2 | `hooks.json` の `${CLAUDE_PLUGIN_ROOT}` 展開と、Plugin hook が `company` で発火するか | 第 7 節 | 合格。展開され、SessionStart / PreToolUse が company の `cwd` で発火。exit 2 で拒否、`permissionDecision: "ask"` で確認。パスは二重引用符で囲む |
| 3 | sandbox のキー名（`filesystem.denyWrite` 等）が現行仕様と一致するか | 第 7.2 節 | 合格（macOS）。`denyWrite` への書き込みと `denyRead` の読み取りが拒否された。native Windows は sandbox 非対応（公式）。逃げ道を塞ぐ `allowUnsandboxedCommands: false` を追加 |
| 4 | permissions の `ask` が auto mode でも人間に確認を出すか | 第 7.5 節 | 合格。permissions の ask と hook の ask の両方で確認が出た。`Write(path)` 規則は判定に使われず `Edit(path)` が全書き込みツールに効く |
| 5 | `claude plugin validate` が通るか | 第 3.3 節 | 合格（終了コード 0。`author` 欠落の warn のみ） |
| 6 | `claude --plugin-dir .` でローカルの business-os を読み込めるか | CLAUDE.md（開発） | 合格 |
| 7 | `obsidian://open?path=` で未登録の Vault を開けるか | 第 10.4 節 | 不合格。未登録のフォルダは開けない（Vault 登録なしの初期状態でも同じ）。インストール直後は一度起動するまで URL 自体が登録されない。第 10.4 節を「Open folder as vault」の案内に変更 |
| 8 | Windows ネイティブで `brew` 相当の `winget` インストールが承認プロンプト以外の操作を要求しないか | 第 10.4 節 | 部分確認（実機は保留）。CI（管理者権限）で、フラグなしは `msstore` ソースの規約同意で中止、`--accept-source-agreements --accept-package-agreements` 付きは確認なしで成功（ユーザー領域にインストール）。UAC の挙動は未確認 |
| 9 | Node の TS 直接実行で `import` の拡張子（`.ts`）が必須か | 第 3.2 節 | 必須。拡張子なしは `ERR_MODULE_NOT_FOUND`。`enum` は Node と tsc の両方が拒否 |
| 10 | Skill の呼び出し名と名前空間の挙動 | 第 6 節、利用者文書 | 条件付き合格。衝突がなければ短い名前で呼べる。利用者の Skill と同名なら利用者側が優先され、`/business-os:<name>` で business-os の Skill を呼べる |
| 11 | `context: fork` 内からの質問と ask が人に届くか | 第 6.2 節 | ask は届く。AskUserQuestion は fork 内で使えない（バックグラウンド・フォアグラウンドとも）。第 6.2 節を変更 |
| 12 | `/doctor prompt-audit` を非対話で実行できるか | 第 8.2 節 | 合格（2.1.283 以降）。`claude -p` で終了コード 0、ファイルは変更しない。範囲未指定だと `~/.claude` まで監査するため範囲を指定する。所要約 6 分 |

## 12. 用語

| 用語 | 意味 |
|---|---|
| business-os | 事業非依存の Plugin。利用者ごとの company と対になる |
| company | 利用者ごとの事業データリポ |
| 憲章（charter） | 会社が何者で、何をどう決めるかを人間が定めた文書群 |
| 提案（proposal） | AI が憲章の変更や外部行動を求める下書き。承認待ち |
| ADR | 設計判断記録。business-os では `docs/adr/`、company では `docs/decisions/` |
| 軽い点検 / 重い点検 | 毎セッションのセルフチェック / 週次の `/check` |
| 厳格モード | 運用中の company で防衛設定の欠落を検出したとき、hook が保護対象への書き込みを全拒否する状態 |
| 経営基盤 Skill / 業務 Skill | 事業非依存で business-os に含まれる 10 個 / 事業固有で company 側に育てるもの |
| 2 回ルール | 同じ依頼が 2 回目になったら Skill 化を検討する運用 |
