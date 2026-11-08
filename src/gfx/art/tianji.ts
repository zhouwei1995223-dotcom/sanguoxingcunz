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

/** 一帧无名剑客（正面，脸参照觉醒步战造型）：斗笠、白衣交领、红围巾向一侧飘、右手斜持青锋剑 */
function wumingFrame(ps: Pose): PixelImage {
  const img = new PixelImage(W, H);
  const by = 22 + ps.bob; // 衣身顶部
  const wv = (i: number, k = 1) => Math.round(Math.sin(i * 0.75 + ps.wave) * ps.wind * k * Math.min(1, i / 4));

  // 1. 围巾的两条尾巴：从颈部左侧向左后方飘（先画，压在身后）
  for (let i = 0; i < 11; i++) {
    const x = 10 - i, y = by + Math.round(i * 0.35) + wv(i, 1.2);
    img.set(x, y, i > 8 ? 'r' : 'R'); img.set(x, y + 1, 'r');
    if (i > 2 && i < 10) img.set(x, y + 2 + (wv(i + 2, 0.6) > 0 ? 1 : 0), i % 2 ? 'R' : 'r');
  }
  { const ey = by + 4 + wv(11, 1.2); img.set(-1 + 1, ey + 1, 'y'); img.set(1, ey + 2, 'y'); }
  // 发尾：斗笠下从脑后向一侧飘
  for (let i = 0; i < 4; i++) img.set(9 - i, by - 7 + i + wv(i + 3, 0.5), i < 3 ? 'k' : 'K');

  // 2. 腿与靴：正面两条腿，迈步时一条抬高
  const L = ps.stride, R = -ps.stride;
  img.rect(11, by + 10 + Math.max(0, -L), 3, 4 - Math.abs(L), 'K');
  img.rect(17, by + 10 + Math.max(0, -R), 3, 4 - Math.abs(R), 'K');
  img.rect(11, by + 11, 3, 1, 'p'); img.rect(17, by + 11, 3, 1, 'p'); // 绑腿
  img.rect(10, by + 13 - Math.max(0, L), 5, 2, 'k'); img.set(13, by + 13 - Math.max(0, L), 'n');
  img.rect(16, by + 13 - Math.max(0, R), 5, 2, 'k'); img.set(19, by + 13 - Math.max(0, R), 'n');

  // 3. 白衣下摆：中间开衩
  img.rect(10, by + 8, 11, 4, 'w');
  img.rect(15, by + 9, 1, 3, 'S'); img.rect(20, by + 8, 1, 4, 'S');
  img.rect(10, by + 11, 11, 1, 'S');

  // 4. 上身：交领（V 字）+ 青色内衬 + 右侧阴影
  img.rect(10, by, 11, 8, 'w');
  img.rect(20, by + 1, 1, 7, 'S');
  img.line(12, by + 1, 15, by + 5, 't'); img.line(18, by + 1, 15, by + 5, 't');
  img.rect(14, by + 2, 3, 2, 'B'); img.set(15, by + 4, 'B');
  // 腰带 + 系结，两条带尾垂在左侧随步摆
  img.rect(10, by + 7, 11, 2, 'b'); img.rect(10, by + 7, 11, 1, 'B');
  img.rect(14, by + 7, 3, 2, 'c'); img.set(15, by + 8, 'B');
  img.set(13, by + 9, 'b'); img.set(13 + (wv(3, 0.6) > 0 ? -1 : 0), by + 10, 'b'); img.set(12 + (wv(4, 0.6) > 0 ? -1 : 0), by + 11, 'B');

  // 5. 双臂：左臂随步伐摆，右臂持剑
  img.rect(8, by + 1, 2, 4, 'w'); img.rect(8, by + 1, 1, 4, 'S');
  img.rect(8, by + 5 + ps.arm, 2, 1, 'S'); img.rect(8, by + 6 + ps.arm, 2, 2, 'q');
  img.rect(21, by + 1, 2, 4, 'w'); img.rect(22, by + 1, 1, 4, 'S');
  img.rect(21, by + 5, 3, 2, 'q');
  // 青锋剑：剑格在手下，剑身斜指右下，一道反光沿剑身流动；剑首垂红穗
  img.set(22, by + 4, 'U'); img.set(23, by + 4, 'U');
  img.set(24, by + 3 + (wv(2, 0.7) > 0 ? 1 : 0), 'R'); img.set(25, by + 4 + wv(3, 0.7), 'R'); img.set(25, by + 5 + wv(4, 0.7), 'r');
  img.rect(21, by + 7, 4, 1, 'Y'); img.set(23, by + 8, 'y');
  for (let i = 0; i < 7; i++) {
    const x = 23 + i, y = by + 8 + i;
    img.set(x, y, 'S'); img.set(x + 1, y, i < 6 ? 'w' : 'S');
  }
  img.set(30, by + 15, 'w');
  const gl = 1 + ps.glint * 2;
  img.set(23 + gl, by + 8 + gl, 'w'); img.set(24 + gl, by + 8 + gl, 'c'); img.set(24 + gl, by + 7 + gl, 'a');


  // 7. 脸（正面，参照觉醒造型）：两鬓黑发、剑眉、双眼带高光、鼻、嘴
  const ox = 9, oy = by - 12, cx = ox + 6;
  img.rect(ox + 1, oy + 4, 11, 7, 'q');
  img.rect(ox + 2, oy + 11, 9, 1, 'q');
  img.rect(ox + 4, oy + 12, 5, 1, 'q');
  img.rect(ox + 1, oy + 4, 11, 1, 'E'); // 斗笠投下的阴影
  img.rect(ox + 1, oy + 5, 1, 3, 'k'); img.rect(ox + 11, oy + 5, 1, 3, 'k'); // 两鬓
  img.set(ox + 2, oy + 5, 'k'); img.set(ox + 10, oy + 5, 'k');
  // 剑眉：一行、略向外挑，和眼睛隔开一行
  img.rect(ox + 2, oy + 5, 3, 1, 'k'); img.set(ox + 1, oy + 5, 'k');
  img.rect(ox + 8, oy + 5, 3, 1, 'k'); img.set(ox + 11, oy + 5, 'k');
  // 眼睛：3×2 黑瞳，两眼高光都在左上（和觉醒造型一致）
  for (const ex of [ox + 2, ox + 8]) {
    if (ps.blink) { img.rect(ex, oy + 8, 3, 1, 'k'); continue; }
    img.rect(ex, oy + 7, 3, 2, 'k');
    img.set(ex, oy + 7, 'w'); // 高光
    img.set(ex + 2, oy + 8, 'K'); // 瞳仁边缘稍浅，不显得死黑
  }
  // 腮红（很淡）
  img.set(ox + 2, oy + 10, 'e'); img.set(ox + 10, oy + 10, 'e');
  img.set(cx, oy + 9, 'u'); // 鼻
  img.rect(cx - 1, oy + 11, 3, 1, 'E'); // 嘴

  // 红围巾绕颈：画在下巴之后，围在领口上，左侧打结
  img.rect(11, by, 10, 2, 'R'); img.rect(11, by + 1, 10, 1, 'r'); img.rect(13, by, 5, 1, 'f');
  img.rect(9, by, 3, 3, 'R'); img.set(9, by + 2, 'r'); img.set(10, by + 1, 'f');

  // 8. 斗笠：正面看是宽檐圆锥，竹编纹，檐下一圈深色，顶缨，右檐垂一缕红绳
  const top = oy - 5;
  for (let r = 0; r < 8; r++) {
    const half = 1 + Math.round(r * 1.75);
    const y = top + r;
    img.rect(cx - half, y, half * 2 + 1, 1, r >= 6 ? 'u' : 'p');
    for (let x = cx - half + (r % 2); x <= cx + half; x += 3) img.set(x, y, r >= 6 ? 'U' : 'e');
  }
  img.rect(cx - 14, top + 8, 29, 1, 'U'); // 檐边
  img.set(cx - 14, top + 9, 'U'); img.set(cx + 14, top + 9, 'U'); // 檐角微垂
  img.set(cx, top - 1, 'R'); img.set(cx, top - 2, 'R'); img.set(cx + (wv(2, 0.5) > 0 ? 1 : 0), top - 3, 'r');
  const sx = cx + 13;
  img.set(sx, top + 10, 'R'); img.set(sx + (wv(1, 0.5) > 0 ? 1 : 0), top + 11, 'R'); img.set(sx + (wv(2, 0.6) > 0 ? 1 : 0), top + 12, 'y');

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
