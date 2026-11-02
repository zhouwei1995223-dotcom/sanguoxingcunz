// 守城地形：山林、出怪口、建造点、建筑
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.startBattle(-3, 1); });
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.def.grain = 2000; b.player.x = 200; b.player.y = -40; });
  await wait(300);
  await page.evaluate(() => { window.__game.ui.clickedId = 'def_build'; });
  await wait(500);
  await shot('defter_dialog');
  await page.evaluate(() => { window.__game.ui.clickedId = 'bd_tower'; });
  await wait(300);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.player.x = 200; b.player.y = 70; });
  await wait(200);
  await page.evaluate(() => { window.__game.ui.clickedId = 'def_build'; });
  await wait(300);
  await page.evaluate(() => { window.__game.ui.clickedId = 'bd_cata'; });
  await wait(300);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.player.x = 250; b.player.y = 0; b.t = 40; });
  for (let i = 0; i < 12; i++) { await wait(500); await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.pendingStrats.length = 0; g.scene.banners.length = 0; }); }
  await wait(120);
  await shot('defter_gate');
}
