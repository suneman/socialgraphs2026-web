/* The friendship paradox as a sampling machine: pick a random person,
   then a random friend of theirs, and tally both degrees. On a heavy-tailed
   network the friend wins almost every time — see why by watching WHO gets
   picked as a friend (hubs, over and over). */

"use strict";

(function () {
  const N = 300;
  const canvas = document.getElementById("net");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let kind = "ba";
  let g, degs, names = null, positions = [];
  let youDegs = [], friendDegs = [];
  let highlight = null; // {you, friend}
  let marvel = null;    // cached {graph, names} once loaded

  const CAP = () => (kind === "marvel" ? 40 : 30);

  function build() {
    names = null;
    if (kind === "marvel") {
      if (!marvel) {
        MV.load().then((data) => {
          const n = data.gcc.nodes.length;
          marvel = { graph: MV.toGraph(n, data.gcc.undirected), names: data.gcc.nodes.map((d) => d.name) };
          if (kind === "marvel") build();
        });
        return;
      }
      g = marvel.graph; names = marvel.names;
    } else {
      g = kind === "ba" ? GL.ba(N, 2) : GL.er(N, 4);
    }
    degs = GL.degrees(g);
    layout();
    resetTally();
  }

  // settle a force layout once, then keep it static (samples flash on top)
  function layout() {
    const nodes = d3.range(g.n).map((i) => ({ index: i }));
    const links = g.edges.map(([a, b]) => ({ source: a, target: b }));
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.index).distance(16).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-14))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.06))
      .force("y", d3.forceY().strength(0.06))
      .stop();
    sim.tick(200);
    positions = nodes.map((d) => [d.x, d.y]);
    drawNet();
  }

  /* --- sampling --- */

  function sampleOnce(show) {
    let you = Math.floor(Math.random() * g.n), guard = 0;
    while (degs[you] === 0 && guard++ < 500) you = Math.floor(Math.random() * g.n);
    if (degs[you] === 0) return;
    const friend = g.adj[you][Math.floor(Math.random() * degs[you])];
    youDegs.push(degs[you]);
    friendDegs.push(degs[friend]);
    if (show) { highlight = { you, friend }; drawNet(); }
  }

  function refresh() {
    $("r-n").textContent = youDegs.length.toLocaleString("en-US");
    $("r-you").textContent = youDegs.length ? GL.mean(youDegs).toFixed(1) : "–";
    $("r-fr").textContent = friendDegs.length ? GL.mean(friendDegs).toFixed(1) : "–";
    const wins = youDegs.filter((d, i) => friendDegs[i] >= d).length;
    $("r-pct").textContent = youDegs.length ? `${Math.round((100 * wins) / youDegs.length)}%` : "–";
    drawChart();
  }

  function resetTally() {
    youDegs = []; friendDegs = []; highlight = null;
    refresh(); drawNet();
  }

  /* --- network panel --- */

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function drawNet() {
    if (!canvas.clientWidth || !positions.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const maxDeg = Math.max(1, d3.max(degs));
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    const spread = Math.min(W, H) / 230;
    ctx.scale(spread, spread);

    ctx.strokeStyle = VK.cssVar("--grid");
    ctx.lineWidth = 0.8 / spread;
    ctx.beginPath();
    g.edges.forEach(([a, b]) => {
      ctx.moveTo(positions[a][0], positions[a][1]);
      ctx.lineTo(positions[b][0], positions[b][1]);
    });
    ctx.stroke();

    const muted = VK.cssVar("--text-muted");
    positions.forEach(([x, y], i) => {
      const r = 1.4 + 3.6 * Math.sqrt(degs[i] / maxDeg);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = muted;
      ctx.fill();
    });

    if (highlight) {
      const accent = VK.cssVar("--accent");
      const ink = VK.cssVar("--text-primary");
      const surface = VK.cssVar("--surface-1");
      const mark = (i, label) => {
        const [x, y] = positions[i];
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, 2 * Math.PI);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2 / spread;
        ctx.stroke();
        ctx.font = `600 ${12 / spread}px system-ui`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = surface;
        ctx.fillRect(x + 9, y - 12 / spread, tw + 6, 15 / spread);
        ctx.fillStyle = ink;
        ctx.fillText(label, x + 12, y);
      };
      const [xy, yy] = positions[highlight.you];
      const [xf, yf] = positions[highlight.friend];
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6 / spread;
      ctx.beginPath(); ctx.moveTo(xy, yy); ctx.lineTo(xf, yf); ctx.stroke();
      const who = (i) => (names ? names[i].replace(/ \(.*\)$/, "") : null);
      mark(highlight.you, names ? `you: ${who(highlight.you)}, k=${degs[highlight.you]}` : `person, k=${degs[highlight.you]}`);
      mark(highlight.friend, names ? `friend: ${who(highlight.friend)}, k=${degs[highlight.friend]}` : `friend, k=${degs[highlight.friend]}`);
    }
    ctx.restore();
  }

  /* --- chart panel: two sampled-degree distributions --- */

  function drawChart() {
    const c = VK.chart($("chart"));
    const colors = VK.colors();
    const cap = CAP();
    const total = youDegs.length || 1;

    const binify = (arr) => {
      const bins = new Array(cap + 1).fill(0);
      arr.forEach((k) => bins[Math.min(k, cap)]++);
      return bins.map((v, k) => [k, v / total]);
    };
    const youB = binify(youDegs), frB = binify(friendDegs);
    const yMax = Math.max(0.1, d3.max(youB.concat(frB), (d) => d[1]) * 1.15);

    const x = d3.scaleLinear().domain([0, cap]).range([0, c.w]);
    const y = d3.scaleLinear().domain([0, yMax]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: d3.range(0, cap + 1, 10),
      xFormat: (v) => (v === cap ? `${cap}+` : v),
      yTicks: y.ticks(4),
      yFormat: d3.format(".0%"),
      xTitle: "degree k of the sampled node", yTitle: "share of samples",
    });

    if (!youDegs.length) {
      VK.directLabel(c, c.w / 2, c.h / 2, "sample to fill this in", "middle")
        .attr("fill", VK.cssVar("--text-muted")).attr("font-weight", 400);
      return;
    }

    const step = d3.curveStepAfter;
    VK.line(c, youB, x, y, colors.s1, { curve: step });
    VK.line(c, frB, x, y, colors.s2, { curve: step });

    // direct labels at each distribution's peak (relief for the aqua series)
    const peak = (b) => b.reduce((best, d) => (d[1] > best[1] ? d : best));
    const py = peak(youB), pf = peak(frB);
    VK.directLabel(c, x(py[0]) + 6, y(py[1]) - 6, "random person");
    // the friend peak can sit in the capped last bin — label to its left then
    const atCap = pf[0] >= cap - 2;
    VK.directLabel(c, x(pf[0]) + (atCap ? -8 : 6), Math.max(10, y(pf[1]) - 6), "their friend", atCap ? "end" : "start");
  }

  /* --- wiring --- */

  document.querySelectorAll("#net-seg button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#net-seg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      kind = b.dataset.net;
      build();
    }));
  $("one").addEventListener("click", () => { sampleOnce(true); refresh(); });
  $("many").addEventListener("click", () => {
    for (let i = 0; i < 1000; i++) sampleOnce(false);
    highlight = null; drawNet(); refresh();
  });
  $("reset").addEventListener("click", resetTally);
  window.addEventListener("resize", () => { fitCanvas(); drawNet(); drawChart(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    drawNet(); drawChart();
  });

  fitCanvas();
  build();
})();
