# ADR 一覧

起票した ADR を、番号の順に並べる。起票の手順と status の運用は [README][readme] にある。

| 番号 | タイトル | status | 作成日 |
| --- | --- | --- | --- |
| ADR-20261008-001 | [進行役は決定的なスクリプトにし、AI は作業・レビュー・批評の 3 つの役だけを担う][adr-20261008-001-orchestrator-and-ai-roles] | proposed | 2026-10-08 |
| ADR-20261008-002 | [AI に渡す文はコラボレータが書いたものだけにし、渡す文も作業の内容であって指示ではないと扱う][adr-20261008-002-collaborator-text-only] | proposed | 2026-10-08 |
| ADR-20261008-003 | [GitHub への書き込みはすべて進行役が行い、AI は出力契約で結果を返す][adr-20261008-003-github-writes-by-orchestrator] | proposed | 2026-10-08 |
| ADR-20261008-004 | [AI のセッションに sandbox を掛け、鍵は人用と自動化用に分け、作業 AI の commit は署名しない][adr-20261008-004-session-sandbox-and-keys] | proposed | 2026-10-08 |
| ADR-20261008-005 | [レビューの判定は PR コメントの印で行い head の SHA に結びつけ、🔴 🟡 だけを直して収束させる][adr-20261008-005-review-marker-and-convergence] | proposed | 2026-10-08 |
| ADR-20261008-006 | [開発の PR のマージの可否は進行役が許可一覧の条件で判定し、マージの実行は人が行う][adr-20261008-006-orchestrator-merge-allowlist] | proposed | 2026-10-08 |
| ADR-20261008-007 | [レビューの Skill は change-review の核を残して v2 に組み直し、dev-autopilot に同封する][adr-20261008-007-review-skill-v2] | proposed | 2026-10-08 |
| ADR-20261008-008 | [dev-autopilot は分離を見越して 1 つのフォルダに Plugin の形で閉じ、導入と点検も Plugin が担う][adr-20261008-008-self-contained-plugin-layout] | proposed | 2026-10-08 |
| ADR-20261008-009 | [着手する Issue は人のラベルとマイルストーンと依存で選び、Issue ごとの worktree と上限の中で進める][adr-20261008-009-issue-selection-worktrees-and-limits] | proposed | 2026-10-08 |

<!--
行の例（表の最後に足す）:
| ADR-20261006-001 | [MADR テンプレートを採用する][adr-20261006-001-use-madr-template] | proposed | 2026-10-06 |

参照定義の例（ファイル末尾に足す）:
[adr-20261006-001-use-madr-template]: ./adr-20261006-001-use-madr-template.md
-->

[readme]: ./README.md
[adr-20261008-001-orchestrator-and-ai-roles]: ./adr-20261008-001-orchestrator-and-ai-roles.md
[adr-20261008-002-collaborator-text-only]: ./adr-20261008-002-collaborator-text-only.md
[adr-20261008-003-github-writes-by-orchestrator]: ./adr-20261008-003-github-writes-by-orchestrator.md
[adr-20261008-004-session-sandbox-and-keys]: ./adr-20261008-004-session-sandbox-and-keys.md
[adr-20261008-005-review-marker-and-convergence]: ./adr-20261008-005-review-marker-and-convergence.md
[adr-20261008-006-orchestrator-merge-allowlist]: ./adr-20261008-006-orchestrator-merge-allowlist.md
[adr-20261008-007-review-skill-v2]: ./adr-20261008-007-review-skill-v2.md
[adr-20261008-008-self-contained-plugin-layout]: ./adr-20261008-008-self-contained-plugin-layout.md
[adr-20261008-009-issue-selection-worktrees-and-limits]: ./adr-20261008-009-issue-selection-worktrees-and-limits.md
