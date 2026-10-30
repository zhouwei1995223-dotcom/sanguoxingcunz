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

// —— 1.0.3 新武将 ——
function huangzhongRider() {
  // 金甲褐袍，白发白须
  let r = riderImage({ S: 'u', w: 'y', G: 'U', g: 'u', n: 'U', y: 'Y' });
  r = overlay(r, ['..www', '.wwww', '..ww.', '..w..'], 4, 7);
  return r;
}

function machaoRider() {
  // 银盔白袍、白缨，蓝色披风
  return riderImage({ R: 'w', r: 'S', G: 'b', g: 'B', y: 'Y' });
}

function sunshangxiangRider() {
  // 乌发红簪，粉色衣裙，紫红披风
  let r = riderImage({ S: 'z', w: 'f', G: 'M', g: 'f', y: 'Y', n: 'z' });
  r.set(4, 3, 'z'); r.set(3, 4, 'z');
  return r;
}

function dianweiRider() {
  // 黑铁盔、皮甲，黝黑面庞，络腮胡
  let r = riderImage({ R: '.', r: '.', S: 'K', w: 'u', G: 'z', g: 'U', q: 'E', n: 'k', y: 'y' });
  r = overlay(r, ['.kkkk', 'kkkkk', '.kkk.'], 3, 7);
  return r;
}

function jiangweiRider() {
  // 银盔青缨，蓝袍
  return riderImage({ R: 'c', r: 'B', w: 'B', G: 'b', g: 'B', y: 'Y' });
}

function bowImage(wood: string, str: string): PixelImage {
  return PixelImage.fromRows([
    '..' + wood + '....',
    '.' + wood + '.' + str + '...',
    wood + '..' + str + '...',
    wood + '..' + str + '...',
    wood + '..' + str + '...',
    '.' + wood + '.' + str + '...',
    '..' + wood + '....',
  ]);
}

function chakramImage(c: string): PixelImage {
  return PixelImage.fromRows(['.' + c + c + '.', c + '..' + c, c + '..' + c, '.' + c + c + '.']);
}

export type HeroId = 'zhaoyun' | 'guanyu' | 'zhangfei' | 'zhuge' | 'lvbu' | 'huangzhong' | 'machao' | 'sunshangxiang' | 'dianwei' | 'jiangwei';

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
    case 'huangzhong': {
      const rider = huangzhongRider();
      return frames.map((f) => mountedFrame({ frame: f, horse: 'brown', rider, cloth: 'y', trim: 'U', weapon: bowImage('U', 'S'), weaponX: 17, weaponY: 6 }));
    }
    case 'machao': {
      const rider = machaoRider();
      const sp = spear(14, 'y', 'Y', 'w');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'gold', rider, cloth: 'b', trim: 'Y', weapon: sp, weaponX: 16, weaponY: 2 }));
    }
    case 'sunshangxiang': {
      const rider = sunshangxiangRider();
      return frames.map((f) => mountedFrame({ frame: f, horse: 'white', rider, cloth: 'M', trim: 'Y', weapon: chakramImage('Y'), weaponX: 18, weaponY: 8 }));
    }
    case 'dianwei': {
      const rider = dianweiRider();
      const w = generalWeapon('axe', 'S');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'black', rider, cloth: 'z', trim: 'y', weapon: w, weaponX: 14, weaponY: 1 }));
    }
    case 'jiangwei': {
      const rider = jiangweiRider();
      const sp = spear(13, 'S', 'w', 'c');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'brown', rider, cloth: 'b', trim: 'c', weapon: sp, weaponX: 16, weaponY: 2 }));
    }
    default: {
      const rider = riderImage();
      const sp = spear(13, 'S', 'w', 'R');
      return frames.map((f) => mountedFrame({ frame: f, horse: 'white', rider, cloth: 'G', trim: 'y', weapon: sp, weaponX: 16, weaponY: 2 }));
    }
  }
}

export const HERO_IDS: HeroId[] = ['zhaoyun', 'guanyu', 'zhangfei', 'zhuge', 'lvbu', 'huangzhong', 'machao', 'sunshangxiang', 'dianwei', 'jiangwei'];

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
    case 'huangzhong': {
      const rider = huangzhongRider().recolor({ u: 'r', y: 'R', U: 'z' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'red', rider, cloth: 'R', trim: 'Y', weapon: bowImage('Y', 'w'), weaponX: 17, weaponY: 6 }));
    }
    case 'machao': {
      const rider = machaoRider().recolor({ S: 'Y', w: 'y', b: 'r', B: 'R' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'white', rider, cloth: 'r', trim: 'Y', weapon: spear(14, 'U', 'w', 'R'), weaponX: 16, weaponY: 2 }));
    }
    case 'sunshangxiang': {
      const rider = sunshangxiangRider().recolor({ f: 'B', M: 'b' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'ghost', rider, cloth: 'b', trim: 'c', weapon: chakramImage('c'), weaponX: 18, weaponY: 8 }));
    }
    case 'dianwei': {
      const rider = dianweiRider().recolor({ u: 'r', K: 'U', z: 'k' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'red', rider, cloth: 'k', trim: 'R', weapon: generalWeapon('axe', 'Y'), weaponX: 14, weaponY: 1 }));
    }
    case 'jiangwei': {
      const rider = jiangweiRider().recolor({ B: 'w', b: 'G', c: 'Y' });
      return frames.map((f) => mountedFrame({ frame: f, horse: 'white', rider, cloth: 'G', trim: 'Y', weapon: spear(13, 'Y', 'w', 'Y'), weaponX: 16, weaponY: 2 }));
    }
  }
  return heroFramesFor(id);
}
