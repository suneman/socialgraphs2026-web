/* marvel.js — shared loader for the playground corpus (docs/data/week1_*.tsv).
   Parses the frozen snapshot, builds index-based directed and undirected
   edge lists, and extracts the giant component. Used by every data-driven
   explorable that needs the network as a graph (shuffle-test, …); the
   parsing helpers mirror layouts.js. Node-requirable (pass the file texts)
   for the verification protocol. */

"use strict";

const MV = (() => {
  function parseEdges(text) {
    return text.split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("\t"))
      .filter((f) => f.length >= 2 && f[0] !== "source");
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

  const key = (a, b) => (a < b ? a * 100000 + b : b * 100000 + a);

  // directed index pairs (deduplicated, no self-loops) + undirected pairs
  function indexEdges(nodes, edges) {
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const seenD = new Set(), seenU = new Set(), directed = [], undirected = [];
    for (const [s, t] of edges) {
      const a = idx.get(s), b = idx.get(t);
      if (a === undefined || b === undefined || a === b) continue;
      const kd = a * 100000 + b;
      if (!seenD.has(kd)) { seenD.add(kd); directed.push([a, b]); }
      const ku = key(a, b);
      if (!seenU.has(ku)) { seenU.add(ku); undirected.push(a < b ? [a, b] : [b, a]); }
    }
    return { directed, undirected };
  }

  function giantComponent(n, undirected) {
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of undirected) { adj[a].push(b); adj[b].push(a); }
    const comp = new Array(n).fill(-1);
    let best = [];
    for (let s = 0; s < n; s++) {
      if (comp[s] !== -1) continue;
      const stack = [s], members = [];
      comp[s] = s;
      while (stack.length) {
        const v = stack.pop();
        members.push(v);
        for (const w of adj[v]) if (comp[w] === -1) { comp[w] = s; stack.push(w); }
      }
      if (members.length > best.length) best = members;
    }
    return best.sort((a, b) => a - b);
  }

  // Build the dataset from the two file texts. Returns the full node roster
  // and, for the giant component, re-indexed nodes + both edge lists.
  function build(edgeText, nodeText) {
    const nodes = parseNodes(nodeText);
    const { directed, undirected } = indexEdges(nodes, parseEdges(edgeText));
    const keep = giantComponent(nodes.length, undirected);
    const remap = new Map(keep.map((v, i) => [v, i]));
    const gcc = {
      nodes: keep.map((v) => nodes[v]),
      undirected: undirected.filter(([a, b]) => remap.has(a) && remap.has(b))
        .map(([a, b]) => [remap.get(a), remap.get(b)]),
      directed: directed.filter(([a, b]) => remap.has(a) && remap.has(b))
        .map(([a, b]) => [remap.get(a), remap.get(b)]),
    };
    return { nodes, directed, undirected, gcc };
  }

  // graphlib graph from an undirected index edge list
  function toGraph(n, undirected) {
    const g = { n, edges: [], adj: Array.from({ length: n }, () => []) };
    for (const [a, b] of undirected) { g.edges.push([a, b]); g.adj[a].push(b); g.adj[b].push(a); }
    return g;
  }

  // Browser entry point: fetch the frozen week-1 snapshot
  function load() {
    return Promise.all([
      fetch("../data/week1_edges.tsv").then((r) => r.text()),
      fetch("../data/week1_nodes.tsv").then((r) => r.text()),
    ]).then(([et, nt]) => build(et, nt));
  }

  // deterministic LCG so "random" is the same picture for everyone
  function lcg(seed) {
    let s = seed >>> 0;
    return () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
  }

  return { parseEdges, parseNodes, indexEdges, giantComponent, build, toGraph, load, lcg };
})();
if (typeof module !== "undefined") module.exports = MV;
