// 运营能力入口：主界面「推荐」「更新提醒」、结算页「推荐给好友」（浏览器里用 __clubTest 打开显示）
export default async function ({ page, wait, shot, tap }) {
  await page.evaluate(() => { window.__clubTest = true; });
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(600);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(400);
  await shot('ops_home');
  await tap(195, 722);
  await wait(1200);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.finalBossSec = 50; b.won = true; g.scene.finish(true); });
  await wait(1500);
  await shot('ops_result');
}
