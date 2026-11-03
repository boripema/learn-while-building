# Stop hook: appends what happened in the turn that just ended to $LEARN_DIR/events.jsonl (default ~/.learning):
# lessons given, menus answered (with seconds to answer), the user's own questions and their "learn:" feedback. A script, not Claude, writes
# the log, so it costs no tokens and is never skipped in a long chat. Every line carries the plugin version, so a
# change to the method can be compared across chats.
import datetime, json, os, re, sys

LEARN = re.compile(r"^\s*[#>*_`●\s]*Learn\b", re.M | re.I)
ASK = re.compile(r"\?\s*$|^(what|why|how|where|which|when|who|waarom|hoe|wat|waar|welke)\b", re.I)


def text_of(msg):
    c = msg.get("content")
    if isinstance(c, str):
        return c
    return "\n".join(p.get("text", "") for p in c or [] if isinstance(p, dict) and p.get("type") == "text")


def is_human(e):
    return e.get("type") == "user" and text_of(e.get("message") or {}).strip() and not e.get("isMeta") \
        and not text_of(e["message"]).lstrip().startswith("<")


def ts(s):
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))


def events(entries):
    # Only the last turn: from the last message the user typed to the end.
    start = max((i for i, e in enumerate(entries) if is_human(e)), default=None)
    if start is None:
        return
    human = entries[start]
    text = text_of(human["message"]).strip()
    if text.lower().startswith("learn:"):
        yield {"ts": human["timestamp"], "kind": "feedback", "text": text[6:].strip()[:500]}
    elif ASK.search(text):
        yield {"ts": human["timestamp"], "kind": "question", "text": text[:500]}
    asked = {}
    for e in entries[start + 1:]:
        for p in (e.get("message") or {}).get("content") or []:
            if not isinstance(p, dict):
                continue
            if p.get("type") == "tool_use" and p.get("name") == "AskUserQuestion":
                asked[p["id"]] = (e["timestamp"], (p.get("input") or {}).get("questions") or [])
            if p.get("type") == "tool_result" and p.get("tool_use_id") in asked:
                t0, qs = asked.pop(p["tool_use_id"])
                quiz = any(str(q.get("header", "")).lower().startswith("quiz") for q in qs)
                yield {"ts": t0, "kind": "quiz" if quiz else "decision", "seconds": (ts(e["timestamp"]) - ts(t0)).total_seconds(),
                       "questions": [q.get("question") for q in qs], "answer": json.dumps(p.get("content"))[:500]}
        if e.get("type") == "assistant":
            m = LEARN.search(text_of(e["message"]))
            if m:
                yield {"ts": e["timestamp"], "kind": "lesson", "text": text_of(e["message"])[m.start():][:1500]}


def main():
    hook = json.load(sys.stdin)
    entries = []
    for line in open(hook["transcript_path"], errors="replace"):
        try:
            entries.append(json.loads(line))
        except ValueError:
            continue
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    version = json.load(open(os.path.join(root, ".claude-plugin", "plugin.json")))["version"]
    base = {"session": hook.get("session_id"), "project": os.path.basename(hook.get("cwd") or ""), "version": version}
    out = os.path.join(os.environ.get("LEARN_DIR") or os.path.expanduser("~/.learning"), "events.jsonl")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "a") as f:
        for ev in events(entries):
            f.write(json.dumps({**base, **ev}, ensure_ascii=False) + "\n")


try:
    main()
except Exception as err:
    # A broken log must never block the user's chat; say why on stderr and stop.
    print(f"learn-while-building log: {err}", file=sys.stderr)
