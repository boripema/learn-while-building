"use strict";
const preview = globalThis.LEARN_PREVIEW;
const api = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
const saved = api?.getState() || {};
const $ = (s) => document.querySelector(s);
const { roles, esc, lesson, diagram, exampleCase, substitute } =
  LearnMechanisms;

let projects = [],
  active = saved.active,
  selected = saved.selected,
  view = saved.view || "story",
  pinned = !!saved.pinned,
  step = 0,
  signature = "",
  mapAdapter,
  limit = 24,
  query = "",
  practiceOpen = false,
  request = 0;
const project = () => projects.find((p) => p.id === active),
  node = () => project()?.nodes?.find((n) => n.path === selected);
function post(m) {
  api?.postMessage(m);
}
function persist() {
  api?.setState({ active, selected, view, pinned });
}
function highlight(line, path) {
  try {
    return hljs.highlight(line, {
      language: path?.endsWith(".py")
        ? "python"
        : /\.tsx?$/.test(path || "")
          ? "typescript"
          : "javascript",
      ignoreIllegals: true,
    }).value;
  } catch (_) {
    return esc(line);
  }
}
function disposeGraph() {
  if (mapAdapter) {
    mapAdapter.destroy();
    mapAdapter = null;
  }
}
function setView(next) {
  view = next;
  practiceOpen = false;
  render();
  persist();
}
function choose(path) {
  selected = path;
  step = 0;
  practiceOpen = false;
  view = "story";
  render();
  persist();
  post({ type: "engagement", action: "select" });
}
function sourceLines(n, all = false) {
  if (n.practice && !n.concepts?.length && !all) {
    const e = n.practice;
    return `<div class="code"><div class="source"><button data-open="${e.line}">${esc(n.path)}:${e.line} ↗</button><span>opgeslagen broncode</span></div><div class="lines"><div class="line"><code>${highlight(e.code.join("\n"), n.path)}</code></div></div></div>`;
  }
  const e = n.excerpts?.[0];
  if (!e) return "";
  const lines = all
    ? e.lines
    : e.lines.slice(
        Math.max(0, e.highlight - e.line),
        Math.max(0, e.highlight - e.line) + 1,
      );
  const start = all ? e.line : e.highlight;
  return `<div class="code"><div class="source"><button data-open="${start}">${esc(n.path)}:${start} ↗</button><span>opgeslagen broncode</span></div><div class="lines">${lines.map((s, i) => `<div class="line ${start + i === e.highlight ? "key" : ""}"><span class="number">${start + i}</span><code>${highlight(s, n.path)}</code></div>`).join("")}</div></div>`;
}
function context(n, l) {
  return `<div class="context"><details><summary>Bron, verbanden en beperkingen</summary><p>Deze uitleg gebruikt een lokaal herkend codepatroon (${esc(l.id)}). De figuur verklaart het algemene principe; zij bewijst niet de volledige uitvoering van dit product. Open de broncode om de toepassing te controleren.</p>${sourceLines(n, true)}<div class="files">${project()
    .links.filter((e) => e.source === n.path || e.target === n.path)
    .slice(0, 12)
    .map((e) => {
      const path = e.source === n.path ? e.target : e.source;
      return `<button data-file="${esc(path)}">${esc(path)}</button>`;
    })
    .join(
      "",
    )}</div>${n.providers?.length ? `<p>${n.providers.map((p) => esc(p.label + ": " + p.package + " (importregel " + p.line + ")")).join("<br>")}</p>` : ""}<p>Syntaxkleuren gebruiken Dark+/Light+ als basis, niet de volledige tokenkleuren van je actieve editorthema. Onopgeslagen wijzigingen verbergen deze uitleg tot opslaan. Statische imports bewijzen geen runtime-datastroom.</p><p>Lokale indexering en weergave: geen modelcalls of promptinjectie. Het verschil in volledig taakverbruik en RAM is niet gemeten.</p><p>Ontwerpgrondslag: <a href="https://doi.org/10.1207/S15326985EP3801_6">segmentering</a> · <a href="https://doi.org/10.1080/00220970209599510">voorbeelden geleidelijk aanvullen</a> · <a href="https://doi.org/10.3102/0034654307313795">bruikbare feedback</a>. Deze papers valideren deze plugin niet.</p><div class="evidence"><button data-rating="bad">Niet nuttig</button><button data-rating="good">Nuttig</button><button data-rating="incorrect">Klopt niet</button></div><p id="feedbackStatus" role="status"></p></details></div>`;
}
function render() {
  disposeGraph();
  const p = project(),
    n = node();
  $("#storyView").setAttribute("aria-pressed", view === "story");
  $("#mapView").setAttribute("aria-pressed", view === "map");
  $("#pin").setAttribute("aria-pressed", pinned);
  $("#pin").textContent = pinned ? "Vastgezet" : "Vastzetten";
  if (!p?.nodes?.length) {
    $("#content").innerHTML =
      '<section class="empty"><h1>Open een codeproject</h1><p>Learn kan opgeslagen Python-, JavaScript- en TypeScript-code lokaal bekijken. Open het project in dit VS Code-venster en vernieuw.</p></section>';
    return;
  }
  if (view === "map") {
    renderMap(p);
    return;
  }
  if (!n) {
    selected =
      p.focus?.find((f) => p.nodes.some((n) => n.path === f)) ||
      p.nodes[0].path;
    step = 0;
    render();
    return;
  }
  const l = lesson(n);
  $("#content").innerHTML =
    `<div class="heading"><h1>${esc(step === 3 ? l.title : l.titles[step])}</h1><p>${esc(step === 3 ? "Zo hangen de drie stappen van dit patroon samen." : l.captions[step])}</p></div><div class="stage">${diagram(n, l, step)}</div>${step < 3 ? sourceLines(n) : ""}<div class="navigation"><button class="previous" id="previous" ${step === 0 ? "disabled" : ""}>Terug</button><span class="quiet">${step === 3 ? "Overzicht" : step + 1 + " / 3"}</span><button class="next" id="next">${step === 3 ? "Opnieuw bekijken" : step === 2 ? "Hele plaatje" : "Verder"}</button></div><div class="secondary">${n.practice ? '<button id="practiceButton">Zelf een coderegel aanvullen</button>' : ""}</div><div id="practiceHost"></div>${context(n, l)}`;
  $("#previous").onclick = () => {
    step--;
    practiceOpen = false;
    render();
  };
  $("#next").onclick = () => {
    step = (step + 1) % 4;
    practiceOpen = false;
    render();
    post({ type: "engagement", action: "step" });
  };
  $("#practiceButton")?.addEventListener("click", () => {
    practiceOpen = !practiceOpen;
    if (practiceOpen) {
      pinned = true;
      $("#pin").setAttribute("aria-pressed", "true");
      $("#pin").textContent = "Vastgezet";
      renderPractice(n);
      persist();
      post({ type: "engagement", action: "practice" });
    } else $("#practiceHost").innerHTML = "";
  });
  bindSource();
  document.querySelectorAll("[data-rating]").forEach(
    (b) =>
      (b.onclick = () =>
        post({
          type: "feedback",
          project: p.id,
          path: n.path,
          rating: b.dataset.rating,
        })),
  );
}
function bindSource() {
  document.querySelectorAll("[data-open]").forEach(
    (b) =>
      (b.onclick = () =>
        post({
          type: "openCode",
          project: active,
          path: selected,
          line: Number(b.dataset.open),
        })),
  );
  document
    .querySelectorAll("[data-file]")
    .forEach((b) => (b.onclick = () => choose(b.dataset.file)));
}
function renderPractice(n) {
  const e = n.practice;
  const code = e.code
    .map((s) =>
      s.includes(e.expression) ? s.replace(e.expression, "____") : s,
    )
    .join("\n");
  $("#practiceHost").innerHTML =
    `<section class="practice"><h2>Wat moet deze functie teruggeven?</h2><p>Vul de expressie na <code>return</code> aan. Je werkt in een oefenkopie; het productbestand verandert niet.</p><div class="code"><div class="lines"><div class="line"><code>${highlight(code, n.path)}</code></div></div></div><p>Voorbeelden: ${e.cases
      .filter((_, i) =>
        [0, Math.floor(e.cases.length / 2), e.cases.length - 1].includes(i),
      )
      .map(
        (c) =>
          `${esc(e.function)}(${Object.values(c.arguments).join(", ")}) → ${esc(JSON.stringify(c.result))}`,
      )
      .join(
        " · ",
      )}</p><label for="answer">Python-expressie</label><input id="answer" maxlength="240" spellcheck="false" autocomplete="off" placeholder="Vul alleen de expressie in"><div class="actions"><button id="check">Controleren</button><button id="hint">Hint</button><button id="solution">Toon oplossing</button></div><p id="hintText"></p><div id="result" class="result" role="status" aria-live="polite"></div></section>`;
  let hints = 0;
  $("#hint").onclick = () => {
    hints++;
    $("#hintText").textContent =
      hints === 1
        ? "Gebruik de parameters " +
          e.parameters.join(" en ") +
          ". Vergelijk hoe de uitkomst verandert bij negatieve waarden, nul en positieve waarden."
        : "De bronexpressie begint met: " +
          e.expression.slice(
            0,
            Math.max(1, Math.ceil(e.expression.length / 2)),
          ) +
          "…";
  };
  const solution = () => {
    const c = exampleCase(e);
    return `<p>Bronoplossing:</p><pre>${highlight("return " + e.expression, n.path)}</pre><p>Vul ${Object.entries(
      c.arguments,
    )
      .map(([k, v]) => esc(k + " = " + v))
      .join(
        " en ",
      )} in:</p><pre>${esc(e.expression)} → ${esc(substitute(e.expression, c.arguments))} → ${esc(JSON.stringify(c.result))}</pre><p>Python evalueert de expressie en geeft die uitkomst terug. Andere expressies zijn toegestaan als ze dezelfde geteste uitkomsten geven.</p>`;
  };
  $("#solution").onclick = () => {
    $("#result").innerHTML = solution();
  };
  $("#check").onclick = () => {
    const id = ++request;
    $("#check").disabled = true;
    $("#result").textContent = "Lokaal controleren…";
    post({
      type: "practice",
      project: active,
      path: n.path,
      answer: $("#answer").value,
      request: id,
    });
    if (!api) {
      $("#check").disabled = false;
      $("#result").textContent =
        "De echte lokale controle werkt in VS Code. Deze browserpreview voert geen Python uit.";
    }
  };
  window.practiceSolution = solution;
  $("#answer").focus();
}
function renderMap(p) {
  disposeGraph();
  const matches = p.nodes.filter(
    (n) => !query || n.path.toLowerCase().includes(query.toLowerCase()),
  );
  const neighbours = new Set([
    selected,
    ...p.links
      .filter((l) => l.source === selected || l.target === selected)
      .flatMap((l) => [l.source, l.target]),
  ]);
  const shown = [
    ...matches.filter((n) => neighbours.has(n.path)),
    ...matches.filter((n) => !neighbours.has(n.path)),
  ].slice(0, limit);
  $("#content").innerHTML =
    `<div class="maptools"><input id="search" aria-label="Zoek een bestand" placeholder="Zoek een bestand in dit project" value="${esc(query)}"><button id="fit">Passend maken</button></div><div id="map" aria-label="Kaart van statische importrelaties"></div><div class="legend"><b style="color:var(--ui)">▢ UI</b><b style="color:var(--api)">⬡ API</b><b style="color:var(--logic)">◇ Logica</b><b style="color:var(--data)">▱ Data</b><span>→ importeert</span></div><p class="quiet">${shown.length} van ${matches.length} bestanden · scrol om te zoomen, sleep om te verplaatsen · klik voor uitleg</p>${shown.length < matches.length && limit < 120 ? '<button id="more">Meer bestanden tonen</button>' : ""}<p class="quiet">De kaart toont gevonden bronbestanden en imports, niet de volledige runtime-architectuur. Zoeken doorzoekt de hele index.</p><div class="files">${shown
      .slice(0, 8)
      .map((n) => `<button data-file="${esc(n.path)}">${esc(n.path)}</button>`)
      .join("")}</div>`;
  mapAdapter = LearnMap.mount($("#map"), {
    nodes: shown,
    links: p.links,
    selected,
    providers: node()?.providers || [],
    roles,
    textColor: getComputedStyle(document.body).color,
    onSelect: choose,
    onInteract: () => {
      pinned = true;
      $("#pin").setAttribute("aria-pressed", "true");
      persist();
    },
  });
  $("#fit").onclick = () => mapAdapter.fit();
  $("#search").oninput = (e) => {
    query = e.target.value;
    const at = e.target.selectionStart;
    renderMap(p);
    $("#search").focus();
    $("#search").setSelectionRange(at, at);
  };
  $("#more")?.addEventListener("click", () => {
    limit = Math.min(120, limit + 24);
    renderMap(p);
  });
  bindSource();
}
function snapshot(data) {
  const nextSignature = JSON.stringify([
    data.projects?.map((p) => [p.id, p.updated]),
    data.revision,
    data.focusPath,
    data.selectedProject,
  ]);
  if (nextSignature === signature) return;
  signature = nextSignature;
  projects = data.projects || [];
  if (data.selectedProject) active = data.selectedProject;
  if (!project()) active = projects[0]?.id;
  const p = project();
  const focus = p?.nodes?.some((n) => n.path === data.focusPath)
    ? data.focusPath
    : p?.focus?.find((f) => p.nodes.some((n) => n.path === f));
  if (!pinned && focus && focus !== selected) {
    selected = focus;
    step = 0;
  }
  if (!p?.nodes?.some((n) => n.path === selected)) {
    selected = focus || p?.nodes?.[0]?.path;
    step = 0;
  }
  $("#project").innerHTML = projects.length
    ? projects
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${p.id === active ? "selected" : ""}>${esc(p.name)}</option>`,
        )
        .join("")
    : "<option>Geen codeproject</option>";
  render();
  persist();
}
$("#storyView").onclick = () => setView("story");
$("#mapView").onclick = () => setView("map");
$("#pin").onclick = () => {
  pinned = !pinned;
  $("#pin").setAttribute("aria-pressed", pinned);
  $("#pin").textContent = pinned ? "Vastgezet" : "Vastzetten";
  persist();
  if (!pinned) {
    signature = "";
    post({ type: "ready" });
  }
};
$("#refresh").onclick = () => post({ type: "refresh" });
$("#project").onchange = (e) => {
  active = e.target.value;
  selected = null;
  step = 0;
  post({ type: "selectProject", project: active });
  if (preview) render();
};
window.addEventListener("message", (event) => {
  const m = event.data;
  if (m.type === "snapshot") snapshot(m);
  if (m.type === "invalidated") {
    disposeGraph();
    signature = "";
    practiceOpen = false;
    request++;
    window.practiceSolution = null;
    $("#content").innerHTML =
      `<section class="empty"><h1>De code wordt bijgewerkt</h1><p>${esc(m.text)}</p></section>`;
  }
  if (m.type === "notice") $("#notice").textContent = m.text;
  if (m.type === "feedbackSaved" && $("#feedbackStatus"))
    $("#feedbackStatus").textContent =
      "Lokaal opgeslagen. Dit is geen kennisscore.";
  if (m.type === "practiceResult" && m.request === request && $("#result")) {
    const r = m.result;
    $("#check").disabled = false;
    $("#result").classList.toggle("failed", !r.passed);
    $("#result").innerHTML =
      `<strong>${r.unavailable ? "Controle niet beschikbaar" : r.passed ? "Alle " + r.tested + " testgevallen geslaagd" : "Nog niet correct"}</strong>${r.case ? `<p>Bij ${esc(JSON.stringify(r.case.arguments))}: verwacht ${esc(JSON.stringify(r.case.result))}${"actual" in r ? ", jouw uitkomst " + esc(JSON.stringify(r.actual)) : ""}.</p>` : ""}${r.reason ? `<p>${esc(r.reason)}</p>` : ""}${window.practiceSolution?.() || ""}<p class="quiet">Dit zijn beperkte numerieke testgevallen, geen bewijs voor alle invoer of voor beheersing.</p>`;
  }
});
window.addEventListener("pagehide", disposeGraph);
if (preview) snapshot(preview);
else {
  render();
  post({ type: "ready" });
}
