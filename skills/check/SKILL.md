---
name: check
description: business-os の安全装置が「存在するか」ではなく「効いているか」を試し、文書の規約・鮮度・リンク・漏洩・git の状態をまとめて点検する。週に 1 回と、導入の直後に使う。
disable-model-invocation: true
---

# /check

## 何をするか

business-os の点検スクリプトを company に対して実行し、結果を `docs/operations/reviews/check-YYYYMMDD.md` に残す。
判定は pass / warn / fail。全体の成否はスクリプトの**終了コード**で判断する（出力の件数を数えない）。

- 終了コード 0：fail なし（warn はあってよい）
- 終了コード 1：fail あり
- 終了コード 2：点検そのものが動かなかった

## 何を読むか

1. `${CLAUDE_SKILL_DIR}/../../templates/skill-conventions.md`（共通規約。最初に必ず読む）
2. 点検スクリプトの出力と、書き出されたレポート

## 手順

1. company のルートで、次のコマンドを **Bash ツールで単独で**実行する（sandbox の中で実行することで、sandbox が効いているかも試す）

   ```bash
   node "${CLAUDE_SKILL_DIR}/../../scripts/check.ts" --company .
   ```

2. 終了コードを確かめる。0 以外なら、fail の項目を人間に示す
3. 本物の Claude Code での発火試験もするか聞く。案内文：
   「本物の Claude Code（claude -p）で、business-os の hook が実際に動くかも試しますか。利用枠を消費します。所要は数十秒です」
   - 試す場合：business-os のルートと company のルートを絶対パスで確かめ（`cd "${CLAUDE_SKILL_DIR}/../.." && pwd` と `pwd`）、
     人間に次の 1 行を**入力欄で `!` 付きで実行してもらう**（sandbox の中からは claude -p が hook を起動できないため、CC は自分で実行しない）

     ```text
     ! node "<business-os のルート>/scripts/check.ts" --company "<company のルート>" --live
     ```

   - この試験は company の一時コピーで行い、company そのものには触れない
   - 結果（fail / warn）は点検レポートの末尾に「## 実機での発火試験」として追記される。fail があれば最優先で扱う。
     force push の項目が warn（モデルが実行を控えた）なのは許容する
4. `/doctor prompt-audit`（指示ファイルの古さ・矛盾の監査。数分かかる）も実行するか聞く
   - 実行する場合：範囲を company の指示ファイルに限って呼ぶ（`/doctor prompt-audit ./CLAUDE.md`）。
     範囲を指定しないと利用者の `~/.claude` 配下まで読み、その内容がレポートに入ってしまうため、必ず範囲を付ける
   - Skill ツールから呼べない場合は、人間に `/doctor prompt-audit ./CLAUDE.md` の実行を頼む
   - 結果は**要約だけ**（指摘の件数と対象ファイル）をレポートの末尾に「## 指示ファイルの監査」として追記する
5. fail と warn の対処を、下の表に沿って人間に示す。直すかどうかは人間が決める

| 分類 | fail / warn のときの対処 |
|---|---|
| 防衛の発火（合成入力・実機） | 最優先。安全装置が壊れた状態で運用を続けない。business-os の不具合なら business-os のリポジトリの Issues に報告する |
| 設定の一致 | `.claude/settings.json` の規則を雛形どおりに戻す提案を書く（`/approve` で反映） |
| 文書の規約 | 該当する文書のフロントマターを直す（憲章なら提案として書く） |
| 鮮度 | 憲章は `/quarterly`、現況は `/weekly-review`、決定記録は人間が accepted / rejected を決める |
| リンク | リンク先を直すか、リンクを消す |
| 漏洩 | 秘密が追跡されていたら、すぐ人間に知らせる。履歴の書き換えは CC は行わない |
| Git | 未コミットの変更を片付ける。`git pull` などは人間が行う |
| 指示ファイル | CLAUDE.md が長ければ、手順を Skill に、事実を `docs/` に移す提案を書く |

## 何を書くか

- `docs/operations/reviews/check-YYYYMMDD.md`（点検スクリプトが書く。prompt-audit の要約は CC が追記する）
- 直すと決まったものの修正、または提案
- 日報への実行記録（例：`- 18:00 /check — fail 0、warn 2`）

## 人に何を聞くか

- 本物の Claude Code での発火試験もするか（するなら `!` 付きの 1 行の実行を頼む）
- `/doctor prompt-audit` も実行するか
- fail と warn をどう扱うか（直す / 提案にする / 今回は見送る）
- 最後にコミットしてよいか

## 完了条件

- 点検スクリプトが終了コード 0 か 1 で終わり、レポートが書き出されている
- fail の項目それぞれについて、人間が扱いを決めている
- 日報に実行記録が 1 行ある
