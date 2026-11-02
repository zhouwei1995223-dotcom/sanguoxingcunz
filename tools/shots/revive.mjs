// 复活弹窗：每局第一次免费复活，之后看广告
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; window.__saveMod.save.stamina = 99; g.scene.startBattle(1); });
  await wait(1000);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.battle.player.hp = 0; });
  await wait(1500);
  await shot('revive_free');
  console.log('revives', await page.evaluate(() => window.__game.scene.battle.revives));
}
