// 新手试炼：从隐私弹窗开始，自动走位 + 选技能 + 放大招，看能不能在 75 秒内打完
export default async function ({ page, wait, shot, tap }) {
  const W = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 20000 });
  await W(() => window.__game && window.__game.dialogs.length && window.__game.dialogs[0].constructor.name === 'PrivacyDialog');
  await wait(400);
  await tap(280, 563);
  await W(() => window.__game.scene.battle);
  console.log('label', await page.evaluate(() => window.__game.scene.label), 'duration', await page.evaluate(() => window.__game.scene.chapter.duration));
  const keys = ['d', 's', 'a', 'w'];
  let k = 0, shots = { 5: 0, 25: 0, 34: 0, 45: 0 };
  for (let i = 0; i < 400; i++) {
    const st = await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; return { t: b.t, won: b.won, dead: b.dead, lv: b.level, dlg: g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : '', rage: b.rageFull, boss: b.finalBoss ? Math.round(b.finalBoss.hp) + '/' + b.finalBoss.maxHp : '' }; });
    for (const s in shots) if (!shots[s] && st.t >= +s && !st.dlg) { shots[s] = 1; await shot('tut_' + s + 's'); console.log(JSON.stringify(st)); }
    if (st.won || st.dead) { console.log('END', JSON.stringify(st)); break; }
    if (st.dlg === 'LevelUpDialog') { await wait(400); await tap(195, 300); continue; }
    if (st.dlg === 'BossIntroDialog') { await wait(1200); await shot('tut_boss_intro'); await wait(1500); continue; }
    if (st.dlg) { await wait(300); continue; }
    if (st.rage) await page.keyboard.press(' ');
    await page.keyboard.down(keys[k % 4]); await wait(450); await page.keyboard.up(keys[k % 4]); k++;
  }
  await W(() => { const g = window.__game; return g.dialogs.length && g.dialogs[g.dialogs.length - 1].constructor.name === 'ResultDialog'; });
  await wait(1500);
  await shot('tut_result');
}
