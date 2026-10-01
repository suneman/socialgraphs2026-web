"use strict";

(async function () {
  const data = await fetch("data/week6_fingerprints.json").then(r => r.json());
  const $ = id => document.getElementById(id);
  const pages = data.pages;
  let cur = Math.max(0, pages.findIndex(p => p.name === "Wolverine (character)"));
  let names = "on", word = null;

  const order = pages.map((p, i) => i).sort((a, b) => pages[a].name.localeCompare(pages[b].name));
  $("pick").innerHTML = order.map(i => `<option value="${i}">${esc(pages[i].name)}</option>`).join("");
  $("r-names").textContent = data.names_filtered.toLocaleString("en-US");

  function render() {
    const p = pages[cur];
    $("pick").value = cur;
    const list = names === "on" ? p.names_on : p.names_off;
    const top = list[0] ? list[0][1] : 1;
    $("title").textContent = `Most distinctive words on the ${p.name} page`;
    $("rows").innerHTML = `<div class="fp-row head"><span></span><span>word</span><span class="barcell">TF-IDF</span><span class="num">on page</span><span class="num">pages with it</span></div>` +
      list.map(([w, s, c, df, isName], k) => {
        const clickable = data.word_pages[w];
        const label = clickable ? `<button data-word="${esc(w)}" class="${w === word ? "on" : ""}">${esc(w)}</button>` : esc(w);
        return `<div class="fp-row ${isName ? "is-name" : ""}">
          <span class="rank">${k + 1}</span><span class="word">${label}</span>
          <span class="barcell"><span class="bar"><span style="width:${(100 * s / top).toFixed(1)}%"></span></span></span>
          <span class="num">${c}×</span><span class="num">${df} of ${data.N}</span></div>`;
      }).join("");
    document.querySelectorAll("#rows button[data-word]").forEach(b => b.addEventListener("click", () => { word = b.dataset.word; render(); }));
    $("r-len").textContent = `${p.tokens.toLocaleString("en-US")} tokens`;
    $("r-df").textContent = list[0] ? `${list[0][3]} of ${data.N} pages` : "–";
    renderAlso();
  }

  function renderAlso() {
    if (!word || !data.word_pages[word]) {
      $("also-title").textContent = "Who else uses it?";
      return;
    }
    const others = data.word_pages[word].filter(j => j !== cur);
    $("also-title").textContent = `Pages that also use “${word}”`;
    $("also").className = others.length ? "" : "also-empty";
    $("also").innerHTML = others.length
      ? `<div class="also-list">${others.map(j => `<button data-page="${j}">${esc(pages[j].name)}</button>`).join("")}</div>`
      : `No other page uses “${esc(word)}”, which is exactly why it scores so high here.`;
    document.querySelectorAll("#also button[data-page]").forEach(b => b.addEventListener("click", () => { cur = +b.dataset.page; render(); }));
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  $("pick").addEventListener("change", () => { cur = +$("pick").value; render(); });
  $("random").addEventListener("click", () => { cur = Math.floor(Math.random() * pages.length); render(); });
  document.querySelectorAll("#names-seg button").forEach(b => b.addEventListener("click", () => {
    names = b.dataset.names;
    document.querySelectorAll("#names-seg button").forEach(x => x.classList.toggle("on", x === b));
    render();
  }));
  render();
})();
