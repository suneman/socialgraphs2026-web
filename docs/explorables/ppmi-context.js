"use strict";
(function () {
  const $ = (id) => document.getElementById(id);
  const words = ["dog","puppy","cat","bank","finance","democracy","election"];
  const contexts = ["the","bark","leash","pet","vote","money","river"];
  const counts = [
    [30,12,9,10,0,0,0],
    [25,8,10,12,0,0,0],
    [28,0,1,13,0,0,0],
    [30,0,0,0,2,15,13],
    [22,0,0,0,3,14,0],
    [24,0,0,0,16,2,0],
    [20,0,0,0,15,1,0]
  ];
  let mode = "count";
  const total = counts.flat().reduce((a,b)=>a+b,0);
  const rowTotals = counts.map((r)=>r.reduce((a,b)=>a+b,0));
  const colTotals = contexts.map((_,j)=>counts.reduce((s,r)=>s+r[j],0));
  const ppmi = counts.map((row,i)=>row.map((n,j)=>{
    if (!n) return 0;
    const pxy = n / total;
    const px = rowTotals[i] / total;
    const py = colTotals[j] / total;
    return Math.max(0, Math.log2(pxy/(px*py)));
  }));
  function data(){ return mode === "count" ? counts : ppmi; }
  function dot(a,b){ return a.reduce((s,x,i)=>s+x*b[i],0); }
  function cosine(a,b){ const den=Math.sqrt(dot(a,a))*Math.sqrt(dot(b,b)); return den ? dot(a,b)/den : 0; }
  function fmt(v){ return mode === "count" ? String(v) : v.toFixed(2); }
  function init(){
    $("word").innerHTML = words.map((w,i)=>`<option value="${i}">${w}</option>`).join("");
    $("word").addEventListener("change", render);
    document.querySelectorAll("#mode-seg button").forEach((b)=>b.addEventListener("click",()=>{
      mode=b.dataset.mode;
      document.querySelectorAll("#mode-seg button").forEach((x)=>x.classList.toggle("on",x===b));
      render();
    }));
    render();
  }
  function render(){
    const selected=+$("word").value;
    const m=data();
    const max=Math.max(...m.flat(),1e-9);
    const head=`<tr><th>word</th>${contexts.map((c)=>`<th>${c}</th>`).join("")}</tr>`;
    const body=words.map((w,i)=>`<tr class="${i===selected?"active":""}"><td>${w}</td>${m[i].map((v)=>`<td><span class="cell-bg" style="opacity:${Math.min(.95,v/max).toFixed(2)}"></span><span class="cell-value">${fmt(v)}</span></td>`).join("")}</tr>`).join("");
    $("matrix").innerHTML=`<table class="matrix matrix-heat">${head}${body}</table>`;
    $("matrix-note").textContent=mode==="count"?"The context 'the' is frequent for almost every word, so raw counts make it look informative.":"PPMI rewards co-occurrence above independence. Negative PMI values are clipped to zero.";
    $("formula").textContent=mode==="count"?"count(w,c) = number of times context c appears near target w":"PPMI(w,c) = max(0, log2(P(w,c) / (P(w)P(c))))";
    const row=m[selected];
    $("vector").textContent=`${words[selected]} = [${row.map(fmt).join(", ")}]`;
    const ranked=contexts.map((c,j)=>[c,row[j]]).sort((a,b)=>b[1]-a[1]);
    const rmax=Math.max(...ranked.map((x)=>x[1]),1e-9);
    $("bars").innerHTML=ranked.slice(0,5).map(([c,v])=>`<div class="bar-row"><span class="word">${c}</span><div class="bar"><span style="width:${100*v/rmax}%"></span></div><span class="num">${fmt(v)}</span></div>`).join("");
    const sims=words.map((w,i)=>[w,i===selected?-1:cosine(row,m[i])]).sort((a,b)=>b[1]-a[1]);
    $("nearest").textContent=sims[0][0];
    $("near-cos").textContent=sims[0][1].toFixed(3);
  }
  init();
})();
