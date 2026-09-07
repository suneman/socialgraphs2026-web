/* Seeing a weighted network honestly. The weighted Marvel giant component
   (277 characters, 1,421 links; a tie's weight = how many times the two
   articles link to each other, 1…16) thinned two ways: a naive global
   threshold (keep every link with w ≥ some value) and the disparity filter
   (Serrano, Boguñá & Vespignani 2009: keep a tie if it is statistically
   significant for AT LEAST ONE of its endpoints, so a weak node's strongest
   tie survives while a hub's routine ties go). Nodes are sized by strength and
   colored by the unweighted Louvain community from community.js — the same
   partition week 1's layouts explorable paints. Positions are computed once
   and never move; the sliders change only what is drawn. */

"use strict";

/* --- pure filter functions, node-requirable for the verification protocol --- */
const BB = (() => {
  // degree and strength of every node from a weighted edge list [[a, b, w], …]
  function degStrength(n, weighted) {
    const k = new Array(n).fill(0), s = new Array(n).fill(0);
    for (const [a, b, w] of weighted) { k[a]++; k[b]++; s[a] += w; s[b] += w; }
    return { k, s };
  }

  // Disparity filter: keep link (a, b) if at either endpoint v with k_v ≥ 2 the
  // tie's share of v's strength is unlikely under a uniform split of that
  // strength over k_v ties: (1 − w/s_v)^(k_v − 1) < alpha.
  function disparity(n, weighted, alpha) {
    const { k, s } = degStrength(n, weighted);
    const sig = (v, w) => k[v] >= 2 && Math.pow(1 - w / s[v], k[v] - 1) < alpha;
    return weighted.map(([a, b, w]) => sig(a, w) || sig(b, w));
  }

  // Naive global threshold: keep every link with weight ≥ wmin
  function threshold(weighted, wmin) {
    return weighted.map((e) => e[2] >= wmin);
  }

  // links kept, nodes with ≥ 1 kept link, size of the largest component of
  // the kept links (isolates count as components of size 1, as networkx does)
  function summary(n, weighted, keep) {
    const adj = Array.from({ length: n }, () => []);
    let links = 0;
    weighted.forEach(([a, b], i) => { if (keep[i]) { links++; adj[a].push(b); adj[b].push(a); } });
    let nodesWithLink = 0;
    for (const a of adj) if (a.length) nodesWithLink++;
    const seen = new Array(n).fill(false);
    let giant = 0;
    for (let st = 0; st < n; st++) {
      if (seen[st] || !adj[st].length) continue;
      const stack = [st];
      seen[st] = true;
      let size = 0;
      while (stack.length) {
        const v = stack.pop();
        size++;
        for (const w of adj[v]) if (!seen[w]) { seen[w] = true; stack.push(w); }
      }
      if (size > giant) giant = size;
    }
    return { links, nodesWithLink, giant };
  }

  // slider position 0…100 → α on a log scale 0.01…0.5, rounded to two
  // significant digits so the number shown is the number used
  function alphaFromSlider(v) {
    return +(0.01 * Math.pow(50, v / 100)).toPrecision(2);
  }

  return { degStrength, disparity, threshold, summary, alphaFromSlider };
})();
if (typeof module !== "undefined") module.exports = BB;

/* --- the explorable --- */
if (typeof document !== "undefined") (function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $("net");
  const ctx = canvas.getContext("2d");
  const chartNode = $("chart");
  const N_CATS = 7;
  const N_LABELS = 6;
  const R = 1;

  let nodes, W, U, n, strength, degs, comm, nComm, adjIdx, pos = [];
  let names = [];               // display names (disambiguators dropped when unambiguous)
  let mode = "disparity";       // "disparity" | "threshold"
  let sliderA = 77;             // → α = 0.20
  let wmin = 3;
  let dropped = "faint";        // "faint" | "hidden"
  let keep = [], keptCount = [], hovered = null;
  let labelNodes = [];
  let CURVE_A = [], CURVE_W = [];
  const ALPHAS = Array.from({ length: 101 }, (_, v) => BB.alphaFromSlider(v));
  const WS = [1, 2, 3, 4, 5, 6, 7, 8];

  const catColor = (c) => (c < N_CATS ? VK.cssVar(`--cat-${c + 1}`) : VK.cssVar("--text-muted"));
  const alpha = () => BB.alphaFromSlider(sliderA);
  const fmtA = (a) => (a >= 0.1 ? a.toFixed(2) : String(+a.toPrecision(2)));
  const pct = (v, of) => (100 * v) / of;

  /* --- layout (copied from layouts.js: same forces, same normalization) --- */
  function normalize(pts) {
    const rs = pts.map(([x, y]) => Math.hypot(x, y)).sort((a, b) => a - b);
    const ref = rs[Math.floor(rs.length * 0.96)] || 1e-9;
    const s = (0.92 * R) / ref;
    return pts.map(([x, y]) => {
      let px = x * s, py = y * s;
      const r = Math.hypot(px, py);
      if (r > R) { px *= R / r; py *= R / r; }
      return [px, py];
    });
  }

  function forceLayout() {
    const ns = nodes.map((_, i) => ({ index: i }));
    const ls = U.map(([a, b]) => ({ source: a, target: b }));
    const sim = d3.forceSimulation(ns)
      .force("link", d3.forceLink(ls).id((d) => d.index).distance(30).strength(0.18))
      .force("charge", d3.forceManyBody().strength(-58))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.045))
      .force("y", d3.forceY().strength(0.045))
      .stop();
    sim.tick(380);
    return normalize(ns.map((d) => [d.x, d.y]));
  }

  /* --- the filter state --- */
  function recompute() {
    keep = mode === "disparity" ? BB.disparity(n, W, alpha()) : BB.threshold(W, wmin);
    keptCount = new Array(n).fill(0);
    W.forEach(([a, b], i) => { if (keep[i]) { keptCount[a]++; keptCount[b]++; } });
  }

  function currentSummary() {
    return mode === "disparity" ? CURVE_A[sliderA] : CURVE_W[wmin - 1];
  }

  /* --- drawing: the network --- */
  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function unitScale() {
    return (Math.min(canvas.clientWidth, canvas.clientHeight) / 2) * 0.94;
  }

  function radius(i, maxS) {
    return 1.4 + 3.8 * Math.sqrt(strength[i] / maxS);
  }

  function drawNet() {
    if (!canvas.clientWidth || !pos.length) return;
    const dpr = window.devicePixelRatio || 1;
    const Wd = canvas.clientWidth, H = canvas.clientHeight;
    const s = unitScale();
    const maxS = Math.max(1, ...strength);
    const muted = VK.cssVar("--text-muted");
    const surface = VK.cssVar("--surface-1");
    const accent = VK.cssVar("--accent");
    const ink = VK.cssVar("--text-primary");

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, Wd, H);
    ctx.translate(Wd / 2, H / 2);
    const P = pos.map(([x, y]) => [x * s, y * s]);
    const seg = (a, b) => { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); };
    const lw = (w) => Math.min(2.6, 0.6 + 0.12 * w);

    // dropped links, faint (or not at all)
    if (dropped === "faint") {
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.06;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      W.forEach(([a, b], i) => { if (!keep[i]) seg(a, b); });
      ctx.stroke();
    }

    // kept links: cross-community gray, within-community in the community color
    const buckets = new Map();
    const cross = [];
    W.forEach(([a, b, w], i) => {
      if (!keep[i]) return;
      if (comm[a] === comm[b]) {
        if (!buckets.has(comm[a])) buckets.set(comm[a], []);
        buckets.get(comm[a]).push([a, b, w]);
      } else cross.push([a, b, w]);
    });
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = muted;
    for (const [a, b, w] of cross) { ctx.lineWidth = lw(w); ctx.beginPath(); seg(a, b); ctx.stroke(); }
    ctx.globalAlpha = 0.55;
    for (const [c, es] of buckets) {
      ctx.strokeStyle = catColor(c);
      for (const [a, b, w] of es) { ctx.lineWidth = lw(w); ctx.beginPath(); seg(a, b); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    // nodes: sized by strength, colored by community, faded when nothing kept
    P.forEach(([x, y], i) => {
      ctx.globalAlpha = keptCount[i] ? 1 : 0.25;
      ctx.beginPath();
      ctx.arc(x, y, radius(i, maxS), 0, 2 * Math.PI);
      ctx.fillStyle = catColor(comm[i]);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // hovered node: its kept links and neighbors in the accent
    if (hovered !== null) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const [j, ei] of adjIdx[hovered]) if (keep[ei]) seg(hovered, j);
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const [j, ei] of adjIdx[hovered]) {
        if (!keep[ei]) continue;
        ctx.beginPath();
        ctx.arc(P[j][0], P[j][1], radius(j, maxS), 0, 2 * Math.PI);
        ctx.fill();
      }
      const [x, y] = P[hovered];
      ctx.beginPath();
      ctx.arc(x, y, radius(hovered, maxS) + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // labels for the strongest characters, while they still have a kept link
    ctx.font = "600 12px system-ui";
    const labels = [];
    for (const i of labelNodes) {
      if (!keptCount[i] && hovered !== i) continue;
      labels.push(i);
    }
    if (hovered !== null && !labels.includes(hovered)) labels.push(hovered);
    const boxes = labels.map((i) => {
      const text = names[i];
      const tw = ctx.measureText(text).width;
      const r = radius(i, maxS);
      let lx = P[i][0] + r + 5;
      if (lx + tw + 6 > Wd / 2) lx = P[i][0] - r - 5 - tw;   // flip to the left near the right edge
      return { i, text, tw, x: lx, y: P[i][1] - 8 };
    }).sort((a, b) => a.y - b.y);
    for (let j = 1; j < boxes.length; j++) {
      const a = boxes[j - 1], b = boxes[j];
      const overlapX = a.x < b.x + b.tw + 6 && b.x < a.x + a.tw + 6;
      if (overlapX && b.y - a.y < 15) b.y = a.y + 15;
    }
    for (const b of boxes) {
      const y = Math.max(-H / 2 + 2, Math.min(H / 2 - 16, b.y));
      ctx.fillStyle = surface;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(b.x - 3, y - 1, b.tw + 6, 16);
      ctx.globalAlpha = 1;
      ctx.fillStyle = b.i === hovered ? accent : ink;
      ctx.fillText(b.text, b.x, y + 11);
    }
    ctx.restore();
  }

  function drawLegend() {
    const counts = new Map();
    for (const c of comm) counts.set(c, (counts.get(c) || 0) + 1);
    const items = [];
    for (let c = 0; c < Math.min(nComm, N_CATS); c++) {
      let top = -1;
      for (let i = 0; i < n; i++) if (comm[i] === c && (top === -1 || degs[i] > degs[top])) top = i;
      items.push(`<span class="key"><span class="swatch dot" style="background: var(--cat-${c + 1})"></span>${names[top]} &amp; co. (${counts.get(c)})</span>`);
    }
    if (nComm > N_CATS) {
      const rest = comm.filter((c) => c >= N_CATS).length;
      items.push(`<span class="key"><span class="swatch dot" style="background: var(--text-muted)"></span>smaller communities (${rest})</span>`);
    }
    $("legend").innerHTML = items.join("");
  }

  /* --- drawing: the chart --- */
  function drawChart() {
    const c = VK.chart(chartNode, { margin: { top: 14, right: 18, bottom: 40, left: 44 } });
    const col = VK.colors();
    const sec = VK.cssVar("--text-secondary"), accent = VK.cssVar("--accent");
    const isA = mode === "disparity";
    const xs = isA ? ALPHAS : WS;
    const curve = isA ? CURVE_A : CURVE_W;
    const x = isA
      ? d3.scaleLog().domain([0.01, 0.5]).range([0, c.w])
      : d3.scaleLinear().domain([1, 8]).range([0, c.w]);
    const y = d3.scaleLinear().domain([0, 100]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: isA ? [0.01, 0.02, 0.05, 0.1, 0.2, 0.5] : WS,
      xFormat: isA ? (v) => String(v) : (v) => `≥ ${v}`,
      yTicks: [0, 25, 50, 75, 100],
      yFormat: (v) => `${v}%`,
      xTitle: isA ? "disparity filter α (log scale)" : "threshold: keep links with weight w ≥",
      yTitle: "kept, % of the full network",
    });

    const series = [
      { key: "links", label: "links kept", color: col.s1, of: W.length, dash: null },
      { key: "nodesWithLink", label: "nodes with a link", color: col.s2, of: n, dash: null },
      { key: "giant", label: "giant component", color: sec, of: n, dash: "6 4" },
    ];
    const pts = series.map((sr) => xs.map((xv, j) => [xv, pct(curve[j][sr.key], sr.of)]));
    series.forEach((sr, si) => {
      const p = VK.line(c, pts[si], x, y, sr.color);
      if (sr.dash) p.attr("stroke-dasharray", sr.dash);
    });

    // direct labels where each curve is farthest from the other two, placed
    // one after another so labels never sit on each other or on another curve
    const placed = [];
    const approxW = (t) => 6.4 * t.length + 6;
    series.forEach((sr, si) => {
      const cands = xs.map((_, j) => {
        let gap = Infinity;
        for (let t = 0; t < series.length; t++) if (t !== si) gap = Math.min(gap, Math.abs(y(pts[si][j][1]) - y(pts[t][j][1])));
        return { j, gap };
      }).sort((a, b) => b.gap - a.gap || b.j - a.j);
      const w = approxW(sr.label);
      outer: for (const { j } of cands) {
        const px = x(xs[j]), py = y(pts[si][j][1]);
        for (const above of [true, false]) {
          const ty = above ? py - 9 : py + 17;
          const anchor = px < 40 ? "start" : px > c.w - 40 ? "end" : "middle";
          const x0 = anchor === "start" ? px : anchor === "end" ? px - w : px - w / 2;
          const box = { x0, x1: x0 + w, y0: ty - 11, y1: ty + 3 };
          if (box.y0 < -2 || box.y1 > c.h + 2 || box.x0 < -2 || box.x1 > c.w + 2) continue;
          if (placed.some((b) => !(box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1))) continue;
          let onCurve = false;
          for (let t = 0; t < series.length && !onCurve; t++) {
            if (t === si) continue;
            for (let q = 0; q < xs.length; q++) {
              const qx = x(xs[q]), qy = y(pts[t][q][1]);
              if (qx >= box.x0 && qx <= box.x1 && qy >= box.y0 && qy <= box.y1) { onCurve = true; break; }
            }
          }
          if (onCurve) continue;
          VK.directLabel(c, px, ty, sr.label, anchor)
            .attr("stroke", col.surface).attr("stroke-width", 3).attr("paint-order", "stroke");
          placed.push(box);
          break outer;
        }
      }
    });

    // the current setting
    const cur = isA ? alpha() : wmin;
    const idx = isA ? sliderA : wmin - 1;
    c.plot.append("line").attr("x1", x(cur)).attr("x2", x(cur)).attr("y1", 0).attr("y2", c.h)
      .attr("stroke", accent).attr("stroke-width", 1).attr("stroke-dasharray", "3 3");
    series.forEach((sr) => VK.marker(c, x(cur), y(pct(curve[idx][sr.key], sr.of)), sr.color, 5));
  }

  /* --- readout --- */
  function tieName(e) { return `${names[e[0]]}–${names[e[1]]} (${e[2]})`; }

  function updateReadout() {
    const sm = currentSummary();
    $("r-links").textContent = `${sm.links.toLocaleString("en-US")} of ${W.length.toLocaleString("en-US")} · ${Math.round(pct(sm.links, W.length))}%`;
    $("r-nodes").textContent = `${sm.nodesWithLink} of ${n}`;
    $("r-giant").textContent = `${sm.giant}`;
    let strongestDropped = null, weakestKept = null;
    W.forEach((e, i) => {
      const load = strength[e[0]] + strength[e[1]];
      if (!keep[i]) {
        if (!strongestDropped || e[2] > strongestDropped[2] || (e[2] === strongestDropped[2] && load > strength[strongestDropped[0]] + strength[strongestDropped[1]])) strongestDropped = e;
      } else if (!weakestKept || e[2] < weakestKept[2] || (e[2] === weakestKept[2] && load < strength[weakestKept[0]] + strength[weakestKept[1]])) weakestKept = e;
    });
    $("r-dropped").textContent = strongestDropped ? tieName(strongestDropped) : "none";
    $("r-kept").textContent = weakestKept ? tieName(weakestKept) : "none";
    $("r-hover").textContent = hovered === null ? "–"
      : `${names[hovered]} · s = ${strength[hovered]} · k = ${degs[hovered]} · ${keptCount[hovered]} of ${degs[hovered]} kept`;
  }

  function syncControls() {
    $("alpha").value = sliderA;
    $("alpha-val").textContent = fmtA(alpha());
    $("wmin").value = wmin;
    $("w-val").textContent = `${wmin}`;
    const isA = mode === "disparity";
    $("alpha").disabled = !isA;
    $("wmin").disabled = isA;
    $("alpha-ctl").classList.toggle("off", !isA);
    $("w-ctl").classList.toggle("off", isA);
    document.querySelectorAll("#mode-seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
    document.querySelectorAll("#drop-seg button").forEach((b) => b.classList.toggle("on", b.dataset.v === dropped));
  }

  function render() {
    recompute();
    syncControls();
    drawNet();
    drawChart();
    updateReadout();
  }

  /* --- interaction --- */
  function nodeAt(mx, my) {
    const s = unitScale();
    const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
    let best = null, bestD = 12 * 12;
    pos.forEach(([x, y], i) => {
      const dx = x * s + cx - mx, dy = y * s + cy - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    const h = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (h !== hovered) { hovered = h; drawNet(); updateReadout(); }
  });
  canvas.addEventListener("mouseleave", () => { hovered = null; drawNet(); updateReadout(); });

  $("mode-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    mode = b.dataset.mode;
    render();
  });
  $("drop-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    dropped = b.dataset.v;
    render();
  });
  $("alpha").addEventListener("input", () => { sliderA = +$("alpha").value; if (mode !== "disparity") mode = "disparity"; render(); });
  $("wmin").addEventListener("input", () => { wmin = +$("wmin").value; if (mode !== "threshold") mode = "threshold"; render(); });

  /* --- boot --- */
  MV.loadWeighted().then((d) => {
    nodes = d.gcc.nodes;
    n = nodes.length;
    W = d.gcc.weighted;
    U = d.gcc.undirected;
    strength = d.gcc.strength;
    degs = new Array(n).fill(0);
    adjIdx = Array.from({ length: n }, () => []);
    W.forEach(([a, b], i) => { degs[a]++; degs[b]++; adjIdx[a].push([b, i]); adjIdx[b].push([a, i]); });

    // display names: drop a trailing Wikipedia disambiguator unless that
    // would make two characters look the same
    const bare = nodes.map((nd) => nd.name.replace(/\s*\([^)]*\)\s*$/, ""));
    const seen = new Map();
    for (const b of bare) seen.set(b, (seen.get(b) || 0) + 1);
    names = nodes.map((nd, i) => (seen.get(bare[i]) > 1 ? nd.name : bare[i]));

    comm = CM.louvain(n, U);
    nComm = Math.max(...comm) + 1;
    labelNodes = [...Array(n).keys()].sort((a, b) => strength[b] - strength[a] || a - b).slice(0, N_LABELS);

    CURVE_A = ALPHAS.map((a) => BB.summary(n, W, BB.disparity(n, W, a)));
    CURVE_W = WS.map((w) => BB.summary(n, W, BB.threshold(W, w)));

    // ?mode=threshold&w=3&alpha=0.2 for screenshots and deep links
    const qs = new URLSearchParams(location.search);
    if (qs.get("mode") === "threshold") mode = "threshold";
    if (qs.get("w")) wmin = Math.max(1, Math.min(8, +qs.get("w") || 3));
    if (qs.get("alpha")) {
      const target = +qs.get("alpha");
      let bi = 0;
      ALPHAS.forEach((a, i) => { if (Math.abs(a - target) < Math.abs(ALPHAS[bi] - target)) bi = i; });
      sliderA = bi;
    }
    if (qs.get("dropped") === "hidden") dropped = "hidden";

    drawLegend();
    fitCanvas();
    pos = forceLayout();
    render();
  }).catch(() => {
    canvas.outerHTML = '<p style="color: var(--text-muted)">Could not load the shared dataset — is the site running from its server?</p>';
  });

  window.addEventListener("resize", () => { fitCanvas(); drawNet(); drawChart(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { drawNet(); drawChart(); });
})();
