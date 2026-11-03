# The gate for every change to the plugin: compares the eval results of the old and the new version per goal.
# PASS only when at least one goal got better and none got worse (a Pareto improvement).
# Usage: python3 evals/compare.py old.json new.json   (files from: claude plugin eval . --json <file>)
# Exit 0 = PASS, 1 = FAIL, 2 = no verdict (a run broke or was cut short: never counted as a pass).
import json, statistics, sys

# Which goal each grader measures. Graders not listed here are ignored.
GOAL = {
    "fix-handles-slash": "quality",
    "renamed": "quality",
    "old-name-gone": "quality",
    "no-learn-block": "speed",
    "exactly-one-learn-block": "project",
    "names-the-part": "project",
    "system-lesson": "project",
    "names-principle": "general",
}
# Three runs per case vary by chance, and an LLM judge sometimes votes wrong: one pass/fail flipping within a goal
# counts as "the same", two or more as a real change. The clock gets 25%.
SPEED_NOISE = 0.25


def load(path):
    d = json.load(open(path))
    runs = [(c["name"], r) for c in d["cases"] for r in c["arms"]["with"]]
    if d.get("partial") or any(r.get("error") for _, r in runs):
        print(f"no verdict: {path} has a broken or partial run")
        sys.exit(2)
    return runs


def scores(runs, keep):
    # Per goal: share of passed graders, counting only graders both versions have.
    out = {}
    for case, r in runs:
        for g in r["graders"]:
            if (case, g["name"]) in keep and g["name"] in GOAL:
                out.setdefault(GOAL[g["name"]], []).append(g["passed"])
    return {goal: (sum(v) / len(v), len(v)) for goal, v in out.items()}


def seconds(runs):
    return statistics.median(r["durationSeconds"] for _, r in runs)


old, new = load(sys.argv[1]), load(sys.argv[2])
both = {(c, g["name"]) for c, r in old for g in r["graders"]} & {(c, g["name"]) for c, r in new for g in r["graders"]}
a, b = scores(old, both), scores(new, both)
verdict = {}
for goal in sorted(set(a) | set(b)):
    (x, n), (y, m) = a.get(goal, (0, 1)), b.get(goal, (0, 1))
    noise = 1.5 / max(n, m)
    verdict[goal] = "better" if y - x > noise else "worse" if x - y > noise else "same"
    print(f"{goal:8} {x:.2f} -> {y:.2f}  {verdict[goal]}")
s0, s1 = seconds(old), seconds(new)
change = (s1 - s0) / s0
# Speed has a grader (no lesson on routine work) and a clock; slower beyond noise is worse whatever the grader says.
if change > SPEED_NOISE:
    verdict["speed"] = "worse"
elif change < -SPEED_NOISE and verdict.get("speed") != "worse":
    verdict["speed"] = "better"
print(f"seconds  {s0:.0f} -> {s1:.0f} (median per task)  speed {verdict.get('speed', 'same')}")
ok = "worse" not in verdict.values() and "better" in verdict.values()
print("PASS" if ok else "FAIL: no goal better" if "worse" not in verdict.values() else "FAIL: a goal got worse")
sys.exit(0 if ok else 1)
