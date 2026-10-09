import { getPlatform } from '../platform';
import { sprite, hasSprite, Sprite } from '../gfx/atlas';
import type { TouchKind, TouchPoint } from '../platform/types';
import { playSfx } from '../audio/sound';

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

export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

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

export class UI {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  u: number; // 1 设计单位对应的设备像素（设计宽度 750）
  safeTop: number;
  safeBottom: number;

  private regions: Region[] = [];
  private prevRegions: Region[] = [];
  private clickedId: string | null = null;
  private pressedId: string | null = null;
  layer = 0;
  private clipStack: [number, number, number, number][] = [];

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
      if (sr) { this.activeScroll = sr.id; const s = this.scrolls[sr.id]; if (s) s.vel = 0; }
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
            s.offset = Math.max(-40 * this.u, Math.min(s.max + 40 * this.u, s.offset - dy));
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
          if (r && r.id === this.pressedId) this.clickedId = r.id;
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
    this.regions = [];
    this.layer = 0;
    // 惯性滚动
    for (const id in this.scrolls) {
      const s = this.scrolls[id];
      if (this.activeScroll === id && this.pointerDown) continue;
      if (Math.abs(s.vel) > 1) {
        s.offset += s.vel * dt;
        s.vel *= Math.pow(0.04, dt);
      } else s.vel = 0;
      if (s.offset < 0) { s.offset += (0 - s.offset) * Math.min(1, dt * 12); if (s.offset > -0.5) s.offset = 0; }
      if (s.offset > s.max) { s.offset += (s.max - s.offset) * Math.min(1, dt * 12); if (s.offset - s.max < 0.5) s.offset = s.max; }
    }
  }

  end() {
    this.prevRegions = this.regions;
    this.clickedId = null;
    this.drawToasts();
  }

  region(id: string, x: number, y: number, w: number, h: number) {
    const clip = this.clipStack.length ? this.clipStack[this.clipStack.length - 1] : undefined;
    this.regions.push({ id, x, y, w, h, layer: this.layer, clip });
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
    return `${bold ? 'bold ' : ''}${Math.round(size * this.u)}px ${FONT}`;
  }

  text(str: string, x: number, y: number, size: number, color = C.text, align: CanvasTextAlign = 'center', stroke: string | null = '#1a1210', bold = true) {
    const ctx = this.ctx;
    ctx.font = this.font(size, bold);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * this.u * 0.18);
      ctx.strokeStyle = stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
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

  /** 像素风切角矩形 */
  pixRect(x: number, y: number, w: number, h: number, color: string, cut?: number) {
    const ctx = this.ctx;
    const c = cut ?? Math.max(2, Math.round(this.u * 4));
    ctx.fillStyle = color;
    ctx.fillRect(x + c, y, w - c * 2, h);
    ctx.fillRect(x, y + c, w, h - c * 2);
  }

  /** 木质面板 */
  panel(x: number, y: number, w: number, h: number, style: 'wood' | 'paper' | 'dark' = 'wood') {
    const p = Math.max(2, Math.round(this.u * 4));
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
    // 角落铆钉
    const ctx = this.ctx;
    ctx.fillStyle = C.gold;
    for (const [cx, cy] of [[x + p * 4, y + p * 4], [x + w - p * 5, y + p * 4], [x + p * 4, y + h - p * 5], [x + w - p * 5, y + h - p * 5]]) ctx.fillRect(cx, cy, p, p);
  }

  /** 标题条（卷轴样式） */
  ribbon(cx: number, cy: number, w: number, label: string, color = '#a22633') {
    const h = 64 * this.u;
    const p = Math.max(2, Math.round(this.u * 4));
    const x = cx - w / 2, y = cy - h / 2;
    this.pixRect(x - p * 3, y + p * 2, w + p * 6, h - p * 4, '#120d0c', p);
    this.pixRect(x - p * 2, y + p * 3, w + p * 4, h - p * 6, '#6b1c24', p);
    this.pixRect(x, y, w, h, '#120d0c', p);
    this.pixRect(x + p, y + p, w - p * 2, h - p * 2, color, p);
    this.ctx.fillStyle = 'rgba(255,255,255,0.18)';
    this.ctx.fillRect(x + p * 2, y + p * 2, w - p * 4, p * 2);
    this.text(label, cx, cy, 32, C.text, 'center', '#3a0d12');
  }

  /** 按钮：colors = [主色, 暗色, 高光] */
  button(id: string, x: number, y: number, w: number, h: number, label: string, colors: string[] = C.btnGold, opts: { size?: number; icon?: string; disabled?: boolean; sub?: string; redDot?: boolean } = {}): boolean {
    const pressed = this.isPressed(id) && !opts.disabled;
    const off = pressed ? Math.round(3 * this.u) : 0;
    const p = Math.max(2, Math.round(this.u * 4));
    const cols = opts.disabled ? C.btnGray : colors;
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
    return this.clicked(id, x, y, w, h);
  }

  redDot(x: number, y: number) {
    const r = 11 * this.u;
    const ctx = this.ctx;
    ctx.fillStyle = '#120d0c';
    ctx.beginPath(); ctx.arc(x, y, r + 2 * this.u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2a3a';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9a9a';
    ctx.fillRect(x - r * 0.4, y - r * 0.6, r * 0.4, r * 0.4);
  }

  /** 绘制像素图标，尽量整数倍缩放以保持像素清晰 */
  icon(name: string, cx: number, cy: number, size: number, alpha = 1) {
    const s = hasSprite('icon_' + name) ? sprite('icon_' + name) : sprite(name);
    this.drawSprite(s, cx, cy, size, alpha);
  }

  drawSprite(s: Sprite, cx: number, cy: number, size: number, alpha = 1) {
    const max = Math.max(s.w, s.h);
    let scale = size / max;
    if (scale >= 2) scale = Math.floor(scale);
    const w = s.w * scale, h = s.h * scale;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  bar(x: number, y: number, w: number, h: number, ratio: number, color: string, back = '#1a1210', border = '#120d0c') {
    const ctx = this.ctx;
    const p = Math.max(2, Math.round(this.u * 3));
    ctx.fillStyle = border;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = back;
    ctx.fillRect(x + p, y + p, w - p * 2, h - p * 2);
    ctx.fillStyle = color;
    ctx.fillRect(x + p, y + p, Math.max(0, (w - p * 2) * Math.min(1, ratio)), h - p * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + p, y + p, Math.max(0, (w - p * 2) * Math.min(1, ratio)), Math.max(1, (h - p * 2) * 0.3));
  }

  /** 品质框 */
  qualityFrame(x: number, y: number, size: number, color: string) {
    const p = Math.max(2, Math.round(this.u * 4));
    this.pixRect(x, y, size, size, '#120d0c', p);
    this.pixRect(x + p, y + p, size - p * 2, size - p * 2, color, p);
    this.pixRect(x + p * 2, y + p * 2, size - p * 4, size - p * 4, '#2a2030', p);
    const g = this.ctx;
    g.fillStyle = color;
    g.globalAlpha = 0.25;
    g.fillRect(x + p * 2, y + size / 2, size - p * 4, size / 2 - p * 2);
    g.globalAlpha = 1;
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
    let y = this.H * 0.42;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.t += 1 / 60;
      if (t.t > 1.8) { this.toasts.splice(i, 1); continue; }
      const a = t.t < 0.15 ? t.t / 0.15 : t.t > 1.5 ? (1.8 - t.t) / 0.3 : 1;
      const w = this.measure(t.text, 28) + 60 * this.u;
      this.ctx.globalAlpha = a;
      this.pixRect(this.W / 2 - w / 2, y - 30 * this.u, w, 60 * this.u, 'rgba(12,8,10,0.85)');
      this.text(t.text, this.W / 2, y, 28, '#fff4d6', 'center', null);
      this.ctx.globalAlpha = 1;
      y -= 70 * this.u;
    }
  }
}
