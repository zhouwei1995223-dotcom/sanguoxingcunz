// 主城首页截图（检查侧边按钮布局）
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(800);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(400);
  await shot('home_only');
}
