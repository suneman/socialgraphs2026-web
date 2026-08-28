/* Rich get richer — watch a Barabási–Albert network grow node by node,
   while its degree distribution develops a heavy tail on log–log axes.
   Two experiments bolted on: kill the preference (uniform attachment, same
   growth) or kill the growth (all nodes present from the start, links added
   preferentially) — and a first-mover view that tracks an early and a late
   node's degree over time. */

"use strict";

(function () {
  const N_MAX = 250;
  const canvas = document.getElementById("net");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let m = 2, mode = "pa", view = "ccdf";
  let stepper, simNodes, simLinks, newest = -1;
  let playing = false, lastAdd = 0;
  let steps = 0, track = [];          // first-mover: [{t, early, late}]
  const EARLY = 5, LATE = 125;

  // Uniform attachment: same growth as BA, but the newcomer picks m
  // existing nodes uniformly at random — no preference at all.
  function uniformStepper(m) {
    const g = GL.empty(0);
    const seed = m + 1;
    for (let i = 0; i < seed; i++) { g.adj.push([]); g.n++; }
    for (let i = 0; i < seed; i++) for (let j = i + 1; j < seed; j++) GL.addEdge(g, i, j);
    return {
      graph: g,
      addNode() {
        const id = g.n;
        g.adj.push([]); g.n++;
        const chosen = new Set();
        while (chosen.size < Math.min(m, id)) chosen.add(Math.floor(Math.random() * id));
        chosen.forEach((t) => GL.addEdge(g, id, t));
        return id;
      },
    };
  }

  // No growth: all N_MAX nodes exist from the start; each step a random node
  // makes m links, choosing targets with probability ∝ (k + 1) — preference
  // without arrivals (Barabási's "model B"). Returns the node that linked.
  function staticStepper(m) {
    const g = GL.empty(N_MAX);
    return {
      graph: g,
      addNode() {
        const u = Math.floor(Math.random() * N_MAX);
        const degs = GL.degrees(g);
        let total = 0;
        for (let i = 0; i < N_MAX; i++) if (i !== u && !GL.hasEdge(g, u, i)) total += degs[i] + 1;
        let made = 0, guard = 0;
        while (made < m && guard++ < 50 && total > 0) {
          let r = Math.random() * total, pick = -1;
          for (let i = 0; i < N_MAX; i++) {
            if (i === u || GL.hasEdge(g, u, i)) continue;
            r -= degs[i] + 1;
            if (r <= 0) { pick = i; break; }
          }
          if (pick < 0) break;
          GL.addEdge(g, u, pick);
          total -= degs[pick] + 1;
          made++;
        }
        return u;
      },
    };
  }

  function makeStepper() {
    return mode === "pa" ? GL.baStepper(m) : mode === "uniform" ? uniformStepper(m) : staticStepper(m);
  }

  function recordTrack() {
    const g = stepper.graph;
    const t = mode === "static" ? steps : g.n;
    track.push({ t, early: g.adj[EARLY] ? g.adj[EARLY].length : NaN, late: g.adj[LATE] ? g.adj[LATE].length : NaN });
  }

  const sim = d3.forceSimulation()
    .force("charge", d3.forceManyBody().strength(-16))
    .force("center", d3.forceCenter(0, 0))
    .force("x", d3.forceX().strength(0.05))
    .force("y", d3.forceY().strength(0.05))
    .on("tick", drawNet);

  function reset() {
    stepper = makeStepper();
    const g = stepper.graph;
    simNodes = d3.range(g.n).map((i) => ({ index: i, x: 80 * (Math.random() - 0.5), y: 80 * (Math.random() - 0.5) }));
    simLinks = g.edges.map(([a, b]) => ({ source: a, target: b }));
    newest = -1; steps = 0; track = [];
    // pre-grow a little so both panels have something to say on load
    const pre = mode === "static" ? 0 : 40;
    for (let i = 0; i < pre; i++) {
      const before = g.edges.length;
      const id = stepper.addNode();
      simNodes.push({ index: id, x: 12 * (Math.random() - 0.5), y: 12 * (Math.random() - 0.5) });
      for (let e = before; e < g.edges.length; e++)
        simLinks.push({ source: g.edges[e][0], target: g.edges[e][1] });
      recordTrack();
    }
    $("net-title").textContent = mode === "pa" ? "Preferential attachment — newest node in color"
      : mode === "uniform" ? "Uniform attachment (growth, no preference) — newest node in color"
      : "No growth — all nodes present, links added with preference; latest linker in color";
    $("l-n").textContent = mode === "static" ? "Steps (of 250)" : "Nodes";
    $("play").textContent = "▶ Grow";
    syncSim();
    updateStats();
    drawChart();
  }

  function done() { return mode === "static" ? steps >= N_MAX : stepper.graph.n >= N_MAX; }

  function syncSim() {
    sim.nodes(simNodes);
    sim.force("link", d3.forceLink(simLinks).id((d) => d.index).distance(16).strength(0.5));
    sim.alpha(0.6).restart();
  }

  function addNode() {
    const g = stepper.graph;
    if (done()) { setPlaying(false); return; }
    const before = g.edges.length;
    const id = stepper.addNode();
    steps++;
    if (mode !== "static") {
      // drop the new node near an attachment target so it flies in naturally
      const anchor = simNodes[g.edges[before][1]] || { x: 0, y: 0 };
      simNodes.push({ index: id, x: anchor.x + 8 * (Math.random() - 0.5), y: anchor.y + 8 * (Math.random() - 0.5) });
    }
    for (let e = before; e < g.edges.length; e++)
      simLinks.push({ source: g.edges[e][0], target: g.edges[e][1] });
    newest = id;
    recordTrack();
    syncSim();
    updateStats();
    drawChart();
  }

  function updateStats() {
    const g = stepper.graph;
    const degs = GL.degrees(g);
    $("r-n").textContent = mode === "static" ? steps : g.n;
    $("r-m").textContent = g.edges.length;
    $("r-hub").textContent = `k = ${d3.max(degs)}`;
    $("r-med").textContent = `k = ${d3.median(degs)}`;
  }

  /* --- network panel --- */

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function drawNet() {
    if (!canvas.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const g = stepper.graph;
    const degs = GL.degrees(g);
    const maxDeg = Math.max(1, d3.max(degs));
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    const spread = Math.min(W, H) / 210;
    ctx.scale(spread, spread);

    ctx.strokeStyle = VK.cssVar("--baseline");
    ctx.lineWidth = 0.7 / spread;
    ctx.beginPath();
    simLinks.forEach((l) => {
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
    });
    ctx.stroke();

    const accent = VK.cssVar("--accent");
    const muted = VK.cssVar("--text-muted");
    simNodes.forEach((d, i) => {
      const r = 1.6 + 4.5 * Math.sqrt(degs[i] / maxDeg);
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = i === newest ? accent : muted;
      ctx.fill();
    });
    ctx.restore();
  }

  /* --- chart panel --- */

  function drawChart() {
    if (view === "track") { drawTrack(); return; }
    $("chart-title").textContent = "Degree distribution (CCDF, log–log)";
    $("legend").innerHTML = '<span class="key"><span class="swatch dot" style="background: var(--series-1)"></span>P(K ≥ k) for this network</span>' +
      '<span class="key"><span class="swatch" style="background: var(--baseline)"></span>k⁻² guide (what γ = 3 predicts)</span>';
    const c = VK.chart($("chart"));
    const colors = VK.colors();
    const degs = GL.degrees(stepper.graph);
    const pts = GL.ccdf(degs);
    const kMax = Math.max(10, d3.max(degs));

    const x = d3.scaleLog().domain([1, kMax * 1.3]).range([0, c.w]);
    const y = d3.scaleLog().domain([1 / degs.length / 1.5, 1]).range([c.h, 0]);
    const logTicks = (lo, hi) => d3.range(Math.ceil(Math.log10(lo)), Math.floor(Math.log10(hi)) + 1)
      .map((e) => Math.pow(10, e));
    VK.axes(c, x, y, {
      xTicks: logTicks(1, kMax * 1.3),
      yTicks: logTicks(1 / degs.length / 1.5, 1),
      xFormat: d3.format("~s"),
      yFormat: (v) => (v >= 1 ? "1" : d3.format(".0e")(v).replace("e-", "e−")),
      xTitle: "degree k (log)", yTitle: "P(K ≥ k) (log)",
    });

    // theory guide through (m, 1): P(K ≥ k) = (m/k)²
    const guide = [[m, 1], [kMax, Math.pow(m / kMax, 2)]];
    c.plot.append("path")
      .attr("d", d3.line().x((d) => x(d[0])).y((d) => y(Math.max(d[1], y.domain()[0])))(guide))
      .attr("fill", "none").attr("stroke", VK.cssVar("--baseline")).attr("stroke-width", 1);

    pts.forEach((d) => VK.marker(c, x(d.k), y(d.p), colors.s1, 4));
  }

  // first-mover view: degree of an early and a late node as the network grows
  function drawTrack() {
    $("chart-title").textContent = mode === "static" ? "Two nodes' degree over the steps" : "Two nodes' degree as the network grows";
    $("legend").innerHTML = `<span class="key"><span class="swatch" style="background: var(--series-1)"></span>node #${EARLY} (${mode === "static" ? "a random node" : "arrived early"})</span>` +
      `<span class="key"><span class="swatch" style="background: var(--series-2)"></span>node #${LATE} (${mode === "static" ? "another random node" : "arrived late"})</span>`;
    const c = VK.chart($("chart"));
    const colors = VK.colors();
    const early = track.filter((d) => !Number.isNaN(d.early)).map((d) => [d.t, d.early]);
    const late = track.filter((d) => !Number.isNaN(d.late)).map((d) => [d.t, d.late]);
    const yMax = Math.max(6, d3.max(early.concat(late), (d) => d[1]) || 0) * 1.15;
    const x = d3.scaleLinear().domain([0, N_MAX]).range([0, c.w]);
    const y = d3.scaleLinear().domain([0, yMax]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: [0, 50, 100, 150, 200, 250], yTicks: y.ticks(5),
      xTitle: mode === "static" ? "step" : "network size n", yTitle: "degree",
    });
    if (early.length > 1) VK.line(c, early, x, y, colors.s1);
    if (late.length > 1) VK.line(c, late, x, y, colors.s2);
    if (early.length) VK.directLabel(c, x(early[early.length - 1][0]) + 6, y(early[early.length - 1][1]) + 4, `#${EARLY}`);
    if (late.length) VK.directLabel(c, x(late[late.length - 1][0]) + 6, y(late[late.length - 1][1]) + 4, `#${LATE}`);
    if (mode !== "static" && !late.length)
      VK.directLabel(c, x(LATE), c.h - 8, `node #${LATE} arrives here →`, "end").attr("font-weight", 400);
  }

  /* --- play loop --- */

  function setPlaying(on) {
    playing = on && !done();
    $("play").textContent = playing ? "⏸ Pause" : "▶ Grow";
    if (playing) requestAnimationFrame(loop);
  }

  function loop(t) {
    if (!playing) return;
    const interval = 620 - 60 * +$("speed").value; // speed 1 → slow, 10 → fast
    if (t - lastAdd > interval) { addNode(); lastAdd = t; }
    if (done()) setPlaying(false);
    else requestAnimationFrame(loop);
  }

  /* --- wiring --- */

  document.querySelectorAll("#m-seg button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#m-seg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      m = +b.dataset.m;
      reset();
    }));
  document.querySelectorAll("#mode-seg button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#mode-seg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      mode = b.dataset.v;
      setPlaying(false); reset();
    }));
  document.querySelectorAll("#view-seg button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-seg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      view = b.dataset.v;
      drawChart();
    }));
  $("play").addEventListener("click", () => setPlaying(!playing));
  $("step").addEventListener("click", () => { for (let i = 0; i < 10; i++) addNode(); });
  $("reset").addEventListener("click", () => { setPlaying(false); reset(); });
  window.addEventListener("resize", () => { fitCanvas(); drawChart(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    drawChart(); drawNet();
  });

  fitCanvas();
  reset();
})();
