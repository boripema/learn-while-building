#!/bin/sh
# Runs the hook against an empty folder: it must create the level file and print the method with the real path.
set -e
tmp="$(mktemp -d)"
out="$(LEARN_DIR="$tmp" sh "$(dirname "$0")/hooks/teach.sh" start)"
test -f "$tmp/knowledge.md"
echo "$out" | grep -q "$tmp/knowledge.md"
grep -q "DRY" "$tmp/knowledge.md"
LEARN_DIR="$tmp" sh "$(dirname "$0")/hooks/teach.sh" | grep -q "three moments"
# The logger reads only the last turn: an older question must not be logged; this turn's question, menu and lesson must.
cat > "$tmp/t.jsonl" <<'EOF'
{"type":"user","timestamp":"2026-11-03T10:00:00Z","message":{"content":"why is this old?"}}
{"type":"user","timestamp":"2026-11-03T10:01:00Z","message":{"content":"why did the stories not save?"}}
{"type":"assistant","timestamp":"2026-11-03T10:01:10Z","message":{"content":[{"type":"tool_use","id":"m1","name":"AskUserQuestion","input":{"questions":[{"header":"Fix","question":"Retry or skip?"}]}}]}}
{"type":"user","timestamp":"2026-11-03T10:01:40Z","message":{"content":[{"type":"tool_result","tool_use_id":"m1","content":"Retry"}]}}
{"type":"assistant","timestamp":"2026-11-03T10:02:00Z","message":{"content":[{"type":"text","text":"Fixed.\n\n**Learn** the store writes to a temp file first."}]}}
EOF
echo "{\"transcript_path\":\"$tmp/t.jsonl\",\"session_id\":\"s\",\"cwd\":\"/x/demo\"}" | LEARN_DIR="$tmp" python3 "$(dirname "$0")/hooks/log.py"
test "$(grep -c . "$tmp/events.jsonl")" = 3
grep -q '"kind": "decision", "seconds": 30.0' "$tmp/events.jsonl"
grep -q '"kind": "lesson"' "$tmp/events.jsonl"
! grep -q "is this old" "$tmp/events.jsonl"
echo '{"type":"user","timestamp":"2026-11-03T10:03:00Z","message":{"content":"learn: too long"}}' >> "$tmp/t.jsonl"
echo "{\"transcript_path\":\"$tmp/t.jsonl\"}" | LEARN_DIR="$tmp" python3 "$(dirname "$0")/hooks/log.py"
grep -q '"kind": "feedback", "text": "too long"' "$tmp/events.jsonl"
rm -rf "$tmp"
echo ok
