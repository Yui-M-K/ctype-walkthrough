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
    const yc=C.ceilY(n), g=new THREE.Group(); g.position.set(n/100,yc,e/100); g.rotation.z=SLOPE; LG[0].add(g); lightFixtures.push(g);
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
  /* 2F (小孩房 and 書房 are left to the plan rework) */
  round(1,575,170,0.55,9);                   // main bedroom
  round(1,349,420,0.55,9); round(1,349,690,0.55,9); round(1,252,322,0.4,6); round(1,252,792,0.4,6);   // corridor
  round(1,252,684,0.4,6); round(1,126,706,0.55,6);   // 納戶
  round(1,725,351,0.55,9);                   // dressing room
  round(1,498,464,0.55,6);                   // laundry
  down(1,498,664,0.4,5); down(1,498,792,0.3,4);   // wash room, toilet
  down(1,725,582,0.4,5); down(1,725,752,0.4,5);   // bath, sauna
}
