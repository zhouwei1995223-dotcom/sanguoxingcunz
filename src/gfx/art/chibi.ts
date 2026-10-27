import { PixelImage } from '../pixel';

// Q 版大头造型（效果图阶段）：头身比约 1:1.2，粗眉大眼。
// 先只画赵云的「步行」和「骑马」两张静态图，确认风格后再做动画与其他武将。

/** 填充椭圆 */
function ellipse(img: PixelImage, cx: number, cy: number, rx: number, ry: number, c: string, yMax = 999) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (y > yMax) continue;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) img.set(x, y, c);
    }
  }
}

/** 赵云的大头：银盔红缨、护颊、粗眉大眼。左上角为 (ox, oy)，宽 22、高 26 */
export function zhaoyunHead(img: PixelImage, ox: number, oy: number) {
  const cx = ox + 11;
  // 红缨与盔顶金饰
  img.rect(cx - 1, oy, 3, 2, 'R');
  img.set(cx - 2, oy + 1, 'R'); img.set(cx + 2, oy + 1, 'r');
  img.rect(cx - 1, oy + 2, 3, 2, 'r');
  img.set(cx - 2, oy + 3, 'R');
  img.rect(cx - 1, oy + 4, 3, 1, 'y'); img.set(cx, oy + 4, 'Y');
  // 头盔（半椭圆）
  ellipse(img, cx, oy + 13, 11, 9, 'S', oy + 12);
  ellipse(img, cx - 4, oy + 8, 3, 2, 'w');
  for (let x = ox + 1; x <= ox + 21; x++) img.set(x, oy + 12, 's');
  // 额前金饰
  img.rect(cx - 2, oy + 9, 5, 3, 'y'); img.rect(cx - 1, oy + 10, 3, 1, 'Y'); img.set(cx, oy + 9, 'R');
  // 脸
  img.rect(ox + 4, oy + 13, 15, 11, 'q');
  img.rect(ox + 5, oy + 24, 13, 1, 'q');
  img.rect(ox + 7, oy + 25, 9, 1, 'q');
  // 刘海（黑发）
  img.rect(ox + 4, oy + 13, 15, 2, 'k');
  img.set(ox + 7, oy + 15, 'k'); img.set(ox + 8, oy + 15, 'k'); img.set(ox + 12, oy + 15, 'k'); img.set(ox + 16, oy + 15, 'k'); img.set(ox + 17, oy + 15, 'k');
  img.set(ox + 4, oy + 15, 'k'); img.set(ox + 4, oy + 16, 'k'); img.set(ox + 18, oy + 15, 'k'); img.set(ox + 18, oy + 16, 'k');
  // 护颊（银）
  img.rect(ox + 1, oy + 13, 3, 10, 'S'); img.rect(ox + 1, oy + 13, 1, 10, 's');
  img.rect(ox + 19, oy + 13, 3, 10, 'S'); img.rect(ox + 21, oy + 13, 1, 10, 's');
  img.set(ox + 2, oy + 23, 'S'); img.set(ox + 20, oy + 23, 'S');
  // 粗眉（向中间压低，显得坚毅）
  img.line(ox + 5, oy + 16, ox + 9, oy + 18, 'k'); img.line(ox + 5, oy + 17, ox + 9, oy + 19, 'k');
  img.line(ox + 17, oy + 16, ox + 13, oy + 18, 'k'); img.line(ox + 17, oy + 17, ox + 13, oy + 19, 'k');
  // 眼睛：眼白 + 黑瞳 + 高光
  for (const ex of [ox + 6, ox + 13]) {
    img.rect(ex, oy + 19, 4, 3, 'w');
    img.rect(ex + 1, oy + 19, 2, 3, 'k');
    img.set(ex + 1, oy + 19, 'w');
  }
  // 鼻、嘴
  img.set(cx, oy + 22, 'E');
  img.rect(cx - 2, oy + 24, 5, 1, 'U');
  img.set(cx - 2, oy + 23, 'E'); img.set(cx + 2, oy + 23, 'E');
}

/** 步行造型：正面站立，右手持亮银枪，蓝披风，银鳞甲白袍 */
export function zhaoyunStanding(): PixelImage {
  const img = new PixelImage(34, 52);
  // 长枪（在身后右侧，竖直）
  img.rect(27, 4, 1, 47, 'S'); img.rect(28, 4, 1, 47, 's');
  img.rect(27, 0, 2, 4, 'w'); img.set(27, 0, '.'); img.set(28, 0, 'w');
  img.rect(26, 4, 4, 1, 'S');
  img.rect(26, 5, 1, 3, 'R'); img.rect(29, 5, 1, 3, 'R'); img.rect(27, 6, 2, 3, 'r');
  // 披风（身后两侧）
  img.rect(3, 27, 4, 18, 'B'); img.rect(3, 27, 1, 18, 'b'); img.rect(4, 44, 3, 2, 'b');
  img.rect(24, 27, 4, 18, 'B'); img.rect(27, 27, 1, 18, 'b'); img.rect(24, 44, 3, 2, 'b');
  // 身体：银鳞甲
  img.rect(7, 27, 17, 12, 'S');
  for (let y = 29; y < 38; y += 2) for (let x = 8 + ((y / 2) % 2); x < 23; x += 2) img.set(x, y, 's');
  img.rect(13, 27, 5, 11, 'w'); img.rect(14, 28, 3, 9, 'w');
  img.rect(12, 27, 7, 2, 'n');
  // 肩甲
  ellipse(img, 7, 29, 3, 2.5, 'S'); ellipse(img, 7, 28, 2, 1, 'w');
  ellipse(img, 24, 29, 3, 2.5, 'S'); ellipse(img, 24, 28, 2, 1, 'w');
  // 腰带
  img.rect(7, 38, 17, 2, 'y'); img.rect(14, 38, 3, 2, 'Y'); img.set(15, 38, 'R');
  // 手臂：白袖 + 拳头；左拳叉腰，右拳握枪
  img.rect(4, 30, 4, 5, 'w'); img.rect(4, 30, 1, 5, 'S');
  img.rect(4, 35, 4, 4, 'q'); img.rect(4, 38, 4, 1, 'E');
  img.rect(23, 30, 4, 3, 'w'); img.rect(26, 30, 1, 3, 'S');
  img.rect(25, 31, 4, 4, 'q'); img.rect(25, 34, 4, 1, 'E'); img.set(27, 32, 'E');
  // 白袍下摆 + 蓝边
  img.rect(7, 40, 17, 5, 'w'); img.rect(7, 44, 17, 1, 'B'); img.rect(15, 40, 1, 5, 'S');
  // 腿与靴
  img.rect(9, 45, 5, 4, 'n'); img.rect(17, 45, 5, 4, 'n');
  img.rect(8, 49, 7, 2, 'K'); img.rect(16, 49, 7, 2, 'K');
  zhaoyunHead(img, 4, 2);
  return img.outline();
}

/** Q 版白马（侧面朝右），左上角 (ox, oy)，宽约 46、高 24 */
function chibiHorse(img: PixelImage, ox: number, oy: number) {
  // 马尾（向后飘）
  img.rect(ox, oy + 5, 4, 3, 'S'); img.rect(ox - 1, oy + 7, 4, 5, 'S'); img.rect(ox - 1, oy + 11, 3, 3, 's'); img.set(ox + 3, oy + 5, 's');
  // 腿（短粗），远侧腿深一点
  for (const [lx, far] of [[ox + 8, true], [ox + 12, false], [ox + 25, true], [ox + 29, false]] as [number, boolean][]) {
    img.rect(lx, oy + 15, 4, 6, far ? 'S' : 'w');
    if (far) img.rect(lx, oy + 15, 1, 6, 's');
    img.rect(lx, oy + 21, 4, 2, 'N');
  }
  // 马身（圆胖）
  ellipse(img, ox + 20, oy + 10, 16, 6.5, 'w');
  ellipse(img, ox + 20, oy + 15, 13, 2, 'S');
  // 脖子
  for (let y = 0; y < 10; y++) img.rect(ox + 31 + Math.floor(y / 3), oy + 6 - y + 4, 7, 1, 'w');
  img.rect(ox + 32, oy + 2, 6, 10, 'w');
  // 大马头
  ellipse(img, ox + 40, oy + 3, 6, 5, 'w');
  img.rect(ox + 40, oy + 3, 6, 6, 'w');
  ellipse(img, ox + 44, oy + 8, 3.5, 2.5, 'p');
  img.set(ox + 46, oy + 7, 'E'); img.set(ox + 45, oy + 7, 'E');
  img.rect(ox + 43, oy + 10, 3, 1, 'U');
  // 耳朵
  img.rect(ox + 36, oy - 4, 2, 3, 'w'); img.set(ox + 36, oy - 4, 'S');
  img.rect(ox + 39, oy - 3, 2, 2, 'w');
  // 马鬃（沿脖子后缘）
  img.rect(ox + 33, oy - 2, 3, 3, 'S'); img.rect(ox + 31, oy + 1, 3, 3, 'S'); img.rect(ox + 30, oy + 4, 2, 3, 's'); img.set(ox + 35, oy - 3, 'S');
  // 眼睛（大而有神）
  img.rect(ox + 40, oy + 1, 3, 3, 'k'); img.set(ox + 40, oy + 1, 'w'); img.set(ox + 41, oy + 1, 'w');
  img.set(ox + 39, oy + 0, 'S'); img.set(ox + 40, oy + 0, 'S'); img.set(ox + 41, oy + 0, 'S');
  // 笼头（棕色皮带）
  img.rect(ox + 38, oy + 5, 7, 1, 'U'); img.rect(ox + 38, oy + 1, 1, 4, 'U');
  // 鞍：蓝布金边
  img.rect(ox + 12, oy + 3, 14, 7, 'B'); img.rect(ox + 12, oy + 3, 14, 1, 'y'); img.rect(ox + 12, oy + 9, 14, 1, 'y');
  img.rect(ox + 13, oy + 10, 1, 2, 'y'); img.rect(ox + 24, oy + 10, 1, 2, 'y');
}

/** 骑马造型：Q 版白马 + 大头赵云（身体侧坐，脸朝向镜头），长枪斜指前方 */
export function zhaoyunMounted(): PixelImage {
  const img = new PixelImage(62, 56);
  const hy = 31;
  // 披风向后飘
  img.rect(5, 25, 6, 4, 'B'); img.rect(2, 27, 7, 4, 'B'); img.rect(0, 30, 6, 4, 'b'); img.rect(1, 33, 3, 2, 'b');
  chibiHorse(img, 4, hy);
  // 骑手身体（侧坐在鞍上）
  img.rect(10, 26, 14, 10, 'S');
  for (let y = 28; y < 34; y += 2) for (let x = 11 + ((y / 2) % 2); x < 23; x += 2) img.set(x, y, 's');
  img.rect(15, 26, 4, 9, 'w');
  img.rect(14, 26, 6, 1, 'n');
  img.rect(10, 35, 14, 2, 'y'); img.rect(16, 35, 3, 2, 'Y');
  ellipse(img, 10, 28, 3, 2.5, 'S'); ellipse(img, 10, 27, 2, 1, 'w');
  ellipse(img, 24, 28, 3, 2.5, 'S'); ellipse(img, 24, 27, 2, 1, 'w');
  // 白袍下摆与腿（跨在马侧）
  img.rect(11, 37, 12, 3, 'w'); img.rect(11, 39, 12, 1, 'B');
  img.rect(17, 40, 5, 5, 'n'); img.rect(17, 45, 6, 2, 'K');
  // 长枪：从右拳斜指右上，越过马头
  img.line(20, 42, 59, 8, 'S'); img.line(21, 42, 60, 8, 's');
  img.rect(58, 5, 2, 3, 'w'); img.set(60, 5, 'w'); img.set(60, 4, 'w'); img.set(61, 4, 'w');
  img.rect(55, 9, 2, 2, 'R'); img.set(54, 11, 'r'); img.set(56, 11, 'R'); img.set(53, 10, 'R');
  // 拳头：右拳握枪、左拳拉缰
  img.rect(26, 31, 4, 4, 'q'); img.rect(26, 34, 4, 1, 'E');
  img.rect(7, 31, 4, 4, 'q'); img.rect(7, 34, 4, 1, 'E');
  zhaoyunHead(img, 6, 1);
  return img.outline();
}
