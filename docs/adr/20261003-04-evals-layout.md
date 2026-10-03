---
id: 20261003-04
title: 共通の前提データを直下の fixtures/ に置き、evals/ を共通の道具と Skill ごとのテストに分ける
type: decision
business: n/a
status: proposed
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: n/a
supersedes: n/a
---

# 20261003-04: 共通の前提データを直下の fixtures/ に置き、evals/ を共通の道具と Skill ごとのテストに分ける

## 背景

20261003-01 の決定 2 は、eval のケースを `evals/<Skill 名>/<ケース名>/` に置くと決めた。
その後、9 つの Skill のケース、共通の scaffold、質問の流れの進行役、前提データ（検証用の company に重ねるファイル）が増え、
2026-10-03 の時点で `evals/` の直下は次のように混ざっている。

| 直下の名前 | 役割 |
|---|---|
| `adr/` `approve/` `close/` `morning/` `onboard/` `quarterly/` `retro/` `validate/` `weekly-review/` | Skill ごとの eval のケース |
| `lib/` | 共通の道具（scaffold） |
| `dialogue/` | 共通の道具（進行役 `run.ts`・`steps.ts`）と、`/onboard` の台本（`onboard.json`）が同居 |
| `fixtures/` | `/retro` のケースだけが使う前提データ（`retro-history/`） |
| `results/` | 実行の記録（追跡しない） |

名前だけでは、どれが Skill でどれが道具か区別できない。Skill と同じ名前の道具（例：将来 `check` という道具）を置くと衝突する。
台本は `/onboard` のテストなのに、`/onboard` のケースから離れた場所にある。前提データも、使うケースから離れている。

土台の検証用 company（`test/fixtures/company/`）は、vitest（hook・`/check`・スキーマのテスト）と eval の両方が使うのに、
`test/` の下にあり、vitest の持ち物に見える。

あわせて、判定の書き方がそろっていない。`/onboard` の 2 ケースは `graders/*.md`（1 ファイル 1 判定）、
残りの 9 ケースは `case.yaml` の `graders:` にまとめて書いている。

## 決定

20261003-01 の決定 2（ケースの置き場）と、20261003-02 の決定 4-1 の土台の置き場（`test/fixtures/company/`）を、次の構成に置き換える。

```text
fixtures/                         共通の前提データ。vitest と eval が共有する
├── company/                      土台の検証用 company（今の test/fixtures/company/）
└── <名前>/                       eval の 2 つ以上のケースが共有する環境（必要になったときだけ作る）
test/                             vitest
evals/
├── lib/                          共通の道具（TypeScript）
│   ├── scaffold.ts
│   └── dialogue/                 質問の流れの進行役（run.ts、steps.ts）
├── skills/                       Skill ごとのテスト。直下の名前は business-os の skills/ の名前と同じにする
│   └── <Skill 名>/
│       └── <ケース名>/
│           ├── case.yaml         eval のケース（判定もここにまとめる）
│           ├── prompt.md         送るメッセージと実行の条件
│           ├── scaffold.sh       作業場所の用意（exec node の 1 行）
│           ├── overlay/          任意：このケースだけの前提データ
│           └── dialogue.json     任意：このケースの質問の流れの台本
└── results/                      実行の記録（追跡しない）
```

1. 共通の道具は `evals/lib/`、Skill ごとのテストは `evals/skills/<Skill 名>/<ケース名>/` に置く
2. 前提データは、役割で 3 段に分ける

   | 段 | 置き場 | 中身 |
   |---|---|---|
   | 土台 | `fixtures/company/` | business-os を動かすのに必要な検証用の company。vitest と eval が共有する |
   | 共通の環境 | `fixtures/<名前>/` | eval の 2 つ以上のケースが共有する環境（例：日報が 1 か月分たまった company）。必要になったときだけ作る |
   | ケースの前提データ | `evals/skills/<Skill 名>/<ケース名>/overlay/` | そのケースだけで使うデータ |

   scaffold は、土台の上に共通の環境、その上にケースの前提データの順で重ねる
3. 質問の流れの台本は、同じ場面を扱うケースのフォルダに `dialogue.json` として置く。
   `pnpm eval:dialogue` は `evals/skills/` の下の `dialogue.json` を全て実行する
4. 判定は `case.yaml` の `graders:` にまとめる。`graders/*.md` は使わない
5. `evals/skills/` の直下の名前が、business-os の `skills/` に無ければ、`pnpm check` の検査で fail にする（Skill の改名や削除の追従漏れを防ぐ）
6. Skill を対象外にするとき（今は Bash が要る `/check`。20261003-02）は、その理由を検査の側に書き、
   対象外でない Skill にケースが 1 つも無ければ warn にする

20261003-01・20261003-02・20261003-03 の、ここに挙げた以外の決定は変えない。
20261003-03 の例に書いた `scaffold.sh` の相対パス（`../../lib/scaffold.ts`）は、階層が 1 つ深くなるため `../../../lib/scaffold.ts` になる。
例の書き換えは要らない（決定は「`exec node` の 1 行」であり、パスの深さではない）。

## 根拠

- `claude plugin eval` は eval のフォルダの下を深さに関係なく探し、`prompt.md` か `case.yaml` を持つフォルダをケースとして扱う。
  `skills/` の下に 1 段深くしても、実行方法（`pnpm eval:cases`）とケース名での絞り込みは変わらない
- `evals/skills/<名前>/` を business-os の `skills/<名前>/` と 1 対 1 で対応させると、どの Skill にどのテストがあるかが一覧でき、
  名前の対応を検査で機械的に守れる。将来 `agents/` の作業者を検証するときも `evals/agents/<名前>/` と同じ形で足せる
- ケースに関わるもの（判定、前提データ、台本）を 1 つのフォルダに集めると、ケースを読む・直す・消すときに 1 か所で済む。
  共有しない前提データを共有の場所に置くと、使われなくなっても気づけない
- 判定を `case.yaml` にまとめると、1 ケースの判定が 1 ファイルで読める。`/onboard` の初回のケースは判定が 32 個あり、ファイルに分けると 32 個になる
- 検討した代替案
  - `--eval-dir evals/skills` で eval のフォルダ自体を `skills/` にする：実行の記録が `evals/skills/results/` にでき、Skill の名前と混ざる。不採用
  - 前提データを全て共有の場所に置く：今のケース固有の前提データは 1 ケースでしか使っておらず、ケースから離れる。不採用
  - 土台を `test/fixtures/company/` に残す：vitest の持ち物に見え、eval が `test/` の中を借りる形になる。不採用
  - 土台を `evals/fixtures/company/` に移す：利用者の大半は vitest（`test/helpers.ts` を通して hook・`/check`・スキーマのテスト）で、
    単体テスト（`test/`）が開発用の Skill の検証（`evals/`）に依存する向きになる。`evals/` を作り直したり外したりするときに hook のテストまで巻き込む。不採用
  - 品質管理の親フォルダ（例：`qa/`）の下に `test/`・`evals/`・`fixtures/` を並べる：共通の前提データの置き場は直下の `fixtures/` でも同じく作れる。
    一方、テストの 9 ファイルの相対 import、`vitest.config.ts`・`tsconfig.json`・`.gitleaks.toml` の書き換えが要り、
    `claude plugin eval .` が既定の `evals/` を見つけられなくなる（毎回 `--eval-dir` が要る）。品質関係をまとめるなら `scripts/`（検査の実装）も移すかという範囲の問題も生じる。不採用
  - `test/` と `evals/` を 1 つにまとめる：`test/` は結果が毎回同じで費用が無く、CI と `pnpm check` で必ず走る。
    `evals/` はモデルを動かすため結果が揺れ、利用枠を消費し、手元で必要なときだけ走る（20261003-01 の決定 6）。
    フォルダを分けておくと、この境界が構成から読める。道具の既定（vitest は `test/`、`claude plugin eval` は `evals/`）にも合う。今は不採用
  - 台本を `evals/dialogue/<Skill 名>.json` に集める：Skill ごとに台本が 1 つに限られ、ケースとの対応も名前でしか分からない。不採用

## 影響

- `test/` と `evals/` を分けた決定は、次のどれかが起きたら見直す
  - eval を CI で回すようになった（Bash の制約が解けた、API キーの費用を受け入れた など）
  - vitest と eval の両方に関わる道具（前提データ以外）が増え、`test/` と `evals/` のどちらに置くか迷う場面がくり返し起きた
- 既存の 11 ケース、台本、前提データ、道具を移す（実装 PR で行う）。移した後に全ケースと台本を実行し、結果が変わらないことを確かめる
- 各 `scaffold.sh` の相対パスが 1 段深くなる。`check:shell` の規則（`evals/` の下の `scaffold.sh` が `exec node` の 1 行）はそのまま使える
- `test/fixtures/company/` を `fixtures/company/` に移す。参照を直す箇所は、`test/helpers.ts`、`evals/lib/scaffold.ts`、`.gitleaks.toml`（検証用の値を秘密の検査から外す設定）、`scripts/lib/repo-checks.ts`（漏洩の検査は今 `test/` を対象から外している）と、文書（CLAUDE.md・docs/README.md）
- 今の `evals/fixtures/retro-history/` は `/retro` のケースの `overlay/` に移す
- scaffold の重ねるファイルの組の指定は、共通の環境（`fixtures/<名前>/`）とケースのフォルダの `overlay/` を受け付けるようにする
- CLAUDE.md・CONTRIBUTING.md・構造仕様の `evals/` の説明を更新する
- 新しい検査（`evals/skills/` と `skills/` の名前の対応）が増える

## 参考

- Claude Code のドキュメント「plugin evals」：<https://code.claude.com/docs/en/plugin-evals.md>
- 関連 ADR：20261003-01（決定 2 をこの ADR が置き換える）、20261003-02（`/check` を対象外とした決定。決定 4-1 の土台の置き場をこの ADR が置き換える）、20261003-03（scaffold の 1 行の bash）
