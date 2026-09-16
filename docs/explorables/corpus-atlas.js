"use strict";

(async function () {
  const data = await fetch("data/week7_corpus_atlas.json").then(r => r.json());
  const nodes = data.nodes;
  const $ = id => document.getElementById(id);
  const svg = d3.select("#atlas");
  const root = svg.append("g");
  const tip = $("tip");
  let projection = "svd";
  let colour = "cluster";
  let selected = null;

  const palette = ["var(--cat-1)","var(--cat-2)","var(--cat-3)","var(--cat-4)","var(--cat-5)","var(--cat-6)","var(--cat-7)"];
  const x = d3.scaleLinear().domain([0,1]).range([28,532]);
  const y = d3.scaleLinear().domain([0,1]).range([472,28]);
  const coord = d => projection === "svd" ? [x(d.xSvd),y(d.ySvd)] : [x(d.xTsne),y(d.yTsne)];

  const maxInDegree = d3.max(nodes, d => d.inDegree) || 1;
  const radius = d3.scaleSqrt().domain([0, maxInDegree]).range([2.6, 11]).clamp(true);
  const hubs = [...nodes].sort((a,b) => b.inDegree - a.inDegree).slice(0, 9);
  const hubIds = new Set(hubs.map(d => d.i));

  root.append("rect").attr("x",0).attr("y",0).attr("width",560).attr("height",500).attr("fill","var(--page)");
  const linkLayer = root.append("g").attr("class","atlas-links");
  const pointLayer = root.append("g");
  const labelLayer = root.append("g").attr("class","atlas-labels");

  const points = pointLayer.selectAll("circle").data(nodes).join("circle")
    .attr("class","atlas-point").attr("r", d => radius(d.inDegree))
    .on("mouseenter", (event,d) => showTip(event,d))
    .on("mousemove", moveTip)
    .on("mouseleave", () => tip.style.display="none")
    .on("click", (_,d) => selectNode(d));

  const labels = labelLayer.selectAll("text").data(hubs).join("text")
    .attr("class","atlas-hub-label").text(d => d.name);

  const zoom = d3.zoom().scaleExtent([0.8,12]).on("zoom", ev => root.attr("transform",ev.transform));
  svg.call(zoom);

  function fill(d) {
    if (colour === "community") return d.community < 7 ? palette[d.community] : "var(--text-muted)";
    if (colour === "cluster") return palette[d.textCluster % 7];
    return "var(--series-1)";
  }
  function labelSpot(d) {
    const [px,py]=coord(d), r=radius(d.inDegree), left = px > 470;
    return { x: left ? px - r - 4 : px + r + 4, y: py + 3, anchor: left ? "end" : "start" };
  }
  function declutteredSpots() {
    const placed = hubs.map(d => ({ d, ...labelSpot(d) }));
    placed.sort((a,b) => a.y - b.y);
    for (let i=1; i<placed.length; i+=1) {
      const a = placed[i-1], b = placed[i];
      if (Math.abs(a.x - b.x) < 115 && b.y - a.y < 11) b.y = a.y + 11;
    }
    return placed;
  }
  function positionLabels() {
    const placed = declutteredSpots();
    labels.attr("text-anchor", d => placed.find(p => p.d === d).anchor)
      .attr("transform", d => { const p = placed.find(p => p.d === d); return `translate(${p.x},${p.y})`; });
  }
  function updatePositions(animate=true) {
    const p = animate ? points.transition().duration(500) : points;
    p.attr("cx", d=>coord(d)[0]).attr("cy", d=>coord(d)[1]).attr("fill",fill);
    if (animate) {
      labels.attr("text-anchor", d => labelSpot(d).anchor)
        .transition().duration(500).attr("transform", d => { const s=labelSpot(d); return `translate(${s.x},${s.y})`; });
      window.setTimeout(positionLabels, 520);
    } else positionLabels();
    updateLegend();
    if (selected) renderDetail(selected);
  }
  function updateLegend() {
    const sizeNote = '<span class="key size-note">dot size = Wikipedia in-links (how connected the character is)</span>';
    if (colour === "none") { $("legend").innerHTML = '<span class="key">Every point is one Marvel character page</span>' + sizeNote; return; }
    const label = colour === "community" ? "network community" : "description cluster";
    $("legend").innerHTML = palette.map((c,i)=>`<span class="key"><span class="dot" style="background:${c}"></span>${label} ${i+1}</span>`).join("") + (colour === "community" ? '<span class="key"><span class="dot" style="background:var(--text-muted)"></span>small communities</span>' : '') + sizeNote;
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
  function mapNeighbours(d) {
    return nodes.filter(x=>x.i!==d.i).map(x=>({node:x,dist:dist2(d,x)})).sort((a,b)=>a.dist-b.dist).slice(0,6);
  }
  function renderLinks(d, mapNeighs) {
    const links = mapNeighs.slice(0,5).map(n => ({ x1: coord(d)[0], y1: coord(d)[1], x2: coord(n.node)[0], y2: coord(n.node)[1] }));
    linkLayer.selectAll("line").data(links).join("line")
      .attr("x1", l=>l.x1).attr("y1", l=>l.y1).attr("x2", l=>l.x2).attr("y2", l=>l.y2)
      .attr("class","atlas-link");
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
    $("detail-meta").innerHTML=`<div><div class="k">network community</div><div class="v">${d.community+1}</div></div><div><div class="k">in-degree</div><div class="v">${d.inDegree}</div></div><div><div class="k">out-degree</div><div class="v">${d.outDegree}</div></div>`;
    const terms=(data.meta.clusterTerms[String(d.textCluster)]||[]).slice(0,4);
    $("detail-cluster-name").textContent=`text ${d.textCluster+1}`;
    $("detail-cluster-terms").textContent=terms.join(", ");
    $("high-neighbours").innerHTML=d.nearest.slice(0,5).map(n=>linkButton(nodes[n.i], n.sim.toFixed(2))).join("");
    const mapNeighs = mapNeighbours(d);
    $("map-neighbours").innerHTML=mapNeighs.slice(0,5).map(n=>linkButton(n.node, "2D")).join("");
    renderLinks(d, mapNeighs);
    document.querySelectorAll(".neighbour-list button").forEach(b=>b.addEventListener("click",()=>selectNode(nodes[+b.dataset.node])));
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  document.querySelectorAll("#projection button").forEach(b=>b.addEventListener("click",()=>{
    projection=b.dataset.projection;
    document.querySelectorAll("#projection button").forEach(x=>x.classList.toggle("on",x===b));
    updatePositions();
    if (selected) window.setTimeout(()=>renderDetail(selected), 510);
  }));
  $("colour").addEventListener("change",()=>{ colour=$("colour").value; updatePositions(false); });
  $("reset").addEventListener("click",()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity));
  $("search").addEventListener("input",()=>{
    const q=$("search").value.trim().toLowerCase();
    if (!q) return;
    const match=nodes.find(d=>d.name.toLowerCase().startsWith(q)) || nodes.find(d=>d.name.toLowerCase().includes(q));
    if (match) selectNode(match);
  });

  updatePositions(false);
  selectNode(nodes.find(d=>d.name==="Spider-Man") || nodes[0]);
})();
