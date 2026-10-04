---
id: 20261004-01
title: business-os への報告は Skill を増やさず、共通のスクリプトが検査済みの下書きと入力済みの Issue 作成 URL を作り、送信は人が行う
type: decision
business: n/a
status: proposed
created: 2026-10-04
updated: 2026-10-04
as_of: 2026-10-04
verified: n/a
supersedes: n/a
---

# 20261004-01: business-os への報告は Skill を増やさず、共通のスクリプトが検査済みの下書きと入力済みの Issue 作成 URL を作り、送信は人が行う

## 背景と問い

business-os の利用者が不具合や改善の提案を伝える経路は、いま次の 4 つに分かれている。

- Issue のフォーム（`.github/ISSUE_TEMPLATE/bug_report.yml` と `proposal.yml`）。冒頭で「事業データや認証情報を貼らない」と注意している
- `/check` の対処の表：「防衛の発火」が fail / warn なら「business-os の不具合なら business-os のリポジトリの Issues に報告する」
- `/retro` の手順 6：business-os への改善案を振り返りに書く。Issue の作成は外部への行動なので、人が頼んだときだけ、送る前に確認して行う
- `docs/usage/getting-started.md` の「困ったとき」：不具合・提案は Issues へ。事業データは絶対に貼らない

2026-10-04 に利用者から届いた Issue（#61、sandbox の中で `npx skills find` が黙って失敗する）を検証した。
報告の中身は正確だったが、再現に要った情報の一部は、Issue のフォームが聞いていないものだった。

- Claude Code・Node・第三者のツールの版、OS（フォームが聞いている）
- `.claude/settings.json` が雛形と違うキー、`.claude/settings.local.json` の有無（フォームが聞いていない。sandbox の挙動はこの 2 つで変わる）
- 対話モードで起きたか、`claude -p` で起きたか（フォームが聞いていない。許可していない通信先の扱いが違う）

メンテナからは、報告を手伝う Skill を business-os に同梱する案が出ている。検討の前提になる事実：

- 経営基盤 Skill は 10 個で固定し、増やすなら ADR で議論する（20260929-07）
- 外部に影響が出る行動（送信・投稿・公開）は、実行の前に人に確認する（20260929-05、`templates/skill-conventions.md`）
- business-os の Issues は公開で、事業データは各利用者の非公開の company リポにある（20260929-10）。
  company の作業場所で CC が報告の文面を組み立てると、事業データが公開の Issue に混ざる経路になる
- company には、`/onboard` が書く固有名詞の辞書 `.leak-dict.json`（会社の呼び名・事業名・人名・取引先名。gitignore 済み）がある（20260929-04）
- 雛形の sandbox は通信先を許可していない。#61 の検証では、`claude -p` の sandbox の中から `api.github.com` へ届かなかった。利用者が `gh` の認証を済ませているとも限らない
- GitHub は、Issue 作成の URL のクエリで、題・本文・テンプレートと、Issue フォームの各項目（項目の `id` で指定）を事前に入力できる。
  長すぎる URL は 414 で拒否される。`labels` などの指定は、指定する権限を持つ人にだけ効く
- `SECURITY.md` は、hook が例外時に通してしまう（fail-open）問題を、公開の Issue ではなく非公開の報告（private vulnerability reporting）で受けると定めている。
  一方で `/check` の対処の表は、「防衛の発火」の fail を公開の Issues に報告するよう案内しており、`SECURITY.md` と食い違っている

問い：

1. 利用者が報告するのを、business-os はどこまで手伝うか。手伝うなら、Skill を増やすか、既存の Skill を広げるか
2. 報告の送信を、CC が行うか、人が行うか
3. 報告に事業データが混ざらないことを、何で守るか
4. 安全装置の不具合（脆弱性にあたりうるもの）を、どの経路に振り分けるか

## 判断の基準

- 事業データが公開の Issue に混ざらない。CC の注意だけに頼らず、機械の検査で止め、検査に引っかかったら URL を出さない（安全側へ倒れる）
- 送信は取り消せない公開の行動なので、最後に人が中身を目で見てから送る
- 雛形の sandbox の通信先と、利用者の `gh` の準備に依存しない
- 経営基盤 Skill の数（10 個）を増やさない理由が無い限り、増やさない
- 検証する側（メンテナ）が再現に要る情報が、漏れなく報告に入る

## 検討した案

- 案 A：報告の Skill（例：`/report`）を新しく同梱し、CC が `gh issue create` で送る
- 案 B：報告の Skill を新しく同梱し、検査済みの下書きと入力済みの Issue 作成 URL を作る。送信は人が行う
- 案 C：Skill は増やさず、共通のスクリプトが検査済みの下書きと入力済みの Issue 作成 URL を作る。`/check` と `/retro`、および利用者が報告を頼んだときに使う。送信は人が行う
- 案 D：仕組みは足さず、Issue のフォームに項目を足すだけにする

## 決定

採用：**案 C**。

報告の手伝いに要るのは、環境の情報を正確に集めることと、事業データを確実に取り除くことの 2 つで、どちらも Skill の対話より決まった処理（スクリプト）が向いている。
スクリプトにすれば、事業データの検査を `.leak-dict.json` で機械的に行え、検査に引っかかったら URL を出さずに止められる。
報告の入口はすでに `/check` と `/retro` にあるので、Skill を増やさずに済む（20260929-07）。送信を人がブラウザで行うので、sandbox の通信先と `gh` の準備に依存しない。

1. 経営基盤 Skill は 10 個のまま増やさない
2. 報告の下書きを作るスクリプトを `scripts/` に TypeScript で足す（20260929-01）。スクリプトは次を行う
   1. 環境の情報を集める：business-os の版（`.business-os.json` の `pluginVersion` と `plugin.json` の版）、OS、`claude --version`、`node --version`
   2. 設定の差を集める：`.claude/settings.json` が雛形と違うキーの名前、`.claude/settings.local.json` の有無とその中の sandbox に関わるキーの名前。
      **値は写さない**（`allowedDomains` やパスに事業や利用者の名前が入りうるため）
   3. CC が書いた「起きたこと」「期待した動き」「再現の手順」と、`/check` の fail / warn の行を受け取る
   4. 下書き全体を検査する：`.leak-dict.json` の語、`check:leak` と同じ型（メールアドレス、通貨付きの金額、許可リストに無いドメイン）、ホームのパスに含まれる利用者名。
      1 件でも見つかれば、URL を作らずに見つかった箇所を示して終わる（終了コードは 0 以外）。`.leak-dict.json` が無いか読めないときも、URL を作らない
   5. 検査を通ったら、下書きを Markdown のファイルに書き、Issue のフォームの項目を事前に入力した Issue 作成の URL を示す。
      URL が長くなりすぎる部分（長いログ）は URL に入れず、下書きのファイルから人が貼る
3. 送信は人が行う。CC は business-os のリポジトリに `gh issue create` や API で Issue を作らない。
   CC は下書きのファイルと URL を示し、「ブラウザで中身を確かめてから送信してください」と伝えて終える
4. 入口
   1. `/check`：「防衛の発火」以外の分類で、business-os の不具合と見られる fail があれば、報告するかを聞き、報告するならスクリプトを使う
   2. `/retro`：手順 6 の「business-os への改善案」を、人が報告を頼んだときにスクリプトに渡す（提案のフォーム `proposal.yml` を使う）
   3. どの Skill の途中でも、利用者が「business-os に報告したい」と頼んだら、共通規約（`templates/skill-conventions.md`）の手順でスクリプトを使う
5. 安全装置の不具合は非公開の経路に振り分ける。`/check` の「防衛の発火」が fail のときは、公開の Issue ではなく `SECURITY.md` の非公開の報告を案内する。
   `/check` の対処の表の該当の行も、`SECURITY.md` に合わせて直す。スクリプトは、防衛の発火の fail を含む下書きには Issue 作成の URL を作らず、非公開の報告の URL を示す
6. Issue のフォーム（`bug_report.yml`）に、検証に要る項目を足す：設定が雛形と違うキー、`.claude/settings.local.json` の有無、対話モードか `claude -p` か。
   項目の `id` はスクリプトが事前入力に使うので、スクリプトと合わせて決める
7. 下書きのファイルの置き場は、company の追跡されない場所にする。置き場（雛形の `.gitignore` に 1 行足すか、OS の一時フォルダか）は、
   sandbox の中から書けるかと、既存の company の `.gitignore` に無い場合の扱いを確かめてから、実装の PR で決める

## 影響

- 良い影響
  - 報告に、再現に要る環境の情報と設定の差が漏れなく入る。メンテナの検証（開発専用の `/verify-issue`）が速くなる
  - 事業データの混入を、CC の注意ではなく機械の検査で止める。検査に引っかかったら URL を出さないので、失敗は「報告できない」側に倒れる
  - 最後に人が中身を見て送るので、検査が見逃したものにも人が気づける
  - sandbox の通信先と `gh` の準備が要らない。Skill の数も変わらない
  - 安全装置の不具合が、公開の Issue に書かれなくなる
- 悪い影響
  - 送信のたびに人の手間（ブラウザで開いて確かめ、送信する）が残る
  - `.leak-dict.json` に無い固有名詞（`/onboard` の後に増えた取引先など）は、検査で見つけられない。人の目に頼る部分が残る
  - スクリプトと Issue のフォームの項目の `id` を合わせて保つ必要がある（片方だけ変えると事前入力が黙って外れる）。合っているかを `check:*` で確かめる
- その他
  - Issue のフォームの項目のうち、どの種類（入力欄・選択肢など）が URL で事前に入力できるかは、GitHub の文書に書かれていない。実装時に実機で確かめる
  - 下書きのファイルが company の追跡される場所に残ると、非公開とはいえ company の履歴に報告の文面が残る。置き場は決定 7 のとおり実装時に決める
  - 利用者がブラウザの GitHub にログインしていないと送信できない。GitHub のアカウントを持たない利用者の報告経路は、この ADR では扱わない

## 案ごとの長所と短所

### 案 A：報告の Skill を同梱し、CC が `gh issue create` で送る

- 長所：利用者の手間が最も少ない。報告の形が揃う
- 短所：Skill が 11 個になる。雛形の sandbox では `api.github.com` に届かず、通信先の許可を広げる必要がある。`gh` の認証も要る。
  CC が組み立てた文面が、人が見ないまま公開されうる。事業データが混ざったときに取り消せない

### 案 B：報告の Skill を同梱し、下書きと URL を作る（送信は人）

- 長所：送信を人が行うので、案 A の公開の危険と通信の問題は無い。報告の入口が 1 つにまとまって分かりやすい
- 短所：Skill が 11 個になる。報告の入口になる `/check` と `/retro` の途中から、別の Skill に移る手間がある。
  事業データの検査を Skill の手順（CC の注意）に書くと、機械の検査より弱い

### 案 C：Skill は増やさず、共通のスクリプトが下書きと URL を作る（送信は人）

- 長所：Skill の数が変わらない。事業データの検査と環境の情報の収集を、決まった処理で行える。報告の入口は既存の `/check` と `/retro` のまま
- 短所：スクリプトを足し、`/check` と `/retro` と共通規約の手順を直す必要がある。報告の入口が「Skill」として目に見えないので、文書での案内が要る

### 案 D：Issue のフォームに項目を足すだけ

- 長所：最も小さい変更で、配布物は変わらない
- 短所：環境の情報と設定の差は利用者が手で調べることになり、漏れやすい。事業データの混入を止める仕組みは注意書きのままで、フェイルセーフにならない

## 参考

- GitHub 公式「Creating an issue」（Creating an issue from a URL query）<https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue>
- GitHub 公式「Syntax for GitHub's form schema」（項目の `id` が URL の事前入力の識別子になる）<https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema>
- Issue #61 と、その検証のコメント（報告に要る情報の実例）
- 関連 ADR：20260929-01（シェル非依存）、20260929-04（事業非依存、`.leak-dict.json`）、20260929-05（ステージングと承認、外部への行動）、
  20260929-07（経営基盤 Skill の数の固定）、20260929-10（公開 Plugin、Issues は公開）
- `SECURITY.md`（非公開の報告の経路）、`skills/check/SKILL.md`（対処の表）、`skills/retro/SKILL.md`（手順 6）
