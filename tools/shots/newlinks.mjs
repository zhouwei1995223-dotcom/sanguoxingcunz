// 1.0.3 新武将的专属联动：武将页说明 + 局内进化表
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await tap(351, 805); await wait(500);
  for (const id of ['huangzhong', 'sunshangxiang']) {
    await page.evaluate((h) => { window.__game.scene.viewHero = h; }, id);
    await wait(300);
    await page.mouse.move(195, 650); await page.mouse.down(); await page.mouse.move(195, 330, { steps: 8 }); await page.mouse.up(); await wait(500);
    await shot('nl_' + id);
    await page.mouse.move(195, 330); await page.mouse.down(); await page.mouse.move(195, 700, { steps: 8 }); await page.mouse.up(); await wait(300);
  }
}
