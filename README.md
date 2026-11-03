# learn-while-building

Turn your Claude Code chats into lessons in coding principles.

Claude keeps doing your task. At the end of each turn that changes code, it adds one short Learn block:
the principle behind a line it just wrote (DRY, YAGNI, fail fast, least privilege...), that real line explained,
why the principle exists, and one check question. It tracks what you know and teaches one step above it.

One lesson per turn, so you learn without overload.

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
