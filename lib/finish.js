/* Shared interior finish: colour palettes and the photographic textures (Poly Haven / ambientCG, CC0) in textures/.
   Every texture is optional: if it cannot load (file://, offline) the house keeps its procedural look. */
(function(root){
  const Walk=root.Walk=root.Walk||{};

  /* wall: one colour per wall role (a house maps its rooms to these roles); mat: furniture and fixture material colours */
  Walk.THEMES={
    A:{ name:'暖色北歐',
        wall:{oat:0xdcceb7,sage:0xa3b39d,mist:0xb3bfca,peach:0xe2c0a8,hall:0xd8caB2,genkan:0xd0c3ad,utility:0xe0d4bf,wc:0xd9dcd8,bath:0xdfe8ec,dress:0xe7e2d8,outside:0xd8d3c8},
        ceil:[0xf5f0e6,0x2b2720], trim:0xfbfaf7, frame:0xe9e5dc, floor:0xc4aa88, floorD:0xb39a78, ft:'A', wood:'C', ftint:0xffffff, ftintD:0xe8e0d6, exposure:1.0, amb:0.48,
        mat:{oak:0xf6ead6,oakD:0xc2a37c,oakChair:0xf0dcbc,chairBack:0xe3c9a2,sofa:0x7f90a5,sofaD:0x6b7b8f,bedA:0xe9eef3,bedB:0xb8c4d2,cushA:0xc9b27f,cushB:0x5f6f82,
             linen:0xb98368,rug:0xb9b0a3,door:0xf2ead8,cab:0xe9e5dc,cabF:0xf4f1ea,top:0xeeeeee,panel:0xf1efe9} },
    B:{ name:'現代日式',
        wall:{oat:0xbfb4a1,sage:0x5e4330,mist:0x6f6053,peach:0xb9aa90,hall:0xb3a894,genkan:0xa89c88,utility:0xc2b8a5,wc:0xaeb0a8,bath:0xb7c1c1,dress:0xc0b9ac,outside:0xb5afa3},
        ceil:[0xe2dbcd,0x211e19], trim:0xd6cebf, frame:0xb9b09d, floor:0x7f6c5a, floorD:0x6a5a4a, ft:'B', wood:'A', ftint:0xa89888, ftintD:0x8e8070, exposure:1.05, amb:0.5,
        mat:{oak:0x8a6a50,oakD:0x5a4030,oakChair:0x7e5e46,chairBack:0x72563c,sofa:0x5b5a56,sofaD:0x484743,bedA:0xd6d2c8,bedB:0x6a6a64,cushA:0xb5895a,cushB:0x4a4f4a,
             linen:0x4a423a,rug:0x8d867a,door:0x7a5e46,cab:0x4a4036,cabF:0x6a5645,top:0xd9d3c9,panel:0xd2c9b8} },
    C:{ name:'明亮法式',
        wall:{oat:0xf2e6dc,sage:0xaabdcc,mist:0xdfbdb7,peach:0xe2d9e6,hall:0xf4ece4,genkan:0xeadfd2,utility:0xf3ebe0,wc:0xe6e9e6,bath:0xe3edf0,dress:0xf0e6df,outside:0xe0dbd0},
        ceil:[0xfdf9f3,0x2e2a24], trim:0xffffff, frame:0xf6f2ea, floor:0xe3c9a2, floorD:0xd2b88f, ft:'C', wood:'C', ftint:0xfff2e0, ftintD:0xeee4d2, exposure:1.0, amb:0.5,
        mat:{oak:0xffffff,oakD:0xd6c3a8,oakChair:0xfaf1e2,chairBack:0xe4d3b8,sofa:0xcf9d99,sofaD:0xb98582,bedA:0xf6f1ea,bedB:0xd7c4cc,cushA:0xe6c46f,cushB:0x9fb4c6,
             linen:0xb4c4d2,rug:0xd9ccc2,door:0xfdf8ee,cab:0xf1ece2,cabF:0xf9f6f0,top:0xffffff,panel:0xfaf6ef} }
  };
  Walk.WALL_ROLES=Object.keys(Walk.THEMES.A.wall);

  /* o: THREE, anisotropy, FL {wood, woodD} (floor planes map 1.818 x 0.909 m per uv unit), M (oak, oakD, oakChair, door, chairBack, linen, ceil, trim, frame, ...),
        WM {role: wall material}, fabMats [fabric materials], base (texture folder, default 'textures/') */
  Walk.Finish=function(o){
    const THREE=o.THREE, FL=o.FL, M=o.M, WM=o.WM, base=o.base||'textures/', loader=new THREE.TextureLoader();
    let cur=null;
    function paint(m,hex){ if(!m) return; m.color.setHex(hex); Walk.syncSheen(m); }
    function loadTex(file,srgb,rx,ry,rot,done){
      const t=loader.load(base+file,function(){ if(done) done(t); },undefined,function(){});
      t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=o.anisotropy; if(srgb) t.colorSpace=THREE.SRGBColorSpace;
      t.repeat.set(rx,ry); if(rot){ t.center.set(0.5,0.5); t.rotation=rot; }
      return t;
    }
    function mapMat(m,name,span,rough){          // photographic colour + normal (+ roughness) map; span = uv units covered by one texture tile
      loadTex(name+'_diff.jpg',true,1/span,1/span,0,function(t){ m.map=t; m.needsUpdate=true; });
      loadTex(name+'_nor.jpg',false,1/span,1/span,0,function(t){ m.normalMap=t; m.normalScale.set(0.8,0.8); m.needsUpdate=true; });
      if(rough) loadTex(name+'_rough.jpg',false,1/span,1/span,0,function(t){ m.roughnessMap=t; m.roughness=1; m.needsUpdate=true; });
    }
    const floorCache={};
    function useFloor(th){                       // the photo tiles are 1.7 m square, planks laid along x
      const ft=th.ft, rot=ft==='A'?0:Math.PI/2;
      const apply=function(c){
        FL.wood.map=c.d; FL.wood.normalMap=c.n; FL.wood.normalScale.set(0.8,0.8); FL.wood.roughness=0.55;
        FL.woodD.map=c.d; FL.woodD.normalMap=c.n; FL.woodD.normalScale.set(0.8,0.8);
        paint(FL.wood,th.ftint); paint(FL.woodD,th.ftintD); FL.wood.needsUpdate=true; FL.woodD.needsUpdate=true;
      };
      let c=floorCache[ft];
      if(c){ if(c.ready) apply(c); return; }
      c=floorCache[ft]={ready:false}; let n=0;
      const done=function(){ if(++n===2){ c.ready=true; if(cur&&cur.ft===ft) apply(c); } };
      c.d=loadTex('floor'+ft+'_diff.jpg',true,1.818/1.7,0.909/1.7,rot,done);
      c.n=loadTex('floor'+ft+'_nor.jpg',false,1.818/1.7,0.909/1.7,rot,done);
    }
    const woodCache={};
    function useWood(th){                        // veneer on tables, chairs, bed frames, doors: warm oak or pale oak
      const k=th.wood, span=k==='A'?1.83:1.0, apply=function(c){
        [M.oak,M.oakD,M.oakChair,M.door].forEach(function(m){ if(!m) return; m.map=c.d; m.normalMap=c.n; m.normalScale.set(0.5,0.5); m.roughness=0.55; m.needsUpdate=true; });
        if(M.chairBack){                         // the curved chair back uses 0..1 uv around a 0.4 x 0.38 m arc
          const bd=c.d.clone(), bn=c.n.clone();
          [bd,bn].forEach(function(t){ t.repeat.set(0.4/span,0.38/span); t.needsUpdate=true; });
          M.chairBack.map=bd; M.chairBack.normalMap=bn; M.chairBack.normalScale.set(0.5,0.5); M.chairBack.needsUpdate=true;
        }
      };
      let c=woodCache[k]; if(c){ if(c.ready) apply(c); return; }
      c=woodCache[k]={ready:false}; let n=0;
      const done=function(){ if(++n===2){ c.ready=true; if(cur&&cur.wood===k) apply(c); } };
      c.d=loadTex('oak'+k+'_diff.jpg',true,1/span,1/span,0,done); c.n=loadTex('oak'+k+'_nor.jpg',false,1/span,1/span,0,done);
    }
    function loadCommon(){                       // plaster grain on every wall colour; knit / weave on fabrics; linen on curtains
      loadTex('wall_nor.jpg',false,0.5,0.5,0,function(t){
        Object.keys(WM).forEach(function(k){ const m=WM[k]; m.bumpMap=null; m.normalMap=t; m.normalScale.set(0.55,0.55); m.needsUpdate=true; });
      });
      loadTex('fabric_nor.jpg',false,3.66,3.66,0,function(t){
        o.fabMats.forEach(function(m){ m.bumpMap=null; m.normalMap=t; m.normalScale.set(0.9,0.9); m.needsUpdate=true; });
      });
      loadTex('fabric_diff.jpg',true,3.66,3.66,0,function(t){
        o.fabMats.forEach(function(m){ if(m!==M.linen){ m.map=t; m.needsUpdate=true; } });
      });
      if(M.linen) loadTex('linen_diff.jpg',true,1,1,0,function(t){ M.linen.map=t; M.linen.needsUpdate=true; });
    }
    function applyPalette(th){                   // walls, furniture colours, ceiling, trims and floors; the house sets exposure and ambient light
      cur=th;
      Object.keys(th.wall).forEach(function(k){ paint(WM[k],th.wall[k]); });
      Object.keys(th.mat).forEach(function(k){ paint(M[k],th.mat[k]); });
      paint(M.ceil,th.ceil[0]); if(M.ceil) M.ceil.emissive.setHex(th.ceil[1]);
      paint(M.trim,th.trim); paint(M.frame,th.frame); paint(FL.wood,th.floor); paint(FL.woodD,th.floorD);
      useFloor(th); useWood(th);
    }
    return {paint:paint,loadTex:loadTex,mapMat:mapMat,useFloor:useFloor,useWood:useWood,loadCommon:loadCommon,applyPalette:applyPalette};
  };
})(window);
