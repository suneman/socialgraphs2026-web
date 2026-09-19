/* k-clique communities (Palla, Derényi, Farkas & Vicsek 2005) on a fixed toy network,
   built so that every k from 3 to 6 shows a different picture:
     k = 3  two communities, {A..E} and {E..M}, overlapping in E; K in none
     k = 4  two disjoint communities, {A,B,C,D} and {E,F,G,H,I,J,L,M}
     k = 5  one community, {E,F,G,H,I,J,L}: M has only three neighbors in the core
     k = 6  one community, the core 6-clique {E,F,G,H,I,L}
   The network: a 4-clique A–D; E hanging off C and D; a 6-clique E,F,G,H,I,L;
   J linked to F,G,H,I; M linked to F,G,H; K a pendant on A.
   Step / Play "roll" the community out one k-clique at a time (BFS over clique
   adjacency = sharing k − 1 nodes); Show all jumps to the finished picture.
   Communities are verified against networkx.community.k_clique_communities
   (tools/groundtruth/week4_kclique_toy.py). Layout is hand-placed. */

"use strict";

// Pure data + computation, node-requirable for the verification protocol.
const KC = (() => {
  const LABEL = "ABCDEFGHIJKLM";
  const id = (c) => LABEL.indexOf(c);
  const pairs = (s) => { const o = []; for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) o.push([id(s[i]), id(s[j])]); return o; };
  const EDGES = [
    ...pairs("ABCD"),                 // left 4-clique
    [id("C"), id("E")], [id("D"), id("E")],
    ...pairs("EFGHIL"),               // core 6-clique
    ...["F", "G", "H", "I"].map((x) => [id("J"), id(x)]),
    ...["F", "G", "H"].map((x) => [id("M"), id(x)]),
    [id("K"), id("A")],
  ].map(([a, b]) => (a < b ? [a, b] : [b, a]));
  const N = LABEL.length;
  const ADJ = Array.from({ length: N }, () => new Set());
  for (const [a, b] of EDGES) { ADJ[a].add(b); ADJ[b].add(a); }

  // every k-clique, as a sorted array of node ids
  function kCliques(k) {
    const out = [];
    const grow = (cl, start) => {
      if (cl.length === k) { out.push(cl.slice()); return; }
      for (let v = start; v < N; v++) {
        if (cl.every((u) => ADJ[u].has(v))) { cl.push(v); grow(cl, v + 1); cl.pop(); }
      }
    };
    grow([], 0);
    return out;
  }

  const shared = (a, b) => a.filter((x) => b.includes(x)).length;

  // communities = connected components of the clique graph (adjacent = share k−1 nodes).
  // Returns { cliques, comms: [{cliques: [idx...], nodes: [...]}], order } where order is the
  // BFS roll: [{clique, comm, from}] with `from` the clique it was reached from (or null).
  function communities(k) {
    const cliques = kCliques(k);
    const seen = new Array(cliques.length).fill(false);
    const comms = [], order = [];
    for (let s = 0; s < cliques.length; s++) {
      if (seen[s]) continue;
      const ci = comms.length, members = [];
      const q = [[s, null]]; seen[s] = true;
      while (q.length) {
        const [c, from] = q.shift();
        members.push(c); order.push({ clique: c, comm: ci, from });
        for (let d = 0; d < cliques.length; d++) {
          if (!seen[d] && shared(cliques[c], cliques[d]) === k - 1) { seen[d] = true; q.push([d, c]); }
        }
      }
      const nodes = [...new Set(members.flatMap((c) => cliques[c]))].sort((a, b) => a - b);
      comms.push({ cliques: members, nodes });
    }
    return { cliques, comms, order };
  }

  return { LABEL, EDGES, N, ADJ, kCliques, communities, shared };
})();
if (typeof module !== "undefined") module.exports = KC;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const svg = d3.select("#net");
  const L = KC.LABEL;
  const name = (i) => L[i];
  const names = (ids) => ids.map(name).join(", ");

  // hand-placed positions in the 600 × 330 viewBox
  const POS = {
    K: [38, 140], A: [118, 95], B: [118, 190], C: [205, 78], D: [205, 205], E: [292, 142],
    F: [370, 74], G: [446, 74], H: [484, 142], I: [446, 210], L: [370, 210],
    J: [560, 142], M: [408, 12],
  };
  // fit the hand-placed frame (x 38…560, y 12…210) into the 480 × 330 viewBox with a margin
  const fit = ([x, y]) => [22 + (x - 38) * (436 / 522), 24 + (y - 12) * (282 / 198)];
  const pos = L.split("").map((c) => fit(POS[c]));

  const WHY = {
    3: "Two triangles are adjacent when they share a side. C–D–E on the left and E–F–G on the right share only the node E, so the two communities touch at E without merging: E is in both. K is in no triangle, so K is in no community.",
    4: "The left group is exactly one 4-clique, A–B–C–D. E is in no 4-clique with them, so E now belongs only to the right community, and the overlap is gone. M joins the right through F–G–H–M.",
    5: "M has three neighbors in the core, so no 5-clique contains M and M drops out. J has four (F, G, H, I), so F–G–H–I–J is a 5-clique sharing four nodes with the core's, and J stays.",
    6: "The only 6-clique is the core E–F–G–H–I–L. One community of six; everyone else is out. Raise k and the method leaves most nodes behind, as the philosophers table shows.",
  };

  let k = 3, res = KC.communities(3), shown = Infinity, timer = null;
  const total = () => res.order.length;

  function setK(v) { k = v; res = KC.communities(k); shown = Infinity; stop(); draw(); }
  function stop() { if (timer) { clearInterval(timer); timer = null; $("play").textContent = "Play"; } }

  function draw() {
    svg.selectAll("*").remove();
    const accent = VK.cssVar("--accent"), muted = VK.cssVar("--text-muted");
    const surface = VK.cssVar("--surface-1"), ink = VK.cssVar("--text-primary");
    const cat = (c) => VK.cssVar(`--cat-${c + 1}`);
    const n = Math.min(shown, total());
    const revealed = res.order.slice(0, n);
    const current = n > 0 && n < total() ? revealed[n - 1] : null;

    // node → set of communities revealed so far; edge → community color
    const nodeComms = Array.from({ length: KC.N }, () => new Set());
    const edgeColor = new Map();
    const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    for (const { clique, comm } of revealed) {
      const cl = res.cliques[clique];
      for (const v of cl) nodeComms[v].add(comm);
      for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) edgeColor.set(key(cl[i], cl[j]), comm);
    }
    const curSet = current ? new Set(res.cliques[current.clique]) : new Set();
    const fromSet = current && current.from !== null ? new Set(res.cliques[current.from]) : new Set();
    const hinge = current ? [...curSet].filter((v) => fromSet.has(v)) : [];

    svg.selectAll(".link").data(KC.EDGES).join("line").attr("class", "link")
      .attr("x1", (d) => pos[d[0]][0]).attr("y1", (d) => pos[d[0]][1])
      .attr("x2", (d) => pos[d[1]][0]).attr("y2", (d) => pos[d[1]][1])
      .attr("stroke", (d) => (curSet.has(d[0]) && curSet.has(d[1]) ? accent : edgeColor.has(key(d[0], d[1])) ? cat(edgeColor.get(key(d[0], d[1]))) : muted))
      .attr("stroke-width", (d) => (curSet.has(d[0]) && curSet.has(d[1]) ? 4 : edgeColor.has(key(d[0], d[1])) ? 2.4 : 1.1))
      .attr("stroke-opacity", (d) => (edgeColor.has(key(d[0], d[1])) || (curSet.has(d[0]) && curSet.has(d[1])) ? 0.95 : 0.45));

    const R = 13;
    const nd = svg.selectAll(".node").data(d3.range(KC.N)).join("g").attr("class", "node")
      .attr("transform", (i) => `translate(${pos[i][0]},${pos[i][1]})`);
    nd.each(function (i) {
      const g = d3.select(this), cs = [...nodeComms[i]].sort();
      if (cs.length >= 2) {   // overlap node: two half-discs
        g.append("path").attr("d", `M0,${-R} A${R},${R} 0 0 0 0,${R} Z`).attr("fill", cat(cs[0]));
        g.append("path").attr("d", `M0,${-R} A${R},${R} 0 0 1 0,${R} Z`).attr("fill", cat(cs[1]));
        g.append("circle").attr("r", R).attr("fill", "none").attr("stroke", surface).attr("stroke-width", 1.5);
      } else {
        g.append("circle").attr("r", R).attr("fill", cs.length ? cat(cs[0]) : surface)
          .attr("stroke", cs.length ? surface : muted).attr("stroke-width", 1.6);
      }
      if (curSet.has(i)) g.append("circle").attr("r", R + 4).attr("fill", "none").attr("stroke", accent).attr("stroke-width", hinge.includes(i) ? 3 : 1.5).attr("stroke-dasharray", hinge.includes(i) ? null : "3 3");
      g.append("text").attr("text-anchor", "middle").attr("dy", "0.36em").attr("font-size", 12).attr("font-weight", 600)
        .attr("fill", cs.length ? "#fff" : ink).style("pointer-events", "none").text(name(i));
    });

    status(n, current, hinge, nodeComms);
  }

  function status(n, current, hinge, nodeComms) {
    const st = $("status"), why = $("why");
    const inAny = nodeComms.filter((s) => s.size).length;
    const overlap = nodeComms.filter((s) => s.size >= 2).length;
    $("r-cliques").textContent = `${n} of ${total()}`;
    $("r-comms").textContent = res.comms.length ? `${new Set(res.order.slice(0, n).map((o) => o.comm)).size} of ${res.comms.length}` : "0";
    $("r-in").textContent = `${inAny} of ${KC.N}`;
    $("r-overlap").textContent = overlap;
    $("step").disabled = n >= total();

    const commLine = res.comms.map((c, i) => `<b class="c${i + 1}">${names(c.nodes)}</b> (${c.cliques.length} ${k}-clique${c.cliques.length === 1 ? "" : "s"})`).join(" and ");
    const outside = d3.range(KC.N).filter((v) => !res.comms.some((c) => c.nodes.includes(v)));
    const done = `At <b>k = ${k}</b> there ${res.comms.length === 1 ? "is one community" : `are ${res.comms.length} communities`}: ${commLine}. ${overlap ? `Overlap: <b>${names(d3.range(KC.N).filter((v) => res.comms.filter((c) => c.nodes.includes(v)).length >= 2))}</b>. ` : "No node is in two communities. "}In none: <b>${outside.length ? names(outside) : "nobody"}</b>.`;

    if (n === 0) {
      st.innerHTML = `The network has <b>${res.cliques.length}</b> ${k}-cliques. Press <b>Step</b> to start from one and roll onto the next.`;
    } else if (current) {
      const cl = names(res.cliques[current.clique]);
      const from = current.from === null
        ? `Start of community ${current.comm + 1}: the ${k}-clique <b>${cl}</b>.`
        : `Rolled from <b>${names(res.cliques[current.from])}</b> onto <b>${cl}</b>: they share the ${k - 1} node${k > 2 ? "s" : ""} <b>${names(hinge)}</b> (solid ring), so they are adjacent and belong to the same community.`;
      st.innerHTML = from;
    } else {
      st.innerHTML = done;
    }
    why.textContent = WHY[k];
  }

  $("k").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $("k").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    setK(+b.dataset.v);
  });
  $("reset").addEventListener("click", () => { stop(); shown = 0; draw(); });
  $("step").addEventListener("click", () => { stop(); shown = Math.min(shown === Infinity ? 0 : shown, total()) + 1; draw(); });
  $("all").addEventListener("click", () => { stop(); shown = Infinity; draw(); });
  $("play").addEventListener("click", () => {
    if (timer) { stop(); return; }
    if (shown >= total()) shown = 0;
    $("play").textContent = "Pause";
    timer = setInterval(() => { shown = Math.min(shown, total()) + 1; draw(); if (shown >= total()) stop(); }, 700);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  draw();
})();
