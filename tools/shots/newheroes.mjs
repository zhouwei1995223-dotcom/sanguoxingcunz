// 1.0.3 新武将：武将页两行列表、详情，以及每人的专属武器和大招
const IDS = ['huangzhong', 'machao', 'sunshangxiang', 'dianwei', 'jiangwei'];
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await tap(351, 805); await wait(500);
  await shot('nh_tab');
  await page.evaluate(() => { window.__game.scene.viewHero = 'machao'; });
  await wait(400);
  await shot('nh_machao_detail');
  for (const id of IDS) {
    await page.evaluate((h) => {
      const g = window.__game;
      const s = window.__saveMod.save;
      s.heroes[h].owned = true; s.heroes[h].star = 1; s.hero = h;
      g.dialogs.length = 0;
      g.scene.tab = 'battle';
    }, id);
    await wait(300);
    await tap(195, 722); // 出征
    await wait(1200);
    await page.evaluate(() => {
      const g = window.__game;
      g.dialogs.length = 0;
      const b = g.scene.battle;
      b.player.maxHp = b.player.hp = 99999;
      b.base.atk = 40;
      b.weapons[0].lv = 5;
      b.recalc();
      b.t = 200;
    });
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => { window.__game.dialogs.length = 0; });
      await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(450); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
    }
    await shot('nh_' + id + '_weapon');
    // 进化形态
    await page.evaluate(() => { const b = window.__game.scene.battle; b.weapons[0].evo = true; b.recalc(); window.__game.dialogs.length = 0; });
    await page.keyboard.down('d'); await wait(1300); await page.keyboard.up('d');
    await shot('nh_' + id + '_evo');
    // 大招
    await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.rage = 100; b.rageLock = 0; b.castUlt(); });
    await wait(700);
    await shot('nh_' + id + '_ult');
    await wait(2500);
    const st = await page.evaluate(() => { const b = window.__game.scene.battle; return { kills: b.kills, ult: !!b.ult, frenzy: b.frenzy, dmgMul: b.dmgMul.toFixed(2) }; });
    console.log(id, JSON.stringify(st));
    await page.reload();
    await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
    await wait(400);
    await page.evaluate(() => { window.__game.dialogs.length = 0; });
  }
}
