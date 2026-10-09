/* Shared performance helpers for the houses: static geometry merging, per-storey light switching with a constant light count,
   shadow trimming, a frame-time governor (motion resolution, idle frame rate, quality ladder) and an FPS overlay. */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  const Perf=Walk.Perf={};

  function chainVisible(o,stop){ while(o&&o!==stop){ if(!o.visible) return false; o=o.parent; } return true; }
  function underKept(o,stop,keep){ while(o&&o!==stop){ if(keep.has(o)||(o.userData&&o.userData.keep)) return true; o=o.parent; } return false; }

  /* Merge, inside every group, the meshes that are its direct children into one mesh per (material, shadows, render order).
     Each merged mesh stays in the same group, so moving / hiding a group (furniture, doors, layouts, modes) still works.
     Skipped: meshes hidden at load, transparent ones (except floor decals with renderOrder 1), mirrors, and everything under a kept object
     or under a catalogue piece with moving parts. onSwap(removed, added) lets the house update its own mesh lists. Returns {before, after}. */
  const PLAIN={group:1,cols:1,anims:1,actions:1,type:1,port:1,plugOut:1};
  function animated(o){ const P=Walk.PIECES&&Walk.PIECES.get(o); if(!P) return false;
    if(P.anims.length||(P.actions&&P.actions.length)) return true;
    return Object.keys(P).some(function(k){ return !PLAIN[k]; }); }
  Perf.mergeStatic=function(THREE,mergeGeometries,roots,keep,onSwap){
    keep=keep||new Set(); let before=0, after=0;
    const blocked=function(o){ return keep.has(o)||(o.userData&&o.userData.keep)||animated(o); };
    const visit=function(P){
      if(!P.visible||blocked(P)) return;
      const buckets=new Map(), victims=[];
      P.children.slice().forEach(function(o){
        if(!o.isMesh){ visit(o); return; }
        if(!o.visible||blocked(o)||o.isInstancedMesh||o.isSkinnedMesh||o.children.length) return;
        if(o.onBeforeRender!==THREE.Mesh.prototype.onBeforeRender||o.morphTargetInfluences) return;
        const g=o.geometry; if(!g||!g.attributes.position||g.attributes.color||g.attributes.skinIndex) return;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        const decal=o.renderOrder===1;
        if(o.renderOrder!==0&&!decal) return;
        if(mats.some(function(m){ return !m||(m.transparent&&!decal)||m.alphaTest>0||m.isShaderMaterial||m.clippingPlanes||m.userData.noMerge; })) return;
        o.updateMatrix();
        const src=g.index?g.toNonIndexed():g, n=src.attributes.position.count;
        const parts=Array.isArray(o.material)?(g.groups.length?g.groups:[{start:0,count:n,materialIndex:0}]):[{start:0,count:n,materialIndex:0}];
        parts.forEach(function(gr){
          const m=mats[gr.materialIndex||0]; if(!m) return;
          const piece=slice(THREE,src,gr.start,gr.count); piece.applyMatrix4(o.matrix);
          if(o.matrix.determinant()<0) flip(piece);
          const key=m.uuid+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0)+'|'+o.renderOrder;
          if(!buckets.has(key)) buckets.set(key,{m:m,cast:o.castShadow,recv:o.receiveShadow,ro:o.renderOrder,geos:[],from:[]});
          const bk=buckets.get(key); bk.geos.push(piece); if(bk.from.indexOf(o)<0) bk.from.push(o);
        });
        if(src!==g) src.dispose();
        victims.push(o);
      });
      const removed=[], added=[], gone=new Set();
      buckets.forEach(function(b){ if(b.from.length>1) b.from.forEach(function(o){ gone.add(o); }); });
      buckets.forEach(function(b){
        if(!b.from.every(function(o){ return gone.has(o); })){ b.geos.forEach(function(q){ q.dispose(); }); return; }   // a lone mesh gains nothing; it stays as it is
        const merged=mergeGeometries(b.geos,false); b.geos.forEach(function(q){ q.dispose(); }); if(!merged) return;
        merged.computeBoundingSphere(); merged.computeBoundingBox();
        const mesh=new THREE.Mesh(merged,b.m); mesh.castShadow=b.cast; mesh.receiveShadow=b.recv; mesh.renderOrder=b.ro; mesh.userData.merged=true;
        P.add(mesh); added.push(mesh); after++;
        b.from.forEach(function(o){ if(removed.indexOf(o)<0){ removed.push(o); } });
      });
      removed.forEach(function(o){ P.remove(o); });
      before+=removed.length;
      if(onSwap&&removed.length) onSwap(removed,added);
    };
    roots.forEach(visit);
    return {before:before,after:after};
  };
  /* Inside static catalogue pieces, materials with identical settings are replaced by one shared instance, so more parts can be merged.
     Pieces with moving parts and the house's own named materials are left alone (the page may still change those at run time). */
  Perf.shareMaterials=function(roots,named){
    const canon=new Map(); let n=0;
    const key=function(m){ const c=function(x){ return x?x.getHexString():''; }, t=function(x){ return x?x.uuid:''; };
      return [m.type,c(m.color),c(m.emissive),m.emissiveIntensity,m.roughness,m.metalness,m.envMapIntensity,t(m.map),t(m.normalMap),t(m.roughnessMap),t(m.bumpMap),m.bumpScale,
        m.transparent,m.opacity,m.side,m.depthWrite,m.vertexColors,m.flatShading,m.sheen,c(m.sheenColor),m.sheenRoughness,m.clearcoat,m.clearcoatRoughness,m.alphaTest].join('|'); };
    const inStatic=function(o){ let q=o.parent, hit=false; while(q){ if(q.userData&&q.userData.keep) return false; if(Walk.PIECES&&Walk.PIECES.get(q)){ if(animated(q)) return false; hit=true; } q=q.parent; } return hit; };
    roots.forEach(function(r){ r.traverse(function(o){
      if(!o.isMesh||Array.isArray(o.material)||!inStatic(o)) return;
      const m=o.material; if(!m||named.has(m)||m.isShaderMaterial||m.userData.noMerge) return;
      const k=key(m); if(!canon.has(k)){ canon.set(k,m); return; }
      const c=canon.get(k); if(c!==m){ o.material=c; n++; } }); });
    return n;
  };

  function slice(THREE,src,start,count){     // copy of triangles [start, start+count) of a non-indexed geometry, position / normal / uv only
    const n=src.attributes.position.count, a=Math.max(0,start||0), b=Math.min(n,a+(count===Infinity?n:count));
    const out=new THREE.BufferGeometry();
    ['position','normal','uv'].forEach(function(name){
      const at=src.attributes[name], size=name==='uv'?2:3, arr=new Float32Array((b-a)*size);
      if(at){ for(let i=a;i<b;i++){ arr[(i-a)*size]=at.getX(i); arr[(i-a)*size+1]=at.getY(i); if(size===3) arr[(i-a)*size+2]=at.getZ(i); } }
      out.setAttribute(name,new THREE.BufferAttribute(arr,size));
    });
    if(!src.attributes.normal) out.computeVertexNormals();
    return out;
  }
  function flip(g){ const p=g.attributes.position, nrm=g.attributes.normal, uv=g.attributes.uv;
    for(let i=0;i<p.count;i+=3){ [p,nrm,uv].forEach(function(at){ for(let k=0;k<at.itemSize;k++){ const t=at.array[(i+1)*at.itemSize+k]; at.array[(i+1)*at.itemSize+k]=at.array[(i+2)*at.itemSize+k]; at.array[(i+2)*at.itemSize+k]=t; } }); } }

  /* Small parts (cups, books, handles) cast no visible shadow at room scale. */
  Perf.trimShadows=function(roots,minRadius){
    let n=0;
    roots.forEach(function(r){ r.traverse(function(o){ if(!o.isMesh||!o.castShadow||!o.geometry) return;
      if(!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const s=o.geometry.boundingSphere, sc=o.getWorldScale?o.getWorldScale(new o.position.constructor()):null, k=sc?Math.max(sc.x,sc.y,sc.z):1;
      if(s&&s.radius*k<minRadius){ o.castShadow=false; n++; } }); });
    return n;
  };

  /* Point lights: exactly K lights are switched on at any time, the K nearest to the viewer among the storeys that are drawn
     (dark spares fill up when there are fewer). The light count in the shaders never changes, so moving around never recompiles. */
  Perf.NearLights=function(THREE,scene,levelRoots,K){
    const spares=[]; let all=[];
    function collect(){
      all=[]; scene.traverse(function(o){ if(!o.isPointLight||o.userData.spare) return; let p=o; while(p&&levelRoots.indexOf(p)<0) p=p.parent; all.push({L:o,lv:p?levelRoots.indexOf(p):-1}); });
      while(spares.length<K){ const s=new THREE.PointLight(0,0,0.01,2); s.userData.spare=true; s.position.set(0,-100,0); scene.add(s); spares.push(s); }
    }
    collect();
    const wp=new THREE.Vector3();
    return {
      K:K,
      update:function(pos,levels){
        const cand=[];
        all.forEach(function(e){ e.L.visible=false; if(e.lv>=0&&levels.indexOf(e.lv)<0) return; if(e.L.intensity<=0&&!e.L.userData.always) return;
          e.L.getWorldPosition(wp); cand.push({L:e.L,d:wp.distanceToSquared(pos)}); });
        cand.sort(function(a,b){ return a.d-b.d; });
        const n=Math.min(K,cand.length); for(let i=0;i<n;i++) cand[i].L.visible=true;
        spares.forEach(function(s,i){ s.visible=i<K-n; });
      },
      refresh:collect
    };
  };

  /* Frame governor: renders at full rate while something changes, about 12 fps when idle; drops the pixel ratio while moving;
     steps quality down (AO off -> pixel ratio 1 -> soft shadows off) if the frame rate stays low. */
  Perf.Governor=function(o){
    const renderer=o.renderer; let full=o.pixelRatio, ratio=full, moving=false, stillT=0, idleAcc=0, lastSig='', lastInput=0, kick=0;
    let fpsT=0, fpsN=0, fps=60, lowT=0, step=0;
    ['keydown','pointerdown','pointermove','wheel','touchstart','touchmove','click'].forEach(function(e){ window.addEventListener(e,function(){ lastInput=performance.now(); },{passive:true}); });
    function setRatio(r){ if(Math.abs(r-ratio)<0.01) return; ratio=r; renderer.setPixelRatio(r); if(o.onResize) o.onResize(); }
    return {
      /* call every rAF with dt and a camera signature; returns true when a frame should be drawn */
      frame:function(dt,camSig,busy){
        const now=performance.now(), changed=camSig!==lastSig; lastSig=camSig;
        if(changed){ moving=true; stillT=0; } else { stillT+=dt; if(stillT>0.25) moving=false; }
        const motionRatio=Math.max(1,Math.min(full,full*0.7));
        setRatio(moving&&full>1?motionRatio:full);
        const active=changed||busy||now-lastInput<1500||kick>0; if(kick>0) kick--;
        if(!active){ idleAcc+=dt; if(idleAcc<1/12) return false; idleAcc=0; } else idleAcc=0;
        if(active){ fpsT+=dt; fpsN++; if(fpsT>=1){ fps=fpsN/fpsT; fpsT=0; fpsN=0;
          if(fps<28){ lowT++; if(lowT>=3&&step<3){ lowT=0; step++; if(o.degrade) o.degrade(step); if(step===2){ full=1; } } } else lowT=0; } }
        return true;
      },
      kick:function(n){ kick=Math.max(kick,n||2); },
      get fps(){ return fps; }, get step(){ return step; }, get ratio(){ return ratio; },
      setFull:function(r){ full=r; }
    };
  };

  /* Small parts far away are skipped: a mesh is hidden while its bounding sphere would be under ~1 % of the view.
     Only meshes this module merged or parts of static catalogue pieces are touched, and only ones this pass hid itself get shown again. */
  Perf.DetailCull=function(THREE,roots){
    const list=[], c=new THREE.Vector3(), hidden=new Set();
    const inStatic=function(o){ let q=o.parent, hit=false; while(q){ if(q.userData&&q.userData.keep) return false; if(Walk.PIECES&&Walk.PIECES.get(q)){ if(animated(q)) return false; hit=true; } q=q.parent; } return hit; };
    roots.forEach(function(r){ r.updateMatrixWorld(true); r.traverse(function(o){
      if(!o.isMesh||!o.visible||!(o.userData.merged||inStatic(o))) return;
      const g=o.geometry; if(!g.boundingSphere) g.computeBoundingSphere(); const s=o.getWorldScale(c), k=Math.max(s.x,s.y,s.z), rad=g.boundingSphere.radius*k;
      if(rad<0.35) list.push({o:o,r:rad,c:g.boundingSphere.center.clone()}); }); });
    return {
      count:list.length,
      update:function(cam,ratio){ const p=cam.position, f=ratio||0.012;
        list.forEach(function(e){ c.copy(e.c).applyMatrix4(e.o.matrixWorld); const far=e.r<c.distanceTo(p)*f;
          if(far&&e.o.visible){ e.o.visible=false; hidden.add(e.o); } else if(!far&&hidden.has(e.o)){ e.o.visible=true; hidden.delete(e.o); } }); }
    };
  };

  /* Shader programs are compiled in the background (KHR_parallel_shader_compile when the GPU driver offers it) before the first frame. */
  Perf.precompile=function(THREE,renderer,scene,camera,show,before){
    const compile=function(planes){ const prev=show.map(function(g){ return g.visible; }), cp=renderer.clippingPlanes; let p;
      show.forEach(function(g){ g.visible=true; }); renderer.clippingPlanes=planes||cp;
      try{ p=renderer.compileAsync?renderer.compileAsync(scene,camera):(renderer.compile(scene,camera),Promise.resolve()); }catch(e){ p=Promise.resolve(); }
      renderer.clippingPlanes=cp; show.forEach(function(g,i){ g.visible=prev[i]; });
      return Promise.race([p.catch(function(){}),new Promise(function(r){ setTimeout(r,20000); })]); };
    let mirrors=false; scene.traverse(function(o){ if(o.isMesh&&o.material&&o.material.uniforms&&o.material.uniforms.tDiffuse) mirrors=true; });
    const done=Promise.race([Promise.resolve(before),new Promise(function(r){ setTimeout(r,15000); })]).then(function(){ return compile(); });   // after the textures, so materials compile once with their final maps
    if(mirrors) done.then(function(){ setTimeout(function(){                       // then, quietly, the variants mirrors draw with, and one draw of each mirror
      Promise.resolve().then(function(){
        const cam=new THREE.PerspectiveCamera(60,1,0.05,100), n=new THREE.Vector3(), q=new THREE.Quaternion();
        scene.traverse(function(o){ if(!o.isMesh||!o.material||!o.material.uniforms||!o.material.uniforms.tDiffuse) return;
          o.updateMatrixWorld(true); o.getWorldQuaternion(q); n.set(0,0,1).applyQuaternion(q);
          o.getWorldPosition(cam.position); cam.position.addScaledVector(n,1.5); cam.lookAt(cam.position.clone().addScaledVector(n,-1)); cam.updateMatrixWorld();
          try{ o.onBeforeRender(renderer,scene,cam); }catch(_){} }); }); },1000); });
    return done;
  };

  /* Inside the house switcher (index.html) a hidden house stops drawing until it is shown again. */
  Perf.paused=false;
  window.addEventListener('message',function(e){ const d=e.data; if(e.source===window.parent&&d&&d.type==='house-active') Perf.paused=!d.active; });

  /* loading screen: texture downloads (three.js loading manager) and the current step, as text and a thin progress bar */
  Perf.LoadStatus=function(){
    const el=document.getElementById('load'); if(!el) return {set:function(){},tex:function(){}};
    let small=el.querySelector('small'); if(!small){ small=document.createElement('small'); el.appendChild(small); }
    const bar=document.createElement('div'); bar.className='loadBar'; bar.innerHTML='<i></i>'; el.appendChild(bar);
    let step='', tex='', frac=0;
    const show=function(){ small.textContent=[step,tex].filter(Boolean).join('・'); bar.firstChild.style.width=Math.round(frac*100)+'%'; };
    return {
      set:function(t,f){ step=t; if(f!==undefined) frac=Math.max(frac,f); show(); },
      tex:function(done,total){ tex='貼圖 '+done+' / '+total; frac=Math.max(frac,0.15+0.6*done/Math.max(total,1)); show(); }
    };
  };

  /* offline cache (sw.js next to the pages); not on file:// */
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)) window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });

  /* FPS overlay toggled from the menu */
  Perf.Overlay=function(renderer,getExtra){
    const el=document.createElement('div');
    el.style.cssText='position:fixed;left:12px;bottom:12px;z-index:50;font:12px/1.45 ui-monospace,Menlo,monospace;color:#fff;background:rgba(20,24,30,.78);padding:6px 9px;border-radius:8px;pointer-events:none;white-space:pre';
    el.hidden=true; document.body.appendChild(el);
    let t=0, n=0, fps=0;
    return {
      set on(v){ el.hidden=!v; }, get on(){ return !el.hidden; },
      frame:function(dt){ if(el.hidden) return; t+=dt; n++; if(t<0.5) return; fps=n/t; t=0; n=0;
        const i=renderer.info.render; el.textContent='FPS '+fps.toFixed(0)+'\n繪製 '+i.calls+' 次 / '+(i.triangles/1000).toFixed(0)+'k 三角形'+(getExtra?'\n'+getExtra():''); }
    };
  };
})(window);
