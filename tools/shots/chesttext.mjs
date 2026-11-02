// 战斗宝箱：不弹窗，获得的东西在武将身边飘字；自动选技能
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; window.__saveMod.save.stamina = 99; g.scene.startBattle(1); });
  await wait(1200);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(500);
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.dropPickup('chest', b.player.x + 4, b.player.y, 1, true);
  });
  await wait(900);
  await shot('chesttext_a');
  await page.evaluate(() => { const b = window.__game.scene.battle; b.dropPickup('chest', b.player.x + 4, b.player.y, 1, false); });
  await wait(700);
  await shot('chesttext_b');
  console.log('dialogs', await page.evaluate(() => window.__game.dialogs.map((d) => d.constructor.name).join(',')));
  // 自动选技能：开着时升级不弹窗
  await page.evaluate(() => { window.__saveMod.save.settings.autoPick = true; const b = window.__game.scene.battle; b.pendingLevelUps += 2; });
  await wait(800);
  await shot('chesttext_auto');
  console.log('dialogs', await page.evaluate(() => window.__game.dialogs.map((d) => d.constructor.name).join(',')), 'lv', await page.evaluate(() => window.__game.scene.battle.level));
  // 关掉后升级弹窗里有「自动选择」按钮
  await page.evaluate(() => { window.__saveMod.save.settings.autoPick = false; const b = window.__game.scene.battle; b.pendingLevelUps += 1; });
  await wait(900);
  await shot('chesttext_lvdlg');
}
