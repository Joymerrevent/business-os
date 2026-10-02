---
type: charter
business: portfolio
status: active
created: {{ onboarded_at }}
updated: {{ onboarded_at }}
as_of: n/a
verified: {{ onboarded_at }}
---

# 実装リポジトリの場所

各事業の実装リポジトリの場所。CC は必要なときに該当するパスを `--add-dir` で読み込む。
シンボリックリンクは使わない。

| 事業 | リポ | macOS | Windows | 用途 |
|---|---|---|---|---|
| {{ business_id }} | {{ repo_name }} | {{ repo_path_macos }} | {{ repo_path_windows }} | {{ repo_purpose }} |

<!-- 行の雛形：/onboard が実装リポごとに 1 行ずつくり返し、このコメントは消す -->
