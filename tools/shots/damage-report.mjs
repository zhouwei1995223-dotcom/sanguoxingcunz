// Q='?skip=1' node tools/shot.mjs damage-report
import assert from 'node:assert/strict';

export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => {
    const g = window.__game;
    g.closeAll();
    g.scene.startBattle(1, 0, 5);
  });
  await page.waitForFunction(() => window.__game.scene.battle);
  const expected = await page.evaluate(() => {
    const g = window.__game, s = g.scene, b = s.battle;
    g.closeAll();
    b.t = 200;
    b.skippedSeconds = 140;
    b.damageBySource.clear();
    b.addWeapon('fire');
    const e = b.spawnBoss('caochun', b.player.x, b.player.y, true);
    e.hp = e.maxHp = 1000;
    e.shield = 12;
    b.damage(e, 80, 0, 0, 0, { source: 'spear', noCrit: true });
    // 延时火海伤害应计入火油罐，并与护盾、主将减伤后的生命变化完全相符。
    b.grid.clear();
    b.grid.insert(e);
    b.pools.push({ source: 'fire', x: e.x, y: e.y, r: 30, dmg: 500, tick: 1, tickT: 0, life: 3, maxLife: 3, slow: 0 });
    b.updatePools(0.01);
    const lost = 1012 - e.hp - e.shield;
    b.dead = b.bossTimedOut = true;
    g.closeAll();
    s.finish(false);
    return { lost, balance: window.__saveMod.save.gold };
  });
  async function click(id) {
    await page.waitForFunction(key => window.__game.ui.prevRegions.some(r => r.id === key), id);
    const point = await page.evaluate(key => {
      const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === key);
      const c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(...point);
    await wait(280);
  }
  await wait(400);
  for (let attempt = 0; attempt < 2; attempt++) {
    await click('res_dps');
    const r = await page.evaluate(() => {
      const report = window.__game.dialogs.at(-1);
      return { total: report.total, dps: report.dps, boss: report.rows.reduce((n, row) => n + row.boss, 0), best: report.bestWeapon?.name };
    });
    assert.deepEqual(r, { total: expected.lost, dps: expected.lost / 60, boss: expected.lost, best: '火油罐' });
    if (!attempt) await shot('damage_report');
    await click('damage_report_close');
    assert.equal(await page.evaluate(() => window.__saveMod.save.gold), expected.balance);
  }
}
