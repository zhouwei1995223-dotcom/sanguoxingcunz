// 卡顿对比：主界面 / 征战 / 布阵各测 120 帧的平均每帧耗时（毫秒，CPU 降速 THROTTLE 倍）和每帧绘制调用次数。
// 用法：ROOT=dist/xhs Q='?skip=1' node tools/shot.mjs perfcmp（ROOT 换成旧版构建目录即可对比）
import { startCampaign } from './_lib.mjs';

const NAMES = ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText', 'strokeText', 'measureText', 'createLinearGradient', 'createRadialGradient', 'createPattern', 'getImageData', 'putImageData', 'clip', 'save'];

async function measure(page, label, keep) {
  const r = await page.evaluate(({ NAMES, keep }) => new Promise((res) => {
    const g = window.__game; const P = CanvasRenderingContext2D.prototype; const stats = {}; const orig = {};
    for (const n of NAMES) { orig[n] = P[n]; if (!orig[n]) continue; P[n] = function (...a) { stats[n] = (stats[n] || 0) + 1; return orig[n].apply(this, a); }; }
    const of = g.frame.bind(g); let tf = 0, mx = 0;
    g.frame = (dt) => { const t0 = performance.now(); of(dt); const d = performance.now() - t0; tf += d; if (d > mx) mx = d; };
    let frames = 0; const t0 = performance.now();
    const clear = () => { if (!keep) return; g.dialogs.length = 0; const b = g.scene.battle; if (b) { b.pendingLevelUps = 0; if (b.pendingChests) b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; } };
    const tick = () => { clear(); if (++frames < 120) requestAnimationFrame(tick); else {
      for (const n of NAMES) if (orig[n]) P[n] = orig[n];
      g.frame = of;
      const calls = {}; for (const k in stats) calls[k] = Math.round(stats[k] / frames);
      res({ frameMs: +(tf / frames).toFixed(2), maxMs: +mx.toFixed(1), wallMs: +((performance.now() - t0) / frames).toFixed(1), calls });
    } };
    requestAnimationFrame(tick);
  }), { NAMES, keep });
  console.log(label, JSON.stringify(r));
}

export default async function ({ page, wait }) {
  if (process.env.MODE === 'tower') {
    // 网页版 Q='?skip=1&tower=2'：直接进布阵，战斗 8 秒后测
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'TowerScene');
    const cdp = await page.context().newCDPSession(page);
    await page.waitForTimeout(8000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
    if (process.env.NOTC) await page.evaluate(() => { window.__game.ui.textCache.disabledUntil = Infinity; });
    await page.evaluate(() => { window.__game.scene.battle.offer = null; });
    await measure(page, 'tower', false);
    return;
  }
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(800);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
  await wait(500);
  if (process.env.NOTC) await page.evaluate(() => { const tc = window.__game.ui.textCache; if (tc) tc.disabledUntil = Infinity; });
  await measure(page, 'home', false);
  const mode = process.env.MODE || 'all';
  if (mode === 'all' || mode === 'battle') {
    await startCampaign(page);
    await page.waitForFunction(() => window.__game.scene.battle);
    await page.evaluate(() => { const b = window.__game.scene.battle; b.player.maxHp = b.player.hp = 1e9; b.t = 200; });
    for (let i = 0; i < 8; i++) { await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; }); await wait(400); }
    await measure(page, 'battle', true);
  }
}
