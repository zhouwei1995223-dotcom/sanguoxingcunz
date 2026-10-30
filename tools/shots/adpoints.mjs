// 广告点位：锦囊免费刷新（每局一次）、复活（看广告最多三次）、军资箱每天第一次免费
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.tab = 'shop'; });
  await wait(600);
  await shot('ad_shop');
  await page.evaluate(() => { const g = window.__game; g.scene.tab = 'battle'; });
  await wait(300);
  await tap(195, 722);
  await wait(1200);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.t = 119.5; });
  await wait(1500);
  await shot('ad_strat');
  const s = await page.evaluate(() => { const g = window.__game; return { dlg: g.dialogs.map((d) => d.constructor.name).join(','), free: g.scene.battle.stratFreeRerolls, rerolls: g.scene.battle.rerolls }; });
  console.log(JSON.stringify(s));
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.player.hp = 0; });
  await wait(1200);
  await shot('ad_revive');
  console.log(await page.evaluate(() => window.__game.dialogs.map((d) => d.constructor.name).join(',')));
}
