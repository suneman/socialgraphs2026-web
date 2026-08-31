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

  const toks = corpus.toLocaleLowerCase().match(/[\p{L}]+/gu) || [];
  const wordContexts = new Map();
  const occurrences = new Map();

  for (let i = 1; i < toks.length - 1; i++) {
    const word = toks[i];
    const key = `${toks[i - 1]}\u0000${toks[i + 1]}`;
    if (!wordContexts.has(word)) wordContexts.set(word, new Set());
    wordContexts.get(word).add(key);
    if (!occurrences.has(word)) occurrences.set(word, []);
    occurrences.get(word).push(i);
  }

  const preferred = ["blue", "red", "small", "young", "dog", "room"];
  const words = preferred.filter((word) => wordContexts.has(word));
  $("target").innerHTML = words.map((word) => `<option>${word}</option>`).join("");

  function kwicRow(index, target) {
    const left = toks.slice(Math.max(0, index - 3), index).join(" ");
    const right = toks.slice(index + 1, Math.min(toks.length, index + 4)).join(" ");
    return `<div class="context-item"><span class="left">${left}</span><span class="middle">${target}</span><span>${right}</span></div>`;
  }

  function render() {
    const target = $("target").value;
    const targetContexts = wordContexts.get(target) || new Set();
    const targetOccurrences = occurrences.get(target) || [];

    $("concordance").innerHTML = targetOccurrences.length
      ? targetOccurrences.map((index) => kwicRow(index, target)).join("")
      : `<p class="note">No occurrences in this toy corpus.</p>`;

    const scored = [];
    for (const [word, contexts] of wordContexts.entries()) {
      if (word === target) continue;
      let shared = 0;
      for (const context of targetContexts) if (contexts.has(context)) shared += 1;
      if (shared) scored.push([word, shared]);
    }
    scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    const max = Math.max(1, ...scored.map((x) => x[1]));
    $("candidates").innerHTML = scored.length
      ? scored.slice(0, 8).map(([word, n]) => `
          <div class="bar-row"><span class="word">${word}</span><span class="bar"><span style="width:${100 * n / max}%"></span></span><span class="num">${n}</span></div>`).join("")
      : `<p class="note">No other word shares an exact immediate context with this target.</p>`;

    $("r-target").textContent = target;
    $("r-occurrences").textContent = targetOccurrences.length;
    $("r-best").textContent = scored.length ? scored[0][0] : "none";
  }

  $("target").addEventListener("change", render);
  render();
})();
