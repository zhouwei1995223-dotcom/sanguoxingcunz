import { PALETTE, hexToRgba } from './palette';

// 与平台无关的像素图：每个像素存一个调色板字符，'.' 表示透明。
// 美术全部用代码生成：字符画 + 程序化绘制 + 自动描边 / 换色。

export class PixelImage {
  w: number;
  h: number;
  px: string[];

  constructor(w: number, h: number, fill = '.') {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(fill);
  }

  static fromRows(rows: string[]): PixelImage {
    const w = Math.max(...rows.map((r) => r.length));
    const img = new PixelImage(w, rows.length);
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) img.px[y * w + x] = r[x] === ' ' ? '.' : r[x];
    });
    return img;
  }

  clone(): PixelImage {
    const c = new PixelImage(this.w, this.h);
    c.px = this.px.slice();
    return c;
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.px[y * this.w + x];
  }

  set(x: number, y: number, c: string) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  /** 叠加：src 非透明像素覆盖到 (dx,dy) */
  blit(src: PixelImage, dx: number, dy: number): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.px[y * src.w + x];
        if (c !== '.') this.set(dx + x, dy + y, c);
      }
    return this;
  }

  /** 在四周加一圈描边，尺寸 +2 */
  outline(color = 'k', diagonal = false): PixelImage {
    const o = new PixelImage(this.w + 2, this.h + 2);
    o.blit(this, 1, 1);
    const solid = (c: string) => c !== '.' && c !== 'a' && c !== 'A' && c !== 'h';
    const res = o.clone();
    for (let y = 0; y < o.h; y++)
      for (let x = 0; x < o.w; x++) {
        if (o.get(x, y) !== '.') continue;
        let hit = solid(o.get(x - 1, y)) || solid(o.get(x + 1, y)) || solid(o.get(x, y - 1)) || solid(o.get(x, y + 1));
        if (!hit && diagonal)
          hit = solid(o.get(x - 1, y - 1)) || solid(o.get(x + 1, y - 1)) || solid(o.get(x - 1, y + 1)) || solid(o.get(x + 1, y + 1));
        if (hit) res.set(x, y, color);
      }
    return res;
  }

  flipX(): PixelImage {
    const f = new PixelImage(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) f.px[y * this.w + (this.w - 1 - x)] = this.px[y * this.w + x];
    return f;
  }

  recolor(map: Record<string, string>): PixelImage {
    const r = this.clone();
    r.px = r.px.map((c) => (map[c] !== undefined ? map[c] : c));
    return r;
  }

  /** 扩展画布（四周留空） */
  pad(l: number, t: number, r: number, b: number): PixelImage {
    const p = new PixelImage(this.w + l + r, this.h + t + b);
    return p.blit(this, l, t);
  }

  // —— 程序化绘制 ——
  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  disc(cx: number, cy: number, r: number, c: string): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r + 0.3) this.set(x, y, c);
      }
    return this;
  }

  ring(cx: number, cy: number, r: number, c: string, thick = 1): this {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (d <= r + 0.5 && d > r - thick + 0.5 - 1e-6) this.set(x, y, c);
      }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** 把同一种颜色的非边缘像素的下半部分替换成暗色，做简单体积感 */
  shadeBottom(from: string, to: string, ratio = 0.35): this {
    let minY = this.h, maxY = 0;
    this.px.forEach((c, i) => { if (c === from) { const y = (i / this.w) | 0; minY = Math.min(minY, y); maxY = Math.max(maxY, y); } });
    const cut = maxY - (maxY - minY) * ratio;
    this.px = this.px.map((c, i) => (c === from && ((i / this.w) | 0) > cut ? to : c));
    return this;
  }

  toRGBA(): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    const cache: Record<string, [number, number, number, number]> = {};
    this.px.forEach((c, i) => {
      if (c === '.') return;
      const col = cache[c] || (cache[c] = hexToRgba(PALETTE[c] || '#ff00ff'));
      out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = col[3];
    });
    return out;
  }
}

/** 把多行字符画转成图像，并可选自动描边 */
export function art(rows: string[], outline = true): PixelImage {
  const img = PixelImage.fromRows(rows);
  return outline ? img.outline() : img;
}
