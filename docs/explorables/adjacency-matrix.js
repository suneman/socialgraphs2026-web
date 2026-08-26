/* The adjacency matrix, live: type numbers into an 8×8 matrix and watch the
   corresponding directed, weighted network appear. Row sums and column sums
   are computed at the margins (out- and in-degree for 0/1 entries; strength
   for weights). A fully symmetric matrix drops the arrowheads: an undirected
   network IS a symmetric matrix. No dependencies beyond the shared tokens. */

"use strict";

// Pure matrix helpers, node-requirable for the verification protocol.
const AM = (() => {
  const N = 8;
  const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

  const zeros = () => Array.from({ length: N }, () => Array(N).fill(0));

  function rowSums(m) { return m.map((r) => r.reduce((a, b) => a + b, 0)); }
  function colSums(m) { return m[0].map((_, j) => m.reduce((a, r) => a + r[j], 0)); }

  function isSymmetric(m) {
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++)
        if (m[i][j] !== m[j][i]) return false;
    return true;
  }

  // directed edges [i, j, w] for every nonzero off-diagonal entry
  function edges(m) {
    const out = [];
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        if (i !== j && m[i][j] > 0) out.push([i, j, m[i][j]]);
    return out;
  }

  // unordered pairs [i, j, w] for a symmetric matrix (i < j)
  function pairs(m) {
    const out = [];
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++)
        if (m[i][j] > 0) out.push([i, j, m[i][j]]);
    return out;
  }

  function symmetrized(m) {
    const s = m.map((r) => r.slice());
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const w = Math.max(s[i][j], s[j][i]);
        s[i][j] = w; s[j][i] = w;
      }
    return s;
  }

  // The preset: one reciprocated pair (F↔G), one asymmetric pair (A→B heavy,
  // B→A light), a directed chain, and H isolated on purpose.
  function example() {
    const m = zeros();
    m[0][1] = 3; m[1][0] = 1;           // A→B 3, B→A 1
    m[0][2] = 1; m[2][3] = 2;           // A→C, C→D
    m[1][3] = 4; m[3][4] = 1; m[4][0] = 1; // B→D, D→E, E→A
    m[5][6] = 2; m[6][5] = 2;           // F↔G, reciprocated
    return m;
  }

  return { N, LABELS, zeros, rowSums, colSums, isSymmetric, edges, pairs, symmetrized, example };
})();
if (typeof module !== "undefined") module.exports = AM;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const N = AM.N, L = AM.LABELS;
  const SVGNS = "http://www.w3.org/2000/svg";

  let m = AM.example();
  let hl = null; // [i, j] of the focused cell, for highlighting

  // node positions: circle
  const CX = 210, CY = 190, R = 145;
  const pos = L.map((_, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
  });

  // ---------- matrix grid ----------
  const grid = $("matrix");
  const inputs = [];
  function buildGrid() {
    grid.appendChild(el("div", "hdr", ""));
    for (let j = 0; j < N; j++) grid.appendChild(el("div", "hdr", L[j]));
    grid.appendChild(el("div", "sumhdr", "row Σ"));
    for (let i = 0; i < N; i++) {
      grid.appendChild(el("div", "hdr", L[i]));
      inputs.push([]);
      for (let j = 0; j < N; j++) {
        if (i === j) { grid.appendChild(el("div", "diag", "·")); inputs[i].push(null); continue; }
        const inp = document.createElement("input");
        inp.className = "cell"; inp.placeholder = ""; inp.inputMode = "numeric"; inp.maxLength = 1;
        inp.setAttribute("aria-label", `edge ${L[i]} to ${L[j]}`);
        inp.addEventListener("input", () => {
          const d = inp.value.replace(/[^0-9]/g, "");
          inp.value = d === "0" ? "" : d;
          m[i][j] = inp.value ? +inp.value : 0;
          inp.classList.toggle("filled", m[i][j] > 0);
          draw();
        });
        inp.addEventListener("focus", () => { hl = [i, j]; drawNet(); });
        inp.addEventListener("blur", () => { hl = null; drawNet(); });
        grid.appendChild(inp);
        inputs[i].push(inp);
      }
      const s = el("div", "sum", ""); s.id = "rsum-" + i; grid.appendChild(s);
    }
    grid.appendChild(el("div", "sumhdr", "col Σ"));
    for (let j = 0; j < N; j++) { const s = el("div", "sum", ""); s.id = "csum-" + j; grid.appendChild(s); }
    grid.appendChild(el("div", "hdr", ""));
  }
  function el(tag, cls, txt) {
    const d = document.createElement(tag); d.className = cls; d.textContent = txt; return d;
  }
  function syncInputs() {
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        if (i !== j) {
          inputs[i][j].value = m[i][j] ? String(m[i][j]) : "";
          inputs[i][j].classList.toggle("filled", m[i][j] > 0);
        }
  }

  // ---------- network drawing ----------
  const svg = $("net");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function edgePath(i, j, bend) {
    const [x1, y1] = pos[i], [x2, y2] = pos[j];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    // trim to node radius so arrowheads sit on the rim
    const t0 = 20 / len, t1 = 1 - 22 / len;
    const ax = x1 + dx * t0, ay = y1 + dy * t0;
    const bx = x1 + dx * t1, by = y1 + dy * t1;
    if (!bend) return `M ${ax} ${ay} L ${bx} ${by}`;
    const mx = (ax + bx) / 2 + (-dy / len) * 16, my = (ay + by) / 2 + (dx / len) * 16;
    return `M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`;
  }

  function drawNet() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const defs = document.createElementNS(SVGNS, "defs");
    defs.innerHTML =
      '<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 1 L 9 5 L 0 9 z" class="edgehead"></path></marker>' +
      '<marker id="arr-hl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 1 L 9 5 L 0 9 z" style="fill: var(--accent)"></path></marker>';
    svg.appendChild(defs);

    const sym = AM.isSymmetric(m);
    const list = sym ? AM.pairs(m) : AM.edges(m);
    for (const [i, j, w] of list) {
      const p = document.createElementNS(SVGNS, "path");
      const both = !sym && m[j][i] > 0; // reciprocated → bend the two arcs apart
      p.setAttribute("d", edgePath(i, j, both));
      const isHl = hl && hl[0] === i && hl[1] === j && !sym;
      const symHl = hl && sym && ((hl[0] === i && hl[1] === j) || (hl[0] === j && hl[1] === i));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", isHl || symHl ? css("--accent") : css("--series-1"));
      p.setAttribute("stroke-width", String(1 + w * 0.55));
      p.setAttribute("stroke-linecap", "round");
      if (!sym) p.setAttribute("marker-end", isHl ? "url(#arr-hl)" : "url(#arr)");
      p.setAttribute("opacity", hl && !(isHl || symHl) ? "0.35" : "0.9");
      svg.appendChild(p);
    }

    for (let i = 0; i < N; i++) {
      const [x, y] = pos[i];
      const g = document.createElementNS(SVGNS, "g");
      const active = hl && (hl[0] === i || hl[1] === i);
      const deg = AM.rowSums(m)[i] + AM.colSums(m)[i];
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", "16");
      c.setAttribute("fill", css("--surface-1"));
      c.setAttribute("stroke", active ? css("--accent") : deg > 0 ? css("--baseline") : css("--grid"));
      c.setAttribute("stroke-width", active ? "2.5" : "1.5");
      if (deg === 0 && !active) c.setAttribute("stroke-dasharray", "3 3");
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y + 4.5); t.setAttribute("text-anchor", "middle");
      t.setAttribute("style", `font-size: 13px; font-weight: 600; fill: ${active ? css("--accent") : deg > 0 ? css("--text-primary") : css("--text-muted")}`);
      t.textContent = L[i];
      g.appendChild(c); g.appendChild(t);
      svg.appendChild(g);
    }
  }

  function draw() {
    drawNet();
    const rs = AM.rowSums(m), cs = AM.colSums(m);
    for (let i = 0; i < N; i++) $("rsum-" + i).innerHTML = rs[i] ? "<strong>" + rs[i] + "</strong>" : "0";
    for (let j = 0; j < N; j++) $("csum-" + j).innerHTML = cs[j] ? "<strong>" + cs[j] + "</strong>" : "0";
    const sym = AM.isSymmetric(m);
    const ne = AM.edges(m).length;
    $("r-edges").textContent = ne;
    $("r-sym").textContent = ne === 0 ? "–" : sym ? "yes" : "no";
    $("r-kind").textContent = ne === 0 ? "empty" : sym ? "undirected" : "directed";
  }

  $("b-clear").addEventListener("click", () => { m = AM.zeros(); syncInputs(); draw(); });
  $("b-example").addEventListener("click", () => { m = AM.example(); syncInputs(); draw(); });
  $("b-symmetrize").addEventListener("click", () => { m = AM.symmetrized(m); syncInputs(); draw(); });

  buildGrid();
  syncInputs();
  draw();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
})();
