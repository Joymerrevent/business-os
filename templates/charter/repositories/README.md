---
type: charter
business: portfolio
status: active
created: {{ onboarded_at }}
updated: {{ onboarded_at }}
as_of: n/a
verified: {{ onboarded_at }}
---

# 実装リポジトリ

各事業の実装リポジトリの場所と、実装リポジトリを扱うときの決まりの置き場。

- CC は必要なときに、表のパスを `--add-dir` で読み込む。シンボリックリンクは使わない
- 実装リポジトリの開発に要るもの（コードの規約・構成・検査の方法）は、実装リポジトリの中に置く
- 経営側の文脈と、実装リポジトリに置きたくないものは company に置く
  - 指示（実装リポジトリを扱うときに CC が守ること）：`docs/charter/repositories/<リポ名>/`。人間が書き、CC は提案で変える
  - メモ（調べたこと・作業の記録）：`docs/knowledge/repositories/<リポ名>/`。CC も書く
- CC は実装リポジトリを `--add-dir` で読み込む前に、そのリポジトリの指示のフォルダの中をすべて読む
- 実装リポジトリのコードを変える作業は、実装リポジトリで CC を起動して行う

| 事業 | リポ | macOS | Windows | 用途 | 指示 |
|---|---|---|---|---|---|
| {{ business_id }} | {{ repo_name }} | {{ repo_path_macos }} | {{ repo_path_windows }} | {{ repo_purpose }} | {{ repo_instructions }} |

<!-- 行の雛形：/onboard が実装リポごとに 1 行ずつくり返し、このコメントは消す -->
