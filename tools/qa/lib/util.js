'use strict';
// 檢查共用：issue 建構、AABB 運算、空間格網。ブラウザ内でも動く（require しない）。
const SEV = { high: 3, mid: 2, low: 1 };
function issue(check, sev, o) {
  return Object.assign({ check, sev, obj: '', pos: null, room: '', level: null, desc: '', hint: '', shot: null }, o);
}
// 兩個 AABB 在各軸的重疊長度（負值＝分離距離的相反數）
function overlap3(a, b) {
  return [Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x), Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y), Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z)];
}
// AABB 間的距離（重疊時 0）
function boxDist(a, b) {
  const dx = Math.max(0, Math.max(a.min.x - b.max.x, b.min.x - a.max.x)), dy = Math.max(0, Math.max(a.min.y - b.max.y, b.min.y - a.max.y)), dz = Math.max(0, Math.max(a.min.z - b.max.z, b.min.z - a.max.z));
  return Math.hypot(dx, dy, dz);
}
const vol = b => Math.max(0, b.max.x - b.min.x) * Math.max(0, b.max.y - b.min.y) * Math.max(0, b.max.z - b.min.z);
// 均一格網（XZ 0.5m）で AABB の近傍検索
function makeGrid(cell) {
  cell = cell || 0.5; const map = new Map(); const bigs = [];
  const key = (i, j) => i * 100003 + j;
  return {
    add(id, box, pad) {
      pad = pad || 0; const i0 = Math.floor((box.min.x - pad) / cell), i1 = Math.floor((box.max.x + pad) / cell), j0 = Math.floor((box.min.z - pad) / cell), j1 = Math.floor((box.max.z + pad) / cell);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 150) { bigs.push(id); return; }
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); let a = map.get(k); if (!a) map.set(k, a = []); a.push(id); }
    },
    query(box, pad) {
      pad = pad || 0; const out = new Set(bigs); const i0 = Math.floor((box.min.x - pad) / cell), i1 = Math.floor((box.max.x + pad) / cell), j0 = Math.floor((box.min.z - pad) / cell), j1 = Math.floor((box.max.z + pad) / cell);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = map.get(key(i, j)); if (a) a.forEach(x => out.add(x)); }
      return out;
    },
  };
}
// 白名單判定：list の各項目 {check, match(部分一致 or /re/), note}
function whitelisted(list, check, text) {
  return (list || []).some(w => (!w.check || w.check === check) && (w.match instanceof RegExp ? w.match.test(text) : text.indexOf(w.match) >= 0));
}
module.exports = { SEV, issue, overlap3, boxDist, vol, makeGrid, whitelisted };
