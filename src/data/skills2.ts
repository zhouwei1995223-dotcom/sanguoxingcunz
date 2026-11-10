import type { WeaponDef, WeaponLevel, WeaponLink, WeaponId, PassiveId } from './skills';

// 1.1.0 新武将的二十件专属兵器与四十条专属联动。
// 行为（突刺 / 横扫 / 环身 / 射击 / 投掷 / 落雷……）由 style.mode 决定，实现在 battle/weaponsEx.ts；
// 数值写法和老兵器一致（范围是缩放前的数，skills.ts 末尾统一乘 AREA_SCALE）。

export type ExMode = 'thrust' | 'sweep' | 'spin' | 'orbit' | 'shot' | 'lob' | 'slam' | 'chain' | 'pillar' | 'pulse' | 'bounce' | 'boomerang';

export interface ExStyle {
  mode: ExMode;
  /** 特效主色 / 进化后的颜色 */
  color: string;
  evoColor: string;
  /** 投射物 / 环身物的贴图（图集里的精灵名） */
  sprite?: string;
  /** shot：瞄准方式 */
  target?: 'near' | 'strong' | 'random';
  /** shot：命中后炸开的半径（世界像素）；sweep：横扫后放出的剑气数（进化后 ×3） */
  splash?: number;
  wave?: boolean;
  /** lob：落地留下的地面效果 */
  pool?: 'fire' | 'poison';
  /** pillar：落点特效 */
  fx?: 'pillar' | 'bagua';
  /** 每次出手命中敌人时回复最大生命的比例 */
  heal?: number;
  /** 进化后横扫点燃地面 */
  evoBurn?: boolean;
}

type Row = [dmg: number, cd: number, count: number, area: number, desc: string, extra?: Partial<WeaponLevel>];

function mk(id: string, hero: string, name: string, evoName: string, evoPassive: PassiveId, intro: string, style: ExStyle,
  common: Partial<WeaponLevel>, rows: Row[], evo: Row): WeaponDef {
  const lv = (r: Row): WeaponLevel => ({ ...common, dmg: r[0], cd: r[1], count: r[2], area: r[3], desc: r[4], ...(r[5] || {}) });
  return {
    id: id as WeaponId, name, icon: 'w_' + id, evoName, evoIcon: 'w_' + id + '_evo', evoPassive, hero, intro,
    levels: rows.map(lv), evo: lv(evo), style,
  };
}

export const HERO_WEAPONS_EXT: Record<string, WeaponDef> = {
  // —— 蜀 ——
  shuanggu: mk('shuanggu', 'liubei', '雌雄双股剑', '仁德无双', 'lingzhi', '双剑环身飞旋，斩击靠近的敌人',
    { mode: 'orbit', color: '#e8c15a', evoColor: '#fee761', sprite: 'fsword' }, { duration: 3.2, speed: 4.0, knock: 16 }, [
      [1.5, 2.8, 2, 34, '雌雄双剑环身飞旋'],
      [1.9, 2.8, 2, 36, '伤害提升'],
      [1.9, 2.5, 3, 38, '剑影+1，冷却缩短', { duration: 3.6 }],
      [2.3, 2.4, 3, 42, '伤害与环绕半径提升', { duration: 4 }],
      [2.6, 2.2, 4, 44, '剑影+1，持续更久', { duration: 4.6, speed: 4.4 }],
    ], [3.3, 0, 6, 50, '仁德无双：六道剑影常驻环身，永不停歇', { duration: 9999, speed: 5.0, knock: 22 }]),
  kuanggu: mk('kuanggu', 'weiyan', '狂骨大刀', '长驱直入', 'ration', '抡刀回旋连斩周身，命中时吸取生命',
    { mode: 'spin', color: '#c4513c', evoColor: '#ff7a3d', heal: 0.004 }, { knock: 60 }, [
      [2.0, 1.5, 1, 34, '抡刀回旋，斩击周身'],
      [2.4, 1.5, 1, 36, '伤害提升'],
      [2.4, 1.4, 2, 38, '连斩两刀'],
      [2.9, 1.3, 2, 42, '范围与伤害提升'],
      [3.3, 1.2, 2, 46, '伤害提升，冷却缩短'],
    ], [4.0, 0.95, 3, 56, '长驱直入：三连回旋斩，吸血加倍', { knock: 90 }]),
  // —— 魏 ——
  yitian: mk('yitian', 'caocao', '倚天剑', '挟天子令诸侯', 'tiger', '向前横斩并放出一道贯穿敌阵的剑气',
    { mode: 'sweep', color: '#7fa6ff', evoColor: '#fee761', wave: true, sprite: 'fsword' }, { arc: 1.2, knock: 70, pierce: 5, speed: 300 }, [
      [1.9, 1.5, 1, 42, '横斩并放出一道剑气'],
      [2.3, 1.5, 1, 44, '伤害提升'],
      [2.3, 1.4, 2, 46, '身后同时出剑'],
      [2.8, 1.3, 2, 52, '范围与伤害提升', { arc: 1.4, pierce: 7 }],
      [3.2, 1.2, 2, 56, '伤害提升，冷却缩短', { arc: 1.5, pierce: 8 }],
    ], [3.9, 1.0, 2, 66, '挟天子令诸侯：环身横斩，每斩三道剑气', { arc: Math.PI, knock: 100, pierce: 999, speed: 340 }]),
  qilin: mk('qilin', 'xiahoudun', '麒麟牙', '刚烈之刃', 'armor', '前后同时重劈，大力击退敌人',
    { mode: 'sweep', color: '#9fb3e0', evoColor: '#fee761' }, { arc: 1.1, knock: 110 }, [
      [2.4, 1.6, 2, 42, '前后重劈，击退敌人'],
      [3.0, 1.6, 2, 44, '伤害提升'],
      [3.0, 1.5, 2, 48, '劈砍范围扩大，短暂震晕', { arc: 1.3, stun: 0.2 }],
      [3.5, 1.4, 2, 54, '范围与伤害提升', { arc: 1.4, stun: 0.25 }],
      [4.0, 1.3, 2, 58, '伤害提升，冷却缩短', { arc: 1.5, stun: 0.3 }],
    ], [5.0, 1.05, 2, 68, '刚烈之刃：环身重劈，震晕一片', { arc: Math.PI, knock: 150, stun: 0.5 }]),
  goulian: mk('goulian', 'zhangliao', '黄龙钩镰刀', '逍遥破阵', 'horseshoe', '朝最近的敌人长距离破阵突刺，枪势又宽又远',
    { mode: 'thrust', color: '#8fc0ff', evoColor: '#fee761' }, { knock: 90 }, [
      [2.4, 1.3, 1, 88, '长距离破阵突刺'],
      [2.9, 1.3, 1, 94, '伤害与距离提升'],
      [2.9, 1.2, 2, 98, '两路突刺'],
      [3.5, 1.1, 2, 106, '伤害提升，冷却缩短'],
      [4.0, 1.0, 2, 112, '伤害与距离提升'],
    ], [5.0, 0.75, 3, 132, '逍遥破阵：三路破阵，贯穿全场', { knock: 130 }]),
  huchui: mk('huchui', 'xuchu', '虎头大锤', '虎痴震岳', 'whetstone', '抡锤砸向最近的敌人，震晕落点一片',
    { mode: 'slam', color: '#f0a850', evoColor: '#fee761' }, { knock: 100, stun: 0.3 }, [
      [3.4, 1.7, 1, 34, '重锤砸地，震晕敌人'],
      [4.1, 1.7, 1, 36, '伤害提升'],
      [4.1, 1.6, 2, 38, '连砸两锤'],
      [4.8, 1.5, 2, 42, '范围与伤害提升', { stun: 0.35 }],
      [5.4, 1.3, 2, 46, '伤害提升，冷却缩短', { stun: 0.4 }],
    ], [7.0, 1.0, 3, 56, '虎痴震岳：三锤连砸，地动山摇', { knock: 150, stun: 0.6 }]),
  langgu: mk('langgu', 'simayi', '狼顾雷符', '天命雷殛', 'book', '紫雷劈向敌人并在敌群中连锁',
    { mode: 'chain', color: '#c79bff', evoColor: '#fee761' }, { pierce: 3 }, [
      [3.6, 1.9, 1, 70, '紫雷连锁3名敌人'],
      [4.4, 1.9, 1, 74, '伤害提升，连锁+1', { pierce: 4 }],
      [4.4, 1.7, 2, 76, '紫雷+1', { pierce: 4 }],
      [5.2, 1.6, 2, 80, '伤害提升，短暂麻痹', { pierce: 5, stun: 0.2 }],
      [6.0, 1.5, 3, 84, '紫雷+1', { pierce: 5, stun: 0.25 }],
    ], [9.5, 0.95, 5, 96, '天命雷殛：五道紫雷，连锁十人并麻痹', { pierce: 10, stun: 0.45 }]),
  shenbi: mk('shenbi', 'xiahouyuan', '神臂弓', '神速连珠', 'wine', '朝最近的敌人连续速射',
    { mode: 'shot', color: '#7fe0cc', evoColor: '#fee761', sprite: 'bolt', target: 'near' }, { pierce: 2, speed: 320, knock: 14 }, [
      [1.3, 0.62, 1, 0, '速射最近的敌人'],
      [1.6, 0.62, 1, 0, '伤害提升'],
      [1.6, 0.56, 2, 0, '箭矢+1'],
      [1.9, 0.5, 2, 0, '伤害提升，射速加快', { pierce: 3 }],
      [2.1, 0.44, 3, 0, '箭矢+1', { pierce: 3, speed: 340 }],
    ], [2.6, 0.3, 5, 0, '神速连珠：五矢扇射，箭无虚发', { pierce: 5, speed: 380, knock: 20 }]),
  luoshui: mk('luoshui', 'zhenji', '洛水凌波', '洛神凝霜', 'flag', '周身荡开一圈水波，伤害并减速敌人',
    { mode: 'pulse', color: '#8fd3ff', evoColor: '#d8f4ff' }, { slow: 0.4, duration: 1.5, knock: 20 }, [
      [1.5, 2.0, 1, 46, '水波荡开，减速敌人'],
      [1.9, 2.0, 1, 50, '伤害与范围提升'],
      [1.9, 1.8, 1, 54, '冷却缩短，减速加强', { slow: 0.45 }],
      [2.3, 1.6, 1, 60, '伤害与范围提升', { slow: 0.5, duration: 2 }],
      [2.6, 1.5, 1, 64, '全面强化', { slow: 0.5, duration: 2 }],
    ], [3.4, 1.1, 2, 76, '洛神凝霜：双重水波，冻结敌军', { slow: 0.6, duration: 2.2, stun: 0.6, knock: 30 }]),
  // —— 吴 ——
  bawang: mk('bawang', 'sunce', '霸王枪', '江东猛虎', 'horn', '朝敌人方向扇形连刺，击飞敌人',
    { mode: 'thrust', color: '#ff8a70', evoColor: '#fee761' }, { knock: 80 }, [
      [1.8, 1.2, 1, 66, '向敌人突刺'],
      [2.2, 1.2, 1, 70, '伤害与距离提升'],
      [2.2, 1.1, 2, 74, '双枪连刺'],
      [2.7, 1.0, 3, 80, '三路扇形突刺'],
      [3.0, 0.95, 3, 88, '伤害与距离提升'],
    ], [3.8, 0.7, 5, 108, '江东猛虎：五路枪影，势如破竹', { knock: 120 }]),
  chibi: mk('chibi', 'zhouyu', '赤壁火矢', '东风烈焰', 'pouch', '火矢抛向敌群，落地爆燃并留下火海',
    { mode: 'lob', color: '#ff7a3d', evoColor: '#fee761', pool: 'fire' }, { duration: 3, tick: 0.33 }, [
      [0.42, 2.8, 2, 20, '两支火矢，落地成火海'],
      [0.5, 2.8, 2, 22, '火海伤害与范围提升'],
      [0.5, 2.5, 3, 24, '火矢+1'],
      [0.58, 2.3, 3, 26, '伤害提升，燃烧更久', { duration: 3.6 }],
      [0.64, 2.2, 4, 28, '火矢+1', { duration: 4, tick: 0.3 }],
    ], [0.82, 1.8, 6, 34, '东风烈焰：六处烈焰连成一片，敌军减速', { duration: 5, tick: 0.28, slow: 0.35 }]),
  jinfan: mk('jinfan', 'ganning', '锦帆飞铃', '铃声夺魄', 'wine', '掷出系着铃铛的飞刃，在敌人之间来回弹射',
    { mode: 'bounce', color: '#f0c040', evoColor: '#fff0a0' }, { pierce: 4, knock: 20 }, [
      [1.4, 1.3, 1, 62, '飞铃弹射4名敌人'],
      [1.7, 1.3, 1, 66, '伤害提升，弹射+1', { pierce: 5 }],
      [1.7, 1.2, 2, 68, '飞铃+1', { pierce: 5 }],
      [2.1, 1.1, 2, 72, '伤害提升，弹射+1', { pierce: 6 }],
      [2.4, 1.0, 3, 76, '飞铃+1', { pierce: 7 }],
    ], [3.1, 0.7, 4, 92, '铃声夺魄：四铃齐飞，弹射十名敌人', { pierce: 10, knock: 30 }]),
  shenting: mk('shenting', 'taishici', '神亭弓', '裂石穿云', 'whetstone', '重箭射向血最多的敌人，命中后炸开一片',
    { mode: 'shot', color: '#f0b070', evoColor: '#fee761', sprite: 'bolt', target: 'strong', splash: 20 }, { pierce: 1, speed: 340, knock: 40 }, [
      [2.6, 1.5, 1, 0, '爆裂重箭射向最强的敌人'],
      [3.1, 1.5, 1, 0, '伤害提升'],
      [3.1, 1.4, 2, 0, '重箭+1'],
      [3.7, 1.3, 2, 0, '伤害与爆裂范围提升'],
      [4.2, 1.2, 3, 0, '重箭+1'],
    ], [5.6, 0.9, 4, 0, '裂石穿云：四支裂石箭，炸开更大一片', { speed: 400, knock: 60 }]),
  lianying: mk('lianying', 'luxun', '连营火符', '夷陵烈焰', 'flag', '火球环身飞旋，灼烧靠近的敌人',
    { mode: 'orbit', color: '#ff9a4d', evoColor: '#fee761', sprite: 'flame1' }, { duration: 3.2, speed: 3.4, knock: 8 }, [
      [1.0, 2.8, 2, 36, '两团火球环身飞旋'],
      [1.2, 2.8, 3, 38, '火球+1'],
      [1.4, 2.6, 3, 42, '伤害与半径提升', { duration: 3.6 }],
      [1.4, 2.4, 4, 44, '火球+1，持续更久', { duration: 4.2 }],
      [1.7, 2.2, 5, 48, '火球+1，伤害提升', { duration: 4.6, speed: 3.8 }],
    ], [2.2, 0, 7, 56, '夷陵烈焰：七团烈火常驻环身', { duration: 9999, speed: 4.4, knock: 12 }]),
  zheshan: mk('zheshan', 'xiaoqiao', '流云折扇', '花月回风', 'bowl', '掷出折扇再飞回手中，去程回程都造成伤害',
    { mode: 'boomerang', color: '#f7a8c8', evoColor: '#fff0f6', sprite: 'icon_w_zheshan' }, { speed: 210, knock: 15 }, [
      [1.4, 1.5, 2, 90, '掷出两把回旋折扇'],
      [1.7, 1.5, 2, 94, '伤害提升'],
      [1.7, 1.4, 3, 98, '折扇+1'],
      [2.0, 1.3, 3, 104, '伤害与射程提升', { speed: 230 }],
      [2.2, 1.2, 4, 108, '折扇+1'],
    ], [2.8, 0.9, 8, 124, '花月回风：八扇齐飞，往复不休', { speed: 260, knock: 22 }]),
  // —— 群 ——
  caidai: mk('caidai', 'diaochan', '闭月彩带', '倾城之舞', 'book', '彩带在敌人之间穿梭，命中的敌人被迷住而迟缓',
    { mode: 'bounce', color: '#f58ac0', evoColor: '#ffd0e8' }, { pierce: 5, knock: 10, slow: 0.3, duration: 1.5 }, [
      [1.2, 1.4, 1, 66, '彩带穿梭5名敌人并减速'],
      [1.5, 1.4, 1, 70, '伤害提升，穿梭+1', { pierce: 6 }],
      [1.5, 1.3, 2, 72, '彩带+1', { pierce: 6 }],
      [1.8, 1.2, 2, 76, '伤害提升，减速加强', { pierce: 7, slow: 0.4 }],
      [2.0, 1.1, 2, 80, '穿梭+1，冷却缩短', { pierce: 8, slow: 0.4 }],
    ], [2.7, 0.8, 3, 96, '倾城之舞：三带齐舞，穿梭十二人并令其失神', { pierce: 12, slow: 0.55, duration: 2, stun: 0.3 }]),
  xiliang: mk('xiliang', 'dongzhuo', '西凉重刀', '暴虐横行', 'lingzhi', '势大力沉的大范围横劈，击飞敌人',
    { mode: 'sweep', color: '#d07050', evoColor: '#ff9a4d', evoBurn: true }, { arc: 1.4, knock: 120 }, [
      [3.1, 1.9, 1, 50, '大范围重劈，击飞敌人'],
      [3.6, 1.9, 1, 52, '伤害提升'],
      [3.6, 1.8, 1, 56, '横劈范围扩大', { arc: 1.6 }],
      [4.3, 1.6, 1, 60, '伤害提升，冷却缩短', { arc: 1.7 }],
      [4.8, 1.5, 1, 64, '范围与伤害提升', { arc: 1.8 }],
    ], [6.2, 1.2, 2, 74, '暴虐横行：环身重劈，劈过之处燃起烈火', { arc: Math.PI, knock: 160 }]),
  taiping: mk('taiping', 'zhangjiao', '太平雷符', '黄天雷法', 'seal', '雷符落向敌群，炸开一片金光',
    { mode: 'pillar', color: '#f2d24a', evoColor: '#fff6b0', fx: 'pillar' }, { knock: 40 }, [
      [2.4, 2.0, 2, 22, '两道雷符落向敌群'],
      [2.9, 2.0, 2, 24, '伤害与范围提升'],
      [2.9, 1.8, 3, 24, '雷符+1'],
      [3.4, 1.7, 3, 26, '伤害提升，冷却缩短'],
      [3.8, 1.6, 4, 28, '雷符+1'],
    ], [4.9, 1.2, 6, 34, '黄天雷法：六符连落，中者麻痹', { knock: 60, stun: 0.3 }]),
  qingnang: mk('qingnang', 'huatuo', '青囊药囊', '回春妙手', 'lingzhi', '药囊抛向敌群，药雾持续灼伤并迟滞敌人；每次出手为自己回复生命',
    { mode: 'lob', color: '#6fcf8a', evoColor: '#b8ffcc', pool: 'poison', heal: 0.005 }, { duration: 3.5, tick: 0.35, slow: 0.25 }, [
      [0.36, 2.6, 1, 22, '药雾灼伤并迟滞敌人'],
      [0.44, 2.6, 1, 24, '药雾伤害与范围提升'],
      [0.44, 2.4, 2, 26, '药囊+1'],
      [0.52, 2.3, 2, 28, '伤害提升，迟滞加强', { slow: 0.35, duration: 4 }],
      [0.58, 2.2, 3, 30, '药囊+1', { slow: 0.35, duration: 4.2 }],
    ], [0.74, 1.8, 4, 36, '回春妙手：四处药雾，回复翻倍', { slow: 0.5, duration: 5, tick: 0.3 }]),
  dunjia: mk('dunjia', 'zuoci', '遁甲天书', '八门金锁', 'map', '在敌群脚下布下八卦阵，引爆并震晕敌人',
    { mode: 'pillar', color: '#7ad0c0', evoColor: '#d0fff4', fx: 'bagua' }, { knock: 60, stun: 0.4 }, [
      [3.0, 2.4, 1, 34, '八卦阵引爆，震晕敌人'],
      [3.6, 2.4, 1, 36, '伤害提升'],
      [3.6, 2.2, 2, 38, '八卦阵+1'],
      [4.2, 2.0, 2, 42, '范围与伤害提升', { stun: 0.5 }],
      [4.7, 1.9, 2, 46, '伤害提升，冷却缩短', { stun: 0.5 }],
    ], [6.1, 1.5, 3, 56, '八门金锁：三阵齐开，敌军久久不能动弹', { knock: 90, stun: 0.75 }]),
};

/** 四十条专属联动：每位新武将两条，写在通用兵器上（覆盖进化形态的数值） */
export const HERO_LINKS_EXT: Partial<Record<WeaponId, WeaponLink[]>> = {
  sword: [
    { hero: 'liubei', name: '仁者之剑', desc: '刘备专属：八剑护身，范围更大，伤害大增', evo: { count: 8, dmg: 3.6, area: 56 } },
    { hero: 'caocao', name: '青釭倚天', desc: '曹操专属：双剑合璧，七剑环身，转得更快', evo: { count: 7, dmg: 3.9, speed: 6.2 } },
    { hero: 'sunce', name: '古锭刀', desc: '孙策专属：六柄古锭刀环身，伤害大增、击退更强', evo: { count: 6, dmg: 4.4, knock: 40 } },
    { hero: 'zuoci', name: '飞剑幻术', desc: '左慈专属：十柄幻剑环身，范围更大', evo: { count: 10, dmg: 2.9, area: 60 } },
  ],
  horse: [
    { hero: 'liubei', name: '的卢飞跃', desc: '刘备专属：十骑白耳精兵冲阵，冷却更短', evo: { count: 10, dmg: 3.0, cd: 2.5 } },
    { hero: 'caocao', name: '虎豹骑', desc: '曹操专属：十二骑虎豹骑纵横冲阵，伤害大增', evo: { count: 12, dmg: 3.3, cd: 2.6 } },
    { hero: 'zhangliao', name: '八百破十万', desc: '张辽专属：十骑死士突阵，冲得更快更狠', evo: { count: 10, dmg: 3.8, cd: 2.4, speed: 340 } },
    { hero: 'xiahouyuan', name: '三日五百', desc: '夏侯渊专属：轻骑奔袭，冷却大幅缩短', evo: { count: 8, dmg: 3.0, cd: 1.9, speed: 360 } },
    { hero: 'dongzhuo', name: '飞熊军', desc: '董卓专属：十骑西凉飞熊军，撞得更重', evo: { count: 10, dmg: 3.7, knock: 180 } },
  ],
  drum: [
    { hero: 'xuchu', name: '裸衣斗马超', desc: '许褚专属：鼓声化作怒吼，范围大增并长时间眩晕', evo: { dmg: 8.5, area: 108, stun: 1.3, knock: 220 } },
    { hero: 'sunce', name: '一喝惊樊能', desc: '孙策专属：一声断喝，震晕并重创周围敌军', evo: { dmg: 8.8, area: 100, stun: 1.2 } },
    { hero: 'zhangjiao', name: '撒豆成兵', desc: '张角专属：鼓声更密，每通鼓都震出金光', evo: { dmg: 7.6, cd: 1.3, area: 96 } },
  ],
  rock: [
    { hero: 'xuchu', name: '飞石退敌', desc: '许褚专属：十二块巨石齐落，砸晕敌军', evo: { count: 12, dmg: 5.0, stun: 0.9 } },
    { hero: 'xiahoudun', name: '博望滚石', desc: '夏侯惇专属：十石连落，冷却更短', evo: { count: 10, dmg: 5.2, cd: 1.3 } },
  ],
  crossbow: [
    { hero: 'xiahouyuan', name: '百步穿柳', desc: '夏侯渊专属：五矢扇射，穿透六人', evo: { count: 5, pierce: 6, cd: 0.3, dmg: 1.7 } },
    { hero: 'taishici', name: '辕门神射', desc: '太史慈专属：四矢齐发，穿透八人，箭速更快', evo: { count: 4, pierce: 8, cd: 0.34, dmg: 2.0, speed: 400 } },
    { hero: 'ganning', name: '锦帆乱射', desc: '甘宁专属：三矢连发，射速极快', evo: { count: 3, pierce: 5, cd: 0.22, dmg: 1.6 } },
  ],
  fire: [
    { hero: 'zhouyu', name: '火烧赤壁', desc: '周瑜专属：八处火海连成一片，燃烧更久', evo: { count: 8, area: 34, duration: 5.5, slow: 0.5, dmg: 0.56 } },
    { hero: 'luxun', name: '火烧连营', desc: '陆逊专属：九处火海同时燃起，冷却更短', evo: { count: 9, dmg: 0.52, cd: 1.9 } },
    { hero: 'dongzhuo', name: '火烧洛阳', desc: '董卓专属：火海范围更大，伤害更高', evo: { count: 6, area: 38, dmg: 0.6 } },
  ],
  catapult: [
    { hero: 'zhouyu', name: '楼船投石', desc: '周瑜专属：五石齐发，范围更大', evo: { count: 5, area: 62, dmg: 9.5 } },
    { hero: 'simayi', name: '襄平攻城', desc: '司马懿专属：六石连发，冷却更短', evo: { count: 6, area: 58, dmg: 10, cd: 2.6 } },
  ],
  caltrop: [
    { hero: 'zhangliao', name: '逍遥伏兵', desc: '张辽专属：铁蒺藜范围更大、伤害更高', evo: { dmg: 0.75, area: 38, slow: 0.7 } },
    { hero: 'luxun', name: '石亭设伏', desc: '陆逊专属：蒺藜阵伤害大增，敌军几乎寸步难行', evo: { dmg: 0.82, area: 36, slow: 0.75 } },
    { hero: 'huatuo', name: '麻沸散', desc: '华佗专属：药粉遍地，范围更大，敌军昏昏沉沉', evo: { dmg: 0.7, area: 40, slow: 0.8 } },
  ],
  knife: [
    { hero: 'ganning', name: '短戟飞掷', desc: '甘宁专属：十二把飞刃往复不休，飞得更快', evo: { count: 12, dmg: 1.8, speed: 290 } },
    { hero: 'xiaoqiao', name: '落英缤纷', desc: '小乔专属：十把花刃往复飞舞，伤害更高', evo: { count: 10, dmg: 2.0, speed: 270 } },
    { hero: 'diaochan', name: '连环计', desc: '貂蝉专属：十把飞刃连环往复，冷却更短', evo: { count: 10, dmg: 1.8, cd: 0.85 } },
  ],
  aura: [
    { hero: 'weiyan', name: '反骨', desc: '魏延专属：罡风范围与伤害大增，震退贴身的敌人', evo: { dmg: 1.8, area: 64, knock: 30 } },
    { hero: 'xiahoudun', name: '啖睛之怒', desc: '夏侯惇专属：罡风伤害大增，范围更大', evo: { dmg: 1.9, area: 62, knock: 26 } },
    { hero: 'xiaoqiao', name: '天香护体', desc: '小乔专属：花香环身，范围更大并大幅迟滞敌人', evo: { dmg: 1.5, area: 68, slow: 0.5 } },
    { hero: 'huatuo', name: '五禽戏', desc: '华佗专属：罡风范围更大、伤害更高', evo: { dmg: 1.7, area: 66 } },
  ],
  thunder: [
    { hero: 'simayi', name: '高平陵', desc: '司马懿专属：六道天雷，连锁十八人并长时间麻痹', evo: { count: 6, pierce: 18, stun: 0.6, dmg: 12 } },
    { hero: 'zhenji', name: '惊鸿雷', desc: '甄姬专属：五道天雷，连锁十六人，麻痹更久', evo: { count: 5, pierce: 16, stun: 0.7, dmg: 11.5 } },
    { hero: 'zhangjiao', name: '五雷正法', desc: '张角专属：七道天雷齐落，伤害大增', evo: { count: 7, pierce: 14, dmg: 12.5 } },
    { hero: 'zuoci', name: '掌心雷', desc: '左慈专属：五道天雷，冷却大幅缩短', evo: { count: 5, pierce: 14, dmg: 11, cd: 0.85 } },
  ],
  hook: [
    { hero: 'weiyan', name: '子午飞索', desc: '魏延专属：六索齐出，牵引更狠、减速更久', evo: { count: 6, dmg: 6.2, slow: 0.6, duration: 2.6 } },
    { hero: 'zhenji', name: '洛水缚龙', desc: '甄姬专属：五索齐出，被缚的敌人久久不得动弹', evo: { count: 5, dmg: 5.6, slow: 0.7, duration: 3 } },
    { hero: 'diaochan', name: '离间', desc: '貂蝉专属：六条彩索齐出，减速更强更久', evo: { count: 6, dmg: 5.4, slow: 0.7, duration: 2.8 } },
  ],
  warshield: [
    { hero: 'taishici', name: '神亭鏖战', desc: '太史慈专属：盾击伤害大增，每击可挡六枚飞弹', evo: { dmg: 6.6, count: 6, knock: 170 } },
  ],
};
