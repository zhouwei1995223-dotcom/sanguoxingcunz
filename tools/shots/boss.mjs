// 首领战 / 宝箱进化 / 结算
export default async function ({ page, wait, shot, tap }) {
  await wait(2600);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await tap(195, 722); // 出征
  await wait(1500);
  const dlgName = () => page.evaluate(() => { const g = window.__game; return g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : ''; });
  // 强化：给满武器以便看到各种特效
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.base.atk = 60;
    b.player.maxHp = b.player.hp = 99999;
    b.base.hp = 99999;
    ['sword', 'crossbow', 'horse', 'fire', 'aura'].forEach((id) => b.addWeapon(id));
    b.weapons.forEach((w) => (w.lv = 5));
    ['tiger', 'flag', 'book', 'horseshoe', 'pouch', 'lingzhi'].forEach((id) => b.passives.push({ id, lv: 3 }));
    b.recalc();
    const ev = b.chapter.events;
    b.t = 280;
    b.eventIdx = ev.findIndex((e) => e.t >= 270);
  });
  for (let i = 0; i < 12; i++) {
    const d = await dlgName();
    if (d === 'LevelUpDialog') await tap(195, 300);
    if (d === 'BossIntroDialog') { await wait(900); await shot('boss_intro'); await wait(1500); }
    await page.keyboard.down(['w', 'd', 's', 'a'][i % 4]); await wait(600); await page.keyboard.up(['w', 'd', 's', 'a'][i % 4]);
  }
  await shot('boss_fight_mid');
  // 直接给宝箱
  await page.evaluate(() => { window.__game.scene.battle.pendingChests.push({ boss: true }); });
  await wait(400);
  for (let i = 0; i < 6; i++) { const d = await dlgName(); if (d === 'LevelUpDialog') await tap(195, 300); else break; await wait(300); }
  await wait(600); await shot('chest_shake');
  await wait(1600); await shot('chest_open');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  // 进化后的全武器效果
  for (let i = 0; i < 8; i++) {
    const d = await dlgName();
    if (d) { await page.evaluate(() => { window.__game.dialogs.length = 0; }); }
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(500); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  await shot('evo_fight');
  // 最终首领
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.t = 598; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 598);
    b.weapons.forEach((w) => (w.evo = true));
    b.recalc();
  });
  for (let i = 0; i < 10; i++) {
    const d = await dlgName();
    if (d === 'BossIntroDialog') { await wait(900); await shot('final_intro'); await wait(1500); }
    else if (d && d !== 'ResultDialog') await page.evaluate(() => { window.__game.dialogs.length = 0; });
    await wait(400);
  }
  await shot('final_fight');
  await page.evaluate(() => { const b = window.__game.scene.battle; if (b.finalBoss) b.finalBoss.hp = 1; });
  for (let i = 0; i < 30; i++) {
    const d = await dlgName();
    if (d === 'ResultDialog') { await wait(1500); await shot('result'); break; }
    if (d) await page.evaluate(() => { window.__game.dialogs.length = 0; });
    await wait(300);
  }
}
