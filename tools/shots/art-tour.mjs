import fs from 'node:fs';
import path from 'node:path';

// 美术巡检：Q='?skip=1' node tools/shot.mjs art-tour
// 主界面（征战 / 天机签）、演武页（守城 / 布阵 / 无尽）、其余四个页签。ONLY=home,arena 只拍部分。
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const want = (k) => !only.length || only.includes(k);
  const capture = (name) => page.screenshot({ path: path.join(out, 'art-' + name + '.png') });
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
  await wait(800);
  await page.evaluate(() => window.__game.closeAll());
  await wait(300);
  if (want('home')) {
    await capture('home');
    await click('mode_tianji'); await capture('home-tianji');
    await click('mode_chapter');
  }
  if (want('arena')) {
    await click('nav_arena'); await capture('arena-defense');
    await click('arena_tower'); await capture('arena-tower');
    await click('arena_endless'); await capture('arena-endless');
    await click('arena_defense');
  }
  for (const t of ['shop', 'equip', 'talent', 'hero']) if (want(t)) { await click('nav_' + t); await wait(300); await capture(t); }
  await click('nav_battle');
  // 皮肤缓存：主界面静止两秒，新建数不应该再涨（涨了说明有控件每帧换尺寸 / 换 key）
  await wait(500);
  const s0 = await page.evaluate(() => ({ ...window.__skinStats }));
  await wait(2000);
  const s1 = await page.evaluate(() => ({ ...window.__skinStats }));
  console.log('skin cache', JSON.stringify(s1), s1.created === s0.created ? 'stable' : 'STILL CREATING ' + (s1.created - s0.created));
  const st = await page.evaluate(() => window.__game.ui.prevRegions.map((r) => r.id).join(' '));
  console.log('regions', st);
}
