// 塔防试玩的无头对局：确认能分出胜负，并且手牌、粮草不会坏掉。
import { buildLanePath, LaneBattle, laneAiAction, mulberry32, type LaneHeroSnap } from '../src/battle/laneBattle';
import { HERO_BY_ID } from '../src/data/heroes';

function snap(id: string): LaneHeroSnap {
  const h = HERO_BY_ID[id];
  return { atk: h.baseAtk, hp: h.baseHp, speed: h.moveSpeed, sprite: 'hero_' + id, frames: 4 };
}

function play(seed: number, style: 'smart' | 'random' | 'idle') {
  const b = new LaneBattle({ path: buildLanePath(0, 0, 700, 900), seed, heroSnap: snap });
  const rng = mulberry32(seed ^ 0x51ed);
  let ai = 0;
  let minFood = b.food;
  for (let t = 0; t < 360; t += 0.05) {
    if (b.hand.length !== 5) throw new Error('hand ' + b.hand.length);
    b.step(0.05);
    if (b.food < -0.01) throw new Error('food ' + b.food);
    minFood = Math.min(minFood, b.food);
    ai += 0.05;
    if (b.pending || ai >= 0.45) {
      ai = 0;
      const act = laneAiAction(b, style, rng);
      if (act?.upgrade != null) b.pickUpgrade(act.upgrade);
      else if (act?.play != null) {
        const before = b.units.filter((u) => u.side === 'ally').length;
        const err = b.play(act.play);
        if (err) throw new Error(err);
        if (b.hand.length !== 5) throw new Error('refill');
        if (b.units.filter((u) => u.side === 'ally').length !== before + 1) throw new Error('spawn');
      }
    }
    if (b.result) break;
  }
  return { result: b.result, t: b.t, kills: b.kills, ally: Math.round(b.allyHp), enemy: Math.round(b.enemyHp), food: Math.round(b.food), minFood: Math.round(minFood) };
}

function batch(style: 'smart' | 'random' | 'idle', n: number) {
  let win = 0, lose = 0, draw = 0, allySum = 0;
  const times: number[] = [];
  for (let i = 1; i <= n; i++) {
    const r = play(i * 17 + 3, style);
    if (r.result === 'win') win++;
    else if (r.result === 'lose') lose++;
    else draw++;
    allySum += r.ally;
    times.push(r.t);
    if (i <= 3) console.log(style, i, JSON.stringify(r));
  }
  times.sort((a, b) => a - b);
  const mid = times[Math.floor(times.length / 2)];
  console.log(`${style}  win ${win}  lose ${lose}  timeout ${draw}  / ${n}  median ${mid.toFixed(0)}s  allyHpAvg ${Math.round(allySum / n)}`);
  return { win, lose, draw };
}

const one = new LaneBattle({ path: buildLanePath(0, 0, 700, 900), seed: 7, heroSnap: snap });
const idx = one.hand.findIndex((c) => c.cost <= one.food);
if (idx < 0) throw new Error('opening hand cannot play');
const cost = one.hand[idx].cost;
const food = one.food;
if (one.play(idx)) throw new Error('play failed');
if (one.hand.length !== 5) throw new Error('hand not 5');
if (Math.abs(one.food - (food - cost)) > 0.01) throw new Error('food not spent');
if (!one.units.some((u) => u.side === 'ally')) throw new Error('no unit');
console.log('play ok', one.hand.map((c) => c.name + c.lv + '@' + c.cost).join(' '));

const idle = batch('idle', 12);
const random = batch('random', 16);
const smart = batch('smart', 16);
if (idle.win !== 0 || idle.lose !== 12) {
  console.log('FAIL idle should always lose');
  process.exitCode = 1;
}
if (smart.win < 8 || smart.win > 15) {
  console.log('FAIL smart win rate out of medium band');
  process.exitCode = 1;
}
if (random.win < 3 || random.win > 11 || random.draw > 3) {
  console.log('FAIL random win rate out of medium band');
  process.exitCode = 1;
}
console.log(process.exitCode ? 'LANE CHECK FAILED' : 'LANE CHECK OK');
