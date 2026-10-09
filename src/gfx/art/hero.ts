import { PixelImage } from '../pixel';
import { horseFrame, saddle } from './horse';

// 赵云：银盔红缨、白袍银甲、青色披风，骑白马持亮银枪。

const RIDER = [
  '......RR....',
  '.....RRr....',
  '.....Rr.....',
  '....SSSS....',
  '...SwSSSS...',
  '...SSqqkq...',
  '...SSqqqq...',
  '..GGSSqq....',
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

export function riderImage(colors?: Record<string, string>): PixelImage {
  const r = PixelImage.fromRows(RIDER);
  return colors ? r.recolor(colors) : r;
}

/** 长枪：从握把向右上方延伸 */
export function spear(len: number, shaft: string, head: string, tassel: string): PixelImage {
  const img = new PixelImage(len + 4, 10);
  const x0 = 0, y0 = 9;
  const x1 = len, y1 = 9 - Math.round(len * 0.45);
  img.line(x0, y0, x1, y1, shaft);
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
  horse: 'white' | 'brown' | 'black' | 'ghost' | 'gold';
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
  canvas.blit(horseFrame(f, opts.horse), 4, H + bob);
  canvas.blit(saddle(opts.cloth, opts.trim), 7, H + 7 + bob);
  canvas.blit(opts.rider, 7, H - 8 + bob);
  if (opts.weapon) canvas.blit(opts.weapon, opts.weaponX ?? 15, (opts.weaponY ?? H - 8) + bob);
  return canvas.outline();
}

export function heroFrames(): PixelImage[] {
  const rider = riderImage();
  const sp = spear(13, 'S', 'w', 'R');
  return [0, 1, 2, 3].map((f) => mountedFrame({ frame: f, horse: 'white', rider, cloth: 'G', trim: 'y', weapon: sp, weaponX: 16, weaponY: 2 }));
}
