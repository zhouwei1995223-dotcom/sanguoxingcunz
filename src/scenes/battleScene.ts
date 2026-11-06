import { game, Scene } from '../game';
import { getPlatform } from '../platform';
import type { TouchKind, TouchPoint } from '../platform/types';
import { Battle, Choice } from '../battle/battle';
import { WorldRenderer } from '../battle/render';
import { resetSpawner } from '../battle/spawner';
import { campaignChapter, CHAPTERS, ChapterDef, DIFFICULTIES, DifficultyDef, ENDLESS, TUTORIAL } from '../data/chapters';
import { THEMES } from '../gfx/art/env';
import { endlessHpMul, endlessDmgMul, legacyChapterPower, convoyReward } from '../meta/run';
import { currentWeekly, recordCodex, heroSpriteName, heroIdleFrame } from '../meta/goals';
import { WeeklyDef, WEEKLY_DURATION } from '../data/goals';
import { setFirstBoss } from '../battle/spawner';
import type { SkillId, WeaponId } from '../data/skills';
import { WEAPONS, PASSIVES, SKILLS_BY_ID, MAX_WEAPON_LV, passiveMax, weaponLink, fitPreparation, coreWeaponFits } from '../data/skills';
import type { QiyuId } from '../data/qiyu';
import { BossDef } from '../data/enemies';
import { STRAT_BY_ID, TIER_COLORS } from '../data/strategies';
import { computeStats, combatPower } from '../meta/ops';
import { save, markDirty, flushSave, activePreparationFor } from '../meta/save';
import { playBgm, playSfx, vibrate, Sfx } from '../audio/sound';
import { C, UI } from '../ui/ui';
import { fmtTime, fmtNum, clamp } from '../core/math';
import { LevelUpDialog, PauseDialog, ReviveDialog, ResultDialog, BossIntroDialog, StrategyDialog, RushConfirmDialog, QiyuDialog } from './battleDialogs';
import { EvoTableDialog } from './evoTableDialog';
import { guideHint } from '../ui/guide';
import { progressTask } from '../meta/ops';
import { DEBUG } from '../debug';
import { funnel } from '../meta/telemetry';
import { IS_WEB, NO_ADS } from '../data/platformConfig';
import { HEROES } from '../data/heroes';
import { heroBase } from '../meta/ops';
import { createDefense, HeroInfo, grainRate, nextAutoUnit, soldiers, buildStepText } from '../battle/defense';
import { UNITS, MAX_ALLIES, BUILDS, BUILD_CARD_MAX, REPAIR_PCT, HERO_SUMMON_TIME } from '../data/defense';
import { ORDERS, LINKS, defenseChapter } from '../data/defense';

export class BattleScene implements Scene {
  readonly preserveTextColors = true;
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
  // 一次性提示：第一次遇到某个系统时在屏幕下方显示几秒
  private tipQueue: string[] = [];
  private tipText = '';
  private tipT = 0;
  private tipCheckT = 0;
  private autoGoldT = 0;
  private runAutoPick = false;
  private preparedSkills: SkillId[] = [];
  unavailablePreparedNames: string[] = [];
  skipPreparedPrompts = false;
  paused = false;

  get autoPick() { return IS_WEB ? this.runAutoPick : save.settings.autoPick; }
  set autoPick(on: boolean) {
    if (IS_WEB) this.runAutoPick = on;
    else { save.settings.autoPick = on; markDirty(); }
  }

  get hasPreparation() { return this.preparedSkills.length > 0; }

  preparedMatch(choices: Choice[]): Choice | undefined {
    for (const id of this.preparedSkills) {
      const match = choices.find(c => (c.kind === 'weapon' || c.kind === 'evo' || c.kind === 'passive') && c.id === id);
      if (match) return match;
    }
    return undefined;
  }

  autoChooseUpgrade(choices: Choice[]): boolean {
    if (!this.autoPick || (!IS_WEB && save.guide === 0)) return false;
    const b = this.battle;
    const pick = this.hasPreparation ? this.preparedMatch(choices) : choices[b.recommend(choices)];
    if (!pick) return false;
    this.choose(pick);
    const prefix = this.hasPreparation ? '备战 · ' : '升级 · ';
    this.floatLines([{ text: prefix + this.choiceLine(pick), color: pick.kind === 'evo' || pick.kind === 'link' ? '#fee761' : '#b6f5a0' }]);
    return true;
  }

  diff: DifficultyDef;

  /** chapterId 为 0 表示无尽模式 */
  /** 每周挑战规则（每周挑战模式下有值） */
  weekly: WeeklyDef | null = null;
  private speedMul = 1;
  private normalSpeed: 1 | 1.5 = 1;
  private doubleSpeedUnlocked = false;
  private doubleSpeedActive = false;
  private speedAdPending = false;
  private get userSpeed() { return this.doubleSpeedActive ? 2 : this.normalSpeed; }
  private speedAcc = 0;
  videoPath: Promise<string | null> | null = null;

  /** chapterId：0 为无尽模式，-1 为每周挑战，-2 为新手试炼，-3 为守城模式 */
  constructor(chapterId: number, diff = 0, minutes: 5 | 10 = 5) {
    const themes = Object.keys(THEMES);
    if (chapterId === -3) {
      // 守城：第二个参数是关卡（1~10），没有难度
      this.chapter = defenseChapter(diff || 1);
      diff = 0;
    } else if (chapterId === -2) {
      this.chapter = TUTORIAL;
    } else if (chapterId === 0) {
      this.chapter = { ...ENDLESS, theme: themes[(Math.random() * themes.length) | 0] };
    } else if (chapterId === -1) {
      this.weekly = currentWeekly();
      this.chapter = { ...ENDLESS, id: -1, name: '每周挑战', duration: WEEKLY_DURATION, theme: themes[(Math.random() * themes.length) | 0] };
      this.speedMul = this.weekly.gameSpeed || 1;
    } else this.chapter = IS_WEB ? campaignChapter(chapterId, minutes) : CHAPTERS[chapterId - 1];
    this.diff = DIFFICULTIES[diff] || DIFFICULTIES[0];
  }

  enter() {
    const p = getPlatform();
    resetSpawner();
    this.renderer = new WorldRenderer(p.width, p.height, this.chapter.theme);
    const stats = computeStats();
    if (this.weekly?.playerHp) stats.hp = Math.max(1, Math.round(stats.hp * this.weekly.playerHp));
    this.battle = new Battle(this.chapter, stats, this.renderer.w, this.renderer.h);
    infoHero = this.battle.hero.id;
    infoBattle = this.battle;
    // 敌将血量跟玩家战力挂钩：战力 ÷ 推荐战力
    if (!IS_WEB && !this.chapter.endless && !this.chapter.tutorial && !this.chapter.defense) this.battle.powerRatio = combatPower(stats) / Math.max(1, legacyChapterPower(this.chapter, this.diff));
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
    if (save.stats.runs === 0) funnel('b1_start');
    else if (save.stats.runs === 1) funnel('b2_start');
    getPlatform().report('battle_start', { mode: this.modeName, chapter: this.chapter.id, diff: this.diff.id, hero: save.hero });
    // 新手教学局降低难度
    if (save.guide === 0) { this.battle.enemyHpMul = 0.75; this.battle.enemyDmgMul = 0.6; }
    this.battle.enemyHpMul *= this.diff.hp;
    this.battle.enemyDmgMul *= this.diff.dmg;
    // 无尽模式的敌人强度跟随玩家的章节进度
    if (this.chapter.endless) { this.battle.enemyHpMul *= endlessHpMul(); this.battle.enemyDmgMul *= endlessDmgMul(); }
    // 守城：城池、粮草、可召唤的武将（强度按各自的等级 / 星级 / 巅峰等级）
    if (this.chapter.defense) {
      const heroes: Record<string, HeroInfo> = {};
      for (const h of HEROES) if (save.heroes[h.id]?.owned) { const hb = heroBase(h.id); heroes[h.id] = { atk: hb.atk, hp: hb.hp, name: h.name, ultName: h.ultName.split('·')[0], sprite: heroSpriteName(h.id) }; }
      this.battle.def = createDefense(this.battle, heroes);
      this.renderer.clearCenter = true;
    }
    this.battle.showDamage = save.settings.dmgNum;
    if (IS_WEB && !this.chapter.tutorial) {
      const b = this.battle, plan = activePreparationFor(b.hero.id);
      this.unavailablePreparedNames = this.fitRunPreparation(plan.skills);
      if (plan.core) {
        if (coreWeaponFits(plan.core, b.skillPool, !!b.def)) b.coreWeapon = plan.core;
        else {
          const name = WEAPONS[plan.core].name;
          this.unavailablePreparedNames = this.unavailablePreparedNames.filter(n => n !== name);
          this.unavailablePreparedNames.push('核心武器' + name);
        }
      }
      this.runAutoPick = this.hasPreparation;
    }
    this.battle.hooks = {
      sfx: (n) => playSfx(n as Sfx),
      shake: (pw) => { if (save.settings.screenShake) this.renderer.shake = Math.max(this.renderer.shake, pw * 0.7); },
      banner: (text, color) => this.banners.push({ text, color: color || C.gold, t: 0 }),
      vibrate: (l) => vibrate(l),
      bossAppear: (d: BossDef) => this.onBoss(d),
      convoyCaptured: () => {
        const reward = convoyReward(this.chapter, this.diff);
        this.floatLines([
          { text: '粮车已截获 · 通关可领', color: '#fee761' },
          { text: `军饷 ${reward.gold} · 元宝 ${reward.yuanbao}`, color: '#fee761' },
        ]);
      },
      ultCast: () => { this.cutIn = 0; },
    };
    playBgm('bgm_battle');
    this.banners.push({ text: this.label, color: this.chapter.endless ? '#ff8a80' : this.diff.color, t: 0 });
    // 开局奇遇（新手试炼没有）
    if (!this.chapter.tutorial) game.openDialog(new QiyuDialog(this));
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
    if (this.speedAdPending) return;
    if (kind === 'start') {
      if (game.dialogs.length) return;
      const t = touches[0];
      // 另一根手指正在摇杆上时，界面层收不到这次按下，大招按钮在这里直接响应
      if (this.joyId !== null) {
        const ub = this.ultBtn;
        if (ub && Math.hypot(t.x - ub.x, t.y - ub.y) < ub.r * 1.1) this.pressUlt();
        const pb = this.potionBtn;
        if (pb && Math.hypot(t.x - pb.x, t.y - pb.y) < pb.r * 1.15) this.pressPotion();
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
    const blocked = game.dialogs.length > 0 || this.paused || this.speedAdPending;
    if (blocked) this.joyId = null;
    if (!blocked) {
      const [mx, my] = this.joyVector();
      b.moveX = mx;
      b.moveY = my;
      // 调试加速：拆成多个小步长，保证碰撞稳定
      // 顿帧：命中瞬间画面停一下，增强打击感
      if (b.hitStop > 0) b.hitStop -= dt;
      // 倍速按完整的小步运行，保持碰撞和预警计时一致。
      else {
        this.speedAcc += this.userSpeed;
        const steps = Math.floor(this.speedAcc);
        this.speedAcc -= steps;
        for (let i = 0; i < DEBUG.speed * steps && !b.dead && !b.won; i++) b.update(dt * this.speedMul);
      }
      const keys = (typeof window !== 'undefined' && (window as any).__keys) || null;
      if (keys && keys[' ']) this.tryUlt();
      if (keys && keys['q'] && b.potionCd <= 0) this.pressPotion();
      save.stats.playSec += dt;
      if (save.stats.runs === 0 && b.t >= 45) funnel('b1_45s');
      this.tutorialT += dt;
      this.adaptDensity(dt);
      this.checkTips(dt);
    }

    // 待处理事件：升级 / 宝箱 / 死亡 / 胜利
    if (!game.dialogs.length && !this.speedAdPending) {
      if (b.won) {
        this.wonT += dt;
        if (this.wonT > 2.2) this.finish(true);
      } else if (b.bossTimedOut) {
        this.finish(false);
      } else if (b.dead) {
        if (!this.reviveShown) {
          this.reviveShown = true;
          game.openDialog(new ReviveDialog(this));
        }
      } else if (b.ult) {
        // 大招期间不弹窗，结束后再处理升级与宝箱
      } else if (b.pendingStrats.length) {
        const st = b.pendingStrats.shift()!;
        playSfx('chest');
        game.openDialog(new StrategyDialog(this, st.tier, st.round));
      } else if (b.pendingChests.length) {
        const c = b.pendingChests.shift()!;
        this.openChest(b.rollChest(c.boss));
      } else if (b.pendingLevelUps > 0) {
        b.pendingLevelUps--;
        const choices = b.rollChoices();
        if (choices.every((c) => c.kind === 'heal' || c.kind === 'gold')) {
          // 技能全满：自动领取，避免频繁打断
          b.applyChoice(b.player.hp < b.player.maxHp * 0.6 ? { kind: 'heal' } : { kind: 'gold' });
          this.autoGoldT = 1;
        } else {
          playSfx('levelup');
          if (!this.autoChooseUpgrade(choices)) {
            if (save.stats.runs === 0) funnel('b1_levelup');
            game.openDialog(new LevelUpDialog(this, choices));
          }
        }
      }
    }

    // 绘制世界
    this.renderer.render(b, blocked ? 0 : dt, game.ctx);
    this.drawWorldTexts();
    this.drawVignette();
    if (DEBUG.noHud) return;
    this.drawHud(dt);
    if (!blocked) this.drawJoystick();
  }

  /** 第一次遇到时提示；urgent 的立刻顶替当前提示 */
  private tip(id: string, text: string, urgent = false) {
    if (save.tips[id]) return;
    save.tips[id] = true;
    markDirty();
    if (urgent) { if (this.tipText) this.tipQueue.unshift(this.tipText); this.tipText = text; this.tipT = 4; }
    else this.tipQueue.push(text);
  }

  private checkTips(dt: number) {
    const b = this.battle;
    // 新手局开头的操作提示还在显示时先不弹
    if (save.guide === 0 && this.tutorialT < 9) return;
    if (b.warnings.length) this.tip('boss_warn', IS_WEB ? '敌人即将出招，快躲开地上的红色区域！' : '地上的红圈是敌将的技能范围，快躲开！', true);
    this.tipCheckT -= dt;
    if (this.tipCheckT > 0) return;
    this.tipCheckT = 0.5;
    const near = (x: number, y: number) => b.inView(x, y, -30);
    if (b.breakables.some((k) => near(k.x, k.y))) this.tip('breakable', IS_WEB ? '打破路边的灯笼和小推车，可获得补给' : '打破灯笼和粮车，会掉出包子、磁石、震天雷');
    for (const k of b.pickups) {
      if (!near(k.x, k.y)) continue;
      if (k.kind === 'bun') this.tip('pk_bun', '肉包子：拾取后回复30%生命');
      else if (k.kind === 'magnet') this.tip('pk_magnet', '磁石：拾取后吸走全场的经验宝石');
      else if (k.kind === 'bomb') this.tip('pk_bomb', '震天雷：拾取后消灭屏幕内的敌人');
    }
    if (b.enemies.some((e) => e.elite && !e.convoyGuard && !e.dead && near(e.x, e.y))) this.tip('elite', '精英敌人体型更大、更耐打，击败必掉宝箱');
    if (b.evolvable().length) this.tip('evo', '武器已满级且有对应兵法，打开宝箱就能进化神兵！');
  }

  private drawTip(dt: number) {
    const ui = game.ui;
    if (!this.tipText && this.tipQueue.length) { this.tipText = this.tipQueue.shift()!; this.tipT = 3.5; }
    if (!this.tipText) return;
    if (!game.dialogs.length) this.tipT -= dt;
    if (this.tipT <= 0) { this.tipText = ''; return; }
    ui.ctx.globalAlpha = Math.min(1, this.tipT / 0.4);
    guideHint(ui, this.tipText, ui.H * 0.56);
    ui.ctx.globalAlpha = 1;
  }

  private async toggleDoubleSpeed() {
    if (this.speedAdPending || this.paused || game.dialogs.length || this.battle.dead || this.battle.won) return;
    if (!this.doubleSpeedUnlocked) {
      this.speedAdPending = true;
      this.joyId = null;
      try {
        const ok = await getPlatform().showRewardedAd('battle_speed_2x');
        if (game.scene !== this) return;
        if (!ok) { game.ui.toast('看完视频即可解锁本局 2 倍速'); return; }
        this.doubleSpeedUnlocked = true;
        progressTask('ad', 1);
      } catch {
        if (game.scene === this) game.ui.toast('视频暂时无法播放，请再试一次');
        return;
      } finally {
        this.speedAdPending = false;
      }
    }
    this.doubleSpeedActive = !this.doubleSpeedActive;
    game.ui.toast(this.doubleSpeedActive ? '已开启 2 倍速' : `已切回 ${this.normalSpeed} 倍速`);
  }

  get label(): string {
    if (this.weekly) return `每周挑战 · ${this.weekly.name}`;
    if (this.chapter.endless) return '无尽战场';
    if (this.chapter.tutorial) return '新手试炼';
    if (this.chapter.defense) return `守城 · 第${this.chapter.id}关 ${this.chapter.name}`;
    return `第${this.chapter.id}章 ${this.chapter.name}${this.diff.id ? ' · ' + this.diff.name : ''}${this.chapter.campaignMinutes ? ' · ' + this.chapter.campaignMinutes + '分钟' : ''}`;
  }

  /** 测试用：直接打开指定选项的升级弹窗 / 进化表 */
  openLevelUpForTest(choices: Choice[]) { game.openDialog(new LevelUpDialog(this, choices)); }
  openStrategyForTest(tier: 0 | 1 | 2, round = 0) { game.openDialog(new StrategyDialog(this, tier, round)); }
  openRushForTest() { game.openDialog(new RushConfirmDialog(this)); }
  openEvoTableForTest() { game.openDialog(new EvoTableDialog(this.battle)); }
  pauseForTest() { game.openDialog(new PauseDialog(this)); }

  /** 宝箱：不再弹窗，直接领取，获得的东西以文字在武将身边逐行飘出 */
  openChest(rewards: Choice[]) {
    const evo = rewards.some((r) => r.kind === 'evo' || r.kind === 'link');
    playSfx(evo ? 'evolve' : 'chest');
    for (const r of rewards) this.choose(r);
    // 把同一件武器 / 兵法的多次升级合并成一行（显示最终等级）
    const lines: { text: string; color: string }[] = [];
    const seen = new Map<string, number>();
    for (const r of rewards) {
      const key = r.kind + ':' + ('id' in r ? r.id : '');
      const text = this.choiceLine(r);
      const color = r.kind === 'evo' || r.kind === 'link' ? '#fee761' : r.kind === 'weapon' ? '#fff4d6' : r.kind === 'passive' ? '#9fe8ff' : '#ffd08a';
      const at = seen.get(key);
      if (at !== undefined && r.kind !== 'gold' && r.kind !== 'heal') lines[at] = { text, color };
      else { seen.set(key, lines.length); lines.push({ text, color }); }
    }
    this.floatLines([{ text: '开启宝箱', color: '#feae34' }, ...lines]);
  }

  private choiceLine(r: Choice): string {
    const info = choiceInfo(r);
    if (r.kind === 'hero' || r.kind === 'repair') return info.name;
    if (r.kind === 'build') return info.name + (info.isNew ? ' 建成' : ' 强化');
    return r.kind === 'evo' || r.kind === 'link' ? '进化！' + info.name
      : r.kind === 'gold' ? '军饷 +30' : r.kind === 'heal' ? '肉包子 回血'
      : info.name + (info.isNew ? ' 新获得' : ' Lv.' + info.lv);
  }

  /** 在武将身边逐行飘字（接在还没消失的文字下面） */
  private floatLines(lines: { text: string; color: string }[]) {
    const b = this.battle;
    let base = 0;
    for (const f of b.fx) if (f.kind === 'text' && f.line !== undefined && f.t < f.dur * 0.7) base = Math.max(base, f.line + 1);
    if (base > 6) base = 0;
    lines.forEach((l, i) => {
      b.fx.push({ kind: 'text', x: b.player.x, y: b.player.y, t: -i * 0.18, dur: 2.6, text: l.text, color: l.color, line: base + i, real: true });
    });
  }

  /** 选择技能后调用 */
  choose(c: Choice) {
    this.battle.applyChoice(c);
    if ((c.kind === 'weapon' || c.kind === 'passive') && c.isNew && !this.preparedSkills.includes(c.id)) this.checkPreparedSlots();
    if (c.kind === 'evo') { playSfx('evolve'); vibrate(true); getPlatform().recorderMark(); }
  }

  chooseQiyu(id: QiyuId) {
    this.battle.applyQiyu(id);
    if (id === 'shenbing') this.checkPreparedSlots();
  }

  private fitRunPreparation(ids: SkillId[]) {
    const b = this.battle;
    this.preparedSkills = fitPreparation(ids, b.skillPool, b.weapons.map(w => w.id), b.passives.map(p => p.id));
    return ids.filter(id => !this.preparedSkills.includes(id)).map(id => SKILLS_BY_ID[id].name);
  }

  private checkPreparedSlots() {
    if (!this.hasPreparation) return;
    const skipped = this.fitRunPreparation(this.preparedSkills);
    if (skipped.length) {
      if (!this.hasPreparation) this.autoPick = false;
      game.ui.toast('装备占位，本局暂缓：' + skipped.join('、'));
    }
  }

  revive(adRevive = 0) {
    this.battle.revive(adRevive);
    this.reviveShown = false;
  }

  /** 结算 */
  get modeName(): string {
    return this.weekly ? 'weekly' : this.chapter.endless ? 'endless' : this.chapter.defense ? 'defense' : 'chapter';
  }

  finish(win: boolean) {
    if (this.resultShown) return;
    this.resultShown = true;
    const b = this.battle;
    playBgm(null);
    playSfx(win ? 'victory' : 'defeat');
    if (save.stats.runs === 0) funnel('b1_end');
    else if (save.stats.runs === 1) funnel('b2_end');
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
      boss_sec: Math.round(b.statBossSec), revives: b.reviveCount,
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
    const g = ui.ctx;
    const canSpeed = !this.chapter.tutorial && !this.weekly;
    const showDouble = IS_WEB && canSpeed;
    const clockX = ui.W / 2 - (showDouble ? 32 * u : 0);
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
      ui.text(fmtTime(b.t), clockX, top + 70 * u, 40, b.t > save.endlessBest && save.endlessBest > 0 ? C.gold : '#fff');
      ui.text(`无尽战场 · 最佳 ${fmtTime(save.endlessBest)}`, clockX, top + 108 * u, 20, C.textDim);
    } else if (b.def) {
      // 守城：剩余时间 + 城池血条
      const d = b.def;
      ui.text(IS_WEB && b.finalBoss ? '击败攻城主将' : fmtTime(Math.max(0, this.chapter.duration - b.t)), clockX, top + 64 * u, 38, '#fff');
      const cw = ui.W * (showDouble ? 0.35 : 0.44), cx0 = clockX - cw / 2, cy0 = top + 90 * u;
      ui.bar(cx0, cy0, cw, 28 * u, d.cityHp / d.cityMax, d.cityHp < d.cityMax * 0.3 ? '#e43b44' : '#63c74d', '#2a1414');
      if (d.cityFlash > 0) { ui.ctx.globalAlpha = 0.5; ui.pixRect(cx0, cy0, cw, 28 * u, '#ffffff'); ui.ctx.globalAlpha = 1; }
      ui.text(`城池 ${fmtNum(Math.ceil(d.cityHp))}/${fmtNum(d.cityMax)}`, clockX, cy0 + 14 * u, 18, '#fff');
    } else {
      const remain = b.finalBoss ? 0 : this.chapter.duration - b.t;
      const bossTimeLeft = b.finalBossTimeLeft;
      const timer = bossTimeLeft !== null ? '斩将 ' + fmtTime(Math.ceil(bossTimeLeft))
        : b.finalBoss ? '击败敌将' : fmtTime(Math.max(0, remain));
      ui.text(timer, clockX, top + 70 * u, 40, b.finalBoss ? C.red : '#fff');
      ui.text(this.label, clockX, top + 108 * u, 20, this.diff.id ? this.diff.color : C.textDim);
    }
    // 击杀与金币
    ui.icon('kills', 36 * u, top + 62 * u, 32 * u);
    ui.text(fmtNum(b.kills), 60 * u, top + 62 * u, 26, '#fff', 'left');
    ui.icon('gold', 36 * u, top + 100 * u, 30 * u);
    ui.text(fmtNum(b.coins), 60 * u, top + 100 * u, 26, C.gold, 'left');
    // 暂停
    const ps = 76 * u;
    const px = ui.W - ps - 16 * u, py = top + 46 * u;
    if (ui.clicked('pause', px, py, ps, ps)) game.openDialog(new PauseDialog(this));
    ui.panel(px, py, ps, ps, 'dark');
    ui.icon('pause', px + ps / 2, py + ps / 2, 30 * u);
    if (canSpeed) {
      const step = ps + 12 * u, sx = px - (showDouble ? 2 : 1) * step;
      if (ui.clicked('speed', sx, py, ps, ps) && !this.speedAdPending) {
        if (this.doubleSpeedActive) this.doubleSpeedActive = false;
        else this.normalSpeed = this.normalSpeed === 1 ? 1.5 : 1;
        ui.toast(this.normalSpeed === 1.5 ? '已开启 1.5 倍速' : '恢复正常速度');
      }
      ui.panel(sx, py, ps, ps, 'dark');
      ui.text('×' + this.normalSpeed, sx + ps / 2, py + ps / 2, this.normalSpeed === 1.5 ? 24 : 30, this.userSpeed === 1.5 ? C.gold : '#fff');
      if (showDouble) {
        const x = px - step;
        if (ui.clicked('speed2', x, py, ps, ps)) void this.toggleDoubleSpeed();
        ui.panel(x, py, ps, ps, 'dark');
        const cx = x + ps / 2, subY = py + ps * 0.72;
        const hasSubtitle = !this.doubleSpeedUnlocked || this.doubleSpeedActive;
        ui.text('×2', cx, py + ps * (hasSubtitle ? 0.32 : 0.5), 30, this.doubleSpeedActive ? C.gold : '#fff');
        if (!this.doubleSpeedUnlocked) ui.icon('video', cx, subY, 32 * u);
        else if (this.doubleSpeedActive) ui.text('使用中', cx, subY, 17, C.gold);
      }
    }
    // 直取敌将：没有敌将在场时常驻，确认（看一次广告）后跳过小兵直接挑战敌将
    if (b.canRush() && !b.dead && !b.won) {
      // 常驻按钮不再闪动，免得一直晃眼
      const rw = 240 * u, rh = 64 * u, rx = ui.W / 2 - rw / 2, ry = top + 136 * u;
      if (ui.button('rush', rx, ry, rw, rh, '直取敌将 ▶', C.btnRed, { size: 26 })) game.openDialog(new RushConfirmDialog(this));
      this.tip('rush', '中途敌将已败！点「直取敌将」跳过小兵，直接挑战最终敌将（每局一次）');
    }

    // 已获得的锦囊
    b.strats.forEach((id, i) => {
      const d = STRAT_BY_ID[id];
      const ty = py + ps + 24 * u + i * 32 * u;
      const tw = ui.measure(d.name, 20) + 16 * u;
      ui.pixRect(ui.W - 20 * u - tw, ty - 14 * u, tw + 8 * u, 28 * u, 'rgba(10,6,8,0.55)');
      ui.text(d.name, ui.W - 16 * u, ty, 20, TIER_COLORS[d.tier], 'right');
    });

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

    if (b.coreWeapon && this.chestAlertT <= 0) {
      const text = '★ ' + b.coreProgressText();
      const y = iy + 103 * u;
      ui.pixRect(18 * u, y - 14 * u, ui.measure(text, 18) + 16 * u, 28 * u, 'rgba(10,6,8,0.65)');
      ui.text(text, 26 * u, y, 18, '#ffe9a8', 'left');
    }
    // 首领血条
    const boss = b.finalBoss || b.midBoss;
    if (boss && this.bossBar) {
      const y = top + (b.coreWeapon ? 287 : 250) * u;
      const w = ui.W * 0.8;
      ui.text(`${boss.boss!.title} · ${boss.boss!.name}${boss.enraged ? ' · 狂暴' : ''}`, ui.W / 2, y - 22 * u, 26, boss.enraged ? '#ff8a80' : '#ffd0d0');
      ui.bar(ui.W / 2 - w / 2, y, w, 26 * u, boss.hp / boss.maxHp, '#e43b44', '#3a0d12');
      ui.text(`${Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100))}%`, ui.W / 2, y + 13 * u, 18, '#fff');
      if (boss.shield > 0) {
        // 护盾条 + 倒计时
        ui.bar(ui.W / 2 - w / 2, y + 32 * u, w, 18 * u, boss.shield / boss.shieldMax, '#2ce8f5', '#0d2a3a');
        ui.text(`护盾 · ${Math.ceil(boss.shieldT)}秒内打破，否则狂暴`, ui.W / 2, y + 66 * u, 20, '#2ce8f5');
      }
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
    if (b.convoy) this.drawConvoyMarker();
    if (this.chestAlertT > 0) {
      this.chestAlertT -= dt;
      ui.ctx.globalAlpha = clamp(this.chestAlertT / 0.4, 0, 1);
      ui.text('宝箱掉落！跟着金色箭头去拾取', ui.W / 2, ui.safeTop + 230 * u, 26, '#fee761');
      ui.ctx.globalAlpha = 1;
    }
    this.drawCombo(dt);
    this.drawCutIn(dt);
    this.drawUltButton();
    this.drawPotionButton();
    if (b.def) this.drawDefensePanel();

    if (!game.dialogs.length) this.drawTip(dt);
    // 新手提示
    if (save.guide === 0 && this.tutorialT < 9 && !game.dialogs.length) {
      guideHint(ui, this.tutorialT < 4.5 ? `按住屏幕任意位置拖动，控制${this.battle.hero.name}移动` : `${this.battle.hero.name}会自动攻击，拾取蓝色宝石升级`, ui.H * 0.72);
    }
  }

  /** 守城：粮草和自动出兵进度（放在大招按钮的另一侧；不用点，兵种 / 建筑 / 武将 / 修城都在升级时选） */
  private drawDefensePanel() {
    const ui = game.ui;
    const u = ui.u;
    const b = this.battle;
    const d = b.def!;
    const right = !save.settings.ultRight;
    const bw = 150 * u, bh = 150 * u;
    const x = right ? ui.W - bw - 14 * u : 14 * u;
    const y = ui.H * 0.5;
    const kind = nextAutoUnit(d);
    const un = UNITS[kind];
    const count = soldiers(d), full = count >= MAX_ALLIES;
    ui.pixRect(x, y, bw, bh, 'rgba(10,6,8,0.62)');
    ui.icon('p_ration', x + 24 * u, y + 24 * u, 30 * u);
    ui.text(`${Math.floor(d.grain)}`, x + 46 * u, y + 18 * u, 22, '#fee761', 'left');
    ui.text(`+${grainRate(d).toFixed(1)}/秒`, x + 46 * u, y + 40 * u, 14, C.textDim, 'left');
    // 下一队：图标 + 进度条
    ui.icon(un.icon, x + 30 * u, y + 84 * u, 40 * u, full ? 0.45 : 1);
    ui.text(full ? '兵力已满' : `下一队${un.name}`, x + 56 * u, y + 74 * u, 16, full ? '#a89a86' : '#fff4d6', 'left');
    const k = Math.min(1, d.grain / un.cost);
    ui.pixRect(x + 56 * u, y + 90 * u, bw - 68 * u, 10 * u, '#231917');
    ui.pixRect(x + 56 * u, y + 90 * u, (bw - 68 * u) * k, 10 * u, full ? '#6b5a4a' : '#9be37a');
    ui.text(IS_WEB ? `兵力 ${count} 人` : `兵力 ${count}/${MAX_ALLIES}`, x + bw / 2, y + 128 * u, 16, '#d9c6a0');
    // 城池不在屏幕里：屏幕边缘画一个指向城池的箭头（城墙挨打时变红闪烁）
    const [sx, sy] = this.renderer.worldToScreen(0, -8);
    const scx = sx, scy = sy;
    if (scx < 0 || scx > ui.W || scy < ui.safeTop + 120 * u || scy > ui.H) {
      const cx = ui.W / 2, cy = ui.H / 2;
      const ang = Math.atan2(scy - cy, scx - cx);
      const ex = Math.max(70 * u, Math.min(ui.W - 70 * u, cx + Math.cos(ang) * ui.W)), ey = Math.max(ui.safeTop + 200 * u, Math.min(ui.H - 260 * u, cy + Math.sin(ang) * ui.H));
      const hit = d.cityFlash > 0 || d.cityHp < d.cityMax * 0.3;
      const g = ui.ctx;
      g.save(); g.translate(ex, ey); g.rotate(ang);
      g.fillStyle = hit && Math.floor(ui.time * 6) % 2 ? '#e43b44' : '#fee761';
      g.beginPath(); g.moveTo(34 * u, 0); g.lineTo(6 * u, -18 * u); g.lineTo(6 * u, 18 * u); g.closePath(); g.fill();
      g.restore();
      ui.pixRect(ex - 30 * u, ey - 20 * u, 60 * u, 40 * u, 'rgba(10,6,8,0.7)');
      ui.text('城', ex, ey, 26, hit ? '#ff8a80' : '#fee761');
    }
    // 武将倒下
    if (d.downT > 0) {
      ui.ctx.fillStyle = 'rgba(10,6,8,0.55)';
      ui.ctx.fillRect(0, ui.H * 0.46, ui.W, 70 * u);
      ui.text(`${b.hero.name}回城重整中…… ${Math.ceil(d.downT)} 秒`, ui.W / 2, ui.H * 0.46 + 35 * u, 30, '#ff8a80');
    }
    this.tip('defense', '守住城池！粮草攒够会自动出兵，你只管带兵迎敌', true);
    if (b.t > 20) this.tip('defense2', '升级时选兵种、建筑、武将助阵或修城，兵会跟着武将驻守');
  }

  /** 大招立绘切入的计时（-1 表示没有） */
  private cutIn = -1;

  /** 大招切入：斜向黑底横幅 + 武将立绘滑入 + 大招名，约 1.1 秒 */
  private drawCutIn(dt: number) {
    if (this.cutIn < 0) return;
    this.cutIn += dt;
    const t = this.cutIn;
    if (t > 1.1) { this.cutIn = -1; return; }
    const ui = game.ui;
    const u = ui.u;
    const g = ui.ctx;
    const b = this.battle;
    const hero = b.hero;
    const inK = Math.min(1, t / 0.18), outK = t > 0.9 ? (t - 0.9) / 0.2 : 0;
    const ease = 1 - (1 - inK) * (1 - inK);
    const cy = ui.H * 0.27, bh = 230 * u * (1 - outK * 0.8), skew = 60 * u;
    g.save();
    g.globalAlpha = 1 - outK;
    // 横幅底
    g.fillStyle = 'rgba(14,8,12,0.88)';
    g.beginPath();
    g.moveTo(0, cy - bh / 2 + skew); g.lineTo(ui.W, cy - bh / 2 - skew + skew * 0.6);
    g.lineTo(ui.W, cy + bh / 2 - skew + skew * 0.6); g.lineTo(0, cy + bh / 2 + skew);
    g.closePath(); g.fill();
    // 上下两道武将本色描边
    g.strokeStyle = hero.color; g.lineWidth = 6 * u;
    g.beginPath(); g.moveTo(0, cy - bh / 2 + skew); g.lineTo(ui.W, cy - bh / 2 - skew * 0.4); g.stroke();
    g.beginPath(); g.moveTo(0, cy + bh / 2 + skew); g.lineTo(ui.W, cy + bh / 2 - skew * 0.4); g.stroke();
    // 速度线
    g.save();
    g.beginPath();
    g.moveTo(0, cy - bh / 2 + skew); g.lineTo(ui.W, cy - bh / 2 - skew * 0.4); g.lineTo(ui.W, cy + bh / 2 - skew * 0.4); g.lineTo(0, cy + bh / 2 + skew); g.closePath();
    g.clip();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const yy = cy - bh / 2 + ((i * 37) % 100) / 100 * bh + skew * 0.3;
      const len = (80 + ((i * 53) % 120)) * u;
      const xx = ui.W - ((t * 1800 * u + i * 211 * u) % (ui.W + len));
      g.globalAlpha = (0.25 + (i % 3) * 0.12) * (1 - outK);
      g.fillStyle = i % 4 === 0 ? hero.color : '#ffffff';
      g.fillRect(xx, yy, len, 3 * u);
    }
    g.restore();
    // 立绘：从左边滑入，背后一圈本色光
    const hx = -200 * u + (ui.W * 0.28 + 200 * u) * ease, hy = cy + 20 * u;
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(hx, hy - 40 * u, 10 * u, hx, hy - 40 * u, 190 * u);
    glow.addColorStop(0, hero.color); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.55 * (1 - outK);
    g.fillStyle = glow;
    g.fillRect(hx - 200 * u, hy - 240 * u, 400 * u, 400 * u);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1 - outK;
    ui.icon(heroIdleFrame(b.heroSprite, ui.time), hx, hy - 40 * u, 330 * u);
    // 大招名：从右边滑入
    const [pre, main] = hero.ultName.includes('·') ? hero.ultName.split('·') : ['', hero.ultName];
    const tx = ui.W + 300 * u - (ui.W * 0.35 + 300 * u) * ease;
    if (pre) ui.text(pre, tx, cy - 58 * u, 30, hero.color, 'center', '#120d0c');
    ui.text(main, tx, cy + 6 * u, 64, '#fff4d6', 'center', '#3a0d12');
    ui.text(hero.name, tx, cy + 70 * u, 26, C.gold, 'center', '#120d0c');
    g.restore();
    g.globalAlpha = 1;
  }

  private ultBtn: { x: number; y: number; r: number } | null = null;
  private potionBtn: { x: number; y: number; r: number } | null = null;

  private pressPotion() {
    const b = this.battle;
    if (b.usePotion()) { vibrate(); return; }
    if (b.potionCd > 0) game.ui.toast(`金疮药冷却中（${Math.ceil(b.potionCd)}秒）`);
  }

  /** 金疮药按钮：放在大招按钮旁边，转圈显示冷却 */
  private drawPotionButton() {
    const ui = game.ui;
    const u = ui.u;
    const b = this.battle;
    const ub = this.ultBtn;
    if (!ub) return;
    const g = ui.ctx;
    const r = 52 * u;
    const right = save.settings.ultRight;
    const cx = right ? ub.x - ub.r - 26 * u - r : ub.x + ub.r + 26 * u + r;
    const cy = ub.y + ub.r - r;
    this.potionBtn = { x: cx, y: cy, r };
    const ready = b.potionCd <= 0;
    const low = b.player.hp < b.player.maxHp * 0.4;
    if (ready && low) {
      // 血量低且药已就绪：发光提示
      const glow = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.6);
      glow.addColorStop(0, 'rgba(99,199,77,0.6)');
      glow.addColorStop(1, 'rgba(99,199,77,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(cx, cy, r * (1.5 + 0.12 * Math.sin(ui.time * 9)), 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(12,8,16,0.75)';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6 * u;
    g.strokeStyle = ready ? '#63c74d' : '#3a2c2a';
    g.beginPath(); g.arc(cx, cy, r - 4 * u, 0, Math.PI * 2); g.stroke();
    if (!ready) {
      g.strokeStyle = '#5a6988';
      g.beginPath(); g.arc(cx, cy, r - 4 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.potionCd / b.potionCdMax)); g.stroke();
    }
    ui.icon('potion', cx, cy - 6 * u, r * 1.05, ready ? 1 : 0.4);
    if (ready) ui.text('金疮药', cx, cy + r * 0.62, 20, '#9be37a', 'center', '#10200c');
    else ui.text(`${Math.ceil(b.potionCd)}s`, cx, cy + r * 0.62, 22, '#c0cbdc');
    if (ui.clicked('potion_btn', cx - r, cy - r, r * 2, r * 2, false)) this.pressPotion();
    // 新手提示：第一次血量偏低时提醒可以喝药
    if (ready && low && b.potionUses === 0 && save.stats.runs < 5 && !game.dialogs.length && !b.dead) {
      guideHint(ui, '生命偏低！点击「金疮药」回复生命', cy - r - 250 * u);
    }
  }

  private pressUlt() {
    const b = this.battle;
    if (b.rageFull && !b.ult) this.tryUlt();
    else game.ui.toast(b.rageLock > 0 ? '大招恢复中' : '击败敌人积攒怒气');
  }

  // 性能保护：持续掉帧时减少同屏敌人，流畅后再慢慢恢复
  private frameAvg = 1 / 60;
  private slowT = 0;
  private fastT = 0;
  private adaptDensity(dt: number) {
    if (DEBUG.speed > 1) return;
    this.frameAvg += (dt - this.frameAvg) * 0.05;
    const b = this.battle;
    // 省电模式本来就是 30 帧，按 30 帧的标准判断是否掉帧
    const lp = save.settings.lowPower;
    if (this.frameAvg > (lp ? 1 / 24 : 1 / 40)) {
      this.slowT += dt; this.fastT = 0;
      if (this.slowT > 2) {
        this.slowT = 0; b.densityMul = Math.max(0.5, b.densityMul - 0.1);
        // 手机带不动时提示省电模式（每个玩家只提示一次）
        if (b.densityMul <= 0.7 && !save.settings.lowPower) this.tip('lowpower', '手机发烫？暂停里可以打开「省电」');
      }
    } else if (this.frameAvg < (lp ? 1 / 28 : 1 / 55)) {
      this.fastT += dt; this.slowT = 0;
      if (this.fastT > 6) { this.fastT = 0; b.densityMul = Math.min(1, b.densityMul + 0.05); }
    } else { this.slowT = 0; this.fastT = 0; }
  }

  private comboPulse = 0;
  private lastCombo = 0;

  private tryUlt() {
    const b = this.battle;
    if (b.castUlt()) { b.hooks.shake(4); getPlatform().recorderMark(); }
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
    if (!full && !b.ult && b.adRageUsed < 2 && !NO_ADS) {
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
  private seenChests = new WeakSet<object>();
  private chestAlertT = 0;

  private drawConvoyMarker() {
    const b = this.battle, cart = b.convoy!, ui = game.ui, u = ui.u;
    const [sx, sy] = this.renderer.worldToScreen(cart.x, cart.y);
    const offscreen = sx < 0 || sx > ui.W || sy < 0 || sy > ui.H;
    const a = Math.atan2(sy - ui.H / 2, sx - ui.W / 2);
    const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][(Math.round(a * 4 / Math.PI) + 8) % 8];
    const seconds = Math.min(30, Math.ceil(cart.expiresAt - b.t));
    const text = `${offscreen ? arrow + ' ' : ''}运粮车 · 护卫剩${3 - cart.defeated}/3 · ${seconds}秒`;
    const width = ui.measure(text, 23) + 20 * u;
    const x = clamp(sx, width / 2 + 8 * u, ui.W - width / 2 - 8 * u);
    const top = ui.safeTop + (((b.midBoss || b.finalBoss) ? 364 : 250) + (b.coreWeapon ? 37 : 0)) * u;
    const bottom = Math.max(top, ui.H - ui.safeBottom - 280 * u);
    let y = clamp(this.renderer.worldToScreen(cart.x, cart.y - 70)[1], top, bottom);
    const bannerY = ui.H * 0.3;
    if (this.banners.length && Math.abs(y - bannerY) < 60 * u) y = Math.min(bottom, bannerY + 60 * u);
    ui.pixRect(x - width / 2, y - 19 * u, width, 38 * u, 'rgba(20,40,35,0.88)', 4 * u);
    ui.text(text, x, y, 23, '#fff3c4');
  }

  private drawOffscreenArrows() {
    const ui = game.ui;
    const u = ui.u;
    const g = ui.ctx;
    const m = 72 * u;
    const top = ui.safeTop + 260 * u;
    // 箭头不能落进底部大招按钮区域
    const bottom = ui.H - ui.safeBottom - 440 * u;
    for (const k of this.battle.pickups) {
      if (k.kind !== 'magnet' && k.kind !== 'chest' && k.kind !== 'bun') continue;
      if (k.kind === 'chest' && !this.seenChests.has(k)) {
        this.seenChests.add(k);
        this.chestAlertT = 2.2;
      }
      const [sx, sy] = this.renderer.worldToScreen(k.x, k.y);
      if (sx > 0 && sx < ui.W && sy > top && sy < ui.H) continue;
      const cx = ui.W / 2, cy = ui.H / 2;
      const dx = sx - cx, dy = sy - cy;
      const kx = (ui.W / 2 - m) / Math.abs(dx || 1e-6), ky = (ui.H / 2 - m - 140 * u) / Math.abs(dy || 1e-6);
      const kk = Math.min(kx, ky);
      const ax = cx + dx * kk, ay = clamp(cy + dy * kk, top, bottom);
      const a = Math.atan2(sy - ay, sx - ax);
      const bob = Math.sin(ui.time * 6) * 6 * u;
      const chest = k.kind === 'chest';
      const s = chest ? 1.35 : 1;
      g.save();
      g.translate(ax + Math.cos(a) * bob, ay + Math.sin(a) * bob);
      if (chest) {
        // 宝箱：金色脉动光圈，比包子、磁石更醒目
        g.strokeStyle = `rgba(254,231,97,${0.5 + 0.4 * Math.sin(ui.time * 8)})`;
        g.lineWidth = 4 * u;
        g.beginPath(); g.arc(0, 0, 44 * u + 4 * u * Math.sin(ui.time * 8), 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = 'rgba(12,8,16,0.7)';
      g.beginPath(); g.arc(0, 0, 36 * u * s, 0, Math.PI * 2); g.fill();
      g.rotate(a);
      g.fillStyle = k.kind === 'magnet' ? '#2ce8f5' : '#fee761';
      g.beginPath(); g.moveTo(48 * u * s, 0); g.lineTo(32 * u * s, -12 * u * s); g.lineTo(32 * u * s, 12 * u * s); g.closePath(); g.fill();
      g.restore();
      ui.icon(chest ? (k.boss ? 'chest_gold' : 'chest') : k.kind, ax + Math.cos(a) * bob, ay + Math.sin(a) * bob, 44 * u * s);
    }
  }

  private drawWorldTexts() {
    const ui = game.ui;
    for (const f of this.battle.fx) {
      if (f.kind !== 'text' || f.t < 0) continue;
      const k = f.t / f.dur;
      if (f.line !== undefined) {
        // 宝箱文字：跟着武将，在头顶右侧逐行排开
        const p = this.battle.player;
        const [px, py] = this.renderer.worldToScreen(p.x, p.y);
        const u = ui.u;
        ui.ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : Math.min(1, f.t * 6);
        const x = clamp(px + 40 * u, 20 * u, ui.W - 300 * u);
        ui.text(f.text!, x, py - 150 * u + f.line * 34 * u - k * 24 * u, 26, f.color || '#fff', 'left');
        ui.ctx.globalAlpha = 1;
        continue;
      }
      const [sx, sy] = this.renderer.worldToScreen(f.x, f.y);
      ui.ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      ui.text(f.text!, clamp(sx, ui.W * 0.3, ui.W * 0.7), sy - k * 30 * ui.u, 26, f.color || '#fff');
      ui.ctx.globalAlpha = 1;
    }
  }

  // 暗角：全屏径向渐变每帧现算很费 GPU，改成预先画好的小图（1/4 分辨率）拉伸贴上去
  private vigCache: Record<string, HTMLCanvasElement> = {};
  private vignette(kind: 'dark' | 'red') {
    const ui = game.ui;
    const key = kind + ui.W + 'x' + ui.H;
    let c = this.vigCache[key];
    if (!c) {
      const w = Math.ceil(ui.W / 4), h = Math.ceil(ui.H / 4);
      c = getPlatform().createCanvas(w, h);
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, kind === 'red' ? 'rgba(160,10,20,1)' : 'rgba(10,6,16,1)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      this.vigCache[key] = c;
    }
    return c;
  }

  private drawVignette() {
    const ui = game.ui;
    const g = ui.ctx;
    const b = this.battle;
    const low = b.player.hp < b.player.maxHp * 0.3;
    const c = this.vignette(low ? 'red' : 'dark');
    g.save();
    g.imageSmoothingEnabled = true;
    g.globalAlpha = low ? 0.45 + 0.15 * Math.sin(b.t * 6) : 0.45;
    g.drawImage(c, 0, 0, c.width, c.height, 0, 0, ui.W, ui.H);
    g.restore();
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

/** 当前出战武将（技能卡片显示专属联动的名字） */
let infoHero = '';
/** 当前战斗（守城的建筑 / 武将卡要看局内状态） */
let infoBattle: Battle | null = null;

export function choiceInfo(c: Choice): { icon: string; name: string; desc: string; lv: number; max: number; isNew: boolean; evo: boolean } {
  switch (c.kind) {
    case 'weapon': {
      const d = WEAPONS[c.id];
      return { icon: d.icon, name: d.name, desc: c.isNew ? d.intro : d.levels[c.lv - 1].desc, lv: c.lv, max: MAX_WEAPON_LV, isNew: c.isNew, evo: false };
    }
    case 'passive': {
      const d = PASSIVES[c.id];
      return { icon: d.icon, name: d.name, desc: d.desc, lv: c.lv, max: passiveMax(c.id), isNew: c.isNew, evo: false };
    }
    case 'evo': {
      const d = WEAPONS[c.id];
      const link = weaponLink(c.id, infoHero);
      return { icon: d.evoIcon, name: link ? link.name : d.evoName, desc: link ? link.desc : d.evo.desc, lv: 0, max: 0, isNew: false, evo: true };
    }
    case 'heal':
      return { icon: 'bun', name: '肉包子', desc: '回复30%生命', lv: 0, max: 0, isNew: false, evo: false };
    case 'gold':
      return { icon: 'gold', name: '军饷', desc: '获得30金币', lv: 0, max: 0, isNew: false, evo: false };
    case 'order': {
      const d = ORDERS[c.id];
      return { icon: d.icon, name: d.name, desc: d.levels[c.lv - 1], lv: c.lv, max: d.max, isNew: c.isNew, evo: false };
    }
    case 'link': {
      const d = LINKS[c.id];
      return { icon: d.icon, name: d.name, desc: d.desc, lv: 0, max: 0, isNew: false, evo: true };
    }
    case 'build': {
      const d = BUILDS[c.id];
      const def = infoBattle?.def;
      return { icon: d.icon, name: d.name, desc: def ? buildStepText(def, c.id) : d.desc, lv: c.lv, max: BUILD_CARD_MAX, isNew: c.isNew, evo: false };
    }
    case 'hero': {
      const h = infoBattle?.def?.heroes[c.id];
      return { icon: h ? `${h.sprite}_0` : 'star', name: `${h?.name || ''}助阵`, desc: `召唤${h?.name || '武将'}出城作战 ${HERO_SUMMON_TIME} 秒（强度按武将自己的等级、星级）`, lv: 0, max: 0, isNew: false, evo: false };
    }
    case 'repair':
      return { icon: 'p_armor', name: '修城', desc: `立即修复 ${Math.round(REPAIR_PCT * 100)}% 城池生命`, lv: 0, max: 0, isNew: false, evo: false };
  }
}

export { fmtNum, UI };
