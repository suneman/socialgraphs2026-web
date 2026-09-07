/* Breadth-first search as a machine, on the real Marvel giant component
   (277 characters, docs/data/week1_*.tsv via marvel.js). Pick a start
   character; the wave of distances grows outward one ring per step. Nodes are
   colored by exact BFS distance on the same clipped-viridis ramp as the
   ring-lattice explorable (accent = the start node); the newest ring wears a
   surface-colored outline so the wavefront reads. Three link modes: any
   direction (undirected), follow arrows out (a page's own links), follow arrows
   in (pages linking to it) — the two directed modes use a local BFS on
   out-/in-adjacency built from the directed edge list; GL.bfsDistances is
   undirected only. The right panel counts the characters first reached at each
   step. On load the Spider-Man wave is shown complete so the frame is never
   empty; Reset winds it back to step 0. Exact numbers: see the verification
   note in the week-3 page source (networkx parity for all three modes). */

"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $("net"), ctx = canvas.getContext("2d");
  const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const STEP_MS = 700;

  let names = [], g = null, outAdj = [], inAdj = [], degs = [], positions = [];
  let mode = "any";          // any | out | in
  let src = 0;               // start node index
  let dist = [];             // full BFS distances from src in the current mode (-1 = unreachable)
  let rings = [];            // rings[d] = count of nodes at distance d
  let shown = 0;             // how many rings are revealed (0 = only the start)
  let dMax = 0;              // eccentricity within the reached set
  let timer = null;

  /* --- data + layout --- */

  MV.load().then((data) => {
    const n = data.gcc.nodes.length;
    names = data.gcc.nodes.map((d) => d.name);
    g = MV.toGraph(n, data.gcc.undirected);
    outAdj = Array.from({ length: n }, () => []);
    inAdj = Array.from({ length: n }, () => []);
    for (const [a, b] of data.gcc.directed) { outAdj[a].push(b); inAdj[b].push(a); }
    degs = GL.degrees(g);

    // the select, alphabetical
    const order = d3.range(n).sort((a, b) => names[a].localeCompare(names[b]));
    const sel = $("start");
    for (const i of order) {
      const o = document.createElement("option");
      o.value = i; o.textContent = names[i];
      sel.appendChild(o);
    }
    src = names.indexOf("Spider-Man");
    if (src < 0) src = order[0];
    sel.value = src;

    layout();
    compute();
    shown = dMax;            // complete wave on load
    render();
  });

  // settle a force layout once, then keep it static
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
  }

  /* --- BFS --- */

  function bfs(adj, s) {
    const d = new Array(adj.length).fill(-1);
    d[s] = 0;
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
      const v = q[qi];
      for (const w of adj[v]) if (d[w] === -1) { d[w] = d[v] + 1; q.push(w); }
    }
    return d;
  }

  function compute() {
    dist = mode === "any" ? GL.bfsDistances(g, src) : bfs(mode === "out" ? outAdj : inAdj, src);
    dMax = Math.max(...dist);
    rings = new Array(dMax + 1).fill(0);
    for (const d of dist) if (d >= 0) rings[d]++;
  }

  /* --- colors --- */

  function rampColor(d) {
    if (d === 0) return VK.cssVar("--accent");
    const t = dMax > 1 ? (d - 1) / (dMax - 1) : 0;
    return d3.interpolateViridis(0.12 + 0.80 * t);
  }

  /* --- network panel --- */

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  // canvas transform shared by drawing and hit-testing
  function frame() {
    const W = canvas.clientWidth, H = canvas.clientHeight, pad = 12;
    const x0 = d3.min(positions, (p) => p[0]), x1 = d3.max(positions, (p) => p[0]);
    const y0 = d3.min(positions, (p) => p[1]), y1 = d3.max(positions, (p) => p[1]);
    const s = Math.min((W - 2 * pad) / Math.max(1, x1 - x0), (H - 2 * pad) / Math.max(1, y1 - y0));
    return { s, tx: W / 2 - s * (x0 + x1) / 2, ty: H / 2 - s * (y0 + y1) / 2 };
  }

  function drawNet() {
    if (!canvas.clientWidth || !positions.length) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(canvas.clientWidth * dpr)) fitCanvas();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const { s, tx, ty } = frame();
    const maxDeg = Math.max(1, d3.max(degs));
    const muted = VK.cssVar("--text-muted"), surface = VK.cssVar("--surface-1");

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tx, ty);
    ctx.scale(s, s);

    // links: the undirected picture in every mode (direction is in the coloring)
    ctx.strokeStyle = VK.cssVar("--grid");
    ctx.lineWidth = 0.8 / s;
    ctx.beginPath();
    for (const [a, b] of g.edges) {
      ctx.moveTo(positions[a][0], positions[a][1]);
      ctx.lineTo(positions[b][0], positions[b][1]);
    }
    ctx.stroke();

    const radius = (i) => (1.8 + 4.7 * Math.sqrt(degs[i] / maxDeg)) / s;

    // unreached first (dim), then reached rings, newest ring outlined, start on top
    for (let i = 0; i < g.n; i++) {
      const d = dist[i];
      if (d === 0 || (d > 0 && d <= shown)) continue;
      ctx.beginPath(); ctx.arc(positions[i][0], positions[i][1], radius(i), 0, 2 * Math.PI);
      ctx.globalAlpha = 0.28; ctx.fillStyle = muted; ctx.fill(); ctx.globalAlpha = 1;
    }
    for (let d = 1; d <= shown; d++) {
      ctx.fillStyle = rampColor(d);
      for (let i = 0; i < g.n; i++) {
        if (dist[i] !== d) continue;
        ctx.beginPath(); ctx.arc(positions[i][0], positions[i][1], radius(i), 0, 2 * Math.PI);
        ctx.fill();
        if (d === shown) { ctx.lineWidth = 2 / s; ctx.strokeStyle = surface; ctx.stroke(); }
      }
    }
    // start node: accent, larger, with a name tag
    const [sx, sy] = positions[src];
    const r0 = radius(src) + 3 / s;
    ctx.beginPath(); ctx.arc(sx, sy, r0, 0, 2 * Math.PI);
    ctx.fillStyle = VK.cssVar("--accent"); ctx.fill();
    ctx.lineWidth = 2 / s; ctx.strokeStyle = surface; ctx.stroke();
    ctx.restore();

    // name tag in screen space so the text stays crisp
    ctx.save();
    ctx.scale(dpr, dpr);
    const px = tx + s * sx, py = ty + s * sy;
    const label = shortName(names[src]);
    ctx.font = "600 12px " + FONT;
    const tw = ctx.measureText(label).width;
    const lx = px + 10 + tw + 6 > W ? px - 10 - tw - 6 : px + 10;
    ctx.fillStyle = surface;
    ctx.fillRect(lx - 3, py - 9, tw + 6, 17);
    ctx.fillStyle = VK.cssVar("--text-primary");
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText(label, lx, py);
    ctx.restore();
  }

  function shortName(s) { return s.replace(/ \(.*\)$/, ""); }

  function nodeAt(mx, my) {
    const { s, tx, ty } = frame();
    let best = null, bd = 10 * 10;
    for (let i = 0; i < g.n; i++) {
      const dx = tx + s * positions[i][0] - mx, dy = ty + s * positions[i][1] - my;
      const dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  /* --- chart panel --- */

  function drawChart() {
    const c = VK.chart($("chart"), { margin: { top: 22, right: 16, bottom: 40, left: 46 } });
    const colors = VK.colors();
    const steps = d3.range(1, dMax + 1);
    const yMax = Math.max(10, d3.max(rings.slice(1)) * 1.12);
    const x = d3.scaleBand().domain(steps).range([0, c.w]).padding(0.28);
    const y = d3.scaleLinear().domain([0, yMax]).range([c.h, 0]);
    VK.axes(c, (v) => x(v) + x.bandwidth() / 2, y, {
      xTicks: steps, yTicks: y.ticks(4),
      xTitle: `steps from ${shortName(names[src])}`, yTitle: "characters",
    });
    c.plot.selectAll(".bar").data(steps.filter((d) => d <= shown)).join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d)).attr("width", x.bandwidth())
      .attr("y", (d) => y(rings[d])).attr("height", (d) => c.h - y(rings[d]))
      .attr("rx", 2)
      .attr("fill", colors.s1);
    for (const d of steps) {
      if (d > shown) continue;
      VK.directLabel(c, x(d) + x.bandwidth() / 2, y(rings[d]) - 6, rings[d], "middle");
    }
    if (shown === 0)
      VK.directLabel(c, c.w / 2, c.h / 2, "press Step to send the wave out", "middle")
        .attr("fill", VK.cssVar("--text-muted")).attr("font-weight", 400);
  }

  /* --- legend + readout --- */

  function drawLegend() {
    const items = [`<span class="key"><span class="swatch dot" style="background:${rampColor(0)}"></span>start</span>`];
    for (let d = 1; d <= shown; d++)
      items.push(`<span class="key"><span class="swatch dot" style="background:${rampColor(d)}"></span>${d}</span>`);
    const unreached = dist.filter((d) => d === -1).length;
    if (shown < dMax || unreached)
      items.push(`<span class="key"><span class="swatch dot" style="background:${VK.cssVar("--text-muted")}; opacity: 0.4"></span>${shown < dMax ? "not reached yet" : "unreachable"}</span>`);
    $("legend").innerHTML = items.join("");
  }

  function readout() {
    const total = g.n - 1;
    let reached = 0, sum = 0;
    for (let d = 1; d <= shown; d++) { reached += rings[d]; sum += d * rings[d]; }
    const unreach = dist.filter((d) => d === -1).length;
    $("r-reached").textContent = `${reached} of ${total}`;
    $("r-far").textContent = shown >= dMax ? `${dMax} steps` : "–";
    $("r-mean").textContent = reached ? (sum / reached).toFixed(2) : "–";
    $("r-unreach").textContent = shown >= dMax ? `${unreach}` : "–";
    $("step").disabled = shown >= dMax;
  }

  function render() { drawNet(); drawChart(); drawLegend(); readout(); }

  /* --- stepping --- */

  function stepOnce() {
    if (shown < dMax) { shown++; render(); }
    if (shown >= dMax) stopPlay();
  }
  function startPlay() {
    if (shown >= dMax) { shown = 0; render(); }
    timer = setInterval(stepOnce, STEP_MS);
    $("play").textContent = "Pause";
  }
  function stopPlay() {
    if (timer) clearInterval(timer);
    timer = null;
    $("play").textContent = "Play";
  }
  function restart(fromZero) {
    stopPlay();
    compute();
    shown = fromZero ? 0 : dMax;
    render();
  }

  /* --- wiring --- */

  $("start").addEventListener("change", (e) => { src = +e.target.value; restart(false); });
  document.querySelectorAll("#mode-seg button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#mode-seg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      mode = b.dataset.mode;
      restart(false);
    }));
  $("step").addEventListener("click", () => { stopPlay(); stepOnce(); });
  $("play").addEventListener("click", () => (timer ? stopPlay() : startPlay()));
  $("reset").addEventListener("click", () => restart(true));
  canvas.addEventListener("click", (e) => {
    if (!g) return;
    const r = canvas.getBoundingClientRect();
    const h = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (h !== null) { src = h; $("start").value = h; restart(false); }
  });
  window.addEventListener("resize", () => { if (g) { fitCanvas(); render(); } });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (g) render(); });

  fitCanvas();
})();
