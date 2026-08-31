"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  let scaleMode = "linear";
  let ranked = [];
  let nTokens = 0;

  function tokenize(text) {
    return (text.toLocaleLowerCase().match(/[\p{L}]+(?:['’][\p{L}]+)?/gu) || []);
  }

  function countsFromRows(rows) {
    const counts = new Map();
    rows.forEach((row) => {
      tokenize(row.description || "").forEach((token) => {
        counts.set(token, (counts.get(token) || 0) + 1);
        nTokens += 1;
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  }

  function draw() {
    if (!ranked.length) return;
    const pts = ranked.map((d, i) => [i + 1, d[1]]);
    const maxRank = pts.length;
    const maxFreq = pts[0][1];
    const c = VK.chart($("chart"), { margin: { left: 72, bottom: 48 } });
    const colors = VK.colors();

    const x = scaleMode === "log"
      ? d3.scaleLog().domain([1, maxRank]).range([0, c.w])
      : d3.scaleLinear().domain([1, maxRank]).range([0, c.w]);
    const y = scaleMode === "log"
      ? d3.scaleLog().domain([1, maxFreq]).range([c.h, 0])
      : d3.scaleLinear().domain([0, maxFreq]).range([c.h, 0]);

    const linearXTicks = [1, Math.round(maxRank / 4), Math.round(maxRank / 2), Math.round(3 * maxRank / 4), maxRank];
    const logXTicks = [1, 10, 100].filter((v) => v <= maxRank);
    const logYTicks = [1, 10, 100, 1000].filter((v) => v <= maxFreq);
    const linearYTicks = d3.ticks(0, maxFreq, 4);

    VK.axes(c, x, y, {
      xTicks: scaleMode === "log" ? logXTicks : linearXTicks,
      yTicks: scaleMode === "log" ? logYTicks : linearYTicks,
      xTitle: "frequency rank",
      yTitle: "frequency"
    });

    c.plot.selectAll(".axistitle").filter(function () { return d3.select(this).attr("transform"); })
      .attr("transform", `translate(${-51},${c.h / 2}) rotate(-90)`);

    VK.line(c, pts, x, y, colors.s1);
    const markerRanks = [1, 2, 5, 10, 25, 50, 100, 250, 500].filter((r) => r <= maxRank);
    markerRanks.forEach((r) => VK.marker(c, x(r), y(pts[r - 1][1]), colors.s1));

    const top = ranked.slice(0, 10);
    const max = top[0][1];
    $("topwords").innerHTML = top.map(([word, f]) => `
      <div class="bar-row"><span class="word">${word}</span><span class="bar"><span style="width:${100 * f / max}%"></span></span><span class="num">${f}</span></div>`).join("");

    $("r-tokens").textContent = nTokens.toLocaleString();
    $("r-types").textContent = ranked.length.toLocaleString();
    $("r-hapax").textContent = ranked.filter((d) => d[1] === 1).length.toLocaleString();
    $("r-scale").textContent = scaleMode === "log" ? "log-log" : "linear";
  }

  document.querySelectorAll("#scale-seg button").forEach((button) => {
    button.addEventListener("click", () => {
      scaleMode = button.dataset.scale;
      document.querySelectorAll("#scale-seg button").forEach((b) => b.classList.toggle("on", b === button));
      draw();
    });
  });

  async function load() {
    try {
      const response = await fetch("../data/week1_nodes.tsv");
      const raw = await response.text();
      const clean = raw.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).join("\n");
      ranked = countsFromRows(d3.tsvParse(clean));
      draw();
    } catch (error) {
      $("topwords").innerHTML = `<p class="note">Could not load the Week 1 descriptions: ${String(error)}</p>`;
    }
  }

  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  load();
})();
