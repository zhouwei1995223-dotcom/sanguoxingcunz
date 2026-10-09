// 局外养成：武将、装备、军略、商店、任务、签到等配置

export const HERO = {
  id: 'zhaoyun',
  name: '赵云',
  title: '常山赵子龙',
  quote: '吾乃常山赵子龙也！',
  passive: '一身是胆：生命低于30%时，伤害提升30%',
  baseAtk: 20,
  baseHp: 120,
  atkPerLv: 2,
  hpPerLv: 10,
  moveSpeed: 78,
  pickup: 40,
  maxLevel: 80,
  startWeapon: 'spear' as const,
};

export function heroLevelCost(lv: number): number {
  return Math.round(80 * Math.pow(lv, 1.45) + 40);
}

// —— 装备 ——
export type Slot = 'weapon' | 'helm' | 'armor' | 'boots' | 'mount' | 'jade';
export const SLOTS: Slot[] = ['weapon', 'helm', 'armor', 'boots', 'mount', 'jade'];
export const SLOT_NAMES: Record<Slot, string> = { weapon: '兵器', helm: '头盔', armor: '铠甲', boots: '战靴', mount: '坐骑', jade: '佩饰' };
export const SLOT_ICONS: Record<Slot, string> = { weapon: 'e_weapon', helm: 'e_helm', armor: 'e_armor', boots: 'e_boots', mount: 'e_mount', jade: 'e_jade' };

export const QUALITY_NAMES = ['普通', '优良', '精良', '史诗', '传说', '神话'];
export const QUALITY_COLORS = ['#c0cbdc', '#63c74d', '#0099db', '#b55088', '#f77622', '#e43b44'];
export const QUALITY_MAX_LV = [10, 20, 30, 40, 50, 60];
export const QUALITY_STAT_MUL = [1, 1.6, 2.4, 3.6, 5.2, 7.5];

export interface StatBlock {
  atk?: number;
  hp?: number;
  def?: number; // 减伤 %
  speed?: number; // 移速 %
  crit?: number; // 暴击率 %
  critDmg?: number; // 暴击伤害 %
  dmg?: number; // 伤害 %
  pickup?: number; // 拾取 %
  exp?: number;
  gold?: number;
  cd?: number; // 冷却缩减 %
  area?: number;
  regen?: number; // 每秒回复
  bossDmg?: number; // 对首领伤害 %
}

export const STAT_NAMES: Record<keyof StatBlock, string> = {
  atk: '攻击', hp: '生命', def: '减伤', speed: '移速', crit: '暴击率', critDmg: '暴击伤害', dmg: '伤害',
  pickup: '拾取范围', exp: '经验获取', gold: '金币获取', cd: '冷却缩减', area: '技能范围', regen: '生命回复', bossDmg: '首领伤害',
};
export const PERCENT_STATS = new Set<keyof StatBlock>(['def', 'speed', 'crit', 'critDmg', 'dmg', 'pickup', 'exp', 'gold', 'cd', 'area', 'bossDmg']);

export interface EquipTemplate {
  id: string;
  slot: Slot;
  name: string;
  icon: string;
  base: StatBlock; // 普通 1 级的主属性
  perLv: StatBlock; // 每级成长
  /** 品质解锁的额外效果（达到该品质后生效） */
  unlocks: { q: number; stats: StatBlock; desc: string }[];
}

export const EQUIPS: EquipTemplate[] = [
  {
    id: 'yajiao', slot: 'weapon', name: '涯角枪', icon: 'e_weapon', base: { atk: 10 }, perLv: { atk: 1.2 },
    unlocks: [
      { q: 1, stats: { crit: 3 }, desc: '暴击率+3%' },
      { q: 2, stats: { dmg: 8 }, desc: '伤害+8%' },
      { q: 3, stats: { critDmg: 30 }, desc: '暴击伤害+30%' },
      { q: 4, stats: { dmg: 15 }, desc: '伤害+15%' },
      { q: 5, stats: { crit: 10 }, desc: '暴击率+10%' },
    ],
  },
  {
    id: 'pozhen', slot: 'weapon', name: '破阵戟', icon: 'w_spear_evo', base: { atk: 12 }, perLv: { atk: 1.3 },
    unlocks: [
      { q: 1, stats: { area: 5 }, desc: '技能范围+5%' },
      { q: 2, stats: { bossDmg: 15 }, desc: '首领伤害+15%' },
      { q: 3, stats: { area: 10 }, desc: '技能范围+10%' },
      { q: 4, stats: { bossDmg: 25 }, desc: '首领伤害+25%' },
      { q: 5, stats: { dmg: 20 }, desc: '伤害+20%' },
    ],
  },
  {
    id: 'yinshi', slot: 'helm', name: '银狮盔', icon: 'e_helm', base: { hp: 30 }, perLv: { hp: 4 },
    unlocks: [
      { q: 1, stats: { def: 2 }, desc: '减伤+2%' },
      { q: 2, stats: { regen: 0.3 }, desc: '每秒回复0.3生命' },
      { q: 3, stats: { def: 4 }, desc: '减伤+4%' },
      { q: 4, stats: { hp: 200 }, desc: '生命+200' },
      { q: 5, stats: { regen: 1 }, desc: '每秒回复1生命' },
    ],
  },
  {
    id: 'hutou', slot: 'helm', name: '虎头盔', icon: 'e_helm', base: { hp: 26, atk: 2 }, perLv: { hp: 3, atk: 0.3 },
    unlocks: [
      { q: 1, stats: { exp: 5 }, desc: '经验获取+5%' },
      { q: 2, stats: { atk: 15 }, desc: '攻击+15' },
      { q: 3, stats: { exp: 10 }, desc: '经验获取+10%' },
      { q: 4, stats: { dmg: 10 }, desc: '伤害+10%' },
      { q: 5, stats: { exp: 15 }, desc: '经验获取+15%' },
    ],
  },
  {
    id: 'longlin', slot: 'armor', name: '龙鳞甲', icon: 'e_armor', base: { hp: 40, def: 2 }, perLv: { hp: 5 },
    unlocks: [
      { q: 1, stats: { def: 2 }, desc: '减伤+2%' },
      { q: 2, stats: { hp: 120 }, desc: '生命+120' },
      { q: 3, stats: { def: 5 }, desc: '减伤+5%' },
      { q: 4, stats: { regen: 0.8 }, desc: '每秒回复0.8生命' },
      { q: 5, stats: { def: 8 }, desc: '减伤+8%' },
    ],
  },
  {
    id: 'mingguang', slot: 'armor', name: '明光铠', icon: 'e_armor', base: { hp: 48 }, perLv: { hp: 6 },
    unlocks: [
      { q: 1, stats: { hp: 40 }, desc: '生命+40' },
      { q: 2, stats: { def: 3 }, desc: '减伤+3%' },
      { q: 3, stats: { hp: 260 }, desc: '生命+260' },
      { q: 4, stats: { def: 6 }, desc: '减伤+6%' },
      { q: 5, stats: { hp: 600 }, desc: '生命+600' },
    ],
  },
  {
    id: 'tayun', slot: 'boots', name: '踏云靴', icon: 'e_boots', base: { hp: 18, speed: 2 }, perLv: { hp: 2.5 },
    unlocks: [
      { q: 1, stats: { speed: 2 }, desc: '移速+2%' },
      { q: 2, stats: { pickup: 15 }, desc: '拾取范围+15%' },
      { q: 3, stats: { speed: 4 }, desc: '移速+4%' },
      { q: 4, stats: { pickup: 30 }, desc: '拾取范围+30%' },
      { q: 5, stats: { speed: 6 }, desc: '移速+6%' },
    ],
  },
  {
    id: 'zhuifeng', slot: 'boots', name: '追风靴', icon: 'e_boots', base: { hp: 16, atk: 2 }, perLv: { hp: 2, atk: 0.3 },
    unlocks: [
      { q: 1, stats: { cd: 2 }, desc: '冷却缩减+2%' },
      { q: 2, stats: { speed: 3 }, desc: '移速+3%' },
      { q: 3, stats: { cd: 4 }, desc: '冷却缩减+4%' },
      { q: 4, stats: { speed: 5 }, desc: '移速+5%' },
      { q: 5, stats: { cd: 6 }, desc: '冷却缩减+6%' },
    ],
  },
  {
    id: 'yeshizi', slot: 'mount', name: '照夜玉狮子', icon: 'e_mount', base: { hp: 24, atk: 3 }, perLv: { hp: 3, atk: 0.4 },
    unlocks: [
      { q: 1, stats: { speed: 3 }, desc: '移速+3%' },
      { q: 2, stats: { dmg: 6 }, desc: '伤害+6%' },
      { q: 3, stats: { speed: 5 }, desc: '移速+5%' },
      { q: 4, stats: { dmg: 12 }, desc: '伤害+12%' },
      { q: 5, stats: { hp: 500, dmg: 10 }, desc: '生命+500，伤害+10%' },
    ],
  },
  {
    id: 'dilu', slot: 'mount', name: '的卢', icon: 'w_horse_evo', base: { hp: 30, atk: 2 }, perLv: { hp: 3.5, atk: 0.3 },
    unlocks: [
      { q: 1, stats: { def: 2 }, desc: '减伤+2%' },
      { q: 2, stats: { gold: 10 }, desc: '金币获取+10%' },
      { q: 3, stats: { def: 4 }, desc: '减伤+4%' },
      { q: 4, stats: { gold: 20 }, desc: '金币获取+20%' },
      { q: 5, stats: { def: 6 }, desc: '减伤+6%' },
    ],
  },
  {
    id: 'yupei', slot: 'jade', name: '蟠龙玉佩', icon: 'e_jade', base: { atk: 6 }, perLv: { atk: 0.7 },
    unlocks: [
      { q: 1, stats: { crit: 2 }, desc: '暴击率+2%' },
      { q: 2, stats: { critDmg: 20 }, desc: '暴击伤害+20%' },
      { q: 3, stats: { crit: 5 }, desc: '暴击率+5%' },
      { q: 4, stats: { critDmg: 40 }, desc: '暴击伤害+40%' },
      { q: 5, stats: { crit: 8, critDmg: 40 }, desc: '暴击率+8%，暴击伤害+40%' },
    ],
  },
  {
    id: 'huxin', slot: 'jade', name: '护心镜', icon: 'gear', base: { atk: 4, hp: 20 }, perLv: { atk: 0.5, hp: 2 },
    unlocks: [
      { q: 1, stats: { def: 2 }, desc: '减伤+2%' },
      { q: 2, stats: { regen: 0.4 }, desc: '每秒回复0.4生命' },
      { q: 3, stats: { def: 4 }, desc: '减伤+4%' },
      { q: 4, stats: { hp: 300 }, desc: '生命+300' },
      { q: 5, stats: { def: 6, regen: 1 }, desc: '减伤+6%，每秒回复1生命' },
    ],
  },
];

export const EQUIP_BY_ID: Record<string, EquipTemplate> = {};
EQUIPS.forEach((e) => (EQUIP_BY_ID[e.id] = e));

export function equipUpgradeCost(lv: number): { gold: number; iron: number } {
  return { gold: Math.round(60 + lv * 45 + lv * lv * 3), iron: 1 + Math.floor(lv / 3) };
}

// —— 军略（天赋）——
export interface TalentDef {
  id: string;
  name: string;
  icon: string;
  stat: keyof StatBlock | 'revive' | 'reroll';
  per: number;
  max: number;
  baseCost: number;
  costGrowth: number;
  unlockChapter: number; // 通关该章节后解锁（0 = 初始）
}

export const TALENTS: TalentDef[] = [
  { id: 't_atk', name: '武艺', icon: 'atk', stat: 'dmg', per: 3, max: 20, baseCost: 200, costGrowth: 1.22, unlockChapter: 0 },
  { id: 't_hp', name: '体魄', icon: 'hp', stat: 'hp', per: 15, max: 20, baseCost: 200, costGrowth: 1.22, unlockChapter: 0 },
  { id: 't_def', name: '铁壁', icon: 'def', stat: 'def', per: 1, max: 15, baseCost: 300, costGrowth: 1.25, unlockChapter: 0 },
  { id: 't_speed', name: '轻骑', icon: 'p_horseshoe', stat: 'speed', per: 1.5, max: 10, baseCost: 300, costGrowth: 1.25, unlockChapter: 0 },
  { id: 't_pickup', name: '洞察', icon: 'magnet', stat: 'pickup', per: 6, max: 10, baseCost: 250, costGrowth: 1.22, unlockChapter: 1 },
  { id: 't_exp', name: '博学', icon: 'p_seal', stat: 'exp', per: 3, max: 15, baseCost: 350, costGrowth: 1.24, unlockChapter: 1 },
  { id: 't_gold', name: '屯田', icon: 'gold', stat: 'gold', per: 4, max: 15, baseCost: 350, costGrowth: 1.24, unlockChapter: 1 },
  { id: 't_crit', name: '破绽', icon: 'star', stat: 'crit', per: 1, max: 10, baseCost: 500, costGrowth: 1.28, unlockChapter: 2 },
  { id: 't_cd', name: '神速', icon: 'p_book', stat: 'cd', per: 1, max: 10, baseCost: 600, costGrowth: 1.28, unlockChapter: 2 },
  { id: 't_regen', name: '调息', icon: 'p_lingzhi', stat: 'regen', per: 0.2, max: 10, baseCost: 500, costGrowth: 1.26, unlockChapter: 3 },
  { id: 't_reroll', name: '奇谋', icon: 'p_pouch', stat: 'reroll', per: 1, max: 3, baseCost: 3000, costGrowth: 2.5, unlockChapter: 3 },
  { id: 't_revive', name: '不屈', icon: 'revive', stat: 'revive', per: 1, max: 1, baseCost: 12000, costGrowth: 1, unlockChapter: 4 },
];

export function talentCost(t: TalentDef, lv: number): number {
  return Math.round(t.baseCost * Math.pow(t.costGrowth, lv));
}

// —— 体力 ——
export const STAMINA = { max: 30, costPerRun: 5, regenSeconds: 300, adGain: 10, adDailyLimit: 3 };

// —— 巡营（离线收益）——
export const PATROL = {
  maxHours: 12,
  minMinutes: 1,
  quickAdMinutes: 120,
  quickDailyLimit: 3,
  goldPerMin: (maxCleared: number) => 3 + maxCleared * 3,
  ironPerHour: (maxCleared: number) => 1 + maxCleared,
};

// —— 宝箱 ——
export interface ChestDef {
  id: 'wood' | 'gold';
  name: string;
  icon: string;
  cost: number; // 元宝
  adDaily: number; // 每日看广告免费次数
  weights: number[]; // 各品质权重
  pity?: number; // 保底：每 N 次必出武将（名将宝匣）
}
export const CHESTS: ChestDef[] = [
  { id: 'wood', name: '军资箱', icon: 'chest', cost: 60, adDaily: 3, weights: [60, 32, 8, 0, 0, 0] },
  { id: 'gold', name: '名将宝匣', icon: 'chest_gold', cost: 300, adDaily: 1, weights: [0, 50, 38, 11, 1, 0], pity: 15 },
];

// —— 七日签到 ——
export interface Reward {
  /** 直接获得武将（已拥有则转为碎片） */
  hero?: string;
  shards?: { hero: string; n: number };
  gold?: number;
  yuanbao?: number;
  iron?: number;
  stamina?: number;
  equip?: { q: number; id?: string };
}
export const SIGNIN: Reward[] = [
  { gold: 500 },
  { yuanbao: 60 },
  { iron: 15 },
  { stamina: 20 },
  { gold: 2000 },
  { yuanbao: 120 },
  { hero: 'zhangfei', yuanbao: 100 },
];

// —— 每日任务 ——
export type TaskKind = 'login' | 'battle' | 'kill' | 'ad' | 'upgrade' | 'patrol' | 'chest' | 'boss';
export interface TaskDef {
  id: string;
  kind: TaskKind;
  name: string;
  target: number;
  points: number;
}
export const DAILY_TASKS: TaskDef[] = [
  { id: 'd_login', kind: 'login', name: '登录游戏', target: 1, points: 10 },
  { id: 'd_battle', kind: 'battle', name: '完成2次征战', target: 2, points: 20 },
  { id: 'd_kill', kind: 'kill', name: '累计击败500名敌人', target: 500, points: 20 },
  { id: 'd_boss', kind: 'boss', name: '击败1名敌将', target: 1, points: 15 },
  { id: 'd_ad', kind: 'ad', name: '观看2次视频', target: 2, points: 15 },
  { id: 'd_upgrade', kind: 'upgrade', name: '强化装备或军略3次', target: 3, points: 10 },
  { id: 'd_patrol', kind: 'patrol', name: '领取巡营收益', target: 1, points: 5 },
  { id: 'd_chest', kind: 'chest', name: '开启1次宝箱', target: 1, points: 5 },
];
export const ACTIVITY_REWARDS: { points: number; reward: Reward }[] = [
  { points: 20, reward: { gold: 300 } },
  { points: 40, reward: { iron: 5 } },
  { points: 60, reward: { stamina: 10 } },
  { points: 80, reward: { yuanbao: 50 } },
  { points: 100, reward: { equip: { q: 2 }, shards: { hero: 'zhuge', n: 5 } } },
];

// —— 商店日常 ——
export const SHOP_DAILY = {
  adShards: { amount: 4, limit: 2 },
  adYuanbao: { amount: 40, limit: 5 },
  adGold: { minutes: 120, limit: 3 },
  freeGift: { gold: 200 },
};

/** 侧边栏复访奖励（抖音） */
export const SIDEBAR_REWARD: Reward = { yuanbao: 50, stamina: 10 };

/** 新玩家初始资源 */
export const NEW_PLAYER = { gold: 300, yuanbao: 100, iron: 10, stamina: 30 };
