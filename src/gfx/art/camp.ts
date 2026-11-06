import { PixelImage } from '../pixel';
import { NEW_UI } from '../../data/platformConfig';

// 主界面「营地」场景的美术：帅帐、兵器架、酒坛、栅栏木桩、火把杆。全部代码生成。

/** 帅帐：尖顶大帐，红边白帐布，门帘掀开，帐顶插帅旗。宽 66、高 54（锚点底部中间） */
export function tentImage(): PixelImage {
  const W = 66, H = 54;
  const img = new PixelImage(W, H);
  const cx = 33;
  if (!NEW_UI) {
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

  // —— NEW_UI：三层体积光精细中军大帅帐 ——
  // 1. 顶部鎏金枪头旗杆 + 迎风招展燕尾帅旗
  img.rect(cx, 1, 1, 12, 'u'); img.rect(cx - 1, 1, 1, 12, 'q');
  img.set(cx, 0, 'w'); img.set(cx - 1, 0, 'Y');
  // 燕尾红旗（带亮红高光、暗红褶皱与金边徽记）
  img.rect(cx + 1, 1, 13, 8, 'R');
  img.rect(cx + 1, 1, 12, 1, 'Y'); img.rect(cx + 1, 8, 12, 1, 'y');
  img.rect(cx + 2, 2, 5, 2, 'f');
  img.rect(cx + 8, 6, 5, 2, 'r');
  img.set(cx + 13, 3, '.'); img.set(cx + 13, 4, '.'); img.set(cx + 12, 4, '.'); img.set(cx + 13, 5, '.');
  img.rect(cx + 5, 3, 4, 4, 'Y'); img.rect(cx + 6, 4, 2, 2, 'R');
  // 鎏金攒尖宝顶
  img.rect(cx - 2, 10, 5, 2, 'y'); img.rect(cx - 1, 9, 3, 2, 'Y'); img.set(cx, 9, 'w');

  // 2. 帐身侧墙（y = 28..51）：左上受光面 w/p，中间 p，右侧背光面 q/E，底部护墙裙边
  for (let y = 28; y < 52; y++) {
    const half = 22 + Math.floor((y - 28) * 0.38);
    for (let dx = -half; dx <= half; dx++) {
      const ratio = dx / (half || 1);
      let c = 'p';
      if (ratio < -0.35) c = y % 5 === 0 ? 'p' : 'w';
      else if (ratio < 0.25) c = y % 5 === 0 ? 'q' : 'p';
      else if (ratio < 0.7) c = y % 5 === 0 ? 'E' : 'q';
      else c = 'E';
      // 底部朱漆压边裙墙
      if (y >= 49) c = dx < 0 ? 'R' : 'r';
      else if (y === 48) c = dx < 0 ? 'Y' : 'y';
      img.set(cx + dx, y, c);
    }
    // 两侧立柱木骨纹理
    img.set(cx - half, y, 'U'); img.set(cx + half, y, 'z');
    if (half > 16) { img.set(cx - 16, y, 'q'); img.set(cx + 16, y, 'E'); }
  }

  // 3. 尖顶（y = 12..27）：扇形放射红白条纹 + 左亮右暗三层体积光
  for (let y = 12; y < 27; y++) {
    const dy = y - 11;
    const half = Math.floor(dy * 1.72);
    for (let dx = -half; dx <= half; dx++) {
      // 扇形投射条纹：让条纹从宝顶向外呈放射状展开
      const proj = (dx / Math.max(4, dy * 0.48));
      const isRed = Math.floor(Math.abs(proj) + 0.5) % 2 === 0;
      const side = dx / (half || 1);
      let c: string;
      if (isRed) {
        c = side < -0.3 ? 'f' : side < 0.35 ? 'R' : 'r';
      } else {
        c = side < -0.25 ? 'w' : side < 0.35 ? 'p' : 'q';
      }
      // 坡顶下沿压暗增强立体感
      if (y === 26) c = isRed ? 'r' : 'q';
      img.set(cx + dx, y, c);
    }
    img.set(cx - half, y, 'r');
    img.set(cx + half, y, 'z');
  }

  // 4. 帐檐鎏金重边 + 错落金流苏 + 垂挂红绸角穗
  img.rect(cx - 27, 26, 55, 1, 'Y');
  img.rect(cx - 28, 27, 57, 2, 'R');
  img.rect(cx, 27, 29, 2, 'r');
  for (let x = cx - 27; x <= cx + 27; x++) {
    img.set(x, 29, (x - cx) % 2 === 0 ? 'Y' : 'o');
    if ((x - cx) % 4 === 0) img.set(x, 30, 'y');
  }

  // 5. 帅帐正门：乌木门框 + 顶部鎏金「帅」字牌匾 + 帐内帅案灯火 + 左右双层卷帘
  img.rect(cx - 9, 32, 19, 20, 'z');
  img.rect(cx - 7, 34, 15, 18, 'k');
  // 帐内帅案与暖金烛台
  img.rect(cx - 4, 47, 9, 2, 'U');
  img.rect(cx - 3, 46, 7, 1, 'u');
  img.rect(cx - 1, 43, 3, 3, 'o');
  img.rect(cx, 41, 1, 3, 'Y');
  img.set(cx, 40, 'w');
  // 门楣牌匾
  img.rect(cx - 6, 30, 13, 4, 'z');
  img.rect(cx - 6, 30, 13, 1, 'Y'); img.rect(cx - 6, 33, 13, 1, 'y');
  img.set(cx - 1, 31, 'Y'); img.set(cx, 31, 'w'); img.set(cx + 1, 31, 'Y');
  img.set(cx - 1, 32, 'y'); img.set(cx, 32, 'Y'); img.set(cx + 1, 32, 'y');
  // 左右掀开的立体锦缎门帘（带金绳束腰）
  for (let y = 33; y <= 51; y++) {
    const t = (y - 33) / 18;
    const lx = Math.round(cx - 7 - t * 5);
    const rx = Math.round(cx + 7 + t * 5);
    img.set(lx - 1, y, 'f'); img.set(lx, y, 'R'); img.set(lx + 1, y, 'r');
    img.set(rx - 1, y, 'R'); img.set(rx, y, 'r'); img.set(rx + 1, y, 'z');
    if (y === 42 || y === 43) {
      img.set(lx - 1, y, 'Y'); img.set(lx, y, 'y'); img.set(lx + 1, y, 'o');
      img.set(rx - 1, y, 'Y'); img.set(rx, y, 'y'); img.set(rx + 1, y, 'o');
    }
  }

  // 6. 两侧拉绳与包金木桩地钉
  img.line(cx - 28, 28, cx - 32, 51, 'q'); img.line(cx + 28, 28, cx + 32, 51, 'u');
  img.rect(cx - 33, 49, 3, 4, 'U'); img.set(cx - 32, 49, 'Y');
  img.rect(cx + 31, 49, 3, 4, 'z'); img.set(cx + 32, 49, 'y');
  // 底边阴影
  img.rect(cx - 30, 52, 61, 2, 'h');
  return img.outline();
}

/** 兵器架：一排长枪长戟 */
export function weaponRackImage(): PixelImage {
  if (!NEW_UI) {
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

  // —— NEW_UI：精细朱漆镶金兵器架（五般神兵陈列） ——
  const img = new PixelImage(28, 28);
  // 底座与立柱（带木纹明暗与黄金铜箍）
  img.rect(1, 24, 26, 2, 'z');
  img.rect(2, 23, 24, 1, 'U');
  img.rect(3, 10, 2, 15, 'U'); img.rect(3, 10, 1, 14, 'u');
  img.rect(23, 10, 2, 15, 'z'); img.rect(23, 10, 1, 14, 'U');
  // 上下两道横梁 + 两端鎏金箍头
  img.rect(1, 11, 26, 2, 'U'); img.rect(2, 11, 24, 1, 'L');
  img.rect(1, 20, 26, 2, 'U'); img.rect(2, 20, 24, 1, 'u');
  img.set(1, 11, 'Y'); img.set(26, 11, 'y');
  img.set(1, 20, 'Y'); img.set(26, 20, 'y');

  // 5 把神兵：0=青龙刀, 1=红缨枪, 2=方天画戟(居中最高), 3=丈八蛇矛, 4=长枪
  const xs = [6, 10, 14, 18, 22];
  for (let i = 0; i < 5; i++) {
    const x = xs[i];
    // 枪杆（左高光 q/u，右暗部 U + 底鐏 y）
    img.rect(x, 5, 1, 20, i === 2 ? 'r' : 'u');
    img.set(x, 25, 'y');
    // 朱红枪缨
    img.set(x - 1, 6, 'f'); img.set(x, 6, 'Y'); img.set(x + 1, 6, 'R');
    img.set(x - 1, 7, 'R'); img.set(x + 1, 7, 'r');
    if (i === 0) {
      // 青龙偃月宽刀刃
      img.rect(x - 1, 1, 3, 5, 'S'); img.rect(x - 1, 1, 1, 4, 'w');
      img.set(x, 0, 'w'); img.set(x + 1, 0, 'S'); img.set(x, 5, 'G');
    } else if (i === 2) {
      // 方天画戟（中锋 + 左右黄金月牙刃）
      img.rect(x, 0, 1, 6, 'w');
      img.set(x - 2, 2, 'Y'); img.set(x - 2, 3, 'Y'); img.set(x - 2, 4, 'y'); img.set(x - 1, 3, 'y');
      img.set(x + 2, 2, 'Y'); img.set(x + 2, 3, 'y'); img.set(x + 2, 4, 'o'); img.set(x + 1, 3, 'o');
    } else if (i === 3) {
      // 丈八蛇矛（弯曲双刃尖）
      img.set(x, 0, 'w'); img.set(x - 1, 1, 'w'); img.set(x, 2, 'S');
      img.set(x + 1, 3, 'S'); img.set(x, 4, 's'); img.set(x - 1, 5, 'S');
    } else {
      // 亮银长枪
      img.rect(x - 1, 2, 3, 3, 'S');
      img.set(x, 0, 'w'); img.set(x, 1, 'w'); img.set(x - 1, 2, 'w'); img.set(x + 1, 4, 'N');
    }
  }
  return img.outline();
}

/** 酒坛 / 粮袋堆 */
export function suppliesImage(): PixelImage {
  if (!NEW_UI) {
    const img = new PixelImage(24, 18);
    // 粮袋
    img.rect(1, 9, 10, 8, 'p'); img.rect(1, 9, 10, 1, 'e'); img.rect(5, 7, 3, 2, 'E');
    img.rect(12, 10, 10, 7, 'p'); img.rect(12, 10, 10, 1, 'e'); img.rect(16, 8, 3, 2, 'E');
    // 两只陶坛
    img.rect(6, 3, 6, 7, 'U'); img.rect(7, 1, 4, 2, 'u'); img.rect(7, 5, 4, 2, 'R');
    img.rect(14, 2, 5, 8, 'u'); img.rect(15, 0, 3, 2, 'U'); img.rect(15, 4, 3, 2, 'y');
    return img.outline();
  }

  // —— NEW_UI：立体圆肚酒坛与饱满军粮麻袋堆 ——
  const img = new PixelImage(26, 20);
  // 后排两只圆肚美酒坛（带红泥封口、高光陶釉与红纸酒贴）
  // 左酒坛
  img.rect(6, 1, 5, 2, 'R'); img.rect(6, 1, 3, 1, 'f'); // 红绸封口
  img.rect(7, 3, 3, 1, 'y'); // 金绳扎口
  img.rect(5, 4, 7, 7, 'u'); img.rect(6, 4, 2, 6, 'L'); img.rect(10, 4, 2, 6, 'U');
  img.rect(7, 6, 3, 3, 'w'); img.set(8, 7, 'R'); // 白纸红字「酒」贴
  // 右酒坛
  img.rect(15, 0, 5, 2, 'R'); img.rect(15, 0, 3, 1, 'f');
  img.rect(16, 2, 3, 1, 'Y');
  img.rect(14, 3, 7, 8, 'U'); img.rect(15, 3, 2, 7, 'u'); img.rect(19, 3, 2, 7, 'z');
  img.rect(16, 5, 3, 3, 'Y'); img.set(17, 6, 'R');

  // 前排左粮袋（饱满圆角、左上高光 w/p、右下暗部 q/E、红绳扎口露出金麦粒）
  img.rect(4, 7, 4, 2, 'Y'); img.set(5, 7, 'w'); // 袋口金谷
  img.rect(4, 9, 4, 1, 'R'); // 扎袋红绳
  img.rect(1, 10, 10, 8, 'p');
  img.rect(2, 10, 3, 6, 'w');
  img.rect(8, 11, 3, 7, 'q');
  img.rect(1, 17, 10, 1, 'E');
  img.rect(4, 12, 4, 4, 'w'); img.rect(5, 13, 2, 2, 'R'); // 粮贴

  // 前排右粮袋
  img.rect(16, 8, 4, 2, 'Y');
  img.rect(16, 10, 4, 1, 'R');
  img.rect(12, 11, 11, 7, 'p');
  img.rect(13, 11, 3, 5, 'w');
  img.rect(20, 12, 3, 6, 'q');
  img.rect(12, 17, 11, 1, 'E');
  img.rect(16, 13, 3, 3, 'R'); img.set(17, 14, 'Y');
  return img.outline();
}

/** 栅栏木桩（一根），尖头 */
export function stakeImage(): PixelImage {
  if (!NEW_UI) {
    return PixelImage.fromRows([
      '.U.',
      'UuU',
      'UuU',
      'UuU',
      'UuU',
      'UuU',
      'UzU',
    ]);
  }
  // 精细削尖木桩：带木茬高光 p/q、左亮 u 右暗 U/z 与横向绑绳
  return PixelImage.fromRows([
    '.p.',
    'pqU',
    'quU',
    'quz',
    'YYy',
    'quz',
    'uUz',
    'UzK',
  ]);
}

/** 火把杆（火焰另外画） */
export function torchPoleImage(): PixelImage {
  if (!NEW_UI) {
    const img = new PixelImage(5, 22);
    img.rect(2, 4, 1, 18, 'U');
    img.rect(1, 2, 3, 3, 'z'); img.rect(1, 20, 3, 2, 'z');
    return img.outline();
  }
  const img = new PixelImage(7, 23);
  // 顶部精铁火盆托架与通红炭火
  img.rect(1, 1, 5, 2, 'S'); img.set(1, 1, 'w'); img.set(5, 2, 'N');
  img.set(2, 1, 'R'); img.set(3, 1, 'Y'); img.set(4, 1, 'o');
  img.rect(2, 3, 3, 2, 'N'); img.set(2, 3, 's');
  img.rect(2, 5, 3, 1, 'Y'); // 黄金箍环
  // 圆柱木杆（左亮 u，右暗 U）
  for (let y = 6; y < 20; y++) {
    img.set(2, y, 'u'); img.set(3, y, 'U');
  }
  img.rect(2, 12, 2, 1, 'y');
  img.rect(1, 20, 4, 2, 'z'); img.set(1, 20, 'U');
  return img.outline();
}
