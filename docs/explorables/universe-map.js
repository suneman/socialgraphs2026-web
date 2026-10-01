"use strict";

(async function () {
  const data = await fetch("data/week6_universe_map.json").then(r => r.json());
  const q = new Int8Array(await fetch(`data/${data.binary}`).then(r => r.arrayBuffer()));
  const $ = id => document.getElementById(id);
  const D = data.dims;

  function decode(offset, scale) {        // int8 rows, row-major, one scale per row
    return scale.map((s, r) => {
      const v = new Float32Array(D);
      for (let j = 0; j < D; j += 1) v[j] = q[offset + r * D + j] * s;
      return v;
    });
  }
  const pages = data.pages.map((p, i) => ({ ...p, i }));
  const V = decode(0, data.pageScale);
  const W = decode(pages.length * D, data.wordScale);
  const col = new Map(data.vocab.map((w, j) => [w, j]));

  function axisFrom(aWords, bWords) {
    const mean = ws => { const m = new Float32Array(D); ws.forEach(w => W[col.get(w)].forEach((x, j) => { m[j] += x / ws.length; })); return m; };
    const a = mean(aWords), b = mean(bWords), d = a.map((x, j) => x - b[j]);
    const n = Math.hypot(...d);
    return d.map(x => x / n);
  }
  function zScores(axis) {
    const s = V.map(v => v.reduce((t, x, j) => t + x * axis[j], 0));
    const m = d3.mean(s), sd = d3.deviation(s) * Math.sqrt((s.length - 1) / s.length);
    return s.map(x => (x - m) / sd);
  }

  // axes: the four presets, then one custom slot
  const axes = data.presets.map((p, k) => ({ a: p.a, b: p.b, preset: k, z: zScores(axisFrom(p.aWords, p.bWords)) }));
  const custom = { a: "custom", b: "custom", preset: null, z: null };
  axes.push(custom);
  let ax = 0, ay = 1, selected = null;

  function fillSelects() {
    for (const id of ["ax-x", "ax-y"]) {
      $(id).innerHTML = axes.map((a, k) => `<option value="${k}" ${a.z ? "" : "disabled"}>${a.b} ↔ ${a.a}</option>`).join("");
    }
    $("ax-x").value = ax; $("ax-y").value = ay;
  }

  const svg = d3.select("#map"), root = svg.append("g"), tip = $("tip");
  const x = d3.scaleLinear().range([46, 536]), y = d3.scaleLinear().range([470, 26]);
  root.append("rect").attr("width", 560).attr("height", 500).attr("fill", "var(--page)");
  const guide = root.append("g"), pointLayer = root.append("g"), labelLayer = root.append("g");
  const r = d3.scaleSqrt().domain([0, d3.max(pages, d => d.in) || 1]).range([2.4, 10]);
  const hubs = new Set([...pages].sort((a, b) => b.in - a.in).slice(0, 10).map(d => d.i));

  const points = pointLayer.selectAll("circle").data(pages).join("circle")
    .attr("class", "atlas-point map-point").attr("r", d => r(d.in))
    .on("mouseenter", (ev, d) => { tip.innerHTML = `<strong>${esc(d.name)}</strong><br><span style="color:var(--text-muted)">${esc(d.words.join(", "))}</span>`; tip.style.display = "block"; move(ev); })
    .on("mousemove", move).on("mouseleave", () => { tip.style.display = "none"; })
    .on("click", (_, d) => select(d));

  const zoom = d3.zoom().scaleExtent([0.8, 12]).on("zoom", ev => root.attr("transform", ev.transform));
  svg.call(zoom);

  function draw(animate) {
    const zx = axes[ax].z, zy = axes[ay].z;
    const lim = z => Math.max(2.5, d3.max(z, v => Math.abs(v)) * 1.05);
    x.domain([-lim(zx), lim(zx)]); y.domain([-lim(zy), lim(zy)]);
    guide.selectAll("*").remove();
    guide.append("line").attr("class", "axis-zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 18).attr("y2", 478);
    guide.append("line").attr("class", "axis-zero").attr("y1", y(0)).attr("y2", y(0)).attr("x1", 38).attr("x2", 544);
    const end = (t, px, py, anchor) => guide.append("text").attr("class", "axis-end").attr("x", px).attr("y", py).attr("text-anchor", anchor).text(t);
    end(`← ${axes[ax].b}`, 42, y(0) - 6, "start"); end(`${axes[ax].a} →`, 540, y(0) - 6, "end");
    end(`↑ ${axes[ay].a}`, x(0) + 6, 18, "start"); end(`↓ ${axes[ay].b}`, x(0) + 6, 494, "start");
    const p = animate ? points.transition().duration(500) : points;
    p.attr("cx", d => x(zx[d.i])).attr("cy", d => y(zy[d.i]));
    const lab = pages.filter(d => hubs.has(d.i) || d === selected).map(d => {
      const px = x(zx[d.i]), left = px > 440;
      return { d, left, x: px + (left ? -1 : 1) * (r(d.in) + 3), y: y(zy[d.i]) + 3 };
    }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i += 1)          // nudge labels that would overprint each other
      for (let j = 0; j < i; j += 1)
        if (Math.abs(lab[i].x - lab[j].x) < 95 && lab[i].y - lab[j].y < 11) lab[i].y = lab[j].y + 11;
    labelLayer.selectAll("text").data(lab, l => l.d.i).join("text")
      .attr("class", "atlas-hub-label").text(l => l.d.name.replace(/ \((character|comics|Marvel Comics)\)$/, ""))
      .attr("text-anchor", l => l.left ? "end" : "start")
      .transition().duration(animate ? 500 : 0)
      .attr("x", l => l.x).attr("y", l => l.y);
    if (selected) detail(selected);
  }

  function pullText(axisIdx, d) {
    const a = axes[axisIdx];
    if (a.preset === null) return `<span style="color:var(--text-muted)">pull words are listed for the four preset axes</span>`;
    const [toA, toB] = d.pulls[a.preset];
    return `toward <b>${a.a}</b>: ${esc(toA.join(", ") || "–")}<br>toward <b>${a.b}</b>: ${esc(toB.join(", ") || "–")}`;
  }
  function detail(d) {
    $("d-name").textContent = d.name;
    $("d-words").textContent = d.words.join(", ");
    const fz = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
    $("d-zx").textContent = fz(axes[ax].z[d.i]); $("d-zy").textContent = fz(axes[ay].z[d.i]);
    $("d-px").innerHTML = pullText(ax, d); $("d-py").innerHTML = pullText(ay, d);
  }
  function select(d) {
    selected = d;
    points.classed("active", p => p === d);
    draw(false);
  }
  function move(ev) {
    const rect = $("map").getBoundingClientRect();
    let left = ev.clientX - rect.left + 12;
    if (left > rect.width - 300) left -= 300;
    tip.style.left = `${left}px`; tip.style.top = `${ev.clientY - rect.top + 12}px`;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function useCustom() {
    const words = id => $(id).value.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const A = words("cust-a"), B = words("cust-b");
    const okA = A.filter(w => col.has(w)), okB = B.filter(w => col.has(w));
    const unknown = [...A, ...B].filter(w => !col.has(w));
    if (!okA.length || !okB.length) {
      $("cust-msg").textContent = `Each end needs at least one known word. Not in the vocabulary: ${unknown.join(", ") || "–"}`;
      return;
    }
    custom.a = okA[0]; custom.b = okB[0];
    custom.z = zScores(axisFrom(okA, okB));
    $("cust-msg").textContent = unknown.length ? `Skipped (not among the ${data.vocab.length} words shipped with this page): ${unknown.join(", ")}` : "";
    ay = axes.length - 1; fillSelects(); draw(true);
  }

  $("ax-x").addEventListener("change", () => { ax = +$("ax-x").value; draw(true); });
  $("ax-y").addEventListener("change", () => { ay = +$("ax-y").value; draw(true); });
  $("cust-go").addEventListener("click", useCustom);
  for (const id of ["cust-a", "cust-b"]) $(id).addEventListener("keydown", e => { if (e.key === "Enter") useCustom(); });
  $("reset").addEventListener("click", () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity));
  $("search").addEventListener("input", () => {
    const q = $("search").value.trim().toLowerCase();
    if (!q) return;
    const m = pages.find(d => d.name.toLowerCase().startsWith(q)) || pages.find(d => d.name.toLowerCase().includes(q));
    if (m) select(m);
  });

  fillSelects();
  draw(false);
  select(pages.find(d => d.name === "Doctor Strange") || pages[0]);
})();
