# business-os — 開発ガイド

これは配布される Claude Code Plugin。1 人で複数事業を運営する人が CC を「経営の手足」として使う business-os。
**事業情報・人名・認証情報は一切含めない。** 見つけたら即報告し、コミットしない。

## 何がどこにあるか

- `skills/`          配布される経営基盤 Skill 10 個。増やさない（増やすなら ADR）
- `agents/`          作業者エージェント `worker` だけ。役割エージェントは同梱しない（ADR 20261002-01）
- `hooks/`           SessionStart（軽い点検）と PreToolUse（書き込みガード）。TypeScript
- `scripts/`         重い点検（`/check`）と `check:*` の共有実装、バージョン同期
- `templates/`       company の雛形。`/onboard` が展開する
- `evals/`           Skill の動作の検証。`claude plugin eval` のケースと、質問の流れを確かめる進行役（配布物の動作には関与しない）
- `adapters/obsidian/` 任意アダプタ。business-os の機能に関与しない
- `docs/adr/`        設計判断。**ここが正典**。`docs/design/architecture.md` が構造仕様
- `docs/usage/`      利用者向け。ADR 番号を書かない
- `.claude/`         business-os を開発するときの設定と開発専用 Skill（配布しない）

## 絶対ルール

1. `docs/adr/` の判断に反する変更をしない。変えたいなら ADR を `proposed` で起票する。
   **CC が単独で `accepted` にしない。** メンテナが確認して変える
2. bash スクリプトを追加しない。hook / scripts は TypeScript、Node 24 が直接実行する。
   `enum` `namespace` など Node が剥がせない構文は tsc が弾く。
   例外は `evals/` の `scaffold.sh` だけで、中身は `exec node` の 1 行（`check:shell` が検査する）
3. シンボリックリンクを使わない。パスは相対、改行は LF。
   Markdown のリンクは標準の inline 形式（`[text](path)`）。利用者個人の全体ルールよりこのリポの規約を優先する
4. ADR と構造仕様（`docs/adr/` `docs/design/`）のフロントマターに 4 日付欄（created / updated / as_of / verified）を必ず持つ。
   該当なしは `n/a`。利用者向けの `docs/usage/` と入口の `docs/README.md` には付けない
5. 検査は `pnpm check` が正典（`package.json` の `check:*`）。成否は終了コードで見る。Done の数を数えない
6. 公開済みコミットの履歴を書き換えない。Conventional Commits

## 開発の入り方

1. `docs/adr/README.md` の一覧で現在の設計原則を確認する
2. 触る箇所に対応する ADR と `docs/design/architecture.md` の該当節を読む
3. 変更 → `pnpm check` が緑 →（Skill・雛形・hook を変えたら）Skill の動作の検証 → changeset を書く → PR（`develop` 向け）

## ローカル検証

- `claude --plugin-dir .` でこのリポを Plugin として読み込む
- 検証用の company 相当リポ（`test/fixtures/company/`）で `/onboard` から動かす
- hook の fail-closed テスト：`pnpm test`
- Skill の動作：`pnpm eval:cases`（eval のケース）と `pnpm eval:dialogue`（質問の流れ）。
  Skill・雛形・hook を変えた PR では CC が実行し、結果の要約を PR 本文に書く。実行のたびにメンテナの利用枠を消費する。
  記録は `evals/results/`（追跡しない）。`/check` は Bash が要るため eval の対象外（判定のロジックは vitest で検査する）

## リリース

`/release`（`.claude/skills/release/`）：changeset → version → `plugin.json` 同期 → CHANGELOG → `main` へのリリース PR →
タグ `business-os--v<版>` → GitHub の pre-release。タグの push と Release の公開は、実行の前にメンテナに確認する。
0.x は開発中。1.0 で公式ディレクトリ提出を検討する。

## 迷ったら

「business-os に固有名詞を書いていないか」「その変更は ADR に反しないか」の 2 つを先に確かめる。
判断が要るなら、実装せずにメンテナに聞く。
