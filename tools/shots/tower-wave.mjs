import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// 布阵波次 / 复活界面：Q='?skip=1&tower=1' node tools/shot.mjs tower-wave
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  const pt = id => page.evaluate(id => {
    const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
    return r && [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
  }, id);
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'TowerScene');
  // 推进到第一次休整
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    for (let i = 0; i < 30 * 120 && !(b.resting && b.waveIdx >= 0); i++) { if (b.offer) b.choose(b.offer.cards[0]); b.update(1 / 30); }
    b.events.length = 0;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'wave-rest.png') });
  const p = await pt('td_call');
  assert.ok(p, '休整时显示提前出击');
  const idx = await page.evaluate(() => window.__game.scene.battle.waveIdx);
  await page.mouse.click(...p);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__game.scene.battle.waveIdx), idx + 1, '提前出击开下一波');
  // 城门失守 → 复活面板 → 复活（网页版模拟广告）
  await page.evaluate(() => { const b = window.__game.scene.battle; if (b.offer) b.choose(b.offer.cards[0]); b.hp = 0; b.phase = 'loss'; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'wave-revive.png') });
  await page.mouse.click(...await pt('td_revive'));
  await page.waitForFunction(() => window.__game.scene.battle.phase === 'fight' && window.__game.scene.battle.reviveCount === 1, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'wave-revived.png') });
  console.log('tower-wave ok');
}
