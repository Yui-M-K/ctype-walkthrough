/* A2 1F shower + changing room, after ideal_c's shower room and changing room: a tiled wet cell (floor falling to a drain, glass screen, rain head, hand shower, tiled walls)
   next to a dry changing area (laundry basket, towel rail, hooks, mat, small cabinet), separated by a threshold strip, a glass screen and the change of floor material.
   Engine metres: x = n / 100, z = e / 100. The room is x 7.05..8.425, z 4.35..5.92 (inner faces); the sliding door is in the south wall (x 7.0, z 5.07..5.87). */
export function wet(THREE,E){
  const {Catalog,LG,M,FL,bx,cylm,addCol,fixture,furnThings,furnAnims,lam,notchPull}=E, G=LG[0], oc={cast:false};
  const XS=7.05, XN=8.425, ZW=4.35, ZE=5.92;                 // room inner faces (south, north, west, east)
  const CX0=7.50, CZ0=4.80, TOP=2.2;                          // wet cell: x CX0..XN, z CZ0..ZE
  const chrome=lam(0xd9dde1,{metalness:0.92,roughness:0.16,envMapIntensity:1.1}), steel=M.steel, brass=lam(0xb89a5e,{roughness:0.35,metalness:0.8});
  const glass=lam(0xcfe8f6,{transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false,roughness:0.05,metalness:0.1,envMapIntensity:1});
  /* wet cell: tiled floor and walls */
  bx(G,CX0,XN,CZ0,ZE,0,0.008,FL.bath,oc);
  bx(G,CX0,XN,ZE-0.012,ZE,0,TOP,FL.bath,oc); bx(G,XN-0.012,XN,CZ0,ZE,0,TOP,FL.bath,oc);
  [0.6,1.2,1.8].forEach(function(h){ const j=lam(0xb9b6ae,{roughness:0.6}); bx(G,CX0,XN,ZE-0.0125,ZE-0.0115,h-0.001,h+0.001,j,oc); bx(G,XN-0.0125,XN-0.0115,CZ0,ZE,h-0.001,h+0.001,j,oc); });
  bx(G,CX0-0.03,CX0,CZ0,ZE,0,0.014,steel,oc);                 // threshold: a steel strip where the floor changes from tile to the dry floor
  bx(G,CX0,XN,CZ0-0.03,CZ0,0,0.014,steel,oc);
  cylm(G,8.05,5.45,0.07,0.07,0.008,0.0095,lam(0x9ea3a8,{metalness:0.75,roughness:0.35}),24); cylm(G,8.05,5.45,0.03,0.03,0.0095,0.0105,lam(0x2b2d31,{roughness:0.6}),16);   // drain
  /* glass screens: a fixed panel along the west side and along the south side, the opening (62 cm) next to the east wall */
  const pane=function(x0,x1,z0,z1){ bx(G,x0,x1,z0,z1,0.03,2.0,glass,oc); [[0.03,0.05],[1.96,2.0]].forEach(function(r){ bx(G,x0-0.005,x1+0.005,z0-0.005,z1+0.005,r[0],r[1],chrome,oc); });
    addCol(0,x0,x1,z0,z1,0,2.0,'w'); };
  pane(CX0,XN-0.02,CZ0-0.012,CZ0+0.012);                      // west side
  pane(CX0-0.012,CX0+0.012,CZ0,5.25);                          // south side
  bx(G,CX0-0.015,CX0+0.015,5.25,5.265,0.03,2.0,chrome,oc);
  /* fittings on the north wall: bar mixer, slide bar with hand shower (catalogue set), rain head on a wall arm */
  const P=Catalog.bathWallSet({standing:true,noSoap:true,shelfFrom:700,shelfTo:763});
  fixture(0,P,XN-0.012,5.3,3);                                  // faces -x: out of the north wall
  const RY=2.18, RZ=5.45; bx(G,XN-0.012,XN-0.012+0.012,RZ-0.04,RZ+0.04,RY,RY+0.08,chrome,oc); bx(G,XN-0.46,XN-0.012,RZ-0.012,RZ+0.012,RY+0.03,RY+0.054,chrome,oc); bx(G,XN-0.6,XN-0.35,RZ-0.125,RZ+0.125,RY,RY+0.03,chrome,oc);
  const water=new THREE.Group(); water.visible=false; G.add(water); const wm=new THREE.MeshBasicMaterial({color:0xdfefff,transparent:true,opacity:0.28,depthWrite:false});
  for(let i=0;i<48;i++){ const s=new THREE.Mesh(new THREE.CylinderGeometry(0.0015,0.0015,RY,4),wm); s.position.set(XN-0.58+(Math.floor(i/8))*0.04+((i*7)%5)*0.003,RY/2,RZ-0.1+(i%8)*0.03); water.add(s); }
  let on=false;
  const stop=function(){ on=false; water.visible=false; wm.opacity=0.28; water.children.forEach(function(c){ c.position.y=RY/2; }); };
  furnThings.push({pt:[7.8,5.55],l:0,on:function(){ return true; },label:function(){ return on?'關上花灑':'打開花灑（頂噴）'; },act:function(){ if(on) stop(); else { on=true; water.visible=true; } }});
  furnAnims.push({live:function(){ return on; },f:function(t){ wm.opacity=0.22+0.08*Math.sin(t*23); water.children.forEach(function(c,i){ c.position.y=RY/2-((t*3+i*0.37)%1)*0.04; }); return true; }});
  /* dry side: bath mat at the cell opening, laundry basket, towel rail, hooks, a small cabinet with towels */
  const mat=Catalog.doormat(0.6,0.4); fixture(0,mat,7.28,5.55,0);
  const lb=Catalog.laundryBasket(); fixture(0,lb,8.2,4.6,1);
  /* towel rail on the west wall, towels over it */
  const rx=7.95, rz=ZW+0.03; [rx,rx+0.5].forEach(function(x){ bx(G,x-0.01,x+0.01,rz,rz+0.05,0.95,1.55,chrome,oc); });
  [1.0,1.12,1.24,1.36,1.48].forEach(function(y){ bx(G,rx,rx+0.5,rz+0.035,rz+0.055,y-0.008,y+0.008,chrome,oc); });
  bx(G,rx+0.04,rx+0.2,rz+0.03,rz+0.07,1.12,1.55,lam(0xe9e2d4,{roughness:0.95}),oc); bx(G,rx+0.27,rx+0.44,rz+0.03,rz+0.07,1.0,1.4,lam(0xa7b2a2,{roughness:0.95}),oc);
  /* hooks */
  bx(G,7.15,7.45,ZW,ZW+0.014,1.68,1.72,M.oak,oc);
  [7.2,7.3,7.4].forEach(function(x){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.04,8),brass); p.rotation.x=Math.PI/2; p.position.set(x,1.70,ZW+0.034); G.add(p); });
  /* small cabinet in the south-west corner, oak top, finger-pull doors, towels on top */
  const cx0=XS+0.02, cx1=XS+0.4, cz0=ZW, cz1=ZW+0.42, ch=0.82;
  bx(G,cx0,cx1,cz0,cz1,0.08,ch-0.03,M.cabF); bx(G,cx0,cx1,cz0,cz1,ch-0.03,ch,M.oak); bx(G,cx0+0.03,cx1-0.02,cz0+0.02,cz1-0.02,0,0.08,lam(0x8f887d,{roughness:0.8}),oc);
  [[cz0,cz0+0.21],[cz0+0.21,cz1]].forEach(function(r){ const f=bx(G,cx1,cx1+0.018,r[0]+0.002,r[1]-0.002,0.095,ch-0.04,lam(0xd2b184,{roughness:0.5,map:M.oak.map||null}),oc); const n=notchPull(0xd2b184,0.14); n.position.set(cx1+0.018,ch-0.12,r[0]<cz0+0.1?r[1]-0.002:r[0]+0.002); n.rotation.set(0,Math.PI/2,Math.PI/2*(r[0]<cz0+0.1?-1:1)); G.add(n); });
  addCol(0,cx0,cx1+0.02,cz0,cz1,0,ch,'x');
  const tw=Catalog.towels(ch); fixture(0,tw,(cx0+cx1)/2,(cz0+cz1)/2,1);
}
