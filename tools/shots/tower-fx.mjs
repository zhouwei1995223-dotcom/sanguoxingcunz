import assert from 'node:assert/strict';

// 布阵特效与交互回归：Q='?skip=1' node tools/shot.mjs tower-fx
// 1) 未解锁的关卡点了不会被选中；2) 特效事件每帧取走、粒子有上限；
// 3) 敌人倒地动画、敌将横幅出现；4) 撤军需要连点两次；5) 战斗结果与关闭特效时完全一致。
export default async function({ page }) {
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
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    window.__game.closeAll();
    const s = window.__saveMod.save;
    s.tower.cleared = 0; s.tower.selected = 1; s.tower.stars = {};
  });
  await button('mode_tower');
  await button('td_list');
  await page.waitForTimeout(300);
  await button('td_map_3');
  assert.equal(await page.evaluate(() => window.__saveMod.save.tower.selected), 1, '未解锁的第 3 关不能被选中');
  await page.evaluate(() => window.__game.closeAll());
  await page.waitForTimeout(150);
  await button('td_start');
  await page.waitForFunction(() => window.__game.scene.constructor.name === 'TowerScene');
  // 真实时间二倍速跑一段：事件应当每帧被取走。
  await button('td_speed');
  await page.evaluate(() => {
    window.__pick = setInterval(() => { const b = window.__game.scene.battle; if (b?.offer) b.choose(b.offer.cards[0]); }, 50);
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => clearInterval(window.__pick));
  const live = await page.evaluate(() => {
    const sc = window.__game.scene, b = sc.battle;
    return { fxOn: b.fxOn, pending: b.events.length, t: b.elapsed };
  });
  assert.ok(live.fxOn && live.t > 3, '战斗在推进');
  assert.ok(live.pending < 30, '事件被及时取走');
  // 快进到敌将登场附近，逐帧推进并让场景消费事件。
  const seen = await page.evaluate(() => {
    const sc = window.__game.scene, b = sc.battle;
    let deaths = 0, banner = '', maxParticles = 0, decals = 0, popups = 0;
    for (let i = 0; i < 30 * 135 && !b.over; i++) {
      if (b.offer) b.choose(b.offer.cards.find(c => c.type === 'tower') || b.offer.cards[0]);
      b.update(1 / 30);
      sc.playEvents();
      sc.fx.update(1 / 30, b);
      deaths = Math.max(deaths, sc.fx.deaths.length);
      maxParticles = Math.max(maxParticles, sc.fx.particles.length);
      decals = Math.max(decals, sc.fx.decals.length);
      popups = Math.max(popups, sc.fx.popups.length);
      if (sc.fx.banner) banner = sc.fx.banner.text;
    }
    return { deaths, banner, maxParticles, decals, popups, t: b.elapsed };
  });
  console.log(JSON.stringify(seen));
  assert.ok(seen.deaths > 0, '敌人有倒地动画');
  assert.ok(seen.banner.includes('夏侯恩'), '敌将出阵横幅带名字');
  assert.ok(seen.maxParticles <= 320, '粒子数量有上限');
  assert.ok(seen.popups <= 40, '伤害数字有上限');
  await page.waitForTimeout(300);
  // 撤军：第一次只提示，第二次才结算。
  await page.evaluate(() => { const b = window.__game.scene.battle; if (b.offer) b.choose(b.offer.cards[0]); });
  await button('td_pause');
  await button('td_quit');
  assert.equal(await page.evaluate(() => window.__game.scene.battle.phase), 'fight', '第一次点撤军不结算');
  await button('td_quit');
  await page.waitForFunction(() => window.__game.scene.result);
  assert.equal(await page.evaluate(() => window.__game.scene.battle.phase), 'loss');
  // 关闭/开启特效记录，同一种子的战斗结果一致。
  const same = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    const run = fx => {
      let seed = 777;
      const b = new live.constructor(live.map, live.hero, live.bonus, () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296));
      b.fxOn = fx;
      while (!b.over) { if (b.offer) b.choose(b.offer.cards[0]); b.update(1 / 30); b.events.length = 0; }
      return [b.phase, b.kills, b.leaks, b.hp, b.level].join(',');
    };
    return [run(false), run(true)];
  });
  assert.equal(same[0], same[1], '特效记录不影响战斗结果');
  console.log('tower-fx ok', same[0]);
}
