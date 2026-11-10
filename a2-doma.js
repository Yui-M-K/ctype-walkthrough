/* A2 entry: the genkan (土間) floor is 15 cm below the wood floor, like ideal_c. Builds the lowered stone floor with its slab, the wall faces down to it, and the
   上がり框 (a solid oak edge, 6 cm thick, with the riser in front) along the line where the stone meets the LDK. Engine metres: x = n / 100, z = e / 100.
   The east wall of the entry belongs to the 「玄關東牆」 switch (a2-eastwall.js): its lower part goes into the wall's own group, and the oak edge on that side is built there. */
export const DEPTH=0.15;
export const ZONE={x0:7.0,x1:8.425,z0:6.02,z1:7.90};         // the lowered floor, inner faces of the walls (south side open to the LDK)
export function doma(THREE,E,C){
  const {LG,M,WM,FL,bx,rbox,floorRects}=E, G=LG[0], Z=ZONE, oc={cast:false}, D=DEPTH;
  bx(G,Z.x0,8.5,5.97,Z.z1+0.0,-0.35,-D-0.003,M.slab,oc);                           // concrete under the lowered floor
  bx(G,Z.x0,Z.x1,Z.z0,Z.z1,-D-0.003,-D,FL.stone,{cast:false});                      // the stone floor
  floorRects.push({l:0,x0:Z.x0,x1:8.5,z0:5.97,z1:Z.z1+0.05,y:-D});
  /* wall faces down to the lowered floor (hall plaster, as the walls above), and a 9 cm skirting like the rest of the house */
  const hall=WM.hall||M.cabF;
  bx(G,Z.x1,8.575,Z.z0,C.door[0],-D,0,hall,oc); bx(G,Z.x1,8.575,C.door[1],Z.z1,-D,0,hall,oc);   // north (front) wall, either side of the door
  bx(G,Z.x1,8.575,C.door[0],C.door[1],-D-0.003,-0.1,E.lam(0x6e6b67,{roughness:0.45,envMapIntensity:0.8}),oc);   // granite sill: flush with the porch outside, 5 cm above the genkan floor
  bx(G,Z.x0,Z.x1,5.97,Z.z0,-D,0,hall,oc);                                           // west wall
  const east=bx(C.eastGroup,Z.x0+0.3,Z.x1,Z.z1,Z.z1+0.1,-D,0,hall,oc);              // east wall, only while it stands
  /* 上がり框 along the south edge: a 6 cm oak edge whose top is flush with the wood floor, its riser faces the stone */
  rbox(G,Z.x0-0.06,Z.x0,Z.z0,Z.z1,-D,0.006,0.008,M.oak);
  return {east:east};
}
