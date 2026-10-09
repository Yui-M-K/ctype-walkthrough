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
  get FS_onChange(){ return FS_onChange; }, set FS_onChange(v){ FS_onChange=v; },
  get fitUV(){ return fitUV; },
  get bx(){ return bx; },
  get rbox(){ return rbox; },
  get cylm(){ return cylm; },
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
const post=Walk.Look({THREE:THREE,renderer:renderer,scene:scene,camera:camera,EffectComposer:EffectComposer,RenderPass:RenderPass,GTAOPass:GTAOPass,OutputPass:OutputPass,HDRLoader:HDRLoader,envUrl:'textures/env_lebombo_512.hdr',aoWhen:function(){ return mode==='walk'; }});

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
M.frost=lam(0xf4fbff,{transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false,roughness:0.6}); M.mesh=lam(0x3a3d42,{transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false,roughness:0.9}); M.footLed=new THREE.MeshBasicMaterial({color:0xffe2b0});
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
const walls=[], doors=[], furnCols=[], floorRects=[], ramps=[], furnMeshes=[], pointLights=[];
let curLayout=1, furnOn=true, shadowOn=true, sleepOn=false, dailyOn=false, cookOn=false, sportOn=false, FS_onChange=function(){};
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
function winFrame(grp,horiz,c,a,b,y0,y1,t){
  const f=0.045, tt=t+0.02;
  if(horiz){ bx(grp,a,b,c-tt/2,c+tt/2,y0,y0+f,M.frame,{cast:false}); bx(grp,a,b,c-tt/2,c+tt/2,y1-f,y1,M.frame,{cast:false}); bx(grp,a,a+f,c-tt/2,c+tt/2,y0,y1,M.frame,{cast:false}); bx(grp,b-f,b,c-tt/2,c+tt/2,y0,y1,M.frame,{cast:false}); }
  else { bx(grp,c-tt/2,c+tt/2,a,b,y0,y0+f,M.frame,{cast:false}); bx(grp,c-tt/2,c+tt/2,a,b,y1-f,y1,M.frame,{cast:false}); bx(grp,c-tt/2,c+tt/2,a,a+f,y0,y1,M.frame,{cast:false}); bx(grp,c-tt/2,c+tt/2,b-f,b,y0,y1,M.frame,{cast:false}); }
}
function wall(l,x0,y0,x1,y1,t,opens){
  const grp=LG[l], b=base(l), horiz=y0===y1, H=CH;
  const c=horiz?WZ(l,y0):WX(l,x0);
  const A=horiz?WX(l,Math.min(x0,x1)):WZ(l,Math.min(y0,y1)), B=horiz?WX(l,Math.max(x0,x1)):WZ(l,Math.max(y0,y1));
  const ap=horiz?LV[l].ox:LV[l].oy;
  const ops=(opens||[]).map(function(o){ return {a:(o.a-ap)*(horiz?SX:SZ),b:(o.b-ap)*(horiz?SX:SZ),k:o.k||'win',sill:o.sill,head:o.head,hinge:o.hinge||'a',sw:o.sw||1,mat:o.mat,frost:o.frost}; }).sort(function(p,q){return p.a-q.a;});
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
    else if(k==='slide'||k==='slide2') makeSlide(l,horiz,c,o,t,head,k==='slide2'?2:1);
    else if(k==='open'){ const f=0.04; if(horiz){ bx(grp,o.a,o.a+f,c-t/2-0.005,c+t/2+0.005,b,b+head,M.frame,{cast:false}); bx(grp,o.b-f,o.b,c-t/2-0.005,c+t/2+0.005,b,b+head,M.frame,{cast:false}); } else { bx(grp,c-t/2-0.005,c+t/2+0.005,o.a,o.a+f,b,b+head,M.frame,{cast:false}); bx(grp,c-t/2-0.005,c+t/2+0.005,o.b-f,o.b,b,b+head,M.frame,{cast:false}); } }
  });
  piece(cur,B,0,H,true);
}
function makeDoor(l,horiz,c,o,t,head){
  const b=base(l), w=o.b-o.a, pv=new THREE.Group(), leaf=new THREE.Group();
  winFrame(LG[l],horiz,c,o.a,o.b,b,b+head,t);
  const hingeA=o.hinge==='a', hp=hingeA?o.a:o.b, dir=hingeA?1:-1;
  const lm=new THREE.Mesh(new THREE.BoxGeometry(horiz?w-0.06:0.04,head-0.05,horiz?0.04:w-0.06),o.mat||M.door); lm.castShadow=lm.receiveShadow=true;
  const off=dir*(w/2);
  if(horiz){ pv.position.set(hp,b+head/2,c); lm.position.set(off,0,0); } else { pv.position.set(c,b+head/2,hp); lm.position.set(0,0,off); }
  const kn=new THREE.Mesh(new THREE.SphereGeometry(0.025,8,6),M.steel);
  if(horiz) kn.position.set(dir*(w-0.12),0,0.03); else kn.position.set(0.03,0,dir*(w-0.12));
  leaf.add(lm); leaf.add(kn); pv.add(leaf); LG[l].add(pv);
  let th; if(horiz) th=hingeA?-o.sw*Math.PI/2:o.sw*Math.PI/2; else th=hingeA?o.sw*Math.PI/2:-o.sw*Math.PI/2;
  const col=horiz?addCol(l,o.a,o.b,c-0.05,c+0.05,b,b+head,'d'):addCol(l,c-0.05,c+0.05,o.a,o.b,b,b+head,'d');
  const d={l:l,pv:pv,th:th,open:false,t:0,col:col,mid:horiz?[(o.a+o.b)/2,c]:[c,(o.a+o.b)/2]}; col.door=d; doors.push(d);
}
function makeSlide(l,horiz,c,o,t,head,n){      // sliding door: one leaf disappears into the wall toward the hinge side; two leaves (slide2) stack on the far half
  const b=base(l), w=o.b-o.a, lw=w/n, glass=o.mat===M.glass||o.mat===M.frost, leaves=[];
  winFrame(LG[l],horiz,c,o.a,o.b,b,b+head,t);
  for(let i=0;i<n;i++){
    const g=new THREE.Group(), a0=o.a+lw*i, ctr=a0+lw/2, off=(n===2?(i?0.022:-0.022):0);
    const mk=function(x0,x1,y0,y1,z0,z1,mt,cast){ const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),mt); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); m.castShadow=cast!==false; m.receiveShadow=true; g.add(m); return m; };
    const L=-lw/2+0.01, Rr=lw/2-0.01, f=0.045;
    if(horiz){ g.position.set(ctr,b,c+off);
      mk(L,Rr,0.02,head-0.02,-0.018,0.018,glass?o.mat:(o.mat||M.door),!glass);
      if(glass){ mk(L,Rr,0.02,0.02+f,-0.02,0.02,M.frame); mk(L,Rr,head-0.02-f,head-0.02,-0.02,0.02,M.frame); mk(L,L+f,0.02,head-0.02,-0.02,0.02,M.frame); mk(Rr-f,Rr,0.02,head-0.02,-0.02,0.02,M.frame); }
      mk(i?L+0.03:Rr-0.05,i?L+0.05:Rr-0.03,0.95,1.25,-0.025,0.025,M.steel,false); }
    else { g.position.set(c+off,b,ctr);
      mk(-0.018,0.018,0.02,head-0.02,L,Rr,glass?o.mat:(o.mat||M.door),!glass);
      if(glass){ mk(-0.02,0.02,0.02,0.02+f,L,Rr,M.frame); mk(-0.02,0.02,head-0.02-f,head-0.02,L,Rr,M.frame); mk(-0.02,0.02,0.02,head-0.02,L,L+f,M.frame); mk(-0.02,0.02,0.02,head-0.02,Rr-f,Rr,M.frame); }
      mk(-0.025,0.025,0.95,1.25,i?L+0.03:Rr-0.05,i?L+0.05:Rr-0.03,M.steel,false); }
    LG[l].add(g); leaves.push(g);
  }
  const m=o.a+lw, dir=n===2?1:(o.hinge==='b'?1:-1);   // single leaf slides toward the hinge side; the first of two leaves slides behind the second
  const col=horiz?addCol(l,o.a,n===2?m:o.b,c-0.05,c+0.05,b,b+head,'d'):addCol(l,c-0.05,c+0.05,o.a,n===2?m:o.b,b,b+head,'d');
  if(n===2){ if(horiz) addCol(l,m,o.b,c-0.05,c+0.05,b,b+head,'w'); else addCol(l,c-0.05,c+0.05,m,o.b,b,b+head,'w'); }
  const d={l:l,slide:true,leaf:leaves[0],axis:horiz?'x':'z',base0:horiz?leaves[0].position.x:leaves[0].position.z,shift:dir*lw,th:0,pv:leaves[0],open:false,t:0,col:col,mid:horiz?[(o.a+o.b)/2,c]:[c,(o.a+o.b)/2]};
  col.door=d; doors.push(d);
}
function applyDoor(d){ const e=d.t*d.t*(3-2*d.t); if(d.slide) d.leaf.position[d.axis]=d.base0+d.shift*e; else d.pv.rotation.y=d.th*e; }
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
function flight(l){
  const b=base(l), L=ST.zs-ST.zn, run=L/ST.N, rise=SH/ST.N, w=ST.x1-ST.x0;
  for(let i=0;i<ST.N;i++){
    const zz=ST.zs-(i+1)*run, top=b+(i+1)*rise;
    bx(LG[l],ST.x0,ST.x1,zz,zz+run,top-0.05,top,M.oak);
    bx(LG[l],ST.x0,ST.x1,zz+run-0.02,zz+run,top-rise,top-0.05,M.cabF,{cast:false});
    if(ST.footLeds!==false&&i%3===1){ const m=bx(LG[l],ST.x0+0.03,ST.x0+0.04,zz+0.06,zz+run-0.06,top-rise+0.02,top-rise+0.035,M.footLed,{cast:false,recv:false}); footLights.push(m); }   // sensor foot lights on the wall side
  }
  [[ST.x0,ST.x0+0.025],[ST.x1-0.025,ST.x1]].forEach(function(xr){ stringer(l,xr[0],xr[1]); });
  (function(){                                  // plastered soffit under the flight, so it reads as a closed stair from below
    const k=SH/L, za=ST.zs-0.12/k, zb=ST.zn, ya=b, yb=b+SH-0.12, d=Math.hypot(za-zb,yb-ya);
    const m=new THREE.Mesh(new THREE.BoxGeometry(ST.x1-ST.x0-(ST.soffitGap||0),0.02,d),WM.hall); m.position.set((ST.x0+ST.x1)/2,(ya+yb)/2-0.01,(za+zb)/2); m.rotation.x=Math.atan2(yb-ya,za-zb); m.receiveShadow=true; LG[l].add(m);
  })();
  ramps.push({l:l,x0:ST.x0,x1:ST.x1,zs:ST.zs,zn:ST.zn,y0:b});
}
function stringer(l,xa,xb){                    // side board that follows the steps, cut flush with the floor below and the floor above
  const b=base(l), L=ST.zs-ST.zn, k=SH/L, up=0.24, dn=0.12;
  const pts=[[ST.zs,b],[ST.zs,b+up],[ST.zs-(SH-up+0.06)/k,b+SH+0.06],[ST.zn,b+SH+0.06],[ST.zn,b+SH-dn],[ST.zs-dn/k,b]];
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
function handrail(l,wallFace,sd){                // sd = +1 rail stands off toward +x, -1 toward -x
  const RW=0.048, RH=0.03, L=ST.zs-ST.zn, run=L/ST.N, k=SH/L;
  const b=base(l), g=LG[l], rx=wallFace+sd*(0.055+RW/2), V=function(z,y){ return new THREE.Vector3(rx,y,z); };
  const z0=ST.zs-run*0.5, z1=ST.zn+run*0.5, y0=b+(ST.zs-z0)*k+0.85, y1=b+(ST.zs-z1)*k+0.85;
  const pts=[V(z0+0.3,y0),V(z0,y0),V(z1,y1),V(z1-0.3,y1)];
  for(let i=0;i<3;i++){ const ext=i===1?0:0.012, d=new THREE.Vector3().subVectors(pts[i+1],pts[i]).normalize();
    railBar(g,pts[i].clone().addScaledVector(d,-ext),pts[i+1].clone().addScaledVector(d,ext),RW,RH,RAIL.oak); }
  [pts[0],pts[3]].forEach(function(p){ const q=new THREE.Vector3(wallFace+sd*0.012,p.y,p.z); railBar(g,p.clone().setX(rx+sd*RW/2),q,RH,RH,RAIL.oak); });   // ends returned to the wall
  const led=function(a,c){ const da=a.clone(), dc=c.clone(); da.y-=RH/2+0.002; dc.y-=RH/2+0.002; railBar(g,da,dc,RW*0.45,0.004,M.footLed,true); };
  led(pts[1],pts[2]); led(pts[0],pts[1]); led(pts[2],pts[3]);
  for(let i=0;i<3;i++){ const wa=pts[i].clone().setX(wallFace+sd*0.004), wb=pts[i+1].clone().setX(wallFace+sd*0.004); wa.y-=RH/2; wb.y-=RH/2; glowQuad(g,wa,wb,new THREE.Vector3(0,-0.38,0),GLOW.stair); }   // the LED washes the wall below the rail
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
  const b=base(l), k=SH/(ST.zs-ST.zn), y=function(z){ return b+(ST.zs-z)*k; }, g=LG[l];
  const pts=[[zA,y(zA)+0.04],[zB,y(zB)+0.04],[zB,y(zB)+0.86],[zA,y(zA)+0.86]], geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([].concat.apply([],pts.map(function(q){ return [x,q[1],q[0]]; })),3)); geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
  const pane=new THREE.Mesh(geo,RAIL.glass); pane.renderOrder=1; g.add(pane);
  railBar(g,new THREE.Vector3(x,y(zA)+0.9,zA),new THREE.Vector3(x,y(zB)+0.9,zB),0.06,0.035,RAIL.oak);
  railBar(g,new THREE.Vector3(x,y(zA)+0.02,zA),new THREE.Vector3(x,y(zB)+0.02,zB),0.035,0.05,RAIL.black);
  addCol(l,x-0.03,x+0.03,Math.min(zA,zB),Math.max(zA,zB),b,b+SH+1,'w');
}
if(H.stairExtras) H.stairExtras(E);
function rampY(r,x,z){ if(x<r.x0-0.04||x>r.x1+0.04||z>r.zs||z<r.zn) return null; return r.y0+(r.zs-z)/(r.zs-r.zn)*SH; }
function floorAt(x,z,py){
  let best=-0.3;
  for(let i=0;i<floorRects.length;i++){ const f=floorRects[i]; if(f.y<=py+0.55&&f.y>best&&x>=f.x0-0.04&&x<=f.x1+0.04&&z>=f.z0-0.04&&z<=f.z1+0.04) best=f.y; }
  for(let i=0;i<ramps.length;i++){ const y=rampY(ramps[i],x,z); if(y!==null&&y<=py+0.55&&y>best) best=y; }
  return best;
}


/* ---------- catalogue furniture ---------- */
const Catalog=Walk.Catalog({THREE:THREE,M:M,lam:lam,fab:fab,get lampMat(){ return lampMat; },rnd:rnd,fabricTex:fabricTex,mirror:function(w,h){ return Walk.planarMirror(THREE,w,h); },contactShadow:contactShadow,ceilingH:CH,anisotropy:ANISO,enableLocalClipping:function(){ renderer.localClippingEnabled=true; }});
if(H.site) H.site(E);

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
    furnThings.push({get pt(){ const q=FS.xf(id,dx,dz); return [q[0],q[1]]; },get l(){ return m.lvCur; },on:live,label:a.label,act:function(){ a.act(); syncFold(); }});
  });
  return m;
}
/* default furnishing: [id, type, storey, plan x, plan y, facing N/E/S/W, (make)] — everything here is movable in edit mode;
   LAY1 ids exist only in layout 1, LAYOUT2 only in layout 2 */
const LAYOUT=H.layout(E), LAY1=H.lay1||{}, LAYOUT2=H.layout2?H.layout2(E):[];
LAYOUT.forEach(function(e){ const pc=e[6]?e[6]():null; if(pc) pc.type=e[1]; placeItem(e[0],e[1],e[2],WX(e[2],e[3]),WZ(e[2],e[4]),Catalog.turnsToFace(e[1],e[5]),pc,LAY1[e[0]]); });
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
  (piece.actions||[]).forEach(function(a){ furnThings.push({pt:[wx+a.x*c+a.z*sn,wz-a.x*sn+a.z*c],l:l,label:a.label,act:a.act}); });
  return Rg;
}
if(H.fixtures) H.fixtures(E);
/* ceiling lights, pendants over the island, indirect cove lighting in the living room and over the bed */
const lightFixtures=[];                       // hidden in the overview so they do not float above the cut-away rooms
function light(l,px,py,col,int,dist){
  const p=new THREE.PointLight(col||0xffe2b8,int*PLI,dist||6,2); p.position.set(WX(l,px),base(l)+CH-0.25,WZ(l,py)); LG[l].add(p); pointLights.push(p);
  const L=Catalog.ceilingLight(CH); L.group.position.set(WX(l,px),base(l),WZ(l,py)); LG[l].add(L.group); lightFixtures.push(L.group);
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
(H.curtains||[]).forEach(function(q){
  const l=q[0], side=q[1], horiz=side==='S'||side==='N', w=(q[3]-q[2])*(horiz?SX:SZ), mid=(q[2]+q[3])/2;
  const rot={S:0,E:1,N:2,W:3}[side], inward={S:[0,-1],E:[-1,0],N:[0,1],W:[1,0]}[side];
  const cx=horiz?WX(l,mid):WX(l,q[4])+inward[0]*0.17, cz=horiz?WZ(l,q[4])+inward[1]*0.17:WZ(l,mid);
  const P=Catalog.curtains(w), Rg=new THREE.Group(); Rg.position.set(cx,base(l),cz); Rg.rotation.y=rot*Math.PI/2; Rg.add(P.group); LG[l].add(Rg); Rg.userData.keep=true;
  P.auto=!!q[5]; curtainSets.push(P);
  P.anims.forEach(function(f){ furnAnims.push({live:function(){ return true; },f:f}); });
  P.actions.forEach(function(a){ const c=Math.cos(rot*Math.PI/2), sn=Math.sin(rot*Math.PI/2);
    furnThings.push({pt:[cx+a.x*c+a.z*sn,cz-a.x*sn+a.z*c],l:l,label:a.label,act:a.act}); });
});

/* ---------- rooms ---------- */
function roomAt(l,x,z){ const px=x/SX+LV[l].ox, py=z/SZ+LV[l].oy; for(let i=0;i<ROOMS.length;i++){ const r=ROOMS[i]; if(r.l===l&&px>=r.x0&&px<=r.x1&&py>=r.y0&&py<=r.y1) return r; } return OUT; }
function levelOf(py){ return clamp(Math.round((py+0.05)/SH),0,2); }

/* ---------- state ---------- */
const SPOTS=H.spots;
const player={x:WX(0,H.start[0]),z:WZ(0,H.start[1]),py:0,camY:0,yaw:0,pitch:0};
let userH=165, fovH=75, mode='walk', hour=14, viewLevel=3;
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
function updateCamera(){
  if(mode==='walk'){ camera.position.set(player.x,player.camY+userH*0.936/100,player.z); camera.rotation.set(player.pitch,player.yaw,0); }
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
window.addEventListener('keydown',function(e){ keys[e.code]=true; if(e.target&&e.target.tagName==='INPUT') return; if(e.code==='KeyF'&&!e.repeat) actNow(); if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code)>=0) e.preventDefault(); });
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
function toast(t){ toastEl.textContent=t; toastEl.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ toastEl.hidden=true; },1800); }
(function(){                                   // ambient occlusion: off by default (costly); remembered per device
  const b=$('tAO'); let on=false;
  try{ const v=localStorage.getItem('walkAO'); if(v!==null) on=v==='1'; }catch(_){}
  const set=function(v){ post.setAO(v); b.setAttribute('aria-pressed',String(v)); };
  set(on);
  b.addEventListener('click',function(){ const v=!post.aoOn; set(v); try{ localStorage.setItem('walkAO',v?'1':'0'); }catch(_){} });
  window.__aoOff=function(){ set(false); };
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
  if(!open){ const c=d.col, nx=clamp(player.x,c.x0,c.x1), nz=clamp(player.z,c.z0,c.z1); if(levelOf(player.py)===d.l&&Math.hypot(player.x-nx,player.z-nz)<R+0.15){ if(!quiet) toast('人站在門口，無法關上'); return false; } }
  d.open=open; rebuild(); return true;
}
const things=doors.map(function(d){ return {pt:d.mid,l:d.l,label:function(){ return d.label?d.label(d.open):d.slide?(d.open?'拉上拉門':'拉開拉門'):(d.open?'關門':'開門'); },act:function(){ setDoor(d,!d.open); }}; });
function updateAct(){
  let best=null, bd=1.35;
  if(mode==='walk'){
    const fxv=-Math.sin(player.yaw), fzv=-Math.cos(player.yaw), pl=levelOf(player.py);
    const here=roomAt(pl,player.x,player.z).n;
    things.concat(furnThings).forEach(function(t){ if(t.l!==pl||(t.on&&!t.on())) return;
      if(furnThings.indexOf(t)>=0){ if(roomAt(pl,t.pt[0],t.pt[1]).n!==here) return; }   // furniture and curtains: only from the same room, not through a wall
      const vx=t.pt[0]-player.x, vz=t.pt[1]-player.z, d=Math.hypot(vx,vz); if(d<bd&&(d<0.6||(vx*fxv+vz*fzv)/d>0.45)){ bd=d; best=t; } });
  }
  curThing=best; if(best){ bAct.textContent=best.label(); bAct.hidden=false; } else bAct.hidden=true;
}
function actNow(){ if(curThing){ curThing.act(); updateAct(); } }
bAct.addEventListener('click',actNow);
$('dOpen').addEventListener('click',function(){ doors.forEach(function(d){ setDoor(d,true,true); }); updateAct(); });
$('dClose').addEventListener('click',function(){ let n=0; doors.forEach(function(d){ if(!setDoor(d,false,true)) n++; }); updateAct(); if(n) toast('有 '+n+' 扇門因為有人站著而沒關上'); });
function updateDoors(dt){ let moved=false; doors.forEach(function(d){ const tt=d.open?1:0; if(d.t!==tt){ d.t=tt?Math.min(1,d.t+dt/0.45):Math.max(0,d.t-dt/0.45); applyDoor(d); moved=true; } }); if(moved) renderer.shadowMap.needsUpdate=true; }
function teleport(s){ const l=s[3]; player.x=WX(l,s[1]); player.z=WZ(l,s[2]); player.py=base(l); player.yaw=s[5]; player.pitch=0; const p=resolve(player.x,player.z,player.py); player.x=p[0]; player.z=p[1]; player.camY=floorAt(player.x,player.z,player.py); player.py=player.camY; }
SPOTS.forEach(function(s){ const b=document.createElement('button'); b.type='button'; b.textContent=s[0]; b.addEventListener('click',function(){ teleport(s); if(mode!=='walk') setMode('walk'); sheet.hidden=true; }); $('spots').appendChild(b); });

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
const ray=new THREE.Raycaster(); ray.far=40;
function updateDist(){ camera.updateMatrixWorld(); ray.setFromCamera({x:0,y:0},camera); const hit=ray.intersectObjects(scene.children.filter(function(o){ return o.visible; }),true).filter(function(h){ return h.object.material&&!h.object.material.transparent&&h.object.material!==lampMat; })[0]; $('dist').textContent=hit?('前方 '+hit.distance.toFixed(2)+' m'):'前方 —'; }

/* ---------- loop ---------- */
function stepPlayer(dt){
  let mx=joy.x, mz=-joy.y; if(keys.KeyW||keys.ArrowUp) mz+=1; if(keys.KeyS||keys.ArrowDown) mz-=1; if(keys.KeyD) mx+=1; if(keys.KeyA) mx-=1;
  const turn=((keys.ArrowLeft||keys.KeyQ)?1:0)-((keys.ArrowRight||keys.KeyE)?1:0);
  if(turn){ if(mode==='walk') player.yaw+=turn*1.8*dt; else orb.yaw+=turn*1.2*dt; }
  const len=Math.hypot(mx,mz); if(len>1){ mx/=len; mz/=len; }
  const run=(keys.ShiftLeft||keys.ShiftRight)?2:1, bs=mode==='walk'?player.yaw:orb.yaw;
  const fxv=-Math.sin(bs), fzv=-Math.cos(bs), rx=Math.cos(bs), rz=-Math.sin(bs);
  const vx=(fxv*mz+rx*mx)*SPEED*run, vz=(fzv*mz+rz*mx)*SPEED*run;
  if(vx||vz){ const p=resolve(player.x+vx*dt,player.z+vz*dt,player.py); player.x=p[0]; player.z=p[1]; if(mode==='over') player.yaw=Math.atan2(-vx,-vz); }
}
let last=performance.now(), frame=0, first=true, perf=null, lightT=0, lightAt=null;
function walkLevels(){                         // storeys that can be seen: the own one and those below (through the windows); all of them outdoors or by the stairwell
  const l=levelOf(player.py), r=roomAt(l,player.x,player.z);
  if(r===OUT||r.n==='陽台'||r.n==='階梯'||(player.x>ST.x0-SZN[0]&&player.x<ST.x1+SZN[0]&&player.z>ST.zn-SZN[1]&&player.z<ST.zs+SZN[2])) return [0,1,2];
  const v=[]; for(let i=0;i<=l;i++) v.push(i);
  if(l<2){ stairBox.min.set(ST.x0-0.1,base(l)+CH-0.2,ST.zn-0.1); stairBox.max.set(ST.x1+0.1,base(l+1)+0.3,ST.zs+0.1);   // the stairwell opening above shows the next storey
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
  player.camY+=(fy-player.camY)*Math.min(1,dt*9); player.py=fy;
  avatar.visible=mode==='over'; avatar.position.set(player.x,player.camY,player.z); avatar.rotation.y=player.yaw;
  updateCamera();
  if(frame%4===0){ updateRoom(); updateAct(); }
  if(mode==='walk'&&frame%6===0) updateDist();
  if(perf){
    lightT+=dt; const lv=mode==='walk'?walkLevels():[clamp(viewLevel-1,0,2)], here=camera.position;
    if(lightT>0.15||!lightAt||lightAt.distanceToSquared(here)>0.25){ lightT=0; lightAt=(lightAt||new THREE.Vector3()).copy(here); perf.lights.update(here,lv); if(mode==='walk') LG.forEach(function(g,i){ const v=lv.indexOf(i)>=0; if(g.visible!==v){ g.visible=v; renderer.shadowMap.needsUpdate=true; } }); }
    if(frame%6===0) perf.cull.update(camera,mode==='walk'?0.01:0.014);
    const e=camera.matrixWorld.elements, sig=mode+viewLevel+':'+e.map(function(v){ return v.toFixed(3); }).join(',');
    busy=busy||sportOn||dailyOn||cookOn||sleepOn||FS.isEditing()||renderer.shadowMap.needsUpdate;
    perf.overlay.frame(dt);
    if(!perf.gov.frame(dt,sig,busy)&&!first) return;
  }
  if(frame%2===0) drawMini();
  post.render();
  if(first){ first=false; loadEl.hidden=true; }
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
    const box=$('houseBtns'); box.textContent='';
    d.list.forEach(function(h){ const b=document.createElement('button'); b.type='button'; b.className='tog'; b.textContent=h.name; b.disabled=!!h.disabled; b.setAttribute('aria-pressed',String(h.id===d.current)); b.addEventListener('click',function(){ if(h.id!==d.current) window.parent.postMessage({type:'house-switch',id:h.id},location.origin); }); box.appendChild(b); });
    box.hidden=false; $('houseH').hidden=false;
  });
  window.parent.postMessage({type:'house-ready'},location.origin);
})();
if(location.hash==="#debug"){ window.__walk={get perf(){ return perf; },setLayout:setLayout,mover:function(id){ return FS.movers.find(function(m){ return m.id===id; }); },furnThings:furnThings,roomAt:roomAt,player:player,resolve:resolve,floorAt:floorAt,setMode:setMode,teleport:teleport,SPOTS:SPOTS,orb:orb,doors:doors,setDoor:setDoor,scene:scene,camera:camera,renderer:renderer,levelOf:levelOf,setView:function(v){ viewLevel=v; roofOn(v>=3&&false); applyLevelVis(); },roofOn:roofOn,cols:function(){return allCols;},Catalog:Catalog,FS:FS,FSU:FSU,updateCamera:updateCamera,keys:keys,stepPlayer:stepPlayer,tvList:tvList}; }
}
})();
  };
})(window);
