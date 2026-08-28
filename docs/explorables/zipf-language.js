"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  let scaleMode = "linear";
  let s = +$("s").value;
  const labels = ["the", "of", "and", "to", "a", "in", "that", "is", "was", "it"];

  function data() {
    return d3.range(1, 201).map((r) => [r, 10000 / Math.pow(r, s)]);
  }

  function draw() {
    const pts = data();
    const c = VK.chart($("chart"), { margin: { left: 76 } });
    const colors = VK.colors();
    const x = scaleMode === "log"
      ? d3.scaleLog().domain([1, 200]).range([0, c.w])
      : d3.scaleLinear().domain([1, 200]).range([0, c.w]);
    const y = scaleMode === "log"
      ? d3.scaleLog().domain([20, 11000]).range([c.h, 0])
      : d3.scaleLinear().domain([0, 10000]).range([c.h, 0]);

    VK.axes(c, x, y, {
      xTicks: scaleMode === "log" ? [1, 10, 100] : [1, 50, 100, 150, 200],
      yTicks: scaleMode === "log" ? [20, 100, 1000, 10000] : [0, 2500, 5000, 7500, 10000],
      xTitle: "frequency rank", yTitle: "frequency (idealized)",
    });

    c.plot.selectAll(".axistitle").filter(function () { return d3.select(this).attr("transform"); })
      .attr("transform", `translate(${-54},${c.h / 2}) rotate(-90)`);

    VK.line(c, pts, x, y, colors.s1);
    [1, 2, 5, 10, 50, 100, 200].forEach((r) => VK.marker(c, x(r), y(10000 / Math.pow(r, s)), colors.s1));

    const top = labels.map((word, i) => [word, 10000 / Math.pow(i + 1, s)]);
    const max = top[0][1];
    $("topwords").innerHTML = top.map(([word, f]) => `
      <div class="bar-row"><span class="word">${word}</span><span class="bar"><span style="width:${100*f/max}%"></span></span><span class="num">${Math.round(f)}</span></div>`).join("");
    $("r-ratio").textContent = `${(pts[0][1] / pts[9][1]).toFixed(1)}×`;
    $("r-scale").textContent = scaleMode === "log" ? "log-log" : "linear";
    $("s-val").textContent = s.toFixed(2);
  }

  document.querySelectorAll("#scale-seg button").forEach((b) => b.addEventListener("click", () => {
    scaleMode = b.dataset.scale;
    document.querySelectorAll("#scale-seg button").forEach((x) => x.classList.toggle("on", x === b));
    draw();
  }));
  $("s").addEventListener("input", () => { s = +$("s").value; draw(); });
  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  draw();
})();
