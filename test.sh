#!/bin/sh
# Runs the hook against an empty folder: it must create the level file and print the method with the real path.
set -e
tmp="$(mktemp -d)"
out="$(LEARN_DIR="$tmp" sh "$(dirname "$0")/hooks/teach.sh" start)"
test -f "$tmp/knowledge.md"
echo "$out" | grep -q "$tmp/knowledge.md"
grep -q "DRY" "$tmp/knowledge.md"
LEARN_DIR="$tmp" sh "$(dirname "$0")/hooks/teach.sh" | grep -q "One Learn block"
rm -rf "$tmp"
echo ok
