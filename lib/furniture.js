/* Shared furniture system: every furniture set lives in a wrapper (W at its pivot, G offset back) so code that uses absolute
   coordinates keeps working. Provides move / rotate / store-in-library, collision-aware dragging, thumbnails and persistence.
   Knows nothing about a particular house: everything house-specific comes in through `host`. */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  const TAU=Math.PI*2;
  const $=function(id){ return document.getElementById(id); };
  function visibleChain(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }

  /* host (core): THREE, furn (THREE.Group), furnCols (array of {x0,x1,z0,z1,kind}), storageKey, variant() -> current layout id, refreshShadows()
     optional (multi-storey houses): setLevel(m,lv) moves a set to storey lv; spawn(type,id,lv) builds a new catalogue set and returns its mover; onRemove(m) */
  /* nearest face of axis-aligned wall rectangles within maxD metres: {x,z,face} with face 0 E, 1 N, 2 W, 3 S pointing away from the wall */
  Walk.snapToWalls=function(rects,x,z,maxD){
    let best=null, bd=maxD||1.0;
    rects.forEach(function(r){
      const qx=Math.max(r.x0,Math.min(r.x1,x)), qz=Math.max(r.z0,Math.min(r.z1,z)), dx=x-qx, dz=z-qz, d=Math.hypot(dx,dz);
      if(d<1e-6||d>=bd) return;
      bd=d;
      if(Math.abs(dx)>=Math.abs(dz)) best={x:dx>0?r.x1:r.x0,z:qz,face:dx>0?0:2};
      else best={x:qx,z:dz>0?r.z1:r.z0,face:dz>0?3:1};
    });
    return best;
  };
  /* furniture layouts synced across devices through one secret GitHub Gist (file walk-furniture.json: {storageKey:{t,data}}).
     The token (gist scope) and gist id live only in this browser's localStorage. */
  Walk.GistSync=(function(){
    const TK='walkGistToken', GK='walkGistId', FILE='walk-furniture.json', DESC='walkthrough furniture layouts (synced)', API='https://api.github.com';
    const get=function(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }, set=function(k,v){ try{ v===null?localStorage.removeItem(k):localStorage.setItem(k,v); }catch(_){} };
    let status='', listeners=[], timer=null;
    const say=function(t){ status=t; listeners.forEach(function(f){ f(t); }); };
    const req=function(method,path,body){ return fetch(API+path,{method:method,headers:{'Authorization':'Bearer '+get(TK),'Accept':'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
      .then(function(r){ if(!r.ok) throw new Error(r.status===401?'權杖無效或已過期':'GitHub 回應 '+r.status); return r.json(); }); };
    const readRemote=function(){ return req('GET','/gists/'+get(GK)).then(function(g){ const f=g.files&&g.files[FILE]; try{ return f?JSON.parse(f.content)||{}:{}; }catch(_){ return {}; } }); };
    const findOrCreate=function(){
      if(get(GK)) return Promise.resolve(get(GK));
      return req('GET','/gists?per_page=100').then(function(list){ const g=list.find(function(q){ return q.description===DESC&&q.files&&q.files[FILE]; });
        if(g) return g.id;
        return req('POST','/gists',{description:DESC,public:false,files:{[FILE]:{content:'{}'}}}).then(function(n){ return n.id; }); })
        .then(function(id){ set(GK,id); return id; }); };
    const stamp=function(key){ return +(get(key+'.t')||0); };
    function pull(key){                          // remote newer: take it and reload once so every set is rebuilt from it; local newer: push
      if(!get(TK)) return;
      say('同步中…');
      findOrCreate().then(readRemote).then(function(all){ const r=all[key], lt=stamp(key);
        if(r&&r.t>lt){ set(key,JSON.stringify(r.data)); set(key+'.t',String(r.t)); say('已同步（從雲端讀取）');
          let again=false; try{ again=sessionStorage.getItem('walkGistReload')===key+r.t; sessionStorage.setItem('walkGistReload',key+r.t); }catch(_){}
          if(!again) location.reload(); return; }
        if(lt&&(!r||lt>r.t)) return write(key,all);
        say('已同步');
      }).catch(function(e){ say('同步失敗：'+e.message); });
    }
    function write(key,all){ all[key]={t:stamp(key),data:JSON.parse(get(key)||'{}')};
      return req('PATCH','/gists/'+get(GK),{files:{[FILE]:{content:JSON.stringify(all)}}}).then(function(){ say('已同步（'+new Date().toLocaleTimeString().slice(0,5)+' 上傳）'); }); }
    function push(key){ set(key+'.t',String(Date.now())); if(!get(TK)) return;
      clearTimeout(timer); timer=setTimeout(function(){ say('上傳中…'); findOrCreate().then(readRemote).then(function(all){ return write(key,all); }).catch(function(e){ say('同步失敗：'+e.message); }); },1500); }
    function connect(token,key){ set(TK,token.trim()); set(GK,null); pull(key); }
    function disconnect(){ set(TK,null); set(GK,null); say('未連結'); }
    function ui(key){                            // a small block in the settings sheet: paste the token once per device
      const sheet=$('sheet'); if(!sheet||$('gsBox')) return;
      const box=document.createElement('div'); box.id='gsBox';
      box.innerHTML='<h3>家具擺放跨裝置同步</h3><p class="help" style="margin-top:0">用你的 GitHub 帳號存一份私人 Gist。每台裝置貼一次權杖（只勾 gist 權限）：<a href="https://github.com/settings/tokens/new?scopes=gist&amp;description=walkthrough%20furniture" target="_blank" rel="noopener">產生權杖</a></p>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input id="gsTok" type="password" autocomplete="off" placeholder="貼上 ghp_… 權杖" style="flex:1;min-width:180px;padding:8px 10px;border-radius:10px;border:1px solid #ccc;font:inherit">'+
        '<button id="gsOn" type="button">連結</button><button id="gsOff" type="button">解除</button></div><p id="gsSt" class="help" style="margin-top:6px"></p>';
      const sp=$('spots'); if(sp&&sp.nextSibling) sheet.insertBefore(box,sp.nextSibling); else sheet.appendChild(box);
      const st=$('gsSt'), show=function(t){ st.textContent=t||(get(TK)?'已連結':'未連結：擺放只存在這個瀏覽器'); }; listeners.push(show); show(status);
      $('gsOn').addEventListener('click',function(){ const v=$('gsTok').value; if(!v.trim()){ show('請先貼上權杖'); return; } $('gsTok').value=''; connect(v,key); });
      $('gsOff').addEventListener('click',function(){ disconnect(); });
    }
    return {pull:pull,push:push,ui:ui};
  })();
  Walk.FurnitureSystem=function(host){
    const THREE=host.THREE, furn=host.furn, furnCols=host.furnCols;
    const MV_KEY=host.storageKey, movers=[], mvStack=[];
    let mvSaved={}, mvEdit=false, mvSel=null, mvDrag=null;
    try{ mvSaved=JSON.parse(localStorage.getItem(MV_KEY))||{}; }catch(_){ mvSaved={}; }
    Walk.GistSync.pull(MV_KEY); setTimeout(function(){ Walk.GistSync.ui(MV_KEY); },0);
    function mvBegin(){ mvStack.push({a:furn.children.length,c:furnCols.length}); }
    function mvEnd(id,label){ const k=mvStack.pop(); return mvWrap(id,label,furn.children.slice(k.a),furnCols.slice(k.c)); }
    function mvCenter(cols){
      let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
      cols.forEach(function(c){ const b=c.mb||c; x0=Math.min(x0,b.x0); x1=Math.max(x1,b.x1); z0=Math.min(z0,b.z0); z1=Math.max(z1,b.z1); });
      return [(x0+x1)/2,(z0+z1)/2];
    }
    function mvWrap(id,label,nodes,cols,o){
      o=o||{};
      const W=new THREE.Group(), G=new THREE.Group(); W.add(G);
      nodes.forEach(function(n){ if(n.parent) n.parent.remove(n); G.add(n); });
      (o.parent||furn).add(W);
      const m={id:id,label:label,W:W,G:G,own:cols,pose:!!o.pose,colsFn:o.colsFn||null,pivotFn:o.pivotFn||null,onApply:o.onApply||null,pv:[0,0],y:0,lv0:o.lv,wall:!!o.wall,face0:o.face0||0};
      W.userData.mv=m;
      if(o.pivot){ m.pv=o.pivot.slice(); cols.forEach(function(c){ if(!c.mb) c.mb={x0:c.x0,x1:c.x1,z0:c.z0,z1:c.z1}; }); }
      else if(!m.pose){
        cols.forEach(function(c){ if(!c.mb) c.mb={x0:c.x0,x1:c.x1,z0:c.z0,z1:c.z1}; });
        if(cols.length) m.pv=mvCenter(cols);
        else { G.updateMatrixWorld(true); const c=new THREE.Box3().setFromObject(G).getCenter(new THREE.Vector3()); m.pv=[c.x,c.z]; }
      }
      movers.push(m); return m;
    }
    function mvKey(m){ return (m.pose||m.perLayout)?m.id+'@'+host.variant():m.id; }
    function mvGet(m){ return mvSaved[mvKey(m)]||(m.defOff?{dx:0,dz:0,rot:0,off:1}:{dx:0,dz:0,rot:0}); }
    function mvIsStored(id){ const m=movers.find(function(q){ return q.id===id; }); return !!(m&&mvGet(m).off); }
    function mvLv(m,s){ return s&&s.lv!==undefined?s.lv:m.lv0; }
    function mvLayOk(m){ const l=m.W.userData.lay; return l===undefined||l===0||l===host.variant(); }
    function mvCols(m){
      return (m.colsFn?m.colsFn():m.own).filter(function(c){ if(!c.mb&&m.pose) c.mb={x0:c.x0,x1:c.x1,z0:c.z0,z1:c.z1}; return !!c.mb; });
    }
    function mvRect(b,px,pz,s){
      let x0=b.x0-px,x1=b.x1-px,z0=b.z0-pz,z1=b.z1-pz;
      for(let k=0;k<s.rot;k++){ const a=z0,c=z1,d=-x1,e=-x0; x0=a; x1=c; z0=d; z1=e; }
      return {x0:x0+px+s.dx,x1:x1+px+s.dx,z0:z0+pz+s.dz,z1:z1+pz+s.dz};
    }
    function mvApply(m){
      const cols=mvCols(m);
      if(m.pose&&m.pivotFn) m.pv=mvCenter(m.pivotFn());
      const s=mvGet(m), px=m.pv[0], pz=m.pv[1];
      if(host.setLevel&&mvLv(m,s)!==undefined) host.setLevel(m,mvLv(m,s));
      m.W.position.set(px+s.dx,m.y,pz+s.dz); m.W.rotation.y=s.rot*Math.PI/2; m.G.position.set(-px,0,-pz);
      cols.forEach(function(c){ const r=mvRect(c.mb,px,pz,s); c.x0=r.x0; c.x1=r.x1; c.z0=r.z0; c.z1=r.z1; c.mvOff=!!s.off; });
      m.W.visible=mvLayOk(m)&&!s.off;
      if(m.onApply) m.onApply(px+s.dx,pz+s.dz);
      host.refreshShadows();
    }
    function mvXf(id,x,z){                         // where a point attached to furniture `id` ends up after the user moved it; third value = added yaw
      const m=movers.find(function(q){ return q.id===id; }); if(!m) return [x,z,0];
      const s=mvGet(m); let rx=x-m.pv[0], rz=z-m.pv[1];
      for(let k=0;k<s.rot;k++){ const t=rx; rx=rz; rz=-t; }
      return [m.pv[0]+rx+s.dx,m.pv[1]+rz+s.dz,s.rot*Math.PI/2];
    }

    /* host (UI): scene, camera, canvas, orb {tx,tz,...}, uiRoot (element), toggleButton (element), allCols(lv), rebuild(), toast(msg), inside(x,z,lv),
       getMode(), setMode(m), closeMenu(), pointerCount(), onEditToggle(on), onChange()
       optional: types() -> [{t,name,cat}] shows the catalogue in the library; preview(t) -> Object3D for its thumbnail; dropLevel(), dropY();
       wallSnap(x,z,lv) -> {x,z,face} nearest wall face (face 0 E, 1 N, 2 W, 3 S = direction into the room) for sets wrapped with {wall:true} */
    function initUI(h){
      const scene=h.scene, camera=h.camera, canvas=h.canvas, orb=h.orb;
      const style=document.createElement('style'); style.textContent=`#editBar{
  position:absolute; left:50%; transform:translateX(-50%); top:calc(12px + env(safe-area-inset-top, 0px));
  width:min(520px,calc(100% - 340px)); pointer-events:auto; display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:center;
  background:var(--card); border:1px solid var(--line); border-radius:14px; padding:10px 12px;
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
}
#editBar[hidden]{display:none}
#lib{position:absolute; left:12px; top:calc(76px + env(safe-area-inset-top, 0px)); width:118px; max-height:calc(100% - 270px - env(safe-area-inset-top, 0px));
  display:flex; flex-direction:column; pointer-events:auto; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:8px;
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px)}
#lib[hidden]{display:none}
#libHead{font-size:12px; font-weight:700; color:var(--muted); text-align:center; padding:2px 0 6px}
#libList{overflow-y:auto; display:flex; flex-direction:column; gap:6px}
.libCard{border:1px solid var(--line); border-radius:10px; background:var(--chip); padding:4px; text-align:center; cursor:grab; touch-action:pan-y}
.libCard img{width:100%; aspect-ratio:1; object-fit:contain; display:block; pointer-events:none; -webkit-user-drag:none}
.libCard span{display:block; font-size:11px; line-height:1.3; margin-top:2px}
.libSec{font-size:11px; font-weight:700; color:var(--muted); padding:6px 2px 0}
.libEmpty{font-size:11px; color:var(--muted); line-height:1.5; padding:6px 4px}
#libGhost{position:fixed; width:84px; height:84px; object-fit:contain; transform:translate(-50%,-50%); pointer-events:none; opacity:.85; z-index:20}
#libGhost[hidden]{display:none}
@media (max-width:760px){ #editBar{top:auto; bottom:calc(168px + env(safe-area-inset-bottom, 0px)); width:calc(100% - 32px)} }
#editHint{flex:1 0 100%; text-align:center; font-size:12.5px; color:var(--muted)}
#editBar button{min-height:40px; padding:0 14px; border-radius:20px; border:1px solid var(--line); background:var(--chip); font-weight:500}
#editBar button:disabled{opacity:.4; cursor:default}
#editBar #eDone{background:var(--accent); color:var(--accent-ink); border-color:transparent}
`; document.head.appendChild(style);
      h.uiRoot.insertAdjacentHTML('beforeend',`  <div id="lib" hidden><div id="libHead">物品庫</div><div id="libList"></div></div>
  <img id="libGhost" alt="" hidden>
  <div id="editBar" hidden>
    <div id="editHint">點一件家具選取，拖曳移動</div>
    <button id="eRot" type="button" disabled>旋轉 90°（R）</button>
    <button id="eStore" type="button" disabled>收回物品庫</button>
    <button id="eReset" type="button" disabled>還原這件</button>
    <button id="eAll" type="button">全部還原</button>
    <button id="eDone" type="button">完成</button>
  </div>
`);
      const mvBar=$('editBar'), mvHint=$('editHint'), mvRay=new THREE.Raycaster(), mvV=new THREE.Vector2(), mvPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
      const mvHelper=new THREE.Box3Helper(new THREE.Box3(),0xff8a52); mvHelper.visible=false; mvHelper.material.depthTest=false; mvHelper.renderOrder=999; h.scene.add(mvHelper);
      function mvSave(){ try{ localStorage.setItem(MV_KEY,JSON.stringify(mvSaved)); }catch(_){} Walk.GistSync.push(MV_KEY); }
      function mvUpdateHelper(){
        if(!mvSel||!visibleChain(mvSel.W)){ mvHelper.visible=false; return; }
        mvSel.W.updateMatrixWorld(true); mvHelper.box.setFromObject(mvSel.W); mvHelper.visible=true;
      }
      function mvUi(){
        $('eRot').disabled=!mvSel; $('eReset').disabled=!mvSel||!!mvSel.extra; $('eStore').disabled=!mvSel;
        mvHint.textContent=mvSel?'選取中：'+mvSel.label+'（拖曳移動，旋轉鈕或 R 轉 90°）':'點一件家具選取；空白處拖曳可平移地圖，滾輪縮放';
      }
      function mvSetEdit(on){
        mvEdit=on; mvDrag=null; mvSel=null;
        if(h.toggleButton) h.toggleButton.setAttribute('aria-pressed',String(on)); mvBar.hidden=!on;
        if(on){ if(h.getMode()!=='over') h.setMode('over'); h.closeMenu(); }
        h.onEditToggle(on);
        mvUpdateHelper(); mvUi(); mvLibRefresh();
      }
      function mvOverlap(a,b){ const e=0.01; return a.x0<b.x1-e&&a.x1>b.x0+e&&a.z0<b.z1-e&&a.z1>b.z0+e; }
      function mvFits(m,s,ign){
        const cx=m.pv[0]+s.dx, cz=m.pv[1]+s.dz, lv=mvLv(m,s);
        if(!h.inside(cx,cz,lv)) return false;
        const own=mvCols(m), oth=h.allCols(lv).filter(function(c){ return own.indexOf(c)<0&&!(ign&&ign.has(c)); });
        for(let i=0;i<own.length;i++){ const r=mvRect(own[i].mb,m.pv[0],m.pv[1],s); for(let j=0;j<oth.length;j++) if(mvOverlap(r,oth[j])) return false; }
        return true;
      }
      function mvIgnore(m){                          // things the set already overlaps in its starting position are not treated as obstacles
        const s=mvGet(m), own=mvCols(m), ign=new Set();
        own.forEach(function(c){ const r=mvRect(c.mb,m.pv[0],m.pv[1],s); h.allCols(mvLv(m,s)).forEach(function(o){ if(own.indexOf(o)<0&&mvOverlap(r,o)) ign.add(o); }); });
        return ign;
      }
      function mvSnap(m,s){                          // wall pieces: slide the pivot onto the nearest wall face and turn them to face the room
        if(!m.wall||!h.wallSnap) return s;
        const f=[[1,0],[0,-1],[-1,0],[0,1]][((m.face0+s.rot)%4+4)%4];         // probe just in front of the current face so a piece already on a wall keeps it
        const p=h.wallSnap(m.pv[0]+s.dx+f[0]*0.05,m.pv[1]+s.dz+f[1]*0.05,mvLv(m,s)); if(!p) return null;
        return {dx:p.x-m.pv[0],dz:p.z-m.pv[1],rot:((p.face-m.face0)%4+4)%4,lv:s.lv};
      }
      function mvCommit(m,s){ mvSaved[mvKey(m)]={dx:s.dx,dz:s.dz,rot:s.rot,lv:s.lv}; mvApply(m); mvUpdateHelper(); }
      function mvMove(m,tdx,tdz,ign){                // walk toward the target in 2 cm steps; on a hit, slide along the free axis
        if(m.wall){ const s1=mvGet(m), c=mvSnap(m,{dx:tdx,dz:tdz,rot:s1.rot,lv:s1.lv}); if(c&&mvFits(m,c,ign)) mvCommit(m,c); return; }
        const s0=mvGet(m), lv=s0.lv, n=Math.max(1,Math.ceil(Math.hypot(tdx-s0.dx,tdz-s0.dz)/0.02)); let last={dx:s0.dx,dz:s0.dz,rot:s0.rot,lv:lv};
        for(let i=1;i<=n;i++){
          const t=i/n, c={dx:s0.dx+(tdx-s0.dx)*t,dz:s0.dz+(tdz-s0.dz)*t,rot:s0.rot,lv:lv};
          if(mvFits(m,c,ign)){ last=c; continue; }
          const cx={dx:c.dx,dz:last.dz,rot:s0.rot,lv:lv}, cz={dx:last.dx,dz:c.dz,rot:s0.rot,lv:lv};
          if(mvFits(m,cx,ign)) last=cx; else if(mvFits(m,cz,ign)) last=cz; else break;
        }
        mvCommit(m,last);
      }
      function mvRotate(){
        const m=mvSel; if(!m) return;
        if(m.wall){ h.toast('掛在牆上的東西會自動朝向房間'); return; }
        const s=mvGet(m), rot=(s.rot+1)%4, ign=mvIgnore(m), tries=[[0,0]];
        for(let r=0.05;r<=0.4;r+=0.05) [[r,0],[-r,0],[0,r],[0,-r]].forEach(function(t){ tries.push(t); });
        for(let i=0;i<tries.length;i++){ const c={dx:s.dx+tries[i][0],dz:s.dz+tries[i][1],rot:rot,lv:s.lv}; if(mvFits(m,c,ign)){ mvCommit(m,c); mvSave(); mvSyncPeople(); return; } }
        h.toast('這裡放不下，換個位置再轉');
      }
      function mvSyncPeople(){ h.onChange(); }                   // seated / standing people follow the furniture they use
      function mvNdc(e){ const r=canvas.getBoundingClientRect(); mvV.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1)); mvRay.setFromCamera(mvV,h.camera); }
      function mvPick(e){
        mvNdc(e);
        const hits=mvRay.intersectObjects(movers.filter(function(m){ return visibleChain(m.W); }).map(function(m){ return m.W; }),true);
        for(let i=0;i<hits.length;i++){
          if(!visibleChain(hits[i].object)) continue;
          let o=hits[i].object; while(o&&!(o.userData&&o.userData.mv)) o=o.parent;
          if(o) return {m:o.userData.mv,p:hits[i].point};
        }
        return null;
      }
      canvas.addEventListener('pointerdown',function(e){
        if(!mvEdit||h.getMode()!=='over') return;
        if(h.pointerCount()>1){ mvDrag=null; return; }
        const hit=mvPick(e); if(!hit) return;
        mvSel=hit.m; mvUpdateHelper(); mvUi();
        mvPlane.constant=-hit.p.y;
        const s=mvGet(hit.m);
        mvDrag={m:hit.m,id:e.pointerId,p0:hit.p.clone(),dx:s.dx,dz:s.dz,ign:mvIgnore(hit.m)};
      });
      canvas.addEventListener('pointermove',function(e){
        if(!mvDrag||e.pointerId!==mvDrag.id) return;
        mvNdc(e); const p=new THREE.Vector3(); if(!mvRay.ray.intersectPlane(mvPlane,p)) return;
        mvMove(mvDrag.m,mvDrag.dx+(p.x-mvDrag.p0.x),mvDrag.dz+(p.z-mvDrag.p0.z),mvDrag.ign);
      });
      function mvEndDrag(e){
        if(mvDrag&&e.pointerId===mvDrag.id){
          const m=mvDrag.m; mvDrag=null; const el=document.elementFromPoint(e.clientX,e.clientY);
          if(el&&el.closest('#lib')){ mvStore(m); return; }
          mvSave(); mvSyncPeople();
        }
      }
      canvas.addEventListener('pointerup',mvEndDrag);
      canvas.addEventListener('pointercancel',mvEndDrag);
      window.addEventListener('keydown',function(e){
        if(!mvEdit||(e.target&&e.target.tagName==='INPUT')) return;
        if(e.code==='KeyR'&&!e.repeat) mvRotate();
        if(e.code==='Escape'){ mvSel=null; mvUpdateHelper(); mvUi(); }
      });

      /* item library: stored furniture shown as cards with thumbnails; drag one into the room, or put a placed one back */
      const mvThumbs={};
      function mvRenderThumbs(pairs){                // pairs: [key, Object3D at the origin]; one offscreen renderer for the whole batch
        let r=null;
        try{
          r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); r.setPixelRatio(1); r.setSize(144,144);
          r.outputColorSpace=THREE.SRGBColorSpace; r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.1; r.localClippingEnabled=true;
          pairs.forEach(function(pr){
            const obj=pr[1], sc=new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff,0xc9b99f,1.5*Math.PI)); const d=new THREE.DirectionalLight(0xffffff,1.3*Math.PI); d.position.set(3,6,4); sc.add(d);
            obj.position.set(0,0,0); obj.rotation.set(0,0,0); obj.visible=true;
            obj.traverse(function(o){ if(o.renderOrder===1) o.visible=false; });   // drop the floor shadow decals
            sc.add(obj); obj.updateMatrixWorld(true);
            const b=new THREE.Box3().setFromObject(obj), ctr=b.getCenter(new THREE.Vector3()), sz=b.getSize(new THREE.Vector3());
            const rad=Math.max(sz.x,sz.z,sz.y)*0.5+0.05, cam=new THREE.PerspectiveCamera(30,1,0.1,60), dist=rad/Math.tan(15*Math.PI/180)*1.12;
            cam.position.set(ctr.x+dist*0.55,ctr.y+dist*0.62,ctr.z+dist*0.75); cam.lookAt(ctr);
            r.render(sc,cam); mvThumbs[pr[0]]=r.domElement.toDataURL('image/png');
          });
        }catch(e){ pairs.forEach(function(pr){ if(!mvThumbs[pr[0]]) mvThumbs[pr[0]]=''; }); }
        finally{ if(r){ r.dispose(); try{ r.forceContextLoss(); }catch(_){} } }
      }
      function mvMakeThumbs(list){
        mvRenderThumbs(list.map(function(m){
          const keep=m.W.userData.mv; delete m.W.userData.mv;
          const c=m.W.clone(true); m.W.userData.mv=keep; c.position.y=0; return [m.id,c];
        }));
      }
      function mvLibRefresh(){
        const box=$('lib'); box.hidden=!mvEdit; if(!mvEdit) return;
        const list=$('libList'); list.textContent='';
        const items=movers.filter(function(m){ return mvGet(m).off&&mvLayOk(m); });
        $('libHead').textContent='物品庫';
        const head=function(t){ const e=document.createElement('div'); e.className='libSec'; e.textContent=t; list.appendChild(e); };
        const card=function(key,label,down){
          const c=document.createElement('div'); c.className='libCard';
          const img=document.createElement('img'); img.alt=''; if(mvThumbs[key]) img.src=mvThumbs[key]; c.appendChild(img);
          const t=document.createElement('span'); t.textContent=label; c.appendChild(t);
          c.addEventListener('pointerdown',down); list.appendChild(c);
        };
        if(h.types) head('收起來的（'+items.length+'）');
        if(!items.length){ const e=document.createElement('div'); e.className='libEmpty'; e.textContent=h.types?'選取家具按「收回物品庫」會收到這裡':'目前是空的。選取家具按「收回物品庫」，就會收到這裡'; list.appendChild(e); }
        const need=items.filter(function(m){ return mvThumbs[m.id]===undefined; }); if(need.length) mvMakeThumbs(need);
        items.forEach(function(m){ card(m.id,m.label,function(e){ libDrag={m:m,x:e.clientX,y:e.clientY,moved:false,id:e.pointerId}; }); });
        if(!h.types) return;
        let cat=null;
        const types=h.types(), todo=types.filter(function(d){ return mvThumbs['type:'+d.t]===undefined; });
        if(todo.length) mvRenderThumbs(todo.map(function(d){ return ['type:'+d.t,h.preview(d.t)]; }));
        types.forEach(function(d){
          if(d.cat!==cat){ cat=d.cat; head('型錄 · '+cat); }
          const key='type:'+d.t;
          card(key,d.name,function(e){ libDrag={type:d.t,key:key,x:e.clientX,y:e.clientY,moved:false,id:e.pointerId}; });
        });
      }
      let libDrag=null; const libGhost=$('libGhost');
      window.addEventListener('pointermove',function(e){
        if(!libDrag||e.pointerId!==libDrag.id) return;
        if(!libDrag.moved&&Math.hypot(e.clientX-libDrag.x,e.clientY-libDrag.y)>10){ libDrag.moved=true; libGhost.src=mvThumbs[libDrag.key||libDrag.m.id]||''; libGhost.hidden=false; }
        if(libDrag.moved){ libGhost.style.left=e.clientX+'px'; libGhost.style.top=e.clientY+'px'; }
      });
      function libEnd(e,cancel){
        if(!libDrag||e.pointerId!==libDrag.id) return;
        const d=libDrag; libDrag=null; libGhost.hidden=true; if(cancel) return;
        let x=orb.tx, z=orb.tz;
        if(d.moved){
          const el=document.elementFromPoint(e.clientX,e.clientY); if(el&&el.closest('#lib')) return;
          mvNdc(e); mvPlane.constant=-(h.dropY?h.dropY():0); const p=new THREE.Vector3();
          if(!mvRay.ray.intersectPlane(mvPlane,p)) return; x=p.x; z=p.z;
        }
        const lv=h.dropLevel?h.dropLevel():undefined;
        if(d.type){ const m=mvSpawn(d.type,lv); if(m&&!mvTakeOut(m,x,z,lv)){ mvRemove(m); mvSave(); } return; }
        mvTakeOut(d.m,x,z,lv);
      }
      window.addEventListener('pointerup',function(e){ libEnd(e,false); });
      window.addEventListener('pointercancel',function(e){ libEnd(e,true); });
      function mvTakeOut(m,wx,wz,lv){                // centre the piece on the drop point; if that is blocked, look outward for the nearest free spot
        const tries=[[0,0]]; for(let r=0.12;r<=3;r+=0.12) for(let k=0;k<16;k++) tries.push([Math.cos(k/16*TAU)*r,Math.sin(k/16*TAU)*r]);
        if(lv===undefined) lv=m.lv0;
        for(let i=0;i<tries.length;i++){
          const s=mvSnap(m,{dx:wx+tries[i][0]-m.pv[0],dz:wz+tries[i][1]-m.pv[1],rot:0,lv:lv});
          if(s&&mvFits(m,s,null)){
            mvSaved[mvKey(m)]={dx:s.dx,dz:s.dz,rot:s.rot,lv:lv}; mvApply(m); h.rebuild();
            mvSel=m; mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); return true;
          }
        }
        h.toast('放不下，先清出一些空間'); return false;
      }
      function mvStore(m){
        if(!m) return;
        if(m.extra){ mvRemove(m); h.rebuild(); } else { mvSaved[mvKey(m)]={dx:0,dz:0,rot:0,off:1}; mvApply(m); h.rebuild(); }
        mvSel=null; mvDrag=null; mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); h.toast('已收進物品庫：'+m.label);
      }
      $('eStore').addEventListener('click',function(){ mvStore(mvSel); });
      if(h.toggleButton) h.toggleButton.addEventListener('click',function(){ mvSetEdit(!mvEdit); });
      $('eDone').addEventListener('click',function(){ mvSetEdit(false); h.setMode('walk'); });
      $('eRot').addEventListener('click',mvRotate);
      $('eReset').addEventListener('click',function(){ if(!mvSel) return; delete mvSaved[mvKey(mvSel)]; mvApply(mvSel); h.rebuild(); mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); });
      $('eAll').addEventListener('click',function(){ movers.filter(function(m){ return m.extra; }).forEach(mvRemove); mvSaved={}; movers.forEach(mvApply); h.rebuild(); mvSel=null; mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); h.toast('家具已全部還原'); });

      mvUi(); mvLibRefresh();
      return {
        setEdit:mvSetEdit, libRefresh:mvLibRefresh, rotate:mvRotate, store:mvStore, takeOut:mvTakeOut,
        select:function(id){ mvSel=movers.find(function(q){ return q.id===id; })||null; mvUpdateHelper(); mvUi(); },
        variantChanged:function(){ mvSel=null; mvUpdateHelper(); mvUi(); movers.forEach(mvApply); mvLibRefresh(); },
        isDragging:function(){ return !!mvDrag; },
        screen:function(id){ const m=movers.find(function(q){ return q.id===id; }), s=mvGet(m), v=new THREE.Vector3(m.pv[0]+s.dx,0.5,m.pv[1]+s.dz).project(camera), r=canvas.getBoundingClientRect(); return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]; }
      };
    }

    /* extra copies taken out of the catalogue: listed in saved.__x as {id,t,lv} and rebuilt by host.spawn on load */
    let mvSeq=0;
    function mvExtras(){ return mvSaved.__x||(mvSaved.__x=[]); }
    function mvSpawn(t,lv){
      if(!host.spawn) return null;
      let id; do{ id='x'+(++mvSeq)+':'+t; }while(movers.some(function(q){ return q.id===id; }));
      const m=host.spawn(t,id,lv); m.extra=t; mvExtras().push({id:id,t:t,lv:lv}); return m;
    }
    function mvRestoreExtras(){
      if(!host.spawn) return;
      mvExtras().slice().forEach(function(e){
        let m=null; try{ m=host.spawn(e.t,e.id,e.lv); }catch(_){ m=null; }
        if(!m){ mvSaved.__x=mvExtras().filter(function(q){ return q.id!==e.id; }); delete mvSaved[e.id]; return; }
        m.extra=e.t; mvApply(m); const n=+String(e.id).slice(1).split(':')[0]; if(n>mvSeq) mvSeq=n;
      });
    }
    function mvRemove(m){
      const i=movers.indexOf(m); if(i>=0) movers.splice(i,1);
      if(m.W.parent) m.W.parent.remove(m.W);
      mvCols(m).forEach(function(c){ const k=furnCols.indexOf(c); if(k>=0) furnCols.splice(k,1); });
      if(host.onRemove) host.onRemove(m);
      mvSaved.__x=mvExtras().filter(function(q){ return q.id!==m.id; }); delete mvSaved[m.id];
      host.refreshShadows();
    }

    return {
      movers:movers, begin:mvBegin, end:mvEnd, wrap:mvWrap, apply:mvApply, get:mvGet, xf:mvXf, isStored:mvIsStored,
      spawn:mvSpawn, restoreExtras:mvRestoreExtras, remove:mvRemove,
      saved:function(){ return mvSaved; }, isEditing:function(){ return mvEdit; }, initUI:initUI
    };
  };
})(window);
