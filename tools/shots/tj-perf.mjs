// 天机签后期卡顿排查：CPU 降速 4 倍，造一个后期局面（8 分钟、所有通用兵器 + 专属兵器满级进化、兵法满级），
// 统计每帧 战斗逻辑 / 世界绘制 / 整帧 耗时和场上物体数量；NOMINIFY=1 构建后 PROF=1 输出函数采样。
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => { const s = window.__saveMod.save; window.__game.dialogs.length = 0; s.homeMode = 'tianji'; s.stamina = 99; });
  await wait(300);
  const p = await page.evaluate(() => { const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === 'tj_start'), c = document.querySelector('canvas').getBoundingClientRect(); return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H]; });
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__game.scene.battle?.tj);
  await page.evaluate(() => {
    const g = window.__game, b = g.scene.battle;
    g.dialogs.length = 0;
    b.player.maxHp = b.player.hp = 1e9;
    for (const id of ['crossbow', 'horse', 'fire', 'aura', 'rock', 'knife', 'catapult', 'thunder', 'caltrop', 'drum', 'halberd']) if (!b.weapon(id)) b.addWeapon(id);
    for (const w of b.weapons) { w.lv = 5; b.applyChoice({ kind: 'evo', id: w.id }); }
    for (const id of ['tiger', 'book', 'flag', 'map', 'pouch', 'seal', 'wine', 'lingzhi', 'armor', 'horseshoe']) b.passives.push({ id, lv: 5 });
    b.recalc();
    b.t = 470;
    b.tj.tickets = 0; b.tj.freeT = 999;
  });
  // 让它打一会儿，场面铺开
  for (let i = 0; i < 16; i++) { await page.evaluate(() => { const g = window.__game, b = g.scene.battle; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.tj.tickets = 0; }); await wait(500); }
  console.log('state', JSON.stringify(await page.evaluate(() => { const s = window.__game.scene, b = s.battle; return { paused: s.paused, dlg: window.__game.dialogs.map((d) => d.constructor.name), hitStop: b.hitStop, dead: b.dead, won: b.won, t: b.t, ult: !!b.ult, speedAd: s.speedAdPending }; })));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
  if (process.env.PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 300 }); await cdp.send('Profiler.start'); }
  const r = await page.evaluate(() => new Promise((res) => {
    const g = window.__game, s = g.scene, b = s.battle, rd = s.renderer;
    const ou = b.update.bind(b), orr = rd.render.bind(rd), of = g.frame.bind(g);
    let tu = 0, tr = 0, tf = 0, n = 0, maxF = 0;
    b.update = (dt) => { const t0 = performance.now(); ou(dt); tu += performance.now() - t0; };
    rd.render = (...a) => { const t0 = performance.now(); orr(...a); tr += performance.now() - t0; };
    g.frame = (dt) => { const t0 = performance.now(); of(dt); const d = performance.now() - t0; tf += d; maxF = Math.max(maxF, d); };
    const w0 = performance.now();
    const tick = () => { g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.tj.tickets = 0;
      if (++n < 120) requestAnimationFrame(tick);
      else { b.update = ou; rd.render = orr; g.frame = of;
        const texts = b.fx.filter((f) => f.kind === 'text').length;
        res({ update: +(tu / n).toFixed(1), render: +(tr / n).toFixed(1), frame: +(tf / n).toFixed(1), maxFrame: +maxF.toFixed(0), wall: +((performance.now() - w0) / n).toFixed(1),
          enemies: b.enemies.filter((e) => !e.dead).length, enemiesArr: b.enemies.length, projs: b.projs.length, fx: b.fx.length, texts, pickups: b.pickups.length, dmgNums: (b.dmgTexts || b.numbers || []).length, weapons: b.weapons.length, fields: (b.fields || b.oil || []).length });
      } };
    requestAnimationFrame(tick);
  }));
  console.log('perf', JSON.stringify(r));
  console.log('fx kinds', JSON.stringify(await page.evaluate(() => new Promise((res) => { const b = window.__game.scene.battle, acc = {}; let n = 0; const tick = () => { for (const f of b.fx) acc[f.kind] = (acc[f.kind] || 0) + 1; if (++n < 30) requestAnimationFrame(tick); else { for (const k in acc) acc[k] = Math.round(acc[k] / n); res(acc); } }; requestAnimationFrame(tick); }))));
  if (process.env.ABLATE) {
    // 逐项去掉，看每帧少多少：地上的金币宝石 / 多余兵器 / 敌人 / 特效与投射物
    const measure = (label, fn) => page.evaluate(({ label, fn }) => new Promise((res) => {
      const g = window.__game, b = g.scene.battle; (new Function('b', fn))(b);
      const of = g.frame.bind(g); let tf = 0, n = 0;
      g.frame = (dt) => { const t0 = performance.now(); of(dt); tf += performance.now() - t0; };
      const w0 = performance.now();
      const tick = () => { g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; b.tj.tickets = 0; (new Function('b', fn))(b);
        if (++n < 60) requestAnimationFrame(tick); else { g.frame = of; res(label + ' frame=' + (tf / n).toFixed(1) + 'ms wall=' + ((performance.now() - w0) / n).toFixed(1) + 'ms'); } };
      requestAnimationFrame(tick);
    }), { label, fn });
    console.log(await measure('baseline', ''));
    console.log(await measure('no pickups', 'b.pickups.length = 0;'));
    console.log(await measure('no fx/projs', 'b.fx.length = 0; b.projs.length = 0;'));
    console.log(await measure('1 weapon', 'if (b.weapons.length > 1) b.weapons.splice(1); b.fx.length = 0; b.projs.length = 0;'));
    console.log(await measure('no enemies', 'for (const e of b.enemies) e.dead = true; b.enemies.length = 0;'));
  }
  console.log('calls/frame', JSON.stringify(await page.evaluate(() => new Promise((res) => {
    const P = CanvasRenderingContext2D.prototype, names = ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText', 'arc', 'ellipse', 'save', 'createLinearGradient', 'createRadialGradient'], orig = {}, c = {};
    let lighter = 0; const desc = Object.getOwnPropertyDescriptor(P, 'globalCompositeOperation');
    Object.defineProperty(P, 'globalCompositeOperation', { get() { return desc.get.call(this); }, set(v) { if (v === 'lighter') lighter++; desc.set.call(this, v); }, configurable: true });
    for (const n of names) { orig[n] = P[n]; P[n] = function (...a) { c[n] = (c[n] || 0) + 1; return orig[n].apply(this, a); }; }
    let f = 0; const tick = () => { if (++f < 11) requestAnimationFrame(tick); else { for (const n of names) P[n] = orig[n]; Object.defineProperty(P, 'globalCompositeOperation', desc); for (const k in c) c[k] = Math.round(c[k] / 10); c.lighter = Math.round(lighter / 10); res(c); } };
    requestAnimationFrame(tick);
  }))));
  if (process.env.CALLERS) {
    const top = await page.evaluate(() => new Promise((res) => {
      const P = CanvasRenderingContext2D.prototype, of = P.fillRect, by = {}; let calls = 0;
      P.fillRect = function (...a) { calls++; const st = new Error().stack.split('\n').slice(2, 5).map((l) => l.trim().replace(/\(?https?:\/\/[^/]+\//, '').replace(/\)$/, '')).join(' < '); by[st] = (by[st] || 0) + 1; return of.apply(this, a); };
      let f = 0; const tick = () => { if (++f < 6) requestAnimationFrame(tick); else { P.fillRect = of; res({ perFrame: Math.round(calls / 5), top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => Math.round(v / 5) + ' ' + k) }); } };
      requestAnimationFrame(tick);
    }));
    console.log('fillRect/frame', top.perFrame); top.top.forEach((l) => console.log('  ', l));
  }
  if (process.env.PROF) {
    const { profile } = await cdp.send('Profiler.stop');
    const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = {}; let i = 0;
    for (const sid of profile.samples) { const n = byId.get(sid); const k = (n.callFrame.functionName || '(anon)') + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + (profile.timeDeltas[i++] || 0) / 1000; }
    Object.entries(self).filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(([k, v]) => console.log(Math.round(v) + 'ms', k));
  }
}
