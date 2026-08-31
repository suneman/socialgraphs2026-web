"use strict";
(async function(){
  const data=await fetch("data/week7_search_index.json").then(r=>r.json());
  const $=id=>document.getElementById(id);
  const vocab=new Map(data.vocab.map((t,i)=>[t,i]));
  function queryVector(q){
    const tokens=(q.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(t=>vocab.has(t));
    const counts=new Map(); tokens.forEach(t=>counts.set(t,(counts.get(t)||0)+1));
    const v=new Map(); let norm=0;
    counts.forEach((n,t)=>{const j=vocab.get(t), tf=1+Math.log(n), x=tf*data.idf[j]; v.set(j,x); norm+=x*x;});
    norm=Math.sqrt(norm)||1; v.forEach((x,j)=>v.set(j,x/norm));
    return v;
  }
  function sparseScore(qv,doc){
    let s=0; for(const [j,v] of doc){ if(qv.has(j)) s+=v*qv.get(j); } return s;
  }
  function denseQuery(qv){
    const out=data.components.map(row=>{let s=0; qv.forEach((v,j)=>{s+=v*row[j];}); return s;});
    const n=Math.sqrt(out.reduce((a,x)=>a+x*x,0))||1; return out.map(x=>x/n);
  }
  function dot(a,b){let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s;}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function renderList(el,scores){
    const idx=scores.map((s,i)=>[i,s]).sort((a,b)=>b[1]-a[1]).slice(0,6);
    el.innerHTML=idx.map(([i,s],rank)=>{const d=data.docs[i]; return `<div class="search-result"><div class="row"><div class="name">${rank+1}. ${escapeHtml(d.name)}</div><div class="score">${s.toFixed(3)}</div></div><div class="desc">${escapeHtml(d.description)}</div></div>`;}).join("");
  }
  function run(){
    const qv=queryVector($("query").value.trim());
    if(!qv.size){ $("sparse-results").innerHTML=$("dense-results").innerHTML='<div class="note">No query words occur in the local description vocabulary. Try one of the presets.</div>'; return; }
    const ss=data.sparseDocs.map(d=>sparseScore(qv,d));
    const qd=denseQuery(qv); const ds=data.denseDocs.map(d=>dot(qd,d));
    renderList($("sparse-results"),ss); renderList($("dense-results"),ds);
  }
  $("run").addEventListener("click",run); $("query").addEventListener("keydown",e=>{if(e.key==="Enter")run();});
  document.querySelectorAll("#presets button").forEach(b=>b.addEventListener("click",()=>{$("query").value=b.dataset.q;run();}));
  run();
})();
