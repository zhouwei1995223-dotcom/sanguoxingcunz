import { TowerBattle } from '../src/battle/tower';
import { TOWER_MAPS, TowerCard, TowerMap, commandBonus } from '../src/data/tower';

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// 只在真实发出的三张牌里选：前期补攻击塔和援将，之后兼顾阵法、塔数和升级。
function score(b: TowerBattle, card: TowerCard) {
  const count = b.towers.filter(Boolean).length;
  if (card.type === 'tower') {
    if (card.kind === 'drum' && count < 3) return 1;
    return 5 + (card.level === 1 && count < 5 ? 3 : 0) + (card.level === 3 ? 2 : 0)
      + (card.kind === 'stone' || card.kind === 'oil' ? 1 : 0);
  }
  if (card.type === 'ally') {
    const owns = b.allies.some(a => a.id === card.id);
    return (owns ? 4 : 8) + (card.id === 'huangzhong' ? 1 : 0);
  }
  return b.tactics.some(t => t.id === card.id) ? 3 : 7;
}

function run(map: TowerMap, seed: number, assists: number) {
  const b = new TowerBattle(map, 'zhaoyun', commandBonus(1, 1, 0), seeded(seed));
  while (!b.over) {
    if (b.offer) {
      const card = b.offer.cards.reduce((best, next) => score(b, next) > score(b, best) ? next : best);
      if (!b.choose(card)) throw Error('奖励未生效');
    } else if (b.aidUsed < assists) b.offerAid();
    else if (b.phase === 'ready') b.startWave();
    b.update(1 / 30);
  }
  return b;
}
const runs = Number(process.argv[2] || 100), seed = Number(process.argv[3] || 13001), assists = Number(process.argv[4] || 0);
if (!Number.isInteger(runs) || runs < 1 || !Number.isFinite(seed) || ![0, 1, 2, 3].includes(assists)) throw Error('参数：局数、种子、援建次数 0～3');
for (const map of TOWER_MAPS) {
  let wins = 0, leaks = 0;
  for (let i = 0; i < runs; i++) {
    const b = run(map, seed + i * 7919, assists);
    if (b.phase === 'win') wins++;
    leaks += b.leaks;
  }
  console.log(`第${map.id}关 ${map.name}　援建 ${assists}　${wins}/${runs} 胜率 ${(wins / runs * 100).toFixed(1)}%　平均漏怪 ${(leaks / runs).toFixed(2)}`);
}
