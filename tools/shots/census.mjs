// 怪多时场上各类物体的数量（找绘制大户）
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__game.scene.startBattle(1); });
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.base.atk = 0.5; b.player.maxHp = b.player.hp = 1e9; b.base.hp = 1e9;
    ['sword', 'crossbow', 'horse', 'fire', 'aura'].forEach((id) => b.addWeapon(id));
    b.weapons.forEach((w) => { w.lv = 5; w.evo = true; });
    b.recalc(); b.t = 560; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 535);
  });
  for (let i = 0; i < 20; i++) { await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.pendingStrats.length = 0; }); await page.keyboard.down('d'); await wait(400); await page.keyboard.up('d'); }
  console.log(JSON.stringify(await page.evaluate(() => {
    const b = window.__game.scene.battle; const fx = {}; for (const f of b.fx) fx[f.kind] = (fx[f.kind] || 0) + 1;
    const pk = {}; for (const k of b.pickups) pk[k.kind] = (pk[k.kind] || 0) + 1;
    const onScreen = b.enemies.filter((e) => !e.dead && b.inView(e.x, e.y, 20)).length;
    return { enemies: b.enemies.filter((e) => !e.dead).length, onScreen, fx, pickups: pk, projs: b.projs.length, shots: b.shots.length };
  })));
}
