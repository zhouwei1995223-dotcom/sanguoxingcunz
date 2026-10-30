import type { WeaponId } from './skills';
import type { HeroId } from '../gfx/art/heroes';

// 武将：基础属性、专属武器、大招、天赋、获取方式

export type { HeroId };
export type UltKind = 'dragon' | 'crescent' | 'roar' | 'tornado' | 'whirl' | 'arrowrain' | 'cavalry' | 'arrowstorm' | 'frenzy' | 'starfall';

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
    passive: '万人敌：受到伤害-15%，受到伤害时积攒怒气，对敌将伤害+30%',
    baseAtk: 18, baseHp: 190, atkPerLv: 1.8, hpPerLv: 16, moveSpeed: 72, pickup: 40,
    weapon: 'snake', ult: 'roar', ultName: '据水断桥', ultDesc: '一声断喝，全屏敌人震退并眩晕4秒；重创敌将并震碎护盾',
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
  // 1.0.3 新增
  {
    id: 'huangzhong', name: '黄忠', title: '老将黄汉升', quote: '老夫虽老，尚能开三石之弓！', role: '远程狙击',
    passive: '老当益壮：暴击率+10%，对敌将伤害+20%',
    baseAtk: 24, baseHp: 110, atkPerLv: 2.4, hpPerLv: 9, moveSpeed: 74, pickup: 40,
    weapon: 'bow', ult: 'arrowrain', ultName: '定军斩将', ultDesc: '四轮箭雨覆盖全屏，再一支神箭重创最强的敌人',
    unlockText: '通关第4章获得', unlockShards: 50, color: '#d9a066',
  },
  {
    id: 'machao', name: '马超', title: '锦马超孟起', quote: '西凉马孟起在此！', role: '突进骑将',
    passive: '神威天将军：移动速度+10%，移动时伤害+15%',
    baseAtk: 23, baseHp: 135, atkPerLv: 2.3, hpPerLv: 11, moveSpeed: 84, pickup: 40,
    weapon: 'lance', ult: 'cavalry', ultName: '西凉铁骑', ultDesc: '召来八路西凉铁骑往返冲阵，踏平全屏敌军',
    unlockText: '收集80个碎片解锁（名将宝匣、商店）', unlockShards: 80, color: '#e8e8f0',
  },
  {
    id: 'sunshangxiang', name: '孙尚香', title: '弓腰姬孙尚香', quote: '本小姐的箭，可不长眼睛！', role: '灵动射手',
    passive: '枭姬：技能冷却-8%，拾取范围+30%',
    baseAtk: 21, baseHp: 105, atkPerLv: 2.1, hpPerLv: 9, moveSpeed: 80, pickup: 40,
    weapon: 'chakram', ult: 'arrowstorm', ultName: '弓腰姬', ultDesc: '2.5秒内向四面八方连珠齐射，期间无敌',
    unlockText: '收集50个碎片解锁（宝箱、商店、活跃度）', unlockShards: 50, color: '#f5a3c7',
  },
  {
    id: 'dianwei', name: '典韦', title: '古之恶来典韦', quote: '主公快走，典韦在此！', role: '狂战坦克',
    passive: '古之恶来：生命上限+20%，生命低于50%时伤害+25%',
    baseAtk: 22, baseHp: 200, atkPerLv: 2.2, hpPerLv: 17, moveSpeed: 70, pickup: 40,
    weapon: 'ji', ult: 'frenzy', ultName: '恶来护主', ultDesc: '回复30%生命，6秒内无敌、伤害+60%、技能冷却减半',
    unlockText: '收集50个碎片解锁（宝箱、商店、活跃度）', unlockShards: 50, color: '#a05b3a',
  },
  {
    id: 'jiangwei', name: '姜维', title: '麒麟儿姜伯约', quote: '丞相之志，维必继之！', role: '智勇双全',
    passive: '麒麟儿：经验获取+15%，技能范围+10%',
    baseAtk: 22, baseHp: 120, atkPerLv: 2.2, hpPerLv: 10, moveSpeed: 77, pickup: 40,
    weapon: 'meteor', ult: 'starfall', ultName: '星落五丈原', ultDesc: '3秒内群星连坠，砸向全屏敌军',
    unlockText: '通关第6章获得', unlockShards: 50, color: '#8fb8ff',
  },
];

export const HERO_BY_ID: Record<string, HeroDef> = {};
HEROES.forEach((h) => (HERO_BY_ID[h.id] = h));

/** 升星所需碎片（1→2, 2→3, 3→4, 4→5） */
export const STAR_COST = [20, 40, 80, 120];
export const MAX_STAR = 5;
/** 每颗星（1 星以上）提升的基础攻击与生命比例 */
export const STAR_BONUS = 0.12;
