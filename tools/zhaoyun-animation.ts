// 独立造型试作；尚未接入正式图集。与现有角色同为 32×32、4 帧。
import { PixelImage } from '../src/gfx/pixel';
import { PALETTE } from '../src/gfx/palette';
import { heroFramesFor } from '../src/gfx/art/heroes';
import { saddle } from '../src/gfx/art/horse';

const HORSE = [
  '................ss....',
  '...............sSwS...',
  '..............SwwwS...',
  '.............SwwwkwS..',
  '............SwwUSwwwS.',
  '...........SSwwUwSwwN.',
  '...ss.....SSwwwUUwwSN.',
  '..sSSs..SSwwwwwUSSS...',
  '.sSS.SwwwwwwwwwwS.....',
  'SS..SwwwwwwwwwwwwS....',
  'S...Swwwwwwwwwwws.....',
  '....SSwwwwwwwwsss.....',
  '.....sSSSsssSSSs......',
];

const LEGS = [
  ['.....NN....NS.SS......', '.....N.N...N.S..S.....', '....N..N...N....w.....', '....k..k...k....U.....'],
  ['....NN....NN.SS.......', '...N..N....N..SS......', '..N....N...N...w......', '..k....k....k..U......'],
  ['.....NN...NN.SS.......', '......NN.N...SS.......', '.......N.N..w.w.......', '.......k.k..U.U.......'],
  ['.....NN....N.SS.......', '......N....N.S.S......', '.....N.N...N.w..w.....', '.....k..k..k.U..U.....'],
];

const RIDER = [
  '......RR......',
  '.....RRr......',
  '.....r........',
  '....NNSS......',
  '...NSSwwS.....',
  '...NSqqkq.....',
  '...nSqqqq.....',
  '....nSSq......',
  '....nNSNS.....',
  '....nSSSNqq...',
  '....nNSSNqq...',
  '....nNSSNN....',
  '....UyyyyU....',
  '....nSSnn.....',
  '.....SnNU.....',
  '.....nNU......',
  '......UU......',
];

const CAPE = ['......nn', '....nnbb', '..nnbbbb', '.nbbbbBn', 'nbbbBbn.', 'nbbbnn..', 'nbnn....', 'nn......'];

function trialFrame(f: number): PixelImage {
  const bob = f === 1 || f === 3 ? 1 : 0;
  const c = new PixelImage(30, 30);
  c.blit(PixelImage.fromRows(HORSE.concat(LEGS[f])), 3, 12 + bob);
  c.blit(saddle('U', 'u'), 8, 19 + bob);
  c.blit(PixelImage.fromRows(CAPE), 2, 10 + bob + [0, 1, 0, -1][f]);
  c.blit(PixelImage.fromRows(RIDER), 7, 3 + bob);
  // 枪与握枪手对齐，枪头完整留在画布内。
  c.line(16, 14 + bob, 27, 4 + bob, 'N');
  c.line(17, 13 + bob, 28, 3 + bob, 'S');
  c.line(27, 4 + bob, 29, 1 + bob, 'w');
  c.set(28, 2 + bob, 'S');
  c.set(26, 5 + bob, 'R'); c.set(27, 5 + bob, 'R'); c.set(27, 6 + bob, 'r');
  return c.outline();
}

const serialize = (img: PixelImage) => ({ w: img.w, h: img.h, pixels: img.px.join('') });
export const animationPreview = {
  palette: PALETTE,
  original: heroFramesFor('zhaoyun').map(serialize),
  trial: [0, 1, 2, 3].map((f) => serialize(trialFrame(f))),
};
