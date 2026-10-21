/* Walkthrough engine for the multi-storey houses (town house, ideal house): renderer and materials, walls / doors / stairs, furniture,
   lighting, navigation, HUD, life-mode helpers and performance. A house page passes its three.js modules (T) and a description of the
   house (H): plan units, rooms, build / stair / site / fixtures / lighting / modes callbacks and view settings; see ideal.html. */
(function(root){
  const Walk=root.Walk=root.Walk||{};
  Walk.Storeys=function(T,H){
const THREE=T.THREE, EffectComposer=T.EffectComposer, RenderPass=T.RenderPass, GTAOPass=T.GTAOPass, OutputPass=T.OutputPass,
      HDRLoader=T.HDRLoader, mergeGeometries=T.mergeGeometries, KTX2Loader=T.KTX2Loader;
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var loadEl=$('load'), msgEl=$('msg'), errEl=$('err');
function showMsg(t){ loadEl.hidden=true; msgEl.textContent=t; msgEl.hidden=false; }
var errShown=false;
function showErr(t){ if(errShown) return; errShown=true; errEl.textContent='發生錯誤：'+t+'（點一下關閉）'; errEl.hidden=false; }
errEl.addEventListener('click',function(){ errEl.hidden=true; });
window.addEventListener('error',function(e){ showErr(e.message||'未知錯誤'); });
try{ main(); }catch(e){ console.error(e); showMsg('場景建立失敗：'+(e&&e.message?e.message:e)); }

function main(){
/* E: the engine as seen from the house description (live getters; lets also have setters) */
const E={
  get $(){ return $; },
  get stairGuard(){ return stairGuard; },
  get SX(){ return SX; },
  get SZ(){ return SZ; },
  get S(){ return S; },
  get SH(){ return SH; },
  get CH(){ return CH; },
  get SLAB(){ return SLAB; },
  get TAU(){ return TAU; },
  get LV(){ return LV; },
  get clamp(){ return clamp; },
  get base(){ return base; },
  get WX(){ return WX; },
  get WZ(){ return WZ; },
  get seed(){ return seed; }, set seed(v){ seed=v; },
  get rnd(){ return rnd; },
  get renderer(){ return renderer; }, set renderer(v){ renderer=v; },
  get pixelRatio(){ return pixelRatio; }, set pixelRatio(v){ pixelRatio=v; },
  get ANISO(){ return ANISO; },
  get scene(){ return scene; },
  get camera(){ return camera; },
  get post(){ return post; },
  get LI(){ return LI; },
  get PLI(){ return PLI; },
  get amb(){ return amb; },
  get hemi(){ return hemi; },
  get fills(){ return fills; },
  get sun(){ return sun; },
  get SB(){ return SB; },
  get CEN(){ return CEN; },
  get lam(){ return lam; },
  get noiseTex(){ return noiseTex; },
  get wallTex(){ return wallTex; },
  get fabricTex(){ return fabricTex; },
  get makeWood(){ return makeWood; },
  get tileTex(){ return tileTex; },
  get woodTex(){ return woodTex; },
  get FL(){ return FL; },
  get fabMats(){ return fabMats; },
  get fab(){ return fab; },
  get M(){ return M; },
  get lampMat(){ return lampMat; },
  get WM(){ return WM; },
  get ktx2(){ return ktx2; }, set ktx2(v){ ktx2=v; },
  get FIN(){ return FIN; },
  get LG(){ return LG; },
  get ground(){ return ground; },
  get walls(){ return walls; },
  get doors(){ return doors; },
  get furnCols(){ return furnCols; },
  get floorRects(){ return floorRects; },
  get ramps(){ return ramps; },
  get furnMeshes(){ return furnMeshes; },
  get pointLights(){ return pointLights; },
  get curLayout(){ return curLayout; }, set curLayout(v){ curLayout=v; },
  get furnOn(){ return furnOn; }, set furnOn(v){ furnOn=v; },
  get shadowOn(){ return shadowOn; }, set shadowOn(v){ shadowOn=v; },
  get sleepOn(){ return sleepOn; }, set sleepOn(v){ sleepOn=v; },
  get dailyOn(){ return dailyOn; }, set dailyOn(v){ dailyOn=v; },
  get cookOn(){ return cookOn; }, set cookOn(v){ cookOn=v; },
  get sportOn(){ return sportOn; }, set sportOn(v){ sportOn=v; },
  get bbqOn(){ return bbqOn; }, set bbqOn(v){ bbqOn=v; },
  get railGroups(){ return railGroups; },
  get flightZ(){ return flightZ; },
  get FS_onChange(){ return FS_onChange; }, set FS_onChange(v){ FS_onChange=v; },
  get fitUV(){ return fitUV; },
  get bx(){ return bx; },
  get rbox(){ return rbox; },
  get cylm(){ return cylm; },
  get framedMirror(){ return framedMirror; },
  get notchPull(){ return notchPull; },
  get contactShadow(){ return contactShadow; },
  get slab(){ return slab; },
  get flr(){ return flr; },
  get ceilingOf(){ return ceilingOf; },
  get addCol(){ return addCol; },
  get winFrame(){ return winFrame; },
  get wall(){ return wall; },
  get makeDoor(){ return makeDoor; },
  get makeSlide(){ return makeSlide; },
  get applyDoor(){ return applyDoor; },
  get ROOMS(){ return ROOMS; },
  get OUT(){ return OUT; },
  get ACCENTS(){ return ACCENTS; },
  get wallRoleAt(){ return wallRoleAt; },
  get TE(){ return TE; },
  get TI(){ return TI; },
  get ldkFloors(){ return ldkFloors; },
  get ST(){ return ST; },
  get flight(){ return flight; },
  get stringer(){ return stringer; },
  get footLights(){ return footLights; },
  get RAIL(){ return RAIL; },
  get railBar(){ return railBar; },
  get handrail(){ return handrail; },
  get glassGuard(){ return glassGuard; },
  get rampY(){ return rampY; },
  get floorAt(){ return floorAt; },
  get Catalog(){ return Catalog; },
  get furnG(){ return furnG; },
  get tvList(){ return tvList; },
  get furnThings(){ return furnThings; },
  get furnAnims(){ return furnAnims; },
  get FS(){ return FS; },
  get placeItem(){ return placeItem; },
  get LAYOUT(){ return LAYOUT; },
  get LAY1(){ return LAY1; },
  get LAYOUT2(){ return LAYOUT2; },
  get fixture(){ return fixture; },
  get lightFixtures(){ return lightFixtures; },
  get light(){ return light; },
  get pendant(){ return pendant; },
  get downlight(){ return downlight; },
  get batten(){ return batten; },
  get coveMats(){ return coveMats; },
  get cove(){ return cove; },
  get curtainSets(){ return curtainSets; },
  get roomAt(){ return roomAt; },
  get levelOf(){ return levelOf; },
  get SPOTS(){ return SPOTS; },
  get player(){ return player; },
  get userH(){ return userH; }, set userH(v){ userH=v; },
  get fovH(){ return fovH; }, set fovH(v){ fovH=v; },
  get mode(){ return mode; }, set mode(v){ mode=v; },
  get hour(){ return hour; }, set hour(v){ hour=v; },
  get viewLevel(){ return viewLevel; }, set viewLevel(v){ viewLevel=v; },
  get orb(){ return orb; },
  get R(){ return R; },
  get SPEED(){ return SPEED; },
  get allCols(){ return allCols; }, set allCols(v){ allCols=v; },
  get rebuild(){ return rebuild; },
  get active(){ return active; },
  get resolve(){ return resolve; },
  get setSun(){ return setSun; },
  get applyLevelVis(){ return applyLevelVis; },
  get resize(){ return resize; },
  get setMode(){ return setMode; },
  get updateCamera(){ return updateCamera; },
  get avatar(){ return avatar; },
  get labelGroups(){ return labelGroups; },
  get keys(){ return keys; },
  get joyEl(){ return joyEl; },
  get knob(){ return knob; },
  get joy(){ return joy; },
  get moveJoy(){ return moveJoy; },
  get endJoy(){ return endJoy; },
  get canvas(){ return canvas; },
  get sheet(){ return sheet; },
  get ptrs(){ return ptrs; },
  get pinch0(){ return pinch0; }, set pinch0(v){ pinch0=v; },
  get tmove(){ return tmove; }, set tmove(v){ tmove=v; },
  get pdist(){ return pdist; },
  get look(){ return look; },
  get setStick(){ return setStick; },
  get releaseStick(){ return releaseStick; },
  get upPtr(){ return upPtr; },
  get toastEl(){ return toastEl; },
  get bAct(){ return bAct; },
  get toastT(){ return toastT; }, set toastT(v){ toastT=v; },
  get curThing(){ return curThing; }, set curThing(v){ curThing=v; },
  get toast(){ return toast; },
  get fmtHour(){ return fmtHour; },
  get roofMesh(){ return roofMesh; }, set roofMesh(v){ roofMesh=v; },
  get roofOn(){ return roofOn; },
  get setDoor(){ return setDoor; },
  get things(){ return things; },
  get updateAct(){ return updateAct; },
  get actNow(){ return actNow; },
  get updateDoors(){ return updateDoors; },
  get teleport(){ return teleport; },
  get mini(){ return mini; },
  get mg(){ return mg; },
  get MS(){ return MS; },
  get MX0(){ return MX0; },
  get MZ0(){ return MZ0; },
  get KC(){ return KC; },
  get miniBg(){ return miniBg; },
  get mbg(){ return mbg; },
  get miniKey(){ return miniKey; }, set miniKey(v){ miniKey=v; },
  get miniAge(){ return miniAge; }, set miniAge(v){ miniAge=v; },
  get drawMini(){ return drawMini; },
  get rn(){ return rn; },
  get rs(){ return rs; },
  get curRoom(){ return curRoom; }, set curRoom(v){ curRoom=v; },
  get curLvl(){ return curLvl; }, set curLvl(v){ curLvl=v; },
  get updateRoom(){ return updateRoom; },
  get ray(){ return ray; },
  get updateDist(){ return updateDist; },
  get stepPlayer(){ return stepPlayer; },
  get last(){ return last; }, set last(v){ last=v; },
  get frame(){ return frame; }, set frame(v){ frame=v; },
  get first(){ return first; }, set first(v){ first=v; },
  get perf(){ return perf; }, set perf(v){ perf=v; },
  get lightT(){ return lightT; }, set lightT(v){ lightT=v; },
  get lightAt(){ return lightAt; }, set lightAt(v){ lightAt=v; },
  get walkLevels(){ return walkLevels; },
  get SZN(){ return SZN; },
  get stairBox(){ return stairBox; },
  get camFr(){ return camFr; },
  get camMat(){ return camMat; },
  get tick(){ return tick; },
  get People(){ return People; },
  get S1(){ return S1; },
  get modeAnims(){ return modeAnims; },
  get modeGroup(){ return modeGroup; },
  get mover(){ return mover; },
  get usable(){ return usable; },
  get at(){ return at; },
  get btn(){ return btn; },
  get setTv(){ return setTv; },
  get liftId(){ return liftId; },
  get syncFold(){ return syncFold; },
  get setLayout(){ return setLayout; },
  get btn2(){ return btn2; },
  get FSU(){ return FSU; }
};
/* ---------- units: plan unit -> metres, storey height, ceiling height ---------- */
const SX=H.SX, SZ=H.SZ, S=H.SX, SH=H.SH||2.7, CH=H.CH||2.5, SLAB=0.2, TAU=Math.PI*2;
const LV=H.LV;
const clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
const base=function(l){ return l*SH; };
const WX=function(l,px){ return (px-LV[l].ox)*SX; }, WZ=function(l,py){ return (py-LV[l].oy)*SZ; };
let seed=7311;
function rnd(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }

let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:(window.devicePixelRatio||1)<1.5,powerPreference:'high-performance'}); }   // sharp Retina screens need no MSAA
catch(e){ showMsg('這個瀏覽器無法啟動 3D 繪圖（WebGL）。請改用 Safari 或 Chrome 開啟。'); return; }
let pixelRatio=Math.min(window.devicePixelRatio||1,1.75);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap; renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=true;
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
const ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1);
const loadStatus=Walk.Perf.LoadStatus(); loadStatus.set('建立房子',0.1);

const scene=new THREE.Scene();
(function(){
  const c=document.createElement('canvas'); c.width=4; c.height=256; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#78aee0'); gr.addColorStop(0.55,'#b9d8ef'); gr.addColorStop(1,'#e9f1f7');
  g.fillStyle=gr; g.fillRect(0,0,4,256);
  const t=new THREE.CanvasTexture(c); t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; t.generateMipmaps=false; t.colorSpace=THREE.SRGBColorSpace; scene.background=t;
})();
(function(){
  const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,64); gr.addColorStop(0,'#9cc4e6'); gr.addColorStop(0.48,'#f2efe8'); gr.addColorStop(0.55,'#c2b49d'); gr.addColorStop(1,'#6f6456');
  g.fillStyle=gr; g.fillRect(0,0,128,64);
  const t=new THREE.CanvasTexture(c); t.mapping=THREE.EquirectangularReflectionMapping; t.colorSpace=THREE.SRGBColorSpace;
  const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
})();
scene.fog=new THREE.Fog(0xdde9f3,60,300);
const camera=new THREE.PerspectiveCamera(70,1,0.05,600); camera.rotation.order='YXZ'; scene.add(camera);
const post=Walk.Look({THREE:THREE,renderer:renderer,scene:scene,camera:camera,EffectComposer:EffectComposer,RenderPass:RenderPass,GTAOPass:GTAOPass,OutputPass:OutputPass,HDRLoader:HDRLoader,UnrealBloomPass:T.UnrealBloomPass,ShaderPass:T.ShaderPass,SMAAPass:T.SMAAPass,envUrl:'textures/env_lebombo_512.hdr',aoWhen:function(){ return mode==='walk'; }});

const LI=Math.PI, PLI=5;                       // light units since three.js r155: ambient/directional x pi, ceiling point lights also lose the legacy falloff
const amb=new THREE.AmbientLight(0xffffff,0.6*LI); scene.add(amb);
const hemi=new THREE.HemisphereLight(0xeaf4ff,0xcfc4b0,0.45*LI); scene.add(hemi);
const fills=[[0.3,6,9,-7],[0.25,-7,6,8]].map(function(f){ const d=new THREE.DirectionalLight(0xffffff,f[0]*LI); d.position.set(f[1],f[2],f[3]); d.userData.i0=f[0]*LI; scene.add(d); return d; });
const sun=new THREE.DirectionalLight(0xfff1dc,1.1*LI);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
const SB=H.sunBox||12;
sun.shadow.camera.left=-SB; sun.shadow.camera.right=SB; sun.shadow.camera.top=SB; sun.shadow.camera.bottom=-SB; sun.shadow.camera.near=1; sun.shadow.camera.far=120;
sun.shadow.bias=-0.0005; sun.shadow.normalBias=0.03; sun.shadow.radius=3;
scene.add(sun); scene.add(sun.target);
const CEN=new THREE.Vector3(H.center[0],H.center[1],H.center[2]); sun.target.position.copy(CEN);

/* ---------- materials ---------- */
function lam(c,o){
  const m=new THREE.MeshStandardMaterial(Object.assign({roughness:0.85,metalness:0,envMapIntensity:0.45},o||{}));
  m.color.setHex(c);
  return m;
}
function noiseTex(size,base0,amp,streak){
  const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  const img=g.createImageData(size,size), d=img.data;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    let v=base0+(rnd()-0.5)*amp; if(streak) v+=Math.sin(x*0.9+rnd()*0.4)*amp*0.15;
    const i=(y*size+x)*4; d[i]=d[i+1]=d[i+2]=clamp(Math.round(v),0,255); d[i+3]=255;
  }
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO; return t;
}
const wallTex=noiseTex(256,247,10,true); wallTex.colorSpace=THREE.SRGBColorSpace;
const fabricTex=noiseTex(128,128,90,false);
function makeWood(){
  const c=document.createElement('canvas'); c.width=1024; c.height=512; const g=c.getContext('2d');
  const rows=3, rh=512/rows, offs=[0,0.38,0.73];
  const bs=function(){ return 'hsl('+(31+rnd()*6)+','+(32+rnd()*8)+'%,'+(68+rnd()*8)+'%)'; };
  for(let r=0;r<rows;r++){
    const y=r*rh, o=Math.floor(offs[r]*1024);
    g.fillStyle=bs(); g.fillRect(o,y,1024-o,rh); g.fillStyle=bs(); g.fillRect(0,y,o,rh);
    for(let k=0;k<70;k++){ g.strokeStyle='rgba(90,60,30,'+(0.03+rnd()*0.05)+')'; g.lineWidth=1; const yy=y+rnd()*rh, x0=rnd()*1024; g.beginPath(); g.moveTo(x0,yy); g.lineTo(x0+60+rnd()*240,yy+(rnd()-0.5)*2); g.stroke(); }
    g.fillStyle='rgba(70,45,20,.5)'; g.fillRect(0,y,1024,2); g.fillRect(o,y,2,rh); g.fillRect(0,y,2,rh);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO; t.colorSpace=THREE.SRGBColorSpace; return t;
}
function tileTex(base0,grout,n,jit){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  g.fillStyle=grout; g.fillRect(0,0,256,256); const s=256/n;
  for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const v=(rnd()-0.5)*jit; g.fillStyle='rgb('+Math.round(clamp(base0[0]+v,0,255))+','+Math.round(clamp(base0[1]+v,0,255))+','+Math.round(clamp(base0[2]+v,0,255))+')'; g.fillRect(i*s+2,j*s+2,s-4,s-4); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO; t.colorSpace=THREE.SRGBColorSpace; return t;
}
const woodTex=makeWood();
const FL={
  wood:lam(0xe0c9a6,{map:woodTex,roughness:0.5}), woodD:lam(0xc9b08c,{map:woodTex,roughness:0.6}),
  tile:lam(0xffffff,{map:tileTex([226,230,230],'#b4bfc5',4,8),roughness:0.35}),
  stone:lam(0xffffff,{map:tileTex([154,154,150],'#7f7f7b',2,22),roughness:0.7}),
  conc:lam(0xa9a9a5,{roughness:0.9}), balc:lam(0xffffff,{map:tileTex([165,168,166],'#8a8d8b',2,18)}), wc:lam(0xd4d4d0,{roughness:0.5})
};
FL.bath=lam(0xe9e6e0,{roughness:0.5}); FL.bath.userData.uvUnit=[1,1];
[FL.tile,FL.stone,FL.conc,FL.balc,FL.wc].forEach(function(m){ m.userData.uvUnit=[1,1]; });   // tiles and concrete: 1 m per uv unit (wood: one 1.818 x 0.909 m plank board)
const fabMats=[];
const fab=function(c,o){ const m=Walk.fabricMaterial(THREE,c,Object.assign({bumpMap:fabricTex,bumpScale:0.004},o||{})); fabMats.push(m); return m; };
const M={
  ceil:lam(0xf5f0e6,{emissive:0x2b2720}), slab:lam(0xc7c4bd), trim:lam(0xfbfaf7,{roughness:0.5}), frame:lam(0xf1efea,{roughness:0.5}),
  dark:lam(0x2a2d32), black:lam(0x16181b,{roughness:0.4}), steel:lam(0x8d949c,{metalness:0.9,roughness:0.25,envMapIntensity:1}),
  door:lam(0xe4d2b4,{roughness:0.55}), top:lam(0xc4c6c8,{roughness:0.35}), sink:lam(0xaab2ba,{metalness:0.8,roughness:0.3,envMapIntensity:1}),
  ceramic:lam(0xf7f7f4,{roughness:0.18,envMapIntensity:0.8}), cab:lam(0xe9e5dc,{roughness:0.5}), cabF:lam(0xf4f1ea,{roughness:0.4}),
  glass:lam(0xcfe8f6,{transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false,roughness:0.05,metalness:0.1,envMapIntensity:1}),
  railGlass:lam(0xbcd6cc,{transparent:true,opacity:0.24,side:THREE.DoubleSide,depthWrite:false,roughness:0.05,envMapIntensity:1}),
  sofa:fab(0x7f90a5), sofaD:fab(0x6b7b8f), bedA:fab(0xe9eef3), bedB:fab(0xb8c4d2), pillow:fab(0xffffff), cushA:fab(0xc9b27f), cushB:fab(0x5f6f82),
  leaf:lam(0x4f7a46), leafL:lam(0x6f9a5b), pot:lam(0xb8aa98,{roughness:0.7}), tv:lam(0x15171a,{roughness:0.2,metalness:0.3}),
  fridge:lam(0xe6e9ec,{roughness:0.35,metalness:0.2}), hob:lam(0x14171a,{roughness:0.1,metalness:0.3,envMapIntensity:0.9}),
  shade:lam(0xf2d9a6,{emissive:0x8a6428,side:THREE.DoubleSide,roughness:0.9}), roof:lam(0x6e6b66,{roughness:0.8}),
  ext:lam(0xe9e4da,{roughness:0.9}), asphalt:lam(0x55585c,{roughness:0.95}), grass:lam(0x9bb27f,{roughness:1}), car:lam(0xb9c2cc,{roughness:0.3,metalness:0.5,envMapIntensity:1})
};
(function(){
  const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d');
  g.fillStyle='#ffffff'; g.fillRect(0,0,512,256);
  for(let k=0;k<520;k++){ g.strokeStyle='rgba('+(70+rnd()*30)+','+(45+rnd()*20)+',25,'+(0.025+rnd()*0.06)+')'; g.lineWidth=0.6+rnd()*1.2; const y=rnd()*256, x=rnd()*512, l=60+rnd()*260; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+l*0.3,y+(rnd()-0.5)*5,x+l*0.7,y+(rnd()-0.5)*5,x+l,y+(rnd()-0.5)*3); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO; t.colorSpace=THREE.SRGBColorSpace;
  M.oak=lam(0xd6b88e,{map:t,roughness:0.55}); M.oakD=lam(0x8f6a49,{map:t,roughness:0.55}); M.oakChair=lam(0xcfa77c,{map:t,roughness:0.55}); M.chairBack=lam(0xc9a074,{roughness:0.55,side:THREE.DoubleSide});
})();
const lampMat=new THREE.MeshBasicMaterial({color:0xffdc96});
M.entry=lam(0x3f444a,{metalness:0.4,roughness:0.45});
M.linen=fab(0xe9dfcd,{side:THREE.DoubleSide,bumpScale:0.002});
M.bathWall=lam(0xf1eee9,{roughness:0.3}); M.wcTile=lam(0xf1ede6,{roughness:0.3});
M.frost=lam(0xeef2f3,{transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false,roughness:0.9}); M.mesh=lam(0x3a3d42,{transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false,roughness:0.9}); M.footLed=new THREE.MeshBasicMaterial({color:0xffe2b0});
const WM={};                                   // one wall material per colour role (see Walk.THEMES)
Walk.WALL_ROLES.forEach(function(k){ WM[k]=lam(0xffffff,{map:wallTex,bumpMap:wallTex,bumpScale:0.0015,roughness:0.9}); });
let ktx2=null; try{ ktx2=new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/basis/').detectSupport(renderer); }catch(_){}
const FIN=Walk.Finish({THREE:THREE,anisotropy:ANISO,FL:FL,M:M,WM:WM,fabMats:fabMats,ktx2:ktx2,onProgress:function(d,t){ loadStatus.tex(d,t); }});
FIN.mapMat(FL.tile,'bathtile',1.8,true); FIN.mapMat(FL.stone,'genkantile',2.0,true); FIN.mapMat(FL.balc,'balctile',2.4);
FIN.mapMat(FL.conc,'corrconc',2.0); FIN.paint(FL.conc,0xc9c7c2); FIN.mapMat(FL.wc,'balctile',2.4); FIN.paint(FL.wc,0xe8e8e6);
FIN.mapMat(M.top,'counter',1.2,true); FIN.mapMat(M.bathWall,'bathwall_lg',2.4,true); FIN.mapMat(FL.bath,'bathfloor_lg',1.8,true);   // large-format porcelain: 120 x 60 cm walls, 90 x 90 cm floor FIN.mapMat(M.wcTile,'wttoilet',1.6,true);
FIN.loadCommon();
FIN.applyPalette(Walk.THEMES.A);                // warm Scandinavian only for this house
if(H.materials) H.materials(E);

/* ---------- level groups, colliders, helpers ---------- */
const LG=[0,1,2].map(function(){ const g=new THREE.Group(); scene.add(g); return g; });
const ground=new THREE.Group(); scene.add(ground);
const walls=[], doors=[], slidePending=[], furnCols=[], floorRects=[], ramps=[], furnMeshes=[], pointLights=[];
let curLayout=1, furnOn=true, shadowOn=true, sleepOn=false, dailyOn=false, cookOn=false, sportOn=false, bbqOn=false, FS_onChange=function(){};
function fitUV(g,w,h,d){ const uv=g.attributes.uv, dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]]; for(let f=0;f<6;f++){ const s=dims[f]; for(let i=f*4;i<f*4+4;i++) uv.setXY(i,uv.getX(i)*s[0],uv.getY(i)*s[1]); } }
function bx(grp,x0,x1,z0,z1,y0,y1,mat,o){
  o=o||{}; const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0); fitUV(g,x1-x0,y1-y0,z1-z0);
  const m=new THREE.Mesh(g,mat); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  m.castShadow=o.cast!==false; m.receiveShadow=o.recv!==false; grp.add(m); return m;
}
function rbox(grp,x0,x1,z0,z1,y0,y1,r,mat){
  const w=x1-x0, d=z1-z0, h=y1-y0, bv=Math.min(r,h/2-0.002), sw=w-2*bv, sd=d-2*bv, rc=Math.min(r,sw/2,sd/2);
  const s=new THREE.Shape();
  s.moveTo(-sw/2+rc,-sd/2); s.lineTo(sw/2-rc,-sd/2); s.quadraticCurveTo(sw/2,-sd/2,sw/2,-sd/2+rc);
  s.lineTo(sw/2,sd/2-rc); s.quadraticCurveTo(sw/2,sd/2,sw/2-rc,sd/2); s.lineTo(-sw/2+rc,sd/2); s.quadraticCurveTo(-sw/2,sd/2,-sw/2,sd/2-rc);
  s.lineTo(-sw/2,-sd/2+rc); s.quadraticCurveTo(-sw/2,-sd/2,-sw/2+rc,-sd/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:h-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelSegments:3,curveSegments:5});
  const m=new THREE.Mesh(g,mat); m.rotation.x=-Math.PI/2; m.position.set((x0+x1)/2,y0+bv,(z0+z1)/2); m.castShadow=m.receiveShadow=true; grp.add(m); return m;
}
function cylm(grp,cx,cz,r0,r1,y0,y1,mat,seg){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,y1-y0,seg||20),mat); m.position.set(cx,(y0+y1)/2,cz); m.castShadow=m.receiveShadow=true; grp.add(m); return m; }
function framedMirror(grp,cx,cy,cz,w,h,rotY,frame){   // a mirror inset in a slim frame (2 cm face, 1.5 cm deep), back on the wall plane; local +z out of the wall
  const G=new THREE.Group(); G.position.set(cx,cy,cz); G.rotation.y=rotY||0; grp.add(G); const f=0.02, d=0.015;
  [[-w/2-f,w/2+f,h/2,h/2+f],[-w/2-f,w/2+f,-h/2-f,-h/2],[-w/2-f,-w/2,-h/2,h/2],[w/2,w/2+f,-h/2,h/2]].forEach(function(r){ bx(G,r[0],r[1],0,d,r[2],r[3],frame); });
  bx(G,-w/2,w/2,0,d-0.004,-h/2,h/2,lam(0xdfe8ec,{metalness:1,roughness:0.04,envMapIntensity:1.2}),{cast:false}); return G; }
const notchMats={};
function notchPull(col,W){                       // finger-pull notch cut into a front's edge (IKEA ALEX style): edge along x at y=0, recess toward -y, front +z
  W=W||0.18; const s=Math.min(1,W/0.18), Wi=W*13/18, D=0.025*s, G=new THREE.Group();
  const mk=function(c,o){ const k=c+'_'+o; if(!notchMats[k]) notchMats[k]=lam(c,{roughness:0.6,polygonOffset:true,polygonOffsetFactor:o,polygonOffsetUnits:o}); return notchMats[k]; };
  const tz=function(a,b,dd,c,o,z){ const sh=new THREE.Shape([new THREE.Vector2(-a/2,0),new THREE.Vector2(a/2,0),new THREE.Vector2(b/2,-dd),new THREE.Vector2(-b/2,-dd)]); const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),mk(c,o)); m.position.z=z; m.receiveShadow=true; G.add(m); };
  const c0=new THREE.Color(col), light=c0.r*0.3+c0.g*0.55+c0.b*0.15>0.72, shade=c0.clone().multiplyScalar(light?0.9:0.8).getHex(), inner=light?0xcdc4b6:c0.clone().multiplyScalar(0.58).getHex();   // light fronts: warm greige groove; oak: darker oak
  tz(W,Wi,D,shade,-2,0.0006); tz(W-0.026*s,Wi-0.02*s,D-0.01*s,inner,-4,0.0009); return G; }
function contactShadow(x0,x1,z0,z1,y,grp){
  const sp=0.18, W=(x1-x0)+2*sp, D=(z1-z0)+2*sp, c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  const ix=64*sp/W, iz=64*sp/D;
  g.shadowColor='rgba(0,0,0,0.5)'; g.shadowBlur=Math.max(3,Math.min(ix,iz)*0.9); g.shadowOffsetX=200; g.fillStyle='#000'; g.fillRect(ix-200,iz,64-2*ix,64-2*iz);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  m.rotation.x=-Math.PI/2; m.position.set((x0+x1)/2,y+0.004,(z0+z1)/2); m.renderOrder=1; (grp||scene).add(m); return m;
}

/* ---------- floors, slabs ---------- */
function slab(l,x0,y0,x1,y1){          // slab under level l (plan px of level l)
  const b=base(l), a=WX(l,x0), c=WX(l,x1), d=WZ(l,y0), e=WZ(l,y1);
  bx(LG[l],a-0.07,c+0.07,d-0.07,e+0.07,b-SLAB,b,M.slab);
}
function flr(l,x0,y0,x1,y1,mat,walkable){
  const b=base(l), a=WX(l,x0), c=WX(l,x1), d=WZ(l,y0), e=WZ(l,y1), w=c-a, h=e-d;
  const u=mat.userData.uvUnit||[1.818,0.909], g=new THREE.PlaneGeometry(w,h), uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*w/u[0],uv.getY(i)*h/u[1]);
  const m=new THREE.Mesh(g,mat); m.rotation.x=-Math.PI/2; m.position.set((a+c)/2,b+0.003,(d+e)/2); m.receiveShadow=true; LG[l].add(m);
  if(walkable!==false) floorRects.push({l:l,x0:a,x1:c,z0:d,z1:e,y:b});
  return m;
}
function ceilingOf(l,x0,y0,x1,y1){      // visible ceiling plane inside level l
  const b=base(l)+CH, a=WX(l,x0), c=WX(l,x1), d=WZ(l,y0), e=WZ(l,y1);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(c-a,e-d),M.ceil); m.rotation.x=Math.PI/2; m.position.set((a+c)/2,b-0.002,(d+e)/2); LG[l].add(m);
}

/* ---------- walls with openings ---------- */
function addCol(l,x0,x1,z0,z1,y0,y1,kind,door){ const c={x0:x0,x1:x1,z0:z0,z1:z1,y0:y0,y1:y1,kind:kind,l:l,door:door||null}; walls.push(c); return c; }
function winFrame(grp,horiz,c,a,b,y0,y1,t,open){   // open: no bottom rail (door openings)
  const f=0.045, tt=t+0.02;
  if(horiz){ if(!open) bx(grp,a,b,c-tt/2,c+tt/2,y0,y0+f,M.frame,{cast:false}); bx(grp,a,b,c-tt/2,c+tt/2,y1-f,y1,M.frame,{cast:false}); bx(grp,a,a+f,c-tt/2,c+tt/2,y0,y1,M.frame,{cast:false}); bx(grp,b-f,b,c-tt/2,c+tt/2,y0,y1,M.frame,{cast:false}); }
  else { if(!open) bx(grp,c-tt/2,c+tt/2,a,b,y0,y0+f,M.frame,{cast:false}); bx(grp,c-tt/2,c+tt/2,a,b,y1-f,y1,M.frame,{cast:false}); bx(grp,c-tt/2,c+tt/2,a,a+f,y0,y1,M.frame,{cast:false}); bx(grp,c-tt/2,c+tt/2,b-f,b,y0,y1,M.frame,{cast:false}); }
}
const wallOpens=[];
function wall(l,x0,y0,x1,y1,t,opens){
  const grp=LG[l], b=base(l), horiz=y0===y1, H=CH;
  (opens||[]).forEach(function(o){ const k=o.k||'win'; wallOpens.push({l:l,horiz:horiz,line:horiz?y0:x0,a:o.a,b:o.b,sill:o.sill!==undefined?o.sill:(k==='win'?0.9:0),head:o.head!==undefined?o.head:(k==='win'?2.1:(k==='door'||k==='slide'?2.05:2.15))}); });   // for curtains sized to their window
  const c=horiz?WZ(l,y0):WX(l,x0);
  const A=horiz?WX(l,Math.min(x0,x1)):WZ(l,Math.min(y0,y1)), B=horiz?WX(l,Math.max(x0,x1)):WZ(l,Math.max(y0,y1));
  const ap=horiz?LV[l].ox:LV[l].oy;
  const ops=(opens||[]).map(function(o){ return {a:(o.a-ap)*(horiz?SX:SZ),b:(o.b-ap)*(horiz?SX:SZ),k:o.k||'win',sill:o.sill,head:o.head,hinge:o.hinge||'a',hingeSet:!!o.hinge,sw:o.sw||1,mat:o.mat,frost:o.frost,screen:o.screen,face:o.face,handle:o.handle,drop:o.drop,keypad:o.keypad,fold:o.fold,outset:o.outset,jamb:o.jamb,pocket:o.pocket}; }).sort(function(p,q){return p.a-q.a;});
  const cuts=[];                                // room boundaries along this wall, so each stretch takes the colour of the room it faces
  ROOMS.forEach(function(r){ if(r.l!==l) return; (horiz?[r.x0,r.x1]:[r.y0,r.y1]).forEach(function(v){ const w=(v-ap)*(horiz?SX:SZ); if(w>A+0.02&&w<B-0.02&&cuts.indexOf(w)<0) cuts.push(w); }); });
  cuts.sort(function(p,q){ return p-q; });
  const part=function(s,e,yb,yt){
    const mid=(s+e)/2, off=t/2+0.06, edge=WM.outside;
    const neg=horiz?wallRoleAt(l,mid,c-off):wallRoleAt(l,c-off,mid), pos=horiz?wallRoleAt(l,mid,c+off):wallRoleAt(l,c+off,mid);
    const fm=function(r){ return r==='bath'?M.bathWall:WM[r]; };                // the bath is tiled floor to ceiling
    const mats=horiz?[edge,edge,edge,edge,fm(pos),fm(neg)]:[fm(pos),fm(neg),edge,edge,edge,edge];   // BoxGeometry faces: +x -x +y -y +z -z
    if(horiz) bx(grp,s,e,c-t/2,c+t/2,b+yb,b+yt,mats); else bx(grp,c-t/2,c+t/2,s,e,b+yb,b+yt,mats);
    if(yb>0) return;
    const skin=function(sd,d,y0,y1,mt){             // thin layer on one face: sd = -1 / +1 side, d = thickness
      const f0=c+sd*t/2, f1=f0+sd*d;
      if(horiz) bx(grp,s,e,Math.min(f0,f1),Math.max(f0,f1),b+y0,b+y1,mt,{cast:false}); else bx(grp,Math.min(f0,f1),Math.max(f0,f1),s,e,b+y0,b+y1,mt,{cast:false});
    };
    [[neg,-1],[pos,1]].forEach(function(q){
      if(q[0]==='wc'){ const h=Math.min(1.2,yt); skin(q[1],0.012,0,h,M.wcTile); if(h>=1.2) skin(q[1],0.018,1.2,1.225,M.trim); return; }   // toilet: 1.2 m tile wainscot with a capping rail
      if(q[0]==='outside'||q[0]==='bath') return;
      skin(q[1],0.012,0,0.06,M.trim);              // 6 cm skirting board
    });
  };
  const piece=function(s,e,yb,yt,col){
    if(e-s<0.01||yt-yb<0.01) return;
    let a0=s; cuts.forEach(function(k){ if(k>s+0.01&&k<e-0.01){ part(a0,k,yb,yt); a0=k; } }); part(a0,e,yb,yt);
    if(col){ if(horiz) addCol(l,s,e,c-t/2,c+t/2,b+yb,b+yt,'w'); else addCol(l,c-t/2,c+t/2,s,e,b+yb,b+yt,'w'); }
  };
  let cur=A;
  ops.forEach(function(o){
    const k=o.k, sill=o.sill!==undefined?o.sill:(k==='win'?0.9:0), head=o.head!==undefined?o.head:(k==='win'?2.1:(k==='door'||k==='slide'?2.05:2.15));
    piece(cur,o.a,0,H,true);
    if(sill>0.02) piece(o.a,o.b,0,sill,true);
    piece(o.a,o.b,head,H,false);
    cur=o.b;
    if(k==='win'||k==='gdoor'){
      winFrame(grp,horiz,c,o.a,o.b,b+sill,b+head,t);
      const mid=(o.a+o.b)/2, gm=o.frost?M.frost:M.glass, g=horiz?bx(grp,o.a+0.04,o.b-0.04,c-0.01,c+0.01,b+sill+0.04,b+head-0.04,gm,{cast:false}):bx(grp,c-0.01,c+0.01,o.a+0.04,o.b-0.04,b+sill+0.04,b+head-0.04,gm,{cast:false});
      if(k==='win'){ if(horiz) bx(grp,mid-0.02,mid+0.02,c-t/2-0.01,c+t/2+0.01,b+sill,b+head,M.frame,{cast:false}); else bx(grp,c-t/2-0.01,c+t/2+0.01,mid-0.02,mid+0.02,b+sill,b+head,M.frame,{cast:false});
        if(horiz) addCol(l,o.a,o.b,c-0.04,c+0.04,b+sill,b+head,'w'); else addCol(l,c-0.04,c+0.04,o.a,o.b,b+sill,b+head,'w'); }
      else { if(horiz) bx(grp,mid-0.02,mid+0.02,c-0.03,c+0.03,b,b+head,M.frame,{cast:false}); else bx(grp,c-0.03,c+0.03,mid-0.02,mid+0.02,b,b+head,M.frame,{cast:false}); }
    } else if(k==='door') makeDoor(l,horiz,c,o,t,head);
    else if(k==='slide'||k==='slide2') makeSlide(l,horiz,c,o,t,head,k==='slide2'?2:1,A,B,ops);
    else if(k==='open'&&o.jamb!==false){ const f=0.04; if(horiz){ bx(grp,o.a,o.a+f,c-t/2-0.005,c+t/2+0.005,b,b+head,M.frame,{cast:false}); bx(grp,o.b-f,o.b,c-t/2-0.005,c+t/2+0.005,b,b+head,M.frame,{cast:false}); } else { bx(grp,c-t/2-0.005,c+t/2+0.005,o.a,o.a+f,b,b+head,M.frame,{cast:false}); bx(grp,c-t/2-0.005,c+t/2+0.005,o.b-f,o.b,b,b+head,M.frame,{cast:false}); } }
  });
  piece(cur,B,0,H,true);
}
function makeDoor(l,horiz,c,o,t,head){
  const b=base(l)-(o.drop||0), w=o.b-o.a, pv=new THREE.Group(), leaf=new THREE.Group();   // drop: the leaf reaches down to a sill below the floor (front door over a sunken genkan)
  head+=o.drop||0;
  winFrame(LG[l],horiz,c,o.a,o.b,b,b+head,t,true);
  const hingeA=o.hinge==='a', hp=hingeA?o.a:o.b, dir=hingeA?1:-1;
  if(o.fold) return makeFold(l,horiz,c,o,t,head,hp,dir);
  const lm=new THREE.Mesh(new THREE.BoxGeometry(horiz?w-0.06:0.04,head-(o.drop?0.035:0.05),horiz?0.04:w-0.06),o.mat||M.door); lm.castShadow=lm.receiveShadow=true;
  const off=dir*(w/2);
  if(horiz){ pv.position.set(hp,b+head/2,c); lm.position.set(off,0,0); } else { pv.position.set(c,b+head/2,hp); lm.position.set(0,0,off); } if(o.drop) lm.position.y=-0.0075;   // leaf reaches down to just above the raised sill
  const kn=new THREE.Group();
  if(o.handle==='bar'){ const body=lam(0x1d1f22,{roughness:0.35,metalness:0.6}), glassK=new THREE.MeshStandardMaterial({color:0x0c0d10,roughness:0.08,metalness:0.4,envMapIntensity:1.4}), led=new THREE.MeshBasicMaterial({color:0xbfe6ff});
    const add=function(gx,gy,gz,mt,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(gx,gy,gz),mt); m.position.set(x,y,z); kn.add(m); return m; };
    [-1,1].forEach(function(k){ const f=k*0.02;
      if(o.keypad===k){   // outside: push-pull smart-lock handle, a thick body with the grip below, keypad and card reader on its face
        add(0.08,0.62,0.04,body,0,0.07,f+k*0.02);
        add(0.04,0.3,0.035,body,0,-0.07,f+k*0.075); [-0.2,0.06].forEach(function(y){ add(0.03,0.03,0.03,body,0,y,f+k*0.05); });
        add(0.066,0.2,0.002,glassK,0,0.27,f+k*0.041);
        for(let r=0;r<4;r++) for(let c=0;c<3;c++) add(0.012,0.01,0.002,led,(c-1)*0.018,0.345-r*0.035,f+k*0.043);
        add(0.03,0.016,0.002,new THREE.MeshBasicMaterial({color:0x7fd18c}),0,0.14,f+k*0.043);
        kn.userData.kpCover=add(0.072,0.22,0.006,body,0,0.27,f+k*0.047); kn.userData.kpCover.userData.keep=true;   // slide cover over the keys
      } else {            // inside: a slim one-piece lock body with a long pull grip standing off it on two posts, thumb-turn above
        add(0.06,0.74,0.035,body,0,0.1,f+k*0.0175);
        add(0.026,0.5,0.026,body,0,0.0,f+k*0.08); [-0.22,0.22].forEach(function(y){ add(0.02,0.03,0.045,body,0,y,f+k*0.045); });   // grip
        add(0.05,0.012,0.022,M.steel,0,0.38,f+k*0.046); add(0.026,0.026,0.008,M.steel,0,0.38,f+k*0.038);   // thumb-turn
        add(0.008,0.008,0.002,new THREE.MeshBasicMaterial({color:0x7fd18c}),0,0.44,f+k*0.036);   // status LED
      } });
    [-1,1].forEach(function(k){ const ph=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.006,16),M.steel); ph.rotation.x=Math.PI/2; ph.position.set(dir*(0.17-w/2),0.42,k*0.023); kn.add(ph); });   // door viewer at eye height, centred on the leaf
    if(horiz) kn.position.set(dir*(w-0.17),0,0); else { kn.rotation.y=Math.PI/2; kn.position.set(0,0,dir*(w-0.17)); } }
  else { [-1,1].forEach(function(k){   // lever handle with a round rose on both faces
      const rose=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,0.014,20),M.steel); rose.rotation.x=Math.PI/2; rose.position.set(0,0,k*0.027); kn.add(rose);
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.05,10),M.steel); neck.rotation.x=Math.PI/2; neck.position.set(0,0,k*0.055); kn.add(neck);
      const lev=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.018,0.018),M.steel); lev.position.set(-dir*0.065,0,k*0.074); kn.add(lev); });
    if(horiz) kn.position.set(dir*(w-0.1),0,0); else { kn.rotation.y=-Math.PI/2; kn.position.set(0,0,dir*(w-0.1)); } }   // the lever points back toward the hinge
  leaf.add(lm); leaf.add(kn); pv.add(leaf); LG[l].add(pv);
  let th; if(horiz) th=hingeA?-o.sw*Math.PI/2:o.sw*Math.PI/2; else th=hingeA?o.sw*Math.PI/2:-o.sw*Math.PI/2;
  const nrm=horiz?Math.sign(-dir*Math.sin(th)):Math.sign(dir*Math.sin(th)), sh=nrm*(t/2-0.022);   // the leaf hangs at the face it swings out of, so it clears the jambs when open
  if(horiz) pv.position.z+=sh; else pv.position.x+=sh;
  const col=horiz?addCol(l,o.a,o.b,c-0.05,c+0.05,b,b+head,'d'):addCol(l,c-0.05,c+0.05,o.a,o.b,b,b+head,'d');
  const d={l:l,pv:pv,th:th,open:false,t:0,col:col,mid:horiz?[(o.a+o.b)/2,c]:[c,(o.a+o.b)/2]}; col.door=d; doors.push(d);
  if(kn.userData.kpCover) d.kp={cover:kn.userData.kpCover,at:horiz?[hp+dir*(w-0.17),c]:[c,hp+dir*(w-0.17)],out:o.keypad};
}
function makeFold(l,horiz,c,o,t,head,hp,dir){   // bi-fold door (中折れ戸): two framed panels on a top track; the free edge runs along the track and the pull sits on the fold
  const b=base(l), w=o.b-o.a, hw=w/2, pv=new THREE.Group(), pv2=new THREE.Group(), F=0.035, T=0.03, h=head-0.05;
  const alu=lam(0xc3c6c8,{metalness:0.75,roughness:0.3}), pane=o.mat||new THREE.MeshStandardMaterial({color:0xf2f4f5,roughness:0.55,transparent:true,opacity:0.72});
  const box=function(g,gu,gy,gq,pu,py,pq,m,cast){ const x=new THREE.Mesh(horiz?new THREE.BoxGeometry(gu,gy,gq):new THREE.BoxGeometry(gq,gy,gu),m); if(horiz) x.position.set(pu,py,pq); else x.position.set(pq,py,pu); x.castShadow=cast!==false; x.receiveShadow=true; g.add(x); return x; };
  const panel=function(g){ const cu=dir*hw/2, L=hw-0.006;
    box(g,L-2*F,h-2*F,0.006,cu,0,0,pane,false); box(g,L,F,T,cu,h/2-F/2,0,alu); box(g,L,F,T,cu,-h/2+F/2,0,alu); box(g,F,h,T,cu-L/2+F/2,0,0,alu); box(g,F,h,T,cu+L/2-F/2,0,0,alu); };
  panel(pv); panel(pv2);
  [-0.38,0,0.38].forEach(function(y){ box(pv,0.03,0.07,T+0.008,dir*hw,y*h,0,M.steel); });                                  // hinges along the fold
  [-1,1].forEach(function(k){ box(pv,0.022,0.45,0.022,dir*(hw-0.045),0.05,k*(T/2+0.016),M.steel); });                      // vertical pull at the fold, both faces
  if(horiz){ pv.position.set(hp,b+head/2,c); pv2.position.set(dir*hw,0,0); } else { pv.position.set(c,b+head/2,hp); pv2.position.set(0,0,dir*hw); }
  pv.add(pv2); LG[l].add(pv);
  let th; if(horiz) th=hingeA(o)?-o.sw*Math.PI/2:o.sw*Math.PI/2; else th=hingeA(o)?o.sw*Math.PI/2:-o.sw*Math.PI/2;
  const nrm=horiz?Math.sign(-dir*Math.sin(th)):Math.sign(dir*Math.sin(th)), sh=nrm*(t/2-0.02);
  if(horiz) pv.position.z+=sh; else pv.position.x+=sh;
  const tq=(horiz?pv.position.z:pv.position.x);                                                                                // top track across the opening
  if(horiz) bx(LG[l],o.a,o.b,tq-0.02,tq+0.02,b+head-0.03,b+head,alu,{cast:false}); else bx(LG[l],tq-0.02,tq+0.02,o.a,o.b,b+head-0.03,b+head,alu,{cast:false});
  const col=horiz?addCol(l,o.a,o.b,c-0.05,c+0.05,b,b+head,'d'):addCol(l,c-0.05,c+0.05,o.a,o.b,b,b+head,'d');
  const d={l:l,pv:pv,fold:pv2,th:th*0.94,open:false,t:0,col:col,mid:horiz?[(o.a+o.b)/2,c]:[c,(o.a+o.b)/2]}; col.door=d; doors.push(d);
}
function hingeA(o){ return o.hinge==='a'; }
function makeSlide(l,horiz,c,o,t,head,n,A,B,ops){   // slide: an outset door hung from a top rail, parking on whichever side has room; slide2: an aluminium 引違い sash pair (crescent lock, insect screen outside; o.screen = outside)
  const b=base(l), w=o.b-o.a, lw=w/n, glass=o.mat===M.glass||o.mat===M.frost, leaves=[];
  const put=function(g,u0,u1,y0,y1,q0,q1,mt,cast){ if(q1<q0){ const z=q0; q0=q1; q1=z; } const m=new THREE.Mesh(horiz?new THREE.BoxGeometry(u1-u0,y1-y0,q1-q0):new THREE.BoxGeometry(q1-q0,y1-y0,u1-u0),mt);
    if(horiz) m.position.set((u0+u1)/2,(y0+y1)/2,(q0+q1)/2); else m.position.set((q0+q1)/2,(y0+y1)/2,(u0+u1)/2); m.castShadow=cast===true; m.receiveShadow=true; g.add(m); return m; };
  const at=function(g,u,q){ if(horiz) g.position.set(u,b,q); else g.position.set(q,b,u); };
  if(n===1){
    if(!o.outset) winFrame(LG[l],horiz,c,o.a,o.b,b,b+head,t);                      // outset: a wall-hung panel overlapping the plain opening, no casing
    const ov=o.outset?0.06:0.03, g=new THREE.Group(), rg=new THREE.Group(), L=-lw/2-ov, R=lw/2+ov, T=0.017, mt=glass?o.mat:(o.mat||M.door); LG[l].add(g); LG[l].add(rg);
    const col=horiz?addCol(l,o.a,o.b,c-0.05,c+0.05,b,b+head,'d'):addCol(l,c-0.05,c+0.05,o.a,o.b,b,b+head,'d');
    const d={l:l,slide:true,leaf:g,axis:horiz?'x':'z',base0:0,shift:0,th:0,pv:g,open:false,t:0,col:col,mid:horiz?[(o.a+o.b)/2,c]:[c,(o.a+o.b)/2]};
    col.door=d; doors.push(d);
    const place=function(dir,sd){
      [g,rg].forEach(function(q){ while(q.children.length){ const m=q.children.pop(); m.geometry.dispose(); } });
      const face=o.pocket?0:sd*(t/2+0.04);   // pocket: the leaf runs inside the wall beside the opening
      put(g,L,R,0.012,head+(o.outset?0.05:0.01),-T,T,mt,!glass);
      if(glass){ const f=0.04; put(g,L,R,0.012,0.012+f,-T-0.002,T+0.002,M.frame); put(g,L,R,head+0.01-f,head+0.01,-T-0.002,T+0.002,M.frame); put(g,L,L+f,0.012,head+0.01,-T-0.002,T+0.002,M.frame); put(g,R-f,R,0.012,head+0.01,-T-0.002,T+0.002,M.frame); }
      const pu=dir>0?L+0.07:R-0.07;                                                                 // recessed pull on both faces, on the edge that stays in the opening
      [-1,1].forEach(function(k){ put(g,pu-0.016,pu+0.016,0.82,1.22,k*T-0.002,k*T+0.002,M.steel); put(g,pu-0.011,pu+0.011,0.84,1.2,k*(T+0.0025)-0.0005,k*(T+0.0025)+0.0005,M.dark); });
      if(o.pocket) put(g,dir>0?L-0.001:R-0.002,dir>0?L+0.002:R+0.001,1.0,1.12,-T+0.005,T-0.005,M.dark);   // edge pull to draw it out of the pocket
      at(g,(o.a+o.b)/2,c+face);
      const r0=Math.min(o.a,dir>0?o.b:o.a-w)-0.04, r1=Math.max(o.b,dir>0?o.b+w:o.a)+0.04;           // top rail with its cover, and the floor guide at the parking end of the opening
      if(!o.pocket){ put(rg,r0,r1,b+head+0.01,b+head+0.07,c+face-sd*0.022,c+face+sd*0.03,M.frame);
        const gu=dir>0?o.b+0.02:o.a-0.02; put(rg,gu-0.015,gu+0.015,b,b+0.03,c+face-0.025,c+face+0.025,M.steel); }
      d.base0=horiz?g.position.x:g.position.z; d.shift=dir*lw; applyDoor(d);
    };
    const score=function(dir,sd){   // parking footprint against the wall's extent, walls and furniture beside it
      const p0=dir>0?o.b:o.a-w, p1=dir>0?o.b+w:o.a, q0=sd>0?c+t/2+0.015:c-t/2-0.065, q1=sd>0?c+t/2+0.065:c-t/2-0.015;
      let v=(A!==undefined&&(p0<A-0.005||p1>B+0.005))?100:0;
      walls.concat(furnCols).forEach(function(k){ if(k===col||k.l!==l||k.y1<=b+0.1||k.y0>=b+head) return;
        const ox=horiz?Math.min(p1,k.x1)-Math.max(p0,k.x0):Math.min(q1,k.x1)-Math.max(q0,k.x0), oz=horiz?Math.min(q1,k.z1)-Math.max(q0,k.z0):Math.min(p1,k.z1)-Math.max(p0,k.z0);
        if(ox>0.005&&oz>0.005) v+=k.kind==='f'?3:10; });
      slideBoxes().forEach(function(k){ if(k.own===g||k.own===rg||k.y1<=b+0.05||k.y0>=b+head) return;   // fixtures and wall pieces without colliders (TVs, art, basins)
        const ox=horiz?Math.min(p1,k.x1)-Math.max(p0,k.x0):Math.min(q1,k.x1)-Math.max(q0,k.x0), oz=horiz?Math.min(q1,k.z1)-Math.max(q0,k.z0):Math.min(p1,k.z1)-Math.max(p0,k.z0);
        if(ox>0.005&&oz>0.005) v+=2; });
      return v; };
    const dirs=o.hingeSet?[o.hinge==='b'?1:-1]:[-1,1], sides=o.face?[o.face]:[1,-1];
    slidePending.push(function(){ let best=null; sides.forEach(function(sd){ dirs.forEach(function(dir){ const v=score(dir,sd); if(!best||v<best[0]) best=[v,dir,sd]; }); }); place(best[1],best[2]); });
    place(dirs[0],sides[0]); return;
  }
  /* 引違い: sill and head with three tracks, two sashes overlapping at the meeting stiles, screen in the outer track */
  const sd=o.screen||1, tt=t+0.02, F=0.05, m=o.a+lw, frm=LG[l];
  const sideR=horiz?-sd:sd, innerA=sideR<0;                                        // seen from inside, the right-hand sash runs in the inner track
  [[0,0.035],[head-0.035,head]].forEach(function(y){ put(frm,o.a,o.b,b+y[0],b+y[1],c-tt/2,c+tt/2,M.frame); });
  put(frm,o.a,o.a+F,b,b+head,c-tt/2,c+tt/2,M.frame); put(frm,o.b-F,o.b,b,b+head,c-tt/2,c+tt/2,M.frame);
  [-0.03,0.005,0.04].forEach(function(q){ put(frm,o.a+F,o.b-F,b+0.035,b+0.045,c+sd*q-0.002,c+sd*q+0.002,M.frame); });
  const Q={inner:-sd*0.03,outer:sd*0.005,screen:sd*0.04}, ST=0.042, MS=0.06, sT=0.014;
  const sash=function(u0,u1,q,lockAt){ const g=new THREE.Group(), y0=0.04, y1=head-0.03, hw=(u1-u0)/2;
    put(g,-hw,hw,y0+0.06,y1-0.05,-0.003,0.003,M.glass);
    put(g,-hw,hw,y0,y0+0.06,-sT,sT,M.frame); put(g,-hw,hw,y1-0.05,y1,-sT,sT,M.frame);
    const lw0=lockAt<0?MS:ST, rw0=lockAt>0?MS:ST; put(g,-hw,-hw+lw0,y0,y1,-sT,sT,M.frame); put(g,hw-rw0,hw,y0,y1,-sT,sT,M.frame);
    at(g,(u0+u1)/2,c+q); frm.add(g); return g; };
  const ov=0.035, uA=[o.a+F-0.012,m+ov/2], uB=[m-ov/2,o.b-F+0.012];
  const gA=sash(uA[0],uA[1],innerA?Q.inner:Q.outer,1), gB=sash(uB[0],uB[1],innerA?Q.outer:Q.inner,-1);
  const gIn=innerA?gA:gB, gOut=innerA?gB:gA, inSide=-sd;                          // crescent lock on the inner sash's meeting stile, keeper on the outer one
  const ue=innerA?uA[1]:uB[0], s=innerA?1:-1, cu=function(g){ return horiz?g.position.x:g.position.z; }, mu=ue-s*0.02-cu(gIn), ou=ue+s*0.012-cu(gOut), chrome=M.steel;
  put(gIn,mu-0.016,mu+0.016,0.98,1.06,inSide*sT,inSide*(sT+0.008),chrome);
  const lever=put(gIn,mu-0.006,mu+0.006,1.0,1.1,inSide*(sT+0.008),inSide*(sT+0.016),chrome); lever.rotation[horiz?'z':'x']=0.35;
  put(gOut,ou-0.012,ou+0.012,0.99,1.05,inSide*sT,inSide*(sT+0.006),chrome);
  [gA,gB].forEach(function(g,i){ const hw=((i?uB:uA)[1]-(i?uB:uA)[0])/2, eu=i?hw-ST/2:-hw+ST/2;  // finger grips moulded into the outer stile, both faces
    [-1,1].forEach(function(k){ put(g,eu-0.008,eu+0.008,0.85,1.15,k*sT,k*(sT+0.005),M.frame); }); });
  if(o.screen){ const net=new THREE.MeshStandardMaterial({color:0x6a6e72,transparent:true,opacity:0.14,roughness:1,depthWrite:false,side:THREE.DoubleSide});
    const scr=new THREE.Group(), su=innerA?uA:uB, hw=(su[1]-su[0])/2, y0=0.045, y1=head-0.035;
    put(scr,-hw,hw,y0+0.03,y1-0.03,-0.001,0.001,net).renderOrder=2;
    put(scr,-hw,hw,y0,y0+0.03,-0.007,0.007,M.frame); put(scr,-hw,hw,y1-0.03,y1,-0.007,0.007,M.frame); put(scr,-hw,-hw+0.025,y0,y1,-0.007,0.007,M.frame); put(scr,hw-0.025,hw,y0,y1,-0.007,0.007,M.frame);
    put(scr,-hw+0.025,hw-0.025,y0+(y1-y0)*0.5-0.008,y0+(y1-y0)*0.5+0.008,-0.005,0.005,M.frame);
    at(scr,(su[0]+su[1])/2,c+Q.screen); frm.add(scr); }
  const opU=innerA?[o.a,m]:[m,o.b], fxU=innerA?[m,o.b]:[o.a,m];
  const col=horiz?addCol(l,opU[0],opU[1],c-0.05,c+0.05,b,b+head,'d'):addCol(l,c-0.05,c+0.05,opU[0],opU[1],b,b+head,'d');
  if(horiz) addCol(l,fxU[0],fxU[1],c-0.05,c+0.05,b,b+head,'w'); else addCol(l,c-0.05,c+0.05,fxU[0],fxU[1],b,b+head,'w');
  const d={l:l,slide:true,leaf:gIn,axis:horiz?'x':'z',base0:horiz?gIn.position.x:gIn.position.z,shift:(innerA?1:-1)*(lw-ov),th:0,pv:gIn,open:false,t:0,col:col,mid:horiz?[(o.a+o.b)/2,c]:[c,(o.a+o.b)/2]};
  col.door=d; doors.push(d);
}
function applyDoor(d){ const e=d.t*d.t*(3-2*d.t); if(d.slide) d.leaf.position[d.axis]=d.base0+d.shift*e; else { d.pv.rotation.y=d.th*e; if(d.fold) d.fold.rotation.y=-2*d.th*e; } }
/* ---------- rooms (plan units, x east / y south, the same grid on every storey; w = wall colour role) ---------- */
const ROOMS=H.rooms;
const OUT={n:'戶外',j:''};
if(H.autoArea) (function(){                                   // floor areas in 帖 (1 帖 = 1.62 m²), summed over a room's rectangles
  const area={}; ROOMS.forEach(function(r){ const k=r.l+(r.n==='廚房'?'LDK':r.n); area[k]=(area[k]||0)+(r.x1-r.x0)*SX*(r.y1-r.y0)*SZ; });   // the kitchen counts toward the LDK
  ROOMS.forEach(function(r){ if(/帖/.test(r.j)) r.j=r.j.replace(/約 [\d.]+ 帖/,'約 '+(area[r.l+r.n]/1.62).toFixed(1)+' 帖'); });
})();
/* accent walls: [storey, plan box, colour role] */
const ACCENTS=H.accents||[];
function wallRoleAt(l,x,z){
  const px=x/SX+LV[l].ox, py=z/SZ+LV[l].oy;
  for(let i=0;i<ACCENTS.length;i++){ const a=ACCENTS[i]; if(a.l===l&&px>=a.x0&&px<=a.x1&&py>=a.y0&&py<=a.y1) return a.w; }
  const r=roomAt(l,x,z); return r.w||'outside';
}

/* ---------- plan ---------- */
const TE=H.TE, TI=H.TI;
const ldkFloors=[];                              // floors the floor-heating toggle tints
H.build(E);

/* ---------- light wash: additive gradient cards on the surfaces a hidden LED lights (bright edge at the LED, fading away from it) ---------- */
const glowTex=(function(){ const c=document.createElement('canvas'); c.width=4; c.height=128; const g=c.getContext('2d'), gr=g.createLinearGradient(0,0,0,128);
  [[0,1],[0.12,0.75],[0.35,0.32],[0.65,0.09],[1,0]].forEach(function(q){ gr.addColorStop(q[0],'rgba(255,255,255,'+q[1]+')'); }); g.fillStyle=gr; g.fillRect(0,0,4,128);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
const glowMat=function(col){ return new THREE.MeshBasicMaterial({map:glowTex,color:col,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}); };
const GLOW={cove:glowMat(0xffc98f), stair:glowMat(0xffd7a0)};
function glowQuad(grp,a,b,d,mat){                // edge a-b is the lit edge, the wash runs along d and fades out
  const g=new THREE.BufferGeometry(), c=b.clone().add(d), e=a.clone().add(d);
  g.setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,e.x,e.y,e.z],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2)); g.setIndex([0,1,2,0,2,3,0,2,1,0,3,2]);
  const m=new THREE.Mesh(g,mat); m.renderOrder=2; m.castShadow=m.receiveShadow=false; grp.add(m); return m;
}
let glowStair=false;
function updateGlow(){                            // coves: soft by day, full at night, off while everyone sleeps; stair LEDs: only while someone is on the stairs
  const night=hour>=16.5||hour<6.5;
  GLOW.cove.opacity=sleepOn?0:(night?0.55:0.22);
  GLOW.stair.opacity=glowStair?(night||sleepOn?0.75:0.35):0;
}
/* ---------- stairs: two straight flights stacked in one column (A: 1F->2F, B: 2F->3F), both rising to the north ---------- */
const ST=H.stair(E);                             // {x0,x1,zs,zn,N, footLeds, soffitGap}
function flightZ(l){ const o=(ST.offset&&ST.offset[l])||0; return {zs:ST.zs+o,zn:ST.zn+o}; }   // ST.offset: per-flight shift to the south (m), so the two flights need not stack exactly
function flight(l){
  const FZ=flightZ(l), b=base(l), L=FZ.zs-FZ.zn, run=L/ST.N, rise=SH/ST.N, w=ST.x1-ST.x0;
  for(let i=0;i<ST.N;i++){
    const zz=FZ.zs-(i+1)*run, top=b+(i+1)*rise;
    bx(LG[l],ST.x0+0.004,ST.x1-0.004,zz,zz+run,top-0.05,top,M.oak);   // ends tucked into the stringers so their faces don't fight
    bx(LG[l],ST.x0+0.004,ST.x1-0.004,zz+run-0.02,zz+run,top-rise,top-0.05,M.cabF,{cast:false});
    if(ST.footLeds!==false&&i%3===1){ const m=bx(LG[l],ST.x0+0.03,ST.x0+0.04,zz+0.06,zz+run-0.06,top-rise+0.02,top-rise+0.035,M.footLed,{cast:false,recv:false}); footLights.push(m); }   // sensor foot lights on the wall side
  }
  [[ST.x0,ST.x0+0.025],[ST.x1-0.025,ST.x1]].forEach(function(xr){ stringer(l,xr[0],xr[1]); });
  (function(){                                  // plastered soffit under the flight, so it reads as a closed stair from below
    const k=SH/L, za=FZ.zs-0.12/k, zb=FZ.zn, ya=b, yb=b+SH-0.12, d=Math.hypot(za-zb,yb-ya);
    const m=new THREE.Mesh(new THREE.BoxGeometry(ST.x1-ST.x0-(ST.soffitGap||0),0.02,d),WM.hall); m.position.set((ST.x0+ST.x1)/2,(ya+yb)/2-0.01,(za+zb)/2); m.rotation.x=Math.atan2(yb-ya,za-zb); m.receiveShadow=true; LG[l].add(m);
  })();
  ramps.push({l:l,x0:ST.x0,x1:ST.x1,zs:FZ.zs,zn:FZ.zn,y0:b});
}
function stringer(l,xa,xb){                    // side board that follows the steps, cut flush with the floor below and the floor above
  const FZ=flightZ(l), b=base(l), L=FZ.zs-FZ.zn, k=SH/L, up=0.24, dn=0.12;
  const pts=[[FZ.zs,b],[FZ.zs,b+up],[FZ.zs-(SH-up+0.06)/k,b+SH+0.06],[FZ.zn,b+SH+0.06],[FZ.zn,b+SH-dn],[FZ.zs-dn/k,b]];
  const sh=new THREE.Shape(pts.map(function(q){ return new THREE.Vector2(q[0],q[1]); }));
  const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:xb-xa,bevelEnabled:false}),M.oakD);
  m.rotation.y=-Math.PI/2; m.position.set(xb,0,0); m.castShadow=m.receiveShadow=true; LG[l].add(m);
}
const footLights=[];
flight(0); flight(1);
/* stair handrail (barrier-free): flat oak rail 48 x 30 mm, 85 cm above the nosings, on slim black brackets, with a warm LED line under it
   (the stair's night light); glassGuard: frameless glass in a floor channel with the same oak cap, 1.1 m, for open stairwell edges */
const RAIL={oak:lam(0xc9a074,{roughness:0.4,envMapIntensity:0.6}),black:lam(0x1d1f22,{roughness:0.45,metalness:0.4}),
  glass:new THREE.MeshPhysicalMaterial({color:0xeef4f3,roughness:0.03,metalness:0,transparent:true,opacity:0.22,envMapIntensity:1.2,side:THREE.DoubleSide,depthWrite:false})};
function railBar(g,a,c,w,h,mt,flat){ const d=a.distanceTo(c), m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt); m.position.copy(a).lerp(c,0.5); m.lookAt(c); m.castShadow=!flat; m.receiveShadow=true; g.add(m); return m; }
const railGroups=[];
function handrail(l,wallFace,sd,zMin,zMax){      // sd = +1 rail stands off toward +x, -1 toward -x; zMin / zMax: where the wall ends (rail, brackets and returns stay on it)
  const FZ=flightZ(l), RW=0.048, RH=0.03, L=FZ.zs-FZ.zn, run=L/ST.N, k=SH/L;
  const b=base(l), g=new THREE.Group(), rx=wallFace+sd*(0.055+RW/2), V=function(z,y){ return new THREE.Vector3(rx,y,z); }, yAt=function(z){ return b+(FZ.zs-z)*k+0.85; };
  LG[l].add(g); railGroups.push(g); g.userData.sd=sd; g.userData.keep=true;                // one group per rail so a house can hide them
  const hiZ=zMax===undefined?Infinity:zMax, loZ=zMin===undefined?-Infinity:zMin;
  const z0=Math.min(FZ.zs-run*0.5,hiZ), z1=Math.max(FZ.zn+run*0.5,loZ), y0=yAt(z0), y1=yAt(z1);
  const pts=[V(Math.min(z0+0.3,hiZ),y0),V(z0,y0),V(z1,y1),V(Math.max(z1-0.3,loZ),y1)];
  const segs=[]; for(let i=0;i<3;i++) if(pts[i].distanceTo(pts[i+1])>1e-3) segs.push([pts[i],pts[i+1],i===1]);
  segs.forEach(function(sg){ const ext=sg[2]?0:0.012, d=new THREE.Vector3().subVectors(sg[1],sg[0]).normalize();
    railBar(g,sg[0].clone().addScaledVector(d,-ext),sg[1].clone().addScaledVector(d,ext),RW,RH,RAIL.oak); });
  [pts[0],pts[3]].forEach(function(p){ const q=new THREE.Vector3(wallFace+sd*0.012,p.y,p.z); railBar(g,p.clone().setX(rx+sd*RW/2),q,RH,RH,RAIL.oak); });   // ends returned to the wall
  segs.forEach(function(sg){ const da=sg[0].clone(), dc=sg[1].clone(); da.y-=RH/2+0.002; dc.y-=RH/2+0.002; railBar(g,da,dc,RW*0.45,0.004,M.footLed,true);
    const wa=sg[0].clone().setX(wallFace+sd*0.004), wb=sg[1].clone().setX(wallFace+sd*0.004); wa.y-=RH/2; wb.y-=RH/2; glowQuad(g,wa,wb,new THREE.Vector3(0,-0.38,0),GLOW.stair); });   // LED under the rail washes the wall
  const n=Math.max(2,Math.round(Math.hypot(z0-z1,y1-y0)/0.9));
  for(let i=0;i<=n;i++){
    const z=z0+(z1-z0)*i/n, y=y0+(y1-y0)*i/n-RH/2;
    railBar(g,new THREE.Vector3(wallFace,y-0.05,z),new THREE.Vector3(rx,y-0.05,z),0.012,0.012,RAIL.black);
    railBar(g,new THREE.Vector3(rx,y-0.05,z),new THREE.Vector3(rx,y,z),0.012,0.012,RAIL.black);
    bx(g,wallFace+(sd>0?0:-0.006),wallFace+(sd>0?0.006:0),z-0.025,z+0.025,y-0.08,y-0.02,RAIL.black,{cast:false});
  }
}
function glassGuard(l,x0,z0,x1,z1){
  const bb=base(l), g=LG[l], A=new THREE.Vector3(x0,bb+1.1,z0), C=new THREE.Vector3(x1,bb+1.1,z1);
  const pane=railBar(g,new THREE.Vector3(x0,bb+0.55,z0),new THREE.Vector3(x1,bb+0.55,z1),0.012,1.06,RAIL.glass,true); pane.renderOrder=1;
  railBar(g,new THREE.Vector3(x0,bb+0.03,z0),new THREE.Vector3(x1,bb+0.03,z1),0.04,0.06,RAIL.black);
  railBar(g,A,C,0.06,0.035,RAIL.oak);
  if(x0===x1) addCol(l,x0-0.03,x0+0.03,Math.min(z0,z1),Math.max(z0,z1),bb,bb+1.1,'w'); else addCol(l,Math.min(x0,x1),Math.max(x0,x1),z0-0.03,z0+0.03,bb,bb+1.1,'w');
}
function stairGuard(l,x,zA,zB){                  // glass guard along an open side of the flight on storey l, following the pitch, from zA to zB, oak cap 0.9 m above the nosings
  const FZ=flightZ(l), b=base(l), k=SH/(FZ.zs-FZ.zn), y=function(z){ return b+(FZ.zs-z)*k; }, g=LG[l];
  const pts=[[zA,y(zA)+0.04],[zB,y(zB)+0.04],[zB,y(zB)+0.86],[zA,y(zA)+0.86]], geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([].concat.apply([],pts.map(function(q){ return [x,q[1],q[0]]; })),3)); geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
  const pane=new THREE.Mesh(geo,RAIL.glass); pane.renderOrder=1; g.add(pane);
  railBar(g,new THREE.Vector3(x,y(zA)+0.9,zA),new THREE.Vector3(x,y(zB)+0.9,zB),0.06,0.035,RAIL.oak);
  railBar(g,new THREE.Vector3(x,y(zA)+0.02,zA),new THREE.Vector3(x,y(zB)+0.02,zB),0.035,0.05,RAIL.black);
  addCol(l,x-0.03,x+0.03,Math.min(zA,zB),Math.max(zA,zB),b,b+SH+1,'w');
}
if(H.stairExtras) H.stairExtras(E);
function rampY(r,x,z){ if(x<r.x0-0.04||x>r.x1+0.04||z>r.zs||z<r.zn) return null; return r.y0+(r.zs-z)/(r.zs-r.zn)*(r.h!==undefined?r.h:SH); }   // h: rise of a ramp (a storey for stairs)
function floorAt(x,z,py){
  let best=H.groundY!==undefined?H.groundY:-0.3;
  for(let i=0;i<floorRects.length;i++){ const f=floorRects[i]; if(f.y<=py+0.55&&f.y>best&&x>=f.x0-0.04&&x<=f.x1+0.04&&z>=f.z0-0.04&&z<=f.z1+0.04) best=f.y; }
  for(let i=0;i<ramps.length;i++){ const y=rampY(ramps[i],x,z); if(y!==null&&y<=py+0.55&&y>best) best=y; }
  return best;
}


/* ---------- catalogue furniture ---------- */
const Catalog=Walk.Catalog({THREE:THREE,M:M,lam:lam,fab:fab,groove:!!H.grooveHandles,notch:notchPull,get lampMat(){ return lampMat; },rnd:rnd,fabricTex:fabricTex,mirror:function(w,h){ return Walk.planarMirror(THREE,w,h); },contactShadow:contactShadow,ceilingH:CH,anisotropy:ANISO,enableLocalClipping:function(){ renderer.localClippingEnabled=true; },sitAt:function(o,a,b){ sitAt(o,a,b); }});
if(H.site) H.site(E);

/* ---------- scenery beyond the lot (opt-in: H.scenery = {lot:[x0,x1,z0,z1], road:[z0,z1], y}): drifting clouds, a painted 360° backdrop, and one of three neighbourhoods across the road ---------- */
let sceneryTick=null;
if(H.scenery) (function(){
  const S=H.scenery, Y=S.y, L=S.lot, R=S.road, cx=(L[0]+L[1])/2, cz=(L[2]+L[3])/2, root=new THREE.Group(); scene.add(root);
  let rr=9; const rnd=function(){ rr=(rr*16807)%2147483647; return rr/2147483647; };
  const unit=new THREE.BoxGeometry(1,1,1), prism=(function(){ const s=new THREE.Shape([new THREE.Vector2(-0.5,0),new THREE.Vector2(0.5,0),new THREE.Vector2(0,0.5)]); const g=new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:false}); g.translate(0,0,-0.5); return g; })();
  const mt={}, mat=function(k,col,o){ return mt[k]||(mt[k]=lam(col,Object.assign({roughness:0.85},o||{}))); };
  const win=lam(0x6d7d89,{roughness:0.2,metalness:0.1,emissive:0x000000}), vend=lam(0xf4f6f8,{roughness:0.3,emissive:0x000000});
  /* everything is batched: one merged mesh per material per neighbourhood */
  const bucket=new Map(), M4=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), Sc=new THREE.Vector3();
  const put=function(g,geo,m,pos,rotY,scale){ let b=bucket.get(g); if(!b){ b=new Map(); bucket.set(g,b); } let l=b.get(m); if(!l){ l=[]; b.set(m,l); } Q.setFromAxisAngle(V.set(0,1,0),rotY||0); M4.compose(pos,Q,scale||Sc.set(1,1,1)); const q=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(M4); l.push(q); };
  const flush=function(){ bucket.forEach(function(b,g){ b.forEach(function(l,m){ let n=0; l.forEach(function(q){ n+=q.attributes.position.count; }); const pos=new Float32Array(n*3), nor=new Float32Array(n*3); let o=0;
    l.forEach(function(q){ pos.set(q.attributes.position.array,o*3); if(q.attributes.normal) nor.set(q.attributes.normal.array,o*3); o+=q.attributes.position.count; q.dispose(); });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.BufferAttribute(nor,3)); geo.computeBoundingSphere(); const mesh=new THREE.Mesh(geo,m); mesh.matrixAutoUpdate=false; g.add(mesh); }); }); bucket.clear(); };
  const box=function(g,x0,x1,y0,y1,z0,z1,m){ put(g,unit,m,new THREE.Vector3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),0,new THREE.Vector3(x1-x0,y1-y0,z1-z0)); };
  const cyl=function(g,x,z,r0,r1,y0,y1,m,n){ put(g,new THREE.CylinderGeometry(r0,r1,y1-y0,n||8),m,new THREE.Vector3(x,(y0+y1)/2,z)); };
  const roofCols=[0x3e4248,0x5b4a3e,0x6f7378,0x2f3540], wallCols=[0xe9e3d7,0xd8d0c2,0xc9cfd3,0xf1ece2,0xb9aa94,0xe2d9cc];
  const house=function(g,x,z,w,d,fl,faceS,o){ o=o||{}; const h=fl*2.8, wc=mat('w'+(o.wc||0),wallCols[o.wc||0]), rc=mat('r'+(o.rc||0),roofCols[o.rc||0]);
    box(g,x-w/2,x+w/2,Y,Y+h,z-d/2,z+d/2,wc);
    put(g,prism,rc,new THREE.Vector3(x,Y+h,z),o.ridgeX?Math.PI/2:0,o.ridgeX?new THREE.Vector3(d+0.5,o.flat?0.3:2.2,w+0.5):new THREE.Vector3(w+0.5,o.flat?0.3:2.2,d+0.5));
    const fz=faceS?z+d/2+0.02:z-d/2-0.02, nw=Math.max(2,Math.floor(w/2.4));
    for(let f=0;f<fl;f++) for(let k=0;k<nw;k++){ const wx=x-w/2+1+k*(w-2)/Math.max(1,nw-1); box(g,wx-0.5,wx+0.5,Y+f*2.8+1.0,Y+f*2.8+2.2,fz-0.02,fz+0.02,win); }
    if(o.balc){ const by=Y+2.8+0.1, bz=faceS?z+d/2:z-d/2-1.0; box(g,x-w/2+0.5,x+w/2-0.5,by,by+0.15,bz,bz+1.0,mat('slab',0xcfc9bf)); box(g,x-w/2+0.5,x+w/2-0.5,by+0.15,by+1.1,faceS?bz+0.95:bz,faceS?bz+1.0:bz+0.05,mat('rail',0x8c9095,{metalness:0.4}));
      box(g,x+w/2-1.5,x+w/2-0.7,by+0.15,by+0.7,bz+0.2,bz+0.5,mat('acu',0xeef0f0));   // AC outdoor unit
      if(o.laundry){ [[0xf4f1ea,0],[0x9fb4c6,0.5],[0xe9c3bd,1.0]].forEach(function(q){ box(g,x-w/2+1+q[1],x-w/2+1.4+q[1],by+1.0,by+1.8,bz+0.45,bz+0.5,mat('ln'+q[0],q[0])); }); } } };
  const pole=function(g,x,z){ cyl(g,x,z,0.13,0.16,Y,Y+9,mat('pole',0xb9b6ae)); box(g,x-0.8,x+0.8,Y+7.6,Y+7.75,z-0.06,z+0.06,mat('pole',0xb9b6ae)); cyl(g,x+0.3,z+0.25,0.22,0.22,Y+6.2,Y+7.0,mat('tr',0x8a8d90)); return [x,Y+7.7,z]; };
  const wire=function(g,a,b){ const pts=[]; for(let i=0;i<=10;i++){ const t=i/10; pts.push(new THREE.Vector3(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-0.9*Math.sin(Math.PI*t),a[2]+(b[2]-a[2])*t)); } [-0.6,0,0.6].forEach(function(o){ const q=pts.map(function(v){ return new THREE.Vector3(v.x+o,v.y-(o?0:0.15),v.z); }); put(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(q),16,0.018,3,false),mat('wire',0x2a2a2a),new THREE.Vector3()); }); };
  const blob=function(g,x,z,h,r,col){ cyl(g,x,z,0.12,0.16,Y,Y+h*0.45,mat('trunk',0x6b5a48),6); const m=mat('lf'+col,col,{flatShading:true}); put(g,new THREE.IcosahedronGeometry(r,1),m,new THREE.Vector3(x,Y+h*0.45+r*0.7,z),0,new THREE.Vector3(1,0.85,1)); put(g,new THREE.IcosahedronGeometry(r,1),m,new THREE.Vector3(x+r*0.4,Y+h*0.45+r*1.25,z-r*0.2),0,new THREE.Vector3(0.7,0.6,0.7)); };
  const sakura=function(g,x,z,h){ cyl(g,x,z,0.14,0.2,Y,Y+h*0.4,mat('trunk',0x6b5a48),6); [[0,0,1],[0.7,0.3,0.7],[-0.6,0.2,0.75],[0.1,0.6,0.6]].forEach(function(q){ put(g,new THREE.IcosahedronGeometry(h*0.28*q[2],1),mat('sak',0xf3c6d3,{flatShading:true}),new THREE.Vector3(x+q[0]*h*0.25,Y+h*0.55+q[1]*h*0.2,z+(q[1]-0.3)*h*0.2),0,new THREE.Vector3(1,0.6,1)); }); };
  const hedge=function(g,x0,x1,z,h){ box(g,x0,x1,Y,Y+h,z-0.35,z+0.35,mat('hedge',0x4f7a3c)); };
  const wallB=function(g,x0,x1,z){ box(g,x0,x1,Y,Y+1.2,z-0.08,z+0.08,mat('blk',0xbdb8ae)); };
  const grass=function(g,x0,x1,z0,z1,col){ const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),mat('gr'+col,col)); m.rotation.x=-Math.PI/2; m.position.set((x0+x1)/2,Y+0.012,(z0+z1)/2); m.receiveShadow=true; g.add(m); };
  const across=R[1]+0.6;   // first plot line across the road
  /* the three neighbourhoods */
  const G={tokyo:new THREE.Group(),green:new THREE.Group(),mix:new THREE.Group()}; Object.keys(G).forEach(function(k){ G[k].visible=false; root.add(G[k]); });
  (function(g){ let i=0; for(let x=cx-21;x<cx+24;x+=7.2,i++){ house(g,x+rnd()*0.6,across+5,5.6+rnd()*0.8,7,i%3?2:3,false,{wc:i%6,rc:i%4,balc:true,laundry:i%2===0}); wallB(g,x-3.4,x+3.4,across+0.6); }
    for(let x=cx-23;x<cx+26;x+=7.8,i++) house(g,x,across+15,6,7,2+(i%2),false,{wc:(i+2)%6,rc:(i+1)%4,balc:i%3===0});
    [[-1,1],[1,1]].forEach(function(s){ for(let k=0;k<2;k++) house(g,cx+s[0]*(22+k*7.5),cz+k*1.5-1,6,7.5,2,true,{wc:(k+3)%6,rc:k,balc:true,laundry:k===0}); });
    for(let x=cx-18;x<cx+22;x+=8) house(g,x,L[2]-15,6.2,7,2,true,{wc:Math.abs(Math.round(x))%6,rc:Math.abs(Math.round(x))%4});
    const ps=[]; for(let x=cx-24;x<=cx+26;x+=12.5) ps.push(pole(g,x,R[1]+0.4)); for(let k=1;k<ps.length;k++) wire(g,ps[k-1],ps[k]);
    box(g,cx+9.2,cx+10.2,Y,Y+1.85,across+0.9,across+1.6,vend); box(g,cx+9.25,cx+10.15,Y+1.0,Y+1.7,across+0.88,across+0.9,mat('vendp',0xd8453c,{emissive:0x401010}));   // vending machine
    [cx-14,cx+3,cx+17].forEach(function(x){ blob(g,x,R[1]+0.9,5,1.3,0x5e7f45); }); })(G.tokyo);
  (function(g){ grass(g,cx-40,cx+40,across,across+40,0x7fa25a); const pth=new THREE.Mesh(new THREE.PlaneGeometry(2.2,40),mat('path',0xd9cdb5)); pth.rotation.x=-Math.PI/2; pth.position.set(cx+2,Y+0.02,across+20); g.add(pth);
    [[-9,5,7],[-3,8,6.5],[8,6,7],[14,9,6],[-16,10,6.5]].forEach(function(q){ sakura(g,cx+q[0],across+q[1],q[2]); });
    [[-20,4],[20,5],[-12,16],[4,18],[16,15],[-26,12],[26,14]].forEach(function(q,k){ blob(g,cx+q[0],across+q[1],6+k%3,1.8,k%2?0x5e7f45:0x6f8f4e); });
    box(g,cx+4,cx+5.6,Y+0.42,Y+0.47,across+6,across+6.45,mat('bench',0x8a6a4c)); box(g,cx+4,cx+5.6,Y+0.47,Y+0.85,across+6.4,across+6.45,mat('bench',0x8a6a4c)); [cx+4.1,cx+5.5].forEach(function(x){ box(g,x-0.04,x+0.04,Y,Y+0.42,across+6.05,across+6.4,mat('benchL',0x3a3d41)); });
    [[-1,1],[1,1]].forEach(function(s){ for(let k=0;k<4;k++) blob(g,cx+s[0]*(20+k*5),cz-4+k*4,7,2.2,0x5e7f45); }); for(let x=cx-22;x<cx+24;x+=6) blob(g,x,L[2]-16,7,2.4,0x5a7a40); })(G.green);
  (function(g){ let i=0; for(let x=cx-18;x<cx+22;x+=9.5,i++){ house(g,x,across+5,6,7,2,false,{wc:[0,3,5,1][i%4],rc:[0,2,1,3][i%4],balc:i%2===0}); hedge(g,x-3.2,x+3.2,across+0.8,1.1); }
    const ps=[pole(g,cx-12,R[1]+0.4),pole(g,cx+6,R[1]+0.4)]; wire(g,ps[0],ps[1]);
    for(let x=cx-30;x<=cx+30;x+=4.5) blob(g,x+rnd()*1.5,across+15+rnd()*2,7+rnd()*2,2.1,rnd()>0.5?0x5e7f45:0x6f8f4e);   // a park's tree line
    [cx-8,cx+12].forEach(function(x){ sakura(g,x,across+12.5,6); }); grass(g,cx-32,cx+32,across+11,across+20,0x7fa25a);
    [[-1,1],[1,1]].forEach(function(s){ house(g,cx+s[0]*22,cz-1,6,7.5,2,true,{wc:2+(s[0]>0?1:0),rc:s[0]>0?1:2,balc:true}); blob(g,cx+s[0]*28,cz+3,6,1.8,0x5e7f45); });
    for(let x=cx-16;x<cx+20;x+=12) house(g,x,L[2]-15,6.2,7,2,true,{wc:4,rc:2}); })(G.mix);
  /* painted 360° backdrop, one texture per neighbourhood */
  const paint=function(kind){ const cv=document.createElement('canvas'); cv.width=4096; cv.height=512; const g=cv.getContext('2d'); let r2=21; const rn=function(){ r2=(r2*16807)%2147483647; return r2/2147483647; };
    g.clearRect(0,0,4096,512);
    const hills=function(base,amp,col,fq){ g.fillStyle=col; g.beginPath(); g.moveTo(0,512); for(let x=0;x<=4096;x+=16){ g.lineTo(x,base-amp*(0.5+0.5*Math.sin(x/4096*Math.PI*2*fq+fq))-amp*0.35*Math.sin(x/4096*Math.PI*2*fq*3.1)); } g.lineTo(4096,512); g.fill(); };
    const towers=function(n,base,hmin,hmax,col,lit){ for(let i=0;i<n;i++){ const x=rn()*4096, w=30+rn()*70, h=hmin+rn()*(hmax-hmin); g.fillStyle=col; g.fillRect(x,base-h,w,h); if(lit){ g.fillStyle='rgba(255,255,255,0.25)'; for(let y=base-h+6;y<base-4;y+=10) for(let k=x+5;k<x+w-5;k+=9) g.fillRect(k,y,4,4); } } };
    if(kind==='tokyo'){ hills(430,25,'#b9c3cc',2); towers(140,470,30,140,'#a9b2bb',true); towers(120,500,20,80,'#9aa3ab',true); }
    else if(kind==='green'){ hills(380,70,'#a9b9c9',2); hills(430,50,'#8fa58c',3); hills(470,30,'#76905f',5); }
    else { hills(395,60,'#adbccb',2); hills(445,35,'#8ea486',3); towers(30,460,20,70,'#a3acb5',true); hills(485,18,'#6f8c58',6); }
    const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=THREE.RepeatWrapping; return t; };
  flush();
  const bdMat=new THREE.MeshBasicMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,fog:false}), bd=new THREE.Mesh(new THREE.CylinderGeometry(150,150,40,64,1,true),bdMat); bd.position.set(cx,Y+20-6,cz); bd.renderOrder=-1; root.add(bd);
  const bdTex={}; const tint=new THREE.Color();
  /* clouds: a few soft billboards drifting slowly; orange-pink at dusk */
  const ccv=document.createElement('canvas'); ccv.width=256; ccv.height=128; (function(){ const g=ccv.getContext('2d'); for(let k=0;k<14;k++){ const x=40+Math.random()*176, y=50+Math.random()*40, r=18+Math.random()*30, gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,0.9)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); } })();
  const cTex=new THREE.CanvasTexture(ccv); cTex.colorSpace=THREE.SRGBColorSpace; const cMat=new THREE.MeshBasicMaterial({map:cTex,transparent:true,depthWrite:false,fog:false,opacity:0.85});
  const clouds=[]; for(let k=0;k<9;k++){ const m=new THREE.Mesh(new THREE.PlaneGeometry(60+rnd()*40,22+rnd()*10),cMat); const a=rnd()*Math.PI*2, d=110+rnd()*25; m.position.set(cx+Math.cos(a)*d,Y+38+rnd()*25,cz+Math.sin(a)*d); m.lookAt(cx,Y+10,cz); m.userData.a=a; m.userData.d=d; root.add(m); clouds.push(m); }
  let cur=null, dusk=null; const KEY=(H.storageKey||'walk')+'.scenery';
  const apply=function(k){ cur=k; Object.keys(G).forEach(function(n){ G[n].visible=n===k; }); if(!bdTex[k]) bdTex[k]=paint(k); bdMat.map=bdTex[k]; bdMat.needsUpdate=true; dusk=null;
    document.querySelectorAll('#sceneryBtns [data-s]').forEach(function(b){ b.setAttribute('aria-pressed',String(b.dataset.s===k)); }); try{ localStorage.setItem(KEY,k); }catch(_){} renderer.shadowMap.needsUpdate=true; };
  let saved='mix'; try{ saved=localStorage.getItem(KEY)||'mix'; }catch(_){} apply(G[saved]?saved:'mix');
  document.querySelectorAll('#sceneryBtns [data-s]').forEach(function(b){ b.addEventListener('click',function(){ apply(b.dataset.s); }); });
  let last=0; sceneryTick=function(){ const now=performance.now()/1000, dt=Math.min(0.1,now-last); last=now; clouds.forEach(function(m){ m.userData.a+=dt*0.0012; m.position.x=cx+Math.cos(m.userData.a)*m.userData.d; m.position.z=cz+Math.sin(m.userData.a)*m.userData.d; m.lookAt(cx,Y+10,cz); });
    const dk=hour>=16.5||hour<6.5||!!document.querySelector('#tTime[aria-pressed="true"]'); if(dk!==dusk){ dusk=dk; cMat.color.setHex(dk?0xffb59a:0xffffff); win.emissive.setHex(dk?0xffc27a:0x000000); win.emissiveIntensity=dk?0.9:0; vend.emissive.setHex(dk?0xdfefff:0x000000); vend.emissiveIntensity=dk?0.6:0; bdMat.color.setHex(dk?0xd9a99a:0xffffff); } };
})();

const furnG=[0,1,2].map(function(l){ const g=new THREE.Group(); LG[l].add(g); return g; });
const tvList=[], furnThings=[], furnAnims=[];
/* furniture system (lib/furniture.js): every placed item is one catalogue object wrapped as a movable set on its storey */
const FS=Walk.FurnitureSystem({THREE:THREE,furn:furnG[0],furnCols:furnCols,storageKey:H.storageKey,variant:function(){ return curLayout; },refreshShadows:function(){ renderer.shadowMap.needsUpdate=true; },
  setLevel:function(m,lv){
    if(m.lvCur===lv) return;
    furnG[lv].add(m.W); m.lvCur=lv; m.y=base(lv);
    m.own.forEach(function(c){ c.l=lv; c.y0=base(lv); c.y1=base(lv)+1.2; });
  },
  spawn:function(t,id,lv){ return placeItem(id,t,lv===undefined?0:lv,0,0,0); },
  onRemove:function(m){ m.W.traverse(function(o){ const i=furnMeshes.indexOf(o); if(i>=0) furnMeshes.splice(i,1); }); }
});
function placeItem(id,t,l,wx,wz,rotQ,piece,lay){   // build catalogue type t (or a ready-made piece of that type) at world (wx,wz) of storey l, turned rotQ quarter turns
  const p=piece||Catalog.make(t), Rg=new THREE.Group();
  Rg.position.set(wx,0,wz); Rg.rotation.y=rotQ*Math.PI/2; Rg.add(p.group);
  p.group.traverse(function(o){ if(o.isMesh) furnMeshes.push(o); });
  if(p.tvOn) tvList.push(p);
  const cols=p.cols.map(function(c){
    let x0=c.x0,x1=c.x1,z0=c.z0,z1=c.z1;
    for(let k=0;k<rotQ;k++){ const a=z0,b2=z1,d=-x1,e=-x0; x0=a; x1=b2; z0=d; z1=e; }
    return {x0:x0+wx,x1:x1+wx,z0:z0+wz,z1:z1+wz,y0:base(l),y1:base(l)+1.2,kind:'f',l:l,lay:lay};
  });
  furnCols.push.apply(furnCols,cols);
  const info=Catalog.info(t), m=FS.wrap(id,info.name,[Rg],cols,{parent:furnG[l],lv:l,wall:!!info.wall,pivot:info.wall?[wx,wz]:null,face0:(Catalog.faceIndex(t)+rotQ)%4}); m.lvCur=l; m.y=base(l); m.piece=p;
  if(lay){ m.W.userData.lay=lay; FS.apply(m); }
  const live=function(){ return !!m.W.parent&&!FS.isStored(id)&&(!lay||lay===curLayout); }, c=Math.cos(rotQ*Math.PI/2), sn=Math.sin(rotQ*Math.PI/2);
  p.anims.forEach(function(f){ furnAnims.push({live:live,f:f}); });
  (p.actions||[]).forEach(function(a){                       // piece-local point -> default world point -> wherever the user moved it
    const dx=wx+a.x*c+a.z*sn, dz=wz-a.x*sn+a.z*c;
    furnThings.push({obj:m.W,near:a.near,part:a.part,get pt(){ const q=FS.xf(id,dx,dz); return [q[0],q[1]]; },get l(){ return m.lvCur; },on:a.on?function(){ return live()&&a.on(); }:live,label:a.label,act:function(){ a.act(); syncFold(); }});
  });
  return m;
}
/* default furnishing: [id, type, storey, plan x, plan y, facing N/E/S/W, (make)] — everything here is movable in edit mode;
   LAY1 ids exist only in layout 1, LAYOUT2 only in layout 2 */
const LAYOUT=H.layout(E), LAY1=H.lay1||{}, LAYOUT2=H.layout2?H.layout2(E):[];
LAYOUT.forEach(function(e){ const pc=e[6]?e[6]():null; if(pc) pc.type=e[1]; const m=placeItem(e[0],e[1],e[2],WX(e[2],e[3]),WZ(e[2],e[4]),Catalog.turnsToFace(e[1],e[5]),pc,LAY1[e[0]]); if(e[7]&&e[7].off) m.defOff=true; });   // e[7].off: starts put away in the library
LAYOUT2.forEach(function(e){ const pc=e[6]?e[6]():null; if(pc) pc.type=e[1]; placeItem(e[0],e[1],e[2],WX(e[2],e[3]),WZ(e[2],e[4]),Catalog.turnsToFace(e[1],e[5]),pc,2); });
FS.restoreExtras();
FS.movers.forEach(FS.apply);
/* built-in fixtures (part of the building): kitchen, bath, toilets, charger, cameras, mirror wall */
function fixture(l,piece,wx,wz,rotQ){
  rotQ=((rotQ||0)%4+4)%4;
  const Rg=new THREE.Group(); Rg.position.set(wx,base(l),wz); Rg.rotation.y=rotQ*Math.PI/2; Rg.add(piece.group); LG[l].add(Rg);
  if(piece.anims.length||(piece.actions&&piece.actions.length)||piece.setCharging) Rg.userData.keep=true;   // moving parts stay separate from the merged building
  piece.cols.forEach(function(c){
    let x0=c.x0,x1=c.x1,z0=c.z0,z1=c.z1;
    for(let k=0;k<rotQ;k++){ const a=z0,b2=z1,d=-x1,e=-x0; x0=a; x1=b2; z0=d; z1=e; }
    addCol(l,x0+wx,x1+wx,z0+wz,z1+wz,base(l),base(l)+1.0,'x');
  });
  const c=Math.cos(rotQ*Math.PI/2), sn=Math.sin(rotQ*Math.PI/2);
  piece.anims.forEach(function(f){ furnAnims.push({live:function(){ return true; },f:f}); });
  (piece.actions||[]).forEach(function(a){ furnThings.push({obj:Rg,near:a.near,part:a.part,pt:[wx+a.x*c+a.z*sn,wz-a.x*sn+a.z*c],l:l,label:a.label,act:a.act}); });
  return Rg;
}
if(H.fixtures) H.fixtures(E);
/* ceiling lights, pendants over the island, indirect cove lighting in the living room and over the bed */
const lightFixtures=[];                       // hidden in the overview so they do not float above the cut-away rooms
function light(l,px,py,col,int,dist){
  const p=new THREE.PointLight(col||0xffe2b8,int*PLI,dist||6,2); p.position.set(WX(l,px),base(l)+CH-0.25,WZ(l,py)); LG[l].add(p); pointLights.push(p);
  const L=Catalog.ceilingLight(CH); L.group.position.set(WX(l,px),base(l),WZ(l,py)); LG[l].add(L.group); lightFixtures.push(L.group);
}
function downlight(l,px,py,int,dist){          // recessed LED downlight: a small trim ring flush with the ceiling
  const p=new THREE.PointLight(0xffe2b8,(int||0.3)*PLI,dist||4.5,2); p.position.set(WX(l,px),base(l)+CH-0.15,WZ(l,py)); LG[l].add(p); pointLights.push(p);
  const g=new THREE.Group(); g.position.set(WX(l,px),base(l)+CH,WZ(l,py)); LG[l].add(g); lightFixtures.push(g);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.045,0.006,8,24),M.trim); ring.rotation.x=Math.PI/2; ring.position.y=-0.004; g.add(ring);
  const d=new THREE.Mesh(new THREE.CircleGeometry(0.04,20),lampMat); d.rotation.x=Math.PI/2; d.position.y=-0.006; g.add(d);
}
function batten(l,px,py,len,alongX,int){        // surface-mounted LED batten for the garage and storage
  const g=new THREE.Group(); g.position.set(WX(l,px),base(l)+CH,WZ(l,py)); if(!alongX) g.rotation.y=Math.PI/2; LG[l].add(g); lightFixtures.push(g);
  const body=new THREE.Mesh(new THREE.BoxGeometry(len,0.05,0.07),M.trim); body.position.y=-0.025; g.add(body);
  const tube=new THREE.Mesh(new THREE.BoxGeometry(len-0.04,0.012,0.05),lampMat); tube.position.y=-0.054; g.add(tube);
  const p=new THREE.PointLight(0xfff0dc,(int||0.5)*PLI,7,2); p.position.y=-0.25; g.add(p); pointLights.push(p);
}
function pendant(l,px,py){
  const g=new THREE.Group(); g.position.set(WX(l,px),base(l),WZ(l,py)); LG[l].add(g); lightFixtures.push(g);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,CH-1.75,6),M.dark); rod.position.y=(CH+1.75)/2; g.add(rod);
  const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.17,0.22,24,1,true),M.shade); sh.position.y=1.64; g.add(sh);
  const d=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.01,20),lampMat); d.position.y=1.535; g.add(d);
  const p=new THREE.PointLight(0xffe2b8,0.35*PLI,4,2); p.position.y=1.5; g.add(p); pointLights.push(p);
}
const coveMats=[];
function cove(l,x0,z0,x1,z1,dir){           // LED strip hidden in a ceiling cove along a wall (dir = which side of the wall the room is): warm wash on wall and ceiling
  const b=base(l)+CH, m=new THREE.MeshBasicMaterial({color:0xffd9a8}); coveMats.push(m);
  const horiz=z0===z1, inset=0.18;
  if(horiz){ const zz=WZ(l,z0)+dir*inset; bx(LG[l],WX(l,x0),WX(l,x1),zz-0.02,zz+0.02,b-0.1,b-0.08,m,{cast:false,recv:false}); bx(LG[l],WX(l,x0),WX(l,x1),zz-0.03,zz+0.03,b-0.12,b-0.1,M.trim,{cast:false}); }
  else { const xx=WX(l,x0)+dir*inset; bx(LG[l],xx-0.02,xx+0.02,WZ(l,z0),WZ(l,z1),b-0.1,b-0.08,m,{cast:false,recv:false}); bx(LG[l],xx-0.03,xx+0.03,WZ(l,z0),WZ(l,z1),b-0.12,b-0.1,M.trim,{cast:false}); }
  const V=function(u,y,w){ return horiz?new THREE.Vector3(WX(l,u),y,WZ(l,z0)+dir*w):new THREE.Vector3(WX(l,x0)+dir*w,y,WZ(l,u)); }, u0=horiz?x0:z0, u1=horiz?x1:z1;
  glowQuad(LG[l],V(u0,b-0.004,inset),V(u1,b-0.004,inset),horiz?new THREE.Vector3(0,0,dir*1.0):new THREE.Vector3(dir*1.0,0,0),GLOW.cove);   // ceiling wash into the room
  glowQuad(LG[l],V(u0,b-0.12,0.075),V(u1,b-0.12,0.075),new THREE.Vector3(0,-0.7,0),GLOW.cove);                                            // wall wash below the cove
  const n=Math.max(1,Math.round((horiz?x1-x0:z1-z0)/180));
  for(let i=0;i<n;i++){ const t=(i+0.5)/n, p=new THREE.PointLight(0xffd0a0,0.22*PLI,3.2,2);
    p.position.set(horiz?WX(l,x0+(x1-x0)*t):WX(l,x0)+dir*(inset+0.15),b-0.25,horiz?WZ(l,z0)+dir*(inset+0.15):WZ(l,z0+(z1-z0)*t)); LG[l].add(p); pointLights.push(p); }
}
if(H.lighting) H.lighting(E);
/* curtains: [storey, wall side, a, b, wall line, auto] — auto ones follow the time of day (smart home) */
const curtainSets=[];
let SHEER=null;
(H.curtains||[]).forEach(function(q){
  const l=q[0], side=q[1], horiz=side==='S'||side==='N', w=(q[3]-q[2])*(horiz?SX:SZ), mid=(q[2]+q[3])/2;
  const win=wallOpens.find(function(o){ return o.l===l&&o.horiz===horiz&&o.line===q[4]&&o.a<=mid&&o.b>=mid; });
  const ov=q[7]||{}, top=ov.top||(win?Math.min(CH-0.06,win.head+0.08):2.12), bottom=ov.bottom||(win&&win.sill>0.3?win.sill-0.12:0.015), off=ov.off!==undefined?ov.off:0.17;   // q[7]: {off, top, bottom} for a rail inside a bay   // sill windows get sill-length curtains, doors and tall windows floor-length
  const rot={S:0,E:1,N:2,W:3}[side], inward={S:[0,-1],E:[-1,0],N:[0,1],W:[1,0]}[side];
  const cx=horiz?WX(l,mid):WX(l,q[4])+inward[0]*off, cz=horiz?WZ(l,q[4])+inward[1]*off:WZ(l,mid);
  const P=Catalog.curtains(w,bottom,top,q[6]), Rg=new THREE.Group(); Rg.position.set(cx,base(l),cz); Rg.rotation.y=rot*Math.PI/2; Rg.add(P.group); LG[l].add(Rg); Rg.userData.keep=true;
  P.auto=!!q[5]; curtainSets.push(P);
  if(H.sheer&&!ov.noSheer){ const sg=new THREE.Group(), sx=horiz?WX(l,mid):WX(l,q[4])+inward[0]*(off-0.08), sz=horiz?WZ(l,q[4])+inward[1]*(off-0.08):WZ(l,mid), n=Math.max(4,Math.round(w/0.09));   // a white sheer behind every curtain, softly pleated
    sg.position.set(sx,base(l),sz); sg.rotation.y=rot*Math.PI/2; sg.userData.keep=true; LG[l].add(sg);
    const sm=SHEER||(SHEER=new THREE.MeshStandardMaterial({color:0xfbfaf6,roughness:0.9,transparent:true,opacity:0.42,side:THREE.DoubleSide,depthWrite:false}));
    const SL=new THREE.Group(), SR=new THREE.Group(); SL.position.x=-w/2; SR.position.x=w/2; sg.add(SL,SR);   // two halves that gather to their ends
    for(let i=0;i<n;i++){ const H2=i<n/2, m=new THREE.Mesh(new THREE.PlaneGeometry(w/n*1.08,top-bottom-0.02),sm); m.position.set(H2?(i+0.5)*w/n:-(n-i-0.5)*w/n,(top+bottom)/2,(i%2?0.012:-0.012)); m.rotation.y=(i%2?1:-1)*0.25; m.renderOrder=1; (H2?SL:SR).add(m); }
    let so=0, st=0, sl=null; const sset=function(){ const k=1-0.82*so; SL.scale.x=k; SR.scale.x=k; };
    furnAnims.push({live:function(){ return so!==st; },f:function(t){ if(sl===null) sl=t; const dt=Math.min(0.05,t-sl); sl=t; so=Math.abs(st-so)<dt*1.2?st:so+Math.sign(st-so)*dt*1.2; sset(); return true; }});
    const c0=Math.cos(rot*Math.PI/2), s0=Math.sin(rot*Math.PI/2), sx2=sx+0.35*(-s0), sz2=sz-0.35*c0;
    furnThings.push({obj:sg,pt:[sx+inward[0]*(0.4+(off<0?0.3-off:0)),sz+inward[1]*(0.4+(off<0?0.3-off:0))],l:l,label:function(){ return st?'拉上紗簾':'拉開紗簾'; },act:function(){ st=st?0:1; sl=null; }}); }
  P.anims.forEach(function(f){ furnAnims.push({live:function(){ return true; },f:f}); });
  P.actions.forEach(function(a){ const c=Math.cos(rot*Math.PI/2), sn=Math.sin(rot*Math.PI/2);
    const pin=off<0?0.3-off:0;   // a rail inside a bay is worked from the room
    furnThings.push({obj:Rg,pt:[cx+a.x*c+a.z*sn+inward[0]*pin,cz-a.x*sn+a.z*c+inward[1]*pin],l:l,label:a.label,act:a.act}); });
});

/* ---------- rooms ---------- */
function roomAt(l,x,z){ const px=x/SX+LV[l].ox, py=z/SZ+LV[l].oy; for(let i=0;i<ROOMS.length;i++){ const r=ROOMS[i]; if(r.l===l&&px>=r.x0&&px<=r.x1&&py>=r.y0&&py<=r.y1) return r; } return OUT; }
function levelOf(py){ return clamp(Math.round((py+0.05)/SH),0,2); }

/* ---------- state ---------- */
const SPOTS=H.spots;
const player={x:WX(0,H.start[0]),z:WZ(0,H.start[1]),py:0,camY:0,yaw:0,pitch:0};
let userH=165, fovH=100, mode='walk', hour=14, viewLevel=3, crouch=false, crouchT=0;
const orb=Object.assign({},H.orb);
const R=0.22, SPEED=1.5;
let allCols=[];
function rebuild(){
  allCols=walls.filter(function(c){ return !(c.door&&c.door.open); }).concat(furnOn?furnCols.filter(function(c){ return !c.mvOff&&!c.modeOff&&(!c.lay||c.lay===curLayout); }):[]);
}
rebuild();
function active(c,py){ return c.y0<py+1.4&&c.y1>py+0.35; }
function resolve(x,z,py){
  for(let it=0;it<3;it++) for(let i=0;i<allCols.length;i++){
    const c=allCols[i]; if(!active(c,py)) continue;
    const nx=clamp(x,c.x0,c.x1), nz=clamp(z,c.z0,c.z1), dx=x-nx, dz=z-nz, d2=dx*dx+dz*dz;
    if(d2<R*R){
      if(d2>1e-8){ const d=Math.sqrt(d2), k=(R-d)/d; x+=dx*k; z+=dz*k; }
      else { const l1=x-c.x0, l2=c.x1-x, l3=z-c.z0, l4=c.z1-z, m=Math.min(l1,l2,l3,l4); if(m===l1) x=c.x0-R; else if(m===l2) x=c.x1+R; else if(m===l3) z=c.z0-R; else z=c.z1+R; }
    }
  }
  return [x,z];
}
function setSun(h){
  hour=h; const a=(h-7)/10*Math.PI;
  sun.position.set(CEN.x-Math.cos(a)*18,CEN.y+10+8*Math.sin(a),CEN.z+Math.sin(a)*-4+6);
  sun.castShadow=shadowOn&&!sleepOn; sun.intensity=sleepOn?0:(shadowOn?1.1:0.55)*LI; renderer.shadowMap.needsUpdate=true;
  curtainSets.forEach(function(c){ if(c.auto) c.open.closed=(h>=17||h<7); });   // smart curtains in the bedroom follow the time of day
  updateGlow();
}
function applyLevelVis(){
  const all=mode==='walk';
  lightFixtures.forEach(function(g){ g.visible=all; });
  for(let l=0;l<3;l++){ LG[l].visible=all||l<viewLevel; labelGroups[l].visible=!all&&l===viewLevel-1&&!FS.isEditing()&&!(roofMesh&&roofMesh.visible); }
  document.querySelectorAll('#lv button').forEach(function(b){ b.setAttribute('aria-pressed',String(+b.getAttribute('data-v')===viewLevel)); });
  renderer.shadowMap.needsUpdate=true;
}
function resize(){
  const w=window.innerWidth, h=window.innerHeight; renderer.setSize(w,h,false); post.setSize(w,h);
  const a=w/h; camera.aspect=a;
  if(mode==='walk') camera.fov=clamp(2*Math.atan(Math.tan(fovH*Math.PI/360)/a)*180/Math.PI,40,105);   // fovH = horizontal angle, same as Ctype
  else camera.fov=clamp(2*Math.atan(Math.tan(50*Math.PI/360)/a)*180/Math.PI,35,65);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize); resize();
function setMode(m){
  mode=m; $('bView').textContent=m==='walk'?'俯瞰':'走進去'; $('cross').hidden=m!=='walk'; $('dist').hidden=m!=='walk'; $('lv').hidden=m==='walk';
  applyLevelVis(); resize();
}
let seat=null;                                   // seated in a piece (the car): the eye is pinned to the seat until the player moves
function sitAt(o,local,exitLocal){
  o.updateMatrixWorld(true); const p=o.localToWorld(local.clone()), e=o.localToWorld(exitLocal.clone()), q=new THREE.Quaternion(); o.getWorldQuaternion(q);
  const fwd=new THREE.Vector3(0,0,1).applyQuaternion(q); seat={p:p,exit:[e.x,e.z]}; player.x=p.x; player.z=p.z; player.yaw=Math.atan2(-fwd.x,-fwd.z); player.pitch=-0.12;
  if(mode!=='walk') setMode('walk'); toast('已坐進車內，往任一方向移動就會下車');
}
function updateCamera(){
  if(mode==='walk'&&seat){ camera.position.copy(seat.p); camera.rotation.set(player.pitch,player.yaw,0); return; }
  if(mode==='walk'){ camera.position.set(player.x,player.camY+userH*0.936/100*(1-0.42*crouchT),player.z); camera.rotation.set(player.pitch,player.yaw,0); }
  else { const cp=Math.cos(orb.pitch), ty=viewLevel>=3?3:base(Math.max(0,viewLevel-1))+0.8; camera.position.set(orb.tx+Math.sin(orb.yaw)*cp*orb.dist,ty+Math.sin(orb.pitch)*orb.dist,orb.tz+Math.cos(orb.yaw)*cp*orb.dist); camera.lookAt(orb.tx,ty,orb.tz); }
}
const avatar=new THREE.Group(); (function(){ const m=lam(0xe8672a); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.2,1.45,14),m); b.position.y=0.73; avatar.add(b); const h=new THREE.Mesh(new THREE.SphereGeometry(0.13,14,10),m); h.position.y=1.6; avatar.add(h); const n=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.22,10),lam(0xffffff)); n.rotation.x=-Math.PI/2; n.position.set(0,1.58,-0.22); avatar.add(n); scene.add(avatar); })();
/* room labels for the overview, one per room, floating over each storey */
const labelGroups=[0,1,2].map(function(l){ const g=new THREE.Group(); g.visible=false; LG[l].add(g); return g; });
(function(){
  const seen={};
  ROOMS.forEach(function(r){
    const key=r.l+r.n; if(seen[key]||r.n==='階梯') return; seen[key]=1;
    const c=document.createElement('canvas'); c.width=320; c.height=96; const g=c.getContext('2d'), sub=/帖/.test(r.j)?r.j:'';
    g.fillStyle='rgba(20,30,40,.84)'; g.fillRect(0,0,320,96); g.fillStyle='#ffffff'; g.textAlign='center'; g.textBaseline='middle';
    g.font='700 34px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'; g.fillText(r.n,160,sub?34:48);
    if(sub){ g.fillStyle='#9fd0f0'; g.font='500 24px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'; g.fillText(sub,160,71); }
    const t=new THREE.CanvasTexture(c); t.minFilter=THREE.LinearFilter; t.generateMipmaps=false; t.colorSpace=THREE.SRGBColorSpace;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));
    sp.scale.set(1.5,0.45,1); sp.position.set(WX(r.l,(r.x0+r.x1)/2),base(r.l)+1.4,WZ(r.l,(r.y0+r.y1)/2)); sp.renderOrder=10; labelGroups[r.l].add(sp);
  });
})();

/* ---------- input ---------- */
const keys={};
/* Ctrl toggles crouching rather than being held: holding it while walking would hit Ctrl+W */
window.addEventListener('keydown',function(e){ keys[e.code]=true; if(e.target&&e.target.tagName==='INPUT') return; if(e.code==='KeyE'&&!e.repeat){ if(hov.t) actOn(hov.t); else actNow(); } if(e.code==='KeyF'&&!e.repeat) actNow(); if(/^Digit[1-3]$/.test(e.code)&&!e.repeat&&actList[+e.code.slice(5)-1]) actOn(actList[+e.code.slice(5)-1]); if((e.code==='ControlLeft'||e.code==='ControlRight')&&!e.repeat&&mode==='walk'){ crouch=!crouch; toast(crouch?'蹲下（再按 Ctrl 站起來）':'站起來'); } if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code)>=0) e.preventDefault(); });
window.addEventListener('keyup',function(e){ keys[e.code]=false; });
const joyEl=$('joy'), knob=$('knob'), joy={x:0,y:0,id:null};
function moveJoy(e){ const r=joyEl.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2; let dx=e.clientX-cx, dy=e.clientY-cy; const max=r.width/2-18, d=Math.hypot(dx,dy); if(d>max){ dx*=max/d; dy*=max/d; } joy.x=dx/max; joy.y=dy/max; knob.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))'; }
function endJoy(e){ if(e.pointerId!==joy.id) return; joy.id=null; joy.x=0; joy.y=0; knob.style.transform='translate(-50%,-50%)'; }
joyEl.addEventListener('pointerdown',function(e){ joy.id=e.pointerId; try{joyEl.setPointerCapture(e.pointerId);}catch(_){} moveJoy(e); e.preventDefault(); });
joyEl.addEventListener('pointermove',function(e){ if(e.pointerId===joy.id) moveJoy(e); });
joyEl.addEventListener('pointerup',endJoy); joyEl.addEventListener('pointercancel',endJoy);
const canvas=$('c'), sheet=$('sheet'), ptrs=new Map(); let pinch0=0, tmove=null;
function pdist(){ const a=Array.from(ptrs.values()); return a.length<2?0:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); }
function look(dx,dy){ if(mode==='walk'){ player.yaw-=dx*0.0055; player.pitch=clamp(player.pitch-dy*0.0055,-1.25,1.25); } else if(FS.isEditing()){ const k=orb.dist*0.0012, cy=Math.cos(orb.yaw), sy=Math.sin(orb.yaw); orb.tx=clamp(orb.tx-dx*k*cy-dy*k*sy,-1,6); orb.tz=clamp(orb.tz+dx*k*sy-dy*k*cy,-1,10.5); } else { orb.yaw-=dx*0.006; orb.pitch=clamp(orb.pitch+dy*0.005,0.2,1.52); } }
function setStick(dx,dy){ const d=Math.hypot(dx,dy); if(d<8){ releaseStick(); return; } joy.x=dx/d; joy.y=dy/d; knob.style.transform='translate(calc(-50% + '+(joy.x*46)+'px), calc(-50% + '+(joy.y*46)+'px))'; }
function releaseStick(){ joy.x=0; joy.y=0; knob.style.transform='translate(-50%,-50%)'; }
canvas.addEventListener('pointerdown',function(e){
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1&&e.pointerType==='touch'&&mode==='walk'&&joy.id===null){ tmove={id:e.pointerId,sx:e.clientX,sy:e.clientY}; }
  else if(ptrs.size===2){ if(tmove){ tmove=null; releaseStick(); } pinch0=pdist(); }
  if(!sheet.hidden) sheet.hidden=true;
});
canvas.addEventListener('pointermove',function(e){
  const p=ptrs.get(e.pointerId); if(!p) return;
  const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
  if(FSU.isDragging()) return;
  if(tmove&&tmove.id===e.pointerId){ setStick(e.clientX-tmove.sx,e.clientY-tmove.sy); return; }
  const touchWalk=e.pointerType==='touch'&&mode==='walk';
  if(ptrs.size===1){ if(!touchWalk||joy.id!==null) look(dx,dy); }
  else if(ptrs.size===2){ if(touchWalk) look(dx*0.5,dy*0.5); else { const d=pdist(); if(pinch0>0&&d>0&&mode==='over') orb.dist=clamp(orb.dist*pinch0/d,6,45); pinch0=d; } }
});
function upPtr(e){ ptrs.delete(e.pointerId); pinch0=0; if(tmove&&tmove.id===e.pointerId){ tmove=null; releaseStick(); } }
canvas.addEventListener('pointerup',upPtr); canvas.addEventListener('pointercancel',upPtr);
canvas.addEventListener('wheel',function(e){ if(mode==='over'){ orb.dist=clamp(orb.dist*Math.exp(e.deltaY*0.0012),6,45); e.preventDefault(); } },{passive:false});
window.addEventListener('contextmenu',function(e){ e.preventDefault(); });

/* ---------- sheet / doors / spots ---------- */
const toastEl=$('toast'), bAct=$('bAct'); let toastT=0, curThing=null;
let quietToast=false;
function toast(t){ if(quietToast) return; toastEl.textContent=t; toastEl.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ toastEl.hidden=true; },1800); }
(function(){                                   // ambient occlusion: off by default (costly); remembered per device
  const b=$('tAO'); let on=false;
  try{ const v=localStorage.getItem('walkAO'); if(v!==null) on=v==='1'; }catch(_){}
  const set=function(v){ post.setAO(v); b.setAttribute('aria-pressed',String(v)); };
  set(on);
  b.addEventListener('click',function(){ const v=!post.aoOn; set(v); try{ localStorage.setItem('walkAO',v?'1':'0'); }catch(_){} });
  window.__aoOff=function(){ set(false); };
})();
(function(){                                   // picture style: the house as built, or a Shinkai-like anime look (toon shading, painted sky, grade); remembered per device
  const b=$('tStyle'); if(!b||!post.canStyle) return;
  const toon=new Map(), back=new WeakMap(), grad=(function(){ const d=new Uint8Array([70,120,165,205,240,255]), t=new THREE.DataTexture(d,d.length,1,THREE.RedFormat); t.minFilter=t.magFilter=THREE.NearestFilter; t.needsUpdate=true; return t; })();
  const toToon=function(m){ if(!m||!m.isMeshStandardMaterial||m.transparent||m.userData.noToon) return m; let t=toon.get(m); if(t){ if(t.map!==m.map||t.emissiveMap!==m.emissiveMap||t.bumpMap!==m.bumpMap||t.normalMap!==m.normalMap){ t.map=m.map; t.emissiveMap=m.emissiveMap; t.bumpMap=m.bumpMap; t.normalMap=m.normalMap; t.needsUpdate=true; } return t; }   // textures that finished loading after the switch
    t=new THREE.MeshToonMaterial({color:m.color,map:m.map,gradientMap:grad,emissive:m.emissive,emissiveMap:m.emissiveMap,emissiveIntensity:m.emissiveIntensity,bumpMap:m.bumpMap,bumpScale:m.bumpScale,normalMap:m.normalMap,alphaTest:m.alphaTest,side:m.side,vertexColors:m.vertexColors,clippingPlanes:m.clippingPlanes,clipIntersection:m.clipIntersection});
    t.color=m.color; t.emissive=m.emissive; back.set(t,m); toon.set(m,t); return t; };   // shared colours follow later finish changes
  const swap=function(on){ scene.traverse(function(o){ if(!o.isMesh) return; const f=on?function(m){ return toToon(back.get(m)||m); }:function(m){ return back.get(m)||m; };
    o.material=Array.isArray(o.material)?o.material.map(f):f(o.material); }); };
  const DAY={sun:[1.9,0xffd49c],hemi:[0.8,0xa9c4f0,0x8f7d6c],amb:0.7,fill:0xbcd0f0,fog:0xcfe2ee,hour:14,glow:0xffffff,shaft:0xffe2b0,
      sky:['#1d5fc9','#4f93e6','#cfe6fa','#cfe2ee'],cloud:['#a8bfdc','#ffffff','rgba(255,236,205,0.6)']},
    DUSK={sun:[1.7,0xff9a5c],hemi:[0.75,0x9a9ad8,0x9a7464],amb:0.65,fill:0xb4a8dc,fog:0xf1c9ae,hour:16.75,glow:0xffb27a,shaft:0xffb07a,
      sky:['#2f3f86','#c9789a','#ffc08a','#f1c9ae'],cloud:['#8a78a8','#ffd6b8','rgba(255,160,110,0.65)']};
  let P=DAY; try{ if(localStorage.getItem('walkTime')==='dusk') P=DUSK; }catch(_){}
  let sky={}, sunGlow=null; const bg0=scene.background, fog0=scene.fog.color.clone(), tm0=renderer.toneMapping, ex0=renderer.toneMappingExposure;
  const tone=[[sun,'sun'],[hemi,'hemi'],[amb,'amb'],[fills[0],'fill'],[fills[1],'fill']].map(function(q){ return {L:q[0],key:q[1],base:0,set:-1,c0:q[0].color.clone(),g0:q[0].groundColor&&q[0].groundColor.clone()}; });
  const light=function(on){ tone.forEach(function(t){ const L=t.L, v=P[t.key], k=Array.isArray(v)?v[0]:t.key==='fill'?0.6:v, c=Array.isArray(v)?v[1]:t.key==='fill'?v:null, g=Array.isArray(v)?v[2]:null;   // a base changed elsewhere (time of day, sleep) is picked up again
    if(on){ if(L.intensity!==t.set) t.base=L.intensity; t.set=L.intensity=t.base*k; if(c!=null) L.color.setHex(c); if(g!=null) L.groundColor.setHex(g); }
    else { if(t.set>=0&&L.intensity===t.set) L.intensity=t.base; t.set=-1; L.color.copy(t.c0); if(t.g0) L.groundColor.copy(t.g0); } }); };
  const paintSky=function(Q){ let rnd=11; const r=function(){ rnd=(rnd*16807)%2147483647; return rnd/2147483647; };
    const c=document.createElement('canvas'); c.width=2048; c.height=1024; const g=c.getContext('2d'), w=2048, h=1024;
    const gr=g.createLinearGradient(0,0,0,h*0.5); gr.addColorStop(0,Q.sky[0]); gr.addColorStop(0.55,Q.sky[1]); gr.addColorStop(1,Q.sky[2]); g.fillStyle=gr; g.fillRect(0,0,w,h*0.5); g.fillStyle=Q.sky[3]; g.fillRect(0,h*0.5,w,h*0.5);
    for(let i=0;i<16;i++){ const cx=r()*w, cy=h*(0.34+r()*0.12), s=50+r()*80, p=[]; for(let k=0;k<24;k++){ const a=r()*Math.PI; p.push([cx+Math.cos(a)*s*1.2*r(),cy-Math.sin(a)*s*0.7*r(),s*(0.25+r()*0.5)]); }
      p.forEach(function(q){ g.fillStyle=Q.cloud[0]; g.beginPath(); g.arc(q[0],q[1]+q[2]*0.18,q[2],0,7); g.fill(); });
      p.forEach(function(q){ g.fillStyle=Q.cloud[1]; g.beginPath(); g.arc(q[0]-q[2]*0.1,q[1]-q[2]*0.08,q[2]*0.9,0,7); g.fill(); });
      p.forEach(function(q){ g.fillStyle=Q.cloud[2]; g.beginPath(); g.arc(q[0]-q[2]*0.25,q[1]-q[2]*0.3,q[2]*0.45,0,7); g.fill(); }); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.mapping=THREE.EquirectangularReflectionMapping; return t; };
  /* light shafts: each sunlit window pane is swept along the sun direction until the light lands, drawn as a faint additive prism */
  const shaftG=new THREE.Group(); shaftG.visible=false; scene.add(shaftG);
  const shaftMat=new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color()},k:{value:0.09}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,
    vertexShader:'attribute float along; varying float vA; varying vec3 vN,vV; void main(){ vA=along; vec4 wp=modelMatrix*vec4(position,1.); vN=mat3(modelMatrix)*normal; vV=cameraPosition-wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
    fragmentShader:'uniform vec3 col; uniform float k; varying float vA; varying vec3 vN,vV; void main(){ float f=(1.-vA)*(1.-vA)*0.8+0.2*(1.-vA); gl_FragColor=vec4(col*k*f*abs(dot(normalize(vN),normalize(vV))),1.); }'});
  const ray=new THREE.Raycaster(), opaque=function(h){ for(let i=0;i<h.length;i++){ const o=h[i].object, m=Array.isArray(o.material)?o.material[0]:o.material; if(!o.isMesh||!m||m.transparent||!shown(o)) continue; return h[i]; } return null; };
  const cast=function(p,d,far){ ray.set(p,d); ray.far=far; ray.camera=camera; return opaque(ray.intersectObjects(scene.children,true)); };
  let shaftSig='', shaftT=0;
  const buildShafts=function(){
    shaftG.children.forEach(function(m){ m.geometry.dispose(); }); shaftG.clear();
    const d=sun.target.position.clone().sub(sun.position).normalize(), back=d.clone().negate(), B=new THREE.Box3(), cen=new THREE.Vector3(), sz=new THREE.Vector3(), panes=[];
    scene.traverse(function(o){ if(o.isMesh&&o.material===M.glass) panes.push(o); });
    shaftG.visible=false;
    panes.forEach(function(o){ B.setFromObject(o); B.getCenter(cen); B.getSize(sz); if(sz.y<0.3) return;
      const ax=sz.x<sz.z?'x':'z', n=new THREE.Vector3(ax==='x'?1:0,0,ax==='z'?1:0); if(Math.abs(d.dot(n))<0.12) return;
      if(cast(cen.clone().addScaledVector(back,0.05),back,30)) return;   // the sun does not reach this pane
      const u0=ax==='x'?B.min.z:B.min.x, u1=ax==='x'?B.max.z:B.max.x, C=[[u0,B.min.y],[u1,B.min.y],[u1,B.max.y],[u0,B.max.y]].map(function(q){ return ax==='x'?new THREE.Vector3(cen.x,q[1],q[0]):new THREE.Vector3(q[0],q[1],cen.z); });
      const E=C.map(function(c){ const h=cast(c.clone().addScaledVector(d,0.03),d,8); return c.clone().addScaledVector(d,h?h.distance+0.03:6); });
      const pos=[], al=[]; for(let i=0;i<4;i++){ const a=C[i], b=C[(i+1)%4], ea=E[i], eb=E[(i+1)%4];
        [a,b,eb, a,eb,ea].forEach(function(v,j){ pos.push(v.x,v.y,v.z); al.push(j===0||j===1||j===3?0:1); }); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('along',new THREE.Float32BufferAttribute(al,1)); g.computeVertexNormals();
      const m=new THREE.Mesh(g,shaftMat); m.userData.pane=o; m.renderOrder=2; m.frustumCulled=false; shaftG.add(m); });
    shaftG.visible=post.styleOn; };
  const set=function(on){
    post.setStyle(on); swap(on); b.setAttribute('aria-pressed',String(on));
    if(ink) ink.hidden=!on; if(tb) tb.hidden=!on;
    if(on&&!sunGlow){ const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'), gr=g.createRadialGradient(128,128,0,128,128,128);
      gr.addColorStop(0,'rgba(255,252,240,1)'); gr.addColorStop(0.12,'rgba(255,240,205,0.9)'); gr.addColorStop(0.4,'rgba(255,220,170,0.25)'); gr.addColorStop(1,'rgba(255,210,160,0)'); g.fillStyle=gr; g.fillRect(0,0,256,256);
      const gt=new THREE.CanvasTexture(c); gt.colorSpace=THREE.SRGBColorSpace; sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})); sunGlow.scale.setScalar(90); scene.add(sunGlow); }
    if(sunGlow){ sunGlow.visible=on; sunGlow.material.color.setHex(P.glow); }
    const key=P===DUSK?'dusk':'day'; if(on&&!sky[key]) sky[key]=paintSky(P);
    scene.background=on?sky[key]:bg0; scene.fog.color.set(on?P.fog:fog0); renderer.toneMapping=on?THREE.NeutralToneMapping:tm0; renderer.toneMappingExposure=on?0.65:ex0; light(on);
    shaftMat.uniforms.col.value.setHex(P.shaft); shaftG.visible=on&&shaftG.children.length>0; if(on) shaftSig='';
    renderer.shadowMap.needsUpdate=true; try{ localStorage.setItem('walkStyle',on?'anime':''); }catch(_){} };
  let needHour=false;
  const tb=$('tTime'), label=function(){ if(tb){ tb.textContent='新海誠風：時段 '+(P===DUSK?'黃昏':'白天'); tb.setAttribute('aria-pressed',String(P===DUSK)); } },
    applyHour=function(){ const rh=$('rHour'); setSun(P.hour); if(rh){ rh.value=P.hour; $('oHour').textContent=fmtHour(P.hour); } };
  label(); if(tb) tb.addEventListener('click',function(){ P=P===DUSK?DAY:DUSK; label(); try{ localStorage.setItem('walkTime',P===DUSK?'dusk':''); }catch(_){} set(true); applyHour(); toast(tb.textContent); });
  const ink=$('tInk'), setInk=function(v){ post.setInk(v); if(ink) ink.setAttribute('aria-pressed',String(v)); };
  try{ setInk(localStorage.getItem('walkInk')!=='0'); }catch(_){ setInk(true); }
  if(ink) ink.addEventListener('click',function(){ const v=!post.inkOn; setInk(v); try{ localStorage.setItem('walkInk',v?'1':'0'); }catch(_){} toast(v?'描邊線：開':'描邊線：關'); });
  b.hidden=false; let on=false; try{ on=localStorage.getItem('walkStyle')==='anime'; }catch(_){}
  set(on); needHour=on;   // the house sets its own start time after this block, so the preset hour waits for the first frame
  b.addEventListener('click',function(){ glow(null); set(!post.styleOn); if(post.styleOn) applyHour(); toast(post.styleOn?'畫面風格：新海誠風（測試）':'畫面風格：原本'); });
  let tick=0; window.__styleTick=function(){
    if(post.styleOn){ if(needHour){ needHour=false; applyHour(); } light(true); if(++tick%90===0) swap(true);
      const sig=sun.position.toArray().map(function(v){ return v.toFixed(2); }).join(); if(sig!==shaftSig){ shaftSig=sig; shaftT=performance.now()+350; } if(shaftT&&performance.now()>shaftT){ shaftT=0; buildShafts(); }
      if(tick%30===0) shaftG.children.forEach(function(m){ m.visible=shown(m.userData.pane); }); }
    if(sunGlow&&sunGlow.visible){ const d=sun.position.clone().sub(sun.target.position).normalize(); sunGlow.position.copy(camera.position).addScaledVector(d,250); } };
})();
$('bMenu').addEventListener('click',function(){ sheet.hidden=!sheet.hidden; });
$('bClose').addEventListener('click',function(){ sheet.hidden=true; });
$('bView').addEventListener('click',function(){ setMode(mode==='walk'?'over':'walk'); });
$('rHeight').addEventListener('input',function(){ userH=+this.value; $('oHeight').textContent=userH+' cm'; });
$('rFov').addEventListener('input',function(){ fovH=+this.value; $('oFov').textContent=fovH+'°'; resize(); });
function fmtHour(h){ const hh=Math.floor(h), mm=Math.round((h-hh)*60); return hh+':'+(mm<10?'0':'')+mm; }
$('rHour').addEventListener('input',function(){ setSun(+this.value); $('oHour').textContent=fmtHour(+this.value); });
$('tShadow').addEventListener('click',function(){ shadowOn=!shadowOn; this.setAttribute('aria-pressed',String(shadowOn)); setSun(hour); });
$('tFurn').addEventListener('click',function(){ furnOn=!furnOn; this.setAttribute('aria-pressed',String(furnOn)); furnG.forEach(function(g){ g.visible=furnOn; }); rebuild(); });
(function(){ const box=$('lv'); [['全部',3],['1F',1],['2F',2],['3F',3]].forEach(function(p,i){ if(i===0) return; });
  [['外觀',4],['1F',1],['2F',2],['3F',3]].forEach(function(p){ const b=document.createElement('button'); b.type='button'; b.textContent=p[0]; b.setAttribute('data-v',p[1]); b.addEventListener('click',function(){ viewLevel=p[1]===4?3:p[1]; if(p[1]===4){ roofOn(true); } else roofOn(false); applyLevelVis(); }); box.appendChild(b); }); })();
let roofMesh=null; LG[2].children.forEach(function(o){ if(o.material===M.roof) roofMesh=o; });
function roofOn(v){ if(roofMesh) roofMesh.visible=v; }
function setDoor(d,open,quiet){
  if(open&&!d.open&&d.locked&&d.locked()){ if(!quiet) toast(d.lockMsg||'門鎖著'); return false; }
  if(!open){ const c=d.col, nx=clamp(player.x,c.x0,c.x1), nz=clamp(player.z,c.z0,c.z1); if(levelOf(player.py)===d.l&&Math.hypot(player.x-nx,player.z-nz)<R*0.5){ if(!quiet) toast('人站在門口，無法關上'); return false; } }
  d.open=open; rebuild(); return true;
}
const HALLS=/^(走道|走廊|玄關廳|LDK|階梯|戶外|玄關門廊)$/;
function doorName(d){ if(!d.__rooms) d.__rooms=[[0.35,0],[-0.35,0],[0,0.35],[0,-0.35]].map(function(o){ return roomAt(d.l,d.mid[0]+o[0],d.mid[1]+o[1]).n; }).filter(function(n,i,a){ return n&&a.indexOf(n)===i; });   // the room on the far side of the door from you
  const here=roomAt(d.l,player.x,player.z).n, far=d.__rooms.filter(function(n){ return n!==here; }), own=far.filter(function(n){ return !HALLS.test(n); });
  return own[0]||far[0]||d.__rooms[0]||''; }
const things=doors.map(function(d){ const o=d.leaf||d.pv; return {obj:o&&o.isObject3D?o:null,pt:d.mid,l:d.l,label:function(){ if(d.label) return d.label(d.open); const n=doorName(d); return d.slide?(d.open?'拉上'+n+'拉門':'拉開'+n+'拉門'):(d.open?'關上'+n+'門':'打開'+n+'門'); },act:function(){ setDoor(d,!d.open); }}; });
const bMore=document.createElement('div'); bMore.id='bMore'; bMore.hidden=true; bAct.parentNode.insertBefore(bMore,bAct);
let actList=[], actKey=''; const actP=new THREE.Vector3(), actB=new THREE.Box3();
function updateAct(){                            // up to three reachable things, the one under the crosshair first
  const c=[];
  if(mode==='walk'){
    const fxv=-Math.sin(player.yaw), fzv=-Math.cos(player.yaw), pl=levelOf(player.py);
    const here=roomAt(pl,player.x,player.z).n;
    things.concat(furnThings).forEach(function(t,ix){ if(t.l!==pl||(t.on&&!t.on())) return;
      const bi=t.part&&t.part[0]&&!t.obj;
      if(ix<doors.length){ const dx=t.pt[0]-player.x, dz=t.pt[1]-player.z, dd=Math.hypot(dx,dz), f=Math.max(0,1-0.15/Math.max(0.15,dd)); if(wallBetween(pl,player.x,player.z,player.x+dx*f,player.z+dz*f)) return; }   // doors: not through another wall
      if(furnThings.indexOf(t)>=0&&!bi){ if(t.obj){ const q=t.obj.getWorldPosition(actP), dd=Math.hypot(q.x-player.x,q.z-player.z), f=Math.max(0,1-0.15/Math.max(0.15,dd)); if(wallBetween(pl,player.x,player.z,player.x+(q.x-player.x)*f,player.z+(q.z-player.z)*f)) return; }   // movable pieces (the car too): no wall between you and the piece
        else if(roomAt(pl,t.pt[0],t.pt[1]).n!==here) return; }   // other furniture actions: only from the same room
      if(bi){ const q=actB.setFromObject(t.part[0]).getCenter(actP), dd=Math.hypot(q.x-player.x,q.z-player.z), f=Math.max(0,1-0.15/Math.max(0.15,dd)); if(wallBetween(pl,player.x,player.z,player.x+(q.x-player.x)*f,player.z+(q.z-player.z)*f)) return; if(t.pt&&wallBetween(pl,player.x,player.z,t.pt[0],t.pt[1])) return; }   // built-ins sit on room edges: any room with no wall in between, standing on the side they open to
      const q=t.part&&t.part[0]&&!t.obj?actB.setFromObject(t.part[0]).getCenter(actP):null, vx=(q?q.x:t.pt[0])-player.x, vz=(q?q.z:t.pt[1])-player.z, d=Math.hypot(vx,vz), cs=d>1e-3?(vx*fxv+vz*fzv)/d:1;   // built-ins without a piece: aim at their own door
      let cs3=cs; if(q){ const cp=camera.position, ux=q.x-cp.x, uy=q.y-cp.y, uz=q.z-cp.z, ul=Math.hypot(ux,uy,uz), cp2=Math.cos(player.pitch); if(ul>1e-3) cs3=(ux*fxv*cp2+uy*Math.sin(player.pitch)+uz*fzv*cp2)/ul; }   // rank built-ins by where you look, up or down too
      if(d<1.35&&(d<0.25||cs>0.8)) c.push({t:t,s:(1-cs3)*2+d*0.4,ix:ix}); });
  }
  c.sort(function(a,b){ return a.s-b.s; }); actList=c.slice(0,1).concat(c.slice(1,3).sort(function(a,b){ return a.ix-b.ix; })).map(function(x){ return x.t; }); curThing=actList[0]||null;   // the aimed-at one first, the other two in a fixed order so they don't shuffle
  const labels=actList.map(function(t){ return t.label(); }), key=labels.join('|');
  if(key===actKey) return; actKey=key;
  bAct.hidden=!curThing; if(curThing) bAct.textContent=labels[0];
  bMore.textContent=''; bMore.hidden=actList.length<2;
  actList.slice(1).forEach(function(t,i){ const b=document.createElement('button'); b.type='button'; b.className='fab'; b.textContent=labels[i+1];
    b.addEventListener('click',function(){ actOn(t); }); bMore.appendChild(b); });
}
function actOn(t){ glow(null); t.act(); actKey=''; updateAct(); hov.dirty=true; }
/* mouse: the part under the cursor lights up and names its action; a click without dragging, or E, runs it */
const hov={x:0,y:0,on:false,dirty:false,t:null,mesh:null}, hovRay=new THREE.Raycaster(), hovTip=document.createElement('div'), downs=new Map();
hovRay.far=3.5; hovTip.id='hovTip'; hovTip.hidden=true; $('hud').appendChild(hovTip);
let hl=null;
function glow(m){ if(hl&&hl.mesh===m) return;                   // tint the hovered part with a fresh clone, put the original back unless something else swapped it meanwhile
  if(hl){ if(hl.mesh.material===hl.c) hl.mesh.material=hl.m; hl.c.dispose(); hl=null; }
  if(!m||Array.isArray(m.material)||(m.material.clippingPlanes&&m.material.clippingPlanes.length)) return; const c=m.material.clone();   // clipped car-body materials can't be cloned safely
  const warm=new THREE.Color(0xffb070);
  if(c.emissiveMap){ c.emissive.lerp(warm,0.25); c.emissiveIntensity*=1.1; } else if(c.emissive){ c.emissive.copy(warm); c.emissiveIntensity=0.13; } else if(c.color) c.color.lerp(warm,0.25);
  hl={mesh:m,m:m.material,c:c}; m.material=c; }
function shown(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }
function wallBetween(l,x0,z0,x1,z1){ const dx=x1-x0, dz=z1-z0;   // does the floor-plan segment cross a wall or a shut door
  return walls.some(function(c){ if(c.l!==l||!(c.kind==='w'||(c.kind==='d'&&!(c.door&&c.door.open)))) return false;
    let t0=0, t1=1; const sl=function(p,q){ if(p===0) return q>=0; const r=q/p; if(p<0){ if(r>t1) return false; if(r>t0) t0=r; } else { if(r<t0) return false; if(r<t1) t1=r; } return true; };
    return sl(-dx,x0-c.x0-0.01)&&sl(dx,c.x1-0.01-x0)&&sl(-dz,z0-c.z0-0.01)&&sl(dz,c.z1-0.01-z0)&&t0<t1; }); }
function pickHover(){ hov.dirty=false; let best=null, mesh=null;
  if(hov.on&&mode==='walk'&&sheet.hidden&&!FS.isEditing()){
    const pl=levelOf(player.py), owner=new Map(), objs=[];
    things.concat(furnThings).forEach(function(t){ if(t.l!==pl||(t.on&&!t.on())) return; const os=t.obj?[t.obj]:(t.part||[]);   // built-ins without a piece are picked by their own parts
      os.forEach(function(ob){ if(!owner.has(ob)){ owner.set(ob,[]); objs.push(ob); } owner.get(ob).push(t); }); });
    FS.movers.forEach(function(m){ if(m.lvCur===pl&&!owner.has(m.W)) objs.push(m.W); });   // other furniture still blocks the cursor
    const r=canvas.getBoundingClientRect(); hovRay.setFromCamera(new THREE.Vector2((hov.x-r.left)/r.width*2-1,-(hov.y-r.top)/r.height*2+1),camera);
    const hits=hovRay.intersectObjects(objs,true);
    for(let i=0;i<hits.length;i++){ const h=hits[i]; if(h.object.renderOrder===1||!shown(h.object)) continue; let o=h.object; while(o&&!owner.has(o)) o=o.parent;
      if(!o) break;
      const f=Math.max(0,1-0.15/Math.max(0.15,Math.hypot(h.point.x-player.x,h.point.z-player.z)));
      if(wallBetween(pl,player.x,player.z,player.x+(h.point.x-player.x)*f,player.z+(h.point.z-player.z)*f)) break;
      let depth=0, hit=null; for(let a=h.object;a&&a!==o&&!hit;a=a.parent,depth++) owner.get(o).forEach(function(t){ if(!hit&&t.part&&t.part.indexOf(a)>=0&&(!t.on||t.on())) hit=t; });   // the action whose own parts hold the cursor, innermost first
      if(hit){ best=hit; mesh=h.object; break; }
      let bd=1e9; owner.get(o).forEach(function(t){ const q=t.near?t.near.getWorldPosition(new THREE.Vector3()):null, d=q?q.distanceTo(h.point):Math.hypot(t.pt[0]-h.point.x,t.pt[1]-h.point.z); if(d<bd){ bd=d; best=t; } }); mesh=h.object; break; } }   // several actions on one piece: the one whose part or spot is nearest the cursor
  hov.t=best; glow(best?mesh:null); hovTip.hidden=!best; canvas.style.cursor=best?'pointer':'';
  if(best){ hovTip.textContent=best.label(); hovTip.style.left=(hov.x+16)+'px'; hovTip.style.top=(hov.y+18)+'px'; } }
canvas.addEventListener('pointermove',function(e){ if(e.pointerType!=='mouse') return; hov.x=e.clientX; hov.y=e.clientY; hov.on=true; hov.dirty=true; });
canvas.addEventListener('pointerleave',function(){ hov.on=false; hov.dirty=true; });
canvas.addEventListener('pointerdown',function(e){ if(e.pointerType==='mouse'&&e.button===0) downs.set(e.pointerId,{x:e.clientX,y:e.clientY,t:performance.now()}); });
canvas.addEventListener('pointerup',function(e){ const d=downs.get(e.pointerId); downs.delete(e.pointerId);
  if(d&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<5&&performance.now()-d.t<600){ pickHover(); if(hov.t) actOn(hov.t); } });
function actNow(){ if(curThing) actOn(curThing); }
bAct.addEventListener('click',actNow);
$('dOpen').addEventListener('click',function(){ doors.forEach(function(d){ setDoor(d,true,true); }); updateAct(); });
$('dClose').addEventListener('click',function(){ let n=0; doors.forEach(function(d){ if(!setDoor(d,false,true)) n++; }); updateAct(); if(n) toast('有 '+n+' 扇門因為有人站著而沒關上'); });
function updateDoors(dt){ let moved=false; doors.forEach(function(d){ const tt=d.open?1:0; if(d.t!==tt){ d.t=tt?Math.min(1,d.t+dt/0.45):Math.max(0,d.t-dt/0.45); applyDoor(d); moved=true; } }); if(moved) renderer.shadowMap.needsUpdate=true; }
function teleport(s){ const l=s[3]; player.x=WX(l,s[1]); player.z=WZ(l,s[2]); player.py=base(l); player.yaw=s[5]; player.pitch=s[6]||0; const p=resolve(player.x,player.z,player.py); player.x=p[0]; player.z=p[1]; player.camY=floorAt(player.x,player.z,player.py); player.py=player.camY; }
[['回到大門外',H.start[0],H.start[1],0,0,0]].concat(SPOTS).forEach(function(s){ const b=document.createElement('button'); b.type='button'; b.textContent=s[0]; b.addEventListener('click',function(){ teleport(s); if(mode!=='walk') setMode('walk'); sheet.hidden=true; }); $('spots').appendChild(b); });
/* equipment notes in the menu: H.notes [storey, plan x, plan y, name, note] for built-in features, plus every placed piece of furniture (H.noteText[id]: note, [name, note], or null to leave it out) */
(function(){
  if(!H.notes) return;
  const h3=document.createElement('h3'); h3.textContent='設備筆記';
  const q=document.createElement('input'); q.type='search'; q.id='noteQ'; q.className='noteQ'; q.placeholder='搜尋設備、家具或房間'; q.setAttribute('aria-label','搜尋設備筆記');
  const list=document.createElement('div'); list.id='notes'; list.className='notes';
  const at=$('spots').previousElementSibling; [h3,q,list].forEach(function(n){ at.parentNode.insertBefore(n,at); });
  q.addEventListener('keydown',function(e){ e.stopPropagation(); });
  const go=function(it){ const l=it.l, y=base(l), r=roomAt(l,it.x,it.z); let cdx=1, cdz=0, best=null;   // try eight spots around it: unblocked, same room, toward the room's middle
    if(r!==OUT){ const cx=WX(l,(r.x0+r.x1)/2)-it.x, cz=WZ(l,(r.y0+r.y1)/2)-it.z, dd=Math.hypot(cx,cz); if(dd>0.2){ cdx=cx/dd; cdz=cz/dd; } }
    for(let k=0;k<8;k++){ const a=k*Math.PI/4, dx=Math.cos(a), dz=Math.sin(a);
      [1.3,0.9].forEach(function(d){ const x=it.x+dx*d, z=it.z+dz*d, p=resolve(x,z,y), moved=Math.hypot(p[0]-x,p[1]-z);
        const rm=roomAt(l,p[0],p[1]), sc=moved*4+(rm===OUT?5:rm===r?0:it.f?0.6:1.5)+(1-(dx*cdx+dz*cdz))*0.5+(it.f?(1-(dx*it.f[0]+dz*it.f[1]))*1.2:0)+(d<1?0.3:0);
        if(!best||sc<best.s) best={s:sc,x:p[0],z:p[1]}; }); }
    player.x=best.x; player.z=best.z; player.py=y; player.camY=floorAt(player.x,player.z,player.py); player.py=player.camY;
    player.yaw=Math.atan2(-(it.x-player.x),-(it.z-player.z)); player.pitch=-0.2;
    if(mode!=='walk') setMode('walk'); sheet.hidden=true; toast(it.n); updateAct(); };
  const items=function(){ const tx=H.noteText||{}, out=H.notes.map(function(n){ return {l:n[0],x:WX(n[0],n[1]),z:WZ(n[0],n[2]),n:n[3],t:n[4]||''}; });
    FS.movers.forEach(function(m){ const v=tx[m.id]; if(v===null||m.lvCur===undefined||!m.W.visible) return;
      const c=new THREE.Box3().setFromObject(m.W).getCenter(new THREE.Vector3());
      const ty=Catalog.TYPES.find(function(d){ return d.name===m.label; }), fr=ty&&{'+x':[1,0,0],'-x':[-1,0,0],'+z':[0,0,1],'-z':[0,0,-1]}[ty.front], f=fr&&new THREE.Vector3(fr[0],0,fr[2]).transformDirection(m.piece.group.matrixWorld);   // stand in front of furniture
      out.push({l:m.lvCur,x:c.x,z:c.z,f:f&&[f.x,f.z],n:Array.isArray(v)?v[0]:m.label,t:Array.isArray(v)?v[1]:(v||'')}); });
    return out; };
  const render=function(){ const k=q.value.trim().toLowerCase(), groups=[[],[],[]], seen={};
    items().forEach(function(it){ it.room=roomAt(it.l,it.x,it.z).n; const key=it.l+'|'+it.room+'|'+it.n;
      if(seen[key]){ seen[key].k++; return; } it.k=1; seen[key]=it;
      if(!k||(it.n+it.t+it.room).toLowerCase().indexOf(k)>=0) groups[it.l].push(it); });
    list.textContent='';
    groups.forEach(function(g,l){ if(!g.length) return;
      const hd=document.createElement('div'); hd.className='noteFloor'; hd.textContent=(l+1)+'F'; list.appendChild(hd);
      g.sort(function(a,b){ return a.room.localeCompare(b.room,'zh-Hant')||a.n.localeCompare(b.n,'zh-Hant'); });
      g.forEach(function(it){ const b=document.createElement('button'); b.type='button'; b.className='note';
        const nm=document.createElement('b'), rm=document.createElement('span'); nm.textContent=it.n+(it.k>1?' ×'+it.k:''); rm.textContent=it.room; b.append(nm,rm);
        if(it.t){ const p=document.createElement('small'); p.textContent=it.t; b.appendChild(p); }
        b.addEventListener('click',function(){ go(it); }); list.appendChild(b); }); });
    if(!list.childNodes.length) list.textContent='找不到符合的項目'; };
  q.addEventListener('input',render); $('bMenu').addEventListener('click',render); render();
})();
/* last walking position, kept per house in this browser so a reopened page resumes there */
const POS_KEY=H.id+'Pos';
function savePos(){ try{ localStorage.setItem(POS_KEY,JSON.stringify({x:player.x,z:player.z,py:player.py,yaw:player.yaw,pitch:player.pitch})); }catch(_){} }
setInterval(savePos,2000); addEventListener('pagehide',savePos); document.addEventListener('visibilitychange',function(){ if(document.hidden) savePos(); });

/* ---------- minimap / HUD ---------- */
const mini=$('mini'), mg=mini.getContext('2d'), MS=H.mini[0], MX0=H.mini[1], MZ0=H.mini[2];
const KC={w:'#39404a',d:'#a0714f',f:'#c9a47a',x:'#8fa3b8'};
const miniBg=document.createElement('canvas'), mbg=miniBg.getContext('2d'); let miniKey=null, miniAge=0;
function drawMini(){
  const l=levelOf(player.py), b=base(l);
  if(miniBg.width!==mini.width||miniBg.height!==mini.height){ miniBg.width=mini.width; miniBg.height=mini.height; miniKey=null; }
  if(miniKey!==l+':'+allCols.length||allCols!==drawMini.cols||++miniAge>15){        // plan layer: redrawn when the storey or the obstacles change, refreshed twice a second
    miniKey=l+':'+allCols.length; drawMini.cols=allCols; miniAge=0;
    mbg.clearRect(0,0,miniBg.width,miniBg.height);
    floorRects.forEach(function(f){ if(f.l!==l) return; mbg.fillStyle='#dfd2bd'; mbg.fillRect((f.x0-MX0)*MS,(f.z0-MZ0)*MS,(f.x1-f.x0)*MS,(f.z1-f.z0)*MS); });
    ramps.forEach(function(r){ if(r.l===l||r.l===l-1){ mbg.fillStyle='#caa77a'; mbg.fillRect((r.x0-MX0)*MS,(r.zn-MZ0)*MS,(r.x1-r.x0)*MS,(r.zs-r.zn)*MS); } });
    allCols.forEach(function(c){ if(c.y0>=b+2.6||c.y1<=b+0.05) return; if(c.y0<b-0.05&&c.y1<b+0.3) return; mbg.fillStyle=KC[c.kind]||'#444'; mbg.fillRect((c.x0-MX0)*MS,(c.z0-MZ0)*MS,Math.max(1.5,(c.x1-c.x0)*MS),Math.max(1.5,(c.z1-c.z0)*MS)); });
  }
  mg.clearRect(0,0,mini.width,mini.height); mg.drawImage(miniBg,0,0);
  const px=(player.x-MX0)*MS, pz=(player.z-MZ0)*MS, ang=Math.atan2(-Math.cos(player.yaw),-Math.sin(player.yaw));
  mg.fillStyle='rgba(232,103,42,.3)'; mg.beginPath(); mg.moveTo(px,pz); mg.arc(px,pz,64,ang-0.62,ang+0.62); mg.closePath(); mg.fill();
  mg.fillStyle='#e8672a'; mg.strokeStyle='#fff'; mg.lineWidth=3; mg.beginPath(); mg.arc(px,pz,8,0,TAU); mg.fill(); mg.stroke();
  mg.fillStyle='#17222d'; mg.font='bold 22px sans-serif'; mg.fillText((l+1)+'F',8,24);
}
const rn=$('rn'), rs=$('rs'); let curRoom=null, curLvl=-1;
function updateRoom(){ const l=levelOf(player.py), r=roomAt(l,player.x,player.z); if(r!==curRoom||l!==curLvl){ curRoom=r; curLvl=l; rn.textContent=(l+1)+'F '+r.n; rs.textContent=r.j; rs.hidden=!r.j; } }
/* ---------- floor plan panel (格局圖): one storey at a time from H.rooms and the wall boxes; click a room to walk into it ---------- */
const floorPlan=(function(){
  const TINT={peach:'#f8e7da',oat:'#f4ecdd',hall:'#ece8e1',genkan:'#ece4d7',wc:'#dcecf2',bath:'#d3e6f3',utility:'#ddeeed',mist:'#e2e8f2',dress:'#f0e4ef',sage:'#e1edd8',outside:'#f3f3ee'};
  const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';
  const btn=document.createElement('button'); btn.type='button'; btn.id='bPlan'; btn.className='fab'; btn.textContent='格局圖'; btn.title='格局圖（M）'; btn.setAttribute('aria-haspopup','dialog'); mini.after(btn);
  const wrap=document.createElement('div'); wrap.id='plan'; wrap.hidden=true;
  wrap.innerHTML='<div class="planCard" role="dialog" aria-modal="true" aria-labelledby="planT"><div class="planHead"><h2 id="planT">格局圖</h2><div class="planTabs" role="tablist" aria-label="樓層"></div><button class="x" type="button" aria-label="關閉">×</button></div><div class="planSum" aria-live="polite"></div><div class="planBox"><canvas role="img" aria-label="格局圖，點房間即可傳送過去"></canvas></div><p class="planFoot"></p></div>';
  document.body.appendChild(wrap);
  const card=wrap.firstChild, tabs=card.querySelector('.planTabs'), box=card.querySelector('.planBox'), cv=card.querySelector('canvas'), g=cv.getContext('2d'), foot=card.querySelector('.planFoot'), sumEl=card.querySelector('.planSum');
  const LVS=[0,1,2].filter(function(l){ return ROOMS.some(function(r){ return r.l===l; }); });
  let geo=null, cur=LVS[0], hover=null, sc=40, ox=0, oz=0, prevFocus=null;
  const PAD={l:40,t:40,r:38,b:40};
  function build(){                                   // per storey: grid cells owned like roomAt (first room wins), areas per name, the indoor extent
    geo={}; let bx0=1e9, bz0=1e9, bx1=-1e9, bz1=-1e9;
    LVS.forEach(function(l){ const rs=ROOMS.filter(function(r){ return r.l===l; }), xs=[], ys=[];
      rs.forEach(function(r){ xs.push(r.x0,r.x1); ys.push(r.y0,r.y1); bx0=Math.min(bx0,WX(l,r.x0)); bx1=Math.max(bx1,WX(l,r.x1)); bz0=Math.min(bz0,WZ(l,r.y0)); bz1=Math.max(bz1,WZ(l,r.y1)); });
      const ux=Array.from(new Set(xs)).sort(function(a,b){ return a-b; }), uy=Array.from(new Set(ys)).sort(function(a,b){ return a-b; });
      const own=[], area={}, big={}; let ix0=1e9, iz0=1e9, ix1=-1e9, iz1=-1e9, fa=0, gar=0;
      for(let i=0;i<ux.length-1;i++){ own.push([]); for(let j=0;j<uy.length-1;j++){ const cx=(ux[i]+ux[i+1])/2, cy=(uy[j]+uy[j+1])/2;
        const r=rs.find(function(q){ return cx>q.x0&&cx<q.x1&&cy>q.y0&&cy<q.y1; })||null; own[i].push(r);
        const ca=(ux[i+1]-ux[i])*SX*(uy[j+1]-uy[j])*SZ;
        if(r&&(r.w!=='outside'||GARAGE.test(r.n)&&roofed(l,WX(l,cx),WZ(l,cy)))){ fa+=ca; if(r.w==='outside') gar+=ca; }   // floor area: indoor rooms plus a built-in garage under an upper storey
        if(r){ area[r.n]=(area[r.n]||0)+ca; if(r.w!=='outside'){ ix0=Math.min(ix0,ux[i]); ix1=Math.max(ix1,ux[i+1]); iz0=Math.min(iz0,uy[j]); iz1=Math.max(iz1,uy[j+1]); } } } }
      rs.forEach(function(r){ const a=(r.x1-r.x0)*(r.y1-r.y0); if(!big[r.n]||a>big[r.n].a) big[r.n]={r:r,a:a}; });
      geo[l]={rs:rs,ux:ux,uy:uy,own:own,area:area,big:big,fa:fa,gar:gar,ext:ix0<1e9?[ix0,iz0,ix1,iz1]:null}; });
    geo.b=[bx0,bz0,bx1,bz1];
  }
  const GARAGE=/車庫|ガレージ/, TSUBO=3.306, JO=1.62;
  function roofed(l,wx,wz){ return ROOMS.some(function(q){ return q.l>l&&q.w!=='outside'&&wx>WX(q.l,q.x0)&&wx<WX(q.l,q.x1)&&wz>WZ(q.l,q.y0)&&wz<WZ(q.l,q.y1); }); }
  const m2t=function(a){ return a.toFixed(1)+' m²（約 '+(a/TSUBO).toFixed(1)+' 坪）'; };
  function summary(){
    const tot=LVS.reduce(function(s,l){ return s+geo[l].fa; },0), gar=LVS.filter(function(l){ return geo[l].gar>0.05; });
    let h='<div class="planTot">'+(H.land?'<span>土地面積 <b>'+m2t(H.land)+'</b></span>':'')+'<span>建物總面積 <b>'+m2t(tot)+'</b></span></div><div class="planFl">';
    LVS.forEach(function(l){ const f=geo[l].fa; h+='<span'+(l===cur?' class="on" aria-current="true"':'')+'>'+(l+1)+'F <b>'+f.toFixed(1)+' m²</b><b>（約 '+(f/TSUBO).toFixed(1)+' 坪）</b></span>'; });
    h+='</div><small>各層＝外牆內的室內面積'+(gar.length?'（含 '+gar.map(function(l){ return (l+1)+'F 車庫 '+geo[l].gar.toFixed(1)+' m²'; }).join('、')+'）':'')+'，不含陽台・緣側・門廊</small>';
    sumEl.innerHTML=h;
  }
  const X=function(x){ return PAD.l+(x-ox)*sc; }, Z=function(z){ return PAD.t+(z-oz)*sc; };
  function layout(){
    const b=geo.b, w=b[2]-b[0], d=b[3]-b[1], aw=Math.max(240,box.clientWidth), ah=Math.max(300,innerHeight*0.92-card.querySelector('.planHead').offsetHeight-sumEl.offsetHeight-foot.offsetHeight-40);
    sc=Math.max(26,Math.min((aw-PAD.l-PAD.r)/w,(ah-PAD.t-PAD.b)/d,90)); ox=b[0]; oz=b[1];
    const cw=Math.round(w*sc+PAD.l+PAD.r), ch=Math.round(d*sc+PAD.t+PAD.b), dpr=Math.min(3,window.devicePixelRatio||1);
    cv.style.width=cw+'px'; cv.style.height=ch+'px'; cv.width=Math.round(cw*dpr); cv.height=Math.round(ch*dpr); g.setTransform(dpr,0,0,dpr,0,0);
  }
  function text(s,x,y,size,weight,color){ g.font=weight+' '+size+'px '+FONT; g.fillStyle=color; g.fillText(s,x,y); }
  function draw(){
    const l=cur, G=geo[l], b=base(l), cw=cv.width, ch=cv.height;
    g.save(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cw,ch); g.restore();
    g.fillStyle='#fdfcf9'; g.fillRect(0,0,cw,ch);
    const cx=function(i){ return X(WX(l,G.ux[i])); }, cz=function(j){ return Z(WZ(l,G.uy[j])); };
    G.own.forEach(function(col,i){ col.forEach(function(r,j){ if(!r) return;
      g.fillStyle=TINT[r.w]||'#eeeae3'; g.fillRect(cx(i),cz(j),cx(i+1)-cx(i)+0.5,cz(j+1)-cz(j)+0.5);
      if(hover&&r.n===hover){ g.fillStyle='rgba(10,120,187,.16)'; g.fillRect(cx(i),cz(j),cx(i+1)-cx(i)+0.5,cz(j+1)-cz(j)+0.5); } }); });
    g.save(); g.beginPath(); G.own.forEach(function(col,i){ col.forEach(function(r,j){ if(r&&r.w==='outside') g.rect(cx(i),cz(j),cx(i+1)-cx(i)+0.5,cz(j+1)-cz(j)+0.5); }); }); g.clip();   // outdoor parts hatched
    g.strokeStyle='rgba(120,120,110,.16)'; g.lineWidth=1; g.beginPath(); for(let k=-ch;k<cw;k+=8){ g.moveTo(k,ch); g.lineTo(k+ch,0); } g.stroke(); g.restore();
    g.strokeStyle='#bdb5a8'; g.lineWidth=1; g.beginPath();                       // room borders: only where the room changes
    const nm=function(i,j){ const c=G.own[i]&&G.own[i][j]; return c?c.n:null; };
    for(let i=0;i<=G.ux.length-1;i++) for(let j=0;j<G.uy.length-1;j++){ const a=nm(i-1,j), c=nm(i,j); if(a!==c&&(a||c)){ g.moveTo(cx(i),cz(j)); g.lineTo(cx(i),cz(j+1)); } }
    for(let j=0;j<=G.uy.length-1;j++) for(let i=0;i<G.ux.length-1;i++){ const a=nm(i,j-1), c=nm(i,j); if(a!==c&&(a||c)){ g.moveTo(cx(i),cz(j)); g.lineTo(cx(i+1),cz(j)); } }
    g.stroke();
    const rect=function(c,f){ g.fillStyle=f; g.fillRect(X(c.x0),Z(c.z0),Math.max(1.2,(c.x1-c.x0)*sc),Math.max(1.2,(c.z1-c.z0)*sc)); };
    g.save(); g.beginPath(); G.rs.forEach(function(r){ g.rect(X(WX(l,r.x0)-0.12),Z(WZ(l,r.y0)-0.12),((r.x1-r.x0)*SX+0.24)*sc,((r.y1-r.y0)*SZ+0.24)*sc); }); g.clip();   // fences and garden walls stay off the plan
    const mine=walls.filter(function(c){ return c.l===l&&!c.door&&c.kind==='w'&&c.y1>b+0.05&&c.y0<b+SH-0.1; });
    mine.forEach(function(c){ if(c.y0>b+0.3) rect(c,'#cfd5da'); });             // above an opening (window head, lintel)
    mine.forEach(function(c){ if(c.y0<=b+0.3&&c.y1<b+1.9&&Math.min(c.x1-c.x0,c.z1-c.z0)<=0.2) rect(c,'#8d969e'); });  // low: window sills, railings, half walls
    mine.forEach(function(c){ if(c.y0>b+0.3&&c.y1-c.y0<1.9&&Math.min(c.x1-c.x0,c.z1-c.z0)<0.09) rect(c,'#6fa8d0'); });   // glazing
    const fixt=function(c){ return Math.min(c.x1-c.x0,c.z1-c.z0)>0.2; };          // deep boxes are built-in cabinets or columns, not walls
    mine.forEach(function(c){ if(c.y0<=b+0.3&&c.y1>=b+1.9&&!fixt(c)) rect(c,'#2e3842'); });   // full-height walls
    mine.forEach(function(c){ if(c.y0<=b+0.3&&fixt(c)){ rect(c,'rgba(150,140,125,.28)'); g.strokeStyle='#9c9488'; g.lineWidth=1; g.strokeRect(X(c.x0)+0.5,Z(c.z0)+0.5,(c.x1-c.x0)*sc-1,(c.z1-c.z0)*sc-1); } });
    doors.forEach(function(d){ if(d.l!==l||!d.col) return; const c=d.col, horiz=(c.x1-c.x0)>(c.z1-c.z0), len=horiz?c.x1-c.x0:c.z1-c.z0;
      g.strokeStyle='#a0714f'; g.lineWidth=1.4;
      if(d.slide){ const m=horiz?(c.z0+c.z1)/2:(c.x0+c.x1)/2; g.beginPath(); if(horiz){ g.moveTo(X(c.x0),Z(m)); g.lineTo(X(c.x1),Z(m)); } else { g.moveTo(X(m),Z(c.z0)); g.lineTo(X(m),Z(c.z1)); } g.stroke(); return; }
      let hx, hz, fx, fz; try{ const p=d.pv.getWorldPosition(new THREE.Vector3()); hx=p.x; hz=p.z; }catch(_){ return; }
      if(horiz){ const m=(c.z0+c.z1)/2; hz=m; if(Math.abs(hx-c.x0)<Math.abs(hx-c.x1)){ hx=c.x0; fx=c.x1; } else { hx=c.x1; fx=c.x0; } fz=m; }
      else { const m=(c.x0+c.x1)/2; hx=m; if(Math.abs(hz-c.z0)<Math.abs(hz-c.z1)){ hz=c.z0; fz=c.z1; } else { hz=c.z1; fz=c.z0; } fx=m; }
      const a0=Math.atan2(fz-hz,fx-hx), th=d.th||0, a1=a0-th;                          // rotation.y by th turns (x,z) clockwise on the plan
      g.beginPath(); g.moveTo(X(hx),Z(hz)); g.lineTo(X(hx+Math.cos(a1)*len),Z(hz+Math.sin(a1)*len)); g.stroke();
      g.lineWidth=0.8; g.setLineDash([3,3]); g.beginPath(); g.arc(X(hx),Z(hz),len*sc,Math.min(a0,a1),Math.max(a0,a1)); g.stroke(); g.setLineDash([]); });
    g.restore(); g.textAlign='center'; g.textBaseline='middle';
    Object.keys(G.big).forEach(function(n){ const r=G.big[n].r, w=(r.x1-r.x0)*SX*sc-12, h=(r.y1-r.y0)*SZ*sc-4, x=X(WX(l,(r.x0+r.x1)/2)), y=Z(WZ(l,(r.y0+r.y1)/2));
      const jt=/約 ([\d.]+) 帖/.exec(r.j), jo=jt?+jt[1]:(G.area[n]||0)/JO, a=jt?jo*JO:G.area[n]||0, out=r.w==='outside', stair=n==='階梯', sub=/帖/.test(r.j)||r.j===n?'':r.j;   // a 帖 figure in the label wins (the LDK counts its kitchen)
      const L=[[n,13,'700','#1d2833']]; if(!stair) L.push([a.toFixed(1)+' m²'+(out?'':'（約 '+jo.toFixed(1)+' 帖）'),11,'500','#4b5866',a.toFixed(1)+' m²']); if(sub) L.push([sub,10,'400','#7a8590']);
      const wid=function(q,k){ g.font=q[2]+' '+(q[1]*k)+'px '+FONT; return g.measureText(q[0]).width; };
      let k=Math.min(1.15,Math.max(0.7,sc/52)); while(k>0.7&&L.some(function(q){ return wid(q,k)>w; })) k-=0.03;
      L.forEach(function(q){ if(q[4]&&wid(q,k)>w+2) q[0]=q[4]; });   // too narrow for the 帖 figure: m² only
      const lines=L.filter(function(q,i){ return i===0||wid(q,k)<=w+2; }).map(function(q){ return [q[0],q[1]*k,q[2],q[3]]; });
      while(lines.length>1&&lines.reduce(function(s,q){ return s+q[1]*1.25; },0)>h) lines.pop();
      let yy=y-lines.reduce(function(s,q){ return s+q[1]*1.25; },0)/2;
      lines.forEach(function(q){ g.font=q[2]+' '+q[1]+'px '+FONT; let s=q[0]; while(s.length>2&&g.measureText(s).width>w+4) s=s.slice(0,-2)+'…'; text(s,x,yy+q[1]*0.625,q[1],q[2],q[3]); yy+=q[1]*1.25; }); });
    if(G.ext){ const e=G.ext, x0=X(WX(l,e[0])), x1=X(WX(l,e[2])), z0=Z(WZ(l,e[1])), z1=Z(WZ(l,e[3])), W=(e[2]-e[0])*SX, D=(e[3]-e[1])*SZ;   // overall dimensions of the indoor part
      g.strokeStyle='#6b7783'; g.lineWidth=1; g.beginPath(); const ty=PAD.t-20, tx=PAD.l-22;
      g.moveTo(x0,ty); g.lineTo(x1,ty); g.moveTo(x0,ty-5); g.lineTo(x0,ty+5); g.moveTo(x1,ty-5); g.lineTo(x1,ty+5);
      g.moveTo(tx,z0); g.lineTo(tx,z1); g.moveTo(tx-5,z0); g.lineTo(tx+5,z0); g.moveTo(tx-5,z1); g.lineTo(tx+5,z1); g.stroke();
      const lab=function(s,x,y,rot){ g.save(); g.translate(x,y); g.rotate(rot); g.font='600 11.5px '+FONT; const tw=g.measureText(s).width+8; g.fillStyle='#fdfcf9'; g.fillRect(-tw/2,-8,tw,16); text(s,0,0.5,11.5,'600','#3d4955'); g.restore(); };
      lab(W.toFixed(2).replace(/0$/,'')+' m',(x0+x1)/2,ty,0); lab(D.toFixed(2).replace(/0$/,'')+' m',tx,(z0+z1)/2,-Math.PI/2);
      foot.textContent=(l+1)+'F・外牆範圍約 '+W.toFixed(1)+' × '+D.toFixed(1)+' m・點房間即可傳送過去'; }
    const nx=cv.clientWidth-19, ny=PAD.t+12;                                 // north arrow
    g.fillStyle='#2e3842'; g.beginPath(); g.moveTo(nx,ny-12); g.lineTo(nx+7,ny+8); g.lineTo(nx,ny+4); g.lineTo(nx-7,ny+8); g.closePath(); g.fill(); text('N',nx,ny+17,11,'700','#2e3842');
    const sx=PAD.l, sy=cv.clientHeight-18;                                            // 1 m scale bar
    g.fillStyle='#2e3842'; g.fillRect(sx,sy-3,sc/2,6); g.strokeStyle='#2e3842'; g.lineWidth=1; g.strokeRect(sx+0.5,sy-2.5,sc-1,5); g.textAlign='left'; text('1 m',sx+sc+6,sy+0.5,11,'600','#3d4955'); g.textAlign='center';
    if(levelOf(player.py)===l){ const px=X(player.x), pz=Z(player.z), fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw), a=Math.atan2(fz,fx);
      g.fillStyle='rgba(232,103,42,.22)'; g.beginPath(); g.moveTo(px,pz); g.arc(px,pz,Math.max(34,sc*1.1),a-0.55,a+0.55); g.closePath(); g.fill();
      g.save(); g.translate(px,pz); g.rotate(a); g.fillStyle='#e8672a'; g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(11,0); g.lineTo(-7,-7.5); g.lineTo(-3,0); g.lineTo(-7,7.5); g.closePath(); g.stroke(); g.fill(); g.restore(); }
  }
  function roomAtPx(e){ const rc=cv.getBoundingClientRect(), x=(e.clientX-rc.left)/rc.width*cv.clientWidth, y=(e.clientY-rc.top)/rc.height*cv.clientHeight;
    const wx=(x-PAD.l)/sc+ox, wz=(y-PAD.t)/sc+oz, r=roomAt(cur,wx,wz); return r===OUT?null:r; }
  function setTab(l){ cur=l; hover=null; Array.from(tabs.children).forEach(function(t){ const on=+t.dataset.l===l; t.setAttribute('aria-selected',on); t.tabIndex=on?0:-1; }); summary(); draw(); }
  LVS.forEach(function(l){ const t=document.createElement('button'); t.type='button'; t.className='tog'; t.setAttribute('role','tab'); t.dataset.l=l; t.textContent=(l+1)+'F'; t.addEventListener('click',function(){ setTab(l); }); tabs.appendChild(t); });
  function open(){ if(!geo) build(); Object.keys(keys).forEach(function(k){ keys[k]=false; }); prevFocus=document.activeElement; wrap.hidden=false; sheet.hidden=true;
    const l=levelOf(player.py); cur=LVS.indexOf(l)>=0?l:LVS[0]; summary(); layout(); setTab(cur); card.querySelector('.x').focus({preventScroll:true}); }
  function close(){ if(wrap.hidden) return; wrap.hidden=true; if(prevFocus&&prevFocus.focus) prevFocus.focus({preventScroll:true}); }
  btn.addEventListener('click',function(){ wrap.hidden?open():close(); });
  card.querySelector('.x').addEventListener('click',close);
  wrap.addEventListener('click',function(e){ if(e.target===wrap) close(); });
  cv.addEventListener('pointermove',function(e){ if(e.pointerType!=='mouse') return; const r=roomAtPx(e), n=r?r.n:null; cv.style.cursor=r?'pointer':''; cv.title=r?'傳送到 '+r.n:''; if(n!==hover){ hover=n; draw(); } });
  cv.addEventListener('pointerleave',function(){ if(hover){ hover=null; draw(); } });
  cv.addEventListener('click',function(e){ const r=roomAtPx(e); if(!r) return; const t=geo[cur].big[r.n].r;
    teleport([r.n,(t.x0+t.x1)/2,(t.y0+t.y1)/2,cur,0,player.yaw,0]); if(mode!=='walk') setMode('walk'); close(); updateRoom(); updateAct(); toast('已傳送到 '+(cur+1)+'F '+r.n); });
  window.addEventListener('keydown',function(e){ const typing=e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if(e.code==='KeyM'&&!typing&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){ e.preventDefault(); e.stopImmediatePropagation(); wrap.hidden?open():close(); return; }
    if(wrap.hidden) return; e.stopImmediatePropagation();
    if(e.code==='Escape'){ e.preventDefault(); close(); }
    else if(/^Digit[1-3]$/.test(e.code)&&LVS.indexOf(+e.code.slice(5)-1)>=0) setTab(+e.code.slice(5)-1);
    else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){ e.preventDefault(); const i=LVS.indexOf(cur)+(e.code==='ArrowRight'?1:-1); if(i>=0&&i<LVS.length){ setTab(LVS[i]); tabs.children[i].focus(); } } },true);
  window.addEventListener('resize',function(){ if(!wrap.hidden){ layout(); draw(); } });
  return {open:open,close:close,get isOpen(){ return !wrap.hidden; }};
})();
const ray=new THREE.Raycaster(); ray.far=40;
function updateDist(){ camera.updateMatrixWorld(); ray.setFromCamera({x:0,y:0},camera); const hit=ray.intersectObjects(scene.children.filter(function(o){ return o.visible; }),true).filter(function(h){ return h.object.material&&!h.object.material.transparent&&h.object.material!==lampMat; })[0]; $('dist').textContent=hit?('前方 '+hit.distance.toFixed(2)+' m'):'前方 —'; }

/* ---------- loop ---------- */
function stepPlayer(dt){
  let mx=joy.x, mz=-joy.y; if(keys.KeyW||keys.ArrowUp) mz+=1; if(keys.KeyS||keys.ArrowDown) mz-=1; if(keys.KeyD) mx+=1; if(keys.KeyA) mx-=1;
  const turn=(keys.ArrowLeft?1:0)-(keys.ArrowRight?1:0);
  if(turn){ if(mode==='walk') player.yaw+=turn*1.8*dt; else orb.yaw+=turn*1.2*dt; }
  if(seat){ if(mx||mz){ player.x=seat.exit[0]; player.z=seat.exit[1]; seat=null; } return; }
  const len=Math.hypot(mx,mz); if(len>1){ mx/=len; mz/=len; }
  const run=crouch?0.5:(keys.ShiftLeft||keys.ShiftRight)?2:1, bs=mode==='walk'?player.yaw:orb.yaw;
  const fxv=-Math.sin(bs), fzv=-Math.cos(bs), rx=Math.cos(bs), rz=-Math.sin(bs);
  const vx=(fxv*mz+rx*mx)*SPEED*run, vz=(fzv*mz+rz*mx)*SPEED*run;
  if(vx||vz){ const p=resolve(player.x+vx*dt,player.z+vz*dt,player.py); player.x=p[0]; player.z=p[1]; if(mode==='over') player.yaw=Math.atan2(-vx,-vz); }
}
let last=performance.now(), frame=0, first=true, perf=null, lightT=0, lightAt=null;
function walkLevels(){                         // storeys that can be seen: the own one and those below (through the windows); all of them outdoors or by the stairwell
  const l=levelOf(player.py), r=roomAt(l,player.x,player.z);
  if(r===OUT||r.n==='陽台'||r.n==='階梯'||(player.x>ST.x0-SZN[0]&&player.x<ST.x1+SZN[0]&&player.z>Math.min(flightZ(0).zn,flightZ(1).zn)-SZN[1]&&player.z<Math.max(flightZ(0).zs,flightZ(1).zs)+SZN[2])) return [0,1,2];
  const v=[]; for(let i=0;i<=l;i++) v.push(i);
  if(l<2){ stairBox.min.set(ST.x0-0.1,base(l)+CH-0.2,flightZ(l).zn-0.1); stairBox.max.set(ST.x1+0.1,base(l+1)+0.3,flightZ(l).zs+0.1);   // the stairwell opening above shows the next storey
    camera.updateMatrixWorld(); camFr.setFromProjectionMatrix(camMat.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)); if(camFr.intersectsBox(stairBox)) v.push(l+1); }
  return v;
}
const SZN=H.stairZone||[0.6,1.2,1.2];       // around the stairwell every storey is drawn: [x margin, north margin, south margin]
const stairBox=new THREE.Box3(), camFr=new THREE.Frustum(), camMat=new THREE.Matrix4();
function tick(now){
  requestAnimationFrame(tick);
  if(Walk.Perf.paused||(perf&&!perf.ready)){ last=now||last; return; }
  const t=now||last, raw=Math.min(0.15,(t-last)/1000)||0.016; last=t; frame++;
  let busy=false;
  for(let rest=raw;rest>1e-6;rest-=0.04){ const dt=Math.min(0.04,rest); updateDoors(dt); stepPlayer(dt); }   // long frames still move the full distance, in collision-safe steps
  const dt=Math.min(0.05,raw);
  if(doors.some(function(d){ return d.t!==(d.open?1:0); })) busy=true;
  const onStair=roomAt(levelOf(player.py),player.x,player.z).n==='階梯';
  M.footLed.color.setHex(onStair?0xffe2b0:0x5a4a38); if(onStair!==glowStair){ glowStair=onStair; updateGlow(); }
  for(let i=0;i<modeAnims.length;i++) modeAnims[i](t/1000);
  for(let i=0;i<furnAnims.length;i++){ const a=furnAnims[i]; if(a.live()&&a.f(t/1000,{})){ renderer.shadowMap.needsUpdate=true; busy=true; } }
  const fy=floorAt(player.x,player.z,player.py);
  player.camY+=(fy-player.camY)*Math.min(1,dt*9); player.py=fy; crouchT+=((crouch?1:0)-crouchT)*Math.min(1,dt*10);
  avatar.visible=mode==='over'; avatar.position.set(player.x,player.camY,player.z); avatar.rotation.y=player.yaw;
  updateCamera();
  if(frame%4===0){ updateRoom(); updateAct(); } if(hov.on&&(hov.dirty||frame%4===0)) pickHover(); else if(!hov.on&&hov.t) pickHover();
  if(mode==='walk'&&frame%6===0) updateDist();
  if(perf){
    lightT+=dt; const lv=mode==='walk'?walkLevels():[clamp(viewLevel-1,0,2)], here=camera.position;
    if(lightT>0.15||!lightAt||lightAt.distanceToSquared(here)>0.25){ lightT=0; lightAt=(lightAt||new THREE.Vector3()).copy(here); perf.lights.update(here,lv); if(mode==='walk') LG.forEach(function(g,i){ const v=lv.indexOf(i)>=0; if(g.visible!==v){ g.visible=v; renderer.shadowMap.needsUpdate=true; } }); }
    if(frame%6===0) perf.cull.update(camera,mode==='walk'?0.01:0.014);
    const e=camera.matrixWorld.elements, sig=mode+viewLevel+':'+e.map(function(v){ return v.toFixed(3); }).join(',');
    busy=busy||sportOn||dailyOn||cookOn||sleepOn||bbqOn||FS.isEditing()||renderer.shadowMap.needsUpdate;
    perf.overlay.frame(dt);
    if(!perf.gov.frame(dt,sig,busy)&&!first) return;
  }
  if(frame%2===0) drawMini();
  if(sceneryTick) sceneryTick(); if(window.__styleTick) window.__styleTick(); post.render();
  if(first){ first=false; loadEl.hidden=true; setTimeout(restoreState,400); }
}


/* remembered state: menu toggles and modes, and open/closed fittings, per house (shadows, perf and furniture visibility are global viewer prefs) */
const PKEY=(H.storageKey||'walk')+'.', MODES=['tDaily','tCook','tSleep','tSport','tBbq'], GLOBALS=['tShadow','tPerf','tFurn'], TOGGLES=['tTv','tCurt','tHeat'];
const lsGet=function(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }, lsSet=function(k,v){ try{ if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(_){} };
const tKey=function(id){ return (GLOBALS.indexOf(id)>=0?'walk.':PKEY)+id; };
const ACT_RE=/^(打開|拉開|拉出|推開|撥開|展開|放下吧台|收起吧台|折起來|躺平)/, ACT_SKIP=/層板|開始|充電|門栓|鎖/;
function watchState(){
  GLOBALS.concat(TOGGLES,MODES).forEach(function(id){ const b=$(id); if(!b) return;
    new MutationObserver(function(){ const on=b.getAttribute('aria-pressed')==='true'; if(MODES.indexOf(id)>=0){ if(on) lsSet(PKEY+'mode',id); else if(lsGet(PKEY+'mode')===id) lsSet(PKEY+'mode',null); } else lsSet(tKey(id),on?'1':'0'); }).observe(b,{attributes:true,attributeFilter:['aria-pressed']}); });
  const seen={}; furnThings.forEach(function(t){ let l=''; try{ l=String(t.label()); }catch(_){ return; } if(!ACT_RE.test(l)||ACT_SKIP.test(l)||t.__pk) return;
    const k=PKEY+'act.'+l+(seen[l]?'#'+seen[l]:''); seen[l]=(seen[l]||0)+1; const orig=t.act; t.__pk=k; t.__orig=orig;
    t.act=function(){ orig.apply(t,arguments); lsSet(k,lsGet(k)==='1'?null:'1'); }; });
}
function restoreState(){
  quietToast=true;
  try{
    GLOBALS.forEach(function(id){ const b=$(id), v=lsGet(tKey(id)); if(b&&v!==null&&(b.getAttribute('aria-pressed')==='true')!==(v==='1')) b.click(); });
    const m=lsGet(PKEY+'mode'), mb=m&&$(m); if(mb&&mb.getAttribute('aria-pressed')!=='true') mb.click();
    TOGGLES.forEach(function(id){ const b=$(id), v=lsGet(tKey(id)); if(b&&v!==null&&(b.getAttribute('aria-pressed')==='true')!==(v==='1')) b.click(); });
    watchState();
    furnThings.forEach(function(t){ if(t.__pk&&lsGet(t.__pk)==='1'){ try{ if(!t.on||t.on()) t.__orig(); else lsSet(t.__pk,null); }catch(_){ lsSet(t.__pk,null); } } });
  }catch(e){ console.warn('restore',e); }
  setTimeout(function(){ quietToast=false; },600);
}
/* ---------- life modes (same as Ctype): TV, curtains, daily, cooking, sleeping, sport; people come from lib/people.js and follow the furniture they use ---------- */
const People=Walk.People(THREE,lam,fab), S1=0.01213, modeAnims=[];
const modeGroup=function(l){ const g=new THREE.Group(); g.userData.keep=true; g.visible=false; g.position.y=base(l); LG[l].add(g); return g; };
const mover=function(id){ return FS.movers.find(function(m){ return m.id===id; }); };
const usable=function(id){ const m=mover(id); return !!m&&!FS.isStored(id)&&(!m.W.userData.lay||m.W.userData.lay===curLayout); };
const at=function(id,l,px,py){ return FS.xf(id,WX(l,px),WZ(l,py)); };          // default plan point of a piece -> where it is now [x,z,yaw]
const btn=function(id,v){ $(id).setAttribute('aria-pressed',String(v)); };
function setTv(on){ tvList.forEach(function(t){ t.tvOn(on); }); btn('tTv',on); renderer.shadowMap.needsUpdate=true; }
$('tTv').addEventListener('click',function(){ setTv(this.getAttribute('aria-pressed')!=='true'); });
$('tCurt').addEventListener('click',function(){ const v=this.getAttribute('aria-pressed')!=='true'; btn('tCurt',v); curtainSets.forEach(function(c){ c.open.closed=v; }); });
H.modes(E);                                      // the house's life modes (sport, daily, cooking, sleeping) and their buttons
function liftId(){ return (H.liftIds||{})[curLayout]||'lift'; }
function syncFold(){ const m=mover(liftId()), up=!!(m&&m.piece.lift.up); $('tFold').textContent=up?'升降桌：餐桌模式':'升降桌：茶几模式'; btn('tFold',up); }
$('tFold').addEventListener('click',function(){ const m=mover(liftId()); if(!m) return; m.piece.lift.up=!m.piece.lift.up; syncFold(); });
function setLayout(n){
  curLayout=n===2?2:1;
  FSU.variantChanged(); rebuild();
  document.querySelectorAll('#layBtns button').forEach(function(b){ btn2(b,+b.getAttribute('data-l')===curLayout); });
  $('foldRow').hidden=!usable(liftId()); syncFold();
  const p=resolve(player.x,player.z,player.py); player.x=p[0]; player.z=p[1];
  try{ localStorage.setItem(H.id+'Layout',String(curLayout)); }catch(_){}
  FS_onChange(); updateAct();
}
function btn2(b,v){ b.setAttribute('aria-pressed',String(v)); }
document.querySelectorAll('#layBtns button').forEach(function(b){ b.addEventListener('click',function(){ setLayout(+b.getAttribute('data-l')); }); });
const FSU=FS.initUI({
  scene:scene,camera:camera,canvas:canvas,orb:orb,uiRoot:$('hud'),toggleButton:$('tEdit'),
  allCols:function(lv){ return allCols.filter(function(c){ return c.l===lv; }); },rebuild:rebuild,toast:toast,
  inside:function(x,z,lv){ const r=roomAt(lv,x,z); return r!==OUT&&r.n!=='階梯'; },
  getMode:function(){ return mode; },setMode:setMode,closeMenu:function(){ sheet.hidden=true; },pointerCount:function(){ return ptrs.size; },
  onEditToggle:function(on){ if(on){ viewLevel=levelOf(player.py)+1; roofOn(false); applyLevelVis(); orb.yaw=0; orb.pitch=1.42; orb.dist=22; orb.tx=3.15; orb.tz=4.6; } },
  onChange:function(){ FS_onChange(); },
  types:function(){ return Catalog.TYPES; },preview:function(t){ return Catalog.make(t).group; },
  wallSnap:function(x,z,lv){ const b=base(lv); return Walk.snapToWalls(walls.filter(function(c){ return c.l===lv&&c.kind==='w'&&c.y0<=b+1.0&&c.y1>=b+1.8&&Math.min(c.x1-c.x0,c.z1-c.z0)>=0.085; }),x,z,1.0); },
  dropLevel:function(){ return clamp(viewLevel-1,0,2); },dropY:function(){ return base(clamp(viewLevel-1,0,2)); }
});
(function(){ let n=1; try{ n=+(new URLSearchParams(location.search).get('layout')||localStorage.getItem(H.id+'Layout')||1); }catch(_){} setLayout(n); })();
(function(){ let q=null; try{ q=JSON.parse(localStorage.getItem(POS_KEY)); }catch(_){}
  if(!q||![q.x,q.z,q.py,q.yaw,q.pitch].every(isFinite)) return;
  player.x=q.x; player.z=q.z; player.py=q.py; player.yaw=q.yaw; player.pitch=q.pitch;
  const p=resolve(player.x,player.z,player.py); player.x=p[0]; player.z=p[1]; player.camY=floorAt(player.x,player.z,player.py); player.py=player.camY; })();
let slideBx=null;
function slideBoxes(){ if(slideBx) return slideBx; slideBx=[]; scene.updateMatrixWorld(true);
  scene.traverse(function(m){ if(!m.isMesh||!m.visible) return; if(!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const bb=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld), sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    if((sx>1.6)+(sy>2.2)+(sz>1.6)>=2) return; slideBx.push({own:m.parent,x0:bb.min.x,x1:bb.max.x,y0:bb.min.y,y1:bb.max.y,z0:bb.min.z,z1:bb.max.z}); });
  return slideBx; }
slidePending.forEach(function(f){ f(); }); slideBx=null;
setSun(14); setMode('walk'); roofOn(true); updateRoom(); drawMini();
(function(){                                   // performance: merge the static building, nearest-lights pool, frame governor, FPS overlay
  const keep=new Set(); furnMeshes.forEach(function(o){ o.userData.wasFurn=true; });
  lightFixtures.forEach(function(g){ keep.add(g); }); labelGroups.forEach(function(g){ keep.add(g); }); ldkFloors.forEach(function(m){ keep.add(m); });
  if(roofMesh) keep.add(roofMesh); keep.add(avatar);
  Walk.Perf.trimShadows(LG.concat([ground]),0.07);
  const named=new Set(); [M,FL,WM].forEach(function(o){ Object.keys(o).forEach(function(k){ if(o[k]&&o[k].isMaterial) named.add(o[k]); }); });
  Walk.Perf.shareMaterials(LG.concat([ground]),named);
  const st=Walk.Perf.mergeStatic(THREE,mergeGeometries,LG.concat([ground]),keep,function(rem,add){ rem.forEach(function(o){ const i=furnMeshes.indexOf(o); if(i>=0) furnMeshes.splice(i,1); }); if(rem.some(function(o){ return o.userData.wasFurn; })) furnMeshes.push.apply(furnMeshes,add); });
  
  const per=LG.map(function(g){ let n=0; g.traverse(function(o){ if(o.isPointLight) n++; }); return n; });
  const lights=Walk.Perf.NearLights(THREE,scene,LG,Math.min(16,Math.max.apply(null,per)));
  const gov=Walk.Perf.Governor({renderer:renderer,pixelRatio:pixelRatio,onResize:resize,degrade:function(step){
    if(step===1) window.__aoOff();
    if(step===3){ scene.traverse(function(o){ if(o.isDirectionalLight&&o.castShadow&&o.shadow.mapSize.x>1024){ o.shadow.mapSize.set(1024,1024); if(o.shadow.map){ o.shadow.map.dispose(); o.shadow.map=null; } } }); renderer.shadowMap.needsUpdate=true; }
  }});
  const overlay=Walk.Perf.Overlay(renderer,function(){ return '光源 '+lights.K+' 盞・物件 '+st.before+' → '+st.after+(gov.step?'\n自動降畫質 第 '+gov.step+' 段':''); });
  $('tPerf').addEventListener('click',function(){ overlay.on=!overlay.on; this.setAttribute('aria-pressed',String(overlay.on)); });
  const cull=Walk.Perf.DetailCull(THREE,LG.concat([ground]));
  perf={lights:lights,gov:gov,overlay:overlay,stats:st,cull:cull,ready:false};
  loadStatus.set('下載貼圖');
  Walk.Perf.precompile(THREE,renderer,scene,camera,LG,FIN.whenLoaded().then(function(){ loadStatus.set('準備畫面',0.8); })).then(function(){ perf.ready=true; renderer.shadowMap.needsUpdate=true; });   // every storey's shaders, so the first visit to a floor does not stall
  renderer.shadowMap.needsUpdate=true;
})();
requestAnimationFrame(tick);

(function(){
  if(window.parent===window) return;
  window.addEventListener('message',function(e){
    const d=e.data; if(e.source!==window.parent||e.origin!==location.origin||!d||d.type!=='house-list') return;
    const box=$('houseBtns'); Walk.renderHouses(box,d);
    box.hidden=false; $('houseH').hidden=false;
  });
  window.parent.postMessage({type:'house-ready'},location.origin);
})();
if(location.hash==="#debug"){ window.__walk={get perf(){ return perf; },setLayout:setLayout,mover:function(id){ return FS.movers.find(function(m){ return m.id===id; }); },furnThings:furnThings,roomAt:roomAt,player:player,resolve:resolve,floorAt:floorAt,setMode:setMode,teleport:teleport,SPOTS:SPOTS,orb:orb,doors:doors,setDoor:setDoor,scene:scene,camera:camera,renderer:renderer,levelOf:levelOf,setView:function(v){ viewLevel=v; roofOn(v>=3&&false); applyLevelVis(); },roofOn:roofOn,cols:function(){return allCols;},Catalog:Catalog,FS:FS,FSU:FSU,updateCamera:updateCamera,keys:keys,stepPlayer:stepPlayer,tvList:tvList}; }
}
})();
  };
})(window);
