// 武将页：专属联动说明
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await tap(351, 805); await wait(500);
  await page.evaluate(() => { window.__game.scene.tab = 'hero'; window.__game.scene.viewHero = 'guanyu'; window.__game.ui.scrolls.hero_detail && (window.__game.ui.scrolls.hero_detail.offset = 400); });
  await wait(600);
  await shot('hero_links');
}
