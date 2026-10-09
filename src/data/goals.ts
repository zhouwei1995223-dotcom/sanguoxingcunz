import type { Reward, StatBlock } from './meta';

// 成就、新手七日目标、每周挑战、武将皮肤、装备套装

/** 可被目标引用的统计指标（由 meta/goals.ts 计算） */
export type Metric =
  | 'runs' | 'kills' | 'bossKills' | 'wins' | 'maxCleared' | 'hardClears' | 'nightmareClears' | 'endlessBest'
  | 'heroesOwned' | 'maxStar' | 'totalStars' | 'heroLvMax' | 'bestCombo' | 'ults' | 'evos' | 'chests' | 'upgrades'
  | 'ads' | 'signin' | 'mythic' | 'codexBosses' | 'weeklyBest';

export interface GoalDef {
  id: string;
  name: string;
  metric: Metric;
  target: number;
  reward: Reward;
}

// —— 成就（分档）——
function tiers(id: string, label: (n: number) => string, metric: Metric, targets: number[], rewards: Reward[]): GoalDef[] {
  return targets.map((t, i) => ({ id: `${id}_${i}`, name: label(t), metric, target: t, reward: rewards[i] || rewards[rewards.length - 1] }));
}

export const ACHIEVEMENTS: GoalDef[] = [
  ...tiers('kill', (n) => `累计击败${n >= 10000 ? n / 10000 + '万' : n}名敌人`, 'kills', [1000, 10000, 100000, 1000000], [{ gold: 1000 }, { yuanbao: 100 }, { yuanbao: 300 }, { yuanbao: 800 }]),
  ...tiers('boss', (n) => `斩杀${n}名敌将`, 'bossKills', [5, 30, 100, 300], [{ gold: 2000 }, { yuanbao: 100 }, { shards: { hero: 'lvbu', n: 10 } }, { yuanbao: 500 }]),
  ...tiers('chapter', (n) => `通关第${n}章`, 'maxCleared', [1, 3, 5, 8, 10], [{ yuanbao: 50 }, { yuanbao: 100 }, { yuanbao: 200 }, { yuanbao: 300 }, { yuanbao: 600 }]),
  ...tiers('hard', (n) => `困难难度通关${n}章`, 'hardClears', [1, 5, 10], [{ yuanbao: 150 }, { yuanbao: 300 }, { yuanbao: 600 }]),
  ...tiers('nightmare', (n) => `噩梦难度通关${n}章`, 'nightmareClears', [1, 5, 10], [{ yuanbao: 300 }, { yuanbao: 600 }, { yuanbao: 1200 }]),
  ...tiers('endless', (n) => `无尽模式坚持${n / 60}分钟`, 'endlessBest', [300, 600, 1200, 1800], [{ gold: 3000 }, { yuanbao: 150 }, { yuanbao: 300 }, { shards: { hero: 'lvbu', n: 20 } }]),
  ...tiers('heroes', (n) => `拥有${n}名武将`, 'heroesOwned', [2, 3, 5], [{ yuanbao: 100 }, { yuanbao: 200 }, { yuanbao: 500 }]),
  ...tiers('star', (n) => `任意武将升至${n}星`, 'maxStar', [2, 3, 5], [{ iron: 30 }, { yuanbao: 200 }, { yuanbao: 600 }]),
  ...tiers('combo', (n) => `单局达成${n}连斩`, 'bestCombo', [100, 500, 1000, 3000], [{ gold: 1000 }, { yuanbao: 100 }, { yuanbao: 200 }, { yuanbao: 400 }]),
  ...tiers('ult', (n) => `释放大招${n}次`, 'ults', [10, 100, 500], [{ gold: 1500 }, { yuanbao: 100 }, { yuanbao: 300 }]),
  ...tiers('evo', (n) => `进化神兵${n}次`, 'evos', [1, 20, 100], [{ gold: 1000 }, { yuanbao: 100 }, { yuanbao: 300 }]),
  ...tiers('chest', (n) => `开启宝箱${n}次`, 'chests', [10, 50, 200], [{ iron: 20 }, { yuanbao: 100 }, { yuanbao: 300 }]),
  ...tiers('mythic', (n) => `拥有${n}件神话装备`, 'mythic', [1, 6], [{ yuanbao: 500 }, { yuanbao: 1500 }]),
  ...tiers('codex', (n) => `图鉴点亮${n}名敌将`, 'codexBosses', [5, 10, 20], [{ yuanbao: 100 }, { yuanbao: 200 }, { yuanbao: 500 }]),
];

// —— 新手七日目标 ——
export const NEWBIE_DAYS: GoalDef[][] = [
  [
    { id: 'n1a', name: '完成1次征战', metric: 'runs', target: 1, reward: { gold: 500 } },
    { id: 'n1b', name: '武将升至3级', metric: 'heroLvMax', target: 3, reward: { iron: 10 } },
    { id: 'n1c', name: '完成1次签到', metric: 'signin', target: 1, reward: { yuanbao: 50 } },
  ],
  [
    { id: 'n2a', name: '通关第1章', metric: 'maxCleared', target: 1, reward: { yuanbao: 80 } },
    { id: 'n2b', name: '开启1次宝箱', metric: 'chests', target: 1, reward: { gold: 800 } },
    { id: 'n2c', name: '强化3次', metric: 'upgrades', target: 3, reward: { iron: 15 } },
  ],
  [
    { id: 'n3a', name: '通关第2章', metric: 'maxCleared', target: 2, reward: { yuanbao: 100 } },
    { id: 'n3b', name: '释放大招5次', metric: 'ults', target: 5, reward: { gold: 1000 } },
    { id: 'n3c', name: '累计击败2000名敌人', metric: 'kills', target: 2000, reward: { stamina: 15 } },
  ],
  [
    { id: 'n4a', name: '拥有2名武将', metric: 'heroesOwned', target: 2, reward: { shards: { hero: 'zhuge', n: 5 } } },
    { id: 'n4b', name: '观看3次视频', metric: 'ads', target: 3, reward: { yuanbao: 60 } },
    { id: 'n4c', name: '进化1次神兵', metric: 'evos', target: 1, reward: { iron: 20 } },
  ],
  [
    { id: 'n5a', name: '通关第3章', metric: 'maxCleared', target: 3, reward: { yuanbao: 120 } },
    { id: 'n5b', name: '无尽模式坚持5分钟', metric: 'endlessBest', target: 300, reward: { gold: 2000 } },
    { id: 'n5c', name: '单局达成300连斩', metric: 'bestCombo', target: 300, reward: { shards: { hero: 'zhuge', n: 5 } } },
  ],
  [
    { id: 'n6a', name: '通关第4章', metric: 'maxCleared', target: 4, reward: { yuanbao: 150 } },
    { id: 'n6b', name: '强化20次', metric: 'upgrades', target: 20, reward: { iron: 30 } },
    { id: 'n6c', name: '斩杀10名敌将', metric: 'bossKills', target: 10, reward: { stamina: 20 } },
  ],
  [
    { id: 'n7a', name: '通关第5章', metric: 'maxCleared', target: 5, reward: { yuanbao: 200 } },
    { id: 'n7b', name: '任意武将升至2星', metric: 'maxStar', target: 2, reward: { shards: { hero: 'lvbu', n: 10 } } },
    { id: 'n7c', name: '累计击败20000名敌人', metric: 'kills', target: 20000, reward: { gold: 5000 } },
  ],
];

/** 完成目标数达到要求后领取的大奖 */
export const NEWBIE_PRIZES: { need: number; reward: Reward; label: string }[] = [
  { need: 7, reward: { yuanbao: 300 }, label: '元宝×300' },
  { need: 14, reward: { shards: { hero: 'lvbu', n: 20 } }, label: '吕布碎片×20' },
  { need: 21, reward: { hero: 'zhuge' }, label: '武将诸葛亮' },
];

/** 新手目标开放天数 */
export const NEWBIE_WINDOW_DAYS = 14;

// —— 每周挑战 ——
export interface WeeklyDef {
  id: string;
  name: string;
  desc: string;
  pool?: [string, number][]; // 替换敌人池
  playerDmg?: number;
  playerHp?: number;
  enemyHp?: number;
  bossEvery?: number; // 首领间隔（秒）
  gameSpeed?: number;
  expMul?: number;
  bonusWeapon?: string;
}

export const WEEKLY_CHALLENGES: WeeklyDef[] = [
  { id: 'cavalry', name: '骑兵狂潮', desc: '敌军全部换成骑兵，速度极快', pool: [['wei_cavalry', 5], ['tiger_cavalry', 3], ['yuan_cavalry', 3], ['wu_cavalry', 3]] },
  { id: 'glass', name: '玻璃大炮', desc: '伤害×2.5，但生命只有35%', playerDmg: 2.5, playerHp: 0.35 },
  { id: 'bosses', name: '车轮大战', desc: '每50秒出现一名敌将', bossEvery: 50, enemyHp: 0.8 },
  { id: 'fire', name: '火烧连营', desc: '开局获得火油罐，敌人生命+50%', bonusWeapon: 'fire', enemyHp: 1.5 },
  { id: 'speed', name: '风驰电掣', desc: '战斗速度×1.35，经验获取×1.5', gameSpeed: 1.35, expMul: 1.5 },
];

export const WEEKLY_DURATION = 480;
export const WEEKLY_TIERS: { kills: number; reward: Reward }[] = [
  { kills: 600, reward: { yuanbao: 60, gold: 2000 } },
  { kills: 1500, reward: { yuanbao: 120, iron: 30 } },
  { kills: 3000, reward: { shards: { hero: 'lvbu', n: 10 }, yuanbao: 200 } },
];

// —— 武将皮肤 ——
export interface SkinDef {
  hero: string;
  name: string;
  ads: number; // 观看视频次数解锁
  bonus: string;
}
export const SKINS: Record<string, SkinDef> = {
  zhaoyun: { hero: 'zhaoyun', name: '白龙银铠', ads: 6, bonus: '伤害+5%' },
  guanyu: { hero: 'guanyu', name: '赤兔武圣', ads: 6, bonus: '伤害+5%' },
  zhangfei: { hero: 'zhangfei', name: '燕山猛虎', ads: 6, bonus: '伤害+5%' },
  zhuge: { hero: 'zhuge', name: '天枢紫袍', ads: 6, bonus: '伤害+5%' },
  lvbu: { hero: 'lvbu', name: '暗金魔神', ads: 8, bonus: '伤害+5%' },
};
export const SKIN_DMG_BONUS = 5;

// —— 装备套装 ——
export interface SetDef {
  id: string;
  name: string;
  pieces: string[]; // 装备模板 id
  bonus: { n: number; stats: StatBlock; desc: string }[];
}
export const EQUIP_SETS: SetDef[] = [
  {
    id: 'longdan', name: '龙胆套装', pieces: ['yajiao', 'yinshi', 'longlin', 'tayun', 'yeshizi', 'yupei'],
    bonus: [
      { n: 2, stats: { crit: 5 }, desc: '暴击率+5%' },
      { n: 4, stats: { dmg: 10 }, desc: '伤害+10%' },
      { n: 6, stats: { dmg: 15, critDmg: 30 }, desc: '伤害+15%，暴击伤害+30%' },
    ],
  },
  {
    id: 'huwei', name: '虎威套装', pieces: ['pozhen', 'hutou', 'mingguang', 'zhuifeng', 'dilu', 'huxin'],
    bonus: [
      { n: 2, stats: { def: 4 }, desc: '减伤+4%' },
      { n: 4, stats: { hp: 300, regen: 1 }, desc: '生命+300，每秒回复1生命' },
      { n: 6, stats: { bossDmg: 25, def: 6 }, desc: '首领伤害+25%，减伤+6%' },
    ],
  },
];
