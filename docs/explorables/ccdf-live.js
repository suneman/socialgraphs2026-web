/* Is it a power law? The same degree distribution drawn three ways — raw
   P(k), mixed-binned P(k) (week 1's scheme), and the complementary
   cumulative P(K ≥ k), which needs no bins at all — with a reference curve
   laid over it: a power law whose γ you tilt by hand, a log-normal fitted
   to the data, or the Poisson of a random network with the same mean. The
   lesson is visual: the CCDF is smooth where the raw tail is dust, and the
   log-normal fits the eye about as well as the power law does. Data-driven
   from ../data/week1_*.tsv. */

"use strict";

const CL = (() => {
  // per-node in / out / undirected degrees, isolates included
  function degreeSets(data) {
    const n = data.nodes.length;
    const inD = new Array(n).fill(0), outD = new Array(n).fill(0);
    const nbr = Array.from({ length: n }, () => new Set());
    for (const [a, b] of data.directed) { outD[a]++; inD[b]++; nbr[a].add(b); nbr[b].add(a); }
    return { in: inD, out: outD, und: nbr.map((s) => s.size) };
  }

  function rawDist(ks) {
    const c = new Map();
    for (const k of ks) c.set(k, (c.get(k) || 0) + 1);
    return [...c.entries()].sort((a, b) => a[0] - b[0]).map(([k, m]) => [k, m / ks.length]);
  }

  // week-1 mixed binning in u = k+1: width-1 bins for u ≤ 7, doubling after
  function mixedBinned(ks) {
    const N = ks.length, us = ks.map((k) => k + 1), maxU = Math.max(...us);
    const out = [];
    const push = (lo, hi) => {
      const m = us.filter((u) => u >= lo && u < hi).length;
      if (m > 0) out.push([hi - lo === 1 ? lo : Math.sqrt(lo * (hi - 1)), m / N / (hi - lo)]);
    };
    for (let u = 1; u < 8 && u <= maxU; u++) push(u, u + 1);
    for (let lo = 8; lo <= maxU; lo *= 2) push(lo, lo * 2);
    return out;
  }

  // CCDF over ALL nodes: [k, P(K ≥ k)] for every k ≥ 1 present
  function ccdf(ks) {
    const n = ks.length, s = [...ks].sort((a, b) => a - b), out = [];
    let seen = null;
    for (let i = 0; i < n; i++) {
      const k = s[i];
      if (k < 1 || k === seen) continue;
      seen = k;
      out.push([k, (n - i) / n]);
    }
    return out;
  }

  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  // log-normal fitted by moments of ln k over k ≥ 1
  function lognormalFit(ks) {
    const l = ks.filter((k) => k >= 1).map(Math.log);
    const mu = mean(l), sigma = Math.sqrt(mean(l.map((v) => (v - mu) ** 2)));
    return { mu, sigma, frac: l.length / ks.length };
  }

  // standard normal CDF (Abramowitz–Stegun 7.1.26)
  function Phi(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-z * z / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - p : p;
  }

  return { degreeSets, rawDist, mixedBinned, ccdf, mean, lognormalFit, Phi };
})();
if (typeof module !== "undefined") module.exports = CL;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  let degMode = "in", view = "ccdf", ref = "pl", gamma = 2.5;
  let degs = null;

  function draw() {
    if (!degs) return;
    const ks = degs[degMode];
    const N = ks.length, kMax = Math.max(...ks);
    const c = VK.chart($("chart"), { margin: { top: 14, right: 18, bottom: 40, left: 52 } });
    const col = VK.colors();
    const isC = view === "ccdf";
    const kShift = isC ? 0 : 1;                       // P(k) views plot k+1 (week-1 convention)
    const data = isC ? CL.ccdf(ks) : view === "raw" ? CL.rawDist(ks).map(([k, p]) => [k + 1, p]) : CL.mixedBinned(ks);
    const rawPts = view === "binned" ? CL.rawDist(ks).map(([k, p]) => [k + 1, p]) : null;
    const pMin = Math.min(...data.map((d) => d[1]), 1 / N);
    const x = d3.scaleLog().domain([isC ? 0.9 : 0.9, (kMax + kShift) * 1.3]).range([0, c.w]);
    const y = d3.scaleLog().domain([pMin / 2, 1]).range([c.h, 0]);
    const decades = d3.range(0, Math.floor(Math.log10(y.domain()[0])) - 1, -1).map((e) => Math.pow(10, e));
    const sup = (e) => String(e).split("").map((ch) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+ch]).join("");
    VK.axes(c, x, y, {
      xTicks: [1, 10, 100].filter((v) => v <= (kMax + kShift) * 1.3),
      yTicks: decades,
      yFormat: (v) => (v >= 1 ? "1" : v >= 0.01 ? +v.toFixed(2) : "10⁻" + sup(-Math.round(Math.log10(v)))),
      xTitle: isC ? "degree k (log)" : "k + 1 (log)",
      yTitle: isC ? "P(K ≥ k)" : "P(k)",
    });

    // --- reference curve ---
    const lam = CL.mean(ks), fit = CL.lognormalFit(ks);
    let refPts = null, refName = "none";
    const anchorK = 3;
    if (ref === "pl") {
      // anchored at the data value nearest k = 3 so only the slope is free
      const near = (isC ? CL.ccdf(ks) : CL.rawDist(ks)).reduce((b, d) => (Math.abs(d[0] - anchorK) < Math.abs(b[0] - anchorK) ? d : b));
      const expo = isC ? gamma - 1 : gamma;
      const A = near[1] * Math.pow(near[0], expo);
      refPts = d3.range(1, kMax * 1.3, 0.25).map((k) => [k + kShift, A * Math.pow(k, -expo)]);
      refName = isC ? `k^−(γ−1) = k^−${(gamma - 1).toFixed(2)}` : `k^−γ = k^−${gamma.toFixed(2)}`;
    } else if (ref === "ln") {
      const f = (k) => fit.frac * Math.exp(-((Math.log(k) - fit.mu) ** 2) / (2 * fit.sigma ** 2)) / (k * fit.sigma * Math.sqrt(2 * Math.PI));
      refPts = isC
        ? d3.range(1, kMax * 1.3, 0.25).map((k) => [k, fit.frac * (1 - CL.Phi((Math.log(Math.max(k - 0.5, 0.5)) - fit.mu) / fit.sigma))])
        : d3.range(1, kMax * 1.3, 0.25).map((k) => [k + 1, f(k)]);
      refName = `log-normal, μ = ${fit.mu.toFixed(2)}, σ = ${fit.sigma.toFixed(2)}`;
    } else if (ref === "poisson") {
      const pmf = []; let p = Math.exp(-lam);
      for (let k = 0; k <= kMax + 2; k++) { pmf.push(p); p *= lam / (k + 1); }
      if (isC) { let tail = 1; refPts = []; for (let k = 0; k <= kMax + 2; k++) { if (k >= 1) refPts.push([k, tail]); tail -= pmf[k]; } }
      else refPts = pmf.map((pk, k) => [k + 1, pk]);
      refName = `Poisson, ⟨k⟩ = ${lam.toFixed(2)}`;
    }
    if (refPts) {
      const floor = y.domain()[0];
      const shown = refPts.filter((d) => d[1] >= floor && d[1] <= 1.05 && d[0] >= x.domain()[0]);
      if (shown.length > 1) {
        VK.line(c, shown, x, y, col.s2);
        const last = shown[shown.length - 1];
        VK.directLabel(c, Math.min(x(last[0]) + 6, c.w - 60), y(last[1]) + 4, ref === "pl" ? `γ = ${gamma.toFixed(2)}` : ref === "ln" ? "log-normal" : "Poisson");
      }
    }

    // --- data ---
    if (rawPts) for (const [k, p] of rawPts) VK.marker(c, x(k), y(p), col.muted, 3);
    if (view === "binned") VK.line(c, data, x, y, col.s1);
    for (const [k, p] of data) VK.marker(c, x(k), y(p), col.s1, 4);

    const label = { in: "in-degree", out: "out-degree", und: "undirected degree" }[degMode];
    $("title").textContent = `Marvel ${label} — ${isC ? "CCDF" : view === "raw" ? "raw P(k)" : "binned P(k)"}, log–log`;
    $("legend").innerHTML =
      (rawPts ? '<span class="key"><span class="swatch dot" style="background: var(--text-muted)"></span>raw P(k)</span>' : "") +
      `<span class="key"><span class="swatch dot" style="background: var(--series-1)"></span>${isC ? "P(K ≥ k), every node counted, no bins" : view === "raw" ? "raw P(k)" : "binned P(k) (mixed bins)"}</span>` +
      (refPts ? `<span class="key"><span class="swatch" style="background: var(--series-2)"></span>${refName}</span>` : "");
    $("gamma-ctl").style.display = ref === "pl" ? "" : "none";
    $("r-n").textContent = N;
    $("r-max").textContent = kMax;
    $("r-mean").textContent = lam.toFixed(2);
    $("r-ln").textContent = `${fit.mu.toFixed(2)}, ${fit.sigma.toFixed(2)}`;
    $("r-ref").textContent = refName;
  }

  function segWire(id, set) {
    const seg = $(id);
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      set(b.dataset.v); draw();
    });
  }
  segWire("deg-seg", (v) => (degMode = v));
  segWire("view-seg", (v) => (view = v));
  segWire("ref-seg", (v) => (ref = v));
  $("gamma").addEventListener("input", () => { gamma = +$("gamma").value; $("gamma-val").textContent = gamma.toFixed(2); draw(); });

  MV.load().then((data) => { degs = CL.degreeSets(data); draw(); }).catch(() => {
    $("chart").outerHTML = '<p style="color: var(--text-muted)">Could not load the shared dataset — is the site running from its server?</p>';
  });
  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
})();
