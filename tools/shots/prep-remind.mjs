import assert from 'node:assert/strict';
// 征战 / 守城出发前，备战没设置时弹提醒：「直接出征」能进战斗，「今天不再提醒」之后不再弹。Q='?skip=1' node tools/shot.mjs prep-remind
export default async function ({ page, wait, shot }) {
  const pt = (id) => page.evaluate((id) => { const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect(); return r && [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H]; }, id);
  const click = async (id) => { await page.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id, { timeout: 8000 }); const p = await pt(id); await page.mouse.click(p[0], p[1]); await wait(250); };
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => { const s = window.__saveMod.save; window.__game.dialogs.length = 0; s.homeMode = 'chapter'; s.preparationPresets = {}; s.preparedSkills = {}; s.daily.prepNoRemind = false; s.guide = 99; });
  await wait(300);
  await click('start_battle');
  const d1 = await page.evaluate(() => window.__game.dialogs.map((d) => d.constructor.name));
  assert.deepEqual(d1, ['PrepReminderDialog']);
  await shot('prep-remind');
  await click('prep_rm_go');
  assert.ok(await page.evaluate(() => window.__game.dialogs.some((d) => d.constructor.name === 'PreparationDialog')), 'opens preparation');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  // 守城：勾「今天不再提醒」后直接出征
  await page.evaluate(() => { window.__saveMod.save.homeMode = 'defense'; });
  await wait(300);
  await click('start_defense');
  await click('prep_rm_nomore');
  await click('prep_rm_skip');
  await page.waitForFunction(() => window.__game.scene.battle, null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__saveMod.save.daily.prepNoRemind), true);
  console.log('prep-remind ok');
}
