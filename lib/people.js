/* Shared people: standing and seated figures built from simple primitives. No knowledge of any house or scene.
   Local frame of a figure: +x = facing direction, +y = up, +z = the figure's right. Heights are in metres. */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  Walk.People=function(THREE,lam,fab){
    const TAU=Math.PI*2;
    const HB=(function(){
      const up=new THREE.Vector3(0,1,0);
      const mk=function(G,geo,mat,x,y,z){ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; G.add(m); return m; };
      const limb=function(G,a,b,r0,r1,mat){ const d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]), len=d.length();
        const m=mk(G,new THREE.CylinderGeometry(r1,r0,len,14),mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2); m.quaternion.setFromUnitVectors(up,d.normalize()); return m; };
      const ell=function(G,mat,x,y,z,rx,ry,rz){ const m=mk(G,new THREE.SphereGeometry(1,22,16),mat,x,y,z); m.scale.set(rx,ry,rz); return m; };
      const mix=function(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; };
      const mats=function(o){ return {sk:lam(o.skin,{roughness:0.75}), top:fab(o.top), bot:fab(o.bot), hr:lam(o.hair,{roughness:0.8,side:THREE.DoubleSide}),
        shoe:lam(0x2f3236,{roughness:0.6}), sole:lam(0xf2f0ea,{roughness:0.8}), eye:lam(0x1d1a18,{roughness:0.25}), hi:new THREE.MeshBasicMaterial({color:0xffffff}),
        lip:lam(o.female?0xd0646c:0xa8665c,{roughness:0.5}), blush:new THREE.MeshBasicMaterial({color:0xf29a98,transparent:true,opacity:o.female?0.5:0.25,depthWrite:false}),
        collar:fab(o.female?0xd8d4cc:0x56657a)}; };
      const head=function(G,u,c,M,female){
        const R=0.062*u;
        ell(G,M.sk,c[0],c[1],c[2],R,R*1.1,R*0.95);
        ell(G,M.sk,c[0]+0.06*u,c[1]-0.01*u,c[2],0.006*u,0.009*u,0.006*u);                                  // nose
        mk(G,new THREE.BoxGeometry(0.004*u,0.0045*u,female?0.017*u:0.02*u),M.lip,c[0]+0.055*u,c[1]-0.032*u,c[2]);
        [-1,1].forEach(function(sd){
          ell(G,M.sk,c[0]-0.004*u,c[1]-0.004*u,c[2]+sd*0.058*u,0.008*u,0.015*u,0.007*u);                        // ears
          const ex=c[0]+0.054*u, ey=c[1]+0.006*u, ez=c[2]+sd*0.024*u;
          ell(G,M.eye,ex,ey,ez,0.004*u,female?0.0115*u:0.0095*u,female?0.009*u:0.0085*u);
          ell(G,M.hi,ex+0.0035*u,ey+0.003*u,ez-sd*0.002*u,0.0012*u,0.0028*u,0.0028*u);
          mk(G,new THREE.BoxGeometry(0.004*u,female?0.0032*u:0.0045*u,0.021*u),M.hr,c[0]+0.053*u,c[1]+(female?0.031:0.03)*u,c[2]+sd*0.025*u).rotation.x=-sd*(female?0.08:0.04);
          ell(G,M.blush,c[0]+0.047*u,c[1]-0.014*u,c[2]+sd*0.037*u,0.004*u,0.008*u,0.012*u);
        });
      };
      const hair=function(G,u,c,M,female){
        const R=0.067*u, cx=c[0]-0.004*u, cy=c[1]+0.006*u, ph=female?0:0.4;
        mk(G,new THREE.SphereGeometry(R,30,16,0,TAU,0,female?1.0:0.95),M.hr,cx,cy,c[2]).scale.set(1,1.06,0.98);
        mk(G,new THREE.SphereGeometry(R,30,18,-Math.PI/2+ph,Math.PI-2*ph,0,female?2.2:2.0),M.hr,cx,cy,c[2]).scale.set(1,1.06,0.98);
        if(female){
          mk(G,new THREE.SphereGeometry(R*1.02,24,10,Math.PI-0.95,1.9,0.25,0.78),M.hr,cx,cy,c[2]).scale.set(1,1.06,0.98);       // bangs
          mk(G,new THREE.CylinderGeometry(0.058*u,0.078*u,0.34*u,30,4,true,Math.PI-0.4,Math.PI+0.8),M.hr,cx-0.012*u,c[1]-0.17*u,c[2]);   // long hair down to mid-back, framing the face
        } else {
          mk(G,new THREE.SphereGeometry(R*1.03,20,8,Math.PI-0.7,1.4,0.15,0.55),M.hr,cx,cy,c[2]).scale.set(1,1.06,0.98);      // short fringe
        }
      };
      const torso=function(G,u,x,y0,M,female,tilt){
        const P=female?[[0.001,0],[0.112,0],[0.122,0.03],[0.112,0.13],[0.13,0.21],[0.136,0.27],[0.112,0.31],[0.05,0.33],[0.001,0.335]]
                      :[[0.001,0],[0.118,0],[0.128,0.03],[0.13,0.13],[0.145,0.22],[0.152,0.28],[0.122,0.318],[0.055,0.335],[0.001,0.34]];
        const T=new THREE.Group(); T.position.set(x,y0,0); T.rotation.z=tilt||0; G.add(T);
        mk(T,new THREE.LatheGeometry(P.map(function(q){ return new THREE.Vector2(q[0]*u,q[1]*u); }),30),M.top,0,0,0).scale.set(0.52,1,0.9);
        const col=mk(T,new THREE.TorusGeometry(0.046*u,0.007*u,8,26),M.collar,0,0.328*u,0); col.rotation.x=Math.PI/2; col.scale.x=0.62;
        return T;
      };
      const leg=function(G,u,Hp,K,A,M){ limb(G,Hp,K,0.047*u,0.038*u,M.bot); ell(G,M.bot,K[0],K[1],K[2],0.038*u,0.038*u,0.038*u); limb(G,K,A,0.036*u,0.027*u,M.bot); };
      const shoe=function(G,u,at,M){ ell(G,M.shoe,at[0],at[1]+0.026*u,at[2],0.078*u,0.026*u,0.036*u); ell(G,M.sole,at[0],at[1]+0.009*u,at[2],0.08*u,0.01*u,0.037*u); };
      const arm=function(G,u,S,E,Hd,M){
        ell(G,M.top,S[0],S[1]-0.004*u,S[2]-Math.sign(S[2])*0.006*u,0.027*u,0.026*u,0.027*u);
        limb(G,S,E,0.021*u,0.018*u,M.sk); limb(G,S,mix(S,E,0.45),0.026*u,0.024*u,M.top);
        ell(G,M.sk,E[0],E[1],E[2],0.018*u,0.018*u,0.018*u); limb(G,E,Hd,0.017*u,0.014*u,M.sk);
        const d=new THREE.Vector3(Hd[0]-E[0],Hd[1]-E[1],Hd[2]-E[2]).normalize();
        const h=ell(G,M.sk,Hd[0]+d.x*0.016*u,Hd[1]+d.y*0.016*u,Hd[2]+d.z*0.016*u,0.019*u,0.034*u,0.013*u); h.quaternion.setFromUnitVectors(up,d);
      };
      return {mk:mk,limb:limb,ell:ell,mats:mats,head:head,hair:hair,torso:torso,leg:leg,shoe:shoe,arm:arm};
    })();

    const stand=function(u,skin,topC,botC,hairC,longHair,jcA,jcB,arms){
        const G=new THREE.Group(), M=HB.mats({skin:skin,top:topC,bot:botC,hair:hairC,female:longHair});
        HB.ell(G,M.bot,-0.004*u,0.535*u,0,0.064*u,0.07*u,longHair?0.105*u:0.106*u);
        [-1,1].forEach(function(sd){ HB.leg(G,u,[0,0.5*u,sd*0.062*u],[0.012*u,0.275*u,sd*0.06*u],[0,0.05*u,sd*0.056*u],M); HB.shoe(G,u,[0.03*u,0,sd*0.056*u],M); });
        HB.torso(G,u,0,0.53*u,M,longHair,0);
        HB.limb(G,[0,0.84*u,0],[0.004*u,0.89*u,0],0.022*u,0.021*u,M.sk);
        HB.head(G,u,[0.005*u,0.92*u,0],M,longHair); HB.hair(G,u,[0.005*u,0.92*u,0],M,longHair);
        [-1,1].forEach(function(sd){
          const S=[0,0.83*u,sd*0.138*u], E=arms?arms.e(sd,u):[0.06*u,0.68*u,sd*0.17*u], Hd=arms?arms.h(sd,u):[0.17*u,0.75*u,sd*0.12*u];   // default: boxing-style guard holding Joy-Cons
          HB.arm(G,u,S,E,Hd,M);
          if(jcA===undefined) return;
          const jc=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.1,0.016),lam(sd<0?jcA:jcB,{roughness:0.5})); jc.position.set(Hd[0]+0.012,Hd[1],Hd[2]); jc.castShadow=true; G.add(jc); (G.userData.jcs=G.userData.jcs||[]).push(jc);
        });
        return G;
      };

    const sit=(function(){
      /* origin = seat surface under the hips, facing +x; seatH = seat height above the floor */
      return function(u,seatH,skin,topC,botC,hairC,longHair,arms){
        const G=new THREE.Group(), M=HB.mats({skin:skin,top:topC,bot:botC,hair:hairC,female:longHair});
        HB.ell(G,M.bot,0.0,0.06*u,0,0.085*u,0.06*u,longHair?0.105*u:0.106*u);
        HB.torso(G,u,-0.01*u,0.1*u,M,longHair,0.06);
        HB.limb(G,[-0.02*u,0.42*u,0],[0,0.47*u,0],0.022*u,0.021*u,M.sk);
        HB.head(G,u,[0.01*u,0.51*u,0],M,longHair); HB.hair(G,u,[0.01*u,0.51*u,0],M,longHair);
        [-1,1].forEach(function(sd){
          const K=[0.25*u,0.06*u,sd*0.065*u], F=[0.27*u,-seatH+0.05*u,sd*0.07*u];
          HB.leg(G,u,[0.02*u,0.05*u,sd*0.06*u],K,F,M); HB.shoe(G,u,[F[0]+0.03*u,-seatH,F[2]],M);
          if(arms.skip&&arms.skip(sd)) return;
          HB.arm(G,u,[-0.01*u,0.4*u,sd*0.138*u],arms.e(sd,u),arms.h(sd,u),M);
        });
        return G;
      };
    })();

    const typing={e:function(sd,u){return [0.08*u,0.2*u,sd*0.17*u];}, h:function(sd,u){return [0.25*u,0.23*u,sd*0.1*u];}};
    const lapArms={e:function(sd,u){return [0.06*u,0.22*u,sd*0.17*u];}, h:function(sd,u){return [0.2*u,0.12*u,sd*0.05*u];}};


    /* two people asleep on their backs in a 160 x 195 cm bed, heads on the pillows turned a little toward each other, under a duvet that follows
       their bodies and drapes over the sides and the foot. Bed-local frame (origin = bed centre on the floor, head end on -z). opts.duvet / opts.cuff = materials */
    const sleepers=function(opts){
      opts=opts||{};
      const G=new THREE.Group(), mattress=0.48, X0=0.36;
      const people=[[-X0,1.63,0xf1c9a5,0xf4f1ec,0x7f8fa8,0x3a2a22,true,0.3],[X0,1.69,0xe2b890,0x3c4a5c,0x2f3a4a,0x1f1a16,false,-0.3]];
      const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(-1,0,0));   // standing frame (+x front, +y up) -> lying on the back, head toward -z
      people.forEach(function(q){
        const u=q[1], feetZ=-0.72+0.98*u, pivot=new THREE.Group(); pivot.position.set(q[0],mattress+0.08,feetZ); pivot.rotation.x=0.093;   // the pillow lifts the head a little
        const orient=new THREE.Group(); orient.quaternion.setFromRotationMatrix(basis); pivot.add(orient);
        const P=stand(u,q[2],q[3],q[4],q[5],q[6]); orient.add(P);
        P.children.forEach(function(m){ if(m.position.y<0.845*u) m.visible=false; });   // only the head and hair show above the duvet; the duvet shape stands in for the body
        const tilt=new THREE.Group(); P.parent.add(tilt); tilt.add(P); tilt.position.set(0,0.92*u,0); P.position.set(0,-0.92*u,0); tilt.rotation.y=q[7];   // head turned a little toward the partner
        G.add(pivot);
      });
      /* duvet: a grid over the bed, raised over each body (more over the torso than the legs), with drapes on both sides and over the foot */
      const top=-0.5, foot=0.99, N=48, Mz=40, pos=[], idx=[];
      const height=function(x,z){
        const t=Math.max(0,Math.min(1,(z-top)/(foot-top))), taper=t<0.45?1:t<0.85?0.62:0.45;
        let h=0.62+0.05*(1-t);
        [-X0,X0].forEach(function(bx){ h+=0.15*taper*Math.exp(-Math.pow((x-bx)/(t<0.45?0.21:0.17),2)); });
        if(t>0.88) h+=0.04*Math.exp(-Math.pow((Math.abs(x)-X0)/0.12,2));             // toes tent the duvet
        return h;
      };
      for(let j=0;j<=Mz;j++){
        const v=j/Mz*1.12;
        for(let i=0;i<=N;i++){
          const uu=(i/N*2-1)*1.18, au=Math.abs(uu), sgn=uu<0?-1:1;
          let x=au<=1?uu*0.83:sgn*(0.83+0.015*Math.min(1,(au-1)/0.03)), z=v<=1?top+v*(foot-top):foot+0.015, y=height(Math.max(-0.83,Math.min(0.83,x)),Math.min(z,foot));
          if(au>1) y-=(au-1)/0.18*0.3;
          if(v>1){ const d=(v-1)/0.12; y-=d*0.3; z=foot+0.015*Math.min(1,d*4); }
          pos.push(x,y,z);
        }
      }
      for(let j=0;j<Mz;j++) for(let i=0;i<N;i++){ const a=j*(N+1)+i, b=a+1, c=a+N+1, d=c+1; idx.push(a,c,b,b,c,d); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
      const duvet=new THREE.Mesh(g,opts.duvet||fab(0xb8c4d2,{side:THREE.DoubleSide})); duvet.castShadow=duvet.receiveShadow=true; G.add(duvet);
      const cuffM=opts.cuff||fab(0xf4f2ee,{side:THREE.DoubleSide});                     // turned-down sheet along the top edge
      const cg=new THREE.BufferGeometry(), cp=[], ci=[], CN=40;
      for(let k=0;k<=1;k++) for(let i=0;i<=CN;i++){ const x=(i/CN*2-1)*0.83, z=top+k*0.13; cp.push(x,height(x,z)+0.012,z); }
      for(let i=0;i<CN;i++){ const a=i, b=i+1, c=i+CN+1, d=c+1; ci.push(a,c,b,b,c,d); }
      cg.setAttribute('position',new THREE.Float32BufferAttribute(cp,3)); cg.setIndex(ci); cg.computeVertexNormals();
      const cuff=new THREE.Mesh(cg,cuffM); cuff.receiveShadow=true; G.add(cuff);
      return G;
    };

    return {parts:HB,stand:stand,sit:sit,sleepers:sleepers,poses:{typing:typing,lapArms:lapArms}};
  };
})(window);
