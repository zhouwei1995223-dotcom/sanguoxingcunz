// 局内技能：武器（主动）与兵法（被动）。所有数值都在这里调整。

export type WeaponId = 'spear' | 'sword' | 'crossbow' | 'horse' | 'fire' | 'aura';
export type PassiveId = 'horseshoe' | 'armor' | 'book' | 'flag' | 'tiger' | 'lingzhi' | 'pouch' | 'bowl' | 'seal';

export interface WeaponLevel {
  dmg: number; // 伤害倍率（× 攻击力）
  cd: number; // 冷却（秒）
  count: number; // 数量
  area: number; // 长度 / 半径（世界像素）
  duration?: number;
  pierce?: number;
  speed?: number;
  tick?: number; // 持续伤害间隔
  slow?: number; // 减速比例
  knock?: number; // 击退力度
  desc: string; // 升到本级时的描述
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  evoName: string;
  evoIcon: string;
  evoPassive: PassiveId;
  intro: string;
  levels: WeaponLevel[]; // 1..5 级
  evo: WeaponLevel; // 进化形态
}

export const MAX_WEAPON_LV = 5;
export const MAX_PASSIVE_LV = 5;
export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  spear: {
    id: 'spear', name: '龙胆枪', icon: 'w_spear', evoName: '百鸟朝凤', evoIcon: 'w_spear_evo', evoPassive: 'tiger',
    intro: '向敌人方向突刺，贯穿路径上的所有敌人',
    levels: [
      { dmg: 1.6, cd: 1.1, count: 1, area: 50, knock: 60, desc: '向前方重刺，贯穿并击飞敌人' },
      { dmg: 2.0, cd: 1.1, count: 1, area: 52, knock: 60, desc: '伤害提升25%' },
      { dmg: 2.0, cd: 1.0, count: 2, area: 54, knock: 65, desc: '回马枪：同时向身后突刺' },
      { dmg: 2.5, cd: 1.0, count: 2, area: 62, knock: 70, desc: '突刺距离与伤害提升' },
      { dmg: 2.8, cd: 0.9, count: 3, area: 66, knock: 75, desc: '三向突刺，冷却缩短' },
    ],
    evo: { dmg: 3.4, cd: 0.75, count: 7, area: 82, knock: 90, desc: '七向连环重刺，所向披靡' },
  },
  sword: {
    id: 'sword', name: '青釭剑', icon: 'w_sword', evoName: '青釭剑阵', evoIcon: 'w_sword_evo', evoPassive: 'flag',
    intro: '飞剑环绕自身旋转，切割靠近的敌人',
    levels: [
      { dmg: 1.0, cd: 3.0, count: 1, area: 34, duration: 3, speed: 3.6, knock: 12, desc: '一柄飞剑环绕护身' },
      { dmg: 1.0, cd: 3.0, count: 2, area: 34, duration: 3, speed: 3.6, knock: 12, desc: '飞剑+1' },
      { dmg: 1.3, cd: 3.0, count: 2, area: 40, duration: 3.5, speed: 3.8, knock: 14, desc: '伤害与环绕半径提升' },
      { dmg: 1.3, cd: 2.6, count: 3, area: 40, duration: 4, speed: 4.0, knock: 14, desc: '飞剑+1，持续更久' },
      { dmg: 1.6, cd: 2.4, count: 4, area: 44, duration: 4.5, speed: 4.2, knock: 16, desc: '飞剑+1，伤害提升' },
    ],
    evo: { dmg: 2.2, cd: 0, count: 6, area: 50, duration: 9999, speed: 4.8, knock: 20, desc: '青釭剑阵：六剑常驻，永不停歇' },
  },
  crossbow: {
    id: 'crossbow', name: '连弩', icon: 'w_crossbow', evoName: '诸葛连弩', evoIcon: 'w_crossbow_evo', evoPassive: 'book',
    intro: '自动射击最近的敌人',
    levels: [
      { dmg: 1.0, cd: 0.9, count: 1, area: 0, pierce: 1, speed: 230, desc: '射击最近的敌人' },
      { dmg: 1.0, cd: 0.9, count: 2, area: 0, pierce: 1, speed: 230, desc: '弩箭+1' },
      { dmg: 1.3, cd: 0.85, count: 2, area: 0, pierce: 2, speed: 250, desc: '伤害提升，可穿透2个敌人' },
      { dmg: 1.3, cd: 0.75, count: 3, area: 0, pierce: 2, speed: 250, desc: '弩箭+1，射速提升' },
      { dmg: 1.6, cd: 0.7, count: 4, area: 0, pierce: 3, speed: 270, desc: '弩箭+1，穿透+1' },
    ],
    evo: { dmg: 1.5, cd: 0.1, count: 1, area: 0, pierce: 4, speed: 320, desc: '诸葛连弩：一弩十矢，箭如雨下' },
  },
  horse: {
    id: 'horse', name: '白马', icon: 'w_horse', evoName: '白马义从', evoIcon: 'w_horse_evo', evoPassive: 'horseshoe',
    intro: '召唤白马骑兵横冲战场，撞飞敌人',
    levels: [
      { dmg: 2.4, cd: 5.0, count: 1, area: 12, speed: 230, knock: 90, desc: '召唤一骑横冲战场' },
      { dmg: 2.4, cd: 5.0, count: 2, area: 12, speed: 230, knock: 90, desc: '骑兵+1' },
      { dmg: 3.2, cd: 4.6, count: 2, area: 14, speed: 250, knock: 100, desc: '伤害提升' },
      { dmg: 3.2, cd: 4.2, count: 3, area: 14, speed: 250, knock: 100, desc: '骑兵+1，冷却缩短' },
      { dmg: 4.0, cd: 4.0, count: 4, area: 16, speed: 270, knock: 110, desc: '骑兵+1，伤害提升' },
    ],
    evo: { dmg: 5.0, cd: 3.0, count: 8, area: 18, speed: 300, knock: 130, desc: '白马义从：八骑齐出，纵横交错' },
  },
  fire: {
    id: 'fire', name: '火油罐', icon: 'w_fire', evoName: '火烧连营', evoIcon: 'w_fire_evo', evoPassive: 'pouch',
    intro: '投掷火油罐，在地面形成火海',
    levels: [
      { dmg: 0.55, cd: 3.2, count: 1, area: 18, duration: 2.5, tick: 0.35, desc: '投掷火油罐，落地爆炸并留下火海' },
      { dmg: 0.55, cd: 3.2, count: 2, area: 18, duration: 2.5, tick: 0.35, desc: '火油罐+1' },
      { dmg: 0.7, cd: 3.0, count: 2, area: 22, duration: 2.8, tick: 0.35, desc: '火海范围与伤害提升' },
      { dmg: 0.7, cd: 2.8, count: 3, area: 22, duration: 3.2, tick: 0.33, desc: '火油罐+1，燃烧更久' },
      { dmg: 0.85, cd: 2.6, count: 4, area: 26, duration: 3.5, tick: 0.3, desc: '火油罐+1，范围提升' },
    ],
    evo: { dmg: 1.0, cd: 2.4, count: 6, area: 32, duration: 4.5, tick: 0.28, slow: 0.4, desc: '火烧连营：烈焰连营，敌军减速' },
  },
  aura: {
    id: 'aura', name: '龙吟枪风', icon: 'w_aura', evoName: '龙胆护体', evoIcon: 'w_aura_evo', evoPassive: 'lingzhi',
    intro: '周身枪风持续伤害附近敌人',
    levels: [
      { dmg: 0.45, cd: 0, count: 1, area: 26, tick: 0.5, knock: 4, desc: '枪风护体，伤害周围敌人' },
      { dmg: 0.55, cd: 0, count: 1, area: 30, tick: 0.5, knock: 5, desc: '范围与伤害提升' },
      { dmg: 0.55, cd: 0, count: 1, area: 34, tick: 0.45, knock: 6, slow: 0.15, desc: '范围提升，使敌人减速' },
      { dmg: 0.7, cd: 0, count: 1, area: 38, tick: 0.45, knock: 6, slow: 0.2, desc: '伤害提升' },
      { dmg: 0.85, cd: 0, count: 1, area: 44, tick: 0.4, knock: 8, slow: 0.25, desc: '范围与伤害大幅提升' },
    ],
    evo: { dmg: 1.15, cd: 0, count: 1, area: 54, tick: 0.35, knock: 10, slow: 0.3, desc: '龙胆护体：受到伤害降低20%，每秒回复1%生命' },
  },
};

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  desc: string; // 每级效果
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  horseshoe: { id: 'horseshoe', name: '战马', icon: 'p_horseshoe', desc: '移动速度+8%' },
  armor: { id: 'armor', name: '铁甲', icon: 'p_armor', desc: '受到伤害-6%' },
  book: { id: 'book', name: '兵书', icon: 'p_book', desc: '技能冷却-6%' },
  flag: { id: 'flag', name: '令旗', icon: 'p_flag', desc: '技能范围+10%' },
  tiger: { id: 'tiger', name: '虎符', icon: 'p_tiger', desc: '伤害+10%' },
  lingzhi: { id: 'lingzhi', name: '灵芝', icon: 'p_lingzhi', desc: '生命上限+10%，每秒回复0.3生命' },
  pouch: { id: 'pouch', name: '锦囊', icon: 'p_pouch', desc: '技能持续时间+12%' },
  bowl: { id: 'bowl', name: '聚宝盆', icon: 'p_bowl', desc: '拾取范围+35%，金币+10%' },
  seal: { id: 'seal', name: '玉玺', icon: 'p_seal', desc: '经验获取+8%' },
};

/** 升到下一级所需经验（参考同类游戏的曲线） */
export function expToNext(level: number): number {
  if (level < 20) return 5 + (level - 1) * 10;
  if (level < 40) return 195 + (level - 20) * 13;
  return 455 + (level - 40) * 16;
}
