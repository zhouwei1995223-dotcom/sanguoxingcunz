import { PixelImage } from '../pixel';
import { horseFrame, saddle } from './horse';
import { NEW_UI } from '../../data/platformConfig';

// 赵云与通用骑将骨架：银盔红缨、白袍银甲、披风，骑战马持神兵。

const RIDER = [
  '......RR....',
  '.....RRr....',
  '.....Rr.....',
  '....SSSS....',
  '...SwSSSS...',
  '...SSqqkq...',
  '...SSqqkE...',
  '..GGSSqE....',
  '.GGgSwwwS...',
  'GGgSwSSwSqq.',
  'Gg.SSwwwSqq.',
  'G..SwwwwS...',
  '...nyyyyn...',
  '...SSwwSS...',
  '....SwwS....',
  '....Snn.....',
  '....nn......',
];

/** NEW_UI 精细三层体积光骑将骨架：盔缨高光、兜鍪眉庇金边、护心明光镜、披风三阶渐变 */
const RIDER_FINE = [
  '.....fRR....',
  '....fRRr....',
  '.....Rr.....',
  '....wSSs....',
  '...SwwSSs...',
  '...syqqkq...',
  '...sNqqkE...',
  '..ggSSqE....',
  '.ggGSwwws...',
  'gGGSwYwwSqq.',
  'Gd.SswwwSEq.',
  'd..Swwwws...',
  '...nyYYyn...',
  '...SwSSsN...',
  '....SwsN....',
  '....SnK.....',
  '....nK......',
];

export function riderImage(colors?: Record<string, string>): PixelImage {
  const r = PixelImage.fromRows(NEW_UI ? RIDER_FINE : RIDER);
  if (!colors) return r;
  if (!NEW_UI) return r.recolor(colors);
  // 精细模式下自动推导三层体积光（亮高光 / 主色 / 暗部）映射
  const fineMap: Record<string, string> = { ...colors };
  if (colors.R === 'G' && !colors.f) fineMap.f = 'g';
  else if (colors.R === 'c' && !colors.f) fineMap.f = 'w';
  else if (colors.R === 'w' && !colors.f) fineMap.f = 'w';
  else if (colors.R === '.' && !colors.f) fineMap.f = '.';
  if (colors.G === 'b' && !colors.d) fineMap.d = 'n';
  else if (colors.G === 'M' && !colors.d) fineMap.d = 'm';
  else if (colors.G === 'r' && !colors.d) fineMap.d = 'z';
  else if (colors.G === 'U' && !colors.d) fineMap.d = 'z';
  else if (colors.G === 'z' && !colors.d) fineMap.d = 'k';
  if (colors.S && !colors.s) {
    const sm: Record<string, string> = { G: 'd', n: 'K', K: 'k', y: 'o', u: 'U', z: 'k' };
    if (sm[colors.S]) fineMap.s = sm[colors.S];
  }
  return r.recolor(fineMap);
}

/** 长枪：从握把向右上方延伸 */
export function spear(len: number, shaft: string, head: string, tassel: string): PixelImage {
  const img = new PixelImage(len + 4, 10);
  const x0 = 0, y0 = 9;
  const x1 = len, y1 = 9 - Math.round(len * 0.45);
  img.line(x0, y0, x1, y1, shaft);
  if (NEW_UI) {
    // 双层立体枪杆 + 黄金吞口 + 蓬松红缨 + 宽刃菱形枪尖
    const darkShaft = shaft === 'S' ? 's' : shaft === 'y' ? 'o' : 'U';
    img.line(x0, y0 + 1, x1 - 1, y1 + 1, darkShaft);
    img.set(x1, y1, 'Y');
    img.set(x1 - 1, y1 + 1, tassel); img.set(x1 - 2, y1 + 1, tassel); img.set(x1 - 1, y1 + 2, tassel); img.set(x1 - 2, y1 + 2, tassel === 'R' ? 'r' : tassel);
    img.set(x1 + 1, y1, head); img.set(x1 + 2, y1 - 1, head); img.set(x1 + 1, y1 - 1, 'w');
    img.set(x1 + 2, y1, head === 'w' ? 'S' : head); img.set(x1 + 3, y1 - 1, 'w');
    img.set(x1, y1 - 1, 'w');
    return img;
  }
  // 枪头
  img.set(x1 + 1, y1, head); img.set(x1 + 2, y1 - 1, head); img.set(x1 + 1, y1 - 1, head); img.set(x1 + 3, y1 - 1, 'w');
  img.set(x1, y1 - 1, head);
  // 红缨
  img.set(x1 - 1, y1 + 1, tassel); img.set(x1 - 2, y1 + 1, tassel); img.set(x1 - 1, y1 + 2, tassel);
  return img;
}

/** 组合骑将：马 + 鞍 + 骑手 + 兵器，返回带描边的帧 */
export function mountedFrame(opts: {
  frame: number;
  horse: 'white' | 'brown' | 'black' | 'ghost' | 'gold' | 'red' | 'cart';
  rider: PixelImage;
  cloth: string;
  trim: string;
  weapon?: PixelImage;
  weaponX?: number;
  weaponY?: number;
}): PixelImage {
  const f = opts.frame;
  const bob = f === 1 || f === 3 ? 1 : 0;
  const canvas = new PixelImage(30, 30);
  const H = 12; // 马在画布中的纵向偏移
  if (opts.horse === 'cart') canvas.blit(cartFrame(f), 3, H + 5);
  else {
    canvas.blit(horseFrame(f, opts.horse), 4, H + bob);
    canvas.blit(saddle(opts.cloth, opts.trim), 7, H + 7 + bob);
  }
  canvas.blit(opts.rider, 7, H - 8 + bob);
  if (opts.weapon) canvas.blit(opts.weapon, opts.weaponX ?? 15, (opts.weaponY ?? H - 8) + bob);
  return canvas.outline();
}

export function heroFrames(): PixelImage[] {
  const rider = riderImage();
  const sp = spear(13, 'S', 'w', 'R');
  return [0, 1, 2, 3].map((f) => mountedFrame({ frame: f, horse: 'white', rider, cloth: 'G', trim: 'y', weapon: sp, weaponX: 16, weaponY: 2 }));
}

/** 诸葛亮的四轮车：车轮转动 4 帧 */
export function cartFrame(f: number): PixelImage {
  const img = PixelImage.fromRows(NEW_UI ? [
    '.yYYYYYYYYYYYYYYy...',
    'UqqqqqqqqqqqqqqqqU..',
    'UuuuuuuuuuuuuuuuuU..',
    'UUUUUUUUUUUUUUUUUU..',
    '.U..............U...',
  ] : [
    '.UUUUUUUUUUUUUUUU...',
    'UuuuuuuuuuuuuuuuuU..',
    'UUUUUUUUUUUUUUUUUU..',
    '.U..............U...',
  ]);
  const c = new PixelImage(22, 13);
  c.blit(img, 0, 0);
  for (const wx of [4, 15]) {
    c.ring(wx, 8, 4, 'z');
    if (NEW_UI) c.ring(wx, 8, 3, 'U');
    c.disc(wx, 8, 1, NEW_UI ? 'Y' : 'U');
    const a = (f * Math.PI) / 4;
    c.line(Math.round(wx - Math.cos(a) * 3), Math.round(8 - Math.sin(a) * 3), Math.round(wx + Math.cos(a) * 3), Math.round(8 + Math.sin(a) * 3), NEW_UI ? 'q' : 'u');
    c.line(Math.round(wx + Math.sin(a) * 3), Math.round(8 - Math.cos(a) * 3), Math.round(wx - Math.sin(a) * 3), Math.round(8 + Math.cos(a) * 3), 'u');
  }
  return c;
}
