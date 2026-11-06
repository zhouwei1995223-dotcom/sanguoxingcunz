// Q='?skip=1' node tools/shot.mjs preparation
// 从旧版超额清单进入营地，验证实际按钮、跨章预设和战斗卡池。
import assert from 'node:assert/strict';

export default async function ({ page, wait, shot }) {
  const gameReady = () => page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  async function click(id) {
    await page.waitForFunction(id => window.__game.ui.prevRegions.some(r => r.id === id), id);
    const point = await page.evaluate(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(r => r.id === id);
      const canvas = document.querySelector('canvas').getBoundingClientRect();
      const top = r.clip ? Math.max(r.y, r.clip[1]) : r.y;
      const bottom = r.clip ? Math.min(r.y + r.h, r.clip[1] + r.clip[3]) : r.y + r.h;
      return [canvas.x + (r.x + r.w / 2) * canvas.width / ui.W, canvas.y + (top + bottom) / 2 * canvas.height / ui.H];
    }, id);
    await page.mouse.click(...point);
    await wait(130);
  }
  const presets = () => page.evaluate(() => window.__saveMod.save.preparationPresets.zhaoyun);
  await gameReady();
  await page.evaluate(() => {
    const mod = window.__saveMod, s = mod.save;
    s.maxCleared = 5; s.selectedChapter = 3; s.selectedDiff = 0; s.homeMode = 'chapter'; s.hero = 'zhaoyun';
    s.preparedSkills = { zhaoyun: ['catapult', 'thunder', 'sword', 'fire', 'horse', 'rock', 'aura', 'spear',
      'tiger', 'armor', 'book', 'flag', 'wine', 'horn', 'bowl', 'tiger', 'blade'] };
    delete s.preparationPresets;
    mod.flushSave(true);
  });
  await page.reload(); await gameReady(); await wait(300);
  await page.evaluate(() => window.__game.closeAll());
  await wait(180);
  const legacy = (await presets()).slots[0];
  assert.deepEqual(legacy, ['catapult', 'thunder', 'sword', 'fire', 'horse', 'spear', 'tiger', 'armor', 'book', 'flag', 'wine', 'horn']);
  await click('side_prepare');
  await page.waitForFunction(() => window.__game.dialogs.at(-1)?.constructor.name === 'PreparationDialog');
  const pool = () => page.evaluate(() => window.__game.dialogs.at(-1).pool);
  const chapter3 = await pool();
  assert.equal(chapter3.weapons.length, 10); assert.equal(chapter3.passives.length, 12);
  assert.ok(chapter3.weapons.includes('rock') && !chapter3.weapons.includes('catapult'));
  await click('prep_slot_1');
  for (const id of ['sword', 'horse', 'crossbow', 'fire', 'knife', 'aura', 'spear']) await click('prep_skill_' + id);
  await click('prep_passives');
  for (const id of ['tiger', 'armor', 'book', 'flag', 'horseshoe', 'lingzhi', 'pouch']) await click('prep_skill_' + id);
  await shot('prep_six_slots');
  await click('prep_save');
  const custom = ['sword', 'horse', 'crossbow', 'fire', 'knife', 'spear', 'tiger', 'armor', 'book', 'flag', 'horseshoe', 'lingzhi'];
  assert.deepEqual(await presets(), { active: 1, slots: [legacy, custom, []] });
  await page.reload(); await gameReady(); await wait(300); await page.evaluate(() => window.__game.closeAll()); await wait(180);
  assert.deepEqual((await presets()).slots[1], custom);
  await click('ch_prev'); await click('ch_prev');
  assert.ok(await page.evaluate(() => window.__game.ui.toasts.some(x => x.text.includes('预设有变动'))));
  await click('side_prepare');
  assert.equal((await pool()).weapons.length, 6); assert.equal((await pool()).passives.length, 9);
  await wait(1800);
  await shot('prep_chapter1_adjusted');
  // 回旋飞刀暂缓后可以补上罡风，取消这次编辑则保留跨章预设。
  await click('prep_skill_aura');
  const edited = await page.evaluate(() => window.__game.dialogs.at(-1).presets.slots[1]);
  assert.ok(edited.includes('aura') && !edited.includes('knife'));
  await click('prep_slot_2'); await click('prep_skill_aura'); await click('prep_close');
  assert.deepEqual(await presets(), { active: 1, slots: [legacy, custom, []] }, '取消编辑不应修改预设');
  await click('start_battle'); await click('duration_5');
  await page.waitForFunction(() => window.__game.dialogs.at(-1)?.constructor.name === 'QiyuDialog');
  const run = await page.evaluate(() => {
    const s = window.__game.scene, b = s.battle;
    return { pool: b.skillPool, ids: s.preparedSkills, skipped: s.unavailablePreparedNames,
      drops: b.availableLevelChoices().map(c => c.id) };
  });
  assert.equal(run.pool.weapons.length, 6); assert.equal(run.pool.passives.length, 9);
  assert.deepEqual(run.ids, custom.filter(id => id !== 'knife'));
  assert.deepEqual(run.skipped, ['回旋飞刀']); assert.ok(!run.drops.includes('knife'));
  assert.deepEqual((await presets()).slots[1], custom, '换章只过滤本局，不覆盖原预设');
  await page.reload(); await gameReady(); await wait(300); await page.evaluate(() => window.__game.closeAll()); await wait(180);
  await click('ch_next'); await click('ch_next'); await click('side_prepare');
  assert.ok((await pool()).weapons.includes('knife'));
  await click('prep_slot_0'); await click('prep_save');
  assert.deepEqual(await presets(), { active: 0, slots: [legacy, custom, []] }, '恢复旧预设时其他槽位应保留');
  await click('mode_defense'); await click('side_prepare');
  assert.deepEqual(await pool(), { weapons: ['spear', 'sword', 'horse'], passives: [] });
  assert.ok(!await page.evaluate(() => window.__game.ui.prevRegions.some(r => r.id === 'prep_passives')));
}
