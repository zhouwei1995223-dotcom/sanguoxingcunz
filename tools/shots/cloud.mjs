export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  // 第一台设备：有进度并上传
  await page.evaluate(() => { const s = window.__saveMod.save; s.gold = 77777; s.stats.runs = 5; window.__saveMod.markDirty(); window.__saveMod.flushSave(true); window.__cloudMod.cloudPush(true); });
  await wait(500);
  console.log('cloud has', await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('sgxc_cloud')).data).gold));
  // 模拟换手机：清空本地存档后重新打开
  await page.addInitScript(() => { if (sessionStorage.getItem('wipe') === '1') { sessionStorage.setItem('wipe', '2'); localStorage.removeItem('sgxc_save_v1'); } });
  await page.evaluate(() => sessionStorage.setItem('wipe', '1'));
  await page.goto(page.url().replace('skip=1&', ''));
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene', null, { timeout: 15000 });
  console.log('restored gold', await page.evaluate(() => window.__saveMod.save.gold), 'runs', await page.evaluate(() => window.__saveMod.save.stats.runs));
}
