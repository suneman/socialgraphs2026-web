"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const examples = [
    "This album is wonderful",
    "This album is not good",
    "I just love being stuck in traffic",
    "The concert was terrible"
  ];
  const lexicon = {
    wonderful: 2.2,
    good: 1.4,
    great: 1.8,
    excellent: 2.3,
    love: 2.0,
    beautiful: 1.7,
    bad: -1.5,
    terrible: -2.4,
    awful: -2.2,
    boring: -1.2,
    stuck: -1.1,
    traffic: -0.4,
    hate: -2.0
  };

  function tokenize(text) {
    return (text.toLowerCase().match(/[a-z']+/g) || []);
  }

  function render() {
    const words = tokenize($("text").value);
    const useNegation = $("negation").checked;
    let negateNext = false;
    const matched = [];

    words.forEach((word) => {
      if (word === "not" && useNegation) {
        negateNext = true;
        return;
      }
      if (Object.prototype.hasOwnProperty.call(lexicon, word)) {
        const base = lexicon[word];
        const value = negateNext ? -base : base;
        matched.push({ word, base, value, flipped: negateNext });
        negateNext = false;
      } else if (negateNext && /[.!?]/.test(word)) {
        negateNext = false;
      }
    });

    $("tokens").innerHTML = words.map((w) => {
      const hit = Object.prototype.hasOwnProperty.call(lexicon, w);
      return `<span class="token-chip ${hit ? "target" : ""}">${w}</span>`;
    }).join("");

    const total = matched.reduce((s, d) => s + d.value, 0);
    $("scores").innerHTML = matched.length ? matched.map((d) => {
      const pct = Math.min(50, Math.abs(d.value) / 2.5 * 50);
      const bar = d.value >= 0
        ? `<span class="pos" style="width:${pct}%"></span>`
        : `<span class="neg" style="width:${pct}%"></span>`;
      return `<div class="score-row"><span class="word">${d.word}${d.flipped ? " (flipped)" : ""}</span><span class="track">${bar}</span><span class="number">${d.value > 0 ? "+" : ""}${d.value.toFixed(1)}</span></div>`;
    }).join("") : `<p class="note">No lexicon words matched.</p>`;

    const clipped = Math.max(-5, Math.min(5, total));
    const meter = $("meter");
    meter.classList.toggle("neg", clipped < 0);
    meter.style.left = clipped >= 0 ? "50%" : `${50 + clipped * 10}%`;
    meter.style.width = `${Math.abs(clipped) * 10}%`;

    $("score").textContent = total.toFixed(2);
    $("matched").textContent = String(matched.length);
    $("label").textContent = total > 0.25 ? "positive" : total < -0.25 ? "negative" : "neutral";
  }

  $("example").addEventListener("change", () => {
    $("text").value = examples[+$('example').value];
    render();
  });
  $("text").addEventListener("input", render);
  $("negation").addEventListener("change", render);
  $("text").value = examples[0];
  render();
})();
