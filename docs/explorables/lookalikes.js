"use strict";

// Marvel lookalikes: Bag-of-Words cosine between the 303 full Marvel pages, raw or without stopwords,
// checked against the week 1 link network. All numbers are precomputed by
// tools/groundtruth/week5_lookalikes.py into lookalikes.json; nothing is fitted in the browser.
(function () {
  const $ = (id) => document.getElementById(id);
  let D = null;
  let view = "one", mode = "raw", who = 0;

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const linkCell = (l) => l ? '<span class="link yes">linked</span>' : '<span class="link no">not linked</span>';
  const nameBtn = (i) => `<button data-i="${i}" title="${esc(D.names[i])}">${esc(D.names[i])}</button>`;

  function row(rank, i, sim, linked, why, minSim) {
    const w = Math.max(0, (sim - minSim) / (1 - minSim)) * 100;
    return `<div class="nb-row"><span class="rank">${rank}</span><span class="who">${nameBtn(i)}</span>
      <span class="barcell"><span class="bar"><span style="width:${w}%"></span></span></span>
      <span class="num">${sim.toFixed(2)}</span>${linkCell(linked)}<span class="why">${why ? esc(why.join(", ")) : ""}</span></div>`;
  }

  function draw() {
    if (!D) return;
    const M = D.modes[mode];
    let html, hits;
    if (view === "one") {
      const nb = M.neighbors[who];
      $("list-title").textContent = `Ten pages most similar to ${D.names[who]}`;
      html = `<div class="nb-row head"><span></span><span>page</span><span class="barcell"></span><span class="num">cosine</span><span>network</span><span class="why">words behind it</span></div>`
        + nb.map(([i, s, l, why], k) => row(k + 1, i, s, l, why, 0)).join("");
      hits = nb.reduce((a, r) => a + r[2], 0);
      $("r-hits").textContent = `${hits} of 10`;
    } else {
      $("list-title").textContent = "Most similar pairs with no link between them";
      html = `<div class="nb-row head"><span></span><span>page</span><span class="barcell"></span><span class="num">cosine</span><span>network</span><span class="why"></span></div>`
        + M.unlinked.slice(0, 10).map(([a, b, s], k) =>
          `<div class="nb-row pair"><span class="rank">${k + 1}</span><span class="who">${nameBtn(a)} ↔ ${nameBtn(b)}</span>
            <span class="barcell"><span class="bar"><span style="width:${s * 100}%"></span></span></span>
            <span class="num">${s.toFixed(2)}</span>${linkCell(0)}<span class="why"></span></div>`).join("");
      $("r-hits").textContent = "0 of 10";
    }
    $("list").innerHTML = html;
    $("r-hits-label").textContent = view === "one" ? "Linked among these 10" : "Linked among these 10";
    $("r-mean-hits").textContent = `${M.mean_hits.toFixed(1)} of 10`;
    $("r-random").textContent = `${(10 * D.density).toFixed(1)} of 10`;
    $("r-mean-sim").textContent = M.mean_sim.toFixed(2);
    $("note-one").hidden = view !== "one";
    $("note-unlinked").hidden = view === "one";
    $("pick-label").style.display = $("random").style.display = view === "one" ? "" : "none";
    $("list").querySelectorAll("button[data-i]").forEach((b) => b.addEventListener("click", () => {
      who = +b.dataset.i; view = "one"; $("pick").value = who; syncSeg("view-seg", "view", view); draw();
    }));
  }

  function syncSeg(id, key, value) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle("on", b.dataset[key] === value));
  }
  function wireSeg(id, key, set) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.addEventListener("click", () => {
      set(b.dataset[key]); syncSeg(id, key, b.dataset[key]); draw();
    }));
  }
  wireSeg("view-seg", "view", (v) => { view = v; });
  wireSeg("mode-seg", "mode", (v) => { mode = v; });
  $("pick").addEventListener("change", (e) => { who = +e.target.value; draw(); });
  $("random").addEventListener("click", () => { who = Math.floor(Math.random() * D.names.length); $("pick").value = who; draw(); });

  fetch("lookalikes.json").then((r) => r.json()).then((j) => {
    D = j;
    const order = D.names.map((n, i) => [n, i]).sort((a, b) => a[0].localeCompare(b[0]));
    $("pick").innerHTML = order.map(([n, i]) => `<option value="${i}">${esc(n)}</option>`).join("");
    who = Math.max(0, D.ids.indexOf("Wolverine_(character)"));
    $("pick").value = who;
    draw();
  }).catch((e) => { $("list").innerHTML = `<p class="note">Could not load the Marvel data: ${String(e)}</p>`; });
})();
