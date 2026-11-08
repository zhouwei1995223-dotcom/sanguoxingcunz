// 截图脚本共用：按按钮 id 点击（界面改版后固定坐标容易失效）。
export async function clickId(page, id, timeout = 8000) {
  await page.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id, { timeout });
  const p = await page.evaluate((id) => {
    const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
    return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
  }, id);
  await page.mouse.click(...p);
  await page.waitForTimeout(150);
}

/** 主界面点「出征」；网页版会先弹对局时长，选 5 分钟。返回时已进入战斗场景。 */
export async function startCampaign(page) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => { window.__game.dialogs.length = 0; if (window.__saveMod) window.__saveMod.save.homeMode = 'chapter'; });
  await page.waitForTimeout(200);
  await clickId(page, 'start_battle');
  await page.waitForTimeout(250);
  // 还没备战时先弹提醒：直接出征
  if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'prep_rm_skip'))) { await clickId(page, 'prep_rm_skip'); await page.waitForTimeout(250); }
  if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await clickId(page, 'duration_5');
  await page.waitForFunction(() => window.__game.scene.battle, null, { timeout: 8000 });
}
