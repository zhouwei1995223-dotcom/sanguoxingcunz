import { sprite, scaled } from '../gfx/atlas';
import { hash2 } from '../core/math';
import { save } from '../meta/save';
import { heroSpriteName } from '../meta/goals';

// 主城背景：低分辨率像素风动态场景（黄昏战场、远山、旌旗、奔驰的赵云）

export class HomeBackground {
  private g!: CanvasRenderingContext2D;
  private w: number;
  private h: number;
  private scale: number;
  private t = 0;

  constructor(W: number, H: number) {
    this.scale = Math.max(3, Math.round(W / 150));
    this.w = Math.ceil(W / this.scale);
    this.h = Math.ceil(H / this.scale);
  }

  /** footY：人物脚底在屏幕上的位置（设备像素），地平线跟着它走，保证人物不被下面的卡片挡住 */
  draw(out: CanvasRenderingContext2D, dt: number, footY?: number, topY = 0, sideW = 0) {
    this.t += dt;
    // 直接在屏幕上按 scale 倍绘制（整数坐标的色块天然清晰）
    out.save();
    out.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.g = out;
    const g = this.g, w = this.w, h = this.h, t = this.t;
    const gy = footY !== undefined ? Math.round(footY / this.scale) - 18 : Math.round(h * 0.62);
    // 天空分层（像素风不做平滑渐变）
    const sky = ['#2a1d3a', '#3d2547', '#5e2f4c', '#8a3d48', '#b85a3e', '#e08a4a', '#f2b45a'];
    const band = Math.ceil(gy / sky.length);
    sky.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * band, w, band + 1); });
    // 夕阳与光晕
    const sx = Math.round(w * 0.72), sy = Math.round(gy - band * 1.6);
    for (const [r, a] of [[22, 0.12], [16, 0.18]] as [number, number][]) {
      g.fillStyle = `rgba(254,231,97,${a + 0.03 * Math.sin(t * 1.5)})`;
      for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(sx - hw, sy + y, hw * 2 + 1, 1); }
    }
    g.fillStyle = '#fee761';
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 81) g.fillRect(sx + x, sy + y, 1, 1);
    g.fillStyle = '#f2b45a';
    for (let i = 0; i < 4; i++) g.fillRect(sx - 12 + i * 2, sy + 3 + i * 2, 24 - i * 4, 1);
    // 云
    g.fillStyle = 'rgba(255,220,180,0.35)';
    for (let i = 0; i < 5; i++) {
      const cx = ((hash2(i, 1) * w * 1.5 + t * (3 + i)) % (w + 60)) - 30;
      const cy = 8 + hash2(i, 2) * gy * 0.45;
      g.fillRect(Math.round(cx), Math.round(cy), 22 + i * 3, 2);
      g.fillRect(Math.round(cx) + 5, Math.round(cy) - 2, 12, 2);
    }
    // 远山（两层视差）
    this.mountains(gy, '#4a2b45', 0.6, 22, t * 2, 3);
    this.mountains(gy, '#33203a', 0.35, 14, t * 5, 7);
    // 地平线上远处行军的军队剪影（慢慢向左移动）
    g.fillStyle = '#2a1830';
    for (let i = 0; i < 40; i++) {
      const x = Math.round(((i * 9 + hash2(i, 21) * 6 - t * 4) % (w + 30) + w + 30) % (w + 30) - 15);
      const y = gy - 3 - Math.round(hash2(i, 22) * 2);
      g.fillRect(x, y, 2, 3);
      g.fillRect(x + 1, y - 4 - Math.round(hash2(i, 23) * 2), 1, 4);
      if (i % 7 === 0) { g.fillStyle = '#5e1f2c'; g.fillRect(x + 2, y - 7, 3, 2); g.fillStyle = '#2a1830'; }
    }
    // 地面
    g.fillStyle = '#3e5a2c';
    g.fillRect(0, gy, w, h - gy);
    g.fillStyle = '#4f7036';
    g.fillRect(0, gy, w, 2);
    // 地面纹理滚动
    const speed = 40;
    for (let i = 0; i < 70; i++) {
      const x = ((hash2(i, 5) * w * 2 - t * speed * (0.6 + hash2(i, 6))) % (w + 20) + w + 20) % (w + 20) - 10;
      const y = gy + 3 + hash2(i, 7) * (h - gy - 4);
      g.fillStyle = hash2(i, 8) > 0.5 ? '#2f4722' : '#5c7f3c';
      g.fillRect(Math.round(x), Math.round(y), 2 + Math.round(hash2(i, 9) * 3), 1);
    }
    // 远处的旌旗
    for (let i = 0; i < 6; i++) {
      const x = Math.round(((hash2(i, 11) * w * 2 - t * 12) % (w + 40) + w + 40) % (w + 40) - 20);
      const y = gy - 2;
      g.fillStyle = '#231917';
      g.fillRect(x, y - 16, 1, 16);
      g.fillStyle = i % 2 ? '#a22633' : '#124e89';
      const wave = Math.round(Math.sin(t * 4 + i) * 1);
      g.fillRect(x + 1, y - 16 + wave, 6, 4);
      g.fillRect(x + 1, y - 12, 4, 2);
    }
    // 尘土
    for (let i = 0; i < 8; i++) {
      const k = (t * 1.6 + i / 8) % 1;
      g.fillStyle = `rgba(200,170,120,${0.5 * (1 - k)})`;
      const r = 1 + k * 4;
      g.fillRect(Math.round(w * 0.5 - 10 - k * 40), Math.round(gy + 14 - k * 6 - r), Math.round(r * 2), Math.round(r));
    }
    out.restore();

    // 出战武将：按剩余空间整数倍放大（矮屏 2 倍，高屏最多 3 倍），不压住两侧按钮
    const hero = sprite(`${heroSpriteName(save.hero)}_${Math.floor(t * 10) % 4}`);
    const S = this.scale;
    const fy = (gy + 18) * S;
    const maxM = Math.min((fy - topY) / 40, (out.canvas.width - sideW * 2) / 40);
    const m = Math.max(2 * S, Math.min(3 * S, Math.floor(maxM)));
    this.heroM = m;
    const hx = Math.round(out.canvas.width / 2 + 3 * m);
    out.imageSmoothingEnabled = false;
    out.fillStyle = 'rgba(0,0,0,0.3)';
    out.fillRect(Math.round(hx - 11 * m), Math.round(fy - m / 2), 22 * m, Math.round(m * 1.5));
    const hz = scaled(hero, m);
    out.drawImage(hz.canvas, hz.x, hz.y, hz.w, hz.h, Math.round(hx - hero.ax * m), Math.round(fy - hero.ay * m), hero.w * m, hero.h * m);
    this.heroBox = [hx - 18 * m, fy - 34 * m, 36 * m, 34 * m];

    // 顶部渐暗：让顶栏的数字更清楚
    const grad = out.createLinearGradient(0, 0, 0, out.canvas.height * 0.22);
    grad.addColorStop(0, 'rgba(12,8,18,0.7)');
    grad.addColorStop(1, 'rgba(12,8,18,0)');
    out.fillStyle = grad;
    out.fillRect(0, 0, out.canvas.width, out.canvas.height * 0.22);
  }

  private heroM = 0;
  /** 人物在屏幕上的范围（点击跳转武将页） */
  heroBox: [number, number, number, number] = [0, 0, 0, 0];

  private mountains(gy: number, color: string, amp: number, base: number, scroll: number, seed: number) {
    const g = this.g;
    g.fillStyle = color;
    for (let x = 0; x < this.w; x++) {
      const wx = x + scroll;
      const n = Math.sin(wx * 0.05 + seed) * 0.5 + Math.sin(wx * 0.013 + seed * 2) * 0.8 + Math.sin(wx * 0.11 + seed) * 0.15;
      const hh = Math.round(base + n * base * amp);
      g.fillRect(x, gy - hh, 1, hh);
    }
  }
}
