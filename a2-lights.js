/* A2 ceiling lights: fixtures sit on the real (sloped) ceiling of their room and are tilted to it; the double-height living area gets a long pendant.
   Plan frame: engine x = n / 100, engine z = e / 100; C.ceilY(n cm) = ceiling height above the 1F floor. */
export function ceilingLights(THREE,E,C){
  const {Catalog,LG,CH,PLI,pointLights,lightFixtures,M,lampMat}=E, SLOPE=Math.atan(0.13);
  const place=function(l,n,e,build,col,int,dist){
    const yc=l===0?CH:C.ceilY(n), g=new THREE.Group(); g.position.set(n/100,yc,e/100);
    if(l===1) g.rotation.z=SLOPE;
    build(g); LG[l].add(g); lightFixtures.push(g);
    const p=new THREE.PointLight(col||0xffe2b8,int*PLI,dist,2); p.position.set(0,-0.25,0); g.add(p); pointLights.push(p); return g;
  };
  const round=function(l,n,e,int,dist){ place(l,n,e,function(g){ const L=Catalog.ceilingLight(0); g.add(L.group); },0xffe2b8,int,dist); };
  const down=function(l,n,e,int,dist){ place(l,n,e,function(g){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.006,8,24),M.trim); ring.rotation.x=Math.PI/2; ring.position.y=-0.004; g.add(ring);
    const dm=new THREE.Mesh(new THREE.SphereGeometry(0.055,20,8,0,Math.PI*2,Math.PI/2,Math.PI/2),lampMat); dm.scale.y=0.35; dm.position.y=-0.004; g.add(dm); },0xffe2b8,int,dist); };
  const pendant=function(n,e,drop){
    const yc=C.ceilY(n), g=new THREE.Group(); g.position.set(n/100,yc,e/100); g.rotation.z=SLOPE; g.userData.a2Pendant=true; LG[0].add(g); lightFixtures.push(g);
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,drop,6),M.dark); rod.position.y=-drop/2; g.add(rod);
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.2,0.24,24,1,true),M.shade); sh.position.y=-drop-0.05; g.add(sh);
    const d=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.01,20),lampMat); d.position.y=-drop-0.16; g.add(d);
    const p=new THREE.PointLight(0xffe2b8,0.5*PLI,7,2); p.position.set(0,-drop-0.2,0); g.add(p); pointLights.push(p); };
  /* 1F */
  round(0,490,545,0.5,6);                    // kitchen aisle
  round(0,420,740,0.4,6);                    // walkway south of the living area
  round(0,470,960,0.45,6);                   // over the long desk
  pendant(700,970,3.95);                     // over the lift table, shade at 2.25 m under the 6 m ceiling
  round(0,775,694,0.55,6); round(0,775,514,0.55,6); round(0,176,966,0.55,9); round(0,176,725,0.55,6);
  round(0,126,630,0.55,6); round(0,252,652,0.55,6);   // stair foot: the middle of the room is the stairwell opening
  /* 2F: one fixture per room rect (the main rect only for rooms and wet rooms), placed at the rect centre on the real sloped ceiling; long corridors get one per ~2.8 m */
  const SKIP={'挑高（下方客廳）':1,'排水管PS':1}, WET={'洗面脫衣室':1,'廁所':1,'浴室 1624':1,'三溫暖':1};
  (C.rooms||[]).forEach(function(r){
    if(SKIP[r.name]) return;
    const area=function(q){ return (q[2]-q[0])*(q[3]-q[1])/1e4; };
    const rects=r.kind==='store'?r.rects.filter(function(q){ return area(q)>=0.9; }):[r.rects.slice().sort(function(a,b){ return area(b)-area(a); })[0]];
    rects.forEach(function(q){
      const w=q[2]-q[0], d=q[3]-q[1], big=area(q)>=5, ew=w>=d, len=ew?w:d, k=r.kind==='store'&&len>=500?Math.round(len/280):1;
      for(let i=0;i<k;i++){ const t=(i+0.5)/k, e=q[0]+w*(ew?t:0.5), n=q[1]+d*(ew?0.5:t);
        if(WET[r.name]) down(1,n,e,big?0.4:0.35,5); else round(1,n,e,big?0.55:0.4,big?9:6); } });
  });
}
