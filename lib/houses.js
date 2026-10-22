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
  const post=function(id){ if(window.parent===window) location.href='index.html?house='+encodeURIComponent(id); else window.parent.postMessage({type:'house-switch',id:id},location.origin); };   // opened on its own: go through the switcher
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
  /* menu sheet sections: a sticky row of tabs, the existing controls regrouped by id under each tab; anything unknown stays in the last section */
  const SEC=[['house','房子'],['set','設定'],['mode','模式'],['furn','家具'],['garden','庭院・景色'],['notes','設備'],['go','傳送']];
  const WHERE={rHeight:'set',rFov:'set',rHour:'set',tShadow:'set',tAO:'set',tPerf:'set',tStyle:'set',tInk:'set',tTime:'set',tFurn:'set',tEdit:'set',themeBtns:'set',
    tRail:'set',tTv:'mode',tCurt:'mode',tHeat:'mode',tDecor:'mode',tDaily:'mode',tCook:'mode',tSleep:'mode',tSport:'mode',tBbq:'mode',tReal:'mode',partBtns:'mode',doorBtns:'mode',
    layBtns:'furn',foldRow:'furn',gardenBtns:'garden',treeBtns:'garden',sceneryBtns:'garden',houseBtns:'house',noteQ:'notes',noteAll:'notes',notes:'notes',spots:'go'};
  const scss=`
html body #sheet .sTop{position:sticky;top:-14px;z-index:2;margin:-14px -16px 0;padding:14px 16px 8px;background:var(--card,rgba(249,251,252,.96));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-bottom:1px solid var(--line,rgba(0,0,0,.12))}
html body #sheet .sTabs{display:flex;gap:6px;overflow-x:auto;margin-top:10px;padding-bottom:2px;scrollbar-width:none}
html body #sheet .sTabs::-webkit-scrollbar{display:none}
html body #sheet .sTabs button{flex:0 0 auto;min-height:34px;padding:0 13px;border-radius:17px;border:1px solid var(--line,rgba(0,0,0,.15));background:var(--chip,rgba(0,0,0,.06));font-weight:600;font-size:13px;white-space:nowrap}
html body #sheet .sTabs button[aria-current="true"]{background:var(--accent,#0a78bb);color:#fff;border-color:transparent}
html body #sheet{left:0;right:0;margin:0 auto;max-width:900px;overflow-x:hidden;height:68%;max-height:68%}
html body #sheet *{box-sizing:border-box;max-width:100%}
html body #sheet .sSec{scroll-margin-top:96px}
html body #sheet .sSec[data-off]{display:none}
html body #sheet .seg,html body #sheet .sGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
html body #sheet .tog{white-space:normal;min-width:0;line-height:1.3;padding-top:6px;padding-bottom:6px}
html body #sheet .row{grid-template-columns:4.5em minmax(0,1fr) 4.5em}
html body #sheet .sSec>h3.sHd{margin:20px 0 8px;font-size:13px;letter-spacing:.06em;color:var(--ink,#17222d);font-weight:700}
html body #sheet .sSec .sGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px}
`;
  Walk.organizeSheet=function(){
    const sheet=document.getElementById('sheet'); if(!sheet||sheet.dataset.org) return; sheet.dataset.org='1';
    const st=document.createElement('style'); st.textContent=scss; document.head.appendChild(st);
    const head=sheet.querySelector('.sheet-head'), h2=head.querySelector('h2'), top=document.createElement('div'); top.className='sTop'; sheet.insertBefore(top,head); top.appendChild(head); if(h2) h2.textContent='選單';
    const tabs=document.createElement('div'); tabs.className='sTabs'; tabs.setAttribute('role','tablist'); top.appendChild(tabs);
    const dO=document.getElementById('dOpen'); if(dO&&!dO.parentNode.id) dO.parentNode.id='doorBtns';
    const secs={}, anchor=document.createElement('div'); top.after(anchor);
    SEC.forEach(function(s){ const d=document.createElement('section'); d.className='sSec'; d.dataset.sec=s[0]; const h=document.createElement('h3'); h.className='sHd'; h.textContent=s[1]; d.appendChild(h); secs[s[0]]=d; });
    const rest=Array.prototype.slice.call(sheet.children).filter(function(c){ return c!==top&&c!==anchor; });
    const grid=function(k){ let g=secs[k].querySelector(':scope>.sGrid'); if(!g){ g=document.createElement('div'); g.className='sGrid'; secs[k].appendChild(g); } return g; };
    Object.keys(WHERE).forEach(function(id){ const el=document.getElementById(id); if(!el||!sheet.contains(el)) return; const k=WHERE[id];
      if(el.tagName==='INPUT'&&el.type==='range'){ secs[k].appendChild(el.parentNode); return; }
      if(el.tagName==='BUTTON'&&el.parentNode.children.length>1&&!el.parentNode.id){ const w=el.style.gridColumn; grid(k).appendChild(el); if(w) el.style.gridColumn=w; return; }
      const box=el.tagName==='BUTTON'?el.parentNode:el, h=box.previousElementSibling; if(h&&h.tagName==='H3'&&rest.indexOf(h)>=0&&h.className!=='sHd'){ if(!h.id||h.id==='houseH') secs[k].appendChild(h); }
      secs[k].appendChild(box); });
    rest.forEach(function(c){ if(c.parentNode!==sheet) return; if(c.tagName==='DIV'&&!c.id&&!c.children.length&&!c.textContent.trim()) c.remove(); else secs.go.appendChild(c); });
    SEC.forEach(function(s){ const d=secs[s[0]], hd=d.firstChild; Array.prototype.slice.call(d.querySelectorAll(':scope>h3')).forEach(function(h){ if(h!==hd&&h.textContent.trim()===hd.textContent){ if(h.id){ h.hidden=false; h.style.display='none'; } else h.remove(); } }); });   // a page's own heading with the tab's name is dropped (kept, unseen, when scripts look it up by id)
    SEC.forEach(function(s){ anchor.before(secs[s[0]]); }); anchor.remove();
    let pick=(function(){ try{ return sessionStorage.getItem('sheetTab'); }catch(_){ return null; } })();   // the tab last opened in this session
    const btns={}; SEC.forEach(function(s){ const b=document.createElement('button'); b.type='button'; b.textContent=s[1]; b.setAttribute('role','tab'); b.addEventListener('click',function(){ pick=s[0]; try{ sessionStorage.setItem('sheetTab',pick); }catch(_){} sync(); sheet.scrollTop=0; }); tabs.appendChild(b); btns[s[0]]=b; });
    const shown=function(sec){ return Array.prototype.some.call(sec.children,function(c){ return c.className!=='sHd'&&!c.hidden&&c.tagName!=='H3'&&(c.children.length||c.textContent.trim()); }); };
    const sync=function(){ const avail=SEC.filter(function(s){ return shown(secs[s[0]]); }).map(function(s){ return s[0]; });
      const cur=avail.indexOf(pick)>=0?pick:avail[0];
      SEC.forEach(function(s){ const k=s[0], on=avail.indexOf(k)>=0; if(btns[k].hidden===on) btns[k].hidden=!on; const sel=String(k===cur); if(btns[k].getAttribute('aria-selected')!==sel){ btns[k].setAttribute('aria-selected',sel); btns[k].setAttribute('aria-current',sel); }
        const off=k!==cur; if(secs[k].hasAttribute('data-off')!==off){ if(off) secs[k].setAttribute('data-off',''); else secs[k].removeAttribute('data-off'); } secs[k].hidden=false; }); };
    new MutationObserver(function(){ if(!sheet.hidden) sync(); }).observe(sheet,{attributes:true,subtree:true,childList:true,attributeFilter:['hidden']});
    Walk.syncSheet=sync; sync();
    if(window.parent===window){ const box=document.getElementById('houseBtns'); if(box&&window.fetch) fetch('index.html',{cache:'no-cache'}).then(function(r){ return r.text(); }).then(function(s){ const m=s.match(/const HOUSES=(\[[\s\S]*?\n\]);/); if(!m) return;
      const list=Function('return '+m[1])(), page=location.pathname.split('/').pop()||'index.html', cur=list.find(function(h){ return h.src===page; });   // the switcher's own list, so it stays in one place
      Walk.renderHouses(box,{list:list.map(function(h){ return {id:h.id,name:h.name,disabled:!!h.disabled||!h.src,parent:h.parent,family:h.family,short:h.short,note:h.note,date:h.date}; }),current:cur&&cur.id});
      box.hidden=false; const hh=document.getElementById('houseH'); if(hh) hh.hidden=false; sync(); }).catch(function(){}); } };
})(window);
