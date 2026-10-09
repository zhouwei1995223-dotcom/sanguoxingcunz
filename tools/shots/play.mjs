// 自动游玩：键盘绕圈移动，自动选第一项，记录各种弹窗
export default async function ({ page, wait, shot, tap }) {
  await wait(2600);
  await tap(280, 563); // 同意隐私
  await wait(800);
  const keys = ['w', 'd', 's', 'a'];
  let k = 0;
  const seen = {};
  for (let i = 0; i < 400; i++) {
    const dlg = await page.evaluate(() => { const g = window.__game; return g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : ''; });
    if (dlg) {
      if (!seen[dlg] || seen[dlg] < 2) { seen[dlg] = (seen[dlg] || 0) + 1; await wait(900); await shot('play_' + dlg + '_' + seen[dlg]); }
      if (dlg === 'LevelUpDialog') { await wait(300); await tap(195, 300); }
      else if (dlg === 'ChestDialog') { await wait(1800); await tap(195, 780); await page.evaluate(() => { const g = window.__game; const d = g.dialogs[g.dialogs.length-1]; if (d && d.constructor.name==='ChestDialog' && d.t>1.6) d.closed = true; }); }
      else if (dlg === 'BossIntroDialog') { await wait(2300); }
      else if (dlg === 'ReviveDialog') { await shot('play_revive'); await page.evaluate(() => { const g = window.__game; g.scene.revive(); g.dialogs.pop(); }); }
      else if (dlg === 'ResultDialog') { await wait(1500); await shot('play_result'); break; }
      else { await wait(500); }
      continue;
    }
    await page.keyboard.up(keys[(k + 3) % 4]);
    await page.keyboard.down(keys[k % 4]);
    k++;
    await wait(350);
    if (i % 40 === 0) await shot('play_tick_' + i);
  }
  const info = await page.evaluate(() => { const b = window.__game.scene.battle; return b ? { t: b.t, lv: b.level, kills: b.kills, w: b.weapons.map(w => w.id + (w.evo ? '*' : w.lv)), p: b.passives.map(p => p.id + p.lv) } : null; });
  console.log(JSON.stringify(info));
  console.log(JSON.stringify(seen));
}
