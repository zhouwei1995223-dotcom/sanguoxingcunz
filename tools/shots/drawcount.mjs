// 统计一帧里各种绘制调用的次数和覆盖面积（找出最费 GPU 的部分）
export default async function ({ page, wait, tap }) {
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
  for (let i = 0; i < 14; i++) { await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; }); await wait(500); }
  const r = await page.evaluate(() => new Promise((res) => {
    const g = window.__game; g.dialogs.length = 0;
    const ctx = g.ctx; const P = CanvasRenderingContext2D.prototype; const stats = {};
    const names = ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText', 'strokeText', 'measureText', 'save', 'restore', 'createLinearGradient', 'createRadialGradient', 'arc', 'ellipse'];
    const orig = {};
    for (const n of names) { orig[n] = P[n]; P[n] = function (...a) { const s = stats[n] || (stats[n] = { n: 0, area: 0 }); s.n++; if (n === 'drawImage') { const t = this.getTransform(); const w = a.length >= 9 ? a[7] : a.length >= 5 ? a[3] : a[0].width; const h = a.length >= 9 ? a[8] : a.length >= 5 ? a[4] : a[0].height; s.area += Math.abs(w * h * t.a * t.d); } if (n === 'fillRect') { const t = this.getTransform(); s.area += Math.abs(a[2] * a[3] * t.a * t.d); } return orig[n].apply(this, a); }; }
    let frames = 0;
    const tick = () => { const bb = g.scene.battle; g.dialogs.length = 0; bb.pendingLevelUps = 0; bb.pendingChests.length = 0; if (bb.pendingStrats) bb.pendingStrats.length = 0; if (++frames < 31) requestAnimationFrame(tick); else { for (const n of names) P[n] = orig[n]; for (const k in stats) { stats[k].n = Math.round(stats[k].n / 30); stats[k].area = Math.round(stats[k].area / 30 / (ctx.canvas.width * ctx.canvas.height) * 100) / 100; } res({ stats, enemies: g.scene.battle.enemies.filter((e) => !e.dead).length, fx: g.scene.battle.fx.length, projs: g.scene.battle.projs.length, canvas: [ctx.canvas.width, ctx.canvas.height] }); } };
    requestAnimationFrame(tick);
  }));
  console.log(JSON.stringify(r, null, 1));
}
