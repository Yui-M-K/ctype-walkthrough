/* Downloaded GLB models for A2 (credits in README): the Tesla in the garage and a sleeping cat on the entry bench. ?car=old / ?cat=0 switch them off. */
export function init(THREE,E){
  if(E.glb) return;
  E.glb=function(f){ const c=E.__glbs||(E.__glbs={}); return c[f]||(c[f]=import('three/addons/loaders/GLTFLoader.js').then(function(M){ return new M.GLTFLoader().loadAsync('assets/models/'+f); }).then(function(g){ return g.scene; })); };
  E.glbPlace=function(par,sc,o){ const g=sc.clone(true); g.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(g), sz=bb.getSize(new THREE.Vector3()), k=o.w?o.w/Math.max(sz.x,sz.z):(o.h?o.h/sz.y:1), W=new THREE.Group();
    g.scale.setScalar(k); g.position.set(-(bb.min.x+bb.max.x)/2*k,-bb.min.y*k,-(bb.min.z+bb.max.z)/2*k); W.add(g); W.position.set(o.x||0,o.y||0,o.z||0); W.rotation.y=o.ry||0; W.userData.keep=true; g.traverse(function(m){ if(m.isMesh){ m.castShadow=true; m.receiveShadow=true; } }); par.add(W); if(E.renderer) E.renderer.shadowMap.needsUpdate=true; return W; };
}
export function car(THREE,E){
  const P=E.Catalog.car(); init(THREE,E);
  if(/[?&]car=old\b/.test(location.search)) return P;
  let swapped=false; (P.actions||[]).forEach(function(a){ const o=a.on; a.on=function(){ return !swapped&&(o?o():true); }; });   // the GLB body is solid: no doors, hood or boot to work
  E.glb('cars/tesla_model3_darkgray.glb').then(function(sc){ const g=sc.clone(true); g.traverse(function(o){ if(!o.isMesh) return; o.castShadow=!(o.material&&o.material.transparent); o.receiveShadow=true;
      const m=o.material; if(m&&!m.userData.tuned){ m.userData.tuned=true; if(m.name==='CAR_PAINT'){ m.metalness=0.7; m.roughness=0.32; m.envMapIntensity=0.55; } else if(m.transparent){ m.depthWrite=false; } m.needsUpdate=true; } });
    g.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(g); g.position.y=-bb.min.y; P.group.children.slice().forEach(function(c){ c.visible=false; }); P.group.add(g); swapped=true; if(E.renderer) E.renderer.shadowMap.needsUpdate=true; }).catch(function(e){ console.warn('tesla_model3_darkgray.glb',e); });
  return P;
}
/* sleeping cat (unlit file with a slightly larger outline shell): lit materials, shell front-faced only; o: {l,x,y,z,w,ry} */
export function cat(THREE,E,o){
  if(/[?&]cat=0\b/.test(location.search)) return; init(THREE,E);
  E.glb('cats/sleeping_cats.glb').then(function(sc){ sc.traverse(function(m){ const t=m.isMesh&&m.material; if(!t||t.userData.lit) return; const n=new THREE.MeshStandardMaterial({map:t.map||null,color:t.color,roughness:0.9,metalness:0,side:t.map?THREE.DoubleSide:THREE.FrontSide}); n.userData.lit=true; m.material=n; });
    const G=new THREE.Group(); G.userData.keep=true; E.LG[o.l].add(G); E.glbPlace(G,sc,{w:o.w,x:o.x,y:o.y,z:o.z,ry:o.ry}); if(E.rebuild) E.rebuild(); }).catch(function(e){ console.warn('sleeping_cats.glb',e); });
}
