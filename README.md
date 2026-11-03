# learn-while-building

Learn while Building, by Bor Ipema.

Build your project and learn how it works, in the same chat.

Four goals that feed each other, none bought at the cost of another: code quality, coding speed, understanding
of this project, and general software engineering understanding. A lesson must save you more time than it costs
to read.
So Claude keeps doing your task and teaches only at three moments where knowledge saves you time:

- **a decision:** the question Claude asks you carries the one fact you need to choose well;
- **a failure:** after something broke, which part broke, why, and the sign that shows it next time;
- **your own how/why question** about your system.

Lessons are about your system (what a part does, what feeds it, why it is built that way, with the pattern's name
and a source), ending with the general principle behind it, under a bold **Learn** label, in italics. They shrink as you learn a part, and stop once you can change it yourself.
Routine edits get no lesson.

At the start of each chat Claude quizzes you on one older lesson, as a click menu, spaced further apart each time
you get it right.

## Install

In Claude Code:

```
/plugin marketplace add boripema/learn-while-building
/plugin install learn-while-building@learn-while-building
```

That installs it for you in every project. From a terminal you can choose the scope:

```
claude plugin marketplace add boripema/learn-while-building
claude plugin install learn-while-building@learn-while-building --scope user      # you, every project
claude plugin install learn-while-building@learn-while-building --scope project   # everyone in this repo (.claude/settings.json, commit it)
claude plugin install learn-while-building@learn-while-building --scope local     # you, this repo only
```

Your level file stays personal whatever the scope. Needs `sh` and `python3` (macOS and Linux have both; on
Windows use WSL).

## Your level file

Claude tracks your level per principle in `~/.learning/knowledge.md` (set `LEARN_DIR` to move it).
It is created on first use, with twelve common principles to start from.

To use it on several devices, make that folder a private git repo. The plugin pulls it when a session starts,
and Claude pushes after each update:

```
gh repo create learning-progress --private --clone ~/.learning
```

## Feedback and log

Start a message with `learn:` to give feedback on the teaching ("learn: too long"). Claude applies it from then on.

After every reply a hook appends what happened to `~/.learning/events.jsonl`: lessons, decisions (with seconds
to answer), quiz answers, your questions and your `learn:` feedback. Each line carries the plugin version, so
changes to the method can be compared chat by chat. It stays on your machine.

## Check

`sh test.sh` runs the hooks against a temporary folder.

`claude plugin eval . --allow-tools Edit Write --judge-model sonnet` runs three cases (a failure, a why-question,
a routine edit) with and without the plugin.

**The gate for every change.** A new version ships only when it improves at least one goal and makes none worse:

```
claude plugin eval . --allow-tools Edit Write --judge-model sonnet --json new.json
python3 evals/compare.py evals/baseline.json new.json   # PASS: exit 0; then new.json becomes the baseline
```

Each grader in the eval belongs to one goal (quality, speed, project, general; see `evals/compare.py`). One
pass/fail flipping within a goal counts as chance; two or more as a real change. A broken run gives no verdict.

## Licence

MIT
