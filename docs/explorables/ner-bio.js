"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  let mode = "entity";
  const data = {
    iron: [
      ["Iron", "PERSON", "B-PER"], ["Man", "PERSON", "I-PER"], ["(", "O", "O"],
      ["Tony", "PERSON", "B-PER"], ["Stark", "PERSON", "I-PER"], [")", "O", "O"],
      ["met", "O", "O"], ["Black", "PERSON", "B-PER"], ["Widow", "PERSON", "I-PER"],
      ["in", "O", "O"], ["New", "GPE", "B-GPE"], ["York", "GPE", "I-GPE"], [".", "O", "O"]
    ],
    strange: [
      ["Doctor", "PERSON", "B-PER"], ["Strange", "PERSON", "I-PER"], ["joined", "O", "O"],
      ["the", "O", "O"], ["Avengers", "ORG", "B-ORG"], ["in", "O", "O"],
      ["New", "GPE", "B-GPE"], ["York", "GPE", "I-GPE"], ["on", "O", "O"],
      ["14", "DATE", "B-DATE"], ["May", "DATE", "I-DATE"], [".", "O", "O"]
    ],
    wolverine: [
      ["Wolverine", "PERSON", "B-PER"], ["visited", "O", "O"],
      ["Stark", "ORG", "B-ORG"], ["Industries", "ORG", "I-ORG"], ["in", "O", "O"],
      ["Tokyo", "GPE", "B-GPE"], [".", "O", "O"]
    ]
  };
  const cls = { PERSON: "person", ORG: "org", GPE: "place", DATE: "date", O: "" };

  function spans(rows) {
    const out = [];
    let current = null;
    rows.forEach(([word, type]) => {
      if (type === "O") {
        if (current) out.push(current);
        current = null;
      } else if (!current || current.type !== type) {
        if (current) out.push(current);
        current = { type, words: [word] };
      } else {
        current.words.push(word);
      }
    });
    if (current) out.push(current);
    return out;
  }

  function chunkIntoRows(rows, nRows) {
    const total = rows.length;
    const base = Math.floor(total / nRows);
    const rem = total % nRows;
    const out = [];
    let idx = 0;
    for (let r = 0; r < nRows; r += 1) {
      const size = base + (r < rem ? 1 : 0);
      out.push(rows.slice(idx, idx + size));
      idx += size;
    }
    return out.filter((row) => row.length);
  }

  function tokenChip([word, type, bio]) {
    const tag = mode === "bio" ? bio : type;
    return `<span class="token-chip ${cls[type]}">${word}<span class="tag">${tag}</span></span>`;
  }

  function render() {
    const rows = data[$("example").value];
    const chunks = chunkIntoRows(rows, 3);
    $("tokens").innerHTML = chunks.map((chunk) => `<div class="token-row ner-row">${chunk.map(tokenChip).join("")}</div>`).join("");
    const entities = spans(rows);
    $("entities").innerHTML = entities.map((e) => `<tr><td>${e.words.join(" ")}</td><td>${e.type}</td><td>${e.words.length}</td></tr>`).join("");
    $("n-tokens").textContent = String(rows.filter((d) => !/^[-.,;:!?()]+$/.test(d[0])).length);
    $("n-entities").textContent = String(entities.length);
  }

  document.querySelectorAll("#tag-mode button").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      document.querySelectorAll("#tag-mode button").forEach((b) => b.classList.toggle("on", b === button));
      render();
    });
  });
  $("example").addEventListener("change", render);
  render();
})();
