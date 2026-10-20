/* Two sentiment instruments through a novel. Every sentence of Dark Matter scored offline
   (tools/groundtruth/week7_story_arc.py) by the page's movie-review classifier (signed
   P(pos) − P(neg)) and by the VADER lexicon (compound). The index file carries per-chapter
   means; the sentence-level arrays of one chapter are fetched when that chapter is opened.
   The browser only smooths (centered moving average, window in sentences) and draws. Hover
   for the sentence; the list below ranks the sentences where the two instruments point in
   opposite directions. The open chapter is shared with story-emotion through sessionStorage,
   so the two explorables on the page stay on the same chapter.
   Data: data/week7_story_arc.json + data/week7_story_arc/<slug>/chNN.json. */
"use strict";

(async function () {
  const data = await fetch("data/week7_story_arc.json").then(r => r.json());
  const $ = id => document.getElementById(id);
  const COLOR = { clf: "var(--accent)", lex: "var(--series-1)" };
  const NAME = { clf: "classifier", lex: "lexicon" };
  const KEY = "week7-story-chapter";
  const story = data.stories[0];
  let chapterN = 1, ch = null, instrument = "both", win = 11;
  let hoverI = null, pinned = null;
  const cache = new Map();

  // ---- controls
  document.querySelectorAll("#instrument button").forEach(b => b.addEventListener("click", () => {
    instrument = b.dataset.v;
    document.querySelectorAll("#instrument button").forEach(x => x.classList.toggle("on", x === b));
    drawNovel(); drawMain();
  }));
  $("window").addEventListener("input", () => { win = +$("window").value; $("window-val").textContent = win === 1 ? "none" : `${win} sentences`; drawMain(); });
  $("prev").addEventListener("click", () => openChapter(chapterN - 1));
  $("next").addEventListener("click", () => openChapter(chapterN + 1));
  window.addEventListener("storage", e => { if (e.key === KEY && +e.newValue && +e.newValue !== chapterN) openChapter(+e.newValue, false); });

  // ---- helpers
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }
  const fmt = v => (v > 0 ? "+" : "") + v.toFixed(2);
  function storedChapter() { try { return +sessionStorage.getItem(KEY) || 1; } catch { return 1; } }
  function storeChapter(n) { try { sessionStorage.setItem(KEY, String(n)); } catch {} }
  function smooth(values, w) {
    if (w <= 1) return values.slice();
    const h = Math.floor(w / 2), out = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const lo = Math.max(0, i - h), hi = Math.min(values.length - 1, i + h);
      let s = 0; for (let j = lo; j <= hi; j++) s += values[j];
      out[i] = s / (hi - lo + 1);
    }
    return out;
  }
  const M = { l: 34, r: 12, t: 8, b: 22 };
  const pos = i => ch.n <= 1 ? 0 : i / (ch.n - 1);
  function nearest(p) { return Math.max(0, Math.min(ch.n - 1, Math.round(p * (ch.n - 1)))); }
  function tipAt(ev, html) {
    const tip = $("tip");
    tip.innerHTML = html; tip.style.display = "block";
    const wrap = document.querySelector(".arc-wrap").getBoundingClientRect();
    let left = ev.clientX - wrap.left + 14, top = ev.clientY - wrap.top + 14;
    if (left > wrap.width - 310) left -= 325;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  }
  function spreadEnds(ends) {
    if (ends.length === 2 && ends[1].yv - ends[0].yv < 14) { const mid = (ends[0].yv + ends[1].yv) / 2; ends[0].yv = mid - 7; ends[1].yv = mid + 7; }
    return ends;
  }

  // ---- the whole novel, chapter by chapter
  function drawNovel() {
    const C = story.chapters, el = $("novel"), svg = d3.select(el), W = el.clientWidth || 700, H = el.clientHeight || 160;
    svg.selectAll("*").remove();
    const x = d3.scaleLinear().domain([1, C.length]).range([M.l + 10, W - M.r - 10]);
    const bottom = H - M.b;
    const keys = instrument === "both" ? ["clf", "lex"] : [instrument];
    const ext = d3.max(C, c => Math.max(Math.abs(c.clf), Math.abs(c.lex))) || .5;
    const top = Math.ceil(ext * 10) / 10;
    const y = d3.scaleLinear().domain([-top, top]).range([bottom, M.t]);
    const series = keys.map(k => ({ k, color: COLOR[k], label: NAME[k], v: C.map(c => c[k]) }));
    const g = svg.append("g"), bw = x(2) - x(1);
    g.append("rect").attr("class", "arc-chapter-band").attr("x", x(chapterN) - bw / 2).attr("y", M.t - 4).attr("width", bw).attr("height", bottom - M.t + 4);
    for (const t of [-top, 0, top]) {
      g.append("line").attr("class", t === 0 ? "axisline" : "gridline").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(t)).attr("y2", y(t));
      g.append("text").attr("class", "ticktext").attr("x", M.l - 6).attr("y", y(t) + 4).attr("text-anchor", "end").text(fmt(t).replace(/\.?0+$/, ""));
    }
    g.append("text").attr("class", "axistitle").attr("x", M.l + 4).attr("y", M.t + 10).text("mean sentiment per chapter");
    const line = d3.line().x((d, i) => x(i + 1)).y(d => y(d)).curve(d3.curveMonotoneX);
    for (const s of series) {
      g.append("path").attr("class", "arc-line").attr("stroke", s.color).attr("d", line(s.v));
      g.selectAll(null).data(s.v).join("circle").attr("class", "arc-mark").attr("cx", (d, i) => x(i + 1)).attr("cy", d => y(d)).attr("r", 3.2).attr("fill", s.color);
    }
    if (series.length === 2) {
      for (const e of spreadEnds(series.map(s => ({ s, yv: Math.max(M.t + 12, Math.min(bottom - 10, y(s.v[s.v.length - 1]))) })).sort((a, b) => a.yv - b.yv)))
        g.append("text").attr("class", "directlabel").attr("x", W - M.r).attr("y", e.yv + 4).attr("text-anchor", "end").text(e.s.label);
    }
    g.append("line").attr("class", "axisline").attr("x1", M.l).attr("x2", W - M.r).attr("y1", bottom).attr("y2", bottom);
    const step = Math.max(1, Math.ceil(C.length / Math.floor((W - 60) / 34)));
    C.forEach((c, i) => {
      const n = i + 1;
      if (n === 1 || n === C.length || n % step === 0 || n === chapterN)
        g.append("text").attr("class", "ticktext").attr("x", x(n)).attr("y", bottom + 12).attr("text-anchor", "middle").text(n);
    });
    g.append("text").attr("class", "ticktext").attr("x", M.l - 6).attr("y", bottom + 12).attr("text-anchor", "end").text("ch.");
    g.append("rect").attr("class", "arc-hit").attr("x", M.l).attr("y", 0).attr("width", W - M.l - M.r).attr("height", H)
      .on("mousemove", ev => {
        const [mx] = d3.pointer(ev, el), n = Math.max(1, Math.min(C.length, Math.round(x.invert(mx)))), c = C[n - 1];
        g.selectAll(".arc-chapter-hover").remove();
        g.append("line").attr("class", "arc-cursor arc-chapter-hover").attr("x1", x(n)).attr("x2", x(n)).attr("y1", M.t).attr("y2", bottom);
        tipAt(ev, `<div class="tt-note">chapter ${n} · ${c.nSentences} sentences</div>` +
          `<div class="tt-scores"><span>classifier <b>${fmt(c.clf)}</b></span><span>lexicon <b>${fmt(c.lex)}</b></span></div>` +
          `<div class="tt-scores"><span>negative by the classifier <b>${Math.round(c.negShare * 100)}%</b> of sentences</span><span>same sign <b>${Math.round(c.agree * 100)}%</b></span></div>` +
          `<div class="tt-note">click to open this chapter</div>`);
      })
      .on("mouseleave", () => { g.selectAll(".arc-chapter-hover").remove(); $("tip").style.display = "none"; })
      .on("click", ev => { const [mx] = d3.pointer(ev, el); openChapter(Math.max(1, Math.min(C.length, Math.round(x.invert(mx))))); });
  }

  // ---- one chapter, sentence by sentence
  let cursor = null;
  function drawMain() {
    if (!ch) return;
    const el = $("main"), svg = d3.select(el), W = el.clientWidth || 700, H = el.clientHeight || 230;
    svg.selectAll("*").remove();
    const x = d3.scaleLinear().domain([0, 1]).range([M.l, W - M.r]);
    const y = d3.scaleLinear().domain([-1, 1]).range([H - M.b, M.t]);
    const g = svg.append("g");
    for (const t of [-1, -.5, 0, .5, 1]) {
      g.append("line").attr("class", t === 0 ? "axisline" : "gridline").attr("x1", x(0)).attr("x2", x(1)).attr("y1", y(t)).attr("y2", y(t));
      g.append("text").attr("class", "ticktext").attr("x", M.l - 6).attr("y", y(t) + 4).attr("text-anchor", "end").text(t > 0 ? `+${t}` : t);
    }
    g.append("text").attr("class", "axistitle").attr("x", x(0) + 5).attr("y", y(1) + 12).text("positive");
    g.append("text").attr("class", "axistitle").attr("x", x(0) + 5).attr("y", y(-1) - 5).text("negative");
    g.append("line").attr("class", "axisline").attr("x1", x(0)).attr("x2", x(1)).attr("y1", H - M.b).attr("y2", H - M.b);
    for (const t of [0, .25, .5, .75, 1])
      g.append("text").attr("class", "ticktext").attr("x", x(t)).attr("y", H - M.b + 14).attr("text-anchor", t === 0 ? "start" : t === 1 ? "end" : "middle")
        .text(t === 0 ? "start of the chapter" : t === 1 ? "end" : `${t * 100}%`);
    const keys = instrument === "both" ? ["clf", "lex"] : [instrument];
    const line = d3.line().x((d, i) => x(pos(i))).y(d => y(d)).curve(d3.curveMonotoneX);
    const sm = {};
    for (const k of ["lex", "clf"]) {
      sm[k] = smooth(ch[k], win);
      if (!keys.includes(k)) continue;
      if (win > 1) g.append("path").attr("class", "arc-raw").attr("stroke", COLOR[k]).attr("d", line(ch[k]));
      g.append("path").attr("class", "arc-line").attr("stroke", COLOR[k]).attr("d", line(sm[k]));
    }
    for (const e of spreadEnds(keys.map(k => ({ k, yv: y(sm[k][ch.n - 1]) })).sort((a, b) => a.yv - b.yv)))
      g.append("text").attr("class", "directlabel").attr("x", x(1) - 4).attr("y", e.yv + 4).attr("text-anchor", "end").text(NAME[e.k]);
    cursor = { g: g.append("g"), x, y, H, keys, sm };
    g.append("rect").attr("class", "arc-hit").attr("x", x(0)).attr("y", 0).attr("width", x(1) - x(0)).attr("height", H)
      .on("mousemove", ev => { const [mx] = d3.pointer(ev, el); setHover(nearest(x.invert(mx)), ev); })
      .on("mouseleave", () => setHover(null))
      .on("click", () => { pinned = pinned === hoverI ? null : hoverI; drawCursor(); });
    drawCursor();
  }
  function drawCursor() {
    if (!ch || !cursor) return;
    const c = cursor, i = hoverI ?? pinned;
    c.g.selectAll("*").remove();
    for (const m of new Set([pinned, i].filter(v => v !== null && v !== undefined))) {
      const px = c.x(pos(m));
      c.g.append("line").attr("class", "arc-cursor").attr("x1", px).attr("x2", px).attr("y1", M.t).attr("y2", c.H - M.b);
      for (const k of c.keys)
        c.g.append("circle").attr("class", "arc-mark").attr("cx", px).attr("cy", c.y(c.sm[k][m])).attr("r", m === pinned ? 5.5 : 4).attr("fill", COLOR[k]);
    }
  }
  function setHover(i, ev) {
    hoverI = i; drawCursor();
    if (i === null) { $("tip").style.display = "none"; return; }
    tipAt(ev, `<div class="tt-note">sentence ${i + 1} of ${ch.n} in chapter ${chapterN}</div>` +
      `<div>${esc(ch.t[i])}</div>` +
      `<div class="tt-scores"><span>classifier <b>${fmt(ch.clf[i])}</b></span><span>lexicon <b>${fmt(ch.lex[i])}</b></span></div>`);
  }
  function drawDisagreements() {
    const rows = d3.range(ch.n).filter(i => Math.sign(ch.clf[i]) !== Math.sign(ch.lex[i]) && Math.abs(ch.lex[i]) >= .2)
      .sort((a, b) => Math.abs(ch.clf[b] - ch.lex[b]) - Math.abs(ch.clf[a] - ch.lex[a])).slice(0, 6);
    $("disagree-list").innerHTML = rows.map(i =>
      `<li><button data-i="${i}">${esc(ch.t[i])}</button><span class="num"><small>classifier</small>${fmt(ch.clf[i])}</span><span class="num"><small>lexicon</small>${fmt(ch.lex[i])}</span></li>`
    ).join("") || "<li>The two instruments agree in sign on every sentence of this chapter.</li>";
    document.querySelectorAll("#disagree-list button").forEach(b => b.addEventListener("click", () => { pinned = +b.dataset.i; drawCursor(); }));
  }
  function drawHeader() {
    const c = story.chapters[chapterN - 1];
    $("chapter-title").textContent = `Inside chapter ${chapterN} · ${c.nSentences} sentences`;
    $("prev").disabled = chapterN <= 1; $("next").disabled = chapterN >= story.chapters.length;
  }
  function drawFoot() {
    $("foot").innerHTML = `<a href="${esc(story.url)}" target="_blank" rel="noopener">${esc(story.title)}</a> by ${esc(story.author)} · ` +
      `${story.chapters.length} chapters, ${story.nSentences.toLocaleString()} sentences, ${story.nWords.toLocaleString()} words · ` +
      `the classifier and the lexicon agree on the sign of ${Math.round(story.agree * 100)}% of sentences · click the chapter panel to pin a sentence` + (story.note ? ` · ${esc(story.note)}` : "");
  }
  async function openChapter(n, store = true) {
    chapterN = Math.max(1, Math.min(story.chapters.length, n));
    if (store) storeChapter(chapterN);
    pinned = null; hoverI = null;
    if (!cache.has(chapterN)) {
      const d = await fetch(`data/week7_story_arc/${story.slug}/ch${String(chapterN).padStart(2, "0")}.json`).then(r => r.json());
      d.n = d.clf.length; cache.set(chapterN, d);
    }
    ch = cache.get(chapterN);
    drawHeader(); drawNovel(); drawMain(); drawDisagreements(); drawFoot();
  }
  await openChapter(storedChapter(), false);
  window.addEventListener("resize", () => { drawNovel(); drawMain(); });
})();
