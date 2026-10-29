// 加速按钮、直取敌将按钮、小怪出手预警、连弩拖尾
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__game.scene.startBattle(1); });
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(800);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.base.atk = 400; b.recalc(); b.addWeapon('crossbow'); b.weapon('crossbow').lv = 4; b.recalc(); b.t = 175; });
  // 压制 10 秒后应出现「直取敌将」
  for (let i = 0; i < 30; i++) { await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.pendingStrats.length = 0; }); const k = ['d', 's', 'a', 'w'][i % 4]; await page.keyboard.down(k); await wait(500); await page.keyboard.up(k); if (await page.evaluate(() => window.__game.scene.battle.canRush())) break; }
  const st = await page.evaluate(() => { const b = window.__game.scene.battle; return { t: b.t, dom: b.dominantT, fill: b.screenFill.toFixed(3), can: b.canRush() }; });
  console.log('before rush', JSON.stringify(st));
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await shot('rush_button');
  // 确认弹窗
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openRushForTest(); });
  await wait(600);
  await shot('rush_confirm');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  // 2 倍速
  const sp = await page.evaluate(() => { const u = window.__game.ui; return { x: (u.W - 76 * u.u - 16 * u.u - 76 * u.u - 12 * u.u + 38 * u.u) / 2, y: (u.safeTop + 8 * u.u + 46 * u.u + 38 * u.u) / 2 }; });
  await tap(sp.x, sp.y);
  const t0 = await page.evaluate(() => window.__game.scene.battle.t); await wait(1000);
  const t1 = await page.evaluate(() => window.__game.scene.battle.t);
  console.log('speed x2: 1s real ->', (t1 - t0).toFixed(2), 's game');
  await page.evaluate(() => { const b = window.__game.scene.battle; if (b.canRush()) b.rush(); });
  await wait(300);
  console.log('after rush t=', await page.evaluate(() => window.__game.scene.battle.t.toFixed(1)));
  for (let i = 0; i < 12; i++) { await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; g.dialogs = g.dialogs.filter((d) => d.constructor.name === 'BossIntroDialog'); b.pendingLevelUps = 0; b.pendingChests.length = 0; }); await wait(400); }
  await shot('rush_after');
  console.log('boss', await page.evaluate(() => { const b = window.__game.scene.battle; return b.midBoss ? b.midBoss.boss.name : b.finalBoss ? b.finalBoss.boss.name : 'none'; }), 'strats', await page.evaluate(() => window.__game.scene.battle.strats.join(',')));
  // 小怪贴身：降低攻击，站着不动让小怪围上来
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.base.atk = 1; b.recalc(); b.player.maxHp = b.player.hp = 1e6; });
  await wait(2500);
  await shot('rush_contact');
}
