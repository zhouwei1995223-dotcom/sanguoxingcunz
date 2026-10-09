// 战斗暂停界面与隐私弹窗
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => { const b = window.__game.scene.battle; window.__game.dialogs.length = 0; ['sword', 'fire'].forEach((id) => b.addWeapon(id)); b.passives.push({ id: 'tiger', lv: 2 }); b.recalc(); b.t = 90; });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { window.__game.dialogs.length = 0; }); await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(300); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]); }
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.pauseForTest(); });
  await wait(500);
  await shot('pause');
}
