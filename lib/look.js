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
    /* anime look (Shinkai-like): AO, a light bloom, tone mapping, a grade with cool shadows / warm highlights and lifted saturation, SMAA */
    let styled=null, styleOn=false;
    function buildStyle(){
      const c=new o.EffectComposer(renderer); c.addPass(new o.RenderPass(scene,camera));
      const g=new o.GTAOPass(scene,camera,w,h); g.updateGtaoMaterial({radius:0.3,distanceExponent:1.5,thickness:0.8,scale:0.9,samples:12,distanceFallOff:1.0}); g.blendIntensity=0.75; g.normalMaterial.side=THREE.DoubleSide;
      const ro=g._renderOverride.bind(g), hid=[]; g._renderOverride=function(r,mat,rt,cc,ca){ scene.traverseVisible(function(m){ if((m.isMesh||m.isSprite||m.isPoints)&&(m.renderOrder===1||(m.material&&m.material.transparent))) hid.push(m); }); hid.forEach(function(m){ m.visible=false; }); ro(r,mat,rt,cc,ca); hid.forEach(function(m){ m.visible=true; }); hid.length=0; };
      c.addPass(g); c.__ao=g;
      c.addPass(new o.UnrealBloomPass(new THREE.Vector2(w,h),0.1,0.25,6));   // the interior is lit to 1.4-3 before tone mapping, so only lamps and the sun bloom
      c.addPass(new o.OutputPass());
      c.addPass(new o.ShaderPass({uniforms:{tDiffuse:{value:null},sat:{value:1.08},con:{value:1.1},shadowTint:{value:new THREE.Color(0x2b4a8a)},highTint:{value:new THREE.Color(0xfffaf3)},vig:{value:0.16}},
        vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader:'uniform sampler2D tDiffuse; uniform float sat,con,vig; uniform vec3 shadowTint,highTint; varying vec2 vUv; void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722)); c=mix(vec3(l),c,sat); c=(c-.5)*con+.5; c=mix(c,c*shadowTint*1.9,(1.-smoothstep(0.,.45,l))*.18); c*=mix(vec3(1.),highTint,smoothstep(.55,1.,l)); vec2 d=vUv-.5; c*=1.-vig*dot(d,d)*1.6; gl_FragColor=vec4(clamp(c,0.,1.),1.); }'}));
      c.addPass(new o.SMAAPass());
      c.setPixelRatio(renderer.getPixelRatio()); c.setSize(w,h); return c;
    }
    return {
      render:function(){ Walk.drawMirrors(THREE,renderer,scene,camera); if(styleOn){ styled.__ao.enabled=!o.aoWhen||o.aoWhen(); styled.render(); } else if(aoOn&&(!o.aoWhen||o.aoWhen())) composer.render(); else renderer.render(scene,camera); },
      setSize:function(nw,nh){ w=nw; h=nh; if(composer){ composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w,h); } if(styled){ styled.setPixelRatio(renderer.getPixelRatio()); styled.setSize(w,h); } },
      canStyle:!!(o.UnrealBloomPass&&o.ShaderPass&&o.SMAAPass),
      setStyle:function(on){ styleOn=!!on&&!!o.UnrealBloomPass; if(styleOn&&!styled) styled=buildStyle(); },
      get styleOn(){ return styleOn; },
      setAO:function(on){ aoOn=!!on; if(aoOn&&!composer) build(); },
      get aoOn(){ return aoOn; }
    };
  };

  /* planar reflection (after three.js Reflector): a w x h plane facing its local +z, rendered only when the viewer is near and in front.
     Works inside moving groups: the mirror plane is read from the mesh every frame. */
  Walk.planarMirror=function(THREE,w,h){
    const rt=new THREE.WebGLRenderTarget(512,512); let lastAt=0, lastCam=new THREE.Matrix4();
    const vcam=new THREE.PerspectiveCamera(), tm=new THREE.Matrix4();
    const mat=new THREE.ShaderMaterial({
      uniforms:{tDiffuse:{value:rt.texture},textureMatrix:{value:tm},ready:{value:0},tint:{value:new THREE.Color(0xd8e2e6)}},
      vertexShader:'uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv=textureMatrix*vec4(position,1.0); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'#include <common>\nuniform sampler2D tDiffuse; uniform vec3 tint; uniform float ready; varying vec4 vUv;\nvoid main(){ vec4 b=ready>0.5?texture2DProj(tDiffuse,vUv):vec4(tint*0.9,1.0); gl_FragColor=vec4(mix(b.rgb,b.rgb*tint,0.3),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
    });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
    const pos=new THREE.Vector3(), nrm=new THREE.Vector3(), camPos=new THREE.Vector3(), view=new THREE.Vector3(), look=new THREE.Vector3(), tgt=new THREE.Vector3(), rot=new THREE.Matrix4(), plane=new THREE.Plane(), clipList=[plane], r3=new THREE.Matrix4();
    const draw=function(rd,sc,cam){
      if(sc.overrideMaterial||Walk.inMirror) return;   // ambient-occlusion depth/normal pass, or a mirror seen inside another mirror
      const now=performance.now(), still=lastCam.equals(cam.matrixWorld);
      if(mat.uniforms.ready.value&&(still?now-lastAt<250:now-lastAt<50)) return;   // reflections refresh at up to 20 fps, slowly when the viewer stands still
      lastAt=now; lastCam.copy(cam.matrixWorld);
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
      const pe=vcam.projectionMatrix.elements, nr=cam.near, fr=Math.min(cam.far,view.distanceTo(pos)+8);   // the reflection only draws what is within 8 m of the mirror
      pe[10]=-(fr+nr)/(fr-nr); pe[14]=-2*fr*nr/(fr-nr); vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
      tm.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse).multiply(m.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(nrm,pos); plane.constant-=0.003;   // world clip plane: an oblique projection skews the far plane and culls whole walls
      m.visible=false;
      if(!rd.clippingPlanes.length) rd.clippingPlanes=Walk.noClip||(Walk.noClip=[new THREE.Plane(new THREE.Vector3(0,1,0),1e5)]);   // keep one global plane in every pass, so a material first drawn in the mirror never meets a pass without one (three.js then uploads a null plane array)
      const prevRT=rd.getRenderTarget(), prevAuto=rd.shadowMap.autoUpdate, prevClip=rd.clippingPlanes;
      rd.shadowMap.autoUpdate=false; rd.clippingPlanes=clipList; rd.setRenderTarget(rt); Walk.inMirror=true; try{ rd.render(sc,vcam); } finally{ Walk.inMirror=false; }
      rd.setRenderTarget(prevRT); rd.shadowMap.autoUpdate=prevAuto; rd.clippingPlanes=prevClip;
      mat.uniforms.ready.value=1;
      m.visible=true;
    };
    m.castShadow=false; m.receiveShadow=false; m.userData.drawMirror=draw; (Walk.mirrors||(Walk.mirrors=[])).push(m);
    return m;
  };

  /* mirrors draw before the frame, never nested in it: a nested render leaves three.js's shared clipping state on the mirror plane */
  Walk.drawMirrors=function(THREE,rd,sc,cam){
    const L=Walk.mirrors; if(!L||!L.length) return;
    const F=Walk._mf||(Walk._mf=new THREE.Frustum()), PM=Walk._mp||(Walk._mp=new THREE.Matrix4());
    cam.updateMatrixWorld(); F.setFromProjectionMatrix(PM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
    L.forEach(function(m){ let o=m; while(o&&o!==sc){ if(!o.visible) return; o=o.parent; } if(!o) return;
      m.updateWorldMatrix(true,false); if(F.intersectsObject(m)) m.userData.drawMirror(rd,sc,cam); });
  };

  /* fabric with a velvet-like sheen at grazing angles; sheen follows the base colour (call syncSheen after recolouring) */
  Walk.fabricMaterial=function(THREE,base,opts){
    const m=new THREE.MeshPhysicalMaterial(Object.assign({roughness:1,metalness:0,envMapIntensity:0.45,sheen:1,sheenRoughness:0.55},opts||{}));
    m.color.setHex(base); Walk.syncSheen(m); return m;
  };
  const WHITE={r:1,g:1,b:1};
  Walk.syncSheen=function(m){ if(m.sheenColor) m.sheenColor.copy(m.color).lerp(WHITE,0.45); };
})(window);
