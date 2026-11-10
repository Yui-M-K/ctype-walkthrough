/* A2 mirror room: the roller screen in front of the mirror wall, taken over from ideal_c (cassette at the top, fabric pulled down over the mirror; one switch rolls it up or down).
   Engine metres; x is the mirror plane, the screen hangs 8 cm in front of it (towards -x) between z0 and z1. */
export function rollerScreen(THREE,E,C){
  const {LG,lam,fab,furnThings,furnAnims}=E, G=LG[0], x=C.x-0.08, z0=C.z0, z1=C.z1, L=z1-z0, zc=(z0+z1)/2, top=2.25, drop=2.15;
  const RG=new THREE.Group(); RG.userData.keep=true; G.add(RG);
  const cass=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,L+0.14),lam(0xf2f1ee,{roughness:0.4})); cass.position.set(x,top+0.05,zc); cass.castShadow=true; RG.add(cass);
  const cloth=new THREE.Mesh(new THREE.BoxGeometry(0.004,1,L+0.06),fab(0xe9e5dd)), bar=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.025,L+0.08),lam(0xd9d6cf,{roughness:0.4}));
  cloth.castShadow=bar.castShadow=true; RG.add(cloth,bar);
  let cur=0, target=0, last=null;
  const set=function(){ const h=Math.max(0.01,drop*cur); cloth.scale.y=h; cloth.position.set(x,top-h/2,zc); bar.position.set(x,top-h,zc); };
  set();
  furnThings.push({pt:[x-0.9,zc],l:0,on:function(){ return true; },label:function(){ return target?'捲起拉簾':'拉下拉簾'; },act:function(){ target=target?0:1; last=null; }});
  furnAnims.push({live:function(){ return cur!==target; },f:function(t){ if(last===null) last=t; const dt=Math.min(0.05,t-last); last=t; const d=target-cur; cur=Math.abs(d)<dt*0.9?target:cur+Math.sign(d)*dt*0.9; set(); E.renderer.shadowMap.needsUpdate=true; return true; }});
}
