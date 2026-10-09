// 每位武将的专属联动形态实战
export default async function ({ page, wait, shot, tap }) {
  const L = { zhaoyun: ['sword', 'horse'], guanyu: ['drum', 'horse'], zhangfei: ['drum', 'rock'], zhuge: ['crossbow', 'fire'], lvbu: ['crossbow', 'catapult'] };
  for (const [hero, ws] of Object.entries(L)) {
    await page.goto(page.url());
    await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
    await wait(300);
    await page.evaluate((h) => { window.__saveMod.save.hero = h; window.__game.dialogs.length = 0; }, hero);
    await wait(200);
    await tap(195, 722);
    await page.waitForFunction(() => window.__game.scene.battle);
    await page.evaluate((ws) => {
      const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0;
      b.base.atk = 40; b.player.maxHp = b.player.hp = 99999;
      for (const id of ws) { if (!b.weapon(id)) b.addWeapon(id); b.applyChoice({ kind: 'evo', id }); }
      b.t = 300;
    }, ws);
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => { window.__game.dialogs.length = 0; });
      await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(300); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
    }
    await shot('link_' + hero);
    console.log(hero, await page.evaluate(() => { const b = window.__game.scene.battle; return b.weapons.map((w) => w.id + (w.link ? '★' : '')).join(' ') + ' kills=' + b.kills + ' speed=' + Math.round(b.speed); }));
  }
}
