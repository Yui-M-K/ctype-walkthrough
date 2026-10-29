#!/usr/bin/env node
/* Extracts the A2 floor-plan data (walls, openings, rooms, furniture, stairs, site) from the plan page's SVG drawing script
   into plans/a2.json. Usage: node tools/extract_a2.js [plans/a2-plan.html] [out.json]
   The drawing code is run unchanged with its drawing primitives replaced by recorders. Source coordinates are the "old" frame
   (x grows toward the west, y toward the south, origin at the building's north-east corner); the output uses the site frame:
   e = cm east of the lot's west edge, n = cm north of the lot's south edge (north is up, the road is on the north side). */
const fs=require('fs'), vm=require('vm'), path=require('path');
const SRC=process.argv[2]||path.join(__dirname,'..','plans','a2-plan.html');   // the copy of the plan page kept in this repo
const OUT=process.argv[3]||path.join(__dirname,'..','plans','a2.json');
const html=fs.readFileSync(SRC,'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/^<script>|<\/script>$/g,'')).find(s=>s.includes('PLAN-DATA'));
if(!m) throw new Error('plan script not found');
const siteM=m.match(/function drawSiteA2\(\)\{[\s\S]*?const ox=(\d+), oy=(\d+), LW=(\d+), LD=(\d+)/);
const OX=+siteM[1], OY=+siteM[2], LW=+siteM[3], LD=+siteM[4];
const secM=m.match(/function drawSectionA2\(\)\{[\s\S]*?const F1=(\d+),F2=(\d+),RN=(\d+),SL=([\d.]+)/);
const SEC={fl1AboveGL:+secM[1],fl2AboveGL:+secM[2],roofHighEaveGL:+secM[3],roofSlope:+secM[4]};
const bl=(x,y)=>[+(LW-OX-x).toFixed(2),+(LD-OY-y).toFixed(2)];          // building-local (old frame) -> site frame [e,n]
const st=(X,Y)=>[+(LW-X).toFixed(2),+(LD-Y).toFixed(2)];                // site drawing (old frame) -> site frame
const dv=(dx,dy)=>[+(-dx).toFixed(4),+(-dy).toFixed(4)];                // direction vector

const rec={fig:null,figs:{},warn:[]};
function F(){ return rec.figs[rec.fig]; }
const prelude=`
mk=function(id){ __rec.fig=id; __rec.figs[id]=__rec.figs[id]||{walls:[],ops:[],doors:[],slides:[],wins:[],rooms:[],fu:[],rc:[],st:[],circles:[],texts:[],misc:[],hline:[]}; return {id}; };
el=function(p,tag,a,txt){ __el(tag,a,txt); return {setAttribute(){}}; };
finishRot=function(){}; dimH=function(){}; dimV=function(){}; north=function(){}; route=function(){}; rlabel=function(){};
rect=function(s,x1,y1,x2,y2,cls,extra){ __rect(x1,y1,x2,y2,cls,extra); };
line=function(s,x1,y1,x2,y2,cls,sw){ __line(x1,y1,x2,y2,cls); };
poly=function(){};
text=function(s,x,y,t,cls){ __text(x,y,t,cls); return {setAttribute(){}}; };
walls=function(s,ws,ops){ __walls(ws,ops); };
door=function(s,hx,hy,w,a0,a1){ __door(hx,hy,w,a0,a1); };
slide=function(s,x1,y1,x2,y2){ __slide(x1,y1,x2,y2); };
win=function(s,x1,y1,x2,y2,t,code){ __win(x1,y1,x2,y2,t,code); };
room=function(s,r){ __room(r); };
fu=function(s,x1,y1,x2,y2,t,tx,ty){ __fu(x1,y1,x2,y2,t); if(t) __text((tx!=null?tx:(x1+x2)/2),(ty!=null?ty:(y1+y2)/2),t,'ft'); };
rc=function(s,x1,y1,x2,y2){ __rc(x1,y1,x2,y2); };
stairs=function(){};
`;
const code=m.replace(/^drawSectionA2\(\);$/m,'');   // the section drawing is not needed; the other figures are drawn by the script itself
const sandbox={__rec:rec,Math,console,
  document:{getElementById:()=>({}),createElementNS:()=>({setAttribute(){},appendChild(){}})},
  __el:(tag,a,txt)=>{ const f=F(); if(!f||tag==='svg'||tag==='g') return;
    if(tag==='circle') f.circles.push({kind:'circle',c:fig2(+a.cx,-a.cy),r:+a.r,cls:a.class||'',style:a.style||''});
    else if(tag==='ellipse') f.circles.push({kind:'ellipse',c:fig2(+a.cx,-a.cy),rx:+a.rx,ry:+a.ry,cls:a.class||''});
    else if(tag==='polygon') f.misc.push({kind:'polygon',pts:a.points.split(' ').map(p=>{const[q,r]=p.split(',');return fig2(+q,-r);}),style:a.style||'',cls:a.class||''});
    else if(tag==='text'){ f.texts.push({at:fig2(+a.x,-a.y),t:txt,cls:a.class||'',rot:a.transform?1:0}); }
    else if(tag==='path') f.misc.push({kind:'path',cls:a.class||''});
    else if(tag==='polyline') f.misc.push({kind:'polyline',cls:a.class||''}); },
  __rect:(x1,y1,x2,y2,cls,extra)=>{ const f=F(); const A=fig2(Math.min(x1,x2),Math.min(y1,y2)),B=fig2(Math.max(x1,x2),Math.max(y1,y2));
    f.misc.push({kind:'rect',cls:cls||'',style:(extra&&extra.style)||'',rect:[Math.min(A[0],B[0]),Math.min(A[1],B[1]),Math.max(A[0],B[0]),Math.max(A[1],B[1])]}); },
  __line:(x1,y1,x2,y2,cls)=>{ const f=F(); if(cls==='st') f.st.push({a:fig2(x1,y1),b:fig2(x2,y2)}); else if(cls==='wnH'||cls==='drl'||cls==='dr') f.hline.push({cls,a:fig2(x1,y1),b:fig2(x2,y2)}); },
  __text:(x,y,t,cls)=>{ F().texts.push({at:fig2(x,y),t,cls:cls||'',rot:0}); },
  __walls:(ws,ops)=>{ const f=F(); ws.forEach(w=>f.walls.push({a:fig2(w[0],w[1]),b:fig2(w[2],w[3]),t:w[4]}));
    ops.forEach(o=>{ if(Math.hypot(o.x2-o.x1,o.y2-o.y1)>0.5) f.ops.push({a:fig2(o.x1,o.y1),b:fig2(o.x2,o.y2)}); }); },
  __door:(hx,hy,w,a0,a1)=>{ const r=d=>d*Math.PI/180; F().doors.push({hinge:fig2(hx,hy),w,closedDir:dv(Math.cos(r(a0)),Math.sin(r(a0))),openDir:dv(Math.cos(r(a1)),Math.sin(r(a1)))}); },
  __slide:(x1,y1,x2,y2)=>{ F().slides.push({a:fig2(x1,y1),b:fig2(x2,y2)}); },
  __win:(x1,y1,x2,y2,t,code)=>{ F().wins.push({a:fig2(x1,y1),b:fig2(x2,y2),t,code:code||''}); },
  __room:(r)=>{ const rs=r.rects.map(q=>{const A=fig2(q[0],q[1]),B=fig2(q[2],q[3]);return[Math.min(A[0],B[0]),Math.min(A[1],B[1]),Math.max(A[0],B[0]),Math.max(A[1],B[1])];});
    const a=r.area!=null?r.area:r.rects.reduce((s,q)=>s+Math.abs((q[2]-q[0])*(q[3]-q[1]))/1e4,0)-(r.minus||0);
    F().rooms.push({name:r.name,kind:r.kind||'room',rects:rs,area_m2:+a.toFixed(2),jo:+(a/1.62).toFixed(2)}); },
  __fu:(x1,y1,x2,y2,t)=>{ const A=fig2(x1,y1),B=fig2(x2,y2); F().fu.push({rect:[Math.min(A[0],B[0]),Math.min(A[1],B[1]),Math.max(A[0],B[0]),Math.max(A[1],B[1])],label:t||''}); },
  __rc:(x1,y1,x2,y2)=>{ const A=fig2(x1,y1),B=fig2(x2,y2); F().rc.push({rect:[Math.min(A[0],B[0]),Math.min(A[1],B[1]),Math.max(A[0],B[0]),Math.max(A[1],B[1])]}); },
};
function fig2(x,y){ return rec.fig==='fig-site'?st(x,y):bl(x,y); }
vm.createContext(sandbox);
vm.runInContext(prelude+'\n'+code,sandbox,{filename:'a2-plan-script'});
const F1=rec.figs['fig-f1'], F2=rec.figs['fig-f2'], SITE=rec.figs['fig-site'];
if(!F1||!F2||!SITE) throw new Error('figure missing: '+Object.keys(rec.figs));

/* ---------- post-processing ---------- */
function features(){
  const r2=r=>r.map(v=>+v.toFixed(2));
  const miscRects=F1.misc.filter(x=>x.kind==='rect');
  const bayRoom=miscRects.find(x=>x.cls==='r-room'&&x.rect[0]>1100), engawa=miscRects.find(x=>/accent/.test(x.style)), step=miscRects.find(x=>x.cls==='fu'&&x.rect[0]>1200);
  const platform=F1.fu.map(f=>({f,r:f.rect})).find(q=>q.r[0]>=1170&&q.r[1]>=550&&q.r[2]<=1260);
  const balcony=F2.misc.filter(x=>x.kind==='rect'&&x.cls==='r-out').map(x=>x.rect).find(r=>r[1]>=850);
  const trees=F1.circles.filter(c=>c.kind==='circle'&&c.c[0]>1167&&c.r>=20).map(c=>({c:c.c,r:c.r}));
  const car=SITE.misc.filter(x=>x.kind==='rect'&&x.cls==='fu').map(x=>x.rect).find(r=>r[2]-r[0]>150);
  return {
    bayWindow:{rect:bayRoom&&r2(bayRoom.rect),platformRect:platform&&r2(platform.r),platformHeight:40,glazedFaces:L1.freeWindows.map(w=>({a:w.a,b:w.b,code:w.code})),note:'ごろ寝 platform with drawers, three glazed faces, open to the LDK through the east wall'},
    engawa:{rect:engawa&&r2(engawa.rect),depth:90,material:'cedar',steppingStone:step&&r2(step.rect)},
    sideYard:{rect:[1167,0,LW,LD],width:220},
    trees,
    balcony:{rect:balcony&&r2(balcony),level:2,depth:70,note:'cantilevered off the master bedroom north wall'},
    garage:{room:L1.rooms.find(r=>r.name.startsWith('車庫')).rects[0],car:car&&r2(car),open:'N'},
    equipmentYard:furn(SITE).map(f=>({name:f.name,rect:f.rect}))
  };
}

const axisOf=(a,b)=>Math.abs(a[1]-b[1])<0.1?'ew':'ns';                  // ew: constant n, running east-west
const onWall=(w,p)=>axisOf(w.a,w.b)==='ew'?Math.abs(p[1]-w.a[1])<1:Math.abs(p[0]-w.a[0])<1;
const span=(w,a,b)=>{ const ew=axisOf(w.a,w.b)==='ew', i=ew?0:1; const lo=Math.min(w.a[i],w.b[i]), hi=Math.max(w.a[i],w.b[i]);
  const s=Math.min(a[i],b[i]), e=Math.max(a[i],b[i]); return {lo,hi,s,e,ov:Math.min(hi,e)-Math.max(lo,s)}; };
function level(fig,id){
  const walls=fig.walls.map((w,i)=>({id:'L'+id+'W'+i,a:w.a,b:w.b,t:w.t,axis:axisOf(w.a,w.b),openings:[]}));
  const matched=new Set();
  const attach=(op,kind,extra)=>{ for(const w of walls){ if(!(onWall(w,op.a)&&onWall(w,op.b))) continue; const s=span(w,op.a,op.b); if(s.ov<=0.5) continue;
      w.openings.push(Object.assign({kind,from:Math.max(s.lo,s.s),to:Math.min(s.hi,s.e)},extra)); fig.ops.forEach((o,i)=>{ if(onWall(w,o.a)&&onWall(w,o.b)&&Math.abs(span(w,o.a,o.b).s-s.s)<1) matched.add(i); }); return true; }
    rec.warn.push('level '+id+': '+kind+' not on any wall '+JSON.stringify(op)); return false; };
  fig.doors.forEach(d=>{ const j=[d.hinge[0]+d.w*d.closedDir[0],d.hinge[1]+d.w*d.closedDir[1]]; attach({a:d.hinge,b:j},'door',{hinge:d.hinge,width:d.w,closedDir:d.closedDir,openDir:d.openDir}); });
  fig.slides.forEach(s=>attach(s,'slide',{}));
  const free=[];
  fig.wins.forEach(w=>{ const code=w.code; const on=walls.some(x=>onWall(x,w.a)&&onWall(x,w.b)&&span(x,w.a,w.b).ov>0.5);
    if(!on){ free.push({kind:'window',code,a:w.a,b:w.b,t:w.t}); return; }
    // a window drawn on top of an opening that is already a door/slide is not a separate opening
    attach(w,'window',{code,t:w.t}); });
  fig.ops.forEach((o,i)=>{ if(!matched.has(i)) rec.warn.push('level '+id+': opening cut without a symbol '+JSON.stringify(o)); });
  walls.forEach(w=>w.openings.sort((p,q)=>p.from-q.from));
  return {level:id,walls,freeWindows:free};
}
const L1=level(F1,1), L2=level(F2,2);

function labelFor(fig,f){ if(f.label) return f.label;
  const [x0,y0,x1,y1]=f.rect, c=[(x0+x1)/2,(y0+y1)/2]; let best=null,bd=1e9;
  for(const t of fig.texts){ if(!t.t||/^[\d.（(←↓↑→]/.test(t.t)) continue; const inb=t.at[0]>=x0-6&&t.at[0]<=x1+6&&t.at[1]>=y0-6&&t.at[1]<=y1+6; if(!inb) continue;
    const d=Math.hypot(t.at[0]-c[0],t.at[1]-c[1]); if(d<bd){ bd=d; best=t.t; } }
  return best||''; }
function furn(fig){ return fig.fu.map((f,i)=>({id:'f'+i,name:labelFor(fig,f),rect:f.rect.map(v=>+v.toFixed(2)),w:+(f.rect[2]-f.rect[0]).toFixed(1),d:+(f.rect[3]-f.rect[1]).toFixed(1)})); }
function stairOf(fig){ const ln=fig.st.filter(l=>Math.abs(l.a[0]-l.b[0])<0.1&&Math.abs(l.a[1]-l.b[1])>50); if(!ln.length) return null;   // tread lines run north-south; the engawa step lines run east-west
  const es=ln.map(l=>l.a[0]), ns=ln.flatMap(l=>[l.a[1],l.b[1]]);
  const e0=Math.min(...es), e1=Math.max(...es), n0=Math.min(...ns), n1=Math.max(...ns);
  return {lines:ln.length,rect:[e0,n0,e1,n1],treadSpacing:+((e1-e0)/(ln.length-1)).toFixed(2),rises:'upwards toward the west'}; }

const out={
  meta:{name:'A2',family:'注文住宅',source:path.basename(SRC),generator:'tools/extract_a2.js',unit:'cm',
    frame:'site frame: e = cm east of the lot west edge, n = cm north of the lot south edge; north is +n (up in the plan), the road is on the north side',
    sourceFrame:'plan drawn in an old frame (x west, y south, origin at the building NE corner), displayed rotated 180 degrees; converted here',
    levelHeights:{floorToFloor:285,clear1F:255,fl1AboveGL:SEC.fl1AboveGL,fl2AboveGL:SEC.fl2AboveGL}},
  lot:{east_west:LW,south_north:LD,buildingOffsetFromEastEdge:OX,buildingOffsetFromNorthEdge:OY,road:{side:'N',width:600},
    sideYard:{side:'E',width:220}},
  roof:{type:'shed',highSide:'N',slope:SEC.roofSlope,highEaveHeightAboveGL:SEC.roofHighEaveGL,note:'height drops 0.13 per unit of distance southward from the north wall; ceiling follows the roof (no flat ceiling on 2F or over the void)'},
  levels:[
    Object.assign(L1,{rooms:F1.rooms,furniture:furn(F1),clearances:F1.rc.map(r=>r.rect),stair:stairOf(F1),extras:F1.circles.map(c=>({kind:c.kind,c:c.c,r:c.r||null,rx:c.rx||null,ry:c.ry||null,cls:c.cls}))}),
    Object.assign(L2,{rooms:F2.rooms,furniture:furn(F2),clearances:F2.rc.map(r=>r.rect),stair:stairOf(F2),extras:F2.circles.map(c=>({kind:c.kind,c:c.c,r:c.r||null,rx:c.rx||null,ry:c.ry||null,cls:c.cls}))}),
  ],
  site:{rooms:SITE.rooms,furniture:furn(SITE),extras:SITE.circles,misc:SITE.misc.filter(x=>x.kind==='rect').map(x=>({cls:x.cls,rect:x.rect.map(v=>+v.toFixed(2)),style:x.style})),
    labels:SITE.texts.filter(t=>t.t&&t.cls!=='dimt').map(t=>({at:t.at,t:t.t}))},
  orientation:{north:'+n (up in the plan)',roadSide:'N',roadWidth:600,sideYardSide:'E',bayAndEngawaSide:'E',equipmentCorner:'SW',stairRises:'W',
    note:'the 3D page (a2.html) turns the house 90 degrees so the stair rises toward its own north; see NORTH in a2.html'},
  features:features(),
  texts:{f1:F1.texts.filter(t=>t.cls!=='dimt').map(t=>({at:t.at,t:t.t})),f2:F2.texts.filter(t=>t.cls!=='dimt').map(t=>({at:t.at,t:t.t}))},
  f1Misc:{polygons:F1.misc.filter(x=>x.kind==='polygon').map(x=>({pts:x.pts,style:x.style})),rects:F1.misc.filter(x=>x.kind==='rect').map(x=>({cls:x.cls,rect:x.rect,style:x.style}))},
  warnings:rec.warn
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(out,null,1));
console.log('wrote',OUT,'| walls',L1.walls.length,L2.walls.length,'| rooms',F1.rooms.length,F2.rooms.length,'| fu',F1.fu.length,F2.fu.length,'| warnings',rec.warn.length);
rec.warn.forEach(w=>console.log('WARN',w));
