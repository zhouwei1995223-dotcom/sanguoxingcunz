// 开局奇遇：每局开始从 3 个里选 1 个，整局生效（效果在 battle.recalc / applyQiyu 里）。
// 名字避开了锦囊妙计里已有的计策名。

export type QiyuId =
  | 'qinggang' | 'qixingdao' | 'dilu' | 'chitu' | 'huatuo' | 'tengjia' | 'shuijing'
  | 'hanzhong' | 'dunjia' | 'sunzi' | 'pofu' | 'tongque' | 'shenbing' | 'zhanjiang';

export interface QiyuDef {
  id: QiyuId;
  name: string;
  /** 一句来历，卡片上的小字 */
  story: string;
  desc: string;
  icon: string;
}

export const QIYUS: QiyuDef[] = [
  { id: 'qinggang', name: '青釭剑', story: '夏侯恩所佩，削铁如泥', desc: '伤害+15%', icon: 'w_sword' },
  { id: 'qixingdao', name: '七星宝刀', story: '王允所藏，寒光逼人', desc: '暴击率+8%，暴击伤害+30%', icon: 'w_knife' },
  { id: 'dilu', name: '的卢跃溪', story: '一跃三丈，飞过檀溪', desc: '移动速度+12%，拾取范围+40%', icon: 'p_horseshoe' },
  { id: 'chitu', name: '赤兔良驹', story: '人中吕布，马中赤兔', desc: '怒气获取+40%，大招更快充满', icon: 'w_horse' },
  { id: 'huatuo', name: '华佗赠药', story: '神医妙手，刮骨疗毒', desc: '金疮药冷却-30%，回复量+10%', icon: 'potion' },
  { id: 'tengjia', name: '藤甲护身', story: '乌戈国藤甲，刀箭难入', desc: '受到伤害-15%', icon: 'p_armor' },
  { id: 'shuijing', name: '水镜荐贤', story: '司马徽指点迷津', desc: '经验获取+25%', icon: 'p_seal' },
  { id: 'hanzhong', name: '汉中屯田', story: '兵精粮足，久战不疲', desc: '生命上限+25%', icon: 'p_lingzhi' },
  { id: 'dunjia', name: '奇门遁甲', story: '天书三卷，可呼风唤雨', desc: '技能冷却-10%', icon: 'p_book' },
  { id: 'sunzi', name: '孙子兵法', story: '知己知彼，百战不殆', desc: '技能范围+15%，持续时间+15%', icon: 'p_flag' },
  { id: 'pofu', name: '破釜沉舟', story: '置之死地而后生', desc: '伤害+30%，但生命上限-25%', icon: 'p_tiger' },
  { id: 'tongque', name: '铜雀金库', story: '曹公府库，金帛如山', desc: '本局获得的军饷+50%', icon: 'gold' },
  { id: 'shenbing', name: '神兵天降', story: '路遇铸剑名匠', desc: '开局直接获得一件2级兵器', icon: 'chest_open' },
  { id: 'zhanjiang', name: '斩将夺旗', story: '万军之中取上将首级', desc: '对敌将和精英伤害+30%', icon: 'p_whetstone' },
];

export const QIYU_BY_ID: Record<string, QiyuDef> = {};
QIYUS.forEach((q) => (QIYU_BY_ID[q.id] = q));
