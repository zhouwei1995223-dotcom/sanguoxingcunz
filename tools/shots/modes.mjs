export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await shot('m_home');
  await tap(115, 543); await wait(300); await shot('m_hard');
  await tap(352, 722); await wait(600); await shot('m_list');
  await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(300);
  await tap(48, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.t = 175; b.player.maxHp = b.player.hp = 1e6; b.base.hp = 1e6; });
  for (let i = 0; i < 14; i++) {
    const d = await page.evaluate(() => { const g = window.__game; return g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : ''; });
    if (d === 'BossIntroDialog') { await wait(800); await shot('m_endless_boss'); await wait(1500); }
    else if (d) await page.evaluate(() => { window.__game.dialogs.length = 0; });
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(400); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  await shot('m_endless');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.battle.t = 640; g.scene.finish(false); });
  await wait(1500); await shot('m_endless_result');
}
