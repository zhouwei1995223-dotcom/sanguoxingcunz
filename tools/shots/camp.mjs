// 主界面营地：帅帐、篝火、出战武将待命、其他武将闲逛
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(2500);
  await shot('camp_a');
  await wait(3000);
  await shot('camp_b');
}
