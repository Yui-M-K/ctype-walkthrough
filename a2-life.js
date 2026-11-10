/* A2 life modes (menu: 模式): daily, cooking, sleeping and sport, written after ideal_c.html's modes. The people come from lib/people.js and
   stand where the furniture they use is now (E.at follows moved pieces). The cat of a2-cat.js sits on her lap in the daily mode and keeps out of their way.
   C: {ctrl: the Walk.Sun controller, pos:{tv,sofa,chairPC,side1}: default plan centres [n,e] in cm and the way the piece faces by default [n,e,yaw], hob:[x,z] in m, cat: the a2-cat controller or null}.
   Plan frame: engine x = n / 100, engine z = e / 100; a person's local +x is the way they face. */
export function create(THREE,E,C){
  const {$,Catalog,M,People,TAU,amb,hemi,fills,pointLights,lampMat,scene,setTv,toast,rebuild,mover,modeAnims,modeGroup,usable,at,btn,fab,lam,clamp,renderer}=E;
  const CAT=C.cat, P=C.pos, V=function(x,y,z){ return new THREE.Vector3(x,y,z); };
  const put=function(id,l,dn,de){ const q=at(id,l,P[id][0]+dn,P[id][1]+de); return [q[0],q[1],q[2]+P[id][2]]; };   // [x,z,yaw] now of a default point of a piece (its default facing + how far it was turned)
  const seatOn=function(id,de){ return put(id,0,-8,de||0); };              // a sitter's hips sit 8 cm behind the centre of the sofa (it faces +x by default)
  const add=function(par,geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; par.add(m); return m; };
  const setSeg=function(m,a,b){ const d=new THREE.Vector3().subVectors(b,a), len=d.length(); m.position.copy(a).addScaledVector(d,0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); m.scale.set(1,len,1); };
  const seg=function(par,a,b,r,mt){ const m=add(par,new THREE.CylinderGeometry(r,r,1,10),mt,0,0,0); setSeg(m,a,b); return m; };
  const woman=function(arms){ return People.sit(1.63,0.40,0xf1c9a5,0xf4f1ec,0x7f8fa8,0x3a2a22,true,arms); };
  const offOthers=function(keep){                                          // modes exclude each other
    if(keep!=='sport'&&E.sportOn){ E.sportOn=false; btn('tSport',false); applySport(); }
    if(keep!=='daily'&&E.dailyOn){ E.dailyOn=false; btn('tDaily',false); applyDaily(); }
    if(keep!=='cook'&&E.cookOn){ E.cookOn=false; btn('tCook',false); applyCook(); }
    if(keep!=='guest'&&guestOn){ guestOn=false; btn('tGuest',false); applyGuest(); }
    if(keep!=='sleep'&&E.sleepOn){ E.sleepOn=false; btn('tSleep',false); applySleep(); }
  };
  if(CAT) CAT.avoid(function(){ return E.cookOn?{stops:{S3:1,S4:1},nodes:{K1:1,S3:1,S4:1}}:guestOn?{stops:{S3:1},nodes:{K1:1,S3:1}}:E.sportOn?{stops:{S1:1}}:{}; });

  /* sport: coffee table away, two players 1.2 m in front of the TV */
  const sportG=modeGroup(0), sportF=People.stand(1.63,0xf1c9a5,0xf4f1ec,0x7f8fa8,0x3a2a22,true,0x2ec4ea,0xff5a5f), sportM=People.stand(1.69,0xe2b890,0x3c4a5c,0x2f3a4a,0x1f1a16,false,0x2ec4ea,0xff5a5f);
  sportG.add(sportF,sportM);
  function applySport(){
    if(E.sportOn) offOthers('sport');
    const cm=mover('lift'); if(cm){ cm.W.visible=!E.sportOn&&usable('lift'); cm.own.forEach(function(c){ c.modeOff=E.sportOn; }); }
    sportG.visible=E.sportOn&&usable('tv');
    if(E.sportOn){
      [[sportF,-40],[sportM,40]].forEach(function(q){ const p=put('tv',0,0,q[1]), d=1.2; q[0].position.set(p[0]+Math.cos(p[2])*d,0,p[1]-Math.sin(p[2])*d); q[0].rotation.y=Math.PI+p[2]; });
      toast('運動模式：站在電視前約 1.2 m（茶几已收起）');
    }
    rebuild(); renderer.shadowMap.needsUpdate=true;
  }
  $('tSport').addEventListener('click',function(){ E.sportOn=!E.sportOn; btn('tSport',E.sportOn); applySport(); });

  /* daily: he types at the study desk upstairs, she watches TV on the sofa with the cat on her lap */
  const workerG=modeGroup(1), viewerG=modeGroup(0);
  const typing={e:function(sd,u){ return [0.08*u,0.2*u,sd*0.17*u]; }, h:function(sd,u){ return [0.3*u,0.74-0.5,sd*0.1*u]; }};   // hands on a 74 cm desk
  const workerM=People.sit(1.69,0.50,0xe2b890,0x3c4a5c,0x2f3a4a,0x1f1a16,false,typing); workerG.add(workerM);
  const viewerF=woman(People.poses.lapArms); viewerG.add(viewerF);
  (function(){ const H=new THREE.Group(); H.position.set(-0.05,0.13,0); viewerF.add(H); const c=Catalog.bubuRig(1.05,{pose:'loaf'}); c.group.position.set(0.2,0.03,0.04); c.group.rotation.y=Math.PI/2+0.35; H.add(c.group); modeAnims.push(function(t){ if(viewerG.visible) c.anim(t); }); })();
  function applyDaily(){
    if(E.dailyOn) offOthers('daily');
    workerG.visible=E.dailyOn&&usable('chairPC'); viewerG.visible=E.dailyOn&&usable('sofa'); if(CAT) CAT.hide(viewerG.visible);   // she is on the lap, not on the floor
    if(E.dailyOn){
      const w=put('chairPC',1,0,0); workerM.position.set(w[0],0.50,w[1]); workerM.rotation.y=w[2];
      const v=seatOn('sofa'); viewerF.position.set(v[0],0.5,v[1]); viewerF.rotation.y=v[2];
      toast('日常模式：他在 2F 書房工作，她在 1F 沙發看電視');
    }
    setTv(E.dailyOn); renderer.shadowMap.needsUpdate=true;
  }
  $('tDaily').addEventListener('click',function(){ E.dailyOn=!E.dailyOn; btn('tDaily',E.dailyOn); applyDaily(); });

  /* cooking: she stir-fries at the IH hob from the aisle, he has a beer on the sofa */
  const cookG=modeGroup(0), cookManG=modeGroup(0);
  const U=1.69, cookMan=(function(){
    const steel=lam(0xc9ced3,{metalness:0.85,roughness:0.25,envMapIntensity:1}), black=lam(0x252527,{roughness:0.5});
    const hx=C.hob[0], hz=C.hob[1], u=1.63, px=hx, pz=hz-0.85, L=function(wx,wy,wz){ return [wz-pz,wy,px-wx]; };   // world point -> her local frame (she faces +z)
    const panC=V(hx+0.14,0.89,hz-0.03), panYaw=-0.35, potC=V(hx,0.89,hz+0.14);
    const hL=L(panC.x+0.086,0.94,panC.z-0.235), hR=L(panC.x-0.06,1.0,panC.z-0.06);
    const her=People.stand(u,0xf1c9a5,0xf4f1ec,0x7f8fa8,0x3a2a22,true,undefined,undefined,{e:function(sd){ return sd>0?[0.17,1.08,0.22]:[0.1,1.04,-0.3]; }, h:function(sd){ return sd>0?hR:hL; }});
    her.position.set(px,0,pz); her.rotation.y=-Math.PI/2; cookG.add(her);
    const apron=fab(0xe0b65a); add(her,new THREE.BoxGeometry(0.012,0.36*u,0.23*u),apron,0.083*u,0.6*u,0); add(her,new THREE.BoxGeometry(0.01,0.1*u,0.12*u),apron,0.074*u,0.82*u,0);
    const PG=new THREE.Group(); PG.position.copy(panC); PG.rotation.y=panYaw; cookG.add(PG);
    const pan=new THREE.Mesh(new THREE.LatheGeometry([[0.001,0],[0.1,0],[0.13,0.045],[0.124,0.046],[0.096,0.006],[0.001,0.006]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),32),lam(0x2b2b2e,{roughness:0.45,side:THREE.DoubleSide}));
    pan.castShadow=true; PG.add(pan); add(PG,new THREE.BoxGeometry(0.03,0.02,0.18),lam(0x3a2c22,{roughness:0.6}),0,0.04,-0.22);
    const bits=[], bitCol=[0x5aa04a,0xe8873a,0x8a5a3c,0xf3e6b8,0x5aa04a,0xd4473b];
    for(let i=0;i<16;i++){ const a=i*2.4, r=0.03+0.06*((i*37)%10)/10; const b=add(PG,new THREE.BoxGeometry(0.03,0.012,0.018),lam(bitCol[i%bitCol.length],{roughness:0.6}),Math.cos(a)*r,0.016,Math.sin(a)*r); b.rotation.y=a; bits.push(b); }
    const handTip=V(px-hR[2],hR[1],pz+hR[0]), bladeAt=V(panC.x-0.01,panC.y+0.025,panC.z-0.01);
    seg(cookG,handTip,bladeAt,0.006,lam(0x2b2b2e,{roughness:0.5})); add(cookG,new THREE.BoxGeometry(0.07,0.004,0.06),lam(0x3a3a3c,{roughness:0.5}),bladeAt.x,bladeAt.y,bladeAt.z).rotation.y=0.3;
    add(cookG,new THREE.CylinderGeometry(0.1,0.1,0.13,28,1,true),lam(0xc9ced3,{metalness:0.85,roughness:0.25,envMapIntensity:1,side:THREE.DoubleSide}),potC.x,potC.y+0.065,potC.z);
    add(cookG,new THREE.CylinderGeometry(0.1,0.1,0.006,28),steel,potC.x,potC.y+0.003,potC.z); add(cookG,new THREE.CylinderGeometry(0.098,0.098,0.004,28),lam(0xd9a35a,{roughness:0.3}),potC.x,potC.y+0.1,potC.z);
    add(cookG,new THREE.SphereGeometry(0.105,28,8,0,TAU,0,0.5),lam(0xdfeaf0,{roughness:0.05,transparent:true,opacity:0.35,envMapIntensity:1}),potC.x,potC.y+0.08,potC.z).castShadow=false;
    add(cookG,new THREE.SphereGeometry(0.015,12,8),black,potC.x,potC.y+0.135,potC.z); [-1,1].forEach(function(sd){ add(cookG,new THREE.BoxGeometry(0.03,0.015,0.05),black,potC.x,potC.y+0.11,potC.z+sd*0.12); });
    const steam=[0,1,2,3,4,5].map(function(){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.03,10,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false})); cookG.add(m); return m; });
    const bx=hx-0.66, bz=hz-0.3;                                          // cutting board with carrot slices, cabbage and a knife on the prep space beside the hob
    const board=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.02,0.23),lam(0xe8d4b0,{roughness:0.7})); board.position.set(bx+0.17,0.89,bz+0.115); board.castShadow=board.receiveShadow=true; cookG.add(board);
    for(let i=0;i<7;i++) add(cookG,new THREE.CylinderGeometry(0.014,0.014,0.006,14),lam(0xe8873a,{roughness:0.6}),bx+0.05+i*0.022,0.903,bz+0.06+(i%2)*0.01);
    add(cookG,new THREE.CylinderGeometry(0.014,0.012,0.12,14),lam(0xe8873a,{roughness:0.6}),bx+0.24,0.914,bz+0.07).rotation.z=Math.PI/2; add(cookG,new THREE.SphereGeometry(0.06,16,10,0,TAU,0,Math.PI/2),lam(0x9cc47a,{roughness:0.7}),bx+0.26,0.9,bz+0.16);
    add(cookG,new THREE.BoxGeometry(0.16,0.003,0.035),steel,bx+0.1,0.902,bz+0.17); add(cookG,new THREE.BoxGeometry(0.1,0.018,0.022),black,bx,0.909,bz+0.17);
    /* he: stands on the east side of the peninsula facing the sink and her, beer in the right hand, left hand on the counter edge */
    const man=People.stand(U,0xe2b890,0x3c4a5c,0x2f3a4a,0x1f1a16,false,undefined,undefined,{e:function(sd){ return sd>0?[0.14,1.04,0.2]:[0.1,1.0,-0.2]; }, h:function(sd){ return sd>0?[0.27,1.1,0.1]:[0.3,0.92,-0.12]; }}); cookManG.add(man);
    const canMat=lam(0xd8dde2,{metalness:0.8,roughness:0.3,envMapIntensity:1}), canBand=lam(0xd9a83a,{metalness:0.6,roughness:0.35});
    add(man,new THREE.CylinderGeometry(0.033,0.033,0.122,20),canMat,0.3,1.13,0.1); add(man,new THREE.CylinderGeometry(0.0335,0.0335,0.05,20),canBand,0.3,1.135,0.1);
    man.position.set(hx-0.3,0,hz+0.9); man.rotation.y=Math.PI/2;
    modeAnims.push(function(t){
      if(!cookG.visible) return;
      bits.forEach(function(b,i){ b.position.y=0.016+Math.max(0,Math.sin(t*7+i*1.7))*0.022; });
      steam.forEach(function(m,i){ const q=((t*0.35+i/steam.length)%1); m.position.set(potC.x+Math.sin(t+i)*0.03,potC.y+0.16+q*0.45,potC.z+Math.cos(t*0.8+i)*0.03); m.scale.setScalar(0.6+q*1.6); m.material.opacity=0.28*Math.sin(q*Math.PI); });
    });
    return man;
  })();
  function applyCook(){
    if(E.cookOn) offOthers('cook');
    cookG.visible=E.cookOn||guestOn; cookManG.visible=E.cookOn;
    if(E.cookOn) toast('料理模式：她在 IH 爐前炒菜，他站在半島旁喝啤酒');
    renderer.shadowMap.needsUpdate=true;
  }
  $('tCook').addEventListener('click',function(){ E.cookOn=!E.cookOn; btn('tCook',E.cookOn); applyCook(); });

  /* sleeping: everything off except a warm night light on the bedside table; two sleepers under a duvet */
  const sleepG=modeGroup(1), nightMat=new THREE.MeshBasicMaterial({color:0x6a4a30}), nightPt=new THREE.PointLight(0xffa860,0,2.6,2), nightG=new THREE.Group();
  (function(){
    const dome=new THREE.Mesh(new THREE.SphereGeometry(0.035,16,10,0,TAU,0,Math.PI/2),nightMat); nightG.add(dome);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.04,0.012,16),M.ceramic); b.position.y=-0.006; nightG.add(b);
    nightPt.position.y=0.12; nightG.add(nightPt); nightG.visible=false; E.LG[1].add(nightG);
    sleepG.add(People.sleepers({duvet:M.bedB,cuff:M.pillow})); mover('bed').piece.group.add(sleepG); sleepG.position.y=0;   // in the bed's own frame, so it follows the bed
  })();
  const nightBg=(function(){ const c=document.createElement('canvas'); c.width=4; c.height=256; const g=c.getContext('2d'), gr=g.createLinearGradient(0,0,0,256);
    gr.addColorStop(0,'#05080f'); gr.addColorStop(0.6,'#0d1626'); gr.addColorStop(1,'#1a2438'); g.fillStyle=gr; g.fillRect(0,0,4,256);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  const keep={};                                                           // daylight values to come back to
  const nightLook=function(){                                              // also after the sun panel has repainted the sky
    scene.background=nightBg; scene.fog.color.setHex(0x0a1220); scene.environmentIntensity=0; renderer.toneMappingExposure=1.7;   // no sky light: the environment map stays, so the sun panel can bring it back as it was
    amb.intensity=0.035*E.LI; hemi.intensity=0.02*E.LI; fills.forEach(function(f){ f.intensity=0; });
  };
  function applySleep(){
    if(E.sleepOn) offOthers('sleep');
    const on=E.sleepOn;
    if(on){ keep.ei=scene.environmentIntensity; keep.day=C.ctrl.state.altitude>=6; keep.exp=renderer.toneMappingExposure; keep.lamp=lampMat.color.getHex(); keep.shade=M.shade.emissive.getHex(); pointLights.forEach(function(p){ if(p.userData.a2i0===undefined) p.userData.a2i0=p.intensity; }); }
    pointLights.forEach(function(p){ p.intensity=on?0:p.userData.a2i0===undefined?p.intensity:p.userData.a2i0; });
    lampMat.color.setHex(on?0x1a1712:keep.lamp===undefined?0xffdc96:keep.lamp); M.shade.emissive.setHex(on?0x000000:keep.shade===undefined?0x8a6428:keep.shade);
    const sd=put('side1',1,0,0); nightG.position.set(sd[0],E.base(1)+0.463,sd[1]); nightG.visible=on; nightMat.color.setHex(on?0xffd9a8:0x6a4a30); nightPt.intensity=on?0.5:0;
    sleepG.visible=on&&usable('bed');
    if(on) nightLook(); else { if(keep.exp!==undefined) renderer.toneMappingExposure=keep.exp; C.ctrl.update(); if(keep.day&&C.ctrl.state.altitude>=6) scene.environmentIntensity=keep.ei; }      // the sun panel brings back the sky and the daylight levels
    renderer.shadowMap.needsUpdate=true; scene.traverse(function(o){ if(o.material&&!Array.isArray(o.material)) o.material.needsUpdate=true; });
  }
  const onSun=C.ctrl.onChange; C.ctrl.onChange=function(s){ if(onSun) onSun(s); if(E.sleepOn) nightLook(); };
  $('tSleep').addEventListener('click',function(){ E.sleepOn=!E.sleepOn; btn('tSleep',E.sleepOn); applySleep(); });

  /* guests: the lift table is raised to dining height; two guests on the sofa, two on floor cushions on the TV side of the table, she prepares in the kitchen */
  let guestOn=false;
  const guestG=modeGroup(0), cushion=fab(0xc9b79c);
  const lapG={e:function(sd,u){ return [0.06*u,0.22*u,sd*0.17*u]; }, h:function(sd,u){ return [0.2*u,0.12,sd*0.05*u]; }};
  const tableArms={e:function(sd,u){ return [0.05*u,0.3*u,sd*0.17*u]; }, h:function(sd,u){ return [0.22*u,0.5,sd*0.1*u]; }};
  const gSofa=[woman(lapG), People.sit(1.72,0.40,0xe2b890,0x6b7f6a,0x3a3f4a,0x2a2220,false,lapG)];
  const gFloor=[People.sit(1.58,0.2,0xf1c9a5,0xd9a0a0,0x4a5568,0x4a3426,true,tableArms), People.sit(1.72,0.2,0xe2b890,0xe8e4d8,0x2f3a4a,0x1f1a16,false,tableArms)];
  const gCush=gFloor.map(function(){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.08,24),cushion); m.castShadow=m.receiveShadow=true; return m; });
  gSofa.concat(gFloor,gCush).forEach(function(g){ guestG.add(g); });
  function applyGuest(){
    if(guestOn) offOthers('guest');
    const lm=mover('lift'), okL=!!lm&&usable('lift'), okS=usable('sofa'); if(okL) lm.piece.lift.up=guestOn;
    guestG.visible=guestOn; gSofa.forEach(function(g){ g.visible=okS; }); gFloor.concat(gCush).forEach(function(g){ g.visible=okL; });
    cookG.visible=guestOn||E.cookOn; cookManG.visible=E.cookOn;                // she cooks in the guest mode too
    if(guestOn){
      [[-55,0],[55,1]].forEach(function(q){ const v=seatOn('sofa',q[0]); gSofa[q[1]].position.set(v[0],0.5,v[1]); gSofa[q[1]].rotation.y=v[2]; });
      [-30,30].forEach(function(de,i){ const v=put('lift',0,61,de); gFloor[i].position.set(v[0],0.2,v[1]); gFloor[i].rotation.y=v[2]; gCush[i].position.set(v[0],0.04,v[1]); });
      toast('來客模式：升降茶几升成餐桌，客人坐沙發和地墊，她在廚房準備');
    }
    renderer.shadowMap.needsUpdate=true;
  }
  const bG=$('tGuest'); if(bG) bG.addEventListener('click',function(){ guestOn=!guestOn; btn('tGuest',guestOn); applyGuest(); });

  E.FS_onChange=function(){ if(E.sportOn) applySport(); if(E.dailyOn) applyDaily(); if(E.cookOn) applyCook(); if(E.sleepOn) applySleep(); if(guestOn) applyGuest(); };
  return {applyGuest:applyGuest,applySport:applySport,applyDaily:applyDaily,applyCook:applyCook,applySleep:applySleep};
}
