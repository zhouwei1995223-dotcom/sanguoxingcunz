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
  // 备战里的「推荐」：一键填入并启用
  await click('prep_recommend');
  await wait(300); await shot('prep-recommend');
  const rec = await page.evaluate(() => { const s = window.__saveMod.save, p = s.preparationPresets[s.hero]; return { n: p.slots[p.active].length, core: p.coreWeapons[p.active], list: p.slots[p.active] }; });
  console.log('recommend', JSON.stringify(rec));
  assert.ok(rec.n >= 6 && rec.core, 'recommended preset filled with a core weapon');
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__saveMod.save.preparationPresets = {}; });
  // 提醒框里「一键推荐并出征」
  await wait(200);
  await click('start_battle');
  await click('prep_rm_auto');
  await wait(300);
  if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await click('duration_5');
  await page.waitForFunction(() => window.__game.scene.battle, null, { timeout: 8000 });
  assert.ok(await page.evaluate(() => { const s = window.__saveMod.save, p = s.preparationPresets[s.hero]; return p && p.slots[p.active].length > 0; }), 'auto recommend applied');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.battle.player.hp = 0; });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => { const s = window.__saveMod.save; window.__game.dialogs.length = 0; s.preparationPresets = {}; s.preparedSkills = {}; s.daily.prepNoRemind = false; s.guide = 99; });
  await wait(300);
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
