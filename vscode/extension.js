"use strict";
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
let panel,
  context,
  scanTimer,
  child,
  graphCache,
  selectedProject,
  revision = 0,
  epoch = 0,
  stale = true,
  scanning = false,
  scanAgain = false;
let status,
  focusPath,
  practiceChild,
  viewedAt,
  unseen = false;
let usage = { opens: 0, steps: 0, practices: 0, visibleSeconds: 0 };
function saveUsage() {
  context.workspaceState?.update("learnUsage", usage);
}
function finishView() {
  if (viewedAt) {
    usage.visibleSeconds += Math.round((Date.now() - viewedAt) / 1000);
    viewedAt = undefined;
    saveUsage();
  }
}
function currentFocus(uri = vscode.window.activeTextEditor?.document?.uri) {
  if (!uri || !relevant(uri)) return;
  focusPath = uri.fsPath;
}
function markUnseen(value = !panel?.visible) {
  unseen = value;
  if (status) {
    status.text = unseen ? "$(circle-filled) Learn" : "$(type-hierarchy) Learn";
    status.tooltip = unseen
      ? "Opgeslagen code gewijzigd. Klik om Learn te bekijken."
      : "Open de visuele uitleg. Geen modelcalls.";
  }
}

function dataDir() {
  const custom = vscode.workspace
    .getConfiguration("learnVisual")
    .get("dataDirectory");
  return (
    custom ||
    path.join(
      process.env.LEARN_DIR || path.join(os.homedir(), ".learning"),
      "visual",
    )
  );
}

function dirty() {
  return (vscode.workspace.textDocuments || []).some(
    (d) => d.isDirty && relevant(d.uri),
  );
}
function relevant(uri) {
  return (
    uri.scheme === "file" &&
    /\.(py|[cm]?js|jsx|tsx?)$/.test(uri.fsPath) &&
    !/(?:^|[\\/])(?:node_modules|dist|build|vendor|coverage|\.[^\\/]+)(?:[\\/]|$)/.test(
      uri.fsPath,
    )
  );
}
function payload() {
  const directory = path.join(dataDir(), "projects");
  const projects = [];
  const workspace = (vscode.workspace.workspaceFolders || []).map(
    (f) => f.uri.fsPath,
  );
  if (fs.existsSync(directory))
    for (const file of fs
      .readdirSync(directory)
      .filter((f) => /^[a-f0-9]{20}\.meta\.json$/.test(f))) {
      try {
        const meta = JSON.parse(
          fs.readFileSync(path.join(directory, file), "utf8"),
        );
        if (meta.schema === 1) projects.push({ ...meta, nodes: [], links: [] });
      } catch (_) {}
    }
  if (!projects.some((p) => p.id === selectedProject)) {
    selectedProject = (
      projects.find((p) => workspace.some((w) => inside(p.root, w))) ||
      projects[0]
    )?.id;
  }
  const active = projects.find((p) => p.id === selectedProject);
  if (active) {
    const file = path.join(directory, active.id + ".json");
    try {
      const stat = fs.statSync(file);
      const key = file + ":" + stat.mtimeMs + ":" + stat.size;
      if (stat.size > 8 * 1024 * 1024)
        throw new Error("Project snapshot exceeds the alpha memory limit.");
      if (graphCache?.key !== key)
        graphCache = { key, data: JSON.parse(fs.readFileSync(file, "utf8")) };
      projects[projects.indexOf(active)] = graphCache.data;
    } catch (error) {
      if (panel)
        panel.webview.postMessage({ type: "notice", text: error.message });
    }
  }
  const root = projects.find((p) => p.id === selectedProject)?.root;
  return {
    type: "snapshot",
    projects,
    workspace,
    selectedProject,
    revision,
    focusPath:
      root && focusPath && inside(root, focusPath)
        ? path.relative(root, focusPath).replace(/\\/g, "/")
        : null,
  };
}
function invalidate(
  text = "Source files changed. Re-indexing saved code locally.",
) {
  stale = true;
  epoch++;
  practiceChild?.kill();
  practiceChild = undefined;
  if (panel?.visible) panel.webview.postMessage({ type: "invalidated", text });
}
function send() {
  if (panel?.visible && !stale && !dirty())
    panel.webview.postMessage(payload());
}
function schedule() {
  if (!panel?.visible) return;
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 800);
}
function scan() {
  if (!vscode.workspace.isTrusted || !panel?.visible) return;
  if (dirty()) {
    invalidate(
      "Unsaved source edits detected. This alpha hides the old map until you save; it does not analyse unsaved buffers yet.",
    );
    return;
  }
  if (scanning) {
    scanAgain = true;
    return;
  }
  const folders = (vscode.workspace.workspaceFolders || []).map(
    (f) => f.uri.fsPath,
  );
  // Scan the folder you are editing in; the first folder otherwise.
  const root =
    folders.find((f) => focusPath && inside(f, focusPath)) || folders[0];
  if (!root) {
    stale = false;
    send();
    return;
  }
  fs.mkdirSync(dataDir(), { recursive: true });
  const lease = path.join(dataDir(), "scan.lock");
  try {
    fs.mkdirSync(lease);
  } catch (_) {
    try {
      if (Date.now() - fs.statSync(lease).mtimeMs > 45000) fs.rmdirSync(lease);
    } catch (_) {}
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 1300 + Math.random() * 600);
    return;
  }
  scanning = true;
  const started = epoch;
  const python =
    vscode.workspace.getConfiguration("learnVisual").get("python") || "python3";
  child = execFile(
    python,
    [context.asAbsolutePath("visual.py"), "scan", root],
    {
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 16384,
      env: { ...process.env, LEARN_VISUAL_DIR: dataDir() },
    },
    (error) => {
      child = undefined;
      scanning = false;
      try {
        fs.rmdirSync(lease);
      } catch (_) {}
      if (error) {
        invalidate(
          "Local indexing did not finish. Check the Python executable in Learn settings, then Refresh.",
        );
        return;
      }
      if (started !== epoch || scanAgain) {
        scanAgain = false;
        schedule();
        return;
      }
      stale = false;
      revision++;
      graphCache = undefined;
      if (panel?.visible)
        panel.webview.postMessage({ type: "notice", text: "" });
      send();
    },
  );
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative)
  );
}

async function receive(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "ready") {
    if (stale || dirty()) scan();
    else send();
    return;
  }
  if (message.type === "engagement") {
    if (message.action === "step") usage.steps++;
    if (message.action === "practice") usage.practices++;
    saveUsage();
    return;
  }
  if (message.type === "selectProject") {
    selectedProject = message.project;
    graphCache = undefined;
    revision++;
    send();
    return;
  }
  if (message.type === "refresh") {
    scan();
    return;
  }
  const project = payload().projects.find((p) => p.id === message.project);
  if (!project) return;
  const node = project.nodes.find((n) => n.path === message.path);
  if (
    message.type === "practice" &&
    node?.practice &&
    panel?.visible &&
    vscode.workspace.isTrusted
  ) {
    const unavailable = (reason) =>
      panel?.webview.postMessage({
        type: "practiceResult",
        request: message.request,
        result: { passed: false, unavailable: true, reason },
      });
    if (stale || dirty() || scanning) {
      unavailable(
        "De broncode wordt bijgewerkt. Sla op en probeer daarna opnieuw.",
      );
      return;
    }
    const file = path.resolve(project.root, node.path);
    let digest;
    try {
      if (
        !inside(project.root, file) ||
        !inside(fs.realpathSync(project.root), fs.realpathSync(file)) ||
        fs.statSync(file).size > 64000
      ) {
        unavailable("Dit bestand kan niet lokaal worden gecontroleerd.");
        return;
      }
      digest = crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex");
    } catch (_) {
      unavailable(
        "Het bronbestand is verplaatst of niet meer leesbaar. Vernieuw de kaart.",
      );
      return;
    }
    if (digest !== node.digest) {
      invalidate(
        "De broncode veranderde. Sla op en vernieuw voordat je oefent.",
      );
      schedule();
      return;
    }
    const python =
      vscode.workspace.getConfiguration("learnVisual").get("python") ||
      "python3";
    const started = epoch;
    practiceChild?.kill();
    practiceChild = execFile(
      python,
      [context.asAbsolutePath("visual.py"), "practice"],
      { windowsHide: true, timeout: 3000, maxBuffer: 16384 },
      (error, stdout) => {
        practiceChild = undefined;
        if (started !== epoch || !panel?.visible) return;
        let result;
        try {
          result = error
            ? {
                passed: false,
                unavailable: true,
                reason:
                  "Lokale controle niet beschikbaar. De bronoplossing staat hieronder.",
              }
            : JSON.parse(stdout);
        } catch (_) {
          result = {
            passed: false,
            unavailable: true,
            reason: "Controle gaf geen leesbaar resultaat.",
          };
        }
        panel.webview.postMessage({
          type: "practiceResult",
          request: message.request,
          result,
        });
      },
    );
    practiceChild.stdin.on?.("error", () => {});
    practiceChild.stdin.end(
      JSON.stringify({
        example: node.practice,
        answer: String(message.answer || "").slice(0, 240),
      }),
    );
    return;
  }
  if (message.type === "openCode" && node && vscode.workspace.isTrusted) {
    const file = path.resolve(project.root, node.path);
    if (!inside(project.root, file)) return;
    try {
      const resolved = fs.realpathSync(file);
      if (!inside(fs.realpathSync(project.root), resolved)) return;
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(resolved),
      );
      const line = Math.max(
        0,
        Math.min(document.lineCount - 1, Number(message.line || 1) - 1),
      );
      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        selection: new vscode.Range(line, 0, line, 0),
        preview: true,
      });
    } catch (_) {
      vscode.window.showInformationMessage(
        "That file moved or was removed. Refresh the project map.",
      );
    }
  }
  if (
    message.type === "feedback" &&
    ["bad", "okay", "good", "incorrect"].includes(message.rating)
  ) {
    const record = {
      at: new Date().toISOString(),
      project: project.id,
      path: node ? node.path : null,
      rating: message.rating,
      detail: String(message.detail || "").slice(0, 500),
      evidenceOfMastery: false,
    };
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.appendFileSync(
      path.join(dataDir(), "feedback.jsonl"),
      JSON.stringify(record) + "\n",
      "utf8",
    );
    panel.webview.postMessage({
      type: "feedbackSaved",
      rating: message.rating,
    });
  }
}

function open() {
  markUnseen(false);
  currentFocus();
  if (panel) {
    panel.reveal(vscode.ViewColumn.Active, true);
    return;
  }
  usage.opens++;
  saveUsage();
  viewedAt = Date.now();
  panel = vscode.window.createWebviewPanel(
    "learnVisual",
    "Learn",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "vendor"),
        vscode.Uri.joinPath(context.extensionUri, "web"),
      ],
    },
  );
  const nonce = crypto.randomBytes(20).toString("hex");
  let html = fs.readFileSync(context.asAbsolutePath("viewer.html"), "utf8");
  html = html
    .replaceAll("__NONCE__", nonce)
    .replace("__PREVIEW_DATA__", "null")
    .replace(
      "__CYTOSCAPE_URI__",
      panel.webview
        .asWebviewUri(
          vscode.Uri.joinPath(
            context.extensionUri,
            "vendor",
            "cytoscape.min.js",
          ),
        )
        .toString(),
    )
    .replace(
      "__HIGHLIGHT_URI__",
      panel.webview
        .asWebviewUri(
          vscode.Uri.joinPath(
            context.extensionUri,
            "vendor",
            "highlight.min.js",
          ),
        )
        .toString(),
    );
  for (const [marker, file] of [
    ["__STYLE_URI__", "viewer.css"],
    ["__MECHANISMS_URI__", "mechanisms.js"],
    ["__MAP_URI__", "map.js"],
    ["__VIEWER_URI__", "viewer.js"],
  ])
    html = html.replace(
      marker,
      panel.webview
        .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "web", file))
        .toString(),
    );
  html = html.replace("__WEBVIEW_CSP_SOURCE__", panel.webview.cspSource || "");
  panel.webview.html = html;
  panel.webview.onDidReceiveMessage(receive, null, context.subscriptions);
  panel.onDidDispose(
    () => {
      finishView();
      panel = undefined;
      clearTimeout(scanTimer);
      child?.kill();
      practiceChild?.kill();
      graphCache = undefined;
    },
    null,
    context.subscriptions,
  );
  panel.onDidChangeViewState(
    () => {
      if (panel?.visible) {
        if (!viewedAt) {
          viewedAt = Date.now();
          usage.opens++;
          saveUsage();
        }
        markUnseen(false);
        invalidate();
        schedule();
      } else {
        finishView();
        clearTimeout(scanTimer);
        child?.kill();
        practiceChild?.kill();
        graphCache = undefined;
      }
    },
    null,
    context.subscriptions,
  );
  scan();
}

function activate(extensionContext) {
  context = extensionContext;
  usage = { ...usage, ...context.workspaceState?.get("learnUsage", {}) };
  context.subscriptions.push(
    vscode.commands.registerCommand("learnVisual.open", open),
  );
  context.subscriptions.push(
    // Refresh needs the tab: a closed tab is opened, which also scans.
    vscode.commands.registerCommand("learnVisual.refresh", () =>
      panel ? scan() : open(),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("learnVisual.usage", () => {
      const seconds =
        usage.visibleSeconds +
        (viewedAt ? Math.round((Date.now() - viewedAt) / 1000) : 0);
      vscode.window.showInformationMessage(
        `Learn in dit workspace: ${usage.opens} keer geopend, ${usage.steps} stappen, ${usage.practices} oefeningen gestart, ${Math.round(seconds / 60)} minuten zichtbaar. Zichtbaar is geen bewijs van aandacht of leren.`,
      );
    }),
  );
  if (vscode.window.onDidChangeActiveTextEditor)
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        currentFocus(editor?.document?.uri);
        if (panel?.visible) send();
      }),
    );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        panel?.visible &&
        relevant(event.document.uri) &&
        event.document.isDirty
      )
        invalidate(
          "Unsaved source edits. Save to update this alpha map; old code is hidden.",
        );
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (relevant(document.uri)) {
        markUnseen();
        if (panel?.visible) {
          invalidate();
          if (
            vscode.workspace
              .getConfiguration("learnVisual")
              .get("autoRefreshOnSave") !== false
          )
            schedule();
        }
      }
    }),
  );
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/*.{py,js,jsx,ts,tsx,mjs,cjs}",
  );
  const changed = (uri) => {
    if (relevant(uri)) {
      markUnseen();
      if (panel?.visible) {
        invalidate();
        if (
          vscode.workspace
            .getConfiguration("learnVisual")
            .get("autoRefreshOnSave") !== false
        )
          schedule();
      }
    }
  };
  context.subscriptions.push(
    watcher,
    watcher.onDidCreate(changed),
    watcher.onDidChange(changed),
    watcher.onDidDelete(changed),
  );
  context.subscriptions.push({
    dispose() {
      clearTimeout(scanTimer);
    },
  });
  status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );
  status.text = "$(type-hierarchy) Learn";
  status.tooltip =
    "Open this window’s visual learning tab. Local processing; no model calls.";
  status.command = "learnVisual.open";
  status.show();
  context.subscriptions.push(status);
}

exports.activate = activate;
exports.deactivate = () => {
  finishView();
  clearTimeout(scanTimer);
  child?.kill();
  practiceChild?.kill();
};
