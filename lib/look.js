/* Shared "look" for the houses: photographed HDR environment for reflections and an optional ambient-occlusion post pass (GTAO).
   three.js classes come in through `o` because this file is a classic script and three.js is loaded as an ES module by each house. */
(function(root){
  const Walk=root.Walk=root.Walk||{};

  /* o: THREE, renderer, scene, camera, EffectComposer, RenderPass, GTAOPass, OutputPass, HDRLoader, envUrl, envIntensity, onChange(),
     aoWhen() -> false skips the AO pass for that frame (e.g. overview with floating labels, which the AO would darken) */
  Walk.Look=function(o){
    const THREE=o.THREE, renderer=o.renderer, scene=o.scene, camera=o.camera;
    let aoOn=false, composer=null, ao=null, w=1, h=1;

    if(o.envUrl&&o.HDRLoader){                     // keeps the house's own fallback environment if the file cannot load (file://, offline)
      new o.HDRLoader().load(o.envUrl,function(tex){
        const pm=new THREE.PMREMGenerator(renderer);
        scene.environment=pm.fromEquirectangular(tex).texture; scene.environmentIntensity=o.envIntensity||0.4; pm.dispose(); tex.dispose();
        if(o.onChange) o.onChange();
      },undefined,function(){});
    }

    function build(){
      composer=new o.EffectComposer(renderer);
      composer.addPass(new o.RenderPass(scene,camera));
      ao=new o.GTAOPass(scene,camera,w,h);
      ao.updateGtaoMaterial({radius:0.3,distanceExponent:1.5,thickness:0.8,scale:1.0,samples:12,distanceFallOff:1.0});
      ao.blendIntensity=0.85;
      ao.normalMaterial.side=THREE.DoubleSide;     // curtains and other double-sided cloth must hide what is behind them
      const renderOverride=ao._renderOverride.bind(ao), hidden=[];
      ao._renderOverride=function(r,mat,rt,cc,ca){ // glass, decals and other see-through layers stay out of the depth / normal pass
        scene.traverseVisible(function(m){ if(m.isMesh&&(m.renderOrder===1||(m.material&&m.material.transparent))) hidden.push(m); });
        hidden.forEach(function(m){ m.visible=false; });
        renderOverride(r,mat,rt,cc,ca);
        hidden.forEach(function(m){ m.visible=true; }); hidden.length=0;
      };
      composer.addPass(ao);
      composer.addPass(new o.OutputPass());
      composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w,h);
    }
    return {
      render:function(){ if(aoOn&&(!o.aoWhen||o.aoWhen())) composer.render(); else renderer.render(scene,camera); },
      setSize:function(nw,nh){ w=nw; h=nh; if(composer){ composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w,h); } },
      setAO:function(on){ aoOn=!!on; if(aoOn&&!composer) build(); },
      get aoOn(){ return aoOn; }
    };
  };

  /* planar reflection (after three.js Reflector): a w x h plane facing its local +z, rendered only when the viewer is near and in front.
     Works inside moving groups: the mirror plane is read from the mesh every frame. */
  Walk.planarMirror=function(THREE,w,h){
    const rt=new THREE.WebGLRenderTarget(384,384);
    const vcam=new THREE.PerspectiveCamera(), tm=new THREE.Matrix4();
    const mat=new THREE.ShaderMaterial({
      uniforms:{tDiffuse:{value:rt.texture},textureMatrix:{value:tm},ready:{value:0},tint:{value:new THREE.Color(0xd8e2e6)}},
      vertexShader:'uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv=textureMatrix*vec4(position,1.0); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'#include <common>\nuniform sampler2D tDiffuse; uniform vec3 tint; uniform float ready; varying vec4 vUv;\nvoid main(){ vec4 b=ready>0.5?texture2DProj(tDiffuse,vUv):vec4(tint*0.9,1.0); gl_FragColor=vec4(mix(b.rgb,b.rgb*tint,0.3),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
    });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
    const pos=new THREE.Vector3(), nrm=new THREE.Vector3(), camPos=new THREE.Vector3(), view=new THREE.Vector3(), look=new THREE.Vector3(), tgt=new THREE.Vector3(), rot=new THREE.Matrix4(), plane=new THREE.Plane(), clip=new THREE.Vector4(), q=new THREE.Vector4(), r3=new THREE.Matrix4();
    m.onBeforeRender=function(rd,sc,cam){
      if(sc.overrideMaterial) return;              // ambient-occlusion depth/normal pass
      pos.setFromMatrixPosition(m.matrixWorld); nrm.set(0,0,1).applyMatrix4(r3.extractRotation(m.matrixWorld));
      camPos.setFromMatrixPosition(cam.matrixWorld);
      view.subVectors(pos,camPos);
      if(view.dot(nrm)>0||view.length()>4.5) return;
      view.reflect(nrm).negate().add(pos);
      rot.extractRotation(cam.matrixWorld);
      look.set(0,0,-1).applyMatrix4(rot).add(camPos);
      tgt.subVectors(pos,look).reflect(nrm).negate().add(pos);
      vcam.position.copy(view); vcam.up.set(0,1,0).applyMatrix4(rot).reflect(nrm); vcam.lookAt(tgt);
      vcam.far=cam.far; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(cam.projectionMatrix);
      tm.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse).multiply(m.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(nrm,pos).applyMatrix4(vcam.matrixWorldInverse);
      clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
      const p=vcam.projectionMatrix.elements;
      q.x=(Math.sign(clip.x)+p[8])/p[0]; q.y=(Math.sign(clip.y)+p[9])/p[5]; q.z=-1; q.w=(1+p[10])/p[14];
      clip.multiplyScalar(2/clip.dot(q));
      p[2]=clip.x; p[6]=clip.y; p[10]=clip.z+1-0.003; p[14]=clip.w;
      m.visible=false;
      const prevRT=rd.getRenderTarget(), prevAuto=rd.shadowMap.autoUpdate;
      rd.shadowMap.autoUpdate=false; rd.setRenderTarget(rt); rd.render(sc,vcam);
      rd.setRenderTarget(prevRT); rd.shadowMap.autoUpdate=prevAuto;
      mat.uniforms.ready.value=1;
      m.visible=true;
    };
    m.castShadow=false; m.receiveShadow=false;
    return m;
  };

  /* fabric with a velvet-like sheen at grazing angles; sheen follows the base colour (call syncSheen after recolouring) */
  Walk.fabricMaterial=function(THREE,base,opts){
    const m=new THREE.MeshPhysicalMaterial(Object.assign({roughness:1,metalness:0,envMapIntensity:0.45,sheen:1,sheenRoughness:0.55},opts||{}));
    m.color.setHex(base); Walk.syncSheen(m); return m;
  };
  const WHITE={r:1,g:1,b:1};
  Walk.syncSheen=function(m){ if(m.sheenColor) m.sheenColor.copy(m.color).lerp(WHITE,0.45); };
})(window);
