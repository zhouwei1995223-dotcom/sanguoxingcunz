// Q='?skip=1' node tools/shot.mjs convoys
import assert from 'node:assert/strict';

export default async function ({ page }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => {
    window.__game.closeAll();
    window.__game.scene.startBattle(1, 0, 5);
  });
  await page.waitForFunction(() => window.__game.scene.battle?.convoyTimes.length === 3);
  const result = await page.evaluate(() => {
    const scene = window.__game.scene, b = scene.battle;
    scene.paused = true;
    window.__game.closeAll();
    b.weapons = [];
    let captures = 0;
    const wallet = window.__saveMod.save;
    const initialGold = wallet.gold, initialYuanbao = wallet.yuanbao;
    const onCapture = b.hooks.convoyCaptured;
    b.hooks = { ...b.hooks, convoyCaptured: () => { captures++; onCapture(); }, bossAppear() {}, banner() {} };
    const schedule = b.convoyTimes.slice();
    const arrive = due => {
      b.t = due - 0.01;
      b.update(0.02);
      return b.convoy;
    };
    const kill = e => b.damage(e, 1e12, 0, 0, 0, { force: true, noCrit: true });

    const first = arrive(schedule[0]), [guard] = first.guards;
    const quiet = first.guards.every(e => e.elite && !e.convoyGuard.engaged);
    Object.assign(b.player, { x: guard.x - 64, y: guard.y });
    b.damage(guard, 1, 0, 0, 0, { force: true, noCrit: true });
    const from = guard.x;
    b.updateEnemies(0.1);
    const provoked = guard.convoyGuard.engaged && guard.x < from;
    b.player.x -= 200;
    b.updateEnemies(0.1);
    const disengaged = !guard.convoyGuard.engaged;
    b.player.x = guard.x - 35;
    b.updateEnemies(0.01);
    const proximity = guard.convoyGuard.engaged;
    kill(first.guards[0]);
    kill(first.guards[1]);
    const kills = b.kills;
    b.t = first.expiresAt - 0.01;
    b.update(0.02);
    const expired = !b.convoy && first.guards.every(e => e.dead) && b.kills === kills && captures === 0;

    const second = arrive(schedule[1]);
    const mid = b.midBoss || b.spawnBoss(b.chapter.midBoss, 0, 0, false);
    b.killEnemy(mid);
    const survived = second.guards.every(e => !e.dead);
    const drops = b.pickups.length;
    for (const e of second.guards) kill(e);
    b.killEnemy(second.guards[2]);
    const captured = !b.convoy && captures === 1 && b.convoysCaptured === 1 && b.pickups.length === drops;

    const third = arrive(schedule[2]);
    if (b.midBoss) b.killEnemy(b.midBoss);
    const rushed = b.rush() && third.guards.every(e => e.dead) && !b.convoy && captures === 1;
    const pending = wallet.gold === initialGold && wallet.yuanbao === initialYuanbao;
    scene.finish(false);
    const failedLoot = window.__game.dialogs.at(-1).res.convoyLoot;
    const forfeited = failedLoot.count === 1 && failedLoot.gold === 0 && failedLoot.yuanbao === 0;
    return { schedule, quiet, provoked, disengaged, proximity, expired, survived, captured, rushed, pending, forfeited };
  });
  assert.ok(result.schedule.every((at, i) => at > i * 100 && at + 30 < (i + 1) * 100));
  for (const [key, value] of Object.entries(result)) if (key !== 'schedule') assert.equal(value, true, key);

  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => { window.__game.closeAll(); window.__game.scene.startBattle(1, 0, 5); });
  await page.waitForFunction(() => window.__game.scene.battle?.convoyTimes.length === 3);
  const victory = await page.evaluate(() => {
    const g = window.__game, scene = g.scene, b = scene.battle, wallet = window.__saveMod.save;
    g.closeAll();
    scene.paused = true;
    const gold = wallet.gold, yuanbao = wallet.yuanbao;
    b.t = b.convoyTimes[0] - 0.01;
    b.update(0.02);
    for (const guard of b.convoy.guards) b.damage(guard, 1e12, 0, 0, 0, { force: true });
    b.t = b.chapter.duration;
    const boss = b.spawnBoss(b.chapter.boss, b.player.x, b.player.y, true);
    b.damage(boss, 1e12, 0, 0, 0, { force: true });
    g.closeAll();
    scene.finish(b.won);
    const reward = g.dialogs.at(-1).res;
    scene.finish(b.won);
    return { cargo: reward.convoyLoot, paid: [wallet.gold - gold, wallet.yuanbao - yuanbao], total: [reward.gold, reward.yuanbao] };
  });
  assert.deepEqual(victory.cargo, { count: 1, gold: 54, yuanbao: 2 });
  assert.deepEqual(victory.paid, victory.total);
}
