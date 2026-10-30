// 开局奇遇三选一 + 暂停页显示已选奇遇
export default async function ({ page, wait, shot, tap }) {
  await wait(2600);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await tap(195, 722); // 出征
  await wait(1200);
  const dlg = await page.evaluate(() => { const g = window.__game; return g.dialogs.map((d) => d.constructor.name).join(','); });
  console.log('dialogs', dlg);
  await shot('qiyu_pick');
  await tap(195, 260); // 第一张卡
  await wait(500);
  const q = await page.evaluate(() => window.__game.scene.battle.qiyu);
  console.log('qiyu', q);
  await page.evaluate(() => { const s = window.__game.scene; s.onHide(); });
  await wait(600);
  await shot('qiyu_pause');
}
