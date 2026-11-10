/* A2 bay window (出窗) platform, written after the lounging bay of ideal_c.html: an oak deck over three drawers facing the room, one thick linen cushion end to end,
   soft pillows leaning on the glass, lace sheers on the two side faces and a warm LED line under the head. The platform keeps its 85 x 230 cm footprint and its 40 cm
   top (the deck is 31 cm, the 9 cm cushion brings the surface back to 40 cm, which is where the sun analysis measures it). Engine metres: x = n / 100, z = e / 100. */
export function bay(THREE,E,C){
  const {Catalog,LG,M,bx,rbox,furnThings,furnAnims,lam,fab,notchPull}=E, G=LG[0], oc={cast:false};
  const pf=C.pf, b=C.bay, x0=pf[1]/100, x1=pf[3]/100, zf=pf[0]/100, zg=pf[2]/100, X0=b[1]/100, X1=b[3]/100;   // platform and glazed opening (x: south..north, z: room..glass)
  const TOP=0.40, DECK=0.31, DD=0.70, HEAD=2.1;
  const W=M.cabF, oakE=lam(0xd2b184,{roughness:0.5,map:M.oak.map||null}), lining=lam(0xeae4d8,{roughness:0.6});
  /* carcass: a recessed kick, the full-width base, the solid rear block behind the drawers, the oak top */
  bx(G,x0,x1,zf+0.02,zg,0,0.05,W); bx(G,x0,x1,zf+0.02+DD,zg,0.05,DECK-0.03,W); bx(G,x0,x1,zf,zg,DECK-0.03,DECK,oakE);
  bx(G,x0,x1,zf+0.003,zf+0.02,0,0.06,lam(0x9a8f82,{roughness:0.7}),oc);
  const third=(x1-x0)/3;
  for(let k=0;k<4;k++){ const x=x0+third*k; bx(G,Math.max(x0,x-0.009),Math.min(x1,x+0.009),zf+0.02,zf+DD,0.05,DECK-0.03,W); }   // drawer dividers and the two ends
  /* drawers: all three have a front with a finger-pull notch; the north one slides out (the other two stand behind the massage chair) */
  const fills=function(Gd,a,c,y){ bx(Gd,a+0.05,c-0.05,zf+0.08,zf+0.4,y,y+0.07,fab(0xc8714f)); [[0xc8372f,0.06],[0x2f6fb5,0.05],[0xf2c94c,0.07]].forEach(function(q,k){ bx(Gd,a+0.06,a+0.36,zf+0.44,zf+0.66,y+k*0.065,y+q[1]+k*0.065,lam(q[0],{roughness:0.6})); }); };   // a folded throw and board games
  [0,1,2].forEach(function(k){ const a=x0+third*k+0.003, c=x0+third*(k+1)-0.003, y0=0.065, y1=DECK-0.04, Gd=new THREE.Group(); Gd.userData.keep=true; G.add(Gd);
    const fr=bx(Gd,a,c,zf,zf+0.02,y0,y1,oakE); const n=notchPull(0xb9956a,0.18); n.position.set((a+c)/2,y1-0.003,zf); n.rotation.y=Math.PI; Gd.add(n);
    if(k!==2) return;
    bx(Gd,a+0.02,c-0.02,zf+0.02,zf+DD-0.02,y0+0.01,y0+0.022,lining); [a+0.02,c-0.032].forEach(function(x){ bx(Gd,x,x+0.012,zf+0.02,zf+DD-0.02,y0+0.01,y1-0.03,lining); }); bx(Gd,a+0.02,c-0.02,zf+DD-0.032,zf+DD-0.02,y0+0.01,y1-0.03,lining);
    fills(Gd,a,c,y0+0.022);
    let cur=0, tg=0, last=null;
    furnThings.push({pt:[(a+c)/2,zf-0.5],l:0,part:[fr],on:function(){ return true; },label:function(){ return tg?'關上出窗下的抽屜':'拉開出窗下的抽屜（毯子・桌遊）'; },act:function(){ tg=tg?0:1; last=null; }});
    furnAnims.push({live:function(){ return cur!==tg; },f:function(t){ if(last===null) last=t; const dt=Math.min(0.05,t-last); last=t; cur=Math.abs(tg-cur)<dt*1.6?tg:cur+Math.sign(tg-cur)*dt*1.6; Gd.position.z=-0.42*cur*cur*(3-2*cur); E.renderer.shadowMap.needsUpdate=true; return true; }}); });
  /* one thick linen cushion, with seams, and the pillows */
  const cush=fab(0xcfc5b4), seam=fab(0xbfb3a0);
  rbox(G,x0+0.01,x1-0.01,zf+0.005,zg-0.02,DECK,TOP,0.035,cush);
  [1,2].forEach(function(k){ const x=x0+third*k; bx(G,x-0.004,x+0.004,zf+0.03,zg-0.04,TOP-0.002,TOP+0.002,seam,oc); });
  const pil=[0xd9cfc0,0xa9a9a4,0xcdbba0,0x7d786f,0xe9e2d4];
  [[x0+0.36,zg-0.24,0.22,0.18,0.45,0.42],[x0+0.86,zg-0.22,-0.1,0.24,0.45,0.42],[x1-0.4,zg-0.24,-0.25,0.14,0.42,0.4],[x0+0.33,zf+0.32,0.15,-1.45,0.5,0.34],[x0+1.25,zg-0.2,0.05,0.2,0.4,0.4]].forEach(function(q,i){
    const P=Catalog.softPillow(q[4],q[5],i===3?0.09:0.15,fab(pil[i])); P.rotation.order='YXZ'; P.rotation.y=q[2]; P.rotation.x=q[3]; P.position.set(q[0],TOP+(i===3?0.045:q[5]/2*Math.cos(q[3])+0.02),q[1]); P.traverse(function(o){ o.castShadow=true; }); G.add(P); });
  bx(G,x1-0.62,x1-0.06,zf+0.18,zf+0.62,TOP,TOP+0.035,fab(0x9aa39a),oc);                                  // a folded throw at the north end
  /* LED line under the head's front edge */
  const led=new THREE.MeshBasicMaterial({color:0xffd9a0}); if(E.dusk) E.dusk(led);
  bx(G,X0+0.03,X1-0.03,b[0]/100+0.03,b[0]/100+0.05,HEAD-0.012,HEAD,led,oc);
  /* lace sheers on the two side faces (north and south), gathered toward the room; one switch pulls both */
  const lace=(function(){ const c=document.createElement('canvas'); c.width=256; c.height=1024; const g=c.getContext('2d'); let r=29; const rnd=function(){ r=(r*16807)%2147483647; return r/2147483647; };
    g.fillStyle='rgba(255,255,253,0.6)'; g.fillRect(0,0,256,1024); g.strokeStyle='rgba(250,248,242,0.35)'; for(let x=0;x<256;x+=3){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,1024); g.stroke(); }
    const sprig=function(x,y,s){ g.fillStyle='rgba(255,255,252,0.97)'; for(let k=0;k<5;k++){ const a=k*Math.PI*2/5; g.beginPath(); g.ellipse(x+Math.cos(a)*6*s,y+Math.sin(a)*6*s,5*s,2.6*s,a,0,7); g.fill(); } g.beginPath(); g.arc(x,y,2.5*s,0,7); g.fill(); g.strokeStyle='rgba(255,255,252,0.9)'; g.lineWidth=1.5*s; g.beginPath(); g.moveTo(x,y+6*s); g.quadraticCurveTo(x+8*s,y+16*s,x+4*s,y+24*s); g.stroke(); };
    for(let k=0;k<60;k++) sprig(16+rnd()*224,30+rnd()*880,0.7+rnd()*0.6);
    g.clearRect(0,990,256,34); g.fillStyle='rgba(255,255,252,0.95)'; for(let x=0;x<256;x+=32){ g.beginPath(); g.arc(x+16,990,16,0,Math.PI); g.fill(); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; t.wrapS=THREE.RepeatWrapping; return t; })();
  const sets=[], zc0=zf+0.03, zc1=b[2]/100-0.07, L=zc1-zc0;
  [X0+0.07,X1-0.07].forEach(function(x){
    const g=new THREE.Group(); g.position.set(x,0,(zc0+zc1)/2); g.rotation.y=-Math.PI/2; g.userData.keep=true; G.add(g);
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,L,8),lam(0xd8d2c6,{roughness:0.4})); rod.rotation.z=Math.PI/2; rod.position.y=HEAD-0.06; g.add(rod);
    const piv=new THREE.Group(); piv.position.x=-L/2; g.add(piv); const n=Math.max(4,Math.round(L/0.08)), ph=HEAD-TOP-0.22;
    const pg=new THREE.PlaneGeometry(L,ph,Math.max(24,n*6),8), pp=pg.attributes.position; for(let i=0;i<pp.count;i++){ const px=pp.getX(i)+L/2; pp.setXYZ(i,px,pp.getY(i),0.012*Math.sin(px/L*Math.PI*2*n/2)+0.003*Math.sin(px*61)); } pg.computeVertexNormals();
    const lm=new THREE.MeshStandardMaterial({color:0xffffff,map:lace.clone(),roughness:0.85,transparent:true,alphaTest:0.04,side:THREE.DoubleSide,depthWrite:false}); lm.map.repeat.set(L/0.42,1); lm.map.needsUpdate=true;
    const m=new THREE.Mesh(pg,lm); m.position.set(0,(HEAD+TOP+0.1)/2-0.02,0); m.renderOrder=1; piv.add(m); piv.scale.x=0.2; sets.push(piv); });
  let so=1, st=1, sl=null;
  furnThings.push({pt:[(x0+x1)/2,zf-0.45],l:0,label:function(){ return st?'拉上出窗紗簾':'拉開出窗紗簾'; },act:function(){ st=st?0:1; sl=null; }});
  furnAnims.push({live:function(){ return so!==st; },f:function(t){ if(sl===null) sl=t; const dt=Math.min(0.05,t-sl); sl=t; so=Math.abs(st-so)<dt*1.2?st:so+Math.sign(st-so)*dt*1.2; sets.forEach(function(p){ p.scale.x=1-0.8*so; }); return true; }});
}
