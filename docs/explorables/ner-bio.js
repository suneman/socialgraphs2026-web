"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  let mode = "entity";
  const data = {
    swift: [
      ["Taylor", "PERSON", "B-PER"], ["Swift", "PERSON", "I-PER"], ["met", "O", "O"],
      ["Spotify", "ORG", "B-ORG"], ["staff", "O", "O"], ["in", "O", "O"],
      ["Copenhagen", "GPE", "B-GPE"], ["in", "O", "O"], ["2026", "DATE", "B-DATE"], [".", "O", "O"]
    ],
    maya: [
      ["Maya", "PERSON", "B-PER"], ["Chen", "PERSON", "I-PER"], ["joined", "O", "O"],
      ["Aurora", "ORG", "B-ORG"], ["Records", "ORG", "I-ORG"], ["in", "O", "O"], ["Berlin", "GPE", "B-GPE"], [".", "O", "O"]
    ],
    summit: [
      ["The", "O", "O"], ["summit", "O", "O"], ["starts", "O", "O"], ["on", "O", "O"],
      ["14", "DATE", "B-DATE"], ["May", "DATE", "I-DATE"], ["in", "O", "O"], ["Lisbon", "GPE", "B-GPE"], [".", "O", "O"]
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
      } else current.words.push(word);
    });
    if (current) out.push(current);
    return out;
  }

  function render() {
    const rows = data[$("example").value];
    $("tokens").innerHTML = rows.map(([word, type, bio]) => {
      const tag = mode === "bio" ? bio : type;
      return `<span class="token-chip ${cls[type]}">${word}<span class="tag">${tag}</span></span>`;
    }).join("");
    const entities = spans(rows);
    $("entities").innerHTML = entities.map((e) => `<tr><td>${e.words.join(" ")}</td><td>${e.type}</td><td>${e.words.length}</td></tr>`).join("");
    $("n-tokens").textContent = String(rows.filter((d) => d[0] !== ".").length);
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
