/* Two distributions — a power law and an exponential — and the four ways axes
   can render them. On linear axes both crush against the corner; semi-log
   straightens the exponential; log-log straightens the power law. The toggle
   IS the lesson. */

"use strict";

// Pure math, node-requirable for the verification protocol.
const TD = (() => {
  const GAMMA = 2.5, LAMBDA = 1 / 8, KMAX = 1000;
  let zPl = 0, zExp = 0;
  for (let k = 1; k <= KMAX; k++) {
    zPl += Math.pow(k, -GAMMA);
    zExp += Math.exp(-LAMBDA * k);
  }
  const pPl = (k) => Math.pow(k, -GAMMA) / zPl;
  const pExp = (k) => Math.exp(-LAMBDA * k) / zExp;
  return { GAMMA, LAMBDA, KMAX, zPl, zExp, pPl, pExp };
})();
if (typeof module !== "undefined") module.exports = TD;

(function () {
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const svgNode = $("chart");

  let xMode = "lin", yMode = "lin";

  // dense integer coverage low, log-spaced coverage high — smooth on every axis pair
  const KS = (() => {
    const s = new Set();
    for (let k = 1; k <= 120; k++) s.add(k);
    for (let k = 120; k <= TD.KMAX; k *= 1.04) s.add(Math.round(k));
    s.add(TD.KMAX);
    return [...s].sort((a, b) => a - b);
  })();

  const Y_LOG_FLOOR = 1e-8;

  const VERDICT = {
    "lin|lin": "Nothing is straight, and the two curves are all but indistinguishable — both crushed into the corner. Linear axes hide everything §4 cares about.",
    "lin|log": "The exponential is now a straight line; the power law still bends. Straight on semi-log axes ⇔ exponential decay.",
    "log|lin": "Neither straightens — this combination rarely earns its keep.",
    "log|log": "The power law is now a straight line (its slope is −γ); the exponential plunges off the chart. Straight on log–log axes ⇔ power law.",
  };

  function draw() {
    const c = VK.chart(svgNode);
    const col = VK.colors();

    const x = (xMode === "log" ? d3.scaleLog().domain([1, TD.KMAX]) : d3.scaleLinear().domain([0, TD.KMAX])).range([0, c.w]);
    const y = (yMode === "log" ? d3.scaleLog().domain([Y_LOG_FLOOR, 1]) : d3.scaleLinear().domain([0, 0.8])).range([c.h, 0]);

    const pow = { "1": "1", "0.01": "10⁻²", "0.0001": "10⁻⁴", "0.000001": "10⁻⁶", "1e-8": "10⁻⁸" };
    VK.axes(c, x, y, {
      xTicks: xMode === "log" ? [1, 10, 100, 1000] : [0, 250, 500, 750, 1000],
      yTicks: yMode === "log" ? [1, 1e-2, 1e-4, 1e-6, 1e-8] : [0, 0.2, 0.4, 0.6, 0.8],
      yFormat: yMode === "log" ? (v) => pow[String(v)] || v : (v) => v,
      xTitle: "k",
      yTitle: "P(k)",
    });

    // clip so the exponential can dive off a log floor without smearing
    const clipId = "plotclip";
    c.svg.select("defs").remove();
    c.svg.append("defs").append("clipPath").attr("id", clipId)
      .append("rect").attr("x", 0).attr("y", 0).attr("width", c.w).attr("height", c.h);

    const visible = (p) => (yMode === "log" ? p >= Y_LOG_FLOOR : true);
    const series = [
      { p: TD.pPl, color: col.s1, name: "power law" },
      { p: TD.pExp, color: col.s2, name: "exponential" },
    ];
    for (const s of series) {
      const pts = KS.filter((k) => visible(s.p(k))).map((k) => [k, s.p(k)]);
      VK.line(c, pts, x, y, s.color).attr("clip-path", `url(#${clipId})`);
      const [k0, p0] = pts[0];
      VK.directLabel(c, x(k0) + 12, y(p0) - 9, s.name).attr("fill", s.color);
    }

    $("verdict").textContent = VERDICT[`${xMode}|${yMode}`];
  }

  function segWire(segId, set) {
    const seg = $(segId);
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      set(b.dataset.v);
      draw();
    });
  }
  segWire("x-seg", (v) => (xMode = v));
  segWire("y-seg", (v) => (yMode = v));

  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  draw();
})();
