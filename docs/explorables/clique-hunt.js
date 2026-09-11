/* Clique hunt — a small random network, fresh every time, with exactly one
   k-clique (k = 3, 4, or 5) planted in it and no other clique that large.
   Click k nodes; if every pair among them is linked, you found it. The
   generator draws G(n, p), plants the clique, and keeps the draw only if
   Bron–Kerbosch reports one maximal clique of size ≥ k (of size exactly k),
   a connected network, and at least two decoy (k−1)-cliques elsewhere so
   there is something to hunt. Layout is a settled force layout. */

"use strict";

// Pure helpers, node-requirable for the verification protocol.
const CH = (() => {
  const key = (a, b) => (a < b ? a * 1000 + b : b * 1000 + a);

  // all maximal cliques (Bron–Kerbosch with pivoting); fine for n ≤ ~30
  function maximalCliques(g) {
    const sets = g.adj.map((a) => new Set(a));
    const out = [];
    const bk = (R, P, X) => {
      if (!P.size && !X.size) { out.push([...R].sort((a, b) => a - b)); return; }
      let pivot = -1, best = -1;
      for (const u of [...P, ...X]) {
        let c = 0; for (const v of P) if (sets[u].has(v)) c++;
        if (c > best) { best = c; pivot = u; }
      }
      for (const v of [...P]) {
        if (sets[pivot].has(v)) continue;
        const nv = sets[v];
        bk(new Set([...R, v]), new Set([...P].filter((w) => nv.has(w))), new Set([...X].filter((w) => nv.has(w))));
        P.delete(v); X.add(v);
      }
    };
    bk(new Set(), new Set(d3range(g.n)), new Set());
    return out;
  }
  const d3range = (n) => Array.from({ length: n }, (_, i) => i);

  const PARAMS = { 3: { n: 10, p: 0.2 }, 4: { n: 12, p: 0.3 }, 5: { n: 14, p: 0.36 } };

  // G(n, p) + one planted k-clique; returns { g, clique } or null if the draw fails the checks
  function attempt(k, rnd) {
    const { n, p } = PARAMS[k];
    const g = { n, edges: [], adj: Array.from({ length: n }, () => []) };
    const seen = new Set();
    const add = (a, b) => { if (a === b || seen.has(key(a, b))) return; seen.add(key(a, b)); g.edges.push(a < b ? [a, b] : [b, a]); g.adj[a].push(b); g.adj[b].push(a); };
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (rnd() < p) add(a, b);
    const ids = d3range(n).sort(() => rnd() - 0.5).slice(0, k).sort((a, b) => a - b);
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) add(ids[i], ids[j]);
    if (GL.gcc(g).length !== n) return null;
    const cl = maximalCliques(g);
    const big = cl.filter((c) => c.length >= k);
    if (big.length !== 1 || big[0].length !== k) return null;
    const decoys = cl.filter((c) => c.length === k - 1).length;
    if (k > 3 && decoys < 2) return null;
    if (k === 3 && g.edges.length < n + 1) return null;
    return { g, clique: ids };
  }

  function generate(k, rnd = Math.random) {
    for (let t = 0; t < 400; t++) { const r = attempt(k, rnd); if (r) return r; }
    return attempt(k, rnd) || generate(k, rnd);
  }

  // is every pair among `ids` linked? returns the missing pairs
  function missingPairs(g, ids) {
    const sets = g.adj.map((a) => new Set(a));
    const out = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
      if (!sets[ids[i]].has(ids[j])) out.push([ids[i], ids[j]]);
    return out;
  }

  return { maximalCliques, generate, missingPairs, PARAMS };
})();
if (typeof module !== "undefined") module.exports = CH;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const svg = d3.select("#net");
  const LABEL = "ABCDEFGHIJKLMNOP";

  let k = 4, g = null, clique = [], picked = [], found = 0, solved = false, revealed = false;
  let pos = [];

  function layout() {
    const W = $("net").clientWidth || 480, H = $("net").clientHeight || 340;
    const ns = Array.from({ length: g.n }, (_, i) => ({ index: i }));
    const ls = g.edges.map(([a, b]) => ({ source: a, target: b }));
    const sim = d3.forceSimulation(ns)
      .force("link", d3.forceLink(ls).id((d) => d.index).distance(70).strength(0.6))
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide(22))
      .stop();
    sim.tick(400);
    const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = 22;
    const s = Math.min((W - 2 * pad) / Math.max(1, x1 - x0), (H - 2 * pad) / Math.max(1, y1 - y0));
    const ox = W / 2 - s * (x0 + x1) / 2, oy = H / 2 - s * (y0 + y1) / 2;
    pos = ns.map((d) => [ox + s * d.x, oy + s * d.y]);
  }

  function fresh() {
    ({ g, clique } = CH.generate(k));
    picked = []; solved = false; revealed = false;
    $("net-title").textContent = `A fresh random network with exactly one ${k}-clique hidden in it`;
    layout();
    draw();
  }

  function pairCount(n) { return (n * (n - 1)) / 2; }
  const names = (ids) => ids.map((i) => LABEL[i]).join(", ");

  function draw() {
    svg.selectAll("*").remove();
    const accent = VK.cssVar("--accent"), muted = VK.cssVar("--text-muted");
    const surface = VK.cssVar("--surface-1"), ink = VK.cssVar("--text-primary");
    const inPick = new Set(picked);
    const showing = revealed ? new Set(clique) : inPick;
    const missing = CH.missingPairs(g, [...showing]);

    svg.selectAll(".link").data(g.edges).join("line").attr("class", "link")
      .attr("x1", (d) => pos[d[0]][0]).attr("y1", (d) => pos[d[0]][1])
      .attr("x2", (d) => pos[d[1]][0]).attr("y2", (d) => pos[d[1]][1])
      .attr("stroke", (d) => (showing.has(d[0]) && showing.has(d[1]) ? accent : muted))
      .attr("stroke-width", (d) => (showing.has(d[0]) && showing.has(d[1]) ? 3 : 1.2))
      .attr("stroke-opacity", (d) => (showing.has(d[0]) && showing.has(d[1]) ? 1 : 0.55));

    svg.selectAll(".miss").data(missing).join("line").attr("class", "miss")
      .attr("x1", (d) => pos[d[0]][0]).attr("y1", (d) => pos[d[0]][1])
      .attr("x2", (d) => pos[d[1]][0]).attr("y2", (d) => pos[d[1]][1])
      .attr("stroke", accent).attr("stroke-width", 1.5).attr("stroke-dasharray", "4 5").attr("stroke-opacity", 0.7);

    const nd = svg.selectAll(".node").data(d3.range(g.n)).join("g").attr("class", "node")
      .attr("transform", (i) => `translate(${pos[i][0]},${pos[i][1]})`)
      .style("cursor", "pointer")
      .on("click", (e, i) => pick(i));
    nd.append("circle").attr("class", "node").attr("r", 13)
      .attr("fill", (i) => (showing.has(i) ? accent : surface))
      .attr("stroke", (i) => (showing.has(i) ? accent : muted)).attr("stroke-width", 1.6);
    nd.append("text").attr("text-anchor", "middle").attr("dy", "0.36em")
      .attr("font-size", 12).attr("font-weight", 600)
      .attr("fill", (i) => (showing.has(i) ? "#fff" : ink))
      .style("pointer-events", "none")
      .text((i) => LABEL[i]);

    status(missing);
  }

  function status(missing) {
    const need = pairCount(k);
    const st = $("status"), why = $("why");
    const linked = pairCount(picked.length) - CH.missingPairs(g, picked).length;
    $("r-picked").textContent = `${picked.length} of ${k}`;
    $("r-pairs").textContent = picked.length >= 2 ? `${linked} of ${pairCount(picked.length)}` : "–";
    $("r-found").textContent = found;
    $("r-tri").textContent = GL.triangles(g);

    if (revealed) {
      st.innerHTML = `The ${k}-clique is <b>${names(clique)}</b>: all ${need} pairs linked, drawn in violet. Press <b>New network</b> to try another.`;
      why.textContent = "";
      return;
    }
    if (solved) {
      st.innerHTML = `<span class="win">🎉 ${names(picked)} is the ${k}-clique.</span> Every one of its ${need} pairs is linked, and no other set of ${k} nodes here manages that.`;
      why.textContent = k === 3
        ? `A 3-clique is just a triangle, and this network was built to contain exactly one. Try the 4-clique.`
        : `Every ${k}-clique contains ${k} cliques of size ${k - 1}${k === 4 ? " (four triangles)" : ""}, and this network has ${GL.triangles(g)} triangles in all, so most of what looked promising was a decoy. Being in a clique is a strict property: one missing link and it is gone.`;
      return;
    }
    if (!picked.length) {
      st.innerHTML = `Pick <b>${k}</b> nodes that are <b>all linked to each other</b>. A ${k}-clique has ${need} links: every pair. There is exactly one in this network.`;
      why.textContent = "Tip: start from a node with many links and look for neighbors that are also linked to each other.";
      return;
    }
    if (picked.length < k) {
      const miss = CH.missingPairs(g, picked);
      st.innerHTML = `<b>${names(picked)}</b> picked, ${k - picked.length} to go. ${miss.length ? `Already not a clique: ${miss.map(([a, b]) => LABEL[a] + "–" + LABEL[b]).join(", ")} ${miss.length > 1 ? "are" : "is"} not linked (dashed).` : picked.length >= 2 ? "So far every pair is linked." : ""}`;
      why.textContent = "";
      return;
    }
    // k picked, not a clique
    st.innerHTML = `<b>${names(picked)}</b> is not a ${k}-clique: ${missing.length} of the ${need} pairs ${missing.length > 1 ? "are" : "is"} missing — ${missing.map(([a, b]) => LABEL[a] + "–" + LABEL[b]).join(", ")} (dashed). Unpick a node and try again.`;
    why.textContent = missing.length === 1 ? "One missing link is enough. That is what makes cliques so rare in real networks." : "";
  }

  function pick(i) {
    if (solved || revealed) return;
    const at = picked.indexOf(i);
    if (at >= 0) picked.splice(at, 1);
    else if (picked.length < k) picked.push(i);
    else return;
    if (picked.length === k && CH.missingPairs(g, picked).length === 0) { solved = true; found++; }
    draw();
  }

  $("size").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $("size").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    k = +b.dataset.v;
    fresh();
  });
  $("new").addEventListener("click", fresh);
  $("clear").addEventListener("click", () => { if (revealed) return; picked = []; solved = false; draw(); });
  $("reveal").addEventListener("click", () => { revealed = true; solved = false; draw(); });
  window.addEventListener("resize", () => { layout(); draw(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  fresh();
})();
