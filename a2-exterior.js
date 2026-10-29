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
      g.fillStyle='hsl('+(30+r()*160)+','+(1+r()*3)+'%,'+L+'%)'; g.fillRect(x,y,PW,PH);
      for(let k=0;k<34;k++){ const bx=x+r()*PW, by=y+r()*PH, br=50+r()*230, dark=r()<0.5, gr=g.createRadialGradient(bx,by,0,bx,by,br);
        gr.addColorStop(0,dark?'rgba(40,40,40,0.045)':'rgba(255,255,255,0.05)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(x,y,PW,PH); }
      g.save(); g.beginPath(); g.rect(x,y,PW,PH); g.clip();
      for(let k=0;k<4;k++){ g.strokeStyle='rgba('+(r()<0.5?'255,255,255':'40,42,48')+','+(0.03+r()*0.04)+')'; g.lineWidth=0.8+r()*2.2; g.beginPath();
        const sx=x+r()*PW, sy=y+r()*PH; g.moveTo(sx,sy); g.bezierCurveTo(sx+r()*300-100,sy+r()*200-100,sx+r()*400-100,sy+r()*200-100,sx+r()*600-150,sy+r()*300-150); g.stroke(); }
      for(let k=0;k<5200;k++){ g.fillStyle=r()<0.5?'rgba(20,22,26,0.07)':'rgba(255,255,255,0.07)'; const s=1+r()*2; g.fillRect(x+r()*PW,y+r()*PH,s,s); }
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
    g.fillStyle='#98592a'; g.fillRect(0,0,w,h); const r=rng(23);
    for(let k=0;k<340;k++){ const x=r()*w, lw=1+r()*3.2; g.strokeStyle=r()<0.62?'rgba(92,46,18,'+(0.12+r()*0.25)+')':'rgba(222,150,88,'+(0.1+r()*0.2)+')'; g.lineWidth=lw;
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
    conc:mk(0xffffff,{map:jt,roughness:0.88}),
    gravel:mk(0xffffff,{map:gt,roughness:1}),
    step:mk(0xa9a8a3,{roughness:0.9}),
    nbr:mk(0xbab6ae,{roughness:0.95}),
    stone:mk(0x7a7873,{roughness:0.85})
  };
  M.frame.color.setHex(0x16181b); M.frame.roughness=0.42; M.frame.metalness=0.55; M.frame.envMapIntensity=0.9;
  M.entry.color.setHex(0x23262a); M.entry.roughness=0.4; M.entry.metalness=0.55;
  M.roof.color.setHex(0x2b2d31); M.roof.roughness=0.55;
  M.slab.color.setHex(0x4a4d51);
  M.glass.color.setHex(0xa9c4d2); M.glass.opacity=0.28; M.glass.envMapIntensity=1.5;
  return MX;
}
export function mats(){ return MX; }

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
  /* 2F: charcoal ring round the high north window, balcony frame with timber inside and underneath */
  (function(){ const hd=C.ceilY(C.NWALL)-0.35, sl=hd-0.6, z0=8.57, z1=11.47, m=0.12, d=NX+0.075;
    B(NX,d,z0-m,z1+m,hd,hd+m,MXc.char); B(NX,d,z0-m,z1+m,sl-m,sl,MXc.char); B(NX,d,z0-m,z0,sl-m,hd+m,MXc.char); B(NX,d,z1,z1+m,sl-m,hd+m,MXc.char); })();
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
