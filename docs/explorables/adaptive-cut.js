/* The adaptive cut (Boucherie, Ahn & Lehmann, arXiv:2512.08741) on the philosophers.
   Everything is precomputed by Louis Boucherie's AdaptiveCut package
   (github.com/LCB0B/adaptive_cut) run from tools/groundtruth/week4_adaptive_cut.py:
   the link dendrogram (single linkage over Jaccard link similarity, 9,138 merges),
   the best single-height cut (max partition density D) and the best adaptive cut
   found by the package's Metropolis walk with simulated annealing. This file only
   draws: the dendrogram above the cut in gray, every cut community as a block from
   its cut height down to the leaves (width = its links), the seven largest in
   --cat-1…7; the network with links colored the same way; click a block to focus. */

"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const dcv = $("dendro"), ncv = $("net");
  const dctx = dcv.getContext("2d"), nctx = ncv.getContext("2d");
  const FONT = getComputedStyle(document.body).fontFamily;

  let data = null, M = 0, parent = [], kids = [], size = [], x0 = [], x1 = [], height = [];
  let mode = "adaptive", cut = null, selected = -1, dataset = "marvel";
  const WHO = { philosophers: "philosophers", marvel: "characters" };

  function fitCanvas(c) {
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
  }

  /* --- the tree --- */
  function buildTree() {
    const Z = data.linkage; M = data.edges.length;
    const N = M + Z.length;
    parent = new Array(N).fill(-1); kids = new Array(N).fill(null);
    size = new Array(N).fill(1); height = new Array(N).fill(0);
    x0 = new Array(N).fill(0); x1 = new Array(N).fill(0);
    Z.forEach(([a, b, h], k) => { const id = M + k; kids[id] = [a, b]; parent[a] = id; parent[b] = id; height[id] = h; size[id] = size[a] + size[b]; });
    // leaf order by iterative DFS from the root, left child first
    const root = N - 1; let next = 0;
    const stack = [[root, 0]];
    while (stack.length) {
      const [v, st] = stack[stack.length - 1];
      if (!kids[v]) { x0[v] = next; x1[v] = next + 1; next++; stack.pop(); continue; }
      if (st === 0) { stack[stack.length - 1][1] = 1; stack.push([kids[v][0], 0]); }
      else if (st === 1) { stack[stack.length - 1][1] = 2; stack.push([kids[v][1], 0]); }
      else { x0[v] = x0[kids[v][0]]; x1[v] = x1[kids[v][1]]; stack.pop(); }
    }
  }

  function leavesOf(v) {
    const out = [], stack = [v];
    while (stack.length) { const u = stack.pop(); if (kids[u]) stack.push(kids[u][0], kids[u][1]); else out.push(u); }
    return out;
  }

  /* --- a cut: communities, colors, coverage --- */
  function makeCut(which) {
    const c = data.cuts[which];
    const nodes = c.nodes.slice();
    const comms = nodes.map((v) => {
      const links = leavesOf(v);
      const members = new Set(); for (const e of links) { members.add(data.edges[e][0]); members.add(data.edges[e][1]); }
      const m = links.length, n = members.size;
      const dc = n <= 2 ? 0 : (m - (n - 1)) / ((n - 2) * (n - 1) / 2);   // density between tree (0) and clique (1)
      return { id: v, links, members: [...members], m, n, dc, h: height[v] };
    });
    comms.sort((a, b) => b.m - a.m);
    const inCut = new Set(nodes);
    const linkComm = new Int32Array(M).fill(-1);
    comms.forEach((cm, i) => { for (const e of cm.links) linkComm[e] = i; });
    const count = new Map();
    comms.forEach((cm) => { if (cm.m >= 3) for (const v of cm.members) count.set(v, (count.get(v) || 0) + 1); });
    let multi = 0; for (const k of count.values()) if (k >= 2) multi++;
    const big = comms.filter((cm) => cm.m >= 3);
    const heights = new Set(big.map((cm) => cm.h.toFixed(4)));
    return { which, D: c.D, threshold: c.threshold, comms, inCut, linkComm, covered: count.size, multi, nBig: big.length, nHeights: heights.size };
  }

  const catOf = (i) => (i < 7 ? VK.cssVar(`--cat-${i + 1}`) : null);

  /* --- dendrogram --- */
  function drawDendro() {
    if (!dcv.clientWidth) return;
    fitCanvas(dcv);
    const dpr = window.devicePixelRatio || 1, W = dcv.clientWidth, H = dcv.clientHeight;
    const padL = 34, padR = 6, padT = 8, padB = 18;
    const sx = (leafIdx) => padL + (leafIdx / M) * (W - padL - padR);
    const sy = (h) => padT + (1 - h) * (H - padT - padB);
    const muted = VK.cssVar("--text-muted"), grid = VK.cssVar("--grid"), accent = VK.cssVar("--accent");
    const ctx = dctx;
    ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

    // axis: height = 1 − similarity
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = muted; ctx.font = "11px " + FONT; ctx.textAlign = "right";
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.beginPath(); ctx.moveTo(padL, sy(t)); ctx.lineTo(W - padR, sy(t)); ctx.stroke();
      ctx.fillText(t.toFixed(2), padL - 4, sy(t) + 4);
    }
    ctx.save(); ctx.translate(10, (padT + H - padB) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center";
    ctx.fillText("1 − link similarity", 0, 0); ctx.restore();

    // community blocks: from the cut height down to the leaves
    for (let i = cut.nBig - 1; i >= 0; i--) {
      const cm = cut.comms[i];
      const xa = sx(x0[cm.id]), xb = Math.max(sx(x1[cm.id]), xa + 0.6);
      const top = sy(cm.h), bottom = sy(0);
      const c = catOf(i);
      ctx.globalAlpha = selected < 0 ? (c ? 0.9 : 0.45) : (i === selected ? 1 : c ? 0.35 : 0.2);
      ctx.fillStyle = c || muted;
      ctx.fillRect(xa, top, xb - xa, bottom - top);
      if (i === selected) { ctx.globalAlpha = 1; ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(xa - 1, top - 1, xb - xa + 2, bottom - top + 2); }
    }
    ctx.globalAlpha = 1;

    // the tree above the cut: one U per merge whose subtree is not inside a cut community
    ctx.strokeStyle = muted; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.45;
    ctx.beginPath();
    const N = parent.length;
    const inside = new Uint8Array(N);
    // a node is inside a community if it or an ancestor is a cut node: walk top-down by id order (children have smaller ids only for leaves; use parent chain memo)
    const memo = new Int8Array(N).fill(-1);
    const isInside = (v) => { if (memo[v] >= 0) return memo[v]; const r = cut.inCut.has(v) ? 1 : parent[v] < 0 ? 0 : isInside(parent[v]); memo[v] = r; return r; };
    for (let v = M; v < N; v++) {
      if (isInside(v)) continue;
      const [a, b] = kids[v];
      const y = sy(height[v]);
      const xa = (sx(x0[a]) + sx(x1[a])) / 2, xb = (sx(x0[b]) + sx(x1[b])) / 2;
      const stub = (c) => (cut.inCut.has(c) && size[c] < 3) ? Math.max(height[c], height[v] - 0.03) : cut.inCut.has(c) ? height[c] : height[c];
      const ya = sy(stub(a)), yb = sy(stub(b));
      ctx.moveTo(xa, ya); ctx.lineTo(xa, y); ctx.lineTo(xb, y); ctx.lineTo(xb, yb);
    }
    ctx.stroke(); ctx.globalAlpha = 1;

    // the single threshold, as a dashed line (in adaptive mode: a faint reference)
    if (cut.which === "adaptive" && data.cuts.single.threshold != null) {
      const th = data.cuts.single.threshold;
      ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(padL, sy(th)); ctx.lineTo(W - padR, sy(th)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.font = "11px " + FONT; ctx.textAlign = "right";
      const lbl = `the one-cut height, ${th.toFixed(2)}, for reference`, tw = ctx.measureText(lbl).width;
      ctx.fillStyle = VK.cssVar("--surface-1"); ctx.globalAlpha = 0.85; ctx.fillRect(W - padR - 4 - tw, sy(th) - 15, tw + 4, 14); ctx.globalAlpha = 1;
      ctx.fillStyle = muted; ctx.fillText(lbl, W - padR - 2, sy(th) - 4);
    }
    if (cut.which === "single" && cut.threshold != null) {
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(padL, sy(cut.threshold)); ctx.lineTo(W - padR, sy(cut.threshold)); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "600 11px " + FONT; ctx.textAlign = "right";
      const lbl = `one height for every branch: ${cut.threshold.toFixed(2)}`, tw = ctx.measureText(lbl).width;
      ctx.fillStyle = VK.cssVar("--surface-1"); ctx.globalAlpha = 0.85; ctx.fillRect(W - padR - 4 - tw, sy(cut.threshold) - 15, tw + 4, 14); ctx.globalAlpha = 1;
      ctx.fillStyle = accent; ctx.fillText(lbl, W - padR - 2, sy(cut.threshold) - 4);
    }
    ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.font = "11px " + FONT;
    ctx.fillText(`${M.toLocaleString("en-US")} links, in dendrogram order`, (padL + W - padR) / 2, H - 4);
    ctx.restore();
  }

  /* --- network --- */
  function drawNet() {
    if (!ncv.clientWidth) return;
    fitCanvas(ncv);
    const dpr = window.devicePixelRatio || 1, W = ncv.clientWidth, H = ncv.clientHeight, pad = 10;
    const s = (Math.min(W, H) - 2 * pad) / 2, tx = W / 2, ty = H / 2;
    // scale so that the 96th-percentile radius reaches the edge (a spring layout's far periphery is clipped)
    const rs = data.pos.map(([x, y]) => Math.hypot(x, y)).sort((a, b) => a - b);
    const r96 = Math.max(1e-9, rs[Math.floor(0.96 * (rs.length - 1))]);
    const P = data.pos.map(([x, y]) => { const r = Math.hypot(x, y), f = Math.min(1, r96 / Math.max(r, 1e-9)) / r96; return [tx + s * x * f, ty + s * y * f]; });
    const muted = VK.cssVar("--text-muted"), surface = VK.cssVar("--surface-1"), accent = VK.cssVar("--accent"), ink = VK.cssVar("--text-primary");
    const maxDeg = Math.max(...data.deg);
    const radius = (i) => 1.2 + 4.5 * Math.sqrt(data.deg[i] / maxDeg);
    const ctx = nctx;
    ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

    const buckets = new Map(), gray = [];
    data.edges.forEach(([a, b], e) => {
      const ci = cut.linkComm[e], c = catOf(ci);
      if (!c) { gray.push([a, b]); return; }
      if (!buckets.has(ci)) buckets.set(ci, []);
      buckets.get(ci).push([a, b]);
    });
    const strokeAll = (es, color, alpha, w) => {
      ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = w; ctx.beginPath();
      for (const [a, b] of es) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
      ctx.stroke();
    };
    strokeAll(gray, muted, selected < 0 ? 0.06 : 0.03, 0.6);
    for (const [ci, es] of buckets) if (ci !== selected) strokeAll(es, catOf(ci), selected < 0 ? 0.55 : 0.08, 0.9);
    ctx.globalAlpha = 1;
    for (let i = 0; i < P.length; i++) {
      ctx.beginPath(); ctx.arc(P[i][0], P[i][1], radius(i), 0, 2 * Math.PI);
      ctx.globalAlpha = 0.35; ctx.fillStyle = muted; ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (selected >= 0) {
      const cm = cut.comms[selected], c = catOf(selected) || accent;
      strokeAll(cm.links.map((e) => data.edges[e]), c, 0.9, 1.4);
      ctx.globalAlpha = 1;
      for (const v of cm.members) { ctx.beginPath(); ctx.arc(P[v][0], P[v][1], radius(v) + 0.6, 0, 2 * Math.PI); ctx.fillStyle = c; ctx.fill(); }
      // label the members with the most links inside the community
      const inDeg = new Map(); for (const e of cm.links) for (const v of data.edges[e]) inDeg.set(v, (inDeg.get(v) || 0) + 1);
      const tops = [...inDeg.entries()].sort((a, b) => b[1] - a[1] || data.deg[b[0]] - data.deg[a[0]]).slice(0, 6).map((d) => d[0]);
      ctx.font = "600 11px " + FONT; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      const placed = [];
      for (const v of tops) {
        const label = data.names[v].replace(/_/g, " ").replace(/ \(.*\)$/, "");
        const tw = ctx.measureText(label).width;
        let lx = Math.min(P[v][0] + radius(v) + 4, W - tw - 4), ly = P[v][1];
        let guard = 0; while (placed.some(([px, py, pw]) => Math.abs(ly - py) < 15 && lx < px + pw + 6 && lx + tw + 6 > px) && guard++ < 20) ly += 15;
        ly = Math.max(8, Math.min(H - 8, ly));
        ctx.fillStyle = surface; ctx.globalAlpha = 0.9; ctx.fillRect(lx - 3, ly - 8, tw + 6, 16); ctx.globalAlpha = 1;
        ctx.fillStyle = ink; ctx.fillText(label, lx, ly);
        placed.push([lx, ly, tw]);
      }
    }
    ctx.restore();
  }

  /* --- text --- */
  function status() {
    $("r-d").textContent = cut.D.toFixed(3);
    $("r-comms").textContent = cut.nBig;
    $("r-in").textContent = `${cut.covered} of ${data.ids.length}`;
    $("l-in").textContent = dataset === "marvel" ? "Characters in one" : "Philosophers in one";
    $("ntitle").textContent = dataset === "marvel" ? "Marvel, links colored by community" : "The philosophers, links colored by community";
    $("r-multi").textContent = cut.multi;
    $("r-heights").textContent = cut.which === "single" ? "1" : cut.nHeights;
    $("dtitle").textContent = cut.which === "single"
      ? "The link dendrogram, cut at one height"
      : "The link dendrogram, cut branch by branch";
    const st = $("status");
    if (selected < 0) { st.innerHTML = `<b>${cut.which === "single" ? "One cut" : "Adaptive cut"}:</b> D = ${cut.D.toFixed(3)}, ${cut.nBig} link communities of three links or more. The seven largest are colored, in both panels. Click a block.`; return; }
    const cm = cut.comms[selected];
    const inDeg = new Map(); for (const e of cm.links) for (const v of data.edges[e]) inDeg.set(v, (inDeg.get(v) || 0) + 1);
    const tops = [...inDeg.entries()].sort((a, b) => b[1] - a[1] || data.deg[b[0]] - data.deg[a[0]]).slice(0, 10)
      .map((d) => data.names[d[0]].replace(/_/g, " ").replace(/ \(.*\)$/, ""));
    st.innerHTML = `<b>Community ${selected + 1} of ${cut.nBig}</b> (by size, three links or more): <b>${cm.m}</b> links among <b>${cm.n}</b> ${WHO[dataset]}, cut at height ${cm.h.toFixed(2)} (link similarity ${(1 - cm.h).toFixed(2)}), density ${cm.dc.toFixed(2)} of the way from a tree to a clique. Most links inside: ${tops.join(", ")}.`;
  }

  function render() { drawDendro(); drawNet(); status(); }

  function setMode(m) { mode = m; cut = makeCut(m); selected = -1; render(); }
  // keep the mode buttons in sync when a dataset reloads


  /* --- events --- */
  dcv.addEventListener("click", (ev) => {
    const r = dcv.getBoundingClientRect(), W = dcv.clientWidth, H = dcv.clientHeight;
    const padL = 34, padR = 6, padT = 8, padB = 18;
    const leaf = ((ev.clientX - r.left) - padL) / (W - padL - padR) * M;
    const h = 1 - ((ev.clientY - r.top) - padT) / (H - padT - padB);
    let hit = -1;
    cut.comms.forEach((cm, i) => { if (leaf >= x0[cm.id] && leaf < x1[cm.id] && h <= cm.h + 0.02 && cm.m >= 3) hit = i; });
    if (hit < 0) { // nearest big community by x
      let best = 1e9; cut.comms.forEach((cm, i) => { if (cm.m < 3) return; const d = leaf < x0[cm.id] ? x0[cm.id] - leaf : leaf >= x1[cm.id] ? leaf - x1[cm.id] : 0; if (d < best) { best = d; hit = i; } });
    }
    selected = hit; render();
  });
  $("mode").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $("mode").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    setMode(b.dataset.v);
  });
  $("next").addEventListener("click", () => { selected = (selected + 1) % Math.max(1, cut.nBig); render(); });
  window.addEventListener("resize", render);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

  function load(ds) {
    dataset = ds;
    fetch(`data/adaptive-cut-${ds}.json`).then((r) => r.json()).then((d) => {
      data = d; buildTree(); setMode(mode);
    }).catch(() => {
      $("status").textContent = `Could not load data/adaptive-cut-${ds}.json — is the site running from its server?`;
    });
  }
  $("dataset").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $("dataset").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    load(b.dataset.v);
  });
  load("marvel");
})();
