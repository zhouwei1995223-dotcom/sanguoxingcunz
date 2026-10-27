// 新手漏斗与报错：首次进入 → 同意隐私 → 第一局 → 升级 → 2:00 → 结束回主城；人为制造一次报错，游戏应继续运行
export default async function ({ page, wait, tap }) {
  await wait(2500);
  await tap(280, 563); // 同意隐私
  await page.waitForFunction(() => window.__game.scene && window.__game.scene.battle, null, { timeout: 15000 });
  await wait(500);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.gainExp(50); });
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.t = 121; });
  await wait(800);
  // 人为在某一帧抛错：游戏应记录并继续
  await page.evaluate(() => { const s = window.__game.scene; const orig = s.update.bind(s); let n = 0; s.update = (dt) => { if (n++ === 0) throw new Error('test boom'); orig(dt); }; });
  await wait(600);
  const alive1 = await page.evaluate(() => window.__game.ui.time);
  await wait(500);
  const alive2 = await page.evaluate(() => window.__game.ui.time);
  console.log('still running after error:', alive2 > alive1);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.finish(false); });
  await wait(1500);
  await page.evaluate(() => { const d = window.__game.dialogs[0]; window.__game.dialogs.length = 0; });
  console.log(JSON.stringify(await page.evaluate(() => ({
    reports: (window.__reports || []).filter((r) => r.event === 'funnel' || r.event === 'login' || r.event === 'js_error').map((r) => r.event + ':' + JSON.stringify(r.data)),
    errors: window.__errors || [],
  })), null, 1));
}
