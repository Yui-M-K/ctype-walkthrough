'use strict';
// 検査モジュール（lib/util, lib/ctx, checks/*）を 1 つの文字列にまとめ、ブラウザ頁面内で実行できるようにする。
const fs = require('fs'), path = require('path');
const QA = path.resolve(__dirname, '..');
const FILES = { util: 'lib/util.js', ctx: 'lib/ctx.js', geometry: 'checks/geometry.js', doors: 'checks/doors.js', access: 'checks/access.js' };

function bundleSource() {
  let src = '(function(){const defs={},cache={};';
  Object.keys(FILES).forEach(k => { src += 'defs[' + JSON.stringify(k) + ']=function(module,exports,require){' + fs.readFileSync(path.join(QA, FILES[k]), 'utf8') + '\n};'; });
  src += 'function req(n){const k=String(n).split("/").pop().replace(/\\.js$/,"");if(!defs[k])throw new Error("no module "+k);if(!cache[k]){const m={exports:{}};cache[k]=m;defs[k](m,m.exports,req);}return cache[k].exports;}';
  src += `window.__qa={ run:function(house,names){ const {makeCtx}=req('ctx'),G=req('geometry'),D=req('doors'),A=req('access');
    const w=window.__walk,ctx=makeCtx(window.THREE,w,window.Walk,house),scan=ctx.scan(),out=[];
    const f={'wall-pen':()=>G.penetration(ctx,scan,{}),mount:()=>G.mounted(ctx,scan,{}),float:()=>G.floating(ctx,scan,{}),overlap:()=>G.overlap(ctx,scan,{}),continuity:()=>G.continuity(ctx,scan,{}),door:()=>D.doors(ctx,scan,{}),reach:()=>A.reach(ctx,scan,{}),opening:()=>A.openings(ctx,scan,{}),level:()=>A.levels(ctx,scan,{})};
    const errs=[]; names.forEach(n=>{ if(f[n]) try{ f[n]().forEach(i=>out.push(i)); }catch(e){ errs.push(n+': '+e.message); } });
    return {issues:out,errors:errs,meshes:scan.meshes.length}; } };})();`;
  return src;
}
module.exports = { bundleSource };
