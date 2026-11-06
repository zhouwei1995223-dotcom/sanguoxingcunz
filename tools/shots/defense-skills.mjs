// Q='?skip=1' node tools/shot.mjs defense-skills
import assert from 'node:assert/strict';

export default async function ({ page }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => {
    window.__game.closeAll();
    window.__game.scene.startBattle(-3, 1);
  });
  await page.waitForFunction(() => window.__game.scene.battle?.def);
  const result = await page.evaluate(() => {
    const scene = window.__game.scene, b = scene.battle, d = b.def;
    window.__game.closeAll();
    scene.paused = true;
    b.weapons.length = 0;
    d.grain = 1600;
    for (let frame = 0; frame < 45; frame++) b.update(1 / 60);
    const army = d.allies.length, grain = d.grain;

    // 玩家守在另一侧。火矢必须瞄准这边的士兵，按落点伤害，允许目标撤离。
    const [front, second, retreat] = d.allies;
    d.allies = [front, second, retreat];
    d.allyGrid.clear();
    for (const [index, ally] of d.allies.entries()) {
      Object.assign(ally, { x: 75 + index * 5, y: 0, hp: 1000, maxHp: 1000 });
      d.allyGrid.insert(ally);
    }
    Object.assign(b.player, { x: -160, y: 40 });
    b.enemies.length = 0;
    b.t = 50;
    const archer = b.spawnEnemy('siege_firebow', 170, 0);
    archer.born = 40;
    b.updateEnemies(0.01);
    const cast = b.warnings.find(w => w.caster === archer);
    b.updateFx(cast.dur / 2);
    const beforeImpact = front.hp;
    retreat.y = 85;
    b.updateFx(cast.dur / 2 + 0.01);
    const afterImpact = d.allies.map(a => a.hp);

    // 施法者阵亡后，原落点不应再造成伤害。
    b.t += 12;
    b.updateEnemies(0.01);
    const next = b.warnings.find(w => w.caster === archer);
    b.killEnemy(archer);
    b.updateFx(next.dur + 0.01);
    const afterCancel = d.allies.map(a => a.hp);

    // 先锋阵亡应保留其他城门的攻城部队。
    const ram = b.spawnEnemy('siege_ram', 210, 0);
    b.killEnemy(b.spawnBoss(b.chapter.midBoss, -160, 0, false));
    return { army, grain, beforeImpact, afterImpact, afterCancel, ramAlive: !ram.dead };
  });
  assert.equal(result.army, 120);
  assert.ok(result.grain >= 0 && result.grain < 40);
  assert.equal(result.beforeImpact, 1000);
  assert.ok(result.afterImpact[0] < 1000 && result.afterImpact[1] < 1000);
  assert.equal(result.afterImpact[2], 1000);
  assert.deepEqual(result.afterCancel, result.afterImpact);
  assert.ok(result.ramAlive);
}
