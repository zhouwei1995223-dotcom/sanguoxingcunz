// 守城模式界面：召唤武将弹窗、军令卡 / 联动卡、结算
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => {
    const g = window.__game; const sv = window.__saveMod.save; g.dialogs.length = 0;
    for (const id of ['guanyu', 'lvbu', 'zhuge']) { sv.heroes[id].owned = true; sv.heroes[id].star = 3; sv.heroes[id].lv = 20; }
    g.scene.startBattle(-3);
  });
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.def.grain = 600; b.t = 60; });
  await wait(600);
  await page.evaluate(() => { const g = window.__game; g.ui.clickedId = 'def_hero'; });
  await wait(600);
  await shot('def2_herodlg');
  await page.evaluate(() => { const g = window.__game; g.ui.clickedId = 'hsum_lvbu'; });
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.ui.clickedId = 'def_spear'; });
  await wait(200);
  await page.evaluate(() => { const g = window.__game; g.ui.clickedId = 'def_spear'; });
  await wait(2500);
  await shot('def2_summoned');
  // 军令卡 + 联动卡
  await page.evaluate(() => {
    const g = window.__game; const b = g.scene.battle;
    b.def.orders.o_spear = 5; b.def.orders.c_spike = 1; b.def.orders.c_tower = 2;
    g.scene.openLevelUpForTest([{ kind: 'link', id: 'l_phalanx' }, { kind: 'order', id: 'o_archer', lv: 1, isNew: true }, { kind: 'order', id: 'c_tower', lv: 3, isNew: false }]);
  });
  await wait(900);
  await shot('def2_cards');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.applyChoice({ kind: 'link', id: 'l_phalanx' }); b.applyChoice({ kind: 'order', id: 'c_log', lv: 3, isNew: false }); b.applyChoice({ kind: 'order', id: 'o_xbow', lv: 1, isNew: true }); b.def.grain = 600; });
  await wait(300);
  for (const id of ['def_spear', 'def_xbow']) { await page.evaluate((id) => { window.__game.ui.clickedId = id; }, id); await wait(300); }
  await wait(4000);
  await shot('def2_battle');
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.t = 299.5; });
  await wait(4500);
  await shot('def2_result');
}
