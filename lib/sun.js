/* Sun path / daylight module. Plain script, exposes Walk.Sun; three.js is passed in (opts.THREE).
   Scene convention: Y up. `north` is a horizontal scene vector (default -Z); east = north x up (default +X), south = -north.
   Algorithms: NOAA General Solar Position Calculations (Meeus-based, https://gml.noaa.gov/grad/solcalc/calcdetails.html). */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  const D2R=Math.PI/180, R2D=180/Math.PI;
  const DEF={lat:35.57,lon:139.70,tz:9};

  function julian(date){ return date.getTime()/86400000+2440587.5; }
  function solar(date){            // declination, equation of time (min) at an instant
    const T=(julian(date)-2451545)/36525;
    const L0=(280.46646+T*(36000.76983+T*0.0003032))%360;
    const M=357.52911+T*(35999.05029-0.0001537*T), Mr=M*D2R;
    const e=0.016708634-T*(0.000042037+0.0000001267*T);
    const C=Math.sin(Mr)*(1.914602-T*(0.004817+0.000014*T))+Math.sin(2*Mr)*(0.019993-0.000101*T)+Math.sin(3*Mr)*0.000289;
    const trueLong=L0+C, omega=125.04-1934.136*T;
    const lambda=trueLong-0.00569-0.00478*Math.sin(omega*D2R);
    const eps0=23+(26+((21.448-T*(46.815+T*(0.00059-T*0.001813))))/60)/60;
    const eps=eps0+0.00256*Math.cos(omega*D2R);
    const decl=Math.asin(Math.sin(eps*D2R)*Math.sin(lambda*D2R));
    const y=Math.tan(eps*D2R/2)**2, L0r=L0*D2R;
    const eq=4*R2D*(y*Math.sin(2*L0r)-2*e*Math.sin(Mr)+4*e*y*Math.sin(Mr)*Math.cos(2*L0r)-0.5*y*y*Math.sin(4*L0r)-1.25*e*e*Math.sin(2*Mr));
    return {decl:decl,eq:eq};
  }

  /* azimuth: degrees clockwise from true north; altitude: degrees above horizon (with atmospheric refraction). */
  function sunPosition(date,lat,lon){
    lat=lat==null?DEF.lat:lat; lon=lon==null?DEF.lon:lon;
    const s=solar(date);
    const utcMin=date.getUTCHours()*60+date.getUTCMinutes()+date.getUTCSeconds()/60+date.getUTCMilliseconds()/60000;
    let tst=(utcMin+s.eq+4*lon)%1440; if(tst<0) tst+=1440;
    let ha=tst/4-180; if(ha<-180) ha+=360;
    const la=lat*D2R, hr=ha*D2R;
    let cz=Math.sin(la)*Math.sin(s.decl)+Math.cos(la)*Math.cos(s.decl)*Math.cos(hr);
    cz=Math.max(-1,Math.min(1,cz));
    const zen=Math.acos(cz), alt0=90-zen*R2D;
    let az=(Math.PI-Math.acos(Math.max(-1,Math.min(1,(Math.sin(la)*cz-Math.sin(s.decl))/(Math.cos(la)*Math.sin(zen))))))*R2D;   // from north, for ha<0 (morning)
    if(ha>0) az=360-az;
    if(!isFinite(az)) az=180;
    let ref=0;                                          // NOAA refraction correction (arc-seconds -> degrees)
    if(alt0<85){
      const te=Math.tan(alt0*D2R);
      if(alt0>5) ref=(58.1/te-0.07/te**3+0.000086/te**5)/3600;
      else if(alt0>-0.575) ref=(1735+alt0*(-518.2+alt0*(103.4+alt0*(-12.79+alt0*0.711))))/3600;
      else ref=-20.772/te/3600;
    }
    return {azimuth:az,altitude:alt0+ref,altitudeGeometric:alt0};
  }

  /* Local-day sunrise / solar noon / sunset as Date objects (null for polar day/night). tz = hours east of UTC (JST = 9). */
  function sunTimes(date,lat,lon,tz){
    lat=lat==null?DEF.lat:lat; lon=lon==null?DEF.lon:lon; tz=tz==null?DEF.tz:tz;
    const loc=new Date(date.getTime()+tz*3600000);
    const base=Date.UTC(loc.getUTCFullYear(),loc.getUTCMonth(),loc.getUTCDate());   // UTC midnight of the local calendar date
    const at=function(min){ return new Date(base+min*60000); };
    const inDay=function(m){ const lo=-tz*60; while(m<lo) m+=1440; while(m>=lo+1440) m-=1440; return m; };   // fold into the local day
    let noonMin=720-4*lon-solar(at(720-4*lon)).eq;
    noonMin=720-4*lon-solar(at(noonMin)).eq;
    const la=lat*D2R;
    function event(sign){
      let m=noonMin;
      for(let i=0;i<3;i++){
        const d=solar(at(m)).decl;
        const c=(Math.cos(90.833*D2R)/(Math.cos(la)*Math.cos(d)))-Math.tan(la)*Math.tan(d);
        if(c>1||c<-1) return null;
        const ha=Math.acos(c)*R2D;
        m=720-4*(lon+sign*ha)-solar(at(m)).eq;
      }
      return at(inDay(m));
    }
    return {sunrise:event(1),noon:at(inDay(noonMin)),sunset:event(-1)};
  }

  function basis(THREE,north){
    const up=new THREE.Vector3(0,1,0);
    const n=(north||new THREE.Vector3(0,0,-1)).clone(); n.y=0;
    if(n.lengthSq()<1e-9) n.set(0,0,-1);
    n.normalize();
    return {n:n,e:new THREE.Vector3().crossVectors(n,up).normalize(),up:up};
  }
  /* Unit vector from the scene origin TOWARD the sun. `north`: THREE.Vector3 (horizontal part used) or a number = degrees the
     true-north direction is turned clockwise (seen from above) from -Z. */
  function sunDirection(THREE,az,alt,north){
    if(typeof north==='number'){ const r=north*D2R; north=new THREE.Vector3(Math.sin(r),0,-Math.cos(r)); }
    const b=basis(THREE,north), a=az*D2R, h=alt*D2R, ch=Math.cos(h);
    return new THREE.Vector3().addScaledVector(b.e,Math.sin(a)*ch).addScaledVector(b.n,Math.cos(a)*ch).addScaledVector(b.up,Math.sin(h));
  }

  function jstDate(y,mo,d,h,mi,tz){ tz=tz==null?DEF.tz:tz; return new Date(Date.UTC(y,mo-1,d,h-tz,mi||0)); }
  function fmt(date,tz){ tz=tz==null?DEF.tz:tz; if(!date) return '--:--'; const l=new Date(date.getTime()+tz*3600000); return String(l.getUTCHours()).padStart(2,'0')+':'+String(l.getUTCMinutes()).padStart(2,'0'); }
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }

  /* opts: THREE, scene, lat, lon, tz, north (Vector3|degrees), target (Vector3, point the light looks at),
     distance (light–target m), shadow {half, mapSize, near, far, bias, normalBias}, peak (sun intensity at full height),
     ambient (number = create AmbientLight with that max intensity | existing light object), ambientMin, light (reuse a DirectionalLight),
     date (initial Date). */
  function attach(opts){
    const THREE=opts.THREE, lat=opts.lat==null?DEF.lat:opts.lat, lon=opts.lon==null?DEF.lon:opts.lon, tz=opts.tz==null?DEF.tz:opts.tz;
    let north=opts.north==null?new THREE.Vector3(0,0,-1):opts.north;
    const target=(opts.target||new THREE.Vector3()).clone(), dist=opts.distance||80, peak=opts.peak==null?2.6:opts.peak;
    const sh=Object.assign({half:20,mapSize:2048,near:1,far:dist*2.2,bias:-0.0004,normalBias:0.03},opts.shadow||{});
    const own=!opts.light;
    const light=opts.light||new THREE.DirectionalLight(0xffffff,peak);
    light.castShadow=true;
    light.shadow.mapSize.set(sh.mapSize,sh.mapSize);
    const cam=light.shadow.camera; cam.left=-sh.half; cam.right=sh.half; cam.top=sh.half; cam.bottom=-sh.half; cam.near=sh.near; cam.far=sh.far;
    light.shadow.bias=sh.bias; light.shadow.normalBias=sh.normalBias;
    light.target.position.copy(target);
    if(own&&opts.scene){ opts.scene.add(light); }
    if(opts.scene) opts.scene.add(light.target);
    let amb=null, ambOwn=false, ambMax=1;
    if(typeof opts.ambient==='number'){ amb=new THREE.AmbientLight(0xffffff,opts.ambient); ambOwn=true; ambMax=opts.ambient; if(opts.scene) opts.scene.add(amb); }
    else if(opts.ambient){ amb=opts.ambient; ambMax=amb.intensity; }
    const ambMin=opts.ambientMin==null?0.3:opts.ambientMin;
    const warm=new THREE.Color(1.0,0.55,0.28), mid=new THREE.Color(1.0,0.86,0.68), day=new THREE.Color(1.0,0.97,0.92);
    const ctrl={
      light:light, ambient:amb, date:opts.date||jstDate(2026,12,22,12,0,tz), lat:lat, lon:lon, tz:tz, onChange:null, state:null,
      get north(){ return north; },
      setNorth:function(n){ north=n; return ctrl.update(); },
      setDateTime:function(d){ ctrl.date=d; return ctrl.update(); },
      setTarget:function(v){ target.copy(v); light.target.position.copy(v); return ctrl.update(); },
      times:function(){ return sunTimes(ctrl.date,lat,lon,tz); },
      update:function(){
        const p=sunPosition(ctrl.date,lat,lon), alt=p.altitude;
        const dir=sunDirection(THREE,p.azimuth,alt,north);
        light.position.copy(target).addScaledVector(dir,dist);
        const k=clamp((alt+0.5)/10,0,1), f=k*k*(3-2*k);      // smooth fade-in over the first ~10 deg
        light.intensity=peak*f*(0.55+0.45*clamp(alt/35,0,1));
        light.visible=alt>0;                                  // off when the sun is below the horizon
        light.castShadow=alt>0;
        if(alt<8) light.color.copy(warm).lerp(mid,clamp(alt/4,0,1)); else light.color.copy(mid).lerp(day,clamp((alt-8)/14,0,1));
        if(amb){ amb.intensity=ambMin*ambMax+(ambMax-ambMin*ambMax)*clamp((alt+6)/30,0,1); }
        ctrl.state={azimuth:p.azimuth,altitude:alt,direction:dir,intensity:light.intensity,times:sunTimes(ctrl.date,lat,lon,tz)};
        if(ctrl.onChange) ctrl.onChange(ctrl.state);
        return ctrl.state;
      },
      dispose:function(){
        if(light.parent&&own) light.parent.remove(light);
        if(light.target.parent) light.target.parent.remove(light.target);
        if(amb&&ambOwn&&amb.parent) amb.parent.remove(amb);
        if(light.shadow.map) light.shadow.map.dispose();
        if(own&&light.dispose) light.dispose();
        ctrl.onChange=null;
      }
    };
    ctrl.update();
    return ctrl;
  }

  /* UI panel injected into `host` (default document.body). ctrl: object from attach(). Returns {el, destroy, refresh}. */
  function initUI(host,ctrl,uiOpts){
    uiOpts=uiOpts||{};
    host=host||document.body;
    const year=uiOpts.year||ctrl.date.getUTCFullYear();
    if(!document.getElementById('walk-sun-css')){
      const st=document.createElement('style'); st.id='walk-sun-css';
      st.textContent='.wsun{position:fixed;right:12px;bottom:12px;z-index:30;width:260px;padding:10px 12px;border-radius:12px;background:rgba(30,26,22,.82);color:#f3ece2;font:12px/1.5 -apple-system,"PingFang TC","Hiragino Sans",sans-serif;backdrop-filter:blur(8px);box-shadow:0 4px 18px rgba(0,0,0,.35)}'
        +'.wsun h4{margin:0 0 6px;font-size:13px;font-weight:600}.wsun label{display:flex;align-items:center;gap:6px;margin:3px 0}.wsun label span:first-child{width:34px;opacity:.8}.wsun input[type=range]{flex:1;min-width:0}'
        +'.wsun .b{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.wsun button{border:0;border-radius:8px;padding:4px 8px;background:rgba(255,255,255,.14);color:inherit;font:inherit;cursor:pointer}.wsun button:hover{background:rgba(255,255,255,.26)}'
        +'.wsun .i{margin-top:4px;opacity:.92;font-variant-numeric:tabular-nums}';
      document.head.appendChild(st);
    }
    const el=document.createElement('div'); el.className='wsun';
    el.innerHTML='<h4>日照模擬</h4>'
      +'<label><span>月</span><input type="range" data-k="mo" min="1" max="12" step="1"><span data-v="mo"></span></label>'
      +'<label><span>日</span><input type="range" data-k="d" min="1" max="31" step="1"><span data-v="d"></span></label>'
      +'<label><span>時間</span><input type="range" data-k="t" min="300" max="1140" step="1"><span data-v="t"></span></label>'
      +'<div class="b"><button data-p="winter">冬至</button><button data-p="summer">夏至</button><button data-p="equinox">春分・秋分</button><button data-p="now">現在</button><button data-p="play">▶ 一日播放</button></div>'
      +'<div class="i" data-i="pos"></div><div class="i" data-i="tm"></div>';
    host.appendChild(el);
    const q=function(s){ return el.querySelector(s); };
    const inp={mo:q('[data-k=mo]'),d:q('[data-k=d]'),t:q('[data-k=t]')};
    let timer=0, busy=false;
    function dim(y,m){ return new Date(Date.UTC(y,m,0)).getUTCDate(); }
    function apply(){
      if(busy) return;
      const mo=+inp.mo.value; inp.d.max=dim(year,mo); const d=Math.min(+inp.d.value,dim(year,mo)); inp.d.value=d;
      const t=+inp.t.value;
      ctrl.setDateTime(jstDate(year,mo,d,Math.floor(t/60),t%60,ctrl.tz));
    }
    function show(){
      const s=ctrl.state, l=new Date(ctrl.date.getTime()+ctrl.tz*3600000);
      busy=true;
      inp.mo.value=l.getUTCMonth()+1; inp.d.max=dim(year,l.getUTCMonth()+1); inp.d.value=l.getUTCDate(); inp.t.value=l.getUTCHours()*60+l.getUTCMinutes();
      busy=false;
      q('[data-v=mo]').textContent=inp.mo.value+'月'; q('[data-v=d]').textContent=inp.d.value+'日'; q('[data-v=t]').textContent=fmt(ctrl.date,ctrl.tz);
      q('[data-i=pos]').textContent='高度 '+s.altitude.toFixed(1)+'°　方位 '+s.azimuth.toFixed(1)+'° (北=0, 東=90)';
      q('[data-i=tm]').textContent='日出 '+fmt(s.times.sunrise,ctrl.tz)+'　南中 '+fmt(s.times.noon,ctrl.tz)+'　日落 '+fmt(s.times.sunset,ctrl.tz);
    }
    function stop(){ if(timer){ clearInterval(timer); timer=0; q('[data-p=play]').textContent='▶ 一日播放'; } }
    function set(mo,d,h,mi){ stop(); ctrl.setDateTime(jstDate(year,mo,d,h,mi,ctrl.tz)); }
    ['mo','d','t'].forEach(function(k){ inp[k].addEventListener('input',function(){ stop(); apply(); }); });
    el.addEventListener('click',function(e){
      const p=e.target.getAttribute&&e.target.getAttribute('data-p'); if(!p) return;
      if(p==='winter') set(12,22,12,0); else if(p==='summer') set(6,21,12,0);
      else if(p==='equinox'){ const l=new Date(ctrl.date.getTime()+ctrl.tz*3600000); set(l.getUTCMonth()+1>=7?9:3,l.getUTCMonth()+1>=7?23:20,12,0); }
      else if(p==='now'){ stop(); ctrl.setDateTime(new Date()); }
      else if(p==='play'){
        if(timer){ stop(); return; }
        q('[data-p=play]').textContent='❚❚ 停止';
        let t=300; const l=new Date(ctrl.date.getTime()+ctrl.tz*3600000);
        timer=setInterval(function(){ t+=6; if(t>1140) t=300; ctrl.setDateTime(jstDate(l.getUTCFullYear(),l.getUTCMonth()+1,l.getUTCDate(),Math.floor(t/60),t%60,ctrl.tz)); },50);
      }
    });
    const prev=ctrl.onChange;
    ctrl.onChange=function(s){ if(prev) prev(s); show(); };
    show();
    return {el:el,refresh:show,destroy:function(){ stop(); ctrl.onChange=prev||null; el.remove(); }};
  }

  Walk.Sun={sunPosition:sunPosition,sunTimes:sunTimes,sunDirection:sunDirection,attach:attach,initUI:initUI,jstDate:jstDate,fmt:fmt,DEFAULTS:DEF};
})(typeof window!=='undefined'?window:globalThis);
