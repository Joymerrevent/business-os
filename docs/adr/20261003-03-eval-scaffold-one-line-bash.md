---
id: 20261003-03
title: eval の scaffold に限り、TypeScript を呼ぶ 1 行の bash を許す
type: decision
business: n/a
status: accepted
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: 2026-10-03
supersedes: n/a
---

# 20261003-03: eval の scaffold に限り、TypeScript を呼ぶ 1 行の bash を許す

## 背景

20261003-02 は、`claude plugin eval` のケースで、scaffold によって作業場所を用意すると決めた。
用意する作業場所は、検証用の company の複製と、`state: initializing` の状態である。
一方、20260929-01 は「bash スクリプトを一切含めない」と決めている。

`claude plugin eval` の `context.scaffold_script` は、ケースのフォルダに置いたスクリプトを `bash` で実行する。
2026-10-03（Claude Code 2.1.285、macOS）に、先頭行を `#!/usr/bin/env node` にした TypeScript のファイルを scaffold に指定して試した。
bash がそのファイルを読み、`import: command not found` で失敗した。scaffold を使う限り、bash のファイルは避けられない。

20261003-02 を決める時点で、この食い違いを見落としていた。

## 決定

1. 20260929-01 の決定 2（bash スクリプトを一切含めない）に、次の例外を 1 つだけ足す。20260929-01 の本文は書き換えない
2. 例外の範囲は `evals/` の下の `scaffold.sh` だけとする。中身は、コメントと空行を除いて 1 行とし、
   その 1 行は `exec node` で TypeScript の共通の scaffold を呼ぶ形にする。例：

   ```bash
   #!/usr/bin/env bash
   exec node "$(dirname "$0")/../../lib/scaffold.ts" onboard-confirm-activation
   ```

3. 作業場所を用意する処理（複製、状態の書き換え、`git init`）は、すべて TypeScript の共通の scaffold に書く。
   共通の scaffold は tsc と ESLint の対象に入れる
4. `pnpm check` の検査で、次を fail にする
   - `evals/` の下の `scaffold.sh` 以外にある `.sh` ファイル、および拡張子が無く先頭行が bash などのシェルを指すファイル
   - `scaffold.sh` のうち、コメントと空行を除いた行が 1 行でないもの、またはその行が `exec node` で始まらないもの
5. CLAUDE.md の絶対ルール 2 に、この例外を書き足す（実装 PR で行う）

## 根拠

- 20260929-01 が bash を避けた理由は、利用者の環境に bash があるとは限らないこと（Windows ネイティブ）と、
  hook を bash 前提にしないことにある。`evals/` は business-os の開発でだけ使い、利用者の環境では実行されない
- 処理を TypeScript に置けば、型の検査と lint が効き、bash に書く量は起動の 1 行だけになる。
  1 行に限ると検査で機械的に守れる（人の記憶に頼らない）
- 検討した代替案
  - scaffold を使わず、作業場所が要るケースを TypeScript の進行役の側で動かす：bash はゼロのままだが、
    採点の仕組みが eval と進行役の 2 系統に分かれる。不採用
  - 例外の範囲を決めずに scaffold の bash を許す：処理が bash に増えていくのを止められない。不採用

## 影響

- `evals/` のケースを Windows ネイティブで動かすには bash（Git Bash など）が要る。
  ただし、Windows ネイティブでの eval の実行は未検証であり、もともと開発は macOS・Linux・WSL を前提にする
- 新しい検査が増える。既存の bash スクリプトは無いため、今の時点で fail になるファイルは無い
- `scaffold.sh` の改行は LF に固定する（既存の `.gitattributes` のとおり）

## 参考

- Claude Code のドキュメント「plugin evals」：<https://code.claude.com/docs/en/plugin-evals.md>
- 関連 ADR：20260929-01（シェル非依存。この ADR が例外を 1 つ足す）、20261003-02（Skill の自動検証で残した 4 つの論点の扱い）
