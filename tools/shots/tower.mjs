import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Q='?skip=1' node tools/shot.mjs tower
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'docs/review');
  fs.mkdirSync(out, { recursive: true });
  const capture = name => page.screenshot({ path: path.join(out, 'tower-' + name + '.png') });
  async function button(id) {
    await page.waitForFunction(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === id);
      return r && ui.hit(r.x + r.w / 2, r.y + r.h / 2)?.id === id;
    }, id);
    const pt = await page.evaluate(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(...pt);
    await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.waitForTimeout(350);
  await page.evaluate(() => window.__game.closeAll());
  await button('mode_tower');
  await page.waitForFunction(() => window.__saveMod.save.homeMode === 'tower');
  await button('td_list');
  await page.waitForTimeout(400);
  await capture('01-stages');
  await button('td_map_1');
  await button('td_commander'); await button('td_hero_zhaoyun');
  await button('td_start');
  await page.waitForFunction(() => window.__game.scene.constructor.name === 'TowerScene');
  await page.evaluate(() => {
    let seed = 13001;
    window.__game.scene.battle.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__game.scene.battle.grain), 200);
  await capture('02-opening');
  await button('td_site_2'); await button('td_pick_stone');
  await capture('03-build');
  await button('td_build');
  assert.equal(await page.evaluate(() => window.__game.scene.battle.towers[2].kind), 'stone');
  await button('td_site_3'); await button('td_pick_arrow'); await button('td_build');
  await button('td_speed');
  await button('td_pause');
  const time = await page.evaluate(() => window.__game.scene.battle.elapsed);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__game.scene.battle.elapsed), time);
  await button('td_resume'); await button('td_speed');
  await button('td_send'); await button('td_command');
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    for (let i = 0; i < 100; i++)b.update(1 / 30);
  });
  const target = await page.evaluate(() => {
    const ui = window.__game.ui, b = window.__game.scene.battle, e = b.enemies[0];
    const r = ui.prevRegions.find(v => v.id === 'td_target'), c = document.querySelector('canvas').getBoundingClientRect();
    return [c.x + (r.x + r.w * e.x / 320) * c.width / ui.W, c.y + (r.y + r.h * e.y / 400) * c.height / ui.H];
  });
  await page.mouse.click(...target);
  await page.waitForFunction(() => window.__game.scene.battle.commandCd > 0);
  await page.waitForTimeout(120);
  await capture('05-command');
  // 通过实际波次赚取升级费用。截图不影响玩家存档（测试在独立浏览器上下文运行）。
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    for (let i = 0; i < 15000 && b.grain < 66 && !b.over; i++) {
      if (b.phase === 'ready') b.startWave();
      b.update(1 / 30);
    }
  });
  await button('td_site_3'); await button('td_upgrade');
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    for (let i = 0; i < 15000 && b.grain < 91 && !b.over; i++) {
      if (b.phase === 'ready') b.startWave();
      b.update(1 / 30);
    }
  });
  await page.waitForTimeout(800);
  await capture('04-upgrade');
  await button('td_branch_1');
  assert.equal(await page.evaluate(() => window.__game.scene.battle.towers[3].branch), 1);
  const outcome = await page.evaluate(() => {
    const b = window.__game.scene.battle, plan = [[2, 'stone'], [3, 'arrow'], [6, 'bolt'], [4, 'oil'], [7, 'arrow'], [5, 'drum'], [1, 'bolt']];
    for (let i = 0; i < 60000 && !b.over; i++) {
      if (b.phase === 'ready') {
        for (const [slot, kind] of plan) if (!b.towers[slot] && !b.build(slot, kind)) break;
        for (const [slot, kind] of plan) if (b.towers[slot]) b.upgrade(slot, kind === 'stone' || kind === 'arrow' ? 1 : 0);
        b.startWave();
      }
      b.update(1 / 30);
    }
    return b.phase;
  });
  assert.equal(outcome, 'win');
  await page.waitForFunction(() => window.__game.scene.result?.stars > 0);
  await capture('06-result');
  const runs = await page.evaluate(() => window.__saveMod.save.tower.runs);
  await button('td_home');
  assert.equal(await page.evaluate(() => window.__saveMod.save.tower.runs), runs);
  assert.ok(await page.evaluate(() => window.__saveMod.save.tower.cleared >= 1));
}
