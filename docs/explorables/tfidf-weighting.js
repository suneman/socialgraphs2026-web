"use strict";
(function(){
const docs = [
  { id: "D1", text: "The punk guitar was fast and loud." },
  { id: "D2", text: "The guitar riffs were loud and fast." },
  { id: "D3", text: "The orchestra tuned before the concert." }
];
const tracked = ["the", "guitar", "punk"];
const queries = {
  stress: {
    label: "the guitar",
    terms: ["the", "guitar"],
    hint: "Stress test: a common word can make the wrong document look relevant under simple counts."
  },
  focus: {
    label: "punk guitar",
    terms: ["punk", "guitar"],
    hint: "Focused query: the rare word 'punk' should push the ranking toward D1."
  }
};
let stage = "tfidf";
let queryKey = "focus";

const tokenize = s => s.toLowerCase().match(/[a-z]+/g) || [];
docs.forEach(d => d.tokens = tokenize(d.text));
const N = docs.length;
const df = Object.fromEntries(tracked.map(term => [term, docs.filter(d => d.tokens.includes(term)).length]));
const idf = Object.fromEntries(tracked.map(term => [term, df[term] ? Math.log(N / df[term]) : 0]));

function count(doc, term){ return doc.tokens.filter(t => t === term).length; }
function tf(doc, term){ return count(doc, term) / doc.tokens.length; }
function valueAtStage(doc, term, whichStage){
  if (whichStage === "count") return count(doc, term);
  if (whichStage === "tf") return tf(doc, term);
  return tf(doc, term) * idf[term];
}
function value(doc, term){ return valueAtStage(doc, term, stage); }
function queryScoreAtStage(doc, whichStage){
  return queries[queryKey].terms.reduce((sum, term) => sum + valueAtStage(doc, term, whichStage), 0);
}
function queryScore(doc){ return queryScoreAtStage(doc, stage); }
function fmt(x, whichStage = stage){ return whichStage === "count" ? String(x) : x.toFixed(3); }

function termRole(term){
  if (term === "the") return "common across all documents → IDF 0";
  if (term === "guitar") return "shared by the two music documents";
  return "rare term that only appears in D1";
}

function renderIdf(){
  const termsInQuery = new Set(queries[queryKey].terms);
  document.getElementById("idf-strip").innerHTML = tracked.map(term => `
    <div class="idf-card ${termsInQuery.has(term) ? "active" : ""}" data-term="${term}">
      <div class="idf-term"><span>${term}</span><span class="idf-value">IDF ${idf[term].toFixed(3)}</span></div>
      <div class="idf-meta">appears in ${df[term]} of ${N} documents</div>
      <div class="idf-role">${termRole(term)}</div>
      ${termsInQuery.has(term) ? '<div class="idf-badge">in the active query</div>' : ''}
    </div>`).join("");
}

function matchedTerms(doc){
  return queries[queryKey].terms.filter(term => count(doc, term) > 0);
}

function renderDocs(){
  const scores = docs.map(queryScore);
  const maxScore = Math.max(...scores, 1e-9);
  const best = Math.max(...scores);
  document.getElementById("doc-rows").innerHTML = docs.map((doc, i) => {
    const weights = tracked.map(term => `
      <div class="weight-cell">
        <span class="term">${term}</span>
        <span class="weight">${fmt(value(doc, term))}</span>
      </div>`).join("");
    const matches = matchedTerms(doc);
    const matchHtml = matches.length
      ? matches.map(term => `<span class="query-pill">${term}</span>`).join("")
      : '<span class="query-pill muted">no query term matched</span>';
    const pct = 100 * scores[i] / maxScore;
    return `<div class="tfidf-row ${scores[i] === best && scores[i] > 0 ? "best" : ""}">
      <div class="doc-id">${doc.id}</div>
      <div class="doc-main">
        <div class="doc-text">${doc.text}</div>
        <div class="doc-sub">matched query terms: ${matchHtml}</div>
      </div>
      ${weights}
      <div class="score-cell">
        <div class="score-label"><span>${stage.toUpperCase()} query score</span><span class="score-num">${fmt(scores[i])}</span></div>
        <div class="score-track"><span style="width:${pct.toFixed(1)}%"></span></div>
      </div>
    </div>`;
  }).join("");
}

function renderStageNote(){
  const notes = {
    count: {
      stress: "Under raw counts, D3 ties with the music documents because repeating the common word 'the' still increases the score.",
      focus: "Under raw counts, D1 already wins because it matches both query terms, but the scoring gives no special importance to the rare word 'punk'."
    },
    tf: {
      stress: "Term frequency normalizes for document length, but the basic problem remains: the common word 'the' can still dominate the score.",
      focus: "TF makes the scores comparable across document lengths, yet 'punk' is still only another token unless we also use IDF."
    },
    tfidf: {
      stress: "TF-IDF fixes the failure case. Because 'the' appears everywhere, its IDF is 0, so only the informative word 'guitar' contributes to the final ranking.",
      focus: "TF-IDF sharpens the search toward D1. 'guitar' stays as a shared signal, while the rare term 'punk' receives a larger weight and pushes D1 to the top."
    }
  };
  document.getElementById("stage-note").textContent = notes[stage][queryKey];
}

function renderProgress(){
  const stages = ["count", "tf", "tfidf"];
  const stageLabels = { count: "counts", tf: "TF", tfidf: "TF-IDF" };
  const bestByStage = Object.fromEntries(stages.map(s => [s, Math.max(...docs.map(doc => queryScoreAtStage(doc, s)))]));
  const rows = docs.map(doc => `
    <tr>
      <th scope="row">${doc.id}</th>
      ${stages.map(s => {
        const score = queryScoreAtStage(doc, s);
        const best = bestByStage[s];
        const classes = [s === stage ? "current-stage" : "", score === best && score > 0 ? "stage-best" : ""].filter(Boolean).join(" ");
        return `<td class="${classes}">${fmt(score, s)}</td>`;
      }).join("")}
    </tr>`).join("");
  document.getElementById("progress-table").innerHTML = `
    <table class="progress-table">
      <thead>
        <tr>
          <th>doc</th>
          <th class="${stage === "count" ? "current-stage" : ""}">${stageLabels.count}</th>
          <th class="${stage === "tf" ? "current-stage" : ""}">${stageLabels.tf}</th>
          <th class="${stage === "tfidf" ? "current-stage" : ""}">${stageLabels.tfidf}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="progress-note">The highlighted column is the active representation. The best score in each column is outlined so you can see when the ranking changes.</p>`;
}

function renderTakeaway(){
  const content = {
    stress: {
      title: "What you gain from TF-IDF",
      bullets: [
        "Counts and TF both allow the common word 'the' to reward D3, even though D3 says nothing about guitars.",
        "Once we multiply by IDF, 'the' contributes zero because it appears in every document.",
        "The representation now reflects what we actually wanted from the query: documents about guitars, not documents that merely repeat a common function word."
      ]
    },
    focus: {
      title: "What TF-IDF adds here",
      bullets: [
        "D1 and D2 both look music-related because both contain 'guitar'.",
        "The rare word 'punk' is what makes D1 specifically relevant, and TF-IDF makes that distinction more explicit.",
        "This is the core search idea: keep shared topical words, but give extra influence to the rarer terms that make a query precise."
      ]
    }
  };
  const item = content[queryKey];
  document.getElementById("takeaway").innerHTML = `
    <div class="panel-kicker">Interpretation</div>
    <div class="panel-title">${item.title}</div>
    <ul class="takeaway-list">${item.bullets.map(x => `<li>${x}</li>`).join("")}</ul>`;
}

function renderHeader(){
  document.getElementById("query-code").textContent = queries[queryKey].label;
  document.getElementById("query-hint").textContent = queries[queryKey].hint;
}

function render(){
  renderHeader();
  renderIdf();
  renderDocs();
  renderStageNote();
  renderProgress();
  renderTakeaway();
}

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
