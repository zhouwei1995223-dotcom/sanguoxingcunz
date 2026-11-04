// 小红书「塔防」试玩：兵线对冲，没有塔。只做第 1 关可玩，后面两关只留数据。

export interface LaneLevelDef {
  id: number;
  name: string;
  subtitle: string;
  story: string;
  /** 我方 / 敌方兵营生命 */
  allyHp: number;
  enemyHp: number;
  /** 开局粮草、每秒自然产出 */
  startFood: number;
  income: number;
  /** 敌军编制：开局存量、每秒增长、随时间上浮 */
  enemyBudget0: number;
  enemyRate: number;
  enemyRamp: number;
  enemyHpMul: number;
  enemyAtkMul: number;
}

export const LANE_LEVELS: LaneLevelDef[] = [
  {
    id: 1, name: '长坂坡', subtitle: '兵线对冲',
    story: '曹军沿着长坂坡的小路压下来。点下手牌派出枪兵、弓手和武将，沿路对冲；粮卒留在营前产粮，击败敌军也会掉粮草。推掉坡顶的敌营就赢，自家兵营被攻破就输。这一关是试玩，没有奖励。',
    allyHp: 1620, enemyHp: 2400, startFood: 42, income: 3.6,
    enemyBudget0: 36, enemyRate: 9.2, enemyRamp: 0.07, enemyHpMul: 1.08, enemyAtkMul: 1.05,
  },
  // 预留：主页不开放。数值只是占位，方便以后加关。
  {
    id: 2, name: '当阳桥', subtitle: '敌众我寡',
    story: '预留关卡。',
    allyHp: 1760, enemyHp: 2500, startFood: 38, income: 4.4,
    enemyBudget0: 28, enemyRate: 4.5, enemyRamp: 0.03, enemyHpMul: 1.22, enemyAtkMul: 1.12,
  },
  {
    id: 3, name: '汉津口', subtitle: '重兵围堵',
    story: '预留关卡。',
    allyHp: 1840, enemyHp: 3200, startFood: 34, income: 4.2,
    enemyBudget0: 36, enemyRate: 5.3, enemyRamp: 0.036, enemyHpMul: 1.42, enemyAtkMul: 1.24,
  },
];

/** 主页能进的关卡数（后面的只在表里） */
export const LANE_OPEN_LEVELS = 1;

export interface LaneUnitDef {
  id: string;
  name: string;
  /** 玩家卡费，或敌军编制消耗 */
  cost: number;
  hp: number;
  atk: number;
  /** 沿路径的像素速度 */
  speed: number;
  /** 沿路径的攻击距离（像素） */
  range: number;
  interval: number;
  sprite: string;
  /** 牌堆权重；敌军为 0 */
  weight: number;
  enemy?: boolean;
  grain?: boolean;
  scale?: number;
  /** 卡面短说明 */
  blurb: string;
  color: string;
}

export const LANE_UNITS: LaneUnitDef[] = [
  { id: 'spear', name: '枪兵', cost: 18, hp: 100, atk: 15, speed: 56, range: 58, interval: 0.84, sprite: 'u_shu_spear', weight: 24, blurb: '近战', color: '#63c74d' },
  { id: 'shield', name: '盾兵', cost: 28, hp: 210, atk: 9, speed: 38, range: 50, interval: 1.02, sprite: 'u_shu_shield', weight: 16, blurb: '肉盾', color: '#8b9bb4' },
  { id: 'archer', name: '弓兵', cost: 24, hp: 64, atk: 14, speed: 50, range: 156, interval: 1.12, sprite: 'u_shu_archer', weight: 16, blurb: '远程', color: '#7cc8ff' },
  { id: 'cav', name: '轻骑', cost: 42, hp: 128, atk: 27, speed: 84, range: 62, interval: 0.76, sprite: 'u_shu_cav', weight: 10, blurb: '突击', color: '#feae34' },
  { id: 'grain', name: '粮卒', cost: 22, hp: 86, atk: 7, speed: 42, range: 48, interval: 1.12, sprite: 'u_bandit', weight: 16, grain: true, blurb: '产粮', color: '#e6c15a' },
  { id: 'e_spear', name: '曹枪', cost: 15, hp: 104, atk: 16, speed: 54, range: 56, interval: 0.86, sprite: 'u_wei_spear', weight: 0, enemy: true, blurb: '', color: '#7cc8ff' },
  { id: 'e_shield', name: '曹盾', cost: 22, hp: 200, atk: 11, speed: 36, range: 50, interval: 1.0, sprite: 'u_wei_shield', weight: 0, enemy: true, blurb: '', color: '#8b9bb4' },
  { id: 'e_archer', name: '曹弓', cost: 20, hp: 70, atk: 15, speed: 48, range: 156, interval: 1.08, sprite: 'u_wei_archer', weight: 0, enemy: true, blurb: '', color: '#c0cbdc' },
  { id: 'e_cav', name: '曹骑', cost: 32, hp: 128, atk: 25, speed: 80, range: 60, interval: 0.76, sprite: 'u_wei_cavalry', weight: 0, enemy: true, blurb: '', color: '#feae34' },
  { id: 'e_heavy', name: '重甲', cost: 42, hp: 300, atk: 22, speed: 32, range: 54, interval: 1.0, sprite: 'u_wei_heavy', weight: 0, enemy: true, scale: 1.28, blurb: '', color: '#d9a066' },
];

export const LANE_UNIT_BY_ID: Record<string, LaneUnitDef> = {};
LANE_UNITS.forEach((u) => (LANE_UNIT_BY_ID[u.id] = u));

/** 卡牌等级：1 最常见，3 最稀有 */
export const LANE_LV_STAT = [1, 1.42, 2.05];
export const LANE_LV_COST = [1, 1.32, 1.75];

/** 每位武将在牌堆里的权重（十人合计仍低于普通兵种） */
export const HERO_DECK_WEIGHT = 3.2;
export const HERO_CARD_COST = 56;

/** 粮卒每秒产出的粮草（再乘屯田） */
export const GRAIN_PER_SEC = 2.15;

/** 同侧单位沿路径的最小间距 */
export const LANE_GAP_PX = 15;

/** 敌军人数上限。己方出兵不设上限。 */
export const LANE_CAP = { enemy: 42 };

export interface LaneSkillDef {
  hero: string;
  name: string;
  /** 卡面上的短字 */
  short: string;
  desc: string;
  kind: 'dash' | 'cleave' | 'stun' | 'burn' | 'fury' | 'snipe' | 'charge' | 'volley' | 'guard' | 'meteor';
}

export const LANE_SKILLS: LaneSkillDef[] = [
  { hero: 'zhaoyun', name: '龙胆突进', short: '突进', desc: '沿路前冲并伤害穿过的敌军', kind: 'dash' },
  { hero: 'guanyu', name: '青龙刀气', short: '刀气', desc: '劈中最近的一簇敌军', kind: 'cleave' },
  { hero: 'zhangfei', name: '据水断喝', short: '断喝', desc: '震慑近处敌军，短时间不能动', kind: 'stun' },
  { hero: 'zhuge', name: '借东风', short: '东风', desc: '烧灼一段路上的敌军', kind: 'burn' },
  { hero: 'lvbu', name: '天下无双', short: '无双', desc: '短时间攻击大增，并重击最近的敌人', kind: 'fury' },
  { hero: 'huangzhong', name: '定军神射', short: '神射', desc: '狙击血量最高的敌军', kind: 'snipe' },
  { hero: 'machao', name: '西凉冲锋', short: '冲锋', desc: '加速冲向敌人并造成重击', kind: 'charge' },
  { hero: 'sunshangxiang', name: '连珠箭', short: '连珠', desc: '连续射击最近的几名敌军', kind: 'volley' },
  { hero: 'dianwei', name: '恶来护主', short: '护主', desc: '自己回血，并治疗近处友军', kind: 'guard' },
  { hero: 'jiangwei', name: '星落', short: '星落', desc: '砸中最密的一簇敌军', kind: 'meteor' },
];

export const LANE_SKILL_BY_HERO: Record<string, LaneSkillDef> = {};
LANE_SKILLS.forEach((s) => (LANE_SKILL_BY_HERO[s.hero] = s));

/** 远程武将：站在后排放技能 */
export const LANE_RANGED_HEROES = new Set(['zhuge', 'huangzhong', 'sunshangxiang']);

export interface LaneUpgradeDef {
  id: string;
  name: string;
  desc: string;
}

export const LANE_UPGRADES: LaneUpgradeDef[] = [
  { id: 'income', name: '广积粮', desc: '粮草自然产出 +28%' },
  { id: 'drop', name: '因粮于敌', desc: '击败敌军掉落的粮草 +40%' },
  { id: 'grain', name: '屯田', desc: '粮卒产量 +55%，在场时掉落再提高' },
  { id: 'atk', name: '强兵', desc: '我方攻击 +15%' },
  { id: 'hp', name: '固阵', desc: '我方生命 +18%' },
  { id: 'cost', name: '简政', desc: '手牌和之后的卡，费用 -8%' },
  { id: 'rare', name: '精兵', desc: '抽到 2 级、3 级卡的概率提高' },
  { id: 'camp', name: '深沟', desc: '我方兵营上限 +22%，并回复一段生命' },
  { id: 'speed', name: '疾行', desc: '我方移速 +12%' },
  { id: 'skill', name: '将略', desc: '武将技能伤害 +25%，冷却缩短 1 秒' },
  { id: 'spear', name: '征召', desc: '下一张补牌必定是枪兵' },
  { id: 'bonus', name: '犒赏', desc: '立即获得 48 粮草' },
];

/** 第 rank 次升级需要的经验（rank 从 1 开始） */
export const laneXpNeed = (rank: number) => 26 + (rank - 1) * 14;

/**
 * 抽卡等级。rare 每点把概率从 1 级挪到 2、3 级。
 * 初始约 72% / 22% / 6%。
 */
export function rollLaneLevel(rng: () => number, rare: number): 1 | 2 | 3 {
  const w3 = 6 + rare * 4;
  const w2 = 22 + rare * 8;
  const w1 = Math.max(8, 72 - rare * 12);
  const r = rng() * (w1 + w2 + w3);
  if (r < w3) return 3;
  if (r < w3 + w2) return 2;
  return 1;
}
