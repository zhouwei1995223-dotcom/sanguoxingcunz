import { sprite, scaled, hasSprite } from '../gfx/atlas';
import type { Sprite } from '../gfx/atlas';
import { hash2 } from '../core/math';
import { save } from '../meta/save';
import { heroSpriteName } from '../meta/goals';
import { HEROES } from '../data/heroes';

// 主界面「营地」：和战斗一样的俯视像素视角，放大一档。
// 中间是帅帐和篝火，出战武将站在篝火旁待命，其他已解锁的武将在营地里闲逛；黄昏夜色 + 篝火暖光。
// 坐标：以篝火为原点的「营地像素」，画到屏幕上乘整数倍 S。

interface Walker {
  id: string;
  x: number; y: number;
  tx: number; ty: number;
  wait: number;
  left: boolean;
  anim: number;
  moving: boolean;
}

const TAU = Math.PI * 2;
/** 出战武将在篝火旁的位置 */
const HERO_POS: [number, number] = [-30, 24];

export class HomeCamp {
  private t = 0;
  private walkers: Walker[] = [];
  private roster = '';
  /** 出战武将在屏幕上的范围（点击进武将页） */
  heroBox: [number, number, number, number] = [0, 0, 0, 0];
  /** 闲逛武将在屏幕上的范围 */
  heroRects: { id: string; r: [number, number, number, number] }[] = [];

  /** 可以闲逛的区域：篝火周围的椭圆，避开篝火、帅帐和出战武将 */
  private randomSpot(): [number, number] {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * TAU, r = 0.35 + Math.random() * 0.65;
      const x = Math.cos(a) * 92 * r, y = 4 + Math.sin(a) * 38 * r;
      if (x * x + y * y < 22 * 22) continue; // 篝火
      if (y < -24 && Math.abs(x) < 40) continue; // 帅帐门口
      if ((x - HERO_POS[0]) ** 2 + (y - HERO_POS[1]) ** 2 < 24 * 24) continue;
      // 偶尔走到篝火边烤火
      if (Math.random() < 0.12) { const b = Math.PI + Math.random() * Math.PI; return [Math.cos(b) * 28, Math.sin(b) * 14]; }
      return [x, y];
    }
    return [40, 20];
  }

  private syncRoster() {
    // 已解锁的其他武将 + 三名巡营的士兵（武将少的时候营地也不冷清）
    const ids: string[] = HEROES.filter((h) => save.heroes[h.id]?.owned && h.id !== save.hero).map((h) => h.id as string).concat(['u_shu_spear', 'u_shu_archer', 'u_shu_shield']);
    const key = save.hero + '|' + ids.join(',');
    if (key === this.roster) return;
    this.roster = key;
    const old = new Map(this.walkers.map((w) => [w.id, w]));
    this.walkers = ids.map((id) => old.get(id) || (() => { const [x, y] = this.randomSpot(); return { id, x, y, tx: x, ty: y, wait: Math.random() * 3, left: Math.random() < 0.5, anim: Math.random() * 4, moving: false }; })());
  }

  private update(dt: number) {
    for (const w of this.walkers) {
      if (w.wait > 0) { w.wait -= dt; w.moving = false; continue; }
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (d < 1.5) {
        w.wait = 1.5 + Math.random() * 3.5;
        const [x, y] = this.randomSpot();
        w.tx = x; w.ty = y;
        w.moving = false;
        continue;
      }
      const sp = 16;
      w.x += (dx / d) * sp * dt; w.y += (dy / d) * sp * dt;
      if (Math.abs(dx) > 0.5) w.left = dx < 0;
      w.anim += dt * 6;
      w.moving = true;
    }
    // 武将之间稍微分开，别叠在一起
    for (let i = 0; i < this.walkers.length; i++) for (let j = i + 1; j < this.walkers.length; j++) {
      const a = this.walkers[i], b = this.walkers[j];
      const dx = a.x - b.x, dy = (a.y - b.y) * 2, d = Math.hypot(dx, dy);
      if (d < 16 && d > 0.01) { const k = (16 - d) / d * 0.5 * dt * 4; a.x += dx * k; a.y += dy * k * 0.5; b.x -= dx * k; b.y -= dy * k * 0.5; }
    }
  }

  /**
   * fireY：篝火在屏幕上的 y（设备像素）；S：放大倍数。整个屏幕都画成营地地面。
   */
  draw(g: CanvasRenderingContext2D, dt: number, W: number, H: number, fireY: number, S: number) {
    this.t += dt;
    this.syncRoster();
    this.update(dt);
    const t = this.t;
    const ox = W / 2, oy = fireY;
    const X = (x: number) => Math.round(ox + x * S), Y = (y: number) => Math.round(oy + y * S);
    const blit = (s: Sprite, x: number, y: number, flip = false) => {
      void flip;
      const ss = scaled(s, S);
      g.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, X(x) - s.ax * S, Y(y) - s.ay * S, s.w * S, s.h * S);
    };
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    // 地面：草地底色 + 按格子撒草丛小花
    g.fillStyle = '#3e5a2c';
    g.fillRect(0, 0, W, H);
    const cell = 18;
    const x0 = Math.floor(-ox / S / cell) - 1, x1 = Math.ceil((W - ox) / S / cell) + 1;
    const y0 = Math.floor(-oy / S / cell) - 1, y1 = Math.ceil((H - oy) / S / cell) + 1;
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const h = hash2(gx, gy, 3);
      const wx = gx * cell + hash2(gx, gy, 5) * cell, wy = gy * cell + hash2(gx, gy, 7) * cell;
      if (Math.abs(wx) < 100 && wy > -60 && wy < 50) continue; // 营地空地里不长草
      g.fillStyle = h > 0.5 ? '#4f7036' : '#2f4722';
      g.fillRect(X(wx), Y(wy), 3 * S, S);
      if (h < 0.18) { const nm = h < 0.06 ? 'env_changban_flowerR' : h < 0.12 ? 'env_changban_flowerY' : 'env_changban_grass'; if (hasSprite(nm)) blit(sprite(nm), wx, wy); }
    }
    // 营地空地：夯土地面（用缩放 + arc 画椭圆，兼容不支持 ellipse() 的小游戏画布）
    const ell = (cx: number, cy: number, rx: number, ry: number) => { g.save(); g.translate(cx, cy); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.restore(); g.fill(); };
    g.fillStyle = '#7a5a3c';
    ell(X(0), Y(-6), 104 * S, 50 * S);
    g.fillStyle = '#8a6a48';
    ell(X(0), Y(-6), 96 * S, 44 * S);
    for (let i = 0; i < 60; i++) {
      const a = hash2(i, 1, 9) * TAU, r = Math.sqrt(hash2(i, 2, 9));
      g.fillStyle = i % 2 ? '#7a5a3c' : '#9a7a54';
      g.fillRect(X(Math.cos(a) * 92 * r), Y(-6 + Math.sin(a) * 40 * r), 2 * S, S);
    }
    // 要排序绘制的物体
    const list: { y: number; draw: () => void }[] = [];
    // 后排栅栏
    for (let x = -110; x <= 110; x += 6) {
      const y = -66 + Math.round(Math.abs(x) * 0.12);
      list.push({ y, draw: () => blit(sprite('camp_stake'), x, y) });
    }
    // 帅帐 + 门口两名枪兵
    list.push({ y: -40, draw: () => blit(sprite('camp_tent'), 0, -40) });
    list.push({ y: -36, draw: () => blit(sprite('u_shu_spear_0'), -16, -36) });
    list.push({ y: -36, draw: () => blit(sprite('u_shu_spear_0_L'), 16, -36) });
    // 兵器架、粮草、旗子
    list.push({ y: -26, draw: () => blit(sprite('camp_rack'), -58, -26) });
    list.push({ y: -24, draw: () => blit(sprite('camp_supplies'), 58, -24) });
    for (const [fx, col] of [[-82, '#e43b44'], [82, '#3e8948']] as [number, string][]) {
      list.push({ y: -18, draw: () => {
        g.fillStyle = '#733e39'; g.fillRect(X(fx), Y(-44), S, 26 * S);
        const wave = Math.round(Math.sin(t * 3 + fx) * 1);
        g.fillStyle = col; g.fillRect(X(fx + 1), Y(-43 + wave * 0.3), 9 * S, 6 * S);
        g.fillStyle = '#fee761'; g.fillRect(X(fx + 4), Y(-41), 3 * S, 2 * S);
      } });
    }
    // 两支火把
    for (const tx of [-56, 56]) list.push({ y: 22, draw: () => { blit(sprite('camp_torch'), tx, 22); this.flame(g, X(tx), Y(-1), S * 0.6, t + tx); } });
    // 篝火：木柴 + 火焰
    list.push({ y: 1, draw: () => {
      g.fillStyle = '#3e2731'; g.fillRect(X(-8), Y(0), 16 * S, 2 * S);
      g.fillStyle = '#733e39'; g.fillRect(X(-7), Y(-2), 6 * S, 2 * S); g.fillRect(X(1), Y(-2), 6 * S, 2 * S); g.fillRect(X(-3), Y(-3), 6 * S, 2 * S);
      g.fillStyle = '#8b9bb4'; for (const [sx, sy] of [[-10, 0], [8, 0], [-6, 2], [4, 2]]) g.fillRect(X(sx), Y(sy), 2 * S, 2 * S);
      this.flame(g, X(0), Y(-2), S, t);
    } });
    // 出战武将：篝火旁待命（面朝篝火）
    const heroName = heroSpriteName(save.hero);
    const idle = heroName.endsWith('_awk');
    const hs = sprite(`${heroName}_${idle ? 4 + (Math.floor(t * 5) % 4) : 0}`);
    list.push({ y: HERO_POS[1], draw: () => {
      // 脚下金色光圈 + 头顶「出战」标签
      const pulse = 0.55 + 0.25 * Math.sin(t * 3);
      g.globalAlpha = pulse;
      g.strokeStyle = '#fee761'; g.lineWidth = S;
      g.save(); g.translate(X(HERO_POS[0]), Y(HERO_POS[1])); g.scale(1, 0.4); g.beginPath(); g.arc(0, 0, 15 * S, 0, TAU); g.restore(); g.stroke();
      g.globalAlpha = 1;
      blit(hs, HERO_POS[0], HERO_POS[1]);
      const ty = Y(HERO_POS[1] - hs.ay - 4 + Math.sin(t * 3) * 1.2);
      g.fillStyle = '#a22633'; g.fillRect(X(HERO_POS[0]) - 9 * S, ty - 5 * S, 18 * S, 7 * S);
      g.fillStyle = '#fee761'; g.fillRect(X(HERO_POS[0]) - 9 * S, ty + 2 * S, 18 * S, S);
      g.fillStyle = '#fff4d6'; g.font = `bold ${5 * S}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('出战', X(HERO_POS[0]), ty - 1.5 * S);
    } });
    this.heroBox = [X(HERO_POS[0]) - 16 * S, Y(HERO_POS[1]) - 34 * S, 32 * S, 36 * S];
    // 闲逛的武将
    this.heroRects = [];
    for (const w of this.walkers) {
      const soldier = w.id.startsWith('u_');
      const nm = soldier ? w.id : heroSpriteName(w.id);
      const awk = nm.endsWith('_awk');
      const f = w.moving ? Math.floor(w.anim) % 4 : awk ? 4 + (Math.floor(t * 5 + w.x) % 4) : 0;
      const s = sprite(`${nm}_${f}${w.left ? '_L' : ''}`);
      const wx = w.x, wy = w.y;
      list.push({ y: wy, draw: () => {
        g.fillStyle = 'rgba(24,20,37,0.3)'; g.fillRect(X(wx - 7), Y(wy), 14 * S, S);
        blit(s, wx, wy);
      } });
      if (!soldier) this.heroRects.push({ id: w.id, r: [X(wx) - 14 * S, Y(wy) - 30 * S, 28 * S, 32 * S] });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    // 黄昏夜色：整体压暗偏蓝，篝火一圈暖光
    g.fillStyle = 'rgba(16,14,48,0.38)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const flick = 1 + 0.06 * Math.sin(t * 9) + 0.04 * Math.sin(t * 23);
    const glow = g.createRadialGradient(X(0), Y(-4), 4 * S, X(0), Y(-4), 90 * S * flick);
    glow.addColorStop(0, 'rgba(247,118,34,0.55)');
    glow.addColorStop(0.4, 'rgba(247,118,34,0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    for (const tx of [-56, 56]) {
      const tg = g.createRadialGradient(X(tx), Y(-2), S, X(tx), Y(-2), 28 * S * flick);
      tg.addColorStop(0, 'rgba(254,174,52,0.4)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = tg; g.fillRect(X(tx) - 30 * S, Y(-2) - 30 * S, 60 * S, 60 * S);
    }
    // 火星：从篝火往上飘
    for (let i = 0; i < 14; i++) {
      const k = (t * 0.6 + hash2(i, 4, 1)) % 1;
      const sx = X(Math.sin(i * 3.7 + t * 2) * 6 * k + (hash2(i, 5, 1) - 0.5) * 8), sy = Y(-6 - k * 40);
      g.globalAlpha = 1 - k;
      g.fillStyle = i % 3 ? '#feae34' : '#fee761';
      g.fillRect(sx, sy, S, S);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  /** 火焰：三层跳动的火苗（橙、黄、白），(x, y) 是火焰底部中心，sc 为放大倍数 */
  private flame(g: CanvasRenderingContext2D, x: number, y: number, sc: number, t: number) {
    const layers: [string, number, number][] = [['#e43b44', 7, 14], ['#f77622', 5.5, 11], ['#feae34', 4, 8], ['#fee761', 2.5, 5], ['#ffffff', 1, 2.5]];
    for (const [col, w, h] of layers) {
      g.fillStyle = col;
      for (let i = -Math.floor(w); i <= Math.floor(w); i++) {
        const k = 1 - Math.abs(i) / (w + 1);
        const hh = h * k * (0.75 + 0.25 * Math.sin(t * 12 + i * 1.7) + 0.15 * Math.sin(t * 27 + i));
        g.fillRect(Math.round(x + i * sc), Math.round(y - hh * sc), Math.ceil(sc), Math.ceil(hh * sc));
      }
    }
  }
}
