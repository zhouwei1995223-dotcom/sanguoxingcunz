import { PixelImage } from '../pixel';

// 天机签模式的美术：无名剑客（8 帧）、可砍的树（三种）、树桩、签筒。
// 全部按像素画参数绘制，和其他武将同一套描边 / 调色板。

const W = 32, H = 40;

interface Pose {
  bob: number; // 身体起伏
  stride: number; // 迈步：-1 / 0 / 1
  arm: number; // 左臂前后摆
  wave: number; // 围巾、发尾、剑穗的飘动相位
  wind: number; // 飘动幅度（走路时大，站着小）
  blink: boolean;
  glint: number; // 剑身反光的位置 0~3
}

function ellipse(img: PixelImage, cx: number, cy: number, rx: number, ry: number, c: string) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) img.set(x, y, c);
    }
  }
}

/** 一帧无名剑客（面朝右）：斗笠、白衣、红围巾、青锋剑 */
function wumingFrame(ps: Pose): PixelImage {
  const img = new PixelImage(W, H);
  const by = 22 + ps.bob; // 衣身顶部
  const wv = (i: number, k = 1) => Math.round(Math.sin(i * 0.75 + ps.wave) * ps.wind * k * Math.min(1, i / 4));

  // 1. 红围巾：从颈后向左后方长长飘出（最后画的身体会压住根部）
  for (let i = 0; i < 13; i++) {
    const x = 12 - i;
    const y = by - 1 + Math.round(i * 0.3) + wv(i, 1.2);
    img.set(x, y, i > 9 ? 'r' : 'R');
    img.set(x, y + 1, 'r');
    if (i > 3 && i < 11) img.set(x, y - 1, i % 3 === 0 ? 'f' : 'R');
  }
  // 围巾末端的流苏
  { const ex = 12 - 13, ey = by - 1 + 4 + wv(13, 1.2); img.set(ex, ey + 1, 'y'); img.set(ex + 1, ey + 2, 'y'); }

  // 2. 发尾（马尾）从斗笠下向后飘
  for (let i = 0; i < 4; i++) img.set(10 - i, by - 8 + Math.round(i * 0.4) + wv(i + 2, 0.6), i < 3 ? 'k' : 'K');

  // 3. 腿与靴：裹腿 + 黑靴，迈步时一腿前伸抬高
  const L = ps.stride, R = -ps.stride;
  const leg = (x: number, s: number) => {
    const lift = Math.max(0, s);
    img.rect(x + s, by + 11, 3, 4 - lift, 'K');
    img.rect(x + s, by + 12, 3, 1, 'p'); // 绑腿布条
    img.rect(x + s - (s > 0 ? 0 : 1), by + 15 - lift, 4, 2, 'k');
    img.set(x + s + 2, by + 15 - lift, 'n');
  };
  leg(11, L); leg(16, R);

  // 4. 白衣下摆（前后两片，随步伐微摆）
  img.rect(10, by + 8, 11, 4, 'w');
  img.rect(10, by + 8, 1, 4, 'S'); img.rect(15, by + 9, 1, 3, 'S');
  img.set(10 + (L > 0 ? 1 : 0), by + 11, 'S'); img.set(20 - (R > 0 ? 1 : 0), by + 11, 'S');
  img.rect(10, by + 11, 11, 1, 'S');

  // 5. 上身：交领白衣 + 浅灰阴影 + 青色内衬
  img.rect(10, by, 11, 8, 'w');
  img.rect(10, by + 1, 1, 7, 'S'); img.rect(11, by + 6, 9, 1, 'S');
  img.line(12, by, 16, by + 4, 't'); img.line(13, by, 16, by + 3, 'B'); // 交领与内衬
  img.line(19, by, 17, by + 2, 'S');
  // 腰带：深青色，系结与飘带
  img.rect(10, by + 7, 11, 2, 'b'); img.rect(10, by + 7, 11, 1, 'B');
  img.rect(14, by + 7, 2, 2, 'c');
  img.set(13, by + 9 + (wv(3, 0.6) > 0 ? 1 : 0), 'b'); img.set(12, by + 10 + wv(4, 0.6), 'b');
  img.set(12, by + 11 + wv(5, 0.6), 'B');

  // 6. 背后斜挎的剑鞘（左肩到右腰后，露出两端）
  img.line(8, by + 9, 11, by + 6, 'U'); img.set(8, by + 10, 'y'); img.set(7, by + 10, 'Y');

  // 7. 左臂（靠后，随步伐前后摆）
  img.rect(8, by + 1, 2, 4, 'S');
  img.rect(8, by + 4 + ps.arm, 2, 2, 'w');
  img.rect(8, by + 6 + ps.arm, 2, 1, 'q');

  // 8. 右臂持剑：剑尖斜指前下方，剑身一道流动的反光
  img.rect(20, by + 1, 2, 3, 'w'); img.rect(21, by + 3, 2, 2, 'w');
  img.rect(22, by + 4, 2, 2, 'q');
  // 剑首 + 剑穗
  img.set(21, by + 3, 'U'); img.set(20, by + 4, 'U');
  img.set(19, by + 5 + (wv(2, 0.7) > 0 ? 1 : 0), 'R'); img.set(19, by + 6 + wv(3, 0.7), 'R'); img.set(18, by + 7 + wv(4, 0.7), 'r');
  // 剑格
  img.rect(23, by + 6, 2, 1, 'Y'); img.set(25, by + 5, 'Y'); img.set(22, by + 7, 'y');
  // 剑身
  for (let i = 0; i < 7; i++) {
    const x = 24 + i, y = by + 7 + i;
    img.set(x, y, 'S'); img.set(x + 1, y, i < 6 ? 'w' : 'S');
  }
  img.set(31, by + 14, 'w');
  const gl = 1 + ps.glint * 2;
  img.set(24 + gl, by + 7 + gl, 'w'); img.set(25 + gl, by + 7 + gl, 'c'); img.set(25 + gl, by + 6 + gl, 'a');

  // 9. 头：脸、眼、眉
  const hx = 11, hy = by - 9;
  img.rect(hx, hy + 2, 9, 7, 'q');
  img.rect(hx, hy + 2, 9, 1, 'E'); // 斗笠投下的阴影
  img.rect(hx + 1, hy + 8, 7, 1, 'q'); img.rect(hx + 2, hy + 9, 5, 1, 'E');
  img.rect(hx, hy + 2, 1, 4, 'k'); // 鬓发
  img.set(hx + 1, hy + 3, 'k');
  // 剑眉星目
  img.line(hx + 4, hy + 3, hx + 6, hy + 4, 'k'); img.set(hx + 8, hy + 3, 'k');
  if (ps.blink) img.rect(hx + 5, hy + 5, 2, 1, 'k');
  else { img.rect(hx + 5, hy + 4, 2, 2, 'k'); img.set(hx + 6, hy + 4, 'w'); }
  img.set(hx + 8, hy + 5, 'k');
  img.set(hx + 7, hy + 7, 'u'); // 嘴角

  // 10. 斗笠：宽檐竹编，顶上红缨，檐边垂一缕红绳
  const cx = 15, top = hy - 6;
  for (let r = 0; r < 6; r++) {
    const half = 2 + Math.round(r * 1.85);
    img.rect(cx - half, top + r, half * 2 + 1, 1, r >= 4 ? 'u' : 'p');
    // 竹编纹
    for (let x = cx - half + (r % 2); x <= cx + half; x += 3) img.set(x, top + r, r >= 4 ? 'U' : 'e');
  }
  img.rect(cx - 13, top + 6, 27, 1, 'U'); // 檐边
  img.rect(cx - 12, top + 5, 25, 1, 'u');
  img.set(cx, top - 1, 'R'); img.set(cx, top - 2, 'R'); img.set(cx - 1 + (wv(2, 0.5) > 0 ? 0 : 1), top - 3, 'r'); // 顶缨
  // 檐角垂绳
  const sx = cx + 12;
  img.set(sx, top + 7, 'R'); img.set(sx + (wv(1, 0.5) > 0 ? 1 : 0), top + 8, 'R'); img.set(sx + (wv(2, 0.6) > 0 ? 1 : 0), top + 9, 'y');

  return img.outline();
}

/** 8 帧：0~3 走路，4~7 站立待机（呼吸、眨眼、剑光流转、围巾轻飘） */
export function wumingFrames(): PixelImage[] {
  const walk: Pose[] = [0, 1, 2, 3].map((f) => ({ bob: f % 2, stride: [0, 1, 0, -1][f], arm: [0, -1, 0, 1][f], wave: f * 1.6, wind: 1.6, blink: false, glint: f }));
  const idle: Pose[] = [0, 1, 2, 3].map((f) => ({ bob: f >= 2 ? 1 : 0, stride: 0, arm: 0, wave: f * 0.9, wind: 0.8, blink: f === 3, glint: f }));
  return [...walk, ...idle].map(wumingFrame);
}

/** 可砍的树：0 松、1 圆冠阔叶、2 竹丛。底部锚点在树根。 */
export function treeImage(v: number): PixelImage {
  const img = new PixelImage(28, 38);
  const cx = 14, ground = 36;
  if (v === 2) {
    // 竹丛：五根竹竿 + 竹节 + 竹叶
    for (const [x, h] of [[8, 30], [11, 34], [14, 31], [17, 35], [20, 28]] as [number, number][]) {
      img.rect(x, ground - h, 2, h, 'g'); img.rect(x + 1, ground - h, 1, h, 'G');
      for (let y = ground - h + 5; y < ground; y += 6) img.rect(x, y, 2, 1, 'd');
      for (let k = 0; k < 3; k++) {
        const ly = ground - h + 2 + k * 7, dir = (x + k) % 2 ? 1 : -1;
        img.line(x + (dir > 0 ? 2 : -1), ly, x + dir * 5 + (dir > 0 ? 2 : -1), ly - 2, 'G');
        img.line(x + (dir > 0 ? 2 : -1), ly + 1, x + dir * 4 + (dir > 0 ? 2 : -1), ly - 1, 'g');
      }
    }
    img.rect(6, ground - 1, 17, 2, 'd');
    return img.outline();
  }
  // 树干：两色树皮 + 树节
  img.rect(cx - 2, ground - 16, 5, 16, 'U');
  img.rect(cx - 1, ground - 16, 2, 16, 'u');
  img.set(cx - 2, ground - 2, 'U'); img.set(cx + 3, ground - 1, 'U'); img.set(cx - 3, ground - 1, 'U');
  img.set(cx, ground - 8, 'z'); img.set(cx + 1, ground - 12, 'z');
  if (v === 0) {
    // 松：三层叠起的三角树冠，雪白高光
    for (let layer = 0; layer < 3; layer++) {
      const baseY = ground - 12 - layer * 7, half = 11 - layer * 3;
      for (let r = 0; r < 9; r++) {
        const w = Math.round(half * (r / 8));
        img.rect(cx - w, baseY - 8 + r, w * 2 + 1, 1, r > 6 ? 'd' : 'G');
        if (r > 2 && r % 2 === 0) img.set(cx - w + 1, baseY - 8 + r, 'g');
      }
    }
    img.set(cx, ground - 35, 'g');
  } else {
    // 圆冠：几团叶子叠成蓬松的树冠，左上受光
    ellipse(img, cx, ground - 22, 11, 9, 'd');
    ellipse(img, cx - 4, ground - 24, 7, 6, 'G');
    ellipse(img, cx + 5, ground - 22, 6, 6, 'G');
    ellipse(img, cx, ground - 28, 7, 5, 'G');
    ellipse(img, cx - 4, ground - 27, 3, 2.5, 'g');
    ellipse(img, cx + 2, ground - 30, 2.5, 2, 'g');
    for (const [x, y] of [[cx - 7, ground - 22], [cx + 6, ground - 25], [cx - 1, ground - 19], [cx + 3, ground - 27]] as [number, number][]) img.set(x, y, 'g');
    // 几颗果子
    img.set(cx - 5, ground - 20, 'R'); img.set(cx + 6, ground - 19, 'R'); img.set(cx + 1, ground - 25, 'o');
  }
  return img.outline();
}

/** 砍倒后的树桩（年轮） */
export function stumpImage(): PixelImage {
  const img = new PixelImage(14, 8);
  img.rect(3, 3, 8, 4, 'U'); img.rect(4, 3, 6, 4, 'u');
  ellipse(img, 7, 3, 4, 1.6, 'q');
  img.set(7, 3, 'u'); img.set(5, 3, 'E'); img.set(9, 3, 'E');
  img.set(2, 6, 'U'); img.set(11, 6, 'U');
  return img.outline();
}

/** 签筒：竹筒 + 朱红箍 + 一把露头的签 */
export function tongImage(): PixelImage {
  const img = new PixelImage(22, 28);
  // 签：露出筒口，签头朱红
  for (const [x, h] of [[6, 8], [8, 10], [10, 11], [12, 9], [14, 10], [16, 7]] as [number, number][]) {
    img.rect(x, 9 - h + 3, 1, h, 'p');
    img.set(x, 9 - h + 3, 'R'); img.set(x, 9 - h + 4, 'R');
  }
  // 筒身：竹色两侧暗、中间亮
  img.rect(4, 9, 15, 17, 'y');
  img.rect(4, 9, 3, 17, 'o'); img.rect(16, 9, 3, 17, 'u');
  img.rect(8, 10, 2, 15, 'Y');
  // 筒口
  ellipse(img, 11, 9, 7.5, 1.6, 'U');
  // 朱红箍 + 金字
  img.rect(4, 13, 15, 3, 'R'); img.rect(4, 13, 15, 1, 'f'); img.rect(4, 15, 15, 1, 'r');
  img.rect(4, 21, 15, 2, 'R'); img.rect(4, 22, 15, 1, 'r');
  img.rect(10, 17, 3, 3, 'Y'); img.set(11, 18, 'R');
  // 筒底
  img.rect(5, 26, 13, 1, 'U');
  return img.outline();
}
