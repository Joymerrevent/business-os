---
name: retro
description: 日報とレビューから、くり返している作業の Skill 化、使われていない Skill の削除・凍結、地図や運用ルールへの追記を提案する。週に 1 回か月に 1 回使う。
disable-model-invocation: true
---

# /retro

## 何をするか

business-os と運用を、使われ方に合わせて直す提案を出す。提案は `docs/proposals/` に書き、`/approve` で反映する。

1. **2 回ルール**：同じ依頼を CC に手で頼んだのが 2 回以上あれば、業務 Skill（`.claude/skills/`）にすることを提案する
2. **剪定**：先月 1 回も使われなかった業務 Skill の削除か凍結を提案する（business-os の 10 個の Skill は対象外）
3. **地図と運用ルール**：くり返し起きた問題から、`CLAUDE.md` や判断ルールへの追記を提案する
4. **自動起動**：2〜4 週間、決まった周期で毎回呼ばれている周期 Skill があれば、Routines（スケジュール起動）に移すことを提案する。
   設定はしない（人間が決める）

**分析と質問を分ける。** 日報やレビューの読み込みと集計は、作業者 `worker` に委譲する
（Agent ツールで `subagent_type` を `business-os:worker` にする）。
ただし人間への質問と、ファイルの書き込みは、必ずこの Skill を呼んだ本文脈で行う（作業者は質問できない）。

## 何を読むか

1. `${CLAUDE_SKILL_DIR}/../../templates/skill-conventions.md`（共通規約。最初に必ず読む）
2. `${CLAUDE_SKILL_DIR}/../../templates/operations/reviews/retro.md`（雛形）
3. 対象期間（既定は前回の `/retro` の翌日から今日まで。初回は直近 30 日）の日報 `docs/operations/daily/` の実行記録
4. 対象期間のレビュー `docs/operations/reviews/`（点検の結果を含む）
5. `.claude/skills/`（業務 Skill の一覧）
6. 前回の振り返り `docs/operations/reviews/retro-*.md`（前回の提案がどうなったか）

## 手順

1. 対象期間を決め、人間に確かめる
2. 作業者 `worker` に、対象期間の日報とレビューを渡し、次を集計させる
   - Skill ごとの実行回数（実行記録の `- HH:MM /<skill>` の行）
   - Skill を使わずに手で頼んだ作業（例：「（手作業）」と書かれた行）のうち、同じ種類のものの回数
   - 業務 Skill ごとの最後の実行日
   - 点検（`/check`）でくり返し出た warn / fail
3. 集計を、元の日報の行と突き合わせてから使う（作業者の要約をそのまま信じない）
4. 提案の候補を示し、どれを提案にするか、優先度はどうかを聞く
5. 選ばれたものを提案として書く
   - Skill 化：`target` を `.claude/skills/<名前>/SKILL.md` にし、本文に SKILL.md の案を書く
   - 剪定：削除か、`disable-model-invocation: true` を付けた凍結か
   - 地図・運用ルール：`target` を `CLAUDE.md` か `docs/charter/decision-rules.md` にする
6. business-os そのもの（business-os）への改善案があれば、振り返りに「business-os への改善案」として書く。
   business-os のリポジトリへの Issue の作成は外部への行動なので、人間が頼んだときだけ、送る前に確認して行う
7. 振り返りを雛形から書き出し、`/approve` を案内する

## 何を書くか

- `docs/operations/reviews/retro-YYYYMMDD.md`
- 提案（`docs/proposals/`）
- 日報への実行記録（例：`- 17:00 /retro — 提案 2 件（Skill 化 1、剪定 1）`）

## 人に何を聞くか

- 対象期間
- 提案の候補のどれを提案にするか、優先度
- 最後にコミットしてよいか

## 完了条件

- Skill の実行回数と、2 回以上くり返した手作業が振り返りに書かれている
- 人間が選んだ候補が全て提案（`status: proposed`）になっている
- 業務 Skill や地図を直接書き換えていない
- 日報に実行記録が 1 行ある
