// Q='?skip=1' node tools/shot.mjs tower-rewards
import assert from 'node:assert/strict';

export default async function({ page }) {
  async function tap(id) {
    await page.waitForFunction(id => {
      const u = window.__game.ui, r = u.prevRegions.find(v => v.id === id);
      return r && u.hit(r.x + r.w / 2, r.y + r.h / 2)?.id === id;
    }, id);
    const pt = await page.evaluate(id => {
      const u = window.__game.ui, r = u.prevRegions.find(v => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / u.W, c.y + (r.y + r.h / 2) * c.height / u.H];
    }, id);
    await page.mouse.click(...pt);
    await page.waitForTimeout(75);
  }
  const url = new URL(page.url()); url.search = '?skip=1&tower=1';
  async function enter() {
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'TowerScene');
    return page.evaluate(() => {
      const b = window.__game.scene.battle;
      return [b.towers.filter(Boolean).length, b.towers[0].kind, b.aidUsed, b.level];
    });
  }
  assert.deepEqual(await enter(), [1, 'arrow', 0, 1]);
  // 波次制：不选牌时按波次出兵，波内间隔均匀，波间休整；中间一波出敌将、最后一波出主将；同兵种血量逐波不降。
  const march = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    const b = new live.constructor(live.map, live.hero, live.bonus, () => .5);
    b.towers.fill(null);
    const generals = [], arrivals = [], ordinaryHP = [], waveStarts = [];
    let lastWave = -1;
    while (!b.allSpawned || b.enemies.length) {
      b.xp = 0;
      b.update(1 / 30);
      if (b.waveIdx !== lastWave) { lastWave = b.waveIdx; waveStarts.push(b.elapsed); }
      for (const e of b.enemies.splice(0)) {
        if (e.gateDamage === 5) generals.push(b.waveIdx);
        arrivals.push([b.waveIdx, b.elapsed]);
        if (e.gateDamage === 1 && !e.armor && e.speed < 30) ordinaryHP.push(e.maxHp);
      }
      if (b.over || b.elapsed > 900) break;
    }
    b.update(1 / 30);
    return { generals, arrivals, ordinaryHP, waveStarts, total: b.waveTotal, mid: Math.floor((b.waveTotal - 1) / 2), phase: b.phase };
  });
  assert.equal(march.waveStarts.length, march.total, '每一波都开始了');
  assert.deepEqual(march.generals, [march.mid, march.total - 1], '中间一波敌将、最后一波主将');
  for (let w = 0; w < march.total; w++) {
    const ts = march.arrivals.filter(a => a[0] === w).map(a => a[1]);
    assert.ok(ts.length >= 8, '每波至少 8 名敌人');
    assert.ok(ts.slice(1).every((t, i) => t - ts[i] < 1.7), '波内出兵不断档');
  }
  assert.ok(march.waveStarts.slice(1).every((t, i) => t - march.waveStarts[i] > 7), '波与波之间有休整');
  assert.ok(march.ordinaryHP.slice(1).every((hp, i) => hp >= march.ordinaryHP[i] - 1), '同兵种血量逐波不降');
  assert.equal(march.phase, 'win');
  // 提前出击：休整中可以跳过，剩余秒数折成经验。
  const call = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    const b = new live.constructor(live.map, live.hero, live.bonus, () => .5);
    b.towers.fill(null);
    while (!b.resting || b.waveIdx < 0) { b.update(1 / 30); for (const e of b.enemies.splice(0)); if (b.offer) b.choose(b.offer.cards[0]); }
    const before = b.xp, idx = b.waveIdx;
    const gain = b.callNext();
    b.update(1 / 30);
    return { gain, xp: b.xp - before, next: b.waveIdx === idx + 1 };
  });
  assert.ok(call.gain > 0 && call.xp >= call.gain && call.next, '提前出击立即开下一波并给经验');
  // 城门失守可复活三次，每次全塔增伤，撤军不给复活。
  const revive = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    const b = new live.constructor(live.map, live.hero, live.bonus, () => .5);
    const out = [];
    for (let i = 0; i < 4; i++) { b.hp = 0; b.phase = 'loss'; out.push([b.canRevive, b.revive(), b.hp, Math.round(b.reviveBonus * 100)]); }
    const q = new live.constructor(live.map, live.hero, live.bonus, () => .5);
    q.quit = true; q.phase = 'loss';
    return { out, quit: q.canRevive };
  });
  assert.deepEqual(revive.out, [[true, true, 10, 10], [true, true, 10, 25], [true, true, 10, 45], [false, false, 0, 45]]);
  assert.equal(revive.quit, false);
  const flash = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    const b = new live.constructor(live.map, live.hero, live.bonus, () => .5);
    for (let i = 0; i < 600 && !b.enemies.some(e => e.flash > 0); i++) b.update(1 / 30);
    const e = b.enemies.find(e => e.flash > 0 && e.hp < e.maxHp);
    if (!e || !b.cast(e.x, e.y) || !b.fallen.includes(e)) return false;
    for (let i = 0; i < 4; i++) { if (b.offer) b.choose(b.offer.cards[0]); b.update(1 / 30); }
    return !b.fallen.includes(e) && b.kills === 1;
  });
  assert.ok(flash, '箭塔命中和将令击杀都要白闪，击杀只能结算一次');
  // 对三种同类组合各取一条确定性随机路径，防止升级退回“每类一张”。
  const groups = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    return ['tower', 'ally', 'tactic'].map(type => {
      const b = new live.constructor(live.map, live.hero, live.bonus);
      const pool = b.rewardPool(), draws = [];
      for (let i = 0; i < 3; i++) {
        const index = pool.findIndex(c => c.type === type);
        const weights = pool.map(c => c.type === 'ally' ? .4 : 1);
        const sum = (a, v) => a + v;
        draws.push((weights.slice(0, index).reduce(sum, 0) + weights[index] / 2) / weights.reduce(sum, 0));
        pool.splice(index, 1);
      }
      b.random = () => draws.shift();
      b.xp = b.xpNeeded;
      b.checkLevel();
      return b.offer.cards.map(c => c.type);
    });
  });
  assert.deepEqual(groups, [['tower', 'tower', 'tower'], ['ally', 'ally', 'ally'], ['tactic', 'tactic', 'tactic']]);
  await tap('td_aid');
  await page.locator('#__adskip').click();
  await page.waitForFunction(() => !window.__game.scene.busy);
  assert.deepEqual(await page.evaluate(() => { const b = window.__game.scene.battle; return [b.aidUsed, b.offer, b.towers.filter(Boolean).length]; }), [0, null, 1]);
  for (let i = 0; i < 3; i++) {
    await tap('td_aid'); await page.locator('#__adskip').waitFor();
    await page.evaluate(() => { void window.__game.scene.reward('aid'); });
    assert.equal(await page.locator('#__adskip').count(), 1);
    await page.waitForFunction(() => window.__game.scene.battle.offer?.aid);
    const offer = await page.evaluate(() => window.__game.scene.battle.offer.cards);
    assert.equal(new Set(offer.map(c => c.kind)).size, 3);
    assert.ok(offer.every(c => c.type === 'tower' && c.level === 1 && c.slot === offer[0].slot));
    await tap('td_reward_1');
    assert.deepEqual(await page.evaluate(i => { const b = window.__game.scene.battle; return [b.aidUsed, b.towers.filter(Boolean).length, b.level, b.towers[i + 1].kind]; }, i), [i + 1, i + 2, 1, offer[1].kind]);
  }
  assert.equal(await page.evaluate(() => window.__game.scene.battle.canReinforce), false);
  assert.deepEqual(await enter(), [1, 'arrow', 0, 1]);
  for (const index of [0, 1, 2]) {
    const frozen = await page.evaluate(() => {
      const b = window.__game.scene.battle;
      b.xp = b.xpNeeded; b.update(1 / 30);
      return [b.elapsed, b.offer.cards.map(c => JSON.stringify(c))];
    });
    assert.equal(new Set(frozen[1]).size, 3);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__game.scene.battle.elapsed), frozen[0]);
    const slot = await page.evaluate(i => { const b = window.__game.scene.battle; window.__oldCard = b.offer.cards[i]; return b.offer.cards[i] }, index);
    await tap('td_reward_' + index);
    assert.ok(await page.evaluate(card => {
      const b = window.__game.scene.battle;
      if (b.choose(window.__oldCard)) return false;
      if (card.type === 'tower') return b.towers[card.slot]?.level === card.level;
      if (card.type === 'ally') return b.allies.some(a => a.id === card.id);
      return b.tactics.some(t => t.id === card.id);
    }, slot));
  }
}
