# Obsidian アダプタ

company の文書（`company/docs/`）を Obsidian で読むための設定です。**任意**で、使っても使わなくても、
器の Skill と安全装置の動きは同じです。`/onboard` で「使う」と答えたときだけ、ここのファイルが company にコピーされます。
「使わない」と答えた場合は、Obsidian 関連のファイルは一切作られません。

## 入るもの

| ここ | company の中の置き場所 | 中身 |
|---|---|---|
| `vault/*.json` | `docs/.obsidian/` | Vault の設定（標準の Markdown リンク、新規ノートは `inbox/`、添付は `inbox/attachments/`、日報の場所、コアプラグイン、グラフの色） |
| `bases/*.base` | `docs/dashboards/` | ダッシュボード（承認待ちの提案、意思決定記録、事業別の現況、鮮度の期限切れ、レビュー） |
| `templates/*.md` | `docs/_templates/` | 手で書くメモと日報の雛形。Obsidian のテンプレート機能と Daily Notes が使う |

`docs/_templates/` の雛形には Obsidian の置き換え記号（`{{date:YYYY-MM-DD}}` など）が入るため、
器の検査（書き込みのガードと `/check`）の対象から外しています。

## 導入

`/onboard` が行います。手で入れる場合の手順も同じです。

1. Obsidian が無ければ入れる（`/onboard` は入れる前に確認を取ります）
   - macOS：`brew install --cask obsidian`
   - Windows：`winget install --id Obsidian.Obsidian --exact --accept-source-agreements --accept-package-agreements`
2. `vault/` の中身を `company/docs/.obsidian/` に、`bases/` の中身を `company/docs/dashboards/` に、
   `templates/` の中身を `company/docs/_templates/` にコピーする
3. `company/.gitignore` に次の行を足す（Obsidian が手元の状態を書き込むファイル）

   ```text
   docs/.obsidian/workspace.json
   docs/.obsidian/workspace-mobile.json
   docs/.obsidian/cache/
   ```

4. Obsidian を一度起動する（インストールの直後は、一度起動するまで Obsidian の URL が使えません）
5. Obsidian の最初の画面で「保管庫としてフォルダを開く（Open folder as vault）」を選び、`company/docs` を選ぶ。
   `company` そのものではなく、その中の `docs` です

## 使い方

- **手でメモを書く**：新しいノートは `inbox/` にできます。テンプレートの挿入（コマンドパレットの「Templates: Insert template」）で
  `inbox-note` を入れると、フロントマターが付きます。フロントマターの無いメモは `/check` が指摘します
- **日報**：Daily Notes で今日の日報を開くと、`operations/daily/YYYY-MM-DD.md` がフロントマター付きで作られます。
  `/morning` はこのファイルに追記します
- **ダッシュボード**：`dashboards/` の `.base` を開きます

## Windows

Windows で Obsidian を使う場合は、Claude Code も WSL ではなく Windows 上で直接動かし、`company` を Windows 側に置いてください。
WSL の中のファイルを Windows の Obsidian で開く構成は、動作が不安定になるため案内していません。

Windows 上で直接動かす構成では、Claude Code の sandbox（OS による見張り）が動きません。
憲章の保護は、器の hook と権限設定だけに頼ることになります。Obsidian を使わないなら、WSL で動かす構成を勧めます。

## やめるとき

`company/docs/.obsidian/`、`company/docs/dashboards/`、`company/docs/_templates/` を消すだけです。文書そのものは変わりません。

## 0.1.0 時点の未検証項目

- Windows での `winget` によるインストールで、UAC（管理者の確認）が出るかどうか。GitHub Actions の Windows（管理者権限）では、
  確認なしでインストールできることを確かめています
- ダッシュボードの日付の比較（`verified < today() - "90d"` など）が、期待どおりに期限切れの文書を拾うかどうか
