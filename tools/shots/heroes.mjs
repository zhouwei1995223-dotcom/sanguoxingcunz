// 每位武将：战斗中的武器效果 + 大招
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  // 武将页
  await tap(351, 805); await wait(500);
  await tap(195, 70); await wait(300);
  await shot('hero_tab');
  for (const id of ['guanyu', 'zhangfei', 'zhuge', 'lvbu']) {
    await page.evaluate((id) => { window.__saveMod.save.hero = id; window.__game.dialogs.length = 0; }, id);
    await tap(195, 805); await wait(400);
    await page.evaluate(() => { window.__game.dialogs.length = 0; });
    await tap(195, 722);
    await page.waitForFunction(() => window.__game.scene.battle);
    await page.evaluate(() => {
      const b = window.__game.scene.battle;
      b.base.atk = 40; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999;
      b.weapons.forEach((w) => (w.lv = 4));
      b.recalc();
      b.t = 200; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 165);
    });
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => { window.__game.dialogs.length = 0; });
      await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(300); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
    }
    await shot('h_' + id + '_weapon');
    await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; window.__game.dialogs.length = 0; b.castUlt(); });
    await wait(id === 'lvbu' ? 900 : 300);
    await shot('h_' + id + '_ult');
    await page.evaluate(() => { const b = window.__game.scene.battle; b.dead = true; window.__game.dialogs.length = 0; window.__game.scene.finish(false); });
    await wait(300);
    await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
    await page.evaluate(() => { window.__game.setScene(new (window.__game.scene.constructor === Object ? Object : window.__HomeScene || Object)()); });
    await page.goto(page.url());
    await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
    await wait(300);
    await page.evaluate(() => { window.__game.dialogs.length = 0; });
  }
}
