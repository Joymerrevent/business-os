---
id: 20261003-09
title: リリース PR が main にマージされたら、CI がタグを作って push する。GitHub の Release は CC か人が作る
type: decision
business: n/a
status: proposed
created: 2026-10-03
updated: 2026-10-03
as_of: 2026-10-03
verified: n/a
supersedes: n/a
---

# 20261003-09: リリース PR が main にマージされたら、CI がタグを作って push する。GitHub の Release は CC か人が作る

## 背景と問い

今のリリースは、開発専用 Skill `/release` の手順で CC が手元から進める。
リリース PR のマージはメンテナが行い、その後のタグ `business-os--v<版>` の作成と push、GitHub の Release の公開は、
CC が直前にメンテナの確認を取ってから手元で実行する（CLAUDE.md の「リリース」、`.claude/skills/release/SKILL.md` の手順 6・7）。

2026-10-03 の 0.2.0 のリリースでは、タグを作る前に main を最新にする手順（`git pull` を人に頼む）を、手元の worktree での取り込みで代えた。
手元の状態に左右される手順が残っており、タグの打ち忘れや、違うコミットへのタグ付けの余地がある。

同じ組織の porters-connect は、`tag.yml`（main への push で、`package.json` の版のタグが無ければ作って push する）で
タグ付けを CI に任せ、GitHub の Release は人か CC が作る関門として残している。

問い：タグ付けと Release の作成のうち、どこまでを CI に任せるか。

## 判断の基準

- タグの打ち忘れと、違うコミットへのタグ付けが起きないこと
- 手元から本番へ直接送る操作を減らすこと（デプロイは CI に任せる）
- Release の公開は、メンテナが中身を見てから行えること
- 秘密（個人のアクセストークンなど）を増やさないこと
- 手元の `claude plugin tag` と同じ検証（`plugin.json` とマーケットプレイスの記述の一致）を CI でも通すこと

## 検討した案

- 案 A：タグだけを CI（`tag.yml`）で作る。Release は CC か人が作る
- 案 B：タグと Release の両方を CI で作る（`tag.yml` から `release.yml` を `workflow_call` で呼ぶ）
- 案 C：今のまま、タグも Release も CC が手元で作る

## 決定

採用：**案 A**。タグは main のマージコミットに機械的に付き、打ち忘れが無くなる。Release の公開は、メンテナがノートを見てから行う関門として残る。

1. `.github/workflows/tag.yml` を置く。main への push で動き、次を行う
   1. `package.json` と `.claude-plugin/plugin.json` の版を読み、食い違っていれば失敗させる
   2. タグ `business-os--v<版>` がすでにあれば、何もせずに終える（リリース以外の main への push）
   3. `claude plugin tag -m "business-os %s" --push` でタグを作り、push する。`plugin.json` とマーケットプレイスの記述の一致も、ここで確かめる
   4. 権限は、ワークフロー全体を `contents: read`、タグを作るジョブだけ `contents: write` にする
2. GitHub の Release は、今までどおり CC か人が `gh release create` で作る。版に pre-release の接尾辞があるときだけ `--prerelease` を付ける（20261003-05）。
   公開の前にメンテナの確認を取る
3. `release.yml` は置かない。Release の公開を合図に動かすこと（パッケージの publish など）が生まれたら、そのとき足す
4. main から develop へ版の更新を戻す PR は、今までどおり CC が作る（GITHUB_TOKEN で作った PR では CI が起動しないため）
5. 実装 PR で、次を合わせて直す
   - `.claude/skills/release/SKILL.md`：手順 6（タグを手元で作って push する）を、CI のタグを確かめる手順に改める
   - CLAUDE.md の「リリース」：タグの push の確認を外し、Release の公開の確認だけを残す

## 影響

- 良い影響
  - タグは、リリース PR のマージコミットに必ず付く。打ち忘れと、手元の古い main へのタグ付けが無くなる
  - 手元から本番へ送る操作が、Release の公開だけになる
- 悪い影響
  - リリース PR のマージが、そのままタグの push になる。マージの後でタグだけを止めることはできない
  - CI に入れる Claude Code の版（`ci.yml` の `CLAUDE_CODE_VERSION`）が、`claude plugin tag --push` を持っている必要がある。実装時に確かめる
- その他
  - GITHUB_TOKEN で push したタグは、ほかのワークフローを起動しない（GitHub の仕様）。案 A では、タグの push を合図にするワークフローが無いので問題にならない
  - Release も CI で作りたくなったら、案 B（`workflow_call` でつなぐ）で見直す

## 案ごとの長所と短所

### 案 A：タグだけを CI で作る

- 長所：タグの打ち忘れと誤りが無くなる。Release のノートを人が見てから公開できる。秘密が増えない
- 短所：Release の作成は手で残る

### 案 B：タグと Release の両方を CI で作る

- 長所：マージの後に人の操作が要らない
- 短所：Release のノートを公開前に見る関門が無くなる。GITHUB_TOKEN のタグでは別のワークフローが起動しないため、`workflow_call` でつなぐ必要がある

### 案 C：今のまま手元で作る

- 長所：変更が要らない
- 短所：手元の状態（main が最新か）に左右され、タグの打ち忘れや誤りの余地が残る

## 参考

- porters-connect の `.github/workflows/tag.yml`（main への push でタグを作る）と `release.yml`（Release の公開で publish する）
- 関連 ADR：20261003-05（pre-release は版の接尾辞があるときだけ）、20260929-10（最初から公開 Plugin）
- GitHub Docs「Triggering a workflow from a workflow」（GITHUB_TOKEN による操作は新しいワークフローの実行を作らない）
