import { skillsUnlockedAt } from '../data/skills';
import { ChapterDef, DifficultyDef, CHAPTERS, WEB_CAMPAIGN_POWER } from '../data/chapters';
import { WEB_RULES } from '../data/platformConfig';
import { weighted } from '../core/math';
import { save, markDirty } from './save';
import { newItem, randomItemTemplate, progressTask, grantHero, grantShards, randomShardHero } from './ops';
import type { EquipItem } from './save';
import { getPlatform } from '../platform';
import { TOWER_MAPS } from '../data/tower';
import type { TowerBattle } from '../battle/tower';

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
// 掉落和首通奖励最高为神话，无双通过同部位装备合成。
const MAX_DROP_QUALITY = DROP_WEIGHTS[0].length - 1;
export const firstClearQuality = (chapter: number, difficulty: number) =>
  Math.min(MAX_DROP_QUALITY, FIRST_CLEAR_Q[chapter - 1] + difficulty);

/** 每辆粮车的军饷与元宝。截获暂记在战斗内，通关时一起发放。 */
export function convoyReward(ch: ChapterDef, diff: DifficultyDef) {
  return { gold: Math.round(ch.goldBase * 0.18 * diff.reward), yuanbao: Math.round(2 * ch.id * diff.reward) };
}

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
  for (let i = 0; i < shift; i++) if (q < MAX_DROP_QUALITY && Math.random() < 0.5) q++;
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
  /** 长局实际打过的波次给基础军饷和玄铁带来的倍率。 */
  materialMultiplier?: number;
  convoyLoot?: { count: number; gold: number; yuanbao: number };
  /** 天机签：本局是否在每日奖励次数内、今天还剩几次 */
  tianji?: { rewarded: boolean; left: number; dmg: number; newDmgBest: boolean };
}

/** 三星评价：通关 / 不复活 / 限时击败最终敌将 */
export const STAR_BOSS_SEC = 80;
export const THREE_STARS = 0b111;
export const STAR_LABELS = ['通关', '不复活', `${STAR_BOSS_SEC}秒内击败最终敌将`];
export function runStars(win: boolean, revives: number, finalBossSec: number): number {
  if (!win) return 0;
  return 1 | (revives === 0 ? 2 : 0) | (finalBossSec >= 0 && finalBossSec <= STAR_BOSS_SEC ? 4 : 0);
}
export const starCount = (bits: number) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
/** 某难度某章拿到过的星 */
export const chapterStars = (d: number, chId: number) => save.stars[ck(d, chId)] || 0;
export const defenseStars = (level: number) => save.defense?.stars?.[level] ?? ((save.defense?.cleared || 0) >= level ? 1 : 0);
export function starRating(bits: number): string {
  const n = starCount(bits);
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

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

/** 网页版 t 为 null 表示碾压：首次达到三星正常发奖，已有三星只给物资。 */
export function settleRun(ch: ChapterDef, diff: DifficultyDef, win: boolean, t: number | null, coins: number, kills: number, bossKills: number, equipDrops: number, stars = 0, skippedSeconds = 0, captured = 0): RunResult {
  const d = diff.id;
  const key = ck(d, ch.id);
  const oldStars = chapterStars(d, ch.id);
  const sweep = t === null;
  if (sweep && win) stars = THREE_STARS;
  const paysYuanbao = win && (!sweep || oldStars !== THREE_STARS);
  const progress = t === null ? 1 : Math.min(1, t / ch.duration);
  // 前五分钟按标准发放。后五分钟的材料加成只累计实际战斗波次，不计跳过的波次或主将加时。
  const waveSeconds = Math.min(t ?? 0, ch.duration) - skippedSeconds;
  const materialMultiplier = ch.campaignMinutes === 10 ? 1 + 0.8 * Math.max(0, Math.min(1, (waveSeconds - 300) / 300)) : 1;
  let gold = Math.round(ch.goldBase * (0.2 + progress * 0.8) * (win ? 1.5 : 1) * diff.reward * materialMultiplier + coins * 2);
  const iron = Math.round((ch.id * 2 + progress * 6 * ch.id + (win ? 4 * ch.id : 0)) * diff.reward * materialMultiplier);
  let yuanbao = paysYuanbao ? Math.round(20 * ch.id * diff.reward) : 0;
  let convoyLoot: RunResult['convoyLoot'];
  if (WEB_RULES && ch.campaignMinutes && t !== null && captured > 0) {
    const count = Math.min(3, Math.floor(captured));
    const unit = convoyReward(ch, diff);
    convoyLoot = { count, gold: win ? unit.gold * count : 0, yuanbao: win ? unit.yuanbao * count : 0 };
    gold += convoyLoot.gold;
    yuanbao += convoyLoot.yuanbao;
  }
  const items: EquipItem[] = [];
  for (let i = 0; i < equipDrops; i++) items.push(newItem(randomItemTemplate(), dropQuality(ch.id, diff.qShift)));
  const firstClear = win && !isCleared(d, ch.id);
  if (firstClear) {
    save.clears[ck(d, ch.id)] = true;
    if (d === 0) save.firstClear[ch.id] = true;
    if (paysYuanbao) yuanbao += 100 * ch.id * (1 + d);
    // 第一章首通必得兵器，引导玩家体验装备系统
    items.push(newItem(ch.id === 1 && d === 0 ? 'yajiao' : randomItemTemplate(), firstClearQuality(ch.id, d)));
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
  // 三星：第一次集齐三颗星送元宝
  // 网页征战按单局最佳保留星级，避免两种模式的不同条件拼出三星。
  const allStars = ch.campaignMinutes
    ? (starCount(stars) > starCount(oldStars) ? stars : oldStars)
    : oldStars | stars;
  let starBonus = 0;
  if (allStars !== oldStars) save.stars[key] = allStars;
  if (win && allStars === THREE_STARS && oldStars !== THREE_STARS) {
    starBonus = (50 + 20 * ch.id) * (1 + d);
    yuanbao += starBonus;
  }
  // 记录封顶在章节时长：打赢后敌将战还在走时间，不封顶比较的话每次打赢都会显示「新纪录」
  const capped = Math.min(ch.duration, Math.floor(t ?? 0));
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
  return { win, firstClear, gold, iron, yuanbao, items, newBest, heroReward, shardReward, newSkills: newSkills?.length ? newSkills : undefined, stars, starBonus, materialMultiplier, convoyLoot };
}

/** 守城关卡是否开放：第 1 关直接开放，之后要守住前一关 */
export function defenseOpen(level: number): boolean {
  return level <= 1 || (save.defense?.cleared || 0) >= level - 1;
}

/**
 * 守城模式结算：金币玄铁按关卡和坚守时间；胜利送元宝和碎片，每天第一次胜利碎片翻倍；
 * 第一次守住某一关额外送 80×关卡 元宝和碎片。
 */
export function settleDefense(level: number, win: boolean, t: number | null, coins: number, kills: number, bossKills: number, equipDrops: number, waves: number, stars?: number): RunResult {
  const ch = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, level - 1))];
  const dfs = (save.defense = save.defense || { best: 0, wins: 0, day: '', cleared: 0 });
  const oldStars = defenseStars(level);
  const sweep = t === null;
  if (sweep && win) stars = THREE_STARS;
  const progress = t === null ? 1 : Math.min(1, t / 300);
  const today = new Date().toISOString().slice(0, 10);
  const dailyFirst = win && dfs.day !== today;
  const firstClear = win && level > (dfs.cleared || 0);
  const gold = Math.round(ch.goldBase * (0.2 + progress * 0.8) * (win ? 1.5 : 1) + coins * 2);
  const iron = Math.round(level * 2 + progress * 5 * level + (win ? 3 * level : 0));
  const paysYuanbao = win && (!sweep || oldStars !== THREE_STARS);
  let yuanbao = paysYuanbao ? 20 + 4 * level : 0;
  if (paysYuanbao && firstClear) yuanbao += 80 * level;
  const items: EquipItem[] = [];
  for (let i = 0; i < equipDrops; i++) items.push(newItem(randomItemTemplate(), dropQuality(level, 0)));
  let shardReward: { hero: string; n: number } | undefined;
  const sn = win ? (2 + Math.ceil(level / 2)) * (dailyFirst ? 2 : 1) + (firstClear ? 5 : 0) : waves >= 6 ? 1 : 0;
  if (sn) { shardReward = { hero: randomShardHero(true), n: sn }; grantShards(shardReward.hero, sn); }
  const newBest = waves > dfs.best;
  if (newBest) dfs.best = waves;
  if (win && stars !== undefined && starCount(stars) > starCount(oldStars)) {
    (dfs.stars ??= {})[level] = stars;
  }
  if (win) { dfs.wins++; dfs.day = today; if (firstClear) dfs.cleared = level; }
  save.gold += gold;
  save.iron += iron;
  save.yuanbao += yuanbao;
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  markDirty();
  return { win, firstClear, gold, iron, yuanbao, items, newBest, shardReward, defense: { waves, dailyFirst }, stars };
}

export function settleTower(b: TowerBattle) {
  const state = save.tower, level = b.map.id, stars = b.stars;
  const old = state.stars[level] || 0;
  const first = stars > 0 && old === 0;
  const perfect = stars === 3 && old < 3;
  const gold = level * (Math.floor(b.progress * 270) + (stars ? 150 : 0));
  const iron = level * (Math.floor(b.progress * 5) + (stars ? 5 : 0));
  const yuanbao = (stars ? 12 * level : 0) + (first ? 60 * level : 0) + (perfect ? 40 * level : 0);
  const shards = stars ? { hero: randomShardHero(true), n: level + 1 } : undefined;
  if (stars) {
    state.stars[level] = Math.max(stars, old);
    while (state.cleared < TOWER_MAPS.length && state.stars[state.cleared + 1]) state.cleared++;
    state.wins++;
  }
  state.runs++; state.leaks += b.leaks; state.kills += b.kills;
  save.gold += gold; save.iron += iron; save.yuanbao += yuanbao;
  if (shards) grantShards(shards.hero, shards.n);
  markDirty();
  return { gold, iron, yuanbao, shards, first, perfect, stars };
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

/** 天机签每天前几局有元宝 / 碎片奖励 */
export const TIANJI_DAILY = 3;

/** 天机签结算：不耗体力；每天前 3 局给元宝和碎片（按存活时间，活满十分钟另加），之后只给少量金币 */
/** finalDmg：对天命之主造成的伤害（排行榜分数） */
export function settleTianji(win: boolean, t: number, kills: number, bossKills: number, history: number[], finalDmg = 0): RunResult {
  const st = save.tianji;
  const used = save.daily.tianjiRuns || 0;
  const rewarded = used < TIANJI_DAILY;
  save.daily.tianjiRuns = used + 1;
  const m = Math.min(10, t / 60);
  const gold = Math.round(60 * m + kills * 0.2);
  let yuanbao = 0;
  let shardReward: { hero: string; n: number } | undefined;
  if (rewarded) {
    yuanbao = Math.round(5 * m) + (win ? 20 : 0);
    const n = Math.floor(m / 3) + (win ? 2 : 0);
    if (n > 0) { shardReward = { hero: randomShardHero(true), n }; grantShards(shardReward.hero, n); }
  }
  save.gold += gold;
  save.yuanbao += yuanbao;
  st.runs++;
  if (win) st.wins++;
  const newBest = Math.floor(t) > st.best;
  if (newBest) st.best = Math.floor(t);
  st.bestTop = Math.max(st.bestTop, history.filter((x) => x === 0).length);
  const dmg = Math.round(finalDmg);
  const newDmgBest = dmg > st.bestDmg;
  if (newDmgBest) st.bestDmg = dmg;
  if (dmg > 0) {
    st.top.push({ dmg, day: new Date().toISOString().slice(0, 10) });
    st.top.sort((a, c) => c.dmg - a.dmg);
    st.top.length = Math.min(st.top.length, 5);
  }
  if (st.bestDmg > 0) getPlatform().submitScore('tianji', st.bestDmg);
  progressTask('battle', 1);
  progressTask('kill', kills);
  if (bossKills) progressTask('boss', bossKills);
  markDirty();
  return { win, firstClear: win && st.wins === 1, gold, iron: 0, yuanbao, items: [], newBest, shardReward, best: st.best, tianji: { rewarded, left: Math.max(0, TIANJI_DAILY - used - 1), dmg, newDmgBest } };
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

export function legacyChapterPower(ch: ChapterDef, diff: DifficultyDef): number {
  const k = diff.id > 0 ? 1 + 0.035 * (ch.id - 1) : 1;
  return Math.round((ch.power * diff.power * k) / 100) * 100;
}

/** 网页征战区分时长，其余平台沿用原有推荐值。 */
export function recommendedPower(ch: ChapterDef, diff: DifficultyDef, minutes = ch.campaignMinutes ?? 5): number | null {
  if (WEB_RULES && !ch.defense && !ch.endless && !ch.tutorial) return WEB_CAMPAIGN_POWER[minutes][diff.id][ch.id - 1];
  return legacyChapterPower(ch, diff);
}

export function powerGuideText(value: number | null): string {
  if (value === null) return '极限挑战';
  return value < 10000 ? String(value) : `${+(value / 10000).toFixed(2)}万`;
}
