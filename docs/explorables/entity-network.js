"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const nodes = {
    "Nova Reed": { type: "person", x: 130, y: 105 },
    "Elias Hart": { type: "person", x: 130, y: 285 },
    "Maya Chen": { type: "person", x: 55, y: 205 },
    "Aurora Records": { type: "org", x: 350, y: 105 },
    "Signal Magazine": { type: "org", x: 350, y: 285 },
    "North Sea Festival": { type: "org", x: 455, y: 205 },
    "Copenhagen": { type: "place", x: 250, y: 200 }
  };
  const docs = [
    { text: "Nova Reed signed with Aurora Records in Copenhagen.", ents: ["Nova Reed", "Aurora Records", "Copenhagen"] },
    { text: "Nova Reed collaborated with Elias Hart at North Sea Festival.", ents: ["Nova Reed", "Elias Hart", "North Sea Festival"] },
    { text: "Aurora Records booked Elias Hart for a show in Copenhagen.", ents: ["Aurora Records", "Elias Hart", "Copenhagen"] },
    { text: "Maya Chen interviewed Nova Reed for Signal Magazine.", ents: ["Maya Chen", "Nova Reed", "Signal Magazine"] },
    { text: "Signal Magazine reviewed an Aurora Records release.", ents: ["Signal Magazine", "Aurora Records"] }
  ];
  let selected = docs.map(() => true);

  function edgeKey(a, b) { return [a, b].sort().join("||| "); }

  function renderDocs() {
    $("docs").innerHTML = docs.map((d, i) => `<label class="doc-check"><input type="checkbox" data-i="${i}" ${selected[i] ? "checked" : ""}><span>${d.text}</span></label>`).join("");
    document.querySelectorAll("#docs input").forEach((input) => {
      input.addEventListener("change", () => {
        selected[+input.dataset.i] = input.checked;
        renderNetwork();
      });
    });
  }

  function renderNetwork() {
    const edges = new Map();
    const active = new Set();
    docs.forEach((d, i) => {
      if (!selected[i]) return;
      d.ents.forEach((e) => active.add(e));
      for (let a = 0; a < d.ents.length; a++) {
        for (let b = a + 1; b < d.ents.length; b++) {
          const key = edgeKey(d.ents[a], d.ents[b]);
          if (!edges.has(key)) edges.set(key, { a: d.ents[a], b: d.ents[b], n: 0 });
          edges.get(key).n += 1;
        }
      }
    });

    const edgeSvg = Array.from(edges.values()).map((e) => {
      const a = nodes[e.a], b = nodes[e.b];
      return `<line class="entity-edge ${e.n > 1 ? "strong" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><title>${e.a} ↔ ${e.b}: ${e.n} snippet${e.n === 1 ? "" : "s"}</title></line>`;
    }).join("");

    const nodeSvg = Object.entries(nodes).map(([name, n]) => {
      const opacity = active.has(name) ? 1 : 0.18;
      const lines = name.split(" ");
      const label = lines.length > 2
        ? `<text class="entity-label" x="${n.x}" y="${n.y + 29}" text-anchor="middle"><tspan x="${n.x}" dy="0">${lines.slice(0, 2).join(" ")}</tspan><tspan x="${n.x}" dy="13">${lines.slice(2).join(" ")}</tspan></text>`
        : `<text class="entity-label" x="${n.x}" y="${n.y + 29}" text-anchor="middle">${name}</text>`;
      return `<g opacity="${opacity}"><circle class="entity-node ${n.type}" cx="${n.x}" cy="${n.y}" r="12"></circle>${label}</g>`;
    }).join("");

    $("network").innerHTML = edgeSvg + nodeSvg;
  }

  renderDocs();
  renderNetwork();
})();
