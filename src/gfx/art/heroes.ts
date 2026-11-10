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

export type HeroId = 'zhaoyun' | 'guanyu' | 'zhangfei' | 'zhuge' | 'lvbu' | 'huangzhong' | 'machao' | 'sunshangxiang' | 'dianwei' | 'jiangwei'
  // 1.1.0 新增二十位
  | 'liubei' | 'weiyan' | 'caocao' | 'xiahoudun' | 'zhangliao' | 'xuchu' | 'simayi' | 'xiahouyuan' | 'zhenji'
  | 'sunce' | 'zhouyu' | 'ganning' | 'taishici' | 'luxun' | 'xiaoqiao'
  | 'diaochan' | 'dongzhuo' | 'zhangjiao' | 'huatuo' | 'zuoci';

// —— 1.1.0 新武将：骑乘造型全部由下面这张表拼出来 ——
// plume 缨（亮 / 主 / 暗，null 不戴缨）；armor 盔甲四阶（高光 / 亮 / 主 / 暗）；cape 披风三阶；
// face 肤色两阶；beard 胡须颜色；hair 女将 / 文士的发色（把头盔换成头发）；skin 皮肤配色（换色表）。
interface RiderSpec {
  plume: [string, string, string] | null;
  armor: [string, string, string, string];
  cape: [string, string, string];
  face?: [string, string];
  beard?: string;
  hair?: string;
  patch?: boolean;
  horse: 'white' | 'brown' | 'black' | 'ghost' | 'gold' | 'red' | 'cart';
  cloth: string; trim: string;
  weapon: () => PixelImage;
  wx: number; wy: number;
  /** 皮肤：换色表 + 坐骑 */
  skin: Record<string, string>;
  skinHorse: RiderSpec['horse'];
}

function staff(len: number, shaft: string, head: string): PixelImage {
  const img = new PixelImage(len + 4, 10);
  const x1 = len, y1 = 9 - Math.round(len * 0.45);
  img.line(0, 9, x1, y1, shaft);
  img.disc(x1 + 1, y1 - 1, 1, head);
  img.set(x1 + 1, y1 - 3, 'w');
  return img;
}
const fanOf = (a: string, b: string) => featherFan().recolor({ w: a, S: b });

const RIDERS: Record<string, RiderSpec> = {
  liubei: { plume: ['Y', 'R', 'r'], armor: ['Y', 'y', 'o', 'U'], cape: ['g', 'G', 'd'], beard: 'k', horse: 'white', cloth: 'G', trim: 'Y', weapon: () => generalWeapon('sword', 'S'), wx: 15, wy: 3, skin: { G: 'R', g: 'f', d: 'r', y: 'w', o: 'S' }, skinHorse: 'gold' },
  weiyan: { plume: ['f', 'R', 'r'], armor: ['S', 'N', 'n', 'K'], cape: ['R', 'r', 'z'], face: ['l', 'U'], beard: 'k', horse: 'black', cloth: 'r', trim: 'y', weapon: () => generalWeapon('blade', 'S'), wx: 14, wy: 1, skin: { R: 'y', r: 'o', N: 'U', n: 'z' }, skinHorse: 'red' },
  caocao: { plume: ['Y', 'y', 'o'], armor: ['B', 'b', 'K', 'k'], cape: ['f', 'R', 'r'], beard: 'k', horse: 'black', cloth: 'r', trim: 'Y', weapon: () => generalWeapon('sword', 'w'), wx: 15, wy: 3, skin: { b: 'm', B: 'M', R: 'Y', r: 'y' }, skinHorse: 'ghost' },
  xiahoudun: { plume: ['w', 'S', 's'], armor: ['w', 'S', 'N', 'n'], cape: ['B', 'b', 'K'], patch: true, beard: 'k', horse: 'brown', cloth: 'b', trim: 'S', weapon: () => generalWeapon('blade', 'S'), wx: 14, wy: 1, skin: { b: 'r', B: 'R', K: 'z' }, skinHorse: 'black' },
  zhangliao: { plume: ['w', 'c', 'B'], armor: ['w', 'S', 's', 'N'], cape: ['c', 'B', 'b'], horse: 'brown', cloth: 'b', trim: 'c', weapon: () => generalWeapon('halberd', 'S'), wx: 14, wy: 0, skin: { B: 'y', b: 'o', c: 'Y' }, skinHorse: 'white' },
  xuchu: { plume: null, armor: ['e', 'q', 'E', 'u'], cape: ['y', 'o', 'U'], hair: 'k', beard: 'k', horse: 'brown', cloth: 'o', trim: 'k', weapon: () => generalWeapon('club', 'S'), wx: 14, wy: 1, skin: { o: 'r', y: 'R', U: 'z' }, skinHorse: 'black' },
  simayi: { plume: null, armor: ['M', 'm', 'K', 'k'], cape: ['M', 'm', 'z'], hair: 'K', beard: 'k', horse: 'black', cloth: 'm', trim: 'M', weapon: () => fanOf('m', 'M'), wx: 17, wy: 9, skin: { m: 'b', M: 'B', K: 'n' }, skinHorse: 'ghost' },
  xiahouyuan: { plume: ['Y', 'y', 'o'], armor: ['g', 'G', 'd', 't'], cape: ['Y', 'y', 'U'], horse: 'brown', cloth: 'G', trim: 'y', weapon: () => bowImage('U', 'w'), wx: 17, wy: 6, skin: { G: 'b', g: 'B', d: 'K' }, skinHorse: 'white' },
  zhenji: { plume: null, armor: ['w', 'B', 'b', 'K'], cape: ['w', 'c', 'B'], hair: 'z', horse: 'white', cloth: 'B', trim: 'c', weapon: () => chakramImage('c'), wx: 18, wy: 8, skin: { B: 'M', b: 'm', c: 'f' }, skinHorse: 'ghost' },
  sunce: { plume: ['Y', 'y', 'o'], armor: ['f', 'R', 'r', 'z'], cape: ['Y', 'y', 'U'], horse: 'brown', cloth: 'r', trim: 'Y', weapon: () => spear(14, 'U', 'w', 'Y'), wx: 16, wy: 2, skin: { R: 'B', r: 'b', f: 'c' }, skinHorse: 'white' },
  zhouyu: { plume: ['f', 'R', 'r'], armor: ['w', 'S', 's', 'N'], cape: ['f', 'R', 'r'], horse: 'white', cloth: 'R', trim: 'Y', weapon: () => generalWeapon('sword', 'w'), wx: 15, wy: 3, skin: { R: 'B', r: 'b', f: 'c' }, skinHorse: 'red' },
  ganning: { plume: ['w', 'S', 's'], armor: ['Y', 'y', 'u', 'U'], cape: ['B', 'b', 'K'], hair: 'k', horse: 'brown', cloth: 'b', trim: 'Y', weapon: () => generalWeapon('sword', 'S'), wx: 15, wy: 3, skin: { B: 'R', b: 'r', K: 'z' }, skinHorse: 'black' },
  taishici: { plume: ['Y', 'o', 'U'], armor: ['y', 'u', 'U', 'z'], cape: ['g', 'G', 'd'], horse: 'brown', cloth: 'G', trim: 'y', weapon: () => bowImage('z', 'Y'), wx: 17, wy: 6, skin: { G: 'r', g: 'R', d: 'z' }, skinHorse: 'red' },
  luxun: { plume: null, armor: ['w', 'p', 'e', 'u'], cape: ['L', 'l', 'U'], hair: 'K', horse: 'white', cloth: 'l', trim: 'y', weapon: () => generalWeapon('sword', 'y'), wx: 15, wy: 3, skin: { l: 'b', L: 'B', U: 'K' }, skinHorse: 'brown' },
  xiaoqiao: { plume: null, armor: ['w', 'f', 'M', 'm'], cape: ['w', 'f', 'M'], hair: 'U', horse: 'white', cloth: 'M', trim: 'Y', weapon: () => fanOf('f', 'w'), wx: 17, wy: 9, skin: { f: 'c', M: 'B', m: 'b' }, skinHorse: 'ghost' },
  diaochan: { plume: null, armor: ['f', 'M', 'm', 'z'], cape: ['f', 'R', 'r'], hair: 'k', horse: 'white', cloth: 'r', trim: 'Y', weapon: () => chakramImage('f'), wx: 18, wy: 8, skin: { M: 'y', m: 'o', R: 'm', r: 'z' }, skinHorse: 'red' },
  dongzhuo: { plume: ['Y', 'y', 'o'], armor: ['N', 'n', 'K', 'k'], cape: ['M', 'm', 'z'], face: ['E', 'u'], beard: 'k', horse: 'black', cloth: 'm', trim: 'Y', weapon: () => generalWeapon('blade', 'Y'), wx: 14, wy: 1, skin: { m: 'r', M: 'R', n: 'U' }, skinHorse: 'red' },
  zhangjiao: { plume: null, armor: ['w', 'Y', 'y', 'o'], cape: ['Y', 'y', 'U'], hair: 'Y', beard: 'k', horse: 'ghost', cloth: 'y', trim: 'w', weapon: () => staff(12, 'U', 'Y'), wx: 16, wy: 2, skin: { Y: 'c', y: 'B', o: 'b' }, skinHorse: 'white' },
  huatuo: { plume: null, armor: ['w', 'g', 'G', 'd'], cape: ['p', 'e', 'u'], hair: 'w', beard: 'w', horse: 'brown', cloth: 'G', trim: 'p', weapon: () => staff(11, 'U', 'g'), wx: 16, wy: 3, skin: { g: 'B', G: 'b', d: 'K' }, skinHorse: 'white' },
  zuoci: { plume: null, armor: ['c', 'B', 't', 'k'], cape: ['c', 't', 'k'], hair: 't', beard: 'w', horse: 'ghost', cloth: 't', trim: 'c', weapon: () => staff(12, 'z', 'c'), wx: 16, wy: 2, skin: { t: 'm', c: 'M', B: 'f' }, skinHorse: 'black' },
};

function specRider(sp: RiderSpec): PixelImage {
  const map: Record<string, string> = {};
  if (sp.plume) { map.f = sp.plume[0]; map.R = sp.plume[1]; map.r = sp.plume[2]; }
  else { map.f = '.'; map.R = '.'; map.r = '.'; }
  // 先把模板里的每种颜色换成占位符再统一上色，避免「甲色换成了披风色又被披风换色表改掉」
  const tpl = riderImage();
  const out = tpl.clone();
  const [a0, a1, a2, a3] = sp.armor, [c0, c1, c2] = sp.cape;
  const face = sp.face || ['q', 'E'];
  const m: Record<string, string> = { ...map, w: a0, S: a1, s: a2, N: a3, g: c0, G: c1, d: c2, q: face[0], E: face[1] };
  out.px = tpl.px.map((c) => (m[c] !== undefined ? m[c] : c));
  let r = out;
  if (sp.hair) {
    // 不戴盔：头顶换成头发（文士束发 / 女将乌发）
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 8; x++) if (r.get(x, y) !== '.') r.set(x, y, sp.hair);
    r.set(3, 5, sp.hair); r.set(3, 6, sp.hair);
    r.set(5, 2, sp.hair); r.set(6, 2, sp.hair);
  }
  if (sp.patch) { r.set(7, 5, 'k'); r.set(8, 5, 'k'); r.set(6, 4, 'k'); }
  if (sp.beard) r = overlay(r, ['..' + sp.beard + sp.beard + sp.beard, '.' + sp.beard + sp.beard + sp.beard + sp.beard, '..' + sp.beard + sp.beard + '.'], 4, 7);
  return r;
}

function specFrames(id: string, skin: boolean): PixelImage[] | null {
  const sp = RIDERS[id];
  if (!sp) return null;
  let rider = specRider(sp);
  let cloth = sp.cloth, trim = sp.trim;
  if (skin) { rider = rider.recolor(sp.skin); cloth = sp.skin[cloth] || cloth; trim = sp.skin[trim] || trim; }
  const w = skin ? sp.weapon().recolor(sp.skin) : sp.weapon();
  return [0, 1, 2, 3].map((f) => mountedFrame({ frame: f, horse: skin ? sp.skinHorse : sp.horse, rider, cloth, trim, weapon: w, weaponX: sp.wx, weaponY: sp.wy }));
}


export function heroFramesFor(id: HeroId): PixelImage[] {
  const ext = specFrames(id, false);
  if (ext) return ext;
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

export const HERO_IDS: HeroId[] = ['zhaoyun', 'guanyu', 'zhangfei', 'zhuge', 'lvbu', 'huangzhong', 'machao', 'sunshangxiang', 'dianwei', 'jiangwei',
  ...(Object.keys(RIDERS) as HeroId[])];

/** 皮肤造型：在原造型基础上换色、换坐骑 */
export function heroSkinFrames(id: HeroId): PixelImage[] {
  const ext = specFrames(id, true);
  if (ext) return ext;
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
