/* A2 switch plates and outlets, in the style of ideal_c: a switch plate 120 cm above the floor on the latch side of every door (inside the room), and one outlet 25 cm above the floor
   a little further along the same wall. Plan frame: e = east, n = north (cm); engine x = n / 100, z = e / 100. */
export function plates(THREE,E,C){
  const {LG,bx,lam,base}=E, plateM=lam(0xf4f3ef,{roughness:0.35}), rockerM=lam(0xe6e4de,{roughness:0.4}), holeM=lam(0x3b3d40,{roughness:0.6}), oc={cast:false};
  const PW=0.07, PH=0.115, PT=0.008;
  const inside=function(L,e,n){ return L.rooms.some(function(r){ return r.rects.some(function(q){ return e>=q[0]&&e<=q[2]&&n>=q[1]&&n<=q[3]; }); }); };
  /* a plate of width PW on the wall face: (alongC) position on the wall line in cm, side s = +1/-1 toward +n (ew walls) or +e (ns walls) */
  const put=function(l,w,alongCm,s,yc,kind){
    const ew=w.axis==='ew', c=(ew?w.a[1]:w.a[0])/100, face=c+s*w.t/200, along=alongCm/100, g=LG[l], y0=base(l)+yc-PH/2, y1=base(l)+yc+PH/2;
    const box=function(a0,a1,u0,u1,v0,v1,mat){ if(ew) bx(g,a0,a1,u0,u1,v0,v1,mat,oc); else bx(g,u0,u1,a0,a1,v0,v1,mat,oc); };   // a: across the wall, u: along it, v: up
    const p0=s>0?face:face-PT, p1=s>0?face+PT:face;
    box(p0,p1,along-PW/2,along+PW/2,y0,y1,plateM);
    const q0=s>0?p1:p0-0.002, q1=s>0?p1+0.002:p0;   // the raised parts sit on the outer face of the plate
    if(kind==='switch'){ [-0.016,0.016].forEach(function(du){ box(q0,q1,along+du-0.011,along+du+0.011,y0+0.028,y1-0.028,rockerM); }); }
    else { [base(l)+yc-0.025,base(l)+yc+0.025].forEach(function(vc){ box(q0,q1,along-0.014,along+0.014,vc-0.012,vc+0.012,holeM); }); }
  };
  C.levels.forEach(function(L,l){
    L.walls.forEach(function(w){
      if(w.treat) return;
      const ew=w.axis==='ew', c=ew?w.a[1]:w.a[0], a0=Math.min(ew?w.a[0]:w.a[1],ew?w.b[0]:w.b[1]), a1=Math.max(ew?w.a[0]:w.a[1],ew?w.b[0]:w.b[1]);
      w.openings.forEach(function(o){
        if(o.kind!=='door'&&o.kind!=='slide') return;
        const dir=o.openDir?(ew?o.openDir[1]:o.openDir[0]):1; if(!dir) return;
        const probe=function(s){ const d=w.t/2+25; return ew?inside(L,(o.from+o.to)/2,c+s*d):inside(L,c+s*d,(o.from+o.to)/2); };
        let s=dir>0?1:-1; if(!probe(s)) s=-s; if(!probe(s)) return;
        const latchHi=o.kind==='door'?(Math.abs(o.hinge[ew?0:1]-o.from)<1):true, pos=latchHi?o.to+13:o.from-13;   // the latch is at the end away from the hinge
        const others=w.openings.filter(function(q){ return q!==o; });
        if(pos-PW*50<a0+12||pos+PW*50>a1-12||others.some(function(q){ return pos+PW*50+3>q.from&&pos-PW*50-3<q.to; })) return;
        put(l,w,pos,s,1.2,'switch');
        const op=pos+(latchHi?1:-1)*45; if(!(op-PW*50<a0+12||op+PW*50>a1-12||others.some(function(q){ return op+PW*50+3>q.from&&op-PW*50-3<q.to; }))) put(l,w,op,s,0.25,'outlet');
      });
    });
  });
}
