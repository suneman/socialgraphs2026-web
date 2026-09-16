"use strict";
(async function(){
const svg = document.getElementById("scatter-chart");
const search = document.getElementById("term-search");
const datalist = document.getElementById("term-list");
const W=900,H=560, M={l:76,r:38,t:42,b:64};
const STOP = new Set(("a an and are as at be been being but by for from had has have he her hers him his i if in into is it its me my of on or our ours she so than that the their them they this to was we were what when which who will with would you your not no do does did can could should may might more most very just about after before over under again once here there then such through while where why how all any both each few other some same own too s t don now up down out off above below between because until during against further am themselves himself herself itself yourself yourselves ourselves myself ourselves ours yours theirs").split(/\s+/));
const tokenize = s => (s.toLowerCase().match(/[a-z][a-z'-]*/g)||[]).map(x=>x.replace(/^'+|'+$/g,""));

function countGroup(speeches){
  const counts=new Map(); let total=0;
  speeches.forEach(text=>tokenize(text).forEach(t=>{ total++; if(t.length>2 && !STOP.has(t)) counts.set(t,(counts.get(t)||0)+1); }));
  return {counts,total};
}
function snippet(speeches,term){
  const re=new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');
  for(const speech of speeches){
    const m=re.exec(speech); if(!m) continue;
    const start=Math.max(0,m.index-75), end=Math.min(speech.length,m.index+term.length+95);
    return (start>0?'…':'')+speech.slice(start,end).replace(/\s+/g,' ').trim()+(end<speech.length?'…':'');
  }
  return "No short example found.";
}
function esc(s){ return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function highlight(text,term){ return esc(text).replace(new RegExp(`\\b(${term})\\b`,'ig'),'<b>$1</b>'); }

let raw;
try{
  const r=await fetch("data/week6_convention_speeches.json");
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  raw=await r.json();
}catch(err){
  svg.outerHTML=`<div class="scatter-error">Could not load the convention corpus. Run the course through <code>./dev.sh</code> rather than opening this file directly.</div>`;
  return;
}
const byName=Object.fromEntries(raw.map(g=>[g.name.toLowerCase(),g.speeches]));
const demSpeeches=byName.democrat||[], repSpeeches=byName.republican||[];
const dem=countGroup(demSpeeches), rep=countGroup(repSpeeches);
const vocab=new Set([...dem.counts.keys(),...rep.counts.keys()]);
const terms=[];
for(const term of vocab){
  const dc=dem.counts.get(term)||0, rc=rep.counts.get(term)||0, total=dc+rc;
  if(total<14) continue;
  const dr=dc/dem.total*10000, rr=rc/rep.total*10000;
  const assoc=Math.log((dr+.18)/(rr+.18));
  terms.push({term,dc,rc,dr,rr,assoc,total});
}
terms.sort((a,b)=>b.total-a.total);
const maxRate=Math.max(...terms.flatMap(d=>[d.dr,d.rr]));
const minLog=Math.log10(.12), maxLog=Math.log10(maxRate*1.12+.12);
const x=r=>M.l+(Math.log10(r+.12)-minLog)/(maxLog-minLog)*(W-M.l-M.r);
const y=r=>H-M.b-(Math.log10(r+.12)-minLog)/(maxLog-minLog)*(H-M.t-M.b);
const rateFromT=t=>Math.pow(10,minLog+t*(maxLog-minLog))-.12;

const lines=[];
for(let i=0;i<=5;i++){
  const t=i/5, xx=M.l+t*(W-M.l-M.r), yy=H-M.b-t*(H-M.t-M.b), val=rateFromT(t);
  lines.push(`<line x1="${xx}" y1="${M.t}" x2="${xx}" y2="${H-M.b}" class="scatter-grid"></line>`);
  lines.push(`<line x1="${M.l}" y1="${yy}" x2="${W-M.r}" y2="${yy}" class="scatter-grid"></line>`);
  lines.push(`<text x="${xx}" y="${H-M.b+20}" text-anchor="middle" class="scatter-tick-label">${val<1?val.toFixed(1):Math.round(val)}</text>`);
  lines.push(`<text x="${M.l-10}" y="${yy+3}" text-anchor="end" class="scatter-tick-label">${val<1?val.toFixed(1):Math.round(val)}</text>`);
}
lines.push(`<line x1="${M.l}" y1="${H-M.b}" x2="${W-M.r}" y2="${H-M.b}" class="scatter-axis"></line>`);
lines.push(`<line x1="${M.l}" y1="${H-M.b}" x2="${M.l}" y2="${M.t}" class="scatter-axis"></line>`);
lines.push(`<line x1="${M.l}" y1="${H-M.b}" x2="${W-M.r}" y2="${M.t}" class="scatter-diagonal"></line>`);
lines.push(`<text x="${(M.l+W-M.r)/2}" y="${H-13}" text-anchor="middle" class="scatter-axis-label">Republican uses per 10,000 words</text>`);
lines.push(`<text transform="translate(18 ${(M.t+H-M.b)/2}) rotate(-90)" text-anchor="middle" class="scatter-axis-label">Democratic uses per 10,000 words</text>`);
lines.push(`<text x="${M.l+18}" y="${M.t+18}" class="scatter-zone-label">more Democratic</text>`);
lines.push(`<text x="${W-M.r-18}" y="${H-M.b-14}" text-anchor="end" class="scatter-zone-label">more Republican</text>`);

function cls(d){ return d.assoc>.30?'dem':d.assoc<-.30?'rep':'shared'; }
const points=terms.map((d,i)=>`<circle class="term-point ${cls(d)}" data-i="${i}" cx="${x(d.rr)}" cy="${y(d.dr)}" r="${Math.min(5.2,2.2+Math.log10(d.total+1))}"><title>${d.term}: D ${d.dr.toFixed(1)}, R ${d.rr.toFixed(1)}</title></circle>`).join("");
const topDem=[...terms].filter(d=>d.total>=20).sort((a,b)=>b.assoc-a.assoc).slice(0,7);
const topRep=[...terms].filter(d=>d.total>=20).sort((a,b)=>a.assoc-b.assoc).slice(0,7);
const shared=[...terms].filter(d=>Math.abs(d.assoc)<.10).sort((a,b)=>b.total-a.total).slice(0,4);
const labelSet=new Map([...topDem,...topRep,...shared].map(d=>[d.term,d]));

function placeLabelGroup(items){
  const minY=M.t+12, maxY=H-M.b-10, gap=16;
  const placed=items
    .map(d=>({d,py:y(d.dr),ly:y(d.dr)-5}))
    .sort((a,b)=>a.ly-b.ly);
  for(let i=0;i<placed.length;i++){
    if(i===0) placed[i].ly=Math.max(minY,placed[i].ly);
    else placed[i].ly=Math.max(placed[i].ly,placed[i-1].ly+gap);
  }
  if(placed.length && placed[placed.length-1].ly>maxY){
    placed[placed.length-1].ly=maxY;
    for(let i=placed.length-2;i>=0;i--) placed[i].ly=Math.min(placed[i].ly,placed[i+1].ly-gap);
    if(placed[0].ly<minY){
      const shift=minY-placed[0].ly;
      placed.forEach(p=>p.ly+=shift);
    }
  }
  return placed;
}
const labelItems=[...labelSet.values()];
const leftLabels=placeLabelGroup(labelItems.filter(d=>d.assoc<0));
const rightLabels=placeLabelGroup(labelItems.filter(d=>d.assoc>=0));
const labels=[...leftLabels,...rightLabels].map(({d,ly})=>{
  const dx=d.assoc>=0?7:-7, anchor=d.assoc>=0?'start':'end';
  return `<text x="${x(d.rr)+dx}" y="${ly}" text-anchor="${anchor}" class="term-label ${cls(d)}">${d.term}</text>`;
}).join("");
svg.innerHTML=lines.join("")+points+labels;

datalist.innerHTML=terms.slice().sort((a,b)=>a.term.localeCompare(b.term)).map(d=>`<option value="${d.term}"></option>`).join("");
let selected=null;
function selectTerm(d){
  selected=d;
  svg.querySelectorAll('.term-point').forEach(p=>p.classList.toggle('selected',terms[+p.dataset.i]===d));
  document.getElementById('detail-word').textContent=d.term;
  const direction=Math.abs(d.assoc)<.15?'used at similar rates':d.assoc>0?'relatively more Democratic':'relatively more Republican';
  document.getElementById('detail-association').textContent=direction;
  document.getElementById('detail-dem').textContent=d.dr.toFixed(1);
  document.getElementById('detail-rep').textContent=d.rr.toFixed(1);
  const ds=snippet(demSpeeches,d.term), rs=snippet(repSpeeches,d.term);
  document.getElementById('detail-snippets').innerHTML=`<div class="snippet-line"><b>Dem:</b> ${highlight(ds,d.term)}</div><div class="snippet-line"><b>Rep:</b> ${highlight(rs,d.term)}</div>`;
}
svg.querySelectorAll('.term-point').forEach(p=>p.addEventListener('click',()=>selectTerm(terms[+p.dataset.i])));
search.addEventListener('input',()=>{
  const q=search.value.trim().toLowerCase(); if(!q) return;
  const exact=terms.find(d=>d.term===q); const prefix=terms.find(d=>d.term.startsWith(q));
  if(exact||prefix) selectTerm(exact||prefix);
});
const initial=terms.find(d=>d.term==='jobs')||topDem[0]||terms[0];
if(initial){ search.value=initial.term; selectTerm(initial); }
})();
