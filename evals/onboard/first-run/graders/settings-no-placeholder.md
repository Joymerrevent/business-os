---
type: regex
pattern: '"file_path":"[^"]*/\.claude/settings\.json","content":"(?:[^"\\]|\\.)*\{\{'
match: not_contains
target: trace
---
