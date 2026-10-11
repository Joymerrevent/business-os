---
status: draft
created: 2026-10-11
updated: 2026-10-11
source: ../../dev-autopilot-requirements.md
---

# 判定の表

進行役が決定的に行う判定の一覧。各判定は `judge.ts` `trust.ts` `select.ts` に関数として置き、vitest で表のとおり検査する（要件 R7-5）。入力はすべて[状態の組み立て][state]の値か、`ctl` の git の出力。

## 1. 棚卸し：候補の選定（R1-1、R1-3）

すべてを満たす Issue を候補にし、マイルストーンの版の昇順、同じ版なら Issue 番号の昇順に並べる。

| 条件 | 根拠 |
| --- | --- |
| `approved`（`agent-ready` があり、付けた人が push 以上） | R1-1、I10 |
| `intakeFinal` の印がある | R1-1、I12 |
| `milestone` がある | R1-1 |
| `status` が `Todo` | R1-1 |
| `blocked` でない | R1-1、R5-2 |
| `needs-human` が無く、`agent` が `human` でない | R1-1 |

着手するのは、先頭から「1 回の実行で着手する件数」と「WIP の上限 − 進行中の数」の小さい方まで。基線が赤（R2-8）なら着手しない。

## 2. 実行の失敗と作業の失敗（R2-13）

セッションの結果を、次の順で分類する。「実行の失敗」はその Issue を持ち越し、同じ Issue で 3 回続いたら `needs-human`（B2）。

| 順 | 観測 | 分類 | 根拠 |
| --- | --- | --- | --- |
| 1 | プロセスが時間の上限で止められた | 実行の失敗 | R2-12 |
| 2 | `result` の `subtype` が `error_max_turns` | 実行の失敗 | R2-12 |
| 3 | `result` の `subtype` が `error_max_budget_usd` | 実行の失敗 | R2-12 |
| 4 | API の 429、`is_error` が真で作業に関係ない理由（認証・通信） | 実行の失敗 | R2-13 |
| 5 | `result` が無い、または出力契約のスキーマに合わない | 実行の失敗 | R2-5 |
| 6 | `stop_reason` が `refusal`（受け入れ AI） | 実行の失敗。次回のモデルは `sonnet` | I12 |
| 7 | 出力契約の `stopped` に理由がある（ADR が要る、作業指示が成り立たない等） | 作業の失敗。`needs-human` | R2-7 |
| 8 | 上のどれでもない | 成功。段の処理を続ける | — |

## 3. 文の出どころ（I1、I10、R3-5）

AI に渡す文と、人の固定の見出しを数えるときの判定。

| 問い | 判定 |
| --- | --- |
| 投稿者は進行役か | 投稿者のログインが設定 `github.botLogin` と一致 |
| コメントは未編集か | GraphQL の `lastEditedAt` が null（`updated_at` は使わない） |
| 印は真正か | 投稿者が進行役、未編集、`sig` が `sig` 以外の欄に対して検証できる、の 3 つ |
| 投稿者はコラボレータか | `GET /repos/{o}/{r}/collaborators/{user}/permission` の `permission` が `admin` `maintain` `write` のいずれか。渡す直前に 1 人ずつ引く |
| 文は AI の出力か | 投稿者が進行役、または進行役の印を持つ |
| 人の固定の見出しとして数えるか | 投稿者がコラボレータで進行役でなく、印を持たず、見出しが設定の文字列と一致 |
| `agent-ready` は有効か | 最後に付けた人（timeline の `LabeledEvent`）がコラボレータ |

渡す文の決め方（I1）：

| Issue の著者 | 渡す文 |
| --- | --- |
| コラボレータ（進行役でない） | 本文（`source=body`）。ただし `## 作業指示` のコメントがあればそれを優先（`source=instruction`） |
| 外の人、または進行役 | `## 作業指示` のコメント（`source=instruction`）。無ければ人が承認した下書き（`source=draft`）。どちらも無ければ着手しない（I2） |

## 4. 検疫（I11）

渡す文（本文、作業指示、下書き、計画、PR のコメント、再レビューの入力）に 1 つでも当たれば「有り」。有りなら渡さず `needs-human`。

| 検査 | 当たる例 |
| --- | --- |
| 見えない文字 | ゼロ幅（U+200B〜U+200D、U+FEFF）、制御文字（U+0000〜U+001F の改行とタブ以外、U+007F）、双方向制御（U+202A〜U+202E、U+2066〜U+2069） |
| HTML コメント | `<!--` を含む |
| 長い base64 や難読化 | 連続する base64 の文字が 200 以上、`\u` や `&#` のエスケープが 20 以上 |
| URL | `http://` `https://` `ftp://` `file://`（人が書いた参照の URL も対象。人が下書きで外すか `needs-human` で扱う） |
| 指示の形の語 | 設定の見本（`fixtures/quarantine/*.txt`）の文字列との一致。初期値は「以前の指示を無視」「このコマンドを実行」「このファイルを読んで従え」「system prompt」「ignore previous」「you are now」など |
| 欄の区切りを模した文字列 | 固定の指示文の区切り（`<<<WORK>>>` `<<<END-WORK>>>` など。[出力契約][contracts]）と同じ文字列 |

## 5. レビューの判定（R3-3、R3-7）

レビュー AI と批評者の出力から `review` の印を作る。pass は 5 条件をすべて満たすときだけ。

| 条件 | 満たさないとき |
| --- | --- |
| (1) レビュー AI と批評者の出力契約が完全に解析できた | 実行の失敗 |
| (2) レビュー AI の `converged` が真 | 実行の失敗（「未収束」） |
| (3) 両セッションの `is_error` が偽 | 実行の失敗 |
| (4) `high` `medium` `low` が数値 | 実行の失敗 |
| (5) `modelUsage` のモデルが設定と一致 | 実行の失敗（フォールバックの検知） |

統合の規則（批評者の指摘ごとの結果を当てる）：

| レビュー AI の重要度 | 批評者の結果 | 統合後 |
| --- | --- | --- |
| 🔴 | 再現できた | 🔴 |
| 🔴 | 再現できない | 🟡 に下げ、`dropped_high` に数える（PR は最終的に `merge=human`） |
| 🟡 | 確信度 ≥ しきい値 | 🟡 |
| 🟡 | 確信度 < しきい値 | 🟢 |
| 🟢 | 批評者に渡さない | 🟢 |

統合後の 🔴 と 🟡 が 0 件なら `verdict=pass`、1 件でもあれば `fix`。

## 6. 収束と往復（R4-2、R4-3）

| 判定 | 規則 |
| --- | --- |
| CI 緑 | 設定 `ci.required` の各項目について、head に対するチェックが存在し、名前・app・ワークフローのパスが一致し、結論が `success`。1 つでも欠ければ緑でない。`ci.required` が空なら点検 fail |
| 収束 | 最新の `review` の印が `pass`、印の `head` が PR の head、CI 緑 |
| 往復の回数 | `review` の印の `round` の最大値。上限は設定 `limits.rounds`（初期値 3） |
| 振動 | 連続する 2 ラウンドで、同じ見出し（正規化して比較）の 🔴 か 🟡 が再提起された |
| 載せ直し後の扱い | `git patch-id --stable --verbatim` が前後で同じなら印を新 head に付け直し、往復に数えない。違えばレビューへ |

## 7. マージの判定（R7-2、R7-3）

すべて満たせば `merge=ready`、1 つでも満たさなければ `merge=human` と満たさない条件の記号。

| 記号 | 条件 |
| --- | --- |
| `origin` | PR に進行役の署名付きの印（`review` と `fix`）が付いている |
| `base` | `baseRefName` が `develop` |
| `converged` | 6 節の収束を満たす |
| `leak` | 最終の head の diff 全体に漏えい検査（R2-14）を掛け直して通る |
| `critic` | どのラウンドの `review` の印も `dropped_high` が 0 |
| `paths` | `git diff --raw origin/develop...<head>` のすべての行が、状態 `A` か `M`、mode `100644`、パスが設定 `merge.allowlist` に一致 |
| `policy` | パスが設定 `merge.policyPaths` に 1 つも一致しない |
| `one` | この実行で `merge=ready` にした PR が他に無い（1 実行 1 件） |

## 8. 載せ直しの要否（R7-3b、R7-3c）

| 状態 | 処理 |
| --- | --- |
| `origin/develop` が head の祖先 | 不要 |
| 祖先でない、merge が衝突しない | `ctl` で merge → push → patch-id を比較 → 同じなら印を付け直す、違えばレビューへ |
| merge が衝突する | 修正の段へ（作業 AI が解消。往復に数える） |

## 9. 指標の集計（R6-3、R6-4、R7-2b）

GitHub の記録から数える。手元の記録は写し。

| 指標 | 数え方 |
| --- | --- |
| 却下率 | 人の `## 却下 R<n>` の見出しに列挙された指摘の数 ÷ AI が出した 🔴 🟡 の数 |
| 一致（段階 5） | `merge=human` の PR が人にマージされた → 不一致。`merge=ready` の PR に `## 判定と違う判断` → 不一致。`merge=ready` の PR がマージされた → 一致。どちらも無く 7 日 → 催促し、数えない |
| revert | マージから 14 日以内に `develop` に revert commit、または本文でその PR 番号を「戻す」と言及する fix の PR がマージされた |
| 異議（段階 1〜2） | 人の `## 異議` の見出しの数（dry-run の間は記録ファイルへの追記） |

## 10. 漏えい検査（R2-14）

GitHub に書くすべての文と diff に掛ける。1 つでも当たれば書かず `needs-human`。

| 検査 | 内容 |
| --- | --- |
| 鍵の形式 | `-----BEGIN` で始まる鍵、`ghp_` `github_pat_` `sk-` などの接頭辞（gitleaks の規則を `ctl` の `.gitleaks.toml` で使う） |
| メールアドレス | 設定の許可リストに無いアドレス |
| 機械上のパス | `/Users/<名前>` `/home/<名前>`、進行役の置き場の絶対パス |
| 進行役の秘密 | 環境変数の値（PAT、署名の鍵）と一致する文字列、`settings/*.json` の中身 |

[state]: ./state-machine.md
[contracts]: ./contracts.md
