import { PixelImage } from '../pixel';

// 赵云新造型（预览中，确认后再接入游戏）：
// 银盔红缨、白袍银甲、蓝色披风，骑照夜玉狮子（白马），持亮银枪。
// 马腿按奔跑节奏画 4 帧，披风、红缨、马鬃、马尾随帧飘动。

const W = 38, H = 35;

/** 马身（不含腿），面朝右；x 偏移 4，y 偏移 11 */
const HORSE_BODY = [
  '......................ss......',
  '.....................sSs......',
  '...................SSwwwS.....',
  '.................SSwwwwkwS....',
  '................SwwwwwwwwwS...',
  '...............SwwwwwSSwwwwS..',
  '..............SwwwwwS..SwwwwS.',
  '.............SwwwwwS....SwwsS.',
  '.....SSSSSSSSwwwwwS......SSS..',
  '....SwwwwwwwwwwwwwwwS.........',
  '...SwwwwwwwwwwwwwwwwS.........',
  '...SwwwwwwwwwwwwwwwwS.........',
  '...SwwwwwwwwwwwwwwwS..........',
  '...SSwwwwwwwwwwwwwSS..........',
  '....sSSSwwwwwwwSSSs...........',
];

/** 马鬃：沿脖子后缘飘动（2 种） */
const MANE = [
  ['......sS', '.....sS.', '....sSs.', '...sS...', '..sS....'],
  ['.....sS.', '....sSS.', '...sSs..', '..sS....', '.sS.....'],
];

/** 马尾（2 种） */
const TAIL = [
  ['..sSs', '.sSSs', 'sSSs.', 'SSs..', 'Ss...', 's....'],
  ['.....', '.sSSs', 'sSSSs', 'SSs..', 'sSs..', '.s...'],
];

/** 蓝色披风，从肩后向左飘（2 种） */
const CAPE = [
  ['....bB', '...bBB', '..bBBb', '.bBBb.', 'bBBb..', 'bBb...', 'bb....'],
  ['.....b', '...bBB', '.bbBBb', 'bBBBb.', '.bBBb.', '..bBb.', '...bb.'],
];

/** 骑手：口袋妖怪地图小人比例（大圆头 + 小身体），银盔像帽子一样有帽檐，3/4 正脸 */
const RIDER = [
  '......RR........',
  '.....RRrR.......',
  '......Rr........',
  '....SSSSSSS.....',
  '...SwwSSSSSS....',
  '..SwwSSSSSSSs...',
  '..SSSSSSSSSSs...',
  '..ssyYysssssss..',
  '..kkkkkkkkkkk...',
  '..kqqqqqqqqqk...',
  '..kqzzqqqzzqq...',
  '..kqkqqqqqkqq...',
  '..kqkqqqqqkqE...',
  '..kqqqqqqEqqE...',
  '...qqqqUUqqE....',
  '....qqqqqqE.....',
  '...SSnwwnSS.....',
  '..SSsSSSSsSS....',
  '.SSsSwwwSsSSqq..',
  '.SsSyyyyyySSqq..',
  '..SbBBBBBBbS....',
  '..SwwwwwwwwS....',
  '...wwwSSwww.....',
];

/**
 * 口袋妖怪式体积光：光从左上方来。每种材质有「亮 / 中 / 暗」三层，
 * 上边缘提亮，下边缘与右边缘压暗，眼睛眉毛等细节不参与。
 */
const RAMPS: Record<string, [string, string]> = {
  S: ['w', 's'], w: ['w', 'S'], B: ['B', 'b'], q: ['q', 'E'], R: ['f', 'r'], y: ['Y', 'y'],
};

function shadeVolume(img: PixelImage): PixelImage {
  const out = img.clone();
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const c = img.get(x, y);
      const ramp = RAMPS[c];
      if (!ramp) continue;
      const up = img.get(x, y - 1), down = img.get(x, y + 1), right = img.get(x + 1, y), left = img.get(x - 1, y);
      if (down !== c && (down === '.' || RAMPS[down])) out.set(x, y, ramp[1]);
      else if (right === '.') out.set(x, y, ramp[1]);
      else if ((up === '.' || left === '.') && c !== 'w') out.set(x, y, ramp[0]);
    }
  return out;
}

/** 腿：每条腿 [膝 dx, 膝 dy, 蹄 dx, 蹄 dy]，顺序：后腿近、后腿远、前腿近、前腿远 */
const LEG_POSES: number[][][] = [
  [[-2, 3, -5, 6], [-1, 3, -3, 7], [2, 3, 5, 6], [1, 3, 3, 7]], // 伸展
  [[0, 3, 1, 7], [1, 3, 3, 7], [0, 3, -1, 7], [-1, 3, -2, 7]], // 收拢
  [[-1, 4, -2, 7], [1, 3, 1, 7], [1, 3, 2, 7], [2, 3, 4, 6]], // 落地
  [[1, 3, 2, 7], [0, 3, -1, 7], [-1, 3, 0, 7], [1, 4, 1, 7]], // 收拢 2
];

function leg(img: PixelImage, x: number, y: number, p: number[], color: string) {
  const [kx, ky, hx, hy] = p;
  for (const dx of [0, 1]) {
    img.line(x + dx, y, x + kx + dx, y + ky, color);
    img.line(x + kx + dx, y + ky, x + hx + dx, y + hy, color);
  }
  img.set(x + hx, y + hy, 'N');
  img.set(x + hx + 1, y + hy, 'N');
}

/** 亮银枪：枪杆、枪头、红缨 */
function silverSpear(): PixelImage {
  const img = new PixelImage(20, 11);
  img.line(0, 10, 16, 2, 'S');
  img.line(1, 10, 17, 2, 's');
  // 枪头
  img.set(17, 1, 'w'); img.set(18, 1, 'w'); img.set(18, 0, 'w'); img.set(19, 0, 'w'); img.set(17, 2, 'S');
  // 红缨
  img.set(15, 3, 'R'); img.set(14, 4, 'R'); img.set(15, 4, 'r'); img.set(14, 3, 'R'); img.set(13, 5, 'r');
  return img;
}

export function zhaoyunFramesV2(): PixelImage[] {
  return [0, 1, 2, 3].map((f) => {
    const bob = f === 1 || f === 3 ? -1 : 0;
    const flap = f % 2;
    const img = new PixelImage(W, H);
    const hx = 4, hy = 12 + bob;
    const rx = 10, ry = 0 + bob;
    // 远侧腿先画（深色），被马身挡住一部分
    const pose = LEG_POSES[f];
    leg(img, hx + 5, hy + 13, pose[1], 's');
    leg(img, hx + 16, hy + 13, pose[3], 's');
    img.blit(PixelImage.fromRows(TAIL[flap]), hx - 1, hy + 5);
    img.blit(PixelImage.fromRows(HORSE_BODY), hx, hy);
    // 近侧腿
    leg(img, hx + 4, hy + 13, pose[0], 'S');
    leg(img, hx + 15, hy + 13, pose[2], 'S');
    // 鞍：蓝布金边
    img.blit(PixelImage.fromRows(['..yyyyyy..', '.bBBBBBBb.', '.bBBBBBBb.', '..ybybyb..']), hx + 6, hy + 7);
    // 笼头（棕色皮带）
    img.set(hx + 25, hy + 6, 'U'); img.set(hx + 26, hy + 7, 'U');
    // 披风在骑手身后
    img.blit(PixelImage.fromRows(CAPE[flap]), rx - 4, ry + 16);
    img.blit(PixelImage.fromRows(RIDER), rx, ry);
    // 红缨飘动
    if (flap) { img.set(rx + 4, ry + 1, 'R'); img.set(rx + 3, ry + 2, 'r'); }
    else { img.set(rx + 4, ry + 0, 'R'); img.set(rx + 4, ry + 1, 'r'); }
    img.blit(silverSpear(), rx + 10, ry + 9);
    return shadeVolume(img).outline();
  });
}
