---
status: proposed
created: 2026-10-08
updated: 2026-10-09
decision-makers: メンテナ
consulted: 別の文脈のレビュー AI 2 体（安全側・実現性）
informed: n/a
---

# 開発の PR は進行役が許可一覧の条件でマージし、方針に係る PR は人がマージする

## 背景と課題（Context and Problem Statement）

dev-autopilot は、人が処理対象にした Issue を作業 AI が実装して PR にし、レビュー AI の指摘が無くなるまで直すループである（[要件メモ][memo] 1 節）。
ループの終わりは「PR をマージする」操作であり、マージを誰が行うかで、仕組みが無人で回るか、毎回人の操作で止まるかが決まる。

いっぽうで、メンテナの個人設定（`~/.claude`）は「PR のマージは Claude が実行しない」と定め、リポの `.claude/settings.json` も `gh pr merge` を `permissions.ask` に置いている。
マージはレビュー完了の判断を伴い、本番デプロイを起動しうるからである。
2026-10-08 に調べた範囲（要件メモ 11 節）では、Copilot・Codex・Jules・Devin・OpenHands のどれも「PR を人が確認してマージ」で止まっており、
AI の判定で PR をマージする製品は見つからなかった。

課題を問いの形で書く。「どの PR を、誰が、どの条件で、どう確かめてマージするか」。
とくに、ADR・設計書・配布物の防衛（hook）・dev-autopilot 自身のような「方針に係る変更」が無人でマージされる経路を、仕組みで塞げるか。

## 判断の決め手（Decision Drivers）

- 無人で回ること。開発の PR のたびに人の操作が要ると、1 日 1 回の棚卸し（要件メモ 2 節）から先へ進めない
- 方針に係る変更（ADR・設計書・CLAUDE.md・配布物の防衛・dev-autopilot 自身）は人だけがマージすること。自己改変の経路を残さない
- 判定が再現できること。進行役は AI ではなく Node のスクリプトで、判定は決定的な処理で行う（要件メモ 3 節）
- 壊れたときに安全側へ倒れること。判定できない状態では、マージせずに人へ渡す（fail-closed）
- 業界の実践の外に出る点を、隠さずに ADR に明記し、続けるか止めるかを測る値で決めること
- メンテナの個人設定（`~/.claude`）の「PR のマージは Claude が実行しない」との関係をはっきりさせること

## 検討した選択肢（Considered Options）

- 案 A：段階 4 で信頼を積んだ後、進行役が許可一覧の条件で開発の PR をマージする（採用）
- 案 B：すべての PR を人がマージする（業界の標準）
- 案 C：方針に係るパスの拒否一覧を持ち、拒否一覧に当たらない PR を進行役がマージする

## 決定（Decision Outcome）

採用した選択肢:「案 A：段階 4 で信頼を積んだ後、進行役が許可一覧の条件で開発の PR をマージする」。
理由: 無人で回ることと方針に係る PR を人に残すことを同時に満たす唯一の選択肢で、
案 C はレビューで自己改変の経路が見つかり、案 B は無人の要件を満たさないから。
案 A は、2026-10-08 に調べた製品のどれもやっていない「AI の判定による PR のマージ」であり、**業界の実践より踏み込んでいる**（要件メモ 11 節）。
踏み込む範囲を許可一覧と段階の出口条件で狭く縛り、revert 率で続けるかを決める。

### マージの主体と手順（R7-1、R7-3b）

- マージは AI のセッションではなく進行役（Node のスクリプト）が行う。作業 AI・レビュー AI・批評者には `gh pr merge` を許さない（要件メモ 6 節。セッションの sandbox と鍵の分離は ADR「AI のセッションに sandbox を掛け、鍵は人用と自動化用に分け、作業 AI の commit は署名しない」（[ADR-20261008-004][adr-20261008-004-session-sandbox-and-keys]））。
- コマンドは `gh pr merge --squash --match-head-commit <印の head SHA>` に固定する。印はレビュー AI の構造化出力から進行役が組み立てて PR コメントに付ける判定の 1 行で、形は ADR「レビューの判定は PR コメントの印で行い head の SHA に結びつけ、🔴 🟡 だけを直して収束させる」（[ADR-20261008-005][adr-20261008-005-review-marker-and-convergence]）に書く。印の SHA と PR の実際の head の一致を、進行役の判定に加えてサーバ側でも強制する。
- 1 回の実行でマージするのは 1 件まで。
- `develop` の ruleset（`setup` が作る）に「base と最新であること」を入れ、古い base で pass した PR はマージされない。
- 先行の PR がマージされたら、依存していた worktree は `git merge develop` で載せ直す。force push は使わない。

### 進行役がマージしてよい条件（R7-2。すべて満たす）

1. dev-autopilot が作った PR で、向き先が `develop`。作者は人と同じアカウントなので作者では見分けられない。進行役の記録にある PR 番号であり、かつブランチ名が `feat/issue-<n>-*`（型は Issue のラベルから。対応表は ADR「着手する Issue は人のラベルとマイルストーンと依存で選び、Issue ごとの worktree と上限の中で進める」（[ADR-20261008-009][adr-20261008-009-issue-selection-worktrees-and-limits]））に一致するものに限る
2. 終了条件（ADR-20261008-005）を満たしている。最新のラウンドの印（進行役が付けたもの）が `verdict=pass`、印の `head` が PR の head と一致、CI 緑
3. push 前の漏えいの検査（R2-14）を通っている
4. 変更したファイルがすべて許可一覧（下記）にあり、diff の状態がすべて追加（A）か変更（M）
5. 変更したファイルに、方針に係るパス（下記の「含めない例」）が 1 つも無い

1 つでも満たさなければ、進行役はマージせず、PR を Ready to Merge のまま人に渡す。

### 自動マージしてよいパスの許可一覧（R7-3）

拒否一覧ではなく許可一覧で持つ。一覧に無いパスを 1 つでも触れば人がマージする。一覧は設定ファイル（要件メモ 10 節の正本 1 つ）に置く。

business-os の初期値は次の 3 つ（2026-10-08 決定、要件メモ 12 節の判断 2「狭く始める」）:

| パス | 中身 |
| --- | --- |
| `docs/usage/**` | 利用者向け文書 |
| `fixtures/**` | 検査の前提データ |
| `.changeset/*.md` | changeset。設定ファイル `config.json` は含まない |

`plugin/skills/**` と `plugin/scripts/**` は利用者の CC で動く配布物なので初期値に入れない。
`test/**` と `evals/**` も初期値に入れない。`evals/` には唯一の bash である `evals/scaffold.sh` と `evals/lib/**` の実行されるコードが、`test/**` には hook の fail-closed テストが含まれ、
テストの弱体化（消す・skip する・期待値を緩める）を許可一覧では止められず、レビュー頼みになるためである。
`test/**` `evals/**` `plugin/skills/**` `plugin/scripts/**` は、段階 5 で 10 件の一致を確かめた後、別の判断で広げる。

許可一覧に含めない（人がマージする）例:

| 区分 | パス |
| --- | --- |
| 方針の正典 | `docs/adr/**` `docs/design/**` `ROADMAP.md` |
| CC の設定 | `CLAUDE.md` `.claude/**` |
| 自己改変 | `dev-autopilot/**` |
| Plugin の名札と CI | `.claude-plugin/**` `.github/**` |
| 利用者の CC で動く防衛と雛形 | `plugin/hooks/**` `plugin/agents/**` `plugin/templates/**` |
| 検査とその実装 | `test/**` `evals/**`、`plugin/scripts/check-repo.ts` など `check:*` の実装 |
| パッケージ・ロック・道具の設定 | `package.json` `pnpm-lock.yaml` `pnpm-workspace.yaml` `.node-version` `tsconfig.json` `vitest.config.ts` `eslint.config.*` `commitlint.config.*` `.gitleaks.toml` `.gitignore` `.markdownlint*` |
| ブランチ | `release/*` ブランチと `main` 向けの PR |

判定は diff の状態も見る。削除（D）・改名（R）・種類の変更（T。シンボリックリンク化など）・実行属性の変更は、パスが許可一覧にあっても人がマージする。
実行属性の変更は `git diff --raw` の mode（変更前と変更後）の比較で検出する。`--name-status` には出ないので、`--name-status` だけで判定しない。

### マージ後の後始末（R7-4）

- Issue を閉じる（`develop` 向けの PR は `Closes #<番号>` で自動では閉じない）
- worktree を消す。ブランチはリポ設定 `delete_branch_on_merge` が消す
- 依存していた worktree に `develop` を merge する

### メンテナの個人設定との関係（R7-5）

決定は、メンテナの個人設定（`~/.claude`）の「PR のマージは Claude が実行しない」の例外になる。例外の範囲は次のとおり限定する。

- 例外は cron が起動する dev-autopilot の進行役に限る。対話中の CC には及ぼさない。対話中の CC は今までどおり `gh pr merge` を実行しない
- リポの `.claude/settings.json` の `permissions.ask` にある `gh pr merge` は CC のセッションに効く規則で、進行役は CC の外（cron が起動する Node）で動くので掛からない
- 手動の `/dev-autopilot`（CC の中で進行役を動かす）ではマージを行わない。`permissions.ask` の `gh pr merge` を迂回しないためである。手動の実行は Ready to Merge で止まり、マージは人が行う
- 代わりに R7-2 の判定を進行役の唯一のマージの経路にし、判定の実装を vitest で検査する

### 段階との関係（要件メモ 7 節・12 節「7 節の段階の割り直し」）

| 段階 | マージの主体 | 出口 |
| --- | --- | --- |
| 4 | 人。対応ループは動くが、マージはまだ人。進行役は R7-2 の判定を記録に残すだけで実行しない（shadow 判定） | 5 件のうち 4 件以上が往復 3 回以内で Ready to Merge。shadow 判定と人のマージの一致の件数を記録から測る |
| 5 | 進行役（R7-2 の条件） | 10 件で、人がマージしていた判断と進行役の判定が全件一致。revert 0 件 |
| 6 | 進行役。並列と間隔の短縮 | R6-2 の条件 |

段階 5 に入る前に揃える 4 つ（要件メモ 11 節）: 向き先が `develop`（`main` ではない）であること、方針に係るパスの除外、revert 率の監視、段階 4 で人のマージと判定が一致することの確認。

### 続けるか止めるかの判断（R6-3）

進行役は指標を記録に残す。マージ率、往復の回数、人が却下した指摘の割合（誤検知率）、**マージ後の revert 率**、1 Issue あたりの利用枠。
revert 率は「マージした後に壊れていた」を測る唯一の値なので、進行役のマージ（段階 5）を続けるかの判断に使う。
revert は、`develop` の `revert:` で始まる commit（Conventional Commits の `revert` 型）のうち、本文でマージ commit の SHA を参照しているものを数える。
参考として、Codex 6.1%・Devin 14.5%・人 11.5% という調査がある（要件メモ R6-3）。

### 影響（Consequences）

- 良い点: 開発の PR が人の操作なしで `develop` に入り、棚卸しから次の Issue へ進める
- 良い点: 方針に係る変更と自己改変は、許可一覧に無いという理由で仕組みが人へ渡す。人の記憶に頼らない
- 良い点: `--match-head-commit` と ruleset の「base と最新」で、印と head のずれ・古い base の pass を GitHub 側でも止める
- 悪い点: 業界の実践の外にある。revert が出たときの被害は `develop` に限られるが、ゼロではない
- 悪い点: 許可一覧が狭いので、`plugin/skills/**` `plugin/scripts/**` `test/**` `evals/**` を触る PR は当面すべて人がマージする。無人で回る範囲は利用者向け文書・前提データ・changeset に限られる
- 悪い点: メンテナの個人設定（`~/.claude`）の規則に例外ができる。例外の範囲を cron が起動する進行役に限ると明記しても、読む人が混同しうる
- 悪い点: 手動の `/dev-autopilot` ではマージされないので、手動で回した PR のマージは人の操作が要る
- 中立: 許可一覧を広げるときは別の判断（新しい ADR か、ADR の改め）が要る

### 確認方法（Confirmation）

- R7-2 の判定（進行役の記録とブランチ名・向き先・印・CI・漏えい・パス・diff の状態）を進行役の 1 つの関数にし、vitest で次を検査する。
  許可一覧の外のパスを 1 つ含む PR、diff の状態が D/R/T の PR、`git diff --raw` の mode が変わった PR、`main` 向けの PR、印の head がずれた PR、CI が `pending` の PR、
  進行役の記録に PR 番号が無い PR、ブランチ名が `feat/issue-<n>-*` の形（型は Issue のラベルから）に合わない PR は、いずれもマージしない
- 結合テスト（偽の `gh`）で、マージの呼び出しが `--squash --match-head-commit <SHA>` を含み、1 回の実行で 2 件目を呼ばないことを確かめる
- 結合テストで、手動の `/dev-autopilot`（CC の中の実行）からはマージの関数が呼ばれないことを確かめる
- revert の検出（`revert:` で始まり、本文でマージ commit の SHA を参照する commit を数える）を vitest で検査する
- 段階 4 の shadow 判定が、記録に「マージしてよいか」の判定を残し、`gh pr merge` を呼ばないことを結合テストで確かめる
- `check`（`/dev-autopilot check`）が、`develop` の ruleset に「PR 必須・force push 禁止・base と最新」があることを読み戻して確かめる
- 段階 5 の出口の 10 件は、人の判断と進行役の判定を Issue ごとに記録し、1 件でも食い違えば段階 4 に戻す
- 実行の記録に revert 率を残し、revert が 1 件でも出たら段階 5 を止めて人がマージに戻る

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案 A：段階 4 で信頼を積んだ後、進行役が許可一覧の条件でマージする

要件メモ 4.7 節のとおり。許可一覧と diff の状態で範囲を縛り、段階 5 の出口（10 件の一致・revert 0 件）を越えてから無人のマージを始める。

- 良い点: 無人で回り、方針に係る PR は人に残る。2 つの決め手を同時に満たす
- 良い点: 許可一覧は「書いたものだけ通す」ので、新しいフォルダが増えても既定で人がマージする（安全側）
- 良い点: 判定が決定的で、vitest で検査できる
- 悪い点: 業界の実践より踏み込んでいる。調べた製品で PR 自体をマージするものは無く、自動 approve まで行く CodeRabbit（条件つき）と Copilot（glob と設定で有効化）でもマージは人の操作が残る
- 悪い点: メンテナの個人設定（`~/.claude`）の規則に例外を作る
- 中立: Copilot の「変更ファイルがすべて指定の glob に当たるときだけ approve を数える」と同じ考え方を、approve ではなくマージに当てている

### 案 B：すべての PR を人がマージする

Copilot・Codex・Jules・Devin・OpenHands と同じ形。進行役は PR を Ready to Merge にして止まる。

- 良い点: 業界の標準で、メンテナの個人設定（`~/.claude`）の規則と矛盾しない
- 良い点: 判定の実装も許可一覧も要らない
- 悪い点: 1 日 1 回の棚卸しの先が毎回人の操作で止まり、無人の要件を満たさない。段階 6（並列と間隔の短縮）に進めない
- 悪い点: 人がマージの判断を毎回行うので、段階 5 の出口（進行役の判定と人の判断の一致）を測る機会が無い
- 中立: 段階 4 までは案 B と同じ運用で、案 A は段階 5 以降だけが違う

### 案 C：方針に係るパスの拒否一覧で判定する

方針に係るパス（ADR・設計書・CLAUDE.md など）を列挙し、拒否一覧に当たらない PR を進行役がマージする。要件メモの初稿の形。

- 良い点: 一覧が短く、新しいフォルダを触る PR も無人で通る
- 悪い点: 2026-10-08 のレビュー（要件メモ 12 節）で、拒否一覧に `dev-autopilot/**` が無く、自己改変の PR がマージされる経路が見つかった。列挙に漏れた瞬間に fail-open になる
- 悪い点: 削除・改名・種類の変更が判定の外にあった。パスだけ見ても、ファイルの消し方や置き換え方で防衛をすり抜ける
- 悪い点: フォルダが増えるたびに拒否一覧の更新を人が思い出す必要がある

レビューを受けて、許可一覧への反転と diff の状態の判定を R7-3 に反映した。

## 補足情報（More Information）

- 正本は [要件メモ][memo] の 4.7 節（R7-1〜R7-5）、4.6 節 R6-3、7 節と 12 節「7 節の段階の割り直し」、11 節「dev-autopilot が業界より先に出ている点」、12 節の判断 2
- 終了条件（CI 緑と `verdict=pass` の定義、印の形）は ADR-20261008-005 に書く。本 ADR は終了条件を満たした後のマージの判定だけを決める
- `develop` の ruleset・ラベル・設定ファイルを作る `setup` と、揃っているかを確かめる `check` は要件メモ 4.9 節
- 許可一覧に `test/**` `evals/**` `plugin/skills/**` `plugin/scripts/**` を足すかは、段階 5 の出口を越えた後に別の判断で決める。本 ADR の一覧を直接書き換えず、新しい ADR か改めの注記で扱う
- 指標（revert 率、shadow 判定と人のマージの一致の件数）は、進行役の記録フォルダの実行ごとの JSON から集計する。記録フォルダの置き場は ADR-20261008-009 に書く
- 分離（別リポジトリ化）の目安は段階 5 まで（要件メモ 10 節）。許可一覧の初期値は business-os 向けで、別のリポに適用するときは設定ファイルの値を差し替える
- 見直しの時期: 段階 5 の出口に達したとき、または revert が 1 件でも出たとき

[memo]: ../dev-autopilot-requirements.md
[adr-20261008-004-session-sandbox-and-keys]: ./adr-20261008-004-session-sandbox-and-keys.md
[adr-20261008-005-review-marker-and-convergence]: ./adr-20261008-005-review-marker-and-convergence.md
[adr-20261008-009-issue-selection-worktrees-and-limits]: ./adr-20261008-009-issue-selection-worktrees-and-limits.md
