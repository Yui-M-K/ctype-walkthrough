'use strict';
// 資料層：不開瀏覽器，用「萬用吸收器」取代 THREE/DOM 後在 Node 的 vm 內跑 lib/*.js 與房子頁面的 module script，
// 只攔截引擎在建構時算出的數值資料（牆/門/家具碰撞矩形/房間/傳送點）。幾何不會被真正建出來。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..', '..');

let hits = 0; const LIMIT = 6e7;
function absorber(name) {
  const cache = new Map();
  const target = class {};
  const handler = {
    get(_, k) {
      if (++hits > LIMIT) { hits = 0; throw new Error('absorber loop guard: ' + name + '.' + String(k)); }
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;
      if (typeof k === 'symbol') return undefined;
      if (!cache.has(k) && (k === 'children' || k === 'groups' || k === 'materials' || k === 'animations')) cache.set(k, []);
      if (!cache.has(k)) cache.set(k, absorber(name + '.' + String(k)));
      return cache.get(k);
    },
    set(_, k, v) { cache.set(k, v); return true; },
    has() { return false; },
    ownKeys() { return ['prototype']; },
    apply() { return absorber(name + '()'); },
    construct() { return absorber('new ' + name); },
  };
  return new Proxy(target, handler);
}


const https = require('https'), os = require('os'), { pathToFileURL } = require('url');
const CACHE = process.env.QA_CACHE || path.join(os.tmpdir(), 'ctype-qa-cache');
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/';
function download(url, dest) {
  return new Promise((resolve, reject) => https.get(url, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return download(r.headers.location, dest).then(resolve, reject);
    if (r.statusCode !== 200) return reject(new Error('HTTP ' + r.statusCode + ' ' + url));
    const f = fs.createWriteStream(dest); r.pipe(f); f.on('finish', () => f.close(resolve));
  }).on('error', reject));
}
let threeP = null;
// three.js を初回のみ CDN（頁面と同じ版）から取得してキャッシュし、Node で実物を使う。WebGLRenderer だけ吸収器に差し替える。
function realThree() {
  if (threeP) return threeP;
  threeP = (async () => {
    fs.mkdirSync(CACHE, { recursive: true });
    for (const f of ['three.module.js', 'three.core.js']) { const d = path.join(CACHE, f); if (!fs.existsSync(d) || fs.statSync(d).size < 1e5) await download(THREE_URL + f, d); }
    const ns = await import(pathToFileURL(path.join(CACHE, 'three.module.js')).href);
    const T = Object.assign({}, ns); T.WebGLRenderer = function () { return absorber('renderer'); };
    T.TextureLoader = class { load() { return new ns.Texture(); } setCrossOrigin() { return this; } setPath() { return this; } };
    if (!globalThis.document) globalThis.document = absorber('document');
    return T;
  })();
  return threeP;
}

// 除錯物件 __walk に E（エンジン内部）と wallOpens を足す。ブラウザ側も同じ置換を route で当てる。
function patchEngine(code, name) {
  if (/perf\.js$/.test(name)) return code.replace('Perf.mergeStatic=function(THREE,mergeGeometries,roots,keep,onSwap){', 'Perf.mergeStatic=function(THREE,mergeGeometries,roots,keep,onSwap){ return {before:0,after:0};');
  if (/catalog\.js$/.test(name)) return code.replace('this.anims=[]; Walk.PIECES.set(this.group,this); }', "this.anims=[]; Walk.PIECES.set(this.group,this); try{ this.qaSrc=String(new Error().stack).split('\\n').slice(2,10).join('|'); }catch(_){} }");
  if (!/storeys\.js$/.test(name)) return code;
  return code.replace('window.__walk={WX:WX,', 'window.__walk={E:E,wallOpens:wallOpens,WX:WX,');
}

function readScripts(html) {
  const out = []; const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) {
    const attrs = m[1], src = (attrs.match(/\bsrc="([^"?]+)/) || [])[1];
    out.push({ src, module: /type="module"/.test(attrs), importmap: /importmap/.test(attrs), body: m[2] });
  }
  return out;
}

// 回傳 {E, H, Walk, errors}。E はエンジンの公開インターフェース（allCols/doors 等は getter）
async function load(house, opts) {
  opts = opts || {};
  const file = path.join(opts.root || ROOT, house + '.html');
  const html = fs.readFileSync(file, 'utf8');
  const scripts = readScripts(html);
  const errors = [];
  const sandbox = { console: { log() {}, warn() {}, error(e) { errors.push('console.error: ' + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(' / ') : e)); }, info() {} } };
  const docStub = absorber('document'); sandbox.document = docStub;
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  sandbox.location = { hash: '#debug', search: '', href: 'http://localhost/' + house + '.html', origin: 'http://localhost', pathname: '/' + house + '.html' };
  sandbox.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} }; sandbox.sessionStorage = sandbox.localStorage;
  sandbox.navigator = { userAgent: 'node', hardwareConcurrency: 4, maxTouchPoints: 0 };
  // 仮想時計：setTimeout/setInterval は advance(ms) で進める（ctx.advance から呼ばれる）
  const timers = { now: 0, q: [], id: 1 };
  sandbox.performance = { now: () => timers.now };
  sandbox.__qaTimers = { advance(ms) {
    const end = timers.now + ms;
    for (;;) { timers.q.sort((a, b) => a.at - b.at); const t = timers.q[0]; if (!t || t.at > end) break; timers.q.shift(); timers.now = Math.max(timers.now, t.at); try { t.fn(); } catch (e) { errors.push('timer: ' + (e && e.message)); } if (t.every) { t.at += t.every; timers.q.push(t); } }
    timers.now = end; } };
  sandbox.requestAnimationFrame = () => 0; sandbox.cancelAnimationFrame = () => {};
  sandbox.setTimeout = (fn, ms) => { if (typeof fn !== 'function') return 0; const id = timers.id++; timers.q.push({ id, fn, at: timers.now + (ms || 0) }); return id; };
  sandbox.setInterval = (fn, ms) => { if (typeof fn !== 'function') return 0; const id = timers.id++; timers.q.push({ id, fn, at: timers.now + (ms || 1), every: Math.max(1, ms || 1) }); return id; };
  sandbox.clearTimeout = sandbox.clearInterval = id => { timers.q = timers.q.filter(t => t.id !== id); };
  sandbox.addEventListener = () => {}; sandbox.removeEventListener = () => {};
  sandbox.matchMedia = () => ({ matches: false, addEventListener() {} });
  sandbox.devicePixelRatio = 1; sandbox.innerWidth = 960; sandbox.innerHeight = 600; sandbox.parent = sandbox;
  sandbox.fetch = (u) => { const f = path.join(path.dirname(file), String(u).split('?')[0]); if (!fs.existsSync(f)) return new Promise(() => {}); const txt = fs.readFileSync(f, 'utf8'); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(txt)), text: () => Promise.resolve(txt) }); }; sandbox.Image = absorber('Image'); sandbox.URL = absorber('URL'); sandbox.URLSearchParams = URLSearchParams;
  sandbox.TextDecoder = TextDecoder; sandbox.TextEncoder = TextEncoder;
  const T = await realThree(); sandbox.THREE = T;
  for (const n of [ 'EffectComposer', 'RenderPass', 'GTAOPass', 'OutputPass', 'HDRLoader', 'mergeGeometries', 'KTX2Loader', 'UnrealBloomPass', 'ShaderPass', 'SMAAPass', 'GLTFLoader', 'DRACOLoader', 'MeshoptDecoder', 'SkeletonUtils', 'RoomEnvironment', 'mergeVertices', 'clone']) sandbox[n] = absorber(n);
  const ctx = vm.createContext(sandbox);
  const run = (code, name) => { try { vm.runInContext(code, ctx, { filename: name, timeout: 180000 }); } catch (e) { errors.push(name + ': ' + (e && e.message)); } };
  const pending = [];
  const runAsync = (code, name) => { try { return Promise.resolve(vm.runInContext(code, ctx, { filename: name, timeout: 180000 })).catch(e => { errors.push(name + ': ' + (e && e.message)); }); } catch (e) { errors.push(name + ': ' + (e && e.message)); return Promise.resolve(); } };
  let captured = { E: null, H: null };
  for (const s of scripts) {
    if (s.importmap) continue;
    if (s.src) {
      const f = path.join(path.dirname(file), s.src);
      if (!fs.existsSync(f)) continue;
      if (/a2-sunmap/.test(s.src)) continue;
      run(patchEngine(fs.readFileSync(f, 'utf8'), s.src), s.src);
      if (/storeys\.js$/.test(s.src) && sandbox.Walk && sandbox.Walk.Storeys) {
        const orig = sandbox.Walk.Storeys;
        sandbox.Walk.Storeys = function (T, H) {
          captured.H = H;
          for (const k of Object.keys(H)) if (typeof H[k] === 'function' && !captured['w' + k]) {
            const f0 = H[k]; captured['w' + k] = true;
            H[k] = function (E) { if (E && !captured.E) captured.E = E; return f0.apply(this, arguments); };
          }
          try { return orig.apply(this, arguments); } catch (e) { errors.push("Storeys: " + (e && e.stack || e).toString().split("\n").slice(0, 4).join(" | ")); }
        };
      }
      continue;
    }
    if (s.module) {
      // 局部 ES module（a2-*.js）は「export を外して即時関数で包み、名前空間オブジェクトとして定義」して読み込む
      let body = s.body.replace(/^\s*import\s+\*\s+as\s+(\w+)\s+from\s+'\.\/([^'?]+)[^']*';?\s*$/gm, (_, ns, f) => {
        const mf = path.join(path.dirname(file), f); if (!fs.existsSync(mf)) return '';
        let code = fs.readFileSync(mf, 'utf8'); const names = [];
        code = code.replace(/^export\s+(async\s+function|function|const|let|class)\s+(\w+)/gm, (m, kw, n) => { names.push(n); return kw + ' ' + n; });
        return 'const ' + ns + '=(function(){' + code + '\nreturn {' + names.join(',') + '};})();';
      });
      body = body.replace(/^\s*import\s[^;]*;?\s*$/gm, '');
      // 動的 import（a2 の補助モジュール）は読み込めないので解決を試みる
      pending.push(runAsync('(async function(){' + body + '\n})()', house + '.html(module)'));
    } else if (!/__walkStarted/.test(s.body)) run(s.body, house + '.html(inline)');
  }
  await Promise.all(pending);
  return { E: captured.E, H: captured.H, Walk: sandbox.Walk, errors, sandbox };
}
module.exports = { patchEngine, load, absorber, realThree, ROOT };
