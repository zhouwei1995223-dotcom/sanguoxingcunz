// 1.0.4 三星评价：结算页的三颗星、直取敌将确认框（看广告）、章节卡片上的星
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await tap(195, 722);
  await wait(1200);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; if (g.scene.battle) g.scene.battle.t = 30; });
  console.log('scene', await page.evaluate(() => window.__game.scene.constructor.name + ' ' + window.__game.dialogs.map((d) => d.constructor.name).join(',')));
  await wait(600);
  // 直取敌将确认框
  const rect = await page.evaluate(() => { const g = window.__game; return g.scene.battle.canRush(); });
  console.log('canRush', rect);
  await tap(195, 120);
  await wait(500);
  await shot('st_rush');
  console.log(await page.evaluate(() => window.__game.dialogs.map((d) => d.constructor.name).join(',')));
  // 结算：模拟最终敌将 40 秒内击败、没复活
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.finalBossSec = 40; b.won = true; g.scene.finish(true); });
  await wait(1500);
  await shot('st_result');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
}
