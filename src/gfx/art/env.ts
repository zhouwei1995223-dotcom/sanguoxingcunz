import { PixelImage, art } from '../pixel';

// 场景装饰与地表主题

export const tree = () => art([
  '....GGGG....',
  '..GGgggGGG..',
  '.GggggggggG.',
  'GggYgggggggG',
  'GgggggggYggG',
  'GGgggggggGGd',
  '.dGGggggGGd.',
  '..ddGGGGdd..',
  '....dUUd....',
  '.....Uz.....',
  '.....Uz.....',
  '....UUzz....',
]);

export const pine = () => art([
  '.....G.....',
  '....GgG....',
  '...GgggG...',
  '....GgG....',
  '..GggggdG..',
  '.GggggggdG.',
  '...GggddG..',
  '.GGgggggddG',
  'GgggggggdddG',
  '....UzU....',
  '....Uz.....',
]);

export const bush = () => art([
  '..GGG.GG.',
  '.GgggGggG',
  'GggYggggG',
  'GggggggdG',
  '.ddGGddd.',
]);

export const rock = () => art([
  '...NNN..',
  '..NsSsN.',
  '.NssSssN',
  'NNsssssN',
  'nNNNNNNn',
]);

export const bigRock = () => art([
  '....NNNN.....',
  '..NNsSSsNN...',
  '.NsssSSsssN..',
  'NsssssssssNN.',
  'NNssssssNsssN',
  'nNNsssNNNssNn',
  '.nnNNNNNNNNn.',
]);

export const grass = () => PixelImage.fromRows([
  '.g...g.',
  '.g.g.g.',
  'Gg.gGg.',
  'GG.GGG.',
]);

export const flower = (c: string) => PixelImage.fromRows([
  `.${c}.`,
  `${c}Y${c}`,
  `.${c}.`,
  '.G.',
]);

export const reeds = () => PixelImage.fromRows([
  '.U...U.',
  '.U.U.U.',
  '.g.U.g.',
  'Gg.g.gG',
  'GG.GGG.',
]);

export const deadTree = () => art([
  '.U.....U..',
  '..U...U...',
  '..UU.UU.U.',
  '...UUUUU..',
  '....UzU...',
  '....Uz....',
  '....Uz....',
  '...UUzz...',
]);

export const banner = (c: string) => art([
  'U' + c + c + c + c,
  'U' + c + 'YY' + c,
  'U' + c + 'Y' + c + c,
  'U' + c + c + c + '.',
  'U' + c + c + '..',
  'U....',
  'U....',
  'U....',
  'UU...',
]);

export const bones = () => PixelImage.fromRows([
  'w...w.',
  '.wSw..',
  '..S...',
  '.wSw.S',
  'w...SS',
]);

export const stumps = () => art([
  '.UUU.',
  'UuuuU',
  'UUUUU',
  '.zzz.',
]);

export interface GroundTheme {
  base: string;
  dark: string;
  light: string;
  accent: string;
  /** 装饰物：名字 + 权重 */
  decor: [string, number][];
  /** 装饰换色 */
  recolor?: Record<string, string>;
  fog: string; // 屏幕边缘暗角颜色
}

export const THEMES: Record<string, GroundTheme> = {
  changban: {
    base: '#5b8a3c', dark: '#4a7431', light: '#76a64a', accent: '#a4b85a',
    decor: [['grass', 30], ['flowerR', 6], ['flowerY', 6], ['bush', 8], ['tree', 6], ['rock', 5], ['banner', 2], ['stumps', 3]],
    fog: 'rgba(20,30,10,0.35)',
  },
  guiyang: {
    base: '#3f6b40', dark: '#335a35', light: '#4f8050', accent: '#6b8f3a',
    decor: [['grass', 25], ['pine', 10], ['tree', 10], ['bush', 12], ['rock', 4], ['flowerM', 5], ['stumps', 4]],
    fog: 'rgba(10,25,15,0.4)',
  },
  hanshui: {
    base: '#b49a68', dark: '#9e845a', light: '#c8b07c', accent: '#8a9a58',
    decor: [['reeds', 22], ['rock', 10], ['bigRock', 4], ['deadTree', 4], ['bones', 3], ['grass', 10], ['banner', 2]],
    recolor: { g: 'L', G: 'u' },
    fog: 'rgba(40,30,10,0.3)',
  },
  fengming: {
    base: '#7a6f66', dark: '#665c55', light: '#8f857b', accent: '#5f7a4a',
    decor: [['rock', 16], ['bigRock', 8], ['deadTree', 6], ['pine', 6], ['grass', 8], ['bones', 3]],
    recolor: { g: 'G', G: 'd' },
    fog: 'rgba(30,20,30,0.4)',
  },
  jigu: {
    base: '#d8dfe8', dark: '#bcc6d4', light: '#eef2f6', accent: '#a9b6c8',
    decor: [['pine', 14], ['rock', 10], ['bigRock', 5], ['deadTree', 5], ['stumps', 4]],
    recolor: { g: 'S', Y: 'w', G: 'N', d: 'n' },
    fog: 'rgba(30,40,60,0.3)',
  },
};

export function decorImage(name: string): PixelImage {
  switch (name) {
    case 'tree': return tree();
    case 'pine': return pine();
    case 'bush': return bush();
    case 'rock': return rock();
    case 'bigRock': return bigRock();
    case 'grass': return grass();
    case 'flowerR': return flower('R');
    case 'flowerY': return flower('Y');
    case 'flowerM': return flower('M');
    case 'reeds': return reeds();
    case 'deadTree': return deadTree();
    case 'banner': return banner('b');
    case 'bones': return bones();
    case 'stumps': return stumps();
  }
  return grass();
}
