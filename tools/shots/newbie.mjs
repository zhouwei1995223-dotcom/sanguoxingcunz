// 新玩家完整流程
export default async function ({ page, wait, shot, tap }) {
  const W = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 20000 });
  const dlg = () => page.evaluate(() => { const g = window.__game; return g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : ''; });
  await W(() => window.__game && window.__game.dialogs.length && window.__game.dialogs[0].constructor.name === 'PrivacyDialog');
  await wait(400);
  await tap(280, 563);
  await W(() => window.__game.scene.battle);
  await wait(1500);
  // 吃几个经验升到 2 级看引导
  await page.evaluate(() => { const b = window.__game.scene.battle; b.gainExp(6); });
  await wait(600);
  await shot('nb_levelup');
  await tap(195, 300);
  await wait(500);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.player.hp = 0; });
  await W(() => { const g = window.__game; return g.dialogs.length && g.dialogs[0].constructor.name === 'ReviveDialog'; });
  await wait(500);
  await tap(195, 520); // 放弃（无免费复活时第二个按钮）
  await wait(300);
  let d = await dlg();
  if (d === 'ReviveDialog') { await page.evaluate(() => { const g = window.__game; g.scene.finish(false); g.dialogs.shift(); }); }
  await W(() => { const g = window.__game; return g.dialogs.length && g.dialogs[g.dialogs.length - 1].constructor.name === 'ResultDialog'; });
  await wait(1200);
  await shot('nb_result');
  await page.evaluate(() => { const g = window.__game; const r = g.dialogs[g.dialogs.length - 1]; r.t = 5; });
  await tap(195, 580); await wait(300);
  await W(() => window.__game.scene.constructor.name === 'HomeScene');
  await wait(800);
  await shot('nb_home_g1');
  await tap(117, 805); await wait(600); await shot('nb_equip_g2');
  await tap(55, 155); await wait(700); await shot('nb_item');
  await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(300);
  await shot('nb_g3');
  await tap(273, 805); await wait(600); await shot('nb_talent_g4');
  await tap(65, 300); await wait(600); await shot('nb_g5');
  await tap(195, 805); await wait(600); await shot('nb_g6');
  console.log('guide =', await page.evaluate(() => window.__saveMod.save.guide));
}
