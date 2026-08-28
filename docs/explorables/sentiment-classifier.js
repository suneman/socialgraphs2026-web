"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const train = [
    ["wonderful album with great songs", 1],
    ["good concert with excellent sound", 1],
    ["i love this beautiful record", 1],
    ["fun energetic performance", 1],
    ["terrible album with boring songs", 0],
    ["bad concert with awful sound", 0],
    ["i hate this dull record", 0],
    ["disappointing slow performance", 0]
  ];

  const tokenize = (s) => s.toLowerCase().match(/[a-z']+/g) || [];
  const vocab = Array.from(new Set(train.flatMap((d) => tokenize(d[0])))).sort();
  const index = new Map(vocab.map((w, i) => [w, i]));
  const N = train.length;
  const df = vocab.map((w) => train.reduce((s, d) => s + (tokenize(d[0]).includes(w) ? 1 : 0), 0));
  const idf = df.map((d) => Math.log((N + 1) / (d + 1)) + 1);

  function vector(text) {
    const words = tokenize(text);
    const counts = new Array(vocab.length).fill(0);
    words.forEach((w) => { if (index.has(w)) counts[index.get(w)] += 1; });
    const denom = Math.max(1, words.length);
    return counts.map((c, i) => (c / denom) * idf[i]);
  }

  const X = train.map((d) => vector(d[0]));
  const y = train.map((d) => d[1]);
  const w = new Array(vocab.length).fill(0);
  let b = 0;
  const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

  for (let iter = 0; iter < 1800; iter++) {
    const gw = new Array(w.length).fill(0);
    let gb = 0;
    for (let i = 0; i < X.length; i++) {
      const z = X[i].reduce((s, xj, j) => s + xj * w[j], b);
      const err = sigmoid(z) - y[i];
      X[i].forEach((xj, j) => { gw[j] += err * xj; });
      gb += err;
    }
    const lr = 0.65;
    const lambda = 0.015;
    w.forEach((_, j) => { w[j] -= lr * (gw[j] / N + lambda * w[j]); });
    b -= lr * gb / N;
  }

  function renderTraining() {
    $("training").innerHTML = train.map((d) => `<div class="doc-check"><span class="token-chip ${d[1] ? "person" : "org"}">${d[1] ? "+" : "−"}</span><span>${d[0]}</span></div>`).join("");
  }

  function render() {
    const text = $("query-choice").value;
    const x = vector(text);
    const z = x.reduce((s, xj, j) => s + xj * w[j], b);
    const p = sigmoid(z);
    const contributions = x.map((xj, j) => ({ word: vocab[j], value: xj * w[j], x: xj, weight: w[j] }))
      .filter((d) => Math.abs(d.value) > 0.0001)
      .sort((a, b2) => Math.abs(b2.value) - Math.abs(a.value))
      .slice(0, 8);
    const max = Math.max(0.01, ...contributions.map((d) => Math.abs(d.value)));

    $("query").textContent = `TF-IDF(text) → w·x + b = ${z.toFixed(2)} → sigmoid = ${p.toFixed(3)}`;
    $("features").innerHTML = contributions.length ? contributions.map((d) => {
      const pct = Math.min(50, Math.abs(d.value) / max * 50);
      const bar = d.value >= 0
        ? `<span class="bar pos" style="width:${pct}%"></span>`
        : `<span class="bar neg" style="width:${pct}%"></span>`;
      return `<div class="feature"><span class="name">${d.word}</span><span class="track">${bar}</span><span class="value">${d.value >= 0 ? "+" : ""}${d.value.toFixed(2)}</span></div>`;
    }).join("") : `<p class="note">None of the sentence's words occur in the training vocabulary.</p>`;

    $("prob").textContent = p.toFixed(3);
    $("prediction").textContent = p >= 0.5 ? "positive" : "negative";
    $("used").textContent = String(contributions.length);
  }

  $("query-choice").addEventListener("change", render);
  renderTraining();
  render();
})();
