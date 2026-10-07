/* Shared furniture catalogue. Every piece has a FIXED size and is drawn around its own centre (origin on the floor, metres;
   which side is the front is recorded per type in Catalog.TYPES). A house decides where and how it turns: it adds `piece.group` to its scene and copies `piece.cols` (collision
   rectangles, local metres) into its own collision list after rotating them (see placePiece in the house).
   Knows nothing about a particular house: materials, textures, random numbers and the contact-shadow decal come in through `env`.

   env: THREE, M (material slots used: pot, dark, black, leaf, leafL, oak, oakD, oakChair, chairBack, steel, shade, sofa, sofaD, cushA, cushB, ceramic, cabF),
        lam(color,opts), fab(color,opts), lampMat, ceilingH, anisotropy, rnd(), rugTex(style), contactShadow(x0,x1,z0,z1,y,group), enableLocalClipping() */
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

    /* round rug with a gently scalloped edge (amp = scallop depth, lobes = scallop count), 1.4 cm pile; shag = fluffy stacked-shell pile on top */
    Catalog.roundRug=function(R,style,lobes,amp,shag){
      const P=new Piece(), rnd=env.rnd;
      const pts=[]; for(let i=0;i<240;i++){ const th=i/240*TAU, r=R*(1+amp*Math.cos(lobes*th)); pts.push(new THREE.Vector2(Math.cos(th)*r,Math.sin(th)*r)); }
      const geo=new THREE.ExtrudeGeometry(new THREE.Shape(pts),{depth:0.014,bevelEnabled:false,curveSegments:1,steps:1});
      const t=env.rugTex(style); t.repeat.set(1/(2*R*(1+amp)),1/(2*R*(1+amp))); t.offset.set(0.5,0.5);
      const m=new THREE.Mesh(geo,[new THREE.MeshStandardMaterial({map:t,roughness:1}),env.lam(0xcdbfa6,{roughness:1})]);
      m.rotation.x=-Math.PI/2; m.position.set(0,0.001,0); m.receiveShadow=true; P.add(m,{cast:false});
      if(shag){
        const N=14, size=256, data=new Uint8Array(size*size*4);
        for(let i=0;i<size*size;i++){ const v=196+Math.floor(rnd()*52); data[i*4]=v; data[i*4+1]=v-7; data[i*4+2]=v-19; data[i*4+3]=Math.floor(rnd()*255); }
        const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.encoding=THREE.sRGBEncoding;
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
      const st=new THREE.CanvasTexture(sc); st.encoding=THREE.sRGBEncoding;
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
      const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=env.anisotropy; t.repeat.set(1/rw,1/rd); t.offset.set(0.5,0.5);
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
      {t:'fridge',name:'冰箱',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.fridge(); }},
      {t:'washer',name:'洗衣機',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.washer(); }},
      {t:'vanity',name:'洗面台',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.vanity(); }},
      {t:'toilet',name:'馬桶',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.toilet(); }},
      {t:'bathtub',name:'浴缸',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.bathtub(); }},
      {t:'shoeCabinet',name:'鞋櫃',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoeCabinet(); }},
      {t:'suit30P',name:'30 吋行李箱（粉紅）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.52,0.78,0.31,0xee9db5,0xd9809b,false); }},
      {t:'suit29B',name:'29 吋行李箱（黑）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.49,0.77,0.33,0x26282c,0,true); }},
      {t:'suit24P',name:'24 吋行李箱（粉紅）',cat:'收納與其他',front:'-x',make:function(){ return Catalog.suitcase(0.41,0.66,0.26,0xf6bccb,0xe49fb4,false); }},
      {t:'car',name:'Tesla Model 3（灰黑）',cat:'收納與其他',front:'+z',make:function(){ return Catalog.car(); }}
    ];
    const DIR={'+x':0,'-z':1,'-x':2,'+z':3}, COMPASS={E:0,N:1,W:2,S:3};
    Catalog.info=function(t){ return Catalog.TYPES.find(function(d){ return d.t===t; })||null; };
    Catalog.make=function(t){ const d=Catalog.info(t); if(!d) throw new Error('unknown furniture type: '+t); const p=d.make(); p.type=t; return p; };
    Catalog.turnsToFace=function(t,face){        // quarter turns (counter-clockwise from above) that make piece t look toward compass face N/E/S/W (north = -z)
      const d=Catalog.info(t); return ((COMPASS[face]-DIR[d.front])%4+4)%4;
    };

    Catalog.shoe=shoeObj;

    return Catalog;
  };
})(window);
