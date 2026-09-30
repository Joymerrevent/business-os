---
id: 20260930-01
title: Bash の文字列規則は粗い網
type: decision
business: n/a
status: proposed
created: 2026-09-30
updated: 2026-09-30
as_of: n/a
verified: n/a
supersedes: n/a
---

# 20260930-01: Bash の文字列規則は粗い網

## 背景

CC の permissions にある Bash 規則（例：`Bash(git push -f:*)`）は、コマンド文字列の前方一致で
判定する。コマンドの意味を理解しているわけではない。

| 実際のコマンド | `Bash(git push -f:*)` で拒否されるか |
|---|---|
| `git push -f origin main` | 拒否される |
| `git push origin main -f` | **通る**（フラグが後ろ） |
| `git push origin +main` | **通る**（`+` 付き refspec は force と同義） |
| `sh -c "git push -f"` | **通る**（外側しか見えない） |
| git alias 経由 | **通る**（展開前の文字列で判定） |

公式ドキュメント自身が、Bash 規則は同じプログラムを別の書き方で呼ばれると通ってしまうため
セキュリティ境界にはならないと明記している。さらに 2026-03 の調査で、サブコマンド数が上限を超えると
deny 規則が権限プロンプトへフォールバックする挙動が報告された。

## 決定

1. permissions の Bash 規則は **粗い網**として使う。典型的な形を安く止めるためのもので、
   「これで守れている」とは考えない
2. 本命は 2 つ
   - **hook の意味解析**：PreToolUse hook（TS）が Bash コマンドの引数を解析し、
     `git push` に `-f` / `--force` / `--force-with-lease` / `--force-if-includes`（位置を問わない）、
     `+` 付き refspec、`--no-verify` があれば拒否。`sh -c` / `bash -c` / `eval` の内側も解析する
   - **サーバー側の制御**：GitHub の ruleset / branch protection で force push を禁止。
     CC がどんな書き方をしても GitHub が受け付けない
3. 補助として `company` の git に pre-push hook（Node）を置き、force push を弾く。
   CC 以外（人間の手打ち）にも効く
4. `company` では **force push を一切必要としない運用**にする。履歴を書き換えたい状況が来たら、
   CC を介さず人間が手で判断する

この方針は force push に限らない。破壊的コマンドも同じ構造で守る。

| 判定 | 対象 |
|---|---|
| 拒否（exit 2） | `git push` の force 系フラグと `+` 付き refspec、`--no-verify` |
| 確認（ask） | `rm -r*`、`git reset --hard`、`git clean -f*`、`git branch -D` |

## 根拠

- 文字列一致の抜け穴は網羅できない。書き方は無限にある
- 引数解析は有限の意味（force か否か）を判定するので、書き方に依存しない
- サーバー側の制御は CC の外にあり、CC のバグや回避に影響されない。最も確実
- 検討した代替案：Bash 規則を網羅的に列挙する → 列挙が古くなり、新しい書き方に追従できない。不採用

## 影響

- hook に Bash コマンド解析（シェル引数のトークナイズ）が入る。テスト（20260929-06）で
  上記の表の各行を検証する
- GitHub の ruleset / branch protection は、非公開リポでは有料プランが必要な場合がある。
  `business-os`（公開）は無料で設定できる。`company`（非公開）はプランを確認し、
  使えない場合は hook と pre-push hook で補う
- `--force-with-lease` も拒否対象に含める。`company` では force が不要という前提を優先する

## 参考

- Claude Code 公式：permissions の Bash 規則の限界に関する記述
- SC Media / Adversa（2026-03）：サブコマンド上限超過で deny がフォールバックする報告
- 関連 ADR：20260929-05（四重防衛）、20260929-06（検査）
