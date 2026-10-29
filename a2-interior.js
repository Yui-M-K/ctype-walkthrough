/* A2 interior proposal (see 33_注文住宅格局/室內設計方案.md): plaster palette, accent walls, oak floor, curtains, furnishing, living-room TV wall and double-height ceiling, long desk.
   Plan frame: (e, n) cm; engine x = n / 100, engine z = e / 100. Everything can be switched off from the menu (「室內提案」): walls and floors swap material, the rest sits in per-storey groups. */

/* accent wall role -> the colour it falls back to while the proposal is off (the role of the room it belongs to) */
const ACCENT_ROLE={sage:'oat',a2kid:'oat'};
export const ACCENTS=[
  {l:1,x0:301,x1:325,y0:65,y1:275,w:'sage'},      // master bedroom, south wall
  {l:1,x0:251,x1:275,y0:957,y1:1167,w:'a2kid'}    // child room, wall behind the bed and desk
];
/* wall palette while the proposal is on (design plan section 1) */
const SLAB_ON=0xe6dfd2;
const WALL_ON={oat:0xe7ddcb,hall:0xe5dbc9,utility:0xe6ddcd,genkan:0xddd2c0,peach:0xe8d4c2,wc:0xe0ded6,dress:0xe6dfd3,mist:0xd4d0c6,sage:0xa3b39d,a2kid:0xe2c0a8};

/* curtains in the engine's format: [storey, wall side, a, b, wall line, auto, {color}, {off, top, bottom}] (plan x = n, y = e) */
export function curtains(){
  const ivory={color:0xf3ede2};
  return [
    [0,'S',320,510,1167,false,ivory],
    [0,'S',560,780,1262,false,ivory,{off:0.1,top:2.08,bottom:0.43,noSheer:true}],
    [0,'S',70,260,1167,false,ivory],
    [0,'W',827,1107,50,false,ivory],
    [1,'N',400,750,65,false,{color:0xc9d2c2}],
    [1,'W',65,275,300,false,{color:0xc9d2c2}],
    [1,'E',107,237,850,false,{color:0xc9d2c2}],
    [1,'S',310,500,1167,false,ivory],
    [1,'S',70,230,1167,false,ivory],
    [1,'W',867,1127,50,false,ivory]
  ];
}


const rng=function(seed){ let s=seed|0||1; return function(){ s^=s<<13; s^=s>>>17; s^=s<<5; return ((s>>>0)%100000)/100000; }; };
function canvasTex(THREE,w,h,draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; t.colorSpace=THREE.SRGBColorSpace; return t;
}
/* cedar ceiling boards: 4 boards of 12 cm across u, grain along v */
function cvCedar(THREE){
  return canvasTex(THREE,512,512,function(g,w,h){
    const r=rng(7), bw=w/4;
    for(let i=0;i<4;i++){ g.fillStyle='hsl('+(28+r()*4)+','+(30+r()*6)+'%,'+(58+r()*5)+'%)'; g.fillRect(i*bw,0,bw,h);
      for(let k=0;k<46;k++){ g.strokeStyle='rgba('+(90+r()*30|0)+',50,22,'+(0.05+r()*0.1)+')'; g.lineWidth=0.6+r()*1.4; const x=i*bw+4+r()*(bw-8); g.beginPath(); g.moveTo(x,0); g.bezierCurveTo(x+(r()-0.5)*10,h*0.3,x+(r()-0.5)*10,h*0.7,x+(r()-0.5)*6,h); g.stroke(); } }
    g.fillStyle='rgba(60,32,14,0.75)'; for(let i=0;i<4;i++) g.fillRect(i*bw,0,2.5,h);
  });
}
/* dark walnut for battens and beams: grain along v */
function cvWoodDark(THREE){
  return canvasTex(THREE,256,512,function(g,w,h){
    const r=rng(3); g.fillStyle='hsl(22,34%,24%)'; g.fillRect(0,0,w,h);
    for(let k=0;k<150;k++){ g.strokeStyle='rgba('+(r()<0.5?'20,10,4':'120,76,40')+','+(0.06+r()*0.12)+')'; g.lineWidth=0.5+r()*1.6; const x=r()*w; g.beginPath(); g.moveTo(x,0); g.bezierCurveTo(x+(r()-0.5)*14,h*0.3,x+(r()-0.5)*14,h*0.7,x+(r()-0.5)*8,h); g.stroke(); }
  });
}
/* soft gradient for light washes: bright at v = 1 (the lit edge), fading to 0 */
function cvWash(THREE){
  const c=document.createElement('canvas'); c.width=4; c.height=128; const g=c.getContext('2d'), gr=g.createLinearGradient(0,128,0,0);
  [[0,1],[0.12,0.7],[0.35,0.3],[0.65,0.08],[1,0]].forEach(function(q){ gr.addColorStop(q[0],'rgba(255,255,255,'+q[1]+')'); }); g.fillStyle=gr; g.fillRect(0,0,4,128);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* runs before the house is built: accent roles must exist when the walls pick their materials */
const ORIG={};
export function materials(E){
  Object.keys(ACCENT_ROLE).forEach(function(k){ if(!E.WM[k]) E.WM[k]=E.WM.oat.clone(); });
  Object.keys(WALL_ON).forEach(function(k){ if(ORIG[k]===undefined) ORIG[k]=E.WM[k].color.getHex(); });
  ORIG.slab=E.M.slab.color.getHex();
}

export function create(THREE,E,C){
  const {FL,WM,M,LG,base,bx,Catalog,FIN}=E;
  const X={pieces:[],on:true,mats:[],cols:[],groups:[],hidden:[],things:[],orig:{},glows:[]};

  /* ---- wall roles: new roles are copies of oat so the engine's plaster normal map reaches them ---- */
  const wallState=function(on){
    FIN.paint(M.slab,on?SLAB_ON:ORIG.slab);
    Object.keys(WALL_ON).forEach(function(k){
      const off=ACCENT_ROLE[k]?ORIG.oat:ORIG[k];
      FIN.paint(WM[k],on?WALL_ON[k]:off); });
  };

  /* ---- swapped materials: [new, old]; floors are one oak per original so the pairs stay one to one after the engine merges meshes ---- */
  const swap=function(nw,old){ X.mats.push([nw,old]); return nw; };
  const oakFloor=function(old,key){
    const m=old.clone(); m.color.setHex(0xffffff); m.userData=Object.assign({},old.userData);
    FIN.pbrMaps(m,'oak_planks',1.2/1.818,1.2/0.909,{roughness:1.1,normalScale:0.7,color:0xf3e6d0});
    FL[key]=m; return swap(m,old); };
  const FLOORS=new Map([[FL.wood,oakFloor(FL.wood,'a2oak')],[FL.woodD,oakFloor(FL.woodD,'a2oakD')]]);
  const replaceMat=function(root,map){
    root.traverse(function(o){ if(!o.isMesh) return;
      if(Array.isArray(o.material)){ o.material=o.material.map(function(m){ return map.get(m)||m; }); }
      else if(map.has(o.material)) o.material=map.get(o.material); }); };
  [LG[0],LG[1]].forEach(function(g){ replaceMat(g,FLOORS); });

  /* ---- per-storey group for everything the proposal adds ---- */
  const G=[new THREE.Group(),new THREE.Group()];
  G.forEach(function(g,l){ g.name='a2interior'+l; LG[l].add(g); });
  /* zones: merged meshes stay a few metres wide, so the engine can still skip what is out of view */
  const ZG=new Map();
  const Z=function(l,x,z){ const k=l+':'+Math.floor(x/2.5)+':'+Math.floor(z/3); let g=ZG.get(k); if(!g){ g=new THREE.Group(); G[l].add(g); ZG.set(k,g); } return g; };
  const B=function(l,mat,x0,x1,z0,z1,y0,y1,o){ return bx(Z(l,(x0+x1)/2,(z0+z1)/2),x0,x1,z0,z1,base(l)+y0,base(l)+y1,mat,o); };
  const col=function(l,x0,x1,z0,z1,y0,y1){ const c=E.addCol(l,x0,x1,z0,z1,base(l)+y0,base(l)+y1,'x'); X.cols.push(c); return c; };
  /* a catalogue piece at plan (e, n) facing a compass side of the engine (N = -z, S = +z, E = +x, W = -x) */
  const put=function(l,type,e,n,face,piece,o){
    o=o||{}; const p=piece||Catalog.make(type), q=Catalog.turnsToFace(type,face||'E');
    const n0=E.walls.length, Rg=E.fixture(l,p,n/100,e/100,q); if(o.y) Rg.position.y+=o.y; if(o.scale) p.group.scale.setScalar(o.scale);
    G[l].add(Rg); X.pieces.push([l,Rg]); for(let i=n0;i<E.walls.length;i++) X.cols.push(E.walls[i]); return Rg; };


  /* ---- shared materials of the proposal (named in E.M so the engine never merges them into look-alikes) ---- */
  const mk=function(key,hex,o){ const m=E.lam(hex,o); M[key]=m; return m; };
  const stoneM=mk('a2stone',0xd6d0c6,{roughness:0.38,envMapIntensity:0.8}); FIN.pbrMaps(stoneM,'stone_tv',1.6,1.6,{normal:false,rough:false,color:0xd6d0c6});
  const blackM=mk('a2black',0xc8c8c8,{roughness:0.22,envMapIntensity:1.1}); FIN.pbrMaps(blackM,'stone_black',1.2,1.2,{normal:false,rough:false,color:0xc8c8c8});
  mk('a2fan',0xcfa77c,{roughness:0.55});
  const woodD=mk('a2woodD',0xffffff,{roughness:0.6,envMapIntensity:0.4,map:cvWoodDark(THREE)}); woodD.map.repeat.set(2,1);
  const cedarM=mk('a2cedar',0xffffff,{roughness:0.75,envMapIntensity:0.3,map:cvCedar(THREE)});
  const gapM=mk('a2gap',0x1c1a18,{roughness:0.8});
  const backM=new THREE.MeshBasicMaterial({color:0x5a3818}); M.a2back=backM;
  const metalM=mk('a2metal',0xc9cbcc,{roughness:0.35,metalness:0.8,envMapIntensity:1});
  const washTex=cvWash(THREE), glows=[];
  /* additive light wash on a wall: plane at x facing -x (or +x), bright edge at y0, fading along `len` (up if len > 0, down if < 0) */
  const wash=function(l,x,face,z0,z1,y0,len,col){
    const m=new THREE.MeshBasicMaterial({map:washTex,color:col||0xffc98f,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const g=new THREE.Mesh(new THREE.PlaneGeometry(z1-z0,Math.abs(len)),m); g.rotation.y=face>0?Math.PI/2:-Math.PI/2; if(len<0) g.rotation.z=Math.PI;
    g.position.set(x,base(l)+y0+len/2,(z0+z1)/2); g.renderOrder=2; Z(l,x,(z0+z1)/2).add(g); glows.push(m); return g; };

  /* ---- living room: TV wall (stone slab, walnut battens with a glow behind, black marble board) ---- */
  (function(){
    const XW=C.NWALL/100-0.075, Z0=8.2, Z1=11.2, H=2.55, TOP=H+0.11;
    B(0,gapM,XW-0.014,XW,Z0,Z1,0,H);
    [[Z0,Z0+1.2],[Z0+1.2,Z0+2.4],[Z0+2.4,Z1]].forEach(function(q,i){
      const m=B(0,stoneM,XW-0.028,XW-0.014,q[0]+0.002,q[1]-0.002,0,H-0.003); const uv=m.geometry.attributes.uv; for(let k=0;k<uv.count;k++) uv.setXY(k,uv.getX(k)+i*0.37,uv.getY(k)+i*0.21); });
    [[7.8,Z0],[Z1,11.59]].forEach(function(q){
      B(0,backM,XW-0.014,XW,q[0],q[1],0,H);
      for(let z=q[0]+0.015;z<q[1]-0.02;z+=0.05) B(0,woodD,XW-0.044,XW-0.014,z,z+0.03,0,H); });
    B(0,woodD,XW-0.044,XW,7.8,11.59,H,TOP);
    wash(0,XW-0.004,-1,8.37,11.59,TOP,1.3);
  })();
  /* the TV board becomes black marble */
  (function(){
    const mv=E.FS.movers.find(function(q){ return q.id==='tv'; }); if(!mv) return;
    const olds=new Set(); mv.piece.group.traverse(function(o){ if(o.isMesh&&!Array.isArray(o.material)&&o.material.color&&o.material.color.getHex()===0xd9bf96) olds.add(o.material); });
    const own=new Map(); olds.forEach(function(o){ own.set(o,o.clone()); });   // the board's oak is shared with other pieces: give the TV its own copy first
    if(own.size){ replaceMat(mv.piece.group,own); own.forEach(function(c){ const bm=E.lam(0xc8c8c8,{roughness:0.22,envMapIntensity:1.1}); FIN.pbrMaps(bm,'stone_black',1.2,1.2,{normal:false,rough:false,color:0xc8c8c8}); M['a2black'+X.mats.length]=bm; swap(bm,c); }); const map=new Map(); X.mats.slice(-own.size).forEach(function(p){ map.set(p[1],p[0]); }); replaceMat(mv.piece.group,map); }
  })();

  /* ---- double-height ceiling: cedar boards under the roof slope, three walnut beams, a ceiling fan ---- */
  (function(){
    const ZY=function(x){ return C.ceilY(x*100); };
    C.VOIDS.forEach(function(q){
      const x0=q[1]/100, x1=q[3]/100, z0=q[0]/100, z1=q[2]/100, ya=ZY(x0)-0.005, yb=ZY(x1)-0.005, g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute([x0,ya,z0, x1,yb,z0, x1,yb,z1, x0,ya,z1],3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute([x0/0.48,z0, x1/0.48,z0, x1/0.48,z1, x0/0.48,z1],2));
      g.setIndex([0,1,3,1,2,3]); g.computeVertexNormals();
      const m=new THREE.Mesh(g,cedarM); Z(0,(x0+x1)/2,(z0+z1)/2).add(m); });
    const ZW0=8.37, ZW1=11.595;
    [5.5,6.6,7.7].forEach(function(x){ B(0,woodD,x-0.075,x+0.075,ZW0,ZW1,ZY(x)-0.31,ZY(x+0.075)+0.02); });
    /* fan: rod, motor, three blades, light disc */
    const fx=5.9, fz=10.0, yc=ZY(fx), rod=1.7, fg=new THREE.Group(); fg.position.set(fx,yc-rod,fz);
    const part=function(geo,mat,x,y,z,ry){ const o=new THREE.Mesh(geo,mat); o.position.set(x,y,z); if(ry) o.rotation.y=ry; o.castShadow=false; fg.add(o); return o; };
    part(new THREE.CylinderGeometry(0.008,0.008,rod,6),M.dark,0,rod/2,0); part(new THREE.CylinderGeometry(0.1,0.12,0.14,20),M.dark,0,-0.07,0);
    for(let i=0;i<3;i++){ const a=i*Math.PI*2/3, b=part(new THREE.BoxGeometry(0.58,0.012,0.14),M.a2fan,Math.cos(a)*0.4,-0.12,-Math.sin(a)*0.4,a); }
    part(new THREE.CylinderGeometry(0.1,0.1,0.02,20),E.lampMat,0,-0.16,0);
    Z(0,fx,fz).add(fg);
  })();

  /* long pendant over the lift table; the old shade is hidden while the proposal is on (its light stays) */
  (function(){
    const px=7.0, pz=9.7, len=1.6, y=2.3, yc=C.ceilY(px*100);
    B(0,metalM,px-0.035,px+0.035,pz-len/2,pz+len/2,y,y+0.07); B(0,E.lampMat,px-0.028,px+0.028,pz-len/2+0.03,pz+len/2-0.03,y-0.012,y);
    [-0.6,0.6].forEach(function(d){ B(0,M.dark,px-0.003,px+0.003,pz+d-0.003,pz+d+0.003,y+0.07,yc); });
  })();

  /* ---- 1F ---- */
  put(0,'doormat',707,815,'N'); put(0,'umbrellaStand',772,838,'N');
  put(0,'rugRound',969,665,'E',Catalog.roundRug(1.25,'plain',24,0,false));
  put(0,'floorLamp',1105,700,'E');
  put(0,'artLand',915,308,'E',null,{}); put(0,'artLand',1045,308,'E',null,{}); put(0,'wallClock',980,308,'E');
  put(0,'rugBed',960,170,'E',null,{}); put(0,'plant',1135,272,'E',Catalog.plant(0.75));
  /* ---- 2F ---- */
  put(1,'rugBed',162,610,'E',null,{scale:0.9}); put(1,'plantS',92,808,'E');
  put(1,'rugRound',1010,420,'E',Catalog.roundRug(0.9,'plain',24,0,false)); put(1,'plantS',1135,262,'E');
  put(1,'rugRoundSun',990,175,'E'); put(1,'plantS',870,230,'E');

  /* static pieces lose their own groups so the engine merges the whole proposal per material (a few draw calls instead of one set per piece) */
  X.finish=function(){
    const named=new Set(); [M,FL,WM].forEach(function(o){ Object.keys(o).forEach(function(k){ if(o[k]&&o[k].isMaterial) named.add(o[k]); }); });
    Walk.Perf.shareMaterials(G,named);
    X.pieces.forEach(function(q){ const Rg=q[1]; if(Rg.userData.keep) return; Rg.updateMatrixWorld(true);
      const ms=[], zg=Z(q[0],Rg.position.x,Rg.position.z); Rg.traverse(function(o){ if(o.isMesh) ms.push(o); }); ms.forEach(function(m){ zg.attach(m); }); });
  };

  /* light washes follow the engine's cove: soft by day, full at night, off while everyone sleeps */
  const glowTick=function(){ let h; try{ h=E.hour; }catch(_){ return; } const night=h>=16.5||h<6.5, o=E.sleepOn?0:(h>=18.5?0.75:night?0.55:0.22); glows.forEach(function(m){ m.opacity=X.on?o:0; }); };
  setInterval(glowTick,400);
  X.glowTick=glowTick;
  let oldPendant=[];
  X.late=function(){ E.lightFixtures.forEach(function(g){ if(g.userData.a2Pendant) g.children.forEach(function(c){ if(c.isMesh) oldPendant.push(c); }); });
    X.hidden.push(function(on){ oldPendant.forEach(function(c){ c.visible=!on; }); }); };

  /* curtains are built by the engine from H.curtains after this runs: collect them once the house is complete */
  let curtainRoots=[], curtainThings=[];
  X.collectCurtains=function(){ curtainRoots=E.curtainSets.map(function(P){ return P.group.parent; }).filter(Boolean);
    curtainThings=E.furnThings.filter(function(t){ return curtainRoots.indexOf(t.obj)>=0; }); };

  /* ---- switch ---- */
  X.set=function(on){
    X.on=on; wallState(on);
    const inv=new Map(); X.mats.forEach(function(p){ inv.set(on?p[1]:p[0],on?p[0]:p[1]); });
    E.scene.traverse(function(o){ if(!o.isMesh) return;
      if(Array.isArray(o.material)){ o.material=o.material.map(function(m){ return inv.get(m)||m; }); }
      else if(inv.has(o.material)) o.material=inv.get(o.material); });
    G.forEach(function(g){ g.visible=on; });
    curtainRoots.forEach(function(r){ r.visible=on; });
    curtainThings.forEach(function(t){ const i=E.furnThings.indexOf(t); if(on&&i<0) E.furnThings.push(t); if(!on&&i>=0) E.furnThings.splice(i,1); });
    X.cols.forEach(function(c){ const i=E.walls.indexOf(c); if(on&&i<0) E.walls.push(c); if(!on&&i>=0) E.walls.splice(i,1); });
    X.hidden.forEach(function(h){ h(on); }); if(X.glowTick) X.glowTick();
    E.rebuild(); E.renderer.shadowMap.needsUpdate=true;
  };
  X.G=G; X.B=B; X.col=col; X.put=put; X.swap=swap; X.THREE=THREE; X.E=E;
  X.finish();
  return X;
}

/* menu switch: 「室內提案」 (URL ?int=0 starts with it off) */
export function menu(THREE,E,X){
  const host=document.getElementById('tCurt'); if(!host) return;
  const b=document.createElement('button'); b.type='button'; b.id='tInt'; b.className='tog'; b.textContent='室內提案'; b.style.gridColumn='1/-1';
  host.parentNode.appendChild(b);
  const set=function(on){ b.setAttribute('aria-pressed',String(on)); X.set(on); };
  b.addEventListener('click',function(){ set(b.getAttribute('aria-pressed')!=='true'); });
  let start=true; try{ start=new URLSearchParams(location.search).get('int')!=='0'; }catch(_){}
  X.collectCurtains(); X.late(); set(start);
  window.__a2Int={set:set,X:X};
}
