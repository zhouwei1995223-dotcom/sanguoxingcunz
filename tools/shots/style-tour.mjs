import fs from 'node:fs';
import path from 'node:path';

// 画风巡检：主界面三种模式卡、布阵选关 / 选将、布阵战斗、征战战斗各截一张。
// Q='?skip=1' node tools/shot.mjs style-tour
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  const capture = name => page.screenshot({ path: path.join(out, 'style-' + name + '.png') });
  async function button(id) {
    await page.waitForFunction(id => window.__game.ui.prevRegions.some(r => r.id === id), id, { timeout: 8000 });
    const p = await page.evaluate(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(...p);
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__game.closeAll());
  await page.waitForTimeout(200);
  // 主界面只有征战 / 天机签；守城、布阵在「演武」页
  await button('mode_chapter'); await page.waitForTimeout(300); await capture('home-chapter');
  await button('nav_arena');
  for (const m of ['defense', 'tower']) {
    await button('arena_' + m);
    await page.waitForTimeout(300);
    await capture('home-' + m);
  }
  await button('td_list'); await page.waitForTimeout(400); await capture('td-stages');
  await page.evaluate(() => window.__game.closeAll());
  await button('td_commander'); await page.waitForTimeout(400); await capture('td-commander');
  await page.evaluate(() => window.__game.closeAll());
  await page.waitForTimeout(200);
  await button('td_start');
  await page.waitForFunction(() => window.__game.scene.constructor.name === 'TowerScene');
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    let seed = 99;
    b.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 30 * 70 && !b.over; i++) {
      if (b.offer) b.choose(b.offer.cards[i % b.offer.cards.length]);
      b.update(1 / 30);
    }
    if (b.offer) b.choose(b.offer.cards[0]);
    // 快进产生的事件不要一次性冒出来。
    b.events.length = 0;
  });
  await page.waitForTimeout(700);
  await capture('td-battle');
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    for (let i = 0; i < 30 * 40 && !b.offer; i++) b.update(1 / 30);
  });
  await page.waitForTimeout(500);
  await capture('td-cards');
  await page.evaluate(() => { const b = window.__game.scene.battle; if (b.offer) b.choose(b.offer.cards[0]); });
  await button('td_pause'); await page.waitForTimeout(300); await capture('td-pause');
}
