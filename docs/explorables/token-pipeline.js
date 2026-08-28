"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const initial = "Apple's runners weren't running quickly in New York. Apple runners run, too.";

  // A compact teaching approximation of spaCy's English token attributes.
  // The split rules below are chosen to match the examples on the course page.
  const stopwords = new Set([
    "a", "an", "the", "in", "on", "of", "to", "and", "or", "is", "are",
    "was", "were", "be", "been", "being", "too", "'s", "n't", "'re", "'ve",
    "'m", "'ll", "'d"
  ]);

  function surfacePieces(text) {
    // Keep alphabetic contractions together for the clitic pass below, while
    // emitting punctuation as its own token from the start.
    return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?|[^\s\p{L}\p{N}]/gu) || [];
  }

  function preserveCase(piece, replacementLower) {
    if (piece === piece.toUpperCase() && /[A-Z]/.test(piece)) return replacementLower.toUpperCase();
    if (/^[A-Z]/.test(piece)) return replacementLower.charAt(0).toUpperCase() + replacementLower.slice(1);
    return replacementLower;
  }

  function splitClitic(piece) {
    const normalized = piece.replace(/’/g, "'");
    const lower = normalized.toLowerCase();

    // spaCy's familiar English exception splits.
    if (lower === "won't") return [preserveCase(normalized, "wo"), "n't"];
    if (lower === "can't") return [preserveCase(normalized, "ca"), "n't"];
    if (lower === "shan't") return [preserveCase(normalized, "sha"), "n't"];
    if (lower.endsWith("n't") && normalized.length > 3) {
      return [normalized.slice(0, -3), "n't"];
    }

    for (const suffix of ["'s", "'re", "'ve", "'m", "'ll", "'d"]) {
      if (lower.endsWith(suffix) && normalized.length > suffix.length) {
        return [normalized.slice(0, -suffix.length), normalized.slice(-suffix.length)];
      }
    }
    return [normalized];
  }

  function isPunct(text) {
    return /^[^\p{L}\p{N}]+$/u.test(text);
  }

  function lemma(text) {
    const l = text.toLowerCase();
    const known = {
      "runners": "runner",
      "runner": "runner",
      "running": "run",
      "ran": "run",
      "runs": "run",
      "were": "be",
      "was": "be",
      "is": "be",
      "are": "be",
      "'s": "be",
      "n't": "not",
      "apples": "apple",
      "apple": "apple"
    };
    if (Object.prototype.hasOwnProperty.call(known, l)) return known[l];
    if (l.endsWith("ies") && l.length > 4) return `${l.slice(0, -3)}y`;
    if (l.endsWith("s") && l.length > 3 && !l.endsWith("ss")) return l.slice(0, -1);
    return l;
  }

  function tokenize(text) {
    const pieces = surfacePieces(text).flatMap(splitClitic);
    let sentence = 1;
    return pieces.map((surface) => {
      const token = {
        text: surface,
        is_punct: isPunct(surface),
        is_stop: stopwords.has(surface.toLowerCase()),
        lemma_: lemma(surface),
        sentence
      };
      if ([".", "!", "?"].includes(surface)) sentence += 1;
      return token;
    });
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[ch]));
  }

  function tokenChip(token, shownText, vocabulary) {
    const classes = ["token"];
    if (vocabulary) classes.push("series2");
    if (!vocabulary && token.is_punct) classes.push("punct-token-chip");
    if (!vocabulary && token.is_stop) classes.push("stop-token-chip");
    const title = vocabulary
      ? `type: ${shownText}`
      : `text: ${token.text}\nis_stop: ${token.is_stop}\nis_punct: ${token.is_punct}\nlemma_: ${token.lemma_}\nsentence: ${token.sentence}`;
    return `<span class="${classes.join(" ")}" title="${escapeHtml(title)}">${escapeHtml(shownText)}</span>`;
  }

  function process() {
    const base = tokenize($("text").value);
    const filtered = base.filter((token) => {
      if ($("punct").checked && token.is_punct) return false;
      if ($("stop").checked && token.is_stop) return false;
      return true;
    });

    const shown = filtered.map((token) => $("lower").checked ? token.text.toLocaleLowerCase() : token.text);
    const types = Array.from(new Set(shown)).sort((a, b) => a.localeCompare(b));

    $("tokens").innerHTML = filtered
      .map((token, index) => tokenChip(token, shown[index], false))
      .join("");
    $("types").innerHTML = types
      .map((type) => tokenChip({ text: type, is_punct: false, is_stop: false, lemma_: type, sentence: 0 }, type, true))
      .join("");

    $("r-tokens").textContent = shown.length;
    $("r-types").textContent = types.length;
    $("r-ttr").textContent = shown.length ? (types.length / shown.length).toFixed(2) : "-";

    const sentenceNumbers = base.filter((t) => !t.is_punct || ![".", "!", "?"].includes(t.text)).map((t) => t.sentence);
    $("r-sentences").textContent = sentenceNumbers.length ? Math.max(...sentenceNumbers) : 0;
  }

  ["text", "lower", "punct", "stop"].forEach((id) => $(id).addEventListener("input", process));
  $("reset").addEventListener("click", () => {
    $("text").value = initial;
    $("lower").checked = false;
    $("punct").checked = false;
    $("stop").checked = false;
    process();
  });

  process();
})();
