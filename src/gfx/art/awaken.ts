import { PixelImage } from '../pixel';
import type { HeroId } from './heroes';

// 五星觉醒造型：下马步战，比骑马造型更大、更华丽（金边铠甲、兽首肩甲、飘动披风、发光兵器）。
// 全部由参数拼出来：同一套身体，换头饰、配色、胡须、兵器，就是不同武将。画布 34×50，4 帧走路。

type Helm = 'helm' | 'hat' | 'crown' | 'scarf' | 'band' | 'hairpin' | 'lion';
type Beard = '' | 'long' | 'bristle' | 'white' | 'full';
type Weapon = 'spear' | 'blade' | 'fork' | 'fan' | 'halberd' | 'bow' | 'lance' | 'chakram' | 'jis' | 'staff';

interface AwakenStyle {
  helm: Helm;
  helmC: string; helmD: string; plume: string;
  skin: string; hair: string; beard: Beard;
  armor: string; armorD: string; robe: string; trim: string; trimL: string;
  cape: string; capeD: string;
  weapon: Weapon; wMetal: string; wGlow: string;
}

const STYLES: Record<HeroId, AwakenStyle> = {
  zhaoyun: { helm: 'helm', helmC: 'S', helmD: 's', plume: 'R', skin: 'q', hair: 'k', beard: '', armor: 'S', armorD: 's', robe: 'w', trim: 'y', trimL: 'Y', cape: 'B', capeD: 'b', weapon: 'spear', wMetal: 'w', wGlow: 'c' },
  guanyu: { helm: 'hat', helmC: 'G', helmD: 'd', plume: 'y', skin: 'l', hair: 'k', beard: 'long', armor: 'G', armorD: 'd', robe: 'g', trim: 'y', trimL: 'Y', cape: 'd', capeD: 't', weapon: 'blade', wMetal: 'S', wGlow: 'g' },
  zhangfei: { helm: 'helm', helmC: 'n', helmD: 'K', plume: 'R', skin: 'E', hair: 'k', beard: 'bristle', armor: 'n', armorD: 'K', robe: 'N', trim: 'y', trimL: 'Y', cape: 'r', capeD: 'z', weapon: 'fork', wMetal: 'S', wGlow: 'R' },
  zhuge: { helm: 'scarf', helmC: 'K', helmD: 'k', plume: 'w', skin: 'q', hair: 'k', beard: '', armor: 'w', armorD: 'S', robe: 'w', trim: 'B', trimL: 'c', cape: 'b', capeD: 't', weapon: 'fan', wMetal: 'w', wGlow: 'c' },
  lvbu: { helm: 'crown', helmC: 'y', helmD: 'o', plume: 'R', skin: 'q', hair: 'k', beard: '', armor: 'y', armorD: 'o', robe: 'M', trim: 'R', trimL: 'Y', cape: 'r', capeD: 'z', weapon: 'halberd', wMetal: 'Y', wGlow: 'M' },
  huangzhong: { helm: 'helm', helmC: 'y', helmD: 'u', plume: 'Y', skin: 'q', hair: 'w', beard: 'white', armor: 'y', armorD: 'u', robe: 'u', trim: 'Y', trimL: 'w', cape: 'U', capeD: 'z', weapon: 'bow', wMetal: 'Y', wGlow: 'o' },
  machao: { helm: 'lion', helmC: 'S', helmD: 's', plume: 'w', skin: 'q', hair: 'k', beard: '', armor: 'S', armorD: 's', robe: 'w', trim: 'B', trimL: 'c', cape: 'b', capeD: 'K', weapon: 'lance', wMetal: 'w', wGlow: 'B' },
  sunshangxiang: { helm: 'hairpin', helmC: 'z', helmD: 'k', plume: 'R', skin: 'q', hair: 'z', beard: '', armor: 'f', armorD: 'M', robe: 'f', trim: 'y', trimL: 'Y', cape: 'M', capeD: 'm', weapon: 'chakram', wMetal: 'Y', wGlow: 'f' },
  dianwei: { helm: 'band', helmC: 'R', helmD: 'r', plume: 'R', skin: 'E', hair: 'k', beard: 'full', armor: 'U', armorD: 'z', robe: 'u', trim: 'y', trimL: 'Y', cape: 'z', capeD: 'k', weapon: 'jis', wMetal: 'S', wGlow: 'o' },
  jiangwei: { helm: 'helm', helmC: 'S', helmD: 'B', plume: 'c', skin: 'q', hair: 'k', beard: '', armor: 'B', armorD: 'b', robe: 'S', trim: 'y', trimL: 'Y', cape: 'b', capeD: 't', weapon: 'staff', wMetal: 'c', wGlow: 'c' },
};

const W = 34, H = 50;

function ellipse(img: PixelImage, cx: number, cy: number, rx: number, ry: number, c: string, yMax = 999) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (y > yMax) continue;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) img.set(x, y, c);
    }
  }
}

/** 头部（脸 + 头饰 + 胡须），左上角 (ox, oy)，约 18×16 */
function head(img: PixelImage, s: AwakenStyle, ox: number, oy: number) {
  const cx = ox + 9;
  // 脸（大头 Q 版）
  img.rect(ox + 3, oy + 6, 13, 9, s.skin);
  img.rect(ox + 4, oy + 15, 11, 1, s.skin);
  img.rect(ox + 6, oy + 16, 7, 1, s.skin);
  // 刘海
  img.rect(ox + 3, oy + 6, 13, 2, s.hair);
  img.set(ox + 3, oy + 8, s.hair); img.set(ox + 15, oy + 8, s.hair);
  img.set(ox + 7, oy + 8, s.hair); img.set(ox + 12, oy + 8, s.hair);
  // 粗眉、大眼
  img.line(ox + 4, oy + 9, ox + 7, oy + 10, 'k'); img.line(ox + 15, oy + 9, ox + 12, oy + 10, 'k');
  for (const ex of [ox + 5, ox + 11]) { img.rect(ex, oy + 11, 3, 3, 'w'); img.rect(ex + 1, oy + 11, 2, 3, 'k'); img.set(ex + 1, oy + 11, 'w'); }
  if (s.helm === 'hairpin') {
    // 女将：眼角上扬、腮红
    img.set(ox + 4, oy + 11, 'k'); img.set(ox + 15, oy + 11, 'k');
    img.set(ox + 4, oy + 14, 'f'); img.set(ox + 15, oy + 14, 'f');
  }
  img.set(cx, oy + 14, 'E');
  img.rect(cx - 1, oy + 15, 3, 1, 'U');
  // 胡须
  if (s.beard === 'long') { img.rect(ox + 6, oy + 15, 7, 2, 'k'); img.rect(ox + 7, oy + 17, 5, 3, 'k'); img.rect(ox + 8, oy + 20, 3, 2, 'k'); img.set(cx, oy + 22, 'k'); img.rect(cx - 1, oy + 15, 3, 1, 'U'); }
  if (s.beard === 'white') { img.rect(ox + 6, oy + 15, 7, 2, 'w'); img.rect(ox + 7, oy + 17, 5, 2, 'w'); img.rect(ox + 8, oy + 19, 3, 2, 'S'); }
  if (s.beard === 'bristle' || s.beard === 'full') {
    img.rect(ox + 3, oy + 13, 2, 3, 'k'); img.rect(ox + 14, oy + 13, 2, 3, 'k');
    img.rect(ox + 4, oy + 15, 11, 2, 'k'); img.rect(ox + 6, oy + 17, 7, 1, 'k');
    if (s.beard === 'bristle') { img.set(ox + 2, oy + 14, 'k'); img.set(ox + 16, oy + 14, 'k'); img.set(ox + 3, oy + 17, 'k'); img.set(ox + 15, oy + 17, 'k'); }
    img.rect(cx - 1, oy + 15, 3, 1, 'R');
  }
  // 头饰
  switch (s.helm) {
    case 'helm': case 'lion': {
      ellipse(img, cx, oy + 6, 9, 6, s.helmC, oy + 6);
      for (let x = ox + 1; x <= ox + 17; x++) img.set(x, oy + 6, s.helmD);
      ellipse(img, cx - 4, oy + 3, 2, 1, 'w');
      // 额前金饰
      img.rect(cx - 2, oy + 2, 5, 3, s.trim === 'B' ? 'y' : s.trim); img.rect(cx - 1, oy + 3, 3, 1, 'Y'); img.set(cx, oy + 2, 'R');
      // 护颊
      img.rect(ox + 1, oy + 6, 2, 8, s.helmC); img.rect(ox + 16, oy + 6, 2, 8, s.helmC);
      img.rect(ox + 1, oy + 6, 1, 8, s.helmD); img.rect(ox + 17, oy + 6, 1, 8, s.helmD);
      if (s.helm === 'lion') {
        // 狮盔：盔顶兽首 + 白缨长尾
        img.rect(cx - 3, oy - 3, 7, 3, s.helmC); img.set(cx - 2, oy - 2, 'k'); img.set(cx + 2, oy - 2, 'k'); img.rect(cx - 1, oy - 1, 3, 1, 'y');
        img.set(cx - 3, oy - 4, s.helmC); img.set(cx + 3, oy - 4, s.helmC);
        img.rect(cx + 4, oy - 3, 3, 2, s.plume); img.rect(cx + 6, oy - 1, 3, 3, s.plume); img.rect(cx + 8, oy + 2, 2, 4, s.plume);
      } else {
        // 高红缨
        img.rect(cx - 1, oy - 5, 3, 3, s.plume); img.rect(cx - 2, oy - 3, 5, 2, s.plume); img.set(cx, oy - 6, s.plume);
        img.rect(cx - 1, oy - 1, 3, 1, s.trimL === 'w' ? 'Y' : s.trimL);
      }
      break;
    }
    case 'hat': {
      // 绿巾：方顶软帽 + 金饰
      img.rect(ox + 2, oy - 1, 15, 7, s.helmC); img.rect(ox + 3, oy - 3, 13, 2, s.helmC); img.rect(ox + 5, oy - 4, 9, 1, s.helmD);
      img.rect(ox + 2, oy + 5, 15, 1, s.helmD);
      img.rect(cx - 2, oy, 5, 3, 'y'); img.set(cx, oy + 1, 'R');
      img.rect(ox, oy + 2, 2, 6, s.helmD); img.rect(ox + 17, oy + 2, 2, 6, s.helmD);
      break;
    }
    case 'crown': {
      // 束发紫金冠 + 两根长长的雉鸡翎
      img.rect(ox + 3, oy + 2, 13, 4, s.hair);
      img.rect(cx - 4, oy - 1, 9, 4, s.helmC); img.rect(cx - 4, oy + 2, 9, 1, s.helmD);
      img.set(cx - 4, oy - 2, s.helmC); img.set(cx, oy - 3, s.helmC); img.set(cx + 4, oy - 2, s.helmC);
      img.set(cx, oy, 'R'); img.set(cx - 2, oy + 1, 'c'); img.set(cx + 2, oy + 1, 'c');
      img.line(cx - 3, oy - 2, cx - 9, oy - 9, s.plume); img.line(cx - 2, oy - 2, cx - 8, oy - 9, 'o');
      img.line(cx + 3, oy - 2, cx + 9, oy - 9, s.plume); img.line(cx + 4, oy - 2, cx + 10, oy - 9, 'o');
      img.set(cx - 9, oy - 10, 'Y'); img.set(cx + 10, oy - 10, 'Y');
      break;
    }
    case 'scarf': {
      // 纶巾：深色高冠 + 白色飘带
      img.rect(ox + 3, oy + 1, 13, 5, s.helmC); img.rect(ox + 5, oy - 2, 9, 3, s.helmC); img.rect(ox + 6, oy - 3, 7, 1, s.helmD);
      img.rect(cx - 1, oy - 2, 3, 2, 'w');
      img.rect(ox + 15, oy + 3, 3, 2, 'w'); img.rect(ox + 17, oy + 5, 2, 4, 'w');
      break;
    }
    case 'band': {
      // 光头 + 红抹额，后脑短发
      ellipse(img, cx, oy + 6, 8, 5, s.skin, oy + 6);
      img.rect(ox + 2, oy + 4, 15, 2, s.helmC); img.rect(ox + 16, oy + 5, 3, 2, s.helmC); img.rect(ox + 18, oy + 7, 2, 3, s.helmD);
      img.set(cx, oy + 4, 'y');
      break;
    }
    case 'hairpin': {
      // 双髻 + 金步摇 + 红花
      ellipse(img, cx, oy + 5, 9, 5, s.hair, oy + 6);
      img.disc(ox + 3, oy, 3, s.hair); img.disc(ox + 15, oy, 3, s.hair);
      img.rect(ox + 1, oy + 6, 2, 9, s.hair); img.rect(ox + 16, oy + 6, 2, 9, s.hair);
      img.set(ox + 3, oy - 1, s.plume); img.set(ox + 4, oy, 'f'); img.set(ox + 2, oy, 'f');
      img.line(ox + 15, oy - 1, ox + 18, oy - 4, 'Y'); img.set(ox + 18, oy - 3, 'R'); img.set(ox + 19, oy - 4, 'Y');
      img.rect(cx - 1, oy + 2, 3, 2, 'Y'); img.set(cx, oy + 1, 'R');
      break;
    }
  }
}

/** 兵器：竖握在身体右侧，(hx, hy) 是握持点 */
function weapon(img: PixelImage, s: AwakenStyle, hx: number, hy: number, glow: boolean) {
  const m = s.wMetal, gl = glow ? s.wGlow : m;
  const shaft = (top: number, bot: number, c = 'U') => { img.rect(hx, top, 1, bot - top, c); img.rect(hx + 1, top, 1, bot - top, c === 'U' ? 'u' : c); };
  switch (s.weapon) {
    case 'spear': case 'lance': {
      shaft(hy - 22, hy + 14, s.weapon === 'lance' ? 's' : 'U');
      // 枪头
      img.rect(hx, hy - 27, 2, 5, m); img.set(hx, hy - 28, m); img.rect(hx - 1, hy - 25, 4, 2, m); img.set(hx + 1, hy - 27, gl);
      img.rect(hx - 1, hy - 22, 4, 1, 'y');
      if (s.weapon === 'lance') { img.rect(hx - 1, hy - 21, 4, 2, 'S'); img.set(hx - 1, hy - 20, 'k'); img.set(hx + 2, hy - 20, 'k'); }
      else { img.rect(hx - 1, hy - 21, 1, 3, 'R'); img.rect(hx + 2, hy - 21, 1, 3, 'R'); img.rect(hx, hy - 20, 2, 2, 'r'); }
      if (glow) { img.set(hx - 2, hy - 26, gl); img.set(hx + 3, hy - 24, gl); }
      break;
    }
    case 'blade': {
      shaft(hy - 18, hy + 14);
      // 青龙偃月刀：大弯刃 + 龙头吞口
      img.rect(hx - 1, hy - 28, 4, 10, m); img.rect(hx + 3, hy - 27, 2, 7, m); img.set(hx + 5, hy - 25, m);
      img.line(hx + 4, hy - 27, hx + 5, hy - 22, 'w'); img.set(hx - 1, hy - 28, '.');
      img.rect(hx - 1, hy - 18, 4, 2, s.wGlow === 'g' ? 'G' : 'y'); img.set(hx - 2, hy - 17, 'y');
      if (glow) { img.set(hx + 6, hy - 26, gl); img.set(hx + 6, hy - 22, gl); img.set(hx - 2, hy - 24, gl); }
      break;
    }
    case 'fork': {
      shaft(hy - 20, hy + 14, 'n');
      // 丈八蛇矛：蛇形刃
      img.rect(hx, hy - 26, 2, 6, m); img.set(hx - 1, hy - 24, m); img.set(hx + 2, hy - 22, m); img.set(hx - 1, hy - 21, m); img.set(hx, hy - 27, m);
      img.rect(hx - 1, hy - 20, 4, 1, 'y'); img.rect(hx - 1, hy - 19, 1, 3, 'R'); img.rect(hx + 2, hy - 19, 1, 3, 'R');
      if (glow) { img.set(hx + 3, hy - 25, gl); img.set(hx - 2, hy - 23, gl); }
      break;
    }
    case 'halberd': {
      shaft(hy - 22, hy + 14, 'R');
      // 方天画戟：月牙双刃 + 金杆
      img.rect(hx, hy - 30, 2, 8, m); img.set(hx, hy - 31, m);
      img.rect(hx - 4, hy - 26, 4, 2, m); img.rect(hx - 5, hy - 28, 2, 6, m); img.set(hx - 4, hy - 29, m);
      img.rect(hx + 2, hy - 26, 4, 2, m); img.rect(hx + 5, hy - 28, 2, 6, m); img.set(hx + 5, hy - 29, m);
      img.rect(hx - 1, hy - 22, 4, 1, 'y'); img.rect(hx - 1, hy - 21, 1, 3, 'R'); img.rect(hx + 2, hy - 21, 1, 3, 'R');
      if (glow) { img.set(hx - 6, hy - 27, gl); img.set(hx + 7, hy - 27, gl); img.set(hx + 1, hy - 32, gl); }
      break;
    }
    case 'staff': {
      shaft(hy - 22, hy + 14, 'K');
      // 天水星杖：杖头星环
      img.ring(hx + 1, hy - 26, 4, s.trim); img.disc(hx + 1, hy - 26, 2, m); img.set(hx + 1, hy - 26, 'w');
      img.set(hx + 1, hy - 31, 'Y'); img.set(hx - 4, hy - 26, 'Y'); img.set(hx + 6, hy - 26, 'Y');
      if (glow) { img.set(hx - 3, hy - 30, gl); img.set(hx + 5, hy - 30, gl); img.set(hx - 3, hy - 22, gl); img.set(hx + 5, hy - 22, gl); }
      break;
    }
    case 'fan': {
      // 羽扇：举在胸前右侧
      const fy = hy - 10;
      img.rect(hx, fy + 6, 1, 5, 'U');
      ellipse(img, hx, fy, 4, 6, 'w'); ellipse(img, hx, fy, 2, 4, 'S');
      img.line(hx, fy - 5, hx, fy + 5, 's'); img.rect(hx - 1, fy + 5, 3, 1, 'y');
      if (glow) { img.set(hx - 5, fy - 4, gl); img.set(hx + 5, fy - 2, gl); img.set(hx, fy - 7, gl); }
      break;
    }
    case 'bow': {
      // 宝雕弓：竖立的长弓 + 金箭
      img.line(hx + 3, hy - 22, hx + 5, hy - 16, 'U'); img.line(hx + 5, hy - 16, hx + 5, hy - 2, 'U'); img.line(hx + 5, hy - 2, hx + 3, hy + 4, 'U');
      img.set(hx + 3, hy - 23, m); img.set(hx + 3, hy + 5, m); img.set(hx + 5, hy - 9, m);
      img.line(hx + 3, hy - 22, hx + 3, hy + 4, 'w');
      img.rect(hx - 1, hy - 20, 1, 22, 'Y'); img.set(hx - 2, hy - 21, 'S'); img.set(hx - 1, hy - 21, 'S'); img.set(hx, hy - 21, 'S');
      if (glow) { img.set(hx + 7, hy - 12, gl); img.set(hx + 7, hy - 4, gl); img.set(hx - 2, hy - 23, gl); }
      break;
    }
    case 'chakram': {
      // 乾坤圈：右手举一只、左边腰间一只
      img.ring(hx + 1, hy - 4, 4, m); img.set(hx + 1, hy - 8, 'w'); img.set(hx - 2, hy - 7, 'R'); img.set(hx + 5, hy - 1, 'R');
      img.ring(8, hy + 6, 3, m);
      if (glow) { img.set(hx + 6, hy - 6, gl); img.set(hx - 4, hy - 2, gl); img.set(hx + 1, hy - 10, gl); }
      break;
    }
    case 'jis': {
      // 双铁戟：两手各一把短戟
      for (const x0 of [hx, 5]) {
        img.rect(x0, hy - 14, 2, 20, 'K');
        img.rect(x0, hy - 19, 2, 5, m); img.set(x0, hy - 20, m);
        img.rect(x0 + 2, hy - 17, 3, 2, m); img.rect(x0 + 4, hy - 19, 1, 4, m);
        img.rect(x0 - 1, hy - 14, 4, 1, 'y');
        if (glow) img.set(x0 + 5, hy - 20, gl);
      }
      break;
    }
  }
}

/** 一帧：f = 0..3 走路 */
function frame(s: AwakenStyle, f: number): PixelImage {
  const img = new PixelImage(W, H);
  const bob = f === 1 || f === 3 ? 1 : 0;
  const sway = [0, 1, 0, -1][f];
  const by = 21 + bob; // 身体顶部（上面留出头饰和长翎的空间）
  // 披风（身后，下摆随走路飘动）
  for (let y = 0; y < 17; y++) {
    const spread = Math.min(4, Math.floor(y / 4));
    const x0 = 7 - spread + (y > 10 ? sway : 0), x1 = 26 + spread + (y > 10 ? sway : 0);
    img.rect(x0, by + 6 + y, x1 - x0, 1, y > 12 ? s.capeD : s.cape);
    img.set(x0, by + 6 + y, s.capeD); img.set(x1 - 1, by + 6 + y, s.capeD);
  }
  // 披风金边
  for (let x = 4 + sway; x < 30 + sway; x += 2) img.set(x, by + 22, s.trim);
  // 腿与靴（迈步）
  const lStep = [0, -1, 0, 1][f], rStep = -lStep;
  img.rect(11, by + 19 + Math.max(0, lStep), 4, 6 - Math.abs(lStep), s.armorD);
  img.rect(19, by + 19 + Math.max(0, rStep), 4, 6 - Math.abs(rStep), s.armorD);
  img.rect(10, by + 24 + lStep, 6, 3, 'K'); img.rect(10, by + 24 + lStep, 6, 1, s.trim);
  img.rect(18, by + 24 + rStep, 6, 3, 'K'); img.rect(18, by + 24 + rStep, 6, 1, s.trim);
  // 战袍下摆（两片，金边）
  img.rect(10, by + 15, 6, 6, s.robe); img.rect(18, by + 15, 6, 6, s.robe);
  img.rect(10, by + 20, 6, 1, s.trim); img.rect(18, by + 20, 6, 1, s.trim);
  img.rect(16, by + 15, 2, 5, s.armorD);
  // 身体：鳞甲 + 金色护心镜
  img.rect(10, by + 4, 14, 11, s.armor);
  for (let y = by + 5; y < by + 13; y += 2) for (let x = 11 + ((y + bob) % 2); x < 23; x += 2) img.set(x, y, s.armorD);
  img.disc(17, by + 8, 2, s.trim); img.set(17, by + 8, s.trimL); img.set(16, by + 7, 'w');
  img.rect(10, by + 4, 14, 1, s.trim);
  // 腰带 + 兽面带扣
  img.rect(10, by + 13, 14, 2, s.trim); img.rect(15, by + 12, 4, 4, s.trimL); img.set(16, by + 13, 'k'); img.set(17, by + 13, 'k'); img.rect(16, by + 14, 2, 1, 'R');
  // 兽首肩甲（大而圆，金边）
  for (const [sx, dir] of [[9, -1], [24, 1]] as [number, number][]) {
    ellipse(img, sx, by + 5, 4, 3, s.armor);
    ellipse(img, sx, by + 4, 3, 1.5, s.armorD);
    img.line(sx - 4, by + 7, sx + 4, by + 7, s.trim);
    img.set(sx + dir, by + 4, s.trimL); img.set(sx + dir * 2, by + 3, 'w');
    img.set(sx - dir, by + 5, 'k');
  }
  // 手臂：左手按腰，右手握兵器
  img.rect(6, by + 7, 3, 6, s.robe); img.rect(6, by + 12, 4, 3, s.skin); img.rect(6, by + 12, 4, 1, s.trim);
  img.rect(25, by + 7, 3, 5, s.robe); img.rect(25, by + 11, 4, 3, s.skin); img.rect(25, by + 11, 4, 1, s.trim);
  // 兵器（光芒两帧一闪）
  weapon(img, s, 26, by + 12, f % 2 === 0);
  // 头
  head(img, s, 8, by - 12 + 1);
  // 右手压在兵器上
  img.rect(25, by + 12, 4, 2, s.skin);
  return img.outline();
}

export function awakenFrames(id: HeroId): PixelImage[] {
  const s = STYLES[id] || STYLES.zhaoyun;
  return [0, 1, 2, 3].map((f) => frame(s, f));
}
