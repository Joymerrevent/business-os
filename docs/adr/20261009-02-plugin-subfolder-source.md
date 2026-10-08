---
id: 20261009-02
title: 配布物を plugin/ に集め、マーケットプレイスの source をそのフォルダに向けて、開発物を利用者に配らない
type: decision
business: n/a
status: proposed
created: 2026-10-09
updated: 2026-10-09
as_of: 2026-10-09
verified: n/a
supersedes: n/a
---

# 20261009-02: 配布物を plugin/ に集め、マーケットプレイスの source をそのフォルダに向けて、開発物を利用者に配らない

## 背景と問い

business-os は、リポジトリ自身がマーケットプレイスと Plugin を兼ねている（[ADR 20260929-10](20260929-10-plugin-from-day-one.md)）。
`.claude-plugin/marketplace.json` の `source` は `"./"` で、Plugin の導入はリポジトリ全体を利用者の環境に写す。

Claude Code の公式の文書では、導入で写るのは `source` が指すフォルダだけで、ファイルを除外する仕組み（`.claudeignore` や `files` の欄）は無い（2026-10-09 に確認）。
そのため、[構造仕様の 3.1 節](../design/architecture.md#31-配布物と開発物)が「開発物」と分けている `docs/` `test/` `evals/` `fixtures/` `.claude/` と、
ADR 20261008-01（PR #82、proposed） で足す `dev-autopilot/` も、すべて利用者に配られている。

2026-10-09 時点の大きさは、配布物（`.claude-plugin/` `skills/` `agents/` `hooks/` `scripts/` `templates/` `adapters/`）が約 0.5 MB、
開発物（`docs/` `test/` `evals/` `fixtures/` `dev-autopilot/`）が約 1.7 MB で、配られるものの 3 分の 2 以上が利用者に関係の無いファイルである。
動作には影響しないが、利用者の環境に開発用のテスト・eval の台本・設計文書が置かれ、Plugin の中身を読む利用者を迷わせる。
1.0 で公式ディレクトリへの提出を検討する（ROADMAP）前に、配布物を利用者に要るものだけに絞るかを決める。

## 判断の基準

- 利用者の環境に写るのが、Plugin の動作に要るものだけであること
- 利用者の導入の手順（`/plugin marketplace add` → `/plugin install` → `/onboard`）と、導入済みの利用者の更新が変わらないこと
- 開発の手順（`claude --plugin-dir`、`pnpm check`、eval、`/release`）が 1 か所のパスの変更で追従できること
- 構造仕様の「配布物と開発物」の区別が、フォルダの構造そのものになること（説明でなく仕組みで守る）
- 変更が 1 回の実装 PR で終わり、以後は増えないこと

## 検討した案

- 案 A：配布物を `plugin/` に集め、`marketplace.json` の `source` を `"./plugin"` に向ける。開発物はリポジトリ直下に残す
- 案 B：現状のまま（リポジトリ全体を配る）
- 案 C：リリース時に配布物だけの書庫（zip）を作り、`source` を `archive` 型で GitHub の Release の資産に向ける
- 案 D：別のリポジトリに配布物だけを置き、リリース時に写す

## 決定

採用：**案 A**。導入が `source` のフォルダだけを写す公式の仕組みをそのまま使い、構造の区別をフォルダにする。

1. **フォルダ**：リポジトリ直下に `plugin/` を作り、配布物をそこへ移す
   - 移すもの：`.claude-plugin/plugin.json`、`skills/`、`agents/`、`hooks/`、`scripts/`、`templates/`、`adapters/`
   - 残すもの：`.claude-plugin/marketplace.json`（マーケットプレイスの発見はリポジトリ直下の `.claude-plugin/` で行われるため）、`.claude/`、`docs/`、`test/`、`evals/`、`fixtures/`、
     `dev-autopilot/`、`package.json` と設定ファイル群、README・CONTRIBUTING などリポジトリの文書
2. **marketplace**：`marketplace.json` の `source` を `"./plugin"` にする。Plugin の名前（`business-os`）と導入の手順は変えない。導入済みの利用者は、次の更新で自動的に新しい構造を受け取る
3. **パスの追従**：`hooks/hooks.json` の `${CLAUDE_PLUGIN_ROOT}/hooks/…` は Plugin の中の相対パスなので変えない。変えるのは開発側のパスだけ
   - `claude --plugin-dir ./plugin`（CLAUDE.md、CONTRIBUTING、eval の起動 `evals/lib/dialogue/run.ts`）
   - `test/helpers.ts` の `CLAUDE_PLUGIN_ROOT` を `plugin/` に
   - `scripts/sync-plugin-version.ts` の書き先と `package.json` の `release:version` を `plugin/.claude-plugin/plugin.json` に
   - `check:*`（`scripts/check-repo.ts`、`hooks/lib/plugin.ts` の Skill の一覧、`scripts/report.ts`）が `skills/` などを見ている箇所を `plugin/` 配下に
   - `scripts/` は配布物なので `plugin/scripts/` に移る。`package.json` の `check:*` は `node plugin/scripts/check-repo.ts …` の形になる
4. **検査**：`claude plugin validate ./plugin` が通ること、`claude --plugin-dir ./plugin` で Skill・agent・hook が動くこと、
   `/plugin marketplace add <このリポのパス>` → `/plugin install business-os` で `plugin/` だけが写ることを、実装の PR で実機で確かめる。`pnpm check` と eval の煙試験も通す
5. **文書**：[構造仕様の 3.1 節](../design/architecture.md#31-配布物と開発物)の表を「`plugin/` の下が配布物、それ以外が開発物」に書き換え、3 節のフォルダの一覧も直す。
   CLAUDE.md の「何がどこにあるか」を `plugin/` の形に直す。利用者向けの `docs/usage/` は導入の手順が変わらないので直さない
6. **accepted の ADR のパス**：既存の ADR の本文に書かれた `skills/` `hooks/` などのパスは、決めた当時のまま残す（accepted の ADR は書き換えない）。
   構造仕様 3.1 節に「2026-10 以前の ADR のパスは `plugin/` を省いた当時の形」と 1 行書く
7. **時期**：0.x の間に 1 回で行う。1.0 の公式ディレクトリへの提出の検討より前に済ませる。dev-autopilot の実装（ADR 20261008-01（PR #82、proposed））とは独立で、どちらが先でもよい

## 影響

- 良い影響
  - 利用者の環境に写るのが配布物だけになる（約 0.5 MB。開発物の約 1.7 MB が消える）
  - 配布物と開発物の区別がフォルダになり、「配布物に入れない」という規則を構造で守れる。dev-autopilot のような開発物を足すときに配布の心配が要らない
  - 公式ディレクトリへの提出の検討で、Plugin の中身を説明しやすい
- 悪い影響
  - 1 回の大きな移動の PR が要る。パスを参照する約 20 のファイル（検査・テスト・eval・リリースの手順・文書）を直す
  - 移動のコミットは履歴の追跡が切れやすい（`git log --follow` で追う）
  - `scripts/` が `plugin/scripts/` になり、`pnpm check` の起動パスが 1 段深くなる
- その他
  - 既存の ADR に書かれたパスと実物がずれる。構造仕様の 1 行で読み替えを示す
  - 導入済みの利用者の `${CLAUDE_PLUGIN_ROOT}` は、更新後に `plugin/` の中を指す。利用者の作業は要らない（実装の PR で実機で確かめる）

## 案ごとの長所と短所

### 案 A：`plugin/` に集めて `source` を向ける

- 長所：公式の仕組みだけで済む。構造が区別そのものになる。導入の手順も更新も変わらない
- 短所：移動の PR が大きい。既存の ADR のパスと実物がずれる

### 案 B：現状のまま

- 長所：変更が無い
- 短所：開発物を配り続ける。開発物が増えるほど配布物が膨らむ。「配布物に入れない」を説明でしか守れない

### 案 C：リリース時に書庫を作って `archive` 型で配る

- 長所：フォルダを動かさずに配布物だけを選べる
- 短所：`source` が版ごとの URL になり、リリースのたびに `marketplace.json` を書き換えて `main` に入れる手順が増える。
  git からの導入（ブランチの指定、開発中の版の試用）ができなくなる。書庫の作成という新しい仕組みを CI に足す

### 案 D：配布専用の別リポジトリ

- 長所：配るものを完全に分けられる
- 短所：2 つのリポジトリの版と中身の一致を保つ仕組みが要る。1 人で開発する規模に合わない

## 参考

- [ADR 20260929-10](20260929-10-plugin-from-day-one.md)（最初から公開 Plugin。マーケットプレイスと Plugin をリポジトリが兼ねる）
- ADR 20261008-01（PR #82、proposed）（`dev-autopilot/` を配布物に含めない。配布を絞る判断はこの ADR へ）
- [構造仕様 3.1 節](../design/architecture.md#31-配布物と開発物)
- Claude Code 公式の文書：marketplace の `source`（相対パスはそのフォルダだけを導入する。`git-subdir` 型は `path` で部分取得。除外の仕組みは無い）
- ROADMAP の 1.0（公式ディレクトリへの提出の検討）
