# learn-while-building

Build your project and learn how it works, in the same chat.

Understanding what you build is what makes building fast: you decide, review and debug without waiting on Claude.
So Claude keeps doing your task, and each turn that changes code ends with one short Learn block:
the part of your system it touched and how it fits the whole, the real line explained, why it is built that way
(the principle behind it, with a source), and what this lets you do next.

At the start of each chat Claude quizzes you on one older lesson, as a click menu, spaced further apart each time
you get it right. It tracks what you know, per principle and per part of each project, and teaches one step above it.

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

## Check

`sh test.sh` runs the hook against a temporary folder.

## Licence

MIT
