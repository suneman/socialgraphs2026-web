/* Rich get richer — watch a Barabási–Albert network grow node by node,
   while its degree distribution develops a heavy tail on log–log axes. */

"use strict";

(function () {
  const N_MAX = 250;
  const canvas = document.getElementById("net");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let m = 2;
  let stepper, simNodes, simLinks, newest = -1;
  let playing = false, lastAdd = 0;

  const sim = d3.forceSimulation()
    .force("charge", d3.forceManyBody().strength(-16))
    .force("center", d3.forceCenter(0, 0))
    .force("x", d3.forceX().strength(0.05))
    .force("y", d3.forceY().strength(0.05))
    .on("tick", drawNet);

  function reset() {
    stepper = GL.baStepper(m);
    const g = stepper.graph;
    simNodes = d3.range(g.n).map((i) => ({ index: i }));
    simLinks = g.edges.map(([a, b]) => ({ source: a, target: b }));
    newest = -1;
    // pre-grow a little so both panels have something to say on load
    for (let i = 0; i < 40; i++) {
      const before = g.edges.length;
      const id = stepper.addNode();
      simNodes.push({ index: id, x: 12 * (Math.random() - 0.5), y: 12 * (Math.random() - 0.5) });
      for (let e = before; e < g.edges.length; e++)
        simLinks.push({ source: g.edges[e][0], target: g.edges[e][1] });
    }
    syncSim();
    updateStats();
    drawChart();
  }

  function syncSim() {
    sim.nodes(simNodes);
    sim.force("link", d3.forceLink(simLinks).id((d) => d.index).distance(16).strength(0.5));
    sim.alpha(0.6).restart();
  }

  function addNode() {
    const g = stepper.graph;
    if (g.n >= N_MAX) { setPlaying(false); return; }
    const before = g.edges.length;
    const id = stepper.addNode();
    // drop the new node near an attachment target so it flies in naturally
    const anchor = simNodes[g.edges[before][1]] || { x: 0, y: 0 };
    simNodes.push({ index: id, x: anchor.x + 8 * (Math.random() - 0.5), y: anchor.y + 8 * (Math.random() - 0.5) });
    for (let e = before; e < g.edges.length; e++)
      simLinks.push({ source: g.edges[e][0], target: g.edges[e][1] });
    newest = id;
    syncSim();
    updateStats();
    drawChart();
  }

  function updateStats() {
    const g = stepper.graph;
    const degs = GL.degrees(g);
    $("r-n").textContent = g.n;
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

  /* --- play loop --- */

  function setPlaying(on) {
    playing = on && stepper.graph.n < N_MAX;
    $("play").textContent = playing ? "⏸ Pause" : "▶ Grow";
    if (playing) requestAnimationFrame(loop);
  }

  function loop(t) {
    if (!playing) return;
    const interval = 620 - 60 * +$("speed").value; // speed 1 → slow, 10 → fast
    if (t - lastAdd > interval) { addNode(); lastAdd = t; }
    if (stepper.graph.n >= N_MAX) setPlaying(false);
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
