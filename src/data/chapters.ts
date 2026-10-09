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
}

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
