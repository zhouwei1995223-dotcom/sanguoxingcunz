// 上架前需要填写的平台配置。广告位 ID 在微信「流量主」/ 抖音「广告变现」后台申请。

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
  name: '一骑当千：三国幸存者',
  shortName: '一骑当千',
  version: '1.0.0',
  ageRating: 8, // 适龄提示：8+
  // 著作权人 / 出版单位等信息在拿到软著和备案后填写，显示在设置-关于
  copyright: '著作权人：（待填写）',
  icp: '备案号：（待填写）',
};
