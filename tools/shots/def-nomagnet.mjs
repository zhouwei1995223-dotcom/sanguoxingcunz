import assert from 'node:assert/strict';
// 守城没有磁石（经验自动吸取）；征战仍会掉。Q='?skip=1' node tools/shot.mjs def-nomagnet
export default async function ({ page, wait }) {
  const run = async (id, arg) => {
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
    await page.evaluate(([id, arg]) => { const g = window.__game; g.dialogs.length = 0; window.__saveMod.save.stamina = 99; g.scene.startBattle(id, arg, 5); }, [id, arg]);
    await page.waitForFunction(() => window.__game.scene.battle);
    return page.evaluate(() => {
      const b = window.__game.scene.battle;
      b.player.maxHp = b.player.hp = 1e9; if (b.def) b.def.cityHp = b.def.cityMax = 1e9;
      b.dropPickup('magnet', b.player.x + 20, b.player.y, 1);
      // 打破所有灯笼 / 粮车多次，跑一段时间（含磁石保底）
      let breaks = 0;
      for (let i = 0; i < 9000; i++) {
        window.__game.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0;
        if (b.breakables.length && i % 30 === 0) { const k = b.breakables[0]; b.breakAt ? b.breakAt(k.x, k.y - 6, 10) : null; breaks++; }
        b.update(1 / 60);
        if (b.dead || b.won) break;
      }
      return { magnets: b.pickups.filter((k) => k.kind === 'magnet').length, t: Math.round(b.t), kills: b.kills };
    });
  };
  const d = await run(-3, 1);
  console.log('defense', JSON.stringify(d));
  assert.equal(d.magnets, 0);
  await page.reload();
  const c = await run(1, 0);
  console.log('campaign', JSON.stringify(c));
  assert.ok(c.magnets >= 1, 'campaign still has magnets');
  console.log('def-nomagnet ok');
}
