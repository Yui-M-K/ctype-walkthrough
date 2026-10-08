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

    /* ---------- kitchen and bath fixtures (built in; heights are absolute, the house places them at floor level) ---------- */
    const S1=0.01213;                            // plan pixel of the Ctype drawing, used to keep these fixtures' original proportions
    const chromeM=function(){ return mat('chrome',0xdfe3e6,{metalness:0.95,roughness:0.18,envMapIntensity:1.3}); };
    /* sink counter w x d metres, origin at the corner (x 0..w, z 0..d), the cook stands on the -z side.
       sink = [x0,x1,z0,z1] of the cut-out; units = number of plain door fronts, or a list of {k,w} units (fill, sink, dw, spice, drawers) that open. The cabinet is hollow under the sink and the bowl really goes down. */
    Catalog.sinkCounter=function(w,d,sink,units){
      const P=new Piece(), lam=env.lam, oc={cast:false};
      const tx0=-0.01, tx1=w, tz0=-0.01, tz1=d+0.04, sx0=sink[0], sx1=sink[1], sz0=sink[2], sz1=sink[3];
      P._col(0,w,0,d,true);
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
      {t:'shoeShelf',name:'開放鞋架',cat:'收納與其他',front:'+z',make:function(){ return Catalog.shoeShelf(0.6,0.3,1.8); }},
      {t:'doormat',name:'腳踏墊',cat:'收納與其他',front:'+x',make:function(){ return Catalog.doormat(); }},
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
