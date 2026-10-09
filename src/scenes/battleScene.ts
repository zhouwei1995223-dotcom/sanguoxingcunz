import { game, Scene } from '../game';
import { getPlatform } from '../platform';
import type { TouchKind, TouchPoint } from '../platform/types';
import { Battle, Choice } from '../battle/battle';
import { WorldRenderer } from '../battle/render';
import { resetSpawner } from '../battle/spawner';
import { CHAPTERS, ChapterDef } from '../data/chapters';
import { WEAPONS, PASSIVES, MAX_WEAPON_LV, MAX_PASSIVE_LV } from '../data/skills';
import { BossDef } from '../data/enemies';
import { computeStats } from '../meta/ops';
import { save, markDirty, flushSave } from '../meta/save';
import { playBgm, playSfx, vibrate, Sfx } from '../audio/sound';
import { C, UI } from '../ui/ui';
import { fmtTime, fmtNum, clamp } from '../core/math';
import { LevelUpDialog, ChestDialog, PauseDialog, ReviveDialog, ResultDialog, BossIntroDialog } from './battleDialogs';
import { guideHint } from '../ui/guide';
import { DEBUG } from '../debug';

export class BattleScene implements Scene {
  battle!: Battle;
  renderer!: WorldRenderer;
  chapter: ChapterDef;
  private joyId: number | null = null;
  private joyBase = { x: 0, y: 0 };
  private joyCur = { x: 0, y: 0 };
  private banners: { text: string; color: string; t: number }[] = [];
  private wonT = 0;
  private resultShown = false;
  private reviveShown = false;
  private bossBar: { name: string; title: string } | null = null;
  private tutorialT = 0;
  private autoGoldT = 0;
  paused = false;

  constructor(chapterId: number) {
    this.chapter = CHAPTERS[chapterId - 1];
  }

  enter() {
    const p = getPlatform();
    resetSpawner();
    this.renderer = new WorldRenderer(p.width, p.height, this.chapter.theme);
    this.battle = new Battle(this.chapter, computeStats(), this.renderer.w, this.renderer.h);
    this.battle.showDamage = save.settings.dmgNum;
    this.battle.hooks = {
      sfx: (n) => playSfx(n as Sfx),
      shake: (pw) => { this.renderer.shake = Math.max(this.renderer.shake, pw); },
      banner: (text, color) => this.banners.push({ text, color: color || C.gold, t: 0 }),
      vibrate: (l) => vibrate(l),
      bossAppear: (d: BossDef) => this.onBoss(d),
    };
    playBgm('bgm_battle');
    this.banners.push({ text: `第${this.chapter.id}章 · ${this.chapter.name}`, color: C.gold, t: 0 });
  }

  private onBoss(d: BossDef) {
    playSfx('boss');
    vibrate(true);
    this.bossBar = { name: d.name, title: d.title };
    if (this.battle.finalBoss) playBgm('bgm_boss');
    game.openDialog(new BossIntroDialog(d, !!this.battle.finalBoss));
  }

  onTouch(kind: TouchKind, touches: TouchPoint[]) {
    if (kind === 'start') {
      if (this.joyId !== null || game.dialogs.length) return;
      const t = touches[0];
      if (game.ui.touchBlocked(t.x, t.y)) return;
      this.joyId = t.id;
      this.joyBase = { x: t.x, y: t.y };
      this.joyCur = { x: t.x, y: t.y };
    } else if (kind === 'move') {
      const t = touches.find((x) => x.id === this.joyId);
      if (t) this.joyCur = { x: t.x, y: t.y };
    } else {
      if (touches.some((x) => x.id === this.joyId) || game.dialogs.length) {
        this.joyId = null;
      }
    }
  }

  private joyVector(): [number, number] {
    const u = game.ui.u;
    let mx = 0, my = 0;
    if (this.joyId !== null) {
      const dx = this.joyCur.x - this.joyBase.x, dy = this.joyCur.y - this.joyBase.y;
      const maxR = 90 * u;
      const d = Math.hypot(dx, dy);
      if (d > maxR) {
        // 底座跟随手指，避免拖出范围后方向迟钝
        this.joyBase.x = this.joyCur.x - (dx / d) * maxR;
        this.joyBase.y = this.joyCur.y - (dy / d) * maxR;
      }
      if (d > 6 * u) { mx = dx / Math.max(d, maxR * 0.35); my = dy / Math.max(d, maxR * 0.35); }
    }
    const keys = (typeof window !== 'undefined' && (window as any).__keys) || null;
    if (keys) {
      if (keys['a'] || keys['arrowleft']) mx -= 1;
      if (keys['d'] || keys['arrowright']) mx += 1;
      if (keys['w'] || keys['arrowup']) my -= 1;
      if (keys['s'] || keys['arrowdown']) my += 1;
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    return [mx, my];
  }

  update(dt: number) {
    const b = this.battle;
    const ui = game.ui;
    const blocked = game.dialogs.length > 0 || this.paused;
    if (blocked) this.joyId = null;
    if (!blocked) {
      const [mx, my] = this.joyVector();
      b.moveX = mx;
      b.moveY = my;
      // 调试加速：拆成多个小步长，保证碰撞稳定
      for (let i = 0; i < DEBUG.speed && !b.dead && !b.won; i++) b.update(dt);
      save.stats.playSec += dt;
      this.tutorialT += dt;
    }

    // 待处理事件：升级 / 宝箱 / 死亡 / 胜利
    if (!game.dialogs.length) {
      if (b.won) {
        this.wonT += dt;
        if (this.wonT > 2.2 && !this.resultShown) { this.resultShown = true; this.finish(true); }
      } else if (b.dead) {
        if (!this.reviveShown) {
          this.reviveShown = true;
          game.openDialog(new ReviveDialog(this));
        }
      } else if (b.pendingChests.length) {
        const c = b.pendingChests.shift()!;
        game.openDialog(new ChestDialog(this, b.rollChest(c.boss)));
      } else if (b.pendingLevelUps > 0) {
        b.pendingLevelUps--;
        const choices = b.rollChoices();
        if (choices.every((c) => c.kind === 'heal' || c.kind === 'gold')) {
          // 技能全满：自动领取，避免频繁打断
          b.applyChoice(b.player.hp < b.player.maxHp * 0.6 ? { kind: 'heal' } : { kind: 'gold' });
          this.autoGoldT = 1;
        } else {
          playSfx('levelup');
          game.openDialog(new LevelUpDialog(this, choices));
        }
      }
    }

    // 绘制世界
    this.renderer.render(b, blocked ? 0 : dt, game.ctx);
    this.drawWorldTexts();
    this.drawVignette();
    this.drawHud(dt);
    if (!blocked) this.drawJoystick();
  }

  /** 选择技能后调用 */
  choose(c: Choice) {
    this.battle.applyChoice(c);
    if (c.kind === 'evo') { playSfx('evolve'); vibrate(true); }
  }

  revive() {
    this.battle.revive();
    this.reviveShown = false;
  }

  /** 结算 */
  finish(win: boolean) {
    const b = this.battle;
    playBgm(null);
    playSfx(win ? 'victory' : 'defeat');
    save.stats.runs++;
    save.stats.kills += b.kills;
    save.stats.bossKills += b.bossKills;
    if (win) save.stats.wins++;
    const best = save.chapterBest[this.chapter.id] || 0;
    if (b.t > best) save.chapterBest[this.chapter.id] = Math.min(this.chapter.duration, Math.floor(b.t));
    markDirty();
    flushSave(true);
    game.openDialog(new ResultDialog(this, win));
  }

  // —— HUD ——
  private drawHud(dt: number) {
    const ui = game.ui;
    const u = ui.u;
    const b = this.battle;
    const top = ui.safeTop + 8 * u;
    // 经验条
    const bw = ui.W - 32 * u;
    ui.bar(16 * u, top, bw, 30 * u, b.exp / b.expNeed, '#2ce8f5', '#1a2236');
    ui.text('Lv.' + b.level, 30 * u, top + 15 * u, 22, '#fff', 'left');
    // 计时
    const remain = b.finalBoss ? 0 : this.chapter.duration - b.t;
    ui.text(b.finalBoss ? '击败敌将' : fmtTime(Math.max(0, remain)), ui.W / 2, top + 70 * u, 40, b.finalBoss ? C.red : '#fff');
    ui.text(`第${this.chapter.id}章 ${this.chapter.name}`, ui.W / 2, top + 108 * u, 20, C.textDim);
    // 击杀与金币
    ui.icon('skull', 36 * u, top + 62 * u, 32 * u);
    ui.text(fmtNum(b.kills), 60 * u, top + 62 * u, 26, '#fff', 'left');
    ui.icon('gold', 36 * u, top + 100 * u, 30 * u);
    ui.text(fmtNum(b.coins), 60 * u, top + 100 * u, 26, C.gold, 'left');
    // 暂停
    const ps = 76 * u;
    const px = ui.W - ps - 16 * u, py = top + 46 * u;
    if (ui.clicked('pause', px, py, ps, ps)) game.openDialog(new PauseDialog(this));
    ui.panel(px, py, ps, ps, 'dark');
    ui.icon('pause', px + ps / 2, py + ps / 2, 30 * u);

    // 已拥有技能
    let ix = 18 * u;
    const iy = top + 136 * u;
    const isz = 44 * u;
    for (const w of b.weapons) {
      ui.qualityFrame(ix, iy, isz, w.evo ? '#feae34' : '#5a6988');
      ui.icon(w.evo ? WEAPONS[w.id].evoIcon : WEAPONS[w.id].icon, ix + isz / 2, iy + isz / 2, isz * 0.7);
      if (!w.evo) ui.text(String(w.lv), ix + isz - 6 * u, iy + isz - 8 * u, 16, '#fff', 'center');
      ix += isz + 4 * u;
    }
    ix = 18 * u;
    for (const pz of b.passives) {
      ui.qualityFrame(ix, iy + isz + 4 * u, isz * 0.8, '#3a4466');
      ui.icon(PASSIVES[pz.id].icon, ix + isz * 0.4, iy + isz + 4 * u + isz * 0.4, isz * 0.55);
      ui.text(String(pz.lv), ix + isz * 0.8 - 5 * u, iy + isz * 1.8 - 4 * u, 14, '#fff', 'center');
      ix += isz * 0.8 + 4 * u;
    }

    // 首领血条
    const boss = b.finalBoss || b.midBoss;
    if (boss && this.bossBar) {
      const y = top + 250 * u;
      const w = ui.W * 0.8;
      ui.text(`${boss.boss!.title} · ${boss.boss!.name}`, ui.W / 2, y - 22 * u, 26, '#ffd0d0');
      ui.bar(ui.W / 2 - w / 2, y, w, 26 * u, boss.hp / boss.maxHp, '#e43b44', '#3a0d12');
      ui.text(`${Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100))}%`, ui.W / 2, y + 13 * u, 18, '#fff');
    }

    // 横幅提示
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const bn = this.banners[i];
      bn.t += game.dialogs.length ? 0 : dt;
      if (bn.t > 2.4) { this.banners.splice(i, 1); continue; }
    }
    const bn = this.banners[0];
    if (bn) {
      const k = bn.t;
      const a = k < 0.25 ? k / 0.25 : k > 2 ? (2.4 - k) / 0.4 : 1;
      const y = ui.H * 0.3;
      ui.ctx.globalAlpha = clamp(a, 0, 1);
      ui.ctx.fillStyle = 'rgba(10,6,8,0.6)';
      ui.ctx.fillRect(0, y - 40 * u, ui.W, 80 * u);
      ui.ctx.fillStyle = bn.color;
      ui.ctx.fillRect(0, y - 40 * u, ui.W, 3 * u);
      ui.ctx.fillRect(0, y + 37 * u, ui.W, 3 * u);
      ui.text(bn.text, ui.W / 2 + (1 - Math.min(1, k * 4)) * 60 * u, y, 40, bn.color);
      ui.ctx.globalAlpha = 1;
    }

    if (this.autoGoldT > 0) {
      this.autoGoldT -= dt;
      ui.text('技能已全部满级 · 金币+30', ui.W / 2, ui.H * 0.62, 24, C.gold);
    }

    // 新手提示
    if (save.guide === 0 && this.tutorialT < 9 && !game.dialogs.length) {
      guideHint(ui, this.tutorialT < 4.5 ? '按住屏幕任意位置拖动，控制赵云移动' : '赵云会自动攻击，拾取蓝色宝石升级', ui.H * 0.72);
    }
  }

  private drawWorldTexts() {
    const ui = game.ui;
    for (const f of this.battle.fx) {
      if (f.kind !== 'text') continue;
      const [sx, sy] = this.renderer.worldToScreen(f.x, f.y);
      const k = f.t / f.dur;
      ui.ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      ui.text(f.text!, clamp(sx, ui.W * 0.3, ui.W * 0.7), sy - k * 30 * ui.u, 26, f.color || '#fff');
      ui.ctx.globalAlpha = 1;
    }
  }

  private drawVignette() {
    const ui = game.ui;
    const g = ui.ctx;
    const b = this.battle;
    const low = b.player.hp < b.player.maxHp * 0.3;
    const grad = g.createRadialGradient(ui.W / 2, ui.H / 2, Math.min(ui.W, ui.H) * 0.45, ui.W / 2, ui.H / 2, Math.max(ui.W, ui.H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, low ? `rgba(160,10,20,${0.45 + 0.15 * Math.sin(b.t * 6)})` : 'rgba(10,6,16,0.45)');
    g.fillStyle = grad;
    g.fillRect(0, 0, ui.W, ui.H);
  }

  private drawJoystick() {
    if (this.joyId === null) return;
    const g = game.ui.ctx;
    const u = game.ui.u;
    g.globalAlpha = 0.35;
    g.fillStyle = '#000';
    g.beginPath(); g.arc(this.joyBase.x, this.joyBase.y, 90 * u, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.5;
    g.strokeStyle = '#fff';
    g.lineWidth = 4 * u;
    g.beginPath(); g.arc(this.joyBase.x, this.joyBase.y, 90 * u, 0, Math.PI * 2); g.stroke();
    const dx = this.joyCur.x - this.joyBase.x, dy = this.joyCur.y - this.joyBase.y;
    const d = Math.hypot(dx, dy), maxR = 90 * u;
    const k = d > maxR ? maxR / d : 1;
    g.globalAlpha = 0.85;
    g.fillStyle = '#ead4aa';
    g.beginPath(); g.arc(this.joyBase.x + dx * k, this.joyBase.y + dy * k, 40 * u, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
}

export function choiceInfo(c: Choice): { icon: string; name: string; desc: string; lv: number; max: number; isNew: boolean; evo: boolean } {
  switch (c.kind) {
    case 'weapon': {
      const d = WEAPONS[c.id];
      return { icon: d.icon, name: d.name, desc: c.isNew ? d.intro : d.levels[c.lv - 1].desc, lv: c.lv, max: MAX_WEAPON_LV, isNew: c.isNew, evo: false };
    }
    case 'passive': {
      const d = PASSIVES[c.id];
      return { icon: d.icon, name: d.name, desc: d.desc, lv: c.lv, max: MAX_PASSIVE_LV, isNew: c.isNew, evo: false };
    }
    case 'evo': {
      const d = WEAPONS[c.id];
      return { icon: d.evoIcon, name: d.evoName, desc: d.evo.desc, lv: 0, max: 0, isNew: false, evo: true };
    }
    case 'heal':
      return { icon: 'bun', name: '肉包子', desc: '回复30%生命', lv: 0, max: 0, isNew: false, evo: false };
    case 'gold':
      return { icon: 'gold', name: '军饷', desc: '获得30金币', lv: 0, max: 0, isNew: false, evo: false };
  }
}

export { fmtNum, UI };
