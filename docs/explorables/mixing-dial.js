/* Mixing dial — the same degree sequence, three ways. The Marvel giant
   component sits in a live force layout; every rewiring step takes two
   links and reconnects their four endpoints so that the two highest-degree
   nodes pair up (assortative) or the highest pairs with the lowest
   (disassortative) — Xulvi-Brunet & Sokolov's rewiring — or at random
   (the week-2 shuffle). Degrees never change; only who links to whom.
   The chart follows the average neighbor degree k_nn(k) and the readout
   Newman's degree assortativity r. Everything is exact; the real
   network's r = −0.105 matches networkx to four decimals. */

"use strict";

// Pure helpers, node-requirable for the verification protocol.
const MX = (() => {
  // Newman's degree assortativity coefficient (Pearson r of degrees across links)
  function assortativity(g) {
    const d = GL.degrees(g);
    let sjk = 0, sj = 0, sjj = 0;
    for (const [a, b] of g.edges) {
      const j = d[a], k = d[b];
      sjk += j * k; sj += (j + k) / 2; sjj += (j * j + k * k) / 2;
    }
    const m = g.edges.length;
    const mu = sj / m;
    const den = sjj / m - mu * mu;
    return den > 0 ? (sjk / m - mu * mu) / den : 0;
  }

  // average neighbor degree per degree value: [[k, k_nn(k)], …] sorted by k
  function knn(g) {
    const d = GL.degrees(g);
    const sum = new Map(), cnt = new Map();
    for (let v = 0; v < g.n; v++) {
      if (!d[v]) continue;
      const mean = g.adj[v].reduce((s, w) => s + d[w], 0) / d[v];
      sum.set(d[v], (sum.get(d[v]) || 0) + mean);
      cnt.set(d[v], (cnt.get(d[v]) || 0) + 1);
    }
    return [...sum.keys()].sort((a, b) => a - b).map((k) => [k, sum.get(k) / cnt.get(k)]);
  }

  // the no-mixing reference: <k²>/<k> (a random neighbor's expected degree)
  function nullKnn(g) {
    const d = GL.degrees(g);
    let s1 = 0, s2 = 0;
    for (const k of d) { s1 += k; s2 += k * k; }
    return s2 / s1;
  }

  /* One batch of Xulvi-Brunet–Sokolov rewiring, in place. Pick two links
     a–b and c–d with four distinct endpoints, sort the four by degree, and
     reconnect: sign > 0 pairs the two lowest and the two highest
     (assortative); sign < 0 pairs lowest with highest and the middle two
     (disassortative). Rejected if either new link already exists. Degrees
     are untouched. Returns the number of accepted rewirings in `tries`. */
  function xbs(g, sign, tries, rnd = Math.random) {
    const E = g.edges, m = E.length, deg = GL.degrees(g);
    const has = (u, v) => g.adj[u].includes(v);
    const drop = (u, v) => { const a = g.adj[u], i = a.indexOf(v); a[i] = a[a.length - 1]; a.pop(); };
    let done = 0;
    for (let t = 0; t < tries; t++) {
      const i = Math.floor(rnd() * m), j = Math.floor(rnd() * m);
      if (i === j) continue;
      const [a, b] = E[i], [c, d] = E[j];
      if (a === c || a === d || b === c || b === d) continue;
      const s = [a, b, c, d].sort((u, v) => deg[u] - deg[v]);
      let p, q;
      if (sign > 0) { p = [s[0], s[1]]; q = [s[2], s[3]]; }
      else { p = [s[0], s[3]]; q = [s[1], s[2]]; }
      const same = (e, f) => (e[0] === f[0] && e[1] === f[1]) || (e[0] === f[1] && e[1] === f[0]);
      if ((same(p, E[i]) || same(p, E[j])) && (same(q, E[i]) || same(q, E[j]))) continue;
      if (has(p[0], p[1]) || has(q[0], q[1])) continue;
      drop(a, b); drop(b, a); drop(c, d); drop(d, c);
      g.adj[p[0]].push(p[1]); g.adj[p[1]].push(p[0]);
      g.adj[q[0]].push(q[1]); g.adj[q[1]].push(q[0]);
      E[i] = p; E[j] = q;
      done++;
    }
    return done;
  }

  return { assortativity, knn, nullKnn, xbs };
})();
if (typeof module !== "undefined") module.exports = MX;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const canvas = $("net");
  const ctx = canvas.getContext("2d");

  let nodes, real, g, degs, maxDeg;
  let realR = NaN, realKnn = [], nullLine = NaN;
  let mode = null, playing = false, swaps = 0, stalled = false;
  let sinceLast = 0;            // tries since the last accepted rewiring
  let lastR = NaN, flatFrames = 0; // frames in a row in which r barely moved
  let anim = null, sim = null, ns = [], links = [];
  const TRIES_PER_FRAME = 700, RANDOM_PER_FRAME = 120, STALL_AFTER = 40000;
  const FLAT_EPS = 2e-4, FLAT_FRAMES = 40; // r within 2e-4 for 40 frames = done
  let randomBudget = 0;

  const MODE_TEXT = {
    assort: "Every step reconnects two links so that <b>hubs pair with hubs</b> and leaves with leaves.",
    disassort: "Every step reconnects two links so that <b>hubs pair with leaves</b>.",
    random: "The week-2 shuffle: two links, four endpoints, reconnected at random.",
  };

  /* --- rewiring --- */

  function batch() {
    let done = 0;
    if (mode === "random") {
      const want = Math.min(RANDOM_PER_FRAME, randomBudget);
      done = GL.doubleEdgeSwap(g, want);
      randomBudget -= done;
      if (randomBudget <= 0) { stalled = true; }
    } else {
      done = MX.xbs(g, mode === "assort" ? 1 : -1, TRIES_PER_FRAME);
      sinceLast = done ? 0 : sinceLast + TRIES_PER_FRAME;
      // the ordered rewiring keeps accepting r-neutral moves forever (leaves pairing
      // with leaves), so "done" = r has stopped moving, not "no move accepted"
      const r = MX.assortativity(g);
      flatFrames = Math.abs(r - lastR) < FLAT_EPS ? flatFrames + 1 : 0;
      lastR = r;
      if (sinceLast >= STALL_AFTER || flatFrames >= FLAT_FRAMES) stalled = true;
    }
    swaps += done;
    if (done) syncLinks();
    return done;
  }

  function syncLinks() {
    g.edges.forEach(([a, b], i) => { links[i].source = ns[a]; links[i].target = ns[b]; });
    sim.force("link").links(links);
    sim.alpha(Math.max(sim.alpha(), 0.35)).restart();
  }

  function frame() {
    if (!playing) return;
    batch();
    drawChart(); drawTiles(); note();
    if (stalled) { stop(); note(); return; }
    anim = requestAnimationFrame(frame);
  }

  function play() {
    if (!mode || stalled) return;
    playing = true;
    $("play").textContent = "Pause";
    anim = requestAnimationFrame(frame);
  }

  function stop() {
    playing = false;
    if (anim) cancelAnimationFrame(anim);
    $("play").textContent = stalled ? "Done" : "Play";
  }

  function note() {
    const p = $("progress");
    if (!mode) { p.textContent = ""; return; }
    if (stalled) {
      p.textContent = mode === "random" ? `shuffled: ${swaps.toLocaleString("en-US")} swaps, 10 per link` : `stopped: no rewiring left that moves r further — as far as these degrees allow`;
    } else p.textContent = playing ? `rewiring… ${swaps.toLocaleString("en-US")} accepted` : swaps ? `${swaps.toLocaleString("en-US")} accepted` : "";
  }

  function reset() {
    stop();
    g = GL.clone(real);
    swaps = 0; stalled = false; sinceLast = 0; lastR = NaN; flatFrames = 0;
    randomBudget = 10 * real.edges.length;
    $("play").textContent = "Play";
    if (sim) syncLinks();
    $("net-sub").innerHTML = mode ? MODE_TEXT[mode] : "The real network. Pick a direction and press <b>Play</b>.";
    drawChart(); drawTiles(); note();
  }

  /* --- drawing: network (live force layout on canvas) --- */

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function startSim() {
    const W = canvas.clientWidth || 400, H = canvas.clientHeight || 340;
    ns = nodes.map((n, i) => ({ index: i }));
    links = g.edges.map(([a, b]) => ({ source: ns[a], target: ns[b] }));
    sim = d3.forceSimulation(ns)
      .force("link", d3.forceLink(links).distance(22).strength(0.25))
      .force("charge", d3.forceManyBody().strength(-42).distanceMax(220))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("x", d3.forceX(W / 2).strength(0.06))
      .force("y", d3.forceY(H / 2).strength(0.08))
      .force("collide", d3.forceCollide().radius((d) => 1.5 + 4 * Math.sqrt(degs[d.index] / maxDeg)))
      .alphaDecay(0.02)
      .on("tick", drawNet);
  }

  function drawNet() {
    if (!canvas.clientWidth || !ns.length) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(canvas.clientWidth * dpr) || canvas.height !== Math.round(canvas.clientHeight * dpr)) fitCanvas();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    // keep the picture inside the panel whatever the layout does
    const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = 10;
    const s = Math.min(1, (W - 2 * pad) / Math.max(1, x1 - x0), (H - 2 * pad) / Math.max(1, y1 - y0));
    const ox = W / 2 - s * (x0 + x1) / 2, oy = H / 2 - s * (y0 + y1) / 2;
    const P = ns.map((d) => [ox + s * d.x, oy + s * d.y]);

    ctx.lineWidth = 0.8; ctx.strokeStyle = VK.cssVar("--text-muted"); ctx.globalAlpha = 0.28;
    ctx.beginPath();
    for (const [a, b] of g.edges) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = VK.cssVar("--text-secondary");
    P.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + 4 * Math.sqrt(degs[i] / maxDeg), 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.restore();
  }

  /* --- drawing: k_nn chart --- */

  function drawChart() {
    const c = VK.chart($("chart"), { margin: { top: 14, right: 18, bottom: 40, left: 46 } });
    const colors = VK.colors();
    const cur = MX.knn(g);
    const x = d3.scaleLog().domain([1, maxDeg * 1.4]).range([0, c.w]);
    const y = d3.scaleLog().domain([1, 150]).range([c.h, 0]);
    VK.axes(c, x, y, {
      xTicks: [1, 10, 100], yTicks: [1, 10, 100],
      xTitle: "degree k (log)", yTitle: "kₙₙ(k) (log)",
    });
    c.plot.append("line").attr("x1", 0).attr("x2", c.w).attr("y1", y(nullLine)).attr("y2", y(nullLine))
      .attr("stroke", colors.s2).attr("stroke-width", 2).attr("stroke-dasharray", "5 4");
    c.plot.selectAll(".realdot").data(realKnn).join("circle").attr("class", "realdot")
      .attr("cx", (d) => x(d[0])).attr("cy", (d) => y(Math.max(1, d[1]))).attr("r", 3.4)
      .attr("fill", "none").attr("stroke", colors.muted).attr("stroke-width", 1.5);
    c.plot.selectAll(".curdot").data(cur).join("circle").attr("class", "curdot")
      .attr("cx", (d) => x(d[0])).attr("cy", (d) => y(Math.max(1, d[1]))).attr("r", 3.6)
      .attr("fill", colors.s1);
    $("sw-cur").style.background = colors.s1;
    $("sw-real").style.borderColor = colors.muted;
    $("sw-null").style.background = colors.s2;
  }

  function drawTiles() {
    const r = MX.assortativity(g);
    $("r-r").textContent = (r > 0 ? "+" : "") + r.toFixed(3);
    $("r-real").textContent = realR.toFixed(3);
    $("r-swaps").textContent = swaps.toLocaleString("en-US");
    $("r-gcc").textContent = `${GL.gcc(g).length} of ${g.n}`;
    $("r-c").textContent = GL.avgClustering(g).toFixed(3);
  }

  /* --- wiring --- */

  $("mode").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $("mode").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    mode = b.dataset.v;
    reset();
  });
  $("play").addEventListener("click", () => (playing ? stop() : play()));
  $("step").addEventListener("click", () => {
    if (!mode || stalled) return;
    stop();
    // one visible step: keep trying until a few rewirings land
    let got = 0;
    for (let i = 0; i < 20 && got < 5 && !stalled; i++) got += batch();
    drawChart(); drawTiles(); note();
  });
  $("reset").addEventListener("click", () => { reset(); });
  window.addEventListener("resize", () => { fitCanvas(); drawChart(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { drawChart(); drawNet(); });

  /* --- boot --- */

  MV.load().then((data) => {
    nodes = data.gcc.nodes;
    real = MV.toGraph(nodes.length, data.gcc.undirected);
    degs = GL.degrees(real);
    maxDeg = Math.max(...degs);
    realR = MX.assortativity(real);
    realKnn = MX.knn(real);
    nullLine = MX.nullKnn(real);
    $("net-title").textContent = `Marvel giant component — ${nodes.length} nodes keep their degree, ${real.edges.length.toLocaleString("en-US")} links move`;
    fitCanvas();
    g = GL.clone(real);
    startSim();
    reset();
    // ?mode=assort|disassort|random plays that mode on load (screenshot verification)
    const want = new URLSearchParams(location.search).get("mode");
    if (want && MODE_TEXT[want]) { $("mode").querySelector(`[data-v="${want}"]`).click(); play(); }
  }).catch(() => {
    canvas.outerHTML = '<p style="color: var(--text-muted)">Could not load the shared dataset — is the site running from its server?</p>';
  });
})();
