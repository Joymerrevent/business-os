---
name: release
description: business-os の新しい版をリリースする開発専用の手順。積まれた changeset から版を上げ、plugin.json に同期し、CHANGELOG を作り、main へのリリース PR、タグ、GitHub の Release まで進める。「リリースして」「新しい版を出して」「/release」と言われたときに使う。
disable-model-invocation: true
---

# /release（business-os の開発専用）

## 何をするか

`develop` に積まれた changeset から新しい版を作り、利用者に届ける。版の正典は `package.json`（changesets が更新する）で、
`plugin.json` の `version` が変わったときだけ、利用者に更新が届く。

```text
develop ─ release/<版> ─(PR)→ main ─ タグ business-os--v<版> ─ GitHub の Release
                     └────────(PR)→ develop（版の更新を戻す）
```

**人間の確認が要る操作**：リリース PR のマージ（人間が行う）、GitHub の Release の公開。
タグは、リリース PR が main にマージされたときに CI（`.github/workflows/tag.yml`）が作って push する。
Release の公開は本番の公開にあたるので、実行の直前に必ず確認を取る。

## 何を読むか

- `pnpm exec changeset status --verbose`（どの版になるか）
- `.changeset/*.md`（今回の変更の中身）
- `CHANGELOG.md`（前回のリリースの内容）

## 手順

1. **前提を確かめる**
   - `develop` が最新で、CI が通っている
   - changeset が 1 つ以上ある。無ければ「リリースする変更がありません」と告げて終える
   - 次の版を `changeset status` で確かめ、人間に示す
   - 試験版（`-alpha.N` / `-beta.N` / `-rc.N` の付いた版）にするかを人間に聞く。
     試験版にするなら、版上げの前に `pnpm exec changeset pre enter <alpha|beta|rc>` で pre モードに入る。
     通常の版に戻すときは `pnpm exec changeset pre exit` で抜ける
2. **リリースのブランチを作る**：`git switch -c release/<版> develop`
3. **版を上げる**：`pnpm release:version`
   - `package.json` の版が上がり、`plugin.json` に同期され、`CHANGELOG.md` に節が足され、使った changeset が消える
4. **検査**：`pnpm check` が終了コード 0。`claude plugin tag ./plugin --dry-run` で、作られるタグの名前（`business-os--v<版>`）と、
   `plugin.json` とマーケットプレイスの記述の一致を確かめる
5. **コミットと PR**
   - コミット：`chore(release): <版> の版上げ`（subject は大文字の英単語で始めない）
   - push して、`main` 向けの PR を作る。タイトルは「chore(release): <版> をリリースする」。本文に CHANGELOG の今回の節を貼る
   - main 向けの PR の CI（`check:release`）が、版が直近のタグより大きいこと・CHANGELOG の節・使い残しの changeset が無いことを確かめる。
     失敗したら直してから進める
   - **マージは人間が行う。** CC はマージしない
6. **タグを確かめる**（リリース PR のマージ後）
   - main への push で動く CI（`tag.yml`）が、タグ `business-os--v<版>` を作って push する。CC はタグを作らない
   - `gh run list --workflow tag.yml --branch main` で実行が成功したことを、`git ls-remote --tags origin business-os--v<版>` でタグがリモートにあることを確かめる
   - タグが指すコミットが、リリース PR のマージコミットであることを確かめる
   - 失敗していたら原因を人間に示す。直したうえで、Actions の画面から `tag.yml` を手で動かし直してもらう（`workflow_dispatch`）
7. **GitHub の Release を作る**
   - 版に pre-release の接尾辞（`-alpha.N` / `-beta.N` / `-rc.N`）があるときだけ `--prerelease` を付ける。
     接尾辞の無い版は、`0.x` でも通常の Release にする（開発中であることは版の番号と README・`plugin.json` の表示で伝える）
   - ノートは CHANGELOG の今回の節を使う（`gh release create business-os--v<版> [--prerelease] --title "business-os <版>" --notes-file <ファイル>`）
   - **公開する前に、タイトルとノートを示して確認を取る**
8. **develop に戻す**：`main` から `develop` への PR を作る（版の更新と CHANGELOG を develop に戻すため）。マージは人間が行う

## 人に何を聞くか

- 次の版でよいか
- リリース PR のマージ（人間が行う）
- Release の公開（直前に確認する）
- develop に戻す PR のマージ（人間が行う）

## 完了条件

- `main` の `package.json` と `plugin.json` の版が新しい版で一致し、CHANGELOG に節がある
- タグ `business-os--v<版>` が `main` のリリースのコミットを指し、リモートにある
- GitHub の Release がある。版に pre-release の接尾辞があるときだけ pre-release になっている
- develop に版の更新が戻っている（PR がマージされている）
