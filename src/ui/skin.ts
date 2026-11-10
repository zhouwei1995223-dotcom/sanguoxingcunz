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

/** 委角矩形（四角内凹的小圆弧，传统牌匾 / 册页边框的做法） */
export function notched(g: G, x: number, y: number, w: number, h: number, n: number) {
  n = Math.max(0, Math.min(n, w / 3, h / 3));
  g.beginPath();
  g.moveTo(x + n, y);
  g.lineTo(x + w - n, y);
  g.quadraticCurveTo(x + w - n, y + n, x + w, y + n);
  g.lineTo(x + w, y + h - n);
  g.quadraticCurveTo(x + w - n, y + h - n, x + w - n, y + h);
  g.lineTo(x + n, y + h);
  g.quadraticCurveTo(x + n, y + h - n, x, y + h - n);
  g.lineTo(x, y + n);
  g.quadraticCurveTo(x + n, y + n, x + n, y);
  g.closePath();
}

/** 柔和投影：几层逐渐收小的半透明圆角矩形叠出来（不用 shadowBlur，各平台结果一致） */
export function softShadow(g: G, x: number, y: number, w: number, h: number, r: number, blur: number, alpha: number, dy = 0) {
  const n = Math.max(3, Math.min(7, Math.round(blur / 1.6)));
  g.fillStyle = `rgba(26,16,8,${(alpha * 1.7 / n).toFixed(3)})`;
  for (let i = 0; i < n; i++) {
    const e = blur * (1 - i / n);
    rr(g, x - e, y - e + dy, w + e * 2, h + e * 2, r + e);
    g.fill();
  }
}

function vgrad(g: G, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  return gr;
}

/** 鎏金渐变（上亮下暗） */
export function goldGrad(g: G, y0: number, y1: number): CanvasGradient {
  return vgrad(g, y0, y1, [[0, '#fbe9b4'], [0.35, '#e2bd69'], [0.7, '#b88a3a'], [1, '#8a6226']]);
}

/** 在圆角区域里铺宣纸肌理（按 seed 从整张宣纸上取不同位置，各控件纹理不重样） */
export function paperGrain(g: G, x: number, y: number, w: number, h: number, r: number, u: number, seed: number, alpha = 1) {
  const tex = xuanSheet(u);
  if (!tex || w < 6 || h < 6) return;
  const sw = Math.min(Math.ceil(w), tex.width), sh = Math.min(Math.ceil(h), tex.height);
  const sx = Math.floor(((seed * 2654435761) >>> 0) % Math.max(1, tex.width - sw));
  const sy = Math.floor(((seed * 40503 + 977) >>> 0) % Math.max(1, Math.min(tex.height, Math.round(1700 * u)) - sh));
  g.save();
  rr(g, x, y, w, h, r);
  g.clip();
  g.globalAlpha = alpha;
  g.drawImage(tex, sx, sy, sw, sh, x, y, sw, sh);
  g.restore();
}

function seedOf(a: number, b: number, c = 0): number {
  return (Math.round(a) * 73 + Math.round(b) * 151 + c * 37) | 0;
}

// —— 面板 ——
export type PanelStyle = 'card' | 'inset' | 'tile';

/**
 * card：主面板（描金墨框 + 熟宣纸面 + 委角内线）
 * inset：嵌在页面里的副面板（背包、未解锁），纸色更深、没有投影
 * tile：小方笺
 */
export function paintPanel(g: G, w: number, h: number, u: number, style: PanelStyle) {
  const r = Math.min(12 * u, Math.min(w, h) * 0.2);
  const seed = seedOf(w, h, style.length);
  if (style === 'inset') {
    rr(g, 0, 0, w, h, r);
    g.fillStyle = 'rgba(70,52,34,0.5)';
    g.fill();
    const b = Math.max(1, 1.5 * u);
    rr(g, b, b, w - b * 2, h - b * 2, r - b);
    g.fillStyle = vgrad(g, 0, h, [[0, '#dccdaf'], [0.12, '#e6d9bd'], [1, '#d8c7a6']]);
    g.fill();
    paperGrain(g, b, b, w - b * 2, h - b * 2, r - b, u, seed, 0.9);
    // 顶部内阴影：嵌进去的感觉
    g.save();
    rr(g, b, b, w - b * 2, h - b * 2, r - b);
    g.clip();
    g.fillStyle = vgrad(g, b, b + 16 * u, [[0, 'rgba(60,42,24,0.22)'], [1, 'rgba(60,42,24,0)']]);
    g.fillRect(0, 0, w, 18 * u);
    g.restore();
    return;
  }
  const small = style === 'tile' || Math.min(w, h) < 120 * u;
  softShadow(g, 0, 0, w, h, r, (small ? 6 : 12) * u, small ? 0.2 : 0.26, (small ? 3 : 5) * u);
  // 墨框
  rr(g, 0, 0, w, h, r);
  g.fillStyle = '#2a2018';
  g.fill();
  // 描金线
  const b1 = Math.max(1, 1.6 * u);
  rr(g, b1, b1, w - b1 * 2, h - b1 * 2, r - b1);
  g.fillStyle = goldGrad(g, 0, h);
  g.fill();
  // 纸面
  const b2 = b1 + Math.max(1, 1.6 * u);
  rr(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2);
  g.fillStyle = vgrad(g, 0, h, [[0, '#fbf5e6'], [0.5, '#f3e8d0'], [1, '#e7d7b6']]);
  g.fill();
  paperGrain(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2, u, seed, 1);
  // 四周极淡的包浆收边
  g.save();
  rr(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2);
  g.clip();
  const edge = Math.min(26 * u, Math.min(w, h) * 0.2);
  g.fillStyle = vgrad(g, h - edge - b2, h - b2, [[0, 'rgba(126,92,50,0)'], [1, 'rgba(126,92,50,0.13)']]);
  g.fillRect(0, h - edge - b2, w, edge);
  g.fillStyle = vgrad(g, b2, b2 + edge * 0.6, [[0, 'rgba(255,252,240,0.5)'], [1, 'rgba(255,252,240,0)']]);
  g.fillRect(0, b2, w, edge * 0.6);
  // 大面板底部一抹远山淡墨
  if (!small && w >= 260 * u && h >= 180 * u) {
    const by = h - b2;
    g.fillStyle = 'rgba(62,54,44,0.05)';
    g.beginPath();
    g.moveTo(0, by);
    g.lineTo(0, by - 40 * u);
    g.quadraticCurveTo(w * 0.22, by - 96 * u, w * 0.46, by - 36 * u);
    g.quadraticCurveTo(w * 0.62, by - 4 * u, w * 0.78, by - 70 * u);
    g.quadraticCurveTo(w * 0.9, by - 96 * u, w, by - 30 * u);
    g.lineTo(w, by);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(62,54,44,0.04)';
    g.beginPath();
    g.moveTo(0, by);
    g.lineTo(0, by - 18 * u);
    g.quadraticCurveTo(w * 0.34, by - 60 * u, w * 0.6, by - 16 * u);
    g.quadraticCurveTo(w * 0.8, by - 42 * u, w, by - 12 * u);
    g.lineTo(w, by);
    g.closePath();
    g.fill();
  }
  g.restore();
  // 委角内线
  if (!small) {
    const m = b2 + 7 * u;
    if (w > m * 2 + 30 * u && h > m * 2 + 30 * u) {
      notched(g, m, m, w - m * 2, h - m * 2, 9 * u);
      g.strokeStyle = 'rgba(134,100,56,0.5)';
      g.lineWidth = Math.max(1, 1.2 * u);
      g.stroke();
      // 四角朱砂小点
      g.fillStyle = 'rgba(184,52,38,0.75)';
      const d = 2.2 * u, o = m + 2.4 * u;
      for (const [cx, cy] of [[o, o], [w - o, o], [o, h - o], [w - o, h - o]]) { g.beginPath(); g.arc(cx, cy, d, 0, Math.PI * 2); g.fill(); }
    }
  } else {
    const m = b2 + 3 * u;
    rr(g, m, m, w - m * 2, h - m * 2, Math.max(1, r - m));
    g.strokeStyle = 'rgba(134,100,56,0.36)';
    g.lineWidth = Math.max(1, u);
    g.stroke();
  }
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

/** 实心漆面按钮（主行动）：鎏金边 + 朱漆 / 松石面 + 高光，按下时面板沉下去盖住底沿 */
export function paintLacquerButton(g: G, w: number, h: number, u: number, c: Lacquer, pressed: boolean) {
  const lip = Math.max(2, Math.round(5 * u));
  const fh = h - lip;
  const r = Math.min(13 * u, fh * 0.28);
  const oy = pressed ? lip - 1 : 0;
  softShadow(g, 0, lip * 0.5, w, fh, r, 9 * u, pressed ? 0.16 : 0.3, pressed ? 2 * u : 4 * u);
  // 底沿（厚度）
  rr(g, 0, lip, w, fh, r);
  g.fillStyle = c.lip;
  g.fill();
  // 鎏金外框
  rr(g, 0, oy, w, fh, r);
  g.fillStyle = goldGrad(g, oy, oy + fh);
  g.fill();
  const b = Math.max(1.5, 2.2 * u);
  rr(g, b * 0.45, oy + b * 0.45, w - b * 0.9, fh - b * 0.9, r - b * 0.45);
  g.strokeStyle = 'rgba(70,40,10,0.55)';
  g.lineWidth = Math.max(1, 0.9 * u);
  g.stroke();
  // 漆面
  rr(g, b, oy + b, w - b * 2, fh - b * 2, r - b);
  g.fillStyle = vgrad(g, oy + b, oy + fh - b, [[0, c.top], [0.42, c.mid], [1, c.bot]]);
  g.fill();
  g.save();
  rr(g, b, oy + b, w - b * 2, fh - b * 2, r - b);
  g.clip();
  // 上半截高光（弧形下沿）
  g.fillStyle = vgrad(g, oy + b, oy + fh * 0.55, [[0, 'rgba(255,255,255,0.26)'], [1, 'rgba(255,255,255,0.03)']]);
  g.beginPath();
  g.moveTo(0, oy);
  g.lineTo(w, oy);
  g.lineTo(w, oy + fh * 0.36);
  g.quadraticCurveTo(w / 2, oy + fh * 0.58, 0, oy + fh * 0.36);
  g.closePath();
  g.fill();
  // 底部一抹暗
  g.fillStyle = vgrad(g, oy + fh * 0.7, oy + fh, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.2)']]);
  g.fillRect(0, oy + fh * 0.7, w, fh * 0.3);
  if (pressed) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, oy, w, fh); }
  g.restore();
  // 内描金细线
  const m = b + Math.max(2, 3.2 * u);
  if (w > m * 2 + 20 * u && fh > m * 2 + 14 * u) {
    rr(g, m, oy + m, w - m * 2, fh - m * 2, Math.max(1, r - m));
    g.strokeStyle = 'rgba(255,232,170,0.42)';
    g.lineWidth = Math.max(1, u);
    g.stroke();
    // 两端的金菱钉
    if (w >= 240 * u) {
      g.fillStyle = 'rgba(255,226,150,0.85)';
      const d = 4.2 * u, cy = oy + fh / 2;
      for (const cx of [m + 13 * u, w - m - 13 * u]) {
        g.beginPath(); g.moveTo(cx, cy - d); g.lineTo(cx + d, cy); g.lineTo(cx, cy + d); g.lineTo(cx - d, cy); g.closePath(); g.fill();
      }
    }
  }
}

/** 纸笺按钮（次级）：象牙纸面，边框与底色带一点功能色 */
export function paintSlipButton(g: G, w: number, h: number, u: number, accent: string, pressed: boolean, disabled: boolean) {
  const lip = Math.max(2, Math.round(4 * u));
  const fh = h - lip;
  const r = Math.min(10 * u, fh * 0.26);
  const oy = pressed ? lip - 1 : 0;
  const seed = seedOf(w, h, accent.charCodeAt(1));
  if (!disabled) softShadow(g, 0, lip * 0.5, w, fh, r, 6 * u, pressed ? 0.1 : 0.2, pressed ? 1 * u : 3 * u);
  if (!disabled) {
    rr(g, 0, lip, w, fh, r);
    g.fillStyle = mix(accent, '#2a1c10', 0.55);
    g.fill();
  }
  const y0 = disabled ? lip * 0.5 : oy;
  rr(g, 0, y0, w, fh, r);
  g.fillStyle = disabled ? '#a59a88' : mix(accent, '#3a2a1a', 0.35);
  g.fill();
  const b = Math.max(1.2, 1.7 * u);
  rr(g, b, y0 + b, w - b * 2, fh - b * 2, r - b);
  const tint = disabled ? 0 : 0.1;
  g.fillStyle = disabled
    ? vgrad(g, y0, y0 + fh, [[0, '#e2d9c8'], [1, '#d0c5b0']])
    : vgrad(g, y0, y0 + fh, [[0, mix('#fffaec', accent, tint * 0.5)], [0.55, mix('#f6ead0', accent, tint)], [1, mix('#e6d4b0', accent, tint * 1.6)]]);
  g.fill();
  paperGrain(g, b, y0 + b, w - b * 2, fh - b * 2, r - b, u, seed, disabled ? 0.5 : 0.85);
  if (!disabled) {
    // 顶部一线高光 + 内细框
    g.save();
    rr(g, b, y0 + b, w - b * 2, fh - b * 2, r - b);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(0, y0 + b, w, Math.max(1, 1.4 * u));
    if (pressed) { g.fillStyle = 'rgba(60,40,20,0.12)'; g.fillRect(0, y0, w, fh); }
    g.restore();
    const m = b + Math.max(2, 2.8 * u);
    if (w >= 64 * u && fh >= 40 * u) {
      rr(g, m, y0 + m, w - m * 2, fh - m * 2, Math.max(1, r - m));
      g.strokeStyle = rgba(accent, 0.5);
      g.lineWidth = Math.max(1, u);
      g.stroke();
    }
  }
}

// —— 题签（标题条） ——
export function paintRibbon(g: G, w: number, h: number, u: number, c: Lacquer) {
  const tail = 22 * u, ty = 9 * u, th = h - 12 * u;
  // 两侧燕尾（在主体后面，颜色更深）
  for (const dir of [-1, 1]) {
    const x0 = dir < 0 ? -tail : w + tail;
    const x1 = dir < 0 ? 16 * u : w - 16 * u;
    g.beginPath();
    g.moveTo(x1, ty);
    g.lineTo(x0, ty);
    g.lineTo(x0 + dir * -10 * u, ty + th / 2);
    g.lineTo(x0, ty + th);
    g.lineTo(x1, ty + th);
    g.closePath();
    g.fillStyle = c.lip;
    g.fill();
    g.strokeStyle = 'rgba(226,189,105,0.75)';
    g.lineWidth = Math.max(1, 1.2 * u);
    g.stroke();
  }
  const r = 8 * u;
  softShadow(g, 0, 0, w, h, r, 7 * u, 0.26, 3 * u);
  rr(g, 0, 0, w, h, r);
  g.fillStyle = goldGrad(g, 0, h);
  g.fill();
  const b = Math.max(1.5, 2.2 * u);
  rr(g, b, b, w - b * 2, h - b * 2, r - b);
  g.fillStyle = vgrad(g, 0, h, [[0, c.top], [0.5, c.mid], [1, c.bot]]);
  g.fill();
  g.save();
  rr(g, b, b, w - b * 2, h - b * 2, r - b);
  g.clip();
  g.fillStyle = vgrad(g, 0, h * 0.5, [[0, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]);
  g.fillRect(0, 0, w, h * 0.5);
  g.restore();
  const m = b + 3.4 * u;
  notched(g, m, m, w - m * 2, h - m * 2, 5 * u);
  g.strokeStyle = 'rgba(255,232,170,0.5)';
  g.lineWidth = Math.max(1, u);
  g.stroke();
}

// —— 物品 / 头像格 ——
export function paintSlot(g: G, s: number, u: number, color: string) {
  const r = Math.min(10 * u, s * 0.16);
  const seed = seedOf(s, s, color.charCodeAt(2));
  softShadow(g, 0, 0, s, s, r, 5 * u, 0.2, 2.5 * u);
  rr(g, 0, 0, s, s, r);
  g.fillStyle = '#2a2018';
  g.fill();
  const b = Math.max(1, 1.4 * u);
  // 品质色边
  rr(g, b, b, s - b * 2, s - b * 2, r - b);
  g.fillStyle = vgrad(g, 0, s, [[0, mix(color, '#ffffff', 0.35)], [0.5, color], [1, mix(color, '#1a120c', 0.35)]]);
  g.fill();
  const b2 = b + Math.max(1.6, 2.6 * u);
  rr(g, b2, b2, s - b2 * 2, s - b2 * 2, Math.max(1, r - b2));
  g.fillStyle = vgrad(g, 0, s, [[0, mix('#fbf4e2', color, 0.06)], [0.55, mix('#f1e4c8', color, 0.14)], [1, mix('#e2d0ac', color, 0.3)]]);
  g.fill();
  paperGrain(g, b2, b2, s - b2 * 2, s - b2 * 2, Math.max(1, r - b2), u, seed, 0.8);
  // 中心一团柔光，托住图标
  g.save();
  rr(g, b2, b2, s - b2 * 2, s - b2 * 2, Math.max(1, r - b2));
  g.clip();
  const rg = g.createRadialGradient(s / 2, s * 0.46, s * 0.05, s / 2, s * 0.46, s * 0.5);
  rg.addColorStop(0, 'rgba(255,253,244,0.75)');
  rg.addColorStop(1, 'rgba(255,253,244,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, s, s);
  g.restore();
  rr(g, b2 + 0.5, b2 + 0.5, s - b2 * 2 - 1, s - b2 * 2 - 1, Math.max(1, r - b2));
  g.strokeStyle = 'rgba(60,40,20,0.3)';
  g.lineWidth = Math.max(1, 0.8 * u);
  g.stroke();
}

// —— 墨漆小牌（货币条、战力牌、提示条） ——
export function paintInkPill(g: G, w: number, h: number, u: number, alpha = 0.9, gold = true) {
  const r = h / 2;
  softShadow(g, 0, 0, w, h, r, 5 * u, 0.2, 2 * u);
  rr(g, 0, 0, w, h, r);
  g.fillStyle = gold ? goldGrad(g, 0, h) : 'rgba(20,14,10,0.9)';
  g.fill();
  const b = Math.max(1, 1.5 * u);
  rr(g, b, b, w - b * 2, h - b * 2, r - b);
  g.fillStyle = vgrad(g, 0, h, [[0, `rgba(66,50,38,${alpha})`], [0.5, `rgba(38,28,21,${alpha})`], [1, `rgba(24,17,12,${alpha})`]]);
  g.fill();
  g.save();
  rr(g, b, b, w - b * 2, h - b * 2, r - b);
  g.clip();
  g.fillStyle = 'rgba(255,236,190,0.1)';
  g.fillRect(0, b, w, h * 0.42);
  g.restore();
}

/** 圆形徽章底（侧边功能按钮）：描金圈 + 宣纸面 */
export function paintMedal(g: G, s: number, u: number, pressed: boolean, tone: 'paper' | 'ink' = 'paper') {
  const c = s / 2, r = s / 2;
  softShadow(g, 0, 0, s, s, r, 6 * u, pressed ? 0.14 : 0.28, pressed ? 1.5 * u : 4 * u);
  g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2);
  g.fillStyle = '#2a2018';
  g.fill();
  g.beginPath(); g.arc(c, c, r - Math.max(1, 1.4 * u), 0, Math.PI * 2);
  g.fillStyle = goldGrad(g, 0, s);
  g.fill();
  const ri = r - Math.max(2.5, 4.2 * u);
  g.beginPath(); g.arc(c, c, ri, 0, Math.PI * 2);
  if (tone === 'paper') {
    const rg = g.createRadialGradient(c, c - ri * 0.35, ri * 0.1, c, c, ri);
    rg.addColorStop(0, '#fffaf0');
    rg.addColorStop(0.7, '#f1e4c8');
    rg.addColorStop(1, '#dcc8a2');
    g.fillStyle = rg;
  } else {
    const rg = g.createRadialGradient(c, c - ri * 0.35, ri * 0.1, c, c, ri);
    rg.addColorStop(0, '#5a493c');
    rg.addColorStop(1, '#231a14');
    g.fillStyle = rg;
  }
  g.fill();
  g.beginPath(); g.arc(c, c, ri - 2.4 * u, 0, Math.PI * 2);
  g.strokeStyle = tone === 'paper' ? 'rgba(134,100,56,0.42)' : 'rgba(255,226,160,0.3)';
  g.lineWidth = Math.max(1, u);
  g.stroke();
  if (pressed) { g.beginPath(); g.arc(c, c, ri, 0, Math.PI * 2); g.fillStyle = 'rgba(40,24,10,0.16)'; g.fill(); }
}

/** 进度条槽 */
export function paintBarTrack(g: G, w: number, h: number, u: number, dark: string | null) {
  const r = Math.min(h / 2, 7 * u);
  rr(g, 0, 0, w, h, r);
  g.fillStyle = '#2a2018';
  g.fill();
  const b = Math.max(1, 1.4 * u);
  rr(g, b, b, w - b * 2, h - b * 2, Math.max(0.5, r - b));
  g.fillStyle = dark || vgrad(g, 0, h, [[0, '#c9b995'], [1, '#e6dabd']]);
  g.fill();
  if (!dark) {
    g.save();
    rr(g, b, b, w - b * 2, h - b * 2, Math.max(0.5, r - b));
    g.clip();
    g.fillStyle = 'rgba(60,40,20,0.16)';
    g.fillRect(0, b, w, Math.max(1, h * 0.22));
    g.restore();
  }
}

export function paintBarFill(g: G, w: number, h: number, u: number, color: string) {
  const r = Math.min(h / 2, 6 * u);
  rr(g, 0, 0, w, h, r);
  g.fillStyle = vgrad(g, 0, h, [[0, mix(color, '#ffffff', 0.28)], [0.5, color], [1, mix(color, '#1a120c', 0.3)]]);
  g.fill();
  g.save();
  rr(g, 0, 0, w, h, r);
  g.clip();
  g.fillStyle = 'rgba(255,250,230,0.32)';
  g.fillRect(0, 0, w, Math.max(1, h * 0.3));
  g.restore();
}
