'use strict';
// 互動檢測：逐一觸發每個互動（家具 action、門、窗簾、櫃門…），等動畫結束，確認狀態有變、不卡住、
// 變化後的幾何（穿牆・浮空・分裂・重疊）仍正常，再觸發回原狀。
const { issue } = require('../lib/util');
const G = require('./geometry');

function sig(ctx, list) {
  if (!ctx._meshList) { ctx._meshList = []; ctx.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh) ctx._meshList.push(o); }); }
  ctx.scene.updateMatrixWorld(true);
  return (list || ctx._meshList).map(o => Array.from(o.matrixWorld.elements));
}
function sigDiff(a, b) { let n = 0, mx = 0; const len = Math.min(a.length, b.length); for (let i = 0; i < len; i++) { let d = 0; for (let k = 12; k < 15; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k])); for (let k = 0; k < 12; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k]) * 0.3); if (d > 0.002) n++; mx = Math.max(mx, d); } return { n, max: mx, lenDiff: a.length !== b.length }; }

const fp = r => r.check + '|' + (r.pos || []).map(v => Math.round(v * 10)).join(',') + '|' + String(r.obj).split('@')[0];
// 影響範囲の mesh だけを見て「動きが止まった」を判定する（持続アニメの猫などに引きずられない）
function scopeMeshes(ctx, t) {
  if (!ctx._meshList) sig(ctx);
  if (t.obj && t.obj.isObject3D) { const L = []; t.obj.traverse(o => { if (o.isMesh && !o.isInstancedMesh) L.push(o); }); if (L.length) return L; }
  const THREE = ctx.THREE, c = new THREE.Vector3(), y0 = ctx.w.base(t.l || 0) - 0.2, y1 = y0 + 3.2, L = [];
  ctx.scene.updateMatrixWorld(true);
  ctx._meshList.forEach(o => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); c.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld); if (c.y >= y0 && c.y <= y1 && Math.hypot(c.x - t.pt[0], c.z - t.pt[1]) < 1.8) L.push(o); });
  return L;
}
function settleScope(ctx, list, maxSec) {
  const snap = () => { ctx.scene.updateMatrixWorld(true); const a = new Float64Array(list.length * 15); for (let i = 0; i < list.length; i++) { const e = list[i].matrixWorld.elements; for (let k = 0; k < 15; k++) a[i * 15 + k] = e[k]; } return a; };
  const moved = (a, b) => { for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-3) return true; return false; };
  let last = snap(), still = 0;
  for (let t = 0; t < maxSec; t += 1 / 30) { ctx.busy = false; ctx.advance(1 / 30); const k = snap(); if (!moved(k, last)) { still += 1 / 30; if (still >= 0.5 && t > 0.3) return { settled: true, t }; } else still = 0; last = k; }
  return { settled: false, t: maxSec };
}
function thingsOf(ctx) { const E = ctx.E; return E.things.map(t => Object.assign({ kind: 'door' }, t)).concat(E.furnThings.map(t => Object.assign({ kind: 'furn' }, t))); }

function stateChecks(ctx, t, state) {
  const THREE = ctx.THREE, out = [];
  const scan = ctx.scan();
  // 影響範囲：thing.obj 以下の mesh の外接箱を少し広げる。無ければ pt 周囲 1.5m
  let scope = null, owners = new Set();
  if (t.obj && t.obj.isObject3D) { const b = new THREE.Box3(); t.obj.updateWorldMatrix(true, true); b.setFromObject(t.obj); if (isFinite(b.min.x)) scope = b.expandByScalar(0.25); }
  if (!scope) { const y = ctx.w.base(t.l || 0); scope = new THREE.Box3(new THREE.Vector3(t.pt[0] - 1.5, y, t.pt[1] - 1.5), new THREE.Vector3(t.pt[0] + 1.5, y + 2.6, t.pt[1] + 1.5)); }
  scan.meshes.forEach(r => { if (r.box.intersectsBox(scope) && r.owner.kind !== 'building') owners.add(r.owner.key); });
  const tag = r => { r.state = state; r.ownerKey = (r.ownerKey || r.obj) + '@' + state; r.via = 'interact'; return r; };
  const base = ctx.staticFp;       // 初期狀態にも存在する問題は「互動で新しく出た」ものではないので除く
  [G.penetration(ctx, scan, { scope }), G.floating(ctx, scan, { scope }), G.overlap(ctx, scan, { scope }), G.continuity(ctx, scan, { only: owners, state: '' })].forEach(list => list.forEach(r => { if (!base || !base.has(fp(r))) { r.desc = '【互動「' + state + '」之後】' + r.desc; out.push(tag(r)); } }));
  return out;
}

function interact(ctx, scan0, opt) {
  const out = [], things = thingsOf(ctx), w = ctx.w, E = ctx.E, maxSec = (opt && opt.maxSec) || 14;
  const lab = t => { try { return String(t.label()); } catch (e) { return '(label error)'; } };
  const stats = { total: 0, ok: 0 };
  if (!ctx.staticFp) { const sc = ctx.scan(); ctx.staticFp = new Set([].concat(G.penetration(ctx, sc, {}), G.floating(ctx, sc, {}), G.overlap(ctx, sc, {}), G.continuity(ctx, sc, {})).map(fp)); }
  const skipRe = (opt && opt.skip) || /^(坐進|躺下|打開車門|PETKIT：開始|摸摸)/;
  things.forEach((t, i) => {
    if (t.on && !t.on()) return;
    const l0 = lab(t); if (skipRe.test(l0)) return;
    stats.total++;
    const room = ctx.roomAt(t.l || 0, t.pt[0], t.pt[1]) + '(' + ((t.l || 0) + 1) + 'F)', pos = [+t.pt[0].toFixed(2), +(w.base(t.l || 0) + 0.8).toFixed(2), +t.pt[1].toFixed(2)];
    const base = { obj: l0, ownerKey: 'act:' + l0 + '@' + t.pt.map(v => v.toFixed(1)).join(','), pos, room, level: t.l || 0, via: 'interact' };
    // 家具 mover が動く場合に備え、全 mesh の姿勢を記録
    const sl = scopeMeshes(ctx, t); settleScope(ctx, sl, 2); const s0 = sig(ctx, sl), doorState0 = w.doors.map(d => d.open + '/' + d.t), errs0 = ctx.animErrors.length;
    try { t.act(); } catch (e) { out.push(issue('interact', 'high', Object.assign({}, base, { desc: '「' + l0 + '」觸發時丟出例外：' + (e && e.message), hint: '查看該 act 函式。' }))); return; }
    const st = settleScope(ctx, sl, maxSec), l1 = lab(t), s1 = sig(ctx, sl), d = sigDiff(s0, s1), doorState1 = w.doors.map(x => x.open + '/' + x.t);
    if (ctx.animErrors.length > errs0) out.push(issue('interact', 'high', Object.assign({}, base, { desc: '「' + l0 + '」觸發後動畫函式丟出例外：' + ctx.animErrors[ctx.animErrors.length - 1], hint: '查看對應的 anims 函式。' })));
    if (!st.settled) out.push(issue('interact', 'low', Object.assign({}, base, { desc: '「' + l0 + '」觸發後 ' + maxSec + ' 秒仍在動畫中（可能卡住或為持續動畫）', hint: '確認動畫的終止條件（回傳 false）。' })));
    const changed = d.n > 0 || l1 !== l0 || doorState0.join() !== doorState1.join();
    if (!changed) out.push(issue('interact', 'mid', Object.assign({}, base, { desc: '「' + l0 + '」觸發後沒有任何零件移動、標籤也沒變（動畫終點與起點相同，或被前置條件擋下）', hint: '確認位移量是否為 0，或是否需要先滿足其他條件。' })));
    else {
      const state = l0.slice(0, 20);
      stateChecks(ctx, t, state).forEach(r => out.push(r));
      // 回復
      const l1b = lab(t);
      try { t.act(); } catch (e) { out.push(issue('interact', 'high', Object.assign({}, base, { desc: '「' + l1b + '」（還原動作）丟出例外：' + (e && e.message) }))); return; }
      const st2 = settleScope(ctx, sl, maxSec), l2 = lab(t), s2 = sig(ctx, sl), d2 = sigDiff(s0, s2);
      if (!st2.settled) out.push(issue('interact', 'low', Object.assign({}, base, { desc: '「' + l1b + '」（還原）觸發後 ' + maxSec + ' 秒仍在動畫中' })));
      if (d2.n > 0 || l2 !== l0) { const sc = ctx.scan(); [G.penetration(ctx, sc, {}), G.floating(ctx, sc, {}), G.overlap(ctx, sc, {}), G.continuity(ctx, sc, {})].forEach(L => L.forEach(r => ctx.staticFp.add(fp(r)))); }
      if (!st2.settled) { /* 上で報告済み */ } else if (d2.n > 0 && l2 === l0) out.push(issue('interact', 'low', Object.assign({}, base, { desc: '「' + l0 + '」來回觸發後 ' + d2.n + ' 個零件沒有回到初始位置（最大偏差 ' + (d2.max * 100).toFixed(1) + ' cm）', hint: '確認開／關兩段動畫的位移量是否對稱。' })));
      else if (l2 !== l0 && l1b === l1) out.push(issue('interact', 'low', Object.assign({}, base, { desc: '「' + l0 + '」第二次觸發後標籤為「' + l2 + '」，不是回到原狀（單向動作？）' })));
    }
    stats.ok++;
  });
  ctx.interactStats = stats;
  return out;
}
module.exports = { interact, thingsOf, scopeMeshes, settleScope };
