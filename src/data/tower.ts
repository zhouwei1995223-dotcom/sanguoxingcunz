/** 所有地图以 320 × 400 的沙盘坐标定义，画面和战斗使用同一路线。 */
export type Point = readonly [number, number];
export const FIELD_W = 320, FIELD_H = 400, MARCH_SECONDS = 240, GATE_HP = 20;
export const TOWER_KINDS = ['arrow', 'bolt', 'stone', 'oil', 'drum'] as const;
export type TowerKind = typeof TOWER_KINDS[number];
export type Branch = 0 | 1;
export const AID_LIMIT = 3;
// 每张援将牌相对一张建筑或阵法牌的抽取权重。
export const ALLY_WEIGHT = 0.4;
export const ALLY_IDS = ['guanyu', 'zhangfei', 'huangzhong'] as const;
export const TACTIC_IDS = ['frost', 'lightning', 'wildfire'] as const;
export type AllyId = typeof ALLY_IDS[number];
export type TacticId = typeof TACTIC_IDS[number];
export const ALLY_CARDS = {
  guanyu: { name: '关羽', skill: '青龙横扫', desc: '驰援前线，挥刀斩击一片敌军。', interval: 2.1, range: 34, damage: 32 },
  zhangfei: { name: '张飞', skill: '长坂断喝', desc: '冲到敌前，震伤并眩晕附近敌军。', interval: 3.6, range: 43, damage: 23 },
  huangzhong: { name: '黄忠', skill: '定军神射', desc: '远程狙击，对精英和敌将额外增伤。', interval: 1.6, range: 130, damage: 32 }
};
export const TACTIC_CARDS = {
  frost: { name: '寒冰阵', icon: 'w_aura', desc: '每隔 7 秒冰封领头敌军及其周围目标。', interval: 7 },
  lightning: { name: '引雷符', icon: 'w_thunder', desc: '每隔 6 秒雷击最接近城门的三名敌军。', interval: 6 },
  wildfire: { name: '燎原火', icon: 'w_fire', desc: '每隔 6 秒在敌军脚下点燃一片火场。', interval: 6 }
};
// 拥有指定建筑和阵法后立即生效；不额外占牌或弹窗。
export const FORMATIONS: Record<TacticId, { kind: TowerKind; name: string; effect: string }> = {
  frost: { kind: 'stone', name: '碎冰礌石', effect: '砸中冰封敌军，冰片再击外围两人' },
  lightning: { kind: 'bolt', name: '惊雷连弩', effect: '贯穿后，雷弧跳向弩线外一人' },
  wildfire: { kind: 'oil', name: '引火连营', effect: '油罐落入火区，引爆周围敌军' },
};
export type TowerCard =
  | { type: 'tower'; kind: TowerKind; slot: number; level: number; branch?: Branch }
  | { type: 'ally'; id: AllyId }
  | { type: 'tactic'; id: TacticId };

export interface TowerSpec {
  name: string; range: number; damage: number; interval: number;
  desc: string; branches: readonly [string, string]; effects: readonly [string, string];
}
export const TOWERS: Record<TowerKind, TowerSpec> = {
  arrow: { name: '箭塔', range: 68, damage: 14, interval: 0.62, desc: '快射单体，适合截击轻步兵', branches: ['劲弓', '连珠'], effects: ['射程增至 92，箭伤提高 50%', '射击间隔缩短 42%'] },
  bolt: { name: '连弩台', range: 82, damage: 21, interval: 1.25, desc: '沿瞄准方向穿透一列敌军', branches: ['重弩', '排弩'], effects: ['贯穿箭伤提高 60%', '弩箭加宽，射击间隔缩短 30%'] },
  stone: { name: '投石台', range: 86, damage: 31, interval: 2.2, desc: '礌石溅射，对盾兵重甲增伤', branches: ['重砲', '碎石'], effects: ['砲击伤害提高 65%', '溅射半径从 24 扩至 40'] },
  oil: { name: '火油台', range: 69, damage: 12, interval: 2.6, desc: '落点持续燃烧，宜守弯道', branches: ['烈油', '火塘'], effects: ['燃烧伤害提高 60%', '火区扩至 30，燃烧延长至 3 秒'] },
  drum: { name: '战鼓台', range: 61, damage: 0, interval: 1, desc: '为邻塔加攻速，并减缓敌军', branches: ['激扬', '困阵'], effects: ['邻塔攻速加成提高至 55%', '范围增至 85，敌人减速 32%'] },
};
export function towerRange(kind: TowerKind, branch?: Branch) {
  if (kind === 'arrow' && branch === 0) return 92;
  if (kind === 'drum' && branch === 1) return 85;
  return TOWERS[kind].range;
}

export interface TowerMap {
  id: number; name: string; hint: string; theme: string; routes: Point[][]; sites: Point[];
  troop: string; shield: string; cavalry: string; bosses: [string, string]; strength: number; latePressure: number;
  /** 进攻波数（含中途敌将波和最终主将波） */
  waves: number;
  /** 精英特性：传令旗手加速周围士兵 / 持盾（投石与火焰破盾双倍） */
  elite: 'none' | 'banner' | 'shield' | 'both';
  /** 每条路线从第几波开始出兵（从 0 起；缺省为 0） */
  routeWave?: number[];
  /** 地图：底色、装饰物、河道 */
  ground: string; decor: string; river?: Point[];
  /** 选关列表上的简介 */
  brief: string;
}

/** 汉水双渡的河道（地图与水面波光共用）。 */
export const HANSHUI_RIVER: Point[] = [[0, 202], [64, 178], [111, 185], [159, 161], [207, 160], [263, 179], [320, 163]];
const CHIBI_RIVER: Point[] = [[0, 150], [70, 162], [140, 150], [210, 160], [270, 146], [320, 156]];
export const TOWER_MAPS: TowerMap[] = [
  {
    id: 1, name: '柳营驿道', hint: '单路回折，弯道内侧可照应两段驿道', theme: 'changban',
    routes: [[[0, 65], [240, 65], [260, 85], [260, 153], [238, 175], [68, 175], [49, 195], [49, 264], [72, 286], [233, 286], [256, 310], [256, 371]]],
    sites: [[64, 100], [160, 100], [98, 135], [220, 135], [88, 216], [182, 216], [280, 253], [110, 319], [203, 319], [288, 339]],
    troop: 'wei_spear', shield: 'wei_shield', cavalry: 'wei_cavalry', bosses: ['xiahouen', 'caochun'], strength: 0.66, latePressure: 3.30,
    waves: 8, elite: 'none', ground: '#c2c39c', decor: 'tree', brief: '单路回折'
  },
  {
    id: 2, name: '汉水双渡', hint: '传令旗为附近士兵加速，眩晕可打断', theme: 'hanshui',
    routes: [[[0, 59], [95, 59], [116, 81], [116, 128], [145, 156], [197, 156], [220, 178], [220, 245], [194, 269], [99, 269], [76, 291], [76, 367]],
    [[320, 77], [249, 77], [226, 100], [226, 135], [197, 156], [220, 178], [220, 245], [194, 269], [99, 269], [76, 291], [76, 367]]],
    sites: [[68, 98], [155, 98], [270, 98], [79, 193], [158, 193], [260, 193], [116, 232], [174, 232], [262, 250], [44, 315], [123, 315], [202, 315]],
    troop: 'yuan_spear', shield: 'yuan_shield', cavalry: 'yuan_cavalry', bosses: ['yanliang', 'wenchou'], strength: 0.81, latePressure: 2.42,
    waves: 9, elite: 'banner', ground: '#b3bca2', decor: 'reeds', river: HANSHUI_RIVER, brief: '双渡汇流'
  },
  {
    id: 3, name: '剑阁夹道', hint: '精英携盾进军，落石与火焰破盾更快', theme: 'fengming',
    routes: [[[0, 53], [85, 53], [109, 77], [109, 139], [79, 166], [54, 166], [36, 187], [36, 253], [62, 278], [131, 278], [158, 306], [158, 370]],
    [[320, 47], [228, 47], [204, 70], [204, 122], [226, 144], [266, 144], [285, 165], [285, 231], [260, 256], [204, 256], [158, 306], [158, 370]]],
    sites: [[60, 92], [154, 92], [249, 92], [49, 137], [157, 170], [241, 170], [78, 217], [205, 217], [103, 244], [157, 255], [28, 304], [255, 304], [112, 328], [205, 328]],
    troop: 'wu_spear', shield: 'wu_shield', cavalry: 'wu_cavalry', bosses: ['zhuran', 'luxun'], strength: 0.76, latePressure: 2.60,
    waves: 10, elite: 'shield', ground: '#beb594', decor: 'pine', brief: '两翼夹击'
  },
  {
    id: 4, name: '虎牢关', hint: '关前长折，第 3 波起西凉骑兵从东侧关隘杀出', theme: 'hulao',
    routes: [[[0, 58], [150, 58], [170, 78], [170, 128], [150, 148], [62, 148], [42, 168], [42, 236], [62, 256], [196, 256], [220, 280], [220, 371]],
    [[320, 112], [266, 112], [246, 132], [246, 232], [220, 258], [220, 280], [220, 371]]],
    sites: [[68, 98], [110, 95], [146, 113], [224, 107], [215, 146], [287, 173], [68, 179], [206, 185], [86, 215], [179, 215], [218, 224], [248, 272], [194, 290]],
    troop: 'qiang_spear', shield: 'gy_shield', cavalry: 'qiang_cavalry', bosses: ['huaxiong', 'dongzhuo'], strength: 0.81, latePressure: 2.6,
    waves: 10, elite: 'banner', routeWave: [0, 2], ground: '#c4b796', decor: 'deadTree', brief: '东关奇袭'
  },
  {
    id: 5, name: '赤壁', hint: '两岸夹江而来，江心汇合后绕营直扑城门', theme: 'chibi',
    routes: [[[0, 45], [90, 45], [110, 65], [110, 178], [134, 202], [160, 202], [160, 236], [182, 258], [262, 258], [282, 278], [282, 318], [262, 338], [100, 338], [80, 358], [80, 371]],
    [[320, 45], [232, 45], [212, 65], [212, 178], [188, 202], [160, 202], [160, 236], [182, 258], [262, 258], [282, 278], [282, 318], [262, 338], [100, 338], [80, 358], [80, 371]]],
    sites: [[47, 71], [170, 65], [281, 71], [74, 101], [152, 101], [254, 101], [170, 143], [236, 149], [146, 176], [224, 209], [134, 230], [188, 227], [218, 299], [257, 308]],
    troop: 'wei_spear', shield: 'wei_shield', cavalry: 'tiger_cavalry', bosses: ['caimao', 'caocao'], strength: 0.92, latePressure: 2.6,
    waves: 11, elite: 'shield', ground: '#b5bba4', decor: 'reeds', river: CHIBI_RIVER, brief: '隔江夹击'
  },
  {
    id: 6, name: '五丈原', hint: '三路齐出，第 5 波起侧翼直插城下', theme: 'wuzhang',
    routes: [[[0, 45], [70, 45], [90, 65], [90, 118], [112, 140], [160, 140], [160, 178], [182, 200], [258, 200], [280, 222], [280, 278], [258, 300], [182, 300], [160, 322], [160, 371]],
    [[320, 45], [250, 45], [230, 65], [230, 118], [208, 140], [160, 140], [160, 178], [182, 200], [258, 200], [280, 222], [280, 278], [258, 300], [182, 300], [160, 322], [160, 371]],
    [[0, 248], [92, 248], [112, 268], [112, 300], [92, 320], [42, 320], [22, 340], [22, 352], [42, 371], [160, 371]]],
    sites: [[62, 83], [116, 80], [206, 86], [272, 98], [137, 116], [179, 116], [227, 158], [131, 164], [188, 167], [221, 242], [86, 278], [50, 296], [134, 314], [56, 347], [98, 344]],
    troop: 'wei_spear', shield: 'wei_shield', cavalry: 'tiger_cavalry', bosses: ['guohuai', 'simayi'], strength: 0.64, latePressure: 2.6,
    waves: 12, elite: 'both', routeWave: [0, 0, 4], ground: '#c0b896', decor: 'deadTree', brief: '三路齐出'
  },
];

/** 波次名（按波的类型挑选，仅用于横幅）。 */
export const WAVE_NAMES = { troop: '步卒压进', mounted: '轻骑突袭', armored: '盾阵推进', swarm: '大军压境', first: '先锋试探' };
export function commandBonus(level: number, star: number, peak: number) {
  return Math.min(0.15, 0.01 + Math.max(0, level - 1) * 0.0008 + Math.max(0, star - 1) * 0.012 + Math.max(0, peak) * 0.0008);
}
