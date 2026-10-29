'use strict';
// e 可達性（網格洪水填充）、f 窗與開口、g 天花與樓梯
const { issue } = require('../lib/util');

const R = 0.22, CELL = 0.1;

function withDoors(ctx, open, fn) {
  const w = ctx.w, E = ctx.E, saved = w.doors.map(d => d.open);
  w.doors.forEach(d => { d.open = open; }); E.rebuild();
  try { return fn(); } finally { w.doors.forEach((d, i) => { d.open = saved[i]; }); E.rebuild(); }
}

// 從起點做洪水填充。回傳 {visited:Set(key), free(x,z,py), cells[]}
function flood(ctx, starts) {
  if (!Array.isArray(starts)) starts = [starts];
  const w = ctx.w, E = ctx.E, cols = E.allCols.filter(c => c.kind !== 'd' || !(c.door && c.door.open));
  const blocked = (x, z, py) => { for (let i = 0; i < cols.length; i++) { const c = cols[i]; if (!(c.y0 < py + 1.4 && c.y1 > py + 0.35)) continue; const nx = Math.max(c.x0, Math.min(c.x1, x)), nz = Math.max(c.z0, Math.min(c.z1, z)); const dx = x - nx, dz = z - nz; if (dx * dx + dz * dz < R * R - 1e-9) return true; } return false; };
  const key = (i, j, py) => i + ',' + j + ',' + Math.round(py * 20);
  const q = [], seen = new Map(), bb = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
  (E.ROOMS || []).forEach(r => { [w.WX(r.l, r.x0), w.WX(r.l, r.x1)].forEach(v => { bb.x0 = Math.min(bb.x0, v - 2); bb.x1 = Math.max(bb.x1, v + 2); }); [w.WZ(r.l, r.y0), w.WZ(r.l, r.y1)].forEach(v => { bb.z0 = Math.min(bb.z0, v - 2); bb.z1 = Math.max(bb.z1, v + 2); }); });
  starts.forEach(start => { const p0 = w.resolve(start.x, start.z, start.py), ii = Math.round(p0[0] / CELL), jj = Math.round(p0[1] / CELL), k0 = key(ii, jj, start.py); if (!seen.has(k0)) { q.push([ii, jj, start.py]); seen.set(k0, [ii, jj, start.py]); } });
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (q.length) {
    const [i, j, py] = q.pop();
    for (const d of dirs) {
      const ni = i + d[0], nj = j + d[1], x = ni * CELL, z = nj * CELL, y2 = w.floorAt(x, z, py);
      if (Math.abs(y2 - py) > 0.36 || x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) continue;
      if (blocked(x, z, y2)) continue;
      const k = key(ni, nj, y2); if (seen.has(k)) continue;
      seen.set(k, [ni, nj, y2]); q.push([ni, nj, y2]);
    }
    if (seen.size > 400000) break;
  }
  return { seen, blocked, key };
}

function reach(ctx, scan, opt) {
  const w = ctx.w, E = ctx.E, out = [], SPOTS = w.SPOTS;
  const sp0 = SPOTS[0], lv0 = sp0[3];
  const bbR = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
  (E.ROOMS || []).forEach(r => { [w.WX(r.l, r.x0), w.WX(r.l, r.x1)].forEach(v => { bbR.x0 = Math.min(bbR.x0, v - 1.5); bbR.x1 = Math.max(bbR.x1, v + 1.5); }); [w.WZ(r.l, r.y0), w.WZ(r.l, r.y1)].forEach(v => { bbR.z0 = Math.min(bbR.z0, v - 1.5); bbR.z1 = Math.max(bbR.z1, v + 1.5); }); });
  const inBB = (x, z) => x >= bbR.x0 && x <= bbR.x1 && z >= bbR.z0 && z <= bbR.z1;
  // 各傳送點（家の外観カメラなど敷地の外は除く）と、階段の出入口をスタート地点にして、層ごとに洪水填充する
  const spotStarts = w.SPOTS.map(sp => { const x = w.WX(sp[3], sp[1]), z = w.WZ(sp[3], sp[2]); return { x, z, py: w.floorAt(x, z, w.base(sp[3]) + 0.3), name: sp[0], l: sp[3] }; }).filter(s => inBB(s.x, s.z));
  const stairEnds = [];
  (E.ramps || []).forEach((rp, ri) => { const xm = (rp.x0 + rp.x1) / 2; stairEnds.push({ x: xm, z: rp.zs + 0.35, py: rp.y0, name: '階梯#' + ri + ' 下端', l: rp.l }); stairEnds.push({ x: xm, z: rp.zn - 0.35, py: rp.y0 + ctx.SH, name: '階梯#' + ri + ' 上端', l: rp.l + 1 }); });
  const start = spotStarts[0] || stairEnds[0];
  const rooms = E.ROOMS || [];
  const info = {};
  withDoors(ctx, true, () => {
    const f = flood(ctx, spotStarts.length ? spotStarts : [start]);
    info.cells = f.seen.size;
    stairEnds.forEach(se => { const p = w.resolve(se.x, se.z, se.py); let ok = false; for (let di = -2; di <= 2 && !ok; di++) for (let dj = -2; dj <= 2 && !ok; dj++) if (f.seen.has(f.key(Math.round(p[0] / CELL) + di, Math.round(p[1] / CELL) + dj, se.py))) ok = true; const fy = w.floorAt(p[0], p[1], se.py + 0.3); if (!ok) { for (let di = -2; di <= 2 && !ok; di++) for (let dj = -2; dj <= 2 && !ok; dj++) if (f.seen.has(f.key(Math.round(p[0] / CELL) + di, Math.round(p[1] / CELL) + dj, fy))) ok = true; } if (!ok) out.push(issue('reach', 'high', { obj: se.name, ownerKey: 'stair-end:' + se.name, pos: [+p[0].toFixed(2), +se.py.toFixed(2), +p[1].toFixed(2)], room: ctx.roomAt(se.l, p[0], p[1]) + '(' + (se.l + 1) + 'F)', level: se.l, desc: se.name + '（出入口附近）與任何傳送點所在的區域走不通：樓梯口被牆或家具擋住', hint: '檢查樓梯上下端 0.35 m 內有沒有家具或牆。' })); });
    // 房間ごと：到達セル数、全自由セル数（その部屋の床面上で壁・家具に塞がれていないセル）
    const reached = new Map(), freeAll = new Map();
    f.seen.forEach(c => { const l = ctx.levelOfY(c[2] + 0.1), r = w.roomAt(l, c[0] * CELL, c[1] * CELL); reached.set(r, (reached.get(r) || 0) + 1); });
    rooms.forEach(r => {
      if (r.l === undefined) return;
      const px0 = w.WX(r.l, r.x0), px1 = w.WX(r.l, r.x1), pz0 = w.WZ(r.l, r.y0), pz1 = w.WZ(r.l, r.y1), py = w.base(r.l);
      let n = 0;
      for (let x = Math.min(px0, px1) + 0.05; x < Math.max(px0, px1); x += CELL) for (let z = Math.min(pz0, pz1) + 0.05; z < Math.max(pz0, pz1); z += CELL) {
        if (w.roomAt(r.l, x, z) !== r) continue; const fy = w.floorAt(x, z, py + 0.6); if (Math.abs(fy - py) > 0.3 || f.blocked(x, z, fy)) continue; n++;
      }
      freeAll.set(r, n);
    });
    info.rooms = [];
    rooms.forEach(r => {
      const fa = freeAll.get(r) || 0, rc = reached.get(r) || 0, cx = w.WX(r.l, (r.x0 + r.x1) / 2), cz = w.WZ(r.l, (r.y0 + r.y1) / 2);
      info.rooms.push({ n: r.n, l: r.l, free: fa, reached: rc });
      if (fa * CELL * CELL < 0.4) return;
      // 同名の別矩形（L 字の部屋）は名前単位でまとめる
    });
    const byName = {};
    info.rooms.forEach(x => { const k = x.n + '(' + (x.l + 1) + 'F)'; const e = byName[k] || (byName[k] = { free: 0, reached: 0 }); e.free += x.free; e.reached += x.reached; });
    Object.keys(byName).forEach(k => {
      const e = byName[k], freeA = e.free * CELL * CELL, missA = (e.free - Math.min(e.reached, e.free)) * CELL * CELL, isOut = /戶外|outside/.test(k);
      const room = rooms.find(r => k === r.n + '(' + (r.l + 1) + 'F)');
      if (freeA < 0.4) return;
      const px = w.WX(room.l, (room.x0 + room.x1) / 2), pz = w.WZ(room.l, (room.y0 + room.y1) / 2);
      if (e.reached === 0) out.push(issue('reach', isOut ? 'low' : 'high', { obj: k, ownerKey: 'room:' + k, pos: [+px.toFixed(2), +(w.base(room.l)).toFixed(2), +pz.toFixed(2)], room: k, level: room.l, desc: '房間「' + k + '」（可站面積約 ' + freeA.toFixed(1) + ' m²）從任何傳送點／樓梯口在「門全開」時都走不到', hint: '檢查入口是否被家具擋住、門洞寬度（≥ 0.5 m）、樓梯是否銜接。' }));
      else if (missA >= 1.0) out.push(issue('reach', missA >= 2 ? 'mid' : 'low', { obj: k, ownerKey: 'pocket:' + k, pos: [+px.toFixed(2), +(w.base(room.l)).toFixed(2), +pz.toFixed(2)], room: k, level: room.l, desc: '房間「' + k + '」有約 ' + missA.toFixed(1) + ' m² 的地面無法走到（被家具或牆圍成的死角）', hint: '確認是否為刻意的死角（如櫃後）。' }));
    });
    // 傳送點：落在牆或家具內而被 resolve 推開太遠
    spotStarts.forEach(ss => {
      const s = w.SPOTS.find(q => q[0] === ss.name); if (!s) return;
      const x = w.WX(s[3], s[1]), z = w.WZ(s[3], s[2]), py = w.base(s[3]), p = w.resolve(x, z, py), disp = Math.hypot(p[0] - x, p[1] - z);
      if (disp > 0.2) out.push(issue('reach', disp > 0.5 ? 'mid' : 'low', { obj: '傳送點「' + s[0] + '」', ownerKey: 'spot:' + s[0], pos: [+x.toFixed(2), +py.toFixed(2), +z.toFixed(2)], room: ctx.roomAt(s[3], x, z) + '(' + (s[3] + 1) + 'F)', level: s[3], desc: '傳送點「' + s[0] + '」落在牆或家具內，傳送後會被推開約 ' + (disp * 100).toFixed(0) + ' cm', hint: '調整傳送點座標。' }));
    });
    // 門／拱口の両側
    const checkSide = (l, cx, cz, nrm, label, ownerKey, kind) => {
      const py = w.base(l), side = [-1, 1].map(sg => { const x = cx + sg * nrm[0] * 0.55, z = cz + sg * nrm[1] * 0.55, fy = w.floorAt(x, z, py + 0.6); let ok = false, free = !f.blocked(x, z, fy); for (let di = -2; di <= 2 && !ok; di++) for (let dj = -2; dj <= 2 && !ok; dj++) if (f.seen.has(f.key(Math.round(x / CELL) + di, Math.round(z / CELL) + dj, fy))) ok = true; return { ok, free, x, z, fy }; });
      const bad = side.filter(s => !s.ok && s.free);
      if (bad.length === 2 || (bad.length === 1 && side.some(s => s.ok))) out.push(issue('reach', 'mid', { obj: label, ownerKey, pos: [+cx.toFixed(2), +py.toFixed(2), +cz.toFixed(2)], room: ctx.roomAt(l, cx, cz) + '(' + (l + 1) + 'F)', level: l, desc: label + ' 的' + (bad.length === 2 ? '兩側' : '一側') + '走不到（' + kind + '被家具擋住或位於死角）', hint: '移開擋住出入口的家具。' }));
    };
    (w.wallOpens || []).forEach((o, i) => {
      if (o.sill > 0.05) return;
      const horiz = o.horiz, mid = (o.a + o.b) / 2, cx = horiz ? w.WX(o.l, mid) : w.WX(o.l, o.line), cz = horiz ? w.WZ(o.l, o.line) : w.WZ(o.l, mid), nrm = horiz ? [0, 1] : [1, 0];
      checkSide(o.l, cx, cz, nrm, '出入口@' + cx.toFixed(2) + ',' + cz.toFixed(2), 'open:' + o.l + ':' + cx.toFixed(1) + ',' + cz.toFixed(1), '出入口');
    });
  });
  // 全閉：門を開けずに行ける部屋（情報）
  withDoors(ctx, false, () => { const f = flood(ctx, start); info.closedCells = f.seen.size; });
  ctx.reachInfo = info;
  return out;
}

// f. 窗與開口：窗洞要有玻璃／窗框等實體填入（否則是穿幫的洞）
function openings(ctx, scan, opt) {
  const THREE = ctx.THREE, w = ctx.w, out = [];
  const all = []; ctx.scene.traverse(o => { if (o.isMesh && o.geometry && !o.isInstancedMesh) { for (let q = o; q; q = q.parent) if (!q.visible) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); all.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  (w.wallOpens || []).forEach(o => {
    if (o.sill < 0.3) return;
    const horiz = o.horiz, mid = (o.a + o.b) / 2, cx = horiz ? w.WX(o.l, mid) : w.WX(o.l, o.line), cz = horiz ? w.WZ(o.l, o.line) : w.WZ(o.l, mid);
    const cy = w.base(o.l) + (o.sill + o.head) / 2, half = horiz ? Math.abs(w.WX(o.l, o.b) - w.WX(o.l, o.a)) / 2 : Math.abs(w.WZ(o.l, o.b) - w.WZ(o.l, o.a)) / 2;
    // 窗の中心線上、壁面 ±0.12 m のなかで中心点を含む mesh があるか（ガラス・フレーム・障子）
    const probe = [[0, 0], [-half * 0.5, 0], [half * 0.5, 0]].map(d => [cx + (horiz ? d[0] : 0), cy, cz + (horiz ? 0 : d[0])]);
    const covered = probe.filter(p => all.some(b => p[0] >= b.min.x - (horiz ? 0 : 0.12) && p[0] <= b.max.x + (horiz ? 0 : 0.12) && p[2] >= b.min.z - (horiz ? 0.12 : 0) && p[2] <= b.max.z + (horiz ? 0.12 : 0) && p[1] >= b.min.y && p[1] <= b.max.y)).length;
    if (covered === 0) out.push(issue('opening', 'high', { obj: '窗洞@' + cx.toFixed(2) + ',' + cz.toFixed(2), ownerKey: 'win:' + o.l + ':' + cx.toFixed(1) + ',' + cz.toFixed(1), pos: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)], room: ctx.roomAt(o.l, cx, cz) + '(' + (o.l + 1) + 'F)', level: o.l,
      desc: '窗洞（寬約 ' + (half * 200).toFixed(0) + ' cm、窗台 ' + o.sill + ' m）中央沒有任何玻璃／窗框／窗簾 mesh，會直接看穿到外面', hint: '補上玻璃或窗框；若是刻意的開口可加白名單。' }));
  });
  return out;
}

// g. 天花與樓梯
function levels(ctx, scan, opt) {
  const THREE = ctx.THREE, w = ctx.w, E = ctx.E, out = [], CH = E.CH || 2.5;
  const slabs = scan.meshes.filter(r => r.size.x > 0.6 && r.size.z > 0.6 && r.size.y < 0.6);
  (E.ROOMS || []).forEach(r => {
    if (r.l === undefined || /outside/.test(r.w || '') || /戶外|陽台|緣側|庭院/.test(r.n)) return;
    const x = w.WX(r.l, (r.x0 + r.x1) / 2), z = w.WZ(r.l, (r.y0 + r.y1) / 2), top = w.base(r.l) + CH;
    if (w.roomAt(r.l, x, z) !== r) return;
    if (/階梯/.test(r.n) || (E.ramps || []).some(rp => x >= rp.x0 - 0.1 && x <= rp.x1 + 0.1 && z >= rp.zn - 0.1 && z <= rp.zs + 0.1)) return;
    const fl = w.base(r.l), hit = scan.meshes.some(s => s.size.x > 0.6 && s.size.z > 0.6 && s.box.min.x <= x && s.box.max.x >= x && s.box.min.z <= z && s.box.max.z >= z && s.box.max.y >= fl + 1.9 && s.box.min.y >= fl + 1.9 - 0.3 && s.box.min.y <= fl + 6.5);
    if (!hit) out.push(issue('level', 'high', { obj: r.n + '(' + (r.l + 1) + 'F)', ownerKey: 'ceil:' + r.n + r.l + r.x0 + r.y0, pos: [+x.toFixed(2), +top.toFixed(2), +z.toFixed(2)], room: r.n + '(' + (r.l + 1) + 'F)', level: r.l, desc: '房間「' + r.n + '」中心上方 ' + CH + ' m 處找不到天花板／樓板（會看見天空或上層內部）', hint: '確認該區塊是否為挑高或缺少天花。' }));
  });
  // 樓梯踏板高度與坡度線的偏差
  (E.ramps || []).forEach((rp, ri) => {
    const SH = ctx.SH, treads = scan.meshes.filter(r => r.owner.kind === 'building' && r.size.y <= 0.1 && r.size.x >= 0.3 && r.size.z >= 0.15 && r.size.z <= 0.5 && r.box.min.x >= rp.x0 - 0.05 && r.box.max.x <= rp.x1 + 0.05 && r.box.min.z >= rp.zn - 0.05 && r.box.max.z <= rp.zs + 0.05 && r.box.max.y >= rp.y0 - 0.05 && r.box.max.y <= rp.y0 + SH + 0.05);
    if (treads.length < 3) return;
    treads.sort((a, b) => a.box.max.y - b.box.max.y);
    let maxStep = 0, minStep = 1; for (let i = 1; i < treads.length; i++) { const d = treads[i].box.max.y - treads[i - 1].box.max.y; if (d > 0.005) { maxStep = Math.max(maxStep, d); minStep = Math.min(minStep, d); } }
    if (maxStep > 0.23 || (maxStep - minStep) > 0.04 && maxStep > 0.2) out.push(issue('level', 'mid', { obj: '樓梯#' + ri, ownerKey: 'stair' + ri, pos: [+((rp.x0 + rp.x1) / 2).toFixed(2), +(rp.y0 + 1).toFixed(2), +((rp.zn + rp.zs) / 2).toFixed(2)], room: '階梯(' + (rp.l + 1) + 'F)', level: rp.l, desc: '樓梯踏板高度不連續：最大級高 ' + (maxStep * 100).toFixed(1) + ' cm、最小 ' + (minStep * 100).toFixed(1) + ' cm（共 ' + treads.length + ' 級）', hint: '檢查踏板間距與頂端與樓板的銜接。' }));
  });
  return out;
}
module.exports = { reach, openings, levels, flood, withDoors };
