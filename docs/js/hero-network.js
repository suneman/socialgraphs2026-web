/* Ambient network in the front-page hero.
   A small preferential-attachment graph, drifting under a gentle force layout.
   Hairline ink; hubs pick up the accent. Static render under reduced motion. */

(function () {
  const canvas = document.getElementById("hero-net");
  if (!canvas || typeof d3 === "undefined") return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // --- build a small BA graph (m = 1..2 mixed, so it has both hubs and hair) ---
  const N = 64;
  const nodes = [], links = [], targets = [];
  for (let i = 0; i < N; i++) {
    nodes.push({ id: i, deg: 0 });
    if (i === 1) addLink(1, 0);
    if (i > 1) {
      const m = i % 3 === 0 ? 2 : 1;
      const chosen = new Set();
      while (chosen.size < m) chosen.add(targets[Math.floor(Math.random() * targets.length)]);
      chosen.forEach((t) => addLink(i, t));
    }
  }
  function addLink(a, b) {
    links.push({ source: a, target: b });
    nodes[a].deg++; nodes[b].deg++;
    targets.push(a, b);
  }
  const maxDeg = d3.max(nodes, (d) => d.deg);

  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(38).strength(0.6))
    .force("charge", d3.forceManyBody().strength(-42))
    .force("center", d3.forceCenter(0, 0))
    .force("x", d3.forceX().strength(0.035))
    .force("y", d3.forceY().strength(0.05))
    .alphaDecay(reduceMotion ? 0.0228 : 0.002) // ambient: decay almost never
    .on("tick", draw);

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    draw();
  }
  window.addEventListener("resize", resize);

  // the network lives right-of-center so it never sits under the hero text
  const cx = () => W * 0.72, cy = () => H * 0.44;

  canvas.parentElement.addEventListener("pointermove", (e) => {
    if (reduceMotion) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left - cx(), my = e.clientY - r.top - cy();
    nodes.forEach((n) => {
      const dx = n.x - mx, dy = n.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 3600) { n.vx += dx * 0.002; n.vy += dy * 0.002; }
    });
    sim.alpha(Math.max(sim.alpha(), 0.05));
  });

  function draw() {
    if (!W) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(cx(), cy());

    const edgeColor = css("--grid") || "#e1e0d9";
    const nodeColor = css("--text-muted") || "#898781";
    const accent = css("--accent") || "#4a3aa7";
    const surface = css("--page") || "#f9f9f7";

    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    links.forEach((l) => {
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
    });
    ctx.stroke();

    nodes.forEach((n) => {
      const isHub = n.deg >= Math.max(4, maxDeg * 0.55);
      const r = 1.8 + 2.6 * Math.sqrt(n.deg / maxDeg);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 1.5, 0, 2 * Math.PI);
      ctx.fillStyle = surface; // surface ring
      ctx.fill();
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHub ? accent : nodeColor;
      ctx.fill();
    });
    ctx.restore();
  }

  // re-render on theme flips
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  resize();
  if (reduceMotion) { sim.tick(180); sim.stop(); draw(); }
})();
