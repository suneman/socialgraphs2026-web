/* Small worlds — the Watts–Strogatz model. A ring lattice with shortcuts,
   next to the classic C(p)/C(0), L(p)/L(0) curves (computed exactly,
   averaged over a few realizations, in a background sweep on load). */

"use strict";

(function () {
  const NN = 200, KK = 6, RUNS = 5;
  const canvas = document.getElementById("net");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let logp = +$("logp").value;
  let g = null;
  let C0 = null, L0 = null;       // p = 0 baselines
  let curve = [];                  // [{p, C, L}] averaged sweep

  /* --- current network --- */

  function p() { return Math.pow(10, logp); }

  function rebuild() {
    g = GL.wattsStrogatz(NN, KK, p());
    const C = GL.avgClustering(g);
    const L = GL.avgPathLength(g);
    $("r-c").textContent = C.toFixed(3);
    $("r-l").textContent = L.toFixed(2);
    $("r-sc").textContent = g.edges.filter((e) => e[2]).length;
    drawNet();
    drawChart();
  }

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function drawNet() {
    if (!canvas.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    const R = Math.min(W, H) / 2 - 12;
    const pos = (i) => {
      const a = (2 * Math.PI * i) / NN - Math.PI / 2;
      return [R * Math.cos(a), R * Math.sin(a)];
    };

    // lattice edges: recessive; shortcuts: accent, drawn on top
    ctx.strokeStyle = VK.cssVar("--grid");
    ctx.lineWidth = 1;
    ctx.beginPath();
    g.edges.forEach(([a, b, rw]) => {
      if (rw) return;
      const [x1, y1] = pos(a), [x2, y2] = pos(b);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    });
    ctx.stroke();

    ctx.strokeStyle = VK.cssVar("--accent");
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    g.edges.forEach(([a, b, rw]) => {
      if (!rw) return;
      const [x1, y1] = pos(a), [x2, y2] = pos(b);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    });
    ctx.stroke();

    ctx.fillStyle = VK.cssVar("--text-muted");
    for (let i = 0; i < NN; i++) {
      const [x, y] = pos(i);
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  /* --- background sweep for the reference curves --- */

  const P_SWEEP = d3.range(-4, 0.001, 0.25).map((e) => Math.pow(10, e));

  function runSweep() {
    const lattice = GL.ringLattice(NN, KK);
    C0 = GL.avgClustering(lattice);
    L0 = GL.avgPathLength(lattice);

    const jobs = [];
    P_SWEEP.forEach((pv) => { for (let r = 0; r < RUNS; r++) jobs.push(pv); });
    const acc = new Map(P_SWEEP.map((pv) => [pv, { C: 0, L: 0, n: 0 }]));
    let idx = 0;

    function step() {
      const t0 = performance.now();
      while (idx < jobs.length && performance.now() - t0 < 40) {
        const pv = jobs[idx++];
        const gg = GL.wattsStrogatz(NN, KK, pv);
        const a = acc.get(pv);
        a.C += GL.avgClustering(gg);
        a.L += GL.avgPathLength(gg);
        a.n++;
      }
      curve = P_SWEEP.filter((pv) => acc.get(pv).n > 0).map((pv) => {
        const a = acc.get(pv);
        return { p: pv, C: a.C / a.n, L: a.L / a.n };
      });
      drawChart();
      if (idx < jobs.length) {
        $("progress").textContent = `computing reference curves… ${Math.round((100 * idx) / jobs.length)}%`;
        requestAnimationFrame(step);
      } else {
        $("progress").textContent = "";
      }
    }
    requestAnimationFrame(step);
  }

  /* --- chart --- */

  function drawChart() {
    const c = VK.chart($("chart"));
    const colors = VK.colors();
    const x = d3.scaleLog().domain([1e-4, 1]).range([0, c.w]);
    const y = d3.scaleLinear().domain([0, 1.05]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: [1e-4, 1e-3, 1e-2, 1e-1, 1],
      yTicks: [0, 0.5, 1],
      xFormat: (v) => (v >= 0.1 ? v : `10${sup(Math.round(Math.log10(v)))}`),
      xTitle: "rewiring probability p (log)",
      yTitle: "relative to lattice",
    });

    if (curve.length > 1 && C0) {
      const cPts = curve.map((d) => [d.p, d.C / C0]);
      const lPts = curve.map((d) => [d.p, d.L / L0]);
      VK.line(c, cPts, x, y, colors.s2);
      VK.line(c, lPts, x, y, colors.s1);
      // direct labels where the curves separate (mid-plot)
      const mid = curve[Math.floor(curve.length / 2)];
      VK.directLabel(c, x(mid.p), y(mid.C / C0) - 8, "clustering", "middle");
      VK.directLabel(c, x(mid.p), y(mid.L / L0) + 16, "distance", "middle");
    }

    // current p marker
    if (C0 && g) {
      c.plot.append("line").attr("class", "gridline")
        .attr("x1", x(p())).attr("x2", x(p())).attr("y1", 0).attr("y2", c.h);
      const C = GL.avgClustering(g), L = GL.avgPathLength(g);
      VK.marker(c, x(p()), y(C / C0), colors.s2, 4);
      VK.marker(c, x(p()), y(L / L0), colors.s1, 4);
    }
  }

  function sup(e) {
    const map = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴" };
    return String(e).split("").map((ch) => map[ch] || ch).join("");
  }

  /* --- wiring --- */

  let debounce = null;
  $("logp").addEventListener("input", () => {
    logp = +$("logp").value;
    $("p-val").textContent = p().toFixed(p() < 0.01 ? 4 : 3);
    clearTimeout(debounce);
    debounce = setTimeout(rebuild, 60);
  });
  $("resample").addEventListener("click", rebuild);
  window.addEventListener("resize", () => { fitCanvas(); drawNet(); drawChart(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    drawNet(); drawChart();
  });

  fitCanvas();
  $("p-val").textContent = p().toFixed(3);
  rebuild();
  runSweep();
})();
