import type { Platform } from './types';
import { createWebPlatform } from './web';
import { createMiniGamePlatform } from './minigame';
import { NO_ADS } from '../data/platformConfig';
import { pauseForAd } from '../audio/sound';

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
  p.showRewardedAd = (placement: string) => {
    if (!NO_ADS) pauseForAd(true);
    return raw(placement).then((ok) => {
      if (!NO_ADS) pauseForAd(false);
      p.report('ad_reward', { placement, ok: ok ? 1 : 0 });
      return ok;
    });
  };
  return instance;
}

export type { Platform };
