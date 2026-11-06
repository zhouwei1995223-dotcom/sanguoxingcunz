import type { Platform } from './types';
import { createWebPlatform } from './web';
import { createMiniGamePlatform } from './minigame';
import { IS_WEB, NO_ADS } from '../data/platformConfig';
import { pauseForAd } from '../audio/sound';
import { save } from '../meta/save';

declare const wx: any;
declare const tt: any;

let instance: Platform | null = null;

export function getPlatform(): Platform {
  if (instance) return instance;
  if (typeof tt !== 'undefined' && tt.createCanvas) instance = createMiniGamePlatform('tt');
  else if (typeof wx !== 'undefined' && wx.createCanvas) instance = createMiniGamePlatform('wx');
  else instance = createWebPlatform();
  if (NO_ADS) {
    // 无广告版本：所有「看视频」直接发放奖励
    instance.showRewardedAd = () => Promise.resolve(true);
    instance.showInterstitialAd = () => {};
  }
  // 所有激励视频统一上报（点位、是否看完）
  const p = instance;
  const raw = p.showRewardedAd.bind(p);
  // 同一时间只放一个广告：广告加载的一两秒里连点两下，两次回调会共用一次「看完」，奖励发两份
  let adBusy = 0;
  p.showRewardedAd = (placement: string) => {
    const now = Date.now();
    if (adBusy && now - adBusy < 90000) return Promise.resolve(false);
    adBusy = now;
    if (!NO_ADS) pauseForAd(true);
    // 网页视频加载失败时也走未看完的收尾，避免锁住下一次请求或一直静音。
    const request = IS_WEB ? Promise.resolve().then(() => raw(placement)).catch(() => false) : raw(placement);
    return request.then((ok) => {
      if (!IS_WEB || adBusy === now) {
        adBusy = 0;
        if (!NO_ADS) pauseForAd(false);
      }
      const c = (save.daily.adCount = save.daily.adCount || {});
      if (ok) c[placement] = (c[placement] || 0) + 1;
      p.report('ad_reward', { placement, ok: ok ? 1 : 0, idx: c[placement] || 0, src: save.src || '' });
      return ok;
    });
  };
  return instance;
}

export type { Platform };
