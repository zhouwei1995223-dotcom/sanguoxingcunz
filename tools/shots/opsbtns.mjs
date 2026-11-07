import { startCampaign } from './_lib.mjs';
// 运营能力入口：主界面「推荐」「更新提醒」、设置页「联系客服 / 反馈」、结算页「推荐给好友」（浏览器里用 __clubTest 打开显示）
export default async function ({ page, wait, shot, tap }) {
  await page.evaluate(() => { window.__clubTest = true; });
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(600);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(400);
  await shot('ops_home');
  // 设置页「联系客服 / 反馈」
  const r = await page.evaluate(() => window.__game.scene.sideBtnRect.settings);
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  await tap((r[0] + r[2] / 2) / dpr, (r[1] + r[3] / 2) / dpr);
  await wait(600);
  await shot('ops_settings');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await startCampaign(page); // 出征（按 id 点击，网页版自动选 5 分钟）
  await wait(1200);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.finalBossSec = 50; b.won = true; g.scene.finish(true); });
  await wait(1500);
  await shot('ops_result');
}
