'use strict';
// 視覺煙霧測試：傳送點の視線ブロック（Node・レイキャスト）と、Playwright 截圖（全黑／全白／基準との差）
const fs = require('fs'), path = require('path');
const { issue } = require('./util');

// Node 側：各傳送點から正面へレイを出し、近すぎる壁・物件で視界が塞がれていないか
function viewBlocked(ctx) {
  const THREE = ctx.THREE, w = ctx.w, out = [], scan = ctx.scan();
  const targets = scan.meshes.filter(r => r.owner.kind !== 'door' || true).map(r => r.mesh);
  const rc = new THREE.Raycaster(), saved = { x: w.player.x, z: w.player.z, py: w.player.py, yaw: w.player.yaw, pitch: w.player.pitch, camY: w.player.camY };
  try {
    w.SPOTS.forEach((s, i) => {
      w.teleport(s); w.updateCamera(); ctx.scene.updateMatrixWorld(true);
      const cam = w.camera, o = cam.getWorldPosition(new THREE.Vector3()), dir = cam.getWorldDirection(new THREE.Vector3());
      const hits = [-0.18, 0, 0.18].map(dx => { const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), dx); rc.set(o, d.normalize()); const h = rc.intersectObjects(targets, false).filter(x => x.object.visible !== false); return h.length ? h[0].distance : 99; });
      const center = hits[1], mn = Math.min(...hits);
      if (center < 0.6 || mn < 0.35) out.push(issue('visual', center < 0.4 ? 'high' : 'mid', { obj: '傳送點「' + s[0] + '」', ownerKey: 'spot-view:' + s[0], pos: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], room: ctx.roomAt(s[3], o.x, o.z) + '(' + (s[3] + 1) + 'F)', level: s[3], layer: 'visual',
        desc: '傳送點「' + s[0] + '」的視線正前方 ' + (center * 100).toFixed(0) + ' cm 就被擋住（左／中／右 ' + hits.map(h => (h * 100).toFixed(0)).join('／') + ' cm），畫面幾乎只看到牆或物件', hint: '調整該傳送點的位置或視角（yaw）。' }));
    });
  } finally { Object.assign(w.player, saved); try { w.updateCamera(); } catch (_) {} }
  return out;
}

// ブラウザ側：截圖と画素統計・基準比較
async function screenshots(B, baseUrl, house, o) {
  const { page, errors } = await B.openHouse(o.browser, baseUrl, house, { viewport: { width: 480, height: 300 } });
  const out = [], shots = [], outDir = path.join(o.outDir, 'shots', house), baseDir = path.join(o.baselineShotsDir, house);
  fs.mkdirSync(outDir, { recursive: true }); if (o.updateBaseline) fs.mkdirSync(baseDir, { recursive: true });
  try { await page.waitForFunction(() => window.__walk.perf && window.__walk.perf.ready, null, { timeout: 150000, polling: 500 }); } catch (_) { out.push(issue('visual', 'low', { obj: '頁面', ownerKey: 'perf-ready', layer: 'visual', desc: '150 秒內著色器預編譯未完成，截圖可能是未渲染的畫面' })); }
  const spots = await page.evaluate(() => window.__walk.SPOTS.map(s => s[0]));
  for (let i = 0; i < spots.length; i++) {
    await page.evaluate(i => { const w = window.__walk; w.teleport(w.SPOTS[i]); w.updateCamera(); }, i);
    await page.waitForTimeout(500);
    const safe = String(i).padStart(2, '0') + '_' + spots[i].replace(/[^\w぀-ヿ一-鿿]+/g, '_');
    const file = path.join(outDir, safe + '.png'); let buf;
    try { buf = await page.screenshot({ path: file, type: 'png', timeout: 150000 }); } catch (e) { out.push(issue('visual', 'low', { obj: '傳送點「' + spots[i] + '」', ownerKey: 'shot-fail:' + spots[i], layer: 'visual', desc: '截圖失敗（頁面渲染過慢）：' + String(e.message).split('\n')[0] })); continue; }
    const baseFile = path.join(baseDir, safe + '.png');
    const baseB64 = fs.existsSync(baseFile) ? fs.readFileSync(baseFile).toString('base64') : null;
    const st = await page.evaluate(async ({ b64, base }) => {
      const load = s => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/png;base64,' + s; });
      const px = async s => { const im = await load(s), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
      const a = await px(b64); let dark = 0, light = 0, sum = 0; const n = a.width * a.height;
      for (let i = 0; i < n; i++) { const y = 0.2126 * a.data[i * 4] + 0.7152 * a.data[i * 4 + 1] + 0.0722 * a.data[i * 4 + 2]; sum += y; if (y < 14) dark++; else if (y > 244) light++; }
      const r = { mean: sum / n, dark: dark / n, light: light / n, diff: null };
      if (base) { const b = await px(base); if (b.width === a.width && b.height === a.height) { let big = 0, tot = 0; for (let i = 0; i < n; i++) { const d = (Math.abs(a.data[i * 4] - b.data[i * 4]) + Math.abs(a.data[i * 4 + 1] - b.data[i * 4 + 1]) + Math.abs(a.data[i * 4 + 2] - b.data[i * 4 + 2])) / 3; tot += d; if (d > 32) big++; } r.diff = { frac: big / n, mean: tot / n }; } else r.diff = { size: true }; }
      return r;
    }, { b64: buf.toString('base64'), base: baseB64 });
    shots.push({ spot: spots[i], file, stats: st });
    const common = { obj: '傳送點「' + spots[i] + '」', ownerKey: 'shot:' + spots[i], layer: 'visual', shot: file };
    if (st.dark > 0.9) out.push(issue('visual', 'high', Object.assign({}, common, { desc: '截圖幾乎全黑（' + Math.round(st.dark * 100) + '% 像素過暗）', hint: '可能是視點在牆內、燈光未開或渲染失敗。' })));
    else if (st.light > 0.9) out.push(issue('visual', 'high', Object.assign({}, common, { desc: '截圖幾乎全白（' + Math.round(st.light * 100) + '% 像素過亮）', hint: '可能是視點貼近白牆或曝光異常。' })));
    if (st.diff && st.diff.frac !== undefined && st.diff.frac > 0.08) out.push(issue('visual', st.diff.frac > 0.3 ? 'high' : 'mid', Object.assign({}, common, { desc: '與基準截圖不同：' + Math.round(st.diff.frac * 100) + '% 像素差異大（平均差 ' + st.diff.mean.toFixed(1) + '）', hint: '確認是否為預期的改動；是的話 --update-baseline --screenshots 更新基準。' })));
    if (o.updateBaseline) fs.copyFileSync(file, baseFile);
  }
  await page.context().close();
  return { issues: out, shots, errors };
}
module.exports = { viewBlocked, screenshots };
