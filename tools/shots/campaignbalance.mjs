// Q='?skip=1' node tools/shot.mjs campaignbalance
import assert from 'node:assert/strict';

export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => {
    const g = window.__game;
    g.closeAll();
    g.scene.startBattle(1, 0, 5);
  });
  await page.waitForFunction(() => window.__game?.scene?.battle);
  const result = await page.evaluate(() => {
    const sample = window.__game.scene.battle;
    const Battle = sample.constructor;
    const make = () => new Battle({ ...sample.chapter, waves: [], events: [] }, { ...sample.base, hp: 10000 }, 320, 568);
    function spawnStats(ratio, crowded) {
      const b = make();
      b.powerRatio = ratio;
      b.t = 220;
      b.targetDensity = 32;
      if (crowded) for (let i = 0; i < 10; i++) b.spawnEnemy('wei_spear', 0, 0);
      for (let i = 0; i < 50; i++) b.updateDirector(1);
      const mob = b.spawnEnemy('wei_spear', 0, 0);
      const elite = b.spawnEnemy('wei_heavy', 0, 0, { elite: true });
      const boss = b.spawnBoss(b.chapter.boss, 100, 100, true);
      return [mob.hp, mob.exp, elite.hp, boss.hp];
    }
    function runPastBoss(turn, final = true) {
      const b = make();
      const e = b.spawnBoss(b.chapter.boss, -500, 0, final);
      e.stateT = 100; // 单独观察截击，避免其他首领技能造成伤害。
      b.weapons.length = 0;
      b.moveX = 1;
      const casts = [];
      b.hooks.banner = msg => { if (msg.includes('截击')) casts.push(b.t); };
      for (let frame = 0; frame < 16.5 * 30; frame++) {
        if (turn && casts.length) { b.moveX = 0; b.moveY = casts.length === 1 ? 1 : -1; }
        b.update(1 / 30);
      }
      return { casts, damage: b.statDmgTaken };
    }
    return {
      low: spawnStats(0.5, false), high: spawnStats(3, true),
      straight: runPastBoss(false), dodge: runPastBoss(true), mid: runPastBoss(false, false),
    };
  });
  assert.deepEqual(result.low, result.high);
  assert.equal(result.straight.casts.length, 2);
  assert.ok(result.straight.casts[0] >= 5 && result.straight.casts[0] < 5.1);
  assert.ok(result.straight.casts[1] - result.straight.casts[0] >= 10);
  assert.ok(result.straight.damage > 0);
  assert.equal(result.dodge.damage, 0);
  assert.deepEqual(result.mid.casts, []);

  await page.evaluate(() => {
    const g = window.__game, b = g.scene.battle;
    g.closeAll();
    b.spawnBoss(b.chapter.boss, b.player.x - 140, b.player.y, true);
    g.closeAll();
    b.moveX = 1;
    for (let i = 0; i < 5.15 * 30; i++) b.update(1 / 30);
    g.scene.paused = true;
  });
  await wait(100);
  await shot('campaign_intercept');
}
