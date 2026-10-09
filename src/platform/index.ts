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
  return instance;
}

export type { Platform };
