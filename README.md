# Learn while Building — local visual alpha

The 0.2.2 test build is a VS Code companion extension: one Learn tab per window, focused visual steps with highlighted source, a separate Cytoscape map, and optional locally checked Python completion exercises. Native filesystem/save events pick up changes made by Claude Code, Codex or any editor. No learning instructions, model calls or per-agent hooks are used. Branding and token badges are removed; workspace-local usage counters help test whether the page is used.

Open Learn from the status bar or the command Learn: Open visual learning tab. Place it beside your chats. Source changes hide the old view during reindexing; unsaved source changes pause the map until saved. This is an explicit alpha limitation, not full live-buffer support. Hidden views unload and suspend. A shared lease permits one indexer process across windows.

## Install or update

The Claude plugin and the VS Code companion are separate installations. Claude plugin **0.7.1** disables the old prompt-based lessons and quizzes. The visual interface is VS Code companion **0.2.2**; updating the Claude plugin alone does not install it.

Download `learn-while-building-visual-0.2.2.vsix` from the [v0.7.1 release](https://github.com/boripema/learn-while-building/releases/tag/v0.7.1), then use VS Code's **Extensions: Install from VSIX…** or:

```sh
code --install-extension learn-while-building-visual-0.2.2.vsix --force
```

Reload existing VS Code windows when running agents have finished. Open **Learn: Open visual learning tab**. Python 3 is required; set `learnVisual.python` to your executable if `python3` is unavailable. Other VS Code profiles need their own companion installation.

To rebuild from source, with Node.js satisfying the build tool's engine requirements:

```sh
git clone https://github.com/boripema/learn-while-building.git
cd learn-while-building/vscode
npx --yes @vscode/vsce@4.1.1 package --no-dependencies --allow-missing-repository --out learn-while-building-visual-0.2.2.vsix
```

The prepublish step copies the Python modules automatically. No local caches or private learning data are committed. The Claude marketplace remains `boripema/learn-while-building`; use Claude's plugin manager to refresh it and update the installed plugin to 0.7.1. Existing chat context may retain old teaching instructions until a fresh session.

The [peer-reviewed evidence matrix](docs/learning-evidence.md) separates findings, limitations and design hypotheses.

## Scope and architecture

See vscode/README.md for setup and limitations. The source supports Python/JavaScript/TypeScript static imports; aliases, runtime flows, learner profiles and adaptive explanations remain incomplete. Exercises cover only restricted numeric Python functions. The four PDF goals remain code quality, speed, product understanding and general software knowledge. No measured whole-task 5% or RAM-compliance claim is made.

Modules: hooks/visual.py owns indexing and caching; hooks/practice.py owns restricted exercise selection/checking; vscode/extension.js owns VS Code events and local processes; vscode/web/mechanisms.js owns pure explanation templates; web/map.js owns the replaceable map-engine adapter (mount → fit/destroy); web/viewer.js owns DOM interactions, with separate CSS and HTML. Packaging copies the Python modules automatically from hooks; edit their source there. No frontend framework or runtime service was added.

Checks: python -m unittest discover -s tests -q; node --test tests/test_extension.cjs tests/test_mechanisms.cjs tests/test_map.cjs. No configured hook injects teaching instructions; the old text-lesson scripts were removed in 0.7.1. Existing ~/.learning knowledge is preserved. The VS Code companion is distributed as a GitHub VSIX asset, not through the VS Code Marketplace. RAM, whole-task token overhead and educational outcomes remain unmeasured.
