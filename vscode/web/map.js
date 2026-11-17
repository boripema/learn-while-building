(function () {
  "use strict";
  // Renderer contract: plain graph data + callbacks in, fit/destroy handle out.
  // The engine object never reaches the lesson, practice domain or host.
  function mount(container, options, engine = globalThis.cytoscape) {
    const {
      nodes,
      links,
      selected,
      providers = [],
      roles,
      textColor,
      onSelect,
      onInteract,
    } = options;
    const paths = new Set(nodes.map((n) => n.path)),
      elements = nodes.map((n, i) => ({
        data: {
          id: n.path,
          label: n.path.split("/").pop(),
          color: roles[n.role || "logic"].color,
          shape: roles[n.role || "logic"].shape,
        },
        position: { x: (i % 4) * 230, y: Math.floor(i / 4) * 105 },
        classes: n.path === selected ? "selected" : "",
      }));
    links
      .filter((l) => paths.has(l.source) && paths.has(l.target))
      .forEach((l, i) =>
        elements.push({
          data: { id: "edge" + i, source: l.source, target: l.target },
        }),
      );
    for (const [i, provider] of providers.entries()) {
      if (!paths.has(selected)) break;
      const id = "provider:" + i;
      elements.push(
        {
          data: {
            id,
            label: provider.label,
            color: roles.api.color,
            shape: "hexagon",
          },
          position: { x: 180 + i * 230, y: -110 },
        },
        { data: { id: "provider-edge" + i, source: selected, target: id } },
      );
    }
    const cy = engine({
      container,
      elements,
      pixelRatio: 1,
      layout: { name: "preset", fit: false },
      minZoom: 0.3,
      maxZoom: 2,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            shape: "data(shape)",
            width: 175,
            height: 62,
            "font-size": 13,
            "text-valign": "center",
            "text-wrap": "ellipsis",
            "text-max-width": 155,
            color: textColor,
            "background-color": "data(color)",
            "background-opacity": 0.12,
            "border-color": "data(color)",
            "border-width": 1.5,
          },
        },
        { selector: "node.selected", style: { "border-width": 3 } },
        {
          selector: "edge",
          style: {
            width: 1.4,
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "line-color": "#788496",
            "target-arrow-color": "#788496",
          },
        },
      ],
    });
    cy.zoom(0.85);
    cy.center(cy.nodes().slice(0, Math.min(8, nodes.length)));
    cy.on("tap", "node", (event) => {
      if (paths.has(event.target.id())) onSelect(event.target.id());
    });
    cy.on("dragpan zoom", onInteract);
    let destroyed = false;
    return {
      fit() {
        if (!destroyed) cy.fit(cy.elements(), 28);
      },
      destroy() {
        if (!destroyed) {
          destroyed = true;
          cy.destroy();
        }
      },
    };
  }
  const adapter = { mount };
  if (typeof module !== "undefined") module.exports = adapter;
  else globalThis.LearnMap = adapter;
})();
