---
status: proposed
created: 2026-10-08
updated: 2026-10-10
decision-makers: メンテナ
consulted: 別の文脈のレビュー AI 2 体（安全側・実現性）
informed: n/a
---

# dev-autopilot は分離を見越して 1 つのフォルダに Plugin の形で閉じ、導入と点検も Plugin が担う

## 背景と課題（Context and Problem Statement）

dev-autopilot は、business-os の Issue を AI が worktree で実装し、別の AI がレビューし、条件を満たしたら進行役がマージの可否を判定して人に渡す自律開発ループである（[要件メモ][memo] 1 節）。
dev-autopilot は business-os の開発専用の道具であり、business-os の利用者が使う Skill・agent・hook ではない。一方で、要件メモ 10 節は「将来は別リポジトリ（独立した Plugin）で管理する」と決めている。

business-os には開発専用の TypeScript の置き場が無く、tsconfig の include は `evals/` `plugin/hooks/` `plugin/scripts/` `test/` だけである（5 節 P7）。
レビューの手順である `change-review` Skill はメンテナの個人設定（`~/.claude`）の `skills/` にあり、dev-autopilot の専用マシンには無いかもしれない（5 節 P14）。
dev-autopilot が動く前提（ラベル、Project の欄、ruleset、設定ファイル、cron）を人が手で揃える前提にすると、別のリポに入れるたびに手順書が要り、揃っているかも人の記憶に頼ることになる（4.9 節）。

決めるべき問いは 3 つある。

1. dev-autopilot のコード・Skill・agent・テスト・文書を business-os のどこに置くか。
2. business-os の既存の検査（`pnpm check`、markdownlint、`check:adr`、`check:docs`）と dev-autopilot の文書規約（参照スタイルのリンク）をどう両立させるか。
3. dev-autopilot が動く前提の基盤を、誰が作り、誰が確かめるか。

## 判断の決め手（Decision Drivers）

- 分離のときに、写しも supersede も要らず、フォルダごと移せること（10 節「守ること」5）
- business-os と dev-autopilot が互いの中身を import せず、版がずれても黙って壊れないこと（10 節「守ること」1・7）
- リポ固有の値がコードに残らず、2 つ目の適用先に設定ファイルだけで適用できること（10 節「守ること」2、「分離の時期の目安」）
- 配布物の名札（`plugin/.claude-plugin/plugin.json`）が指す Skill・agent・hook に dev-autopilot が混ざらないこと（12 節 判断 3）
- 導入と点検を人の記憶に頼らず、機械で冪等に行えること（4.9 節 S1〜S4）
- 検査の対象から外れる領域を作らないこと（10 節「守ること」4。検査は dev-autopilot が持ち、business-os はそれを呼ぶ）

## 検討した選択肢（Considered Options）

- 案 A: business-os の中の 1 つのフォルダ `dev-autopilot/` に Plugin の形で閉じて作り、分離の条件が揃ったら別リポに移す
- 案 B: 最初から別リポジトリで作る
- 案 C: business-os の既存のフォルダ（`.claude/skills/` `.claude/agents/` `plugin/scripts/` `test/`）に分けて置く

## 決定（Decision Outcome）

採用した選択肢:「案 A: business-os の中の 1 つのフォルダ `dev-autopilot/` に Plugin の形で閉じて作り、分離の条件が揃ったら別リポに移す」。
理由: 決め手のすべてを満たす唯一の選択肢だから。案 B は 2 つ目の適用先ができる前に分離するため、固有の値がコードに残っていても気づけない（10 節「分離の時期の目安」）。
案 C は分離のときに business-os の各所から拾い集める作業が要り、import の禁止も守りにくい。

決定の中身を、要件メモの項目に対応づけて並べる。

### フォルダの構成（10 節「構成」）

```text
dev-autopilot/
  plugin/                      配布物。Plugin として読み込む範囲（`--plugin-dir` はここを指す。分離後は marketplace の `source` をここへ向ける）
    .claude-plugin/plugin.json 名札
    skills/
      dev-autopilot/SKILL.md   人が呼ぶ入口（/dev-autopilot：状態の表示、手動の 1 回実行）
      setup/SKILL.md           導入（4.9 節。足りない基盤を作る。冪等）
      check/SKILL.md           点検の入口（`src/check.ts` を呼ぶ包み。判定のロジックは持たない）
      review/SKILL.md          レビュー AI の手順（change-review v2 の正本。9 節）
      review/scripts/per-commit-gates.ts  コミットごとのゲートの検査（TypeScript。単体導入でも Skill と一緒に写る）
      intake/SKILL.md          Issue の受け入れ（指示の混入の検査、作業指示の下書き、agent-ready の付与）
    agents/
      worker.md                作業 AI（モデルは設定で）
      reviewer.md              レビュー AI
      critic.md                批評者（レビューの再検証）
  src/                         進行役（TypeScript、Node 24 が直接実行。bash を置かない）。Plugin としては配らず、cron が直接動かす
    main.ts                    入口
    select.ts                  例：Issue の選定
    select.test.ts             その単体テスト。テストは対象のコードの隣に置く（xxx.ts → xxx.test.ts）
    marker.ts                  印の形の正本（1 定数）
    check.ts                   点検の正本（進行役が毎回の最初に回す）
  fixtures/                    結合テストの前提データ（偽の gh の応答、使い捨てリポの雛形、Issue と PR の本文の例）
  test/                        結合テストだけ（偽の gh を差し替えて進行役を端から端まで回す）。単体テストは置かない
  docs/                        設計判断（adr/）と構造仕様（design/）
  README.md                    使い方。業務の固有名詞を書かない
  .markdownlint-cli2.jsonc     参照スタイルのリンクを許す入れ子の設定
```

### 守ること（10 節「守ること」1〜7）

1. **import しない。** dev-autopilot は business-os の `plugin/hooks/lib` や `plugin/scripts/lib` を import しない。要る関数は dev-autopilot 側に持つ。逆に business-os が dev-autopilot を import することもしない。
2. **リポ固有の値は設定ファイル 1 つに出す。** 置き場は business-os 側の `.claude/dev-autopilot.json`。項目は owner / repo、Project の番号と Status の選択肢の ID、ラベル名（`agent-ready` `needs-human` `from-review`）、base ブランチ、品質ゲートのコマンド（`pnpm check`）、コミットと PR の規約（言語、Conventional Commits、changeset の要否）、マージの可否の判定の許可一覧（4.7 節 R7-3。ADR「開発の PR のマージの可否は進行役が許可一覧の条件で判定し、マージの実行は人が行う」（[ADR-20261008-006][adr-20261008-006-orchestrator-merge-allowlist]））、モデル、予算と上限（件数・ラウンド・ターン・時間）、worktree の置き場。dev-autopilot のコードには書かない。
   設定ファイルは worktree にも入るので、進行役は自分の clone の base ブランチ（`develop`）の版だけを読み、worktree 側の版は読まない。作業 AI が worktree の中で設定ファイルを書き換えても、進行役の判定には効かない。
3. **起動は Plugin として。** 進行役は `claude -p --plugin-dir <dev-autopilot のパス>/plugin --agent dev-autopilot:worker` のように、`plugin/` を Plugin として読み込み、自分の Skill と agent を名前空間で呼ぶ。分離したら `--plugin-dir` が Marketplace からの導入（`source` は `./plugin`）に変わるだけで、呼び方は変わらない。
   配布物は `plugin/`（名札・Skill・agent）に閉じ、進行役の `src/`・テスト・前提データ・文書は配らない（business-os の ADR 20261009-02 と同じ考え方。dev-autopilot では最初からこの形にする）。
   人が呼ぶ Skill（`dev-autopilot` `setup` `check`）が進行役を動かすときは、設定ファイルの `devAutopilotPath`（dev-autopilot のフォルダの場所。分離前は `./dev-autopilot`、分離後は専用マシンの clone）から `src/` の場所を知る。Plugin のパスを手順に埋め込まない。
4. **検査は dev-autopilot 自身が持ち、business-os はそれを呼ぶだけ。** `dev-autopilot/` を pnpm の workspace のパッケージにし、自分の `package.json`（`check` スクリプト）・`tsconfig.json`・`vitest.config.ts`・`.markdownlint-cli2.jsonc` を持つ。
   型検査・vitest・markdownlint（参照スタイルのリンク）は dev-autopilot の `check` が回す。business-os の `package.json` には `check:dev-autopilot`（`pnpm --filter dev-autopilot check`）を 1 つ足すだけで、
   business-os の tsconfig と vitest の include には `dev-autopilot/` を足さない。分離するときは `check:dev-autopilot` の 1 行を消すだけで済む（2026-10-09 の決定。橋渡し ADR 20261008-01 の決定 5 と同じ）
   - 単体テストは対象のコードの隣（`xxx.ts` → `xxx.test.ts`）。配布への影響は無い（配布物は `plugin/` に閉じ、`src/` は配られない）
   - 結合テスト（偽の `gh` と使い捨てのリポで進行役を端から端まで回す）だけ `test/` に置く。前提データは `fixtures/`
   - business-os の `check:format` `check:lint` `check:leak` `check:shell` はリポジトリ全体の衛生の検査なので、root のまま `dev-autopilot/` にも効く。分離後は dev-autopilot 側が project-recipes で同じものを入れる
   - business-os の `check:md` は入れ子の `dev-autopilot/.markdownlint-cli2.jsonc` で `dev-autopilot/` の下だけ参照スタイルを許す（markdownlint-cli2 は下位フォルダの設定をそのフォルダ以下に適用する。2026-10-08 に `check:md` と pre-commit で確認）
5. **文書は dev-autopilot のフォルダに閉じる。** ADR・構造仕様・使い方は `dev-autopilot/docs/` と `dev-autopilot/README.md` に置き、business-os の `docs/` には書かない。ADR の規則はメンテナの個人設定（`~/.claude`）の `adr-docs` レシピに従う：ファイル名 `adr-<yyyymmdd>-<nnn>-<title>.md`、frontmatter は `status` `created` `updated` `decision-makers` `consulted` `informed`、リンクは参照スタイル。レシピの 3 ファイル（`README.md` `index.md` `adr-template.md`）は初回だけ写して置き、以後 `~/.claude` に依存しない。business-os 側に書く ADR は橋渡しの 1 本だけで、business-os の規則で書き、中身の判断には踏み込まない。
6. **`/verify-issue` との分担。** 汎用の部分（指示の混入の検査、作業指示の下書き、`agent-ready` の付与）は `dev-autopilot:intake` に置く。business-os の `/verify-issue` は business-os 固有の確かめ方（hook・雛形・第三者のツールの再現）を残し、最初と最後で `dev-autopilot:intake` を呼ぶ。
7. **Skill は Plugin に同封する。** 進行役・agent・Skill は印の形（4.3 節 R3-3。正本は `dev-autopilot/src/marker.ts` の 1 定数）や引数で結びついていて、版がずれると黙って壊れるため、Plugin の 1 つの版で一緒に検査し、一緒に配る。別に公開して組み合わせる形は採らない。単体で使う価値があるのは `review` だけなので、`review` は手順の本体を単体で成り立たせ、dev-autopilot 向けの部分（構造化出力、無人の入力、agent の名前）は引数で渡されたときだけ使う。`${CLAUDE_PLUGIN_ROOT}` や agent の名前を手順の本体に埋め込まない。分離後は skills CLI で `skills/review/` を単体導入できるので、別の場所へ写さない。

### 導入と点検を Plugin が担う（4.9 節 S1〜S4）

- **S1 導入（`/dev-autopilot setup`）**：足りないものを作る。何度実行しても同じ結果になる（冪等）。まず「何を作るか」の一覧を出し、人が承認してから作る。外部に影響が出る操作（ラベル・Project の欄・ruleset の作成）は 1 回の承認でまとめて行い、作った後に実物を読み戻して確かめる。
  - Plugin が作れるもの：ラベル（`agent-ready` `needs-human` `from-review`）、Project の Status の選択肢（In Review・Ready to Merge・Blocked）と単一選択欄「Agent」、base ブランチの ruleset（PR 必須・force push 禁止・base と最新であること）、設定ファイル `.claude/dev-autopilot.json`（Project の ID や選択肢の ID は API で引いて書く）、cron（macOS は launchd の plist）の定義、worktree の置き場、記録のフォルダ。
  - 人がやるもの（Plugin は手順を示し、済んだかを点検で確かめる）：deploy key（自動化用の SSH 鍵）の作成と GitHub への登録、fine-grained PAT の発行と置き場への保管（鍵と PAT の置き場は ADR「AI のセッションに sandbox を掛け、鍵は人用と自動化用に分け、作業 AI の commit は署名しない」（[ADR-20261008-004][adr-20261008-004-session-sandbox-and-keys]））、専用マシンの用意、利用枠の確認、処理対象にする Issue の選定。
- **S2 点検（`/dev-autopilot check`）**：前提がすべて揃っているかを機械で確かめ、fail / warn / pass で返す。点検の正本は `dev-autopilot/src/check.ts` で、進行役が毎回の実行の最初に Node で回し、fail が 1 つでもあれば作業に入らず止まる（fail-closed）。Skill `check` は `check.ts` を呼ぶ包みで、判定のロジックを持たない。見るもの：ラベルと Project の欄の存在、ruleset、設定ファイルの項目と ID の実在、`gh` の認証の権限、PAT のファイルが置き場（ADR-20261008-004）にあり sandbox の中からは読めないこと、deploy key で push できること、`claude` と Node の版、Skill の有無、worktree の残骸、前回の実行の記録。
  sandbox の安全設定は「設定に書いてある」ではなく、sandbox の中で読み取りを試して「実際に読めない」ことを確かめる（6 節）。`denyRead` がシンボリックリンクを解決しない不具合が 2026-10-08 の 0b の確認で見つかったため、`setup` は `denyRead` `denyWrite` のパスを実体に解決してから書く。
- **S3 設定ファイルの正本は 1 つ。** 導入が書き、点検が読み、進行役が使う。人が直接編集してもよいが、点検が整合を確かめる。
- **S4 business-os への導入は、最初の利用者として `setup` で行う。** 手で作らない。手で作ると、分離後に `setup` が別のリポで動く保証が無くなる。

### 配布範囲と文書規約の例外（12 節 判断 3・判断 5）

- **配布範囲は受け入れる（判断 3）。** `dev-autopilot/` は `test/` `evals/` と同じく、business-os の marketplace の `source: "./"` によって利用者にも配られる。配布物の名札が指す Skill・agent・hook には入れない。業務の固有名詞と秘密を置かない（`check:leak` の対象）。
  入れ子の `.claude-plugin/plugin.json` の扱いは 12 節の 0b の実機で確かめ済み：`claude plugin validate` は外側・入れ子の両方で通り（author の warn のみ）、`claude -p --plugin-dir <サブフォルダ> --agent dev-autopilot:worker` が動き、外側の Plugin と同時に読み込んでも両方の Skill を呼べた。
- **テストの置き場は配布に影響しない。** 何が配られるかを決めるのは `source` の指す先であり、ファイルの置き場ではない。単体テストを `src/` の隣に置いても `test/` に分けても、配られる量は変わらない。分離後に配布物を絞るか（`plugin/` と `src/` に分けて `source` を `./plugin` に向けるか）は 8 節の未決に残す。
- **Markdown の規則の例外（判断 5）。** business-os 側の橋渡し ADR で次のとおり決める：「`dev-autopilot/` の中に限り、絶対ルール 3 のうち『Markdown のリンクは inline 形式』を適用しない。絶対ルール 2（bash を足さない、TypeScript を Node 24 で直接実行）と、シンボリックリンク禁止・相対パス・LF は適用する」。橋渡し ADR の accepted 後に、CLAUDE.md の絶対ルール 3 に同じ文言の例外を足す。

### 分離の時期の目安（10 節）

段階 5（進行役のマージの判定）まで business-os で動かし、設定ファイルの項目だけで別のリポに適用できると確かめられたら分離する。
2 つ目の適用先ができる前に分離すると、固有の値がコードに残っていても気づけない。

### 影響（Consequences）

- 良い点: 分離はフォルダを移すだけで済み、文書の写しも supersede も要らない。
- 良い点: import の禁止と設定ファイルの一本化により、固有の値の混入を `check` と設定ファイルの項目で機械で見つけられる。
- 良い点: `setup` と `check` が導入の手順書を置き換え、前提の欠けを fail-closed で止める。
- 良い点: Skill・agent・進行役を 1 つの版で配るので、印の形や引数のずれが黙って壊れることを防げる。
- 悪い点: business-os の利用者にも `dev-autopilot/` が配られる。固有名詞と秘密を置かない規則と `check:leak` で守る。
- 悪い点: business-os の中に、Markdown の規約（参照スタイル）と ADR の規則（ファイル名・frontmatter）が異なる領域が 1 つできる。例外は橋渡し ADR と CLAUDE.md の 1 行で明示し、参照スタイルの許可は `dev-autopilot/.markdownlint-cli2.jsonc` の入れ子の設定で `dev-autopilot/` の下に限る。
- 悪い点: `plugin/hooks/lib` `plugin/scripts/lib` の関数を dev-autopilot 側にも持つため、同じ処理が 2 か所に存在しうる。分離の前提として受け入れる。
- 中立: dev-autopilot を workspace のパッケージにする設定（`package.json`・tsconfig・vitest）と business-os の `check:dev-autopilot` は、本 ADR と橋渡し ADR の accepted 後に実装の PR で行う。入れ子の markdownlint の設定（`dev-autopilot/.markdownlint-cli2.jsonc`）だけは起票 PR（#83）に含める。設定が無いと pre-commit と `check:md` が参照スタイルのリンクで止まり、起票そのものができないため（橋渡し ADR の判断）。

### 確認方法（Confirmation）

- `claude plugin validate` が `dev-autopilot/plugin/` で通り、`claude -p --plugin-dir dev-autopilot/plugin --agent dev-autopilot:worker` が動く（0b では `tmp/` の偽の Plugin で確認済み。実装の PR で dev-autopilot 自身の名札で再確認する）。
- `dev-autopilot/src/` と `dev-autopilot/test/` に、business-os の `plugin/hooks/` `plugin/scripts/` を指す import が無いことを grep で確かめる（`check` の項目にする）。
- `.claude/dev-autopilot.json` に 10 節「守ること」2 の項目がすべてあり、ID が実在することを `check` が確かめる。
- business-os の `pnpm check` が `check:dev-autopilot` 経由で dev-autopilot の `check`（型検査・vitest・markdownlint）を回し、business-os の tsconfig と vitest の include に `dev-autopilot/` が無く、`check:adr`・`check:docs` が `dev-autopilot/` を対象にせず、markdownlint が `dev-autopilot/` の下で入れ子の設定（`dev-autopilot/.markdownlint-cli2.jsonc`。参照スタイルを許す）を使うことを、設定ファイルの実物で確かめる。
- `setup` を 2 回続けて実行しても 2 回目が何も作らないこと、作った後の読み戻しが実物と一致することを、結合テスト（`dev-autopilot/test/`）で確かめる。
- `check` が、sandbox の中で `~/.ssh`・PAT の置き場（ADR-20261008-004）・`gh` の設定の実体を読めないことを、読み取りを試して確かめる（書いてあることではなく、実際に読めないこと）。
- `check` が deploy key で push できることを、使い捨てのブランチへの push と削除で確かめる。
- Skill `check` が設定ファイルの `devAutopilotPath` から `src/check.ts` を呼ぶだけで、判定のロジックも Plugin のパスも持たないことを、SKILL.md の中身で確かめる。
- 進行役が設定ファイルを自分の clone の `develop` から読み、worktree 側の版を読まないことを、worktree 側の設定ファイルを書き換えた結合テストで確かめる。
- business-os への導入が `setup` で行われたことを、手で作った項目が無いことで確かめる（S4）。

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### 案 A: business-os の中の 1 つのフォルダに Plugin の形で閉じ、後で分離する

- 良い点: 最初の適用先（business-os）で動かしながら、固有の値を設定ファイルに出し切れたかを確かめられる。
- 良い点: business-os の `pnpm check` と CI をそのまま使え（dev-autopilot の `check` を呼ぶだけ）、検査の対象から外れる領域を作らない。
- 良い点: 分離はフォルダを移すだけで、Plugin の名札・Skill・agent・文書が揃ったまま移る。
- 中立: 入れ子の Plugin の扱いは Claude Code の挙動に依存する。0b で動くことを確かめた。
- 悪い点: business-os の利用者にも配られる。固有名詞と秘密を置かない規則で守る。
- 悪い点: 検査の設定が 1 組増える（dev-autopilot の `package.json`・tsconfig・vitest・markdownlint）。分離後はそのまま使えるので無駄にはならず、business-os 側に残るのは `check:dev-autopilot` の 1 行だけ。

### 案 B: 最初から別リポジトリで作る

- 良い点: 配布範囲の問題が無く、文書規約の例外も要らない。
- 良い点: import の禁止が構造で保証される。
- 悪い点: 2 つ目の適用先ができる前に分離するため、固有の値がコードに残っていても気づけない（10 節「分離の時期の目安」）。
- 悪い点: business-os の変更（`/verify-issue` の拡張、ruleset、設定ファイル）と dev-autopilot の変更が 2 つのリポにまたがり、段階 0〜5 の間に版の対応を人が追う必要がある。
- 悪い点: CI・検査・リリースの仕組みを最初から別に用意する必要があり、段階 0 の負担が増える。

### 案 C: business-os の既存のフォルダに分けて置く

`.claude/skills/` に Skill、`.claude/agents/` に agent、`plugin/scripts/` に進行役、`test/` にテストを置く形。要件メモ 2 節の初期の決定（エージェント定義を開発専用の `.claude/agents/` に置く）に近い。

- 良い点: 既存の検査設定を変えずに済む。
- 良い点: business-os の開発専用 Skill（`.claude/skills/`）と同じ置き場で、開発者に馴染みがある。
- 悪い点: 分離のときに各所から拾い集める必要があり、漏れが出る。文書も business-os の `docs/` に混ざり、supersede が要る。
- 悪い点: `plugin/scripts/lib` の関数を使いたくなり、import の禁止を守りにくい。
- 悪い点: Plugin の名前空間（`dev-autopilot:worker`）で呼べず、分離後に呼び方が変わる。
- 悪い点: `plugin/scripts/` と `test/` は business-os の配布物と検査の対象であり、dev-autopilot の変更が business-os の `check:*` の実装と同じ扱いを受ける。

## 補足情報（More Information）

- 決定の元になった一次情報は [要件メモ][memo] の 4.9 節・6 節・10 節・12 節（判断 3・判断 5・0b の実機の結果）と、5 節の P7・P14 である。
- 要件メモ 2 節の「エージェント定義を開発専用の `.claude/agents/` に置く」は、10 節の決定（`dev-autopilot/agents/`）で置き換わっている。本 ADR は 10 節に従う。
- business-os 側の橋渡し ADR は、business-os の規則（`docs/adr/README.md`、`YYYYMMDD-nn-<slug>.md`、4 日付欄、inline リンク）で別に起票する。本 ADR と橋渡し ADR の両方が accepted になってから、workspace のパッケージ化と `setup` `check` の実装に入る（7 節の段階 0a → 0c）。
- 段階 0a は、橋渡し ADR 1 本（business-os 側）と dev-autopilot の ADR 9 本の起票である。
- 段階 0b（薄切り）のうち、2026-10-08 に `tmp/` の偽の Plugin とローカル clone で確かめたもの：未信頼の worktree で deny が効く、入れ子の Plugin と名前空間、`-p` からのサブエージェント、`--max-budget-usd`、sandbox 下で `check:types` と署名なし commit。
- 段階 0b の残る確認：worktree での denyWrite と commit、鍵と PAT の置き場の denyRead、`--setting-sources user`、`--max-turns` の実効、PAT で Organization の Project。残る確認が済んでから 0c（`setup` と `check` の実装と、`setup` による準備。`check` が business-os で全項目 pass したら出口）に入る。
- 見直しの時期：段階 5 の出口（10 件で人の判断と進行役の判定が全件一致）に達し、設定ファイルの項目だけで別のリポに適用できると確かめられたとき。分離を実行するときは、`source` を絞るかの未決（8 節）も合わせて決める。
- `review` Skill の v2 への組み直しは ADR「レビューの Skill は change-review の核を残して v2 に組み直し、dev-autopilot に同封する」（[ADR-20261008-007][adr-20261008-007-review-skill-v2]）で別に進める。本 ADR が決めるのは正本を `dev-autopilot/plugin/skills/review/` に置くことまでで、手順の中身は本 ADR の範囲外とする。

[memo]: ../dev-autopilot-requirements.md
[adr-20261008-004-session-sandbox-and-keys]: ./adr-20261008-004-session-sandbox-and-keys.md
[adr-20261008-006-orchestrator-merge-allowlist]: ./adr-20261008-006-orchestrator-merge-allowlist.md
[adr-20261008-007-review-skill-v2]: ./adr-20261008-007-review-skill-v2.md
