// 局内技能：武器（主动）与兵法（被动）。所有数值都在这里调整。

export type WeaponId =
  | 'spear' | 'sword' | 'crossbow' | 'horse' | 'fire' | 'aura' | 'blade' | 'snake' | 'fan' | 'halberd'
  | 'rock' | 'knife' | 'catapult' | 'thunder' | 'caltrop' | 'drum';
export type PassiveId =
  | 'horseshoe' | 'armor' | 'book' | 'flag' | 'tiger' | 'lingzhi' | 'pouch' | 'bowl' | 'seal'
  | 'map' | 'mirror' | 'wine' | 'ration' | 'horn' | 'whetstone';

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
  arc?: number; // 横扫弧度（弧度制的一半）
  stun?: number; // 眩晕时长
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
  /** 专属武将（不填为通用武器） */
  hero?: string;
  levels: WeaponLevel[]; // 1..5 级
  evo: WeaponLevel; // 进化形态
  /** 通关第几章后才会出现在升级选项里（不填为一开始就有） */
  unlockCh?: number;
  /** 受「舆图」数量加成 */
  countable?: boolean;
  /** 武将专属联动：该武将进化此武器时变为专属形态 */
  links?: WeaponLink[];
}

export interface WeaponLink {
  hero: string;
  name: string;
  icon?: string;
  desc: string;
  /** 覆盖进化形态的数值 */
  evo: Partial<WeaponLevel>;
}

export const MAX_WEAPON_LV = 5;
export const MAX_PASSIVE_LV = 5;
export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

export const WEAPONS = {
  spear: {
    id: 'spear', name: '龙胆枪', icon: 'w_spear', evoName: '百鸟朝凤', evoIcon: 'w_spear_evo', evoPassive: 'tiger', hero: 'zhaoyun',
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
    id: 'sword', name: '青锋剑', icon: 'w_sword', evoName: '万剑归宗', evoIcon: 'w_sword_evo', evoPassive: 'flag',
    intro: '飞剑环绕自身旋转，切割靠近的敌人',
    levels: [
      { dmg: 1.0, cd: 3.0, count: 1, area: 34, duration: 3, speed: 3.6, knock: 12, desc: '一柄飞剑环绕护身' },
      { dmg: 1.0, cd: 3.0, count: 2, area: 34, duration: 3, speed: 3.6, knock: 12, desc: '飞剑+1' },
      { dmg: 1.3, cd: 3.0, count: 2, area: 40, duration: 3.5, speed: 3.8, knock: 14, desc: '伤害与环绕半径提升' },
      { dmg: 1.3, cd: 2.6, count: 3, area: 40, duration: 4, speed: 4.0, knock: 14, desc: '飞剑+1，持续更久' },
      { dmg: 1.6, cd: 2.4, count: 4, area: 44, duration: 4.5, speed: 4.2, knock: 16, desc: '飞剑+1，伤害提升' },
    ],
    evo: { dmg: 2.2, cd: 0, count: 6, area: 50, duration: 9999, speed: 4.8, knock: 20, desc: '万剑归宗：六剑常驻，永不停歇' },
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
    id: 'horse', name: '轻骑', icon: 'w_horse', evoName: '铁骑突阵', evoIcon: 'w_horse_evo', evoPassive: 'horseshoe',
    intro: '召唤骑兵横冲战场，撞飞敌人',
    levels: [
      { dmg: 2.4, cd: 5.0, count: 1, area: 12, speed: 230, knock: 90, desc: '召唤一骑横冲战场' },
      { dmg: 2.4, cd: 5.0, count: 2, area: 12, speed: 230, knock: 90, desc: '骑兵+1' },
      { dmg: 3.2, cd: 4.6, count: 2, area: 14, speed: 250, knock: 100, desc: '伤害提升' },
      { dmg: 3.2, cd: 4.2, count: 3, area: 14, speed: 250, knock: 100, desc: '骑兵+1，冷却缩短' },
      { dmg: 4.0, cd: 4.0, count: 4, area: 16, speed: 270, knock: 110, desc: '骑兵+1，伤害提升' },
    ],
    evo: { dmg: 2.4, cd: 3.0, count: 8, area: 18, speed: 300, knock: 130, desc: '铁骑突阵：八骑齐出，纵横交错' },
  },
  fire: {
    id: 'fire', name: '火油罐', icon: 'w_fire', evoName: '火烧连营', evoIcon: 'w_fire_evo', evoPassive: 'pouch',
    intro: '投掷火油罐，在地面形成火海',
    levels: [
      { dmg: 0.3, cd: 3.2, count: 1, area: 18, duration: 2.5, tick: 0.35, desc: '投掷火油罐，落地爆炸并留下火海' },
      { dmg: 0.3, cd: 3.2, count: 2, area: 18, duration: 2.5, tick: 0.35, desc: '火油罐+1' },
      { dmg: 0.38, cd: 3.0, count: 2, area: 22, duration: 2.8, tick: 0.35, desc: '火海范围与伤害提升' },
      { dmg: 0.38, cd: 2.8, count: 3, area: 22, duration: 3.2, tick: 0.33, desc: '火油罐+1，燃烧更久' },
      { dmg: 0.47, cd: 2.6, count: 4, area: 26, duration: 3.5, tick: 0.3, desc: '火油罐+1，范围提升' },
    ],
    evo: { dmg: 0.42, cd: 2.4, count: 6, area: 32, duration: 4.5, tick: 0.28, slow: 0.4, desc: '火烧连营：烈焰连营，敌军减速' },
  },
  aura: {
    id: 'aura', name: '罡风', icon: 'w_aura', evoName: '金刚护体', evoIcon: 'w_aura_evo', evoPassive: 'lingzhi',
    intro: '周身罡风持续伤害附近敌人',
    levels: [
      { dmg: 0.45, cd: 0, count: 1, area: 26, tick: 0.5, knock: 4, desc: '罡风护体，伤害周围敌人' },
      { dmg: 0.55, cd: 0, count: 1, area: 30, tick: 0.5, knock: 5, desc: '范围与伤害提升' },
      { dmg: 0.55, cd: 0, count: 1, area: 34, tick: 0.45, knock: 6, slow: 0.15, desc: '范围提升，使敌人减速' },
      { dmg: 0.7, cd: 0, count: 1, area: 38, tick: 0.45, knock: 6, slow: 0.2, desc: '伤害提升' },
      { dmg: 0.85, cd: 0, count: 1, area: 44, tick: 0.4, knock: 8, slow: 0.25, desc: '范围与伤害大幅提升' },
    ],
    evo: { dmg: 1.15, cd: 0, count: 1, area: 54, tick: 0.35, knock: 10, slow: 0.3, desc: '金刚护体：受到伤害降低20%，每秒回复1%生命' },
  },
} as Record<WeaponId, WeaponDef>;

// —— 武将专属武器 ——
Object.assign(WEAPONS, {
  blade: {
    id: 'blade', name: '青龙偃月刀', icon: 'w_blade', evoName: '春秋刀法', evoIcon: 'w_blade_evo', evoPassive: 'tiger', hero: 'guanyu',
    intro: '向前方大范围横扫，击退敌人',
    levels: [
      { dmg: 2.1, cd: 1.5, count: 1, area: 44, arc: 1.2, knock: 80, desc: '向前方半月横扫' },
      { dmg: 2.5, cd: 1.5, count: 1, area: 46, arc: 1.3, knock: 80, desc: '伤害与横扫角度提升' },
      { dmg: 2.5, cd: 1.4, count: 2, area: 48, arc: 1.3, knock: 85, desc: '拖刀计：同时向身后横扫' },
      { dmg: 3.1, cd: 1.3, count: 2, area: 54, arc: 1.4, knock: 90, desc: '范围与伤害提升' },
      { dmg: 3.5, cd: 1.2, count: 2, area: 58, arc: 1.5, knock: 95, desc: '伤害提升，冷却缩短' },
    ],
    evo: { dmg: 4.2, cd: 1.0, count: 2, area: 68, arc: Math.PI, knock: 110, desc: '春秋刀法：周身连环大回旋，刀气纵横' },
  },
  snake: {
    id: 'snake', name: '丈八蛇矛', icon: 'w_snake', evoName: '万人敌', evoIcon: 'w_snake_evo', evoPassive: 'armor', hero: 'zhangfei',
    intro: '周身横扫，有几率眩晕敌人',
    levels: [
      { dmg: 1.8, cd: 1.5, count: 1, area: 32, stun: 0.3, knock: 70, desc: '蛇矛横扫周身，眩晕敌人' },
      { dmg: 2.2, cd: 1.4, count: 1, area: 34, stun: 0.4, knock: 70, desc: '伤害与眩晕时间提升' },
      { dmg: 2.2, cd: 1.3, count: 1, area: 38, stun: 0.5, knock: 80, desc: '横扫范围提升' },
      { dmg: 2.7, cd: 1.2, count: 1, area: 40, stun: 0.5, knock: 85, desc: '伤害提升，冷却缩短' },
      { dmg: 3.1, cd: 1.1, count: 1, area: 44, stun: 0.6, knock: 90, desc: '范围与伤害大幅提升' },
    ],
    evo: { dmg: 3.8, cd: 0.8, count: 1, area: 54, stun: 0.9, knock: 110, desc: '万人敌：每次横扫都震出冲击波' },
  },
  fan: {
    id: 'fan', name: '羽扇', icon: 'w_fan', evoName: '八阵图', evoIcon: 'w_fan_evo', evoPassive: 'book', hero: 'zhuge',
    intro: '扇出追踪敌人的风刃',
    levels: [
      { dmg: 0.9, cd: 1.3, count: 2, area: 0, pierce: 2, speed: 150, knock: 10, desc: '扇出两道追踪风刃' },
      { dmg: 0.9, cd: 1.25, count: 3, area: 0, pierce: 2, speed: 160, knock: 10, desc: '风刃+1' },
      { dmg: 1.15, cd: 1.2, count: 3, area: 0, pierce: 3, speed: 170, knock: 12, desc: '伤害提升，穿透+1' },
      { dmg: 1.15, cd: 1.1, count: 4, area: 0, pierce: 3, speed: 180, knock: 12, desc: '风刃+1，冷却缩短' },
      { dmg: 1.4, cd: 1.0, count: 5, area: 0, pierce: 3, speed: 190, knock: 14, desc: '风刃+1，伤害提升' },
    ],
    evo: { dmg: 2.0, cd: 0.8, count: 8, area: 0, pierce: 5, speed: 210, knock: 16, desc: '八阵图：八方风刃齐发，穿透一切' },
  },
  halberd: {
    id: 'halberd', name: '方天画戟', icon: 'w_halberd', evoName: '无双乱舞', evoIcon: 'w_halberd_evo', evoPassive: 'horseshoe', hero: 'lvbu',
    intro: '定时挥戟旋风斩，连续伤害周围敌人',
    levels: [
      { dmg: 0.9, cd: 2.4, count: 1, area: 36, duration: 0.8, tick: 0.2, knock: 40, desc: '旋风斩，连续伤害周围敌人' },
      { dmg: 1.1, cd: 2.3, count: 1, area: 38, duration: 0.9, tick: 0.2, knock: 40, desc: '伤害与持续时间提升' },
      { dmg: 1.1, cd: 2.1, count: 1, area: 42, duration: 1.0, tick: 0.18, knock: 45, desc: '范围提升，攻速加快' },
      { dmg: 1.35, cd: 2.0, count: 1, area: 44, duration: 1.1, tick: 0.18, knock: 50, desc: '伤害提升' },
      { dmg: 1.55, cd: 1.8, count: 1, area: 48, duration: 1.2, tick: 0.16, knock: 55, desc: '全面强化' },
    ],
    evo: { dmg: 1.6, cd: 0, count: 1, area: 58, duration: 9999, tick: 0.2, knock: 50, desc: '无双乱舞：画戟永不停歇，横扫八方' },
  },
} as Record<string, WeaponDef>);

// —— 扩充的通用武器（随章节解锁） ——
Object.assign(WEAPONS, {
  knife: {
    id: 'knife', name: '回旋飞刀', icon: 'w_knife', evoName: '飞刀如雨', evoIcon: 'w_knife_evo', evoPassive: 'wine', unlockCh: 1, countable: true,
    intro: '掷出飞刀后飞回手中，去程回程都造成伤害',
    levels: [
      { dmg: 1.2, cd: 1.6, count: 1, area: 90, speed: 200, knock: 15, desc: '掷出回旋飞刀，往返穿透敌人' },
      { dmg: 1.2, cd: 1.6, count: 2, area: 90, speed: 200, knock: 15, desc: '飞刀+1' },
      { dmg: 1.5, cd: 1.5, count: 2, area: 100, speed: 210, knock: 18, desc: '伤害与射程提升' },
      { dmg: 1.5, cd: 1.4, count: 3, area: 100, speed: 210, knock: 18, desc: '飞刀+1，冷却缩短' },
      { dmg: 1.9, cd: 1.3, count: 4, area: 110, speed: 220, knock: 20, desc: '飞刀+1，伤害提升' },
    ],
    evo: { dmg: 1.4, cd: 1.1, count: 8, area: 120, speed: 240, knock: 24, desc: '飞刀如雨：八方飞刀往复不休' },
  },
  thunder: {
    id: 'thunder', name: '天雷', icon: 'w_thunder', evoName: '太平要术', evoIcon: 'w_thunder_evo', evoPassive: 'seal', unlockCh: 1, countable: true,
    intro: '天雷劈中敌人，并在附近敌人之间连锁跳跃',
    levels: [
      { dmg: 6, cd: 2.2, count: 1, area: 60, pierce: 3, desc: '天雷劈中敌人，连锁3次' },
      { dmg: 6, cd: 2.1, count: 1, area: 60, pierce: 5, desc: '连锁+2' },
      { dmg: 7.5, cd: 2.0, count: 2, area: 64, pierce: 5, desc: '天雷+1，伤害提升' },
      { dmg: 7.5, cd: 1.8, count: 2, area: 70, pierce: 7, desc: '连锁+2，冷却缩短' },
      { dmg: 10, cd: 1.6, count: 3, area: 74, pierce: 8, desc: '天雷+1，伤害提升' },
    ],
    evo: { dmg: 11, cd: 1.2, count: 4, area: 90, pierce: 14, stun: 0.3, desc: '太平要术：雷霆万钧，连锁十四人并麻痹' },
  },
  rock: {
    id: 'rock', name: '滚木礌石', icon: 'w_rock', evoName: '天崩地裂', evoIcon: 'w_rock_evo', evoPassive: 'armor', unlockCh: 2, countable: true,
    intro: '礌石从天而降，砸向敌群',
    levels: [
      { dmg: 2.2, cd: 2.8, count: 2, area: 16, knock: 50, desc: '两块礌石砸向敌群' },
      { dmg: 2.2, cd: 2.8, count: 3, area: 16, knock: 50, desc: '礌石+1' },
      { dmg: 2.8, cd: 2.6, count: 3, area: 18, knock: 55, desc: '伤害与范围提升' },
      { dmg: 2.8, cd: 2.4, count: 4, area: 18, knock: 60, desc: '礌石+1，冷却缩短' },
      { dmg: 3.4, cd: 2.2, count: 5, area: 20, knock: 65, desc: '礌石+1，伤害提升' },
    ],
    evo: { dmg: 4.2, cd: 1.6, count: 8, area: 26, knock: 80, stun: 0.5, desc: '天崩地裂：八石齐落，砸晕敌军' },
  },
  drum: {
    id: 'drum', name: '战鼓', icon: 'w_drum', evoName: '擂鼓震天', evoIcon: 'w_drum_evo', evoPassive: 'horn', unlockCh: 2,
    intro: '擂响战鼓，冲击波击退周围敌人',
    levels: [
      { dmg: 1.4, cd: 3.0, count: 1, area: 50, knock: 120, desc: '鼓声冲击波击退周围敌人' },
      { dmg: 1.7, cd: 2.9, count: 1, area: 54, knock: 120, desc: '伤害与范围提升' },
      { dmg: 1.7, cd: 2.6, count: 2, area: 56, knock: 130, desc: '连擂两通鼓' },
      { dmg: 2.2, cd: 2.5, count: 2, area: 62, knock: 140, desc: '伤害与范围提升' },
      { dmg: 2.6, cd: 2.3, count: 3, area: 66, knock: 150, desc: '连擂三通鼓' },
    ],
    evo: { dmg: 7, cd: 1.8, count: 3, area: 80, knock: 180, stun: 0.6, desc: '擂鼓震天：鼓声所至，敌军眩晕' },
  },
  catapult: {
    id: 'catapult', name: '霹雳车', icon: 'w_catapult', evoName: '霹雳炮', evoIcon: 'w_catapult_evo', evoPassive: 'whetstone', unlockCh: 3, countable: true,
    intro: '向远处敌群抛出巨石，大范围爆炸',
    levels: [
      { dmg: 5.0, cd: 4.5, count: 1, area: 34, knock: 90, desc: '抛出巨石，落地大范围爆炸' },
      { dmg: 6.0, cd: 4.5, count: 1, area: 36, knock: 90, desc: '伤害提升' },
      { dmg: 6.0, cd: 4.2, count: 2, area: 38, knock: 95, desc: '巨石+1' },
      { dmg: 7.5, cd: 4.0, count: 2, area: 42, knock: 100, desc: '伤害与范围提升' },
      { dmg: 8.5, cd: 3.6, count: 3, area: 44, knock: 110, desc: '巨石+1，冷却缩短' },
    ],
    evo: { dmg: 10, cd: 3.0, count: 4, area: 56, knock: 140, desc: '霹雳炮：巨石落地后二次爆裂' },
  },
  caltrop: {
    id: 'caltrop', name: '铁蒺藜', icon: 'w_caltrop', evoName: '天罗地网', evoIcon: 'w_caltrop_evo', evoPassive: 'pouch', unlockCh: 3,
    intro: '在走过的路上撒下铁蒺藜，减速并伤害敌人',
    levels: [
      { dmg: 0.2, cd: 1.4, count: 1, area: 16, duration: 4, tick: 0.4, slow: 0.3, desc: '身后撒下铁蒺藜，减速并伤害敌人' },
      { dmg: 0.2, cd: 1.2, count: 1, area: 18, duration: 4.5, tick: 0.4, slow: 0.3, desc: '范围与持续时间提升' },
      { dmg: 0.28, cd: 1.1, count: 1, area: 20, duration: 5, tick: 0.35, slow: 0.35, desc: '伤害提升，减速加强' },
      { dmg: 0.28, cd: 1.0, count: 1, area: 22, duration: 6, tick: 0.35, slow: 0.4, desc: '范围提升，持续更久' },
      { dmg: 0.36, cd: 0.9, count: 1, area: 24, duration: 7, tick: 0.3, slow: 0.45, desc: '全面强化' },
    ],
    evo: { dmg: 0.5, cd: 0.6, count: 1, area: 30, duration: 9, tick: 0.28, slow: 0.6, desc: '天罗地网：铁蒺藜遍地，敌军寸步难行' },
  },
} as Record<string, WeaponDef>);

// —— 数量加成与武将专属联动 ——
for (const id of ['spear', 'sword', 'crossbow', 'horse', 'fire', 'fan'] as WeaponId[]) WEAPONS[id].countable = true;
WEAPONS.sword.links = [
  { hero: 'zhaoyun', name: '青釭剑阵', desc: '赵云专属：青釭剑出鞘，八剑环身，伤害大增', evo: { count: 8, dmg: 4.3, area: 56 } },
];
WEAPONS.horse.links = [
  { hero: 'zhaoyun', name: '白马义从', desc: '赵云专属：十二骑白马义从纵横冲阵', evo: { count: 12, dmg: 3.0, cd: 2.6 } },
  { hero: 'guanyu', name: '千里走单骑', desc: '关羽专属：骑兵冲阵伤害大增，自身移动速度+20%', evo: { dmg: 4.0, cd: 2.8 } },
];
WEAPONS.drum.links = [
  { hero: 'guanyu', name: '温酒斩华雄', desc: '关羽专属：每通鼓响，四道青龙刀气斩向四方', evo: { dmg: 3.6 } },
  { hero: 'zhangfei', name: '长坂断喝', desc: '张飞专属：鼓声化作断喝，范围大增并长时间眩晕', evo: { dmg: 8.5, area: 110, stun: 1.5, knock: 220 } },
];
WEAPONS.rock.links = [
  { hero: 'zhangfei', name: '智取瓦口', desc: '张飞专属：滚木礌石倾泻而下，砸晕敌军', evo: { count: 14, cd: 1.3, stun: 1.0 } },
];
WEAPONS.crossbow.links = [
  { hero: 'zhuge', name: '元戎弩', desc: '诸葛亮专属：一弩十矢扇形齐射，穿透八人', evo: { count: 10, pierce: 8, cd: 0.55, dmg: 1.6 } },
  { hero: 'lvbu', name: '辕门射戟', desc: '吕布专属：连发巨箭，贯穿一线所有敌人', evo: { dmg: 8, cd: 0.7, pierce: 999, speed: 380 } },
];
WEAPONS.fire.links = [
  { hero: 'zhuge', name: '火烧博望', desc: '诸葛亮专属：火海连片，范围与持续时间大增', evo: { count: 6, area: 32, duration: 5, slow: 0.55, dmg: 0.52 } },
];
WEAPONS.catapult.links = [
  { hero: 'lvbu', name: '虎牢关', desc: '吕布专属：五石齐发，砸出巨坑震飞敌军', evo: { count: 5, area: 60, dmg: 9 } },
];

// 进化形态整体伤害系数：进化后约为满级的 1.5 倍，避免后期一边倒
export const EVO_DMG = 0.75;
for (const d of Object.values(WEAPONS)) {
  // 武将专属武器的进化本来就只比满级强一点，不打折
  if (!d.hero) d.evo.dmg = +(d.evo.dmg * EVO_DMG).toFixed(2);
  for (const l of d.links || []) if (l.evo.dmg) l.evo.dmg = +(l.evo.dmg * EVO_DMG).toFixed(2);
}

/** 武将对某武器的专属联动 */
export function weaponLink(id: WeaponId, hero: string): WeaponLink | undefined {
  return WEAPONS[id].links?.find((l) => l.hero === hero);
}

/** 某武将的全部专属联动 */
export function heroLinks(hero: string): { weapon: WeaponId; link: WeaponLink }[] {
  const out: { weapon: WeaponId; link: WeaponLink }[] = [];
  for (const id of Object.keys(WEAPONS) as WeaponId[]) {
    const l = weaponLink(id, hero);
    if (l) out.push({ weapon: id, link: l });
  }
  return out;
}

/** 武将可用的武器：通用武器 + 自己的专属武器 */
export function weaponsForHero(hero: string, cleared = 99): WeaponId[] {
  return (Object.keys(WEAPONS) as WeaponId[]).filter((id) => (!WEAPONS[id].hero || WEAPONS[id].hero === hero) && (WEAPONS[id].unlockCh || 0) <= cleared);
}

export function passivesFor(cleared = 99): PassiveId[] {
  return (Object.keys(PASSIVES) as PassiveId[]).filter((id) => (PASSIVES[id].unlockCh || 0) <= cleared);
}

export function passiveMax(id: PassiveId): number {
  return PASSIVES[id].max || MAX_PASSIVE_LV;
}

/** 本章通关后新出现的技能名 */
export function skillsUnlockedAt(ch: number): string[] {
  const w = Object.values(WEAPONS).filter((d) => d.unlockCh === ch).map((d) => d.name);
  const p = Object.values(PASSIVES).filter((d) => d.unlockCh === ch).map((d) => d.name);
  return [...w, ...p];
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  desc: string; // 每级效果
  /** 最高等级（默认 5） */
  max?: number;
  unlockCh?: number;
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
  map: { id: 'map', name: '舆图', icon: 'p_map', desc: '飞剑、弩箭、飞刀等技能数量+1', max: 2, unlockCh: 3 },
  wine: { id: 'wine', name: '鹰羽', icon: 'p_wine', desc: '暴击率+4%，暴击伤害+15%', unlockCh: 1 },
  horn: { id: 'horn', name: '号角', icon: 'p_horn', desc: '怒气获取+15%', unlockCh: 2 },
  whetstone: { id: 'whetstone', name: '磨刀石', icon: 'p_whetstone', desc: '对精英与首领伤害+15%', unlockCh: 2 },
  mirror: { id: 'mirror', name: '护心镜', icon: 'p_mirror', desc: '每隔一段时间抵挡一次伤害（每级冷却-2秒）', unlockCh: 3 },
  ration: { id: 'ration', name: '军粮', icon: 'p_ration', desc: '每击败50名敌人回复1%生命', unlockCh: 3 },
};

/** 升到下一级所需经验（参考同类游戏的曲线） */
export function expToNext(level: number): number {
  if (level < 20) return 5 + (level - 1) * 10;
  if (level < 40) return 195 + (level - 20) * 13;
  return 455 + (level - 40) * 16;
}
