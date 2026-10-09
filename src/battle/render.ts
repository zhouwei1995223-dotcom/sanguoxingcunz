import { getPlatform } from '../platform';
import { sprite, Sprite } from '../gfx/atlas';
import { THEMES, GroundTheme } from '../gfx/art/env';
import { hash2, TAU } from '../core/math';
import type { Battle } from './battle';
import type { Enemy } from './entities';
import { levelData } from './weapons';

// 世界渲染：先在低分辨率画布上按 1:1 像素绘制，再整数倍放大到屏幕，保证像素风清晰

const TALL = new Set(['tree', 'pine', 'deadTree', 'banner', 'bigRock']);
const CELL = 36;

interface Drawable {
  y: number;
  draw: () => void;
}

export class WorldRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
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

  constructor(screenW: number, screenH: number, themeName: string) {
    this.scale = Math.max(2, Math.round(screenW / 280));
    this.w = Math.ceil(screenW / this.scale);
    this.h = Math.ceil(screenH / this.scale);
    this.canvas = getPlatform().createCanvas(this.w, this.h);
    this.ctx = this.canvas.getContext('2d')!;
    this.themeName = themeName;
    this.theme = THEMES[themeName];
    this.tile = this.buildTile();
  }

  private buildTile(): HTMLCanvasElement {
    const S = 96;
    const c = getPlatform().createCanvas(S, S);
    const g = c.getContext('2d')!;
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

    // 地面
    const T = 96;
    const ox = -(((cx % T) + T) % T), oy = -(((cy % T) + T) % T);
    for (let y = oy; y < this.h; y += T) for (let x = ox; x < this.w; x += T) g.drawImage(this.tile, x, y);

    this.list.length = 0;
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
        const wx = gx * CELL + hash2(gx, gy, 31) * (CELL - 8), wy = gy * CELL + hash2(gx, gy, 41) * (CELL - 8);
        const s = sprite(`env_${this.themeName}_${name}`);
        if (TALL.has(name)) this.list.push({ y: wy, draw: () => this.blit(s, wx, wy) });
        else this.blit(s, wx, wy);
      }

    // 火海
    for (const f of b.pools) {
      const a = Math.min(1, f.life / 0.4, (f.maxLife - f.life) / 0.15 + 0.3);
      g.globalAlpha = 0.35 * a;
      g.fillStyle = '#f77622';
      this.ellipse(f.x, f.y, f.r, f.r * 0.7);
      g.globalAlpha = a;
      const n = Math.max(4, Math.round(f.r / 4));
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + hash2(i, 3, f.x | 0);
        const rr = f.r * (0.25 + 0.7 * hash2(i, 5, f.y | 0));
        const fx = f.x + Math.cos(ang) * rr, fy = f.y + Math.sin(ang) * rr * 0.7;
        const frame = (Math.floor(b.t * 10 + i) % 3);
        this.list.push({ y: fy, draw: () => { g.globalAlpha = a; this.blit(sprite('flame' + frame), fx, fy); g.globalAlpha = 1; } });
      }
      g.globalAlpha = 1;
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
      this.list.push({ y: e.y, draw: () => this.drawEnemy(e, b) });
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

    this.list.sort((a, c) => a.y - c.y);
    for (const d of this.list) d.draw();

    // 投射物
    for (const pr of b.projs) {
      if (pr.kind === 'bolt') this.blitRot(sprite(pr.sprite), pr.x, pr.y, pr.rot);
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

    out.imageSmoothingEnabled = false;
    out.drawImage(this.canvas, 0, 0, this.w, this.h, 0, 0, this.w * this.scale, this.h * this.scale);
  }

  private drawEnemy(e: Enemy, b: Battle) {
    const g = this.ctx;
    const frame = Math.floor(e.anim) % 4;
    const name = `${e.sprite}_${frame}${e.left ? '_L' : ''}${e.flash > 0 ? (e.left ? 'W' : '_W') : ''}`;
    const s = sprite(name);
    const sc = e.scale;
    this.blitScaled(sprite(sc > 1 || e.boss ? 'shadow_l' : e.r > 8 ? 'shadow_m' : 'shadow_s'), e.x, e.y + 1, sc > 1 && !e.boss ? 1 : sc > 1 ? 2 : 1);
    if (e.elite || e.boss) {
      g.globalAlpha = 0.25 + 0.15 * Math.sin(b.t * 6);
      g.fillStyle = e.boss ? '#e43b44' : '#feae34';
      this.ellipse(e.x, e.y, e.r * 1.3, e.r * 0.6);
      g.globalAlpha = 1;
    }
    if (e.slow > 0) g.globalAlpha = 0.85;
    this.blitScaled(s, e.x, e.y, sc);
    g.globalAlpha = 1;
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
        g.drawImage(s.canvas, s.x, s.y, s.w, s.h, -s.w * sc / 2, -s.h * sc / 2, s.w * sc, s.h * sc);
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
          g.drawImage(s.canvas, s.x, s.y, s.w, s.h, x, y, s.w * sc, s.h * sc);
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
    this.ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(x - s.ax - this.camX), Math.round(y - s.ay - this.camY), s.w, s.h);
  }

  blitScaled(s: Sprite, x: number, y: number, sc: number) {
    if (sc === 1) return this.blit(s, x, y);
    this.ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(x - s.ax * sc - this.camX), Math.round(y - s.ay * sc - this.camY), s.w * sc, s.h * sc);
  }

  blitRot(s: Sprite, x: number, y: number, a: number) {
    const g = this.ctx;
    g.save();
    g.translate(Math.round(x - this.camX), Math.round(y - this.camY));
    g.rotate(a);
    g.drawImage(s.canvas, s.x, s.y, s.w, s.h, -s.w / 2, -s.h / 2, s.w, s.h);
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

