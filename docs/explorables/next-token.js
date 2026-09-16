"use strict";

(function () {
  const $ = (id) => document.getElementById(id);

  const cases = {
    ocean: {
      prompt: "The ocean is",
      transitions: {
        __start__: [["blue", .34], ["vast", .28], ["cold", .18], ["changing", .12], ["calm", .08]],
        blue: [["and", .48], ["today", .30], [".", .22]],
        vast: [["and", .44], [".", .36], ["but", .20]],
        cold: [["today", .40], ["and", .38], [".", .22]],
        changing: [["quickly", .58], [".", .42]],
        calm: [["today", .52], [".", .48]],
        and: [["full", .40], ["deep", .30], ["changing", .30]],
        but: [["beautiful", .45], ["rough", .35], ["calm", .20]],
        today: [[".", 1]], quickly: [[".", 1]], deep: [[".", 1]],
        beautiful: [[".", 1]], rough: [[".", 1]],
        full: [["of", 1]], of: [["life", .58], ["motion", .24], ["surprises", .18]],
        life: [[".", 1]], motion: [[".", 1]], surprises: [[".", 1]],
      },
    },
    coffee: {
      prompt: "I poured the coffee into the",
      transitions: {
        __start__: [["cup", .50], ["mug", .28], ["sink", .13], ["pot", .09]],
        cup: [["and", .38], ["before", .32], [".", .30]],
        mug: [["and", .40], ["before", .34], [".", .26]],
        sink: [["by", .58], [".", .42]],
        pot: [["and", .48], [".", .52]],
        before: [["leaving", .55], ["drinking", .45]],
        leaving: [[".", 1]], drinking: [[".", 1]],
        by: [["mistake", 1]], mistake: [[".", 1]],
        and: [["sat", .56], ["waited", .44]], sat: [["down", 1]], down: [[".", 1]], waited: [[".", 1]],
      },
    },
    network: {
      prompt: "The most connected node is called a",
      transitions: {
        __start__: [["hub", .55], ["vertex", .20], ["bridge", .15], ["center", .10]],
        hub: [["because", .38], ["when", .24], [".", .38]],
        vertex: [["because", .34], ["when", .24], [".", .42]],
        bridge: [["because", .36], ["when", .25], [".", .39]],
        center: [["because", .35], ["when", .25], [".", .40]],
        because: [["it", 1]], when: [["it", 1]],
        it: [["has", .56], ["connects", .44]], has: [["many", 1]],
        many: [["links", .54], ["neighbors", .46]], links: [[".", 1]], neighbors: [[".", 1]],
        connects: [["widely", .62], ["nodes", .38]], widely: [[".", 1]], nodes: [[".", 1]],
      },
    },
    blue: {
      prompt: "The clear daytime sky looks",
      transitions: {
        __start__: [["blue", .58], ["bright", .22], ["clear", .12], ["grey", .08]],
        blue: [["and", .40], ["today", .34], [".", .26]],
        bright: [["and", .40], ["today", .34], [".", .26]],
        clear: [["today", .42], [".", .58]],
        grey: [["today", .50], [".", .50]],
        and: [["calm", .52], ["cloudless", .48]],
        calm: [[".", 1]], cloudless: [[".", 1]], today: [[".", 1]],
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
