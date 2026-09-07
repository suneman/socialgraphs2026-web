/* The modularity landscape of Zachary's karate club. Thirty-four members,
   seventy-eight friendships, and a partition you can edit by clicking: every
   click moves one member to the next group and Q recomputes on the spot. The
   presets are the partitions the page talks about — the real 1977 split, the
   best two-way split modularity can find, one Louvain run (networkx, seed 0),
   a shuffled version of whatever you are looking at, and everything in one
   group. The right panel keeps every state you visit, so the walk through
   partition space draws itself. Q is CM.modularity (community.js) on the 78
   UNWEIGHTED friendships, the same code the other week-4 explorables use,
   verified against networkx modularity(weight=None). (networkx's
   karate_club_graph carries Zachary's interaction weights, and its
   modularity / louvain_communities use them by default: the weighted Q of
   the real split is 0.391, the unweighted one shown here is 0.358.) */

"use strict";

if (typeof module !== "undefined" && typeof CM === "undefined") global.CM = require("./community.js");

/* --- pure data + computation, node-requirable for the verification protocol --- */
const ML = (() => {
  const N = 34;
  // networkx.karate_club_graph(), nodes 0..33
  const EDGES = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 10], [0, 11], [0, 12], [0, 13], [0, 17], [0, 19], [0, 21], [0, 31], [1, 2], [1, 3], [1, 7], [1, 13], [1, 17], [1, 19], [1, 21], [1, 30], [2, 3], [2, 7], [2, 8], [2, 9], [2, 13], [2, 27], [2, 28], [2, 32], [3, 7], [3, 12], [3, 13], [4, 6], [4, 10], [5, 6], [5, 10], [5, 16], [6, 16], [8, 30], [8, 32], [8, 33], [9, 33], [13, 33], [14, 32], [14, 33], [15, 32], [15, 33], [18, 32], [18, 33], [19, 33], [20, 32], [20, 33], [22, 32], [22, 33], [23, 25], [23, 27], [23, 29], [23, 32], [23, 33], [24, 25], [24, 27], [24, 31], [25, 31], [26, 29], [26, 33], [27, 33], [28, 31], [28, 33], [29, 32], [29, 33], [30, 32], [30, 33], [31, 32], [31, 33], [32, 33]];
  // the "club" attribute after the split: 0 = Mr. Hi (the instructor), 1 = Officer (the president)
  const CLUB = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const PRESETS = {
    real: CLUB.slice(),
    // greedy_modularity_communities(K, weight=None, best_n=2): differs from the real split on members 8 and 9
    best2: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    // louvain_communities(K, weight=None, seed=0): four groups, Q = 0.420
    louvain: [0, 0, 0, 0, 1, 1, 1, 0, 2, 2, 1, 0, 0, 0, 2, 2, 1, 0, 2, 0, 2, 0, 2, 3, 3, 3, 2, 3, 3, 2, 2, 3, 2, 2],
    one: new Array(N).fill(0),
  };
  // spring layout (networkx seed 3), rotated so the two factions separate left → right
  const POS = [[0.355, 0.503], [0.45, 0.491], [0.535, 0.54], [0.405, 0.755], [0.189, 0.523], [0.121, 0.613], [0.147, 0.716], [0.414, 0.632], [0.618, 0.575], [0.669, 0.138], [0.123, 0.427], [0.196, 0.237], [0.302, 1.0], [0.519, 0.646], [0.816, 0.97], [0.895, 0.676], [0.0, 0.765], [0.277, 0.121], [0.997, 0.689], [0.494, 0.27], [0.939, 0.908], [0.345, 0.195], [0.869, 0.862], [0.838, 0.388], [0.786, 0.0], [0.793, 0.196], [1.0, 0.387], [0.745, 0.294], [0.663, 0.784], [0.921, 0.475], [0.664, 0.648], [0.689, 0.391], [0.794, 0.643], [0.768, 0.563]];

  const M = EDGES.length;
  const DEG = new Array(N).fill(0);
  for (const [a, b] of EDGES) { DEG[a]++; DEG[b]++; }

  const modularity = (comm) => CM.modularity(N, EDGES, comm);

  // the pieces of Q: links inside groups, and what the configuration model expects inside
  function parts(comm) {
    let inside = 0;
    for (const [a, b] of EDGES) if (comm[a] === comm[b]) inside++;
    const tot = new Map();
    for (let i = 0; i < N; i++) tot.set(comm[i], (tot.get(comm[i]) || 0) + DEG[i]);
    let expected = 0;
    for (const t of tot.values()) expected += Math.pow(t / (2 * M), 2) * M;
    return { inside, expected, groups: tot.size };
  }

  // agreement with the real split when exactly two groups are in use (best of the two mappings)
  function agreement(comm) {
    const ids = [...new Set(comm)];
    if (ids.length !== 2) return null;
    let a = 0;
    for (let i = 0; i < N; i++) if ((comm[i] === ids[0]) === (CLUB[i] === 0)) a++;
    return Math.max(a, N - a);
  }

  return { N, M, EDGES, CLUB, PRESETS, POS, DEG, modularity, parts, agreement };
})();
if (typeof module !== "undefined") module.exports = ML;

/* --- the explorable --- */
if (typeof document !== "undefined") (function () {
  const $ = (id) => document.getElementById(id);
  const { N, M, EDGES, POS } = ML;
  const svg = d3.select("#net"), chartNode = $("chart");
  const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const PAD = { top: 18, right: 20, bottom: 18, left: 20 };
  const R = 11, GROUPS = 4;

  let comm = ML.PRESETS.real.slice();
  let history = []; // Q of every state visited
  let seed = 7;

  const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const catColor = (g) => VK.cssVar(`--cat-${g + 1}`);

  function drawNet() {
    const node = svg.node();
    const W = node.clientWidth || 390, H = node.clientHeight || 340;
    const iw = W - PAD.left - PAD.right, ih = H - PAD.top - PAD.bottom;
    const pos = POS.map(([fx, fy]) => [PAD.left + fx * iw, PAD.top + fy * ih]);
    svg.selectAll("*").remove();
    const baseline = VK.cssVar("--baseline"), surface = VK.cssVar("--surface-1");
    const sec = VK.cssVar("--text-secondary");

    // links: inside a group in that group's color, across groups gray
    const eg = svg.append("g");
    for (const [a, b] of EDGES) {
      const same = comm[a] === comm[b];
      eg.append("line").attr("x1", pos[a][0]).attr("y1", pos[a][1]).attr("x2", pos[b][0]).attr("y2", pos[b][1])
        .attr("stroke", same ? catColor(comm[a]) : baseline)
        .attr("stroke-opacity", same ? 0.55 : 0.9)
        .attr("stroke-width", same ? 1.8 : 1.2);
    }

    // nodes: fill = group color, number inside, tiny group badge top-right
    for (let i = 0; i < N; i++) {
      const [x, y] = pos[i];
      const g = svg.append("g").attr("transform", `translate(${x},${y})`).style("cursor", "pointer")
        .on("click", () => move(i));
      g.append("title").text(`Member ${i} · group ${comm[i] + 1} · ${ML.DEG[i]} friends. Click to move to group ${((comm[i] + 1) % GROUPS) + 1}.`);
      g.append("circle").attr("r", R).attr("fill", catColor(comm[i])).attr("stroke", surface).attr("stroke-width", 1.5);
      g.append("text").attr("text-anchor", "middle").attr("dy", 4).attr("font-size", 11.5).attr("font-weight", 600)
        .attr("font-family", FONT).attr("fill", "#fff").style("pointer-events", "none").text(i);
      // the group badge: identity is never color-alone
      g.append("circle").attr("cx", R - 2).attr("cy", -R + 2).attr("r", 5.5).attr("fill", surface).attr("stroke", sec).attr("stroke-width", 1);
      g.append("text").attr("x", R - 2).attr("y", -R + 5).attr("text-anchor", "middle").attr("font-size", 8).attr("font-weight", 700)
        .attr("font-family", FONT).attr("fill", sec).style("pointer-events", "none").text(comm[i] + 1);
    }
  }

  function drawLegend() {
    const counts = new Array(GROUPS).fill(0);
    for (const c of comm) counts[c]++;
    const items = [];
    for (let g = 0; g < GROUPS; g++) {
      if (!counts[g]) continue;
      items.push(`<span class="key"><span class="swatch dot" style="background: var(--cat-${g + 1})"></span>Group ${g + 1} (${counts[g]} member${counts[g] === 1 ? "" : "s"})</span>`);
    }
    $("legend").innerHTML = items.join("");
  }

  function drawChart() {
    const c = VK.chart(chartNode, { margin: { top: 12, right: 18, bottom: 36, left: 44 } });
    const { s1 } = VK.colors();
    const n = history.length;
    const xmax = Math.max(8, n);
    const x = d3.scaleLinear().domain([1, xmax]).range([0, c.w]);
    const y = d3.scaleLinear().domain([-0.05, 0.5]).range([c.h, 0]);
    const stepX = Math.ceil(xmax / 8);
    const xt = d3.range(1, xmax + 1).filter((v) => v === 1 || v % stepX === 0);
    VK.axes(c, x, y, { xTicks: xt, yTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yFormat: (v) => v.toFixed(1), xTitle: "state visited", yTitle: "modularity Q" });

    // zero line and the two landmarks
    c.plot.append("line").attr("class", "axisline").attr("x1", 0).attr("x2", c.w).attr("y1", y(0)).attr("y2", y(0));
    const LANDMARKS = [[0.358235, "Zachary's split 0.358", 13], [0.419790, "Louvain 0.420", -6]];
    for (const [q] of LANDMARKS)
      c.plot.append("line").attr("x1", 0).attr("x2", c.w).attr("y1", y(q)).attr("y2", y(q))
        .attr("stroke", VK.cssVar("--text-muted")).attr("stroke-width", 1).attr("stroke-dasharray", "4 4").attr("stroke-opacity", 0.8);

    const pts = history.map((q, i) => [i + 1, q]);
    if (pts.length > 1) VK.line(c, pts, x, y, s1);
    pts.forEach(([i, q], idx) => VK.marker(c, x(i), y(q), s1, idx === pts.length - 1 ? 5.5 : 4));

    // landmark labels last, with a surface halo, so they stay legible over the series
    for (const [q, label, dy] of LANDMARKS)
      VK.directLabel(c, c.w, y(q) + dy, label, "end")
        .attr("stroke", VK.cssVar("--surface-1")).attr("stroke-width", 3.5).attr("paint-order", "stroke");
  }

  function readout() {
    const q = ML.modularity(comm);
    const { inside, expected, groups } = ML.parts(comm);
    const agree = ML.agreement(comm);
    $("r-q").textContent = q.toFixed(3);
    $("r-qsub").textContent = `= (${inside} − ${expected.toFixed(1)}) / ${M}`;
    $("r-in").textContent = `${inside} of ${M}`;
    $("r-exp").textContent = expected.toFixed(1);
    $("r-k").textContent = String(groups);
    $("r-agree").textContent = agree === null ? "–" : `${agree} of ${N}`;
    return q;
  }

  function render(record = true) {
    if (record) history.push(ML.modularity(comm));
    drawLegend();
    drawNet();
    drawChart();
    readout();
  }

  function move(i) {
    comm[i] = (comm[i] + 1) % GROUPS;
    setPresetButton(null);
    render();
  }

  function setPresetButton(name) {
    document.querySelectorAll("#presets button").forEach((b) => b.classList.toggle("on", b.dataset.p === name));
  }

  function applyPreset(name) {
    if (name === "shuffle") {
      // permute the current labels among the members: same group sizes, random membership
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [comm[i], comm[j]] = [comm[j], comm[i]]; }
    } else {
      comm = ML.PRESETS[name].slice();
    }
    setPresetButton(name);
    render();
  }

  document.querySelectorAll("#presets button").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.p)));
  $("reset").addEventListener("click", () => { history = []; seed = 7; comm = ML.PRESETS.real.slice(); setPresetButton("real"); render(); });
  window.addEventListener("resize", () => render(false));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render(false));
  render();
})();
