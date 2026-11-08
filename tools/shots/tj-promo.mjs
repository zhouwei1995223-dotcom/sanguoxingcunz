// 天机签小红书配图：实机画面，3 倍分辨率截图 → 裁成 3:4（1080×1440）→ 顶部加一条宣纸标题。
// Q='?skip=1' node tools/shot.mjs tj-promo  → docs/promo/1.0.8/天机签配图/
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('docs/promo/1.0.8/天机签配图');

export default async function ({ page }) {
  fs.mkdirSync(OUT, { recursive: true });
  const url = page.url();
  // 用 3 倍像素的新页面截图（像素画放大后仍清晰）
  const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(url);
  const wait = (ms) => p.waitForTimeout(ms);
  const raw = {};
  const clean = () => p.evaluate(() => { const s = window.__game.scene, b = s.battle; s.tipText = ''; s.tipT = 0; s.chestAlertT = 0; if (s.banners) s.banners.length = 0; if (s.tipQueue) s.tipQueue.length = 0; if (b) { b.player.hurtFlash = 0; b.player.iframe = Math.min(b.player.iframe, 0.45); } });
  const grab = async (name) => {
    for (let i = 0; i < 3; i++) { await clean(); await wait(16); } raw[name] = (await p.screenshot()).toString('base64'); console.log('captured', name); };
  const pt = (id) => p.evaluate((id) => { const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect(); return r && [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H]; }, id);
  const click = async (id) => { await p.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id, { timeout: 8000 }); const q = await pt(id); await p.mouse.click(q[0], q[1]); await wait(200); };

  await p.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(600);
  await p.evaluate(() => { const g = window.__game, s = window.__saveMod.save; g.dialogs.length = 0; s.homeMode = 'tianji'; s.stamina = 60; s.tianji.bestDmg = 0; s.guide = 99; for (const k of ['boss_warn', 'boss', 'elite', 'chest', 'gem', 'magnet', 'potion', 'ult', 'tj_first', 'tj_tong']) s.tips[k] = true; });
  await wait(1200);
  await grab('card');

  await click('tj_start');
  await p.waitForFunction(() => window.__game.scene.battle?.tj);
  await p.evaluate(() => { const g = window.__game, b = g.scene.battle; g.dialogs.length = 0; b.player.maxHp = b.player.hp = 1e9; b.tj.freeT = 999; });
  await wait(2500);
  // ① 上上签：五虎上将揭晓的金光签文卡
  await p.evaluate(() => { const b = window.__game.scene.battle; b.tj.tickets = 1; b.tj.force = 'wuhu'; window.__game.dialogs.length = 0; window.__game.scene.pressDraw(); });
  await p.waitForFunction(() => { const d = window.__game.dialogs[0]; return d && d.t > 1.75; }, null, { timeout: 8000 });
  await grab('sign');
  await p.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.battle.tj.ultQueue.length = 0; });
  // ② 后期：满屏兵器和伤害数字
  await p.evaluate(() => {
    const b = window.__game.scene.battle;
    for (const id of ['crossbow', 'horse', 'fire', 'aura', 'rock', 'knife', 'thunder', 'caltrop', 'drum', 'halberd']) if (!b.weapon(id)) b.addWeapon(id);
    for (const w of b.weapons) { w.lv = 5; b.applyChoice({ kind: 'evo', id: w.id }); }
    for (const id of ['tiger', 'book', 'flag', 'map', 'pouch', 'wine']) b.passives.push({ id, lv: 5 });
    b.level = 30; b.base.atk *= 40; b.base.hp = 1e9; b.recalc(); b.player.maxHp = b.player.hp = 1e9; b.t = 455;
  });
  for (let i = 0; i < 12; i++) { await p.evaluate(() => { const g = window.__game, b = g.scene.battle; g.dialogs.length = 0; b.tj.tickets = 0; }); await wait(500); }
  await grab('late');
  // ③ 天命之主：三劫 · 天罚 + 破绽
  await p.evaluate(() => { window.__game.scene.battle.t = 509.9; });
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__game.scene.battle.tj.final)); i++) {
    await p.evaluate(() => { const g = window.__game, b = g.scene.battle; g.dialogs.length = 0; b.pendingChests.length = 0; b.tj.tickets = 0; });
    await wait(200);
  }
  for (let i = 0; i < 16; i++) { await p.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.battle.pendingChests.length = 0; }); await wait(250); }
  await p.evaluate(() => { const b = window.__game.scene.battle, st = b.tj, e = st.final; e.x = b.player.x + 60; e.y = b.player.y - 10; st.finalT = 59.5; st.nextFlaw = 60.2; });
  for (let i = 0; i < 30 && !(await p.evaluate(() => window.__game.scene.battle.tj.flaw > 2.5)); i++) {
    await p.evaluate(() => { const g = window.__game, b = g.scene.battle; g.dialogs.length = 0; b.pendingChests.length = 0; });
    await wait(150);
  }
  for (let i = 0; i < 4; i++) { await p.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(250); }
  await grab('final');
  // ④ 签运报告
  await p.evaluate(() => {
    const s = window.__game.scene, b = s.battle;
    b.tj.history = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
    b.level = 36; b.t = 600; b.won = true; window.__game.dialogs.length = 0; s.finish(true);
  });
  await wait(1600);
  await grab('result');
  await ctx.close();

  // 合成：裁 3:4，顶部宣纸标题条
  const crops = {
    sign: { y: 0.12, title: '摇出上上签！', sub: '六十多种签 · 每一局都不一样' },
    late: { y: 0.18, title: '神兵不限数量', sub: '十几件兵器一起转 · 伤害数字乱跳' },
    final: { y: 0.0, title: '天命之主 · 三劫', sub: '抓住破绽，伤害计分翻倍' },
    result: { y: 0.10, title: '签运报告', sub: '你的天命伤害有多少？' },
    card: { y: 0.36, title: '一签定天命', sub: '无名剑客 · 十分钟 · 全凭签运' },
  };
  const order = ['sign', 'late', 'final', 'result', 'card'];
  const comp = await page.context().browser().newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
  for (const [i, name] of order.entries()) {
    const c = crops[name];
    // 截图 1170×2532：取宽度铺满、按 y 比例取 3:4 区域（1170×1560）
    await comp.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;width:1080px;height:1440px;overflow:hidden;background:#efe5cc}
      .shot{position:absolute;left:0;top:0;width:1080px;height:1440px;background:url(data:image/png;base64,${raw[name]}) no-repeat;background-size:1080px auto;background-position:0 ${-c.y * 2337}px;image-rendering:pixelated}
      .band{position:absolute;left:0;right:0;top:0;height:250px;background:linear-gradient(#f4ead2 0%,#f4ead2 70%,rgba(244,234,210,0));}
      .t{position:absolute;left:0;right:0;top:44px;text-align:center;font:900 92px "Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC",serif;color:#2a1d14;letter-spacing:6px}
      .s{position:absolute;left:0;right:0;top:160px;text-align:center;font:600 40px "Noto Serif SC","Noto Serif CJK SC",serif;color:#a22633;letter-spacing:2px}
      .seal{position:absolute;right:40px;top:40px;width:74px;height:74px;background:#a22633;color:#fbf4e4;font:700 30px "Noto Serif SC",serif;display:flex;align-items:center;justify-content:center;line-height:1.05;text-align:center}
    </style></head><body><div class="shot"></div><div class="band"></div><div class="t">${c.title}</div><div class="s">${c.sub}</div><div class="seal">天机</div></body></html>`);
    await comp.waitForTimeout(300);
    const file = path.join(OUT, `${i + 1}-${name}.png`);
    await comp.screenshot({ path: file });
    console.log('wrote', file);
  }
  await comp.close();
}
