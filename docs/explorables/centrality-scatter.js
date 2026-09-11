/* centrality-scatter.js — every centrality against every other, on the Marvel
   giant component (277 characters, undirected unless the measure says otherwise).
   One point per character; pick the measure on each axis. The characters a
   measure crowns that the x-measure does not (top ten by y, not top ten by x)
   are ringed and named — the disagreements are the interesting part.

   Measures, all computed in the browser at load and networkx-exact:
     degree        k_i on the undirected GCC
     closeness     (n−1) / Σ d_ij            networkx closeness_centrality
     harmonic      (1/(n−1)) Σ 1/d_ij        networkx harmonic_centrality / (n−1)
     betweenness   fraction of shortest paths through i, networkx normalized=True
     eigenvector   networkx eigenvector_centrality (L2-normalized power iteration)
     pagerank      networkx pagerank(alpha=0.85) on the full DIRECTED network
                   (303 nodes, dangling mass spread uniformly), shown for GCC nodes
   Node-requirable: CS.measures(MV.build(edgeText, nodeText)). */

"use strict";

const CS = (() => {
  const KEYS = ["degree", "closeness", "harmonic", "betweenness", "eigenvector", "pagerank"];
  const LABELS = {
    degree: "Degree", closeness: "Closeness", harmonic: "Harmonic",
    betweenness: "Betweenness", eigenvector: "Eigenvector", pagerank: "PageRank",
  };

  function adjacency(n, edges) {
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    return adj;
  }

  function bfs(adj, s) {
    const dist = new Array(adj.length).fill(-1);
    dist[s] = 0;
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
      const v = q[qi];
      for (const w of adj[v]) if (dist[w] === -1) { dist[w] = dist[v] + 1; q.push(w); }
    }
    return dist;
  }

  // closeness + harmonic in one sweep (connected network assumed: the GCC)
  function distanceMeasures(adj) {
    const n = adj.length, clo = new Array(n), har = new Array(n);
    for (let u = 0; u < n; u++) {
      const d = bfs(adj, u);
      let tot = 0, inv = 0;
      for (let v = 0; v < n; v++) if (v !== u && d[v] > 0) { tot += d[v]; inv += 1 / d[v]; }
      clo[u] = tot > 0 ? (n - 1) / tot : 0;
      har[u] = inv / (n - 1);
    }
    return { closeness: clo, harmonic: har };
  }

  // Brandes, undirected, networkx betweenness_centrality(normalized=True)
  function betweenness(adj) {
    const n = adj.length, bc = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
      const stack = [], pred = Array.from({ length: n }, () => []);
      const sigma = new Array(n).fill(0), dist = new Array(n).fill(-1);
      sigma[s] = 1; dist[s] = 0;
      const q = [s];
      for (let qi = 0; qi < q.length; qi++) {
        const v = q[qi]; stack.push(v);
        for (const w of adj[v]) {
          if (dist[w] < 0) { dist[w] = dist[v] + 1; q.push(w); }
          if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
        }
      }
      const delta = new Array(n).fill(0);
      while (stack.length) {
        const w = stack.pop();
        for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s) bc[w] += delta[w];
      }
    }
    const scale = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;
    return bc.map((v) => v * scale);
  }

  // networkx eigenvector_centrality: x ← x + A x, L2-normalized, until Σ|Δ| < n·1e-6
  function eigenvector(adj, maxIter = 2000) {
    const n = adj.length;
    let x = new Array(n).fill(1 / n);
    for (let it = 0; it < maxIter; it++) {
      const last = x;
      x = last.slice();
      for (let v = 0; v < n; v++) for (const w of adj[v]) x[w] += last[v];
      const norm = Math.sqrt(x.reduce((s, v) => s + v * v, 0)) || 1;
      x = x.map((v) => v / norm);
      let diff = 0;
      for (let i = 0; i < n; i++) diff += Math.abs(x[i] - last[i]);
      if (diff < n * 1e-6) return x;
    }
    return x;
  }

  // networkx pagerank(alpha): uniform start, dangling mass spread uniformly,
  // stop when Σ|Δ| < n·1e-6
  function pagerank(n, directed, alpha = 0.85, maxIter = 1000) {
    const out = new Array(n).fill(0), inc = Array.from({ length: n }, () => []);
    for (const [a, b] of directed) { out[a]++; inc[b].push(a); }
    let x = new Array(n).fill(1 / n);
    for (let it = 0; it < maxIter; it++) {
      const last = x;
      let dangle = 0;
      for (let v = 0; v < n; v++) if (out[v] === 0) dangle += last[v];
      x = new Array(n);
      let diff = 0;
      for (let v = 0; v < n; v++) {
        let s = 0;
        for (const u of inc[v]) s += last[u] / out[u];
        x[v] = alpha * (s + dangle / n) + (1 - alpha) / n;
        diff += Math.abs(x[v] - last[v]);
      }
      if (diff < n * 1e-6) return x;
    }
    return x;
  }

  // all six measures over the GCC nodes (index = gcc node index)
  function measures(data) {
    const n = data.gcc.nodes.length;
    const adj = adjacency(n, data.gcc.undirected);
    const dm = distanceMeasures(adj);
    const keep = MV.giantComponent(data.nodes.length, data.undirected);
    const prAll = pagerank(data.nodes.length, data.directed);
    return {
      degree: adj.map((a) => a.length),
      closeness: dm.closeness,
      harmonic: dm.harmonic,
      betweenness: betweenness(adj),
      eigenvector: eigenvector(adj),
      pagerank: keep.map((v) => prAll[v]),
    };
  }

  // Spearman rank correlation with average ranks for ties
  function ranks(xs) {
    const idx = xs.map((v, i) => i).sort((a, b) => xs[a] - xs[b]);
    const r = new Array(xs.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k]] = avg;
      i = j + 1;
    }
    return r;
  }
  function spearman(xs, ys) {
    const rx = ranks(xs), ry = ranks(ys), n = xs.length;
    const mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2;
    }
    return sxy / Math.sqrt(sxx * syy);
  }

  // competition rank (1 + number strictly above)
  function rankOf(xs) {
    const sorted = xs.slice().sort((a, b) => b - a);
    return xs.map((v) => sorted.findIndex((s) => s <= v) + 1);
  }
  function topTen(xs) {
    return xs.map((v, i) => i).sort((a, b) => xs[b] - xs[a] || a - b).slice(0, 10);
  }

  return { KEYS, LABELS, adjacency, bfs, distanceMeasures, betweenness, eigenvector, pagerank, measures, ranks, spearman, rankOf, topTen };
})();
if (typeof module !== "undefined") module.exports = CS;

/* --- the explorable --- */
if (typeof document !== "undefined") (function () {
  const $ = (id) => document.getElementById(id);
  const { KEYS, LABELS } = CS;
  let data = null, M = null;
  let xKey = "degree", yKey = "betweenness", axes = "log";

  const fmtVal = (k, v) => (k === "degree" ? `${v}` : v < 0.001 ? v.toExponential(2) : v.toPrecision(3));
  // log ticks: decades, plus 2× and 5× when the axis spans two decades or fewer
  function logTicks(sc) {
    const [lo, hi] = sc.domain();
    const a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi));
    const mults = b - a <= 1 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : b - a <= 4 ? [1, 2, 5] : [1];
    const t = [];
    for (let e = a; e <= b; e++) for (const m of mults) { const v = m * 10 ** e; if (v >= lo && v <= hi) t.push(v); }
    return t;
  }
  const tickFmt = (k, sc) => (k === "degree" ? d3.format("~s")
    : sc && sc.domain()[0] < 0.01 ? d3.format(".0e") : d3.format(".2~g"));
  const short = (name) => name.replace(/\s*\([^)]*\)\s*$/, ""); // the hover keeps the full name

  function seg(id, onPick) {
    const btns = $(id).querySelectorAll("button");
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((o) => o.classList.toggle("on", o === b));
      onPick(b.dataset.v);
    }));
  }
  seg("x-seg", (v) => { xKey = v; render(); });
  seg("y-seg", (v) => { yKey = v; render(); });
  seg("ax-seg", (v) => { axes = v; render(); });

  function scale(vals, range, log) {
    const pos = vals.filter((v) => v > 0);
    if (log) {
      const lo = d3.min(pos), hi = d3.max(pos);
      return d3.scaleLog().domain([lo / 1.25, hi * 1.25]).range(range);
    }
    const hi = d3.max(vals);
    return d3.scaleLinear().domain([0, hi * 1.06]).range(range).nice();
  }

  function render() {
    if (!M) return;
    const xs = M[xKey], ys = M[yKey], n = xs.length, names = data.gcc.nodes.map((d) => d.name);
    const log = axes === "log";
    const RAIL = 18; // px reserved for the zero rail on a log axis

    $("chart-title").textContent = `${LABELS[yKey]} against ${LABELS[xKey].toLowerCase()}`;
    $("top-title").textContent = `Top ten by ${LABELS[yKey].toLowerCase()}`;
    $("top-val").textContent = LABELS[yKey].toLowerCase();
    $("top-rank").textContent = `rank by ${LABELS[xKey].toLowerCase()}`;

    const c = VK.chart($("chart"), { margin: { top: 12, right: 18, bottom: 40, left: 60 } });
    const col = VK.colors(), accent = VK.cssVar("--accent");
    const xZero = log && xs.some((v) => v <= 0), yZero = log && ys.some((v) => v <= 0);
    const x = scale(xs, [xZero ? RAIL : 0, c.w], log);
    const y = scale(ys, [c.h, yZero ? c.h - 0 : 0], log);
    // on a log axis the y range must leave room for the rail at the bottom
    if (yZero) y.range([c.h - RAIL, 0]);

    // ticks that would sit on top of a zero rail's "0" label are dropped
    const xTicks = (log ? logTicks(x) : x.ticks(6)).filter((t) => !xZero || x(t) > RAIL + 14);
    const yTicks = (log ? logTicks(y) : y.ticks(6)).filter((t) => !yZero || y(t) < c.h - RAIL - 12);
    VK.axes(c, x, y, {
      xTicks, yTicks, xFormat: tickFmt(xKey, log && x), yFormat: tickFmt(yKey, log && y),
      xTitle: `${LABELS[xKey]}${xKey === "pagerank" ? " (directed, α = 0.85)" : ""}`,
      yTitle: LABELS[yKey],
    });
    c.plot.select(".axistitle").attr("y", c.h + 33);
    c.plot.selectAll(".axistitle").filter((d, i) => i === 1).attr("transform", `translate(-48,${c.h / 2}) rotate(-90)`);

    const px = (v) => (v > 0 || !log ? x(v) : RAIL / 2);
    const py = (v) => (v > 0 || !log ? y(v) : c.h - RAIL / 2);
    if (xZero) {
      c.plot.append("line").attr("class", "zerorail").attr("x1", RAIL).attr("x2", RAIL).attr("y1", 0).attr("y2", c.h);
      c.plot.append("text").attr("class", "ticktext").attr("x", RAIL / 2).attr("y", c.h + 16).attr("text-anchor", "middle").text("0");
    }
    if (yZero) {
      c.plot.append("line").attr("class", "zerorail").attr("x1", 0).attr("x2", c.w).attr("y1", c.h - RAIL).attr("y2", c.h - RAIL);
      c.plot.append("text").attr("class", "ticktext").attr("x", -8).attr("y", c.h - RAIL / 2 + 3.5).attr("text-anchor", "end").text("0");
    }

    // who does y crown that x does not?
    const topX = new Set(CS.topTen(xs)), topY = CS.topTen(ys);
    const flagged = new Set(topY.filter((i) => !topX.has(i)));
    const spider = names.indexOf("Spider-Man");
    const rx = CS.rankOf(xs), ry = CS.rankOf(ys);

    const order = d3.range(n).sort((a, b) => (flagged.has(a) ? 1 : 0) - (flagged.has(b) ? 1 : 0));
    const pts = c.plot.append("g");
    const circles = pts.selectAll("circle").data(order).join("circle")
      .attr("cx", (i) => px(xs[i])).attr("cy", (i) => py(ys[i]))
      .attr("r", (i) => (flagged.has(i) ? 5 : 4))
      .attr("fill", (i) => (flagged.has(i) ? col.surface : col.s1))
      .attr("fill-opacity", (i) => (flagged.has(i) ? 1 : 0.8))
      .attr("stroke", (i) => (flagged.has(i) ? accent : col.surface))
      .attr("stroke-width", (i) => (flagged.has(i) ? 2.2 : 1.2))
      .attr("data-i", (i) => i);

    // labels: the flagged characters plus Spider-Man as the anchor, nudged apart
    const labelled = [...flagged];
    if (spider >= 0 && !flagged.has(spider)) labelled.push(spider);
    const L = labelled.map((i) => ({ i, x: px(xs[i]), y: py(ys[i]), text: short(names[i]) }))
      .sort((a, b) => a.y - b.y);
    for (let k = 0; k < L.length; k++) {
      L[k].ly = L[k].y;
      for (let j = 0; j < k; j++)
        if (Math.abs(L[k].x - L[j].x) < 120 && L[k].ly - L[j].ly < 13) L[k].ly = L[j].ly + 13;
    }
    for (const l of L) {
      const right = l.x > c.w * 0.72;
      const t = VK.directLabel(c, l.x + (right ? -8 : 8), l.ly + 4, l.text, right ? "end" : "start");
      if (l.i === spider) t.attr("fill", col.muted).attr("font-weight", 500);
      else t.attr("fill", accent);
    }

    // legend
    $("legend").innerHTML =
      `<span class="key"><span class="swatch dot" style="background:${col.s1}"></span>one character</span>` +
      `<span class="key"><span class="swatch dot" style="background:${col.surface};border:2px solid ${accent};width:9px;height:9px"></span>` +
      `top ten by ${LABELS[yKey].toLowerCase()}, not by ${LABELS[xKey].toLowerCase()}</span>`;

    // top-ten table
    $("top").innerHTML = topY.map((i, k) =>
      `<tr class="${flagged.has(i) ? "new" : ""}" data-i="${i}"><td>${k + 1}</td><td class="nm">${short(names[i])}</td>` +
      `<td class="num">${fmtVal(yKey, ys[i])}</td><td class="num">${rx[i]}</td></tr>`).join("");

    // readout
    $("r-n").textContent = n;
    $("r-rho").textContent = xKey === yKey ? "1.00" : CS.spearman(xs, ys).toFixed(2);
    $("r-overlap").textContent = `${topY.filter((i) => topX.has(i)).length} of 10`;
    const zeros = log ? d3.range(n).filter((i) => xs[i] <= 0 || ys[i] <= 0).length : 0;
    $("r-zero").textContent = log ? `${zeros}` : "–";

    // hover
    const tip = $("tip"), panel = tip.parentElement;
    const show = (i, ev) => {
      tip.innerHTML = `<div class="nm">${names[i]}</div>` +
        `<div class="v">${LABELS[xKey]} ${fmtVal(xKey, xs[i])} (rank ${rx[i]})</div>` +
        `<div class="v">${LABELS[yKey]} ${fmtVal(yKey, ys[i])} (rank ${ry[i]})</div>`;
      tip.style.display = "block";
      const pr = panel.getBoundingClientRect();
      const lx = ev.clientX - pr.left, ly = ev.clientY - pr.top;
      tip.style.left = `${Math.min(lx + 14, pr.width - tip.offsetWidth - 4)}px`;
      tip.style.top = `${ly - 10}px`;
    };
    const hide = () => { tip.style.display = "none"; };
    circles.on("mousemove", (ev, i) => show(i, ev)).on("mouseleave", hide);
    const emph = (i, on) => circles.filter((d) => d === i).attr("r", on ? 7 : flagged.has(i) ? 5 : 4);
    $("top").querySelectorAll("tr").forEach((tr) => {
      const i = +tr.dataset.i;
      tr.addEventListener("mousemove", (ev) => { emph(i, true); show(i, ev); });
      tr.addEventListener("mouseleave", () => { emph(i, false); hide(); });
    });
  }

  MV.load().then((d) => {
    data = d;
    M = CS.measures(d);
    render();
  });
  window.addEventListener("resize", render);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
})();
