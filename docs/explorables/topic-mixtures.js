"use strict";
(function () {
  const $ = (id) => document.getElementById(id);
  const topics = [
    { name: "Politics", cls: "topic-1", words: [["election",.16],["government",.14],["vote",.12],["minister",.10],["parliament",.09]] },
    { name: "Music", cls: "topic-2", words: [["album",.16],["band",.14],["song",.12],["guitar",.09],["concert",.08]] },
    { name: "Sport", cls: "topic-3", words: [["match",.15],["team",.14],["league",.11],["season",.10],["goal",.09]] }
  ];
  const docs = [
    { name:"Election night", text:"The party won seats after a close election and formed a new government.", mix:[.78,.08,.14] },
    { name:"Festival review", text:"The band closed the festival with songs from its new album.", mix:[.05,.88,.07] },
    { name:"Club finances", text:"The club board discussed the season budget and a public funding vote.", mix:[.26,.05,.69] },
    { name:"Benefit concert", text:"Musicians played a charity concert supporting a local election campaign.", mix:[.38,.57,.05] }
  ];
  function init() {
    $("doc").innerHTML = docs.map((d,i)=>`<option value="${i}">${d.name}</option>`).join("");
    $("topic").innerHTML = topics.map((t,i)=>`<option value="${i}">${t.name}</option>`).join("");
    $("doc").addEventListener("change", renderDoc);
    $("topic").addEventListener("change", renderTopic);
    renderDoc(); renderTopic();
  }
  function renderDoc() {
    const d = docs[+$("doc").value];
    $("doc-text").textContent = d.text;
    $("stack").innerHTML = d.mix.map((p,i)=>`<span class="${topics[i].cls}" style="width:${p*100}%">${p >= .12 ? topics[i].name : ""}</span>`).join("");
    $("mix-metrics").innerHTML = d.mix.map((p,i)=>`<div class="metric"><div class="k">${topics[i].name}</div><div class="v">${Math.round(p*100)}%</div></div>`).join("");
  }
  function renderTopic() {
    const t = topics[+$("topic").value];
    const max = Math.max(...t.words.map((x)=>x[1]));
    $("topic-words").innerHTML = t.words.map(([w,p])=>`<div class="topic-word"><span>${w}</span><div class="track"><span style="width:${100*p/max}%"></span></div><span>${p.toFixed(2)}</span></div>`).join("");
  }
  init();
})();
