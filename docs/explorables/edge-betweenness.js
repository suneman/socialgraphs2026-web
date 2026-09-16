/* Girvan–Newman, one cut at a time (week 4 v2, 2026-09-15). A 100-node LFR
   benchmark graph with three planted communities (Lancichinetti, Fortunato &
   Radicchi 2008; frozen by tools/groundtruth/week4_lfr.py — the staged TSVs, not
   the generator seed, are the source of truth): 298 links, groups of 28 / 32 / 40,
   27 links between groups. Every link is drawn as thick as its current edge
   betweenness (the number of shortest paths that run along it); the thickest one
   is violet and goes next. Step removes it and RECOMPUTES every value. When a cut
   splits a group, the dendrogram on the right grows a branch, and the strip under
   it records the modularity of the groups at that moment, with the best level
   marked — which is how Newman & Girvan (2004) chose where to cut.

   The whole sequence (298 cuts) is computed once at load: Brandes' algorithm,
   unnormalized like networkx's edge_betweenness_centrality(normalized=False),
   ties broken toward the smallest (u, v) pair after rounding to 1e-9 — the rule
   week4_lfr.py uses, so the cut order is networkx-exact (verified 2026-09-15: all
   298 cuts, their values, the group counts and every Q). Q is CM.modularity on the
   original 298 links. Beats the page's caption points at: the first cut is
   (70, 91) at 286.4; cuts 1–27 are exactly the 27 links between planted groups;
   the values of the remaining bridges climb as they thin out; cut 15 is the last
   link between a 68-node and a 32-node group and carries 68 × 32 = 2,176 paths;
   after that split the recomputed values drop; cut 27 (40 × 28 = 1,120) gives
   the planted three groups, Q = 0.571, the best level of the whole dendrogram. */

"use strict";

if (typeof module !== "undefined" && typeof CM === "undefined") global.CM = require("./community.js");

/* --- pure data + computation, node-requirable for the verification protocol --- */
const EB = (() => {
  const N = 100;
  const EDGES = [
    [0,3], [0,12], [0,13], [0,43], [0,50], [0,53], [0,55], [0,61], [0,71], [1,3], [1,14], [1,57], [1,78], [1,80], [1,85], [1,97],
    [1,98], [2,21], [2,30], [2,39], [2,51], [2,74], [2,99], [3,17], [3,73], [3,91], [3,97], [4,15], [4,30], [4,33], [4,40], [4,82],
    [4,92], [5,15], [5,30], [5,56], [5,76], [5,89], [6,7], [6,18], [6,29], [6,49], [6,67], [6,96], [7,9], [7,20], [7,64], [7,94],
    [8,16], [8,19], [8,42], [8,51], [9,18], [9,20], [10,32], [10,37], [10,45], [10,46], [10,49], [10,58], [10,59], [10,69], [10,75], [10,77],
    [10,95], [11,13], [11,43], [11,53], [11,73], [12,57], [12,73], [12,80], [12,88], [13,17], [13,25], [13,53], [13,57], [13,62], [13,63], [13,66],
    [13,71], [14,49], [14,52], [14,72], [15,27], [15,38], [15,42], [15,84], [16,32], [16,39], [16,66], [16,76], [16,92], [17,23], [17,42], [17,66],
    [17,97], [17,98], [18,23], [18,49], [18,54], [19,42], [19,62], [19,84], [19,93], [20,21], [20,37], [20,91], [21,24], [21,31], [21,47], [21,48],
    [21,50], [21,65], [21,69], [22,23], [22,32], [22,34], [22,35], [22,83], [22,86], [23,31], [23,35], [23,36], [23,72], [23,83], [24,35], [24,52],
    [24,57], [24,67], [24,83], [25,26], [25,53], [25,57], [25,80], [26,57], [26,62], [26,75], [26,80], [27,70], [27,81], [27,92], [28,33], [28,48],
    [28,60], [28,63], [28,68], [28,70], [28,93], [29,32], [29,44], [29,50], [29,58], [29,65], [29,83], [30,42], [30,70], [30,79], [30,89], [31,35],
    [31,40], [31,49], [31,54], [32,52], [32,59], [32,83], [33,56], [33,74], [33,89], [34,35], [34,36], [34,40], [34,47], [34,49], [34,54], [35,39],
    [35,59], [35,67], [35,68], [35,69], [35,76], [35,86], [35,94], [35,95], [35,96], [36,45], [36,69], [37,46], [37,50], [37,77], [38,39], [38,79],
    [38,89], [39,41], [39,42], [39,46], [39,48], [39,68], [39,70], [39,73], [39,74], [39,81], [39,84], [39,92], [39,99], [40,58], [40,72], [41,42],
    [41,70], [41,82], [41,99], [42,51], [42,60], [42,68], [42,74], [42,76], [42,84], [43,53], [43,66], [43,73], [44,53], [44,95], [45,64], [45,67],
    [46,54], [46,67], [46,94], [46,96], [47,57], [47,65], [47,67], [48,63], [48,70], [48,79], [49,62], [51,70], [52,58], [52,67], [52,83], [53,61],
    [53,66], [53,90], [53,91], [54,67], [55,78], [56,98], [57,61], [57,62], [57,66], [57,71], [57,73], [57,80], [57,83], [57,85], [57,87], [57,88],
    [57,98], [58,83], [60,68], [60,89], [62,75], [62,90], [62,91], [63,70], [63,76], [63,89], [64,67], [64,83], [66,78], [66,85], [66,87], [66,90],
    [66,98], [67,72], [67,86], [67,91], [67,95], [69,97], [70,79], [70,81], [70,82], [70,89], [70,91], [70,99], [75,80], [76,84], [76,89], [77,83],
    [77,95], [80,91], [81,89], [82,84], [87,91], [87,98], [88,97], [89,93], [91,98], [94,95],
  ];
  const PLANTED = [0,0,1,0,1,1,2,2,1,2,2,0,0,0,2,1,1,0,2,1,2,2,2,2,2,0,0,1,1,2,1,2,2,1,2,2,2,2,1,1,2,1,1,0,2,2,2,2,1,2,2,1,2,0,2,0,1,0,2,2,1,0,0,1,2,2,0,2,1,2,1,0,2,0,1,0,1,2,0,1,0,1,1,2,1,0,2,0,0,1,0,0,1,1,2,2,2,0,0,1];
  const M = EDGES.length;

  // Brandes: edge betweenness of the links still alive, undirected, unnormalized
  // (each unordered pair of nodes counted once, as networkx does)
  function edgeBetweenness(alive) {
    const adj = Array.from({ length: N }, () => []);
    EDGES.forEach(([a, b], i) => { if (alive[i]) { adj[a].push([b, i]); adj[b].push([a, i]); } });
    const eb = new Float64Array(M);
    const sigma = new Float64Array(N), delta = new Float64Array(N);
    const dist = new Int32Array(N), order = new Int32Array(N);
    const pred = Array.from({ length: N }, () => []);
    for (let s = 0; s < N; s++) {
      sigma.fill(0); delta.fill(0); dist.fill(-1);
      for (const p of pred) p.length = 0;
      sigma[s] = 1; dist[s] = 0;
      let head = 0, tail = 0;
      order[tail++] = s;
      while (head < tail) {
        const v = order[head++];
        for (const [w, ei] of adj[v]) {
          if (dist[w] < 0) { dist[w] = dist[v] + 1; order[tail++] = w; }
          if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push([v, ei]); }
        }
      }
      for (let k = tail - 1; k > 0; k--) {
        const w = order[k];
        for (const [v, ei] of pred[w]) {
          const c = (sigma[v] / sigma[w]) * (1 + delta[w]);
          eb[ei] += c; delta[v] += c;
        }
      }
    }
    for (let i = 0; i < M; i++) eb[i] /= 2;
    return eb;
  }

  // connected components of the alive links, each labeled by its smallest node
  function components(alive) {
    const adj = Array.from({ length: N }, () => []);
    EDGES.forEach(([a, b], i) => { if (alive[i]) { adj[a].push(b); adj[b].push(a); } });
    const comp = new Array(N).fill(-1);
    for (let s = 0; s < N; s++) {
      if (comp[s] !== -1) continue;
      const stack = [s];
      comp[s] = s;
      while (stack.length) {
        const v = stack.pop();
        for (const w of adj[v]) if (comp[w] === -1) { comp[w] = s; stack.push(w); }
      }
    }
    return comp;
  }

  /* The full run. State t = "after t cuts" (t = 0 … M):
       comps[t]  component label per node       Q[t]  modularity of those groups
       ebs[t]    edge betweenness now (t < M)   cut[t] the link removed next (t < M)
       split[t]  set when cut t+1 split a group: {parent, a, b, sizeA, sizeB}
     tree: the dendrogram — {id, label, members, born, died, children}, born/died
     measured in cuts; rows: node → leaf row (the final DFS order). */
  function run() {
    const alive = new Array(M).fill(true);
    const comps = [components(alive)], Q = [CM.modularity(N, EDGES, comps[0])];
    const ebs = [], cut = [], split = [];
    for (let t = 0; t < M; t++) {
      const eb = edgeBetweenness(alive);
      let best = -1, bv = -Infinity;
      for (let i = 0; i < M; i++) {
        if (!alive[i]) continue;
        const r = Math.round(eb[i] * 1e9);
        if (r > bv) { bv = r; best = i; }      // EDGES is sorted: the first max is the smallest pair
      }
      ebs.push(eb); cut.push(best);
      alive[best] = false;
      const c = components(alive);
      const [u, v] = EDGES[best];
      if (c[u] !== c[v]) {
        const size = (l) => c.filter((x) => x === l).length;
        split[t] = { parent: comps[t][u], a: c[u], b: c[v], sizeA: size(c[u]), sizeB: size(c[v]) };
      }
      comps.push(c); Q.push(CM.modularity(N, EDGES, c));
    }

    // dendrogram
    const tree = [{ id: 0, label: 0, members: [...Array(N).keys()], born: 0, died: null, children: [] }];
    const live = new Map([[0, 0]]);            // component label → tree node id
    split.forEach((sp, t) => {
      if (!sp) return;
      const p = tree[live.get(sp.parent)];
      p.died = t + 1;
      for (const l of [sp.a, sp.b].sort((x, y) => x - y)) {
        const node = { id: tree.length, label: l, members: p.members.filter((i) => comps[t + 1][i] === l), born: t + 1, died: null, children: [] };
        tree.push(node); p.children.push(node.id);
        live.set(l, node.id);
      }
    });
    const rows = new Array(N);
    let r = 0;
    (function dfs(id) {
      const node = tree[id];
      if (!node.children.length) { for (const i of node.members) rows[i] = r++; return; }
      // bigger branch on top
      node.children.slice().sort((x, y) => tree[y].members.length - tree[x].members.length || x - y).forEach(dfs);
    })(0);
    for (const node of tree) {
      const rs = node.members.map((i) => rows[i]);
      node.rowMin = Math.min(...rs); node.rowMax = Math.max(...rs);
    }
    return { comps, Q, ebs, cut, split, tree, rows };
  }

  return { N, M, EDGES, PLANTED, edgeBetweenness, components, run };
})();
if (typeof module !== "undefined") module.exports = EB;

/* --- the explorable --- */
if (typeof document !== "undefined") (function () {
  const $ = (id) => document.getElementById(id);
  const { N, M, EDGES, PLANTED } = EB;
  const N_CATS = 7, COLOR_MIN = 4;     // groups of 4+ nodes get a color
  const PLAY_MS = 260;
  const R = EB.run();
  const fmt = d3.format(",");
  const fmtEb = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? fmt(Math.round(x)) : fmt(+x.toFixed(1)));

  let t = 0;                  // cuts done
  let timer = null;
  let slots = new Map();      // component label → color slot
  let pos = [];

  // a force layout, settled once (d3-force is deterministic)
  (function layout() {
    const nodes = d3.range(N).map((i) => ({ index: i }));
    d3.forceSimulation(nodes)
      .force("link", d3.forceLink(EDGES.map(([a, b]) => ({ source: a, target: b }))).id((d) => d.index).distance(20).strength(0.25))
      .force("charge", d3.forceManyBody().strength(-38))
      .force("x", d3.forceX().strength(0.05))
      .force("y", d3.forceY().strength(0.05))
      .stop().tick(400);
    const xs = nodes.map((d) => d.x), ys = nodes.map((d) => d.y);
    const x0 = d3.min(xs), x1 = d3.max(xs), y0 = d3.min(ys), y1 = d3.max(ys);
    const s = 1 / Math.max(x1 - x0, y1 - y0);
    pos = nodes.map((d) => [(d.x - (x0 + x1) / 2) * s, (d.y - (y0 + y1) / 2) * s]);   // in [-0.5, 0.5]
  })();

  function assignSlots(comp) {
    const size = new Map();
    for (const l of comp) size.set(l, (size.get(l) || 0) + 1);
    const ranked = [...size.entries()].filter(([, s]) => s >= COLOR_MIN)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, N_CATS).map(([l]) => l);
    const keep = new Set(ranked);
    for (const l of [...slots.keys()]) if (!keep.has(l)) slots.delete(l);
    const used = new Set(slots.values());
    for (const l of ranked) {
      if (slots.has(l)) continue;
      let s = 0; while (used.has(s)) s++;
      slots.set(l, s); used.add(s);
    }
    return size;
  }
  const colorOf = (l) => (slots.has(l) ? VK.cssVar(`--cat-${slots.get(l) + 1}`) : VK.cssVar("--text-muted"));

  /* --- the network --- */
  function drawNet() {
    const svgNode = $("net");
    const svg = d3.select(svgNode);
    svg.selectAll("*").remove();
    const W = svgNode.clientWidth, H = svgNode.clientHeight, pad = 12;
    const s = Math.min(W, H) - 2 * pad;
    const P = pos.map(([x, y]) => [W / 2 + x * s, H / 2 + y * s]);
    const comp = R.comps[t];
    const eb = t < M ? R.ebs[t] : null;
    const next = t < M ? R.cut[t] : -1;
    let maxEb = 0;
    if (eb) for (let i = 0; i < M; i++) if (eb[i] > maxEb && isAlive(i)) maxEb = eb[i];
    const muted = VK.cssVar("--text-muted"), accent = VK.cssVar("--accent");

    const g = svg.append("g");
    // links already cut: a faint dashed trace
    const cutSet = new Set(R.cut.slice(0, t));
    g.selectAll("line.cut").data([...cutSet]).join("line")
      .attr("x1", (i) => P[EDGES[i][0]][0]).attr("y1", (i) => P[EDGES[i][0]][1])
      .attr("x2", (i) => P[EDGES[i][1]][0]).attr("y2", (i) => P[EDGES[i][1]][1])
      .attr("stroke", muted).attr("stroke-opacity", 0.22).attr("stroke-width", 0.8).attr("stroke-dasharray", "2 3");
    const aliveIdx = d3.range(M).filter((i) => !cutSet.has(i) && i !== next);
    g.selectAll("line.alive").data(aliveIdx).join("line")
      .attr("x1", (i) => P[EDGES[i][0]][0]).attr("y1", (i) => P[EDGES[i][0]][1])
      .attr("x2", (i) => P[EDGES[i][1]][0]).attr("y2", (i) => P[EDGES[i][1]][1])
      .attr("stroke", muted)
      .attr("stroke-opacity", (i) => 0.28 + 0.5 * Math.sqrt(eb[i] / maxEb))
      .attr("stroke-width", (i) => 0.7 + 5.3 * (eb[i] / maxEb));
    // nodes
    g.selectAll("circle").data(d3.range(N)).join("circle")
      .attr("cx", (i) => P[i][0]).attr("cy", (i) => P[i][1]).attr("r", 4.2)
      .attr("fill", (i) => colorOf(comp[i]))
      .attr("fill-opacity", (i) => (slots.has(comp[i]) ? 1 : 0.55))
      .attr("stroke", VK.cssVar("--surface-1")).attr("stroke-width", 1.2);
    // the link that goes next, on top, with its value
    if (next >= 0) {
      const [a, b] = EDGES[next];
      g.append("line").attr("x1", P[a][0]).attr("y1", P[a][1]).attr("x2", P[b][0]).attr("y2", P[b][1])
        .attr("stroke", accent).attr("stroke-width", 6).attr("stroke-linecap", "round");
      for (const v of [a, b]) g.append("circle").attr("cx", P[v][0]).attr("cy", P[v][1]).attr("r", 4.2)
        .attr("fill", colorOf(comp[v])).attr("stroke", accent).attr("stroke-width", 2);
      const mx = (P[a][0] + P[b][0]) / 2, my = (P[a][1] + P[b][1]) / 2;
      const text = fmtEb(eb[next]);
      const lab = g.append("g").attr("transform", `translate(${Math.min(W - 30, Math.max(30, mx))},${Math.min(H - 12, Math.max(12, my - 14))})`);
      const tw = 7 * text.length + 12;
      lab.append("rect").attr("x", -tw / 2).attr("y", -9).attr("width", tw).attr("height", 18).attr("rx", 4)
        .attr("fill", VK.cssVar("--surface-1")).attr("stroke", accent).attr("stroke-width", 1);
      lab.append("text").attr("text-anchor", "middle").attr("y", 4).attr("font-size", 12).attr("font-weight", 600)
        .attr("fill", VK.cssVar("--text-primary")).text(text);
    }
  }
  function isAlive(i) { return !R.cut.slice(0, t).includes(i); }

  /* --- the dendrogram + Q strip --- */
  function drawTree() {
    const c = VK.chart($("tree"), { margin: { top: 8, right: 16, bottom: 40, left: 46 } });
    const gap = 16, stripH = 78;
    const treeH = c.h - stripH - gap;
    const xMax = Math.max(80, Math.min(M, t + 10));
    const x = d3.scaleLinear().domain([0, xMax]).range([0, c.w]);
    const rowH = treeH / N;
    const yRow = (r) => (r + 0.5) * rowH;
    const sec = VK.cssVar("--text-secondary"), muted = VK.cssVar("--text-muted"), accent = VK.cssVar("--accent");
    const comp = R.comps[t];

    // dendrogram: every branch that exists by cut t; live branches in their group color
    const tg = c.plot.append("g");
    tg.append("text").attr("class", "axistitle").attr("transform", `translate(${-34},${treeH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle").text("groups (dendrogram)");
    for (const node of R.tree) {
      if (node.born > t) continue;
      const y = yRow((node.rowMin + node.rowMax) / 2);
      const end = node.died !== null && node.died <= t ? node.died : t;
      const liveNow = !(node.died !== null && node.died <= t);
      const color = liveNow ? colorOf(node.label) : sec;
      const big = node.members.length >= COLOR_MIN;
      // live branches run a short stub past the "now" line, so a group born on
      // this very cut already shows its color
      const stub = liveNow ? 6 : 0;
      tg.append("line").attr("x1", x(node.born)).attr("x2", x(end) + stub)
        .attr("y1", y).attr("y2", y).attr("stroke", color).attr("stroke-width", big ? 2 : 1)
        .attr("stroke-opacity", liveNow && !slots.has(node.label) ? 0.6 : 1);
      if (liveNow && big) {
        tg.append("circle").attr("cx", x(end) + stub).attr("cy", y).attr("r", 2.5).attr("fill", color);
      }
      if (!liveNow) {
        const [c0, c1] = node.children.map((id) => R.tree[id]);
        tg.append("line").attr("x1", x(node.died)).attr("x2", x(node.died))
          .attr("y1", yRow((c0.rowMin + c0.rowMax) / 2)).attr("y2", yRow((c1.rowMin + c1.rowMax) / 2))
          .attr("stroke", sec).attr("stroke-width", 1);
      }
    }

    // Q strip
    const sy = treeH + gap;
    const y = d3.scaleLinear().domain([-0.05, 0.65]).range([sy + stripH, sy]);
    for (const v of [0, 0.3, 0.6]) {
      c.plot.append("line").attr("class", "gridline").attr("x1", 0).attr("x2", c.w).attr("y1", y(v)).attr("y2", y(v));
      c.plot.append("text").attr("class", "ticktext").attr("x", -8).attr("y", y(v) + 3.5).attr("text-anchor", "end").text(v.toFixed(1));
    }
    c.plot.append("text").attr("class", "axistitle").attr("transform", `translate(${-34},${sy + stripH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle").text("Q");
    c.plot.append("line").attr("class", "axisline").attr("x1", 0).attr("x2", c.w).attr("y1", c.h).attr("y2", c.h);
    c.plot.selectAll(".xtick").data(x.ticks(6).filter((v) => Number.isInteger(v))).join("text")
      .attr("class", "ticktext xtick").attr("x", (v) => x(v)).attr("y", c.h + 16).attr("text-anchor", "middle").text(fmt);
    c.plot.append("text").attr("class", "axistitle").attr("x", c.w / 2).attr("y", c.h + 32).attr("text-anchor", "middle")
      .text("links removed");
    const pts = [];
    for (let k = 0; k <= t; k++) { if (k > 0) pts.push([k, R.Q[k - 1]]); pts.push([k, R.Q[k]]); }
    VK.line(c, pts, x, y, VK.colors().s1);
    // the best level so far
    let bk = 0;
    for (let k = 1; k <= t; k++) if (R.Q[k] > R.Q[bk] + 1e-12) bk = k;
    if (t > 0 && R.Q[bk] > 0) {
      const groups = new Set(R.comps[bk]).size;
      c.plot.append("line").attr("x1", x(bk)).attr("x2", x(bk)).attr("y1", 0).attr("y2", sy + stripH)
        .attr("stroke", accent).attr("stroke-width", 1).attr("stroke-dasharray", "3 3");
      VK.marker(c, x(bk), y(R.Q[bk]), VK.colors().s1, 4);
      const right = x(bk) > c.w - 150;
      VK.directLabel(c, x(bk) + (right ? -8 : 8), y(R.Q[bk]) - 8, `best: ${groups} groups, Q = ${R.Q[bk].toFixed(3)}`, right ? "end" : "start")
        .attr("stroke", VK.cssVar("--surface-1")).attr("stroke-width", 3).attr("paint-order", "stroke");
    }
    // now
    c.plot.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", c.h)
      .attr("stroke", muted).attr("stroke-width", 1);
  }

  /* --- readout --- */
  function readout(size) {
    $("r-cuts").textContent = `${t} of ${M}`;
    $("r-groups").textContent = size.size;
    $("r-q").textContent = R.Q[t].toFixed(3);
    let between = 0;
    for (const i of R.cut.slice(0, t)) if (PLANTED[EDGES[i][0]] !== PLANTED[EDGES[i][1]]) between++;
    $("r-between").textContent = `${between} of ${t}`;
    if (t === 0) $("r-last").textContent = "–";
    else {
      const i = R.cut[t - 1], [a, b] = EDGES[i], v = R.ebs[t - 1][i], sp = R.split[t - 1];
      $("r-last").textContent = sp
        ? `${a}–${b} · ${fmtEb(v)} = ${Math.max(sp.sizeA, sp.sizeB)} × ${Math.min(sp.sizeA, sp.sizeB)}: the last link between them`
        : `${a}–${b} · edge betweenness ${fmtEb(v)}`;
    }
    $("step").disabled = t >= M;
    $("split").disabled = t >= M;
    $("play").disabled = t >= M;
  }

  function render() {
    const size = assignSlots(R.comps[t]);
    drawNet();
    drawTree();
    readout(size);
  }

  /* --- controls --- */
  function step() { if (t < M) t++; }
  function toSplit() { while (t < M) { t++; if (R.split[t - 1]) break; } }
  function stopPlay() { if (timer) clearInterval(timer); timer = null; $("play").textContent = "Play"; }
  function startPlay() {
    if (t >= M) return;
    $("play").textContent = "Pause";
    timer = setInterval(() => { step(); render(); if (t >= M) stopPlay(); }, PLAY_MS);
  }

  $("step").addEventListener("click", () => { stopPlay(); step(); render(); });
  $("split").addEventListener("click", () => { stopPlay(); toSplit(); render(); });
  $("play").addEventListener("click", () => (timer ? stopPlay() : startPlay()));
  $("reset").addEventListener("click", () => { stopPlay(); t = 0; slots = new Map(); render(); });
  window.addEventListener("resize", render);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

  // ?t=27 for screenshots and deep links
  const qt = +new URLSearchParams(location.search).get("t");
  if (qt > 0) { for (let k = 1; k <= Math.min(M, qt); k++) { t = k; assignSlots(R.comps[t]); } }
  render();
})();
