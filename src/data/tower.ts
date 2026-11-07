/** 所有地图以 320 × 400 的沙盘坐标定义，画面和战斗使用同一路线。 */
export type Point = readonly [number, number];
export const FIELD_W = 320, FIELD_H = 400, WAVES = 15, GATE_HP = 20;
export const TOWER_KINDS = ['arrow', 'bolt', 'stone', 'oil', 'drum'] as const;
export type TowerKind = typeof TOWER_KINDS[number];
export type Branch = 0 | 1;

export interface TowerSpec {
  name: string; cost: number; range: number; damage: number; interval: number;
  desc: string; branches: readonly [string, string]; effects: readonly [string, string];
}
export const TOWERS: Record<TowerKind, TowerSpec> = {
  arrow: { name: '箭塔', cost: 55, range: 68, damage: 14, interval: 0.62, desc: '快射单体，适合截击轻步兵', branches: ['劲弓', '连珠'], effects: ['射程增至 92，箭伤提高 50%', '射击间隔缩短 42%'] },
  bolt: { name: '连弩台', cost: 85, range: 82, damage: 21, interval: 1.25, desc: '沿瞄准方向穿透一列敌军', branches: ['重弩', '排弩'], effects: ['贯穿箭伤提高 60%', '弩箭加宽，射击间隔缩短 30%'] },
  stone: { name: '投石台', cost: 100, range: 86, damage: 31, interval: 2.2, desc: '礌石溅射，对盾兵重甲增伤', branches: ['重砲', '碎石'], effects: ['砲击伤害提高 65%', '溅射半径从 24 扩至 40'] },
  oil: { name: '火油台', cost: 90, range: 69, damage: 12, interval: 2.6, desc: '落点持续燃烧，宜守弯道', branches: ['烈油', '火塘'], effects: ['燃烧伤害提高 60%', '火区扩至 30，燃烧延长至 3 秒'] },
  drum: { name: '战鼓台', cost: 75, range: 61, damage: 0, interval: 1, desc: '为邻塔加攻速，并减缓敌军', branches: ['激扬', '困阵'], effects: ['邻塔攻速加成提高至 55%', '范围增至 85，敌人减速 32%'] },
};
export function upgradePrice(kind: TowerKind, level: number) {
  return Math.ceil(TOWERS[kind].cost * (level === 1 ? 1.2 : 1.65));
}
export function towerRange(kind: TowerKind, branch?: Branch) {
  if (kind === 'arrow' && branch === 0) return 92;
  if (kind === 'drum' && branch === 1) return 85;
  return TOWERS[kind].range;
}

export interface TowerMap {
  id: number; name: string; hint: string; theme: string; routes: Point[][]; sites: Point[];
  troop: string; shield: string; cavalry: string; bosses: [string, string]; strength: number;
}
export const TOWER_MAPS: TowerMap[] = [
  {
    id: 1, name: '柳营驿道', hint: '单路回折，弯道内侧可照应两段驿道', theme: 'changban',
    routes: [[[0, 65], [240, 65], [260, 85], [260, 153], [238, 175], [68, 175], [49, 195], [49, 264], [72, 286], [233, 286], [256, 310], [256, 371]]],
    sites: [[68, 101], [165, 102], [220, 127], [102, 139], [85, 225], [187, 216], [134, 250], [208, 326], [280, 253]],
    troop: 'wei_spear', shield: 'wei_shield', cavalry: 'wei_cavalry', bosses: ['xiahouen', 'caochun'], strength: 0.85
  },
  {
    id: 2, name: '汉水双渡', hint: '两岸来敌，在渡口汇流后截击', theme: 'hanshui',
    routes: [[[0, 59], [95, 59], [116, 81], [116, 128], [145, 156], [197, 156], [220, 178], [220, 245], [194, 269], [99, 269], [76, 291], [76, 367]],
    [[320, 77], [249, 77], [226, 100], [226, 135], [197, 156], [220, 178], [220, 245], [194, 269], [99, 269], [76, 291], [76, 367]]],
    sites: [[59, 98], [154, 100], [269, 123], [159, 193], [258, 200], [175, 233], [116, 228], [126, 315], [43, 243]],
    troop: 'yuan_spear', shield: 'yuan_shield', cavalry: 'yuan_cavalry', bosses: ['yanliang', 'wenchou'], strength: 1.06
  },
  {
    id: 3, name: '剑阁夹道', hint: '两翼分兵，重甲与快骑在关前会合', theme: 'fengming',
    routes: [[[0, 53], [85, 53], [109, 77], [109, 139], [79, 166], [54, 166], [36, 187], [36, 253], [62, 278], [131, 278], [158, 306], [158, 370]],
    [[320, 47], [228, 47], [204, 70], [204, 122], [226, 144], [266, 144], [285, 165], [285, 231], [260, 256], [204, 256], [158, 306], [158, 370]]],
    sites: [[61, 94], [155, 94], [245, 92], [84, 212], [237, 195], [102, 246], [207, 220], [157, 258], [112, 328], [205, 326]],
    troop: 'wu_spear', shield: 'wu_shield', cavalry: 'wu_cavalry', bosses: ['zhuran', 'luxun'], strength: 0.90
  },
];
export function commandBonus(level: number, star: number, peak: number) {
  return Math.min(0.15, 0.01 + Math.max(0, level - 1) * 0.0008 + Math.max(0, star - 1) * 0.012 + Math.max(0, peak) * 0.0008);
}
