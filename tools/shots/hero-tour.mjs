import fs from 'node:fs';
import path from 'node:path';

// 武将页巡检：Q='?skip=1' node tools/shot.mjs hero-tour   （Q='?skip=1&heroes=1' 看全员已拥有）
// 名册（全部 / 魏）、几位武将的详情；HEROES="caocao,zhenji" 指定详情看谁。
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  const capture = (name) => page.screenshot({ path: path.join(out, 'hero-' + name + '.png') });
  const wait = (ms) => page.waitForTimeout(ms);
  const click = async (id) => {
    const p = await page.evaluate((id) => {
      const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id);
      if (!r) return null;
      const c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    if (!p) { console.log('missing', id); return false; }
    await page.mouse.click(...p); await wait(350); return true;
  };
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(600);
  await page.evaluate(() => window.__game.closeAll());
  await click('nav_hero'); await wait(300); await capture('list');
  await click('hero_camp_wei'); await capture('list-wei');
  await click('hero_camp_all');
  for (const id of (process.env.HEROES || 'zhaoyun,caocao,zhenji,zuoci').split(',')) {
    await page.evaluate((id) => window.__game.scene.openHero(id), id);
    await wait(400);
    await capture('detail-' + id);
  }
}
