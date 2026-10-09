// 新技能、技能卡片、封禁、进化表、专属联动
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(300);
  const hero = await page.evaluate(() => window.__game.scene.battle.hero.id);
  console.log('hero', hero, 'cleared', await page.evaluate(() => window.__game.scene.battle.cleared));
  // 新武器实战
  await page.evaluate(() => {
    const b = window.__game.scene.battle; window.__game.dialogs.length = 0;
    b.base.atk = 40; b.player.maxHp = b.player.hp = 99999;
    ['knife', 'thunder', 'rock', 'drum', 'catapult'].forEach((id) => b.addWeapon(id));
    b.weapons.forEach((w) => (w.lv = 4));
    b.passives.push({ id: 'map', lv: 1 });
    b.recalc();
    b.t = 300;
  });
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => { window.__game.dialogs.length = 0; });
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(350); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  await shot('sk_new_weapons');
  // 升级卡片：构造一组带进化/专属/推荐的选项
  await page.evaluate(() => {
    const g = window.__game; const s = g.scene; const b = s.battle;
    g.dialogs.length = 0;
    const sp = b.weapon('spear'); sp.lv = 4;
    b.passives.push({ id: 'tiger', lv: 1 });
    const choices = [{ kind: 'weapon', id: 'spear', lv: 5, isNew: false }, { kind: 'weapon', id: 'horse', lv: 1, isNew: true }, { kind: 'passive', id: 'wine', lv: 1, isNew: true }];
    const D = g.dialogs; s.openLevelUpForTest(choices);
  });
  await wait(700);
  await shot('sk_levelup');
  // 封禁
  await page.evaluate(() => { const d = window.__game.dialogs[0]; d.banishMode = true; });
  await wait(300);
  await shot('sk_banish');
  await tap(195, 520);
  await wait(400);
  console.log('banished', await page.evaluate(() => [...window.__game.scene.battle.banned].join(',') + ' left ' + window.__game.scene.battle.banishes));
  await shot('sk_after_banish');
  // 进化表
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openEvoTableForTest(); });
  await wait(600);
  await shot('sk_evotable');
  // 专属联动进化：白马义从 / 青釭剑阵
  await page.evaluate(() => {
    const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0;
    for (const id of ['sword', 'horse']) { if (!b.weapon(id)) b.addWeapon(id); b.weapon(id).lv = 5; }
    b.passives.push({ id: 'flag', lv: 1 }, { id: 'horseshoe', lv: 1 });
    b.recalc();
    b.pendingChests.push({ boss: true });
  });
  await wait(1800);
  await shot('sk_chest_link');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(1500);
  await shot('sk_link_play');
  console.log(await page.evaluate(() => JSON.stringify(window.__game.scene.battle.weapons.map((w) => w.id + (w.evo ? (w.link ? '★专属' : '★') : w.lv)))));
}
