// 横版宣传视频素材（三条 16:9 视频共用）。逐帧录制：接管页面时钟，每次推进 1/30 秒再截一帧，录出来是匀速 30 帧，不受机器快慢影响。
// 用法：node tools/video/record.mjs → dist/video2/frames/*.jpg + dist/video2/segments.json
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
const OUT = 'dist/video2/frames';
fs.rmSync('dist/video2', { recursive: true, force: true });
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
  // 有 each 的是战斗画面：推进后再清一次，避免这一帧里刚弹出的升级 / 宝箱窗口被录进去
  for (let i = 0; i < frames; i++) {
    if (each) await each(i);
    await step2();
    // 这一帧里弹出了窗口：关掉再画一帧，保证录进去的是干净的战斗画面
    if (each) for (let k = 0; k < 4 && (await page.evaluate(() => window.__game.dialogs.length > 0)); k++) { await clear(); await step(1); }
    await grab();
  }
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
const keys = ['d', 's', 'a', 'w'];
let held = null;
const release = async () => { if (held) { await page.keyboard.up(held); held = null; } };
const steer = async (i, period = 24) => {
  await clear();
  const k = keys[Math.floor(i / period) % 4];
  if (k !== held) { if (held) await page.keyboard.up(held); await page.keyboard.down(k); held = k; }
};
await crowd(150);
// 1 满屏割草
await record('combat', 200, async (i) => { await steer(i); if (i === 90) await crowd(120); });
// 2 大招
await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; });
await crowd(140);
await record('ult', 170, async (i) => { await steer(i + 200); if (i === 12) await page.evaluate(() => window.__game.scene.tryUlt()); });
await release();
// 3 升级三选一 → 拿到天雷，连锁闪电
await page.evaluate(() => {
  const s = window.__game.scene; window.__game.dialogs.length = 0;
  s.openLevelUpForTest([{ kind: 'weapon', id: 'spear', lv: 5, isNew: false }, { kind: 'weapon', id: 'thunder', lv: 1, isNew: true }, { kind: 'passive', id: 'book', lv: 1, isNew: true }]);
});
await record('levelup', 70);
await page.evaluate(() => { const b = window.__game.scene.battle; window.__game.dialogs.length = 0; b.addWeapon('thunder'); b.weapon('thunder').lv = 5; b.recalc(); });
await crowd(160);
await record('thunder', 110, (i) => steer(i, 28));
await release();
// 4 宝箱进化
await page.evaluate(() => {
  const b = window.__game.scene.battle; window.__game.dialogs.length = 0;
  if (!b.weapon('spear')) b.addWeapon('spear');
  b.weapon('spear').lv = 5; b.recalc();
  b.pendingChests.push({ boss: true });
});
let chest = false;
for (let i = 0; i < 60 && !chest; i++) { await step2(); chest = await page.evaluate(() => window.__game.dialogs.some((d) => d.constructor.name === 'ChestDialog')); }
await record('chest', 110);
await clear();
await crowd(170);
await record('evo', 120, (i) => steer(i, 30));
await release();
// 5 锦囊：点「万箭齐发」→ 全屏箭雨
await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openStrategyForTest(2, 2); const d = g.dialogs[g.dialogs.length - 1]; d.choices = ['wanjian', 'qixing', 'bazhen']; });
await record('strat', 45);
await page.mouse.click(202, 232);
await record('strat_pick', 10);
await clear();
await crowd(180);
await page.evaluate(() => { const b = window.__game.scene.battle; b.stratT.wanjian = 0.5; });
await record('wanjian', 140, (i) => steer(i, 35));
await release();
// 6 火烧连营 + 八阵图
await page.evaluate(() => { const b = window.__game.scene.battle; ['huoshao', 'bazhen'].forEach((id) => b.applyStrat(id)); b.stratT.huoshao = 0.3; });
await crowd(180);
await record('huoshao', 150, (i) => steer(i, 38));
await release();
// 7 首领
await page.evaluate(() => { const b = window.__game.scene.battle; b.t = 280; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 270); });
let intro = false;
for (let i = 0; i < 600 && !intro; i++) {
  await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; g.dialogs = g.dialogs.filter((d) => d.constructor.name === 'BossIntroDialog'); });
  await step2();
  intro = await page.evaluate(() => window.__game.dialogs.some((d) => d.constructor.name === 'BossIntroDialog'));
}
await record('boss_intro', 60);
await clear();
await record('boss_fight', 130, () => clear());
fs.writeFileSync('dist/video2/segments.json', JSON.stringify({ fps: FPS, segments }, null, 1));
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no errors', 'frames', n);
await browser.close();
server.close();
