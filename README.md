# business-os

> **Status: Alpha (0.x)** — 仕様は予告なく変わります。本番の経営判断に使う場合は自己責任でお願いします。

1 人で複数の事業を運営する人が、Claude Code（CC）を「経営の手足」として使うための器です。
CC の Plugin として配布します。器そのものには事業の情報を一切含めず、あなたの事業情報は
`/onboard` の質問に答える形で、あなた自身の非公開リポジトリに書き込まれます。

- 毎朝、今日の優先事項・承認待ち・期限を 1 枚にまとめる
- 週・月・四半期の周期で、実績の確認と方向の見直しを促す
- 意思決定を記録し、後から「なぜそう決めたか」を辿れる
- CC が会社の方針を勝手に書き換えないよう、承認の仕組みで守る

## 最短で動かす

必要なもの：Claude Code（Plugin 対応版）、Node.js 24 系、Git。Windows では WSL の中で動かすことを勧めます。

1. CC を起動し、器を入れる

   ```text
   /plugin marketplace add Joymerrevent/business-os
   /plugin install business-os@business-os
   ```

2. 事業データ用の**非公開**リポジトリを作り、その中で CC を起動する

   ```bash
   mkdir company && cd company && git init
   claude
   ```

3. `/onboard` と入力し、質問に答える

詳しい手順と最初の 1 週間の過ごし方は [はじめる](docs/usage/getting-started.md)、
日々の回し方は [日々の運用](docs/usage/operations.md) を読んでください。

## 開発に参加する

[CONTRIBUTING.md](CONTRIBUTING.md) を読んでください。設計判断の記録は [docs/adr/](docs/adr/README.md) にあります。
脆弱性の報告は [SECURITY.md](SECURITY.md) の手順に従ってください。

## ライセンス

[MIT](LICENSE)
