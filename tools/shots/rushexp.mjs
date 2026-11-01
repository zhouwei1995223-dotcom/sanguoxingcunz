// 直取敌将：2:30 前不出现、每局一次、跳过后按经验速度补一半经验（开局刚打一会儿也有）
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.startBattle(1); });
  await wait(800);
  // 真打到 2:30（配合 ?speed=8 加速），升级弹窗随手点掉
  for (let i = 0; i < 200; i++) {
    const t = await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; b.player.hp = b.player.maxHp; if (g.dialogs.length) { const d = g.dialogs[g.dialogs.length - 1]; if (d.choices && d.scene) { d.scene.choose(d.choices[0]); } g.dialogs.length = 0; } return b.t; });
    if (t >= 150) break;
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(300); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  const r = await page.evaluate(() => {
    const b = window.__game.scene.battle;
    const before = { t: Math.round(b.t), lv: b.level, can: b.canRush() };
    const can151 = b.canRush();
    const lv0 = b.level, exp0 = b.exp;
    const ok = b.rush();
    return { before, can151, ok, lvBefore: lv0, lvAfter: b.level, expBefore: Math.round(exp0), canAgain: b.canRush(), t: Math.round(b.t) };
  });
  console.log(JSON.stringify(r));
}
