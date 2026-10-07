/* Shared furniture catalogue. Every piece has a FIXED size and is drawn around its own centre (origin on the floor, metres;
   which side is the front is recorded per type in Catalog.TYPES). A house decides where and how it turns: it adds `piece.group` to its scene and copies `piece.cols` (collision
   rectangles, local metres) into its own collision list after rotating them (see placePiece in the house).
   Knows nothing about a particular house: materials, textures, random numbers and the contact-shadow decal come in through `env`.

   env: THREE, M (material slots used: pot, dark, black, leaf, leafL, oak, oakD, oakChair, chairBack, steel, shade, sofa, sofaD, cushA, cushB, ceramic, cabF),
        lam(color,opts), fab(color,opts), lampMat, ceilingH, anisotropy, rnd(), contactShadow(x0,x1,z0,z1,y,group), enableLocalClipping() */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  const TAU=Math.PI*2;

  Walk.Catalog=function(env){
    const THREE=env.THREE, M=env.M;

    function fitUV(g,w,h,d){                   // box textures repeat once per metre on every face instead of stretching
      const uv=g.attributes.uv, dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
      for(let f=0;f<6;f++){ const s=dims[f]; for(let i=f*4;i<f*4+4;i++) uv.setXY(i,uv.getX(i)*s[0],uv.getY(i)*s[1]); }
    }

    /* Builds one piece: same drawing helpers as the houses use, but in local metres and into its own group. */
    class Piece{
      constructor(){ this.group=new THREE.Group(); this.cols=[]; this.anims=[]; }   // anims: callbacks (t, state) the house runs every frame
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

    Catalog.plant=function(sz){                // potted plant, sz = overall scale (1 = 30 cm pot)
      const P=new Piece(), rnd=env.rnd;
      P.fcyl(0,0,0.13*sz,0.1*sz,0,0.3*sz,M.pot,true);
      P.cyl(0,0,0.11*sz,0.11*sz,0.29*sz,0.3*sz,M.dark,{cast:false});
      for(let i=0;i<7;i++){
        const a=i*2.4, rr=(0.08+rnd()*0.1)*sz, hh=(0.45+rnd()*0.35)*sz;
        const m=new THREE.Mesh(new THREE.SphereGeometry((0.09+rnd()*0.08)*sz,10,8),i%2?M.leaf:M.leafL);
        m.position.set(Math.cos(a)*rr,hh,Math.sin(a)*rr); m.scale.y=1.3; P.add(m);
      }
      return P;
    };

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

    /* Tesla Model 3 (4.72 x 1.85 x 1.44 m, wheelbase 2.875 m) in dark metallic grey; nose toward +z, centred on its footprint. */
    Catalog.car=function(){
      const P=new Piece(), lam=env.lam, W=1.85, L=4.72;
      const paint=lam(0x4a4e55,{roughness:0.28,metalness:0.7,envMapIntensity:1.3});
      const glass=lam(0x0d1217,{roughness:0.05,metalness:0.6,envMapIntensity:1.4});
      const tire=lam(0x15171a,{roughness:0.9}), rim=lam(0xb8bcc2,{metalness:0.9,roughness:0.3,envMapIntensity:1}), dark=lam(0x0e0f11,{roughness:0.7});
      const prof=function(pts,width,bev,mat){     // side profile (u along the length, v up) extruded across the width
        const sh=new THREE.Shape(); pts.forEach(function(q,i){ if(i) sh.lineTo(q[0],q[1]); else sh.moveTo(q[0],q[1]); });
        const g=new THREE.ExtrudeGeometry(sh,{depth:width-2*bev,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:4,curveSegments:6});
        g.translate(0,0,-(width-2*bev)/2);
        const m=new THREE.Mesh(g,mat); m.rotation.y=-Math.PI/2; return P.add(m);
      };
      prof([[-2.27,0.22],[2.18,0.22],[2.29,0.30],[2.34,0.44],[2.33,0.58],[2.26,0.68],[2.1,0.75],[1.8,0.81],[1.5,0.87],[1.2,0.92],[-1.9,0.94],[-2.12,0.95],[-2.27,0.88],[-2.29,0.5]],W,0.07,paint);
      prof([[1.22,0.9],[0.55,1.34],[0.1,1.4],[-0.75,1.39],[-1.45,1.2],[-1.98,0.93]],W-0.3,0.05,glass);
      prof([[0.5,1.37],[0.1,1.405],[-0.75,1.395],[-1.0,1.34]],W-0.55,0.015,paint);   // thin body-colour roof edge
      [[1.5,0.5],[-1.375,0.5]].forEach(function(a){
        [-1,1].forEach(function(sx){
          const x=sx*0.8, ar=new THREE.Mesh(new THREE.CylinderGeometry(0.385,0.385,0.26,22),dark); ar.rotation.z=Math.PI/2; ar.position.set(x,0.36,a[0]); P.add(ar,{cast:false});
          const t=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.24,24),tire); t.rotation.z=Math.PI/2; t.position.set(x,0.34,a[0]); P.add(t);
          const r=new THREE.Mesh(new THREE.CylinderGeometry(0.235,0.235,0.02,20),rim); r.rotation.z=Math.PI/2; r.position.set(x+sx*0.115,0.34,a[0]); P.add(r,{cast:false});
        });
      });
      P.box(-0.78,0.78,-2.4,-2.31,0.8,0.86,lam(0xff2a1a,{emissive:0xc01005,roughness:0.3}),{cast:false});          // rear light bar
      [-1,1].forEach(function(sx){
        P.box(sx*0.52-0.17,sx*0.52+0.17,2.22,2.33,0.62,0.69,lam(0xf4f6ff,{emissive:0xb8c4e8,roughness:0.2}),{cast:false});   // headlights
        P.box(sx*0.93,sx*1.05,0.78,0.92,0.95,1.01,paint);                                                                       // mirrors
        [0.45,-0.45].forEach(function(z){ P.box(sx*0.925,sx*0.935,z-0.1,z+0.1,0.84,0.86,dark,{cast:false}); });                 // door handles
      });
      P.box(-0.35,0.35,2.22,2.34,0.3,0.38,dark,{cast:false});                                                                   // lower intake
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
    Catalog.bathtub=function(){
      const P=new Piece(), shell=mat('tub',0xf4f6f6,{roughness:0.2,envMapIntensity:0.7}), inner=mat('tubIn',0xd9ebf1,{roughness:0.15});
      const L=0.75, D=0.39, H=0.55, t=0.08;
      P.rbox(-D,D,-L,-L+t,0,H,0.03,shell); P.rbox(-D,D,L-t,L,0,H,0.03,shell);
      P.rbox(-D,-D+t,-L,L,0,H,0.03,shell); P.rbox(D-t,D,-L,L,0,H,0.03,shell);
      P.box(-D+t,D-t,-L+t,L-t,0,0.12,inner);
      const w=new THREE.Mesh(new THREE.PlaneGeometry(2*(D-t),2*(L-t)),mat('water',0x9fd3e6,{transparent:true,opacity:0.45,roughness:0.02,metalness:0.1,envMapIntensity:1.4,depthWrite:false}));
      w.rotation.x=-Math.PI/2; w.position.set(0,0.42,0); P.add(w,{cast:false,recv:false});
      P.cyl(-D+0.04,0,0.018,0.018,H,H+0.12,M.steel,{cast:false},10); P.box(-D+0.03,-D+0.16,-0.015,0.015,H+0.1,H+0.13,M.steel,{cast:false});
      P._col(-D,D,-L,L,true);
      return P;
    };
    /* 75 cm wash basin unit: two-door cabinet, ceramic top with a basin, gooseneck tap and a lit mirror cabinet; faces +x */
    Catalog.vanity=function(){
      const P=new Piece(), cab=mat('vcab',0xf1eee8,{roughness:0.45}), cer=M.ceramic, mir=mat('mirror',0xdfe8ec,{metalness:1,roughness:0.03,envMapIntensity:1});
      P.box(-0.275,0.26,-0.375,0.375,0.06,0.78,cab); P.box(-0.25,0.24,-0.36,0.36,0,0.06,M.dark,{cast:false});
      P.cabDoors('z',-0.37,0.37,0.26,1,0.07,0.76,2,false,cab);
      P.rbox(-0.275,0.285,-0.38,0.38,0.78,0.85,0.02,cer);
      flatDisc(P,0.17,1.35,0.8505,0.07,0,mat('basin',0xe4e6e6,{roughness:0.15}));
      flatDisc(P,0.015,1,0.852,0.07,0,M.steel);
      P.cyl(-0.18,0,0.018,0.018,0.85,1.06,M.steel,{cast:false},10); P.box(-0.19,-0.06,-0.014,0.014,1.04,1.07,M.steel,{cast:false});
      P.box(-0.275,-0.13,-0.375,0.375,1.05,1.95,cab); P.box(-0.13,-0.125,-0.36,0.36,1.12,1.88,mir,{cast:false});
      P.box(-0.13,-0.11,-0.36,0.36,1.89,1.93,mat('vlight',0xfff6e0,{emissive:0xffe8c0}),{cast:false});
      P._col(-0.275,0.285,-0.38,0.38,true);
      return P;
    };
    /* front-loading washing machine 60 x 62 cm, 85 cm high; door faces +x */
    Catalog.washer=function(){
      const P=new Piece(), body=mat('wash',0xf3f4f4,{roughness:0.35}), dark=M.dark;
      P.rbox(-0.31,0.31,-0.3,0.3,0,0.85,0.03,body);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.03,10,32),mat('wring',0xb9bec3,{metalness:0.6,roughness:0.3})); ring.rotation.y=Math.PI/2; ring.position.set(0.315,0.42,0); P.add(ring,{cast:false});
      const gl=new THREE.Mesh(new THREE.CircleGeometry(0.15,32),mat('wglass',0x1d2a35,{metalness:0.5,roughness:0.08,envMapIntensity:1})); gl.rotation.y=Math.PI/2; gl.position.set(0.312,0.42,0); P.add(gl,{cast:false});
      P.box(0.3,0.315,-0.28,0.28,0.7,0.82,mat('wpanel',0xe2e5e7,{roughness:0.3}),{cast:false});
      P.box(0.314,0.318,0.05,0.2,0.74,0.79,mat('wled',0x9fd6ff,{emissive:0x4aa8e8}),{cast:false});
      const knob=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.02,16),dark); knob.rotation.z=Math.PI/2; knob.position.set(0.32,0.76,-0.12); P.add(knob,{cast:false});
      P._col(-0.31,0.31,-0.3,0.3,true);
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
      const lam=env.lam, C=new THREE.Group(); C.position.set(0.17,0.05,0); C.rotation.y=Math.PI/2+0.35; C.scale.setScalar(0.62);
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

    /* ---------- registry: every piece a house can place by id. front = the side people use / look at, in the piece's own axes ---------- */
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
      {t:'vanity',name:'洗面台',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.vanity(); }},
      {t:'toilet',name:'馬桶',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.toilet(); }},
      {t:'bathtub',name:'浴缸',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.bathtub(); }},
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
