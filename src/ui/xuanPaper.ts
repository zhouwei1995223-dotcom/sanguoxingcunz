import { getPlatform } from '../platform';

/**
 * 程序化手工宣纸肌理（第二版：整张不重复 + 淡雅）
 *
 * 旧版用 256×256 小瓦片平铺，纹理浓且一眼能看出重复。新版改为：
 * 1. 一整张「宣纸大页」（覆盖 800×1800 逻辑像素，非周期值噪声），按屏幕坐标取样，
 *    所有面板 / 按钮 / 格子像是从同一张纸上裁下来的，全屏范围内没有任何重复。
 *    内容：低频云絮厚薄 + 中频纸浆絮团 + 稀疏细短的檀皮纤维 + 极少量草节微点。
 * 2. 一层 128×128 的纯随机微颗粒（白噪声平铺，肉眼无法察觉周期）。
 * 3. 极淡的边缘包浆（只做轻微收边，不再画水渍圈）。
 */

/** 大页覆盖的逻辑尺寸与采样比例（1 逻辑像素 = SHEET_K 个纹理像素） */
const LOGIC_W = 800;
const LOGIC_H = 1800;
const SHEET_K = 0.8;
const SW = Math.round(LOGIC_W * SHEET_K);
const SH = Math.round(LOGIC_H * SHEET_K);

let sheet: HTMLCanvasElement | null = null;
let grainTile: HTMLCanvasElement | null = null;
let grainPattern: CanvasPattern | null = null;
let grainCtx: CanvasRenderingContext2D | null = null;

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 整数格点哈希 → [0,1) */
function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 非周期值噪声（smoothstep 双线性插值），返回 [-1,1] */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

function ensureSheet(): HTMLCanvasElement {
  if (sheet) return sheet;
  const canvas = getPlatform().createCanvas(SW, SH);
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(SW, SH);
  const data = img.data;

  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      // 低频：纸张整体厚薄（大片云状明暗）
      const low = fbm(x / 210, y / 210, 3, 11);
      // 中频：宣纸特有的纸浆絮团（云絮状），用 |noise| 做出絮状脉络
      const mid = 1 - Math.abs(fbm(x / 38 + 13.7, y / 46 - 5.1, 3, 29)) * 2;
      const v = low * 0.6 + mid * 0.4 - 0.12;
      const idx = (y * SW + x) * 4;
      if (v >= 0) {
        // 厚处偏亮（纤维堆积反光）
        data[idx] = 255; data[idx + 1] = 252; data[idx + 2] = 242;
        data[idx + 3] = Math.min(22, Math.round(v * 34));
      } else {
        // 薄处透出暖褐底色
        data[idx] = 128; data[idx + 1] = 96; data[idx + 2] = 58;
        data[idx + 3] = Math.min(18, Math.round(-v * 30));
      }
    }
  }
  g.putImageData(img, 0, 0);

  const rand = mulberry32(20261106);
  g.lineCap = 'round';

  // 稀疏细短的檀皮纤维：整张纸约 1100 根（密度约为旧版的 1/8），淡而细
  for (let i = 0; i < 1100; i++) {
    const x0 = rand() * SW, y0 = rand() * SH;
    const len = 3 + rand() * rand() * 16;
    const ang = rand() < 0.6 ? (rand() - 0.5) * 0.9 : rand() * Math.PI * 2;
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const bend = (rand() - 0.5) * len * 0.6;
    const cx = (x0 + x1) / 2 - Math.sin(ang) * bend, cy = (y0 + y1) / 2 + Math.cos(ang) * bend;
    const r = rand();
    if (r < 0.62) g.strokeStyle = `rgba(112,82,48,${(0.05 + rand() * 0.08).toFixed(3)})`;
    else g.strokeStyle = `rgba(255,253,246,${(0.12 + rand() * 0.14).toFixed(3)})`;
    g.lineWidth = 0.45 + rand() * 0.45;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx, cy, x1, y1);
    g.stroke();
  }

  // 极少量草节微点
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(92,66,38,${(0.06 + rand() * 0.1).toFixed(3)})`;
    const s = 0.6 + rand() * 0.9;
    g.fillRect(rand() * SW, rand() * SH, s, s);
  }

  sheet = canvas;
  return canvas;
}

function getGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!grainTile) {
    const S = 128;
    const c = getPlatform().createCanvas(S, S);
    const g = c.getContext('2d')!;
    const img = g.createImageData(S, S);
    const rand = mulberry32(7);
    for (let i = 0; i < S * S; i++) {
      const v = rand() - 0.5;
      const k = i * 4;
      if (v > 0) { img.data[k] = 255; img.data[k + 1] = 252; img.data[k + 2] = 244; }
      else { img.data[k] = 110; img.data[k + 1] = 84; img.data[k + 2] = 54; }
      img.data[k + 3] = Math.round(Math.abs(v) * 20);
    }
    g.putImageData(img, 0, 0);
    grainTile = c;
  }
  if (grainPattern && grainCtx === ctx) return grainPattern;
  try {
    grainPattern = ctx.createPattern(grainTile, 'repeat');
    grainCtx = ctx;
  } catch {
    grainPattern = null;
  }
  return grainPattern;
}

export interface XuanTextureOpts {
  /** 肌理强度系数（默认 1） */
  alpha?: number;
  /** 是否绘制极淡的边缘包浆（默认 true） */
  patina?: boolean;
  /** 包浆浓度系数（默认 1） */
  patinaStrength?: number;
  /** 兼容旧参数，已不再绘制水渍圈 */
  stains?: boolean;
}

/**
 * 在指定矩形区域叠加宣纸肌理。纹理按屏幕逻辑坐标取样，相邻组件纹理连续、全屏不重复。
 */
export function drawXuanTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  u: number,
  opts: XuanTextureOpts = {}
) {
  if (w <= 4 || h <= 4 || u <= 0) return;
  const alpha = Math.min(1, opts.alpha ?? 1);
  const patina = opts.patina ?? true;
  const pScale = opts.patinaStrength ?? 1;
  const tex = ensureSheet();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;

  // 1. 从整张宣纸大页上按屏幕位置裁取
  let sx = (x / u) * SHEET_K, sy = (y / u) * SHEET_K;
  let sw = (w / u) * SHEET_K, sh = (h / u) * SHEET_K;
  let dx = x, dy = y, dw = w, dh = h;
  const pxPerTex = u / SHEET_K;
  if (sx < 0) { dx -= sx * pxPerTex; dw += sx * pxPerTex; sw += sx; sx = 0; }
  if (sy < 0) { dy -= sy * pxPerTex; dh += sy * pxPerTex; sh += sy; sy = 0; }
  if (sx + sw > SW) { const cut = sx + sw - SW; sw -= cut; dw -= cut * pxPerTex; }
  if (sy + sh > SH) { const cut = sy + sh - SH; sh -= cut; dh -= cut * pxPerTex; }
  if (sw > 1 && sh > 1 && dw > 1 && dh > 1) ctx.drawImage(tex, sx, sy, sw, sh, dx, dy, dw, dh);

  // 2. 微颗粒
  const gp = getGrain(ctx);
  if (gp) {
    ctx.fillStyle = gp;
    ctx.fillRect(x, y, w, h);
  }

  // 3. 极淡的边缘包浆（仅轻微收边）
  if (patina && w >= 60 * u && h >= 40 * u) {
    ctx.globalAlpha = 1;
    const edge = Math.min(24 * u, Math.min(w, h) * 0.18);
    const a = (0.055 * pScale * alpha).toFixed(3);
    const col = `rgba(120,88,50,${a})`, clear = 'rgba(120,88,50,0)';
    const sides: [number, number, number, number, number, number, number, number][] = [
      [x, y, x, y + edge, x, y, w, edge],
      [x, y + h, x, y + h - edge, x, y + h - edge, w, edge],
      [x, y, x + edge, y, x, y, edge, h],
      [x + w, y, x + w - edge, y, x + w - edge, y, edge, h],
    ];
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of sides) {
      const gr = ctx.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, col);
      gr.addColorStop(1, clear);
      ctx.fillStyle = gr;
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  ctx.restore();
}
