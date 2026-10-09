import type { WeaponId } from './skills';
import type { HeroId } from '../gfx/art/heroes';

// 武将：基础属性、专属武器、大招、天赋、获取方式

export type { HeroId };
export type UltKind = 'dragon' | 'crescent' | 'roar' | 'tornado' | 'whirl';

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  quote: string;
  role: string; // 定位
  passive: string; // 天赋描述
  baseAtk: number;
  baseHp: number;
  atkPerLv: number;
  hpPerLv: number;
  moveSpeed: number;
  pickup: number;
  weapon: WeaponId;
  ult: UltKind;
  ultName: string;
  ultDesc: string;
  /** 解锁方式说明 */
  unlockText: string;
  /** 用碎片解锁需要的数量 */
  unlockShards: number;
  /** 主题色（界面点缀） */
  color: string;
}

export const HEROES: HeroDef[] = [
  {
    id: 'zhaoyun', name: '赵云', title: '常山赵子龙', quote: '吾乃常山赵子龙也！', role: '均衡突进',
    passive: '一身是胆：伤害+10%，生命低于30%时再提升30%',
    baseAtk: 20, baseHp: 120, atkPerLv: 2, hpPerLv: 10, moveSpeed: 78, pickup: 40,
    weapon: 'spear', ult: 'dragon', ultName: '龙胆·七进七出', ultDesc: '化身白龙在敌阵中连冲七次，最后全屏冲击',
    unlockText: '初始武将', unlockShards: 0, color: '#c0cbdc',
  },
  {
    id: 'guanyu', name: '关羽', title: '武圣关云长', quote: '关某在此，谁敢一战！', role: '重击近战',
    passive: '武圣：暴击率+8%，暴击伤害+40%',
    baseAtk: 24, baseHp: 130, atkPerLv: 2.4, hpPerLv: 11, moveSpeed: 72, pickup: 40,
    weapon: 'blade', ult: 'crescent', ultName: '青龙出水', ultDesc: '连挥三道巨型青龙刀气，横扫整个战场',
    unlockText: '通关第2章获得', unlockShards: 50, color: '#63c74d',
  },
  {
    id: 'zhangfei', name: '张飞', title: '燕人张翼德', quote: '燕人张翼德在此！', role: '坦克控场',
    passive: '万人敌：受到伤害-15%，受到伤害时积攒怒气',
    baseAtk: 18, baseHp: 190, atkPerLv: 1.8, hpPerLv: 16, moveSpeed: 72, pickup: 40,
    weapon: 'snake', ult: 'roar', ultName: '据水断桥', ultDesc: '一声断喝，全屏敌人震退并眩晕4秒',
    unlockText: '七日签到第7天获得', unlockShards: 50, color: '#e43b44',
  },
  {
    id: 'zhuge', name: '诸葛亮', title: '卧龙诸葛孔明', quote: '略施小计，便叫你灰飞烟灭。', role: '远程法术',
    passive: '卧龙：技能冷却-10%',
    baseAtk: 20, baseHp: 95, atkPerLv: 2.0, hpPerLv: 8, moveSpeed: 76, pickup: 40,
    weapon: 'fan', ult: 'tornado', ultName: '借东风', ultDesc: '召来五道火焰龙卷，卷走并灼烧敌军',
    unlockText: '收集50个碎片解锁（宝箱、商店、活跃度）', unlockShards: 50, color: '#2ce8f5',
  },
  {
    id: 'lvbu', name: '吕布', title: '飞将吕奉先', quote: '人中吕布，马中赤兔！', role: '无双猛将',
    passive: '飞将：伤害+20%，移动速度+8%',
    baseAtk: 30, baseHp: 150, atkPerLv: 3, hpPerLv: 12, moveSpeed: 82, pickup: 40,
    weapon: 'halberd', ult: 'whirl', ultName: '天下无双', ultDesc: '5秒内无敌，方天画戟旋风横扫所到之处',
    unlockText: '收集100个碎片解锁（名将宝匣、商店）', unlockShards: 100, color: '#feae34',
  },
];

export const HERO_BY_ID: Record<string, HeroDef> = {};
HEROES.forEach((h) => (HERO_BY_ID[h.id] = h));

/** 升星所需碎片（1→2, 2→3, 3→4, 4→5） */
export const STAR_COST = [20, 40, 80, 120];
export const MAX_STAR = 5;
/** 每颗星（1 星以上）提升的基础攻击与生命比例 */
export const STAR_BONUS = 0.12;
