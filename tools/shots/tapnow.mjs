// 「推荐」「更新提醒」「游戏圈」这类按钮要在触摸事件里同步调用平台接口（微信要求点击行为触发）。
// 这里包一层 tapNow，记录回调执行时是否还在 touchend 事件里。
export default async function ({ page, wait }) {
  await page.evaluate(() => { window.__clubTest = true; });
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(600);
  const res = await page.evaluate(async () => {
    const g = window.__game; g.dialogs.length = 0;
    window.__log = [];
    const orig = g.ui.tapNow.bind(g.ui);
    g.ui.tapNow = (id, x, y, w, h, fn) => orig(id, x, y, w, h, () => { window.__log.push({ id, inEvt: !!window.__inEvt }); fn(); });
    const c = g.ctx.canvas;
    window.addEventListener('touchend', () => { window.__inEvt = true; }, true);
    window.addEventListener('touchend', () => { window.__inEvt = false; }, false);
    await new Promise((r) => setTimeout(r, 300));
    const dpr = window.devicePixelRatio;
    const out = {};
    for (const id of ['recommend', 'notice', 'club']) {
      const rr = g.scene.sideBtnRect[id];
      if (!rr) { out[id] = 'no button'; continue; }
      const x = (rr[0] + rr[2] / 2) / dpr, y = (rr[1] + rr[3] / 2) / dpr;
      const t = new Touch({ identifier: 7, target: c, clientX: x, clientY: y });
      c.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 100));
      c.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 200));
    }
    return { log: window.__log, dialogs: g.dialogs.length, out };
  });
  console.log(JSON.stringify(res));
}
