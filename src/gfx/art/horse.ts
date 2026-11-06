import { PixelImage } from '../pixel';
import { NEW_UI } from '../../data/platformConfig';

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

/** NEW_UI 精细三层体积光战马：包含高光段(H)、亮主色(w)、过渡色(S)、腹暗部(s)、深暗部(N)、络头金饰(Y/R) */
const BODY_FINE = [
  '..............SS....',
  '.............SwHS...',
  '............SHHHHRS.',
  '...........SHHHwkYS.',
  '..........SHHHHHRYwS',
  '.........SSHHUHHRRRN',
  '..SS....SSHHHUURSSN.',
  '.SwwS..SSHHHHwUS....',
  'SwS.SHHHHHwwwwHS....',
  'Ss..wHHHHwwwwwwS....',
  's...SwwwwwwSSSSs....',
  's...SSssssssSSSss...',
  '.....sNNNNNssNNs....',
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

/** NEW_UI 战马三层体积光配色表：H=受光高光, w=中亮部, S=中暗过渡, s=腹腿暗部, N=深暗蹄部 */
const FINE_COLOR_MAPS: Record<HorseColor, Record<string, string>> = {
  white: { H: 'w', w: 'w', S: 'S', s: 's', N: 'N', R: 'R', Y: 'Y' },
  brown: { H: 'q', w: 'L', S: 'u', s: 'U', N: 'z', R: 'R', Y: 'Y' },
  black: { H: 's', w: 'N', S: 'n', s: 'K', N: 'k', R: 'R', Y: 'Y', k: 'y' },
  ghost: { H: 'w', w: 'c', S: 'B', s: 'b', N: 'n', R: 'Y', Y: 'w', k: 'w' },
  gold:  { H: 'w', w: 'Y', S: 'y', s: 'o', N: 'U', R: 'R', Y: 'w' },
  red:   { H: 'f', w: 'R', S: 'l', s: 'r', N: 'z', U: 'Y', R: 'Y', Y: 'Y', k: 'Y' },
};

export function horseFrame(frame: number, color: HorseColor): PixelImage {
  if (!NEW_UI) {
    const img = PixelImage.fromRows(BODY.concat(LEGS[frame % 4]));
    return img.recolor(COLOR_MAPS[color]);
  }
  const img = PixelImage.fromRows(BODY_FINE.concat(LEGS[frame % 4]));
  return img.recolor(FINE_COLOR_MAPS[color]);
}

/** 马鞍和马鞍布，叠在马背上 */
export function saddle(cloth: string, trim: string): PixelImage {
  if (!NEW_UI) {
    return PixelImage.fromRows([
      `..${trim}${trim}${trim}${trim}${trim}..`,
      `.${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}.`,
      `.${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}.`,
      `..${trim}${cloth}${trim}${cloth}${trim}..`,
    ]);
  }
  return PixelImage.fromRows([
    `.y${trim}${trim}${trim}${trim}${trim}y.`,
    `${trim}${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}${cloth}${trim}`,
    `.${trim}${cloth}${cloth}${cloth}${cloth}${cloth}${trim}.`,
    `..${trim}.${trim}.${trim}..`,
  ]);
}
