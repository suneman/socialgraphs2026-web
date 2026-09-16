"use strict";
(function(){
const sentences = [
  "A bottle of tezgüino sits on the table.",
  "Everybody likes tezgüino.",
  "Tezgüino makes you drunk.",
  "We make tezgüino from corn.",
  "A bottle of wine sits on the table.",
  "Everybody likes wine.",
  "Wine makes you drunk.",
  "We make bourbon from corn.",
  "Bourbon makes you drunk."
];
const targets = ["tezgüino", "wine", "bourbon"];
const tokenize = s => s.toLowerCase().match(/[\p{L}']+/gu) || [];
const tokenized = sentences.map(tokenize);
const windowInput = document.getElementById("context-window");
const windowValue = document.getElementById("window-value");
const targetSelect = document.getElementById("target-word");

targetSelect.innerHTML = targets.map(w => `<option value="${w}">${w}</option>`).join("");

function occurrences(target, radius){
  const out=[];
  tokenized.forEach((tokens, sentenceIndex) => {
    tokens.forEach((word, i) => {
      if(word !== target) return;
      const lo=Math.max(0,i-radius), hi=Math.min(tokens.length-1,i+radius);
      const context=[];
      for(let j=lo;j<=hi;j++) if(j!==i) context.push(tokens[j]);
      out.push({sentenceIndex,tokens,index:i,lo,hi,context});
    });
  });
  return out;
}

function rowCounts(target, radius){
  const counts=new Map();
  occurrences(target,radius).forEach(o => o.context.forEach(w => counts.set(w,(counts.get(w)||0)+1)));
  return counts;
}

function matrixData(radius){
  const rows=Object.fromEntries(targets.map(t=>[t,rowCounts(t,radius)]));
  const totals=new Map();
  targets.forEach(t=>rows[t].forEach((n,w)=>totals.set(w,(totals.get(w)||0)+n)));
  const cols=[...totals.entries()]
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
    .map(([w])=>w);
  return {rows,cols};
}

function renderMatrix(data, selected){
  const head=`<tr><th>target</th>${data.cols.map(w=>`<th>${w}</th>`).join("")}</tr>`;
  const body=targets.map(t=>{
    const cells=data.cols.map(w=>`<td>${data.rows[t].get(w)||0}</td>`).join("");
    return `<tr class="${t===selected?'active':''}"><td>${t}</td>${cells}</tr>`;
  }).join("");
  document.getElementById("context-matrix").innerHTML=`<table class="matrix"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function renderVector(data, selected){
  const values=data.cols.map(w=>data.rows[selected].get(w)||0);
  document.getElementById("selected-vector").textContent=`${selected} = [${values.join(", ")}]`;
  document.getElementById("vector-note").textContent=`Column order: ${data.cols.join(", ")}`;
}

function renderExamples(selected, radius){
  const items=occurrences(selected,radius).map(o=>{
    const left=o.tokens.slice(o.lo,o.index).join(" ");
    const right=o.tokens.slice(o.index+1,o.hi+1).join(" ");
    return `<div class="context-item"><span class="left">${left || "·"}</span><span class="middle">${selected}</span><span>${right || "·"}</span></div>`;
  });
  document.getElementById("context-examples").innerHTML=items.join("");
}

function render(){
  const radius=+windowInput.value;
  const selected=targetSelect.value || targets[0];
  const data=matrixData(radius);
  windowValue.textContent=`±${radius}`;
  renderMatrix(data,selected);
  renderVector(data,selected);
  renderExamples(selected,radius);
}

windowInput.addEventListener("input",render);
targetSelect.addEventListener("change",render);
render();
})();
