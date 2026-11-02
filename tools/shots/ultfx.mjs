// 十位武将的大招特效：每人放一次，截切入画面和特效最盛的一帧
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  const heroes = (process.env.HEROES || 'zhaoyun guanyu zhangfei zhuge lvbu huangzhong machao sunshangxiang dianwei jiangwei').split(' ');
  for (const h of heroes) {
    await page.evaluate((h) => {
      const g = window.__game; const sv = window.__saveMod.save; g.dialogs.length = 0;
      sv.heroes[h].owned = true; sv.heroes[h].star = 5; sv.hero = h; sv.stamina = 99;
      for (const k of ['boss_warn', 'breakable', 'elite', 'evo', 'lowpower', 'pk_bomb', 'pk_bun', 'pk_magnet', 'strat', 'banish', 'qiyu', 'rush']) sv.tips[k] = true;
      if (g.scene.constructor.name !== 'HomeScene') g.setScene(new (g.scene.constructor)(1));
      g.scene.startBattle && g.scene.startBattle(1);
    }, h);
    await wait(900);
    await page.evaluate(() => {
      const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; g.scene.banners.length = 0;
      b.base.atk = 30; b.player.maxHp = b.player.hp = 99999;
      const ids = ['wei_spear', 'wei_shield', 'wei_cavalry'];
      for (let i = 0; i < 120; i++) { const a = Math.random() * 6.28, d = 40 + Math.random() * 150; b.spawnEnemy(ids[i % 3], b.player.x + Math.cos(a) * d, b.player.y + Math.sin(a) * d * 1.5, { hpMul: 50 }); }
    });
    await wait(300);
    await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; b.rage = 100; b.rageLock = 0; g.scene.tryUlt(); });
    await wait(260);
    await shot('ult_' + h + '_a');
    await wait(700);
    await shot('ult_' + h + '_b');
    await wait(1200);
    await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const HS = window.__homeScene; });
    await page.goto(page.url());
    await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
    await wait(300);
  }
}
