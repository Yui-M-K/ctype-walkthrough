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

  /* fabric with a velvet-like sheen at grazing angles; sheen follows the base colour (call syncSheen after recolouring) */
  Walk.fabricMaterial=function(THREE,base,opts){
    const m=new THREE.MeshPhysicalMaterial(Object.assign({roughness:1,metalness:0,envMapIntensity:0.45,sheen:1,sheenRoughness:0.55},opts||{}));
    m.color.setHex(base); Walk.syncSheen(m); return m;
  };
  const WHITE={r:1,g:1,b:1};
  Walk.syncSheen=function(m){ if(m.sheenColor) m.sheenColor.copy(m.color).lerp(WHITE,0.45); };
})(window);
