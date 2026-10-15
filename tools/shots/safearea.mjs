// 小红书模拟器会注入 --safe-area-inset-* 变量：模拟注入后，界面顶部 / 底部是否让出安全区
export default async function ({ page, wait, shot }) {
  await page.route('**/index.html*', async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace('</head>', '<style>:root{--safe-area-inset-top:44px;--safe-area-inset-bottom:34px}</style></head>');
    await route.fulfill({ response: res, body: html, headers: { 'content-type': 'text/html' } });
  });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  console.log('safeTop/Bottom', await page.evaluate(() => [window.__game.ui.safeTop, window.__game.ui.safeBottom].join('/')));
  await shot('xhs_safearea');
}
