// 上架前需要填写的平台配置。广告位 ID 在微信「流量主」/ 抖音「广告变现」后台申请。

declare const process: { env: Record<string, string | undefined> };
/** 小红书小工具版本（离线 H5，构建时注入） */
export const IS_XHS = process.env.TARGET === 'xhs';
/** TapTap H5 小游戏版本（离线 H5，构建时注入） */
export const IS_TAP = process.env.TARGET === 'tap';
/** 离线 H5 版本（小红书 / TapTap）：不接平台 SDK，没有分享和好友排行，音效运行时合成 */
export const IS_H5 = IS_XHS || IS_TAP;
/** 无广告版本：原来看视频的地方改为免费领取、元宝兑换或直接去掉 */
export const NO_ADS = IS_H5;
/** 无广告版本：元宝解锁皮肤（每次「观看」折算的元宝）与元宝复活的价格 */
export const NO_ADS_PRICE = { skinPerAd: 60, revive: 100 };

export const AD_CONFIG = {
  wx: {
    rewarded: '', // 激励视频广告位 ID，例如 'adunit-xxxxxxxx'
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
  imageUrl: '', // 分享图，可放 5:4 的图片路径，例如 'share.png'
};

export const GAME_INFO = {
  name: '长坂单骑传',
  shortName: '长坂单骑传',
  version: '1.0.0',
  ageRating: 8, // 适龄提示：8+
  // 著作权人 / 出版单位等信息在拿到软著和备案后填写，显示在设置-关于
  copyright: '著作权人：张周炜',
  icp: '备案号：（待填写）',
};

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
