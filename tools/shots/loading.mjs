// 加载页：CPU 降速 4 倍，加载途中截图，并记录进度条是否单调前进、何时自动进入
export default async function ({ page, wait, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => { window.__prog = []; const tick = () => { const s = window.__game?.scene; if (s && s.constructor.name === 'LoadingScene') window.__prog.push(Math.round(s.shown * 100)); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'LoadingScene' && window.__game.scene.shown > 0.3);
  await shot('loading-mid');
  await page.waitForFunction(() => window.__game?.scene?.constructor.name !== 'LoadingScene', null, { timeout: 30000 });
  const p = await page.evaluate(() => window.__prog);
  const mono = p.every((v, i) => i === 0 || v >= p[i - 1]);
  console.log('progress frames', p.length, 'monotonic', mono, 'samples', JSON.stringify(p.filter((_, i) => i % 3 === 0)));
}
