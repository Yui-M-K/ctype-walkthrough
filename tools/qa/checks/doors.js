'use strict';
// d. 門的活動範圍：開門過程（掃過的扇形／滑動軌跡）有無撞到家具、小物、牆、別的門；關閉時與開口是否有縫。
const { issue, overlap3, vol } = require('../lib/util');

const TOL = { clear: 0.015, gap: 0.01 };

function leafMeshes(THREE, d) {
  const roots = [d.pv, d.leaf, d.fold].filter(o => o && o.isObject3D), seen = new Set(), out = [];
  roots.forEach(r => r.traverse(o => { if (o.isMesh && !seen.has(o) && o.geometry) { seen.add(o); out.push(o); } }));
  return out;
}
// 扇的平面線段（世界座標）：ジオメトリ局所 AABB の長い水平軸の中心線
function leafSegments(THREE, d) {
  const segs = [];
  leafMeshes(THREE, d).forEach(m => {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox, sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, sy = b.max.y - b.min.y;
    if (Math.max(sx, sz) < 0.25 || sy < 0.4) return;                      // 取っ手など小さい部品は無視
    const c = b.getCenter(new THREE.Vector3()), along = sx >= sz ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), half = Math.max(sx, sz) / 2, th = Math.min(sx, sz);
    m.updateWorldMatrix(true, false);
    const a = c.clone().addScaledVector(along, -half).applyMatrix4(m.matrixWorld), e = c.clone().addScaledVector(along, half).applyMatrix4(m.matrixWorld);
    const wy0 = new THREE.Vector3(c.x, b.min.y, c.z).applyMatrix4(m.matrixWorld).y, wy1 = new THREE.Vector3(c.x, b.max.y, c.z).applyMatrix4(m.matrixWorld).y;
    segs.push({ ax: a.x, az: a.z, bx: e.x, bz: e.z, y0: Math.min(wy0, wy1), y1: Math.max(wy0, wy1), th });
  });
  return segs;
}
// 線段 vs 水平方向に th/2 膨らませた AABB（clear だけ縮める）
function segHitsBox(s, bx, clear) {
  const e = s.th / 2 - clear;
  const x0 = bx.min.x + clear - e, x1 = bx.max.x - clear + e, z0 = bx.min.z + clear - e, z1 = bx.max.z - clear + e;
  if (x1 <= x0 || z1 <= z0) return false;
  if (Math.min(s.y1, bx.max.y - clear) - Math.max(s.y0, bx.min.y + clear) <= 0) return false;
  let t0 = 0, t1 = 1; const dx = s.bx - s.ax, dz = s.bz - s.az;
  const clip = (p, q) => { if (Math.abs(p) < 1e-12) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
  return clip(-dx, s.ax - x0) && clip(dx, x1 - s.ax) && clip(-dz, s.az - z0) && clip(dz, z1 - s.az) && t1 >= t0;
}

function doors(ctx, scan, opt) {
  const THREE = ctx.THREE, w = ctx.w, E = ctx.E, out = [], walls = ctx.allWallCols();
  const wallBoxes = walls.map(c => new THREE.Box3(new THREE.Vector3(c.x0, c.y0, c.z0), new THREE.Vector3(c.x1, c.y1, c.z1)));
  const obst = scan.meshes.filter(r => r.owner.kind !== 'door' && Math.max(r.size.x, r.size.y, r.size.z) <= 2.6 && Math.min(r.size.x, r.size.y, r.size.z) >= 0.004 && (r.owner.kind !== 'building' || Math.max(r.size.x, r.size.z) <= 1.3));
  const saved = w.doors.map(d => d.t), savedOpen = w.doors.map(d => d.open), STATES = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
  const at = (d, t) => { d.t = t; E.applyDoor(d); [d.pv, d.leaf, d.fold].forEach(o => { if (o && o.isObject3D) o.updateWorldMatrix(true, true); }); };
  const sweeps = w.doors.map(() => []);
  try {
    w.doors.forEach((d, i) => {
      const nm = d.label ? '' : '', room = ctx.roomAt(d.l, d.mid[0], d.mid[1]);
      const dname = '門#' + i + (d.slide ? '(拉門)' : '(開關門)') + '@' + d.mid.map(v => v.toFixed(2)).join(',');
      const hits = new Map();
      STATES.forEach(t => {
        at(d, t); const segs = leafSegments(THREE, d); sweeps[i].push({ t, segs });
        segs.forEach(s => {
          obst.forEach(r => {
            if (r.box.max.y < s.y0 - 0.01 || r.box.min.y > s.y1 + 0.01) return;
            if (r.owner.kind === 'building' && t < 0.3) return;
            if (!segHitsBox(s, r.box, TOL.clear)) return;
            const k = r.owner.key; const e = hits.get(k) || { owner: r.owner, t, rec: r, n: 0 }; e.n++; if (t < e.t) { e.t = t; e.rec = r; } hits.set(k, e);
          });
          if (t >= 0.25 && !d.slide) wallBoxes.forEach((bx, wi) => { if (segHitsBox(s, bx, 0.02)) { const k = 'wall' + wi; if (!hits.has(k)) hits.set(k, { owner: { key: k, kind: 'wall', name: '牆' }, t, rec: null, n: 1, wall: walls[wi] }); } });
        });
      });
      hits.forEach(h => {
        const kind = h.owner.kind, sev = kind === 'wall' ? 'mid' : (kind === 'building' ? 'low' : 'high');
        const pos = h.rec ? ctx.fmtPos(h.rec.box) : [+((h.wall.x0 + h.wall.x1) / 2).toFixed(2), +((h.wall.y0 + h.wall.y1) / 2).toFixed(2), +((h.wall.z0 + h.wall.z1) / 2).toFixed(2)];
        out.push(issue('door-sweep', sev, { obj: dname + ' × ' + h.owner.name, ownerKey: 'door' + i + '&' + h.owner.key, part: h.rec ? ctx.partName(h.rec) : '', pos, room: room + '(' + (d.l + 1) + 'F)', level: d.l,
          desc: dname + ' 開到 ' + Math.round(h.t * 100) + '% 時掃到「' + h.owner.name + '」' + (kind === 'wall' ? '（門扇穿進牆體）' : kind === 'building' ? '（建築小物）' : '（門打不到全開或穿過物件）'),
          hint: '移開該物件或縮小門的開啟角度／改拉門。', extra: { t: h.t } }));
      });
      // 全閉時の隙間：扇の平面箱 vs 開口 col
      at(d, 0);
      const meshes = leafMeshes(THREE, d), c = d.col; let ux = [1e9, -1e9], uz = [1e9, -1e9], uy = [1e9, -1e9];
      meshes.forEach(m => { const b = new THREE.Box3().setFromObject(m); const sz = b.getSize(new THREE.Vector3()); if (Math.max(sz.x, sz.z) < 0.25 || sz.y < 0.4) return; ux = [Math.min(ux[0], b.min.x), Math.max(ux[1], b.max.x)]; uz = [Math.min(uz[0], b.min.z), Math.max(uz[1], b.max.z)]; uy = [Math.min(uy[0], b.min.y), Math.max(uy[1], b.max.y)]; });
      if (ux[0] < 1e8) {
        const alongX = (c.x1 - c.x0) > (c.z1 - c.z0), a0 = alongX ? ux[0] : uz[0], a1 = alongX ? ux[1] : uz[1], c0 = alongX ? c.x0 : c.z0, c1 = alongX ? c.x1 : c.z1;
        const gl = a0 - c0, gr = c1 - a1, gt = c.y1 - uy[1], gb = uy[0] - c.y0;
        const slidingOverlap = !!d.slide;
        const gaps = slidingOverlap ? [] : [['左側', gl], ['右側', gr], ['上方', gt]].filter(g => g[1] > 0.04);
        if (gaps.length) out.push(issue('door-gap', Math.max(...gaps.map(g => g[1])) > 0.05 ? 'mid' : 'low', { obj: dname, ownerKey: 'doorgap' + i, pos: [+((c.x0 + c.x1) / 2).toFixed(2), +((c.y0 + c.y1) / 2).toFixed(2), +((c.z0 + c.z1) / 2).toFixed(2)], room: room + '(' + (d.l + 1) + 'F)', level: d.l,
          desc: dname + ' 關閉時與門洞有縫：' + gaps.map(g => g[0] + ' ' + (g[1] * 100).toFixed(1) + ' cm').join('、'), hint: '調整門扇寬高或補門框。' }));
      }
    });
    // 門と門：全開同士／扇形の交差
    for (let i = 0; i < w.doors.length; i++) for (let j = i + 1; j < w.doors.length; j++) {
      if (w.doors[i].l !== w.doors[j].l) continue;
      const di = w.doors[i], dj = w.doors[j]; if (Math.hypot(di.mid[0] - dj.mid[0], di.mid[1] - dj.mid[1]) > 2.5) continue;
      let hit = null;
      sweeps[i].forEach(si => sweeps[j].forEach(sj => { if (hit) return; si.segs.forEach(a => sj.segs.forEach(b => {
        if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) < 0.2) return;
        // 線分同士の最短距離
        const dist = segDist(a, b); if (dist < (a.th + b.th) / 2 - 0.015) hit = { ti: si.t, tj: sj.t };
      })); }));
      if (hit) out.push(issue('door-sweep', 'high', { obj: '門#' + i + ' × 門#' + j, ownerKey: 'door' + i + '&door' + j, pos: [+((di.mid[0] + dj.mid[0]) / 2).toFixed(2), +(w.base(di.l) + 1).toFixed(2), +((di.mid[1] + dj.mid[1]) / 2).toFixed(2)], room: ctx.roomAt(di.l, di.mid[0], di.mid[1]) + '(' + (di.l + 1) + 'F)', level: di.l,
        desc: '門#' + i + ' 開 ' + Math.round(hit.ti * 100) + '% 與 門#' + j + ' 開 ' + Math.round(hit.tj * 100) + '% 時兩扇門互相穿過', hint: '改變其中一扇的鉸鏈邊或開向。' }));
    }
  } finally { w.doors.forEach((d, i) => { d.t = saved[i]; d.open = savedOpen[i]; E.applyDoor(d); }); }
  return out;
}
function segDist(a, b) {
  const p = [a.ax, a.az], q = [a.bx, a.bz], r = [b.ax, b.az], s = [b.bx, b.bz];
  const pd = (x, y, u, v) => { const dx = v[0] - u[0], dz = v[1] - u[1], l2 = dx * dx + dz * dz; let t = l2 ? ((x - u[0]) * dx + (y - u[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - u[0] - t * dx, y - u[1] - t * dz); };
  const inter = (() => { const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [s[0] - r[0], s[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0]; if (Math.abs(den) < 1e-12) return false; const t = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den, u = ((r[0] - p[0]) * d1[1] - (r[1] - p[1]) * d1[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1; })();
  if (inter) return 0;
  return Math.min(pd(p[0], p[1], r, s), pd(q[0], q[1], r, s), pd(r[0], r[1], p, q), pd(s[0], s[1], p, q));
}
module.exports = { TOL, doors };
