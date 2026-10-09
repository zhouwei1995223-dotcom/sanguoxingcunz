import type { Platform } from './types';
import { createWebPlatform } from './web';
import { createMiniGamePlatform } from './minigame';

declare const wx: any;
declare const tt: any;

let instance: Platform | null = null;

export function getPlatform(): Platform {
  if (instance) return instance;
  if (typeof tt !== 'undefined' && tt.createCanvas) instance = createMiniGamePlatform('tt');
  else if (typeof wx !== 'undefined' && wx.createCanvas) instance = createMiniGamePlatform('wx');
  else instance = createWebPlatform();
  // 所有激励视频统一上报（点位、是否看完）
  const p = instance;
  const raw = p.showRewardedAd.bind(p);
  p.showRewardedAd = (placement: string) => raw(placement).then((ok) => {
    p.report('ad_reward', { placement, ok: ok ? 1 : 0 });
    return ok;
  });
  return instance;
}

export type { Platform };
