// 小红书主页的「塔防」：蜿蜒兵线上对冲，点卡出兵，没有塔。微信构建不应引用这里。

import { game, Scene } from '../game';
import { C, UI } from '../ui/ui';
import { hasSprite, scaled, sprite } from '../gfx/atlas';
import { playBgm, playSfx } from '../audio/sound';
import { DEBUG } from '../debug';
import { HERO_BY_ID } from '../data/heroes';
import { LANE_LEVELS, LANE_OPEN_LEVELS } from '../data/lane';
import { heroBase } from '../meta/ops';
import { heroSpriteName } from '../meta/goals';
import { save } from '../meta/save';
import {
  buildLanePath, laneAiAction, LaneBattle, LaneCard, LaneUnit, mulberry32,
  type LaneHeroSnap,
} from '../battle/laneBattle';

export function laneFlag(name: string): boolean {
  try {
    if (typeof location === 'undefined' || !location.search) return false;
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return false;
    return new RegExp('[?&]' + name + '=1(&|$)').test(location.search);
  } catch (e) {
    return false;
  }
}

/** 小红书主页：征战 / 守城 / 塔防。只有 IS_XHS 会调用。 */
export function drawLaneModeTabs(ui: UI, mode: string, L: { cy: number }, onPick: (m: 'chapter' | 'defense' | 'lane') => void) {
  const u = ui.u;
  const modes: Array<'chapter' | 'defense' | 'lane'> = ['chapter', 'defense', 'lane'];
  const label: Record<string, string> = { chapter: '征 战', defense: '守 城', lane: '塔 防' };
  const onColor: Record<string, string> = { chapter: '#a22633', defense: '#2f7a3a', lane: '#1d4e89' };
  const mw = 156 * u, mh = 58 * u, gap = 10 * u;
  const my = L.cy - mh - 8 * u;
  const total = modes.length * mw + gap * (modes.length - 1);
  let x = (ui.W - total) / 2;
  const today = new Date().toISOString().slice(0, 10);
  for (const m of modes) {
    const on = mode === m;
    ui.pixRect(x, my, mw, mh, on ? onColor[m] : 'rgba(20,12,10,0.78)');
    ui.pixRect(x, my + mh - 4 * u, mw, 4 * u, on ? '#fee761' : '#5a4038');
    ui.text(label[m], x + mw / 2, my + mh / 2 - 2 * u, 26, on ? '#fff4d6' : '#a89a86', 'center', on ? '#3a0d12' : null);
    if (m === 'defense' && !on && save.defense?.day !== today) ui.redDot(x + mw - 8 * u, my + 6 * u);
    if (ui.clicked('mode_' + m, x, my, mw, mh)) onPick(m);
    x += mw + gap;
  }
}

/** 塔防关卡卡：和守城卡同一块位置，不扣体力、没有奖励 */
export function drawLaneEntry(ui: UI, L: { chH: number; bh: number; by: number; cy: number }, act: { start(): void; story(title: string, body: string): void }) {
  const u = ui.u;
  const lv = LANE_LEVELS[0];
  const cw = ui.W - 80 * u;
  const cx = 40 * u, cy = L.cy;
  ui.panel(cx, cy, cw, L.chH, 'wood');
  ui.pixRect(cx + 30 * u, cy + 20 * u, cw - 60 * u, 46 * u, '#1d4e89');
  ui.text(`塔防 · 第${Math.min(LANE_OPEN_LEVELS, 1)}关`, ui.W / 2, cy + 43 * u, 24, '#fff4d6', 'center', null);
  const oy = cy + 66 * u;
  ui.text('蜿蜒兵线 · 点卡出兵 · 没有塔', ui.W / 2, oy + 22 * u, 22, C.textDim);
  ui.text(lv.name, ui.W / 2, oy + 62 * u, 46, '#fff4d6');
  ui.text(lv.subtitle, ui.W / 2, oy + 104 * u, 22, C.gold);
  ui.text('试玩 · 不耗体力 · 无奖励', ui.W / 2, oy + 142 * u, 20, '#9be37a');
  if (ui.clicked('lane_story', cx + 80 * u, oy, cw - 160 * u, L.chH - 70 * u)) act.story(lv.name, lv.story);
  const bw = 400 * u;
  if (ui.button('start_lane', ui.W / 2 - bw / 2, L.by, bw, L.bh, '出 战', C.btnBlue, { size: 48, sub: '推掉敌营' })) act.start();
}

const RARITY = ['#c9b48e', '#7cc8ff', '#feae34'];

function heroSnap(id: string): LaneHeroSnap {
  const h = HERO_BY_ID[id];
  const hb = heroBase(id);
  const name = heroSpriteName(id);
  return { atk: hb.atk, hp: hb.hp, speed: h.moveSpeed, sprite: name, frames: name.endsWith('_awk') ? 8 : 4 };
}

function blit(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, targetH: number) {
  if (!hasSprite(name)) return 0;
  const s = sprite(name);
  const scale = targetH / s.h;
  const k = scale >= 2 ? Math.floor(scale) : scale;
  ctx.imageSmoothingEnabled = false;
  if (k >= 2) {
    const ss = scaled(s, k);
    ctx.drawImage(ss.canvas, ss.x, ss.y, ss.w, ss.h, Math.round(x - s.ax * k), Math.round(y - s.ay * k), ss.w, ss.h);
    return s.h * k;
  }
  const w = s.w * scale, h = s.h * scale;
  ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(x - s.ax * scale), Math.round(y - s.ay * scale), Math.round(w), Math.round(h));
  return h;
}

function frameName(u: LaneUnit, time: number) {
  let frame: number;
  if (u.sprite.endsWith('_awk')) frame = u.moving ? Math.floor(time * 8 + u.id) % 4 : 4 + (Math.floor(time * 5 + u.id) % 4);
  else frame = Math.floor(time * (u.moving ? 8 : 3) + u.id) % Math.max(1, u.frames);
  const face = u.left ? '_L' : '';
  const flash = u.flashT > 0 ? 'W' : '';
  const name = `${u.sprite}_${frame}${face}${flash}`;
  return hasSprite(name) ? name : `${u.sprite}_${frame}`;
}

function clock(t: number) {
  const s = Math.max(0, Math.floor(t));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export class LaneScene implements Scene {
  battle: LaneBattle;
  cardRects: { x: number; y: number; w: number; h: number }[] = [];
  private onHome: () => void;
  private paused = false;
  private hinted = false;
  private aiAcc = 0;
  private auto: boolean;
  private aiRng: () => number;
  private map = { x: 0, y: 0, w: 0, h: 0 };

  constructor(onHome: () => void) {
    this.onHome = onHome;
    this.auto = laneFlag('laneauto');
    this.aiRng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    const ui = game.ui;
    const lay = this.layout(ui);
    this.map = lay.map;
    this.battle = new LaneBattle({
      levelId: 1,
      path: buildLanePath(lay.map.x, lay.map.y, lay.map.w, lay.map.h),
      seed: (Date.now() % 1000000000) >>> 0,
      heroSnap,
    });
  }

  enter() {
    playBgm('bgm_battle');
    try { (window as any).__lane = this; } catch (e) {}
  }

  private layout(ui: UI) {
    const u = ui.u;
    const top = ui.safeTop + 6 * u;
    const handH = 188 * u;
    const foodH = 72 * u;
    const bottom = ui.H - ui.safeBottom;
    const handY = bottom - handH - 6 * u;
    const foodY = handY - foodH;
    const map = { x: 6 * u, y: top + 58 * u, w: ui.W - 12 * u, h: Math.max(80 * u, foodY - (top + 58 * u) - 4 * u) };
    return { top, handH, handY, foodY, foodH, map };
  }

  update(dt: number) {
    const ui = game.ui;
    const b = this.battle;
    const speed = DEBUG.speed > 0 ? DEBUG.speed : 1;
    if (!this.paused && !b.pending && !b.result) {
      b.step(dt * speed);
      if (this.auto) {
        this.aiAcc += dt * speed;
        if (b.pending) this.applyAi();
        else while (this.aiAcc >= 0.42) { this.aiAcc -= 0.42; this.applyAi(); }
      }
    }
    for (const e of b.consumeEvents()) {
      if (e.kind === 'kill') playSfx('kill');
      else if (e.kind === 'play') playSfx(e.hero ? 'horse' : 'thrust');
      else if (e.kind === 'skill') playSfx('fire');
      else if (e.kind === 'win') playSfx('victory');
      else if (e.kind === 'lose') playSfx('defeat');
      else if (e.kind === 'upgrade') playSfx('levelup');
    }
    if (!this.hinted) { this.hinted = true; ui.toast('点下方卡牌出兵，推掉坡顶敌营'); }
    this.drawWorld(ui);
    this.drawHud(ui);
    this.drawHand(ui);
    if (b.pending) this.drawUpgrade(ui);
    else if (b.result) this.drawResult(ui);
    else if (this.paused) this.drawPause(ui);
  }

  private applyAi() {
    const act = laneAiAction(this.battle, 'smart', this.aiRng);
    if (!act) return;
    if (act.upgrade != null) this.battle.pickUpgrade(act.upgrade);
    else if (act.play != null) this.battle.play(act.play);
  }

  private drawWorld(ui: UI) {
    const g = ui.ctx;
    const b = this.battle;
    const u = ui.u;
    g.fillStyle = '#c4a36a';
    g.fillRect(0, 0, ui.W, ui.H);
    g.fillStyle = '#d8bc86';
    for (let i = 0; i < 18; i++) {
      const px = ((i * 97) % Math.max(1, ui.W));
      const py = 80 * u + ((i * 53) % Math.max(1, ui.H - 200 * u));
      g.fillRect(px, py, 18 * u, 8 * u);
    }
    const pts = b.path.pts;
    const road = Math.max(24, 68 * u);
    g.save();
    g.lineJoin = 'miter';
    g.miterLimit = 2;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokeStyle = '#5a3a28';
    g.lineWidth = road + 6 * u;
    g.stroke();
    g.strokeStyle = '#a56b3c';
    g.lineWidth = road;
    g.stroke();
    g.strokeStyle = '#c48a55';
    g.lineWidth = Math.max(4, road * 0.28);
    g.stroke();
    g.restore();
    this.drawDecor(ui);
    this.drawCamp(ui, pts[0].x, pts[0].y, false);
    this.drawCamp(ui, pts[pts.length - 1].x, pts[pts.length - 1].y, true);
    for (const r of b.rings) {
      const k = r.t / 0.45;
      g.globalAlpha = 1 - k;
      g.strokeStyle = r.color;
      g.lineWidth = 3 * u;
      g.beginPath();
      g.arc(r.x, r.y, r.r * (0.4 + k) * Math.max(1, u), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    const drawU = b.units.slice().sort((a, c) => a.y - c.y);
    for (const unit of drawU) this.drawUnit(ui, unit);
    for (const bolt of b.bolts) {
      const k = bolt.t / bolt.life;
      const x = bolt.x + (bolt.tx - bolt.x) * k;
      const y = bolt.y + (bolt.ty - bolt.y) * k;
      g.strokeStyle = bolt.color;
      g.globalAlpha = 0.85;
      g.lineWidth = 3 * u;
      g.beginPath();
      g.moveTo(bolt.x, bolt.y);
      g.lineTo(x, y);
      g.stroke();
      g.globalAlpha = 1;
    }
    for (const f of b.floats) {
      g.globalAlpha = f.t > 0.7 ? (1.05 - f.t) / 0.35 : 1;
      ui.text(f.text, f.x, f.y - f.t * 36 * u, 18, f.color, 'center', '#1a1210');
      g.globalAlpha = 1;
    }
  }

  private drawDecor(ui: UI) {
    const u = ui.u;
    const m = this.map;
    const spots: { s: string; x: number; y: number; h: number }[] = [
      { s: 'env_changban_tree', x: 0.06, y: 0.22, h: 70 },
      { s: 'env_changban_tree', x: 0.92, y: 0.38, h: 64 },
      { s: 'env_changban_bush', x: 0.08, y: 0.58, h: 36 },
      { s: 'env_changban_rock', x: 0.9, y: 0.72, h: 32 },
      { s: 'env_changban_banner', x: 0.08, y: 0.86, h: 48 },
      { s: 'env_changban_banner', x: 0.9, y: 0.1, h: 48 },
    ];
    for (const d of spots) {
      if (!hasSprite(d.s)) continue;
      blit(ui.ctx, d.s, m.x + m.w * d.x, m.y + m.h * d.y, d.h * u);
    }
  }

  private drawCamp(ui: UI, x: number, y: number, enemy: boolean) {
    const u = ui.u;
    const b = this.battle;
    const g = ui.ctx;
    g.fillStyle = enemy ? 'rgba(160,40,40,0.35)' : 'rgba(120,80,30,0.28)';
    g.beginPath();
    g.ellipse(x, y + 6 * u, 46 * u, 18 * u, 0, 0, Math.PI * 2);
    g.fill();
    blit(ui.ctx, 'camp_tent', x, y + 4 * u, 108 * u);
    const ratio = enemy ? b.enemyHp / b.enemyMax : b.allyHp / b.allyMax;
    const bw = 116 * u;
    ui.text(enemy ? '敌营' : '我军', x, y - 132 * u, 18, enemy ? '#ffb0a8' : '#d6f5c4', 'center', '#1a1210');
    ui.bar(x - bw / 2, y - 118 * u, bw, 14 * u, ratio, enemy ? '#e43b44' : '#63c74d');
  }

  private drawUnit(ui: UI, unit: LaneUnit) {
    const u = ui.u;
    const h = (unit.hero ? 124 : 68) * u * unit.scale;
    if (unit.grain) {
      ui.ctx.strokeStyle = '#e6c15a';
      ui.ctx.lineWidth = 3 * u;
      ui.ctx.beginPath();
      ui.ctx.ellipse(unit.x, unit.y, 22 * u, 10 * u, 0, 0, Math.PI * 2);
      ui.ctx.stroke();
    }
    blit(ui.ctx, 'shadow_s', unit.x, unit.y + 2 * u, 16 * u);
    blit(ui.ctx, frameName(unit, ui.time), unit.x, unit.y, h);
    if (unit.hp < unit.maxHp) {
      const bw = (unit.hero ? 48 : 36) * u;
      ui.bar(unit.x - bw / 2, unit.y - h - 8 * u, bw, 7 * u, unit.hp / unit.maxHp, unit.side === 'ally' ? '#63c74d' : '#e43b44');
    }
    if (unit.grain && hasSprite('bun')) blit(ui.ctx, 'bun', unit.x + 16 * u, unit.y - h * 0.72, 22 * u);
    if (unit.stunT > 0) ui.text('停', unit.x, unit.y - h - 18 * u, 16, '#ffe08a', 'center', '#1a1210');
  }

  private drawHud(ui: UI) {
    const u = ui.u;
    const b = this.battle;
    const lay = this.layout(ui);
    const top = lay.top;
    if (!b.result && !b.pending) {
      if (ui.button('lane_pause', 12 * u, top, 84 * u, 48 * u, this.paused ? '继续' : '暂停', C.btnGray, { size: 22 })) this.paused = !this.paused;
    }
    ui.text(clock(b.t), ui.W - 70 * u, top + 24 * u, 26, '#fee761', 'center', '#1a1210');
    if (b.bannerT > 0) {
      ui.pixRect(ui.W / 2 - 210 * u, top + 50 * u, 420 * u, 36 * u, 'rgba(18,10,8,0.82)');
      ui.text(b.bannerText, ui.W / 2, top + 68 * u, 22, b.bannerColor, 'center', '#1a1210');
    }
    const fy = lay.foodY;
    ui.ctx.fillStyle = 'rgba(18,12,8,0.88)';
    ui.ctx.fillRect(0, fy, ui.W, lay.foodH);
    ui.text('粮草 ' + Math.floor(b.food), 16 * u, fy + 26 * u, 28, '#fee761', 'left', '#1a1210');
    ui.text('+' + b.incomePerSec().toFixed(1) + '/秒', 16 * u, fy + 52 * u, 18, '#d6f5c4', 'left', null, false);
    const aura = b.grainAura();
    const g = b.grainCount();
    const mid = g > 0 ? `粮卒×${g} 产粮中  掉落+${Math.round((aura - 1) * 100)}%` : '粮卒在场会产粮、提高掉落';
    ui.text(mid, ui.W - 16 * u, fy + 24 * u, 18, g > 0 ? '#9be37a' : '#c9b48e', 'right', null, false);
    const barW = Math.min(280 * u, ui.W * 0.46);
    ui.bar(ui.W - 16 * u - barW, fy + 40 * u, barW, 16 * u, b.pending ? 1 : b.xp / b.xpNeed, '#7cc8ff');
    ui.text('兵法 ' + b.rank, ui.W - 16 * u - barW / 2, fy + 48 * u, 14, '#fff', 'center', '#1a1210');
  }

  private drawHand(ui: UI) {
    const u = ui.u;
    const b = this.battle;
    const lay = this.layout(ui);
    const n = b.hand.length;
    const gap = 8 * u;
    const cw = (ui.W - 16 * u - gap * (n - 1)) / n;
    const y = lay.handY;
    const h = lay.handH - 8 * u;
    this.cardRects = [];
    ui.ctx.fillStyle = '#120d0c';
    ui.ctx.fillRect(0, y - 4 * u, ui.W, ui.H - y + 4 * u);
    b.hand.forEach((c, i) => {
      const x = 8 * u + i * (cw + gap);
      this.cardRects.push({ x, y, w: cw, h });
      this.drawCard(ui, c, i, x, y, cw, h);
    });
  }

  private drawCard(ui: UI, c: LaneCard, i: number, x: number, y: number, w: number, h: number) {
    const u = ui.u;
    const b = this.battle;
    const afford = b.food >= c.cost && !b.pending && !b.result && !this.paused;
    const pressed = ui.isPressed('lane_card_' + i) && afford;
    const off = pressed ? 3 * u : 0;
    const rare = RARITY[c.lv - 1] || RARITY[0];
    ui.ctx.globalAlpha = afford ? 1 : 0.72;
    ui.pixRect(x, y + off, w, h, '#120d0c');
    ui.pixRect(x + 3 * u, y + 3 * u + off, w - 6 * u, h - 6 * u, rare);
    ui.pixRect(x + 7 * u, y + 7 * u + off, w - 14 * u, h - 14 * u, '#2a221c');
    ui.text(String(c.lv), x + 16 * u, y + 20 * u + off, 16, rare, 'center', '#1a1210');
    const icon = c.sprite + '_0';
    blit(ui.ctx, hasSprite(icon) ? icon : c.sprite, x + w / 2, y + h * 0.36 + off, (c.kind === 'hero' ? 72 : 64) * u);
    ui.text(c.name, x + w / 2, y + h - 78 * u + off, 18, '#fff4d6', 'center', '#1a1210');
    ui.text(c.blurb, x + w / 2, y + h - 58 * u + off, 14, c.kind === 'hero' ? c.color : '#d6c4a4', 'center', null, false);
    ui.text('攻' + b.cardAtk(c) + ' 血' + b.cardHp(c), x + w / 2, y + h - 40 * u + off, 13, '#f0e2c4', 'center', null, false);
    const costColor = b.food >= c.cost ? '#fee761' : '#ff8a80';
    ui.text(String(c.cost), x + w / 2, y + h - 20 * u + off, 20, costColor, 'center', '#1a1210');
    ui.ctx.globalAlpha = 1;
    if (ui.clicked('lane_card_' + i, x, y, w, h)) {
      const err = b.play(i);
      if (err) ui.toast(err);
    }
  }

  private drawUpgrade(ui: UI) {
    const b = this.battle;
    const ups = b.pending;
    if (!ups) return;
    ui.layer = 5;
    ui.dim(0.62);
    ui.blocker('lane_up_block');
    const u = ui.u;
    ui.text('兵法精进', ui.W / 2, ui.H * 0.2, 40, '#fee761', 'center', '#3a0d12');
    ui.text('选一项强化这支兵线', ui.W / 2, ui.H * 0.2 + 36 * u, 20, '#fff4d6', 'center', null, false);
    const w = ui.W - 70 * u;
    const h = 132 * u;
    const gap = 14 * u;
    let y = ui.H * 0.2 + 64 * u;
    ups.forEach((up, i) => {
      const x = 35 * u;
      ui.panel(x, y, w, h, 'paper');
      ui.text(up.name, x + 24 * u, y + 36 * u, 32, '#3e2731', 'left', null);
      ui.wrapText(up.desc, x + 24 * u, y + 58 * u, w - 48 * u, 22, '#3e2731', 1.35, 'left', null);
      if (ui.clicked('lane_up_' + i, x, y, w, h)) b.pickUpgrade(i);
      y += h + gap;
    });
  }

  private drawPause(ui: UI) {
    ui.layer = 5;
    ui.dim(0.55);
    ui.blocker('lane_pause_block');
    const u = ui.u;
    ui.text('暂停', ui.W / 2, ui.H * 0.38, 48, '#fff4d6', 'center', '#1a1210');
    const bw = 280 * u, bh = 84 * u;
    if (ui.button('lane_resume', ui.W / 2 - bw / 2, ui.H * 0.46, bw, bh, '继续战斗', C.btnGreen, { size: 32 })) this.paused = false;
    if (ui.button('lane_home', ui.W / 2 - bw / 2, ui.H * 0.46 + bh + 16 * u, bw, bh, '返回主页', C.btnGray, { size: 32 })) this.onHome();
  }

  private drawResult(ui: UI) {
    const b = this.battle;
    ui.layer = 5;
    ui.dim(0.62);
    ui.blocker('lane_end_block');
    const u = ui.u;
    const win = b.result === 'win';
    ui.panel(50 * u, ui.H * 0.28, ui.W - 100 * u, 360 * u, 'wood');
    ui.text(win ? '敌营已破' : '兵营失守', ui.W / 2, ui.H * 0.28 + 70 * u, 48, win ? '#9be37a' : '#ff8a80', 'center', '#1a1210');
    ui.text('试玩关卡，没有奖励', ui.W / 2, ui.H * 0.28 + 120 * u, 24, '#fff4d6', 'center', null, false);
    ui.text(`击破敌军 ${b.kills} · 用时 ${clock(b.t)}`, ui.W / 2, ui.H * 0.28 + 160 * u, 22, '#fee761');
    const bw = 280 * u, bh = 78 * u;
    const y = ui.H * 0.28 + 200 * u;
    if (ui.button('lane_retry', ui.W / 2 - bw / 2, y, bw, bh, '再战一次', C.btnBlue, { size: 30 })) {
      game.setScene(new LaneScene(this.onHome));
    }
    if (ui.button('lane_back', ui.W / 2 - bw / 2, y + bh + 14 * u, bw, bh, '返回主页', C.btnGold, { size: 30 })) this.onHome();
  }
}
