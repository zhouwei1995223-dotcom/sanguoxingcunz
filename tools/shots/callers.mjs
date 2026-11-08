// 按调用位置统计一帧的绘制调用（需 NOMINIFY=1 构建）：FN=fillRect,createLinearGradient MODE=home|battle|tower
import { startCampaign } from './_lib.mjs';
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game && window.__game.scene);
  await wait(1500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  if (process.env.MODE === 'battle') {
    await startCampaign(page);
    await page.waitForFunction(() => window.__game.scene.battle);
    await page.evaluate(() => { const b = window.__game.scene.battle; b.player.maxHp = b.player.hp = 1e9; b.t = 200; });
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; }); await wait(400); }
  }
  await wait(500);
  const fns = (process.env.FN || 'fillRect,createLinearGradient,clip,drawImage').split(',');
  const r = await page.evaluate((fns) => new Promise((res) => {
    const P = CanvasRenderingContext2D.prototype; const orig = {}; const by = {};
    for (const n of fns) { orig[n] = P[n]; P[n] = function (...a) { const st = new Error().stack.split("\n").slice(2, 6).map((l) => l.trim().replace(/\(?https?:\/\/[^/]+\//, '').replace(/\)$/, '')).join(' < '); const k = n + ' @ ' + st; by[k] = (by[k] || 0) + 1; return orig[n].apply(this, a); }; }
    let f = 0; const tick = () => { if (++f < 11) requestAnimationFrame(tick); else { for (const n of fns) P[n] = orig[n]; res(Object.entries(by).map(([k, v]) => [Math.round(v / 10), k]).sort((a, b) => b[0] - a[0]).slice(0, 25)); } };
    requestAnimationFrame(tick);
  }), fns);
  for (const [n, k] of r) console.log(n, k);
}
