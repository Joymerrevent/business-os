#!/usr/bin/env bash
# 作業場所の用意は evals/lib/scaffold.ts に書く。ここは 1 行だけ
exec node "$(dirname "$0")/../../../lib/scaffold.ts" empty-repo
