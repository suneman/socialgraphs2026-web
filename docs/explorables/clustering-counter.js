/* The clustering coefficient, made clickable. Node A sits in the middle;
   six potential neighbors ring it. Attach or detach a neighbor and the
   denominator k(k−1)/2 changes; link two neighbors and the numerator e_A
   ticks up. Every number on the page follows from the picture, so a student
   can rehearse exactly the hand computation the midterm asks for. Exact
   values via graphlib.localClustering on the 7-node graph. */

"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const NAMES = ["A", "B", "C", "D", "E", "F", "G"];
  const RING = 6;
  const svg = d3.select("#net");

  let attached, links; // attached: bool[6] (B..G); links: Set of "i-j" among ring nodes 1..6

  const key = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);

  function reset() {
    attached = [true, true, true, true, false, false];
    links = new Set([key(1, 2), key(2, 3)]);
    draw();
  }

  function graph() {
    const g = GL.empty(7);
    attached.forEach((on, i) => { if (on) GL.addEdge(g, 0, i + 1); });
    for (const k of links) { const [a, b] = k.split("-").map(Number); GL.addEdge(g, a, b); }
    return g;
  }

  function neighbors() { return attached.map((on, i) => (on ? i + 1 : -1)).filter((i) => i > 0); }

  function ringPos(i, R) { // i = 1..6
    const a = (2 * Math.PI * (i - 1)) / RING - Math.PI / 2;
    return [R * Math.cos(a), R * Math.sin(a)];
  }

  function draw() {
    const node = svg.node();
    const W = node.clientWidth || 420, H = node.clientHeight || 320;
    const R = Math.min(W, H) / 2 - 34;
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${W / 2},${H / 2})`);
    const accent = VK.cssVar("--accent"), s1 = VK.cssVar("--series-1"), muted = VK.cssVar("--text-muted");
    const surface = VK.cssVar("--surface-1"), ink = VK.cssVar("--text-primary"), grid = VK.cssVar("--grid");
    const nb = neighbors();
    const pos = (i) => (i === 0 ? [0, 0] : ringPos(i, R));

    // spokes A–neighbor
    for (let i = 1; i <= RING; i++) {
      const [x, y] = pos(i);
      g.append("line").attr("x1", 0).attr("y1", 0).attr("x2", x).attr("y2", y)
        .attr("stroke", attached[i - 1] ? accent : grid).attr("stroke-width", attached[i - 1] ? 2 : 1)
        .attr("stroke-dasharray", attached[i - 1] ? null : "3 4");
    }
    // chords among attached neighbors: solid if linked, dashed ghost if not; both clickable
    for (let a = 0; a < nb.length; a++)
      for (let b = a + 1; b < nb.length; b++) {
        const i = nb[a], j = nb[b], on = links.has(key(i, j));
        const [x1, y1] = pos(i), [x2, y2] = pos(j);
        g.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
          .attr("stroke", "transparent").attr("stroke-width", 14).style("cursor", "pointer")
          .on("click", () => { if (on) links.delete(key(i, j)); else links.add(key(i, j)); draw(); });
        g.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
          .attr("stroke", on ? s1 : muted).attr("stroke-width", on ? 2.5 : 1)
          .attr("stroke-dasharray", on ? null : "4 4").attr("opacity", on ? 1 : 0.6)
          .style("pointer-events", "none");
      }
    // nodes
    for (let i = 0; i <= RING; i++) {
      const [x, y] = pos(i);
      const on = i === 0 || attached[i - 1];
      const n = g.append("g").attr("transform", `translate(${x},${y})`).style("cursor", i ? "pointer" : "default");
      if (i) n.on("click", () => {
        attached[i - 1] = !attached[i - 1];
        if (!attached[i - 1]) for (const k of [...links]) if (k.split("-").map(Number).includes(i)) links.delete(k);
        draw();
      });
      n.append("circle").attr("r", i === 0 ? 17 : 14)
        .attr("fill", i === 0 ? accent : on ? surface : surface)
        .attr("stroke", i === 0 ? accent : on ? s1 : muted).attr("stroke-width", on ? 2.5 : 1.2)
        .attr("stroke-dasharray", on ? null : "3 3");
      n.append("text").attr("text-anchor", "middle").attr("dy", 5)
        .attr("font-size", 13).attr("font-weight", 600)
        .attr("fill", i === 0 ? "#fff" : on ? ink : muted).text(NAMES[i]);
    }

    // numbers
    const G = graph();
    const k = nb.length, pairs = (k * (k - 1)) / 2;
    let e = 0;
    for (let a = 0; a < nb.length; a++) for (let b = a + 1; b < nb.length; b++) if (links.has(key(nb[a], nb[b]))) e++;
    const cA = GL.localClustering(G, 0), avg = GL.avgClustering(G);
    const frac = (n, d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;
    $("formula").innerHTML = k < 2
      ? `C<sub>A</sub> is undefined — A has ${k} neighbor${k === 1 ? "" : "s"}, so there are no pairs to check (we set it to 0).`
      : `C<sub>A</sub> = ${frac("e<sub>A</sub>", "k<sub>A</sub>(k<sub>A</sub>−1)/2")} = ${frac(`<b>${e}</b>`, `${k}·${k - 1}/2`)} = ${frac(`<b>${e}</b>`, `<b>${pairs}</b>`)} = <b>${cA.toFixed(3)}</b>`;
    $("r-k").textContent = k;
    $("r-pairs").textContent = pairs;
    $("r-e").textContent = e;
    $("r-c").textContent = k < 2 ? "0 (undefined)" : cA.toFixed(3);
    $("r-avg").textContent = avg.toFixed(3);
    const degs = GL.degrees(G);
    $("table").innerHTML = "<tr><th>node</th><th>k</th><th>C_i</th></tr>" +
      NAMES.map((nm, i) => `<tr${i === 0 ? ' class="me"' : ""}><td>${nm}</td><td>${degs[i]}</td><td>${degs[i] < 2 ? "0 (undef.)" : GL.localClustering(G, i).toFixed(3)}</td></tr>`).join("");
  }

  $("reset").addEventListener("click", reset);
  $("random").addEventListener("click", () => {
    attached = attached.map(() => Math.random() < 0.65);
    if (neighbors().length < 2) attached[0] = attached[1] = true;
    links = new Set();
    const nb = neighbors();
    for (let a = 0; a < nb.length; a++) for (let b = a + 1; b < nb.length; b++) if (Math.random() < 0.4) links.add(key(nb[a], nb[b]));
    draw();
  });
  $("clique").addEventListener("click", () => {
    const nb = neighbors();
    for (let a = 0; a < nb.length; a++) for (let b = a + 1; b < nb.length; b++) links.add(key(nb[a], nb[b]));
    draw();
  });
  $("star").addEventListener("click", () => { links = new Set(); draw(); });
  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  reset();
})();
