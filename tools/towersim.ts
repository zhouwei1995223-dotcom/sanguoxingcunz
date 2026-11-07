import { TowerBattle } from '../src/battle/tower';
import { TOWER_MAPS, TowerKind, TowerMap, commandBonus } from '../src/data/tower';

// 同一建造策略，预先选拐角；每波间隙先按表补位，再从前往后强化。
const plans: [number, TowerKind][][] = [
  [[2, 'stone'], [3, 'arrow'], [6, 'bolt'], [4, 'oil'], [7, 'arrow'], [5, 'drum'], [1, 'bolt']],
  [[3, 'stone'], [5, 'arrow'], [6, 'bolt'], [4, 'oil'], [7, 'arrow'], [1, 'bolt'], [8, 'drum']],
  [[7, 'stone'], [8, 'arrow'], [9, 'bolt'], [5, 'oil'], [6, 'arrow'], [4, 'bolt'], [3, 'stone']],
];
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function run(map: TowerMap, seed: number) {
  const b = new TowerBattle(map, 'zhaoyun', commandBonus(1, 1, 0), seeded(seed));
  const plan = plans[map.id - 1];
  while (!b.over) {
    if (b.phase === 'ready') {
      for (const [slot, kind] of plan) if (!b.towers[slot] && !b.build(slot, kind)) break;
      for (const [slot, kind] of plan) if (b.towers[slot]) b.upgrade(slot, kind === 'stone' || kind === 'arrow' ? 1 : 0);
      b.startWave();
    }
    b.update(1 / 30);
  }
  return b;
}
const runs = Number(process.argv[2] || 100), seed = Number(process.argv[3] || 13001);
if (!Number.isInteger(runs) || runs < 1 || !Number.isFinite(seed)) throw Error('参数：正整数局数、随机种子');
for (const map of TOWER_MAPS) {
  let wins = 0, leaks = 0;
  for (let i = 0; i < runs; i++) {
    const b = run(map, seed + i * 7919);
    if (b.phase === 'win') wins++;
    leaks += b.leaks;
  }
  console.log(`第${map.id}关 ${map.name}　${wins}/${runs} 胜率 ${(wins / runs * 100).toFixed(1)}%　平均漏怪 ${(leaks / runs).toFixed(2)}`);
}
