/* graphlib.js — tiny network toolkit for the 02805 explorables.
   Plain data: a graph is {n, edges:[[a,b],...], adj:[[neighbors],...]}.
   Everything here is exact (no approximations) at explorable scale (n ≤ ~500). */

"use strict";

const GL = (() => {

  function empty(n) {
    return { n, edges: [], adj: Array.from({ length: n }, () => []) };
  }

  function addEdge(g, a, b) {
    g.edges.push([a, b]);
    g.adj[a].push(b);
    g.adj[b].push(a);
  }

  function hasEdge(g, a, b) {
    return g.adj[a].includes(b);
  }

  /* --- generators --- */

  // Erdős–Rényi G(n, p) parameterized by target mean degree <k> = p(n-1)
  function er(n, avgK) {
    const g = empty(n);
    const p = Math.min(1, avgK / (n - 1));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.random() < p) addEdge(g, i, j);
    return g;
  }

  // Ring lattice: each node linked to k/2 nearest neighbors on each side
  function ringLattice(n, k) {
    const g = empty(n);
    const half = Math.floor(k / 2);
    for (let i = 0; i < n; i++)
      for (let d = 1; d <= half; d++)
        addEdge(g, i, (i + d) % n);
    return g;
  }

  // Watts–Strogatz: rewire the far end of each lattice edge with prob p.
  // Marks rewired edges (edge[2] === 1) so they can be drawn differently.
  function wattsStrogatz(n, k, p) {
    const g = empty(n);
    const half = Math.floor(k / 2);
    for (let i = 0; i < n; i++) {
      for (let d = 1; d <= half; d++) {
        const j = (i + d) % n;
        if (Math.random() < p) {
          let t = Math.floor(Math.random() * n), guard = 0;
          while ((t === i || hasEdge(g, i, t)) && guard++ < 50)
            t = Math.floor(Math.random() * n);
          if (t !== i && !hasEdge(g, i, t)) {
            g.edges.push([i, t, 1]);
            g.adj[i].push(t); g.adj[t].push(i);
            continue;
          }
        }
        if (!hasEdge(g, i, j)) addEdge(g, i, j);
      }
    }
    return g;
  }

  // Barabási–Albert stepper: preferential attachment via the flattened
  // target list (each node appears once per link end — degree-proportional).
  function baStepper(m) {
    const g = empty(0);
    const targets = [];
    // seed: a small clique of m+1 nodes so the first arrival has m targets
    const seed = m + 1;
    for (let i = 0; i < seed; i++) { g.adj.push([]); g.n++; }
    for (let i = 0; i < seed; i++)
      for (let j = i + 1; j < seed; j++) {
        addEdge(g, i, j); targets.push(i, j);
      }
    return {
      graph: g,
      addNode() {
        const id = g.n;
        g.adj.push([]); g.n++;
        const chosen = new Set();
        let guard = 0;
        while (chosen.size < Math.min(m, id) && guard++ < 400)
          chosen.add(targets[Math.floor(Math.random() * targets.length)]);
        chosen.forEach((t) => { addEdge(g, id, t); targets.push(id, t); });
        return id;
      },
    };
  }

  function ba(n, m) {
    const s = baStepper(m);
    while (s.graph.n < n) s.addNode();
    return s.graph;
  }

  // Erdős–Rényi G(n, m): exactly m distinct links, uniformly at random
  function gnm(n, m, rnd = Math.random) {
    const g = empty(n);
    const seen = new Set();
    const cap = (n * (n - 1)) / 2;
    while (g.edges.length < Math.min(m, cap)) {
      const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n);
      if (a === b) continue;
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      if (seen.has(key)) continue;
      seen.add(key);
      addEdge(g, a, b);
    }
    return g;
  }

  function clone(g) {
    return { n: g.n, edges: g.edges.map((e) => e.slice()), adj: g.adj.map((a) => a.slice()) };
  }

  /* --- shuffling --- */

  // Degree-preserving randomization, in place: pick two links a–b and c–d,
  // rewire to a–d and c–b (random orientation); reject self-loops and
  // duplicates. Counts only successful swaps toward nswap. The degree of
  // every node is untouched; everything else is scrambled. Returns the
  // number of swaps performed.
  function doubleEdgeSwap(g, nswap, rnd = Math.random) {
    const E = g.edges, m = E.length;
    if (m < 2) return 0;
    const drop = (u, v) => { const a = g.adj[u], i = a.indexOf(v); a[i] = a[a.length - 1]; a.pop(); };
    let done = 0, tries = 0, maxTries = 100 * nswap;
    while (done < nswap && tries++ < maxTries) {
      const i = Math.floor(rnd() * m), j = Math.floor(rnd() * m);
      if (i === j) continue;
      let [a, b] = E[i], [c, d] = E[j];
      if (rnd() < 0.5) [c, d] = [d, c];
      if (a === d || c === b || a === c || b === d) continue;
      if (hasEdge(g, a, d) || hasEdge(g, c, b)) continue;
      drop(a, b); drop(b, a); drop(c, d); drop(d, c);
      g.adj[a].push(d); g.adj[d].push(a); g.adj[c].push(b); g.adj[b].push(c);
      E[i] = [a, d]; E[j] = [c, b];
      done++;
    }
    return done;
  }

  /* --- metrics --- */

  // number of triangles in the graph
  function triangles(g) {
    let t = 0;
    const sets = g.adj.map((a) => new Set(a));
    for (const [a, b] of g.edges)
      for (const w of g.adj[a]) if (w !== b && sets[b].has(w)) t++;
    return t / 3; // each triangle seen once per edge
  }

  // global clustering: 3 × triangles / connected triples
  function transitivity(g) {
    let triples = 0;
    for (const a of g.adj) triples += (a.length * (a.length - 1)) / 2;
    return triples ? (3 * triangles(g)) / triples : 0;
  }

  function degrees(g) {
    return g.adj.map((a) => a.length);
  }

  function components(g) {
    const comp = new Array(g.n).fill(-1);
    const out = [];
    for (let s = 0; s < g.n; s++) {
      if (comp[s] !== -1) continue;
      const c = out.length, queue = [s], members = [];
      comp[s] = c;
      while (queue.length) {
        const v = queue.pop();
        members.push(v);
        for (const w of g.adj[v]) if (comp[w] === -1) { comp[w] = c; queue.push(w); }
      }
      out.push(members);
    }
    return { assignment: comp, members: out };
  }

  function gcc(g) {
    const { members } = components(g);
    let best = [];
    for (const m of members) if (m.length > best.length) best = m;
    return best;
  }

  function localClustering(g, i) {
    const nb = g.adj[i];
    const k = nb.length;
    if (k < 2) return 0;
    const set = new Set(nb);
    let links = 0;
    for (const u of nb) for (const w of g.adj[u]) if (w > u && set.has(w)) links++;
    return (2 * links) / (k * (k - 1));
  }

  function avgClustering(g) {
    let s = 0;
    for (let i = 0; i < g.n; i++) s += localClustering(g, i);
    return s / g.n;
  }

  function bfsDistances(g, src) {
    const dist = new Array(g.n).fill(-1);
    dist[src] = 0;
    const queue = [src];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      for (const w of g.adj[v]) if (dist[w] === -1) { dist[w] = dist[v] + 1; queue.push(w); }
    }
    return dist;
  }

  // Exact mean shortest path over the given node set (default: GCC)
  function avgPathLength(g, nodeSet) {
    const nodes = nodeSet || gcc(g);
    const inSet = new Set(nodes);
    let sum = 0, count = 0;
    for (const s of nodes) {
      const dist = bfsDistances(g, s);
      for (const t of nodes) if (t > s && inSet.has(t) && dist[t] > 0) { sum += dist[t]; count++; }
    }
    return count ? sum / count : NaN;
  }

  // CCDF of a degree sequence: [{k, p: P(K >= k)}] for k >= 1
  function ccdf(degs) {
    const n = degs.length;
    const sorted = [...degs].sort((a, b) => a - b);
    const out = [];
    let seen = null;
    for (let i = 0; i < n; i++) {
      const k = sorted[i];
      if (k < 1 || k === seen) continue;
      seen = k;
      out.push({ k, p: (n - i) / n });
    }
    return out;
  }

  // Theoretical ER giant-component fraction: S = 1 - exp(-<k> S)
  function erGiantFraction(avgK) {
    if (avgK <= 1) return 0;
    let s = 0.5;
    for (let i = 0; i < 100; i++) s = 1 - Math.exp(-avgK * s);
    return s;
  }

  function mean(xs) {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  }

  return {
    empty, addEdge, hasEdge,
    er, gnm, clone, ringLattice, wattsStrogatz, baStepper, ba, doubleEdgeSwap,
    degrees, components, gcc, localClustering, avgClustering, triangles, transitivity,
    bfsDistances, avgPathLength, ccdf, erGiantFraction, mean,
  };
})();

// Allow node-based testing without a browser
if (typeof module !== "undefined") module.exports = GL;
