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
const WALL_ON={oat:0xe1d4bd,hall:0xdfd2bb,utility:0xe2d7c4,genkan:0xd6c9b2,peach:0xe6cfba,wc:0xdddad2,dress:0xe2d9ca,mist:0xd2cdc2,sage:0xa3b39d,a2kid:0xe2c0a8};

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


/* flat woven rugs as one small canvas each (the catalogue's long-pile rugs cost 15 meshes and a 1024 texture per rug) */
function cvRug(THREE,kind){
  return canvasTex(THREE,256,256,function(g,w,h){
    if(kind==='round'){ g.fillStyle='#eee5d5'; g.fillRect(0,0,w,h); const c=w/2;
      [[0.9,0.935,'#c9ab88'],[0.78,0.8,'#a9b8a2'],[0.6,0.615,'#d6c3a6']].forEach(function(q){ g.strokeStyle=q[2]; g.lineWidth=(q[1]-q[0])*c; g.beginPath(); g.arc(c,c,(q[0]+q[1])/2*c,0,Math.PI*2); g.stroke(); });
      g.fillStyle='rgba(120,100,80,0.05)'; for(let i=0;i<900;i++) g.fillRect(Math.random()*w,Math.random()*h,2,2); }
    else { g.fillStyle='#ece3d3'; g.fillRect(0,0,w,h); g.fillStyle='#d9c8ac'; for(let y=18;y<h;y+=36) g.fillRect(0,y,w,10); g.fillStyle='#b9c6b4'; g.fillRect(0,0,w,6); g.fillRect(0,h-6,w,6); g.fillRect(0,0,6,h); g.fillRect(w-6,0,6,h);
      g.fillStyle='rgba(120,100,80,0.05)'; for(let i=0;i<900;i++) g.fillRect(Math.random()*w,Math.random()*h,2,2); }
  });
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
    FIN.pbrMaps(m,'oak_planks',1.2/1.818,1.2/0.909,{rough:false,normalScale:0.7,color:0xf3e6d0}); m.roughness=0.62;
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
  /* zones: the living area is one group (it is seen as a whole); the rooms around it share another */
  const ZG=new Map();
  const Z=function(l,x,z){ const k=l+':'+(l===0&&(x<3||z<4.3||x>8.8)?'s':'m'); let g=ZG.get(k); if(!g){ g=new THREE.Group(); G[l].add(g); ZG.set(k,g); } return g; };
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

  /* ---- long desk behind the sofa (reference photo 2): one white marble piece with a rounded west end and a low back rim ---- */
  (function(){
    const X0=4.385, X1=5.185, Z0=8.545, Z1=10.745, R=0.25, TY=0.70, TT=0.04;
    const whiteM=mk('a2marble',0xe9e5de,{roughness:0.2,envMapIntensity:1.1}); FIN.pbrMaps(whiteM,'marble_white',1.4,1.4,{normal:false,rough:false,color:0xe9e5de});
    const frontM=mk('a2drawer',0xf3f1ec,{roughness:0.45});
    const arc=function(cx,cz,a0,a1,n){ const o=[]; for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n; o.push([cx+R*Math.cos(a),cz+R*Math.sin(a)]); } return o; };
    /* outline of the top, counter-clockwise in (x, -z): north edge, rounded north-west corner, west edge, rounded south-west corner, south edge */
    const pts=[[X0,Z1],[X1,Z1],[X1,Z0+R]];
    arc(X1-R,Z0+R,0,-Math.PI/2,10).forEach(function(q){ pts.push(q); });          // north-west corner: from (X1, Z0+R) round to (X1-R, Z0)
    pts.push([X0+R,Z0]);
    arc(X0+R,Z0+R,-Math.PI/2,-Math.PI,10).forEach(function(q){ pts.push(q); });   // south-west corner: from (X0+R, Z0) round to (X0, Z0+R)
    const shape=new THREE.Shape(pts.map(function(q){ return new THREE.Vector2(q[0],-q[1]); }));
    const top=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:TT,bevelEnabled:false}),whiteM);
    top.rotation.x=-Math.PI/2; top.position.y=base(0)+TY; top.castShadow=top.receiveShadow=true; Z(0,(X0+X1)/2,(Z0+Z1)/2).add(top);
    /* a strip following a polyline (half width hw, from y0 up h) */
    const strip=function(path,hw,y0,h,mat){
      const L=[],Rr=[]; for(let i=0;i<path.length;i++){ const a=path[Math.max(0,i-1)], b=path[Math.min(path.length-1,i+1)], dx=b[0]-a[0], dz=b[1]-a[1], d=Math.hypot(dx,dz)||1, nx=-dz/d, nz=dx/d;
        L.push([path[i][0]+nx*hw,path[i][1]+nz*hw]); Rr.push([path[i][0]-nx*hw,path[i][1]-nz*hw]); }
      const poly=L.concat(Rr.reverse()), sh=new THREE.Shape(poly.map(function(q){ return new THREE.Vector2(q[0],-q[1]); }));
      const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false}),mat); m.rotation.x=-Math.PI/2; m.position.y=base(0)+y0; m.castShadow=m.receiveShadow=true; Z(0,(X0+X1)/2,(Z0+Z1)/2).add(m); };
    const rim=[[X1-0.02,Z1-0.02],[X1-0.02,Z0+R]]; arc(X1-R,Z0+R,0,-Math.PI/2,10).forEach(function(q){ rim.push([q[0]-0.02*Math.cos(Math.atan2(q[1]-(Z0+R),q[0]-(X1-R))),q[1]-0.02*Math.sin(Math.atan2(q[1]-(Z0+R),q[0]-(X1-R)))]); });
    rim.push([X0+R,Z0+0.02]); arc(X0+R,Z0+R,-Math.PI/2,-Math.PI,10).forEach(function(q){ const a=Math.atan2(q[1]-(Z0+R),q[0]-(X0+R)); rim.push([q[0]-0.02*Math.cos(a),q[1]-0.02*Math.sin(a)]); });
    strip(rim,0.02,TY+TT,0.15,whiteM);                    // low back rim, wrapped round the west end
    const skirt=[]; arc(X1-R,Z0+R,0,-Math.PI/2,10).forEach(function(q){ skirt.push([q[0],q[1]]); }); skirt.push([X0+R,Z0]); arc(X0+R,Z0+R,-Math.PI/2,-Math.PI,10).forEach(function(q){ skirt.push(q); });
    strip(skirt,0.02,0,TY,whiteM);                         // the curved end comes down to the floor in one piece
    /* three drawers hung under the east end */
    B(0,gapM,4.50,5.14,10.16,10.69,0.30,0.70);
    [0.31,0.44,0.57].forEach(function(y){ B(0,frontM,4.488,4.50,10.162,10.688,y,y+0.12); });
    B(0,frontM,4.50,5.14,10.69,10.73,0.0,0.70);            // end panel
    /* outlet strip on the rim */
    B(0,frontM,5.123,5.145,9.15,10.0,0.78,0.83); for(let z=9.25;z<9.95;z+=0.17) B(0,M.black,5.1215,5.123,z,z+0.04,0.795,0.815,{cast:false});
    /* things on the desk: ultrawide monitor, keyboard, mouse, books, pen cup, a small lamp at the curved end */
    B(0,M.tv,4.99,5.02,9.26,10.08,1.00,1.46); B(0,M.black,4.998,5.0,9.275,10.065,1.01,1.45,{cast:false});
    B(0,M.dark,5.0,5.015,9.65,9.69,0.745,1.0); B(0,M.dark,4.93,5.07,9.57,9.77,0.74,0.75);
    B(0,frontM,4.60,4.82,9.45,9.89,0.74,0.752); B(0,M.black,4.605,4.815,9.455,9.885,0.752,0.754,{cast:false});
    B(0,frontM,4.66,4.74,10.0,10.04,0.74,0.756);
    B(0,M.cabF,4.80,5.05,10.40,10.62,0.74,0.77); B(0,M.pot,4.84,5.0,10.42,10.6,0.77,0.795); B(0,M.entry,4.88,5.06,10.44,10.58,0.795,0.82);
    E.cylm(Z(0,4.55,10.6),4.55,10.62,0.035,0.035,0.74,0.82,M.black,14);
    const lampG=Z(0,5.0,8.8); E.cylm(lampG,5.0,8.82,0.045,0.05,0.74,0.76,M.black,14); E.cylm(lampG,5.0,8.82,0.012,0.012,0.76,0.9,M.black,8);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(0.075,20,10,0,Math.PI*2,0,Math.PI/2),E.lampMat); dome.position.set(5.0,0.9,8.82); dome.scale.y=0.7; lampG.add(dome);
    col(0,X0,X1,Z0,Z1,0,0.8);
    /* the lift desk in the plan is hidden while the proposal is on */
    const mv=E.FS.movers.find(function(q){ return q.id==='deskL'; });
    if(mv){ const own=E.furnCols.filter(function(c){ return c.x0>=X0-0.05&&c.x1<=X1+0.05&&c.z0>=Z0-0.05&&c.z1<=Z1+0.05&&c.l===0; });
      X.hidden.push(function(on){ mv.piece.group.visible=!on; own.forEach(function(c){ const i=E.furnCols.indexOf(c); if(on&&i>=0) E.furnCols.splice(i,1); if(!on&&i<0) E.furnCols.push(c); }); }); }
  })();

  /* sheer vertical blind between sofa and desk, hung from a plaster bulkhead (2.4 m at the north edge of the desk zone) */
  (function(){
    const x=5.27, z0=8.64, z1=10.74, yTop=2.4, yBot=0.5, n=Math.round((z1-z0)/0.115), pos=[], idx=[], nor=[];
    for(let i=0;i<n;i++){ const zc=z0+(i+0.5)*(z1-z0)/n, a=(i%2?1:-1)*0.5, hw=0.032, dz=Math.cos(a)*hw, dx=Math.sin(a)*hw, b=pos.length/3;
      pos.push(x-dx,yBot,zc-dz, x+dx,yBot,zc+dz, x+dx,yTop,zc+dz, x-dx,yTop,zc-dz); nor.push(1,0,0,1,0,0,1,0,0,1,0,0); idx.push(b,b+1,b+2,b,b+2,b+3); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); g.setIndex(idx);
    const sheer=mk('a2sheer',0xf7f4ee,{roughness:0.9,transparent:true,opacity:0.5,side:THREE.DoubleSide,depthWrite:false}); const m=new THREE.Mesh(g,sheer); m.renderOrder=1; Z(0,x,(z0+z1)/2).add(m);
    B(0,M.cabF,x-0.09,x+0.09,z0-0.02,z1+0.02,yTop,yTop+0.16);
  })();
  /* long pendant over the desk (hung from the ceiling over the east half; the west end overhangs) */
  (function(){
    const px=4.85, z0=8.8, z1=10.7, y=2.02;
    B(0,metalM,px-0.03,px+0.03,z0,z1,y,y+0.06); B(0,E.lampMat,px-0.024,px+0.024,z0+0.03,z1-0.03,y-0.012,y);
    [10.0,10.55].forEach(function(z){ B(0,M.dark,px-0.003,px+0.003,z-0.003,z+0.003,y+0.06,2.55); });
  })();
  /* living-room furnishing around the TV wall */
  put(0,'wallSpeaker',855,846,'W',null,{y:1.1}); put(0,'wallSpeaker',1085,846,'W',null,{y:1.1});

  /* ---- entry: dark batten screen on the shoe cabinet facing the door (the first thing seen), a bench by the east wall ---- */
  (function(){
    B(0,backM,7.40,7.415,7.02,7.90,0.05,2.4);
    for(let z=7.035;z<7.88;z+=0.05) B(0,woodD,7.415,7.445,z,z+0.03,0.05,2.4);
    B(0,M.oak,7.75,8.35,7.58,7.90,0.34,0.38); [[7.80,7.62],[7.80,7.86],[8.28,7.62],[8.28,7.86]].forEach(function(q){ B(0,M.dark,q[0]-0.015,q[0]+0.015,q[1]-0.015,q[1]+0.015,0,0.34); });
    col(0,7.75,8.35,7.58,7.90,0,0.4);
  })();

  /* ---- rugs ---- */
  const rugRound=function(l,e,n,r){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.012,48),E.lam(0xffffff,{roughness:1,map:cvRug(THREE,'round')})); m.position.set(n/100,base(l)+0.008,e/100); m.receiveShadow=true; Z(l,n/100,e/100).add(m); };
  const rugRect=function(l,e,n,w,d){ const m=new THREE.Mesh(new THREE.BoxGeometry(d,0.012,w),E.lam(0xffffff,{roughness:1,map:cvRug(THREE,'rect')})); m.position.set(n/100,base(l)+0.008,e/100); m.receiveShadow=true; Z(l,n/100,e/100).add(m); };

  /* ---- 1F ---- */
  
  rugRound(0,969,665,1.25);
  put(0,'floorLamp',1105,700,'E');
  put(0,'artLand',915,308,'E',null,{}); put(0,'artLand',1045,308,'E',null,{});
  rugRect(0,960,170,2.0,2.4); put(0,'plant',1135,272,'E',Catalog.plant(0.75));
  /* ---- 2F ---- */
  rugRect(1,162,610,1.9,2.3); put(1,'plantS',92,808,'E');
  rugRound(1,1010,420,0.9); put(1,'plantS',1135,262,'E');
  rugRound(1,990,175,0.7); put(1,'plantS',870,230,'E');

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
