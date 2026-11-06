// Q='?skip=1' node tools/shot.mjs sweep-economy
import assert from 'node:assert/strict';

export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => {
    const game = window.__game, save = window.__saveMod.save;
    game.closeAll();
    Object.assign(save, { hero: 'zhaoyun', homeMode: 'chapter', selectedChapter: 2, selectedDiff: 0,
      selectedDefense: 2, maxCleared: 1, clears: { '0-1': true }, stars: { '0-1': 7 },
      stamina: 5, staminaTs: Date.now(), yuanbao: 500, signinDay: save.daily.day });
    save.defense = { cleared: 1, stars: { 1: 7 }, wins: 1, best: 300, day: '' };
    Object.assign(save.heroes.zhaoyun, { lv: 80, star: 5, peak: 50 });
  });

  async function click(id) {
    await page.waitForFunction(id => window.__game.ui.prevRegions.some(r => r.id === id), id);
    await wait(260);
    const point = await page.evaluate(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(r => r.id === id);
      const c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(...point);
    await wait(120);
  }
  const wallet = () => page.evaluate(() => {
    const { yuanbao, stamina } = window.__saveMod.save;
    return { yuanbao, stamina };
  });
  async function buyStamina() {
    const before = await wallet();
    await click('top_stamina');
    await click('stm_buy');
    assert.deepEqual(await wallet(), { yuanbao: before.yuanbao - 50, stamina: before.stamina + 10 });
    await click('stm_close');
  }
  async function sweep(id) {
    const before = await wallet();
    await click(id);
    await page.waitForFunction(() => window.__game.dialogs.at(-1)?.constructor.name === 'SweepDialog');
    const result = await page.evaluate(() => window.__game.dialogs.at(-1).res);
    assert.deepEqual(await wallet(), { yuanbao: before.yuanbao + result.yuanbao, stamina: before.stamina - 5 });
    await click('sweep_ok');
    return result;
  }
  async function checkRepeatCycle(id) {
    const before = await wallet();
    await buyStamina();
    for (let i = 0; i < 2; i++) {
      const r = await sweep(id);
      assert.equal(r.firstClear, false);
      assert.equal(r.yuanbao, 0);
      assert.ok(r.gold > 0 && r.iron > 0);
    }
    assert.deepEqual(await wallet(), { yuanbao: before.yuanbao - 50, stamina: before.stamina });
  }
  async function manualWin(start, expected, revives = 0) {
    const before = await wallet();
    await click(start);
    if (start === 'start_battle') await click('duration_5');
    await page.waitForFunction(() => window.__game.scene?.battle);
    const res = await page.evaluate(revives => {
      const g = window.__game, scene = g.scene, b = scene.battle;
      g.closeAll();
      b.t = b.chapter.duration;
      const boss = b.spawnBoss(b.chapter.boss, b.player.x, b.player.y, true);
      b.reviveCount = revives;
      b.t += revives ? 85 : 30;
      b.damage(boss, 1e12, 0, 0, 0, { force: true });
      g.closeAll();
      scene.finish(b.won);
      return g.dialogs.at(-1).res;
    }, revives);
    assert.equal(res.yuanbao, expected);
    assert.deepEqual(await wallet(), { yuanbao: before.yuanbao + expected, stamina: before.stamina - 5 });
    await wait(650);
    await click('res_ok');
    await page.waitForFunction(() => window.__game.scene.constructor.name === 'HomeScene');
    return res;
  }

  const campaign = await sweep('sweep_battle');
  assert.deepEqual([campaign.firstClear, campaign.stars, campaign.starBonus, campaign.yuanbao], [true, 7, 90, 330]);
  await checkRepeatCycle('sweep_battle');
  await buyStamina();
  assert.equal((await manualWin('start_battle', 40, 1)).stars, 1);
  await manualWin('start_battle', 40);
  await buyStamina();
  await click('mode_defense');
  const defense = await sweep('sweep_defense');
  assert.deepEqual([defense.firstClear, defense.stars, defense.yuanbao], [true, 7, 188]);
  await checkRepeatCycle('sweep_defense');
  await manualWin('start_defense', 28);

  // 单独模拟两个老关卡的一星通关存档，验证首次补星与第二次碾压。
  await buyStamina();
  await click('mode_chapter');
  await page.evaluate(() => {
    const s = window.__saveMod.save;
    s.stars['0-2'] = 1;
    s.defense.stars[2] = 1;
  });
  const improved = await sweep('sweep_battle');
  assert.deepEqual([improved.firstClear, improved.stars, improved.starBonus, improved.yuanbao], [false, 7, 90, 130]);
  assert.equal((await sweep('sweep_battle')).yuanbao, 0);
  await buyStamina();
  await click('mode_defense');
  const improvedDefense = await sweep('sweep_defense');
  assert.deepEqual([improvedDefense.firstClear, improvedDefense.stars, improvedDefense.yuanbao], [false, 7, 28]);
  assert.equal((await sweep('sweep_defense')).yuanbao, 0);
}
