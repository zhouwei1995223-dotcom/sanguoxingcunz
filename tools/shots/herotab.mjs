export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await tap(351, 805); await wait(500); await shot('ht_zhaoyun');
  await tap(273, 140); await wait(400); await shot('ht_zhuge');
  await page.mouse.move(195, 600); await page.mouse.down(); await page.mouse.move(195, 300, { steps: 8 }); await page.mouse.up(); await wait(500);
  await shot('ht_zhuge_scrolled');
}
