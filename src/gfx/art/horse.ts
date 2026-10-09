import { PixelImage } from '../pixel';

// 战马（面朝右）。身体 + 4 帧腿部动画，可换色得到白马 / 枣红马 / 黑马 / 灵马。

const BODY = [
  '..............ss....',
  '.............sSws...',
  '............SwwwwS..',
  '...........SwwwwkwS.',
  '..........SwwwwwwwwS',
  '.........SSwwUwwwwwN',
  '..ss....SSwwwUUSSSN.',
  '.sSSs..SSwwwwwUS....',
  'sSS.SwwwwwwwwwwS....',
  'SS..wwwwwwwwwwwwS...',
  'S...Swwwwwwwwwwws...',
  'S...SSwwwwwwwwwss...',
  '.....sSSSsssSSSs....',
];

const LEGS: string[][] = [
  [
    '.....ss.s..ss.s.....',
    '.....s..s..s..s.....',
    '.....s..s..s..s.....',
    '.....N..N..N..N.....',
  ],
  [
    '....ss...s.s..ss....',
    '...s.....s.s....s...',
    '..s......s.s.....s..',
    '..N......N.N.....N..',
  ],
  [
    '.....sss...sss......',
    '.....s..s..s..s.....',
    '....s...s..s...s....',
    '....N...N..N...N....',
  ],
  [
    '.....s.ss...s.ss....',
    '......s.s...s..s....',
    '......s..s..s...s...',
    '......N..N..N...N...',
  ],
];

export type HorseColor = 'white' | 'brown' | 'black' | 'ghost' | 'gold' | 'red';

const COLOR_MAPS: Record<HorseColor, Record<string, string>> = {
  white: {},
  brown: { w: 'u', S: 'U', s: 'z', N: 'k', R: 'y' },
  black: { w: 'n', S: 'K', s: 'k', N: 'k', R: 'R', k: 'R' },
  ghost: { w: 'c', S: 'B', s: 'b', N: 'b', R: 'w', k: 'w' },
  gold: { w: 'Y', S: 'y', s: 'o', N: 'U', R: 'R' },
  red: { w: 'l', S: 'r', s: 'z', N: 'k', U: 'Y', k: 'Y' },
};

export function horseFrame(frame: number, color: HorseColor): PixelImage {
  const img = PixelImage.fromRows(BODY.concat(LEGS[frame % 4]));
  return img.recolor(COLOR_MAPS[color]);
}

/** 马鞍和马鞍布，叠在马背上 */
export function saddle(cloth: string, trim: string): PixelImage {
  return PixelImage.fromRows([
    `..${trim}${trim}${trim}${trim}${trim}..`,
    `.${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}.`,
    `.${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}.`,
    `..${trim}${cloth}${trim}${cloth}${trim}..`,
  ]);
}
