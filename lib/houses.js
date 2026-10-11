/* House menu shared by every house page: the switcher in index.html sends the list; houses of one family (parent links) show as a
   single button plus a branch diagram, so design variants can grow without crowding the menu. */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  const css=`
#hbOv{position:fixed;inset:0;z-index:60;background:rgba(14,22,29,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}
#hbOv[hidden]{display:none}
#hbPanel{width:min(560px,100%);max-height:min(80vh,720px);overflow:auto;background:#fbfaf7;color:#1d2a33;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.35);padding:18px 18px 22px;font:14px/1.5 "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif}
#hbPanel h2{margin:0 0 4px;font-size:17px}
#hbPanel .hbSub{margin:0 0 14px;color:#62717c;font-size:12.5px}
#hbClose{float:right;border:0;background:#eceae4;border-radius:999px;padding:6px 12px;font:inherit;cursor:pointer}
.hbTree{position:relative}
.hbTree svg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.hbNode{position:relative;display:block;width:calc(100% - var(--x));margin-left:var(--x);text-align:left;border:1px solid #e3dfd6;background:#fff;border-radius:12px;padding:9px 12px 10px;margin-bottom:12px;font:inherit;color:inherit;cursor:pointer}
.hbNode:hover{border-color:#c9a074}
.hbNode[aria-current="true"]{border-color:#1a7fc4;box-shadow:0 0 0 2px rgba(26,127,196,.18)}
.hbNode b{display:block;font-size:14.5px}
.hbNode .hbNote{display:block;color:#56646e;font-size:12.5px;margin-top:2px}
.hbNode .hbMeta{display:block;color:#8a959c;font-size:11.5px;margin-top:4px}
.hbNode .hbNow{display:inline-block;margin-left:6px;padding:0 7px;border-radius:999px;background:#1a7fc4;color:#fff;font-size:11px;font-weight:600;vertical-align:1px}
`;
  let ov=null, tree=null, lastD=null;
  const post=function(id){ window.parent.postMessage({type:'house-switch',id:id},location.origin); };
  function familyOf(list,h){ let r=h; while(r.parent){ const p=list.find(function(q){ return q.id===r.parent; }); if(!p) break; r=p; } return r; }
  function overlay(){
    if(ov) return;
    const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    ov=document.createElement('div'); ov.id='hbOv'; ov.hidden=true;
    ov.innerHTML='<div id="hbPanel" role="dialog" aria-label="分支圖"><button id="hbClose" type="button">關閉</button><h2 id="hbTitle"></h2><p class="hbSub">每個節點是一個版本，線表示從哪個版本分出來。點一下就切換過去。</p><div class="hbTree" id="hbTree"></div></div>';
    document.body.appendChild(ov); tree=ov.querySelector('#hbTree');
    ov.addEventListener('click',function(e){ if(e.target===ov) ov.hidden=true; });
    ov.querySelector('#hbClose').addEventListener('click',function(){ ov.hidden=true; });
  }
  function drawTree(rootH){
    const d=lastD, kids=function(id){ return d.list.filter(function(q){ return q.parent===id; }); }, rows=[];
    (function walk(h,depth){ rows.push({h:h,depth:depth}); kids(h.id).forEach(function(k){ walk(k,depth+1); }); })(rootH,0);
    ov.querySelector('#hbTitle').textContent=(rootH.family||rootH.name)+' 分支圖';
    tree.textContent=''; const STEP=26;
    rows.forEach(function(r){
      const b=document.createElement('button'); b.type='button'; b.className='hbNode'; b.style.setProperty('--x',(r.depth*STEP+22)+'px'); r.el=b;
      b.setAttribute('aria-current',String(r.h.id===d.current));
      b.innerHTML='<b></b><span class="hbNote"></span><span class="hbMeta"></span>';
      b.querySelector('b').textContent=r.h.short||r.h.name; if(r.h.id===d.current){ const n=document.createElement('span'); n.className='hbNow'; n.textContent='目前'; b.querySelector('b').appendChild(n); }
      b.querySelector('.hbNote').textContent=r.h.note||''; b.querySelector('.hbMeta').textContent=r.h.date?('建立：'+r.h.date):'';
      b.addEventListener('click',function(){ ov.hidden=true; if(r.h.id!==d.current) post(r.h.id); });
      tree.appendChild(b);
    });
    requestAnimationFrame(function(){                 // rails and branch curves, git-graph style
      const NS='http://www.w3.org/2000/svg', svg=document.createElementNS(NS,'svg'), H=tree.scrollHeight; svg.setAttribute('width',tree.clientWidth); svg.setAttribute('height',H);
      const dot=function(r){ return {x:r.depth*STEP+10,y:r.el.offsetTop+r.el.offsetHeight/2}; };
      rows.forEach(function(r){
        const p=dot(r);
        if(r.h.parent){ const pr=rows.find(function(q){ return q.h.id===r.h.parent; }); if(pr){ const a=dot(pr), path=document.createElementNS(NS,'path');
          path.setAttribute('d','M'+a.x+' '+a.y+' L'+a.x+' '+(p.y-14)+' Q'+a.x+' '+p.y+' '+(a.x+14)+' '+p.y+' L'+p.x+' '+p.y); path.setAttribute('fill','none'); path.setAttribute('stroke','#c9a074'); path.setAttribute('stroke-width','2.5'); svg.appendChild(path); } }
        const c=document.createElementNS(NS,'circle'); c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r',r.h.id===d.current?7:5.5);
        c.setAttribute('fill',r.h.id===d.current?'#1a7fc4':'#fff'); c.setAttribute('stroke',r.h.id===d.current?'#1a7fc4':'#a77d52'); c.setAttribute('stroke-width','2.5'); svg.appendChild(c);
      });
      tree.insertBefore(svg,tree.firstChild);
    });
    ov.hidden=false;
  }
  /* d = {list:[{id,name,disabled,parent,short,note,date,family}], current}; box = the menu's button grid */
  Walk.renderHouses=function(box,d){
    lastD=d; box.textContent='';
    const cur=d.list.find(function(h){ return h.id===d.current; }), curRoot=cur?familyOf(d.list,cur):null;
    d.list.filter(function(h){ return !h.parent; }).forEach(function(h){
      const fam=d.list.some(function(q){ return q.parent===h.id; }), mine=curRoot&&curRoot.id===h.id;
      const b=document.createElement('button'); b.type='button'; b.className='tog'; b.disabled=!!h.disabled; b.setAttribute('aria-pressed',String(!!mine));
      b.textContent=fam?(h.family||h.name)+(mine?'：'+(cur.short||cur.name):'')+' ▸ 分支圖':h.name;
      b.addEventListener('click',function(){ if(fam){ overlay(); drawTree(h); } else if(h.id!==d.current) post(h.id); });
      box.appendChild(b);
    });
  };
})(window);
