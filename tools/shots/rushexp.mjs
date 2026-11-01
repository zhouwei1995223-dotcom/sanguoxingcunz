// 直取敌将：击败中途敌将前不出现、每局一次、跳过后按经验速度补一半经验
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.startBattle(1); });
  await wait(800);
  // 攻击力调高一些，保证中途敌将在最终敌将登场前被击败
  await page.evaluate(() => { const b = window.__game.scene.battle; b.base.atk *= 4; b.recalc(); });
  // 真打到中途敌将被击败（配合 ?speed=8 加速），升级弹窗随手点掉
  const log = [];
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; b.player.hp = b.player.maxHp; if (g.dialogs.length) { const d = g.dialogs[g.dialogs.length - 1]; if (d.choices && d.scene) { d.scene.choose(d.choices[0]); } g.dialogs.length = 0; } return { t: Math.round(b.t), can: b.canRush(), mid: !!b.midBoss, down: b.midBossDown }; });
    if (s.mid && !log.some((x) => x.mid)) log.push(s);
    if (!s.down && s.can) log.push({ bug: 'can rush before mid boss', ...s });
    if (s.down) { log.push(s); break; }
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(300); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  await wait(200);
  if (shot) await shot('rush_after_mid');
  const r = await page.evaluate(() => {
    const b = window.__game.scene.battle;
    const before = { t: Math.round(b.t), lv: b.level, can: b.canRush() };
    const ok = b.rush();
    return { before, ok, lvAfter: b.level, canAgain: b.canRush(), t: Math.round(b.t) };
  });
  console.log(JSON.stringify(log), JSON.stringify(r));
}
