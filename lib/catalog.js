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
    const THREE=env.THREE, M=env.M;

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
      cabDoors(run,a0,a1,plane,side,y0,y1,n,low,mat){   // door fronts with seams and bar handles on one face of a cabinet
        const w=(a1-a0)/n, t=0.016, d={cast:false}, dd={cast:false,detail:true};
        const p0=side>0?plane:plane-t, p1=side>0?plane+t:plane, h0=side>0?plane+t:plane-t-0.012, h1=side>0?plane+t+0.012:plane-t;
        for(let i=0;i<n;i++){
          const ca=a0+w*i, hx=ca+w*(i%2?0.14:0.86), hy0=low?y0+0.05:y1-0.21, hy1=hy0+0.15;
          if(run==='x'){ this.box(ca+0.003,ca+w-0.003,p0,p1,y0,y1,mat||M.cabF,d); this.box(hx-0.008,hx+0.008,h0,h1,hy0,hy1,M.steel,dd); }
          else { this.box(p0,p1,ca+0.003,ca+w-0.003,y0,y1,mat||M.cabF,d); this.box(h0,h1,hx-0.008,hx+0.008,hy0,hy1,M.steel,dd); }
        }
      }
    }

    /* ---------- pieces ---------- */
    const Catalog={ Piece:Piece, fitUV:fitUV };


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
    Catalog.tvBoard=function(){
      const P=new Piece(), S=0.01213;
      P.rb(0,0,0.4,1.4,0.36,0.015,M.oak,0.08,true);
      P.legs(0,0,0.15,0.62,0.08,0.03,0.02,M.oakD);
      P.cabDoors('z',-0.68,0.68,-0.2,-1,0.1,0.42,3,false,M.oakD);
      const cx=2*S, cz=0, W=1.24, Hh=0.70, y0=0.58;                           // the TV sits 2 plan pixels east of the board centre
      [-1,1].forEach(s=>{                                                     // two flat feet with short necks
        P.rbox(cx-0.11,cx+0.09,cz+s*0.46-0.035,cz+s*0.46+0.035,0.44,0.455,0.006,M.black);
        P.box(cx-0.01,cx+0.02,cz+s*0.46-0.02,cz+s*0.46+0.02,0.455,y0+0.02,M.black);
      });
      P.rbox(cx-0.0,cx+0.045,cz-0.34,cz+0.34,y0+0.1,y0+0.1+0.46,0.012,M.black);   // thicker rear housing
      P.box(cx-0.03,cx+0.0,cz-W/2,cz+W/2,y0,y0+Hh,M.black);                       // slim panel body, 3 cm
      const bz=0.009;                                                             // thin bezel around the glass
      const sm=new THREE.MeshStandardMaterial({color:0x04060a,roughness:0.05,metalness:0.25,envMapIntensity:1.6});
      const gl=new THREE.Mesh(new THREE.PlaneGeometry(W-2*bz,Hh-2*bz),sm);
      gl.rotation.y=-Math.PI/2; gl.position.set(cx-0.0305,y0+Hh/2,cz); P.add(gl,{cast:false,recv:false});
      P.box(cx-0.032,cx-0.0295,cz-0.012,cz+0.012,y0+0.004,y0+0.0075,new THREE.MeshBasicMaterial({color:0x2a2a2a}),{cast:false});   // standby LED
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
      (function(){                                                                // enclosed 3D printer (38 x 38 x 46 cm)
        const px=0.76, pz=-0.03, w=0.38, d=0.38, h=0.46, y=0.72, o={}, oc={cast:false};
        const frame=lam(0x1c1e21,{roughness:0.45}), gl=lam(0x9fb2bf,{transparent:true,opacity:0.22,roughness:0.05,metalness:0.1,envMapIntensity:1,side:THREE.DoubleSide,depthWrite:false});
        P.box(px-w/2,px+w/2,pz-d/2,pz+d/2,y,y+0.06,frame,o); P.box(px-w/2,px+w/2,pz-d/2,pz+d/2,y+h-0.02,y+h,frame,o);   // base and top
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ P.box(px+c[0]*(w/2-0.012)-0.012,px+c[0]*(w/2-0.012)+0.012,pz+c[1]*(d/2-0.012)-0.012,pz+c[1]*(d/2-0.012)+0.012,y,y+h,frame,o); });
        P.box(px-w/2,px-w/2+0.006,pz-d/2,pz+d/2,y+0.06,y+h-0.02,frame,o); P.box(px+w/2-0.006,px+w/2,pz-d/2,pz+d/2,y+0.06,y+h-0.02,frame,o); P.box(px-w/2,px+w/2,pz-d/2,pz-d/2+0.006,y+0.06,y+h-0.02,frame,o);
        P.box(px-w/2+0.01,px+w/2-0.01,pz+d/2-0.004,pz+d/2,y+0.06,y+h-0.02,gl,oc);                            // glass door
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
        P.anims.push(function(t,state){
          const active=!!(state&&state.active);
          if(active){ prog+=0.0005; if(prog>1.25) prog=0; }                     // print, pause on the finished robot, start again
          P.group.getWorldPosition(tmp);
          const hgt=0.002+0.108*prog; clip.constant=tmp.y+y+0.078+hgt;           // clipping planes work in world space
          const lift=Math.min(hgt,0.11); head.position.y=hy0-0.12+lift; rail.position.y=ry0-0.07+lift;
          const mx=active?Math.sin(t*3.1)*0.045:0, mz=active?Math.cos(t*2.3)*0.04:0;
          head.position.x=px-0.03+mx; head.position.z=pz+0.02+mz; rail.position.z=rz0+0.02+mz;
        });
      })();
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
    Catalog.bed=function(){
      const P=new Piece();
      P.rb(0,0,1.64,1.99,0.2,0.02,M.oakD,0.08,true);                          // frame on short legs
      P.legs(0,0,0.76,0.94,0.08,0.03,0.025,M.oakD);
      P.rb(0,0,1.6,1.95,0.2,0.08,M.bedA,0.28,false);                          // mattress
      P.rb(0,0.325,1.64,1.3,0.1,0.06,M.bedB,0.46,false);                      // duvet, draped over both sides
      P.fb(-0.82,0.325,0.025,1.3,0.22,M.bedB,0.28,false); P.fb(0.82,0.325,0.025,1.3,0.22,M.bedB,0.28,false);
      P.rb(0,-0.315,1.62,0.2,0.13,0.06,M.bedB,0.47,false);                    // folded top edge
      P.rb(-0.38,-0.695,0.6,0.38,0.15,0.07,M.pillow,0.48,false);
      P.rb(0.38,-0.695,0.6,0.38,0.15,0.07,M.pillow,0.48,false);
      return P;
    };

    /* 40 x 40 cm bedside table with a lamp; the drawer seam is on the -z face. extras = a book and a cup on top. */
    Catalog.bedsideTable=function(extras){
      const P=new Piece();
      P.rb(0,0,0.4,0.4,0.45,0.02,M.oak,0,true);
      P.fb(0,-0.2,0.34,0.01,0.12,M.oakD,0.3,false);                           // drawer seam
      P.cyl(0,0,0.05,0.05,0.45,0.6,M.steel,{cast:false},10);
      P.shade(0,0,0.13,0.1,0.58,0.75);
      if(extras){ P.fb(0.12,-0.1,0.12,0.16,0.03,env.fab(0x8a9a86),0.45,false); P.cyl(0.1,-0.08,0.035,0.03,0.48,0.56,M.ceramic,{cast:false},12); }
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
    function shoeMat(c){ return shoeMatC[c]||(shoeMatC[c]=lam(c,{roughness:0.6})); }
    function shoeGeo(name,build){ return shoeGeoC[name]||(shoeGeoC[name]=build()); }
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
    function shoeObj(kind,c1,c2){
      const G=new THREE.Group();
      const add=function(g,m,x,y,z,cast){ const me=new THREE.Mesh(g,m); me.position.set(x||0,y||0,z||0); me.castShadow=cast!==false; me.receiveShadow=true; G.add(me); return me; };
      const bx=function(w,h,d){ return shoeGeo('b'+w+'_'+h+'_'+d,function(){ return new THREE.BoxGeometry(w,h,d); }); };
      if(kind==='sneaker'){
        add(shoeGeo('sneakerS',function(){ return shoeExtr(shoeSole(0.03,0),SW+0.004,0.004); }),shoeMat(c2||0xf1efe9));
        add(shoeGeo('sneakerU',function(){
          const s=new THREE.Shape(); s.moveTo(-0.125,0.03); s.lineTo(-0.13,0.075); s.quadraticCurveTo(-0.13,0.088,-0.115,0.086); s.lineTo(-0.075,0.074);
          s.quadraticCurveTo(-0.05,0.07,-0.03,0.09); s.lineTo(-0.018,0.1); s.quadraticCurveTo(0.03,0.085,0.075,0.07); s.quadraticCurveTo(0.12,0.062,0.138,0.045); s.quadraticCurveTo(0.146,0.036,0.14,0.03); s.closePath();
          return shoeExtr(s,SW,0.006); }),shoeMat(c1));
        for(let i=0;i<4;i++){ const x=-0.005+0.024*i, y=0.098-0.32*(x+0.018)+0.002; add(bx(0.012,0.004,SW*0.8),shoeMat(0xf3f1ea),x,y,0,false).rotation.z=-0.31; }
        add(bx(0.026,0.014,SW*0.5),shoeMat(c2||0xf1efe9),-0.118,0.066,0,false);
        add(bx(0.05,0.006,SW*0.55),shoeMat(0x18181a),-0.096,0.083,0,false).rotation.z=-0.29;     // ankle opening
      } else if(kind==='boot'){
        add(shoeGeo('bootS',function(){ return shoeExtr(shoeSole(0.034,0),SW+0.004,0.004); }),shoeMat(0x242426));
        add(bx(0.07,0.02,SW),shoeMat(0x242426),-0.095,0.044,0);
        add(shoeGeo('bootU',function(){
          const s=new THREE.Shape(); s.moveTo(-0.125,0.034); s.lineTo(-0.13,0.165); s.lineTo(-0.035,0.17); s.lineTo(-0.028,0.105); s.quadraticCurveTo(0.03,0.085,0.08,0.075);
          s.quadraticCurveTo(0.125,0.068,0.14,0.05); s.quadraticCurveTo(0.148,0.04,0.142,0.034); s.closePath(); return shoeExtr(s,SW,0.008); }),shoeMat(c1));
        add(bx(0.012,0.1,SW*0.3),shoeMat(0x1c1c1e),-0.03,0.12,0,false);
        add(bx(0.09,0.006,SW*0.7),shoeMat(0x151516),-0.082,0.171,0,false);                     // top opening of the shaft
      } else if(kind==='loafer'){
        add(shoeGeo('loaferS',function(){ return shoeExtr(shoeSole(0.02,0.012),SW+0.002,0.003); }),shoeMat(0x2a2220));
        add(shoeGeo('loaferU',function(){
          const s=new THREE.Shape(); s.moveTo(-0.126,0.034); s.lineTo(-0.129,0.066); s.quadraticCurveTo(-0.128,0.076,-0.112,0.074); s.lineTo(-0.045,0.066);
          s.quadraticCurveTo(-0.025,0.062,-0.012,0.08); s.quadraticCurveTo(0.03,0.078,0.075,0.066); s.quadraticCurveTo(0.125,0.058,0.138,0.046); s.quadraticCurveTo(0.146,0.038,0.14,0.034); s.closePath();
          return shoeExtr(s,SW,0.006); }),shoeMat(c1));
        add(bx(0.03,0.01,SW*0.9),shoeMat(c2||0x8a6a4a),0.03,0.077,0,false);
        add(bx(0.05,0.006,SW*0.6),shoeMat(0x151516),-0.08,0.074,0,false).rotation.z=-0.1;     // opening
      } else if(kind==='pump'){
        add(shoeGeo('pumpS',function(){
          const s=new THREE.Shape(); s.moveTo(0.148,0.004); s.quadraticCurveTo(0.148,0,0.138,0); s.lineTo(0.05,0); s.lineTo(-0.04,0.035); s.lineTo(-0.115,0.07); s.lineTo(-0.134,0.078); s.lineTo(-0.134,0.09);
          s.lineTo(-0.115,0.088); s.lineTo(-0.04,0.052); s.lineTo(0.05,0.014); s.lineTo(0.14,0.014); s.closePath(); return shoeExtr(s,SW*0.85,0.003); }),shoeMat(c1));
        add(shoeGeo('pumpV',function(){
          const s=new THREE.Shape(); s.moveTo(0.146,0.012); s.quadraticCurveTo(0.146,0.034,0.12,0.046); s.quadraticCurveTo(0.09,0.056,0.05,0.05); s.lineTo(0.02,0.026); s.lineTo(0.06,0.014); s.closePath(); return shoeExtr(s,SW,0.006); }),shoeMat(c1));
        add(shoeGeo('pumpH',function(){
          const s=new THREE.Shape(); s.moveTo(-0.136,0.09); s.lineTo(-0.132,0.13); s.quadraticCurveTo(-0.12,0.135,-0.09,0.118); s.lineTo(-0.07,0.088); s.lineTo(-0.1,0.074); s.closePath(); return shoeExtr(s,SW*0.9,0.005); }),shoeMat(c1));
        const heel=add(shoeGeo('heelCone',function(){ return new THREE.CylinderGeometry(0.009,0.005,0.08,10); }),shoeMat(c1),-0.125,0.04,0);
      } else {                                                   // sandal / slide
        add(shoeGeo('sandalS',function(){ return shoeExtr(shoeSole(0.026,0),SW+0.006,0.006); }),shoeMat(c2||0xcdb89a));
        add(bx(0.06,0.026,SW+0.002),shoeMat(c1),0.03,0.045,0);
        add(bx(0.022,0.02,SW+0.002),shoeMat(c1),-0.07,0.04,0);
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
      const paint=new THREE.MeshPhysicalMaterial({color:0x4b5058,metalness:0.55,roughness:0.32,clearcoat:1,clearcoatRoughness:0.04,envMapIntensity:1.4,vertexColors:true,side:THREE.DoubleSide});
      const glass=new THREE.MeshPhysicalMaterial({color:0x06080a,metalness:0.3,roughness:0.02,envMapIntensity:2,transparent:true,opacity:0.9,clearcoat:1}), paintS=paint.clone(); paintS.vertexColors=false;
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
      const body=new THREE.Mesh(loft(st,section,0.03),paint); P.add(body);
      const sideX=function(z,y){ const s=section(z).slice(4,9); for(let i=0;i<s.length-1;i++) if(y>=s[i][1]&&y<=s[i+1][1]){ const k=(y-s[i][1])/Math.max(s[i+1][1]-s[i][1],1e-4); return s[i][0]+(s[i+1][0]-s[i][0])*k; } return s[4][0]; };
      const endZ=function(x,front){ let lo=front?1.6:ZR, hi=front?ZF:-1.6; for(let i=0;i<30;i++){ const m=(lo+hi)/2; if((hw(m)>x)===front) lo=m; else hi=m; } return (lo+hi)/2; };   // where the plan outline reaches half-width x
      /* glass greenhouse (glass roof, as on the real car), black B-pillars and window trim */
      const GF=1.03, GR=-1.97;
      const yg=smooth([[GR,0.0],[-1.7,0.14],[-1.25,0.33],[-0.7,0.46],[-0.1,0.5],[0.25,0.49],[0.6,0.36],[0.85,0.17],[GF,0.0]]);
      const gst=[]; for(let i=0;i<=60;i++) gst.push(GR+(GF-GR)*i/60);
      const gsec=function(z){ const base=yt(z)-0.01, h=Math.max(yg(z),0.0015), hb=hw(z)-0.1, hr=Math.min(0.6,hb-0.04);
        return [[0,base,0],[hb,base,0],[hb-0.07,base+h*0.45,0],[hr,base+h*0.93,0],[hr*0.5,base+h,0],[0,base+h+0.004,0]]; };
      const gh=new THREE.Mesh(loft(gst,gsec,1),glass); gh.renderOrder=2; P.add(gh,{cast:false});
      const gX=function(z,f){ const s=gsec(z), y=s[0][1]+(s[3][1]-s[0][1])*f; return [s[1][0]+(s[3][0]-s[1][0])*f, y]; };
      const strip=function(pts,r,mat){ const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); })),Math.max(pts.length*3,8),r,6,false),mat); P.add(m,{cast:false}); return m; };
      [-1,1].forEach(function(sx){
        const bp=[]; for(let f=0;f<=0.86;f+=0.1){ const q=gX(-0.12,f); bp.push([sx*(q[0]+0.004),q[1],-0.12]); } strip(bp,0.02,satin);                     // B-pillar
        const sill=[]; for(let z=GR+0.12;z<=GF-0.05;z+=0.1) sill.push([sx*(hw(z)-0.098),yt(z)+0.004,z]); strip(sill,0.012,satin);                      // belt trim
        /* door shut lines and flush handles */
        [1.0,-0.12,-1.02].forEach(function(z){ const pts=[]; for(let y=Math.max(arch(z)+0.03,yb(z)+0.08);y<=yt(z)-0.02;y+=0.05) pts.push([sx*(sideX(z,y)+0.0015),y,z]); if(pts.length>2) strip(pts,0.0035,satin); });
        [0.38,-0.62].forEach(function(z){ P.box(sx*(sideX(z,0.86)-0.004)-0.006,sx*(sideX(z,0.86)-0.004)+0.006,z-0.1,z+0.1,0.84,0.875,piano,{cast:false}); });
        /* door mirror on a black base */
        const mb=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.12),satin); mb.position.set(sx*(hw(0.92)-0.06),yt(0.92)+0.03,0.92); P.add(mb);
        const mh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),paintS); mh.scale.set(0.085,0.062,0.115); mh.position.set(sx*(hw(0.9)+0.04),yt(0.9)+0.08,0.88); P.add(mh);
        const mg=new THREE.Mesh(new THREE.CircleGeometry(1,20),lam(0x9aa4ad,{metalness:1,roughness:0.05})); mg.scale.set(0.07,0.05,1); mg.rotation.y=Math.PI; mg.position.set(sx*(hw(0.9)+0.04),yt(0.9)+0.08,0.775); P.add(mg,{cast:false});
        /* headlight: smoked lens sweeping round the corner, LED brow inside */
        const hl=[]; for(let x=0.9;x>=0.42;x-=0.04){ const z=endZ(x,true)-0.012; hl.push([sx*x,yt(z)-0.035-(0.9-x)*0.04,z]); }
        const lens=strip(hl,0.034,lam(0x14171b,{roughness:0.03,metalness:0.6,envMapIntensity:1.8})); lens.scale.y=0.7;
        strip(hl.slice(2,-1).map(function(q){ return [q[0]*1.004,q[1]-0.006,q[2]+0.006]; }),0.012,lam(0xb8bcc2,{metalness:1,roughness:0.15}));
        strip(hl.slice(1,-1).map(function(q){ return [q[0]*1.012,q[1]+0.012,q[2]]; }),0.006,lam(0xffffff,{emissive:0xdfe8ff,emissiveIntensity:1.2}));
        /* tail light wrapping from the boot lid onto the quarter */
        const tl=[]; for(let z=-1.98;z>=-2.2;z-=0.04){ tl.push([sx*(sideX(z,0.86)+0.002),0.885,z]); } for(let x=sideX(-2.24,0.86)-0.01;x>=0.46;x-=0.04) tl.push([sx*x,0.89,endZ(x,false)+0.008]);
        strip(tl,0.03,lam(0x8a0d0d,{emissive:0x5a0303,roughness:0.08,metalness:0.2}));
        strip(tl.map(function(q){ return [q[0]*1.004,q[1]+0.018,q[2]-0.004]; }),0.006,lam(0xff3a2a,{emissive:0xff2010,emissiveIntensity:1.0}));
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
      badge(2.29,0.585,1); badge(-2.325,0.955,0.9);
      P.box(-0.5,0.5,ZR-0.022,ZR+0.06,0.4,0.47,lam(0x1a1c1f,{roughness:0.6}),{cast:false});
      /* number plates (private car: white with green characters) */
      const plate=function(z,y,rot){ const m=new THREE.Mesh(new THREE.PlaneGeometry(0.33,0.165),lam(0xffffff,{map:plateTex('品川 300',['た','12-34']),roughness:0.4})); m.position.set(0,y,z); m.rotation.y=rot; P.add(m,{cast:false});
        const fr=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.185,0.01),satin); fr.position.set(0,y,z-Math.sign(z)*0.007); P.add(fr,{cast:false}); };
      plate(ZF+0.025,0.42,0); plate(ZR-0.045,0.6,Math.PI);
      /* charge port, hidden in the left tail light housing (left = +x when facing forward) */
      const cpz=-2.02, cpx=sideX(cpz,0.85)+0.004; P.box(cpx-0.003,cpx+0.004,cpz-0.05,cpz+0.05,0.81,0.89,piano,{cast:false});
      P.port=[cpx+0.01,0.85,cpz];
      /* cabin seen through the glass: white seats, wood-and-fabric dash, 15" landscape screen, steering wheel on the right */
      const seat=lam(0xe9e6e0,{roughness:0.6}), inner=lam(0x26282b,{roughness:0.7});
      P.box(-0.84,0.84,-1.85,1.0,0.22,0.3,inner,{cast:false});
      [[-0.37,0.0],[0.37,0.0]].forEach(function(s){ P.rb(s[0],s[1],0.5,0.5,0.1,0.05,seat,0.3,false); const bk=P.rb(s[0],s[1]-0.27,0.48,0.12,0.6,0.06,seat,0.38,false); bk.rotation.x=-0.18; P.rb(s[0],s[1]-0.33,0.24,0.08,0.16,0.04,seat,1.02,false); });
      P.rb(0,-0.92,1.4,0.5,0.1,0.05,seat,0.3,false); const rb=P.rb(0,-1.17,1.4,0.12,0.55,0.06,seat,0.38,false); rb.rotation.x=-0.22;
      P.box(-0.82,0.82,0.72,1.0,0.55,0.86,inner,{cast:false}); P.box(-0.8,0.8,0.62,0.72,0.74,0.79,lam(0xa47c56,{roughness:0.55}),{cast:false});
      P.box(-0.14,0.14,0.18,0.62,0.3,0.55,inner,{cast:false});
      const scr=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.24,0.015),piano); scr.position.set(0,0.98,0.6); scr.rotation.x=-0.25; P.add(scr,{cast:false});
      const sc2=new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.22),lam(0x1c2a3a,{emissive:0x274a6e,emissiveIntensity:0.6})); sc2.position.set(0,0.98,0.592); sc2.rotation.set(-0.25,Math.PI,0); P.add(sc2,{cast:false});
      const sw=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.018,10,32),inner); sw.position.set(-0.37,0.86,0.5); sw.rotation.x=-0.35; P.add(sw,{cast:false});
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
    Catalog.toilet=function(){
      const P=new Piece(), cer=M.ceramic, seat=mat('seat',0xf3f2ee,{roughness:0.3});
      P.rbox(-0.37,-0.16,-0.19,0.19,0.42,0.8,0.05,cer);
      P.rbox(-0.25,0.14,-0.13,0.13,0,0.36,0.08,cer);
      const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.14,0.2,28),cer); bowl.scale.x=1.25; bowl.position.set(0.05,0.28,0); P.add(bowl);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.155,0.03,8,28),seat); ring.rotation.x=Math.PI/2; ring.scale.set(1.22,1,1); ring.position.set(0.05,0.4,0); P.add(ring);
      flatDisc(P,0.19,1.22,0.44,0.05,0,seat,{cast:true});
      P.rbox(-0.2,-0.08,-0.2,0.2,0.38,0.47,0.02,seat);
      P.box(-0.1,0.08,0.2,0.24,0.5,0.6,mat('ctl',0xdfe2e4,{roughness:0.3}));
      P._col(-0.37,0.3,-0.2,0.24,true);
      return P;
    };
    /* 1.5 m bathtub (78 cm deep, 55 cm high), filled with water; the apron faces +x, the tap is on the -x wall */
    Catalog.bathtub=function(len){                // len: outside length along z, so the tub can run wall to wall (default 1.5 m)
      const P=new Piece(), shell=mat('tub',0xe8e1d6,{roughness:0.25,envMapIntensity:0.7}), inner=mat('tubIn',0xcfe6ef,{roughness:0.15});   // warm greige shell so the tub reads against white tiles
      const L=(len||1.5)/2, D=0.39, H=0.55, t=0.08;
      P.rbox(-D,D,-L,-L+t,0,H,0.03,shell); P.rbox(-D,D,L-t,L,0,H,0.03,shell);
      P.rbox(-D,-D+t,-L,L,0,H,0.03,shell); P.rbox(D-t,D,-L,L,0,H,0.03,shell);
      P.box(-D+t,D-t,-L+t,L-t,0,0.12,inner);
      const w=new THREE.Mesh(new THREE.PlaneGeometry(2*(D-t),2*(L-t)),mat('water',0x6fbfdc,{transparent:true,opacity:0.6,roughness:0.02,metalness:0.1,envMapIntensity:1.4,depthWrite:false}));
      w.rotation.x=-Math.PI/2; w.position.set(0,0.42,0); P.add(w,{cast:false,recv:false});
      P.cyl(-D+0.04,0,0.018,0.018,H,H+0.12,M.steel,{cast:false},10); P.box(-D+0.03,-D+0.16,-0.015,0.015,H+0.1,H+0.13,M.steel,{cast:false});
      P._col(-D,D,-L,L,true);
      return P;
    };
    /* 75 cm wash basin unit: two-door cabinet that opens (toothbrushes, toothpaste, towels and spares inside, a small light), ceramic top with a basin,
       gooseneck tap and a lit mirror cabinet; faces +x */
    Catalog.vanity=function(){
      const P=new Piece(), lam=env.lam, cab=mat('vcab',0xf1eee8,{roughness:0.45}), cer=M.ceramic, oc={cast:false};
      const fx=0.26, hz=0.375, shelf=0.44, floorB=0.08;
      P.box(-0.275,-0.26,-hz,hz,0.06,0.78,cab); [-1,1].forEach(function(sd){ P.box(-0.26,fx,sd*hz-0.009,sd*hz+0.009,0.06,0.78,cab); });
      P.box(-0.26,fx,-hz,hz,0.06,floorB,cab); P.box(-0.26,fx-0.02,-hz,hz,shelf-0.02,shelf,cab); P.box(-0.26,fx,-hz,hz,0.76,0.78,cab);
      P.box(-0.25,0.24,-0.36,0.36,0,0.06,M.dark,oc);
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
      P.rbox(-0.275,0.285,-0.38,0.38,0.78,0.85,0.02,cer);
      flatDisc(P,0.17,1.35,0.8505,0.07,0,mat('basin',0xe4e6e6,{roughness:0.15}));
      flatDisc(P,0.015,1,0.852,0.07,0,M.steel);
      P.cyl(-0.18,0,0.018,0.018,0.85,1.06,M.steel,oc,10); P.box(-0.19,-0.06,-0.014,0.014,1.04,1.07,M.steel,oc);
      P.box(-0.275,-0.13,-0.375,0.375,1.05,1.95,cab);
      const mir=env.mirror?env.mirror(0.72,0.76):new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.76),mat('mirror',0xdfe8ec,{metalness:1,roughness:0.03,envMapIntensity:1}));
      mir.position.set(-0.128,1.5,0); mir.rotation.y=Math.PI/2; P.group.add(mir);
      P.box(-0.13,-0.11,-0.36,0.36,1.89,1.93,mat('vlight',0xfff6e0,{emissive:0xffe8c0}),oc);
      P._col(-0.275,0.285,-0.38,0.38,true);
      return P;
    };
    /* Japanese drum washer-dryer (about W 64 x D 72 x H 106 cm, like the Panasonic / Hitachi drum models): the door sits high and tilted up
       for easy loading, control panel along the top front edge, detergent drawer top left; the front faces +x */
    Catalog.washer=function(){
      const P=new Piece(), body=mat('wash',0xf3f4f4,{roughness:0.35}), lam=env.lam, oc={cast:false};
      const D=0.36, W=0.32, H=1.06, fx=D;
      P.rbox(-D,D-0.06,-W,W,0.0,H,0.03,body);                                            // cabinet
      P.box(-D+0.02,D-0.07,-W+0.02,W-0.02,0,0.03,M.dark,oc);                              // shadow gap at the floor
      /* tilted front: lower part vertical, upper part leaning back 10 degrees, door in it */
      P.rbox(D-0.07,D,-W,W,0.0,0.32,0.02,body);
      const face=new THREE.Group(); face.position.set(D-0.035,0.32,0); face.rotation.z=0.17; P.group.add(face);
      const fm=function(geo,mt,x,y,z,ry,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); if(ry!==undefined) m.rotation.y=ry; m.castShadow=!!cast; m.receiveShadow=true; face.add(m); return m; };
      fm(new THREE.BoxGeometry(0.07,0.66,0.64),body,0,0.33,0,undefined,true);
      const ring=fm(new THREE.TorusGeometry(0.205,0.032,12,40),mat('wring',0xc9ced3,{metalness:0.7,roughness:0.25,envMapIntensity:1}),0.04,0.3,0,Math.PI/2);
      fm(new THREE.CircleGeometry(0.19,40),mat('wglass',0x1d2a35,{metalness:0.5,roughness:0.08,envMapIntensity:1}),0.043,0.3,0,Math.PI/2);
      fm(new THREE.CircleGeometry(0.13,32),lam(0x7d8890,{metalness:0.6,roughness:0.4}),0.041,0.3,0,Math.PI/2);    // drum behind the glass
      fm(new THREE.BoxGeometry(0.03,0.09,0.03),M.steel,0.06,0.3,-0.235);                     // door handle
      fm(new THREE.BoxGeometry(0.012,0.1,0.46),mat('wpanel',0x2a2f35,{roughness:0.2,metalness:0.2}),0.036,0.6,0.05);   // control panel strip
      fm(new THREE.BoxGeometry(0.014,0.03,0.16),mat('wled',0x9fd6ff,{emissive:0x4aa8e8}),0.044,0.6,0.08);
      const knob=fm(new THREE.CylinderGeometry(0.032,0.032,0.025,20),mat('wknob',0xdfe3e6,{metalness:0.6,roughness:0.3}),0.05,0.6,-0.12); knob.rotation.z=Math.PI/2;
      fm(new THREE.BoxGeometry(0.01,0.07,0.17),lam(0xe4e7e9,{roughness:0.3}),0.036,0.6,-0.24);   // detergent drawer
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
      fm(new THREE.BoxGeometry(0.692,0.86,0.014),shell,0,0.495,-0.003); fm(new THREE.BoxGeometry(0.4,0.02,0.02),M.steel,0,0.83,0.014);
      const bw=0.58, bd=0.5, bz=-0.01-bd/2;
      fm(new THREE.BoxGeometry(bw,0.008,bd),liner,0,0.42,bz);
      [-1,1].forEach(function(sd){ fm(new THREE.BoxGeometry(0.008,0.44,bd),liner,sd*bw/2,0.64,bz); });
      fm(new THREE.BoxGeometry(bw,0.44,0.008),liner,0,0.64,bz-bd/2);
      const tag=function(txt,bg,fg){ const c=document.createElement('canvas'); c.width=256; c.height=128; const g=c.getContext('2d'); g.fillStyle=bg; g.fillRect(0,0,256,128); g.translate(256,128); g.scale(-1,-1);
        g.fillStyle=fg; g.font='700 52px "Noto Sans TC","Hiragino Sans",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,128,66);
        const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({map:t,roughness:0.5}); };
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
      dm(new THREE.BoxGeometry(0.7,0.79,0.05),shell,-0.35,1.33,0.015); dm(new THREE.BoxGeometry(0.62,0.72,0.004),liner,-0.35,1.33,-0.012);
      dm(new THREE.BoxGeometry(0.02,0.42,0.03),M.steel,-0.66,1.25,0.055);
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
      P.setDoor=function(t){ const e=ease(t); D.rotation.y=1.85*e; light.intensity=0.18*e; };
      P.setFreezer=function(t){ FD.position.z=zf+0.42*ease(t); };
      const door=stepper(0.8,P.setDoor), frz=stepper(0.7,P.setFreezer);
      P.open={get door(){ return !!door.target; },set door(v){ door.target=v?1:0; },get freezer(){ return !!frz.target; },set freezer(v){ frz.target=v?1:0; }};
      P.anims.push(function(t){ const a=door.run(t), b=frz.run(t); return a||b; });
      P.actions=[{x:-0.22,z:zf+0.25,label:function(){ return door.target?'關上冰箱':'打開冰箱'; },act:function(){ door.target=door.target?0:1; }},
                 {x:0.22,z:zf+0.25,label:function(){ return frz.target?'關上冷凍庫':'打開冷凍庫'; },act:function(){ frz.target=frz.target?0:1; }}];
      return P;
    };

    /* lift-top table: a 50 x 100 cm coffee table that rises to dining height while two leaves slide apart and a centre leaf pops up.
       Long side along z. setFold(0..1) returns {gap, half}: the footprint is 2*half wide (x) and 1.0+gap long (z). */
    Catalog.liftTable=function(){
      const P=new Piece(), G=P.group;
      const lg=function(w,h,d){ const g=new THREE.BoxGeometry(w,h,d); fitUV(g,w,h,d); return g; };
      const mkm=function(geo,mt,par){ const m=new THREE.Mesh(geo,mt); m.castShadow=true; m.receiveShadow=true; par.add(m); return m; };
      const LA=new THREE.Group(), LB=new THREE.Group(); G.add(LA); G.add(LB);
      const mA=mkm(lg(0.5,0.03,0.5),M.oak,LA), mB=mkm(lg(0.5,0.03,0.5),M.oak,LB), mC=mkm(lg(0.5,0.03,0.4),M.oak,G);
      const legs4=[]; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ const l=mkm(new THREE.BoxGeometry(0.045,1,0.045),M.oakD,G); l.userData.c=c; legs4.push(l); });
      mkm(new THREE.BoxGeometry(0.12,0.03,0.18),M.cushB,LA).position.set(0.03,0.03,-0.12);
      mkm(new THREE.CylinderGeometry(0.04,0.035,0.09,14),M.ceramic,LB).position.set(-0.05,0.06,0.1);
      P.setFold=function(t){
        const e1=ease(t/0.5), e2=ease((t-0.35)/0.65), topY=0.40+0.32*e1, gap=0.4*e2, sx=1+0.4*e2, half=0.25*sx;
        LA.position.set(0,topY-0.015,-(0.25+gap/2)); LB.position.set(0,topY-0.015,0.25+gap/2);
        mA.scale.x=sx; mB.scale.x=sx; mC.scale.x=sx;
        const rise=ease((e2-0.55)/0.35); mC.visible=e2>0.02; mC.position.set(0,topY-0.015-0.05*(1-rise),0);
        const h=topY-0.03;
        legs4.forEach(function(l){ const c=l.userData.c; l.scale.y=h; l.position.set(c[0]*(half-0.05),h/2,c[1]*(0.5+gap/2-0.05)); });
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
    function catMats(){ return mats.cwood?mats:(mat('cwood',0xd2b27d,{roughness:0.6}),mat('cdark',0x3a2616,{roughness:0.9}),mat('csisal',0xc9b48b,{roughness:1}),mats.cbed=env.fab(0xd7cfc2),mats); }
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
    const CAT_COLORS={tabby:[0xa07a55,0xf6f2ec,'#4a3626'],grey:[0x8f959b,0xf6f4f0,'#44484d']};
    Catalog.cat=function(kind){                  // a sleeping cat on the floor
      const P=new Piece(), c=CAT_COLORS[kind]||CAT_COLORS.tabby, m=Catalog.catModel(c[0],c[1],c[2]);
      m.group.position.x=0; P.group.add(m.group); P.anims.push(function(t){ m.anim(t); }); return P;
    };
    Catalog.catHouse=function(yb){              // 50 x 42 x 40 cm wall box with a cat-head doorway
      const P=new Piece(), cm=catMats(), G=wallGroup(P,yb), W=0.5, H=0.42, D=0.4;
      const headPts=function(c,s){ return [[-0.11,0.02],[-0.1,0.12],[-0.05,0.08],[0.05,0.08],[0.1,0.12],[0.11,0.02],[0.1,-0.05],[0.06,-0.09],[-0.06,-0.09],[-0.1,-0.05]].map(function(q){ return new THREE.Vector2(q[0]*s,q[1]*s+c); }); };
      cadd(G,cbx(D,0.02,W),cm.cwood,D/2,0.01,0); cadd(G,cbx(D,0.02,W),cm.cwood,D/2,H-0.01,0);
      [-1,1].forEach(function(sd){ cadd(G,cbx(D,H,0.02),cm.cwood,D/2,H/2,sd*(W/2-0.01)); });
      cadd(G,new THREE.PlaneGeometry(W-0.04,H-0.04),cm.cdark,0.006,H/2,0).rotation.y=Math.PI/2;
      const sh=new THREE.Shape([new THREE.Vector2(-W/2,0),new THREE.Vector2(W/2,0),new THREE.Vector2(W/2,H),new THREE.Vector2(-W/2,H)]);
      sh.holes.push(new THREE.Path(headPts(H/2,1.0))); cpanel(G,sh,D-0.02,0.02,cm.cwood);
      cadd(G,cbx(0.2,0.02,W*0.9),cm.cwood,D+0.1,0.01,0);
      return P;
    };
    Catalog.catStep=function(yb){               // 25 x 40 cm step with rounded front corners, sisal top and a triangular bracket
      const P=new Piece(), cm=catMats(), G=wallGroup(P,yb), d=0.25, hw=0.2, r=0.04, sh=new THREE.Shape();
      sh.moveTo(0,-hw); sh.lineTo(d-r,-hw); sh.quadraticCurveTo(d,-hw,d,-hw+r); sh.lineTo(d,hw-r); sh.quadraticCurveTo(d,hw,d-r,hw); sh.lineTo(0,hw); sh.closePath();
      cadd(G,new THREE.ExtrudeGeometry(sh,{depth:0.03,bevelEnabled:false,curveSegments:6}),cm.cwood,0,0,0).rotation.x=-Math.PI/2;
      cadd(G,cbx(0.21,0.005,0.34),cm.csisal,0.115,0.032,0);
      const tri=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(0.17,0),new THREE.Vector2(0,-0.15)]);
      cadd(G,new THREE.ExtrudeGeometry(tri,{depth:0.018,bevelEnabled:false}),cm.cwood,0,0,-0.009);
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
    Catalog.curtains=function(w){
      const P=new Piece(), x0=-w/2, x1=w/2, top=2.12, pw=0.42, ph=top-0.03, meshes=[];
      P.box(x0-0.1,x1+0.1,-0.012,0.012,top,top+0.025,M.frame,{cast:false});
      [x0+pw/2-0.05,x1-pw/2+0.05].forEach(function(cx){
        const g=new THREE.PlaneGeometry(pw,ph,28,1), p=g.attributes.position;
        for(let i=0;i<p.count;i++){ const u=p.getX(i)/pw; p.setZ(i,Math.sin(u*Math.PI*8)*0.045); }
        g.computeVertexNormals();
        const m=new THREE.Mesh(g,M.linen); m.position.set(cx,0.015+ph/2,0); P.add(m); meshes.push(m);
      });
      P.setT=function(t){
        const e=ease(t), W=(x1-x0)/2+0.08, ww=pw+(W-pw)*e;
        meshes[0].scale.set(ww/pw,1,1-0.45*e); meshes[0].position.x=x0-0.05+ww/2;
        meshes[1].scale.set(ww/pw,1,1-0.45*e); meshes[1].position.x=x1+0.05-ww/2;
      };
      const st=stepper(1.6,P.setT);
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
    Catalog.sinkCounter=function(w,d,sink,units){
      const P=new Piece(), lam=env.lam, oc={cast:false};
      const tx0=-0.01, tx1=w, tz0=-0.01, tz1=d+0.04;
      P._col(0,w,0,d,true);
      if(!sink){                                  // plain base cabinet with a worktop (e.g. an island with the hob)
        P.box(0,w,0,d,0,0.84,M.cab); P.rbox(tx0,tx1,tz0,tz1,0.84,0.88,0.01,M.top);
        P.box(0,w,-0.012,0,0,0.1,M.dark,{cast:false}); return fronts(P,w,d,units);
      }
      const sx0=sink[0], sx1=sink[1], sz0=sink[2], sz1=sink[3];
      P.box(0,sx0,0,d,0,0.84,M.cab); P.box(sx1,w,0,d,0,0.84,M.cab);
      P.box(sx0,sx1,0,sz0,0,0.84,M.cab); P.box(sx0,sx1,sz1,d,0,0.84,M.cab); P.box(sx0,sx1,sz0,sz1,0,0.6,M.cab);
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
      for(let i=0;i<9;i++){ const a=i/9*TAU, r=i?0.022:0, h=new THREE.Mesh(new THREE.CircleGeometry(0.0045,8),lam(0x0c0d0e)); h.rotation.x=-Math.PI/2; h.position.set(dx+Math.cos(a)*r,0.7062,dz+Math.sin(a)*r); P.add(h,oc); }
      P.cyl(dx,dz,0.016,0.016,0.7055,0.7062,rimM,oc,16);
      P.box(0,w,-0.012,0,0,0.1,M.dark,oc);
      return fronts(P,w,d,units);
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
        add(new THREE.BoxGeometry(Math.min(0.2,bw*0.6),0.014,0.016),M.steel,cx,y1-0.05,-ft-0.008);   // bar handle
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
        if(u.k==='sink'){ P.cabDoors('x',x0,x1,0,-1,0.1,0.83,2,false); return; }
        if(u.k==='dw'){                            // deep drawer-type built-in dishwasher (45 cm), plates and cups in the rack
          const g=drawer(x0,x1,0.1,0.83,steelF,function(add,cx,bw,bd,fy){
            for(let i=0;i<7;i++){ const pl=add(new THREE.CylinderGeometry(0.11,0.11,0.012,24),i%3?plateM:plateB,cx-0.13+i*0.04,fy+0.13,bd*0.35,true); pl.rotation.z=Math.PI/2; }
            for(let i=0;i<3;i++) add(new THREE.CylinderGeometry(0.04,0.034,0.09,16),i===1?plateB:plateM,cx+0.12,fy+0.05,bd*0.2+i*0.11);
            for(let i=0;i<4;i++){ const b=add(new THREE.SphereGeometry(0.075,18,10,0,Math.PI*2,Math.PI/2,Math.PI/2),plateM,cx-0.1+(i%2)*0.1,fy+0.08,bd*0.72+Math.floor(i/2)*0.08); b.rotation.x=Math.PI*0.15; }
            add(new THREE.BoxGeometry(bw-0.02,0.004,bd-0.02),mat('rack',0x8d949c,{metalness:0.6,roughness:0.4}),cx,fy+0.005,bd/2);
          });
          P.box(x0+0.06,x1-0.06,-ft-0.002,-ft,0.74,0.78,mat('dwPanel',0x23272b,{roughness:0.2}),oc);   // control strip
          P.box(x0+0.08,x0+0.14,-ft-0.003,-ft-0.001,0.75,0.77,mat('dwLed',0x9fd6ff,{emissive:0x4aa8e8}),oc);
          sliders.push({g:[g],out:[0.42],x:(x0+x1)/2,label:['打開洗碗機','關上洗碗機']}); return;
        }
        if(u.k==='spice'){                         // slim full-height pull-out beside the hob: three shelves of seasonings
          const cols=[[0x3a1c10,0.22,0.03,'soy'],[0xd8b46a,0.2,0.028,'mirin'],[0xe8d8a0,0.24,0.03,'oil'],[0xf4f2ec,0.12,0.022,'salt'],[0x2a2a2a,0.11,0.02,'pepper'],[0xc9372c,0.12,0.022,'chili'],[0x8a5a2a,0.16,0.026,'sauce'],[0xe8e2c8,0.14,0.024,'sugar']];
          const g=drawer(x0,x1,0.1,0.83,M.cabF,function(add,cx,bw,bd,fy,bh){
            [fy,fy+0.25,fy+0.5].forEach(function(y,row){
              if(row) add(new THREE.BoxGeometry(bw,0.01,bd),mat('drawerIn',0xf2f0ea,{roughness:0.5}),cx,y,bd/2);
              for(let i=0;i<4;i++){ const c=cols[(row*3+i)%cols.length], r=Math.min(c[2],bw/2-0.008);
                add(new THREE.CylinderGeometry(r,r,c[1],14),lam(c[0],{roughness:0.3,transparent:c[3]==='oil'||c[3]==='mirin',opacity:0.85}),cx,y+0.005+c[1]/2,0.05+i*(bd-0.08)/3,true);
                add(new THREE.CylinderGeometry(r*0.55,r*0.55,0.02,10),lam(c[3]==='soy'?0xd8453c:0xf4f4f0),cx,y+0.015+c[1],0.05+i*(bd-0.08)/3); }
            });
          });
          sliders.push({g:[g],out:[0.45],x:(x0+x1)/2,label:['拉出調味料架','推回調味料架']}); return;
        }
        if(u.k==='drawers'){                       // top: cutlery tray, chopsticks; bottom: stacked plates, bowls and a pot
          const top=drawer(x0,x1,0.67,0.83,M.cabF,function(add,cx,bw,bd,fy){
            [-0.2,-0.1,0,0.1].forEach(function(dx,i){ add(new THREE.BoxGeometry(0.008,0.04,bd-0.04),wood,cx+dx+0.05,fy+0.02,bd/2); });
            const steel=M.steel, cut=[[0.0,'fork'],[0.0,'spoon'],[0.0,'knife']];
            [-0.15,-0.05,0.05].forEach(function(dx,k){ for(let i=0;i<5;i++){ const m=add(new THREE.BoxGeometry(0.018,0.006,0.19),steel,cx+dx+(i-2)*0.012,fy+0.006+i*0.004,bd*0.45); m.rotation.y=(i-2)*0.03; } });
            for(let i=0;i<8;i++) add(new THREE.BoxGeometry(0.008,0.008,0.23),lam(i%2?0x3a2a22:0xb25a3a,{roughness:0.5}),cx+0.13+i*0.012,fy+0.006,bd*0.45);   // chopsticks
          });
          const bot=drawer(x0,x1,0.1,0.65,M.cabF,function(add,cx,bw,bd,fy){
            for(let i=0;i<6;i++) add(new THREE.CylinderGeometry(0.12,0.1,0.016,26),plateM,cx-0.14,fy+0.01+i*0.02,bd*0.3,true);
            for(let i=0;i<4;i++) add(new THREE.CylinderGeometry(0.09,0.08,0.014,24),plateB,cx-0.14,fy+0.01+i*0.018,bd*0.75,true);
            [0,1].forEach(function(j){ for(let i=0;i<3;i++){ const b=add(new THREE.SphereGeometry(0.065,18,10,0,Math.PI*2,Math.PI/2,Math.PI/2),j?plateB:lam(0xf3ece0,{roughness:0.3}),cx+0.06+j*0.14,fy+0.068+i*0.025,bd*0.3); b.rotation.x=Math.PI; } });
            add(new THREE.CylinderGeometry(0.1,0.1,0.12,24,1,true),mat('pot',0xc9ced3,{metalness:0.85,roughness:0.25,side:THREE.DoubleSide}),cx+0.13,fy+0.06,bd*0.72,true);
          });
          sliders.push({g:[top,bot],out:[0.4,0.42],x:(x0+x1)/2,label:['打開餐具抽屜','關上餐具抽屜']}); return;
        }
      });
      P.actions=[];
      sliders.forEach(function(sl){
        const st=stepper(0.5,function(t){ const e=ease(t); sl.g.forEach(function(g,i){ g.position.z=-sl.out[i]*e; }); });
        P.anims.push(function(t){ return st.run(t); });
        P.actions.push({x:sl.x,z:-0.55,label:function(){ return sl.label[st.target?1:0]; },act:function(){ st.target=st.target?0:1; }});
      });
      return P;
    };
    /* 60 x 49 cm IH hob set into a worktop at 0.875 m, three rings */
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
    Catalog.dishSoap=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, bm=lam(0x8fc16b,{roughness:0.25,transparent:true,opacity:0.92});
      P.cyl(0,0,0.034,0.036,0.88,1.04,bm,{},20); P.cyl(0,0,0.016,0.02,1.04,1.06,bm,oc,14);
      P.cyl(0,0,0.006,0.006,1.06,1.09,lam(0xf2f2f2),oc,8); P.box(-0.012,0.032,-0.009,0.009,1.09,1.102,lam(0xf2f2f2),oc);
      P.cyl(0,0,0.0345,0.0365,0.93,0.99,lam(0xf4f1ea,{roughness:0.6}),oc,20);
      const sx=10*S1, sz=8*S1, bump=env.fabricTex?{bumpMap:env.fabricTex,bumpScale:0.006}:{};
      P.rbox(sx,sx+0.1,sz-0.035,sz+0.035,0.88,0.915,0.012,lam(0xf2c46b,Object.assign({roughness:1},bump)),oc);
      P.rbox(sx,sx+0.1,sz-0.035,sz+0.035,0.915,0.925,0.008,lam(0x4f9f6a,Object.assign({roughness:1},bump)),oc);
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
    Catalog.bathWallSet=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, L=function(px){ return (px-742.5)*S1; };
      const sy=0.79, steelM=lam(0xd6dade,{metalness:0.85,roughness:0.25,envMapIntensity:1}), whiteP=lam(0xf6f6f3,{roughness:0.25});
      P.rbox(L(700),L(785),0,0.13,sy-0.03,sy,0.01,whiteP);
      P.rbox(L(714),L(756),0,0.06,0.58,0.64,0.025,steelM);
      [L(714)+0.02,L(756)-0.02].forEach(function(x){ const k=P.cyl(x,0.07,0.03,0.03,0.58,0.64,lam(0xeceeef,{roughness:0.3}),oc,18); k.rotation.x=Math.PI/2; k.position.y=0.61; k.position.z=0.07; });
      P.cyl(L(735),0.04,0.012,0.012,0.53,0.58,steelM,oc,10);
      const barX=L(775), barZ=0.035;
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
      const hose=new THREE.CatmullRomCurve3([new THREE.Vector3(L(756)-0.02,0.58,0.04),new THREE.Vector3(L(762),0.3,0.12),new THREE.Vector3(L(770),0.42,0.13),new THREE.Vector3(barX+0.02,0.95,0.1),hb]);
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
      P.rbox(L(702)+0.02,L(702)+0.1,0.03,0.11,sy,sy+0.01,0.006,lam(0xd8e2e6,{roughness:0.2}),oc);
      P.rbox(L(702)+0.03,L(702)+0.09,0.045,0.095,sy+0.01,sy+0.03,0.012,lam(0xf3e9d2,{roughness:0.5}),oc);
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
    Catalog.applianceCabinet=function(){
      const P=new Piece(), lam=env.lam, fab=env.fab, o={}, oc={cast:false};
      const W=1.0, D=0.45, x0=-W/2, x1=W/2, z0=-D/2, z1=D/2, T=0.02;
      const silver=lam(0xb9bec4,{metalness:0.85,roughness:0.3,envMapIntensity:1}), glass=lam(0x0d1114,{roughness:0.1,metalness:0.2,envMapIntensity:1}), cream=lam(0xf3efe6,{roughness:0.35}), blk=lam(0x1b1d20,{roughness:0.4}), led=new THREE.MeshBasicMaterial({color:0x76ffb2});
      P.box(x0,x1,z0,z0+0.015,0.1,1.96,M.cabF,o);
      P.box(x0,x0+T,z0,z1,0.1,1.96,M.cabF,o); P.box(x1-T,x1,z0,z1,0.1,1.96,M.cabF,o);
      P.box(x0,x1,z0,z1,0.1,0.85,M.cabF,o); P.box(x0+0.02,x1-0.02,z1-0.012,z1,0,0.1,M.dark,oc);
      P.box(x0-0.005,x1+0.005,z0,z1+0.025,0.85,0.88,M.top,o);
      [1.3,1.7].forEach(function(y){ P.box(x0,x1,z0,z1,y,y+0.03,M.oak,o); });
      P.box(x0,x1,z0,z1,1.93,1.96,M.oak,o);
      P.cabDoors('x',x0,x1,z1,1,0.1,0.85,2,false,M.cabF);
      const az=z0+0.04;
      const body=function(cx,w,d,h,y,mt,r){ return P.rbox(cx-w/2,cx+w/2,az,az+d,y,y+h,r||0.012,mt,o); };
      (function(){ const cx=x0+0.28, y=1.33, f=az+0.34;                                   // microwave
        body(cx,0.46,0.34,0.27,y,cream); P.box(cx-0.21,cx+0.05,f,f+0.004,y+0.03,y+0.24,glass,oc);
        P.box(cx+0.08,cx+0.2,f,f+0.004,y+0.03,y+0.24,silver,oc); P.box(cx+0.1,cx+0.18,f+0.004,f+0.006,y+0.18,y+0.215,led,oc);
        [0.07,0.12].forEach(function(dy){ P.cyl(cx+0.14,f+0.012,0.016,0.016,0,0,silver,oc,12); const k=P.cyl(cx+0.14,0,0.014,0.014,0,0.012,silver,oc,12); k.rotation.x=Math.PI/2; k.position.set(cx+0.14,y+dy,f+0.01); });
        P.box(cx+0.215,cx+0.222,f+0.002,f+0.012,y+0.05,y+0.22,silver,oc);
      })();
      (function(){ const cx=x0+0.76, y=1.33, f=az+0.3;                                    // toaster oven
        body(cx,0.4,0.3,0.23,y,silver,0.01); P.box(cx-0.17,cx+0.06,f,f+0.004,y+0.035,y+0.195,glass,oc);
        [0.1,0.17].forEach(function(dx){ [0.065,0.15].forEach(function(dy){ const k=P.cyl(0,0,0.016,0.016,0,0.02,blk,oc,14); k.rotation.x=Math.PI/2; k.position.set(cx+dx,y+dy,f+0.01); }); });
        P.box(cx-0.16,cx+0.05,f+0.004,f+0.03,y+0.205,y+0.215,silver,oc);
        [-0.15,0.15].forEach(function(dx){ P.box(cx+dx-0.02,cx+dx+0.02,az+0.02,az+0.28,y-0.012,y,blk,oc); });
      })();
      (function(){ const cx=x0+0.8, y=0.88, f=az+0.36;                                    // air fryer
        body(cx,0.3,0.36,0.36,y,blk,0.04); P.box(cx-0.12,cx+0.12,f,f+0.01,y+0.07,y+0.2,lam(0x2c2f33,{roughness:0.5}),oc);
        P.box(cx-0.09,cx+0.09,f+0.004,f+0.022,y+0.16,y+0.18,silver,oc);
        P.box(cx-0.08,cx+0.08,f+0.002,f+0.006,y+0.26,y+0.32,glass,oc); P.box(cx-0.06,cx+0.0,f+0.006,f+0.008,y+0.28,y+0.3,led,oc);
        for(let i=0;i<6;i++) P.box(cx-0.12+i*0.04,cx-0.095+i*0.04,az+0.09,az+0.27,y+0.358,y+0.364,lam(0x0a0b0d),oc);
      })();
      (function(){ const y=0.88, cx=x0+0.17, cz=az+0.14;                                  // hot water pot
        P.cyl(cx,cz,0.125,0.14,y,y+0.34,cream,o,28); P.cyl(cx,cz,0.12,0.12,y+0.34,y+0.37,silver,oc,28);
        P.box(cx-0.015,cx+0.015,cz+0.1,cz+0.16,y+0.28,y+0.3,silver,oc);
        P.box(cx-0.03,cx+0.03,cz+0.118,cz+0.124,y+0.24,y+0.26,led,oc);
        P.box(cx+0.09,cx+0.112,cz-0.02,cz+0.02,y+0.12,y+0.3,glass,oc);
      })();
      const cxm=x0+0.48, y0c=0.88, Wc=0.26, Dc=0.4, fz=az+Dc, ledM=new THREE.MeshBasicMaterial({color:0x76ffb2});   // bean-to-cup coffee machine
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
      P.actions=[{x:cxm,z:fz,label:function(){ return '沖煮咖啡'; },act:function(){ if(brewT0!==null&&lastT-brewT0<9.5) return; brewT0=lastT; }}];
      (function(){ const y=1.73;                                                            // storage boxes on the top shelf
        [[0.15,0.28,0x8a9a86],[0.43,0.28,0xc9b27f]].forEach(function(b){ P.rbox(x0+b[0]-b[1]/2,x0+b[0]+b[1]/2,z0+0.05,z0+0.4,y,y+0.18,0.015,fab(b[2]),o); });
        P.rbox(x0+0.68,x0+0.95,z0+0.06,z0+0.4,y,y+0.18,0.02,lam(0xb98368,{roughness:0.7}),o);
        P.cyl(x1-0.1,z0+0.2,0.05,0.04,y+0.18,y+0.24,M.pot,oc,14);
      })();
      (function(){                                                                          // sockets and cords
        const plate=lam(0xf4f2ec,{roughness:0.5}), hole=lam(0x1a1a1a), cw=lam(0xe8e8e4,{roughness:0.8}), cb=lam(0x242424,{roughness:0.8});
        const sock=function(px,py){ P.rbox(px-0.022,px+0.022,z0+0.015,z0+0.022,py-0.045,py+0.045,0.004,plate,oc); [-0.02,0.02].forEach(function(dy){ P.box(px-0.009,px+0.009,z0+0.022,z0+0.0235,py+dy-0.006,py+dy+0.006,hole,oc); }); };
        const cord=function(a,b,mt){ const pts=[a,[a[0]+(b[0]-a[0])*0.3,a[1]-0.045,a[2]-0.012],[b[0]-(b[0]-a[0])*0.2,b[1]-0.06,z0+0.032],[b[0],b[1]-0.03,z0+0.025]].map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); });
          P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,0.0035,6,false),mt),oc); };
        const P1=[x0+0.335,1.02], P2=[x0+0.64,1.02], P3=[x0+0.535,1.44];
        [P1,P2,P3].forEach(function(q){ sock(q[0],q[1]); });
        cord([x0+0.19,0.93,az],[P1[0],P1[1],0],cw); cord([cxm-0.06,0.93,az],[P1[0],P1[1],0],cb); cord([x0+0.85,0.93,az],[P2[0],P2[1],0],cb);
        cord([x0+0.33,1.34,az],[P3[0],P3[1],0],cw); cord([x0+0.71,1.34,az],[P3[0],P3[1],0],cb);
      })();
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
    Catalog.clothesRack=function(w){
      const P=new Piece(), rnd=env.rnd, rodY=1.75, n=Math.max(3,Math.round(w/0.09));
      const cm=[0x6d7f99,0xc9b8a0,0x3f4a58,0xd8d2c6,0x8a9a86,0xb26b5a,0xe7e4de].map(function(c){ return env.fab(c,{side:THREE.DoubleSide}); });
      const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,w,10),M.steel); rod.rotation.z=Math.PI/2; rod.position.set(0,rodY,0); P.add(rod,{cast:false});
      [-1,1].forEach(function(sd){ P.box(sd*w/2-0.01,sd*w/2+0.01,-0.03,0.03,rodY-0.03,rodY+0.03,M.steel,{cast:false}); });
      P.box(-w/2,w/2,-0.3,0.3,1.9,1.925,M.cabF);                                          // shelf above the rail
      [[-0.28,0.3,0x8a9a86],[0.18,0.34,0xc9b27f]].forEach(function(b){ if(Math.abs(b[0])+b[1]/2<w/2) P.rbox(b[0]-b[1]/2,b[0]+b[1]/2,-0.22,0.18,1.925,2.15,0.015,env.fab(b[2]),{cast:false}); });
      for(let i=0;i<n;i++){
        const t=(i+0.5)/n, hh=0.75+rnd()*0.4, g=new THREE.Group();
        g.position.set(-w/2+w*t,rodY-0.1,0); g.rotation.y=Math.PI/2;
        const m=new THREE.Mesh(garmentGeo(Math.floor(rnd()*3),hh-0.1,0.17),cm[Math.floor(rnd()*cm.length)]); m.position.z=-0.015; m.castShadow=true; m.receiveShadow=true; g.add(m);
        const hk=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.09,0.006),M.steel); hk.position.y=0.055; g.add(hk);
        [-1,1].forEach(function(sd){ const a=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.006,0.006),M.steel); a.position.set(sd*0.09,0.015,0); a.rotation.z=-sd*0.22; g.add(a); });
        P.group.add(g);
      }
      return P;
    };
    /* open steel shoe rack w x d x h, boards every 40 cm, random pairs of shoes on all but the top board; the open side is +z */
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
    Catalog.doormat=function(){
      const P=new Piece(); P.rbox(-0.3,0.3,-0.2,0.2,0,0.012,0.006,mat('doormat',0x8d8070,{roughness:1}),{cast:false}); return P;
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
    /* massage chair 0.75 x 1.25 m, reclined slightly; front +x */
    Catalog.massageChair=function(){
      const P=new Piece(), lam=env.lam, sk=lam(0x3a3836,{roughness:0.5}), pad=lam(0xd9cfc0,{roughness:0.6});
      P.rb(-0.05,0,1.0,0.7,0.36,0.08,sk,0.04,true);                                              // base with leg rest well
      P.rb(0.0,0,0.6,0.56,0.1,0.05,pad,0.4,false);                                               // seat
      const back=P.rb(-0.4,0,0.22,0.6,0.85,0.1,pad,0.42,false); back.rotation.z=0.3;
      [-1,1].forEach(function(sd){ P.rb(-0.05,sd*0.33,0.75,0.12,0.38,0.05,sk,0.35,false); });    // arm pods
      const leg=P.rb(0.42,0,0.32,0.5,0.12,0.05,pad,0.12,false); leg.rotation.z=-0.9;             // calf rest
      P.rb(-0.52,0,0.18,0.5,0.22,0.06,sk,1.15,false).rotation.z=0.3;                             // head pod
      P.box(0.25,0.3,0.36,0.37,0.68,0.76,lam(0x1b1d20,{roughness:0.2}),{cast:false});           // remote
      return P;
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
      P._col(-0.2,0.2,-0.45,0.45,true); return P;
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
    Catalog.homeSauna=function(){
      const P=new Piece(), lam=env.lam, wood=lam(0xd9b98a,{roughness:0.7}), dark=lam(0x8a6a4c,{roughness:0.7}), oc={cast:false};
      const W=0.6, D=0.525, H=1.95, t=0.05;
      P.box(-D,-D+t,-W,W,0,H,wood); P.box(-D,D,-W,-W+t,0,H,wood); P.box(-D,D,W-t,W,0,H,wood); P.box(-D,D,-W,W,H-t,H,wood); P.box(-D,D,-W,W,0,0.04,dark);
      P.box(D-t,D,-W,-0.15,0,H,wood); P.box(D-t,D,0.45,W,0,H,wood); P.box(D-t,D,-0.15,0.45,1.85,H,wood);
      P.box(D-0.02,D-0.01,-0.15,0.45,0.04,1.85,lam(0x6f4a2a,{transparent:true,opacity:0.35,roughness:0.05}),oc);   // bronze glass door
      P.box(D,D+0.03,0.35,0.37,0.8,1.2,M.steel,oc);
      const inner=lam(0xb3905f,{roughness:0.75}), e=0.004;                                                          // darker lining: point lights are not occluded by the cabin walls
      P.box(-D+t,-D+t+e,-W+t,W-t,0.04,H-t,inner,oc); P.box(-D+t,D-t,-W+t,-W+t+e,0.04,H-t,inner,oc); P.box(-D+t,D-t,W-t-e,W-t,0.04,H-t,inner,oc); P.box(-D+t,D-t,-W+t,W-t,H-t-e,H-t,inner,oc);
      P.box(-D+t,0.0,-W+t,W-t,0.45,0.5,dark); P.box(-D+t,-D+t+0.02,-W+t,W-t,0.6,1.0,dark);                        // single bench with a backrest board
      P.box(0.15,0.4,-W+t,-W+t+0.18,0.1,0.65,lam(0x2a2d31,{roughness:0.5}));                                        // heater
      for(let i=0;i<10;i++){ const s=new THREE.Mesh(new THREE.IcosahedronGeometry(0.035,0),lam(0x6b6b6b,{roughness:0.9})); s.position.set(0.2+(i%3)*0.07,0.68,-W+t+0.04+Math.floor(i/3)*0.05); P.add(s,oc); }
      P.box(-D+t,-D+t+0.02,-W+0.1,W-0.1,1.7,1.72,lam(0xffe2b0,{emissive:0xffb050}),oc);                             // LED strip
      const light=new THREE.PointLight(0xffb060,1.2,2.2,2); light.position.set(0,1.6,0); P.group.add(light);
      P._col(-D,D,-W,W,true); return P;
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
    Catalog.wallFoldTable=function(){             // wall-mounted fold-down shelf 60 x 35 cm at 80 cm, open, with keys and a parcel
      const P=new Piece(), lam=env.lam;
      P.box(0,0.02,-0.32,0.32,0.55,0.84,M.oak); P.box(0.02,0.37,-0.3,0.3,0.8,0.825,M.oak);
      [-1,1].forEach(function(sd){ P.box(0.02,0.3,sd*0.26-0.01,sd*0.26+0.01,0.62,0.64,M.steel).rotation.z=0.0; });
      P.box(0.1,0.3,-0.2,0.05,0.825,0.95,lam(0xc9a87a,{roughness:0.9})); P.box(0.15,0.2,0.12,0.18,0.825,0.835,M.steel,{cast:false});
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
      {t:'tvBoard',name:'電視櫃與電視',cat:'客廳',front:'-x',make:function(){ return Catalog.tvBoard(); }},
      {t:'diningSet',name:'餐桌與椅子',cat:'客廳',front:'+x',make:function(){ return Catalog.diningSet(); }},
      {t:'chair',name:'椅子',cat:'客廳',front:'-z',make:function(){ return Catalog.chair(1); }},
      {t:'sideTable',name:'邊桌',cat:'客廳',front:'+x',make:function(){ return Catalog.sideTable(); }},
      {t:'floorLamp',name:'立燈',cat:'客廳',front:'+x',make:function(){ return Catalog.floorLamp(); }},
      {t:'plant',name:'植物（大）',cat:'客廳',front:'+x',make:function(){ return Catalog.plant(0.9); }},
      {t:'plantS',name:'植物（小）',cat:'客廳',front:'+x',make:function(){ return Catalog.plant(0.65); }},
      {t:'bed',name:'Queen 床',cat:'臥室',front:'+z',make:function(){ return Catalog.bed(); }},
      {t:'bedside',name:'床頭櫃',cat:'臥室',front:'-z',make:function(){ return Catalog.bedsideTable(true); }},
      {t:'headboard',name:'棚付きヘッドボード',cat:'臥室',front:'+x',make:function(){ return Catalog.shelfHeadboard(); }},
      {t:'rugBed',name:'條紋地毯',cat:'臥室',front:'+x',make:function(){ return Catalog.stripedRug(2.16,2.55); }},
      {t:'desk',name:'書桌（含 3D 列印機）',cat:'書房',front:'+z',make:function(){ return Catalog.desk(); }},
      {t:'officeChair',name:'辦公椅',cat:'書房',front:'-z',make:function(){ return Catalog.officeChair(); }},
      {t:'bookshelf',name:'書櫃',cat:'書房',front:'+x',make:function(){ return Catalog.bookshelf(); }},
      {t:'fridge',name:'冰箱（60 cm）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.fridge(); }},
      {t:'washer',name:'洗衣機',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.washer(); }},
      {t:'rugRound',name:'圓地毯（長毛）',cat:'客廳',front:'+x',make:function(){ return Catalog.roundRug(0.95,'plain',24,0.0,true); }},
      {t:'rugRoundSun',name:'花邊圓地毯',cat:'書房',front:'+x',make:function(){ return Catalog.roundRug(0.7,'sun',12,0.045); }},
      {t:'liftTable',name:'升降桌',cat:'客廳',front:'+x',make:function(){ return Catalog.liftTable(); }},
      {t:'fridge70',name:'冰箱（70 cm，可開門、有食物）',cat:'廚房與衛浴',front:'+z',make:function(){ return Catalog.fridge70(); }},
      {t:'catTabby',name:'貓（虎斑）',cat:'貓咪',front:'+x',make:function(){ return Catalog.cat('tabby'); }},
      {t:'catGrey',name:'貓（灰）',cat:'貓咪',front:'+x',make:function(){ return Catalog.cat('grey'); }},
      {t:'catBed',wall:true,name:'貓耳吊床（壁掛，含貓）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catBed(1.6,'tabby'); }},
      {t:'catHouse',wall:true,name:'貓屋（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catHouse(0.95); }},
      {t:'catStep',wall:true,name:'貓跳台（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catStep(1.2); }},
      {t:'catColumn',wall:true,name:'貓抓柱（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catColumn(0.4,1.9,[0.9]); }},
      {t:'catBowls',name:'貓碗',cat:'貓咪',front:'+x',make:function(){ return Catalog.catBowls(); }},
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
      {t:'doormat',name:'腳踏墊',cat:'收納與其他',front:'+x',make:function(){ return Catalog.doormat(); }},
      {t:'lSofa',name:'L 型沙發',cat:'客廳',front:'+x',make:function(){ return Catalog.lSofa(); }},
      {t:'massageChair',name:'按摩椅',cat:'客廳',front:'+x',make:function(){ return Catalog.massageChair(); }},
      {t:'foldTable',name:'摺疊大餐桌（6 人）',cat:'客廳',front:'+x',make:function(){ return Catalog.foldTable(); }},
      {t:'workCounter',name:'家事作業台',cat:'客廳',front:'+x',make:function(){ return Catalog.workCounter(); }},
      {t:'worldMap',name:'世界地圖',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.worldMap(); }},
      {t:'catPerch',name:'貓窗台吊床',cat:'貓咪',front:'+x',wall:true,make:function(){ return Catalog.catWindowPerch(0.9); }},
      {t:'liftDesk',name:'電動升降桌',cat:'書房',front:'+z',make:function(){ return Catalog.liftDesk(); }},
      {t:'duoDesk',name:'雙人升降桌（含 2 椅）',cat:'書房',front:'+z',make:function(){ return Catalog.duoDesk(); }},
      {t:'babyCrib',name:'嬰兒床',cat:'臥室',front:'+x',make:function(){ return Catalog.babyCrib(); }},
      {t:'smallShelf',name:'矮書櫃',cat:'臥室',front:'+x',make:function(){ return Catalog.smallBookshelf(); }},
      {t:'fan',name:'電風扇',cat:'家電',front:'+x',make:function(){ return Catalog.fan(); }},
      {t:'dehumidifier',name:'除濕／加濕機',cat:'家電',front:'+x',make:function(){ return Catalog.dehumidifier(); }},
      {t:'robotVacuum',name:'掃地機器人（含基地）',cat:'家電',front:'+x',make:function(){ return Catalog.robotVacuum(); }},
      {t:'homeSauna',name:'雙人家用三溫暖',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.homeSauna(); }},
      {t:'broomCabinet',name:'掃除用具櫃',cat:'收納與其他',front:'+x',make:function(){ return Catalog.broomCabinet(); }},
      {t:'trashBins',name:'分類垃圾桶',cat:'收納與其他',front:'+x',make:function(){ return Catalog.trashBins(); }},
      {t:'stockShelf',name:'防災備品架',cat:'收納與其他',front:'+x',make:function(){ return Catalog.stockShelf(); }},
      {t:'umbrellaStand',name:'傘架',cat:'收納與其他',front:'+x',make:function(){ return Catalog.umbrellaStand(); }},
      {t:'bbqGrill',name:'BBQ 烤爐',cat:'戶外',front:'+x',make:function(){ return Catalog.bbqGrill(); }},
      {t:'outdoorSet',name:'戶外桌椅',cat:'戶外',front:'+x',make:function(){ return Catalog.outdoorSet(); }},
      {t:'shoeCabinet',name:'鞋櫃',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoeCabinet(); }},
      {t:'shoesW',name:'白色球鞋',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('sneaker',0xe8e6e0,0xf1efe9); }},
      {t:'shoesL',name:'黑色樂福鞋',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('loafer',0x1c1c1e,0x8a6a4a); }},
      {t:'shoesN',name:'深藍球鞋',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('sneaker',0x1f2c44,0xf1efe9); }},
      {t:'suit30P',name:'30 吋行李箱（粉紅）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.52,0.78,0.31,0xee9db5,0xd9809b,false); }},
      {t:'suit29B',name:'29 吋行李箱（黑）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.49,0.77,0.33,0x26282c,0,true); }},
      {t:'suit24P',name:'24 吋行李箱（粉紅）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.41,0.66,0.26,0xf6bccb,0xe49fb4,false); }},
      {t:'car',name:'Tesla Model 3（灰黑）',cat:'收納與其他',front:'+z',make:function(){ return Catalog.car(); }}
    ];
    const DIR={'+x':0,'-z':1,'-x':2,'+z':3}, COMPASS={E:0,N:1,W:2,S:3};
    Catalog.faceIndex=function(t){ return DIR[Catalog.info(t).front]; };   // 0 E(+x), 1 N(-z), 2 W(-x), 3 S(+z)
    Catalog.info=function(t){ return Catalog.TYPES.find(function(d){ return d.t===t; })||null; };
    Catalog.make=function(t){ const d=Catalog.info(t); if(!d) throw new Error('unknown furniture type: '+t); const p=d.make(); p.type=t; return p; };
    Catalog.turnsToFace=function(t,face){        // quarter turns (counter-clockwise from above) that make piece t look toward compass face N/E/S/W (north = -z)
      const d=Catalog.info(t); return ((COMPASS[face]-DIR[d.front])%4+4)%4;
    };

    Catalog.shoe=shoeObj;

    return Catalog;
  };
})(window);
