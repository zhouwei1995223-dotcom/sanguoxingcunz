// 小红书无广告版：首页、商店、签到、巡营、体力、设置、战斗（无充满）、元宝复活、结算
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  const D = async (name, make) => {
    await page.evaluate(make);
    await wait(600);
    await shot('xhs_' + name);
  };
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await shot('xhs_home');
  const mods = await page.evaluate(() => Object.keys(window.__game));
  // 打开各弹窗：通过首页侧边按钮
  const rects = await page.evaluate(() => window.__game.scene.sideBtnRect);
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  for (const id of ['signin', 'patrol', 'settings', 'rank']) {
    await page.evaluate(() => { window.__game.dialogs.length = 0; });
    const r = rects[id];
    if (!r) { console.log('no side btn', id); continue; }
    await tap((r[0] + r[2] / 2) / dpr, (r[1] + r[3] / 2) / dpr);
    await wait(700);
    await shot('xhs_' + id);
  }
  console.log('side ids', Object.keys(rects).join(','));
  // 商店页
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__game.scene.tab = 'shop'; });
  await wait(600);
  await shot('xhs_shop');
  await page.evaluate(() => { const s = window.__game.scene; s.tab = 'hero'; });
  await wait(600);
  await shot('xhs_hero');
  await page.evaluate(() => { const s = window.__game.scene; s.tab = 'talent'; });
  await wait(600);
  await shot('xhs_talent');
  // 战斗
  await page.evaluate(() => { const s = window.__game.scene; s.tab = 'battle'; window.__game.dialogs.length = 0; });
  await wait(400);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(1200);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await shot('xhs_battle');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.player.hp = 0; });
  await wait(1200);
  await shot('xhs_revive');
  const dn = await page.evaluate(() => window.__game.dialogs.map((d) => d.constructor.name).join(','));
  console.log('dialogs', dn);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.finish(false); });
  await wait(1500);
  await shot('xhs_result');
}
