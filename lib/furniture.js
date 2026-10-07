/* Shared furniture system: every furniture set lives in a wrapper (W at its pivot, G offset back) so code that uses absolute
   coordinates keeps working. Provides move / rotate / store-in-library, collision-aware dragging, thumbnails and persistence.
   Knows nothing about a particular house: everything house-specific comes in through `host`. */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  const TAU=Math.PI*2;
  const $=function(id){ return document.getElementById(id); };
  function visibleChain(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }

  /* host (core): THREE, furn (THREE.Group), furnCols (array of {x0,x1,z0,z1,kind}), storageKey, variant() -> current layout id, refreshShadows() */
  Walk.FurnitureSystem=function(host){
    const THREE=host.THREE, furn=host.furn, furnCols=host.furnCols;
    const MV_KEY=host.storageKey, movers=[], mvStack=[];
    let mvSaved={}, mvEdit=false, mvSel=null, mvDrag=null;
    try{ mvSaved=JSON.parse(localStorage.getItem(MV_KEY))||{}; }catch(_){ mvSaved={}; }
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
      furn.add(W);
      const m={id:id,label:label,W:W,G:G,own:cols,pose:!!o.pose,colsFn:o.colsFn||null,pivotFn:o.pivotFn||null,onApply:o.onApply||null,pv:[0,0]};
      W.userData.mv=m;
      if(!m.pose){
        cols.forEach(function(c){ if(!c.mb) c.mb={x0:c.x0,x1:c.x1,z0:c.z0,z1:c.z1}; });
        if(cols.length) m.pv=mvCenter(cols);
        else { G.updateMatrixWorld(true); const c=new THREE.Box3().setFromObject(G).getCenter(new THREE.Vector3()); m.pv=[c.x,c.z]; }
      }
      movers.push(m); return m;
    }
    function mvKey(m){ return (m.pose||m.perLayout)?m.id+'@'+host.variant():m.id; }
    function mvGet(m){ return mvSaved[mvKey(m)]||(m.defOff?{dx:0,dz:0,rot:0,off:1}:{dx:0,dz:0,rot:0}); }
    function mvIsStored(id){ const m=movers.find(function(q){ return q.id===id; }); return !!(m&&mvGet(m).off); }
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
      m.W.position.set(px+s.dx,0,pz+s.dz); m.W.rotation.y=s.rot*Math.PI/2; m.G.position.set(-px,0,-pz);
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

    /* host (UI): scene, camera, canvas, orb {tx,tz,...}, uiRoot (element), toggleButton (element), allCols(), rebuild(), toast(msg), inside(x,z),
       getMode(), setMode(m), closeMenu(), pointerCount(), onEditToggle(on), onChange() */
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
      function mvSave(){ try{ localStorage.setItem(MV_KEY,JSON.stringify(mvSaved)); }catch(_){} }
      function mvUpdateHelper(){
        if(!mvSel||!visibleChain(mvSel.W)){ mvHelper.visible=false; return; }
        mvSel.W.updateMatrixWorld(true); mvHelper.box.setFromObject(mvSel.W); mvHelper.visible=true;
      }
      function mvUi(){
        $('eRot').disabled=!mvSel; $('eReset').disabled=!mvSel; $('eStore').disabled=!mvSel;
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
        const cx=m.pv[0]+s.dx, cz=m.pv[1]+s.dz;
        if(!h.inside(cx,cz)) return false;
        const own=mvCols(m), oth=h.allCols().filter(function(c){ return own.indexOf(c)<0&&!(ign&&ign.has(c)); });
        for(let i=0;i<own.length;i++){ const r=mvRect(own[i].mb,m.pv[0],m.pv[1],s); for(let j=0;j<oth.length;j++) if(mvOverlap(r,oth[j])) return false; }
        return true;
      }
      function mvIgnore(m){                          // things the set already overlaps in its starting position are not treated as obstacles
        const s=mvGet(m), own=mvCols(m), ign=new Set();
        own.forEach(function(c){ const r=mvRect(c.mb,m.pv[0],m.pv[1],s); h.allCols().forEach(function(o){ if(own.indexOf(o)<0&&mvOverlap(r,o)) ign.add(o); }); });
        return ign;
      }
      function mvCommit(m,s){ mvSaved[mvKey(m)]={dx:s.dx,dz:s.dz,rot:s.rot}; mvApply(m); mvUpdateHelper(); }
      function mvMove(m,tdx,tdz,ign){                // walk toward the target in 2 cm steps; on a hit, slide along the free axis
        const s0=mvGet(m), n=Math.max(1,Math.ceil(Math.hypot(tdx-s0.dx,tdz-s0.dz)/0.02)); let last={dx:s0.dx,dz:s0.dz,rot:s0.rot};
        for(let i=1;i<=n;i++){
          const t=i/n, c={dx:s0.dx+(tdx-s0.dx)*t,dz:s0.dz+(tdz-s0.dz)*t,rot:s0.rot};
          if(mvFits(m,c,ign)){ last=c; continue; }
          const cx={dx:c.dx,dz:last.dz,rot:s0.rot}, cz={dx:last.dx,dz:c.dz,rot:s0.rot};
          if(mvFits(m,cx,ign)) last=cx; else if(mvFits(m,cz,ign)) last=cz; else break;
        }
        mvCommit(m,last);
      }
      function mvRotate(){
        const m=mvSel; if(!m) return;
        const s=mvGet(m), rot=(s.rot+1)%4, ign=mvIgnore(m), tries=[[0,0]];
        for(let r=0.05;r<=0.4;r+=0.05) [[r,0],[-r,0],[0,r],[0,-r]].forEach(function(t){ tries.push(t); });
        for(let i=0;i<tries.length;i++){ const c={dx:s.dx+tries[i][0],dz:s.dz+tries[i][1],rot:rot}; if(mvFits(m,c,ign)){ mvCommit(m,c); mvSave(); mvSyncPeople(); return; } }
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
      function mvMakeThumbs(list){
        let r=null;
        try{
          r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); r.setPixelRatio(1); r.setSize(144,144);
          r.outputEncoding=THREE.sRGBEncoding; r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.1; r.localClippingEnabled=true;
          list.forEach(function(m){
            const sc=new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff,0xc9b99f,1.5)); const d=new THREE.DirectionalLight(0xffffff,1.3); d.position.set(3,6,4); sc.add(d);
            const keep=m.W.userData.mv; delete m.W.userData.mv;
            const c=m.W.clone(true); m.W.userData.mv=keep;
            c.position.set(0,0,0); c.rotation.set(0,0,0); c.visible=true;
            c.traverse(function(o){ if(o.renderOrder===1) o.visible=false; });   // drop the floor shadow decals
            sc.add(c); c.updateMatrixWorld(true);
            const b=new THREE.Box3().setFromObject(c), ctr=b.getCenter(new THREE.Vector3()), sz=b.getSize(new THREE.Vector3());
            const rad=Math.max(sz.x,sz.z,sz.y)*0.5+0.05, cam=new THREE.PerspectiveCamera(30,1,0.1,60), dist=rad/Math.tan(15*Math.PI/180)*1.12;
            cam.position.set(ctr.x+dist*0.55,ctr.y+dist*0.62,ctr.z+dist*0.75); cam.lookAt(ctr);
            r.render(sc,cam); mvThumbs[m.id]=r.domElement.toDataURL('image/png');
          });
        }catch(e){ list.forEach(function(m){ if(!mvThumbs[m.id]) mvThumbs[m.id]=''; }); }
        finally{ if(r){ r.dispose(); try{ r.forceContextLoss(); }catch(_){} } }
      }
      function mvLibRefresh(){
        const box=$('lib'); box.hidden=!mvEdit; if(!mvEdit) return;
        const list=$('libList'); list.textContent='';
        const items=movers.filter(function(m){ return mvGet(m).off&&mvLayOk(m); });
        $('libHead').textContent='物品庫（'+items.length+'）';
        if(!items.length){ const e=document.createElement('div'); e.className='libEmpty'; e.textContent='目前是空的。選取家具按「收回物品庫」，就會收到這裡'; list.appendChild(e); return; }
        const need=items.filter(function(m){ return mvThumbs[m.id]===undefined; }); if(need.length) mvMakeThumbs(need);
        items.forEach(function(m){
          const card=document.createElement('div'); card.className='libCard';
          const img=document.createElement('img'); img.alt=''; if(mvThumbs[m.id]) img.src=mvThumbs[m.id]; card.appendChild(img);
          const t=document.createElement('span'); t.textContent=m.label; card.appendChild(t);
          card.addEventListener('pointerdown',function(e){ libDrag={m:m,x:e.clientX,y:e.clientY,moved:false,id:e.pointerId}; });
          list.appendChild(card);
        });
      }
      let libDrag=null; const libGhost=$('libGhost');
      window.addEventListener('pointermove',function(e){
        if(!libDrag||e.pointerId!==libDrag.id) return;
        if(!libDrag.moved&&Math.hypot(e.clientX-libDrag.x,e.clientY-libDrag.y)>10){ libDrag.moved=true; libGhost.src=mvThumbs[libDrag.m.id]||''; libGhost.hidden=false; }
        if(libDrag.moved){ libGhost.style.left=e.clientX+'px'; libGhost.style.top=e.clientY+'px'; }
      });
      function libEnd(e,cancel){
        if(!libDrag||e.pointerId!==libDrag.id) return;
        const d=libDrag; libDrag=null; libGhost.hidden=true; if(cancel) return;
        if(!d.moved){ mvTakeOut(d.m,orb.tx,orb.tz); return; }
        const el=document.elementFromPoint(e.clientX,e.clientY); if(el&&el.closest('#lib')) return;
        mvNdc(e); mvPlane.constant=0; const p=new THREE.Vector3();
        if(mvRay.ray.intersectPlane(mvPlane,p)) mvTakeOut(d.m,p.x,p.z);
      }
      window.addEventListener('pointerup',function(e){ libEnd(e,false); });
      window.addEventListener('pointercancel',function(e){ libEnd(e,true); });
      function mvTakeOut(m,wx,wz){                   // centre the piece on the drop point; if that is blocked, look outward for the nearest free spot
        const tries=[[0,0]]; for(let r=0.12;r<=3;r+=0.12) for(let k=0;k<16;k++) tries.push([Math.cos(k/16*TAU)*r,Math.sin(k/16*TAU)*r]);
        for(let i=0;i<tries.length;i++){
          const s={dx:wx+tries[i][0]-m.pv[0],dz:wz+tries[i][1]-m.pv[1],rot:0};
          if(mvFits(m,s,null)){
            mvSaved[mvKey(m)]={dx:s.dx,dz:s.dz,rot:0}; mvApply(m); h.rebuild();
            mvSel=m; mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); return true;
          }
        }
        h.toast('放不下，先清出一些空間'); return false;
      }
      function mvStore(m){
        if(!m) return;
        mvSaved[mvKey(m)]={dx:0,dz:0,rot:0,off:1}; mvApply(m); h.rebuild();
        mvSel=null; mvDrag=null; mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); h.toast('已收進物品庫：'+m.label);
      }
      $('eStore').addEventListener('click',function(){ mvStore(mvSel); });
      if(h.toggleButton) h.toggleButton.addEventListener('click',function(){ mvSetEdit(!mvEdit); });
      $('eDone').addEventListener('click',function(){ mvSetEdit(false); h.setMode('walk'); });
      $('eRot').addEventListener('click',mvRotate);
      $('eReset').addEventListener('click',function(){ if(!mvSel) return; delete mvSaved[mvKey(mvSel)]; mvApply(mvSel); h.rebuild(); mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); });
      $('eAll').addEventListener('click',function(){ mvSaved={}; movers.forEach(mvApply); h.rebuild(); mvSel=null; mvUpdateHelper(); mvUi(); mvLibRefresh(); mvSave(); mvSyncPeople(); h.toast('家具已全部還原'); });

      mvUi(); mvLibRefresh();
      return {
        setEdit:mvSetEdit, libRefresh:mvLibRefresh, rotate:mvRotate, store:mvStore, takeOut:mvTakeOut,
        select:function(id){ mvSel=movers.find(function(q){ return q.id===id; })||null; mvUpdateHelper(); mvUi(); },
        variantChanged:function(){ mvSel=null; mvUpdateHelper(); mvUi(); movers.forEach(mvApply); mvLibRefresh(); },
        isDragging:function(){ return !!mvDrag; },
        screen:function(id){ const m=movers.find(function(q){ return q.id===id; }), s=mvGet(m), v=new THREE.Vector3(m.pv[0]+s.dx,0.5,m.pv[1]+s.dz).project(camera), r=canvas.getBoundingClientRect(); return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]; }
      };
    }

    return {
      movers:movers, begin:mvBegin, end:mvEnd, wrap:mvWrap, apply:mvApply, get:mvGet, xf:mvXf, isStored:mvIsStored,
      saved:function(){ return mvSaved; }, isEditing:function(){ return mvEdit; }, initUI:initUI
    };
  };
})(window);
