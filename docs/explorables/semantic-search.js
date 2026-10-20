/* Sparse and dense retrieval over the 303 Marvel pages. Two modes:
   - preset query (menu): both columns precomputed offline over the FULL Wikipedia pages by
     tools/groundtruth/week7_semantic_search.py — sparse = TfidfVectorizer() on the pages, dense =
     all-MiniLM-L6-v2 as the page's best 60-word passage (default) or as a page mean (the corpus-atlas
     vectors). Each preset knows which page it is about; the scoreboard under the menu says where
     every method ranked it, and that row is marked in the lists.
   - your own words: the encoder cannot run in the page, so only the sparse column answers, live,
     over the one-line descriptions (week7_search_index.json: vocab, idf, TF-IDF rows).
   Data: data/week7_search_presets.json + data/week7_search_index.json. */
"use strict";
(async function () {
  const [presets, index] = await Promise.all([
    fetch("data/week7_search_presets.json").then(r => r.json()),
    fetch("data/week7_search_index.json").then(r => r.json()),
  ]);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  let denseMode = "passage", current = null;   // current = preset row, or null in free-text mode

  $("preset").innerHTML = presets.queries.map((q, i) => `<option value="${i}">${esc(q.q)}</option>`).join("");
  $("preset").addEventListener("change", () => showPreset(+$("preset").value));
  document.querySelectorAll("#dense-mode button").forEach(b => b.addEventListener("click", () => {
    denseMode = b.dataset.v;
    document.querySelectorAll("#dense-mode button").forEach(x => x.classList.toggle("on", x === b));
    if (current) renderDense();
  }));
  $("run").addEventListener("click", runFree);
  $("query").addEventListener("keydown", e => { if (e.key === "Enter") runFree(); });

  // ---- preset mode: everything precomputed over the full pages
  function showPreset(k) {
    current = presets.queries[k];
    $("query").value = "";
    $("sparse-tag").textContent = "full pages, precomputed"; $("sparse-tag").className = "mode-tag";
    $("dense-tag").textContent = "full pages, precomputed"; $("dense-tag").className = "mode-tag";
    $("sparse-sub").textContent = "TF-IDF on the full pages, query as one more document · the words it matched are listed";
    $("sparse-results").innerHTML = current.sparse.map((r, rank) => {
      const d = presets.docs[r.i];
      return `<div class="search-result${isTarget(d) ? " target" : ""}"><div class="row"><div class="name">${rank + 1}. ${esc(d.name)}</div><div class="score">${r.s.toFixed(2)}</div></div>` +
        `<div class="desc">${esc(d.description)}</div><div class="matched">matched: ${r.m.length ? r.m.map(t => `<b>${esc(t)}</b>`).join(", ") : "—"}</div></div>`;
    }).join("");
    renderDense(); renderScoreboard();
    $("foot").innerHTML = `Preset queries: both columns computed offline over the full Wikipedia pages, the dense one with all-MiniLM-L6-v2 ` +
      `(${presets.meta.nPassages.toLocaleString()} passages of at most ${presets.meta.passageWords} words, or one mean vector per page). Your own words: the encoder does not run in the page, so only the sparse column answers, over the one-line descriptions.`;
  }
  const isTarget = d => current && current.target && d.name === current.target;
  function renderScoreboard() {
    const Q = presets.queries.filter(q => q.rank), n = Q.length;
    const cell = m => { const r = Q.map(q => q.rank[m]); return `1st in <b>${r.filter(x => x === 1).length}</b>, top 3 in <b>${r.filter(x => x <= 3).length}</b> of ${n}`; };
    const here = current.rank ? ` · this query, <b>${esc(current.target)}</b>: sparse #${current.rank.sparse}, best passage #${current.rank.passage}, page mean #${current.rank.mean}` :
      ` · this query has no page in the corpus`;
    $("scoreboard").innerHTML = `Where the page each preset is about landed — sparse: ${cell("sparse")} · dense, best passage: ${cell("passage")} · dense, page mean: ${cell("mean")}${here}`;
  }
  function renderDense() {
    const rows = current[denseMode];
    $("dense-sub").textContent = denseMode === "mean"
      ? "all-MiniLM-L6-v2 · one vector per page (the mean of its 180-word passages, as in the corpus atlas) · cosine to the query"
      : `all-MiniLM-L6-v2 · every ${presets.meta.passageWords}-word passage scored, each page gets its best one · that passage is shown`;
    $("dense-results").innerHTML = rows.map((r, rank) => {
      const d = presets.docs[r.i];
      const body = denseMode === "passage" ? `<div class="desc passage">${esc(r.t)}</div>` : `<div class="desc">${esc(d.description)}</div>`;
      return `<div class="search-result${isTarget(d) ? " target" : ""}"><div class="row"><div class="name">${rank + 1}. ${esc(d.name)}</div><div class="score">${r.s.toFixed(2)}</div></div>${body}</div>`;
    }).join("");
  }

  // ---- free-text mode: sparse only, live, over the one-line descriptions
  const vocab = new Map(index.vocab.map((t, i) => [t, i]));
  function queryVector(q) {
    const tokens = (q.toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => vocab.has(t));
    const counts = new Map(); tokens.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    const v = new Map(); let norm = 0;
    counts.forEach((n, t) => { const j = vocab.get(t), x = (1 + Math.log(n)) * index.idf[j]; v.set(j, x); norm += x * x; });
    norm = Math.sqrt(norm) || 1; v.forEach((x, j) => v.set(j, x / norm));
    return v;
  }
  function runFree() {
    const q = $("query").value.trim();
    if (!q) { showPreset(+$("preset").value); return; }
    current = null;
    const qv = queryVector(q);
    $("sparse-tag").textContent = "one-line descriptions, live"; $("sparse-tag").className = "mode-tag live";
    $("dense-tag").textContent = "preset queries only"; $("dense-tag").className = "mode-tag";
    $("sparse-sub").textContent = "TF-IDF over the 303 one-line descriptions, computed in the page";
    $("dense-sub").textContent = "the encoder cannot run here";
    $("scoreboard").innerHTML = "";
    if (!qv.size) {
      $("sparse-results").innerHTML = '<div class="note">No query word occurs in the description vocabulary. Try other words or a preset.</div>';
    } else {
      const scores = index.sparseDocs.map(doc => { let s = 0; for (const [j, v] of doc) if (qv.has(j)) s += v * qv.get(j); return s; });
      const top = scores.map((s, i) => [i, s]).sort((a, b) => b[1] - a[1]).slice(0, 6);
      $("sparse-results").innerHTML = top.map(([i, s], rank) => {
        const d = index.docs[i];
        return `<div class="search-result"><div class="row"><div class="name">${rank + 1}. ${esc(d.name)}</div><div class="score">${s.toFixed(3)}</div></div><div class="desc">${esc(d.description)}</div></div>`;
      }).join("");
    }
    $("dense-results").innerHTML = '<div class="note">Dense rankings exist only for the preset queries: the page would need the 90 MB MiniLM model to encode new text. Pick a preset to compare both columns, or run the encoder in your notebook.</div>';
  }

  showPreset(0);
})();
