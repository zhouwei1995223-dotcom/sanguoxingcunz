// 敌人数据。外观在 gfx/art/roster.ts，按 sprite 字段关联。

export type EnemyAI = 'chase' | 'ranged' | 'charger' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string; // 精灵名（soldier_xxx / general_xxx）
  hp: number;
  speed: number;
  dmg: number;
  radius: number;
  exp: number; // 掉落经验值
  ai: EnemyAI;
  mass?: number; // 越大越难击退（1 为普通）
  range?: number; // 远程：保持距离
  shootCd?: number;
  proj?: string;
  scale?: number; // 绘制放大倍数（整数）
}

export const ENEMIES: Record<string, EnemyDef> = {
  wei_spear: { id: 'wei_spear', name: '曹军枪兵', sprite: 'wei_spear', hp: 10, speed: 30, dmg: 5, radius: 6, exp: 1, ai: 'chase' },
  wei_shield: { id: 'wei_shield', name: '曹军盾兵', sprite: 'wei_shield', hp: 32, speed: 22, dmg: 7, radius: 7, exp: 2, ai: 'chase', mass: 3 },
  wei_archer: { id: 'wei_archer', name: '曹军弓手', sprite: 'wei_archer', hp: 8, speed: 28, dmg: 6, radius: 6, exp: 2, ai: 'ranged', range: 95, shootCd: 3.2, proj: 'arrow' },
  wei_cavalry: { id: 'wei_cavalry', name: '曹军骑兵', sprite: 'wei_cavalry', hp: 22, speed: 52, dmg: 9, radius: 9, exp: 3, ai: 'chase', mass: 2 },
  tiger_cavalry: { id: 'tiger_cavalry', name: '虎豹骑', sprite: 'tiger_cavalry', hp: 45, speed: 58, dmg: 12, radius: 9, exp: 5, ai: 'chase', mass: 3 },
  wei_heavy: { id: 'wei_heavy', name: '重甲戟兵', sprite: 'wei_heavy', hp: 90, speed: 20, dmg: 12, radius: 8, exp: 6, ai: 'chase', mass: 6 },
  bandit: { id: 'bandit', name: '流寇', sprite: 'bandit', hp: 6, speed: 40, dmg: 4, radius: 6, exp: 1, ai: 'chase' },
  gy_spear: { id: 'gy_spear', name: '桂阳枪兵', sprite: 'gy_spear', hp: 12, speed: 32, dmg: 6, radius: 6, exp: 1, ai: 'chase' },
  gy_shield: { id: 'gy_shield', name: '桂阳盾兵', sprite: 'gy_shield', hp: 36, speed: 22, dmg: 8, radius: 7, exp: 2, ai: 'chase', mass: 3 },
  gy_archer: { id: 'gy_archer', name: '桂阳猎户', sprite: 'gy_archer', hp: 9, speed: 30, dmg: 7, radius: 6, exp: 2, ai: 'ranged', range: 100, shootCd: 2.8, proj: 'arrow' },
  qiang_spear: { id: 'qiang_spear', name: '羌兵', sprite: 'qiang_spear', hp: 14, speed: 34, dmg: 7, radius: 6, exp: 1, ai: 'chase' },
  qiang_club: { id: 'qiang_club', name: '羌族力士', sprite: 'qiang_club', hp: 40, speed: 26, dmg: 10, radius: 7, exp: 3, ai: 'chase', mass: 3 },
  qiang_cavalry: { id: 'qiang_cavalry', name: '西凉铁骑', sprite: 'qiang_cavalry', hp: 30, speed: 56, dmg: 11, radius: 9, exp: 4, ai: 'chase', mass: 2 },
  elite_guard: { id: 'elite_guard', name: '魏军精锐', sprite: 'elite_guard', hp: 120, speed: 24, dmg: 14, radius: 8, exp: 8, ai: 'chase', mass: 6 },
};

export type BossSkill = 'charge' | 'spin' | 'throw' | 'slam' | 'summon' | 'ring';

export interface BossDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  hp: number;
  speed: number;
  dmg: number;
  radius: number;
  skills: BossSkill[];
  summon?: string;
  proj?: string;
  /** 击败时的台词 */
  quote: string;
}

export const BOSSES: Record<string, BossDef> = {
  xiahouen: { id: 'xiahouen', name: '夏侯恩', title: '曹操背剑将', sprite: 'xiahouen', hp: 1800, speed: 34, dmg: 14, radius: 13, skills: ['charge', 'spin'], quote: '青釭剑……竟落入你手！' },
  caochun: { id: 'caochun', name: '曹纯', title: '虎豹骑统领', sprite: 'caochun', hp: 10000, speed: 38, dmg: 18, radius: 13, skills: ['charge', 'summon', 'charge', 'ring'], summon: 'tiger_cavalry', quote: '虎豹骑……竟拦不住一人一骑！' },
  chenying: { id: 'chenying', name: '陈应', title: '桂阳管军校尉', sprite: 'chenying', hp: 4200, speed: 36, dmg: 18, radius: 13, skills: ['throw', 'charge'], proj: 'fork', quote: '飞叉竟伤不得他分毫……' },
  baolong: { id: 'baolong', name: '鲍隆', title: '射虎猛士', sprite: 'baolong', hp: 22000, speed: 32, dmg: 24, radius: 14, skills: ['slam', 'summon', 'slam', 'throw'], summon: 'gy_shield', proj: 'stone', quote: '常山赵子龙，名不虚传！' },
  xuhuang: { id: 'xuhuang', name: '徐晃', title: '魏国大将', sprite: 'xuhuang', hp: 9000, speed: 36, dmg: 26, radius: 14, skills: ['spin', 'charge', 'slam'], quote: '子龙一身是胆，今日方知！' },
  zhanghe: { id: 'zhanghe', name: '张郃', title: '河北名将', sprite: 'zhanghe', hp: 45000, speed: 40, dmg: 30, radius: 14, skills: ['charge', 'ring', 'summon', 'throw'], summon: 'wei_cavalry', proj: 'arrow', quote: '汉水之战，是我输了……' },
  hanying: { id: 'hanying', name: '韩瑛', title: '韩德长子', sprite: 'hanying', hp: 16000, speed: 38, dmg: 32, radius: 13, skills: ['charge', 'spin'], quote: '父亲，替孩儿报仇……' },
  hande: { id: 'hande', name: '韩德', title: '西凉大将', sprite: 'hande', hp: 80000, speed: 34, dmg: 40, radius: 15, skills: ['slam', 'summon', 'spin', 'charge'], summon: 'qiang_cavalry', quote: '老将军宝刀未老啊……' },
  suyong: { id: 'suyong', name: '苏颙', title: '曹真先锋', sprite: 'suyong', hp: 28000, speed: 40, dmg: 44, radius: 13, skills: ['charge', 'throw', 'spin'], proj: 'arrow', quote: '赵云竟然还活着！' },
  caozhen: { id: 'caozhen', name: '曹真', title: '魏国大都督', sprite: 'caozhen', hp: 140000, speed: 36, dmg: 52, radius: 15, skills: ['ring', 'summon', 'charge', 'slam', 'throw'], summon: 'elite_guard', proj: 'arrow', quote: '撤军……速速撤军！' },
};
