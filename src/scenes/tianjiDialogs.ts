import { game, Dialog } from '../game';
import { C, UI } from '../ui/ui';
import { dialogFrame } from '../ui/widgets';
import { sprite } from '../gfx/atlas';
import { playSfx, vibrate } from '../audio/sound';
import { getPlatform } from '../platform';
import { NO_ADS } from '../data/platformConfig';
import { progressTask } from '../meta/ops';
import { save, markDirty } from '../meta/save';
import { WEAPONS } from '../data/skills';
import type { BattleScene } from './battleScene';
import type { Battle } from '../battle/battle';
import { TIERS, TIER_W, Tier, DrawResult, drawSign, canDraw, drawCost, FREE_EVERY, AD_DRAW_MAX } from '../battle/tianji';

// 天机签的界面：摇签动画（签筒摇晃 → 签飞出 → 光芒中翻开签文）、金币不足时的看视频抽签、战斗 HUD 上的签筒按钮。

/** 签诗（每档一句） */
const VERSES = ['龙跃天门 · 万事皆吉', '顺风扬帆 · 前程似锦', '守得云开 · 自见月明', '暂困浅滩 · 否极泰来', '天机难测 · 祸福相依'];
const SHAKE = 0.75, FLY = 0.35, REVEAL = SHAKE + FLY;
const easeOutBack = (k: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

function wrapLines(ui: UI, text: string, maxW: number, size: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ui.measure(line + ch, size, false) > maxW && line) { out.push(line); line = ch; }
      else line += ch;
    }
    out.push(line);
  }
  return out;
}

/** 一根签：竹签身 + 签头（品级颜色）。(x, y) 是签的中心，angle 为弧度。 */
function drawStick(g: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, angle: number, tier: Tier, alpha = 1) {
  const T = TIERS[tier];
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = '#2a1d14';
  g.fillRect(-w / 2 - 2, -len / 2 - 2, w + 4, len + 4);
  g.fillStyle = '#f1e2bd';
  g.fillRect(-w / 2, -len / 2, w, len);
  g.fillStyle = '#d9c497';
  g.fillRect(w / 2 - w * 0.3, -len / 2, w * 0.3, len);
  g.fillStyle = T.color;
  g.fillRect(-w / 2, -len / 2, w, len * 0.2);
  g.fillStyle = T.deep;
  g.fillRect(-w / 2, -len / 2 + len * 0.2 - 2, w, 3);
  g.restore();
}

export class TianjiDrawDialog implements Dialog {
  noDim = true;
  t?: number;
  private res: DrawResult;
  private applied = false;
  private chosen: string | null = null;
  private rattle = 0;
  private sparks: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];

  constructor(private scene: BattleScene, res: DrawResult) {
    this.res = res;
    playSfx('click');
  }

  /**
   * 尝试开始一次抽签（签 / 金币 / 视频）；抽不起返回 false。
   * skipAnim：跳过动画——直接生效，结果以文字飘在剑客身边；要玩家做选择的签（换兵器、赌局……）直接弹签文卡。
   */
  static open(scene: BattleScene, viaAd = false, skipAnim = false): boolean {
    const b = scene.battle;
    if (!viaAd && !canDraw(b)) return false;
    const res = drawSign(b, viaAd);
    if (!res) return false;
    if (skipAnim && !res.options) { quickReveal(scene, res); return true; }
    const d = new TianjiDrawDialog(scene, res);
    if (skipAnim) d.t = REVEAL;
    game.openDialog(d);
    return true;
  }

  private reveal() {
    if (this.applied) return;
    this.applied = true;
    const T = TIERS[this.res.tier];
    playSfx(T.sfx as never);
    if (this.res.tier === 0 || this.res.tier === 4) vibrate(true);
    if (!this.res.options && this.res.apply) this.res.apply();
    // 金色粒子 / 暗红火星
    const ui = game.ui, n = this.res.tier === 0 ? 70 : this.res.tier <= 1 ? 36 : this.res.tier === 4 ? 40 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (200 + Math.random() * 520) * ui.u;
      this.sparks.push({ x: ui.W / 2, y: ui.H * 0.42, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200 * ui.u, life: 0.8 + Math.random() * 0.9, c: Math.random() < 0.5 ? T.color : T.glow });
    }
  }

  draw(ui: UI, dt: number) {
    const u = ui.u, g = ui.ctx, W = ui.W, H = ui.H;
    const t = this.t || 0;
    const tier = this.res.tier, T = TIERS[tier];
    // 点一下跳过摇签动画
    if (t < REVEAL && ui.clicked('tj_skip', 0, 0, W, H, false)) this.t = REVEAL;
    const time = this.t || 0;

    // 底色：压暗 + 揭晓后按品级染色的光晕
    g.fillStyle = `rgba(8,6,12,${Math.min(0.78, time * 3)})`;
    g.fillRect(0, 0, W, H);
    const cx = W / 2;

    if (time < REVEAL) {
      // —— 摇签 ——
      const cy = H * 0.56;
      const glow = g.createRadialGradient(cx, cy, 20 * u, cx, cy, 340 * u);
      glow.addColorStop(0, 'rgba(255,214,120,0.32)'); glow.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      const shakeK = Math.min(1, time / SHAKE);
      const ang = time < SHAKE ? Math.sin(time * 38) * 0.2 * (1 - shakeK * 0.4) : 0;
      const hop = time < SHAKE ? -Math.abs(Math.sin(time * 19)) * 16 * u : 0;
      this.rattle -= dt;
      if (time < SHAKE && this.rattle <= 0) { this.rattle = 0.1; playSfx('click'); }
      // 飞出的签（在签筒后面先画）
      if (time >= SHAKE) {
        const k = (time - SHAKE) / FLY, e = 1 - (1 - k) * (1 - k);
        const sx = cx, sy = cy - 110 * u - e * 260 * u;
        g.strokeStyle = T.color; g.globalAlpha = 0.5 * (1 - k); g.lineWidth = 14 * u;
        g.beginPath(); g.moveTo(cx, cy - 100 * u); g.lineTo(sx, sy); g.stroke(); g.globalAlpha = 1;
        drawStick(g, sx, sy, 230 * u, 24 * u, (1 - e) * 0.9 + Math.sin(k * 20) * 0.05, tier);
      }
      g.save();
      g.translate(cx, cy + 120 * u + hop);
      g.rotate(ang);
      const s = sprite('tj_tong');
      const k = Math.max(1, Math.round((260 * u) / s.h));
      g.imageSmoothingEnabled = false;
      g.drawImage(s.canvas, s.x, s.y, s.w, s.h, -s.w * k / 2, -s.h * k, s.w * k, s.h * k);
      g.restore();
      ui.text(time < SHAKE ? '摇签中……' : '签出！', cx, H * 0.22, 40, '#fff4d6', 'center', '#3a0d12');
      ui.text('点击屏幕跳过', cx, H * 0.82, 20, 'rgba(255,244,214,0.55)', 'center', null);
      if (time + dt >= REVEAL) this.reveal();
      return;
    }

    // —— 揭晓 ——
    this.reveal();
    const r = time - REVEAL;
    // 光芒
    const rayCol = T.glow;
    g.save();
    g.translate(cx, H * 0.44);
    g.rotate(r * (tier === 4 ? -0.9 : 0.35));
    g.globalCompositeOperation = 'lighter';
    const rays = tier === 0 ? 18 : tier === 1 ? 14 : 10;
    for (let i = 0; i < rays; i++) {
      g.rotate((Math.PI * 2) / rays);
      g.globalAlpha = (tier >= 3 && tier !== 4 ? 0.08 : 0.17) * Math.min(1, r * 3);
      g.fillStyle = rayCol;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-40 * u, -620 * u); g.lineTo(40 * u, -620 * u); g.closePath(); g.fill();
    }
    g.restore();
    const halo = g.createRadialGradient(cx, H * 0.44, 30 * u, cx, H * 0.44, 420 * u);
    halo.addColorStop(0, T.color + '66'); halo.addColorStop(1, T.color + '00');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    // 闪光
    if (r < 0.3 && tier !== 3) { g.fillStyle = `rgba(255,255,255,${(0.3 - r) * (tier === 0 ? 2.6 : 1.6)})`; g.fillRect(0, 0, W, H); }
    // 粒子
    g.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      p.life -= dt; if (p.life <= 0) continue;
      p.vy += 700 * u * dt; p.vx *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, p.life * 1.5);
      g.fillStyle = p.c;
      const s = (tier === 0 ? 9 : 7) * u;
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.sparks = this.sparks.filter((p) => p.life > 0);

    // 签文卡：弹出放大，怪签抖一抖
    const pop = easeOutBack(Math.min(1, r / 0.32));
    const many = (this.res.options?.length || 0) > 2 && this.chosen === null;
    const cw = 560 * u, ch = (many ? 560 : 640) * u;
    const jit = tier === 4 && r < 0.5 ? (Math.random() - 0.5) * 16 * u * (1 - r / 0.5) : 0;
    const x = cx - cw / 2 + jit, y = (many ? H * 0.36 : H * 0.44) - ch / 2;
    g.save();
    g.translate(cx, H * 0.44);
    g.scale(0.4 + 0.6 * pop, 0.4 + 0.6 * pop);
    g.translate(-cx, -H * 0.44);
    // 卡身：深色描边 + 品级色边框 + 宣纸面
    const b = Math.max(3, Math.round(6 * u));
    g.fillStyle = '#1e140e'; g.fillRect(x - b, y - b, cw + 2 * b, ch + 2 * b);
    g.fillStyle = T.color; g.fillRect(x, y, cw, ch);
    g.fillStyle = T.deep; g.fillRect(x + b, y + b, cw - 2 * b, ch - 2 * b);
    g.fillStyle = '#f4e9d2'; g.fillRect(x + 2 * b, y + 2 * b, cw - 4 * b, ch - 4 * b);
    ui.markPaper(x + 2 * b, y + 2 * b, cw - 4 * b, ch - 4 * b);
    ui.paperTexture(x + 2 * b, y + 2 * b, cw - 4 * b, ch - 4 * b, { alpha: 0.9, patina: true });
    // 签头：品级大字
    g.fillStyle = T.deep; g.fillRect(x + 2 * b, y + 2 * b, cw - 4 * b, 110 * u);
    g.fillStyle = T.color; g.fillRect(x + 2 * b, y + 2 * b + 110 * u - 4 * u, cw - 4 * b, 4 * u);
    g.restore();
    // 文字不跟随缩放（缩放时文字缓存会退回直接绘制），等弹出动画结束再画，避免错位
    if (pop >= 0.98) {
      ui.text(`◆ ${T.name} ◆`, cx + jit, y + 2 * b + 56 * u, 58, T.color, 'center', '#120a06');
      // 图标圆章
      const my = y + 250 * u;
      g.fillStyle = T.color + '55';
      g.beginPath(); g.arc(cx + jit, my, 92 * u + Math.sin(r * 4) * 4 * u, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fbf3e1';
      g.beginPath(); g.arc(cx + jit, my, 78 * u, 0, Math.PI * 2); g.fill();
      g.strokeStyle = T.deep; g.lineWidth = 4 * u; g.stroke();
      ui.icon(this.res.icon, cx + jit, my, 120 * u);
      ui.text(this.res.title, cx + jit, y + 380 * u, 46, '#2a1d14', 'center', null);
      const body = this.chosen ?? this.res.outcome ?? this.res.desc;
      const lines = wrapLines(ui, body, cw - 90 * u, 27);
      lines.slice(0, 4).forEach((l, i) => ui.text(l, cx + jit, y + 450 * u + i * 42 * u, 27, this.chosen ? T.deep : '#4a3a2c', 'center', null, false));
      // 签诗：每档一句，落在卡片下部
      ui.text(VERSES[tier], cx + jit - 40 * u, y + ch - 62 * u, 22, T.deep, 'center', null, false);
      // 朱红印章
      g.fillStyle = 'rgba(168,34,25,0.85)';
      g.fillRect(x + cw - 92 * u, y + ch - 92 * u, 60 * u, 60 * u);
      ui.text('天机', x + cw - 62 * u, y + ch - 62 * u, 22, '#fbf4e4', 'center', null);
    }

    // 按钮
    const by = y + ch + 40 * u, bh = 96 * u;
    if (r < 0.35) return;
    const opts = this.res.options;
    if (opts && this.chosen === null) {
      const pickOpt = (o: typeof opts[number]) => { const out = o.act(); this.chosen = out || o.label; playSfx('levelup'); };
      if (opts.length <= 2) {
        const bw = 270 * u;
        opts.forEach((o, i) => {
          const bx = cx + (i === 0 ? -bw - 12 * u : 12 * u);
          if (ui.button('tj_opt_' + i, bx, by, bw, bh, o.label, i === 0 ? C.btnRed : C.btnGray, { size: 32, sub: o.sub })) pickOpt(o);
        });
      } else {
        // 三个以上（兵器任选其一）：竖排，每项带兵器图标
        const bw = cw, oh = 84 * u;
        opts.forEach((o, i) => {
          const oy2 = by - 16 * u + i * (oh + 10 * u);
          if (ui.button('tj_opt_' + i, cx - bw / 2, oy2, bw, oh, o.label, o.icon ? C.btnGold : C.btnGray, { size: 28, sub: o.sub, icon: o.icon })) pickOpt(o);
        });
      }
      return;
    }
    const b2 = this.scene.battle;
    // 自动开签：不用选择的签揭晓 1.8 秒后自己收下，接着摇下一签
    if (save.settings.tjAuto && (!opts || this.chosen !== null) && r > (this.chosen !== null ? 2.4 : 1.8)) return false;
    const more = canDraw(b2) && !b2.dead && !b2.won;
    const bw = more ? 270 * u : 360 * u;
    if (ui.button('tj_ok', more ? cx - bw - 12 * u : cx - bw / 2, by, bw, bh, '收 下', C.btnGold, { size: 34 })) return false;
    if (more) {
      const st = b2.tj!;
      const sub = st.bonusDraws > 0 ? `三连签 · 还剩 ${st.bonusDraws}` : st.tickets > 0 ? `签 ×${st.tickets}` : `${drawCost(st)} 金币`;
      if (ui.button('tj_again', cx + 12 * u, by, bw, bh, '再抽一签', C.btnRed, { size: 32, sub })) {
        this.closed = true;
        TianjiDrawDialog.open(this.scene, false, !!save.settings.tjSkipAnim);
        return false;
      }
    }
  }
  closed?: boolean;
}

/** 跳过动画时：签立刻生效，品级色的字飘在剑客头顶右侧，脚下爆一圈同色粒子 */
function quickReveal(scene: BattleScene, res: DrawResult) {
  const b = scene.battle, T = TIERS[res.tier];
  playSfx(T.sfx as never);
  if (res.tier === 0) vibrate(true);
  if (res.apply) res.apply();
  const line = (res.outcome || res.desc).split('\n')[0];
  // 飘字在头顶右侧，太长会出屏：截到 13 个字
  const first = line.length > 13 ? line.slice(0, 12) + '…' : line;
  scene.floatLines([{ text: `【${T.name}】${res.title}`, color: T.color }, { text: first, color: '#fff4d6' }]);
  b.burst(b.player.x, b.player.y - 10, res.tier === 0 ? 30 : 14, [T.color, T.glow, '#ffffff'], 120, 0.7);
}

/** 金币不足：看视频抽一签（小红书没有广告，每局免费一次） */
export class TianjiAdDialog implements Dialog {
  t?: number;
  private busy = false;
  constructor(private scene: BattleScene) {}
  draw(ui: UI) {
    const u = ui.u, b = this.scene.battle, st = b.tj!;
    const max = NO_ADS ? 1 : AD_DRAW_MAX;
    const left = Math.max(0, max - st.adDraws);
    const w = ui.W - 160 * u, h = 470 * u, x = 80 * u, y = ui.H * 0.5 - h / 2;
    ui.panel(x, y, w, h, 'paper');
    ui.text('金币不够了', ui.W / 2, y + 70 * u, 40, '#2a1d14', 'center', null);
    ui.text(`抽一签要 ${drawCost(st)} 金币，还差 ${Math.max(0, drawCost(st) - b.coins)}`, ui.W / 2, y + 140 * u, 26, '#5c4d3e', 'center', null);
    ui.text(`下一支免费签：${Math.ceil(st.freeT)} 秒后`, ui.W / 2, y + 186 * u, 24, '#2b6e3f', 'center', null);
    ui.text('砍树、打怪都能攒金币', ui.W / 2, y + 228 * u, 22, '#8a7c6c', 'center', null);
    const bw = (w - 90 * u) / 2, by = y + h - 140 * u;
    if (ui.button('tj_ad_no', x + 30 * u, by, bw, 100 * u, '继续砍树', C.btnGray, { size: 30 })) return false;
    const label = NO_ADS ? '免费抽一签' : '看视频抽签';
    if (ui.button('tj_ad_yes', x + 60 * u + bw, by, bw, 100 * u, label, C.btnRed, { size: 30, icon: NO_ADS ? undefined : 'video', disabled: !left || this.busy, sub: `本局还剩 ${left} 次` }) && left && !this.busy) {
      if (NO_ADS) { this.closed = true; TianjiDrawDialog.open(this.scene, true); return false; }
      this.busy = true;
      getPlatform().showRewardedAd('tianji_draw').then((ok) => {
        this.busy = false;
        if (!ok) { ui.toast('看完视频才能抽签哦'); return; }
        progressTask('ad', 1);
        this.closed = true;
        TianjiDrawDialog.open(this.scene, true);
      }).catch(() => { this.busy = false; ui.toast('视频暂时无法播放，请再试一次'); });
    }
    if (this.closed) return false;
  }
  closed?: boolean;
}

/** 战斗 HUD：签筒按钮（右下角，和大招相对）、计时效果标签、迷雾、夺兵贼标记 */
export function drawTianjiHud(scene: BattleScene, ui: UI, blocked: boolean): { x: number; y: number; r: number } | null {
  const b = scene.battle, st = b.tj;
  if (!st) return null;
  const u = ui.u, g = ui.ctx;
  drawThiefMarker(scene, ui, b);
  // 计时效果标签：左侧金币下面一列
  let cy = Math.max(ui.safeTop + 190 * u, scene.hudIconBottom);
  // 有敌将血条时排到血条下面，免得压住血条
  if ((b.finalBoss && !b.finalBoss.dead) || (b.midBoss && !b.midBoss.dead)) cy = Math.max(cy, ui.safeTop + 8 * u + 300 * u);
  for (const t of st.timed) {
    const w = 210 * u, h = 40 * u;
    g.fillStyle = t.good ? 'rgba(30,90,50,0.82)' : 'rgba(120,24,30,0.85)';
    g.fillRect(16 * u, cy, w, h);
    g.fillStyle = t.good ? '#63c74d' : '#e43b44';
    g.fillRect(16 * u, cy + h - 4 * u, w * Math.max(0, t.left / t.total), 4 * u);
    ui.text(`${t.name} ${Math.ceil(t.left)}s`, 16 * u + w / 2, cy + h / 2 - 1 * u, 21, '#fff4d6', 'center', null);
    cy += h + 8 * u;
  }
  for (const r of st.rust) {
    const w = 210 * u, h = 40 * u;
    g.fillStyle = 'rgba(90,60,40,0.85)'; g.fillRect(16 * u, cy, w, h);
    ui.text(`${WEAPONS[r.id].name}生锈 ${Math.ceil(r.left)}s`, 16 * u + w / 2, cy + h / 2 - 1 * u, 19, '#fff4d6', 'center', null);
    cy += h + 8 * u;
  }

  // 签筒按钮
  const r = 74 * u;
  // 和大招按钮相对：大招默认在左下，签筒就在右下
  const right = !save.settings.ultRight;
  const bx = right ? ui.W - r - 34 * u : r + 34 * u, byy = ui.H - r - 120 * u - ui.safeBottom;
  const free = st.bonusDraws > 0 || st.tickets > 0;
  const afford = free || b.coins >= drawCost(st);
  const time = ui.time;
  // 底盘：能抽时金光呼吸
  if (afford) {
    const glow = g.createRadialGradient(bx, byy, r * 0.5, bx, byy, r * 1.6);
    glow.addColorStop(0, `rgba(254,231,97,${0.35 + 0.2 * Math.sin(time * 5)})`); glow.addColorStop(1, 'rgba(254,231,97,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(bx, byy, r * 1.6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(40,26,18,0.85)';
  g.beginPath(); g.arc(bx, byy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2e6cc';
  g.beginPath(); g.arc(bx, byy, r - 6 * u, 0, Math.PI * 2); g.fill();
  // 下一支免费签的进度环
  g.strokeStyle = '#a22633'; g.lineWidth = 6 * u;
  g.beginPath(); g.arc(bx, byy, r - 3 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - st.freeT / FREE_EVERY)); g.stroke();
  // 签筒：能抽时轻轻摇
  const wob = afford ? Math.sin(time * 9) * 0.08 * (Math.sin(time * 1.7) > 0.3 ? 1 : 0) : 0;
  g.save(); g.translate(bx, byy + 6 * u); g.rotate(wob);
  const s = sprite('tj_tong'), k = Math.max(1, Math.round((r * 1.25) / s.h));
  g.imageSmoothingEnabled = false;
  g.globalAlpha = afford ? 1 : 0.55;
  g.drawImage(s.canvas, s.x, s.y, s.w, s.h, -s.w * k / 2, -s.h * k / 2, s.w * k, s.h * k);
  g.restore();
  g.globalAlpha = 1;
  // 角标：签数
  const n = st.tickets + st.bonusDraws;
  if (n > 0) {
    g.fillStyle = '#e43b44'; g.beginPath(); g.arc(bx + r * 0.72, byy - r * 0.72, 24 * u, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff4d6'; g.lineWidth = 3 * u; g.stroke();
    ui.text(String(n), bx + r * 0.72, byy - r * 0.72, 24, '#fff', 'center', null);
  }
  ui.text(free ? '抽 签' : `${drawCost(st)} 金`, bx, byy + r + 22 * u, 24, free ? '#fee761' : afford ? '#fff4d6' : '#ff8a80', 'center', '#1a1210');
  if (!blocked && ui.clicked('tj_draw', bx - r, byy - r, r * 2, r * 2)) scene.pressDraw();
  // 「跳过动画」开关：签筒上方的小纸签
  const skip = !!save.settings.tjSkipAnim;
  const tw = 156 * u, th = 44 * u, tx = bx - tw / 2, ty = byy - r - th - 30 * u;
  g.fillStyle = skip ? 'rgba(162,38,51,0.9)' : 'rgba(40,26,18,0.72)';
  g.fillRect(tx, ty, tw, th);
  g.strokeStyle = skip ? '#fee761' : 'rgba(255,244,214,0.5)'; g.lineWidth = 2 * u; g.strokeRect(tx, ty, tw, th);
  ui.text((skip ? '☑' : '☐') + ' 跳过动画', bx, ty + th / 2, 21, '#fff4d6', 'center', null);
  if (!blocked && ui.clicked('tj_skipanim', tx - 6 * u, ty - 6 * u, tw + 12 * u, th + 12 * u)) {
    save.settings.tjSkipAnim = !skip;
    markDirty();
    ui.toast(!skip ? '已跳过抽签动画：奖励直接飘字显示' : '已恢复抽签动画');
  }
  // 「自动开签」开关：在「跳过动画」上方。开着时有签或金币够就自动摇签，选择类的签仍会停下来等玩家
  const auto = !!save.settings.tjAuto;
  const ay = ty - th - 12 * u;
  g.fillStyle = auto ? 'rgba(90,42,140,0.92)' : 'rgba(40,26,18,0.72)';
  g.fillRect(tx, ay, tw, th);
  g.strokeStyle = auto ? '#fee761' : 'rgba(255,244,214,0.5)'; g.lineWidth = 2 * u; g.strokeRect(tx, ay, tw, th);
  ui.text((auto ? '☑' : '☐') + ' 自动开签', bx, ay + th / 2, 21, '#fff4d6', 'center', null);
  if (!blocked && ui.clicked('tj_auto', tx - 6 * u, ay - 6 * u, tw + 12 * u, th + 6 * u)) {
    save.settings.tjAuto = !auto;
    markDirty();
    ui.toast(!auto ? '已开启自动开签：有签就自动摇，选择类的签会停下来等你' : '已关闭自动开签');
  }
  return { x: bx, y: byy, r };
}

/** 迷雾：只看得清身边一圈。画在 HUD 之前，只遮战场不遮界面 */
export function drawTianjiFog(scene: BattleScene, ui: UI) {
  const b = scene.battle, st = b.tj;
  if (!st || !st.timed.some((t) => t.id === 'fog')) return;
  const u = ui.u, g = ui.ctx;
  const [px, py] = scene.worldToScreen(b.player.x, b.player.y - 10);
  const fog = g.createRadialGradient(px, py, 130 * u, px, py, 420 * u);
  fog.addColorStop(0, 'rgba(20,18,30,0)'); fog.addColorStop(1, 'rgba(20,18,30,0.9)');
  g.fillStyle = fog; g.fillRect(0, 0, ui.W, ui.H);
}

function drawThiefMarker(scene: BattleScene, ui: UI, b: Battle) {
  const th = b.tj?.thief;
  if (!th || th.e.dead) return;
  const u = ui.u;
  const [x, y] = scene.worldToScreen(th.e.x, th.e.y - 34);
  const bob = Math.sin(ui.time * 6) * 6 * u;
  if (x < 0 || x > ui.W || y < 0 || y > ui.H) return;
  ui.icon(th.weapon ? WEAPONS[th.weapon].icon : 'tj_tong', x, y - 40 * u + bob, 64 * u);
  ui.text(th.weapon ? '夺兵贼' : `偷签贼 ×${th.tickets}`, x, y - 90 * u + bob, 22, '#ff8a80', 'center', '#1a1210');
}

export { REVEAL };

/** 主界面「玩法」：规则 + 五档签的概率公示 + 保底 */
export class TianjiRulesDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const u = ui.u, g = ui.ctx;
    const w = ui.W - 60 * u, h = 1080 * u;
    const f = dialogFrame(ui, w, h, '天机签 · 玩法', this.t || 0, 'tj_rules_x');
    if (f.close) return false;
    let y = f.y + 100 * u;
    const lx = f.x + 50 * u;
    const lines = [
      '无名剑客独闯乱世，撑过十分钟即胜利。每局 10 体力、都有奖励。',
      '8:30 天命之主登场（血量无限），90 秒内的伤害记入排行榜。',
      '签从哪来：升级（20 级后每两级）、每 40 秒一签、',
      '金币抽签（15 金起，每次 +8，最多 200）、看视频抽签。',
      '砍树、打怪、开宝箱都能攒金币。',
      '专属兵器只能带一件，抽到别的会问你换不换。',
    ];
    for (const l of lines) { ui.text(l, lx, y, 23, '#3b2f24', 'left', null, false); y += 42 * u; }
    y += 20 * u;
    ui.text('签运基础概率', ui.W / 2, y, 30, '#5a2a8c', 'center', null);
    y += 50 * u;
    const ex = ['神兵天降 · 群英会 · 宝箱雨 · 金身不坏 · 三连签', '名将兵器 · 万剑归宗 · 点石成金 · 定身法 · 聚宝盆', '兵器 · 兵法 · 金币 · 怒气 · 天降森林 · 短时增益', '怪潮 · 夺兵 · 签被偷 · 十面埋伏（都有补偿）', '巨人化 · 乾坤大挪移 · 孤注一掷 · 斩将令'];
    const pct = TIER_W;
    TIERS.forEach((T, i) => {
      g.fillStyle = '#2a1d14'; g.fillRect(lx - 2 * u, y - 30 * u, 22 * u, 64 * u);
      g.fillStyle = '#f1e2bd'; g.fillRect(lx, y - 28 * u, 18 * u, 60 * u);
      g.fillStyle = T.color; g.fillRect(lx, y - 28 * u, 18 * u, 16 * u);
      ui.text(`${T.name}  ${pct[i]}%`, lx + 40 * u, y - 10 * u, 26, T.deep, 'left', null);
      ui.text(ex[i], lx + 40 * u, y + 20 * u, 19, '#5c4d3e', 'left', null, false);
      y += 84 * u;
    });
    y += 10 * u;
    for (const l of ['保底：连续 3 支下签，下一签必是上签以上；每 10 签', '至少一支上上签；开局两分钟不出下签和怪签；', '三连签抽到的三签不出下签。实际好签会比基础概率多。']) {
      ui.text(l, lx, y, 21, '#a22633', 'left', null, false); y += 38 * u;
    }
  }
}
