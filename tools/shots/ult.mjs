export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.base.atk = 30; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999;
    ['horse', 'fire'].forEach((id) => b.addWeapon(id));
    b.weapons.forEach((w) => (w.lv = 4));
    b.recalc();
    b.t = 200; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 165);
  });
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(400); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  await shot('fx_combat');
  await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; window.__game.dialogs.length = 0; });
  await wait(300);
  await shot('ult_ready');
  await tap(58, 741);
  await wait(250); await shot('ult_1');
  await wait(350); await shot('ult_2');
  await wait(500); await shot('ult_3');
  // 右手按住摇杆的同时，左手点大招（多点触控）
  await wait(9000);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; window.__game.dialogs.length = 0; });
  await wait(200);
  const cdp = await page.context().newCDPSession(page);
  const before = await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; g.dialogs.length = 0; return b.ultCasts; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 600, id: 1 }] });
  await wait(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 330, y: 600, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y: 600, id: 1 }, { x: 58, y: 741, id: 2 }] });
  await wait(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: 330, y: 600, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('multitouch ult:', before, '->', await page.evaluate(() => window.__game.scene.battle.ultCasts));
  console.log(JSON.stringify(await page.evaluate(() => { const b = window.__game.scene.battle; return { casts: b.ultCasts, combo: b.bestCombo, kills: b.kills }; })));
}
