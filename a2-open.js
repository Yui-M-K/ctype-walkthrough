/* A2 open-plan proposal (33_注文住宅格局/室內設計方案.md section 4), 3D appearance only: plan.json walls and openings stay as they are.
   The stair side wall becomes a balustrade on open treads, 2F doors get transom glass, the sauna and study walls turn into glass, two 1F doors turn into glass.
   Walls are built by the engine first; the pieces that change are moved into a "closed" group (shown while this is off) and the replacements live in an "open" group. */

/* walls whose meshes and doors are captured while the engine builds them */
const WATCH=new Set(['L1W8','L1W10','L1W11','L2W9','L2W10','L2W11','L2W13','L2W14','L2W15','L2W20','L2W21','L2W22','L2W23']);
const TRANSOM={L1W8:'clear',L2W10:'frost',L2W11:'clear',L2W14:'frost',L2W15:'frost',L2W20:'frost',L2W21:'frost',L2W22:'frost',L2W23:'frost'};
const CAP=new Map();

/* a2.html builds every wall through this: build(l, w) as before, plus a record of what it added */
export function treat(E,l,w,build){
  if(!WATCH.has(w.id)){ build(l,w); return; }
  const g=E.LG[l], n0=g.children.length, c0=E.walls.length, d0=E.doors.length;
  build(l,w);
  CAP.set(w.id,{l:l,w:w,ns:w.axis==='ns',meshes:g.children.slice(n0).filter(function(o){ return o.isMesh; }),cols:E.walls.slice(c0),doors:E.doors.slice(d0)});
}

export function create(THREE,E,C,X,H){
  const {LG,M,WM,FL,base,bx,RAIL,railBar,SH,CH}=E;
  const oakR=RAIL.oak, rod=H.mk('a2rod',0x2b2d30,{roughness:0.55,metalness:0.15});
  const OG=[new THREE.Group(),new THREE.Group()], CG=[new THREE.Group(),new THREE.Group()];
  OG.forEach(function(g,l){ g.name='a2open'+l; X.G[l].add(g); });
  CG.forEach(function(g,l){ g.name='a2closed'+l; LG[l].add(g); });
  const frostT=H.mk('a2frostT',0xf3f6f5,{transparent:true,opacity:0.62,side:THREE.DoubleSide,depthWrite:false,roughness:0.9});
  const frostW=H.mk('a2frostW',0xf0f3f2,{transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false,roughness:0.9});
  const doorG=H.mk('a2doorGlass',0xcfe8f6,{transparent:true,opacity:0.26,side:THREE.DoubleSide,depthWrite:false,roughness:0.05,metalness:0.1,envMapIntensity:1});
  const frameM=M.frame, woodD=M.a2woodD, gapM=M.a2gap;
  const state={cols:{closed:[],open:[]},doors:[],rail:null};

  /* ---- batched glass: one mesh per level and material ---- */
  const GB=new Map();
  const glass=function(l,mat,P){ const k=l+':'+mat.uuid; let b=GB.get(k); if(!b){ b={l:l,mat:mat,pos:[],idx:[]}; GB.set(k,b); }
    const n=b.pos.length/3; P.forEach(function(p){ b.pos.push(p[0],p[1],p[2]); }); b.idx.push(n,n+1,n+2,n,n+2,n+3); };
  const flushGlass=function(){ GB.forEach(function(b){
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3)); g.setIndex(b.idx); g.computeVertexNormals();
      const m=new THREE.Mesh(g,b.mat); m.renderOrder=1; m.castShadow=false; m.receiveShadow=false; OG[b.l].add(m); }); GB.clear(); };

  /* ---- wall mesh surgery ---- */
  const bbox=function(m){ const g=m.geometry; if(!g.boundingBox) g.computeBoundingBox(); const b=g.boundingBox.clone(); b.min.add(m.position); b.max.add(m.position); return b; };
  const toClosed=function(l,m){ CG[l].attach(m); };
  /* remove the along-wall ranges `cuts` from mesh m (the rest is rebuilt in the open group); clipY caps the height of what stays */
  const carve=function(cp,m,cuts,clipY){
    const bb=bbox(m), ns=cp.ns, l=cp.l, lo=ns?bb.min.x:bb.min.z, hi=ns?bb.max.x:bb.max.z;
    let segs=[[lo,hi]];
    cuts.forEach(function(c){ const nx=[]; segs.forEach(function(s){ if(c[1]<=s[0]||c[0]>=s[1]) nx.push(s); else { if(c[0]>s[0]+0.002) nx.push([s[0],c[0]]); if(c[1]<s[1]-0.002) nx.push([c[1],s[1]]); } }); segs=nx; });
    toClosed(l,m);
    const y0=bb.min.y, y1=clipY!==undefined?Math.min(bb.max.y,clipY):bb.max.y; if(y1-y0<0.005) return;
    segs.forEach(function(s){
      if(m.geometry.type==='ExtrudeGeometry'){           // sloped cap: a trapezoid under the roof
        const sh=new THREE.Shape(); sh.moveTo(s[0],y0); sh.lineTo(s[1],y0); sh.lineTo(s[1],Math.max(y0,C.ceilY(s[1]*100))); sh.lineTo(s[0],Math.max(y0,C.ceilY(s[0]*100))); sh.closePath();
        const n=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:m.geometry.parameters.options.depth,bevelEnabled:false}),m.material); n.position.copy(m.position);
        n.castShadow=m.castShadow; n.receiveShadow=m.receiveShadow; OG[l].add(n);
      } else {
        const n=ns?bx(OG[l],s[0],s[1],bb.min.z,bb.max.z,y0,y1,m.material,{cast:m.castShadow}):bx(OG[l],bb.min.x,bb.max.x,s[0],s[1],y0,y1,m.material,{cast:m.castShadow});
        n.receiveShadow=m.receiveShadow; }
    });
  };
  const alongOf=function(cp,bb){ return cp.ns?[bb.min.x,bb.max.x]:[bb.min.z,bb.max.z]; };

  /* a framed pane between along-wall a0..a1 at wall line c, from yb up to the roof line top(a): glass is batched, bars are boxes */
  const pane=function(cp,c,a0,a1,yb,top,mat,o){
    o=o||{}; const l=cp.l, ns=cp.ns, g=OG[l], D=o.d||(cp.w.t/100+0.01), F=o.f||0.035, hh=o.hh!==undefined?o.hh:0.04, bb=o.bb!==undefined?o.bb:0.04, fm=o.fm||frameM;
    const P=function(a,y){ return ns?[a,y,c]:[c,y,a]; };
    const box=function(p0,p1,y0,y1){ return ns?bx(g,p0,p1,c-D/2,c+D/2,y0,y1,fm,{cast:false}):bx(g,c-D/2,c+D/2,p0,p1,y0,y1,fm,{cast:false}); };
    glass(l,mat,[P(a0+F,yb+bb),P(a1-F,yb+bb),P(a1-F,top(a1-F)-hh),P(a0+F,top(a0+F)-hh)]);
    box(a0,a1,yb,yb+bb);
    [a0].concat(o.mull||[]).forEach(function(a){ box(a,a+F,yb,top(a)); }); box(a1-F,a1,yb,top(a1));
    if(hh>0.001){ const A=P(a0,top(a0)-hh/2), B=P(a1,top(a1)-hh/2); railBar(g,new THREE.Vector3(A[0],A[1],A[2]),new THREE.Vector3(B[0],B[1],B[2]),D,hh,fm,true); }
    if(o.rail!==undefined) box(a0,a1,o.rail,o.rail+0.03);
  };

  /* ---- 1. stair: open treads under a balustrade instead of the wall on the kitchen side (L1W10) ---- */
  (function(){
    const cp=CAP.get('L1W10'); if(!cp) return;
    cp.meshes.forEach(function(m){ toClosed(0,m); });
    state.cols.closed.push.apply(state.cols.closed,cp.cols);
    const ST=E.ST, FZ=E.flightZ(0), b=base(0), k=SH/(FZ.zs-FZ.zn), run=(FZ.zs-FZ.zn)/ST.N, xc=ST.x1-0.0125;
    const line=function(z){ return b+(FZ.zs-z)*k; }, rail=function(z){ return line(z)+0.85; };
    const xm=(ST.x0+ST.x1)/2;
    LG[0].children.slice().forEach(function(o){ if(!o.isMesh||!o.geometry.parameters) return; const p=o.geometry.parameters;
      if(o.geometry.type==='BoxGeometry'&&o.material===M.cabF&&Math.abs(p.depth-0.02)<1e-4&&Math.abs(o.position.x-xm)<1e-3&&Math.abs(p.width-(ST.x1-ST.x0-0.008))<2e-3) toClosed(0,o);   // risers
      else if(o.geometry.type==='BoxGeometry'&&o.material===WM.hall&&Math.abs(p.height-0.02)<1e-4&&o.rotation.x!==0&&Math.abs(o.position.x-xm)<1e-3) toClosed(0,o); });   // plaster soffit
    E.footLights.forEach(function(m){ if(m.parent===LG[0]) toClosed(0,m); });
    state.rail=E.railGroups.find(function(g){ return g.parent===LG[0]&&g.userData.sd===-1; })||null;
    /* balustrade on the stringer line: oak handrail, oak newels at both ends, black rods about 11 cm apart */
    const zHi=FZ.zs-0.04, zLo=4.33, g=OG[0];
    const V=function(z){ return new THREE.Vector3(xc,rail(z),z); };
    railBar(g,V(zHi),V(zLo),0.05,0.035,oakR,true);
    [zHi,zLo].forEach(function(z){ bx(g,xc-0.025,xc+0.025,z-0.025,z+0.025,b,rail(z)+0.02,E.M.oak); });
    const n=Math.round((zHi-zLo)/0.11);
    for(let i=1;i<n;i++){ const z=zHi-(zHi-zLo)*i/n, post=i%7===0, w=post?0.0125:0.006; bx(g,xc-w,xc+w,z-w,z+w,line(z)+0.2,rail(z)-0.016,rod,{cast:false}); }
    state.cols.open.push(E.addCol(0,ST.x1-0.045,ST.x1+0.03,zLo-0.02,zHi+0.03,b,b+SH+1.0,'w'));
  })();

  /* ---- 2. transom glass above doors: 2F sliding doors and the kitchen-garage door, from the door head up to the roof line (1F: ceiling) ---- */
  Object.keys(TRANSOM).forEach(function(id){
    const cp=CAP.get(id); if(!cp) return;
    const w=cp.w, l=cp.l, c=(cp.ns?w.a[0]:w.a[1])/100, yb=base(l)+2.05, spans=w.openings.filter(function(o){ return o.kind==='slide'||(l===0&&o.kind==='door'); }).map(function(o){ return [o.from/100,o.to/100]; });
    cp.meshes.forEach(function(m){ const bb=bbox(m); if(bb.min.y<yb-0.006) return; const r=alongOf(cp,bb);
      if(spans.some(function(s){ return r[1]>s[0]+0.01&&r[0]<s[1]-0.01; })) carve(cp,m,spans); });
    const top=l===0?function(){ return base(0)+CH; }:cp.ns?function(a){ return C.ceilY(a*100); }:function(){ return C.ceilY(c*100); };
    spans.forEach(function(s){ pane(cp,c,s[0],s[1],yb,top,TRANSOM[id]==='clear'?M.glass:frostT); });
  });

  /* ---- 3. sauna wall (L2W9, n600-850) facing the void: walnut battens up to 0.9 m, frosted glass above; the toilet part beside it gets battens ---- */
  (function(){
    const cp=CAP.get('L2W9'); if(!cp) return;
    const c=cp.w.a[0]/100, t=cp.w.t/100, XS=6.0, XE=8.43, yF=base(1), top=function(x){ return C.ceilY(x*100); };
    cp.meshes.forEach(function(m){ const bb=bbox(m); if(bb.max.x>XS+0.01) carve(cp,m,[[XS,99]]); });
    const g=OG[1], z1=c+t/2;
    bx(g,XS,XE,c-t/2,c+t/2,yF,yF+0.9,gapM);
    for(let x=XS+0.02;x<XE-0.04;x+=0.055) bx(g,x,x+0.035,z1,z1+0.03,yF,yF+0.9,woodD);
    bx(g,XS,XE,c-t/2-0.01,c+t/2+0.02,yF+0.9,yF+0.93,M.oak);
    pane(cp,c,XS,XE,yF+0.93,top,frostW,{d:t+0.02,hh:0.1,fm:woodD,mull:[XS+0.81,XS+1.62],rail:yF+2.15});
    const gm=new THREE.MeshBasicMaterial({color:0xffb866,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}); H.glows.push(gm);
    const gg=new THREE.BufferGeometry(); gg.setAttribute('position',new THREE.Float32BufferAttribute([XS+0.04,yF+0.96,c-0.04, XE-0.04,yF+0.96,c-0.04, XE-0.04,top(XE-0.04)-0.12,c-0.04, XS+0.04,top(XS+0.04)-0.12,c-0.04],3)); gg.setIndex([0,1,2,0,2,3]);
    const glow=new THREE.Mesh(gg,gm); glow.renderOrder=2; g.add(glow);
    /* toilet-side part: battens on the void face, floor to roof line, over the existing wall */
    const T0=4.04, T1=5.97;
    for(let x=T0;x<T1;x+=0.06) bx(g,x,x+0.035,z1,z1+0.03,yF,top(x+0.035)-0.02,woodD);
    bx(g,T0-0.02,T1+0.02,z1-0.004,z1+0.001,yF,top(T1)-0.02,gapM,{cast:false});
  })();

  /* ---- 4. study partition (L2W13): knee wall 1.0 m, clear glass above in black frames ---- */
  (function(){
    const cp=CAP.get('L2W13'); if(!cp) return;
    const c=cp.w.a[1]/100, yF=base(1), x0=c, top=function(){ return C.ceilY(c*100); };
    cp.meshes.forEach(function(m){ const bb=bbox(m); if(bb.max.y>yF+0.5) carve(cp,m,[],yF+1.0); });
    const wz0=Math.min(cp.w.a[0],cp.w.b[0])/100, wz1=Math.max(cp.w.a[0],cp.w.b[0])/100, g=OG[1];
    bx(g,c-0.065,c+0.065,wz0,wz1,yF+1.0,yF+1.035,M.oak);
    pane(cp,c,wz0+0.04,wz1-0.04,yF+1.035,top,M.glass,{d:0.05,f:0.03,hh:0.05,bb:0.03,fm:rod,mull:[(wz0+wz1)/2-0.015]});
  })();

  /* ---- 5. mirror room (L1W11): frosted fixed glass beside the door, door leaf turned into frosted glass ---- */
  (function(){
    const cp=CAP.get('L1W11'); if(!cp) return;
    const c=cp.w.a[0]/100, G0=0.6, G1=2.025;
    cp.meshes.forEach(function(m){ const bb=bbox(m), r=alongOf(cp,bb); if(r[1]>G0+0.01&&r[0]<G1-0.01) carve(cp,m,[[G0,G1]]); });
    pane(cp,c,G0,G1,base(0)+0.0,function(){ return base(0)+CH; },frostW,{d:cp.w.t/100+0.01,f:0.04,hh:0.05,bb:0.06,fm:rod,mull:[(G0+G1)/2]});
  })();
  /* ---- 6. glass leaves on the kitchen-garage door and the mirror-room door ---- */
  [['L1W8',doorG],['L1W11',frostW]].forEach(function(q){
    const cp=CAP.get(q[0]); if(!cp) return;
    cp.doors.forEach(function(d){
      const leaf=d.pv.children[0], lm=leaf.children[0], p=lm.geometry.parameters, horiz=p.width>p.depth, L=horiz?p.width:p.depth, T=Math.max(horiz?p.depth:p.width,0.04)+0.008, fr=new THREE.Group();
      fr.position.copy(lm.position);
      const bar=function(a,h,len,y){ const m=new THREE.Mesh(new THREE.BoxGeometry(horiz?len:T,h,horiz?T:len),rod); m.position.set(horiz?a:0,y,horiz?0:a); m.castShadow=false; fr.add(m); };
      bar(-L/2+0.025,p.height,0.05,0); bar(L/2-0.025,p.height,0.05,0);
      [-1,1].forEach(function(s){ bar(0,0.07,L,s*(p.height/2-0.035)); });
      leaf.add(fr);
      state.doors.push({lm:lm,fr:fr,orig:lm.material,glass:q[1],cast:lm.castShadow});
    });
  });

  flushGlass();

  /* ---- switch ---- */
  const sync=function(c,present){ const i=E.walls.indexOf(c); if(present&&i<0) E.walls.push(c); if(!present&&i>=0) E.walls.splice(i,1); };
  const api={
    apply:function(){
      const eff=X.on&&X.openOn;
      OG.forEach(function(g){ g.visible=eff; }); CG.forEach(function(g){ g.visible=!eff; });
      if(state.rail) state.rail.visible=!eff;
      state.cols.closed.forEach(function(c){ sync(c,!eff); }); state.cols.open.forEach(function(c){ sync(c,eff); });
      state.doors.forEach(function(d){ d.lm.material=eff?d.glass:d.orig; d.lm.castShadow=eff?false:d.cast; d.fr.visible=eff; });
    }
  };
  return api;
}

/* ---- building details (design plan section 3): 9 cm skirting boards and inside sills on the exterior windows; shown with the proposal ---- */
export function details(THREE,E,C,X){
  const {LG,M,base,bx}=E, hole=function(o){ return o.code==='H1'||o.code==='H2'; };
  /* skirting: every 6 cm strip the engine put on a wall face gets a 3 cm strip on top */
  [0,1].forEach(function(l){
    const b=base(l), g=X.G[l], strips=[];
    LG[l].children.forEach(function(o){ if(!o.isMesh||o.material!==M.trim||o.geometry.type!=='BoxGeometry') return; const p=o.geometry.parameters;
      if(Math.abs(p.height-0.06)<0.002&&Math.abs(o.position.y-(b+0.03))<0.002&&Math.min(p.width,p.depth)<0.02) strips.push(o); });
    strips.forEach(function(o){ const p=o.geometry.parameters; bx(g,o.position.x-p.width/2,o.position.x+p.width/2,o.position.z-p.depth/2,o.position.z+p.depth/2,b+0.06,b+0.09,M.trim,{cast:false}); });
  });
  /* sills: 12 cm deep, 3 cm thick stone boards on the room side of the plain 0.9 m windows in the 15 cm exterior walls */
  const stone=M.a2stone, cx=4.5, cz=6.16;
  [[0,C.L1],[1,C.L2]].forEach(function(q){ const l=q[0], g=X.G[l];
    q[1].walls.forEach(function(w){ if(w.t!==15) return; const ew=w.axis==='ew', c=(ew?w.a[1]:w.a[0])/100, t=w.t/100, sd=Math.sign((ew?cx:cz)-c), f0=c+sd*(t/2+0.01), f1=f0+sd*0.12, y=base(l)+0.9;
      w.openings.forEach(function(o){ if(o.kind!=='window'||hole(o)||(o.code!=='W1'&&o.code!=='O')) return; const a0=o.from/100-0.02, a1=o.to/100+0.02;
        if(ew) bx(g,Math.min(f0,f1),Math.max(f0,f1),a0,a1,y,y+0.03,stone); else bx(g,a0,a1,Math.min(f0,f1),Math.max(f0,f1),y,y+0.03,stone); }); }); });
}
