"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  let mode = "bank";

  const bankData = {
    finance: {
      words: ["I", "went", "to", "the", "bank", "to", "deposit", "money"],
      weights: [["deposit", 0.38], ["money", 0.31], ["went", 0.12], ["the", 0.05]],
      contextual: [0.78, 0.22],
      label: "financial context"
    },
    river: {
      words: ["I", "sat", "on", "the", "river", "bank", "near", "the", "water"],
      weights: [["river", 0.35], ["water", 0.29], ["near", 0.13], ["sat", 0.08]],
      contextual: [0.18, 0.82],
      label: "river context"
    }
  };
  const staticVec = [0.46, 0.48];

  function renderBank() {
    const d = bankData[$("bank-sentence").value];
    $("bank-tokens").innerHTML = d.words.map((w) => `<span class="token-chip ${w.toLowerCase() === "bank" ? "target" : ""}">${w}</span>`).join("");
    $("attention").innerHTML = d.weights.map(([w, v]) => `<div class="attn-list"><span>${w}</span><span class="track"><span style="width:${v * 100}%"></span></span><span>${v.toFixed(2)}</span></div>`).join("");

    const sx = 70 + staticVec[0] * 270, sy = 250 - staticVec[1] * 190;
    const fx = 70 + bankData.finance.contextual[0] * 270, fy = 250 - bankData.finance.contextual[1] * 190;
    const rx = 70 + bankData.river.contextual[0] * 270, ry = 250 - bankData.river.contextual[1] * 190;
    const active = $("bank-sentence").value === "finance" ? [fx, fy] : [rx, ry];

    $("embed").innerHTML = `
      <line class="gridline" x1="70" y1="250" x2="370" y2="250"></line>
      <line class="gridline" x1="70" y1="250" x2="70" y2="35"></line>
      <text class="ticktext" x="270" y="286">financial direction</text>
      <text class="ticktext" x="12" y="52">river direction</text>
      <circle class="embed-point" cx="${sx}" cy="${sy}" r="7"></circle>
      <text class="embed-label" x="${sx + 10}" y="${sy - 7}">static bank</text>
      <circle class="embed-point alt" cx="${fx}" cy="${fy}" r="7"></circle>
      <text class="embed-label" x="${fx + 10}" y="${fy - 7}">bank · deposit money</text>
      <circle class="embed-point alt" cx="${rx}" cy="${ry}" r="7"></circle>
      <text class="embed-label" x="${rx + 10}" y="${ry - 7}">bank · river water</text>
      <circle cx="${active[0]}" cy="${active[1]}" r="13" fill="none" stroke="var(--accent)" stroke-width="2"></circle>`;
    $("vector-text").textContent = `static bank = [${staticVec.map((x) => x.toFixed(2)).join(", ")}] · contextual bank = [${d.contextual.map((x) => x.toFixed(2)).join(", ")}] · ${d.label}`;
  }

  function renderBert() {
    const kind = $("sentiment-sentence").value;
    const words = kind === "notgood" ? ["[CLS]", "This", "album", "is", "not", "good", "[SEP]"] : ["[CLS]", "This", "album", "is", "genuinely", "great", "[SEP]"];
    $("bert-tokens").innerHTML = words.map((w) => `<span class="token-chip ${w === "not" || w === "good" || w === "great" ? "target" : ""}">${w}</span>`).join("");
    const rep = kind === "notgood" ? "good is represented together with not" : "great is represented in its sentence";
    const cls = kind === "notgood" ? "context-sensitive [CLS]" : "context-sensitive [CLS]";
    const label = kind === "notgood" ? "negative" : "positive";
    const steps = [
      ["1", "tokens", words.slice(1, -1).join(" ")],
      ["2", "embeddings", "start with token + position information"],
      ["3", "Transformer", rep],
      ["4", "pooled vector", cls],
      ["5", "classifier head", `label → ${label}`]
    ];
    $("pipeline").innerHTML = steps.map((s, i) => `<div class="pipeline-step ${i === 2 ? "active" : ""}"><div class="k">${s[0]} · ${s[1]}</div><div class="v">${s[2]}</div></div>`).join("");
  }

  document.querySelectorAll("#mode button").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      document.querySelectorAll("#mode button").forEach((b) => b.classList.toggle("on", b === button));
      $("bank-view").hidden = mode !== "bank";
      $("bert-view").hidden = mode !== "bert";
    });
  });
  $("bank-sentence").addEventListener("change", renderBank);
  $("sentiment-sentence").addEventListener("change", renderBert);
  renderBank();
  renderBert();
})();
