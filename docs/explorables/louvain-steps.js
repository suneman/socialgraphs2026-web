/* Louvain, one move at a time, on the real Marvel giant component (277
   characters, 1,421 links, docs/data/week1_*.tsv via marvel.js). The algorithm
   is community.js's deterministic stepper — the very same code that colors the
   week-1 layouts explorable — so what you watch here is exactly the partition
   the page reports (8 communities, Q = 0.380, 395 moves, three aggregations).
   Every node starts alone. Step moves ONE node to the neighboring community
   that raises Q most; Sweep visits every node once; when a full sweep moves
   nothing, phase 1 has converged and Aggregate (phase 2) collapses each
   community into a super-node and the sweeps start again on the smaller
   network. The layout is settled once and never moves — only the colors
   change. The chart records Q after every single move against the 0.25 that a
   degree-preserving shuffle of this network reaches (brief, 2026-09-06).
   Colors: communities ranked by size take --cat-1…7, keyed on a stable label
   (the smallest member index) so a community keeps its color while it lives;
   everything smaller is gray. Identity is never color-alone: each colored
   community's hub is ringed and named on the canvas and in the legend. */

"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $("net"), ctx = canvas.getContext("2d");
  const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const N_CATS = 7;
  const PLAY_MS = 66;          // ~15 moves per second
  const NULL_Q = 0.25;         // Louvain Q of a degree-preserving shuffle (20×, ±0.004)

  let n = 0, names = [], edges = [], degs = [], positions = [];
  let st = null;               // the stepper
  let hist = [];               // [[moves, Q], …] — one point per move, plus the start
  let aggAt = [];              // move counts at which phase 2 ran
  let aggCount = 0;
  let lastText = "–";          // readout: the last move
  let lastNodes = [];          // original nodes moved last (accent ring)
  let slots = new Map();       // stable label → color slot 0..6
  let timer = null;

  /* --- data + layout --- */

  MV.load().then((data) => {
    n = data.gcc.nodes.length;
    names = data.gcc.nodes.map((d) => d.name);
    edges = data.gcc.undirected;
    degs = new Array(n).fill(0);
    for (const [a, b] of edges) { degs[a]++; degs[b]++; }
    layout();
    reset();
  }).catch(() => {
    canvas.outerHTML = '<p style="color: var(--text-muted)">Could not load the shared dataset — is the site running from its server?</p>';
  });

  // settle a force layout once, then keep it static — the week-1 layouts
  // explorable's recipe, so this is the same picture students met there
  function layout() {
    const nodes = d3.range(n).map((i) => ({ index: i }));
    const links = edges.map(([a, b]) => ({ source: a, target: b }));
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.index).distance(30).strength(0.18))
      .force("charge", d3.forceManyBody().strength(-58))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.045))
      .force("y", d3.forceY().strength(0.045))
      .stop();
    sim.tick(380);
    positions = normalize(nodes.map((d) => [d.x, d.y]));
  }

  // scale so the 96th-percentile radius fills the frame; clamp the stragglers
  // to the unit circle (layouts.js's recipe) so the core is not a dot
  function normalize(pts) {
    const rs = pts.map(([x, y]) => Math.hypot(x, y)).sort((a, b) => a - b);
    const ref = rs[Math.floor(rs.length * 0.96)] || 1e-9;
    const k = 0.92 / ref;
    return pts.map(([x, y]) => {
      let px = x * k, py = y * k;
      const r = Math.hypot(px, py);
      if (r > 1) { px /= r; py /= r; }
      return [px, py];
    });
  }

  /* --- the algorithm, driven one visit at a time so every move is recorded --- */

  function reset() {
    stopPlay();
    st = CM.louvainStepper(n, edges);
    hist = [[0, st.Q()]];
    aggAt = []; aggCount = 0;
    lastText = "–"; lastNodes = [];
    slots = new Map();
    render();
  }

  function shortName(s) { return s.replace(/ \(.*\)$/, ""); }

  // top-degree member of a set of original nodes, optionally excluding some
  function hubOf(members, exclude) {
    let best = -1;
    for (const i of members) {
      if (exclude && exclude.has(i)) continue;
      if (best === -1 || degs[i] > degs[best]) best = i;
    }
    return best;
  }

  // one node visit; if it moved, record Q and describe the move
  function visit() {
    const before = st.labels();
    const r = st.step();
    if (r.moved) {
      const after = st.labels();
      const moved = [];
      for (let i = 0; i < n; i++) if (before[i] !== after[i]) moved.push(i);
      const dest = after[moved[0]];
      const destMembers = [];
      for (let i = 0; i < n; i++) if (after[i] === dest) destMembers.push(i);
      const movedSet = new Set(moved);
      const hubM = hubOf(moved);
      const hubD = hubOf(destMembers, movedSet);
      const from = moved.length === 1 ? shortName(names[hubM]) : `${shortName(names[hubM])} & co. (${moved.length})`;
      const to = hubD === -1 ? "its own group" : `${shortName(names[hubD])} & co.`;
      lastText = `${from} → ${to}`;
      lastNodes = moved;
      hist.push([st.moves, st.Q()]);
    }
    return r;
  }

  function stepOnce() {
    if (st.phase !== "move") return false;
    let r;
    do { r = visit(); } while (st.phase === "move" && !r.moved);
    return r.moved;
  }

  function sweepOnce() {
    if (st.phase !== "move") return;
    let r;
    do { r = visit(); } while (!r.sweepDone && st.phase === "move");
  }

  function aggregateOnce() {
    if (st.phase === "done") return;
    const finishedFirst = st.phase === "move";
    while (st.phase === "move") sweepOnce();     // finish phase 1, every move recorded
    const nodesBefore = st.levelNodes;
    const more = st.aggregate();
    if (more) {
      aggCount++;
      aggAt.push(st.moves);
      lastText = (finishedFirst ? "phase 1 finished, then " : "") + `phase 2: ${nodesBefore} → ${st.levelNodes} super-nodes`;
    } else {
      lastText = "nothing left to merge";
    }
    lastNodes = [];
  }

  /* --- colors: stable slots for the seven largest communities --- */

  function assignSlots(labels) {
    const size = new Map();
    for (const l of labels) size.set(l, (size.get(l) || 0) + 1);
    const ranked = [...size.entries()].filter(([, s]) => s >= 2)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, N_CATS).map(([l]) => l);
    const keep = new Set(ranked);
    for (const l of [...slots.keys()]) if (!keep.has(l)) slots.delete(l);
    const used = new Set(slots.values());
    for (const l of ranked) {
      if (slots.has(l)) continue;
      let s = 0; while (used.has(s)) s++;
      slots.set(l, s); used.add(s);
    }
    return { size, ranked };
  }

  /* --- network panel --- */

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  function frame() {
    const W = canvas.clientWidth, H = canvas.clientHeight, pad = 10;
    const s = (Math.min(W, H) - 2 * pad) / 2;   // unit circle → the canvas
    return { s, tx: W / 2, ty: H / 2 };
  }

  function drawNet(labels, ranked) {
    if (!canvas.clientWidth || !positions.length) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(canvas.clientWidth * dpr)) fitCanvas();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const { s, tx, ty } = frame();
    const maxDeg = Math.max(1, d3.max(degs));
    const muted = VK.cssVar("--text-muted"), surface = VK.cssVar("--surface-1");
    const accent = VK.cssVar("--accent");
    const cat = (l) => (slots.has(l) ? VK.cssVar(`--cat-${slots.get(l) + 1}`) : null);
    const radius = (i) => 1.8 + 4.7 * Math.sqrt(degs[i] / maxDeg);
    const P = positions.map(([x, y]) => [tx + s * x, ty + s * y]);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // links: cross-community gray, within-community in the community color
    const buckets = new Map(), cross = [], grayIn = [];
    for (const [a, b] of edges) {
      if (labels[a] !== labels[b]) { cross.push([a, b]); continue; }
      const c = cat(labels[a]);
      if (!c) { grayIn.push([a, b]); continue; }
      if (!buckets.has(c)) buckets.set(c, []);
      buckets.get(c).push([a, b]);
    }
    ctx.lineWidth = 0.8;
    const strokeAll = (es, color, alpha) => {
      ctx.strokeStyle = color; ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const [a, b] of es) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
      ctx.stroke();
    };
    strokeAll(cross, muted, 0.14);
    strokeAll(grayIn, muted, 0.3);
    for (const [c, es] of buckets) strokeAll(es, c, 0.3);
    ctx.globalAlpha = 1;

    // nodes: singletons faint, uncolored communities muted, colored on top
    const size = new Map();
    for (const l of labels) size.set(l, (size.get(l) || 0) + 1);
    const dot = (i, fill, alpha) => {
      ctx.beginPath(); ctx.arc(P[i][0], P[i][1], radius(i), 0, 2 * Math.PI);
      ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
    };
    for (let i = 0; i < n; i++) if (!cat(labels[i])) dot(i, muted, size.get(labels[i]) > 1 ? 0.6 : 0.35);
    for (let i = 0; i < n; i++) { const c = cat(labels[i]); if (c) dot(i, c, 1); }

    // the nodes that just moved: accent ring
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    for (const i of lastNodes) {
      ctx.beginPath(); ctx.arc(P[i][0], P[i][1], radius(i) + 3, 0, 2 * Math.PI); ctx.stroke();
    }

    // hubs of the colored communities: ring + name tag (screen space, crisp)
    ctx.font = "600 11.5px " + FONT;
    ctx.textBaseline = "middle";
    const placed = [];
    for (const l of ranked) {
      const members = [];
      for (let i = 0; i < n; i++) if (labels[i] === l) members.push(i);
      const h = hubOf(members);
      const c = cat(l);
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P[h][0], P[h][1], radius(h) + 2.5, 0, 2 * Math.PI); ctx.stroke();
      const label = shortName(names[h]);
      const tw = ctx.measureText(label).width;
      // try right, left, above, below of the hub; then slide down until free
      const r0 = radius(h) + 6, [hx, hy] = P[h];
      const cands = [[hx + r0, hy], [hx - r0 - tw, hy], [hx - tw / 2, hy - r0 - 6], [hx - tw / 2, hy + r0 + 6]];
      const free = (x, y) => x >= 2 && x + tw + 4 <= W && y >= 9 && y <= H - 9 &&
        placed.every(([px, py, pw]) => Math.abs(y - py) >= 17 || x >= px + pw + 6 || x + tw + 6 <= px);
      let lx = cands[0][0], ly = cands[0][1], ok = false;
      for (const [x, y] of cands) if (free(x, y)) { lx = x; ly = y; ok = true; break; }
      if (!ok) { lx = Math.min(Math.max(2, hx + r0), W - tw - 4); ly = hy; let guard = 0; while (!free(lx, ly) && guard++ < 30) ly += 17; }
      ly = Math.max(9, Math.min(H - 9, ly));
      ctx.fillStyle = surface; ctx.globalAlpha = 0.9;
      ctx.fillRect(lx - 3, ly - 8.5, tw + 6, 17);
      ctx.globalAlpha = 1;
      ctx.fillStyle = VK.cssVar("--text-primary");
      ctx.textAlign = "left";
      ctx.fillText(label, lx, ly);
      placed.push([lx, ly, tw]);
    }
    ctx.restore();
  }

  /* --- chart panel --- */

  function drawChart() {
    const c = VK.chart($("chart"), { margin: { top: 12, right: 18, bottom: 40, left: 46 } });
    const colors = VK.colors();
    const xMax = Math.max(420, (hist[hist.length - 1][0] || 0) + 20);
    const x = d3.scaleLinear().domain([0, xMax]).range([0, c.w]);
    const y = d3.scaleLinear().domain([-0.02, 0.45]).range([c.h, 0]);
    VK.axes(c, x, y, { xTicks: x.ticks(5), yTicks: [0, 0.1, 0.2, 0.3, 0.4], yFormat: (v) => v.toFixed(1), xTitle: "moves", yTitle: "Q" });

    // phase-2 markers (a label only where there is room — the last two
    // aggregations on Marvel are one move apart)
    let lastLabelX = -1e9;
    for (const m of aggAt) {
      c.plot.append("line").attr("class", "axisline")
        .attr("x1", x(m)).attr("x2", x(m)).attr("y1", 0).attr("y2", c.h)
        .attr("stroke-dasharray", "2 3");
      if (x(m) - lastLabelX < 48) continue;
      const right = x(m) > c.w - 50;
      c.plot.append("text").attr("class", "ticktext")
        .attr("x", x(m) + (right ? -3 : 3)).attr("y", 10).attr("text-anchor", right ? "end" : "start").text("phase 2");
      lastLabelX = x(m);
    }

    // the shuffle null
    c.plot.append("line").attr("x1", 0).attr("x2", c.w).attr("y1", y(NULL_Q)).attr("y2", y(NULL_Q))
      .attr("stroke", colors.s2).attr("stroke-width", 2).attr("stroke-dasharray", "6 4");
    VK.directLabel(c, c.w, y(NULL_Q) - 6, `degree-preserving shuffle: ${NULL_Q.toFixed(2)}`, "end");

    // Q after every move
    if (hist.length > 1) VK.line(c, hist, x, y, colors.s1);
    const [mx, my] = hist[hist.length - 1];
    VK.marker(c, x(mx), y(my), colors.s1);
    VK.directLabel(c, x(mx) + (x(mx) > c.w - 60 ? -8 : 8), y(my) + 4, `Q = ${my.toFixed(3)}`, x(mx) > c.w - 60 ? "end" : "start");
  }

  /* --- legend + readout --- */

  function drawLegend(labels, size, ranked) {
    const items = [];
    for (const l of ranked) {
      const members = [];
      for (let i = 0; i < n; i++) if (labels[i] === l) members.push(i);
      const h = hubOf(members);
      items.push(`<span class="key"><span class="swatch dot" style="background: var(--cat-${slots.get(l) + 1})"></span>${shortName(names[h])} &amp; co. (${size.get(l)})</span>`);
    }
    let other = 0, alone = 0;
    const colored = new Set(ranked);
    for (const l of labels) { if (colored.has(l)) continue; if (size.get(l) > 1) other++; else alone++; }
    if (other) items.push(`<span class="key"><span class="swatch dot" style="background: var(--text-muted); opacity: 0.6"></span>smaller communities (${other})</span>`);
    if (alone) items.push(`<span class="key"><span class="swatch dot" style="background: var(--text-muted); opacity: 0.35"></span>on their own (${alone})</span>`);
    $("legend").innerHTML = items.join("");
    $("chart-legend").innerHTML =
      `<span class="key"><span class="swatch" style="background: var(--series-1)"></span>Q after each move</span>` +
      `<span class="key"><span class="swatch dash" style="border-color: var(--series-2)"></span>degree-preserving shuffle</span>`;
  }

  function readout(size) {
    $("r-comm").textContent = size.size;
    $("r-q").textContent = st.Q().toFixed(3);
    $("r-moves").textContent = st.moves;
    const ph = st.phase;
    $("r-phase").textContent =
      ph === "move" ? `Phase 1 · sweep ${st.sweeps + 1} · level ${st.level + 1}` :
      ph === "converged" ? "Converged — aggregate" :
      `Done · ${aggCount} aggregation${aggCount === 1 ? "" : "s"}`;
    $("r-last").textContent = lastText;
    $("step").disabled = ph !== "move";
    $("sweep").disabled = ph !== "move";
    $("aggregate").disabled = ph === "done";
    $("play").disabled = ph === "done";
    $("step").classList.toggle("primary", ph === "move");
    $("aggregate").classList.toggle("primary", ph === "converged");
  }

  function render() {
    if (!st) return;
    const labels = st.labels();
    const { size, ranked } = assignSlots(labels);
    drawNet(labels, ranked);
    drawChart();
    drawLegend(labels, size, ranked);
    readout(size);
  }

  /* --- play --- */

  function tick() {
    if (st.phase === "move") stepOnce();
    else if (st.phase === "converged") aggregateOnce();
    if (st.phase === "done") stopPlay();
    render();
  }
  function startPlay() {
    if (st.phase === "done") return;
    timer = setInterval(tick, PLAY_MS);
    $("play").textContent = "Pause";
  }
  function stopPlay() {
    if (timer) clearInterval(timer);
    timer = null;
    $("play").textContent = "Play";
  }

  /* --- wiring --- */

  $("step").addEventListener("click", () => { stopPlay(); stepOnce(); render(); });
  $("sweep").addEventListener("click", () => { stopPlay(); sweepOnce(); render(); });
  $("aggregate").addEventListener("click", () => { stopPlay(); aggregateOnce(); render(); });
  $("play").addEventListener("click", () => (timer ? stopPlay() : startPlay()));
  $("reset").addEventListener("click", reset);
  window.addEventListener("resize", () => { if (st) { fitCanvas(); render(); } });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (st) render(); });

  fitCanvas();
})();
