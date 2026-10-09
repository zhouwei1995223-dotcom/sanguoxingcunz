export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  const pos = await page.evaluate(() => { const u = window.__game.ui.u, top = window.__game.ui.safeTop + 190 * u, sy = top + 180 * u; return { u, sy }; });
  await tap((18 + 42) * pos.u / 2, (pos.sy + 124 * pos.u * 4 + 42 * pos.u) / 2);
  await wait(600);
  await tap(195, 565);
  await page.waitForFunction(() => window.__game.scene.battle, null, { timeout: 8000 });
  await wait(1500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  for (let i = 0; i < 6; i++) { await page.keyboard.down('d'); await wait(400); await page.keyboard.up('d'); await page.evaluate(() => { window.__game.dialogs.length = 0; }); }
  await shot('w_battle');
  await page.evaluate(() => { const b = window.__game.scene.battle; b.t = 478; b.kills = 1650; b.player.maxHp = b.player.hp = 1e6; window.__game.dialogs.length = 0; });
  for (let i = 0; i < 20; i++) {
    const d = await page.evaluate(() => { const g = window.__game; return g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : ''; });
    if (d === 'ResultDialog') { await wait(1200); await shot('w_result'); break; }
    if (d) await page.evaluate(() => { window.__game.dialogs.length = 0; });
    await wait(400);
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__saveMod.save.weekly)));
}
