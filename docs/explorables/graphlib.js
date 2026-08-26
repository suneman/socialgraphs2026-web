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

  /* --- metrics --- */

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
    er, ringLattice, wattsStrogatz, baStepper, ba,
    degrees, components, gcc, localClustering, avgClustering,
    bfsDistances, avgPathLength, ccdf, erGiantFraction, mean,
  };
})();

// Allow node-based testing without a browser
if (typeof module !== "undefined") module.exports = GL;
