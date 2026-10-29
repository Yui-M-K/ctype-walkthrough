'use strict';
// 報告・基準檔（baseline）・白名單
const fs = require('fs'), path = require('path');
const SEV_ORDER = { high: 0, mid: 1, low: 2 };
const SEV_LABEL = { high: '高', mid: '中', low: '低' };
const CHECK_LABEL = {
  'wall-pen': 'a 穿牆', mount: 'a 貼牆範圍', float: 'b 浮空', overlap: 'c 重疊', 'door-sweep': 'd 門活動範圍', 'door-gap': 'd 門縫', reach: 'e 可達性',
  opening: 'f 窗與開口', level: 'g 天花／樓梯', continuity: 'h 組件連續性', interact: '互動', visual: '視覺',
};
const LAYER_OF = { interact: 'scene', visual: 'visual' };
function layerOf(i) { if (i.layer) return i.layer; if (i.via === 'interact' || i.check === 'interact') return 'scene'; if (i.check === 'visual') return 'visual'; return 'data'; }

function dist(a, b) { if (!a || !b) return 9; return Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.5, a[2] - b[2]); }
function baselinePath(root, house) { return path.join(root, 'tools', 'qa', 'baseline', house + '.json'); }
function loadBaseline(qaDir, house) {
  const f = path.join(qaDir, 'baseline', house + '.json');
  if (!fs.existsSync(f)) return { known: [], whitelist: [], file: f, exists: false };
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.file = f; j.exists = true; j.known = j.known || []; j.whitelist = j.whitelist || []; return j;
}
function same(a, b) { return a.check === b.check && String(a.obj) === String(b.obj) && (a.state || '') === (b.state || '') && dist(a.pos, b.pos) <= 0.25; }
function wlMatch(w, i) {
  if (w.check && w.check !== i.check) return false;
  const text = i.obj + ' ' + (i.part || '') + ' ' + i.desc;
  if (w.match && !(new RegExp(w.match).test(text))) return false;
  if (w.room && !(new RegExp(w.room).test(i.room || ''))) return false;
  return true;
}
// 戻り値: {fresh, known, whitelisted}
function classify(issues, baseline) {
  const fresh = [], known = [], wl = [];
  issues.forEach(i => {
    if ((baseline.whitelist || []).some(w => wlMatch(w, i))) { wl.push(i); return; }
    if ((baseline.known || []).some(k => same(k, i))) { known.push(i); return; }
    fresh.push(i);
  });
  return { fresh, known, wl };
}
function writeBaseline(qaDir, house, issues, prev) {
  const f = path.join(qaDir, 'baseline', house + '.json'); fs.mkdirSync(path.dirname(f), { recursive: true });
  const known = issues.filter(i => !(prev.whitelist || []).some(w => wlMatch(w, i))).map(i => ({ check: i.check, sev: i.sev, obj: i.obj, state: i.state || '', pos: i.pos, room: i.room, desc: i.desc.slice(0, 200), note: ((prev.known || []).find(k => same(k, i)) || {}).note || '' }));
  const out = {
    _readme: 'tools/qa が回帰検出のために保存した「既知の問題」。known=現時点で出ている問題（--update-baseline で上書き）、whitelist=人手で確認した誤報（上書きされない。{check, match(正規表現), room(正規表現,任意), note}）。note には判断理由を書く。',
    house, updated: new Date().toISOString().slice(0, 10), known, whitelist: prev.whitelist || [],
  };
  fs.writeFileSync(f, JSON.stringify(out, null, 1)); return f;
}

function summaryText(res) {
  const L = [];
  L.push('=== ' + res.house + ' ===  (' + (res.rootLabel || '') + ')  耗時 ' + res.secs.total + ' 秒（載入 ' + res.secs.load + '、資料層 ' + res.secs.data + '、場景層 ' + res.secs.scene + '、視覺 ' + res.secs.visual + '）');
  const c = res.counts; L.push('問題數：新增 ' + c.fresh + '（高 ' + c.freshBy.high + ' / 中 ' + c.freshBy.mid + ' / 低 ' + c.freshBy.low + '），基準內已知 ' + c.known + '，白名單 ' + c.wl);
  if (res.notes && res.notes.length) res.notes.forEach(n => L.push('註：' + n));
  const by = {}; res.fresh.forEach(i => { (by[i.check] = by[i.check] || []).push(i); });
  Object.keys(by).sort().forEach(k => {
    L.push(''); L.push('■ ' + (CHECK_LABEL[k] || k) + '（' + by[k].length + '）');
    by[k].sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]).forEach((i, n) => {
      L.push('  [' + SEV_LABEL[i.sev] + '][' + layerOf(i) + '] ' + i.obj + (i.state ? ' ／狀態:' + i.state : ''));
      L.push('      房間：' + (i.room || '-') + '　座標：' + (i.pos ? i.pos.join(', ') : '-') + (i.shot ? '　截圖：' + i.shot : ''));
      L.push('      ' + i.desc);
      if (i.part) L.push('      零件：' + i.part);
      if (i.hint) L.push('      建議：' + i.hint);
    });
  });
  return L.join('\n');
}
function table(results) {
  const checks = Object.keys(CHECK_LABEL), head = ['房子'].concat(checks.map(k => CHECK_LABEL[k])).concat(['高', '中', '低', '資料/場景/視覺', '秒']);
  const rows = results.map(r => {
    const cnt = {}; r.fresh.forEach(i => { cnt[i.check] = (cnt[i.check] || 0) + 1; });
    const lay = { data: 0, scene: 0, visual: 0 }; r.fresh.forEach(i => { lay[layerOf(i)]++; });
    return [r.house].concat(checks.map(k => cnt[k] || 0)).concat([r.counts.freshBy.high, r.counts.freshBy.mid, r.counts.freshBy.low, lay.data + '/' + lay.scene + '/' + lay.visual, r.secs.total]);
  });
  const w = head.map((h, i) => Math.max(String(h).length * 1.6, ...rows.map(r => String(r[i]).length)) | 0);
  const fmt = r => r.map((v, i) => String(v).padEnd(Math.max(w[i], String(v).length))).join(' | ');
  return [fmt(head), w.map(n => '-'.repeat(n)).join('-+-')].concat(rows.map(fmt)).join('\n');
}
module.exports = { SEV_ORDER, SEV_LABEL, CHECK_LABEL, layerOf, loadBaseline, classify, writeBaseline, summaryText, table };
