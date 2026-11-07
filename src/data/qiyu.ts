// 开局奇遇：每局开始从 3 个里选 1 个，整局生效（效果在 battle.recalc / applyQiyu 里）。
// 名字避开了锦囊妙计里已有的计策名。
import { WEB_RULES } from './platformConfig';

export type QiyuId =
  | 'qinggang' | 'qixingdao' | 'dilu' | 'chitu' | 'huatuo' | 'tengjia' | 'shuijing'
  | 'hanzhong' | 'dunjia' | 'sunzi' | 'pofu' | 'tongque' | 'shenbing' | 'zhanjiang'
  | 'jiangzuo' | 'dianbing' | 'xianfeng' | 'yulin' | 'cuifeng' | 'muniu' | 'yedu' | 'kaixuan' | 'xunshao' | 'beima';

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

if (WEB_RULES) QIYUS.push(
  { id: 'jiangzuo', name: '匠作营', story: '随军良匠，先利其器', desc: '自带武器开局升至2级', icon: 'p_whetstone' },
  { id: 'dianbing', name: '校场点兵', story: '沙场推演，再择兵略', desc: '额外获得2次免费升级刷新', icon: 'p_flag' },
  { id: 'xianfeng', name: '先锋令', story: '一鼓先登，士气正盛', desc: '开局获得60点怒气', icon: 'p_horn' },
  { id: 'yulin', name: '鱼鳞甲阵', story: '甲盾相接，短兵难侵', desc: '受到的接触伤害降低20%', icon: 'p_armor' },
  { id: 'cuifeng', name: '淬锋砺刃', story: '新磨利刃，初试锋芒', desc: '对满血敌人伤害提高35%', icon: 'w_sword' },
  { id: 'muniu', name: '木牛流马', story: '粮车随军，补给不绝', desc: '肉包回复提高至最大生命的45%，并获得5军饷', icon: 'bun' },
  { id: 'yedu', name: '灯下读兵', story: '一灯一卷，夜习用兵', desc: '技能持续时间+20%，暴击率+3%', icon: 'p_book' },
  { id: 'kaixuan', name: '阵前犒军', story: '斩将建功，军中犒赏', desc: '每击败一名精英或敌将，回复8%生命', icon: 'p_ration' },
  { id: 'xunshao', name: '斥候密报', story: '探知虚实，先除下策', desc: '升级封禁次数+2，拾取范围+15%', icon: 'p_map' },
  { id: 'beima', name: '白马轻装', story: '轻鞍快马，来去如风', desc: '生命达到80%时，移动速度提高18%', icon: 'p_horseshoe' },
);

export const QIYU_BY_ID: Record<string, QiyuDef> = {};
QIYUS.forEach((q) => (QIYU_BY_ID[q.id] = q));
