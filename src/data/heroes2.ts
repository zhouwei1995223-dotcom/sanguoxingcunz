import type { HeroDef } from './heroes';

// 1.1.0 新增的二十位武将（魏七、吴六、群五、蜀二），加上原来的十位共三十位。
// 天赋写成数据（traits），在 battle.ts 的 recalc / damage 里统一结算；
// 专属兵器的行为在 battle/weaponsEx.ts，大招在 battle/ultsEx.ts。

const shards = (n: number) => `收集${n}个碎片解锁（名将宝匣、商店、活跃度）`;

export const HEROES_EXT: HeroDef[] = [
  // —— 蜀 ——
  {
    id: 'liubei', name: '刘备', title: '汉昭烈帝刘玄德', quote: '惟贤惟德，能服于人。', role: '仁德统帅', camp: 'shu',
    passive: '仁德：生命+15%，每秒回复0.6%生命，经验获取+10%',
    traits: { hp: 1.15, regenPct: 0.006, exp: 1.1 },
    baseAtk: 23, baseHp: 150, atkPerLv: 2.3, hpPerLv: 13, moveSpeed: 76, pickup: 44,
    weapon: 'shuanggu', ult: 'oath', ultName: '桃园结义', ultDesc: '关张英魂助阵：青龙刀气与断喝连环震荡全屏，并回复30%生命',
    unlockText: shards(80), unlockShards: 80, color: '#e8c15a',
  },
  {
    id: 'weiyan', name: '魏延', title: '镇北将军魏文长', quote: '谁敢杀我！', role: '狂刀吸血', camp: 'shu',
    passive: '狂骨：伤害+8%，击败敌人回复生命（每秒至多2%）',
    traits: { dmg: 8, killHeal: 0.004 },
    baseAtk: 23, baseHp: 140, atkPerLv: 2.3, hpPerLv: 12, moveSpeed: 78, pickup: 40,
    weapon: 'kuanggu', ult: 'bladestorm', ultName: '子午奇袭', ultDesc: '4秒内化作刀轮风暴，所过之处连续斩击并吸取生命',
    unlockText: shards(50), unlockShards: 50, color: '#c4513c',
  },
  // —— 魏 ——
  {
    id: 'caocao', name: '曹操', title: '魏武帝曹孟德', quote: '宁教我负天下人，休教天下人负我！', role: '霸业枭雄', camp: 'wei',
    passive: '奸雄：伤害+12%，怒气获取+20%，击败敌人回复生命（每秒至多1.5%）',
    traits: { dmg: 12, rage: 1.2, killHeal: 0.003 },
    baseAtk: 27, baseHp: 150, atkPerLv: 2.7, hpPerLv: 12, moveSpeed: 77, pickup: 40,
    weapon: 'yitian', ult: 'warlord', ultName: '魏武挥鞭', ultDesc: '虎豹骑自四面八方轮番冲阵，8秒内自身伤害+40%',
    unlockText: shards(100), unlockShards: 100, color: '#5b7fd6',
  },
  {
    id: 'xiahoudun', name: '夏侯惇', title: '独目苍狼夏侯元让', quote: '夏侯元让在此，谁敢放肆！', role: '反击坦克', camp: 'wei',
    passive: '刚烈：受到伤害-12%，受击时震伤周围敌人（3倍攻击，1秒一次）',
    traits: { taken: 0.88, thorns: 3 },
    baseAtk: 21, baseHp: 185, atkPerLv: 2.1, hpPerLv: 16, moveSpeed: 72, pickup: 40,
    weapon: 'qilin', ult: 'guard', ultName: '刚烈无双', ultDesc: '两道刀环震晕全屏敌军，6秒内受到伤害-60%并持续反震',
    unlockText: shards(50), unlockShards: 50, color: '#7d8fb8',
  },
  {
    id: 'zhangliao', name: '张辽', title: '威震逍遥津张文远', quote: '张文远在此，江东鼠辈休走！', role: '突袭先锋', camp: 'wei',
    passive: '突袭：移动速度+8%，对满血敌人伤害+35%',
    traits: { speed: 0.08, fullHpDmg: 1.35 },
    baseAtk: 25, baseHp: 135, atkPerLv: 2.5, hpPerLv: 11, moveSpeed: 82, pickup: 40,
    weapon: 'goulian', ult: 'blitz', ultName: '威震逍遥津', ultDesc: '连续十次闪击场上最强的敌人，每击横扫一片',
    unlockText: shards(80), unlockShards: 80, color: '#6ea3e0',
  },
  {
    id: 'xuchu', name: '许褚', title: '虎痴许仲康', quote: '谁来与我大战三百回合！', role: '重锤猛士', camp: 'wei',
    passive: '虎痴：生命+15%，对精英与敌将伤害+25%',
    traits: { hp: 1.15, eliteDmg: 0.25 },
    baseAtk: 23, baseHp: 190, atkPerLv: 2.3, hpPerLv: 16, moveSpeed: 70, pickup: 40,
    weapon: 'huchui', ult: 'berserk', ultName: '裸衣死战', ultDesc: '7秒内无敌、伤害+70%、技能冷却减半，击败敌人回复生命',
    unlockText: shards(50), unlockShards: 50, color: '#d98a3d',
  },
  {
    id: 'simayi', name: '司马懿', title: '冢虎司马仲达', quote: '天命？哈哈哈，天命在我！', role: '雷法谋主', camp: 'wei',
    passive: '鹰视狼顾：技能冷却-10%，对被控制的敌人伤害+30%',
    traits: { cd: 0.9, ctrlDmg: 1.3 },
    baseAtk: 26, baseHp: 105, atkPerLv: 2.6, hpPerLv: 9, moveSpeed: 76, pickup: 40,
    weapon: 'langgu', ult: 'execute', ultName: '鹰视狼顾', ultDesc: '全屏敌军麻痹3秒，八道紫雷依次劈向最强的敌人',
    unlockText: shards(100), unlockShards: 100, color: '#9a6ad6',
  },
  {
    id: 'xiahouyuan', name: '夏侯渊', title: '神速将军夏侯妙才', quote: '兵贵神速，随我奔袭！', role: '疾射游击', camp: 'wei',
    passive: '神速：移动速度+12%，技能冷却-6%',
    traits: { speed: 0.12, cd: 0.94 },
    baseAtk: 21, baseHp: 112, atkPerLv: 2.1, hpPerLv: 9, moveSpeed: 82, pickup: 40,
    weapon: 'shenbi', ult: 'raid', ultName: '千里奔袭', ultDesc: '3秒内朝敌群连珠疾射，箭箭贯穿，期间无敌',
    unlockText: shards(50), unlockShards: 50, color: '#58b7a8',
  },
  {
    id: 'zhenji', name: '甄姬', title: '洛神甄宓', quote: '翩若惊鸿，婉若游龙。', role: '寒冰控场', camp: 'wei',
    passive: '洛神：技能范围+12%，对被控制的敌人伤害+15%',
    traits: { area: 0.12, ctrlDmg: 1.15 },
    baseAtk: 23, baseHp: 102, atkPerLv: 2.3, hpPerLv: 9, moveSpeed: 77, pickup: 44,
    weapon: 'luoshui', ult: 'frost', ultName: '洛神赋', ultDesc: '洛水漫卷：全屏敌军冰封3.5秒，冰棱连番坠落',
    unlockText: shards(80), unlockShards: 80, color: '#8fd3ff',
  },
  // —— 吴 ——
  {
    id: 'sunce', name: '孙策', title: '小霸王孙伯符', quote: '江东子弟，随我冲！', role: '霸王强攻', camp: 'wu',
    passive: '霸王：伤害+10%，怒气获取+25%',
    traits: { dmg: 10, rage: 1.25 },
    baseAtk: 25, baseHp: 140, atkPerLv: 2.5, hpPerLv: 12, moveSpeed: 80, pickup: 40,
    weapon: 'bawang', ult: 'quake', ultName: '霸王举鼎', ultDesc: '三记重击一记比一记更远，震晕并重创全屏敌军',
    unlockText: shards(80), unlockShards: 80, color: '#e8553f',
  },
  {
    id: 'zhouyu', name: '周瑜', title: '美周郎周公瑾', quote: '谈笑间，樯橹灰飞烟灭。', role: '火攻统帅', camp: 'wu',
    passive: '英姿：伤害+10%，技能持续时间+20%',
    traits: { dmg: 10, dur: 0.2 },
    baseAtk: 26, baseHp: 110, atkPerLv: 2.6, hpPerLv: 9, moveSpeed: 77, pickup: 40,
    weapon: 'chibi', ult: 'firewall', ultName: '火烧赤壁', ultDesc: '东风骤起，一道火墙横扫整个战场，所过之处尽成火海',
    unlockText: shards(100), unlockShards: 100, color: '#ff7a3d',
  },
  {
    id: 'ganning', name: '甘宁', title: '锦帆游侠甘兴霸', quote: '铃铛响处，便是甘兴霸！', role: '飞刃游侠', camp: 'wu',
    passive: '锦帆：暴击率+8%，移动速度+6%',
    traits: { crit: 0.08, speed: 0.06 },
    baseAtk: 22, baseHp: 120, atkPerLv: 2.2, hpPerLv: 10, moveSpeed: 82, pickup: 40,
    weapon: 'jinfan', ult: 'bells', ultName: '百骑劫营', ultDesc: '三轮飞刃向四面八方掷出再飞回，往返都重创敌军',
    unlockText: shards(50), unlockShards: 50, color: '#f0c040',
  },
  {
    id: 'taishici', name: '太史慈', title: '神射太史子义', quote: '大丈夫生于乱世，当带三尺剑立不世之功！', role: '爆裂神射', camp: 'wu',
    passive: '神射：暴击伤害+35%，对敌将伤害+15%',
    traits: { critDmg: 0.35, bossDmg: 1.15 },
    baseAtk: 23, baseHp: 115, atkPerLv: 2.3, hpPerLv: 10, moveSpeed: 78, pickup: 40,
    weapon: 'shenting', ult: 'snipe', ultName: '神亭酣战', ultDesc: '六支裂地巨箭逐一射向最强的敌人，命中后炸开',
    unlockText: shards(50), unlockShards: 50, color: '#d9a066',
  },
  {
    id: 'luxun', name: '陆逊', title: '儒将陆伯言', quote: '夷陵之火，足以燎原。', role: '连营火攻', camp: 'wu',
    passive: '儒将：技能冷却-8%，技能范围+8%，经验获取+8%',
    traits: { cd: 0.92, area: 0.08, exp: 1.08 },
    baseAtk: 23, baseHp: 108, atkPerLv: 2.3, hpPerLv: 9, moveSpeed: 77, pickup: 40,
    weapon: 'lianying', ult: 'wildfire', ultName: '火烧连营', ultDesc: '3秒内烈火连番坠向敌群，落地留下七百里火海',
    unlockText: shards(80), unlockShards: 80, color: '#ff9a4d',
  },
  {
    id: 'xiaoqiao', name: '小乔', title: '国色小乔', quote: '花开堪折直须折。', role: '灵巧辅助', camp: 'wu',
    passive: '天香：拾取范围+35%，每秒回复0.4%生命，移动速度+5%',
    traits: { pickup: 1.35, regenPct: 0.004, speed: 0.05 },
    baseAtk: 21, baseHp: 100, atkPerLv: 2.1, hpPerLv: 9, moveSpeed: 80, pickup: 44,
    weapon: 'zheshan', ult: 'petal', ultName: '流风回雪', ultDesc: '回复25%生命，花雨环身6秒，持续伤害并迟滞靠近的敌人',
    unlockText: shards(50), unlockShards: 50, color: '#f7a8c8',
  },
  // —— 群 ——
  {
    id: 'diaochan', name: '貂蝉', title: '闭月貂蝉', quote: '乱世浮萍，亦可倾城。', role: '魅惑控场', camp: 'qun',
    passive: '闭月：技能冷却-8%，对被控制的敌人伤害+25%',
    traits: { cd: 0.92, ctrlDmg: 1.25 },
    baseAtk: 23, baseHp: 100, atkPerLv: 2.3, hpPerLv: 9, moveSpeed: 80, pickup: 40,
    weapon: 'caidai', ult: 'charm', ultName: '闭月倾城', ultDesc: '花舞三叠：全屏敌军失神4秒，层层花环绽放',
    unlockText: shards(80), unlockShards: 80, color: '#f58ac0',
  },
  {
    id: 'dongzhuo', name: '董卓', title: '西凉太师董仲颖', quote: '顺我者昌，逆我者亡！', role: '暴虐重装', camp: 'qun',
    passive: '暴虐：生命+25%，生命越低伤害越高（至多+30%）',
    traits: { hp: 1.25, rageHp: 0.3 },
    baseAtk: 23, baseHp: 200, atkPerLv: 2.3, hpPerLv: 17, moveSpeed: 68, pickup: 40,
    weapon: 'xiliang', ult: 'tyrant', ultName: '焚城', ultDesc: '烈焰自脚下炸开席卷全屏，按命中敌人数回复生命',
    unlockText: shards(50), unlockShards: 50, color: '#b8553a',
  },
  {
    id: 'zhangjiao', name: '张角', title: '大贤良师张角', quote: '苍天已死，黄天当立！', role: '雷符道法', camp: 'qun',
    passive: '太平要术：技能范围+10%，技能冷却-6%，伤害+6%',
    traits: { area: 0.1, cd: 0.94, dmg: 6 },
    baseAtk: 24, baseHp: 105, atkPerLv: 2.4, hpPerLv: 9, moveSpeed: 76, pickup: 40,
    weapon: 'taiping', ult: 'thunderrain', ultName: '黄天当立', ultDesc: '3.5秒内黄天雷符铺天盖地，落雷之处敌军麻痹',
    unlockText: shards(80), unlockShards: 80, color: '#f2d24a',
  },
  {
    id: 'huatuo', name: '华佗', title: '神医华元化', quote: '医者仁心，亦可济世。', role: '回春医圣', camp: 'qun',
    passive: '青囊：每秒回复0.8%生命，金疮药冷却-25%，受到伤害-8%',
    traits: { regenPct: 0.008, potionCd: 0.75, taken: 0.92 },
    baseAtk: 20, baseHp: 125, atkPerLv: 2.0, hpPerLv: 11, moveSpeed: 76, pickup: 44,
    weapon: 'qingnang', ult: 'panacea', ultName: '青囊济世', ultDesc: '回复50%生命并无敌4秒，药雾弥漫全场持续灼伤敌军',
    unlockText: shards(50), unlockShards: 50, color: '#6fcf8a',
  },
  {
    id: 'zuoci', name: '左慈', title: '乌角先生左元放', quote: '幻由心生，万法皆空。', role: '奇门幻术', camp: 'qun',
    passive: '遁甲：技能冷却-8%，技能范围+8%，拾取范围+20%',
    traits: { cd: 0.92, area: 0.08, pickup: 1.2 },
    baseAtk: 25, baseHp: 100, atkPerLv: 2.5, hpPerLv: 9, moveSpeed: 78, pickup: 44,
    weapon: 'dunjia', ult: 'vortex', ultName: '奇门遁甲', ultDesc: '布下八卦旋涡把全屏敌军吸到一处，随后一举引爆',
    unlockText: shards(100), unlockShards: 100, color: '#7ad0c0',
  },
];
