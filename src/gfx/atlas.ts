import { getPlatform } from '../platform';
import { PixelImage } from './pixel';
import { heroFramesFor, heroSkinFrames, HERO_IDS } from './art/heroes';
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
  /** 原始像素（用于生成放大版本） */
  rgba?: Uint8ClampedArray;
  key?: string;
}

// 图集页：原尺寸精灵一组页，放大后的精灵缓存另一组页
interface Packer {
  size: number;
  page: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  x: number;
  y: number;
  rowH: number;
}

const sprites: Record<string, Sprite> = {};
const base: Packer = { size: 1024, page: null, ctx: null, x: 0, y: 0, rowH: 0 };
const big: Packer = { size: 1024, page: null, ctx: null, x: 0, y: 0, rowH: 0 };

function alloc(pk: Packer, w: number, h: number): [number, number] {
  if (!pk.page) newPage(pk);
  if (pk.x + w + 1 > pk.size) { pk.x = 0; pk.y += pk.rowH; pk.rowH = 0; }
  if (pk.y + h + 1 > pk.size) newPage(pk);
  const pos: [number, number] = [pk.x, pk.y];
  pk.x += w + 1;
  pk.rowH = Math.max(pk.rowH, h + 1);
  return pos;
}

function newPage(pk: Packer) {
  pk.page = getPlatform().createCanvas(pk.size, pk.size);
  pk.ctx = pk.page.getContext('2d')!;
  pk.x = 0; pk.y = 0; pk.rowH = 0;
}

/** 把 RGBA 像素按整数倍 k 写入画布（最近邻放大，不依赖画布的平滑设置） */
function paint(ctx: CanvasRenderingContext2D, rgba: Uint8ClampedArray, w: number, h: number, ox: number, oy: number, k = 1) {
  try {
    const id = ctx.createImageData(w * k, h * k);
    const out = id.data;
    if (k === 1) out.set(rgba);
    else {
      const W = w * k;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const si = (y * w + x) * 4;
          if (!rgba[si + 3]) continue;
          for (let dy = 0; dy < k; dy++) {
            let di = ((y * k + dy) * W + x * k) * 4;
            for (let dx = 0; dx < k; dx++, di += 4) { out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3]; }
          }
        }
    }
    ctx.putImageData(id, ox, oy);
    return;
  } catch (e) {}
  // 兜底：逐行合并同色像素后 fillRect
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] === 0) { x++; continue; }
      let x2 = x + 1;
      while (x2 < w) {
        const j = (y * w + x2) * 4;
        if (rgba[j] !== rgba[i] || rgba[j + 1] !== rgba[i + 1] || rgba[j + 2] !== rgba[i + 2] || rgba[j + 3] !== rgba[i + 3]) break;
        x2++;
      }
      ctx.fillStyle = `rgba(${rgba[i]},${rgba[i + 1]},${rgba[i + 2]},${rgba[i + 3] / 255})`;
      ctx.fillRect(ox + x * k, oy + y * k, (x2 - x) * k, k);
      x = x2;
    }
  }
}

export function addSprite(name: string, img: PixelImage, anchor: 'center' | 'bottom' = 'center') {
  const rgba = img.toRGBA();
  const [x, y] = alloc(base, img.w, img.h);
  paint(base.ctx!, rgba, img.w, img.h, x, y);
  sprites[name] = {
    canvas: base.page!, x, y, w: img.w, h: img.h,
    ax: Math.floor(img.w / 2), ay: anchor === 'bottom' ? img.h - 2 : Math.floor(img.h / 2),
    rgba, key: name,
  };
}

const scaledCache: Record<string, Sprite> = {};

/**
 * 取精灵的 k 倍放大版本（首次使用时生成并缓存）。
 * 绘制时以 1:1 像素贴到屏幕上，任何平台都不会被平滑处理糊掉。
 */
export function scaled(s: Sprite, k: number): Sprite {
  k = Math.max(1, Math.round(k));
  if (k === 1 || !s.rgba) return s;
  const key = s.key + '@' + k;
  const c = scaledCache[key];
  if (c) return c;
  const [x, y] = alloc(big, s.w * k, s.h * k);
  paint(big.ctx!, s.rgba, s.w, s.h, x, y, k);
  const r: Sprite = { canvas: big.page!, x, y, w: s.w * k, h: s.h * k, ax: s.ax * k, ay: s.ay * k };
  scaledCache[key] = r;
  return r;
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
  for (const id of HERO_IDS) { addUnit('hero_' + id, heroFramesFor(id)); addUnit('hero_' + id + '_skin', heroSkinFrames(id)); }
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
