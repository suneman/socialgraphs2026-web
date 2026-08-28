"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const stages = [
    { title: "Counts", rep: "frequency table", gain: "Measure which tokens occur and how often.", limit: "Word order and context are mostly absent." },
    { title: "Bag of Words", rep: "document vector over vocabulary", gain: "Compare documents in a shared coordinate system.", limit: "Synonyms remain unrelated dimensions." },
    { title: "TF-IDF", rep: "weighted document vector", gain: "Downweight corpus-wide words and reward distinctive terms.", limit: "Meaning still depends on explicit vocabulary overlap." },
    { title: "Co-occurrence", rep: "word × context matrix", gain: "Represent words by the contexts in which they appear.", limit: "The matrix is large, sparse, and still uses fixed contexts." },
    { title: "Word2Vec", rep: "dense static word embedding", gain: "Learn compact geometry from a prediction task.", limit: "One word form still gets one vector across contexts." },
    { title: "Contextual embeddings", rep: "token vector conditioned on its sentence", gain: "The same word can receive different representations in different contexts.", limit: "We still need a mechanism to combine information across many tokens." },
    { title: "Transformers", rep: "layers of context-sensitive token representations", gain: "Attention lets tokens exchange information across the sequence.", limit: "A pretrained model still needs an objective, data, and often task-specific adaptation." },
    { title: "LLMs", rep: "Transformer trained to model token sequences", gain: "Generate and score language by predicting distributions over possible continuations.", limit: "Prediction quality is not the same as truth, causal understanding, or unbiased measurement." }
  ];
  const next = [["a genre", 0.34], ["coherent", 0.23], ["large", 0.17], ["connected", 0.14], ["unexpected", 0.12]];
  let current = 0;

  function render() {
    $("arc").innerHTML = stages.map((s, i) => `<button data-i="${i}" class="${i === current ? "on" : ""}">${i + 1}<br>${s.title}</button>`).join("");
    document.querySelectorAll("#arc button").forEach((b) => b.addEventListener("click", () => { current = +b.dataset.i; render(); }));
    const s = stages[current];
    $("title").textContent = `${current + 1} · ${s.title}`;
    $("representation").textContent = s.rep;
    $("gain").textContent = s.gain;
    $("limit").textContent = s.limit;
    $("next-token").hidden = current !== stages.length - 1;
    $("token-list").innerHTML = next.map(([w, p]) => `<div class="next-token"><span>${w}</span><span class="track"><span style="width:${p * 100}%"></span></span><span>${Math.round(p * 100)}%</span></div>`).join("");
  }
  render();
})();
