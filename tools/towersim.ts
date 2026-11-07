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
  let firstLeak = 0;
  while (!b.over) {
    if (b.offer) {
      const card = b.offer.cards.reduce((best, next) => score(b, next) > score(b, best) ? next : best);
      if (!b.choose(card)) throw Error('奖励未生效');
    } else if (b.aidUsed < assists) b.offerAid();
    b.update(1 / 30);
    if (b.leaks && !firstLeak) firstLeak = b.elapsed;
  }
  return Object.assign(b, { firstLeak });
}
const runs = Number(process.argv[2] || 100), seed = Number(process.argv[3] || 13001), assists = Number(process.argv[4] || 0);
if (!Number.isInteger(runs) || runs < 1 || !Number.isFinite(seed) || ![0, 1, 2, 3].includes(assists)) throw Error('参数：局数、种子、援建次数 0～3');
for (const map of TOWER_MAPS) {
  const timeToDefeat: number[] = [];
  let wins = 0, leaks = 0, firstLeakTime = 0, leakyRuns = 0;
  for (let i = 0; i < runs; i++) {
    const b = run(map, seed + i * 7919, assists);
    if (b.phase === 'win') wins++;
    else timeToDefeat.push(b.elapsed - b.firstLeak);
    leaks += b.leaks;
    if (b.firstLeak) { firstLeakTime += b.firstLeak; leakyRuns++; }
  }
  timeToDefeat.sort((a, b) => a - b);
  const median = timeToDefeat[Math.floor(timeToDefeat.length / 2)];
  console.log(`第${map.id}关 ${map.name}　援建 ${assists}　${wins}/${runs} 胜率 ${(wins / runs * 100).toFixed(1)}%　平均漏怪 ${(leaks / runs).toFixed(2)}　有漏怪局首次漏怪均时 ${leakyRuns ? (firstLeakTime / leakyRuns).toFixed(1) + '秒' : '无'}　首次漏怪到失守的中位时长 ${median !== undefined ? median.toFixed(1) + '秒' : '无失守'}`);
}
