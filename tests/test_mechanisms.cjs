const test = require("node:test");
const assert = require("node:assert/strict");
const { lesson, diagram } = require("../vscode/web/mechanisms.js");
test("numeric mechanism uses actual parameters, expression and reference output", () => {
  const n = {
    path: "price.py",
    role: "logic",
    concepts: [],
    practice: {
      function: "total",
      expression: "price * quantity",
      cases: [{ arguments: { price: 2, quantity: 4 }, result: 8 }],
    },
  };
  const l = lesson(n);
  assert.match(l.captions[0], /price = 2, quantity = 4/);
  const svg = diagram(n, l, 3);
  assert.match(svg, /price \* quantity/);
  assert.match(svg, />8</);
  assert.match(svg, /viewBox="0 0 440 440"/);
});
test("async mechanism names the actual awaited call, without inventing a provider", () => {
  const n = {
    path: "api.ts",
    role: "api",
    concepts: [{ id: "async" }],
    excerpts: [{ lines: ["const x = await client.query(data);"] }],
    providers: [],
  };
  const l = lesson(n);
  assert.equal(l.labels[0], "client.query");
  assert.doesNotMatch(diagram(n, l, 0), /Supabase|Entra/);
});
test("source labels cannot inject markup into the figure", () => {
  const n = {
    path: "<script>alert(1)</script>.py",
    role: "logic",
    concepts: [],
    excerpts: [],
  };
  assert.doesNotMatch(diagram(n, lesson(n), 0), /<script>/);
});
