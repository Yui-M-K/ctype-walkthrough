/* A2 interior proposal (see 33_注文住宅格局/室內設計方案.md): plaster palette, accent walls, oak floor, curtains, furnishing, living-room TV wall and double-height ceiling, long desk.
   Plan frame: (e, n) cm; engine x = n / 100, engine z = e / 100. Everything can be switched off from the menu (「室內提案」): walls and floors swap material, the rest sits in per-storey groups. */

/* accent wall role -> the colour it falls back to while the proposal is off (the role of the room it belongs to) */
const ACCENT_ROLE={sage:'oat',a2kid:'oat'};
export const ACCENTS=[
  {l:1,x0:301,x1:325,y0:65,y1:275,w:'sage'},      // master bedroom, south wall
  {l:1,x0:251,x1:275,y0:957,y1:1167,w:'a2kid'}    // child room, wall behind the bed and desk
];
/* wall palette while the proposal is on (design plan section 1) */
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

/* runs before the house is built: accent roles must exist when the walls pick their materials */
const ORIG={};
export function materials(E){
  Object.keys(ACCENT_ROLE).forEach(function(k){ if(!E.WM[k]) E.WM[k]=E.WM.oat.clone(); });
  Object.keys(WALL_ON).forEach(function(k){ if(ORIG[k]===undefined) ORIG[k]=E.WM[k].color.getHex(); });
}

export function create(THREE,E,C){
  const {FL,WM,M,LG,base,bx,Catalog,FIN}=E;
  const X={pieces:[],on:true,mats:[],cols:[],groups:[],hidden:[],things:[],orig:{},glows:[]};

  /* ---- wall roles: new roles are copies of oat so the engine's plaster normal map reaches them ---- */
  const wallState=function(on){
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
    X.hidden.forEach(function(h){ h(on); });
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
  X.collectCurtains(); set(start);
  window.__a2Int={set:set,X:X};
}
