// Q='?skip=1' node tools/shot.mjs chest-claims
import assert from 'node:assert/strict';

export default async function ({ page }) {
  async function home() {
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
    await page.evaluate(() => window.__game.closeAll());
  }
  async function click(id) {
    await page.waitForFunction(id => window.__game.ui.prevRegions.some(r => r.id === id), id);
    const [x, y] = await page.evaluate(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(r => r.id === id);
      const c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(x, y);
  }
  const counts = () => page.evaluate(() => {
    const c = window.__saveMod.save.daily.chestAd;
    return [c.wood || 0, c.gold || 0];
  });
  const items = () => page.evaluate(() => window.__saveMod.save.items.length);
  async function waitForChest() {
    await page.waitForFunction(() => window.__game.dialogs.at(-1)?.constructor.name === 'ChestResultDialog');
    await page.evaluate(() => window.__game.closeAll());
  }
  await home();
  await page.evaluate(() => {
    const m = window.__saveMod;
    m.save.daily.chestAd = { wood: 3, gold: 1 }; // 旧版当天已经领满的存档。
    m.flushSave(true);
  });
  await page.reload();
  await home();
  await click('nav_shop');
  assert.deepEqual(await counts(), [3, 1]);
  const initial = await items();
  await click('chest_ad_wood');
  await page.locator('#__adskip').click();
  assert.deepEqual(await counts(), [3, 1]);
  assert.equal(await items(), initial);

  for (const [type, n] of [['wood', 2], ['gold', 4]]) {
    for (let i = 0; i < n; i++) {
      const before = await items();
      await click('chest_ad_' + type);
      await page.locator('#__adskip').waitFor();
      if (i === 0) {
        // 模拟加载期间重复提交同一张卡的点击。
        await page.evaluate(type => { window.__game.ui.clickedId = 'chest_ad_' + type; }, type);
      }
      await waitForChest();
      assert.equal(await items(), before + 1);
    }
    await page.waitForFunction(type => window.__game.ui.prevRegions.some(r => r.id === 'chest_ad_' + type + ':disabled'), type);
    assert.deepEqual(await counts(), type === 'wood' ? [5, 1] : [5, 5]);
  }

  for (const [id, n] of [['chest_buy_gold', 1], ['chest_ten_wood', 10]]) {
    const before = await items();
    await click(id);
    await page.waitForFunction(n => window.__saveMod.save.items.length === n, before + n);
    assert.deepEqual(await counts(), [5, 5]);
    await page.evaluate(() => window.__game.closeAll());
  }

  const nextDay = () => page.evaluate(() => {
    const m = window.__saveMod;
    m.save.daily.day = '2000-01-01';
    m.rolloverDaily();
  });
  await nextDay();
  assert.deepEqual(await counts(), [0, 0]);
  await click('chest_free_wood');
  await waitForChest();
  assert.deepEqual(await counts(), [1, 0]);
  const beforeMidnight = await items();
  await click('chest_ad_wood');
  await page.locator('#__adskip').waitFor();
  await nextDay();
  await waitForChest();
  assert.equal(await items(), beforeMidnight + 1);
  assert.deepEqual(await counts(), [0, 0]);
}
