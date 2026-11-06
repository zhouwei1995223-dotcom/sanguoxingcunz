// Q='?skip=1' node tools/shot.mjs levelup-rerolls
import assert from 'node:assert/strict';

export default async function ({ page }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => {
    window.__game.closeAll();
    window.__game.scene.startBattle(1, 0, 5);
  });
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => {
    const g = window.__game, scene = g.scene, b = scene.battle;
    g.closeAll();
    scene.paused = true;
    scene.autoPick = false;
    b.rerolls = 1;
    b.adRerolls = 4; // 复现旧版每局五次上限的边界，无需先播四条视频。
    window.testRerolls = { rolls: 0, match: false };
    b.rollChoices = () => {
      const test = window.testRerolls, pool = b.availableLevelChoices();
      const ids = test.match ? ['sword', 'tiger', 'armor'] : (++test.rolls % 2 ? ['spear', 'armor', 'flag'] : ['flag', 'spear', 'armor']);
      return ids.map(id => pool.find(c => c.id === id));
    };
    b.level++;
    b.pendingLevelUps++;
  });

  async function click(id) {
    await page.waitForFunction(id => window.__game.ui.prevRegions.some(r => r.id === id), id);
    const point = await page.evaluate(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(x => x.id === id);
      const c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(...point);
  }
  const count = () => page.evaluate(() => window.__game.scene.battle.adRerolls);
  const choices = () => page.evaluate(() => window.__game.dialogs.at(-1).choices.map(c => c.id));
  async function watch(id, expected, duplicate = false) {
    await click(id);
    await page.locator('#__adskip').waitFor();
    if (duplicate) {
      await page.evaluate(() => { void window.__game.dialogs.at(-1).watchRefreshAd(); });
      assert.equal(await page.locator('#__adskip').count(), 1);
    }
    await page.waitForFunction(n => window.__game.scene.battle.adRerolls === n, expected);
  }

  await click('lv_reroll');
  await page.waitForFunction(() => window.__game.scene.battle.rerolls === 0);
  const initial = await choices();
  await click('lv_reroll_ad');
  await page.locator('#__adskip').click();
  await page.waitForFunction(() => !window.__game.dialogs.at(-1).adBusy);
  assert.deepEqual(await choices(), initial);
  assert.equal(await count(), 4);
  await watch('lv_reroll_ad', 5, true);
  assert.notDeepEqual(await choices(), initial);
  await watch('lv_reroll_ad', 6);
  assert.deepEqual(await choices(), initial);
  await page.waitForFunction(() => window.__game.dialogs.at(-1).t > 0.25);
  await click('lv_choice_0');
  await page.waitForFunction(() => !window.__game.dialogs.length);

  // 下一次升级从备战未命中入口刷新，再从普通界面刷新，直到命中并自动选择。
  await page.evaluate(() => {
    const scene = window.__game.scene;
    scene.preparedSkills = ['sword'];
    scene.autoPick = true;
    scene.battle.level++;
    scene.battle.pendingLevelUps++;
  });
  await watch('prep_ad', 7);
  await page.evaluate(() => { window.testRerolls.match = true; });
  await watch('lv_reroll_ad', 8);
  await page.waitForFunction(() => !window.__game.dialogs.length);
  assert.equal(await page.evaluate(() => window.__game.scene.battle.weapon('sword')?.lv), 1);
}
