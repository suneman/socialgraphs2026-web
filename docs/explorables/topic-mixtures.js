"use strict";
(function () {
  const $ = (id) => document.getElementById(id);
  const topics = [
    { name: "Crime", cls: "topic-1", words: [["crime",.16],["gang",.14],["police",.12],["lawyer",.10],["street",.09]] },
    { name: "Mutants", cls: "topic-2", words: [["mutant",.16],["school",.14],["gene",.12],["telepath",.09],["sentinel",.08]] },
    { name: "Space", cls: "topic-3", words: [["planet",.15],["empire",.14],["galaxy",.11],["alien",.10],["ship",.09]] }
  ];
  const docs = [
    { name:"Hell's Kitchen", text:"A blind lawyer fought the gangs that ran crime in Hell's Kitchen.", mix:[.78,.08,.14] },
    { name:"Mutant school", text:"Young mutants trained at the school while Sentinels hunted their kind.", mix:[.05,.88,.07] },
    { name:"Stranded soldier", text:"A soldier from an alien empire crash-landed on Earth and hid from the police in New York.", mix:[.26,.05,.69] },
    { name:"Mutant vigilante", text:"A mutant vigilante patrolled the streets, hunting the gang that killed his family.", mix:[.38,.57,.05] }
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
