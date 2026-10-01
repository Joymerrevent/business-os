---
name: release
description: 器（business-os）の新しい版をリリースする開発専用の手順。積まれた changeset から版を上げ、plugin.json に同期し、CHANGELOG を作り、main へのリリース PR、タグ、GitHub の pre-release まで進める。「リリースして」「新しい版を出して」「/release」と言われたときに使う。
disable-model-invocation: true
---

# /release（器の開発専用）

## 何をするか

`develop` に積まれた changeset から新しい版を作り、利用者に届ける。版の正典は `package.json`（changesets が更新する）で、
`plugin.json` の `version` が変わったときだけ、利用者に更新が届く。

```text
develop ─ release/<版> ─(PR)→ main ─ タグ business-os--v<版> ─ GitHub の Release（1.0 までは pre-release）
                     └────────(PR)→ develop（版の更新を戻す）
```

**人間の確認が要る操作**：リリース PR のマージ（人間が行う）、タグの push、GitHub の Release の公開。
タグの push と Release の公開は本番の公開にあたるので、実行の直前に必ず確認を取る。

## 何を読むか

- `pnpm exec changeset status --verbose`（どの版になるか）
- `.changeset/*.md`（今回の変更の中身）
- `CHANGELOG.md`（前回のリリースの内容）

## 手順

1. **前提を確かめる**
   - `develop` が最新で、CI が通っている
   - changeset が 1 つ以上ある。無ければ「リリースする変更がありません」と告げて終える
   - 次の版を `changeset status` で確かめ、人間に示す
2. **リリースのブランチを作る**：`git switch -c release/<版> develop`
3. **版を上げる**：`pnpm release:version`
   - `package.json` の版が上がり、`plugin.json` に同期され、`CHANGELOG.md` に節が足され、使った changeset が消える
4. **検査**：`pnpm check` が終了コード 0。`claude plugin tag --dry-run` で、作られるタグの名前（`business-os--v<版>`）と、
   `plugin.json` とマーケットプレイスの記述の一致を確かめる
5. **コミットと PR**
   - コミット：`chore(release): <版> の版上げ`（subject は大文字の英単語で始めない）
   - push して、`main` 向けの PR を作る。タイトルは「chore(release): <版> をリリースする」。本文に CHANGELOG の今回の節を貼る
   - **マージは人間が行う。** CC はマージしない
6. **タグを作る**（リリース PR のマージ後）
   - `main` を最新にして（`git pull` は人間に頼む）、`claude plugin tag -m "business-os %s"` でタグを作る
   - **タグを push する前に、タグの名前と指すコミットを示して確認を取る。** 了承を得たら push する
7. **GitHub の Release を作る**
   - 1.0 までは `--prerelease` を付ける
   - ノートは CHANGELOG の今回の節を使う（`gh release create business-os--v<版> --prerelease --title "business-os <版>" --notes-file <ファイル>`）
   - **公開する前に、タイトルとノートを示して確認を取る**
8. **develop に戻す**：`main` から `develop` への PR を作る（版の更新と CHANGELOG を develop に戻すため）。マージは人間が行う

## 人に何を聞くか

- 次の版でよいか
- リリース PR のマージ（人間が行う）
- タグの push と、Release の公開（それぞれ直前に確認する）
- develop に戻す PR のマージ（人間が行う）

## 完了条件

- `main` の `package.json` と `plugin.json` の版が新しい版で一致し、CHANGELOG に節がある
- タグ `business-os--v<版>` が `main` のリリースのコミットを指し、リモートにある
- GitHub の Release（1.0 までは pre-release）がある
- develop に版の更新が戻っている（PR がマージされている）
