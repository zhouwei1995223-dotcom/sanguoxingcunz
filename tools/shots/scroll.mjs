// 各页签滑动滚动（模拟手指拖动）
export default async function ({ page, wait, shot, tap }) {
  await wait(2700);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  const cdp = await page.context().newCDPSession(page);
  const drag = async (x, y0, y1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
    await wait(50);
    console.log('after start', await page.evaluate(() => { const u = window.__game.ui; return JSON.stringify({ a: u.activeScroll, p: u.pressedId, d: u.pointerDown, regs: u.prevRegions.filter((r) => r.id.startsWith('scroll')).map((r) => [r.id, r.x, r.y, r.w, r.h]) }); }));
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 10, id: 1 }] }); await wait(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(600);
  };
  const tabs = { shop: 39, talent: 273, hero: 351 };
  for (const [name, x] of Object.entries(tabs)) {
    await tap(x, 805); await wait(500);
    await drag(200, 650, 250);
    const off = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__game.ui.scrolls).map(([k, v]) => [k, Math.round(v.offset) + '/' + Math.round(v.max)]))));
    console.log(name, off);
    await shot('scroll_' + name);
  }
}
