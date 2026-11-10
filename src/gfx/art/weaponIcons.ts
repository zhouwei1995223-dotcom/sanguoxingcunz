import { PixelImage } from '../pixel';

// 1.1.0 新武将专属兵器的图标（16×16）：按兵器种类用几笔线条拼出来，换配色就是不同兵器；
// 进化图标 = 金色刃口 + 四角闪光。

type Kind = 'sword' | 'dual' | 'blade' | 'halberd' | 'hammer' | 'talisman' | 'bow' | 'orb' | 'spear' | 'firearrow' | 'bell' | 'fireorb' | 'fan' | 'ribbon' | 'pouch' | 'book';

/** [种类, 主色, 亮色, 点缀色] */
const SPEC: Record<string, [Kind, string, string, string]> = {
  shuanggu: ['dual', 'S', 'w', 'Y'],
  kuanggu: ['blade', 'R', 'f', 'y'],
  yitian: ['sword', 'B', 'w', 'Y'],
  qilin: ['blade', 'N', 'S', 'y'],
  goulian: ['halberd', 'S', 'w', 'B'],
  huchui: ['hammer', 'N', 'S', 'y'],
  langgu: ['talisman', 'M', 'f', 'm'],
  shenbi: ['bow', 'G', 'g', 'w'],
  luoshui: ['orb', 'B', 'c', 'w'],
  bawang: ['spear', 'S', 'w', 'R'],
  chibi: ['firearrow', 'o', 'Y', 'R'],
  jinfan: ['bell', 'y', 'Y', 'R'],
  shenting: ['bow', 'u', 'y', 'Y'],
  lianying: ['fireorb', 'o', 'Y', 'R'],
  zheshan: ['fan', 'f', 'w', 'M'],
  caidai: ['ribbon', 'M', 'f', 'Y'],
  xiliang: ['blade', 'n', 'N', 'o'],
  taiping: ['talisman', 'y', 'Y', 'R'],
  qingnang: ['pouch', 'G', 'g', 'y'],
  dunjia: ['book', 't', 'c', 'w'],
};

export const HERO_WEAPON_ICON_IDS = Object.keys(SPEC);

function draw(kind: Kind, a: string, b: string, c: string): PixelImage {
  const g = new PixelImage(16, 16);
  switch (kind) {
    case 'sword':
      g.line(4, 11, 12, 3, a); g.line(5, 11, 13, 3, b); g.set(13, 2, 'w');
      g.line(2, 10, 6, 14, c); g.line(2, 13, 3, 14, 'U'); g.set(1, 14, c);
      break;
    case 'dual':
      g.line(3, 11, 11, 3, a); g.line(4, 11, 12, 3, b);
      g.line(12, 11, 4, 3, a); g.line(11, 11, 3, 3, b);
      g.line(1, 10, 4, 13, c); g.line(14, 10, 11, 13, c); g.set(2, 13, 'U'); g.set(13, 13, 'U'); g.set(12, 2, 'w'); g.set(3, 2, 'w');
      break;
    case 'blade':
      // 大刀：斜柄 + 一片上宽下窄的弯刃
      g.line(1, 14, 7, 8, 'U'); g.line(2, 14, 8, 8, 'u');
      for (let i = 0; i < 6; i++) g.rect(7 + i, 7 - i - (i > 1 ? 2 : 1), i > 3 ? 2 : 3, i > 1 ? 4 : 3, a);
      g.line(9, 3, 13, 0, b); g.line(8, 5, 9, 4, b); g.set(14, 0, 'w');
      g.set(7, 9, c); g.set(6, 9, c); g.set(8, 8, c);
      break;
    case 'halberd':
      g.line(1, 14, 10, 5, 'U'); g.line(2, 14, 11, 5, 'u');
      g.line(10, 5, 14, 1, a); g.line(11, 5, 14, 2, b);
      g.rect(7, 2, 3, 2, a); g.line(6, 2, 8, 5, a); g.set(6, 5, b); g.set(9, 7, c); g.set(8, 8, c);
      break;
    case 'hammer':
      g.line(2, 14, 8, 8, 'U'); g.line(3, 14, 9, 8, 'u');
      g.rect(6, 2, 8, 6, a); g.rect(7, 1, 6, 1, a); g.rect(7, 8, 6, 1, a);
      g.rect(6, 4, 8, 1, c); g.rect(7, 2, 2, 2, b); g.set(7, 2, 'w');
      break;
    case 'talisman':
      g.rect(4, 1, 8, 13, 'p'); g.rect(4, 1, 8, 2, a); g.rect(4, 12, 8, 2, a);
      g.line(6, 4, 9, 4, c); g.line(8, 4, 8, 10, c); g.line(6, 7, 10, 7, c); g.line(6, 10, 10, 10, c); g.set(6, 6, b); g.set(10, 9, b);
      g.set(7, 14, a); g.set(8, 15, a);
      break;
    case 'bow':
      g.line(4, 1, 9, 3, a); g.line(9, 3, 11, 8, a); g.line(11, 8, 9, 13, a); g.line(9, 13, 4, 15, a);
      g.line(5, 2, 10, 4, b); g.line(4, 1, 4, 15, 'S');
      g.line(2, 8, 13, 8, 'U'); g.set(14, 8, 'w'); g.set(13, 7, 'S'); g.set(13, 9, 'S'); g.set(2, 7, c); g.set(2, 9, c);
      break;
    case 'orb':
      g.disc(8, 8, 5, a); g.disc(7, 7, 3, b); g.set(6, 6, 'w'); g.set(5, 6, 'w');
      g.line(1, 12, 4, 14, b); g.line(4, 14, 8, 15, a); g.line(8, 15, 12, 14, b); g.line(12, 14, 15, 11, a);
      g.set(13, 3, c); g.set(2, 4, c);
      break;
    case 'spear':
      g.line(1, 14, 10, 5, 'U'); g.line(2, 14, 11, 5, 'u');
      g.line(10, 5, 14, 1, a); g.line(11, 6, 14, 2, a); g.line(11, 4, 14, 1, b); g.set(12, 6, a); g.set(9, 3, a);
      g.set(9, 7, c); g.set(8, 8, c); g.set(10, 8, c); g.set(7, 7, c);
      break;
    case 'firearrow':
      g.line(2, 13, 11, 4, 'U'); g.line(11, 4, 13, 2, 'S'); g.set(14, 1, 'w');
      g.set(1, 12, 'S'); g.set(3, 14, 'S'); g.set(2, 14, 's');
      g.disc(10, 6, 2, c); g.disc(11, 4, 2, a); g.set(11, 3, b); g.set(12, 2, b); g.set(9, 8, a); g.set(8, 6, c);
      break;
    case 'bell':
      g.rect(6, 3, 5, 2, a); g.rect(5, 5, 7, 5, a); g.rect(4, 10, 9, 2, a); g.rect(6, 4, 2, 5, b); g.set(6, 3, 'w');
      g.rect(7, 12, 3, 2, c); g.rect(7, 1, 3, 2, 'U'); g.line(11, 2, 14, 5, c); g.set(14, 6, c);
      break;
    case 'fireorb':
      g.disc(8, 9, 5, c); g.disc(8, 9, 4, a); g.disc(8, 10, 2, b); g.set(8, 10, 'w');
      g.line(8, 1, 6, 5, a); g.line(9, 2, 10, 5, c); g.set(8, 2, b); g.set(5, 4, c); g.set(11, 3, a);
      break;
    case 'fan':
      for (let i = -3; i <= 3; i++) g.line(8, 13, 8 + i * 2, 4 + Math.abs(i), i % 2 ? a : b);
      g.line(2, 7, 8, 3, a); g.line(8, 3, 14, 7, a); g.rect(7, 12, 3, 2, c); g.set(8, 14, 'Y');
      break;
    case 'ribbon':
      g.line(1, 4, 5, 2, a); g.line(5, 2, 9, 5, a); g.line(9, 5, 6, 9, b); g.line(6, 9, 10, 12, a); g.line(10, 12, 14, 10, b);
      g.line(1, 5, 5, 3, b); g.line(5, 3, 9, 6, b); g.line(9, 6, 6, 10, a); g.line(6, 10, 10, 13, b); g.line(10, 13, 14, 11, a);
      g.set(14, 9, c); g.set(1, 3, c);
      break;
    case 'pouch':
      g.disc(8, 10, 5, a); g.disc(7, 9, 3, b); g.rect(6, 3, 5, 3, a); g.rect(5, 5, 7, 1, c); g.set(6, 8, 'w');
      g.rect(7, 1, 3, 2, 'U'); g.line(11, 2, 13, 4, c);
      break;
    case 'book':
      g.rect(3, 2, 10, 12, a); g.rect(4, 3, 8, 10, 'p'); g.rect(3, 2, 2, 12, a);
      g.ring(8, 8, 3, a); g.line(6, 8, 10, 8, b); g.set(8, 6, 'k'); g.set(8, 10, 'w'); g.set(7, 7, b); g.set(9, 9, b);
      break;
  }
  return g;
}

export function heroWeaponIcon(id: string, evo: boolean): PixelImage | null {
  const sp = SPEC[id];
  if (!sp) return null;
  let img = evo ? draw(sp[0], 'y', 'Y', sp[3]) : draw(sp[0], sp[1], sp[2], sp[3]);
  if (evo) {
    // 四角闪光
    for (const [x, y] of [[1, 1], [14, 13], [14, 2], [1, 9]]) if (img.get(x, y) === '.') img.set(x, y, 'w');
    img.set(2, 1, 'Y'); img.set(1, 2, 'Y');
  }
  img = img.outline();
  return img;
}
