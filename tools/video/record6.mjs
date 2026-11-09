// 竖版推广视频（2026-11-09 第二版）：1080×1920 实机画面，带真实战斗界面（血条、等级、计时、大招按钮等）和真实的滑动摇杆操作。
// 移动全部用鼠标按住拖动（游戏把鼠标当作手指，画出摇杆）；升级 / 宝箱 / 锦囊弹窗仍每帧清掉，画面只留战斗。基于 record5。
// 逐帧录制（每帧推进 1/30 秒）。
// 用法：npm run build && node tools/video/record5.mjs → dist/video6/frames/*.jpg + segments.json；再 python3 tools/video/compose6.py <字体>
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
const OUT = 'dist/video6/frames';
fs.rmSync('dist/video6', { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await page.addInitScript(() => {
  let t = 1000; let cbs = [];
  performance.now = () => t;
  window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
  window.__step = (ms) => { t += ms; const list = cbs; cbs = []; list.forEach((cb) => cb(t)); };
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const URL = `http://localhost:${server.address().port}/index.html?skip=1&heroes=1&ch=6`;
const FPS = 30;
let n = 0;
const segments = [];
const step = (k = 1) => page.evaluate(([k, ms]) => { for (let i = 0; i < k; i++) window.__step(ms); }, [k, 1000 / FPS]);
const step2 = () => page.evaluate((ms) => { window.__step(ms); window.__step(ms); }, 1000 / 60);
const clear = () => page.evaluate(() => { const g = window.__game; const b = g.scene && g.scene.battle; g.dialogs.length = 0; if (b) { b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; } });
async function grab() {
  const data = await page.evaluate(() => window.__game.ctx.canvas.toDataURL('image/jpeg', 0.92));
  fs.writeFileSync(`${OUT}/${String(n++).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
}
// 每帧都清掉弹窗（升级 / 宝箱 / 锦囊 / 敌将登场），录进去的只有战斗画面
async function record(name, frames, each) {
  const start = n;
  for (let i = 0; i < frames; i++) {
    if (each) await each(i);
    await step2();
    for (let k = 0; k < 4 && (await page.evaluate(() => window.__game.dialogs.length > 0)); k++) { await clear(); await step(1); }
    await grab();
  }
  segments.push({ name, start, end: n });
  console.log(name, start, n);
}
// —— 滑动摇杆：鼠标在屏幕下半部按住拖动，方向平滑变化，像真人拇指在推摇杆 ——
const JOY = { x: 270, y: 760 };   // CSS 坐标，屏幕下方中间偏下（拇指常放的位置）
let joyDown = false;
let mode = 'circle';
const R = 42;
function joyDir(i) {
  if (mode === 'dodge') {
    // 敌将战：左右来回小步躲闪，每 20 帧换向，换向时方向平滑过渡
    const ph = Math.floor(i / 20) % 2, f = (i % 20) / 20;
    const a = ph ? Math.PI : 0, b = ph ? 0 : Math.PI;
    const k = Math.min(1, f * 4);
    return [(1 - k) * Math.cos(b) + k * Math.cos(a), 0.25 * Math.sin(i / 13)];
  }
  // 割草：绕着敌群兜圈，方向慢慢转，偶尔带点抖动
  const th = i / 55 + 0.35 * Math.sin(i / 17);
  return [Math.cos(th), Math.sin(th)];
}
const steer = async (i) => {
  // 保证每帧都有血、不至于阵亡，血条在 55%~100% 之间真实波动
  await page.evaluate(() => { const p = window.__game.scene.battle.player; if (p.hp < p.maxHp * 0.55) p.hp = p.maxHp * (0.8 + Math.random() * 0.15); });
  const [dx, dy] = joyDir(i);
  const l = Math.hypot(dx, dy) || 1;
  // 弹窗开着时按下会被游戏忽略：先清弹窗；摇杆没按上（joyId 为空）就松开重按
  if (joyDown && (await page.evaluate(() => window.__game.scene.joyId === null))) { await page.mouse.up(); joyDown = false; }
  if (!joyDown) { await clear(); await page.mouse.move(JOY.x, JOY.y); await page.mouse.down(); joyDown = true; }
  await page.mouse.move(JOY.x + dx / l * R, JOY.y + dy / l * R);
};
const release = async () => { if (joyDown) { await page.mouse.up(); joyDown = false; } };
// 敌人铺在画面周围的椭圆里
const crowd = (cnt, hpMul = 5) => page.evaluate(([cnt, hpMul]) => {
  const b = window.__game.scene.battle; const p = b.player;
  const ids = ['wei_spear', 'wei_spear', 'wei_spear', 'wei_shield', 'wei_cavalry', 'wei_heavy', 'wei_archer'];
  for (let i = 0; i < cnt; i++) { const a = Math.random() * Math.PI * 2; const d = 0.35 + Math.random() * 0.65; b.spawnEnemy(ids[i % ids.length], p.x + Math.cos(a) * d * b.viewW * 0.55, p.y + Math.sin(a) * d * b.viewH * 0.55, { hpMul }); }
}, [cnt, hpMul]);
async function enterBattle(hero, weapons) {
  await page.goto(URL);
  for (let i = 0; i < 400; i++) { await step(); if (await page.evaluate(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene')) break; }
  await page.evaluate((h) => {
    const g = window.__game; const sv = window.__saveMod.save;
    sv.hero = h; g.dialogs.length = 0;
    for (const hs of Object.values(sv.heroes)) { hs.owned = true; hs.star = 5; hs.awaken = true; }
    for (const k of ['boss_warn', 'breakable', 'elite', 'evo', 'lowpower', 'pk_bomb', 'pk_bun', 'pk_magnet', 'strat', 'banish', 'qiyu', 'rush']) sv.tips[k] = true;
    g.scene.startBattle(1);
  }, hero);
  await step(10);
  await clear();
  await page.evaluate((ws) => {
    const g = window.__game; const b = g.scene.battle;
    g.scene.banners.length = 0;
    b.showDamage = true;
    b.level = 24; b.kills = 1260;
    // 不要运粮车事件：它的飘字（「粮车已截获 · 通关可领」）算界面文字
    b.convoyTimes = []; b.convoy = null;
    b.base.atk = 45; b.player.maxHp = b.player.hp = 2860; b.base.hp = 2860;
    ws.forEach((id) => { if (!b.weapon(id)) b.addWeapon(id); });
    b.weapons.forEach((w) => (w.lv = 5));
    ['tiger', 'flag', 'horseshoe'].forEach((id) => b.passives.push({ id, lv: 3 }));
    b.recalc();
    b.t = 130; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 125);
  }, weapons);
}
// 大招：先让怒气满（界面上大招按钮亮起），再按下
const ult = () => page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; window.__game.scene.pressUlt(); });
const fullRage = () => page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; });

// ① 一骑当千（赵云）：满屏割草 → 大招清屏 → 再割 → 再放大招
await enterBattle('zhaoyun', ['sword', 'horse', 'fire', 'crossbow']);
await crowd(260);
await record('v1_crowd', 270, async (i) => { await steer(i); if (i === 90 || i === 180) await crowd(160); });
await crowd(200);
await record('v1_ult', 150, async (i) => { await steer(i + 270); if (i === 0) await fullRage(); if (i === 25) await ult(); });
await crowd(240);
await record('v1_crowd2', 150, async (i) => { await steer(i + 420); if (i === 70) await crowd(140); });
await crowd(200);
await record('v1_ult2', 150, async (i) => { await steer(i + 570); if (i === 0) await fullRage(); if (i === 25) await ult(); });
await release();

// ② 名将大招：关羽 / 吕布 / 孙尚香 / 诸葛亮
for (const [hero, ws] of [['guanyu', ['sword', 'fire']], ['lvbu', ['knife', 'fire']], ['sunshangxiang', ['crossbow', 'fire']], ['zhuge', ['fire', 'crossbow']]]) {
  await enterBattle(hero, ws);
  await crowd(320, 4);
  await record('v2_' + hero, 180, async (i) => { await steer(i); if (i === 0) await fullRage(); if (i === 25) await ult(); if (i === 70 || i === 120) await crowd(170, 4); });
  await release();
}

// ③ 敌将对决（马超 vs 文丑）：十字刀气 / 扇形横扫 → 箭雨 / 震地 → 举盾 → 破盾击败
await enterBattle('machao', ['sword', 'fire', 'crossbow']);
await page.evaluate(() => {
  const b = window.__game.scene.battle;
  for (const e of b.enemies) e.dead = true;
  window.__boss = b.spawnBoss('wenchou', b.player.x + 60, b.player.y - 90, true);
  window.__boss.maxHp = 1e6; window.__boss.hp = 9.2e5;
  Object.defineProperty(window.__boss, 'flash', { get() { return 0; }, set() {} });
});
await clear();
mode = 'dodge';
const cast = (s) => page.evaluate((s) => { const e = window.__boss; e.bskills = [s]; e.skillIdx = 0; e.state = 'move'; e.stateT = 0; }, s);
await cast('cross');
const keepHp = (v) => page.evaluate((v) => { const e = window.__boss; if (e.hp < v) e.hp = v; }, v);
await record('v3_cross', 180, async (i) => { await steer(i); await keepHp(8.6e5); if (i === 90) await cast('fan'); });
await cast('rain');
await record('v3_rain', 180, async (i) => { await steer(i); await keepHp(7.4e5); if (i === 90) await cast('nova'); });
await page.evaluate(() => { const e = window.__boss; e.bskills = ['charge']; e.maxHp = 1e6; e.hp = 6.9e5; e.minTime = 0; e.state = 'rest'; e.stateT = 1; });
await record('v3_shield', 180, async (i) => {
  await steer(i);
  if (i === 80) await page.evaluate(() => { const e = window.__boss; if (e.shield > 0) e.shield = 1; });
});
await page.evaluate(() => { const e = window.__boss; e.shield = 0; e.shieldDone = true; e.hp = Math.min(e.hp, 9000); });
await record('v3_kill', 150, async (i) => { await steer(i); if (i === 75) await crowd(200, 2); });
await release();

fs.writeFileSync('dist/video6/segments.json', JSON.stringify({ fps: FPS, segments }, null, 1));
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no errors', 'frames', n);
await browser.close();
server.close();
