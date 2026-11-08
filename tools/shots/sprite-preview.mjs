// 把指定精灵放大画在一张图上看效果：NAMES=a,b,c SCALE=6 Q='?skip=1' node tools/shot.mjs sprite-preview
export default async function ({ page, shot }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  const names = (process.env.NAMES || '').split(',').filter(Boolean);
  await page.evaluate(({ names, k }) => {
    const c = document.createElement('canvas'); const per = Number(new URLSearchParams(location.search).get("per") || 6); const cell = 44 * k;
    c.width = Math.min(names.length, per) * cell; c.height = Math.ceil(names.length / per) * cell;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#cdbf9f'; g.fillRect(0, 0, c.width, c.height);
    const sp = window.__atlas.sprite;
    names.forEach((n, i) => { const s = sp(n); const x = (i % per) * cell, y = Math.floor(i / per) * cell; g.drawImage(s.canvas, s.x, s.y, s.w, s.h, x + (cell - s.w * k) / 2, y + (cell - s.h * k) / 2, s.w * k, s.h * k); });
    document.body.innerHTML = ''; document.body.style.background = '#cdbf9f'; document.body.appendChild(c);
  }, { names, k: Number(process.env.SCALE || 6) });
  await page.setViewportSize({ width: 1400, height: 900 });
  await shot(process.env.NAME || 'sprite-preview');
}
