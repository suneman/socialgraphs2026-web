"use strict";
(function(){
const docs = [
  { id: "D1", label: "punk guitar", text: "The punk guitar was fast and loud." },
  { id: "D2", label: "guitar riffs", text: "The guitar riffs were loud and fast." },
  { id: "D3", label: "orchestra", text: "The orchestra tuned before the concert." }
];
const tokenize = s => s.toLowerCase().match(/[a-z]+/g) || [];
docs.forEach(d => d.tokens = tokenize(d.text));
const vocab = Array.from(new Set(docs.flatMap(d => d.tokens))).sort();
const N = docs.length;
const df = Object.fromEntries(vocab.map(term => [term, docs.filter(d => d.tokens.includes(term)).length]));
const idf = Object.fromEntries(vocab.map(term => [term, Math.log(N / df[term])]));
docs.forEach(doc => {
  doc.vector = vocab.map(term => (doc.tokens.filter(t => t === term).length / doc.tokens.length) * idf[term]);
});

const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const norm = a => Math.sqrt(dot(a,a));
const cosine = (a,b) => {
  const den = norm(a)*norm(b);
  return den ? dot(a,b)/den : 0;
};

const aSel = document.getElementById("doc-a");
const bSel = document.getElementById("doc-b");
const scale = document.getElementById("scale-b");
[aSel,bSel].forEach(sel => sel.innerHTML = docs.map((d,i)=>`<option value="${i}">${d.id} · ${d.label}</option>`).join(""));
aSel.value = "0"; bSel.value = "1";

function polarPoint(ox,oy,length,angle){ return {x:ox+length*Math.cos(angle), y:oy-length*Math.sin(angle)}; }
function renderPlot(theta,multiplier){
  const ox=190, oy=305, base=14*Math.PI/180;
  const aAngle=base, bAngle=base+theta;
  const aLen=225, bLen=Math.min(240,175*multiplier);
  const A=polarPoint(ox,oy,aLen,aAngle), B=polarPoint(ox,oy,bLen,bAngle);
  const r=62, start=polarPoint(ox,oy,r,aAngle), end=polarPoint(ox,oy,r,bAngle), mid=polarPoint(ox,oy,r+22,aAngle+theta/2);
  const gx=[250,310,370,430,490,550,610,670,730,790];
  const gy=[65,125,185,245];
  document.getElementById("plot").innerHTML = `
    <defs>
      <marker id="axisArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0.5,0.6 L5.8,3 L0.5,5.4 z" fill="var(--text-secondary)"></path></marker>
      <marker id="arrowA" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto"><path d="M0.5,0.6 L5.8,3 L0.5,5.4 z" fill="var(--series-1)"></path></marker>
      <marker id="arrowB" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto"><path d="M0.5,0.6 L5.8,3 L0.5,5.4 z" fill="var(--series-2)"></path></marker>
    </defs>
    ${gx.map(x=>`<line x1="${x}" y1="40" x2="${x}" y2="325" class="physics-grid"></line>`).join("")}
    ${gy.map(y=>`<line x1="70" y1="${y}" x2="825" y2="${y}" class="physics-grid"></line>`).join("")}
    <line x1="70" y1="${oy}" x2="835" y2="${oy}" class="physics-axis" marker-end="url(#axisArrow)"></line>
    <line x1="${ox}" y1="330" x2="${ox}" y2="35" class="physics-axis" marker-end="url(#axisArrow)"></line>
    <circle cx="${ox}" cy="${oy}" r="3" class="origin-dot"></circle>
    <line x1="${ox}" y1="${oy}" x2="${A.x}" y2="${A.y}" class="cos-vector vector-a" marker-end="url(#arrowA)"></line>
    <line x1="${ox}" y1="${oy}" x2="${B.x}" y2="${B.y}" class="cos-vector vector-b" marker-end="url(#arrowB)"></line>
    <path d="M ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y}" class="cos-arc"></path>
    <text x="${mid.x}" y="${mid.y}" class="theta-label" text-anchor="middle">θ</text>
    <text x="${A.x+12}" y="${A.y-6}" class="vector-tag tag-a">A</text>
    <text x="${B.x+12}" y="${B.y-6}" class="vector-tag tag-b">B</text>`;
}

function render(){
  const docA=docs[+aSel.value], docB=docs[+bSel.value], multiplier=+scale.value;
  const va=docA.vector, vb=docB.vector.map(x=>x*multiplier);
  const sim=Math.max(-1,Math.min(1,cosine(va,vb)));
  const theta=Math.acos(sim), degrees=theta*180/Math.PI;
  renderPlot(theta,multiplier);
  document.getElementById("cosine").textContent=sim.toFixed(3);
  document.getElementById("angle").textContent=`${degrees.toFixed(1)}°`;
  document.getElementById("scale-val").textContent=`${multiplier.toFixed(1)}×`;
  document.getElementById("sentence-a").textContent=`${docA.id}: ${docA.text}`;
  document.getElementById("sentence-b").textContent=`${docB.id}: ${docB.text}`;
}

function preset(name){
  aSel.value="0";
  if(name==="similar"){bSel.value="1";scale.value="1";}
  if(name==="different"){bSel.value="2";scale.value="1";}
  if(name==="same"){bSel.value="0";scale.value="2";}
  document.querySelectorAll("[data-preset]").forEach(b=>b.classList.toggle("primary",b.dataset.preset===name));
  render();
}

document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>preset(b.dataset.preset)));
aSel.addEventListener("change",render); bSel.addEventListener("change",render); scale.addEventListener("input",render);
preset("similar");
})();
