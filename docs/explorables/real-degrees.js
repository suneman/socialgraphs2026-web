/* The shared network's real degree distribution — and what binning buys you.
   Everything is derived from ../data/week1_*.tsv at load time: swap the
   snapshot and this explorable follows. Raw P(k) on log-log is a jagged
   scatter of rare counts; mixed bins (width 1 while the data is dense,
   doubling widths in the tail) average the noise away and let the trend
   through. Plotted against k+1 on both axes so zero-degree nodes survive
   the log axis; densities are normalized over ALL nodes, so the width-1
   bins coincide exactly with raw P(k). Nerdy details: the binning footnote
   at the bottom of the week-1 page. */

"use strict";

// Pure parsing/statistics, node-requirable for the verification protocol.
const RD = (() => {
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

  // per-node in/out/undirected(unique-neighbor) degrees, isolates included
  function degrees(nodes, edges) {
    const inD = new Map(), outD = new Map(), nbr = new Map();
    for (const n of nodes) { inD.set(n.id, 0); outD.set(n.id, 0); nbr.set(n.id, new Set()); }
    for (const [s, t] of edges) {
      if (!inD.has(s) || !inD.has(t)) continue;
      outD.set(s, outD.get(s) + 1);
      inD.set(t, inD.get(t) + 1);
      nbr.get(s).add(t);
      nbr.get(t).add(s);
    }
    return {
      in: nodes.map((n) => inD.get(n.id)),
      out: nodes.map((n) => outD.get(n.id)),
      und: nodes.map((n) => nbr.get(n.id).size),
    };
  }

  // raw distribution: [k, count/N] for every k present
  function rawDist(ks) {
    const c = new Map();
    for (const k of ks) c.set(k, (c.get(k) || 0) + 1);
    return [...c.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => [k, n / ks.length]);
  }

  // Mixed bins in u = k+1 space: width-1 bins for u = 1…7, then doubling
  // bins [8,16), [16,32), … Returns [bin position, per-u density] with the
  // density normalized over ALL nodes (isolates land in the u = 1 bin), so
  // the width-1 bins coincide exactly with raw P(k). Log bins sit at the
  // geometric mean of their integer range.
  function mixedBinned(ks) {
    const N = ks.length, us = ks.map((k) => k + 1), maxU = Math.max(...us);
    const out = [];
    const push = (lo, hi) => {
      const n = us.filter((u) => u >= lo && u < hi).length;
      if (n > 0) out.push([hi - lo === 1 ? lo : Math.sqrt(lo * (hi - 1)), n / N / (hi - lo)]);
    };
    for (let u = 1; u < 8 && u <= maxU; u++) push(u, u + 1);
    for (let lo = 8; lo <= maxU; lo *= 2) push(lo, lo * 2);
    return out;
  }

  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const median = (a) => {
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  return { parseEdges, parseNodes, degrees, rawDist, mixedBinned, mean, median };
})();
if (typeof module !== "undefined") module.exports = RD;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const svgNode = $("chart");

  let degMode = "in", axMode = "lin", binMode = "raw";
  let nodes, edges, degs;

  function draw() {
    if (!degs) return;
    const ks = degs[degMode];
    const c = VK.chart(svgNode);
    const col = VK.colors();

    const rawU = RD.rawDist(ks).map(([k, p]) => [k + 1, p]);
    const binned = RD.mixedBinned(ks);
    const maxU = Math.max(...ks) + 1;
    // y-domain covers raw AND binned in both bin modes, so toggling binning
    // never rescales the axes — the curve appears, nothing else moves
    const pMin = Math.min(...rawU.map(([, p]) => p), ...binned.map(([, p]) => p));

    const log = axMode === "log";
    const x = (log ? d3.scaleLog().domain([0.9, maxU * 1.3]) : d3.scaleLinear().domain([0, maxU * 1.05])).range([0, c.w]);
    const y = (log ? d3.scaleLog().domain([Math.min(pMin, 1e-3) / 2, 1]) : d3.scaleLinear().domain([0, Math.max(...rawU.map(([, p]) => p)) * 1.1])).range([c.h, 0]);

    const sup = (e) => String(e).split("").map((ch) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+ch]).join("");
    const fmt = (v) => (v === 0 ? "0" : v >= 0.01 ? +v.toFixed(2) : "10⁻" + sup(-Math.round(Math.log10(v))));
    const decades = [];
    for (let e = 0; Math.pow(10, e) >= y.domain()[0] * (log ? 1 : 0); e--) {
      if (log) decades.push(Math.pow(10, e)); else break;
    }
    VK.axes(c, x, y, {
      xTicks: log ? x.ticks(4).filter((t) => Number.isInteger(Math.log10(t)) || maxU < 40) : x.ticks(6),
      yTicks: log ? decades : y.ticks(5),
      yFormat: fmt,
      xTitle: "k + 1",
      yTitle: "P(k)",
    });

    const shown = rawU;
    if (binMode === "raw") {
      for (const [k, p] of shown) VK.marker(c, x(k), y(p), col.s1, 4);
    } else {
      for (const [k, p] of shown) VK.marker(c, x(k), y(p), col.muted, 3);
      VK.line(c, binned, x, y, col.s1);
      for (const [k, p] of binned) VK.marker(c, x(k), y(p), col.s1, 5);
    }

    $("legend").innerHTML = binMode === "raw"
      ? '<span class="key"><span class="swatch dot" style="background: var(--series-1)"></span>raw P(k)</span>'
      : '<span class="key"><span class="swatch dot" style="background: var(--text-muted)"></span>raw P(k)</span>' +
        '<span class="key"><span class="swatch" style="background: var(--series-1)"></span>binned (mixed)</span>';

    const iso = ks.filter((k) => k === 0).length;
    $("r-n").textContent = nodes.length;
    $("r-m").textContent = edges.length;
    $("r-max").textContent = Math.max(...ks);
    $("r-mean").textContent = RD.mean(ks).toFixed(2);
    $("r-med").textContent = RD.median(ks);
    $("r-iso").textContent = `${iso} (at k + 1 = 1)`;

    const byDeg = nodes.map((n, i) => [n.name, ks[i]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    $("top").innerHTML = byDeg.map(([n, k]) => `<li>${n} — <strong>${k}</strong></li>`).join("");
  }

  function segWire(segId, set) {
    const seg = $(segId);
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      set(b.dataset.v);
      draw();
    });
  }
  segWire("deg-seg", (v) => (degMode = v));
  segWire("ax-seg", (v) => (axMode = v));
  segWire("bin-seg", (v) => (binMode = v));

  Promise.all([
    fetch("../data/week1_edges.tsv").then((r) => r.text()),
    fetch("../data/week1_nodes.tsv").then((r) => r.text()),
  ]).then(([et, nt]) => {
    edges = RD.parseEdges(et);
    nodes = RD.parseNodes(nt);
    degs = RD.degrees(nodes, edges);
    draw();
  }).catch(() => {
    svgNode.outerHTML = '<p style="color: var(--text-muted)">Could not load the shared dataset — is the site running from its server?</p>';
  });

  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
})();
