// 按场景分享：锦囊「问好友」、结算「炫耀战绩」
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(600);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openStrategyForTest(2, 2); });
  await wait(1000);
  await shot('share_strat');
  const btn = await page.evaluate(() => { const r = window.__game.ui.lastRects && window.__game.ui.lastRects.strat_ask; return r || null; });
  console.log('strat_ask rect', JSON.stringify(btn));
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.kills = 1024; b.bestCombo = 312; b.t = 400; g.scene.finish(true); });
  await wait(2500);
  await shot('share_result');
}
