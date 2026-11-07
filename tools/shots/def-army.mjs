import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// 守城：按编制补员 + 敌将会砍士兵。Q='?skip=1' node tools/shot.mjs def-army
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__game.closeAll(); window.__game.scene.startBattle(-3, 1); });
  await page.waitForFunction(() => window.__game.scene.battle?.def);
  await page.waitForTimeout(600);

  // 1) 解锁骑兵营后骑兵全灭：下一队应优先补骑兵，粮草不够时攒着等，不让枪兵插队。
  const army = await page.evaluate(() => {
    const g = window.__game; g.closeAll();
    const b = g.scene.battle, d = b.def;
    b.player.hp = b.player.maxHp = 1e9;
    for (const e of b.enemies) e.dead = true;
    b.applyChoice({ kind: 'order', id: 'o_cav', lv: 1 });
    const cavAfterUnlock = d.allies.filter(a => !a.dead && a.kind === 'cav').length;
    // 枪兵补满，骑兵全部阵亡
    for (const a of d.allies) if (a.kind === 'cav') a.dead = true;
    d.allies = d.allies.filter(a => !a.dead);
    while (d.allies.filter(a => a.kind === 'spear').length < 9) d.allies.push({ ...d.allies.find(a => a.kind === 'spear') || {}, kind: 'spear', dead: false, hp: 100, maxHp: 100 });
    const produced = [];
    d.grain = 0;
    for (let i = 0; i < 60 * 40 && produced.length < 3; i++) {
      for (const e of b.enemies) e.dead = true;
      const before = d.allies.length;
      b.update(1 / 60);
      if (d.allies.length > before) produced.push(d.allies[d.allies.length - 1].kind);
    }
    return { cavAfterUnlock, produced };
  });
  console.log(JSON.stringify(army));
  assert.ok(army.cavAfterUnlock > 0, '解锁骑兵营立即出一队骑兵');
  assert.equal(army.produced[0], 'cav', '骑兵阵亡后粮草优先补骑兵');

  // 2) 敌将：武将离得远时，敌将去砍身边的士兵，近身横扫能打死士兵。
  const boss = await page.evaluate(() => {
    const g = window.__game; g.closeAll();
    const b = g.scene.battle, d = b.def;
    for (const e of b.enemies) e.dead = true;
    b.player.x = 0; b.player.y = -400; b.player.hp = b.player.maxHp = 1e9;
    const e = b.spawnBoss(b.chapter.midBoss, 120, 120, false);
    const proto = d.allies.find(a => !a.dead) || d.allies[0];
    d.allies = [];
    for (let i = 0; i < 6; i++) d.allies.push({ ...proto, kind: 'spear', dead: false, x: 120 + (i % 3) * 10 - 10, y: 140 + Math.floor(i / 3) * 10, hp: 60, maxHp: 60, life: -1, ox: 120, oy: 140, atk: 0 });
    let dead = 0, targeted = false;
    for (let i = 0; i < 60 * 20 && !e.dead; i++) {
      b.update(1 / 60);
      if (e.focus && d.allies.includes(e.focus)) targeted = true;
      dead = d.allies.filter(a => a.dead).length;
      if (dead >= 3) break;
    }
    return { targeted, dead };
  });
  console.log(JSON.stringify(boss));
  assert.ok(boss.targeted, '武将不在附近时敌将锁定士兵');
  assert.ok(boss.dead >= 2, '敌将能打死士兵');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'def-army.png') });
  console.log('def-army ok');
}
