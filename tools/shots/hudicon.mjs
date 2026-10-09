// 战斗 HUD 击杀图标 + 鹰羽兵法卡片
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(1500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await shot('hud_kills');
  await page.evaluate(() => {
    const g = window.__game; const s = g.scene; g.dialogs.length = 0;
    s.openLevelUpForTest([{ kind: 'passive', id: 'wine', lv: 1, isNew: true }, { kind: 'weapon', id: 'knife', lv: 1, isNew: true }, { kind: 'passive', id: 'tiger', lv: 1, isNew: true }]);
  });
  await wait(700);
  await shot('hud_feather');
}
