// 逐帧录制宣传视频素材：接管页面时钟，每次推进 1/30 秒再截一帧，录出来是匀速 30 帧，不受机器快慢影响。
// 用法：node tools/video/record.mjs → dist/video/frames/*.jpg + dist/video/segments.json
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve('dist/web');
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript' }[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const OUT = 'dist/video/frames';
fs.rmSync('dist/video', { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  let t = 1000; let cbs = [];
  performance.now = () => t;
  window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
  window.__step = (ms) => { t += ms; const list = cbs; cbs = []; list.forEach((cb) => cb(t)); };
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/index.html?skip=1`);
const FPS = 30;
let n = 0;
const segments = [];
const step2 = () => page.evaluate((ms) => { window.__step(ms); window.__step(ms); }, 1000 / 60);
const step = (k = 1) => page.evaluate(([k, ms]) => { for (let i = 0; i < k; i++) window.__step(ms); }, [k, 1000 / FPS]);
const clear = () => page.evaluate(() => { const g = window.__game; const b = g.scene && g.scene.battle; g.dialogs.length = 0; if (b) { b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; } });
async function grab() {
  const data = await page.evaluate(() => window.__game.ctx.canvas.toDataURL('image/jpeg', 0.92));
  fs.writeFileSync(`${OUT}/${String(n++).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
}
async function record(name, frames, each) {
  const start = n;
  for (let i = 0; i < frames; i++) { if (each) await each(i); await step2(); await grab(); }
  segments.push({ name, start, end: n });
  console.log(name, start, n);
}
// 等加载完到主界面
for (let i = 0; i < 400; i++) { await step(); if (await page.evaluate(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene')) break; }
await page.evaluate(() => {
  window.__game.dialogs.length = 0;
  const sv = window.__saveMod.save;
  for (const k of ['boss_warn', 'breakable', 'elite', 'evo', 'lowpower', 'pk_bomb', 'pk_bun', 'pk_magnet', 'strat', 'banish']) sv.tips[k] = true;
});
await step(20);
await record('home', 75);
// 出征
await page.evaluate(() => window.__game.scene.startBattle(1));
await step(45);
await page.evaluate(() => {
  const b = window.__game.scene.battle;
  b.base.atk = 45; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999;
  ['sword', 'horse', 'fire', 'crossbow'].forEach((id) => b.addWeapon(id));
  b.weapons.forEach((w) => (w.lv = 5));
  ['tiger', 'flag', 'horseshoe'].forEach((id) => b.passives.push({ id, lv: 3 }));
  b.recalc();
  b.t = 230; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 220);
});
await clear();
const crowd = (cnt) => page.evaluate((cnt) => {
  const b = window.__game.scene.battle; const p = b.player;
  const ids = ['wei_spear', 'wei_spear', 'wei_spear', 'wei_shield', 'wei_cavalry', 'wei_heavy', 'wei_archer'];
  for (let i = 0; i < cnt; i++) { const a = Math.random() * Math.PI * 2; const d = 60 + Math.random() * 110; b.spawnEnemy(ids[i % ids.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 1.6, { hpMul: 5 }); }
}, cnt);
await crowd(150);
const keys = ['d', 's', 'a', 'w'];
let held = null;
const steer = async (i, period = 24) => {
  await clear();
  const k = keys[Math.floor(i / period) % 4];
  if (k !== held) { if (held) await page.keyboard.up(held); await page.keyboard.down(k); held = k; }
};
await record('combat', 200, async (i) => { await steer(i); if (i === 90) await crowd(120); });
// 大招
await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; });
await crowd(100);
await step(10);
await page.evaluate(() => window.__game.scene.tryUlt());
await record('ult', 100, (i) => steer(i + 200));
if (held) { await page.keyboard.up(held); held = null; }
// 升级三选一
await page.evaluate(() => {
  const s = window.__game.scene; window.__game.dialogs.length = 0;
  s.openLevelUpForTest([{ kind: 'weapon', id: 'spear', lv: 5, isNew: false }, { kind: 'weapon', id: 'thunder', lv: 1, isNew: true }, { kind: 'passive', id: 'book', lv: 1, isNew: true }]);
});
await record('levelup', 75);
// 锦囊
await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openStrategyForTest(2, 2); });
await record('strat', 85);
await clear();
// 首领
await page.evaluate(() => { const b = window.__game.scene.battle; b.t = 280; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 270); });
let intro = false;
for (let i = 0; i < 600 && !intro; i++) {
  await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; g.dialogs = g.dialogs.filter((d) => d.constructor.name === 'BossIntroDialog'); });
  await step2();
  intro = await page.evaluate(() => { const g = window.__game; return g.dialogs.some((d) => d.constructor.name === 'BossIntroDialog'); });
}
if (held) { await page.keyboard.up(held); held = null; }
await record('boss_intro', 60);
await clear();
await record('boss_fight', 120, () => clear());
if (held) await page.keyboard.up(held);
fs.writeFileSync('dist/video/segments.json', JSON.stringify({ fps: FPS, segments }, null, 1));
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no errors', 'frames', n);
await browser.close();
server.close();
