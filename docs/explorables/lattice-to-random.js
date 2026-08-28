/* How few shortcuts it takes. A ring lattice (N = 60, k = 4) on the left,
   the same lattice plus S random shortcuts on the right; every node is
   coloured by its BFS distance from a start node, so the "rings" of
   distance are visible: on the lattice they crawl around the ring, with a
   handful of shortcuts they collapse. Shortcuts come from one fixed random
   list (seeded), so the slider is monotone — shortcut 7 is always the same
   link. Distances exact via graphlib.bfsDistances. */

"use strict";

(function () {
  const N = 60, K = 4, MAXS = 30;
  const $ = (id) => document.getElementById(id);
  const cv = [$("net0"), $("net1")].map((c) => ({ canvas: c, ctx: c.getContext("2d") }));
  let S = 0, src = 0;
  let lattice, shortcuts = [];

  // deterministic shortcut list: distinct, non-lattice, non-self pairs
  function makeShortcuts() {
    let s = 2024 >>> 0;
    const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    const out = [], seen = new Set();
    while (out.length < MAXS) {
      const a = Math.floor(rnd() * N), b = Math.floor(rnd() * N);
      const d = Math.min((a - b + N) % N, (b - a + N) % N);
      if (a === b || d <= K / 2) continue;
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(k)) continue;
      seen.add(k); out.push([a, b]);
    }
    return out;
  }

  function withShortcuts(n) {
    const g = GL.clone(lattice);
    for (let i = 0; i < n; i++) g.edges.push([...shortcuts[i], 1]);
    for (let i = 0; i < n; i++) { const [a, b] = shortcuts[i]; g.adj[a].push(b); g.adj[b].push(a); }
    return g;
  }

  function fit() {
    for (const { canvas } of cv) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    }
  }

  // ordinal ramp for distance: accent for the start, then series-1 fading to the grid tone
  function rampColor(d, dMax) {
    if (d === 0) return VK.cssVar("--accent");
    const t = dMax > 1 ? (d - 1) / (dMax - 1) : 0;
    return d3.interpolateRgb(VK.cssVar("--series-1"), VK.cssVar("--grid"))(0.85 * t);
  }

  function drawOne(which, g, dist, dMax) {
    const { canvas, ctx } = cv[which];
    if (!canvas.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    // the legend can reflow the grid after boot — keep the backing store in step
    if (canvas.width !== Math.round(canvas.clientWidth * dpr) || canvas.height !== Math.round(canvas.clientHeight * dpr)) fit();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    const R = Math.min(W, H) / 2 - 14;
    const pos = (i) => { const a = (2 * Math.PI * i) / N - Math.PI / 2; return [R * Math.cos(a), R * Math.sin(a)]; };
    ctx.strokeStyle = VK.cssVar("--grid"); ctx.lineWidth = 1; ctx.beginPath();
    for (const [a, b, sc] of g.edges) if (!sc) { const [x1, y1] = pos(a), [x2, y2] = pos(b); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke();
    ctx.strokeStyle = VK.cssVar("--accent"); ctx.lineWidth = 1.6; ctx.beginPath();
    for (const [a, b, sc] of g.edges) if (sc) { const [x1, y1] = pos(a), [x2, y2] = pos(b); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke();
    for (let i = 0; i < N; i++) {
      const [x, y] = pos(i);
      ctx.beginPath(); ctx.arc(x, y, i === src ? 7 : 5, 0, 2 * Math.PI);
      ctx.fillStyle = rampColor(dist[i], dMax); ctx.fill();
      if (i === src) { ctx.strokeStyle = VK.cssVar("--accent"); ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.restore();
  }

  function legendHTML(dMax) {
    const items = [];
    for (let d = 0; d <= dMax; d++)
      items.push(`<span class="key"><span class="swatch dot" style="background:${rampColor(d, dMax)}"></span>${d === 0 ? "start" : d === dMax && dMax >= 6 ? `${d}+` : d}</span>`);
    return items.join("");
  }

  function draw() {
    const g1 = withShortcuts(S);
    const d0 = GL.bfsDistances(lattice, src), d1 = GL.bfsDistances(g1, src);
    const dMax = Math.max(...d0);
    drawOne(0, lattice, d0, dMax);
    drawOne(1, g1, d1, dMax);
    $("legend").innerHTML = legendHTML(dMax);
    $("legend1").innerHTML = "";
    $("title1").textContent = `Same lattice + ${S} shortcut${S === 1 ? "" : "s"}`;
    const mean = (d) => GL.mean(d.filter((v, i) => i !== src));
    $("r-d0").textContent = mean(d0).toFixed(2);
    $("r-m0").textContent = `${Math.max(...d0)} steps`;
    $("r-c0").textContent = GL.avgClustering(lattice).toFixed(3);
    $("r-d1").textContent = mean(d1).toFixed(2);
    $("r-m1").textContent = `${Math.max(...d1)} steps`;
    $("r-c1").textContent = GL.avgClustering(g1).toFixed(3);
  }

  function nodeAt(canvas, mx, my) {
    const W = canvas.clientWidth, H = canvas.clientHeight, R = Math.min(W, H) / 2 - 14;
    let best = null, bd = 12 * 12;
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * i) / N - Math.PI / 2;
      const dx = W / 2 + R * Math.cos(a) - mx, dy = H / 2 + R * Math.sin(a) - my;
      if (dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; }
    }
    return best;
  }
  for (const { canvas } of cv)
    canvas.addEventListener("click", (e) => {
      const r = canvas.getBoundingClientRect();
      const h = nodeAt(canvas, e.clientX - r.left, e.clientY - r.top);
      if (h !== null) { src = h; draw(); }
    });
  $("sc").addEventListener("input", () => { S = +$("sc").value; $("sc-val").textContent = S; draw(); });
  $("plus").addEventListener("click", () => { S = Math.min(MAXS, S + 1); $("sc").value = S; $("sc-val").textContent = S; draw(); });
  $("src").addEventListener("click", () => { src = Math.floor(Math.random() * N); draw(); });
  window.addEventListener("resize", () => { fit(); draw(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  lattice = GL.ringLattice(N, K);
  shortcuts = makeShortcuts();
  fit();
  draw();
})();
