import fs from 'node:fs';
import path from 'node:path';

// 布阵动画抽帧：Q='?skip=1&tower=2' node tools/shot.mjs tower-anim
// 快进到中盘（自动选牌），再按真实时间连拍几帧，用来检查塔、弹道、命中和敌人的动画。
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'TowerScene', null, { timeout: 15000 });
  const until = Number(process.env.T || 95);
  await page.evaluate(until => {
    const b = window.__game.scene.battle;
    let seed = 4242;
    b.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const order = ['tactic', 'tower', 'ally'];
    for (let i = 0; i < 30 * until && !b.over; i++) {
      if (b.offer) {
        const cards = b.offer.cards;
        b.choose(cards.find(c => c.type === order[i % 3]) || cards[0]);
      }
      if (b.aidUsed < 3 && b.canReinforce && b.offerAid()) b.choose(b.offer.cards[0]);
      b.update(1 / 30);
    }
    if (b.offer) b.choose(b.offer.cards[0]);
  }, until);
  const frames = Number(process.env.N || 6);
  for (let i = 0; i < frames; i++) {
    await page.waitForTimeout(Number(process.env.GAP || 180));
    await page.evaluate(() => { const b = window.__game.scene.battle; if (b.offer) b.choose(b.offer.cards[0]); });
    await page.screenshot({ path: path.join(out, `anim-${i}.png`) });
  }
  const state = await page.evaluate(() => {
    const b = window.__game.scene.battle;
    return { t: b.elapsed.toFixed(1), towers: b.towers.filter(Boolean).map(t => t.kind + t.level), enemies: b.enemies.length, strikes: b.strikes.length, hp: b.hp };
  });
  console.log(JSON.stringify(state));
}
