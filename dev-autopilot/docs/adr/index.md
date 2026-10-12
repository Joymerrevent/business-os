# ADR 一覧

起票した ADR を、番号の順に並べる。起票の手順と status の運用は [README][readme] にある。
2026-10-08 に起票した 9 本は、設計が日ごとに変わる段階では要件メモとの二重保守になるため 2026-10-10 にいったん削除した。2026-10-11 に要件メモを凍結して[要件定義書][req]を作り、以後の判断は ADR で決める。

| 番号 | タイトル | status | 作成日 |
| --- | --- | --- | --- |
| ADR-20261011-001 | [AI の作業場所は AI のセッションごとに origin から clone し直し、進行役は AI が触った clone からは fetch で取り込むだけにする][adr-20261011-001-ai-worktree-clone-and-fetch-only] | proposed | 2026-10-11 |
| ADR-20261011-002 | [1 回の実行では、AI のセッションか CI 待ちを伴う段だけを Issue ごとに 1 つ進める][adr-20261011-002-one-ai-stage-per-run] | proposed | 2026-10-11 |
| ADR-20261011-003 | [CI の結果ごとの扱いと、1 回の実行で 2 件目以降の PR のマージ判定を次回に回すこと][adr-20261011-003-ci-states-and-merge-judgment-timing] | proposed | 2026-10-11 |
| ADR-20261011-004 | [基線が赤のときは新規の着手だけを止め、Issue に `needs-human` は付けない][adr-20261011-004-red-baseline-blocks-new-starts-only] | proposed | 2026-10-11 |
| ADR-20261011-005 | [段階 2 の Agent 欄は空にし、マージ後の片付けは `human` と `paused` の除外より先に行う][adr-20261011-005-stage2-agent-field-and-cleanup-order] | proposed | 2026-10-11 |
| ADR-20261011-006 | [手元の記録を判定に使うのは 3 つに限り、記録が無ければ安全側に倒す][adr-20261011-006-local-records-for-counters-only] | proposed | 2026-10-11 |
| ADR-20261011-007 | [進行役の投稿にはすべて署名付きの印を付け、署名の対象に種類・リポ・番号を含め、印が無効化されていたら止める][adr-20261011-007-signed-markers-on-all-bot-posts] | proposed | 2026-10-11 |
| ADR-20261011-008 | [PR と Issue は、head のブランチ名・同じリポ・作者・印の番号の 4 条件で結びつける][adr-20261011-008-link-pr-to-issue-by-branch-author-and-marker] | proposed | 2026-10-11 |
| ADR-20261011-009 | [AI の読み取りは worktree と必要な場所に絞り、秘密の置き場を決めて必ず拒否に入れ、手動実行は launchd を起こす][adr-20261011-009-read-scope-and-secret-locations] | proposed | 2026-10-11 |
| ADR-20261011-010 | [ラベルの付け外し・Status の戻し・渡す文の編集の操作者を権限確認し、`agent-ready` より後の編集は止める][adr-20261011-010-permission-checks-for-labels-edits-and-cutoff] | proposed | 2026-10-11 |
| ADR-20261011-011 | [受け入れはマイルストーンの無い Issue にも走らせ、`from-review` の Issue だけマイルストーンが付くまで待つ][adr-20261011-011-intake-scope-and-milestone-candidate] | proposed | 2026-10-11 |
| ADR-20261011-012 | [要件が決めていない値は基本設計が「暫定」として持ち、設計の形を変える判断だけを ADR にする][adr-20261011-012-provisional-values-in-design] | proposed | 2026-10-11 |

要件定義書 10 節の論点との対応：D-1・D-13 → 001、D-2 → 002、D-3・D-4 → 003、D-5 → 004、D-6 → 005、D-7 → 006、D-8・D-14 → 007、D-9 → 008、D-10 → 009、D-11 → 010、D-15 → 011、D-12・D-16 → 012。

[readme]: ./README.md
[req]: ../requirements.md
[adr-20261011-001-ai-worktree-clone-and-fetch-only]: ./adr-20261011-001-ai-worktree-clone-and-fetch-only.md
[adr-20261011-002-one-ai-stage-per-run]: ./adr-20261011-002-one-ai-stage-per-run.md
[adr-20261011-003-ci-states-and-merge-judgment-timing]: ./adr-20261011-003-ci-states-and-merge-judgment-timing.md
[adr-20261011-004-red-baseline-blocks-new-starts-only]: ./adr-20261011-004-red-baseline-blocks-new-starts-only.md
[adr-20261011-005-stage2-agent-field-and-cleanup-order]: ./adr-20261011-005-stage2-agent-field-and-cleanup-order.md
[adr-20261011-006-local-records-for-counters-only]: ./adr-20261011-006-local-records-for-counters-only.md
[adr-20261011-007-signed-markers-on-all-bot-posts]: ./adr-20261011-007-signed-markers-on-all-bot-posts.md
[adr-20261011-008-link-pr-to-issue-by-branch-author-and-marker]: ./adr-20261011-008-link-pr-to-issue-by-branch-author-and-marker.md
[adr-20261011-009-read-scope-and-secret-locations]: ./adr-20261011-009-read-scope-and-secret-locations.md
[adr-20261011-010-permission-checks-for-labels-edits-and-cutoff]: ./adr-20261011-010-permission-checks-for-labels-edits-and-cutoff.md
[adr-20261011-011-intake-scope-and-milestone-candidate]: ./adr-20261011-011-intake-scope-and-milestone-candidate.md
[adr-20261011-012-provisional-values-in-design]: ./adr-20261011-012-provisional-values-in-design.md
