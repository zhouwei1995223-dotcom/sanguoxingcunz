import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Q='?skip=1' node tools/shot.mjs tower
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'docs/review');
  fs.mkdirSync(out, { recursive: true });
  const capture = name => page.screenshot({ path: path.join(out, 'tower-' + name + '.png') });
  async function buttonPoint(id) {
    await page.waitForFunction(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === id);
      return r && ui.hit(r.x + r.w / 2, r.y + r.h / 2)?.id === id;
    }, id);
    return page.evaluate(id => {
      const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
  }
  async function button(id) {
    await page.mouse.click(...await buttonPoint(id));
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
  assert.equal(await page.evaluate(() => window.__game.scene.battle.towers.filter(Boolean).length), 1);
  await capture('02-opening');
  // 二倍速要先看一次视频（网页版为模拟广告，2 秒后自动发奖励），之后本局可以随时切换。
  assert.equal(await page.evaluate(() => window.__game.scene.speedOpen), false);
  await button('td_speed');
  await page.waitForFunction(() => window.__game.scene.speedOpen && window.__game.scene.speed === 2 && !window.__game.scene.busy, null, { timeout: 8000 });
  await page.waitForTimeout(200);
  await button('td_pause');
  const time = await page.evaluate(() => window.__game.scene.battle.elapsed);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__game.scene.battle.elapsed), time);
  await button('td_resume'); await button('td_speed');
  await button('td_aid');
  await page.waitForFunction(() => window.__game.scene.battle.offer?.aid);
  await page.waitForFunction(() => window.__game.ui.prevRegions.some(r => r.id === 'td_reward_0'));
  await page.waitForTimeout(150);
  await capture('04-aid');
  await button('td_reward_0');
  assert.equal(await page.evaluate(() => window.__game.scene.battle.aidUsed), 1);
  async function nextUpgrade() {
    await page.evaluate(() => {
      const b = window.__game.scene.battle;
      for (let i = 0; i < 50000 && !b.offer && !b.over; i++) {
        b.update(1 / 30);
      }
    });
    await page.waitForFunction(() => window.__game.scene.battle.offer?.aid === false);
  }
  await nextUpgrade(); await page.waitForTimeout(1900); await capture('03-rewards');
  const pick = await page.evaluate(() => {
    const cards = window.__game.scene.battle.offer.cards;
    return Math.max(0, cards.findIndex(c => c.type === 'ally'));
  });
  await button('td_reward_' + pick);
  // 在连续进攻中用实际将令选点。为避免截图等待时间波动，在真实逻辑中快进至有敌人的一帧。
  await page.evaluate(() => {
    const b = window.__game.scene.battle;
    for (let i = 0; i < 25000 && !(b.phase === 'fight' && b.enemies.length && !b.offer); i++) {
      if (b.offer) b.choose(b.offer.cards[0]);
      b.update(1 / 30);
    }
  });
  await button('td_command');
  const target = await page.evaluate(() => {
    const ui = window.__game.ui, b = window.__game.scene.battle, e = b.enemies[0];
    const r = ui.prevRegions.find(v => v.id === 'td_target'), c = document.querySelector('canvas').getBoundingClientRect();
    return [c.x + (r.x + r.w * e.x / 320) * c.width / ui.W, c.y + (r.y + r.h * e.y / 400) * c.height / ui.H];
  });
  await page.mouse.click(...target); await page.waitForFunction(() => window.__game.scene.battle.commandCd > 0);
  await page.waitForTimeout(100); await capture('05-command');
  const outcome = await page.evaluate(() => {
    const b = window.__game.scene.battle;
    for (let i = 0; i < 60000 && !b.over; i++) {
      if (b.offer) {
        const best = b.offer.cards.find(c => c.type === 'ally' && !b.allies.some(a => a.id === c.id))
          || b.offer.cards.find(c => c.type === 'tactic' && !b.tactics.some(t => t.id === c.id))
          || b.offer.cards[0];
        b.choose(best);
      }

      if (!b.over && !b.offer && b.commandCd <= 0 && b.enemies.length >= 4) {
        const first = b.enemies.reduce((a, c) => a.remaining < c.remaining ? a : c);
        b.cast(first.x, first.y);
      }
      b.update(1 / 30);
    }
    return b.phase;
  });
  assert.ok(outcome === 'win' || outcome === 'loss');
  await page.waitForFunction(() => window.__game.scene.result);
  await capture('06-result');
  await button('td_home');
  if (outcome === 'win') assert.ok(await page.evaluate(() => window.__saveMod.save.tower.cleared >= 1));
}
