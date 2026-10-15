// 锦囊妙计：每局在固定时间点三选一，获得改变打法的计策
// 良策 = 稳定的数值提升；妙计 = 改变规则；神机 = 很少出现，能决定整局打法

export type StratTier = 0 | 1 | 2;

export type StratId =
  // 良策
  | 'libing' | 'shengou' | 'shensu' | 'yiyi' | 'jiliang' | 'qinwang' | 'yangjing' | 'paozhuan'
  // 妙计
  | 'beishui' | 'kurou' | 'caochuan' | 'lianhuan' | 'jinchan' | 'huoshao' | 'shimian' | 'chenhuo' | 'guohe'
  // 神机
  | 'wanjian' | 'jiedao' | 'qixing' | 'wolong' | 'bazhen' | 'taoyuan' | 'yiqi';

export interface StratDef {
  id: StratId;
  name: string;
  tier: StratTier;
  desc: string;
}

export const TIER_NAMES = ['良策', '妙计', '神机'];
export const TIER_COLORS = ['#0099db', '#feae34', '#dc5bd0'];

export const STRATS: StratDef[] = [
  { id: 'libing', tier: 0, name: '厉兵秣马', desc: '伤害+20%' },
  { id: 'shengou', tier: 0, name: '深沟高垒', desc: '生命上限+15%，受到伤害-12%' },
  { id: 'shensu', tier: 0, name: '兵贵神速', desc: '移动速度+12%，技能冷却-8%' },
  { id: 'yiyi', tier: 0, name: '以逸待劳', desc: '站着不动时，每秒回复2%生命' },
  { id: 'jiliang', tier: 0, name: '广积粮', desc: '金币获取+40%，经验获取+10%' },
  { id: 'qinwang', tier: 0, name: '擒贼擒王', desc: '对精英和敌将的伤害+30%' },
  { id: 'yangjing', tier: 0, name: '养精蓄锐', desc: '金疮药冷却-40%，回复量+10%' },
  { id: 'paozhuan', tier: 0, name: '抛砖引玉', desc: '立即获得2次升级机会' },

  { id: 'beishui', tier: 1, name: '背水一战', desc: '生命低于40%时，伤害+50%' },
  { id: 'kurou', tier: 1, name: '苦肉计', desc: '生命上限-20%，伤害+35%' },
  { id: 'caochuan', tier: 1, name: '草船借箭', desc: '被敌人的箭矢、飞石击中时，向四周射出8支箭' },
  { id: 'lianhuan', tier: 1, name: '连环计', desc: '击败敌人时有20%几率爆炸，波及周围敌人' },
  { id: 'jinchan', tier: 1, name: '金蝉脱壳', desc: '受到致命伤害时，回复50%生命、震退身边敌人并无敌3秒（每局一次）' },
  { id: 'huoshao', tier: 1, name: '火烧连营', desc: '每10秒在敌人最多的地方燃起一片火海' },
  { id: 'shimian', tier: 1, name: '十面埋伏', desc: '每8秒伏兵四起，对身边敌人造成伤害并击退' },
  { id: 'chenhuo', tier: 1, name: '趁火打劫', desc: '金币掉落翻倍；本局每拾取25金币，伤害+1%（最多+40%）' },
  { id: 'guohe', tier: 1, name: '过河拆桥', desc: '释放大招后15秒内，伤害+50%，移动速度+20%' },

  { id: 'wanjian', tier: 2, name: '万箭齐发', desc: '每15秒箭雨覆盖全屏，对所有敌人造成大量伤害' },
  { id: 'jiedao', tier: 2, name: '借刀杀人', desc: '被击飞的敌人会撞伤沿途的其他敌人（每个最多撞3人）' },
  { id: 'qixing', tier: 2, name: '七星续命', desc: '获得1次复活机会；复活后伤害+25%' },
  { id: 'wolong', tier: 2, name: '卧龙出山', desc: '技能冷却-15%，技能范围和持续时间+15%' },
  { id: 'bazhen', tier: 2, name: '八阵图', desc: '身边布下石阵，持续伤害并减速靠近的敌人' },
  { id: 'taoyuan', tier: 2, name: '桃园结义', desc: '立即使所有技能和兵法提升1级' },
  { id: 'yiqi', tier: 2, name: '一骑当千', desc: '选择后每击败100名敌人，伤害永久+4%' },
];

export const STRAT_BY_ID = {} as Record<StratId, StratDef>;
STRATS.forEach((s) => (STRAT_BY_ID[s.id] = s));

/** 每局三次锦囊的时间点（秒） */
export const STRAT_TIMES = [120, 300, 450];

/** 每到一个锦囊时间点，之后出现的敌人（含敌将）血量 +15%（三次后 +45%），抵消计策带来的战力 */
export const STRAT_HP_STEP = 0.15;

/** 第几次锦囊各品质出现的权重：越往后越容易出神机 */
export const STRAT_TIER_WEIGHTS = [
  [70, 27, 3],
  [40, 48, 12],
  [20, 55, 25],
];
