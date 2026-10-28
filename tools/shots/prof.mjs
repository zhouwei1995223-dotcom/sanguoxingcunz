// CPU 剖析：满武器 + 大量敌人时，各函数占用的时间（自身耗时排行）
import fs from 'node:fs';
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
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
  await wait(6000);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await wait(4000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas; const counts = new Map();
  profile.samples.forEach((s, i) => counts.set(s, (counts.get(s) || 0) + (dt[i] || 0)));
  let total = 0;
  for (const [id, t] of counts) { const n = byId.get(id); const cf = n.callFrame; const k = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + cf.lineNumber + ':' + cf.columnNumber; self.set(k, (self.get(k) || 0) + t); total += t; }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [k, t] of top) console.log((t / total * 100).toFixed(1).padStart(5) + '%  ' + k);
  console.log('enemies', await page.evaluate(() => window.__game.scene.battle.enemies.filter((e) => !e.dead).length));
}
