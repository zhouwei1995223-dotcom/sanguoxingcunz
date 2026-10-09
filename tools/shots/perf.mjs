// 性能：满武器 + 大量敌人时的帧耗时
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(500);
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.base.atk = 0.3; b.player.maxHp = b.player.hp = 1e9; b.base.hp = 1e9;
    ['sword', 'crossbow', 'horse', 'fire', 'aura'].forEach((id) => b.addWeapon(id));
    b.weapons.forEach((w) => { w.lv = 5; w.evo = true; });
    b.recalc();
    b.t = 560; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 535);
  });
  await wait(6000);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  const r = await page.evaluate(() => new Promise((res) => {
    const g = window.__game; const ts = []; let last = performance.now(); let n = 0;
    const tick = () => { const now = performance.now(); ts.push(now - last); last = now; g.dialogs.length = 0; if (++n < 180) requestAnimationFrame(tick); else res({ avg: ts.reduce((a, b) => a + b, 0) / ts.length, max: Math.max(...ts), enemies: g.scene.battle.enemies.filter(e => !e.dead).length, pickups: g.scene.battle.pickups.length, fx: g.scene.battle.fx.length }); };
    requestAnimationFrame(tick);
  }));
  console.log(JSON.stringify(r));
  await shot('perf');
}
