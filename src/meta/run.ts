import { ChapterDef } from '../data/chapters';
import { weighted } from '../core/math';
import { save, markDirty } from './save';
import { newItem, randomItemTemplate, progressTask } from './ops';
import type { EquipItem } from './save';
import { getPlatform } from '../platform';

// 单局结算

const DROP_WEIGHTS: number[][] = [
  [60, 40, 0, 0, 0, 0],
  [30, 50, 20, 0, 0, 0],
  [0, 50, 40, 10, 0, 0],
  [0, 30, 50, 18, 2, 0],
  [0, 0, 50, 40, 9, 1],
];
const FIRST_CLEAR_Q = [1, 2, 2, 3, 3];

export interface RunResult {
  win: boolean;
  firstClear: boolean;
  gold: number;
  iron: number;
  yuanbao: number;
  items: EquipItem[];
  newBest: boolean;
}

export function settleRun(ch: ChapterDef, win: boolean, t: number, coins: number, kills: number, bossKills: number, equipDrops: number): RunResult {
  const progress = Math.min(1, t / ch.duration);
  const gold = Math.round(ch.goldBase * (0.2 + progress * 0.8) * (win ? 1.5 : 1) + coins * 2);
  const iron = Math.round(ch.id * 2 + progress * 6 * ch.id + (win ? 4 * ch.id : 0));
  let yuanbao = win ? 20 * ch.id : 0;
  const items: EquipItem[] = [];
  const weights = DROP_WEIGHTS[ch.id - 1];
  for (let i = 0; i < equipDrops; i++) {
    const q = weighted([0, 1, 2, 3, 4, 5], (k) => weights[k]);
    items.push(newItem(randomItemTemplate(), q));
  }
  let firstClear = false;
  if (win && !save.firstClear[ch.id]) {
    firstClear = true;
    save.firstClear[ch.id] = true;
    yuanbao += 100 * ch.id;
    // 第一章首通必得兵器，引导玩家体验装备系统
    items.push(newItem(ch.id === 1 ? 'yajiao' : randomItemTemplate(), FIRST_CLEAR_Q[ch.id - 1]));
  }
  // 新手首局：无论胜负都赠送兵器，保证装备引导可以进行
  if (save.guide === 0 && !save.items.some((i) => i.tid === 'yajiao')) items.push(newItem('yajiao', 1));
  if (win && ch.id > save.maxCleared) save.maxCleared = ch.id;
  const newBest = t >= (save.chapterBest[ch.id] || 0);
  save.gold += gold;
  save.iron += iron;
  save.yuanbao += yuanbao;
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  // 排行榜分数：章节 * 10000 + 存活秒数
  const score = (win ? ch.id : ch.id - 1) * 10000 + Math.floor(progress * ch.duration);
  getPlatform().submitScore('score', Math.max(score, bestScore()));
  markDirty();
  return { win, firstClear, gold, iron, yuanbao, items, newBest };
}

export function bestScore(): number {
  let best = 0;
  for (const k in save.chapterBest) {
    const id = +k;
    const sec = save.chapterBest[id];
    const cleared = save.firstClear[id];
    best = Math.max(best, (cleared ? id : id - 1) * 10000 + sec);
  }
  return best;
}
