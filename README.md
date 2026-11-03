# learn-while-building

Build your project and learn how it works, in the same chat.

Three goals, in this order: your project moves forward fast; you learn how this project works, so you decide,
review and debug faster here; and you learn general software engineering principles, which make you faster in every
project. A lesson must save you more time than it costs to read.
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

## Licence

MIT
