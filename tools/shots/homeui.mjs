// 主界面截图：多种屏幕比例
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(800);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(500);
  await shot('homeui_' + (process.env.TAG || 'a'));
}
