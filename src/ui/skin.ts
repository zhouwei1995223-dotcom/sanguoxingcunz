import { getPlatform } from '../platform';
import { xuanSheet } from './xuanPaper';

/**
 * 「鎏金水墨」界面皮肤：面板、按钮、题签、格子等控件的外观都画在这里。
 *
 * 画法比原来的几层切角矩形讲究（圆角、柔和投影、描金、漆面高光、宣纸肌理），
 * 所以每种「控件 + 尺寸 + 状态」只画一次，缓存成离屏小图，之后每帧一次贴图：
 * 比原来每帧画四五层矩形 + 渐变 + 纹理还省。
 *
 * - 每帧最多新画 PER_FRAME 张，超过的那几个本帧直接画到屏幕上（同一段绘制代码），下一帧再进缓存，避免卡一下。
 * - 画布数量有上限并循环复用（微信小游戏的离屏画布回收不及时，不能无限新建）。
 */

type G = CanvasRenderingContext2D;

interface Entry { key: string; canvas: HTMLCanvasElement; used: number; px: number }

const MAX_ENTRIES = 150;
const MAX_PX = 7.5e6;
const PER_FRAME = 10;
const cache = new Map<string, Entry>();
let frame = 0;
let made = 0;
let totalPx = 0;
/** 统计（测试脚本读取）：缓存张数、累计新建、累计淘汰 */
export const skinStats = { entries: 0, created: 0, evicted: 0, direct: 0 };

/** 每帧开始时调用一次 */
export function skinFrame() { frame++; made = 0; }

function evictOne(): HTMLCanvasElement | null {
  let old: Entry | null = null;
  cache.forEach((e) => { if (e.used < frame - 1 && (!old || e.used < old.used)) old = e; });
  if (!old) return null;
  const o = old as Entry;
  cache.delete(o.key);
  totalPx -= o.px;
  skinStats.evicted++;
  return o.canvas;
}

/**
 * 画一块皮肤。paint 在以 (0,0) 为左上角、宽高为 (w,h) 的局部坐标里绘制，四周可以各超出 pad（投影、外发光）。
 * key 要包含所有会影响外观的参数（颜色、状态……），尺寸会自动加进去。
 */
export function drawSkin(ctx: G, key: string, x: number, y: number, w: number, h: number, pad: number, paint: (g: G, w: number, h: number) => void) {
  const iw = Math.max(1, Math.round(w)), ih = Math.max(1, Math.round(h));
  pad = Math.ceil(pad);
  const full = key + '|' + iw + 'x' + ih;
  let e = cache.get(full);
  if (!e) {
    const cw = iw + pad * 2, ch = ih + pad * 2;
    if (made >= PER_FRAME || cw * ch > 2.4e6) {
      // 本帧名额用完（或者太大不值得缓存）：直接画
      skinStats.direct++;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      paint(ctx, iw, ih);
      ctx.restore();
      return;
    }
    made++;
    let canvas: HTMLCanvasElement | null = null;
    while (cache.size >= MAX_ENTRIES || totalPx + cw * ch > MAX_PX) {
      const c = evictOne();
      if (!c) break;
      canvas = c;
    }
    if (canvas) { canvas.width = cw; canvas.height = ch; }
    else canvas = getPlatform().createCanvas(cw, ch);
    const g = canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.save();
    g.translate(pad, pad);
    paint(g, iw, ih);
    g.restore();
    e = { key: full, canvas, used: frame, px: cw * ch };
    cache.set(full, e);
    totalPx += e.px;
    skinStats.created++;
    skinStats.entries = cache.size;
  }
  e.used = frame;
  ctx.drawImage(e.canvas, Math.round(x) - pad, Math.round(y) - pad);
}

// —— 颜色工具 ——
function hex(c: string): [number, number, number] {
  let s = c.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const h2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** 两色混合：t=0 取 a，t=1 取 b */
export function mix(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  return '#' + h2(A[0] + (B[0] - A[0]) * t) + h2(A[1] + (B[1] - A[1]) * t) + h2(A[2] + (B[2] - A[2]) * t);
}
export function rgba(c: string, a: number): string {
  const A = hex(c);
  return `rgba(${A[0]},${A[1]},${A[2]},${a})`;
}

// —— 基础图形 ——
/** 圆角矩形路径 */
export function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function seedOf(a: number, b: number, c = 0): number {
  return (Math.round(a) * 73 + Math.round(b) * 151 + c * 37) | 0;
}

// —— 面板 ——
export type PanelStyle = 'card' | 'inset' | 'tile';

export function paintPanel(g: G, w: number, h: number, u: number, style: PanelStyle) {
  const color = style === 'inset' ? '#dad6c3' : style === 'tile' ? '#e6dfc8' : '#f1ead6';
  paintXuanPaper(g, w, h, u, color);
}

// —— 按钮 ——
export interface Lacquer { top: string; mid: string; bot: string; lip: string; ink: string }
export const LACQUER: Record<string, Lacquer> = {
  red: { top: '#e2584a', mid: '#bd3026', bot: '#8e1c15', lip: '#5c110c', ink: '#4a0d09' },
  green: { top: '#5fae7c', mid: '#34805a', bot: '#205a40', lip: '#12382a', ink: '#0d2e20' },
  blue: { top: '#5d95c4', mid: '#356a9a', bot: '#224a72', lip: '#142e48', ink: '#0e2438' },
  purple: { top: '#9772c6', mid: '#6b479c', bot: '#472c72', lip: '#2a1a46', ink: '#211238' },
  gold: { top: '#f6d98a', mid: '#dfae4c', bot: '#b17c28', lip: '#6e4a16', ink: '#5a3a10' },
  ink: { top: '#5a4c40', mid: '#3a2f27', bot: '#241c17', lip: '#120d0a', ink: '#0c0806' },
};

/** 平染宣纸：纤维露在纸边，略有起伏的轮廓按尺寸生成，不随帧抖动。 */
export function paintXuanPaper(g: G, w: number, h: number, u: number, color: string, pressed = false, edgeColor = 'rgba(75,65,45,.45)', round = false) {
  let seed = seedOf(w, h);
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const margin = Math.min(3.5 * u, Math.min(w, h) * 0.08);
  const corner = margin * 1.4;
  const x0 = margin, x1 = w - margin, y0 = margin, y1 = h - margin;
  g.save();
  g.beginPath();
  g.moveTo(x0 + corner, y0);
  function edge(ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
    const count = Math.min(100, Math.ceil(length / Math.max(2, 5 * u)));
    const phase = random() * 6;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const offset = margin * (0.36 * Math.sin(t * 11 + phase) + 0.6 * (random() - 0.5));
      g.lineTo(ax + dx * t - dy / length * offset, ay + dy * t + dx / length * offset);
    }
    g.lineTo(bx, by);
  }
  if (round) {
    const radius = Math.min(w, h) / 2 - margin;
    for (let i = 0; i < 48; i++) {
      const a = i * Math.PI / 24, r = radius + margin * (random() - 0.5) * 0.7;
      const x = w / 2 + r * Math.cos(a), y = h / 2 + r * Math.sin(a);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
  } else {
    edge(x0 + corner, y0, x1 - corner, y0);
    g.lineTo(x1, y0 + corner);
    edge(x1, y0 + corner, x1, y1 - corner);
    g.lineTo(x1 - corner, y1);
    edge(x1 - corner, y1, x0 + corner, y1);
    g.lineTo(x0, y1 - corner);
    edge(x0, y1 - corner, x0, y0 + corner);
  }
  g.closePath();
  g.fillStyle = pressed ? mix(color, '#322e25', 0.12) : color;
  g.fill();
  g.strokeStyle = edgeColor;
  g.lineWidth = Math.max(0.8, 1.2 * u);
  g.stroke();
  g.clip();
  const sheet = xuanSheet(u);
  if (sheet) {
    const sw = Math.min(sheet.width, Math.ceil(w)), sh = Math.min(sheet.height, Math.ceil(h));
    const sx = Math.floor(random() * (sheet.width - sw)), sy = Math.floor(random() * (sheet.height - sh));
    g.globalAlpha *= 0.45;
    g.drawImage(sheet, sx, sy, sw, sh, 0, 0, w, h);
  }
  g.beginPath();
  const fibers = Math.min(350, Math.ceil(w * h / (120 * u * u)));
  for (let i = 0; i < fibers; i++) {
    const x = random() * w, y = random() * h, len = (1.5 + random() * 7) * u;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.45, y + u, x + len, y + (random() - 0.5) * 3 * u);
  }
  g.lineWidth = Math.max(.55, .7 * u);
  g.strokeStyle = 'rgba(255,250,222,.48)';
  g.stroke();
  g.restore();
}

export function paintDyedButton(g: G, w: number, h: number, u: number, c: Lacquer, pressed: boolean) {
  const dye = c === LACQUER.red ? '#a24336' : c === LACQUER.green ? '#466556' : mix(c.mid, '#514c47', .40);
  paintXuanPaper(g, w, h, u, dye, pressed);
}

export function paintSlipButton(g: G, w: number, h: number, u: number, accent: string, pressed: boolean, disabled: boolean) {
  paintXuanPaper(g, w, h, u, disabled ? '#d7d3c2' : mix('#e4e4ce', accent, .045), pressed);
}

// 物品品质以淡染纸色及单层色线区分。
export function paintSlot(g: G, s: number, u: number, color: string) {
  paintXuanPaper(g, s, s, u, mix('#eee8d4', color, .14), false, mix(color, '#514c40', .38));
}

export function paintInkPill(g: G, w: number, h: number, u: number, alpha = .9) {
  g.save();
  g.globalAlpha *= alpha;
  paintXuanPaper(g, w, h, u, '#414b41');
  g.restore();
}

export function paintMedal(g: G, s: number, u: number, pressed: boolean, tone: 'paper' | 'ink' | 'red' = 'paper') {
  const color = tone === 'red' ? '#a24336' : tone === 'ink' ? '#414b41' : '#e4e2cb';
  paintXuanPaper(g, s, s, u, color, pressed, 'rgba(75,65,45,.42)', true);
}
