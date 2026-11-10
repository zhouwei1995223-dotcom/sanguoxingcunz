import { PixelImage } from '../pixel';
import type { HeroId } from './heroes';

// 五星觉醒造型：下马步战的 Q 版造型（金边铠甲、兽首肩甲、飘动披风、发光兵器），大小和骑马造型差不多。
// 全部由参数拼出来：同一套身体，换头饰、配色、胡须、兵器，就是不同武将。
// 画布 30×38，8 帧：0~3 走路（迈腿、摆臂、披风飘、缨子晃），4~7 站立待机（呼吸、眨眼、兵器光芒流转）。

type Helm = 'helm' | 'hat' | 'crown' | 'scarf' | 'band' | 'hairpin' | 'lion' | 'coronet' | 'topknot';
type Beard = '' | 'long' | 'bristle' | 'white' | 'full';
type Weapon = 'spear' | 'blade' | 'fork' | 'fan' | 'halberd' | 'bow' | 'lance' | 'chakram' | 'jis' | 'staff' | 'sword' | 'dual' | 'hammer';

interface AwakenStyle {
  helm: Helm;
  helmC: string; helmD: string; plume: string;
  skin: string; hair: string; beard: Beard;
  armor: string; armorD: string; robe: string; trim: string; trimL: string;
  cape: string; capeD: string;
  weapon: Weapon; wMetal: string; wGlow: string;
}

const STYLES: Partial<Record<HeroId, AwakenStyle>> = {
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
  // —— 1.1.0 新增二十位 ——
  liubei: { helm: 'coronet', helmC: 'Y', helmD: 'y', plume: 'R', skin: 'q', hair: 'k', beard: 'long', armor: 'y', armorD: 'o', robe: 'G', trim: 'Y', trimL: 'w', cape: 'G', capeD: 'd', weapon: 'dual', wMetal: 'S', wGlow: 'Y' },
  weiyan: { helm: 'helm', helmC: 'n', helmD: 'K', plume: 'R', skin: 'l', hair: 'k', beard: 'full', armor: 'N', armorD: 'n', robe: 'r', trim: 'y', trimL: 'Y', cape: 'R', capeD: 'r', weapon: 'blade', wMetal: 'S', wGlow: 'R' },
  caocao: { helm: 'coronet', helmC: 'Y', helmD: 'o', plume: 'R', skin: 'q', hair: 'k', beard: 'long', armor: 'b', armorD: 'K', robe: 'B', trim: 'y', trimL: 'Y', cape: 'R', capeD: 'r', weapon: 'sword', wMetal: 'w', wGlow: 'B' },
  xiahoudun: { helm: 'helm', helmC: 'S', helmD: 'N', plume: 'w', skin: 'q', hair: 'k', beard: 'bristle', armor: 'S', armorD: 'N', robe: 'b', trim: 'y', trimL: 'Y', cape: 'b', capeD: 'K', weapon: 'blade', wMetal: 'S', wGlow: 'B' },
  zhangliao: { helm: 'lion', helmC: 'S', helmD: 's', plume: 'c', skin: 'q', hair: 'k', beard: '', armor: 'S', armorD: 's', robe: 'B', trim: 'y', trimL: 'Y', cape: 'B', capeD: 'b', weapon: 'halberd', wMetal: 'S', wGlow: 'c' },
  xuchu: { helm: 'topknot', helmC: 'R', helmD: 'r', plume: 'R', skin: 'E', hair: 'k', beard: 'full', armor: 'u', armorD: 'U', robe: 'o', trim: 'y', trimL: 'Y', cape: 'o', capeD: 'U', weapon: 'hammer', wMetal: 'N', wGlow: 'y' },
  simayi: { helm: 'hat', helmC: 'K', helmD: 'k', plume: 'M', skin: 'q', hair: 'k', beard: 'long', armor: 'm', armorD: 'z', robe: 'm', trim: 'M', trimL: 'f', cape: 'K', capeD: 'k', weapon: 'fan', wMetal: 'M', wGlow: 'M' },
  xiahouyuan: { helm: 'helm', helmC: 'G', helmD: 'd', plume: 'Y', skin: 'q', hair: 'k', beard: '', armor: 'G', armorD: 'd', robe: 'g', trim: 'y', trimL: 'Y', cape: 'y', capeD: 'U', weapon: 'bow', wMetal: 'Y', wGlow: 'g' },
  zhenji: { helm: 'hairpin', helmC: 'z', helmD: 'k', plume: 'c', skin: 'e', hair: 'z', beard: '', armor: 'B', armorD: 'b', robe: 'w', trim: 'c', trimL: 'w', cape: 'c', capeD: 'B', weapon: 'chakram', wMetal: 'c', wGlow: 'w' },
  sunce: { helm: 'band', helmC: 'Y', helmD: 'y', plume: 'Y', skin: 'q', hair: 'k', beard: '', armor: 'R', armorD: 'r', robe: 'f', trim: 'y', trimL: 'Y', cape: 'y', capeD: 'U', weapon: 'spear', wMetal: 'w', wGlow: 'R' },
  zhouyu: { helm: 'helm', helmC: 'S', helmD: 's', plume: 'R', skin: 'e', hair: 'k', beard: '', armor: 'w', armorD: 'S', robe: 'R', trim: 'y', trimL: 'Y', cape: 'R', capeD: 'r', weapon: 'sword', wMetal: 'w', wGlow: 'o' },
  ganning: { helm: 'band', helmC: 'B', helmD: 'b', plume: 'w', skin: 'E', hair: 'k', beard: '', armor: 'y', armorD: 'u', robe: 'B', trim: 'Y', trimL: 'w', cape: 'B', capeD: 'K', weapon: 'chakram', wMetal: 'Y', wGlow: 'Y' },
  taishici: { helm: 'helm', helmC: 'u', helmD: 'U', plume: 'o', skin: 'q', hair: 'k', beard: 'bristle', armor: 'u', armorD: 'U', robe: 'G', trim: 'y', trimL: 'Y', cape: 'G', capeD: 'd', weapon: 'bow', wMetal: 'Y', wGlow: 'o' },
  luxun: { helm: 'scarf', helmC: 'l', helmD: 'U', plume: 'w', skin: 'e', hair: 'k', beard: '', armor: 'p', armorD: 'e', robe: 'w', trim: 'l', trimL: 'L', cape: 'l', capeD: 'U', weapon: 'sword', wMetal: 'y', wGlow: 'o' },
  xiaoqiao: { helm: 'hairpin', helmC: 'U', helmD: 'z', plume: 'f', skin: 'e', hair: 'U', beard: '', armor: 'f', armorD: 'M', robe: 'w', trim: 'y', trimL: 'Y', cape: 'f', capeD: 'M', weapon: 'fan', wMetal: 'f', wGlow: 'f' },
  diaochan: { helm: 'hairpin', helmC: 'k', helmD: 'k', plume: 'R', skin: 'e', hair: 'k', beard: '', armor: 'M', armorD: 'm', robe: 'f', trim: 'y', trimL: 'Y', cape: 'R', capeD: 'r', weapon: 'chakram', wMetal: 'f', wGlow: 'M' },
  dongzhuo: { helm: 'coronet', helmC: 'Y', helmD: 'o', plume: 'M', skin: 'E', hair: 'k', beard: 'full', armor: 'n', armorD: 'K', robe: 'm', trim: 'y', trimL: 'Y', cape: 'm', capeD: 'z', weapon: 'blade', wMetal: 'Y', wGlow: 'o' },
  zhangjiao: { helm: 'scarf', helmC: 'Y', helmD: 'y', plume: 'w', skin: 'q', hair: 'k', beard: 'long', armor: 'Y', armorD: 'y', robe: 'w', trim: 'o', trimL: 'Y', cape: 'y', capeD: 'U', weapon: 'staff', wMetal: 'Y', wGlow: 'Y' },
  huatuo: { helm: 'topknot', helmC: 'G', helmD: 'd', plume: 'g', skin: 'q', hair: 'w', beard: 'white', armor: 'g', armorD: 'G', robe: 'w', trim: 'G', trimL: 'g', cape: 'p', capeD: 'u', weapon: 'staff', wMetal: 'g', wGlow: 'g' },
  zuoci: { helm: 'scarf', helmC: 't', helmD: 'k', plume: 'c', skin: 'q', hair: 'w', beard: 'white', armor: 't', armorD: 'k', robe: 'c', trim: 'B', trimL: 'c', cape: 't', capeD: 'k', weapon: 'staff', wMetal: 'c', wGlow: 'c' },
};

const W = 30, H = 38;

function ellipse(img: PixelImage, cx: number, cy: number, rx: number, ry: number, c: string, yMax = 999) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (y > yMax) continue;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) img.set(x, y, c);
    }
  }
}

interface Pose { bob: number; stride: number; arm: number; wave: number; sway: number; blink: boolean; glow: number }

/** 头部：脸 13 宽，左上角 (ox, oy)；sway 让缨子 / 翎子 / 飘带左右晃 */
function head(img: PixelImage, s: AwakenStyle, ox: number, oy: number, ps: Pose) {
  const cx = ox + 6;
  const sw = ps.sway;
  // 脸
  img.rect(ox + 1, oy + 4, 11, 7, s.skin);
  img.rect(ox + 2, oy + 11, 9, 1, s.skin);
  img.rect(ox + 4, oy + 12, 5, 1, s.skin);
  img.rect(ox + 1, oy + 4, 11, 1, s.hair);
  img.set(ox + 1, oy + 5, s.hair); img.set(ox + 11, oy + 5, s.hair); img.set(ox + 5, oy + 5, s.hair);
  // 眉、眼（待机时偶尔眨眼）
  img.set(ox + 2, oy + 6, 'k'); img.set(ox + 3, oy + 6, 'k'); img.set(ox + 9, oy + 6, 'k'); img.set(ox + 10, oy + 6, 'k');
  for (const ex of [ox + 3, ox + 8]) {
    if (ps.blink) img.rect(ex, oy + 8, 2, 1, 'k');
    else { img.rect(ex, oy + 7, 2, 2, 'k'); img.set(ex, oy + 7, 'w'); }
  }
  if (s.helm === 'hairpin') { img.set(ox + 2, oy + 9, 'f'); img.set(ox + 10, oy + 9, 'f'); }
  img.set(cx, oy + 10, 'U');
  // 胡须
  if (s.beard === 'long') { img.rect(ox + 3, oy + 10, 7, 2, 'k'); img.rect(ox + 4, oy + 12, 5, 2, 'k'); img.rect(ox + 5 + (sw > 0 ? 1 : 0), oy + 14, 3, 2, 'k'); img.set(cx, oy + 10, 'U'); }
  if (s.beard === 'white') { img.rect(ox + 3, oy + 10, 7, 2, 'w'); img.rect(ox + 4, oy + 12, 5, 2, 'S'); img.set(cx, oy + 14, 'S'); }
  if (s.beard === 'bristle' || s.beard === 'full') {
    img.rect(ox + 1, oy + 9, 1, 2, 'k'); img.rect(ox + 11, oy + 9, 1, 2, 'k');
    img.rect(ox + 2, oy + 10, 9, 2, 'k'); img.rect(ox + 4, oy + 12, 5, 1, 'k');
    if (s.beard === 'bristle') { img.set(ox, oy + 10, 'k'); img.set(ox + 12, oy + 10, 'k'); }
    img.set(cx, oy + 10, 'R');
  }
  // 头饰
  switch (s.helm) {
    case 'helm': case 'lion': {
      ellipse(img, cx, oy + 4, 7, 4.5, s.helmC, oy + 4);
      for (let x = ox; x <= ox + 12; x++) img.set(x, oy + 4, s.helmD);
      img.set(cx - 3, oy + 1, 'w'); img.set(cx - 2, oy + 1, 'w');
      img.rect(cx - 1, oy + 1, 3, 2, s.trim === 'B' ? 'y' : s.trim); img.set(cx, oy + 1, 'R');
      img.rect(ox, oy + 4, 1, 5, s.helmC); img.rect(ox + 12, oy + 4, 1, 5, s.helmC);
      if (s.helm === 'lion') {
        img.rect(cx - 2, oy - 2, 5, 2, s.helmC); img.set(cx - 1, oy - 1, 'k'); img.set(cx + 1, oy - 1, 'k');
        img.set(cx - 2, oy - 3, s.helmC); img.set(cx + 2, oy - 3, s.helmC);
        img.rect(cx + 3, oy - 2, 2, 2, s.plume); img.rect(cx + 4 + sw, oy, 2, 2, s.plume); img.rect(cx + 5 + sw, oy + 2, 2, 3, s.plume);
      } else {
        img.rect(cx - 1 + sw, oy - 4, 3, 2, s.plume); img.rect(cx - 1, oy - 2, 3, 2, s.plume); img.set(cx + sw, oy - 5, s.plume);
      }
      break;
    }
    case 'hat':
      img.rect(ox + 1, oy - 1, 11, 5, s.helmC); img.rect(ox + 2, oy - 3, 9, 2, s.helmC); img.rect(ox + 3, oy - 4, 7, 1, s.helmD);
      img.rect(ox + 1, oy + 3, 11, 1, s.helmD);
      img.rect(cx - 1, oy, 3, 2, 'y'); img.set(cx, oy, 'R');
      img.rect(ox - 1, oy + 1, 2, 4 + (sw > 0 ? 1 : 0), s.helmD); img.rect(ox + 12, oy + 1, 2, 4 + (sw < 0 ? 1 : 0), s.helmD);
      break;
    case 'crown':
      img.rect(ox + 1, oy + 1, 11, 3, s.hair);
      img.rect(cx - 3, oy - 1, 7, 3, s.helmC); img.rect(cx - 3, oy + 1, 7, 1, s.helmD);
      img.set(cx - 3, oy - 2, s.helmC); img.set(cx, oy - 2, s.helmC); img.set(cx + 3, oy - 2, s.helmC); img.set(cx, oy, 'R');
      // 两根雉鸡翎随走路摇摆
      img.line(cx - 2, oy - 2, cx - 6 + sw, oy - 8, s.plume); img.line(cx - 1, oy - 2, cx - 5 + sw, oy - 8, 'o');
      img.line(cx + 2, oy - 2, cx + 6 + sw, oy - 8, s.plume); img.line(cx + 3, oy - 2, cx + 7 + sw, oy - 8, 'o');
      img.set(cx - 6 + sw, oy - 9, 'Y'); img.set(cx + 7 + sw, oy - 9, 'Y');
      break;
    case 'scarf':
      img.rect(ox + 1, oy, 11, 4, s.helmC); img.rect(ox + 3, oy - 2, 7, 2, s.helmC); img.set(cx, oy - 2, 'w');
      img.rect(ox + 11, oy + 2, 2, 1, 'w'); img.rect(ox + 12 + (sw > 0 ? 1 : 0), oy + 3, 1, 3, 'w');
      break;
    case 'band':
      ellipse(img, cx, oy + 4, 6, 3.5, s.skin, oy + 4);
      img.rect(ox + 1, oy + 2, 11, 2, s.helmC); img.rect(ox + 12, oy + 3, 2, 1, s.helmC); img.rect(ox + 13 + (sw > 0 ? 1 : 0), oy + 4, 1, 3, s.helmD);
      img.set(cx, oy + 2, 'y');
      break;
    case 'coronet':
      // 束发金冠：发髻上一顶小冠，横贯一支长簪
      img.rect(ox + 1, oy + 1, 11, 3, s.hair);
      img.rect(cx - 2, oy - 3, 5, 4, s.helmC); img.rect(cx - 2, oy, 5, 1, s.helmD);
      img.set(cx, oy - 2, 'R'); img.set(cx, oy - 4, s.helmC);
      img.rect(cx - 5, oy - 1, 11, 1, s.helmD); img.set(cx + 6 + (sw > 0 ? 1 : 0), oy - 1, s.plume);
      break;
    case 'topknot':
      // 椎髻：头顶一个发髻，束一条发带，带梢随走路晃
      ellipse(img, cx, oy + 4, 6, 3.5, s.hair, oy + 4);
      img.disc(cx, oy - 1, 2, s.hair); img.rect(cx - 2, oy + 1, 5, 1, s.helmC);
      img.rect(cx + 2, oy, 2, 1, s.helmC); img.rect(cx + 3 + sw, oy + 1, 1, 2, s.helmD);
      break;
    case 'hairpin':
      ellipse(img, cx, oy + 3, 7, 3.5, s.hair, oy + 4);
      img.disc(ox + 1, oy, 2, s.hair); img.disc(ox + 11, oy, 2, s.hair);
      img.rect(ox, oy + 4, 1, 6, s.hair); img.rect(ox + 12, oy + 4, 1, 6, s.hair);
      img.set(ox + 1, oy - 1, s.plume); img.set(ox + 2, oy, 'f');
      img.line(ox + 11, oy - 1, ox + 13 + sw, oy - 3, 'Y'); img.set(ox + 13 + sw, oy - 2, 'R');
      img.rect(cx - 1, oy + 1, 3, 1, 'Y');
      break;
  }
}

/** 兵器：竖握在身体右侧，(hx, hy) 是握持点；glow 0~3 决定光点转到哪个位置 */
function weapon(img: PixelImage, s: AwakenStyle, hx: number, hy: number, glow: number) {
  const m = s.wMetal, gl = s.wGlow;
  const shaft = (top: number, bot: number, c = 'U') => { img.rect(hx, top, 1, bot - top, c); };
  // 光点：在兵器头部四周轮流闪
  const spark = (x: number, y: number) => {
    const pts = [[-2, -1], [2, -2], [2, 1], [-2, 2]];
    const [dx, dy] = pts[glow % 4];
    img.set(x + dx, y + dy, gl);
    img.set(x - dx, y - dy, glow % 2 ? 'w' : gl);
  };
  switch (s.weapon) {
    case 'spear': case 'lance':
      shaft(hy - 15, hy + 10, s.weapon === 'lance' ? 's' : 'U');
      img.rect(hx, hy - 19, 1, 4, m); img.set(hx - 1, hy - 17, m); img.set(hx + 1, hy - 17, m); img.set(hx, hy - 20, 'w');
      img.rect(hx - 1, hy - 15, 3, 1, 'y');
      if (s.weapon === 'lance') img.rect(hx - 1, hy - 14, 3, 1, 'S');
      else { img.set(hx - 1, hy - 14, 'R'); img.set(hx + 1, hy - 14, 'R'); img.set(hx - 1, hy - 13, 'r'); }
      spark(hx, hy - 18);
      break;
    case 'blade':
      shaft(hy - 12, hy + 10);
      img.rect(hx, hy - 19, 3, 7, m); img.rect(hx + 3, hy - 18, 1, 4, m); img.line(hx + 2, hy - 19, hx + 3, hy - 15, 'w');
      img.rect(hx - 1, hy - 12, 3, 1, 'G');
      spark(hx + 2, hy - 16);
      break;
    case 'fork':
      shaft(hy - 14, hy + 10, 'n');
      img.rect(hx, hy - 18, 1, 4, m); img.set(hx - 1, hy - 17, m); img.set(hx + 1, hy - 16, m); img.set(hx - 1, hy - 15, m); img.set(hx, hy - 19, 'w');
      img.rect(hx - 1, hy - 14, 3, 1, 'y'); img.set(hx - 1, hy - 13, 'R'); img.set(hx + 1, hy - 13, 'R');
      spark(hx, hy - 17);
      break;
    case 'halberd':
      shaft(hy - 15, hy + 10, 'R');
      img.rect(hx, hy - 21, 1, 6, m); img.set(hx, hy - 22, 'w');
      img.rect(hx - 3, hy - 18, 3, 1, m); img.rect(hx - 4, hy - 20, 1, 4, m);
      img.rect(hx + 1, hy - 18, 3, 1, m); img.rect(hx + 4, hy - 20, 1, 4, m);
      img.rect(hx - 1, hy - 15, 3, 1, 'y');
      spark(hx, hy - 19);
      break;
    case 'staff':
      shaft(hy - 15, hy + 10, 'K');
      img.ring(hx, hy - 18, 3, s.trim); img.set(hx, hy - 18, 'w'); img.set(hx, hy - 22, 'Y');
      spark(hx, hy - 18);
      break;
    case 'fan': {
      const fy = hy - 8;
      img.rect(hx, fy + 4, 1, 4, 'U');
      ellipse(img, hx, fy, 3, 4, 'w'); img.line(hx, fy - 3, hx, fy + 3, 's'); img.rect(hx - 1, fy + 4, 3, 1, 'y');
      spark(hx, fy - 1);
      break;
    }
    case 'bow':
      img.line(hx + 2, hy - 15, hx + 4, hy - 10, 'U'); img.line(hx + 4, hy - 10, hx + 4, hy - 1, 'U'); img.line(hx + 4, hy - 1, hx + 2, hy + 3, 'U');
      img.line(hx + 2, hy - 15, hx + 2, hy + 3, 'w');
      img.rect(hx, hy - 13, 1, 14, 'Y'); img.set(hx, hy - 14, 'S');
      spark(hx + 4, hy - 8);
      break;
    case 'chakram':
      img.ring(hx + 1, hy - 3, 3, m); img.set(hx + 1, hy - 6, 'w');
      img.ring(7, hy + 5, 2, m);
      spark(hx + 1, hy - 3);
      break;
    case 'sword': case 'dual':
      for (const x0 of s.weapon === 'dual' ? [hx, 6] : [hx]) {
        img.rect(x0, hy - 14, 1, 12, m); img.set(x0, hy - 15, 'w');
        img.rect(x0 - 1, hy - 2, 3, 1, 'y'); img.rect(x0, hy - 1, 1, 3, 'U'); img.set(x0, hy + 2, s.trimL);
      }
      spark(hx, hy - 12);
      break;
    case 'hammer':
      shaft(hy - 12, hy + 10, 'U');
      img.rect(hx - 3, hy - 18, 7, 6, m); img.rect(hx - 2, hy - 19, 5, 1, m); img.rect(hx - 2, hy - 12, 5, 1, m);
      img.rect(hx - 3, hy - 16, 7, 1, 'y'); img.rect(hx - 2, hy - 18, 2, 2, 'S'); img.set(hx - 2, hy - 18, 'w');
      spark(hx, hy - 15);
      break;
    case 'jis':
      for (const x0 of [hx, 6]) {
        img.rect(x0, hy - 10, 1, 14, 'K');
        img.rect(x0, hy - 13, 1, 3, m); img.rect(x0 + 1, hy - 12, 2, 1, m); img.rect(x0 + 2, hy - 13, 1, 3, m);
        img.rect(x0 - 1, hy - 10, 3, 1, 'y');
      }
      spark(hx + 1, hy - 12);
      break;
  }
}

function frame(s: AwakenStyle, ps: Pose): PixelImage {
  const img = new PixelImage(W, H);
  const by = 21 + ps.bob; // 身体顶部
  // 披风：每行按正弦波错开，走路时飘得更大
  for (let y = 0; y < 13; y++) {
    const spread = Math.min(2, Math.floor(y / 4));
    const off = y > 4 ? Math.round(Math.sin(y * 0.7 + ps.wave) * (y / 8)) : 0;
    const x0 = 8 - spread + off, x1 = 21 + spread + off;
    img.rect(x0, by + 2 + y, x1 - x0, 1, y > 9 ? s.capeD : s.cape);
    img.set(x0, by + 2 + y, s.capeD); img.set(x1 - 1, by + 2 + y, s.capeD);
  }
  const lastOff = Math.round(Math.sin(12 * 0.7 + ps.wave) * 1.5);
  for (let x = 7 + lastOff; x < 23 + lastOff; x += 2) img.set(x, by + 14, s.trim);
  // 腿与靴：迈步时一条腿前伸（抬高一格），另一条后撤
  const L = ps.stride, R = -ps.stride;
  img.rect(10, by + 10 + Math.max(0, -L), 3, 4 - Math.abs(L), s.armorD);
  img.rect(16, by + 10 + Math.max(0, -R), 3, 4 - Math.abs(R), s.armorD);
  img.rect(9 - (L > 0 ? 1 : 0), by + 13 - Math.max(0, L), 5, 2, 'K'); img.rect(9 - (L > 0 ? 1 : 0), by + 13 - Math.max(0, L), 5, 1, s.trim);
  img.rect(15 + (R > 0 ? 1 : 0), by + 13 - Math.max(0, R), 5, 2, 'K'); img.rect(15 + (R > 0 ? 1 : 0), by + 13 - Math.max(0, R), 5, 1, s.trim);
  // 战袍下摆
  img.rect(9, by + 8, 5, 4, s.robe); img.rect(15, by + 8, 5, 4, s.robe);
  img.rect(9, by + 11, 5, 1, s.trim); img.rect(15, by + 11, 5, 1, s.trim);
  img.rect(14, by + 8, 1, 3, s.armorD);
  // 身体：鳞甲 + 护心镜 + 腰带兽扣
  img.rect(9, by, 11, 9, s.armor);
  for (let y = by + 1; y < by + 7; y += 2) for (let x = 10 + ((y + ps.bob) % 2); x < 19; x += 2) img.set(x, y, s.armorD);
  img.rect(9, by, 11, 1, s.trim);
  img.set(14, by + 3, s.trimL); img.set(13, by + 3, s.trim); img.set(15, by + 3, s.trim); img.set(14, by + 2, s.trim); img.set(14, by + 4, s.trim);
  img.rect(9, by + 7, 11, 2, s.trim); img.rect(13, by + 7, 3, 2, s.trimL); img.set(14, by + 7, 'k');
  // 兽首肩甲
  for (const [sx, dir] of [[9, -1], [20, 1]] as [number, number][]) {
    ellipse(img, sx, by + 1, 2.5, 2, s.armor);
    img.line(sx - 2, by + 3, sx + 2, by + 3, s.trim);
    img.set(sx + dir, by, s.trimL); img.set(sx, by + 1, 'k');
  }
  // 左臂随走路前后摆
  img.rect(6, by + 2, 2, 4, s.robe);
  img.rect(6, by + 5 + ps.arm, 3, 2, s.skin); img.rect(6, by + 5 + ps.arm, 3, 1, s.trim);
  // 右臂握兵器
  img.rect(21, by + 2, 2, 4, s.robe);
  weapon(img, s, 22, by + 6, ps.glow);
  img.rect(21, by + 5, 3, 2, s.skin);
  head(img, s, 8, by - 12, ps);
  return img.outline();
}

/** 8 帧：0~3 走路，4~7 站立待机 */
export function awakenFrames(id: HeroId): PixelImage[] {
  const s = STYLES[id] || STYLES.zhaoyun!;
  const walk: Pose[] = [0, 1, 2, 3].map((f) => ({ bob: f % 2, stride: [0, 1, 0, -1][f], arm: [0, -1, 0, 1][f], wave: f * 1.6, sway: [0, 1, 0, -1][f], blink: false, glow: f }));
  const idle: Pose[] = [0, 1, 2, 3].map((f) => ({ bob: f >= 2 ? 1 : 0, stride: 0, arm: 0, wave: f * 0.8, sway: [0, 0, 1, 0][f], blink: f === 3, glow: f }));
  return [...walk, ...idle].map((p) => frame(s, p));
}
