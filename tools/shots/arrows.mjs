// 屏幕外道具指示箭头
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(500);
  await page.evaluate(() => {
    const b = window.__game.scene.battle; window.__game.dialogs.length = 0;
    b.player.maxHp = b.player.hp = 99999;
    b.dropPickup('chest', b.player.x + 400, b.player.y - 100, 1, false);
    b.dropPickup('chest', b.player.x - 300, b.player.y + 500, 1, true);
    b.dropPickup('bun', b.player.x - 400, b.player.y - 200, 1);
  });
  await wait(400);
  await shot('arrows');
}
