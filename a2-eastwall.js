/* A2 entry east wall experiment (menu: 「玄關東牆」, URL ?eastwall=0 starts with the wall removed; the default keeps the wall of the plan).
   Removed: the wall's meshes are hidden and its collision boxes dropped; a 30 cm stub stays at the north end, the floor gets a threshold strip where the stone entry floor
   meets the wood, and the entry bench moves from the east wall to the north wall beside the stub (hooks and the cat's resting place follow). Engine metres: x = n / 100, z = e / 100. */
export function create(THREE,E,C){
  const {LG,M,WM,bx,CH}=E, G=new THREE.Group(); G.name='a2eastwall'; LG[0].add(G);
  const cap=C.cap, gen=C.gen, ZW=7.95;                         // wall centre line (e 795); the wall is 10 cm thick
  cap.meshes.forEach(function(m){ cap.group.attach(m); });     // the wall's pieces live in their own group so they can be switched
  const stub=new THREE.Group(); G.add(stub);
  bx(stub,8.2,8.45,ZW-0.05,ZW+0.05,-0.15,CH-0.005,WM.hall||M.cabF);                                  // 30 cm stub against the north wall
  const stubCol=E.addCol(0,8.2,8.45,ZW-0.05,ZW+0.05,-0.15,CH,'w'); E.walls.splice(E.walls.indexOf(stubCol),1);
  const thr=new THREE.Group(); G.add(thr);
  E.rbox(thr,6.94,8.2,ZW-0.05,ZW+0.01,-0.15,0.006,0.008,M.oak);                                      // 上がり框: the oak edge continues round the corner along the opened side (top flush with the wood floor)
  stub.visible=thr.visible=false;
  const keys=E.FS.movers.find(function(q){ return q.id==='keys'; }), keyCols=keys?E.furnCols.filter(function(c){ return c.l===0&&c.z0>7.8&&c.z1<8.1&&c.x0>7.8&&c.x1<8.2; }):[];   // the key rack hangs on the east wall
  const X={removed:false,stub:stub};
  if(keys){ const prev=keys.onApply; keys.onApply=function(a,b){ if(prev) prev(a,b); if(X.removed) keys.W.visible=false; }; }   // the furniture system re-applies its own visibility: keep the rack hidden while the wall is away
  X.set=function(rem){
    X.removed=rem; cap.group.visible=!rem; stub.visible=thr.visible=rem;
    const del=function(c){ const i=E.walls.indexOf(c); if(i>=0) E.walls.splice(i,1); }, add=function(c){ if(E.walls.indexOf(c)<0) E.walls.push(c); };
    cap.cols.forEach(function(c){ (rem?del:add)(c); }); (rem?add:del)(stubCol);
    gen.east.group.visible=!rem; gen.north.group.visible=rem; (rem?del:add)(gen.east.col); (rem?add:del)(gen.north.col);
    if(C.cat){ const f=rem?[gen.northSeat[0]-0.47,gen.northSeat[1]]:[C.east[0],C.east[1]-0.47]; C.cat.setBench(rem?gen.northSeat[0]:C.east[0],rem?gen.northSeat[1]:C.east[1],f); }
    if(keys){ keys.W.visible=!rem; keyCols.forEach(function(c){ const i=E.furnCols.indexOf(c); if(rem&&i>=0) E.furnCols.splice(i,1); if(!rem&&i<0) E.furnCols.push(c); }); }
    E.rebuild(); E.renderer.shadowMap.needsUpdate=true;
  };
  const host=document.getElementById('tCurt');
  if(host){ const b=document.createElement('button'); b.type='button'; b.id='tEastWall'; b.className='tog'; b.textContent='玄關東牆拆除（試作）'; b.style.gridColumn='1/-1'; b.setAttribute('aria-pressed','false');
    host.parentNode.appendChild(b); b.addEventListener('click',function(){ const r=b.getAttribute('aria-pressed')!=='true'; b.setAttribute('aria-pressed',String(r)); X.set(r); }); X.button=b; }
  let start=false; try{ start=new URLSearchParams(location.search).get('eastwall')==='0'; }catch(_){}
  if(start){ X.set(true); if(X.button) X.button.setAttribute('aria-pressed','true'); }
  window.__a2EastWall=X;
  return X;
}
