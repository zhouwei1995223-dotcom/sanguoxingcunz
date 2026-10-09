import { PixelImage } from '../pixel';
import { mountedFrame, riderImage } from './hero';

// 敌方单位：步兵生成器（盔、甲、兵器可配）+ 骑将生成器。

export interface SoldierStyle {
  helm: string; // 头盔主色
  helmDark: string;
  armor: string;
  armorDark: string;
  skin?: string;
  pants: string;
  plume?: string; // 盔缨
  headband?: string; // 头巾（代替头盔）
  weapon: 'spear' | 'shield' | 'bow' | 'halberd' | 'club' | 'sword' | 'none';
  big?: boolean;
}

const HEAD_HELM = [
  '....HHHH....',
  '...HHHHHH...',
  '...Hqqkq....',
  '...hqqqq....',
];
const HEAD_BAND = [
  '....qqqq....',
  '...BBBBBB...',
  '...qqqkq....',
  '...qqqqq....',
];
const TORSO = [
  '...AAAA.....',
  '..AAaAAAq...',
  '..AaAAAAq...',
  '...AAAA.....',
  '...yyyy.....',
];
const LEGS = [
  ['...P..P.....', '...P..P.....', '...k..k.....'],
  ['...P...P....', '..P....P....', '..k.....k...'],
  ['...P..P.....', '...P..P.....', '...k..k.....'],
  ['....P.P.....', '....P..P....', '....k..k....'],
];

const BIG_TORSO = [
  '..AAAAAA....',
  '.AAaaAAAAq..',
  '.AaAAAAAAq..',
  '.AAAAAAAA...',
  '..AAAAAA....',
  '..yyyyyy....',
];
const BIG_LEGS = [
  ['..PP..PP....', '..PP..PP....', '..kk..kk....'],
  ['..PP...PP...', '.PP....PP...', '.kk.....kk..'],
  ['..PP..PP....', '..PP..PP....', '..kk..kk....'],
  ['...PP.PP....', '...PP..PP...', '...kk..kk...'],
];

function weaponLayer(kind: SoldierStyle['weapon'], h: number, big: boolean): PixelImage {
  const w = new PixelImage(16, h);
  const hx = big ? 10 : 9; // 手的位置
  const hy = big ? 7 : 6;
  switch (kind) {
    case 'spear':
      w.line(hx, 0, hx, h - 2, 'U');
      w.set(hx, 0, 'S'); w.set(hx, 1, 'S'); w.set(hx - 1, 2, 'S'); w.set(hx + 1, 2, 'S');
      w.set(hx - 1, 3, 'R'); w.set(hx + 1, 3, 'R');
      break;
    case 'halberd':
      w.line(hx, 0, hx, h - 1, 'U');
      w.set(hx, 0, 'S'); w.rect(hx + 1, 2, 2, 3, 'S'); w.set(hx + 3, 3, 'S'); w.set(hx - 1, 2, 'S');
      w.set(hx - 1, 4, 'R');
      break;
    case 'shield':
      w.rect(hx - 1, hy - 3, 4, 7, 'U');
      w.rect(hx, hy - 2, 2, 5, 'u');
      w.set(hx, hy, 'y'); w.set(hx + 1, hy, 'y');
      w.line(hx - 6, hy - 6, hx - 3, hy - 3, 'S');
      break;
    case 'bow':
      w.line(hx + 1, hy - 5, hx + 2, hy - 3, 'U');
      w.line(hx + 2, hy - 3, hx + 2, hy + 2, 'U');
      w.line(hx + 2, hy + 2, hx + 1, hy + 4, 'U');
      w.line(hx + 1, hy - 5, hx + 1, hy + 4, 'S');
      break;
    case 'club':
      w.line(hx, hy, hx + 2, hy - 6, 'U');
      w.rect(hx + 1, hy - 9, 3, 4, 'z');
      w.set(hx + 2, hy - 10, 'N');
      break;
    case 'sword':
      w.line(hx, hy, hx + 3, hy - 5, 'S');
      w.set(hx, hy + 1, 'y'); w.set(hx - 1, hy, 'y');
      break;
    case 'none':
      break;
  }
  return w;
}

export function soldierFrames(st: SoldierStyle): PixelImage[] {
  const big = !!st.big;
  const map: Record<string, string> = {
    H: st.helm, h: st.helmDark, A: st.armor, a: st.armorDark, P: st.pants,
    q: st.skin || 'q', B: st.headband || 'R', y: 'U',
  };
  const head = st.headband ? HEAD_BAND : HEAD_HELM;
  const torso = big ? BIG_TORSO : TORSO;
  const legs = big ? BIG_LEGS : LEGS;
  return [0, 1, 2, 3].map((f) => {
    const rows = (st.plume ? ['.....P......'.replace('P', 'Z')] : ['............']).concat(head, torso, legs[f]);
    const body = PixelImage.fromRows(rows).recolor(map).recolor({ Z: st.plume || 'R' });
    const h = rows.length;
    const bob = f === 1 || f === 3 ? 1 : 0;
    const c = new PixelImage(16, h + 2);
    // 盾牌在身前要压住身体，其余兵器在身后
    if (st.weapon !== 'shield') c.blit(weaponLayer(st.weapon, h + 1, big), 0, 0 + bob);
    c.blit(body, 1, 1);
    if (st.weapon === 'shield') c.blit(weaponLayer(st.weapon, h + 1, big), 0, bob);
    return c.outline();
  });
}

export interface GeneralStyle {
  horse: 'white' | 'brown' | 'black' | 'ghost' | 'gold';
  colors: Record<string, string>; // 对骑手图的换色
  cloth: string;
  trim: string;
  weapon: 'spear' | 'halberd' | 'axe' | 'sword' | 'fork' | 'club' | 'blade';
  weaponColor?: string;
}

export function generalWeapon(kind: GeneralStyle['weapon'], color = 'S'): PixelImage {
  const img = new PixelImage(18, 14);
  // 斜持：从左下 (0,13) 到右上
  const tipX = 13, tipY = 3;
  if (kind === 'sword') {
    img.line(2, 11, 9, 4, color); img.line(3, 11, 10, 4, 'w');
    img.rect(1, 11, 3, 1, 'y'); img.set(1, 12, 'U');
    return img;
  }
  img.line(0, 13, tipX, tipY, 'U');
  switch (kind) {
    case 'spear':
      img.line(tipX, tipY, tipX + 3, tipY - 2, color); img.set(tipX - 1, tipY + 1, 'R'); img.set(tipX - 2, tipY + 2, 'R');
      break;
    case 'halberd':
      img.line(tipX, tipY, tipX + 3, tipY - 2, color);
      img.rect(tipX - 1, tipY - 3, 2, 3, color); img.set(tipX - 2, tipY - 3, color);
      img.set(tipX - 1, tipY + 2, 'R');
      break;
    case 'axe':
      img.rect(tipX - 1, tipY - 3, 4, 6, color); img.rect(tipX + 3, tipY - 2, 1, 4, color);
      img.set(tipX - 1, tipY - 3, '.'); img.set(tipX - 1, tipY + 2, '.');
      img.line(tipX + 3, tipY - 2, tipX + 3, tipY + 1, 'w');
      break;
    case 'fork':
      img.line(tipX, tipY, tipX + 3, tipY - 2, color);
      img.line(tipX - 2, tipY - 1, tipX + 1, tipY - 4, color);
      img.line(tipX + 1, tipY + 2, tipX + 4, tipY, color);
      break;
    case 'club':
      img.rect(tipX - 1, tipY - 3, 4, 5, 'z'); img.set(tipX + 3, tipY - 4, 'N'); img.set(tipX - 2, tipY - 2, 'N'); img.set(tipX + 1, tipY + 2, 'N');
      break;
    case 'blade':
      img.line(tipX, tipY, tipX + 2, tipY - 3, color);
      img.rect(tipX - 1, tipY - 4, 3, 4, color); img.line(tipX + 2, tipY - 4, tipX + 3, tipY - 1, 'w');
      img.set(tipX - 1, tipY + 1, 'G');
      break;
  }
  return img;
}

export function generalFrames(st: GeneralStyle): PixelImage[] {
  const rider = riderImage(st.colors);
  const w = generalWeapon(st.weapon, st.weaponColor);
  return [0, 1, 2, 3].map((f) => mountedFrame({ frame: f, horse: st.horse, rider, cloth: st.cloth, trim: st.trim, weapon: w, weaponX: 14, weaponY: 2 }));
}

/** 把像素图整体放大 n 倍（用于精英 / 首领） */
export function scaleImage(img: PixelImage, n: number): PixelImage {
  const o = new PixelImage(img.w * n, img.h * n);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.px[y * o.w + x] = img.px[((y / n) | 0) * img.w + ((x / n) | 0)];
  return o;
}
