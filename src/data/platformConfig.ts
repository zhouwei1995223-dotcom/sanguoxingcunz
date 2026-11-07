// 上架前需要填写的平台配置。广告位 ID 在微信「流量主」/ 抖音「广告变现」后台申请。

declare const process: { env: Record<string, string | undefined> };
/** 浏览器网页版（构建时注入） */
export const IS_WEB = process.env.TARGET === 'web';
/** 小红书小工具版本（离线 H5，构建时注入） */
export const IS_XHS = process.env.TARGET === 'xhs';
/** TapTap H5 小游戏版本（离线 H5，构建时注入） */
export const IS_TAP = process.env.TARGET === 'tap';
/** 微信小游戏版本 */
export const IS_WX = process.env.TARGET === 'wx';
/**
 * 新版玩法与数值（原「网页版专属」）：网页版先做，确认后同步。2026-11-07 起微信版、小红书版整体换成网页版。
 * 调试参数、网页测试档、模拟广告仍只认 IS_WEB。小红书没有广告接口，看视频的点位全部直接免费（NO_ADS）。
 * 抖音 / TapTap 暂不维护，保持旧版。
 */
export const WEB_RULES = IS_WEB || IS_WX || IS_XHS;
/** 水墨宣纸 UI 与精细像素美术开关（网页版、微信版、小红书版） */
export const NEW_UI = WEB_RULES;
/** 离线 H5 版本（小红书 / TapTap）：不接平台 SDK，没有分享和好友排行，音效运行时合成 */
export const IS_H5 = IS_XHS || IS_TAP;
/** 无广告版本：原来看视频的地方改为免费领取、元宝兑换或直接去掉 */
export const NO_ADS = IS_H5;
/** 无广告版本：元宝解锁皮肤（每次「观看」折算的元宝）与元宝复活的价格 */
export const NO_ADS_PRICE = { skinPerAd: 60, revive: 100 };

export const AD_CONFIG = {
  wx: {
    rewarded: 'adunit-58a7793eb5931638', // 激励视频广告位 ID（2026-10-30 开通流量主）
    interstitial: '', // 插屏广告位 ID
  },
  tt: {
    rewarded: '',
    interstitial: '',
  },
  /** 未填写广告位时是否直接发放奖励（便于提审前自测）。正式上线请保持广告位已填写。 */
  grantWhenNoAd: true,
};

export const SHARE_CONFIG = {
  title: '长坂坡七进七出，你能撑过几分钟？',
  imageUrl: 'assets/share/combo.jpg', // 右上角菜单分享用的图（5:4）
  /** 按场景分享用的图：结算连斩、结算大招、锦囊三选一 */
  images: { combo: 'assets/share/combo.jpg', ult: 'assets/share/ult.jpg', strat: 'assets/share/strat.jpg' },
};

export const GAME_INFO = {
  name: '长坂单骑传',
  shortName: '长坂单骑传',
  version: IS_XHS ? '1.0.9' : '1.0.7',
  ageRating: 8, // 适龄提示：8+
  // 著作权人 / 出版单位等信息在拿到软著和备案后填写，显示在设置-关于
  copyright: '著作权人：张周炜',
  icp: '浙ICP备2026092296号-1X',
};

/** 游戏圈：公众平台「游戏圈首页链接」里的「游戏内打开」链接（用页面管理器在游戏内打开） */
export const GAME_CLUB = {
  wx: '-SSEykJvFV3pORt5kTNpSz83xWajDQkBoG_UmsnhirmhHZewQzlaipulfbDTg-EQyziG-F5LbtqmhOMvSTplLMaA24cK7DDh_xkVSAqrDFs71UmKl2813KLF8RM7ByXmS8QPUXrXlLh1zf_MkiaD7gFx0qwdC9NtkIgiy8yJ8Rqj5Q-l5DUpwhW31bcCZ981fzmMkUABWNpBiHOAKP0bXdTYV6ylWwexUK4jN7iqWXnGX6KHDSiRmB2JcWUxu0kSGAXe5udq3qwQRKIkgAi0VfmfCU-blud4ThFn-IwOa5mntpom0Hqe-F7cdS4jhTAGgBOm-1xF-Jwlmpg_F72JYw',
};

/** 小游戏推荐组件的 openlink（官方常量，文档「评价与推荐」里原样复制） */
export const RECOMMEND_OPENLINK = 'TWFRCqV5WeM2AkMXhKwJ03MhfPOieJfAsvXKUbWvQFQtLyyA5etMPabBehga950uzfZcH3Vi3QeEh41xRGEVFw';

/** 云开发配置（云存档、订阅提醒）。开通后填写环境 ID。 */
export const CLOUD_CONFIG = {
  wx: { env: '' }, // 微信云开发环境 ID，例如 'cloud1-xxxxx'
  tt: { env: '' }, // 抖音云环境 ID
  collection: 'saves',
  reminderCollection: 'reminders',
};

/** 订阅消息模板 ID（微信公众平台 → 订阅消息 → 选用模板后填写） */
export const SUBSCRIBE_CONFIG = {
  wx: { stamina: '', patrol: '' },
  tt: { stamina: '', patrol: '' },
};

/**
 * 兑换码：键为兑换码（不区分大小写），值为奖励。上线后可在这里增删，重新构建发布即可。
 * 每个码每位玩家只能用一次。
 */
export const REDEEM_CODES: Record<string, { gold?: number; yuanbao?: number; iron?: number; stamina?: number; shards?: { hero: string; n: number } }> = {
  YIQIDANGQIAN: { yuanbao: 200, gold: 2000 },
  ZILONG666: { yuanbao: 100, stamina: 30 },
  WUHUSHANGJIANG: { shards: { hero: 'zhuge', n: 10 }, iron: 30 },
};
