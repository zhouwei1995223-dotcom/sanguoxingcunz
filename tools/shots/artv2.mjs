// 新造型游戏内效果：首页 + 武将页 + 战斗（需 Q='?skip=1&art=v2'）
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(600);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await shot('art_home');
  await page.evaluate(() => { window.__game.scene.tab = 'hero'; });
  await wait(600);
  await shot('art_hero');
  await page.evaluate(() => { window.__game.scene.tab = 'battle'; });
  await wait(300);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(800);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.player.maxHp = b.player.hp = 1e6; b.t = 200; });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingStrats.length = 0; b.pendingChests.length = 0; b.player.iframe = 999; });
    await page.keyboard.down(['d', 'd', 's', 'd'][i % 4]); await wait(350); await page.keyboard.up(['d', 'd', 's', 'd'][i % 4]);
  }
  await page.evaluate(() => { const b = window.__game.scene.battle; b.player.iframe = 0; b.player.hurtFlash = 0; for (const e of b.enemies) if (Math.hypot(e.x - b.player.x, e.y - b.player.y) < 60) e.dead = true; });
  await page.keyboard.down('d'); await wait(300);
  await shot('art_battle');
  await page.keyboard.up('d');
}
