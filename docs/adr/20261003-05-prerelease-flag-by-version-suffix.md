---
id: 20261003-05
title: GitHub の pre-release は版の接尾辞があるときだけ付ける
type: decision
business: n/a
status: proposed
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: n/a
supersedes: n/a
---

# 20261003-05: GitHub の pre-release は版の接尾辞があるときだけ付ける

## 背景

20260929-10 の決定 2 は、`0.x` の間は「開発中」を明示すると決め、その手段の 1 つに「GitHub Releases は 1.0 まで pre-release」を挙げた。
`/release`（`.claude/skills/release/SKILL.md` の手順 7）はこの決定に従って `--prerelease` を付けている。
2026-10-03 時点の Release は `business-os 0.1.0`（タグ `business-os--v0.1.0`）の 1 件で、pre-release になっている。

GitHub の pre-release の一般的な使い方は、SemVer の pre-release 接尾辞（`1.2.0-beta.1`、`1.2.0-rc.1` など）と揃える形である。
changesets の pre モードも、接尾辞の付いた版を作る前提で作られている。
SemVer 自体が「`0.x` は初期開発中で、何が変わってもよい」と定めているため、`0.x` の版に pre-release を付けると開発中の表示が二重になる。

二重の表示には、次の実害がある。

- GitHub は pre-release を「Latest」にしない。Release が pre-release だけの間、`/releases/latest` の URL と API は 404 を返す
- 最新の Release を示すバッジなどは、pre-release を含める設定にしないと版を表示しない
- 1.0 になるまで、試験版（友人に先行して試してもらう版）と通常の版を Release の表示で区別できない

## 決定

1. 20260929-10 の決定 2 のうち「GitHub Releases は 1.0 まで pre-release」だけを、次の規則で置き換える。20260929-10 の本文は書き換えない
   - 版に SemVer の pre-release 接尾辞（`-alpha.N` / `-beta.N` / `-rc.N`）があるときだけ、GitHub の Release を pre-release にする
   - 接尾辞の無い版は、`0.x` であっても通常の Release にする
2. 20260929-10 の決定 2 のうち、README 冒頭の `Status: Alpha (0.x)` と `plugin.json` の description の `(alpha)` は残す。
   開発中の表示は、版の番号（`0.x`）と README・`plugin.json` で行う
3. 接尾辞の付いた版は、changesets の pre モード（`changeset pre enter <tag>`）で作る。試験版を出すかどうかは、リリースのたびにメンテナが決める
4. 既存の `business-os 0.1.0` の Release は、実装 PR のマージ後に通常の Release へ切り替える。切り替えはメンテナの確認を取ってから行う
5. 実装 PR で、次を合わせて直す
   - `.claude/skills/release/SKILL.md`：手順 7 と完了条件の「1.0 までは pre-release」を、決定 1 の規則に改める
   - `docs/README.md` と `CLAUDE.md` のリリースの説明にある「GitHub の pre-release（1.0 まで）」

## 根拠

- 一般的な使い方に揃えると、GitHub の表示（Latest）、API、バッジ、changesets の pre モードが追加の設定無しで噛み合う
- 開発中であることは `0.x` の版の番号が SemVer の意味で既に示しており、README と `plugin.json` の表示も残る。
  pre-release を外しても、利用者に開発中であることは伝わる
- pre-release を接尾辞付きの版に限ると、1.0 より前でも試験版と通常の版を区別して配れる
- 検討した代替案
  - 現状のまま（1.0 まで全版を pre-release）：Latest が付かず、試験版と通常の版を区別できないまま 1.0 まで続く。不採用
  - pre-release を一切使わない：試験版を出すときに、通常の版と Release の表示で区別できない。不採用

## 影響

- `/release` の手順 7 で `--prerelease` を付けるかを、版の文字列から判断することになる
- Release が通常になると、`/releases/latest` が最新の通常の版を指す
- 未検証：`plugin.json` の `version` と `claude plugin tag` が、`0.2.0-beta.0` のような接尾辞付きの版を受け付けるか。
  初めて試験版を出すときに `claude plugin tag --dry-run` で確かめる
- Plugin のインストールはマーケットプレイスの定義からリポジトリを取得する仕組みで、Release の pre-release の有無には依存しない見込み（未検証）

## 参考

- Semantic Versioning 2.0.0：<https://semver.org/lang/ja/>（項 4：`0.y.z` は初期開発用。項 9：pre-release の接尾辞）
- GitHub Docs「About releases」：<https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases>
- changesets「Prereleases」：<https://github.com/changesets/changesets/blob/main/docs/prereleases.md>
- 関連 ADR：20260929-10（最初から公開 Plugin。この ADR が決定 2 の一部を置き換える）
