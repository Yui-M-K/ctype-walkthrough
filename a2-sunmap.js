/* A2 日照熱力圖（只給 a2.html 用）。
   做法：對每個時間步長，用太陽方向的正交相機把「會擋光的網格」渲染成深度圖，再用一張覆蓋樓層平面的全螢幕 pass，
   把每個取樣點投到光空間比較深度，亮的累加「步長小時數」到 float 渲染目標（兩層樓各一個）。最後讀回，4×4 取樣平均成 25 cm 格。
   擋光者 = 場景裡 castShadow 的非 Instanced 網格（牆、天花、樓板、屋頂替身、屋簷、外構格柵…）；玻璃不擋；鄰棟跟隨選單開關。 */
(function(){
  'use strict';
  var CELL=0.25, SUB=4, STEP_MIN=15, LAYER=5, H_FLOOR=0.05;
  var YEAR=2026;

  function ready(cb){
    var n=0, t=setInterval(function(){
      if(window.__a2E&&window.__a2Sun&&window.THREE&&window.A2&&window.Walk&&Walk.Sun&&document.getElementById('sunNote')){ clearInterval(t); cb(); }
      else if(++n>1200) clearInterval(t);
    },100);
  }
  ready(init);

  function init(){
    var THREE=window.THREE, E=window.__a2E, PLAN=window.A2.PLAN, NORTH=window.A2.NORTH, S=Walk.Sun, ctrl=window.__a2Sun;

    /* ---------- 平面資料（引擎座標：x = 北 n，z = 東 e，單位 m） ---------- */
    var LEVELS=[PLAN.levels[0],PLAN.levels[1]];
    function rectM(q){ return [q[1]/100,q[0]/100,q[3]/100,q[2]/100]; }       // [e0,n0,e1,n1] cm -> [x0,z0,x1,z1] m
    var roomsByLevel=LEVELS.map(function(L,l){
      var map={}, out=[];
      L.rooms.forEach(function(r){
        if(r.kind==='void') return;
        var o=map[r.name]; if(!o){ o=map[r.name]={name:r.name,kind:r.kind,level:l,rects:[]}; out.push(o); }
        r.rects.forEach(function(q){ o.rects.push(rectM(q)); });
      });
      return out;
    });
    var FT=PLAN.features;
    roomsByLevel[1].push({name:'陽台',kind:'outdoor',level:1,rects:[rectM(FT.balcony.rect)]});
    roomsByLevel[0].forEach(function(r){ if(r.kind==='garage') r.kind='outdoor'; });
    /* 取樣面：0 = 1F 地板、1 = 2F 地板、2 = 出窗平台（高 40 cm）、3 = 緣側（-4 cm） */
    var SURF=[{label:'1F',grp:0,dy:function(){ return E.base(0); }},{label:'2F',grp:1,dy:function(){ return E.base(1); }},
      {label:'1F',grp:0,dy:function(){ return E.base(0)+0.40; }},{label:'1F',grp:0,dy:function(){ return E.base(0)-0.04; }}];
    var NS=SURF.length;
    roomsByLevel[2]=[{name:'出窗平台',kind:'bay',level:2,rects:[rectM(FT.bayWindow.platformRect)]}];
    roomsByLevel[3]=[{name:'緣側',kind:'outdoor',level:3,rects:[rectM(FT.engawa.rect)]}];
    var wallsByLevel=LEVELS.map(function(L){
      return L.walls.map(function(w){ var t=(w.t||15)/200, e0=Math.min(w.a[0],w.b[0])/100, e1=Math.max(w.a[0],w.b[0])/100, n0=Math.min(w.a[1],w.b[1])/100, n1=Math.max(w.a[1],w.b[1])/100;
        return [n0-t,e0-t,n1+t,e1+t]; });                                      // [x0,z0,x1,z1]
    });
    wallsByLevel[2]=[]; wallsByLevel[3]=[];
    var bx0=1e9,bz0=1e9,bx1=-1e9,bz1=-1e9;
    roomsByLevel.forEach(function(rs){ rs.forEach(function(r){ r.rects.forEach(function(q){ bx0=Math.min(bx0,q[0]); bz0=Math.min(bz0,q[1]); bx1=Math.max(bx1,q[2]); bz1=Math.max(bz1,q[3]); }); }); });
    var GX0=Math.floor(bx0/CELL)*CELL, GZ0=Math.floor(bz0/CELL)*CELL;
    var GW=Math.ceil((bx1-GX0)/CELL), GH=Math.ceil((bz1-GZ0)/CELL), W=GW*SUB, H=GH*SUB, PX=CELL/SUB;
    /* 每層的取樣點遮罩：房間編號（-1 = 房外或牆體內） */
    var roomIdx=[0,1,2,3].map(function(l){
      var a=new Int16Array(W*H).fill(-1), rs=roomsByLevel[l], ws=wallsByLevel[l];
      for(var j=0;j<H;j++) for(var i=0;i<W;i++){
        var x=GX0+(i+0.5)*PX, z=GZ0+(j+0.5)*PX, k, hit=-1;
        for(k=0;k<rs.length&&hit<0;k++) for(var q=0;q<rs[k].rects.length;q++){ var c=rs[k].rects[q]; if(x>=c[0]&&x<c[2]&&z>=c[1]&&z<c[3]){ hit=k; break; } }
        if(hit<0) continue;
        for(k=0;k<ws.length;k++){ var w=ws[k]; if(x>=w[0]&&x<=w[2]&&z>=w[1]&&z<=w[3]){ hit=-1; break; } }
        a[j*W+i]=hit;
      }
      return a;
    });

    /* ---------- GPU 計算 ---------- */
    var gpu=null;
    function gpuInit(){
      if(gpu) return gpu;
      var depthMat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,colorWrite:false});
      var quadMat=new THREE.ShaderMaterial({
        uniforms:{tDepth:{value:null},tPrev:{value:null},uVP:{value:new THREE.Matrix4()},uOrigin:{value:new THREE.Vector2(GX0,GZ0)},uPx:{value:PX},uY:{value:0},uW:{value:0},uBias:{value:0},uRes:{value:new THREE.Vector2(W,H)}},
        vertexShader:'void main(){ gl_Position=vec4(position.xy,0.0,1.0); }',
        fragmentShader:'precision highp float; uniform sampler2D tDepth,tPrev; uniform mat4 uVP; uniform vec2 uOrigin,uRes; uniform float uPx,uY,uW,uBias;\n'
          +'void main(){ vec2 f=gl_FragCoord.xy-0.5; vec3 P=vec3(uOrigin.x+(f.x+0.5)*uPx,uY,uOrigin.y+(f.y+0.5)*uPx);\n'
          +' vec4 c=uVP*vec4(P,1.0); vec3 n=c.xyz/c.w; vec2 uv=n.xy*0.5+0.5; float z=n.z*0.5+0.5; float lit=1.0;\n'
          +' if(uv.x>=0.0&&uv.x<=1.0&&uv.y>=0.0&&uv.y<=1.0){ float d=texture2D(tDepth,uv).r; lit=(z-d>uBias)?0.0:1.0; }\n'
          +' float prev=texture2D(tPrev,gl_FragCoord.xy/uRes).r; gl_FragColor=vec4(prev+lit*uW,0.0,0.0,1.0); }',
        depthTest:false,depthWrite:false});
      var quadScene=new THREE.Scene(), quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMat));
      var accOpt={type:THREE.FloatType,format:THREE.RGBAFormat,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false};
      var acc=SURF.map(function(){ return [new THREE.WebGLRenderTarget(W,H,accOpt),new THREE.WebGLRenderTarget(W,H,accOpt)]; });
      gpu={depthMat:depthMat,quadMat:quadMat,quadScene:quadScene,quadCam:quadCam,acc:acc,sm:0,rt:null};
      return gpu;
    }
    function depthTarget(size){
      if(gpu.rt&&gpu.sm===size) return gpu.rt;
      if(gpu.rt){ gpu.rt.depthTexture.dispose(); gpu.rt.dispose(); }
      var dt=new THREE.DepthTexture(size,size); dt.type=THREE.FloatType; dt.format=THREE.DepthFormat; dt.minFilter=dt.magFilter=THREE.NearestFilter;
      gpu.rt=new THREE.WebGLRenderTarget(size,size,{depthTexture:dt,depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,format:THREE.RedFormat,type:THREE.UnsignedByteType});
      gpu.sm=size; return gpu.rt;
    }

    function gatherCasters(opts){
      var lg=new Set(E.LG), fg=new Set(E.furnG), fm=new Set(E.furnMeshes), roof=null, list=[];
      E.scene.traverse(function(m){
        if(!m.isMesh||m.isInstancedMesh||!m.castShadow) return;
        var vis=true, inF=fm.has(m)||m.userData.wasFurn, o=m;
        while(o&&o!==E.scene){
          if(fg.has(o)) inF=true;
          if(!o.visible&&!lg.has(o)&&!(o.userData&&o.userData.roofMesh)&&o.material!==E.M.roof) vis=false;
          o=o.parent;
        }
        if(!vis) return;
        if(inF&&!opts.furn) return;
        list.push(m);
      });
      return list;
    }

    /* opts: {mo,d,h:取樣高度(地板上 m),furn:bool,step:分鐘,size:深度圖解析度,onProgress}。回傳 Promise<result> */
    function compute(opts){
      opts=opts||{}; var step=opts.step||STEP_MIN, hAbove=opts.h==null?H_FLOOR:opts.h, size=opts.size||Math.min(4096,E.renderer.capabilities.maxTextureSize);
      var t0=performance.now(), g=gpuInit(), R=E.renderer, scene=E.scene;
      var casters=gatherCasters(opts), nbrOn=casters.some(function(m){ return m.userData&&m.userData.neighbor; });
      /* 暫時讓所有擋光者可繪製 */
      var restore=[]; var lgSet=new Set(E.LG);
      casters.forEach(function(m){ m.layers.enable(LAYER); });
      E.LG.forEach(function(o){ if(!o.visible){ restore.push(o); o.visible=true; } });
      var roofM=null; scene.traverse(function(o){ if(o.material===E.M.roof&&!o.visible){ restore.push(o); o.visible=true; } });
      scene.updateMatrixWorld(true);
      var box=new THREE.Box3(); casters.forEach(function(m){ box.expandByObject(m); });
      var corners=[]; for(var a=0;a<8;a++) corners.push(new THREE.Vector3(a&1?box.max.x:box.min.x,a&2?box.max.y:box.min.y,a&4?box.max.z:box.min.z));
      var centre=box.getCenter(new THREE.Vector3()), radius=box.getSize(new THREE.Vector3()).length()/2+1;
      /* 保存 renderer / scene 狀態 */
      var sv={bg:scene.background,fog:scene.fog,ov:scene.overrideMaterial,obr:scene.onBeforeRender,sm:R.shadowMap.enabled,rt:R.getRenderTarget(),auto:R.autoClear};
      scene.background=null; scene.fog=null; scene.overrideMaterial=g.depthMat; scene.onBeforeRender=function(){}; R.shadowMap.enabled=false; R.autoClear=true;
      var lc=new THREE.OrthographicCamera(-1,1,1,-1,0.1,100); lc.layers.set(LAYER);
      var drt=depthTarget(size);
      /* 時間步長 */
      var base=S.jstDate(YEAR,opts.mo,opts.d,0,0), tm=S.sunTimes(S.jstDate(YEAR,opts.mo,opts.d,12,0),ctrl.lat,ctrl.lon,ctrl.tz);
      var rise=tm.sunrise?tm.sunrise.getTime():0, set=tm.sunset?tm.sunset.getTime():0, stepMs=step*60000, jobs=[];
      for(var tt=base.getTime(); tt<base.getTime()+86400000; tt+=stepMs){
        var a0=Math.max(tt,rise,base.getTime()+(opts.tmin||0)*60000), b0=Math.min(tt+stepMs,set,base.getTime()+(opts.tmax==null?1440:opts.tmax)*60000); if(b0<=a0) continue;
        jobs.push({t:(a0+b0)/2,w:(b0-a0)/3600000});
      }
      /* ping-pong 清零 */
      SURF.forEach(function(_,l){ g.acc[l].forEach(function(rt){ R.setRenderTarget(rt); R.setClearColor(0x000000,1); R.clear(); }); });
      var cur=SURF.map(function(){ return 0; }), totalH=0;
      function finish(){
        var res=SURF.map(function(_,l){ var buf=new Float32Array(W*H*4); R.readRenderTargetPixels(g.acc[l][cur[l]],0,0,W,H,buf); var sp=new Float32Array(W*H); for(var i=0;i<sp.length;i++) sp[i]=buf[i*4]; return sp; });
        casters.forEach(function(m){ m.layers.disable(LAYER); });
        restore.forEach(function(o){ o.visible=false; });
        scene.background=sv.bg; scene.fog=sv.fog; scene.overrideMaterial=sv.ov; scene.onBeforeRender=sv.obr; R.shadowMap.enabled=sv.sm; R.autoClear=sv.auto; R.setRenderTarget(sv.rt);
        R.shadowMap.needsUpdate=true;
        return {sub:res,hours:totalH,steps:jobs.length,casters:casters.length,neighbors:nbrOn,ms:performance.now()-t0,opts:{mo:opts.mo,d:opts.d,h:hAbove,furn:!!opts.furn,step:step,size:size}};
      }
      return new Promise(function(resolve,reject){
        var k=0;
        function run(){
          try{
            var tEnd=performance.now()+40;
            while(k<jobs.length&&performance.now()<tEnd){
              var jb=jobs[k++], date=new Date(jb.t), p=S.sunPosition(date,ctrl.lat,ctrl.lon), dir=S.sunDirection(THREE,p.azimuth,p.altitude,NORTH.arrowDeg);
              totalH+=jb.w;
              lc.position.copy(centre).addScaledVector(dir,radius+5); lc.up.set(0,1,0); if(Math.abs(dir.y)>0.999) lc.up.set(1,0,0);
              lc.lookAt(centre); lc.updateMatrixWorld(true);
              var inv=lc.matrixWorldInverse.copy(lc.matrixWorld).invert(), l=1e9,r=-1e9,b=1e9,t=-1e9,n=1e9,f=-1e9, v=new THREE.Vector3();
              corners.forEach(function(c){ v.copy(c).applyMatrix4(inv); l=Math.min(l,v.x); r=Math.max(r,v.x); b=Math.min(b,v.y); t=Math.max(t,v.y); n=Math.min(n,-v.z); f=Math.max(f,-v.z); });
              lc.left=l-0.3; lc.right=r+0.3; lc.bottom=b-0.3; lc.top=t+0.3; lc.near=Math.max(0.01,n-0.5); lc.far=f+0.5; lc.updateProjectionMatrix();
              R.setRenderTarget(drt); R.setClearColor(0xffffff,1); R.clear(); R.render(scene,lc);
              g.quadMat.uniforms.tDepth.value=drt.depthTexture;
              g.quadMat.uniforms.uVP.value.multiplyMatrices(lc.projectionMatrix,lc.matrixWorldInverse);
              var texel=Math.max(lc.right-lc.left,lc.top-lc.bottom)/size, slope=Math.min(12,1/Math.tan(Math.max(p.altitude,1)*Math.PI/180));   // 斜率偏移：低角度時一個深度圖格內的深度差變大
              g.quadMat.uniforms.uW.value=jb.w; g.quadMat.uniforms.uBias.value=(0.008+texel*slope*0.5)/(lc.far-lc.near);
              for(var lv=0;lv<NS;lv++){
                g.quadMat.uniforms.uY.value=SURF[lv].dy()+hAbove; g.quadMat.uniforms.tPrev.value=g.acc[lv][cur[lv]].texture;
                var nx=1-cur[lv]; R.setRenderTarget(g.acc[lv][nx]); R.render(g.quadScene,g.quadCam); cur[lv]=nx;
              }
            }
            if(opts.onProgress) opts.onProgress(k/jobs.length);
            if(k<jobs.length) setTimeout(run,0); else resolve(finish());
          }catch(e){ try{ finish(); }catch(_){} reject(e); }
        }
        setTimeout(run,0);
      });
    }

    /* ---------- 後處理：25 cm 格、各房間統計 ---------- */
    function summarize(res){
      var out={cells:[],rooms:[],GW:GW,GH:GH};
      for(var l=0;l<NS;l++){
        var sp=res.sub[l], idx=roomIdx[l], rs=roomsByLevel[l], cv=new Float32Array(GW*GH).fill(NaN), sum=new Float32Array(GW*GH), cnt=new Uint8Array(GW*GH);
        var rsum=rs.map(function(){ return {s:0,n:0,cs:new Float32Array(GW*GH),cn:new Uint8Array(GW*GH)}; });
        for(var j=0;j<H;j++) for(var i=0;i<W;i++){
          var ri=idx[j*W+i]; if(ri<0) continue;
          var c=((j/SUB)|0)*GW+((i/SUB)|0), v=sp[j*W+i];
          sum[c]+=v; cnt[c]++; var R_=rsum[ri]; R_.s+=v; R_.n++; R_.cs[c]+=v; R_.cn[c]++;
        }
        for(var c2=0;c2<cv.length;c2++) if(cnt[c2]>=SUB*SUB/4) cv[c2]=sum[c2]/cnt[c2];
        out.cells.push(cv);
        rs.forEach(function(r,k){ var q=rsum[k], mx=0, ok=false; for(var c3=0;c3<q.cs.length;c3++) if(q.cn[c3]>=4){ var m=q.cs[c3]/q.cn[c3]; if(m>mx) mx=m; ok=true; }
          out.rooms.push({level:l,name:r.name,kind:r.kind,area:q.n*PX*PX,avg:q.n?q.s/q.n:0,max:ok?mx:0}); });
      }
      return out;
    }

    window.__a2SunMap={compute:compute,summarize:summarize,gatherCasters:gatherCasters,grid:{GX0:GX0,GZ0:GZ0,GW:GW,GH:GH,W:W,H:H,PX:PX,SUB:SUB},roomIdx:roomIdx,rooms:roomsByLevel,
      ramp:function(h){ return ramp(h); }};
    initUI(summarize,compute);

    /* ---------- 色階 ---------- */
    var STOPS=[[0,[47,111,214,150]],[1,[90,200,229,185]],[2,[160,224,122,195]],[4,[255,225,74,205]],[6,[255,154,46,215]],[8,[229,50,45,225]],[10,[120,14,40,235]]];
    function ramp(h){
      if(!(h>=0.04)) return [0,0,0,0];
      if(h>=STOPS[STOPS.length-1][0]) return STOPS[STOPS.length-1][1];
      for(var i=1;i<STOPS.length;i++){ if(h<=STOPS[i][0]){ var a=STOPS[i-1],b=STOPS[i], t=(h-a[0])/(b[0]-a[0]), o=[]; for(var k=0;k<4;k++) o.push(a[1][k]+(b[1][k]-a[1][k])*t); return o; } }
      return [0,0,0,0];
    }

    /* ---------- UI ---------- */
    function initUI(summarize,compute){
      var sheetAnchor=document.getElementById('sunNote');
      var css=document.createElement('style'); css.textContent=
        '#smBox .pr{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}#smBox .pr .tog{min-height:36px;padding:0 6px;font-size:13px}'
        +'#smBox .ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;font-size:13px}#smBox select,#smBox input[type=number]{font:inherit;padding:4px 6px;border-radius:8px;border:1px solid var(--line);background:var(--chip);color:inherit}'
        +'#smBox .go{display:flex;gap:8px;align-items:center;margin:8px 0}#smBox .go .tog{min-height:40px}#smBox .st{font-size:12px;color:var(--muted)}'
        +'#smBox table{border-collapse:collapse;font-size:12px;width:100%;margin:6px 0}#smBox th,#smBox td{border:1px solid #cfc7bb;padding:3px 5px;text-align:center}#smBox td:first-child{text-align:left}'
        +'#smBox .hot{background:#f6c9c2;font-weight:600}#smBox .dim{background:#cfd9ee;font-weight:600}#smBox .tw{overflow-x:auto}'
        +'#smLegend{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:12;background:rgba(255,255,255,.92);color:#2e3842;border-radius:10px;padding:6px 10px 4px;font-size:11.5px;line-height:1.4;box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none;max-width:60vw}'
        +'@media (max-width:760px){#smLegend{bottom:calc(150px + env(safe-area-inset-bottom,0px))}}'
        +'#smLegend canvas{display:block;width:210px;max-width:100%;height:12px;border-radius:3px;border:1px solid #9aa5ad}#smLegend .tk{display:flex;justify-content:space-between;width:210px;max-width:100%;font-variant-numeric:tabular-nums}';
      document.head.appendChild(css);
      var box=document.createElement('div'); box.id='smBox';
      box.innerHTML='<h3>日照熱力圖</h3>'
        +'<p class="help" style="margin-top:4px">計算一天內每個 25 cm 格的地板被太陽直射的累積小時數（日出到日落，每 15 分取樣）。結果疊在「俯瞰」的 1F／2F 平面上。</p>'
        +'<div class="pr"><button type="button" class="tog" data-md="12,22">冬至</button><button type="button" class="tog" data-md="3,20">春分</button><button type="button" class="tog" data-md="6,21">夏至</button><button type="button" class="tog" data-md="9,23">秋分</button></div>'
        +'<div class="ctl"><label>自選 <select data-k="mo"></select> 月 <input data-k="d" type="number" min="1" max="31" value="22" style="width:56px"> 日</label>'
        +'<label>取樣高度 <select data-k="h"><option value="0.05">地板</option><option value="0.45">座面 45 cm</option><option value="0.75">桌面 75 cm</option></select></label></div>'
        +'<div class="ctl"><label><input type="checkbox" data-k="furn"> 計入家具的影子</label><span class="st" data-k="nbr"></span></div>'
        +'<div class="go"><button type="button" class="tog" data-a="calc">計算</button><button type="button" class="tog" data-a="show" aria-pressed="false">顯示熱力圖</button><span class="st" data-k="msg"></span></div>'
        +'<div data-k="out"></div>'
        +'<p class="help">說明：牆、天花、樓板、屋頂與屋簷、外構格柵會擋光，玻璃不擋，庭院樹不算；家具預設不算（可勾選）。鄰棟依上方「鄰棟的影子」開關，鄰棟高度為場景假設，不是實際敷地資料。牆體厚度內的取樣點不計。</p>';
      sheetAnchor.parentNode.insertBefore(box,sheetAnchor);
      var q=function(s){ return box.querySelector(s); }, selMo=q('[data-k=mo]');
      for(var m=1;m<=12;m++){ var op=document.createElement('option'); op.value=m; op.textContent=m; selMo.appendChild(op); }
      selMo.value=12;
      var tN=document.getElementById('tNbr');
      function nbrLabel(){ q('[data-k=nbr]').textContent='鄰棟：'+(tN&&tN.getAttribute('aria-pressed')==='true'?'算（開）':'不算（關）'); }
      nbrLabel(); if(tN) tN.addEventListener('click',function(){ setTimeout(nbrLabel,0); });
      box.querySelectorAll('[data-md]').forEach(function(b){ b.addEventListener('click',function(){ var md=b.getAttribute('data-md').split(','); selMo.value=md[0]; q('[data-k=d]').value=md[1]; }); });

      var cache={}, current=null, planes=[], tex=[], showOn=false, legend=null, busy=false;
      function key(o){ return [o.mo,o.d,o.h,o.furn?1:0,o.nbr?1:0].join('|'); }
      function readOpts(){ return {mo:+selMo.value,d:Math.max(1,Math.min(31,+q('[data-k=d]').value||1)),h:+q('[data-k=h]').value,furn:q('[data-k=furn]').checked,nbr:!!tN&&tN.getAttribute('aria-pressed')==='true'}; }

      function buildPlane(l,cells){
        var data=new Uint8Array(GW*GH*4);
        for(var j=0;j<GH;j++) for(var i=0;i<GW;i++){ var c=ramp(cells[j*GW+i]), o=(j*GW+i)*4; data[o]=c[0]; data[o+1]=c[1]; data[o+2]=c[2]; data[o+3]=isNaN(cells[j*GW+i])?0:c[3]; }
        if(!tex[l]){
          tex[l]=new THREE.DataTexture(data,GW,GH,THREE.RGBAFormat); tex[l].colorSpace=THREE.SRGBColorSpace; tex[l].magFilter=tex[l].minFilter=THREE.NearestFilter; tex[l].generateMipmaps=false; tex[l].needsUpdate=true;
          var y=SURF[l].dy()+0.03, x0=GX0, x1=GX0+GW*CELL, z0=GZ0, z1=GZ0+GH*CELL, geo=new THREE.BufferGeometry();
          geo.setAttribute('position',new THREE.Float32BufferAttribute([x0,y,z0, x1,y,z0, x1,y,z1, x0,y,z1],3));
          geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0, 1,0, 1,1, 0,1],2)); geo.setIndex([0,2,1,0,3,2]);
          var mt=new THREE.MeshBasicMaterial({map:tex[l],transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,fog:false});
          var mesh=new THREE.Mesh(geo,mt); mesh.renderOrder=3; mesh.frustumCulled=false; mesh.userData.keep=true; mesh.castShadow=mesh.receiveShadow=false; mesh.visible=false;
          E.LG[SURF[l].grp].add(mesh); planes[l]=mesh;
        } else { tex[l].image.data.set(data); tex[l].needsUpdate=true; }
      }
      function renderTable(res,sum,o){
        var noon=S.sunPosition(S.jstDate(YEAR,o.mo,o.d,12,0),ctrl.lat,ctrl.lon).altitude, season=noon>=70?'summer':(noon<=40?'winter':'mid');
        var rows='';
        sum.rooms.slice().sort(function(a,b){ var x=SURF[a.level].label, y=SURF[b.level].label; return x===y?0:(x>y?1:-1); }).forEach(function(r){
          if(r.area<0.3) return;
          var flag='', cls='';
          if(r.kind==='outdoor') flag='戶外'; else if(r.kind==='bay') flag='出窗';
          else if(r.kind==='room'){ if(season==='summer'&&r.avg>4){ flag='偏熱'; cls='hot'; } else if(season==='winter'&&r.avg<1){ flag='偏暗'; cls='dim'; } }
          rows+='<tr><td>'+SURF[r.level].label+' '+r.name+'</td><td'+(cls?' class="'+cls+'"':'')+'>'+r.avg.toFixed(1)+'</td><td>'+r.max.toFixed(1)+'</td><td'+(cls?' class="'+cls+'"':'')+'>'+flag+'</td></tr>';
        });
        var tag=season==='summer'?'（夏季：平均 &gt; 4 h 標為偏熱）':(season==='winter'?'（冬季：平均 &lt; 1 h 標為偏暗）':'（春秋分：不標註）');
        q('[data-k=out]').innerHTML='<div class="st">'+o.mo+'/'+o.d+'　日出到日落 '+res.hours.toFixed(1)+' h　'+(o.nbr?'含鄰棟':'不含鄰棟')+'　'+(o.furn?'含家具':'不含家具')+'　取樣高度地板上 '+Math.round(o.h*100)+' cm<br>正午太陽高度 '+noon.toFixed(0)+'°　'+tag+'</div>'
          +'<div class="tw"><table><tr><th>房間</th><th>平均 h</th><th>最大 h</th><th>提示</th></tr>'+rows+'</table></div>';
      }
      function legendEl(){
        if(legend) return legend;
        legend=document.createElement('div'); legend.id='smLegend'; legend.hidden=true;
        legend.innerHTML='<div data-k="t" style="font-weight:700;margin-bottom:3px"></div><canvas width="210" height="12"></canvas><div class="tk"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10 h+</span></div>';
        var c=legend.querySelector('canvas').getContext('2d'), grd=c.createLinearGradient(0,0,210,0);
        for(var h=0;h<=10.01;h+=0.5){ var k=ramp(h<0.04?0.05:h); grd.addColorStop(Math.min(1,h/10),'rgba('+k[0]+','+k[1]+','+k[2]+','+(k[3]/255).toFixed(2)+')'); }
        c.fillStyle='#fff'; c.fillRect(0,0,210,12); c.fillStyle=grd; c.fillRect(0,0,210,12);
        document.getElementById('hud').appendChild(legend); return legend;
      }
      function apply(){
        if(!current) return;
        for(var l=0;l<NS;l++) buildPlane(l,current.sum.cells[l]);
        renderTable(current.res,current.sum,current.o);
        var lg=legendEl(); lg.querySelector('[data-k=t]').textContent='日照時數 '+current.o.mo+'/'+current.o.d+'（h／日）';
        refreshVis();
      }
      function refreshVis(){
        var on=showOn&&!!current, v=E.viewLevel||0, walk=E.mode==='walk';
        for(var l=0;l<NS;l++) if(planes[l]) planes[l].visible=on&&!walk;
        if(legend) legend.hidden=!(on&&!walk&&v>=1&&v<=2);
      }
      var tShow=q('[data-a=show]');
      var ticking=false;
      function tick(){ if(!showOn){ ticking=false; return; } refreshVis(); requestAnimationFrame(tick); }
      function setShow(v){ showOn=v; tShow.setAttribute('aria-pressed',String(v)); refreshVis(); if(v&&!ticking){ ticking=true; requestAnimationFrame(tick); } }
      tShow.addEventListener('click',function(){ setShow(!showOn); });
      document.addEventListener('click',function(e){ if(showOn&&e.target.closest&&e.target.closest('#lv,#bView')) setTimeout(refreshVis,0); },true);

      q('[data-a=calc]').addEventListener('click',function(){
        if(busy) return; var o=readOpts(), k=key(o), msg=q('[data-k=msg]');
        if(cache[k]){ current=cache[k]; apply(); setShow(true); msg.textContent='已使用快取'; return; }
        busy=true; msg.textContent='計算中 0%';
        compute({mo:o.mo,d:o.d,h:o.h,furn:o.furn,onProgress:function(p){ msg.textContent='計算中 '+Math.round(p*100)+'%'; }}).then(function(res){
          var sum=summarize(res); current=cache[k]={res:res,sum:sum,o:o}; busy=false;
          msg.textContent='完成（'+(res.ms/1000).toFixed(1)+' 秒，'+res.steps+' 步）'; apply(); setShow(true);
        }).catch(function(err){ busy=false; msg.textContent='計算失敗：'+(err&&err.message||err); console.warn('sunmap',err); });
      });
      window.__a2SunMap.state=function(){ return {current:current,cache:cache}; };
      window.__a2SunMap.ui={box:box,setShow:setShow};
    }
  }
})();
