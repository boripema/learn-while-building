(function () {
  "use strict";
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const roles = {
    ui: { name: "UI", shape: "round-rectangle", color: "#7296ff" },
    api: { name: "API", shape: "hexagon", color: "#b198ff" },
    logic: { name: "Logica", shape: "diamond", color: "#eac079" },
    data: { name: "Data", shape: "barrel", color: "#65cfac" },
  };
  function box(x, y, w, h, label, role = "logic", minor = "") {
    const color = roles[role].color;
    let shape;
    if (role === "api")
      shape = `<polygon points="${x + 15},${y} ${x + w - 15},${y} ${x + w},${y + h / 2} ${x + w - 15},${y + h} ${x + 15},${y + h} ${x},${y + h / 2}"/>`;
    else if (role === "logic")
      shape = `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}"/>`;
    else
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${role === "data" ? 22 : 9}"/>`;
    return `<g class="shape" style="stroke:${color}">${shape}</g><text x="${x + w / 2}" y="${y + h / 2 - (minor ? 3 : -5)}" text-anchor="middle">${esc(label)}</text>${minor ? `<text class="minor" x="${x + w / 2}" y="${y + h / 2 + 18}" text-anchor="middle">${esc(minor)}</text>` : ""}`;
  }
  const wire = (x1, y1, x2, y2, label = "") =>
    `<path class="wire" d="M${x1} ${y1} L${x2} ${y2}"/>${label ? `<text class="minor" text-anchor="middle" x="${(x1 + x2) / 2 + 28}" y="${(y1 + y2) / 2 - 8}">${esc(label)}</text>` : ""}`;
  function lesson(n) {
    if (n.practice && !n.concepts?.length) {
      const e = n.practice,
        c = exampleCase(e);
      return {
        id: "pure",
        title: "Van invoer naar terugkeerwaarde",
        titles: [
          "Geef waarden mee",
          "Bereken de terugkeerwaarde",
          "Ontvang de uitkomst",
        ],
        captions: [
          `${e.function} ontvangt ${Object.entries(c.arguments)
            .map(([k, v]) => k + " = " + v)
            .join(", ")}.`,
          `De expressie ${e.expression} bepaalt de uitkomst voor deze invoer.`,
          `Voor deze invoer geeft de functie ${JSON.stringify(c.result)} terug.`,
        ],
        labels: [
          Object.values(c.arguments).join(", "),
          e.function,
          JSON.stringify(c.result),
        ],
        example: c,
      };
    }
    const c = n.concepts?.[0]?.id || "boundary",
      sample = n.excerpts?.[0]?.lines.join("\n") || "";
    const awaited = sample.match(/\bawait\s+([\w.$]+)\s*\(/)?.[1] || "aanroep";
    const definitions = {
      async: [
        "Wachten op een resultaat",
        [
          "Start de aanroep",
          "Deze functie wacht",
          "Ga verder met het resultaat",
        ],
        [
          "De aangeroepen functie bepaalt welk werk er gebeurt.",
          "De volgende regel in deze functie wacht op de uitkomst.",
          "Bij een fout kan de normale route afbreken; inspecteer de foutafhandeling.",
        ],
        [awaited, "Wacht op resultaat", "Volgende regel"],
      ],
      validation: [
        "Controle aan de grens",
        ["Ontvang invoer", "Controleer de invoer", "Bepaal het vervolg"],
        [
          "Bekijk welke gegevens deze controle ontvangt.",
          "De aangetroffen validatie-aanroep bepaalt zelf wat geldig is.",
          "Inspecteer de tak voor ongeldige invoer voordat je op de controle vertrouwt.",
        ],
        ["Invoer", "Validatie", "Vervolg"],
      ],
      guard: [
        "Een ongeldige route stoppen",
        ["Bereik de controle", "Gooi een fout", "Zoek de foutafhandeling"],
        [
          "De omliggende voorwaarde bepaalt wanneer deze fout optreedt.",
          "Throw onderbreekt de normale uitvoering.",
          "De aanroeper moet bepalen wat de gebruiker van de fout merkt.",
        ],
        ["Voorwaarde", "throw", "Afhandeling"],
      ],
      errors: [
        "Een fout afhandelen",
        [
          "Normale uitvoering",
          "Een fout wordt opgevangen",
          "Wat krijgt de aanroeper?",
        ],
        [
          "Zoek welke bewerking binnen deze try kan mislukken.",
          "Catch of except maakt een afzonderlijk pad voor fouten.",
          "Controleer of de fout zichtbaar blijft en wat er wordt teruggegeven.",
        ],
        ["Bewerking", "catch / except", "Vervolg"],
      ],
      data: [
        "De grens met opgeslagen data",
        [
          "Vind de gegevens",
          "Inspecteer de opslagaanroep",
          "Volg het resultaat",
        ],
        [
          "De bronregel bevat een mogelijke gegevensbewerking.",
          "De aangeroepen functie bepaalt de echte opslag en toegangscontrole.",
          "Controleer ook wat er gebeurt als de bewerking mislukt.",
        ],
        ["Gegevens", "Opslagaanroep", "Resultaat"],
      ],
      memory: [
        "Gegevens in procesgeheugen",
        [
          "Maak een collectie",
          "Gebruik dezelfde instantie",
          "Wat gebeurt er bij herstart?",
        ],
        [
          "Een nieuwe Map of Set begint als een collectie in dit proces.",
          "Wijzigingen zijn zichtbaar via verwijzingen naar dezelfde collectie.",
          "Bewaren over een herstart vraagt afzonderlijke opslag en herstel.",
        ],
        ["Nieuwe collectie", "Procesgeheugen", "Herstart"],
      ],
      boundary: [
        "Waar dit bestand van afhangt",
        [
          "Dit bestand",
          "Een import legt een afhankelijkheid vast",
          "Bekijk het verband",
        ],
        [
          "Een import is een codeafhankelijkheid, geen bewijs van een runtime-aanroep.",
          "De package of het lokale bestand levert iets dat hier wordt gebruikt.",
          "Open een gevonden afhankelijkheid om de gebruikte interface te volgen.",
        ],
        [n.path.split("/").pop(), "Import", "Afhankelijkheid"],
      ],
    };
    return {
      id: c,
      title: definitions[c][0],
      titles: definitions[c][1],
      captions: definitions[c][2],
      labels: definitions[c][3],
    };
  }
  function diagram(n, l, step) {
    const provider = n.providers?.[0];
    let body = "";
    if (l.id === "pure") {
      const e = n.practice,
        c = l.example,
        entries = Object.entries(c.arguments),
        sub = substitute(e.expression, c.arguments);
      const inputs = entries
        .map(([name, value], i) => {
          const x = entries.length === 1 ? 145 : 55 + i * 185;
          return `<rect class="shape" x="${x}" y="48" width="145" height="88" rx="8" style="stroke:var(--data)"/><text class="minor" x="${x + 72}" y="76" text-anchor="middle">${esc(name)}</text><text x="${x + 72}" y="110" text-anchor="middle" style="font-size:25px">${esc(value)}</text>`;
        })
        .join("");
      const inputWires =
        entries.length === 1
          ? wire(220, 140, 220, 187)
          : wire(127, 142, 195, 187) + wire(312, 142, 245, 187);
      body = inputs + (step !== 0 ? inputWires : "");
      if (step === 0)
        body += `<text class="minor" x="220" y="233" text-anchor="middle">parameters van ${esc(e.function)}</text>`;
      if (step !== 0)
        body += `<rect class="shape" x="48" y="197" width="344" height="106" rx="5" style="stroke:var(--logic)"/><text x="220" y="235" text-anchor="middle" style="font-size:${e.expression.length > 24 ? 13 : 18}px">${esc(e.expression)}</text><text class="minor" x="220" y="275" text-anchor="middle">${esc(sub)}</text>`;
      if (step >= 2)
        body +=
          wire(220, 309, 220, 350) +
          `<rect class="shape" x="145" y="358" width="150" height="70" rx="8" style="stroke:var(--data)"/><text x="220" y="403" text-anchor="middle" style="font-size:26px">${esc(JSON.stringify(c.result))}</text>`;
      return `<svg viewBox="0 0 440 440" role="img" aria-label="${esc(step === 3 ? l.title : l.titles[step])}"><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="currentColor"/></marker></defs>${body}</svg>`;
    }
    if (step < 3) {
      const role = step === 1 ? "logic" : n.role || "logic";
      body = box(96, 145, 248, 136, l.labels[step], role);
      if (step === 1)
        body +=
          wire(220, 78, 220, 138) +
          wire(220, 289, 220, 350) +
          `<text class="minor" x="220" y="65" text-anchor="middle">${esc(l.labels[0])}</text><text class="minor" x="220" y="377" text-anchor="middle">${esc(l.labels[2])}</text>`;
      else
        body += `<text class="minor" x="220" y="318" text-anchor="middle">${esc(n.path.split("/").pop())}</text>`;
    } else {
      body =
        box(112, 35, 216, 72, l.labels[0], "api") +
        wire(220, 112, 220, 160) +
        box(90, 170, 260, 118, l.labels[1], "logic") +
        wire(220, 295, 220, 341) +
        box(112, 350, 216, 72, l.labels[2], l.id === "memory" ? "data" : "ui");
    }
    if (provider && step === 0)
      body += `<text x="220" y="74" text-anchor="middle" style="fill:var(--api)">${esc(provider.label)}</text><text class="minor" x="220" y="98" text-anchor="middle">package geïmporteerd in dit bestand</text>`;
    return `<svg viewBox="0 0 440 440" role="img" aria-label="${esc(step === 3 ? l.title : l.titles[step])}"><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="currentColor"/></marker></defs>${body}</svg>`;
  }
  function exampleCase(e) {
    return (
      e.cases.find((c) => {
        const v = Object.values(c.arguments);
        return (
          v.every((n) => typeof n === "number" && n > 1) &&
          new Set(v).size === v.length
        );
      }) || e.cases[Math.floor(e.cases.length / 2)]
    );
  }
  function substitute(expression, args) {
    return expression.replace(/\b[A-Za-z_]\w*\b/g, (name) =>
      Object.hasOwn(args, name) ? String(args[name]) : name,
    );
  }

  const mechanisms = { roles, esc, lesson, diagram, exampleCase, substitute };
  if (typeof module !== "undefined") module.exports = mechanisms;
  else globalThis.LearnMechanisms = mechanisms;
})();
