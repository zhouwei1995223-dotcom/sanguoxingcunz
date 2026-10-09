import { PixelImage } from '../pixel';
import { mountedFrame, riderImage, spear } from './hero';
import { generalWeapon } from './units';

// 五虎上将与卧龙：每位武将的骑乘造型（4 帧）

function overlay(base: PixelImage, rows: string[], x: number, y: number): PixelImage {
  return base.clone().blit(PixelImage.fromRows(rows), x, y);
}

function guanyuRider() {
  // 绿巾绿袍，面如重枣，长髯
  let r = riderImage({ R: 'G', r: 'd', S: 'G', w: 'g', G: 'd', g: 'G', q: 'l', n: 'U', y: 'y' });
  r = overlay(r, ['..kkk', '.kkkk', '..kk.', '..k..'], 4, 7);
  return r;
}

function zhangfeiRider() {
  // 黑盔黑甲，豹头环眼，虎须
  let r = riderImage({ R: 'R', r: 'r', S: 'n', w: 's', G: 'r', g: 'R', q: 'E', n: 'K', y: 'y' });
  r = overlay(r, ['.kkkkk', 'kkkkkk', '.kkkk.'], 3, 7);
  r.set(8, 5, 'w');
  return r;
}

function zhugeRider() {
  // 纶巾鹤氅，羽扇
  let r = riderImage({ R: '.', r: '.', S: 'K', w: 'w', G: 'b', g: 'B', q: 'q', n: 'B', y: 'B' });
  r = overlay(r, ['..kk.', '.k..k'], 4, 8);
  return r;
}

function lvbuRider() {
  // 束发金冠，两根雉鸡翎，兽面吞头连环铠
  let r = riderImage({ R: 'R', r: 'r', S: 'y', w: 'Y', G: 'M', g: 'f', q: 'q', n: 'U', y: 'R' });
  const plumes = new PixelImage(14, 6);
  plumes.line(5, 5, 1, 0, 'R');
  plumes.line(6, 5, 3, 0, 'o');
  plumes.set(0, 0, 'Y');
  const c = new PixelImage(14, r.h + 3);
  c.blit(plumes, 0, 0).blit(r, 0, 3);
  return c;
}

function featherFan(): PixelImage {
  return PixelImage.fromRows([
    '...ww..',
    '..wwSw.',
    '.wwSww.',
    '.wSwww.',
    '..www..',
    '...U...',
    '...U...',
  ]);
}

export type HeroId = 'zhaoyun' | 'guanyu' | 'zhangfei' | 'zhuge' | 'lvbu';

export function heroFramesFor(id: HeroId): PixelImage[] {
  const frames = [0, 1, 2, 3];
  switch (id) {
    case 'guanyu': {
      const rider = guanyuRider();
      const w = generalWeapon('blade', 'S');
      w.recolor({ G: 'G' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'brown', rider, cloth: 'G', trim: 'y', weapon: w, weaponX: 14, weaponY: 1 }));
    }
    case 'zhangfei': {
      const rider = zhangfeiRider();
      const w = generalWeapon('fork', 'S');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'black', rider, cloth: 'K', trim: 'R', weapon: w, weaponX: 14, weaponY: 1 }));
    }
    case 'zhuge': {
      const rider = zhugeRider();
      return frames.map((f) => mountedFrame({ frame: f, horse: 'cart', rider, cloth: 'B', trim: 'w', weapon: featherFan(), weaponX: 17, weaponY: 9 }));
    }
    case 'lvbu': {
      const rider = lvbuRider();
      const w = generalWeapon('halberd', 'Y');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'red', rider, cloth: 'r', trim: 'y', weapon: w, weaponX: 14, weaponY: 0 }));
    }
    default: {
      const rider = riderImage();
      const sp = spear(13, 'S', 'w', 'R');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'white', rider, cloth: 'G', trim: 'y', weapon: sp, weaponX: 16, weaponY: 2 }));
    }
  }
}

export const HERO_IDS: HeroId[] = ['zhaoyun', 'guanyu', 'zhangfei', 'zhuge', 'lvbu'];

/** 皮肤造型：在原造型基础上换色、换坐骑 */
export function heroSkinFrames(id: HeroId): PixelImage[] {
  const frames = [0, 1, 2, 3];
  switch (id) {
    case 'zhaoyun': {
      const rider = riderImage({ G: 'y', g: 'Y', R: 'c', r: 'B', y: 'c' });
      const sp = spear(13, 'Y', 'w', 'c');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'ghost', rider, cloth: 'y', trim: 'w', weapon: sp, weaponX: 16, weaponY: 2 }));
    }
    case 'guanyu': {
      const rider = guanyuRider().recolor({ d: 'k', G: 'd' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'red', rider, cloth: 'd', trim: 'Y', weapon: generalWeapon('blade', 'Y'), weaponX: 14, weaponY: 1 }));
    }
    case 'zhangfei': {
      const rider = zhangfeiRider().recolor({ n: 'U', s: 'y', R: 'o', r: 'U' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'brown', rider, cloth: 'o', trim: 'k', weapon: generalWeapon('fork', 'Y'), weaponX: 14, weaponY: 1 }));
    }
    case 'zhuge': {
      const rider = zhugeRider().recolor({ w: 'M', b: 'm', B: 'f', K: 'm' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'cart', rider, cloth: 'm', trim: 'Y', weapon: featherFan(), weaponX: 17, weaponY: 9 }));
    }
    case 'lvbu': {
      const rider = lvbuRider().recolor({ y: 'K', Y: 'n', M: 'k', f: 'K' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'black', rider, cloth: 'k', trim: 'Y', weapon: generalWeapon('halberd', 'R'), weaponX: 14, weaponY: 0 }));
    }
  }
  return heroFramesFor(id);
}
