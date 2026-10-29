'use strict';
// 檢查共用的場景讀取層。Node（headless 引擎）與瀏覽器頁面內都能執行：只依賴 THREE 與 window.__walk。
// 提供：mesh 掃描與歸屬（家具／固定設備／門／窗簾／建築）、世界 AABB、室名、動畫推進。

function makeCtx(THREE, w, Walk, house) {
  const E = w.E, scene = w.scene;
  const ctx = { THREE, w, E, Walk, house, scene };
  const SH = w.base(1) - w.base(0) || 2.7;
  ctx.SH = SH;
  ctx.levelOfY = y => w.levelOf(y);
  ctx.roomAt = (l, x, z) => { try { return w.roomAt(l, x, z).n || ''; } catch (_) { return ''; } };
  ctx.roomOf = (x, y, z) => { const l = ctx.levelOfY(y); return ctx.roomAt(l, x, z) + '(' + (l + 1) + 'F)'; };

  const moverByW = new Map(); w.FS.movers.forEach(m => moverByW.set(m.W, m));
  const doorRoots = new Map(); w.doors.forEach((d, i) => { [d.pv, d.leaf, d.fold].forEach(o => { if (o && o.isObject3D) doorRoots.set(o, i); }); });
  const curtainRoots = new Map(); (E.curtainSets || []).forEach((P, i) => { if (P.group) curtainRoots.set(P.group, i); });
  ctx.moverByW = moverByW;

  function chainVisible(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }

  function srcName(P) {
    const frames = String(P.qaSrc || '').split('|');
    for (const f of frames) { const m = f.match(/at (?:new )?(?:[\w$]+\.)*([\w$]+)(?: \[as [\w$]+\])? \(/) || f.match(/^\s*([\w$]+)@/); if (m && !/^(Piece|make|map|forEach|anonymous|Object|Array|new|Walk|placeItem|fixture)$/.test(m[1])) return m[1]; }
    return '';
  }
  const matNames = new Map(); [E.M, E.FL, E.WM].forEach(o => { if (o) Object.keys(o).forEach(k => { if (o[k] && o[k].isMaterial && !matNames.has(o[k])) matNames.set(o[k], k); }); });
  ctx.matName = mesh => { const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material; return (m && matNames.get(m)) || (m && m.name) || ''; };

  // 歸屬：nearest な mover / door / curtain / piece group を探し、無ければ building
  function ownerOf(mesh) {
    for (let o = mesh; o; o = o.parent) {
      if (moverByW.has(o)) { const m = moverByW.get(o); return { key: 'furn:' + m.id, kind: 'furn', id: m.id, name: m.label || m.id, mover: m, root: o }; }
      if (doorRoots.has(o)) { const i = doorRoots.get(o); return { key: 'door:' + i, kind: 'door', id: 'door' + i, name: '門#' + i, root: o, door: w.doors[i] }; }
      if (curtainRoots.has(o)) { const i = curtainRoots.get(o); return { key: 'curtain:' + i, kind: 'curtain', id: 'curtain' + i, name: '窗簾#' + i, root: o }; }
    }
    // 固定設備（fixture）：Rg の直下に piece.group を持つ
    for (let o = mesh; o; o = o.parent) {
      const P = Walk && Walk.PIECES && Walk.PIECES.get(o);
      if (P) { const p = new THREE.Vector3(); o.updateWorldMatrix(true, false); o.getWorldPosition(p); return { key: 'fix:' + o.uuid.slice(0, 8), kind: 'fixture', id: 'fix', name: (srcName(P) || '固定設備') + '@' + p.x.toFixed(1) + ',' + p.z.toFixed(1), root: o, piece: P }; }
    }
    return { key: 'building', kind: 'building', id: 'building', name: '建築', root: null };
  }

  const SKIP_ALWAYS = o => { const m = o.material; const mm = Array.isArray(m) ? m[0] : m; return !!(mm && (mm.blending === THREE.AdditiveBlending || (mm.depthWrite === false && mm.transparent))) || o.userData.qaIgnore; };

  const tmp = new THREE.Box3();
  // 掃描：{meshes:[{mesh,box,owner,idx}], byOwner:Map}
  ctx.scan = function () {
    scene.updateMatrixWorld(true);
    const meshes = [], byOwner = new Map(), ownerCache = new Map(), avatar = E.avatar;
    scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isLine || o.isPoints) return;
      if (avatar && (o === avatar || o.parent === avatar)) return;
      if (!chainVisible(o) || !o.geometry) return;
      if (SKIP_ALWAYS(o)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (!o.geometry.boundingBox || !isFinite(o.geometry.boundingBox.min.x)) return;
      const box = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      // 親チェーンで歸屬をキャッシュ
      let ow = ownerCache.get(o.parent);
      if (!ow) { ow = ownerOf(o); ownerCache.set(o.parent, ow); }
      const rec = { mesh: o, box, owner: ow, idx: meshes.length, size: box.getSize(new THREE.Vector3()), geo: o.geometry.type };
      meshes.push(rec);
      if (!byOwner.has(ow.key)) byOwner.set(ow.key, { owner: ow, meshes: [] });
      byOwner.get(ow.key).meshes.push(rec);
    });
    ctx.last = { meshes, byOwner };
    return ctx.last;
  };

  ctx.unionBox = recs => { const b = new THREE.Box3(); recs.forEach(r => b.union(r.box)); return b; };
  ctx.center = box => box.getCenter(new THREE.Vector3());
  ctx.fmtPos = box => { const c = box.getCenter(new THREE.Vector3()); return [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)]; };
  ctx.cm = v => Math.round(v * 1000) / 10;
  ctx.partName = rec => {
    const s = rec.size; const o = rec.owner;
    // 家具内の位置（子インデックス経路）
    const path = []; for (let q = rec.mesh; q && q !== o.root && q.parent; q = q.parent) path.unshift(q.parent.children.indexOf(q));
    const mn = ctx.matName(rec.mesh);
    return o.name + (path.length ? '/' + path.join('.') : '') + ' ' + rec.geo.replace('Geometry', '') + (mn ? '[' + mn + ']' : '') + ' ' + Math.round(s.x * 100) + '×' + Math.round(s.y * 100) + '×' + Math.round(s.z * 100) + 'cm';
  };

  // 床の高さ（レベル l の床）
  ctx.floorY = (x, z, y) => { const l = ctx.levelOfY(y); return w.floorAt(x, z, w.base(l) + 0.6); };

  // 壁の固体箱（ドア以外の kind 'w'）
  ctx.wallBoxes = () => w.cols().filter(c => c.kind === 'w' && !c.door);
  ctx.allWallCols = () => (E.walls || []).filter(c => c.kind === 'w' && !c.door);

  // 動画：dt 秒ぶん進める（tick の同等処理）。t は秒。
  let simT = 1000;
  ctx.advance = function (dt) {
    for (let rest = dt; rest > 1e-6; rest -= 0.04) {
      const d = Math.min(0.04, rest); simT += d; try { if (globalThis.__qaTimers) globalThis.__qaTimers.advance(d * 1000); else if (ctx.timers) ctx.timers.advance(d * 1000); } catch (_) {}
      try { E.updateDoors(d); } catch (_) {}
      for (let i = 0; i < E.modeAnims.length; i++) { try { E.modeAnims[i](simT); } catch (_) {} }
      for (let i = 0; i < E.furnAnims.length; i++) { const a = E.furnAnims[i]; try { if (a.live() && a.f(simT, {})) ctx.busy = true; } catch (e) { ctx.animErrors.push(String(e && e.message || e)); } }
    }
  };
  ctx.animErrors = [];
  // 動きが止まるまで進める。戻り値 {settled, t}
  ctx.settle = function (maxSec) {
    let t = 0; const step = 1 / 30;
    for (; t < maxSec; t += step) {
      ctx.busy = false; ctx.advance(step);
      const doorBusy = w.doors.some(d => d.t !== (d.open ? 1 : 0));
      if (!ctx.busy && !doorBusy && t > 0.2) return { settled: true, t };
    }
    return { settled: false, t };
  };
  ctx.touch = () => { try { E.rebuild(); } catch (_) {} };
  return ctx;
}
module.exports = { makeCtx };
