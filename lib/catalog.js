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
      cabDoors(run,a0,a1,plane,side,y0,y1,n,low,mat,th){   // door fronts with seams and bar handles on one face of a cabinet
        const w=(a1-a0)/n, t=th||0.016, d={cast:false}, dd={cast:false,detail:true};
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
    Catalog.tvBoard=function(inch,lift,floor,spec){   // TV board with a 16:9 TV of `inch` inches (default 55); lift: raise the floating board; floor: a floor-standing board with book and board-game cupboards either side; spec: maker's {w, h incl. stand, d of stand} in metres, plus len to set the board length
      const P=new Piece(), S=0.01213, W0=spec?spec.w:(inch||55)*0.02214, B=spec&&spec.len||Math.max(1.4,W0+0.2), L=lift||0;
      if(inch){                                   // designer version: floating walnut board with fluted fronts, an under-glow and a soundbar
        const FL=!!floor, wal=FL?mat('tvWhite',0xf3f1ec,{roughness:0.45}):mat('lightOakTop',0xd9bf96,{roughness:0.45,map:M.oak.map||null});   // floor-standing: matte white, like the kitchen fronts
        const zs=-B/2+0.02, gap=function(z){ return zs+Math.round((z-zs-0.033)/0.04)*0.04+0.033; }, dz0=gap(-0.36), dz1=gap(0.36), oc={cast:false};   // drawer edges fall in the gaps of the flute rhythm
        const sy0=0.2, dy=FL?-0.045:0, fx=FL?-0.25:-0.2, H=0.42+dy;   // floor-standing: 4.5 cm lower and 5 cm deeper at the front
        if(FL){ P.box(fx+0.018,0.2,-B/2,B/2,0,0.018,wal); P.box(fx+0.018,0.2,-B/2,B/2,H-0.018,H,wal); P.box(0.182,0.2,-B/2,B/2,0.018,H-0.018,wal);
          [[-B/2,-B/2+0.018],[dz0-0.018,dz0],[dz1,dz1+0.018],[B/2-0.018,B/2]].forEach(function(q){ P.box(fx+0.018,0.182,q[0],q[1],0.018,H-0.018,wal); });
          P.box(fx+0.018,0.2,dz0,dz1,0.18+dy,0.198+dy,wal); P.box(fx+0.016,fx+0.018,dz0,dz1,0.196+dy,0.198+dy,env.lam(0x9d988f,{roughness:0.8}),oc); P._col(fx,0.2,-B/2,B/2,true); }   // shelf the devices stand on, with a drawer for remotes below
        else { P.box(-0.2,0.2,-B/2,dz0,0.18,0.42,wal); P.box(-0.2,0.2,dz1,B/2,0.18,0.42,wal); P.box(-0.2,0.2,dz0,dz1,0.18,0.198,wal); }
        P.rb((fx+0.2)/2,0,0.22-fx,B+0.02,0.025,0.01,FL?mat('lightOakTop',0xd9bf96,{roughness:0.45,map:M.oak.map||null}):wal,H,true);   // floor-standing: oak top over white fronts
        P.box(fx,0.2,dz0,dz1,H-0.018,H,wal); P.box(0.182,0.2,dz0,dz1,0.198+dy,H-0.018,wal);
        const plateM=env.lam(0xf4f4f2,{roughness:0.35}), slotM=env.lam(0x1a1a1a);
        const hole=new THREE.Mesh(new THREE.CircleGeometry(0.028,24),slotM); hole.rotation.y=-Math.PI/2; hole.position.set(0.1815,0.33+dy,0.03); P.add(hole,oc);   // cable grommet up to the TV
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
        P.cyl(0.12,0,0.025,0.025,H+0.024,H+0.0255,cab,oc,20);                                                                  // cable grommet in the top
        const F=new THREE.Group(); F.position.set(fx-0.014,fy,0); P.group.add(F);                                              // flap hinged at its bottom edge
        const fd=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; F.add(m); return m; };
        fd(new THREE.BoxGeometry(0.018,0.2,dz1-dz0-(FL?0.002:0.004)),wal,0.023,0.102,dc); if(FL) fd(new THREE.BoxGeometry(0.004,0.006,0.2),env.lam(0xc9c4bb,{roughness:0.8}),0.0125,0.186,dc);   // finger groove along the top of the flap
        const grv=env.lam(0xc9c4bb,{roughness:0.8}), seamM=env.lam(0x9d988f,{roughness:0.8}), mL=(dz0-B/2)/2, mR=(dz1+B/2)/2, doors=FL?[[-B/2,mL,1],[mL,dz0,-1],[dz1,mR,1],[mR,B/2,-1]]:[];   // floor-standing: two flat doors a side, hinged at their outer edges, opened by a finger groove
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
          let z=-B/2+0.04; for(;z<dz0-0.3;){ const th=0.016+rnd()*0.03, h=0.2+rnd()*0.09, dd=0.14+rnd()*0.05;              // a row of standing books, then a short stack lying flat
            book(fx+0.03,z,z+th,0.018,h,dd,bookC[Math.floor(rnd()*bookC.length)]); z+=th+0.001; if(rnd()<0.06) z+=0.025; }
          for(let k=0,y=0.018;k<4;k++){ const t=0.022+rnd()*0.015, c=env.lam(bookC[(k*3+1)%bookC.length],{roughness:0.75}), z0=z+0.03+k*0.004, x0=fx+0.03+k*0.006, l=0.2-k*0.012, d=0.15-k*0.008;
            P.box(x0,x0+d,z0,z0+l,y,y+t,c,oc); P.box(x0+0.002,x0+d-0.002,z0+0.004,z0+l+0.0005,y+0.002,y+t-0.002,paper,oc); y+=t; }
          const gb=0.175; let gz=dz1+0.03;                                                                                // big board games stacked flat against the back of the right cupboard
          [[0.3,[0.07,0.06,0.1,0.05]],[0.26,[0.08,0.08,0.06,0.07]],[0.18,[0.05,0.05,0.04,0.05,0.04]]].forEach(function(col,i){ let y=0.018; if(gz+col[0]>B/2-0.02) return;
            col[1].forEach(function(h,j){ const c=[0xc8372f,0x2f6fb5,0xf2c94c,0x3f7d4e,0xe86a6a,0x6b4a8a,0xe08a3a,0x1f9fd8][(i*3+j)%8], w=col[0]-j*0.01;
              const gx=gb-w; P.box(gx,gx+w,gz+j*0.004,gz+j*0.004+w,y,y+h-0.002,env.lam(c,{roughness:0.6}),oc); P.box(gx-0.001,gx,gz+j*0.004+0.03,gz+j*0.004+w-0.03,y+h*0.3,y+h*0.7,env.lam(0xf6f1e6,{roughness:0.6}),oc); y+=h; });
            gz+=col[0]+0.015; });
          for(let z=dz1+0.06, n=0;n<3;n++){ let y=0.018; for(let k=0;k<3+n%2;k++){ const t=0.022+((n+k)%3)*0.006, c=[0x2f4b6e,0xd8453c,0xf2c94c,0x3f7d4e,0x8a6a9c,0x1f9fd8,0xe08a3a,0x2b2b2b][(n*3+k)%8], dz=(k%2)*0.004;   // card games the size of a deck of cards, lying in small stacks in front
            P.box(fx+0.03,fx+0.12,z+dz,z+dz+0.065,y,y+t-0.001,env.lam(c,{roughness:0.55}),oc); P.box(fx+0.029,fx+0.03,z+dz+0.01,z+dz+0.055,y+t*0.3,y+t*0.7,env.lam(0xf6f1e6,{roughness:0.6}),oc); y+=t; } z+=0.085; }
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
            P.actions=(P.actions||[]).concat([{x:-0.6,z:dc+0.15,label:function(){ return st.target?'關上遙控器抽屜':'打開遙控器抽屜'; },act:function(){ st.target=st.target?0:1; }}]); })();
          [[0,'書'],[2,'桌遊']].forEach(function(q){ const a=q[0], b=a+1, st=stepper(0.6,function(t){ const e=ease(t); dg[a].rotation.y=-doors[a][2]*Math.PI/2*e; dg[b].rotation.y=-doors[b][2]*Math.PI/2*e; });
            P.anims.push(function(t){ return st.run(t); });
            P.actions=(P.actions||[]).concat([{x:-0.6,z:doors[a][1],label:function(){ return st.target?'關上'+q[1]+'櫃':'打開'+q[1]+'櫃'; },act:function(){ st.target=st.target?0:1; }}]); }); }
        const strut=[-1,1].map(function(sd){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.006,1,0.006),M.steel); P.add(m,oc); return {m:m,z:sd>0?dz1-0.02:dz0+0.02}; });
        const setFlap=function(e){ const a=e*Math.PI/2; F.rotation.z=a;
          strut.forEach(function(s){ const bx=fx-0.014+0.032*Math.cos(a)-0.12*Math.sin(a), by=fy+0.032*Math.sin(a)+0.12*Math.cos(a), ax=fx+0.04, ay=0.37+dy, len=Math.hypot(bx-ax,by-ay);
            s.m.position.set((ax+bx)/2,(ay+by)/2+L,s.z); s.m.scale.y=len; s.m.rotation.set(0,0,Math.atan2(ax-bx,by-ay)); s.m.visible=e>0.02; }); };
        setFlap(0);
        const st=stepper(0.6,function(t){ setFlap(ease(t)); }); P.anims.push(function(t){ return st.run(t); });
        P.actions=(P.actions||[]).concat([{x:-0.6,z:FL?dc-0.15:dc,label:function(){ return st.target?'關上電視櫃下掀門':'打開電視櫃下掀門'; },act:function(){ st.target=st.target?0:1; }}]);
        if(!FL) P.box(-0.17,0.17,-B/2+0.06,B/2-0.06,0.174,0.18,env.lam(0xfff1d6,{emissive:0xffd9a0,emissiveIntensity:0.8}),{cast:false});
        P.rbox(-0.13,-0.05,-0.45,0.45,H+0.025,H+0.08,0.02,M.black);
        if(L) P.group.children.forEach(function(o){ o.position.y+=L; });
      } else {
        P.rb(0,0,0.4,B,0.36,0.015,M.oak,0.08,true);
        P.legs(0,0,0.15,B/2-0.08,0.08,0.03,0.02,M.oakD);
        P.cabDoors('z',-B/2+0.02,B/2-0.02,-0.2,-1,0.1,0.42,3,false,M.oakD);
      }
      const cx=2*S, cz=0, W=inch?W0:1.24, Hh=spec?(spec.w-0.009)*9/16+0.009:inch?inch*0.01245:0.70, FB=inch&&floor, y0=FB?(spec?0.4+spec.h-Hh:0.48):0.58+L, tb=FB?0.395:0.44+L, fz=W*0.37, fd0=spec?0.195-spec.d-cx:-0.11, fd1=spec?0.195-cx:0.09;   // panel height from the 16:9 screen plus a thin bezel                // the TV sits 2 plan pixels east of the board centre
      [-1,1].forEach(s=>{                                                            // two flat feet with short necks
        P.rbox(cx+fd0,cx+fd1,cz+s*fz-0.035,cz+s*fz+0.035,tb,tb+0.015,0.006,M.black);
        P.box(cx-0.01,cx+0.02,cz+s*fz-0.02,cz+s*fz+0.02,tb+0.015,y0+0.02,M.black);
      });
      P.rbox(cx-0.0,cx+0.045,cz-W*0.27,cz+W*0.27,y0+0.1,y0+0.1+Hh*0.66,0.012,M.black);   // thicker rear housing
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
    /* enclosed 3D printer (38 x 38 x 46 cm) standing at (px, y, pz) of piece P, printing a little robot layer by layer while active */
    function addPrinter3d(P,px,pz,y,always){
        const lam=env.lam, w=0.38, d=0.38, h=0.46, o={}, oc={cast:false};
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
      const glass=new THREE.MeshPhysicalMaterial({color:0x0e1216,metalness:0.25,roughness:0.02,envMapIntensity:1.8,transparent:true,opacity:0.72,clearcoat:1}), paintS=paint.clone(); paintS.vertexColors=false;
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
      stF.unshift(GR); const body=new THREE.Mesh(loft(stF,section,0.03),paint); P.add(body);
      const paintR=paint.clone(), bodyR=new THREE.Mesh(loft(stR,section,0.03),paintR); P.add(bodyR);
      const sideX=function(z,y){ const s=section(z).slice(4,9); for(let i=0;i<s.length-1;i++) if(y>=s[i][1]&&y<=s[i+1][1]){ const k=(y-s[i][1])/Math.max(s[i+1][1]-s[i][1],1e-4); return s[i][0]+(s[i+1][0]-s[i][0])*k; } return s[4][0]; };
      const endZ=function(x,front){ let lo=front?1.6:ZR, hi=front?ZF:-1.6; for(let i=0;i<30;i++){ const m=(lo+hi)/2; if((hw(m)>x)===front) lo=m; else hi=m; } return (lo+hi)/2; };   // where the plan outline reaches half-width x
      /* glass greenhouse (glass roof, as on the real car), black B-pillars and window trim */
      const GF=1.03;
      const yg=smooth([[GR,0.0],[-1.5,0.13],[-1.15,0.3],[-0.7,0.46],[-0.1,0.5],[0.25,0.49],[0.6,0.36],[0.85,0.17],[GF,0.0]]);
      const gst=[]; for(let i=0;i<=60;i++) gst.push(GR+(GF-GR)*i/60);
      const gsec=function(z){ const base=yt(z)-0.01, h=Math.max(yg(z),0.0015), hb=hw(z)-0.1, hr=Math.min(0.6,hb-0.04);
        return [[0,base,0],[hb,base,0],[hb-0.07,base+h*0.45,0],[hr,base+h*0.93,0],[hr*0.5,base+h,0],[0,base+h+0.004,0]]; };
      const gTop=function(z){ const s=gsec(z); return [[0,s[3][1],0],s[3],s[4],s[5]]; };   // roof and windscreen glass; the side windows are separate strips so the door openings can drop them
      const gh=new THREE.Mesh(loft(gst,gTop,1),glass); gh.renderOrder=2; P.add(gh,{cast:false});
      const glassS=glass.clone(), sideGl=[]; glassS.color.setHex(0x1e252b); glassS.opacity=0.5;
      [-1,1].forEach(function(sx){ const pos=[], idx=[]; gst.forEach(function(z,i){ const s=gsec(z); [1,2,3].forEach(function(k){ pos.push(sx*s[k][0],s[k][1],z); }); if(i){ const a=(i-1)*3, b=i*3; [[a,b,a+1],[b,b+1,a+1],[a+1,b+1,a+2],[b+1,b+2,a+2]].forEach(function(t){ idx.push.apply(idx,sx>0?t:[t[0],t[2],t[1]]); }); } });
        const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
        const m=new THREE.Mesh(g,glassS); m.renderOrder=2; P.add(m,{cast:false}); sideGl.push(m); });
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
        const lens=strip(hl,0.05,lam(0x1a1e23,{roughness:0.02,metalness:0.5,envMapIntensity:2})); lens.scale.y=0.75;
        strip(hl.slice(2,-1).map(function(q){ return [q[0]*1.006,q[1]-0.008,q[2]+0.012]; }),0.018,lam(0xc9cdd2,{metalness:1,roughness:0.12}));
        strip(hl.slice(1,-1).map(function(q){ return [q[0]*1.016,q[1]+0.02,q[2]+0.008]; }),0.01,lam(0xffffff,{emissive:0xeef4ff,emissiveIntensity:2.6}));   // LED daytime-running brow
        [0.3,0.55].forEach(function(f){ const q=hl[Math.round(f*(hl.length-1))], pr=new THREE.Mesh(new THREE.SphereGeometry(0.026,16,10),lam(0xe8ecf0,{metalness:0.9,roughness:0.08,emissive:0x9aa6b4,emissiveIntensity:0.6})); pr.position.set(q[0]*1.01,q[1]-0.008,q[2]+0.018); P.add(pr,{cast:false}); });   // projectors
        /* tail light wrapping from the boot lid onto the quarter */
        const tl=[]; for(let z=-1.98;z>=-2.2;z-=0.04){ tl.push([sx*(sideX(z,0.86)+0.002),0.885,z]); } for(let x=sideX(-2.24,0.86)-0.01;x>=0.46;x-=0.04) tl.push([sx*x,0.89,endZ(x,false)+0.008]);
        strip(tl,0.042,lam(0x7a0b0b,{emissive:0x6a0404,roughness:0.06,metalness:0.2}));
        strip(tl.map(function(q){ return [q[0]*1.006,q[1]+0.02,q[2]-0.008]; }),0.009,lam(0xff3a2a,{emissive:0xff2010,emissiveIntensity:2.2}));
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
      const doors=[], dGlass=new THREE.MeshPhysicalMaterial({color:0x3a4249,metalness:0.1,roughness:0.03,transparent:true,opacity:0.38,envMapIntensity:1.6,clearcoat:1,side:THREE.DoubleSide,depthWrite:false});   // frameless door glass, tinted and see-through
      [[-1,0.95,1.05,0.52],[1,0.95,1.05,0.52],[-1,-0.12,0.85,0.66],[1,-0.12,0.85,0.66]].forEach(function(q){
        const sd=q[0], pv=new THREE.Group(); pv.position.set(sd*0.915,0,q[1]); P.group.add(pv);
        const skin=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.56,q[2]),paintS); skin.position.set(0,0.6,-q[2]/2); skin.castShadow=true; pv.add(skin);
        const win=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.38,q[2]*0.9),dGlass); win.position.set(-sd*0.035,1.07,-q[2]/2); win.rotation.z=sd*0.14; win.renderOrder=3; pv.add(win);
        const trim=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.56,q[2]),satin); trim.position.set(-sd*0.03,0.6,-q[2]/2); pv.add(trim);
        pv.visible=false;
        doors.push({pv:pv,sd:sd,max:q[3]});
      });
      /* the door apertures: the body side is clipped away while the doors are open, so the cabin shows; B-pillars and sills fill the frame */
      env.enableLocalClipping&&env.enableLocalClipping();
      const cLoc=[[0,-1,0,0.33],[0,1,0,-0.98],[0,0,-1,-0.97],[0,0,1,-0.95]].map(function(q){ return new THREE.Plane(new THREE.Vector3(q[0],q[1],q[2]),q[3]); });
      const cW=cLoc.map(function(p){ return p.clone(); }); let cutOn=false;
      paint.clippingPlanes=cW; paint.clipIntersection=true;
      body.onBeforeRender=function(){ cLoc.forEach(function(p,i){ cW[i].copy(p).applyMatrix4(body.matrixWorld); if(!cutOn&&i===0) cW[0].constant+=1e4; }); };
      const gLoc=[[0,-1,0,0.95],[0,1,0,-1.4],[0,0,-1,-0.97],[0,0,1,-0.95]].map(function(q){ return new THREE.Plane(new THREE.Vector3(q[0],q[1],q[2]),q[3]); }), gW=gLoc.map(function(p){ return p.clone(); });   // side glass over the door apertures goes with the doors
      glassS.clippingPlanes=gW; glassS.clipIntersection=true;
      sideGl[0].onBeforeRender=function(){ gLoc.forEach(function(p,i){ gW[i].copy(p).applyMatrix4(sideGl[0].matrixWorld); if(!cutOn&&i===0) gW[0].constant+=1e4; }); };
      const frame=new THREE.Group(); frame.visible=false; P.group.add(frame);
      [-1,1].forEach(function(sd){ [[sd*0.86,sd*0.925,-0.13,-0.07,0.33,0.98,piano],[sd*0.8,sd*0.93,-0.97,0.95,0.28,0.35,inner]].forEach(function(b){
        const m=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b[1]-b[0]),b[5]-b[4],b[3]-b[2]),b[6]); m.position.set((b[0]+b[1])/2,(b[4]+b[5])/2,(b[2]+b[3])/2); frame.add(m); }); });
      const dApply=function(e){ cutOn=e>0.001; frame.visible=cutOn; doors.forEach(function(d){ d.pv.visible=cutOn; d.pv.rotation.y=-d.sd*d.max*e; }); };   // outward on both sides
      const dSt=stepper(0.9,dApply); dSt.v=0;
      P.anims.push(function(t){ return dSt.run(t); });
      P.actions=(P.actions||[]).concat([{x:-1.35,z:0.3,label:function(){ return dSt.target?'關上車門':'打開車門'; },act:function(){ dSt.target=dSt.target?0:1; }},
        {x:1.35,z:0.3,label:function(){ return dSt.target?'關上車門':'打開車門'; },act:function(){ dSt.target=dSt.target?0:1; }},
        {x:-1.2,z:-0.25,on:function(){ return dSt.target===1&&dSt.v>0.9; },label:function(){ return '坐進駕駛座'; },act:function(){ env.sitAt&&env.sitAt(P.group,new THREE.Vector3(-0.37,1.1,-0.08),new THREE.Vector3(-1.35,0,0.1)); }},   // right-hand drive
        {x:1.2,z:-0.25,on:function(){ return dSt.target===1&&dSt.v>0.9; },label:function(){ return '坐進副駕駛座'; },act:function(){ env.sitAt&&env.sitAt(P.group,new THREE.Vector3(0.37,1.1,-0.08),new THREE.Vector3(1.35,0,0.1)); }}]);
      /* trunk lid: the rear deck is cut from the body while it is open and a lid hinged at the rear glass swings up; carpeted floor inside */
      const tLoc=[new THREE.Plane(new THREE.Vector3(0,-1,0),TY),new THREE.Plane(new THREE.Vector3(0,0,1),-GR)], tW=tLoc.map(function(p){ return p.clone(); }); let tOn=false;
      paintR.clippingPlanes=tW; paintR.clipIntersection=true;
      bodyR.onBeforeRender=function(){ tLoc.forEach(function(p,i){ tW[i].copy(p).applyMatrix4(bodyR.matrixWorld); if(!tOn&&i===0) tW[0].constant+=1e4; }); };
      const paintL=paint.clone(); paintL.clippingPlanes=null; const hy=yt(GR)+0.01, lidP=new THREE.Group(); lidP.position.set(0,hy,GR); lidP.visible=false; P.group.add(lidP);
      const lid=new THREE.Mesh(loft(stR,function(z){ return section(z).map(function(q){ return [q[0],Math.max(q[1],TY),q[2]]; }); },0.03),paintL); lid.position.set(0,-hy,-GR); lid.castShadow=true; lidP.add(lid);
      const cave=new THREE.Group(); cave.visible=false; P.group.add(cave);
      [[-0.7,0.7,0.5,0.53,-2.22,GR-0.02,lam(0x2b2c2f,{roughness:0.95})],[-0.72,0.72,0.5,TY,GR-0.03,GR-0.02,lam(0x1c1d20,{roughness:0.9})]].forEach(function(b){ const m=new THREE.Mesh(new THREE.BoxGeometry(b[1]-b[0],b[3]-b[2],b[5]-b[4]),b[6]); m.position.set((b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2); cave.add(m); });
      const tSt=stepper(1.2,function(e){ tOn=e>0.001; lidP.visible=cave.visible=tOn; lidP.rotation.x=1.25*e; }); tSt.v=0;
      P.anims.push(function(t){ return tSt.run(t); });
      P.actions.push({x:0,z:-2.85,label:function(){ return tSt.target?'關上後車廂':'打開後車廂'; },act:function(){ tSt.target=tSt.target?0:1; }});
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
    /* 1.5 m bathtub (78 cm wide, 55 cm high) with softly rounded corners, filled with water; the apron faces +x, the tap is on the -x wall */
    Catalog.bathtub=function(len,deck,side,tapEnd){   // len: basin length along z (default 1.5 m); deck: a ledge moulded onto the end at side (+1 = +z); tapEnd: tap and pop-up drain at that end instead of the long side
      const P=new Piece(), lam=env.lam, shell=mat('tub',0xe8e1d6,{roughness:0.25,envMapIntensity:0.7}), inner=mat('tubIn',0xcfe6ef,{roughness:0.15});   // warm greige shell so the tub reads against white tiles
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
      fm(new THREE.BoxGeometry(0.692,0.86,0.03),shell,0,0.495,0); fm(new THREE.BoxGeometry(0.4,0.02,0.02),M.steel,0,0.83,0.025);
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
        P.rbox(-0.125,0.045,z-0.095,z+0.095,0.31,0.33,0.03,lam(0xd9dcdf,{roughness:0.3}));
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
      const P=new Piece(), x0=-w/2, x1=w/2, pw=0.42, ph=top-0.015-bottom, meshes=[], cm=opt.color?env.lam(opt.color,{roughness:0.95,transparent:true,opacity:0.88,side:THREE.DoubleSide}):M.linen, ties=[];
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
    Catalog.sinkCounter=function(w,d,sink,units){
      const P=new Piece(), lam=env.lam, oc={cast:false};
      const tx0=-0.01, tx1=w, tz0=-0.01, tz1=d+0.04;
      P._col(0,w,0,d,true);
      if(!sink){                                  // plain base cabinet with a worktop (e.g. an island with the hob)
        P.box(0,w,0,d,0,0.84,M.cab); P.rbox(tx0,tx1,tz0,tz1,0.84,0.88,0.01,M.top);
        P.box(0,w,-0.012,0,0,0.099,M.dark,{cast:false}); P.box(0,w,-0.012,0,0.099,0.1,M.cab,{cast:false}); return fronts(P,w,d,units);
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
      P.box(0,w,-0.012,0,0,0.099,M.dark,oc); P.box(0,w,-0.012,0,0.099,0.1,M.cab,oc);   // light cap so the door reveals don't show the dark plinth top
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
        if(u.k==='sink'){ P.cabDoors('x',x0,x1,0,-1,0.1,0.83,2,false,null,ft); return; }
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
        if(u.k==='slim'){                          // narrow two-tier drawer: cutting boards and wraps on top, dishwasher and cleaning stock below
          const top=drawer(x0,x1,0.47,0.83,M.cabF,function(add,cx,bw,bd,fy){
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
          (P.actions=P.actions||[]).push({x:(x0+x1)/2,z:-0.55,label:function(){ return sB.target?'關上抽屜':sT.target?'改開下層（洗碗機洗劑・紙巾）':'打開砧板・保鮮膜抽屜'; },
            act:function(){ if(sB.target){ sB.target=0; } else if(sT.target){ sT.target=0; sB.target=1; } else sT.target=1; }}); return;
        }
        if(u.k==='spice'){                         // slim full-height pull-out beside the hob: three open tiers with gallery rails, packed with seasonings
          const g=new THREE.Group(); P.group.add(g);
          const add=function(geo,mt,x,y,z,cast){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=!!cast; m.receiveShadow=true; g.add(m); return m; };
          const cx=(x0+x1)/2, bw=x1-x0-0.03, bd=d-0.08, wire=M.steel, inn=mat('drawerIn',0xf2f0ea,{roughness:0.5});
          add(new THREE.BoxGeometry(x1-x0-0.006,0.724,ft),M.cabF,cx,0.465,-ft/2,true);
          add(new THREE.BoxGeometry(Math.min(0.2,bw*0.6),0.014,0.016),M.steel,cx,0.78,-ft-0.008);
          add(new THREE.BoxGeometry(bw,0.68,0.01),inn,cx,0.46,bd);                                        // back panel
          [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.012,0.68,0.012),wire,cx+sd*bw/2,0.46,bd/2); });
          const cols=[0x3a1c10,0xd8b46a,0xe8d8a0,0xf4f2ec,0x2a2a2a,0xc9372c,0x8a5a2a,0xe8e2c8,0x6b7d3a,0xd98a2b,0xb5452f,0x4a3a2a];
          [0.13,0.37,0.61].forEach(function(y,row){
            add(new THREE.BoxGeometry(bw,0.01,bd),inn,cx,y,bd/2);
            [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.006,0.006,bd),wire,cx+sd*(bw/2-0.003),y+0.06,bd/2); });   // gallery rails
            const nc=bw<0.14?1:2; for(let i=0;i<5;i++) for(let j=0;j<nc;j++){ const k=row*10+i*2+j, c=cols[k%cols.length], h=0.11+((k*7)%5)*0.02, r=nc>1?0.026:0.028, x=nc>1?cx+(j?0.042:-0.042):cx, z=0.04+i*(bd-0.07)/4;   // one column of jars in a slim pull-out
              add(new THREE.CylinderGeometry(r,r,h,14),lam(c,{roughness:0.3}),x,y+0.005+h/2,z,true);
              add(new THREE.CylinderGeometry(r*0.6,r*0.6,0.02,10),lam(k%3?0xf4f4f0:0xd8453c),x,y+0.015+h,z); }
          });
          sliders.push({g:[g],out:[0.45],x:(x0+x1)/2,label:['拉出調味料架','推回調味料架']}); return;
        }
        if(u.k==='drawers'){                       // top: cutlery tray, chopsticks; bottom: stacked plates, bowls and a pot
          const top=drawer(x0,x1,0.67,0.83,M.cabF,function(add,cx,bw,bd,fy){
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
    Catalog.bathWallSet=function(o){              // o.shelfFrom: left end of the counter in px (default 700, i.e. a 1.03 m counter); o.mirror: mirror above the counter ('tall': 30 x 75 cm); o.barLeft: slide bar at the left end
      o=o||{};
      const P=new Piece(), lam=env.lam, oc={cast:false}, L=function(px){ return (px-742.5)*S1; };
      const sy=0.79, steelM=lam(0xd6dade,{metalness:0.85,roughness:0.25,envMapIntensity:1}), whiteP=lam(0xf6f6f3,{roughness:0.25});
      P.rbox(L(o.shelfFrom||700),L(785),0,0.13,sy-0.03,sy,0.01,whiteP);
      if(o.mirror){ const tall=o.mirror==='tall', mw=tall?0.3:0.4, mh=o.mirrorH||(tall?0.75:0.5), mx=o.mirrorX!==undefined?o.mirrorX:(tall?0.05:L(735)-0.1), my=(o.mirrorY||sy+0.17)+mh/2, m=env.mirror?env.mirror(mw,mh):new THREE.Mesh(new THREE.PlaneGeometry(mw,mh),mat('mirror',0xdfe8ec,{metalness:1,roughness:0.03,envMapIntensity:1})); m.position.set(mx,my,0.006); P.group.add(m);
        P.box(mx-mw/2-0.012,mx+mw/2+0.012,0,0.004,my-mh/2-0.012,my+mh/2+0.012,whiteP,oc); P.mirrorX=mx; }
      P.rbox(L(714),L(756),0,0.06,0.58,0.64,0.025,steelM);
      [L(714)+0.02,L(756)-0.02].forEach(function(x){ const k=P.cyl(x,0.07,0.03,0.03,0.58,0.64,lam(0xeceeef,{roughness:0.3}),oc,18); k.rotation.x=Math.PI/2; k.position.y=0.61; k.position.z=0.07; });
      P.cyl(L(735),0.04,0.012,0.012,0.53,0.58,steelM,oc,10);
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
      const hose=new THREE.CatmullRomCurve3([new THREE.Vector3(tapEnd,0.58,0.04),new THREE.Vector3(tapEnd+hs*0.07,0.3,0.12),new THREE.Vector3(barX-hs*0.06,0.42,0.13),new THREE.Vector3(barX+hs*0.02,0.95,0.1),hb]);
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
      const F=!!opt.full, W=F?1.185:1.0, D=opt.depth||0.45, x0=-W/2, x1=W/2, z0=-D/2, z1=D/2, zb=z1-0.45, T=0.02;   // opt.depth: deeper carcass, contents keep their place behind the front
      const silver=lam(0xb9bec4,{metalness:0.85,roughness:0.3,envMapIntensity:1}), glass=lam(0x0d1114,{roughness:0.1,metalness:0.2,envMapIntensity:1}), cream=lam(0xf3efe6,{roughness:0.35}), blk=lam(0x1b1d20,{roughness:0.4}), led=new THREE.MeshBasicMaterial({color:0x76ffb2});
      P.box(x0,x1,z0,z0+0.015,0.1,1.96,M.cabF,o);
      P.box(x0,x0+T,z0,z1,0.1,1.96,M.cabF,o); P.box(x1-T,x1,z0,z1,0.1,1.96,M.cabF,o);
      P.box(x0+T,x1-T,z0+0.015,z1,0.1,0.12,M.cabF,o); if(!opt.bins) P.box(x0+T,x1-T,z0+0.015,z1-0.02,0.47,0.49,M.cabF,oc); P.box(x0,x1,z0,z1,0.82,0.85,M.cabF,o); P.box(x0+0.02,x1-0.02,z1-0.012,z1,0,0.1,M.dark,oc);
      if(opt.dishes) (function(){ const DS=THREE.DoubleSide, oc2={cast:false}, cer=[lam(0xf6f3ec,{roughness:0.25,side:DS}),lam(0xc9d6df,{roughness:0.25,side:DS}),lam(0xe8d7c0,{roughness:0.3,side:DS}),lam(0x3e4a52,{roughness:0.3,side:DS})];   // dish cupboard: plates on edge and bowls below, cups and glasses above, wraps standing at the right
        const zc=zb+0.2, wood=M.oak;
        P.box(x0+0.04,x0+0.3,zc-0.13,zc+0.13,0.12,0.13,wood,oc2);
        for(let i=0;i<10;i++){ const r=i<6?0.12:0.09, pl=new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.82,0.014,28),cer[i%3]); pl.rotation.z=Math.PI/2; pl.position.set(x0+0.06+i*0.024,0.13+r,zc); P.add(pl); }   // large and small plates standing in a rack
        const bowl=function(x,z,r,y,m){ const b=new THREE.Mesh(new THREE.SphereGeometry(r,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),m); b.position.set(x,y+r,z); b.rotation.x=Math.PI; b.scale.y=-1; P.add(b); };
        [[x0+0.42,0.075,cer[0],4],[x0+0.62,0.06,cer[1],4],[x0+0.8,0.07,cer[3],3],[x0+0.98,0.05,cer[2],5]].forEach(function(q){ for(let k=0;k<q[3];k++) bowl(q[0],zc,q[1],0.12+k*0.03,q[2]); });   // rice, soup, noodle and small bowls
        const glass=lam(0xeef4f6,{transparent:true,opacity:0.35,roughness:0.03,side:DS});
        const cup=function(x,z,r,h,m,handle){ P.cyl(x,z,r,r*0.9,0.49,0.49+h,m,{open:true},18); P.cyl(x,z,r*0.9,r*0.9,0.49,0.495,m,oc2,18); if(handle){ const t=new THREE.Mesh(new THREE.TorusGeometry(h*0.28,0.006,8,14,Math.PI),m); t.position.set(x+r+0.003,0.49+h*0.5,z); t.rotation.z=-Math.PI/2; P.add(t); } };
        [[0.06,cer[0]],[0.16,cer[1]],[0.26,cer[3]],[0.36,cer[2]]].forEach(function(q){ cup(x0+q[0],zc-0.07,0.04,0.095,q[1],true); });   // mugs
        for(let i=0;i<5;i++) cup(x0+0.48+i*0.075,zc-0.07,0.032,0.12,glass,false);                                              // tumblers
        for(let i=0;i<4;i++) cup(x0+0.06+i*0.09,zc+0.09,0.035,0.07,cer[2-i%2],true);                                          // tea cups
        for(let i=0;i<3;i++){ cup(x0+0.48+i*0.09,zc+0.09,0.03,0.14,glass,false); }                                            // tall glasses
        [[0x3a8dd6],[0x6fbf73],[0xbfc4c8],[0xc9a46a]].forEach(function(q,i){ P.box(x1-0.2+i*0.045,x1-0.165+i*0.045,zc-0.15,zc+0.15,0.49,0.54,lam(q[0],{roughness:0.5}),oc2); });   // wrap, zip bags, foil, baking paper standing in a row
      })();
      if(!opt.bins&&!opt.dishes) (function(){ const wt=lam(0xd8ecf4,{transparent:true,opacity:0.55,roughness:0.05}), cap=lam(0x3f7fc0), wh=lam(0xfafaf8,{roughness:0.8});   // inside the lower cupboard
        for(let i=0;i<4;i++){ P.cyl(x0+0.1+i*0.11,zb+0.15,0.048,0.048,0.12,0.42,wt,oc,16); P.cyl(x0+0.1+i*0.11,zb+0.15,0.016,0.016,0.42,0.45,cap,oc,10); }   // 2 L water bottles
        P.box(x1-0.42,x1-0.06,zb+0.04,zb+0.3,0.12,0.37,lam(0xc9a87a,{roughness:0.9}),oc); P.box(x1-0.42,x1-0.06,zb+0.3,zb+0.302,0.18,0.28,lam(0xc8372f),oc);   // a case of drinks
        for(let i=0;i<3;i++) P.cyl(x0+0.1+i*0.13,zb+0.14,0.06,0.06,0.49,0.71,wh,oc,18);                                               // kitchen paper
        [[0xe9eef2,0.0],[0xd8dde2,0.05],[0x9fb4c8,0.1]].forEach(function(q){ P.box(x1-0.45,x1-0.13,zb+0.06,zb+0.12,0.49+q[1],0.53+q[1],lam(q[0],{roughness:0.6}),oc); });   // wrap, foil, bags
        [0.0,0.09].forEach(function(dz){ P.cyl(x1-0.25,zb+0.22+dz,0.04,0.04,0.49,0.6,lam(0x3a4a3a,{roughness:0.7}),oc,14); });         // bin-bag rolls
      })();
      P.box(x0-0.005,x1+0.005,z0,z1+0.025,0.85,0.88,M.top,o);
      [1.3,1.7].forEach(function(y){ P.box(x0,x1,z0,z1,y,y+0.03,M.oak,o); });
      P.box(x0,x1,z0,z1,1.93,1.96,M.oak,o);
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
        [[x0,1],[x1,-1]].forEach(function(q){ const G=new THREE.Group(); G.position.set(q[0],0,z1); P.group.add(G); lowD.push(G);
          const L=W/2-0.003, pm=new THREE.Mesh(new THREE.BoxGeometry(L,0.72,0.02),M.cabF); pm.position.set(q[1]*L/2,0.465,0.011); pm.castShadow=pm.receiveShadow=true; G.add(pm);
          const hd=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.14,0.012),M.steel); hd.position.set(q[1]*(L-0.05),0.7,0.028); G.add(hd); });
        const lowSt=stepper(0.6,function(t){ const e=ease(t); lowD[0].rotation.y=-1.7*e; lowD[1].rotation.y=1.7*e; });
        P.anims.push(function(t){ return lowSt.run(t); });
        P.actions=(P.actions||[]).concat([{x:0,z:z1+0.45,label:function(){ return lowSt.target?(opt.dishes?'關上食器櫃':'關上下櫃'):(opt.dishes?'打開食器櫃':'打開電器櫃下櫃'); },act:function(){ lowSt.target=lowSt.target?0:1; }}]);
      }
      const az=zb+0.04;
      const body=function(cx,w,d,h,y,mt,r){ return P.rbox(cx-w/2,cx+w/2,az,az+d,y,y+h,r||0.012,mt,o); };
      (function(){ const cx=x0+(F?0.25:0.28), y=1.33, f=az+0.34;                         // microwave
        body(cx,0.46,0.34,0.27,y,cream); P.box(cx-0.21,cx+0.05,f,f+0.004,y+0.03,y+0.24,glass,oc);
        P.box(cx+0.08,cx+0.2,f,f+0.004,y+0.03,y+0.24,silver,oc); P.box(cx+0.1,cx+0.18,f+0.004,f+0.006,y+0.18,y+0.215,led,oc);
        [0.07,0.12].forEach(function(dy){ P.cyl(cx+0.14,f+0.012,0.016,0.016,0,0,silver,oc,12); const k=P.cyl(cx+0.14,0,0.014,0.014,0,0.012,silver,oc,12); k.rotation.x=Math.PI/2; k.position.set(cx+0.14,y+dy,f+0.01); });
        P.box(cx+0.215,cx+0.222,f+0.002,f+0.012,y+0.05,y+0.22,silver,oc);
      })();
      (function(){ const cx=x0+(F?0.68:0.76), y=1.33, f=az+0.3, tw=F?0.38:0.4;               // toaster oven
        body(cx,tw,0.3,0.23,y,silver,0.01); P.box(cx-0.17,cx+0.06,f,f+0.004,y+0.035,y+0.195,glass,oc);
        [0.1,0.17].forEach(function(dx){ [0.065,0.15].forEach(function(dy){ const k=P.cyl(0,0,0.016,0.016,0,0.02,blk,oc,14); k.rotation.x=Math.PI/2; k.position.set(cx+dx,y+dy,f+0.01); }); });
        P.box(cx-0.16,cx+0.05,f+0.004,f+0.03,y+0.205,y+0.215,silver,oc);
        [-0.15,0.15].forEach(function(dx){ P.box(cx+dx-0.02,cx+dx+0.02,az+0.02,az+0.28,y-0.012,y,blk,oc); });
      })();
      (function(){ const cx=x0+(F?1.02:0.8), y=F?1.33:0.88, f=az+0.36, fw=F?0.28:0.3;                  // air fryer (on the upper shelf in the full set)
        body(cx,fw,0.36,0.36,y,blk,0.04); P.box(cx-0.12,cx+0.12,f,f+0.01,y+0.07,y+0.2,lam(0x2c2f33,{roughness:0.5}),oc);
        P.box(cx-0.09,cx+0.09,f+0.004,f+0.022,y+0.16,y+0.18,silver,oc);
        P.box(cx-0.08,cx+0.08,f+0.002,f+0.006,y+0.26,y+0.32,glass,oc); P.box(cx-0.06,cx+0.0,f+0.006,f+0.008,y+0.28,y+0.3,led,oc);
        for(let i=0;i<6;i++) P.box(cx-0.12+i*0.04,cx-0.095+i*0.04,az+0.09,az+0.27,y+0.358,y+0.364,lam(0x0a0b0d),oc);
      })();
      (function(){ const y=0.88, cx=x0+(F?0.12:0.16), cz=az+0.16;                                  // 1 L electric kettle on its base: fill, flip the switch, it boils and clicks off
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
        P.actions=(P.actions||[]).concat([{x:cx,z:z1+0.4,label:function(){ return on?'煮水中…':'按下煮水壺開關'; },act:function(){ if(on) return; on=true; t0=null; lamp.material.color.setHex(0x3a8dff); sw.position.y=-0.006; }}]);
      })();
      if(F) (function(){ const y=0.88, cx=x0+0.38, cz=az+0.18, red=lam(0xe8dccb,{roughness:0.35}), grey=lam(0x9a9a98,{roughness:0.4}), st=lam(0xd6dade,{metalness:0.85,roughness:0.25,envMapIntensity:1});   // Tatung electric cooker (大同電鍋), 10-cup, milk-tea colour
        P.cyl(cx,cz,0.13,0.13,y,y+0.02,lam(0x2a2826,{roughness:0.5}),o,28); P.cyl(cx,cz,0.14,0.13,y+0.02,y+0.2,red,o,32); P.cyl(cx,cz,0.142,0.142,y+0.19,y+0.205,st,oc,32);
        const lid=new THREE.Mesh(new THREE.SphereGeometry(0.135,28,10,0,Math.PI*2,0,0.75),st); lid.position.set(cx,y+0.16,cz); lid.scale.y=0.7; P.add(lid);
        P.cyl(cx,cz,0.022,0.018,y+0.27,y+0.3,lam(0x2a2826,{roughness:0.4}),oc,16);
        [-1,1].forEach(function(sd){ P.box(cx+sd*0.15-0.015,cx+sd*0.15+0.015,cz-0.03,cz+0.03,y+0.15,y+0.17,lam(0xb8b6b0),oc); });
        P.rbox(cx-0.025,cx+0.025,cz+0.125,cz+0.148,y+0.03,y+0.11,0.012,grey,oc); P.box(cx-0.008,cx+0.008,cz+0.146,cz+0.152,y+0.06,y+0.09,lam(0xf4f2ec),oc); P.cyl(cx+0.04,cz+0.138,0.008,0.008,y+0.07,y+0.072,lam(0xffb070,{emissive:0xff7a20,emissiveIntensity:0.6}),oc,10);
      })();
      if(F) (function(){ const y=0.88, cx=x0+0.7, cz=az+0.19, wh=lam(0xf7f7f5,{roughness:0.3}), lg=lam(0xe9eae8,{roughness:0.35}), lcd=lam(0xa9b3a4,{roughness:0.2}), mk=lam(0x6a6c6e,{roughness:0.5});   // IH rice cooker, 5.5-cup (Tiger JBH type, W 27 x D 34 x H 20 cm)
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
      const cxm=x0+(F?1.0:0.48), y0c=0.88, Wc=0.26, Dc=0.4, fz=az+Dc, ledM=new THREE.MeshBasicMaterial({color:0x76ffb2});   // bean-to-cup coffee machine
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
      P.actions.push({x:cxm,z:fz,label:function(){ return '沖煮咖啡'; },act:function(){ if(brewT0!==null&&lastT-brewT0<9.5) return; brewT0=lastT; }});
      (function(){ const y=1.73, n=3, gap=0.03, bw=(W-0.04-gap*(n+1))/n;                     // three matching fabric boxes on the top shelf, evenly spaced and flush at the front
        [0x8a9a86,0xc9b27f,0xb98368].forEach(function(c,i){ const bx0=x0+0.02+gap+i*(bw+gap); P.rbox(bx0,bx0+bw,z0+0.05,z0+0.4,y,y+0.18,0.015,fab(c),o); P.box(bx0+bw/2-0.04,bx0+bw/2+0.04,z0+0.4,z0+0.405,y+0.12,y+0.14,fab(0x5a4a3a),oc); });
      })();
      (function(){                                                                          // sockets, and a cable duct along the back of each shelf that the cords drop into
        const plate=lam(0xf4f2ec,{roughness:0.5}), hole=lam(0x1a1a1a), duct=lam(0xf3f1ec,{roughness:0.45}), cw=lam(0xe8e8e4,{roughness:0.8}), cb=lam(0x242424,{roughness:0.8});
        const sock=function(px,py){ P.rbox(px-0.022,px+0.022,z0+0.015,z0+0.022,py-0.045,py+0.045,0.004,plate,oc); [-0.02,0.02].forEach(function(dy){ P.box(px-0.009,px+0.009,z0+0.022,z0+0.0235,py+dy-0.006,py+dy+0.006,hole,oc); }); };
        const ductAt=function(y){ P.box(x0+0.025,x1-0.025,z0+0.015,z0+0.055,y,y+0.04,duct,oc); P.box(x0+0.025,x1-0.025,z0+0.052,z0+0.055,y+0.034,y+0.036,lam(0xd9d6cf),oc); };   // 4 x 4 cm raceway with a lid seam
        ductAt(0.88); ductAt(1.33);
        const drop=function(x,y,zf,mt){ const pts=[[x,y,zf],[x,y-0.01,zf-0.4*(zf-z0-0.06)],[x,y+0.035,z0+0.07],[x,y+0.045,z0+0.04]].map(function(q){ return new THREE.Vector3(q[0],q[1],q[2]); });   // short run from the appliance's back into the duct
          P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,0.0035,6,false),mt),oc); };
        const P1=[x0+(F?0.55:0.335),1.06], P2=[x0+(F?0.86:0.64),1.06], P3=[x0+(F?0.47:0.535),1.48];
        [P1,P2,P3].forEach(function(q){ sock(q[0],q[1]); [-0.012,0.012].forEach(function(dx){ P.box(q[0]+dx-0.002,q[0]+dx+0.002,z0+0.022,z0+0.03,q[1]-0.06,q[1]-0.02,cb,oc); }); });   // plugs leave the sockets and go straight down behind the duct lid
        if(F){ drop(x0+0.12,0.9,az+0.02,cw); drop(x0+0.38,0.9,az+0.02,cw); drop(x0+0.7,0.9,az+0.02,cw); drop(cxm-0.06,0.9,az+0.02,cb); drop(x0+1.02,1.35,az+0.02,cb); }
        else { drop(x0+0.19,0.9,az+0.02,cw); drop(cxm-0.06,0.9,az+0.02,cb); drop(x0+0.85,0.9,az+0.02,cb); }
        drop(x0+0.33,1.35,az+0.02,cw); drop(x0+0.71,1.35,az+0.02,cb);
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
    Catalog.litterRobot=function(){
      const P=new Piece(), lam=env.lam, base=lam(0x8c9096,{roughness:0.45}), globe=lam(0xf3f2ee,{roughness:0.25}), oc={cast:false};
      P.rbox(-0.3,0.3,-0.33,0.33,0,0.2,0.06,base);
      const g=new THREE.Mesh(new THREE.SphereGeometry(0.3,32,20),globe); g.position.set(0,0.47,0); g.castShadow=true; P.add(g);
      const hole=new THREE.Mesh(new THREE.CircleGeometry(0.15,28),lam(0x2b2d31,{roughness:0.6})); hole.rotation.y=Math.PI/2; hole.position.set(0.286,0.44,0); P.add(hole,oc);
      P.box(0.27,0.3,-0.28,0.28,0.0,0.05,lam(0x6a6e74,{roughness:0.5}),oc);
      P.box(0.299,0.302,-0.05,0.05,0.12,0.15,new THREE.MeshBasicMaterial({color:0x7cd6a0}),oc);
      P._col(-0.3,0.3,-0.33,0.33,true); return P;
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
    Catalog.reclinerSofa=function(){
      const P=new Piece(), cloth=env.fab(0x8c8178), dark=env.lam(0x2a2826,{roughness:0.5});
      const soft=function(w,h,d,r){ const sh=new THREE.Shape(), q=Math.min(r,w/2-0.001,h/2-0.001);                       // pillowy block: rounded rectangle extruded with a deep bevel
        sh.moveTo(-w/2+q,-h/2); sh.lineTo(w/2-q,-h/2); sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+q); sh.lineTo(w/2,h/2-q); sh.quadraticCurveTo(w/2,h/2,w/2-q,h/2); sh.lineTo(-w/2+q,h/2); sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-q); sh.lineTo(-w/2,-h/2+q); sh.quadraticCurveTo(-w/2,-h/2,-w/2+q,-h/2);
        const b=Math.min(r,d/2-0.001), g=new THREE.ExtrudeGeometry(sh,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b*0.9,bevelSegments:5,curveSegments:8}); g.center(); return g; };
      const put=function(par,geo,x,y,z,ry){ const m=new THREE.Mesh(geo,cloth); m.position.set(x,y,z); if(ry) m.rotation.y=ry; m.castShadow=m.receiveShadow=true; par.add(m); return m; };
      put(P.group,soft(2.1,0.32,0.9,0.06),0,0.26,0,Math.PI/2); P._col(-0.45,0.45,-1.05,1.05,true);                           // base
      put(P.group,soft(1.8,0.4,0.15,0.05),-0.375,0.3,0,Math.PI/2);                                                            // back frame
      [-1,1].forEach(function(sd){ put(P.group,soft(0.9,0.56,0.15,0.07),0,0.33,sd*0.975); put(P.group,soft(0.88,0.07,0.17,0.035),0,0.635,sd*0.975); });   // arms run front to back, with a padded top
      [[-0.4,-1],[0.4,-1],[-0.4,1],[0.4,1]].forEach(function(c){ P.box(c[0]-0.03,c[0]+0.03,c[1]*0.98-0.03,c[1]*0.98+0.03,0,0.1,dark,{cast:false}); });
      const parts=[];
      [-0.6,0,0.6].forEach(function(z){
        put(P.group,soft(0.58,0.12,0.68,0.06),0.08,0.46,z,Math.PI/2);                                                       // seat cushion
        const bk=new THREE.Group(); bk.position.set(-0.3,0.45,z); P.group.add(bk);
        put(bk,soft(0.56,0.55,0.2,0.08),-0.05,0.27,0,Math.PI/2);                                                            // back cushion
        put(bk,soft(0.5,0.16,0.15,0.06),0.03,0.6,0,Math.PI/2);                                                              // head pillow
        const ft=new THREE.Group(); ft.position.set(0.42,0.4,z); P.group.add(ft);
        put(ft,soft(0.54,0.07,0.36,0.03),0.18,-0.035,0,Math.PI/2);                                                          // footrest
        parts.push({bk:bk,ft:ft});
      });
      const apply=function(e){ parts.forEach(function(p){ p.bk.rotation.z=0.12+0.5*e; p.ft.rotation.z=-(1-e)*Math.PI/2; }); };   // folded: the footrest hangs as the seat front
      const st=stepper(1.4,apply); st.v=0; apply(0); P.group.scale.set(1.0,0.887,2.12/2.1);   // scaled to 212 x 96 x 98 cm
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:0.75,z:0,label:function(){ return st.target?'沙發收回':'沙發電動躺平'; },act:function(){ st.target=st.target?0:1; }}];
      P.recline={get on(){ return !!st.target; },set on(v){ st.target=v?1:0; }};
      return P;
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
    /* compact zero-gravity massage chair, upright 137.5 x 67.5 x 105.5, reclined 156.5 x 67.5 x 90.5: white faceted shell sides that rock back on a low base, beige fabric inside, a single leg block with two foot channels. Front +x */
    Catalog.massageChair=function(){
      const P=new Piece(), lam=env.lam, oc={cast:false}, HW=0.3375;
      const shell=lam(0xf6f5f2,{roughness:0.18,metalness:0.04,envMapIntensity:1.3}), fab=lam(0xd9c9ae,{roughness:0.75}), fabD=lam(0xc8b697,{roughness:0.8}), dark=lam(0x1c1d1f,{roughness:0.45}), wood=lam(0xd2a878,{roughness:0.4});
      const R=function(w,h,d,rr){ const r=Math.min(rr||0.04,Math.min(w,h,d)*0.45), sh=new THREE.Shape(), q=Math.min(r,Math.min(w,h)/2-0.001);
        sh.moveTo(-w/2+q,-h/2); sh.lineTo(w/2-q,-h/2); sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+q); sh.lineTo(w/2,h/2-q); sh.quadraticCurveTo(w/2,h/2,w/2-q,h/2); sh.lineTo(-w/2+q,h/2); sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-q); sh.lineTo(-w/2,-h/2+q); sh.quadraticCurveTo(-w/2,-h/2,-w/2+q,-h/2);
        const g=new THREE.ExtrudeGeometry(sh,{depth:Math.max(0.001,d-2*r*0.8),bevelEnabled:true,bevelThickness:r*0.8,bevelSize:r*0.5,bevelSegments:4,curveSegments:8}); g.center(); g.scale(w/(w+r),h/(h+r),1); return g; };
      const mesh=function(par,geo,mt,x,y,z,rz){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); if(rz) m.rotation.z=rz; m.castShadow=m.receiveShadow=true; par.add(m); return m; };
      /* base: a low white plinth with a dark underside, the rocker foot behind */
      mesh(P.group,R(0.62,0.1,0.56,0.03),shell,-0.22,0.07,0); P.box(-0.5,0.08,-0.26,0.26,0,0.03,dark,oc); mesh(P.group,R(0.2,0.14,0.44,0.04),shell,-0.56,0.08,0);
      const BODY=new THREE.Group(); BODY.position.set(-0.42,0.12,0); P.group.add(BODY);
      const prof=new THREE.Shape();                                                                                    // faceted side shell: sharp chamfered front, tall back wing
      [[0.02,0.0],[0.58,0.0],[0.76,0.3],[0.66,0.5],[0.38,0.56],[0.28,0.82],[0.1,0.88],[-0.08,0.84],[-0.12,0.4],[-0.06,0.08]].forEach(function(q,k){ if(k) prof.lineTo(q[0],q[1]); else prof.moveTo(q[0],q[1]); });
      const sg=new THREE.ExtrudeGeometry(prof,{depth:0.06,bevelEnabled:true,bevelThickness:0.015,bevelSize:0.015,bevelSegments:3});
      [-1,1].forEach(function(sd){ mesh(BODY,sg,shell,0,0,sd>0?HW-0.075:-HW+0.015);
        mesh(BODY,new THREE.BoxGeometry(0.34,0.008,0.004),wood,0.48,0.26,sd*(HW+0.001),0.55).castShadow=false;           // crease highlight along the chamfer
        mesh(BODY,R(0.3,0.05,0.09,0.02),fab,0.46,0.555,sd*0.235); });                                                       // arm pads
      mesh(BODY,R(0.9,0.3,2*HW-0.14,0.04),shell,0.3,0.17,0);                                                                  // seat box between the shells
      mesh(BODY,R(0.5,0.1,0.5,0.03),fab,0.4,0.36,0);                                                                          // seat cushion, 45 cm wide
      [-1,1].forEach(function(sd){ mesh(BODY,R(0.3,0.06,0.07,0.02),fabD,0.4,0.42,sd*0.2); });                                 // thigh bolsters
      const BK=new THREE.Group(); BK.position.set(0.1,0.34,0); BODY.add(BK);                                                  // backrest on its own pivot
      mesh(BK,R(0.14,0.6,0.5,0.05),fab,0.0,0.3,0); [-0.08,0,0.08].forEach(function(z){ mesh(BK,new THREE.BoxGeometry(0.004,0.5,0.01),fabD,0.072,0.3,z).castShadow=false; });
      [-1,1].forEach(function(sd){ mesh(BK,R(0.18,0.3,0.1,0.04),fab,0.09,0.36,sd*0.21); mesh(BK,R(0.12,0.1,0.03,0.01),wood,0.1,0.46,sd*0.265); });   // shoulder airbags with the wooden-tone trims
      mesh(BK,R(0.12,0.2,0.36,0.05),fab,0.06,0.56,0);                                                                       // head pillow
      const LG=new THREE.Group(); LG.position.set(0.74,0.31,0); BODY.add(LG);                                                 // leg block hinged at the seat front
      mesh(LG,R(0.38,0.3,0.6,0.04),fab,0.19,-0.13,0);
      [[-0.235,-0.15],[-0.05,0.05],[0.15,0.235]].forEach(function(q){ mesh(LG,R(0.34,0.26,q[1]-q[0],0.02),fabD,0.19,0.03,(q[0]+q[1])/2); });   // the three ridges that form two foot channels
      const BODY0=BODY.position.clone();
      const apply=function(e){ BODY.rotation.z=0.45*e; BODY.position.set(BODY0.x+0.04*e,BODY0.y,0); BK.rotation.z=0.26+0.1*e; LG.rotation.z=-1.3+1.0*e; };
      const st=stepper(1.6,apply); st.v=0; apply(0); P.group.scale.set(1.1,0.94,1);   // brings the model to the maker's 137.5 / 156.5 cm lengths
      P.anims.push(function(t){ return st.run(t); });
      P.actions=[{x:1.0,z:0,label:function(){ return st.target?'按摩椅直立':'按摩椅躺平'; },act:function(){ st.target=st.target?0:1; }}];
      P._col(-0.7,0.9,-HW,HW,true);
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
      const P=new Piece(), lam=env.lam, body=lam(0xf1eee8,{roughness:0.45}), inn=lam(0xf6f4ef,{roughness:0.6}), oc={cast:false}, W=width||0.45, D=depth||0.45, H=2.0, t=0.018, hz=W/2, x0=-D/2, x1=D/2;
      P.box(x0,x1-0.02,-hz,-hz+t,0,H,body); P.box(x0,x1-0.02,hz-t,hz,0,H,body); P.box(x0,x1-0.02,-hz,hz,H-t,H,body); if(!robot) P.box(x0,x1-0.02,-hz,hz,0,0.08,body); P.box(x0,x0+t,-hz,hz,0,H,body);
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
      P.box(x0,x1-0.02,z0,z0+0.018,0.1,0.84,M.cab); P.box(x0,x1-0.02,z1-0.018,z1,0.1,0.84,M.cab); P.box(x0,x0+0.018,z0,z1,0.1,0.84,M.cab); P.box(x0,x1-0.02,-0.009,0.009,0.1,0.84,M.cab,oc);
      P.box(x0,x1-0.02,z0,z1,0.1,0.12,M.cab); P.box(x0+0.01,x1-0.03,z0+0.01,flush?z1+0.012:z1-0.01,0,0.1,M.dark,oc);
      if(flush){ P.box(x0+0.003,x1-0.02,z1,z1+0.018,0.1,0.83,M.cabF); P.box(x0,x1-0.03,z1,z1+0.012,0,0.099,M.dark,oc); P.box(x0,x1-0.03,z1,z1+0.012,0.099,0.1,M.cab,oc); }   // kitchen side: panel flush with the counter's door fronts, kick strip in line with its plinth
      if(flush) P.box(x0+0.01,x1+0.02,z0-0.04,z1+0.01,0.84,0.88,M.top);   // facing west (turned 180°), so the counter's 4 cm living-room overhang is on local -z else P.rbox(x0-0.005,x1+0.02,z0-0.005,z1+0.005,0.84,0.88,0.01,M.top);
      [[z0+0.018,-0.009,0xd9c9ae,z0+0.0015,-0.0015],[0.009,z1-0.018,0xb89a7a,0.0015,z1+(flush?0.018:0)-0.0015]].forEach(function(q){ const zc=(q[0]+q[1])/2, zw=q[1]-q[0];   // doors overlay the carcass sides
        const G=new THREE.Group(); G.position.set(x1-0.01,0.12,0); P.group.add(G);                                    // hinge line at the bottom of the door
        const add=function(geo,mt,x,y,z){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; G.add(m); return m; };
        add(new THREE.BoxGeometry(0.02,0.7,q[4]-q[3]),M.cabF,0,0.35,(q[3]+q[4])/2); add(new THREE.BoxGeometry(0.012,0.012,0.12),M.steel,0.018,0.64,zc);
        const bw=zw-0.04, bd=D-0.1, bm=lam(q[2],{roughness:0.5}), bt=0.01, bx0=-bd/2-0.02;                             // open-topped bin lined with a clear bag, riding on the door
        add(new THREE.BoxGeometry(bd,0.01,bw),bm,bx0,0.02,zc); [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(bt,0.5,bw),bm,bx0+sd*(bd/2-bt/2),0.27,zc); add(new THREE.BoxGeometry(bd,0.5,bt),bm,bx0,0.27,zc+sd*(bw/2-bt/2)); });
        const bag=new THREE.MeshStandardMaterial({color:0xf2f4f5,roughness:0.25,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false});
        [-1,1].forEach(function(sd){ add(new THREE.BoxGeometry(0.003,0.08,bw+0.01),bag,bx0+sd*(bd/2+0.002),0.5,zc).renderOrder=2; add(new THREE.BoxGeometry(bd+0.01,0.08,0.003),bag,bx0,0.5,zc+sd*(bw/2+0.002)).renderOrder=2; });
        const st=stepper(0.5,function(t){ G.rotation.z=-0.42*ease(t); }); P.anims.push(function(t){ return st.run(t); });
        P.actions=(P.actions||[]).concat([{x:x1+0.4,z:zc,label:function(){ return st.target?'關上垃圾桶':(zc<0?'打開可燃垃圾桶':'打開資源垃圾桶'); },act:function(){ st.target=st.target?0:1; }}]); });
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
        if(opt.plug){ const pl=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.04,0.028),lam(0xf2f2f0,{roughness:0.4})); pl.position.set(pg[0]-0.015,pg[1],pg[2]); P.add(pl,oc); } }
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
      const CUB=[[-0.25,-0.02],[0.02,0.25]], CD=S1[0]-(-L)-0.005, endDr=[-0.275,0.275,-L,-L+CD-0.005];
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
        if(axis==='x') add(fg,oak,face-sd*0.009,fy,fc); else add(fg,oak,fc,fy,face-sd*0.009);
        const nt=axis==='x'?new THREE.BoxGeometry(0.004,0.011,0.1):new THREE.BoxGeometry(0.1,0.011,0.004); const ntm=add(nt,seamM,0,0,0); if(axis==='x') ntm.position.set(face+sd*0.0005,y1-0.0085,fc); else ntm.position.set(fc,y1-0.0085,face+sd*0.0005);
        const bd=depth-0.03, bw=fw-0.02, by=y0+0.012, bh=y1-y0-0.05, vc=face-sd*(0.018+bd/2);   // box behind the front
        bx(bw,0.01,bd,fc,by,vc); bx(bw,bh,0.01,fc,by+bh/2,face-sd*(0.018+bd)); [-1,1].forEach(function(s){ bx(0.01,bh,bd,fc+s*(bw/2-0.005),by+bh/2,vc); });
        if(fill) fill(function(w,h,d,u,y,v,mt){ const g=axis==='x'?new THREE.BoxGeometry(d,h,w):new THREE.BoxGeometry(w,h,d); const m=new THREE.Mesh(g,mt); if(axis==='x') m.position.set(v,y,u); else m.position.set(u,y,v); m.castShadow=true; G.add(m); },fc,by+0.005,face-sd*0.018,sd);
        const st=stepper(0.6,function(t){ const o=ease(t)*(depth-0.06); if(axis==='x') G.position.x=sd*o; else G.position.z=sd*o; }); P.anims.push(function(t){ return st.run(t); });
        drawers.push(st); return st; };
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
        add(new THREE.BoxGeometry(w+0.004,0.036,d+0.004),leather,0,t+0.018,-hs*d/2,LID);
        [-1,1].forEach(function(sd){ const cs=add(new THREE.CylinderGeometry(0.012,0.012,d+0.004,10),leather,sd*(w/2+0.002),t+0.03,-hs*d/2,LID); cs.rotation.x=Math.PI/2;
          const cf=add(new THREE.CylinderGeometry(0.012,0.012,w+0.004,10),leather,0,t+0.03,-hs*d/2+sd*(d/2+0.002),LID); cf.rotation.z=Math.PI/2; });
        P.group.add(G); G.userData.lid=LID; G.userData.hs=hs; return G; };
      /* bay doors on ±x, flush with the body, hinged at the outer (end) edge; the stool behind each door, and where it goes for dinner */
      const doors=[], stools=[];
      [[S1,-1],[S2,1]].forEach(function(q){ const sz=q[0], end=q[1], b=bayIn(sz), zc=(b[0]+b[1])/2, hz=end>0?b[1]:b[0], dw=b[1]-b[0]-0.003, dh=BT-BF-0.004;
        [1,-1].forEach(function(sd){ const D=new THREE.Group(); D.position.set(sd*W,0,hz); P.group.add(D); doors.push({g:D,sd:sd,end:end});
          const dg=new THREE.BoxGeometry(0.018,dh,dw); fitUV(dg,0.018,dh,dw); const dm=new THREE.Mesh(dg,oak); dm.position.set(-sd*0.009,(BF+BT)/2,zc-hz); dm.castShadow=dm.receiveShadow=true; D.add(dm);
          const nt=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.011,0.1),seamM); nt.position.set(sd*0.0005,BT-0.0135,zc-hz-end*0.08); D.add(nt);
          [0.13,0.34].forEach(function(y){ const hg=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.03,8),chrome); hg.position.set(sd*0.001,y,-end*0.004); D.add(hg); });   // hinge knuckles on the end edge
          const isB=sd>0, S=stool(0.24,0.24,0.31,-end), sx=sd*0.145;   // four identical 24 x 24 stools, one per half-bay (27.8 x 28 cm per side, 32 cm high)   // lids hinge on the table side, so they open away from whoever stands behind the stool
          S.position.set(sx,BF+0.002,zc); stools.push({g:S,home:[sx,zc],out:[sd*(W+(isB?0.17:0.2)),zc],way:[sd*(W+(isB?0.17:0.2)),end*0.78],end:[sd*0.15,end*0.78]}); }); });
      /* the grey top: two 2 cm leaves hinged on the +x edge, riding on two pairs of scissor arms that pivot in the well floor */
      const TOP=new THREE.Group(); P.group.add(TOP); TOP.position.set(0,HT,0);
      const tadd=function(geo,mt,x,y,z,par){ const m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; (par||TOP).add(m); return m; };
      const leafGeo=function(){ const s=new THREE.Shape(), r=0.025, w=W, d=L; s.moveTo(-w+r,-d); s.lineTo(w,-d); s.lineTo(w,d); s.lineTo(-w+r,d);   // rounded only on the outer edge; the fold edge is square s.quadraticCurveTo(-w,d,-w,d-r); s.lineTo(-w,-d+r); s.quadraticCurveTo(-w,-d,-w+r,-d);
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
      let mode=0, lids=0; const st={lift:0,panel:0,leaf:0,doors:0,stools:0,lids:0}, dur={lift:2.2,panel:1.2,leaf:2.0,doors:1.0,stools:3.4,lids:0.8};
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
        if(st.lift<0.98){ tg.panel=0; tg.leaf=0; tg.doors=0; tg.stools=0; } if(st.panel>0.02||st.leaf>0.02||st.doors>0.02) tg.lift=1;
        if(st.leaf<0.98) tg.doors=0; if(st.doors<0.98) tg.stools=0; if(st.stools>0.02){ tg.doors=1; tg.leaf=1; } if(st.stools<0.98) tg.lids=0; if(st.lids>0.02) tg.stools=1;
        Object.keys(st).forEach(function(k){ const v=st[k], g=tg[k]; if(v===g) return; st[k]=g>v?Math.min(g,v+dt/dur[k]):Math.max(g,v-dt/dur[k]); moving=true; });
        if(moving) apply(); return moving; });
      P.setMode=function(m){ mode=m; }; P.getMode=function(){ return mode; }; P.getState=function(){ return Object.assign({},st); };
      P.actions=[{x:0.6,z:-0.3,label:function(){ return mode===0?'茶几升成書桌':mode===1?'展開成餐桌（餐凳出來）':'收回成茶几'; },act:function(){ mode=(mode+1)%3; }},
        {x:0.6,z:0.25,label:function(){ return drawers[0].target?'推回側抽屜':'拉出側抽屜'; },act:function(){ drawers[0].target=drawers[0].target?0:1; }},
        {x:-0.35,z:-0.85,label:function(){ return drawers[1].target?'推回沙發側抽屜':'拉出沙發側抽屜'; },act:function(){ drawers[1].target=drawers[1].target?0:1; }},
        {x:0.2,z:-0.85,label:function(){ return drawers[2].target?'推回端面抽屜':'拉出端面抽屜'; },act:function(){ drawers[2].target=drawers[2].target?0:1; }},
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
    /* laundry pole hung from two ceiling hooks (h = ceiling height), len long along z at 1.85 m, with shirts on hangers and a towel over it */
    Catalog.laundryPole=function(h,len){
      const P=new Piece(), lam=env.lam, oc={cast:false}, L=len||1.2, py=1.85, steel=lam(0xd6dade,{metalness:0.85,roughness:0.25,envMapIntensity:1}), pole=lam(0xe8e8e4,{roughness:0.4});
      [-L/2+0.08,L/2-0.08].forEach(function(z){ P.cyl(0,z,0.02,0.02,h-0.02,h,steel,oc,14); P.cyl(0,z,0.004,0.004,py-0.01,h-0.02,steel,oc,8);
        const hk=new THREE.Mesh(new THREE.TorusGeometry(0.02,0.004,8,16,Math.PI),steel); hk.rotation.y=Math.PI/2; hk.rotation.z=Math.PI; hk.position.set(0,py+0.01,z); P.add(hk,oc); });
      const pm=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,L,12),pole); pm.rotation.x=Math.PI/2; pm.position.set(0,py-0.014,0); P.add(pm);
      const hanger=function(z,col){ const g=new THREE.Group(); g.position.set(0,py-0.03,z); P.group.add(g);
        const hook=new THREE.Mesh(new THREE.TorusGeometry(0.02,0.003,6,14,Math.PI*1.4),steel); hook.rotation.y=Math.PI/2; hook.position.y=0.005; g.add(hook);
        const arm=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.004,0.42),lam(0x8a6a4c,{roughness:0.6})); arm.position.y=-0.09; g.add(arm);
        const sh=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.62,0.44),env.fab(col)); sh.position.y=-0.42; sh.castShadow=true; g.add(sh);
        [-1,1].forEach(function(sd){ const sl=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.2,0.12),env.fab(col)); sl.position.set(0,-0.2,sd*0.27); sl.rotation.x=sd*0.25; g.add(sl); }); };
      hanger(-L/2+0.2,0xdde6ee); hanger(-L/2+0.36,0xf2ece2); hanger(-L/2+0.52,0x9fb4c6);
      const tw=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.5,0.32),env.fab(0xe9d9c8)); tw.position.set(0,py-0.26,L/2-0.3); tw.castShadow=true; P.add(tw);
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
      const loop=new THREE.Shape(); loop.absellipse(0,0,0.11,0.235,0,Math.PI*2,false); const hole=new THREE.Path(); hole.absellipse(0,0,0.07,0.195,0,Math.PI*2,true); loop.holes.push(hole);
      const lg=new THREE.ExtrudeGeometry(loop,{depth:0.08,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.01,bevelSegments:3,curveSegments:32}); lg.center(); const lm=new THREE.Mesh(lg,white); lm.rotation.y=Math.PI/2; lm.position.set(0,0.69,0); lm.castShadow=true; P.add(lm);
      [-1,1].forEach(function(sd){ P.box(-0.006,0.006,sd*0.085-0.004,sd*0.085+0.004,0.56,0.84,silver,oc); });                           // the slot trims inside the loop
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
      const W=0.6, D=(o.depth||1.05)/2, H=1.95, t=0.05, f=o.flip?-1:1;
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
        const zw=f*(W-t), zb=f*(W-t-0.5), hz=-f*(W-t), hz1=-f*(W-t-0.18);
        const bz0=Math.min(zw,zb), bz1=Math.max(zw,zb), bx0=-D+t, bx1=D-t-0.03;                                   // slatted bench: 7 cm abachi slats on two bearers, a slatted backrest, a low foot step
        for(let z=bz0+0.015;z<bz1-0.06;z+=0.085) P.box(bx0,bx1,z,z+0.07,0.46,0.49,dark);
        [bx0+0.05,bx1-0.05].forEach(function(x){ P.box(x-0.02,x+0.02,bz0,bz1,0.1,0.46,dark,oc); }); P.box(bx0,bx1,bz0+0.02,bz0+0.06,0.1,0.46,dark,oc);
        [0.62,0.72,0.82,0.92].forEach(function(y){ P.box(bx0,bx1,Math.min(zw,zw-f*0.03),Math.max(zw,zw-f*0.03),y,y+0.07,dark); });
        for(let x=bx0+0.3;x<bx1-0.2;x+=0.5) P.box(x-0.02,x+0.02,Math.min(zw,zw-f*0.03),Math.max(zw,zw-f*0.03),0.5,1.0,dark,oc);
        P.box(bx0,bx1,Math.min(hz,hz1)+(f>0?0:0.18),Math.max(hz,hz1)+(f>0?-0.18:0),0.2,0.23,dark);                     // foot step on the far side (slat)
        P.box(-D+t+0.04,-D+t+0.29,Math.min(hz,hz1),Math.max(hz,hz1),0.1,0.65,heaterM);
        for(let i=0;i<10;i++) stone(-D+t+0.09+(i%3)*0.07,hz-f*(-0.04-Math.floor(i/3)*0.05));
        [[-D+t+0.0,-D+t+0.34,hz1,hz1-f*0.03],[-D+t+0.31,-D+t+0.34,Math.min(hz,hz1),Math.max(hz,hz1)]].forEach(function(q){ P.box(Math.min(q[0],q[1]),Math.max(q[0],q[1]),Math.min(q[2],q[3]),Math.max(q[2],q[3]),0.72,0.75,dark,oc); });   // wooden guard rail round the heater
        [-D+t+0.33,-D+t+0.02].forEach(function(x){ P.box(x-0.012,x+0.012,Math.min(hz1,hz1-f*0.03),Math.max(hz1,hz1-f*0.03),0.1,0.72,dark,oc); });
        const bk=P.cyl(D-t-0.25,hz-f*0.12,0.1,0.085,0.1,0.26,lam(0x5a4a3a,{roughness:0.7}),{},18); P.cyl(D-t-0.25,hz-f*0.12,0.09,0.09,0.24,0.25,lam(0x7aa0c0,{roughness:0.2}),oc,18);   // bucket of water with a ladle
        const ld=P.cyl(D-t-0.25,hz-f*0.12,0.008,0.008,0.2,0.62,dark,oc,8); ld.rotation.z=0.5; ld.position.x+=0.1;
        P.cyl(0.1,0,0.055,0.055,1.45,1.47,lam(0xf4efe4,{roughness:0.5}),oc,24).rotation.x=Math.PI/2; P.group.children[P.group.children.length-1].position.set(0.1,1.5,-f*(W-t-0.006));   // thermometer on the back wall
        P.box(-D+t+0.1,-D+t+0.4,Math.min(zw,zw-f*0.08),Math.max(zw,zw-f*0.08),0.92,1.0,dark);
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
      {t:'bedside',name:'床頭櫃',cat:'臥室',front:'-z',make:function(){ return Catalog.bedsideTable(true); }},
      {t:'headboard',name:'棚付きヘッドボード',cat:'臥室',front:'+x',make:function(){ return Catalog.shelfHeadboard(); }},
      {t:'rugBed',name:'條紋地毯',cat:'臥室',front:'+x',make:function(){ return Catalog.stripedRug(2.16,2.55); }},
      {t:'desk',name:'書桌（含 3D 列印機）',cat:'書房',front:'+z',make:function(){ return Catalog.desk(); }},
      {t:'printerCart',name:'3D 列印機（附推車）',cat:'書房',front:'+z',make:function(){ return Catalog.printerCart(); }},
      {t:'officeChair',name:'辦公椅',cat:'書房',front:'-z',make:function(){ return Catalog.officeChair(); }},
      {t:'bookshelf',name:'書櫃',cat:'書房',front:'+x',make:function(){ return Catalog.bookshelf(); }},
      {t:'fridge',name:'冰箱（60 cm）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.fridge(); }},
      {t:'washer',name:'洗衣機',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.washer(); }},
      {t:'rugRound',name:'圓地毯（長毛）',cat:'客廳',front:'+x',make:function(){ return Catalog.roundRug(0.95,'plain',24,0.0,true); }},
      {t:'rugRoundSun',name:'花邊圓地毯',cat:'書房',front:'+x',make:function(){ return Catalog.roundRug(0.7,'sun',12,0.045); }},
      {t:'liftTable',name:'升降桌',cat:'客廳',front:'+x',make:function(){ return Catalog.liftTable(); }},
      {t:'liftDining',name:'升降折疊餐桌茶几（附 4 張餐凳）',cat:'客廳',front:'+x',make:function(){ return Catalog.liftDining(); }},
      {t:'fridge70',name:'冰箱（70 cm，可開門、有食物）',cat:'廚房與衛浴',front:'+z',make:function(){ return Catalog.fridge70(); }},
      {t:'fridgeL',name:'大型冰箱（70 × 70 × 183 cm，約 500 L）',cat:'廚房與衛浴',front:'+z',make:function(){ const p=Catalog.fridge70(); p.group.scale.set(1,1.83/1.75,0.7/0.65); p.cols.forEach(function(c){ c.z0*=0.7/0.65; c.z1*=0.7/0.65; }); return p; }},
      {t:'catTabby',name:'貓（虎斑）',cat:'貓咪',front:'+x',make:function(){ return Catalog.cat('tabby'); }},
      {t:'catGrey',name:'貓（灰）',cat:'貓咪',front:'+x',make:function(){ return Catalog.cat('grey'); }},
      {t:'catBed',wall:true,name:'貓耳吊床（壁掛，含貓）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catBed(1.6,'tabby'); }},
      {t:'catHouse',wall:true,name:'貓屋（壁掛）',cat:'貓咪',front:'+x',make:function(){ return Catalog.catHouse(0.95); }},
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
      {t:'litterRobot',name:'自動貓砂機',cat:'貓咪',front:'+x',make:function(){ return Catalog.litterRobot(); }},
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
      {t:'binCabinet',name:'垃圾桶櫃（前傾式・雙桶）',cat:'廚房與衛浴',front:'+x',make:function(){ return Catalog.binCabinet(); }},
      {t:'wallClock',name:'圓形掛鐘（玫瑰金框）',cat:'牆面',front:'+x',wall:true,make:function(){ return Catalog.wallClock(); }},
      {t:'catPerch',name:'貓窗台吊床',cat:'貓咪',front:'+x',wall:true,make:function(){ return Catalog.catWindowPerch(0.9); }},
      {t:'liftDesk',name:'電動升降桌',cat:'書房',front:'+z',make:function(){ return Catalog.liftDesk(); }},
      {t:'duoDesk',name:'雙人升降桌（含 2 椅）',cat:'書房',front:'+z',make:function(){ return Catalog.duoDesk(); }},
      {t:'babyCrib',name:'嬰兒床',cat:'臥室',front:'+x',make:function(){ return Catalog.babyCrib(); }},
      {t:'smallShelf',name:'矮書櫃',cat:'臥室',front:'+x',make:function(){ return Catalog.smallBookshelf(); }},
      {t:'fan',name:'電風扇',cat:'家電',front:'+x',make:function(){ return Catalog.fan(); }},
      {t:'dehumidifier',name:'除濕／加濕機',cat:'家電',front:'+x',make:function(){ return Catalog.dehumidifier(); }},
      {t:'robotVacuum',name:'掃地機器人（含基地）',cat:'家電',front:'+x',make:function(){ return Catalog.robotVacuum(); }},
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
      {t:'outdoorSet',name:'戶外桌椅',cat:'戶外',front:'+x',make:function(){ return Catalog.outdoorSet(); }},
      {t:'shoeCabinet',name:'鞋櫃',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoeCabinet(); }},
      {t:'shoesW',name:'白色球鞋',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('sneaker',0xe8e6e0,0xf1efe9); }},
      {t:'shoesHer',name:'白色球鞋（女）',cat:'收納與其他',front:'+x',make:function(){ const P=Catalog.shoePair('sneaker',0xf7f5f0,0xffffff); P.group.scale.setScalar(0.92); return P; }},
      {t:'shoesHim',name:'黑色球鞋（男）',cat:'收納與其他',front:'+x',make:function(){ return Catalog.shoePair('sneaker',0x232428,0x2c2d31); }},
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
