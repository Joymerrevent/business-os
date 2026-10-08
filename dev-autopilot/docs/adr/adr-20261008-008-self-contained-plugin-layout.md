---
status: proposed
created: 2026-10-08
updated: 2026-10-08
decision-makers: メンテナ
consulted: 別の文脈のレビュー AI 2 体（安全側・実現性）
informed: n/a
---

# dev-autopilot は分離を見越して 1 つのフォルダに Plugin の形で閉じ、導入と点検も Plugin が担う

## 背景と課題（Context and Problem Statement）

dev-autopilot は、business-os の Issue を AI が worktree で実装し、別の AI がレビューし、条件を満たしたら進行役がマージする自律開発ループである（[要件メモ][memo] 1 節）。
dev-autopilot は business-os の開発専用の道具であり、business-os の利用者が使う Skill・agent・hook ではない。一方で、要件メモ 10 節は「将来は別リポジトリ（独立した Plugin）で管理する」と決めている。

business-os には開発専用の TypeScript の置き場が無く、tsconfig の include は `evals/` `hooks/` `scripts/` `test/` だけである（5 節 P7）。
レビューの手順である `change-review` スキルは利用者の全体設定（`~/.claude/skills/`）にあり、dev-autopilot の専用マシンには無いかもしれない（5 節 P14）。
dev-autopilot が動く前提（ラベル、Project の欄、ruleset、設定ファイル、cron）を人が手で揃える前提にすると、別のリポに入れるたびに手順書が要り、揃っているかも人の記憶に頼ることになる（4.9 節）。

決めるべき問いは 3 つある。

1. dev-autopilot のコード・Skill・agent・テスト・文書を business-os のどこに置くか。
2. business-os の既存の検査（`pnpm check`、markdownlint、`check:adr`、`check:docs`）と dev-autopilot の文書規約をどう両立させるか。
3. dev-autopilot が動く前提の基盤を、誰が作り、誰が確かめるか。

## 判断の決め手（Decision Drivers）

- 分離のときに、写しも supersede も要らず、フォルダごと移せること（10 節「守ること」5）
- business-os と dev-autopilot が互いの中身を import せず、版がずれても黙って壊れないこと（10 節「守ること」1・7）
- リポ固有の値がコードに残らず、2 つ目の適用先に設定ファイルだけで適用できること（10 節「守ること」2、「分離の時期の目安」）
- 配布物の名札（`.claude-plugin/plugin.json`）が指す Skill・agent・hook に dev-autopilot が混ざらないこと（12 節 判断 3）
- 導入と点検を人の記憶に頼らず、機械で冪等に行えること（4.9 節 S1〜S4）
- 検査の対象から外れる領域を作らないこと（10 節「守ること」4。検査は 2 層）

## 検討した選択肢（Considered Options）

- A: business-os の中の 1 つのフォルダ `dev-autopilot/` に Plugin の形で閉じて作り、分離の条件が揃ったら別リポに移す
- B: 最初から別リポジトリで作る
- C: business-os の既存のフォルダ（`.claude/skills/` `.claude/agents/` `scripts/` `test/`）に分けて置く

## 決定（Decision Outcome）

採用した選択肢:「A: business-os の中の 1 つのフォルダ `dev-autopilot/` に Plugin の形で閉じて作り、分離の条件が揃ったら別リポに移す」。
理由: 決め手のすべてを満たす唯一の選択肢だから。B は 2 つ目の適用先ができる前に分離するため、固有の値がコードに残っていても気づけない（10 節「分離の時期の目安」）。
C は分離のときに business-os の各所から拾い集める作業が要り、import の禁止も守りにくい。

決定の中身を、要件メモの項目に対応づけて並べる。

### フォルダの構成（10 節「構成」）

```text
dev-autopilot/
  .claude-plugin/plugin.json   Plugin の名札（分離したらそのまま公開できる形）
  skills/
    dev-autopilot/SKILL.md     人が呼ぶ入口（状態の表示、手動の 1 回実行）
    setup/SKILL.md             導入（4.9 節 S1）
    check/SKILL.md             点検（4.9 節 S2）
    review/SKILL.md            レビュー AI の手順（change-review v2 の正本）
    intake/SKILL.md            Issue の受け入れ（指示の混入の検査、作業指示の下書き、agent-ready の付与）
  agents/
    worker.md                  作業 AI
    reviewer.md                レビュー AI
    critic.md                  批評者（レビューの再検証）
  src/                         進行役（TypeScript、Node 24 が直接実行。bash を置かない）
    <name>.ts / <name>.test.ts 単体テストは対象のコードの隣に置く
  fixtures/                    結合テストの前提データ（偽の gh の応答、使い捨てリポの雛形、Issue と PR の本文の例）
  test/                        結合テストだけ（偽の gh を差し替えて進行役を端から端まで回す）。単体テストは置かない
  docs/                        設計判断（adr/）と構造仕様（design/）
  README.md                    使い方。業務の固有名詞を書かない
```

### 守ること（10 節「守ること」1〜7）

1. **import しない。** dev-autopilot は business-os の `hooks/lib` や `scripts/lib` を import しない。要る関数は dev-autopilot 側に持つ。逆に business-os が dev-autopilot を import することもしない。
2. **リポ固有の値は設定ファイル 1 つに出す。** 置き場は business-os 側の `.claude/dev-autopilot.json`。項目は owner / repo、Project の番号と Status の選択肢の ID、ラベル名（`agent-ready` `needs-human` `from-review`）、base ブランチ、品質ゲートのコマンド（`pnpm check`）、コミットと PR の規約（言語、Conventional Commits、changeset の要否）、方針に係るパスの一覧（4.7 節）、モデル、予算と上限（件数・ラウンド・ターン・時間）、worktree の置き場。dev-autopilot のコードには書かない。
3. **起動は Plugin として。** 進行役は `claude -p --plugin-dir <dev-autopilot のパス> --agent dev-autopilot:worker` のように、自分の Skill と agent を Plugin の名前空間で呼ぶ。分離したら `--plugin-dir` が Marketplace からの導入に変わるだけで、呼び方は変わらない。
4. **検査は 2 層。** いまは business-os の `pnpm check` が `dev-autopilot/` の型検査と vitest を対象にする（tsconfig の include に `dev-autopilot/**/*.ts`、vitest の include に `dev-autopilot/**/*.test.ts` を足す）。markdownlint・`check:adr`・`check:docs` は `dev-autopilot/` を対象から外し（business-os の `.markdownlint-cli2.jsonc` の `ignores` に `dev-autopilot` を足す）、dev-autopilot は自分の markdownlint の設定（MD054 は参照スタイル）を持つ。分離したら dev-autopilot 自身の `check` にする。dev-autopilot のテストは `dev-autopilot/` の中に置き、business-os の `test/` に混ぜない。
5. **文書は dev-autopilot のフォルダに閉じる。** ADR・構造仕様・使い方は `dev-autopilot/docs/` と `dev-autopilot/README.md` に置き、business-os の `docs/` には書かない。ADR の規則は利用者の全体設定の `adr-docs` レシピに従う：ファイル名 `adr-<yyyymmdd>-<nnn>-<title>.md`、frontmatter は `status` `created` `updated` `decision-makers` `consulted` `informed`、リンクは参照スタイル。レシピの 3 ファイル（`README.md` `index.md` `adr-template.md`）は初回だけ写して置き、以後 `~/.claude` に依存しない。business-os 側に書く ADR は橋渡しの 1 本だけで、business-os の規則で書き、中身の判断には踏み込まない。
6. **`/verify-issue` との分担。** 汎用の部分（指示の混入の検査、作業指示の下書き、`agent-ready` の付与）は `dev-autopilot:intake` に置く。business-os の `/verify-issue` は business-os 固有の確かめ方（hook・雛形・第三者のツールの再現）を残し、最初と最後で `dev-autopilot:intake` を呼ぶ。
7. **Skill は Plugin に同封する。** 進行役・agent・Skill は印の形（4.3 節 R3-3）や引数で結びついていて、版がずれると黙って壊れるため、Plugin の 1 つの版で一緒に検査し、一緒に配る。別に公開して組み合わせる形は採らない。単体で使う価値があるのは `review` だけなので、`review` は手順の本体を単体で成り立たせ、dev-autopilot 向けの部分（印の 1 行、無人の入力、agent の名前）は引数で渡されたときだけ使う。`${CLAUDE_PLUGIN_ROOT}` や agent の名前を手順の本体に埋め込まない。分離後は skills CLI で `skills/review/` を単体導入できるので、別の場所へ写さない。

### 導入と点検を Plugin が担う（4.9 節 S1〜S4）

- **S1 導入（`/dev-autopilot setup`）**：足りないものを作る。何度実行しても同じ結果になる（冪等）。まず「何を作るか」の一覧を出し、人が承認してから作る。外部に影響が出る操作（ラベル・Project の欄・ruleset の作成）は 1 回の承認でまとめて行い、作った後に実物を読み戻して確かめる。
  - Plugin が作れるもの：ラベル（`agent-ready` `needs-human` `from-review`）、Project の Status の選択肢（In Review・Ready to Merge・Blocked）と単一選択欄「Agent」、base ブランチの ruleset（PR 必須・force push 禁止）、設定ファイル `.claude/dev-autopilot.json`（Project の ID や選択肢の ID は API で引いて書く）、cron（macOS は launchd の plist）の定義、worktree の置き場、記録のフォルダ。
  - 人がやるもの（Plugin は手順を示し、済んだかを点検で確かめる）：SSH 鍵の作成と GitHub への登録、fine-grained PAT の発行と保管、専用マシンの用意、利用枠の確認、処理対象にする Issue の選定。
- **S2 点検（`/dev-autopilot check`）**：前提がすべて揃っているかを機械で確かめ、fail / warn / pass で返す。進行役は毎回の実行の最初に同じ点検を回し、fail が 1 つでもあれば作業に入らず止まる（fail-closed）。見るもの：ラベルと Project の欄の存在、ruleset、設定ファイルの項目と ID の実在、`gh` の認証の権限、SSH 鍵で署名できるか、`claude` と Node の版、Skill の有無、worktree の残骸、前回の実行の記録。
  sandbox の安全設定は「設定に書いてある」ではなく、sandbox の中で読み取りを試して「実際に読めない」ことを確かめる（6 節）。`denyRead` がシンボリックリンクを解決しない不具合が 12 節の実機で見つかったため、`setup` は `denyRead` `denyWrite` のパスを実体に解決してから書く。
- **S3 設定ファイルの正本は 1 つ。** 導入が書き、点検が読み、進行役が使う。人が直接編集してもよいが、点検が整合を確かめる。
- **S4 business-os への導入は、最初の利用者として `setup` で行う。** 手で作らない。手で作ると、分離後に `setup` が別のリポで動く保証が無くなる。

### 配布範囲と文書規約の例外（12 節 判断 3・判断 5）

- **配布範囲は受け入れる（判断 3）。** `dev-autopilot/` は `test/` `evals/` と同じく、business-os の marketplace の `source: "./"` によって利用者にも配られる。配布物の名札が指す Skill・agent・hook には入れない。業務の固有名詞と秘密を置かない（`check:leak` の対象）。
  入れ子の `.claude-plugin/plugin.json` の扱いは 12 節の 0b の実機で確かめ済み：`claude plugin validate` は外側・入れ子の両方で通り（author の warn のみ）、`claude -p --plugin-dir <サブフォルダ> --agent dev-autopilot:worker` が動き、外側の Plugin と同時に読み込んでも両方の Skill を呼べた。
- **テストの置き場は配布に影響しない。** 何が配られるかを決めるのは `source` の指す先であり、ファイルの置き場ではない。単体テストを `src/` の隣に置いても `test/` に分けても、配られる量は変わらない。分離後に配布物を絞るか（`plugin/` と `src/` に分けて `source` を `./plugin` に向けるか）は 8 節の未決に残す。
- **Markdown の規則の例外（判断 5）。** business-os 側の橋渡し ADR で「`dev-autopilot/` では CLAUDE.md の規則 3（inline リンク）と規則 2 の bash の扱い以外の文書規約を適用せず、dev-autopilot 側の規則に従う」と決める。橋渡し ADR の accepted 後に、CLAUDE.md の規則 3 に例外の 1 行を足す。

### 分離の時期の目安（10 節）

段階 5（進行役のマージ）まで business-os で動かし、設定ファイルの項目だけで別のリポに適用できると確かめられたら分離する。
2 つ目の適用先ができる前に分離すると、固有の値がコードに残っていても気づけない。

### 影響（Consequences）

- 良い点: 分離はフォルダを移すだけで済み、文書の写しも supersede も要らない。
- 良い点: import の禁止と設定ファイルの一本化により、固有の値の混入を `check` と設定ファイルの項目で機械で見つけられる。
- 良い点: `setup` と `check` が導入の手順書を置き換え、前提の欠けを fail-closed で止める。
- 良い点: Skill・agent・進行役を 1 つの版で配るので、印の形や引数のずれが黙って壊れることを防げる。
- 悪い点: business-os の利用者にも `dev-autopilot/` が配られる。固有名詞と秘密を置かない規則と `check:leak` で守る。
- 悪い点: business-os の中に、Markdown の規約（参照スタイル）と ADR の規則（ファイル名・frontmatter）が異なる領域が 1 つできる。例外は橋渡し ADR と CLAUDE.md の 1 行で明示する。
- 悪い点: `hooks/lib` `scripts/lib` の関数を dev-autopilot 側にも持つため、同じ処理が 2 か所に存在しうる。分離の前提として受け入れる。
- 中立: tsconfig と vitest の include、markdownlint の `ignores` の変更は、本 ADR と橋渡し ADR の accepted 後に実装の PR で行う。

### 確認方法（Confirmation）

- `claude plugin validate` が `dev-autopilot/` で通り、`claude -p --plugin-dir dev-autopilot --agent dev-autopilot:worker` が動く（0b で確認済み。実装の PR でも再確認する）。
- `dev-autopilot/src/` と `dev-autopilot/test/` に、business-os の `hooks/` `scripts/` を指す import が無いことを grep で確かめる（`check` の項目にする）。
- `.claude/dev-autopilot.json` に 10 節「守ること」2 の項目がすべてあり、ID が実在することを `check` が確かめる。
- business-os の `pnpm check` で `dev-autopilot/**/*.ts` の型検査と `dev-autopilot/**/*.test.ts` が走り、markdownlint・`check:adr`・`check:docs` が `dev-autopilot/` を対象にしないことを、設定ファイルの実物で確かめる。
- `setup` を 2 回続けて実行しても 2 回目が何も作らないこと、作った後の読み戻しが実物と一致することを、結合テスト（`dev-autopilot/test/`）で確かめる。
- `check` が、sandbox の中で `~/.ssh` と `gh` の設定の実体を読めないことを、読み取りを試して確かめる（書いてあることではなく、実際に読めないこと）。
- business-os への導入が `setup` で行われたことを、手で作った項目が無いことで確かめる（S4）。

## 選択肢ごとの長所と短所（Pros and Cons of the Options）

### A: business-os の中の 1 つのフォルダに Plugin の形で閉じ、後で分離する

- 良い点: 最初の適用先（business-os）で動かしながら、固有の値を設定ファイルに出し切れたかを確かめられる。
- 良い点: business-os の `pnpm check` と CI をそのまま使え、検査の対象から外れる領域を作らない。
- 良い点: 分離はフォルダを移すだけで、Plugin の名札・Skill・agent・文書が揃ったまま移る。
- 中立: 入れ子の Plugin の扱いは Claude Code の挙動に依存する。0b で動くことを確かめた。
- 悪い点: business-os の利用者にも配られる。固有名詞と秘密を置かない規則で守る。
- 悪い点: business-os の検査設定（tsconfig、vitest、markdownlint の `ignores`）に dev-autopilot 向けの項目が入り、分離のときに外す作業が要る。

### B: 最初から別リポジトリで作る

- 良い点: 配布範囲の問題が無く、文書規約の例外も要らない。
- 良い点: import の禁止が構造で保証される。
- 悪い点: 2 つ目の適用先ができる前に分離するため、固有の値がコードに残っていても気づけない（10 節「分離の時期の目安」）。
- 悪い点: business-os の変更（`/verify-issue` の拡張、ruleset、設定ファイル）と dev-autopilot の変更が 2 つのリポにまたがり、段階 0〜5 の間に版の対応を人が追う必要がある。
- 悪い点: CI・検査・リリースの仕組みを最初から別に用意する必要があり、段階 0 の負担が増える。

### C: business-os の既存のフォルダに分けて置く

`.claude/skills/` に Skill、`.claude/agents/` に agent、`scripts/` に進行役、`test/` にテストを置く形。要件メモ 2 節の初期の決定（エージェント定義を開発専用の `.claude/agents/` に置く）に近い。

- 良い点: 既存の検査設定を変えずに済む。
- 良い点: business-os の開発専用 Skill（`.claude/skills/`）と同じ置き場で、開発者に馴染みがある。
- 悪い点: 分離のときに各所から拾い集める必要があり、漏れが出る。文書も business-os の `docs/` に混ざり、supersede が要る。
- 悪い点: `scripts/lib` の関数を使いたくなり、import の禁止を守りにくい。
- 悪い点: Plugin の名前空間（`dev-autopilot:worker`）で呼べず、分離後に呼び方が変わる。
- 悪い点: `scripts/` と `test/` は business-os の配布物と検査の対象であり、dev-autopilot の変更が business-os の `check:*` の実装と同じ扱いを受ける。

## 補足情報（More Information）

- 決定の元になった一次情報は [要件メモ][memo] の 4.9 節・6 節・10 節・12 節（判断 3・判断 5・0b の実機の結果）と、5 節の P7・P14 である。
- 要件メモ 2 節の「エージェント定義を開発専用の `.claude/agents/` に置く」は、10 節の決定（`dev-autopilot/agents/`）で置き換わっている。本 ADR は 10 節に従う。
- business-os 側の橋渡し ADR は、business-os の規則（`docs/adr/README.md`、`YYYYMMDD-nn-<slug>.md`、4 日付欄、inline リンク）で別に起票する。本 ADR と橋渡し ADR の両方が accepted になってから、tsconfig・vitest・markdownlint の設定変更と `setup` `check` の実装に入る（7 節の段階 0a → 0c）。
- 実装の順は、0b（薄切り。入れ子の Plugin と sandbox の確認。12 節で済み）→ 0c（`setup` と `check` の実装と、`setup` による準備。`check` が business-os で全項目 pass したら出口）。
- 見直しの時期：段階 5 の出口（10 件で人の判断と進行役の判定が全件一致）に達し、設定ファイルの項目だけで別のリポに適用できると確かめられたとき。分離を実行するときは、`source` を絞るかの未決（8 節）も合わせて決める。
- `review` Skill の v2 への組み直しは 9 節の方針で別に進める。本 ADR が決めるのは正本を `dev-autopilot/skills/review/` に置くことまでで、手順の中身は本 ADR の範囲外とする。

[memo]: ../dev-autopilot-requirements.md
