import { CHAPTERS, ChapterDef } from './chapters';

// 守城模式：城池在地图正中，敌军从四面来攻。一局 5 分钟，4:00 敌军主将压阵，撑到 5:00 或击败主将即胜利。
// 资源「粮草」随时间和击杀增加，在右侧按钮召唤兵种 / 武将（做法 B）；升级三选一里会出现「军令」卡（兵种、城防）和军令联动。

export const DEFENSE_DURATION = 300;
/** 中途敌将 / 主将登场时间 */
export const DEFENSE_MID_AT = 150, DEFENSE_BOSS_AT = 240;
/** 敌人从离城多远的地方出现 */
export const DEFENSE_SPAWN_R = 385;
/** 武将最远能离开城池多远 */
export const DEFENSE_LEASH = 300;
/** 城池碰撞半径（城墙外沿） */
export const CITY_R = 52;
/**
 * 战场地形：一圈山林（内沿半径 ARENA_R，厚 WALL_W），东南西北各留一个出怪口（半张角 GATE_HALF）。
 * 武将、士兵出不去，敌人只能从四个出怪口进来。
 */
export const ARENA_R = 300, WALL_W = 40, GATE_HALF = 0.15;
/** 士兵和召唤武将离主城最远多少（只迎击这个范围附近的敌人，出怪口交给建筑） */
export const ALLY_LEASH = 175;
/** 守城主打策略：武将本人的伤害只剩这么多，主要靠兵种和建筑 */
export const DEF_HERO_DMG = 0.4;

/** 建筑：在出怪口附近的建造点（每个门左右各一个）用粮草建造，可升到 3 级 */
export type BuildKind = 'tower' | 'cata' | 'spike';
export interface BuildDef { kind: BuildKind; name: string; icon: string; cost: number; desc: string }
export const BUILDS: Record<BuildKind, BuildDef> = {
  tower: { kind: 'tower', name: '箭塔', icon: 'w_crossbow', cost: 90, desc: '射程远，连续射击单个敌人' },
  cata: { kind: 'cata', name: '投石台', icon: 'w_catapult', cost: 140, desc: '投出巨石，范围伤害' },
  spike: { kind: 'spike', name: '拒马阵', icon: 'w_caltrop', cost: 70, desc: '减速并刺伤经过的敌人' },
};
export const BUILD_KINDS: BuildKind[] = ['tower', 'cata', 'spike'];
export const BUILD_MAX_LV = 3;
/** 升到第 n 级的花费倍率（建造是 1 级） */
export const buildCost = (kind: BuildKind, toLv: number) => Math.round(BUILDS[kind].cost * [1, 1, 1.5, 2.2][toLv]);
/** 建造点：每个出怪口内侧左右各一个 */
export const BUILD_SLOTS: [number, number][] = [];
for (let s = 0; s < 4; s++) for (const off of [-0.33, 0.33]) { const a = s * (Math.PI / 2) + off; BUILD_SLOTS.push([Math.cos(a) * 232, Math.sin(a) * 232]); }
/**
 * 守城十关：每关的敌人强度（血量 / 攻击倍率、兵种、敌将、场景）取对应章节，
 * 固定不随玩家战力变化——战力高打低关卡照样轻松；推荐战力比同序号章节高 10%（同战力下比章节稍难）。
 */
export const DEFENSE_HP_K = 0.62, DEFENSE_DMG_K = 0.68, DEFENSE_POWER_K = 1.1;
export const DEFENSE_LEVELS: { name: string; subtitle: string; story: string }[] = [
  { name: '新野', subtitle: '火烧博望', story: '曹军南下，先锋直逼新野。守住小城，为主公撤往樊城争取时间！' },
  { name: '江夏', subtitle: '刘琦固守', story: '当阳兵败，退守江夏。曹军顺流而下，务必守住这最后的落脚之地。' },
  { name: '公安', subtitle: '荆州根本', story: '刘备屯兵公安，孙曹两家都虎视眈眈。城不可失！' },
  { name: '葭萌关', subtitle: '霍峻死守', story: '霍峻以数百兵马坚守葭萌一年，今日轮到你来守这道关隘。' },
  { name: '阳平关', subtitle: '汉中门户', story: '夏侯渊大军压境，阳平关一失，汉中门户洞开。' },
  { name: '剑阁', subtitle: '一夫当关', story: '剑阁峥嵘而崔嵬，一夫当关，万夫莫开。钟会十万大军来攻！' },
  { name: '白帝城', subtitle: '永安托孤', story: '夷陵之后，吴军追至白帝。守住永安，护住大汉最后的元气。' },
  { name: '街亭', subtitle: '当道扎营', story: '张郃大军直扑街亭。这一次，当道扎营，绝不再失街亭！' },
  { name: '祁山', subtitle: '卤城之战', story: '司马懿亲率精锐反扑祁山大营，坚守营寨，伺机破敌。' },
  { name: '成都', subtitle: '天府之国', story: '敌军兵临成都城下，这是蜀汉的最后一战。' },
];
export const DEFENSE_LEVEL_COUNT = DEFENSE_LEVELS.length;

/** 第 n 关（1~10）的章节配置 */
export function defenseChapter(n: number): ChapterDef {
  const lv = Math.max(1, Math.min(DEFENSE_LEVEL_COUNT, n));
  const ch = CHAPTERS[lv - 1];
  const L = DEFENSE_LEVELS[lv - 1];
  return {
    ...DEFENSE, id: lv, name: L.name, subtitle: L.subtitle, story: L.story, theme: ch.theme,
    // 第 1 关是新手第一次守城，再放宽两成
    hpMul: ch.hpMul * DEFENSE_HP_K * (lv === 1 ? 0.8 : 1), dmgMul: ch.dmgMul * DEFENSE_DMG_K * (lv === 1 ? 0.8 : 1), growth: DEFENSE.growth,
    waves: ch.waves, events: ch.events, midBoss: ch.midBoss, boss: ch.boss, goldBase: ch.goldBase,
    power: Math.round((ch.power * DEFENSE_POWER_K) / 100) * 100,
  };
}

export const DEFENSE: ChapterDef = {
  id: 50, name: '守城', subtitle: '保卫城池', theme: 'changban', defense: true,
  story: '曹军四面围城！召集兵马、加固城防，守住城池五分钟。',
  duration: DEFENSE_DURATION, hpMul: 0.9, dmgMul: 1, growth: 0.32, goldBase: 0, power: 0,
  waves: [], events: [], midBoss: 'xiahouen', boss: 'caochun',
};

export type UnitKind = 'spear' | 'shield' | 'archer' | 'cav' | 'xbow';

export interface UnitDef {
  kind: UnitKind;
  name: string;
  sprite: string;
  icon: string;
  /** 召唤消耗的粮草 */
  cost: number;
  /** 每次召唤几个 */
  count: number;
  /** 相对武将攻击 / 生命的倍率 */
  atkK: number;
  hpK: number;
  cd: number;
  range: number;
  speed: number;
  r: number;
  /** 解锁它的军令卡（null = 开局就有） */
  unlock: OrderId | null;
  desc: string;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  spear: { kind: 'spear', name: '枪兵', sprite: 'u_shu_spear', icon: 'w_spear', cost: 40, count: 3, atkK: 0.76, hpK: 0.88, cd: 0.9, range: 16, speed: 52, r: 6, unlock: null, desc: '均衡的近战步兵' },
  shield: { kind: 'shield', name: '盾兵', sprite: 'u_shu_shield', icon: 'p_armor', cost: 50, count: 2, atkK: 0.38, hpK: 2.77, cd: 1.2, range: 16, speed: 38, r: 7, unlock: 'o_shield', desc: '血厚，挡在前排拖住敌人' },
  archer: { kind: 'archer', name: '弓兵', sprite: 'u_shu_archer', icon: 'w_crossbow', cost: 55, count: 3, atkK: 0.65, hpK: 0.57, cd: 1.1, range: 120, speed: 44, r: 6, unlock: 'o_archer', desc: '远程放箭，跟在后排' },
  cav: { kind: 'cav', name: '骑兵', sprite: 'u_shu_cav', icon: 'w_horse', cost: 70, count: 2, atkK: 1.19, hpK: 1.51, cd: 0.8, range: 18, speed: 78, r: 9, unlock: 'o_cav', desc: '速度快，追杀四处的敌人' },
  xbow: { kind: 'xbow', name: '弩车', sprite: 'u_shu_xbow', icon: 'w_catapult', cost: 90, count: 1, atkK: 2.59, hpK: 1.76, cd: 1.6, range: 170, speed: 24, r: 10, unlock: 'o_xbow', desc: '射程最远，弩箭能穿透' },
};
export const UNIT_ORDER: UnitKind[] = ['spear', 'shield', 'archer', 'cav', 'xbow'];
/** 同时在场的士兵上限（武将另算） */
export const MAX_ALLIES = 35;

/** 召唤武将：消耗粮草，在场 30 秒，冷却 40 秒，最多同时 2 位 */
export const HERO_SUMMON_COST = 120, HERO_SUMMON_TIME = 30, HERO_SUMMON_CD = 40, HERO_SUMMON_MAX = 2;
/** 修城：消耗粮草修复 20% 城池生命，冷却 15 秒 */
export const REPAIR_COST = 60, REPAIR_PCT = 0.2, REPAIR_CD = 15;

export type OrderId = 'o_spear' | 'o_shield' | 'o_archer' | 'o_cav' | 'o_xbow' | 'c_wall' | 'c_tower' | 'c_spike' | 'c_beacon' | 'c_drum' | 'c_log';

export interface OrderDef {
  id: OrderId;
  name: string;
  icon: string;
  max: number;
  /** 兵种卡对应的兵种 */
  unit?: UnitKind;
  /** 每一级的说明（下标 = 等级 - 1） */
  levels: string[];
}

const unitLevels = (name: string, first: string) => [first, `${name}生命、攻击 +25%`, `${name}生命、攻击 +25%，每次多召唤 1 个`, `${name}生命、攻击 +25%`, `${name}生命、攻击 +25%，每次再多召唤 1 个`];

export const ORDERS: Record<OrderId, OrderDef> = {
  o_spear: { id: 'o_spear', name: '枪兵营', icon: 'w_spear', max: 5, unit: 'spear', levels: unitLevels('枪兵', '枪兵生命、攻击 +25%') },
  o_shield: { id: 'o_shield', name: '盾兵营', icon: 'p_armor', max: 5, unit: 'shield', levels: unitLevels('盾兵', '解锁盾兵：血厚的前排，拖住敌人') },
  o_archer: { id: 'o_archer', name: '弓兵营', icon: 'w_crossbow', max: 5, unit: 'archer', levels: unitLevels('弓兵', '解锁弓兵：远程放箭的后排') },
  o_cav: { id: 'o_cav', name: '骑兵营', icon: 'w_horse', max: 5, unit: 'cav', levels: unitLevels('骑兵', '解锁骑兵：快速追杀四处的敌人') },
  o_xbow: { id: 'o_xbow', name: '弩车营', icon: 'w_catapult', max: 5, unit: 'xbow', levels: unitLevels('弩车', '解锁弩车：射程最远，弩箭穿透') },
  c_wall: { id: 'c_wall', name: '城墙加固', icon: 'p_armor', max: 5, levels: Array(5).fill('城池生命上限 +20%，并立即修复 30%') },
  c_tower: { id: 'c_tower', name: '角楼弓手', icon: 'w_crossbow', max: 5, levels: ['一座角楼派驻弓手，自动射击', '再加一座角楼', '再加一座角楼', '四座角楼全部派驻弓手', '角楼弓手伤害 +60%'] },
  c_spike: { id: 'c_spike', name: '拒马', icon: 'w_caltrop', max: 5, levels: ['城下布满拒马：贴近城墙的敌人持续受伤', '拒马伤害 +50%', '拒马伤害 +50%，并减速敌人', '拒马伤害 +50%', '拒马伤害 +50%'] },
  c_beacon: { id: 'c_beacon', name: '烽火台', icon: 'p_horn', max: 5, levels: Array(5).fill('粮草产量 +30%，击杀敌人多得粮草') },
  c_drum: { id: 'c_drum', name: '战鼓', icon: 'w_drum', max: 5, levels: Array(5).fill('我方士兵攻击速度 +10%，移动速度 +6%') },
  c_log: { id: 'c_log', name: '滚木礌石', icon: 'w_rock', max: 5, levels: ['每 7 秒从四面城墙滚出滚木，碾过敌人', '滚木伤害 +40%', '每面城墙多滚一根', '滚木伤害 +40%', '滚木伤害 +40%，间隔缩短到 5 秒'] },
};
export const ORDER_IDS = Object.keys(ORDERS) as OrderId[];

export type LinkId = 'l_phalanx' | 'l_iron' | 'l_fire' | 'l_charge' | 'l_thunder';

/** 军令联动：兵种卡满级 + 对应城防卡，选择后兵种进化（和武器进化一样） */
export interface LinkDef {
  id: LinkId;
  name: string;
  icon: string;
  unit: OrderId;
  city: OrderId;
  desc: string;
}

export const LINKS: Record<LinkId, LinkDef> = {
  l_phalanx: { id: 'l_phalanx', name: '长枪方阵', icon: 'w_spear', unit: 'o_spear', city: 'c_spike', desc: '枪兵每次出枪刺穿面前一排敌人，伤害 +50%，每次召唤多 2 个' },
  l_iron: { id: 'l_iron', name: '铁壁阵', icon: 'p_armor', unit: 'o_shield', city: 'c_wall', desc: '盾兵生命翻倍，吸引附近敌人围攻自己，并反弹一半伤害' },
  l_fire: { id: 'l_fire', name: '火箭营', icon: 'w_fire', unit: 'o_archer', city: 'c_tower', desc: '弓兵和角楼改射火箭，命中后小范围爆炸' },
  l_charge: { id: 'l_charge', name: '铁骑冲阵', icon: 'w_horse', unit: 'o_cav', city: 'c_drum', desc: '骑兵每 4 秒向前冲锋，撞飞沿途敌人，造成双倍伤害' },
  l_thunder: { id: 'l_thunder', name: '霹雳弩', icon: 'w_thunder', unit: 'o_xbow', city: 'c_log', desc: '弩车射出霹雳弩箭，贯穿一整条线并在终点爆炸' },
};
export const LINK_IDS = Object.keys(LINKS) as LinkId[];

/** 敌人池：随时间加入更强的兵种 */
export const DEFENSE_POOLS: { from: number; pool: [string, number][] }[] = [
  { from: 0, pool: [['wei_spear', 10], ['bandit', 5]] },
  { from: 50, pool: [['wei_spear', 8], ['wei_shield', 3], ['wei_archer', 3], ['siege_ladder', 1]] },
  { from: 120, pool: [['wei_spear', 6], ['wei_shield', 4], ['wei_archer', 3], ['wei_cavalry', 4], ['siege_ladder', 1.5]] },
  { from: 200, pool: [['wei_shield', 4], ['wei_archer', 3], ['tiger_cavalry', 4], ['wei_heavy', 2], ['siege_ladder', 2]] },
];
