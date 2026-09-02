"use strict";

(async function () {
  const data = await fetch("data/week7_corpus_atlas.json").then(r => r.json());
  const nodes = data.nodes;
  const $ = id => document.getElementById(id);
  const svg = d3.select("#atlas");
  const root = svg.append("g");
  const tip = $("tip");
  let projection = "svd";
  let color = "none";
  let selected = null;

  const palette = ["var(--cat-1)","var(--cat-2)","var(--cat-3)","var(--cat-4)","var(--cat-5)","var(--cat-6)","var(--cat-7)"];
  const x = d3.scaleLinear().domain([0,1]).range([28,532]);
  const y = d3.scaleLinear().domain([0,1]).range([472,28]);
  const coord = d => projection === "svd" ? [x(d.xSvd),y(d.ySvd)] : [x(d.xTsne),y(d.yTsne)];

  root.append("rect").attr("x",0).attr("y",0).attr("width",560).attr("height",500).attr("fill","var(--page)");
  const pointLayer = root.append("g");
  const points = pointLayer.selectAll("circle").data(nodes).join("circle")
    .attr("class","atlas-point").attr("r",4.1)
    .on("mouseenter", (event,d) => showTip(event,d))
    .on("mousemove", moveTip)
    .on("mouseleave", () => tip.style.display="none")
    .on("click", (_,d) => selectNode(d));

  const zoom = d3.zoom().scaleExtent([0.8,12]).on("zoom", ev => root.attr("transform",ev.transform));
  svg.call(zoom);

  function fill(d) {
    if (color === "community") return d.community < 7 ? palette[d.community] : "var(--text-muted)";
    if (color === "cluster") return palette[d.textCluster % 7];
    return "var(--series-1)";
  }
  function updatePositions(animate=true) {
    const p = animate ? points.transition().duration(500) : points;
    p.attr("cx", d=>coord(d)[0]).attr("cy", d=>coord(d)[1]).attr("fill",fill);
    updateLegend();
    if (selected) renderDetail(selected);
  }
  function updateLegend() {
    if (color === "none") { $("legend").innerHTML = '<span class="key">Every point is one Marvel character page</span>'; return; }
    const label = color === "community" ? "network community" : "description cluster";
    $("legend").innerHTML = palette.map((c,i)=>`<span class="key"><span class="dot" style="background:${c}"></span>${label} ${i+1}</span>`).join("") + (color === "community" ? '<span class="key"><span class="dot" style="background:var(--text-muted)"></span>small communities</span>' : '');
  }
  function showTip(event,d) {
    tip.innerHTML = `<strong>${escapeHtml(d.name)}</strong><br>${escapeHtml(d.description)}<br><span style="color:var(--text-muted)">in ${d.inDegree} · out ${d.outDegree}</span>`;
    tip.style.display="block"; moveTip(event);
  }
  function moveTip(event) {
    const rect = $("atlas").getBoundingClientRect();
    let left = event.clientX - rect.left + 12, top = event.clientY - rect.top + 12;
    if (left > rect.width - 300) left -= 300;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  }
  function dist2(a,b) { const A=coord(a),B=coord(b); return (A[0]-B[0])**2+(A[1]-B[1])**2; }
  function mapNeighbors(d) {
    return nodes.filter(x=>x.i!==d.i).map(x=>({node:x,dist:dist2(d,x)})).sort((a,b)=>a.dist-b.dist).slice(0,6);
  }
  function selectNode(d) {
    selected=d;
    points.classed("active", x=>x.i===d.i).classed("near", x=>d.nearest.slice(0,5).some(n=>n.i===x.i));
    renderDetail(d);
  }
  function linkButton(d, right="") {
    return `<li><button data-node="${d.i}">${escapeHtml(d.name)}</button><span class="score">${right}</span></li>`;
  }
  function renderDetail(d) {
    $("detail-name").textContent=d.name;
    $("detail-desc").textContent=d.description;
    $("detail-meta").innerHTML=`<div><div class="k">network community</div><div class="v">${d.community+1}</div></div><div><div class="k">text cluster</div><div class="v">${d.textCluster+1}</div></div><div><div class="k">in-degree</div><div class="v">${d.inDegree}</div></div><div><div class="k">out-degree</div><div class="v">${d.outDegree}</div></div>`;
    $("high-neighbors").innerHTML=d.nearest.slice(0,5).map(n=>linkButton(nodes[n.i], n.sim.toFixed(2))).join("");
    $("map-neighbors").innerHTML=mapNeighbors(d).slice(0,5).map(n=>linkButton(n.node, "2D")).join("");
    document.querySelectorAll(".neighbor-list button").forEach(b=>b.addEventListener("click",()=>selectNode(nodes[+b.dataset.node])));
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  document.querySelectorAll("#projection button").forEach(b=>b.addEventListener("click",()=>{
    projection=b.dataset.projection;
    document.querySelectorAll("#projection button").forEach(x=>x.classList.toggle("on",x===b));
    updatePositions();
  }));
  $("color").addEventListener("change",()=>{ color=$("color").value; updatePositions(false); });
  $("reset").addEventListener("click",()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity));
  $("search").addEventListener("input",()=>{
    const q=$("search").value.trim().toLowerCase();
    if (!q) return;
    const match=nodes.find(d=>d.name.toLowerCase().startsWith(q)) || nodes.find(d=>d.name.toLowerCase().includes(q));
    if (match) selectNode(match);
  });

  function renderHeatmap() {
    const K=7,C=7;
    const counts=Array.from({length:K},()=>Array(C).fill(0));
    nodes.forEach(d=>{ if (d.community<C) counts[d.textCluster][d.community]++; });
    const max=d3.max(counts.flat()) || 1;
    const grid=$("heatmap");
    grid.className="heat-grid";
    grid.style.gridTemplateColumns=`56px repeat(${C}, 1fr)`;
    grid.innerHTML=`<div></div>${Array.from({length:C},(_,c)=>`<div class="heat-label">net ${c+1}</div>`).join("")}`+
      counts.map((row,r)=>`<div class="heat-label">text ${r+1}</div>`+row.map(v=>`<div class="heat-cell" style="background:color-mix(in srgb, var(--series-1) ${Math.max(5,Math.round(8+72*v/max))}%, var(--page))">${v}</div>`).join("")).join("");
    $("cluster-terms").innerHTML=Array.from({length:K},(_,c)=>`<div style="margin-bottom:5px"><span style="color:${palette[c]}">text ${c+1}</span><br>${escapeHtml((data.meta.clusterTerms[String(c)]||[]).slice(0,4).join(", "))}</div>`).join("");
  }

  updatePositions(false); renderHeatmap();
  selectNode(nodes.find(d=>d.name==="Spider-Man") || nodes[0]);
})();
