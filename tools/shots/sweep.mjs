// 战力碾压：高战力时章节 / 守城卡片出现「碾压」按钮，点了直接结算
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; const sv = window.__saveMod.save; g.dialogs.length = 0; Object.assign(sv.heroes.zhaoyun, { lv: 60, star: 5 }); sv.homeMode = 'chapter'; });
  await wait(400);
  await shot('sweep_card');
  await page.evaluate(() => { window.__game.ui.clickedId = 'sweep_battle'; });
  await wait(900);
  await shot('sweep_result');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; window.__saveMod.save.homeMode = 'defense'; });
  await wait(400);
  await page.evaluate(() => { window.__game.ui.clickedId = 'sweep_defense'; });
  await wait(900);
  await shot('sweep_def');
}
