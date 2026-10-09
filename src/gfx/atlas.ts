import { getPlatform } from '../platform';
import { PixelImage } from './pixel';
import { heroFramesFor, HERO_IDS } from './art/heroes';
import { soldierFrames, generalFrames } from './art/units';
import { SOLDIER_STYLES, GENERAL_STYLES } from './art/roster';
import * as I from './art/items';
import { decorImage, THEMES } from './art/env';
import { iconImage, ICON_NAMES } from './art/icons';

// 运行时图集：启动时把所有代码生成的像素图打包进若干张大画布。

export interface Sprite {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number; // 锚点（相对左上角）
  ay: number;
}

const sprites: Record<string, Sprite> = {};
const PAGE = 1024;
let page: HTMLCanvasElement | null = null;
let pctx: CanvasRenderingContext2D | null = null;
let shelfX = 0, shelfY = 0, shelfH = 0;

function newPage() {
  page = getPlatform().createCanvas(PAGE, PAGE);
  pctx = page.getContext('2d')!;
  shelfX = 0; shelfY = 0; shelfH = 0;
}

function paint(ctx: CanvasRenderingContext2D, img: PixelImage, ox: number, oy: number) {
  const rgba = img.toRGBA();
  try {
    const id = ctx.createImageData(img.w, img.h);
    id.data.set(rgba);
    ctx.putImageData(id, ox, oy);
    return;
  } catch (e) {}
  // 兜底：逐行合并同色像素后 fillRect
  for (let y = 0; y < img.h; y++) {
    let x = 0;
    while (x < img.w) {
      const i = (y * img.w + x) * 4;
      if (rgba[i + 3] === 0) { x++; continue; }
      let x2 = x + 1;
      while (x2 < img.w) {
        const j = (y * img.w + x2) * 4;
        if (rgba[j] !== rgba[i] || rgba[j + 1] !== rgba[i + 1] || rgba[j + 2] !== rgba[i + 2] || rgba[j + 3] !== rgba[i + 3]) break;
        x2++;
      }
      ctx.fillStyle = `rgba(${rgba[i]},${rgba[i + 1]},${rgba[i + 2]},${rgba[i + 3] / 255})`;
      ctx.fillRect(ox + x, oy + y, x2 - x, 1);
      x = x2;
    }
  }
}

export function addSprite(name: string, img: PixelImage, anchor: 'center' | 'bottom' = 'center') {
  if (!page) newPage();
  const w = img.w + 1, h = img.h + 1;
  if (shelfX + w > PAGE) { shelfX = 0; shelfY += shelfH; shelfH = 0; }
  if (shelfY + h > PAGE) newPage();
  paint(pctx!, img, shelfX, shelfY);
  sprites[name] = {
    canvas: page!, x: shelfX, y: shelfY, w: img.w, h: img.h,
    ax: Math.floor(img.w / 2), ay: anchor === 'bottom' ? img.h - 2 : Math.floor(img.h / 2),
  };
  shelfX += w;
  shelfH = Math.max(shelfH, h);
}

export function sprite(name: string): Sprite {
  return sprites[name] || sprites['icon_star'];
}

export function hasSprite(name: string) {
  return !!sprites[name];
}

const whiteMap = (img: PixelImage) => {
  const w = img.clone();
  w.px = w.px.map((c) => (c === '.' ? '.' : c === 'h' ? 'h' : 'w'));
  return w;
};

/** 单位：生成 右/左 × 普通/受击闪白 四套 */
function addUnit(name: string, frames: PixelImage[]) {
  frames.forEach((f, i) => {
    addSprite(`${name}_${i}`, f, 'bottom');
    addSprite(`${name}_${i}_L`, f.flipX(), 'bottom');
    addSprite(`${name}_${i}_W`, whiteMap(f), 'bottom');
    addSprite(`${name}_${i}_LW`, whiteMap(f.flipX()), 'bottom');
  });
}

export function buildAtlas() {
  for (const id of HERO_IDS) addUnit('hero_' + id, heroFramesFor(id));
  for (const k in SOLDIER_STYLES) addUnit('u_' + k, soldierFrames(SOLDIER_STYLES[k]));
  for (const k in GENERAL_STYLES) addUnit('u_' + k, generalFrames(GENERAL_STYLES[k]));

  [0, 1, 2].forEach((k) => addSprite('gem' + k, I.gem(k as 0)));
  I.coinFrames().forEach((c, i) => addSprite('coin' + i, c));
  addSprite('bun', I.bun());
  addSprite('magnet', I.magnet());
  addSprite('bomb', I.bomb());
  addSprite('chest', I.chest(false));
  addSprite('chest_open', I.chest(true));
  addSprite('chest_gold', I.chest(false, true));
  I.lanternFrames().forEach((c, i) => addSprite('lantern' + i, c, 'bottom'));
  addSprite('cart', I.cart(), 'bottom');
  addSprite('arrow', I.arrow());
  addSprite('bolt', I.bolt());
  addSprite('bolt_evo', I.bolt().recolor({ U: 'y', S: 'Y' }));
  addSprite('fsword', I.flyingSword());
  addSprite('pot', I.firePot());
  I.flameFrames().forEach((c, i) => addSprite('flame' + i, c, 'bottom'));
  addSprite('stone', I.stone());
  addSprite('fork', I.forkProj());
  I.sparkFrames().forEach((c, i) => addSprite('spark' + i, c));
  I.puffFrames().forEach((c, i) => addSprite('puff' + i, c));
  I.explosionFrames().forEach((c, i) => addSprite('explo' + i, c));
  addSprite('shadow_s', I.shadow(8));
  addSprite('shadow_m', I.shadow(14));
  addSprite('shadow_l', I.shadow(22));
  const digitColors: Record<string, string> = { w: 'w', y: 'Y', r: 'R', g: 'g' };
  for (const col in digitColors) for (const d of I.DIGIT_CHARS) addSprite(`d_${col}_${d}`, I.digit(d, digitColors[col]));

  // 场景装饰：每个主题一套换色
  for (const theme in THEMES) {
    const th = THEMES[theme];
    for (const [d] of th.decor) {
      let img = decorImage(d);
      if (th.recolor) img = img.recolor(th.recolor);
      addSprite(`env_${theme}_${d}`, img, 'bottom');
    }
  }
  ICON_NAMES.forEach((n) => addSprite('icon_' + n, iconImage(n)));
}
