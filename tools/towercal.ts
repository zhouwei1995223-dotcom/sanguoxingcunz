import { TowerBattle } from '../src/battle/tower';
import { TOWER_MAPS, TowerCard, commandBonus } from '../src/data/tower';

// 布阵强度校准：对每关二分敌人强度系数，让「不援建」胜率接近目标。
// npm run towercal -- <每档局数> <目标胜率逗号分隔，按关卡>
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function score(b: TowerBattle, card: TowerCard) {
  const count = b.towers.filter(Boolean).length;
  if (card.type === 'tower') {
    if (card.kind === 'drum' && count < 3) return 1;
    return 5 + (card.level === 1 && count < 5 ? 3 : 0) + (card.level === 3 ? 2 : 0) + (card.kind === 'stone' || card.kind === 'oil' ? 1 : 0);
  }
  if (card.type === 'ally') return (b.allies.some(a => a.id === card.id) ? 4 : 8) + (card.id === 'huangzhong' ? 1 : 0);
  return b.tactics.some(t => t.id === card.id) ? 3 : 7;
}
function winRate(mapIdx: number, strength: number, runs: number, assists: number) {
  const map = { ...TOWER_MAPS[mapIdx], strength };
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const b = new TowerBattle(map, 'zhaoyun', commandBonus(1, 1, 0), seeded(30001 + i * 7919));
    while (!b.over) {
      if (b.offer) b.choose(b.offer.cards.reduce((best, next) => score(b, next) > score(b, best) ? next : best));
      else if (b.aidUsed < assists) b.offerAid();
      b.update(1 / 30);
    }
    if (b.phase === 'win') wins++;
  }
  return wins / runs;
}
const runs = Number(process.argv[2] || 60);
const targets = (process.argv[3] || '0.92,0.75,0.55,0.45,0.38,0.3').split(',').map(Number);
const only = process.env.MAP ? [Number(process.env.MAP) - 1] : TOWER_MAPS.map((_, i) => i);
for (const m of only) {
  let lo = 0.2, hi = 1.6;
  for (let k = 0; k < 9; k++) {
    const mid = (lo + hi) / 2;
    if (winRate(m, mid, runs, 0) > targets[m]) lo = mid; else hi = mid;
  }
  const s = Math.round((lo + hi) / 2 * 1000) / 1000;
  console.log(`第${m + 1}关 strength=${s}  援建0 ${(winRate(m, s, runs, 0) * 100).toFixed(0)}%  援建3 ${(winRate(m, s, runs, 3) * 100).toFixed(0)}%`);
}
