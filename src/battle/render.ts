import { getPlatform } from '../platform';
import { sprite, scaled, Sprite } from '../gfx/atlas';
import { THEMES, GroundTheme } from '../gfx/art/env';
import { hash2, TAU } from '../core/math';
import type { Battle } from './battle';
import type { Enemy } from './entities';
import { levelData } from './weapons';

// 世界渲染：先在低分辨率画布上按 1:1 像素绘制，再整数倍放大到屏幕，保证像素风清晰

const TALL = new Set(['tree', 'pine', 'deadTree', 'banner', 'bigRock']);
const CELL = 36;
/** 地图块大小（世界像素，地砖 96 的整数倍） */
const CHUNK = 192;
/** 地图块缓存上限（每块 192×192×倍率，3 倍时约 1.3MB） */
const CHUNK_CACHE = 18;

interface Drawable {
  y: number;
  /** 敌人用复用的条目（不为每个敌人每帧新建闭包），其他物体用 draw */
  e?: Enemy | null;
  draw?: () => void;
}

export class WorldRenderer {
  ctx!: CanvasRenderingContext2D;
  w: number;
  h: number;
  scale: number;
  camX = 0;
  camY = 0;
  shake = 0;
  private tile: HTMLCanvasElement;
  private theme: GroundTheme;
  private themeName: string;
  private list: Drawable[] = [];
  private enemyPool: Drawable[] = [];
  private crowded = false;
  /** 敌人精灵名缓存：避免每帧为每个敌人拼字符串 */
  private nameCache: Record<string, string[]> = {};
  private enemyName(sp: string, frame: number, left: boolean, flash: boolean) {
    let a = this.nameCache[sp];
    if (!a) {
      a = this.nameCache[sp] = [];
      for (let f = 0; f < 4; f++) for (const l of [false, true]) for (const w of [false, true]) a.push(`${sp}_${f}${l ? '_L' : ''}${w ? (l ? 'W' : '_W') : ''}`);
    }
    return a[frame * 4 + (left ? 2 : 0) + (flash ? 1 : 0)];
  }

  constructor(screenW: number, screenH: number, themeName: string) {
    this.scale = Math.max(2, Math.round(screenW / 280));
    this.w = Math.ceil(screenW / this.scale);
    this.h = Math.ceil(screenH / this.scale);
    this.themeName = themeName;
    this.theme = THEMES[themeName];
    this.tile = this.buildTile();
  }

  private chunks = new Map<string, HTMLCanvasElement>();
  /** 地图块：地砖 + 矮装饰（草、花、石头……）画在一张图里，按需生成，最近用过的留在缓存 */
  private chunk(kx: number, ky: number): HTMLCanvasElement {
    const key = kx + ',' + ky;
    const hit = this.chunks.get(key);
    if (hit) { this.chunks.delete(key); this.chunks.set(key, hit); return hit; }
    const K = this.scale, T = 96;
    const c = getPlatform().createCanvas(CHUNK * K, CHUNK * K);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < CHUNK; y += T) for (let x = 0; x < CHUNK; x += T) g.drawImage(this.tile, 0, 0, T * K, T * K, x * K, y * K, T * K, T * K);
    const x0 = kx * CHUNK, y0 = ky * CHUNK;
    const decor = this.theme.decor;
    let total = 0;
    for (const d of decor) total += d[1];
    // 装饰可能跨到相邻地图块：把周围一圈格子都算上，超出部分会被画布边缘裁掉
    for (let gy = Math.floor(y0 / CELL) - 1; gy <= Math.floor((y0 + CHUNK) / CELL) + 1; gy++)
      for (let gx = Math.floor(x0 / CELL) - 1; gx <= Math.floor((x0 + CHUNK) / CELL) + 1; gx++) {
        if (hash2(gx, gy, 11) > 0.42) continue;
        if (Math.abs(gx) <= 1 && Math.abs(gy) <= 1) continue;
        const r = hash2(gx, gy, 23);
        let acc = 0, name = decor[0][0];
        for (const d of decor) { acc += d[1] / total; if (r <= acc) { name = d[0]; break; } }
        if (TALL.has(name)) continue;
        const wx = gx * CELL + hash2(gx, gy, 31) * (CELL - 8), wy = gy * CELL + hash2(gx, gy, 41) * (CELL - 8);
        const s = sprite(`env_${this.themeName}_${name}`);
        const ss = scaled(s, K);
        g.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, Math.round(wx - s.ax - x0) * K, Math.round(wy - s.ay - y0) * K, s.w * K, s.h * K);
      }
    this.chunks.set(key, c);
    if (this.chunks.size > CHUNK_CACHE) this.chunks.delete(this.chunks.keys().next().value as string);
    return c;
  }

  /** 地表贴图：直接按屏幕像素倍率绘制，保证清晰 */
  private buildTile(): HTMLCanvasElement {
    const S = 96;
    const K = this.scale;
    const c = getPlatform().createCanvas(S * K, S * K);
    const g0 = c.getContext('2d')!;
    const g = {
      set fillStyle(v: string) { g0.fillStyle = v; },
      set globalAlpha(v: number) { g0.globalAlpha = v; },
      fillRect(x: number, y: number, w: number, h: number) { g0.fillRect(x * K, y * K, w * K, h * K); },
    };
    const th = this.theme;
    g.fillStyle = th.base;
    g.fillRect(0, 0, S, S);
    // 大块色斑
    for (let i = 0; i < 9; i++) {
      const x = (hash2(i, 1, 7) * S) | 0, y = (hash2(i, 2, 7) * S) | 0;
      const r = 6 + hash2(i, 3, 7) * 10;
      g.fillStyle = i % 2 ? th.dark : th.light;
      g.globalAlpha = 0.35;
      for (let yy = -r; yy <= r; yy++)
        for (let xx = -r; xx <= r; xx++)
          if (xx * xx + yy * yy * 1.6 < r * r) g.fillRect((x + xx + S) % S, (y + yy + S) % S, 1, 1);
    }
    g.globalAlpha = 1;
    // 细碎点
    for (let i = 0; i < 160; i++) {
      const x = (hash2(i, 9, 3) * S) | 0, y = (hash2(i, 8, 3) * S) | 0;
      const k = hash2(i, 7, 3);
      g.fillStyle = k < 0.45 ? th.dark : k < 0.85 ? th.light : th.accent;
      g.fillRect(x, y, 1, k > 0.92 ? 2 : 1);
    }
    return c;
  }

  worldToScreen(x: number, y: number): [number, number] {
    return [(x - this.camX) * this.scale, (y - this.camY) * this.scale];
  }

  render(b: Battle, dt: number, out: CanvasRenderingContext2D) {
    // 直接在屏幕画布上按世界坐标绘制（整体缩放 scale 倍），精灵使用预先放大的版本 1:1 贴图
    out.save();
    out.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.ctx = out;
    const g = this.ctx;
    const p = b.player;
    let cx = Math.round(p.x - this.w / 2), cy = Math.round(p.y - 8 - this.h / 2);
    if (this.shake > 0) {
      cx += Math.round((Math.random() - 0.5) * this.shake * 2);
      cy += Math.round((Math.random() - 0.5) * this.shake * 2);
      this.shake = Math.max(0, this.shake - dt * 20);
    }
    this.camX = cx;
    this.camY = cy;
    g.imageSmoothingEnabled = false;

    // 地面 + 矮装饰：按 192×192 的地图块预先画好缓存，每帧只贴十几块（原来每帧要贴一百多次）
    for (let ky = Math.floor(cy / CHUNK); ky <= Math.floor((cy + this.h) / CHUNK); ky++)
      for (let kx = Math.floor(cx / CHUNK); kx <= Math.floor((cx + this.w) / CHUNK); kx++) {
        const c = this.chunk(kx, ky);
        g.drawImage(c, 0, 0, c.width, c.height, kx * CHUNK - cx, ky * CHUNK - cy, CHUNK, CHUNK);
      }

    this.list.length = 0;
    let pooled = 0;
    // 装饰
    const c0x = Math.floor((cx - 20) / CELL), c1x = Math.floor((cx + this.w + 20) / CELL);
    const c0y = Math.floor((cy - 10) / CELL), c1y = Math.floor((cy + this.h + 50) / CELL);
    const decor = this.theme.decor;
    for (let gy = c0y; gy <= c1y; gy++)
      for (let gx = c0x; gx <= c1x; gx++) {
        const h = hash2(gx, gy, 11);
        if (h > 0.42) continue;
        // 出生点附近留空
        if (Math.abs(gx) <= 1 && Math.abs(gy) <= 1) continue;
        const r = hash2(gx, gy, 23);
        let acc = 0, total = 0;
        for (const d of decor) total += d[1];
        let name = decor[0][0];
        for (const d of decor) { acc += d[1] / total; if (r <= acc) { name = d[0]; break; } }
        // 矮装饰已经画进地图块，这里只处理需要和人物前后遮挡的高装饰
        if (!TALL.has(name)) continue;
        const wx = gx * CELL + hash2(gx, gy, 31) * (CELL - 8), wy = gy * CELL + hash2(gx, gy, 41) * (CELL - 8);
        const s = sprite(`env_${this.themeName}_${name}`);
        this.list.push({ y: wy, draw: () => this.blit(s, wx, wy) });
      }

    // 火海 / 铁蒺藜
    let flames = 0;
    for (const f of b.pools) {
      const a = Math.min(1, f.life / 0.4, (f.maxLife - f.life) / 0.15 + 0.3);
      if (f.kind === 'caltrop') {
        g.globalAlpha = 0.22 * a;
        g.fillStyle = '#5a6988';
        this.ellipse(f.x, f.y, f.r, f.r * 0.7);
        g.globalAlpha = a;
        const n = Math.max(5, Math.round(f.r / 2.5));
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU + hash2(i, 3, f.x | 0);
          const rr = f.r * (0.15 + 0.8 * hash2(i, 5, f.y | 0));
          const sx = Math.round(f.x + Math.cos(ang) * rr - this.camX), sy = Math.round(f.y + Math.sin(ang) * rr * 0.7 - this.camY);
          g.fillStyle = '#181425';
          g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3);
          g.fillStyle = '#c0cbdc';
          g.fillRect(sx, sy, 1, 1);
        }
        g.globalAlpha = 1;
        continue;
      }
      g.globalAlpha = 0.35 * a;
      g.fillStyle = '#f77622';
      this.ellipse(f.x, f.y, f.r, f.r * 0.7);
      g.globalAlpha = a;
      // 火苗：每片火海少画一些，全屏最多 40 个（火海一多，贴图调用能占到一半）
      const n = Math.min(Math.max(3, Math.round(f.r / 7)), 40 - flames);
      flames += Math.max(0, n);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + hash2(i, 3, f.x | 0);
        const rr = f.r * (0.25 + 0.7 * hash2(i, 5, f.y | 0));
        const fx = f.x + Math.cos(ang) * rr, fy = f.y + Math.sin(ang) * rr * 0.7;
        const frame = (Math.floor(b.t * 10 + i) % 3);
        this.list.push({ y: fy, draw: () => { g.globalAlpha = a; this.blit(sprite('flame' + frame), fx, fy); g.globalAlpha = 1; } });
      }
      g.globalAlpha = 1;
    }

    // 八阵图：八块阵石环绕
    if (b.hasStrat('bazhen')) {
      const R = b.bazhenR;
      g.globalAlpha = 0.12;
      g.fillStyle = '#c0cbdc';
      this.ellipse(p.x, p.y - 4, R, R * 0.8);
      g.globalAlpha = 0.6;
      g.strokeStyle = '#8b9bb4';
      g.lineWidth = 1;
      this.ellipse(p.x, p.y - 4, R, R * 0.8, true);
      g.globalAlpha = 1;
      for (let i = 0; i < 8; i++) {
        const a = b.t * 0.8 + (i / 8) * TAU;
        const sx = Math.round(p.x + Math.cos(a) * R - this.camX), sy = Math.round(p.y - 4 + Math.sin(a) * R * 0.8 - this.camY);
        g.fillStyle = '#181425';
        g.fillRect(sx - 3, sy - 4, 7, 6);
        g.fillStyle = '#8b9bb4';
        g.fillRect(sx - 2, sy - 3, 5, 4);
        g.fillStyle = '#c0cbdc';
        g.fillRect(sx - 2, sy - 3, 2, 1);
      }
    }

    // 枪风光环
    const aura = b.weapon('aura');
    if (aura) {
      const L = levelData(aura);
      const R = L.area * b.areaMul;
      g.globalAlpha = 0.18;
      g.fillStyle = aura.evo ? '#feae34' : '#2ce8f5';
      this.ellipse(p.x, p.y - 4, R, R * 0.8);
      g.globalAlpha = 0.7;
      g.fillStyle = aura.evo ? '#fee761' : '#ffffff';
      for (let i = 0; i < 18; i++) {
        const a = aura.angle * (i % 2 ? 1 : -1.3) + (i / 18) * TAU;
        const rr = R * (i % 2 ? 0.95 : 0.7);
        g.fillRect(Math.round(p.x + Math.cos(a) * rr - this.camX), Math.round(p.y - 4 + Math.sin(a) * rr * 0.8 - this.camY), 2, 1);
      }
      g.globalAlpha = 1;
    }

    // 首领预警
    for (const w of b.warnings) {
      const k = w.t / w.dur;
      g.globalAlpha = 0.25 + 0.25 * Math.sin(w.t * 20);
      g.fillStyle = '#e43b44';
      if (w.kind === 'circle') {
        this.ellipse(w.x, w.y, w.r, w.r * 0.8);
        g.globalAlpha = 0.6;
        this.ellipse(w.x, w.y, w.r * k, w.r * 0.8 * k);
      } else if (w.kind === 'fan') {
        g.save();
        g.translate(Math.round(w.x - this.camX), Math.round(w.y - this.camY));
        g.scale(1, 0.85);
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w.len, w.a - w.r, w.a + w.r); g.closePath(); g.fill();
        g.globalAlpha = 0.6;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w.len * k, w.a - w.r, w.a + w.r); g.closePath(); g.fill();
        g.restore();
      } else {
        g.save();
        g.translate(Math.round(w.x - this.camX), Math.round(w.y - this.camY));
        g.rotate(w.a);
        g.fillRect(0, -w.r / 2, w.len, w.r);
        g.globalAlpha = 0.6;
        g.fillRect(0, -w.r / 2, w.len * k, w.r);
        g.restore();
      }
      g.globalAlpha = 1;
    }

    // 拾取物
    for (const k of b.pickups) {
      const bob = Math.sin(k.t * 5 + k.x) * 1.5;
      let s: Sprite;
      switch (k.kind) {
        case 'gem': s = sprite(k.value >= 20 ? 'gem2' : k.value >= 5 ? 'gem1' : 'gem0'); break;
        case 'coin': s = sprite('coin' + (Math.floor(k.t * 8 + k.x) % 4)); break;
        case 'chest': s = sprite(k.boss ? 'chest_gold' : 'chest'); break;
        default: s = sprite(k.kind);
      }
      if (k.kind !== 'gem' && k.kind !== 'coin') {
        this.blit(sprite('shadow_s'), k.x, k.y + 4);
        // 道具发光提示
        g.globalAlpha = 0.3 + 0.2 * Math.sin(k.t * 6);
        g.fillStyle = k.kind === 'chest' ? '#fee761' : '#ffffff';
        this.ellipse(k.x, k.y, 9, 6);
        g.globalAlpha = 1;
      }
      this.blit(s, k.x, k.y + bob - 2);
    }

    // 可破坏物
    for (const br of b.breakables) {
      const s = br.kind === 'lantern' ? sprite('lantern' + (Math.floor(b.t * 2 + br.x) % 2)) : sprite('cart');
      this.list.push({ y: br.y, draw: () => { this.blit(sprite('shadow_m'), br.x, br.y); this.blit(s, br.x, br.y); } });
    }

    // 敌人
    for (const e of b.enemies) {
      if (e.dead) continue;
      if (e.x < cx - 40 || e.x > cx + this.w + 40 || e.y < cy - 20 || e.y > cy + this.h + 70) continue;
      let d = this.enemyPool[pooled];
      if (!d) d = this.enemyPool[pooled] = { y: 0, e: null };
      pooled++;
      d.y = e.y; d.e = e;
      this.list.push(d);
    }

    // 玩家
    this.list.push({ y: p.y, draw: () => this.drawPlayer(b) });

    // 白马义从
    for (const pr of b.projs) {
      if (pr.kind !== 'horse') continue;
      this.list.push({
        y: pr.y,
        draw: () => {
          const f = Math.floor(b.t * 12 + pr.x * 0.01) % 4;
          g.globalAlpha = 0.85;
          this.blit(sprite(`u_baima_${f}${pr.left ? '_L' : ''}`), pr.x, pr.y + 8);
          g.globalAlpha = 1;
        },
      });
    }

    // 同屏敌人很多时不画脚下影子（挤成一团时看不出来，能少一半贴图调用）
    this.crowded = pooled > 120;
    this.list.sort((a, c) => a.y - c.y);
    for (const d of this.list) { if (d.e) this.drawEnemy(d.e, b); else d.draw!(); }

    // 投射物
    for (const pr of b.projs) {
      if (pr.kind === 'bolt') {
        // 拖尾：一道亮线，箭射出去看得清
        const sp = Math.hypot(pr.vx, pr.vy) || 1, tl = Math.min(26, 0.07 * sp) * (pr.scale > 1 ? 1.2 : 1);
        g.globalAlpha = 0.55;
        g.strokeStyle = pr.sprite === 'bolt_evo' ? '#feae34' : '#fff4c0';
        g.lineWidth = pr.scale >= 2 ? 2 : 1.5;
        g.beginPath(); g.moveTo(pr.x - this.camX, pr.y - this.camY); g.lineTo(pr.x - (pr.vx / sp) * tl - this.camX, pr.y - (pr.vy / sp) * tl - this.camY); g.stroke();
        g.globalAlpha = 1;
        this.blitRot(sprite(pr.sprite), pr.x, pr.y, pr.rot, pr.scale);
      }
      else if (pr.kind === 'knife') this.blitRot(sprite('icon_w_knife'), pr.x, pr.y, pr.rot);
      else if (pr.kind === 'rock') {
        if (pr.scale === 0) continue;
        const k = Math.min(1, pr.t / pr.dur);
        g.globalAlpha = 0.25 + 0.35 * k;
        g.fillStyle = '#181425';
        this.ellipse(pr.tx, pr.ty, pr.area * (0.4 + 0.6 * k), pr.area * 0.5 * (0.4 + 0.6 * k));
        g.globalAlpha = 1;
        this.blitScaled(sprite('stone'), pr.tx, pr.ty - (1 - k) * (1 - k) * 140, pr.scale);
      } else if (pr.kind === 'boulder') {
        const k = Math.min(1, pr.t / pr.dur);
        g.globalAlpha = 0.2 + 0.3 * k;
        g.fillStyle = '#181425';
        this.ellipse(pr.tx, pr.ty, pr.area * 0.8, pr.area * 0.4);
        g.globalAlpha = 1;
        this.blitScaled(sprite('stone'), pr.x, pr.y - Math.sin(k * Math.PI) * 60, pr.scale);
      }
      else if (pr.kind === 'pot') {
        const k = pr.t / pr.dur;
        this.blitRot(sprite('pot'), pr.x, pr.y - Math.sin(k * Math.PI) * 26, pr.rot);
      }
    }
    // 青釭剑
    const sw = b.weapon('sword');
    if (sw && sw.active > 0) {
      const L = levelData(sw);
      const R = L.area * b.areaMul;
      for (let i = 0; i < L.count; i++) {
        const a = sw.angle + (i * TAU) / L.count;
        const sx = p.x + Math.cos(a) * R, sy = p.y - 8 + Math.sin(a) * R * 0.85;
        g.globalAlpha = 0.35;
        const ta = a - 0.25;
        this.blitRot(sprite('fsword'), p.x + Math.cos(ta) * R, p.y - 8 + Math.sin(ta) * R * 0.85, ta + Math.PI / 2);
        g.globalAlpha = 1;
        this.blitRot(sprite('fsword'), sx, sy, a + Math.PI / 2);
      }
    }
    // 风刃与火焰龙卷
    for (const pr of b.projs) {
      if (pr.kind === 'wind') this.drawWind(pr.x, pr.y, pr.rot);
      else if (pr.kind === 'tornado') this.drawTornado(pr.x, pr.y, pr.r, pr.rot, Math.min(1, pr.life / 0.5));
    }
    // 方天画戟旋风
    const hb = b.weapon('halberd');
    if (hb && hb.active > 0) this.drawWhirl(p.x, p.y - 6, levelData(hb).area * b.areaMul, hb.angle, hb.evo ? '#feae34' : '#e43b44');
    // 大招：天下无双 / 青龙出水
    if (b.ult && b.ult.kind === 'whirl') this.drawWhirl(p.x, p.y - 6, 62, b.t * 40, '#ff2a3a', true);
    if (b.ult && b.ult.kind === 'crescent') {
      for (const ring of b.ult.rings) {
        const R = Math.hypot(this.w, this.h) * 0.55;
        if (ring.r > R) continue;
        g.globalAlpha = 0.85 * (1 - ring.r / R);
        g.strokeStyle = '#63c74d';
        g.lineWidth = 10;
        this.ellipse(p.x, p.y - 6, ring.r, ring.r * 0.85, true);
        g.strokeStyle = '#e8ffd8';
        g.lineWidth = 3;
        this.ellipse(p.x, p.y - 6, ring.r, ring.r * 0.85, true);
        g.globalAlpha = 1;
      }
    }
    // 白马义从（专属）：金色光尘
    for (const pr of b.projs) {
      if (pr.kind !== 'horse' || !b.weapon('horse')?.link) continue;
      g.globalAlpha = 0.5;
      g.fillStyle = '#fee761';
      for (let i = 0; i < 3; i++) g.fillRect(Math.round(pr.x - Math.sign(pr.vx) * (6 + i * 5) - this.camX), Math.round(pr.y - 4 + ((i * 7) % 5) - this.camY), 2, 1);
      g.globalAlpha = 1;
    }
    // 敌方投射物
    for (const s of b.shots) this.blitRot(sprite(s.sprite), s.x, s.y, s.rot);

    // 大招时整体压暗，突出白龙
    if (b.ult) {
      g.fillStyle = 'rgba(10,6,20,0.45)';
      g.fillRect(0, 0, this.w, this.h);
      this.drawPlayer(b);
    }
    // 特效
    for (const f of b.fx) this.drawFx(f, b);

    out.restore();
  }

  private drawEnemy(e: Enemy, b: Battle) {
    const g = this.ctx;
    const frame = Math.floor(e.anim) % 4;
    const windup = e.touching && e.atkCd > 0 && e.atkCd < 0.16 && !e.boss;
    const name = this.enemyName(e.sprite, frame, e.left, e.flash > 0 || (windup && Math.floor(b.t * 30) % 2 === 0));
    const s = sprite(name);
    const sc = e.scale;
    if (!this.crowded || e.boss || e.elite) this.blitScaled(sprite(sc > 1 || e.boss ? 'shadow_l' : e.r > 8 ? 'shadow_m' : 'shadow_s'), e.x, e.y + 1, sc > 1 && !e.boss ? 1 : sc > 1 ? 2 : 1);
    if (e.elite || e.boss) {
      g.globalAlpha = (e.enraged ? 0.45 : 0.25) + 0.15 * Math.sin(b.t * (e.enraged ? 14 : 6));
      g.fillStyle = e.boss ? '#e43b44' : '#feae34';
      this.ellipse(e.x, e.y, e.r * (e.enraged ? 1.7 : 1.3), e.r * (e.enraged ? 0.8 : 0.6));
      g.globalAlpha = 1;
    }
    if (e.slow > 0) g.globalAlpha = 0.85;
    this.blitScaled(s, e.x, e.y, sc);
    g.globalAlpha = 1;
    if (e.shield > 0) {
      // 护盾：罩住敌将的青色光圈
      g.strokeStyle = '#2ce8f5';
      g.lineWidth = 2;
      g.globalAlpha = 0.5 + 0.3 * Math.sin(b.t * 8);
      this.ellipse(e.x, e.y - s.h * sc * 0.45, s.w * sc * 0.65, s.h * sc * 0.6, true);
      g.globalAlpha = 1;
    }
    if (e.slow >= 1) {
      // 眩晕：头顶转圈的星星
      const hy = e.y - s.h * sc - 1;
      for (let i = 0; i < 2; i++) {
        const a = b.t * 8 + i * Math.PI;
        g.fillStyle = '#fee761';
        g.fillRect(Math.round(e.x + Math.cos(a) * 4 - this.camX), Math.round(hy + Math.sin(a) * 1.5 - this.camY), 2, 2);
      }
    }
    // 精英血条
    if (e.elite && e.hp < e.maxHp) {
      const w = 20;
      const x = Math.round(e.x - w / 2 - this.camX), y = Math.round(e.y - s.h * sc - 2 - this.camY);
      g.fillStyle = '#181425';
      g.fillRect(x - 1, y - 1, w + 2, 4);
      g.fillStyle = '#e43b44';
      g.fillRect(x, y, Math.round(w * (e.hp / e.maxHp)), 2);
    }
  }

  private drawPlayer(b: Battle) {
    const p = b.player;
    const g = this.ctx;
    const frame = p.moving ? Math.floor(p.anim) % 4 : 0;
    const flash = p.hurtFlash > 0 && Math.floor(p.hurtFlash * 30) % 2 === 0;
    this.blit(sprite('shadow_l'), p.x, p.y + 1);
    if (p.iframe > 0.5) g.globalAlpha = 0.5 + 0.5 * Math.sin(b.t * 30);
    this.blit(sprite(`${b.heroSprite}_${frame}${p.left ? '_L' : ''}${flash ? (p.left ? 'W' : '_W') : ''}`), p.x, p.y);
    g.globalAlpha = 1;
    // 血条
    const w = 22;
    const x = Math.round(p.x - w / 2 - this.camX), y = Math.round(p.y + 4 - this.camY);
    g.fillStyle = '#181425';
    g.fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle = '#3a4466';
    g.fillRect(x, y, w, 2);
    const ratio = Math.max(0, p.hp / p.maxHp);
    g.fillStyle = ratio < 0.3 ? '#e43b44' : '#63c74d';
    g.fillRect(x, y, Math.round(w * ratio), 2);
  }

  private drawFx(f: Battle['fx'][number], b: Battle) {
    const g = this.ctx;
    const k = f.t / f.dur;
    switch (f.kind) {
      case 'thrust': {
        g.save();
        g.translate(Math.round(f.x - this.camX), Math.round(f.y - this.camY));
        g.rotate(f.a!);
        const ext = Math.min(1, k * 4);
        const len = f.len! * ext;
        const w = f.w! * (1 - k * 0.7);
        const gold = f.color === '#fee761';
        // 外层气浪
        g.globalAlpha = (1 - k) * 0.45;
        g.fillStyle = gold ? '#f77622' : '#0099db';
        g.beginPath();
        g.moveTo(0, -w * 0.8);
        g.lineTo(len + 4, -2);
        g.lineTo(len + 12, 0);
        g.lineTo(len + 4, 2);
        g.lineTo(0, w * 0.8);
        g.closePath();
        g.fill();
        // 枪芒
        g.globalAlpha = 1 - k;
        g.fillStyle = gold ? '#feae34' : '#8be9ff';
        g.beginPath();
        g.moveTo(4, -w / 2);
        g.lineTo(len, -1.5);
        g.lineTo(len + 8, 0);
        g.lineTo(len, 1.5);
        g.lineTo(4, w / 2);
        g.closePath();
        g.fill();
        g.fillStyle = f.color || '#ffffff';
        g.fillRect(4, -1.5, len, 3);
        g.fillRect(len - 3, -3, 9, 6);
        // 枪尖冲击环
        if (k < 0.5) {
          g.strokeStyle = '#ffffff';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(len + 4, 0, 3 + k * 16, -1.2, 1.2);
          g.stroke();
        }
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'spark':
        this.blit(sprite('spark' + Math.min(2, Math.floor(k * 3))), f.x, f.y);
        break;
      case 'slash': {
        // 刀光：沿弧线展开的月牙
        const R = f.r!;
        const arc = Math.min(Math.PI, f.w!);
        const sweepK = Math.min(1, k * 3);
        const a0 = f.a! - arc, a1 = f.a! - arc + arc * 2 * sweepK;
        g.save();
        g.translate(Math.round(f.x - this.camX), Math.round(f.y - this.camY));
        g.scale(1, 0.85);
        g.globalAlpha = (1 - k) * 0.55;
        g.fillStyle = f.color || '#ffffff';
        g.beginPath(); g.arc(0, 0, R, a0, a1); g.arc(0, 0, R * 0.55, a1, a0, true); g.closePath(); g.fill();
        g.globalAlpha = 1 - k;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(0, 0, R, a0, a1); g.arc(0, 0, R * 0.86, a1, a0, true); g.closePath(); g.fill();
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'corpse': {
        // 被击飞：抛物线 + 旋转 + 闪白后淡出
        const t = f.t;
        const x = f.x + f.vx! * t;
        const y = f.y + f.vy! * t + 420 * t * t;
        const s = sprite(f.sprite! + (t < 0.08 ? (f.sprite!.endsWith('_L') ? 'W' : '_W') : ''));
        g.globalAlpha = Math.min(1, (1 - k) * 2);
        g.save();
        g.translate(Math.round(x - this.camX), Math.round(y - this.camY - s.h * (f.scale || 1) / 2));
        g.rotate(f.rot! * t);
        const sc = f.scale || 1;
        const ss = scaled(s, sc * this.scale);
        g.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, -s.w * sc / 2, -s.h * sc / 2, s.w * sc, s.h * sc);
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'ghost': {
        // 大招残影
        g.globalAlpha = 0.55 * (1 - k);
        this.blit(sprite(f.sprite! + (f.sprite!.endsWith('_L') ? 'W' : '_W')), f.x, f.y);
        g.globalAlpha = 1;
        break;
      }
      case 'beam': {
        // 白龙冲杀轨迹
        g.save();
        g.translate(Math.round(f.x - this.camX), Math.round(f.y - this.camY));
        g.rotate(f.a!);
        const w = f.w! * (1 - k * 0.6);
        g.globalAlpha = 0.5 * (1 - k);
        g.fillStyle = '#feae34';
        g.fillRect(0, -w / 2, f.len!, w);
        g.globalAlpha = 0.9 * (1 - k);
        g.fillStyle = '#ffffff';
        g.fillRect(0, -w / 5, f.len!, (w * 2) / 5);
        // 龙鳞纹
        g.fillStyle = '#fee761';
        for (let i = 0; i < f.len!; i += 8) g.fillRect(i, Math.sin(i * 0.4 + f.t * 30) * w * 0.35 - 1, 4, 2);
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'blade': {
        // 敌将的十字刀气：红白长条，迅速变细消失
        g.save();
        g.translate(Math.round(f.x - this.camX), Math.round(f.y - this.camY));
        g.rotate(f.a!);
        const w = f.w! * (1 - k * 0.7);
        g.globalAlpha = 0.6 * (1 - k);
        g.fillStyle = '#e43b44';
        g.fillRect(0, -w / 2, f.len!, w);
        g.globalAlpha = 1 - k;
        g.fillStyle = '#ffffff';
        g.fillRect(0, -w / 6, f.len!, w / 3);
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'lightning': {
        const pts = f.pts!;
        g.save();
        g.translate(-this.camX, -this.camY);
        for (const [col, lw, al] of [[f.color || '#8be9ff', 7, 0.35], [f.color || '#8be9ff', 3.5, 0.8], ['#ffffff', 1.8, 1]] as [string, number, number][]) {
          g.globalAlpha = al * (1 - k);
          g.strokeStyle = col;
          g.lineWidth = lw;
          g.beginPath();
          g.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) {
            const mx = (pts[i - 2] + pts[i]) / 2 + hash2(i, Math.floor(f.t * 40), 7) * 10 - 5;
            const my = (pts[i - 1] + pts[i + 1]) / 2 + hash2(i, Math.floor(f.t * 40), 9) * 10 - 5;
            g.lineTo(mx, my);
            g.lineTo(pts[i], pts[i + 1]);
          }
          g.stroke();
        }
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'drum': {
        // 鼓声冲击波：实心淡环 + 亮边
        const r = f.r! * (0.2 + 0.8 * Math.min(1, k * 1.6));
        g.globalAlpha = 0.18 * (1 - k);
        g.fillStyle = f.color || '#feae34';
        this.ellipse(f.x, f.y, r, r * 0.8);
        g.globalAlpha = 0.9 * (1 - k);
        g.strokeStyle = f.color || '#feae34';
        g.lineWidth = 3;
        this.ellipse(f.x, f.y, r, r * 0.8, true);
        g.strokeStyle = '#ffffff';
        g.lineWidth = 1;
        this.ellipse(f.x, f.y, r * 0.92, r * 0.92 * 0.8, true);
        g.globalAlpha = 1;
        break;
      }
      case 'volley': {
        // 万箭齐发：箭矢从右上方斜落
        if (f.t < 0) break;
        const q = Math.min(1, k);
        const ax = Math.round(f.x + 36 * (1 - q) - this.camX), ay = Math.round(f.y - 120 * (1 - q) - this.camY);
        g.globalAlpha = q < 0.9 ? 1 : (1 - q) * 10;
        g.strokeStyle = '#733e39';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 9, ay - 30); g.stroke();
        g.fillStyle = '#ffffff';
        g.fillRect(ax - 1, ay - 1, 3, 3);
        g.fillStyle = '#c0cbdc';
        g.fillRect(ax + 7, ay - 31, 3, 4);
        g.globalAlpha = 1;
        break;
      }
      case 'puff':
        this.blitScaled(sprite('puff' + Math.min(3, Math.floor(k * 4))), f.x, f.y + 6, f.big ? 2 : 1);
        break;
      case 'explo':
        this.blit(sprite('explo' + Math.min(4, Math.floor(k * 5))), f.x, f.y + 20);
        break;
      case 'ring': {
        g.globalAlpha = 1 - k;
        g.strokeStyle = f.color || '#ffffff';
        g.lineWidth = 2;
        const r = f.r! * (0.3 + 0.7 * k);
        this.ellipse(f.x, f.y, r, r * 0.8, true);
        g.globalAlpha = 1;
        break;
      }
      case 'num': {
        const col = f.color || 'w';
        const str = f.text!;
        const sc = f.big ? 2 : 1;
        const cw = 4 * sc;
        let x = Math.round(f.x - (str.length * cw) / 2 - this.camX);
        const y = Math.round(f.y - this.camY - k * 10 - (k < 0.2 ? (0.2 - k) * 10 : 0));
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        for (const ch of str) {
          const s = sprite(`d_${col}_${ch}`);
          const ss = scaled(s, sc * this.scale);
          g.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, x, y, s.w * sc, s.h * sc);
          x += cw;
        }
        g.globalAlpha = 1;
        break;
      }
    }
    void b;
  }

  private drawWind(x: number, y: number, a: number) {
    const g = this.ctx;
    g.save();
    g.translate(Math.round(x - this.camX), Math.round(y - this.camY));
    g.rotate(a);
    g.fillStyle = 'rgba(44,232,245,0.5)';
    g.beginPath(); g.arc(0, 0, 6, -1.2, 1.2); g.arc(-3, 0, 5, 1.1, -1.1, true); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0, 0, 5, -1.0, 1.0); g.arc(-2, 0, 4.5, 0.9, -0.9, true); g.fill();
    g.restore();
  }

  private drawTornado(x: number, y: number, r: number, rot: number, alpha: number) {
    const g = this.ctx;
    const cols = ['#e43b44', '#f77622', '#feae34', '#fee761'];
    g.globalAlpha = 0.25 * alpha;
    g.fillStyle = '#f77622';
    this.ellipse(x, y, r, r * 0.45);
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const rr = r * (0.35 + 0.65 * k);
      const ox = Math.sin(rot + i * 0.9) * 3 * k;
      g.globalAlpha = 0.75 * alpha;
      g.strokeStyle = cols[i % 4];
      g.lineWidth = 2;
      this.ellipse(x + ox, y - i * 6, rr, rr * 0.3, true);
    }
    g.globalAlpha = 1;
  }

  private drawWhirl(x: number, y: number, R: number, angle: number, color: string, big = false) {
    const g = this.ctx;
    g.globalAlpha = big ? 0.35 : 0.22;
    g.fillStyle = color;
    this.ellipse(x, y, R, R * 0.8);
    g.globalAlpha = 0.9;
    g.strokeStyle = color;
    g.lineWidth = big ? 3 : 2;
    for (let i = 0; i < (big ? 3 : 2); i++) {
      const a0 = angle + (i * TAU) / (big ? 3 : 2);
      g.beginPath();
      for (let s = 0; s <= 10; s++) {
        const a = a0 - s * 0.12;
        const px = Math.round(x + Math.cos(a) * R - this.camX), py = Math.round(y + Math.sin(a) * R * 0.8 - this.camY);
        if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
      // 戟头
      this.blitRot(sprite('icon_w_halberd'), x + Math.cos(a0) * R * 0.85, y + Math.sin(a0) * R * 0.68, a0 + Math.PI / 4);
    }
    g.globalAlpha = 1;
  }

  // —— 基础绘制 ——
  blit(s: Sprite, x: number, y: number) {
    const ss = scaled(s, this.scale);
    this.ctx.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, Math.round(x - s.ax - this.camX), Math.round(y - s.ay - this.camY), s.w, s.h);
  }

  blitScaled(s: Sprite, x: number, y: number, sc: number) {
    if (sc === 1) return this.blit(s, x, y);
    const ss = scaled(s, sc * this.scale);
    this.ctx.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, Math.round(x - s.ax * sc - this.camX), Math.round(y - s.ay * sc - this.camY), s.w * sc, s.h * sc);
  }

  blitRot(s: Sprite, x: number, y: number, a: number, sc = 1) {
    const g = this.ctx;
    g.save();
    g.translate(Math.round(x - this.camX), Math.round(y - this.camY));
    g.rotate(a);
    const ss = scaled(s, sc * this.scale);
    g.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, -s.w * sc / 2, -s.h * sc / 2, s.w * sc, s.h * sc);
    g.restore();
  }

  /** 用缩放 + arc 画椭圆，兼容不支持 ellipse() 的小游戏 Canvas */
  ellipse(x: number, y: number, rx: number, ry: number, stroke = false) {
    const g = this.ctx;
    rx = Math.max(0.5, rx);
    ry = Math.max(0.5, ry);
    g.save();
    g.translate(Math.round(x - this.camX), Math.round(y - this.camY));
    g.scale(1, ry / rx);
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.restore();
    if (stroke) g.stroke(); else g.fill();
  }
}

