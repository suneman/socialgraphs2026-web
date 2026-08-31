"use strict";
(function(){
  const $=id=>document.getElementById(id);
  const aliases={"Tony Stark":"Iron Man","Natasha Romanoff":"Black Widow","Bruce Banner":"Hulk","Logan":"Wolverine"};
  const pages=[
    {
      title:"Passage 1",
      paragraphs:[
        [
          {text:"Iron Man met Black Widow before the mission.",entities:["Iron Man","Black Widow"]},
          {text:"Tony Stark later called Spider-Man.",entities:["Tony Stark","Spider-Man"]}
        ],
        [
          {text:"Spider-Man found Hulk near the tower.",entities:["Spider-Man","Hulk"]},
          {text:"Bruce Banner spoke with Black Widow afterward.",entities:["Bruce Banner","Black Widow"]}
        ]
      ]
    },
    {
      title:"Passage 2",
      paragraphs:[
        [
          {text:"Doctor Strange warned Wolverine about the portal.",entities:["Doctor Strange","Wolverine"]},
          {text:"Logan asked Spider-Man to wait outside.",entities:["Logan","Spider-Man"]}
        ],
        [
          {text:"Natasha Romanoff briefed Doctor Strange.",entities:["Natasha Romanoff","Doctor Strange"]},
          {text:"Black Widow then joined Iron Man.",entities:["Black Widow","Iron Man"]}
        ]
      ]
    }
  ];
  const positions={
    "Iron Man":[90,95],"Black Widow":[255,70],"Doctor Strange":[420,105],
    "Spider-Man":[430,300],"Hulk":[255,345],"Wolverine":[85,290]
  };
  let unit="sentence";

  const canonical=x=>aliases[x]||x;
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function highlightedSentence(s){
    let html=escapeHtml(s.text);
    [...s.entities].sort((a,b)=>b.length-a.length).forEach(ent=>{
      const safe=escapeHtml(ent);
      html=html.replace(safe,`<mark class="entity-mark" title="NER: PERSON">${safe}</mark>`);
    });
    return html;
  }

  function renderPages(){
    $("source-pages").innerHTML=pages.map(p=>`<article class="source-page"><div class="mini-k">${p.title}</div>${p.paragraphs.map(par=>`<p>${par.map(highlightedSentence).join(" ")}</p>`).join("")}</article>`).join("");
  }

  function units(){
    const out=[];
    pages.forEach(page=>{
      if(unit==="page"){
        out.push(page.paragraphs.flat().flatMap(s=>s.entities).map(canonical));
      } else if(unit==="paragraph"){
        page.paragraphs.forEach(par=>out.push(par.flatMap(s=>s.entities).map(canonical)));
      } else {
        page.paragraphs.forEach(par=>par.forEach(s=>out.push(s.entities.map(canonical))));
      }
    });
    return out.map(xs=>[...new Set(xs)]);
  }
  function buildEdges(){
    const map=new Map();
    units().forEach(ents=>{
      for(let i=0;i<ents.length;i++) for(let j=i+1;j<ents.length;j++){
        const pair=[ents[i],ents[j]].sort(); const key=pair.join("|||");
        if(!map.has(key)) map.set(key,{a:pair[0],b:pair[1],weight:0});
        map.get(key).weight++;
      }
    });
    return [...map.values()];
  }
  function renderNetwork(){
    const edges=buildEdges();
    const max=Math.max(1,...edges.map(e=>e.weight));
    const edgeSvg=edges.map(e=>{
      const [x1,y1]=positions[e.a], [x2,y2]=positions[e.b];
      const w=1.2+3.5*(e.weight/max);
      return `<line class="entity-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke-width:${w}"><title>${e.a} ↔ ${e.b}: ${e.weight} ${unit}${e.weight===1?"":"s"}</title></line>`;
    }).join("");
    const nodeSvg=Object.entries(positions).map(([name,[x,y]])=>`<g><circle class="entity-node person" cx="${x}" cy="${y}" r="14"></circle><text class="entity-label" x="${x}" y="${y+31}" text-anchor="middle">${name}</text></g>`).join("");
    $("entity-network").innerHTML=edgeSvg+nodeSvg;
    const nUnits=units().length;
    $("rule-readout").innerHTML=`<span><strong>${nUnits}</strong> ${unit}${nUnits===1?"":"s"}</span><span><strong>${edges.length}</strong> edges</span><span>edge width = repeated co-occurrence</span>`;
    $("network-note").textContent=unit==="sentence"
      ? "This is the strictest rule here. Only characters mentioned in the same sentence are connected."
      : unit==="paragraph"
        ? "Paragraphs connect characters that may occur in different sentences, so new edges appear."
        : "A whole page is a broad co-occurrence unit. Many characters become connected even if they never appear in the same sentence.";
  }
  document.querySelectorAll("#co-unit button").forEach(b=>b.addEventListener("click",()=>{
    unit=b.dataset.unit;
    document.querySelectorAll("#co-unit button").forEach(x=>x.classList.toggle("on",x===b));
    renderNetwork();
  }));
  renderPages(); renderNetwork();
})();
