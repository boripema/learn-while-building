const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const source = path.resolve(__dirname, "../vscode");
function setup(locked = false) {
  const base = require("os").tmpdir();
  const temp = fs.mkdtempSync(path.join(base, "learn-extension-test-"));
  test.after(() => {
    if (
      path.dirname(temp) !== base ||
      !path.basename(temp).startsWith("learn-extension-test-")
    )
      throw new Error("Unexpected test directory");
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const root = path.join(temp, "project");
  const cache = path.join(temp, "cache");
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(cache, "projects"), { recursive: true });
  const id = "a".repeat(20),
    file = path.join(root, "main.py");
  fs.writeFileSync(file, "x=1\n");
  const project = {
    schema: 1,
    id,
    name: "test",
    root,
    updated: 1,
    focus: ["main.py"],
    nodes: [{ path: "main.py" }, { path: "../../outside.py" }],
    links: [],
  };
  fs.writeFileSync(
    path.join(cache, "projects", id + ".json"),
    JSON.stringify(project),
  );
  fs.writeFileSync(
    path.join(cache, "projects", id + ".meta.json"),
    JSON.stringify({ ...project, nodes: undefined, links: undefined }),
  );
  if (locked) fs.mkdirSync(path.join(cache, "scan.lock"));
  const commands = {},
    events = {},
    messages = [],
    calls = [],
    opened = [];
  let count = 0,
    receiver,
    options;
  const uri = (p) => ({ fsPath: p, scheme: "file", toString: () => p });
  const panel = {
    visible: true,
    webview: {
      html: "",
      asWebviewUri: (x) => x,
      postMessage: (m) => messages.push(m),
      onDidReceiveMessage: (f) => {
        receiver = f;
        return {};
      },
    },
    reveal: () => {},
    onDidDispose: (f) => {
      events.dispose = f;
      return {};
    },
    onDidChangeViewState: (f) => {
      events.visibility = f;
      return {};
    },
  };
  const vscode = {
    workspace: {
      isTrusted: true,
      workspaceFolders: [{ uri: uri(root) }],
      textDocuments: [],
      getConfiguration: () => ({
        get: (k) =>
          k === "dataDirectory" ? cache : k === "python" ? "python3" : true,
      }),
      onDidChangeTextDocument: (f) => {
        events.document = f;
        return {};
      },
      onDidSaveTextDocument: (f) => {
        events.save = f;
        return {};
      },
      createFileSystemWatcher: () => ({
        onDidCreate: (f) => {
          events.create = f;
          return {};
        },
        onDidChange: (f) => {
          events.change = f;
          return {};
        },
        onDidDelete: (f) => {
          events.delete = f;
          return {};
        },
      }),
      openTextDocument: async (u) => {
        opened.push(u.fsPath);
        return { lineCount: 10 };
      },
    },
    window: {
      createWebviewPanel: (a, b, c, o) => {
        count++;
        options = o;
        return panel;
      },
      createStatusBarItem: () => ({ show: () => {} }),
      showTextDocument: async () => {},
      showInformationMessage: () => {},
    },
    commands: {
      registerCommand: (name, fn) => {
        commands[name] = fn;
        return {};
      },
    },
    Uri: {
      file: uri,
      joinPath: (base, ...pieces) => uri(path.join(base.fsPath, ...pieces)),
    },
    ViewColumn: { Active: 1, Beside: 2 },
    StatusBarAlignment: { Right: 1 },
    Range: class {
      constructor(...a) {
        this.args = a;
      }
    },
  };
  const sandbox = {
    exports: {},
    console,
    process,
    require: (name) =>
      name === "vscode"
        ? vscode
        : name === "child_process"
          ? {
              execFile: (...args) => {
                calls.push(args);
                queueMicrotask(() =>
                  args.at(-1)(
                    null,
                    args[1].includes("practice")
                      ? '{"passed":true,"tested":7}'
                      : "{}",
                    "",
                  ),
                );
                return {
                  kill: () => {},
                  stdin: {
                    end: (value) => {
                      args.input = value;
                    },
                  },
                };
              },
            }
          : require(name),
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 2,
    clearTimeout: () => {},
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(source, "extension.js"), "utf8"),
    sandbox,
  );
  sandbox.exports.activate({
    extensionUri: uri(source),
    asAbsolutePath: (p) => path.join(source, p),
    subscriptions: [],
  });
  return {
    commands,
    events,
    messages,
    calls,
    opened,
    vscode,
    panel,
    uri,
    root,
    cache,
    id,
    send: (m) => receiver(m),
    get count() {
      return count;
    },
    get options() {
      return options;
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("one panel per window; hidden renderer is not retained", async () => {
  const s = setup();
  s.commands["learnVisual.open"]();
  await tick();
  s.commands["learnVisual.open"]();
  assert.equal(s.count, 1);
  assert.equal(s.options.retainContextWhenHidden, false);
  assert.equal(s.calls.length, 1);
  assert.ok(s.messages.some((m) => m.type === "snapshot"));
});
test("unsaved source invalidates map and suppresses fresh snapshots", async () => {
  const s = setup();
  s.commands["learnVisual.open"]();
  await tick();
  s.messages.length = 0;
  const document = { uri: s.uri(path.join(s.root, "main.py")), isDirty: true };
  s.vscode.workspace.textDocuments = [document];
  s.events.document({ document });
  await s.send({ type: "ready" });
  assert.ok(s.messages.some((m) => m.type === "invalidated"));
  assert.equal(s.messages.filter((m) => m.type === "snapshot").length, 0);
});
test("another window owning scan lease prevents another indexer process", async () => {
  const s = setup(true);
  s.commands["learnVisual.open"]();
  await tick();
  assert.equal(s.calls.length, 0);
  fs.rmdirSync(path.join(s.cache, "scan.lock"));
  s.commands["learnVisual.refresh"]();
  await tick();
  assert.equal(s.calls.length, 1);
});
test("open-code accepts known in-project source but rejects traversal", async () => {
  const s = setup();
  s.commands["learnVisual.open"]();
  await tick();
  await s.send({
    type: "openCode",
    project: s.id,
    path: "../../outside.py",
    line: 1,
  });
  assert.equal(s.opened.length, 0);
  await s.send({ type: "openCode", project: s.id, path: "main.py", line: 2 });
  assert.deepEqual(s.opened, [path.join(s.root, "main.py")]);
});
test("feedback is local and is never recorded as mastery", async () => {
  const s = setup();
  s.commands["learnVisual.open"]();
  await tick();
  await s.send({
    type: "feedback",
    project: s.id,
    path: "main.py",
    rating: "good",
  });
  const record = JSON.parse(
    fs.readFileSync(path.join(s.cache, "feedback.jsonl"), "utf8"),
  );
  assert.equal(record.rating, "good");
  assert.equal(record.evidenceOfMastery, false);
});

function withPractice(s) {
  const file = path.join(s.cache, "projects", s.id + ".json");
  const p = JSON.parse(fs.readFileSync(file));
  p.nodes[0].practice = {
    expression: "x*2",
    cases: [{ arguments: { x: 2 }, result: 4 }],
  };
  p.nodes[0].digest = require("crypto")
    .createHash("sha256")
    .update(fs.readFileSync(path.join(s.root, "main.py")))
    .digest("hex");
  fs.writeFileSync(file, JSON.stringify(p));
}
test("practice checks saved source and sends expression through stdin", async () => {
  const s = setup();
  withPractice(s);
  s.commands["learnVisual.open"]();
  await tick();
  await s.send({
    type: "practice",
    project: s.id,
    path: "main.py",
    answer: "x+x",
    request: 3,
  });
  await tick();
  const call = s.calls.find((c) => c[1].includes("practice"));
  assert.ok(call);
  assert.equal(JSON.parse(call.input).answer, "x+x");
  assert.ok(
    s.messages.some(
      (m) => m.type === "practiceResult" && m.request === 3 && m.result.passed,
    ),
  );
});
test("practice refuses stale disk contents before file watcher fires", async () => {
  const s = setup();
  withPractice(s);
  s.commands["learnVisual.open"]();
  await tick();
  fs.writeFileSync(path.join(s.root, "main.py"), "x=2\n");
  await s.send({
    type: "practice",
    project: s.id,
    path: "main.py",
    answer: "x+x",
    request: 3,
  });
  await tick();
  assert.equal(s.calls.filter((c) => c[1].includes("practice")).length, 0);
  assert.ok(s.messages.some((m) => m.type === "invalidated"));
});
test("hidden panel never starts practice or indexing on source events", async () => {
  const s = setup();
  withPractice(s);
  s.commands["learnVisual.open"]();
  await tick();
  s.panel.visible = false;
  s.events.visibility();
  const count = s.calls.length;
  s.events.save({ uri: s.uri(path.join(s.root, "main.py")) });
  await s.send({
    type: "practice",
    project: s.id,
    path: "main.py",
    answer: "x+x",
    request: 3,
  });
  assert.equal(s.calls.length, count);
});
