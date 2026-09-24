"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  let scaleMode = "linear";
  let corpusMode = "desc";
  const corpora = {};   // desc | full → { tokens, types, hapax, top: [[word, f]], levels: [[f, firstRank, lastRank]] }

  function tokenize(text) {
    return (text.toLocaleLowerCase().match(/[\p{L}]+(?:['’][\p{L}]+)?/gu) || []);
  }

  // Frequency spectrum [[f, nTypes], ...] (descending f) → one level per distinct frequency.
  // Every type tied at frequency f occupies the ranks firstRank..lastRank.
  function levelsFromSpectrum(spectrum) {
    let rank = 1;
    return spectrum.map(([f, n]) => { const lv = [f, rank, rank + n - 1]; rank += n; return lv; });
  }

  function corpusFromRows(rows) {
    const counts = new Map();
    let nTokens = 0;
    rows.forEach((row) => {
      tokenize(row.description || "").forEach((token) => {
        counts.set(token, (counts.get(token) || 0) + 1);
        nTokens += 1;
      });
    });
    const ranked = Array.from(counts.entries()).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    const spectrum = d3.rollups(ranked, (v) => v.length, (d) => d[1]).sort((a, b) => b[0] - a[0]);
    return {
      tokens: nTokens, types: ranked.length, hapax: ranked.filter((d) => d[1] === 1).length,
      top: ranked.slice(0, 10), levels: levelsFromSpectrum(spectrum),
    };
  }

  function corpusFromJson(j) {
    return { tokens: j.tokens, types: j.types, hapax: j.hapax, top: j.top, levels: levelsFromSpectrum(j.spectrum) };
  }

  function draw() {
    const d = corpora[corpusMode];
    if (!d) return;
    const maxRank = d.types;
    const maxFreq = d.levels[0][0];
    const c = VK.chart($("chart"), { margin: { left: 72, bottom: 48 } });
    const colors = VK.colors();
    const log = scaleMode === "log";

    const x = log
      ? d3.scaleLog().domain([1, maxRank]).range([0, c.w])
      : d3.scaleLinear().domain([1, maxRank]).range([0, c.w]);
    const y = log
      ? d3.scaleLog().domain([0.8, maxFreq * 1.25]).range([c.h, 0])
      : d3.scaleLinear().domain([0, maxFreq * 1.05]).range([c.h, 0]);

    const powers = (max) => [1, 10, 100, 1000, 10000, 100000].filter((v) => v <= max);
    VK.axes(c, x, y, {
      xTicks: log ? powers(maxRank) : [1, Math.round(maxRank / 4), Math.round(maxRank / 2), Math.round(3 * maxRank / 4), maxRank],
      yTicks: log ? powers(maxFreq) : d3.ticks(0, maxFreq, 4),
      xTitle: "frequency rank",
      yTitle: "frequency",
    });
    c.plot.selectAll(".axistitle").filter(function () { return d3.select(this).attr("transform"); })
      .attr("transform", `translate(${-51},${c.h / 2}) rotate(-90)`);

    // Reference: an ideal Zipf curve with s = 1, anchored at the observed top frequency.
    const ref = d3.range(0, 201).map((i) => Math.pow(maxRank, i / 200)).map((r) => [r, maxFreq / r]);
    VK.line(c, ref, x, y, colors.muted).attr("stroke-dasharray", "5 4").attr("stroke-width", 1.5);
    // Legend in the lower-left corner of the plot: below the curve, where neither corpus has data on log axes.
    const lx = 10, ly = log ? c.h - 14 : c.h / 2;
    c.plot.append("line").attr("x1", lx).attr("x2", lx + 22).attr("y1", ly).attr("y2", ly)
      .attr("stroke", colors.muted).attr("stroke-width", 1.5).attr("stroke-dasharray", "5 4");
    VK.directLabel(c, lx + 28, ly + 4, "ideal Zipf, s = 1").attr("fill", colors.muted);

    // Observed data: one dot per distinct frequency; a bar to the right spans every word tied at it.
    const g = c.plot.append("g");
    g.selectAll("line").data(d.levels.filter((lv) => lv[2] > lv[1])).join("line")
      .attr("x1", (lv) => x(lv[1])).attr("x2", (lv) => x(lv[2]))
      .attr("y1", (lv) => y(lv[0])).attr("y2", (lv) => y(lv[0]))
      .attr("stroke", colors.s1).attr("stroke-width", 3).attr("stroke-linecap", "round").attr("opacity", 0.45);
    g.selectAll("circle").data(d.levels).join("circle")
      .attr("cx", (lv) => x(lv[1])).attr("cy", (lv) => y(lv[0])).attr("r", 2.5)
      .attr("fill", colors.s1);

    const top = d.top;
    const max = top[0][1];
    $("topwords").innerHTML = top.map(([word, f]) => `
      <div class="bar-row"><span class="word">${word}</span><span class="bar"><span style="width:${100 * f / max}%"></span></span><span class="num">${f.toLocaleString()}</span></div>`).join("");

    $("r-tokens").textContent = d.tokens.toLocaleString();
    $("r-types").textContent = d.types.toLocaleString();
    $("r-hapax").textContent = `${d.hapax.toLocaleString()} (${Math.round(100 * d.hapax / d.types)}%)`;
    $("note-desc").hidden = corpusMode !== "desc";
    $("note-full").hidden = corpusMode !== "full";
  }

  function wireSeg(id, key, set) {
    document.querySelectorAll(`#${id} button`).forEach((button) => {
      button.addEventListener("click", () => {
        set(button.dataset[key]);
        document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle("on", b === button));
        draw();
      });
    });
  }
  wireSeg("scale-seg", "scale", (v) => { scaleMode = v; });
  wireSeg("corpus-seg", "corpus", (v) => { corpusMode = v; });

  async function load() {
    try {
      const raw = await (await fetch("../data/week1_nodes.tsv")).text();
      const clean = raw.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).join("\n");
      corpora.desc = corpusFromRows(d3.tsvParse(clean));
      draw();
      corpora.full = corpusFromJson(await (await fetch("zipf-full-pages.json")).json());
      draw();
    } catch (error) {
      $("topwords").innerHTML = `<p class="note">Could not load the Marvel text: ${String(error)}</p>`;
    }
  }

  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  load();
})();
