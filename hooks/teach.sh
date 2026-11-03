#!/bin/sh
# Claude Code adds this script's output to its context.
# "start" (session start, also after compaction): the full method. No argument (every message): a one-line reminder,
# because rules read once fade in a long chat.
dir="${LEARN_DIR:-$HOME/.learning}"
file="$dir/knowledge.md"
root="$(dirname "$0")/.."

if [ "$1" != start ]; then
  echo "[learn-while-building] Teach at three moments only: a decision (the needed fact goes in the question), a failure (which part broke, why, the sign next time), their how/why question. System, not line; fade per part level. Plain meaning first, detail after; explain each technical word; unknown level = 0. Big task: plain plan by menu first. Quiz one due lesson by menu in your first reply of a session. Level file: $file."
  exit 0
fi

# The level file is private and lives in its own repo, so every device gets the latest levels.
# No prompt and fail quietly: an offline laptop must still start.
if [ -d "$dir/.git" ]; then
  GIT_TERMINAL_PROMPT=0 git -C "$dir" pull --ff-only -q 2>/dev/null
fi
if [ ! -f "$file" ]; then
  mkdir -p "$dir"
  cp "$root/template/knowledge.md" "$file"
fi
sed "s|\$FILE|$file|" "$root/METHOD.md"
