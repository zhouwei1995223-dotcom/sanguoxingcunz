// 快速上划 / 下划后列表的最大越界量（设计单位）。Q='?skip=1' node tools/shot.mjs scroll-fling
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(600);
  await page.evaluate(() => { window.__game.closeAll ? window.__game.closeAll() : (window.__game.dialogs.length = 0); window.__game.scene.tab = 'shop'; });
  await wait(500);
  const reg = await page.evaluate(() => { const ui = window.__game.ui; const r = ui.prevRegions.find((v) => v.id.startsWith('scroll:')); const c = document.querySelector('canvas').getBoundingClientRect(); return r && { id: r.id.slice(7), x: c.x + (r.x + r.w / 2) * c.width / ui.W, y0: c.y + (r.y + r.h * 0.8) * c.height / ui.H, y1: c.y + (r.y + r.h * 0.2) * c.height / ui.H }; });
  if (!reg) { console.log('no scroll region'); return; }
  const track = () => page.evaluate((id) => new Promise((res) => { const ui = window.__game.ui; const s = ui.scrolls[id]; let lo = 0, hi = 0, f = 0; const tick = () => { lo = Math.min(lo, s.offset); hi = Math.max(hi, s.offset - s.max); if (++f < 90) requestAnimationFrame(tick); else res({ max: Math.round(s.max / ui.u), overTop: Math.round(-lo / ui.u), overBottom: Math.round(hi / ui.u), end: Math.round(s.offset / ui.u) }); }; requestAnimationFrame(tick); }), reg.id);
  const fling = async (from, to) => { await page.mouse.move(reg.x, from); await page.mouse.down(); for (let i = 1; i <= 4; i++) { await page.mouse.move(reg.x, from + (to - from) * i / 4); await wait(16); } await page.mouse.up(); };
  // 下拉（列表顶部再往下拉）
  const p1 = track(); await fling(reg.y1, reg.y0); console.log('pull down', JSON.stringify(await p1));
  // 上划到底再继续上划
  for (let i = 0; i < 3; i++) { await fling(reg.y0, reg.y1); await wait(200); }
  const p2 = track(); await fling(reg.y0, reg.y1); console.log('push up', JSON.stringify(await p2));
  await shot('scroll-fling');
}
