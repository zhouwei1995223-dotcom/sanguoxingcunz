// 守城第三轮：右侧只剩粮草 / 自动出兵进度；升级卡里是兵种、建筑、武将、修城；建筑在城边
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => {
    const g = window.__game; const sv = window.__saveMod.save; g.dialogs.length = 0; sv.stamina = 99;
    for (const id of ['lvbu', 'guanyu']) Object.assign(sv.heroes[id], { owned: true, lv: 30, star: 3 });
    g.scene.startBattle(-3, 2);
  });
  await wait(900);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(6000);
  await page.evaluate(() => {
    const sc = window.__game.scene; const b = sc.battle;
    b.def.cityHp = b.def.cityMax * 0.6;
    for (const c of [{ kind: 'build', id: 'tower' }, { kind: 'build', id: 'cata' }, { kind: 'build', id: 'spike' }, { kind: 'build', id: 'tower' }, { kind: 'build', id: 'tower' }]) b.applyChoice(c);
  });
  await wait(1500);
  await shot('defcards_field');
  await page.evaluate(() => {
    const sc = window.__game.scene; const b = sc.battle;
    sc.openLevelUpForTest([{ kind: 'build', id: 'cata', lv: 2, isNew: false }, { kind: 'hero', id: 'lvbu' }, { kind: 'repair' }]);
  });
  await wait(900);
  await shot('defcards_lv');
  const r = await page.evaluate(() => { const b = window.__game.scene.battle; const out = []; for (let i = 0; i < 6; i++) out.push(b.rollChoices().map((c) => c.kind + ':' + (c.id || '')).join(' ')); return out.join('\n'); });
  console.log(r);
}
