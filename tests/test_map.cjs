const test = require("node:test");
const assert = require("node:assert/strict");
const { mount } = require("../vscode/web/map.js");
const { roles } = require("../vscode/web/mechanisms.js");
test("map adapter owns engine objects and exposes only fit/destroy", () => {
  let engineOptions,
    selected,
    fits = 0,
    destroyed = 0;
  const events = {};
  const engine = (options) => {
    engineOptions = options;
    return {
      zoom() {},
      center() {},
      nodes: () => [],
      elements: () => [],
      on: (event, ...args) => {
        events[event] = args.at(-1);
      },
      fit: () => {
        fits++;
      },
      destroy: () => {
        destroyed++;
      },
    };
  };
  const view = mount(
    {},
    {
      nodes: [{ path: "a.py", role: "logic" }],
      links: [],
      selected: "a.py",
      roles,
      textColor: "#ddd",
      onSelect: (path) => {
        selected = path;
      },
      onInteract: () => {},
    },
    engine,
  );
  assert.deepEqual(Object.keys(view).sort(), ["destroy", "fit"]);
  events.tap({ target: { id: () => "a.py" } });
  assert.equal(selected, "a.py");
  assert.equal(engineOptions.elements.length, 1);
  view.fit();
  view.destroy();
  view.destroy();
  view.fit();
  assert.equal(fits, 1);
  assert.equal(destroyed, 1);
});
test("DOM controller does not depend on the Cytoscape API", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").resolve(__dirname, "../vscode/web/viewer.js"),
    "utf8",
  );
  assert.doesNotMatch(source, /\bcytoscape\b|\bcy\./);
});
