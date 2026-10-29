'use strict';
// Playwright 取得・靜態伺服器・頁面載入（lib/perf.js の mergeStatic を無効化して mesh を個別のまま検査する）
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..', '..');

function loadPlaywright() {
  const tries = ['playwright', 'playwright-core', '/Users/yuming_linnuco.co.jp/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core'];
  for (const t of tries) { try { return require(t); } catch (_) {} }
  throw new Error('Playwright が見つかりません');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml' };
function startStatic(root, port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

// opts.root: 房子所在資料夾（預設專案根）, opts.port
async function serve(opts) {
  const root = path.resolve(opts.root || ROOT), port = opts.port || 8765;
  // 既存の伺服器が同じ root を配っているとは限らないため、必ず自前で開く（埠衝突時は +1 を試す）
  for (let p = port; p < port + 20; p++) {
    try { const srv = await startStatic(root, p); return { url: 'http://127.0.0.1:' + p, close: () => new Promise(r => srv.close(r)) }; } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
  throw new Error('空きポートがありません');
}

async function launch() {
  const { chromium } = loadPlaywright();
  return chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

// 回傳 {page, walk 準備完了}。mergeStatic を無効化するため lib/perf.js を route で差し替える。
async function openHouse(browser, baseUrl, house, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route(/\/lib\/(storeys|catalog|perf)\.js/, async route => {
    const resp = await route.fetch(); let body = await resp.text();
    body = require('./nodeload').patchEngine(body, route.request().url().split('?')[0]);
    await route.fulfill({ response: resp, body });
  });
  await page.goto(baseUrl + '/' + house + '.html?v=qa#debug', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__walk && window.__walk.perf, null, { timeout: 120000, polling: 250 });
  await page.evaluate(() => { const w = window.__walk; if (w.perf && w.perf.gov) { try { w.perf.gov.step = 0; } catch (_) {} } });
  return { page, ctx, errors };
}

module.exports = { ROOT, loadPlaywright, serve, launch, openHouse };
