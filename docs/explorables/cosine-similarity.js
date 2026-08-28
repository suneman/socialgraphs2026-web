"use strict";
(function(){
const docs = [
  { id: "D1", label: "punk guitar", text: "The punk guitar was fast and loud." },
  { id: "D2", label: "guitar riffs", text: "The guitar riffs were loud and fast." },
  { id: "D3", label: "orchestra", text: "The orchestra tuned before the concert." }
];

const DISPLAY_STOP = new Set(["the", "and", "was", "were", "before"]);
const tokenize = s => s.toLowerCase().match(/[a-z]+/g) || [];

docs.forEach(d => d.tokens = tokenize(d.text));
const vocab = Array.from(new Set(docs.flatMap(d => d.tokens))).sort();
const N = docs.length;
const df = Object.fromEntries(vocab.map(term => [term, docs.filter(d => d.tokens.includes(term)).length]));
const idf = Object.fromEntries(vocab.map(term => [term, Math.log(N / df[term])]));

docs.forEach(doc => {
  doc.vector = vocab.map(term => (doc.tokens.filter(t => t === term).length / doc.tokens.length) * idf[term]);
  doc.termWeights = Object.fromEntries(vocab.map((term, i) => [term, doc.vector[i]]));
});

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const norm = a => Math.sqrt(dot(a, a));
const cosine = (a, b) => {
  const denominator = norm(a) * norm(b);
  return denominator ? dot(a, b) / denominator : 0;
};

const aSel = document.getElementById("doc-a");
const bSel = document.getElementById("doc-b");
const scale = document.getElementById("scale-b");
[aSel, bSel].forEach(sel => {
  sel.innerHTML = docs.map((d, i) => `<option value="${i}">${d.id} · ${d.label}</option>`).join("");
});

aSel.value = "0";
bSel.value = "1";

function topInformativeTerms(doc){
  return Object.entries(doc.termWeights)
    .filter(([term, value]) => value > 0 && !DISPLAY_STOP.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([term, value]) => ({ term, value }));
}

function sharedInformativeTerms(docA, docB){
  return vocab
    .filter(term => docA.termWeights[term] > 0 && docB.termWeights[term] > 0 && !DISPLAY_STOP.has(term))
    .map(term => ({ term, contribution: docA.termWeights[term] * docB.termWeights[term] }))
    .sort((a, b) => b.contribution - a.contribution);
}

function cardHtml(doc, which){
  const terms = topInformativeTerms(doc);
  return `
    <div class="doc-card-head"><span class="doc-swatch ${which}"></span><span>${which === "a" ? "Sentence A" : "Sentence B"}</span></div>
    <div class="doc-card-id">${doc.id} · ${doc.label}</div>
    <p class="doc-card-text">${doc.text}</p>
    <div class="doc-card-subhead">Most informative weighted terms</div>
    <div class="doc-term-row">${terms.map(t => `<span class="term-pill">${t.term} <em>${t.value.toFixed(3)}</em></span>`).join("")}</div>`;
}

function polarPoint(ox, oy, length, angle){
  return { x: ox + length * Math.cos(angle), y: oy - length * Math.sin(angle) };
}

function renderPlot(theta, multiplier){
  const ox = 185;
  const oy = 325;
  const baseAngle = 16 * Math.PI / 180;
  const angleA = baseAngle;
  const angleB = baseAngle + theta;
  const lenA = 210;
  const lenB = Math.min(225, 165 * multiplier);
  const pointA = polarPoint(ox, oy, lenA, angleA);
  const pointB = polarPoint(ox, oy, lenB, angleB);
  const arcR = 58;
  const arcStart = polarPoint(ox, oy, arcR, angleA);
  const arcEnd = polarPoint(ox, oy, arcR, angleB);
  const thetaMid = angleA + theta / 2;
  const thetaLabel = polarPoint(ox, oy, arcR + 20, thetaMid);

  const gridX = [245, 305, 365, 425, 485, 545, 605, 665, 725, 785];
  const gridY = [85, 145, 205, 265];
  const grid = gridX.map(x => `<line x1="${x}" y1="55" x2="${x}" y2="345" class="physics-grid"></line>`).join("") +
    gridY.map(y => `<line x1="75" y1="${y}" x2="820" y2="${y}" class="physics-grid"></line>`).join("");
  const ticks = gridX.map(x => `<line x1="${x}" y1="319" x2="${x}" y2="331" class="physics-tick"></line>`).join("") +
    gridY.map(y => `<line x1="179" y1="${y}" x2="191" y2="${y}" class="physics-tick"></line>`).join("");

  document.getElementById("plot").innerHTML = `
    <defs>
      <marker id="axisArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0.5,0.6 L5.8,3 L0.5,5.4 z" fill="var(--text-secondary)"></path>
      </marker>
      <marker id="arrowA" markerWidth="5.5" markerHeight="5.5" refX="4.8" refY="2.75" orient="auto" markerUnits="strokeWidth">
        <path d="M0.4,0.6 L5.2,2.75 L0.4,4.9 z" fill="var(--series-1)"></path>
      </marker>
      <marker id="arrowB" markerWidth="5.5" markerHeight="5.5" refX="4.8" refY="2.75" orient="auto" markerUnits="strokeWidth">
        <path d="M0.4,0.6 L5.2,2.75 L0.4,4.9 z" fill="var(--series-2)"></path>
      </marker>
    </defs>
    <rect x="0" y="0" width="900" height="390" class="physics-bg"></rect>
    ${grid}
    <line x1="75" y1="${oy}" x2="830" y2="${oy}" class="physics-axis" marker-end="url(#axisArrow)"></line>
    <line x1="${ox}" y1="350" x2="${ox}" y2="45" class="physics-axis" marker-end="url(#axisArrow)"></line>
    ${ticks}
    <circle cx="${ox}" cy="${oy}" r="3" class="origin-dot"></circle>
    <line x1="${pointA.x}" y1="${pointA.y}" x2="${pointA.x}" y2="${oy}" class="physics-projection"></line>
    <line x1="${pointB.x}" y1="${pointB.y}" x2="${pointB.x}" y2="${oy}" class="physics-projection"></line>
    <line x1="${ox}" y1="${oy}" x2="${pointA.x}" y2="${pointA.y}" class="cos-vector vector-a" marker-end="url(#arrowA)"></line>
    <line x1="${ox}" y1="${oy}" x2="${pointB.x}" y2="${pointB.y}" class="cos-vector vector-b" marker-end="url(#arrowB)"></line>
    <path d="M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 0 ${arcEnd.x} ${arcEnd.y}" class="cos-arc"></path>
    <text x="${thetaLabel.x}" y="${thetaLabel.y}" class="theta-label" text-anchor="middle">θ</text>`;
}

function render(){
  const ai = Number(aSel.value);
  const bi = Number(bSel.value);
  const multiplier = Number(scale.value);
  const docA = docs[ai];
  const docB = docs[bi];
  const vectorA = docA.vector;
  const vectorB = docB.vector.map(x => x * multiplier);
  const similarity = Math.max(-1, Math.min(1, cosine(vectorA, vectorB)));
  const theta = Math.acos(similarity);
  const degrees = theta * 180 / Math.PI;

  renderPlot(theta, multiplier);
  document.getElementById("cosine").textContent = similarity.toFixed(3);
  document.getElementById("angle").textContent = `${degrees.toFixed(1)}°`;
  document.getElementById("scale-val").textContent = `${multiplier.toFixed(1)}×`;
  document.getElementById("card-a").innerHTML = cardHtml(docA, "a");
  document.getElementById("card-b").innerHTML = cardHtml(docB, "b");
  document.getElementById("formula").textContent = `cos(θ) = (A · B) / (||A|| ||B||) = ${similarity.toFixed(3)}`;

  const shared = sharedInformativeTerms(docA, docB);
  document.getElementById("shared-panel").innerHTML = `
    <div class="panel-kicker">Shared weighted vocabulary</div>
    <div class="panel-title">What contributes to the similarity</div>
    ${shared.length
      ? `<div class="doc-term-row">${shared.map(t => `<span class="term-pill shared">${t.term} <em>${t.contribution.toFixed(3)}</em></span>`).join("")}</div>`
      : '<p class="shared-empty">No informative term receives positive weight in both sentences.</p>'}
    <p class="progress-note">Words such as <code>the</code> have IDF 0 here, so they do not affect the cosine even when they occur in both sentences.</p>`;

  let interpretation = "These vectors point in very different directions, so the two sentences emphasize different vocabulary.";
  if (similarity > 0.9) {
    interpretation = "The vectors point in almost the same direction. Sentence B may be longer or shorter, but the weighted pattern is nearly the same.";
  } else if (similarity > 0.35) {
    interpretation = "The vectors are clearly related: they share informative vocabulary, but each sentence still has distinctive terms.";
  } else if (similarity < 0.05) {
    interpretation = "The vectors are almost orthogonal. The TF-IDF weighting treats these sentences as talking about different things.";
  }
  document.getElementById("interpretation").textContent = interpretation;
}

function setPreset(preset){
  aSel.value = "0";
  if (preset === "same") { bSel.value = "0"; scale.value = "1.8"; }
  if (preset === "similar") { bSel.value = "1"; scale.value = "1.0"; }
  if (preset === "different") { bSel.value = "2"; scale.value = "1.0"; }
  document.querySelectorAll("[data-preset]").forEach(button => button.classList.toggle("primary", button.dataset.preset === preset));
  render();
}

document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => setPreset(button.dataset.preset)));
aSel.addEventListener("change", render);
bSel.addEventListener("change", render);
scale.addEventListener("input", render);
setPreset("similar");
})();
