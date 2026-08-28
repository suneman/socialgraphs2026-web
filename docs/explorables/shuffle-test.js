/* Shuffle test — the null model as a permutation test. The real Marvel
   giant component sits on the left with its nodes pinned in a force layout;
   each shuffle rewires the links (degree-preserving edge swaps, or a fresh
   random G(n, m)), measures one quantity, and drops one dot into the
   histogram on the right. A hundred shuffles build the null distribution
   while the real value stays where it is: far outside. All quantities are
   exact; a degree-preserving shuffle = 10 × m successful swaps (the usual
   rule), starting from the real network every time. */

"use strict";

// Pure helpers, node-requirable for the verification protocol.
const ST = (() => {
  // directed graph as an edge array + key set
  function toDirected(n, edges) {
    return { n, edges: edges.map((e) => e.slice()), keys: new Set(edges.map(([a, b]) => a * 100000 + b)) };
  }

  function cloneDirected(dg) {
    return { n: dg.n, edges: dg.edges.map((e) => e.slice()), keys: new Set(dg.keys) };
  }

  // In-/out-degree-preserving swap: a→b, c→d  ⇒  a→d, c→b
  function directedSwap(dg, nswap, rnd = Math.random) {
    const E = dg.edges, m = E.length, K = dg.keys;
    let done = 0, tries = 0, maxTries = 100 * nswap;
    while (done < nswap && tries++ < maxTries) {
      const i = Math.floor(rnd() * m), j = Math.floor(rnd() * m);
      if (i === j) continue;
      const [a, b] = E[i], [c, d] = E[j];
      if (a === d || c === b || a === c || b === d) continue;
      if (K.has(a * 100000 + d) || K.has(c * 100000 + b)) continue;
      K.delete(a * 100000 + b); K.delete(c * 100000 + d);
      K.add(a * 100000 + d); K.add(c * 100000 + b);
      E[i] = [a, d]; E[j] = [c, b];
      done++;
    }
    return done;
  }

  // random directed G(n, m): m distinct arcs
  function gnmDirected(n, m, rnd = Math.random) {
    const dg = { n, edges: [], keys: new Set() };
    while (dg.edges.length < m) {
      const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n);
      if (a === b || dg.keys.has(a * 100000 + b)) continue;
      dg.keys.add(a * 100000 + b);
      dg.edges.push([a, b]);
    }
    return dg;
  }

  function reciprocity(dg) {
    let r = 0;
    for (const [a, b] of dg.edges) if (dg.keys.has(b * 100000 + a)) r++;
    return dg.edges.length ? r / dg.edges.length : 0;
  }

  const QUANT = {
    C:   { label: "Average clustering C",  fmt: (v) => v.toFixed(3), measure: (g) => GL.avgClustering(g) },
    T:   { label: "Transitivity",          fmt: (v) => v.toFixed(3), measure: (g) => GL.transitivity(g) },
    tri: { label: "Triangles",             fmt: (v) => Math.round(v).toLocaleString("en-US"), measure: (g) => GL.triangles(g) },
    d:   { label: "Mean distance (GCC)",   fmt: (v) => v.toFixed(3), measure: (g) => GL.avgPathLength(g) },
    rec: { label: "Reciprocity (directed)", fmt: (v) => v.toFixed(3), measure: null, directed: true },
  };

  function summary(samples, real) {
    const n = samples.length;
    if (!n) return { n, mean: NaN, sd: NaN, z: NaN, p: NaN, extreme: 0 };
    const mean = GL.mean(samples);
    const sd = n > 1 ? Math.sqrt(samples.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : NaN;
    const up = real >= mean;
    const extreme = samples.filter((x) => (up ? x >= real : x <= real)).length;
    return { n, mean, sd, z: sd > 0 ? (real - mean) / sd : NaN, p: (1 + extreme) / (1 + n), extreme };
  }

  return { toDirected, cloneDirected, directedSwap, gnmDirected, reciprocity, QUANT, summary };
})();
if (typeof module !== "undefined") module.exports = ST;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const canvas = $("net");
  const ctx = canvas.getContext("2d");

  let nodes, realU, realD, degs, pos = [];
  let curU, curD;             // the network currently drawn / measured
  let quantity = "C", nullKind = "swap";
  let realValue = NaN, samples = [];
  let busy = false, anim = null;
  let realDegDist = [];

  const SWAP_MULT = 10;

  /* --- measuring --- */

  function measure(u, d) {
    if (quantity === "rec") return ST.reciprocity(d);
    return ST.QUANT[quantity].measure(u);
  }

  function degreeDist(g) {
    const counts = new Map();
    for (const a of g.adj) counts.set(a.length, (counts.get(a.length) || 0) + 1);
    return [...counts.entries()].filter(([k]) => k > 0).sort((a, b) => a[0] - b[0])
      .map(([k, c]) => [k, c / g.n]);
  }

  /* --- one shuffle (returns the new network pair) --- */

  function freshNull() {
    if (nullKind === "gnm") {
      return { u: GL.gnm(realU.n, realU.edges.length), d: ST.gnmDirected(realD.n, realD.edges.length) };
    }
    const u = GL.clone(realU), d = ST.cloneDirected(realD);
    GL.doubleEdgeSwap(u, SWAP_MULT * u.edges.length);
    ST.directedSwap(d, SWAP_MULT * d.edges.length);
    return { u, d };
  }

  function record(u, d) {
    curU = u; curD = d;
    samples.push(measure(u, d));
    drawAll();
  }

  // animated single shuffle: swaps run in batches over ~25 frames
  function shuffleOnceAnimated() {
    if (busy) return;
    busy = true;
    if (nullKind === "gnm") {
      const { u, d } = freshNull();
      $("net-sub").innerHTML = "A fresh <b>random network</b> with the same number of nodes and links — the degrees are gone.";
      record(u, d);
      busy = false;
      return;
    }
    const u = GL.clone(realU), d = ST.cloneDirected(realD);
    const totalU = SWAP_MULT * u.edges.length, totalD = SWAP_MULT * d.edges.length;
    const FRAMES = 25;
    let f = 0;
    const step = () => {
      f++;
      GL.doubleEdgeSwap(u, Math.ceil(totalU / FRAMES));
      ST.directedSwap(d, Math.ceil(totalD / FRAMES));
      curU = u; curD = d;
      $("net-sub").innerHTML = `Swapping link pairs… <b>${Math.min(totalU, Math.round((f * totalU) / FRAMES)).toLocaleString("en-US")}</b> of ${totalU.toLocaleString("en-US")} swaps. Every node keeps its degree.`;
      drawNet();
      if (f < FRAMES) anim = requestAnimationFrame(step);
      else {
        $("net-sub").innerHTML = `Shuffled: <b>${totalU.toLocaleString("en-US")}</b> degree-preserving swaps. Same degrees, different neighbours.`;
        record(u, d);
        busy = false;
      }
    };
    anim = requestAnimationFrame(step);
  }

  // many shuffles: one full shuffle per frame so the histogram visibly builds
  function shuffleMany(count) {
    if (busy) return;
    busy = true;
    let i = 0;
    const step = () => {
      const { u, d } = freshNull();
      i++;
      $("progress").textContent = `shuffle ${i} of ${count}…`;
      $("net-sub").innerHTML = nullKind === "gnm"
        ? `Random network <b>${i}</b> of ${count}.`
        : `Shuffle <b>${i}</b> of ${count} — ${(SWAP_MULT * u.edges.length).toLocaleString("en-US")} swaps each, always starting from the real network.`;
      record(u, d);
      if (i < count) anim = requestAnimationFrame(step);
      else { $("progress").textContent = ""; busy = false; }
    };
    anim = requestAnimationFrame(step);
  }

  function reset(keepSamples = false) {
    if (anim) cancelAnimationFrame(anim);
    busy = false;
    $("progress").textContent = "";
    curU = realU; curD = realD;
    if (!keepSamples) samples = [];
    $("net-sub").innerHTML = "The real network. Press <b>Shuffle once</b> to scramble it.";
    drawAll();
  }

  /* --- drawing: network --- */

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function forceLayout() {
    const ns = nodes.map((n, i) => ({ index: i }));
    const ls = realU.edges.map(([a, b]) => ({ source: a, target: b }));
    const sim = d3.forceSimulation(ns)
      .force("link", d3.forceLink(ls).id((d) => d.index).distance(30).strength(0.18))
      .force("charge", d3.forceManyBody().strength(-58))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.045))
      .force("y", d3.forceY().strength(0.045))
      .stop();
    sim.tick(380);
    const pts = ns.map((d) => [d.x, d.y]);
    const rs = pts.map(([x, y]) => Math.hypot(x, y)).sort((a, b) => a - b);
    const ref = rs[Math.floor(rs.length * 0.96)] || 1e-9;
    const s = 0.92 / ref;
    return pts.map(([x, y]) => {
      let px = x * s, py = y * s;
      const r = Math.hypot(px, py);
      if (r > 1) { px /= r; py /= r; }
      return [px, py];
    });
  }

  function drawNet() {
    if (!canvas.clientWidth || !pos.length) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(canvas.clientWidth * dpr) || canvas.height !== Math.round(canvas.clientHeight * dpr)) fitCanvas();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const s = (Math.min(W, H) / 2) * 0.94;
    const maxDeg = Math.max(1, ...degs);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    const P = pos.map(([x, y]) => [x * s, y * s]);
    const muted = VK.cssVar("--text-muted"), accent = VK.cssVar("--accent");

    if (quantity === "rec") {
      // directed view: reciprocated pairs in accent, one-way arcs muted
      ctx.lineWidth = 0.8; ctx.strokeStyle = muted; ctx.globalAlpha = 0.22;
      ctx.beginPath();
      for (const [a, b] of curD.edges) if (!curD.keys.has(b * 100000 + a)) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
      ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = accent; ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (const [a, b] of curD.edges) if (a < b && curD.keys.has(b * 100000 + a)) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
      ctx.stroke();
    } else {
      ctx.lineWidth = 0.8; ctx.strokeStyle = muted; ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (const [a, b] of curU.edges) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const curDegs = curU.adj.map((a) => a.length);
    ctx.fillStyle = VK.cssVar("--text-secondary");
    P.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + 3.8 * Math.sqrt(curDegs[i] / maxDeg), 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.restore();
  }

  // the degree distribution of the current network vs the real one (log–log)
  function drawMini() {
    const c = VK.chart($("mini"), { margin: { top: 14, right: 12, bottom: 24, left: 40 } });
    const colors = VK.colors();
    const cur = degreeDist(curU);
    const kmax = Math.max(...realDegDist.map((d) => d[0]), ...cur.map((d) => d[0]), 2);
    const x = d3.scaleLog().domain([1, kmax * 1.3]).range([0, c.w]);
    const y = d3.scaleLog().domain([1 / (2 * curU.n), 1]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: [1, 10, 100].filter((v) => v <= kmax * 1.3),
      yTicks: [0.01, 0.1, 1].filter((v) => v >= 1 / (2 * curU.n)),
      yFormat: (v) => (v === 1 ? "1" : v === 0.1 ? "0.1" : "0.01"),
      xTitle: "degree k (log) — real ○ vs current ● : the shuffle must not move these",
    });
    c.plot.selectAll(".realdot").data(realDegDist).join("circle").attr("class", "realdot")
      .attr("cx", (d) => x(d[0])).attr("cy", (d) => y(d[1])).attr("r", 3.2)
      .attr("fill", "none").attr("stroke", colors.s1).attr("stroke-width", 1.5);
    c.plot.selectAll(".curdot").data(cur).join("circle").attr("class", "curdot")
      .attr("cx", (d) => x(d[0])).attr("cy", (d) => y(d[1])).attr("r", 1.8)
      .attr("fill", VK.cssVar("--accent"));
  }

  /* --- drawing: histogram --- */

  function drawChart() {
    const c = VK.chart($("chart"), { margin: { top: 18, right: 18, bottom: 40, left: 46 } });
    const colors = VK.colors();
    const Q = ST.QUANT[quantity];
    const sm = ST.summary(samples, realValue);

    let lo = realValue, hi = realValue;
    if (samples.length) { lo = Math.min(lo, ...samples); hi = Math.max(hi, ...samples); }
    if (hi - lo < 1e-12) { const w = Math.abs(realValue) * 0.3 || 1; lo = realValue - w; hi = realValue + 0.2 * w; if (quantity !== "d") lo = Math.max(0, lo); }
    const pad = 0.12 * (hi - lo);
    const x = d3.scaleLinear().domain([lo - pad, hi + pad]).nice(8).range([0, c.w]);
    const bins = d3.bin().domain(x.domain()).thresholds(40)(samples);
    const ymax = Math.max(3, ...bins.map((b) => b.length));
    const y = d3.scaleLinear().domain([0, ymax * 1.12]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: x.ticks(6),
      yTicks: y.ticks(4).filter(Number.isInteger),
      xFormat: (v) => (quantity === "tri" ? d3.format(",")(v) : d3.format(".3~f")(v)),
      xTitle: `${Q.label} under the ${nullKind === "gnm" ? "random G(n, m)" : "degree-preserving"} null`,
      yTitle: "shuffled networks",
    });

    c.plot.selectAll(".bar").data(bins).join("rect").attr("class", "bar")
      .attr("x", (b) => x(b.x0) + 0.5).attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
      .attr("y", (b) => y(b.length)).attr("height", (b) => c.h - y(b.length))
      .attr("fill", colors.s1).attr("opacity", 0.85);

    if (sm.n >= 5 && sm.sd > 0) {
      const bw = bins.length ? bins[0].x1 - bins[0].x0 : 1;
      const pts = d3.range(x.domain()[0], x.domain()[1], (x.domain()[1] - x.domain()[0]) / 120).map((v) => [
        v, (sm.n * bw * Math.exp(-0.5 * ((v - sm.mean) / sm.sd) ** 2)) / (sm.sd * Math.sqrt(2 * Math.PI)),
      ]);
      VK.line(c, pts, x, y, colors.s2);
    }

    const accent = VK.cssVar("--accent");
    c.plot.append("line").attr("x1", x(realValue)).attr("x2", x(realValue)).attr("y1", 0).attr("y2", c.h)
      .attr("stroke", accent).attr("stroke-width", 2);
    const anchor = x(realValue) > c.w * 0.6 ? "end" : "start";
    c.plot.append("text").attr("class", "directlabel").attr("fill", accent)
      .attr("x", x(realValue) + (anchor === "end" ? -6 : 6)).attr("y", 12).attr("text-anchor", anchor)
      .text(`real: ${Q.fmt(realValue)}`);
    if (sm.n >= 2 && sm.sd > 0) {
      // label beside the bell, not on its peak
      const right = x(sm.mean) < c.w * 0.55;
      const lx = x(sm.mean + (right ? 3 : -3) * sm.sd) + (right ? 6 : -6);
      VK.directLabel(c, lx, 28, `null: ${Q.fmt(sm.mean)} ± ${Q.fmt(sm.sd)}`, right ? "start" : "end");
    }
  }

  function drawTiles() {
    const Q = ST.QUANT[quantity];
    const sm = ST.summary(samples, realValue);
    $("l-real").textContent = `Real network — ${Q.label}`;
    $("r-real").textContent = Q.fmt(realValue);
    $("r-n").textContent = sm.n;
    $("r-null").textContent = sm.n >= 2 ? `${Q.fmt(sm.mean)} ± ${Q.fmt(sm.sd)}` : sm.n === 1 ? Q.fmt(sm.mean) : "–";
    $("r-z").textContent = sm.n >= 2 && sm.sd > 0 ? (sm.z > 0 ? "+" : "") + sm.z.toFixed(1) : "–";
    $("r-p").textContent = sm.n ? `${sm.p.toFixed(3)}  (${1 + sm.extreme}/${1 + sm.n})` : "–";
    $("r-m").textContent = `${curU.edges.length.toLocaleString("en-US")} (${curD.edges.length.toLocaleString("en-US")} directed)`;
  }

  function drawAll() { drawNet(); drawMini(); drawChart(); drawTiles(); }

  /* --- wiring --- */

  function segment(id, onPick) {
    const seg = $(id);
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || busy) return;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      onPick(b.dataset.v);
    });
  }
  segment("q-seg", (v) => { quantity = v; realValue = measure(realU, realD); reset(); });
  segment("null-seg", (v) => { nullKind = v; reset(); });
  $("one").addEventListener("click", shuffleOnceAnimated);
  $("many").addEventListener("click", () => shuffleMany(100));
  $("reset").addEventListener("click", () => reset());
  window.addEventListener("resize", () => { fitCanvas(); drawAll(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawAll);

  /* --- boot --- */

  MV.load().then((data) => {
    nodes = data.gcc.nodes;
    realU = MV.toGraph(nodes.length, data.gcc.undirected);
    realD = ST.toDirected(nodes.length, data.gcc.directed);
    degs = GL.degrees(realU);
    realDegDist = degreeDist(realU);
    $("net-title").textContent = `Marvel giant component — ${nodes.length} nodes stay put, ${realU.edges.length.toLocaleString("en-US")} links get shuffled`;
    fitCanvas();
    pos = forceLayout();
    realValue = measure(realU, realD);
    reset();
    // ?auto=N runs N shuffles on load (used by the screenshot verification)
    const auto = +new URLSearchParams(location.search).get("auto");
    if (auto > 0) shuffleMany(auto);
  }).catch(() => {
    canvas.outerHTML = '<p style="color: var(--text-muted)">Could not load the shared dataset — is the site running from its server?</p>';
  });
})();
