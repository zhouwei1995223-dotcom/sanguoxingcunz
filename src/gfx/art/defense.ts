import { PixelImage } from '../pixel';

// 守城模式的美术：城池、攻城器械（冲车 / 投石车 / 云梯兵）、我方弩车。全部代码生成。

/** 城池：四面城墙 + 角楼 + 正门 + 中间的大殿，宽 112、高 96（锚点在底部中间） */
export function cityImage(): PixelImage {
  const W = 112, H = 96;
  const img = new PixelImage(W, H);
  // 城内地面
  img.rect(10, 30, 92, 56, 'p');
  for (let y = 32; y < 84; y += 4) for (let x = 12 + ((y / 4) % 2) * 2; x < 100; x += 4) img.set(x, y, 'e');
  // 大殿：台基 + 柱子 + 两层屋顶
  img.rect(34, 50, 44, 6, 'S'); img.rect(34, 55, 44, 1, 's');
  img.rect(38, 38, 36, 12, 'R'); for (let x = 40; x < 74; x += 6) img.rect(x, 38, 2, 12, 'r');
  img.rect(52, 42, 8, 8, 'U'); img.rect(55, 42, 2, 8, 'z');
  img.rect(32, 32, 48, 6, 'z'); img.rect(30, 34, 52, 2, 'K'); img.rect(28, 36, 4, 1, 'K'); img.rect(80, 36, 4, 1, 'K');
  img.rect(38, 24, 36, 8, 'z'); img.rect(36, 28, 40, 2, 'K'); img.rect(34, 30, 4, 1, 'K'); img.rect(74, 30, 4, 1, 'K');
  img.rect(40, 23, 32, 1, 'y'); img.set(39, 22, 'y'); img.set(72, 22, 'y'); img.rect(54, 20, 4, 3, 'Y');
  // 后墙（远处，矮一些）
  img.rect(8, 22, 96, 8, 's'); img.rect(8, 22, 96, 2, 'S');
  for (let x = 8; x < 104; x += 6) img.rect(x, 19, 4, 3, 'S');
  // 左右城墙（侧面）
  for (const x0 of [4, 100]) {
    img.rect(x0, 22, 8, 58, 's'); img.rect(x0 + (x0 < 50 ? 6 : 0), 22, 2, 58, 'N');
    for (let y = 24; y < 78; y += 6) img.rect(x0 + 2, y, 4, 3, 'S');
  }
  // 前墙：砖纹 + 垛口
  img.rect(4, 74, 104, 18, 'S'); img.rect(4, 90, 104, 2, 'N');
  for (let y = 76; y < 90; y += 4) for (let x = 6 + ((y / 4) % 2) * 4; x < 106; x += 8) img.rect(x, y, 1, 3, 's');
  for (let y = 78; y < 90; y += 4) img.rect(4, y, 104, 1, 's');
  img.rect(4, 74, 104, 2, 'w');
  for (let x = 4; x < 108; x += 7) img.rect(x, 70, 4, 4, 'S');
  // 城门：拱门 + 木门 + 门钉 + 匾额
  img.rect(46, 78, 20, 14, 'k');
  img.rect(48, 80, 16, 12, 'U'); img.rect(55, 80, 2, 12, 'z');
  for (const [x, y] of [[50, 83], [53, 83], [59, 83], [62, 83], [50, 87], [53, 87], [59, 87], [62, 87]]) img.set(x, y, 'y');
  img.rect(46, 77, 20, 1, 'K'); img.set(45, 78, 'K'); img.set(66, 78, 'K');
  img.rect(50, 71, 12, 5, 'z'); img.rect(51, 72, 10, 3, 'y'); img.rect(53, 73, 6, 1, 'z');
  // 四个角楼：方楼 + 小屋顶 + 红旗
  for (const [tx, ty] of [[0, 14], [96, 14], [0, 66], [96, 66]]) {
    img.rect(tx, ty + 6, 16, 14, 'S'); img.rect(tx, ty + 6, 16, 2, 'w'); img.rect(tx, ty + 18, 16, 2, 'N');
    img.rect(tx + 6, ty + 10, 4, 5, 'k');
    img.rect(tx - 1, ty + 2, 18, 4, 'z'); img.rect(tx + 1, ty, 14, 2, 'z'); img.rect(tx - 2, ty + 5, 20, 1, 'K');
    img.rect(tx + 7, ty - 8, 1, 9, 'U');
    img.rect(tx + 8, ty - 8, 6, 4, 'R'); img.rect(tx + 8, ty - 5, 5, 1, 'r'); img.set(tx + 10, ty - 7, 'Y');
  }
  return img.outline();
}

/** 冲车：带顶棚的木车，前面一根包铁撞木。f = 0..3 车轮转动 */
export function ramFrames(): PixelImage[] {
  return [0, 1, 2, 3].map((f) => {
    const img = new PixelImage(30, 22);
    // 顶棚（兽皮）
    img.rect(4, 2, 20, 4, 'U'); img.rect(2, 5, 24, 2, 'z'); img.rect(5, 1, 18, 1, 'u');
    // 车身
    img.rect(4, 7, 20, 8, 'u'); for (let x = 6; x < 24; x += 4) img.rect(x, 7, 1, 8, 'U');
    // 撞木（向右伸出，铁头）
    img.rect(18, 10, 10, 3, 'U'); img.rect(26, 9, 4, 5, 'n'); img.rect(27, 10, 2, 3, 's');
    // 车轮
    for (const wx of [8, 20]) {
      img.disc(wx, 17, 3, 'U'); img.set(wx, 17, 'y');
      const sp = [[0, -3], [3, 0], [0, 3], [-3, 0]][f];
      img.set(wx + sp[0], 17 + sp[1], 'z'); img.set(wx - sp[0], 17 - sp[1], 'z');
    }
    return img.outline();
  });
}

/** 投石车：木架 + 抛竿（帧 2、3 抛竿扬起） */
export function catapultFrames(): PixelImage[] {
  return [0, 1, 2, 3].map((f) => {
    const img = new PixelImage(28, 26);
    img.rect(3, 16, 22, 4, 'u'); img.rect(3, 19, 22, 1, 'U');
    img.line(8, 16, 13, 6, 'U'); img.line(19, 16, 14, 6, 'U'); img.rect(12, 5, 4, 2, 'z');
    const up = f >= 2;
    if (up) { img.line(14, 6, 24, 0, 'u'); img.disc(24, 1, 2, 's'); img.line(14, 6, 9, 11, 'u'); }
    else { img.line(14, 6, 5, 2, 'u'); img.disc(4, 2, 2, 'N'); img.disc(4, 2, 1, 's'); img.line(14, 6, 21, 12, 'u'); }
    img.rect(19, 10, 4, 4, 'n');
    for (const wx of [7, 21]) { img.disc(wx, 21, 3, 'U'); img.set(wx, 21, 'y'); }
    return img.outline();
  });
}

/** 弩车（我方）：木车上一架床弩 */
export function crossbowCartFrames(): PixelImage[] {
  return [0, 1, 2, 3].map((f) => {
    const img = new PixelImage(28, 20);
    img.rect(3, 9, 20, 5, 'u'); img.rect(3, 13, 20, 1, 'U');
    // 弩臂（绿漆）+ 弩弦 + 弩箭
    img.line(6, 3, 6, 10, 'G'); img.line(7, 3, 7, 10, 'd');
    img.line(6, 3, 18, 6, 'G'); img.line(6, 10, 18, 7, 'G');
    img.rect(8, 6, 18, 1, f % 2 ? 'S' : 'w'); img.set(26, 6, 'S'); img.set(25, 5, 'S'); img.set(25, 7, 'S');
    img.rect(10, 1, 3, 2, 'R');
    for (const wx of [7, 19]) { img.disc(wx, 16, 3, 'U'); img.set(wx, 16, 'y'); }
    return img.outline();
  });
}

/** 云梯兵：在普通兵身上叠一架扛着的梯子 */
export function withLadder(frames: PixelImage[]): PixelImage[] {
  return frames.map((src) => {
    const img = new PixelImage(src.w + 8, src.h + 4);
    img.blit(src, 4, 4);
    img.line(1, 1, src.w + 6, 9, 'u'); img.line(1, 4, src.w + 6, 12, 'u');
    for (let i = 0; i < 4; i++) { const x = 3 + i * Math.round((src.w + 2) / 4); img.line(x, 1 + Math.round(i * 2), x, 4 + Math.round(i * 2), 'U'); }
    return img.outline();
  });
}
