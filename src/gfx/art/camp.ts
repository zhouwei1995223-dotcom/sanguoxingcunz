import { PixelImage } from '../pixel';

// 主界面「营地」场景的美术：帅帐、兵器架、酒坛、栅栏木桩、火把杆。全部代码生成。

/** 帅帐：尖顶大帐，红边白帐布，门帘掀开，帐顶插帅旗。宽 66、高 54（锚点底部中间） */
export function tentImage(): PixelImage {
  const W = 66, H = 54;
  const img = new PixelImage(W, H);
  const cx = 33;
  // 帐顶旗杆 + 帅旗
  img.rect(cx, 0, 1, 14, 'U');
  img.rect(cx + 1, 1, 11, 7, 'R'); img.rect(cx + 1, 7, 10, 1, 'r');
  img.rect(cx + 4, 3, 5, 3, 'Y'); img.rect(cx + 5, 4, 3, 1, 'r');
  // 帐身：梯形侧墙
  for (let y = 26; y < 52; y++) {
    const half = 22 + Math.floor((y - 26) * 0.4);
    img.rect(cx - half, y, half * 2 + 1, 1, y % 6 === 0 ? 'p' : 'w');
  }
  // 尖顶：从顶点往下展开的大三角，红白相间的帐布条纹
  for (let y = 12; y < 28; y++) {
    const half = Math.floor((y - 12) * 1.7);
    for (let x = -half; x <= half; x++) img.set(cx + x, y, Math.floor((x + 40) / 5) % 2 ? 'R' : 'w');
  }
  for (let y = 12; y < 28; y++) { const half = Math.floor((y - 12) * 1.7); img.set(cx - half, y, 'r'); img.set(cx + half, y, 'r'); }
  // 帐檐红边 + 金色流苏
  img.rect(cx - 27, 27, 55, 2, 'r');
  for (let x = cx - 26; x <= cx + 26; x += 3) img.set(x, 29, 'y');
  // 门帘：两片掀开的帘子，中间露出昏暗帐内和一点烛光
  img.rect(cx - 7, 34, 15, 18, 'z');
  img.rect(cx - 5, 40, 11, 12, 'k');
  img.rect(cx - 1, 44, 3, 3, 'o'); img.set(cx, 43, 'Y');
  img.line(cx - 8, 34, cx - 12, 51, 'R'); img.line(cx - 7, 34, cx - 10, 51, 'r');
  img.line(cx + 8, 34, cx + 12, 51, 'R'); img.line(cx + 7, 34, cx + 10, 51, 'r');
  img.rect(cx - 8, 33, 17, 1, 'y');
  // 地钉与拉绳
  img.line(cx - 27, 28, cx - 32, 52, 'U'); img.line(cx + 27, 28, cx + 32, 52, 'U');
  img.rect(cx - 33, 51, 3, 2, 'z'); img.rect(cx + 31, 51, 3, 2, 'z');
  // 底边阴影
  img.rect(cx - 30, 52, 61, 2, 'h');
  return img.outline();
}

/** 兵器架：一排长枪长戟 */
export function weaponRackImage(): PixelImage {
  const img = new PixelImage(26, 26);
  img.rect(1, 20, 24, 2, 'U'); img.rect(1, 9, 24, 2, 'U');
  img.rect(2, 9, 2, 16, 'z'); img.rect(22, 9, 2, 16, 'z');
  const tips = ['S', 'w', 'S', 'y', 'S'];
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 4;
    img.rect(x, 3, 1, 21, 'u');
    img.rect(x - 1, 0, 3, 3, tips[i]); img.set(x, 0, 'w');
    if (i === 3) { img.rect(x - 2, 2, 2, 2, 'y'); img.rect(x + 1, 2, 2, 2, 'y'); }
    img.set(x - 1, 4, 'R'); img.set(x + 1, 4, 'R');
  }
  return img.outline();
}

/** 酒坛 / 粮袋堆 */
export function suppliesImage(): PixelImage {
  const img = new PixelImage(24, 18);
  // 粮袋
  img.rect(1, 9, 10, 8, 'p'); img.rect(1, 9, 10, 1, 'e'); img.rect(5, 7, 3, 2, 'E');
  img.rect(12, 10, 10, 7, 'p'); img.rect(12, 10, 10, 1, 'e'); img.rect(16, 8, 3, 2, 'E');
  // 两只陶坛
  img.rect(6, 3, 6, 7, 'U'); img.rect(7, 1, 4, 2, 'u'); img.rect(7, 5, 4, 2, 'R');
  img.rect(14, 2, 5, 8, 'u'); img.rect(15, 0, 3, 2, 'U'); img.rect(15, 4, 3, 2, 'y');
  return img.outline();
}

/** 栅栏木桩（一根），尖头 */
export function stakeImage(): PixelImage {
  const img = PixelImage.fromRows([
    '.U.',
    'UuU',
    'UuU',
    'UuU',
    'UuU',
    'UuU',
    'UzU',
  ]);
  return img;
}

/** 火把杆（火焰另外画） */
export function torchPoleImage(): PixelImage {
  const img = new PixelImage(5, 22);
  img.rect(2, 4, 1, 18, 'U');
  img.rect(1, 2, 3, 3, 'z'); img.rect(1, 20, 3, 2, 'z');
  return img.outline();
}
