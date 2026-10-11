# dev-autopilot の設計

dev-autopilot の設計書の置き場。判断は[要件メモ][req]に書いてあり、設計はそれを段階ごとに具体化したもの。

| フォルダ | 中身 | 状態 |
| --- | --- | --- |
| [basic/][basic] | 基本設計：進行役の構造（配置、実行の流れ、状態と判定、設定、出力契約、セッションの起動、記録） | 下書き（2026-10-11） |

詳細設計（モジュールごとの関数と型、結合テストのケース）は実装の段階（0c 以降）で `detailed/` に足す。

[req]: ../dev-autopilot-requirements.md
[basic]: ./basic/README.md
