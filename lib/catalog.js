/* Shared furniture catalogue. Every piece has a FIXED size and is drawn around its own centre (origin on the floor, metres;
   which side is the front is recorded per type in Catalog.TYPES). A house decides where and how it turns: it adds `piece.group` to its scene and copies `piece.cols` (collision
   rectangles, local metres) into its own collision list after rotating them (see placePiece in the house).
   Knows nothing about a particular house: materials, textures, random numbers and the contact-shadow decal come in through `env`.

   env: THREE, M (material slots used: pot, dark, black, leaf, leafL, oak, oakD, oakChair, chairBack, steel, shade, sofa, sofaD, cushA, cushB, ceramic, cabF),
        lam(color,opts), fab(color,opts), lampMat, ceilingH, anisotropy, rnd(), contactShadow(x0,x1,z0,z1,y,group), enableLocalClipping() */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  const TAU=Math.PI*2;
  Walk.PIECES=Walk.PIECES||new WeakMap();      // piece.group -> piece, so a later pass can tell which groups have moving parts

  Walk.Catalog=function(env){
    const THREE=env.THREE, M=env.M, GROOVE=env.groove&&env.notch?true:null;   // env.groove: finger-pull notches instead of bar handles on built-in fronts
    const NOTCH=function(parent,x,y,z,ry,rz,w,col){ const n=env.notch(col===undefined?M.cabF.color.getHex():col,Math.min(0.18,w*0.6)); n.position.set(x,y,z); n.rotation.set(0,ry,rz||0); parent.add(n); return n; };   // ry turns the front's normal from +z; rz=PI puts it on the bottom edge

    function fitUV(g,w,h,d){                   // box textures repeat once per metre on every face instead of stretching
      const uv=g.attributes.uv, dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
      for(let f=0;f<6;f++){ const s=dims[f]; for(let i=f*4;i<f*4+4;i++) uv.setXY(i,uv.getX(i)*s[0],uv.getY(i)*s[1]); }
    }

    /* Builds one piece: same drawing helpers as the houses use, but in local metres and into its own group. */
    class Piece{
      constructor(){ this.group=new THREE.Group(); this.cols=[]; this.anims=[]; Walk.PIECES.set(this.group,this); }   // anims: callbacks (t, state) the house runs every frame
      add(m,o){ o=o||{}; m.castShadow=o.cast!==false; m.receiveShadow=o.recv!==false; if(o.detail) m.userData.detail=true; this.group.add(m); return m; }
      box(x0,x1,z0,z1,y0,y1,mat,o){
        const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0); fitUV(g,x1-x0,y1-y0,z1-z0);
        const m=new THREE.Mesh(g,mat); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); return this.add(m,o);
      }
      rbox(x0,x1,z0,z1,y0,y1,r,mat,o){         // box with rounded vertical edges and bevelled top/bottom
        const w=x1-x0, d=z1-z0, h=y1-y0, bv=Math.min(r,h/2-0.002), sw=w-2*bv, sd=d-2*bv, rc=Math.min(r,sw/2,sd/2);
        const s=new THREE.Shape();
        s.moveTo(-sw/2+rc,-sd/2); s.lineTo(sw/2-rc,-sd/2); s.quadraticCurveTo(sw/2,-sd/2,sw/2,-sd/2+rc);
        s.lineTo(sw/2,sd/2-rc); s.quadraticCurveTo(sw/2,sd/2,sw/2-rc,sd/2);
        s.lineTo(-sw/2+rc,sd/2); s.quadraticCurveTo(-sw/2,sd/2,-sw/2,sd/2-rc);
        s.lineTo(-sw/2,-sd/2+rc); s.quadraticCurveTo(-sw/2,-sd/2,-sw/2+rc,-sd/2);
        const g=new THREE.ExtrudeGeometry(s,{depth:h-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelSegments:3,curveSegments:5});
        const m=new THREE.Mesh(g,mat); m.rotation.x=-Math.PI/2; m.position.set((x0+x1)/2,y0+bv,(z0+z1)/2); return this.add(m,o);
      }
      rotBox(cx,cz,len,thk,y0,y1,ang,mat,o){   // box rotated about the vertical axis
        const g=new THREE.BoxGeometry(len,y1-y0,thk); fitUV(g,len,y1-y0,thk);
        const m=new THREE.Mesh(g,mat); m.position.set(cx,(y0+y1)/2,cz); m.rotation.y=ang; return this.add(m,o);
      }
      cyl(cx,cz,r0,r1,y0,y1,mat,o,seg){
        const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,y1-y0,seg||20,1,!!(o&&o.open)),mat); m.position.set(cx,(y0+y1)/2,cz); return this.add(m,o);
      }
      _col(x0,x1,z0,z1,shadow){ this.cols.push({x0:x0,x1:x1,z0:z0,z1:z1,kind:'f'}); if(shadow) env.contactShadow(x0,x1,z0,z1,0,this.group); }
      fb(cx,cz,w,d,h,mat,y0,col){ y0=y0||0; const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2, m=this.box(x0,x1,z0,z1,y0,y0+h,mat); if(col) this._col(x0,x1,z0,z1,true); return m; }
      rb(cx,cz,w,d,h,r,mat,y0,col){ y0=y0||0; const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2, m=this.rbox(x0,x1,z0,z1,y0,y0+h,r,mat); if(col) this._col(x0,x1,z0,z1,true); return m; }
      fcyl(cx,cz,r0,r1,y0,h,mat,col){ const m=this.cyl(cx,cz,r0,r1,y0,y0+h,mat); if(col){ const r=Math.max(r0,r1); this._col(cx-r,cx+r,cz-r,cz+r,false); } return m; }
      legs(cx,cz,hw,hd,h,r0,r1,mat){ [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(s=>{ this.fcyl(cx+s[0]*hw,cz+s[1]*hd,r0,r1,0,h,mat,false); }); }
      shade(cx,cz,r0,r1,y0,y1){ return this.cyl(cx,cz,r0,r1,y0,y1,M.shade,{cast:false,open:true},20); }
      attach(piece,x,z,rotQ){                   // put another piece inside this one (x,z = its centre here, rotQ quarter turns); keeps its collision rectangles
        rotQ=((rotQ||0)%4+4)%4; piece.group.position.set(x,0,z); piece.group.rotation.y=rotQ*Math.PI/2; this.group.add(piece.group);
        piece.cols.forEach(c=>{ let x0=c.x0,x1=c.x1,z0=c.z0,z1=c.z1; for(let k=0;k<rotQ;k++){ const a=z0,b=z1,d=-x1,e=-x0; x0=a; x1=b; z0=d; z1=e; } this.cols.push({x0:x0+x,x1:x1+x,z0:z0+z,z1:z1+z,kind:'f'}); });
        return piece;
      }
      cabDoors(run,a0,a1,plane,side,y0,y1,n,low,mat,th){   // door fronts with seams and bar handles on one face of a cabinet
        const w=(a1-a0)/n, t=th||0.016, d={cast:false}, dd={cast:false,detail:true};
        const p0=side>0?plane:plane-t, p1=side>0?plane+t:plane, h0=side>0?plane+t:plane-t-0.012, h1=side>0?plane+t+0.012:plane-t;
        for(let i=0;i<n;i++){
          const ca=a0+w*i, hx=ca+w*(i%2?0.14:0.86), hy0=low?y0+0.05:y1-0.21, hy1=hy0+0.15;
          const nt=GROOVE&&!mat, fz=side>0?plane+t:plane-t, hi=i%2===0, ny=y1-y0>1.2?Math.min(Math.max(1.05,y0+0.12),y1-0.12):low?y0+0.12:y1-0.12, sd=side>0?1:-1;   // vertical notch on the free edge (handle side)
          if(run==='x'){ this.box(ca+0.003,ca+w-0.003,p0,p1,y0,y1,mat||M.cabF,d); if(nt) NOTCH(this.group,hi?ca+w-0.003:ca+0.003,ny,fz,side>0?0:Math.PI,(hi?-1:1)*sd*Math.PI/2,0.18); else this.box(hx-0.008,hx+0.008,h0,h1,hy0,hy1,M.steel,dd); }
          else { this.box(p0,p1,ca+0.003,ca+w-0.003,y0,y1,mat||M.cabF,d); if(nt) NOTCH(this.group,fz,ny,hi?ca+w-0.003:ca+0.003,side>0?Math.PI/2:-Math.PI/2,(hi?1:-1)*sd*Math.PI/2,0.18); else this.box(h0,h1,hx-0.008,hx+0.008,hy0,hy1,M.steel,dd); }
        }
      }
    }

    /* ---------- pieces ---------- */
    const Catalog={ Piece:Piece, fitUV:fitUV };
    /* Packaged food and household refills told apart by form and print, never by big words: Catalog.pack(kind,o) returns a group standing on y=0,
       front +z. kinds: box, bag, can, tin, jar, pastaJar, cup, carton, pouch, bottle. o: w,h,d or r,h; c main colour, a accent, m motif, fill, seed */
    Catalog.pack=(function(){
      const texC={}, matC={};
      const hex=function(c){ return '#'+(c>>>0).toString(16).padStart(6,'0').slice(-6); };
      const mix=function(c,k){ const r=(c>>16)&255, g=(c>>8)&255, b=c&255, f=function(v){ return Math.round(k>0?v+(255-v)*k:v*(1+k)); }; return (f(r)<<16)|(f(g)<<8)|f(b); };
      const rr=function(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
      const motifs={
        cereal:function(g,x,y,s,R){ g.fillStyle='#f6f3ec'; g.beginPath(); g.ellipse(x,y+s*0.12,s*0.42,s*0.18,0,0,Math.PI); g.fill(); g.fillStyle='#ffffff'; g.beginPath(); g.ellipse(x,y+s*0.12,s*0.42,s*0.08,0,0,Math.PI*2); g.fill();
          for(let i=0;i<34;i++){ const a=R()*Math.PI*2, d=R()*s*0.36; g.fillStyle=R()<0.5?'#d9932f':'#c97a25'; g.beginPath(); g.ellipse(x+Math.cos(a)*d,y+s*0.06+Math.sin(a)*d*0.25-s*0.03,s*0.04,s*0.025,R()*3,0,Math.PI*2); g.fill(); }
          g.strokeStyle='#cfd3d6'; g.lineWidth=s*0.03; g.beginPath(); g.moveTo(x+s*0.2,y); g.lineTo(x+s*0.48,y-s*0.3); g.stroke(); },
        chips:function(g,x,y,s,R){ for(let i=0;i<16;i++){ const px=x+(R()-0.5)*s*0.8, py=y+(R()-0.5)*s*0.6; const gr=g.createRadialGradient(px,py,1,px,py,s*0.13); gr.addColorStop(0,'#f7d77a'); gr.addColorStop(1,'#d9a33a'); g.fillStyle=gr; g.beginPath(); g.ellipse(px,py,s*0.13,s*0.09,R()*3,0,Math.PI*2); g.fill(); } },
        tomato:function(g,x,y,s,R){ [[-0.16,0.02,0.2],[0.14,-0.04,0.17],[0.02,0.16,0.15]].forEach(function(q){ const px=x+q[0]*s, py=y+q[1]*s, r=q[2]*s, gr=g.createRadialGradient(px-r*0.3,py-r*0.3,1,px,py,r); gr.addColorStop(0,'#ff7a5c'); gr.addColorStop(1,'#b8221a'); g.fillStyle=gr; g.beginPath(); g.arc(px,py,r,0,Math.PI*2); g.fill(); g.fillStyle='#3f8a3a'; g.beginPath(); for(let k=0;k<5;k++){ const a=k*1.2566; g.lineTo(px+Math.cos(a)*r*0.35,py-r*0.85+Math.sin(a)*r*0.2); g.lineTo(px+Math.cos(a+0.6)*r*0.1,py-r*0.85+Math.sin(a+0.6)*r*0.06); } g.fill(); }); },
        fish:function(g,x,y,s,R){ g.fillStyle='#e9a48a'; for(let i=0;i<5;i++){ g.beginPath(); g.ellipse(x+(R()-0.5)*s*0.5,y+(R()-0.5)*s*0.3,s*0.14,s*0.09,R()*3,0,Math.PI*2); g.fill(); } g.strokeStyle='rgba(255,255,255,0.8)'; g.lineWidth=s*0.025; for(let k=0;k<2;k++){ g.beginPath(); for(let i=0;i<=20;i++) g.lineTo(x-s*0.45+i*s*0.045,y+s*(0.28+k*0.08)+Math.sin(i*0.9)*s*0.025); g.stroke(); } },
        corn:function(g,x,y,s,R){ for(let i=-3;i<=3;i++) for(let j=-2;j<=2;j++){ const px=x+i*s*0.1+(j%2)*s*0.05, py=y+j*s*0.1; const gr=g.createRadialGradient(px-2,py-2,1,px,py,s*0.05); gr.addColorStop(0,'#ffe58a'); gr.addColorStop(1,'#e0a92a'); g.fillStyle=gr; g.beginPath(); g.arc(px,py,s*0.045,0,Math.PI*2); g.fill(); } },
        noodle:function(g,x,y,s,R){ g.fillStyle='#8a4a2a'; g.beginPath(); g.ellipse(x,y+s*0.05,s*0.42,s*0.2,0,0,Math.PI*2); g.fill(); g.strokeStyle='#f2dfa8'; g.lineWidth=s*0.025; for(let k=0;k<7;k++){ g.beginPath(); for(let i=0;i<=16;i++) g.lineTo(x-s*0.36+i*s*0.045,y-s*0.06+k*s*0.035+Math.sin(i*1.3+k)*s*0.02); g.stroke(); } g.fillStyle='#3f8a3a'; g.fillRect(x+s*0.1,y-s*0.08,s*0.08,s*0.04); },
        leaf:function(g,x,y,s,R){ [[-0.12,0,-0.5],[0.1,-0.05,0.4],[0,0.12,0.1]].forEach(function(q){ g.save(); g.translate(x+q[0]*s,y+q[1]*s); g.rotate(q[2]); g.fillStyle='#5f9a4a'; g.beginPath(); g.ellipse(0,0,s*0.22,s*0.09,0,0,Math.PI*2); g.fill(); g.strokeStyle='#d9ead0'; g.lineWidth=2; g.beginPath(); g.moveTo(-s*0.2,0); g.lineTo(s*0.2,0); g.stroke(); g.restore(); }); },
        bean:function(g,x,y,s,R){ for(let i=0;i<14;i++){ g.fillStyle=R()<0.5?'#c9a46a':'#b38a52'; g.beginPath(); g.ellipse(x+(R()-0.5)*s*0.7,y+(R()-0.5)*s*0.45,s*0.07,s*0.05,R()*3,0,Math.PI*2); g.fill(); } },
        coffee:function(g,x,y,s,R){ for(let i=0;i<10;i++){ const px=x+(R()-0.5)*s*0.6, py=y+(R()-0.5)*s*0.4; g.fillStyle='#5a3420'; g.beginPath(); g.ellipse(px,py,s*0.07,s*0.05,R()*3,0,Math.PI*2); g.fill(); g.strokeStyle='#2a160c'; g.lineWidth=1.5; g.beginPath(); g.moveTo(px-s*0.05,py); g.quadraticCurveTo(px,py-s*0.02,px+s*0.05,py); g.stroke(); } },
        pasta:function(g,x,y,s,R){ g.strokeStyle='#e8c25a'; g.lineWidth=s*0.018; for(let i=0;i<14;i++){ g.beginPath(); g.moveTo(x-s*0.45,y-s*0.2+i*s*0.03); g.lineTo(x+s*0.45,y-s*0.16+i*s*0.03); g.stroke(); } },
        drop:function(g,x,y,s,R){ for(let i=0;i<7;i++){ const px=x+(R()-0.5)*s*0.7, py=y+(R()-0.5)*s*0.5, r=s*(0.04+R()*0.08); g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=2; g.beginPath(); g.arc(px,py,r,0,Math.PI*2); g.stroke(); g.fillStyle='rgba(255,255,255,0.35)'; g.fill(); } },
        milk:function(g,x,y,s,R){ g.fillStyle='#ffffff'; g.beginPath(); g.moveTo(x-s*0.5,y); for(let i=0;i<=10;i++) g.lineTo(x-s*0.5+i*s*0.1,y+Math.sin(i*1.1)*s*0.05); g.lineTo(x+s*0.5,y+s*0.4); g.lineTo(x-s*0.5,y+s*0.4); g.fill(); },
        berry:function(g,x,y,s,R){ for(let i=0;i<9;i++){ const px=x+(R()-0.5)*s*0.6, py=y+(R()-0.5)*s*0.4, gr=g.createRadialGradient(px-2,py-2,1,px,py,s*0.08); gr.addColorStop(0,'#f07a8a'); gr.addColorStop(1,'#a8203a'); g.fillStyle=gr; g.beginPath(); g.arc(px,py,s*0.07,0,Math.PI*2); g.fill(); } },
        plain:function(){}
      };
      /* print for one face: background, a soft swoosh in the accent colour, the photo window with the motif, a tiny logo block and unreadable fine print */
      const art=function(o,W,H,info){ const k=[o.c,o.a,o.m,W,H,info?1:0,o.seed||0].join('_'); if(texC[k]) return texC[k];
        const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d'); let sd=(o.seed||1)*7919+W; const R=function(){ sd=(sd*16807)%2147483647; return sd/2147483647; };
        const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,hex(mix(o.c,0.08))); gr.addColorStop(1,hex(mix(o.c,-0.08))); g.fillStyle=gr; g.fillRect(0,0,W,H);
        if(info){ g.fillStyle='rgba(255,255,255,0.85)'; rr(g,W*0.12,H*0.15,W*0.76,H*0.5,6); g.fill(); g.fillStyle='rgba(60,60,60,0.35)'; for(let i=0;i<9;i++) g.fillRect(W*0.18,H*0.2+i*H*0.05,W*(0.3+R()*0.34),1.5);
          for(let i=0;i<22;i++) g.fillRect(W*0.3+i*W*0.018,H*0.74,R()<0.5?1:2,H*0.1); }
        else {
          g.fillStyle=hex(o.a); g.beginPath(); g.moveTo(0,H*0.68); g.bezierCurveTo(W*0.35,H*0.58,W*0.65,H*0.86,W,H*0.72); g.lineTo(W,H); g.lineTo(0,H); g.fill();
          const s=Math.min(W,H)*0.62, cx=W/2, cy=H*(o.my||0.5); if(o.m&&o.m!=='plain'){ g.save(); g.beginPath(); g.ellipse(cx,cy,s*0.52,s*0.42,0,0,Math.PI*2); g.fillStyle=o.win?hex(o.win):'rgba(255,255,255,0.18)'; g.fill(); g.clip(); (motifs[o.m]||motifs.plain)(g,cx,cy,s,R); g.restore(); }
          g.fillStyle=hex(mix(o.a,-0.25)); rr(g,W*0.3,H*0.08,W*0.4,H*0.09,H*0.03); g.fill(); g.fillStyle='rgba(255,255,255,0.75)'; for(let i=0;i<3;i++) g.fillRect(W*(0.35+i*0.1),H*0.115,W*0.07,2);
          g.fillStyle='rgba(255,255,255,0.6)'; for(let i=0;i<2;i++) g.fillRect(W*0.32,H*(0.2+i*0.025),W*(0.36-i*0.1),1.5); }
        const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy||4; return texC[k]=t; };
      const mat=function(key,make){ return matC[key]||(matC[key]=make()); };
      const printM=function(o,W,H,info,opt){ return mat(['p',o.c,o.a,o.m,W,H,info?1:0,o.seed||0,o.win||0].join('_'),function(){ return env.lam(0xffffff,Object.assign({map:art(o,W,H,info),roughness:o.gloss?0.28:0.55},opt||{})); }); };
      const plainM=function(c,opt){ return mat('c'+c+JSON.stringify(opt||{}),function(){ return env.lam(c,Object.assign({roughness:0.55},opt||{})); }); };
      const metal=mat('metal',function(){ return env.lam(0xd6d9dc,{metalness:0.85,roughness:0.28,envMapIntensity:1}); });
      const glassM=mat('glass',function(){ return env.lam(0xeef4f5,{transparent:true,opacity:0.3,roughness:0.04,depthWrite:false,envMapIntensity:1}); });
      const add=function(G,geo,m,x,y,z){ const o=new THREE.Mesh(geo,m); o.position.set(x||0,y||0,z||0); o.castShadow=true; o.receiveShadow=true; G.add(o); return o; };
      const grainT=function(kind){ const k='grain_'+kind; if(texC[k]) return texC[k]; const cv=document.createElement('canvas'); cv.width=cv.height=128; const g=cv.getContext('2d'); let sd=kind.length*977; const R=function(){ sd=(sd*16807)%2147483647; return sd/2147483647; };
        const P={rice:['#f4f1ea','#ffffff','#e3ddd0',2.2,1.2],oats:['#e2cfa4','#efe0bd','#c9b080',4,2.4],beans:['#8e3a2c','#a8503a','#5e2318',4.5,3.4],lentil:['#c97a3a','#e09a50','#a85a24',3,2.6],sugar:['#fbfaf6','#ffffff','#e9e6de',1.5,1.5],coffee:['#4a2a18','#6b4028','#2a160c',3.5,2.5]}[kind]||['#ddd','#eee','#bbb',3,2];
        g.fillStyle=P[0]; g.fillRect(0,0,128,128); for(let i=0;i<900;i++){ g.fillStyle=R()<0.5?P[1]:P[2]; g.beginPath(); g.ellipse(R()*128,R()*128,P[3]*(0.6+R()*0.6),P[4]*(0.6+R()*0.5),R()*3,0,Math.PI*2); g.fill(); }
        const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,1); return texC[k]=t; };
      const B={
        box:function(o){ const G=new THREE.Group(), side=plainM(mix(o.c,-0.05)), top=plainM(mix(o.c,0.05)), f=printM(o,256,Math.round(256*o.h/o.w)), bk=printM(o,256,Math.round(256*o.h/o.w),true);
          const g=new THREE.BoxGeometry(o.w,o.h,o.d); add(G,g,[side,side,top,top,f,bk],0,o.h/2,0); return G; },
        bag:function(o){ const G=new THREE.Group(), w=o.w, h=o.h, d=o.d||0.06, seal=0.012, bh=h-2*seal, g=new THREE.BoxGeometry(w,bh,d,8,12,1), p=g.attributes.position; let sd=(o.seed||3)*131; const R=function(){ sd=(sd*16807)%2147483647; return sd/2147483647; };
          for(let i=0;i<p.count;i++){ const nx=p.getX(i)/(w/2), ny=p.getY(i)/(bh/2), f=(1-Math.pow(Math.abs(ny),5))*(1-0.35*Math.pow(Math.abs(nx),6)); p.setZ(i,p.getZ(i)*Math.max(0.04,f)+Math.sign(p.getZ(i))*(R()-0.5)*0.003*f); p.setX(i,p.getX(i)*(1-0.04*ny*ny)); }
          g.computeVertexNormals(); const f=printM(Object.assign({gloss:1},o),256,Math.round(256*h/w)), bk=printM(Object.assign({gloss:1},o),256,Math.round(256*h/w),true), sm=plainM(o.c,{roughness:0.3,metalness:0.2});
          add(G,g,[sm,sm,sm,sm,f,bk],0,seal+bh/2,0);
          const crimp=mat('crimp'+o.c,function(){ const cv=document.createElement('canvas'); cv.width=64; cv.height=8; const gg=cv.getContext('2d'); for(let i=0;i<64;i++){ gg.fillStyle=i%4<2?hex(mix(o.c,0.15)):hex(mix(o.c,-0.2)); gg.fillRect(i,0,1,8); } const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return env.lam(0xffffff,{map:t,roughness:0.35,metalness:0.2}); });
          [seal/2,h-seal/2].forEach(function(y){ add(G,new THREE.BoxGeometry(w*0.96,seal,0.003),crimp,0,y,0); }); return G; },
        can:function(o){ const G=new THREE.Group(), r=o.r||0.037, h=o.h||0.11, pts=[[0,0.002],[r*0.8,0],[r*0.93,0.003],[r,0.012]];
          for(let k=0;k<5;k++){ const y=0.02+k*(h-0.04)/4; pts.push([r,y-0.004],[r+0.0012,y],[r,y+0.004]); }
          pts.push([r,h-0.012],[r*0.94,h-0.004],[r*0.96,h],[r*0.9,h],[r*0.88,h-0.003],[0,h-0.003]);
          add(G,new THREE.LatheGeometry(pts.map(function(q){ return new THREE.Vector2(q[0],q[1]); }),28),metal);
          const lh=(h-0.03)*0.92; add(G,new THREE.CylinderGeometry(r+0.0016,r+0.0016,lh,32,1,true),printM(o,256,Math.max(32,Math.round(256*lh/(2*Math.PI*r)))*2),0,0.015+lh/2+0.002,0);
          if(o.tab!==false){ const tb=add(G,new THREE.BoxGeometry(r*0.55,0.0015,r*0.28),metal,0,h-0.0015,r*0.15); const ring=add(G,new THREE.TorusGeometry(r*0.16,0.0016,6,14),metal,0,h-0.0012,r*0.42); ring.rotation.x=Math.PI/2; } return G; },
        tin:function(o){ const G=new THREE.Group(), r=o.r||0.045, h=o.h||0.12, bm=plainM(o.c,{roughness:0.35,metalness:0.4}), lm=plainM(mix(o.c,-0.12),{roughness:0.3,metalness:0.5});
          add(G,new THREE.CylinderGeometry(r,r,h-0.03,28),bm,0,(h-0.03)/2,0); add(G,new THREE.CylinderGeometry(r+0.0015,r+0.0015,0.032,28),lm,0,h-0.016,0); add(G,new THREE.CylinderGeometry(r*0.7,r*0.7,0.002,24),plainM(mix(o.c,0.2),{roughness:0.3,metalness:0.4}),0,h+0.001,0);
          add(G,new THREE.CylinderGeometry(r+0.0007,r+0.0007,(h-0.03)*0.55,28,1,true),printM(o,256,96),0,(h-0.03)*0.45,0); return G; },
        jar:function(o){ const G=new THREE.Group(), r=o.r||0.045, h=o.h||0.18, fh=(o.fill==null?0.7:o.fill)*(h-0.03);
          if(fh>0.005){ const cm=mat('grainM'+o.grain,function(){ return env.lam(0xffffff,{map:grainT(o.grain||'rice'),roughness:0.9}); }); add(G,new THREE.CylinderGeometry(r-0.003,r-0.003,fh,22),cm,0,0.004+fh/2,0); }
          const gl=add(G,new THREE.CylinderGeometry(r,r,h-0.022,24),glassM,0,(h-0.022)/2,0); gl.renderOrder=2; gl.castShadow=false;
          add(G,new THREE.CylinderGeometry(r+0.002,r+0.002,0.024,24),mat('oakLid',function(){ return env.lam(0xcfae84,{roughness:0.55,map:M.oak.map||null}); }),0,h-0.012,0);
          add(G,new THREE.CylinderGeometry(r+0.0005,r+0.0005,0.004,24),plainM(0xe8e4dc,{roughness:0.8}),0,h-0.026,0); return G; },
        pastaJar:function(o){ const G=new THREE.Group(), r=o.r||0.04, h=o.h||0.3, n=46, sl=h*0.86, im=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0009,0.0009,sl,4),plainM(0xe8c25a,{roughness:0.6}),n), q=new THREE.Object3D(); let sd=17; const R=function(){ sd=(sd*16807)%2147483647; return sd/2147483647; };
          for(let i=0;i<n;i++){ const a=R()*Math.PI*2, d=Math.sqrt(R())*(r-0.006); q.position.set(Math.cos(a)*d,0.004+sl/2,Math.sin(a)*d); q.rotation.set((R()-0.5)*0.06,0,(R()-0.5)*0.06); q.updateMatrix(); im.setMatrixAt(i,q.matrix); } im.castShadow=true; G.add(im);
          const gl=add(G,new THREE.CylinderGeometry(r,r,h-0.02,24),glassM,0,(h-0.02)/2,0); gl.renderOrder=2; gl.castShadow=false;
          add(G,new THREE.CylinderGeometry(r+0.002,r+0.002,0.022,24),mat('oakLid',function(){ return env.lam(0xcfae84,{roughness:0.55,map:M.oak.map||null}); }),0,h-0.011,0); return G; },
        cup:function(o){ const G=new THREE.Group(), r1=o.r||0.046, r0=r1*0.76, h=o.h||0.1;
          add(G,new THREE.CylinderGeometry(r1,r0,h,28,1,true),printM(o,256,96),0,h/2,0); add(G,new THREE.CylinderGeometry(r0,r0,0.002,24),plainM(o.c),0,0.001,0);
          add(G,new THREE.CylinderGeometry(r1+0.002,r1+0.002,0.003,28),mat('foil',function(){ return env.lam(0xe9e6df,{metalness:0.6,roughness:0.35}); }),0,h+0.0015,0);
          add(G,new THREE.BoxGeometry(0.022,0.002,0.018),plainM(o.a),0,h+0.003,r1+0.006); return G; },
        carton:function(o){ const G=new THREE.Group(), w=o.w||0.07, d=o.d||0.07, h=o.h||0.19, gh=0.035, side=printM(o,128,Math.round(128*h/w)), wh=plainM(0xf6f6f2,{roughness:0.5});
          add(G,new THREE.BoxGeometry(w,h,d),[side,side,wh,wh,side,side],0,h/2,0);
          const sh=new THREE.Shape([new THREE.Vector2(-d/2,0),new THREE.Vector2(d/2,0),new THREE.Vector2(0.003,gh),new THREE.Vector2(-0.003,gh)]), gg=new THREE.ExtrudeGeometry(sh,{depth:w,bevelEnabled:false}); gg.translate(0,0,-w/2); const gm=add(G,gg,wh,0,h,0); gm.rotation.y=Math.PI/2;
          add(G,new THREE.BoxGeometry(w,0.012,0.004),wh,0,h+gh+0.005,0); if(o.capTop) add(G,new THREE.CylinderGeometry(0.011,0.011,0.012,14),plainM(o.a),0,h+0.012,d*0.22); return G; },
        pouch:function(o){ const G=new THREE.Group(), w=o.w||0.12, h=o.h||0.2, d=o.d||0.07, seal=0.012, bh=h-seal, g=new THREE.BoxGeometry(w,bh,d,6,12,1), p=g.attributes.position;
          for(let i=0;i<p.count;i++){ const ny=p.getY(i)/(bh/2), nx=p.getX(i)/(w/2), t=Math.max(0,Math.min(1,(1-ny)/2)), f=(0.12+0.88*Math.pow(t,0.65))*(1-0.3*Math.pow(Math.abs(nx),5)); p.setZ(i,p.getZ(i)*f); }
          g.computeVertexNormals(); const f=printM(Object.assign({gloss:1},o),192,Math.round(192*h/w)), bk=printM(Object.assign({gloss:1},o),192,Math.round(192*h/w),true), sm=plainM(o.c,{roughness:0.3});
          add(G,g,[sm,sm,sm,sm,f,bk],0,bh/2,0); add(G,new THREE.BoxGeometry(w*0.98,seal,0.003),plainM(mix(o.c,0.1),{roughness:0.3}),0,bh+seal/2,0);
          const sp=add(G,new THREE.CylinderGeometry(0.009,0.011,0.022,14),plainM(o.a,{roughness:0.35}),w*0.3,bh-0.004,0); sp.rotation.z=-0.5; return G; },
        bottle:function(o){ const G=new THREE.Group(), r=o.r||0.03, h=o.h||0.2, bm=plainM(o.body||o.c,o.glass?{transparent:true,opacity:0.85,roughness:0.08}:{roughness:0.3}), sq=o.sq;
          add(G,new THREE.CylinderGeometry(r,r,h*0.72,20),bm,0,h*0.36,0);
          if(sq){ add(G,new THREE.CylinderGeometry(r*0.42,r,h*0.12,20),bm,0,h*0.78,0); add(G,new THREE.CylinderGeometry(r*0.42,r*0.42,h*0.1,14),bm,0,h*0.89,0); } else add(G,new THREE.CylinderGeometry(r*0.85,r,h*0.06,20),bm,0,h*0.75,0);
          add(G,new THREE.CylinderGeometry(r+0.0012,r+0.0012,h*0.36,24,1,true),printM(o,192,Math.max(24,Math.round(192*h*0.36/(2*Math.PI*r)))*2),0,h*0.36,0);
          const cr=sq?r*0.48:r*0.9, ch=o.ch||0.02; add(G,new THREE.CylinderGeometry(cr,cr,ch,14),plainM(o.cap||o.a,{roughness:0.35}),0,(sq?h*0.94:h*0.78)+ch/2,0); return G; }
      };
      const motifFor=function(t){ t=String(t||''); const R=[[/牛乳|豆乳|ミルク|ヨーグルト/,'milk'],[/トマト|ケチャップ|キムチ|ソース/,'tomato'],[/ツナ|魚|鮭/,'fish'],[/コーン/,'corn'],[/麺|ヌードル|カップ/,'noodle'],[/茶|緑/,'leaf'],[/納豆|大豆|豆/,'bean'],[/コーヒー/,'coffee'],[/パスタ|スパゲッティ/,'pasta'],[/洗|キュキュット|食洗|つめかえ|ジェル|柔軟|漂白/,'drop'],[/オレンジ|ジュース|ベリー|ジャム/,'berry'],[/チップ|ポテチ/,'chips'],[/シリアル|グラノーラ|フレーク/,'cereal']];
        for(let i=0;i<R.length;i++) if(R[i][0].test(t)) return R[i][1]; return 'plain'; };
      const hcol=function(c){ if(typeof c==='number') return c; const m=String(c||'#ffffff').replace('#',''); return parseInt(m.length===3?m.replace(/./g,'$&$&'):m,16)||0xffffff; };
      const fn=function(kind,o){ return B[kind](o||{}); };
      /* a printed label for an existing package or bottle: the words become a picture and a small logo block, never readable text */
      fn.label=function(txt,bg,fg,W,H){ let sd=0; String(txt).split('').forEach(function(ch){ sd=(sd*31+ch.charCodeAt(0))%9973; }); return printM({c:hcol(bg),a:hcol(fg),m:motifFor(txt),seed:sd+1},W||192,H||128); };
      return fn;
    })();


    Catalog.chair=function(dz){                // dining / desk chair; dz = +1 when the back is on the +z side, -1 on the -z side
      const P=new Piece();
      P.rb(0,0,0.42,0.42,0.05,0.035,M.oakChair,0.40,true);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(s=>{ P.fcyl(s[0]*0.17,s[1]*0.17,0.02,0.012,0,0.41,M.oakD,false); });
      const m=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.38,16,1,true,(dz>0?0:Math.PI)-0.75,1.5),M.chairBack);
      m.position.set(0,0.66,-dz*0.08); P.add(m);
      return P;
    };

    Catalog.sideTable=function(){              // 45 x 45 cm table, 50 cm high
      const P=new Piece();
      P.rb(0,0,0.45,0.45,0.03,0.015,M.oak,0.47,true); P.legs(0,0,0.17,0.17,0.47,0.02,0.014,M.oakD); P.rb(0,0,0.35,0.35,0.02,0.008,M.oakD,0.2,false);
      return P;
    };

    Catalog.floorLamp=function(){              // 1.63 m floor lamp with a 28 cm base
      const P=new Piece();
      P.cyl(0,0,0.14,0.14,0,0.02,M.dark,{cast:false},16); P.cyl(0,0,0.011,0.011,0.02,1.5,M.steel,{cast:false},8);
      P.shade(0,0,0.17,0.14,1.35,1.63); P.cyl(0,0,0.12,0.12,1.61,1.615,env.lampMat,{cast:false},16);
      P._col(-0.14,0.14,-0.14,0.14,false);
      return P;
    };

    function rugTex(style){                        // flat-colour woven look: concentric rings + sunburst (living room) or petals (study)
      const c=document.createElement('canvas'); c.width=c.height=1024; const g=c.getContext('2d'), K=512;
      const cream='#f1e8d8', terra='#c8714f', sage='#8fa58e', navy='#35506b', blush='#e0b184', ring=function(r0,r1,col){ g.strokeStyle=col; g.lineWidth=(r1-r0)*K; g.beginPath(); g.arc(K,K,(r0+r1)/2*K,0,TAU); g.stroke(); };
      const dots=function(r,n,rad,col){ g.fillStyle=col; for(let i=0;i<n;i++){ const a=i/n*TAU; g.beginPath(); g.arc(K+Math.cos(a)*r*K,K+Math.sin(a)*r*K,rad*K,0,TAU); g.fill(); } };
      if(style==='plain'){
        g.fillStyle='#cfc4ad'; g.fillRect(0,0,1024,1024);
      } else if(style==='rings'){
        g.fillStyle=cream; g.fillRect(0,0,1024,1024);
        ring(0.9,1.1,terra); ring(0.84,0.87,navy); dots(0.78,40,0.013,navy); ring(0.68,0.72,sage); ring(0.6,0.62,terra);
        for(let i=0;i<16;i++){ g.fillStyle=i%2?blush:terra; g.beginPath(); g.moveTo(K,K); g.arc(K,K,0.54*K,i/16*TAU,(i+1)/16*TAU); g.closePath(); g.fill(); }
        ring(0.0,0.14,cream); ring(0.0,0.06,terra);
      } else {
        g.fillStyle='#a9bba3'; g.fillRect(0,0,1024,1024);
        ring(0.92,1.1,cream); dots(0.82,36,0.014,terra);
        for(let i=0;i<12;i++){ const a=(i+0.5)/12*TAU; g.fillStyle=i%2?cream:blush; g.beginPath(); g.ellipse(K+Math.cos(a)*0.5*K,K+Math.sin(a)*0.5*K,0.2*K,0.085*K,a,0,TAU); g.fill(); }
        ring(0.0,0.24,terra); ring(0.0,0.14,cream); ring(0.0,0.06,sage);
      }
      for(let i=0;i<5000;i++){ g.fillStyle='rgba('+(env.rnd()<0.5?'255,255,255':'60,40,20')+','+(0.03+env.rnd()*0.05)+')'; g.fillRect(env.rnd()*1024,env.rnd()*1024,2+env.rnd()*3,2+env.rnd()*3); }   // yarn speckle
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy; return t;
    }

    /* round rug with a gently scalloped edge (amp = scallop depth, lobes = scallop count), 1.4 cm pile; shag = fluffy stacked-shell pile on top */
    Catalog.roundRug=function(R,style,lobes,amp,shag){
      const P=new Piece(), rnd=env.rnd;
      const pts=[]; for(let i=0;i<240;i++){ const th=i/240*TAU, r=R*(1+amp*Math.cos(lobes*th)); pts.push(new THREE.Vector2(Math.cos(th)*r,Math.sin(th)*r)); }
      const geo=new THREE.ExtrudeGeometry(new THREE.Shape(pts),{depth:0.014,bevelEnabled:false,curveSegments:1,steps:1});
      const t=rugTex(style); t.repeat.set(1/(2*R*(1+amp)),1/(2*R*(1+amp))); t.offset.set(0.5,0.5);
      const m=new THREE.Mesh(geo,[new THREE.MeshStandardMaterial({map:t,roughness:1}),env.lam(0xcdbfa6,{roughness:1})]);
      m.rotation.x=-Math.PI/2; m.position.set(0,0.001,0); m.receiveShadow=true; P.add(m,{cast:false});
      if(shag){
        const N=14, size=256, data=new Uint8Array(size*size*4);
        for(let i=0;i<size*size;i++){ const v=196+Math.floor(rnd()*52); data[i*4]=v; data[i*4+1]=v-7; data[i*4+2]=v-19; data[i*4+3]=Math.floor(rnd()*255); }
        const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.colorSpace=THREE.SRGBColorSpace;
        tex.magFilter=THREE.LinearFilter; tex.minFilter=THREE.LinearMipmapLinearFilter; tex.generateMipmaps=true; tex.repeat.set(1.5,1.5); tex.needsUpdate=true;
        const sp=[]; for(let i=0;i<72;i++){ const th=i/72*TAU; sp.push(new THREE.Vector2(Math.cos(th)*R,Math.sin(th)*R)); }
        const sg=new THREE.ShapeGeometry(new THREE.Shape(sp),24);
        for(let i=0;i<N;i++){
          const s=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({map:tex,alphaTest:0.1+0.82*i/N,roughness:1,envMapIntensity:0.3}));
          s.material.color.setScalar(0.5+0.4*i/(N-1));
          const sc=1-0.035*i/N; s.scale.set(sc,sc,1);
          s.rotation.x=-Math.PI/2; s.position.set(0,0.015+0.0035*i,0); s.receiveShadow=true;
          P.add(s,{cast:false,detail:i>0});
        }
      }
      return P;
    };


    /* 2.5-seat sofa, W155 x D77 x H73 cm, seat height 40 cm; the front faces +x */
    Catalog.sofa=function(){
      const P=new Piece();
      P.rb(0,0,0.77,1.55,0.22,0.07,M.sofaD,0.1,true);                         // frame
      P.legs(0,0,0.32,0.71,0.1,0.03,0.02,M.oakD);
      P.rb(-0.335,0,0.1,1.55,0.45,0.05,M.sofaD,0.1,false);                    // back frame
      [-1,1].forEach(s=>{
        P.rb(0.095,s*0.30,0.58,0.60,0.10,0.05,M.sofa,0.30,false);             // seat cushions, top at 40 cm
        const bk=P.rb(-0.25,s*0.30,0.17,0.60,0.37,0.075,M.sofa,0.36,false); bk.rotation.z=0.13;   // back cushions, top at 73 cm
        P.rb(0,s*0.69,0.75,0.17,0.40,0.07,M.sofa,0.1,false);                  // arm rests, rolled top at 58 cm
        const roll=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.75,20),M.sofa); roll.rotation.z=Math.PI/2; roll.position.set(0,0.50,s*0.69); P.add(roll,{cast:true});
      });
      P.fb(0.095,0,0.54,0.01,0.06,M.sofaD,0.34,false);                        // seam between the seat cushions
      P.rb(-0.12,-0.38,0.16,0.40,0.36,0.07,M.cushA,0.40,false).rotation.z=0.2;
      P.rb(-0.12,0.42,0.16,0.38,0.33,0.07,M.cushB,0.40,false).rotation.z=0.2;
      return P;
    };

    /* 50 x 90 cm coffee table, long side along z, with a magazine and a mug */
    Catalog.coffeeTable=function(){
      const P=new Piece();
      P.rb(0,0,0.5,0.9,0.03,0.015,M.oak,0.4,true);
      P.legs(0,0,0.2,0.38,0.4,0.022,0.014,M.oakD);
      P.rb(0,0,0.4,0.8,0.02,0.008,M.oakD,0.12,false);
      P.rb(0,-0.2,0.22,0.3,0.03,0.006,env.lam(0x8a9a86),0.43,false);          // magazine
      P.fcyl(0.04,0.25,0.04,0.035,0.43,0.09,M.ceramic,false);                 // mug
      return P;
    };

    /* 140 x 80 cm dining table with four chairs (two on each long side) and a pendant lamp hanging from the ceiling */
    Catalog.diningSet=function(){
      const P=new Piece(), w=1.4, d=0.8, S=0.01213;
      P.rb(0,0,w,d,0.035,0.015,M.oak,0.685,true);
      P.rb(0,0,w-0.18,d-0.18,0.07,0.01,M.oakD,0.615,false);                   // apron under the top
      P.legs(0,0,w/2-0.07,d/2-0.07,0.685,0.032,0.02,M.oakD);
      [[-25,-41,-1],[30,-41,-1],[-25,41,1],[30,41,1]].forEach(c=>{ P.attach(Catalog.chair(c[2]),c[0]*S,c[1]*S,0); });
      P.cyl(0,0,0.004,0.004,1.75,env.ceilingH,M.dark,{cast:false},6);
      P.shade(0,0,0.2,0.09,1.6,1.76);
      P.cyl(0,0,0.17,0.17,1.605,1.61,env.lampMat,{cast:false},20);
      return P;
    };

    /* TV board (40 x 140 cm, three doors on its -x face) with a 56-inch TV on a stand; the TV faces -x.
       The returned piece has .tvOn(bool) to switch the screen on and off. */
    Catalog.tvBoard=function(inch,lift,floor,spec){   // TV board with a 16:9 TV of `inch` inches (default 55); lift: raise the floating board; floor: a floor-standing board with book and board-game cupboards either side; spec: maker's {w, h incl. stand, d of stand} in metres, plus len to set the board length
      const P=new Piece(), S=0.01213, W0=spec?spec.w:(inch||55)*0.02214, B=spec&&spec.len||Math.max(1.4,W0+0.2), L=lift||0;
      if(inch){                                   // designer version: floating walnut board with fluted fronts, an under-glow and a soundbar
        const FL=!!floor, wal=FL?mat('tvWhite',0xf3f1ec,{roughness:0.45}):mat('lightOakTop',0xd9bf96,{roughness:0.45,map:M.oak.map||null});   // floor-standing: matte white, like the kitchen fronts
        const zs=-B/2+0.02, gap=function(z){ return zs+Math.round((z-zs-0.033)/0.04)*0.04+0.033; }, dz0=gap(-0.36), dz1=gap(0.36), oc={cast:false};   // drawer edges fall in the gaps of the flute rhythm
        const sy0=0.2, dy=FL?-0.045:0, fx=FL?-0.25:-0.2, H=0.42+dy;   // floor-standing: 4.5 cm lower and 5 cm deeper at the front
        if(FL){ P.box(fx+0.018,0.2,-B/2,B/2,0,0.018,wal); if(spec&&spec.wall){ P.box(fx+0.018,0.2,-B/2,dz0,H-0.018,H,wal); P.box(fx+0.018,0.2,dz1,B/2,H-0.018,H,wal); } else P.box(fx+0.018,0.2,-B/2,B/2,H-0.018,H,wal); P.box(0.182,0.2,-B/2,B/2,0.018,H-0.018,wal);
          [[-B/2,-B/2+0.018],[dz0-0.018,dz0],[dz1,dz1+0.018],[B/2-0.018,B/2]].forEach(function(q){ P.box(fx+0.018,0.182,q[0],q[1],0.018,H-0.018,wal); });
          P.box(fx+0.018,0.2,dz0,dz1,0.18+dy,0.198+dy,wal); P.box(fx+0.016,fx+0.018,dz0,dz1,0.196+dy,0.198+dy,env.lam(0x9d988f,{roughness:0.8}),oc); P._col(fx,0.2,-B/2,B/2,true); }   // shelf the devices stand on, with a drawer for remotes below
        else { P.box(-0.2,0.2,-B/2,dz0,0.18,0.42,wal); P.box(-0.2,0.2,dz1,B/2,0.18,0.42,wal); P.box(-0.2,0.2,dz0,dz1,0.18,0.198,wal); }
        const topM=FL?mat('lightOakTop',0xd9bf96,{roughness:0.45,map:M.oak.map||null}):wal, LIDON=FL&&spec&&spec.wall;
        if(LIDON){ P.rb((fx+0.2)/2,(-B/2-0.01+dz0-0.0015)/2,0.22-fx,dz0-0.0015+B/2+0.01,0.025,0.01,topM,H,true); P.rb((fx+0.2)/2,(dz1+0.0015+B/2+0.01)/2,0.22-fx,B/2+0.01-dz1-0.0015,0.025,0.01,topM,H,true); } else P.rb((fx+0.2)/2,0,0.22-fx,B+0.02,0.025,0.01,topM,H,true);   // floor-standing: oak top over white fronts
        if(LIDON){ P.box(fx,fx+0.03,dz0,dz1,H-0.03,H-0.012,wal); P.box(0.17,0.2,dz0,dz1,H-0.03,H-0.012,wal); } else P.box(fx,0.2,dz0,dz1,H-0.018,H,wal);   // lid bay: only rebates front and back
        if(FL&&spec&&spec.wall){ const y0c=0.198+dy, y1c=H-0.018, ca=-0.03, cb=0.09, ha=0.24, hb=0.33; P.box(0.182,0.2,dz0,dz1,y0c,ha,wal); P.box(0.182,0.2,dz0,dz1,hb,y1c,wal); P.box(0.182,0.2,dz0,ca,ha,hb,wal); P.box(0.182,0.2,cb,dz1,ha,hb,wal);   // back panel cut out over the wall cable plate
          P.box(0.197,0.2,ca+0.01,cb-0.01,ha+0.01,hb-0.01,env.lam(0xf4f3ef,{roughness:0.35}),{cast:false}); P.box(0.1965,0.197,ca+0.03,cb-0.03,ha+0.03,hb-0.03,env.lam(0x2b2c2e,{roughness:0.8}),{cast:false}); } else P.box(0.182,0.2,dz0,dz1,0.198+dy,H-0.018,wal);
        const plateM=env.lam(0xf4f4f2,{roughness:0.35}), slotM=env.lam(0x1a1a1a);
        if(!(spec&&spec.wall)){ const hole=new THREE.Mesh(new THREE.CircleGeometry(0.028,24),slotM); hole.rotation.y=-Math.PI/2; hole.position.set(0.1815,0.33+dy,0.03); P.add(hole,oc); }   // cable grommet up to the TV
        const dc=(dz0+dz1)/2, blk=env.lam(0x26282b,{roughness:0.4}), wht=env.lam(0xf3f3f1,{roughness:0.3}), cab=env.lam(0x1d1e20,{roughness:0.6}), fy=0.198+dy;
        const add=function(geo,mt,x,y,z,o){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); P.add(m,o||{}); return m; };
        const seg=function(a,b,r,mt){ const d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]), m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),6),mt||cab);   // cable run between two points
          m.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); P.add(m,oc); return m; };
        add(new THREE.BoxGeometry(0.008,0.006,dz1-dz0-0.04),env.lam(0xfff1d6,{emissive:0xffd9a0,emissiveIntensity:1.2}),fx+0.03,H-0.022,dc,oc);   // LED strip under the top
        const xi=fx+0.018, sx=xi+0.045, oz=[-0.31,-0.25,-0.19,-0.13,-0.07,-0.01];                                                   // flush desk outlet set into the shelf near the front, seen as soon as the flap drops
        add(new THREE.BoxGeometry(0.08,0.004,0.4),plateM,sx,fy+0.002,-0.15,oc); [0.02,0.035].forEach(function(z){ add(new THREE.BoxGeometry(0.012,0.001,0.005),slotM,sx,fy+0.0045,z,oc); });   // six outlets and two USB ports
        oz.forEach(function(z){ [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.014,0.001,0.003),slotM,sx-0.008,fy+0.0045,z+sd*0.009,oc); }); add(new THREE.BoxGeometry(0.005,0.001,0.006),slotM,sx+0.014,fy+0.0045,z,oc); });
        const plug=function(z){ add(new THREE.BoxGeometry(0.03,0.03,0.026),blk,sx-0.002,fy+0.019,z,oc); return [sx+0.005,fy+0.034,z]; };
        const rtr=env.lam(0x1b1c1e,{roughness:0.35});                                                                    // black Wi-Fi router lying flat behind the outlets
        add(new THREE.BoxGeometry(0.15,0.035,0.21),rtr,sx+0.13,fy+0.0175,-0.2);
        [-0.25,-0.23,-0.21,-0.19].forEach(function(z){ add(new THREE.BoxGeometry(0.002,0.004,0.006),new THREE.MeshBasicMaterial({color:0x58d68d}),sx+0.054,fy+0.026,z,oc); });
        seg([sx+0.055,fy+0.01,-0.3],[sx+0.03,fy+0.006,-0.3],0.003); seg([sx+0.03,fy+0.006,-0.3],plug(-0.31),0.003);
        const dkx=xi+0.07;                                                                                               // Switch in its dock at the front, Joy-Con on both sides
        add(new THREE.BoxGeometry(0.05,0.105,0.17),blk,dkx,fy+0.053,0.2);
        add(new THREE.BoxGeometry(0.014,0.1,0.172),env.lam(0x2b2d30,{roughness:0.2}),dkx-0.032,fy+0.085,0.2);
        add(new THREE.BoxGeometry(0.015,0.1,0.035),env.lam(0x1f9fd8,{roughness:0.4}),dkx-0.032,fy+0.085,0.096);
        add(new THREE.BoxGeometry(0.015,0.1,0.035),env.lam(0xe8443a,{roughness:0.4}),dkx-0.032,fy+0.085,0.304);
        seg([dkx+0.025,fy+0.01,0.15],[dkx+0.06,fy+0.005,0.05],0.003); seg([dkx+0.06,fy+0.005,0.05],plug(-0.13),0.003);
        const gm=[0.181,0.33+dy,0.03];                                                                                   // TV cables through the grommet: HDMI into the dock, TV and soundbar power to the outlets
        seg(gm,[0.1,fy+0.06,0.12],0.004); seg([0.1,fy+0.06,0.12],[dkx+0.025,fy+0.07,0.16],0.004);
        seg(gm,[0.12,fy+0.01,-0.12],0.004); seg([0.12,fy+0.01,-0.12],[sx+0.03,fy+0.01,-0.16],0.004); seg([sx+0.03,fy+0.01,-0.16],plug(-0.19),0.004);
        seg(gm,[0.14,fy+0.006,-0.05],0.003); seg([0.14,fy+0.006,-0.05],[sx+0.03,fy+0.006,-0.23],0.003); seg([sx+0.03,fy+0.006,-0.23],plug(-0.25),0.003);
        if(!(spec&&spec.wall)) P.cyl(0.12,0,0.025,0.025,H+0.024,H+0.0255,cab,oc,20);                                                                  // cable grommet in the top
        if(LIDON){ const LG2=new THREE.Group(); P.group.add(LG2);   // sliding top panel over the device bay: drops 2.8 cm onto concealed runners and slides west under the left top
          const lm=new THREE.Mesh(new THREE.BoxGeometry(0.22-fx,0.025,dz1-dz0-0.004),topM); lm.position.set((fx+0.2)/2,H+0.0125,dc); lm.castShadow=lm.receiveShadow=true; LG2.add(lm);   // same size and line as the tops either side, 2 mm seams
          const fh=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.004,24),env.lam(0x8a6a48,{roughness:0.8})); fh.scale.set(1.3,1,0.45); fh.position.set((fx+0.2)/2,H+0.0235,dz1-0.02); LG2.add(fh);   // finger notch at the east edge, left showing at the pocket mouth
          [fx+0.03,0.17].forEach(function(x){ P.box(x-0.008,x+0.008,-B/2+0.04,dz1,H-0.035,H-0.03,env.lam(0x9a9d9f,{metalness:0.6,roughness:0.4}),oc); });   // runners
          const shift=-(dz1-dz0)+0.04, stl=stepper(1.0,function(v){ const e=ease(v), dn=Math.min(1,e*5), mid=Math.min(1,Math.max(0,(e-0.2)/0.8)); LG2.position.set(0,-0.028*dn,shift*mid); }); P.anims.push(function(t){ return stl.run(t); });
          P.actions=(P.actions||[]).concat([{x:-0.6,z:dc+0.15,part:[lm],label:function(){ return stl.target?'拉回上板':'推開上板'; },act:function(){ stl.target=stl.target?0:1; }}]);
          const sl=env.lam(0x2b2c2e,{roughness:0.8}); [0.215,0.345].forEach(function(y){ for(let z=dz0+0.04;z<dz1-0.06;z+=0.07){ if(y<0.34&&z>-0.05&&z<0.1) continue; P.box(0.1805,0.1815,z,z+0.05,y-0.006,y+0.006,sl,oc); } });   // vent slots low and high in the back panel
          const ow=env.lam(0xf4f3ef,{roughness:0.35}); P.box(0.172,0.181,-0.34,-0.06,0.26,0.32,ow,oc);   // outlet strip on the back panel: 4 earthed outlets and USB-C
          for(let k=0;k<4;k++){ const z=-0.32+k*0.06; [-1,1].forEach(function(sd){ P.box(0.1715,0.172,z+sd*0.008-0.0015,z+sd*0.008+0.0015,0.282,0.298,slotM,oc); }); P.box(0.1715,0.172,z-0.003,z+0.003,0.27,0.276,slotM,oc); }
          P.box(0.1715,0.172,-0.085,-0.075,0.286,0.29,slotM,oc);
          [[-0.32,[sx+0.13,fy+0.03,-0.2]],[-0.26,[dkx+0.025,fy+0.05,0.15]],[-0.2,[sx+0.13,fy+0.03,-0.1]]].forEach(function(q){ add(new THREE.BoxGeometry(0.026,0.026,0.024),blk,0.158,0.29,q[0],oc); seg([0.145,0.29,q[0]],[0.145,fy+0.01,q[0]],0.003); seg([0.145,fy+0.01,q[0]],q[1],0.003); }); }   // router, dock and TV box plugged into the strip
        const F=new THREE.Group(); F.position.set(fx-0.014,fy,0); P.group.add(F);                                              // flap hinged at its bottom edge
        const fd=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; F.add(m); return m; };
        if(FL&&spec&&spec.wall) fd(new THREE.BoxGeometry(0.018,H-0.0025-fy-0.002,dz1-dz0-0.003),wal,0.023,0.002+(H-0.0025-fy-0.002)/2,dc); else fd(new THREE.BoxGeometry(0.018,0.2,dz1-dz0-(FL?0.002:0.004)),wal,0.023,0.102,dc); if(FL) fd(new THREE.BoxGeometry(0.004,0.006,0.2),env.lam(0xc9c4bb,{roughness:0.8}),0.0125,0.186,dc);   // wall TV: the flap rises to the top's underside; a finger groove along its top
        const grv=env.lam(0xc9c4bb,{roughness:0.8}), seamM=env.lam(0x9d988f,{roughness:0.8}), mL=(dz0-B/2)/2, mR=(dz1+B/2)/2, doors=FL&&!LIDON?[[-B/2,mL,1],[mL,dz0,-1],[dz1,mR,1],[mR,B/2,-1]]:[];   // floor-standing: two flat doors a side, hinged at their outer edges, opened by a finger groove
        const dg=doors.map(function(q){ const G=new THREE.Group(), hz=q[2]>0?q[0]:q[1], dw=q[1]-q[0]-0.002, dh=H-0.01, zc=(q[0]+q[1])/2-hz; G.position.set(fx-0.014,0,hz); P.group.add(G);
          const pm=new THREE.Mesh(new THREE.BoxGeometry(0.018,dh,dw),wal); pm.position.set(0.023,0.006+dh/2,zc); pm.castShadow=pm.receiveShadow=true; G.add(pm);
          const gv=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.006,0.15),grv); gv.position.set(0.0125,0.006+dh-0.022,(q[2]>0?q[1]:q[0])-hz-q[2]*0.105); G.add(gv);   // 15 cm finger pull by the free edge
          q.slice(0,2).forEach(function(e){ if(Math.abs(e)>B/2-0.01) return; const sm=new THREE.Mesh(new THREE.BoxGeometry(0.001,dh,0.0016),seamM); sm.position.set(0.0325,0.006+dh/2,e-hz); G.add(sm); });   // shadow behind the seam, swinging with the door
          return G; });
        if(!FL) for(let z=zs;z<B/2-0.03;z+=0.04){
          if(z>dz0&&z+0.026<dz1) fd(new THREE.BoxGeometry(0.014,0.2,0.026),wal,0.007,0.102,z+0.013);
          else if(!(z+0.026>dz0&&z<dz1)) P.box(-0.214,-0.2,z,z+0.026,0.2,0.4,wal,oc); }
        if(FL){ const rnd=(function(a){ return function(){ a=(a*16807)%2147483647; return a/2147483647; }; })(7);
          const bookC=[0xe9e2d0,0x2f3b4c,0x6b4f3a,0x3e4f43,0x8c8a85,0xf3f1ea,0x7a2e2e,0x1e1f22,0xb9a27c], paper=env.lam(0xf1ead8,{roughness:0.9}), gilt=env.lam(0xc9a96a,{roughness:0.35,metalness:0.6});
          const book=function(x0,z0,z1,y0,h,dd,c){ const sx=x0;                                                   // cloth-bound book standing spine out: cover, cream page block on top, gilt bands on the spine
            P.box(sx,sx+dd,z0,z1,y0,y0+h,env.lam(c,{roughness:0.75}),oc); P.box(sx+0.004,sx+dd-0.002,z0+0.0015,z1-0.0015,y0+h-0.002,y0+h+0.0005,paper,oc);
            [0.03,h-0.03].forEach(function(o){ P.box(sx-0.0008,sx,z0+0.002,z1-0.002,y0+o-0.002,y0+o+0.002,gilt,oc); }); };
          const nB=P.group.children.length; let z=-B/2+0.04; for(;z<dz0-0.3;){ const th=0.016+rnd()*0.03, h=0.2+rnd()*0.09, dd=0.14+rnd()*0.05;              // a row of standing books, then a short stack lying flat
            book(fx+0.03,z,z+th,0.018,h,dd,bookC[Math.floor(rnd()*bookC.length)]); z+=th+0.001; if(rnd()<0.06) z+=0.025; }
          for(let k=0,y=0.018;k<4;k++){ const t=0.022+rnd()*0.015, c=env.lam(bookC[(k*3+1)%bookC.length],{roughness:0.75}), z0=z+0.03+k*0.004, x0=fx+0.03+k*0.006, l=0.2-k*0.012, d=0.15-k*0.008;
            P.box(x0,x0+d,z0,z0+l,y,y+t,c,oc); P.box(x0+0.002,x0+d-0.002,z0+0.004,z0+l+0.0005,y+0.002,y+t-0.002,paper,oc); y+=t; }
          const nG=P.group.children.length; const gb=0.175; let gz=dz1+0.03;                                                                                // big board games stacked flat against the back of the right cupboard
          [[0.3,[0.07,0.06,0.1,0.05]],[0.26,[0.08,0.08,0.06,0.07]],[0.18,[0.05,0.05,0.04,0.05,0.04]]].forEach(function(col,i){ let y=0.018; if(gz+col[0]>B/2-0.02) return;
            col[1].forEach(function(h,j){ const c=[0xc8372f,0x2f6fb5,0xf2c94c,0x3f7d4e,0xe86a6a,0x6b4a8a,0xe08a3a,0x1f9fd8][(i*3+j)%8], w=col[0]-j*0.01;
              const gx=gb-w; P.box(gx,gx+w,gz+j*0.004,gz+j*0.004+w,y,y+h-0.002,env.lam(c,{roughness:0.6}),oc); P.box(gx-0.001,gx,gz+j*0.004+0.03,gz+j*0.004+w-0.03,y+h*0.3,y+h*0.7,env.lam(0xf6f1e6,{roughness:0.6}),oc); y+=h; });
            gz+=col[0]+0.015; });
          for(let z=dz1+0.06, n=0;n<3;n++){ let y=0.018; for(let k=0;k<3+n%2;k++){ const t=0.022+((n+k)%3)*0.006, c=[0x2f4b6e,0xd8453c,0xf2c94c,0x3f7d4e,0x8a6a9c,0x1f9fd8,0xe08a3a,0x2b2b2b][(n*3+k)%8], dz=(k%2)*0.004;   // card games the size of a deck of cards, lying in small stacks in front
            P.box(fx+0.03,fx+0.12,z+dz,z+dz+0.065,y,y+t-0.001,env.lam(c,{roughness:0.55}),oc); P.box(fx+0.029,fx+0.03,z+dz+0.01,z+dz+0.055,y+t*0.3,y+t*0.7,env.lam(0xf6f1e6,{roughness:0.6}),oc); y+=t; } z+=0.085; }
          const nE=P.group.children.length;
          const kids=P.group.children.slice();   // taken before the first drawer re-parents its contents, which shifts the indices
          if(LIDON) [[-B/2,dz0,nB,nG,'書'],[dz1,B/2,nG,nE,'桌遊']].forEach(function(q){ const D=new THREE.Group(); P.group.add(D); kids.slice(q[2],q[3]).forEach(function(o){ D.attach(o); });   // full-extension drawers either side, contents riding in them
            const z0=q[0]+(q[0]<0?0.02:0.0015), z1=q[1]-(q[1]>0?0.02:0.0015), inn=env.lam(0xe6e4df,{roughness:0.6}), add=function(w,h,d,x,y,z,mt){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; D.add(m); return m; };
            const fr=add(0.018,H-0.022-0.0025,z1-z0,fx+0.009,(H-0.022-0.0025)/2+0.0115,(z0+z1)/2,wal); if(GROOVE) NOTCH(D,fx+0.009,H-0.019,(z0+z1)/2,-Math.PI/2,0,0.18,wal.color.getHex());   // flush with the flap, 2-3 mm reveals
            add(0.17-fx-0.03,0.006,z1-z0-0.02,(fx+0.027+0.17)/2,0.015,(z0+z1)/2,inn); [z0+0.006,z1-0.006].forEach(function(zz){ add(0.17-fx-0.03,0.12,0.008,(fx+0.027+0.17)/2,0.075,zz,inn); }); add(0.008,0.12,z1-z0-0.02,0.168,0.075,(z0+z1)/2,inn);
            const st=stepper(0.7,function(t){ D.position.x=-0.33*ease(t); }); P.anims.push(function(t){ return st.run(t); });
            P.actions=(P.actions||[]).concat([{x:-0.6,z:(z0+z1)/2,part:[fr],label:function(){ return (st.target?'關上':'拉出')+q[4]+'抽屜'; },act:function(){ st.target=st.target?0:1; }}]); });
          (function(){ const D=new THREE.Group(), dw=dz1-dz0-0.002, yt=fy-0.002, inn=env.lam(0xe6e4df,{roughness:0.6}); P.group.add(D);   // remote-control drawer under the flap
            const add=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; D.add(m); return m; };
            add(new THREE.BoxGeometry(0.018,yt-0.006,dw),wal,fx+0.009,(yt+0.006)/2,dc); add(new THREE.BoxGeometry(0.004,0.006,0.2),grv,fx-0.0015,yt-0.016,dc);
            const bx0=fx+0.018, bx1=0.16, bw=dw-0.04; add(new THREE.BoxGeometry(bx1-bx0,0.008,bw),inn,(bx0+bx1)/2,0.026,dc);
            [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(bx1-bx0,0.08,0.01),inn,(bx0+bx1)/2,0.07,dc+sd*(bw/2-0.005)); }); add(new THREE.BoxGeometry(0.01,0.08,bw),inn,bx1-0.005,0.07,dc);
            const y0=0.03, cyl=function(r,h,mt,x,y,z){ return add(new THREE.CylinderGeometry(r,r,h,16),mt,x,y,z); };
            const pad=function(cx,cz,body,trim){                                                                              // DualShock-style controller lying face up, grips toward the front
              const b=y0+0.016; add(new THREE.BoxGeometry(0.06,0.032,0.13),body,cx,b,cz);
              [-1,1].forEach(function(sd){ const g=add(new THREE.SphereGeometry(0.024,16,10),body,cx-0.042,b-0.002,cz+sd*0.055); g.scale.set(2.0,0.8,1.0); g.rotation.y=sd*0.35; });
              add(new THREE.BoxGeometry(0.03,0.002,0.06),trim,cx+0.012,b+0.017,cz);                                             // touchpad
              add(new THREE.BoxGeometry(0.004,0.006,0.05),new THREE.MeshBasicMaterial({color:0x4aa8ff}),cx+0.031,b+0.008,cz);   // light bar
              [-1,1].forEach(function(sd){ cyl(0.011,0.008,trim,cx-0.012,b+0.02,cz+sd*0.024); cyl(0.012,0.003,trim,cx-0.012,b+0.026,cz+sd*0.024);   // sticks
                add(new THREE.BoxGeometry(0.014,0.008,0.022),trim,cx+0.026,b+0.012,cz+sd*0.045); });                             // L1 / R1
              add(new THREE.BoxGeometry(0.022,0.003,0.007),trim,cx+0.006,b+0.017,cz-0.046); add(new THREE.BoxGeometry(0.007,0.003,0.022),trim,cx+0.006,b+0.017,cz-0.046);   // d-pad
              [[0.009,0,0x5fbf8f],[-0.009,0,0x6f9ad6],[0,0.009,0xd8606a],[0,-0.009,0xd88fbf]].forEach(function(q){ cyl(0.0045,0.003,env.lam(q[2],{roughness:0.4}),cx+0.006+q[0],b+0.017,cz+0.046+q[1]); });   // face buttons
            };
            pad(bx0+0.075,dc-0.07,env.lam(0x1d1e20,{roughness:0.45}),env.lam(0x3a3c40,{roughness:0.35}));
            pad(bx0+0.075,dc+0.11,env.lam(0x2b3a55,{roughness:0.45}),env.lam(0x1d1e20,{roughness:0.35}));
            const remote=function(cx,cz,len,rows){ const rb=env.lam(0x232427,{roughness:0.4}), key=env.lam(0x8e9196,{roughness:0.5});   // slim remote with a grid of keys
              add(new THREE.BoxGeometry(len,0.016,0.044),rb,cx,y0+0.008,cz); cyl(0.005,0.003,env.lam(0xd8453c,{roughness:0.4}),cx+len/2-0.015,y0+0.017,cz+0.012);
              add(new THREE.TorusGeometry(0.012,0.003,6,18),key,cx+len/2-0.045,y0+0.017,cz).rotation.x=Math.PI/2;
              for(let rr=0;rr<rows;rr++) for(let c=-1;c<=1;c++) cyl(0.0035,0.003,key,cx+len/2-0.075-rr*0.016,y0+0.017,cz+c*0.012); };
            remote(bx0+0.115,dc-0.28,0.17,5); remote(bx0+0.09,dc-0.215,0.11,2);
            const coil=add(new THREE.TorusGeometry(0.04,0.004,6,24),env.lam(0xf3f3f1,{roughness:0.4}),bx0+0.25,y0+0.004,dc+0.25); coil.rotation.x=Math.PI/2;   // charging cable
            add(new THREE.BoxGeometry(0.02,0.008,0.012),env.lam(0xf3f3f1,{roughness:0.4}),bx0+0.2,y0+0.004,dc+0.2);
            [[-0.075,0],[0.04,0.25]].forEach(function(q,si){ for(let k=0;k<(si?3:4);k++){ const cz=dc+q[0]+k*0.003, cy=y0+0.0055+k*0.011, cx=bx0+0.26;   // Switch game cases, red band at the top edge
              const cs=add(new THREE.BoxGeometry(0.17,0.011,0.105),env.lam([0x3d8fd1,0xf2c94c,0x7fbf6a,0xe86a6a,0x8a6a9c,0xf08a24,0x2f4b6e][(si*4+k)%7],{roughness:0.5}),cx,cy,cz); cs.rotation.y=q[1]*k*0.15;
              const band=add(new THREE.BoxGeometry(0.022,0.0115,0.105),env.lam(0xe60012,{roughness:0.45}),cx+0.074,cy,cz); band.rotation.y=cs.rotation.y; } });
            add(new THREE.BoxGeometry(0.06,0.02,0.1),env.lam(0x1d1e20,{roughness:0.4}),bx0+0.27,y0+0.01,dc-0.25);   // cartridge case with a row of game cards
            for(let k=0;k<6;k++) add(new THREE.BoxGeometry(0.02,0.004,0.014),env.lam(0xe60012,{roughness:0.4}),bx0+0.27,y0+0.022,dc-0.287+k*0.015);
            add(new THREE.BoxGeometry(0.07,0.025,0.06),env.lam(0xe9eef0,{transparent:true,opacity:0.45,roughness:0.1}),bx0+0.07,y0+0.0125,dc+0.27);   // battery case
            for(let k=0;k<4;k++){ const bt=add(new THREE.CylinderGeometry(0.007,0.007,0.05,10),env.lam(k%2?0xd9a441:0x2b2b2b,{roughness:0.4}),bx0+0.07,y0+0.008,dc+0.252+k*0.012); bt.rotation.z=Math.PI/2; }
            const st=stepper(0.5,function(t){ D.position.x=-0.3*ease(t); }); P.anims.push(function(t){ return st.run(t); });
            P.actions=(P.actions||[]).concat([{x:-0.6,z:dc+0.15,part:[D],label:function(){ return st.target?'關上遙控器抽屜':'打開遙控器抽屜'; },act:function(){ st.target=st.target?0:1; }}]); })();
          if(!LIDON) [[0,'書'],[2,'桌遊']].forEach(function(q){ const a=q[0], b=a+1, st=stepper(0.6,function(t){ const e=ease(t); dg[a].rotation.y=-doors[a][2]*Math.PI/2*e; dg[b].rotation.y=-doors[b][2]*Math.PI/2*e; });
            P.anims.push(function(t){ return st.run(t); });
            P.actions=(P.actions||[]).concat([{x:-0.6,z:doors[a][1],part:[dg[a],dg[b]],label:function(){ return st.target?'關上'+q[1]+'櫃':'打開'+q[1]+'櫃'; },act:function(){ st.target=st.target?0:1; }}]); }); }
        const strut=[-1,1].map(function(sd){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.006,1,0.006),M.steel); P.add(m,oc); return {m:m,z:sd>0?dz1-0.02:dz0+0.02}; });
        const setFlap=function(e){ const a=e*Math.PI/2; F.rotation.z=a;
          strut.forEach(function(s){ const bx=fx-0.014+0.032*Math.cos(a)-0.12*Math.sin(a), by=fy+0.032*Math.sin(a)+0.12*Math.cos(a), ax=fx+0.04, ay=0.37+dy, len=Math.hypot(bx-ax,by-ay);
            s.m.position.set((ax+bx)/2,(ay+by)/2+L,s.z); s.m.scale.y=len; s.m.rotation.set(0,0,Math.atan2(ax-bx,by-ay)); s.m.visible=e>0.02; }); };
        setFlap(0);
        const st=stepper(0.6,function(t){ setFlap(ease(t)); }); P.anims.push(function(t){ return st.run(t); });
        P.actions=(P.actions||[]).concat([{x:-0.6,z:FL?dc-0.15:dc,part:[F].concat(strut.map(function(q){ return q.m; })),label:function(){ return st.target?'關上電視櫃下掀門':'打開電視櫃下掀門'; },act:function(){ st.target=st.target?0:1; }}]);
        if(!FL) P.box(-0.17,0.17,-B/2+0.06,B/2-0.06,0.174,0.18,env.lam(0xfff1d6,{emissive:0xffd9a0,emissiveIntensity:0.8}),{cast:false});
        (function(){ const x0=spec&&spec.wall?0.05:-0.13, x1=x0+0.06, y0=spec&&spec.wall?H+0.08:H+0.025, y1=y0+0.055, gr=mat('sbGrille',0xffffff,{roughness:0.95,map:(function(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.fillStyle='#2b2d30'; g.fillRect(0,0,64,64); g.fillStyle='#1b1c1e'; for(let j=0;j<16;j++) for(let i=0;i<16;i++){ g.beginPath(); g.arc(2+i*4+(j%2)*2,2+j*4,1.1,0,7); g.fill(); } const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(36,2); return t; })()});   // soundbar: a graphite body with rounded ends, a fine perforated grille wrapped round the front, a status light on top
          P.rbox(x0,x1,-0.45,0.45,y0,y1,0.024,mat('sbBody',0x2b2d30,{roughness:0.45,metalness:0.2}));
          const fg=new THREE.Mesh(new THREE.PlaneGeometry(0.86,y1-y0-0.012),gr); fg.rotation.y=-Math.PI/2; fg.position.set(x0-0.0008,(y0+y1)/2,0); P.add(fg,{cast:false});
          P.box(x0+0.02,x0+0.026,-0.03,0.03,y1-0.0005,y1+0.0005,new THREE.MeshBasicMaterial({color:0xdfe8ef}),{cast:false}); })();   // wall-hung TV: the soundbar hangs on a bracket under the screen
        if(L) P.group.children.forEach(function(o){ o.position.y+=L; });
      } else {
        P.rb(0,0,0.4,B,0.36,0.015,M.oak,0.08,true);
        P.legs(0,0,0.15,B/2-0.08,0.08,0.03,0.02,M.oakD);
        P.cabDoors('z',-B/2+0.02,B/2-0.02,-0.2,-1,0.1,0.42,3,false,M.oakD);
      }
      const WMT=!!(spec&&spec.wall), cx=WMT?0.13:2*S, cz=0, W=inch?W0:1.24, Hh=spec?(spec.w-0.009)*9/16+0.009:inch?inch*0.01245:0.70, FB=inch&&floor, tb=FB?0.395:0.44+L, y0=WMT?tb+0.125:FB?(spec?0.4+spec.h-Hh:0.48):0.58+L, fz=W*0.37, fd0=spec?0.195-spec.d-cx:-0.11, fd1=spec?0.195-cx:0.09;   // panel height from the 16:9 screen plus a thin bezel                // the TV sits 2 plan pixels east of the board centre
      const tv0=P.group.children.length;
      if(WMT){ [-0.22,0.22].forEach(function(z){ P.box(cx+0.045,0.2,cz+z-0.02,cz+z+0.02,y0+Hh*0.2,y0+Hh*0.75,M.black); }); P.box(cx+0.045,0.19,cz-0.24,cz+0.24,y0+Hh*0.55,y0+Hh*0.55+0.04,M.black); }   // wall bracket
      else [-1,1].forEach(s=>{                                                            // two flat feet with short necks
        P.rbox(cx+fd0,cx+fd1,cz+s*fz-0.035,cz+s*fz+0.035,tb,tb+0.015,0.006,M.black);
        P.box(cx-0.01,cx+0.02,cz+s*fz-0.02,cz+s*fz+0.02,tb+0.015,y0+0.02,M.black);
      });
      P.rbox(cx-0.0,cx+0.045,cz-W*0.27,cz+W*0.27,y0+0.1,y0+0.1+Hh*0.66,0.012,M.black);   // thicker rear housing
      P.box(cx-0.03,cx+0.0,cz-W/2,cz+W/2,y0,y0+Hh,M.black); const edge=mat('tvEdge',0x4a4d52,{metalness:0.7,roughness:0.35}); [[cz-W/2-0.002,cz-W/2+0.002],[cz+W/2-0.002,cz+W/2+0.002]].forEach(function(q){ P.box(cx-0.031,cx-0.001,q[0],q[1],y0,y0+Hh,edge,{cast:false}); }); [[y0-0.002,y0+0.002],[y0+Hh-0.002,y0+Hh+0.002]].forEach(function(q){ P.box(cx-0.031,cx-0.001,cz-W/2,cz+W/2,q[0],q[1],edge,{cast:false}); });   // slim panel body, 3 cm, a brushed metal edge round it
      const bz=0.009;                                                             // thin bezel around the glass
      const sm=new THREE.MeshStandardMaterial({color:0x04060a,roughness:0.05,metalness:0.25,envMapIntensity:1.6});
      const gl=new THREE.Mesh(new THREE.PlaneGeometry(W-2*bz,Hh-2*bz),sm);
      gl.rotation.y=-Math.PI/2; gl.position.set(cx-0.0305,y0+Hh/2,cz); P.add(gl,{cast:false,recv:false});
      P.box(cx-0.032,cx-0.0295,cz-0.012,cz+0.012,y0+0.004,y0+0.0075,new THREE.MeshBasicMaterial({color:0x2a2a2a}),{cast:false});   // standby LED
      P.tvParts=P.group.children.slice(tv0);
      if(WMT){ const pl=env.lam(0xf4f3ef,{roughness:0.35}), sl=env.lam(0x5a5d62), oc2={cast:false}, yo=y0+0.36;   // hidden behind the TV: a recessed outlet and a cable outlet plate on the conduit to the board
        P.box(0.194,0.2,-0.2,-0.13,yo,yo+0.12,pl,oc2); [0.035,0.085].forEach(function(dy){ [-1,1].forEach(function(sd){ P.box(0.1935,0.194,-0.165+sd*0.007,-0.165+sd*0.007+0.002,yo+dy-0.008,yo+dy+0.008,sl,oc2); }); });
        P.box(0.194,0.2,-0.08,-0.01,yo,yo+0.12,pl,oc2); P.box(0.1935,0.194,-0.065,-0.025,yo+0.03,yo+0.09,sl,oc2); }
      const sc=document.createElement('canvas'); sc.width=640; sc.height=360; const g=sc.getContext('2d');
      const sky=g.createLinearGradient(0,0,0,360); sky.addColorStop(0,'#5aa0dc'); sky.addColorStop(0.55,'#bfe0f4'); sky.addColorStop(0.62,'#f5e6c8'); sky.addColorStop(1,'#f5e6c8');
      g.fillStyle=sky; g.fillRect(0,0,640,360);
      g.fillStyle='#fff'; [[110,70,90],[300,50,70],[470,90,100]].forEach(function(c){ g.globalAlpha=0.8; g.beginPath(); g.ellipse(c[0],c[1],c[2],c[2]*0.28,0,0,TAU); g.fill(); }); g.globalAlpha=1;
      g.fillStyle='#4f8f6a'; g.beginPath(); g.moveTo(0,250); g.quadraticCurveTo(160,170,330,235); g.quadraticCurveTo(480,290,640,200); g.lineTo(640,360); g.lineTo(0,360); g.fill();
      g.fillStyle='#2f6b52'; g.beginPath(); g.moveTo(0,300); g.quadraticCurveTo(220,250,420,310); g.quadraticCurveTo(540,340,640,290); g.lineTo(640,360); g.lineTo(0,360); g.fill();
      const st=new THREE.CanvasTexture(sc); st.colorSpace=THREE.SRGBColorSpace;
      P.tvOn=function(on){ if(on){ sm.emissive.setHex(0xffffff); sm.emissiveMap=st; sm.emissiveIntensity=0.85; sm.color.setHex(0x000000); } else { sm.emissive.setHex(0x000000); sm.emissiveMap=null; sm.color.setHex(0x04060a); } sm.needsUpdate=true; };
      P.tvOn(false);
      return P;
    };

    /* 2.0 x 0.65 m desk with drawer pedestal, 27-inch monitor, keyboard, lamp, books, mug and an enclosed 3D printer at the right end.
       Front (where you sit) = +z. The printer animates while state.active is true (somebody is working): see piece.anims. */
    /* enclosed 3D printer (38 x 38 x 46 cm) standing at (px, y, pz) of piece P, printing a little robot layer by layer while active */
    function addPrinter3d(P,px,pz,y,always){
        const lam=env.lam, w=0.38, d=0.38, h=0.46, o={}, oc={cast:false};
        const frame=lam(0x1c1e21,{roughness:0.45}), gl=lam(0x9fb2bf,{transparent:true,opacity:0.22,roughness:0.05,metalness:0.1,envMapIntensity:1,side:THREE.DoubleSide,depthWrite:false});
        P.rbox(px-w/2,px+w/2,pz-d/2,pz+d/2,y,y+0.06,0.012,frame); [[px-w/2,px+w/2,pz-d/2,pz-d/2+0.016],[px-w/2,px+w/2,pz+d/2-0.016,pz+d/2],[px-w/2,px-w/2+0.016,pz-d/2,pz+d/2],[px+w/2-0.016,px+w/2,pz-d/2,pz+d/2]].forEach(function(r){ P.box(r[0],r[1],r[2],r[3],y+h-0.016,y+h,frame,o); }); P.box(px-w/2+0.016,px+w/2-0.016,pz-d/2+0.016,pz+d/2-0.016,y+h-0.008,y+h-0.004,gl,oc);   // base, and a glass lid in a thin frame on top
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.cyl(px+c[0]*(w/2-0.012),pz+c[1]*(d/2-0.012),0.013,0.013,y,y+h,frame,o,16); });   // rounded corner posts
        [-1,1].forEach(function(sd){ for(let i=0;i<7;i++) P.box(px+sd*(w/2+0.0005)-0.001,px+sd*(w/2+0.0005)+0.001,pz-0.12+i*0.04-0.012,pz-0.12+i*0.04+0.012,y+h-0.12,y+h-0.04,lam(0x2b2d31,{roughness:0.6}),oc); });   // vent slots high on the side panels
        P.box(px-w/2+0.03,px+w/2-0.03,pz+d/2-0.03,pz+d/2-0.02,y+h-0.03,y+h-0.024,new THREE.MeshBasicMaterial({color:0xf4f8ff}),oc);   // chamber light along the front edge
        P.box(px-w/2+0.012,px-w/2+0.024,pz+d/2+0.002,pz+d/2+0.016,y+0.14,y+h-0.08,lam(0x2b2d31,{roughness:0.4}),oc);   // a slim pull on the door's free edge
        P.box(px-w/2,px-w/2+0.006,pz-d/2,pz+d/2,y+0.06,y+h-0.02,frame,o); P.box(px+w/2-0.006,px+w/2,pz-d/2,pz+d/2,y+0.06,y+h-0.02,frame,o); P.box(px-w/2,px+w/2,pz-d/2,pz-d/2+0.006,y+0.06,y+h-0.02,frame,o);
        P.box(px-w/2+0.01,px+w/2-0.01,pz+d/2-0.004,pz+d/2,y+0.06,y+h-0.02,gl,oc);                            // glass door
        const TG=new THREE.Group(); TG.position.set(px,y+h,pz-d/2+0.01); P.group.add(TG); const top=new THREE.Mesh(new THREE.BoxGeometry(w-0.03,0.004,d-0.03),gl); top.position.set(0,0.002,(d-0.03)/2); TG.add(top);
        [[-(w-0.03)/2,-(w-0.03)/2+0.012],[(w-0.03)/2-0.012,(w-0.03)/2]].forEach(function(r){ const f=new THREE.Mesh(new THREE.BoxGeometry(r[1]-r[0],0.008,d-0.03),frame); f.position.set((r[0]+r[1])/2,0.004,(d-0.03)/2); TG.add(f); });   // the glass top lid on its rear hinge, framed at the sides
        const sTo=stepper(0.7,function(v){ TG.rotation.x=-1.15*ease(v); });
        P.actions=(P.actions||[]).concat([{x:px+0.1,z:pz+d/2+0.5,part:[top],label:function(){ return sTo.target?'蓋上3D印表機上蓋':'掀開3D印表機上蓋'; },act:function(){ sTo.target=sTo.target?0:1; }}]);
        P.box(px+0.08,px+0.16,pz+d/2,pz+d/2+0.004,y+0.012,y+0.05,new THREE.MeshBasicMaterial({color:0x7fd6ff}),oc);   // small screen
        P.box(px-0.15,px+0.15,pz-0.15,pz+0.15,y+0.07,y+0.078,lam(0x3a3f45,{roughness:0.3,metalness:0.5}),oc);   // build plate
        const rail=P.box(px-0.17,px+0.17,pz-0.012,pz+0.012,y+0.3,y+0.32,lam(0x8d949c,{metalness:0.8,roughness:0.3}),oc);
        const head=new THREE.Group(); head.position.set(px,y+0.28,pz); P.group.add(head);                  // toolhead: shroud, heatsink fins, brass hotend + nozzle, PTFE tube
        const hm=function(geo,mat,x,yy,z){ const m=new THREE.Mesh(geo,mat); m.position.set(x,yy,z); m.castShadow=true; head.add(m); return m; };
        const shroud=lam(0xe9ecef,{roughness:0.35}), dark=lam(0x1d1f22,{roughness:0.5}), brass=lam(0xc9a24a,{metalness:0.9,roughness:0.3,envMapIntensity:1});
        hm(new THREE.BoxGeometry(0.075,0.026,0.032),dark,0,0.045,-0.008);                                  // carriage riding on the X rail
        head.add(P.rbox(-0.03,0.03,-0.032,0.03,-0.035,0.035,0.008,shroud));                                // main shroud, flat front
        const duct=hm(new THREE.BoxGeometry(0.056,0.004,0.024),dark,0,-0.03,0.026); duct.rotation.x=0.6;   // slanted part-cooling duct
        hm(new THREE.BoxGeometry(0.03,0.004,0.002),dark,0,0.018,0.0305);                                    // small status strip
        hm(new THREE.BoxGeometry(0.002,0.04,0.04),dark,-0.031,0.002,0);                                    // side fan grille
        for(let i=0;i<5;i++) hm(new THREE.BoxGeometry(0.003,0.002,0.034),lam(0x6a6f75),-0.0322,-0.014+i*0.008,0);
        hm(new THREE.BoxGeometry(0.016,0.012,0.016),brass,0,-0.043,0);                                     // heater block
        const nz=hm(new THREE.ConeGeometry(0.0055,0.011,10),brass,0,-0.054,0); nz.rotation.x=Math.PI;       // nozzle tip
        hm(new THREE.CylinderGeometry(0.0045,0.0045,0.1,8),lam(0xf4f4f0,{roughness:0.4,transparent:true,opacity:0.85}),0.012,0.1,-0.012);   // PTFE feed tube
        const clip=new THREE.Plane(new THREE.Vector3(0,-1,0),y+0.08); env.enableLocalClipping();             // the print appears layer by layer below this plane
        const pla=lam(0xf4f2ee,{roughness:0.55,clippingPlanes:[clip],clipShadows:true,side:THREE.DoubleSide});
        const robot=new THREE.Group(); robot.position.set(px-0.03,y+0.078,pz+0.02); P.group.add(robot);     // little white-PLA robot, about 10 cm tall
        const rp=function(geo,x,yy,z){ const m=new THREE.Mesh(geo,pla); m.position.set(x,yy,z); m.castShadow=true; m.receiveShadow=true; robot.add(m); return m; };
        [-1,1].forEach(function(sd){ rp(new THREE.BoxGeometry(0.016,0.006,0.022),sd*0.012,0.003,0.003);       // feet
          rp(new THREE.CylinderGeometry(0.005,0.006,0.022,10),sd*0.012,0.017,0);                              // legs
          const arm=rp(new THREE.CylinderGeometry(0.004,0.004,0.026,10),sd*0.029,0.044,0.004); arm.rotation.z=sd*0.35; arm.rotation.x=-0.3;
          rp(new THREE.SphereGeometry(0.006,10,8),sd*0.034,0.031,0.009);                                      // hands
          rp(new THREE.CylinderGeometry(0.004,0.004,0.004,10),sd*0.024,0.074,0).rotation.z=Math.PI/2; });     // ear bolts
        rp(new THREE.BoxGeometry(0.044,0.034,0.026),0,0.045,0);                                               // body
        rp(new THREE.BoxGeometry(0.02,0.012,0.004),0,0.048,0.014);                                            // chest panel
        rp(new THREE.CylinderGeometry(0.006,0.006,0.006,10),0,0.064,0);                                       // neck
        rp(new THREE.BoxGeometry(0.04,0.026,0.026),0,0.08,0);                                                 // head
        [-1,1].forEach(function(sd){ rp(new THREE.CylinderGeometry(0.004,0.004,0.004,12),sd*0.009,0.082,0.014).rotation.x=Math.PI/2; });   // eyes
        rp(new THREE.CylinderGeometry(0.0015,0.0015,0.012,6),0,0.099,0); rp(new THREE.SphereGeometry(0.0035,10,8),0,0.106,0);   // antenna
        const sp=new THREE.Mesh(new THREE.TorusGeometry(0.08,0.03,10,24),lam(0xf1efea,{roughness:0.55})); sp.position.set(px,y+0.2,pz-d/2-0.035); P.add(sp,oc);   // filament spool on the back
        const rz0=rail.position.z, hy0=head.position.y, ry0=rail.position.y, tmp=new THREE.Vector3();
        let prog=0.35; P.setPrintProgress=function(v){ prog=v; };
        P.anims.push(function(t){ return sTo.run(t); });
        P.anims.push(function(t,state){
          const active=always||!!(state&&state.active);
          if(active){ prog+=0.0005; if(prog>1.25) prog=0; }                     // print, pause on the finished robot, start again
          P.group.getWorldPosition(tmp);
          const hgt=0.002+0.108*prog; clip.constant=tmp.y+y+0.078+hgt;           // clipping planes work in world space
          const lift=Math.min(hgt,0.11); head.position.y=hy0-0.12+lift; rail.position.y=ry0-0.07+lift;
          const mx=active?Math.sin(t*3.1)*0.045:0, mz=active?Math.cos(t*2.3)*0.04:0;
          head.position.x=px-0.03+mx; head.position.z=pz+0.02+mz; rail.position.z=rz0+0.02+mz;
        });
    }
    /* 3D printer on a 50 x 50 cm oak cart with a filament drawer; always printing; front +z */
    Catalog.printer3d=function(y){ const P=new Piece(); addPrinter3d(P,0,0,y||0,true); P._col(-0.19,0.19,-0.19,0.19,false); return P; };   // enclosed printer alone, standing on a surface at height y
    Catalog.printerCart=function(){
      const P=new Piece(), lam=env.lam;
      P.rb(0,0,0.5,0.5,0.03,0.01,M.oak,0.67,true); P.box(-0.24,0.24,-0.24,0.24,0.1,0.67,M.oakD);
      P.box(-0.22,0.22,0.24,0.25,0.38,0.62,M.oak,{cast:false}); P.box(-0.06,0.06,0.25,0.262,0.48,0.5,M.steel,{cast:false});
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.cyl(c[0]*0.2,c[1]*0.2,0.03,0.03,0.0,0.1,lam(0x2a2826,{roughness:0.5}),{cast:false},12); });
      addPrinter3d(P,0,0.02,0.7,true);
      return P;
    };
    Catalog.desk=function(){
      const P=new Piece(), bookMats=[0x8d6a47,0x5f6f82,0xb26b5a,0xd8d2c6,0x3f4a58,0x8a9a86,0xc9b27f,0xe7e4de].map(c=>env.lam(c,{roughness:0.8}));
      const lam=env.lam;
      P.rb(0,0,2.0,0.65,0.035,0.01,M.oak,0.685,true);
      P.fb(-0.97,0,0.04,0.6,0.685,M.oakD,0,false); P.fb(0.97,0,0.04,0.6,0.685,M.oakD,0,false);
      P.fb(0,-0.27,1.9,0.02,0.4,M.oakD,0.28,false);
      P.rb(0.62,0,0.4,0.52,0.5,0.01,M.oakD,0.13,false);                         // drawer pedestal
      P.fb(0.62,0.27,0.38,0.012,0.14,M.oak,0.15,false); P.fb(0.62,0.27,0.38,0.012,0.14,M.oak,0.32,false); P.fb(0.62,0.27,0.38,0.012,0.14,M.oak,0.49,false);
      const sm=lam(0x0c1118,{roughness:0.12,metalness:0.3,envMapIntensity:1.2});
      P.fb(-0.3,-0.2,0.04,0.04,0.14,M.black,0.72,false); P.fb(-0.3,-0.2,0.24,0.16,0.012,M.black,0.72,false);   // 27-inch monitor on a stand
      P.fb(-0.3,-0.23,0.62,0.03,0.37,M.black,0.82,false); P.fb(-0.3,-0.214,0.6,0.004,0.35,sm,0.83,false);
      P.fb(-0.3,0.1,0.43,0.14,0.018,M.black,0.72,false); P.fb(0.02,0.1,0.06,0.1,0.03,M.black,0.72,false);       // keyboard, mouse
      P.cyl(0.38,-0.2,0.06,0.06,0.72,0.735,M.dark,{cast:false},12);              // desk lamp
      P.cyl(0.38,-0.2,0.008,0.008,0.735,1.07,M.dark,{cast:false},6);
      P.shade(0.38,-0.2,0.09,0.06,0.97,1.09);
      addPrinter3d(P,0.76,-0.03,0.72,false);
      [0,1,2,3].forEach(function(i){ P.fb(-0.88,0.1-i*0.01,0.2,0.26,0.035,bookMats[i+1],0.72+i*0.035,false); });   // book stack
      P.fcyl(0.1,-0.1,0.04,0.035,0.72,0.09,M.ceramic,false);
      return P;
    };

    /* swivel office chair on a five-star base; the back rest is on the +z side, so you face -z */
    Catalog.officeChair=function(){
      const P=new Piece();
      P.rb(0,0,0.5,0.48,0.08,0.035,M.sofaD,0.44,true);
      P.rb(0,0.22,0.46,0.07,0.52,0.03,M.sofaD,0.52,false);
      P.cyl(0,0,0.03,0.03,0.08,0.44,M.steel,{cast:false},10);
      for(let k=0;k<5;k++){ const a=k*TAU/5+0.3; P.rotBox(Math.cos(a)*0.15,-Math.sin(a)*0.15,0.3,0.04,0.05,0.08,a,M.steel,{cast:false}); P.cyl(Math.cos(a)*0.29,-Math.sin(a)*0.29,0.025,0.025,0.0,0.05,M.black,{cast:false},8); }
      return P;
    };

    /* racing-style gaming chair, black with white bolsters, no logos: seat 49 x 37 cm, back 83 cm (54 cm at the shoulders), 63.5 cm over the arms, 60 cm star base, seat 40-48 cm.
       Sitter faces -z. 「躺下」 tips the back to 135 degrees and slides the hidden footrest (39 x 20 cm) out from under the seat front. */
    Catalog.gamingChair=function(){
      const P=new Piece(), lam=env.lam, blk=lam(0x2c2d31,{roughness:0.5,envMapIntensity:1.1}), wh=lam(0xf2f1ee,{roughness:0.5}), nyl=lam(0x232427,{roughness:0.45}), chrome=lam(0xd4d8dc,{metalness:0.9,roughness:0.2}), oc={cast:false}, SY=0.45;
      const sm=function(a,b,x){ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
      const rr=function(G,w,h,d,x,y,z,mt,r,rx){ const s=new THREE.Shape(), a=w/2, b=h/2; r=Math.min(r,a,b); s.moveTo(-a+r,-b); s.lineTo(a-r,-b); s.quadraticCurveTo(a,-b,a,-b+r); s.lineTo(a,b-r); s.quadraticCurveTo(a,b,a-r,b); s.lineTo(-a+r,b); s.quadraticCurveTo(-a,b,-a,b-r); s.lineTo(-a,-b+r); s.quadraticCurveTo(-a,-b,-a+r,-b);
        const bv=Math.min(0.012,d/3), g=new THREE.ExtrudeGeometry(s,{depth:d-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelSegments:3,curveSegments:6}); g.translate(0,0,-(d-2*bv)/2); const m=new THREE.Mesh(g,mt); m.position.set(x,y,z); if(rx) m.rotation.x=rx; m.castShadow=true; m.receiveShadow=true; G.add(m); return m; };
      /* upholstery: a mid surface S(u,v) (u,v in -1..1) puffed out along N by tf in front and tb behind, closing in a round edge; painted from a canvas by (u,v) */
      const skin=function(key,draw){ const T=Catalog.__chairTex||(Catalog.__chairTex={}); if(T[key]) return T[key]; const c=document.createElement('canvas'); c.width=256; c.height=512; draw(c.getContext('2d'),256,512); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy||4; return T[key]=t; };
      const pillow=function(par,S,N,tf,tb,nu,nv,mt,mtB,ex){ const geo=function(sd,th){ const pos=[], uv=[], idx=[], p=new THREE.Vector3(), q=new THREE.Vector3();
          for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++){ const u=-1+2*i/nu, v=-1+2*j/nv, e=Math.sqrt(Math.max(0,1-Math.pow(Math.abs(u),ex||6)))*Math.sqrt(Math.max(0,1-Math.pow(Math.abs(v),ex||6))); S(u,v,p); N(u,v,q); p.addScaledVector(q,sd*th(u,v)*e); pos.push(p.x,p.y,p.z); uv.push((u+1)/2,(v+1)/2); }
          for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const a=j*(nu+1)+i, b=a+1, c=a+nu+1, d=c+1; if(sd>0) idx.push(a,b,c,b,d,c); else idx.push(a,c,b,b,c,d); }
          const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
        const out=[]; [[-1,tf,mt],[1,tb,mtB||mt]].forEach(function(q){ const m=new THREE.Mesh(geo(q[0],q[1]),q[2]); m.castShadow=true; m.receiveShadow=true; par.add(m); out.push(m); }); return out; };
      const stitch=function(g,x0,y0,x1,y1){ g.setLineDash([5,4]); g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); g.setLineDash([]); };
      /* five-star base: arched legs tapering to rounded caster housings, a hub cone, gas lift and a mechanism housing under the seat */
      for(let k=0;k<5;k++){ const a=k*Math.PI*2/5+Math.PI/2, ca=Math.cos(a), sa=-Math.sin(a), cu=new THREE.CatmullRomCurve3([[0.035,0.1],[0.12,0.108],[0.22,0.092],[0.285,0.065]].map(function(q){ return new THREE.Vector3(ca*q[0],q[1],sa*q[0]); }));
        const tg=new THREE.TubeGeometry(cu,16,0.02,10,false), tp=tg.attributes.position; for(let i=0;i<tp.count;i++){ const r=Math.floor(i/11), c0=cu.getPointAt(r/16), v=new THREE.Vector3(tp.getX(i),tp.getY(i),tp.getZ(i)).sub(c0); v.multiplyScalar(1-0.45*r/16); v.y*=0.75; v.add(c0); tp.setXYZ(i,v.x,v.y,v.z); } tg.computeVertexNormals(); P.add(new THREE.Mesh(tg,nyl),oc);
        const hs=new THREE.Mesh(new THREE.SphereGeometry(0.024,14,10,0,Math.PI*2,0,Math.PI/2),nyl); hs.scale.set(1,0.9,1.2); hs.rotation.y=-a; hs.position.set(ca*0.285,0.042,sa*0.285); P.add(hs,oc);
        [-1,1].forEach(function(sd){ const w=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.012,18),blk); w.rotation.order='YXZ'; w.rotation.set(0,a+Math.PI/2,Math.PI/2); w.position.set(ca*0.285-sa*0.012*sd,0.026,sa*0.285+ca*0.012*sd); P.add(w,oc); }); }
      P.cyl(0,0,0.035,0.05,0.07,0.13,nyl,oc,20); P.cyl(0,0,0.022,0.022,0.13,0.36,chrome,oc,16); P.cyl(0,0,0.03,0.026,0.24,0.37,blk,oc,16);   // hub, gas lift, telescoping shroud
      rr(P.group,0.2,0.05,0.26,0,0.385,0.0,blk,0.02); P.cyl(0.13,0.07,0.006,0.006,0.37,0.39,blk,oc,8); const lv=new THREE.Mesh(new THREE.CapsuleGeometry(0.008,0.09,4,8),blk); lv.rotation.x=Math.PI/2; lv.position.set(0.16,0.385,0.02); P.add(lv,oc);   // tilt mechanism housing and the lift lever
      /* seat: contoured cushion, raised rounded side bolsters, a waterfall front */
      const S=new THREE.Group(); P.group.add(S);
      const seatT=skin('seat',function(g,W,H){ g.fillStyle='#1f2023'; g.fillRect(0,0,W,H); g.fillStyle='#f2f1ee'; g.fillRect(0,0,W*0.17,H); g.fillRect(W*0.83,0,W*0.17,H); g.strokeStyle='#8c8c8c'; g.lineWidth=2; [0.19,0.81].forEach(function(f){ stitch(g,W*f,0,W*f,H); }); g.strokeStyle='#d7d5cf'; [0.08,0.92].forEach(function(f){ stitch(g,W*f,H*0.05,W*f,H*0.95); }); g.strokeStyle='#3a3b3f'; for(let k=1;k<5;k++) stitch(g,W*0.2,H*k/5,W*0.8,H*k/5); });
      const seatM=lam(0xffffff,{map:seatT,roughness:0.55});
      pillow(S,function(u,v,p){ const w=0.25*(1-0.06*Math.max(0,v)), fr=sm(0.55,1,-v); p.set(u*w,SY+0.01+0.045*sm(0.5,0.95,Math.abs(u))-0.03*fr*fr,-v*0.25); },function(u,v,q){ q.set(0,1,-0.35*sm(0.6,1,-v)).normalize(); },function(u,v){ return 0.05+0.015*sm(0.55,0.95,Math.abs(u)); },function(){ return 0.03; },28,24,seatM,blk,5);
      const B=new THREE.Group(); B.position.set(0,SY+0.02,0.22); P.group.add(B);   // backrest pivots at the back of the seat
      const back=new THREE.Group(); B.add(back);
      /* backrest: S-shaped side profile (lumbar forward, shoulders back, a rounded top), wider shoulders tapering to the head, bolsters wrapping the torso */
      const backT=skin('back',function(g,W,H){ g.fillStyle='#1f2023'; g.fillRect(0,0,W,H); g.fillStyle='#f2f1ee'; g.fillRect(0,H*0.08,W*0.15,H*0.92); g.fillRect(W*0.85,H*0.08,W*0.15,H*0.92); g.strokeStyle='#8c8c8c'; g.lineWidth=2; [0.17,0.83].forEach(function(f){ stitch(g,W*f,H*0.06,W*f,H*0.97); }); g.strokeStyle='#d7d5cf'; [0.07,0.93].forEach(function(f){ stitch(g,W*f,H*0.1,W*f,H*0.97); }); g.strokeStyle='#3a3b3f'; for(let k=1;k<9;k++) stitch(g,W*0.19,H*(0.08+k*0.1),W*0.81,H*(0.08+k*0.1)); });
      const backM=lam(0xffffff,{map:backT,roughness:0.55}), coverT=skin('cover',function(g,W,H){ g.fillStyle='#1d1e21'; g.fillRect(0,0,W,H); g.strokeStyle='#2c2d31'; g.lineWidth=3; g.strokeRect(W*0.18,H*0.12,W*0.64,H*0.72); }), coverM=lam(0xffffff,{map:coverT,roughness:0.6});
      const hw=function(v){ const y=(v+1)/2; let w=0.25+0.025*sm(0.35,0.7,y)-0.06*sm(0.72,0.95,y); if(y>0.9) w*=Math.sqrt(Math.max(0.05,1-Math.pow((y-0.9)/0.1,2)*0.75)); return w; };
      const zc=function(y){ return -0.03*Math.exp(-Math.pow((y-0.25)/0.14,2))+0.035*sm(0.35,0.8,y)-0.012*sm(0.85,1,y); };
      const backMesh=pillow(back,function(u,v,p){ const y=(v+1)/2, au=Math.abs(u), wrap=sm(0.5,1,au)*(0.07*(1-sm(0.65,0.85,y))*sm(0.02,0.2,y)+0.02); p.set(u*hw(v),0.03+0.8*y,zc(y)-wrap); },function(u,v,q){ q.set(0,0,1); },function(u,v){ return 0.03+0.025*sm(0.5,0.95,Math.abs(u)); },function(){ return 0.045; },26,40,backM,coverM,5);
      const pil=function(w,h,d,y,z){ const g=new THREE.SphereGeometry(1,28,18); g.scale(w/2,h/2,d/2); const pp=g.attributes.position; for(let i=0;i<pp.count;i++){ const x=pp.getX(i), yy=pp.getY(i), zz=pp.getZ(i); pp.setZ(i,zz*(1-0.35*Math.pow(Math.abs(x)/(w/2),4))); pp.setY(i,yy*(1-0.15*Math.pow(Math.abs(x)/(w/2),6))); } g.computeVertexNormals(); const m=new THREE.Mesh(g,blk); m.position.set(0,y,z); m.castShadow=true; back.add(m);
        const sn=new THREE.Mesh(new THREE.TorusGeometry(1,0.004,6,48),lam(0x3a3b3f,{roughness:0.6})); sn.scale.set(w/2*1.0,h/2*1.0,1); sn.position.set(0,y,z); back.add(sn); return m; };   // pillows: rounded, a seam round the edge
      pil(0.25,0.1,0.07,0.75,zc(0.94)-0.075); pil(0.27,0.13,0.08,0.24,zc(0.25)-0.08);
      /* arms: rounded pads on tapered posts, linked to the back */
      const armL=[]; [-1,1].forEach(function(sd){ const A=new THREE.Group(); A.position.set(sd*0.29,0,0); P.group.add(A); const pg=new THREE.CylinderGeometry(0.016,0.024,0.17,16); pg.scale(1,1,1.6); const po=new THREE.Mesh(pg,nyl); po.position.set(0,SY+0.075,0.09); po.castShadow=true; A.add(po); rr(A,0.03,0.05,0.18,-sd*0.015,SY+0.01,0.07,nyl,0.012).rotation.y=0; 
        const pd=new THREE.Mesh(new THREE.CapsuleGeometry(0.034,0.19,6,16),nyl); pd.rotation.x=Math.PI/2-0.05; pd.scale.set(1.1,1,0.5); pd.position.set(0,SY+0.172,0.0); pd.castShadow=true; A.add(pd); armL.push(A); });
      const F=new THREE.Group(); F.position.set(0,SY-0.08,-0.05); P.group.add(F);
      [-1,1].forEach(function(sd){ const r=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.42,8),chrome); r.rotation.x=Math.PI/2; r.position.set(sd*0.12,0,0.05); F.add(r); });
      const pad=new THREE.Group(); pad.position.set(0,0,-0.15); F.add(pad); pillow(pad,function(u,v,p){ p.set(u*0.195,0,v*0.09); },function(u,v,q){ q.set(0,1,0); },function(){ return 0.042; },function(){ return 0.036; },16,10,blk,blk,3);
      const st=stepper(1.0,function(v){ const e=ease(v); B.rotation.x=0.12+0.66*e; F.position.z=-0.05-0.45*e; F.position.y=SY-0.08+0.02*e; pad.rotation.x=-0.3*e; });
      st.run(0); P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:0,z:-0.6,part:[backMesh[0]],label:function(){ return st.target?'坐起（電競椅）':'躺下（電競椅，135°＋腳托）'; },act:function(){ st.target=st.target?0:1; }}];
      P._col(-0.32,0.32,-0.3,0.32,true); return P;
    };

    /* 31.5 cm deep x 1.46 m wide x 1.9 m tall open bookshelf with a random row of books on five boards; the front faces +x, the back panel is on -x */
    Catalog.bookshelf=function(){
      const P=new Piece(), rnd=env.rnd, S=0.01213, hh=1.9, sx0=-13*S, sx1=13*S, sz0=-60*S, sz1=60*S;
      const bookMats=[0x8d6a47,0x5f6f82,0xb26b5a,0xd8d2c6,0x3f4a58,0x8a9a86,0xc9b27f,0xe7e4de].map(c=>env.lam(c,{roughness:0.8}));
      P.box(sx0,sx1,sz0,sz1,0,0.1,M.oakD);
      P.box(sx0,sx0+0.015,sz0,sz1,0.1,hh,M.oakD,{cast:false});
      [sz0,(sz0+sz1)/2-0.01,sz1-0.02].forEach(function(z){ P.box(sx0,sx1,z,z+0.02,0.1,hh,M.oakD); });
      [0.1,0.5,0.9,1.3,1.7,hh-0.02].forEach(function(y,k){
        P.box(sx0,sx1,sz0,sz1,y,y+0.02,M.oak);
        if(k<5){ let z=sz0+0.04; while(z<sz1-0.07){ const bw=0.018+rnd()*0.035, bh=0.2+rnd()*0.17; if(rnd()<0.1){ z+=0.12; continue; }
          P.box(sx0+0.02,sx0+0.02+0.2,z,z+bw,y+0.02,y+0.02+bh,bookMats[Math.floor(rnd()*bookMats.length)],{cast:false}); z+=bw+0.004; } }
      });
      P._col(sx0,sx1,sz0,sz1,false);
      return P;
    };

    /* Japanese queen bed 160 x 195 cm on short legs with duvet and two pillows. The head is on the -z side, the foot on +z. */
    Catalog.bed=function(storage){                // storage: solid base with two pull-out drawers on each side of the foot half
      const P=new Piece();
      P.rb(0,0,1.64,1.99,0.2,0.02,M.oakD,0.08,true);                          // frame
      if(!storage) P.legs(0,0,0.76,0.94,0.08,0.03,0.025,M.oakD);
      else { const lam=env.lam, inn=lam(0xf1ece2,{roughness:0.6}), lin=[0xe9e4da,0xc9d6df,0xd9c7b0,0xf3f1ea]; P.box(-0.8,0.8,-0.97,0.97,0.01,0.08,M.oakD);
        P.actions=[];
        [-1,1].forEach(function(sd){ [[-0.05,0.42],[0.45,0.92]].forEach(function(q,k){ const G=new THREE.Group(); P.group.add(G);
          const add=function(w,h,d,x,y,z,mt){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; G.add(m); return m; };
          const zc=(q[0]+q[1])/2, zl=q[1]-q[0]-0.006;
          add(0.018,0.22,zl,sd*0.811,0.165,zc,M.oakD); add(0.004,0.012,0.14,sd*0.821,0.255,zc,lam(0x3a2a1e,{roughness:0.6}));   // front with a finger groove at the top
          add(0.7,0.012,zl-0.04,sd*0.45,0.07,zc,inn); add(0.7,0.15,0.012,sd*0.45,0.14,q[0]+0.02,inn); add(0.7,0.15,0.012,sd*0.45,0.14,q[1]-0.02,inn); add(0.012,0.15,zl-0.04,sd*0.1,0.14,zc,inn);
          for(let i=0;i<3;i++) add(0.2,0.05,zl-0.1,sd*(0.25+i*0.21),0.1+((i+k)%2)*0.02,zc,lam(lin[(i+k)%4],{roughness:0.95}));   // folded spare bedding
          const st=stepper(0.6,function(t){ G.position.x=sd*0.42*ease(t); }); P.anims.push(function(t){ return st.run(t); });
          P.actions.push({x:sd*1.25,z:zc,part:[G],label:function(){ return st.target?'推回床底抽屜':'拉出床底抽屜'; },act:function(){ st.target=st.target?0:1; }}); }); }); }
      P.rb(0,0,1.6,1.95,0.2,0.08,M.bedA,0.28,false);                          // mattress
      P.rb(0,0.325,1.64,1.3,0.1,0.06,M.bedB,0.46,false);                      // duvet, draped over both sides
      P.fb(-0.82,0.325,0.025,1.3,0.22,M.bedB,0.28,false); P.fb(0.82,0.325,0.025,1.3,0.22,M.bedB,0.28,false);
      P.rb(0,-0.315,1.62,0.2,0.13,0.06,M.bedB,0.47,false);                    // folded top edge
      P.rb(-0.38,-0.695,0.6,0.38,0.15,0.07,M.pillow,0.48,false);
      P.rb(0.38,-0.695,0.6,0.38,0.15,0.07,M.pillow,0.48,false);
      return P;
    };

    /* window bench L x 42 x 42 cm under a low window: white carcass, oak top, a seat cushion; pyjama drawer, open bookshelf, skincare drawer; front +x */
    Catalog.windowBench=function(L){
      const P=new Piece(), lam=env.lam, D=0.42, H=0.42, hw=L/2, n=3, w=(L-0.04)/n, inn=lam(0xf1ece2,{roughness:0.6}), oc={cast:false};
      const zB0=-hw+0.02+w, zB1=zB0+w;   // the middle bay is open
      P.box(-D/2,D/2-0.02,-hw,hw,0,0.06,M.dark,oc); P.box(-D/2,D/2-0.02,-hw,zB0,0.06,H-0.03,M.cabF); P.box(-D/2,D/2-0.02,zB1,hw,0.06,H-0.03,M.cabF);
      P.box(-D/2,-D/2+0.02,zB0,zB1,0.06,H-0.03,M.cabF); P.box(-D/2,D/2-0.02,zB0,zB1,0.06,0.075,inn); P.box(-D/2,D/2-0.02,zB0,zB1,H-0.05,H-0.03,M.cabF);
      P.rbox(-D/2,D/2+0.01,-hw,hw,H-0.03,H,0.006,M.oak);
      P.rbox(-D/2+0.03,D/2-0.02,-hw+0.04,hw-0.04,H,H+0.07,0.03,env.fab?env.fab(0xd9cfc0):lam(0xd9cfc0,{roughness:1}));   // seat cushion
      [[-hw+0.35,0xa9b8a4],[hw-0.3,0xe8c9a8]].forEach(function(q,i){ const c=P.rbox(-D/2+0.02,-D/2+0.14,q[0]-0.2,q[0]+0.2,H+0.07,H+0.42,0.06,env.fab?env.fab(q[1]):lam(q[1])); c.rotation.x=i?0.08:-0.08; });   // back cushions against the glass
      P.actions=[];
      const openBay=function(z0,zc){   // open bookshelf: the books stand spine-out
        const bc=[0x2f4a5c,0xe9e3d6,0x8a3b2e,0x6b7d5a,0xc9a76b,0x3d3d44,0xd9c7b0,0x4f6d8a,0xa86a4a,0xe6ddd0];
        let z=z0+0.03; for(let k=0;z<z0+w-0.08;k++){ const t=0.022+((k*7)%5)*0.006, h=0.2+((k*5)%4)*0.025; P.box(-D/2+0.06,D/2-0.04,z,z+t,0.075,0.075+h,lam(bc[k%bc.length],{roughness:0.7}),oc); z+=t+0.002; }
        const lean=P.box(-D/2+0.06,D/2-0.04,z+0.01,z+0.035,0.075,0.29,lam(0x5b6e64,{roughness:0.7}),oc); lean.rotation.x=-0.28; lean.position.z+=0.03; };   // a last book leaning on the stack
      const fill=[function(add,zc){ [[0xb9c7d6,0],[0xe9e4da,1],[0xd9b8c4,2],[0xb9c7d6,3]].forEach(function(q){ add(D-0.14,0.045,w*0.38,-0.01,0.11+(q[1]>>1)*0.046,zc+((q[1]&1)?0.1:-0.1)*w,lam(q[0],{roughness:0.95})); }); },   // folded pyjamas
        null,
        function(add,zc){ add(D-0.12,0.07,w-0.12,0,0.12,zc,lam(0xd8c4a4,{roughness:0.9}));   // a tray of skincare: lotion pump, hand cream tubes, body cream jar, hair oil
          [[0.06,-0.18,0.022,0.17,0xf4efe6],[0.06,-0.1,0.02,0.15,0xe9d8c8],[-0.06,-0.16,0.03,0.08,0xf2f2ee],[-0.06,0.02,0.016,0.11,0xc98a4a]].forEach(function(q){ const m=new THREE.Mesh(new THREE.CylinderGeometry(q[2],q[2],q[3],16),lam(q[4],{roughness:0.35})); m.position.set(q[0],0.155+q[3]/2,zc+q[1]); m.castShadow=true; G0.push([m]); });
          [0.1,0.16].forEach(function(dz,k){ add(0.13,0.025,0.04,-0.02+k*0.05,0.17,zc+dz,lam(k?0xe8b4b8:0xb8d4c8,{roughness:0.4})); }); }];
      let G0=[];
      for(let i=0;i<n;i++){ const z0=-hw+0.02+i*w, zc=z0+w/2;
        if(!fill[i]){ openBay(z0,zc); continue; }
        const G=new THREE.Group(); P.group.add(G); G0=[];
        const add=function(dx,dy,dz,x,y,z,mt){ const m=new THREE.Mesh(new THREE.BoxGeometry(dx,dy,dz),mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; G.add(m); return m; };
        add(0.018,H-0.11,w-0.006,D/2-0.009,0.06+(H-0.09)/2,zc,M.cabF); add(0.006,0.014,0.2,D/2+0.003,H-0.07,zc,M.steel);
        add(D-0.08,0.012,w-0.05,0,0.08,zc,inn); [-1,1].forEach(function(sd){ add(D-0.08,0.2,0.012,0,0.18,zc+sd*(w/2-0.03),inn); }); add(0.012,0.2,w-0.05,-D/2+0.04,0.18,zc,inn);
        fill[i](add,zc); G0.forEach(function(q){ G.add(q[0]); });
        const lab=i?'保養品抽屜':'睡衣抽屜', st=stepper(0.6,function(t){ G.position.x=0.32*ease(t); }); P.anims.push(function(t){ return st.run(t); });
        P.actions.push({x:D/2+0.45,z:zc,part:[G],label:function(){ return (st.target?'推回':'拉出')+lab; },act:function(){ st.target=st.target?0:1; }}); }
      P._col(-D/2,D/2,-hw,hw,true); return P;
    };
    /* 40 x 40 cm bedside table with a lamp; the drawer seam is on the -z face. extras = a book and a cup on top. */
    Catalog.bedsideTable=function(extras,w,d,h){   // w x d x h (default 40 x 40 x 45 cm); front -z
      const P=new Piece(); w=w||0.4; d=d||0.4; h=h||0.45;
      P.rb(0,0,w,d,h,0.02,M.oak,0,true);
      P.fb(0,-d/2,w-0.06,0.01,0.12,M.oakD,h-0.15,false);                     // drawer seam
      if(h>0.5) P.fb(0,-d/2,w-0.06,0.01,0.01,M.oakD,h-0.32,false);
      P.cyl(-w/2+0.13,0,0.05,0.05,h,h+0.15,M.steel,{cast:false},10);
      P.shade(-w/2+0.13,0,0.13,0.1,h+0.13,h+0.3);
      if(extras){ P.fb(w/2-0.08,-0.1,0.12,0.16,0.03,env.fab(0x8a9a86),h,false); P.cyl(w/2-0.1,-0.08,0.035,0.03,h+0.03,h+0.11,M.ceramic,{cast:false},12); }
      return P;
    };

    /* shelf headboard (棚付きヘッドボード) 170 x 15 cm with a top tray, socket, books, clock, phone and diffuser.
       Origin = centre of the face that touches the wall; the front faces +x. */
    Catalog.shelfHeadboard=function(){
      const P=new Piece(), lam=env.lam, hw=0.85, oc={cast:false};
      P.box(0,0.15,-hw,hw,0,0.78,M.oakD);
      P.rbox(0,0.16,-hw-0.005,hw+0.005,0.78,0.8,0.006,M.oak);
      P.box(0,0.025,-hw,hw,0.8,0.95,M.oak);
      [-1,1].forEach(function(sd){ P.box(0,0.16,sd*hw-(sd>0?0.02:0),sd*hw+(sd<0?0.02:0),0.8,0.9,M.oak); });
      P.box(0.148,0.152,-hw+0.04,hw-0.04,0.5,0.505,M.oakD,oc);                // groove under the top
      P.box(0.025,0.03,-0.06,0.06,0.84,0.9,lam(0xf4f3ef,{roughness:0.4}),oc);  // 2-gang socket on the back panel
      [-1,1].forEach(function(sd){ P.box(0.03,0.032,sd*0.025-0.008,sd*0.025+0.008,0.86,0.88,M.dark,oc); });
      [0x8d6a47,0x5f6f82,0xb26b5a].forEach(function(col,i){ P.box(0.04,0.14,0.45-0.015,0.45+0.015,0.8+i*0.022,0.82+i*0.022,lam(col,{roughness:0.8}),oc); });   // stacked paperbacks
      P.rbox(0.05,0.11,-0.5,-0.43,0.8,0.86,0.01,lam(0xeae4d8,{roughness:0.4}));                                                              // alarm clock
      P.box(0.111,0.113,-0.49,-0.44,0.81,0.85,lam(0x1d1f22,{roughness:0.2}),oc);
      P.box(0.05,0.12,0.12,0.155,0.8,0.808,lam(0x1d1f22,{roughness:0.25}),oc);                                                                // phone charging
      const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.032,0.87,0.025),new THREE.Vector3(0.04,0.81,0.06),new THREE.Vector3(0.05,0.804,0.137)]),16,0.002,6,false),lam(0xf4f3ef,{roughness:0.5}));
      P.add(cable,oc);
      P.cyl(0.08,-0.22,0.03,0.035,0.8,0.88,lam(0xd9cfc0,{roughness:0.3}),{},16);                                                              // reed diffuser
      [-0.012,0,0.012].forEach(function(d,i){ const r=P.cyl(0.08+d,-0.22+d*0.6,0.0015,0.0015,0.88,1.05,M.oakD,oc,4); r.rotation.z=(i-1)*0.15; });
      return P;
    };

    /* rounded-rectangle wool rug with a sage and terracotta double stripe (rw x rd metres), 1.2 cm pile */
    Catalog.stripedRug=function(rw,rd){
      const P=new Piece(), rnd=env.rnd, lam=env.lam;
      const sh=new THREE.Shape(), r=0.12, hw=rw/2, hd=rd/2;
      sh.moveTo(-hw+r,-hd); sh.lineTo(hw-r,-hd); sh.quadraticCurveTo(hw,-hd,hw,-hd+r); sh.lineTo(hw,hd-r); sh.quadraticCurveTo(hw,hd,hw-r,hd);
      sh.lineTo(-hw+r,hd); sh.quadraticCurveTo(-hw,hd,-hw,hd-r); sh.lineTo(-hw,-hd+r); sh.quadraticCurveTo(-hw,-hd,-hw+r,-hd);
      const c=document.createElement('canvas'); c.width=c.height=1024; const g=c.getContext('2d');
      g.fillStyle='#e2d8c4'; g.fillRect(0,0,1024,1024);
      const stripe=function(ins,col,wd){ g.strokeStyle=col; g.lineWidth=wd; g.strokeRect(ins/rw*1024,ins/rd*1024,1024-2*ins/rw*1024,1024-2*ins/rd*1024); };
      stripe(0.08,'#9fb39c',16); stripe(0.14,'#c8714f',8);
      for(let i=0;i<6000;i++){ g.fillStyle='rgba('+(rnd()<0.5?'255,255,255':'80,60,40')+','+(0.03+rnd()*0.05)+')'; g.fillRect(rnd()*1024,rnd()*1024,2+rnd()*3,2+rnd()*3); }
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy; t.repeat.set(1/rw,1/rd); t.offset.set(0.5,0.5);
      const rug=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:0.012,bevelEnabled:false,curveSegments:6}),[new THREE.MeshStandardMaterial({map:t,roughness:1}),lam(0xcdbfa6,{roughness:1})]);
      rug.rotation.x=-Math.PI/2; rug.position.set(0,0.001,0); rug.receiveShadow=true; P.add(rug,{cast:false});
      return P;
    };

    /* upright suitcase on four spinner wheels (W wide, H tall incl. wheels, D deep); hard shell with ribs or soft fabric with a front pocket.
       Origin = centre of the back face on the floor; the big face looks toward -x. */
    Catalog.suitcase=function(W,H,D,col,ribCol,soft){
      const P=new Piece(), lam=env.lam, fab=env.fab;
      const x1=0, x0=-D, z0=-W/2, z1=W/2, y0=0.055, xm=(x0+x1)/2, oc={cast:false};
      const body=soft?fab(col):lam(col,{roughness:0.3,envMapIntensity:0.8}), dk=lam(0x1c1d20,{roughness:0.55}), steelL=lam(0xb9bec4,{metalness:0.8,roughness:0.3});
      P.rbox(x0,x1,z0,z1,y0,H,soft?0.05:0.045,body);
      P.box(xm-0.002,xm+0.002,z0+0.03,z1-0.03,H,H+0.0015,dk,oc);                                       // seam / zipper line over the top
      [z0,z1].forEach(function(z,i){ P.box(xm-0.002,xm+0.002,i?z:z-0.0015,i?z+0.0015:z,y0+0.04,H-0.04,dk,oc); });   // ...and down both sides
      if(!soft){
        const rib=lam(ribCol,{roughness:0.35}), n=7;
        for(let i=1;i<=n;i++){ const zr=z0+W*i/(n+1); P.box(x0-0.004,x0+0.001,zr-0.009,zr+0.009,y0+0.07,H-0.07,rib,oc); }   // vertical ribs on the shell
        P.rbox(x1-0.075,x1-0.005,-0.05,0.05,H,H+0.006,0.003,dk,oc);                                    // telescopic-handle housing
      } else {
        P.rbox(x0-0.014,x0,z0+W*0.1,z1-W*0.1,y0+0.08,y0+(H-y0)*0.5,0.02,fab(0x2f3237));                  // front pocket
        P.box(x0-0.014,x0-0.012,z0+W*0.12,z1-W*0.12,y0+(H-y0)*0.5-0.014,y0+(H-y0)*0.5-0.01,steelL,oc);   // pocket zipper
        P.rbox(x0-0.003,x0,z1-0.11,z1-0.05,H-0.07,H-0.045,0.004,steelL,oc);                              // small badge
        P.rbox(x1-0.075,x1-0.005,-0.05,0.05,H,H+0.006,0.003,dk,oc);
      }
      P.rbox(xm-0.035,xm+0.035,-0.1,0.1,H,H+0.012,0.004,dk,oc);                                         // top handle: base plate, grip, two posts
      P.rbox(xm-0.012,xm+0.012,-0.085,0.085,H+0.027,H+0.042,0.006,dk,oc);
      [-1,1].forEach(function(sd){ P.box(xm-0.01,xm+0.01,sd*0.08-0.01,sd*0.08+0.01,H+0.012,H+0.032,dk,oc); });
      [[x0+0.07,z0+0.075],[x0+0.07,z1-0.075],[x1-0.07,z0+0.075],[x1-0.07,z1-0.075]].forEach(function(q){   // spinner wheels
        P.box(q[0]-0.022,q[0]+0.022,q[1]-0.02,q[1]+0.02,0.032,y0+0.004,dk,oc);
        const w=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.018,14),dk); w.rotation.x=Math.PI/2; w.position.set(q[0],0.02,q[1]); P.add(w,oc);
      });
      P._col(x0,x1,z0,z1,true);
      return P;
    };

    /* ---------- shoes: side-profile extrusions (sneaker, ankle boot, loafer, pump, sandal), 9.2 cm wide, 27 cm long, toe toward local +x ---------- */
    const shoeGeoC={}, shoeMatC={}, SW=0.092, lam=env.lam;
    function shoeMat(c){ return shoeMatC[c]||(shoeMatC[c]=lam(c,c<0x303030?{roughness:0.22,metalness:0.1,envMapIntensity:1.3}:{roughness:0.55})); }   // dark colours read as polished leather
    function shoeGeo(name,build){ return shoeGeoC[name]||(shoeGeoC[name]=build()); }
    function fabMat(c){ return shoeMatC['f'+c]||(shoeMatC['f'+c]=env.fab?env.fab(c):lam(c,{roughness:0.95})); }
    function shoeExtr(shape,depth,bev){
      const g=new THREE.ExtrudeGeometry(shape,{depth:depth-2*bev,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:2,curveSegments:8});
      g.translate(0,0,-(depth-2*bev)/2);
      const pos=g.attributes.position;                                       // plan view: heel rounded, ball widest, toe narrowing to a round tip
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i), t=x<-0.1?0.8+(x+0.14)/0.04*0.15:x<0.03?0.95+(x+0.1)/0.13*0.05:1-Math.pow(Math.max(0,(x-0.03)/0.12),1.8)*0.5;
        pos.setZ(i,pos.getZ(i)*Math.max(0.45,t));
      }
      g.computeVertexNormals(); return g;
    }
    function shoeSole(h,heelH){                    // outline of a flat/low-heel sole, h thick
      const s=new THREE.Shape(); s.moveTo(-0.132,0); s.lineTo(0.125,0); s.quadraticCurveTo(0.148,0,0.148,h*0.7); s.lineTo(0.148,h); s.quadraticCurveTo(0.14,h+0.004,0.12,h+0.004);
      s.lineTo(-0.115,h+heelH); s.quadraticCurveTo(-0.138,h+heelH,-0.138,h+heelH-0.01); s.lineTo(-0.138,0.008); s.quadraticCurveTo(-0.138,0,-0.132,0); return s;
    }
    /* a shoe last lofted along x (heel at -0.137, toe at +0.148): rounded plan, wide at the ball, toe spring; prof(u) -> [bottom, top], col(u,side,up) -> hex for vertex colours */
    const lin=function(keys){ return function(u){ if(u<=keys[0][0]) return keys[0][1]; for(let i=1;i<keys.length;i++){ if(u<=keys[i][0]){ const a=keys[i-1], b=keys[i], f=(u-a[0])/(b[0]-a[0]), s=f*f*(3-2*f); return a[1]+(b[1]-a[1])*s; } } return keys[keys.length-1][1]; }; };
    const sm2=function(a,b,x){ const f=Math.min(1,Math.max(0,(x-a)/(b-a))); return f*f*(3-2*f); };
    const spring=function(u){ return 0.013*Math.pow(sm2(0.74,1,u),2); };   // toe lifted about 1.3 cm
    function shoeLast(prof,wk,col,nu,na){
      nu=nu||30; na=na||20; const pos=[], cl=[], idx=[], c=new THREE.Color();
      for(let i=0;i<=nu;i++){ const u=i/nu, x=-0.137+u*0.285, e=Math.sqrt(Math.min(1,u/0.06))*Math.sqrt(Math.min(1,(1-u)/0.12)), pr=prof(u);
        const wp=SW/2*wk*(0.76+0.24*sm2(0.22,0.66,u))*(1-0.32*Math.pow(sm2(0.78,1,u),1.4))*e, yc=(pr[0]+pr[1])/2, hh=(pr[1]-pr[0])/2*(0.35+0.65*e);
        for(let j=0;j<na;j++){ const a=2*Math.PI*j/na, ca=Math.cos(a), sa=Math.sin(a), z=wp*Math.sign(ca)*Math.pow(Math.abs(ca),0.55), y=yc+hh*Math.sign(sa)*Math.pow(Math.abs(sa),0.75);
          pos.push(x,y,z); c.setHex(col?col(u,ca,sa):0xffffff); cl.push(c.r,c.g,c.b); } }
      for(let i=0;i<nu;i++) for(let j=0;j<na;j++){ const a=i*na+j, b=i*na+(j+1)%na, cc=a+na, d=b+na; idx.push(a,cc,b,b,cc,d); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(cl,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
    const vcMat={}; function vcm(gloss){ return vcMat[gloss]||(vcMat[gloss]=lam(0xffffff,gloss?{vertexColors:true,roughness:0.22,envMapIntensity:1.3}:{vertexColors:true,roughness:0.62})); }
    function shoeObj(kind,c1,c2){
      const G=new THREE.Group();
      const add=function(g,m,x,y,z,cast){ const me=new THREE.Mesh(g,m); me.position.set(x||0,y||0,z||0); me.castShadow=cast!==false; me.receiveShadow=true; G.add(me); return me; };
      const bx=function(w,h,d){ return shoeGeo('b'+w+'_'+h+'_'+d,function(){ return new THREE.BoxGeometry(w,h,d); }); };
      const LIN=0x2a2624, key=kind+'_'+c1+'_'+(c2||0);
      const opening=function(u0,u1,wz){ return function(u,ca,sa){ const m=(u-(u0+u1)/2)/((u1-u0)/2); return sa>0.35&&m*m+Math.pow(ca/wz,2)<1; }; };
      if(kind==='sneaker'){
        const top=lin([[0,0.082],[0.12,0.086],[0.22,0.074],[0.36,0.094],[0.46,0.096],[0.62,0.076],[0.82,0.058],[0.96,0.045],[1,0.04]]), hole=opening(0.1,0.34,0.62);
        add(shoeGeo('snS',function(){ return shoeLast(function(u){ const b=spring(u); return [b,b+0.03]; },1.07,function(u,ca,sa){ return sa<-0.55?0x8d8a84:0xffffff; },30,20); }),new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.7,color:c2||0xf3f1ec}));   // white midsole bulging a little past the upper, a grey outsole
        add(shoeGeo('snU'+key,function(){ return shoeLast(function(u){ const b=spring(u)+0.022; return [b,b+top(u)-0.03]; },1.0,function(u,ca,sa){ if(hole(u,ca,sa)) return LIN; if(u<0.14&&sa<0.6) return c2||0xf1efe9; if(Math.abs(sa)<0.35&&u>0.38&&u<0.72&&Math.abs(ca)>0.6) return c2||0xf1efe9; return c1; },34,22); }),vcm(false));   // heel counter and a side panel in the trim colour
        for(let k=0;k<4;k++){ const u=0.42+k*0.06, x=-0.137+u*0.285, y=spring(u)+0.022+lin([[0.4,0.07],[0.62,0.052]])(u); [-1,1].forEach(function(sd){ const l=add(bx(0.006,0.004,SW*0.42),shoeMat(0xf6f4ef),x,y,0,false); l.rotation.y=sd*0.45; }); }   // crossed laces
        const tg=add(shoeGeo('snT',function(){ const g=new THREE.SphereGeometry(1,14,8); g.scale(0.03,0.006,SW*0.2); return g; }),shoeMat(c1),-0.04,0.088,0,false); tg.rotation.z=0.35;   // padded tongue rising out of the opening
      } else if(kind==='boot'||kind==='tallboot'){
        const tall=kind==='tallboot', H2=tall?0.4:0.165, hole=opening(0.02,0.3,0.85);
        add(shoeGeo('btS',function(){ return shoeLast(function(u){ const b=spring(u)*0.6; return [b,b+0.014]; },1.04,null,24,16); }),shoeMat(0x1d1d1f));
        add(shoeGeo('btH',function(){ const g=new THREE.CylinderGeometry(0.022,0.024,0.032,14); g.scale(1,1,1.25); return g; }),shoeMat(0x1d1d1f),-0.11,0.016,0);   // stacked heel
        add(shoeGeo('btU'+key,function(){ return shoeLast(function(u){ const b=0.014+spring(u)*0.6; return [b,b+lin([[0,0.06],[0.35,0.06],[0.55,0.05],[0.85,0.04],[1,0.03]])(u)]; },1.0,function(u,ca,sa){ return hole(u,ca,sa)?LIN:c1; },30,20); }),vcm(true));
        add(shoeGeo('btSh'+key,function(){ const g=new THREE.CylinderGeometry(0.047,0.042,H2-0.06,22,tall?8:2,true); const pa=g.attributes.position; for(let i=0;i<pa.count;i++){ const y=pa.getY(i)+(H2-0.06)/2, w=tall?1+0.05*Math.sin(y*28):1; pa.setX(i,pa.getX(i)*w*1.12); pa.setZ(i,pa.getZ(i)*w*0.92); if(tall) pa.setX(i,pa.getX(i)+0.012*Math.sin(y*9)); } g.computeVertexNormals(); return g; }),lam(c1,{roughness:0.3,envMapIntensity:1.2,side:THREE.DoubleSide}),-0.075,0.06+(H2-0.06)/2,0);   // the shaft, a gentle slouch on the tall pair
        const rim=add(shoeGeo('btR'+H2,function(){ const g=new THREE.CircleGeometry(0.044,22); g.rotateX(-Math.PI/2); g.scale(1.12,1,0.92); return g; }),shoeMat(LIN),-0.075+(tall?0.012*Math.sin(H2*9):0),H2-0.012,0,false);
        add(bx(0.003,H2-0.08,0.003),lam(0xb8b4ac,{metalness:0.7,roughness:0.35}),-0.075,(H2+0.06)/2,-0.044,false);   // inner zip
      } else if(kind==='loafer'||kind==='pump'){
        const pump=kind==='pump', HH=pump?0.05:0.016, lift=function(u){ return HH*(1-sm2(0.22,0.6,u))+spring(u)*0.7; }, hole=opening(0.02,0.62,0.86);
        add(shoeGeo((pump?'pS':'lS'),function(){ return shoeLast(function(u){ const b=lift(u); return [b,b+0.009]; },1.03,null,30,16); }),shoeMat(pump?0x1d1d1f:0x2a2220));
        add(shoeGeo((pump?'pU':'lU')+key,function(){ return shoeLast(function(u){ const b=lift(u)+0.007; return [b,b+(pump?lin([[0,0.04],[0.5,0.03],[0.75,0.04],[1,0.03]])(u):lin([[0,0.05],[0.5,0.045],[0.7,0.056],[1,0.034]])(u))]; },1.0,function(u,ca,sa){ return hole(u,ca,sa)?LIN:c1; },34,22); }),vcm(true));
        if(pump) add(shoeGeo('pH',function(){ return new THREE.CylinderGeometry(0.009,0.013,HH,12); }),shoeMat(c2||0x1d1e21),-0.118,HH/2,0);   // tapered heel
        else add(bx(0.03,0.006,SW*0.82),shoeMat(c2||0x8a6a4a),0.055,0.066,0,false).rotation.z=-0.2;   // saddle strap across the vamp
      } else if(kind==='slipper'){
        add(shoeGeo('slipS',function(){ return shoeExtr(shoeSole(0.022,0),SW+0.008,0.008); }),shoeMat(c2||0xe8e2d6));
        const v=add(shoeGeo('slipV',function(){ const g=new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2); g.scale(0.085,0.05,SW/2+0.006); return g; }),fabMat(c1),0.06,0.02,0);   // soft toe cover, open heel
      } else {                                                   // sandal: a footbed, two wide straps over the forefoot and one round the heel
        add(shoeGeo('sandalS',function(){ return shoeLast(function(u){ const b=spring(u)*0.5; return [b,b+0.024]; },1.06,function(u,ca,sa){ return sa>0.6?0xe2d2b6:0xffffff; },28,18); }),new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.75,color:c2||0xcdb89a}));
        const strap=shoeGeo('sandalT',function(){ const g=new THREE.CylinderGeometry(SW/2+0.004,SW/2+0.004,0.024,16,1,true,0,Math.PI); g.rotateZ(Math.PI/2); g.rotateX(Math.PI/2); g.scale(1,0.62,1); return g; }), sm_=lam(c1,{roughness:0.45,side:THREE.DoubleSide});
        [[0.06,0.2],[0.0,-0.2],[-0.1,0]].forEach(function(q,k){ const s_=add(strap,sm_,q[0],0.024,0,false); s_.rotation.y=q[1]; if(k===2) s_.scale.set(1,0.75,0.9); });
      }
      return G;
    }

    /* Tesla Model 3 (4.72 x 1.85 x 1.44 m, wheelbase 2.875 m, track 1.58 m), right-hand drive, Midnight Silver with clear coat; nose toward +z.
       The body is one lofted surface (plan outline, side profile and tumblehome per station) with the wheel arches cut into its sections. */
    const smooth=function(keys){                  // Catmull-Rom through [z,v] keys, clamped at the ends
      return function(z){ const n=keys.length; if(z<=keys[0][0]) return keys[0][1]; if(z>=keys[n-1][0]) return keys[n-1][1];
        let i=0; while(z>keys[i+1][0]) i++; const p0=keys[Math.max(i-1,0)][1], p1=keys[i][1], p2=keys[i+1][1], p3=keys[Math.min(i+2,n-1)][1], t=(z-keys[i][0])/(keys[i+1][0]-keys[i][0]);
        return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t); }; };
    const loft=function(stations,section,dark){   // stations: z list; section(z) -> [[x,y,isDark],...] for the right half from bottom centre to top centre
      const pos=[], col=[], idx=[]; let ring=0;
      stations.forEach(function(z){ const half=section(z), full=half.concat(half.slice(1,-1).reverse().map(function(p){ return [-p[0],p[1],p[2]]; }));
        ring=full.length; full.forEach(function(p){ pos.push(p[0],p[1],z); const c=p[2]?dark:1; col.push(c,c,c); }); });
      for(let s=0;s<stations.length-1;s++) for(let i=0;i<ring;i++){ const a=s*ring+i, b=s*ring+(i+1)%ring, c=a+ring, d=b+ring; idx.push(a,b,c,b,d,c); }
      [0,stations.length-1].forEach(function(s,k){ let cx=0,cy=0; for(let i=0;i<ring;i++){ cx+=pos[(s*ring+i)*3]; cy+=pos[(s*ring+i)*3+1]; }
        const ci=pos.length/3; pos.push(cx/ring,cy/ring,stations[s]+(k?0.01:-0.01)); col.push(1,1,1);
        for(let i=0;i<ring;i++){ pos.push(pos[(s*ring+i)*3],pos[(s*ring+i)*3+1],pos[(s*ring+i)*3+2]); col.push(col[(s*ring+i)*3],col[(s*ring+i)*3],col[(s*ring+i)*3]); }
        for(let i=0;i<ring;i++){ const a=ci+1+i, b=ci+1+(i+1)%ring; if(k) idx.push(ci,b,a); else idx.push(ci,a,b); } });
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    const plateTex=function(top,bottom){
      const c=document.createElement('canvas'); c.width=330; c.height=165; const g=c.getContext('2d');
      g.fillStyle='#f6f6f2'; g.fillRect(0,0,330,165); g.strokeStyle='#2f6b45'; g.lineWidth=6; g.strokeRect(5,5,320,155);
      g.fillStyle='#2f6b45'; g.textAlign='center'; g.font='bold 34px sans-serif'; g.fillText(top,165,48);
      g.font='bold 30px sans-serif'; g.fillText(bottom[0],38,128); g.font='bold 86px sans-serif'; g.fillText(bottom[1],190,140);
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy||4; return t;
    };
    Catalog.car=function(){
      const P=new Piece(), lam=env.lam, L=4.72, ZF=2.36, ZR=-2.36, AF=1.44, AR=-1.435, TR=0.79, WR=0.34;
      const paint=new THREE.MeshPhysicalMaterial({color:0x4b5058,metalness:0.45,roughness:0.3,clearcoat:1,clearcoatRoughness:0.04,envMapIntensity:1.0,vertexColors:true,side:THREE.DoubleSide});
      const glass=new THREE.MeshPhysicalMaterial({color:0x080a0d,metalness:0.3,roughness:0.02,envMapIntensity:1.6,transparent:true,opacity:0.93,clearcoat:1}), paintS=paint.clone(); paintS.vertexColors=false;
      const piano=lam(0x0b0c0e,{roughness:0.15,metalness:0.3,envMapIntensity:1.2}), satin=lam(0x16181b,{roughness:0.55}), chrome=lam(0xd7dade,{metalness:1,roughness:0.12,envMapIntensity:1.4});
      const hw=smooth([[ZR,0.6],[-2.355,0.76],[-2.33,0.82],[-2.3,0.84],[-2.2,0.895],[-1.95,0.922],[-1.4,0.925],[1.5,0.925],[1.85,0.912],[2.08,0.875],[2.24,0.80],[2.32,0.70],[2.35,0.6],[ZF,0.42]]);
      const yt=smooth([[ZR,0.86],[-2.345,0.9],[-2.27,0.965],[-2.12,0.99],[-1.9,0.985],[-1.5,0.955],[0.4,0.94],[1.02,0.925],[1.45,0.85],[1.85,0.76],[2.12,0.69],[2.27,0.61],[ZF,0.5]]);
      const yb=smooth([[ZR,0.4],[-2.345,0.3],[-2.28,0.25],[-2.1,0.19],[-1.6,0.16],[1.75,0.16],[2.15,0.2],[2.3,0.26],[ZF,0.36]]);
      const arch=function(z){ let y=0; [AF,AR].forEach(function(a){ const d=Math.abs(z-a); if(d<0.43) y=Math.max(y,0.32+Math.sqrt(0.43*0.43-d*d)); }); return y; };
      const section=function(z){
        const w=hw(z), t=yt(z), b=yb(z), ya=arch(z), lo=Math.max(b+0.04,ya), cl=function(y){ return Math.min(Math.max(y,lo),t-0.02); };
        const rnd=Math.min(0.12,(t-b)*0.35);
        return [[0,b,1],[w-rnd,b,1],[w-rnd*0.3,b+rnd*0.3,1],[w-0.016,Math.max(lo-0.004,b+rnd*0.6),1],[w-0.012,Math.max(lo,b+rnd*0.65),0],[w-0.004,cl(0.42),0],[w,cl(0.6),0],[w-0.018,cl(0.76),0],[w-0.06,cl(t-0.07),0],[w-0.13,t-0.012,0],[w*0.55,t+0.022,0],[0,t+0.03,0]];
      };
      const st=[]; for(let i=0;i<=120;i++){ const u=i/120, s=0.5-0.5*Math.cos(Math.PI*u); st.push(ZR+(ZF-ZR)*(0.15*u+0.85*s)); }
      const GR=-1.72, TZ=-2.36, TY=0.82, stF=st.filter(function(z){ return z>=GR; }), stR=st.filter(function(z){ return z<=GR; }).concat([GR]);   // the body splits at the trunk lid hinge, so the lid area can be cut away on its own
      stF.unshift(GR); const FS=1.05, stM=stF.filter(function(z){ return z<FS; }).concat([FS]), stN=[FS].concat(stF.filter(function(z){ return z>FS; }));   // and again at the hood hinge for the frunk
      const body=new THREE.Mesh(loft(stM,section,0.03),paint); P.add(body);
      const paintF=paint.clone(), bodyF=new THREE.Mesh(loft(stN,section,0.03),paintF); P.add(bodyF);
      const paintR=paint.clone(), bodyR=new THREE.Mesh(loft(stR,section,0.03),paintR); P.add(bodyR);
      const sideX=function(z,y){ const s=section(z).slice(4,9); for(let i=0;i<s.length-1;i++) if(y>=s[i][1]&&y<=s[i+1][1]){ const k=(y-s[i][1])/Math.max(s[i+1][1]-s[i][1],1e-4); return s[i][0]+(s[i+1][0]-s[i][0])*k; } return s[4][0]; };
      const endZ=function(x,front){ let lo=front?1.6:ZR, hi=front?ZF:-1.6; for(let i=0;i<30;i++){ const m=(lo+hi)/2; if((hw(m)>x)===front) lo=m; else hi=m; } return (lo+hi)/2; };   // where the plan outline reaches half-width x
      const gridGeo=function(rows,flip){ const n=rows[0].length, pos=[], idx=[];   // surface through rows of points
        rows.forEach(function(r,i){ r.forEach(function(q){ pos.push(q[0],q[1],q[2]); }); if(i) for(let j=0;j<n-1;j++){ const a=(i-1)*n+j, b=i*n+j; [[a,b,a+1],[b,b+1,a+1]].forEach(function(t){ idx.push.apply(idx,flip?[t[0],t[2],t[1]]:t); }); } });
        const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
      const taper=function(pts,r,f,flat,mat){ const cv=new THREE.CatmullRomCurve3(pts.map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); })), N=40, R=14, g=new THREE.TubeGeometry(cv,N,r,R,false), pa=g.attributes.position, c=new THREE.Vector3(), v=new THREE.Vector3();   // tube whose thickness follows f(0..1), flattened vertically
        for(let i=0;i<=N;i++){ cv.getPointAt(i/N,c); const k=Math.max(0.001,f(i/N)); for(let j=0;j<=R;j++){ const n=i*(R+1)+j; v.fromBufferAttribute(pa,n).sub(c).multiplyScalar(k); v.y*=flat; v.add(c); pa.setXYZ(n,v.x,v.y,v.z); } }
        g.computeVertexNormals(); const m=new THREE.Mesh(g,mat); P.add(m,{cast:false}); return m; };
      const drl=lam(0xffffff,{emissive:0xeef4ff,emissiveIntensity:1.6}), tail=lam(0xff3a2a,{emissive:0xff2010,emissiveIntensity:2.0});
      /* glass greenhouse (glass roof, as on the real car), black B-pillars and window trim */
      const GF=1.03;
      const yg=smooth([[GR,0.0],[-1.5,0.13],[-1.15,0.3],[-0.7,0.46],[-0.1,0.5],[0.25,0.49],[0.6,0.36],[0.85,0.17],[GF,0.0]]);
      const gst=[]; for(let i=0;i<=60;i++) gst.push(GR+(GF-GR)*i/60);
      const gsec=function(z){ const base=yt(z)-0.07, h=Math.max(yg(z),0.0015)+0.06, hb=hw(z)-0.06, hr=Math.min(0.6,hb-0.04);
        return [[0,base,0],[hb,base,0],[hb-0.07,base+h*0.45,0],[hr,base+h*0.93,0],[hr*0.5,base+h,0],[0,base+h+0.004,0]]; };
      const gTop=function(z){ const s=gsec(z), hr=s[3][0], y3=s[3][1], yt=s[5][1], out=[[0,y3,0]]; for(let k=0;k<=8;k++){ const x=hr*(1-k/8); out.push([x,y3+(yt-y3)*(1-Math.pow(x/hr,2)),0]); } return out; };   // one smooth arc across, so the roof glass reflects evenly instead of in two bright bands   // roof and windscreen glass; the side windows are separate strips so the door openings can drop them
      const glassR=glass.clone(); glassR.envMapIntensity=0.25; glassR.metalness=0; glassR.specularIntensity=0.35; glassR.clearcoat=0; glassR.clearcoatRoughness=0.3; glassR.roughness=0.12; glassR.opacity=0.97; const gh=new THREE.Mesh(loft(gst,gTop,1),glassR);   // calmer reflections on the curved roof glass: no pale bands where it rolls toward the sides
      gh.renderOrder=2; P.add(gh,{cast:false}); const ghIn=new THREE.Mesh(gh.geometry,new THREE.MeshStandardMaterial({color:0x07080a,roughness:0.6,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:3,polygonOffsetUnits:3})); P.add(ghIn,{cast:false});   // black headliner behind the tinted glass, so the body never shows through as pale bands
      const glassS=glass.clone(), sideGl=[]; glassS.color.setHex(0x0a0d10); glassS.opacity=0.94; glassS.side=THREE.DoubleSide;
      [-1,1].forEach(function(sx){ const pos=[], idx=[], ridx=[]; gst.forEach(function(z,i){ const s=gsec(z); [1,2,3].forEach(function(k){ pos.push(sx*s[k][0],s[k][1],z); }); if(i){ const a=(i-1)*3, b=i*3; [[a,b,a+1],[b,b+1,a+1]].forEach(function(t){ idx.push.apply(idx,sx>0?t:[t[0],t[2],t[1]]); }); [[a+1,b+1,a+2],[b+1,b+2,a+2]].forEach(function(t){ ridx.push.apply(ridx,sx>0?t:[t[0],t[2],t[1]]); }); } });
        const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
        const m=new THREE.Mesh(g,glassS); m.renderOrder=2; P.add(m,{cast:false}); sideGl.push(m);
        const rg=new THREE.BufferGeometry(); rg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); rg.setIndex(ridx); rg.computeVertexNormals(); P.add(new THREE.Mesh(rg,piano),{cast:false}); });   // the upper band rolling onto the roof is the black roof rail, not glass
      const gX=function(z,f){ const s=gsec(z), y=s[0][1]+(s[3][1]-s[0][1])*f; return [s[1][0]+(s[3][0]-s[1][0])*f, y]; };
      const strip=function(pts,r,mat){ const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); })),Math.max(pts.length*3,8),r,6,false),mat); P.add(m,{cast:false}); return m; };
      [-1,1].forEach(function(sx){
        const bp=[]; for(let f=0;f<=0.9;f+=0.1){ bp.push([-0.18,-0.06].map(function(z){ const q=gX(z,f); return [sx*(q[0]+0.004),q[1],z]; })); }
        P.add(new THREE.Mesh(gridGeo(bp,sx<0),piano),{cast:false});                                                                       // gloss-black B-pillar panel
        const qp=[]; for(let f=0;f<=0.85;f+=0.085){ qp.push([-0.985,-0.955].map(function(z){ const q=gX(z,f); return [sx*(q[0]+0.004),q[1],z]; })); }
        P.add(new THREE.Mesh(gridGeo(qp,sx<0),piano),{cast:false});                                                                       // post between the rear door glass and the quarter window
        const fg=[0.74,0.62,0.5].map(function(x){ return [sx*x,0.4,endZ(x,true)-0.005]; });
        taper(fg,0.009,function(u){ return Math.pow(Math.sin(Math.PI*u),0.25); },0.7,drl);                                               // slim LED fog light low on each corner
        const head=[]; for(let z=GR+0.04;z<=GF-0.02;z+=0.06){ const u=Math.min(1,Math.max(0,(z-0.2)/0.4)), q=gX(z,0.96-0.92*u*u*(3-2*u)); head.push([sx*(q[0]+0.006),q[1],z]); } strip(head,0.008,satin);   // window surround along the roof edge, sweeping out to the A-pillar's outer corner along the windscreen
        const sill=[]; for(let z=GR+0.12;z<=GF-0.05;z+=0.1) sill.push([sx*(hw(z)-0.058),yt(z)-0.066,z]); strip(sill,0.012,satin);                      // belt trim
        /* door shut lines and flush handles */
        [1.0,-0.12,-1.02].forEach(function(z){ const pts=[]; for(let y=Math.max(arch(z)+0.03,yb(z)+0.08);y<=yt(z)-0.02;y+=0.05) pts.push([sx*(sideX(z,y)+0.0015),y,z]); if(pts.length>2) strip(pts,0.0035,satin); });
        [0.38,-0.62].forEach(function(z){ P.box(sx*(sideX(z,0.86)-0.004)-0.006,sx*(sideX(z,0.86)-0.004)+0.006,z-0.085,z+0.085,0.843,0.873,chrome,{cast:false}); });
        /* door mirror on a black base */
        const mb=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.12),satin); mb.position.set(sx*(hw(0.92)-0.06),yt(0.92)+0.03,0.92); P.add(mb);
        const mh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),paintS); mh.scale.set(0.085,0.062,0.115); mh.position.set(sx*(hw(0.9)+0.04),yt(0.9)+0.08,0.88); P.add(mh);
        const mg=new THREE.Mesh(new THREE.CircleGeometry(1,20),lam(0x9aa4ad,{metalness:1,roughness:0.05})); mg.scale.set(0.07,0.05,1); mg.rotation.y=Math.PI; mg.position.set(sx*(hw(0.9)+0.04),yt(0.9)+0.08,0.775); P.add(mg,{cast:false});
        /* headlight: smoked lens sweeping round the corner, LED brow inside */
        const hl=[0.88,0.72,0.52].map(function(x){ const z=endZ(x,true)-0.02; return [sx*x,yt(z)-0.035,z]; });   // almond-shaped lamp: round outer end, widest a third of the way in, tapering to a point
        const alm=function(u){ return Math.pow(Math.sin(Math.PI*u),0.45)*(1-0.6*u); };
        taper(hl,0.08,alm,0.6,new THREE.MeshPhysicalMaterial({color:0x1a2026,metalness:0.2,roughness:0.02,transparent:true,opacity:0.55,clearcoat:1,envMapIntensity:2,depthWrite:false})).renderOrder=2;   // smoked lens
        taper(hl.map(function(q){ return [q[0]*0.995,q[1]-0.004,q[2]-0.01]; }),0.06,alm,0.58,chrome);                                                     // chrome reflector
        taper(hl.map(function(q){ return [q[0]*1.004,q[1]+0.022,q[2]+0.03]; }),0.006,function(u){ return u<0.06||u>0.8?0:1; },1,drl);                        // LED line along the top edge
        [0.22,0.42].forEach(function(u){ const q=new THREE.CatmullRomCurve3(hl.map(function(a){ return new THREE.Vector3(a[0],a[1],a[2]); })).getPointAt(u), pr=new THREE.Mesh(new THREE.SphereGeometry(0.018,14,10),lam(0xe8ecf0,{metalness:0.9,roughness:0.08,emissive:0x9aa6b4,emissiveIntensity:0.5})); pr.position.set(q.x,q.y-0.008,q.z+0.04); P.add(pr,{cast:false}); });   // projectors
        /* tail light wrapping from the boot lid onto the quarter */
        const tl=[]; for(let z=-1.98;z>=-2.2;z-=0.04){ tl.push([sx*(sideX(z,0.86)+0.002),0.885,z]); } for(let x=sideX(-2.24,0.86)-0.01;x>=0.46;x-=0.04) tl.push([sx*x,0.89,endZ(x,false)+0.008]);
        strip(tl,0.03,lam(0x6a0a0a,{emissive:0x5a0404,roughness:0.06,metalness:0.2}));
        strip(tl.map(function(q){ return [q[0]*1.006,q[1]+0.012,q[2]-0.006]; }),0.006,tail);
        /* front fender camera, tyre and twin-spoke 19" wheel */
        P.box(sx*sideX(1.25,0.7)-0.008,sx*sideX(1.25,0.7)+0.008,1.22,1.28,0.69,0.72,piano,{cast:false});
        [AF,AR].forEach(function(az){
          const W=new THREE.Group(); W.position.set(sx*TR,WR,az); P.group.add(W);
          const prof=[[0.24,-0.112],[0.29,-0.118],[0.322,-0.112],[0.338,-0.09],[0.342,-0.04],[0.343,0],[0.342,0.04],[0.338,0.09],[0.322,0.112],[0.29,0.118],[0.24,0.112]];
          const tg=new THREE.LatheGeometry(prof.map(function(q){ return new THREE.Vector2(q[0],q[1]); }),40); const ty=new THREE.Mesh(tg,lam(0x16171a,{roughness:0.92})); ty.rotation.z=Math.PI/2; ty.castShadow=true; W.add(ty);
          const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.242,0.242,0.2,32,1,true),lam(0x2a2c30,{metalness:0.8,roughness:0.4})); barrel.rotation.z=Math.PI/2; W.add(barrel);
          const face=new THREE.Mesh(new THREE.CylinderGeometry(0.242,0.242,0.012,40),lam(0x24272b,{metalness:0.6,roughness:0.45})); face.rotation.z=Math.PI/2; face.position.x=sx*0.085; W.add(face);
          const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.02,28),lam(0x5d6066,{metalness:0.9,roughness:0.5})); disc.rotation.z=Math.PI/2; disc.position.x=sx*0.02; W.add(disc);
          const cal=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.1,0.14),lam(0x2a2c30,{roughness:0.5})); cal.position.set(sx*0.05,0.11,-sx*0.0); W.add(cal);
          for(let k=0;k<10;k++){ const a=k*Math.PI/5+(k%2?0.13:0), sp=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.2,0.026),lam(0xc4c8ce,{metalness:0.95,roughness:0.2,envMapIntensity:1.3}));
            sp.position.set(sx*0.098,Math.cos(a)*0.13,Math.sin(a)*0.13); sp.rotation.x=a; W.add(sp); }
          const lip=new THREE.Mesh(new THREE.TorusGeometry(0.236,0.009,8,48),lam(0xc4c8ce,{metalness:0.95,roughness:0.2})); lip.rotation.y=Math.PI/2; lip.position.x=sx*0.098; W.add(lip);
          const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.02,20),satin); cap.rotation.z=Math.PI/2; cap.position.x=sx*0.104; W.add(cap);
        });
      });
      /* front: no grille, a slim lower intake, T badge; rear: badge, lettering and diffuser */
      const fy=0.33; P.box(-0.42,0.42,ZF-0.03,ZF-0.005,fy-0.02,fy+0.06,piano,{cast:false});
      const badge=function(z,y,s){ P.box(-0.035*s,0.035*s,z-0.004,z+0.004,y+0.012*s,y+0.022*s,chrome,{cast:false}); P.box(-0.007*s,0.007*s,z-0.004,z+0.004,y-0.03*s,y+0.012*s,chrome,{cast:false}); };
      const tLogo=function(w){   // Tesla emblem: an arched bar over a T whose head has a V notch at the top and claw tips, on a stem tapering to a point
        const bar=new THREE.Shape(); bar.moveTo(-0.493,0.868); bar.quadraticCurveTo(0,1.035,0.5,0.862); bar.lineTo(0.493,0.826); bar.quadraticCurveTo(0,0.99,-0.48,0.826); bar.closePath();
        const t=new THREE.Shape(); t.moveTo(0,0.747); t.lineTo(0.099,0.858);
        [[1,0.28,0.845,0.441,0.789],[1,0.4,0.73,0.322,0.697],[1,0.305,0.72,0.287,0.747],[1,0.2,0.762,0.125,0.767],[1,0.07,0.35,0,0.007]].forEach(function(q){ t.quadraticCurveTo(q[1],q[2],q[3],q[4]); });
        [[-0.07,0.35,-0.125,0.767],[-0.2,0.762,-0.287,0.747],[-0.305,0.72,-0.322,0.697],[-0.4,0.73,-0.441,0.789],[-0.28,0.845,-0.099,0.858]].forEach(function(q){ t.quadraticCurveTo(q[0],q[1],q[2],q[3]); });
        t.closePath();
        const g=new THREE.ExtrudeGeometry([bar,t],{depth:0.06,bevelEnabled:true,bevelThickness:0.025,bevelSize:0.008,bevelSegments:3,curveSegments:14}); g.translate(0,-0.5,0); g.scale(w,w,w); return new THREE.Mesh(g,chrome); };
      const tf=tLogo(0.085); tf.position.set(0,0.6,2.305); tf.rotation.x=-0.85; P.add(tf,{cast:false});                                                 // nose badge
      P.box(-0.5,0.5,ZR-0.022,ZR+0.06,0.4,0.47,lam(0x1a1c1f,{roughness:0.6}),{cast:false});
      /* number plates (private car: white with green characters) */
      const plate=function(z,y,rot){ const m=new THREE.Mesh(new THREE.PlaneGeometry(0.33,0.165),lam(0xffffff,{map:plateTex('品川 300',['た','12-34']),roughness:0.4})); m.position.set(0,y,z); m.rotation.y=rot; P.add(m,{cast:false});
        const fr=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.185,0.01),satin); fr.position.set(0,y,z-Math.sign(z)*0.007); P.add(fr,{cast:false}); };
      plate(ZF+0.025,0.42,0); plate(ZR-0.045,0.6,Math.PI);
      /* charge port, hidden in the left tail light housing (left = +x when facing forward) */
      const cpz=-2.02, cpx=sideX(cpz,0.85)+0.004; P.box(cpx-0.003,cpx+0.004,cpz-0.05,cpz+0.05,0.81,0.89,piano,{cast:false});
      P.port=[cpx+0.01,0.85,cpz];
      /* cabin seen through the glass: white seats, wood-and-fabric dash, 15" landscape screen, steering wheel on the right */
      const seat=lam(0x1e1f22,{roughness:0.45}), seatL=lam(0x4a4c51,{roughness:0.6}), inner=lam(0x26282b,{roughness:0.7});   // black leather sport seats with lighter perforated centres
      P.box(-0.84,0.84,-1.85,1.0,0.22,0.3,inner,{cast:false});
      const chair=function(x,z,w,tilt,head){ P.rb(x,z,w,0.52,0.1,0.05,seat,0.3,false); P.rb(x,z+0.01,w*0.6,0.44,0.03,0.015,seatL,0.4,false);
        [-1,1].forEach(function(k){ P.rb(x+k*(w/2-0.04),z,0.08,0.5,0.07,0.03,seat,0.4,false); });
        const G=new THREE.Group(); G.position.set(x,0.36,z-0.24); P.group.add(G); const at=function(m){ G.attach(m); };
        at(P.rb(x,z-0.24,w,0.11,0.6,0.05,seat,0.36,false)); at(P.rb(x,z-0.18,w*0.6,0.02,0.5,0.01,seatL,0.42,false));
        [-1,1].forEach(function(k){ at(P.rb(x+k*(w/2-0.04),z-0.2,0.08,0.09,0.52,0.03,seat,0.4,false)); });
        if(head){ at(P.rb(x,z-0.25,0.12,0.06,0.08,0.02,seat,0.95,false)); at(P.rb(x,z-0.25,0.27,0.1,0.18,0.04,seat,1.02,false)); }
        G.rotation.x=-tilt; };
      chair(-0.37,0.02,0.5,0.2,true); chair(0.37,0.02,0.5,0.2,true);
      P.box(-0.09,0.09,-0.2,0.62,0.3,0.52,inner,{cast:false}); P.box(-0.085,0.085,-0.2,0.5,0.52,0.53,piano,{cast:false});   // centre console
      [-0.45,0,0.45].forEach(function(x){ chair(x,-0.95,x?0.46:0.38,0.24,true); });
      P.box(-0.82,0.82,0.72,1.0,0.55,0.86,inner,{cast:false}); P.box(-0.8,0.8,0.62,0.72,0.74,0.79,lam(0xa47c56,{roughness:0.55}),{cast:false});
      P.box(-0.14,0.14,0.18,0.62,0.3,0.55,inner,{cast:false});
      const scr=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.24,0.015),piano); scr.position.set(0,0.98,0.6); scr.rotation.x=-0.25; P.add(scr,{cast:false});
      const sc2=new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.22),lam(0x1c2a3a,{emissive:0x274a6e,emissiveIntensity:0.6})); sc2.position.set(0,0.98,0.592); sc2.rotation.set(-0.25,Math.PI,0); P.add(sc2,{cast:false});
      const sw=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.018,10,32),inner); sw.position.set(-0.37,0.86,0.5); sw.rotation.x=-0.35; P.add(sw,{cast:false});
      /* four doors (hinged at their front edge) that swing out on a button; closed doors stay hidden inside the body shell */
      const doors=[], dGlass=new THREE.MeshPhysicalMaterial({color:0x0a0d10,metalness:0.2,roughness:0.03,transparent:true,opacity:0.9,envMapIntensity:1.6,clearcoat:1,side:THREE.DoubleSide,depthWrite:false});   // frameless door glass
      const card=lam(0x2a2b2e,{roughness:0.75,side:THREE.DoubleSide}), cardL=lam(0x8a7a66,{roughness:0.55}), skinM=paintS.clone(); skinM.side=THREE.DoubleSide;
      [[-1,0.95,-0.1,0.38],[1,0.95,-0.1,0.38],[-1,-0.12,-0.97,-0.62],[1,-0.12,-0.97,-0.62]].forEach(function(q){   // [side, front edge (hinge), rear edge, handle z]: each door is cut from the body surface itself
        const sd=q[0], zf=q[1], zr=q[2], xf=sideX(zf,0.6), pv=new THREE.Group(); pv.position.set(sd*xf,0,zf); P.group.add(pv);
        const zs=[]; for(let z=zf;z>zr;z-=0.05) zs.push(z); zs.push(zr);
        const top=function(z){ return yt(z)-0.072; }, ys=function(z){ const a=[], t=top(z); for(let k=0;k<=10;k++) a.push(0.34+(t-0.34)*k/10); return a; };
        const L=function(x,y,z){ return [sd*x-sd*xf,y,z-zf]; };
        const outer=zs.map(function(z){ return ys(z).map(function(y){ return L(sideX(z,y)+0.003,y,z); }); }), inner=zs.map(function(z){ return ys(z).map(function(y){ return L(sideX(z,y)-0.05,y,z); }); });
        const add=function(geo,mt){ const m=new THREE.Mesh(geo,mt); m.castShadow=true; pv.add(m); return m; };
        add(gridGeo(outer,sd<0),skinM); add(gridGeo(inner,sd>0),card);
        add(gridGeo(zs.map(function(z,i){ return [outer[i][10],inner[i][10]]; })),card);                                                 // top edge
        add(gridGeo([outer[outer.length-1],inner[inner.length-1]]),card); add(gridGeo([outer[0],inner[0]]),card);                         // shut faces
        const ar=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.04,Math.abs(zf-zr)*0.6),cardL); ar.position.set(-sd*0.08,0.66,(zr-zf)*0.5); pv.add(ar);   // armrest
        const fs=[0,0.3,0.6,0.92]; add(gridGeo(zs.map(function(z){ return fs.map(function(f){ const g=gX(z,f); return L(g[0]-0.004,g[1],z); }); }),sd<0),dGlass).renderOrder=3;
        const hz=q[3], hx=sideX(hz,0.86), hd=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.03,0.17),chrome); hd.position.set(sd*(hx+0.004)-sd*xf,0.858,hz-zf); pv.add(hd);
        pv.visible=false; doors.push({pv:pv,sd:sd,max:zf>0?0.52:0.66,front:zf>0,hd:hd,hx0:hd.position.x});
      });
      /* the door apertures: the body side is clipped away while the doors are open, so the cabin shows; B-pillars and sills fill the frame */
      env.enableLocalClipping&&env.enableLocalClipping();
      const cLoc=[[0,-1,0,0.33],[0,1,0,-0.98],[0,0,-1,-0.97],[0,0,1,-0.95]].map(function(q){ return new THREE.Plane(new THREE.Vector3(q[0],q[1],q[2]),q[3]); });
      const cW=cLoc.map(function(p){ return p.clone(); }); let cutOn=false;
      paint.clippingPlanes=cW; paint.clipIntersection=true;
      body.onBeforeRender=function(){ cLoc.forEach(function(p,i){ cW[i].copy(p).applyMatrix4(body.matrixWorld); if(!cutOn&&i===0) cW[0].constant+=1e4; }); };
      const gLoc=[[0,-1,0,0.86],[0,1,0,-1.4],[0,0,-1,-0.97],[0,0,1,-0.95]].map(function(q){ return new THREE.Plane(new THREE.Vector3(q[0],q[1],q[2]),q[3]); }), gW=gLoc.map(function(p){ return p.clone(); });   // side glass over the door apertures goes with the doors
      glassS.clippingPlanes=gW; glassS.clipIntersection=true;
      sideGl[0].onBeforeRender=function(){ gLoc.forEach(function(p,i){ gW[i].copy(p).applyMatrix4(sideGl[0].matrixWorld); if(!cutOn&&i===0) gW[0].constant+=1e4; }); };
      const frame=new THREE.Group(); frame.visible=false; P.group.add(frame);
      [-1,1].forEach(function(sd){ [[sd*0.86,sd*0.925,-0.13,-0.07,0.33,0.98,piano],[sd*0.8,sd*0.93,-0.97,0.95,0.28,0.35,inner]].forEach(function(b){
        const m=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b[1]-b[0]),b[5]-b[4],b[3]-b[2]),b[6]); m.position.set((b[0]+b[1])/2,(b[4]+b[5])/2,(b[2]+b[3])/2); frame.add(m); }); });
      const cl=function(v){ return Math.max(0,Math.min(1,v)); };
      const dApply=function(e){ cutOn=e>0.001; frame.visible=cutOn;   // the flush handles present first, then the front doors swing, the rear ones just behind
        doors.forEach(function(d){ const k=d.front?cl((e-0.08)/0.8):cl((e-0.2)/0.8); d.pv.visible=cutOn; d.pv.rotation.y=-d.sd*d.max*ease(k); d.hd.position.x=d.hx0+d.sd*0.014*cl(e/0.08)*(1-cl((e-0.9)/0.1)); }); };
      const dSt=stepper(1.3,dApply); dSt.v=0;
      let blink=null, lastT=0;                                                                                          // hazard flash: twice to unlock, once to lock
      const flash=function(n){ blink={t0:lastT,n:n}; };
      P.anims.push(function(t){ lastT=t; const a=dSt.run(t); let b=false;
        if(blink){ const k=t-blink.t0, on=k<blink.n*0.5&&(k%0.5)<0.25; drl.emissive.setHex(on?0xffa020:0xeef4ff); drl.emissiveIntensity=on?3:1.6; tail.emissiveIntensity=on?4:2; if(k>=blink.n*0.5) blink=null; b=true; }
        return a||b; });
      const doorAct=function(){ dSt.target=dSt.target?0:1; flash(dSt.target?2:1); }, sideDoors=function(sd){ return doors.filter(function(d){ return d.sd===sd; }).map(function(d){ return d.pv; }); };
      P.actions=(P.actions||[]).concat([{x:-1.35,z:0.3,part:sideDoors(-1),label:function(){ return dSt.target?'關上車門':'打開車門'; },act:doorAct},
        {x:1.35,z:0.3,part:sideDoors(1),label:function(){ return dSt.target?'關上車門':'打開車門'; },act:doorAct},
        {x:-1.2,z:-0.25,on:function(){ return dSt.target===1&&dSt.v>0.9; },label:function(){ return '坐進駕駛座'; },act:function(){ env.sitAt&&env.sitAt(P.group,new THREE.Vector3(-0.37,1.1,-0.08),new THREE.Vector3(-1.35,0,0.1)); }},   // right-hand drive
        {x:1.2,z:-0.25,on:function(){ return dSt.target===1&&dSt.v>0.9; },label:function(){ return '坐進副駕駛座'; },act:function(){ env.sitAt&&env.sitAt(P.group,new THREE.Vector3(0.37,1.1,-0.08),new THREE.Vector3(1.35,0,0.1)); }}]);
      /* trunk lid: the rear deck is cut from the body while it is open and a lid hinged at the rear glass swings up; carpeted floor inside */
      const tLoc=[new THREE.Plane(new THREE.Vector3(0,-1,0),TY),new THREE.Plane(new THREE.Vector3(0,0,1),-GR)], tW=tLoc.map(function(p){ return p.clone(); }); let tOn=false;
      paintR.clippingPlanes=tW; paintR.clipIntersection=true;
      bodyR.onBeforeRender=function(){ tLoc.forEach(function(p,i){ tW[i].copy(p).applyMatrix4(bodyR.matrixWorld); if(!tOn&&i===0) tW[0].constant+=1e4; }); };
      const paintL=paint.clone(); paintL.clippingPlanes=null; const hy=yt(GR)+0.01, lidP=new THREE.Group(); lidP.position.set(0,hy,GR); lidP.visible=false; P.group.add(lidP);
      const lid=new THREE.Mesh(loft(stR,function(z){ return section(z).map(function(q){ return [q[0],Math.max(q[1],TY),q[2]]; }); },0.03),paintL); lid.position.set(0,-hy,-GR); lid.castShadow=true; lidP.add(lid);
      const linM=lam(0x16181b,{roughness:0.7,side:THREE.DoubleSide});
      const tr=tLogo(0.085); tr.position.set(0,0.875-hy,-2.356-GR); tr.rotation.y=Math.PI; lidP.add(tr); const trB=tLogo(0.085); trB.position.copy(tr.position).add(new THREE.Vector3(0,hy,GR)); trB.rotation.y=Math.PI; P.add(trB,{cast:false}); // trunk badge: on the body while shut, rides the lid when open
      lidP.add(new THREE.Mesh(gridGeo(stR.filter(function(z){ return z>-2.3; }).map(function(z){ const x=Math.max(0.05,hw(z)-0.06); return [-x,0,x].map(function(xx){ return [xx,TY-0.004-hy,z-GR]; }); })),linM));
      const cave=new THREE.Group(); cave.visible=false; P.group.add(cave);
      [[-0.7,0.7,0.5,0.53,-2.22,GR-0.02,lam(0x2b2c2f,{roughness:0.95})],[-0.72,0.72,0.5,TY,GR-0.03,GR-0.02,lam(0x1c1d20,{roughness:0.9})]].forEach(function(b){ const m=new THREE.Mesh(new THREE.BoxGeometry(b[1]-b[0],b[3]-b[2],b[5]-b[4]),b[6]); m.position.set((b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2); cave.add(m); });
      const tSt=stepper(1.2,function(e){ tOn=e>0.001; lidP.visible=cave.visible=tOn; trB.visible=!tOn; lidP.rotation.x=1.25*e; }); tSt.v=0;
      P.anims.push(function(t){ return tSt.run(t); });
      P.actions.push({x:0,z:-2.85,part:[lidP],label:function(){ return tSt.target?'關上後車廂':'打開後車廂'; },act:function(){ tSt.target=tSt.target?0:1; }});
      /* frunk: the hood is cut from the nose while open and swings up on hinges at the windscreen; a tub underneath */
      const HY=0.68, fLoc=[new THREE.Plane(new THREE.Vector3(0,-1,0),HY),new THREE.Plane(new THREE.Vector3(0,0,-1),FS)], fW=fLoc.map(function(p){ return p.clone(); }); let fOn=false;
      paintF.clippingPlanes=fW; paintF.clipIntersection=true;
      bodyF.onBeforeRender=function(){ fLoc.forEach(function(p,i){ fW[i].copy(p).applyMatrix4(bodyF.matrixWorld); if(!fOn&&i===0) fW[0].constant+=1e4; }); };
      const hyF=yt(FS)+0.005, hoodP=new THREE.Group(); hoodP.position.set(0,hyF,FS); hoodP.visible=false; P.group.add(hoodP);
      const hood=new THREE.Mesh(loft(stN,function(z){ return section(z).map(function(q){ return [q[0],Math.max(q[1],HY),q[2]]; }); },0.03),paintL); hood.position.set(0,-hyF,-FS); hood.castShadow=true; hoodP.add(hood);
      const lin=new THREE.Mesh(gridGeo(stN.filter(function(z){ return z<2.25; }).map(function(z){ const x=Math.max(0.05,hw(z)-0.06); return [-x,0,x].map(function(xx){ return [xx,HY-0.004-hyF,z-FS]; }); })),linM); hoodP.add(lin);   // underside liner
      const tub=new THREE.Group(); tub.visible=false; P.group.add(tub); const tubM=lam(0x202124,{roughness:0.9});
      [[-0.62,0.62,0.42,0.45,1.12,2.1],[-0.64,-0.62,0.42,HY,1.12,2.1],[0.62,0.64,0.42,HY,1.12,2.1],[-0.64,0.64,0.42,HY,2.08,2.1],[-0.64,0.64,0.42,HY,1.1,1.12]].forEach(function(b){ const m=new THREE.Mesh(new THREE.BoxGeometry(b[1]-b[0],b[3]-b[2],b[5]-b[4]),tubM); m.position.set((b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2); tub.add(m); });
      const bag=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.18,0.3),lam(0x3c5a7a,{roughness:0.8})); bag.position.set(-0.15,0.54,1.6); bag.rotation.y=0.2; tub.add(bag);   // a weekend bag in the frunk
      const fSt=stepper(1.2,function(e){ fOn=e>0.001; hoodP.visible=tub.visible=fOn; hoodP.rotation.x=-1.05*ease(e); }); fSt.v=0;
      P.anims.push(function(t){ return fSt.run(t); });
      P.actions.push({x:0,z:2.9,part:[hoodP],label:function(){ return fSt.target?'關上前車廂':'打開前車廂'; },act:function(){ fSt.target=fSt.target?0:1; }});
      P._col(-0.95,0.95,-2.36,2.36,true);
      return P;
    };

    /* ---------- appliances and sanitary ware (front = +x) ---------- */
    const mats={};
    function mat(k,c,o){ return mats[k]||(mats[k]=env.lam(c,o)); }
    function flatDisc(P,r,sx,y,x,z,mt,o){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.004,36),mt); m.scale.x=sx; m.position.set(x,y,z); return P.add(m,o||{cast:false}); }

    /* 60 x 66 cm, 1.8 m fridge: French doors on top, two drawers below */
    Catalog.fridge=function(){
      const P=new Piece(), body=mat('fridge',0xe6e9ec,{roughness:0.35,metalness:0.2}), seam=mat('seam',0x9aa0a6,{roughness:0.6});
      P.rbox(-0.33,0.31,-0.3,0.3,0,1.8,0.03,body); P._col(-0.33,0.33,-0.3,0.3,true);
      [[0.96,1.78,-0.298,-0.001],[0.96,1.78,0.001,0.298],[0.56,0.94,-0.298,0.298],[0.05,0.54,-0.298,0.298]].forEach(function(d,i){
        P.box(0.31,0.335,d[2],d[3],d[0],d[1],body,{cast:false});
        if(i<2){ const hz=i?0.02:-0.02; P.box(0.34,0.36,hz-0.008,hz+0.008,1.1,1.6,M.steel,{cast:false}); }
        else P.box(0.34,0.36,-0.2,0.2,d[1]-0.07,d[1]-0.05,M.steel,{cast:false});
      });
      P.box(0.335,0.34,-0.29,0.29,0.945,0.955,seam,{cast:false}); P.box(0.335,0.34,-0.29,0.29,0.545,0.555,seam,{cast:false});
      P.box(0.33,0.345,-0.12,-0.04,1.62,1.68,mat('panel',0x2b3a46,{emissive:0x0e2a3c,roughness:0.2}),{cast:false});
      return P;
    };
    /* Japanese toilet with washlet, 40 cm wide x 72 cm deep; tank on -x, you sit facing +x */
    /* small wall-hung hand basin 40 x 25 cm for a powder room, with a tap; back on the wall at x=0, front +x */
    Catalog.handBasin=function(){
      const P=new Piece(), oc={cast:false};
      P.rbox(0,0.25,-0.2,0.2,0.72,0.82,0.03,M.ceramic);
      const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.08,0.012,28),mat('basinIn',0xdfe6e9,{roughness:0.15})); bowl.position.set(0.14,0.821,0); P.add(bowl,oc);
      P.cyl(0.035,0,0.012,0.012,0.82,0.95,M.steel,oc,12); P.box(0.035,0.12,-0.008,0.008,0.935,0.95,M.steel,oc);
      P._col(0,0.25,-0.2,0.2,true); return P;
    };
    /* Panasonic wall remote for the Alauno, 18 W x 11 H x 1.6 cm on a thin wall holder; face toward local +z, returned as a group */
    let remoteTex=null;
    function washletRemote(lam){
      if(!remoteTex){ const cv=document.createElement('canvas'); cv.width=540; cv.height=330; const g=cv.getContext('2d'), F='"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif';
        g.fillStyle='#fbfbf9'; g.fillRect(0,0,540,330);
        g.fillStyle='#3d6db5'; g.font='bold 24px "Helvetica Neue",Arial,sans-serif'; g.textAlign='left'; g.textBaseline='middle'; g.fillText('Panasonic',18,24);
        const rr=function(x,y,w,h,r,fill){ g.beginPath(); g.roundRect(x,y,w,h,r); g.fillStyle=fill; g.fill(); g.strokeStyle='rgba(0,0,0,0.14)'; g.lineWidth=2; g.stroke(); };
        const txt=function(t,x,y,fs,col,bold){ g.fillStyle=col||'#4a4e53'; g.font=(bold?'bold ':'')+fs+'px '+F; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,x,y); };
        [['便座',72],['小',190],['大',308],['便ふた',426]].forEach(function(q){ rr(q[1]-52,48,104,66,10,'#eef0f1'); txt(q[0],q[1],q[0].length>1?96:84,q[0].length>1?20:30,'#3f4347',true); });
        g.strokeStyle='#5b6066'; g.lineWidth=3; g.beginPath(); g.ellipse(72,68,22,9,0,0,7); g.stroke(); g.beginPath(); g.moveTo(426-20,72); g.lineTo(426+20,62); g.stroke();   // seat / lid icons
        [190,308].forEach(function(x,k){ g.fillStyle='#5b8fd0'; g.beginPath(); g.moveTo(x,60); g.quadraticCurveTo(x+(k?14:10),78,x,80); g.quadraticCurveTo(x-(k?14:10),78,x,60); g.fill(); });   // flush drops
        rr(26,124,44,26,8,'#eef0f1'); txt('♪',48,137,18,'#4a4e53'); g.fillStyle='#8a8e92'; g.fillRect(470,128,26,14); g.fillRect(496,132,4,6); txt('🔒',515,137,16,'#8a8e92');
        g.strokeStyle='#d6d8da'; g.lineWidth=2; g.beginPath(); g.moveTo(16,162); g.lineTo(524,162); g.stroke();
        const btn=function(x,fill,t,col){ g.beginPath(); g.arc(x,212,28,0,7); g.fillStyle=fill; g.fill(); g.strokeStyle='rgba(0,0,0,0.15)'; g.lineWidth=2; g.stroke(); if(t) txt(t,x,212,15,col||'#fff',true); };
        btn(52,'#f3f4f5'); g.fillStyle='#d8453c'; g.fillRect(40,200,24,24); txt('停止',52,258,16);
        btn(130,'#3f8fd8','おしり'); txt('ムーブ',130,258,14); btn(208,'#e88aa6','ビデ'); txt('ムーブ',208,258,14); btn(286,'#f3f4f5','乾燥','#4a4e53');
        const dots=function(x0){ for(let k=0;k<5;k++){ g.beginPath(); g.arc(x0+k*14,286,4,0,7); g.fillStyle=k<3?'#5fd08a':'#d6d8da'; g.fill(); } };
        rr(336,190,80,44,10,'#e3e6e8'); txt('弱',356,212,16); txt('強',396,212,16); txt('洗浄強さ',376,258,14); dots(348);
        rr(434,190,80,44,10,'#e3e6e8'); txt('前',454,212,16); txt('後',494,212,16); txt('洗浄位置',474,258,14); dots(446);
        remoteTex=new THREE.CanvasTexture(cv); remoteTex.colorSpace=THREE.SRGBColorSpace; remoteTex.anisotropy=8; }
      const G=new THREE.Group(), W=0.18, H=0.11, D=0.016, body=lam(0xfafaf8,{roughness:0.15});
      const hold=new THREE.Mesh(new THREE.BoxGeometry(W+0.006,H+0.006,0.005),lam(0xeceeee,{roughness:0.4})); hold.position.z=0.0025; G.add(hold);
      const sh=new THREE.Shape(), r=0.012; sh.moveTo(-W/2+r,-H/2); sh.lineTo(W/2-r,-H/2); sh.quadraticCurveTo(W/2,-H/2,W/2,-H/2+r); sh.lineTo(W/2,H/2-r); sh.quadraticCurveTo(W/2,H/2,W/2-r,H/2); sh.lineTo(-W/2+r,H/2); sh.quadraticCurveTo(-W/2,H/2,-W/2,H/2-r); sh.lineTo(-W/2,-H/2+r); sh.quadraticCurveTo(-W/2,-H/2,-W/2+r,-H/2);
      const bm=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:D-0.004,bevelEnabled:true,bevelThickness:0.002,bevelSize:0.002,bevelSegments:3,curveSegments:6}),body); bm.position.z=0.005; bm.castShadow=true; G.add(bm);
      const face=new THREE.Mesh(new THREE.PlaneGeometry(W-0.008,H-0.008),lam(0xffffff,{map:remoteTex,roughness:0.2})); face.position.z=0.005+D-0.002+0.0006; G.add(face);
      const shd=new THREE.Mesh(new THREE.BoxGeometry(W+0.012,H+0.012,0.001),lam(0xb9b6ae,{roughness:0.9})); shd.position.z=0.0006; G.add(shd);
      return G; }
    /* Panasonic Alauno tankless toilet, all white: 38.3 W x 70 D x 54 H cm, seat at about 40.5 cm, the lid in a gentle S-wave rising into the rear housing; back to the wall at x -0.375, front +x
       opt.remote {side:+1/-1 local z, dist: centreline to that wall, x, y}: remote on the side wall; otherwise on the back wall */
    Catalog.toilet=function(opt){
      opt=opt||{};
      const P=new Piece(), lam=env.lam, oc={cast:false}, cer=mat('sanit',0xfbf9f4,{roughness:0.12,envMapIntensity:1.1}), xw=-0.375, XF=xw+0.70, HW=0.1915, XR=-0.13;
      const plan=function(x0,x1,hw){ const s=new THREE.Shape(); s.moveTo(x0,-hw); s.lineTo(x1-hw*1.15,-hw); s.bezierCurveTo(x1-hw*0.35,-hw,x1,-hw*0.55,x1,0); s.bezierCurveTo(x1,hw*0.55,x1-hw*0.35,hw,x1-hw*1.15,hw); s.lineTo(x0,hw); s.closePath(); return s; };
      const vtx=function(g,f){ const p=g.attributes.position; for(let i=0;i<p.count;i++){ const v=f(p.getX(i),p.getY(i),p.getZ(i)); p.setXYZ(i,v[0],v[1],v[2]); } g.computeVertexNormals(); return g; };
      const ext=function(s,h,b){ const g=new THREE.ExtrudeGeometry(s,{depth:h-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:5,curveSegments:28}); g.rotateX(-Math.PI/2); g.translate(0,b,0); return g; };
      const skS=plan(XR-0.02,XF,HW), bh=new THREE.Path(); for(let i=0;i<=40;i++){ const a=i/40*Math.PI*2; bh[i?'lineTo':'moveTo'](0.14+0.151*Math.cos(a),0.102*Math.sin(a)); } skS.holes.push(bh);
      const sk=new THREE.Mesh(vtx(ext(skS,0.375,0.025),function(x,y,z){ const t=Math.min(1,Math.max(0,y/0.375)), k=0.84+0.16*Math.pow(t,0.55), cx=0.08; return [cx+(x-cx)*k,y,z*k]; }),cer); sk.castShadow=sk.receiveShadow=true; P.add(sk);   // seamless skirted bowl tapering to a rounded foot
      (function(){ const bw=new THREE.Mesh(new THREE.SphereGeometry(1,40,16,0,Math.PI*2,Math.PI/2,Math.PI/2),mat('sanitIn',0xfbf9f4,{roughness:0.1,envMapIntensity:1.1,side:THREE.DoubleSide})); bw.scale.set(0.151,0.21,0.102); bw.position.set(0.14,0.375,0); P.group.add(bw);
        const wt=new THREE.Mesh(new THREE.CircleGeometry(1,32),lam(0xcfe6ef,{transparent:true,opacity:0.65,roughness:0.03,depthWrite:false})); wt.rotation.x=-Math.PI/2; wt.scale.set(0.085,0.06,1); wt.position.set(0.12,0.255,0); P.group.add(wt); })();   // the glazed bowl and the water in its trap
      P.rbox(xw,XR+0.01,-HW,HW,0,0.5,0.06,cer); P.rbox(xw+0.005,XR,-HW+0.005,HW-0.005,0.5,0.54,0.03,cer);   // rear housing with rounded corners
      const sm=function(a,b,x){ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
      const seatS=plan(XR-0.01,XF-0.008,0.188), hole=new THREE.Path(); for(let i=0;i<=40;i++){ const a=i/40*Math.PI*2; hole[i?'lineTo':'moveTo'](0.14+0.151*Math.cos(a),0.102*Math.sin(a)); } seatS.holes.push(hole);
      const seat=new THREE.Mesh(vtx(ext(seatS,0.022,0.008),function(x,y,z){ return [x,y+0.012*sm(0.15,XR,x),z]; }),cer); seat.position.y=0.383; seat.castShadow=true; P.add(seat);   // seat ring, top about 40.5 cm at the front
      const lid=new THREE.Mesh(vtx(ext(plan(XR-0.03,XF-0.012,0.186),0.018,0.008),function(x,y,z){ const nx=(x-0.12)/0.24, nz=z/0.186, d=Math.max(0,1-nx*nx-nz*nz); return [x,y+0.045*sm(0.2,XR-0.03,x)+0.012*d*(y>0.012?1:0),z]; }),cer); const LG=new THREE.Group(); LG.position.set(XR-0.012,0.48,0); P.group.add(LG); lid.position.set(-(XR-0.012),0.408-0.48,0); lid.castShadow=true; LG.add(lid);   // lid: low at the front, an S-wave up into the rear hump
      P.box(-0.1,-0.04,-0.03,0.03,0.408+0.018+0.045*sm(0.2,XR-0.03,-0.07)+0.002,0.408+0.018+0.045*sm(0.2,XR-0.03,-0.07)+0.004,lam(0xffffff,{roughness:0.05}),oc); P.group.updateMatrixWorld(true); LG.attach(P.group.children[P.group.children.length-1]);   // logo plate, on the lid
      const lst=stepper(0.9,function(v){ LG.rotation.z=1.5*ease(v); }); P.anims.push(function(t){ return lst.run(t); });   // the lid opens on its own hinge at the back, as the Alauno's does
      P.actions=(P.actions||[]).concat([{x:XF+0.45,z:0,part:[lid],label:function(){ return lst.target?'關上馬桶蓋':'打開馬桶蓋'; },act:function(){ lst.target=lst.target?0:1; }}]);
      const zr=-HW-0.0005, seam=lam(0xd6d3cc,{roughness:0.5}); P.box(xw+0.06,XR-0.02,zr-0.001,zr,0.1,0.42,seam,oc); P.box(xw+0.065,XR-0.025,zr-0.0015,zr-0.001,0.105,0.415,cer,oc);   // service panel on the right side
      P.box(xw+0.12,xw+0.17,zr-0.002,zr-0.0015,0.33,0.345,lam(0x2b2d31,{roughness:0.2}),oc); for(let k=0;k<4;k++) P.box(xw+0.08+k*0.014,xw+0.086+k*0.014,zr-0.002,zr-0.0015,0.2,0.26,lam(0xb8b5ae),oc); P.box(xw+0.2,xw+0.215,zr-0.008,zr,0.38,0.39,lam(0xd9dcdf,{metalness:0.6,roughness:0.3}),oc);   // indicator, vents, lever
      P.box(xw+0.01,xw+0.012,-HW+0.02,HW-0.02,0.04,0.045,seam,oc);   // removable back cover line
      const chrome=lam(0xd6dade,{metalness:0.9,roughness:0.22}); P.cyl(xw+0.025,-0.24,0.016,0.016,0.13,0.17,chrome,oc,14).rotation.z=Math.PI/2; P.group.children[P.group.children.length-1].position.set(xw+0.025,0.15,-0.24);
      P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(xw+0.045,0.15,-0.24),new THREE.Vector3(xw+0.08,0.13,-0.22),new THREE.Vector3(xw+0.05,0.1,-0.19),new THREE.Vector3(xw+0.04,0.1,-0.17)]),20,0.005,8,false),chrome),oc);
      P.box(xw,xw+0.008,0.25,0.32,0.18,0.3,lam(0xf4f3ef,{roughness:0.35}),oc); P.box(xw+0.008,xw+0.03,0.27,0.3,0.22,0.25,lam(0xf2f2f0),oc);   // earthed outlet with the plug
      P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(xw+0.03,0.235,0.285),new THREE.Vector3(xw+0.06,0.15,0.24),new THREE.Vector3(xw+0.07,0.1,0.2),new THREE.Vector3(xw+0.07,0.1,0.19)]),20,0.0035,6,false),lam(0xf0f0ee,{roughness:0.5})),oc);
      const R=washletRemote(lam); P.group.add(R);
      if(opt.remote){ const sd=opt.remote.side>0?1:-1, zw=sd*opt.remote.dist, xr=opt.remote.x!==undefined?opt.remote.x:XF+0.16, yr=opt.remote.y||0.75; R.position.set(xr,yr,zw); R.rotation.y=sd>0?Math.PI:0; }   // side wall, about 16 cm in front of the seat
      else { R.position.set(xw,0.9,0.32); R.rotation.y=Math.PI/2; }
      if(opt.shelf!==false){   // an oak shelf over the toilet with spare rolls and a little plant
        P.box(xw,xw+0.2,-0.3,0.3,1.2,1.225,M.oak); [-0.26,0.26].forEach(function(z){ P.box(xw,xw+0.015,z-0.012,z+0.012,1.13,1.2,M.oak,oc); });
        [-0.2,-0.08].forEach(function(z){ P.cyl(xw+0.09,z,0.055,0.055,1.225,1.335,lam(0xfbfaf6,{roughness:0.95}),{},18); P.cyl(xw+0.09,z,0.02,0.02,1.226,1.336,lam(0xd9c7a8,{roughness:0.9}),oc,10); });
        P.cyl(xw+0.1,0.14,0.05,0.04,1.225,1.31,lam(0xe9ddd0,{roughness:0.6}),{},18); }
      P._col(xw,XF,-HW,HW,true);
      return P;
    };
    /* 1.5 m bathtub (78 cm wide, 55 cm high) with softly rounded corners, filled with water; the apron faces +x, the tap is on the -x wall */
    Catalog.bathtub=function(len,deck,side,tapEnd){   // len: basin length along z (default 1.5 m); deck: a ledge moulded onto the end at side (+1 = +z); tapEnd: tap and pop-up drain at that end instead of the long side
      const P=new Piece(), lam=env.lam, shell=mat('tub',0xdcd5c9,{roughness:0.4,envMapIntensity:0.4}), inner=mat('tubIn',0xcfe6ef,{roughness:0.15});   // warm greige shell so the tub reads against white tiles
      const L=(len||1.5)/2, D=0.39, H=0.55, t=0.08;
      const rr=function(w,h,r){ const sh=new THREE.Shape(); sh.moveTo(-w/2+r,-h/2); sh.lineTo(w/2-r,-h/2); sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r); sh.lineTo(w/2,h/2-r); sh.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
        sh.lineTo(-w/2+r,h/2); sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); sh.lineTo(-w/2,-h/2+r); sh.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2); return sh; };
      const dk=deck||0, sd=side||1, oy=-sd*dk/2;                                                                                // shape y maps to -z
      const outer=rr(2*D-0.05,2*L+dk-0.05,0.14), hole=rr(2*D-2*t,2*L-2*t,0.1); outer.getPoints().length; outer.curves.forEach(function(c){ ['v0','v1','v2'].forEach(function(k){ if(c[k]) c[k].y+=oy; }); }); outer.holes.push(hole);   // rounded outer corners, rounded basin, bevelled rim
      const g=new THREE.ExtrudeGeometry(outer,{depth:H-0.025,bevelEnabled:true,bevelThickness:0.025,bevelSize:0.025,bevelSegments:4,curveSegments:12});
      const m=new THREE.Mesh(g,shell); m.rotation.x=-Math.PI/2; m.position.y=0.0; P.add(m);
      P.box(-D+t,D-t,-L+t,L-t,0,0.12,inner);
      const w=new THREE.Mesh(new THREE.ShapeGeometry(rr(2*(D-t),2*(L-t),0.1)),mat('water',0x6fbfdc,{transparent:true,opacity:0.6,roughness:0.02,metalness:0.1,envMapIntensity:1.4,depthWrite:false}));
      w.rotation.x=-Math.PI/2; w.position.set(0,0.42,0); P.add(w,{cast:false,recv:false});
      if(!tapEnd){ P.cyl(-D+0.04,0,0.018,0.018,H,H+0.12,M.steel,{cast:false},10); P.box(-D+0.03,-D+0.16,-0.015,0.015,H+0.1,H+0.13,M.steel,{cast:false}); }
      else {                                       // spout on the end rim, push-button pop-up drain beside it, plug in the basin floor
        const te=tapEnd, oc={cast:false}, zt=te*(L-0.04);
        P.cyl(0,zt,0.02,0.02,H,H+0.1,M.steel,oc,12); P.box(-0.015,0.015,Math.min(zt,zt-te*0.14),Math.max(zt,zt-te*0.14),H+0.075,H+0.1,M.steel,oc);
        P.cyl(0.2,zt,0.024,0.024,H,H+0.008,M.steel,oc,20); const btn=P.cyl(0.2,zt,0.017,0.017,H+0.008,H+0.016,lam(0xeef0f2,{metalness:0.6,roughness:0.25}),oc,20);
        const plug=P.cyl(0,te*(L-t-0.12),0.03,0.03,0.12,0.128,M.steel,oc,20);
        const apply=function(e){ plug.position.y=0.03*e; btn.position.y=-0.005*(1-e); w.position.y=0.42-0.28*e; w.visible=e<0.98; };
        const st=stepper(3,apply); st.v=0; apply(0); P.anims.push(function(tm){ return st.run(tm); });
        P.actions=[{x:0.2,z:zt,label:function(){ return st.target?'塞上浴缸塞子':'拔開浴缸塞子（放水）'; },act:function(){ st.target=st.target?0:1; }}];
      }
      P._col(-D,D,sd>0?-L:-L-dk,sd>0?L+dk:L,true);
      return P;
    };
    /* 75 cm wash basin unit: two-door cabinet that opens (toothbrushes, toothpaste, towels and spares inside, a small light), ceramic top with a basin,
       gooseneck tap and a lit mirror cabinet; faces +x */
    Catalog.vanity=function(w,square){              // w: width (default 75 cm); square: a square basin
      const P=new Piece(), lam=env.lam, cab=mat('vcab',0xf1eee8,{roughness:0.45}), cer=M.ceramic, oc={cast:false};
      const fx=0.26, hz=(w||0.75)/2, shelf=0.44, floorB=0.08;
      P.box(-0.275,-0.26,-hz,hz,0.06,0.78,cab); [-1,1].forEach(function(sd){ P.box(-0.26,fx,sd*hz-0.009,sd*hz+0.009,0.06,0.78,cab); });
      P.box(-0.26,fx,-hz,hz,0.06,floorB,cab); P.box(-0.26,fx-0.02,-hz,hz,shelf-0.02,shelf,cab); P.box(-0.26,fx,-hz,hz,0.76,0.78,cab);
      P.box(-0.25,0.24,-hz+0.015,hz-0.015,0,0.06,M.dark,oc);
      const it=function(geo,mt,x,y,z,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); return P.add(m,{cast:cast!==false}); };
      const sy=shelf, lz=-hz+0.11, mid=fx-0.14;
      it(new THREE.CylinderGeometry(0.034,0.03,0.09,20),M.ceramic,mid,sy+0.045,lz);
      it(new THREE.CylinderGeometry(0.027,0.027,0.002,20),lam(0x2a2a2e,{roughness:0.9}),mid,sy+0.0905,lz,false);
      [[0xf2a7b8,-0.22,0.1],[0x5fa8d8,0.18,0.25],[0xf4f4f0,0.0,-0.18]].forEach(function(b){
        const g=new THREE.Group(); g.position.set(mid,sy+0.04,lz); g.rotation.set(b[2],0,b[1]);
        const h=new THREE.Mesh(new THREE.CylinderGeometry(0.0055,0.0042,0.19,8),lam(b[0],{roughness:0.4})); h.position.y=0.095; h.castShadow=true; g.add(h);
        const hd=new THREE.Mesh(new THREE.BoxGeometry(0.014,0.034,0.009),lam(0xf4f4f0,{roughness:0.6})); hd.position.y=0.205; g.add(hd);
        const br=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.028,0.009),lam(0x5fa8d8,{roughness:0.8})); br.position.set(0,0.207,0.0085); g.add(br);
        P.group.add(g);
      });
      [[lz+0.1,0xf4f4f0,0x2c78c8],[lz+0.16,0xf4f4f0,0xd8453c]].forEach(function(t){
        const g=new THREE.Group(); g.position.set(mid+0.01,sy+0.017,t[0]); g.rotation.x=Math.PI/2;
        const b=new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.017,0.13,16),lam(t[1],{roughness:0.35})); b.castShadow=true; g.add(b);
        const bd=new THREE.Mesh(new THREE.CylinderGeometry(0.0173,0.0173,0.045,16),lam(t[2],{roughness:0.35})); bd.position.y=0.02; g.add(bd);
        const cp=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.012,0.022,12),lam(t[2],{roughness:0.4})); cp.position.y=0.076; g.add(cp);
        P.group.add(g);
      });
      it(new THREE.CylinderGeometry(0.03,0.03,0.17,18),lam(0x6fb4e8,{transparent:true,opacity:0.8,roughness:0.15}),mid-0.1,sy+0.085,lz+0.31);
      it(new THREE.CylinderGeometry(0.025,0.025,0.03,16),lam(0xf4f4f0),mid-0.1,sy+0.185,lz+0.31,false);
      const rz=hz-0.2;
      [0,1].forEach(function(i){ it(new THREE.BoxGeometry(0.22,0.065,0.2),env.fab(i?0xcfd9e2:0xf4f2ee),mid,sy+0.0325+i*0.067,rz); });
      [[-0.06,-0.06],[0.06,-0.06],[-0.06,0.06],[0.06,0.06]].forEach(function(q){ it(new THREE.CylinderGeometry(0.052,0.052,0.1,16),lam(0xfbfbf9,{roughness:0.9}),mid+q[0]*0.8,floorB+0.05,rz+q[1]); });
      it(new THREE.CylinderGeometry(0.038,0.04,0.2,18),lam(0xbfe3ea,{transparent:true,opacity:0.85,roughness:0.2}),mid,floorB+0.1,lz+0.02);
      const light=new THREE.PointLight(0xfff4e6,0,1.3,2); light.position.set(mid,0.45,0); P.group.add(light);
      const doors=[];
      [[-hz,1],[hz,-1]].forEach(function(d){                                                // two doors hinged at the outer ends, swinging out
        const G=new THREE.Group(); G.position.set(fx,0,d[0]); P.group.add(G); doors.push(G);
        const len=hz-0.002, pm=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.69,len),cab); pm.position.set(0.011,0.415,d[1]*len/2); pm.castShadow=pm.receiveShadow=true; G.add(pm);
        const hd=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.14,0.012),M.steel); hd.position.set(0.026,0.62,d[1]*(len-0.05)); G.add(hd);
      });
      P.setOpen=function(t){ const e=ease(t); doors[0].rotation.y=1.75*e; doors[1].rotation.y=-1.75*e; light.intensity=0.14*e; };
      const st=stepper(0.6,P.setOpen);
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:fx+0.45,z:0,label:function(){ return st.target?'關上櫃子':'打開洗面台櫃子'; },act:function(){ st.target=st.target?0:1; }}];
      P.rbox(-0.275,0.285,-hz-0.005,hz+0.005,0.78,0.85,0.02,cer);
      if(square){ P.rbox(-0.12,0.24,-0.21,0.21,0.8495,0.8505,0.03,mat('basin',0xe4e6e6,{roughness:0.15}),oc); P.box(-0.1,0.22,-0.19,0.19,0.85,0.8512,mat('basinIn',0xd6dada,{roughness:0.12}),oc); }
      else flatDisc(P,0.17,1.35,0.8505,0.07,0,mat('basin',0xe4e6e6,{roughness:0.15}));
      flatDisc(P,0.015,1,0.852,0.07,0,M.steel);
      P.cyl(-0.18,0,0.018,0.018,0.85,1.06,M.steel,oc,10); P.box(-0.19,-0.06,-0.014,0.014,1.04,1.07,M.steel,oc);
      P.box(-0.275,-0.13,-hz,hz,1.05,1.95,cab);
      const mw=2*hz-0.03, mir=env.mirror?env.mirror(mw,0.76):new THREE.Mesh(new THREE.PlaneGeometry(mw,0.76),mat('mirror',0xdfe8ec,{metalness:1,roughness:0.03,envMapIntensity:1}));
      mir.position.set(-0.128,1.5,0); mir.rotation.y=Math.PI/2; P.group.add(mir);
      P.box(-0.13,-0.11,-hz+0.015,hz-0.015,1.89,1.93,mat('vlight',0xfff6e0,{emissive:0xffe8c0}),oc);
      P._col(-0.275,0.285,-hz-0.005,hz+0.005,true);
      return P;
    };
    /* Japanese drum washer-dryer (about W 64 x D 72 x H 106 cm, like the Panasonic / Hitachi drum models): the door sits high and tilted up
       for easy loading, control panel along the top front edge, detergent drawer top left; the front faces +x */
    Catalog.washer=function(opt){
      const P=new Piece(), body=mat('wash',0xf8fafb,{roughness:0.16,envMapIntensity:1.2}), lam=env.lam, oc={cast:false};
      const D=0.36, W=0.32, H=1.06, fx=D;
      P.rbox(-D,D-0.45,-W,W,0.0,H,0.03,body); [-W,W-0.02].forEach(function(z){ P.rbox(D-0.47,D-0.06,z,z+0.02,0.3,H,0.008,body); }); P.rbox(D-0.47,D-0.06,-W,W,0.95,H,0.03,body); P.box(D-0.47,D-0.07,-W,W,0,0.32,body);   // cabinet: hollow behind the door so the drum shows
      P.box(-D+0.02,D-0.07,-W+0.02,W-0.02,0,0.03,M.dark,oc);                              // shadow gap at the floor
      /* tilted front: lower part vertical, upper part leaning back 10 degrees, door in it */
      P.rbox(D-0.07,D,-W,W,0.0,0.32,0.02,body);
      const face=new THREE.Group(); face.position.set(D-0.035,0.32,0); face.rotation.z=0.17; P.group.add(face);
      const fm=function(geo,mt,x,y,z,ry,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); if(ry!==undefined) m.rotation.y=ry; m.castShadow=!!cast; m.receiveShadow=true; face.add(m); return m; };
      (function(){ const sh=new THREE.Shape(); sh.moveTo(-0.32,0); sh.lineTo(0.32,0); sh.lineTo(0.32,0.66); sh.lineTo(-0.32,0.66); sh.lineTo(-0.32,0); const hp=new THREE.Path(); hp.absarc(0,0.3,0.17,0,Math.PI*2,true); sh.holes.push(hp); const sl=new THREE.Path(); sl.moveTo(0.165,0.57); sl.lineTo(0.165,0.63); sl.lineTo(0.31,0.63); sl.lineTo(0.31,0.57); sl.lineTo(0.165,0.57); sh.holes.push(sl);
        const g=new THREE.ExtrudeGeometry(sh,{depth:0.07,bevelEnabled:false,curveSegments:40}); g.rotateY(Math.PI/2); g.translate(-0.035,0,0); fm(g,body,0,0,0,undefined,true); })();   // the tilted front with the porthole
      (function(){ const pf=(function(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.fillStyle='#c3c8cd'; g.fillRect(0,0,64,64); g.fillStyle='#5b6167'; for(let j=0;j<8;j++) for(let i=0;i<8;i++){ g.beginPath(); g.arc(4+i*8+(j%2)*4,4+j*8,1.6,0,Math.PI*2); g.fill(); } const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,4); t.colorSpace=THREE.SRGBColorSpace; return t; })(), dm2=lam(0xffffff,{map:pf,metalness:0.6,roughness:0.35,side:THREE.DoubleSide});
        const dr=fm(new THREE.CylinderGeometry(0.16,0.16,0.4,40,1,true),dm2,-0.17,0.3,0); dr.rotation.z=Math.PI/2; const bk=fm(new THREE.CircleGeometry(0.16,40),dm2,-0.37,0.3,0,Math.PI/2);   // perforated stainless drum
        [0,2.09,4.19].forEach(function(a){ const lf=fm(new THREE.BoxGeometry(0.36,0.035,0.03),lam(0xd4d8dc,{metalness:0.6,roughness:0.3}),-0.18,0.3+Math.cos(a)*0.145,Math.sin(a)*0.145); lf.rotation.x=-a; });   // three lifters
        const gk=fm(new THREE.TorusGeometry(0.165,0.022,10,40),lam(0x3a3f45,{roughness:0.8}),0.022,0.3,0,Math.PI/2);   // the rubber door gasket
        [[0xd8cfc0,-0.05,0.02],[0x7f97ad,0.04,-0.05],[0xe9e4da,-0.02,0.06],[0x8c6d5a,0.06,0.04]].forEach(function(q,i){ const c=fm(new THREE.SphereGeometry(0.06,12,8),lam(q[0],{roughness:0.95}),-0.24+i*0.05,0.19+(i%2)*0.02,q[2]); c.scale.set(1.3,0.55,1.1); });   // a load of washing settled in the bottom
      })();
      const hs=opt&&opt.hingeLeft?-1:1, dp=new THREE.Group(); dp.position.set(0.04,0.3,hs*0.24); face.add(dp);   // door hinged on one side (opt.hingeLeft: the -z side), swings out about 170 degrees
      const dm=function(geo,mt,x,y,z,ry,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z-hs*0.24); if(ry!==undefined) m.rotation.y=ry; m.castShadow=!!cast; dp.add(m); return m; };
      const ring=dm(new THREE.TorusGeometry(0.205,0.032,12,40),mat('wring',0xc9ced3,{metalness:0.7,roughness:0.25,envMapIntensity:1}),0,0,0,Math.PI/2,true);
      dm(new THREE.CircleGeometry(0.19,40),mat('wglass',0x1d2a35,{metalness:0.5,roughness:0.08,envMapIntensity:1,transparent:true,opacity:0.85}),0.003,0,0,Math.PI/2);
      dm(new THREE.BoxGeometry(0.03,0.09,0.03),M.steel,0.02,0,-hs*0.235);                     // door handle on the free side
      const dst=stepper(0.7,function(v){ dp.rotation.y=-hs*((opt&&opt.swing)||2.9)*ease(v); }); P.anims.push(function(t){ return dst.run(t); });   // opt.swing: a wall on the hinge side stops the door short
      P.actions=(P.actions||[]).concat([{x:D+0.55,z:0,part:[ring],label:function(){ return dst.target?'關上洗衣機門':'打開洗衣機門'; },act:function(){ dst.target=dst.target?0:1; }}]);
      fm(new THREE.BoxGeometry(0.012,0.1,0.46),mat('wpanel',0x2a2f35,{roughness:0.2,metalness:0.2}),0.036,0.6,0.05);   // control panel strip
      fm(new THREE.BoxGeometry(0.014,0.03,0.16),mat('wled',0x9fd6ff,{emissive:0x4aa8e8}),0.044,0.6,0.08);
      const knob=fm(new THREE.CylinderGeometry(0.032,0.032,0.025,20),mat('wknob',0xdfe3e6,{metalness:0.6,roughness:0.3}),0.05,0.6,-0.12); knob.rotation.z=Math.PI/2;
      const DD=new THREE.Group(); face.add(DD); const ddf=new THREE.Mesh(new THREE.BoxGeometry(0.01,0.07,0.17),lam(0xe4e7e9,{roughness:0.3})); ddf.position.set(0.036,0.6,-0.24); DD.add(ddf);   // detergent drawer: three wells behind its front
      (function(){ const dw=lam(0xeef1f3,{roughness:0.35}), b=function(x0_,x1_,y0,y1,z0_,z1_,m){ const o=new THREE.Mesh(new THREE.BoxGeometry(x1_-x0_,y1-y0,z1_-z0_),m); o.position.set((x0_+x1_)/2,(y0+y1)/2,(z0_+z1_)/2); DD.add(o); };
        b(-0.17,0.031,0.572,0.576,-0.305,-0.17,dw); [-0.305,-0.26,-0.215,-0.174].forEach(function(z){ b(-0.17,0.031,0.572,0.626,z,z+0.004,dw); }); b(-0.17,-0.166,0.572,0.626,-0.305,-0.17,dw);
        [[-0.3,-0.26,0x9fd0e6],[-0.256,-0.215,0xf2efe8],[-0.211,-0.174,0xe9c3bd]].forEach(function(q){ b(-0.16,0.02,0.576,0.582,q[0]+0.002,q[1]-0.002,lam(q[2],{roughness:0.2})); }); })();   // three wells: detergent, softener, bleach
      const ddst=stepper(0.5,function(v){ DD.position.x=0.14*ease(v); }); P.anims.push(function(t){ return ddst.run(t); });
      P.actions.push({x:D+0.55,z:-0.24,part:[ddf],label:function(){ return ddst.target?'推回洗劑盒':'拉出洗劑盒'; },act:function(){ ddst.target=ddst.target?0:1; }});
      P.box(-D+0.05,D-0.12,-W+0.04,W-0.04,H,H+0.004,lam(0xe9ecee,{roughness:0.25}),oc);       // top panel line
      P._col(-D,D,-W,W,true);
      return P;
    };
    /* 80 cm shoe cabinet, 35 cm deep, 90 cm high; doors face +x */
    Catalog.shoeCabinet=function(){
      const P=new Piece();
      P.box(-0.175,0.16,-0.4,0.4,0.05,0.9,M.oak); P.box(-0.16,0.14,-0.39,0.39,0,0.05,M.dark,{cast:false});
      P.cabDoors('z',-0.4,0.4,0.16,1,0.07,0.88,2,true,M.oak);
      P._col(-0.175,0.175,-0.4,0.4,true);
      return P;
    };

    /* ---------- interactive pieces: piece.actions = [{x,z,label(),act()}] in the piece's own metres, piece.anims return true while something moves ---------- */
    const ease=function(x){ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
    function stepper(dur,apply){                 // eases a 0..1 value toward a target; call .run(t) every frame
      const s={target:0,v:-1,last:null};
      s.run=function(t){ const dt=s.last===null?0:Math.min(0.05,Math.max(0,t-s.last)); s.last=t;
        if(s.v===s.target) return false; if(s.v<0) s.v=0;
        s.v=s.target>s.v?Math.min(s.target,s.v+dt/dur):Math.max(s.target,s.v-dt/dur); apply(s.v); return true; };
      return s;
    }

    /* Hitachi R-HZC54Y, 540 L: W65 x D69.9 x H184.3 cm, crystal-white glass, front +z. French doors over two small drawers (ice / switch room), a vegetable drawer and a freezer drawer; all open */
    Catalog.fridgeHitachi=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, W=0.65, D=0.699, H=1.843, x0=-W/2, x1=W/2, zb=-D/2, zf=D/2, T=0.03;
      const glassW=lam(0xf3f4f3,{roughness:0.12,metalness:0.05,envMapIntensity:1.1}), seam=lam(0xc7cacc,{roughness:0.4}), liner=lam(0xf4f7f8,{roughness:0.45}), clear=lam(0xe4eef2,{transparent:true,opacity:0.4,roughness:0.05,depthWrite:false}), grey=lam(0x9aa0a6,{roughness:0.5});
      P.box(x0,x1,zb,zb+T,0.03,H,glassW); P.box(x0,x0+T,zb,zf-0.05,0.03,H,glassW); P.box(x1-T,x1,zb,zf-0.05,0.03,H,glassW); P.box(x0,x1,zb,zf-0.05,H-T,H,glassW); P.box(x0+0.01,x1-0.01,zb+0.02,zf-0.07,0,0.03,M.dark,oc);
      const C0=0.95, ZF=zf-0.05;                                                                       // fridge compartment from 95 cm up, doors 5 cm thick
      P.box(x0+T,x1-T,zb+T,ZF,C0-0.02,C0,liner); P.box(x0+T,x1-T,zb+T,zb+T+0.004,C0,H-T,liner,oc); [x0+T,x1-T-0.004].forEach(function(x){ P.box(x,x+0.004,zb+T,ZF,C0,H-T,liner,oc); });
      const lab=function(txt,bg,fg,w,h){ const c=document.createElement('canvas'); c.width=256; c.height=128; const g=c.getContext('2d'); g.fillStyle=bg; g.fillRect(0,0,256,128); g.fillStyle=fg; g.font='700 46px "Noto Sans TC","Hiragino Sans",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,128,66); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({map:t,roughness:0.5}); };
      const cyl=function(G,x,y,z,r,h,c,o){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,14),lam(c,Object.assign({roughness:0.3},o||{}))); m.position.set(x,y+h/2,z); G.add(m); return m; };
      const box=function(G,x,y,z,w,h,d,mt){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt); m.position.set(x,y+h/2,z); m.castShadow=true; G.add(m); return m; };
      /* inside the fridge compartment: three glass shelves, a chilled tray, food */
      const IN=P.group, iz=function(f){ return zb+T+0.04+f*(ZF-zb-T-0.08); };
      [1.18,1.4,1.6].forEach(function(y){ P.box(x0+T,x1-T,zb+T,ZF-0.02,y,y+0.008,clear,oc); });
      P.box(x0+T+0.01,x1-T-0.01,iz(0.05),iz(0.95),C0,C0+0.012,clear,oc); P.box(x0+T+0.01,x1-T-0.01,iz(0.92),iz(0.95),C0,C0+0.09,clear,oc);
      const labT=function(txt,bg,fg){ return Catalog.pack.label(txt,bg,fg,256,160); };   // printed packs: pictures and a small logo block instead of words
      const pkg=function(G,x,y,z,w,h,d,col,face,fi,ry){ const sm=lam(col,{roughness:0.55}), arr=[sm,sm,sm,sm,sm,sm]; arr[fi]=face; const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),arr); m.position.set(x,y+h/2,z); if(ry) m.rotation.y=ry; m.castShadow=true; G.add(m); return m; };
      const sph=function(G,x,y,z,r,c,sy,rough){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),lam(c,{roughness:rough||0.6})); if(sy) m.scale.y=sy; m.position.set(x,y+r*(sy||1),z); m.castShadow=true; G.add(m); return m; };
      const milk=function(G,x,y,z,fi){ const body=pkg(G,x,y,z,0.07,0.19,0.07,0xf6f6f2,labT('牛乳','#ffffff','#1d5fae',60,'1000ml'),fi); const top=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.07,3,1),lam(0xf6f6f2,{roughness:0.5})); top.rotation.set(0,0,Math.PI/2); top.scale.set(0.55,1,1); top.position.set(x,y+0.205,z); G.add(top); return body; };
      /* fridge compartment: eggs, yoghurt, leftovers and drinks on the shelves; ham and cheese in the chilled tray */
      pkg(IN,-0.16,C0+0.012,iz(0.45),0.11,0.03,0.16,0xf2d6d6,labT('ロースハム','#fff4f4','#b8323a',38),2); pkg(IN,-0.03,C0+0.012,iz(0.5),0.1,0.025,0.1,0xf4e2a8,labT('チーズ','#fff8de','#a0761a',42),2); pkg(IN,0.1,C0+0.012,iz(0.4),0.09,0.04,0.13,0xffffff,labT('納豆','#fff','#b8323a',52),2);
      pkg(IN,0.2,C0+0.012,iz(0.55),0.08,0.05,0.12,0xf5ead2,labT('バター','#fff6dc','#3a5fa0',40),2);
      (function(){ const tr=lam(0xf2efe8,{roughness:0.6}); box(IN,-0.17,1.188,iz(0.35),0.2,0.03,0.1,tr); for(let i=0;i<4;i++) for(let j=0;j<2;j++) sph(IN,-0.245+i*0.05,1.205,iz(0.35)-0.025+j*0.05,0.021,0xf1e3cc,1.25,0.55); })();   // 8 eggs in their tray
      [[0.03,0xd8566a],[0.1,0x5f8fc9],[0.17,0xf2c46b]].forEach(function(q){ const c=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.025,0.07,16),lam(0xf7f4ee,{roughness:0.4})); c.position.set(q[0],1.188+0.035,iz(0.3)); IN.add(c); cyl(IN,q[0],1.188+0.07,iz(0.3),0.031,0.004,q[1],{metalness:0.6,roughness:0.3}); });   // yoghurt cups
      (function(){ box(IN,0.1,1.188,iz(0.75),0.18,0.07,0.13,clear); box(IN,0.1,1.258,iz(0.75),0.185,0.012,0.135,lam(0x5f8fc9,{roughness:0.4})); box(IN,0.1,1.195,iz(0.75),0.15,0.04,0.1,lam(0xc98a4a,{roughness:0.7})); })();   // leftovers in a clear container
      (function(){ const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.09,0.11,24),lam(0xf2c33a,{roughness:0.3})); pot.position.set(-0.13,1.408+0.055,iz(0.55)); IN.add(pot); cyl(IN,-0.13,1.408+0.11,iz(0.55),0.1,0.012,0xf2c33a); })();   // a pot of curry
      [[0.05,0xe8b4b8],[0.13,0xf2e6c8]].forEach(function(q){ cyl(IN,q[0],1.408,iz(0.4),0.035,0.06,q[1],{transparent:true,opacity:0.9}); });   // puddings
      pkg(IN,0.2,1.408,iz(0.6),0.08,0.08,0.12,0xffffff,labT('キムチ','#ffffff','#c9372c',44),4);
      [[-0.22,0x2f6b3a],[-0.15,0x6b3a12]].forEach(function(q){ cyl(IN,q[0],1.608,iz(0.35),0.032,0.2,q[1],{transparent:true,opacity:0.85,roughness:0.08}); cyl(IN,q[0],1.808,iz(0.35),0.013,0.05,q[1],{transparent:true,opacity:0.85,roughness:0.08}); });   // two glass bottles
      [[-0.05,0xd9d9d6,0x2a5fae],[0.02,0xd9d9d6,0x2a5fae],[0.09,0xd9d9d6,0xc9372c],[0.16,0xd9d9d6,0xd9a441]].forEach(function(q){ cyl(IN,q[0],1.608,iz(0.4),0.033,0.122,q[1],{metalness:0.85,roughness:0.25}); cyl(IN,q[0],1.64,iz(0.4),0.0335,0.06,q[2],{roughness:0.4}); });   // four cans
      /* French doors with pockets on their inside faces */
      const parts={doors:[],small:[],veg:[],frz:[]};
      const door=function(sg){ const G=new THREE.Group(); G.position.set(sg<0?x0:x1,0,zf); P.group.add(G); const w=W/2-0.002, cx=-sg*w/2;
        const m=box(G,cx,C0+0.005,-0.025,w,H-C0-0.01,0.05,glassW); parts.doors.push(m);
        const hd=box(G,-sg*(w-0.01),C0+0.02,0.0,0.012,0.6,0.012,seam); parts.doors.push(hd);   // slim handle groove at the meeting edge
        [C0+0.12,C0+0.42,C0+0.66].forEach(function(y,k){ box(G,cx,y,-0.1,w-0.06,0.008,0.09,clear); box(G,cx,y,-0.145,w-0.06,0.09,0.006,clear);   // door pockets
          const X=function(f){ return cx+(f-0.5)*(w-0.1); };
          if(k===0){ if(sg<0){ milk(G,X(0.18),y+0.008,-0.1,5); cyl(G,X(0.5),y+0.008,-0.1,0.045,0.27,0xe4eef2,{transparent:true,opacity:0.7,roughness:0.05}); cyl(G,X(0.5),y+0.278,-0.1,0.018,0.02,0x2a5fae); milk(G,X(0.82),y+0.008,-0.1,5).material[5]=labT('豆乳','#f6f1e2','#5a7a2a',60,'1000ml'); }
            else { [[0.2,0x3a1c10,'麦茶'],[0.55,0xe8e2c8,'お茶'],[0.85,0xf2c46b,'オレンジ']].forEach(function(q){ cyl(G,X(q[0]),y+0.008,-0.1,0.04,0.26,q[1],{transparent:true,opacity:0.85,roughness:0.06}); pkg(G,X(q[0]),y+0.08,-0.141,0.06,0.09,0.002,0xffffff,labT(q[2],'#ffffff','#2f6b3a',40),5); }); } }
          else if(k===1){ (sg<0?[['しょうゆ',0x3a1c10,0xc9372c],['マヨネーズ',0xf2e6b8,0xc9372c],['ケチャップ',0xc23a2e,0x2f6b3a],['ソース',0x2a1810,0xd9a441]]:[['ドレッシング',0xd9a441,0xf2f2ee],['ポン酢',0xd8a35a,0xe08a2a],['わさび',0x6fa84a,0x2f6b3a],['からし',0xe8c23a,0xc9a23a]]).forEach(function(q,i){ const x=X((i+0.5)/4), sq=/マヨ|ケチャ|わさび|からし/.test(q[0]);
              const m=new THREE.Mesh(sq?new THREE.CylinderGeometry(0.022,0.026,0.13,14):new THREE.CylinderGeometry(0.024,0.024,0.15,14),lam(q[1],{roughness:sq?0.35:0.15,transparent:!sq,opacity:sq?1:0.9})); m.position.set(x,y+0.008+(sq?0.065:0.075),-0.1); if(sq) m.rotation.x=Math.PI; G.add(m);
              cyl(G,x,y+0.008+(sq?0.0:0.15),-0.1,sq?0.014:0.015,0.02,q[2]); pkg(G,x,y+0.05,-0.127,0.04,0.05,0.002,0xffffff,labT(q[0],'#ffffff','#3a2a1e',28),5); }); }
          else { (sg<0?[0x3f8f4a,0xd9a441,0xc23a2e,0x2b2b2b]:[0xf2f2ee,0x8a3a1c,0xe7c58a,0x6fa84a]).forEach(function(c,i){ cyl(G,X((i+0.5)/4),y+0.008,-0.1,0.02,0.09,c,{roughness:0.3}); cyl(G,X((i+0.5)/4),y+0.098,-0.1,0.021,0.015,0xf4f4f0); }); }   // spice tubes and jars
          });
        if(sg<0){ const logo=new THREE.Mesh(new THREE.PlaneGeometry(0.1,0.02),lab('HITACHI','#f3f4f3','#9aa0a6')); logo.position.set(x0===0?0:0.07,H-0.07,0.0005); G.add(logo);
          const c=document.createElement('canvas'); c.width=384; c.height=72; const g=c.getContext('2d'); g.fillStyle='#f3f4f3'; g.fillRect(0,0,384,72); g.fillStyle='#a3a9ae'; g.font='600 50px "Helvetica Neue",Arial,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('R-HZC54Y',192,38);
          const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; const mdl=new THREE.Mesh(new THREE.PlaneGeometry(0.085,0.016),new THREE.MeshStandardMaterial({map:t,roughness:0.5})); mdl.position.set(0.07,H-0.092,0.0005); G.add(mdl); }
        return G; };
      const L=door(-1), R=door(1);
      const dst=stepper(0.6,function(v){ const e=v*v*(3-2*v); L.rotation.y=-(P.doorMaxL||1.75)*e; R.rotation.y=(P.doorMaxR||1.75)*e; });   // doorMaxL/R: stop short where a hinge side is against a wall
      /* drawers: two small (ice, switch room), vegetables, freezer; each slides out with its basket */
      const drawer=function(y0,y1,xa,xb,key,fill){ const G=new THREE.Group(); P.group.add(G); const w=xb-xa-0.004, cx=(xa+xb)/2, d=D-0.1;
        const f=box(G,cx,y0+0.003,zf-0.025,w,y1-y0-0.006,0.05,glassW); parts[key].push(f);
        box(G,cx,y0+0.01,zf-0.05-d/2,w-0.04,0.008,d,liner); [-1,1].forEach(function(sd){ box(G,cx+sd*(w/2-0.02),y0+0.01,zf-0.05-d/2,0.006,y1-y0-0.05,d,liner); }); box(G,cx,y0+0.01,zf-0.05-d,w-0.04,y1-y0-0.05,0.006,liner);
        fill(G,cx,y0+0.018,zf-0.05-d/2,w-0.06,d-0.04); return G; };
      const SM=[0.77,0.93], VG=[0.39,0.76], FZ=[0.035,0.38];
      const fillIce=function(G,cx,y,z,w,d){ for(let i=0;i<10;i++){ const c=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.025,0.03),clear); c.position.set(cx-w/2+0.04+(i%5)*0.04,y+0.013,z-0.05+Math.floor(i/5)*0.05); G.add(c); } };
      const fillSw=function(G,cx,y,z,w,d){ const tray=lam(0xf4f4f0,{roughness:0.5}), wrapM=lam(0xffffff,{transparent:true,opacity:0.35,roughness:0.05,depthWrite:false});   // switch room (chilled): meat and fish trays
        [[-0.06,-0.04,0xd8566a,'豚こま'],[0.06,0.06,0xf08a6a,'鮭']].forEach(function(q){ box(G,cx+q[0],y,z+q[1],0.11,0.02,0.16,tray); box(G,cx+q[0],y+0.02,z+q[1],0.09,0.015,0.13,lam(q[2],{roughness:0.7})); box(G,cx+q[0],y+0.035,z+q[1],0.112,0.004,0.162,wrapM); pkg(G,cx+q[0]+0.02,y+0.039,z+q[1]+0.04,0.05,0.002,0.04,0xffffff,labT(q[3],'#ffffff','#b8323a',54),2); }); };
      const fillVeg=function(G,cx,y,z,w,d){   // cabbage, carrots, leek, daikon, tomatoes, cucumbers, spinach
        (function(){ for(let i=0;i<5;i++){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.075-i*0.006,16,12),lam([0x9cc56a,0xa9cf78,0xb8d88a,0x8fbf5c,0xc4de9a][i],{roughness:0.75})); m.scale.set(1,0.85,1); m.rotation.y=i; m.position.set(cx-0.17+(i%2)*0.004,y+0.065,z-0.12); G.add(m); } })();
        [[0,0.0],[1,0.03],[2,-0.02]].forEach(function(q){ const c=new THREE.Mesh(new THREE.ConeGeometry(0.018,0.18,10),lam(0xe8822a,{roughness:0.7})); c.rotation.z=-Math.PI/2; c.position.set(cx-0.02,y+0.02+q[0]*0.012,z-0.16+q[1]+q[0]*0.035); G.add(c); const tp=new THREE.Mesh(new THREE.ConeGeometry(0.012,0.05,6),lam(0x4f8f3a)); tp.rotation.z=Math.PI/2; tp.position.set(cx-0.13,y+0.02+q[0]*0.012,z-0.16+q[1]+q[0]*0.035); G.add(tp); });
        (function(){ const l=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.4,12),lam(0xf2f1e6,{roughness:0.6})); l.rotation.x=Math.PI/2; l.position.set(cx+0.2,y+0.018,z); G.add(l); const g2=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.012,0.16,10),lam(0x4f8f3a,{roughness:0.7})); g2.rotation.x=Math.PI/2; g2.position.set(cx+0.2,y+0.018,z+0.26); G.add(g2); })();   // leek
        (function(){ const dk=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.022,0.36,14),lam(0xf6f4ec,{roughness:0.6})); dk.rotation.x=Math.PI/2; dk.position.set(cx+0.14,y+0.03,z+0.02); G.add(dk); })();   // daikon
        [[0.02,0.06],[0.07,0.09],[0.04,0.12]].forEach(function(q){ sph(G,cx+q[0],y,z+q[1],0.032,0xd9362c,0.85,0.35); });   // tomatoes
        [0,1].forEach(function(i){ const c=new THREE.Mesh(new THREE.CapsuleGeometry(0.016,0.16,4,8),lam(0x3f7a2e,{roughness:0.6})); c.rotation.z=Math.PI/2; c.position.set(cx-0.12,y+0.017+i*0.03,z+0.12); G.add(c); });   // cucumbers
        pkg(G,cx-0.02,y,z+0.16,0.09,0.03,0.08,0x6fa84a,labT('ほうれん草','#eaf5df','#2f6b3a',30),2); };
      const fillFz=function(G,cx,y,z,w,d){   // frozen gyoza, edamame, fried rice, ice lollies, an ice-cream tub, an ice tray
        [['冷凍餃子',0xc9372c,-0.15,-0.12,0.06,'#ffffff'],['枝豆',0x3f8f4a,-0.02,-0.12,0.045,'#ffffff'],['炒飯',0xe8a23a,0.13,-0.12,0.05,'#ffffff'],['アイスバー',0x6fb3d9,-0.14,0.1,0.07,'#ffffff']].forEach(function(q){ pkg(G,cx+q[2],y,z+q[3],0.12,q[4],0.17,q[1],labT(q[0],'#'+q[1].toString(16).padStart(6,'0'),q[5],q[0].length>3?38:52),2); });
        (function(){ const ic=lam(0x7a4a2e,{roughness:0.4}); cyl(G,cx+0.03,y,z+0.1,0.07,0.1,0xf3e3c4); const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.073,0.073,0.012,24),[lam(0xf3e3c4),labT('アイス','#f3e3c4','#7a4a2e',50),lam(0xf3e3c4)]); lid.position.set(cx+0.03,y+0.106,z+0.1); G.add(lid); })();
        (function(){ box(G,cx+0.16,y,z+0.1,0.1,0.03,0.2,lam(0xdfeaf0,{transparent:true,opacity:0.8,roughness:0.1})); for(let i=0;i<2;i++) for(let j=0;j<4;j++) box(G,cx+0.14+i*0.04,y+0.012,z+0.03+j*0.045,0.035,0.026,0.035,clear); })(); };
      const sIce=drawer(SM[0],SM[1],x0,0,'small',fillIce), sSw=drawer(SM[0],SM[1],0,x1,'small',fillSw), vg=drawer(VG[0],VG[1],x0,x1,'veg',fillVeg), fz=drawer(FZ[0],FZ[1],x0,x1,'frz',fillFz);
      [SM[0],VG[0],VG[1],FZ[1]].forEach(function(y){ P.box(x0+0.004,x1-0.004,zf-0.051,zf-0.049,y-0.003,y+0.003,seam,oc); });   // shut lines
      const slide=function(G,dist,dur){ return stepper(dur,function(v){ G.position.z=dist*v*v*(3-2*v); }); };
      const sst=stepper(0.45,function(v){ const e=v*v*(3-2*v); sIce.position.z=0.3*e; sSw.position.z=0.3*e; }), vst=slide(vg,0.45,0.55), fst=slide(fz,0.45,0.55);
      P.anims.push(function(t){ return dst.run(t); },function(t){ return sst.run(t); },function(t){ return vst.run(t); },function(t){ return fst.run(t); });
      P.actions=[{x:0,z:zf+0.55,part:parts.doors,label:function(){ return dst.target?'關上冷藏室':'打開冷藏室（對開門）'; },act:function(){ dst.target=dst.target?0:1; }},
        {x:0,z:zf+0.5,part:parts.small,label:function(){ return sst.target?'關上製冰室・切換室':'拉開製冰室・切換室'; },act:function(){ sst.target=sst.target?0:1; }},
        {x:0,z:zf+0.5,part:parts.veg,label:function(){ return vst.target?'關上蔬果室':'拉開蔬果室'; },act:function(){ vst.target=vst.target?0:1; }},
        {x:0,z:zf+0.5,part:parts.frz,label:function(){ return fst.target?'關上冷凍室':'拉開冷凍室'; },act:function(){ fst.target=fst.target?0:1; }}];
      P.open={}; P._col(x0,x1,zb,zf,true); return P;
    };

    /* 70 x 65 cm, 1.75 m fridge, door facing +z: hollow upper compartment with food, swing door with milk in the pocket, freezer drawer that slides out */
    Catalog.fridge70=function(){
      const P=new Piece(), lam=env.lam, o={}, oc={cast:false};
      const x0=-0.35, x1=0.35, zb=-0.325, zf=0.325, T=0.035;
      const shell=M.fridge||mat('fridge',0xe6e9ec,{roughness:0.35,metalness:0.2}), liner=lam(0xf3f6f8,{roughness:0.4}), glass=lam(0xd6e6ee,{transparent:true,opacity:0.45,roughness:0.05,depthWrite:false});
      P.box(x0,x1,zb,zb+T,0,1.75,shell,o); P.box(x0,x0+T,zb,zf,0,1.75,shell,o); P.box(x1-T,x1,zb,zf,0,1.75,shell,o);
      P.rbox(x0,x1,zb,zf,1.72,1.75,0.01,shell,o); P.box(x0,x1,zb,zf,0,0.06,M.dark,oc);
      P.box(x0+T,x1-T,zb+T,zb+T+0.004,0.06,0.93,liner,oc); P.box(x0+T,x1-T,zb+T,zf-0.01,0.06,0.07,liner,oc); P.box(x0+T,x1-T,zb+T,zf-0.01,0.915,0.93,liner,oc);
      const FD=new THREE.Group(); FD.position.set(0,0,zf); P.group.add(FD);
      const fm=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; FD.add(m); return m; };
      fm(new THREE.BoxGeometry(0.692,0.86,0.03),shell,0,0.495,0); fm(new THREE.BoxGeometry(0.4,0.02,0.02),M.steel,0,0.83,0.025);
      const bw=0.58, bd=0.5, bz=-0.01-bd/2;
      fm(new THREE.BoxGeometry(bw,0.008,bd),liner,0,0.42,bz);
      [-1,1].forEach(function(sd){ fm(new THREE.BoxGeometry(0.008,0.44,bd),liner,sd*bw/2,0.64,bz); });
      fm(new THREE.BoxGeometry(bw,0.44,0.008),liner,0,0.64,bz-bd/2);
      const tag=function(txt,bg,fg){ return Catalog.pack.label(txt,bg,fg,256,128); };
      const pack=function(w,h,d,col,txt,fg,x,y,z,ry,rx){ const side=lam(col,{roughness:0.5}), top=tag(txt,'#'+col.toString(16).padStart(6,'0'),fg);
        const m=fm(new THREE.BoxGeometry(w,h,d),[side,side,top,side,side,side],x,y+h/2,z); m.rotation.y=Math.PI+(ry||0); if(rx) m.rotation.x=-rx; return m; };
      pack(0.2,0.05,0.26,0xc9372c,'冷凍餃子','#ffffff',-0.17,0.424,bz-0.08,0.1,0.25);
      pack(0.18,0.04,0.24,0x3f8f4a,'枝豆','#ffffff',-0.16,0.424,bz+0.12,-0.15);
      pack(0.18,0.045,0.24,0xe8a23a,'炒飯','#ffffff',0.04,0.424,bz+0.1,0.08);
      pack(0.16,0.06,0.2,0x6fb3d9,'冰棒','#ffffff',0.07,0.424,bz-0.13,-0.1);
      (function(){ const ic=lam(0x7a4a2e,{roughness:0.4}), lidM=tag('アイス','#f3e3c4','#7a4a2e');
        fm(new THREE.CylinderGeometry(0.075,0.065,0.11,24),ic,0.2,0.424+0.055,bz+0.1);
        const lid=fm(new THREE.CylinderGeometry(0.078,0.078,0.012,24),[lam(0xf3e3c4),lidM,lam(0xf3e3c4)],0.2,0.424+0.116,bz+0.1); lid.rotation.y=-Math.PI/2; })();
      (function(){ fm(new THREE.BoxGeometry(0.12,0.03,0.26),lam(0xdfeaf0,{transparent:true,opacity:0.8,roughness:0.1}),0.22,0.439,bz-0.14);
        for(let i=0;i<2;i++) for(let j=0;j<5;j++) fm(new THREE.BoxGeometry(0.04,0.028,0.035),lam(0xeef7fb,{transparent:true,opacity:0.75,roughness:0.05}),0.2+i*0.045,0.454,bz-0.23+j*0.045); })();
      P.box(x0+T,x1-T,zb+T,zb+T+0.004,0.93,1.72,liner,oc); P.box(x0+T,x0+T+0.004,zb+T,zf-0.01,0.93,1.72,liner,oc); P.box(x1-T-0.004,x1-T,zb+T,zf-0.01,0.93,1.72,liner,oc);
      P.box(x0+T,x1-T,zb+T,zf-0.01,0.93,0.95,liner,oc);
      [1.17,1.4].forEach(function(y){ P.box(x0+T,x1-T,zb+T,zf-0.03,y,y+0.008,glass,oc); });
      const iz=function(f){ return zb+T+0.03+f*(zf-zb-T-0.09); };
      const om=function(m){ return P.add(m,oc); };
      P.rbox(x0+T+0.01,x1-T-0.01,iz(0.0),iz(1.0),0.95,1.1,0.01,glass,oc);
      [[0.15,0.3,0x6fa84a],[0.32,0.55,0x8fc05b]].forEach(function(v){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.07,14,10),lam(v[2],{roughness:0.8})); m.scale.set(1,0.8,1); m.position.set(x0+0.06+v[0],1.02,iz(v[1])); om(m); });
      [[0.48,0.3],[0.55,0.55],[0.5,0.75]].forEach(function(v){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.035,14,10),lam(0xc23a2e,{roughness:0.4})); m.position.set(x0+v[0],0.99,iz(v[1])); om(m); });
      P.rbox(x0+0.06,x0+0.26,iz(0.35),iz(0.75),1.178,1.2,0.005,lam(0xe9e3d6,{roughness:0.7}),oc);
      for(let i=0;i<4;i++) for(let j=0;j<2;j++){ const e=new THREE.Mesh(new THREE.SphereGeometry(0.019,10,8),lam(0xf1e3cc,{roughness:0.6})); e.scale.y=1.25; e.position.set(x0+0.085+i*0.045,1.215,iz(0.45+j*0.22)); om(e); }
      [0,1,2].forEach(function(i){ P.cyl(x0+0.33+i*0.065,iz(0.6),0.028,0.024,1.178,1.24,lam(0xf7f4ee,{roughness:0.4}),oc,14); P.cyl(x0+0.33+i*0.065,iz(0.6),0.029,0.029,1.24,1.244,lam([0xd8566a,0x5f8fc9,0xf2c46b][i],{roughness:0.4}),oc,14); });
      P.rbox(x1-0.24,x1-0.06,iz(0.2),iz(0.8),1.178,1.27,0.01,lam(0xeef2f4,{transparent:true,opacity:0.7,roughness:0.2}),oc); P.rbox(x1-0.235,x1-0.065,iz(0.22),iz(0.78),1.27,1.285,0.008,lam(0x5f8fc9,{roughness:0.4}),oc);
      [[0.08,0x2b7a3a],[0.16,0x8a3a1c]].forEach(function(b){ P.cyl(x0+b[0],iz(0.4),0.035,0.035,1.408,1.65,lam(b[1],{transparent:true,opacity:0.85,roughness:0.08}),oc,16); P.cyl(x0+b[0],iz(0.4),0.014,0.014,1.65,1.7,lam(b[1]),oc,10); });
      for(let i=0;i<4;i++) P.cyl(x0+0.3+i*0.07,iz(0.55),0.033,0.033,1.408,1.53,lam([0xc9a24a,0x4a6fa5,0xc9a24a,0xd8dde2][i],{metalness:0.8,roughness:0.3}),oc,16);
      const light=new THREE.PointLight(0xeaf6ff,0,1.4,2); light.position.set(0,1.6,iz(0.4)); P.group.add(light);
      const D=new THREE.Group(); D.position.set(x1,0,zf); P.group.add(D);
      const dm=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; D.add(m); return m; };
      dm(new THREE.BoxGeometry(0.7,0.79,0.03),shell,-0.35,1.33,0); dm(new THREE.BoxGeometry(0.62,0.72,0.004),liner,-0.35,1.33,-0.017);   // flush with the freezer drawer front
      dm(new THREE.BoxGeometry(0.02,0.42,0.03),M.steel,-0.66,1.25,0.03);
      [1.03,1.3,1.55].forEach(function(y){ dm(new THREE.BoxGeometry(0.6,0.006,0.09),liner,-0.35,y,-0.06); dm(new THREE.BoxGeometry(0.6,0.06,0.006),glass,-0.35,y+0.03,-0.103); });
      const lc=document.createElement('canvas'); lc.width=128; lc.height=256; const lg=lc.getContext('2d');      // milk: Japanese 1 L gable-top carton with a printed label
      lg.fillStyle='#ffffff'; lg.fillRect(0,0,128,256); lg.fillStyle='#2f6db5'; lg.fillRect(0,180,128,76);
      lg.fillStyle='#1f3f7a'; lg.font='700 46px "Noto Sans TC","Hiragino Sans",sans-serif'; lg.textAlign='center'; lg.fillText('牛乳',64,110);
      lg.fillStyle='#2f6db5'; lg.font='500 18px sans-serif'; lg.fillText('1000ml',64,150);
      lg.fillStyle='#222'; [[24,40,10],[96,58,8],[40,200,9],[100,215,11]].forEach(function(c){ lg.beginPath(); lg.ellipse(c[0],c[1],c[2],c[2]*0.7,0.3,0,TAU); lg.fill(); });
      const lt=new THREE.CanvasTexture(lc); lt.colorSpace=THREE.SRGBColorSpace;
      const white=lam(0xffffff,{roughness:0.5}), milkM=[white,white,white,white,new THREE.MeshStandardMaterial({map:lt,roughness:0.5}),white];
      dm(new THREE.BoxGeometry(0.07,0.165,0.07),milkM,-0.2,1.03+0.006+0.0825,-0.06).rotation.y=Math.PI;
      const roof=dm(new THREE.CylinderGeometry(0.0,0.05,0.03,4,1),white,-0.2,1.03+0.006+0.165+0.015,-0.06); roof.rotation.y=Math.PI/4; roof.scale.set(1,1,0.4);
      dm(new THREE.BoxGeometry(0.07,0.012,0.004),white,-0.2,1.03+0.006+0.186,-0.06);
      [[-0.08,0xe8c84a],[-0.5,0xd9533c]].forEach(function(b){ dm(new THREE.CylinderGeometry(0.025,0.025,0.16,14),lam(b[1],{roughness:0.3}),b[0],1.3+0.006+0.08,-0.06); });
      dm(new THREE.CylinderGeometry(0.03,0.03,0.2,14),lam(0xdfe9f2,{transparent:true,opacity:0.8,roughness:0.05}),-0.33,1.03+0.006+0.1,-0.06);
      P.cols.push({x0:x0,x1:x1,z0:zb,z1:zf+0.06,kind:'f'}); env.contactShadow(x0,x1,zb,zf,0,P.group);
      P.setDoor=function(t){ const e=ease(t); D.rotation.y=(P.doorMax||1.85)*e; light.intensity=0.18*e; };   // doorMax: stop short when the hinge side is against a wall
      P.setFreezer=function(t){ FD.position.z=zf+0.42*ease(t); };
      const door=stepper(0.8,P.setDoor), frz=stepper(0.7,P.setFreezer);
      P.open={get door(){ return !!door.target; },set door(v){ door.target=v?1:0; },get freezer(){ return !!frz.target; },set freezer(v){ frz.target=v?1:0; }};
      P.anims.push(function(t){ const a=door.run(t), b=frz.run(t); return a||b; });
      P.actions=[{x:-0.22,z:zf+0.25,part:[D],label:function(){ return door.target?'關上冰箱':'打開冰箱'; },act:function(){ door.target=door.target?0:1; }},
                 {x:0.22,z:zf+0.25,part:[FD],label:function(){ return frz.target?'關上冷凍庫':'打開冷凍庫'; },act:function(){ frz.target=frz.target?0:1; }}];
      return P;
    };

    /* lift-top table: a 50 x 100 cm coffee table that rises to dining height while two leaves slide apart and a centre leaf pops up.
       Long side along z. setFold(0..1) returns {gap, half}: the footprint is 2*half wide (x) and 1.0+gap long (z). */
    Catalog.liftTable=function(){
      const P=new Piece(), G=P.group;
      const lg=function(w,h,d){ const g=new THREE.BoxGeometry(w,h,d); fitUV(g,w,h,d); return g; };
      const mkm=function(geo,mt,par){ const m=new THREE.Mesh(geo,mt); m.castShadow=true; m.receiveShadow=true; par.add(m); return m; };
      const LA=new THREE.Group(), LB=new THREE.Group(); G.add(LA); G.add(LB);
      const walnut=mat('lightOakTop',0xd9bf96,{roughness:0.45,map:M.oak.map||null}), brassL=mat('brassLeg',0xb08d57,{metalness:0.85,roughness:0.3,envMapIntensity:1});
      const half=function(sg){ const s=new THREE.Shape(), r=0.25; s.moveTo(-r,-sg*r); s.lineTo(r,-sg*r); s.lineTo(r,0); s.absarc(0,0,r,0,Math.PI*sg,sg<0); s.lineTo(-r,-sg*r);   // capsule top: two D-shaped halves with round ends
        const g=new THREE.ExtrudeGeometry(s,{depth:0.018,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.008,bevelSegments:3,curveSegments:28}); g.rotateX(-Math.PI/2); g.translate(0,-0.015,0); return g; };
      const mA=mkm(half(1),walnut,LA), mB=mkm(half(-1),walnut,LB), mC=mkm(lg(0.5,0.03,0.4),walnut,G);   // walnut capsule top, brass tapered legs
      const legs4=[]; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ const l=mkm(new THREE.CylinderGeometry(0.018,0.011,1,14),brassL,G); l.userData.c=c; legs4.push(l); });
      [[0.2,0.03,0x2f4a5c],[0.19,0.025,0xe9e3d6]].forEach(function(b,i){ mkm(new THREE.BoxGeometry(b[0],b[1],0.26),env.lam(b[2],{roughness:0.7}),LA).position.set(0.05,0.03+i*0.028,-0.1); });   // art books
      mkm(new THREE.CylinderGeometry(0.03,0.03,0.07,18),env.lam(0xf4efe6,{roughness:0.6}),LA).position.set(0.05,0.105,-0.1);    // candle
      const vase=mkm(new THREE.SphereGeometry(0.05,18,12),M.ceramic,LB); vase.scale.set(1,1.2,1); vase.position.set(-0.05,0.075,0.1);
      for(let i=0;i<3;i++){ const st=mkm(new THREE.CylinderGeometry(0.003,0.003,0.22,5),env.lam(0x5f7a45),LB); st.position.set(-0.05+(i-1)*0.02,0.22,0.1); st.rotation.z=(i-1)*0.25;
        mkm(new THREE.SphereGeometry(0.018,10,8),env.lam([0xf2b8b0,0xf7e2c8,0xe9a2a8][i],{roughness:0.7}),LB).position.set(-0.05+(i-1)*0.045,0.33,0.1); }   // flowers
      P.setFold=function(t){
        const e1=ease(t/0.5), e2=ease((t-0.35)/0.65), topY=0.40+0.32*e1, gap=0.4*e2, sx=1+0.4*e2, half=0.25*sx;
        LA.position.set(0,topY-0.015,-(0.25+gap/2)); LB.position.set(0,topY-0.015,0.25+gap/2);
        mA.scale.x=sx; mB.scale.x=sx; mC.scale.x=sx;
        const rise=ease((e2-0.55)/0.35); mC.visible=e2>0.02; mC.position.set(0,topY-0.015-0.05*(1-rise),0);
        const h=topY-0.03;
        legs4.forEach(function(l){ const c=l.userData.c; l.scale.y=h; l.position.set(c[0]*(half-0.1),h/2,c[1]*(0.5+gap/2-0.14)); });
        return {gap:gap,half:half};
      };
      P.setFold(0);
      P.cols.push({x0:-0.25,x1:0.25,z0:-0.5,z1:0.5,kind:'f'});
      const st={target:0,v:0,last:null};
      P.anims.push(function(t){ const dt=st.last===null?0:Math.min(0.05,Math.max(0,t-st.last)); st.last=t; if(st.v===st.target) return false;
        st.v=st.target>st.v?Math.min(st.target,st.v+dt/2.2):Math.max(st.target,st.v-dt/2.2); P.setFold(st.v); return true; });
      P.actions=[{x:0,z:0,label:function(){ return st.target?'降成茶几':'升成餐桌'; },act:function(){ st.target=st.target?0:1; }}];
      P.lift={get up(){ return !!st.target; },set up(v){ st.target=v?1:0; }};
      return P;
    };

    /* a pair of shoes side by side, centred on the origin */
    Catalog.shoePair=function(kind,c1,c2){
      const P=new Piece();
      [-1,1].forEach(function(sd){ const g=Catalog.shoe(kind,c1,c2); g.scale.setScalar(0.97); g.position.set(sd*0.052,0.002,sd*0.006); g.rotation.y=Math.PI/2; g.traverse(function(o){ if(o.isMesh) o.userData.detail=true; }); P.group.add(g); });
      return P;
    };

    /* ---------- cats and cat furniture. Wall pieces: origin = centre of the face on the wall, +x = into the room, mounted yb metres up ---------- */
    function catMats(){ return mats.cwood?mats:(mat('cwood',0xe2c79c,{roughness:0.55,map:M.oak&&M.oak.map||null}),mat('cdark',0x3a2616,{roughness:0.9}),mat('csisal',0xc9b48b,{roughness:1}),mats.cbed=env.fab(0xd7cfc2),mats); }
    function wallGroup(P,yb){ const G=new THREE.Group(); G.position.y=yb; P.group.add(G); return G; }
    const cadd=function(G,geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; G.add(m); return m; };
    const cbx=function(dx,dy,dz){ return new THREE.BoxGeometry(dx,dy,dz); };
    const cpanel=function(G,shape,x,th,mt){ const m=cadd(G,new THREE.ExtrudeGeometry(shape,{depth:th,bevelEnabled:false}),mt,x,0,0); m.rotation.y=Math.PI/2; return m; };
    /* sleeping tabby loaf: long body, small head resting on white paws, ringed tail; .anim(t) makes it breathe. Placed as if lying in a cat bed. */
    Catalog.catModel=function(col,white,stripe){
      const lam=env.lam, C=new THREE.Group(); C.userData.keep=true; C.position.set(0.17,0.05,0); C.rotation.y=Math.PI/2+0.35; C.scale.setScalar(0.62);
      const hx=function(c){ return '#'+('000000'+c.toString(16)).slice(-6); };
      const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const g=cv.getContext('2d');
      g.fillStyle=hx(white); g.fillRect(0,0,256,128);
      g.fillStyle=hx(col); g.beginPath(); g.moveTo(0,0); g.lineTo(256,0); for(let x=256;x>=0;x-=8) g.lineTo(x,62+Math.sin(x*0.09)*8+Math.random()*8); g.closePath(); g.fill();
      g.fillStyle=stripe; for(let i=0;i<14;i++){ const x=i*18+Math.random()*6, w=6+Math.random()*4; g.fillRect(x,0,w,52+Math.random()*18); }
      const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=THREE.RepeatWrapping;
      const tc2=document.createElement('canvas'); tc2.width=128; tc2.height=8; const tg=tc2.getContext('2d');
      tg.fillStyle=hx(col); tg.fillRect(0,0,128,8); tg.fillStyle=stripe; for(let i=0;i<8;i++) tg.fillRect(i*16+4,0,6,8);
      const ttex=new THREE.CanvasTexture(tc2); ttex.colorSpace=THREE.SRGBColorSpace;
      const fur=new THREE.MeshStandardMaterial({map:tex,roughness:1}), tailM=new THREE.MeshStandardMaterial({map:ttex,roughness:1}), furP=lam(col,{roughness:1}), wh=lam(white,{roughness:1}), pink=lam(0xe9a5a5,{roughness:0.8}), dk=lam(0x2a2018,{roughness:0.8}), sk=lam(stripe.length===7?parseInt(stripe.slice(1),16):0x444444,{roughness:1});
      const sp=function(r,mt,x,y,z,sx,sy,sz){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),mt); m.position.set(x,y,z); m.scale.set(sx||1,sy||1,sz||1); m.castShadow=true; m.receiveShadow=true; C.add(m); return m; };
      const body=sp(1,fur,0,0.09,0,0.2,0.09,0.11);
      [-1,1].forEach(function(sd){ sp(0.06,fur,-0.1,0.07,sd*0.07,1.3,1,0.9); });
      sp(0.058,furP,0.205,0.085,0,1,0.9,1.1);
      sp(0.026,wh,0.255,0.072,0,1,0.8,1.2); sp(0.008,pink,0.28,0.082,0);
      sp(0.05,wh,0.23,0.075,0,0.9,0.8,1.2);
      [-1,1].forEach(function(sd){
        const ear=new THREE.Mesh(new THREE.ConeGeometry(0.03,0.065,3),furP); ear.position.set(0.19,0.148,sd*0.034); ear.rotation.x=-sd*0.22; ear.rotation.z=-0.12; ear.castShadow=true; C.add(ear);
        const e2=new THREE.Mesh(new THREE.ConeGeometry(0.016,0.04,3),pink); e2.position.set(0.196,0.142,sd*0.033); e2.rotation.x=-sd*0.22; e2.rotation.z=-0.12; C.add(e2);
        const eg=new THREE.Group(); eg.position.set(0.248,0.098,sd*0.026); eg.rotation.y=Math.PI/2; C.add(eg);
        const eye=new THREE.Mesh(new THREE.TorusGeometry(0.011,0.0022,6,12,Math.PI),dk); eye.rotation.z=Math.PI; eg.add(eye);
        for(let k=0;k<3;k++){ const w=new THREE.Mesh(new THREE.BoxGeometry(0.0015,0.0015,0.06),lam(0xf4f2ee,{roughness:1})); w.position.set(0.268,0.07-k*0.005,sd*0.04); w.rotation.y=sd*(0.35+k*0.15); C.add(w); }
        sp(0.024,wh,0.255,0.026,sd*0.05,1.6,0.65,0.9);
      });
      [-0.014,0,0.014].forEach(function(z,i){ sp(0.01,sk,0.235,0.136-(i===1?0:0.003),z,2.2,0.3,0.4); });
      const tc=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.19,0.06,0.04),new THREE.Vector3(-0.23,0.045,0.12),new THREE.Vector3(-0.14,0.03,0.2),new THREE.Vector3(0.0,0.03,0.18),new THREE.Vector3(0.12,0.035,0.14)]);
      const tail=new THREE.Mesh(new THREE.TubeGeometry(tc,32,0.017,8,false),tailM); tail.castShadow=true; C.add(tail); sp(0.017,wh,0.12,0.035,0.14);
      return {group:C,anim:function(t){ const b=1+0.05*Math.sin(t*2.1); body.scale.y=0.09*b; C.position.y=0.05+0.002*Math.sin(t*2.1); }};
    };
    /* 咘咘 from Blender (assets/models/bubu/bubu.glb, meshopt): loaded once on first use; faces +z, origin at her feet. ?cat=old keeps the procedural rig */
    Catalog.catVersions=[{id:'latest',label:'v6 最新版（預設）',file:'bubu_v6'},{id:'m',label:'M 麻糬版（試作）',file:'bubu_mochi_p3'},{id:'5',label:'v5 白多版',file:'bubu_v5'},{id:'4',label:'v4 細毛版',file:'bubu_v4'},{id:'3',label:'v3 簡單花紋',file:'bubu_v3'},{id:'2',label:'v2 虎斑',file:'bubu_v2'},{id:'1',label:'初代 GLB',file:'bubu'},{id:'old',label:'程式拼裝版（舊）'}];   // one line per model: a new GLB goes on top as 'latest'
    Catalog.catChoice=function(){ const q=location.search, u=/[?&]cat=old\b/.test(q)?'old':/[?&]cat=mochi\b/.test(q)?'m':(q.match(/[?&]glb=(\w+)/)||[])[1]; let v=u, st=null; try{ st=localStorage.getItem('idealC.v1.catVer'); }catch(_){}
      v=v||st||'latest'; return Catalog.catVersions.some(function(c){ return c.id===v; })?v:'latest'; };
    Catalog.catMochi=function(){ return Catalog.catChoice()==='m'; };   // one rig for everything, resting included: no loaf model, no switching
    Catalog.bubuGLB=function(){
      if(!Catalog.__bubuGLB) Catalog.__bubuGLB=Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js'),import('three/addons/utils/SkeletonUtils.js')]).then(function(M){
        return new M[0].GLTFLoader().setMeshoptDecoder(M[1].MeshoptDecoder).loadAsync('assets/models/bubu/'+Catalog.catVersions.filter(function(c){ return c.id===Catalog.catChoice(); })[0].file+'.glb').then(function(g){
          g.animations.forEach(function(c){ if(!/^jump_(up|down)$/.test(c.name)) return; c.tracks.forEach(function(tr){ if(tr.name==='root.position'){ const y0=tr.values[1]; for(let i=0;i<tr.values.length;i+=3){ tr.values[i]=0; tr.values[i+1]=y0; tr.values[i+2]=0; } return; } if(tr.name!=='pelvis.position') return; for(let i=0;i<tr.values.length;i+=3){ tr.values[i]=0; tr.values[i+1]=0.176; tr.values[i+2]=-0.13; } }); });   // in place: the walkthrough flies her along the arc itself
          g.scene.traverse(function(o){ const m=o.isMesh&&o.material; if(!m||m.name!=='Bubu_Fur'||!m.map||m.userData.graded||/^(latest|5)$/.test(Catalog.catChoice())||/[?&]nograde=1\b/.test(location.search)) return; m.userData.graded=true; const im=m.map.image, cv=document.createElement('canvas'); cv.width=im.width; cv.height=im.height; const cx=cv.getContext('2d'); cx.drawImage(im,0,0);   // regrade the fur to the first loaf's colours: grey-brown saddle 5f564b, near-black stripes, warm white
            const D=cx.getImageData(0,0,cv.width,cv.height), d=D.data, sm=function(a,b,x){ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); }, ST=[68,55,46], BA=[114,100,90], WH=[244,239,232];
            for(let i=0;i<d.length;i+=4){ const r=d[i], gg=d[i+1], bb=d[i+2], L=0.2126*r+0.7152*gg+0.0722*bb, s=sm(95,140,L), w=sm(150,222,L), k=Math.min(1.35,Math.max(0.7,L/(82+30*s)));
              const rs=sm(0.4,0.56,(r-bb)/Math.max(60,r))*(1-w), RU=[148,104,68];   // the hip and tail-base rust keeps its hue
              for(let c=0;c<3;c++){ const br=(ST[c]+(BA[c]-ST[c])*s)*k, wv=WH[c]*Math.min(1.02,L/240), o=br+(wv-br)*w; d[i+c]=Math.min(255,o+(RU[c]*Math.min(1.1,k)-o)*rs*0.8); } }
            cx.putImageData(D,0,0); const t=new THREE.CanvasTexture(cv); t.flipY=false; t.colorSpace=THREE.SRGBColorSpace; t.wrapS=m.map.wrapS; t.wrapT=m.map.wrapT; t.anisotropy=env.anisotropy||4; m.map=t; });
          return {scene:g.scene,clips:g.animations,clone:M[2].clone}; }); });
      return Catalog.__bubuGLB; };
    /* 咘咘: white-and-brown-tabby cat in a loaf. Markings are painted per vertex from cat-local position (x forward, y up, z side); .anim(t) breathes, blinks, flicks ears and tail */
    Catalog.bubuModel=function(scale){
      const lam=env.lam, C=new THREE.Group(); C.userData.keep=true; C.scale.setScalar(scale||1);
      const col=function(h){ return new THREE.Color(h); }, WH=col(0xf5f3ee), CREAM=col(0xeee6d8), TB=col(0x5f564b), TD=col(0x231d18), TW=col(0x9a6a3c), PINK=col(0xf0a9b2);
      let seed=11; const rnd=function(){ seed=(seed*16807)%2147483647; return seed/2147483647; };
      const tabby=function(stripe,warm){ const c=TB.clone().lerp(TW,warm||0).lerp(TD,Math.min(1,Math.max(0,stripe))*0.85); const n=(rnd()-0.5)*0.08; c.r+=n; c.g+=n; c.b+=n; return c; };
      const white=function(y){ const c=WH.clone().lerp(CREAM,Math.max(0,0.06-y)*6); const n=(rnd()-0.5)*0.03; c.r+=n; c.g+=n; c.b+=n; return c; };
      const sm=function(a,b,x){ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
      const paint=function(geo,fn,ox,oy,oz){ const p=geo.attributes.position, c=new Float32Array(p.count*3), v=new THREE.Vector3();
        for(let i=0;i<p.count;i++){ v.set(p.getX(i)+(ox||0),p.getY(i)+(oy||0),p.getZ(i)+(oz||0)); const k=fn(v.x,v.y,v.z,i); c[i*3]=k.r; c[i*3+1]=k.g; c[i*3+2]=k.b; }
        geo.setAttribute('color',new THREE.BufferAttribute(c,3)); return geo; };
      const furM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95});
      const mesh=function(geo,mt,par){ const m=new THREE.Mesh(geo,mt||furM); m.castShadow=true; m.receiveShadow=true; (par||C).add(m); return m; };
      /* body: an ellipsoid with a flattened underside, chunky toward the rear */
      const bg=new THREE.SphereGeometry(1,128,80), bp=bg.attributes.position;
      for(let i=0;i<bp.count;i++){ let x=bp.getX(i)*0.2, y=bp.getY(i), z=bp.getZ(i)*0.135; if(y<0) y*=0.95; z*=1+Math.max(0,-x)*0.5; bp.setXYZ(i,x,0.1+y*0.1,z); }
      bg.computeVertexNormals();
      const wob=function(x,z){ return Math.sin(x*55+z*30)*0.012+Math.sin(z*70-x*20)*0.008; };
      paint(bg,function(x,y,z){
        const u=x-0.5*(y-0.2)+wob(x,z), az=Math.abs(z);                                         // bands slant down and back, as on her flanks
        const shoulder=sm(0.03,0.042,u)*(1-sm(0.13,0.145,u))*sm(0.035,0.05,y);                      // saddle from behind the white collar down each side
        const rump=(1-sm(-0.006,0.006,u))*sm(0.06,0.075,y+Math.max(0,-x-0.12)*0.25);                  // hips and the top of the thighs; the lower haunch stays white
        const k=Math.max(shoulder,rump); if(k<0.02) return white(y);
        const strp=sm(0.55,0.9,0.5+0.5*Math.sin(x*75+Math.sin(y*25)*2.2+az*8))+(az<0.025&&y>0.18?0.5:0);   // mackerel stripes down the flanks, a darker spine line
        return white(y).lerp(tabby(strp,rump>0.5?(1-sm(0.07,0.11,y))*0.8:0),k);
      });
      const body=mesh(bg);
      /* chest ruff and the tucked white front paws */
      const chest=new THREE.SphereGeometry(0.06,28,20); chest.scale(0.8,1,1.5); paint(chest,function(x,y){ return white(y); }); mesh(chest).position.set(0.15,0.1,0);
      [-1,1].forEach(function(sd){ const pg=new THREE.SphereGeometry(0.028,20,14); pg.scale(1.3,0.5,0.85); paint(pg,function(x,y){ return white(y); }); mesh(pg).position.set(0.15,0.014,sd*0.036); });
      /* tail: wraps round the right side to the front, ringed, dark tip */
      const tc=new THREE.CatmullRomCurve3([[-0.18,0.07,0.06],[-0.235,0.04,0.1],[-0.17,0.025,0.15],[-0.04,0.022,0.165],[0.08,0.025,0.15],[0.13,0.03,0.12]].map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); }));
      const tg=new THREE.TubeGeometry(tc,60,0.025,12,false), tuv=tg.attributes.uv, tps=tg.attributes.position;
      for(let i=0;i<tps.count;i++){ const a=tuv.getX(i), n=Math.floor(i/13), cen=tc.getPointAt(Math.min(1,n/60)), r=0.025*(1-0.35*a)*(a>0.96?Math.max(0.2,(1-a)*25):1); const v=new THREE.Vector3(tps.getX(i),tps.getY(i),tps.getZ(i)).sub(cen).multiplyScalar(r/0.025).add(cen); tps.setXYZ(i,v.x,v.y,v.z); }
      tg.computeVertexNormals(); paint(tg,function(x,y,z,i){ const a=tuv.getX(i); return tabby(a>0.85?1:sm(0.3,0.8,0.5+0.5*Math.sin(a*48)),a<0.12?0.5:0); });
      const tail=mesh(tg);
      /* head on its own group so it can turn; face markings in head-local coordinates */
      const H=new THREE.Group(); H.position.set(0.19,0.2,0); C.add(H);
      const hg=new THREE.SphereGeometry(0.075,96,72); hg.scale(0.95,0.88,1.1);
      paint(hg,function(x,y,z){ const az=Math.abs(z), bw=0.004+Math.max(0,0.06-y)*0.2;
        const blaze=sm(0.005,0.02,x)*(1-sm(bw-0.003,bw+0.003,az))*(1-sm(0.05,0.062,y));   // white inverted V up the forehead
        const lower=sm(-0.02,0.0,x)*(1-sm(-0.018,-0.006,y-Math.max(0,az-0.045)*0.5+(z>0?0.012:0)));   // her left cheek carries the tabby a little lower   // white cheeks, muzzle and chin
        const neck=(1-sm(-0.025,-0.005,x))*(1-sm(-0.035,-0.02,y));                         // white collar round the back of the neck
        const wk=Math.max(blaze,lower,neck);
        let st=0; if(y>0.02&&x>-0.03) st=sm(0.55,0.85,0.5+0.5*Math.sin(z*170)); if(az>0.035&&az<0.07&&y>-0.01&&y<0.02&&x>-0.03&&x<0.055) st=Math.max(st,0.9);   // forehead lines, the dark streak back from each eye
        return tabby(st,0.15).lerp(white(y),wk); });
      mesh(hg,null,H);
      [-1,1].forEach(function(sd){ const wp=new THREE.SphereGeometry(0.022,20,14); wp.scale(1,0.8,1); paint(wp,function(x,y){ return white(y); }); mesh(wp,null,H).position.set(0.056,-0.032,sd*0.016); });   // whisker pads
      const chin=new THREE.SphereGeometry(0.014,16,12); chin.scale(1,0.7,1.2); paint(chin,function(x,y){ return white(y); }); mesh(chin,null,H).position.set(0.045,-0.044,0);
      const nose=mesh(new THREE.SphereGeometry(0.0125,16,12),lam(0xf2a1ad,{roughness:0.55}),H); nose.scale.set(0.7,0.62,1.05); nose.position.set(0.074,-0.014,0);   // big pink nose
      const mouthM=lam(0xb98a8a,{roughness:0.8}); [-1,1].forEach(function(sd){ const m=mesh(new THREE.BoxGeometry(0.002,0.002,0.016),mouthM,H); m.position.set(0.07,-0.04,sd*0.008); m.rotation.y=sd*0.5; });
      /* half-closed eyes: a dark lid line over a sliver of yellow-green */
      const eyes=[]; [-1,1].forEach(function(sd){ const E=new THREE.Group(); E.position.set(0.064,0.008,sd*0.03); E.rotation.y=-sd*0.42; E.rotation.z=sd*0.08; H.add(E);
        const rim=new THREE.Mesh(new THREE.SphereGeometry(0.0135,18,12),lam(0x2a2219,{roughness:0.6})); rim.scale.set(0.35,0.3,1); E.add(rim);
        const iris=new THREE.Mesh(new THREE.SphereGeometry(0.0115,18,12),lam(0x9aa24e,{roughness:0.2,envMapIntensity:1.2})); iris.scale.set(0.38,0.15,0.85); iris.position.set(0.0012,-0.0008,0); E.add(iris);
        const pup=new THREE.Mesh(new THREE.SphereGeometry(0.004,10,8),lam(0x10100e,{roughness:0.2})); pup.scale.set(0.5,0.4,0.6); pup.position.set(0.0042,-0.0008,0); E.add(pup); eyes.push(E); });
      /* ears: brown tabby outside, pink inside, a little white tuft */
      const ears=[]; [-1,1].forEach(function(sd){ const Eg=new THREE.Group(); Eg.position.set(-0.008,0.054,sd*0.046); Eg.rotation.x=-sd*0.32; Eg.rotation.y=-sd*0.25; H.add(Eg);
        const eg=new THREE.ConeGeometry(0.03,0.056,16,1,true); eg.scale(0.45,1,1); eg.translate(0,0.024,0); paint(eg,function(x,y){ return tabby(y>0.05?0.75:0.35,0.25); });
        const em=mesh(eg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95,side:THREE.DoubleSide}),Eg);
        const ig=new THREE.ConeGeometry(0.02,0.04,12); ig.scale(0.25,1,1); const im=mesh(ig,lam(0xeab0b6,{roughness:0.8}),Eg); im.position.set(0.006,0.02,0);
        ears.push(Eg); });
      const whM=lam(0xfbfbf8,{roughness:0.6}); [-1,1].forEach(function(sd){ for(let k=0;k<4;k++){ const w=new THREE.Mesh(new THREE.CylinderGeometry(0.0006,0.0003,0.075,4),whM); w.rotation.x=Math.PI/2; w.rotation.y=sd*(0.25+k*0.1); w.rotation.z=-0.1+k*0.07; w.position.set(0.062,-0.03-k*0.004,sd*0.045); H.add(w); } });
      let blink=2;
      return {group:C,head:H,anim:function(t){ const b=1+0.035*Math.sin(t*1.9); body.scale.set(1,b,1+0.02*Math.sin(t*1.9));
        H.rotation.y=Math.sin(t*0.23)*0.18; H.rotation.z=Math.sin(t*0.17)*0.05;                                                   // slow look around
        const bk=(t%6.5)<0.18?0.1:1; eyes.forEach(function(e){ e.scale.y=bk; });                                                      // a slow blink every few seconds
        ears.forEach(function(e,i){ e.rotation.z=((t+i*3.1)%9<0.25)?0.35:0; });
        tail.rotation.y=Math.sin(t*0.9)*0.025; }};
    };
    /* 咘咘, rigged: one skinned torso over hip, mid, chest and neck bones, a head with cheeks and whisker pads, four 3-joint legs (a hock on the hind ones), an 8-segment tail.
       Fur is painted into canvas textures from the rest pose (x forward, y up, +z her right); vertex colours add soft shading underneath. .play(name) runs an action, .anim(t) the idle */
    Catalog.bubuRig=function(scale,opt){
      opt=opt||{}; const C=new THREE.Group(); C.userData.keep=true; C.scale.setScalar(scale||1);
      const Y0=0.215, V3=function(x,y,z){ return new THREE.Vector3(x,y,z); };
      const sm=function(a,b,x){ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
      const hash=function(i,j){ let h=(Math.imul(i,374761393)+Math.imul(j,668265263))|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
      const vn=function(x,y){ const i=Math.floor(x), j=Math.floor(y), fx=x-i, fy=y-j, u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy), a=hash(i,j), b=hash(i+1,j), c=hash(i,j+1), d=hash(i+1,j+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; };
      const TS=[0.137,0.114,0.094], TD=TS, EC=function(h){ return new THREE.Color(h); }, eWH=EC(0xf5f3ee), eCR=EC(0xeee6d8), eTB=EC(0x5f564b), eTD=EC(0x231d18), eTW=EC(0x9a6a3c), ec=new THREE.Color(), so={};   // the very first 咘咘's colours (91c57ff), mixed in linear light as that model did
      const mix=function(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; };
      const stripe=function(ph){ return sm(0.66,0.93,0.5+0.5*Math.sin(ph)); };
      const srgb=function(c,j){ c.r+=j; c.g+=j; c.b+=j; c.getRGB(so,THREE.SRGBColorSpace); return [so.r,so.g,so.b]; };
      const tabby=function(st,warm,n){ return srgb(ec.copy(eTB).lerp(eTW,Math.min(1,warm||0)).lerp(eTD,Math.min(1,Math.max(0,st))*0.85),(n-0.5)*0.08); };   // warm 0 grey-brown, 1 rust
      const white=function(dn,n){ return srgb(ec.copy(eWH).lerp(eCR,Math.min(1,dn)),(n-0.5)*0.03); };
      const TX=Catalog.__bubuTex4||(Catalog.__bubuTex4={});   // painted once, shared by every 咘咘
      const paintTex=function(key,W,H,fn){ if(TX[key]) return TX[key]; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d'), im=g.createImageData(W,H), d=im.data;
        for(let j=0;j<H;j++) for(let i=0;i<W;i++){ const n=0.6*hash(i>>2,j)+0.4*hash(i+7,j>>1), k=fn((i+0.5)/W,1-(j+0.5)/H,n), o=(j*W+i)*4; d[o]=k[0]*255; d[o+1]=k[1]*255; d[o+2]=k[2]*255; d[o+3]=255; }
        g.putImageData(im,0,0); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy||4; return TX[key]=t; };
      const furMat=function(map,o){ return new THREE.MeshStandardMaterial(Object.assign({map:map,roughness:0.95,metalness:0,vertexColors:true},o||{})); };
      const paintVerts=function(geo,fn){ const p=geo.attributes.position, cl=new Float32Array(p.count*3), c=new THREE.Color(); for(let i=0;i<p.count;i++){ const k=fn(p.getX(i),p.getY(i),p.getZ(i)); c.setRGB(k[0],k[1],k[2],THREE.SRGBColorSpace); cl[i*3]=c.r; cl[i*3+1]=c.g; cl[i*3+2]=c.b; } geo.setAttribute('color',new THREE.BufferAttribute(cl,3)); return geo; };
      const ao=function(k){ k*=0.5; return [1-0.9*k,1-k,1-1.15*k]; };   // a warm grey for shaded fur
      const grp=function(par,x,y,z){ const g=new THREE.Group(); g.position.set(x,y,z); par.add(g); return g; };
      const mesh=function(par,geo,mt,x,y,z,ns){ const m=new THREE.Mesh(geo,mt); m.position.set(x||0,y||0,z||0); m.castShadow=!ns; m.receiveShadow=true; par.add(m); return m; };
      const ell=function(r,w,h){ const g=new THREE.SphereGeometry(1,w||32,h||22); g.scale(r[0],r[1],r[2]); return g; };
      const shaded=function(geo,fn){ return paintVerts(geo,fn?function(x,y,z){ return ao(fn(x,y,z)); }:function(){ return [1,1,1]; }); };
      const paintEll=function(par,key,r,o,fn,W,H,sh){ const t=paintTex(key,W||128,H||64,function(u,v,n){ const ph=u*Math.PI*2, th=(1-v)*Math.PI; return fn(-Math.cos(ph)*Math.sin(th)*r[0]+o[0],Math.cos(th)*r[1]+o[1],Math.sin(ph)*Math.sin(th)*r[2]+o[2],n); });
        return mesh(par,shaded(ell(r),sh&&function(x,y,z){ return sh(x+o[0],y+o[1],z+o[2]); }),furMat(t),o[0],o[1],o[2]); };
      const furW=furMat(paintTex('w',128,64,function(u,v,n){ return white(0,n); })), furV=furMat(paintTex('n',64,64,function(u,v,n){ return [0.93+0.08*n,0.93+0.08*n,0.93+0.08*n]; })), pink=env.lam(0xe8a2aa,{roughness:0.5,envMapIntensity:0.3});
      const R=grp(C,0,Y0,0), hips=grp(R,-0.08,0,0), mid=grp(hips,0.08,0,0), chest=grp(mid,0.08,0,0), neck=grp(chest,0.045,0.03,0), head=grp(neck,0.025,0.035,0); head.scale.setScalar(1.15);
      /* torso: a tube along a spine curve that rises into a short neck with a fluffy front, skinned to the four bones */
      const SP=new THREE.CatmullRomCurve3([V3(-0.19,0.012,0),V3(-0.125,0.008,0),V3(-0.04,0,0),V3(0.05,0.002,0),V3(0.105,0.022,0),V3(0.122,0.046,0),V3(0.13,0.066,0)]);
      const PROF=[[0,0.062,0.066,0.068],[0.16,0.072,0.08,0.08],[0.36,0.073,0.084,0.084],[0.56,0.074,0.088,0.084],[0.74,0.06,0.074,0.072],[0.88,0.05,0.056,0.055],[1,0.046,0.046,0.048]];   // a 4 kg, slightly chubby girl: wide hips and a soft low belly   // u, radius up, down, sideways
      const prof=function(u){ let i=0; while(i<PROF.length-2&&u>PROF[i+1][0]) i++; const a=PROF[i], b=PROF[i+1], t=sm(0,1,(u-a[0])/(b[0]-a[0])); return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t]; };
      const cap=function(s){ s=Math.min(1,s); return Math.sqrt(1-(1-s)*(1-s)); };
      const tubeAt=function(u,a,pz){ const P=SP.getPointAt(u), T=SP.getTangentAt(u), r=prof(u), k=cap(u/0.2)*cap((1-u)/0.07), ca=Math.cos(a), aa=Math.abs(a), fl=sm(0.5,1.3,aa)*(1-sm(2.3,2.9,aa)), bz=(1+(0.12*Math.exp(-Math.pow((P.x+0.105)/0.045,2))+0.08*Math.exp(-Math.pow((P.x-0.09)/0.035,2)))*fl)*(1-0.2*sm(1.9,3.0,aa));   // haunch and shoulder swell, tucking in toward the underside
        const pouch=1+(pz||0)*0.16*Math.exp(-Math.pow((P.x+0.085)/0.055,2))*sm(2.2,3.1,aa);   // the soft primordial pouch between the hind legs (a morph: shown standing, tucked in a loaf)
        return P.add(V3(-T.y,T.x,0).multiplyScalar((ca>0?r[0]:r[1]*pouch)*ca*k)).add(V3(0,0,r[2]*bz*Math.sin(a)*k)); };
      /* her markings: a greyer saddle over the shoulders running further down her right side, a rump patch with a rust centre, tabby up the nape; soft broken mackerel stripes inside */
      const bodyPaint=function(x,u,a,n){ const xe=-0.2+(x+0.19)*1.25, ye=0.1+0.1*Math.cos(a), ze=Math.sin(a)*0.135*(1+Math.max(0,-xe)*0.5), az=Math.abs(ze), w=white(Math.max(0,0.06-ye)*6,n);   // painted in the first model's loaf coordinates, so the patches land where they did there
        const ue=xe-0.5*(ye-0.2)+Math.sin(xe*55+ze*30)*0.012+Math.sin(ze*70-xe*20)*0.008, sad=sm(0.03,0.042,ue)*(1-sm(0.13,0.145,ue))*sm(0.035,0.05,ye), rump=(1-sm(-0.006,0.006,ue))*sm(0.06,0.075,ye+Math.max(0,-xe-0.12)*0.25+0.022*Math.exp(-Math.pow((xe+0.1)/0.07,2))), k=Math.max(sad,rump);   // the tabby reaches a little further down over the haunch than on the first model
        if(k<0.02) return w; const st=sm(0.55,0.9,0.5+0.5*Math.sin(xe*75+Math.sin(ye*25)*2.2+az*8))+(az<0.025&&ye>0.18?0.5:0);
        return mix(w,tabby(st,rump>0.5?(1-sm(0.07,0.11,ye))*0.8:0,n),k); };
      const NU=56, NA=32, pos=[], uv=[], si=[], sw=[], idx=[], cl=[], mph=[], mph2=[], tc=new THREE.Color();
      for(let i=0;i<=NU;i++){ const u=(1-Math.cos(Math.PI*i/NU))/2, cx=SP.getPointAt(u).x, wn=sm(0.8,0.93,u), t1=sm(-0.035,0.035,cx), t2=sm(0.045,0.11,cx), w=[(1-t1)*(1-wn),t1*(1-t2)*(1-wn),t1*t2*(1-wn),wn];
        for(let j=0;j<=NA;j++){ const a=Math.PI+2*Math.PI*j/NA, p=tubeAt(u,a), q=tubeAt(u,a,1), aa=Math.abs(Math.atan2(Math.sin(a),Math.cos(a))), k=(0.3*sm(1.7,3.0,aa)+0.1*sm(1.2,2.2,aa))*(1-0.65*sm(0.68,0.88,u)), s=ao(k);   // darker belly and throat
          const hb=0.03*Math.exp(-Math.pow((p.x+0.14)/0.05,2))*sm(0.9,1.7,aa)*(1-sm(2.5,3.0,aa));   // haunch morph: the folded thighs filling out the hips when she sits
          pos.push(p.x,p.y,p.z); mph.push(q.x-p.x,q.y-p.y,q.z-p.z); mph2.push(0.2*hb,-0.35*hb,Math.sign(Math.sin(a))*hb); uv.push(u,j/NA); si.push(0,1,2,3); sw.push(w[0],w[1],w[2],w[3]); tc.setRGB(s[0],s[1],s[2],THREE.SRGBColorSpace); cl.push(tc.r,tc.g,tc.b); } }
      for(let i=0;i<NU;i++) for(let j=0;j<NA;j++){ const a=i*(NA+1)+j, b=a+NA+1; idx.push(a,a+1,b,b,a+1,b+1); }
      const tg=new THREE.BufferGeometry(); tg.setIndex(idx); tg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); tg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); tg.setAttribute('color',new THREE.Float32BufferAttribute(cl,3)); tg.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4)); tg.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4)); tg.morphAttributes.position=[new THREE.Float32BufferAttribute(mph,3),new THREE.Float32BufferAttribute(mph2,3)]; tg.morphTargetsRelative=true; tg.computeVertexNormals();
      const nr=tg.attributes.normal; for(let i=0;i<=NU;i++){ const a=i*(NA+1), b=a+NA, v=V3(nr.getX(a)+nr.getX(b),nr.getY(a)+nr.getY(b),nr.getZ(a)+nr.getZ(b)).normalize(); nr.setXYZ(a,v.x,v.y,v.z); nr.setXYZ(b,v.x,v.y,v.z); } for(let j=0;j<=NA;j++) nr.setXYZ(j,-1,0,0);   // close the belly seam, round the rump pole
      const cxs=[]; for(let i=0;i<512;i++) cxs.push(SP.getPointAt((i+0.5)/512).x);
      const torso=new THREE.SkinnedMesh(tg,furMat(paintTex('torso',512,256,function(u,v,n){ let a=Math.PI+2*Math.PI*v; if(a>Math.PI) a-=2*Math.PI; return bodyPaint(cxs[Math.min(511,Math.floor(u*512))],u,a,n); })));
      torso.castShadow=true; torso.receiveShadow=true; torso.frustumCulled=false; R.add(torso);
      const bones=[hips,mid,chest,neck].map(function(g){ const b=new THREE.Bone(); g.add(b); return b; }); C.updateMatrixWorld(true); torso.bind(new THREE.Skeleton(bones));
      /* head: golden tabby cap with fine forehead lines and a white blaze, the cap just above her right eye and down round her left eye to the cheek, white whisker pads and chin */
      const HR=[0.052,0.05,0.058];
      const headPaint=function(x,y,z,n){ const az=Math.abs(z), jit=(n-0.5)*0.003;
        const rag=0.005*(vn(x*140+9,z*140)-0.5)+0.0025*Math.sin(z*260+x*90), capY=(z<0?-0.026+Math.max(0,0.02-az)*0.9:0.0015+Math.max(0,0.02-az)*0.5)-Math.max(0,0.005-x)*1.4+rag, bw=0.0065+Math.max(0,0.032-y)*0.32;   // the cap encloses both eyes, lower down her left cheek
        let k=sm(-0.002,0.002,y-capY+jit); k*=1-sm(0.012,0.022,x)*(1-sm(bw-0.0015,bw+0.0015,az+jit*0.5)); k*=1-sm(0.034,0.042,x)*(1-sm(-0.008,-0.002,y));
        const ld=Math.abs(y-0.0155-(az-0.034)*0.3), liner=sm(0.0024,0.0008,ld)*sm(0.031,0.035,az)*(1-sm(0.044,0.049,az))*sm(0.015,0.025,x);   // faint liner trailing from the outer eye corners
        if(k<0.01) return mix(white(0,n),TS,0.45*liner);
        const s1=stripe(z*2*Math.PI/0.0055+Math.sin(x*80)*0.5+Math.abs(z)*120*sm(0.0,0.03,x)), s2=stripe(y*2*Math.PI/0.006+x*30), st=(s1+(s2-s1)*sm(0.02,0.038,az))*sm(0.3,0.65,vn(x*140+3,y*140+z*140))*(0.4+0.6*sm(0.012,0.04,x));
        return mix(mix(white(0,n),tabby(st,0.15,n),k),TS,0.5*liner); };
      const sk=paintEll(head,'skull',HR,[0,0,0],headPaint,512,256,function(x,y){ return 0.24*sm(-0.022,-0.046,y); }).geometry, sp=sk.attributes.position; for(let i=0;i<sp.count;i++){ const x=sp.getX(i), y=sp.getY(i), z=sp.getZ(i); sp.setZ(i,z*(1+0.2*Math.exp(-Math.pow((y+0.014)/0.02,2))*sm(-0.035,0.0,x))); sp.setY(i,y-0.14*Math.max(0,y-0.016)); sp.setX(i,x+0.0035*Math.exp(-Math.pow((y-0.024)/0.006,2))*sm(0.02,0.04,x)*sm(0.006,0.014,Math.abs(z))*(1-sm(0.03,0.04,Math.abs(z)))); } sk.computeVertexNormals();   // wide cheeks, a flatter crown, a soft brow over each eye
      const muz=paintEll(head,'muzzle',[0.017,0.0145,0.021],[0.034,-0.0135,0],headPaint,128,64,function(x,y){ return 0.15*sm(-0.02,-0.028,y); }).geometry, mp=muz.attributes.position; for(let i=0;i<mp.count;i++){ const x=mp.getX(i), y=mp.getY(i), z=mp.getZ(i), lo=sm(0.002,-0.01,y); mp.setX(i,x-0.004*Math.exp(-Math.pow(z/0.003,2))*sm(0.0,0.012,x)*lo); mp.setZ(i,z*(1+0.12*lo*sm(0.004,0.014,Math.abs(z)))); } muz.computeVertexNormals();   // one muzzle, a soft crease down the middle
      const chin=paintEll(head,'chin',[0.01,0.0065,0.011],[0.033,-0.03,0],headPaint,64,32,function(x,y){ return 0.18*sm(-0.03,-0.036,y); });
      const ns=new THREE.Shape(); ns.moveTo(-0.0075,0.0028); ns.quadraticCurveTo(0,0.0052,0.0075,0.0028); ns.quadraticCurveTo(0.007,0,0.0012,-0.0048); ns.quadraticCurveTo(0,-0.0058,-0.0012,-0.0048); ns.quadraticCurveTo(-0.007,0,-0.0075,0.0028);
      const ng=new THREE.ExtrudeGeometry(ns,{depth:0.002,bevelEnabled:true,bevelThickness:0.0015,bevelSize:0.001,bevelSegments:3,curveSegments:6}); ng.scale(0.95,0.9,1); ng.rotateY(Math.PI/2); ng.rotateZ(0.35); mesh(head,ng,env.lam(0xe9a3a8,{roughness:0.55,envMapIntensity:0.3}),0.0505,-0.004,0,true);
      const mouth=mesh(head,ell([0.008,0.012,0.012],14,10),env.lam(0x6e3036,{roughness:0.7}),0.047,-0.03,0,true), tongue=mesh(head,ell([0.008,0.0025,0.0055],12,8),env.lam(0xe38d98,{roughness:0.45}),0.05,-0.029,0,true);
      /* eyes: almond slits on the skull surface, squinting; the group's y scale opens and closes them */
      const almond=function(w,h){ const s=new THREE.Shape(); s.moveTo(-w/2,0); s.quadraticCurveTo(0,h,w/2,0); s.quadraticCurveTo(0,-h,-w/2,0); return new THREE.ShapeGeometry(s,12); };
      const rimM=env.lam(0x1d1611,{roughness:0.55}), irisM=env.lam(0xb0a648,{roughness:0.2,envMapIntensity:0.8}), pupM=env.lam(0x070605,{roughness:0.2});
      const eyes=[-1,1].map(function(sd){ const y=0.013, z=sd*0.024, x=HR[0]*Math.sqrt(1-Math.pow(y/HR[1],2)-Math.pow(z/HR[2],2)), nrm=V3(x/HR[0]/HR[0],y/HR[1]/HR[1],z/HR[2]/HR[2]).normalize(), xa=V3(0,1,0).cross(nrm).normalize(), ya=nrm.clone().cross(xa);
        const g=new THREE.Group(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa,ya,nrm)).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0,0,1),-sd*0.1)); g.position.set(x,y,z).addScaledVector(nrm,0.0012); head.add(g);
        const s=grp(g,0,0,0); mesh(s,almond(0.022,0.012),rimM,0,0,0,true); const iris=mesh(s,almond(0.017,0.0095),irisM,0,0,0.0003,true), pg=new THREE.CircleGeometry(1,16); pg.scale(0.0018,0.0045,1); mesh(iris,pg,pupM,0,0,0.0003,true); return {s:s,iris:iris}; });
      /* ears: cupped shells rounded at the tip, tabby outside, pink skin inside with a few white tufts */
      const earPts=[[0.027,0],[0.026,0.011],[0.023,0.023],[0.017,0.034],[0.01,0.042],[0.004,0.0465],[0,0.0475]].map(function(p){ return new THREE.Vector2(p[0]*0.85,p[1]*0.85); });
      const earOutM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,envMapIntensity:0.25,side:THREE.DoubleSide}), earInM=env.lam(0xf7d5d6,{roughness:0.9,emissive:0x2a1416,side:THREE.BackSide}), tuftM=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.9});
      const ears=[-1,1].map(function(sd){ const E=grp(head,0.002,0.036,sd*0.027); E.rotation.set(sd*0.3,-sd*0.3,0.06);
        const og=new THREE.LatheGeometry(earPts,16,Math.PI*0.95,Math.PI*1.1); og.scale(0.42,1,1); paintVerts(og,function(x,y){ return tabby(0.35,0.25,0.5).map(function(v){ return v*(1-0.25*sm(0.034,0.044,y)); }); }); mesh(E,og,earOutM);
        const ig=new THREE.LatheGeometry(earPts,16,Math.PI*1.0,Math.PI*1.0); ig.scale(0.4,0.94,0.9); mesh(E,ig,earInM,0.0012,0.0008,0);
        const tf=[]; for(let k=0;k<6;k++){ const zz=(k-2.5)*0.004, ze=(k<3?-1:1)*0.0105; tf.push(0.003,0.003,ze*0.9,0.0105,0.016+k%2*0.005,ze+zz*0.3); } const tg2=new THREE.BufferGeometry(); tg2.setAttribute('position',new THREE.Float32BufferAttribute(tf,3)); E.add(new THREE.LineSegments(tg2,tuftM)); return E; });
      const wg=[]; [-1,1].forEach(function(sd){ [[0.2,0.05],[0.06,0.054],[-0.08,0.052],[-0.22,0.048],[-0.34,0.042]].forEach(function(w,k){ const o=V3(0.054,-0.019-k*0.0015,sd*0.02), d=V3(0.25,Math.sin(w[0]),sd).normalize(); let pv=o.clone();
        for(let s=1;s<=8;s++){ const f=s/8, p=o.clone().addScaledVector(d,w[1]*f); p.y-=0.016*f*f; p.x-=0.01*f*f; wg.push(pv.x,pv.y,pv.z,p.x,p.y,p.z); pv=p; } }); });
      const wgeo=new THREE.BufferGeometry(); wgeo.setAttribute('position',new THREE.Float32BufferAttribute(wg,3)); head.add(new THREE.LineSegments(wgeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.45})));   // whiskers stay one pixel wide at any distance
      /* legs: a short upper arm inside the chest, a slim forearm, haunches tapering to a bent hock; rounded paws with toes; shaded where they meet the body */
      const bend=function(g,f){ const pa=g.attributes.position; for(let i=0;i<pa.count;i++) pa.setX(i,pa.getX(i)+f(pa.getY(i))); return g; };   // normals kept: recomputing would crease the lathe seam
      const lathe=function(pts,top){ return shaded(new THREE.LatheGeometry(pts.map(function(p){ return new THREE.Vector2(p[0],p[1]); }),20),function(x,y){ return 0.05+(top===null?0:0.12*sm(top-0.03,top,y)); }); };   // joints share one radius so the segments read as one limb
      const FL1=0.055, FL2=0.075, HL1=0.075, HL2=0.075, HL3=0.06;
      const paw=function(g,dx){ mesh(g,shaded(ell([0.018,0.0105,0.0155],20,12),function(){ return 0.1; }),furW,0.007+dx,-0.0085,0); [-1,0,1].forEach(function(t){ mesh(g,shaded(ell([0.0065,0.0056,0.006],10,8),function(){ return 0.12; }),furW,0.019+dx-Math.abs(t)*0.003,-0.0105,t*0.0088); }); mesh(g,ell([0.01,0.0025,0.0085],12,6),pink,0.008+dx,-0.018,0); };
      const fLeg=function(sd){ const u=grp(chest,0.014,-0.05,sd*0.027), l=grp(u,0,-FL1,0), pw=grp(l,0,-FL2,0);
        mesh(u,lathe([[0,-FL1-0.03],[0.011,-FL1-0.025],[0.0155,-FL1],[0.02,-FL1*0.6],[0.027,-FL1*0.25],[0.034,0],[0.036,0.02],[0.028,0.042],[0,0.05]],null).scale(1.2,1,0.85),furW);   // widens into the chest; its end hides inside the forearm
        mesh(l,lathe([[0,-FL2-0.012],[0.0085,-FL2-0.0085],[0.012,-FL2],[0.0125,-FL2*0.85],[0.0145,-FL2*0.5],[0.0178,-FL2*0.15],[0.0195,0],[0.014,0.016],[0,0.02]],null).scale(1.2,1,1.15),furW); paw(pw,0); return [u,l,pw]; };
      const hLeg=function(sd){ const u=grp(hips,-0.02,-0.02,sd*0.04), l=grp(u,0,-HL1,0), m=grp(l,0,-HL2,0);
        mesh(u,bend(lathe([[0,-HL1-0.028],[0.013,-HL1-0.023],[0.019,-HL1],[0.026,-HL1*0.75],[0.036,-HL1*0.45],[0.044,-HL1*0.15],[0.048,0.012],[0.046,0.03],[0.032,0.045],[0,0.052]],null).scale(1.15,1,0.75),function(y){ return 0.006*Math.exp(-Math.pow((y+HL1*0.4)/0.03,2)); }),furW);   // the upper leg widens up into the hip, inside the body outline
        mesh(l,bend(lathe([[0,-HL2-0.012],[0.0085,-HL2-0.0085],[0.012,-HL2],[0.0125,-HL2*0.85],[0.016,-HL2*0.45],[0.021,-HL2*0.1],[0.023,0],[0.016,0.016],[0,0.023]],null).scale(1.2,1,1.15),function(y){ return -0.004*Math.exp(-Math.pow((y+HL2*0.3)/0.025,2)); }),furW);   // calf behind the shin
        mesh(m,lathe([[0,-HL3-0.006],[0.008,-HL3-0.001],[0.0088,-HL3*0.6],[0.0098,-HL3*0.2],[0.0125,0],[0.0088,0.0088],[0,0.0125]],null).scale(1.15,1,1.1),furW); const pg=grp(m,0,-HL3,0); paw(pg,0.004); u.userData.paw=pg; return [u,l,m]; };
      const LEG={fl:fLeg(-1),fr:fLeg(1),hl:hLeg(-1),hr:hLeg(1)};
      (function(){ C.updateMatrixWorld(true); const Ri=new THREE.Matrix4().copy(R.matrixWorld).invert(), m4=new THREE.Matrix4(), v=new THREE.Vector3(), c=new THREE.Color(), sp=[]; for(let i=0;i<=64;i++) sp.push(SP.getPointAt(i/64));   // legs carry the body's own fur: painted from where each point sits around the torso at rest, so the colours run on across the join
        const ys=function(x){ let q=sp[0]; sp.forEach(function(o){ if(Math.abs(o.x-x)<Math.abs(q.x-x)) q=o; }); return q.y; };
        ['fl','fr','hl','hr'].forEach(function(k){ LEG[k][0].traverse(function(o){ if(!o.isMesh||o.material===pink) return; m4.multiplyMatrices(Ri,o.matrixWorld); const pa=o.geometry.attributes.position, cl=new Float32Array(pa.count*3);
          for(let i=0;i<pa.count;i++){ v.fromBufferAttribute(pa,i).applyMatrix4(m4); const a=Math.atan2(v.z,v.y-ys(v.x)), aa=Math.abs(a), s2=ao(0.5*(0.3*sm(1.7,3.0,aa)+0.1*sm(1.2,2.2,aa))), col=bodyPaint(v.x,0,a,hash(i,o.id)); c.setRGB(col[0]*s2[0],col[1]*s2[1],col[2]*s2[2],THREE.SRGBColorSpace); cl[i*3]=c.r; cl[i*3+1]=c.g; cl[i*3+2]=c.b; }
          o.geometry.setAttribute('color',new THREE.BufferAttribute(cl,3)); o.material=furV; }); }); })();
      /* tail: 8 thick fluffy capsules tapering gently, ringed tabby, a dark tip */
      const TL=0.039, TR=function(d){ const f=d/(8*TL); return 0.0205-0.004*f-0.0025*sm(0.85,1.0,f); };   // almost even, a blunt furry tip
      const furTail=furMat(paintTex('tailFur',256,256,function(u,v,n){ const k=0.9+0.1*n; return [k,k,k]; }),{envMapIntensity:0.35}), tail=[]; let tp=grp(hips,-0.1,0.03,0); for(let i=0;i<8;i++){ const r=TR(i*TL), L=TL, g=i?grp(tp,-L,0,0):tp, cg=new THREE.CapsuleGeometry(r,L,4,16,6); cg.rotateZ(Math.PI/2); cg.translate(-L/2,0,0);
        const cp=cg.attributes.position; for(let k=0;k<cp.count;k++){ const x=cp.getX(k), y=cp.getY(k), z=cp.getZ(k), d=Math.min(8*TL,Math.max(0,i*L-x)), an=Math.atan2(z,y), fz=1+0.07*(vn(d*260,an*2.2+i*3)-0.5), s=TR(d)/r*fz; cp.setXYZ(k,x,y*s,z*s); } cg.computeVertexNormals();   // fluffy outline
        paintVerts(cg,function(x,y,z){ const xl=Math.min(1,Math.max(0,-x/L)), ring=1-sm(0.1,0.3,Math.abs(xl-0.55)); return tabby(i>=7?1:i===6?Math.max(ring,sm(0.6,1,xl)):0.85*ring,i<1?0.5:0,0.5).map(function(v){ return v*(1-0.08*sm(0,-0.02,y)); }); }); mesh(g,cg,furTail); tail.push(g); tp=g; }
      const OLD=Catalog.bubuModel(0.9); OLD.group.visible=false; C.add(OLD.group);   // her loaf is the first model itself (91c57ff); the rig takes over once she gets up
      /* poses: joint values, missing keys fall back to the stand pose */
      const POSE={
        stand:{y:Y0-0.002,len:0.88,rz:-0.07,fad:0.07,fl:[0.09,-0.05,0.0],fr:[0.09,-0.05,0.0],hl:[0.38,-0.95,0.62],hr:[0.38,-0.95,0.62],nk:-0.55,hz:0.4,tb:0.75,tc:-0.05},   // a level barrel on straight legs, head forward at shoulder height
        loaf:{old:1,hide:1,wid:0.3,y:0.088,rz:0,len:0.82,dome:0.35,chs:0.08,spM:0.1,spC:-0.4,fad:-0.05,fl:[-1.5,3.1,-1.6],fr:[-1.5,3.1,-1.6],hl:[1.0,-2.44,3.01],hr:[1.0,-2.44,3.01],nk:1.1,hz:-0.6,tb:0.32,tc:0.02,ts:0.3},
        sit:{y:0.197,npz:1,hch:1,len:0.7,rz:1.2,spM:-0.2,spC:-0.3,fdx:-0.05,fdy:0.014,fad:0.12,fl:[-0.72,0,0],fr:[-0.72,0,0],hl:[0.15,-2.25,2.45],hr:[0.15,-2.25,2.45],nk:-0.3,hz:-0.55,tb:-1.1,tc:0.02,ts:0.52},   // upright on her haunches, front legs straight down, tail round her feet
        stretch:{y:0.15,rz:-0.4,spC:-0.15,fl:[1.6,0.2,-1.4],fr:[1.6,0.2,-1.4],hl:[1.0,-1.4,0.8],hr:[1.0,-1.4,0.8],nk:0.25,hz:0.25,tb:0.15,tc:0.1},
        arch:{y:Y0-0.015,spM:0.3,spC:-0.3,nk:-0.3,hz:-0.1,fl:[0.15,0,-0.15],fr:[0.15,0,-0.15],hl:[0.4,-1.2,0.8],hr:[0.4,-1.2,0.8],tb:-0.75,tc:0.14},
        belly:{y:0.099,rx:1.75,hsp:0.35,fad:0.35,frx:-0.75,hrx:-0.25,fl:[1.1,-1.3,-0.3],fr:[0.8,-1.0,-0.3],hl:[1.3,-1.2,0.8],hr:[1.1,-1.0,0.7],hx:-1.3,hz:0.2,hy:0.2,tb:0.1,tc:0.05,ts:0.1},   // flopped on her side, legs loose
        curl:{y:0.08,rx:-1.45,spM:-1.9,spC:-1.8,len:0.85,nk:-0.2,hx:1.2,hz:-0.1,hy:0,fad:-0.8,frx:1.2,hsp:0.12,hrx:0.25,fl:[1.7,1.65,-1.5],fr:[1.5,1.35,-1.5],hl:[1.7,-2.1,1.9],hr:[1.8,-2.3,2.0],tb:1.6,tc:0.35,blink:1},
        love:{y:Y0,nk:0.1,tb:-1.15,tc:0.06,tcurl:0.9,ts:0.25,ear:0.25},
        leap:{y:Y0+0.01,rz:-0.12,len:1.0,fl:[1.25,-0.2,-0.5],fr:[1.25,-0.2,-0.5],hl:[-0.35,-0.5,0.7],hr:[-0.35,-0.5,0.7],nk:0.2,hz:0.1,tb:0.35,tc:0.05,ear:0.2},
        prep:{y:Y0*0.72,rz:0.1,len:0.86,fl:[0.2,-0.12,-0.05],fr:[0.2,-0.12,-0.05],hl:[0.8,-1.95,1.38],hr:[0.8,-1.95,1.38],nk:-0.35,hz:0.35,tb:0.2,tc:0.02}};   // jump wind-up: front paws planted, the hind end low and gathered, eyes on the target
      POSE.bowl=Object.assign({},POSE.curl,{len:0.88,spM:-1.5,spC:-1.4,nk:0.3,hx:1.2,hz:0.1,hy:0,tb:1.5,tc:0.36,ts:-0.06,tzA:[0.27,0.15,-0.34,0.17,-0.38,-0.28,-1.11,-0.45],tyA:[-1.78,0.34,0,-0.32,0.9,1.09,0.85,0.16]});   // curled in the bubble bowl, head up at the rim
      const keys=['x','y','rx','rz','spM','spC','sbM','sbC','nk','hy','hz','hx','tb','tc','ts','tcurl','blink','eo','yawn','fwd','ry','hrx','fad','hsp','tongue','frx','len','dome','chs','ear','hide','old','npz','fdx','fdy','wid','hch'];
      const Z8=[0,0,0,0,0,0,0,0];
      const blend=function(a,b,t){ const o={}; keys.forEach(function(k){ const va=a[k]!==undefined?a[k]:(POSE.stand[k]||0), vb=b[k]!==undefined?b[k]:(POSE.stand[k]||0); o[k]=va+(vb-va)*t; });
        ['fl','fr','hl','hr'].forEach(function(k){ const va=a[k]||POSE.stand[k], vb=b[k]||POSE.stand[k]; o[k]=[0,1,2].map(function(i){ return va[i]+(vb[i]-va[i])*t; }); });
        ['tzA','tyA'].forEach(function(k){ const va=a[k]||Z8, vb=b[k]||Z8; o[k]=Z8.map(function(_,i){ return va[i]+(vb[i]-va[i])*t; }); }); return o; };   // per-segment tail offsets
      const apply=function(p,br){ const hd=(p.hide||0)>0.5, old=(p.old||0)>0.97; OLD.group.visible=old; R.visible=!old; ['hl','hr'].forEach(function(k){ LEG[k][0].visible=!hd; }); ['fl','fr'].forEach(function(k){ LEG[k].slice(0,2).forEach(function(g){ g.children.forEach(function(c){ if(c.isMesh) c.visible=!hd; }); }); });   // hide: a loaf with the legs tucked away, only the front paws peeking
        R.rotation.order='YZX'; R.rotation.set(p.rx||0,p.ry||0,p.rz||0); R.position.set((p.fwd||0)*Math.cos(p.ry||0),p.y,-(p.fwd||0)*Math.sin(p.ry||0));
        mid.position.x=chest.position.x=0.08*(p.len||1); mid.rotation.set(0,p.sbM||0,p.spM||0); chest.rotation.set(0,p.sbC||0,p.spC||0); neck.rotation.set(0,0,p.nk||0); head.rotation.order='YZX'; head.rotation.set(p.hx||0,p.hy||0,p.hz||0);
        ['fl','fr','hl','hr'].forEach(function(k){ LEG[k].forEach(function(g,i){ g.rotation.z=p[k][i]; }); const pw=LEG[k][0].userData.paw; if(pw) pw.rotation.z=-Math.max(-1,Math.min(1.6,p[k][0]+p[k][1]+p[k][2]+(p.rz||0))); });   // hind toes stay flat under the body
        LEG.fl[0].position.x=LEG.fr[0].position.x=0.014+(p.fdx||0); LEG.fl[0].position.y=LEG.fr[0].position.y=-0.05-(p.fdy||0); LEG.fl[0].rotation.x=-(p.fad||0); LEG.fr[0].rotation.x=(p.fad||0)+(p.frx||0); LEG.hl[0].rotation.x=p.hsp||0; LEG.hr[0].rotation.x=-(p.hsp||0)+(p.hrx||0);
        tail.forEach(function(g,i){ g.rotation.z=(i?(p.tc||0)+(i>=6?-(p.tcurl||0):0):(p.tb||0))+p.tzA[i]; g.rotation.y=(i?(p.ts||0):0)+p.tyA[i]; });
        torso.morphTargetInfluences[0]=Math.max(0,Math.min(1,(p.y-0.15)/0.05))*(1-(p.npz||0)); torso.morphTargetInfluences[1]=p.hch||0; const b=br||0; const dm=p.dome||0, cs=p.chs||0; const wd=1+(p.wid||0); bones[2].scale.set(1,(1+0.035*b)*(1+cs),(1+0.02*b)*(1+cs*0.7)*wd); bones[1].scale.set(1,(1+0.03*b)*(1+dm),(1+dm*0.3)*wd); bones[0].scale.set(1,1+dm*0.7,(1+dm*0.2)*wd);
        const op=Math.max(0.07,Math.min(1,(0.28+(p.eo||0))*(1-Math.max(0,Math.min(1,p.blink||0))))); eyes.forEach(function(e){ e.s.scale.y=op; e.iris.visible=op>0.17; }); mouth.scale.y=Math.max(0.05,p.yawn||0); mouth.visible=(p.yawn||0)>0.04; chin.position.y=-0.03-0.01*(p.yawn||0);
        tongue.visible=(p.tongue||0)>0.05; tongue.position.x=0.045+0.012*(p.tongue||0); };
      /* actions: key poses on a timeline, eased, with additive motion */
      const ACT={
        stretch:{d:3.6,k:[[0,'B'],[0.6,'stand'],[1.4,'stretch'],[2.3,'arch'],[3.0,'stand'],[3.6,'B']],add:function(p,t){ p.yawn=sm(1.2,1.5,t)*(1-sm(2.0,2.3,t)); p.tongue=sm(2.25,2.4,t)*(1-sm(2.6,2.8,t)); p.ear=(p.ear||0)-0.3*p.yawn; if(p.yawn>0){ p.hz=(p.hz||0)+0.3*p.yawn; p.blink=Math.max(p.blink||0,p.yawn); } }},
        belly:{d:4.2,k:[[0,'B'],[0.9,'belly'],[3.4,'belly'],[4.2,'B']],add:function(p,t){ const w=sm(0.9,1.2,t)*(1-sm(3.2,3.4,t)); p.rx+=0.16*Math.sin(t*3.2)*w; p.ry=(p.ry||0)+0.1*Math.sin(t*3.2+0.6)*w; p.hy=(p.hy||0)+(0.5*(act.yaw||0)-0.25)*w; p.ts=(p.ts||0)+0.3*Math.sin(t*4.5)*w; p.tb=(p.tb||0)+0.15*Math.sin(t*4.5)*w;
          p.fl[2]+=0.25*Math.sin(t*3.2)*w; p.fr[2]+=0.25*Math.sin(t*3.2+1.2)*w; p.blink=Math.max(p.blink||0,0.3*w); p.ear=(p.ear||0)-0.25*w; }},
        love:{d:3.6,k:[[0,'B'],[0.5,'stand'],[1.4,'love'],[2.8,'love'],[3.6,'B']],add:function(p,t){ const wk=sm(0.5,0.7,t)*(1-sm(1.3,1.5,t)), ph=t*11; p.fwd=(p.fwd||0)+0.12*sm(0.5,1.4,t)*(1-sm(2.9,3.6,t)); p.ry=(p.ry||0)+(act.yaw||0)*sm(0.3,0.9,t)*(1-sm(2.9,3.6,t));
          p.fl[0]+=0.4*Math.sin(ph)*wk; p.fr[0]-=0.4*Math.sin(ph)*wk; p.hl[0]-=0.4*Math.sin(ph)*wk; p.hr[0]+=0.4*Math.sin(ph)*wk; const hb=sm(1.5,1.7,t)*(1-sm(2.5,2.7,t)); p.hz=(p.hz||0)-0.35*Math.max(0,Math.sin((t-1.5)*7))*hb; p.hx=(p.hx||0)+0.3*hb; p.eo=0.45*sm(1.3,1.6,t)*(1-sm(2.1,2.4,t)); p.blink=sm(2.3,2.6,t)*(1-sm(2.8,3.0,t)); }},
        scratch:{d:3.0,k:[[0,'B'],[0.6,'sit'],[2.4,'sit'],[3.0,'B']],add:function(p,t){ const w=sm(0.7,0.9,t)*(1-sm(2.1,2.3,t)), s=Math.sin(t*44)*w*sm(0.9,1.0,t);   // about 7 strokes a second
          p.rx=(p.rx||0)-0.2*w; p.y+=0.012*w; p.sbM=-0.3*w; p.sbC=-0.4*w; p.spC=(p.spC||0)-0.3*w; p.nk=(p.nk||0)+0.1*w; p.hr=[p.hr[0]+1.55*w,p.hr[1]+1.85*w+0.2*s,p.hr[2]-2.2*w+0.15*s]; p.hrx=0.4*w; p.hx=(p.hx||0)+0.55*w; p.hz=(p.hz||0)-0.2*w; p.hy=(p.hy||0)-0.5*w; p.blink=Math.max(p.blink||0,0.8*w); }},
        groom:{d:3.8,k:[[0,'B'],[0.6,'sit'],[3.2,'sit'],[3.8,'B']],add:function(p,t){ const w=sm(0.7,0.9,t)*(1-sm(2.9,3.1,t)), lick=sm(0.8,1.0,t)*(1-sm(1.9,2.1,t)), wipe=sm(1.9,2.1,t)*(1-sm(2.9,3.1,t)), arc=sm(2.0,2.8,t);
          p.spC=(p.spC||0)-0.12*w; const wa=wipe*arc; p.fr=[p.fr[0]+1.35*w+1.3*wa,p.fr[1]+2.25*w-1.2*wa,p.fr[2]-1.2*w]; p.frx=-0.72*w+0.8*wa;
          p.nk=(p.nk||0)-0.15*lick; p.hz=(p.hz||0)-0.45*lick-0.15*wipe; p.hy=(p.hy||0)-0.3*lick; p.hx=(p.hx||0)+(0.55*arc-0.1)*wipe; p.tongue=lick*Math.max(0,Math.sin(t*14)); p.blink=0.85*w; }},
        blink:{d:2.4,k:[[0,'B'],[2.4,'B']],add:function(p,t){ p.blink=Math.max(p.blink||0,sm(0.3,0.9,t)*(1-sm(1.5,2.1,t))); }},
        perch:{d:3.0,k:[[0,'B'],[3.0,'B']],add:function(p,t){ const w=sm(0.2,0.8,t)*(1-sm(2.2,2.8,t)); p.fl=[p.fl[0]+0.8*w,p.fl[1]+1.2*w,p.fl[2]]; p.spC=(p.spC||0)+0.2*w; p.nk=(p.nk||0)+0.3*w; p.yawn=sm(0.8,1.1,t)*(1-sm(1.7,2.0,t)); }}};
      let base=opt.pose||'loaf', act=null, t0=null, now=0, look=null, lookY=0, lastT=null; const LV=new THREE.Vector3(), loco={gw:0,ph:0,gm:0,lp:0,pp:0,wig:0};   // gw: up from the rest pose to standing, gm: stride, ph: gait phase, lp: mid-leap
      const poseAt=function(t){ const A=ACT[act.n], k=A.k; let i=0; while(i<k.length-2&&t>k[i+1][0]) i++; const a=k[i], b=k[i+1], pa=a[1]==='B'?POSE[base]:POSE[a[1]], pb=b[1]==='B'?POSE[base]:POSE[b[1]], u=sm(0,1,(t-a[0])/Math.max(0.001,b[0]-a[0])); const p=blend(pa,pb,u); A.add(p,t); return p; };
      /* the Blender model takes over from the rig whenever she is up; her resting loaf stays the first model */
      let GB=null; const GQ={gv:0,cur:null,key:'',lph:null,blinkT:0,eo:0};
      const MO=Catalog.catMochi(), useGlb=opt.glb!==undefined?opt.glb:MO;
      if(useGlb) Catalog.bubuGLB().then(function(g){ const S=g.clone(g.scene), mix=new THREE.AnimationMixer(S), A={}, eyes=[], mats=[];
        S.rotation.y=Math.PI/2; S.scale.setScalar(MO?1:1.2); S.position.y=MO?0:0.01; S.visible=MO; C.add(S); g.clips.forEach(function(c){ A[c.name]=mix.clipAction(c); });
        S.traverse(function(o){ if(!o.isMesh) return; o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; o.material=o.material.clone(); const m=o.material; if(m.map){ m.emissive=new THREE.Color(0xffffff); m.emissiveMap=m.map; m.emissiveIntensity=/^(latest|5)$/.test(Catalog.catChoice())?0:0.02; if(/^(latest|5)$/.test(Catalog.catChoice())) m.color.setScalar(0.93); m.roughness=1; if(m.sheen!==undefined&&m.sheen>0){ m.sheen=0.3; m.sheenColor.setHex(0x7a6250); m.sheenRoughness=0.8; } } mats.push(m); if(o.morphTargetDictionary&&o.morphTargetDictionary.Open!==undefined) eyes.push(o); });
        if(MO) mats.forEach(function(m){ if(m.vertexColors) m.color.setScalar(0.87); });
        GB={S:S,mix:mix,A:A,eyes:eyes,mats:mats}; if(opt.onGlb) opt.onGlb(GB); }).catch(function(e){ console.warn('bubu.glb',e); });
      Catalog.catClipMap=Catalog.catClipMap||{belly_up:'lie_side'};   // belly_up twists from above until the fixed model arrives: clear this map to bring it back
      const CM=function(n){ return MO?n:(Catalog.catClipMap[n]||n); }, ACTCLIP={stretch:CM('stretch'),belly:CM('belly_up'),love:CM('love_lap'),scratch:CM('scratch_head'),groom:CM('groom')};
      const glb=function(p,t,dt){ if(!GB||(base==='bowl'&&!MO)) return; const L=loco, Q=GQ, oldWant=!MO&&(p.old||0)>0.97;
        Q.gv=MO?1:Math.max(0,Math.min(1,Q.gv+(oldWant?-1:1)*dt/0.15)); R.visible=false; OLD.group.visible=Q.gv<1; GB.S.visible=Q.gv>0;
        const fade=Q.gv<1; GB.mats.forEach(function(m){ if(m.transparent!==fade){ m.transparent=fade; m.needsUpdate=true; } m.opacity=Q.gv; });
        if(!GB.S.visible){ Q.key=''; return; }
        let key, tm=null, ts=1; const d=function(n){ return GB.A[n].getClip().duration; };
        if(act&&ACTCLIP[act.n]){ key='act:'+act.n+':'+t0; ts=/belly|love/.test(act.n)?1:d(ACTCLIP[act.n])/ACT[act.n].d; }
        else if(L.air){ key=L.wt<0.25?'jump_prep':(L.dn?'jump_down':'jump_up'); tm=key==='jump_prep'?Math.min(1,L.wt/0.25)*d(key):MO?(L.dn?0.12+0.5*L.u:0.08+0.52*L.u):(L.dn?0.25+0.4*L.u:0.1+0.45*L.u); }
        else if(L.gm>0.05&&L.gw>0.6){ const sp=Q.lph===null?0.3:Math.max(0,(L.ph-Q.lph)/Math.max(dt,1e-3))*0.32/(2*Math.PI); key=sp>0.6?'run_trot':'walk'; ts=Math.max(0.3,Math.min(2,sp/(MO?(key==='walk'?0.35:0.79):(key==='walk'?0.4:0.95)))); }
        else if(MO&&L.gw<0.02) key=(base==='curl'||base==='bowl')?'curl_sleep':'loaf';
        else if(L.gw<0.97){ key='loaf_to_stand'; tm=Math.max(0,Math.min(1,L.gw))*d(key); }
        else key='idle_stand';
        Q.lph=L.ph; const fz=location.hash==='#debug'&&window.__catForce; if(fz){ key='f:'+fz; tm=null; ts=1; }   // debug: hold one clip
        const name=fz||(key.indexOf('act:')===0?ACTCLIP[act.n]:key), a=GB.A[name];
        if(key!==Q.key){ const prev=Q.cur; a.reset(); a.setLoop(/^(idle_stand|walk|run_trot|belly_up|lie_side|love_lap|loaf|curl_sleep|sit)$/.test(name)?THREE.LoopRepeat:THREE.LoopOnce,Infinity); a.clampWhenFinished=true; a.play(); if(prev&&prev!==a) prev.crossFadeTo(a,Q.key===''?0:0.22,false); Q.cur=a; Q.key=key; }
        if(tm!==null){ a.timeScale=0; a.time=Math.min(tm,d(name)-1e-3); } else a.timeScale=ts;
        GB.mix.update(dt);
        const alert=L.air||(act&&/love|scratch|stretch/.test(act.n))||(!MO&&Math.abs(lookY)>0.12); Q.eo+=((alert?1:0)-Q.eo)*Math.min(1,dt*6); Q.blinkT-=dt; if(Q.blinkT<-0.15) Q.blinkT=2.5+Math.random()*3; const bl=Q.blinkT<0?1:0;
        GB.eyes.forEach(function(o){ const k=o.morphTargetDictionary; if(MO){ if(Q.eo>0.01) o.morphTargetInfluences[k.Open]=Q.eo; return; }   // mochi: the clips drive the half-open eyes and their blinks; only alert moments open them wider
          o.morphTargetInfluences[k.Open]=Q.eo; if(k.Blink!==undefined) o.morphTargetInfluences[k.Blink]=bl*Q.eo; }); if(MO){ R.visible=false; OLD.group.visible=false; } };
      apply(blend(POSE[base],POSE[base],0),0); C.updateMatrixWorld(true);
      return {group:C,head:head,parts:{LEG:LEG,torso:torso,POSE:POSE,tail:tail,old:OLD,apply:function(p){ apply(blend(p,p,0),0); }},
        play:function(n,o){ act={n:n,yaw:o&&o.yaw||0}; t0=null; },
        busy:function(){ return !!act; },
        setBase:function(n){ base=n; }, loco:loco,
        lookAt:function(fn){ look=fn; },
        anim:function(t){ const dt=lastT===null?0:Math.min(0.1,t-lastT); lastT=t; now=t; const br=Math.sin(t*1.9); let p;
          if(act){ if(t0===null) t0=t; const lt=t-t0; if(lt>=ACT[act.n].d){ act=null; } else p=poseAt(lt); }
          let want=0; if(!p&&look&&loco.gw<0.1&&base!=='curl'&&base!=='bowl'){ const q=look(); if(q){ LV.copy(q); head.parent.worldToLocal(LV); const yw=Math.atan2(-LV.z,LV.x); if(Math.abs(yw)<1.6&&LV.length()<4.5) want=Math.max(-0.5,Math.min(0.5,yw)); } }   // follows the player within about 30 degrees
          lookY+=(want-lookY)*Math.min(1,dt*2.5);
          if(!p){ p=blend(POSE[base],POSE.stand,loco.gw); if(loco.gm>0){ const s=Math.sin(loco.ph), c=Math.cos(loco.ph), g=loco.gm;   // walk: diagonal pairs swing together, the swinging foot lifts
              p.fl[0]+=0.42*s*g; p.hr[0]+=0.42*s*g; p.fr[0]-=0.42*s*g; p.hl[0]-=0.42*s*g; p.fl[1]-=0.5*Math.max(0,c)*g; p.hr[1]-=0.45*Math.max(0,c)*g; p.fr[1]-=0.5*Math.max(0,-c)*g; p.hl[1]-=0.45*Math.max(0,-c)*g;
              p.y+=0.004*Math.abs(c)*g; p.hz=(p.hz||0)+0.04*Math.sin(2*loco.ph)*g; p.ts=(p.ts||0)+0.12*s*g; p.tb=(p.tb||0)-0.3*g; }
            if(loco.pp>0) p=blend(p,POSE.prep,loco.pp); if(loco.wig){ p.ry=(p.ry||0)+loco.wig; p.sbM=(p.sbM||0)-loco.wig; }   // the rump shakes side to side while the chest stays put
            if(loco.lp>0) p=blend(p,POSE.leap,loco.lp); const bc=t%6.3, bk=sm(0,0.09,bc)*(1-sm(0.13,0.24,bc)); if(base!=='curl'&&base!=='bowl') p.blink=Math.max(p.blink||0,bk);
            if(base!=='bowl') p.ts=(p.ts||0)+((t%11)<0.6?0.25*Math.sin((t%11)*10):0); const ct=t%13; p.eo=(p.eo||0)-0.17*sm(7,8,ct)*(1-sm(12,13,ct)); }
          p.hy=(p.hy||0)+lookY; apply(p,br); glb(p,t,dt); if(OLD.group.visible){ OLD.anim(t); OLD.head.rotation.y+=lookY; } ears.forEach(function(e,i){ const ec=(t+i*3.7)%8.5; e.rotation.z=0.08+(p.ear||0)-0.4*sm(0,0.06,ec)*(1-sm(0.16,0.3,ec)); }); return true; }};
    };
    const CAT_COLORS={tabby:[0xa07a55,0xf6f2ec,'#4a3626'],grey:[0x8f959b,0xf6f4f0,'#44484d']};
    Catalog.cat=function(kind){                  // a sleeping cat on the floor
      const P=new Piece(), c=CAT_COLORS[kind]||CAT_COLORS.tabby, m=Catalog.catModel(c[0],c[1],c[2]);
      m.group.position.x=0; P.group.add(m.group); P.anims.push(function(t){ m.anim(t); }); return P;
    };
    /* 咘咘 on the floor, rigged; P.play(name,{yaw}) runs an action, yaw turns her toward the player */
    Catalog.nestHub=function(lift){                // Google Nest Hub (2nd gen): H 120.4 x W 177.4 x D 69.5 mm; a white-framed 7-inch screen leaning back on a chalk fabric speaker base; lift raises it onto a top
      const P=new Piece(), lam=env.lam, y=lift||0, fab=env.fab?env.fab(0xc4c1bb):lam(0xc4c1bb,{roughness:1}), wh=lam(0xf3f2ef,{roughness:0.35}), dk=lam(0x3a3c3f,{roughness:0.5}), G=new THREE.Group(); G.position.y=y; P.group.add(G);
      const rr=function(w,h,r){ const s=new THREE.Shape(), x=w/2, z=h/2; s.moveTo(-x+r,-z); s.lineTo(x-r,-z); s.quadraticCurveTo(x,-z,x,-z+r); s.lineTo(x,z-r); s.quadraticCurveTo(x,z,x-r,z); s.lineTo(-x+r,z); s.quadraticCurveTo(-x,z,-x,z-r); s.lineTo(-x,-z+r); s.quadraticCurveTo(-x,-z,-x+r,-z); return s; };
      const bs=new THREE.Shape(); bs.moveTo(-0.04,0); bs.lineTo(0.022,0); bs.quadraticCurveTo(0.03,0,0.028,0.01); bs.lineTo(0.016,0.05); bs.quadraticCurveTo(-0.004,0.062,-0.03,0.05); bs.quadraticCurveTo(-0.044,0.04,-0.04,0); bs.closePath();   // speaker base behind the screen: a soft wedge, flat bottom
      const bg=new THREE.ExtrudeGeometry(bs,{depth:0.15,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.004,bevelSegments:3,curveSegments:10}); bg.translate(0,0,-0.075); bg.scale(1,1,0.93); const base=new THREE.Mesh(bg,fab); base.castShadow=true; G.add(base);
      const scr=new THREE.Group(); scr.position.set(0.03,0.006,0); scr.rotation.z=0.2; G.add(scr);   // the screen stands in front of the base, leaning back about 11 degrees
      const fg=new THREE.ExtrudeGeometry(rr(0.1774,0.118,0.012),{depth:0.008,bevelEnabled:true,bevelThickness:0.002,bevelSize:0.002,bevelSegments:2,curveSegments:8}); fg.rotateY(Math.PI/2); fg.translate(-0.005,0.059,0); const fr=new THREE.Mesh(fg,wh); fr.castShadow=true; scr.add(fr);
      const cv=document.createElement('canvas'); cv.width=512; cv.height=320; (function(){ const g=cv.getContext('2d'), gr=g.createLinearGradient(0,0,0,320); gr.addColorStop(0,'#6f9ccf'); gr.addColorStop(0.5,'#f2c9a0'); gr.addColorStop(0.62,'#f7ddb8'); g.fillStyle=gr; g.fillRect(0,0,512,320);   // a sunset photo with a commute card, like the ambient screen
        g.fillStyle='#7d8fa0'; g.beginPath(); g.moveTo(0,200); g.quadraticCurveTo(90,150,180,185); g.quadraticCurveTo(260,140,330,190); g.lineTo(330,320); g.lineTo(0,320); g.fill();
        g.fillStyle='#4f6476'; g.beginPath(); g.moveTo(0,240); g.quadraticCurveTo(120,205,330,245); g.lineTo(330,320); g.lineTo(0,320); g.fill(); g.fillStyle='rgba(255,236,200,0.9)'; g.beginPath(); g.arc(250,168,16,0,7); g.fill();
        g.fillStyle='#ffffff'; g.font='600 46px "Helvetica Neue",Arial,sans-serif'; g.fillText('08:00',22,292); g.fillStyle='#f2b630'; g.beginPath(); g.arc(178,278,8,0,7); g.fill(); g.fillStyle='#ffffff'; g.font='20px Arial'; g.fillText('20°',192,286);
        g.fillStyle='#ffffff'; g.fillRect(320,22,170,270); g.fillStyle='#555'; g.font='15px "Hiragino Sans",sans-serif'; g.fillText('通勤',340,52); g.fillStyle='#222'; g.font='bold 19px "Hiragino Sans",sans-serif'; g.fillText('職場まで',336,104); g.fillStyle='#1e8e3e'; g.fillText('27 分',420,104);
        g.fillStyle='#e9eef0'; g.fillRect(336,160,140,110); g.strokeStyle='#ffffff'; g.lineWidth=3; for(let k=0;k<6;k++){ g.beginPath(); g.moveTo(336,170+k*18); g.lineTo(476,160+k*20); g.stroke(); } g.strokeStyle='#4285f4'; g.lineWidth=4; g.beginPath(); g.moveTo(380,180); g.lineTo(400,220); g.lineTo(440,240); g.stroke(); g.fillStyle='#ea4335'; g.beginPath(); g.arc(380,176,7,0,7); g.fill(); })();
      const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; const sm=new THREE.Mesh(new THREE.PlaneGeometry(0.152,0.095),new THREE.MeshBasicMaterial({map:tx,color:0xd8d8d8,toneMapped:false})); sm.position.set(0.0051,0.062,0); sm.rotation.y=Math.PI/2; scr.add(sm);
      [-0.025,0.025].forEach(function(z){ const d=new THREE.Mesh(new THREE.CircleGeometry(0.0012,10),dk); d.position.set(0.0052,0.1135,z); d.rotation.y=Math.PI/2; scr.add(d); });   // two far-field mics and the light sensor on the top bezel
      const ls=new THREE.Mesh(new THREE.CircleGeometry(0.0022,12),lam(0xd9dadb,{roughness:0.2})); ls.position.set(0.0052,0.1135,0); ls.rotation.y=Math.PI/2; scr.add(ls);
      const cb=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.042,0.01,0.03),new THREE.Vector3(-0.07,0.004,0.04),new THREE.Vector3(-0.12,0.002,0.03)]),12,0.002,6,false),wh); G.add(cb);   // power cable out of the back
      P._col(-0.04,0.04,-0.09,0.09,false); return P; };
    Catalog.bubu=function(opt){ const P=new Piece(), m=Catalog.bubuRig(1.0,{glb:Catalog.catChoice()!=='old'}); P.group.add(m.group); P.rig=m; P.play=function(n,o){ m.play(n,o); }; P._col(-0.2,0.26,-0.13,0.13,false);
      /* opt.route() -> {spots:[[x,z],..], perch:{from:[x,z], top:[x,y,z], face:yaw} or perch:{routes:[{from, seq:[[x,y,z],..], rest:i, to:[x,z], face}]}} in world space:
         she wanders between spots and now and then climbs a route perch by perch, rests on seq[rest], and jumps down at `to` */
      const L=m.loco, G=m.group, WP=new THREE.Vector3(), WQ=new THREE.Quaternion(), V=new THREE.Vector3(), cl=function(v,a,b){ return Math.max(a,Math.min(b,v)); };
      let R=null, RT=null, si=0, home=null, x=0, z=0, y=0, yw=0, st='rest', tm=20+Math.random()*15, go=null, then=null, air=null, n=0, lastT=null, off=false;
      const toward=function(v,tg,r,dt){ return v+cl(tg-v,-r*dt,r*dt); }, angTo=function(a){ let d=a-yw; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; };
      P.airborne=function(){ return st==='air'; }; P.nudge=function(){ tm=0; };
      P.anims.push(function(t){ const dt=lastT===null?0:Math.min(0.1,t-lastT); lastT=t;
        if(opt&&opt.route&&!off){ P.group.getWorldPosition(WP);
          if(!home){ R=opt.route(); if(!R){ off=true; } else { home=WP.clone(); P.group.getWorldQuaternion(WQ); yw=new THREE.Euler().setFromQuaternion(WQ,'YXZ').y; x=WP.x; z=WP.z; } }
          else if(Math.hypot(WP.x-home.x,WP.z-home.z)>0.05) off=true;   // moved in the layout editor: she just stays where she was put
          if(off){ G.position.set(0,0,0); G.rotation.y=0; L.gw=L.gm=L.lp=0; m.setBase('loaf'); }
          else { const busy=m.busy();
            if(!busy&&st==='rest'){ L.gm=toward(L.gm,0,3,dt); if(Math.hypot(x-home.x,z-home.z)<0.1&&Math.abs(angTo(home.yaw))>0.05){ yw+=cl(angTo(home.yaw),-2*dt,2*dt); L.gm=Math.max(L.gm,0.3); L.ph+=dt*6; } else L.gw=toward(L.gw,0,1.5,dt); tm-=dt;
              if(tm<=0){ n++; const atHome=Math.hypot(x-home.x,z-home.z)<0.1;
                if(R.perch&&n%3===0&&atHome){ const rs=R.perch.routes||[R.perch]; RT=rs[Math.floor(Math.random()*rs.length)]; if(!RT.seq) RT.seq=[RT.top]; go=RT.from; then='up'; }
                else if(!atHome){ go=[home.x,home.z]; then='rest'; }
                else { const sp=R.spots[Math.floor(Math.random()*R.spots.length)]; go=sp; then='rest'; }
                st='go'; } }
            else if(!busy&&st==='go'){ const dx=go[0]-x, dz=go[1]-z, d=Math.hypot(dx,dz), want=Math.atan2(-dz,dx), da=angTo(want);
              L.gw=toward(L.gw,1,2.2,dt);
              if(d<0.03){ L.gm=toward(L.gm,0,4,dt); if(L.gm<0.05){ if(then==='up'){ st='turn'; } else { st='rest'; tm=Math.hypot(x-home.x,z-home.z)<0.1?25+Math.random()*25:10+Math.random()*12; } } }
              else if(L.gw>0.8){ yw+=cl(da,-3*dt,3*dt); const sp=0.3*Math.max(0,Math.cos(da))*Math.min(1,d/0.15+0.3), mv=sp*dt; x+=Math.cos(yw)*mv; z-=Math.sin(yw)*mv; L.gm=toward(L.gm,Math.max(0.35,Math.min(1,sp/0.3)),3,dt); L.ph+=mv/0.32*2*Math.PI; } }
            else if(st==='turn'){ const T0=RT.seq[0], da=angTo(Math.atan2(-(T0[2]-z),T0[0]-x)); yw+=cl(da,-2.5*dt,2.5*dt); if(Math.abs(da)<0.05){ si=0; st='air'; air={t:0,a:[x,0,z],b:[T0[0],T0[1]-home.y,T0[2]],up:true}; } }
            else if(st==='air'){ air.t+=dt; const W0=0.25, D=0.75, u=cl((air.t-W0)/D,0,1), e=u*u*(3-2*u), w=air.t<W0?air.t/W0:1;   // a 0.25 s wind-up on her feet (crouch, two rump shakes), then a 0.75 s arc
              L.gw=1; L.air=1; L.wt=air.t; L.u=u; L.dn=air.b[1]<air.a[1]-0.05; L.pp=air.t<W0?Math.min(1,w*3)*(1-Math.max(0,(w-0.85)/0.15)):0; L.wig=air.t<W0?0.07*Math.sin(w*Math.PI*4)*Math.sin(w*Math.PI):0; L.lp=Math.sin(Math.PI*u)*(u>0?1:0);
              x=air.a[0]+(air.b[0]-air.a[0])*e; z=air.a[2]+(air.b[2]-air.a[2])*e; y=air.a[1]+(air.b[1]-air.a[1])*e+0.3*Math.sin(Math.PI*u);
              if(u>=1){ L.lp=0; L.air=0; if(air.up){ st='perch'; tm=si===(RT.rest===undefined?RT.seq.length-1:RT.rest)?14+Math.random()*12:0.5+Math.random()*0.6; } else { st='go'; go=[home.x,home.z]; then='rest'; } } }
            else if(!busy&&st==='perch'){ L.gw=toward(L.gw,0,1.5,dt); if(tm>0) yw+=cl(angTo(RT.face||0),-2*dt,2*dt); tm-=dt;   // hop along the route's perches, rest on the marked one, then down to the floor
              if(tm<=0){ const nx=RT.seq[si+1], to=RT.to||RT.from, tx=nx?nx[0]:to[0], tz=nx?nx[2]:to[1], da=angTo(Math.atan2(-(tz-z),tx-x)); L.gw=toward(L.gw,1,3,dt); yw+=cl(da,-2.5*dt,2.5*dt); if(Math.abs(da)<0.05&&L.gw>0.9){ st='air'; if(nx){ si++; air={t:0,a:[x,y,z],b:[nx[0],nx[1]-home.y,nx[2]],up:true}; } else air={t:0,a:[x,y,z],b:[to[0],0,to[1]],up:false}; } } }
            if(home.yaw===undefined){ P.group.getWorldQuaternion(WQ); home.yaw=new THREE.Euler().setFromQuaternion(WQ,'YXZ').y; }
            V.set(x,home.y+y,z); P.group.worldToLocal(V); G.position.copy(V); G.rotation.y=yw-home.yaw; } }
        return m.anim(t); });
      return P; };
    const rrShape=function(w,h,r,cx,cy){ const s=new THREE.Shape(), x0=(cx||0)-w/2, y0=(cy||0)-h/2; r=Math.min(r,w/2-0.0005,h/2-0.0005);   // rounded rectangle in the xy plane
      s.moveTo(x0+r,y0); s.lineTo(x0+w-r,y0); s.quadraticCurveTo(x0+w,y0,x0+w,y0+r); s.lineTo(x0+w,y0+h-r); s.quadraticCurveTo(x0+w,y0+h,x0+w-r,y0+h); s.lineTo(x0+r,y0+h); s.quadraticCurveTo(x0,y0+h,x0,y0+h-r); s.lineTo(x0,y0+r); s.quadraticCurveTo(x0,y0,x0+r,y0); return s; };
    const softBoard=function(G,w,d,th,mt,x,y,z,r){ const g=new THREE.ExtrudeGeometry(rrShape(d,w,r||0.02),{depth:th-0.006,bevelEnabled:true,bevelThickness:0.003,bevelSize:0.003,bevelSegments:2,curveSegments:6}); g.rotateX(-Math.PI/2); g.translate(0,0.003-th/2+th,0); const m=cadd(G,g,mt,x,y-th/2,z); return m; };   // board lying flat: d along x (out of the wall), w along z, eased edges
    Catalog.catHouse=function(yb){              // 50 x 42 x 40 cm wall box with a rounded cat-head doorway, a cushion inside and a landing board in front
      const P=new Piece(), cm=catMats(), G=wallGroup(P,yb), W=0.5, H=0.42, D=0.4;
      softBoard(G,W,D,0.02,cm.cwood,D/2,0.02,0,0.03); softBoard(G,W,D,0.02,cm.cwood,D/2,H,0,0.03);
      [-1,1].forEach(function(sd){ const g=new THREE.ExtrudeGeometry(rrShape(D,H-0.04,0.012,D/2,H/2),{depth:0.014,bevelEnabled:true,bevelThickness:0.003,bevelSize:0.003,bevelSegments:2}); g.translate(0,0,-0.01); cadd(G,g,cm.cwood,0,0,sd*(W/2-0.01)); });
      cadd(G,new THREE.PlaneGeometry(W-0.04,H-0.04),cm.cdark,0.006,H/2,0).rotation.y=Math.PI/2;
      const sh=rrShape(W,H,0.03,0,H/2), hp=new THREE.Path(), c=H/2-0.01;   // the doorway: two ears and a round head, drawn with smooth curves
      hp.moveTo(-0.1,c-0.04); hp.bezierCurveTo(-0.13,c+0.04,-0.11,c+0.1,-0.095,c+0.135); hp.quadraticCurveTo(-0.06,c+0.1,-0.035,c+0.095); hp.quadraticCurveTo(0,c+0.105,0.035,c+0.095); hp.quadraticCurveTo(0.06,c+0.1,0.095,c+0.135);
      hp.bezierCurveTo(0.11,c+0.1,0.13,c+0.04,0.1,c-0.04); hp.bezierCurveTo(0.08,c-0.1,-0.08,c-0.1,-0.1,c-0.04); sh.holes.push(hp);
      const fg=new THREE.ExtrudeGeometry(sh,{depth:0.016,bevelEnabled:true,bevelThickness:0.003,bevelSize:0.003,bevelSegments:2,curveSegments:14}); const fm=cadd(G,fg,cm.cwood,D-0.02,0,0); fm.rotation.y=Math.PI/2;
      const cu=cadd(G,new THREE.CylinderGeometry(0.17,0.17,0.04,28),cm.cbed,D*0.45,0.045,0); cu.scale.set(1,1,1.25);   // cushion on the box floor
      const rl=cadd(G,new THREE.TorusGeometry(0.17,0.022,8,28),cm.cbed,D*0.45,0.05,0); rl.rotation.x=Math.PI/2; rl.scale.set(1,1.25,1);
      softBoard(G,W*0.9,0.2,0.022,cm.cwood,D+0.1,0.022,0,0.04);   // landing board in front of the doorway
      return P;
    };
    /* clear acrylic cat bubble, Ø42 cm, on an oak ring bracket; rim at yb, wall piece (+x out of the wall); a cat asleep in it if catKind */
    Catalog.catBubble=function(yb,catKind){
      const P=new Piece(), cm=catMats(), G=wallGroup(P,yb), R=0.21, cx=R+0.04;
      const ac=new THREE.MeshPhysicalMaterial({color:0xf4fbff,roughness:0.04,metalness:0,transmission:0.9,thickness:0.004,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false});
      const bowl=new THREE.Mesh(new THREE.SphereGeometry(R,40,16,0,Math.PI*2,Math.PI/2,Math.PI/2),ac); bowl.position.set(cx,0,0); bowl.renderOrder=2; G.add(bowl);
      const rim=cadd(G,new THREE.TorusGeometry(R+0.012,0.016,10,48),cm.cwood,cx,0,0); rim.rotation.x=Math.PI/2;
      cadd(G,cbx(0.02,0.2,0.3),cm.cwood,0.01,-0.07,0); [-1,1].forEach(function(sd){ cadd(G,cbx(0.07,0.025,0.03),cm.cwood,0.05,-0.005,sd*0.13); });   // wall plate centred behind the bowl, arms to the ring
      const cu=cadd(G,new THREE.CylinderGeometry(R*0.3,R*0.26,0.012,28),cm.cbed,cx,-R*0.93,0);
      if(catKind==='bubu'){ let refit=null; const m=Catalog.bubuRig(1.2,{pose:'bowl',onGlb:function(GB){ if(refit) refit(GB); }}); m.anim(3); ['hl','hr'].forEach(function(k){ m.parts.LEG[k][0].children.forEach(function(o){ if(o.isMesh) o.visible=false; }); });  const Hc=new THREE.Group(), T=new THREE.Group(); T.rotation.order='YZX'; T.rotation.set(0,Math.PI/2,0.3); T.add(m.group); Hc.add(T); Hc.updateMatrixWorld(true);
        const pts=[], v=new THREE.Vector3(), tl=new Set(); m.parts.tail.concat([m.parts.old.group]).forEach(function(g){ g.traverse(function(o){ tl.add(o); }); }); m.group.traverse(function(o){ if(!o.isMesh||tl.has(o)) return; const pa=o.geometry.attributes.position; for(let i=0;i<pa.count;i+=3){ o.getVertexPosition(i,v); pts.push(v.clone().applyMatrix4(o.matrixWorld)); } });
        let pil=null, top=null;
        const fit=function(pts){ const bb=new THREE.Box3().setFromPoints(pts), cc=bb.getCenter(new THREE.Vector3()); let y=0.3, lo=0;   // lower her into the bowl until she would touch the acrylic
          for(;y>-0.3;y-=0.002){ let hit=false; for(let i=0;i<pts.length&&!hit;i++){ const q=pts[i], qy=q.y+y; if(qy<0&&Math.hypot(q.x-cc.x,qy,q.z-cc.z)>R-0.007) hit=true; } if(hit) break; lo=bb.min.y+y; }
          y+=0.002; Hc.position.set(cx-cc.x,y,-cc.z);
          if(pil){ G.remove(pil); G.remove(top); pil.geometry.dispose(); top.geometry.dispose(); }
          const ct=Math.acos(Math.max(-1,Math.min(1,(lo+0.004)/(R-0.006)))); pil=new THREE.Mesh(new THREE.SphereGeometry(R-0.006,40,8,0,Math.PI*2,ct,Math.PI-ct),cm.cbed); top=new THREE.Mesh(new THREE.CircleGeometry((R-0.006)*Math.sin(ct),40),cm.cbed);   // a pillow filling the bowl up to her
          pil.position.set(cx,0,0); top.rotation.x=-Math.PI/2; top.position.set(cx,lo+0.004,0); G.add(pil); G.add(top); return lo; };
        fit(pts); G.add(Hc); P.anims.push(function(t){ return m.anim(t); }); P.rig=m; cu.visible=false;
        refit=function(GB){ const a=GB.A.curl_sleep; if(!a) return; a.reset(); a.play(); GB.mix.update(0); GB.S.updateMatrixWorld(true); Hc.updateMatrixWorld(true); G.updateMatrixWorld(true); const Gi=new THREE.Matrix4().copy(G.matrixWorld).invert(), gp=[], vv=new THREE.Vector3();   // the Blender cat curled in the bowl, tail left hanging out
          GB.S.traverse(function(o){ if(!o.isSkinnedMesh) return; o.skeleton.update(); const sa=o.geometry.attributes.skinIndex, sw=o.geometry.attributes.skinWeight, bn=o.skeleton.bones; if(!sa) return; for(let i=0;i<sa.count;i+=2){ let bi=sa.getX(i), bw=sw.getX(i); for(let k=1;k<4;k++){ const w=[sw.getX,sw.getY,sw.getZ,sw.getW][k].call(sw,i); if(w>bw){ bw=w; bi=[sa.getX,sa.getY,sa.getZ,sa.getW][k].call(sa,i); } } if(/^tail/.test(bn[bi].name)) continue; o.getVertexPosition(i,vv); gp.push(vv.clone().applyMatrix4(o.matrixWorld).applyMatrix4(Gi).sub(Hc.position)); } });
          if(!gp.length) return; for(let k=1;k>0.5;k-=0.05){ Hc.scale.setScalar(k); if(fit(gp.map(function(q){ return q.clone().multiplyScalar(k); }))<-0.09) break; } }; }   // a cat bigger than the bowl is scaled down until she sits inside it
      else if(catKind&&CAT_COLORS[catKind]){ const c=CAT_COLORS[catKind], m=Catalog.catModel(c[0],c[1],c[2]); const Hc=new THREE.Group(); Hc.add(m.group); Hc.scale.setScalar(0.62); const cb=new THREE.Box3().setFromObject(Hc), cc=cb.getCenter(new THREE.Vector3()); Hc.position.set(cx-cc.x,-R*0.86-cb.min.y,-cc.z); G.add(Hc); P.anims.push(function(t){ m.anim(t); }); }
      return P;
    };
    Catalog.catStep=function(yb){               // 25 x 40 cm oak step with eased edges, a sisal pad and a curved cove bracket
      const P=new Piece(), cm=catMats(), G=wallGroup(P,yb), d=0.25, hw=0.2, sh=new THREE.Shape();
      sh.moveTo(0,-hw); sh.lineTo(d-0.05,-hw); sh.quadraticCurveTo(d,-hw,d,-hw+0.05); sh.lineTo(d,hw-0.05); sh.quadraticCurveTo(d,hw,d-0.05,hw); sh.lineTo(0,hw); sh.closePath();
      const bg=new THREE.ExtrudeGeometry(sh,{depth:0.024,bevelEnabled:true,bevelThickness:0.003,bevelSize:0.003,bevelSegments:2,curveSegments:8}); bg.rotateX(-Math.PI/2); cadd(G,bg,cm.cwood,0,0.003,0);
      const pad=new THREE.ExtrudeGeometry(rrShape(0.19,0.33,0.03,0.12,0),{depth:0.004,bevelEnabled:false,curveSegments:6}); pad.rotateX(-Math.PI/2); cadd(G,pad,cm.csisal,0,0.031,0);
      const br=new THREE.Shape(); br.moveTo(0,0); br.lineTo(0.16,0); br.lineTo(0.16,-0.012); br.quadraticCurveTo(0.03,-0.03,0.012,-0.15); br.lineTo(0,-0.15); br.closePath();
      cadd(G,new THREE.ExtrudeGeometry(br,{depth:0.016,bevelEnabled:true,bevelThickness:0.002,bevelSize:0.002,bevelSegments:1,curveSegments:10}),cm.cwood,0,0,-0.008);
      return P;
    };
    Catalog.catBed=function(yb,catKind){        // cat-ear hammock tray, optionally with a cat asleep in it
      const P=new Piece(), cm=catMats(), G=wallGroup(P,yb); cadd(G,cbx(0.36,0.025,0.34),cm.cwood,0.18,0,0);
      const sh=new THREE.Shape([[-0.17,0],[-0.17,0.14],[-0.12,0.14],[-0.1,0.25],[-0.04,0.14],[0.04,0.14],[0.1,0.25],[0.12,0.14],[0.17,0.14],[0.17,0]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }));
      cpanel(G,sh,0,0.02,cm.cwood).position.y=0.012;
      [-1,1].forEach(function(sd){ cadd(G,cbx(0.34,0.07,0.02),cm.cwood,0.18,0.045,sd*0.16); });
      cadd(G,new THREE.CylinderGeometry(0.15,0.15,0.045,28),cm.cbed,0.2,0.035,0);
      if(catKind){ const c=CAT_COLORS[catKind], m=Catalog.catModel(c[0],c[1],c[2]); G.add(m.group); P.anims.push(function(t){ m.anim(t); }); }
      return P;
    };
    Catalog.catColumn=function(yb,yt,plats){    // sisal post fixed to the wall with a few small plates
      const P=new Piece(), cm=catMats(), G=wallGroup(P,yb); cadd(G,new THREE.CylinderGeometry(0.055,0.055,yt-yb,16),cm.csisal,0.1,(yt-yb)/2,0);
      [0.04,yt-yb-0.04].forEach(function(y){ cadd(G,cbx(0.2,0.04,0.12),cm.cwood,0.05,y,0); });
      (plats||[]).forEach(function(h,i){ const m=cadd(G,cbx(0.3,0.025,0.3),cm.cwood,0.15,h-yb,0); m.rotation.y=(i%2?0.35:-0.3); });
      return P;
    };
    /* feeding mat 25 x 61 cm with a 13 cm food bowl and a 15 cm water bowl, long side along z */
    /* cat feeding station on a 32 x 76 cm mat, front +x: automatic feeder, a shallow dish for wet food, a water bowl */
    Catalog.catFeedStation=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, hw=0.16, hl=0.38;
      P.rbox(-hw,hw,-hl,hl,0,0.006,0.008,lam(0x4a5560,{roughness:0.8}),oc);
      const bowl=function(x,z,r,h,col,fillCol,fy){
        const pts=[[0.001,0],[r*0.72,0],[r,h],[r-0.007,h],[r*0.72-0.007,0.007],[0.001,0.007]].map(function(q){ return new THREE.Vector2(q[0],q[1]); });
        const m=new THREE.Mesh(new THREE.LatheGeometry(pts,28),lam(col,{roughness:0.25,side:THREE.DoubleSide,envMapIntensity:0.8})); m.position.set(x,0.006,z); P.add(m);
        P.cyl(x,z,r-0.012,r-0.012,0.006+fy,0.006+fy+0.004,fillCol,oc,24);
      };
      (function(){ const z=-0.24, wh=lam(0xf4f4f1,{roughness:0.3}), steel=lam(0xc9ced3,{metalness:0.85,roughness:0.25}), kib=lam(0x8a5a35,{roughness:0.9});   // automatic feeder: 2 L hopper with a window, chute into a steel bowl in front
        P.rbox(-0.13,0.05,z-0.1,z+0.1,0.006,0.31,0.03,wh);
        const FL=new THREE.Group(); FL.position.set(-0.125,0.31,0); P.group.add(FL); const fl=P.rbox(-0.125,0.045,z-0.095,z+0.095,0.31,0.33,0.03,lam(0xd9dcdf,{roughness:0.3})); P.group.updateMatrixWorld(true); FL.attach(fl);   // hopper lid hinged at the back
        P.box(-0.115,0.035,z-0.085,z+0.085,0.309,0.3115,kib,oc); for(let i=0;i<40;i++){ const k=new THREE.Mesh(new THREE.SphereGeometry(0.006,6,4),kib); k.scale.y=0.6; k.position.set(-0.11+(i*0.037)%0.14,0.3115,z-0.08+(i*0.061)%0.16); P.group.add(k); }   // kibble filling the hopper
        const sFl=stepper(0.6,function(v){ FL.rotation.z=1.45*ease(v); }); P.anims.push(function(t){ return sFl.run(t); });
        P.actions=(P.actions||[]).concat([{x:0.5,z:z,part:[fl],label:function(){ return sFl.target?'蓋上餵食器上蓋':'打開餵食器上蓋'; },act:function(){ sFl.target=sFl.target?0:1; }}]);
        P.box(0.05,0.052,z-0.06,z+0.06,0.14,0.27,lam(0xdfe9ee,{transparent:true,opacity:0.5,roughness:0.05}),oc);   // hopper window, kibble showing through
        P.box(0.04,0.05,z-0.055,z+0.055,0.14,0.24,kib,oc);
        P.box(0.05,0.053,z-0.03,z+0.03,0.07,0.11,lam(0x2a2d31),oc);                                                   // chute
        P.box(0.05,0.053,z-0.012,z+0.012,0.29,0.3,new THREE.MeshBasicMaterial({color:0x58d68d}),oc);                   // status light
        P.rbox(-0.13,0.17,z-0.1,z+0.1,0.006,0.02,0.02,wh);                                                           // base tray
        bowl(0.11,z,0.055,0.035,0xc9ced3,kib,0.012); P.cyl(0.11,z,0.056,0.056,0.02,0.022,steel,oc,24);
      })();
      (function(){ const wd=lam(0xd2b083,{roughness:0.6,map:M.oak.map||null}), paw=lam(0x7a5636,{roughness:0.7}), cer=lam(0xf7f5f0,{roughness:0.2,side:THREE.DoubleSide,envMapIntensity:0.8});   // solid-wood stand, 12 cm high, holding two ceramic bowls: wet food and water
        const x0=-0.07, x1=0.11, za=-0.1, zb=0.32, py=0.1;
        [[za,za+0.018,-1],[zb-0.018,zb,1]].forEach(function(q){ P.box(x0,x1,q[0],q[1],0.006,0.13,wd);
          const top=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.018,24,1,false,Math.PI/2,Math.PI),wd); top.rotation.x=Math.PI/2; top.scale.set(1,1,0.45); top.position.set((x0+x1)/2,0.13,(q[0]+q[1])/2); P.add(top);
          const fz=q[2]>0?q[1]+0.0006:q[0]-0.0006;                                                                   // paw print burnt into the outer face
          [[0,0,0.014],[-0.016,0.018,0.006],[-0.006,0.026,0.006],[0.006,0.026,0.006],[0.016,0.018,0.006]].forEach(function(t){ const d=new THREE.Mesh(new THREE.CircleGeometry(t[2],14),paw); d.position.set((x0+x1)/2+t[0],0.1+t[1],fz); d.rotation.y=q[2]>0?0:Math.PI; P.add(d,oc); }); });
        P.box(x0+0.01,x1-0.01,za+0.018,zb-0.018,py,py+0.018,wd);
        const dish=function(z,fill,fh){ const r=0.066, h=0.04, pts=[[0.001,0],[r*0.6,0],[r,h],[r+0.006,h],[r+0.006,h+0.004],[r-0.004,h+0.004],[r*0.6-0.005,0.006],[0.001,0.006]].map(function(q){ return new THREE.Vector2(q[0],q[1]); });
          const m=new THREE.Mesh(new THREE.LatheGeometry(pts,32),cer); m.scale.set(0.85,1,1); m.position.set(0.02,py-0.01,z); P.add(m);
          const f=P.cyl(0.02,z,r-0.012,r-0.012,py-0.01+fh,py-0.01+fh+0.004,fill,oc,24); f.scale.x=0.85; };
        dish(0.01,lam(0xa0634a,{roughness:0.7}),0.022); dish(0.21,lam(0x9fd3ee,{roughness:0.05,transparent:true,opacity:0.6}),0.032);
      })();
      P._col(-hw,hw,-hl,hl,false);
      return P;
    };
    Catalog.catBowls=function(){
      const P=new Piece(), lam=env.lam, S1=0.01213, oc={cast:false}, hw=20.9*S1/2, hl=50*S1/2, bx0=0.25*S1;
      P.rbox(-hw,hw,-hl,hl,0,0.006,0.008,lam(0x4a5560,{roughness:0.8}),oc);
      const bowl=function(x,z,r,h,col,fillCol,fy){
        const pts=[[0.001,0],[r*0.72,0],[r,h],[r-0.007,h],[r*0.72-0.007,0.007],[0.001,0.007]].map(function(q){ return new THREE.Vector2(q[0],q[1]); });
        const m=new THREE.Mesh(new THREE.LatheGeometry(pts,28),lam(col,{roughness:0.25,side:THREE.DoubleSide,envMapIntensity:0.8})); m.position.set(x,0.006,z); P.add(m);
        P.cyl(x,z,r-0.012,r-0.012,0.006+fy,0.006+fy+0.004,fillCol,oc,24);
      };
      bowl(bx0,(16-25)*S1,0.065,0.045,0xe6d9c6,lam(0x6b4a35,{roughness:1}),0.022);
      bowl(bx0,(40-25)*S1,0.075,0.055,0xdfe7ea,lam(0x9fd3ee,{roughness:0.05,transparent:true,opacity:0.6}),0.038);
      return P;
    };
    /* automatic litter box 58 x 65 x 65 cm, opening toward +z, with a litter mat in front */
    Catalog.litterBox=function(){
      const P=new Piece(), lam=env.lam, W=0.58, D=0.65, oc={cast:false};
      const wh=lam(0xf4f4f1,{roughness:0.25,envMapIntensity:0.8}), gr=lam(0xc8ccd0,{roughness:0.35});
      P.rbox(-W/2,W/2,-D/2,D/2,0,0.2,0.05,gr);
      const dome=new THREE.Mesh(new THREE.SphereGeometry(0.29,32,20),wh); dome.position.set(0,0.4,0); dome.scale.set(1,0.83,1.12); P.add(dome);
      const hole=new THREE.Mesh(new THREE.CircleGeometry(0.13,28),lam(0x15181b,{roughness:0.3})); hole.scale.y=1.15; hole.position.set(0,0.4,0.327); P.add(hole,oc);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(0.135,0.012,10,32),gr); rim.scale.y=1.15; rim.position.set(0,0.4,0.327); P.add(rim,oc);
      const ramp=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.02,0.28),gr); ramp.position.set(0,0.1,0.43); ramp.rotation.x=-0.75; P.add(ramp);
      P.box(0.19,0.22,0.31,0.33,0.12,0.14,new THREE.MeshBasicMaterial({color:0x66ccff}),oc);
      P.rbox(-0.32,0.32,0.5,0.9,0,0.008,0.01,lam(0x8d949c,{roughness:1}),oc);
      P._col(-W/2,W/2,-D/2,D/2,true);
      return P;
    };

function artTex(w,h,variant){                  // crisp flat-colour abstract print (arches, sun, waves) in the room's palette
      const W=Math.round(1024*Math.min(1,w/h)), H=Math.round(1024*Math.min(1,h/w)), c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
      g.fillStyle='#f3ecdf'; g.fillRect(0,0,W,H);
      const pal=['#c8714f','#e0b184','#7f9a86','#35506b','#d9a3a0'];
      if(variant===0){                              // landscape: rising sun over layered hills and a wave line
        g.fillStyle=pal[4]; g.beginPath(); g.arc(W*0.62,H*0.52,H*0.24,0,TAU); g.fill();
        [[pal[2],0.62,0.12],[pal[3],0.74,0.1],[pal[0],0.86,0.08]].forEach(function(l,i){
          g.fillStyle=l[0]; g.beginPath(); g.moveTo(0,H);
          for(let x=0;x<=W;x+=8) g.lineTo(x,H*l[1]+Math.sin(x/W*Math.PI*(2+i)+i*1.7)*H*l[2]*0.5);
          g.lineTo(W,H); g.closePath(); g.fill();
        });
        g.strokeStyle='#35506b'; g.lineWidth=H*0.012; g.beginPath();
        for(let x=0;x<=W;x+=6){ const y=H*0.2+Math.sin(x/W*Math.PI*6)*H*0.025; if(x) g.lineTo(x,y); else g.moveTo(x,y); } g.stroke();
      } else {                                      // portrait: stacked arches with a small sun
        const aw=W*0.56, ax=(W-aw)/2;
        [[pal[0],0.12],[pal[1],0.3],[pal[2],0.48]].forEach(function(l,i){
          const top=H*l[1], r=aw/2-i*aw*0.12; g.fillStyle=l[0]; g.beginPath(); g.moveTo(W/2-r,H*0.92); g.lineTo(W/2-r,top+r); g.arc(W/2,top+r,r,Math.PI,0); g.lineTo(W/2+r,H*0.92); g.closePath(); g.fill();
        });
        g.fillStyle=pal[3]; g.beginPath(); g.arc(W*0.5,H*0.7,aw*0.13,0,TAU); g.fill();
        g.fillStyle=pal[4]; g.beginPath(); g.arc(W*0.8,H*0.12,W*0.06,0,TAU); g.fill();
      }
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy; return t;
    }
    /* framed abstract print, w x h metres, centre yc metres up; wall piece: origin on the wall face, the print faces +x */
    Catalog.picture=function(w,h,yc){
      const P=new Piece(), d=0.025;
      P.box(0,d,-w/2,w/2,yc-h/2,yc+h/2,M.woodD||M.oakD,{cast:false});
      const art=new THREE.Mesh(new THREE.PlaneGeometry(w-0.08,h-0.08),new THREE.MeshStandardMaterial({map:artTex(w-0.08,h-0.08,w>=h?0:1),roughness:0.8}));
      art.position.set(d+0.002,yc,0); art.rotation.y=Math.PI/2; P.add(art,{cast:false});
      return P;
    };

    /* ---------- fixtures sized by the building (not in the registry) ---------- */
    /* flush ceiling dome for a ceiling at height h (the dome sinks 2 cm into the ceiling) */
    Catalog.ceilingLight=function(h){
      const P=new Piece(), geo=new THREE.SphereGeometry(0.14,18,8,0,TAU,Math.PI/2,Math.PI/2);
      const d=new THREE.Mesh(geo,env.lampMat); d.position.set(0,h+0.02,0); d.scale.y=0.6; P.group.add(d);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.014,8,28),mat('lampRim',0x4a4034,{metalness:0.6,roughness:0.35})); ring.rotation.x=Math.PI/2; ring.position.set(0,h-0.006,0); P.group.add(ring);
      return P;
    };
    /* curtain rail over a window w metres wide plus a gathered linen panel at each end; the room is on the -z side.
       setT(0..1): 0 gathered at both ends, 1 drawn closed; anims / actions animate it on their own when the house uses them */
    Catalog.curtains=function(w,bottom,top,opt){     // rail at `top`, panels down to `bottom` (default floor-length under a 2.12 m rail); opt: {color, tie: tied back when open}
      top=top||2.12; bottom=bottom===undefined?0.015:bottom; opt=opt||{};
      const P=new Piece(), x0=-w/2, x1=w/2, pw=0.42, ph=top-0.015-bottom, meshes=[], cm=opt.color?env.lam(opt.color,{roughness:0.95,side:THREE.DoubleSide}):M.linen, ties=[];
      P.box(x0-0.1,x1+0.1,-0.012,0.012,top,top+0.025,M.frame,{cast:false});
      [x0+pw/2-0.05,x1-pw/2+0.05].forEach(function(cx){
        const g=new THREE.PlaneGeometry(pw,ph,28,opt.tie?18:1), p=g.attributes.position;
        for(let i=0;i<p.count;i++){ const u=p.getX(i)/pw; p.setZ(i,Math.sin(u*Math.PI*8)*0.045); }
        g.computeVertexNormals();
        const m=new THREE.Mesh(g,cm); m.position.set(cx,bottom+ph/2,0); P.add(m); meshes.push(m); m.userData.base=Float32Array.from(p.array);
      });
      const ty=Math.min(1.0,ph*0.45);
      if(opt.tie) meshes.forEach(function(m,i){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.035,0.05),env.lam(0xc9b79c,{roughness:0.8})); b.position.set((i?1:-1)*0.07,bottom+ty-(bottom+ph/2),0.02); m.add(b); ties.push(b); });
      const pinch=function(m,i,k){ const p=m.geometry.attributes.position, o=m.userData.base, edge=(i?1:-1)*pw/2, yt=-ph/2+ty;   // tie-back: the panel is cinched toward its outer edge at the tie
        for(let j=0;j<p.count;j++){ const x=o[j*3], y=o[j*3+1], f=y>yt?1-0.68*(1-(y-yt)/(ph/2-yt)):1-0.68*(1-(yt-y)/(yt+ph/2))*0.6-0.27; p.setX(j,edge+(x-edge)*(1-(1-f)*k)); p.setZ(j,o[j*3+2]*(1-0.5*k*(1-f))); }
        p.needsUpdate=true; };
      P.setT=function(t){
        const e=ease(t), W=(x1-x0)/2+0.08, ww=pw+(W-pw)*e;
        if(opt.tie){ meshes.forEach(function(m,i){ pinch(m,i,1-e); }); ties.forEach(function(b){ b.visible=e<0.15; }); }
        meshes[0].scale.set(ww/pw,1,1-0.45*e); meshes[0].position.x=x0-0.05+ww/2;
        meshes[1].scale.set(ww/pw,1,1-0.45*e); meshes[1].position.x=x1+0.05-ww/2;
      };
      const st=stepper(1.6,P.setT); P.setT(0);
      P.open={get closed(){ return !!st.target; },set closed(v){ st.target=v?1:0; }};
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:0,z:-0.4,label:function(){ return st.target?'拉開窗簾':'拉上窗簾'; },act:function(){ st.target=st.target?0:1; }}];
      return P;
    };

    /* ---------- kitchen and bath fixtures (built in; heights are absolute, the house places them at floor level) ---------- */
    const S1=0.01213;                            // plan pixel of the Ctype drawing, used to keep these fixtures' original proportions
    const chromeM=function(){ return mat('chrome',0xdfe3e6,{metalness:0.95,roughness:0.18,envMapIntensity:1.3}); };
    /* sink counter w x d metres, origin at the corner (x 0..w, z 0..d), the cook stands on the -z side.
       sink = [x0,x1,z0,z1] of the cut-out; units = number of plain door fronts, or a list of {k,w} units (fill, sink, dw, spice, drawers) that open. The cabinet is hollow under the sink and the bowl really goes down. */
    Catalog.sinkCounter=function(w,d,sink,units,opt){   // opt.disposer: food-waste disposer under the drain, open space under the bowl
      const P=new Piece(), lam=env.lam, oc={cast:false};
      const tx0=-0.01, tx1=w, tz0=-0.01, tz1=d+0.04;
      P._col(0,w,0,d,true);
      if(!sink){                                  // plain base cabinet with a worktop (e.g. an island with the hob)
        P.box(0,w,0,d,0,0.84,M.cab); P.rbox(tx0,tx1,tz0,tz1,0.84,0.88,0.01,M.top);
        P.box(0,w,-0.012,0,0,0.099,M.dark,{cast:false}); P.box(0,w,-0.012,0,0.099,0.1,M.cab,{cast:false}); return fronts(P,w,d,units);
      }
      const sx0=sink[0], sx1=sink[1], sz0=sink[2], sz1=sink[3], dsp=opt&&opt.disposer;
      P.box(0,sx0,0,d,0,0.84,M.cab); P.box(sx1,w,0,d,0,0.84,M.cab); P.box(sx0,sx1,sz1,d,0,0.84,M.cab);
      if(dsp){ P.box(sx0,sx1,0,sz1,0,0.1,M.cab); P.box(sx0,sx1,0,sz1,0.1,0.118,mat('cabIn',0xf2f0ea,{roughness:0.5})); P.box(sx0,sx1,0.02,sz0,0.78,0.84,M.cab); }
      else { P.box(sx0,sx1,0,sz0,0,0.84,M.cab); P.box(sx0,sx1,sz0,sz1,0,0.6,M.cab); }
      const rr=function(x0,x1,z0,z1,r,n){          // rounded-rectangle outline as [x,z] points
        const pts=[], cs=[[x1-r,z1-r,0],[x0+r,z1-r,Math.PI/2],[x0+r,z0+r,Math.PI],[x1-r,z0+r,1.5*Math.PI]];
        cs.forEach(function(c){ for(let i=0;i<=n;i++){ const a=c[2]+i/n*Math.PI/2; pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]); } });
        return pts;
      };
      const flat=function(pts){ return pts.map(function(q){ return new THREE.Vector2(q[0],-q[1]); }); };
      const plate=function(outer,hole,y0,depth,mt){
        const sh=new THREE.Shape(outer); if(hole) sh.holes.push(new THREE.Path(hole));
        const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:depth,bevelEnabled:false,curveSegments:1}),mt); m.rotation.x=-Math.PI/2; m.position.y=y0; return P.add(m);
      };
      const R0=0.05, hole=flat(rr(sx0,sx1,sz0,sz1,R0,6));
      plate([new THREE.Vector2(tx0,-tz0),new THREE.Vector2(tx1,-tz0),new THREE.Vector2(tx1,-tz1),new THREE.Vector2(tx0,-tz1)],hole,0.84,0.04,M.top);
      const sinkM=lam(0xc9cdd1,{metalness:0.92,roughness:0.3,envMapIntensity:1.2,side:THREE.DoubleSide}), rimM=lam(0xdfe3e6,{metalness:0.95,roughness:0.2,envMapIntensity:1.3});
      plate(flat(rr(sx0-0.014,sx1+0.014,sz0-0.014,sz1+0.014,R0+0.014,6)),hole,0.88,0.006,rimM);
      const dx=(sx0+sx1)/2, dz=sz1-0.1, N=7, lv=[[0.879,0,R0],[0.74,0.004,R0-0.004],[0.722,0.02,R0-0.02],[0.714,0.045,0.03]];
      const rings=lv.map(function(l){ return rr(sx0+l[1],sx1-l[1],sz0+l[1],sz1-l[1],l[2],N); }), n=rings[0].length, pos=[], idx=[];
      rings.forEach(function(r,k){ r.forEach(function(q){ pos.push(q[0],lv[k][0],q[1]); }); });
      pos.push(dx,0.703,dz); const ctr=rings.length*n;
      for(let k=0;k<rings.length-1;k++) for(let i=0;i<n;i++){ const a=k*n+i, b=k*n+(i+1)%n, c=(k+1)*n+i, e=(k+1)*n+(i+1)%n; idx.push(a,c,b,b,c,e); }
      for(let i=0;i<n;i++) idx.push((rings.length-1)*n+i,ctr,(rings.length-1)*n+(i+1)%n);
      const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); bg.setIndex(idx); bg.computeVertexNormals();
      P.add(new THREE.Mesh(bg,sinkM),oc);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.046,0.005,8,28),rimM); ring.rotation.x=Math.PI/2; ring.position.set(dx,0.706,dz); P.add(ring,oc);
      P.cyl(dx,dz,0.042,0.042,0.7025,0.7055,M.dark,oc,24);
      if(dsp){ const slit=lam(0x6b6e72,{roughness:0.8});   // rubber splash guard with radial flaps
        for(let i=0;i<8;i++){ const a=i/8*TAU, sl=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.001,0.0025),slit); sl.rotation.y=-a; sl.position.set(dx+Math.cos(a)*0.021,0.7058,dz+Math.sin(a)*0.021); P.add(sl,oc); }
        const dm=lam(0x2f3236,{roughness:0.45,metalness:0.2});
        P.cyl(dx,dz,0.05,0.05,0.64,0.703,rimM,oc,20); P.cyl(dx,dz,0.095,0.095,0.37,0.64,dm,{},28); P.cyl(dx,dz,0.0965,0.0965,0.55,0.585,lam(0x9aa0a6,{metalness:0.6,roughness:0.35}),oc,28); P.cyl(dx,dz,0.07,0.09,0.34,0.37,dm,oc,28);
        const tube=function(pts,r,mt){ P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); })),24,r,10,false),mt),oc); };
        tube([[dx,0.47,dz+0.08],[dx,0.47,sz1-0.04],[dx,0.4,sz1-0.025],[dx,0.22,sz1-0.025],[dx,0.18,sz1+0.01]],0.02,lam(0xb8bcc0,{roughness:0.5}));   // discharge pipe into the drain
        P.box(sx0+0.08,sx0+0.15,sz1-0.006,sz1,0.26,0.33,lam(0xf4f4f2,{roughness:0.4}),oc);
        tube([[dx-0.09,0.42,dz],[dx-0.2,0.3,dz+0.03],[sx0+0.115,0.29,sz1-0.01]],0.004,M.dark);   // power cord to its outlet
        (function(){ const chrome=lam(0xd6dade,{metalness:0.92,roughness:0.18}), braid=lam(0xb9bdc1,{metalness:0.6,roughness:0.45}), red=lam(0xc8372d,{roughness:0.4}), blue=lam(0x2f6fd1,{roughness:0.4}), pvc=lam(0xe9e9e6,{roughness:0.55}), zw=sz1-0.012;   // supply: angle stops on the back panel, braided hoses up to the tap, the pull-down hose with its weight
          [[-1,red],[1,blue]].forEach(function(q){ const x=dx+q[0]*0.1; P.cyl(x,zw,0.012,0.012,0.4,0.47,chrome,oc,12); const v=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.05,10),chrome); v.rotation.x=Math.PI/2; v.position.set(x,0.45,zw-0.025); P.add(v,oc);
            const k=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.012,14),q[1]); k.rotation.x=Math.PI/2; k.position.set(x,0.45,zw-0.052); P.add(k,oc);
            tube([[x,0.47,zw],[x,0.56,zw-0.01],[x-q[0]*0.04,0.63,zw-0.006],[x-q[0]*0.05,0.66,zw+0.03]],0.0055,braid); });   // up into the back panel under the deck, below the bowl
          tube([[dx+0.02,0.66,zw+0.03],[dx+0.025,0.62,zw-0.012],[dx+0.03,0.55,zw-0.03],[dx+0.05,0.32,zw-0.04],[dx+0.07,0.25,zw-0.045],[dx+0.09,0.32,zw-0.04],[dx+0.12,0.55,zw-0.03],[dx+0.125,0.62,zw-0.012],[dx+0.13,0.66,zw+0.03]],0.006,lam(0x3a3d41,{roughness:0.6}));   // the pull-down spray hose loops down under the counter
          P.cyl(dx+0.07,zw-0.045,0.02,0.02,0.22,0.28,lam(0x55595e,{metalness:0.5,roughness:0.4}),oc,14);   // its counterweight
          P.box(dx-0.045,dx+0.045,dz-0.0975,dz-0.095,0.42,0.5,lam(0xf4f3ee,{roughness:0.4}),oc); P.box(dx-0.03,dx+0.03,dz-0.0985,dz-0.0975,0.47,0.48,lam(0x2a2c30),oc);   // nameplate on the disposer
          tube([[dx+0.08,0.5,dz],[dx+0.14,0.5,dz+0.02],[sx1-0.03,0.45,sz1-0.02],[sx1+0.05,0.3,sz1+0.02]],0.009,pvc);   // dishwasher drain into the disposer's inlet
        })();
        P.cyl(sx1-0.12,d-0.08,0.018,0.018,0.88,0.893,rimM,oc,20); P.cyl(sx1-0.12,d-0.08,0.012,0.012,0.893,0.897,lam(0xf4f4f2,{roughness:0.3}),oc,20);   // air switch for the disposer
      } else for(let i=0;i<9;i++){ const a=i/9*TAU, r=i?0.022:0, h=new THREE.Mesh(new THREE.CircleGeometry(0.0045,8),lam(0x0c0d0e)); h.rotation.x=-Math.PI/2; h.position.set(dx+Math.cos(a)*r,0.7062,dz+Math.sin(a)*r); P.add(h,oc); }
      if(!dsp) P.cyl(dx,dz,0.016,0.016,0.7055,0.7062,rimM,oc,16);
      P.box(0,w,-0.012,0,0,0.099,M.dark,oc); P.box(0,w,-0.012,0,0.099,0.1,M.cab,oc); P.box(0,w,d,d+0.002,0,0.099,M.dark,oc); P.box(w,w+0.002,-0.012,d+0.002,0,0.099,M.dark,oc);   // black kick on the front, the back and the east end; light cap so the door reveals don't show the dark plinth top
      P.openSink=dsp; return fronts(P,w,d,units);
    };
    function fronts(P,w,d,units){
      const oc={cast:false};
      if(typeof units==='number'){ P.cabDoors('x',0,w,0,-1,0.1,0.83,units,false); return P; }
      /* fronts on the cook's side (-z), left to right: fill | sink (doors) | dw (built-in dishwasher) | spice (slim pull-out) | drawers (cutlery + dishes) */
      const ft=0.018, sliders=[];
      const steelF=mat('dwSteel',0xc9ced3,{metalness:0.85,roughness:0.3,envMapIntensity:1});
      const plateM=mat('plate',0xf6f4ef,{roughness:0.25}), plateB=mat('plateB',0xc9d6df,{roughness:0.25}), wood=M.oakD;
      const drawer=function(x0,x1,y0,y1,frontMat,inner){   // a drawer box behind a front; inner(g, w, depth, floorY) adds contents in drawer-local metres
        const g=new THREE.Group(); P.group.add(g);
        const add=function(geo,mt,x,y,z,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=!!cast; m.receiveShadow=true; g.add(m); return m; };
        const bw=x1-x0-0.04, bd=d-0.1, cx=(x0+x1)/2;
        add(new THREE.BoxGeometry(x1-x0-0.006,y1-y0-0.006,ft),frontMat,cx,(y0+y1)/2,-ft/2,true);
        if(GROOVE) NOTCH(g,cx,y1-0.003,-ft,Math.PI,0,x1-x0,frontMat.color&&frontMat.color.getHex()); else add(new THREE.BoxGeometry(Math.min(0.2,bw*0.6),0.014,0.016),M.steel,cx,y1-0.05,-ft-0.008);   // bar handle
        const by0=y0+0.02, bh=Math.max(0.06,y1-y0-0.06), inn=mat('drawerIn',0xf2f0ea,{roughness:0.5});
        add(new THREE.BoxGeometry(bw,0.012,bd),inn,cx,by0,bd/2);
        [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.012,bh,bd),inn,cx+sd*bw/2,by0+bh/2,bd/2); });
        add(new THREE.BoxGeometry(bw,bh,0.012),inn,cx,by0+bh/2,bd);
        if(inner) inner(add,cx,bw,bd,by0+0.006,bh);
        return g;
      };
      let x=0;
      units.forEach(function(u){
        const x0=x, x1=x+u.w; x=x1;
        if(u.k==='fill'){ P.box(x0+0.003,x1-0.003,-ft,0,0.1,0.83,M.cabF,oc); return; }
        if(u.k==='sink'&&!P.openSink){ P.cabDoors('x',x0,x1,0,-1,0.1,0.83,2,false,null,ft); return; }
        if(u.k==='sink'){ const hw=(x1-x0)/2, gs=[];                // pair of doors hinged at the outer edges
          [[x0,1],[x1,-1]].forEach(function(q){ const g=new THREE.Group(); g.position.x=q[0]; P.group.add(g);
            const dm=new THREE.Mesh(new THREE.BoxGeometry(hw-0.006,0.73,ft),M.cabF); dm.position.set(q[1]*hw/2,0.465,-ft/2); dm.castShadow=dm.receiveShadow=true; g.add(dm);
            if(GROOVE) NOTCH(g,q[1]*(hw-0.006),0.71,-ft,Math.PI,q[1]*Math.PI/2,0.18); else { const hd=new THREE.Mesh(new THREE.BoxGeometry(0.016,0.15,0.012),M.steel); hd.position.set(q[1]*(hw-0.05),0.695,-ft-0.006); g.add(hd); } gs.push([g,q[1]]); });
          P.sinkLeaves={left:gs[0][0],right:gs[1][0],hw:hw,ft:ft};   // a house can hang things on the leaves
          const st=stepper(0.6,function(v){ const e=ease(v); gs.forEach(function(q){ q[0].rotation.y=q[1]*e*1.55; }); });
          P.anims.push(function(t){ return st.run(t); });
          P.actions=(P.actions||[]).concat([{x:x0+0.12,z:-0.5,part:gs.map(function(q){ return q[0]; }),label:function(){ return st.target?'關上水槽下櫃':'打開水槽下櫃'; },act:function(){ st.target=st.target?0:1; }}]);
          return; }
        if(u.k==='dw'){                            // Panasonic NP-60MS8W (W598 x D627 x H450, slide-open, white door panel) over a storage drawer
          const g=new THREE.Group(); P.group.add(g); const add=function(geo,mt,x,y,z,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=!!cast; m.receiveShadow=true; g.add(m); return m; };
          const cx=(x0+x1)/2, bw=0.56, bd=Math.min(0.5,d-0.08), Y0=0.37, Y1=0.83, fy=Y0+0.03, wh=0.33;
          const tc=document.createElement('canvas'); tc.width=64; tc.height=256; const tg=tc.getContext('2d'); tg.fillStyle='#c9ced3'; tg.fillRect(0,0,64,256); for(let i=0;i<220;i++){ tg.fillStyle='rgba('+(i%2?255:110)+','+(i%2?255:115)+','+(i%2?255:120)+',0.06)'; tg.fillRect(0,Math.random()*256,64,1); }
          const tt=new THREE.CanvasTexture(tc); tt.wrapS=tt.wrapT=THREE.RepeatWrapping; const tub=lam(0xffffff,{map:tt,metalness:0.7,roughness:0.35}), wireM=mat('dwWire',0x9aa1a8,{metalness:0.6,roughness:0.4}), grey=mat('dwGrey',0x6b7076,{roughness:0.5});
          add(new THREE.BoxGeometry(x1-x0-0.006,Y1-Y0-0.006,ft),M.cabF,cx,(Y0+Y1)/2,-ft/2,true);
          if(GROOVE) NOTCH(g,cx,Y1-0.003,-ft,Math.PI,0,x1-x0,M.cabF.color&&M.cabF.color.getHex()); else add(new THREE.BoxGeometry(0.2,0.014,0.016),M.steel,cx,Y1-0.05,-ft-0.008);
          add(new THREE.BoxGeometry(bw,0.01,bd),tub,cx,fy-0.005,bd/2); [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.01,wh,bd),tub,cx+sd*bw/2,fy+wh/2,bd/2); }); add(new THREE.BoxGeometry(bw,wh,0.01),tub,cx,fy+wh/2,bd); add(new THREE.BoxGeometry(bw,wh,0.01),tub,cx,fy+wh/2,0.006);   // stainless tub
          add(new THREE.BoxGeometry(0.44,0.006,0.012),mat('dwPanel',0x23272b,{roughness:0.2}),cx,Y1-0.012,0.012); add(new THREE.BoxGeometry(0.03,0.004,0.004),mat('dwLed',0x9fd6ff,{emissive:0x4aa8e8}),cx-0.17,Y1-0.007,0.012);   // controls on the top edge
          add(new THREE.CylinderGeometry(0.02,0.02,0.015,16),grey,cx,fy+0.008,bd/2); [[0.17,0],[0.17,Math.PI]].forEach(function(q){ const a=add(new THREE.BoxGeometry(q[0],0.008,0.025),grey,cx+Math.cos(q[1])*q[0]/2,fy+0.012,bd/2); });   // spray nozzle
          add(new THREE.CylinderGeometry(0.03,0.03,0.02,16),grey,cx+0.18,fy+0.01,bd-0.06);   // filter cup
          add(new THREE.BoxGeometry(0.07,0.05,0.012),grey,cx-0.19,fy+0.2,0.018); add(new THREE.BoxGeometry(0.06,0.04,0.004),mat('dwLid',0x8d939a,{roughness:0.4}),cx-0.19,fy+0.2,0.026);   // detergent cup on the inner front wall
          const rb=bw-0.04, rd=bd-0.04, ry=fy+0.05;
          for(let i=0;i<=10;i++) add(new THREE.BoxGeometry(0.004,0.004,rd),wireM,cx-rb/2+i*rb/10,ry,bd/2); for(let i=0;i<=8;i++) add(new THREE.BoxGeometry(rb,0.004,0.004),wireM,cx,ry,0.02+i*rd/8);   // basket floor
          [[ry+0.1,1],[ry+0.06,0]].forEach(function(q){ add(new THREE.BoxGeometry(rb,0.004,0.004),wireM,cx,q[0],0.02); add(new THREE.BoxGeometry(rb,0.004,0.004),wireM,cx,q[0],0.02+rd); [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.004,0.004,rd),wireM,cx+sd*rb/2,q[0],bd/2); }); });   // rails
          for(let r=0;r<2;r++) for(let i=0;i<12;i++) add(new THREE.BoxGeometry(0.003,0.07,0.003),wireM,cx-0.2+r*0.12,ry+0.035,0.06+i*0.026);   // plate tines
          const DS=THREE.DoubleSide, pl=mat('dwPlate',0xf6f4ef,{roughness:0.25,side:DS}), plB=mat('dwPlateB',0xc9d6df,{roughness:0.25,side:DS});
          for(let i=0;i<9;i++){ const r=i<5?0.11:0.085, m=add(new THREE.CylinderGeometry(r,r*0.8,0.012,24),i%3?pl:plB,cx-0.2+(i<5?0:0.12),ry+r+0.004,0.08+(i%5)*0.07,true); m.rotation.z=Math.PI/2; }   // plates on edge
          for(let i=0;i<3;i++){ const b=add(new THREE.SphereGeometry(0.06,16,8,0,Math.PI*2,0,Math.PI/2),pl,cx+0.04,ry+0.07,0.08+i*0.1); b.rotation.x=Math.PI*0.75; }   // rice bowls tipped down
          for(let i=0;i<4;i++){ const c=add(new THREE.CylinderGeometry(0.035,0.04,0.09,14,1,true),i%2?plB:pl,cx+0.13+(i%2)*0.08,ry+0.05,0.3+Math.floor(i/2)*0.09,true); c.rotation.x=Math.PI; }   // mugs upside down
          add(new THREE.BoxGeometry(0.09,0.09,0.12),mat('dwBasket',0xb9bec4,{transparent:true,opacity:0.6,roughness:0.4}),cx+0.2,ry+0.045,0.1); for(let i=0;i<6;i++) add(new THREE.BoxGeometry(0.006,0.2,0.006),i<4?mat('dwChop',0x8a5a2a,{roughness:0.6}):M.steel,cx+0.17+(i%3)*0.025,ry+0.1,0.07+Math.floor(i/3)*0.05);   // cutlery basket
          sliders.push({g:[g],out:[0.42],x:(x0+x1)/2,label:['打開洗碗機','關上洗碗機']});
          const low=drawer(x0,x1,0.1,0.37,M.cabF,function(add2,cx2,bw2,bd2,fy2){ add2(new THREE.BoxGeometry(0.12,0.18,0.08),lam(0xf6f6f2,{roughness:0.5}),cx2-0.18,fy2+0.09,0.08,true); add2(new THREE.BoxGeometry(0.122,0.05,0.082),lam(0x2a7a3e,{roughness:0.5}),cx2-0.18,fy2+0.14,0.08);
            [0,1,2].forEach(function(k){ add2(new THREE.BoxGeometry(0.2,0.012,0.3),lam(0xe9e5dc,{roughness:0.6}),cx2+0.1,fy2+0.006+k*0.013,0.2); }); });   // storage below: detergent, trays
          sliders.push({g:[low],out:[0.4],x:(x0+x1)/2+0.001,label:['打開洗碗機下方抽屜','關上洗碗機下方抽屜']}); return;
        }
        if(u.k==='slim'){                          // narrow two-tier drawer: cutting boards and wraps on top, dishwasher and cleaning stock below
          const top=drawer(x0,x1,0.46,0.83,M.cabF,function(add,cx,bw,bd,fy){
            [[0xd9b98c,-0.095],[0xeceeed,-0.07],[0x7fa36b,-0.045]].forEach(function(c){ add(new THREE.BoxGeometry(0.015,0.24,0.34),lam(c[0],{roughness:0.6}),cx+c[1],fy+0.12,bd/2,true); });
            [[0xf4f6f8,0x3d8fd1,0.015,0],[0xd5d9dd,0xb33a3a,0.075,0],[0xf1ebe0,0x8a6a48,0.045,0.05]].forEach(function(c,i){
              add(new THREE.BoxGeometry(0.055,0.05,0.31),lam(c[0],{roughness:0.5,metalness:i===1?0.5:0}),cx+c[2],fy+0.025+c[3],bd/2,true);
              add(new THREE.BoxGeometry(0.056,0.012,0.31),lam(c[1],{roughness:0.5}),cx+c[2],fy+0.042+c[3],bd/2); });
          });
          const bot=drawer(x0,x1,0.1,0.46,M.cabF,function(add,cx,bw,bd,fy){
            add(new THREE.BoxGeometry(0.11,0.18,0.09),lam(0xf08a24,{roughness:0.5}),cx-0.06,fy+0.09,0.08,true);              // dishwasher detergent
            add(new THREE.BoxGeometry(0.112,0.05,0.092),lam(0x2f6fb5,{roughness:0.5}),cx-0.06,fy+0.12,0.08);
            [0.2,0.32].forEach(function(z){ add(new THREE.CylinderGeometry(0.055,0.055,0.22,18),lam(0xfbfbf8,{roughness:0.9}),cx-0.06,fy+0.11,z,true); });   // kitchen paper rolls
            for(let k=0;k<3;k++) add(new THREE.BoxGeometry(0.09,0.03,0.065),lam([0xf2c94c,0x7fbf6a,0xe86a6a][k],{roughness:0.8}),cx+0.07,fy+0.015+k*0.03,0.09);   // spare sponges
            add(new THREE.BoxGeometry(0.1,0.1,0.2),lam(0x3a3f45,{roughness:0.6}),cx+0.07,fy+0.05,0.3,true);                   // box of bin bags
          });
          const sT=stepper(0.5,function(t){ top.position.z=-0.4*ease(t); }), sB=stepper(0.5,function(t){ bot.position.z=-0.45*ease(t); });
          P.anims.push(function(t){ return sT.run(t); }); P.anims.push(function(t){ return sB.run(t); });
          (P.actions=P.actions||[]).push({x:(x0+x1)/2,z:-0.55,part:[top,bot],label:function(){ return sB.target?'關上抽屜':sT.target?'改開下層（洗碗機洗劑・紙巾）':'打開砧板・保鮮膜抽屜'; },
            act:function(){ if(sB.target){ sB.target=0; } else if(sT.target){ sT.target=0; sB.target=1; } else sT.target=1; }}); return;
        }
        if(u.k==='spice'){                         // slim full-height pull-out beside the hob: three open tiers with gallery rails, packed with seasonings
          const g=new THREE.Group(); P.group.add(g);
          const add=function(geo,mt,x,y,z,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=!!cast; m.receiveShadow=true; g.add(m); return m; };
          const cx=(x0+x1)/2, bw=x1-x0-0.03, bd=d-0.08, wire=M.steel, inn=mat('drawerIn',0xf2f0ea,{roughness:0.5});
          add(new THREE.BoxGeometry(x1-x0-0.006,0.724,ft),M.cabF,cx,0.465,-ft/2,true);
          if(GROOVE) NOTCH(g,cx,0.827,-ft,Math.PI,0,x1-x0); else add(new THREE.BoxGeometry(Math.min(0.2,bw*0.6),0.014,0.016),M.steel,cx,0.78,-ft-0.008);
          add(new THREE.BoxGeometry(bw,0.68,0.01),inn,cx,0.46,bd);                                        // back panel
          [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.012,0.68,0.012),wire,cx+sd*bw/2,0.46,bd/2); });
          const wrap=function(txt,bg,fg){ return Catalog.pack.label(txt,bg,fg,256,96); };
          const bottle=function(x,z,y,o){ const r=o.r, h=o.h, bm=lam(o.c,o.glass?{roughness:0.08,transparent:true,opacity:0.85}:{roughness:0.3});
            add(new THREE.CylinderGeometry(r,r,h*0.72,18),bm,x,y+h*0.36,z,true);
            if(o.sq){ add(new THREE.CylinderGeometry(r*0.42,r,h*0.12,18),bm,x,y+h*0.78,z); add(new THREE.CylinderGeometry(r*0.42,r*0.42,h*0.1,14),bm,x,y+h*0.89,z); }   // shoulder and neck
            else add(new THREE.CylinderGeometry(r*0.85,r,h*0.06,18),bm,x,y+h*0.75,z);
            add(new THREE.CylinderGeometry(r+0.0012,r+0.0012,h*0.36,24,1,true),wrap(o.t,o.lb||'#f7f3e8',o.lf||'#3a2a1e'),x,y+h*0.36,z);
            const cr=o.sq?r*0.48:r*0.9; add(new THREE.CylinderGeometry(cr,cr,o.ch||0.02,14),lam(o.cap,{roughness:0.35,metalness:o.metal?0.7:0}),x,y+(o.sq?h*0.94:h*0.78)+(o.ch||0.02)/2,z); };
          const rows=[
            [0.1,[{t:'みりん',r:0.034,h:0.25,c:0xd9a24a,glass:1,sq:1,cap:0xd8b46a,metal:1},{t:'米酢',r:0.034,h:0.24,c:0xf0ead8,glass:1,sq:1,cap:0xf2f2ee,lb:'#ffffff',lf:'#2a5f9e'},{t:'料理酒',r:0.034,h:0.25,c:0xe9edf0,glass:1,sq:1,cap:0x2a5f9e,lb:'#f4f8fc',lf:'#1d3f6e'},{t:'オイスター',r:0.03,h:0.17,c:0x2a1810,cap:0xc9372c,lb:'#fff6e6',lf:'#8a1f1a'},{t:'ポン酢',r:0.032,h:0.22,c:0xd8a35a,glass:1,sq:1,cap:0xe08a2a,lb:'#fffaf0',lf:'#6b3a12'},{t:'めんつゆ',r:0.034,h:0.23,c:0x3a1c10,sq:1,cap:0xf2f2ee,lb:'#f6ecd8',lf:'#5a2a12'},{t:'酒',r:0.03,h:0.2,c:0xe2e8ea,glass:1,sq:1,cap:0xd9d2c0}]],
            [0.38,[{t:'しょうゆ',r:0.04,h:0.27,c:0x3a1c10,sq:1,cap:0xc9372c,lb:'#ffffff',lf:'#b3241c'},{t:'ごま油',r:0.034,h:0.21,c:0x8a4a12,glass:1,sq:1,cap:0xd8b46a,metal:1,lb:'#f2e2b8',lf:'#5a2a08'},{t:'OLIVE OIL',r:0.03,h:0.28,c:0x2f4a1e,glass:1,sq:1,cap:0x1d1f22,lb:'#f1ead2',lf:'#2f4a1e'},{t:'サラダ油',r:0.036,h:0.26,c:0xf2d784,glass:1,sq:1,cap:0xf4d13a,lb:'#ffffff',lf:'#b37a12'},{t:'しょうゆ',r:0.034,h:0.2,c:0x3a1c10,sq:1,cap:0xc9372c,lb:'#ffffff',lf:'#b3241c'},{t:'米油',r:0.034,h:0.24,c:0xf4e3a8,glass:1,sq:1,cap:0x3a8a4a,lb:'#ffffff',lf:'#2f6b3a'}]],
            [0.68,[{t:'ブラックペッパー',r:0.024,h:0.11,c:0x2a2522,glass:1,cap:0x1d1f22,ch:0.035,lb:'#1d1f22',lf:'#f2f2ee'},{t:'こしょう',r:0.022,h:0.09,c:0xf4f2ec,cap:0xc9372c,lb:'#ffffff',lf:'#3a3a3a'},{t:'塩',r:0.024,h:0.1,c:0xffffff,glass:1,cap:0xe9e9e6,lb:'#ffffff',lf:'#2a5f9e'},{t:'ガーリック',r:0.022,h:0.09,c:0xe8dcc0,glass:1,cap:0xb38a4a,lb:'#fff8ea',lf:'#6b4a1e'},{t:'七味',r:0.02,h:0.08,c:0xc9372c,cap:0xd8453c,lb:'#fff1e6',lf:'#8a1f1a'},{t:'いりごま',r:0.024,h:0.09,c:0xe8d8a0,glass:1,cap:0x8a6a3a,lb:'#fffaf0',lf:'#5a4a2a'},{t:'シナモン',r:0.02,h:0.09,c:0x8a5a2a,glass:1,cap:0x5a3a1e,lb:'#f6ecdc',lf:'#5a3a1e'},{t:'パプリカ',r:0.02,h:0.09,c:0xb5452f,glass:1,cap:0x3a3a3a,lb:'#fff3ec',lf:'#8a2a1a'},{t:'ナツメグ',r:0.02,h:0.08,c:0x8a6a48,glass:1,cap:0x3a3a3a,lb:'#f6efe4',lf:'#5a3a1e'},{t:'一味',r:0.02,h:0.08,c:0xd8453c,cap:0xd8453c,lb:'#fff1e6',lf:'#8a1f1a'}]]];
          rows.forEach(function(rw){ const y=rw[0], list=rw[1];
            add(new THREE.BoxGeometry(bw,0.01,bd),inn,cx,y,bd/2);
            [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.006,0.006,bd),wire,cx+sd*(bw/2-0.003),y+0.06,bd/2); });   // gallery rails
            const nr=Math.ceil(list.length/2); list.forEach(function(o,k){ const j=k%2, i=Math.floor(k/2), x=cx+(j?1:-1)*Math.min(0.042,bw/2-o.r-0.004), z=0.045+i*(bd-0.08)/Math.max(1,nr-1); bottle(x,z,y+0.005,o); });
          });
          sliders.push({g:[g],out:[0.45],x:(x0+x1)/2,label:['拉出調味料架','推回調味料架']}); return;
        }
        if(u.k==='drawers'){                       // top: cutlery tray, chopsticks; bottom: stacked plates, bowls and a pot
          const top=drawer(x0,x1,0.65,0.83,M.cabF,function(add,cx,bw,bd,fy){
            const tray=mat('cutTray',0xf2f2ef,{roughness:0.6}), steel=M.steel, n=5, tw=(bw-0.03)/2, xl=cx+0.005, cw=tw/n;   // right half: white tray with five compartments (chopsticks, spoons, forks, knives, teaspoons); left half: cooking utensils
            add(new THREE.BoxGeometry(tw,0.004,bd-0.03),tray,xl+tw/2,fy+0.002,bd/2);
            for(let i=0;i<=n;i++) add(new THREE.BoxGeometry(0.005,0.045,bd-0.03),tray,xl+i*cw,fy+0.022,bd/2);
            const col=function(i){ return xl+(i+0.5)*cw; }, len=0.2, zc=bd*0.5;
            const spoon=function(x,y,s){ add(new THREE.BoxGeometry(0.011*s,0.004,len*0.62*s),steel,x,y,zc+len*0.17*s); const b=add(new THREE.SphereGeometry(0.02*s,14,8),steel,x,y,zc-len*0.28*s); b.scale.set(1,0.25,1.45); };
            const fork=function(x,y){ add(new THREE.BoxGeometry(0.011,0.004,len*0.6),steel,x,y,zc+len*0.17); add(new THREE.BoxGeometry(0.024,0.004,0.03),steel,x,y,zc-len*0.17); for(let k=0;k<4;k++) add(new THREE.BoxGeometry(0.003,0.004,0.045),steel,x-0.0105+k*0.007,y,zc-len*0.32); };
            const knife=function(x,y){ add(new THREE.BoxGeometry(0.013,0.006,len*0.5),lam(0x2a2a2a,{roughness:0.4}),x,y,zc+len*0.22); add(new THREE.BoxGeometry(0.018,0.002,len*0.52),steel,x,y,zc-len*0.25); };
            for(let k=0;k<5;k++){ const ox=(k-2)*0.0025, oy=fy+0.006+k*0.0035;
              [0,1].forEach(function(j){ add(new THREE.BoxGeometry(0.007,0.007,0.23),lam(k%2?0x3a2a22:0xb25a3a,{roughness:0.5}),col(0)+ox*1.6+(j?0.009:-0.002),fy+0.006+(k%3)*0.008,zc).castShadow=true; });   // chopstick pairs
              spoon(col(1)+ox,oy,1); fork(col(2)+ox,oy); knife(col(3)+ox,oy); spoon(col(4)+ox,oy,0.7); }
            const ux=cx-bw/2+0.01, uw=tw, nyl=lam(0x2a2a2a,{roughness:0.5}), DS=THREE.DoubleSide;                                 // cooking utensils laid side by side
            add(new THREE.BoxGeometry(uw,0.004,bd-0.03),tray,ux+uw/2,fy+0.002,bd/2);
            const ucol=function(i){ return ux+0.03+i*(uw-0.06)/4; };
            add(new THREE.BoxGeometry(0.018,0.01,0.2),nyl,ucol(0),fy+0.01,zc+0.08); add(new THREE.BoxGeometry(0.065,0.004,0.09),nyl,ucol(0),fy+0.008,zc-0.08);   // turner (鍋鏟)
            for(let k=0;k<3;k++) add(new THREE.BoxGeometry(0.006,0.005,0.06),tray,ucol(0)-0.018+k*0.018,fy+0.011,zc-0.08);
            add(new THREE.BoxGeometry(0.014,0.008,0.22),steel,ucol(1),fy+0.03,zc+0.06); const lb=add(new THREE.SphereGeometry(0.04,18,10,0,Math.PI*2,Math.PI/2,Math.PI/2),lam(0xc9ced3,{metalness:0.85,roughness:0.25,side:DS}),ucol(1),fy+0.045,zc-0.1); lb.scale.y=0.9;   // ladle (湯勺)
            [-1,1].forEach(function(sd){ const t=add(new THREE.BoxGeometry(0.014,0.006,0.24),steel,ucol(2)+sd*0.012,fy+0.008,zc); t.rotation.y=sd*0.06; });   // tongs (夾子)
            add(new THREE.BoxGeometry(0.03,0.008,0.012),steel,ucol(2),fy+0.008,zc+0.12);
            add(new THREE.CylinderGeometry(0.009,0.009,0.12,10),nyl,ucol(3),fy+0.012,zc+0.1).rotation.x=Math.PI/2;                // whisk
            for(let k=0;k<4;k++){ const r=add(new THREE.TorusGeometry(0.03,0.0015,6,20),steel,ucol(3),fy+0.03,zc-0.04); r.rotation.y=k*Math.PI/4; r.scale.set(1,0.6,1.8); }
            add(new THREE.BoxGeometry(0.02,0.012,0.1),lam(0xd8453c,{roughness:0.5}),ucol(4),fy+0.008,zc+0.03); add(new THREE.BoxGeometry(0.04,0.004,0.05),steel,ucol(4),fy+0.008,zc-0.05);   // peeler
          });
          const bot=drawer(x0,x1,0.1,0.65,M.cabF,function(add,cx,bw,bd,fy){
            const DS=THREE.DoubleSide, cer=lam(0xf6f3ec,{roughness:0.25,side:DS}), cerB=lam(0xc9d6df,{roughness:0.25,side:DS}), potM=lam(0xc9ced3,{metalness:0.85,roughness:0.25,side:DS}), blkH=lam(0x2a2826,{roughness:0.5});
            const L=cx-bw/2, R=cx+bw/2;
            add(new THREE.BoxGeometry(0.2,0.012,0.24),wood,L+0.12,fy+0.006,0.12);                                              // peg rack: plates standing on edge
            for(let i=0;i<4;i++) [-1,1].forEach(function(sd){ add(new THREE.CylinderGeometry(0.005,0.005,0.08,8),wood,L+0.04+i*0.05,fy+0.05,0.12+sd*0.115); });
            for(let i=0;i<7;i++){ const pl=add(new THREE.CylinderGeometry(0.11,0.09,0.014,28),i%3===2?cerB:cer,L+0.05+i*0.024,fy+0.12,0.12,true); pl.rotation.z=Math.PI/2; }
            const bowl=function(x,z,r,y,m){ const b=add(new THREE.SphereGeometry(r,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),m,x,y+r,z,true); add(new THREE.CylinderGeometry(r*0.45,r*0.45,0.01,16),m,x,y+0.005,z); return b; };
            [[L+0.31,0.1,0.065,cer],[L+0.46,0.1,0.06,cerB]].forEach(function(q){ for(let i=0;i<3;i++) bowl(q[0],q[1],q[2],fy+i*0.028,q[3]); });   // stacked rice and soup bowls, open side up
            const mug=function(x,z,m){ add(new THREE.CylinderGeometry(0.04,0.036,0.095,18,1,true),m,x,fy+0.048,z,true); add(new THREE.CylinderGeometry(0.036,0.036,0.006,18),m,x,fy+0.003,z);
              const h=add(new THREE.TorusGeometry(0.024,0.006,8,16,Math.PI),m,x+0.046,fy+0.05,z); h.rotation.z=-Math.PI/2; };
            [[L+0.31,0.235,cer],[L+0.43,0.215,cerB]].forEach(function(q){ mug(q[0],q[1],q[2]); });          // mugs
            const pot=function(r,h,x,y,z){ add(new THREE.CylinderGeometry(r,r,h,28,1,true),potM,x,y+h/2,z,true); add(new THREE.CylinderGeometry(r,r,0.006,28),potM,x,y+0.003,z); [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.02,0.015,0.035),blkH,x,y+h-0.02,z+sd*(r+0.012)); }); };
            pot(0.105,0.14,L+0.4,fy,0.38); pot(0.072,0.095,L+0.4,fy+0.008,0.38);                                              // large and small saucepans, the small one nested inside
            const pan=function(r,x,y,z,m){ add(new THREE.CylinderGeometry(r,r-0.02,0.045,28,1,true),m,x,y+0.022,z,true); add(new THREE.CylinderGeometry(r-0.02,r-0.02,0.004,28),m,x,y+0.002,z); };
            pan(0.125,L+0.14,fy,0.37,blkH); pan(0.105,L+0.14,fy+0.03,0.37,lam(0x8a3a2a,{roughness:0.5,side:DS}));             // two frying pans with detachable handles, nested
            add(new THREE.BoxGeometry(0.03,0.02,0.15),lam(0x6b4a35,{roughness:0.5}),L+0.14,fy+0.065,0.37);                     // the detachable handle, laid across them
          });
          sliders.push({g:[top],out:[0.4],x:(x0+x1)/2-0.12,label:['打開餐具・調理工具抽屜','關上餐具・調理工具抽屜']});
          sliders.push({g:[bot],out:[0.5],x:(x0+x1)/2+0.12,label:['打開鍋碗抽屜','關上鍋碗抽屜']}); return;
        }
      });
      P.actions=P.actions||[];
      sliders.forEach(function(sl){
        const st=stepper(0.5,function(t){ const e=ease(t); sl.g.forEach(function(g,i){ g.position.z=-sl.out[i]*e; }); });
        P.anims.push(function(t){ return st.run(t); });
        P.actions.push({x:sl.x,z:-0.55,part:sl.g,label:function(){ return sl.label[st.target?1:0]; },act:function(){ st.target=st.target?0:1; }});
      });
      return P;
    };
    /* 60 x 49 cm IH hob set into a worktop at 0.875 m, three rings */
    /* built-in 3-zone IH, 60 cm type (W60 x D50 cm): black glass in a thin frame, two Ø22 cm front zones, a smaller rear one, a touch strip along the front edge; front toward -z */
    Catalog.ihHob2=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, W=0.3, D=0.25, y=0.88;
      P.rbox(-W,W,-D,D,y-0.005,y+0.006,0.01,lam(0xb9bec4,{metalness:0.8,roughness:0.3}));   // thin frame
      P.rbox(-W+0.006,W-0.006,-D+0.006,D-0.006,y+0.004,y+0.009,0.008,lam(0x0d0f12,{roughness:0.06,metalness:0.2,envMapIntensity:1.1}));   // glass
      const zones=[{x:0.14,z:-0.03,r:0.11,n:'左'},{x:-0.14,z:-0.03,r:0.11,n:'右'},{x:0,z:0.14,r:0.08,n:'奧'}];   // left and right as seen from the kitchen side (-z)
      zones.forEach(function(q){ const ring=new THREE.Mesh(new THREE.RingGeometry(q.r-0.004,q.r,48),new THREE.MeshBasicMaterial({color:0x5a5f66})); ring.rotation.x=-Math.PI/2; ring.position.set(q.x,y+0.0095,q.z); P.add(ring,oc);
        const glow=new THREE.Mesh(new THREE.RingGeometry(q.r*0.35,q.r*0.92,48),new THREE.MeshBasicMaterial({color:0xff5a1e,transparent:true,opacity:0,depthWrite:false})); glow.rotation.x=-Math.PI/2; glow.position.set(q.x,y+0.0097,q.z); P.add(glow,oc); q.ring=ring; q.glow=glow; q.lv=0; });
      const c=document.createElement('canvas'); c.width=1024; c.height=96; const g=c.getContext('2d'), tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=env.anisotropy||4;
      let main=false, timer=0;
      const draw=function(){ g.fillStyle='#0d0f12'; g.fillRect(0,0,1024,96); g.font='bold 22px sans-serif'; g.textAlign='center';
        g.fillStyle=main?'#ff6a2a':'#9aa0a6'; g.beginPath(); g.arc(960,48,26,0,Math.PI*2); g.lineWidth=3; g.strokeStyle=g.fillStyle; g.stroke(); g.fillText('⏻',960,56); g.font='14px sans-serif'; g.fillText('主電源',960,90);
        [[140,zones[0]],[512,zones[2]],[800,zones[1]]].forEach(function(q){ const z=q[1], x=q[0]; g.fillStyle='#9aa0a6'; g.font='bold 20px sans-serif'; g.fillText('−',x-110,56); g.fillText('＋',x+110,56); g.font='14px sans-serif'; g.fillText(z.n,x,20);
          for(let i=0;i<7;i++){ g.fillStyle=i<z.lv?'#ff5a1e':'#2c3036'; g.fillRect(x-70+i*20,40,14,18); } });
        g.fillStyle='#ff6a2a'; g.font='bold 24px monospace'; g.fillText(main?(timer?String(timer).padStart(2,'0')+':00':'--:--'):'',330,60); g.fillStyle='#9aa0a6'; g.font='14px sans-serif'; g.fillText('タイマー',330,22); tx.needsUpdate=true; };
      draw(); const strip=new THREE.Mesh(new THREE.PlaneGeometry(0.56,0.052),new THREE.MeshBasicMaterial({map:tx})); strip.rotation.set(-Math.PI/2,0,Math.PI); strip.position.set(0,y+0.0096,-D+0.04); P.add(strip,oc);
      const set=function(q,on){ q.lv=on?5:0; q.glow.material.opacity=on?0.55:0; q.ring.material.color.setHex(on?0xff7a3a:0x5a5f66); main=zones.some(function(z){ return z.lv>0; }); draw(); };
      P.actions=[0,1].map(function(i){ const q=zones[i]; return {x:q.x,z:-0.55,label:function(){ return (q.lv?'關閉':'開啟')+' IH（'+q.n+'）'; },act:function(){ set(q,!q.lv); if(env.toast) env.toast(q.lv?'IH（'+q.n+'）火力 5':'IH（'+q.n+'）關閉'); }}; });
      P.actions.push({x:0,z:-0.55,label:function(){ return main?'IH 計時 '+(timer?timer+' 分':'關'):'IH 計時'; },act:function(){ timer=(timer+5)%20; draw(); }});
      return P;
    };
    Catalog.ihHob=function(){
      const P=new Piece();
      P.box(-25*S1,25*S1,-20*S1,20*S1,0.875,0.89,M.hob);
      [[-13,-8],[13,-8],[0,10]].forEach(function(p){
        const r=new THREE.Mesh(new THREE.TorusGeometry(0.055,0.009,8,20),M.steel); r.rotation.x=Math.PI/2; r.position.set(p[0]*S1,0.895,p[1]*S1); P.add(r,{cast:false,recv:false});
        P.cyl(p[0]*S1,p[1]*S1,0.035,0.035,0.89,0.9,M.dark,{cast:false},14);
      });
      return P;
    };
    /* gooseneck mixer tap with a side lever on a worktop at 0.88 m; the spout reaches toward -z */
    Catalog.mixerTap=function(){
      const P=new Piece(), chrome=chromeM(), oc={cast:false};
      P.cyl(0,0,0.034,0.04,0.88,0.896,chrome,{},28); P.cyl(0,0,0.02,0.024,0.896,1.03,chrome,{},24);
      const path=new THREE.CatmullRomCurve3([[0,1.03],[0,1.13],[0.004,1.21],[0.05,1.262],[0.13,1.27],[0.2,1.225],[0.222,1.14]].map(function(q){ return new THREE.Vector3(0,q[1],-q[0]); }));
      const neck=new THREE.Mesh(new THREE.TubeGeometry(path,48,0.0105,12,false),chrome); P.add(neck,oc);
      P.cyl(0,-0.222,0.0135,0.012,1.085,1.145,chrome,oc,16); P.cyl(0,-0.222,0.01,0.01,1.083,1.086,M.dark,oc,12);
      const lever=new THREE.Mesh(new THREE.CylinderGeometry(0.0065,0.0065,0.1,12),chrome); lever.rotation.z=Math.PI/2-0.35; lever.position.set(0.052,1.017,0); P.add(lever,oc);
      P.rbox(0.082,0.108,-0.012,0.012,1.026,1.04,0.005,chrome,oc);
      return P;
    };
    /* pull-down tap on a worktop at 0.88 m: the spray head docks in the gooseneck and pulls out on its hose; the spout reaches toward -z */
    Catalog.pullDownTap=function(){
      const P=new Piece(), chrome=chromeM(), oc={cast:false}, lam=env.lam, TIP=new THREE.Vector3(0,1.14,-0.222);
      P.cyl(0,0,0.034,0.04,0.88,0.896,chrome,{},28); P.cyl(0,0,0.02,0.024,0.896,1.03,chrome,{},24);
      const path=new THREE.CatmullRomCurve3([[0,1.03],[0,1.13],[0.004,1.21],[0.05,1.262],[0.13,1.27],[0.2,1.225],[0.222,1.14]].map(function(q){ return new THREE.Vector3(0,q[1],-q[0]); }));
      P.add(new THREE.Mesh(new THREE.TubeGeometry(path,48,0.0115,12,false),chrome),oc);
      const lever=new THREE.Mesh(new THREE.CylinderGeometry(0.0065,0.0065,0.1,12),chrome); lever.rotation.z=Math.PI/2-0.35; lever.position.set(0.052,1.017,0); P.add(lever,oc);
      P.rbox(0.082,0.108,-0.012,0.012,1.026,1.04,0.005,chrome,oc);
      const HD=new THREE.Group(); P.group.add(HD);                                                  // spray head, nozzle face at local -y
      const hm=function(geo,mt,y){ const m=new THREE.Mesh(geo,mt); m.position.y=y; HD.add(m); return m; };
      hm(new THREE.CylinderGeometry(0.0135,0.019,0.08,20),chrome,-0.04); hm(new THREE.CylinderGeometry(0.0185,0.0185,0.004,20),lam(0x2a2c30,{roughness:0.5}),-0.081);
      const bt=hm(new THREE.BoxGeometry(0.012,0.022,0.006),lam(0x2a2c30,{roughness:0.4}),-0.035); bt.position.z=0.0165;   // spray / stream toggle
      const water=hm(new THREE.ConeGeometry(0.035,0.2,18,1,true),lam(0xd8ecf6,{transparent:true,opacity:0.35,roughness:0.05,depthWrite:false}),-0.183); water.visible=false;
      const hoseM=lam(0x9ea3a8,{metalness:0.7,roughness:0.35}); let hose=null;
      const OUT=new THREE.Vector3(0.07,0.99,-0.31), AIM=[[-0.45,0],[-0.2,0.75]];                  // pulled out over the bowl: rinse the back, then swing to the side
      let pull=0, aim=0;
      const apply=function(){ const e=ease(pull);
        HD.position.lerpVectors(TIP,OUT,e); HD.rotation.set(e*(AIM[0][0]+(AIM[1][0]-AIM[0][0])*aim),0,e*AIM[1][1]*aim);
        if(hose){ HD.parent.remove(hose); hose.geometry.dispose(); hose=null; }
        if(e>0.01){ const mid=TIP.clone().lerp(HD.position,0.5); mid.y-=0.05*e; hose=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([TIP.clone(),mid,HD.position.clone()]),20,0.006,8,false),hoseM); P.group.add(hose); }
        water.visible=pull===1; };
      const sp=stepper(0.7,function(v){ pull=v; apply(); }), sa=stepper(0.6,function(v){ aim=v; apply(); }); sp.v=0; sa.v=0; apply();
      P.anims.push(function(t){ const a=sp.run(t), b=sa.run(t); return a||b; });
      P.actions=[{x:0.375,z:-0.55,label:function(){ return !sp.target?'拉出水龍頭蓮蓬頭':!sa.target?'換個角度沖':'收回蓮蓬頭'; },
        act:function(){ if(!sp.target) sp.target=1; else if(!sa.target) sa.target=1; else { sp.target=0; sa.target=0; } }}];
      return P;
    };
    /* dish rack on a worktop at 0.88 m: tray, wire posts and rails, four plates, two mugs */
    Catalog.dishRack=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, rx0=-13.5*S1, rx1=13.5*S1, rz0=-11*S1, rz1=11*S1, rk=lam(0x5d6168,{roughness:0.5});
      P.rbox(rx0,rx1,rz0,rz1,0.88,0.89,0.008,lam(0xe6e9ea,{roughness:0.5}));
      [[rx0+0.02,rz0+0.02],[rx0+0.02,rz1-0.02],[rx1-0.02,rz0+0.02],[rx1-0.02,rz1-0.02]].forEach(function(q){ P.cyl(q[0],q[1],0.003,0.003,0.89,0.99,rk,oc,6); });
      [rz0+0.02,rz1-0.02].forEach(function(z){ const r=P.cyl(0,z,0.003,0.003,0,1,rk,oc,6); r.rotation.z=Math.PI/2; r.scale.y=rx1-rx0-0.04; r.position.y=0.9; });
      [0,1,2,3].forEach(function(i){ const pl=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.095,0.012,28),lam(i%2?0xf3f1ea:0xdfe9ee,{roughness:0.2})); pl.rotation.z=Math.PI/2; pl.position.set(rx0+0.05+i*0.05,0.99,0); P.add(pl,oc); });
      [0,1].forEach(function(i){ P.cyl(rx0+0.07+i*0.14,rz1-0.035,0.04,0.034,0.89,0.95,i?M.ceramic:lam(0x6f8fa8,{roughness:0.3}),oc,16); });
      return P;
    };
    /* dish soap pump bottle with a sponge beside it, on a worktop at 0.88 m */
    /* slim dish drying rack (水切りラック, ~40 W x 30 D x 15 H) on a worktop at 0.88 m: white-coated steel, drain tray whose spout faces +x into the sink */
    /* plump down-style pillow w x h, d thick at the centre, thinning to soft seams; returns a group (local z = thickness) with a piping line round the seam */
    Catalog.softPillow=function(w,h,d,mt){
      const g=new THREE.BoxGeometry(w,h,d,16,16,4), p=g.attributes.position;
      for(let i=0;i<p.count;i++){ const x=p.getX(i)/(w/2), y=p.getY(i)/(h/2), z=p.getZ(i), f=Math.pow(Math.max(0,(1-x*x*x*x)*(1-y*y*y*y)),0.55), pin=1-0.06*Math.abs(x*y);
        p.setXYZ(i,p.getX(i)*pin,p.getY(i)*pin,z*(0.12+0.88*f)); }
      g.computeVertexNormals(); const G=new THREE.Group(), m=new THREE.Mesh(g,mt); m.castShadow=m.receiveShadow=true; G.add(m);
      const pts=[]; for(let i=0;i<48;i++){ const a=i/48*Math.PI*2, cx=Math.cos(a), cy=Math.sin(a), k=1/Math.pow(Math.pow(Math.abs(cx),4)+Math.pow(Math.abs(cy),4),0.25); pts.push(new THREE.Vector3(cx*k*w/2*0.95,cy*k*h/2*0.95,0)); }
      G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),96,0.006,6,true),mt)); return G;
    };
    /* over-sink dish rack (Tower style) resting across the sink rims at 0.886 m: 18 cm wide along x, spanning L front-to-back; wire bars with bowls on one half, a slotted tray with chopsticks on the other */
    Catalog.overSinkRack=function(L){
      L=L||0.39; const P=new Piece(), lam=env.lam, oc={cast:false}, Y=0.886, X=0.09, wire=lam(0xf4f4f1,{roughness:0.3,metalness:0.2}), cer=lam(0xf6f3ec,{roughness:0.25}), wood=lam(0x7a4a2c,{roughness:0.5});
      [-X,X-0.006].forEach(function(x){ P.box(x,x+0.006,-L/2,L/2,Y,Y+0.012,wire); }); [-L/2,-L/2+0.012,L/2-0.012].forEach(function(z){ P.box(-X,X,z,z+0.012,Y,Y+0.01,wire,oc); }); P.box(-X,X,-0.006,0.006,Y,Y+0.01,wire,oc);   // frame resting on the rims
      for(let k=0;k<7;k++){ const x=-X+0.012+k*0.026; P.box(x-0.002,x+0.002,-L/2+0.012,-0.006,Y+0.002,Y+0.006,wire,oc); }   // wire bars (front half)
      const tr=lam(0xf8f8f6,{roughness:0.35}); P.box(-X+0.006,X-0.006,0.006,L/2-0.012,Y+0.002,Y+0.007,tr); for(let i=0;i<5;i++) for(let j=0;j<8;j++){ P.box(-X+0.02+i*0.033,-X+0.03+i*0.033,0.02+j*0.021,0.024+j*0.021,Y+0.0072,Y+0.0074,lam(0xbfc2c4),oc); }   // slotted tray (back half)
      const bowl=function(z,r,mt,h){ const b=new THREE.Mesh(new THREE.SphereGeometry(r,20,10,0,Math.PI*2,0,Math.PI/2),mt); b.scale.y=h; b.position.set(0,Y+0.006,z); b.castShadow=true; P.add(b); };
      bowl(-0.13,0.06,cer,0.9); bowl(-0.05,0.055,wood,0.85);   // rice bowl, miso bowl upside down
      P.rbox(-0.07,0.07,-0.19+0.012,-0.15,Y+0.006,Y+0.06,0.01,lam(0xe9e3d6,{roughness:0.4}));   // lunch box on its side
      [[0.02,0x6b4a35],[0.028,0x6b4a35],[0.036,0xc9a074],[0.044,0xc9a074]].forEach(function(q){ P.box(-0.07,0.07,q[0]+0.02,q[0]+0.025,Y+0.008,Y+0.013,lam(q[1],{roughness:0.5}),oc); });   // chopsticks lying on the tray
      [[0.12,0xd8453c],[0.13,0x3f7d4e],[0.14,0xf2c94c]].forEach(function(q){ P.box(-0.03,0.03,q[0],q[0]+0.004,Y+0.008,Y+0.011,lam(q[1],{roughness:0.5}),oc); });   // bento picks
      P.cyl(0.05,0.16,0.015,0.015,Y+0.008,Y+0.016,lam(0xf2f2f0,{roughness:0.4}),oc,14);   // a bottle cap
      return P;
    };
    Catalog.dryingRack=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, Y=0.88, X=0.19, Z=0.15, wire=lam(0xf4f4f1,{roughness:0.35,metalness:0.2}), tray=lam(0xf7f7f5,{roughness:0.3});
      const cer=[lam(0xf6f3ec,{roughness:0.25}),lam(0xc9d6df,{roughness:0.25}),lam(0xe8d7c0,{roughness:0.3})];
      const add=function(geo,mt,x,y,z,rx,rz){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.rotation.set(rx||0,0,rz||0); m.castShadow=true; P.group.add(m); return m; };
      P.box(-X,X,-Z,Z,Y,Y+0.006,tray); [[-X,-X+0.006,-Z,Z],[X-0.006,X,-Z,Z],[-X,X,-Z,-Z+0.006],[-X,X,Z-0.006,Z]].forEach(function(r){ P.box(r[0],r[1],r[2],r[3],Y+0.006,Y+0.02,tray,oc); });
      P.box(X,X+0.045,-0.025,0.025,Y+0.004,Y+0.012,tray,oc);   // spout over the sink edge
      [[-X+0.01,-Z+0.01],[X-0.01,-Z+0.01],[-X+0.01,Z-0.01],[X-0.01,Z-0.01]].forEach(function(c){ P.box(c[0]-0.004,c[0]+0.004,c[1]-0.004,c[1]+0.004,Y+0.02,Y+0.15,wire,oc); });
      [-Z+0.01,Z-0.01].forEach(function(z){ P.box(-X+0.01,X-0.01,z-0.003,z+0.003,Y+0.147,Y+0.153,wire,oc); P.box(-X+0.01,X-0.01,z-0.003,z+0.003,Y+0.03,Y+0.036,wire,oc); });
      for(let i=0;i<9;i++){ const x=-X+0.03+i*0.025; P.box(x-0.002,x+0.002,-0.09,0.09,Y+0.03,Y+0.034,wire,oc); [-0.09,0.09].forEach(function(z){ P.box(x-0.002,x+0.002,z-0.002,z+0.002,Y+0.03,Y+0.1,wire,oc); }); }   // plate slots
      [0,1,2,3].forEach(function(k){ add(new THREE.CylinderGeometry(k<2?0.11:0.09,k<2?0.1:0.08,0.012,28),cer[k%3],-X+0.04+k*0.05,Y+0.035+(k<2?0.11:0.09),0,0,Math.PI/2); });   // plates on edge
      [[0.075,-0.06],[0.075,0.06]].forEach(function(q,k){ add(new THREE.SphereGeometry(0.06,18,9,0,Math.PI*2,0,Math.PI/2),cer[k+1],q[0],Y+0.036,q[1],0.35*(k?-1:1)); });   // two bowls, upside down and tilted
      [[0.155,-0.1],[0.155,-0.02]].forEach(function(q){ P.box(q[0]-0.002,q[0]+0.002,q[1]-0.002,q[1]+0.002,Y+0.036,Y+0.1,wire,oc); P.cyl(q[0],q[1],0.034,0.03,Y+0.1-0.075,Y+0.1+0.01,cer[0],{},18); });   // cups upside down on hooks
      P.cyl(0.155,0.09,0.032,0.03,Y+0.02,Y+0.13,wire,{open:true},18); P.cyl(0.155,0.09,0.028,0.028,Y+0.022,Y+0.026,lam(0xdedfdc),oc,16);   // cutlery holder
      [[-0.012,0.006,0x6b4a35],[0.008,-0.008,0x6b4a35],[0.0,0.014,0xc9ccd0],[0.014,0.004,0xc9ccd0]].forEach(function(q,i){ const m=add(new THREE.CylinderGeometry(0.003,0.003,0.2,6),lam(q[2],{roughness:0.4,metalness:i>1?0.8:0}),0.155+q[0],Y+0.12,0.09+q[1]); m.rotation.z=q[0]*3; });   // chopsticks, spoons
      return P;
    };
    Catalog.dishSoap=function(noSponge){
      const P=new Piece(), lam=env.lam, oc={cast:false}, bm=lam(0x8fc16b,{roughness:0.25,transparent:true,opacity:0.92});
      P.cyl(0,0,0.034,0.036,0.88,1.04,bm,{},20); P.cyl(0,0,0.016,0.02,1.04,1.06,bm,oc,14);
      P.cyl(0,0,0.006,0.006,1.06,1.09,lam(0xf2f2f2),oc,8); P.box(-0.012,0.032,-0.009,0.009,1.09,1.102,lam(0xf2f2f2),oc);
      P.cyl(0,0,0.0345,0.0365,0.93,0.99,lam(0xf4f1ea,{roughness:0.6}),oc,20);
      if(noSponge) return P;
      const sx=10*S1, sz=8*S1, bump=env.fabricTex?{bumpMap:env.fabricTex,bumpScale:0.006}:{};
      P.rbox(sx,sx+0.1,sz-0.035,sz+0.035,0.88,0.915,0.012,lam(0xf2c46b,Object.assign({roughness:1},bump)),oc);
      P.rbox(sx,sx+0.1,sz-0.035,sz+0.035,0.915,0.925,0.008,lam(0x4f9f6a,Object.assign({roughness:1},bump)),oc);
      return P;
    };
    /* stainless sponge caddy hooked over the back rim inside the sink (rim at 0.88 m), sponge in it; the basket faces -z */
    Catalog.sinkSponge=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, st=M.steel, y=0.88, bump=env.fabricTex?{bumpMap:env.fabricTex,bumpScale:0.006}:{};
      P.box(-0.065,0.065,-0.006,0,y-0.1,y+0.005,st,oc); P.box(-0.065,0.065,-0.006,0.02,y+0.005,y+0.01,st,oc);   // back plate and the hook over the rim
      P.box(-0.065,0.065,-0.055,-0.006,y-0.1,y-0.096,st,oc); P.box(-0.065,0.065,-0.058,-0.054,y-0.1,y-0.065,st,oc);
      [-1,1].forEach(function(k){ P.box(k*0.065-0.002,k*0.065+0.002,-0.058,-0.006,y-0.1,y-0.065,st,oc); });
      P.rbox(-0.055,0.055,-0.05,-0.012,y-0.096,y-0.06,0.01,lam(0xf2c46b,Object.assign({roughness:1},bump)),oc);
      P.rbox(-0.055,0.055,-0.05,-0.012,y-0.06,y-0.05,0.006,lam(0x4f9f6a,Object.assign({roughness:1},bump)),oc);
      return P;
    };
    /* everyday seasonings on a wooden tray beside the hob (worktop at 0.88 m): salt, pepper mill, oil and soy sauce cruets */
    Catalog.seasoningTray=function(){
      const P=new Piece(), lam=env.lam, y=0.88, oc={cast:false};
      P.rbox(-0.11,0.11,-0.07,0.07,y,y+0.012,0.008,M.oak,oc);
      [[-0.075,0xf4f2ec,0.09,0.024],[-0.025,0x2a2a2a,0.14,0.02],[0.03,0xe8d8a0,0.17,0.026],[0.08,0x3a1c10,0.12,0.024]].forEach(function(b,i){
        P.cyl(b[0],0,b[3],b[3],y+0.012,y+0.012+b[2],lam(b[1],{roughness:0.25,transparent:i===2,opacity:0.85}),{},16);
        P.cyl(b[0],0,b[3]*0.5,b[3]*0.6,y+0.012+b[2],y+0.03+b[2],lam(i===3?0xd8453c:0xd8d2c6,{roughness:0.4}),oc,10);
      });
      return P;
    };
    /* sloped steel range hood with a chimney up to a ceiling at ceilH, centred over a hob */
    Catalog.rangeHood=function(ceilH){
      const P=new Piece();
      const hood=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.43,0.2,4),M.steel); hood.rotation.y=Math.PI/4; hood.scale.z=0.75; hood.position.set(0,1.6,0); P.add(hood,{cast:false,recv:false});
      P.box(-0.11,0.11,-0.1,0.1,1.7,ceilH,M.steel);
      P.box(-0.3,0.3,-0.23,0.23,1.5,1.505,M.dark,{cast:false});
      return P;
    };
    /* unit-bath wall set: counter with pump bottles, face wash and soap, thermostatic mixer, slide bar and hand shower with its hose.
       Origin = centre of the counter on the wall face; the room is on +z. */
    Catalog.bathWallSet=function(o){              // o.shelfFrom / o.shelfTo: ends of the counter in px (default 700-785, a 1.03 m counter); o.mirror: mirror above the counter ('tall': 30 x 75 cm); o.barLeft: slide bar at the left end
      o=o||{};
      const P=new Piece(), lam=env.lam, oc={cast:false}, L=function(px){ return (px-742.5)*S1; };
      const ty=o.standing?0.42:0, sy=o.standing?1.15:0.79, steelM=lam(0xd6dade,{metalness:0.85,roughness:0.25,envMapIntensity:1}), whiteP=lam(0xf6f6f3,{roughness:0.25});
      P.rbox(L(o.shelfFrom||700),L(o.shelfTo||(o.standing?763:785)),0,0.13,sy-0.03,sy,0.01,whiteP);   // standing: the shelf stops short of the slide bar; shelfTo sets its right end
      if(o.mirror){ const tall=o.mirror==='tall', mw=tall?0.3:0.4, mh=o.mirrorH||(tall?0.75:0.5), mx=o.mirrorX!==undefined?o.mirrorX:(tall?0.05:L(735)-0.1), my=(o.mirrorY||sy+0.17)+mh/2, m=env.mirror?env.mirror(mw,mh):new THREE.Mesh(new THREE.PlaneGeometry(mw,mh),mat('mirror',0xdfe8ec,{metalness:1,roughness:0.03,envMapIntensity:1})); m.position.set(mx,my,0.006); P.group.add(m);
        P.box(mx-mw/2-0.012,mx+mw/2+0.012,0,0.004,my-mh/2-0.012,my+mh/2+0.012,whiteP,oc); P.mirrorX=mx; }
      P.rbox(L(714),L(756),0,0.06,0.58+ty,0.64+ty,0.025,steelM);
      [L(714)+0.02,L(756)-0.02].forEach(function(x){ const k=P.cyl(x,0.07,0.03,0.03,0.58+ty,0.64+ty,lam(0xeceeef,{roughness:0.3}),oc,18); k.rotation.x=Math.PI/2; k.position.y=0.61+ty; k.position.z=0.07; });
      P.cyl(L(735),0.04,0.012,0.012,0.53+ty,0.58+ty,steelM,oc,10);
      const barX=o.barLeft?L(o.shelfFrom||700)-0.06:L(775), barZ=0.035, hs=o.barLeft?-1:1, tapEnd=o.barLeft?L(714)+0.02:L(756)-0.02;
      P.cyl(barX,barZ,0.012,0.012,1.1,1.9,steelM,{},10);
      [1.1,1.9].forEach(function(y){ P.box(barX-0.015,barX+0.015,0,barZ+0.012,y-0.015,y+0.015,steelM,oc); });
      const hy=1.62, hz=0.075, tilt=0.45;
      P.box(barX-0.02,barX+0.02,barZ-0.01,hz,hy-0.035,hy-0.005,steelM,oc);
      const SH=new THREE.Group(); SH.position.set(barX,hy,hz); SH.rotation.x=tilt; P.group.add(SH);
      const shm=function(geo,mt,y,rx){ const m=new THREE.Mesh(geo,mt); m.position.y=y; if(rx) m.rotation.x=rx; m.castShadow=true; SH.add(m); return m; };
      shm(new THREE.CylinderGeometry(0.014,0.012,0.22,14),steelM,-0.01);
      const hd=shm(new THREE.CylinderGeometry(0.052,0.046,0.03,28),steelM,0.13,Math.PI/2); hd.position.z=0.012;
      const face=shm(new THREE.CircleGeometry(0.044,28),lam(0x9aa3aa,{roughness:0.5}),0.13); face.position.z=0.028;
      const hb=new THREE.Vector3(barX,hy-0.12*Math.cos(tilt),hz-0.12*Math.sin(tilt));
      const hose=new THREE.CatmullRomCurve3([new THREE.Vector3(tapEnd,0.58+ty,0.04),new THREE.Vector3(tapEnd+hs*0.07,0.3+ty*0.9,0.12),new THREE.Vector3(barX-hs*0.06,0.42+ty*0.9,0.13),new THREE.Vector3(barX+hs*0.02,0.95+ty*0.5,0.1),hb]);
      const hm=new THREE.Mesh(new THREE.TubeGeometry(hose,48,0.008,8,false),steelM); hm.castShadow=true; P.group.add(hm);
      const pump=function(x,col,label,h){                                                         // 480 ml pump bottle
        const z=0.07, m=lam(col,{roughness:0.25,envMapIntensity:0.8});
        P.cyl(x,z,0.034,0.036,sy,sy+h,m,{},20);
        P.cyl(x,z,0.0345,0.0365,sy+0.04,sy+0.08,lam(label,{roughness:0.6}),oc,20);
        P.cyl(x,z,0.016,0.02,sy+h,sy+0.018+h,m,oc,14);
        P.cyl(x,z,0.006,0.006,sy+0.018+h,sy+0.048+h,lam(0xf2f2f2,{roughness:0.4}),oc,10);
        P.box(x-0.012,x+0.03,z-0.009,z+0.009,sy+0.048+h,sy+0.06+h,lam(0xf2f2f2,{roughness:0.4}),oc);
      };
      pump(L(736)+0.04,0xf4f1ea,0x8a9a86,0.15); pump(L(736)+0.12,0xe6dccb,0xb98368,0.15); pump(L(736)+0.2,0x9fb4c6,0xf4f1ea,0.16);
      (function(){ const x=L(736)+0.27, z=0.07;
        P.cyl(x,z,0.014,0.014,sy,sy+0.018,lam(0x2e9e8f,{roughness:0.4}),oc,12);
        P.rbox(x-0.022,x+0.022,z-0.011,z+0.011,sy+0.018,sy+0.158,0.008,lam(0xf7f7f4,{roughness:0.3})); })();
      const sd=o.shelfFrom?L(o.shelfFrom)+0.01:L(702)+0.02;                                       // soap dish at the left end of the counter
      if(!o.noSoap){ P.rbox(sd,sd+0.08,0.03,0.11,sy,sy+0.01,0.006,lam(0xd8e2e6,{roughness:0.2}),oc);
        P.rbox(sd+0.01,sd+0.07,0.045,0.095,sy+0.01,sy+0.03,0.012,lam(0xf3e9d2,{roughness:0.5}),oc); }
      return P;
    };
    /* bath stool (風呂椅子, 30 cm high) */
    Catalog.bathStool=function(){
      const P=new Piece(), lam=env.lam, plast=lam(0xf4f5f3,{roughness:0.3}), grey=lam(0xb8c4cc,{roughness:0.35});
      P.rbox(-0.15,0.15,-0.12,0.12,0.27,0.3,0.03,plast);
      [-1,1].forEach(function(sd){ P.box(sd*0.13-0.015,sd*0.13+0.015,-0.11,0.11,0,0.27,plast); });
      P.box(-0.03,0.03,-0.12,0.12,0.27,0.272,grey,{cast:false});
      P._col(-0.15,0.15,-0.12,0.12,true);
      return P;
    };
    /* wash bowl (風呂桶) */
    Catalog.washBowl=function(){
      const P=new Piece();
      const bowl=new THREE.Mesh(new THREE.LatheGeometry([[0.001,0],[0.11,0],[0.13,0.11],[0.123,0.11],[0.104,0.007],[0.001,0.007]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),28),env.lam(0xb8c4cc,{roughness:0.3,side:THREE.DoubleSide}));
      P.add(bowl);
      return P;
    };

    /* ---------- small details ---------- */
    /* appliance cabinet 1.0 x 0.45 m, back on -z, front +z: base cupboard, worktop with a hot-water pot, coffee machine and air fryer,
       shelves with a microwave and a toaster oven, storage boxes on top, sockets and cords. Action: brew a coffee (grinder shake, pour, steam). */
    Catalog.applianceCabinet=function(opt){       // opt.bins: two pull-out waste bins in the base instead of the cupboard; opt.dishes: the cupboard holds dishes, cups and wraps; opt.full: 1.185 m wide, adds a Tatung cooker and a rice cooker
      opt=opt||{};
      const P=new Piece(), lam=env.lam, fab=env.fab, o={}, oc={cast:false};
      const F=!!opt.full, W=F?(opt.width||1.185):1.0, D=opt.depth||0.45, x0=-W/2, x1=W/2, z0=-D/2, z1=D/2, zb=z1-0.45, T=0.02;   // opt.depth: deeper carcass, contents keep their place behind the front
      const H=opt.height||1.96, LOW=H<1.95, Y1=LOW?1.41:1.33, S0=1.7, ST=0.03, BH=0.18;   // opt.height: lowered cabinet drops the box shelf; tiers 50 / 45 cm (10 cm over the blender, 8.6 cm over the air fryer)
      const silver=lam(0xb9bec4,{metalness:0.85,roughness:0.3,envMapIntensity:1}), glass=lam(0x0d1114,{roughness:0.1,metalness:0.2,envMapIntensity:1}), cream=lam(0xf3efe6,{roughness:0.35}), blk=lam(0x1b1d20,{roughness:0.4}), led=new THREE.MeshBasicMaterial({color:0x76ffb2});
      P.box(x0,x1,z0,z0+0.015,0.1,H,M.cabF,o);
      P.box(x0,x0+T,z0,z1,0.1,H,M.cabF,o); P.box(x1-T,x1,z0,z1,0.1,H,M.cabF,o);
      P.box(x0+T,x1-T,z0+0.015,z1,0.1,0.12,M.cabF,o); if(!opt.bins) P.box(x0+T,x1-T,z0+0.015,z1-0.02,0.47,0.49,M.cabF,oc); P.box(x0,x1,z0,z1,0.82,0.85,M.cabF,o); P.box(x0+0.02,x1-0.02,z1-0.012,z1,0,0.1,opt.kick?lam(opt.kick,{roughness:0.8}):M.dark,oc);   // opt.kick: a light plinth colour
      if(opt.oak){ const oi=lam(0xd9bf96,{roughness:0.5,map:M.oak.map||null}); P.box(x0+T,x1-T,z0+0.015,z0+0.02,0.88,H-0.01,oi,oc); [x0+T,x1-T-0.004].forEach(function(x){ P.box(x,x+0.004,z0+0.02,z1-0.03,0.88,H-0.01,oi,oc); });   // opt.oak: light oak lining behind the appliances
        (LOW?[Y1-0.03]:[Y1-0.03,S0]).concat([H-0.02]).forEach(function(y){ P.box(x0+T+0.02,x1-T-0.02,z1-0.07,z1-0.06,y-0.006,y,new THREE.MeshBasicMaterial({color:0xffe9c8}),oc).userData.stay=true; }); }   // warm LED strip under each shelf, washing down
      const TR=!!opt.depth, K2=!!opt.k2;   // deep variant: the appliance shelves are pull-out trays; k2: Bistro oven, Zojirushi cooker and a Philips air fryer, the Tatung stored
      if(opt.dishes) (function(){ const DS=THREE.DoubleSide, oc2={cast:false}, cer=[lam(0xf6f3ec,{roughness:0.25,side:DS}),lam(0xc9d6df,{roughness:0.25,side:DS}),lam(0xe8d7c0,{roughness:0.3,side:DS}),lam(0x3e4a52,{roughness:0.3,side:DS})];   // dish cupboard: plates on edge and bowls below, cups and glasses above, wraps standing at the right
        const zc=zb+0.2, wood=M.oak;
        P.box(x0+0.04,x0+0.3,zc-0.13,zc+0.13,0.12,0.13,wood,oc2);
        const lathe=function(pts,m){ return new THREE.Mesh(new THREE.LatheGeometry(pts.map(function(q){ return new THREE.Vector2(q[0],q[1]); }),28),m); };
        const plateG=function(r){ return [[0,0],[r*0.55,0],[r*0.6,0.004],[r*0.62,0.006],[r*0.9,0.012],[r,0.02],[r*0.98,0.024],[r*0.88,0.016],[r*0.6,0.01],[0,0.008]]; };   // foot ring, well and rim
        for(let i=0;i<10;i++){ const r=i<6?0.12:0.09, pl=lathe(plateG(r),cer[i%3]); pl.rotation.z=Math.PI/2; pl.position.set(x0+0.06+i*0.024,0.13+r,zc); P.add(pl); }   // large and small plates standing in a rack
        const bowlG=function(r,h,foot){ return [[0,0],[foot,0],[foot,0.006],[foot*0.95,0.008],[r*0.7,h*0.35],[r*0.95,h*0.8],[r,h],[r*0.94,h],[r*0.88,h*0.78],[r*0.62,h*0.35],[0,h*0.18]]; };
        const lacq=lam(0x6b2a1e,{roughness:0.25,side:DS}), lacqB=lam(0x2a1a14,{roughness:0.3,side:DS});
        [[x0+0.42,0.065,0.06,cer[0],4,0.028],[x0+0.62,0.065,0.07,lacq,3,0.03],[x0+0.8,0.09,0.075,cer[3],3,0.035],[x0+0.98,0.048,0.035,cer[2],5,0.022]].forEach(function(q,j){ for(let k=0;k<q[4];k++){ const b=lathe(bowlG(q[1],q[2],q[5]),j===1&&k===2?lacqB:q[3]); b.position.set(q[0],0.12+k*q[2]*0.42,zc); P.add(b); } });   // 茶碗, lacquered 汁椀, noodle bowls, small dishes
        const glass=lam(0xeef4f6,{transparent:true,opacity:0.35,roughness:0.03,side:DS});
        const cup=function(x,z,r,h,m,handle){ P.cyl(x,z,r,r*0.9,0.49,0.49+h,m,{open:true},18); P.cyl(x,z,r*0.9,r*0.9,0.49,0.495,m,oc2,18); if(handle){ const t=new THREE.Mesh(new THREE.TorusGeometry(h*0.28,0.006,8,14,Math.PI),m); t.position.set(x+r+0.003,0.49+h*0.5,z); t.rotation.z=-Math.PI/2; P.add(t); } };
        [[0.06,cer[0]],[0.16,cer[1]],[0.26,cer[3]],[0.36,cer[2]]].forEach(function(q){ cup(x0+q[0],zc-0.07,0.04,0.095,q[1],true); });   // mugs
        for(let i=0;i<5;i++) cup(x0+0.48+i*0.075,zc-0.07,0.032,0.12,glass,false);                                              // tumblers
        for(let i=0;i<4;i++) cup(x0+0.06+i*0.09,zc+0.09,0.035,0.07,cer[2-i%2],true);                                          // tea cups
        for(let i=0;i<3;i++){ cup(x0+0.48+i*0.09,zc+0.09,0.03,0.14,glass,false); }                                            // tall glasses
        [[0x3a8dd6,'ラップ'],[0x6fbf73,'保存袋'],[0xbfc4c8,'ホイル'],[0xc9a46a,'クッキングシート']].forEach(function(q,i){ const sm=lam(q[0],{roughness:0.5}), fm=Catalog.pack.label(q[1],q[0],0xffffff,256,48); const m=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.3,0.05),[sm,sm,sm,sm,fm,sm]); m.rotation.x=-Math.PI/2; m.position.set(x1-0.18+i*0.045,0.49+0.025,zc); P.add(m,oc2); });   // wrap, zip bags, foil, baking paper standing in a row, labels up
      })();
      if(!opt.bins&&!opt.dishes) (function(){ const wt=lam(0xd8ecf4,{transparent:true,opacity:0.55,roughness:0.05}), cap=lam(0x3f7fc0), wh=lam(0xfafaf8,{roughness:0.8});   // inside the lower cupboard
        for(let i=0;i<4;i++){ P.cyl(x0+0.1+i*0.11,zb+0.15,0.048,0.048,0.12,0.42,wt,oc,16); P.cyl(x0+0.1+i*0.11,zb+0.15,0.016,0.016,0.42,0.45,cap,oc,10); }   // 2 L water bottles
        P.box(x1-0.42,x1-0.06,zb+0.04,zb+0.3,0.12,0.37,lam(0xc9a87a,{roughness:0.9}),oc); P.box(x1-0.42,x1-0.06,zb+0.3,zb+0.302,0.18,0.28,lam(0xc8372f),oc);   // a case of drinks
        for(let i=0;i<3;i++) P.cyl(x0+0.1+i*0.13,zb+0.14,0.06,0.06,0.49,0.71,wh,oc,18);                                               // kitchen paper
        [[0xe9eef2,0.0],[0xd8dde2,0.05],[0x9fb4c8,0.1]].forEach(function(q){ P.box(x1-0.45,x1-0.13,zb+0.06,zb+0.12,0.49+q[1],0.53+q[1],lam(q[0],{roughness:0.6}),oc); });   // wrap, foil, bags
        [0.0,0.09].forEach(function(dz){ P.cyl(x1-0.25,zb+0.22+dz,0.04,0.04,0.49,0.6,lam(0x3a4a3a,{roughness:0.7}),oc,14); });         // bin-bag rolls
      })();
      if(TR){ P.box(x0,x1,z0,zb+0.02,0.85,0.88,M.top,o); P.box(x0,x1,z0,zb+0.02,Y1-0.03,Y1,M.oak,o); if(!LOW) P.box(x0,x1,z0,z1,S0,S0+ST,M.oak,o); }   // only a strip behind each pull-out shelf stays fixed
      else { P.box(x0-0.005,x1+0.005,z0,z1+0.025,0.85,0.88,M.top,o); (LOW?[Y1-0.03]:[Y1-0.03,S0]).forEach(function(y,i){ P.box(x0,x1,z0,z1,y,y+(i?ST:0.03),M.oak,o); }); }
      if(!LOW) P.box(x0,x1,z0,z1,H-0.03,H,M.oak,o);   // a lowered cabinet tucks under a band: the band is its top
      if(opt.bins) [[x0+T,0,0xd9c9ae,'可燃'],[0,x1-T,0xb89a7a,'資源']].forEach(function(q){   // pull-out bins: front panel, steel frame, a bin with a lid
        const G=new THREE.Group(); P.group.add(G); const cx=(q[0]+q[1])/2, bw=q[1]-q[0]-0.01;
        const add=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; G.add(m); return m; };
        add(new THREE.BoxGeometry(bw,0.72,0.02),M.cabF,cx,0.465,z1+0.011); add(new THREE.BoxGeometry(0.14,0.012,0.014),M.steel,cx,0.78,z1+0.03);
        add(new THREE.BoxGeometry(bw-0.04,0.012,D-0.06),M.steel,cx,0.13,0.0);
        const bw2=bw-0.08, bd2=D-0.1, bt=0.012, bm=lam(q[2],{roughness:0.5}), zc=-0.01;                                       // open-topped bin: four walls and a floor, so you see into it
        add(new THREE.BoxGeometry(bw2,0.012,bd2),bm,cx,0.146,zc);
        [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(bt,0.56,bd2),bm,cx+sd*(bw2/2-bt/2),0.42,zc); add(new THREE.BoxGeometry(bw2,0.56,bt),bm,cx,0.42,zc+sd*(bd2/2-bt/2)); });
        const bag=new THREE.MeshStandardMaterial({color:0xf2f4f5,roughness:0.25,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false});   // clear bin bag lining the bin and folded over the rim
        [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.003,0.6,bd2+0.01),bag,cx+sd*(bw2/2+0.002),0.6,zc).renderOrder=2; add(new THREE.BoxGeometry(bw2+0.01,0.6,0.003),bag,cx,0.6,zc+sd*(bd2/2+0.002)).renderOrder=2;
          add(new THREE.BoxGeometry(0.003,0.5,bd2-2*bt-0.01),bag,cx+sd*(bw2/2-bt-0.004),0.42,zc).renderOrder=2; add(new THREE.BoxGeometry(bw2-2*bt-0.01,0.5,0.003),bag,cx,0.42,zc+sd*(bd2/2-bt-0.004)).renderOrder=2; });
        add(new THREE.BoxGeometry(bw2-2*bt-0.01,0.003,bd2-2*bt-0.01),bag,cx,0.165,zc).renderOrder=2;
        const st=stepper(0.5,function(t){ G.position.z=0.36*ease(t); }); P.anims.push(function(t){ return st.run(t); });
        P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.45,label:function(){ return st.target?'推回垃圾桶':'拉出'+q[3]+'垃圾桶'; },act:function(){ st.target=st.target?0:1; }}]); });
      else {
        const lowD=[];                                                                                     // two doors hinged at the outer ends, swinging out
        const NL=opt.narrow?4:2, LW=W/NL; (NL===4?[[x0,1],[x0+2*LW,-1],[x0+2*LW,1],[x1,-1]]:[[x0,1],[x1,-1]]).forEach(function(q){ const G=new THREE.Group(); G.position.set(q[0],0,z1+0.021); P.group.add(G); lowD.push(G);   // pivot on the front face, so the open leaf stays clear of the neighbouring cabinet; opt.narrow: two pairs of narrow doors
          const L=LW-0.003, pm=new THREE.Mesh(new THREE.BoxGeometry(L,0.72,0.02),M.cabF); pm.position.set(q[1]*L/2,0.465,-0.01); pm.castShadow=pm.receiveShadow=true; G.add(pm);
          if(GROOVE) NOTCH(G,q[1]*L,0.705,0,0,-q[1]*Math.PI/2,0.18); else { const hd=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.14,0.012),M.steel); hd.position.set(q[1]*(L-0.05),0.7,0.007); G.add(hd); } });
        const lowSt=stepper(0.6,function(t){ const e=ease(t); lowD.forEach(function(G,i){ G.rotation.y=(i%2?1:-1)*1.55*e; }); });
        P.anims.push(function(t){ return lowSt.run(t); });
        P.actions=(P.actions||[]).concat([{x:0,z:z1+0.45,part:lowD,label:function(){ return lowSt.target?(opt.dishes?'關上食器櫃':'關上下櫃'):(opt.dishes?'打開食器櫃':'打開電器櫃下櫃'); },act:function(){ lowSt.target=lowSt.target?0:1; }}]);
      }
      const az=zb+0.04;
      const body=function(cx,w,d,h,y,mt,r){ return P.rbox(cx-w/2,cx+w/2,az,az+d,y,y+h,r||0.012,mt,o); };
      if(!K2) (function(){ const cx=x0+(F?0.25:0.28), y=Y1, f=az+0.34;                         // microwave
        body(cx,0.46,0.34,0.27,y,cream); P.box(cx-0.21,cx+0.05,f,f+0.004,y+0.03,y+0.24,glass,oc);
        P.box(cx+0.08,cx+0.2,f,f+0.004,y+0.03,y+0.24,silver,oc); P.box(cx+0.1,cx+0.18,f+0.004,f+0.006,y+0.18,y+0.215,led,oc);
        [0.07,0.12].forEach(function(dy){ P.cyl(cx+0.14,f+0.012,0.016,0.016,0,0,silver,oc,12); const k=P.cyl(cx+0.14,0,0.014,0.014,0,0.012,silver,oc,12); k.rotation.x=Math.PI/2; k.position.set(cx+0.14,y+dy,f+0.01); });
        P.box(cx+0.215,cx+0.222,f+0.002,f+0.012,y+0.05,y+0.22,silver,oc);
      })();
      if(!K2) (function(){ const cx=x0+(F?0.68:0.76), y=Y1, f=az+0.3, tw=F?0.38:0.4;               // toaster oven
        body(cx,tw,0.3,0.23,y,silver,0.01); P.box(cx-0.17,cx+0.06,f,f+0.004,y+0.035,y+0.195,glass,oc);
        [0.1,0.17].forEach(function(dx){ [0.065,0.15].forEach(function(dy){ const k=P.cyl(0,0,0.016,0.016,0,0.02,blk,oc,14); k.rotation.x=Math.PI/2; k.position.set(cx+dx,y+dy,f+0.01); }); });
        P.box(cx-0.16,cx+0.05,f+0.004,f+0.03,y+0.205,y+0.215,silver,oc);
        [-0.15,0.15].forEach(function(dx){ P.box(cx+dx-0.02,cx+dx+0.02,az+0.02,az+0.28,y-0.012,y,blk,oc); });
      })();
      if(!K2) (function(){ const cx=x0+(F?1.02:0.8), y=F?Y1:0.88, f=az+0.36, fw=F?0.28:0.3;                  // air fryer (on the upper shelf in the full set)
        body(cx,fw,0.36,0.36,y,blk,0.04); P.box(cx-0.12,cx+0.12,f,f+0.01,y+0.07,y+0.2,lam(0x2c2f33,{roughness:0.5}),oc);
        P.box(cx-0.09,cx+0.09,f+0.004,f+0.022,y+0.16,y+0.18,silver,oc);
        P.box(cx-0.08,cx+0.08,f+0.002,f+0.006,y+0.26,y+0.32,glass,oc); P.box(cx-0.06,cx+0.0,f+0.006,f+0.008,y+0.28,y+0.3,led,oc);
        for(let i=0;i<6;i++) P.box(cx-0.12+i*0.04,cx-0.095+i*0.04,az+0.09,az+0.27,y+0.358,y+0.364,lam(0x0a0b0d),oc);
      })();
      if(!K2) (function(){ const k0=P.group.children.length, y=0.88, cx=x0+(F?0.12:0.16), cz=az+0.16;                                  // 1 L electric kettle on its base: fill, flip the switch, it boils and clicks off
        const kw=lam(0xfafaf8,{roughness:0.3}); P.cyl(cx,cz,0.085,0.09,y,y+0.025,kw,o,28); const lamp=P.cyl(cx+0.07,cz+0.05,0.006,0.006,y+0.012,y+0.02,lam(0x2a2a2a),oc,10); lamp.rotation.z=Math.PI/2;
        P.cyl(cx,cz,0.07,0.08,y+0.025,y+0.215,kw,o,28); P.cyl(cx,cz,0.066,0.07,y+0.215,y+0.23,kw,oc,28);
        P.cyl(cx,cz,0.03,0.02,y+0.23,y+0.245,silver,oc,16);                                                                 // lid knob
        const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.022,0.06,12),kw); sp.position.set(cx,y+0.2,cz+0.085); sp.rotation.x=0.9; P.add(sp,oc);   // spout toward the front
        P.box(cx-0.012,cx+0.012,cz-0.12,cz-0.1,y+0.05,y+0.21,kw); P.box(cx-0.012,cx+0.012,cz-0.12,cz-0.07,y+0.19,y+0.21,kw,oc); P.box(cx-0.012,cx+0.012,cz-0.12,cz-0.07,y+0.05,y+0.07,kw,oc);   // handle
        const sw=P.box(cx-0.008,cx+0.008,cz-0.125,cz-0.112,y+0.035,y+0.05,lam(0x2a2a2a),oc);                               // switch under the handle
        const steam=[0,1,2].map(function(){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.02,10,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false})); P.group.add(m); return m; });
        let t0=null, on=false;
        P.anims.push(function(t){ if(!on) return false; if(t0===null) t0=t; const k=t-t0; if(k>8){ on=false; t0=null; lamp.material.color.setHex(0x2a2a2a); sw.position.y=0; steam.forEach(function(m){ m.material.opacity=0; }); return true; }
          const boil=Math.max(0,Math.min(1,(k-3)/2)); steam.forEach(function(m,i){ const f=((k*0.7+i/3)%1); m.position.set(cx+Math.sin(k+i)*0.01,y+0.27+f*0.2,cz+0.11+f*0.03); m.scale.setScalar(0.8+f*1.4); m.material.opacity=boil*0.35*(1-f); }); return true; });
        P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.4,part:P.group.children.slice(k0),label:function(){ return on?'煮水中…':'按下煮水壺開關'; },act:function(){ if(on) return; on=true; t0=null; lamp.material.color.setHex(0x3a8dff); sw.position.y=-0.006; }}]);
      })();
      if(F&&!K2) (function(){ const y=0.88, cx=x0+0.38, cz=az+0.18, red=lam(0xe8dccb,{roughness:0.35}), grey=lam(0x9a9a98,{roughness:0.4}), st=lam(0xd6dade,{metalness:0.85,roughness:0.25,envMapIntensity:1});   // Tatung electric cooker (大同電鍋), 10-cup, milk-tea colour
        P.cyl(cx,cz,0.13,0.13,y,y+0.02,lam(0x2a2826,{roughness:0.5}),o,28); P.cyl(cx,cz,0.14,0.13,y+0.02,y+0.2,red,o,32); P.cyl(cx,cz,0.142,0.142,y+0.19,y+0.205,st,oc,32);
        const lid=new THREE.Mesh(new THREE.SphereGeometry(0.135,28,10,0,Math.PI*2,0,0.75),st); lid.position.set(cx,y+0.16,cz); lid.scale.y=0.7; P.add(lid);
        P.cyl(cx,cz,0.022,0.018,y+0.27,y+0.3,lam(0x2a2826,{roughness:0.4}),oc,16);
        [-1,1].forEach(function(sd){ P.box(cx+sd*0.15-0.015,cx+sd*0.15+0.015,cz-0.03,cz+0.03,y+0.15,y+0.17,lam(0xb8b6b0),oc); });
        P.rbox(cx-0.025,cx+0.025,cz+0.125,cz+0.148,y+0.03,y+0.11,0.012,grey,oc); P.box(cx-0.008,cx+0.008,cz+0.146,cz+0.152,y+0.06,y+0.09,lam(0xf4f2ec),oc); P.cyl(cx+0.04,cz+0.138,0.008,0.008,y+0.07,y+0.072,lam(0xffb070,{emissive:0xff7a20,emissiveIntensity:0.6}),oc,10);
      })();
      if(F&&!K2) (function(){ const y=0.88, cx=x0+0.7, cz=az+0.19, wh=lam(0xf7f7f5,{roughness:0.3}), lg=lam(0xe9eae8,{roughness:0.35}), lcd=lam(0xa9b3a4,{roughness:0.2}), mk=lam(0x6a6c6e,{roughness:0.5});   // IH rice cooker, 5.5-cup (Tiger JBH type, W 27 x D 34 x H 20 cm)
        P.rbox(cx-0.135,cx+0.135,cz-0.16,cz+0.15,y,y+0.15,0.045,wh,o);                                                     // body
        P.rbox(cx-0.13,cx+0.13,cz-0.155,cz+0.1,y+0.15,y+0.195,0.05,wh,oc);                                                 // lid, rounded
        P.cyl(cx,cz-0.035,0.085,0.088,y+0.195,y+0.2,lg,oc,40);                                                             // round inner panel on the lid
        for(let i=-1;i<=1;i++) P.box(cx+i*0.01-0.002,cx+i*0.01+0.002,cz-0.1,cz-0.08,y+0.2,y+0.202,mk,oc);                   // steam vent slits
        const fr=new THREE.Group(); fr.position.set(cx,y+0.12,cz+0.13); fr.rotation.x=0.95; P.group.add(fr);                // sloping front control panel
        const fm=function(geo,m,px,py,pz){ const q=new THREE.Mesh(geo,m); q.position.set(px,py,pz); fr.add(q); return q; };
        fm(new THREE.BoxGeometry(0.25,0.012,0.11),lg,0,0,0);
        fm(new THREE.BoxGeometry(0.08,0.004,0.035),lcd,-0.005,0.008,0.0);
        fm(new THREE.CylinderGeometry(0.018,0.018,0.006,20),lam(0xf2c230,{roughness:0.35}),0.075,0.009,-0.005);            // yellow cook button
        fm(new THREE.CylinderGeometry(0.012,0.012,0.006,16),wh,0.075,0.009,0.03);
        [-0.085,-0.085].forEach(function(px,i){ fm(new THREE.CylinderGeometry(0.011,0.011,0.006,16),wh,px,0.009,-0.02+i*0.035); });
        fm(new THREE.BoxGeometry(0.012,0.003,0.006),mk,-0.003,0.008,0.04); fm(new THREE.BoxGeometry(0.012,0.003,0.006),mk,0.04,0.008,0.04);
        P.rbox(cx-0.03,cx+0.03,cz+0.095,cz+0.115,y+0.185,y+0.2,0.006,lg,oc);                                               // lid open button
        const hd=new THREE.Mesh(new THREE.TorusGeometry(0.085,0.009,8,20,Math.PI),lg); hd.rotation.y=Math.PI/2; hd.position.set(cx+0.14,y+0.08,cz-0.02); P.add(hd);   // carry handle down the right side
      })();
      const c0=P.group.children.length, cxm=x0+(K2?0.845:F?1.0:0.48), y0c=0.88, Wc=0.26, Dc=0.4, fz=az+Dc, ledM=new THREE.MeshBasicMaterial({color:0x76ffb2});   // bean-to-cup coffee machine
      if(!K2){
      P.rbox(cxm-Wc/2,cxm+Wc/2,az+0.02,fz+0.02,y0c,y0c+0.04,0.008,blk,o);
      const cmBody=P.rbox(cxm-Wc/2+0.005,cxm+Wc/2-0.005,az,fz-0.02,y0c+0.04,y0c+0.31,0.02,silver,o);
      P.cyl(cxm-0.03,az+0.12,0.055,0.045,1.19,1.26,lam(0x4a2f1c,{roughness:0.5,transparent:true,opacity:0.8}),oc,18); P.cyl(cxm-0.03,az+0.12,0.058,0.058,1.26,1.272,blk,oc,18);
      P.box(cxm-0.1,cxm+0.1,fz-0.026,fz-0.02,y0c+0.2,y0c+0.285,blk,oc); P.box(cxm-0.07,cxm+0.07,fz-0.02,fz-0.016,y0c+0.225,y0c+0.255,ledM,oc);
      [-1,1].forEach(function(sd){ const k=P.cyl(0,0,0.014,0.014,0,0.012,silver,oc,12); k.rotation.x=Math.PI/2; k.position.set(cxm+sd*0.075,y0c+0.17,fz-0.024); });
      P.box(cxm-0.03,cxm+0.03,fz-0.05,fz+0.012,y0c+0.17,y0c+0.2,blk,oc);
      P.cyl(cxm,fz-0.004,0.036,0.03,y0c+0.04,y0c+0.11,M.ceramic,{open:true},22); P.cyl(cxm,fz-0.004,0.03,0.03,y0c+0.04,y0c+0.045,M.ceramic,oc,22);
      const liquid=P.cyl(cxm,fz-0.004,0.029,0.029,y0c+0.045,y0c+0.1,lam(0x3a2412,{roughness:0.2,envMapIntensity:0.9}),oc,20); liquid.visible=false;
      const stream=P.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0035,0.0035,1,8),lam(0x3a2412,{roughness:0.2})),oc); stream.visible=false;
      const steam=[0,1,2,3,4].map(function(){ const m=P.add(new THREE.Mesh(new THREE.SphereGeometry(0.014,10,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false})),oc); m.visible=false; return m; });
      const bx0=cmBody.position.x, cupTop=y0c+0.11, noz=y0c+0.17; let brewT0=null, lastT=0;
      P.anims.push(function(t){
        lastT=t; if(brewT0===null) return false;
        const e=t-brewT0;
        cmBody.position.x=bx0+(e<2.2?0.0016*Math.sin(e*70):0);
        ledM.color.setHex(e<9.5?0xffb25b:0x76ffb2);
        const fill=Math.max(0,Math.min(1,(e-3)/6.5))*0.85;
        liquid.visible=e>=3; liquid.scale.y=Math.max(0.001,fill); liquid.position.y=y0c+0.045+0.0275*fill;
        const top=y0c+0.045+0.055*fill;
        stream.visible=(e>3&&e<9.5); if(stream.visible){ const h=noz-top; stream.scale.y=h; stream.position.set(cxm,(noz+top)/2,fz-0.004); }
        const fade=e<16?1:Math.max(0,Math.min(1,1-(e-16)/4));
        steam.forEach(function(m,i){ const ph=(((e-4.5)+i*0.8)%4)/4; const on=e>4.5&&fade>0&&ph>=0;
          m.visible=on; if(on){ m.position.set(cxm+Math.sin(ph*6+i)*0.012,cupTop+0.02+ph*0.2,fz-0.004); m.material.opacity=(1-ph)*0.35*fade; m.scale.setScalar(0.8+ph*1.8); } });
        return e<2.2;
      });
      P.brew=function(){ brewT0=lastT; };
      P.actions.push({x:cxm,z:fz,part:P.group.children.slice(c0),label:function(){ return '沖煮咖啡'; },act:function(){ if(brewT0!==null&&lastT-brewT0<9.5) return; brewT0=lastT; }});
      }
      if(F&&W>1.3&&!K2) (function(){ const y=0.88, cx=x0+1.215, cz=az+0.15, bm=lam(0xe9e6df,{roughness:0.35}), jug=new THREE.MeshPhysicalMaterial({color:0xe8f0f2,roughness:0.05,transmission:0.6,transparent:true,opacity:0.45,depthWrite:false}), lid=lam(0x2b2d31,{roughness:0.4});   // blender: motor base, 1.5 L glass jug, lid; it runs for a few seconds
        P.rbox(cx-0.075,cx+0.075,cz-0.08,cz+0.08,y,y+0.13,0.02,bm); P.box(cx+0.07,cx+0.078,cz-0.02,cz+0.02,y+0.04,y+0.09,lam(0xc9cbcd,{roughness:0.3}),oc);
        const knob=P.cyl(cx,cz+0.08,0.018,0.018,y+0.055,y+0.065,blk,oc,16); knob.rotation.x=Math.PI/2; knob.position.set(cx,y+0.06,cz+0.083);
        P.cyl(cx,cz,0.05,0.07,y+0.13,y+0.36,jug,oc,24).renderOrder=2; P.cyl(cx,cz,0.072,0.072,y+0.36,y+0.385,lid,{},24); P.cyl(cx,cz,0.02,0.02,y+0.385,y+0.4,lid,oc,16);
        const hd=new THREE.Mesh(new THREE.TorusGeometry(0.07,0.01,8,16,Math.PI),jug); hd.rotation.z=-Math.PI/2; hd.position.set(cx,y+0.25,cz-0.07); hd.rotation.y=Math.PI/2; P.add(hd,oc);
        const juice=P.cyl(cx,cz,0.052,0.058,y+0.135,y+0.255,lam(0xf29a3a,{roughness:0.4}),oc,20); juice.visible=false; const blade=P.box(cx-0.035,cx+0.035,cz-0.006,cz+0.006,y+0.14,y+0.145,M.steel,oc);
        let t0=null, last=0; P.anims.push(function(t){ last=t; if(t0===null) return false; const k=t-t0; if(k>6){ t0=null; juice.visible=false; return true; } const f=Math.max(0.02,Math.min(1,k/2)); juice.visible=true; juice.scale.y=f; juice.position.y=y+0.135+0.06*f; blade.rotation.y=k*40; return true; });   // fruit blends into juice over two seconds
        P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.45,label:function(){ return t0===null?'打果汁':'打果汁中…'; },act:function(){ if(t0===null) t0=last; }}]); })();
      if(!LOW) (function(){ const y=S0+ST, n=3, gap=0.03, bw=(W-0.04-gap*(n+1))/n;                     // three matching fabric boxes on the top shelf, evenly spaced and flush at the front
        [0x8a9a86,0xc9b27f,0xb98368].forEach(function(c,i){ const bx0=x0+0.02+gap+i*(bw+gap); P.rbox(bx0,bx0+bw,z0+0.05,z0+0.4,y,y+BH,0.015,fab(c),o); P.box(bx0+bw/2-0.04,bx0+bw/2+0.04,z0+0.4,z0+0.405,y+BH-0.06,y+BH-0.04,fab(0x5a4a3a),oc); });
      })();
      if(K2) (function(){
        const tex=function(w,h,f){ const c=document.createElement('canvas'); c.width=w*2; c.height=h*2; const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=env.anisotropy||4; tx.draw=function(a){ const g=c.getContext('2d'); g.setTransform(2,0,0,2,0,0); f(g,w,h,a); tx.needsUpdate=true; }; tx.draw(); return tx; };   // drawn at twice the size so small labels stay sharp
        const plane=function(G,w,h,x,y,z,mt){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mt); m.position.set(x,y,z); G.add(m); return m; };
        const rb=function(G,x0_,x1_,y0,y1,z0_,z1_,r,mt){ const s=new THREE.Shape(), w=x1_-x0_, h=y1-y0; s.moveTo(-w/2+r,-h/2); s.lineTo(w/2-r,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r); s.lineTo(w/2,h/2-r); s.quadraticCurveTo(w/2,h/2,w/2-r,h/2); s.lineTo(-w/2+r,h/2); s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); s.lineTo(-w/2,-h/2+r); s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
          const bv=Math.min(0.006,(z1_-z0_)/3), g=new THREE.ExtrudeGeometry(s,{depth:z1_-z0_-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelSegments:3,curveSegments:8}); const m=new THREE.Mesh(g,mt); m.position.set((x0_+x1_)/2,(y0+y1)/2,z0_+bv); m.castShadow=m.receiveShadow=true; G.add(m); return m; };
        const timer=function(dur,tick,done){ let t0=null, last=0, on=false; P.anims.push(function(t){ last=t; if(!on) return false; if(t0===null) t0=t; const k=t-t0; if(k>=dur){ on=false; t0=null; done(); return true; } tick(k,dur); return true; }); return {start:function(){ on=true; t0=null; }, stop:function(){ if(on){ on=false; t0=null; done(true); } }, get on(){ return on; }}; };
        const fmt=function(s){ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
        const wht=lam(0xf6f5f2,{roughness:0.35}), lgr=lam(0xd9dad8,{roughness:0.5}), dk=lam(0x2b2d30,{roughness:0.5}), chrome=lam(0xd6dade,{metalness:0.85,roughness:0.25});
        /* Panasonic Bistro NE-BS9E: W49.4 x D43.5 x H37 cm on the upper tray; drop-down door over the left three quarters, a control column on the right */
        (function(){ const B=new THREE.Group(), cx=x0+0.426; B.position.set(cx,Y1,zb+0.02); P.group.add(B); const W2=0.247, Dp=0.435, Hp=0.37, DX=0.122;
          [[-0.21,0.03],[0.21,0.03],[-0.21,0.4],[0.21,0.4]].forEach(function(q){ const f=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.008,10),dk); f.position.set(q[0],0.004,q[1]); B.add(f); });
          rb(B,-W2+0.006,W2-0.006,0.008,0.045,0.01,Dp-0.008,0.008,lgr); plane(B,0.002,0.03,0,0.026,Dp-0.0075,dk);   // plinth and the water-tank seam
          rb(B,DX,W2,0.045,Hp,0,Dp-0.03,0.02,wht); rb(B,-W2,-W2+0.022,0.045,Hp,0,Dp-0.03,0.008,wht); rb(B,-W2,DX+0.01,Hp-0.035,Hp,0,Dp-0.03,0.008,wht); rb(B,-W2,DX+0.01,0.045,0.07,0,Dp-0.03,0.008,wht); rb(B,-W2,DX+0.01,0.045,Hp,0,0.025,0.008,wht);   // a shell round the cavity: the control column, the walls, the back
          rb(B,-0.2,0.2,Hp-0.004,Hp+0.002,0.1,0.33,0.01,lam(0xe6e5e1,{roughness:0.6}));   // body, a recessed panel at the back of the top
          const cavM=lam(0x3a3c3f,{roughness:0.6,emissive:0x000000,side:THREE.DoubleSide}), cxm=(DX-W2+0.022)/2, cw=DX+W2-0.022, cz=(0.025+Dp-0.03)/2, cd=Dp-0.055, inb=function(w,h,dd,x,y,z,m){ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,dd),m); o.position.set(x,y,z); o.receiveShadow=true; B.add(o); return o; };   // the cavity: dark enamel walls, a flat ceramic floor, rack rails at two heights, a lamp in the ceiling
          const cav=inb(cw,0.265,0.002,cxm,0.2025,0.026,cavM); inb(0.002,0.265,cd,-W2+0.023,0.2025,cz,cavM); inb(0.002,0.265,cd,DX-0.001,0.2025,cz,cavM); inb(cw,0.002,cd,cxm,Hp-0.036,cz,cavM); inb(cw-0.004,0.003,cd-0.004,cxm,0.0715,cz,lam(0xd9d6cf,{roughness:0.45}));
          [0.16,0.25].forEach(function(y){ [-W2+0.028,DX-0.006].forEach(function(x){ inb(0.008,0.006,cd-0.04,x,y,cz,cavM); }); });
          inb(cw-0.02,0.006,cd-0.05,cxm,0.166,cz,lam(0x2f3134,{roughness:0.5}));   // the enamel tray (角皿) on the lower rails
          const lampM=lam(0xe8e2d4,{roughness:0.3}); inb(0.05,0.003,0.035,DX-0.05,Hp-0.0375,0.1,lampM); P.anims.push(function(){ lampM.emissive.copy(cavM.emissive).multiplyScalar(2.2); return false; });
          const tray=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.006,0.02),chrome); tray.position.set((DX-W2)/2,0.12,Dp-0.035); B.add(tray);
          const D=new THREE.Group(); D.position.set(0,0.05,Dp-0.03); B.add(D);   // door, hinged at its bottom front edge
          const dm=rb(D,-W2+0.004,DX-0.003,0,0.31,0,0.03,0.014,wht); const win=rb(D,-W2+0.04,DX-0.04,0.05,0.27,0.029,0.031,0.02,lam(0x1a1c1f,{roughness:0.08,metalness:0.2,envMapIntensity:1.1,transparent:true,opacity:0.92})); plane(D,DX+W2-0.06,0.006,(DX-W2)/2,0.296,0.0305,dk);   // big tinted window, the recessed lip along the top
          (function(){ const ig=plane(D,DX+W2-0.09,0.2,(DX-W2)/2,0.16,-0.0008,lam(0x15171a,{roughness:0.1,metalness:0.2,transparent:true,opacity:0.85})); ig.rotation.y=Math.PI; const sm=lam(0x2a2c2f,{roughness:0.8}), xa=-W2+0.012, xb=DX-0.012; [[xa,xb,0.008,0.016],[xa,xb,0.294,0.302],[xa,xa+0.008,0.008,0.302],[xb-0.008,xb,0.008,0.302]].forEach(function(q){ const o=new THREE.Mesh(new THREE.BoxGeometry(q[1]-q[0],q[3]-q[2],0.004),sm); o.position.set((q[0]+q[1])/2,(q[2]+q[3])/2,-0.002); D.add(o); }); })();   // inner glass and the door seal
          const bt=tex(128,32,function(g,w,h){ g.fillStyle='#1a1c1f'; g.fillRect(0,0,w,h); g.fillStyle='#8e9195'; g.font='italic bold 18px sans-serif'; g.fillText('Bistro',6,22); }); plane(D,0.05,0.0125,-W2+0.07,0.06,0.0318,new THREE.MeshBasicMaterial({map:bt}));
          const C=tex(160,420,function(g,w,h,s){ g.save(); g.scale(1,1); g.fillStyle='#f6f5f2'; g.fillRect(0,0,w,h); g.fillStyle='#8a8d91'; g.font='bold 15px sans-serif'; g.textAlign='center'; g.fillText('Panasonic',w/2,26);
              g.fillStyle=s&&s.run?'#10181f':'#3a3d42'; g.fillRect(28,44,104,170); if(s&&s.run){ g.fillStyle='#ffb45a'; g.font='bold 34px sans-serif'; g.fillText(s.txt,w/2,140); g.strokeStyle='#ffb45a'; g.lineWidth=4; g.beginPath(); g.arc(w/2,128,44,-Math.PI/2,-Math.PI/2+Math.PI*2*s.f); g.stroke(); g.fillStyle='#cfd8e0'; g.font='13px sans-serif'; g.fillText('あたため中',w/2,198); }
              g.fillStyle='#6a6d71'; g.font='12px sans-serif'; g.fillText('仕上がり   取 消',w/2,240); g.strokeStyle='#c9cacb'; g.lineWidth=2; g.beginPath(); g.arc(w/2,330,40,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(w/2,330,62,-Math.PI*0.85,-Math.PI*0.15); g.stroke();
              g.font='11px sans-serif'; g.fillText('手動 ─ 自動',w/2,262); g.fillText('あたため',w/2,322); g.fillText('スタート',w/2,336); g.fillText('決定',w/2,350); g.fillText('レンジ',22,334); g.restore(); });
          plane(B,0.112,0.295,(DX+W2)/2,0.2,Dp-0.0295,new THREE.MeshBasicMaterial({map:C}));
          const dial=new THREE.Mesh(new THREE.CylinderGeometry(0.019,0.02,0.008,24),lam(0xf0f0ee,{roughness:0.3})); dial.rotation.x=Math.PI/2; dial.position.set((DX+W2)/2,0.2-0.295*(330/420-0.5),Dp-0.026); B.add(dial);
          const st=stepper(0.8,function(v){ D.rotation.x=1.5*ease(v); cav.material.emissive.setHex(v>0.05||run.on?0x3a2a18:0x000000); });
          const run=timer(90,function(k,d){ cav.material.emissive.setHex(0xc07a30); win.material.opacity=0.45; C.draw({run:true,txt:fmt(d-k),f:k/d}); },function(stopped){ cav.material.emissive.setHex(st.target?0x3a2a18:0x000000); win.material.opacity=0.92; C.draw(); if(!stopped&&env.toast) env.toast('チン！加熱完成'); });
          P.anims.push(function(t){ return st.run(t); });
          P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.45,part:[dm,win],label:function(){ return st.target?'關上微波爐':'打開微波爐'; },act:function(){ st.target=st.target?0:1; if(st.target) run.stop(); }},
            {x:cx+0.15,z:z1+0.45,label:function(){ return run.on?'加熱中…':'開始加熱'; },act:function(){ if(run.on) return; if(st.target){ if(env.toast) env.toast('先關上微波爐的門'); return; } run.start(); }}]); })();
        /* Zojirushi 炎舞炊き NW-FC10, white: W26 x D33 x H23.5 cm, lid hinged at the back */
        (function(){ const Z=new THREE.Group(), cx=x0+0.5; Z.position.set(cx,0.88,az+0.079); P.group.add(Z); const w=0.13, d=0.33, wht=lam(0xf2efe8,{roughness:0.28}), champ=lam(0xcfc3a8,{metalness:0.75,roughness:0.3});   // 絹白 (WZ)
          rb(Z,-w,w,0,0.16,0,d,0.045,wht); (function(){ const sh=new THREE.Shape(), r=0.045; sh.moveTo(-w+r,-d); sh.lineTo(w-r,-d); sh.quadraticCurveTo(w,-d,w,-d+r); sh.lineTo(w,-r); sh.quadraticCurveTo(w,0,w-r,0); sh.lineTo(-w+r,0); sh.quadraticCurveTo(-w,0,-w,-r); sh.lineTo(-w,-d+r); sh.quadraticCurveTo(-w,-d,-w+r,-d);
            const hp=new THREE.Path(); hp.absarc(0,-d/2,0.104,0,Math.PI*2,true); sh.holes.push(hp); const g=new THREE.ExtrudeGeometry(sh,{depth:0.03,bevelEnabled:false,curveSegments:24}); g.rotateX(-Math.PI/2); g.translate(0,0.16,0); const m=new THREE.Mesh(g,wht); m.castShadow=true; Z.add(m); })();   // the top deck around the pot well
          plane(Z,0.2,0.004,0,0.186,d+0.0008,champ);   // body, a champagne line under the lid
          [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ const f=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.006,12),dk); f.position.set(q[0]*(w-0.03),-0.003,d/2+q[1]*(d/2-0.04)); Z.add(f); });   // feet plane(Z,0.2,0.003,0,0.19,d+0.0005,lgr).rotation.x=0;   // body, the seam under the lid
          const pot=new THREE.Mesh(new THREE.LatheGeometry([[0,0.07],[0.084,0.07],[0.096,0.078],[0.1,0.095],[0.1,0.19]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),40),lam(0x2b2a29,{roughness:0.35,side:THREE.DoubleSide})); pot.position.set(0,0,d/2); Z.add(pot);   // the iron inner pot, dark non-stick inside
          [0.145,0.158,0.171].forEach(function(y,k){ const m=new THREE.Mesh(new THREE.TorusGeometry(0.0995,0.0008,4,24,k===2?0.5:0.3),lam(0xb9bdc1,{roughness:0.4})); m.rotation.x=Math.PI/2; m.rotation.z=Math.PI*0.35; m.position.set(0,y,d/2); Z.add(m); });   // water lines for 1, 3 and 5 cups
          const rim=new THREE.Mesh(new THREE.TorusGeometry(0.1,0.004,6,32),chrome); rim.rotation.x=Math.PI/2; rim.position.set(0,0.19,d/2); Z.add(rim);
          const rice=new THREE.Mesh(new THREE.CircleGeometry(0.095,32),lam(0xfbfaf6,{roughness:0.9})); rice.rotation.x=-Math.PI/2; rice.position.set(0,0.13,d/2); Z.add(rice); rice.scale.setScalar(1.04);
          const L=new THREE.Group(); L.position.set(0,0.19,0.03); Z.add(L);   // lid, hinged at the back
          const lid=rb(L,-w,w,0,0.045,-0.03,d-0.03,0.045,wht);
          (function(){ const il=new THREE.Mesh(new THREE.CircleGeometry(0.098,36),lam(0xc9cdd1,{metalness:0.8,roughness:0.35,side:THREE.DoubleSide})); il.rotation.x=Math.PI/2; il.position.set(0,-0.002,d/2-0.03); L.add(il); const gk=new THREE.Mesh(new THREE.TorusGeometry(0.099,0.004,6,36),lam(0x8f9296,{roughness:0.8})); gk.rotation.x=Math.PI/2; gk.position.set(0,-0.003,d/2-0.03); L.add(gk);
            const vh=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.004,20),lam(0x9a9da1,{metalness:0.6,roughness:0.4})); vh.position.set(0,-0.004,0.035); L.add(vh); })();   // removable stainless inner lid with its gasket, the steam-cap port
          const T=tex(256,300,function(g,ww,hh,s){ g.fillStyle='#ebe7df'; g.fillRect(0,0,ww,hh); g.fillStyle='#f4f1ea'; g.fillRect(14,14,ww-28,hh-28); g.fillStyle='#9a9c9e'; g.fillRect(ww/2-26,30,52,10);
              g.fillStyle='#8a857c'; g.font='600 22px "Hiragino Mincho ProN",serif'; g.textAlign='center'; g.fillText('炎舞炊き',ww/2,80); g.strokeStyle='#dcd6ca'; g.lineWidth=2; g.strokeRect(30,110,ww-60,hh-150); g.fillStyle='#d33'; g.fillRect(ww-70,20,48,16); g.fillStyle='#fff'; g.font='bold 11px sans-serif'; g.fillText('圧力IH',ww-46,32); });
          const top=plane(L,0.17,0.2,0,0.0513,(d-0.06)/2-0.03+0.015,new THREE.MeshBasicMaterial({map:T})); top.rotation.x=-Math.PI/2;
          rb(Z,-0.035,0.035,0.17,0.188,d-0.004,d+0.006,0.008,lgr);   // pill-shaped lid release
          const lg=tex(256,40,function(g){ g.fillStyle='#f2efe8'; g.fillRect(0,0,256,40); g.fillStyle='#9a958c'; g.font='600 22px "Helvetica Neue",Arial,sans-serif'; g.textAlign='center'; g.fillText('ZOJIRUSHI',128,28); }); plane(Z,0.07,0.011,0,0.05,d+0.0005,new THREE.MeshBasicMaterial({map:lg}));
          const sc=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.028,0.012,24),wht); sc.position.set(0,0.056,0.035); L.add(sc); const sr=new THREE.Mesh(new THREE.TorusGeometry(0.027,0.0025,6,24),champ); sr.rotation.x=Math.PI/2; sr.position.set(0,0.062,0.035); L.add(sr);;
          const FP=tex(512,150,function(g,ww,hh,st){ g.fillStyle='#2b2c2e'; g.fillRect(0,0,ww,hh); g.fillStyle='#16181a'; g.fillRect(20,28,150,70); g.fillStyle=st&&st.run?'#ffb45a':'#9fb3a8'; g.font='bold 40px "Helvetica Neue",Arial,sans-serif'; g.textAlign='center'; g.fillText(st&&st.run?st.txt:'12:00',95,78);
            g.fillStyle='#d9d4c8'; g.font='600 22px "Hiragino Sans","Noto Sans JP",sans-serif'; [['メニュー',215],['予約',290],['取消',360],['炊飯',440]].forEach(function(q){ g.fillText(q[0],q[1],62); g.beginPath(); g.arc(q[1],100,q[0]==='炊飯'?16:11,0,Math.PI*2); g.strokeStyle='#d9d4c8'; g.lineWidth=2; g.stroke(); });
            g.fillStyle='#e8732a'; g.beginPath(); g.arc(440,100,5,0,Math.PI*2); g.fill(); g.fillStyle='#8a857c'; g.font='500 16px "Hiragino Sans",sans-serif'; g.fillText('炎舞炊き',95,124); });
          const fp=plane(L,0.17,0.05,0,0.0516,d-0.03-0.045,new THREE.MeshBasicMaterial({map:FP})); fp.rotation.x=-Math.PI/2;   // glossy dark control strip across the front of the lid   // steam cap
          let full=false; const st=stepper(0.7,function(v){ L.rotation.x=-(full?1.45:0.95)*ease(v); });   // about 55 degrees under the shelf, about 85 with the tray pulled out (the hinge then sits at the cabinet front)
          const run=timer(60,function(k,dd){ T.draw({run:true,txt:fmt(dd-k)}); FP.draw({run:true,txt:fmt(dd-k)}); },function(stopped){ T.draw(); FP.draw(); if(!stopped&&env.toast) env.toast('ご飯が炊けました'); });
          P.anims.push(function(t){ return st.run(t); });
          P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.45,part:[lid],label:function(){ return st.target?'關上電子鍋':'打開電子鍋'; },act:function(){ full=!!(P._trayOut&&P._trayOut.low>0.25); st.target=st.target?0:1; if(st.target&&!full&&env.toast) env.toast('上層托盤擋著，蓋子開到約 55°；先拉出下層托盤就能全開、蒸氣也不會進櫃子'); }},
            {x:cx+0.1,z:z1+0.45,label:function(){ return run.on?'煮飯中…':'開始煮飯'; },act:function(){ if(run.on) return; if(st.target){ if(env.toast) env.toast('先蓋上電子鍋'); return; } run.start(); }}]); })();
        /* Zojirushi PTQ-A100 steam-less kettle, slate grey: W15.4 x D26.4 x H23 cm on a 1.8 cm base; spout to the front, handle and dial at the back */
        (function(){ const K=new THREE.Group(), cx=x0+0.195; K.position.set(cx,0.88,az+0.312); P.group.add(K); const sg=lam(0x5d6166,{roughness:0.7}), sgd=lam(0x3f4246,{roughness:0.6}), mir=lam(0xd6d9dd,{metalness:0.6,roughness:0.25,envMapIntensity:0.9});   // fronts of the lower row on one line 4 cm behind the tray edge
          const cyl=function(r0,r1,y0,y1,m,x,z,seg){ const c=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,y1-y0,seg||32),m); c.position.set(x||0,(y0+y1)/2,z||0); c.castShadow=true; K.add(c); return c; };
          cyl(0.072,0.074,0,0.018,sg);   // power base
          const shell=new THREE.Mesh(new THREE.LatheGeometry([[0.0,0.018],[0.077,0.018],[0.076,0.06],[0.072,0.15],[0.07,0.205],[0.078,0.206],[0.078,0.214],[0.068,0.214],[0.064,0.205],[0.0635,0.04],[0.055,0.032],[0.0,0.032]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),40),sg); shell.castShadow=true; K.add(shell);   // double wall: slate outside, open at the top
          const inox=lam(0xc9cdd1,{metalness:0.85,roughness:0.3,side:THREE.DoubleSide}), pot=new THREE.Mesh(new THREE.LatheGeometry([[0.0,0.033],[0.055,0.033],[0.0632,0.042],[0.0632,0.204]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),40),inox); K.add(pot);   // stainless inner pot
          [0.09,0.135,0.18].forEach(function(y,k){ const m=new THREE.Mesh(new THREE.TorusGeometry(0.063,0.0007,4,24,k===2?0.6:0.35),lam(0x55595e,{roughness:0.4})); m.rotation.x=Math.PI/2; m.rotation.z=Math.PI*0.4; m.position.y=y; K.add(m); });   // level marks on the inner wall, the top one is MAX
          const wat=new THREE.Mesh(new THREE.CircleGeometry(0.0625,36),new THREE.MeshStandardMaterial({color:0xbfd9e2,transparent:true,opacity:0.55,roughness:0.03,metalness:0.1,envMapIntensity:1.2,depthWrite:false})); wat.rotation.x=-Math.PI/2; wat.position.y=0.15; wat.renderOrder=2; K.add(wat);   // water at about 0.8 L
          const gk=new THREE.Mesh(new THREE.TorusGeometry(0.066,0.0025,6,40),lam(0x1f2124,{roughness:0.6})); gk.rotation.x=Math.PI/2; gk.position.y=0.212; K.add(gk);   // rim gasket
          const L=new THREE.Group(); L.position.set(0,0.214,-0.07); K.add(L);   // lid hinged at the back rim, under the handle bridge
          const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.068,0.07,0.008,32),mir); lid.position.set(0,0.004,0.07); L.add(lid);
          const und=new THREE.Mesh(new THREE.CircleGeometry(0.06,32),lam(0xb9bdc1,{metalness:0.8,roughness:0.35,side:THREE.DoubleSide})); und.rotation.x=Math.PI/2; und.position.set(0,-0.0005,0.07); L.add(und);   // stainless underside
          const ug=new THREE.Mesh(new THREE.TorusGeometry(0.058,0.003,6,32),lam(0x2a2c2f,{roughness:0.7})); ug.rotation.x=Math.PI/2; ug.position.set(0,-0.002,0.07); L.add(ug); const vv=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.014,0.01,16),lam(0x3a3c40,{roughness:0.6})); vv.position.set(0,-0.006,0.08); L.add(vv);   // its seal and the steam-less valve
          const hg=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.03,10),sgd); hg.rotation.z=Math.PI/2; hg.position.set(0,0.002,0); L.add(hg);   // hinge pin
          const kt=(function(){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); g.fillStyle='#2a2c2f'; g.beginPath(); g.arc(64,64,62,0,Math.PI*2); g.fill(); g.strokeStyle='#8e9297'; g.lineWidth=2; g.beginPath(); g.arc(64,64,46,0,Math.PI*2); g.stroke(); g.fillStyle='#4a4d52'; g.beginPath(); g.arc(64,64,24,0,Math.PI*2); g.fill(); const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; return tx; })();
          const kn=new THREE.Mesh(new THREE.CircleGeometry(0.03,32),new THREE.MeshBasicMaterial({map:kt})); kn.rotation.x=-Math.PI/2; kn.position.set(0,0.0085,0.07); L.add(kn);
          const sp=new THREE.Mesh(new THREE.LatheGeometry([[0.007,0],[0.0105,0.003],[0.0095,0.012],[0.012,0.018],[0.011,0.0195],[0.0078,0.014],[0.0062,0.003]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),16),sg); sp.rotation.x=0.55; sp.scale.set(1.3,1,0.8); sp.position.set(0,0.199,0.07); sp.castShadow=true; K.add(sp);   // a short spout leaning forward out of the front shoulder, its lip flared
          const br=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.022,0.075),sgd); br.position.set(0,0.2,-0.105); K.add(br);
          cyl(0.013,0.013,0.06,0.2,sgd,0,-0.135,16);   // round-bar grip
          const dial=cyl(0.016,0.016,0.211,0.219,lam(0xc9cdd1,{metalness:0.8,roughness:0.35}),0,-0.11,24);
          const led=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.002,0.012),new THREE.MeshBasicMaterial({color:0x5a1a1a})); led.position.set(0.024,0.2115,-0.1); K.add(led);
          const zt=(function(){ const c=document.createElement('canvas'); c.width=128; c.height=24; const g=c.getContext('2d'); g.fillStyle='#5d6166'; g.fillRect(0,0,128,24); g.fillStyle='#8a8e93'; g.font='bold 13px sans-serif'; g.textAlign='center'; g.fillText('ZOJIRUSHI',64,17); const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; return tx; })();
          const zl=new THREE.Mesh(new THREE.PlaneGeometry(0.045,0.0085),new THREE.MeshBasicMaterial({map:zt})); zl.position.set(0,0.045,0.0765); K.add(zl);
          const temps=[50,60,70,80,90,100]; let ti=5;
          const st=stepper(0.6,function(v){ L.rotation.x=-1.45*ease(v); });
          const run=timer(90,function(k){ led.material.color.setHex(Math.sin(k*6)>-0.5?0xff2a2a:0x7a1a1a); },function(stopped){ led.material.color.setHex(0x5a1a1a); if(!stopped&&env.toast) env.toast('熱水好了（'+temps[ti]+'°C）'); });
          P.anims.push(function(t){ return st.run(t); });
          P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.45,part:[dial],label:function(){ return '設定溫度（'+temps[ti]+'°C）'; },act:function(){ ti=(ti+1)%temps.length; dial.rotation.y=-ti*0.5; if(env.toast) env.toast('熱水壺設定 '+temps[ti]+'°C'); }},
            {x:cx+0.05,z:z1+0.45,label:function(){ return run.on?'煮水中…':'開始煮水'; },act:function(){ if(run.on) return; if(st.target){ if(env.toast) env.toast('先蓋上壺蓋'); return; } run.start(); }},
            {x:cx-0.05,z:z1+0.45,part:[lid],label:function(){ return st.target?'蓋上壺蓋':'打開壺蓋'; },act:function(){ st.target=st.target?0:1; }}]); })();
        /* Kuvings SV-600 vacuum blender: W21.6 x D24 x H44.3 cm, a brushed base, a clear soundproof cover over the jug */
        (function(){ const V=new THREE.Group(), cx=x0+1.14; V.position.set(cx,0.88,az+0.285); P.group.add(V); const ss=lam(0xc3c7cb,{metalness:0.85,roughness:0.35}), bk=lam(0x141517,{roughness:0.35}), gl=lam(0x0c0d0f,{roughness:0.08,envMapIntensity:1.2});
          const clear=new THREE.MeshPhysicalMaterial({color:0xeef5f8,roughness:0.05,transparent:true,opacity:0.2,depthWrite:false,side:THREE.DoubleSide});
          rb(V,-0.108,0.108,0,0.17,-0.12,0.12,0.04,ss); rb(V,-0.106,0.106,0.17,0.185,-0.118,0.118,0.04,bk);   // base and its black top band
          const glow=new THREE.Mesh(new THREE.TorusGeometry(0.075,0.004,6,40),new THREE.MeshBasicMaterial({color:0x10161c})); glow.rotation.x=Math.PI/2; glow.position.y=0.186; V.add(glow);
          rb(V,-0.075,0.075,0.04,0.15,0.118,0.124,0.02,ss); const pn=rb(V,-0.07,0.07,0.045,0.145,0.122,0.128,0.018,gl);
          const pt=tex(128,96,function(g,w,h,s){ g.fillStyle='#0c0d0f'; g.fillRect(0,0,w,h); [36,64,92].forEach(function(x){ g.fillStyle='#3aa0ff'; g.fillRect(x-8,8,16,4); }); g.fillStyle='#9aa'; g.font='12px sans-serif'; g.fillText('∿',14,60); g.fillText('○',104,60);
              g.strokeStyle='#c9cdd1'; g.lineWidth=3; g.beginPath(); g.arc(64,58,26,0,Math.PI*2); g.stroke(); g.strokeStyle='#3aa0ff'; g.lineWidth=2; g.beginPath(); g.arc(64,58,8,-Math.PI*0.35,Math.PI*1.35); g.stroke();
              if(s){ g.fillStyle='#3aa0ff'; g.font='bold 11px sans-serif'; g.textAlign='center'; g.fillText(s,64,92); } g.fillStyle='#fff'; g.font='bold 9px sans-serif'; g.textAlign='left'; g.fillText('Kuvings',4,92); });
          plane(V,0.135,0.096,0,0.095,0.1295,new THREE.MeshBasicMaterial({map:pt}));
          const J=new THREE.Group(); J.position.y=0.185; V.add(J);
          const jug=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,0.2,24,1,true),clear); jug.position.y=0.11; jug.renderOrder=3; J.add(jug);
          const jh=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.008,6,12,Math.PI),bk); jh.rotation.z=-Math.PI/2; jh.rotation.y=Math.PI/2; jh.position.set(0.065,0.12,0); J.add(jh);
          const blades=new THREE.Group(); blades.position.y=0.03; J.add(blades); for(let i=0;i<6;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.002,0.008),chrome); b.rotation.y=i*Math.PI/3; b.rotation.z=(i%2?0.3:-0.3); b.position.set(Math.cos(i*Math.PI/3)*0.02,0,-Math.sin(i*Math.PI/3)*0.02); blades.add(b); }
          const veg=new THREE.Group(); J.add(veg); for(let i=0;i<12;i++){ const v=new THREE.Mesh(i%5===0?new THREE.CylinderGeometry(0.02,0.02,0.004,14):new THREE.BoxGeometry(0.025,0.02,0.025),lam(i%5===0?0xf2e04a:[0x4f8f3a,0x6aa84a,0x8bc34a][i%3],{roughness:0.6})); v.position.set(Math.sin(i*2.1)*0.03,0.04+(i%4)*0.035,Math.cos(i*1.7)*0.03); v.rotation.set(i,i*0.7,0); veg.add(v); }   // greens, apple, a lemon slice
          const smo=new THREE.Mesh(new THREE.CylinderGeometry(0.057,0.048,0.14,22),lam(0x8cbf4a,{roughness:0.4})); smo.position.y=0.08; smo.visible=false; J.add(smo);
          const CV=new THREE.Group(); V.add(CV);
          const cov=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.104,0.235,28,1,true),clear); cov.scale.z=0.95; cov.position.y=0.185+0.1175; cov.renderOrder=4; CV.add(cov);
          const cap=new THREE.Mesh(new THREE.SphereGeometry(0.095,24,8,0,Math.PI*2,0,Math.PI/2),bk); cap.scale.set(1,0.25,0.95); cap.position.y=0.42; CV.add(cap);
          const run=timer(45,function(k,d){ blades.rotation.y=k*60; J.position.x=0.0012*Math.sin(k*90); glow.material.color.setHex(0x3aa0ff); const f=Math.min(1,k/8); veg.visible=f<1; veg.scale.setScalar(1-0.6*f); smo.visible=f>0.3; pt.draw(fmt(d-k)); },
            function(stopped){ J.position.x=0; glow.material.color.setHex(0x10161c); pt.draw(); if(!stopped&&env.toast) env.toast('果汁打好了'); });
          P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.45,label:function(){ return run.on?'打果汁中…':'打果汁'; },act:function(){ if(run.on) return; veg.visible=true; veg.scale.setScalar(1); smo.visible=false; run.start(); }}]); })();
        /* Philips LatteGo EP5547, champagne gold: W24.6 x D37.1 x H43.3 cm; black body, glossy angled panel, gold lower front, LatteGo milk jug on the left */
        (function(){ const E=new THREE.Group(), cx=cxm; E.position.set(cx,0.88,az-0.04); P.group.add(E); const w=0.123, d=0.371, h=0.433, mb=lam(0x18191b,{roughness:0.7}), gold=lam(0xb8935a,{metalness:1,roughness:0.28,envMapIntensity:1.5}), gl=lam(0x0a0b0d,{roughness:0.06,envMapIntensity:1.2});   // 43.6 cm deep with the jug: front 2 cm behind the edge, cable room behind
          const clear=new THREE.MeshPhysicalMaterial({color:0xf2f6f8,roughness:0.05,transparent:true,opacity:0.35,depthWrite:false,side:THREE.DoubleSide});
          rb(E,-w,w,0.02,h,0,d-0.06,0.025,mb); const HL=new THREE.Group(); HL.position.set(0,h+0.001,0.02); E.add(HL); rb(HL,-w+0.02,w-0.02,-0.005,0.005,0,0.14,0.02,new THREE.MeshPhysicalMaterial({color:0x2a2620,roughness:0.15,transparent:true,opacity:0.7}));   // body, the smoky bean-hopper lid (the shelf above leaves no room to lift it; the beans show through)
          (function(){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); g.fillStyle='#4a2a14'; g.fillRect(0,0,128,128); for(let i=0;i<260;i++){ const x=(i*53)%128, y=(i*97)%128, a=(i*0.7)%3; g.save(); g.translate(x,y); g.rotate(a); g.fillStyle=['#8a5530','#7a4a26','#9a6036'][i%3]; g.beginPath(); g.ellipse(0,0,6,4.2,0,0,Math.PI*2); g.fill(); g.strokeStyle='#22120a'; g.lineWidth=1.2; g.beginPath(); g.moveTo(-4,0); g.quadraticCurveTo(0,1.5,4,0); g.stroke(); g.restore(); }
            const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; const bn=new THREE.Mesh(new THREE.PlaneGeometry(2*w-0.05,0.13),lam(0xffffff,{map:t,roughness:0.6})); bn.rotation.x=-Math.PI/2; bn.position.set(0,h+0.0005,0.09); E.add(bn); })();   // roasted beans in the hopper under the lid
          for(let i=0;i<5;i++) for(let j=0;j<3;j++) [-1,1].forEach(function(sd){ const v=new THREE.Mesh(new THREE.BoxGeometry(0.002,0.006,0.012),lam(0x060607)); v.position.set(sd*(w+0.0005),h-0.04-j*0.012,0.04+i*0.018); E.add(v); });   // side vents
          rb(E,-w,w,0,0.02,0,d,0.01,mb); const DT=new THREE.Group(); E.add(DT); const dtr=rb(DT,-w+0.01,w-0.01,0.02,0.032,d-0.12,d-0.005,0.008,lam(0xc9cdd1,{metalness:0.85,roughness:0.25})); for(let i=0;i<9;i++){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.002,0.1),lam(0x0b0c0d)); s.position.set(-0.09+i*0.0225,0.033,d-0.06); DT.add(s); }   // base; the chrome drip tray and its grid slide out with the grounds container
          (function(){ const cb=function(x0_,x1_,y0,y1,z0_,z1_,m){ const o=new THREE.Mesh(new THREE.BoxGeometry(x1_-x0_,y1-y0,z1_-z0_),m); o.position.set((x0_+x1_)/2,(y0+y1)/2,(z0_+z1_)/2); o.castShadow=true; DT.add(o); return o; }, gm=lam(0x232427,{roughness:0.6}), za=d-0.25, zf=d-0.12;
            cb(-0.09,0.09,0.032,0.036,za,zf,gm); cb(-0.09,-0.086,0.032,0.075,za,zf,gm); cb(0.086,0.09,0.032,0.075,za,zf,gm); cb(-0.09,0.09,0.032,0.075,za,za+0.004,gm); cb(-0.11,0.11,0.032,0.075,zf,zf+0.006,mb);   // grounds container, its front a black band under the gold panels
            [[-0.045,za+0.04],[0.02,za+0.06],[-0.01,za+0.1],[0.05,za+0.03]].forEach(function(q,i){ const pk=new THREE.Mesh(new THREE.CylinderGeometry(0.021,0.023,0.016,18),lam(0x3b2616,{roughness:0.95})); pk.position.set(q[0],0.044+(i%2)*0.004,q[1]); pk.rotation.z=(i-1.5)*0.1; DT.add(pk); }); })();   // spent coffee pucks
          rb(E,-w,-0.04,0.075,0.27,d-0.07,d-0.055,0.008,gold); rb(E,0.04,w,0.075,0.27,d-0.07,d-0.055,0.008,gold); rb(E,-0.04,0.04,0.17,0.27,d-0.075,d-0.06,0.006,gold);   // gold lower front panels, a centre recess
          const sp=rb(E,-0.035,0.035,0.2,0.235,d-0.06,d-0.015,0.008,gold); [-0.012,0.012].forEach(function(x){ const n=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.003,0.012,8),lam(0xd6dade,{metalness:0.9,roughness:0.2})); n.position.set(x,0.194,d-0.035); E.add(n); });
          const PG=new THREE.Group(); PG.position.set(0,0.35,d-0.06); PG.rotation.x=-0.18; E.add(PG); rb(PG,-w+0.004,w-0.004,-0.075,0.075,0,0.012,0.012,gold); rb(PG,-w+0.008,w-0.008,-0.071,0.071,0.008,0.016,0.01,gl);
          const drinks=['Espresso','Americano','Cappuccino','Latte Macchiato','Iced Coffee','Latte']; let di=5;
          const T=tex(256,160,function(g,W_,H_,s){ g.clearRect(0,0,W_,H_); g.fillStyle='#0a0b0d'; g.fillRect(0,0,W_,H_); g.strokeStyle='#cfd2d6'; g.lineWidth=2; [[18,24],[238,24]].forEach(function(q){ g.beginPath(); g.arc(q[0],q[1],9,0,Math.PI*2); g.stroke(); });
              g.fillStyle='#cfd2d6'; g.font='8px sans-serif'; g.textAlign='center'; ['Espresso','Coffee','Americano','Cappuccino','L.Macch.','Iced','Latte'].forEach(function(n,i){ const x=34+i*31; g.beginPath(); g.arc(x,58,8,0,Math.PI*2); g.stroke(); g.fillText(n,x,78); });
              ['Profile','More','Clean','Settings'].forEach(function(n,i){ g.fillText(n,40+i*40,140); });
              g.fillStyle='#1d2a38'; g.fillRect(96,92,64,36); g.fillStyle='#e8d2a6'; g.font='bold 9px sans-serif'; g.fillText(s?s.t:drinks[di],128,106); g.font='8px sans-serif'; g.fillStyle='#bcd'; g.fillText(s?s.p:'準備就緒',128,120); if(s){ g.fillStyle='#e8b95a'; g.fillRect(98,124,60*s.f,3); }
              g.fillStyle='#cfd2d6'; ['▲','▼','↩','OK'].forEach(function(n,i){ g.fillText(n,206+(i%2)*20,98+Math.floor(i/2)*20); }); });
          plane(PG,0.24,0.14,0,0,0.0165,new THREE.MeshBasicMaterial({map:T}));
          /* LatteGo jug on the left: clear jug with milk, black lid and handle, milk spout over the cup */
          const LJ=new THREE.Group(); LJ.position.set(-0.07,0.11,d+0.03); DT.add(LJ); const jug=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.1,0.07),clear); jug.renderOrder=3; LJ.add(jug);
          const milk=new THREE.Mesh(new THREE.BoxGeometry(0.068,0.06,0.063),lam(0xf7f5ee,{roughness:0.5})); milk.position.y=-0.018; LJ.add(milk); rb(LJ,-0.04,0.04,0.05,0.07,-0.037,0.037,0.01,mb); plane(LJ,0.05,0.012,0,0.06,0.038,new THREE.MeshBasicMaterial({color:0x8a8d91})); rb(LJ,0.032,0.05,-0.05,0.06,-0.03,0.03,0.008,mb);
          const ms=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.007,0.04,8),mb); ms.rotation.z=-0.9; ms.position.set(0.05,0.055,0.0); LJ.add(ms);
          /* glass mug on the tray: milk, coffee and foam layers that grow while it brews */
          const MG=new THREE.Group(); MG.position.set(0,0.034,d-0.035); DT.add(MG); const mug=new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.032,0.13,20,1,true),clear); mug.position.y=0.065; mug.renderOrder=3; MG.add(mug);
          const layer=function(c){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.031,0.031,1,18),lam(c,{roughness:0.5})); m.visible=false; m.scale.y=0.001; MG.add(m); return m; }; const Lm=layer(0xf3eee2), Lc=layer(0x7a4a26), Lf=layer(0xfbf8f2);
          const setL=function(m,y0,hh){ m.visible=hh>0.001; m.scale.y=Math.max(0.001,hh); m.position.y=y0+hh/2; };
          const stM=new THREE.Mesh(new THREE.CylinderGeometry(0.002,0.002,1,6),lam(0xf7f5ee)), stC=[-0.012,0.012].map(function(x){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.0015,0.0015,1,6),lam(0x5a3518)); m.position.set(x,0.1,0.3); m.scale.y=0.001; m.visible=false; E.add(m); return m; }); stM.position.set(0,0.1,0.3); stM.scale.y=0.001; stM.visible=false; E.add(stM);
          const plan=function(n){ return {Espresso:[0,0.03,0.006],Americano:[0,0.09,0],Cappuccino:[0.03,0.025,0.03],'Latte Macchiato':[0.05,0.02,0.03],'Iced Coffee':[0,0.06,0],Latte:[0.06,0.025,0.012]}[n]; };
          const run=timer(25,function(k,dd){ const q=plan(drinks[di]), f=k/dd, milkF=Math.min(1,k/10), cofF=Math.max(0,Math.min(1,(k-10)/10)), foamF=Math.max(0,Math.min(1,(k-20)/4));
              setL(Lm,0.004,q[0]*milkF); setL(Lc,0.004+q[0]*milkF,q[1]*cofF); setL(Lf,0.004+q[0]*milkF+q[1]*cofF,q[2]*foamF);
              const top=0.034+0.004+q[0]*milkF+q[1]*cofF+0.02; stM.visible=q[0]>0&&k<10; if(stM.visible){ stM.scale.y=0.14-top+0.034; stM.position.set(-0.02,top+stM.scale.y/2,d-0.035); }
              stC.forEach(function(m){ m.visible=k>=10&&k<20; if(m.visible){ m.scale.y=0.194-top; m.position.set(m.position.x,top+m.scale.y/2,d-0.035); } });
              T.draw({t:drinks[di],p:k<10&&q[0]?'打奶泡中':k<20?'萃取中':'完成中',f:f}); },
            function(){ stM.visible=false; stC.forEach(function(m){ m.visible=false; }); T.draw(); if(env.toast) env.toast(drinks[di]==='Latte'?'拿鐵完成':drinks[di]+' 完成'); });
          P.actions.push({x:cx,z:z1+0.45,part:[sp],label:function(){ return run.on?'沖煮中…':'沖煮咖啡'; },act:function(){ if(run.on) return; if(sD.target){ if(env.toast) env.toast('先把滴水盤推回去'); return; } [Lm,Lc,Lf].forEach(function(m){ m.visible=false; }); run.start(); }});
          P.actions.push({x:cx+0.08,z:z1+0.45,label:function(){ return '選擇飲品（'+drinks[di]+'）'; },act:function(){ if(run.on) return; di=(di+1)%drinks.length; T.draw(); if(env.toast) env.toast('已選擇 '+drinks[di]); }});
          const sD=stepper(0.6,function(v){ DT.position.z=0.15*ease(v); }); P.anims.push(function(t){ return sD.run(t); });
          P.actions.push({x:cx+0.04,z:z1+0.45,part:[dtr],label:function(){ return sD.target?'推回滴水盤':'拉出滴水盤・咖啡渣盒'; },act:function(){ if(run.on) return; sD.target=sD.target?0:1; }}); })();
        /* Philips 7000 XXL Combi HD9880/90, black: 40.3 deep x 31.5 wide x 30.7 high, the basket drawer pulls out to the front */
        (function(){ const A=new THREE.Group(), cx=x0+0.9895; A.position.set(cx,Y1,zb+0.02); P.group.add(A); const w=0.1575, d=0.403, h=0.307, mb=lam(0x1a1b1d,{roughness:0.75}), steel=lam(0xb9bdc1,{metalness:0.85,roughness:0.35});
          [[-0.11,0.04],[0.11,0.04],[-0.11,0.36],[0.11,0.36]].forEach(function(q){ const f=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,0.008,10),dk); f.position.set(q[0],0.004,q[1]); A.add(f); });
          rb(A,-w,w,0.165,h-0.012,0,d,0.05,mb); rb(A,-w,w,0.008,0.17,0,d-0.27,0.03,mb); [[-w,-w+0.011],[w-0.011,w]].forEach(function(q){ rb(A,q[0],q[1],0.008,0.17,d-0.3,d,0.005,mb); }); rb(A,-w+0.01,w-0.01,0.008,0.011,d-0.3,d,0.002,mb);   // body, hollow where the drawer runs
          rb(A,-w+0.012,w-0.012,h-0.016,h,0.02,d-0.03,0.04,lam(0x111214,{roughness:0.9}));   // body and the textured lid panel
          rb(A,-w-0.002,w+0.002,0.17,0.2,-0.002,d+0.002,0.052,steel);   // brushed band
          const bt=tex(256,32,function(g,ww,hh){ g.fillStyle='#b9bdc1'; g.fillRect(0,0,ww,hh); g.fillStyle='#4a4d52'; g.font='13px sans-serif'; g.textAlign='center'; g.fillText('Rapid CombiAir Technology',ww/2,21); }); plane(A,0.2,0.025,0,0.185,d+0.0035,new THREE.MeshBasicMaterial({map:bt}));
          rb(A,-0.13,0.13,0.205,0.295,d-0.004,d+0.004,0.02,steel); rb(A,-0.126,0.126,0.208,0.292,d,d+0.006,0.018,lam(0x0c0d0f,{roughness:0.08,metalness:0.3,envMapIntensity:1.2}));   // silver bezel, glossy panel
          const Dp=tex(256,96,function(g,ww,hh,s){ g.fillStyle='#0c0d0f'; g.fillRect(0,0,ww,hh); g.fillStyle='#cfd2d6'; g.font='bold 13px sans-serif'; g.textAlign='center'; g.fillText('PHILIPS',ww/2,14);
              g.strokeStyle='#5a4a2a'; g.lineWidth=5; g.beginPath(); g.arc(ww/2,56,30,0,Math.PI*2); g.stroke(); g.strokeStyle='#e8b95a'; g.beginPath(); g.arc(ww/2,56,30,-Math.PI/2,-Math.PI/2+Math.PI*2*(s?s.f:1)); g.stroke();
              g.fillStyle='#f2f2f2'; g.font='bold 13px sans-serif'; g.fillText(s?s.txt:'160°C',ww/2,54); g.font='10px sans-serif'; g.fillText(s?'160°C':'20 min',ww/2,70); g.fillStyle='#8a8d91'; g.font='14px sans-serif'; g.fillText('◜ ↩',40,62); g.fillText('▶',ww-70,62); });
          const disp=plane(A,0.2,0.075,-0.01,0.25,d+0.0062,new THREE.MeshBasicMaterial({map:Dp}));
          const kn=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.019,0.018,24),steel); kn.rotation.x=Math.PI/2; kn.position.set(0.095,0.25,d+0.012); A.add(kn);
          const DR=new THREE.Group(); A.add(DR);   // basket drawer
          const fr=rb(DR,-w+0.006,w-0.006,0.012,0.165,d-0.012,d+0.006,0.045,mb);
          const hd=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0.14,d+0.004),new THREE.Vector3(0,0.13,d+0.04),new THREE.Vector3(0,0.06,d+0.05),new THREE.Vector3(0,0.02,d+0.012)]),20,0.011,10,false),mb); DR.add(hd);
          const pb=function(x0_,x1_,y0,y1,z0_,z1_,m){ const o=new THREE.Mesh(new THREE.BoxGeometry(x1_-x0_,y1-y0,z1_-z0_),m); o.position.set((x0_+x1_)/2,(y0+y1)/2,(z0_+z1_)/2); o.castShadow=true; o.receiveShadow=true; DR.add(o); return o; }, pan=lam(0x232427,{roughness:0.55}), zb2=d-0.26;   // the pan: open-topped, the drawer front is its fourth wall
          pb(-w+0.012,w-0.012,0.012,0.018,zb2,d-0.012,pan); pb(-w+0.012,-w+0.018,0.012,0.165,zb2,d-0.012,pan); pb(w-0.018,w-0.012,0.012,0.165,zb2,d-0.012,pan); pb(-w+0.012,w-0.012,0.012,0.165,zb2,zb2+0.006,pan);
          const perf=(function(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.fillStyle='#2e3033'; g.fillRect(0,0,64,64); g.fillStyle='#0b0c0d'; for(let j=0;j<8;j++) for(let i=0;i<8;i++){ g.beginPath(); g.arc(4+i*8+(j%2)*4,4+j*8,2.2,0,Math.PI*2); g.fill(); } const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,2); t.colorSpace=THREE.SRGBColorSpace; return lam(0xffffff,{map:t,roughness:0.5,metalness:0.3}); })();
          const bz0=zb2+0.015, bz1=d-0.03; pb(-0.125,0.125,0.035,0.039,bz0,bz1,perf); pb(-0.125,-0.121,0.035,0.15,bz0,bz1,perf); pb(0.121,0.125,0.035,0.15,bz0,bz1,perf); pb(-0.125,0.125,0.035,0.15,bz0,bz0+0.004,perf); pb(-0.125,0.125,0.035,0.15,bz1-0.004,bz1,perf);   // the perforated basket on its feet in the pan
          [-0.123,0.123].forEach(function(x){ pb(x-0.004,x+0.004,0.146,0.152,bz0+0.02,bz1-0.02,steel); });   // the basket's rim
          for(let i=0;i<14;i++){ const fz=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.012,0.07),lam(i%3?0xe2b04f:0xd59a3a,{roughness:0.6})); fz.position.set(-0.08+(i*0.037)%0.16,0.046+(i%3)*0.012,d-0.13+((i*0.053)%0.12)-0.06); fz.rotation.y=(i*1.3)%3; DR.add(fz); }   // fries on the crisper plate
          const fan=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.004,16),lam(0x4a4c50,{metalness:0.5,roughness:0.4})); fan.position.set(0,0.17,d-0.17); A.add(fan);
          let far=false; const inner=DR.children.slice(); const st=stepper(0.6,function(v){ DR.position.z=(far?0.22:0.11)*ease(v); inner.forEach(function(o){ if(o!==fr&&o!==hd) o.visible=v>0; }); }); inner.forEach(function(o){ if(o!==fr&&o!==hd) o.visible=false; });   // half out on the shelf; well out over a pulled-out tray
          const run=timer(40,function(k,dd){ Dp.draw({f:1-k/dd,txt:fmt((dd-k)*30)}); },function(stopped){ Dp.draw(); if(!stopped&&env.toast) env.toast('氣炸完成'); });
          P.anims.push(function(t){ return st.run(t); });
          P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.45,part:[fr,hd],label:function(){ return st.target?'推回氣炸鍋':'拉出氣炸鍋'; },act:function(){ if(!st.target) far=!!(P._trayOut&&P._trayOut.up>0.25); st.target=st.target?0:1; if(st.target) run.stop(); }},
            {x:cx-0.1,z:z1+0.45,label:function(){ return run.on?'氣炸中…':'開始氣炸'; },act:function(){ if(run.on) return; if(st.target){ if(env.toast) env.toast('先把炸籃推回去'); return; } run.start(); }}]); })();
      })();
      (function(){                                                                          // sockets, and a cable duct along the back of each shelf that the cords drop into
        const plate=lam(0xf4f2ec,{roughness:0.5}), hole=lam(0x1a1a1a), duct=lam(0xf3f1ec,{roughness:0.45}), cw=lam(0xe8e8e4,{roughness:0.8}), cb=lam(0x242424,{roughness:0.8});
        const sock=function(px,py){ P.rbox(px-0.022,px+0.022,z0+0.015,z0+0.022,py-0.045,py+0.045,0.004,plate,oc); [-0.02,0.02].forEach(function(dy){ P.box(px-0.009,px+0.009,z0+0.022,z0+0.0235,py+dy-0.006,py+dy+0.006,hole,oc); }); };
        const ductAt=function(y){ P.box(x0+0.025,x1-0.025,z0+0.015,z0+0.055,y,y+0.04,duct,oc); P.box(x0+0.025,x1-0.025,z0+0.052,z0+0.055,y+0.034,y+0.036,lam(0xd9d6cf),oc); };   // 4 x 4 cm raceway with a lid seam
        ductAt(0.88); ductAt(Y1);
        const drop=function(x,y,zf,mt){ if(!TR){ const pts=[[x,y,zf],[x,y-0.01,zf-0.4*(zf-z0-0.06)],[x,y+0.035,z0+0.07],[x,y+0.045,z0+0.04]].map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); });   // short run from the appliance's back into the duct
            P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,0.0035,6,false),mt),oc); return; }
          const pts=[[x,y,zf],[x,y-0.004,zb+0.06],[x,y+0.012,zb+0.035]].map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); });   // on the tray: appliance back to the tray's rear edge
          P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),8,0.0035,6,false),mt),oc);
          const sl=P.cyl(x,0,0.0035,0.0035,-0.5,0.5,mt,oc,6); sl.rotation.x=Math.PI/2; P.box(x-0.0035,x+0.0035,z0+0.045,z0+0.052,y+0.012,y+0.05,mt,oc);   // slack from the duct to the tray rear, stretched as the tray slides
          slack.push({m:sl,y:(y<1.1?0.88:Y1)+0.004,x:x}); };
        const slack=[]; P._slack=slack;
        const P1=[x0+(F?0.55:0.335),1.06], P2=[x0+(F?0.86:0.64),1.06], P3=[x0+(F?0.47:0.535),Y1+0.15];
        [P1,P2,P3].forEach(function(q){ sock(q[0],q[1]); [-0.012,0.012].forEach(function(dx){ P.box(q[0]+dx-0.002,q[0]+dx+0.002,z0+0.022,z0+0.03,q[1]>Y1?Y1+0.035:0.915,q[1]-0.02,cb,oc).userData.stay=true; }); });   // plugs leave the sockets and go straight down into the duct below
        if(K2){ drop(x0+0.195,0.9,az+0.02,cw); drop(x0+0.5,0.9,az+0.02,cw); drop(cxm-0.06,0.9,az+0.02,cb); drop(x0+0.9895,Y1+0.02,az+0.02,cb); }
        else if(F){ drop(x0+0.12,0.9,az+0.02,cw); drop(x0+0.7,0.9,az+0.02,cw); drop(cxm-0.06,0.9,az+0.02,cb); drop(x0+0.38,0.9,az+0.02,cw); drop(x0+1.02,Y1+0.02,az+0.02,cb); }
        else { drop(x0+0.19,0.9,az+0.02,cw); drop(cxm-0.06,0.9,az+0.02,cb); drop(x0+0.85,0.9,az+0.02,cb); }
        if(F&&W>1.3) drop(x0+(K2?1.14:1.215),0.9,az+0.02,cb);
        drop(x0+(K2?0.426:0.33),Y1+0.02,az+0.02,cw); if(!K2) drop(x0+0.71,Y1+0.02,az+0.02,cb);
      })();
      if(TR) [[0.868,Y1-0.03,'下層',M.top,0.025],[Y1-0.012,LOW?H-0.03:S0+ST,'上層',M.oak,0]].forEach(function(lv){                             // the whole shelf pulls out: 3 cm board on side-wall runners, finger notch at the front
        const G=new THREE.Group(), tz0=zb+0.02, tz1=z1+lv[4], tp=lv[0]; P.group.add(G);
        const keep=[]; P.group.children.forEach(function(o){ if(o===G||o.renderOrder===1||o.isLight||o.userData.stay) return;   // stay: carcass parts such as the LED strips under the shelf above
          if(o.position.lengthSq()===0&&(o.visible===false||(o.material&&o.material.transparent))){ if(lv[0]<1) keep.push(o); return; }   // steam and the coffee stream are positioned when they play; they belong to the lower tray
          const b=new THREE.Box3().setFromObject(o); if(b.isEmpty()) return; if(b.min.y>=tp-0.001&&b.max.y<=lv[1]+(lv[0]<1?0.06:0)&&b.min.z>z0+0.06) keep.push(o); });   // the coffee machine and blender rise into the board above's thickness
        keep.forEach(function(o){ G.add(o); });
        const add=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; G.add(m); return m; };
        add(new THREE.BoxGeometry(W-2*T-0.006,0.03,tz1-tz0-0.003),lv[3],0,tp-0.003,(tz0+tz1)/2+0.0015); add(new THREE.BoxGeometry(0.1,0.012,0.004),lam(0x8a7458,{roughness:0.8}),0,tp-0.003,tz1+0.0005);
        [-1,1].forEach(function(sd){ const rl=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.012,tz1-tz0-0.04),M.steel); rl.position.set(sd*(W/2-T-0.002),tp-0.003,(tz0+tz1)/2); P.add(rl,oc); });
        const st=stepper(0.7,function(t){ const o=0.3*ease(t); G.position.z=o; P._trayOut=P._trayOut||{}; P._trayOut[lv[0]<1?'low':'up']=o; (P._slack||[]).forEach(function(q){ if(Math.abs(q.y-(tp+0.016))>0.03) return; const a=z0+0.052, b=tz0+0.015+o; q.m.scale.y=Math.max(0.01,b-a); q.m.position.set(q.x,q.y,(a+b)/2); }); });
        st.run(0); P.anims.push(function(t){ return st.run(t); });
        P.actions=(P.actions||[]).concat([{x:lv[0]<1?x0+0.3:x1-0.3,z:z1+0.6,part:[G],label:function(){ return (st.target?'推回':'拉出')+lv[2]+'家電托盤'; },act:function(){ st.target=st.target?0:1; }}]); });
      P.cols.push({x0:x0,x1:x1,z0:z0,z1:z1+0.025,kind:'f'}); env.contactShadow(x0,x1,z0,z1,0,P.group);
      return P;
    };
    /* two floating shelves on a wall (origin on the wall face, room on +z): books and a small plant on the lower one, a framed photo on the upper one */
    Catalog.wallShelves=function(){
      const P=new Piece(), lam=env.lam, L=function(px){ return (px-455)*S1; }, oc={cast:false};
      const bk=[0x8d6a47,0x5f6f82,0xb26b5a,0xd8d2c6,0x3f4a58,0x8a9a86].map(function(c){ return lam(c,{roughness:0.8}); });
      [[420,490,1.25],[432,478,1.58]].forEach(function(s2,k){
        P.box(L(s2[0]),L(s2[1]),0,0.17,s2[2],s2[2]+0.025,M.oak);
        if(k===0){ for(let i=0;i<6;i++) P.box(L(s2[0])+0.05+i*0.045,L(s2[0])+0.05+i*0.045+0.036,0.02,0.15,s2[2]+0.025,s2[2]+0.025+0.17+(i%3)*0.03,bk[i],oc);
          P.cyl(L(s2[1])-0.08,0.085,0.06,0.045,s2[2]+0.025,s2[2]+0.2,M.pot,oc,14); P.cyl(L(s2[1])-0.08,0.085,0.05,0.05,s2[2]+0.2,s2[2]+0.215,M.leafL,oc,12); }
        else { P.rotBox(L(s2[0])+0.14,0.1,0.2,0.02,s2[2]+0.025,s2[2]+0.25,0,M.woodD||M.oakD,oc); P.box(L(s2[0])+0.05,L(s2[0])+0.23,0.09,0.11,s2[2]+0.05,s2[2]+0.23,lam(0xf3ecdf),oc); }
      });
      return P;
    };
    /* full-length mirror 50 x 160 cm in a wooden frame; wall piece facing +x */
    Catalog.fullMirror=function(){
      const P=new Piece();
      P.box(0,0.03,-0.28,0.28,0.12,1.8,M.woodD||M.oakD);
      const m=env.mirror?env.mirror(0.5,1.6):new THREE.Mesh(new THREE.PlaneGeometry(0.5,1.6),mat('mirror',0xdfe8ec,{metalness:1,roughness:0.03,envMapIntensity:1}));
      m.position.set(0.032,0.96,0); m.rotation.y=Math.PI/2; P.group.add(m);
      return P;
    };
    /* hanging clothes: w metres of rail at 1.75 m with a storage shelf above (two boxes); 0.6 m deep, the open side is +z */
    function garmentGeo(type,hh,w){
      hh=Math.max(hh,0.7);
      const R=[[[0.06,0],[w,-0.05],[w+0.1,-0.17],[w+0.06,-0.23],[w,-0.14],[w-0.015,-hh]],
               [[0.07,0],[w,-0.05],[w+0.05,-0.4],[w+0.045,-0.62],[w+0.0,-0.62],[w-0.01,-hh]],
               [[0.05,0],[w-0.04,-0.06],[w-0.07,-0.3],[w+0.07,-hh]]][type];
      const s=new THREE.Shape();
      s.moveTo(R[0][0],R[0][1]); for(let i=1;i<R.length;i++) s.lineTo(R[i][0],R[i][1]);
      for(let i=R.length-1;i>=0;i--) s.lineTo(-R[i][0],R[i][1]);
      s.quadraticCurveTo(0,-0.075,R[0][0],R[0][1]);
      return new THREE.ExtrudeGeometry(s,{depth:0.03,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:1});
    }
    /* one hanging garment on a hanger, the rod 10 cm above the origin: kind 0 shirt, 1 jacket, 2 dress, 3 trousers folded over the hanger bar */
    /* Clothes for wardrobes: Catalog.clothes.hang(kind,o) returns a garment on its hanger, the hook's centre at the origin (sits on a rail along x when the
       group is turned rotation.y = PI/2: shoulders run along the rail's depth). kinds: shirt, knit, tee, coat, puffer, dress (o.len), trousers, skirt.
       Soft slabs with sloped shoulders, a gentle bulge and a draped hem; one wooden hanger style throughout. Also fold(w,d,n,cols) stacks and bag(kind). */
    Catalog.clothes=(function(){
      const fabC={}, ribT={}, oc={cast:false};
      const fabM=function(c,rib){ const k=c+(rib?'r':''); if(fabC[k]) return fabC[k];
        if(rib){ if(!ribT.t){ const cv=document.createElement('canvas'); cv.width=64; cv.height=8; const g=cv.getContext('2d'); for(let i=0;i<64;i++){ const v=128+Math.round(110*Math.sin(i/64*Math.PI*2*8)); g.fillStyle='rgb('+v+','+v+','+v+')'; g.fillRect(i,0,1,8); } ribT.t=new THREE.CanvasTexture(cv); ribT.t.wrapS=ribT.t.wrapT=THREE.RepeatWrapping; ribT.t.repeat.set(4,1); }
          return fabC[k]=env.fab(c,{bumpMap:ribT.t,bumpScale:0.006}); }
        return fabC[k]=env.fab(c); };
      const wood=function(){ return fabC.__wood||(fabC.__wood=env.lam(0xc9a274,{roughness:0.45,map:M.oak&&M.oak.map||null})); }, chrome=function(){ return fabC.__chr||(fabC.__chr=env.lam(0xc8ccd0,{metalness:0.85,roughness:0.25})); };
      const mesh=function(G,geo,m,x,y,z){ const o=new THREE.Mesh(geo,m); o.position.set(x||0,y||0,z||0); o.castShadow=true; o.receiveShadow=true; G.add(o); return o; };
      /* soft slab hanging from y0 down L: prof(t) -> [half width, half thickness] (t 0 top .. 1 hem); drop: shoulder slope; wave: hem drape */
      const slab=function(L,prof,o){ o=o||{}; const g=new THREE.BoxGeometry(1,1,1,10,Math.max(8,Math.round(L*30)),2), p=g.attributes.position, drop=o.drop==null?0.04:o.drop, wave=o.wave==null?0.012:o.wave, qz=o.quilt||0;
        for(let i=0;i<p.count;i++){ const u=p.getX(i)*2, t=0.5-p.getY(i), w=p.getZ(i)*2, pr=prof(t), au=Math.abs(u), puff=1-0.75*Math.pow(au,4);
          let z=w*pr[1]*puff; if(qz) z*=1-0.35*Math.pow(Math.abs(Math.sin(t*L*Math.PI/qz)),3);
          const y=-drop*Math.pow(au,1.6)*Math.max(0,1-t*3)-t*L+wave*Math.pow(t,3)*Math.sin(u*5.5+(o.ph||0));
          p.setXYZ(i,u*pr[0]+(o.lean||0)*t*t,y,z+(o.bow||0)*Math.sin(t*Math.PI)); }
        g.computeVertexNormals(); return g; };
      const tube=function(r0,r1,len){ const g=new THREE.CylinderGeometry(r0,r1,len,12,4); g.translate(0,-len/2,0); return g; };
      const hanger=function(G,clip,w){ w=w||0.4; const hk=new THREE.Mesh(new THREE.TorusGeometry(0.017,0.0022,6,16,Math.PI*1.35),chrome()); hk.rotation.z=-0.2; G.add(hk); mesh(G,new THREE.CylinderGeometry(0.0022,0.0022,0.045,6),chrome(),0.017*Math.cos(-0.2)+0.0,-0.025,0).rotation.z=0.25;
        if(clip){ mesh(G,new THREE.BoxGeometry(w,0.016,0.012),wood(),0,-0.052,0); [-1,1].forEach(function(sd){ mesh(G,new THREE.BoxGeometry(0.03,0.04,0.016),chrome(),sd*(w/2-0.04),-0.07,0); }); return -0.075; }
        const c=new THREE.CatmullRomCurve3([new THREE.Vector3(-w/2,-0.085,0),new THREE.Vector3(-w/4,-0.06,0),new THREE.Vector3(0,-0.05,0),new THREE.Vector3(w/4,-0.06,0),new THREE.Vector3(w/2,-0.085,0)]), tg=new THREE.TubeGeometry(c,16,0.009,8,false); tg.scale(1,1,1.6); mesh(G,tg,wood(),0,0,0);
        return -0.05; };
      const button=function(G,x,y,z,c){ const b=mesh(G,new THREE.CylinderGeometry(0.005,0.005,0.003,8),fabC.__btn||(fabC.__btn=env.lam(c||0xece6da,{roughness:0.35})),x,y,z); b.rotation.x=Math.PI/2; b.castShadow=false; };
      const K={
        shirt:function(G,y,o){ const L=o.len||0.74, c=o.c, f=fabM(c), ht=0.024; mesh(G,slab(L,function(t){ return [0.2+0.015*t,ht]; },{drop:0.05}),f,0,y,0);
          [-1,1].forEach(function(sd){ const s=mesh(G,tube(0.034,0.028,L*0.78),f,sd*0.19,y-0.06,0.0); s.rotation.z=sd*0.06; mesh(G,tube(0.03,0.03,0.05),f,sd*(0.19+0.045*0.06),y-0.06-L*0.78,0).rotation.z=sd*0.06; });
          const col=mesh(G,new THREE.TorusGeometry(0.06,0.011,6,18,Math.PI),f,0,y-0.005,0.012); col.rotation.x=-Math.PI/2+0.25; col.scale.set(1,1,0.6);
          mesh(G,new THREE.BoxGeometry(0.024,L-0.05,0.004),f,0,y-0.03-(L-0.05)/2,ht+0.001); for(let k=0;k<6;k++) button(G,0,y-0.06-k*(L-0.12)/5,ht+0.004,o.btn); },
        knit:function(G,y,o){ const L=o.len||0.66, f=fabM(o.c), rb=fabM(o.c,true), ht=0.036; mesh(G,slab(L*0.9,function(t){ return [0.2+0.01*Math.sin(t*3),ht]; },{drop:0.06,wave:0.006}),f,0,y,0);
          mesh(G,slab(L*0.1,function(){ return [0.188,ht*0.9]; },{drop:0,wave:0}),rb,0,y-L*0.9+0.005,0);
          [-1,1].forEach(function(sd){ mesh(G,tube(0.042,0.036,L*0.72),f,sd*0.19,y-0.07,-0.004).rotation.z=sd*0.04; mesh(G,tube(0.034,0.032,0.06),rb,sd*(0.19+0.04*0.04),y-0.07-L*0.72,-0.004).rotation.z=sd*0.04; });
          const nk=mesh(G,new THREE.TorusGeometry(0.07,0.014,6,20),rb,0,y-0.002,0); nk.rotation.x=Math.PI/2; nk.scale.set(1,0.55,1); },
        tee:function(G,y,o){ const L=o.len||0.68, f=fabM(o.c), ht=0.014; mesh(G,slab(L,function(t){ return [0.17,ht]; },{drop:0.05,wave:0.01}),f,0,y,0);
          [-1,1].forEach(function(sd){ const s=mesh(G,tube(0.045,0.042,0.16),f,sd*0.165,y-0.05,0); s.rotation.z=sd*0.3; s.scale.z=0.4; });
          const nk=mesh(G,new THREE.TorusGeometry(0.06,0.006,5,18),f,0,y-0.004,0); nk.rotation.x=Math.PI/2; nk.scale.set(1,0.6,1); },
        coat:function(G,y,o){ const L=o.len||1.05, f=fabM(o.c), ht=0.04; mesh(G,slab(L,function(t){ return [0.2+0.035*t,ht]; },{drop:0.06,wave:0.012}),f,0,y,0);
          [-1,1].forEach(function(sd){ mesh(G,tube(0.045,0.04,0.62),f,sd*0.2,y-0.07,-0.006).rotation.z=sd*0.03;
            for(let k=0;k<3;k++) button(G,sd*0.06,y-0.38-k*0.12,ht+0.005,0x5a4632); });
          mesh(G,new THREE.BoxGeometry(0.4+0.035*0.9,0.04,ht*2+0.012),f,0,y-0.48,0); mesh(G,new THREE.BoxGeometry(0.035,0.03,0.006),chrome(),0.04,y-0.48,ht+0.008);   // belt and buckle
          const col=mesh(G,new THREE.TorusGeometry(0.075,0.016,6,18,Math.PI),f,0,y-0.008,0.01); col.rotation.x=-Math.PI/2+0.3; col.scale.set(1,1,0.7); },
        puffer:function(G,y,o){ const L=o.len||0.95, f=fabC['p'+o.c]||(fabC['p'+o.c]=env.lam(o.c,{roughness:0.45})), ht=0.07; mesh(G,slab(L,function(t){ return [0.2+0.01*t,ht]; },{drop:0.07,wave:0.006,quilt:0.13}),f,0,y,0);
          [-1,1].forEach(function(sd){ const g=new THREE.LatheGeometry(Array.from({length:13},function(_,k){ const tt=k/12; return new THREE.Vector2(0.048-0.01*tt-0.01*Math.pow(Math.abs(Math.sin(tt*Math.PI*5)),3),-tt*0.6); }),14); mesh(G,g,f,sd*0.2,y-0.08,0).rotation.z=sd*0.02; });
          const cl=mesh(G,new THREE.CylinderGeometry(0.085,0.09,0.07,20,1,true),f,0,y+0.005,0); cl.scale.z=0.75; mesh(G,new THREE.BoxGeometry(0.008,L-0.08,0.004),chrome(),0,y-0.05-(L-0.08)/2,ht+0.002); },
        dress:function(G,y,o){ const L=o.len||1.2, f=fabM(o.c), ht=0.018; mesh(G,slab(L,function(t){ const w=t<0.3?0.18-0.05*t/0.3:0.13+(o.flare||0.22)*Math.pow((t-0.3)/0.7,1.3); return [w,ht+0.012*t]; },{drop:0.03,wave:0.018,ph:o.seed||0}),f,0,y,0);
          if(o.sleeve){ [-1,1].forEach(function(sd){ const s=mesh(G,tube(0.045,0.043,0.13),f,sd*0.16,y-0.04,0); s.rotation.z=sd*0.25; s.scale.z=0.4; }); } else [-1,1].forEach(function(sd){ mesh(G,new THREE.BoxGeometry(0.018,0.05,0.004),f,sd*0.1,y+0.018,0.004); }); },
        trousers:function(G,y,o){ const L=o.len||1.0, f=fabM(o.c), ht=0.02; mesh(G,new THREE.BoxGeometry(0.34,0.045,ht*2),f,0,y-0.02,0); [-1,1].forEach(function(sd){ mesh(G,slab(L-0.04,function(t){ return [0.085-0.015*t,ht]; },{drop:0,wave:0.006,ph:sd}),f,sd*0.088,y-0.04,0); }); },
        skirt:function(G,y,o){ const L=o.len||0.6, f=fabM(o.c); mesh(G,new THREE.BoxGeometry(0.34,0.035,0.03),f,0,y-0.015,0); mesh(G,slab(L-0.03,function(t){ return [0.16+0.09*t,0.014+0.01*t]; },{drop:0,wave:0.02,ph:o.seed||1}),f,0,y-0.03,0); }
      };
      const hang=function(kind,o){ o=o||{}; const G=new THREE.Group(); const clip=kind==='trousers'||kind==='skirt'; const y=hanger(G,clip,clip?0.36:(kind==='coat'||kind==='puffer')?0.44:0.4); K[kind](G,y-0.004,o);
        G.userData.thick=({shirt:0.05,knit:0.08,tee:0.035,coat:0.1,puffer:0.15,dress:0.05,trousers:0.045,skirt:0.04})[kind]; return G; };
      /* a soft folded stack: n pieces w x d, eased edges, a fold line on the front */
      const fold=function(w,d,cols,hEach){ const G=new THREE.Group(); let y=0; cols.forEach(function(c,i){ const h=hEach||0.035, s=new THREE.Shape(), r=Math.min(0.012,h/2-0.001), x0=-w/2, y0=0;
          s.moveTo(x0+r,y0); s.lineTo(-x0-r,y0); s.quadraticCurveTo(-x0,y0,-x0,y0+r); s.lineTo(-x0,y0+h-r); s.quadraticCurveTo(-x0,y0+h,-x0-r,y0+h); s.lineTo(x0+r,y0+h); s.quadraticCurveTo(x0,y0+h,x0,y0+h-r); s.lineTo(x0,y0+r); s.quadraticCurveTo(x0,y0,x0+r,y0);
          const g=new THREE.ExtrudeGeometry(s,{depth:d-0.01,bevelEnabled:true,bevelThickness:0.005,bevelSize:0.004,bevelSegments:2,curveSegments:4}); g.translate(0,0,-(d-0.01)/2); const m=mesh(G,g,fabM(c,i%3===1),((i*37)%5-2)*0.003,y,0); m.rotation.y=((i*13)%5-2)*0.01; y+=h; }); return G; };
      const lea=function(c){ return fabC['l'+c]||(fabC['l'+c]=env.lam(c,{roughness:0.5,envMapIntensity:0.6})); };
      const rr=function(w,h,r){ const s=new THREE.Shape(), x0=-w/2; r=Math.min(r,w/2-0.001,h/2-0.001); s.moveTo(x0+r,0); s.lineTo(-x0-r,0); s.quadraticCurveTo(-x0,0,-x0,r); s.lineTo(-x0,h-r); s.quadraticCurveTo(-x0,h,-x0-r,h); s.lineTo(x0+r,h); s.quadraticCurveTo(x0,h,x0,h-r); s.lineTo(x0,r); s.quadraticCurveTo(x0,0,x0+r,0); return s; };
      const ext=function(s,d,bv){ const g=new THREE.ExtrudeGeometry(s,{depth:d-2*(bv||0.004),bevelEnabled:true,bevelThickness:bv||0.004,bevelSize:bv||0.004,bevelSegments:2,curveSegments:6}); g.translate(0,0,-(d-2*(bv||0.004))/2); return g; };
      /* bags standing upright, front +z, base on y=0 */
      const bag=function(kind,c){ const G=new THREE.Group(), m=lea(c), dk=lea(0x3a2e26);
        if(kind==='tote'){ const s=new THREE.Shape([new THREE.Vector2(-0.15,0),new THREE.Vector2(0.15,0),new THREE.Vector2(0.17,0.26),new THREE.Vector2(-0.17,0.26)]); mesh(G,ext(s,0.12,0.006),m); [-1,1].forEach(function(sd){ const h=mesh(G,new THREE.TorusGeometry(0.06,0.006,6,16,Math.PI),m,0,0.26,sd*0.045); }); }
        else if(kind==='shoulder'){ mesh(G,ext(rr(0.24,0.16,0.04),0.08),m); const fl=mesh(G,ext(rr(0.24,0.1,0.03),0.012,0.003),m,0,0.07,0.042); fl.castShadow=false; mesh(G,new THREE.BoxGeometry(0.02,0.012,0.006),fabC.__gold||(fabC.__gold=env.lam(0xd4b06a,{metalness:0.9,roughness:0.3})),0,0.08,0.05);
          const st=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.11,0.15,0),new THREE.Vector3(-0.07,0.2,0.02),new THREE.Vector3(0.06,0.21,0.025),new THREE.Vector3(0.11,0.15,0)]),16,0.004,5,false),m); G.add(st); }
        else if(kind==='backpack'){ mesh(G,ext(rr(0.26,0.34,0.07),0.13),m); mesh(G,ext(rr(0.2,0.14,0.04),0.04),m,0,0.04,0.075); mesh(G,new THREE.BoxGeometry(0.2,0.004,0.004),dk,0,0.16,0.096);
          const hd=mesh(G,new THREE.TorusGeometry(0.03,0.006,6,12,Math.PI),dk,0,0.34,0); }
        else { mesh(G,ext(rr(0.26,0.13,0.015),0.035,0.008),m); mesh(G,new THREE.BoxGeometry(0.03,0.01,0.004),fabC.__gold||(fabC.__gold=env.lam(0xd4b06a,{metalness:0.9,roughness:0.3})),0,0.1,0.02); }
        return G; };
      return {hang:hang,fold:fold,bag:bag,fabric:fabM};
    })();
    Catalog.garment=function(kind,len,col){ const g=new THREE.Group(), f=env.fab(col,{side:THREE.DoubleSide}), st=M.steel;
      const hk=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.09,0.006),st); hk.position.y=0.055; g.add(hk); [-1,1].forEach(function(sd){ const a=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.006,0.006),st); a.position.set(sd*0.09,0.015,0); a.rotation.z=-sd*0.22; g.add(a); });
      if(kind===3){ const bar=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.006,0.006),st); bar.position.y=-0.03; g.add(bar); [-1,1].forEach(function(sd){ const l=new THREE.Mesh(new THREE.BoxGeometry(0.3,len/2,0.012),f); l.position.set(0,-0.03-len/4,sd*0.01); l.castShadow=true; g.add(l); }); return g; }
      const m=new THREE.Mesh(garmentGeo(kind,len,0.17),f); m.position.z=-0.015; m.castShadow=true; m.receiveShadow=true; g.add(m); return g; };
    Catalog.clothesRack=function(w,two,bare){      // w-wide hanging rail under a shelf; two = upper and lower rails (tops on both); bare = rails and clothes only (built-in closets)
      const P=new Piece(), rnd=env.rnd, n=Math.max(3,Math.round(w/0.09)), shY=two?2.0:1.9;
      const cm=[0x6d7f99,0xc9b8a0,0x3f4a58,0xd8d2c6,0x8a9a86,0xb26b5a,0xe7e4de].map(function(c){ return env.fab(c,{side:THREE.DoubleSide}); });
      const rail=function(rodY,h0,h1){
        const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,w,10),M.steel); rod.rotation.z=Math.PI/2; rod.position.set(0,rodY,0); P.add(rod,{cast:false});
        [-1,1].forEach(function(sd){ P.box(sd*w/2-0.01,sd*w/2+0.01,-0.03,0.03,rodY-0.03,rodY+0.03,M.steel,{cast:false}); });
        for(let i=0;i<n;i++){
          const t=(i+0.5)/n, hh=h0+rnd()*(h1-h0), g=new THREE.Group();
          g.position.set(-w/2+w*t,rodY-0.1,0); g.rotation.y=Math.PI/2;
          const m=new THREE.Mesh(garmentGeo(two?Math.floor(rnd()*2):Math.floor(rnd()*3),hh-0.1,0.17),cm[Math.floor(rnd()*cm.length)]); m.position.z=-0.015; m.castShadow=true; m.receiveShadow=true; g.add(m);
          const hk=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.09,0.006),M.steel); hk.position.y=0.055; g.add(hk);
          [-1,1].forEach(function(sd){ const a=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.006,0.006),M.steel); a.position.set(sd*0.09,0.015,0); a.rotation.z=-sd*0.22; g.add(a); });
          P.group.add(g);
        } };
      if(two){ rail(1.85,0.5,0.7); rail(0.95,0.45,0.62); } else rail(1.75,0.75,1.15);
      if(bare) return P;
      P.box(-w/2,w/2,-0.3,0.3,shY,shY+0.025,M.cabF);                                          // shelf above the rail
      [[-0.28,0.3,0x8a9a86],[0.18,0.34,0xc9b27f]].forEach(function(b){ if(Math.abs(b[0])+b[1]/2<w/2) P.rbox(b[0]-b[1]/2,b[0]+b[1]/2,-0.22,0.18,shY+0.025,shY+0.25,0.015,env.fab(b[2]),{cast:false}); });
      return P;
    };
    /* open steel shoe rack w x d x h, boards every 40 cm, random pairs of shoes on all but the top board; the open side is +z */
    /* closed shoe cabinet w x 0.38 x h with two doors that open on a button (shelves of shoes inside); front +z */
    Catalog.shoeCabinet=function(w,h){
      w=w||1.2; h=h||1.9;
      const P=new Piece(), d=0.38, lam=env.lam, body=M.cabF, door=M.cab, oc={cast:false};
      P.box(-w/2,w/2,-d/2,-d/2+0.02,0.08,h,body); P.box(-w/2,-w/2+0.02,-d/2,d/2,0.08,h,body); P.box(w/2-0.02,w/2,-d/2,d/2,0.08,h,body);
      P.box(-w/2,w/2,-d/2,d/2,h-0.02,h,body); P.box(-w/2,w/2,-d/2,d/2-0.02,0.08,0.1,body); P.box(-w/2+0.02,w/2-0.02,-d/2+0.02,d/2-0.03,0,0.08,M.dark,oc);
      const boards=[]; for(let y=0.1;y<h-0.3;y+=0.36) boards.push(y);
      boards.forEach(function(y,bi){ if(bi) P.box(-w/2+0.02,w/2-0.02,-d/2+0.02,d/2-0.04,y-0.018,y,body,oc);
        const slot=0.215, n=Math.floor((w-0.06)/slot);
        for(let k=0;k<n;k++){ if(env.rnd()<0.15) continue;                                     // the same shoe models as the open shelf, a few gaps
          const kind=['sneaker','sneaker','boot','loafer','pump','sneaker','sandal'][Math.floor(env.rnd()*7)];
          const c1=kind==='pump'?[0xd9b8a2,0x1c1c1e,0xa3262f][Math.floor(env.rnd()*3)]:kind==='boot'?[0x6b4a35,0x1c1c1e][Math.floor(env.rnd()*2)]:kind==='loafer'?[0x1c1c1e,0x5a3a28][Math.floor(env.rnd()*2)]:kind==='sandal'?0x7a5a3a:[0xf1efe9,0x2a2d31,0x8a9ab0][Math.floor(env.rnd()*3)];
          const c2=kind==='sneaker'?0xf1efe9:0x8a6a4a, x=-w/2+(w-n*slot)/2+slot*(k+0.5);
          [-1,1].forEach(function(sd){ const g=shoeObj(kind,c1,c2); g.scale.setScalar(Math.min(1,(d-0.06)/0.296)); g.position.set(x+sd*0.05,y+0.002,sd*0.012-0.01); g.rotation.y=Math.PI/2; g.traverse(function(q){ if(q.isMesh) q.userData.detail=true; }); P.group.add(g); });
        } });
      const doors=[]; [-1,1].forEach(function(sd){ const pv=new THREE.Group(); pv.position.set(sd*w/2,0,d/2); P.group.add(pv);
        const m=new THREE.Mesh(new THREE.BoxGeometry(w/2-0.0015,h-0.085,0.02),door); m.position.set(-sd*(w/4-0.00075),0.075+(h-0.085)/2,0.01); m.castShadow=true; pv.add(m);
        const hd=new THREE.Mesh(new THREE.BoxGeometry(0.016,0.3,0.02),M.steel); hd.position.set(-sd*(w/2-0.05),1.0,0.03); pv.add(hd); doors.push({pv:pv,sd:sd}); });
      const apply=function(e){ doors.forEach(function(q){ q.pv.rotation.y=q.sd*1.6*e; }); };
      const st=stepper(0.7,apply); st.v=0; apply(0);
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:0,z:0.6,label:function(){ return st.target?'關上鞋櫃':'打開鞋櫃'; },act:function(){ st.target=st.target?0:1; }}];
      P._col(-w/2,w/2,-d/2,d/2,true); return P;
    };
    /* self-cleaning litter box (globe on a base, about 60 x 66 x 75 cm) with the entry and a small status light on the front; front +x */
    /* PETKIT PURA MAX self-cleaning litter box, W 62 x D 55.2 x H 53.8 cm: rounded drum housing with the entry on the left, control and waste module on the right; front +x */
    Catalog.litterRobot=function(opt){   // opt.mat [u0,u1,x0,x1]: a bigger litter mat (u = -z), 12 mm thick
      const P=new Piece(), lam=env.lam, oc={cast:false}, wh=lam(0xf8f9fa,{roughness:0.18,envMapIntensity:1.2}), wh2=lam(0xe9e9e6,{roughness:0.38}), grey=lam(0xc9cbcd,{roughness:0.4}), ink=lam(0x2b2d31,{roughness:0.5});
      const X0=-0.276, X1=0.276, XF=0.262;   // u runs left to right as seen from the front (u = -z)
      const rr=function(u0,u1,y0,y1,r){ const s=new THREE.Shape(); s.moveTo(u0+r[0],y0); s.lineTo(u1-r[1],y0); s.absarc(u1-r[1],y0+r[1],r[1],-Math.PI/2,0); s.lineTo(u1,y1-r[2]); s.absarc(u1-r[2],y1-r[2],r[2],0,Math.PI/2);
        s.lineTo(u0+r[3],y1); s.absarc(u0+r[3],y1-r[3],r[3],Math.PI/2,Math.PI); s.lineTo(u0,y0+r[0]); s.absarc(u0+r[0],y0+r[0],r[0],Math.PI,Math.PI*1.5); return s; };   // corner radii [bottom-left, bottom-right, top-right, top-left]
      const slab=function(u0,u1,y0,y1,x0,x1,r,bv,mt){ const b=bv, g=new THREE.ExtrudeGeometry(rr(u0+b,u1-b,y0+b,y1-b,r.map(function(q){ return Math.max(0.002,q-b); })),{depth:x1-x0-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:5,curveSegments:24});
        g.rotateY(Math.PI/2); g.translate(x0+b,0,0); const m=new THREE.Mesh(g,mt); m.castShadow=m.receiveShadow=true; P.add(m); return m; };
      const flat=function(shape,x,mt,uvFit){ const g=new THREE.ShapeGeometry(shape,24); if(uvFit){ g.computeBoundingBox(); const bb=g.boundingBox, uv=g.attributes.uv, ps=g.attributes.position; for(let k=0;k<uv.count;k++) uv.setXY(k,(ps.getX(k)-bb.min.x)/(bb.max.x-bb.min.x),(ps.getY(k)-bb.min.y)/(bb.max.y-bb.min.y)); }
        g.rotateY(Math.PI/2); const m=new THREE.Mesh(g,mt); m.position.x=x; P.add(m,oc); return m; };
      [[-0.22,-0.27],[0.22,-0.27],[-0.22,0.27],[0.22,0.27]].forEach(function(q){ P.cyl(q[0],q[1],0.03,0.03,0,0.025,grey,oc,16); });   // feet
      slab(-0.31,0.31,0.025,0.16,X0,X1,[0.05,0.05,0.03,0.03],0.03,wh2);                                                                      // base
      slab(-0.31,0.095,0.12,0.538,X0+0.01,XF,[0.02,0.02,0.15,0.17],0.045,wh);                                                                 // drum housing
      slab(0.09,0.31,0.025,0.538,X0,X1-0.005,[0.05,0.05,0.13,0.03],0.035,wh);                                                                // control and waste module
      P.box(X1-0.004,X1-0.002,-0.29,-0.1,0.327,0.33,grey,oc);                                                                              // shell seam on the module
      /* entry: 20 x 22.5 cm, a grey surround, the dark drum inside with the green honeycomb mat */
      const eu=-0.11, ey=0.315, ew=0.252, eh=0.235, fr=rr(eu-ew/2-0.022,eu+ew/2+0.022,ey-eh/2-0.022,ey+eh/2+0.022,[0.06,0.06,0.07,0.07]); fr.holes.push(rr(eu-ew/2,eu+ew/2,ey-eh/2,ey+eh/2,[0.045,0.045,0.055,0.055]));
      const frm=new THREE.Mesh(new THREE.ExtrudeGeometry(fr,{depth:0.012,bevelEnabled:true,bevelThickness:0.004,bevelSize:0.004,bevelSegments:2,curveSegments:20}),lam(0xe2e4e6,{roughness:0.2,transparent:true,opacity:0.92}));
      frm.geometry.rotateY(Math.PI/2); frm.position.x=XF-0.006; P.add(frm,oc);
      const dc=document.createElement('canvas'); dc.width=dc.height=256; const dg=dc.getContext('2d'); const grd=dg.createLinearGradient(0,0,0,256); grd.addColorStop(0,'#55585c'); grd.addColorStop(0.62,'#2e3134'); dg.fillStyle=grd; dg.fillRect(0,0,256,256);
      dg.fillStyle='#24502f'; dg.fillRect(0,170,256,86); dg.strokeStyle='#3d7a4a'; dg.lineWidth=3;
      for(let r=0;r<4;r++) for(let c=-1;c<10;c++){ const cx=c*30+(r%2)*15, cy=182+r*22; dg.beginPath(); for(let k=0;k<6;k++){ const a=k*Math.PI/3; dg.lineTo(cx+Math.cos(a)*10,cy+Math.sin(a)*10); } dg.closePath(); dg.stroke(); }   // honeycomb mat
      const drumT=new THREE.CanvasTexture(dc); drumT.colorSpace=THREE.SRGBColorSpace; drumT.center.set(0.5,0.5);
      flat(rr(eu-ew/2,eu+ew/2,ey-eh/2,ey+eh/2,[0.045,0.045,0.055,0.055]),XF+0.002,new THREE.MeshBasicMaterial({map:drumT,color:0xd8d8d8}),true);
      const tc=document.createElement('canvas'); tc.width=512; tc.height=96; const tg=tc.getContext('2d'); tg.fillStyle='#d9dadc'; tg.font='bold 64px sans-serif'; tg.textAlign='center'; tg.textBaseline='middle';
      tg.save(); tg.translate(256,50); tg.scale(1.6,1); tg.fillText('PETKIT',0,0); tg.restore();
      const tt=new THREE.CanvasTexture(tc); tt.colorSpace=THREE.SRGBColorSpace; const logo=new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.028),new THREE.MeshBasicMaterial({map:tt,transparent:true})); logo.rotation.y=Math.PI/2; logo.position.set(XF+0.003,0.475,0.11); P.add(logo,oc);   // brand above the entry
      flat(rr(eu-0.03,eu+0.03,0.143,0.153,[0.005,0.005,0.005,0.005]),X1+0.001,ink);                                                       // sensor slot in the base
      /* control panel: two buttons and a small black display */
      const disp=flat(rr(0.155,0.19,0.345,0.38,[0.004,0.004,0.004,0.004]),X1-0.004,lam(0x111214,{roughness:0.2})), dispL=lam(0x111214,{emissive:0x3aa0ff,emissiveIntensity:0});
      flat(rr(0.162,0.183,0.355,0.37,[0.002,0.002,0.002,0.002]),X1-0.003,dispL);
      [0.37,0.348].forEach(function(y){ flat(rr(0.122,0.145,y-0.009,y+0.009,[0.006,0.006,0.006,0.006]),X1-0.004,lam(0xf7f7f5,{roughness:0.3})); flat(rr(0.128,0.139,y-0.003,y+0.003,[0.002,0.002,0.002,0.002]),X1-0.003,grey); });
      /* waste drawer behind the lower door: OPEN latch and a finger slot, slides out with its 7 L bin */
      const WD=new THREE.Group(); P.group.add(WD);
      const door=new THREE.Mesh(new THREE.ExtrudeGeometry(rr(0.105,0.3,0.04,0.31,[0.03,0.04,0.03,0.03]),{depth:0.006,bevelEnabled:false,curveSegments:16}),wh); door.geometry.rotateY(Math.PI/2); door.position.x=X1-0.006; WD.add(door);
      const og=rr(0.103,0.302,0.038,0.312,[0.031,0.041,0.031,0.031]); og.holes.push(rr(0.106,0.299,0.041,0.309,[0.029,0.039,0.029,0.029])); const ol=new THREE.Mesh(new THREE.ShapeGeometry(og,16),grey); ol.geometry.rotateY(Math.PI/2); ol.position.x=X1+0.0008; WD.add(ol);   // door outline
      const lat=new THREE.Mesh(new THREE.ShapeGeometry(rr(0.13,0.165,0.232,0.25,[0.009,0.009,0.009,0.009]),12),grey); lat.geometry.rotateY(Math.PI/2); lat.position.x=X1+0.001; WD.add(lat);
      const slotM=new THREE.Mesh(new THREE.ShapeGeometry(rr(0.2,0.235,0.1,0.24,[0.017,0.017,0.017,0.017]),12),lam(0xdedfdd,{roughness:0.5})); slotM.geometry.rotateY(Math.PI/2); slotM.position.x=X1+0.001; WD.add(slotM);
      const bin=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.22,0.17),lam(0x9a9ea3,{roughness:0.5})); bin.position.set(X1-0.16,0.16,-0.2); WD.add(bin);
      const sd=stepper(0.6,function(t){ WD.position.x=0.24*ease(t); });
      let clean=null, lastT=0;
      P.anims.push(function(t){ lastT=t; const a=sd.run(t); if(clean===null) return a; const k=(t-clean)/8;   // the drum turns once and comes back; the display lights while it runs
        if(k>=1){ clean=null; drumT.rotation=0; dispL.emissiveIntensity=0; return true; } drumT.rotation=Math.sin(Math.PI*k)*Math.PI*0.9; dispL.emissiveIntensity=1.2; return true; });
      P.actions=[{x:0.6,z:0.11,part:[],label:function(){ return clean===null?'PETKIT：開始自動清潔':'PETKIT：清潔中…'; },act:function(){ if(clean===null) clean=lastT; }},
        {x:0.6,z:-0.2,part:[WD],label:function(){ return sd.target?'推回集便盒':'拉出集便盒'; },act:function(){ sd.target=sd.target?0:1; }}];
      const BG=new THREE.Group(); P.group.children.slice().forEach(function(c){ BG.add(c); }); P.group.add(BG); BG.scale.set(0.538/0.552,0.603/0.538,0.657/0.62);   // Purobot Max Pro 2: W65.7 x D53.8 x H60.3 cm, 26.7 cm wide entrance
      const MT=opt&&opt.mat?0.012:0.008; BG.position.y+=MT;   // litter mat underneath, running out in front where the cat steps off
      const mc=document.createElement('canvas'); mc.width=mc.height=256; const mg=mc.getContext('2d'); mg.fillStyle='#8a8d91'; mg.fillRect(0,0,256,256); mg.fillStyle='#6b6e72';
      for(let r=0;r<10;r++) for(let c=0;c<10;c++){ const cx=c*26+(r%2)*13+6, cy=r*26+8; mg.beginPath(); for(let k=0;k<6;k++){ const an=k*Math.PI/3+Math.PI/6; mg.lineTo(cx+Math.cos(an)*9,cy+Math.sin(an)*9); } mg.closePath(); mg.fill(); }
      const mtT=new THREE.CanvasTexture(mc); mtT.wrapS=mtT.wrapT=THREE.RepeatWrapping; mtT.repeat.set(5,5); mtT.colorSpace=THREE.SRGBColorSpace;
      const mat=new THREE.Mesh(new THREE.ExtrudeGeometry((opt&&opt.mat?rr(opt.mat[0],opt.mat[1],opt.mat[2],opt.mat[3],[0.05,0.05,0.05,0.05]):rr(-0.335,0.335,-0.27,0.6,[0.04,0.04,0.04,0.04])),{depth:MT,bevelEnabled:false,curveSegments:10}),lam(0xffffff,{map:mtT,roughness:0.9}));
      mat.geometry.rotateX(Math.PI/2); mat.geometry.rotateY(Math.PI/2); mat.position.y=MT; mat.receiveShadow=true; P.add(mat,oc);
      P._col(-0.269,0.269,-0.3285,0.3285,true); return P;
    };
    /* open walk-in-closet shelf 0.9 x 0.35 x 1.8 m for hats and bags: hats on top, handbags and totes below, folded scarves at the bottom; front +z */
    Catalog.bagShelf=function(){
      const P=new Piece(), lam=env.lam, w=0.9, d=0.35, oc={cast:false}, wood=M.oak;
      P.box(-w/2,w/2,-d/2,-d/2+0.015,0,1.8,wood); [-1,1].forEach(function(sd){ P.box(sd*w/2-(sd>0?0.02:0),sd*w/2+(sd<0?0.02:0),-d/2,d/2,0,1.8,wood); });
      [0.02,0.45,0.9,1.35,1.78].forEach(function(y){ P.box(-w/2,w/2,-d/2,d/2,y,y+0.02,wood); });
      const hat=function(x,y,c){ const br=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.01,28),lam(c,{roughness:0.8})); br.position.set(x,y+0.005,0); P.add(br,oc);
        const cr=new THREE.Mesh(new THREE.SphereGeometry(0.09,20,12,0,Math.PI*2,0,Math.PI/2),lam(c,{roughness:0.8})); cr.scale.y=1.1; cr.position.set(x,y+0.01,0); P.add(cr,oc); };
      hat(-0.2,1.37,0xd9c7a3); hat(0.2,1.37,0x2f3a4a);
      const bag=function(x,y,w2,h2,c){ P.rbox(x-w2/2,x+w2/2,-0.08,0.08,y,y+h2,0.02,lam(c,{roughness:0.55}),oc);
        const hd=new THREE.Mesh(new THREE.TorusGeometry(w2*0.25,0.008,8,20,Math.PI),lam(c,{roughness:0.5})); hd.position.set(x,y+h2,0); P.add(hd,oc); };
      bag(-0.25,0.92,0.28,0.22,0x8a5a3c); bag(0.08,0.92,0.22,0.18,0xd8c3a5); bag(0.3,0.92,0.16,0.14,0x2a2a2a);
      bag(-0.18,0.47,0.4,0.3,0xe9e4da); bag(0.22,0.47,0.26,0.2,0x6f7f6a);
      [0x9a5a5a,0x5f6f82,0xd9cfc0].forEach(function(c,i){ P.box(-0.3+i*0.22,-0.12+i*0.22,-0.12,0.12,0.04,0.1,lam(c,{roughness:0.9}),oc); });   // folded scarves
      P._col(-w/2,w/2,-d/2,d/2,true); return P;
    };
    Catalog.shoeShelf=function(w,d,h){
      const P=new Piece(), rnd=env.rnd, boards=[];
      for(let y=0.05;y<h-0.1;y+=0.4) boards.push(y);
      boards.forEach(function(y){ P.box(-w/2+0.01,w/2-0.01,-d/2+0.01,d/2-0.01,y,y+0.025,M.cabF); });
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.cyl(c[0]*(w/2-0.012),c[1]*(d/2-0.012),0.01,0.01,0,h,M.steel,{cast:false},8); });
      const slot=0.215, n=Math.max(1,Math.floor((w-0.04)/slot));
      boards.forEach(function(y,bi){
        if(bi===boards.length-1) return;
        for(let k=0;k<n;k++){
          if(rnd()<0.2) continue;
          const kind=['sneaker','sneaker','sneaker','boot','loafer','pump','sandal'][Math.floor(rnd()*7)];
          const c1=kind==='pump'?[0xd9b8a2,0x1c1c1e,0xa3262f,0xe7c9d0][Math.floor(rnd()*4)]:kind==='sandal'?[0x1c1c1e,0x7a5a3a][Math.floor(rnd()*2)]:kind==='boot'?[0x6b4a35,0x1c1c1e][Math.floor(rnd()*2)]:kind==='loafer'?[0x1c1c1e,0x5a3a28,0x8a5a3a][Math.floor(rnd()*3)]:[0x2a2a2e,0x6b4a35,0xe8e6e0,0x1f2c44,0x8a8d90,0xa5714a][Math.floor(rnd()*6)];
          const c2=kind==='sneaker'?(rnd()<0.7?0xf1efe9:0x2a2a2e):0x8a6a4a, sc=Math.min(0.94+rnd()*0.1,(d-0.03)/0.296), x=-w/2+(w-n*slot)/2+slot*(k+0.5);
          [-1,1].forEach(function(sd){ const g=Catalog.shoe(kind,c1,c2); g.scale.setScalar(sc); g.position.set(x+sd*0.05,y+0.025,sd*0.012); g.rotation.y=Math.PI/2; g.traverse(function(q){ if(q.isMesh) q.userData.detail=true; }); P.group.add(g); });
        }
      });
      P._col(-w/2,w/2,-d/2,d/2,true);
      return P;
    };
    /* two folded towels on top of something yb metres high */
    Catalog.towels=function(yb){
      const P=new Piece();
      P.rb(0,-0.12,0.3,0.24,0.08,0.03,M.cushA,yb,false); P.rb(0,0.12,0.3,0.24,0.07,0.03,M.pillow,yb,false);
      return P;
    };
    /* 60 x 40 cm doormat */
    Catalog.doormat=function(w,d){                // entrance mat w x d (default 60 x 40 cm)
      w=w||0.6; d=d||0.4;
      const P=new Piece(), c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');   // woven cotton mat: oatmeal herringbone with a charcoal border
      g.fillStyle='#d9cfbe'; g.fillRect(0,0,256,256);
      for(let y=0;y<256;y+=8) for(let x=0;x<256;x+=16){ const k=((x/16+y/8)%2)?1:-1, v=200+env.rnd()*30|0; g.strokeStyle='rgb('+v+','+(v-8)+','+(v-22)+')'; g.lineWidth=3; g.beginPath(); g.moveTo(x+2,y+(k>0?6:2)); g.lineTo(x+14,y+(k>0?2:6)); g.stroke(); }
      const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(w/0.25,d/0.25); t.colorSpace=THREE.SRGBColorSpace;
      P.rbox(-w/2,w/2,-d/2,d/2,0,0.01,0.01,env.lam(0x3a3836,{roughness:0.95}),{cast:false});
      P.rbox(-w/2+0.05,w/2-0.05,-d/2+0.05,d/2-0.05,0.0,0.013,0.004,env.lam(0xffffff,{map:t,roughness:1}),{cast:false}); return P;
    };
    /* touch-free foaming soap dispenser on a counter yb metres high; the spout reaches toward -z, a status LED blinks */
    Catalog.soapDispenser=function(yb){
      const P=new Piece(), lam=env.lam, y0=yb, wh=lam(0xf5f6f7,{roughness:0.25,envMapIntensity:0.7}), oc={cast:false};
      P.cyl(0,0,0.046,0.048,y0,y0+0.012,lam(0x2a2d31,{roughness:0.4}),{},28);
      P.cyl(0,0,0.04,0.04,y0+0.012,y0+0.158,lam(0xe6f2f6,{transparent:true,opacity:0.88,roughness:0.12}),{},28);
      P.cyl(0,0,0.0392,0.0392,y0+0.03,y0+0.1,lam(0xd8eef4,{roughness:0.3}),oc,28);
      P.cyl(0,0,0.037,0.041,y0+0.158,y0+0.176,wh,{},28);
      P.rbox(-0.022,0.022,-0.098,0.012,y0+0.166,y0+0.194,0.012,wh);
      P.cyl(0,-0.082,0.0075,0.0065,y0+0.15,y0+0.168,lam(0xdfe3e6,{roughness:0.3}),oc,12);
      P.cyl(0,-0.058,0.0105,0.0105,y0+0.1635,y0+0.1665,lam(0x0a0f14,{roughness:0.08}),oc,16);
      const led=new THREE.Mesh(new THREE.SphereGeometry(0.0032,8,6),new THREE.MeshBasicMaterial({color:0x4de08a})); led.position.set(0,y0+0.188,-0.0975); P.group.add(led);
      P.anims.push(function(t){ led.material.color.setHex((Math.floor(t*0.8)%4===0)?0x1c4a30:0x4de08a); return false; });
      return P;
    };

    /* ---------- garden (planted, so built into the house): trees and shrubs. Origin = base of the trunk on the ground ---------- */

    /* ---------- pieces for the ideal house (living, bedroom, study, storage, outdoor). Front = +x unless noted ---------- */
    const legClear=0.11;                         // robot vacuums need about 10 cm under furniture
    /* L-shaped sofa 2.4 x 1.6 m (seat 40 cm, back 75 cm), chaise on the +z end; front +x */
    /* three-seat power recliner 2.1 x 0.95 m: every seat reclines (back tilts, footrest flips up) at the touch of a button; front +x */
    /* three-seat power recliner, 210 x 97 x 100 cm (maker's drawing): seat 45 high, 168 wide and 56 deep, arms 21 wide and 58.5 high, legs 8 cm.
       Reclined it runs 163 deep and 75 high; each seat carriage (cushion, back, footrest) glides 15 cm forward as its back reclines. The centre back folds down into a 37 x 34 cm oak tray with two cup holders. Front +x */
    Catalog.reclinerSofa=function(){
      const P=new Piece(), lam=env.lam, cloth=env.fab(0x8c8178), seam=env.fab(0x7d7268), dark=lam(0x2a2826,{roughness:0.5}), steelB=lam(0x1d1e20,{roughness:0.45,metalness:0.5}), oc={cast:false};   // soft woven greige fabric everywhere, piping in the same cloth
      const rrs=function(w,h,r){ const sh=new THREE.Shape(), q=Math.min(r,w/2-0.001,h/2-0.001); sh.moveTo(-w/2+q,-h/2); sh.lineTo(w/2-q,-h/2); sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+q); sh.lineTo(w/2,h/2-q); sh.quadraticCurveTo(w/2,h/2,w/2-q,h/2); sh.lineTo(-w/2+q,h/2); sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-q); sh.lineTo(-w/2,-h/2+q); sh.quadraticCurveTo(-w/2,-h/2,-w/2+q,-h/2); return sh; };
      const soft=function(w,h,d,r,seg){ const b=Math.min(r,d/2-0.001), g=new THREE.ExtrudeGeometry(rrs(w-1.8*b,h-1.8*b,r),{depth:Math.max(0.001,d-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b*0.9,bevelSegments:seg||5,curveSegments:8}); g.center(); return g; };
      const put=function(par,geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt||cloth); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; par.add(m); return m; };
      const sb=function(par,x0,x1,y0,y1,z0,z1,r,mt,seg){ return put(par,soft(x1-x0,y1-y0,z1-z0,r,seg),mt,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2); };
      const bulge=function(geo,amt,front){ const p=geo.attributes.position; geo.computeBoundingBox(); const B=geo.boundingBox, cy=(B.min.y+B.max.y)/2; for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i), u=(x-B.min.x)/(B.max.x-B.min.x), w=(z-B.min.z)/(B.max.z-B.min.z); if(y>cy) p.setY(i,y+amt*Math.sin(Math.PI*u)*Math.sin(Math.PI*w)*((y-cy)/(B.max.y-cy))); if(front&&u>0.8&&y>cy) p.setY(i,p.getY(i)-front*Math.pow((u-0.8)/0.2,2)); } geo.computeVertexNormals(); return geo; };   // a softly domed top, rolled down at the front edge (waterfall)
      const bar=function(par,mt){ const m=new THREE.Mesh(new THREE.BoxGeometry(1,0.018,0.012),mt||steelB); m.castShadow=true; par.add(m); return m; }, V2=new THREE.Vector2();
      const setBar=function(m,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1]; m.position.x=(a[0]+b[0])/2; m.position.y=(a[1]+b[1])/2; m.scale.x=Math.max(0.001,Math.hypot(dx,dy)); m.rotation.z=Math.atan2(dy,dx); };
      /* legs, plinth, rolled arms 16 wide and 58.5 high, the fixed back frame */
      [[-0.4,-0.97],[0.4,-0.97],[-0.4,0.97],[0.4,0.97],[-0.4,0],[0.32,0]].forEach(function(c){ P.cyl(c[0],c[1],0.022,0.018,0,0.11,dark,oc,12); });
      sb(P.group,-0.47,0.3,0.11,0.34,-0.84,0.84,0.04);   // plinth; the footrest mechanism lives in front of it
      sb(P.group,-0.485,-0.34,0.11,0.42,-0.86,0.86,0.06);   // back frame the reclining backs lean on, low enough for them to tip over it
      [-1,1].forEach(function(sd){ const z0=sd>0?0.89:-1.05, z1=sd>0?1.05:-0.89, prof=new THREE.Shape(); prof.moveTo(-0.45,0.145); prof.lineTo(0.435,0.145); prof.lineTo(0.435,0.47); prof.quadraticCurveTo(0.44,0.55,0.36,0.55); prof.lineTo(-0.39,0.55); prof.quadraticCurveTo(-0.45,0.55,-0.45,0.5); prof.closePath();
        const g=new THREE.ExtrudeGeometry(prof,{depth:0.16-0.09,bevelEnabled:true,bevelThickness:0.045,bevelSize:0.035,bevelSegments:6,curveSegments:10}); put(P.group,g,cloth,0,0,z0+0.045);   // a rolled arm, soft on every edge
        const pi=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.47,0.12,0),new THREE.Vector3(0.48,0.5,0),new THREE.Vector3(0.43,0.585,0),new THREE.Vector3(0.39,0.6,0)]),20,0.006,6,false),seam); pi.position.z=sd>0?z1-0.004:z0+0.004; pi.castShadow=true; P.group.add(pi);   // piping round the arm front
        const pz=sd*1.052, pm=lam(0xb9bdc2,{metalness:0.6,roughness:0.35}), kn=lam(0xdfe2e5,{metalness:0.8,roughness:0.25});   // switch plate on the outer face: two recline buttons and a USB port
        P.rbox(-0.12,0.0,pz-0.003,pz+0.003,0.415,0.455,0.006,pm,oc); [-0.1,-0.02].forEach(function(x){ const k=P.cyl(x,0,0.01,0.01,0,0.006,kn,oc,18); k.rotation.x=Math.PI/2; k.position.set(x,0.435,pz+sd*0.004); });
        P.box(-0.068,-0.052,pz-0.004,pz+0.004,0.43,0.441,lam(0x1a1a1a),oc); });
      /* three seats 58 / 52 / 58: domed cushions with a waterfall front and piping, tufted reclining backs, a two-leaf footrest on a scissor linkage */
      const parts=[], SZ=[[-0.84,-0.263],[-0.26,0.26],[0.263,0.84]];
      const SL=0.15, TL=0.06, ML=0.125, A1=0.2, DB=0.695, DUR=4.2, PV=[0.41,0.39];   // carriage slide 15 cm, tilt, main leaf, footrest and back angles, seconds per full recline
      SZ.forEach(function(q,si){ const z0=q[0]+0.003, z1=q[1]-0.003, zc=(z0+z1)/2, w=z1-z0, mid=si===1;
        const sg=new THREE.Group(); P.group.add(sg);   // seat carriage: cushion, back and footrest all ride on it
        const cg=bulge(soft(0.6,0.12,w,0.05),0.016,0.03); put(sg,cg,cloth,0.11,0.39,zc);   // seat cushion, top at about 45
        const pp=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.405,0.425,z0+0.02),new THREE.Vector3(0.41,0.43,zc),new THREE.Vector3(0.405,0.425,z1-0.02)]),16,0.005,6,false),seam); pp.castShadow=true; sg.add(pp);   // piping on the seat's front edge
        const bk=new THREE.Group(); bk.position.set(-0.17,0.435,zc); P.group.add(bk);
        sb(bk,-0.16,-0.04,-0.08,0.5,-w/2+0.012,w/2-0.012,0.05);   // slim back shell, clear of the seat cushion
        sb(bk,-0.06,0.07,0.04,0.31,-w/2+0.012,w/2-0.012,0.06,cloth,6); put(bk,new THREE.BoxGeometry(0.006,0.009,w-0.09),seam,0.068,0.31,0).castShadow=false;   // lumbar pad: a soft panel with one seam above it
        const hd=new THREE.Group(); hd.position.set(0,0.3,0); bk.add(hd); sb(hd,-0.07,0.055,0.0,0.265,-w/2+0.03,w/2-0.03,0.06,cloth,6);   // headrest pad: its own soft panel that tips forward as the back goes down
        const ft=new THREE.Group(); ft.position.z=zc; P.group.add(ft); const L1=new THREE.Group(), L2=new THREE.Group(); ft.add(L1); ft.add(L2);
        sb(L1,0,ML+0.008,-0.075,0,-w/2+0.006,w/2-0.006,0.03);   // main leaf: the seat-front panel when stowed
        const nose=put(L1,new THREE.CylinderGeometry(0.044,0.044,w-0.03,20),cloth,-0.035,-0.037,0); nose.rotation.x=Math.PI/2;   // padded bridge tucked under the seat's front edge, so seat and footrest read as one surface
        sb(L2,-0.02,0.4195,-0.037,0.037,-w/2+0.006,w/2-0.006,0.03); const roll=put(L2,new THREE.CylinderGeometry(0.036,0.036,w-0.02,20),cloth,0.4195,0,0); roll.rotation.x=Math.PI/2;   // end leaf 45.5 cm with its roll; stowed flat under the seat, it slides out beneath the main leaf
        const sk2=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.012,w-0.05),seam); sk2.position.set(0.19,-0.043,0); sk2.castShadow=true; L2.add(sk2);
        const hj=put(L2,new THREE.CylinderGeometry(0.036,0.036,w-0.02,20),cloth,0,0,0); hj.rotation.x=Math.PI/2; hj.scale.set(1,1,0.8);   // the shared soft hinge strip between the two leaves
        const sk=new THREE.Mesh(new THREE.BoxGeometry(1,0.012,w-0.05),seam); sk.castShadow=true; ft.add(sk);   // the fabric bellows under the footrest, from the seat front to the leaf
        const lk=[]; [-1,1].forEach(function(sd){ const zz=sd*(w/2-0.016); for(let k=0;k<3;k++){ const m=bar(ft); m.position.z=zz+(k-1)*0.004; lk.push(m); } });
        let tray=null; if(mid){ tray=new THREE.Group(); tray.position.set(-0.205,0.25,0); bk.add(tray); tray.visible=false;   // oak tray on the centre back's rear face: on top once the back is folded down
          const oak=lam(0xd9bf96,{roughness:0.45,map:M.oak.map||null}), add=function(geo,mt,x,y,zz,rz){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,zz); if(rz) m.rotation.z=rz; m.castShadow=m.receiveShadow=true; tray.add(m); return m; };
          add(new THREE.BoxGeometry(0.03,0.34,0.37),oak,0,0,0);
          [-0.0825,0.0825].forEach(function(zz){ add(new THREE.CylinderGeometry(0.052,0.052,0.004,26),lam(0x2a2b2e,{roughness:0.5}),-0.007,0.07,zz,Math.PI/2); add(new THREE.CylinderGeometry(0.0425,0.0425,0.005,24),lam(0x0e0f10),-0.0075,0.07,zz,Math.PI/2); });   // 8.5 cm cup holders
          const mug=new THREE.Group(); mug.position.set(-0.045,0.07,0.0825); mug.rotation.z=Math.PI/2; tray.add(mug);
          const mm=lam(0xf6f3ec,{roughness:0.3}); const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.036,0.085,20,1,true),mm); mug.add(cup); const bt=new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.036,0.004,20),mm); bt.position.y=-0.04; mug.add(bt);
          const hd=new THREE.Mesh(new THREE.TorusGeometry(0.022,0.006,6,14,Math.PI),mm); hd.position.set(0,0,0.04); hd.rotation.y=Math.PI/2; hd.rotation.z=-Math.PI/2; mug.add(hd); }
        parts.push({sg:sg,bk:bk,hd:hd,sk:sk,roll:roll,hj:hj,ft:ft,L1:L1,L2:L2,lk:lk,tray:tray,mid:mid,e:0,st:null}); });
      const cl=function(x){ return Math.min(1,Math.max(0,x)); }, tz=function(x,r){ x=cl(x); const v=1/(1-r); return x<r?0.5*v*x*x/r:x>1-r?1-0.5*v*(1-x)*(1-x)/r:v*(x-r/2); }, seg=function(q,a,b){ return tz((q-a)/(b-a),0.25); };   // motor speed profile: soft start and stop, even in between
      let t0=0;
      const pose=function(){ parts.forEach(function(p){ const e=p.mid?p.e*(1-t0):p.e, q=tz(e,0.12), f=seg(q,0,0.55), g=seg(q,0.38,1), fr=seg(q,0.02,0.55);   // one motor: the footrest leads, the back follows and overlaps it; reversing runs the same path backwards
          const s=SL*(0.25*f+0.75*g), ph=TL*g, dr=0.035*g, c=Math.cos(ph), sn=Math.sin(ph), X=function(x,y){ return [PV[0]+s+(x-PV[0])*c-(y-PV[1])*sn,PV[1]+(x-PV[0])*sn+(y-PV[1])*c]; };   // wall-hugger: the carriage glides forward 15 cm and tips its front up as the back reclines
          const o=X(0,0); p.sg.position.set(o[0],o[1],0); p.sg.rotation.z=ph;
          const B=X(-0.17,0.435); p.bk.position.x=B[0]; p.bk.position.y=B[1]-dr; p.bk.rotation.z=0.12+DB*g+ph; p.hd.position.y=0.3-0.03*g; p.hd.rotation.z=-0.16*g;
          if(p.mid){ p.bk.rotation.z-=1.62*t0; p.bk.position.y+=0.11*t0; p.tray.visible=t0>0.02; }
          const H=X(0.43-0.005*f+0.02*Math.sin(Math.PI*f),0.335+0.09*f), a=-Math.PI/2+(Math.PI/2+A1)*f+ph;   // hinge pushed out and up; main leaf from hanging to just above level
          p.L1.position.set(H[0],H[1],0); p.L1.rotation.z=a;
          const ca=Math.cos(a), sa=Math.sin(a), ux=-sa, uy=ca, LP=function(s,o){ return [H[0]+s*ca-o*ux,H[1]+s*sa-o*uy]; };   // a point s along the leaf, o under it
          const Qs=X(-0.02,0.155), Qf=LP(ML,0.037), kx=tz(fr,0.3), ky=fr*fr*(3-2*fr); p.L2.position.set(Qs[0]+(Qf[0]-Qs[0])*kx,Qs[1]+(Qf[1]-Qs[1])*ky,0); p.L2.rotation.z=a*ky;
          const A1p=X(0.33,0.13), A2p=X(0.27,0.3), M1=LP(0.11,0.07), M2=LP(0.03,0.07);
          p.lk.forEach(function(m,k){ const j=k%3; if(j===0) setBar(m,A1p,M1); else if(j===1) setBar(m,A2p,M2); else setBar(m,M1,LP(ML,0.04)); });   // scissor arms under each side of the footrest
          p.lk.forEach(function(m){ m.visible=f>0.04; });
          const S0=X(0.40,0.34), S1=LP(0.12,0.075); setBar(p.sk,S0,S1); p.sk.visible=f>0.04; }); };
      parts.forEach(function(p){ p.st=stepper(DUR,function(e){ p.e=e; pose(); }); p.st.v=0; P.anims.push(function(t){ return p.st.run(t); }); });
      const tst=stepper(1.0,function(t){ t0=ease(t); pose(); }); P.anims.push(function(t){ return tst.run(t); }); pose();
      const all=function(){ return parts.every(function(p){ return p.st.target; }); };
      P.actions=[{x:0.75,z:-0.5,part:parts.reduce(function(a,p){ return a.concat([p.L1]); },[]),label:function(){ return all()?'沙發收回（全部）':'沙發電動躺平（全部）'; },act:function(){ const v=all()?0:1; parts.forEach(function(p){ p.st.target=v; }); }},
        {x:0.75,z:-0.56,label:function(){ return parts[0].st.target?'左座收回':'左座躺平'; },act:function(){ parts[0].st.target=parts[0].st.target?0:1; }},
        {x:0.75,z:0.56,label:function(){ return parts[2].st.target?'右座收回':'右座躺平'; },act:function(){ parts[2].st.target=parts[2].st.target?0:1; }},
        {x:0.75,z:0.15,part:[parts[1].bk],label:function(){ return tst.target?'中間靠背立起':'中間靠背放下當桌子'; },act:function(){ tst.target=tst.target?0:1; }}];
      P.recline={get on(){ return all(); },set on(v){ parts.forEach(function(p){ p.st.target=v?1:0; }); }}; P.seats=parts;
      P._col(-0.485,0.485,-1.05,1.05,true); return P;
    };
    Catalog.lSofa=function(){
      const P=new Piece(), D=0.85, L=2.4, C=1.6, fr=M.sofaD, cu=M.sofa;
      P.rb(0,0,D,L,0.2,0.05,fr,legClear,false); P.rb(C/2-D/2+D/2-0.0,L/2-0.45,C-D,0.9,0.2,0.05,fr,legClear,false);
      P.rb(-D/2+0.1,0,0.2,L,0.45,0.05,fr,legClear,false);                                         // back along -x
      P.rb(0.1,-L/2+0.1,D-0.2,0.2,0.32,0.05,fr,legClear,false);                                   // arm at -z
      [-0.75,-0.05].forEach(function(z){ P.rb(0.07,z,0.66,0.68,0.12,0.05,cu,legClear+0.2,false); const b=P.rb(-0.24,z,0.2,0.66,0.38,0.08,cu,legClear+0.22,false); b.rotation.z=0.12; });
      P.rb(0.42,L/2-0.45,1.42,0.86,0.12,0.05,cu,legClear+0.2,false);                               // chaise cushion
      const b2=P.rb(-0.24,L/2-0.45,0.2,0.66,0.38,0.08,cu,legClear+0.22,false); b2.rotation.z=0.12;
      [[-0.3,-0.8,M.cushA],[-0.28,0.25,M.cushB]].forEach(function(c){ P.rb(c[0]+0.05,c[1],0.15,0.4,0.36,0.07,c[2],legClear+0.32,false).rotation.z=0.2; });
      [[-D/2+0.05,-L/2+0.05],[D/2-0.05,-L/2+0.05],[-D/2+0.05,L/2-0.05],[C-D/2-0.05,L/2-0.05],[C-D/2-0.05,L/2-0.85]].forEach(function(q){ P.cyl(q[0],q[1],0.02,0.015,0,legClear,M.oakD,{cast:false},8); });
      P._col(-D/2,D/2,-L/2,L/2,true); P._col(D/2,C-D/2,L/2-0.9,L/2,true);
      return P;
    };
    /* SL-track massage chair modelled on the GrnArt 4D chair: W 73 x L 145 x H 106 cm at rest. Two thick white wing shells sweep from the
       black plinth up past the head and down into the armrests; beige leather back, head pillow and shoulder bolsters sit between them;
       the leg rest is two leather channels in a white trough ending in a foot boat with a rose-gold band; front +x */
    /* HUEI YEH HY-5018 'first class' massage chair: upright 146 x 74.5 x 114.5, reclined 169 x 74.5 x 101.5 cm. Front +x.
       Two flat white side panels (straight top edge falling from the head to the arm, near-vertical front, small corner radii) with a thin rose-gold strip,
       a white back cover, a dark sled base behind; taupe upholstery inside (flat back panel, square head pad, shoulder wings, flat arm strips, seat);
       the taupe calf rest and white foot box sit in front of the panels. Reclining tips the body back and swings the leg rest up. */
    Catalog.massageChair=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, HW=0.3725, T=0.065;
      const shell=lam(0xeeebe5,{roughness:0.3,metalness:0.02,envMapIntensity:1.1}), lea=function(c){ return lam(c,{roughness:0.55,envMapIntensity:0.75}); }, fab=lea(0x7e6f5f), fabD=lea(0x65584b), fabL=lea(0x988a78);   // PU leather sheen
      const rose=lam(0xd6a37e,{metalness:0.75,roughness:0.3,envMapIntensity:1.1}), base=lam(0x4a4c50,{roughness:0.5}), dark=lam(0x2a2b2e,{roughness:0.5});
      const R=function(w,h,d,rr){ const r=Math.min(rr||0.04,Math.min(w,h,d)*0.45), sh=new THREE.Shape(), q=Math.min(r,Math.min(w,h)/2-0.001);
        sh.moveTo(-w/2+q,-h/2); sh.lineTo(w/2-q,-h/2); sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+q); sh.lineTo(w/2,h/2-q); sh.quadraticCurveTo(w/2,h/2,w/2-q,h/2); sh.lineTo(-w/2+q,h/2); sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-q); sh.lineTo(-w/2,-h/2+q); sh.quadraticCurveTo(-w/2,-h/2,-w/2+q,-h/2);
        const g=new THREE.ExtrudeGeometry(sh,{depth:Math.max(0.001,d-2*r*0.8),bevelEnabled:true,bevelThickness:r*0.8,bevelSize:r*0.5,bevelSegments:4,curveSegments:8}); g.center(); g.scale(w/(w+r),h/(h+r),1); return g; };
      const mesh=function(par,geo,mt,x,y,z,rz){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); if(rz) m.rotation.z=rz; m.castShadow=m.receiveShadow=true; par.add(m); return m; };
      const rpoly=function(pts,r){ const sh=new THREE.Shape(), n=pts.length;   // polygon with every corner rounded by r (or its own third value)
        for(let k=0;k<n;k++){ const a=pts[(k+n-1)%n], b=pts[k], c=pts[(k+1)%n], rr=b[2]!==undefined?b[2]:r;
          const da=Math.hypot(a[0]-b[0],a[1]-b[1]), dc=Math.hypot(c[0]-b[0],c[1]-b[1]), ra=Math.min(rr,da/2), rc=Math.min(rr,dc/2);
          const p0=[b[0]+(a[0]-b[0])*ra/da,b[1]+(a[1]-b[1])*ra/da], p1=[b[0]+(c[0]-b[0])*rc/dc,b[1]+(c[1]-b[1])*rc/dc];
          if(k) sh.lineTo(p0[0],p0[1]); else sh.moveTo(p0[0],p0[1]); sh.quadraticCurveTo(b[0],b[1],p1[0],p1[1]); } sh.closePath(); return sh; };
      const ext=function(sh,d,bv){ return new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:!!bv,bevelThickness:bv||0,bevelSize:bv||0,bevelSegments:2,curveSegments:10}); };
      /* dark sled base behind, rising toward the rear */
      const sled=rpoly([[-0.765,0],[-0.12,0],[-0.18,0.05],[-0.68,0.13]],0.03); mesh(P.group,ext(sled,0.48,0.01),fabL,0,0.01,-0.24);
      const BODY=new THREE.Group(), PV=[-0.32,0.14]; BODY.position.set(PV[0],PV[1],0); P.group.add(BODY);
      const O=function(x,y){ return [x-PV[0],y-PV[1]]; }, OP=function(pts){ return pts.map(function(q){ const o=O(q[0],q[1]); return q.length>2?[o[0],o[1],q[2]]:o; }); };
      /* side panels */
      const side=rpoly(OP([[0.3,0.13,0.07],[0.335,0.4,0.3],[0.31,0.64,0.07],[-0.12,0.95,0.5],[-0.52,1.152,0.1],[-0.66,1.097,0.12],[-0.64,0.7,0.4],[-0.62,0.3,0.14],[-0.42,0.13,0.12]]),0.06);
      const sg=ext(side,T-0.012,0.006);
      [-1,1].forEach(function(sd){ mesh(BODY,sg,shell,0,0,sd>0?HW-T+0.006:-HW+0.006);
        const a=O(-0.12,0.27), b=O(0.31,0.36), st=new THREE.Shape([new THREE.Vector2(a[0],a[1]),new THREE.Vector2(b[0],b[1]),new THREE.Vector2(b[0],b[1]+0.014),new THREE.Vector2(a[0],a[1]+0.014)]);   // thin rose-gold strip on the outer face
        const sm=new THREE.Mesh(new THREE.ShapeGeometry(st),rose); sm.position.z=sd*(HW+0.002); if(sd<0){ sm.rotation.y=Math.PI; sm.scale.x=-1; } BODY.add(sm);
        const g=O(-0.46,0.98); mesh(BODY,new THREE.BoxGeometry(0.05,0.12,0.012),rose,g[0],g[1],sd*(HW-T-0.006)).rotation.z=-0.55; });   // small rose-gold trim by the head
      const back=rpoly(OP([[-0.52,1.135,0.08],[-0.645,1.085,0.1],[-0.605,0.3,0.12],[-0.42,0.145,0.1],[-0.3,0.145],[-0.33,0.42],[-0.5,1.09]]),0.05);   // back cover, set in from the panel edges
      mesh(BODY,ext(back,2*(HW-T)),shell,0,0,-(HW-T));
      const box=rpoly(OP([[-0.42,0.13],[0.28,0.13],[0.28,0.4],[-0.33,0.4]]),0.03); mesh(BODY,ext(box,2*(HW-T)),shell,0,0,-(HW-T));   // seat box
      const lin=ext(rpoly(OP([[0.28,0.42],[0.29,0.6],[-0.12,0.88],[-0.5,1.09],[-0.59,1.04],[-0.58,0.42]]),0.06),0.015);   // upholstered inner walls over the arm and shoulder airbags
      [-1,1].forEach(function(sd){ mesh(BODY,lin,fab,0,0,sd>0?HW-T-0.015:-(HW-T)); });
      const S0=O(-0.02,0.445); mesh(BODY,R(0.6,0.09,2*(HW-T)-0.03,0.04),fab,S0[0],S0[1],0);                              // seat
      const S1=O(0.27,0.43); mesh(BODY,R(0.07,0.11,2*(HW-T)-0.04,0.04),fabD,S1[0],S1[1],0);                               // rolled front edge
      [-1,1].forEach(function(sd){ const A=O(0.0,0.6), z=sd*(HW-T-0.05); mesh(BODY,R(0.58,0.05,0.1,0.02),fabL,A[0],A[1],z); mesh(BODY,R(0.52,0.12,0.09,0.03),fab,A[0],A[1]-0.085,z); });   // flat arm strips over the arm airbags
      const C=O(0.24,0.628); mesh(BODY,new THREE.BoxGeometry(0.1,0.006,0.05),lam(0xf2f2f0,{roughness:0.4}),C[0],C[1],HW-T-0.05).castShadow=false;   // control pad on the right arm
      const RH=O(0.12,0.5); mesh(BODY,R(0.075,0.11,0.025,0.01),lam(0xd9d4cb,{roughness:0.35}),RH[0],RH[1],HW+0.011);                            // remote in its holder on the right panel
      mesh(BODY,R(0.05,0.15,0.016,0.007),shell,RH[0],RH[1]+0.035,HW+0.012); mesh(BODY,new THREE.BoxGeometry(0.032,0.04,0.002),dark,RH[0],RH[1]+0.075,HW+0.021).castShadow=false;
      const BK=new THREE.Group(), BP=O(-0.31,0.45); BK.position.set(BP[0],BP[1],0); BODY.add(BK);                       // backrest panel on its own pivot
      mesh(BK,R(0.06,0.64,2*(HW-T)-0.05,0.03),fabD,-0.02,0.32,0);
      [0.03,0.045,0.03,0.015].forEach(function(dx,k){ mesh(BK,R(0.09,0.12,0.44,0.045),fab,dx,0.065+k*0.125,0); });   // padded sections, fullest at the lumbar
      [-1,1].forEach(function(sd){ mesh(BK,R(0.1,0.42,0.07,0.035),fabD,0.035,0.24,sd*0.245); mesh(BK,R(0.13,0.16,0.07,0.035),fab,0.055,0.48,sd*0.245); });   // side bolsters and shoulder wings
      mesh(BK,R(0.09,0.15,0.34,0.045),fabL,0.05,0.575,0);                                                                 // head pillow
      /* leg rest in front of the panels: taupe calf channels on a white shell, then the white foot box on its dark sole strip; built lying flat along +x */
      const LG=new THREE.Group(), LP=O(0.33,0.446); LG.position.set(LP[0],LP[1],0); BODY.add(LG);
      mesh(LG,R(0.34,0.18,0.62,0.04),shell,0.17,-0.08,0);
      [-1,1].forEach(function(sd){ mesh(LG,R(0.32,0.1,0.2,0.04),fabD,0.17,0.0,sd*0.15); [-1,1].forEach(function(e){ mesh(LG,R(0.32,0.12,0.03,0.015),fab,0.17,0.02,sd*0.15+e*0.1); }); });
      mesh(LG,R(0.32,0.11,0.05,0.025),fab,0.17,0.02,0);
      const FB=new THREE.Group(); FB.position.set(0.34,-0.04,0); LG.add(FB);
      const SL=mesh(LG,R(0.16,0.15,0.58,0.03),shell,0.26,-0.08,0);   // telescoping slide, hidden in the calf shell when retracted
      mesh(FB,R(0.32,0.18,0.62,0.04),shell,0.14,0.0,0); mesh(FB,R(0.33,0.035,0.63,0.015),lam(0xc9c5bd,{roughness:0.5}),0.14,-0.08,0);
      [-1,1].forEach(function(sd){ const pk=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.004,0.17),fabD); pk.position.set(0.12,0.0905,sd*0.15); FB.add(pk); mesh(FB,R(0.06,0.1,0.17,0.02),fab,0.0,0.13,sd*0.15); });   // foot openings with a taupe heel pad
      const apply=function(e){ const tb=0.35*e, la=-1.3+1.2*e, f=Math.min(1,e*1.6);   // foot box turns up early so it never swings out past the reclined length
        BODY.rotation.z=tb; BODY.position.set(PV[0]+0.06*e,PV[1],0); BK.rotation.z=0.26+0.12*e; LG.rotation.z=la;
        FB.position.x=0.34+0.095*e; SL.position.x=0.26+0.095*e; FB.rotation.z=(1-f)*(-la-tb)+f*1.25; };
      const st=stepper(1.8,apply); st.v=0; apply(0); P.pose=apply;
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:1.1,z:0,label:function(){ return st.target?'按摩椅直立':'按摩椅躺平'; },act:function(){ st.target=st.target?0:1; }}];
      P._col(-0.77,0.69,-HW,HW,true);   // upright footprint: the walkway behind it closes only while it reclines
      return P;
    };
    /* three-tier white spice rack (W 70 x D 20 x H 62 cm) with jars; front +x */
    Catalog.spiceRack=function(){
      const P=new Piece(), lam=env.lam, wht=lam(0xf4f4f2,{roughness:0.4}), L=0.35, cols=[0x8a4b2a,0xc9a14a,0x6b7d3a,0xb5452f,0xe8e2d0,0x4a3a2a,0xd98a2b];
      [[-0.1,-L],[-0.1,L-0.02],[0.08,-L],[0.08,L-0.02]].forEach(function(q){ P.box(q[0],q[0]+0.02,q[1],q[1]+0.02,0,0.62,wht); });
      [0.02,0.22,0.42,0.6].forEach(function(h,k){ P.box(-0.1,0.1,-L,L,h,h+0.015,wht); if(k===3) return;
        const n=k?7:5, r=k?0.024:0.034, hh=k?0.1:0.16;
        for(let i=0;i<n;i++){ const z=-L+0.05+i*(2*L-0.1)/(n-1);
          P.cyl(0,z,r,r,h+0.015,h+0.015+hh,lam(cols[(i+k*2)%cols.length],{roughness:0.5}),{},14); P.cyl(0,z,r*1.04,r*1.04,h+0.015+hh,h+0.035+hh,M.steel,{cast:false},14); } });
      P._col(-0.1,0.1,-L,L,false); return P;
    };
    /* electric standing desk 1.4 x 0.7 m at sitting height, monitor, laptop and a power strip; front (where you sit) +z */
    Catalog.liftDesk=function(w){
      w=w||1.4;
      const P=new Piece(), lam=env.lam, frame=lam(0x2a2d31,{roughness:0.4}), top=M.oak;
      P.rb(0,0,w,0.7,0.025,0.01,top,0.72,true);
      [-1,1].forEach(function(sd){ P.box(sd*(w/2-0.12)-0.04,sd*(w/2-0.12)+0.04,-0.05,0.05,0.05,0.72,frame); P.box(sd*(w/2-0.12)-0.03,sd*(w/2-0.12)+0.03,-0.33,0.33,0,0.04,frame); });
      P.box(-w/2+0.12,w/2-0.12,-0.04,0.04,0.66,0.7,frame);
      P.box(-w/2+0.1,-w/2+0.2,0.33,0.36,0.69,0.71,lam(0x1b1d20),{cast:false}); P.box(-w/2+0.12,-w/2+0.18,0.355,0.358,0.695,0.705,lam(0x9fd6ff,{emissive:0x4aa8e8}),{cast:false});   // up/down keypad
      const n=w>1.6?2:1;
      for(let i=0;i<n;i++){ const x=n===1?0:(i?w/4:-w/4);
        P.fb(x,-0.22,0.04,0.04,0.14,M.black,0.745,false); P.fb(x,-0.22,0.24,0.16,0.012,M.black,0.745,false);
        P.fb(x,-0.25,0.6,0.03,0.36,M.black,0.84,false); P.fb(x,-0.234,0.58,0.004,0.34,lam(0x0c1118,{roughness:0.12,metalness:0.3}),0.85,false);
        P.fb(x,0.1,0.4,0.13,0.018,M.black,0.745,false); }
      P.box(w/2-0.4,w/2-0.12,-0.3,-0.25,0.745,0.775,lam(0xe8e8e4),{cast:false});                // power strip with switches
      for(let i=0;i<5;i++) P.box(w/2-0.38+i*0.05,w/2-0.35+i*0.05,-0.28,-0.27,0.775,0.778,lam(0xd8453c),{cast:false});
      return P;
    };
    Catalog.duoDesk=function(){ const P=Catalog.liftDesk(1.8); P.attach(Catalog.officeChair(),-0.45,0.55,0); P.attach(Catalog.officeChair(),0.45,0.55,0); return P; };
    /* housework counter 1.2 x 0.6 m, 85 cm high: drawers, laundry basket below, iron and folded laundry on top; front +x */
    Catalog.workCounter=function(){
      const P=new Piece(), lam=env.lam;
      P.rb(0,0,0.6,1.2,0.03,0.01,M.oak,0.82,true);
      [-1,1].forEach(function(sd){ P.box(-0.28,0.28,sd*0.58-0.02,sd*0.58+0.02,0,0.82,M.cabF); });
      P.box(-0.28,0.28,-0.56,0.0,0.4,0.82,M.cabF); P.cabDoors('z',-0.56,0.0,0.28,1,0.42,0.8,2,false);
      P.box(-0.28,0.28,-0.56,0.56,legClear,legClear+0.02,M.cabF);
      P.rbox(-0.18,0.18,0.08,0.5,legClear+0.02,legClear+0.3,0.03,lam(0xc9b48b,{roughness:1}));    // laundry basket
      P.rb(0.0,-0.25,0.3,0.25,0.06,0.02,M.bedA,0.85,false); P.rb(0.0,-0.25,0.28,0.24,0.05,0.02,M.cushB,0.91,false);
      const ir=P.rb(0.05,0.28,0.13,0.26,0.06,0.03,lam(0xe8eef2,{roughness:0.3}),0.85,false); ir.rotation.y=0.3;
      return P;
    };
    /* world map print 1.6 x 0.9 m in a thin oak frame; wall piece facing +x */
    let mapTex=null;
    /* pantry cupboard W 45 x D 45 x H 200 cm with one door that opens: rice, pasta, tins, cocoa and snacks on the shelves; front +x */
    Catalog.pantryCabinet=function(depth,width,robot){   // depth: 45 cm by default; robot: open bay under the door for a robot vacuum and its dock
      const P=new Piece(), lam=env.lam, body=M.cabF, inn=lam(0xf6f4ef,{roughness:0.6}), oc={cast:false}, W=width||0.45, D=depth||0.45, H=1.96, t=0.018, hz=W/2, x0=-D/2, x1=D/2;
      P.box(x0,x1-0.02,-hz,-hz+t,0,H,body); P.box(x0,x1-0.02,hz-t,hz,0,H,body); P.box(x0,x1,-hz,hz,H-0.03,H,M.oak); if(!robot) P.box(x0,x1-0.02,-hz,hz,0,0.08,body); P.box(x0,x0+t,-hz,hz,0,H,body);   // oak cap at the appliance cabinet's height
      const xf=x1-0.03;
      [0.45,0.82,1.2,1.58].forEach(function(y){ P.box(x0+t,xf,-hz+t,hz-t,y-0.015,y,inn,oc); });
      const cx=(x0+t+xf)/2, hw=Math.min(0.12,(xf-x0-t)/2-0.01), m=function(c,r){ return lam(c,{roughness:r||0.55}); };
      const box=function(z,zw,y,h,c,dx){ return P.rbox(cx-hw+0.01+(dx||0),cx+hw-0.01,z-zw/2,z+zw/2,y,y+h,0.008,m(c)); };
      const ry=robot?0.45:0.08, rx=robot?xf-0.01-hw:cx, jx=robot?x0+t+0.05:cx;   // over the robot bay the rice moves up to shelf 1, in front of the pasta jars
      P.rbox(rx-hw,rx+hw,-0.2,-0.01,ry,ry+0.35,0.03,m(0xece2c8,0.85)); P.box(rx+hw+0.001,rx+hw+0.003,-0.17,-0.04,ry+0.14,ry+0.22,m(0xc8372f),oc);   // 5 kg rice bag and a rice bin
      P.rbox(rx-hw+0.01,rx+hw-0.01,0.02,0.2,ry,ry+0.32,0.02,lam(0xeef4f6,{transparent:true,opacity:0.45,roughness:0.05})); P.rbox(rx-hw+0.015,rx+hw-0.015,0.025,0.195,ry+0.005,ry+0.22,0.015,m(0xf5f1e6,0.9),oc);
      [-0.15,-0.06,0.03,0.12].forEach(function(z,i){ P.cyl(jx,z,0.04,0.04,0.45,0.75,lam(0xeef4f6,{transparent:true,opacity:0.35,roughness:0.05}),oc,18); P.cyl(jx,z,0.033,0.033,0.46,i%2?0.7:0.66,m(0xe9c46a,0.6),oc,14); P.cyl(jx,z,0.042,0.042,0.75,0.77,M.steel,oc,18); });   // shelf 1: pasta jars
      if(robot) P.rbox(jx-0.04,jx+0.04,0.17,0.21,0.45,0.66,0.006,m(0x6b4a2a)); else P.rbox(cx-hw+0.01,cx+hw-0.01,0.17,0.21,0.45,0.66,0.006,m(0x6b4a2a));   // and a box of penne
      [[-0.18,0xd9a441],[-0.14,0xc8372f],[-0.1,0x3a2a22],[-0.06,0xd9a441]].forEach(function(q){ box(q[0],0.035,1.58,0.15,q[1]); });   // top shelf (light things): curry roux boxes standing like books
      [[0.02,0x2f6b52],[0.09,0xe85d3a],[0.16,0xf2c94c]].forEach(function(q,i){ for(let k=0;k<3;k++) box(q[0],0.06,1.58+k*0.035,0.032,q[1]); });   // microwave retort pouches stacked flat
      P.rbox(cx-hw+0.01,cx+hw-0.01,-0.2,-0.04,1.2,1.32,0.01,m(0xc9a87a,0.9));                                          // shelf 3: a basket of sauce and seasoning sachets
      [[-0.17,0xe85d3a],[-0.13,0x3f7d4e],[-0.09,0xf2c94c],[-0.06,0xffffff]].forEach(function(q){ const sh=P.rbox(cx-hw+0.03,cx+hw-0.03,q[0]-0.012,q[0]+0.012,1.25,1.38,0.004,m(q[1]),oc); sh.rotation.x=0.15; });
      P.rbox(cx-hw+0.01,cx+hw-0.01,0.0,0.09,1.2,1.4,0.03,m(0x8a6a4c,0.9)); P.rbox(cx-hw+0.01,cx+hw-0.01,0.0,0.09,1.4,1.42,0.01,m(0x4a3a2a),oc);   // dried shiitake in a zip bag
      box(0.155,0.11,1.2,0.12,0xe9d7b0); box(0.155,0.11,1.32,0.06,0x9b2d2a);                                            // boxes of soup packets
      const glass=lam(0xe8f0f2,{transparent:true,opacity:0.32,roughness:0.03,metalness:0.1,envMapIntensity:1.3}), lidW=m(0xf4f4f2,0.35), lidG=m(0x9aa3a8,0.4);   // shelf 2 (heavy, at waist height): glass food containers, large to small, nested in stacks with their lids
      const gbox=function(w,d,h,x,z,y){ P.rbox(x-w/2,x+w/2,z-d/2,z+d/2,y,y+h,0.012,glass,oc); P.rbox(x-w/2+0.004,x+w/2-0.004,z-d/2+0.004,z+d/2-0.004,y,y+0.004,0.01,glass,oc); };
      [[-0.13,[[0.2,0.15,0.08],[0.17,0.12,0.07],[0.14,0.1,0.06]]],[0.06,[[0.17,0.17,0.07],[0.14,0.14,0.06]]],[0.18,[[0.11,0.08,0.06],[0.09,0.07,0.05],[0.08,0.06,0.045]]]].forEach(function(st){
        let y=0.82; st[1].forEach(function(b){ gbox(Math.min(b[0],2*hw-0.02),b[1],b[2],cx,st[0],y); y+=0.012; }); });
      [[-0.13,0.15,4],[0.06,0.17,2],[0.18,0.08,3]].forEach(function(q){ for(let k=0;k<q[2];k++) P.rbox(cx-hw+0.015,cx+hw-0.015,q[0]-q[1]/2-0.005,q[0]+q[1]/2+0.005,0.92+k*0.016,0.932+k*0.016,0.01,k%2?lidG:lidW,oc); });   // snap-lock lids stacked on top
      [[-0.1,0.07],[0.1,0.06]].forEach(function(q){ gbox(0.09,0.09,0.06,cx,q[0],1.58+0.22); });                                 // a few small ones up top
      const G=new THREE.Group(); G.position.set(x1-0.01,0,-hz); P.group.add(G);                                           // one door hinged on the -z side
      const dy=robot?0.43:0, pm=new THREE.Mesh(new THREE.BoxGeometry(0.02,H-dy-0.004,W-0.004),body); pm.position.set(0,(H+dy)/2,W/2); pm.castShadow=pm.receiveShadow=true; G.add(pm);
      const hd=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.3,0.012),M.steel); hd.position.set(0.017,1.05,W-0.05); G.add(hd);
      P.setOpen=function(t){ G.rotation.y=1.7*ease(t); };
      const st=stepper(0.6,P.setOpen);
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:x1+0.45,z:0,label:function(){ return st.target?'關上收納櫃':'打開收納櫃'; },act:function(){ st.target=st.target?0:1; }}];
      P._col(x0,x1,-hz,hz,true);
      return P;
    };
    /* laundry basket (45 x 33 x 24 cm) with mesh laundry bags, sitting at height y0 (e.g. on top of a washer); front +x */
    Catalog.laundryBasket=function(y0){
      const P=new Piece(), lam=env.lam, y=y0||0, oc={cast:false}, wov=lam(0xd9c7a6,{roughness:0.95}), wovD=lam(0xc4ae88,{roughness:0.95}), w=0.165, d=0.225, h=0.24, t=0.012;
      P.rbox(-w,w,-d,d,y,y+0.012,0.02,wov);
      [[-w,-w+t,-d,d],[w-t,w,-d,d],[-w,w,-d,-d+t],[-w,w,d-t,d]].forEach(function(q){ P.box(q[0],q[1],q[2],q[3],y,y+h,wov); });
      for(let i=1;i<6;i++){ const yy=y+i*h/6; [[-w-0.002,w+0.002,-d-0.002,-d+0.004],[-w-0.002,w+0.002,d-0.004,d+0.002],[-w-0.002,-w+0.004,-d,d],[w-0.004,w+0.002,-d,d]].forEach(function(q){ P.box(q[0],q[1],q[2],q[3],yy-0.004,yy+0.004,wovD,oc); }); }   // woven bands
      P.box(-w-0.004,w+0.004,-d-0.004,d+0.004,y+h-0.012,y+h+0.004,wovD,oc);                                                   // rim
      [-1,1].forEach(function(sd){ P.box(-0.05,0.05,sd*d-0.006,sd*d+0.006,y+h-0.06,y+h-0.035,lam(0x3a3a3a),oc); });          // hand holes
      const net=[lam(0xf4f4f2,{roughness:0.9,transparent:true,opacity:0.92}),lam(0xc9cfd4,{roughness:0.9,transparent:true,opacity:0.92}),lam(0xe8dfe6,{roughness:0.9,transparent:true,opacity:0.92})];
      [[-0.06,-0.1,0.16,0.04,0],[0.05,0.02,0.2,0.05,1],[-0.04,0.11,0.12,0.06,2],[0.06,-0.12,0.1,0.11,0]].forEach(function(q){   // flat and round mesh bags with zips
        P.rbox(q[0]-0.11,q[0]+0.11,q[1]-q[2]/2,q[1]+q[2]/2,y+0.012+q[3],y+0.012+q[3]+0.07,0.03,net[q[4]],oc);
        P.box(q[0]-0.1,q[0]+0.1,q[1]-0.004,q[1]+0.004,y+0.012+q[3]+0.07,y+0.012+q[3]+0.074,lam(0x9aa0a6),oc); });
      return P;
    };
    /* 3 L electric hot water pot (電気ポット) with a lock and dispense buttons and a temperature display; front +z */
    Catalog.hotWaterPot=function(){
      const P=new Piece(), lam=env.lam, o={}, oc={cast:false}, cream=lam(0xf3efe6,{roughness:0.35}), silver=lam(0xb9bec4,{metalness:0.85,roughness:0.3,envMapIntensity:1}), glass=lam(0x0d1114,{roughness:0.1,metalness:0.2,envMapIntensity:1}), led=new THREE.MeshBasicMaterial({color:0x76ffb2});
      const y=0, cx=0, cz=0;
      P.cyl(cx,cz,0.125,0.14,y,y+0.34,cream,o,28); P.cyl(cx,cz,0.12,0.12,y+0.34,y+0.37,silver,oc,28);
      P.box(cx-0.015,cx+0.015,cz+0.1,cz+0.16,y+0.28,y+0.3,silver,oc);
      P.box(cx-0.03,cx+0.03,cz+0.118,cz+0.124,y+0.24,y+0.26,led,oc);
      P.box(cx+0.09,cx+0.112,cz-0.02,cz+0.02,y+0.12,y+0.3,glass,oc);
      const hd=new THREE.Mesh(new THREE.TorusGeometry(0.1,0.009,8,24,Math.PI),cream); hd.position.set(cx,y+0.37,cz); P.add(hd);   // carry handle over the lid
      P.box(cx-0.06,cx+0.06,cz+0.08,cz+0.125,y+0.3,y+0.335,silver,oc);                                                        // control panel on the shoulder
      P.box(cx-0.045,cx-0.005,cz+0.122,cz+0.127,y+0.31,y+0.326,new THREE.MeshBasicMaterial({color:0x8fd3ff}),oc);              // temperature display (98℃)
      [0.02,0.045].forEach(function(dx){ P.cyl(cx+dx,cz+0.125,0.008,0.008,y+0.312,y+0.326,dx>0.03?lam(0xd8453c):cream,oc,12).rotation.x=Math.PI/2; });   // lock and dispense buttons
      P._col(-0.14,0.14,-0.14,0.14,true); return P;
    };
    /* tilt-out bin cabinet (W 60 x D 37 x H 88 cm) in the kitchen's white finish with the worktop on top: two doors tip forward with a bin on each; front +x */
    Catalog.binCabinet=function(flush){             // flush: built onto the end of a counter, its worktop continuing the counter's without a seam
      const P=new Piece(), lam=env.lam, oc={cast:false}, D=0.37, W=0.6, x0=-D/2, x1=D/2, z0=-W/2, z1=W/2;
      const kx=x1-0.006, kb=kx-0.012, dy0=flush?0.1:0.12, dh=flush?0.73:0.7;   // flush: kick 6 mm behind the door fronts and doors 0.1-0.83, as on sinkCounter
      if(flush){ P.box(x0,x1,z0,z0+0.018,0.1,0.84,M.cabF); P.box(x0,kb,z0,z0+0.018,0,0.1,M.cabF); } else P.box(x0,x1-0.02,z0,z0+0.018,0.1,0.84,M.cab); P.box(x0,x1-0.02,z1-0.018,z1,0.1,0.84,M.cab); P.box(x0,x0+0.018,z0,z1,0.1,0.84,M.cab); P.box(x0,x1-0.02,-0.009,0.009,0.1,0.84,M.cab,oc);   // flush: a full-depth end panel to the floor on the living-room side, the door fronts set inside it
      P.box(x0,x1-0.02,z0,z1,0.1,0.12,M.cab); P.box(x0+0.01,x1-0.03,z0+0.01,flush?z1+0.012:z1-0.01,0,0.1,M.dark,oc);
      if(flush){ P.box(x0+0.003,x1-0.02,z1,z1+0.018,0.1,0.83,M.cabF); P.box(x0,kb,z1,z1+0.012,0,0.099,M.dark,oc); P.box(x0,kb,z1,z1+0.012,0.099,0.1,M.cab,oc); P.box(kb,kx,z0,z1+0.012,0,0.099,M.dark,oc); P.box(kb,kx,z0,z1+0.012,0.099,0.1,M.cab,oc); }   // kitchen side: panel flush with the counter's door fronts, kick strip in line with its plinth
      if(flush) P.box(x0+0.01,x1-0.008,z0-0.04,z1+0.01,0.84,0.88,M.top); else P.rbox(x0-0.005,x1+0.02,z0-0.005,z1+0.005,0.84,0.88,0.01,M.top);   // facing west (turned 180°), so the counter's 4 cm living-room overhang is on local -z
      /* Kawasaki sorting: three pull-out buckets on full-extension slides behind identical soft-close fronts - burnable (tall, lidded) on one side, plastic packaging over cans and PET bottles on the other */
      P.box(x0+0.018,x1-0.02,0.009,z1-0.018,0.455,0.473,M.cab,oc);   // shelf between the two stacked pull-outs
      const rail=mat('binRail',0xb9bec4,{metalness:0.8,roughness:0.35}), bag=new THREE.MeshStandardMaterial({color:0xf2f4f5,roughness:0.25,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false});
      [[z0+0.018,-0.009,0.1,0.83,0xf2f1ee,0xe07a3a,'普通ごみ',0.56,true],[0.009,z1-0.018,0.473,0.83,0xe9eef2,0x3a7fc8,'プラスチック資源',0.3,false],[0.009,z1-0.018,0.1,0.455,0xe8efe6,0x4f9a5a,'空き缶・ペットボトル',0.3,false]].forEach(function(q){
        const za=q[0], zb=q[1], zc=(za+zb)/2, zw=zb-za, y0=q[2], y1=q[3], G=new THREE.Group(); P.group.add(G);
        const add=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; G.add(m); return m; };
        const fy0=y0>0.46?0.4645:y0, fy1=y1<0.46?0.4615:y1-0.003, fa=zc<0?z0+0.0015:0.0015, fb=zc<0?-0.0015:z1-0.0015, f=add(new THREE.BoxGeometry(0.018,fy1-fy0,fb-fa),M.cabF,x1-0.011,(fy0+fy1)/2,(fa+fb)/2); if(GROOVE) NOTCH(G,x1-0.002,fy1,zc,Math.PI/2,0,zw); else add(new THREE.BoxGeometry(0.012,0.012,0.12),M.steel,x1+0.006,y1-0.05,zc);
        const bd=D-0.08, bw=zw-0.05, bh=q[7], bx0=x1-0.02-bd/2-0.01, by=y0+0.025, bm=lam(q[4],{roughness:0.4});
        add(new THREE.BoxGeometry(bd,0.012,bw),bm,bx0,by+0.006,zc); [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.01,bh,bw),bm,bx0+sd*(bd/2-0.005),by+bh/2,zc); add(new THREE.BoxGeometry(bd,bh,0.01),bm,bx0,by+bh/2,zc+sd*(bw/2-0.005)); });   // the bucket
        [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.003,0.07,bw+0.008),bag,bx0+sd*(bd/2+0.002),by+bh-0.025,zc).renderOrder=2; add(new THREE.BoxGeometry(bd+0.008,0.07,0.003),bag,bx0,by+bh-0.025,zc+sd*(bw/2+0.002)).renderOrder=2; });   // a clear bag folded over the rim
        if(q[8]){ add(new THREE.BoxGeometry(bd+0.012,0.012,bw+0.012),bm,bx0,by+bh+0.006,zc); add(new THREE.BoxGeometry(bd*0.55,0.004,bw*0.6),lam(0xe2e0db,{roughness:0.4}),bx0-bd*0.12,by+bh+0.014,zc); }   // lid with a push flap
        add(new THREE.BoxGeometry(0.004,0.012,0.022),lam(q[5],{roughness:0.5}),x1-0.0215,y1-0.03,za+0.03);   // a small colour tag inside the front's top edge
        [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(bd,0.012,0.006),rail,bx0,by+0.03,zc+sd*(zw/2-0.008)); P.box(x0+0.03,x1-0.03,zc+sd*(zw/2-0.004)-0.003,zc+sd*(zw/2-0.004)+0.003,by+0.022,by+0.04,rail,oc); });   // moving and fixed slide members
        const st=stepper(0.55,function(t){ G.position.x=0.26*ease(t); }); P.anims.push(function(t){ return st.run(t); });
        P.actions=(P.actions||[]).concat([{x:x1+0.45,z:zc,part:[f],label:function(){ return (st.target?'推回垃圾桶（':'拉開垃圾桶（')+q[6]+'）'; },act:function(){ st.target=st.target?0:1; }}]); });
      P._col(x0,x1+0.02,z0,z1,true); return P;
    };
    /* round wall clock, 30 cm, white face in a rose-gold frame; front +x, centre 1.95 m up */
    Catalog.wallClock=function(style){
      if(style==='oak'){                          // 35 cm minimal clock: oak rim, cream face, plain tick marks, thin black hands; front +x, centre 1.6 m up
        const P=new Piece(), lam=env.lam, R=0.175, r=0.155, yc=1.6, oc={cast:false}, ink=lam(0x222222,{roughness:0.5});
        const rim=new THREE.Mesh(new THREE.CylinderGeometry(R,R,0.03,64),lam(0xd2b083,{roughness:0.55,map:M.oak.map||null})); rim.rotation.z=Math.PI/2; rim.position.set(0.015,yc,0); P.add(rim);
        const face=new THREE.Mesh(new THREE.CircleGeometry(r,64),lam(0xf6f1e6,{roughness:0.6})); face.rotation.y=Math.PI/2; face.position.set(0.031,yc,0); P.add(face,oc);
        for(let i=0;i<12;i++){ const a=i/12*TAU, l=i%3===0?0.022:0.012, rr=r-0.014-l/2, m=new THREE.Mesh(new THREE.BoxGeometry(0.001,l,i%3===0?0.004:0.0025),ink); m.position.set(0.0315,yc+Math.cos(a)*rr,Math.sin(a)*rr); m.rotation.x=-a; P.add(m,oc); }
        const hand=function(len,w,ang){ const g=new THREE.Group(); g.position.set(0.034,yc,0); g.rotation.x=-ang; P.group.add(g); const m=new THREE.Mesh(new THREE.BoxGeometry(0.002,len,w),ink); m.position.y=len/2-0.015; g.add(m); };
        hand(0.085,0.005,TAU*10/12); hand(0.125,0.003,TAU*2/12);
        P.cyl(0.035,0,0.006,0.006,yc-0.003,yc+0.003,ink,oc,12).rotation.z=Math.PI/2;
        return P;
      }
      const P=new Piece(), lam=env.lam, r=0.15, yc=1.95, rose=lam(0xe0a49a,{metalness:0.6,roughness:0.28,envMapIntensity:1.0}), oc={cast:false};
      const face=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.02,48),lam(0xfbfaf7,{roughness:0.35})); face.rotation.z=Math.PI/2; face.position.set(0.012,yc,0); P.add(face,oc);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r,0.01,12,64),rose); ring.rotation.y=Math.PI/2; ring.position.set(0.022,yc,0); P.add(ring);
      for(let i=0;i<12;i++){ const a=i/12*TAU, long=i%3===0; P.box(0.022,0.024,Math.sin(a)*(r-0.03)-0.003,Math.sin(a)*(r-0.03)+0.003,yc+Math.cos(a)*(r-0.03)-(long?0.018:0.008),yc+Math.cos(a)*(r-0.03)+(long?0.018:0.008),rose,oc); }
      const hand=function(len,w,ang){ const g=new THREE.Group(); g.position.set(0.026,yc,0); g.rotation.x=-ang; P.group.add(g); const m=new THREE.Mesh(new THREE.BoxGeometry(0.003,len,w),rose); m.position.y=len/2-0.015; g.add(m); };
      hand(0.08,0.006,TAU*10/12); hand(0.115,0.004,TAU*2/12);
      P.cyl(0.026,0,0.008,0.008,yc-0.004,yc+0.004,rose,oc,12).rotation.z=Math.PI/2;
      return P;
    };
    /* hands-free hair-dryer stand: 24 cm base, telescopic pole, the dryer tilted on a round side pivot; nozzle toward +x, power cord out of the back (-x).
       opt.pink: blush pink with gold trim and a power cord; otherwise white with a silver pole */
    Catalog.dryerStand=function(opt){
      opt=opt||{};
      const P=new Piece(), lam=env.lam, pk=!!opt.pink, oc={cast:false};
      const wh=lam(pk?0xe9c3bd:0xf3f3f1,{roughness:0.35}), pole=pk?lam(0xe3b8b0,{metalness:0.55,roughness:0.3}):lam(0xd8dadd,{metalness:0.6,roughness:0.3}), trim=pk?lam(0xd4a85a,{metalness:0.85,roughness:0.25}):wh, dk=lam(0x3a3d42,{roughness:0.4});
      const hy=pk?1.12:1.14, top=hy-0.01;
      P.cyl(0,0,0.12,0.12,0,0.022,wh,{},48); P.cyl(0,0,0.03,0.034,0.022,0.03,trim,oc,24);
      P.cyl(0,0,0.012,0.012,0.03,0.62,pole,{},16); P.cyl(0,0,0.014,0.014,0.6,0.63,pole,oc,16); P.cyl(0,0,0.012,0.012,0.63,0.95,pole,{},16);
      P.cyl(0,0,0.0135,0.0135,0.94,0.96,trim,oc,16); P.cyl(0,0,0.009,0.009,0.96,top-0.03,pole,{},14); P.cyl(0,0,0.006,0.01,top-0.03,top,trim,oc,12);
      const t=0.5, ax=Math.cos(t), ay=Math.sin(t), hc=hy+0.035, cx=ax*0.13, cy=hc+ay*0.13, cz=0;               // barrel pivoted near its back end, rising toward the nozzle at +x
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.036,0.03,32),wh); hub.rotation.x=Math.PI/2; hub.position.set(0,hc,0.045); P.add(hub);   // round pivot on the outer face, gold rim round the control button
      const rim=new THREE.Mesh(new THREE.TorusGeometry(0.036,0.005,10,36),trim); rim.position.set(0,hc,0.061); P.add(rim,oc);
      const face=new THREE.Mesh(new THREE.CircleGeometry(0.031,32),lam(pk?0xf1d3ce:0xe6e7e8,{roughness:0.4})); face.position.set(0,hc,0.061); P.add(face,oc);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.038,0.32,32),wh); body.rotation.z=t-Math.PI/2; body.position.set(cx,cy,cz); P.add(body);
      [[0.16,dk,0.034],[-0.16,lam(pk?0xe0b3ac:0xe6e7e8,{roughness:0.4}),0.036]].forEach(function(q){ const e=new THREE.Mesh(new THREE.CylinderGeometry(q[2],q[2],0.006,32),q[1]); e.rotation.z=t-Math.PI/2; e.position.set(cx+ax*q[0],cy+ay*q[0],cz); P.add(e,oc); });
      if(!pk) for(let i=0;i<3;i++){ const d=-0.12+i*0.025, sl=new THREE.Mesh(new THREE.BoxGeometry(0.016,0.004,0.05),dk); sl.position.set(cx+ax*d-ay*0.036,cy+ay*d+ax*0.036,cz); sl.rotation.z=t; P.add(sl,oc); }   // intake slots on top near the rear
      if(pk){ const pg=opt.plug||[-0.55,0.006,0.02], cm=lam(0x6b6e72,{roughness:0.6});   // power cord along the floor to the wall socket at opt.plug (piece-local)
        const pts=[[-0.012,0.62,0],[-0.04,0.4,0],[-0.1,0.12,pg[2]*0.15],[pg[0]*0.5-0.08,0.006,pg[2]*0.5],[pg[0],0.006,pg[2]*0.95],[pg[0],0.04,pg[2]],[pg[0],pg[1]-0.02,pg[2]]];
        P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); })),40,0.004,6),cm),oc);
        if(opt.floor){ P.box(pg[0]-0.06,pg[0]+0.06,pg[2]-0.06,pg[2]+0.06,0,0.004,lam(0xb9bec4,{metalness:0.8,roughness:0.35}),oc); P.box(pg[0]-0.04,pg[0]+0.04,pg[2]-0.03,pg[2]+0.03,0.004,0.006,lam(0x2b2c2e),oc); }   // its own flush floor outlet (フロアコンセント) at the base
        else if(opt.plug){ const pl=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.04,0.028),lam(0xf2f2f0,{roughness:0.4})); pl.position.set(pg[0]-0.015,pg[1],pg[2]); P.add(pl,oc); } }
      P._col(-0.12,0.12,-0.12,0.12,false);
      return P;
    };
    /* A&0901-style lift coffee table, 120.5 x 60.5 x 47.5 cm: grey folding top on scissor arms, walnut body on lockable casters.
       Modes: 0 coffee table, 1 desk (top rises to 69 cm toward -x, a small side panel rises), 2 dining (top unfolds to 121 x 120 at 67.5 cm, four stools come out). Front +x, sofa on -x */
    /* A&0901-style lift coffee table, 120.5 x 60.5 x 47.5 cm, all light oak. Front +x, sofa on -x.
       Layout along z: cubby end (-z) | stool cabinet | drawers + storage well under the top | stool cabinet (+z). Each stool cabinet runs through, a door on each long side, one stool behind each door.
       Modes: 0 coffee table; 1 desk (top rises 21.5 cm on scissor arms and slides 30 cm toward the sofa, the panel in the well rises 15 cm); 2 dining (top unfolds to 121 x 120 at 67.5 cm, the four stools come out to the ends) */
    Catalog.liftDining=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, W=0.3025, L=0.6025, R=0.05, ease2=function(a,b,e){ return ease((e-a)/(b-a)); };
      const oak=lam(0xd9bf96,{roughness:0.45}), grey=oak,   // plain oak tone throughout: a tiled grain breaks at every door and drawer front
             liner=lam(0x4a4d52,{roughness:0.7}), frame=lam(0x3a3d41,{roughness:0.5}), seamM=lam(0x9a8468,{roughness:0.8});
      const steel=lam(0x2a2c30,{metalness:0.7,roughness:0.35}), chrome=lam(0xcfd3d7,{metalness:0.9,roughness:0.25,envMapIntensity:1}), leather=lam(0xcdc4b4,{roughness:0.45}), dark=lam(0x4a4d52,{roughness:0.5});
      const V=function(q){ return new THREE.Vector2(q[0],-q[1]); };
      const plate=function(pts,y0,h,mt,holes){ const sh=new THREE.Shape(pts.map(V)); (holes||[]).forEach(function(hp){ sh.holes.push(new THREE.Path(hp.map(V))); });
        const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false,curveSegments:1}),mt); m.rotation.x=-Math.PI/2; m.position.y=y0; return P.add(m); };
      const H0=0.07, HT=0.435, BF=0.08, BT=0.40, S1=[-0.4825,-0.1725], S2=[0.2925,0.6025], MZ=[-0.1725,0.2925], EW=[0.03,0.03];   // body heights; bay floor/top; stool cabinets; middle zone; bay end walls
      const WELL=[-0.28,0.28,MZ[0]+0.015,MZ[1]-0.015], WY=0.29, PNL=[-0.13,0.27,-0.03,0.24];                 // storage well under the top (x0,x1,z0,z1), its floor, the rising panel
      const rect=function(b){ return [[b[0],b[2]],[b[1],b[2]],[b[1],b[3]],[b[0],b[3]]]; };
      /* a body segment between z0 and z1: corners rounded where rz says so (-1: -z end, 1: +z end); notches cut in from the faces: ends=[[x0,x1,depth]] on the -z face, sides=[[z0,z1,depth]] on both ±x */
      const seg=function(z0,z1,rz,ends,sides){ const pts=[], arc=function(cx,cz,a0,a1){ for(let i=0;i<=6;i++){ const a=a0+(a1-a0)*i/6; pts.push([cx+R*Math.cos(a),cz+R*Math.sin(a)]); } };
        if(rz<0) arc(W-R,z0+R,1.5*Math.PI,2*Math.PI); else pts.push([W,z0]); (sides||[]).forEach(function(n){ pts.push([W,n[0]],[W-n[2],n[0]],[W-n[2],n[1]],[W,n[1]]); });
        if(rz>0){ arc(W-R,z1-R,0,Math.PI/2); arc(-W+R,z1-R,Math.PI/2,Math.PI); } else pts.push([W,z1],[-W,z1]);
        (sides||[]).slice().reverse().forEach(function(n){ pts.push([-W,n[1]],[-W+n[2],n[1]],[-W+n[2],n[0]],[-W,n[0]]); }); if(rz<0) arc(-W+R,z0+R,Math.PI,1.5*Math.PI); else pts.push([-W,z0]);
        (ends||[]).forEach(function(n){ pts.push([n[0],z0],[n[0],z0+n[2]],[n[1],z0+n[2]],[n[1],z0]); }); return pts; };
      const lvl=function(y0,y1,pts,holes){ plate(pts,y0,y1-y0,oak,holes); };
      /* casters and the grey plinth */
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ const x=c[0]*0.24, z=c[1]*0.54;
        P.box(x-0.012,x+0.012,z-0.02,z+0.02,0.028,0.052,steel,oc); const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.018,20),lam(0x2b2d31,{roughness:0.5})); wh.rotation.z=Math.PI/2; wh.position.set(x,0.025,z); P.add(wh,oc);
        const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.02,14),lam(0xe9eaea,{roughness:0.4})); hub.rotation.z=Math.PI/2; hub.position.set(x,0.025,z); P.add(hub,oc); });
      P.rbox(-0.29,0.29,-0.59,0.59,0.058,H0,0.045,frame,{recv:false});   // plinth clears the shag of the rug
      const ln={cast:false,recv:false};                                                                                      // liners: dark, unlit by shadows so they don't speckle
      const lineBox=function(x0,x1,z0,z1,y0,y1,open){ const i=0.02; if(open==='x0') x0+=i; if(open==='x1') x1-=i; if(open==='z0') z0+=i; if(open==='z1') z1-=i; y0+=0.004; y1-=0.004; P.box(x0,x1,z0,z1,y0,y0+0.003,liner,ln); P.box(x0,x1,z0,z1,y1-0.003,y1,liner,ln);   // five dark walls; `open` names the missing one
        if(open!=='x0') P.box(x0,x0+0.003,z0,z1,y0,y1,liner,ln); if(open!=='x1') P.box(x1-0.003,x1,z0,z1,y0,y1,liner,ln); if(open!=='z0') P.box(x0,x1,z0,z0+0.003,y0,y1,liner,ln); if(open!=='z1') P.box(x0,x1,z1-0.003,z1,y0,y1,liner,ln); };
      /* cubby end: two open cells above a shallow drawer */
      const CUB=[[-0.25,-0.02],[0.02,0.25]], CD=S1[0]-(-L)-0.005, endDr=[-0.25,0.25,-L,-L+CD-0.005];   // within the straight run of the end face, like the cubby frames
      const A=[-L,S1[0]]; lvl(H0,0.11,seg(A[0],A[1],-1)); lvl(0.11,0.275,seg(A[0],A[1],-1,[[endDr[0]-0.004,endDr[1]+0.004,CD-0.005]])); lvl(0.275,0.30,seg(A[0],A[1],-1)); [-1,1].forEach(function(sd){ const arc=[]; for(let i=0;i<=6;i++){ const a=(sd>0?1.5:1.5)*Math.PI+(sd>0?1:-1)*i/6*Math.PI/2; arc.push([sd*(W-R)+R*Math.cos(a),-L+R+R*Math.sin(a)]); }   // cubby level: corner pillars, centre divider, back strip (open cells between)
        const pts=sd>0?[[0.25,-L]].concat(arc,[[W,A[1]],[0.25,A[1]]]):[[-0.25,A[1]],[-W,A[1]]].concat(arc,[[-0.25,-L]]); plate(pts,0.30,0.12,oak); });
      P.box(-0.02,0.02,-L,A[1],0.30,0.42,oak); P.box(-0.25,0.25,-L+CD,A[1],0.30,0.42,oak); lvl(0.42,HT,seg(A[0],A[1],-1));
      lineBox(endDr[0]-0.004,endDr[1]+0.004,-L,endDr[3],0.11,0.275,'z0');
      CUB.forEach(function(c,i){ const x0=c[0], x1=c[1], zb=-L, zi=-L+CD; lineBox(x0,x1,zb,zi,0.30,0.42,'z0');
        if(i===0){ [[0x2f4b6e,0.028],[0xe6d3a8,0.04],[0xb5523b,0.024],[0x3f6b4f,0.036],[0x8a8a85,0.03]].forEach(function(b,k){ const bx=x0+0.025+k*0.042; P.box(bx,bx+b[1],zb+0.012,zi-0.006,0.303,0.303+0.1+k*0.005,lam(b[0],{roughness:0.7}),oc); }); }   // paperbacks standing in the cell
        else { [0,1].forEach(function(k){ const cx=x0+0.065+k*0.1, cz=zb+0.06; P.cyl(cx,cz,0.03,0.03,0.303,0.4,lam(0xf2f0eb,{roughness:0.35}),oc,18); P.cyl(cx,cz,0.031,0.031,0.4,0.412,lam(0x3a3d42,{roughness:0.4}),oc,18); P.box(cx-0.018,cx+0.018,cz-0.0312,cz-0.0305,0.33,0.36,lam(0x2b2b2b),oc); }); } });   // two canisters with black lids and labels
      /* middle zone: side drawers below, the storage well above */
      const drX=[0.06,W], drZ=[MZ[0]+0.015,MZ[1]-0.015], sideN=[[drZ[0],drZ[1],W-drX[0]]];
      lvl(H0,0.09,seg(MZ[0],MZ[1],0)); lvl(0.09,0.27,seg(MZ[0],MZ[1],0,null,sideN)); lvl(0.27,0.29,seg(MZ[0],MZ[1],0)); lvl(0.29,HT,seg(MZ[0],MZ[1],0),[rect(WELL)]);
      lineBox(drX[0],W,drZ[0],drZ[1],0.09,0.27,'x1'); lineBox(-W,-drX[0],drZ[0],drZ[1],0.09,0.27,'x0');
      P.box(WELL[0],WELL[1],WELL[2],WELL[3],WY,WY+0.004,lam(0x5a5d62,{roughness:0.7}),{cast:false});
      [[WELL[0],WELL[0]+0.003],[WELL[1]-0.003,WELL[1]]].forEach(function(q){ P.box(q[0],q[1],WELL[2],WELL[3],WY,HT,liner,ln); });
      [[WELL[2],WELL[2]+0.003],[WELL[3]-0.003,WELL[3]]].forEach(function(q){ P.box(WELL[0],WELL[1],q[0],q[1],WY,HT,liner,ln); });
      /* stool bays: floor and top slabs, an end wall, a centre divider; the open sides are closed by the doors */
      const bayIn=function(sz){ const e=sz[0]<0?EW[0]:EW[1]; return sz[0]<0?[sz[0]+e,sz[1]]:[sz[0],sz[1]-e]; };
      [S1,S2].forEach(function(sz){ const rz=sz[0]<0?0:1, b=bayIn(sz); lvl(H0,BF,seg(sz[0],sz[1],rz)); lvl(BT,HT,seg(sz[0],sz[1],rz));
        if(rz) lvl(BF,BT,seg(b[1],sz[1],1)); else lvl(BF,BT,seg(sz[0],b[0],0));
        P.box(-W+0.02,W-0.02,b[0],b[1],BF,BF+0.003,lam(0x5a5d62,{roughness:0.7}),ln); P.box(-W+0.02,W-0.02,b[0],b[1],BT-0.003,BT,liner,ln); const ez=sz[0]<0?b[0]:b[1]-0.003; P.box(-W+0.02,W-0.02,ez,ez+0.003,BF,BT,liner,ln);   // bay liner: floor, ceiling, end wall; the sides are the doors
        P.box(-0.004,0.004,b[0]+0.004,b[1]-0.004,BF,BT-0.003,liner,ln); });
      /* drawers: a box on runners behind a front with a finger notch, opened by sliding; side drawers on ±x, end drawer on -z */
      const drawers=[], mkDrawer=function(axis,sd,f0,f1,y0,y1,depth,fill){ const G=new THREE.Group(); P.group.add(G);
        const add=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=mt===oak; G.add(m); return m; };
        const fw=f1-f0-0.003, fc=(f0+f1)/2, fh=y1-y0-0.003, fy=(y0+y1)/2, face=sd*(axis==='x'?W:L), inn=lam(0xeae4d8,{roughness:0.6});
        const bx=function(w,h,d,u,y,v){ if(axis==='x') add(new THREE.BoxGeometry(d,h,w),inn,v,y,u); else add(new THREE.BoxGeometry(w,h,d),inn,u,y,v); };
        const fg=axis==='x'?new THREE.BoxGeometry(0.018,fh,fw):new THREE.BoxGeometry(fw,fh,0.018); fitUV(fg,0.018,fh,fw);
        const RC=0.002;   // fronts sit 2 mm behind the body face
        if(axis==='x') add(fg,oak,face-sd*(0.009+RC),fy,fc); else add(fg,oak,fc,fy,face-sd*(0.009+RC));
        const nt=axis==='x'?new THREE.BoxGeometry(0.004,0.011,0.1):new THREE.BoxGeometry(0.1,0.011,0.004); const ntm=add(nt,seamM,0,0,0); if(axis==='x') ntm.position.set(face-sd*(RC+0.0015),y1-0.0085,fc); else ntm.position.set(fc,y1-0.0085,face-sd*(RC+0.0015));
        const bd=depth-0.03, bw=fw-0.02, by=y0+0.012, bh=y1-y0-0.05, vc=face-sd*(0.018+bd/2);   // box behind the front
        bx(bw,0.01,bd,fc,by,vc); bx(bw,bh,0.01,fc,by+bh/2,face-sd*(0.018+bd)); [-1,1].forEach(function(s){ bx(0.01,bh,bd,fc+s*(bw/2-0.005),by+bh/2,vc); });
        if(fill) fill(function(w,h,d,u,y,v,mt){ const g=axis==='x'?new THREE.BoxGeometry(d,h,w):new THREE.BoxGeometry(w,h,d); const m=new THREE.Mesh(g,mt); if(axis==='x') m.position.set(v,y,u); else m.position.set(u,y,v); m.castShadow=true; G.add(m); },fc,by+0.005,face-sd*0.018,sd);
        const st=stepper(0.6,function(t){ const o=ease(t)*(depth-0.06); if(axis==='x') G.position.x=sd*o; else G.position.z=sd*o; }); P.anims.push(function(t){ return st.run(t); });
        st.g=G; drawers.push(st); return st; };
      const sideFill=function(add,fc,y,f,sd){ add(0.17,0.014,0.044,fc-0.1,y+0.007,f-sd*0.09,lam(0x232427,{roughness:0.4})); add(0.12,0.014,0.04,fc-0.1,y+0.007,f-sd*0.15,lam(0x232427,{roughness:0.4}));   // remotes, a notebook, coasters
        add(0.15,0.012,0.11,fc+0.08,y+0.006,f-sd*0.1,lam(0xd8453c,{roughness:0.6})); add(0.15,0.004,0.11,fc+0.08,y+0.014,f-sd*0.1,lam(0xf6f1e6,{roughness:0.6}));
        for(let k=0;k<4;k++) add(0.07,0.004,0.07,fc+0.12,y+0.002+k*0.0045,f-sd*0.185,lam(k%2?0xc9a87a:0xe6d3a8,{roughness:0.8})); };
      mkDrawer('x',1,drZ[0],drZ[1],0.09,0.27,0.24,sideFill); mkDrawer('x',-1,drZ[0],drZ[1],0.09,0.27,0.24,sideFill);
      mkDrawer('z',-1,endDr[0],endDr[1],0.11,0.275,CD-0.005,function(add,fc,y,f,sd){ [[-0.18,0x3a2a22],[-0.12,0xd9a441],[-0.06,0xf1ece2]].forEach(function(q){ add(0.05,0.14,0.07,fc+q[0],y+0.07,f-sd*0.05,lam(q[1],{roughness:0.7})); });   // slim boxes and a small tin
        add(0.11,0.05,0.06,fc+0.12,y+0.025,f-sd*0.05,lam(0x6b4a8a,{roughness:0.6})); });
      /* stools: oak side boards, a lift-up cushioned lid over a storage box (12 cm deep), open below. hs: side the lid hinges on (±z) */
      const stool=function(w,d,h,hs){ const G=new THREE.Group(), add=function(geo,mt,x,y,z,par){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; (par||G).add(m); return m; };
        const t=0.018, boxH=0.12, seatY=h-0.036, boxY0=seatY-t-boxH;
        [-1,1].forEach(function(s){ const g=new THREE.BoxGeometry(t,seatY-t,d); fitUV(g,t,seatY-t,d); add(g,oak,s*(w/2-t/2),(seatY-t)/2,0); });
        add(new THREE.BoxGeometry(w-2*t,0.01,d-0.02),lam(0xeae4d8,{roughness:0.6}),0,boxY0+0.005,0);                                         // box floor
        [-1,1].forEach(function(s){ add(new THREE.BoxGeometry(w-2*t,boxH+0.004,0.012),dark,0,boxY0+boxH/2,s*(d/2-0.006)); });              // dark box walls front and back
        add(new THREE.BoxGeometry(0.1,0.03,0.07),lam(0xf3f3f1,{roughness:0.4}),-0.03,boxY0+0.025,0.02); add(new THREE.BoxGeometry(0.06,0.012,0.12),lam(0x232427,{roughness:0.4}),0.05,boxY0+0.016,-0.03);   // inside: a tissue box and a remote
        const LID=new THREE.Group(); LID.position.set(0,seatY-t,hs*d/2); G.add(LID);
        const sb=new THREE.BoxGeometry(w,t,d); fitUV(sb,w,t,d); add(sb,oak,0,t/2,-hs*d/2,LID);
        (function(){ const q=0.03, a=(w+0.004)/2, c2=(d+0.004)/2, sh=new THREE.Shape(); sh.moveTo(-a+q,-c2); sh.lineTo(a-q,-c2); sh.quadraticCurveTo(a,-c2,a,-c2+q); sh.lineTo(a,c2-q); sh.quadraticCurveTo(a,c2,a-q,c2); sh.lineTo(-a+q,c2); sh.quadraticCurveTo(-a,c2,-a,c2-q); sh.lineTo(-a,-c2+q); sh.quadraticCurveTo(-a,-c2,-a+q,-c2);
          const g=new THREE.ExtrudeGeometry(sh,{depth:0.02,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.009,bevelSegments:4,curveSegments:5}); g.rotateX(-Math.PI/2); add(g,leather,0,t,-hs*d/2,LID);   // a pillowy rounded cushion with soft edges, not a box
          const pg=new THREE.TorusGeometry(0.0015,0.0015,4,4); [0.2,0.3,0.4].forEach(function(f){ const sm=add(new THREE.BoxGeometry(w*0.7,0.0012,0.002),dark,0,t+0.0404,-hs*d/2+(f-0.3)*d,LID); }); })();   // stitched seams across the top
        P.group.add(G); G.userData.lid=LID; G.userData.hs=hs; return G; };
      /* bay doors on ±x, flush with the body, hinged at the outer (end) edge; the stool behind each door, and where it goes for dinner */
      const doors=[], stools=[];
      [[S1,-1],[S2,1]].forEach(function(q){ const sz=q[0], end=q[1], b=bayIn(sz), zc=(b[0]+b[1])/2, hz=end>0?b[1]:b[0], dw=b[1]-b[0]-0.003, dh=BT-BF-0.004;
        [1,-1].forEach(function(sd){ const D=new THREE.Group(); D.position.set(sd*W,0,hz); P.group.add(D); doors.push({g:D,sd:sd,end:end});
          const dg=new THREE.BoxGeometry(0.018,dh,dw); fitUV(dg,0.018,dh,dw); const dm=new THREE.Mesh(dg,oak); dm.position.set(-sd*0.009,(BF+BT)/2,zc-hz); dm.castShadow=dm.receiveShadow=true; D.add(dm);
          const nt=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.011,0.1),seamM); nt.position.set(sd*0.0005,BT-0.0135,zc-hz-end*0.08); D.add(nt);
          const isB=sd>0, S=stool(0.24,0.24,0.31,-end), sx=sd*0.145;   // four identical 24 x 24 stools, one per half-bay (27.8 x 28 cm per side, 32 cm high)   // lids hinge on the table side, so they open away from whoever stands behind the stool
          S.position.set(sx,BF+0.002,zc); stools.push({g:S,home:[sx,zc],out:[sd*(W+(isB?0.17:0.2)),zc],way:[sd*(W+(isB?0.17:0.2)),end*0.78],end:[sd*0.15,end*0.78]}); }); });
      /* the grey top: two 2 cm leaves hinged on the +x edge, riding on two pairs of scissor arms that pivot in the well floor */
      const TOP=new THREE.Group(); P.group.add(TOP); TOP.position.set(0,HT,0);
      const tadd=function(geo,mt,x,y,z,par){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; (par||TOP).add(m); return m; };
      const leafGeo=function(){ const s=new THREE.Shape(), r=0.025, w=W, d=L; s.moveTo(-w+r,-d); s.lineTo(w,-d); s.lineTo(w,d); s.lineTo(-w+r,d); s.quadraticCurveTo(-w,d,-w,d-r); s.lineTo(-w,-d+r); s.quadraticCurveTo(-w,-d,-w+r,-d);   // rounded only on the outer edge; the fold edge is square
        const g=new THREE.ExtrudeGeometry(s,{depth:0.018,bevelEnabled:true,bevelThickness:0.001,bevelSize:0.001,bevelSegments:1,curveSegments:6}); g.rotateX(-Math.PI/2); return g; };
      tadd(leafGeo(),grey,0,0.001,0);
      const LEAF=new THREE.Group(); LEAF.position.set(W,0.02,0); TOP.add(LEAF); tadd(leafGeo(),grey,-W,0.001,0,LEAF);
      [-0.2,0.2].forEach(function(z){ tadd(new THREE.BoxGeometry(0.05,0.004,0.024),chrome,W,-0.003,z); });   // leaf hinge plates under the fold
      const items=new THREE.Group(); items.position.y=0.04; TOP.add(items);                                                             // on the folded top: a divided caddy with the TV and AC remotes and a tissue box
      const iadd=function(geo,mt,x,y,z,ry){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); if(ry) m.rotation.y=ry; m.castShadow=true; items.add(m); return m; };
      const cad=lam(0xeae4d8,{roughness:0.6}), cx=0.06, cz=0.12;
      iadd(new THREE.BoxGeometry(0.2,0.008,0.26),cad,cx,0.004,cz); [-1,1].forEach(function(sd){ iadd(new THREE.BoxGeometry(0.2,0.07,0.008),cad,cx,0.035,cz+sd*0.126); iadd(new THREE.BoxGeometry(0.008,0.07,0.26),cad,cx+sd*0.096,0.035,cz); });
      iadd(new THREE.BoxGeometry(0.19,0.06,0.006),cad,cx,0.035,cz-0.045); iadd(new THREE.BoxGeometry(0.19,0.06,0.006),cad,cx,0.035,cz+0.045);
      iadd(new THREE.BoxGeometry(0.17,0.016,0.045),lam(0x232427,{roughness:0.4}),cx,0.016,cz-0.085); [0,1,2].forEach(function(k){ iadd(new THREE.CylinderGeometry(0.004,0.004,0.003,8),lam(0x8e9196),cx-0.06+k*0.015,0.025,cz-0.085); });   // TV remote
      iadd(new THREE.BoxGeometry(0.15,0.016,0.05),lam(0xf3f3f1,{roughness:0.4}),cx,0.016,cz); iadd(new THREE.BoxGeometry(0.03,0.001,0.02),lam(0x2b4a6b),cx-0.045,0.0245,cz);   // AC remote with its little display
      iadd(new THREE.BoxGeometry(0.17,0.055,0.07),lam(0xf6f1e6,{roughness:0.6}),cx,0.0355,cz+0.085); iadd(new THREE.BoxGeometry(0.06,0.02,0.03),lam(0xffffff,{roughness:0.9}),cx,0.07,cz+0.085);   // tissues
      const bowl=new THREE.Mesh(new THREE.LatheGeometry([[0.001,0],[0.05,0],[0.08,0.03],[0.085,0.05],[0.078,0.05],[0.073,0.032],[0.046,0.006],[0.001,0.006]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),28),M.ceramic); bowl.position.set(0.05,0,-0.17); bowl.castShadow=true; items.add(bowl);
      for(let i=0;i<5;i++){ const o=new THREE.Mesh(new THREE.SphereGeometry(0.024,14,10),lam(0xf0a63a,{roughness:0.6})); o.position.set(0.05+Math.cos(i*1.26)*0.03*(i?1:0),0.03+(i?0:0.02),-0.17+Math.sin(i*1.26)*0.03*(i?1:0)); items.add(o); }
      const dining=new THREE.Group(); dining.position.y=0.02; TOP.add(dining);                                                         // table setting in dining mode: six places, fruit in the middle
      const plateM=lam(0xf6f3ec,{roughness:0.25}), plateB=lam(0xc9d6df,{roughness:0.25}), stl=lam(0xc9ced3,{metalness:0.85,roughness:0.25});
      [[-0.42,-0.25],[-0.42,0.25],[-0.15,0.42],[0.15,0.42],[-0.15,-0.42],[0.15,-0.42]].forEach(function(q){ const px=q[0]+0.3, pz=q[1];
        const pl=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.095,0.012,28),plateM); pl.position.set(px,0.006,pz); dining.add(pl);
        const pb=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.045,0.03,22),plateB); pb.position.set(px,0.027,pz); dining.add(pb);
        [-1,1].forEach(function(s){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.003,0.16),stl); f.position.set(px+s*0.135,0.0015,pz); dining.add(f); });
        const gl=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.025,0.09,16,1,true),lam(0xeef4f6,{transparent:true,opacity:0.4,roughness:0.05,side:THREE.DoubleSide})); gl.position.set(px+0.17,0.045,pz-0.1); dining.add(gl); });
      const fb=new THREE.Mesh(new THREE.LatheGeometry([[0.001,0],[0.06,0],[0.11,0.05],[0.115,0.065],[0.108,0.065],[0.1,0.052],[0.055,0.008],[0.001,0.008]].map(function(q){ return new THREE.Vector2(q[0],q[1]); }),28),M.ceramic); fb.position.set(0.3,0,0); dining.add(fb);
      for(let i=0;i<7;i++){ const o=new THREE.Mesh(new THREE.SphereGeometry(0.03,14,10),lam(i%2?0xf0a63a:0xf2d04c,{roughness:0.6})); o.position.set(0.3+Math.cos(i*0.9)*0.05*(i<6?1:0),0.035+(i<6?0:0.04),Math.sin(i*0.9)*0.05*(i<6?1:0)); dining.add(o); }
      const AL=0.362, TH0=Math.asin((HT-WY)/AL), TH1=Math.asin((HT-WY+0.215)/AL), arms=[];                                              // arm geometry: 21.5 cm up and ~30 cm toward the sofa between the two angles
      [-0.12,0.26].forEach(function(z){ [-0.24,-0.12].forEach(function(px){ const a=new THREE.Mesh(new THREE.BoxGeometry(AL,0.014,0.028),steel); a.castShadow=true; P.group.add(a); arms.push({m:a,px:px,z:z});
        P.box(px-0.012,px+0.012,z-0.02,z+0.02,WY,WY+0.02,steel,oc); tadd(new THREE.BoxGeometry(0.03,0.012,0.04),steel,px+AL*Math.cos(TH0),-0.006,z); }); });
      const PANEL=new THREE.Group(); P.group.add(PANEL); const pg=new THREE.BoxGeometry(PNL[1]-PNL[0]-0.004,0.02,PNL[3]-PNL[2]-0.004); fitUV(pg,0.4,0.02,0.27);
      const pm=new THREE.Mesh(pg,oak); pm.position.set((PNL[0]+PNL[1])/2,HT-0.01,(PNL[2]+PNL[3])/2); pm.castShadow=pm.receiveShadow=true; PANEL.add(pm);
      const parms=[[-0.09,0.0],[0.23,0.0],[-0.09,0.21],[0.23,0.21]].map(function(q){ const a=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.012,0.02),steel); P.group.add(a); return {m:a,x:q[0],z:q[1]}; });
      /* state: each part eases toward a target set by the mode, gated so the sequence reads right in both directions */
      let mode=0, lids=0, bay=0; const st={lift:0,panel:0,leaf:0,doors:0,stools:0,lids:0}, dur={lift:2.2,panel:1.2,leaf:2.0,doors:1.0,stools:3.4,lids:0.8};   // bay: stool-bay doors opened by hand outside dining mode
      const apply=function(){
        const th=TH0+(TH1-TH0)*ease(st.lift), dx=AL*(Math.cos(th)-Math.cos(TH0)), dy=AL*(Math.sin(th)-Math.sin(TH0));
        TOP.position.set(dx,HT+dy,0);
        arms.forEach(function(a){ a.m.rotation.z=th; a.m.position.set(a.px+AL/2*Math.cos(th),WY+0.01+AL/2*Math.sin(th),a.z); });
        LEAF.rotation.z=-Math.PI*ease(st.leaf); const sItems=Math.max(0.001,1-ease(st.leaf)*2); items.children.forEach(function(o){ o.scale.setScalar(sItems); }); items.visible=sItems>0.01;
        const sD=Math.max(0.001,ease2(0.6,1,st.stools)); dining.children.forEach(function(o){ o.scale.setScalar(sD); }); dining.visible=sD>0.01;
        const py=0.15*ease(st.panel); PANEL.position.set(0.02*ease(st.panel),py,0); parms.forEach(function(a){ const ang=Math.asin(Math.min(1,py/0.15)); a.m.rotation.z=ang; a.m.position.set(a.x+0.075*Math.cos(ang),HT-0.02+py/2,a.z); a.m.visible=py>0.005; });
        doors.forEach(function(d){ d.g.rotation.y=-d.sd*d.end*1.8*ease(st.doors); });
        stools.forEach(function(s,i){ const e=st.stools, k=(i%2)*0.08, e1=ease2(k,0.3+k,e), e2=ease2(0.3+k,0.68+k,e), e3=ease2(0.68+k,0.92+k,e);   // slide out of the bay, run along the long side, step in at the table end
          const x=s.home[0]+(s.out[0]-s.home[0])*e1+(s.way[0]-s.out[0])*e2+(s.end[0]-s.way[0])*e3, z=s.home[1]+(s.way[1]-s.out[1])*e2+(s.end[1]-s.way[1])*e3;
          s.g.position.set(x,(BF+0.002)*(1-e1),z); s.g.userData.lid.rotation.x=s.g.userData.hs*1.35*ease(st.lids); });
      };
      apply();
      P.anims.push(function(t){ const dt=P._last==null?0:Math.min(0.05,Math.max(0,t-P._last)); P._last=t; let moving=false;
        const tg={lift:mode>0?1:0,panel:mode===1?1:0,leaf:mode===2?1:0,doors:mode===2?1:0,stools:mode===2?1:0,lids:mode===2&&lids?1:0};
        if(st.lift<0.98){ tg.panel=0; tg.leaf=0; tg.doors=0; tg.stools=0; } if(st.panel>0.02||st.leaf>0.02||(mode===2&&st.doors>0.02)) tg.lift=1;
        if(st.leaf<0.98) tg.doors=0; if(mode!==2&&bay&&st.stools<0.02) tg.doors=1; if(st.doors<0.98) tg.stools=0; if(st.stools>0.02){ tg.doors=1; tg.leaf=1; } if(st.stools<0.98) tg.lids=0; if(st.lids>0.02) tg.stools=1;
        Object.keys(st).forEach(function(k){ const v=st[k], g=tg[k]; if(v===g) return; st[k]=g>v?Math.min(g,v+dt/dur[k]):Math.max(g,v-dt/dur[k]); moving=true; });
        if(moving) apply(); return moving; });
      P.setMode=function(m){ mode=m; }; P.getMode=function(){ return mode; }; P.getState=function(){ return Object.assign({},st); };
      P.actions=[{x:0.6,z:-0.3,part:[TOP,PANEL],label:function(){ return mode===0?'茶几升成書桌':mode===1?'展開成餐桌（餐凳出來）':'收回成茶几'; },act:function(){ mode=(mode+1)%3; bay=0; }},
        {x:-0.6,z:0.3,part:doors.map(function(d){ return d.g; }),on:function(){ return mode!==2; },label:function(){ return bay?'關上餐凳收納門':'打開餐凳收納門'; },act:function(){ bay=bay?0:1; }},
        {x:0.6,z:0.25,part:[drawers[0].g],label:function(){ return drawers[0].target?'推回側抽屜':'拉出側抽屜'; },act:function(){ drawers[0].target=drawers[0].target?0:1; }},
        {x:-0.35,z:-0.85,part:[drawers[1].g],label:function(){ return drawers[1].target?'推回沙發側抽屜':'拉出沙發側抽屜'; },act:function(){ drawers[1].target=drawers[1].target?0:1; }},
        {x:0.2,z:-0.85,part:[drawers[2].g],label:function(){ return drawers[2].target?'推回端面抽屜':'拉出端面抽屜'; },act:function(){ drawers[2].target=drawers[2].target?0:1; }},
        {x:0.6,z:0.9,label:function(){ return lids?'蓋上餐凳座墊':'掀開餐凳座墊（收納）'; },on:function(){ return mode===2&&st.stools>0.98; },act:function(){ lids=lids?0:1; }}];
      P.lift={get up(){ return mode===2; },set up(v){ mode=v?2:0; }};
      P.cols.push({x0:-W,x1:W,z0:-L,z1:L,kind:'f'});   // no contact-shadow decal: it would fight with the rug under the table
      return P;
    };
    /* round smoke alarm on the ceiling (h = ceiling height): 10 cm white disc with a red status LED */
    Catalog.smokeAlarm=function(h){
      const P=new Piece(), lam=env.lam, oc={cast:false}, wh=lam(0xf4f4f1,{roughness:0.4});
      P.cyl(0,0,0.052,0.05,h-0.03,h,wh,oc,28); P.cyl(0,0,0.03,0.03,h-0.033,h-0.03,lam(0xe8e8e4,{roughness:0.5}),oc,20);
      for(let i=0;i<12;i++){ const a=i/12*TAU; P.box(Math.cos(a)*0.04-0.003,Math.cos(a)*0.04+0.003,Math.sin(a)*0.04-0.003,Math.sin(a)*0.04+0.003,h-0.031,h-0.03,lam(0x9a9a96),oc); }
      P.cyl(0.02,0.02,0.003,0.003,h-0.034,h-0.03,new THREE.MeshBasicMaterial({color:0xff3b30}),oc,8);
      return P;
    };
    /* wall-mounted split air conditioner, 80 x 29 x 23 cm, its back on the wall at x=0, blowing toward +x; top edge at y */
    Catalog.wallAC=function(y){
      const P=new Piece(), lam=env.lam, oc={cast:false}, wh=lam(0xf6f6f3,{roughness:0.3}), y1=y||2.4, y0=y1-0.29;
      P.rbox(0.0,0.23,-0.4,0.4,y0,y1,0.03,wh);
      P.box(0.2,0.232,-0.36,0.36,y1-0.09,y1-0.03,lam(0xe3e3df,{roughness:0.4}),oc);                                         // intake grille strip on top of the front
      for(let i=0;i<10;i++) P.box(0.2,0.233,-0.33+i*0.07,-0.33+i*0.07+0.005,y1-0.085,y1-0.035,lam(0xc9c9c5),oc);
      P.box(0.12,0.23,-0.36,0.36,y0+0.02,y0+0.06,lam(0x2b2d31,{roughness:0.5}),oc); P.box(0.14,0.235,-0.36,0.36,y0+0.03,y0+0.05,wh,oc);   // louver slot with the closed flap
      P.box(0.225,0.232,0.25,0.36,y0+0.09,y0+0.11,lam(0x1a1a1a),oc); P.cyl(0.233,0.33,0.004,0.004,y0+0.1,y0+0.101,new THREE.MeshBasicMaterial({color:0x3cc96b}),oc,8).rotation.z=Math.PI/2;   // display and power LED
      return P;
    };
    /* bathroom ceiling ventilation dryer (h = ceiling height): 45 x 45 cm flush unit with a louvered intake and a long slot outlet */
    Catalog.bathDryer=function(h){
      const P=new Piece(), lam=env.lam, oc={cast:false}, wh=lam(0xf4f4f1,{roughness:0.35});
      P.rbox(-0.225,0.225,-0.225,0.225,h-0.025,h,0.01,wh);
      for(let i=0;i<9;i++) P.box(-0.17+i*0.04,-0.17+i*0.04+0.02,-0.18,0.08,h-0.027,h-0.025,lam(0xd4d4d0,{roughness:0.5}),oc);   // louvered intake
      P.box(-0.18,0.18,0.12,0.17,h-0.03,h-0.025,lam(0x2b2d31,{roughness:0.5}),oc);                                                  // warm-air outlet slot
      P.box(0.15,0.2,-0.2,-0.14,h-0.027,h-0.025,lam(0x1a1a1a),oc);
      return P;
    };
    /* ceiling-recessed ventilation heater for a changing room (換気暖房機, ventilation / heating / cool breeze, no dryer): a 35 cm square flush panel,
       intake grid on one half, a louvered warm-air outlet on the other blowing toward +x; h = ceiling height */
    Catalog.ventHeater=function(h){
      const P=new Piece(), lam=env.lam, oc={cast:false}, wh=lam(0xf4f4f1,{roughness:0.35}), gr=lam(0xd4d4d0,{roughness:0.5}), dk=lam(0x2b2d31,{roughness:0.5});
      P.rbox(-0.175,0.175,-0.175,0.175,h-0.016,h,0.008,wh);
      P.box(0.055,0.155,-0.15,0.15,h-0.0175,h-0.016,dk,oc);                                                                          // outlet opening
      for(let i=0;i<5;i++) P.box(0.062+i*0.02,0.074+i*0.02,-0.145,0.145,h-0.026,h-0.016,wh,oc).rotation.z=-0.55;                     // vanes angled toward +x
      for(let i=0;i<6;i++) P.box(-0.15,0.025,-0.125+i*0.045,-0.125+i*0.045+0.022,h-0.0175,h-0.016,gr,oc);                           // intake grid
      P.box(-0.16,-0.148,0.148,0.16,h-0.0172,h-0.016,new THREE.MeshBasicMaterial({color:0x7fd18c}),oc);                               // status LED
      return P;
    };
    /* wall control panel for a heater or floor heating, about 11 x 15 cm at height y: title, a small display (disp), labelled buttons and a timer row; front +x */
    Catalog.heaterPanel=function(title,btns,timer,y,disp){
      const P=new Piece(), lam=env.lam, oc={cast:false}, W=0.11, H=0.15, yc=y||1.2;
      P.rbox(0,0.012,-W/2,W/2,yc-H/2,yc+H/2,0.008,lam(0xf6f6f3,{roughness:0.3}),oc);
      const c=document.createElement('canvas'); c.width=220; c.height=300; const g=c.getContext('2d'), F='"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif';
      const rr=function(x,y0,w,h,r){ g.beginPath(); g.moveTo(x+r,y0); g.arcTo(x+w,y0,x+w,y0+h,r); g.arcTo(x+w,y0+h,x,y0+h,r); g.arcTo(x,y0+h,x,y0,r); g.arcTo(x,y0,x+w,y0,r); g.closePath(); };
      g.fillStyle='#f6f6f3'; g.fillRect(0,0,220,300); g.fillStyle='#7a7e84'; g.font='600 15px '+F; g.textAlign='center'; g.fillText(title,110,24);
      g.fillStyle='#1c2329'; rr(22,34,176,52,6); g.fill(); g.fillStyle='#9fd3e6'; const dt=disp||'24h 換氣'; let fs=22; do{ g.font='600 '+fs+'px '+F; fs--; }while(g.measureText(dt).width>164&&fs>10); g.fillText(dt,110,68);
      const n=btns.length, cols=n>4?3:2, bw=cols===3?56:84, gap=cols===3?7:8, rows=Math.ceil(n/cols);
      btns.forEach(function(t,i){ const r=Math.floor(i/cols), k=i%cols, inRow=Math.min(cols,n-r*cols), x0=110-(inRow*bw+(inRow-1)*gap)/2+k*(bw+gap), yy=100+r*48;
        g.fillStyle=t==='停止'?'#e9e3e0':'#ecedee'; rr(x0,yy,bw,38,8); g.fill(); g.strokeStyle='#c9cbce'; g.lineWidth=1.5; g.stroke();
        g.fillStyle=t==='停止'?'#b5473c':'#3d4248'; g.font='600 17px '+F; g.fillText(t,x0+bw/2,yy+25); });
      const ty=104+rows*48; g.fillStyle='#7a7e84'; g.font='12px '+F; g.fillText('タイマー',110,ty+6);
      timer.forEach(function(t,i){ const x0=110-(3*54+2*8)/2+i*62; g.fillStyle='#ecedee'; rr(x0,ty+14,54,28,7); g.fill(); g.strokeStyle='#c9cbce'; g.stroke(); g.fillStyle='#3d4248'; g.font='600 14px '+F; g.fillText(t,x0+27,ty+33); });
      const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=env.anisotropy||4;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(W-0.008,H-0.008),new THREE.MeshStandardMaterial({map:tx,roughness:0.45})); m.rotation.y=Math.PI/2; m.position.set(0.0125,yc,0); P.add(m,oc);
      return P;
    };
    /* laundry pole hung from two ceiling hooks (h = ceiling height), len long along z at 1.85 m, with shirts on hangers and a towel over it */
    Catalog.laundryPole=function(h,len,empty){   // empty: just the pole and one small hand towel
      const P=new Piece(), lam=env.lam, oc={cast:false}, L=len||1.2, py=1.85, steel=lam(0xd6dade,{metalness:0.85,roughness:0.25,envMapIntensity:1}), pole=lam(0xe8e8e4,{roughness:0.4});
      [-L/2+0.08,L/2-0.08].forEach(function(z){ P.cyl(0,z,0.02,0.02,h-0.02,h,steel,oc,14); P.cyl(0,z,0.004,0.004,py-0.01,h-0.02,steel,oc,8);
        const hk=new THREE.Mesh(new THREE.TorusGeometry(0.02,0.004,8,16,Math.PI),steel); hk.rotation.y=Math.PI/2; hk.rotation.z=Math.PI; hk.position.set(0,py+0.01,z); P.add(hk,oc); });
      const pm=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,L,12),pole); pm.rotation.x=Math.PI/2; pm.position.set(0,py-0.014,0); P.add(pm);
      const hanger=function(z,col){ const g=new THREE.Group(); g.position.set(0,py-0.03,z); P.group.add(g);
        const hook=new THREE.Mesh(new THREE.TorusGeometry(0.02,0.003,6,14,Math.PI*1.4),steel); hook.rotation.y=Math.PI/2; hook.position.y=0.005; g.add(hook);
        const arm=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.004,0.42),lam(0x8a6a4c,{roughness:0.6})); arm.position.y=-0.09; g.add(arm);
        const sh=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.62,0.44),env.fab(col)); sh.position.y=-0.42; sh.castShadow=true; g.add(sh);
        [-1,1].forEach(function(sd){ const sl=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.2,0.12),env.fab(col)); sl.position.set(0,-0.2,sd*0.27); sl.rotation.x=sd*0.25; g.add(sl); }); };
      if(!empty){ hanger(-L/2+0.2,0xdde6ee); hanger(-L/2+0.36,0xf2ece2); hanger(-L/2+0.52,0x9fb4c6); }
      const tw=new THREE.Mesh(empty?new THREE.BoxGeometry(0.04,0.3,0.2):new THREE.BoxGeometry(0.06,0.5,0.32),env.fab(0xe9d9c8)); tw.position.set(0,py-(empty?0.16:0.26),L/2-(empty?0.16:0.3)); tw.castShadow=true; P.add(tw);
      return P;
    };
    /* wall holder for an air-conditioner remote: a small white bracket at 1.3 m on the wall (x=0), the remote standing in it; front +x */
    Catalog.acRemote=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, y=1.3;
      P.box(0,0.004,-0.03,0.03,y-0.04,y+0.04,lam(0xf4f4f1,{roughness:0.4}),oc); P.box(0,0.022,-0.028,0.028,y-0.04,y-0.03,lam(0xf4f4f1,{roughness:0.4}),oc); [-1,1].forEach(function(sd){ P.box(0,0.022,sd*0.028-0.002,sd*0.028+0.002,y-0.04,y,lam(0xf4f4f1,{roughness:0.4}),oc); });
      P.box(0.006,0.022,-0.025,0.025,y-0.035,y+0.115,lam(0xf3f3f1,{roughness:0.4}),oc); P.box(0.022,0.023,-0.015,0.015,y+0.07,y+0.095,lam(0x2b4a6b),oc);
      [0,1,2].forEach(function(k){ P.cyl(0.022,-0.012+k*0.012,0.004,0.004,y+0.02,y+0.023,lam(0x8e9196),oc,8).rotation.z=Math.PI/2; });
      return P;
    };
    /* Dyson-style purifier humidifier, 31.2 cm round and 92.3 cm tall: clear water tank, gold perforated body, white loop amplifier */
    Catalog.airPurifier=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, r=0.156;
      const tank=lam(0xcfe3ee,{transparent:true,opacity:0.5,roughness:0.08,metalness:0.1,envMapIntensity:1.2}), gold=lam(0xc9a86a,{metalness:0.7,roughness:0.4,envMapIntensity:1}), silver=lam(0xc9ccd0,{metalness:0.85,roughness:0.3}), white=lam(0xf4f4f2,{roughness:0.3});
      P.cyl(0,0,r-0.004,r-0.004,0.0,0.03,silver,oc,36); P.cyl(0,0,r,r,0.03,0.14,tank,{},36); P.cyl(0,0,0.06,0.06,0.03,0.12,lam(0x9fb6c2,{roughness:0.3}),oc,20);   // tank with the pump inside
      P.cyl(0,0,r,r,0.14,0.16,silver,oc,36); P.cyl(0,0,r,r,0.16,0.38,gold,{},36); P.cyl(0,0,r,r,0.38,0.41,silver,oc,36);
      P.cyl(0,0,r,0.09,0.41,0.47,white,{},36); P.box(-0.02,0.02,-0.02,0.02,0.46,0.47,lam(0x1a1a1a),oc);                              // shoulder and the small display
      const stadium=function(w,h){ const sh=new THREE.Path(), r=w/2, k=h/2-r; sh.moveTo(-r,-k); sh.lineTo(-r,k); sh.absarc(0,k,r,Math.PI,0,true); sh.lineTo(r,-k); sh.absarc(0,-k,r,0,Math.PI,true); return sh; };   // straight sides, semicircular ends
      const loop=new THREE.Shape(stadium(0.2,0.45).getPoints(48)); loop.holes.push(new THREE.Path(stadium(0.146,0.396).getPoints(48).reverse()));
      const lg=new THREE.ExtrudeGeometry(loop,{depth:0.045,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:3,curveSegments:24}); lg.center(); const lm=new THREE.Mesh(lg,white); lm.rotation.y=Math.PI/2; lm.position.set(0,0.695,0); lm.castShadow=true; P.add(lm);
      [-1,1].forEach(function(sd){ P.box(-0.004,0.004,sd*0.07-0.003,sd*0.07+0.003,0.56,0.83,silver,oc); });                               // the slot trims inside the loop
      P._col(-r,r,-r,r,true); return P;
    };
    Catalog.worldMap=function(){
      const P=new Piece(), W=1.6, H=0.9, yc=1.5;
      if(!mapTex){
        const c=document.createElement('canvas'); c.width=1024; c.height=576; const g=c.getContext('2d');
        g.fillStyle='#e9eef0'; g.fillRect(0,0,1024,576);
        g.strokeStyle='rgba(60,80,100,.12)'; g.lineWidth=1; for(let i=1;i<12;i++){ g.beginPath(); g.moveTo(i*1024/12,0); g.lineTo(i*1024/12,576); g.stroke(); } for(let i=1;i<6;i++){ g.beginPath(); g.moveTo(0,i*96); g.lineTo(1024,i*96); g.stroke(); }
        const land=[ // rough continent outlines in an equirectangular 1024 x 576 frame
          [[95,95],[230,70],[330,90],[300,150],[255,175],[250,230],[210,250],[170,215],[120,190],[80,140]],                 // North America
          [[240,265],[290,265],[330,300],[315,370],[290,450],[265,470],[255,400],[240,330]],                                   // South America
          [[330,40],[400,30],[395,70],[350,80]],                                                                              // Greenland
          [[470,110],[560,90],[600,110],[575,150],[520,165],[480,150]],                                                        // Europe
          [[480,190],[560,180],[610,220],[600,300],[560,380],[530,390],[510,310],[470,250]],                                   // Africa
          [[580,80],[760,60],[900,90],[920,140],[860,190],[800,230],[740,250],[690,215],[640,180],[600,150]],                  // Asia
          [[720,250],[760,265],[745,300],[715,280]],                                                                          // SE Asia
          [[820,330],[900,320],[930,370],[880,410],[820,390]],                                                                 // Australia
          [[870,130],[885,120],[895,150],[880,170],[868,160]]                                                                  // Japan
        ];
        const cols=['#c8714f','#e0b184','#8fa58e','#7f9a86','#d9a3a0','#b98368','#e6c46f','#9fb4c6','#35506b'];
        land.forEach(function(poly,i){ g.fillStyle=cols[i]; g.beginPath(); poly.forEach(function(q,k){ if(k) g.lineTo(q[0],q[1]); else g.moveTo(q[0],q[1]); }); g.closePath(); g.fill(); });
        g.fillStyle='#35506b'; g.font='700 30px sans-serif'; g.fillText('WORLD',40,540);
        mapTex=new THREE.CanvasTexture(c); mapTex.colorSpace=THREE.SRGBColorSpace; mapTex.anisotropy=env.anisotropy;
      }
      P.box(0,0.025,-W/2,W/2,yc-H/2,yc+H/2,M.oak,{cast:false});
      const art=new THREE.Mesh(new THREE.PlaneGeometry(W-0.05,H-0.05),new THREE.MeshStandardMaterial({map:mapTex,roughness:0.85})); art.position.set(0.027,yc,0); art.rotation.y=Math.PI/2; P.add(art,{cast:false});
      return P;
    };
    /* robot vacuum (35 cm) parked on its charging dock; the dock's back is on -x. While .running (anims) it drives slow loops in front of the dock */
    /* Dreame X40 Ultra base station (auto water supply/drain kit), 34 W x 45.67 D x 59.05 H cm incl. the base plate, front +x; robot Ø35 x 10.4 cm.
       Inverted L: a white back column, the fluted-white-over-champagne-gold module cantilevered over the open docking bay. Catalog.robotBayOpen (set by a house) gates the lid */
    Catalog.dreameX40=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, D=0.4567, Wd=0.34, H=0.5905, xb=-D/2, xm=xb+0.33, z0=-Wd/2, z1=Wd/2, MB=0.24, MS=0.4337;
      const wh=lam(0xf6f6f4,{roughness:0.22}), gold=lam(0xcdb48c,{metalness:0.72,roughness:0.3}), dk=lam(0x2f3236,{roughness:0.6}), grey=lam(0xe4e5e3,{roughness:0.4}), oc2=oc;
      const label=function(txt,w,h,bg,fg,font){ const cv=document.createElement('canvas'); cv.width=256; cv.height=Math.max(16,Math.round(256*h/w)); const g=cv.getContext('2d'); g.fillStyle=bg; g.fillRect(0,0,cv.width,cv.height); g.fillStyle=fg; g.font=font; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,cv.width/2,cv.height/2+2);
        const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return lam(0xffffff,{map:t,roughness:0.3}); };
      /* base plate with a ribbed wash tray and a ramp lip */
      P.rbox(xb,xb+D,z0,z1,0,0.018,0.02,grey); for(let k=0;k<9;k++){ const x=xm+0.005+k*0.01; P.box(x,x+0.004,z0+0.05,z1-0.05,0.018,0.021,lam(0xcfd1cf,{roughness:0.5}),oc); } P.box(xb+D-0.012,xb+D,z0+0.02,z1-0.02,0.0,0.012,grey,oc);
      P.box(xb+0.12,xm,z0+0.03,z1-0.03,0.018,0.02,dk,oc); for(let k=0;k<14;k++){ const x=xb+0.13+k*0.014; P.box(x,x+0.005,z0+0.06,z1-0.06,0.02,0.023,lam(0x3c3f43,{roughness:0.5}),oc); }   // dark ribbed wash tray under the robot
      /* back column, the right-hand side wall, a slim neck at the back left */
      P.rbox(xb,xb+0.12,z0,z1,0.018,MB+0.01,0.03,wh); P.rbox(xb,xb+0.31,z0,z0+0.035,0.018,MB+0.01,0.015,wh); P.box(xb+0.11,xb+0.14,z1-0.04,z1-0.015,0.018,MB,wh);
      [0,1,2,3].forEach(function(k){ P.box(xb+0.02+k*0.022,xb+0.032+k*0.022,z0-0.001,z0,0.05,0.12,dk,oc); });   // side vents near the back bottom
      /* the module: gold lower 45 %, fluted white upper 55 %, rounded vertical corners */
      P.rbox(xb,xm,z0,z1,MB,MS,0.035,gold); P.rbox(xb,xm,z0,z1,MS,H-0.012,0.035,wh);
      for(let i=0;i<26;i++){ const z=z0+0.03+i*(Wd-0.06)/25; P.box(xm-0.0005,xm+0.0035,z-0.0022,z+0.0022,MS+0.008,H-0.022,wh,oc); }   // dense vertical flutes on the front
      [z0,z1].forEach(function(zz,s){ for(let i=0;i<12;i++){ const x=xb+0.04+i*0.022; P.box(x-0.0022,x+0.0022,s?zz-0.0005:zz-0.0035,s?zz+0.0035:zz+0.0005,MS+0.008,H-0.022,wh,oc); } });   // and round the sides
      P.box(xm+0.0035,xm+0.0045,-0.045,0.045,MS+0.008,MS+0.024,label('DREAME',0.09,0.016,'#f6f6f4','#b89d6c','bold 34px "Helvetica Neue",Arial,sans-serif'),oc);
      P.box(xm-0.002,xm+0.0005,z1-0.085,z1-0.025,H-0.07,H-0.058,label('X40 Ultra',0.06,0.012,'#f6f6f4','#9c8d72','600 40px "Helvetica Neue",Arial,sans-serif'),oc);
      [-1,1].forEach(function(sd){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.003,0.004,0.02),lam(0x8f7a55,{metalness:0.6,roughness:0.4})); m.position.set(xm+0.002,MB+0.022,sd*0.0075); m.rotation.x=sd*0.6; P.add(m,oc); });   // chevron
      /* top: a lid hinged at the back over two removable tanks; a touch strip at the front edge */
      const LID=new THREE.Group(); LID.position.set(xb,H-0.012,0); P.group.add(LID);
      const lg=new THREE.Mesh(new THREE.BoxGeometry(xm-xb-0.004,0.012,Wd-0.006),wh); lg.position.set((xm-xb)/2,0.006,0); lg.castShadow=true; LID.add(lg);
      const grip=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.004,0.08),lam(0xdadad7,{roughness:0.5})); grip.position.set(xm-xb-0.012,0.0125,0); LID.add(grip);
      [[-0.03,0x8fd6ff],[0.03,0xf6f6f4]].forEach(function(q){ const k=new THREE.Mesh(new THREE.CircleGeometry(0.006,14),new THREE.MeshBasicMaterial({color:q[1]})); k.rotation.x=-Math.PI/2; k.position.set(xm-xb-0.03,0.0126,q[0]); LID.add(k); });   // power / home touch keys
      P.box(xb+0.02,xm-0.02,z0+0.02,z1-0.02,H-0.06,H-0.013,dk,oc);   // dark inner rim
      const tank=function(zc,col,tr){ const G=new THREE.Group(); G.position.set(0,0,0); P.group.add(G); const m=new THREE.Mesh(new THREE.BoxGeometry(0.27,0.15,0.145),lam(col,{transparent:true,opacity:tr,roughness:0.15})); m.position.set(xb+0.035+0.135,H-0.088,zc); G.add(m);
        const hd=new THREE.Mesh(new THREE.TorusGeometry(0.03,0.006,6,16,Math.PI),lam(0xf2f2f0,{roughness:0.4})); hd.position.set(xb+0.17,H-0.013,zc); G.add(hd); return G; };
      tank(0.077,0x6b5440,0.6); const clean=tank(-0.077,0xd9dde0,0.45); P.box(xb+0.035,xb+0.305,-0.003,0.003,H-0.16,H-0.013,dk,oc);   // dirty (left), clean (right), divider
      [[-0.1,0x2f6fd1],[-0.04,0x2f6fd1]].forEach(function(q){ P.cyl(xb-0.008,q[0],0.008,0.008,0.1,0.13,lam(q[1],{roughness:0.4}),oc,10).rotation.z=Math.PI/2; P.group.children[P.group.children.length-1].position.set(xb-0.008,0.115,q[0]); });   // water-kit hose connectors at the back
      /* robot: white disc, a seam ring, champagne LiDAR cap toward the back, black front sensor window, a side brush, mop pads */
      const R=new THREE.Group(); P.group.add(R); const rx=xm+0.065-0.175;
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.175,0.173,0.075,48),lam(0xf8f8f6,{roughness:0.15})); body.position.y=0.025+0.0375; body.castShadow=true; R.add(body);
      const sr=new THREE.Mesh(new THREE.TorusGeometry(0.145,0.0015,4,48),lam(0xc9cbc8)); sr.rotation.x=Math.PI/2; sr.position.y=0.1; R.add(sr);
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.042,0.018,28),gold); cap.position.set(-0.06,0.109,0); R.add(cap);
      const win=new THREE.Mesh(new THREE.CylinderGeometry(0.176,0.176,0.03,40,1,true,-0.75,1.5),lam(0x15171a,{roughness:0.1,metalness:0.2})); win.position.y=0.06; R.add(win);
      const cam=new THREE.Mesh(new THREE.CircleGeometry(0.008,12),lam(0x2b4a7a,{roughness:0.05})); cam.position.set(0.1765,0.065,0); cam.rotation.y=Math.PI/2; R.add(cam);
      [0,1,2].forEach(function(k){ const a=k*Math.PI*2/3, br=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.002,0.005),dk); br.position.set(0.13+Math.cos(a)*0.035,0.024,-0.1+Math.sin(a)*0.035); br.rotation.y=a; R.add(br); });   // side brush at the front right
      [-1,1].forEach(function(sd){ const mp=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.008,24),lam(0x9a9d9f,{roughness:0.9})); mp.position.set(-0.07,0.021,sd*0.07); R.add(mp); });
      const led=new THREE.Mesh(new THREE.SphereGeometry(0.005,8,6),new THREE.MeshBasicMaterial({color:0x4de08a})); led.position.set(0.02,0.1,0.05); R.add(led);
      const home=rx; R.position.x=home;
      let run=false, t0=0, last=0, lidT=0, lidW=0, lidL=null, tkT=0, tkW=0, tkL=null;
      P.anims.push(function(t){ last=t; if(!run){ if(R.position.x!==home){ R.position.set(home,0,0); R.rotation.y=0; return true; } return false; }
        const e=t-t0, a=e*0.5; R.position.set(home+0.25+0.9*Math.sin(a*0.5)*(1+0.3*Math.sin(a*1.7)),0,0.9*Math.sin(a)*Math.cos(a*0.3)); R.rotation.y=-a*1.3; if(e>40) run=false; return true; });
      const ease1=function(v,w,l,t,sp){ if(v===w) return [v,null]; if(l===null) l=t; const dt=Math.min(0.05,t-l); return [Math.abs(w-v)<dt*sp?w:v+Math.sign(w-v)*dt*sp,t]; };
      P.anims.push(function(t){ if(lidT===lidW&&tkT===tkW) return false; let r=ease1(lidT,lidW,lidL,t,1.4); lidT=r[0]; lidL=r[1]; LID.rotation.z=1.66*lidT; r=ease1(tkT,tkW,tkL,t,1.6); tkT=r[0]; tkL=r[1]; clean.position.y=0.2*tkT; return true; });   // lid swings up to about 95 deg
      const bayOpen=function(){ return !Catalog.robotBayOpen||Catalog.robotBayOpen(); };
      P.actions=[{x:0.7,z:0,label:function(){ return run?'Dreame X40 Ultra：回基地':'Dreame X40 Ultra：開始打掃'; },act:function(){ run=!run; t0=last; }},
        {x:0.55,z:0.1,on:function(){ return bayOpen()&&!run&&tkW===0; },label:function(){ return lidW?'蓋上基地上蓋（Dreame X40 Ultra）':'打開基地上蓋（Dreame X40 Ultra）'; },act:function(){ lidW=lidW?0:1; }},
        {x:0.55,z:-0.1,on:function(){ return bayOpen()&&lidT>0.95; },label:function(){ return tkW?'放回清水箱':'取出清水箱'; },act:function(){ tkW=tkW?0:1; }}];
      P._col(xb,xb+D,z0,z1,true);
      return P;
    };
    Catalog.robotVacuum=function(){
      const P=new Piece(), lam=env.lam, wh=lam(0xf2f2f0,{roughness:0.3}), dk=lam(0x1d1f22,{roughness:0.3});
      P.box(-0.08,0.0,-0.17,0.17,0,0.32,wh); P.box(-0.0,0.005,-0.06,0.06,0.2,0.24,dk,{cast:false}); P.box(-0.0,0.12,-0.16,0.16,0,0.01,lam(0xd0d2d4),{cast:false});
      const R=new THREE.Group(); R.position.set(0.18,0,0); P.group.add(R);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(0.175,0.175,0.09,32),wh); body.position.y=0.055; body.castShadow=true; R.add(body);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.02,20),dk); top.position.set(0.04,0.105,0); R.add(top);
      const bump=new THREE.Mesh(new THREE.CylinderGeometry(0.177,0.177,0.03,32,1,true,-1.1,2.2),dk); bump.position.y=0.04; R.add(bump);
      const led=new THREE.Mesh(new THREE.SphereGeometry(0.006,8,6),new THREE.MeshBasicMaterial({color:0x4de08a})); led.position.set(0.12,0.101,0); R.add(led);
      let run=false, t0=0, last=0;
      P.anims.push(function(t){ last=t; if(!run){ if(R.position.x!==0.18){ R.position.set(0.18,0,0); R.rotation.y=0; return true; } return false; }
        const e=t-t0, a=e*0.5; R.position.set(0.18+0.9*Math.sin(a*0.5)*(1+0.3*Math.sin(a*1.7)),0,0.9*Math.sin(a)*Math.cos(a*0.3)); R.rotation.y=-a*1.3;
        led.material.color.setHex(Math.floor(e*2)%2?0x4de08a:0x2a7a4a); if(e>40){ run=false; } return true; });
      P.actions=[{x:0.6,z:0,label:function(){ return run?'掃地機器人：回基地':'掃地機器人：開始打掃'; },act:function(){ run=!run; t0=last; }}];
      P._col(-0.08,0.35,-0.18,0.18,false);
      return P;
    };
    /* slim cleaning cupboard 40 x 35 x 180 cm (broom, mop, spare bags); doors +x */
    Catalog.broomCabinet=function(){
      const P=new Piece();
      P.box(-0.175,0.16,-0.2,0.2,legClear,1.8,M.cabF); P.box(-0.16,0.14,-0.19,0.19,0,legClear,M.dark,{cast:false});
      P.cabDoors('z',-0.2,0.2,0.16,1,legClear+0.01,1.79,1,false);
      P._col(-0.175,0.175,-0.2,0.2,true); return P;
    };
    /* three sorting bins (燃える / プラ / 缶・ビン) 25 cm wide each with coloured lids; front +x */
    /* pair of slim pedal bins (burnable / recycling), 2 x 30 cm, matte warm grey with oak lids, soft-close pedals and colour badges; front +x */
    Catalog.binsDuo=function(){
      const P=new Piece(), lam=env.lam, body=lam(0x8f8a82,{roughness:0.55,metalness:0.25}), dark=lam(0x2a2826,{roughness:0.5});
      [[-0.16,0x6f9a4e],[0.16,0x5f8fc9]].forEach(function(b){ const z=b[0];
        P.rbox(-0.17,0.17,z-0.145,z+0.145,0.02,0.64,0.03,body); P.rbox(-0.175,0.175,z-0.15,z+0.15,0.64,0.665,0.02,M.oak);
        P.box(-0.168,0.168,z-0.143,z+0.143,0,0.02,dark,{cast:false}); P.box(0.17,0.2,z-0.05,z+0.05,0,0.03,dark);
        P.box(0.17,0.174,z-0.03,z+0.03,0.52,0.56,lam(b[1],{roughness:0.4}),{cast:false});
      });
      P._col(-0.2,0.2,-0.31,0.31,true); return P;
    };
    Catalog.trashBins=function(){
      const P=new Piece(), lam=env.lam, body=lam(0xe9e7e2,{roughness:0.4});
      [[-0.27,0x6f9a4e],[0,0x5f8fc9],[0.27,0xd8a23a]].forEach(function(b){
        P.rbox(-0.18,0.18,b[0]-0.12,b[0]+0.12,0,0.62,0.02,body); P.rbox(-0.185,0.185,b[0]-0.125,b[0]+0.125,0.62,0.66,0.015,lam(b[1],{roughness:0.4}));
        P.box(0.18,0.185,b[0]-0.05,b[0]+0.05,0.5,0.56,lam(b[1]),{cast:false});
      });
      P._col(-0.18,0.18,-0.4,0.4,true); return P;
    };
    /* emergency stockpile rack 90 x 40 x 180 cm: water cases, food boxes, helmet, lantern, first-aid kit; open front +x */
    Catalog.stockShelf=function(){
      const P=new Piece(), lam=env.lam, rnd=env.rnd, steel=lam(0xd8dadc,{metalness:0.5,roughness:0.4});
      [legClear,0.55,1.0,1.42,1.8].forEach(function(y){ P.box(-0.2,0.2,-0.45,0.45,y,y+0.02,steel); });
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.box(c[0]*0.19-0.012,c[0]*0.19+0.012,c[1]*0.44-0.012,c[1]*0.44+0.012,0,1.82,steel,{cast:false}); });
      const water=lam(0x5fa8d8,{roughness:0.4}), card=lam(0xc9a87a,{roughness:0.9});
      for(let i=0;i<3;i++){ P.box(-0.18,0.16,-0.42+i*0.29,-0.16+i*0.29,legClear+0.02,legClear+0.3,card); P.box(0.161,0.163,-0.4+i*0.29,-0.18+i*0.29,legClear+0.1,legClear+0.22,water,{cast:false}); }
      for(let i=0;i<4;i++) P.box(-0.17,0.15,-0.42+i*0.21,-0.25+i*0.21,0.57,0.57+0.18+rnd()*0.08,lam([0xd8453c,0xe8c84a,0xf4f1ea,0x6f9a4e][i],{roughness:0.8}));
      const helmet=new THREE.Mesh(new THREE.SphereGeometry(0.13,20,12,0,TAU,0,Math.PI/2),lam(0xf2f2f0,{roughness:0.3})); helmet.position.set(0,1.02,-0.25); P.add(helmet);
      P.cyl(0,0.2,0.06,0.07,1.02,1.25,lam(0x2a2d31),{},14); P.cyl(0,0.2,0.05,0.05,1.1,1.2,lam(0xfff4d8,{emissive:0x806a40}),{cast:false},14);   // lantern
      P.box(-0.12,0.14,-0.35,0.05,1.44,1.62,lam(0xd8453c,{roughness:0.6})); P.box(0.141,0.143,-0.2,-0.1,1.5,1.56,lam(0xffffff),{cast:false}); P.box(0.141,0.143,-0.17,-0.13,1.47,1.59,lam(0xffffff),{cast:false});   // first-aid kit
      [0.55,1.0,1.42].forEach(function(y){ P.box(0.19,0.2,-0.44,0.44,y+0.07,y+0.085,steel,{cast:false}); });   // anti-fall rails on the shelf fronts
      [-0.3,0.3].forEach(function(z){ P.box(-0.205,-0.199,z-0.025,z+0.025,1.8,1.9,steel,{cast:false}); P.box(-0.2,-0.13,z-0.025,z+0.025,1.82,1.826,steel,{cast:false}); });   // L-brackets screwing the top to the wall
      P._col(-0.2,0.2,-0.45,0.45,true); return P;
    };
    /* cat pantry: 70 cm steel rack with kibble bags, stacked cans, pouch boxes and litter bags; front +x */
    Catalog.catPantry=function(){
      const P=new Piece(), lam=env.lam, rnd=env.rnd, steel=lam(0xd8dadc,{metalness:0.5,roughness:0.4}), oc={cast:false};
      [legClear,0.55,1.0,1.48].forEach(function(y){ P.box(-0.175,0.175,-0.35,0.35,y,y+0.02,steel); });
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.box(c[0]*0.165-0.012,c[0]*0.165+0.012,c[1]*0.34-0.012,c[1]*0.34+0.012,0,1.5,steel,oc); });
      [[0xe6dcc4,0x7aa86a],[0xe6dcc4,0x6f8fc0]].forEach(function(c,i){ const z=-0.33+i*0.34, y=legClear+0.02;   // litter bags
        P.rbox(-0.15,0.15,z,z+0.3,y,y+0.36,0.03,lam(c[0],{roughness:0.85})); P.box(0.151,0.153,z+0.04,z+0.26,y+0.12,y+0.26,lam(c[1],{roughness:0.7}),oc); });
      [0xe0812f,0x7a4fa0,0x2f8f8a].forEach(function(c,i){ const z=-0.32+i*0.215, y=0.57;   // kibble bags standing up
        P.rbox(-0.06,0.08,z,z+0.19,y,y+0.34,0.015,lam(c,{roughness:0.55})); P.box(0.081,0.083,z+0.03,z+0.16,y+0.1,y+0.22,lam(0xf6f1e6),oc); });
      const can=lam(0xc8ccd0,{metalness:0.7,roughness:0.35}), lbl=[0xf0c24a,0xd94d4d,0x4f8fd6,0x6fbf73];
      for(let r=0;r<2;r++) for(let k=0;k<4;k++) for(let h=0;h<4;h++){ const x=-0.1+r*0.09, z=-0.3+k*0.085, y=1.02+h*0.042;   // stacked cans
        P.cyl(x,z,0.034,0.034,y,y+0.04,can,oc,14); P.cyl(x,z,0.0345,0.0345,y+0.008,y+0.032,lam(lbl[(k+h)%4],{roughness:0.5}),oc,14); }
      P.box(-0.15,0.13,0.04,0.32,1.02,1.2,lam(0xc9a87a,{roughness:0.9})); P.box(0.131,0.133,0.08,0.28,1.08,1.15,lam(0xe0812f),oc);   // pouch box
      P.cyl(-0.05,-0.2,0.07,0.07,1.5,1.68,lam(0xf4f1ea,{roughness:0.4}),{},16); P.cyl(-0.05,-0.2,0.072,0.072,1.68,1.7,lam(0xe0812f),oc,16);   // treat jar
      P.box(-0.14,0.12,0.0,0.3,1.5,1.62,lam(0xc9a87a,{roughness:0.9}));
      [0.55,1.0,1.48].forEach(function(y){ P.box(0.165,0.175,-0.34,0.34,y+0.06,y+0.072,steel,oc); });   // anti-fall rails
      [-0.25,0.25].forEach(function(z){ P.box(-0.18,-0.174,z-0.025,z+0.025,1.42,1.52,steel,oc); P.box(-0.175,-0.11,z-0.025,z+0.025,1.5,1.506,steel,oc); });   // wall brackets
      P._col(-0.175,0.175,-0.35,0.35,true); return P;
    };
    /* humidifier tower (hybrid type, 24 x 24 x 55 cm), stored in the off season; front +x */
    Catalog.humidifier=function(){
      const P=new Piece(), lam=env.lam, wht=lam(0xf4f4f2,{roughness:0.35});
      P.rbox(-0.12,0.12,-0.12,0.12,0.015,0.55,0.06,wht);
      P.rbox(0.05,0.122,-0.08,0.08,0.06,0.3,0.02,lam(0xa8d4ec,{transparent:true,opacity:0.75,roughness:0.1}));
      P.cyl(0,0,0.07,0.07,0.55,0.556,lam(0x8d939a),{cast:false},20); P.box(0.06,0.09,-0.03,0.03,0.553,0.557,lam(0x9fd6ff,{emissive:0x3a90d0}),{cast:false});
      P._col(-0.12,0.12,-0.12,0.12,true); return P;
    };
    /* living fan (DC, 1 m tall); faces +x */
    Catalog.fan=function(){
      const P=new Piece(), lam=env.lam, wh=lam(0xf2f2f0,{roughness:0.35});
      P.cyl(0,0,0.16,0.17,0,0.04,wh,{},24); P.cyl(0,0,0.015,0.015,0.04,0.82,wh,{},10);
      const H=new THREE.Group(); H.position.set(0,0.92,0); P.group.add(H);
      const guard=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.008,8,32),wh); guard.rotation.y=Math.PI/2; guard.position.x=0.03; H.add(guard);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.12,16),wh); hub.rotation.z=Math.PI/2; hub.position.x=-0.02; H.add(hub);
      const blades=new THREE.Group(); blades.position.x=0.03; H.add(blades);
      for(let i=0;i<5;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.14,0.06),lam(0xdfe9ef,{transparent:true,opacity:0.7})); b.position.set(0,Math.cos(i*TAU/5)*0.08,Math.sin(i*TAU/5)*0.08); b.rotation.x=i*TAU/5; blades.add(b); }
      for(let i=0;i<12;i++){ const r=new THREE.Mesh(new THREE.BoxGeometry(0.003,0.34,0.003),wh); r.position.x=0.05; r.rotation.x=i*Math.PI/12; H.add(r); }
      P.anims.push(function(t){ blades.rotation.x=t*14; H.rotation.y=Math.sin(t*0.4)*0.6; return false; });
      P._col(-0.17,0.17,-0.17,0.17,false); return P;
    };
    /* dehumidifier / humidifier 35 x 25 x 60 cm with a tank window; front +x */
    Catalog.dehumidifier=function(){
      const P=new Piece(), lam=env.lam;
      P.rbox(-0.125,0.125,-0.175,0.175,0.02,0.6,0.04,lam(0xf2f2f0,{roughness:0.35}));
      P.box(0.126,0.128,-0.12,0.12,0.08,0.3,lam(0xb8d8e8,{transparent:true,opacity:0.7,roughness:0.1}),{cast:false});
      P.box(-0.1,0.1,-0.14,0.14,0.601,0.606,lam(0x9aa0a6),{cast:false}); P.box(0.02,0.06,-0.06,0.06,0.606,0.608,lam(0x9fd6ff,{emissive:0x4aa8e8}),{cast:false});
      [-1,1].forEach(function(sd){ P.cyl(sd*0.08,sd*0.12,0.02,0.02,0,0.02,M.dark,{cast:false},10); });
      P._col(-0.125,0.125,-0.175,0.175,false); return P;
    };
    /* folding party table 1.8 x 0.9 m with six folding chairs: folded flat against the wall, or opened for guests and board games; the wall is on -x.
       Action: 展開 / 收起 */
    Catalog.foldTable=function(){
      const P=new Piece(), lam=env.lam, top=M.oak, frame=lam(0xd8dadc,{metalness:0.5,roughness:0.35});
      const T=new THREE.Group(); P.group.add(T);
      const mk=function(par,geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; par.add(m); return m; };
      const tab=mk(T,new THREE.BoxGeometry(0.9,0.03,1.8),top,0,0,0);
      const legs=[]; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ legs.push({m:mk(T,new THREE.BoxGeometry(0.03,0.7,0.03),frame,c[0]*0.4,-0.35,c[1]*0.85),c:c}); });
      const chairs=[];
      for(let i=0;i<6;i++){ const C=new THREE.Group(); P.group.add(C);
        mk(C,new THREE.BoxGeometry(0.4,0.02,0.4),lam(0x4a4f4a,{roughness:0.6}),0,0.45,0); mk(C,new THREE.BoxGeometry(0.03,0.3,0.4),lam(0x4a4f4a,{roughness:0.6}),-0.2,0.75,0);
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ mk(C,new THREE.BoxGeometry(0.02,0.45,0.02),frame,c[0]*0.18,0.225,c[1]*0.18); });
        chairs.push(C); }
      const seats=[[0.72,-0.55,0],[0.72,0,0],[0.72,0.55,0],[1.98,-0.55,Math.PI],[1.98,0,Math.PI],[1.98,0.55,Math.PI]];
      const pose=function(e){
        /* folded: table top standing on edge against the wall (5 cm out), chairs folded flat beside it; open: table 1.35 m out from the wall */
        T.position.set(0.04+1.31*e,0.45+0.27*e,0); T.rotation.z=(1-e)*Math.PI/2;
        legs.forEach(function(l){ l.m.scale.y=0.05+0.95*e; l.m.position.y=-0.35*(0.05+0.95*e); });
        chairs.forEach(function(C,i){ const s=seats[i];
          if(e>0.5){ C.position.set(s[0],0,s[1]); C.rotation.y=s[2]; C.scale.set(1,1,1); }      // set around the table
          else { C.position.set(0.1+0.06*i,0,-1.2); C.rotation.y=0; C.scale.set(0.12,1,1); } });  // folded flat, leaning on the wall beside the table
      };
      const st=stepper(1.0,pose); pose(0);
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:0.7,z:0,label:function(){ return st.target?'收起摺疊桌':'展開大餐桌'; },act:function(){ st.target=st.target?0:1; }}];
      P.open={get table(){ return !!st.target; },set table(v){ st.target=v?1:0; }};
      P.cols.push({x0:0,x1:0.1,z0:-0.9,z1:0.9,kind:'f'});
      return P;
    };
    /* baby crib 1.2 x 0.7 m on castors with slatted sides and a mobile; long side along z */
    Catalog.babyCrib=function(){
      const P=new Piece(), lam=env.lam, wood=lam(0xf4efe6,{roughness:0.5});
      P.box(-0.35,0.35,-0.6,0.6,0.38,0.42,wood); P.rb(0,0,0.66,1.16,0.1,0.04,M.bedA,0.42,false);
      [-1,1].forEach(function(sd){ P.box(-0.36,0.36,sd*0.6-0.02,sd*0.6+0.02,0.12,1.0,wood); P.box(sd*0.35-0.015,sd*0.35+0.015,-0.6,0.6,0.92,0.96,wood);
        for(let i=0;i<14;i++) P.box(sd*0.35-0.008,sd*0.35+0.008,-0.55+i*0.0846-0.01,-0.55+i*0.0846+0.01,0.42,0.92,wood,{cast:false}); });
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.cyl(c[0]*0.32,c[1]*0.56,0.03,0.03,0,0.06,M.dark,{cast:false},10); P.box(c[0]*0.33-0.02,c[0]*0.33+0.02,c[1]*0.58-0.02,c[1]*0.58+0.02,0.06,0.12,wood); });
      P.cyl(0.33,0.58,0.008,0.008,0.96,1.5,wood,{cast:false},6);
      [0xf2c46b,0x9fb4c6,0xe0b184,0x8fa58e].forEach(function(c,i){ const a=i*TAU/4; const m=new THREE.Mesh(new THREE.SphereGeometry(0.035,10,8),lam(c)); m.position.set(0.15+Math.cos(a)*0.12,1.32,0.4+Math.sin(a)*0.12); P.add(m,{cast:false}); });
      P.rb(-0.05,0.1,0.25,0.2,0.08,0.06,M.pillow,0.52,false);
      P._col(-0.36,0.36,-0.62,0.62,true); return P;
    };
    /* low two-tier bookshelf 80 x 30 x 75 cm; front +x */
    Catalog.smallBookshelf=function(){
      const P=new Piece(), rnd=env.rnd, lam=env.lam;
      P.box(-0.15,0.15,-0.4,-0.38,0,0.75,M.oak); P.box(-0.15,0.15,0.38,0.4,0,0.75,M.oak); P.box(-0.15,-0.13,-0.4,0.4,0,0.75,M.oak);
      [legClear,0.42,0.73].forEach(function(y){ P.box(-0.15,0.15,-0.4,0.4,y,y+0.02,M.oak); });
      const bm=[0x8d6a47,0x5f6f82,0xb26b5a,0xd8d2c6,0x3f4a58,0x8a9a86,0xc9b27f];
      [legClear+0.02,0.44].forEach(function(y){ let z=-0.36; while(z<0.3){ const w=0.025+rnd()*0.02, h=0.2+rnd()*0.07; P.box(-0.12,0.12,z,z+w,y,y+h,lam(bm[Math.floor(rnd()*7)],{roughness:0.8}),{cast:false}); z+=w+0.003; } });
      P._col(-0.15,0.15,-0.4,0.4,true); return P;
    };
    /* two-person home sauna (W 1.2 x D 1.05 x H 1.95 m), hemlock panels, glass door on +x, benches, heater and a warm light */
    let cedarT=null;
    function cedarTex(){                          // cedar tongue-and-groove lining, one metre per tile: 11 boards with dark joints and a light grain
      if(cedarT) return cedarT;
      const c=document.createElement('canvas'); c.width=c.height=512; const g=c.getContext('2d'); let seed=5; const rnd=function(){ seed=(seed*16807)%2147483647; return seed/2147483647; };
      const n=11, bh=512/n; for(let i=0;i<n;i++){ const y=i*bh, tone=200+Math.floor(rnd()*30); g.fillStyle='rgb('+(tone+20)+','+(tone-20)+','+(tone-70)+')'; g.fillRect(0,y,512,bh);
        for(let k=0;k<26;k++){ g.strokeStyle='rgba(120,80,40,'+(0.05+rnd()*0.1)+')'; g.lineWidth=0.6+rnd()*1.4; const yy=y+2+rnd()*(bh-4), ph=rnd()*6; g.beginPath(); for(let x=0;x<=512;x+=32){ const v=yy+Math.sin(x/120+ph)*1.5; if(x) g.lineTo(x,v); else g.moveTo(x,v); } g.stroke(); }
        g.fillStyle='rgba(70,45,25,0.55)'; g.fillRect(0,y+bh-2.5,512,2.5); g.fillStyle='rgba(255,240,210,0.25)'; g.fillRect(0,y,512,1.5); }
      cedarT=new THREE.CanvasTexture(c); cedarT.colorSpace=THREE.SRGBColorSpace; cedarT.wrapS=cedarT.wrapT=THREE.RepeatWrapping; cedarT.anisotropy=env.anisotropy; return cedarT;
    }
    Catalog.homeSauna=function(o){                 // o.depth: outside depth behind the 1.2 m glass front; o.flip: door on the +z half; o.hingeIn: hinged at the centre mullion
      o=o||{};
      const P=new Piece(), lam=env.lam, wood=lam(0xffffff,{roughness:0.7,map:cedarTex()}), dark=lam(0xc9a776,{roughness:0.65}), oc={cast:false};
      const W=(o.width||1.2)/2, D=(o.depth||1.05)/2, H=1.95, t=0.05, f=o.flip?-1:1, BD=o.benchD||0.5;
      P.box(-D,-D+t,-W,W,0,H,wood); P.box(-D,D,-W,-W+t,0,H,wood); P.box(-D,D,W-t,W,0,H,wood); P.box(-D,D,-W,W,H-t,H,wood); P.box(-D,D,-W,W,0,0.04,dark);
      const bronze=lam(0x6f4a2a,{transparent:true,opacity:0.35,roughness:0.05});                                    // full-height bronze glass front: door on the -z half (flip: +z), fixed pane on the other
      const dw=o.doorW||0.53, uo=W-0.05, ui=uo-dw, zu=function(u){ return -f*u; }, zr=function(a,b){ return [Math.min(zu(a),zu(b)),Math.max(zu(a),zu(b))]; };   // u: distance toward the door side
      const mull=zr(ui-0.04,ui), pane=zr(-uo,ui-0.04), door=zr(ui,uo);
      P.box(D-t,D,-W,-W+0.05,0,H,wood); P.box(D-t,D,W-0.05,W,0,H,wood); P.box(D-t,D,-W,W,1.88,H,wood); P.box(D-t,D,mull[0],mull[1],0.04,1.88,wood);
      P.box(D-0.02,D-0.01,pane[0],pane[1],0.04,1.88,bronze,oc);
      const du=o.hingeIn?1:-1, dp=new THREE.Group(); dp.position.set(D-0.015,0,zu(o.hingeIn?ui:uo)); P.group.add(dp); P.doorPivot=dp; P.doorTh=-f*du*Math.PI/2;   // hinged at the mullion or the outer post, opens outward
      const dg=new THREE.Mesh(new THREE.BoxGeometry(0.01,1.84,dw-0.02),bronze); dg.position.set(0,0.96,zu(0)+(-f*du)*(dw-0.02)/2); dp.add(dg);
      const dh=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.4,0.02),M.steel); dh.position.set(0.02,1.0,(-f*du)*(dw-0.07)); dp.add(dh); const dh2=dh.clone(); dh2.position.x=-0.02; dp.add(dh2);
      P.doorRect=[D-0.03,D+0.01,door[0],door[1]];
      const inner=lam(0xe0c293,{roughness:0.75,map:cedarTex()}), e=0.004;                                                          // darker lining: point lights are not occluded by the cabin walls
      P.box(-D+t,-D+t+e,-W+t,W-t,0.04,H-t,inner,oc); P.box(-D+t,D-t,-W+t,-W+t+e,0.04,H-t,inner,oc); P.box(-D+t,D-t,W-t-e,W-t,0.04,H-t,inner,oc); P.box(-D+t,D-t,-W+t,W-t,H-t-e,H-t,inner,oc);
      const heaterM=lam(0x2a2d31,{roughness:0.5}), stone=function(x,z){ const s=new THREE.Mesh(new THREE.IcosahedronGeometry(0.035,0),lam(0x6b6b6b,{roughness:0.9})); s.position.set(x,0.68,z); P.add(s,oc); };
      if(D>0.6){                                   // deep cabin: bench along the long wall opposite the door, heater in the far corner on the door side
        const zw=f*(W-t), zb=f*(W-t-BD), hz=-f*(W-t), hz1=-f*(W-t-0.18);
        const bz0=Math.min(zw,zb), bz1=Math.max(zw,zb), bx0=-D+t, bx1=D-t-0.03;                                   // slatted bench: 7 cm abachi slats on two bearers, a slatted backrest, a low foot step
        const zf=zb, zfr=zf-f*0.02;   // seat: closely spaced slats on a boxed frame — solid end panels, a front fascia and a centre support
        const NS=Math.round((BD-0.02)/0.08); for(let k=0;k<NS;k++){ const za=zw-f*(0.01+k*(BD-0.02)/NS), zz=za-f*((BD-0.02)/NS-0.008); P.rbox(bx0,bx1,Math.min(za,zz),Math.max(za,zz),0.455,0.49,0.008,dark); }
        [bx0,bx1-0.025,(bx0+bx1)/2-0.0125].forEach(function(x,i){ P.box(x,x+0.025,Math.min(zw,zfr),Math.max(zw,zfr),0.06,0.455,dark,i<2?{}:oc); });
        P.box(bx0,bx1,Math.min(zf,zfr),Math.max(zf,zfr),0.36,0.455,dark); P.box(bx0+0.02,bx1-0.02,Math.min(zw,zfr),Math.max(zw,zfr),0.04,0.06,lam(0x8a6a4c,{roughness:0.8}),oc);   // fascia and a recessed plinth
        const bkM=lam(0xd2b07c,{roughness:0.55});   // backrest: five 7 cm slats on angled battens, 9 cm off the wall at the bottom, 2 cm at the top
        for(let k=0;k<5;k++){ const y=0.6+k*0.088, off=0.09-0.07*k/4, m=P.rbox(bx0+0.005,bx1-0.005,Math.min(zw,zw-f*0.02),Math.max(zw,zw-f*0.02),y,y+0.07,0.008,bkM); m.position.z-=f*off; }
        [bx0+0.05,(bx0+bx1)/2,bx1-0.07].forEach(function(x){ const bt=P.box(x,x+0.02,Math.min(zw,zw-f*0.03),Math.max(zw,zw-f*0.03),0.58,1.02,dark,oc); bt.rotation.x=f*0.17; bt.position.z-=f*0.045; });   // battens behind the slats
        P.box(bx0,bx1,Math.min(hz,hz1)+(f>0?0:0.18),Math.max(hz,hz1)+(f>0?-0.18:0),0.2,0.23,dark);                     // foot step on the far side (slat)
        /* stove: steel body in the corner, a basket heaped with rounded stones, a slatted cedar guard on the two open sides */
        const hx0=-D+t+0.04, hx1=hx0+0.3, hzB=hz+f*0.3, hz0=Math.min(hz,hzB), hz9=Math.max(hz,hzB), hzc=(hz0+hz9)/2, hxc=(hx0+hx1)/2, steel=lam(0x3a3d42,{metalness:0.6,roughness:0.35}), slot=lam(0x15161a,{roughness:0.6});
        P.rbox(hx0,hx1,hz0,hz9,0.1,0.58,0.015,steel);
        for(let k=0;k<5;k++) P.box(hx1,hx1+0.003,hz0+0.05,hz9-0.05,0.2+k*0.05,0.214+k*0.05,slot,oc);                                   // vents
        P.box(hx1,hx1+0.004,hzc-0.04,hzc+0.04,0.48,0.54,slot,oc); P.box(hx1+0.004,hx1+0.006,hzc+0.02,hzc+0.03,0.505,0.515,lam(0xff5a2a,{emissive:0xff3a10,emissiveIntensity:1.5}),oc);   // control panel
        [[hx0,hz0],[hx1,hz0],[hx0,hz9],[hx1,hz9]].forEach(function(q){ P.box(q[0]-0.006,q[0]+0.006,q[1]-0.006,q[1]+0.006,0.58,0.74,steel,oc); });
        [[hx0,hx1,hz0,hz0],[hx0,hx1,hz9,hz9],[hx0,hx0,hz0,hz9],[hx1,hx1,hz0,hz9]].forEach(function(q){ P.box(q[0]-0.004,q[1]+0.004,q[2]-0.004,q[3]+0.004,0.7,0.712,steel,oc); });   // basket rim
        let sd=7; const rnd=function(){ sd=(sd*16807)%2147483647; return sd/2147483647; }, stoneC=[0x6b6b6b,0x5d5a55,0x7a746b,0x4e4c4a,0x8a8378,0x66615a];
        for(let k=0;k<70;k++){ const u=rnd(), v=rnd(), x=hx0+0.03+u*0.24, z=hz0+0.03+v*0.24, cen=1-Math.hypot(u-0.5,v-0.5)*1.6, r=0.022+rnd()*0.022;
          const st=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),lam(stoneC[k%stoneC.length],{roughness:0.95})); st.scale.set(0.85+rnd()*0.35,0.7+rnd()*0.3,0.85+rnd()*0.35);
          st.rotation.set(rnd()*3,rnd()*3,rnd()*3); st.position.set(x,0.6+Math.max(0,cen)*0.2+rnd()*0.04,z); st.castShadow=true; P.add(st,oc); }
        const gx=hx1+0.03, gz=f>0?hz9+0.03:hz0-0.03, gy0=0.12, gy1=0.6; const guardW=lam(0xc99a62,{roughness:0.6});   // guard hugs the stove
        for(let z=hz0;z<=hz9+0.04;z+=0.05) P.box(gx-0.01,gx+0.01,z,z+0.028,gy0,gy1,guardW,oc);                                             // guard slats in front of the stove
        for(let x=hx0;x<=gx-0.02;x+=0.05) P.box(x,x+0.028,gz-0.01,gz+0.01,gy0,gy1,guardW,oc);                                             // and on the bench side
        [gy0,gy1-0.04].forEach(function(y){ P.box(gx-0.015,gx+0.015,Math.min(hz,gz),Math.max(hz,gz),y,y+0.04,guardW); P.box(hx0-0.02,gx+0.015,gz-0.015,gz+0.015,y,y+0.04,guardW); });   // rails
        /* sauna 12-minute timer and a round dial thermometer on the stove wall, facing the bench */
        const dial=function(x,y,r,draw,rimM){ const G=new THREE.Group(); G.position.set(x,y,hz+f*0.006); if(f<0) G.rotation.y=Math.PI; P.group.add(G);
          const c=document.createElement('canvas'); c.width=c.height=256; draw(c.getContext('2d')); const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace;
          const back=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.02,40),rimM); back.rotation.x=Math.PI/2; back.position.z=0.01; G.add(back);
          const face=new THREE.Mesh(new THREE.CircleGeometry(r-0.006,48),new THREE.MeshBasicMaterial({map:tx})); face.position.z=0.021; G.add(face);
          const rim=new THREE.Mesh(new THREE.TorusGeometry(r-0.003,0.006,8,48),rimM); rim.position.z=0.022; G.add(rim); return G; };
        const ticks=function(g,n,a0,a1,len,every,w){ for(let k=0;k<=n;k++){ const a=a0+(a1-a0)*k/n; g.lineWidth=k%every?w:w*2.2; g.beginPath(); g.moveTo(128+Math.sin(a)*112,128-Math.cos(a)*112); g.lineTo(128+Math.sin(a)*(112-(k%every?len:len*1.8)),128-Math.cos(a)*(112-(k%every?len:len*1.8))); g.stroke(); } };
        const clk=dial(hxc+0.33,1.5,0.1,function(g){ g.fillStyle='#fbfaf6'; g.fillRect(0,0,256,256); g.strokeStyle='#222'; ticks(g,59,0,Math.PI*2*59/60,8,5,2);
          g.fillStyle='#222'; g.font='bold 30px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; for(let k=1;k<=12;k++){ const a=k/12*Math.PI*2; g.fillText(String(k),128+Math.sin(a)*78,128-Math.cos(a)*78); }
          g.fillStyle='#c0392b'; g.font='bold 18px sans-serif'; g.fillText('12分計',128,168); },lam(0xf4f1ea,{roughness:0.4}));
        const hand=new THREE.Group(); hand.position.z=0.024; clk.add(hand); const hm=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.085,0.002),lam(0xd8352a,{roughness:0.4})); hm.position.y=0.03; hand.add(hm);
        const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.004,16),lam(0xd8352a)); hub.rotation.x=Math.PI/2; hand.add(hub);
        P.anims.push(function(tm){ hand.rotation.z=-(tm%720)/720*Math.PI*2; return false; });                                           // the red hand goes round once every 12 minutes
        const th=dial(hxc+0.6,1.5,0.085,function(g){ g.fillStyle='#f3ead6'; g.fillRect(0,0,256,256); const a0=-Math.PI*0.75, a1=Math.PI*0.75, at=function(v){ return a0+(a1-a0)*v/120; };
          g.strokeStyle='#c0392b'; g.lineWidth=14; g.beginPath(); g.arc(128,128,100,at(80)-Math.PI/2,at(120)-Math.PI/2); g.stroke();
          g.strokeStyle='#2a2a2a'; ticks(g,24,a0,a1,9,2,2); g.fillStyle='#2a2a2a'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
          for(let v=0;v<=120;v+=20){ const a=at(v); g.fillText(String(v),128+Math.sin(a)*74,128-Math.cos(a)*74); } g.font='bold 22px sans-serif'; g.fillText('°C',128,180); },lam(0xb8955a,{metalness:0.8,roughness:0.3}));
        const nd=new THREE.Mesh(new THREE.BoxGeometry(0.003,0.07,0.002),lam(0x1a1a1a)); nd.geometry.translate(0,0.028,0); nd.position.z=0.024; nd.rotation.z=-(-Math.PI*0.75+Math.PI*1.5*92/120); th.add(nd);   // needle at about 92 °C
        (function(){ const bx_=gx+0.17, bz_=hzc+f*0.02, staveM=lam(0xb98a52,{roughness:0.6}), band=lam(0x8a8e92,{metalness:0.8,roughness:0.35});   // löyly bucket beside the stove guard, a wooden ladle resting in it
          for(let k=0;k<16;k++){ const a=k/16*Math.PI*2, sv=new THREE.Mesh(new THREE.BoxGeometry(0.036,0.17,0.012),k%2?staveM:lam(0xc69a62,{roughness:0.6})); sv.position.set(bx_+Math.cos(a)*0.088,0.04+0.085,bz_+Math.sin(a)*0.088); sv.rotation.y=-a+Math.PI/2; sv.rotation.x=0; P.add(sv); }
          P.cyl(bx_,bz_,0.085,0.085,0.04,0.05,staveM,oc,20); [0.08,0.18].forEach(function(y){ const r=new THREE.Mesh(new THREE.TorusGeometry(0.095,0.004,6,32),band); r.rotation.x=Math.PI/2; r.position.set(bx_,y,bz_); P.add(r,oc); });
          P.cyl(bx_,bz_,0.08,0.08,0.17,0.175,lam(0x7aa6c4,{roughness:0.05,transparent:true,opacity:0.8}),oc,24);   // water
          const L=new THREE.Group(); L.position.set(bx_,0.15,bz_); L.rotation.z=0.6; P.group.add(L); const h=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.011,0.4,10),staveM); h.position.y=0.2; L.add(h);
          const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.032,0.05,16,1,true),lam(0xb98a52,{roughness:0.6,side:THREE.DoubleSide})); cup.position.set(0,0.0,0); L.add(cup); const cb=new THREE.Mesh(new THREE.CircleGeometry(0.032,16),staveM); cb.rotation.x=Math.PI/2; cb.position.y=-0.025; L.add(cb); })();
      } else {
        P.box(-D+t,0.0,-W+t,W-t,0.45,0.5,dark); P.box(-D+t,-D+t+0.02,-W+t,W-t,0.6,1.0,dark);                      // single bench with a backrest board
        P.box(0.15,0.4,-W+t,-W+t+0.18,0.1,0.65,heaterM);                                                              // heater
        for(let i=0;i<10;i++) stone(0.2+(i%3)*0.07,-W+t+0.04+Math.floor(i/3)*0.05);
      }
      P.box(-D+t,-D+t+0.02,-W+0.1,W-0.1,1.7,1.72,lam(0xffe2b0,{emissive:0xffb050}),oc);                             // LED strip
      const light=new THREE.PointLight(0xffb060,1.2,2.2,2); light.position.set(0,1.6,0); P.group.add(light);
      P._col(-D,-D+t,-W,W,true); P._col(-D,D,-W,-W+t,true); P._col(-D,D,W-t,W,true); P._col(D-t,D,pane[0],mull[1],true);
      return P;
    };
    /* umbrella stand 25 cm with three umbrellas */
    Catalog.umbrellaStand=function(){
      const P=new Piece(), lam=env.lam;
      P.cyl(0,0,0.11,0.1,0,0.45,lam(0x3a3836,{roughness:0.5}),{open:true},20); P.cyl(0,0,0.1,0.1,0,0.02,lam(0x2a2826),{},20);
      [[0.04,0.03,0x35506b,0.05],[-0.04,0.02,0xd8453c,-0.06],[0,-0.05,0x2a2a2a,0.02]].forEach(function(u){
        const g=new THREE.Group(); g.position.set(u[0],0.02,u[1]); g.rotation.z=u[3]; P.group.add(g);
        const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.85,6),M.steel); sh.position.y=0.42; g.add(sh);
        const can=new THREE.Mesh(new THREE.ConeGeometry(0.045,0.6,8),lam(u[2],{roughness:0.6})); can.position.y=0.55; can.rotation.x=Math.PI; g.add(can);
        const hd=new THREE.Mesh(new THREE.TorusGeometry(0.035,0.008,6,12,Math.PI),lam(0x6b4a35)); hd.position.set(0.035,0.86,0); g.add(hd); });
      P._col(-0.11,0.11,-0.11,0.11,false); return P;
    };
    /* outdoor: kettle BBQ grill and a teak table with two chairs */
    Catalog.bbqGrill=function(){
      const P=new Piece(), lam=env.lam, blk=lam(0x1b1d20,{roughness:0.4,metalness:0.3});
      const bowl=new THREE.Mesh(new THREE.SphereGeometry(0.28,24,12,0,TAU,Math.PI/2,Math.PI/2),blk); bowl.position.y=0.78; P.add(bowl);
      const lidG=new THREE.Group(); lidG.userData.keep=true; lidG.position.set(0,0.8,0); P.group.add(lidG);
      const lid=new THREE.Mesh(new THREE.SphereGeometry(0.285,24,10,0,TAU,0,Math.PI/2),blk); lid.scale.y=0.7; lid.castShadow=true; lidG.add(lid);
      const knob=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.04,10),lam(0x6b4a35)); knob.position.y=0.2; lidG.add(knob);
      P.openLid=function(on){ lidG.position.set(on?0.31:0,on?0.55:0.8,0); lidG.rotation.z=on?-Math.PI/2:0; };   // open: hung on the side hook
      for(let i=0;i<3;i++){ const a=i*TAU/3, l=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.6,6),M.steel); l.position.set(Math.cos(a)*0.17,0.3,Math.sin(a)*0.17); l.rotation.set(Math.sin(a)*0.25,0,-Math.cos(a)*0.25); P.add(l); }
      P._col(-0.29,0.29,-0.29,0.29,true); return P;
    };
    /* 26-inch step-through city bike (ママチャリ): 1.85 m long, 58 cm bars, front basket, rear carrier, mudguards, chain case, two-leg stand down; front +x */
    Catalog.cityBike=function(color){
      const P=new Piece(), lam=env.lam, fr=lam(color||0xeee3c8,{roughness:0.35,metalness:0.15}), blk=lam(0x1d1e20,{roughness:0.8}), sil=lam(0xc3c7cb,{metalness:0.85,roughness:0.3}), dk=lam(0x2c2e31,{roughness:0.5});
      const add=function(geo,mt,x,y,z,rx,ry,rz){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); m.castShadow=true; P.group.add(m); return m; };
      const rod=function(a,b,r,mt){ const A=new THREE.Vector3(a[0],a[1],a[2]||0), B=new THREE.Vector3(b[0],b[1],b[2]||0), L=A.distanceTo(B), m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,8),mt);
        m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize()); m.castShadow=true; P.group.add(m); return m; };
      const R=0.33, FX=0.57, RX=-0.55, BB=[-0.04,0.29], ST=[-0.2,0.86], HT0=[0.46,0.62], HT1=[0.5,0.86];
      [FX,RX].forEach(function(x){ add(new THREE.TorusGeometry(R-0.02,0.022,8,40),blk,x,R,0); add(new THREE.TorusGeometry(R-0.045,0.008,6,40),sil,x,R,0);
        for(let i=0;i<12;i++){ const a=i*Math.PI/12; rod([x-Math.cos(a)*(R-0.05),R-Math.sin(a)*(R-0.05),0],[x+Math.cos(a)*(R-0.05),R+Math.sin(a)*(R-0.05),0],0.0018,sil); }
        add(new THREE.CylinderGeometry(0.025,0.025,0.1,12),sil,x,R,0,Math.PI/2);
        const g=add(new THREE.TorusGeometry(R+0.025,0.03,6,24,Math.PI*0.62),fr,x,R,0,0,0,x>0?Math.PI*0.16:Math.PI*0.22); g.scale.z=1.4; });   // mudguards
      const frame=new THREE.CatmullRomCurve3([new THREE.Vector3(HT0[0],HT0[1],0),new THREE.Vector3(0.3,0.42,0),new THREE.Vector3(0.1,0.3,0),new THREE.Vector3(BB[0],BB[1],0)]);
      add(new THREE.TubeGeometry(frame,24,0.024,10,false),fr,0,0,0);   // step-through down tube
      rod([BB[0],BB[1]],ST,0.019,fr); rod(HT0,HT1,0.022,fr); rod(HT0,[FX,R],0.014,fr); rod([0.47,0.66,0.06],[FX,R,0.05],0.011,fr); rod([0.47,0.66,-0.06],[FX,R,-0.05],0.011,fr);   // seat tube, head tube, fork
      [0.05,-0.05].forEach(function(z){ rod([BB[0],BB[1],z*0.6],[RX,R,z],0.011,fr); rod([ST[0]+0.02,ST[1]-0.08,z*0.4],[RX,R,z],0.01,fr); });   // chain and seat stays
      add(new THREE.BoxGeometry(0.62,0.12,0.03),fr,(BB[0]+RX)/2-0.02,0.33,0.075,0,0,0.05);   // full chain case
      add(new THREE.CylinderGeometry(0.1,0.1,0.03,20),fr,BB[0],BB[1],0.075,Math.PI/2);
      [[1,-0.1],[-1,0.1]].forEach(function(q){ const z=q[0]*0.1, px=BB[0]+q[1]*1.6; rod([BB[0],BB[1],z],[px,BB[1]-0.15*q[0],z],0.009,sil); add(new THREE.BoxGeometry(0.1,0.022,0.07),blk,px,BB[1]-0.15*q[0],q[0]*0.15); });   // cranks, pedals
      rod(ST,[ST[0]-0.04,ST[1]+0.1],0.013,sil); const seat=add(new THREE.SphereGeometry(0.1,16,10),blk,ST[0]-0.05,ST[1]+0.12,0); seat.scale.set(1.35,0.38,0.95);
      rod(HT1,[0.5,1.0],0.013,sil); rod([0.5,1.0,-0.29],[0.5,1.0,0.29],0.011,sil);   // stem, swept-back bar
      [1,-1].forEach(function(sd){ rod([0.5,1.0,sd*0.29],[0.33,1.03,sd*0.31],0.011,sil); rod([0.36,1.03,sd*0.31],[0.25,1.04,sd*0.31],0.017,blk); rod([0.42,1.0,sd*0.24],[0.33,0.99,sd*0.27],0.004,sil); });   // grips, brake levers
      add(new THREE.SphereGeometry(0.026,14,8,0,Math.PI*2,0,Math.PI/2),sil,0.5,1.01,0.2);   // bell
      add(new THREE.CylinderGeometry(0.035,0.03,0.07,14),dk,0.62,0.72,0,0,0,Math.PI/2); add(new THREE.CircleGeometry(0.03,14),lam(0xfff6d8,{emissive:0x5a5030}),0.656,0.72,0,0,Math.PI/2);   // dynamo light
      const wire=lam(0x8d9196,{metalness:0.7,roughness:0.4,wireframe:true}); add(new THREE.BoxGeometry(0.3,0.24,0.36,6,5,7),wire,0.73,0.88,0); add(new THREE.BoxGeometry(0.3,0.005,0.36),lam(0x8d9196,{metalness:0.6,roughness:0.4}),0.73,0.76,0);   // front basket
      rod([0.6,0.77,0.1],[FX,R,0.06],0.007,sil); rod([0.6,0.77,-0.1],[FX,R,-0.06],0.007,sil);
      add(new THREE.BoxGeometry(0.52,0.02,0.15),sil,-0.6,0.8,0); [0.07,-0.07].forEach(function(z){ rod([-0.82,0.8,z],[RX,R,z],0.008,sil); rod([-0.36,0.8,z],[-0.27,0.72,z],0.007,sil); });   // rear carrier
      add(new THREE.BoxGeometry(0.03,0.06,0.03),lam(0xd23a2e,{emissive:0x401010}),-0.86,0.78,0);   // tail reflector
      [0.09,-0.09].forEach(function(z){ rod([RX,R,z*0.7],[RX-0.17,0.01,z*1.4],0.009,sil); }); rod([RX-0.17,0.01,0.13],[RX-0.17,0.01,-0.13],0.009,sil);   // two-leg stand, down
      P._col(-0.88,0.9,-0.22,0.22,true); return P;
    };
    Catalog.outdoorSet=function(){
      const P=new Piece(), lam=env.lam, teak=lam(0xa4744a,{roughness:0.7});
      P.cyl(0,0,0.4,0.4,0.7,0.73,teak,{},28); P.cyl(0,0,0.03,0.03,0,0.7,teak,{},10); P.cyl(0,0,0.25,0.25,0,0.02,teak,{},20);
      [-1,1].forEach(function(sd){ const z=sd*0.75;
        P.box(-0.22,0.22,z-0.22,z+0.22,0.42,0.45,teak); P.box(-0.22,0.22,z+sd*0.2-0.02,z+sd*0.2+0.02,0.45,0.85,teak);
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.box(c[0]*0.2-0.02,c[0]*0.2+0.02,z+c[1]*0.2-0.02,z+c[1]*0.2+0.02,0,0.42,teak); });
        P.rb(0,z,0.4,0.4,0.05,0.02,M.cushA,0.45,false); });
      P._col(-0.4,0.4,-1.0,1.0,true); return P;
    };
    /* cat window hammock that clips under a window sill; wall piece facing +x, bed at sill height */
    Catalog.catWindowPerch=function(sill){
      const P=new Piece(), y=sill||0.9;
      P.box(0,0.04,-0.25,0.25,y-0.04,y,M.oak); P.box(0.04,0.4,-0.25,0.25,y-0.02,y,M.oak);
      P.rb(0.22,0,0.34,0.46,0.05,0.025,env.fab(0xe8e2d8),y,false);
      [-1,1].forEach(function(sd){                  // triangular brackets under the tray
        const tri=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(0.36,0),new THREE.Vector2(0,-0.22)]);
        const m=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:0.02,bevelEnabled:false}),M.oak); m.position.set(0.0,y-0.04,sd*0.22-0.01); P.add(m); });
      return P;
    };
    /* pressure-mounted pet gate (tall enough for cats), w wide x h high, spanning z; the leaf turns on P.leafPivot (hinge at -z) */
    Catalog.petGate=function(w,h){
      w=w||0.95; h=h||1.5;
      const P=new Piece(), lam=env.lam, fr=lam(0xf3f2ee,{roughness:0.35,metalness:0.2}), oak=M.oak, oc={cast:false};
      [-1,1].forEach(function(sd){ P.box(-0.02,0.02,sd*w/2-(sd>0?0.035:0),sd*w/2+(sd<0?0.035:0),0,h,fr);    // side posts with rubber pads
        [0.15,h-0.15].forEach(function(y){ P.box(-0.025,0.025,sd*(w/2+0.003)-0.006,sd*(w/2+0.003)+0.006,y-0.04,y+0.04,lam(0x3a3836,{roughness:0.9}),oc); }); });
      P.box(-0.02,0.02,-w/2,w/2,0,0.02,fr,oc);
      const lw=w-0.1, pv=new THREE.Group(); pv.position.set(0,0,-w/2+0.045); P.group.add(pv);
      const add=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; pv.add(m); return m; };
      add(new THREE.BoxGeometry(0.03,0.04,lw),oak,0,h-0.06,lw/2); add(new THREE.BoxGeometry(0.02,0.03,lw),fr,0,0.06,lw/2);
      [0.012,lw-0.012].forEach(function(z){ add(new THREE.BoxGeometry(0.02,h-0.1,0.024),fr,0,h/2,z); });
      for(let z=0.06;z<lw-0.03;z+=0.05) add(new THREE.CylinderGeometry(0.006,0.006,h-0.14,6),fr,0,h/2-0.01,z);
      add(new THREE.BoxGeometry(0.05,0.08,0.03),lam(0x6b6e72,{roughness:0.4,metalness:0.5}),0,1.0,lw-0.02);   // latch
      P.leafPivot=pv;
      P._col(-0.04,0.04,-w/2,w/2,false);
      return P;
    };
    /* ---------- foliage: leaf-cluster cards (canvas-painted, alpha-tested) as one InstancedMesh per crown, branching trunks, shaped pot-plant leaves ---------- */
    const leafTexCache={};
    function leafTex(kind){                       // a twig with leaves on a transparent 256 px square, painted once per kind
      if(leafTexCache[kind]) return leafTexCache[kind];
      const S=256, c=document.createElement('canvas'); c.width=c.height=S; const g=c.getContext('2d'); let seed=kind.length*977+13;
      const r=function(){ seed=(seed*16807)%2147483647; return seed/2147483647; };
      const pal={ash:['#5f8f45','#6f9c4f','#4f7d3a','#86ad5c'],maple:['#b3492f','#c9582c','#bd4e2b','#d9803a','#a3402b','#c46a33'],sakura:['#fbe3ea','#f7d0dc','#f4c0d0','#fdeef2','#f0b6c8'],box:['#3f6b31','#4d7a3a','#5a8a44','#36602b'],hedge:['#46753a','#55853f','#3c6a33','#6a9a4c']}[kind];
      const leaf=function(x,y,ang,len,wid,col,lobed){
        g.save(); g.translate(x,y); g.rotate(ang); g.fillStyle=col; g.beginPath();
        if(lobed){ for(let k=0;k<=5;k++){ const a=-Math.PI*0.62+k*Math.PI*1.24/5, rr=k%2?len*0.55:len; g.lineTo(Math.sin(a)*rr*0.9,-Math.cos(a)*rr); } g.lineTo(0,len*0.1); }
        else { g.moveTo(0,0); g.quadraticCurveTo(wid,-len*0.45,0,-len); g.quadraticCurveTo(-wid,-len*0.45,0,0); }
        g.closePath(); g.fill();
        g.strokeStyle='rgba(255,255,240,0.22)'; g.lineWidth=1; g.beginPath(); g.moveTo(0,0); g.lineTo(0,-len*0.9); g.stroke();
        g.fillStyle='rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(-wid,-len*0.45,0,-len); g.lineTo(0,0); g.fill();   // shaded half
        g.restore();
      };
      g.strokeStyle='#5a4636'; g.lineWidth=3; g.beginPath(); g.moveTo(S*0.5,S*0.98); g.quadraticCurveTo(S*0.46,S*0.6,S*0.52,S*0.18); g.stroke();
      const blossom=function(x,y,rad,col){         // five notched petals around a deep-pink eye
        g.save(); g.translate(x,y); g.rotate(r()*TAU); g.fillStyle=col;
        for(let k=0;k<5;k++){ g.rotate(TAU/5); g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(rad*0.7,-rad*0.45,rad*0.18,-rad); g.lineTo(0,-rad*0.82); g.lineTo(-rad*0.18,-rad); g.quadraticCurveTo(-rad*0.7,-rad*0.45,0,0); g.fill(); }
        g.fillStyle='#d9587e'; g.beginPath(); g.arc(0,0,rad*0.22,0,TAU); g.fill(); g.restore();
      };
      if(kind==='sakura'){
        for(let i=0;i<70;i++){ const t=r(); blossom(S*(0.5+(r()-0.5)*0.85*(0.4+t)),S*(0.12+t*0.72),S*(0.035+r()*0.02),pal[(r()*pal.length)|0]); }
        const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy||4;
        return (leafTexCache[kind]=t);
      }
      const n=kind==='maple'?30:kind==='ash'?40:70;
      for(let i=0;i<n;i++){
        const t=r(), x=S*(0.5+(r()-0.5)*0.75*(0.35+t)), y=S*(0.18+t*0.7), ang=(x<S/2?-1:1)*(0.6+r()*0.9)+(r()-0.5)*0.4;
        const len=S*(kind==='maple'?0.11+r()*0.04:kind==='ash'?0.1+r()*0.04:0.055+r()*0.025), wid=len*(kind==='ash'?0.3:0.45);
        leaf(x,y,ang,len,wid,pal[(r()*pal.length)|0],kind==='maple');
      }
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=env.anisotropy||4;
      return (leafTexCache[kind]=t);
    }
    function leafMat(kind){ return mat('leafCard_'+kind,0xffffff,{map:leafTex(kind),alphaTest:0.45,side:THREE.DoubleSide,roughness:0.75}); }
    /* nCards leaf cards of size s inside an ellipsoid (rx, ry, rz) centred at (cx, cy, cz), facing outward; tints vary per card */
    function crown(P,kind,nCards,s,cx,cy,cz,rx,ry,rz,rr){
      const geo=new THREE.PlaneGeometry(s,s); geo.translate(0,s*0.38,0);
      const im=new THREE.InstancedMesh(geo,leafMat(kind),nCards), m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), p=new THREE.Vector3(), sc=new THREE.Vector3(), out=new THREE.Vector3(), col=new THREE.Color();
      for(let i=0;i<nCards;i++){
        const u=rr()*TAU, v=Math.acos(2*rr()-1), k=Math.cbrt(0.25+0.75*rr());          // denser toward the surface
        out.set(Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u));
        p.set(cx+out.x*rx*k,cy+out.y*ry*k,cz+out.z*rz*k);
        e.set((rr()-0.5)*1.2-Math.max(0,out.y)*0.6,Math.atan2(out.x,out.z)+(rr()-0.5)*1.4,(rr()-0.5)*2.4); q.setFromEuler(e);
        const z=0.75+rr()*0.5; sc.set(z,z,z); m4.compose(p,q,sc); im.setMatrixAt(i,m4);
        const shade=0.72+0.28*(0.5+0.5*out.y)+(rr()-0.5)*0.12; col.setRGB(shade,shade,shade*0.95); im.setColorAt(i,col);
      }
      im.castShadow=true; im.receiveShadow=true; im.computeBoundingSphere(); P.group.add(im); return im;
    }
    /* tapered branch from a to b, recursing into thinner forks; returns the twig tips */
    function branches(P,bark,a,b,r0,depth,rr,tips){
      const d=new THREE.Vector3().subVectors(b,a), L=d.length(), m=new THREE.Mesh(new THREE.CylinderGeometry(r0*0.62,r0,L,7,1),bark);
      m.position.copy(a).lerp(b,0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()); m.castShadow=true; m.receiveShadow=true; P.group.add(m);
      if(depth===0){ tips.push(b.clone()); return tips; }
      const n=depth>1?3:2, dir=d.clone().normalize();
      for(let i=0;i<n;i++){ const az=i/n*TAU+rr()*1.2, tilt=0.45+rr()*0.35;
        const nd=new THREE.Vector3(Math.cos(az)*Math.sin(tilt),Math.cos(tilt),Math.sin(az)*Math.sin(tilt)).lerp(dir,0.35).normalize();
        branches(P,bark,b,b.clone().addScaledVector(nd,L*(0.62+rr()*0.18)),r0*0.62,depth-1,rr,tips); }
      return tips;
    }
    function seeded(sd){ let s=Math.floor(sd*2147483646)+1; return function(){ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
    Catalog.gardenTree=function(h,kind){        // kind 'ash' (シマトネリコ), 'maple' (もみじ, autumn red) or 'sakura' (ソメイヨシノ in bloom: wide, flat-topped)
      const P=new Piece(), sakura=kind==='sakura', maple=kind==='maple'||sakura, rr=seeded(env.rnd()), bark=mat('bark',0x6b5a48,{roughness:0.95}), tips=[];
      const stems=maple?1:3;
      for(let s=0;s<stems;s++){
        const a=s/stems*TAU+rr(), lean=stems>1?0.12:0.03, base=new THREE.Vector3(Math.cos(a)*0.05*(stems>1),0,Math.sin(a)*0.05*(stems>1));
        const top=new THREE.Vector3(Math.cos(a)*h*lean,h*(maple?0.42:0.5),Math.sin(a)*h*lean);
        branches(P,bark,base,top,h*(maple?0.028:0.016),maple?3:2,rr,tips);
      }
      const box=new THREE.Box3(); tips.forEach(function(t){ box.expandByPoint(t); }); const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
      const wd=sakura?1.35:1, rx=Math.max(sz.x/2+h*0.12,h*0.22)*wd, rz=Math.max(sz.z/2+h*0.12,h*0.22)*wd, ry=Math.max(sz.y/2+h*0.1,h*(maple?0.17:0.22))*(sakura?0.8:1);
      crown(P,sakura?'sakura':maple?'maple':'ash',sakura?1300:maple?900:700,h*(maple?0.105:0.11),c.x,c.y+h*0.04,c.z,rx,ry,rz,rr);
      return P;
    };
    Catalog.shrub=function(r,col){              // rounded clipped shrub (ツツジ / ボックスウッド): dense small-leaf cards in a squat dome
      const P=new Piece(), rr=seeded(env.rnd());
      crown(P,col?'hedge':'box',Math.round(70+r*220),r*0.55,0,r*0.62,0,r*0.95,r*0.62,r*0.95,rr);
      const core=new THREE.Mesh(new THREE.SphereGeometry(r*0.7,12,8),mat('shrubCore',0x2f4f26,{roughness:1})); core.scale.y=0.7; core.position.y=r*0.55; P.add(core,{cast:false});
      return P;
    };
    let fiddleTex=null;
    function fiddleLeafTex(){                     // leaf surface: midrib and side veins on a green gradient
      if(fiddleTex) return fiddleTex;
      const c=document.createElement('canvas'); c.width=128; c.height=256; const g=c.getContext('2d');
      const gr=g.createLinearGradient(0,0,128,0); gr.addColorStop(0,'#3d6a32'); gr.addColorStop(0.5,'#4f8240'); gr.addColorStop(1,'#3d6a32'); g.fillStyle=gr; g.fillRect(0,0,128,256);
      g.strokeStyle='rgba(214,226,170,0.75)'; g.lineWidth=3; g.beginPath(); g.moveTo(64,256); g.lineTo(64,0); g.stroke();
      g.lineWidth=1.4; g.strokeStyle='rgba(200,215,160,0.45)';
      for(let y=230;y>20;y-=24){ [-1,1].forEach(function(s){ g.beginPath(); g.moveTo(64,y); g.quadraticCurveTo(64+s*30,y-14,64+s*62,y-30); g.stroke(); }); }
      fiddleTex=new THREE.CanvasTexture(c); fiddleTex.colorSpace=THREE.SRGBColorSpace; fiddleTex.anisotropy=env.anisotropy||4; return fiddleTex;
    }
    function fiddleLeafGeo(L){                    // violin-shaped leaf, L long, cupped across and drooping toward the tip; base at the origin, tip along +y
      const nu=10, nv=6, pos=[], uv=[], idx=[];
      for(let i=0;i<=nu;i++){ const u=i/nu, w=L*0.36*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.05)),0.75)*(0.7+0.5*u)*(1-0.12*Math.sin(u*Math.PI*2.2));
        for(let j=0;j<=nv;j++){ const v=j/nv*2-1; pos.push(v*w,u*L*0.97,(v*v)*w*0.35-u*u*L*0.18); uv.push(j/nv,u); } }
      for(let i=0;i<nu;i++) for(let j=0;j<nv;j++){ const a=i*(nv+1)+j, b=a+1, c=a+nv+1, d=c+1; idx.push(a,c,b,b,c,d); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    Catalog.plant=function(sz){                // potted fiddle-leaf fig, sz = overall scale (1 = 30 cm pot, about 1.2 m tall)
      const P=new Piece(), rr=seeded(env.rnd()), pot=M.pot;
      const prof=[[0,0],[0.1,0],[0.112,0.01],[0.125,0.2],[0.135,0.29],[0.14,0.3],[0.128,0.3],[0.12,0.27]].map(function(q){ return new THREE.Vector2(q[0]*sz,q[1]*sz); });
      const pm=new THREE.Mesh(new THREE.LatheGeometry(prof,32),pot); P.add(pm);
      P.cyl(0,0,0.118*sz,0.118*sz,0.26*sz,0.27*sz,mat('soil',0x3b2e24,{roughness:1}),{cast:false},24);
      P._col(-0.13*sz,0.13*sz,-0.13*sz,0.13*sz,true);
      const leafM=mat('fiddleLeaf',0xffffff,{map:fiddleLeafTex(),side:THREE.DoubleSide,roughness:0.55}), stemM=mat('figStem',0x6b5a3e,{roughness:0.9});
      const geoL=fiddleLeafGeo(0.26*sz), geoS=fiddleLeafGeo(0.19*sz);
      const stems=3;
      for(let s=0;s<stems;s++){
        const a=s/stems*TAU+rr()*0.8, top=(0.85+rr()*0.35)*sz, lean=0.06*sz;
        const A=new THREE.Vector3(Math.cos(a)*0.03*sz,0.26*sz,Math.sin(a)*0.03*sz), B=new THREE.Vector3(Math.cos(a)*lean,top,Math.sin(a)*lean);
        const d=new THREE.Vector3().subVectors(B,A), st=new THREE.Mesh(new THREE.CylinderGeometry(0.006*sz,0.011*sz,d.length(),6),stemM);
        st.position.copy(A).lerp(B,0.5); st.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()); P.add(st);
        const n=6+Math.floor(rr()*3);
        for(let i=0;i<n;i++){
          const t=0.25+0.75*i/(n-1), at=A.clone().lerp(B,t), big=t>0.45, lf=new THREE.Mesh(big?geoL:geoS,leafM);
          lf.position.copy(at); lf.rotation.order='YXZ';
          lf.rotation.set(-(0.6+rr()*0.5)+(t>0.95?0.7:0),a+i*2.4+rr()*0.5,(rr()-0.5)*0.3);   // tipped outward, spiralling round the stem
          P.add(lf);
        }
      }
      return P;
    };
    /* built-in pieces (fixed to the building, not in the registry) */
    Catalog.cleanWall=function(){                  // wall cleaning station ~1 m wide: oak rail with hooks, slim folding broom + dustpan, flat mop, stick vacuum on its dock, duster; back at x=0, front +x
      const P=new Piece(), lam=env.lam, oc={cast:false}, wht=lam(0xf2f1ee,{roughness:0.35}), gry=lam(0x9aa0a6,{roughness:0.5}), blk=lam(0x26282b,{roughness:0.5}), oak=M.oak;
      P.box(0,0.02,-0.5,0.5,1.42,1.5,oak); [-0.4,-0.2,0.0].forEach(function(z){ P.box(0.02,0.06,z-0.006,z+0.006,1.44,1.452,blk,oc); P.box(0.05,0.06,z-0.006,z+0.006,1.452,1.48,blk,oc); });
      P.box(0.05,0.06,-0.41,-0.39,0.08,1.45,wht); P.box(0.03,0.07,-0.5,-0.3,0.02,0.1,gry); for(let z=-0.49;z<-0.31;z+=0.012) P.box(0.04,0.05,z,z+0.006,0.0,0.03,lam(0x6d7177),oc);   // slim broom
      P.box(0.07,0.085,-0.48,-0.3,0.02,0.32,wht); P.box(0.085,0.1,-0.4,-0.38,0.3,0.8,wht);                     // folded flat dustpan clipped to the handle
      P.box(0.05,0.06,-0.21,-0.19,0.1,1.45,gry); P.box(0.02,0.05,-0.36,-0.04,0.0,0.03,lam(0xb9d7e4,{roughness:0.8}));   // flat floor wiper (quickle type) standing on its head
      P.box(0,0.02,0.12,0.32,0.3,0.42,wht); P.box(0.02,0.1,0.15,0.29,0.36,0.4,wht);                              // stick vacuum dock
      P.rbox(0.03,0.13,0.18,0.26,0.9,1.25,0.03,lam(0x8b6fae,{roughness:0.3})); P.box(0.06,0.09,0.205,0.235,0.4,0.9,lam(0xc9ced3,{metalness:0.8,roughness:0.3}));
      P.rbox(0.03,0.12,0.15,0.29,0.36,0.42,0.02,blk); P.cyl(0.08,0.22,0.03,0.03,1.25,1.33,lam(0xe0b84a,{metalness:0.4,roughness:0.4}),oc,14);
      P.box(0.05,0.06,0.39,0.41,1.0,1.45,oak); P.cyl(0.055,0.4,0.045,0.035,0.8,1.0,lam(0xf4efe6,{roughness:1}),oc,12);   // hanging duster
      P._col(0,0.14,-0.5,0.5,false); return P;
    };
    Catalog.counterBasin=function(w,d,back){       // back: depth of the rim behind the bowl (room for a soap pump)            // wall-hung washbasin unit w x d: one-piece ceramic top 83 cm high with a large rectangular bowl toward +z and a flat deck beside it, slim cabinet below; back at x=0, front +x
      const P=new Piece(), lam=env.lam, oc={cast:false}, cer=M.ceramic, y1=0.83, y0=0.8, yb=0.68, bz=w/2-0.27, bw=0.22, b0=back||0.07, b1=d-0.05;
      P.box(0,b0,-w/2,w/2,y0,y1,cer); P.box(b1,d,-w/2,w/2,y0-0.03,y1,cer);                                    // back and front rims
      P.box(b0,b1,-w/2,bz-bw,y0,y1,cer); P.box(b0,b1,bz+bw,w/2,y0,y1,cer);                                    // deck and side rim
      const bin=mat('basinIn',0xe4eaec,{roughness:0.15});
      P.box(b0,b1,bz-bw,bz+bw,yb,yb+0.01,bin,oc); [[b0,b0+0.01,bz-bw,bz+bw],[b1-0.01,b1,bz-bw,bz+bw],[b0,b1,bz-bw,bz-bw+0.01],[b0,b1,bz+bw-0.01,bz+bw]].forEach(function(q){ P.box(q[0],q[1],q[2],q[3],yb,y1,bin,oc); });
      P.cyl((b0+b1)/2,bz,0.02,0.02,yb+0.01,yb+0.013,lam(0xc9ced3,{metalness:0.9,roughness:0.2}),oc,16);   // drain
      const ch=lam(0xdfe3e6,{metalness:0.95,roughness:0.18}); P.cyl(0.04,bz,0.018,0.022,y1,y1+0.2,ch,{},16); P.box(0.03,0.16,bz-0.012,bz+0.012,y1+0.17,y1+0.2,ch);   // tall deck mixer
      P.box(0.05,0.065,bz+0.03,bz+0.04,y1+0.06,y1+0.12,ch,oc);
      P.box(0.02,d-0.03,-w/2+0.02,w/2-0.02,0.36,y0-0.03,lam(0xf4f3ef,{roughness:0.35}));                         // cabinet under the bowl
      [-1,1].forEach(function(k){ P.box(d-0.03,d-0.012,k>0?0.002:-w/2+0.025,k>0?w/2-0.025:-0.002,0.37,y0-0.04,M.oak); P.box(d-0.012,d-0.004,k*0.03-0.006,k*0.03+0.006,0.6,0.74,ch,oc); });
      P._col(0,d,-w/2,w/2,true); return P;
    };
    Catalog.paperHolder=function(){                // toilet-roll holder with a shelf lid (white, 70 cm up), back at x=0, front +x
      const P=new Piece(), lam=env.lam, st=lam(0xf4f3ef,{roughness:0.35}), oc={cast:false}, y=0.7;
      P.box(0,0.012,-0.15,0.15,y-0.02,y+0.1,st,oc); P.box(0.012,0.13,-0.15,0.15,y+0.09,y+0.1,st);
      const roll=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.11,24),lam(0xfbfaf6,{roughness:0.9})); roll.rotation.x=Math.PI/2; roll.position.set(0.07,y+0.02,-0.065); P.add(roll,oc);
      const r2=roll.clone(); r2.position.z=0.065; P.add(r2,oc);
      return P;
    };
    Catalog.sanitaryBin=function(){                // slim 5 L lidded bin for sanitary waste, 17 x 26 x 30 cm; front +x
      const P=new Piece(), lam=env.lam, wh=lam(0xf3f1ec,{roughness:0.3}), oc={cast:false};
      P.rbox(-0.085,0.085,-0.13,0.13,0,0.28,0.03,wh); P.rbox(-0.088,0.088,-0.133,0.133,0.28,0.3,0.03,lam(0xd8c9b4,{roughness:0.4}));
      P.box(0.086,0.09,-0.03,0.03,0.25,0.27,lam(0xb9a88f),oc); P._col(-0.085,0.085,-0.13,0.13,false); return P;
    };
    Catalog.wallSpeaker=function(toe){             // high-end wall speaker on a tilt-and-swivel bracket: white lacquer cabinet 26 x 40 x 24 cm, greige baffle, champagne-ringed tweeter, woofer; back at x=0, front +x; toe = swivel toward the room (rad)
      const P=new Piece(), lam=env.lam, wal=lam(0xf2efe9,{roughness:0.3,envMapIntensity:0.9}), blk=lam(0xd9d4cb,{roughness:0.55}), brass=lam(0xd8c08a,{metalness:0.85,roughness:0.25}), oc={cast:false};
      P.box(0,0.012,-0.06,0.06,-0.09,0.09,blk); P.box(0.012,0.06,-0.015,0.015,-0.015,0.015,blk);
      const S=new THREE.Group(); S.position.set(0.06,0,0); S.rotation.set(0,toe||0,-0.18); P.group.add(S);
      const add=function(geo,mt,x,y,z,rz,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); if(rz) m.rotation.z=rz; m.castShadow=cast!==false; m.receiveShadow=true; S.add(m); return m; };
      add(new THREE.BoxGeometry(0.24,0.4,0.26),wal,0.12,0,0);
      add(new THREE.BoxGeometry(0.008,0.384,0.244),blk,0.244,0,0,0,false);
      const cyl=function(r,len,mt,y){ const m=add(new THREE.CylinderGeometry(r,r,len,28),mt,0.248+len/2,y,0,-Math.PI/2,false); return m; };
      cyl(0.03,0.006,brass,0.11); cyl(0.018,0.01,lam(0x2a2b2d,{metalness:0.4,roughness:0.3}),0.11);
      cyl(0.085,0.006,brass,-0.05); cyl(0.078,0.008,lam(0x232426,{roughness:0.85}),-0.05); cyl(0.028,0.016,lam(0x3a3b3e,{metalness:0.3,roughness:0.5}),-0.05);
      add(new THREE.BoxGeometry(0.004,0.008,0.05),lam(0xe8e2d6,{emissive:0x403a30}),0.249,-0.17,0,0,false);
      return P;
    };
    Catalog.keyRack=function(){                    // wall key rack: light oak board 30 x 12 cm at 1.15 m, brass hooks, car fob and house keys, a small tray on top; back at x=0, front +x
      const P=new Piece(), lam=env.lam, wal=lam(0xd9bf96,{roughness:0.5,map:M.oak.map||null}), brass=lam(0xd8c08a,{metalness:0.85,roughness:0.25}), oc={cast:false}, y=1.15;
      P.rbox(0,0.018,-0.15,0.15,y,y+0.12,0.006,wal); P.box(0.018,0.075,-0.15,0.15,y+0.12,y+0.13,wal); P.box(0.07,0.075,-0.15,0.15,y+0.13,y+0.15,wal);
      const hooks=[-0.105,-0.035,0.035,0.105];
      hooks.forEach(function(z){ P.cyl(0.03,z,0.005,0.005,y+0.02,y+0.06,brass,oc,8); P.box(0.018,0.045,z-0.004,z+0.004,y+0.055,y+0.062,brass,oc); });
      P.rbox(0.025,0.045,hooks[0]-0.016,hooks[0]+0.016,y-0.06,y+0.0,0.008,lam(0x1c1d20,{roughness:0.4}));     // car fob
      [[hooks[1],0xc0c4c8],[hooks[2],0xd8a95a]].forEach(function(k){ P.cyl(0.03,k[0],0.014,0.014,y-0.005,y+0.003,lam(0xb9bec4,{metalness:0.8,roughness:0.3}),oc,12);
        P.box(0.027,0.033,k[0]-0.005,k[0]+0.005,y-0.06,y-0.005,lam(k[1],{metalness:0.8,roughness:0.3}),oc); });
      P.rbox(0.022,0.05,hooks[3]-0.02,hooks[3]+0.02,y-0.05,y-0.0,0.012,lam(0xf2b8c6,{roughness:0.8}));            // keychain charm
      P.box(0.02,0.07,-0.12,0.0,y+0.15,y+0.18,lam(0xe8e2d6,{roughness:0.6}),oc);
      return P;
    };
    Catalog.wallFoldTable=function(len){          // wall-mounted fold-down shelf (default 60 cm long) x 35 cm at 80 cm, with keys and a parcel; folds flat against its back plate, front +x
      const P=new Piece(), lam=env.lam, hl=(len||0.6)/2+0.02;
      P.box(0,0.02,-hl,hl,0.45,0.84,M.oak);
      const H=new THREE.Group(); H.position.set(0.02,0.825,0); P.group.add(H);
      const mk=function(par,geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; par.add(m); return m; };
      mk(H,new THREE.BoxGeometry(0.35,0.025,(len||0.6)),M.oak,0.175,-0.0125,0);
      const items=new THREE.Group(); H.add(items);
      mk(items,new THREE.BoxGeometry(0.2,0.125,0.25),lam(0xc9a87a,{roughness:0.9}),0.2,0.0625,-0.075); mk(items,new THREE.BoxGeometry(0.05,0.01,0.06),M.steel,0.175,0.005,0.15);
      const apply=function(e){ H.rotation.z=-(1-e)*Math.PI/2; items.visible=e>0.9; };   // folded: the board hangs down over the back plate
      const st=stepper(0.6,apply); st.target=1; st.v=1; apply(1);
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:0.5,z:0,label:function(){ return st.target?'收起置物架':'放下置物架'; },act:function(){ st.target=st.target?0:1; }}];
      return P;
    };
    /* Tesla Wall Connector (Gen 3, 35 x 15 x 11 cm): white glass face with a side light bar, cable to a holster and a wall hook; wall piece facing +x.
       P.setCharging(on) turns the light green and hides the plug in the holster. P.plugOut gives the cable exit point. */
    Catalog.evCharger=function(){
      const P=new Piece(), lam=env.lam, Y=1.05;
      P.rbox(0,0.09,-0.075,0.075,Y,Y+0.35,0.035,lam(0x26282b,{roughness:0.4}));
      P.rbox(0.09,0.11,-0.073,0.073,Y+0.005,Y+0.345,0.03,new THREE.MeshPhysicalMaterial({color:0xf4f4f2,roughness:0.08,clearcoat:1,envMapIntensity:1.2}));
      const led=lam(0x7cc8ff,{emissive:0x3a9cff,emissiveIntensity:1.4}); P.box(0.04,0.1,0.075,0.079,Y+0.08,Y+0.27,led,{cast:false});
      P.box(0.11,0.112,-0.02,0.02,Y+0.27,Y+0.31,lam(0xb8bcc2,{metalness:1,roughness:0.2}),{cast:false});
      const cab=lam(0x2a2c30,{roughness:0.55});
      const plugInHolster=new THREE.Group(); P.group.add(plugInHolster);
      P.box(0,0.06,0.2,0.26,Y-0.05,Y+0.1,lam(0x2a2c30,{roughness:0.4}));                                            // holster
      const hp=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.03,0.2,16),lam(0xf2f2f0,{roughness:0.3})); hp.position.set(0.08,Y+0.02,0.23); hp.rotation.z=0.35; plugInHolster.add(hp);
      const coil=new THREE.Group(); P.group.add(coil);
      for(let i=0;i<4;i++){ const t=new THREE.Mesh(new THREE.TorusGeometry(0.17-i*0.004,0.012,8,40),cab); t.rotation.y=Math.PI/2; t.position.set(0.05+i*0.012,0.68-i*0.006,0.0); t.scale.set(1,1.1,1); coil.add(t); }
      P.box(0,0.12,-0.025,0.025,0.82,0.86,lam(0xd8dadc));                                                       // hook
      const drop=[[0.05,Y,0],[0.06,Y-0.12,0.0],[0.05,0.86,0]], dg=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(drop.map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); })),8,0.012,6),cab); P.add(dg,{cast:false});
      const hc=[[0.05,0.52,0.0],[0.06,0.6,0.15],[0.06,Y-0.12,0.23]], hg=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hc.map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); })),10,0.012,6),cab); plugInHolster.add(hg);
      P.box(0,0.02,-0.03,0.03,0.3,Y,lam(0xd8dadc),{cast:false});                                                 // conduit down to the breaker
      P.plugOut=[0.05,0.6,0];
      P.setCharging=function(on){ plugInHolster.visible=!on; led.color.setHex(on?0x7dffa8:0x7cc8ff); led.emissive.setHex(on?0x20d060:0x3a9cff); };
      P.ledMat=led;
      return P;
    };
    Catalog.securityCamera=function(){            // bullet camera on a wall bracket, looking out along +x and down
      const P=new Piece(), lam=env.lam, wh=lam(0xf2f2f0,{roughness:0.3});
      P.cyl(0.02,0,0.04,0.04,-0.02,0.02,wh,{},12).rotation.z=Math.PI/2; P.box(0,0.12,-0.015,0.015,-0.01,0.01,wh);
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.18,16),wh); b.rotation.z=Math.PI/2+0.35; b.position.set(0.2,-0.03,0); P.add(b);
      const lens=new THREE.Mesh(new THREE.CircleGeometry(0.025,16),lam(0x0c1118,{roughness:0.05})); lens.rotation.y=Math.PI/2; lens.rotation.x=-0.35; lens.position.set(0.285,-0.06,0); P.add(lens,{cast:false});
      return P;
    };

    /* ---------- registry: movable furniture and appliances (things you would take with you when moving house). Built-in fixtures such as the bathtub,
       toilet, wash basin and kitchen are made by their own functions above and placed by each house, not listed here. front = the side people use / look at, in the piece's own axes ---------- */
    Catalog.TYPES=[
      {t:'sofa',name:'沙發（2.5 人）',cat:'客廳',front:'+x',make:function(){ return Catalog.sofa(); }},
      {t:'coffeeTable',name:'茶几',cat:'客廳',front:'+x',make:function(){ return Catalog.coffeeTable(); }},
      {t:'tv65',name:'65 吋電視＋電視櫃',cat:'客廳',front:'-x',make:function(){ return Catalog.tvBoard(65); }},
      {t:'tv86',name:'86 吋電視＋電視櫃',cat:'客廳',front:'-x',make:function(){ return Catalog.tvBoard(86); }},
      {t:'tvBoard',name:'電視櫃與電視',cat:'客廳',front:'-x',make:function(){ return Catalog.tvBoard(); }},
      {t:'diningSet',name:'餐桌與椅子',cat:'客廳',front:'+x',make:function(){ return Catalog.diningSet(); }},
      {t:'chair',name:'椅子',cat:'客廳',front:'-z',make:function(){ return Catalog.chair(1); }},
      {t:'sideTable',name:'邊桌',cat:'客廳',front:'+x',make:function(){ return Catalog.sideTable(); }},
      {t:'floorLamp',name:'立燈',cat:'客廳',front:'+x',make:function(){ return Catalog.floorLamp(); }},
      {t:'airPurifier',name:'空氣清淨加濕機（Dyson 型）',cat:'家電',front:'+x',make:function(){ return Catalog.airPurifier(); }},
      {t:'dryerStand',name:'立式吹風機架（白）',cat:'客廳',front:'+x',make:function(){ return Catalog.dryerStand(); }},
      {t:'dryerStandPink',name:'立式吹風機架（粉紅）',cat:'客廳',front:'+x',make:function(){ return Catalog.dryerStand({pink:true}); }},
      {t:'plant',name:'植物（大）',cat:'客廳',front:'+x',make:function(){ return Catalog.plant(0.9); }},
      {t:'plantS',name:'植物（小）',cat:'客廳',front:'+x',make:function(){ return Catalog.plant(0.65); }},
      {t:'bed',name:'Queen 床',cat:'臥室',front:'+z',make:function(){ return Catalog.bed(); }},
      {t:'bedStorage',name:'Queen 床（床底抽屜）',cat:'臥室',front:'+z',make:function(){ return Catalog.bed(true); }},
      {t:'windowBench',name:'窗下收納長椅（240 cm，書櫃＋抽屜）',cat:'臥室',front:'+x',make:function(){ return Catalog.windowBench(2.4); }},
      {t:'bedside',name:'床頭櫃',cat:'臥室',front:'-z',make:function(){ return Catalog.bedsideTable(true); }},
      {t:'headboard',name:'棚付きヘッドボード',cat:'臥室',front:'+x',make:function(){ return Catalog.shelfHeadboard(); }},
      {t:'rugBed',name:'條紋地毯',cat:'臥室',front:'+x',make:function(){ return Catalog.stripedRug(2.16,2.55); }},
      {t:'desk',name:'書桌（含 3D 列印機）',cat:'書房',front:'+z',make:function(){ return Catalog.desk(); }},
      {t:'printerCart',name:'3D 列印機（附推車）',cat:'書房',front:'+z',make:function(){ return Catalog.printerCart(); }},
      {t:'officeChair',name:'辦公椅',cat:'書房',front:'-z',make:function(){ return Catalog.officeChair(); }},
      {t:'gamingChair',name:'電競椅（黑白、可躺 135°）',cat:'書房',front:'-z',make:function(){ return Catalog.gamingChair(); }},
      {t:'bookshelf',name:'書櫃',cat:'書房',front:'+x',make:function(){ return Catalog.bookshelf(); }},
      {t:'fridge',name:'冰箱（60 cm）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.fridge(); }},
      {t:'overSinkRack',name:'水槽上瀝水架（シンク上 水切りラック）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.overSinkRack(); }},
      {t:'dryingRack',name:'水切りラック（瀝水架）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.dryingRack(); }},
      {t:'washer',name:'洗衣機',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.washer(); }},
      {t:'rugRound',name:'圓地毯（長毛）',cat:'客廳',front:'+x',make:function(){ return Catalog.roundRug(0.95,'plain',24,0.0,true); }},
      {t:'rugRoundSun',name:'花邊圓地毯',cat:'書房',front:'+x',make:function(){ return Catalog.roundRug(0.7,'sun',12,0.045); }},
      {t:'liftTable',name:'升降桌',cat:'客廳',front:'+x',make:function(){ return Catalog.liftTable(); }},
      {t:'liftDining',name:'升降折疊餐桌茶几（附 4 張餐凳）',cat:'客廳',front:'+x',make:function(){ return Catalog.liftDining(); }},
      {t:'fridge70',name:'冰箱（70 cm，可開門、有食物）',cat:'廚房與衛浴',front:'+z',make:function(){ return Catalog.fridge70(); }},
      {t:'fridgeHitachi',name:'日立 冰箱 R-HZC54Y（540 L）',cat:'廚房與衛浴',front:'+z',make:function(){ return Catalog.fridgeHitachi(); }},
      {t:'fridgeL',name:'大型冰箱（70 × 70 × 183 cm，約 500 L）',cat:'廚房與衛浴',front:'+z',make:function(){ const p=Catalog.fridge70(); p.group.scale.set(1,1.83/1.75,0.7/0.65); p.cols.forEach(function(c){ c.z0*=0.7/0.65; c.z1*=0.7/0.65; }); return p; }},
      {t:'catTabby',name:'貓（虎斑）',cat:'貓咪',front:'+x',make:function(){ return Catalog.cat('tabby'); }},
      {t:'nestHub',name:'Google Nest Hub（智慧螢幕）',cat:'家電',front:'+x',make:function(){ return Catalog.nestHub(); }},
      {t:'catBubu',name:'咘咘（白底虎斑）',cat:'貓咪',front:'+x',make:function(){ return Catalog.bubu(); }},
      {t:'catGrey',name:'貓（灰）',cat:'貓咪',front:'+x',make:function(){ return Catalog.cat('grey'); }},
      {t:'catBed',wall:true,name:'貓耳吊床（壁掛，含貓）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catBed(1.6,'tabby'); }},
      {t:'catHouse',wall:true,name:'貓屋（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catHouse(0.95); }},
      {t:'catBubble',wall:true,name:'透明壓克力貓碗（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catBubble(1.85,'tabby'); }},
      {t:'catStep',wall:true,name:'貓跳台（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catStep(1.2); }},
      {t:'catColumn',wall:true,name:'貓抓柱（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catColumn(0.4,1.9,[0.9]); }},
      {t:'catBowls',name:'貓碗',cat:'貓咪',front:'+x',make:function(){ return Catalog.catBowls(); }},
      {t:'catFeedStation',name:'貓咪餵食區（自動飼料機＋罐頭碗＋水碗）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catFeedStation(); }},
      {t:'litterBox',name:'自動貓砂盆',cat:'貓咪',front:'+z',make:function(){ return Catalog.litterBox(); }},
      {t:'artLand',name:'畫（橫 100 × 50）',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.picture(1.0,0.5,1.55); }},
      {t:'artPortrait',name:'畫（直 50 × 70）',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.picture(0.5,0.7,1.5); }},
      {t:'artSmall',name:'小幅畫（40 × 40）',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.picture(0.4,0.4,1.5); }},
      {t:'bathStool',name:'浴室椅',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.bathStool(); }},
      {t:'washBowl',name:'浴室臉盆',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.washBowl(); }},
      {t:'applianceCabinet',name:'家電櫃（咖啡機、微波爐…）',cat:'廚房與衛浴',front:'+z',make:function(){ return Catalog.applianceCabinet(); }},
      {t:'towels',name:'摺好的毛巾',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.towels(0); }},
      {t:'wallShelves',name:'牆上層板（書、植物、相框）',cat:'牆面',front:'+z',wall:true,make:function(){ return Catalog.wallShelves(); }},
      {t:'fullMirror',name:'全身鏡',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.fullMirror(); }},
      {t:'clothesRack',name:'吊衣桿與衣服（120 cm）',cat:'收納與其他',front:'+z',make:function(){ return Catalog.clothesRack(1.2); }},
      {t:'petGate',name:'寵物／嬰兒柵欄（貓用 1.5 m）',cat:'收納與其他',front:'+x',make:function(){ return Catalog.petGate(); }},
      {t:'shoeShelf',name:'開放鞋架',cat:'收納與其他',front:'+z',make:function(){ return Catalog.shoeShelf(0.6,0.3,1.8); }},
      {t:'shoeCabinet',name:'封閉式鞋櫃（附門）',cat:'收納與其他',front:'+z',make:function(){ return Catalog.shoeCabinet(1.2,1.9); }},
      {t:'bagShelf',name:'包包帽子收納架',cat:'臥室',front:'+z',make:function(){ return Catalog.bagShelf(); }},
      {t:'litterRobot',name:'PETKIT 貓砂機 Purobot Max Pro 2',cat:'貓咪',front:'+x',make:function(){ return Catalog.litterRobot(); }},
      {t:'doormat',name:'腳踏墊',cat:'收納與其他',front:'+x',make:function(){ return Catalog.doormat(); }},
      {t:'lSofa',name:'L 型沙發',cat:'客廳',front:'+x',make:function(){ return Catalog.lSofa(); }},
      {t:'reclinerSofa',name:'電動躺椅沙發（三人座）',cat:'客廳',front:'+x',make:function(){ return Catalog.reclinerSofa(); }},
      {t:'massageChair',name:'按摩椅',cat:'客廳',front:'+x',make:function(){ return Catalog.massageChair(); }},
      {t:'spiceRack',name:'三層調味料架',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.spiceRack(); }},
      {t:'foldTable',name:'摺疊大餐桌（6 人）',cat:'客廳',front:'+x',make:function(){ return Catalog.foldTable(); }},
      {t:'workCounter',name:'家事作業台',cat:'客廳',front:'+x',make:function(){ return Catalog.workCounter(); }},
      {t:'worldMap',name:'世界地圖',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.worldMap(); }},
      {t:'pantryCabinet',name:'食品收納櫃（單門，45 cm）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.pantryCabinet(); }},
      {t:'laundryBasket',name:'洗衣籃（含洗衣袋）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.laundryBasket(); }},
      {t:'hotWaterPot',name:'電熱水瓶（保溫）',cat:'廚房與衛浴',front:'+z',make:function(){ return Catalog.hotWaterPot(); }},
      {t:'binCabinet',name:'垃圾桶櫃（三個抽拉桶：普通・塑膠・罐瓶）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.binCabinet(); }},
      {t:'wallClock',name:'圓形掛鐘（玫瑰金框）',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.wallClock(); }},
      {t:'catPerch',name:'貓窗台吊床',cat:'貓咪',front:'+x',wall:true,make:function(){ return Catalog.catWindowPerch(0.9); }},
      {t:'liftDesk',name:'電動升降桌',cat:'書房',front:'+z',make:function(){ return Catalog.liftDesk(); }},
      {t:'duoDesk',name:'雙人升降桌（含 2 椅）',cat:'書房',front:'+z',make:function(){ return Catalog.duoDesk(); }},
      {t:'babyCrib',name:'嬰兒床',cat:'臥室',front:'+x',make:function(){ return Catalog.babyCrib(); }},
      {t:'smallShelf',name:'矮書櫃',cat:'臥室',front:'+x',make:function(){ return Catalog.smallBookshelf(); }},
      {t:'fan',name:'電風扇',cat:'家電',front:'+x',make:function(){ return Catalog.fan(); }},
      {t:'dehumidifier',name:'除濕／加濕機',cat:'家電',front:'+x',make:function(){ return Catalog.dehumidifier(); }},
      {t:'robotVacuum',name:'掃地機器人（含基地）',cat:'家電',front:'+x',make:function(){ return Catalog.robotVacuum(); }},
      {t:'dreameX40',name:'掃地機器人 Dreame X40 Ultra（含基地）',cat:'家電',front:'+x',make:function(){ return Catalog.dreameX40(); }},
      {t:'homeSauna',name:'雙人家用三溫暖',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.homeSauna(); }},
      {t:'cleanWall',name:'壁掛清潔用具（掃把・拖把・吸塵器）',cat:'收納與其他',front:'+x',wall:true,make:function(){ return Catalog.cleanWall(); }},
      {t:'broomCabinet',name:'掃除用具櫃',cat:'收納與其他',front:'+x',make:function(){ return Catalog.broomCabinet(); }},
      {t:'trashBins',name:'分類垃圾桶',cat:'收納與其他',front:'+x',make:function(){ return Catalog.trashBins(); }},
      {t:'binsDuo',name:'雙槽腳踏垃圾桶（橡木蓋）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.binsDuo(); }},
      {t:'wallSpeaker',name:'壁掛式高級喇叭',cat:'家電',front:'+x',wall:true,make:function(){ return Catalog.wallSpeaker(0); }},
      {t:'keyRack',name:'鑰匙掛架',cat:'收納與其他',front:'+x',wall:true,make:function(){ return Catalog.keyRack(); }},
      {t:'stockShelf',name:'防災備品架',cat:'收納與其他',front:'+x',make:function(){ return Catalog.stockShelf(); }},
      {t:'catPantry',name:'貓糧架（飼料・罐頭・貓砂）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catPantry(); }},
      {t:'humidifier',name:'加濕機',cat:'家電',front:'+x',make:function(){ return Catalog.humidifier(); }},
      {t:'umbrellaStand',name:'傘架',cat:'收納與其他',front:'+x',make:function(){ return Catalog.umbrellaStand(); }},
      {t:'bbqGrill',name:'BBQ 烤爐',cat:'戶外',front:'+x',make:function(){ return Catalog.bbqGrill(); }},
      {t:'laundryPole',name:'室內曬衣桿（天花板吊掛）',cat:'收納與其他',front:'+x',make:function(){ return Catalog.laundryPole(2.5,1.8); }},
      {t:'printer3d',name:'3D 列印機（壓克力罩）',cat:'書房',front:'+x',make:function(){ return Catalog.printer3d(0.72); }},
      {t:'outdoorSet',name:'戶外桌椅',cat:'戶外',front:'+x',make:function(){ return Catalog.outdoorSet(); }},
      {t:'cityBike',name:'淑女車（26 吋）',cat:'戶外',front:'+x',make:function(){ return Catalog.cityBike(0xeee3c8); }},{t:'cityBikeSage',name:'淑女車（26 吋・鼠尾草綠）',cat:'戶外',front:'+x',make:function(){ return Catalog.cityBike(0x9fb29b); }},
      {t:'shoeCabinet',name:'鞋櫃',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoeCabinet(); }},
      {t:'shoesW',name:'白色球鞋',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('sneaker',0xe8e6e0,0xf1efe9); }},
      {t:'shoesHer',name:'白色球鞋（女）',cat:'收納與其他',front:'+x',make:function(){ const P=Catalog.shoePair('sneaker',0xf7f5f0,0xffffff); P.group.scale.setScalar(0.92); return P; }},
      {t:'shoesHim',name:'黑色球鞋（男）',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('sneaker',0x232428,0x2c2d31); }},
      {t:'shoesL',name:'黑色樂福鞋',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('loafer',0x1c1c1e,0x8a6a4a); }},
      {t:'shoesN',name:'深藍球鞋',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('sneaker',0x1f2c44,0xf1efe9); }},
      {t:'suit30P',name:'30 吋行李箱（奶油）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.52,0.78,0.31,0xe6dcc8,0xc9bba0,false); }},
      {t:'suit29B',name:'29 吋行李箱（鼠尾草綠）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.49,0.77,0.33,0x8f9a86,0,true); }},
      {t:'suit24P',name:'24 吋行李箱（霧藍）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.41,0.66,0.26,0x9db0c4,0x8499ae,false); }},
      {t:'car',name:'Tesla Model 3（灰黑）',cat:'收納與其他',front:'+z',make:function(){ return Catalog.car(); }}
    ];
    const DIR={'+x':0,'-z':1,'-x':2,'+z':3}, COMPASS={E:0,N:1,W:2,S:3};
    Catalog.faceIndex=function(t){ return DIR[Catalog.info(t).front]; };   // 0 E(+x), 1 N(-z), 2 W(-x), 3 S(+z)
    Catalog.info=function(t){ return Catalog.TYPES.find(function(d){ return d.t===t; })||null; };
    Catalog.make=function(t){ const d=Catalog.info(t); if(!d) throw new Error('unknown furniture type: '+t); const p=d.make(); p.type=t; return p; };
    Catalog.turnsToFace=function(t,face){        // quarter turns (counter-clockwise from above) that make piece t look toward compass face N/E/S/W (north = -z)
      const d=Catalog.info(t); return ((COMPASS[face]-DIR[d.front])%4+4)%4;
    };

    const labelTex=function(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h); const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=env.anisotropy||4; return tx; };
    /* intercom indoor monitor (main: 7 in colour screen, 20 x 13 x 2.5 cm; sub: a slim 10 x 15 cm unit); back at x=0, front +x */
    Catalog.intercomMonitor=function(sub){
      const P=new Piece(), lam=env.lam, oc={cast:false}, wh=lam(0xf4f3ef,{roughness:0.35}), W=sub?0.1:0.2, H=sub?0.15:0.13;
      P.rbox(0,0.025,-W/2,W/2,-H/2,H/2,0.008,wh);
      const scr=lam(0x0c0f12,{roughness:0.15,emissive:0x000000}), sw=sub?0.07:0.12, sh=sub?0.05:0.085; P.box(0.025,0.027,(sub?-0.035:-0.085),(sub?0.035:0.035),(sub?0.02:-0.035),(sub?0.07:0.05),scr,oc);
      const btn=lam(0xd9dcdf,{roughness:0.4});
      if(sub){ [-0.025,0,0.025].forEach(function(z){ P.cyl(0.027,z,0.007,0.007,-0.045,-0.03,btn,oc,12); }); }
      else { [[-0.1,0.55],[0.0,0.0],[0.1,-0.55]].forEach(function(q,i){ P.box(0.025,0.028,0.045,0.08,-0.04+i*0.03,-0.018+i*0.03,i===1?lam(0x2f8f5b,{roughness:0.4}):btn,oc); }); P.cyl(0.025,0.062,0.004,0.004,-0.052,-0.048,lam(0x3cc96b,{emissive:0x2a9a50}),oc,10); }   // 応答 (green), 通話, 終了; a status LED
      P.screen=scr; return P;
    };
    /* エコキュート remote: kitchen (white, 12 x 12 cm) or bath (waterproof, grey bezel); small LCD showing the set temperature */
    Catalog.ecoRemote=function(bath){   // 12 x 12 x 2 cm, back at x=0, front +x: a recessed colour LCD, labelled keys, a speaker grille
      const P=new Piece(), lam=env.lam, oc={cast:false}, W=0.06, H=0.06;
      P.rbox(0,0.02,-W,W,-H,H,0.008,lam(bath?0xe9eaeb:0xf6f5f2,{roughness:bath?0.22:0.35}));
      const c=document.createElement('canvas'); c.width=480; c.height=480; const g=c.getContext('2d'); g.scale(2,2);
      g.fillStyle=bath?'#e9eaeb':'#f6f5f2'; g.fillRect(0,0,240,240); g.fillStyle='#1d2a33'; g.fillRect(28,22,184,98); g.fillStyle='#e7f1f6'; g.font='12px sans-serif'; g.fillText(bath?'おふろ':'給湯温度',38,40); g.fillText('12:30',172,40);
      g.font='bold 40px sans-serif'; g.fillText('42',60,92); g.font='18px sans-serif'; g.fillText('℃',112,92); g.fillStyle='#ffb45a'; g.font='12px sans-serif'; g.fillText('ふろ自動',150,70);
      g.strokeStyle='#8fd0ff'; g.strokeRect(150,80,50,14); g.fillStyle='#8fd0ff'; g.fillRect(152,82,34,10); g.font='9px sans-serif'; g.fillText('残湯',150,110);   // hot water left in the tank
      const keys=bath?['湯はり','追いだき','▲','▼','通話']:['湯はり','追いだき','▲','▼','通話'];
      keys.forEach(function(k,i){ const x=8+i*45; g.fillStyle='#ffffff'; g.strokeStyle='#c9cbcd'; g.lineWidth=1.5; g.beginPath(); g.roundRect?g.roundRect(x,140,42,24,6):g.rect(x,140,42,24); g.fill(); g.stroke(); g.fillStyle='#3a3d41'; g.font='bold 9px sans-serif'; g.textAlign='center'; g.fillText(k,x+21,156); g.textAlign='left'; });
      g.fillStyle='#ffffff'; g.beginPath(); g.arc(196,200,14,0,Math.PI*2); g.fill(); g.strokeStyle='#c9cbcd'; g.stroke(); g.fillStyle='#3a3d41'; g.font='bold 9px sans-serif'; g.textAlign='center'; g.fillText('給湯',196,204); g.fillStyle='#2fd06a'; g.beginPath(); g.arc(214,184,3,0,Math.PI*2); g.fill();
      g.fillStyle='#b9bcc0'; for(let r=0;r<3;r++) for(let q=0;q<6;q++){ g.beginPath(); g.arc(40+q*10,190+r*9,2,0,Math.PI*2); g.fill(); }   // speaker
      const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=env.anisotropy||4;
      const f=new THREE.Mesh(new THREE.PlaneGeometry(0.108,0.108),new THREE.MeshBasicMaterial({map:tx})); f.rotation.y=Math.PI/2; f.position.set(0.0205,0,0); P.add(f,oc);
      P.group.userData.keep=true; return P;   // kept out of the static merge so the printed face survives
    };
    /* Tiger PRO ECO NEUT 1 L household extinguisher: bottle Ø9.5 x 35 cm, 12 cm deep with the handle; front +x */
    Catalog.fireExtinguisher=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, R=0.0475, body=lam(0xe9e3d8,{roughness:0.7}), chrome=lam(0xd6dade,{metalness:0.9,roughness:0.2}), blk=lam(0x1d1e21,{roughness:0.5});
      const tx=labelTex(256,512,function(g,w,h){ g.fillStyle='#e9e3d8'; g.fillRect(0,0,w,h); g.fillStyle='#f3efe7'; g.fillRect(0,h-56,w,56); g.save(); g.translate(w*0.5,h*0.62); g.rotate(-Math.PI/2); g.fillStyle='#8c8a86'; g.textAlign='center'; g.font='bold 30px sans-serif'; g.fillText('ECO NEUT',0,-6); g.font='16px sans-serif'; g.fillText('fire extinguisher',0,18); g.restore();
        g.fillStyle='#8c8a86'; g.beginPath(); g.arc(w*0.5,h*0.26,16,0,Math.PI*2); g.fill(); g.fillStyle='#e9e3d8'; g.beginPath(); g.moveTo(w*0.5-12,h*0.26-8); g.lineTo(w*0.5-6,h*0.26-20); g.lineTo(w*0.5-2,h*0.26-9); g.lineTo(w*0.5+2,h*0.26-9); g.lineTo(w*0.5+6,h*0.26-20); g.lineTo(w*0.5+12,h*0.26-8); g.fill(); });   // the cat-tiger mark
      const pts=[[0,0],[R-0.004,0],[R,0.006],[R,0.27],[R*0.92,0.295],[R*0.6,0.312],[0.016,0.318],[0,0.318]].map(function(q){ return new THREE.Vector2(q[0],q[1]); });
      const bm=new THREE.Mesh(new THREE.LatheGeometry(pts,28),new THREE.MeshStandardMaterial({map:tx,roughness:0.7})); bm.rotation.y=-Math.PI/2; P.add(bm);
      P.cyl(0,0,0.014,0.016,0.318,0.338,chrome,undefined,16);
      const ga=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.008,20),lam(0xf4f4f2)); ga.rotation.z=Math.PI/2; ga.position.set(0.02,0.33,0); P.add(ga,oc);
      const gt=labelTex(64,64,function(g){ g.fillStyle='#fff'; g.fillRect(0,0,64,64); [['#d33',0.6,1.1],['#3a3',1.1,2.0],['#eb3',2.0,2.5]].forEach(function(q){ g.strokeStyle=q[0]; g.lineWidth=10; g.beginPath(); g.arc(32,36,20,Math.PI*q[1],Math.PI*q[2]); g.stroke(); }); });
      const gf=new THREE.Mesh(new THREE.CircleGeometry(0.0095,16),new THREE.MeshBasicMaterial({map:gt})); gf.rotation.y=Math.PI/2; gf.position.set(0.0245,0.33,0); P.add(gf,oc);
      const ns=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.006,0.04,10),chrome); ns.rotation.x=Math.PI/2; ns.position.set(0,0.336,0.022); P.add(ns,oc);   // short nozzle to her left
      const hd=P.box(-0.02,0.07,-0.008,0.008,0.346,0.354,blk); const lv=P.box(-0.02,0.06,-0.007,0.007,0.364,0.372,blk); lv.rotation.z=-0.18;   // carrying grip, the lever above it
      const pin=new THREE.Mesh(new THREE.TorusGeometry(0.009,0.002,6,14),lam(0xf2c230,{roughness:0.4})); pin.position.set(0.0,0.37,0.012); P.add(pin,oc);
      P._col(-R,R,-R,R,false); return P;
    };
    Catalog.shoe=shoeObj;

    return Catalog;
  };
})(window);
