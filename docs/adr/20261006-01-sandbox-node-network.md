---
id: 20261006-01
title: 雛形の env で Node にプロキシを使わせ、npm のキャッシュを sandbox の一時フォルダに置く。通信先と書き込み先の許可は雛形に足さない
type: decision
business: n/a
status: accepted
created: 2026-10-06
updated: 2026-10-06
as_of: 2026-10-06
verified: 2026-10-06
supersedes: n/a
---

# 20261006-01: 雛形の env で Node にプロキシを使わせ、npm のキャッシュを sandbox の一時フォルダに置く。通信先と書き込み先の許可は雛形に足さない

## 背景と問い

利用者から Issue #61 が届いた。雛形（`templates/settings.json.tmpl`）の sandbox を有効にした company で、CC が `npx skills find <語>` を実行すると、エラーを出さずに「No skills found」と返る。
Skill が本当に無いのか、通信が失敗したのかを利用者が区別できない（黙って失敗する）。

Issue #61 は、雛形に次を足す案を出している。

- `env.NODE_USE_ENV_PROXY: "1"`
- `sandbox.network.allowedDomains`：`github.com`、`api.github.com`、`raw.githubusercontent.com`、`registry.npmjs.org`、`skills.sh`
- `sandbox.filesystem.allowWrite`：`~/.npm/_cacache`
- 任意で `env.DO_NOT_TRACK: "1"`
- `/retro` の 2 回ルールに「業務 Skill を作る前に `npx skills find` で既製品を探す」を足す

2026-10-04 と 2026-10-06 に、macOS、Claude Code 2.1.285、Node v24.3.0、skills CLI 1.7.0 で確かめた（「実行」は手元で動かした結果、「文書」は公式の文書）。
2026-10-04 の結果は Issue #61 のコメントに書いた。

- **Node の `fetch` はプロキシを使わない**（実行）：sandbox の中のコマンドは、Claude Code が渡すプロキシの環境変数（`HTTPS_PROXY` など）を通してだけ外に出られる。
  `allowedDomains` に `skills.sh` を入れても、curl は届き（HTTP 200）、Node の `fetch` は名前解決に失敗した（`ENOTFOUND`）。
  `NODE_USE_ENV_PROXY=1` を付けると、Node の `fetch` もプロキシを通って届いた。Claude Code の文書は、プロキシの環境変数を使わない道具は許可した通信先にも届かないと書いているが、Node の `fetch` を名指ししていない
- **skills CLI は失敗を握りつぶす**（実行とソース）：skills CLI 1.7.0 の検索は、`catch` と HTTP の失敗のどちらでも空の結果を返し、「No skills found」を表示して終了コード 0 で終わる
- **許可していない通信先の扱い**（文書）：通信先の許可は空から始まる。対話モードでは、コマンドが初めて使う通信先で Claude Code が確認を出す。
  auto モードでは、Claude がコマンドに使う通信先を添え、分類器が判定する。非対話（`claude -p`）では、確認が出ずに拒否された（実行）
- **`allowedDomains` だけでは直らない**（実行）：`allowedDomains` を足しても、`NODE_USE_ENV_PROXY` が無いと Node の `fetch` は届かなかった
- **`~/.npm/_cacache` だけでは `npx` が動かない**（実行）：取得済みでない版の `npx` は `~/.npm/_npx/` にも書き込み、`EPERM` で失敗した。
  npm はこの失敗を「root 所有のファイル」と誤って示し、`sudo chown` を勧める。`~/.npm/_npx` も許すと動いた
- **`~/.npm/_npx` を書き込み可にする危険**：`~/.npm/_npx/` に展開されたパッケージのコードは、のちに sandbox の外で同じパッケージを `npx` で実行したときにも動く。
  sandbox の中から、sandbox の外で動くコードを書き換えられる経路になる
- **npm のキャッシュを一時フォルダに向けると、`~/.npm` に触れずに動く**（実行）：雛形の設定に `env.npm_config_cache: "${TMPDIR}/npm-cache"` を足すと、
  npm は `${TMPDIR}` を sandbox の一時フォルダ（macOS では `/tmp/claude-<uid>`）に展開した。`allowWrite` を足さずに、取得済みでない版の `npx` も動いた。
  sandbox の一時フォルダは、sandbox の外のコマンドが使う `$TMPDIR` と別の場所になる（文書）
- **`DO_NOT_TRACK`**（ソース）：skills CLI は `DISABLE_TELEMETRY` か `DO_NOT_TRACK` があると、テレメトリ（`add-skill.vercel.sh`）を送らない。止めても検索は動いた（実行）
- **既製品の検索の道具**（実行）：`gh skill search` は GitHub の Code Search API で `SKILL.md` を探す。結果は同じ Skill の写しが多く並び、導入数は出ない。
  `gh` の認証情報は雛形の `denyRead`（`~/.config/gh/**`）で sandbox の中から読めない。`npx skills find` は skills.sh の導入数の順に並ぶ
- **ADR 20260929-08**：第三者の Skill を入れる前に `gh skill preview` で中身を確かめ、`--pin` で版を固定すると決めている。`gh skill`（2.91.0、プレビュー）は `search`・`preview`・`install`・`update` を持つ
- **既存の company への届き方**：`.claude/settings.json` は保護対象で、CC は提案と `/approve` を経ないと書けない（20260929-05）。
  `/check` の「settings.json が雛形の必須規則を含む」は、決まった 6 項目だけを照合し、`env` と `sandbox.network` と `allowWrite` を見ない

問い：

1. Node の `fetch` が黙って失敗するのを、どう止めるか
2. `npx` を sandbox の中で動かすために、書き込み先をどこまで広げるか
3. 通信先の許可を、雛形に入れるか
4. 既製品を探す手順を、`/retro` にどう書くか
5. 既存の company に、どう届けるか

## 判断の基準

- 黙った失敗を無くす。失敗するなら、利用者に見える形で失敗する
- 雛形の sandbox の許可（通信先・書き込み先）を広げない。広げるなら、広げる範囲を最小にし、理由を残す
- sandbox の中から、sandbox の外で動くコードを書き換えられる経路を作らない
- ADR 20260929-08（第三者の Skill は中身を確かめ、版を固定する）と矛盾しない
- 既存の company が、雛形に追いついていないことに気づける

## 検討した案

通信と書き込み（問い 1〜3）：

- 案 A：Issue #61 の提案どおり、`NODE_USE_ENV_PROXY`・通信先 5 つ・`~/.npm/_cacache` を雛形に足す（`npx` を動かすには `~/.npm/_npx` も要る）
- 案 B：`NODE_USE_ENV_PROXY` と `npm_config_cache`（sandbox の一時フォルダ）と `DO_NOT_TRACK` だけを雛形の `env` に足す。通信先と書き込み先の許可は足さない
- 案 C：案 B に加えて、`skills.sh` と `registry.npmjs.org` だけを雛形の `allowedDomains` に足す
- 案 D：雛形は変えず、利用者が各自 `.claude/settings.local.json` に足す

## 決定

採用：**案 B**。

黙った失敗の本当の原因は、Node の `fetch` がプロキシを通らないことにある。`NODE_USE_ENV_PROXY` で Node もプロキシを通れば、許可していない通信先では Claude Code の確認が出るので、失敗が利用者に見えるようになる。
`NODE_USE_ENV_PROXY` は許可を広げない。`npm_config_cache` を sandbox の一時フォルダに向ければ、`~/.npm` への書き込みを許さずに `npx` が動き、sandbox の外で動くコードを書き換える経路を作らずに済む。
通信先は、必要になったときに利用者が確認で許せばよく、雛形で先に開ける理由が弱い。

1. 雛形の `env` に次の 3 つを足す
   1. `NODE_USE_ENV_PROXY: "1"`：Node の `fetch` にプロキシの環境変数を使わせる
   2. `npm_config_cache: "${TMPDIR}/npm-cache"`：npm と `npx` のキャッシュを sandbox の一時フォルダに置く。`${TMPDIR}` は npm が展開する（Claude Code は展開しない）
   3. `DO_NOT_TRACK: "1"`：skills CLI などのテレメトリを止める。止めても検索は動き、テレメトリの送り先の確認も出なくなる
2. `sandbox.network.allowedDomains` と `sandbox.filesystem.allowWrite` は雛形に足さない
   - 通信先は、対話モードでは初めて使うときに Claude Code が確認を出す。利用者が許せば、その会話の間は通る。auto モードでは分類器が判定する
   - `~/.npm/_cacache` と `~/.npm/_npx` を書き込み可にしない
3. 共通規約（`templates/skill-conventions.md`）に、sandbox の中で起きる失敗の扱いを足す
   1. npm の `EPERM` と「root 所有のファイル」の表示は、sandbox が書き込みを止めた結果であることが多い。`sudo chown` を実行しない・勧めない
   2. 通信を伴うコマンドが「見つからない」「空」を返したら、通信の失敗を疑い、通信先の確認が出たかを人に聞く。結果をそのまま「無い」と結論しない
4. `/retro` の 2 回ルールに、業務 Skill を作る前に既製品を探す手順を足す
   1. 探すのは CC が `npx skills find <語>` で行う（sandbox の中で動き、導入数の順に並ぶ）
   2. 入れるかどうかは人が決める。入れる前に、人が `gh skill preview` で中身を確かめ、`gh skill install --pin` で版を固定して入れる（20260929-08）。
      `gh` は sandbox の中で認証情報を読めず、入れる先も company の外（利用者のスコープ）になりうるので、人が入力欄で `!` を付けて実行するか、通常のターミナルで実行する
5. 既存の company に届ける
   1. 起動時の軽い点検と `/check` は、`.claude/settings.json` の `env` に決定 1 の 3 つが無ければ warn を出す（fail にしない。無くても安全は損なわれず、通信の失敗が見えにくくなるだけのため）
   2. CHANGELOG と `docs/usage/` の更新の案内に、人が `.claude/settings.json` に足す 3 行を示す
6. find-skills（skills CLI）そのものは business-os に同梱しない（20260929-08）。利用者が使うときは、決定 4 の手順で `npx` から呼ぶ

## 影響

- 良い影響
  - Node 製の道具の通信が、許可していない通信先で黙って失敗せず、Claude Code の確認として見えるようになる。find-skills に限らない
  - `npx` が sandbox の中で動く。`~/.npm` への書き込みを許さないので、sandbox の外で動くコードを書き換える経路を作らない
  - 雛形の sandbox の許可（通信先・書き込み先）は広がらない
  - 既製品を探す手順と入れる手順が分かれ、入れる手順は 20260929-08 のとおり人が中身を確かめて版を固定する
- 悪い影響
  - 通信先を許していない利用者は、`npx` や検索を使うたびに通信先の確認に答える手間がある（「今後は聞かない」を選べば手間は減る）
  - `npm_config_cache` が一時フォルダを指すので、一時フォルダが消えると npm のキャッシュも消え、次の `npx` で取り直す
  - 非対話（`claude -p`、バックグラウンドの作業）では通信先の確認が出ないので、`allowedDomains` に無い通信先には届かない。skills CLI のように失敗を握りつぶす道具は、その場合は黙って失敗する
  - 雛形の `env` が増え、点検で見る項目が増える
- その他
  - 確かめられていないもの：Linux / WSL2 で `${TMPDIR}` が sandbox の一時フォルダに展開されるか（Claude Code の文書は、ファイルの隔離が有効なら `$TMPDIR` を一時フォルダに向けると書いている）、
    Node 24 より前の Node での `NODE_USE_ENV_PROXY`（business-os は Node 24 を前提にする）。実装の PR で、Linux の CI か手元で確かめる
  - 対話モードで「今後は聞かない」を選ぶと、Claude Code は通信先の許可を `.claude/settings.local.json` に書く。`.claude/settings.local.json` は保護対象（20261003-11）なので、
    書き込みが止まらないかを実装時に確かめる（20261003-11 の「その他」と同じ論点）
  - skills CLI が失敗を握りつぶすことは、上流（vercel-labs/skills）に報告するかを別に決める

## 案ごとの長所と短所

### 案 A：Issue #61 の提案どおりに足す

- 長所：利用者は確認に答えずに `npx` と検索を使える
- 短所：通信先が 5 つ開き、全利用者の sandbox の許可が広がる。`npx` を動かすには `~/.npm/_npx` も書き込み可にする必要があり、sandbox の外で動くコードを書き換える経路ができる

### 案 B：`env` に 3 つだけ足し、許可は足さない

- 長所：許可を広げずに、黙った失敗を見える失敗に変えられる。`npx` も動く
- 短所：通信先の確認に答える手間が残る。非対話では許可していない通信先に届かない

### 案 C：案 B に `skills.sh` と `registry.npmjs.org` を足す

- 長所：既製品の検索と `npx` の取得で確認が出なくなる
- 短所：全利用者に 2 つの通信先が開く。`registry.npmjs.org` が開くと、sandbox の中から任意の npm パッケージを取得して動かせる

### 案 D：雛形は変えず、利用者が各自で足す

- 長所：雛形が変わらない
- 短所：全利用者が同じ罠を踏み、黙った失敗のまま気づけない。フェイルセーフにならない

## 参考

- Issue #61 と、その検証のコメント（2026-10-04）
- Claude Code 公式「Configure the sandboxed Bash tool」（プロキシ、許可していない通信先の扱い、一時フォルダ）<https://code.claude.com/docs/en/sandboxing>
- Node.js の `NODE_USE_ENV_PROXY`（Node の `fetch` にプロキシの環境変数を使わせる）
- 関連 ADR：20260929-05（ステージングと承認、四重防衛）、20260929-06（起動時セルフチェック）、20260929-08（既製のものは参考にし、fork しない。第三者の Skill の確認と版の固定）、
  20261003-11（`.claude/settings.local.json` の保護）、20261004-02（配布する Skill の数と分類）
- `templates/settings.json.tmpl`、`hooks/lib/settings.ts`（`missingRules`）、`skills/retro/SKILL.md`（2 回ルール）
