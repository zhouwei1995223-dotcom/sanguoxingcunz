// 推广图素材：主界面、满屏割草、大招、升级三选一、锦囊、首领登场
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(800);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(600);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(400);
  const clear = () => page.evaluate(() => { const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; });
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.base.atk = 45; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999;
    ['sword', 'horse', 'fire', 'crossbow'].forEach((id) => b.addWeapon(id));
    b.weapons.forEach((w) => (w.lv = 5));
    ['tiger', 'flag', 'horseshoe'].forEach((id) => b.passives.push({ id, lv: 3 }));
    b.recalc();
    b.t = 230; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 220);
  });
  for (let i = 0; i < 18; i++) {
    await clear();
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(450); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  // 宣传图要的是「满屏」：在玩家周围刷一大圈曹军
  const crowd = (n, r0, r1) => page.evaluate(([n, r0, r1]) => {
    const b = window.__game.scene.battle; const p = b.player;
    const ids = ['wei_spear', 'wei_spear', 'wei_spear', 'wei_shield', 'wei_cavalry', 'wei_heavy', 'wei_archer'];
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const d = r0 + Math.random() * (r1 - r0); b.spawnEnemy(ids[i % ids.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 1.6, { hpMul: 6 }); }
  }, [n, r0, r1]);
  await crowd(170, 40, 150);
  await wait(1300);
  await clear(); await wait(100);
  await shot('p_combat');
  await crowd(120, 40, 150);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; });
  await clear(); await wait(200);
  await tap(58, 741);
  await wait(400); await shot('p_ult1');
  await wait(300); await shot('p_ult2');
  await wait(1500);
  // 升级三选一（带进化）
  await page.evaluate(() => {
    const g = window.__game; const s = g.scene; const b = s.battle; g.dialogs.length = 0;
    const choices = [{ kind: 'weapon', id: 'spear', lv: 5, isNew: false }, { kind: 'weapon', id: 'thunder', lv: 1, isNew: true }, { kind: 'passive', id: 'book', lv: 1, isNew: true }];
    s.openLevelUpForTest(choices);
  });
  await wait(800); await shot('p_levelup');
  // 锦囊：神机
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openStrategyForTest(2, 2); });
  await wait(1000); await shot('p_strat');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  // 首领
  await page.evaluate(() => { const b = window.__game.scene.battle; b.t = 280; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 270); });
  for (let i = 0; i < 14; i++) {
    const d = await page.evaluate(() => { const g = window.__game; return g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : ''; });
    if (d === 'BossIntroDialog') { await wait(900); await shot('p_boss_intro'); await wait(1600); await page.evaluate(() => { window.__game.dialogs.length = 0; }); continue; }
    if (d) await clear();
    await page.keyboard.down(['w', 'd', 's', 'a'][i % 4]); await wait(500); await page.keyboard.up(['w', 'd', 's', 'a'][i % 4]);
  }
  await clear(); await wait(100);
  await shot('p_boss_fight');
}
