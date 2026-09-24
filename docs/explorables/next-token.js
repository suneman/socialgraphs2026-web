"use strict";

(function () {
  const $ = (id) => document.getElementById(id);

  const cases = {
    thor: {
      prompt: "Thor raised his hammer and",
      transitions: {
        __start__: [["summoned", .38], ["accidentally", .26], ["called", .22], ["dropped", .14]],
        summoned: [["lightning", .62], ["Loki", .38]],
        lightning: [[".", .55], ["again", .45]], again: [[".", 1]],
        Loki: [["instead", .70], [".", .30]], instead: [[".", 1]],
        accidentally: [["hit", 1]], hit: [["Loki", .50], ["himself", .50]], himself: [[".", 1]],
        called: [["for", .60], ["his", .40]], for: [["backup", 1]], backup: [[".", 1]],
        his: [["mother", .60], ["brother", .40]], mother: [[".", 1]], brother: [[".", 1]],
        dropped: [["it", 1]], it: [["on", .50], [".", .50]],
        on: [["Hulk", .60], ["Loki", .40]], Hulk: [[".", 1]],
      },
    },
    hulk: {
      prompt: "For breakfast, the Hulk eats",
      transitions: {
        __start__: [["tacos", .30], ["pancakes", .24], ["anything", .22], ["smashed", .14], ["salad", .10]],
        tacos: [[".", .45], ["on", .55]], on: [["Tuesdays", 1]], Tuesdays: [[".", 1]],
        pancakes: [["with", .60], [".", .40]],
        with: [["syrup", .55], ["gamma", .45]], syrup: [[".", 1]],
        gamma: [["rays", 1]], rays: [[".", 1]],
        anything: [["green", .50], ["smashed", .50]], green: [[".", 1]],
        smashed: [["avocado", .60], ["pancakes", .40]], avocado: [[".", 1]],
        salad: [[",", .60], [".", .40]], ",": [["allegedly", 1]], allegedly: [[".", 1]],
      },
    },
    tony: {
      prompt: "Tony Stark walked into the lab and",
      transitions: {
        __start__: [["built", .40], ["ordered", .25], ["blew", .20], ["ignored", .15]],
        built: [["a", 1]], ordered: [["a", .50], ["shawarma", .50]], shawarma: [[".", 1]],
        a: [["suit", .45], ["robot", .30], ["sandwich", .25]],
        suit: [[".", .60], ["again", .40]], again: [[".", 1]],
        robot: [[".", .50], ["butler", .50]], butler: [[".", 1]], sandwich: [[".", 1]],
        blew: [["it", 1]], it: [["up", 1]], up: [["again", .60], [".", .40]],
        ignored: [["Pepper", .60], ["everyone", .40]], Pepper: [[".", 1]], everyone: [[".", 1]],
      },
    },
    hub: {
      prompt: "The biggest hub in the Marvel network is",
      transitions: {
        __start__: [["Spider-Man", .52], ["Captain", .22], ["Wolverine", .14], ["Howard", .12]],
        "Spider-Man": [[".", .55], [",", .45]],
        ",": [["obviously", .55], ["with", .45]], obviously: [[".", 1]],
        with: [["106", 1]], "106": [["links", 1]], links: [[".", 1]],
        Captain: [["America", .70], ["Marvel", .30]],
        America: [[".", 1]], Marvel: [[".", 1]],
        Wolverine: [[".", .55], ["on", .45]], on: [["a", 1]], a: [["good", 1]], good: [["day", 1]], day: [[".", 1]],
        Howard: [["the", 1]], the: [["Duck", 1]], Duck: [[".", .50], ["in", .50]],
        in: [["his", 1]], his: [["dreams", 1]], dreams: [[".", 1]],
      },
    },
  };

  let generated = [];
  let lastSample = null;
  let running = false;

  function tokenize(s) {
    return s.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
  }

  function data() {
    return cases[$("prompt").value];
  }

  function stateKey() {
    return generated.length ? generated[generated.length - 1] : "__start__";
  }

  function distribution() {
    if (isComplete()) return [];
    return data().transitions[stateKey()] || [[".", 1]];
  }

  function isComplete() {
    return generated.length > 0 && generated[generated.length - 1] === ".";
  }

  function fullTokens() {
    return tokenize(data().prompt).concat(generated);
  }

  function detokenize(tokens) {
    let out = "";
    for (const t of tokens) {
      if (/^[.,!?;:]$/.test(t)) out += t;
      else out += (out ? " " : "") + t;
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  }

  function render() {
    const promptTokens = tokenize(data().prompt);
    const promptHtml = promptTokens.map((t) => `<span class="token">${escapeHtml(t)}</span>`).join("");
    const generatedHtml = generated.map((t) => `<span class="token series1">${escapeHtml(t)}</span>`).join("");
    $("context").innerHTML = promptHtml + generatedHtml;
    $("continuation").textContent = detokenize(fullTokens());

    const probs = distribution();
    if (probs.length) {
      $("bars").innerHTML = probs.map(([word, p]) => `
        <div class="bar-row">
          <span class="word">${escapeHtml(word)}</span>
          <span class="bar"><span style="width:${Math.round(p * 100)}%"></span></span>
          <span class="num">${Math.round(p * 100)}%</span>
        </div>`).join("");
      $("r-top").textContent = probs[0][0];
    } else {
      $("bars").innerHTML = '<p class="note">Sentence complete. Reset the prompt to run the loop again.</p>';
      $("r-top").textContent = "complete";
    }

    $("r-tokens").textContent = fullTokens().length;
    $("r-generated").textContent = generated.length;
    $("r-last").textContent = lastSample || "–";
    $("next").disabled = running || isComplete();
    $("sentence").disabled = running || isComplete();
    $("prompt").disabled = running;
    $("reset").disabled = running;
  }

  function choose(probs) {
    let r = Math.random();
    let acc = 0;
    for (const [word, p] of probs) {
      acc += p;
      if (r <= acc) return word;
    }
    return probs[probs.length - 1][0];
  }

  function sampleOne() {
    if (isComplete()) return false;
    const probs = distribution();
    if (!probs.length) return false;
    const chosen = choose(probs);
    generated.push(chosen);
    lastSample = chosen;
    render();
    return !isComplete();
  }

  function reset() {
    generated = [];
    lastSample = null;
    running = false;
    render();
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function generateSentence() {
    if (running || isComplete()) return;
    running = true;
    render();
    let steps = 0;
    while (!isComplete() && steps < 14) {
      const probs = distribution();
      if (!probs.length) break;
      const chosen = choose(probs);
      generated.push(chosen);
      lastSample = chosen;
      steps += 1;
      render();
      await delay(520);
    }
    if (!isComplete() && generated.length) generated.push(".");
    running = false;
    render();
  }

  $("prompt").addEventListener("change", reset);
  $("next").addEventListener("click", sampleOne);
  $("sentence").addEventListener("click", generateSentence);
  $("reset").addEventListener("click", reset);
  reset();
})();
