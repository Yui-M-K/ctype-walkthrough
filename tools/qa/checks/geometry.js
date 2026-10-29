'use strict';
// 幾何檢查：a 穿牆／貼牆範圍、b 浮空、c 重疊、h 組件連續性。入力は ctx.scan() の結果。
const U = require('../lib/util');
const { issue, overlap3, boxDist, vol, makeGrid } = U;

const TOL = { pen: 0.025, penRatio: 0.2, penVol: 0.003, mountCover: 0.9, floatTol: 0.03, contTol: 0.01, overlapPen: 0.03 };
const isObj = o => o.kind === 'furn' || o.kind === 'fixture' || o.kind === 'curtain';
const minDim = s => Math.min(s.x, s.y, s.z);

// a-1. 物件の mesh が壁の固体箱に食い込む
function penetration(ctx, scan, opt) {
  const walls = ctx.allWallCols(), out = [], per = new Map();
  scan.meshes.forEach(r => {
    if (opt && opt.scope && !r.box.intersectsBox(opt.scope)) return;
    if (!isObj(r.owner) || minDim(r.size) < 0.004 || Math.max(r.size.x, r.size.y, r.size.z) > 3) return;
    const mv = vol(r.box);
    for (const c of walls) {
      const ox = Math.min(r.box.max.x, c.x1) - Math.max(r.box.min.x, c.x0), oy = Math.min(r.box.max.y, c.y1) - Math.max(r.box.min.y, c.y0), oz = Math.min(r.box.max.z, c.z1) - Math.max(r.box.min.z, c.z0);
      const depth = Math.min(ox, oy, oz); if (depth < TOL.pen) continue;
      const v = ox * oy * oz, ratio = v / Math.max(mv, 1e-9);
      if (ratio < TOL.penRatio && v < TOL.penVol) continue;
      const k = r.owner.key + '|' + (Math.abs(c.x1 - c.x0) < Math.abs(c.z1 - c.z0) ? 'z' : 'x') + (c.x0 + c.z0).toFixed(1);
      const e = per.get(k) || { owner: r.owner, depth: 0, ratio: 0, rec: r, wall: c, n: 0 };
      e.n++; if (depth > e.depth) { e.depth = depth; e.ratio = ratio; e.rec = r; e.wall = c; }
      per.set(k, e);
    }
  });
  per.forEach(e => {
    const cm = ctx.cm(e.depth), sev = e.depth >= 0.06 && e.ratio >= 0.3 ? 'high' : e.depth >= 0.04 ? 'mid' : 'low';
    out.push(issue('wall-pen', sev, { obj: e.owner.name, part: ctx.partName(e.rec), pos: ctx.fmtPos(e.rec.box), room: ctx.roomOf(...ctx.fmtPos(e.rec.box)), ownerKey: e.owner.key,
      desc: '「' + e.owner.name + '」的零件穿進牆體約 ' + cm + ' cm（體積佔零件 ' + Math.round(e.ratio * 100) + '%，共 ' + e.n + ' 個零件）',
      hint: '把物件往房內移開牆面至少 ' + cm + ' cm，或縮小該零件。', extra: { depthCm: cm, ratio: +e.ratio.toFixed(2) } }));
  });
  return out;
}

// a-2. 貼牆物件：整件要落在同一面牆的範圍內（不超出端點／不懸在洞口或牆角外）
function mounted(ctx, scan, opt) {
  const out = [], walls = ctx.allWallCols(), E = ctx.E;
  const units = [];
  scan.byOwner.forEach(({ owner, meshes }) => { if (isObj(owner) && owner.kind !== 'curtain') units.push({ owner, meshes, box: ctx.unionBox(meshes), mesh: false }); });
  // 建築側の薄板（額縁・鏡など）：厚み ≤ 4cm、高さ・幅 8cm〜1m、床から ≥ 60cm の mesh を 1 件ずつ。背面に別 mesh が接する（棚板や戸棚の一部）ものは除く
  const thin = scan.meshes.filter(r => r.owner.kind === 'building' && Math.min(r.size.x, r.size.z) <= 0.04 && Math.min(r.size.x, r.size.z) >= 0.004 && Math.max(r.size.x, r.size.z) >= 0.08 && Math.max(r.size.x, r.size.z) <= 1 && r.size.y >= 0.08 && r.size.y <= 1);
  const grid = makeGrid(0.5); scan.meshes.forEach(r => { if (r.owner.kind !== 'door') grid.add(r.idx, r.box, 0.02); });
  thin.forEach(r => {
    if (r.box.min.y - ctx.floorY((r.box.min.x + r.box.max.x) / 2, (r.box.min.z + r.box.max.z) / 2, r.box.min.y + 0.3) < 0.6) return;
    const back = r.box.clone().expandByScalar(0.015); let backed = false;
    grid.query(back, 0).forEach(j => { if (backed || j === r.idx) return; const q = scan.meshes[j]; if (q.owner.kind === 'door') return; const sz = q.size; const wallLike = Math.min(sz.x, sz.z) <= 0.3 && sz.y >= 1.2; if (wallLike) return; if (q.box.intersectsBox(back) && Math.max(sz.x, sz.y, sz.z) >= Math.max(r.size.x, r.size.z, r.size.y) * 0.9 && vol(q.box) > vol(r.box) * 1.5 && j < r.idx + 0) backed = true; });
    if (!backed) units.push({ owner: { key: 'bm:' + r.idx, kind: 'building', name: ctx.partName(r), mover: null }, meshes: [r], box: r.box.clone(), mesh: true });
  });
  units.forEach(({ owner, meshes, box, mesh }) => {
    const B = box, s = B.getSize(new ctx.THREE.Vector3());
    const wallFlag = owner.mover && owner.mover.wall;
    const elevated = B.min.y - ctx.floorY((B.min.x + B.max.x) / 2, (B.min.z + B.max.z) / 2, B.min.y + 0.3) >= 0.25;
    if (!wallFlag && !elevated) return;
    if (mesh && B.min.y - ctx.floorY((B.min.x + B.max.x) / 2, (B.min.z + B.max.z) / 2, B.min.y + 0.3) < 0.15) return;
    if (Math.min(s.x, s.z) > 0.45 && !wallFlag) return;          // 厚みのある吊り戸棚等は対象外（背面接触のみ見る）
    // 背面の接触壁を探す
    let best = null;
    for (const c of walls) {
      if (c.y1 <= B.min.y + 0.02 || c.y0 >= B.max.y - 0.02) continue;
      const xNormal = (c.x1 - c.x0) <= (c.z1 - c.z0);
      let face = null, gap = null;
      if (xNormal) {
        if (Math.min(B.max.z, c.z1) - Math.max(B.min.z, c.z0) < -0.15) continue;
        const gE = B.min.x - c.x1, gW = c.x0 - B.max.x;              // 東面（+x へ向く）／西面
        if (gE >= -0.12 && gE <= 0.03) { face = c.x1; gap = gE; } else if (gW >= -0.12 && gW <= 0.03) { face = c.x0; gap = gW; } else continue;
        face = { axis: 'x', pos: face, side: gap === gE && gE >= -0.12 && gE <= 0.03 && B.min.x >= c.x1 - 0.12 ? 1 : -1, gap };
      } else {
        if (Math.min(B.max.x, c.x1) - Math.max(B.min.x, c.x0) < -0.15) continue;
        const gS = B.min.z - c.z1, gN = c.z0 - B.max.z;
        if (gS >= -0.12 && gS <= 0.03) { face = c.z1; gap = gS; } else if (gN >= -0.12 && gN <= 0.03) { face = c.z0; gap = gN; } else continue;
        face = { axis: 'z', pos: face, side: gap === gS && gS >= -0.12 && gS <= 0.03 && B.min.z >= c.z1 - 0.12 ? 1 : -1, gap };
      }
      const area = (Math.min(B.max.y, c.y1) - Math.max(B.min.y, c.y0)) * Math.max(0.001, face.axis === 'x' ? Math.min(B.max.z, c.z1) - Math.max(B.min.z, c.z0) : Math.min(B.max.x, c.x1) - Math.max(B.min.x, c.x0));
      if (!best || area > best.area) best = { face, area, c };
    }
    if (!best) {
      if (wallFlag && !mesh) out.push(issue('mount', 'mid', { obj: owner.name, ownerKey: owner.key, pos: ctx.fmtPos(B), room: ctx.roomOf(...ctx.fmtPos(B)), desc: '標記為掛牆物件「' + owner.name + '」背面 3 cm 內沒有牆（懸空）', hint: '把物件吸附回牆面。' }));
      return;
    }
    const f = best.face, a0 = f.axis === 'x' ? B.min.z : B.min.x, a1 = f.axis === 'x' ? B.max.z : B.max.x, y0 = B.min.y, y1 = B.max.y;
    // 同一平面上の壁（面位置 ±3cm）が (along, y) 平面でどれだけ覆うか
    const rects = [];
    walls.forEach(c => {
      const xNormal = (c.x1 - c.x0) <= (c.z1 - c.z0); if ((f.axis === 'x') !== xNormal) return;
      const faceNear = f.axis === 'x' ? (Math.abs(c.x1 - f.pos) < 0.03 || Math.abs(c.x0 - f.pos) < 0.03) : (Math.abs(c.z1 - f.pos) < 0.03 || Math.abs(c.z0 - f.pos) < 0.03);
      if (!faceNear) return;
      const ca0 = f.axis === 'x' ? c.z0 : c.x0, ca1 = f.axis === 'x' ? c.z1 : c.x1;
      const r = [Math.max(a0, ca0), Math.min(a1, ca1), Math.max(y0, c.y0), Math.min(y1, c.y1)]; if (r[1] > r[0] && r[3] > r[2]) rects.push(r);
    });
    // 覆蓋面積：座標圧縮でグリッド化
    const xs = [a0, a1], ys = [y0, y1]; rects.forEach(r => { xs.push(r[0], r[1]); ys.push(r[2], r[3]); });
    xs.sort((p, q) => p - q); ys.sort((p, q) => p - q);
    let covered = 0; const total = (a1 - a0) * (y1 - y0); let missX0 = 1e9, missX1 = -1e9;
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2, ar = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]); if (ar <= 0 || cx < a0 || cx > a1 || cy < y0 || cy > y1) continue;
      if (rects.some(r => cx >= r[0] && cx <= r[1] && cy >= r[2] && cy <= r[3])) covered += ar; else { missX0 = Math.min(missX0, xs[i]); missX1 = Math.max(missX1, xs[i + 1]); }
    }
    const frac = covered / Math.max(total, 1e-9);
    if (frac < TOL.mountCover && total > 1e-4) {
      const miss = Math.round((1 - frac) * 100);
      const frameLike = !mesh || scan.meshes.some(q => q.geo === 'PlaneGeometry' && q.box.intersectsBox(B.clone().expandByScalar(0.05)) && q.size.y >= B.getSize(new ctx.THREE.Vector3()).y * 0.4);
      out.push(issue('mount', frac < 0.8 && frameLike ? 'high' : 'mid', { obj: owner.name, ownerKey: owner.key, pos: ctx.fmtPos(B), room: ctx.roomOf(...ctx.fmtPos(B)),
        desc: '貼牆物件「' + owner.name + '」背面只有 ' + Math.round(frac * 100) + '% 貼在牆上，約 ' + miss + '% 超出牆的端點或懸在洞口／牆角外（沿牆方向 ' + (missX0 < 1e8 ? ctx.cm(missX0) / 100 + '~' + ctx.cm(missX1) / 100 + ' m 無牆' : '') + '）',
        hint: '沿牆平移到整件都在牆面範圍內，或避開牆角、門窗洞口。', extra: { coverage: +frac.toFixed(2), axis: f.axis } }));
    }
  });
  return out;
}

// b. 浮空：全 mesh の接觸グラフ。床・壁・天井に連なる成分に入らないものが浮いている。
function floating(ctx, scan, opt) {
  const THREE = ctx.THREE, w = ctx.w, E = ctx.E, walls = ctx.allWallCols(), n = scan.meshes.length, tol = TOL.floatTol;
  const CH = E.CH || 2.5, parent = new Int32Array(n).map((_, i) => i), anchored = new Uint8Array(n);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const grid = makeGrid(0.5), recs = scan.meshes;
  recs.forEach(r => grid.add(r.idx, r.box, tol));
  const wallBoxes = walls.map(c => new THREE.Box3(new THREE.Vector3(c.x0, c.y0, c.z0), new THREE.Vector3(c.x1, c.y1, c.z1)));
  recs.forEach(r => {
    const B = r.box, l = ctx.levelOfY(B.min.y + 0.3), base = w.base(l);
    // 床に接する
    const pts = [[(B.min.x + B.max.x) / 2, (B.min.z + B.max.z) / 2], [B.min.x + 0.01, B.min.z + 0.01], [B.max.x - 0.01, B.min.z + 0.01], [B.min.x + 0.01, B.max.z - 0.01], [B.max.x - 0.01, B.max.z - 0.01]];
    for (const p of pts) { const fy = w.floorAt(p[0], p[1], B.min.y + 0.55); if (B.min.y <= fy + tol && B.max.y >= fy - tol) { anchored[r.idx] = 1; break; } }
    // 天井に接する
    if (!anchored[r.idx]) for (let lv = 0; lv < 3; lv++) { const cy = w.base(lv) + CH; if (B.max.y >= cy - tol && B.min.y <= cy + 0.5) { anchored[r.idx] = 1; break; } }
    // 壁に接する
    if (!anchored[r.idx]) for (const wb of wallBoxes) { if (boxDist(B, wb) <= tol) { anchored[r.idx] = 1; break; } }
  });
  recs.forEach(r => {
    grid.query(r.box, tol).forEach(j => { if (j <= r.idx) return; if (boxDist(r.box, recs[j].box) <= tol) union(r.idx, j); });
  });
  const anchoredRoot = new Set(); recs.forEach(r => { if (anchored[r.idx]) anchoredRoot.add(find(r.idx)); });
  const comps = new Map();
  recs.forEach(r => { const k = find(r.idx); if (anchoredRoot.has(k)) return; (comps.get(k) || comps.set(k, []).get(k)).push(r); });
  const out = [];
  comps.forEach(list => {
    if (opt && opt.scope && !list.some(r => r.box.intersectsBox(opt.scope))) return;
    const B = ctx.unionBox(list), s = B.getSize(new THREE.Vector3()), maxd = Math.max(s.x, s.y, s.z);
    if (maxd < 0.02) return;
    const ow = Array.from(new Set(list.map(r => r.owner.name)));
    const sev = maxd >= 0.25 ? 'high' : maxd >= 0.08 ? 'mid' : 'low';
    // 底面から最も近い支持面までの距離を報告
    out.push(issue('float', sev, { obj: ow.join(' / '), ownerKey: list[0].owner.key, part: list.slice(0, 3).map(r => ctx.partName(r)).join('; ') + (list.length > 3 ? ' 他' + (list.length - 3) : ''),
      pos: ctx.fmtPos(B), room: ctx.roomOf(...ctx.fmtPos(B)),
      desc: '浮空：' + list.length + ' 個零件（' + Math.round(s.x * 100) + '×' + Math.round(s.y * 100) + '×' + Math.round(s.z * 100) + ' cm，底部高度 ' + B.min.y.toFixed(2) + ' m）周圍 ' + Math.round(tol * 100) + ' cm 內沒有地板／牆／天花／其他物件可支撐',
      hint: '把它放到支撐面上或補上固定它的零件；若是刻意懸吊（吊燈／光暈）加白名單。', extra: { n: list.length, boxMin: [B.min.x, B.min.y, B.min.z].map(v => +v.toFixed(2)), boxMax: [B.max.x, B.max.y, B.max.z].map(v => +v.toFixed(2)) } }));
  });
  return out;
}

// c. 重疊：(1) 平面碰撞矩形 (2) 異なる所有者の mesh 3D 食い込み
function overlap(ctx, scan, opt) {
  const out = [], w = ctx.w;
  // (1) 平面（scope 指定時は省略）
  if (!(opt && opt.scope)) {
  const movers = w.FS.movers.filter(m => m.W.parent && !w.FS.isStored(m.id) && (function vis(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; })(m.W));
  const rects = [];
  movers.forEach(m => m.own.forEach(c => { if (c.mvOff) return; rects.push({ c, name: m.label || m.id, key: 'furn:' + m.id, l: c.l }); }));
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j]; if (a.key === b.key || a.l !== b.l) continue;
    const ox = Math.min(a.c.x1, b.c.x1) - Math.max(a.c.x0, b.c.x0), oz = Math.min(a.c.z1, b.c.z1) - Math.max(a.c.z0, b.c.z0);
    if (ox < 0.05 || oz < 0.05) continue;
    const ar = ox * oz, smaller = Math.min((a.c.x1 - a.c.x0) * (a.c.z1 - a.c.z0), (b.c.x1 - b.c.x0) * (b.c.z1 - b.c.z0));
    if (ar < 0.04 || ar / smaller < 0.2) continue;
    out.push(issue('overlap', ar / smaller > 0.5 ? 'mid' : 'low', { obj: a.name + ' × ' + b.name, ownerKey: a.key + '&' + b.key, pos: [+((Math.max(a.c.x0, b.c.x0) + Math.min(a.c.x1, b.c.x1)) / 2).toFixed(2), +a.c.y0.toFixed(2), +((Math.max(a.c.z0, b.c.z0) + Math.min(a.c.z1, b.c.z1)) / 2).toFixed(2)],
      room: ctx.roomOf((Math.max(a.c.x0, b.c.x0) + Math.min(a.c.x1, b.c.x1)) / 2, a.c.y0 + 0.3, (Math.max(a.c.z0, b.c.z0) + Math.min(a.c.z1, b.c.z1)) / 2),
      desc: '兩件可移動家具的碰撞矩形重疊 ' + (ar * 10000 | 0) + ' cm²（' + Math.round(ar / smaller * 100) + '% 的較小者）', hint: '錯開擺放位置。', extra: { areaM2: +ar.toFixed(3) } }));
  }
  }
  // (2) mesh 3D
  const recs = scan.meshes.filter(r => (isObj(r.owner) || r.owner.kind === 'building') && minDim(r.size) >= 0.02 && Math.max(r.size.x, r.size.y, r.size.z) <= 2.5);
  const grid = makeGrid(0.5); recs.forEach(r => grid.add(r.idx, r.box, 0));
  const byPair = new Map();
  recs.forEach(r => {
    if (!isObj(r.owner)) return;
    if (opt && opt.scope && !r.box.intersectsBox(opt.scope)) return;
    grid.query(r.box, 0).forEach(j => {
      const q = scan.meshes[j]; if (q.owner.key === r.owner.key) return;
      if (isObj(q.owner) && q.idx < r.idx) return;                        // 対称ペアは 1 回だけ
      if (q.owner.kind === 'curtain' || r.owner.kind === 'curtain') return;
      const [ox, oy, oz] = overlap3(r.box, q.box), d = Math.min(ox, oy, oz); if (d < TOL.overlapPen) return;
      const v = ox * oy * oz, ratio = v / Math.max(Math.min(vol(r.box), vol(q.box)), 1e-9);
      if (ratio < 0.25 || v < 2e-4) return;
      const k = [r.owner.key, q.owner.key].sort().join('&');
      const e = byPair.get(k) || { a: r.owner, b: q.owner, depth: 0, v: 0, ra: r, rb: q, n: 0 };
      e.n++; e.v += v; if (d > e.depth) { e.depth = d; e.ra = r; e.rb = q; } byPair.set(k, e);
    });
  });
  byPair.forEach(e => {
    const sev = e.depth >= 0.08 && e.v > 0.003 ? 'high' : e.depth >= 0.05 ? 'mid' : 'low';
    const bb = e.ra.box.clone().intersect(e.rb.box);
    out.push(issue('overlap', sev, { obj: e.a.name + ' × ' + e.b.name, ownerKey: [e.a.key, e.b.key].sort().join('&'), part: ctx.partName(e.ra) + ' ∩ ' + ctx.partName(e.rb), pos: ctx.fmtPos(bb), room: ctx.roomOf(...ctx.fmtPos(bb)),
      desc: '「' + e.a.name + '」與「' + e.b.name + '」的零件互相穿插，最深約 ' + ctx.cm(e.depth) + ' cm（' + e.n + ' 組零件，重疊體積約 ' + Math.round(e.v * 1e6) + ' cm³）', hint: '分開兩者位置，或確認是否為刻意的嵌入（如抽屜／內建）。', extra: { depthCm: ctx.cm(e.depth), vol_cm3: Math.round(e.v * 1e6) } }));
  });
  return out;
}

// h. 組件連續性：同一件家具／設備の mesh を、AABB 距離 ≤ 1cm でつないだとき 1 つの連結成分になるか
function continuity(ctx, scan, opt) {
  const THREE = ctx.THREE, out = [], only = opt && opt.only, state = (opt && opt.state) || '';
  scan.byOwner.forEach(({ owner, meshes }) => {
    if (!(owner.kind === 'furn' || owner.kind === 'fixture')) return;
    if (only && !only.has(owner.key)) return;
    const list = meshes.filter(r => minDim(r.size) >= 0 && Math.max(r.size.x, r.size.y, r.size.z) > 0.004);
    if (list.length < 2) return;
    const parent = list.map((_, i) => i), find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const tol = TOL.contTol;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (boxDist(list[i].box, list[j].box) <= tol) { const a = find(i), b = find(j); if (a !== b) parent[a] = b; }
    const comps = new Map(); list.forEach((r, i) => { const k = find(i); (comps.get(k) || comps.set(k, []).get(k)).push(r); });
    if (comps.size < 2) return;
    const cl = Array.from(comps.values()).map(rs => ({ rs, box: ctx.unionBox(rs), size: ctx.unionBox(rs).getSize(new THREE.Vector3()) }));
    cl.sort((a, b) => vol(b.box) - vol(a.box));
    const main = cl[0];
    cl.slice(1).forEach(c => {
      const gap = boxDist(c.box, main.box), maxd = Math.max(c.size.x, c.size.y, c.size.z);
      // 主体から最も近い別成分への距離（最大成分以外のペアも見る）
      let g = gap; cl.forEach(o => { if (o !== c) g = Math.min(g, boxDist(c.box, o.box)); });
      if (maxd < 0.03 && g < 0.1) return;
      if (owner.kind === 'fixture' && g > 0.15) return;        // 固定設備は離れた部品を 1 件にまとめて作ることがある（縫のような小さな隙間だけ見る）
      const sev = (g >= 0.06 && maxd >= 0.15) || (g >= 0.028 && maxd >= 0.5) ? 'high' : g >= 0.02 && maxd >= 0.1 ? 'mid' : 'low';
      out.push(issue('continuity', sev, { obj: owner.name, ownerKey: owner.key + (state ? '@' + state : ''), state, part: c.rs.slice(0, 3).map(r => ctx.partName(r)).join('; ') + (c.rs.length > 3 ? ' 他' + (c.rs.length - 3) : ''),
        pos: ctx.fmtPos(c.box), room: ctx.roomOf(...ctx.fmtPos(c.box)),
        desc: '「' + owner.name + '」' + (state ? '在狀態「' + state + '」下' : '') + '分裂成 ' + comps.size + ' 塊：其中一塊（' + c.rs.length + ' 個零件，' + Math.round(c.size.x * 100) + '×' + Math.round(c.size.y * 100) + '×' + Math.round(c.size.z * 100) + ' cm）與本體相隔約 ' + ctx.cm(gap) + ' cm 的縫',
        hint: '檢查該零件的位移／縮放是否與本體動畫同步（見根因判斷）。', extra: { gapCm: ctx.cm(gap), comps: comps.size } }));
    });
  });
  return out;
}

module.exports = { TOL, penetration, mounted, floating, overlap, continuity };
