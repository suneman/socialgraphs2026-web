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

  function tokenChip([word, type, bio]) {
    const tag = mode === "bio" ? bio : type;
    return `<span class="ner-chip ${cls[type]}">${word}<span class="tag">${tag}</span></span>`;
  }

  function render() {
    const rows = data[$("example").value];
    $("tokens").innerHTML = `<div class="token-row ner-row">${rows.map(tokenChip).join("")}</div>`;
    const entities = spans(rows);
    $("entities").innerHTML = entities.map((e) => `<tr><td><span class="ner-dot ${cls[e.type]}"></span>${e.words.join(" ")}</td><td>${e.type}</td><td>${e.words.length}</td></tr>`).join("");
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
