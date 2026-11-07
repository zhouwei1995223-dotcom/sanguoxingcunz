// 开局奇遇三选一 + 暂停页显示已选奇遇
export default async function ({ page, wait, shot, tap }) {
  // 按按钮 / 卡片 id 点击（界面改版后坐标会变，固定坐标容易失效）
  const clickId = async (id) => {
    await page.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id, { timeout: 8000 });
    const p = await page.evaluate((id) => {
      const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(...p);
    await wait(150);
  };
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await clickId('start_battle'); // 出征
  // 网页版出征前先选对局时长（5 / 10 分钟）
  if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await clickId('duration_5');
  else { await wait(300); if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await clickId('duration_5'); }
  await wait(1200);
  const dlg = await page.evaluate(() => { const g = window.__game; return g.dialogs.map((d) => d.constructor.name).join(','); });
  console.log('dialogs', dlg);
  await shot('qiyu_pick');
  await clickId('qiyu_0'); // 第一张卡
  await wait(500);
  const q = await page.evaluate(() => window.__game.scene.battle.qiyu);
  console.log('qiyu', q);
  await page.evaluate(() => { const s = window.__game.scene; s.onHide(); });
  await wait(600);
  await shot('qiyu_pause');
}
