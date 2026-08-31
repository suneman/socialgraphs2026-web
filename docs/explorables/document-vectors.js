"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const initialDocs = [
    ["Document 1", "brains predict the future"],
    ["Document 2", "models predict the future"],
    ["Document 3", "brains build models"],
  ];

  let view = "row";
  let pick = 0;
  let docs = initialDocs.map(([name, text]) => [name, text]);
  let vocab = [];
  let counts = [];

  function tokenize(text) {
    return text.toLocaleLowerCase().match(/[\p{L}]+/gu) || [];
  }

  function rebuildCounts() {
    const toks = docs.map(([, text]) => tokenize(text));
    vocab = Array.from(new Set(toks.flat())).sort((a, b) => a.localeCompare(b));
    counts = toks.map((arr) => vocab.map((word) => arr.reduce((n, x) => n + (x === word ? 1 : 0), 0)));
  }

  function renderDocs() {
    $("docs").innerHTML = docs.map(([name, text], i) => `
      <label class="editable-doc">
        <span>${name}</span>
        <input type="text" data-doc="${i}" value="${text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}">
      </label>`).join("");

    document.querySelectorAll("[data-doc]").forEach((input) => {
      input.addEventListener("input", () => {
        const i = Number(input.dataset.doc);
        docs[i][1] = input.value;
        rebuildCounts();
        if (view === "col" && pick >= vocab.length) pick = Math.max(0, vocab.length - 1);
        renderPicker();
        renderMatrix();
        renderReadout();
      });
    });
  }

  function renderPicker() {
    const items = view === "row"
      ? docs.map((d, i) => [i, d[0]])
      : vocab.map((word, i) => [i, word]);

    $("pick-label").firstChild.textContent = view === "row" ? "Document " : "Word ";
    $("pick").innerHTML = items.length
      ? items.map(([i, label]) => `<option value="${i}">${label}</option>`).join("")
      : `<option value="0">no vocabulary</option>`;

    pick = Math.min(pick, Math.max(0, items.length - 1));
    $("pick").value = pick;

    if (view === "row") {
      $("view-explain").innerHTML = `<span class="view-kicker">ROW VIEW</span> One document → counts for every vocabulary term.`;
    } else {
      $("view-explain").innerHTML = `<span class="view-kicker">COLUMN VIEW</span> One vocabulary term → its count across all documents.`;
    }
  }

  function renderMatrix() {
    if (!vocab.length) {
      $("matrix").innerHTML = `<p class="note">Add at least one word to the documents to build the matrix.</p>`;
      $("vector-label").textContent = "Vector";
      $("vector").textContent = "[]";
      return;
    }

    const head = `<tr><th>document</th>${vocab.map((word, j) => `<th class="${view === "col" && pick === j ? "active-col" : ""}">${word}</th>`).join("")}</tr>`;
    const body = docs.map(([name], i) => `
      <tr class="${view === "row" && pick === i ? "active" : ""}">
        <td>${name}</td>
        ${counts[i].map((value, j) => `<td class="${view === "col" && pick === j ? "active-col" : ""}">${value}</td>`).join("")}
      </tr>`).join("");
    $("matrix").innerHTML = `<table class="matrix">${head}${body}</table>`;

    if (view === "row") {
      $("vector-label").textContent = `${docs[pick][0]} as one Bag-of-Words vector`;
      $("vector").textContent = `[${counts[pick].join(", ")}]`;
    } else {
      const col = counts.map((row) => row[pick]);
      $("vector-label").textContent = `${vocab[pick]} across the three documents`;
      $("vector").textContent = `[${col.join(", ")}]`;
    }
  }

  function renderReadout() {
    $("r-docs").textContent = docs.length;
    $("r-vocab").textContent = vocab.length;
  }

  function renderAll() {
    rebuildCounts();
    renderDocs();
    renderPicker();
    renderMatrix();
    renderReadout();
  }

  document.querySelectorAll("#view-seg button").forEach((button) => button.addEventListener("click", () => {
    view = button.dataset.view;
    pick = 0;
    document.querySelectorAll("#view-seg button").forEach((x) => x.classList.toggle("on", x === button));
    renderPicker();
    renderMatrix();
  }));

  $("pick").addEventListener("change", () => {
    pick = Number($("pick").value);
    renderMatrix();
  });

  $("reset").addEventListener("click", () => {
    docs = initialDocs.map(([name, text]) => [name, text]);
    pick = 0;
    renderAll();
  });

  renderAll();
})();
