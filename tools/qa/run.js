#!/usr/bin/env node
'use strict';
// node tools/qa/run.js <house|all> [--checks a,b,c] [--update-baseline] [--screenshots] [--open-report]
// 詳細は tools/qa/README.md
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const QA = __dirname, ROOT = path.resolve(QA, '..', '..');
const R = require('./lib/report'), U = require('./lib/util');

const HOUSES = ['ctype', 'town3f', 'ideal', 'ideal_b', 'ideal_c', 'ideal_wide', 'a2'];
const GROUPS = {
  a: ['wall-pen', 'mount'], b: ['float'], c: ['overlap'], d: ['door'], e: ['reach'], f: ['opening'], g: ['level'], h: ['continuity'],
  interact: ['interact'], visual: ['visual'],
};
GROUPS.data = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap(k => GROUPS[k]);
GROUPS.scene = ['interact'];
GROUPS.all = GROUPS.data.concat(['interact', 'visual']);
const ALIAS = { 'wall-pen': 'wall-pen', pen: 'wall-pen', mount: 'mount', float: 'float', overlap: 'overlap', door: 'door', doors: 'door', reach: 'reach', opening: 'opening', openings: 'opening', level: 'level', levels: 'level', continuity: 'continuity', cont: 'continuity' };

function parseArgs(argv) {
  const o = { houses: [], checks: null, update: false, shots: false, open: false, root: ROOT, out: process.env.QA_OUT || path.join(os.tmpdir(), 'ctype-qa-out'), port: +process.env.QA_PORT || 8765, minSev: 'low', quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--checks') o.checks = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--update-baseline') o.update = true;
    else if (a === '--screenshots') o.shots = true;
    else if (a === '--open-report') o.open = true;
    else if (a === '--root') o.root = path.resolve(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--port') o.port = +argv[++i];
    else if (a === '--min-sev') o.minSev = argv[++i];
    else if (a === '--all-issues') o.allIssues = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (!a.startsWith('-')) o.houses.push(a);
  }
  return o;
}
function expandChecks(list) {
  const set = new Set();
  const add = t => { if (GROUPS[t] && !(GROUPS[t].length === 1 && GROUPS[t][0] === t)) GROUPS[t].forEach(add); else if (ALIAS[t]) set.add(ALIAS[t]); else set.add(t); };
  (list || ['data', 'scene', 'visual']).forEach(add);
  return set;
}
const now = () => Date.now();
const sec = ms => +(ms / 1000).toFixed(1);

async function runHouse(house, o, shared) {
  const t0 = now(), notes = [], issues = [], secs = { load: 0, data: 0, scene: 0, visual: 0 };
  const want = expandChecks(o.checks);
  const N = require('./lib/nodeload'), { makeCtx } = require('./lib/ctx');
  const file = path.join(o.root, house + '.html');
  if (!fs.existsSync(file)) throw new Error('找不到 ' + file);
  let t = now();
  const r = await N.load(house, { root: o.root });
  secs.load = sec(now() - t);
  const w = r.sandbox.__walk;
  const engineOk = !!(w && w.E && w.scene && w.FS && w.FS.movers);
  if (r.errors.length) notes.push('載入時有 ' + r.errors.length + ' 個例外：' + r.errors[0].slice(0, 160));
  let ctx = null, scan = null;
  if (!engineOk) {
    notes.push(house + '.html 不是共用的 storeys 引擎（lib/storeys.js），無法在 Node 載入場景；僅執行視覺層（截圖，需 --screenshots）。');
  } else {
    const THREE = await N.realThree(); ctx = makeCtx(THREE, w, r.sandbox.Walk, house); ctx.timers = r.sandbox.__qaTimers;
    t = now(); scan = ctx.scan();
    const G = require('./checks/geometry'), D = require('./checks/doors'), A = require('./checks/access'), I = require('./checks/interact'), V = require('./lib/visual');
    const run = (name, fn) => { try { fn().forEach(i => issues.push(i)); } catch (e) { notes.push('檢查 ' + name + ' 發生例外：' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' | ')); } };
    if (want.has('wall-pen')) run('wall-pen', () => G.penetration(ctx, scan, {}));
    if (want.has('mount')) run('mount', () => G.mounted(ctx, scan, {}));
    if (want.has('float')) run('float', () => G.floating(ctx, scan, {}));
    if (want.has('overlap')) run('overlap', () => G.overlap(ctx, scan, {}));
    if (want.has('continuity')) run('continuity', () => G.continuity(ctx, scan, {}));
    if (want.has('door')) run('door', () => D.doors(ctx, scan, {}));
    if (want.has('reach')) run('reach', () => A.reach(ctx, scan, {}));
    if (want.has('opening')) run('opening', () => A.openings(ctx, scan, {}));
    if (want.has('level')) run('level', () => A.levels(ctx, scan, {}));
    secs.data = sec(now() - t);
    if (want.has('interact')) { t = now(); run('interact', () => I.interact(ctx, scan, {})); secs.scene = sec(now() - t); if (ctx.interactStats) notes.push('互動：共 ' + ctx.interactStats.total + ' 個可互動項目已測試'); }
    if (want.has('visual')) { t = now(); run('visual', () => V.viewBlocked(ctx)); secs.visual += sec(now() - t); }
  }
  // 截圖（Playwright）
  if (o.shots && (want.has('visual'))) {
    t = now();
    try {
      const Bw = require('./lib/browser'), V = require('./lib/visual');
      if (!shared.browser) shared.browser = await Bw.launch();
      if (!shared.server) shared.server = await Bw.serve({ root: o.root, port: o.port });
      const res = await V.screenshots({ openHouse: Bw.openHouse }, shared.server.url, house, { browser: shared.browser, outDir: o.out, baselineShotsDir: path.join(o.out, 'baseline-shots'), updateBaseline: o.update });
      res.issues.forEach(i => issues.push(i));
      if (res.errors.length) notes.push('頁面有 ' + res.errors.length + ' 個 console error：' + res.errors[0].slice(0, 120));
      notes.push('截圖 ' + res.shots.length + ' 張：' + path.join(o.out, 'shots', house));
    } catch (e) { notes.push('截圖失敗：' + (e && e.message)); }
    secs.visual += sec(now() - t);
  }
  // 基準・白名單
  const base = R.loadBaseline(QA, house), glob = R.loadBaseline(QA, '_global');
  base.whitelist = (base.whitelist || []).concat(glob.whitelist || []);
  issues.forEach(i => { i.house = house; i.layer = R.layerOf(i); });
  const cls = R.classify(issues, base);
  const sevCount = list => ({ high: list.filter(i => i.sev === 'high').length, mid: list.filter(i => i.sev === 'mid').length, low: list.filter(i => i.sev === 'low').length });
  if (!base.exists && !o.update) notes.push('尚無基準檔（baseline/' + house + '.json）：所有問題都視為新增。用 --update-baseline 建立。');
  const shown = o.allIssues ? issues : cls.fresh;
  const minRank = R.SEV_ORDER[o.minSev] !== undefined ? R.SEV_ORDER[o.minSev] : 2;
  const fresh = shown.filter(i => R.SEV_ORDER[i.sev] <= minRank);
  const res = {
    house, rootLabel: path.relative(process.cwd(), o.root) || '.', checks: Array.from(want), secs: Object.assign(secs, { total: sec(now() - t0) }), notes,
    counts: { fresh: fresh.length, freshBy: sevCount(fresh), known: cls.known.length, wl: cls.wl.length, all: issues.length }, fresh, known: cls.known, whitelisted: cls.wl, all: issues,
  };
  fs.mkdirSync(path.join(o.out, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(o.out, 'reports', house + '.json'), JSON.stringify({ house, generated: new Date().toISOString(), root: o.root, checks: res.checks, secs: res.secs, counts: res.counts, notes, issues: fresh, knownCount: cls.known.length, whitelistedCount: cls.wl.length }, null, 1));
  fs.writeFileSync(path.join(o.out, 'reports', house + '.txt'), R.summaryText(res));
  if (o.update) { const f = R.writeBaseline(QA, house, issues, base); notes.push('已更新基準檔：' + path.relative(ROOT, f)); }
  return res;
}

function htmlReport(results, out) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const body = results.map(r => '<h2>' + esc(r.house) + '</h2><p>' + r.secs.total + ' 秒；新增 ' + r.counts.fresh + '（高 ' + r.counts.freshBy.high + '／中 ' + r.counts.freshBy.mid + '／低 ' + r.counts.freshBy.low + '）</p><pre>' + esc(R.summaryText(r)) + '</pre>').join('');
  const f = path.join(out, 'report.html');
  fs.writeFileSync(f, '<meta charset="utf-8"><title>QA report</title><style>body{font:14px system-ui;margin:24px}pre{background:#f6f4ee;padding:12px;overflow:auto}</style><h1>Ctype QA 報告</h1><pre>' + esc(R.table(results)) + '</pre>' + body);
  return f;
}

(async () => {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.houses.length) {
    console.log('用法：node tools/qa/run.js <house|all> [--checks a,b,c] [--update-baseline] [--screenshots] [--open-report]\n  house: ' + HOUSES.join(' ') + ' | all\n  --checks: ' + Object.keys(GROUPS).join(',') + ',wall-pen,mount,float,overlap,door,reach,opening,level,continuity\n  --root <dir> 另一份房子資料夾（例如 git worktree）  --out <dir> 報告輸出  --all-issues 連基準內已知問題也列出  --min-sev high|mid|low');
    process.exit(o.help ? 0 : 1);
  }
  const houses = o.houses.includes('all') ? HOUSES : o.houses;
  fs.mkdirSync(o.out, { recursive: true });
  const shared = {}, results = [];
  for (const h of houses) {
    try { const r = await runHouse(h, o, shared); results.push(r); console.log('\n' + R.summaryText(r).split('\n').slice(0, o.quiet ? 3 : 200).join('\n')); }
    catch (e) { console.error('[' + h + '] 失敗：' + (e && e.stack || e)); }
  }
  if (results.length) {
    const tb = R.table(results); console.log('\n=== 總表（新增的問題數）===\n' + tb);
    fs.writeFileSync(path.join(o.out, 'summary.txt'), tb + '\n\n' + results.map(r => R.summaryText(r)).join('\n\n'));
    const html = htmlReport(results, o.out); console.log('\n報告：' + o.out + '（summary.txt / report.html / reports/<house>.json）');
    if (o.open) { try { cp.spawnSync('open', [html]); } catch (_) {} }
  }
  if (shared.browser) await shared.browser.close(); if (shared.server) await shared.server.close();
  process.exit(0);
})();
