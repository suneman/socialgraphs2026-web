/* The anatomy of centrality on Krackhardt's kite. Ten nodes, A–J, the
   textbook example where four measures crown three different nodes:
   degree → D, closeness → F and G, betweenness → H, eigenvector → D.
   Pick a measure and the nodes resize to it; the winner wears the accent
   ring. Click a node to remove it (it becomes a dashed ghost, out of every
   computation) and watch the ranking reshuffle — take H out and the tail
   falls off, take D out and the diamond loses its hub. Every number follows
   networkx's definitions exactly (closeness with the Wasserman–Faust
   correction for disconnected graphs, betweenness by Brandes's algorithm
   scaled 1/((n−1)(n−2)), eigenvector by (I + A) power iteration with L2
   normalization) so the page and the notebook never disagree. */

"use strict";

/* --- pure computation, node-requirable for the verification protocol --- */
const CA = (() => {
  const NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  // networkx.krackhardt_kite_graph(), nodes 0..9 = A..J
  const EDGES = [[0, 1], [0, 2], [0, 3], [0, 5], [1, 3], [1, 4], [1, 6], [2, 3], [2, 5],
    [3, 4], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 7], [7, 8], [8, 9]];

  // adjacency restricted to the present nodes
  function adjacency(present) {
    const adj = NAMES.map(() => []);
    for (const [a, b] of EDGES) if (present[a] && present[b]) { adj[a].push(b); adj[b].push(a); }
    return adj;
  }

  function bfs(adj, present, s) {
    const dist = new Array(adj.length).fill(-1);
    if (!present[s]) return dist;
    dist[s] = 0;
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
      const v = q[qi];
      for (const w of adj[v]) if (dist[w] === -1) { dist[w] = dist[v] + 1; q.push(w); }
    }
    return dist;
  }

  function degree(present) {
    const adj = adjacency(present);
    return NAMES.map((_, i) => (present[i] ? adj[i].length : null));
  }

  // networkx closeness_centrality(wf_improved=True)
  function closeness(present) {
    const adj = adjacency(present), n = present.filter(Boolean).length;
    return NAMES.map((_, u) => {
      if (!present[u]) return null;
      const d = bfs(adj, present, u);
      let r = 0, tot = 0;
      for (let v = 0; v < d.length; v++) if (d[v] >= 0) { r++; tot += d[v]; }
      if (tot <= 0 || n <= 1) return 0;
      return ((r - 1) / tot) * ((r - 1) / (n - 1));
    });
  }

  // networkx betweenness_centrality(normalized=True), undirected: Brandes, scale 1/((n−1)(n−2))
  function betweenness(present) {
    const adj = adjacency(present), N = NAMES.length, n = present.filter(Boolean).length;
    const bc = new Array(N).fill(0);
    for (let s = 0; s < N; s++) {
      if (!present[s]) continue;
      const stack = [], pred = Array.from({ length: N }, () => []);
      const sigma = new Array(N).fill(0), dist = new Array(N).fill(-1);
      sigma[s] = 1; dist[s] = 0;
      const q = [s];
      for (let qi = 0; qi < q.length; qi++) {
        const v = q[qi]; stack.push(v);
        for (const w of adj[v]) {
          if (dist[w] < 0) { dist[w] = dist[v] + 1; q.push(w); }
          if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
        }
      }
      const delta = new Array(N).fill(0);
      while (stack.length) {
        const w = stack.pop();
        for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s) bc[w] += delta[w];
      }
    }
    const scale = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;
    return NAMES.map((_, i) => (present[i] ? bc[i] * scale : null));
  }

  // networkx eigenvector_centrality: x ← x + A x, L2-normalized, until Σ|Δ| < n·1e-6
  function eigenvector(present, maxIter = 1000) {
    const adj = adjacency(present), N = NAMES.length, n = present.filter(Boolean).length;
    if (n === 0) return NAMES.map(() => null);
    let x = NAMES.map((_, i) => (present[i] ? 1 / n : 0));
    for (let it = 0; it < maxIter; it++) {
      const last = x.slice();
      x = last.slice();
      for (let v = 0; v < N; v++) for (const w of adj[v]) x[w] += last[v];
      const norm = Math.sqrt(x.reduce((s, v) => s + v * v, 0)) || 1;
      x = x.map((v) => v / norm);
      let diff = 0;
      for (let i = 0; i < N; i++) diff += Math.abs(x[i] - last[i]);
      if (diff < n * 1e-6) return NAMES.map((_, i) => (present[i] ? x[i] : null));
    }
    return NAMES.map((_, i) => (present[i] ? NaN : null)); // did not converge → shown as "–"
  }

  const MEASURES = { degree, closeness, betweenness, eigenvector };

  // winners: indices holding the maximum (ties within 1e-9), or [] if nothing computable
  function winners(values) {
    const ok = values.map((v, i) => [v, i]).filter(([v]) => v !== null && !Number.isNaN(v));
    if (!ok.length) return [];
    const max = Math.max(...ok.map(([v]) => v));
    return ok.filter(([v]) => Math.abs(v - max) < 1e-9).map(([, i]) => i);
  }

  return { NAMES, EDGES, adjacency, bfs, degree, closeness, betweenness, eigenvector, MEASURES, winners };
})();
if (typeof module !== "undefined") module.exports = CA;

/* --- the explorable --- */
if (typeof document !== "undefined") (function () {
  const $ = (id) => document.getElementById(id);
  const { NAMES, EDGES } = CA;
  const svg = d3.select("#net"), chartNode = $("chart");
  const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  // the classic kite drawing, as fractions of the inner box: the diamond with
  // D in the middle, F and G below, H below them, the tail I, J trailing off
  // to the bottom right. dir = where the value label goes (free of edges).
  const POS = [
    [0.30, 0.04, "up"], [0.70, 0.04, "up"],
    [0.16, 0.28, "left"], [0.50, 0.28, "up"], [0.84, 0.28, "right"],
    [0.30, 0.52, "left"], [0.70, 0.52, "right"],
    [0.50, 0.70, "left"],
    [0.64, 0.85, "left"],
    [0.78, 1.00, "right"],
  ];
  const PAD = { top: 46, right: 44, bottom: 28, left: 44 };
  const R_MIN = 11, R_MAX = 22;
  const LABELS = { degree: "Degree", closeness: "Closeness", betweenness: "Betweenness", eigenvector: "Eigenvector" };

  let measure = "degree";
  let present = NAMES.map(() => true);

  const fmt = (m, v) => (v === null ? "–" : Number.isNaN(v) ? "–" : m === "degree" ? `${v}` : v.toFixed(2));

  function all() {
    const out = {};
    for (const m of Object.keys(CA.MEASURES)) { out[m] = CA.MEASURES[m](present); }
    return out;
  }

  function drawNet(values, win) {
    const node = svg.node();
    const W = node.clientWidth || 390, H = node.clientHeight || 360;
    const iw = W - PAD.left - PAD.right, ih = H - PAD.top - PAD.bottom;
    const pos = POS.map(([fx, fy]) => [PAD.left + fx * iw, PAD.top + fy * ih]);
    svg.selectAll("*").remove();
    const accent = VK.cssVar("--accent"), s1 = VK.cssVar("--series-1"), muted = VK.cssVar("--text-muted");
    const surface = VK.cssVar("--surface-1"), ink = VK.cssVar("--text-primary"), sec = VK.cssVar("--text-secondary");
    const baseline = VK.cssVar("--baseline");
    const winSet = new Set(win);
    const vmax = Math.max(1e-12, ...values.filter((v) => v !== null && !Number.isNaN(v)));
    const radius = (i) => {
      const v = values[i];
      if (v === null || Number.isNaN(v)) return R_MIN;
      return R_MIN + (R_MAX - R_MIN) * Math.max(0, v / vmax);
    };

    // edges among present nodes
    const eg = svg.append("g");
    for (const [a, b] of EDGES) {
      if (!present[a] || !present[b]) continue;
      eg.append("line").attr("x1", pos[a][0]).attr("y1", pos[a][1]).attr("x2", pos[b][0]).attr("y2", pos[b][1])
        .attr("stroke", baseline).attr("stroke-width", 1.5);
    }

    // nodes
    for (let i = 0; i < NAMES.length; i++) {
      const [x, y] = pos[i], on = present[i], r = on ? radius(i) : R_MIN;
      const g = svg.append("g").attr("transform", `translate(${x},${y})`).style("cursor", "pointer")
        .on("click", () => { present[i] = !present[i]; render(); });
      g.append("title").text(on ? `Remove ${NAMES[i]}` : `Put ${NAMES[i]} back`);
      if (winSet.has(i) && on)
        g.append("circle").attr("r", r + 4).attr("fill", "none").attr("stroke", accent).attr("stroke-width", 2.5);
      g.append("circle").attr("r", r)
        .attr("fill", on ? s1 : surface)
        .attr("stroke", on ? surface : muted).attr("stroke-width", on ? 1.5 : 1.2)
        .attr("stroke-dasharray", on ? null : "3 3");
      g.append("text").attr("text-anchor", "middle").attr("dy", 4.5)
        .attr("font-size", 13).attr("font-weight", 600).attr("font-family", FONT)
        .attr("fill", on ? "#fff" : muted).style("pointer-events", "none").text(NAMES[i]);
      if (!on) continue;
      // value label, in the node's free direction; the winner's says "top"
      const dir = POS[i][2], off = r + 7, isWin = winSet.has(i);
      const text = (isWin ? "top · " : "") + fmt(measure, values[i]);
      const t = g.append("text").attr("font-size", 12).attr("font-family", FONT)
        .attr("font-weight", isWin ? 700 : 500).attr("fill", isWin ? accent : sec)
        .style("pointer-events", "none").text(text);
      if (dir === "up") t.attr("text-anchor", "middle").attr("x", 0).attr("y", -off - 3);
      else if (dir === "left") t.attr("text-anchor", "end").attr("x", -off).attr("y", 4.5);
      else t.attr("text-anchor", "start").attr("x", off).attr("y", 4.5);
    }
    void ink;
  }

  function drawChart(values, win) {
    const rows = NAMES.map((nm, i) => ({ nm, i, v: values[i] }))
      .filter((d) => d.v !== null)
      .sort((a, b) => (Number.isNaN(b.v) ? -1 : Number.isNaN(a.v) ? 1 : b.v - a.v || a.i - b.i));
    const c = VK.chart(chartNode, { margin: { top: 8, right: 54, bottom: 30, left: 30 } });
    const s1 = VK.cssVar("--series-1");
    const winSet = new Set(win);
    const vmax = Math.max(1e-12, ...rows.map((d) => (Number.isNaN(d.v) ? 0 : d.v)));
    const x = d3.scaleLinear().domain([0, vmax]).range([0, c.w]).nice();
    const y = d3.scaleBand().domain(rows.map((d) => d.nm)).range([0, c.h]).paddingInner(0.28).paddingOuter(0.1);
    const xt = x.ticks(4);
    const fx = measure === "degree" ? d3.format("d") : d3.format(".2f");

    c.plot.selectAll(".gridline").data(xt).join("line").attr("class", "gridline")
      .attr("x1", (d) => x(d)).attr("x2", (d) => x(d)).attr("y1", 0).attr("y2", c.h);
    c.plot.append("line").attr("class", "axisline").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", c.h);
    c.plot.selectAll(".xtick").data(xt).join("text").attr("class", "ticktext")
      .attr("x", (d) => x(d)).attr("y", c.h + 16).attr("text-anchor", "middle").text(fx);
    c.plot.append("text").attr("class", "axistitle").attr("x", c.w / 2).attr("y", c.h + 30)
      .attr("text-anchor", "middle").text(LABELS[measure].toLowerCase() + (measure === "degree" ? "" : " centrality"));

    const bar = c.plot.selectAll(".bar").data(rows).join("g").attr("class", "bar");
    bar.append("text").attr("class", "ticktext")
      .attr("x", -8).attr("y", (d) => y(d.nm) + y.bandwidth() / 2 + 4).attr("text-anchor", "end")
      .attr("font-weight", (d) => (winSet.has(d.i) ? 700 : 400)).text((d) => d.nm);
    bar.append("rect").attr("x", 0).attr("y", (d) => y(d.nm))
      .attr("width", (d) => (Number.isNaN(d.v) ? 0 : Math.max(0, x(d.v))))
      .attr("height", y.bandwidth()).attr("rx", 2).attr("fill", s1);
    bar.append("text").attr("class", "directlabel")
      .attr("x", (d) => (Number.isNaN(d.v) ? 0 : x(d.v)) + 6).attr("y", (d) => y(d.nm) + y.bandwidth() / 2 + 4)
      .attr("font-weight", (d) => (winSet.has(d.i) ? 700 : 600))
      .text((d) => fmt(measure, d.v));
  }

  function render() {
    const vals = all();
    const win = CA.winners(vals[measure]);
    drawNet(vals[measure], win);
    drawChart(vals[measure], win);
    for (const m of Object.keys(CA.MEASURES)) {
      const w = CA.winners(vals[m]);
      $(`r-${m}`).textContent = w.length ? `${w.map((i) => NAMES[i]).join(", ")} · ${fmt(m, vals[m][w[0]])}` : "–";
    }
    const gone = NAMES.filter((_, i) => !present[i]);
    $("r-removed").textContent = gone.length ? gone.join(", ") : "none";
    document.querySelectorAll("#measure button").forEach((b) => b.classList.toggle("on", b.dataset.m === measure));
  }

  document.querySelectorAll("#measure button").forEach((b) =>
    b.addEventListener("click", () => { measure = b.dataset.m; render(); }));
  $("reset").addEventListener("click", () => { present = NAMES.map(() => true); render(); });
  window.addEventListener("resize", render);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  render();
})();
