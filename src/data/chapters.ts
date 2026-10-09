// 章节与刷怪时间轴

export interface WaveSeg {
  from: number; // 秒
  to: number;
  density: [number, number]; // 场上目标敌人数量（起 → 止）
  pool: [string, number][]; // 敌人 id 与权重
  interval: number; // 刷新间隔
}

export type EventType = 'elite' | 'ring' | 'stampede' | 'midboss' | 'boss' | 'swarm' | 'lanterns';

export interface ChapterEvent {
  t: number;
  type: EventType;
  enemy?: string;
  count?: number;
  text?: string;
}

export interface ChapterDef {
  id: number;
  name: string;
  subtitle: string;
  theme: string;
  story: string;
  duration: number;
  hpMul: number;
  dmgMul: number;
  growth: number; // 每分钟敌人生命成长
  waves: WaveSeg[];
  events: ChapterEvent[];
  midBoss: string;
  boss: string;
  /** 通关金币基础值 */
  goldBase: number;
  /** 推荐战力 */
  power: number;
  /** 无尽模式 */
  endless?: boolean;
}

// —— 难度 ——
export interface DifficultyDef {
  id: number;
  name: string;
  hp: number;
  dmg: number;
  reward: number;
  qShift: number; // 装备掉落品质提升
  power: number; // 推荐战力倍率
  color: string;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 0, name: '普通', hp: 1, dmg: 1, reward: 1, qShift: 0, power: 1, color: '#9be37a' },
  { id: 1, name: '困难', hp: 2.4, dmg: 1.7, reward: 1.6, qShift: 1, power: 2, color: '#feae34' },
  { id: 2, name: '噩梦', hp: 5.5, dmg: 2.8, reward: 2.5, qShift: 2, power: 4, color: '#e43b44' },
];

function standardEvents(o: { elite: string; ring: string; stampede: string; swarm: string; midBoss: string; boss: string }): ChapterEvent[] {
  return [
    { t: 45, type: 'lanterns' },
    { t: 75, type: 'swarm', enemy: o.swarm, count: 24, text: '流寇来袭！' },
    { t: 120, type: 'elite', enemy: o.elite, count: 1 },
    { t: 170, type: 'ring', enemy: o.ring, count: 36, text: '四面伏兵！' },
    { t: 210, type: 'lanterns' },
    { t: 240, type: 'elite', enemy: o.elite, count: 1 },
    { t: 270, type: 'stampede', enemy: o.stampede, count: 14, text: '骑兵冲阵！' },
    { t: 300, type: 'midboss', enemy: o.midBoss },
    { t: 360, type: 'elite', enemy: o.elite, count: 2 },
    { t: 390, type: 'lanterns' },
    { t: 400, type: 'ring', enemy: o.ring, count: 48, text: '四面伏兵！' },
    { t: 450, type: 'stampede', enemy: o.stampede, count: 20, text: '骑兵冲阵！' },
    { t: 480, type: 'elite', enemy: o.elite, count: 2 },
    { t: 510, type: 'swarm', enemy: o.swarm, count: 40, text: '流寇来袭！' },
    { t: 530, type: 'lanterns' },
    { t: 540, type: 'ring', enemy: o.ring, count: 60, text: '十面埋伏！' },
    { t: 570, type: 'elite', enemy: o.elite, count: 3 },
    { t: 600, type: 'boss', enemy: o.boss },
  ];
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1, name: '长坂坡', subtitle: '单骑救主', theme: 'changban',
    story: '建安十三年，曹操亲率虎豹骑追击刘备于当阳长坂。赵云怀抱阿斗，于百万军中七进七出……',
    duration: 600, hpMul: 1, dmgMul: 1, growth: 0.28, goldBase: 300, power: 0,
    waves: [
      { from: 0, to: 60, density: [8, 24], pool: [['wei_spear', 10]], interval: 0.8 },
      { from: 60, to: 180, density: [24, 60], pool: [['wei_spear', 10], ['wei_shield', 3], ['wei_archer', 2], ['bandit', 4]], interval: 0.6 },
      { from: 180, to: 300, density: [60, 100], pool: [['wei_spear', 8], ['wei_shield', 4], ['wei_archer', 3], ['wei_cavalry', 3]], interval: 0.5 },
      { from: 300, to: 450, density: [100, 150], pool: [['wei_spear', 6], ['wei_shield', 5], ['wei_archer', 3], ['wei_cavalry', 4], ['wei_heavy', 1]], interval: 0.4 },
      { from: 450, to: 600, density: [150, 200], pool: [['wei_spear', 5], ['wei_shield', 5], ['wei_archer', 3], ['wei_cavalry', 4], ['tiger_cavalry', 2], ['wei_heavy', 2]], interval: 0.35 },
      { from: 600, to: 9999, density: [120, 120], pool: [['wei_spear', 4], ['tiger_cavalry', 3]], interval: 0.5 },
    ],
    events: standardEvents({ elite: 'wei_heavy', ring: 'wei_spear', stampede: 'wei_cavalry', swarm: 'bandit', midBoss: 'xiahouen', boss: 'caochun' }),
    midBoss: 'xiahouen', boss: 'caochun',
  },
  {
    id: 2, name: '取桂阳', subtitle: '义拒樊氏', theme: 'guiyang',
    story: '赤壁之后，赵云领兵三千取桂阳。太守赵范献计不成，遣陈应、鲍隆诈降……',
    duration: 600, hpMul: 3.1, dmgMul: 2.0, growth: 0.3, goldBase: 520, power: 1500,
    waves: [
      { from: 0, to: 60, density: [10, 30], pool: [['gy_spear', 10], ['bandit', 4]], interval: 0.7 },
      { from: 60, to: 180, density: [30, 70], pool: [['gy_spear', 10], ['gy_shield', 3], ['gy_archer', 3], ['bandit', 4]], interval: 0.55 },
      { from: 180, to: 300, density: [70, 110], pool: [['gy_spear', 8], ['gy_shield', 5], ['gy_archer', 4]], interval: 0.45 },
      { from: 300, to: 450, density: [110, 160], pool: [['gy_spear', 6], ['gy_shield', 5], ['gy_archer', 4], ['wei_heavy', 1]], interval: 0.4 },
      { from: 450, to: 600, density: [160, 210], pool: [['gy_spear', 5], ['gy_shield', 6], ['gy_archer', 4], ['wei_heavy', 2]], interval: 0.33 },
      { from: 600, to: 9999, density: [120, 120], pool: [['gy_spear', 4], ['gy_shield', 3]], interval: 0.5 },
    ],
    events: standardEvents({ elite: 'wei_heavy', ring: 'gy_spear', stampede: 'wei_cavalry', swarm: 'bandit', midBoss: 'chenying', boss: 'baolong' }),
    midBoss: 'chenying', boss: 'baolong',
  },
  {
    id: 3, name: '汉水之战', subtitle: '空营退敌', theme: 'hanshui',
    story: '定军山后，曹操亲引大军争夺汉中粮草。黄忠被围，赵云引数十骑突入敌阵救出，退回营寨大开营门……',
    duration: 600, hpMul: 6.8, dmgMul: 3.1, growth: 0.32, goldBase: 860, power: 2800,
    waves: [
      { from: 0, to: 60, density: [12, 34], pool: [['wei_spear', 10], ['wei_archer', 3]], interval: 0.65 },
      { from: 60, to: 180, density: [34, 80], pool: [['wei_spear', 8], ['wei_shield', 4], ['wei_archer', 4], ['wei_cavalry', 3]], interval: 0.5 },
      { from: 180, to: 300, density: [80, 120], pool: [['wei_spear', 6], ['wei_shield', 5], ['wei_archer', 4], ['wei_cavalry', 5]], interval: 0.42 },
      { from: 300, to: 450, density: [120, 170], pool: [['wei_spear', 5], ['wei_shield', 5], ['wei_archer', 4], ['wei_cavalry', 5], ['wei_heavy', 2]], interval: 0.36 },
      { from: 450, to: 600, density: [170, 220], pool: [['wei_shield', 5], ['wei_archer', 4], ['tiger_cavalry', 4], ['wei_heavy', 3], ['elite_guard', 1]], interval: 0.3 },
      { from: 600, to: 9999, density: [130, 130], pool: [['wei_cavalry', 4], ['wei_heavy', 2]], interval: 0.5 },
    ],
    events: standardEvents({ elite: 'elite_guard', ring: 'wei_shield', stampede: 'wei_cavalry', swarm: 'wei_spear', midBoss: 'xuhuang', boss: 'zhanghe' }),
    midBoss: 'xuhuang', boss: 'zhanghe',
  },
  {
    id: 4, name: '凤鸣山', subtitle: '老当益壮', theme: 'fengming',
    story: '诸葛亮北伐，年逾七旬的赵云请为先锋。西凉大将韩德率四子来战，赵云连斩其子……',
    duration: 600, hpMul: 13.5, dmgMul: 4.6, growth: 0.34, goldBase: 1400, power: 4800,
    waves: [
      { from: 0, to: 60, density: [14, 38], pool: [['qiang_spear', 10]], interval: 0.6 },
      { from: 60, to: 180, density: [38, 85], pool: [['qiang_spear', 8], ['qiang_club', 4], ['gy_archer', 3]], interval: 0.5 },
      { from: 180, to: 300, density: [85, 130], pool: [['qiang_spear', 6], ['qiang_club', 5], ['gy_archer', 3], ['qiang_cavalry', 4]], interval: 0.4 },
      { from: 300, to: 450, density: [130, 180], pool: [['qiang_spear', 5], ['qiang_club', 5], ['gy_archer', 4], ['qiang_cavalry', 5]], interval: 0.34 },
      { from: 450, to: 600, density: [180, 230], pool: [['qiang_club', 6], ['gy_archer', 4], ['qiang_cavalry', 6], ['elite_guard', 1]], interval: 0.28 },
      { from: 600, to: 9999, density: [130, 130], pool: [['qiang_cavalry', 4], ['qiang_club', 3]], interval: 0.5 },
    ],
    events: standardEvents({ elite: 'elite_guard', ring: 'qiang_spear', stampede: 'qiang_cavalry', swarm: 'qiang_spear', midBoss: 'hanying', boss: 'hande' }),
    midBoss: 'hanying', boss: 'hande',
  },
  {
    id: 5, name: '箕谷断后', subtitle: '烧阁断道', theme: 'jigu',
    story: '街亭失守，蜀军全线撤退。赵云于箕谷亲自断后，大雪封山，曹真大军压境……',
    duration: 600, hpMul: 26, dmgMul: 6.8, growth: 0.36, goldBase: 2200, power: 8000,
    waves: [
      { from: 0, to: 60, density: [16, 40], pool: [['wei_spear', 10], ['wei_shield', 3]], interval: 0.55 },
      { from: 60, to: 180, density: [40, 90], pool: [['wei_spear', 6], ['wei_shield', 5], ['wei_archer', 4], ['wei_cavalry', 3]], interval: 0.45 },
      { from: 180, to: 300, density: [90, 140], pool: [['wei_shield', 5], ['wei_archer', 4], ['wei_cavalry', 4], ['wei_heavy', 2]], interval: 0.38 },
      { from: 300, to: 450, density: [140, 190], pool: [['wei_shield', 5], ['wei_archer', 4], ['tiger_cavalry', 4], ['wei_heavy', 3], ['elite_guard', 1]], interval: 0.32 },
      { from: 450, to: 600, density: [190, 240], pool: [['wei_shield', 4], ['wei_archer', 4], ['tiger_cavalry', 5], ['wei_heavy', 4], ['elite_guard', 2]], interval: 0.27 },
      { from: 600, to: 9999, density: [140, 140], pool: [['tiger_cavalry', 4], ['elite_guard', 2]], interval: 0.5 },
    ],
    events: standardEvents({ elite: 'elite_guard', ring: 'wei_shield', stampede: 'tiger_cavalry', swarm: 'wei_spear', midBoss: 'suyong', boss: 'caozhen' }),
    midBoss: 'suyong', boss: 'caozhen',
  },
];

/** 第 6～10 章的刷怪表：按阵营生成，节奏与前五章一致 */
function waves(early: string[], mid: string[], late: string[], heavy: string, elite: string): WaveSeg[] {
  const w = (ids: string[], ws: number[]): [string, number][] => ids.map((id, i) => [id, ws[i] ?? 3]);
  return [
    { from: 0, to: 60, density: [16, 42], pool: w(early, [10, 3]), interval: 0.55 },
    { from: 60, to: 180, density: [42, 95], pool: w(mid, [7, 5, 4, 3]), interval: 0.45 },
    { from: 180, to: 300, density: [95, 145], pool: w(mid.concat(heavy), [5, 5, 4, 4, 2]), interval: 0.38 },
    { from: 300, to: 450, density: [145, 195], pool: w(late.concat(heavy), [5, 4, 4, 4, 3]), interval: 0.32 },
    { from: 450, to: 600, density: [195, 245], pool: w(late.concat([heavy, elite]), [4, 4, 5, 4, 3, 2]), interval: 0.27 },
    { from: 600, to: 9999, density: [140, 140], pool: w([late[late.length - 1], elite], [4, 2]), interval: 0.5 },
  ];
}

CHAPTERS.push(
  {
    id: 6, name: '虎牢关', subtitle: '群雄讨董', theme: 'hulao',
    story: '十八路诸侯会盟讨伐董卓，西凉军据守虎牢关。华雄连斩数将，关下尸横遍野……',
    duration: 600, hpMul: 40, dmgMul: 8.6, growth: 0.36, goldBase: 3200, power: 12000,
    waves: waves(['qiang_spear', 'bandit'], ['qiang_spear', 'qiang_club', 'gy_archer', 'qiang_cavalry'], ['qiang_club', 'gy_archer', 'qiang_cavalry', 'tiger_cavalry'], 'xl_heavy', 'elite_guard'),
    events: standardEvents({ elite: 'xl_heavy', ring: 'qiang_spear', stampede: 'qiang_cavalry', swarm: 'bandit', midBoss: 'huaxiong', boss: 'dongzhuo' }),
    midBoss: 'huaxiong', boss: 'dongzhuo',
  },
  {
    id: 7, name: '官渡', subtitle: '以少胜多', theme: 'guandu',
    story: '袁绍举河北之兵南下，颜良、文丑为先锋。白马、延津两战，胜负只在一线之间……',
    duration: 600, hpMul: 54, dmgMul: 9.6, growth: 0.37, goldBase: 4400, power: 18000,
    waves: waves(['yuan_spear', 'yuan_archer'], ['yuan_spear', 'yuan_shield', 'yuan_archer', 'yuan_cavalry'], ['yuan_shield', 'yuan_archer', 'yuan_cavalry', 'tiger_cavalry'], 'wei_heavy', 'elite_guard'),
    events: standardEvents({ elite: 'elite_guard', ring: 'yuan_spear', stampede: 'yuan_cavalry', swarm: 'yuan_spear', midBoss: 'yanliang', boss: 'wenchou' }),
    midBoss: 'yanliang', boss: 'wenchou',
  },
  {
    id: 8, name: '赤壁', subtitle: '火烧连营', theme: 'chibi',
    story: '曹操挥师八十万顺江而下，连环战船横锁长江。东风骤起，一把大火映红了赤壁……',
    duration: 600, hpMul: 90, dmgMul: 13, growth: 0.38, goldBase: 6000, power: 27000,
    waves: waves(['wei_spear', 'wei_archer'], ['wei_spear', 'wei_shield', 'wei_archer', 'wei_cavalry'], ['wei_shield', 'wei_archer', 'tiger_cavalry', 'wei_cavalry'], 'wei_heavy', 'elite_guard'),
    events: standardEvents({ elite: 'elite_guard', ring: 'wei_shield', stampede: 'tiger_cavalry', swarm: 'wei_spear', midBoss: 'caimao', boss: 'caocao' }),
    midBoss: 'caimao', boss: 'caocao',
  },
  {
    id: 9, name: '夷陵', subtitle: '连营七百里', theme: 'yiling',
    story: '刘备为报关羽之仇倾国伐吴，连营七百里。陆逊坚守不出，待时而动……',
    duration: 600, hpMul: 135, dmgMul: 16, growth: 0.39, goldBase: 8200, power: 40000,
    waves: waves(['wu_spear', 'wu_archer'], ['wu_spear', 'wu_shield', 'wu_archer', 'wu_cavalry'], ['wu_shield', 'wu_archer', 'wu_cavalry', 'wu_spear'], 'xl_heavy', 'elite_guard'),
    events: standardEvents({ elite: 'elite_guard', ring: 'wu_shield', stampede: 'wu_cavalry', swarm: 'wu_spear', midBoss: 'zhuran', boss: 'luxun' }),
    midBoss: 'zhuran', boss: 'luxun',
  },
  {
    id: 10, name: '五丈原', subtitle: '星落秋风', theme: 'wuzhang',
    story: '诸葛亮六出祁山，与司马懿对峙五丈原。秋风萧瑟，将星欲坠，赵云之志由你延续……',
    duration: 600, hpMul: 200, dmgMul: 20, growth: 0.4, goldBase: 11000, power: 60000,
    waves: waves(['wei_spear', 'wei_shield'], ['wei_shield', 'wei_archer', 'tiger_cavalry', 'wei_heavy'], ['wei_heavy', 'wei_archer', 'tiger_cavalry', 'elite_guard'], 'xl_heavy', 'elite_guard'),
    events: standardEvents({ elite: 'elite_guard', ring: 'wei_heavy', stampede: 'tiger_cavalry', swarm: 'wei_shield', midBoss: 'guohuai', boss: 'simayi' }),
    midBoss: 'guohuai', boss: 'simayi',
  },
);

/** 无尽模式：刷怪与事件由 spawner 动态生成 */
export const ENDLESS: ChapterDef = {
  id: 0, name: '无尽战场', subtitle: '能撑多久？', theme: 'changban',
  story: '敌军源源不断，没有尽头。坚持得越久，奖励越丰厚。',
  duration: 1e9, hpMul: 2, dmgMul: 1.6, growth: 0.55, goldBase: 0, power: 0, endless: true,
  waves: [], events: [], midBoss: '', boss: '',
};

/** 无尽模式的敌人池：随时间解锁更强兵种 */
export const ENDLESS_POOLS: { from: number; pool: [string, number][] }[] = [
  { from: 0, pool: [['wei_spear', 10], ['bandit', 4]] },
  { from: 90, pool: [['wei_spear', 6], ['wei_shield', 4], ['wei_archer', 3], ['yuan_spear', 4]] },
  { from: 240, pool: [['wu_spear', 5], ['wei_shield', 4], ['yuan_archer', 3], ['wei_cavalry', 4], ['wei_heavy', 1]] },
  { from: 420, pool: [['wu_shield', 4], ['wu_archer', 3], ['tiger_cavalry', 4], ['wei_heavy', 2], ['qiang_club', 3]] },
  { from: 660, pool: [['xl_heavy', 3], ['tiger_cavalry', 5], ['wu_archer', 3], ['elite_guard', 1], ['yuan_cavalry', 3]] },
];
