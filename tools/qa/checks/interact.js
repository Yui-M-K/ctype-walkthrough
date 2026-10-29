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
function sigDiffIdx(a, b, idx) { let n = 0, mx = 0; idx.forEach(i => { let d = 0; for (let k = 12; k < 15; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k])); for (let k = 0; k < 12; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k]) * 0.3); if (d > 0.002) n++; mx = Math.max(mx, d); }); return { n, max: mx }; }
function movedIdx(a, b) { const out = []; for (let i = 0; i < a.length; i++) { let d = 0; for (let k = 12; k < 15; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k])); for (let k = 0; k < 12; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k]) * 0.3); if (d > 0.002) out.push(i); } return out; }
function sigDiff(a, b) { let n = 0, mx = 0; const len = Math.min(a.length, b.length); for (let i = 0; i < len; i++) { let d = 0; for (let k = 12; k < 15; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k])); for (let k = 0; k < 12; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k]) * 0.3); if (d > 0.002) n++; mx = Math.max(mx, d); } return { n, max: mx, lenDiff: a.length !== b.length }; }

// 動いた mesh（初期姿勢と異なるもの）が、動いていない別の mesh に食い込んでいないか（建築内の戸棚・燙衣板など、Piece ではない部品も対象）
function movedClash(ctx, scan, state, scope) {
  const out = [], { makeGrid, overlap3, vol } = require('../lib/util');
  if (!ctx.initSig) return out;
  const idxOf = ctx._idxOf || (ctx._idxOf = new Map(ctx._meshList.map((m, i) => [m, i])));
  const moved = new Set();
  scan.meshes.forEach(r => { if (scope && !r.box.intersectsBox(scope)) return; if (ctx.ambient && ctx.ambient.has(r.mesh)) return; const i = idxOf.get(r.mesh); if (i === undefined) return; const a = r.mesh.matrixWorld.elements, b = ctx.initSig[i]; for (let k = 12; k < 15; k++) if (Math.abs(a[k] - b[k]) > 0.01) { moved.add(r.idx); return; } for (let k = 0; k < 12; k++) if (Math.abs(a[k] - b[k]) > 0.02) { moved.add(r.idx); return; } });
  if (!moved.size || moved.size > 600) return out;
  const grid = makeGrid(0.5); scan.meshes.forEach(r => { if (!moved.has(r.idx)) grid.add(r.idx, r.box, 0); });
  const per = new Map();
  moved.forEach(mi => {
    const r = scan.meshes[mi]; if (Math.min(r.size.x, r.size.y, r.size.z) < 0.012 || Math.max(r.size.x, r.size.y, r.size.z) > 2.5) return;
    grid.query(r.box, 0).forEach(j => {
      const q = scan.meshes[j]; if (q.owner.key === r.owner.key && r.owner.kind !== 'building') return;
      if (Math.min(q.size.x, q.size.y, q.size.z) < 0.012 || Math.max(q.size.x, q.size.y, q.size.z) > 2.5) return;
      if (q.owner.kind === 'building' && Math.min(q.size.x, q.size.z) <= 0.3 && q.size.y >= 1.2) return;     // 壁そのもの
      const [ox, oy, oz] = overlap3(r.box, q.box), d = Math.min(ox, oy, oz); if (d < 0.03) return;
      const v = ox * oy * oz, ratio = v / Math.max(Math.min(vol(r.box), vol(q.box)), 1e-9); if (ratio < 0.3 || v < 3e-4) return;
      const k = r.owner.key + '|' + q.owner.key + '|' + Math.round(r.box.min.x * 5) + ',' + Math.round(r.box.min.z * 5);
      const e = per.get(k) || { r, q, d: 0, v: 0, n: 0 }; e.n++; e.v += v; if (d > e.d) { e.d = d; e.r = r; e.q = q; } per.set(k, e);
    });
  });
  per.forEach(e => { const bb = e.r.box.clone().intersect(e.q.box); out.push(issue('interact', e.d >= 0.08 ? 'high' : 'mid', { obj: ctx.partName(e.r) + ' × ' + ctx.partName(e.q), ownerKey: 'moved:' + e.r.owner.key + e.q.owner.key, pos: ctx.fmtPos(bb), room: ctx.roomOf(...ctx.fmtPos(bb)), state,
    desc: '互動後移動的零件「' + ctx.partName(e.r) + '」與固定的「' + ctx.partName(e.q) + '」互相穿插，最深約 ' + ctx.cm(e.d) + ' cm（' + e.n + ' 組，重疊約 ' + Math.round(e.v * 1e6) + ' cm³）', hint: '調整該動畫的終點位置，或讓固定零件讓出空間。', via: 'interact' })); });
  return out;
}
const fp = r => r.check + '|' + (r.pos || []).map(v => Math.round(v * 10)).join(',') + '|' + String(r.obj).split('@')[0];
// 影響範囲の mesh だけを見て「動きが止まった」を判定する（持続アニメの猫などに引きずられない）
// 何もしなくても動いている mesh（猫の徘徊、掃除ロボなど）を洗い出し、互動の判定から外す
function detectAmbient(ctx) {
  if (!ctx._meshList) sig(ctx);
  const amb = new Set(), L = ctx._meshList;
  for (let round = 0; round < 3; round++) { const a = sig(ctx); ctx.advance(2); const b = sig(ctx); for (let i = 0; i < L.length; i++) { let d = 0; for (let k = 0; k < 15; k++) d = Math.max(d, Math.abs(a[i][k] - b[i][k])); if (d > 1e-3) amb.add(L[i]); } }
  ctx.ambient = amb; return amb;
}
function scopeMeshes(ctx, t) {
  if (!ctx._meshList) sig(ctx);
  if (!ctx.ambient) detectAmbient(ctx);
  if (t.obj && t.obj.isObject3D) { let L = []; t.obj.traverse(o => { if (o.isMesh && !o.isInstancedMesh) L.push(o); }); L = L.filter(o => !ctx.ambient.has(o)); if (L.length) return L; }
  const THREE = ctx.THREE, c = new THREE.Vector3(), y0 = ctx.w.base(t.l || 0) - 0.2, y1 = y0 + 3.2, L = [];
  ctx.scene.updateMatrixWorld(true);
  ctx._meshList.forEach(o => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); c.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld); if (!ctx.ambient.has(o) && c.y >= y0 && c.y <= y1 && Math.hypot(c.x - t.pt[0], c.z - t.pt[1]) < 1.8) L.push(o); });
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
  const tag = r => { ctx.singleFp = ctx.singleFp || new Set(); ctx.singleFp.add(fp(r)); r.state = state; r.ownerKey = (r.ownerKey || r.obj) + '@' + state; r.via = 'interact'; return r; };
  const base = ctx.staticFp;       // 初期狀態にも存在する問題は「互動で新しく出た」ものではないので除く
  movedClash(ctx, scan, state, scope).forEach(r => { if (!(ctx.clashFp && ctx.clashFp.has(fp(r)))) out.push(r); });
  [G.penetration(ctx, scan, { scope }), G.floating(ctx, scan, { scope }), G.overlap(ctx, scan, { scope }), G.continuity(ctx, scan, { only: owners, state: '' })].forEach(list => list.forEach(r => { if ((!base || !base.has(fp(r))) && !(state.indexOf('＋') >= 0 && ctx.singleFp && ctx.singleFp.has(fp(r)))) { r.desc = '【互動「' + state + '」之後】' + r.desc; out.push(tag(r)); } }));
  return out;
}

function interact(ctx, scan0, opt) {
  const out = [], things = thingsOf(ctx), w = ctx.w, E = ctx.E, maxSec = (opt && opt.maxSec) || 14;
  const lab = t => { try { return String(t.label()); } catch (e) { return '(label error)'; } };
  const stats = { total: 0, ok: 0 };
  if (!ctx.initSig) { sig(ctx); ctx.scene.updateMatrixWorld(true); ctx.initSig = ctx._meshList.map(o => Array.from(o.matrixWorld.elements)); }
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
    if (changed && d.n === 0 && doorState0.join() === doorState1.join()) out.push(issue('interact', /簾|門|抽|櫃|蓋|拉|開|關|收|放|升|降|摺|折|掀|扉/.test(l0) ? 'mid' : 'low', Object.assign({}, base, { desc: '「' + l0 + '」觸發後標籤變成「' + l1 + '」，但影響範圍內沒有任何零件移動（動畫沒有作用？）', hint: '確認 act 是否真的更新了該物件的 target／位置。' })));
    else if (changed && d.n > 0 && d.max < 0.02 && d.max > 0) out.push(issue('interact', 'low', Object.assign({}, base, { desc: '「' + l0 + '」觸發後最大位移只有 ' + (d.max * 100).toFixed(1) + ' cm，動畫幅度過小' })));
    if (!changed) out.push(issue('interact', 'mid', Object.assign({}, base, { desc: '「' + l0 + '」觸發後沒有任何零件移動、標籤也沒變（動畫終點與起點相同，或被前置條件擋下）', hint: '確認位移量是否為 0，或是否需要先滿足其他條件。' })));
    else {
      const state = l0.slice(0, 20);
      stateChecks(ctx, t, state).forEach(r => out.push(r));
      // 回復
      const l1b = lab(t);
      try { t.act(); } catch (e) { out.push(issue('interact', 'high', Object.assign({}, base, { desc: '「' + l1b + '」（還原動作）丟出例外：' + (e && e.message) }))); return; }
      const st2 = settleScope(ctx, sl, maxSec), l2 = lab(t), s2 = sig(ctx, sl), mvIdx = movedIdx(s0, s1), d2 = sigDiffIdx(s0, s2, mvIdx);
      if (!st2.settled) out.push(issue('interact', 'low', Object.assign({}, base, { desc: '「' + l1b + '」（還原）觸發後 ' + maxSec + ' 秒仍在動畫中' })));
      if (d2.n > 0 || l2 !== l0) { const sc = ctx.scan(); [G.penetration(ctx, sc, {}), G.floating(ctx, sc, {}), G.overlap(ctx, sc, {}), G.continuity(ctx, sc, {})].forEach(L => L.forEach(r => ctx.staticFp.add(fp(r)))); }
      if (!st2.settled) { /* 上で報告済み */ } else if (d2.n > 0 && d2.max > 0.02 && l2 === l0) out.push(issue('interact', d2.max > 0.3 ? 'high' : d2.max > 0.1 ? 'mid' : 'low', Object.assign({}, base, { desc: '「' + l0 + '」來回觸發後 ' + d2.n + ' 個零件沒有回到初始位置（最大偏差 ' + (d2.max * 100).toFixed(1) + ' cm）', hint: '確認開／關兩段動畫的位移量是否對稱。' })));

    }
    t._effective = changed; stats.ok++;
  });
  // 組み合わせ：近接する 2 つの互動を両方「作動中」にしたときの干渉（例：櫃門を開けた上で収納物を動かす）
  const maxCombos = opt && opt.maxCombos !== undefined ? opt.maxCombos : 30, cand = [];
  const eff = things.filter(t => t._effective && !(t.on && !t.on()));
  for (let i = 0; i < eff.length; i++) for (let j = i + 1; j < eff.length; j++) { const a = eff[i], b = eff[j]; if ((a.l || 0) !== (b.l || 0)) continue; const d = Math.hypot(a.pt[0] - b.pt[0], a.pt[1] - b.pt[1]); if (d < 0.9) cand.push([d, a, b]); }
  cand.sort((x, y) => x[0] - y[0]);
  let nc = 0; const seenA = new Set();
  for (const [d, a, b] of cand) {
    if (nc >= maxCombos) break;
    const la = lab(a), lb = lab(b); if (la === lb) continue;
    nc++;
    try { a.act(); settleScope(ctx, scopeMeshes(ctx, a), 6); b.act(); settleScope(ctx, scopeMeshes(ctx, b), 6); } catch (e) { continue; }
    const mid = { obj: null, pt: [(a.pt[0] + b.pt[0]) / 2, (a.pt[1] + b.pt[1]) / 2], l: a.l || 0 };
    stateChecks(ctx, mid, la.slice(0, 12) + '＋' + lb.slice(0, 12)).forEach(r => { r.desc = r.desc.replace('【互動「', '【同時「'); out.push(r); });
    try { b.act(); settleScope(ctx, scopeMeshes(ctx, b), 6); a.act(); settleScope(ctx, scopeMeshes(ctx, a), 6); } catch (e) {}
  }
  stats.combos = nc;
  ctx.interactStats = stats;
  return out;
}
module.exports = { interact, thingsOf, scopeMeshes, settleScope };
