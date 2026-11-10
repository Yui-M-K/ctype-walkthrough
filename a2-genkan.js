/* A2 genkan built-ins: a floor-to-ceiling shoe cabinet (floating toe-kick, open umbrella slot, open niche for everyday shoes, doors that open) facing the front door,
   and the entry bench (oak seat board, linen cushion, tapered legs, an open shoe shelf underneath). Engine metres: x = n / 100, z = e / 100.
   Both keep the footprints of the plan (cabinet 88 x 40 at the south end of the entry, bench 30 x 60 on the west wall). */
export const CAB={x0:7.00,x1:7.40,z0:7.02,z1:7.88};           // front of the cabinet faces +x (the door side)
export const BENCH={x0:7.80,x1:8.40,z0:6.02,z1:6.32,seat:0.445};   // seat top (cushion included); the cat rests on it

export function genkan(THREE,E){
  const {Catalog,LG,M,bx,rbox,cylm,addCol,furnThings,furnAnims,lam,fab,notchPull}=E, CH=E.CH, G=LG[0], oc={cast:false};
  const top=CH-0.005, t=0.018, KB=0.12, X0=CAB.x0, X1=CAB.x1, Z0=CAB.z0, Z1=CAB.z1;
  const oak=M.oak, W=M.cabF;
  const dark=lam(0x2c2a27,{roughness:0.7});
  const glow=new THREE.MeshBasicMaterial({color:0xffe3b8}); if(E.dusk) E.dusk(glow);
  const oakF=lam(0xd2b184,{roughness:0.5,map:oak.map||null});         // door fronts: a little warmer and darker than the counter
  const brass=lam(0xb89a5e,{roughness:0.35,metalness:0.8});

  /* ---- shoe cabinet ---- */
  const zs=Z0+0.16;                                                 // umbrella slot Z0..zs, cupboards zs..Z1
  const LO=0.98, HI=1.42;                                           // lower cupboard top / upper cupboard bottom (the niche between)
  bx(G,X0,X1,Z0,Z1,KB-0.03,KB,W,oc);                                // plinth board over the toe recess
  bx(G,X0+0.05,X1-0.04,Z0+0.02,Z1-0.02,0.0,KB-0.03,dark,oc);        // toe recess: the body floats 12 cm off the floor
  bx(G,X1-0.045,X1-0.04,Z0+0.04,Z1-0.04,0.115,0.12,glow,oc);        // LED line under the body
  bx(G,X0,X0+t,Z0,Z1,KB,top,W);                                     // back
  bx(G,X0,X1,Z0,Z0+t,KB,top,W); bx(G,X0,X1,Z1-t,Z1,KB,top,W);      // ends
  bx(G,X0,X1,Z0,Z1,top-t,top,W);
  bx(G,X0+t,X1-0.002,zs-t/2,zs+t/2,KB,top-t,W);                     // wall between the umbrella slot and the cupboards
  bx(G,X0+t,X1-0.002,zs,Z1-t,LO,LO+0.03,oak);                       // oak counter over the lower cupboard, 1.6 cm proud of the doors
  bx(G,X1-0.002,X1+0.014,zs,Z1-t,LO,LO+0.03,oak);
  bx(G,X0+t,X1-0.01,zs,Z1-t,HI-0.018,HI,W);                         // floor of the upper cupboard
  bx(G,X0+t,X0+t+0.002,zs,Z1-t,LO+0.03,HI-0.018,lam(0xe3d6c2,{roughness:0.9}),oc);   // niche back: a warm plaster panel
  bx(G,X1-0.07,X1-0.02,zs+0.03,Z1-t-0.03,HI-0.026,HI-0.02,glow,oc);   // LED over the niche
  /* cupboard interiors and the shoes in them */
  const LOWS=[KB+0.22,KB+0.44,KB+0.66], UPS=[HI+0.24,HI+0.48,HI+0.72];
  LOWS.concat(UPS).forEach(function(y){ bx(G,X0+t,X1-0.02,zs+t/2,Z1-t,y,y+t,W,oc); });
  bx(G,X0+t,X1-0.02,zs+t/2,Z1-t,KB,KB+t,W,oc);
  const pair=function(y,x,z,s,rot){ const sc=s[3]||0.88; [-1,1].forEach(function(sd){ const g=Catalog.shoe(s[0],s[1],s[2]); g.scale.setScalar(sc); g.rotation.y=rot||0; g.position.set(x,y+0.001,z+sd*0.052*sc); g.traverse(function(o){ if(o.isMesh) o.castShadow=true; }); G.add(g); }); };
  const SHOES=[['sneaker',0xf2efe8,0xf7f5f0,0.88],['loafer',0x3a2a20,0x6b4a33,1],['sneaker',0x2f3a4a,0xf1efe9,1],['pump',0xd9c3a5,0xb9a184,0.88],['loafer',0x1d1e21,0x1d1e21,1],['sneaker',0x9fb0bf,0xf1efe9,0.88],['sandal',0x8c5a3c,0xcdb89a,0.88],['sneaker',0x5a6b58,0xf1efe9,1]];
  let si=0;
  const cx=X0+t+0.15;                                               // shoe centre: toe to the front (+x), heel to the back
  [KB+t].concat(LOWS.map(function(y){ return y+t; })).concat([HI,UPS[0]+t,UPS[1]+t]).forEach(function(y){ [0.17,0.51].forEach(function(dz){ pair(y,cx,zs+dz,SHOES[si++%SHOES.length],0); }); });   // two pairs a level (the width holds two and a half)
  bx(G,X0+0.06,X1-0.06,zs+0.08,Z1-0.08,UPS[2]+t,UPS[2]+t+0.16,lam(0xd9cfc0,{roughness:0.8}),oc); bx(G,X0+0.06,X1-0.06,zs+0.08,Z1-0.08,UPS[2]+t+0.16,UPS[2]+t+0.3,lam(0xc9b79c,{roughness:0.8}),oc);   // shoe boxes up top
  /* niche: everyday shoes and a few things */
  pair(LO+0.03,X1-0.14,zs+0.17,['sneaker',0xf2efe8,0xf7f5f0,0.88],0); pair(LO+0.03,X1-0.14,zs+0.5,['loafer',0x3a2a20,0x6b4a33,1],0);
  bx(G,X0+0.06,X0+0.2,Z1-0.18,Z1-0.04,LO+0.03,LO+0.04,oakF,oc);                                    // a tray at the back with a key bowl
  cylm(G,X0+0.13,Z1-0.11,0.05,0.04,LO+0.04,LO+0.07,lam(0xb9b2a4,{roughness:0.7}),20);
  const pl=Catalog.plant(0.28); pl.group.position.set(X0+0.15,LO+0.03,zs+0.34); G.add(pl.group);
  /* umbrella slot: two folded umbrellas hanging from hooks over a drip tray */
  bx(G,X0+t,X1-0.05,Z0+t,zs-t/2,KB,KB+0.03,dark,oc);
  [Z0+0.055,Z0+0.105].forEach(function(z,i){ const hx=X0+t+0.03, ym=[0.78,0.7][i];
    cylm(G,hx,z,0.004,0.004,1.3,1.34,brass,6);
    cylm(G,hx+0.012,z,0.024,0.016,ym,1.28,lam([0x35506b,0x2a2a2a][i],{roughness:0.6}),12);
    cylm(G,hx+0.012,z,0.004,0.004,ym-0.05,ym,M.steel,6); });
  addCol(0,X0,X1,Z0,Z1,0,LO+0.03,'w'); addCol(0,X0,X1,Z0,Z1,HI-0.018,top,'w');   // the open niche between them is not solid

  /* doors: finger-pull fronts, a pair for the lower cupboard and a pair for the upper one, each pair opens on its own; the umbrella slot stays open */
  const sets={lo:{leaves:[],parts:[]},hi:{leaves:[],parts:[]}}, zm=(zs+Z1)/2;
  const leaf=function(key,hz,sg,y0,y1,w,py){ const pv=new THREE.Group(); pv.userData.keep=true; pv.position.set(X1,0,hz); G.add(pv);
    const m=new THREE.Mesh(new THREE.BoxGeometry(t,y1-y0-0.006,w),oakF); m.position.set(-t/2,(y0+y1)/2,sg*w/2); m.castShadow=m.receiveShadow=true; pv.add(m); sets[key].parts.push(m);
    const n=notchPull(0xd2b184,0.16); n.position.set(0,py,sg*w); n.rotation.set(0,Math.PI/2,sg*Math.PI/2); pv.add(n);
    sets[key].leaves.push({pv:pv,sg:sg}); };
  const lw=(Z1-zs)/2-0.002;
  leaf('lo',zs+0.001,1,KB,LO,lw,LO-0.12); leaf('lo',Z1-0.001,-1,KB,LO,lw,LO-0.12);
  leaf('hi',zs+0.001,1,HI,top,lw,HI+0.12); leaf('hi',Z1-0.001,-1,HI,top,lw,HI+0.12);
  const opener=function(key,on,off){ const S=sets[key]; let cur=0, tg=0, last=null;
    furnThings.push({pt:[X1+0.3,zm],l:0,part:S.parts,on:function(){ return true; },label:function(){ return tg?off:on; },act:function(){ tg=tg?0:1; last=null; }});
    furnAnims.push({live:function(){ return cur!==tg; },f:function(t2){ if(last===null) last=t2; const dt=Math.min(0.05,t2-last); last=t2; cur=Math.abs(tg-cur)<dt*2?tg:cur+Math.sign(tg-cur)*dt*2; S.leaves.forEach(function(q){ q.pv.rotation.y=q.sg*cur*1.55; }); E.renderer.shadowMap.needsUpdate=true; return true; }}); };
  opener('lo','打開下層鞋櫃','關上下層鞋櫃'); opener('hi','打開上層鞋櫃','關上上層鞋櫃');

  /* ---- bench ---- */
  const B=BENCH, SB=0.03, CU=0.03, sy=B.seat-CU-SB;                    // seat board 3 cm, linen cushion 3 cm
  const cush=fab?fab(0xd9cfbf):lam(0xd9cfbf,{roughness:0.95});
  rbox(G,B.x0,B.x1,B.z0,B.z1,sy,sy+SB,0.008,oak);                      // solid oak seat with eased edges
  rbox(G,B.x0+0.012,B.x1-0.012,B.z0+0.012,B.z1-0.012,sy+SB,B.seat,0.012,cush);   // cushion
  const aprY=sy-0.07;
  bx(G,B.x0+0.03,B.x1-0.03,B.z1-0.05,B.z1-0.03,aprY,sy,oak,oc); bx(G,B.x0+0.03,B.x1-0.03,B.z0+0.03,B.z0+0.05,aprY,sy,oak,oc);   // aprons under the seat
  bx(G,B.x0+0.03,B.x0+0.05,B.z0+0.03,B.z1-0.03,aprY,sy,oak,oc); bx(G,B.x1-0.05,B.x1-0.03,B.z0+0.03,B.z1-0.03,aprY,sy,oak,oc);
  [[B.x0+0.04,B.z0+0.04],[B.x0+0.04,B.z1-0.04],[B.x1-0.04,B.z0+0.04],[B.x1-0.04,B.z1-0.04]].forEach(function(q){ cylm(G,q[0],q[1],0.021,0.012,0,aprY,oak,12); });   // tapered legs
  const sh=0.16;                                                        // slatted shoe shelf
  for(let z=B.z0+0.05;z<B.z1-0.06;z+=0.052) bx(G,B.x0+0.03,B.x1-0.03,z,z+0.044,sh,sh+0.016,oak,oc);
  bx(G,B.x0+0.03,B.x0+0.045,B.z0+0.03,B.z1-0.03,sh-0.03,sh,oak,oc); bx(G,B.x1-0.045,B.x1-0.03,B.z0+0.03,B.z1-0.03,sh-0.03,sh,oak,oc);   // rails carrying the slats
  [[0.14,['sneaker',0xf2efe8,0xf7f5f0,0.88]],[0.4,['loafer',0x2a2a2a,0x2a2a2a,1]]].forEach(function(q){ [-1,1].forEach(function(sd){ const g=Catalog.shoe(q[1][0],q[1][1],q[1][2]); g.scale.setScalar(q[1][3]); g.rotation.y=Math.PI/2; g.position.set(B.x0+q[0]+sd*0.052*q[1][3],sh+0.017,(B.z0+B.z1)/2); G.add(g); }); });   // toes to the wall
  addCol(0,B.x0-0.01,B.x1+0.01,B.z0-0.01,B.z1+0.01,0,B.seat+0.01,'x');
  /* hook rail on the wall above the bench */
  bx(G,B.x0+0.05,B.x1-0.05,B.z0,B.z0+0.016,1.38,1.43,oak,oc);
  [0.14,0.3,0.46].forEach(function(d){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.04,8),brass); p.rotation.x=Math.PI/2; p.position.set(B.x0+d,1.405,B.z0+0.036); G.add(p); });
  return {cabinet:CAB,bench:B};
}
