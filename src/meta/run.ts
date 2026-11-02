import { skillsUnlockedAt } from '../data/skills';
import { ChapterDef, DifficultyDef, CHAPTERS } from '../data/chapters';
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
  /** 本次通关新解锁的局内技能 */
  newSkills?: string[];
  gold: number;
  iron: number;
  yuanbao: number;
  items: EquipItem[];
  newBest: boolean;
  heroReward?: string;
  shardReward?: { hero: string; n: number };
  /** 无尽模式 */
  endless?: boolean;
  /** 守城模式：守到第几波、是否当天首胜 */
  defense?: { waves: number; dailyFirst: boolean };
  best?: number;
  /** 三星评价：本局拿到的星（位）、第一次集齐三星的元宝奖励 */
  stars?: number;
  starBonus?: number;
}

/** 三星评价：通关 / 不复活 / 最终敌将 60 秒内击败 */
export const STAR_BOSS_SEC = 80;
export const STAR_LABELS = ['通关', '不复活', `${STAR_BOSS_SEC}秒内击败最终敌将`];
export function runStars(win: boolean, revives: number, finalBossSec: number): number {
  if (!win) return 0;
  return 1 | (revives === 0 ? 2 : 0) | (finalBossSec >= 0 && finalBossSec <= STAR_BOSS_SEC ? 4 : 0);
}
export const starCount = (bits: number) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
/** 某难度某章拿到过的星 */
export const chapterStars = (d: number, chId: number) => save.stars[ck(d, chId)] || 0;

/** 新手试炼的结算：固定奖励 + 必得兵器（装备引导用），不记通关、不记最佳 */
export function settleTutorial(win: boolean, coins: number, kills: number): RunResult {
  const gold = 300 + coins * 2, yuanbao = win ? 60 : 30;
  const items: EquipItem[] = [];
  if (!save.items.some((i) => i.tid === 'yajiao')) items.push(newItem('yajiao', 1));
  save.gold += gold;
  save.yuanbao += yuanbao;
  progressTask('battle', 1);
  progressTask('kill', kills);
  markDirty();
  return { win, firstClear: false, gold, iron: 0, yuanbao, items, newBest: false };
}

export function settleRun(ch: ChapterDef, diff: DifficultyDef, win: boolean, t: number, coins: number, kills: number, bossKills: number, equipDrops: number, stars = 0): RunResult {
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
  let newSkills: string[] | undefined;
  if (win && d === 0 && ch.id > save.maxCleared) {
    for (let c = save.maxCleared + 1; c <= ch.id; c++) newSkills = [...(newSkills || []), ...skillsUnlockedAt(c)];
    save.maxCleared = ch.id;
  }
  // 武将奖励：第2章首通送关羽；其后首通送碎片（高难度送吕布碎片）
  let heroReward: string | undefined;
  let shardReward: { hero: string; n: number } | undefined;
  if (firstClear && d === 0 && ch.id === 2) { grantHero('guanyu'); heroReward = 'guanyu'; }
  else if (firstClear && d === 0 && ch.id === 4) { grantHero('huangzhong'); heroReward = 'huangzhong'; }
  else if (firstClear && d === 0 && ch.id === 6) { grantHero('jiangwei'); heroReward = 'jiangwei'; }
  else if (firstClear && (ch.id >= 3 || d > 0)) {
    shardReward = { hero: d > 0 || ch.id >= 4 ? 'lvbu' : 'zhuge', n: 10 + d * 5 };
    grantShards(shardReward.hero, shardReward.n);
  }
  const key = ck(d, ch.id);
  // 三星：第一次集齐三颗星送元宝
  const oldStars = save.stars[key] || 0;
  const allStars = oldStars | stars;
  let starBonus = 0;
  if (allStars !== oldStars) {
    save.stars[key] = allStars;
    if (starCount(allStars) === 3 && starCount(oldStars) < 3) { starBonus = (50 + 20 * ch.id) * (1 + d); yuanbao += starBonus; }
  }
  // 记录封顶在章节时长：打赢后敌将战还在走时间，不封顶比较的话每次打赢都会显示「新纪录」
  const capped = Math.min(ch.duration, Math.floor(t));
  const newBest = capped > (save.bests[key] || 0);
  if (newBest) save.bests[key] = capped;
  if (d === 0 && capped > (save.chapterBest[ch.id] || 0)) save.chapterBest[ch.id] = capped;
  save.gold += gold;
  save.iron += iron;
  save.yuanbao += yuanbao;
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  getPlatform().submitScore('score', bestScore());
  markDirty();
  return { win, firstClear, gold, iron, yuanbao, items, newBest, heroReward, shardReward, newSkills: newSkills?.length ? newSkills : undefined, stars, starBonus };
}

/** 守城关卡是否开放：第 1 关直接开放，之后要守住前一关 */
export function defenseOpen(level: number): boolean {
  return level <= 1 || (save.defense?.cleared || 0) >= level - 1;
}

/**
 * 守城模式结算：金币玄铁按关卡和坚守时间；胜利送元宝和碎片，每天第一次胜利碎片翻倍；
 * 第一次守住某一关额外送 80×关卡 元宝和碎片。
 */
export function settleDefense(level: number, win: boolean, t: number, coins: number, kills: number, bossKills: number, equipDrops: number, waves: number): RunResult {
  const ch = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, level - 1))];
  const dfs = (save.defense = save.defense || { best: 0, wins: 0, day: '', cleared: 0 });
  const progress = Math.min(1, t / 300);
  const today = new Date().toISOString().slice(0, 10);
  const dailyFirst = win && dfs.day !== today;
  const firstClear = win && level > (dfs.cleared || 0);
  const gold = Math.round(ch.goldBase * (0.2 + progress * 0.8) * (win ? 1.5 : 1) + coins * 2);
  const iron = Math.round(level * 2 + progress * 5 * level + (win ? 3 * level : 0));
  let yuanbao = win ? 20 + 4 * level : 0;
  if (firstClear) yuanbao += 80 * level;
  const items: EquipItem[] = [];
  for (let i = 0; i < equipDrops; i++) items.push(newItem(randomItemTemplate(), dropQuality(level, 0)));
  let shardReward: { hero: string; n: number } | undefined;
  const sn = win ? (2 + Math.ceil(level / 2)) * (dailyFirst ? 2 : 1) + (firstClear ? 5 : 0) : waves >= 6 ? 1 : 0;
  if (sn) { shardReward = { hero: randomShardHero(true), n: sn }; grantShards(shardReward.hero, sn); }
  const newBest = waves > dfs.best;
  if (newBest) dfs.best = waves;
  if (win) { dfs.wins++; dfs.day = today; if (firstClear) dfs.cleared = level; }
  save.gold += gold;
  save.iron += iron;
  save.yuanbao += yuanbao;
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  markDirty();
  return { win, firstClear, gold, iron, yuanbao, items, newBest, shardReward, defense: { waves, dailyFirst } };
}

/** 无尽模式结算：按坚持时间发奖励，每 5 分钟额外送碎片 */
export function settleEndless(t: number, coins: number, kills: number, bossKills: number, equipDrops: number): RunResult {
  const m = t / 60;
  const tier = Math.min(10, 1 + Math.floor(m / 3));
  const gold = Math.round(160 * m * (1 + save.maxCleared * 0.3) + coins * 2);
  const iron = Math.round(3 * m * (1 + save.maxCleared * 0.2));
  // 1.0.4：每 3 分钟一档（原来每 5 分钟 15 元宝、3 碎片），按分钟算总量不变
  const milestones = Math.floor(m / 3);
  const yuanbao = milestones * 9;
  const items: EquipItem[] = [];
  for (let i = 0; i < equipDrops; i++) items.push(newItem(randomItemTemplate(), dropQuality(tier, 0)));
  let shardReward: { hero: string; n: number } | undefined;
  if (milestones > 0) {
    shardReward = { hero: randomShardHero(true), n: milestones * 2 };
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

/** 每周挑战结算：基础奖励按击杀数，档位奖励见 goals.settleWeekly */
export function settleWeeklyRun(t: number, coins: number, kills: number, bossKills: number, equipDrops: number): RunResult {
  const gold = Math.round(kills * 2 * (1 + save.maxCleared * 0.2) + coins * 2);
  const iron = Math.round(kills / 40);
  const items: EquipItem[] = [];
  for (let i = 0; i < equipDrops; i++) items.push(newItem(randomItemTemplate(), dropQuality(Math.max(1, save.maxCleared), 0)));
  save.gold += gold;
  save.iron += iron;
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  getPlatform().submitScore('weekly', kills);
  markDirty();
  return { win: true, firstClear: false, gold, iron, yuanbao: 0, items, newBest: false };
}

/**
 * 推荐战力：普通难度按章节配置；困难/噩梦按难度倍率换算，章节越往后倍率略增（每章 +3.5%）。
 * 用模拟器校准：达到推荐战力时胜率约 65%～75%，只有 70% 战力时约 20%～30%。
 */
export function recommendedPower(ch: ChapterDef, diff: DifficultyDef): number {
  const k = diff.id > 0 ? 1 + 0.035 * (ch.id - 1) : 1;
  return Math.round((ch.power * diff.power * k) / 100) * 100;
}
