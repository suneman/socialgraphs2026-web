/* vizkit.js — shared SVG chart chrome for the 02805 explorables.
   Hairline solid grid, recessive axes, 2px lines, ≥8px markers with a
   2px surface ring. Colors come from the CSS tokens at draw time. */

"use strict";

const VK = (() => {

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const colors = () => ({
    s1: cssVar("--series-1"),
    s2: cssVar("--series-2"),
    surface: cssVar("--surface-1"),
    muted: cssVar("--text-muted"),
  });

  // Fixed-margin chart scaffold inside an <svg class="chart">
  function chart(svgNode, opts = {}) {
    const m = Object.assign({ top: 14, right: 16, bottom: 40, left: 46 }, opts.margin);
    const svg = d3.select(svgNode);
    svg.selectAll("*").remove();
    const W = svgNode.clientWidth || 420, H = svgNode.clientHeight || 300;
    const w = W - m.left - m.right, h = H - m.top - m.bottom;
    const plot = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    return { svg, plot, w, h };
  }

  // Horizontal gridlines + left/bottom hairline axes with muted tick text
  function axes(c, x, y, o = {}) {
    const xt = o.xTicks || x.ticks(5);
    const yt = o.yTicks || y.ticks(5);
    const fx = o.xFormat || ((v) => v);
    const fy = o.yFormat || ((v) => v);

    c.plot.selectAll(".gridline").data(yt).join("line")
      .attr("class", "gridline")
      .attr("x1", 0).attr("x2", c.w)
      .attr("y1", (d) => y(d)).attr("y2", (d) => y(d));

    c.plot.append("line").attr("class", "axisline")
      .attr("x1", 0).attr("x2", c.w).attr("y1", c.h).attr("y2", c.h);

    c.plot.selectAll(".xtick").data(xt).join("text")
      .attr("class", "ticktext xtick")
      .attr("x", (d) => x(d)).attr("y", c.h + 16)
      .attr("text-anchor", "middle")
      .text(fx);

    c.plot.selectAll(".ytick").data(yt).join("text")
      .attr("class", "ticktext ytick")
      .attr("x", -8).attr("y", (d) => y(d) + 3.5)
      .attr("text-anchor", "end")
      .text(fy);

    if (o.xTitle)
      c.plot.append("text").attr("class", "axistitle")
        .attr("x", c.w / 2).attr("y", c.h + 32).attr("text-anchor", "middle")
        .text(o.xTitle);
    if (o.yTitle)
      c.plot.append("text").attr("class", "axistitle")
        .attr("transform", `translate(${-34},${c.h / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .text(o.yTitle);
  }

  // 2px line with round caps/joins
  function line(c, pts, x, y, color, opts = {}) {
    const gen = d3.line().x((d) => x(d[0])).y((d) => y(d[1]));
    if (opts.curve) gen.curve(opts.curve);
    return c.plot.append("path")
      .attr("d", gen(pts))
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");
  }

  // ≥8px marker (r ≥ 4) with a 2px surface ring
  function marker(c, px, py, color, r = 5) {
    const g = c.plot.append("g");
    g.append("circle").attr("cx", px).attr("cy", py).attr("r", r + 2)
      .attr("fill", colors().surface);
    g.append("circle").attr("cx", px).attr("cy", py).attr("r", r)
      .attr("fill", color);
    return g;
  }

  function directLabel(c, px, py, text, anchor = "start") {
    return c.plot.append("text")
      .attr("class", "directlabel")
      .attr("x", px).attr("y", py)
      .attr("text-anchor", anchor)
      .text(text);
  }

  return { cssVar, colors, chart, axes, line, marker, directLabel };
})();

if (typeof module !== "undefined") module.exports = VK;

/* --- canvas size guard (added 2026-09-16) ---------------------------------
   Every canvas explorable sizes its backing store once at boot
   (canvas.width = clientWidth * dpr) and afterwards only re-fits on a window
   "resize". Inside an <iframe loading="lazy"> that is not enough. The frame
   starts loading while it is still below the fold, so a widget can finish
   booting, measure a canvas that is zero-wide or still at the iframe's
   default width, and then stay wrong forever — no resize event ever fires,
   and only a reload clears it.

   week 1's layouts.html is where a student hit this: it is the only canvas
   widget on that page and has the slowest boot on it (two fetches plus
   Louvain), so it is the most likely to still be offscreen when it measures.
   Pausing to play with another widget on the way down is exactly the delay
   that lets it finish booting blind. The other three week 1 explorables are
   SVG, which re-lays out on its own, which is why only this one broke.

   Fixed once here rather than in twelve widget files: watch every canvas and
   re-dispatch a window resize when its box actually changes size. All twelve
   already listen for that and respond by re-fitting and redrawing, and every
   one of those handlers is a pure redraw — no state is reset. Setting
   canvas.width/height changes the backing store, not the CSS box, so this
   cannot feed back on itself. */
(() => {
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return;

  const start = () => {
    const seen = new WeakMap();
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        const was = seen.get(e.target);
        if (was && was.w === w && was.h === h) continue;  // box did not move
        seen.set(e.target, { w, h });
        if (!w || !h) continue;                           // never act on a zero box
        if (was) changed = true;                          // real change, incl. 0 -> N
        // A first sighting at a usable size needs nothing: the widget's own
        // boot fit is about to measure the same number.
      }
      if (changed) window.dispatchEvent(new Event("resize"));
    });
    document.querySelectorAll("canvas").forEach((c) => ro.observe(c));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
