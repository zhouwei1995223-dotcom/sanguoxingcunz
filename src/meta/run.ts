import { ChapterDef, DifficultyDef } from '../data/chapters';
import { weighted } from '../core/math';
import { save, markDirty } from './save';
import { newItem, randomItemTemplate, progressTask, grantHero, grantShards, randomShardHero } from './ops';
import type { EquipItem } from './save';
import { getPlatform } from '../platform';

// 单局结算

// 各章节装备掉落的品质权重（普通 → 神话）
const DROP_WEIGHTS: number[][] = [
  [60, 40, 0, 0, 0, 0],
  [30, 50, 20, 0, 0, 0],
  [0, 50, 40, 10, 0, 0],
  [0, 30, 50, 18, 2, 0],
  [0, 0, 50, 40, 9, 1],
  [0, 0, 35, 50, 13, 2],
  [0, 0, 20, 55, 22, 3],
  [0, 0, 10, 50, 35, 5],
  [0, 0, 0, 45, 47, 8],
  [0, 0, 0, 35, 53, 12],
];
const FIRST_CLEAR_Q = [1, 2, 2, 3, 3, 3, 4, 4, 4, 5];

export const ck = (d: number, c: number) => `${d}-${c}`;
export const isCleared = (d: number, c: number) => !!save.clears[ck(d, c)];
export const getBest = (d: number, c: number) => save.bests[ck(d, c)] || 0;

/** 难度 d 下的第 c 章是否解锁：普通按顺序推进；困难/噩梦需要先通关该章的上一难度 */
export function chapterOpen(c: number, d: number): boolean {
  if (d === 0) return c <= save.maxCleared + 1;
  return isCleared(d - 1, c);
}

export function diffOpen(d: number): boolean {
  return d === 0 || isCleared(d - 1, 1);
}

export const ENDLESS_UNLOCK = 3;
export const endlessHpMul = (cleared = save.maxCleared) => Math.pow(1.45, cleared);
export const endlessDmgMul = (cleared = save.maxCleared) => Math.pow(1.22, cleared);
export function endlessOpen(): boolean {
  return save.maxCleared >= ENDLESS_UNLOCK;
}

function dropQuality(chId: number, shift: number): number {
  const w = DROP_WEIGHTS[Math.min(DROP_WEIGHTS.length - 1, chId - 1)];
  let q = weighted([0, 1, 2, 3, 4, 5], (k) => w[k]);
  for (let i = 0; i < shift; i++) if (q < 5 && Math.random() < 0.5) q++;
  return q;
}

export interface RunResult {
  win: boolean;
  firstClear: boolean;
  gold: number;
  iron: number;
  yuanbao: number;
  items: EquipItem[];
  newBest: boolean;
  heroReward?: string;
  shardReward?: { hero: string; n: number };
  /** 无尽模式 */
  endless?: boolean;
  best?: number;
}

export function settleRun(ch: ChapterDef, diff: DifficultyDef, win: boolean, t: number, coins: number, kills: number, bossKills: number, equipDrops: number): RunResult {
  const d = diff.id;
  const progress = Math.min(1, t / ch.duration);
  const gold = Math.round((ch.goldBase * (0.2 + progress * 0.8) * (win ? 1.5 : 1)) * diff.reward + coins * 2);
  const iron = Math.round((ch.id * 2 + progress * 6 * ch.id + (win ? 4 * ch.id : 0)) * diff.reward);
  let yuanbao = win ? Math.round(20 * ch.id * diff.reward) : 0;
  const items: EquipItem[] = [];
  for (let i = 0; i < equipDrops; i++) items.push(newItem(randomItemTemplate(), dropQuality(ch.id, diff.qShift)));
  let firstClear = false;
  if (win && !isCleared(d, ch.id)) {
    firstClear = true;
    save.clears[ck(d, ch.id)] = true;
    if (d === 0) save.firstClear[ch.id] = true;
    yuanbao += 100 * ch.id * (1 + d);
    // 第一章首通必得兵器，引导玩家体验装备系统
    items.push(newItem(ch.id === 1 && d === 0 ? 'yajiao' : randomItemTemplate(), Math.min(5, FIRST_CLEAR_Q[ch.id - 1] + d)));
  }
  // 新手首局：无论胜负都赠送兵器，保证装备引导可以进行
  if (save.guide === 0 && !save.items.some((i) => i.tid === 'yajiao')) items.push(newItem('yajiao', 1));
  if (win && d === 0 && ch.id > save.maxCleared) save.maxCleared = ch.id;
  // 武将奖励：第2章首通送关羽；其后首通送碎片（高难度送吕布碎片）
  let heroReward: string | undefined;
  let shardReward: { hero: string; n: number } | undefined;
  if (firstClear && d === 0 && ch.id === 2) { grantHero('guanyu'); heroReward = 'guanyu'; }
  else if (firstClear && (ch.id >= 3 || d > 0)) {
    shardReward = { hero: d > 0 || ch.id >= 4 ? 'lvbu' : 'zhuge', n: 10 + d * 5 };
    grantShards(shardReward.hero, shardReward.n);
  }
  const key = ck(d, ch.id);
  const newBest = t > (save.bests[key] || 0);
  if (newBest) save.bests[key] = Math.min(ch.duration, Math.floor(t));
  if (d === 0 && t > (save.chapterBest[ch.id] || 0)) save.chapterBest[ch.id] = Math.min(ch.duration, Math.floor(t));
  save.gold += gold;
  save.iron += iron;
  save.yuanbao += yuanbao;
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  getPlatform().submitScore('score', bestScore());
  markDirty();
  return { win, firstClear, gold, iron, yuanbao, items, newBest, heroReward, shardReward };
}

/** 无尽模式结算：按坚持时间发奖励，每 5 分钟额外送碎片 */
export function settleEndless(t: number, coins: number, kills: number, bossKills: number, equipDrops: number): RunResult {
  const m = t / 60;
  const tier = Math.min(10, 1 + Math.floor(m / 3));
  const gold = Math.round(160 * m * (1 + save.maxCleared * 0.3) + coins * 2);
  const iron = Math.round(3 * m * (1 + save.maxCleared * 0.2));
  const milestones = Math.floor(m / 5);
  const yuanbao = milestones * 15;
  const items: EquipItem[] = [];
  for (let i = 0; i < equipDrops; i++) items.push(newItem(randomItemTemplate(), dropQuality(tier, 0)));
  let shardReward: { hero: string; n: number } | undefined;
  if (milestones > 0) {
    shardReward = { hero: randomShardHero(true), n: milestones * 3 };
    grantShards(shardReward.hero, shardReward.n);
  }
  const newBest = t > save.endlessBest;
  if (newBest) save.endlessBest = Math.floor(t);
  save.endlessRuns++;
  save.gold += gold;
  save.iron += iron;
  save.yuanbao += yuanbao;
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  getPlatform().submitScore('endless', save.endlessBest);
  markDirty();
  return { win: false, firstClear: false, gold, iron, yuanbao, items, newBest, shardReward, endless: true, best: save.endlessBest };
}

/** 排行分数：最高进度（难度×10+章节）×10000 + 该关坚守秒数 */
export function bestScore(): number {
  let best = 0;
  for (const k in save.bests) {
    const [d, c] = k.split('-').map(Number);
    const cleared = isCleared(d, c);
    best = Math.max(best, (d * 10 + (cleared ? c : c - 1)) * 10000 + save.bests[k]);
  }
  return best;
}
