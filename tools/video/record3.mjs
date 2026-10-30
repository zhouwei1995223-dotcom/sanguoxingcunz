// 抖音竖版 30 秒视频素材（9:16）：主界面 → 武将 → 开局奇遇 → 割草 → 大招 → 敌将技能 / 护盾 → 新武将大招。
// 逐帧录制（接管页面时钟，每帧推进 1/30 秒），和 record2.mjs 同一套做法。
// 用法：npm run build && node tools/video/record3.mjs → dist/video3/frames/*.jpg + dist/video3/segments.json
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
const OUT = 'dist/video3/frames';
fs.rmSync('dist/video3', { recursive: true, force: true });
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
await page.goto(`http://localhost:${server.address().port}/index.html?skip=1&heroes=1&ch=6`);
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
async function record(name, frames, each, keepDialogs = false) {
  const start = n;
  for (let i = 0; i < frames; i++) {
    if (each) await each(i);
    await step2();
    if (!keepDialogs) for (let k = 0; k < 4 && (await page.evaluate(() => window.__game.dialogs.length > 0)); k++) { await clear(); await step(1); }
    await grab();
  }
  segments.push({ name, start, end: n });
  console.log(name, start, n);
}
const keys = ['d', 's', 'a', 'w'];
let held = null;
const release = async () => { if (held) { await page.keyboard.up(held); held = null; } };
const steer = async (i, period = 24) => {
  const k = keys[Math.floor(i / period) % 4];
  if (k !== held) { if (held) await page.keyboard.up(held); await page.keyboard.down(k); held = k; }
};
const crowd = (cnt, hpMul = 5) => page.evaluate(([cnt, hpMul]) => {
  const b = window.__game.scene.battle; const p = b.player;
  const ids = ['wei_spear', 'wei_spear', 'wei_spear', 'wei_shield', 'wei_cavalry', 'wei_heavy', 'wei_archer'];
  for (let i = 0; i < cnt; i++) { const a = Math.random() * Math.PI * 2; const d = 60 + Math.random() * 110; b.spawnEnemy(ids[i % ids.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 1.6, { hpMul }); }
}, [cnt, hpMul]);
// 进战斗并强化（录像用：满级武器、不会死）
async function enterBattle(hero, weapons) {
  await page.evaluate((h) => {
    const g = window.__game; const sv = window.__saveMod.save;
    sv.hero = h; g.dialogs.length = 0;
    for (const k of ['boss_warn', 'breakable', 'elite', 'evo', 'lowpower', 'pk_bomb', 'pk_bun', 'pk_magnet', 'strat', 'banish', 'qiyu', 'rush', 'speed']) sv.tips[k] = true;
    g.scene.startBattle(1);
  }, hero);
  await step(10);
  await page.evaluate((ws) => {
    const b = window.__game.scene.battle;
    b.base.atk = 45; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999;
    ws.forEach((id) => { if (!b.weapon(id)) b.addWeapon(id); });
    b.weapons.forEach((w) => (w.lv = 5));
    ['tiger', 'flag', 'horseshoe'].forEach((id) => b.passives.push({ id, lv: 3 }));
    b.recalc();
    b.t = 230; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 220);
  }, weapons);
}
async function toHome() {
  await page.reload();
  for (let i = 0; i < 400; i++) { await step(); if (await page.evaluate(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene')) break; }
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
}
await toHome();
await step(20);
// 1 主界面
await record('home', 60, null, true);
// 2 武将页：十位武将轮流看
await page.evaluate(() => { window.__game.scene.tab = 'hero'; });
const showHeroes = ['huangzhong', 'machao', 'sunshangxiang', 'dianwei', 'jiangwei'];
await record('heroes', 75, (i) => page.evaluate((h) => { window.__game.scene.viewHero = h; }, showHeroes[Math.floor(i / 15) % 5]), true);
// 3 出征 → 开局奇遇（点第二张）
await page.evaluate(() => {
  const g = window.__game; g.scene.tab = 'battle'; const sv = window.__saveMod.save; sv.hero = 'zhaoyun';
  for (const k of ['boss_warn', 'breakable', 'elite', 'evo', 'lowpower', 'pk_bomb', 'pk_bun', 'pk_magnet', 'strat', 'banish', 'qiyu', 'rush']) sv.tips[k] = true;
  g.scene.startBattle(1);
});
await record('qiyu', 40, null, true);
await page.mouse.click(202, 350);
await record('qiyu_pick', 8, null, true);
await clear();
await page.evaluate(() => {
  const b = window.__game.scene.battle;
  b.base.atk = 45; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999;
  ['sword', 'horse', 'fire', 'crossbow'].forEach((id) => b.addWeapon(id));
  b.weapons.forEach((w) => (w.lv = 5));
  ['tiger', 'flag', 'horseshoe'].forEach((id) => b.passives.push({ id, lv: 3 }));
  b.recalc();
  b.t = 230; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 220);
});
// 4 满屏割草
await crowd(160);
await record('combat', 150, async (i) => { await steer(i); if (i === 70) await crowd(120); });
// 5 大招
await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; });
await crowd(140);
await record('ult', 110, async (i) => { await steer(i + 150); if (i === 8) await page.evaluate(() => window.__game.scene.tryUlt()); });
await release();
// 6 敌将：登场 → 十字刀气 → 箭雨 → 举盾
await page.evaluate(() => {
  const b = window.__game.scene.battle;
  for (const e of b.enemies) e.dead = true;
  window.__boss = b.spawnBoss('wenchou', b.player.x + 80, b.player.y - 30, true);
  window.__boss.maxHp = window.__boss.hp = 1e9;
});
await record('boss_intro', 40, null, true);
await clear();
const cast = (s) => page.evaluate((s) => { const e = window.__boss; e.bskills = [s]; e.skillIdx = 0; e.state = 'move'; e.stateT = 0; }, s);
await cast('cross');
await record('boss_cross', 50, (i) => steer(i, 50));
await cast('rain');
await record('boss_rain', 45, (i) => steer(i + 50, 50));
await page.evaluate(() => { const e = window.__boss; e.bskills = ['charge']; e.maxHp = 1e6; e.hp = 5.5e5; e.state = 'rest'; e.stateT = 2; });
await record('boss_shield', 50, (i) => steer(i + 100, 50));
await release();
// 7 新武将大招
for (const [hero, w] of [['machao', 'lance'], ['sunshangxiang', 'chakram'], ['huangzhong', 'bow']]) {
  await toHome();
  await enterBattle(hero, ['sword', 'fire']);
  await clear();
  // 去掉开局的章节横幅
  await page.evaluate(() => { window.__game.scene.banners.length = 0; });
  await crowd(170, 3);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; });
  await record('ult_' + hero, 62, async (i) => { await steer(i, 31); if (i === 4) await page.evaluate(() => window.__game.scene.tryUlt()); });
  await release();
  void w;
}
fs.writeFileSync('dist/video3/segments.json', JSON.stringify({ fps: FPS, segments }, null, 1));
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no errors', 'frames', n);
await browser.close();
server.close();
