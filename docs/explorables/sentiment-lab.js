"use strict";
(function(){
  const $=id=>document.getElementById(id);
  const lex={good:1,wonderful:2,love:2,bad:-1,terrible:-2,stuck:-1,traffic:-1};
  const weights={good:1.25,wonderful:1.55,love:1.0,bad:-1.15,terrible:-1.7,stuck:-.7,traffic:-.65,acting:.25,ending:-.2};
  const sentences={
    good:"The movie was good.",
    notgood:"The movie was not good.",
    traffic:"I just love being stuck in traffic.",
    terrible:"The ending was terrible but the acting was wonderful."
  };
  // Static teaching values in the normal Hugging Face pipeline output format.
  // Students run the actual model in the notebook and record the exact scores there.
  const contextual={
    good:{label:"POSITIVE",score:0.999,notes:["good is interpreted in the full sentence","the model was fine-tuned on labeled movie-review sentiment"]},
    notgood:{label:"NEGATIVE",score:0.998,notes:["not changes the context around good","the sequence representation can use the negation cue"]},
    traffic:{label:"POSITIVE",score:0.944,notes:["love is a strong positive cue","sarcasm can still fool a contextual model, so inspect disagreements"]},
    terrible:{label:"POSITIVE",score:0.918,notes:["terrible and wonderful pull in different directions","the final label compresses a mixed sentence into one class"]}
  };
  function toks(text){return text.toLowerCase().match(/[a-z']+/g)||[];}
  function chip(w,cls=""){return `<span class="sent-token ${cls}">${w}</span>`;}
  function render(){
    const key=$("sentence").value, text=sentences[key], ts=toks(text);
    let sum=0;
    $("lex-tokens").innerHTML=ts.map(w=>{const v=lex[w]||0; sum+=v; return chip(w,v>0?"pos":v<0?"neg":"");}).join("");
    $("lex-score").textContent=(sum>0?"+":"")+sum.toFixed(1);
    const pct=Math.min(48,Math.abs(sum)*12); $("lex-fill").style.left=sum>=0?"50%":`${50-pct}%`; $("lex-fill").style.width=`${pct}%`; $("lex-fill").style.background=sum>=0?"var(--series-2)":"var(--cat-5)";

    const contrib=ts.filter(w=>weights[w]!==undefined).map(w=>[w,weights[w]]).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const logit=contrib.reduce((a,[,v])=>a+v,0);
    $("clf-tokens").innerHTML=ts.map(w=>chip(w,weights[w]>0?"pos":weights[w]<0?"neg":"")).join("");
    $("contrib").innerHTML=contrib.length?contrib.map(([w,v])=>`<div class="contrib"><span>${w}</span><span class="track"><span style="width:${Math.min(100,Math.abs(v)/1.7*100)}%;background:${v>=0?'var(--series-2)':'var(--cat-5)'}"></span></span><span>${v>0?'+':''}${v.toFixed(2)}</span></div>`).join(""):'<span style="color:var(--text-muted);font-size:11px">no known features</span>';
    $("logit").textContent=(logit>0?"+":"")+logit.toFixed(2)+(logit>0?"  → positive":"  → negative");

    const c=contextual[key];
    $("ctx-tokens").innerHTML=ts.map(w=>chip(w,(key==="notgood"&&(w==="not"||w==="good"))||(key==="traffic"&&(w==="love"||w==="stuck"||w==="traffic"))?"cue":"")).join("");
    $("ctx-output").textContent=`[{'label': '${c.label}', 'score': ${c.score.toFixed(3)}}]`;
    $("ctx-links").innerHTML=c.notes.map(s=>`<div class="context-link">${s}</div>`).join("");
  }
  $("sentence").addEventListener("change",render); render();
})();
