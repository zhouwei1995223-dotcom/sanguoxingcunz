// CPU 采样：主界面（或 MODE=battle 征战）停留 4 秒，按函数自身耗时排序（需 NOMINIFY=1 构建）
import { startCampaign } from './_lib.mjs';
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(1200);
  if (process.env.CLOSE) await page.evaluate(() => { window.__game.dialogs.length = 0; });
  if (process.env.MODE === 'battle') {
    await startCampaign(page);
    await page.waitForFunction(() => window.__game.scene.battle);
    await page.evaluate(() => { const b = window.__game.scene.battle; b.player.maxHp = b.player.hp = 1e9; b.t = 200; });
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; }); await wait(300); }
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await wait(4000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = {}; const total = profile.samples.length;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const cnt = {}; for (const s of profile.samples) cnt[s] = (cnt[s] || 0) + 1;
  for (const [id, c] of Object.entries(cnt)) { const n = byId.get(+id); const k = (n.callFrame.functionName || '(anon)') + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + c; }
  Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log((v / total * 100).toFixed(1) + '%', k));
}
