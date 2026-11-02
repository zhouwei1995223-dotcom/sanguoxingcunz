// 守城结算页 + 召唤后的战场
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; const sv = window.__saveMod.save; g.dialogs.length = 0; sv.heroes.lvbu.owned = true; sv.heroes.lvbu.star = 3; g.scene.startBattle(-3); });
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.def.grain = 900; b.def.orders = { o_shield: 2, o_archer: 1, o_cav: 1, c_tower: 4, c_spike: 2, c_log: 1 }; });
  for (const id of ['def_spear', 'def_shield', 'def_archer', 'def_cav']) { await page.evaluate((id) => { window.__game.ui.clickedId = id; }, id); await wait(250); }
  await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; window.__g = g; });
  await page.evaluate(() => { const g = window.__game; g.ui.clickedId = 'def_hero'; });
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.ui.clickedId = 'hsum_lvbu'; });
  await wait(6000);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(1500);
  await shot('def3_army');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.won = true; });
  await wait(3500);
  await shot('def3_result');
}
