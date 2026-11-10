import { getPlatform } from '../platform';
import { sprite, hasSprite, scaled, Sprite } from '../gfx/atlas';
import type { TouchKind, TouchPoint } from '../platform/types';
import { playSfx } from '../audio/sound';
import { NEW_UI } from '../data/platformConfig';
import { drawXuanTexture, XuanTextureOpts } from './xuanPaper';
import { TextCache } from './textCache';
import { drawSkin, skinFrame, paintPanel, paintLacquerButton, paintSlipButton, paintRibbon, paintSlot, paintInkPill, paintBarTrack, LACQUER, Lacquer, rr, mix } from './skin';

// 立即模式 UI：每帧重新绘制并登记可点击区域；点击判定使用上一帧的区域表，天然支持弹窗遮挡。

interface Region {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  clip?: [number, number, number, number];
}

interface ScrollState {
  offset: number;
  vel: number;
  max: number;
}

const PAPER_FONT = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif';
const CLASSIC_FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

/** 进度条亮色 → 国画矿物颜料色 */
const INK_PIGMENT: Record<string, string> = {
  '#63c74d': '#4a8a52', '#9be37a': '#5c9a5a', '#feae34': '#c58a2e', '#fee761': '#c9a23a', '#f5c45e': '#c58a2e',
  '#2ce8f5': '#3d93ad', '#e43b44': '#b23a2e', '#ff0044': '#b23a2e',
};

export const C = {
  bg: '#1d1a2b',
  panel: '#3a2c2a',
  panelLight: '#5a4038',
  panelDark: '#231917',
  border: '#c89b5c',
  borderDark: '#6b4a2b',
  paper: '#ead4aa',
  paperDark: '#c9a87a',
  ink: '#3e2731',
  text: '#fff4d6',
  textDim: '#c9b48e',
  gold: '#feae34',
  red: '#e43b44',
  green: '#63c74d',
  blue: '#0099db',
  btnRed: ['#e43b44', '#a22633', '#ff7a6b'],
  btnGold: ['#feae34', '#c96d17', '#fee761'],
  btnGreen: ['#5cb84a', '#2f7a3a', '#9be37a'],
  btnBlue: ['#2b8fd6', '#174f8a', '#7cc8ff'],
  btnGray: ['#8b9bb4', '#5a6988', '#c0cbdc'],
  btnPurple: ['#a659b8', '#5f2f73', '#dc9be9'],
};

/** 题签 / 标题条的底色 → 漆面配色 */
function ribbonLacquer(color: string): Lacquer {
  const c = color.toLowerCase();
  if (c === '#a22633') return LACQUER.red;
  if (c === '#3e8948' || c === '#1d6b4a' || c === '#2f7a3a') return LACQUER.green;
  if (c === '#124e89') return LACQUER.blue;
  if (c === '#7a2a78') return LACQUER.purple;
  if (c === '#a2611a') return { top: '#e0a04a', mid: '#b87422', bot: '#8a5212', lip: '#5a340a', ink: '#42260a' };
  return { top: mix(color, '#ffffff', 0.22), mid: color, bot: mix(color, '#120c08', 0.38), lip: mix(color, '#120c08', 0.62), ink: mix(color, '#120c08', 0.7) };
}

/** 品质格的边色：旧调色板里偏暗 / 偏灰的几种换成在宣纸上更耐看的颜色 */
const SLOT_COLOR: Record<string, string> = {
  '#3a3040': '#8d8272', '#8b9bb4': '#8a97a8', '#5a6988': '#6f86a4', '#feae34': '#d99a2a', '#fee761': '#e2b93a', '#f5c45e': '#d99a2a', '#b86818': '#c98a2a',
};

export class UI {
  paperTheme = NEW_UI;
  preserveTextColors = false;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  u: number; // 1 设计单位对应的设备像素（设计宽度 750）
  textCache = new TextCache();
  safeTop: number;
  safeBottom: number;

  private regions: Region[] = [];
  /** 本帧登记的「点击时立即执行」回调（tapNow），触摸抬起时用上一帧的表 */
  private taps: Record<string, () => void> = {};
  private prevTaps: Record<string, () => void> = {};
  private prevRegions: Region[] = [];
  private clickedId: string | null = null;
  private pressedId: string | null = null;
  layer = 0;
  private clipStack: [number, number, number, number][] = [];
  /** 水墨宣纸模式下记录宣纸面板区与深色遮盖区，自动将面板内浅色字转为水墨丹青字 */
  private paperZones: { x: number; y: number; w: number; h: number; layer: number }[] = [];
  private darkZones: { x: number; y: number; w: number; h: number; layer: number }[] = [];

  // 指针
  pointerDown = false;
  px = 0;
  py = 0;
  private startX = 0;
  private startY = 0;
  private moved = false;
  private pointerId = -99;
  private scrolls: Record<string, ScrollState> = {};
  private activeScroll: string | null = null;
  private lastMoveY = 0;
  private lastMoveT = 0;

  toasts: { text: string; t: number }[] = [];
  time = 0;

  constructor(ctx: CanvasRenderingContext2D, W: number, H: number) {
    this.ctx = ctx;
    this.W = W;
    this.H = H;
    this.u = W / 750;
    const sa = getPlatform().safeArea;
    this.safeTop = sa.top;
    this.safeBottom = sa.bottom;
  }

  // —— 输入 ——
  onTouch(kind: TouchKind, touches: TouchPoint[]) {
    const t = touches[0];
    if (!t) return;
    if (kind === 'start') {
      if (this.pointerDown) return;
      this.pointerDown = true;
      this.pointerId = t.id;
      this.px = this.startX = t.x;
      this.py = this.startY = t.y;
      this.moved = false;
      const r = this.hit(t.x, t.y);
      this.pressedId = r ? r.id : null;
      this.activeScroll = null;
      const sr = this.hit(t.x, t.y, true);
      if (sr) { this.activeScroll = sr.id.slice('scroll:'.length); const s = this.scrolls[this.activeScroll]; if (s) s.vel = 0; }
      this.lastMoveY = t.y;
      this.lastMoveT = this.time;
    } else {
      const p = touches.find((x) => x.id === this.pointerId) || (touches.length === 1 ? t : null);
      if (!p) return;
      if (kind === 'move') {
        this.px = p.x;
        this.py = p.y;
        if (Math.abs(p.x - this.startX) + Math.abs(p.y - this.startY) > 14 * this.u) this.moved = true;
        if (this.activeScroll && this.moved) {
          const s = this.scrolls[this.activeScroll];
          if (s) {
            const dy = p.y - this.lastMoveY;
            // 越过边界后阻力加倍（只跟手一半），最多拉出 40 单位，不会拉出大片空白
            let next = s.offset - dy;
            if (next < 0 || next > s.max) next = s.offset - dy * 0.4;
            s.offset = Math.max(-40 * this.u, Math.min(s.max + 40 * this.u, next));
            const dt = Math.max(0.001, this.time - this.lastMoveT);
            s.vel = -dy / dt;
            this.pressedId = null;
          }
        }
        this.lastMoveY = p.y;
        this.lastMoveT = this.time;
      } else {
        this.pointerDown = false;
        if (!this.moved) {
          const r = this.hit(p.x, p.y);
          if (r && r.id === this.pressedId) {
            const fn = this.prevTaps[r.id];
            // 微信的订阅消息、推荐组件等要求在点击事件里调用：直接在触摸回调里执行，不等下一帧
            if (fn) { playSfx('click'); try { fn(); } catch (e) {} }
            else this.clickedId = r.id;
          }
        }
        this.pressedId = null;
        this.activeScroll = null;
      }
    }
  }

  private hit(x: number, y: number, scrollOnly = false): Region | null {
    let best: Region | null = null;
    for (const r of this.prevRegions) {
      if (scrollOnly !== r.id.startsWith('scroll:')) continue;
      if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) continue;
      if (r.clip) {
        const [cx, cy, cw, ch] = r.clip;
        if (x < cx || y < cy || x > cx + cw || y > cy + ch) continue;
      }
      if (!best || r.layer >= best.layer) best = r;
    }
    return best;
  }

  /** 是否有任何可点击区域处于该层以上（用于战斗中判断 UI 是否拦截触摸） */
  touchBlocked(x: number, y: number): boolean {
    return !!this.hit(x, y);
  }

  begin(dt: number) {
    this.time += dt;
    skinFrame();
    this.regions = [];
    this.taps = {};
    this.paperZones = [];
    this.darkZones = [];
    this.layer = 0;
    // 惯性滚动
    for (const id in this.scrolls) {
      const s = this.scrolls[id];
      if (this.activeScroll === id && this.pointerDown) continue;
      if (Math.abs(s.vel) > 1) {
        s.offset += s.vel * dt;
        s.vel *= Math.pow(0.04, dt);
      } else s.vel = 0;
      // 惯性滑到边界就停住：最多越界 24 单位再弹回（原来快速一划会冲出很远，露出大片空白）
      const over = 24 * this.u;
      if (s.offset < 0 || s.offset > s.max) {
        if (s.offset < 0 && s.vel < 0 || s.offset > s.max && s.vel > 0) s.vel = 0;
        s.offset = Math.max(-over, Math.min(s.max + over, s.offset));
      }
      if (s.offset < 0) { s.offset += (0 - s.offset) * Math.min(1, dt * 12); if (s.offset > -0.5) s.offset = 0; }
      if (s.offset > s.max) { s.offset += (s.max - s.offset) * Math.min(1, dt * 12); if (s.offset - s.max < 0.5) s.offset = s.max; }
    }
  }

  /** 丢掉本帧登记的点击区域（加载页离屏预热主界面后调用，免得加载中误触到主界面按钮） */
  discardRegions() { this.regions = []; this.taps = {}; this.paperZones = []; this.darkZones = []; this.layer = 0; }

  end() {
    this.prevRegions = this.regions;
    this.prevTaps = this.taps;
    this.clickedId = null;
    this.drawToasts();
  }

  region(id: string, x: number, y: number, w: number, h: number) {
    const clip = this.clipStack.length ? this.clipStack[this.clipStack.length - 1] : undefined;
    this.regions.push({ id, x, y, w, h, layer: this.layer, clip });
  }

  /** 登记一个点击区域，点中时在触摸事件回调里立即执行 fn（用于必须由用户点击触发的平台接口） */
  tapNow(id: string, x: number, y: number, w: number, h: number, fn: () => void) {
    this.region(id, x, y, w, h);
    this.taps[id] = fn;
  }

  /** 区域被点击返回 true */
  clicked(id: string, x: number, y: number, w: number, h: number, sound = true): boolean {
    this.region(id, x, y, w, h);
    if (this.clickedId === id) {
      this.clickedId = null;
      if (sound) playSfx('click');
      return true;
    }
    return false;
  }

  isPressed(id: string) {
    return this.pressedId === id && this.pointerDown && !this.moved;
  }

  /** 吞掉一层的所有点击（弹窗遮罩） */
  blocker(id: string) {
    this.region(id, 0, 0, this.W, this.H);
  }

  // —— 滚动区域 ——
  beginScroll(id: string, x: number, y: number, w: number, h: number, contentH: number): number {
    const s = this.scrolls[id] || (this.scrolls[id] = { offset: 0, vel: 0, max: 0 });
    s.max = Math.max(0, contentH - h);
    this.region('scroll:' + id, x, y, w, h);
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    this.clipStack.push([x, y, w, h]);
    return -s.offset;
  }

  endScroll() {
    this.ctx.restore();
    this.clipStack.pop();
  }

  resetScroll(id: string) {
    if (this.scrolls[id]) { this.scrolls[id].offset = 0; this.scrolls[id].vel = 0; }
  }

  // —— 绘制工具 ——
  font(size: number, bold = true) {
    return `${bold ? 'bold ' : ''}${Math.round(size * this.u)}px ${this.paperTheme ? PAPER_FONT : CLASSIC_FONT}`;
  }

  markPaper(x: number, y: number, w: number, h: number) {
    this.paperZones.push({ x, y, w, h, layer: this.layer });
  }

  /** 登记一块深色底（墨漆牌、导航栏……）：上面的浅色字保持原样，不按宣纸换成墨色 */
  markDark(x: number, y: number, w: number, h: number) {
    this.darkZones.push({ x, y, w, h, layer: this.layer });
  }

  private isOnPaper(x: number, y: number): boolean {
    if (!this.paperTheme) return false;
    let inPaper = false;
    let paperLayer = -1;
    for (const z of this.paperZones) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h && z.layer >= paperLayer) {
        inPaper = true;
        paperLayer = z.layer;
      }
    }
    if (!inPaper) return false;
    for (const d of this.darkZones) {
      if (d.layer >= paperLayer && x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return false;
    }
    return true;
  }

  private mapInkColor(color: string): string {
    const c = color.toLowerCase();
    // 显式指定的深底浅字色（如宣纸内嵌深色徽章上的暖白字）保持原样
    if (c === '#fbf4e4' || c === '#f5ead4') return color;
    if (c === '#fff' || c === '#ffffff' || c === '#fff4d6' || c === '#fff6dc' || c === '#fff7e2' || c === '#e0e0e0') return '#1e1814';
    if (c === '#c9b48e' || c === '#d9c6a0' || c === '#d9be94' || c === '#e6d3b3' || c === '#a89a86' || c === '#888' || c === '#8b8b8b' || c === '#666' || c === '#786a62') return '#5c4d3e';
    if (c === '#feae34' || c === '#fee761' || c === '#f5c45e' || c === '#ffe59e' || c === '#ffb070' || c === '#ff8a80') return '#b02820';
    if (c === '#9be37a' || c === '#63c74d') return '#206637';
    if (c === '#dc9be9') return '#6b2d75';
    if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
      const hex = c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum > 0.52) {
        const k = 0.42;
        const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n * k))).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }
    return color;
  }

  /** 保留色相的压深：白字变墨，亮色压到四成多亮度，宣纸上清晰可读。 */
  private deepenInk(color: string): string {
    const c = color.toLowerCase();
    if (c === '#fff' || c === '#ffffff' || c === '#fff4d6' || c === '#fff6dc' || c === '#fff7e2' || c === '#e0e0e0' || c === C.text.toLowerCase()) return '#1e1814';
    if (c === C.textDim.toLowerCase() || c === '#a89a86' || c === '#888' || c === '#8b8b8b') return '#5c4d3e';
    if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
      const hex = c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c;
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum > 0.45) {
        const k = 0.36 / lum;
        const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n * k))).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }
    return color;
  }

  text(str: string, x: number, y: number, size: number, color = C.text, align: CanvasTextAlign = 'center', stroke: string | null = '#1a1210', bold = true) {
    const ctx = this.ctx;
    ctx.font = this.font(size, bold);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const cLow = color.toLowerCase();
    const onPaper = this.isOnPaper(x, y);
    const font = this.font(size, bold), px = Math.round(size * this.u);
    if (onPaper && cLow !== '#fbf4e4' && cLow !== '#f5ead4') {
      // 战斗里保留文字色相（金=进化、绿=推荐……），只压深成墨色调；其他场景按水墨映射表换色。
      const inkCol = this.preserveTextColors ? this.deepenInk(color) : this.mapInkColor(color);
      // 水墨字在宣纸上统一衬一层淡淡的宣纸暖白光晕，即便跨过深色乌丝栏或山水印记也清晰如古籍刻本
      this.drawText(str, x, y, font, px, align, inkCol, stroke ? 'rgba(246,238,222,0.85)' : null, Math.max(2, size * this.u * 0.14));
      return;
    }
    this.drawText(str, x, y, font, px, align, color, stroke, Math.max(2, size * this.u * 0.18));
  }

  /** 先走文字缓存（贴图）；画布正在缩放（弹窗动画等）或缓存停用时直接绘制。 */
  private drawText(str: string, x: number, y: number, font: string, px: number, align: CanvasTextAlign, fill: string, stroke: string | null, lineWidth: number) {
    const ctx = this.ctx;
    let plain = true;
    // 小游戏画布不一定实现 getTransform（或返回空），取不到时按未缩放处理
    try { const m = ctx.getTransform ? ctx.getTransform() : null; if (m && typeof m.a === 'number') plain = m.a === 1 && m.d === 1 && m.b === 0 && m.c === 0; } catch (e) {}
    if (plain && this.textCache.draw(ctx, str, x, y, font, px, align, fill, stroke, lineWidth)) return;
    ctx.font = font;
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  measure(str: string, size: number, bold = true): number {
    this.ctx.font = this.font(size, bold);
    return this.ctx.measureText(str).width;
  }

  /** 自动换行，返回占用高度 */
  wrapText(str: string, x: number, y: number, maxW: number, size: number, color = C.text, lineH = 1.45, align: CanvasTextAlign = 'left', stroke: string | null = null): number {
    const lines = this.wrapLines(str, maxW, size);
    const lh = size * this.u * lineH;
    lines.forEach((l, i) => this.text(l, x, y + i * lh + lh / 2, size, color, align, stroke, false));
    return lines.length * lh;
  }

  wrapLines(str: string, maxW: number, size: number): string[] {
    const ctx = this.ctx;
    ctx.font = this.font(size, false);
    const out: string[] = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
        else line += ch;
      }
      out.push(line);
    }
    return out;
  }

  /** 在指定矩形内叠加真实手工宣纸纹理（竹帘纹 + 檀皮纤维 + 古籍包浆边缘） */
  paperTexture(x: number, y: number, w: number, h: number, opts?: XuanTextureOpts) {
    if (!this.paperTheme) return;
    drawXuanTexture(this.ctx, x, y, w, h, this.u, opts);
  }

  /** 像素风切角矩形 */
  pixRect(x: number, y: number, w: number, h: number, color: string, cut?: number) {
    const ctx = this.ctx;
    const c = cut ?? Math.max(2, Math.round(this.u * 4));
    let fill = color;
    if (this.paperTheme && typeof color === 'string') {
      const lc = color.toLowerCase();
      const onP = this.isOnPaper(x + w / 2, y + h / 2);
      if (onP) {
        if (lc === '#3a2c2a' || lc === '#4a3630' || (lc === '#231917' && h > 56 * this.u)) {
          // 宣纸面板内的子卡片转为素雅熟宣内笺
          ctx.fillStyle = '#8c7a62';
          ctx.fillRect(x + c, y, w - c * 2, h);
          ctx.fillRect(x, y + c, w, h - c * 2);
          const p = Math.max(1.5, Math.round(this.u * 2.5));
          ctx.fillStyle = '#e0d2b6';
          ctx.fillRect(x + c + p, y + p, w - (c + p) * 2, h - p * 2);
          ctx.fillRect(x + p, y + c + p, w - p * 2, h - (c + p) * 2);
          this.paperTexture(x + p, y + p, w - p * 2, h - p * 2, { alpha: 0.9, patina: true });
          return;
        }
        if (lc === '#2a2020') {
          fill = '#cfc1a6';
        } else if (lc === '#5a3a14') {
          // 第7天大奖等重点内笺：洒金暖黄宣纸
          ctx.fillStyle = '#b52b22';
          ctx.fillRect(x + c, y, w - c * 2, h);
          ctx.fillRect(x, y + c, w, h - c * 2);
          const p = Math.max(1.5, Math.round(this.u * 2.5));
          ctx.fillStyle = '#ebd7ae';
          ctx.fillRect(x + c + p, y + p, w - (c + p) * 2, h - p * 2);
          ctx.fillRect(x + p, y + c + p, w - p * 2, h - (c + p) * 2);
          this.paperTexture(x + p, y + p, w - p * 2, h - p * 2, { alpha: 0.9, patina: true });
          return;
        } else if (lc === '#120d0c' && w > 60 * this.u && h > 60 * this.u) {
          fill = '#594a3c';
        } else if (lc === '#feae34' && w > 60 * this.u && h > 60 * this.u) {
          fill = '#b82820';
        } else if (lc === '#231917' || lc === '#a22633' || lc === '#2f7a3a') {
          this.darkZones.push({ x, y, w, h, layer: this.layer });
        }
      }
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x + c, y, w - c * 2, h);
    ctx.fillRect(x, y + c, w, h - c * 2);
    if (this.paperTheme && typeof fill === 'string' && w >= 28 * this.u && h >= 18 * this.u) {
      const fl = fill.toLowerCase();
      if (fl.startsWith('#f') || fl.startsWith('#e') || fl.startsWith('#d') || fl.startsWith('#cf')) {
        this.paperTexture(x + 2, y + 2, w - 4, h - 4, { alpha: 0.72, patina: w > 120 * this.u && h > 100 * this.u });
      }
    }
  }

  /** 木质/宣纸面板 */
  panel(x: number, y: number, w: number, h: number, style: 'wood' | 'paper' | 'dark' = 'wood') {
    const p = Math.max(2, Math.round(this.u * 4));
    const ctx = this.ctx;
    if (!this.paperTheme) {
      if (style === 'paper') {
        this.pixRect(x, y, w, h, C.borderDark, p);
        this.pixRect(x + p, y + p, w - p * 2, h - p * 2, C.paperDark, p);
        this.pixRect(x + p * 2, y + p * 2, w - p * 4, h - p * 4, C.paper, p);
        return;
      }
      if (style === 'dark') {
        this.pixRect(x, y, w, h, '#0e0b14', p);
        this.pixRect(x + p, y + p, w - p * 2, h - p * 2, '#2a2238', p);
        this.pixRect(x + p * 2, y + p * 2, w - p * 4, h - p * 4, '#1c1726', p);
        return;
      }
      this.pixRect(x, y, w, h, '#120d0c', p);
      this.pixRect(x + p, y + p, w - p * 2, h - p * 2, C.border, p);
      this.pixRect(x + p * 2, y + p * 2, w - p * 4, h - p * 4, C.borderDark, p);
      this.pixRect(x + p * 3, y + p * 3, w - p * 6, h - p * 6, C.panel, p);
      ctx.fillStyle = C.gold;
      for (const [cx, cy] of [[x + p * 4, y + p * 4], [x + w - p * 5, y + p * 4], [x + p * 4, y + h - p * 5], [x + w - p * 5, y + h - p * 5]]) ctx.fillRect(cx, cy, p, p);
      return;
    }

    // —— 鎏金水墨面板：外观在 skin.ts，按尺寸缓存后贴图 ——
    this.paperZones.push({ x, y, w, h, layer: this.layer });
    const u = this.u;
    if (style === 'dark') {
      const tile = w < 130 * u && h < 130 * u;
      drawSkin(ctx, tile ? 'pn_tile' : 'pn_inset', x, y, w, h, tile ? 12 * u : 2, (g, pw, ph) => paintPanel(g, pw, ph, u, tile ? 'tile' : 'inset'));
      return;
    }
    drawSkin(ctx, 'pn_card', x, y, w, h, 20 * u, (g, pw, ph) => paintPanel(g, pw, ph, u, 'card'));
  }

  /** 标题条（轻盈古籍卷首题签样式） */
  ribbon(cx: number, cy: number, w: number, label: string, color = '#a22633') {
    const h = 62 * this.u;
    const p = Math.max(2, Math.round(this.u * 3));
    const x = cx - w / 2, y = cy - h / 2;
    if (!this.paperTheme) {
      this.pixRect(x - p * 3, y + p * 2, w + p * 6, h - p * 4, '#120d0c', p);
      this.pixRect(x - p * 2, y + p * 3, w + p * 4, h - p * 6, '#6b1c24', p);
      this.pixRect(x, y, w, h, '#120d0c', p);
      this.pixRect(x + p, y + p, w - p * 2, h - p * 2, color, p);
      this.ctx.fillStyle = 'rgba(255,255,255,0.18)';
      this.ctx.fillRect(x + p * 2, y + p * 2, w - p * 4, p * 2);
      this.text(label, cx, cy, 32, C.text, 'center', '#3a0d12');
      return;
    }

    const ctx = this.ctx, u = this.u;
    this.darkZones.push({ x: x - 24 * u, y, w: w + 48 * u, h, layer: this.layer });
    const lac = ribbonLacquer(color);
    drawSkin(ctx, 'rb_' + color, x, y, w, h, 26 * u, (g, pw, ph) => paintRibbon(g, pw, ph, u, lac));
    // 标题两侧的小金菱
    const tw = this.measure(label, 31);
    const ornOffset = Math.min(w / 2 - 22 * u, tw / 2 + 24 * u);
    if (ornOffset > tw / 2 + 12 * u) {
      const d = 4.5 * u;
      ctx.fillStyle = '#f6dc9a';
      for (const dir of [-1, 1]) {
        const ox = cx + dir * ornOffset;
        ctx.beginPath();
        ctx.moveTo(ox, cy - d); ctx.lineTo(ox + d, cy); ctx.lineTo(ox, cy + d); ctx.lineTo(ox - d, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
    this.text(label, cx, cy + 1 * u, 31, this.preserveTextColors ? C.text : '#fff6e0', 'center', lac.ink);
  }

  /** 按钮：colors = [主色, 暗色, 高光] */
  button(id: string, x: number, y: number, w: number, h: number, label: string, colors: string[] = C.btnGold, opts: { size?: number; icon?: string; disabled?: boolean; sub?: string; redDot?: boolean; tap?: () => void } = {}): boolean {
    const pressed = this.isPressed(id) && !opts.disabled;
    const off = pressed ? Math.round(2.5 * this.u) : 0;
    const p = Math.max(2, Math.round(this.u * 3));
    const cols = opts.disabled ? C.btnGray : colors;
    if (!this.paperTheme) {
      this.pixRect(x, y + p, w, h, '#120d0c', p); // 投影
      this.pixRect(x, y + off, w, h - p, '#120d0c', p);
      this.pixRect(x + p, y + p + off, w - p * 2, h - p * 3, cols[1], p);
      this.pixRect(x + p, y + p + off, w - p * 2, h - p * 4, cols[0], p);
      this.ctx.fillStyle = cols[2];
      this.ctx.fillRect(x + p * 2, y + p + off, w - p * 4, p);
      const size = opts.size || 30;
      let tx = x + w / 2;
      const ty = y + (h - p * 2) / 2 + off + (opts.sub ? -size * this.u * 0.35 : 0);
      if (opts.icon) {
        const isz = size * 1.35 * this.u;
        const tw = this.measure(label, size);
        const total = isz + 8 * this.u + tw;
        this.icon(opts.icon, x + w / 2 - total / 2 + isz / 2, ty, isz);
        tx = x + w / 2 - total / 2 + isz + 8 * this.u + tw / 2;
      }
      this.text(label, tx, ty, size, opts.disabled ? '#e0e0e0' : C.text, 'center', '#2a1410');
      if (opts.sub) this.text(opts.sub, x + w / 2, ty + size * this.u * 0.95, size * 0.62, '#fff', 'center', '#2a1410');
      if (opts.redDot) this.redDot(x + w - 6 * this.u, y + 6 * this.u);
      if (opts.disabled) { this.region(id + ':disabled', x, y, w, h); return false; }
      if (opts.tap) { this.tapNow(id, x, y, w, h, opts.tap); return false; }
      return this.clicked(id, x, y, w, h);
    }

    const ctx = this.ctx, u = this.u;
    const solid = !opts.disabled && (cols === C.btnRed || cols === C.btnGreen) && w >= 180 * u;
    const size = opts.size || 30;
    const lip = Math.max(2, Math.round((solid ? 5 : 4) * u));
    const faceH = h - lip;
    const dy = pressed ? lip - 1 : opts.disabled ? lip * 0.5 : 0;
    let tx = x + w / 2;
    const ty = y + faceH / 2 + dy + (opts.sub ? -size * u * 0.34 : 0);
    if (solid) {
      // 主行动按钮（出征 / 守城 / 入局 / 双倍领取）：鎏金边朱漆 / 松石漆面
      this.darkZones.push({ x, y, w, h, layer: this.layer });
      const lac = cols === C.btnRed ? LACQUER.red : LACQUER.green;
      drawSkin(ctx, (cols === C.btnRed ? 'bt_red' : 'bt_green') + (pressed ? 'P' : ''), x, y, w, h, 16 * u, (g, bw, bh) => paintLacquerButton(g, bw, bh, u, lac, pressed));
      if (opts.icon) {
        const isz = size * 1.3 * u;
        const tw = this.measure(label, size);
        const total = isz + 8 * u + tw;
        this.icon(opts.icon, x + w / 2 - total / 2 + isz / 2, ty, isz);
        tx = x + w / 2 - total / 2 + isz + 8 * u + tw / 2;
      }
      this.text(label, tx, ty, size, this.preserveTextColors ? C.text : '#fff6e0', 'center', lac.ink);
      if (opts.sub) this.text(opts.sub, x + w / 2, ty + size * u * 0.94, Math.max(17, size * 0.52), this.preserveTextColors ? '#fff' : '#ffe9c0', 'center', null);
    } else {
      // 次级按钮：象牙纸笺，边框 / 底色 / 小字带功能色
      this.paperZones.push({ x, y, w, h, layer: this.layer });
      let accent = '#8a6a40', tag = 'n';
      if (opts.disabled || cols === C.btnGray) { accent = '#857868'; tag = 'y'; }
      else if (cols === C.btnPurple) { accent = '#6d3f8a'; tag = 'p'; }
      else if (cols === C.btnBlue) { accent = '#2f6488'; tag = 'b'; }
      else if (cols === C.btnGold) { accent = '#c0801c'; tag = 'g'; }
      else if (cols === C.btnRed) { accent = '#b02c22'; tag = 'r'; }
      else if (cols === C.btnGreen) { accent = '#2d7848'; tag = 'e'; }
      const dis = !!opts.disabled;
      drawSkin(ctx, 'bs_' + tag + (pressed ? 'P' : '') + (dis ? 'D' : ''), x, y, w, h, 12 * u, (g, bw, bh) => paintSlipButton(g, bw, bh, u, accent, pressed, dis));
      if (opts.icon) {
        const isz = size * 1.3 * u;
        const tw = this.measure(label, size);
        const total = isz + 8 * u + tw;
        this.icon(opts.icon, x + w / 2 - total / 2 + isz / 2, ty, isz);
        tx = x + w / 2 - total / 2 + isz + 8 * u + tw / 2;
      }
      const labelColor = this.preserveTextColors ? (dis ? '#e0e0e0' : C.text) : (dis ? '#7d7062' : '#221a13');
      this.text(label, tx, ty, size, labelColor, 'center', null);
      if (opts.sub) this.text(opts.sub, x + w / 2, ty + size * u * 0.92, size * 0.58, this.preserveTextColors ? '#fff' : dis ? '#7d7062' : mix(accent, '#2a1c10', 0.25), 'center', null);
    }

    if (opts.redDot) this.redDot(x + w - 6 * this.u, y + 6 * this.u);
    if (opts.disabled) { this.region(id + ':disabled', x, y, w, h); return false; }
    if (opts.tap) { this.tapNow(id, x, y, w, h, opts.tap); return false; }
    return this.clicked(id, x, y, w, h);
  }

  redDot(x: number, y: number) {
    const r = 11 * this.u;
    const ctx = this.ctx;
    if (!this.paperTheme) {
      ctx.fillStyle = '#120d0c';
      ctx.beginPath(); ctx.arc(x, y, r + 2 * this.u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2a3a';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9a9a';
      ctx.fillRect(x - r * 0.4, y - r * 0.6, r * 0.4, r * 0.4);
      return;
    }
    // 朱砂印点：细墨圈 + 纸色衬圈 + 平涂朱红，比原来的亮红球安静，满屏红点时不吵。
    const k = 0.82;
    ctx.fillStyle = 'rgba(30,20,14,0.85)';
    ctx.beginPath(); ctx.arc(x, y, r * k + 2.6 * this.u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f3e6c8';
    ctx.beginPath(); ctx.arc(x, y, r * k + 1.4 * this.u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(x, y, r * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,200,0.45)';
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.28, r * 0.2, 0, Math.PI * 2); ctx.fill();
  }

  /** 绘制图标：this.paperTheme 下优先使用 16x16 精细像素图标，保持纯正像素风与整数倍清晰缩放 */
  icon(name: string, cx: number, cy: number, size: number, alpha = 1) {
    if (this.paperTheme && hasSprite('icon_hd_' + name)) {
      this.drawSprite(sprite('icon_hd_' + name), cx, cy, size, alpha);
      return;
    }
    const s = hasSprite('icon_' + name) ? sprite('icon_' + name) : sprite(name);
    this.drawSprite(s, cx, cy, size, alpha);
  }

  drawSprite(s: Sprite, cx: number, cy: number, size: number, alpha = 1) {
    const max = Math.max(s.w, s.h);
    let scale = size / max;
    if (this.paperTheme && s.key && s.key.startsWith('icon_hd_')) {
      scale = scale >= 1.65 ? Math.floor(scale + 0.35) : Math.max(1, Math.floor(scale + 0.25));
    } else {
      if (scale >= 2) scale = Math.floor(scale);
      else if (scale >= 1.5) scale = 2;
    }
    const w = s.w * scale, h = s.h * scale;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (scale >= 2) {
      // 整数倍放大：使用预先放大的像素图 1:1 绘制，避免手机端平滑导致模糊
      const ss = scaled(s, scale);
      ctx.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, Math.round(cx - w / 2), Math.round(cy - h / 2), ss.w, ss.h);
    } else ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  bar(x: number, y: number, w: number, h: number, ratio: number, color: string, back = '#1a1210', border = '#120d0c') {
    const ctx = this.ctx;
    if (this.paperTheme) {
      this.inkBar(x, y, w, h, ratio, color, back);
      return;
    }
    const p = Math.max(2, Math.round(this.u * 3));
    ctx.fillStyle = border;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = back;
    ctx.fillRect(x + p, y + p, w - p * 2, h - p * 2);
    const fw = Math.max(0, (w - p * 2) * Math.min(1, ratio));
    ctx.fillStyle = color;
    ctx.fillRect(x + p, y + p, fw, h - p * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + p, y + p, fw, Math.max(1, (h - p * 2) * 0.32));
  }

  /**
   * 宣纸进度条：细墨线外框，槽为熟宣色（战斗 HUD 等深底处保留深色槽），
   * 进度用矿物颜料色（石绿 / 赭石 / 石青 / 朱砂），末端一笔浓墨收锋。
   */
  private inkBar(x: number, y: number, w: number, h: number, ratio: number, color: string, back: string) {
    const ctx = this.ctx, u = this.u;
    const b = Math.max(1, 1.4 * u);
    const darkBack = back !== '#1a1210';
    const pigment = INK_PIGMENT[color.toLowerCase()] || color;
    drawSkin(ctx, 'bar_' + (darkBack ? back : 'p'), x, y, w, h, 1, (g, bw, bh) => paintBarTrack(g, bw, bh, u, darkBack ? back : null));
    const ix = Math.round(x) + b, iy = Math.round(y) + b, iw = Math.round(w) - b * 2, ih = Math.round(h) - b * 2;
    if (!darkBack) this.markPaper(ix, iy, iw, ih);
    const fw = Math.max(0, iw * Math.min(1, ratio));
    if (fw > 1) {
      const r = Math.min(ih / 2, 6 * u, fw / 2);
      rr(ctx, ix, iy, fw, ih, r);
      ctx.fillStyle = pigment;
      ctx.fill();
      // 上沿高光、下沿压暗（不用渐变，进度条每帧都在变，直接画两条）
      ctx.fillStyle = 'rgba(255,250,228,0.34)';
      ctx.fillRect(ix + r * 0.6, iy + Math.max(1, ih * 0.12), Math.max(0, fw - r * 1.2), Math.max(1, ih * 0.24));
      ctx.fillStyle = 'rgba(24,14,8,0.2)';
      ctx.fillRect(ix + r * 0.6, iy + ih - Math.max(1, ih * 0.26), Math.max(0, fw - r * 1.2), Math.max(1, ih * 0.18));
    }
  }

  /** 品质框 */
  qualityFrame(x: number, y: number, size: number, color: string) {
    const p = Math.max(2, Math.round(this.u * 4));
    if (!this.paperTheme) {
      this.pixRect(x, y, size, size, '#120d0c', p);
      this.pixRect(x + p, y + p, size - p * 2, size - p * 2, color, p);
      this.pixRect(x + p * 2, y + p * 2, size - p * 4, size - p * 4, '#2a2030', p);
      const g = this.ctx;
      g.fillStyle = color;
      g.globalAlpha = 0.25;
      g.fillRect(x + p * 2, y + size / 2, size - p * 4, size / 2 - p * 2);
      g.globalAlpha = 1;
      return;
    }

    // 品质格：品质色描边 + 淡染纸面，缓存贴图
    this.paperZones.push({ x, y, w: size, h: size, layer: this.layer });
    const u = this.u;
    const col = SLOT_COLOR[color.toLowerCase()] || color;
    drawSkin(this.ctx, 'qf_' + col, x, y, size, size, 10 * u, (g, s) => paintSlot(g, s, u, col));
  }

  dim(alpha = 0.6) {
    this.ctx.fillStyle = `rgba(8,6,12,${alpha})`;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  toast(text: string) {
    this.toasts.push({ text, t: 0 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  private drawToasts() {
    let y = this.safeTop + 178 * this.u;
    const u = this.u;
    const ctx = this.ctx;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.t += 1 / 60;
      if (t.t > 1.8) { this.toasts.splice(i, 1); continue; }
      const a = t.t < 0.15 ? t.t / 0.15 : t.t > 1.5 ? (1.8 - t.t) / 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      if (!this.paperTheme) {
        const w = this.measure(t.text, 28) + 60 * u;
        this.pixRect(this.W / 2 - w / 2, y - 30 * u, w, 60 * u, 'rgba(12,8,10,0.85)');
        this.text(t.text, this.W / 2, y, 28, '#fff4d6', 'center', null);
      } else {
        // 墨漆描金提示条：压在任何底色上都看得清
        const tw = this.measure(t.text, 26);
        const w = Math.min(this.W - 40 * u, tw + 96 * u);
        const h = 64 * u;
        const x = this.W / 2 - w / 2, ty0 = y - h / 2 + (1 - Math.min(1, t.t / 0.15)) * 12 * u;
        this.markDark(x, ty0, w, h);
        drawSkin(ctx, 'toast', x, ty0, w, h, 12 * u, (g, pw, ph) => paintInkPill(g, pw, ph, u, 0.94));
        ctx.fillStyle = '#f0cf86';
        for (const dir of [-1, 1]) {
          const dx = this.W / 2 + dir * (w / 2 - 24 * u), cy = ty0 + h / 2, d = 4 * u;
          ctx.beginPath();
          ctx.moveTo(dx, cy - d); ctx.lineTo(dx + d, cy); ctx.lineTo(dx, cy + d); ctx.lineTo(dx - d, cy);
          ctx.closePath();
          ctx.fill();
        }
        this.text(t.text, this.W / 2, ty0 + h / 2 + 0.5 * u, 26, '#fbf4e4', 'center', null);
      }
      ctx.restore();
      y += 70 * u;
    }
  }
}
