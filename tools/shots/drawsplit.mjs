// 一帧里贴图调用的来源：地面 / 装饰 / 敌人 / 特效 / 界面
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__game.scene.startBattle(1); });
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    b.base.atk = 3; b.player.maxHp = b.player.hp = 1e9; b.base.hp = 1e9;
    ['sword', 'crossbow', 'horse', 'fire', 'aura'].forEach((id) => b.addWeapon(id));
    b.weapons.forEach((w) => { w.lv = 5; w.evo = true; });
    b.recalc(); b.t = 560; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 535);
  });
  for (let i = 0; i < 16; i++) { await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.pendingStrats.length = 0; }); await page.keyboard.down('d'); await wait(400); await page.keyboard.up('d'); }
  console.log(JSON.stringify(await page.evaluate(() => new Promise((res) => {
    const g = window.__game; const s = g.scene; const rd = s.renderer; const b = s.battle;
    const P = CanvasRenderingContext2D.prototype; const od = P.drawImage; let phase = 'ui'; const cnt = {};
    P.drawImage = function (...a) { cnt[phase] = (cnt[phase] || 0) + 1; return od.apply(this, a); };
    const wrap = (name) => { const o = rd[name].bind(rd); rd[name] = (...a) => { const prev = phase; phase = name; const r = o(...a); phase = prev; return r; }; };
    ['drawEnemy', 'drawPlayer', 'drawFx'].forEach(wrap);
    const names = {}; const ob = rd.blit.bind(rd);
    rd.blit = (sp, x, y) => { if (phase === 'world') { const k = (sp.key || '?').replace(/[0-9_]+$/, '').slice(0, 18); names[k] = (names[k] || 0) + 1; } return ob(sp, x, y); };
    const orr = rd.render.bind(rd); rd.render = (...a) => { phase = 'world'; const r = orr(...a); phase = 'ui'; return r; };
    let f = 0;
    const tick = () => { g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (++f < 31) requestAnimationFrame(tick); else { P.drawImage = od; for (const k in cnt) cnt[k] = Math.round(cnt[k] / 30); const fx = {}; for (const x of b.fx) fx[x.kind] = (fx[x.kind] || 0) + 1; for (const k in names) names[k] = Math.round(names[k] / 30); res({ cnt, names, fx, pickups: b.pickups.length, onScreen: b.enemies.filter((e) => !e.dead && b.inView(e.x, e.y, 20)).length }); } };
    requestAnimationFrame(tick);
  }))));
}
