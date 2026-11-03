# learn-while-building

A Claude Code plugin that teaches you while Claude builds with you: one short lesson per turn, from your own code,
one step above what you already know.

Built-in output styles like Learning add several explanations per turn. This plugin keeps it to one, so you learn
without overload.

## Install

```
/plugin marketplace add boripema/learn-while-building
/plugin install learn-while-building@learn-while-building
```

## Your level file

Claude tracks what you know in `~/.learning/knowledge.md` (set `LEARN_DIR` to move it). It is created on first use.
To share it across devices, make that folder a private git repo: the plugin pulls it at session start, and Claude
pushes after each update.

```
gh repo create learning-progress --private --clone && mv learning-progress ~/.learning
```

## Check

`sh test.sh` runs the hook against a temporary folder.

## Licence

MIT
