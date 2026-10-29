// 主界面「游戏圈」按钮（浏览器里用 __clubTest 打开显示）
export default async function ({ page, wait, shot }) {
  await page.evaluate(() => { window.__clubTest = true; });
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(600);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(400);
  await shot('club_home');
}
