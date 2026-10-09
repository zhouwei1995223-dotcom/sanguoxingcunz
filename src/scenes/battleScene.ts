import { game, Scene } from '../game';
import { getPlatform } from '../platform';
import type { TouchKind, TouchPoint } from '../platform/types';
import { Battle, Choice } from '../battle/battle';
import { WorldRenderer } from '../battle/render';
import { resetSpawner } from '../battle/spawner';
import { CHAPTERS, ChapterDef, DIFFICULTIES, DifficultyDef, ENDLESS } from '../data/chapters';
import { THEMES } from '../gfx/art/env';
import { endlessHpMul, endlessDmgMul } from '../meta/run';
import { currentWeekly, recordCodex, heroSpriteName } from '../meta/goals';
import { WeeklyDef, WEEKLY_DURATION } from '../data/goals';
import { setFirstBoss } from '../battle/spawner';
import type { WeaponId } from '../data/skills';
import { WEAPONS, PASSIVES, MAX_WEAPON_LV, MAX_PASSIVE_LV } from '../data/skills';
import { BossDef } from '../data/enemies';
import { computeStats } from '../meta/ops';
import { save, markDirty, flushSave } from '../meta/save';
import { playBgm, playSfx, vibrate, Sfx } from '../audio/sound';
import { C, UI } from '../ui/ui';
import { fmtTime, fmtNum, clamp } from '../core/math';
import { LevelUpDialog, ChestDialog, PauseDialog, ReviveDialog, ResultDialog, BossIntroDialog } from './battleDialogs';
import { guideHint } from '../ui/guide';
import { progressTask } from '../meta/ops';
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

  diff: DifficultyDef;

  /** chapterId 为 0 表示无尽模式 */
  /** 每周挑战规则（每周挑战模式下有值） */
  weekly: WeeklyDef | null = null;
  private speedMul = 1;
  videoPath: Promise<string | null> | null = null;

  /** chapterId：0 为无尽模式，-1 为每周挑战 */
  constructor(chapterId: number, diff = 0) {
    const themes = Object.keys(THEMES);
    if (chapterId === 0) {
      this.chapter = { ...ENDLESS, theme: themes[(Math.random() * themes.length) | 0] };
    } else if (chapterId === -1) {
      this.weekly = currentWeekly();
      this.chapter = { ...ENDLESS, id: -1, name: '每周挑战', duration: WEEKLY_DURATION, theme: themes[(Math.random() * themes.length) | 0] };
      this.speedMul = this.weekly.gameSpeed || 1;
    } else this.chapter = CHAPTERS[chapterId - 1];
    this.diff = DIFFICULTIES[diff] || DIFFICULTIES[0];
  }

  enter() {
    const p = getPlatform();
    resetSpawner();
    this.renderer = new WorldRenderer(p.width, p.height, this.chapter.theme);
    const stats = computeStats();
    if (this.weekly?.playerHp) stats.hp = Math.max(1, Math.round(stats.hp * this.weekly.playerHp));
    this.battle = new Battle(this.chapter, stats, this.renderer.w, this.renderer.h);
    if (this.weekly) {
      this.battle.mods = this.weekly;
      if (this.weekly.enemyHp) this.battle.enemyHpMul *= this.weekly.enemyHp;
      if (this.weekly.bossEvery) setFirstBoss(this.weekly.bossEvery);
      if (this.weekly.bonusWeapon && !this.battle.weapon(this.weekly.bonusWeapon as WeaponId)) {
        this.battle.addWeapon(this.weekly.bonusWeapon as WeaponId);
        this.battle.weapon(this.weekly.bonusWeapon as WeaponId)!.lv = 3;
      }
      this.battle.recalc();
    }
    this.battle.heroSpriteName = heroSpriteName(save.hero);
    // 抖音录屏：整局录制，精彩时刻打点剪辑
    getPlatform().recorderStart();
    getPlatform().report('battle_start', { mode: this.modeName, chapter: this.chapter.id, diff: this.diff.id, hero: save.hero });
    // 新手教学局降低难度
    if (save.guide === 0) { this.battle.enemyHpMul = 0.75; this.battle.enemyDmgMul = 0.6; }
    this.battle.enemyHpMul *= this.diff.hp;
    this.battle.enemyDmgMul *= this.diff.dmg;
    // 无尽模式的敌人强度跟随玩家的章节进度
    if (this.chapter.endless) { this.battle.enemyHpMul *= endlessHpMul(); this.battle.enemyDmgMul *= endlessDmgMul(); }
    this.battle.showDamage = save.settings.dmgNum;
    this.battle.hooks = {
      sfx: (n) => playSfx(n as Sfx),
      shake: (pw) => { this.renderer.shake = Math.max(this.renderer.shake, pw); },
      banner: (text, color) => this.banners.push({ text, color: color || C.gold, t: 0 }),
      vibrate: (l) => vibrate(l),
      bossAppear: (d: BossDef) => this.onBoss(d),
    };
    playBgm('bgm_battle');
    this.banners.push({ text: this.label, color: this.chapter.endless ? '#ff8a80' : this.diff.color, t: 0 });
  }

  /** 切到后台时自动暂停 */
  onHide() {
    const b = this.battle;
    if (!game.dialogs.length && !b.dead && !b.won) game.openDialog(new PauseDialog(this));
  }

  private onBoss(d: BossDef) {
    playSfx('boss');
    vibrate(true);
    getPlatform().recorderMark();
    this.bossBar = { name: d.name, title: d.title };
    if (this.battle.finalBoss) playBgm('bgm_boss');
    game.openDialog(new BossIntroDialog(d, !!this.battle.finalBoss));
  }

  onTouch(kind: TouchKind, touches: TouchPoint[]) {
    if (kind === 'start') {
      if (game.dialogs.length) return;
      const t = touches[0];
      // 另一根手指正在摇杆上时，界面层收不到这次按下，大招按钮在这里直接响应
      if (this.joyId !== null) {
        const ub = this.ultBtn;
        if (ub && Math.hypot(t.x - ub.x, t.y - ub.y) < ub.r * 1.1) this.pressUlt();
        return;
      }
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
      // 顿帧：命中瞬间画面停一下，增强打击感
      if (b.hitStop > 0) b.hitStop -= dt;
      else for (let i = 0; i < DEBUG.speed && !b.dead && !b.won; i++) b.update(dt * this.speedMul);
      const keys = (typeof window !== 'undefined' && (window as any).__keys) || null;
      if (keys && keys[' ']) this.tryUlt();
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
      } else if (b.ult) {
        // 大招期间不弹窗，结束后再处理升级与宝箱
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

  get label(): string {
    if (this.weekly) return `每周挑战 · ${this.weekly.name}`;
    if (this.chapter.endless) return '无尽战场';
    return `第${this.chapter.id}章 ${this.chapter.name}${this.diff.id ? ' · ' + this.diff.name : ''}`;
  }

  /** 选择技能后调用 */
  choose(c: Choice) {
    this.battle.applyChoice(c);
    if (c.kind === 'evo') { playSfx('evolve'); vibrate(true); getPlatform().recorderMark(); }
  }

  revive() {
    this.battle.revive();
    this.reviveShown = false;
  }

  /** 结算 */
  get modeName(): string {
    return this.weekly ? 'weekly' : this.chapter.endless ? 'endless' : 'chapter';
  }

  finish(win: boolean) {
    const b = this.battle;
    playBgm(null);
    playSfx(win ? 'victory' : 'defeat');
    save.stats.runs++;
    save.stats.kills += b.kills;
    save.stats.bossKills += b.bossKills;
    save.stats.ults += b.ultCasts;
    save.stats.evos += b.evolved.length;
    save.stats.bestCombo = Math.max(save.stats.bestCombo, b.bestCombo);
    if (win) save.stats.wins++;
    recordCodex(b.killsBy, b.bossesKilled, b.evolved);
    getPlatform().report('battle_end', {
      mode: this.modeName, chapter: this.chapter.id, diff: this.diff.id, hero: save.hero,
      win: win ? 1 : 0, sec: Math.floor(b.t), kills: b.kills, level: b.level,
    });
    this.videoPath = getPlatform().recorderStop();
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
    if (this.weekly) {
      ui.text(fmtTime(Math.max(0, this.chapter.duration - b.t)), ui.W / 2, top + 70 * u, 40, '#fff');
      ui.text(`每周挑战 · ${this.weekly.name} · 最佳 ${save.weekly.best}`, ui.W / 2, top + 108 * u, 20, '#dc9be9');
    } else if (this.chapter.endless) {
      // 无尽模式：正计时，显示最佳记录
      ui.text(fmtTime(b.t), ui.W / 2, top + 70 * u, 40, b.t > save.endlessBest && save.endlessBest > 0 ? C.gold : '#fff');
      ui.text(`无尽战场 · 最佳 ${fmtTime(save.endlessBest)}`, ui.W / 2, top + 108 * u, 20, C.textDim);
    } else {
      const remain = b.finalBoss ? 0 : this.chapter.duration - b.t;
      ui.text(b.finalBoss ? '击败敌将' : fmtTime(Math.max(0, remain)), ui.W / 2, top + 70 * u, 40, b.finalBoss ? C.red : '#fff');
      ui.text(this.label, ui.W / 2, top + 108 * u, 20, this.diff.id ? this.diff.color : C.textDim);
    }
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

    this.drawOffscreenArrows();
    this.drawCombo(dt);
    this.drawUltButton();

    // 新手提示
    if (save.guide === 0 && this.tutorialT < 9 && !game.dialogs.length) {
      guideHint(ui, this.tutorialT < 4.5 ? '按住屏幕任意位置拖动，控制赵云移动' : '赵云会自动攻击，拾取蓝色宝石升级', ui.H * 0.72);
    }
  }

  private ultBtn: { x: number; y: number; r: number } | null = null;

  private pressUlt() {
    const b = this.battle;
    if (b.rageFull && !b.ult) this.tryUlt();
    else game.ui.toast(b.rageLock > 0 ? '大招恢复中' : '击败敌人积攒怒气');
  }

  private comboPulse = 0;
  private lastCombo = 0;

  private tryUlt() {
    const b = this.battle;
    if (b.castUlt()) { this.renderer.shake = Math.max(this.renderer.shake, 4); getPlatform().recorderMark(); }
  }

  /** 大招按钮：怒气环 + 满怒发光；未满时可看视频充满 */
  private drawUltButton() {
    const ui = game.ui;
    const u = ui.u;
    const b = this.battle;
    const g = ui.ctx;
    const r = 78 * u;
    // 默认放左下角：右手拇指控制移动时不会挡住（设置里可换到右边）
    const right = save.settings.ultRight;
    const cx = right ? ui.W - r - 34 * u : r + 34 * u, cy = ui.H - r - 120 * u - ui.safeBottom;
    this.ultBtn = { x: cx, y: cy, r };
    const full = b.rageFull && !b.ult;
    const ratio = b.rageLock > 0 ? 0 : b.rage / 100;
    // 底盘
    if (full) {
      const glow = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.6);
      glow.addColorStop(0, 'rgba(254,231,97,0.55)');
      glow.addColorStop(1, 'rgba(254,231,97,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(cx, cy, r * (1.5 + 0.1 * Math.sin(ui.time * 8)), 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(12,8,16,0.75)';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = 10 * u;
    g.strokeStyle = '#3a2c2a';
    g.beginPath(); g.arc(cx, cy, r - 6 * u, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = full ? '#fee761' : b.rageLock > 0 ? '#5a6988' : '#e43b44';
    g.beginPath(); g.arc(cx, cy, r - 6 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (full ? 1 : ratio)); g.stroke();
    const pulse = full ? 1 + 0.08 * Math.sin(ui.time * 10) : 1;
    ui.icon(WEAPONS[b.hero.weapon].evoIcon, cx, cy - 10 * u, r * 1.05 * pulse, full ? 1 : 0.45);
    if (full) ui.text(b.hero.ultName.split('·')[0], cx, cy + r * 0.55, 28, '#fee761', 'center', '#3a0d12');
    else if (b.rageLock > 0) ui.text(`${Math.ceil(b.rageLock)}s`, cx, cy + r * 0.55, 24, '#c0cbdc');
    else ui.text(`${Math.floor(ratio * 100)}%`, cx, cy + r * 0.55, 24, '#fff');
    if (ui.clicked('ult_btn', cx - r, cy - r, r * 2, r * 2, false)) this.pressUlt();
    // 看视频充满怒气（每局 2 次）
    if (!full && !b.ult && b.adRageUsed < 2) {
      const bw = 150 * u, bh = 64 * u;
      if (ui.button('ult_ad', cx - bw / 2, cy - r - bh - 16 * u, bw, bh, '充满', C.btnGreen, { icon: 'video', size: 22 })) {
        getPlatform().showRewardedAd('rage_fill').then((ok) => {
          if (!ok) return;
          b.fillRage();
          progressTask('ad', 1);
        });
      }
    }
    // 首次满怒提示
    if (full && b.ultCasts === 0 && save.stats.runs < 3 && !game.dialogs.length) {
      guideHint(ui, `怒气已满！点击${right ? '右' : '左'}下角释放「${b.hero.ultName}」`, cy - r - 140 * u);
    }
  }

  /** 连斩计数 */
  private drawCombo(dt: number) {
    const ui = game.ui;
    const u = ui.u;
    const b = this.battle;
    if (b.combo !== this.lastCombo) { if (b.combo > this.lastCombo) this.comboPulse = 0.18; this.lastCombo = b.combo; }
    this.comboPulse = Math.max(0, this.comboPulse - dt);
    if (b.combo < 10) return;
    const x = ui.W - 40 * u, y = ui.H * 0.36;
    const s = 1 + this.comboPulse * 2.2;
    const size = Math.min(80, 40 + Math.log10(b.combo) * 14) * s;
    const col = b.combo >= 500 ? '#ff5a5a' : b.combo >= 100 ? '#feae34' : '#fff4d6';
    ui.ctx.globalAlpha = Math.min(1, b.comboT / 0.6);
    ui.text(String(b.combo), x, y, size, col, 'right', '#3a0d12');
    ui.text('连斩', x, y + size * u * 0.75, 26, col, 'right');
    ui.ctx.globalAlpha = 1;
  }

  /** 屏幕外的磁石 / 宝箱 / 包子：在屏幕边缘画箭头 */
  private drawOffscreenArrows() {
    const ui = game.ui;
    const u = ui.u;
    const g = ui.ctx;
    const m = 60 * u;
    const top = ui.safeTop + 260 * u;
    for (const k of this.battle.pickups) {
      if (k.kind !== 'magnet' && k.kind !== 'chest' && k.kind !== 'bun') continue;
      const [sx, sy] = this.renderer.worldToScreen(k.x, k.y);
      if (sx > 0 && sx < ui.W && sy > top && sy < ui.H) continue;
      const cx = ui.W / 2, cy = ui.H / 2;
      const dx = sx - cx, dy = sy - cy;
      const kx = (ui.W / 2 - m) / Math.abs(dx || 1e-6), ky = (ui.H / 2 - m - 140 * u) / Math.abs(dy || 1e-6);
      const kk = Math.min(kx, ky);
      const ax = cx + dx * kk, ay = Math.max(top, cy + dy * kk);
      const a = Math.atan2(dy, dx);
      const bob = Math.sin(ui.time * 6) * 6 * u;
      g.save();
      g.translate(ax + Math.cos(a) * bob, ay + Math.sin(a) * bob);
      g.fillStyle = 'rgba(12,8,16,0.7)';
      g.beginPath(); g.arc(0, 0, 36 * u, 0, Math.PI * 2); g.fill();
      g.rotate(a);
      g.fillStyle = k.kind === 'magnet' ? '#2ce8f5' : '#fee761';
      g.beginPath(); g.moveTo(48 * u, 0); g.lineTo(32 * u, -12 * u); g.lineTo(32 * u, 12 * u); g.closePath(); g.fill();
      g.restore();
      ui.icon(k.kind === 'chest' ? (k.boss ? 'chest_gold' : 'chest') : k.kind, ax + Math.cos(a) * bob, ay + Math.sin(a) * bob, 44 * u);
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
