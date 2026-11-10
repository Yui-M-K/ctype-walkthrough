/* A2 1F kitchen: peninsula with sink and IH hob under a range hood, appliance cabinet and base counter along the west wall.
   Pieces come from lib/catalog.js; layout follows ideal_c.html. Plan frame: engine x = n / 100, engine z = e / 100. */
const HX=1.68, HZ=0.4;                              // hob offset from the peninsula's south-west corner (m)
export function hob(L1){                           // [engine x, z] of the IH hob (centre); the cook stands on the west side, z smaller
  const P=L1.furniture.find(function(f){ return f.name==='半島 200'; }).rect; return [P[1]/100+HX,P[0]/100+HZ];
}
export function kitchen(THREE,E,C){
  const {Catalog,LG,M,fixture,bx,CH}=E, L1=C.L1;
  const rect=function(name){ return L1.furniture.find(function(f){ return f.name===name; }).rect; };   // [e0,n0,e1,n1] in cm
  const P=rect('半島 200'), B=rect('背面收納'), F=rect('冰箱');
  const w=(P[3]-P[1])/100, d=(P[2]-P[0])/100, X0=P[1]/100, Z0=P[0]/100;
  /* peninsula: sink | prep space over the dishwasher | IH hob, the cook stands on the west (aisle) side */
  const SX=[0.05,0.75];   // sink 70 cm, dishwasher 45 cm, then 65 cm of clear counter between the sink and the hob (was 45)
  fixture(0,Catalog.sinkCounter(w,d,[SX[0],SX[1],0.15,0.6],[{k:'fill',w:SX[0]},{k:'sink',w:SX[1]-SX[0]},{k:'dw',w:0.45},{k:'drawers',w:w-SX[1]-0.45}]),X0,Z0,0);
  fixture(0,Catalog.pullDownTap(),X0+(SX[0]+SX[1])/2,Z0+0.67,0);
  fixture(0,Catalog.dishSoap(true),X0+SX[0]+0.07,Z0+0.67,0);
  fixture(0,Catalog.sinkSponge(),X0+SX[1]-0.1,Z0+0.595,0);
  fixture(0,Catalog.ihHob2(),X0+HX,Z0+HZ,0);
  fixture(0,Catalog.rangeHood(CH),X0+HX,Z0+HZ,0);
  /* back wall, from the fridge: appliance cabinet (microwave, rice cooker, coffee maker), then a base counter up to the garage door */
  const AW=1.325, bz0=B[0]/100, bz1=B[2]/100, bn0=B[1]/100, bn1=B[3]/100, dep=bz1-bz0;
  fixture(0,Catalog.applianceCabinet({dishes:true,full:true,depth:dep,width:AW,height:1.89,oak:true,kick:0xd9d3c8,k2:true,narrow:true}),bn0+AW/2,bz0+dep/2,0);
  fixture(0,Catalog.sinkCounter(bn1-bn0-AW,dep,null,[{k:'drawers',w:bn1-bn0-AW}]),bn1,bz1,2);
  /* small things on the back counter (the same pieces as ideal_c) and outlet plates on the seating side of the peninsula */
  const topY=0.85;
  [[Catalog.spiceRack(),bn0+AW+0.38,bz0+0.13,3],[Catalog.hotWaterPot(),bn1-0.17,bz0+0.34,3]].forEach(function(q){ const g=fixture(0,q[0],q[1],q[2],q[3]); if(g) g.position.y+=topY; });
  [X0+0.45,X0+0.62].forEach(function(x){ bx(LG[0],x-0.035,x+0.035,Z0+d,Z0+d+0.006,0.76,0.84,E.lam(0xf4f4f1,{roughness:0.35}),{cast:false}); bx(LG[0],x-0.012,x+0.012,Z0+d+0.006,Z0+d+0.008,0.79,0.81,M.black,{cast:false}); });
  /* cupboards from the top of the cabinet to the ceiling, over the cabinet and the fridge */
  const fn0=F[1]/100, cn1=bn0+AW, n=3, sw=(cn1-fn0)/n;
  for(let i=0;i<n;i++) bx(LG[0],fn0+i*sw+0.0015,fn0+(i+1)*sw-0.0015,bz0,F[2]/100,1.9,CH-0.005,M.cabF);
}
