/* The ring lattice, as a picture. N = 100 nodes on a circle, each linked to
   its three nearest neighbors on either side (k = 6), so the chords make the
   clustering visible as a dense band along the rim. Every node is colored by
   its exact BFS distance from a start node (graphlib.bfsDistances) on a
   sequential multi-hue ramp (d3 viridis, clipped away from both extremes so
   every band reads on the light and the dark surface): the color crawls
   around the ring in both directions and meets at the far side. Every third
   band carries its number outside the ring and the far side is labeled; an
   arrow from the center marks the start node. Click a node to start there.
   The readout contrasts the lattice with G(n, m) random networks of the same
   N and m (20 seeded samples), which is the point of the figure. */

"use strict";

(function () {
  const N = 100, K = 6, SAMPLES = 20;
  const $ = (id) => document.getElementById(id);
  const canvas = $("net"), ctx = canvas.getContext("2d");
  const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  let src = 0;

  const lattice = GL.ringLattice(N, K);
  const M = lattice.edges.length;

  // Random comparison: seeded G(n, m) samples with the same N and m. Distances
  // are measured from node 0 inside its component; samples where node 0 sits
  // outside the giant component are skipped (rare at <k> = 6).
  function randomReference() {
    let s = 2026 >>> 0;
    const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    let far = 0, mean = 0, got = 0, tries = 0;
    while (got < SAMPLES && tries < 10 * SAMPLES) {
      tries++;
      const g = GL.gnm(N, M, rnd);
      const d = GL.bfsDistances(g, 0).filter((v, i) => i !== 0 && v >= 0);
      if (d.length < N / 2) continue;
      far += Math.max(...d); mean += GL.mean(d); got++;
    }
    return { far: far / got, mean: mean / got };
  }
  const rnd = randomReference();

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  // accent for the start node; viridis (near = deep blue, far = yellow) for 1..dMax,
  // clipped to [0.12, 0.92] so neither extreme vanishes on its surface
  function rampColor(d, dMax) {
    if (d === 0) return VK.cssVar("--accent");
    const t = dMax > 1 ? (d - 1) / (dMax - 1) : 0;
    return d3.interpolateViridis(0.12 + 0.80 * t);
  }

  function draw() {
    if (!canvas.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(canvas.clientWidth * dpr) || canvas.height !== Math.round(canvas.clientHeight * dpr)) fit();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const dist = GL.bfsDistances(lattice, src), dMax = Math.max(...dist);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    const R = Math.min(W, H) / 2 - 34;             // room for labels outside the ring
    const angle = (i) => (2 * Math.PI * i) / N - Math.PI / 2;
    const pos = (i, r = R) => [r * Math.cos(angle(i)), r * Math.sin(angle(i))];

    // links: the rim straight; the ±2 and ±3 chords bowed toward the center so the
    // local wiring reads as a woven band instead of hiding behind the nodes
    ctx.strokeStyle = VK.cssVar("--text-muted"); ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath();
    for (const [a, b] of lattice.edges) {
      const [x1, y1] = pos(a), [x2, y2] = pos(b);
      const step = Math.min((b - a + N) % N, (a - b + N) % N);
      ctx.moveTo(x1, y1);
      if (step === 1) ctx.lineTo(x2, y2);
      else { const f = 1 - (step * 11) / R; ctx.quadraticCurveTo(((x1 + x2) / 2) * f, ((y1 + y2) / 2) * f, x2, y2); }
    }
    ctx.stroke(); ctx.globalAlpha = 1;

    // nodes, colored by distance; a hairline ring keeps every band visible
    for (let i = 0; i < N; i++) {
      const [x, y] = pos(i);
      ctx.beginPath(); ctx.arc(x, y, i === src ? 7.5 : 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = rampColor(dist[i], dMax); ctx.fill();
      ctx.lineWidth = i === src ? 2 : 1;
      ctx.strokeStyle = i === src ? VK.cssVar("--surface-1") : VK.cssVar("--text-muted");
      ctx.stroke();
    }

    // distance labels outside the ring: the first node of every third band
    // going clockwise from the start, plus the far side
    const labelAt = (i, text, strong) => {
      const a = angle(i), [x, y] = pos(i, R + 12);
      ctx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? "center" : Math.cos(a) > 0 ? "left" : "right";
      ctx.textBaseline = Math.abs(Math.sin(a)) < 0.3 ? "middle" : Math.sin(a) > 0 ? "top" : "bottom";
      ctx.fillStyle = VK.cssVar(strong ? "--text-secondary" : "--text-muted");
      ctx.font = (strong ? "600 " : "") + "11px " + FONT;
      ctx.fillText(text, x, y);
    };
    for (let d = 3; d < dMax; d += 3)
      for (let s = 1; s < N / 2; s++) { const i = (src + s) % N; if (dist[i] === d) { labelAt(i, `${d}`); break; } }
    labelAt((src + N / 2) % N, `${dMax} steps — the far side`, true);

    // arrow from the center to the start node
    const [sx, sy] = pos(src);
    const len = Math.hypot(sx, sy), ux = sx / len, uy = sy / len;
    const x0 = ux * 46, y0 = uy * 46, x1 = sx - ux * 19, y1 = sy - uy * 19;
    ctx.strokeStyle = VK.cssVar("--accent"); ctx.fillStyle = VK.cssVar("--accent"); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1 + ux * 9, y1 + uy * 9);
    ctx.lineTo(x1 - uy * 4.5, y1 + ux * 4.5);
    ctx.lineTo(x1 + uy * 4.5, y1 - ux * 4.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = VK.cssVar("--text-secondary");
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "600 12px " + FONT;
    ctx.fillText("start node", 0, 0);
    ctx.restore();

    // legend + readout
    const items = [];
    for (let d = 0; d <= dMax; d++)
      items.push(`<span class="key"><span class="swatch dot" style="background:${rampColor(d, dMax)}"></span>${d === 0 ? "start" : d}</span>`);
    $("legend").innerHTML = items.join("");
    $("r-c").textContent = GL.avgClustering(lattice).toFixed(3);
    $("r-far").textContent = `${dMax} steps`;
    $("r-mean").textContent = GL.mean(dist.filter((v, i) => i !== src)).toFixed(1);
    $("r-rnd-far").textContent = `${rnd.far.toFixed(1)} steps`;
    $("r-rnd-mean").textContent = rnd.mean.toFixed(1);
  }

  function nodeAt(mx, my) {
    const W = canvas.clientWidth, H = canvas.clientHeight, R = Math.min(W, H) / 2 - 34;
    let best = null, bd = 12 * 12;
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * i) / N - Math.PI / 2;
      const dx = W / 2 + R * Math.cos(a) - mx, dy = H / 2 + R * Math.sin(a) - my;
      if (dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; }
    }
    return best;
  }
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    const h = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (h !== null) { src = h; draw(); }
  });
  window.addEventListener("resize", () => { fit(); draw(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  fit();
  draw();
})();
