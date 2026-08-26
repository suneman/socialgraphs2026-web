/* One network, five layouts. The force layout finds clusters and hubs; the
   circles and the random scatter draw the very same edges and tell different
   stories — or none. Louvain communities (computed right here, deterministic)
   can be painted on or off, and the community circle groups each cluster into
   its own arc with center-bent chords. Only the connections are data; x, y
   and color are choices. Shows the giant connected component only. */

"use strict";

// Pure helpers, node-requirable for the verification protocol.
const LY = (() => {
  function parseEdges(text) {
    return text.split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("\t"))
      .filter((f) => f.length >= 2);
  }

  function parseNodes(text) {
    const rows = text.split("\n").filter((l) => l && !l.startsWith("#"));
    const header = rows.shift().split("\t");
    const id = header.indexOf("node_id"), nm = header.indexOf("name");
    return rows.map((l) => {
      const f = l.split("\t");
      return { id: f[id], name: f[nm >= 0 ? nm : 0] || f[id] };
    });
  }

  // undirected simple edge list as index pairs, deduplicated
  function undirectedEdges(nodes, edges) {
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const seen = new Set(), out = [];
    for (const [s, t] of edges) {
      const a = idx.get(s), b = idx.get(t);
      if (a === undefined || b === undefined || a === b) continue;
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a < b ? [a, b] : [b, a]);
    }
    return out;
  }

  function degreesFrom(n, edges) {
    const d = new Array(n).fill(0);
    for (const [a, b] of edges) { d[a]++; d[b]++; }
    return d;
  }

  // largest connected component → sorted original indices
  function giantComponent(n, edges) {
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    const comp = new Array(n).fill(-1);
    let best = [], cur = 0;
    for (let s = 0; s < n; s++) {
      if (comp[s] !== -1) continue;
      const stack = [s], members = [];
      comp[s] = cur;
      while (stack.length) {
        const v = stack.pop();
        members.push(v);
        for (const w of adj[v]) if (comp[w] === -1) { comp[w] = cur; stack.push(w); }
      }
      if (members.length > best.length) best = members;
      cur++;
    }
    return best.sort((a, b) => a - b);
  }

  /* Louvain community detection, deterministic (fixed ascending node order,
     ties broken toward the lowest community id). Unweighted input; weighted
     internally after aggregation. */
  function louvain(n, edges) {
    function oneLevel(g) {
      const k = new Array(g.n).fill(0);
      const adjW = Array.from({ length: g.n }, () => new Map());
      let m2 = 0;
      for (const [a, b, w] of g.links) {
        k[a] += w; k[b] += w; m2 += 2 * w;
        adjW[a].set(b, (adjW[a].get(b) || 0) + w);
        adjW[b].set(a, (adjW[b].get(a) || 0) + w);
      }
      for (let i = 0; i < g.n; i++) { k[i] += 2 * g.self[i]; m2 += 2 * g.self[i]; }

      const comm = Array.from({ length: g.n }, (_, i) => i);
      const tot = k.slice();
      let moved = true, improved = false;
      while (moved) {
        moved = false;
        for (let i = 0; i < g.n; i++) {
          const ci = comm[i];
          const wTo = new Map();
          for (const [j, w] of adjW[i]) wTo.set(comm[j], (wTo.get(comm[j]) || 0) + w);
          tot[ci] -= k[i];
          let bestC = ci, bestGain = (wTo.get(ci) || 0) - (tot[ci] * k[i]) / m2;
          const cands = [...wTo.keys()].sort((a, b) => a - b);
          for (const c of cands) {
            const gain = wTo.get(c) - (tot[c] * k[i]) / m2;
            if (gain > bestGain + 1e-12) { bestGain = gain; bestC = c; }
          }
          tot[bestC] += k[i];
          if (bestC !== ci) { comm[i] = bestC; moved = true; improved = true; }
        }
      }
      return { comm, improved };
    }

    function aggregate(g, comm) {
      const ids = [...new Set(comm)].sort((a, b) => a - b);
      const remap = new Map(ids.map((c, i) => [c, i]));
      const self = new Array(ids.length).fill(0);
      const linkW = new Map();
      for (let i = 0; i < g.n; i++) self[remap.get(comm[i])] += g.self[i];
      for (const [a, b, w] of g.links) {
        const ca = remap.get(comm[a]), cb = remap.get(comm[b]);
        if (ca === cb) { self[ca] += w; continue; }
        const key = ca < cb ? ca * 100000 + cb : cb * 100000 + ca;
        linkW.set(key, (linkW.get(key) || 0) + w);
      }
      const links = [...linkW.entries()].map(([key, w]) => [Math.floor(key / 100000), key % 100000, w]);
      return { g: { n: ids.length, links, self }, remap: comm.map((c) => remap.get(c)) };
    }

    let g = { n, links: edges.map(([a, b]) => [a, b, 1]), self: new Array(n).fill(0) };
    let assign = Array.from({ length: n }, (_, i) => i);
    for (let level = 0; level < 20; level++) {
      const { comm, improved } = oneLevel(g);
      const { g: g2, remap } = aggregate(g, comm);
      assign = assign.map((c) => remap[c]);
      if (!improved || g2.n === g.n) break;
      g = g2;
    }
    // renumber by size, largest first (stable → deterministic colors)
    const size = new Map();
    for (const c of assign) size.set(c, (size.get(c) || 0) + 1);
    const order = [...size.keys()].sort((a, b) => size.get(b) - size.get(a) || a - b);
    const rank = new Map(order.map((c, i) => [c, i]));
    return assign.map((c) => rank.get(c));
  }

  // Newman modularity of a partition on an unweighted undirected graph
  function modularity(n, edges, comm) {
    const m = edges.length;
    const deg = degreesFrom(n, edges);
    const inW = new Map(), totD = new Map();
    for (const [a, b] of edges) if (comm[a] === comm[b]) inW.set(comm[a], (inW.get(comm[a]) || 0) + 1);
    for (let i = 0; i < n; i++) totD.set(comm[i], (totD.get(comm[i]) || 0) + deg[i]);
    let q = 0;
    for (const c of totD.keys()) q += (inW.get(c) || 0) / m - Math.pow(totD.get(c) / (2 * m), 2);
    return q;
  }

  // deterministic LCG so "random" is the same picture for everyone
  function lcg(seed) {
    let s = seed >>> 0;
    return () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
  }

  return { parseEdges, parseNodes, undirectedEdges, degreesFrom, giantComponent, louvain, modularity, lcg };
})();
if (typeof module !== "undefined") module.exports = LY;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const canvas = $("net");
  const ctx = canvas.getContext("2d");

  const N_CATS = 7; // --cat-1 … --cat-7; smaller communities fold to gray

  let nodes, uedges, degs, adj, comm, nComm, totalNodes;
  let pos = [];
  let layouts = {};
  let mode = "force";
  let colorsOn = true;
  let pinned = null, hovered = null;
  let anim = null;

  const R = 1;

  const catColor = (c) => (c < N_CATS ? VK.cssVar(`--cat-${c + 1}`) : VK.cssVar("--text-muted"));

  /* --- layout computations (all in ~[-1,1] space) --- */

  // scale so the 96th-percentile radius fills the frame; clamp stragglers
  function normalize(pts) {
    const rs = pts.map(([x, y]) => Math.hypot(x, y)).sort((a, b) => a - b);
    const ref = rs[Math.floor(rs.length * 0.96)] || 1e-9;
    const s = (0.92 * R) / ref;
    return pts.map(([x, y]) => {
      let px = x * s, py = y * s;
      const r = Math.hypot(px, py);
      if (r > R) { px *= R / r; py *= R / r; }
      return [px, py];
    });
  }

  function forceLayout() {
    const ns = nodes.map((n, i) => ({ index: i }));
    const ls = uedges.map(([a, b]) => ({ source: a, target: b }));
    const sim = d3.forceSimulation(ns)
      .force("link", d3.forceLink(ls).id((d) => d.index).distance(30).strength(0.18))
      .force("charge", d3.forceManyBody().strength(-58))
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX().strength(0.045))
      .force("y", d3.forceY().strength(0.045))
      .stop();
    sim.tick(380);
    return normalize(ns.map((d) => [d.x, d.y]));
  }

  // rank order around the circle; groupOf inserts a 3-slot gap between groups
  function circle(order, groupOf) {
    const p = new Array(nodes.length);
    let slots = nodes.length;
    if (groupOf) {
      let boundaries = 0;
      for (let i = 1; i < order.length; i++)
        if (groupOf(order[i]) !== groupOf(order[i - 1])) boundaries++;
      slots = nodes.length + 3 * (boundaries + 1);
    }
    let slot = 0;
    order.forEach((nodeIndex, rank) => {
      if (groupOf && rank > 0 && groupOf(nodeIndex) !== groupOf(order[rank - 1])) slot += 3;
      const a = (2 * Math.PI * slot) / slots - Math.PI / 2;
      p[nodeIndex] = [0.92 * R * Math.cos(a), 0.92 * R * Math.sin(a)];
      slot++;
    });
    return p;
  }

  function randomLayout() {
    const rnd = LY.lcg(42);
    return nodes.map(() => [(2 * rnd() - 1) * 0.95 * R, (2 * rnd() - 1) * 0.95 * R]);
  }

  function computeLayouts() {
    const byName = nodes.map((_, i) => i).sort((a, b) => nodes[a].name.localeCompare(nodes[b].name));
    const byDeg = nodes.map((_, i) => i).sort((a, b) => degs[b] - degs[a] || nodes[a].name.localeCompare(nodes[b].name));
    const byComm = nodes.map((_, i) => i).sort((a, b) =>
      comm[a] - comm[b] || degs[b] - degs[a] || nodes[a].name.localeCompare(nodes[b].name));
    layouts = {
      force: forceLayout(),
      circleAZ: circle(byName),
      circleDeg: circle(byDeg),
      circleCom: circle(byComm, (i) => comm[i]),
      random: randomLayout(),
    };
  }

  /* --- animation between layouts --- */

  function goTo(name) {
    mode = name;
    const target = layouts[name];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !pos.length) {
      pos = target.map((p) => [...p]);
      drawNet();
      return;
    }
    const from = pos.map((p) => [...p]);
    const t0 = performance.now(), DUR = 700;
    if (anim) cancelAnimationFrame(anim);
    const step = (now) => {
      const u = Math.min(1, (now - t0) / DUR);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      pos = from.map(([x, y], i) => [
        x + (target[i][0] - x) * e,
        y + (target[i][1] - y) * e,
      ]);
      drawNet();
      if (u < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  /* --- drawing --- */

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function unitScale() {
    return (Math.min(canvas.clientWidth, canvas.clientHeight) / 2) * 0.94;
  }

  function drawNet() {
    if (!canvas.clientWidth || !pos.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const s = unitScale();
    const maxDeg = Math.max(1, ...degs);
    const sel = hovered !== null ? hovered : pinned;
    const curved = mode === "circleCom";

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);

    const P = pos.map(([x, y]) => [x * s, y * s]);

    const edgePath = (a, b) => {
      ctx.moveTo(P[a][0], P[a][1]);
      if (curved) {
        // chord bent toward the center — deeper for angularly distant pairs,
        // so cross-community chords dive and in-arc edges hug the rim
        const mx = (P[a][0] + P[b][0]) / 2, my = (P[a][1] + P[b][1]) / 2;
        const da = Math.abs(Math.atan2(P[a][1], P[a][0]) - Math.atan2(P[b][1], P[b][0]));
        const ang = Math.min(da, 2 * Math.PI - da);
        const pull = 1 - (0.18 + 0.72 * (ang / Math.PI));
        ctx.quadraticCurveTo(mx * pull, my * pull, P[b][0], P[b][1]);
      } else {
        ctx.lineTo(P[b][0], P[b][1]);
      }
    };

    ctx.lineWidth = 0.8;
    if (colorsOn) {
      // within-community edges in the community color, cross edges gray
      const buckets = new Map();
      const cross = [];
      for (const [a, b] of uedges) {
        if (comm[a] === comm[b]) {
          const c = comm[a];
          if (!buckets.has(c)) buckets.set(c, []);
          buckets.get(c).push([a, b]);
        } else cross.push([a, b]);
      }
      ctx.strokeStyle = VK.cssVar("--text-muted");
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      for (const [a, b] of cross) edgePath(a, b);
      ctx.stroke();
      for (const [c, es] of buckets) {
        ctx.strokeStyle = catColor(c);
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        for (const [a, b] of es) edgePath(a, b);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = VK.cssVar("--text-muted");
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (const [a, b] of uedges) edgePath(a, b);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const muted = VK.cssVar("--text-muted");
    P.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + 3.8 * Math.sqrt(degs[i] / maxDeg), 0, 2 * Math.PI);
      ctx.fillStyle = colorsOn ? catColor(comm[i]) : muted;
      ctx.fill();
    });

    if (sel !== null) {
      const accent = VK.cssVar("--accent");
      const surface = VK.cssVar("--surface-1");
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const j of adj[sel]) edgePath(sel, j);
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const j of adj[sel]) {
        ctx.beginPath();
        ctx.arc(P[j][0], P[j][1], 1.4 + 3.8 * Math.sqrt(degs[j] / maxDeg), 0, 2 * Math.PI);
        ctx.fill();
      }
      const [x, y] = P[sel];
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      const label = nodes[sel].name;
      ctx.font = "600 12px system-ui";
      const tw = ctx.measureText(label).width;
      const lx = Math.min(x + 10, W / 2 - tw - 8);
      ctx.fillStyle = surface;
      ctx.fillRect(lx - 3, y - 18, tw + 6, 16);
      ctx.fillStyle = VK.cssVar("--text-primary");
      ctx.fillText(label, lx, y - 6);
    }
    ctx.restore();

    $("r-sel").textContent = sel !== null ? `${nodes[sel].name} · k = ${degs[sel]}` : "–";
  }

  function drawLegend() {
    const counts = new Map();
    for (const c of comm) counts.set(c, (counts.get(c) || 0) + 1);
    const items = [];
    for (let c = 0; c < Math.min(nComm, N_CATS); c++) {
      // name each cluster by its highest-degree member
      let top = -1;
      for (let i = 0; i < nodes.length; i++)
        if (comm[i] === c && (top === -1 || degs[i] > degs[top])) top = i;
      items.push(`<span class="key"><span class="swatch dot" style="background: var(--cat-${c + 1})"></span>${nodes[top].name} &amp; co. (${counts.get(c)})</span>`);
    }
    if (nComm > N_CATS) {
      const rest = comm.filter((c) => c >= N_CATS).length;
      items.push(`<span class="key"><span class="swatch dot" style="background: var(--text-muted)"></span>smaller communities (${rest})</span>`);
    }
    $("legend").innerHTML = items.join("");
    $("legend").style.display = colorsOn ? "flex" : "none";
  }

  /* --- interaction --- */

  function nodeAt(mx, my) {
    const s = unitScale();
    const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
    let best = null, bestD = 12 * 12;
    pos.forEach(([x, y], i) => {
      const dx = x * s + cx - mx, dy = y * s + cy - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    const h = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (h !== hovered) { hovered = h; drawNet(); }
  });
  canvas.addEventListener("mouseleave", () => { hovered = null; drawNet(); });
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    const h = nodeAt(e.clientX - r.left, e.clientY - r.top);
    pinned = h === pinned ? null : h;
    drawNet();
  });

  const seg = $("layout-seg");
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    goTo(b.dataset.v);
  });

  const cseg = $("color-seg");
  cseg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    cseg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    colorsOn = b.dataset.v === "on";
    drawLegend();
    drawNet();
  });

  /* --- boot --- */

  Promise.all([
    fetch("../data/week1_edges.tsv").then((r) => r.text()),
    fetch("../data/week1_nodes.tsv").then((r) => r.text()),
  ]).then(([et, nt]) => {
    const allNodes = LY.parseNodes(nt);
    const allU = LY.undirectedEdges(allNodes, LY.parseEdges(et));
    totalNodes = allNodes.length;

    const keep = LY.giantComponent(allNodes.length, allU);
    const remap = new Map(keep.map((v, i) => [v, i]));
    nodes = keep.map((v) => allNodes[v]);
    uedges = allU
      .filter(([a, b]) => remap.has(a) && remap.has(b))
      .map(([a, b]) => [remap.get(a), remap.get(b)]);

    degs = LY.degreesFrom(nodes.length, uedges);
    adj = nodes.map(() => []);
    for (const [a, b] of uedges) { adj[a].push(b); adj[b].push(a); }

    comm = LY.louvain(nodes.length, uedges);
    nComm = Math.max(...comm) + 1;
    const q = LY.modularity(nodes.length, uedges, comm);

    $("r-n").textContent = `${nodes.length} of ${totalNodes}`;
    $("r-m").textContent = uedges.length.toLocaleString("en-US");
    $("r-c").textContent = `${nComm} · Q = ${q.toFixed(2)}`;
    drawLegend();
    fitCanvas();
    computeLayouts();
    goTo("force");
  }).catch(() => {
    canvas.outerHTML = '<p style="color: var(--text-muted)">Could not load the shared dataset — is the site running from its server?</p>';
  });

  window.addEventListener("resize", () => { fitCanvas(); drawNet(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawNet);
})();
