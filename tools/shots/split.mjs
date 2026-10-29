// 怪多时每帧耗时拆分：战斗逻辑 update 与画面 render 各占多少（毫秒，CPU 降速 THROTTLE 倍）
export default async function ({ page, wait, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__game.scene.startBattle(1); });
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
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
  for (let i = 0; i < 12; i++) { await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.pendingStrats.length = 0; }); await wait(500); }
  const r = await page.evaluate(() => new Promise((res) => {
    const g = window.__game; const s = g.scene; const b = s.battle; const rd = s.renderer;
    const ou = b.update.bind(b), orr = rd.render.bind(rd), os = s.update.bind(s), of = g.frame.bind(g);
    let tu = 0, tr = 0, ts = 0, tf = 0, n = 0, nu = 0;
    s.update = (dt) => { const t0 = performance.now(); os(dt); ts += performance.now() - t0; };
    g.frame = (dt) => { const t0 = performance.now(); of(dt); tf += performance.now() - t0; };
    b.update = (dt) => { const t0 = performance.now(); ou(dt); tu += performance.now() - t0; nu++; };
    rd.render = (...a) => { const t0 = performance.now(); orr(...a); tr += performance.now() - t0; };
    let frames = 0; const t0 = performance.now();
    const tick = () => { g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (++frames < 120) requestAnimationFrame(tick); else res({ update: tu / frames, render: tr / frames, scene: ts / frames, gameFrame: tf / frames, frame: (performance.now() - t0) / frames, enemies: b.enemies.filter((e) => !e.dead).length, fx: b.fx.length, projs: b.projs.length }); };
    requestAnimationFrame(tick);
  }));
  console.log(JSON.stringify(r));
}
