// 主界面「征战 / 守城」页签与守城关卡卡片、关卡列表
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(300);
  await page.evaluate(() => { window.__game.ui.clickedId = 'mode_defense'; });
  await wait(400);
  await shot('defhome_card');
  await page.evaluate(() => { window.__game.ui.clickedId = 'def_list'; });
  await wait(500);
  await shot('defhome_list');
}
