# dev-autopilot の基本設計

進行役（AI ではない Node のスクリプト）の構造仕様。判断は[要件メモ][req]に書いてあり、本フォルダは要件を「構造」に写したもの。要件と食い違ったら要件メモに合わせて、こちらを直す。

書いた日：2026-10-11。状態：下書き（段階 0c の実装の前）。

## 文書の一覧

| 文書 | 中身 | 要件の節 |
| --- | --- | --- |
| [全体構成][arch] | 配置（2 つの clone と worktree）、1 回の実行の流れ、段の一覧、モジュール構成、信頼の境界、リポジトリの操作 | 3 節、6 節、10 節、12 節の判断 1 |
| [状態の組み立てと次の段の決定][state] | GitHub から読む入力、組み立てた状態、止まる条件、次の段の決定表、段階による違い | R1-5、4.10 節 |
| [判定の表][judgments] | 候補の選定、実行の失敗の分類、文の出どころ、検疫、レビューの pass、収束、マージの判定、載せ直し、指標、漏えい検査 | 4.1〜4.8 節 |
| [設定ファイルの項目][config] | `.claude/dev-autopilot.json` の全項目と初期値、環境変数、`check` の検証 | 10 節の 2、S3 |
| [固定の指示文と出力契約][contracts] | 指示文の構造と欄の区切り、役ごとの入力、出力契約の JSON、進行役の検証 | I3、R2-5、R2-9 |
| [AI のセッションの起動][sessions] | `claude -p` の引数、役ごとの道具、安全設定（sandbox と permissions）、出力の解析、0b で分かった制約 | 6 節、判断 1、12 節末の表 |
| [記録の形][records] | 実行とセッションの記録の欄、lock、指標の算出、保持 | R1-4、R6-3 |

## 書き方の決まり

- 根拠は要件番号（R・I・S・P と節番号）で書く。要件に無い判断を設計で新しく決めない。決めたくなったら要件メモに「決定」として書いてから、こちらに写す
- 値（上限、パス、ラベル名、モデル）は[設定ファイルの項目][config]に集め、他の文書は項目のキーで参照する
- Markdown のリンクは参照スタイル（`dev-autopilot/` の規則）
- 印の形は要件 4.12 節に定めてあり、実装は `src/marker.ts` が持つ。設計では参照だけにする

## 次に書くもの

- `dev-autopilot/src/` の実装（段階 0c）：`setup` と `check` を先に、進行役の主ループは段階 1 の範囲（受け入れ・承認の確定・棚卸し・記録）から
- 結合テスト（`dev-autopilot/test/`）：偽の GitHub と使い捨てのリポで、[状態の組み立て][state]の決定表の各行を 1 ケースずつ

[req]: ../../dev-autopilot-requirements.md
[arch]: ./architecture.md
[state]: ./state-machine.md
[judgments]: ./judgments.md
[config]: ./config.md
[contracts]: ./contracts.md
[sessions]: ./sessions.md
[records]: ./records.md
