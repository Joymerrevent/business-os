# ロードマップ

business-os がどの版で何を目指すかを書く。個々の残作業とその状態は GitHub に置き、この文書には書き写さない。

| 知りたいこと | 見る場所 |
|---|---|
| 残作業と、その状態（Todo・In Progress・Done） | [business-os ロードマップ（GitHub Project）](https://github.com/orgs/Joymerrevent/projects/7) |
| どの版に入れる作業か | [マイルストーン](https://github.com/Joymerrevent/business-os/milestones) |
| なぜそう決めたか | [docs/adr/](docs/adr/README.md) |

## 版ごとの方向

### 0.x — 開発中

0.x の間は、仕様が予告なく変わる。版の付け方と Release の扱いは、ADR 20260929-10 と 20261003-05 に従う。

- [0.2.0](https://github.com/Joymerrevent/business-os/milestone/1)：2026-10-03 にリリース済み。Skill が人に聞く質問を固定し（ADR 20261003-08）、実装リポの指示とメモの置き場を決めた（ADR 20261003-07）。中身は [CHANGELOG.md](CHANGELOG.md)
- 次の 0.x の版は、まだ決めていない。残作業が版にまとまったら、マイルストーンを作ってここに足す

### 1.0.0 — 公式ディレクトリへの提出を検討する版

- [1.0.0](https://github.com/Joymerrevent/business-os/milestone/2)：公式ディレクトリへの提出を検討する（ADR 20260929-10 の決定 8）。あわせて、設計時に「そのはず」で止まっている確認（構造仕様 11 節）を実機で済ませる

### 条件待ち

マイルストーンの無い Issue は、着手の条件が来るまで待つ作業。条件は各 Issue の本文に書く。

## 残作業の足し方

- 残作業を見つけたら Issue にする。作るときに、版が決まっていればマイルストーンを付け、Project に入れる

  ```sh
  gh issue create --milestone 0.2.0 --project "business-os ロードマップ" --title "..." --body "..."
  ```

  - 新しい Issue は Project に自動では入らない。`--project` を付け忘れたら `gh project item-add 7 --owner Joymerrevent --url <Issue の URL>` で足す
- PR の本文に `Closes #<番号>` と書き、PR と Issue を結びつける
- `develop` 向けの PR では、マージしても Issue は自動で閉じない。GitHub が `Closes` で Issue を閉じるのは、既定のブランチ（`main`）にマージしたときだけのため。
  `develop` へのマージで作業が終わったら、`gh issue close <番号> --reason completed` で閉じる。閉じると Project の状態が Done になる
- ADR の「影響」や「後続の検討」に新しい作業が出たら、その ADR を accepted にしたときに Issue にする
- 「次のどれかが起きたら見直す」のような見張る条件は Issue にしない（ADR の本文に残す）
