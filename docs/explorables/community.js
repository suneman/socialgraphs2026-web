/* community.js — shared community-detection toolkit for the 02805 explorables.
   Extracted from layouts.js (2026-09-06, week 4) so that layouts, louvain-steps
   and backbone run ONE Louvain implementation. Deterministic: nodes are visited
   in ascending order, ties break toward the lowest community id, so every
   browser sees the same partition (verified against networkx's Louvain range
   on the Marvel giant component: 7–9 communities, Q 0.37–0.39).

   Edges are [a, b] or [a, b, w] (weight defaults to 1). Node-requirable for
   the verification protocol. */

"use strict";

const CM = (() => {

  /* --- the working graph: {n, links:[[a,b,w]], self:[w_i]} ---
     self[i] is the internal weight of an aggregated node (a self-loop of
     weight w counts 2w toward the node's strength, as in networkx). */
  function fromEdges(n, edges) {
    return {
      n,
      links: edges.map(([a, b, w]) => [a, b, w === undefined ? 1 : w]),
      self: new Array(n).fill(0),
    };
  }

  /* Newman–Girvan modularity of a partition on an undirected graph, weights
     honored: Q = 1/2W Σ_ij (w_ij − s_i s_j / 2W) δ(c_i, c_j). */
  function modularity(n, edges, comm) {
    const strength = new Array(n).fill(0);
    let W = 0;
    const inW = new Map();
    for (const e of edges) {
      const a = e[0], b = e[1], w = e[2] === undefined ? 1 : e[2];
      strength[a] += w; strength[b] += w; W += w;
      if (comm[a] === comm[b]) inW.set(comm[a], (inW.get(comm[a]) || 0) + w);
    }
    if (!W) return 0;
    const tot = new Map();
    for (let i = 0; i < n; i++) tot.set(comm[i], (tot.get(comm[i]) || 0) + strength[i]);
    let q = 0;
    for (const c of tot.keys()) q += (inW.get(c) || 0) / W - Math.pow(tot.get(c) / (2 * W), 2);
    return q;
  }

  /* Louvain, one node visit at a time. The batch algorithm (louvain below)
     is exactly this stepper run to completion, so what the explorable shows
     is what the page reports.

     state.phase: "move" (phase 1, sweeping nodes) | "converged" (a full sweep
     moved nothing — aggregate next) | "done".
     step()      visit the next node; move it to the neighboring community
                 with the largest modularity gain if that gain is positive.
                 Returns {node, from, to, moved, sweepDone, converged}.
     nextMove()  step until a node actually moves (or the level converges).
     sweep()     one full pass over every node of the current level.
     aggregate() phase 2: collapse communities into super-nodes. Returns
                 false when nothing changed (algorithm done).
     run()       to completion. labels() current community per ORIGINAL node
                 (stable ids: the smallest original node index in the
                 community, so colors keyed on them do not flip between
                 steps); bySize() the same partition renumbered largest-first
                 (the batch result); Q() modularity on the original graph. */
  function louvainStepper(n, edges) {
    const original = edges;
    let g = fromEdges(n, edges);
    let assign = Array.from({ length: n }, (_, i) => i); // original node → level node
    let level = 0, moves = 0, visits = 0;
    let L = null; // per-level working state
    let phase = "move";

    function openLevel() {
      const k = new Array(g.n).fill(0);
      const adjW = Array.from({ length: g.n }, () => new Map());
      let m2 = 0;
      for (const [a, b, w] of g.links) {
        k[a] += w; k[b] += w; m2 += 2 * w;
        adjW[a].set(b, (adjW[a].get(b) || 0) + w);
        adjW[b].set(a, (adjW[b].get(a) || 0) + w);
      }
      for (let i = 0; i < g.n; i++) { k[i] += 2 * g.self[i]; m2 += 2 * g.self[i]; }
      L = {
        k, adjW, m2,
        comm: Array.from({ length: g.n }, (_, i) => i),
        tot: k.slice(),
        next: 0,            // next node to visit in this sweep
        movedThisSweep: false,
        improved: false,    // any move at this level at all
        sweeps: 0,
      };
      phase = "move";
    }

    function step() {
      if (phase !== "move") return { moved: false, sweepDone: false, converged: phase === "converged", done: phase === "done" };
      const i = L.next;
      const { k, adjW, m2, comm, tot } = L;
      const ci = comm[i];
      const wTo = new Map();
      for (const [j, w] of adjW[i]) wTo.set(comm[j], (wTo.get(comm[j]) || 0) + w);
      tot[ci] -= k[i];
      let bestC = ci, bestGain = (wTo.get(ci) || 0) - (tot[ci] * k[i]) / m2;
      const cands = [...wTo.keys()].sort((a, b) => a - b);
      for (const c of cands) {
        const gain = wTo.get(c) - (tot[c] * k[i]) / m2;
        if (gain > bestGain + 1e-12) { bestGain = gain; bestC = c; }
      }
      tot[bestC] += k[i];
      const moved = bestC !== ci;
      if (moved) { comm[i] = bestC; L.movedThisSweep = true; L.improved = true; moves++; }
      visits++;
      L.next++;
      let sweepDone = false, converged = false;
      if (L.next === g.n) {
        sweepDone = true; L.sweeps++; L.next = 0;
        if (!L.movedThisSweep) { converged = true; phase = "converged"; }
        L.movedThisSweep = false;
      }
      return { node: i, from: ci, to: bestC, moved, gain: moved ? bestGain : 0, sweepDone, converged, done: false };
    }

    function nextMove() {
      let r;
      do { r = step(); } while (phase === "move" && !r.moved && !r.converged);
      return r;
    }

    function sweep() {
      if (phase !== "move") return { moved: 0, converged: phase === "converged" };
      let movedCount = 0, r;
      do { r = step(); if (r.moved) movedCount++; } while (!r.sweepDone && phase === "move");
      return { moved: movedCount, converged: r.converged };
    }

    function aggregate() {
      if (phase === "done") return false;
      if (phase === "move") { while (phase === "move") sweep(); } // finish the level first
      const comm = L.comm;
      const ids = [...new Set(comm)].sort((a, b) => a - b);
      const remap = new Map(ids.map((c, i) => [c, i]));
      const self = new Array(ids.length).fill(0);
      const linkW = new Map();
      for (let i = 0; i < g.n; i++) self[remap.get(comm[i])] += g.self[i];
      for (const [a, b, w] of g.links) {
        const ca = remap.get(comm[a]), cb = remap.get(comm[b]);
        if (ca === cb) { self[ca] += w; continue; }
        const key = ca < cb ? ca * 100000 + cb : cb * 100000 + ca;
        linkW.set(key, (linkW.get(key) || 0) + w);
      }
      const links = [...linkW.entries()].map(([key, w]) => [Math.floor(key / 100000), key % 100000, w]);
      const g2 = { n: ids.length, links, self };
      assign = assign.map((c) => remap.get(comm[c]));
      const improved = L.improved;
      if (!improved || g2.n === g.n || level >= 19) { phase = "done"; L = null; return false; }
      g = g2; level++;
      openLevel();
      return true;
    }

    function run() {
      while (phase !== "done") { while (phase === "move") sweep(); aggregate(); }
      return bySize();
    }

    // current community of every original node, in the current level's ids
    function raw() {
      if (L) return assign.map((c) => L.comm[c]);
      return assign.slice();
    }

    // stable labels: each community named by its smallest original node
    function labels() {
      const r = raw();
      const first = new Map();
      for (let i = 0; i < n; i++) if (!first.has(r[i])) first.set(r[i], i);
      return r.map((c) => first.get(c));
    }

    // renumbered by size, largest first (ties → lowest label): the batch result
    function bySize() {
      const r = raw();
      const size = new Map();
      for (const c of r) size.set(c, (size.get(c) || 0) + 1);
      const order = [...size.keys()].sort((a, b) => size.get(b) - size.get(a) || a - b);
      const rank = new Map(order.map((c, i) => [c, i]));
      return r.map((c) => rank.get(c));
    }

    function Q() { return modularity(n, original, raw()); }
    function count() { return new Set(raw()).size; }

    openLevel();
    return {
      step, nextMove, sweep, aggregate, run, labels, bySize, Q, count,
      get phase() { return phase; },
      get level() { return level; },
      get moves() { return moves; },
      get visits() { return visits; },
      get sweeps() { return L ? L.sweeps : 0; },
      get levelNodes() { return g.n; },
    };
  }

  /* Batch Louvain: the stepper run to completion. Returns one community id per
     node, renumbered by size (largest = 0). Weighted if edges carry a third
     entry. Identical to the pre-2026-09-06 layouts.js implementation. */
  function louvain(n, edges) {
    return louvainStepper(n, edges).run();
  }

  /* Normalized mutual information between two labelings (arrays of equal
     length), arithmetic-mean normalization as in scikit-learn's default:
     NMI = I(a;b) / ((H(a) + H(b)) / 2). 1 = identical partitions, 0 = independent. */
  function nmi(a, b) {
    const N = a.length;
    const ca = new Map(), cb = new Map(), cab = new Map();
    for (let i = 0; i < N; i++) {
      ca.set(a[i], (ca.get(a[i]) || 0) + 1);
      cb.set(b[i], (cb.get(b[i]) || 0) + 1);
      if (!cab.has(a[i])) cab.set(a[i], new Map());
      const row = cab.get(a[i]);
      row.set(b[i], (row.get(b[i]) || 0) + 1);
    }
    const H = (m) => { let h = 0; for (const c of m.values()) { const p = c / N; h -= p * Math.log(p); } return h; };
    const ha = H(ca), hb = H(cb);
    if (ha + hb === 0) return 1;
    let I = 0;
    for (const [x, row] of cab) for (const [y, c] of row) {
      const pxy = c / N, px = ca.get(x) / N, py = cb.get(y) / N;
      I += pxy * Math.log(pxy / (px * py));
    }
    return Math.max(0, I) / ((ha + hb) / 2);
  }

  /* Communities as member lists, largest first. */
  function members(comm) {
    const m = new Map();
    comm.forEach((c, i) => { if (!m.has(c)) m.set(c, []); m.get(c).push(i); });
    return [...m.values()].sort((x, y) => y.length - x.length || x[0] - y[0]);
  }

  return { fromEdges, modularity, louvainStepper, louvain, nmi, members };
})();

if (typeof module !== "undefined") module.exports = CM;
