// 一次性提示：可破坏物、道具、精英、敌将红圈、锦囊首次、封禁提示
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__saveMod.save.tips = {}; });
  await wait(300);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(500);
  const clear = () => page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.pendingStrats.length = 0; b.player.hp = b.player.maxHp; });
  await clear();
  await page.evaluate(() => { const b = window.__game.scene.battle; b.spawnBreakable(b.player.x + 40, b.player.y); });
  await wait(1200);
  await shot('tip_breakable');
  await page.evaluate(() => { const b = window.__game.scene.battle; b.dropPickup('magnet', b.player.x + 60, b.player.y + 30, 1); b.spawnEnemy('wei_shield', b.player.x - 60, b.player.y - 20, { elite: true }); });
  for (let i = 0; i < 3; i++) { await clear(); await wait(1500); }
  await shot('tip_more');
  await page.evaluate(() => { const b = window.__game.scene.battle; b.warnings.push({ kind: 'circle', x: b.player.x + 20, y: b.player.y, r: 40, a: 0, len: 0, t: 0, dur: 3 }); });
  await wait(600);
  await shot('tip_warn');
  await clear();
  await page.evaluate(() => { const g = window.__game; g.scene.openStrategyForTest(0, 0); });
  await wait(900);
  await shot('tip_strat');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.level = 5; g.scene.openLevelUpForTest(b.rollChoices()); });
  await wait(900);
  await shot('tip_banish');
  console.log('tips seen', await page.evaluate(() => Object.keys(window.__saveMod.save.tips).join(',')));
}
