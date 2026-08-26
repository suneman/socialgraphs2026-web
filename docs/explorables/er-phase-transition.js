/* The birth of the giant component — G(N, <k>) live, next to the
   analytic S(<k>) curve (S = 1 − e^(−<k>S)). */

"use strict";

(function () {
  const canvas = document.getElementById("net");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let N = +$("n").value;
  let K = +$("k").value;
  let g = null, gccSet = new Set(), simNodes = [], simLinks = [];

  const sim = d3.forceSimulation()
    .force("charge", d3.forceManyBody().strength(-14))
    .force("center", d3.forceCenter(0, 0))
    .force("x", d3.forceX().strength(0.06))
    .force("y", d3.forceY().strength(0.06))
    .on("tick", drawNet);

  function rebuild() {
    g = GL.er(N, K);
    gccSet = new Set(GL.gcc(g));

    // keep node positions across rebuilds so the layout doesn't jump
    while (simNodes.length < N) simNodes.push({});
    simNodes.length = N;
    simNodes.forEach((d, i) => (d.index = i));
    simLinks = g.edges.map(([a, b]) => ({ source: a, target: b }));

    sim.nodes(simNodes);
    sim.force("link", d3.forceLink(simLinks).id((d) => d.index).distance(18).strength(0.4));
    sim.alpha(0.9).restart();

    const comps = GL.components(g).members.length;
    $("r-gcc").textContent = `${Math.round((100 * gccSet.size) / N)}%`;
    $("r-comp").textContent = comps;
    $("r-links").textContent = g.edges.length;
    drawChart();
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
    const c = VK.colors();
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    const spread = Math.min(W, H) / 190;
    ctx.scale(spread, spread);

    ctx.strokeStyle = VK.cssVar("--baseline");
    ctx.lineWidth = 0.8 / spread;
    ctx.beginPath();
    simLinks.forEach((l) => {
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
    });
    ctx.stroke();

    const r = N > 250 ? 1.7 : 2.4;
    simNodes.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = gccSet.has(i) ? c.s1 : c.muted;
      ctx.fill();
    });
    ctx.restore();
  }

  /* --- chart panel --- */

  function drawChart() {
    const c = VK.chart($("chart"));
    const colors = VK.colors();
    const x = d3.scaleLinear().domain([0, 4]).range([0, c.w]);
    const y = d3.scaleLinear().domain([0, 1]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: [0, 1, 2, 3, 4], yTicks: [0, 0.5, 1],
      xTitle: "mean degree ⟨k⟩", yTitle: "share of nodes",
    });

    // critical point
    c.plot.append("line").attr("class", "gridline")
      .attr("x1", x(1)).attr("x2", x(1)).attr("y1", 0).attr("y2", c.h);
    VK.directLabel(c, x(1) + 5, 12, "⟨k⟩ = 1", "start")
      .attr("fill", VK.cssVar("--text-muted")).attr("font-weight", 400);

    const theory = d3.range(0, 4.001, 0.04).map((k) => [k, GL.erGiantFraction(k)]);
    VK.line(c, theory, x, y, colors.s1);

    const simS = gccSet.size / N;
    VK.marker(c, x(K), y(simS), colors.s2);
    VK.directLabel(c, x(K) + (K > 3 ? -10 : 10), y(simS) - 9,
      `${Math.round(simS * 100)}%`, K > 3 ? "end" : "start");
  }

  /* --- wiring --- */

  $("n").addEventListener("input", () => {
    N = +$("n").value; $("n-val").textContent = N; rebuild();
  });
  $("k").addEventListener("input", () => {
    K = +$("k").value; $("k-val").textContent = K.toFixed(2); rebuild();
  });
  $("regen").addEventListener("click", rebuild);
  window.addEventListener("resize", () => { fitCanvas(); drawChart(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    drawChart(); drawNet();
  });

  fitCanvas();
  $("k-val").textContent = K.toFixed(2);
  rebuild();
})();
