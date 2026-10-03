---
id: 20261003-02
title: Skill の自動検証で残した 4 つの論点の扱い
type: decision
business: n/a
status: proposed
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: n/a
supersedes: n/a
---

# 20261003-02: Skill の自動検証で残した 4 つの論点の扱い

## 背景

20261003-01 は、Skill の動作を `claude plugin eval` で検証すると決め、次の 4 つを後続の検討として残した。

1. `/onboard` の最後の段階（`.claude/settings.json` の書き込みと `state: active` への切り替え）の自動検証
2. Bash を許可する実行の環境
3. 1 ターンずつ進めて質問の流れを確かめる進行役
4. 導入済みの company を前提にするケースで、`test/fixtures/company/` を scaffold から使えるか

2026-10-03 に、Claude Code 2.1.285・macOS・haiku で小さなケースを作って確かめた。

| 論点 | 試したこと | 結果 |
|---|---|---|
| 1 | `--allow-tools` に `Write(.claude/**)` と `Edit(.claude/**)` を足し、`.claude/settings.json` に書かせた | 拒否された（don't ask mode）。Claude Code 自体が `.claude/` を保護しており、eval では書けない |
| 1 | `state: initializing` の `.business-os.json` を Edit で `active` に変えさせた | business-os の hook の確認（ask）が、`-p` では拒否として返った。拒否の文言（`business-os: 初期化中（/onboard）に既存の保護対象を書き換えます：.business-os.json`）が記録（trace）に残る |
| 2 | `DOCKER_CONFIG` を空のフォルダに向けて、Bash を許可した実行を始めた | 始まらない。`~/.docker` そのものも検査され、Docker Desktop が `cli-plugins/` に置く標準のシンボリックリンクで止まる |
| 2 | Linux のコンテナ（`node:24-bookworm-slim`）で bubblewrap を動かした | 既定の設定と、seccomp・AppArmor を外した設定では動かない。`--privileged` なら動く。コンテナの中で eval を最後まで動かすことは未検証 |
| 3 | `claude -p --plugin-dir .` を `--safe-mode` で起動した | 使えない。`--plugin-dir` の Plugin は一覧に載るが、その Skill と hook が読み込まれない |
| 3 | `--bare` の説明を読んだ | 使えない。認証が API キーに限られ、サブスクリプションのログインを読まない |
| 3 | `--setting-sources ""` と `--strict-mcp-config` を付けて起動した | 使える。Skill は business-os の 10 個と Claude Code に組み込みのものだけ、Plugin は business-os と組み込みのものだけ、MCP は無し。hook は business-os の SessionStart だけが走った。利用者の `CLAUDE.md` の一節を引用させると「無い」と答え、入力のトークン数は通常の起動より約 6,500 少ない。認証はサブスクリプションのまま |
| 3 | 同じ条件で `--resume <session_id>` で次のターンを送った | 前のターンの内容を引き継いだ |
| 4 | scaffold で `"$(dirname "$0")"` を基準に `test/fixtures/company/` を複製した | 成功。scaffold は元のケースのフォルダから実行される |

Bash が要る Skill の手順は、`/check`（`scripts/check.ts` を Bash で実行する）と、`/onboard` の Obsidian のファイルのコピーとコミットだけである。
`/check` の判定ロジックは `test/scripts/check.test.ts` が vitest で検査している。

## 決定

### 1. `/onboard` の最後の段階

1. `.claude/settings.json` は、記録に残る Write の呼び出しの内容で判定する（`model`、sandbox と permissions の規則、`{{` が残っていないこと）。
   書く順番は、Write の `file_path` に合う `tool_order` で判定する。ファイルそのものの有無は判定しない
2. `state: active` への切り替えは、別のケースで確かめる。scaffold で `.claude/settings.json` まで書き出した状態（`state: initializing`）を用意し、
   `/onboard` に再開させる。hook の確認の文言が記録に残ることを `regex`（`target: trace`）で判定する
3. 確認で「Yes」と答えた後の段階（`state: active` の書き込み、日報への記録、コミット）は、手で確かめる

### 2. Bash が要るケース

1. eval の対象外とする。Bash を許可する実行は行わない
2. `/check` の判定ロジックは vitest の検査に任せる。`/onboard` の Obsidian のファイルのコピーとコミットは、手で確かめる
3. Bash が要る Skill が増えたとき、または Bash を許可する実行が手元の環境で始まるようになったときに見直す

### 3. 質問の流れを確かめる進行役

1. 作る。TypeScript で書き、Node が直接実行する。置き場は `evals/` の下とし、`pnpm check` には含めない
2. 一時フォルダに作った作業場所で、`claude -p --plugin-dir <business-os> --setting-sources "" --strict-mcp-config --output-format json` で始め、
   同じ引数に `--resume <session_id>` を足して 1 ターンずつ進める。`/onboard` は最初に `.business-os.json` を書くため、作業場所への Write は許可する
3. 答えは台本で決める。台本は「期待する質問の手がかり（キーワード）」と「答え」の組を質問の順に並べたもの。
   進行役は、各ターンの質問が台本の順番と合うか、1 ターンに 1 つの項目だけを聞いているかを判定し、成否を終了コードで返す
4. 対象は質問の流れに絞る。「書き出す前の確認」で書き出しを断り、ファイルは書かせない（書き出しは eval のケースで確かめる）
5. `-p` には AskUserQuestion が無いため、選択肢の画面そのものは確かめられない。質問はテキストで受け、答えもテキストで返す
6. 進行役は eval の隔離された環境の外で動く。利用者の設定・`CLAUDE.md`・他の Plugin・MCP は、2 の引数で読み込まない。
   Claude Code に組み込みの Skill と Plugin、管理者の設定（managed settings）は読み込まれるが、許容する
7. 会話の記録は、通常の起動と同じく `~/.claude/projects/` の下に作業場所ごとのフォルダとして残る。進行役は終わるときに、自分の作業場所のフォルダだけを消す

### 4. 導入済みの company を前提にするケース

1. scaffold で `test/fixtures/company/` を複製して使う。パスはケースのフォルダからの相対パスで書く
2. ケースごとの差分（状態の書き換え、ファイルの追加）は scaffold の中で重ねる

## 根拠

- 1：eval の実行環境で書けないファイルを、書けたかどうかで判定すると常に失敗する。書こうとした内容と順番は記録で確かめられ、
  hook の確認は拒否の文言として記録に残るため、無料の判定方式だけで「確認が出ること」を確かめられる
- 2：Bash を許可する実行を手元で動かすには、`--privileged` のコンテナと、サブスクリプションの長期トークン（`claude setup-token`）が要る。
  トークンは持ち運べる形で有効期間が長く、漏れると第三者が利用枠を使える。Bash が要る手順は少なく、`/check` のロジックは別に検査済みのため、
  トークンを管理する手間と危険に見合わない
- 3：1 度に 1 つずつ聞くことと質問の順番は `/onboard` の手順の一部で、回答表の方式では確かめられない。
  台本で答えを固定すると、判定用モデルを使わずに結果が再現する
- 4：フィクスチャを 1 か所に保つ。ケースごとに company を複製して持つと、雛形の変更に追従しきれない
- 検討した代替案
  - 2 を手元の Docker（`--privileged`）で動かす：自動化はできるが、長期トークンの保管と、コンテナ内での実行の検証が要る。今は不採用
  - 2 を GitHub Actions で手動起動にする：API キーなら別途請求が発生する。サブスクリプションのトークンを使えるかは未検証。今は不採用
  - 3 の答えを判定用モデルに作らせる（模擬利用者）：答えが実行ごとに変わり、失敗の再現が難しい。不採用

## 影響

- `/onboard` のケースは、初回の導入と「確定の確認」の 2 つ以上になる
- 進行役は `claude -p` を直接起動するため、eval と同じく実行のたびにメンテナの利用枠を消費する
- 手で確かめる項目は次に限られる：確認で「Yes」と答えた後の段階、Obsidian のファイルのコピーとコミット、選択肢の画面、Obsidian の画面操作
- Bash を許可する実行を後で採用する場合は、長期トークンを平文で置かない（1Password などに保管し、実行の間だけ環境変数で渡す）ことを条件にする

## 参考

- Claude Code のドキュメント「plugin evals」：<https://code.claude.com/docs/en/plugin-evals.md>
- 関連 ADR：20261003-01（Skill の動作は claude plugin eval で CC が手元で検証する）、20260929-06（起動時セルフチェック）
