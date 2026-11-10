/* A2 咘咘: the Blender cat of ideal_c (Catalog.bubuRig) resting on the entry bench. Now and then she hops down, walks along a fixed set of
   waypoints to one of a few resting spots in the LDK and comes back; pet her for one of five reactions. Walking, hop and pet follow
   Catalog.bubu (lib/catalog.js). ?cat=0 leaves her out.
   C: {bench:{x,z,y}, nodes:{name:[x,z]}, edges:{name:[names]}, stops:{stop:node}}; the node B0 is the floor in front of the bench. */
export function create(THREE,E,C){
  if(/[?&]cat=0\b/.test(location.search)) return null;
  const {Catalog,LG}=E, TAU=Math.PI*2, cl=function(v,a,b){ return Math.max(a,Math.min(b,v)); };
  const G=new THREE.Group(); G.userData.keep=true; LG[0].add(G);
  const skipQa=function(o){ o.traverse(function(m){ m.userData.qaIgnore=true; }); };       // tools/qa: she moves around by herself, so her parts are not checked as building
  const rig=Catalog.bubuRig(1.0,{glb:Catalog.catChoice()!=='old',onGlb:function(g){ skipQa(g.S); }}); G.add(rig.group); skipQa(rig.group);
  const L=rig.loco, B=C.bench, BY=-Math.PI/2, F0=C.nodes.B0;         // on the bench she faces the room (+z)
  const toward=function(v,tg,r,dt){ return v+cl(tg-v,-r*dt,r*dt); }, angTo=function(a){ let d=a-yw; while(d>Math.PI) d-=TAU; while(d<-Math.PI) d+=TAU; return d; };
  let x=B.x, z=B.z, y=B.y, yw=BY, st='rest', tm=15+Math.random()*10, at='bench', dest=null, path=[], air=null, hidden=false, lastT=null, avoid=function(){ return {}; };
  const nodeOf=function(n){ return n==='bench'?'B0':C.stops[n]; };
  const nodePath=function(a,b){ const q=[[a]], seen={}, no=avoid().nodes||{}; seen[a]=1;                      // breadth-first over the waypoint graph
    while(q.length){ const p=q.shift(), n=p[p.length-1]; if(n===b) return p; (C.edges[n]||[]).forEach(function(m){ if(!seen[m]&&!no[m]){ seen[m]=1; q.push(p.concat([m])); } }); } return null; };
  const pickDest=function(){ const av=avoid().stops||{}, names=Object.keys(C.stops).filter(function(s){ return s!==at&&!av[s]; }); if(at!=='bench') names.push('bench');
    while(names.length){ const d=names.splice(Math.floor(Math.random()*names.length),1)[0]; if(nodePath(nodeOf(at),nodeOf(d))) return d; } return null; };
  const goTo=function(d,from){ dest=d; path=nodePath(from,nodeOf(d))||[]; };
  const jump=function(a,b,dn){ air={t:0,a:a,b:b,dn:dn}; st='air'; };
  const step=function(t){
    const dt=lastT===null?0:Math.min(0.1,t-lastT); lastT=t;
    if(!rig.busy()||st==='air'){
      if(st==='rest'){ L.gm=toward(L.gm,0,3,dt); L.gw=toward(L.gw,0,1.5,dt); tm-=dt;
        if((tm<=0||(avoid().stops||{})[at])&&!rig.busy()){ const d=pickDest(); if(!d) tm=8+Math.random()*8; else if(at==='bench'){ dest=d; st='stand'; } else { goTo(d,nodeOf(at)); st='go'; } } }
      else if(st==='stand'){ L.gw=toward(L.gw,1,2.2,dt); const da=angTo(Math.atan2(-(F0[1]-z),F0[0]-x)); yw+=cl(da,-2.5*dt,2.5*dt);
        if(L.gw>0.95&&Math.abs(da)<0.05) jump([x,y,z],[F0[0],0,F0[1]],true); }
      else if(st==='go'){
        if(dest!=='bench'&&dest!==null&&(avoid().stops||{})[dest]){ const d=pickDest(); if(d&&path.length) goTo(d,path[0]); }                 // the mode took her spot: pick another one from the next waypoint
        const tg=path.length?C.nodes[path[0]]:null;
        if(!tg){ L.gm=toward(L.gm,0,4,dt); if(L.gm<0.05){ if(dest==='bench') st='turn'; else { st='rest'; at=dest; tm=12+Math.random()*14; } } }
        else { const dx=tg[0]-x, dz=tg[1]-z, d=Math.hypot(dx,dz), da=angTo(Math.atan2(-dz,dx)); L.gw=toward(L.gw,1,2.2,dt);
          if(d<0.03) path.shift();
          else if(L.gw>0.8){ yw+=cl(da,-3*dt,3*dt); const sp=0.3*Math.max(0,Math.cos(da))*Math.min(1,d/0.15+0.3), mv=sp*dt; x+=Math.cos(yw)*mv; z-=Math.sin(yw)*mv; L.gm=toward(L.gm,Math.max(0.35,Math.min(1,sp/0.3)),3,dt); L.ph+=mv/0.32*TAU; } } }
      else if(st==='turn'){ L.gm=toward(L.gm,0,4,dt); const da=angTo(Math.atan2(-(B.z-z),B.x-x)); yw+=cl(da,-2.5*dt,2.5*dt); if(Math.abs(da)<0.05) jump([x,0,z],[B.x,B.y,B.z],false); }
      else if(st==='air'){ air.t+=dt; const W0=0.25, D=0.75, u=cl((air.t-W0)/D,0,1), e=u*u*(3-2*u), w=air.t<W0?air.t/W0:1;   // a 0.25 s wind-up on her feet, then a 0.75 s arc
        L.gw=1; L.air=1; L.wt=air.t; L.u=u; L.dn=air.dn; L.pp=air.t<W0?Math.min(1,w*3)*(1-Math.max(0,(w-0.85)/0.15)):0; L.wig=air.t<W0?0.07*Math.sin(w*Math.PI*4)*Math.sin(w*Math.PI):0; L.lp=Math.sin(Math.PI*u)*(u>0?1:0);
        x=air.a[0]+(air.b[0]-air.a[0])*e; z=air.a[2]+(air.b[2]-air.a[2])*e; y=air.a[1]+(air.b[1]-air.a[1])*e+0.3*Math.sin(Math.PI*u);
        if(u>=1){ L.lp=0; L.air=0; L.wig=0; L.pp=0; y=air.b[1]; if(air.dn){ at=''; st='go'; goTo(dest,'B0'); } else { at='bench'; st='settle'; } } }
      else if(st==='settle'){ L.gw=toward(L.gw,1,3,dt); yw+=cl(angTo(BY),-2*dt,2*dt); if(Math.abs(angTo(BY))<0.05){ st='rest'; tm=25+Math.random()*25; } }
    }
    G.position.set(x,E.base(0)+y,z); G.rotation.y=yw;
    return rig.anim(t);
  };
  const eye=new THREE.Vector3(); rig.lookAt(function(){ return eye.set(E.player.x,G.position.y+1.3,E.player.z); });
  /* pet her: one of five actions, never the same twice in a row (same as ideal_c) */
  const names={stretch:'咘咘伸了個懶腰',belly:'咘咘翻肚給你看',love:'咘咘在撒嬌',scratch:'咘咘坐起來抓頭',groom:'咘咘在理毛'}; let last=null;
  const shown=function(){ return !hidden; };
  E.furnAnims.push({live:function(){ return shown()&&E.levelOf(E.player.py)===0; },f:step});
  E.furnThings.push({obj:G,part:[rig.group],get pt(){ return [x,z]; },l:0,on:shown,label:function(){ return '摸摸咘咘'; },act:function(){
    if(st==='air'||st==='turn'||st==='stand') return; const ks=Object.keys(names).filter(function(k){ return k!==last; }), k=ks[Math.floor(Math.random()*ks.length)]; last=k;
    const v=G.worldToLocal(new THREE.Vector3(E.player.x,G.position.y,E.player.z)); rig.play(k,{yaw:cl(Math.atan2(-v.z,v.x),-1.2,1.2)}); E.toast(names[k]); }});
  step(0);
  return {group:G,rig:rig,
    hide:function(v){ hidden=v; G.visible=!v; },                           // on someone's lap: no cat on the floor
    avoid:function(f){ avoid=f; },                                            // f() -> {stops:{name:1}, nodes:{name:1}}: where she keeps away from in the current mode
    nudge:function(){ tm=0; },                                               // act at once (debug)
    state:function(){ return {st:st,at:at,dest:dest,x:x,y:y,z:z,yw:yw}; }};
}
/* menu: which 3D model she uses; kept per viewer (same key as ideal_c), ?cat=old / ?glb=N override it; choosing one reloads the page */
export function versionMenu(E){
  const box=document.getElementById('catVerBtns'), cur=E.Catalog.catChoice(); if(!box) return;
  E.Catalog.catVersions.forEach(function(c){ const b=document.createElement('button'); b.type='button'; b.className='tog'; b.textContent=c.label; b.setAttribute('aria-pressed',String(c.id===cur));
    b.addEventListener('click',function(){ try{ localStorage.setItem('idealC.v1.catVer',c.id); }catch(_){} const u=new URL(location.href); u.searchParams.delete('cat'); u.searchParams.delete('glb'); location.href=u.toString(); }); box.appendChild(b); });
}
