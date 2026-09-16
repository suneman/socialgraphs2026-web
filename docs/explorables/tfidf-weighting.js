"use strict";
(function(){
const docs = [
  { id: "D1", text: "The punk guitar was fast and loud." },
  { id: "D2", text: "The guitar riffs were loud and fast." },
  { id: "D3", text: "The orchestra tuned before the concert." }
];
const tracked = ["the", "guitar", "punk"];
const queries = {
  stress: { terms: ["the", "guitar"] },
  focus: { terms: ["punk", "guitar"] }
};
let stage = "count";
let queryKey = "stress";

const tokenize = s => s.toLowerCase().match(/[a-z]+/g) || [];
docs.forEach(d => d.tokens = tokenize(d.text));
const N = docs.length;
const df = Object.fromEntries(tracked.map(term => [term, docs.filter(d => d.tokens.includes(term)).length]));
const idf = Object.fromEntries(tracked.map(term => [term, Math.log(N / df[term])]));

function count(doc, term){ return doc.tokens.filter(t => t === term).length; }
function tf(doc, term){ return count(doc, term) / doc.tokens.length; }
function valueAtStage(doc, term){
  if (stage === "count") return count(doc, term);
  if (stage === "tf") return tf(doc, term);
  return tf(doc, term) * idf[term];
}
function queryScore(doc){ return queries[queryKey].terms.reduce((sum, term) => sum + valueAtStage(doc, term), 0); }
function fmt(x){ return stage === "count" ? String(x) : x.toFixed(3); }

function renderIdf(){
  const active = new Set(queries[queryKey].terms);
  document.getElementById("idf-strip").innerHTML = tracked.map(term => `
    <div class="idf-card ${active.has(term) ? "active" : ""}">
      <div class="idf-term"><span>${term}</span><span class="idf-value">IDF ${idf[term].toFixed(3)}</span></div>
      <div class="idf-meta">${df[term]} of ${N} documents</div>
    </div>`).join("");
}

function renderDocs(){
  const scores = docs.map(queryScore);
  const maxScore = Math.max(...scores, 1e-9);
  const best = Math.max(...scores);
  document.getElementById("doc-rows").innerHTML = docs.map((doc, i) => {
    const weights = tracked.map(term => `
      <div class="weight-cell ${queries[queryKey].terms.includes(term) ? "query-term" : ""}">
        <span class="weight">${fmt(valueAtStage(doc, term))}</span>
      </div>`).join("");
    const pct = 100 * scores[i] / maxScore;
    return `<div class="tfidf-row clean-row ${scores[i] === best && scores[i] > 0 ? "best" : ""}">
      <div class="doc-id">${doc.id}</div>
      <div class="doc-main"><div class="doc-text">${doc.text}</div></div>
      ${weights}
      <div class="score-cell">
        <div class="score-label"><span>${fmt(scores[i])}</span></div>
        <div class="score-track"><span style="width:${pct.toFixed(1)}%"></span></div>
      </div>
    </div>`;
  }).join("");
}

function render(){ renderIdf(); renderDocs(); }

document.querySelectorAll("#stage-seg button").forEach(button => button.addEventListener("click", () => {
  stage = button.dataset.stage;
  document.querySelectorAll("#stage-seg button").forEach(b => b.classList.toggle("on", b === button));
  render();
}));

document.querySelectorAll("#query-seg button").forEach(button => button.addEventListener("click", () => {
  queryKey = button.dataset.query;
  document.querySelectorAll("#query-seg button").forEach(b => b.classList.toggle("on", b === button));
  render();
}));

render();
})();
