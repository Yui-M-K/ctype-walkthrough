/* A2 coplanar faces: where two boxes of different materials share a face plane (wall joints, a backing board on a wall face, a floor finish on its slab) the overlap
   flickers. The face of the thicker box is moved to 0.8 mm behind the other face, so the thin finish layer always wins. Runs once before the engine merges its
   static meshes; a few passes settle chains of three or more boxes. */
const TOL=0.0007, GAP=0.0008, FACES=[[0,1],[2,3],[4,5]];   // BoxGeometry face order: +x -x +y -y +z -z, four vertices each

function collect(THREE,root){
  const lists=new Map();
  root.updateMatrixWorld(true);
  root.traverse(function(o){
    if(!o.isMesh||!o.geometry||o.geometry.type!=='BoxGeometry') return;
    const e=o.matrixWorld.elements;
    if(Math.abs(e[1])+Math.abs(e[2])+Math.abs(e[4])+Math.abs(e[6])+Math.abs(e[8])+Math.abs(e[9])>1e-4||e[0]<=0||e[5]<=0||e[10]<=0) return;
    const P=o.geometry.attributes.position, sc=[e[0],e[5],e[10]], c=[e[12],e[13],e[14]], t=o.geometry.parameters, th=[t.width*sc[0],t.height*sc[1],t.depth*sc[2]];
    for(let a=0;a<3;a++) for(let d=0;d<2;d++){
      const fi=FACES[a][d?0:1], m=Array.isArray(o.material)?o.material[fi]:o.material; if(!m||m.transparent||m.side===THREE.DoubleSide||m.colorWrite===false) continue;
      const f0=fi*4, u=(a+1)%3, v=(a+2)%3, get=[P.getX,P.getY,P.getZ];
      const lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
      for(let k=f0;k<f0+4;k++) for(let q=0;q<3;q++){ const w=get[q].call(P,k)*sc[q]+c[q]; if(w<lo[q]) lo[q]=w; if(w>hi[q]) hi[q]=w; }
      const f={o:o,m:m,a:a,d:d,face:f0,sc:sc[a],pos:(lo[a]+hi[a])/2,u0:lo[u],u1:hi[u],v0:lo[v],v1:hi[v],thick:th[a],area:(hi[u]-lo[u])*(hi[v]-lo[v])}, key=a+'|'+d;
      (lists.get(key)||lists.set(key,[]).get(key)).push(f);
    }
  });
  return lists;
}

export function separate(THREE,root){
  let moved=0;
  for(let pass=0;pass<4;pass++){
    let changed=0; const done=new Set();
    collect(THREE,root).forEach(function(L){
      L.sort(function(p,q){ return p.pos-q.pos; });
      for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length&&L[j].pos-L[i].pos<=TOL;j++){
        const A=L[i], B=L[j]; if(A.o===B.o||A.m===B.m) continue;
        if(Math.min(A.u1,B.u1)-Math.max(A.u0,B.u0)<0.01||Math.min(A.v1,B.v1)-Math.max(A.v0,B.v0)<0.01) continue;
        const lose=A.thick>B.thick+1e-6?A:B.thick>A.thick+1e-6?B:(A.area<B.area?A:B), win=lose===A?B:A, tag=lose.o.uuid+'|'+lose.a+'|'+lose.d;
        if(done.has(tag)) continue; done.add(tag);
        if(!lose.o.userData.a2zfix){ lose.o.geometry=lose.o.geometry.clone(); lose.o.userData.a2zfix=true; }
        const P=lose.o.geometry.attributes.position, set=[P.setX,P.setY,P.setZ][lose.a], get=[P.getX,P.getY,P.getZ][lose.a], dz=(win.pos+(lose.d?-1:1)*GAP-lose.pos)/lose.sc;
        for(let k=lose.face;k<lose.face+4;k++) set.call(P,k,get.call(P,k)+dz);
        P.needsUpdate=true; changed++;
      }
    });
    moved+=changed; if(!changed) break;
  }
  return moved;
}

/* The engine hangs a swing leaf on the outer face of its 4.5 cm hinge jamb, so past about 30% the leaf end still grazes the jamb, and the leaf top sits 2 cm
   above the underside of the head frame. Halves the width of each hinge jamb (the 2.2 cm that stays is hidden behind the leaf and the wall) and lowers
   the leaf top by 0.8 cm, so the leaf swings clear of its frame. Door gaps stay as they were. */
export function clearHeadFrame(THREE,E){
  const box=new THREE.Box3(), c=new THREE.Vector3(), s=new THREE.Vector3();
  E.doors.forEach(function(d){
    if(!d.pv||d.slide||d.fold||d.th===undefined) return;
    const leaf=d.pv.children[0], lm=leaf&&leaf.children[0], p=lm&&lm.geometry&&lm.geometry.parameters;
    if(!p||lm.position.y!==0||lm.userData.headClear) return;
    lm.scale.y=(p.height-0.008)/p.height; lm.position.y=-0.004; lm.userData.headClear=true;
    const alongX=p.width>p.depth, ax=alongX?'x':'z', cr=alongX?'z':'x', hp=d.pv.position[ax], dir=Math.sign(lm.position[ax]);
    E.LG[d.l].updateMatrixWorld(true);
    E.LG[d.l].traverse(function(o){
      if(!o.isMesh||!o.geometry||o.geometry.type!=='BoxGeometry'||o.userData.headClear) return;
      box.setFromObject(o); box.getCenter(c); box.getSize(s);
      if(Math.abs(s[ax]-0.045)>0.004||s.y<1.5||Math.abs(s[cr]-0.12)>0.004||Math.abs(c[ax]-(hp+dir*0.0225))>0.004||Math.abs(c[cr]-d.pv.position[cr])>0.06) return;
      o.scale[ax]*=0.5; o.position[ax]-=dir*0.01125; o.userData.headClear=true;
    });
  });
}
