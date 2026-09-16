"use strict";

(async function () {
  const data = await fetch("data/week7_topic_map.json").then(r => r.json());
  const topics = data.topics;
  const docs = data.documents;
  const $ = id => document.getElementById(id);
  const svg = d3.select("#topic-map");
  const root = svg.append("g");
  const tip = $("topic-tip");
  let projection = "svd";
  let colour = "macro";
  let selected = 0;

  const palette = ["var(--cat-1)","var(--cat-2)","var(--cat-3)","var(--cat-4)","var(--cat-5)","var(--cat-6)","var(--cat-7)"];
  const x = d3.scaleLinear().domain([0,1]).range([55,505]);
  const y = d3.scaleLinear().domain([0,1]).range([445,55]);
  const radius = d3.scaleSqrt().domain(d3.extent(topics, d => d.count)).range([15,45]);
  const coord = d => projection === "svd" ? [x(d.xSvd), y(d.ySvd)] : [x(d.xTsne), y(d.yTsne)];

  root.append("rect").attr("width",560).attr("height",500).attr("fill","var(--page)");
  const groups = root.selectAll("g.topic-bubble").data(topics).join("g").attr("class","topic-bubble")
    .on("mouseenter", (event,d)=>showTip(event,d))
    .on("mousemove", moveTip)
    .on("mouseleave", ()=>tip.style.display="none")
    .on("click", (_,d)=>selectTopic(d.topic));
  groups.append("circle").attr("class","topic-circle").attr("r",d=>radius(d.count));
  groups.append("text").attr("class","topic-id").attr("text-anchor","middle").attr("dy","-.1em").text(d=>`T${d.topic}`);
  groups.append("text").attr("class","topic-label").attr("text-anchor","middle").attr("dy","1.25em").text(d=>shortLabel(d));

  function shortLabel(d){
    const words=(d.terms||[]).slice(0,2).join(" · ");
    return words.length>22 ? words.slice(0,21)+"…" : words;
  }
  function fill(d){ return colour === "macro" ? palette[d.macro % palette.length] : "var(--series-1)"; }
  function update(animate=true){
    const g=animate?groups.transition().duration(450):groups;
    g.attr("transform",d=>{const [cx,cy]=coord(d);return `translate(${cx},${cy})`;});
    groups.select("circle").attr("fill",fill);
    groups.classed("active",d=>d.topic===selected);
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function showTip(event,d){
    tip.innerHTML=`<strong>Topic ${d.topic}</strong> · ${d.count} documents<br>${escapeHtml(d.terms.slice(0,6).join(", "))}`;
    tip.style.display="block"; moveTip(event);
  }
  function moveTip(event){
    const rect=$("topic-map").getBoundingClientRect();
    let left=event.clientX-rect.left+12, top=event.clientY-rect.top+12;
    if(left>rect.width-280) left-=285;
    tip.style.left=`${left}px`; tip.style.top=`${top}px`;
  }
  function selectTopic(id, foundDoc=null){
    selected=id;
    const d=topics[id];
    groups.classed("active",x=>x.topic===id);
    $("topic-name").textContent=`Topic ${id}`;
    $("topic-count").textContent=`${d.count} of ${data.meta.nDocuments} documents` + (foundDoc ? ` · ${foundDoc.name} belongs here` : "");
    $("topic-terms").innerHTML=d.terms.map(t=>`<span>${escapeHtml(t)}</span>`).join("");
    $("topic-docs").innerHTML=d.representatives.map(r=>`<li><button data-doc="${r.i}">${escapeHtml(r.name)}</button><p>${escapeHtml(r.description)}</p></li>`).join("");
    $("topic-neighbours").innerHTML=d.nearestTopics.map(n=>`<li><button data-topic="${n.topic}">Topic ${n.topic}</button><span class="score">${n.sim.toFixed(2)}</span></li>`).join("");
    document.querySelectorAll("[data-topic]").forEach(b=>b.addEventListener("click",()=>selectTopic(+b.dataset.topic)));
  }

  document.querySelectorAll("#topic-projection button").forEach(b=>b.addEventListener("click",()=>{
    projection=b.dataset.projection;
    document.querySelectorAll("#topic-projection button").forEach(x=>x.classList.toggle("on",x===b));
    update();
  }));
  $("topic-colour").addEventListener("change",()=>{colour=$("topic-colour").value;update(false);});
  $("topic-search").addEventListener("input",()=>{
    const q=$("topic-search").value.trim().toLowerCase();
    if(!q) return;
    const doc=docs.find(d=>d.name.toLowerCase().startsWith(q)) || docs.find(d=>d.name.toLowerCase().includes(q));
    if(doc) selectTopic(doc.topic,doc);
  });

  update(false);
  const start=docs.find(d=>d.name==="Spider-Man");
  selectTopic(start ? start.topic : 0, start || null);
})();
