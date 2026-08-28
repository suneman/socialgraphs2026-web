"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const docs = [
    ["Doc A", "the dog chases the ball"],
    ["Doc B", "the puppy follows the ball"],
    ["Doc C", "parliament passes the election law"],
  ];
  let view = "row";
  let pick = 0;

  const toks = docs.map(([, text]) => text.toLocaleLowerCase().match(/[\p{L}]+/gu) || []);
  const vocab = Array.from(new Set(toks.flat())).sort((a, b) => a.localeCompare(b));
  const counts = toks.map((arr) => vocab.map((w) => arr.filter((x) => x === w).length));

  function renderDocs() {
    $("docs").innerHTML = docs.map(([name, text], i) => `
      <div style="margin:0 0 12px"><span class="small-label">${name}</span><div class="vector-line">${text}</div></div>`).join("");
  }

  function renderPicker() {
    const items = view === "row" ? docs.map((d, i) => [i, d[0]]) : vocab.map((w, i) => [i, w]);
    $("pick-label").firstChild.textContent = view === "row" ? "Document " : "Word ";
    $("pick").innerHTML = items.map(([i, label]) => `<option value="${i}">${label}</option>`).join("");
    pick = Math.min(pick, items.length - 1);
    $("pick").value = pick;
  }

  function renderMatrix() {
    const head = `<tr><th>document</th>${vocab.map((w, j) => `<th class="${view === "col" && pick === j ? "active-col" : ""}">${w}</th>`).join("")}</tr>`;
    const body = docs.map(([name], i) => `<tr class="${view === "row" && pick === i ? "active" : ""}"><td>${name}</td>${counts[i].map((v, j) => `<td class="${view === "col" && pick === j ? "active-col" : ""}">${v}</td>`).join("")}</tr>`).join("");
    $("matrix").innerHTML = `<table class="matrix">${head}${body}</table>`;

    if (view === "row") {
      $("vector-label").textContent = `${docs[pick][0]} as a vector`;
      $("vector").textContent = `[${counts[pick].join(", ")}]`;
    } else {
      const col = counts.map((row) => row[pick]);
      $("vector-label").textContent = `${vocab[pick]} as a vector across documents`;
      $("vector").textContent = `[${col.join(", ")}]`;
    }
  }

  function render() {
    renderPicker(); renderMatrix();
    $("r-vocab").textContent = vocab.length;
  }

  document.querySelectorAll("#view-seg button").forEach((b) => b.addEventListener("click", () => {
    view = b.dataset.view; pick = 0;
    document.querySelectorAll("#view-seg button").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  $("pick").addEventListener("change", () => { pick = +$("pick").value; renderMatrix(); });
  renderDocs(); render();
})();
