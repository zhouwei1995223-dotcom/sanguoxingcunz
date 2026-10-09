import { PixelImage, art } from '../pixel';

// 掉落物、投射物、特效等小件像素图。

export function gem(kind: 0 | 1 | 2): PixelImage {
  const map = [
    { a: 'B', b: 'c', c: 'b' },
    { a: 'g', b: 'Y', c: 'G' },
    { a: 'R', b: 'f', c: 'r' },
  ][kind];
  return art([
    '.A.',
    'ABA',
    'CAC',
    '.C.',
  ].map((r) => r.replace(/A/g, map.a).replace(/B/g, map.b).replace(/C/g, map.c)));
}

export function coinFrames(): PixelImage[] {
  return [
    art(['.yy.', 'yYyy', 'yYyy', 'yyyo', '.oo.']),
    art(['.y.', 'yYy', 'yYy', 'yyo', '.o.']),
    art(['y', 'Y', 'y', 'o', 'o']),
    art(['.y.', 'yyY', 'yyY', 'oyy', '.o.']),
  ];
}

/** 元宝 */
export const yuanbao = () => art([
  'y.....y',
  'yY.Y.Yy',
  'yYYYYYy',
  '.yyyyy.',
  '..ooo..',
]);

/** 肉包子：回血 */
export const bun = () => art([
  '...w...',
  '..wSw..',
  '.wwwww.',
  'wwwwwwS',
  'SwwwwSS',
  '.SSSSS.',
]);

/** 磁石：吸取全部经验 */
export const magnet = () => art([
  'RR..RR',
  'RR..RR',
  'RR..RR',
  'RRrrRR',
  '.rRRr.',
  'SS..SS',
]);

/** 震天雷：清屏炸弹 */
export const bomb = () => art([
  '....y.',
  '...oY.',
  '..U...',
  '.kkk..',
  'kKNKk.',
  'kKKKk.',
  'kkKkk.',
  '.kkk..',
]);

export function chest(open: boolean, gold = false): PixelImage {
  const main = gold ? 'y' : 'u';
  const dark = gold ? 'o' : 'U';
  const rows = open
    ? [
        '.WWWWWWWWW.',
        'W.........W',
        'MDDDDDDDDDM',
        'MYYYYYYYYYM',
        'MMMMYYYMMMM',
        'MDDDYyYDDDM',
        'MMMMMMMMMMM',
        'DDDDDDDDDDD',
      ]
    : [
        '.MMMMMMMMM.',
        'MMMMMMMMMMM',
        'MDDDDDDDDDM',
        'MMMMYYYMMMM',
        'MMMMYyYMMMM',
        'MDDDDDDDDDM',
        'MMMMMMMMMMM',
        'DDDDDDDDDDD',
      ];
  return art(rows.map((r) => r.replace(/M/g, main).replace(/D/g, dark).replace(/W/g, 'Y')));
}

/** 灯笼（可破坏物），2 帧摇曳 */
export function lanternFrames(): PixelImage[] {
  const base = [
    '..U..',
    '.yyy.',
    'RRRRR',
    'RxRRR',
    'RxRRR',
    'RRRRr',
    '.yyy.',
    '..y..',
  ];
  return [art(base), art(base.map((r, i) => (i > 2 && i < 6 ? r.replace('x', 'Y') : r)))];
}

/** 粮车（可破坏物） */
export const cart = () => art([
  '..pppppp..',
  '.pEpEpEpp.',
  'UuuuuuuuuU',
  'UUUUUUUUUU',
  '.kNk..kNk.',
  '.kkk..kkk.',
]);

// —— 投射物 ——
export const arrow = () => art(['UUUUUS', '.....'], false).outline('k');
export const bolt = () => PixelImage.fromRows(['UUUUSw']);
export const flyingSword = () => PixelImage.fromRows([
  '..........c.',
  '.y.......cw.',
  'yUSSSSSSwwc.',
  '.y......cc..',
]).outline('b');
export const firePot = () => art([
  '.y.',
  'UUU',
  'uLu',
  'uuu',
  '.U.',
]);
export function flameFrames(): PixelImage[] {
  return [
    art(['..y..', '.yYy.', 'oyYyo', 'oyYYo', '.ooo.'], false),
    art(['.y...', '.yy..', 'oyYy.', 'oyYyo', '.ooo.'], false),
    art(['...y.', '..yy.', '.yYyo', 'oyYyo', '.ooo.'], false),
  ];
}
export const stone = () => art(['.NN.', 'NsSN', 'NssN', '.NN.']);
export const forkProj = () => art(['S.S.S', 'SSSSS', '..U..', '..U..', '..U..']);

// —— 特效 ——
export function sparkFrames(): PixelImage[] {
  return [
    PixelImage.fromRows(['..w..', '..w..', 'wwYww', '..w..', '..w..']),
    PixelImage.fromRows(['w...w', '.w.w.', '..Y..', '.w.w.', 'w...w']),
    PixelImage.fromRows(['.....', '.y.y.', '.....', '.y.y.', '.....']),
  ];
}

export function puffFrames(): PixelImage[] {
  const out: PixelImage[] = [];
  for (let i = 0; i < 4; i++) {
    const p = new PixelImage(13, 13);
    const r = 2 + i * 1.5;
    p.disc(6, 6, r, i < 2 ? 'S' : 's');
    if (i > 0) p.disc(6, 6, r - 1.5, i < 2 ? 'w' : '.');
    if (i === 3) p.disc(6, 6, r - 0.5, '.');
    out.push(p);
  }
  return out;
}

export function explosionFrames(): PixelImage[] {
  const out: PixelImage[] = [];
  const cols = ['Y', 'y', 'o', 'R'];
  for (let i = 0; i < 5; i++) {
    const p = new PixelImage(41, 41);
    const r = 5 + i * 4;
    p.disc(20, 20, r, cols[Math.min(i, 3)]);
    p.disc(20, 20, Math.max(0, r - 4), i < 2 ? 'w' : cols[Math.max(0, i - 2)]);
    if (i >= 3) p.disc(20, 20, r - 6, '.');
    out.push(p);
  }
  return out;
}

export const shadow = (w: number) => {
  const p = new PixelImage(w, 3);
  p.rect(1, 0, w - 2, 3, 'h');
  p.rect(0, 1, w, 1, 'h');
  return p;
};

/** 3x5 像素数字（伤害跳字） */
const DIGITS: Record<string, string[]> = {
  '0': ['www', 'w.w', 'w.w', 'w.w', 'www'],
  '1': ['.w.', 'ww.', '.w.', '.w.', 'www'],
  '2': ['www', '..w', 'www', 'w..', 'www'],
  '3': ['www', '..w', 'www', '..w', 'www'],
  '4': ['w.w', 'w.w', 'www', '..w', '..w'],
  '5': ['www', 'w..', 'www', '..w', 'www'],
  '6': ['www', 'w..', 'www', 'w.w', 'www'],
  '7': ['www', '..w', '.w.', '.w.', '.w.'],
  '8': ['www', 'w.w', 'www', 'w.w', 'www'],
  '9': ['www', 'w.w', 'www', '..w', 'www'],
  '+': ['...', '.w.', 'www', '.w.', '...'],
};
export function digit(ch: string, color: string): PixelImage {
  return PixelImage.fromRows(DIGITS[ch]).recolor({ w: color }).outline('k', true);
}
export const DIGIT_CHARS = Object.keys(DIGITS);
