/* DeepMoji through a novel. Every sentence of Dark Matter run offline through DeepMoji
   (Felbo et al. 2017, via torchMoji; tools/groundtruth/week7_story_arc.py), which answers
   with a distribution over 64 emoji. The files keep the top-3 emoji per sentence and five
   emotion aggregates (anger, sadness, heartbreak, joy, deadpan: summed probability of a group of
   emoji; heartbreak is 💔 alone). The index file carries per-chapter means and each chapter's top emoji; the
   sentence-level arrays of one chapter are fetched when it is opened. The browser only
   smooths and draws. The open chapter is shared with story-sentiment through sessionStorage.
   Data: data/week7_story_arc.json + data/week7_story_arc/<slug>/chNN.json. */
"use strict";

(async function () {
  const data = await fetch("data/week7_story_arc.json").then(r => r.json());
  const $ = id => document.getElementById(id);
  const G = data.meta.glyphs, EMOTIONS = Object.keys(data.meta.emotions), MUSIC = new Set(data.meta.music);
  const COLOR = "var(--cat-2)";
  const KEY = "week7-story-chapter";
  const story = data.stories[0];
  let chapterN = 1, ch = null, win = 11, emotion = "anger";
  let hoverI = null, pinned = null;
  const cache = new Map();

  // ---- controls
  $("emotion").innerHTML = EMOTIONS.map(e => `<option value="${e}">${e}</option>`).join("");
  $("emotion").addEventListener("change", () => { emotion = $("emotion").value; drawKey(); drawNovel(); drawEmo(); drawTopList(); });
  $("window").addEventListener("input", () => { win = +$("window").value; $("window-val").textContent = win === 1 ? "none" : `${win} sentences`; drawEmo(); });
  $("prev").addEventListener("click", () => openChapter(chapterN - 1));
  $("next").addEventListener("click", () => openChapter(chapterN + 1));
  window.addEventListener("storage", e => { if (e.key === KEY && +e.newValue && +e.newValue !== chapterN) openChapter(+e.newValue, false); });

  // ---- helpers
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }
  const fmt = v => (v > 0 ? "+" : "") + v.toFixed(2);
  const ei = () => EMOTIONS.indexOf(emotion);
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
  function frame(svgEl) {
    const svg = d3.select(svgEl), W = svgEl.clientWidth || 700, H = svgEl.clientHeight || 150;
    svg.selectAll("*").remove();
    const x = d3.scaleLinear().domain([0, 1]).range([M.l, W - M.r]);
    return { svg, W, H, x };
  }
  function hitLayer(g, x, H, svgEl) {
    g.append("rect").attr("class", "arc-hit").attr("x", x(0)).attr("y", 0).attr("width", x(1) - x(0)).attr("height", H)
      .on("mousemove", ev => { const [mx] = d3.pointer(ev, svgEl); setHover(nearest(x.invert(mx)), ev); })
      .on("mouseleave", () => setHover(null))
      .on("click", () => { pinned = pinned === hoverI ? null : hoverI; drawCursor(); });
  }
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
  const emojiOf = e => data.meta.emotions[e].map(j => G[j]).join(" ");
  function drawKey() {
    const ids = data.meta.emotions[emotion];
    $("emotion-key").innerHTML = `<span class="swatch" style="background:${COLOR}"></span>${emotion} = ${ids.length > 1 ? "summed probability of" : "the probability of"} ${emojiOf(emotion)}`;
    $("emo-title").textContent = `${emotion}, sentence by sentence`;
    $("top-title").textContent = `the sentences with the most ${emotion} in this chapter`;
  }

  // ---- the whole novel, chapter by chapter
  function drawNovel() {
    const C = story.chapters, el = $("novel"), svg = d3.select(el), W = el.clientWidth || 700, H = el.clientHeight || 190;
    svg.selectAll("*").remove();
    const x = d3.scaleLinear().domain([1, C.length]).range([M.l + 10, W - M.r - 10]);
    const bottom = H - 40;                                   // room for the emoji row under the axis
    const k = ei(), v = C.map(c => c.emo[k]), top = Math.ceil((d3.max(v) || .2) * 1.05 * 100) / 100;
    const y = d3.scaleLinear().domain([0, top]).range([bottom, M.t]);
    const g = svg.append("g"), bw = x(2) - x(1);
    g.append("rect").attr("class", "arc-chapter-band").attr("x", x(chapterN) - bw / 2).attr("y", M.t - 4).attr("width", bw).attr("height", bottom - M.t + 4);
    for (const t of [0, top / 2, top]) {
      g.append("line").attr("class", t === 0 ? "axisline" : "gridline").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(t)).attr("y2", y(t));
      g.append("text").attr("class", "ticktext").attr("x", M.l - 6).attr("y", y(t) + 4).attr("text-anchor", "end").text(t.toFixed(2));
    }
    g.append("text").attr("class", "axistitle").attr("x", M.l + 4).attr("y", M.t + 10).text(`mean ${emotion} probability per chapter`);
    const line = d3.line().x((d, i) => x(i + 1)).y(d => y(d)).curve(d3.curveMonotoneX);
    g.append("path").attr("class", "arc-line").attr("stroke", COLOR).attr("d", line(v));
    g.selectAll(null).data(v).join("circle").attr("class", "arc-mark").attr("cx", (d, i) => x(i + 1)).attr("cy", d => y(d)).attr("r", 3.2).attr("fill", COLOR);
    g.append("line").attr("class", "axisline").attr("x1", M.l).attr("x2", W - M.r).attr("y1", bottom).attr("y2", bottom);
    const step = Math.max(1, Math.ceil(C.length / Math.floor((W - 60) / 34)));
    const emojiEvery = Math.max(1, Math.ceil(C.length / Math.floor((W - 60) / 22)));
    C.forEach((c, i) => {
      const n = i + 1, cx = x(n);
      if (n === 1 || n === C.length || n % step === 0 || n === chapterN) g.append("text").attr("class", "ticktext").attr("x", cx).attr("y", bottom + 12).attr("text-anchor", "middle").text(n);
      if (n % emojiEvery === 0 || n === chapterN) g.append("text").attr("class", "arc-emoji-glyph small").attr("x", cx).attr("y", bottom + 30).attr("text-anchor", "middle").text(G[c.top[0]]);
    });
    g.append("text").attr("class", "ticktext").attr("x", M.l - 6).attr("y", bottom + 12).attr("text-anchor", "end").text("ch.");
    g.append("rect").attr("class", "arc-hit").attr("x", M.l).attr("y", 0).attr("width", W - M.l - M.r).attr("height", H)
      .on("mousemove", ev => {
        const [mx] = d3.pointer(ev, el), n = Math.max(1, Math.min(C.length, Math.round(x.invert(mx)))), c = C[n - 1];
        g.selectAll(".arc-chapter-hover").remove();
        g.append("line").attr("class", "arc-cursor arc-chapter-hover").attr("x1", x(n)).attr("x2", x(n)).attr("y1", M.t).attr("y2", bottom);
        tipAt(ev, `<div class="tt-note">chapter ${n} · ${c.nSentences} sentences</div>` +
          `<div class="tt-scores">${EMOTIONS.map((e, j) => `<span${e === emotion ? ' style="color:var(--text-primary)"' : ""}>${e} <b>${c.emo[j].toFixed(2)}</b></span>`).join("")}</div>` +
          `<div class="tt-emoji">${c.top.map(j => G[j]).join("")}<small>most likely emoji, music left out</small></div><div class="tt-note">click to open this chapter</div>`);
      })
      .on("mouseleave", () => { g.selectAll(".arc-chapter-hover").remove(); $("tip").style.display = "none"; })
      .on("click", ev => { const [mx] = d3.pointer(ev, el); openChapter(Math.max(1, Math.min(C.length, Math.round(x.invert(mx))))); });
  }

  // ---- one chapter, sentence by sentence
  let cursors = [];
  function drawEmojiStrip() {
    if (!ch) return;
    const el = $("emoji"), { svg, W, H, x } = frame(el);
    const g = svg.append("g"), bins = Math.max(8, Math.min(24, Math.floor((x(1) - x(0)) / 30)));
    for (let b = 0; b < bins; b++) {
      const lo = Math.floor(b * ch.n / bins), hi = Math.floor((b + 1) * ch.n / bins);
      const mass = new Map();
      for (let i = lo; i < hi; i++) ch.e[i].forEach((j, r) => { if (!MUSIC.has(j)) mass.set(j, (mass.get(j) || 0) + ch.p[i][r]); });
      const top = [...mass.entries()].sort((a, c) => c[1] - a[1]).slice(0, 2);
      if (!top.length) continue;
      const cx = x((b + .5) / bins);
      g.append("text").attr("class", "arc-emoji-glyph").attr("x", cx).attr("y", 24).attr("text-anchor", "middle").text(G[top[0][0]])
        .append("title").text(`${G[top[0][0]]} most likely over sentences ${lo + 1}–${hi}`);
      if (top[1]) g.append("text").attr("class", "arc-emoji-glyph small").attr("x", cx).attr("y", 44).attr("text-anchor", "middle").text(G[top[1][0]]);
    }
    g.append("line").attr("class", "axisline").attr("x1", x(0)).attr("x2", x(1)).attr("y1", H - 6).attr("y2", H - 6);
    cursors[0] = { g: g.append("g"), x, y: null, H: H - 6 };
    hitLayer(g, x, H, el);
  }
  function drawEmo() {
    if (!ch) return;
    const el = $("emo"), { svg, W, H, x } = frame(el);
    const k = ei(), raw = ch.emo.map(r => r[k]), sm = smooth(raw, win);
    const top = Math.max(.2, d3.max(win > 1 ? sm : raw) * 1.1);
    const y = d3.scaleLinear().domain([0, top]).range([H - M.b, M.t]);
    const g = svg.append("g");
    for (const t of [0, top / 2, top]) {
      g.append("line").attr("class", t === 0 ? "axisline" : "gridline").attr("x1", x(0)).attr("x2", x(1)).attr("y1", y(t)).attr("y2", y(t));
      g.append("text").attr("class", "ticktext").attr("x", M.l - 6).attr("y", y(t) + 4).attr("text-anchor", "end").text(t.toFixed(2));
    }
    g.append("text").attr("class", "axistitle").attr("x", x(0) + 5).attr("y", y(top) + 12).text(`${data.meta.emotions[emotion].length > 1 ? "summed " : ""}probability of ${emojiOf(emotion)}`);
    for (const t of [0, .25, .5, .75, 1])
      g.append("text").attr("class", "ticktext").attr("x", x(t)).attr("y", H - M.b + 14).attr("text-anchor", t === 0 ? "start" : t === 1 ? "end" : "middle")
        .text(t === 0 ? "start of the chapter" : t === 1 ? "end" : `${t * 100}%`);
    const line = d3.line().x((d, i) => x(pos(i))).y(d => y(d)).curve(d3.curveMonotoneX);
    svg.append("clipPath").attr("id", "emo-clip").append("rect").attr("x", x(0)).attr("y", M.t).attr("width", x(1) - x(0)).attr("height", H - M.b - M.t);
    if (win > 1) g.append("path").attr("class", "arc-raw").attr("clip-path", "url(#emo-clip)").attr("stroke", COLOR).attr("d", line(raw));   // raw spikes exceed the axis
    g.append("path").attr("class", "arc-line").attr("stroke", COLOR).attr("d", line(sm));
    cursors[1] = { g: g.append("g"), x, y, H, sm };
    hitLayer(g, x, H, el);
    drawCursor();
  }
  function drawCursor() {
    if (!ch) return;
    const i = hoverI ?? pinned;
    for (const c of cursors) {
      if (!c) continue;
      c.g.selectAll("*").remove();
      for (const m of new Set([pinned, i].filter(v => v !== null && v !== undefined))) {
        const px = c.x(pos(m));
        c.g.append("line").attr("class", "arc-cursor").attr("x1", px).attr("x2", px).attr("y1", M.t).attr("y2", c.H - (c.y ? M.b : 0));
        if (c.y) c.g.append("circle").attr("class", "arc-mark").attr("cx", px).attr("cy", c.y(c.sm[m])).attr("r", m === pinned ? 5.5 : 4).attr("fill", COLOR);
      }
    }
  }
  function setHover(i, ev) {
    hoverI = i; drawCursor();
    if (i === null) { $("tip").style.display = "none"; return; }
    tipAt(ev, `<div class="tt-note">sentence ${i + 1} of ${ch.n} in chapter ${chapterN}</div>` +
      `<div>${esc(ch.t[i])}</div>` +
      `<div class="tt-emoji">${ch.e[i].map((j, r) => `${G[j]}<small>${Math.round(ch.p[i][r] * 100)}%</small>`).join("")}</div>` +
      `<div class="tt-scores"><span>${emotion} <b>${ch.emo[i][ei()].toFixed(2)}</b></span><span>classifier <b>${fmt(ch.clf[i])}</b></span><span>lexicon <b>${fmt(ch.lex[i])}</b></span></div>`);
  }
  function drawTopList() {
    if (!ch) return;
    const k = ei(), rows = d3.range(ch.n).sort((a, b) => ch.emo[b][k] - ch.emo[a][k]).slice(0, 6);
    $("top-list").innerHTML = rows.map(i =>
      `<li><button data-i="${i}">${esc(ch.t[i])}</button><span class="num"><small>${emotion}</small>${ch.emo[i][k].toFixed(2)}</span><span class="emo">${ch.e[i].map(j => G[j]).join("")}</span></li>`
    ).join("");
    document.querySelectorAll("#top-list button").forEach(b => b.addEventListener("click", () => { pinned = +b.dataset.i; drawCursor(); }));
  }
  function drawHeader() {
    const c = story.chapters[chapterN - 1];
    $("chapter-title").textContent = `Inside chapter ${chapterN} · ${c.nSentences} sentences`;
    $("prev").disabled = chapterN <= 1; $("next").disabled = chapterN >= story.chapters.length;
  }
  function drawFoot() {
    $("foot").innerHTML = `<a href="${esc(story.url)}" target="_blank" rel="noopener">${esc(story.title)}</a> by ${esc(story.author)} · ` +
      `${story.chapters.length} chapters, ${story.nSentences.toLocaleString()} sentences, ${story.nWords.toLocaleString()} words · ` +
      `DeepMoji: Felbo et al. (2017), 64 emoji, run with torchMoji · click the chapter panel to pin a sentence` + (story.note ? ` · ${esc(story.note)}` : "");
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
    drawHeader(); drawNovel(); drawEmojiStrip(); drawEmo(); drawTopList(); drawFoot();
  }
  drawKey();
  await openChapter(storedChapter(), false);
  window.addEventListener("resize", () => { drawNovel(); drawEmojiStrip(); drawEmo(); });
})();
