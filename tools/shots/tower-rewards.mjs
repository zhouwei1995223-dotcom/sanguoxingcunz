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
      b.countdown = 100;
      return [b.towers.filter(Boolean).length, b.towers[b.map.starter].kind, b.aidUsed, b.level];
    });
  }
  assert.deepEqual(await enter(), [1, 'arrow', 0, 1]);
  // 对三种同类组合各取一条确定性随机路径，防止升级退回“每类一张”。
  const groups = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    return ['tower', 'ally', 'tactic'].map(type => {
      const b = new live.constructor(live.map, live.hero, live.bonus);
      const pool = b.rewardPool(), draws = [];
      for (let i = 0; i < 3; i++) {
        const index = pool.findIndex(c => c.type === type);
        draws.push((index + 0.5) / pool.length);
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
    assert.deepEqual(await page.evaluate(i => { const b = window.__game.scene.battle; return [b.aidUsed, b.towers.filter(Boolean).length, b.level, b.towers[b.map.aidSites[i]].kind]; }, i), [i + 1, i + 2, 1, offer[1].kind]);
  }
  assert.equal(await page.evaluate(() => window.__game.scene.battle.canReinforce), false);
  assert.deepEqual(await enter(), [1, 'arrow', 0, 1]);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.countdown = 0; b.startWave(false); });
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
