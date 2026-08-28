"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const corpus = `
    the blue car moved. the red car moved.
    a blue dress shimmered. a red dress shimmered.
    the blue sky brightened. the cloudy sky brightened.
    a blue light flashed. a red light flashed.
    the small dog slept. the young dog slept.
    a small child laughed. a young child laughed.
    the small room felt cold. the quiet room felt cold.
  `;

  const toks = (corpus.toLocaleLowerCase().match(/[\p{L}]+/gu) || []);
  const wordContexts = new Map();

  for (let i = 1; i < toks.length - 1; i++) {
    const w = toks[i];
    const key = `${toks[i - 1]}\u0000${toks[i + 1]}`;
    if (!wordContexts.has(w)) wordContexts.set(w, new Set());
    wordContexts.get(w).add(key);
  }

  const preferred = ["blue", "red", "small", "young", "dog", "room"];
  const words = preferred.filter((w) => wordContexts.has(w));
  $("target").innerHTML = words.map((w) => `<option>${w}</option>`).join("");

  function render() {
    const target = $("target").value;
    const ctxs = wordContexts.get(target) || new Set();
    const rows = Array.from(ctxs).map((key) => {
      const [left, right] = key.split("\u0000");
      return `<div class="context-item"><span class="left">${left}</span><span class="middle">${target}</span><span>${right}</span></div>`;
    });
    $("contexts").innerHTML = rows.join("") || `<p class="note">No contexts.</p>`;

    const scored = [];
    for (const [word, contexts] of wordContexts.entries()) {
      if (word === target) continue;
      let shared = 0;
      for (const c of ctxs) if (contexts.has(c)) shared += 1;
      if (shared) scored.push([word, shared]);
    }
    scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const max = Math.max(1, ...scored.map((x) => x[1]));
    $("candidates").innerHTML = scored.length ? scored.slice(0, 8).map(([word, n]) => `
      <div class="bar-row"><span class="word">${word}</span><span class="bar"><span style="width:${100*n/max}%"></span></span><span class="num">${n}</span></div>`).join("") : `<p class="note">No other word shares an exact context in this toy corpus.</p>`;

    $("r-target").textContent = target;
    $("r-contexts").textContent = ctxs.size;
    $("r-best").textContent = scored.length ? scored[0][0] : "none";
  }

  $("target").addEventListener("change", render);
  render();
})();
