// 商店概率公示
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.tab = 'shop'; });
  await wait(500);
  await shot('shop_odds_btn');
  const [x, y] = await page.evaluate(() => { const r = window.__game.ui.prevRegions.find((r) => r.id === 'chest_odds'); const k = window.devicePixelRatio; return [(r.x + r.w / 2) / k, (r.y + r.h / 2) / k]; });
  await page.touchscreen.tap(x, y);
  await wait(700);
  await shot('shop_odds');
}
