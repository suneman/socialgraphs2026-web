"use strict";
(function () {
  const $=(id)=>document.getElementById(id);
  const tokens=["the","puppy","chased","the","ball","through","the","park"];
  const noise=["election","river","violin","coffee","planet","minister","window","forest","budget","cloud"];
  let arch="skipgram";
  let negatives=[];
  function init(){
    $("target").innerHTML=tokens.map((w,i)=>`<option value="${i}">${i}: ${w}</option>`).join("");
    $("target").value="2";
    $("target").addEventListener("change",render);
    $("window").addEventListener("input",()=>{$("window-val").textContent=$("window").value;render();});
    $("resample").addEventListener("click",()=>{sampleNegatives();render();});
    document.querySelectorAll("#arch-seg button").forEach((b)=>b.addEventListener("click",()=>{
      arch=b.dataset.arch;
      document.querySelectorAll("#arch-seg button").forEach((x)=>x.classList.toggle("on",x===b));
      render();
    }));
    sampleNegatives(); render();
  }
  function contextIndices(){
    const t=+$("target").value, win=+$("window").value;
    const out=[];
    for(let i=Math.max(0,t-win);i<=Math.min(tokens.length-1,t+win);i++) if(i!==t) out.push(i);
    return out;
  }
  function sampleNegatives(){
    negatives=[];
    const pool=noise.slice();
    while(negatives.length<4&&pool.length){
      const i=Math.floor(Math.random()*pool.length);
      negatives.push(pool.splice(i,1)[0]);
    }
  }
  function render(){
    const t=+$("target").value;
    const ci=contextIndices();
    $("sentence").innerHTML=tokens.map((w,i)=>`<span class="window-word ${i===t?"target":ci.includes(i)?"context":""}">${w}</span>`).join("");
    if(arch==="skipgram"){
      $("positive-title").textContent="Positive Skip-gram pairs";
      $("positives").innerHTML=ci.map((i)=>`<div class="training-item"><span class="left">${tokens[t]}</span><span class="arrow">&#8594;</span><span class="right">${tokens[i]}</span></div>`).join("");
      $("negatives").innerHTML=negatives.map((w)=>`<div class="training-item"><span class="left">${tokens[t]}</span><span class="arrow">&#10005;</span><span class="right">${w}</span></div>`).join("");
      $("goal").textContent="word predicts context";
    }else{
      const ctx=ci.map((i)=>tokens[i]).join(" + ");
      $("positive-title").textContent="One CBOW training example";
      $("positives").innerHTML=`<div class="training-item"><span class="left">${ctx}</span><span class="arrow">&#8594;</span><span class="right">${tokens[t]}</span></div>`;
      $("negatives").innerHTML=negatives.map((w)=>`<div class="training-item"><span class="left">${ctx}</span><span class="arrow">&#10005;</span><span class="right">${w}</span></div>`).join("");
      $("goal").textContent="context predicts word";
    }
    $("n-pos").textContent=ci.length;
  }
  init();
})();
