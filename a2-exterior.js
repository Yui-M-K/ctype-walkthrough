/* A2 exterior design: materials, cladding accents, landscaping and night lighting. Everything here is a 3D mock-up (外構（3D 示意）); none of it is in plans/a2.json.
   Coordinates: engine x = true north (plan n / 100), engine z = plan e / 100, y = metres above the 1F floor (ground = -0.3). */

let MX=null;
const rng=function(seed){ let s=seed|0||1; return function(){ s^=s<<13; s^=s>>>17; s^=s<<5; return ((s>>>0)%100000)/100000; }; };

function canvasTex(THREE,w,h,draw,srgb){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; if(srgb!==false) t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* 2.4 x 1.2 m tile = 2 x 2 large-format stone-look panels (1.2 x 0.6 m) with fine joints */
function panelTextures(THREE){
  const W=2048, H=1024, PW=1024, PH=512;
  const col=canvasTex(THREE,W,H,function(g){
    const r=rng(11);
    for(let j=0;j<2;j++) for(let i=0;i<2;i++){
      const x=i*PW, y=j*PH, L=53+r()*7;
      g.fillStyle='hsl('+(195+r()*40)+','+(2+r()*2.5)+'%,'+L+'%)'; g.fillRect(x,y,PW,PH);
      for(let k=0;k<34;k++){ const bx=x+r()*PW, by=y+r()*PH, br=50+r()*230, dark=r()<0.5, gr=g.createRadialGradient(bx,by,0,bx,by,br);
        gr.addColorStop(0,dark?'rgba(40,40,40,0.075)':'rgba(255,255,255,0.075)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(x,y,PW,PH); }
      g.save(); g.beginPath(); g.rect(x,y,PW,PH); g.clip();
      for(let k=0;k<4;k++){ g.strokeStyle='rgba('+(r()<0.5?'255,255,255':'40,42,48')+','+(0.03+r()*0.04)+')'; g.lineWidth=0.8+r()*2.2; g.beginPath();
        const sx=x+r()*PW, sy=y+r()*PH; g.moveTo(sx,sy); g.bezierCurveTo(sx+r()*300-100,sy+r()*200-100,sx+r()*400-100,sy+r()*200-100,sx+r()*600-150,sy+r()*300-150); g.stroke(); }
      for(let k=0;k<9000;k++){ g.fillStyle=r()<0.5?'rgba(20,22,26,0.1)':'rgba(255,255,255,0.1)'; const s=1+r()*3; g.fillRect(x+r()*PW,y+r()*PH,s,s); }
      g.restore();
    }
    g.fillStyle='#5f6164'; for(let i=0;i<=2;i++){ g.fillRect(i*PW-3,0,6,H); g.fillRect(0,i*PH-3,W,6); }
  });
  const bump=canvasTex(THREE,W/2,H/2,function(g,w,h){
    g.fillStyle='#9a9a9a'; g.fillRect(0,0,w,h); const r=rng(5);
    for(let k=0;k<9000;k++){ const v=120+r()*60|0; g.fillStyle='rgb('+v+','+v+','+v+')'; g.fillRect(r()*w,r()*h,2,2); }
    g.fillStyle='#000'; for(let i=0;i<=2;i++){ g.fillRect(i*w/2-2,0,4,h); g.fillRect(0,i*h/2-2,w,4); }
  },false);
  col.repeat.set(1/2.4,1/1.2); bump.repeat.set(1/2.4,1/1.2);
  return {col:col,bump:bump};
}

function woodTexture(THREE){
  const t=canvasTex(THREE,512,512,function(g,w,h){
    g.fillStyle='#82471d'; g.fillRect(0,0,w,h); const r=rng(23);
    for(let k=0;k<340;k++){ const x=r()*w, lw=1+r()*3.2; g.strokeStyle=r()<0.62?'rgba(88,50,22,'+(0.12+r()*0.25)+')':'rgba(226,170,110,'+(0.1+r()*0.2)+')'; g.lineWidth=lw;
      g.beginPath(); g.moveTo(x,0); g.bezierCurveTo(x+(r()-0.5)*8,h*0.3,x+(r()-0.5)*8,h*0.65,x+(r()-0.5)*4,h); g.stroke(); }
  });
  t.repeat.set(2,2); return t;
}

function concreteJointTex(THREE){
  return canvasTex(THREE,512,512,function(g,w,h){
    g.fillStyle='#b9b8b3'; g.fillRect(0,0,w,h); const r=rng(31);
    for(let k=0;k<7000;k++){ const v=r()<0.5?'rgba(80,80,80,0.07)':'rgba(255,255,255,0.08)'; g.fillStyle=v; g.fillRect(r()*w,r()*h,1+r()*2,1+r()*2); }
    g.fillStyle='#6f6f6c'; g.fillRect(0,0,w,5); g.fillRect(0,0,5,h);
  });
}

function gravelTexture(THREE){
  return canvasTex(THREE,512,512,function(g,w,h){
    g.fillStyle='#8d8a84'; g.fillRect(0,0,w,h); const r=rng(41);
    for(let k=0;k<5200;k++){ const l=40+r()*60|0, s=2+r()*5; g.fillStyle='hsl('+(30+r()*20)+','+(r()*8)+'%,'+(32+r()*38)+'%)'; g.beginPath(); g.ellipse(r()*w,r()*h,s,s*(0.6+r()*0.4),r()*3,0,6.3); g.fill(); }
  });
}

export function materials(THREE,E){
  const M=E.M, WM=E.WM, mk=function(c,o){ const m=new THREE.MeshStandardMaterial(Object.assign({roughness:0.8,metalness:0,envMapIntensity:0.5},o||{})); m.color.setHex(c); return m; };
  const pt=panelTextures(THREE), wt=woodTexture(THREE), jt=concreteJointTex(THREE), gt=gravelTexture(THREE);
  const panel=mk(0xffffff,{map:pt.col,bumpMap:pt.bump,bumpScale:1.2,roughness:0.72,envMapIntensity:0.55});
  Object.defineProperty(WM,'outside',{value:panel,writable:true,configurable:true,enumerable:false});   // keeps the interior-texture loader away from it
  jt.repeat.set(1/2.4,1/2.4); gt.repeat.set(1/1.6,1/1.6);
  MX={
    panel:panel,
    wood:mk(0xffffff,{map:wt,roughness:0.55,envMapIntensity:0.7}),
    char:mk(0x34373b,{roughness:0.62,metalness:0.1,envMapIntensity:0.6}),
    black:mk(0x121316,{roughness:0.4,metalness:0.55,envMapIntensity:0.9}),
    alu:mk(0xa9aeb2,{roughness:0.4,metalness:0.65,envMapIntensity:0.9}),
    conc:mk(0xffffff,{map:jt,roughness:0.88}),
    gravel:mk(0xffffff,{map:gt,roughness:1}),
    step:mk(0xa9a8a3,{roughness:0.9}),
    nbr:mk(0xa8a49c,{roughness:0.95}),
    stone:mk(0x7a7873,{roughness:0.85})
  };
  M.frame.color.setHex(0xf7f3ec); M.frame.roughness=0.5;
  M.alu=MX.alu;
  M.entry.color.setHex(0x5d6268); M.entry.roughness=0.5; M.entry.metalness=0.35;
  M.roof.color.setHex(0x2b2d31); M.roof.roughness=0.55;
  M.slab.color.setHex(0x4a4d51);
  M.grass.color.setHex(0x86a06c);
  M.glass.color.setHex(0x86a3b4); M.glass.opacity=0.4; M.glass.envMapIntensity=2;
  return MX;
}
export function mats(){ return MX; }

/* M.frame is white indoors; the faces of frame pieces that look outdoors (probed with wallRoleAt) are switched to aluminium. */
export function frameFinish(THREE,E){
  const ax=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]], v=new THREE.Vector3(), q=new THREE.Quaternion(), p=new THREE.Vector3(), nrm=new THREE.Vector3();
  E.RAIL.black.color.setHex(0xb4b9bd); E.RAIL.black.metalness=0.6;
  E.scene.updateMatrixWorld(true);
  E.LG.concat([E.ground]).forEach(function(g,l){ if(l>1) return;
    g.traverse(function(o){
      if(!o.isMesh||o.material!==E.M.frame||!o.geometry.parameters||o.geometry.parameters.width===undefined) return;
      const P=o.geometry.parameters, half=[P.width/2,P.width/2,P.height/2,P.height/2,P.depth/2,P.depth/2];
      o.getWorldPosition(p); o.getWorldQuaternion(q);
      const out=ax.map(function(a,i){ if(i===2||i===3) return false; nrm.set(a[0],a[1],a[2]).applyQuaternion(q); if(Math.abs(nrm.y)>0.5) return false;
        v.copy(p).addScaledVector(nrm,half[i]*(o.scale.x||1)+0.12); return E.wallRoleAt(l,v.x,v.z)==='outside'; });
      if(out.some(Boolean)) o.material=out.map(function(f){ return f?MX.alu:E.M.frame; });
    }); });
}

/* Cladding accents on the real walls: charcoal garage volume, timber at the entry and inside the 2F balcony frame, charcoal ring round the high window. */
export function accents(THREE,E,C){
  const bx=E.bx, G=E.ground, MXc=MX, CH=E.CH, F2=2.85, NX=C.NWALL/100+0.075;      // NX: outer face of the north wall
  const grp=new THREE.Group(); grp.name='外構（3D 示意）外壁アクセント'; G.add(grp);
  const B=function(x0,x1,z0,z1,y0,y1,m){ return bx(grp,x0,x1,z0,z1,y0,y1,m,{cast:true}); };
  /* garage: charcoal inside and out, a deep header over the opening */
  B(3.075,8.5,0.725,0.737,0,CH,MXc.char); B(3.075,3.087,0.737,4.25,0,CH,MXc.char);
  B(3.087,6.2,4.238,4.25,0,CH,MXc.char); B(6.9,8.5,4.238,4.25,0,CH,MXc.char); B(6.2,6.9,4.238,4.25,2.05,CH,MXc.char);
  (function(){ const w=4.238-0.737, g=new THREE.Mesh(new THREE.PlaneGeometry(8.5-3.087,w),MXc.char); g.rotation.x=Math.PI/2; g.position.set((8.5+3.087)/2,CH-0.004,(4.238+0.737)/2); grp.add(g); })();
  B(2.925,NX+0.045,0.555,0.575,-0.3,F2+0.03,MXc.char);
  B(NX,NX+0.045,0.555,4.375,CH,F2+0.03,MXc.char);
  B(NX,NX+0.045,4.25,4.375,-0.3,F2+0.03,MXc.char);
  /* entry: timber wall around the door (door opening 6.67-7.47 m, head 2.1 m) and a charcoal canopy */
  B(NX,NX+0.03,6.2,6.67,-0.3,F2+0.03,MXc.wood); B(NX,NX+0.03,7.47,8.0,-0.3,F2+0.03,MXc.wood); B(NX,NX+0.03,6.67,7.47,2.1,F2+0.03,MXc.wood);
  B(NX,9.6,6.2,8.0,2.42,2.52,MXc.char);
  /* 2F: aluminium surround on the high north window, balcony frame with timber inside and underneath */
  (function(){ const hd=C.ceilY(C.NWALL)-0.35, sl=hd-0.6, z0=8.57, z1=11.47, m=0.12, d=NX+0.075;
    B(NX,d,z0-m,z1+m,hd,hd+m,MXc.alu); B(NX,d,z0-m,z1+m,sl-m,sl,MXc.alu); B(NX,d,z0-m,z0,sl-m,hd+m,MXc.alu); B(NX,d,z1,z1+m,sl-m,hd+m,MXc.alu); })();
  (function(){ const bb=C.FT.balcony.rect, z0=bb[0]/100-0.07, z1=bb[2]/100+0.07, xe=NX+0.93, roofY=function(x){ return C.ceilY(x*100); }, top=roofY(xe);
    B(NX,xe,z0-0.07,z0,2.55,top,MXc.char); B(NX,xe,z1,z1+0.07,2.55,top,MXc.char);                 // side fins
    B(NX,xe,z0,z1,2.55,2.84,MXc.char);                                                           // bottom lip
    B(NX,xe,z0,z0+0.012,2.84,top,MXc.wood); B(NX,xe,z1-0.012,z1,2.84,top,MXc.wood);               // timber lining of the fins
    const g=new THREE.BufferGeometry(), ya=roofY(NX)-0.004, yb=roofY(xe)-0.004;                    // timber soffit under the sloped roof
    g.setAttribute('position',new THREE.Float32BufferAttribute([NX,ya,z0, xe,yb,z0, xe,yb,z1, NX,ya,z1],3));
    const w=z1-z0, d=xe-NX; g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0, d,0, d,w, 0,w],2)); g.setIndex([0,1,2,0,2,3]); g.computeVertexNormals();
    const s=new THREE.Mesh(g,MXc.wood); s.receiveShadow=true; grp.add(s); })();
  return grp;
}

/* timber fin screen between the garage and the entry (3D mock-up) */
export function screen(THREE,E){
  const grp=new THREE.Group(); grp.name='外構（3D 示意）木格柵屏風'; E.ground.add(grp);
  const x0=9.42, x1=9.55, z0=4.45, z1=6.6, y0=-0.3, y1=2.1, bx=E.bx;
  for(let z=z0+0.05;z<z1-0.04;z+=0.08) bx(grp,x0+0.02,x1-0.02,z,z+0.04,y0+0.06,y1-0.06,MX.wood);
  bx(grp,x0,x1,z0,z1,y1-0.06,y1,MX.char); bx(grp,x0,x1,z0,z1,y0,y0+0.06,MX.char); bx(grp,x0,x1,z0-0.05,z0+0.01,y0,y1,MX.char); bx(grp,x0,x1,z1-0.01,z1+0.05,y0,y1,MX.char);
  return grp;
}

/* ground finishes, front steps, stepping stones and slender trees */
export const LAMPS=[];
export function landscape(THREE,E,C){
  const bx=E.bx, G=E.ground, Cat=E.Catalog, grp=new THREE.Group(); grp.name='外構（3D 示意）植栽・舗装'; G.add(grp);
  const fr=function(x0,x1,z0,z1,y){ E.floorRects.push({l:0,x0:x0,x1:x1,z0:z0,z1:z1,y:y}); };
  const NX=C.NWALL/100+0.075, RX=C.LOT.south_north/100;
  bx(grp,NX,RX,4.375,6.67,-0.3,-0.2,MX.gravel); fr(NX,RX,4.375,6.67,-0.2);                                    // gravel between garage apron and porch
  bx(grp,NX,RX,4.375,4.425,-0.3,-0.17,MX.char); bx(grp,NX,RX,6.62,6.67,-0.3,-0.17,MX.char);                     // charcoal edging
  bx(grp,RX-0.3,RX,6.55,7.85,-0.3,-0.2,MX.step); fr(RX-0.3,RX,6.55,7.85,-0.2);                                  // front steps: ground -> step -> porch
  bx(grp,RX-0.6,RX-0.3,6.58,7.82,-0.3,-0.17,MX.step);
  const stones=[[5.7,13.0],[6.35,12.95],[7.0,13.05],[7.65,12.98],[8.3,13.04]];                                // stepping stones across the lawn to the east garden
  stones.forEach(function(q){ bx(grp,q[0]-0.22,q[0]+0.22,q[1]-0.28,q[1]+0.28,-0.3,-0.24,MX.step); fr(q[0]-0.22,q[0]+0.22,q[1]-0.28,q[1]+0.28,-0.24); });
  fr(2.0,7.0,19.5,22.0,3.6);                                                                                  // invisible stand for the garden-side viewpoint (eye above the fence)
  const tree=function(x,z,h,kind,sx){ const P=Cat.gardenTree(h,kind||'ash'); P.group.scale.set(sx||0.7,1,sx||0.7); P.group.position.set(x,-0.3,z); P.group.userData.keep=true; G.add(P.group); LAMPS.push({kind:'tree',x:x,z:z,h:h}); return P; };
  const shrubs=function(x,z,n,r){ for(let i=0;i<n;i++){ const a=i/n*6.28+0.6, P=Cat.shrub(r*(0.8+0.4*((i*37)%5)/5)); P.group.position.set(x+Math.cos(a)*r*1.5,-0.3,z+Math.sin(a)*r*1.5); P.group.userData.keep=true; G.add(P.group); } };
  tree(9.0,5.3,5.0); shrubs(9.0,5.3,4,0.32);                                                                    // road side, in the gravel bed behind the screen
  tree(9.35,9.3,5.6,'ash',0.6); shrubs(9.35,9.3,3,0.3);
  tree(9.4,0.3,5.4,'ash',0.55);                                                                                // beside the garage
  tree(5.7,13.2,5.4); shrubs(6.8,13.25,3,0.3);                                                                  // east garden, near the stepping stones
  return grp;
}

/* ---------------- night: warm windows, lit entry / garage / balcony, uplit trees, light washes, sky ---------------- */
const clamp=function(v,a,b){ return v<a?a:v>b?b:v; };
const mix=function(a,b,t){ return a+(b-a)*t; };

function glowTextures(THREE){
  const lin=(function(){ const c=document.createElement('canvas'); c.width=4; c.height=128; const g=c.getContext('2d'), gr=g.createLinearGradient(0,0,0,128);
    [[0,1],[0.12,0.75],[0.35,0.32],[0.65,0.09],[1,0]].forEach(function(q){ gr.addColorStop(q[0],'rgba(255,255,255,'+q[1]+')'); }); g.fillStyle=gr; g.fillRect(0,0,4,128);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  const rad=(function(){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'), gr=g.createRadialGradient(64,64,0,64,64,64);
    [[0,1],[0.25,0.7],[0.55,0.28],[0.8,0.07],[1,0]].forEach(function(q){ gr.addColorStop(q[0],'rgba(255,255,255,'+q[1]+')'); }); g.fillStyle=gr; g.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  const win=(function(){ const c=document.createElement('canvas'); c.width=64; c.height=128; const g=c.getContext('2d'), gr=g.createLinearGradient(0,0,0,128);
    gr.addColorStop(0,'#ffe9bd'); gr.addColorStop(0.55,'#ffd48e'); gr.addColorStop(1,'#e0a25c'); g.fillStyle=gr; g.fillRect(0,0,64,128);
    const rg=g.createRadialGradient(32,40,4,32,60,70); rg.addColorStop(0,'rgba(255,248,220,0.55)'); rg.addColorStop(1,'rgba(255,248,220,0)'); g.fillStyle=rg; g.fillRect(0,0,64,128);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  return {lin:lin,rad:rad,win:win};
}

/* twilight sky: vertical gradient by sun altitude, a warm glow towards the sunset, stars when dark */
const SKY=[[6,['#4f86d1','#8fb6e6','#d8e4f0','#f4e2c8']],[2,['#35579a','#8d86b8','#f2a984','#ffd3a0']],[-1,['#233a7c','#5d6aa6','#d98d86','#f6b98e']],
  [-4,['#16318a','#3a5cae','#7f9bd0','#d3a9a8']],[-8,['#0f2160','#26438a','#4d6cae','#8195be']],[-14,['#08123a','#12255a','#20396f','#394f7c']],[-20,['#040815','#09132e','#111f42','#233352']]];
const hexRGB=function(h){ return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; };
function skyColors(alt){
  let i=0; while(i<SKY.length-1&&alt<SKY[i+1][0]) i++;
  const a=SKY[i], b=SKY[Math.min(i+1,SKY.length-1)], t=a===b?0:clamp((a[0]-alt)/(a[0]-b[0]),0,1);
  return a[1].map(function(c,k){ const p=hexRGB(c), q=hexRGB(b[1][k]); return 'rgb('+Math.round(mix(p[0],q[0],t))+','+Math.round(mix(p[1],q[1],t))+','+Math.round(mix(p[2],q[2],t))+')'; });
}

export function night(THREE,E,C){
  const TX=glowTextures(THREE), LG=E.LG, G=E.ground, st={k:0}, objs=[];
  const NX=C.NWALL/100+0.075, F2=2.85, V3=function(x,y,z){ return new THREE.Vector3(x,y,z); };
  const amb=function(c,o,tex,blend){ return new THREE.MeshBasicMaterial(Object.assign({map:tex||TX.lin,color:c,transparent:true,opacity:0,blending:blend||THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1},o||{})); };
  const WARM=0xffc98f, LED=amb(WARM), POOL=amb(0xffc27a,{},TX.rad), POOLC=amb(0xffd9a8,{},TX.rad), GLOWB=amb(0xffb870,{},TX.rad,THREE.AdditiveBlending);
  const WINM=[0.96,0.84,0.7].map(function(o){ return new THREE.MeshBasicMaterial({map:TX.win,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,fog:true}); });
  const WINMAX=[0.96,0.84,0.7];
  const lampMat=new THREE.MeshBasicMaterial({color:0x50555a});
  const reg=function(m,grp){ grp.add(m); m.castShadow=m.receiveShadow=false; objs.push(m); return m; };
  const quad=function(grp,a,b,d,mat){ const g=new THREE.BufferGeometry(), c=b.clone().add(d), e=a.clone().add(d);
    g.setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,e.x,e.y,e.z],3)); g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));
    g.setIndex([0,1,2,0,2,3,0,2,1,0,3,2]); const m=new THREE.Mesh(g,mat); m.renderOrder=2; return reg(m,grp); };
  const pool=function(grp,x,y,z,w,d,mat){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat||POOL); m.rotation.x=-Math.PI/2; m.position.set(x,y,z); m.renderOrder=2; return reg(m,grp); };
  const strip=function(grp,x0,x1,z0,z1,y,h){ const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,h||0.025,z1-z0),lampMat); m.position.set((x0+x1)/2,y,(z0+z1)/2); grp.add(m); return m; };
  const disc=function(grp,x,y,z,r){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.02,16),lampMat); m.position.set(x,y,z); grp.add(m); return m; };
  const lights=[], plight=function(grp,x,y,z,I,dist,col){ const p=new THREE.PointLight(col||0xffc88e,0,dist||7,2); p.position.set(x,y,z); p.userData.I=I; grp.add(p); lights.push(p); return p; };

  /* windows of the real walls: warm cards just inside the glass, only on walls that face outdoors */
  (function(){
    const P=C.PLAN; let n=0;
    [[P.levels[0],0],[P.levels[1],1]].forEach(function(q){ const L=q[0], l=q[1], y0=l*F2;
      L.walls.forEach(function(w){ const ew=w.axis==='ew', c=(ew?w.a[1]:w.a[0])/100, wins=w.openings.filter(function(o){ return o.kind==='window'||o.kind==='slide'; });
        wins.forEach(function(o){
          if(o.kind==='slide'||o.code==='H1'||o.code==='H2') return;
          if(o.code==='F'&&wins.some(function(p){ return p!==o&&p.from<=o.from+0.5&&p.to>=o.to-0.5; })) return;
          const mid=(o.from+o.to)/200, off=0.2, pa=ew?[c+off,mid]:[mid,c+off], na=ew?[c-off,mid]:[mid,c-off];
          const rp=E.wallRoleAt(l,pa[0],pa[1]), rn=E.wallRoleAt(l,na[0],na[1]);
          if((rp==='outside')===(rn==='outside')) return;
          const sgn=rp==='outside'?1:-1, slide=o.code==='S'||(o.code===''&&(l===1&&ew&&Math.abs(c-C.NWALL/100)<0.01)), sill=slide?0.05:0.9, head=slide?2.1:2.1;
          const width=(o.to-o.from)/100-0.1, h=head-sill-0.08, m=new THREE.Mesh(new THREE.PlaneGeometry(width,h),WINM[n%3]);
          const px=ew?c-sgn*0.04:mid, pz=ew?mid:c-sgn*0.04; m.position.set(px,y0+sill+0.04+h/2,pz); m.rotation.y=ew?(sgn>0?Math.PI/2:-Math.PI/2):(sgn>0?0:Math.PI); m.renderOrder=2;
          LG[l].add(m); objs.push(m); n++; });
      }); });
    const hd=C.ceilY(C.NWALL)-0.35, sl=hd-0.6, m=new THREE.Mesh(new THREE.PlaneGeometry(2.8,0.52),WINM[0]); m.position.set(C.NWALL/100-0.035,(hd+sl)/2,10.02); m.rotation.y=Math.PI/2; m.renderOrder=2; LG[0].add(m); objs.push(m);   // high slit window over the void
    const bay=C.FT.bayWindow.rect, bx0=bay[1]/100, bx1=bay[3]/100, bz0=bay[0]/100, bz1=bay[2]/100;
    [[(bx0+bx1)/2,bz1-0.05,0,bx1-bx0-0.2],[bx1-0.05,(bz0+bz1)/2,Math.PI/2,bz1-bz0-0.2],[bx0+0.05,(bz0+bz1)/2,-Math.PI/2,bz1-bz0-0.2]].forEach(function(f){
      const b=new THREE.Mesh(new THREE.PlaneGeometry(f[3],1.5),WINM[1]); b.position.set(f[0],1.25,f[1]); b.rotation.y=f[2]; b.renderOrder=2; LG[0].add(b); objs.push(b); });
  })();

  /* eave: LED line where the roof overhang meets the north wall, washing the stone downwards */
  (function(){ const y=C.ceilY(C.NWALL)-0.02;
    strip(LG[2],NX,NX+0.04,0.3,12.0,y); quad(LG[2],V3(NX+0.01,y-0.03,0.3),V3(NX+0.01,y-0.03,12.0),V3(0,-1.7,0),LED); })();
  /* balcony frame: LED line under the soffit and a wash down the timber lining; the glass door beside it stays warm */
  (function(){ const bb=C.FT.balcony.rect, z0=bb[0]/100-0.07, z1=bb[2]/100+0.07, xe=NX+0.93, top=C.ceilY(xe*100)-0.03;
    strip(LG[1],xe-0.08,xe-0.04,z0+0.03,z1-0.03,top); quad(LG[1],V3(NX,top,z0+0.016),V3(xe,top,z0+0.016),V3(0,-2.2,0),LED); quad(LG[1],V3(NX,top,z1-0.016),V3(xe,top,z1-0.016),V3(0,-2.2,0),LED);
    pool(LG[1],NX+0.5,F2+0.012,(z0+z1)/2,1.4,1.7,POOL);
    plight(LG[1],NX+0.45,top-0.15,(z0+z1)/2,5,5); })();
  /* garage: ceiling lines, walls washed, a pool under the car */
  (function(){ const y=2.5;
    [1.7,3.25].forEach(function(z){ strip(LG[0],3.5,8.3,z-0.03,z+0.03,y); });
    quad(LG[0],V3(3.1,y,0.745),V3(8.45,y,0.745),V3(0,-1.7,0),LED); quad(LG[0],V3(3.1,y,4.236),V3(8.45,y,4.236),V3(0,-1.7,0),LED); quad(LG[0],V3(3.1,y,0.75),V3(3.1,y,4.23),V3(0,-1.7,0),LED);
    pool(LG[0],6.0,0.012,2.5,5.4,3.4,POOLC);
    plight(LG[0],6.0,2.2,2.5,7,8); })();
  /* entry: canopy downlights, timber wall wash, step lights */
  (function(){ [6.55,7.07,7.6].forEach(function(z){ disc(G,9.0,2.415,z,0.05); });
    quad(G,V3(NX+0.034,2.42,6.2),V3(NX+0.034,2.42,8.0),V3(0,-1.9,0),LED);
    pool(G,9.0,-0.088,7.07,2.6,2.2,POOL);
    [6.6,7.8].forEach(function(z){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,12),E.M.black); m.position.set(9.6,-0.05,z); G.add(m); disc(G,9.6,0.215,z,0.045); pool(G,9.6,-0.19,z,1.2,1.2,POOL); });
    plight(G,9.0,2.2,7.07,8,8); })();
  /* screen: glow in the gaps from behind, pool on the gravel */
  (function(){ quad(G,V3(9.4,-0.2,4.5),V3(9.4,-0.2,6.55),V3(0,1.9,0),LED); pool(G,9.0,-0.19,5.5,2.6,2.8,POOL); })();
  /* trees: a lamp at the foot, a pool on the ground and a soft glow up the trunk */
  LAMPS.forEach(function(t,i){
    disc(G,t.x+0.35,-0.28,t.z+0.2,0.07); pool(G,t.x,-0.27,t.z,2.6,2.6,POOL);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.rad,color:0xffb36b,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:true})); s.scale.set(3.0,4.2,1); s.position.set(t.x,Math.min(2.6,t.h*0.5),t.z); G.add(s); s.userData.sprite=0.34; objs.push(s);
    plight(G,t.x,0.4,t.z,i===0||i===3?26:14,9,0xffb877); });

  let apply=function(alt){
    const k=clamp((3-alt)/3,0,1); st.k=k;
    LED.opacity=0.78*k; POOL.opacity=0.55*k; POOLC.opacity=0.5*k;
    WINM.forEach(function(m,i){ m.opacity=WINMAX[i]*k; });
    lampMat.color.setHex(k>0.02?0xffe6bd:0x50555a); lampMat.color.lerp(new THREE.Color(0x50555a),1-k);
    objs.forEach(function(o){ o.visible=k>0.003; if(o.userData.sprite!==undefined) o.material.opacity=o.userData.sprite*k; });
    lights.forEach(function(p){ p.intensity=p.userData.I*k; });
  };
  const leaves=new Set(); G.traverse(function(o){ if(o.isInstancedMesh&&o.material&&o.material.alphaTest>0.4) leaves.add(o.material); });
  const leafGlow=new THREE.Color(0x24401f), black=new THREE.Color(0);
  const apply0=apply; apply=function(alt){ apply0(alt); leaves.forEach(function(m){ m.emissive.copy(black).lerp(leafGlow,st.k*0.7); }); };
  apply(40);
  return {apply:function(a){ apply(a); },state:st};
}

/* background sky for a given sun altitude (equirectangular canvas, redrawn when the altitude moves) */
export function sky(THREE){
  const c=document.createElement('canvas'); c.width=2048; c.height=1024; const g=c.getContext('2d');
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.mapping=THREE.EquirectangularReflectionMapping;
  const rr=rng(77), stars=[]; for(let i=0;i<260;i++) stars.push([rr()*2048,rr()*430,0.25+rr()*0.6,rr()<0.1?2:1]);
  let last=null;
  return {
    tex:tex,
    fog:function(alt){ return skyColors(alt)[3]; },
    draw:function(alt,dirx,dirz){
      const key=alt.toFixed(1)+'|'+(dirx||0).toFixed(2); if(key===last) return tex; last=key;
      const col=skyColors(alt), gr=g.createLinearGradient(0,0,0,512);
      gr.addColorStop(0,col[0]); gr.addColorStop(0.5,col[1]); gr.addColorStop(0.85,col[2]); gr.addColorStop(1,col[3]); g.fillStyle=gr; g.fillRect(0,0,2048,512);
      const gg=g.createLinearGradient(0,512,0,760); gg.addColorStop(0,col[3]); gg.addColorStop(1,'rgb(14,18,30)'); g.fillStyle=gg; g.fillRect(0,512,2048,512);
      const gl=clamp((4-alt)/6,0,1)*clamp((alt+14)/12,0,1);
      if(gl>0.01){ const u=(Math.atan2(dirz,dirx)/(2*Math.PI)+0.5)*2048, rg=g.createRadialGradient(u,512,0,u,512,420); rg.addColorStop(0,'rgba(255,170,100,'+(0.55*gl)+')'); rg.addColorStop(0.5,'rgba(255,120,110,'+(0.2*gl)+')'); rg.addColorStop(1,'rgba(255,120,110,0)'); g.fillStyle=rg; g.fillRect(0,0,2048,512); }
      const sa=clamp((-alt-6)/10,0,1); if(sa>0) stars.forEach(function(s){ g.fillStyle='rgba(255,255,255,'+(s[2]*sa)+')'; g.fillRect(s[0],s[1],s[3],s[3]); });
      tex.needsUpdate=true; return tex; }
  };
}
