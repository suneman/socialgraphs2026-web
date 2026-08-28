"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const initial = "more is said than done and more is learned by doing";
  let n = 2;

  function tokenize(s) { return s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []; }

  function render() {
    const toks = tokenize($("text").value);
    $("tokens").innerHTML = toks.map((t) => `<span class="token">${t}</span>`).join("");
    const grams = [];
    for (let i = 0; i <= toks.length - n; i++) grams.push(toks.slice(i, i + n));
    $("ngrams").innerHTML = grams.length ? grams.map((g, i) => `
      <div class="ngram"><span class="idx">${i + 1}</span>${g.map((t) => `<span class="token">${t}</span>`).join("")}</div>`).join("") : `<p class="note">Not enough tokens for n = ${n}.</p>`;
    $("r-n").textContent = n;
    $("r-tokens").textContent = toks.length;
    $("r-grams").textContent = grams.length;
  }

  document.querySelectorAll("#n-seg button").forEach((b) => b.addEventListener("click", () => {
    n = +b.dataset.n;
    document.querySelectorAll("#n-seg button").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  $("text").addEventListener("input", render);
  $("reset").addEventListener("click", () => { $("text").value = initial; render(); });
  render();
})();
