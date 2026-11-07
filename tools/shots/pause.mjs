// 战斗暂停界面与隐私弹窗
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
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await clickId('start_battle'); // 出征
  // 网页版出征前先选对局时长（5 / 10 分钟）
  if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await clickId('duration_5');
  else { await wait(300); if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await clickId('duration_5'); }
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => { const b = window.__game.scene.battle; window.__game.dialogs.length = 0; ['sword', 'fire'].forEach((id) => b.addWeapon(id)); b.passives.push({ id: 'tiger', lv: 2 }); b.recalc(); b.t = 90; });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { window.__game.dialogs.length = 0; }); await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(300); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]); }
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.pauseForTest(); });
  await wait(500);
  await shot('pause');
}
