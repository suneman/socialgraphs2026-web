/* PageRank as a random walker. A walker hops along the out-links of a small
   directed network (8 nodes, fixed): with probability α it follows a random
   out-link, otherwise — or when the node has no out-links — it teleports to a
   uniformly random node. Its visit frequencies converge to the exact PageRank
   (power iteration with networkx's conventions: uniform teleport, dangling
   mass spread uniformly). The network is built to show why the teleport is
   needed: node F is a dead end (in-links only) and G ⇄ H is a trap with no
   way out — at α = 1 the trap absorbs the walker and PageRank puts all the
   mass there. The pure computation (RW) is node-requirable for the
   verification protocol; the UI is guarded behind a document check. */

"use strict";

const RW = (() => {
  const NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];
  // the fixed network: core A–D, E (three in-links, one out-link), F (dead end),
  // G ⇄ H (trap, reachable through D only)
  const EDGES = [
    ["A", "B"], ["A", "D"],
    ["B", "C"], ["B", "D"], ["B", "E"],
    ["C", "E"], ["C", "F"],
    ["D", "A"], ["D", "E"], ["D", "G"],
    ["E", "B"],
    ["G", "H"], ["H", "G"],
  ];
  const idx = (s) => NAMES.indexOf(s);
  const N = NAMES.length;
  const out = Array.from({ length: N }, () => []);
  for (const [a, b] of EDGES) out[idx(a)].push(idx(b));

  // Exact PageRank by power iteration (networkx pagerank conventions: uniform
  // teleport, dangling mass spread uniformly). The update is "lazy" — the new
  // vector is averaged with the old one — which has the same fixed point but
  // also converges at α = 1, where the G ⇄ H trap makes the plain iteration
  // oscillate with period 2 (networkx's pagerank fails to converge there).
  function pagerank(alpha, tol = 1e-10, maxIter = 20000) {
    let x = new Array(N).fill(1 / N);
    for (let it = 0; it < maxIter; it++) {
      const last = x;
      x = new Array(N).fill(0);
      let dangle = 0;
      for (let u = 0; u < N; u++) {
        if (out[u].length === 0) { dangle += last[u]; continue; }
        const share = last[u] / out[u].length;
        for (const v of out[u]) x[v] += share;
      }
      let err = 0;
      for (let v = 0; v < N; v++) {
        const nv = alpha * (x[v] + dangle / N) + (1 - alpha) / N;
        x[v] = (nv + last[v]) / 2;
        err += Math.abs(x[v] - last[v]);
      }
      if (err < tol) break;
    }
    return x;
  }

  // One step of the walk from node u. Returns {to, teleport}.
  function step(u, alpha, rnd = Math.random) {
    if (out[u].length > 0 && rnd() < alpha) {
      return { to: out[u][Math.floor(rnd() * out[u].length)], teleport: false };
    }
    return { to: Math.floor(rnd() * N), teleport: true };
  }

  return { NAMES, EDGES, N, out, pagerank, step };
})();

if (typeof module !== "undefined") module.exports = RW;

if (typeof document !== "undefined") (function () {
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";
  const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const N = RW.N, NAMES = RW.NAMES;
  const idx = (s) => NAMES.indexOf(s);

  // hand-placed layout (viewBox 440 × 300): core left, E and F middle, trap right
  const POS = { A: [55, 70], B: [55, 230], C: [165, 230], D: [165, 70], E: [275, 150], F: [275, 265], G: [365, 95], H: [365, 205] };
  const pos = NAMES.map((n) => POS[n]);
  const reciprocal = new Set();
  const edgeSet = new Set(RW.EDGES.map(([a, b]) => a + b));
  for (const [a, b] of RW.EDGES) if (edgeSet.has(b + a)) { reciprocal.add(a + b); }

  let alpha = 0.85;
  let walker = 0, steps = 0, teleports = 0;
  let visits = new Array(N).fill(0);
  let exact = RW.pagerank(alpha);
  let playing = false, lastHop = 0, animating = false;
  let teleTag = null; // node index to tag "teleport" for one step

  const net = $("net");

  /* --- geometry --- */

  const R_MIN = 13, R_MAX = 27;
  function radius(i) {
    const share = steps ? visits[i] / steps : 0;
    return Math.min(R_MAX, R_MIN + 30 * Math.sqrt(share));
  }

  // quadratic Bézier helpers; reciprocal pairs bend apart so both arrows show
  function control(a, b, bend) {
    const [x1, y1] = pos[a], [x2, y2] = pos[b];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const k = bend ? 22 : 0;
    return [(x1 + x2) / 2 + (-dy / len) * k, (y1 + y2) / 2 + (dx / len) * k];
  }
  const bez = (p0, p1, p2, t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  // parameter where the curve leaves a circle of radius r around an endpoint
  function tAtRadius(p0, p1, p2, fromStart, r) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const q = bez(p0, p1, p2, mid);
      const d = fromStart ? Math.hypot(q[0] - p0[0], q[1] - p0[1]) : Math.hypot(q[0] - p2[0], q[1] - p2[1]);
      if (fromStart ? d < r : d > r) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  // sub-curve between t0 and t1 (de Casteljau), as new control points
  function subCurve(p0, p1, p2, t0, t1) {
    const q0 = bez(p0, p1, p2, t0), q2 = bez(p0, p1, p2, t1);
    const d0 = [(1 - t0) * (p1[0] - p0[0]) + t0 * (p2[0] - p1[0]), (1 - t0) * (p1[1] - p0[1]) + t0 * (p2[1] - p1[1])];
    const d1 = [(1 - t1) * (p1[0] - p0[0]) + t1 * (p2[0] - p1[0]), (1 - t1) * (p1[1] - p0[1]) + t1 * (p2[1] - p1[1])];
    // tangent lines at q0 and q2 intersect at the new control point
    const den = d0[0] * d1[1] - d0[1] * d1[0];
    let q1;
    if (Math.abs(den) < 1e-9) q1 = [(q0[0] + q2[0]) / 2, (q0[1] + q2[1]) / 2];
    else {
      const s = ((q2[0] - q0[0]) * d1[1] - (q2[1] - q0[1]) * d1[0]) / den;
      q1 = [q0[0] + s * d0[0], q0[1] + s * d0[1]];
    }
    return [q0, q1, q2];
  }
  function edgeGeom(a, b) {
    const p0 = pos[a], p2 = pos[b], p1 = control(a, b, reciprocal.has(NAMES[a] + NAMES[b]));
    const t0 = tAtRadius(p0, p1, p2, true, radius(a) + 1);
    const t1 = tAtRadius(p0, p1, p2, false, radius(b) + 2.5);
    return subCurve(p0, p1, p2, t0, t1);
  }
  const pathD = ([q0, q1, q2]) => `M ${q0[0]} ${q0[1]} Q ${q1[0]} ${q1[1]} ${q2[0]} ${q2[1]}`;

  /* --- network panel --- */

  let walkerEl = null;

  function drawNet() {
    const css = VK.cssVar;
    while (net.firstChild) net.removeChild(net.firstChild);
    const defs = document.createElementNS(SVGNS, "defs");
    defs.innerHTML =
      '<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">' +
      `<path d="M 0 1 L 9 5 L 0 9 z" style="fill: ${css("--text-secondary")}"></path></marker>`;
    net.appendChild(defs);

    for (const [a, b] of RW.EDGES) {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", pathD(edgeGeom(idx(a), idx(b))));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", css("--text-secondary"));
      p.setAttribute("stroke-width", "1.4");
      p.setAttribute("opacity", "0.8");
      p.setAttribute("marker-end", "url(#arr)");
      net.appendChild(p);
    }

    for (let i = 0; i < N; i++) {
      const [x, y] = pos[i], r = radius(i);
      const g = document.createElementNS(SVGNS, "g");
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", r);
      c.setAttribute("fill", css("--series-1"));
      c.setAttribute("opacity", i === walker ? "1" : "0.85");
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y + 4.5); t.setAttribute("text-anchor", "middle");
      t.setAttribute("style", `font: 600 13px ${FONT}; fill: #fff`);
      t.textContent = NAMES[i];
      g.appendChild(c); g.appendChild(t);
      net.appendChild(g);
    }

    // small role notes: dead end and trap
    const note = (x, y, text, anchor = "middle") => {
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("text-anchor", anchor);
      t.setAttribute("class", "halo");
      t.setAttribute("style", `font: 11px ${FONT}; fill: ${css("--text-muted")}`);
      t.textContent = text;
      net.appendChild(t);
    };
    note(pos[idx("F")][0] + R_MAX + 4, pos[idx("F")][1] + 4, "dead end", "start");
    note((pos[idx("G")][0] + pos[idx("H")][0]) / 2 + R_MAX + 6, (pos[idx("G")][1] + pos[idx("H")][1]) / 2 + 4, "trap", "start");

    if (teleTag !== null) {
      const [x, y] = pos[teleTag];
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y - radius(teleTag) - 8); t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "halo");
      t.setAttribute("style", `font: 600 11px ${FONT}; fill: ${css("--accent")}`);
      t.textContent = "teleport";
      net.appendChild(t);
    }

    // the walker: an accent dot with a surface ring, drawn last
    const w = document.createElementNS(SVGNS, "g");
    const ring = document.createElementNS(SVGNS, "circle");
    ring.setAttribute("r", "9"); ring.setAttribute("fill", css("--surface-1"));
    const dot = document.createElementNS(SVGNS, "circle");
    dot.setAttribute("r", "7"); dot.setAttribute("fill", css("--accent"));
    w.appendChild(ring); w.appendChild(dot);
    w.setAttribute("transform", `translate(${pos[walker][0]},${pos[walker][1]})`);
    net.appendChild(w);
    walkerEl = w;
  }

  /* --- chart panel --- */

  function drawChart() {
    const c = VK.chart($("chart"), { margin: { top: 18, right: 12, bottom: 40, left: 46 } });
    const colors = VK.colors();
    const emp = visits.map((v) => (steps ? v / steps : 0));
    const yMax = Math.max(0.25, 1.18 * Math.max(d3.max(emp), d3.max(exact)));
    const x = d3.scaleBand().domain(NAMES).range([0, c.w]).paddingInner(0.32).paddingOuter(0.12);
    const y = d3.scaleLinear().domain([0, yMax]).range([c.h, 0]);
    VK.axes(c, { ticks: () => [] }, y, {
      xTicks: [], yTicks: y.ticks(5),
      yFormat: d3.format(".2f"),
      xTitle: "node", yTitle: "share of visits",
    });
    c.plot.selectAll(".xtick").data(NAMES).join("text")
      .attr("class", "ticktext xtick")
      .attr("x", (d) => x(d) + x.bandwidth() / 2).attr("y", c.h + 16)
      .attr("text-anchor", "middle").text((d) => d);

    // bars: the walker's empirical share
    c.plot.selectAll(".bar").data(NAMES).join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d)).attr("width", x.bandwidth())
      .attr("y", (d, i) => y(emp[i])).attr("height", (d, i) => c.h - y(emp[i]))
      .attr("fill", colors.s1).attr("opacity", 0.9);

    // exact PageRank: a tick across the band with a surface halo + value label
    NAMES.forEach((d, i) => {
      const x0 = x(d) - 3, x1 = x(d) + x.bandwidth() + 3, yy = y(exact[i]);
      c.plot.append("line").attr("x1", x0).attr("x2", x1).attr("y1", yy).attr("y2", yy)
        .attr("stroke", colors.surface).attr("stroke-width", 6).attr("stroke-linecap", "round");
      c.plot.append("line").attr("x1", x0).attr("x2", x1).attr("y1", yy).attr("y2", yy)
        .attr("stroke", colors.s2).attr("stroke-width", 2.5).attr("stroke-linecap", "round");
      c.plot.append("text").attr("class", "directlabel halo")
        .attr("x", (x0 + x1) / 2).attr("y", yy - 6).attr("text-anchor", "middle")
        .attr("font-size", "10.5px")
        .text(exact[i].toFixed(2));
    });
  }

  /* --- readout --- */

  function updateReadout() {
    const emp = visits.map((v) => (steps ? v / steps : 0));
    let gap = 0;
    for (let i = 0; i < N; i++) gap += Math.abs(emp[i] - exact[i]);
    let top = 0;
    for (let i = 1; i < N; i++) if (exact[i] > exact[top]) top = i;
    const ties = NAMES.filter((n, i) => Math.abs(exact[i] - exact[top]) < 1e-9);
    $("r-steps").textContent = steps;
    $("r-tele").textContent = teleports;
    $("r-gap").textContent = steps ? gap.toFixed(3) : "–";
    $("r-top").textContent = `${ties.join(", ")} (${exact[top].toFixed(3)})`;
  }

  function redraw() { drawNet(); drawChart(); updateReadout(); }

  /* --- the walk --- */

  function advance(animate) {
    const from = walker;
    const { to, teleport } = RW.step(from, alpha);
    walker = to; steps++; visits[to]++;
    if (teleport) teleports++;
    teleTag = teleport ? to : null;
    if (!animate || !walkerEl) { redraw(); return; }

    animating = true;
    if (teleport) {
      const el = d3.select(walkerEl);
      el.transition().duration(110).attr("opacity", 0)
        .on("end", () => {
          redraw();
          d3.select(walkerEl).attr("opacity", 0).transition().duration(110).attr("opacity", 1)
            .on("end", () => { animating = false; });
        });
    } else {
      const geom = edgeGeom(from, to);
      const el = d3.select(walkerEl);
      el.transition().duration(240).ease(d3.easeCubicInOut)
        .attrTween("transform", () => (t) => { const q = bez(geom[0], geom[1], geom[2], t); return `translate(${q[0]},${q[1]})`; })
        .on("end", () => { animating = false; redraw(); });
    }
  }

  function reset() {
    playing = false; animating = false;
    $("play").textContent = "▶ Play";
    walker = 0; steps = 0; teleports = 0; teleTag = null;
    visits = new Array(N).fill(0);
    exact = RW.pagerank(alpha);
    redraw();
  }

  function setPlaying(on) {
    playing = on;
    $("play").textContent = playing ? "⏸ Pause" : "▶ Play";
    if (playing) requestAnimationFrame(loop);
  }
  function loop(t) {
    if (!playing) return;
    if (t - lastHop > 350 && !animating) { advance(true); lastHop = t; }
    requestAnimationFrame(loop);
  }

  /* --- wiring --- */

  $("alpha").addEventListener("input", () => {
    alpha = +$("alpha").value;
    $("alpha-val").textContent = alpha.toFixed(2);
    exact = RW.pagerank(alpha);
    drawChart(); updateReadout();
  });
  $("step").addEventListener("click", () => { if (!animating) advance(true); });
  $("play").addEventListener("click", () => setPlaying(!playing));
  $("reset").addEventListener("click", reset);
  window.addEventListener("resize", () => drawChart());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);

  // on load: 400 instant steps so both panels have something to say
  reset();
  for (let i = 0; i < 400; i++) advance(false);
  teleTag = null;
  redraw();
})();
