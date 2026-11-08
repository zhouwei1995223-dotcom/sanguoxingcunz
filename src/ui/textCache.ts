import { getPlatform } from '../platform';

/**
 * 文字缓存：同样的文字（内容 + 字体 + 颜色 + 描边）第一次画进离屏图集，之后每帧直接贴图。
 * 水墨 UI 用加粗宋体，手机上每帧几十段 fillText / strokeText 很费（采样里 fillText 占 JS 时间的四分之一）。
 * 图集用满就整体清空重来；如果清空太频繁（每秒都在换大量文字），自动退回直接绘制。
 */
const PAGE = 1024;
const MAX_PAGES = 3;

interface Entry { page: number; x: number; y: number; w: number; h: number; pad: number; tw: number }

export class TextCache {
  private pages: { c: HTMLCanvasElement; g: CanvasRenderingContext2D }[] = [];
  private map = new Map<string, Entry>();
  private cur = 0;
  private sx = 0;
  private sy = 0;
  private rowH = 0;
  private resets: number[] = [];
  disabledUntil = 0;
  /** 统计：未命中次数、清空次数（测试脚本读取） */
  misses = 0;
  clears = 0;
  lastMiss = '';

  private page(i: number) {
    if (!this.pages[i]) {
      const c = getPlatform().createCanvas(PAGE, PAGE);
      this.pages[i] = { c, g: c.getContext('2d')! };
    }
    return this.pages[i];
  }

  private reset(now: number) {
    this.map.clear();
    this.clears++;
    this.cur = 0; this.sx = 0; this.sy = 0; this.rowH = 0;
    for (const p of this.pages) p.g.clearRect(0, 0, PAGE, PAGE);
    this.resets.push(now);
    while (this.resets.length && now - this.resets[0] > 2000) this.resets.shift();
    // 2 秒内清空 3 次以上：文字变化太快，缓存只会更慢，先停用 10 秒
    if (this.resets.length >= 3) { this.disabledUntil = now + 10000; this.resets.length = 0; }
  }

  /**
   * 画一段文字。返回 false 表示没走缓存（调用方自己直接绘制）。
   * (x, y) 与 textBaseline = 'middle' 的语义一致。
   */
  draw(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, font: string, px: number, align: CanvasTextAlign,
    fill: string, stroke: string | null, lineWidth: number): boolean {
    if (!str) return true;
    const now = Date.now();
    if (now < this.disabledUntil) return false;
    const key = font + '\u0001' + fill + '\u0001' + (stroke ? stroke + '\u0001' + lineWidth : '') + '\u0001' + str;
    let e = this.map.get(key);
    if (!e) {
      this.misses++; this.lastMiss = str;
      ctx.font = font;
      const tw = ctx.measureText(str).width;
      const pad = Math.ceil((stroke ? lineWidth / 2 : 0) + 2);
      const w = Math.ceil(tw) + pad * 2, h = Math.ceil(px * 1.5) + pad * 2;
      if (w > PAGE || h > PAGE) return false;
      if (this.sx + w > PAGE) { this.sx = 0; this.sy += this.rowH; this.rowH = 0; }
      if (this.sy + h > PAGE) {
        this.cur++; this.sx = 0; this.sy = 0; this.rowH = 0;
        if (this.cur >= MAX_PAGES) {
          this.reset(now);
          if (now < this.disabledUntil) return false;
        }
      }
      const p = this.page(this.cur), g = p.g;
      g.font = font;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      const tx = this.sx + pad, ty = this.sy + h / 2;
      if (stroke) {
        g.lineJoin = 'round';
        g.lineWidth = lineWidth;
        g.strokeStyle = stroke;
        g.strokeText(str, tx, ty);
      }
      g.fillStyle = fill;
      g.fillText(str, tx, ty);
      e = { page: this.cur, x: this.sx, y: this.sy, w, h, pad, tw };
      this.sx += w;
      this.rowH = Math.max(this.rowH, h);
      this.map.set(key, e);
    }
    const left = align === 'center' ? x - e.tw / 2 : align === 'right' || align === 'end' ? x - e.tw : x;
    ctx.drawImage(this.pages[e.page].c, e.x, e.y, e.w, e.h, Math.round(left - e.pad), Math.round(y - e.h / 2), e.w, e.h);
    return true;
  }
}
