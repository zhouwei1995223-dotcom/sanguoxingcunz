import { game, Scene } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { cachedLayer } from '../ui/layerCache';
import { drawSkin, paintInkPill, paintMedal, paintLacquerButton, paintSlipButton, LACQUER, Lacquer, rr, goldGrad, softShadow, mix, paperGrain } from '../ui/skin';
import { paintPageBg } from './homeArt';
import { currentWeekly } from '../meta/goals';
import { HomeBackground } from './homeBg';
import { HomeCamp } from './homeCamp';
import { canPublish, refreshPublishSupport } from '../platform/xhsPublish';
import { goldTenStep, drawGoldTen } from './xhsRewards';
import { save, markDirty, flushSave, tickStamina, staminaNextSeconds, rolloverDaily, activePreparationFor, selectedPreparationStage } from '../meta/save';
import { HEROES, HERO_BY_ID, STAR_COST, MAX_STAR, PEAK_MAX, PEAK_BONUS, peakCost, AWAKEN_DMG, AWAKEN_HP, CAMPS, Camp, HeroDef, heroRank } from '../data/heroes';
import { WEAPONS, PASSIVES, heroLinks, skillPoolFor, fitPreparation, coreWeaponFits } from '../data/skills';
import {
  heroBase, heroRedDot, anyHeroRedDot, unlockHero, starUpHero, peakUpHero, randomShardHero, grantShards,
  computeStats, combatPower, getEquipped, isEquipped, equipBest, mergeAll, upgradeHero, upgradeTalent, chapterUnlocked,
  canSignin, tasksRedDot, patrolPending, spendStamina, openChest, progressTask, GOLD_CHEST_HERO_RATE, chestOddsText, wishHero, setWishHero, WISH_RATE,
} from '../meta/ops';
import {
  HERO, heroLevelCost, potionStats, SLOTS, SLOT_NAMES, SLOT_ICONS, EQUIP_BY_ID, TALENTS, talentCost, STAT_NAMES, PERCENT_STATS, STAMINA,
  CHESTS, ChestDef, SHOP_DAILY, QUALITY_NAMES, QUALITY_COLORS, adStep, CHEST_AD_BONUS,
} from '../data/meta';
import { CHAPTERS, DIFFICULTIES } from '../data/chapters';
import { settleRun, settleDefense, RunResult, defenseOpen, chapterOpen, diffOpen, isCleared, getBest, endlessOpen, ENDLESS_UNLOCK, recommendedPower, legacyChapterPower, powerGuideText, THREE_STARS, starRating, chapterStars, defenseStars } from '../meta/run';
import { fmtNum, fmtTime } from '../core/math';
import { itemSlot, currencyBar, adButton } from '../ui/widgets';
import { playBgm, playSfx } from '../audio/sound';
import { BattleScene } from './battleScene';
import { TianjiRulesDialog } from './tianjiDialogs';
import { TIANJI_STAMINA } from '../meta/run';
import {
  XhsFollowDialog, SigninDialog, TasksDialog, PatrolDialog, SettingsDialog, ItemDialog, ChestResultDialog, ChestBatchResultDialog, StaminaDialog, RankDialog,
  SidebarDialog, PreparationDialog, PrepReminderDialog, CampaignDurationDialog, ChapterStoryDialog, ChapterListDialog, DefenseListDialog, SweepDialog, TextDialog, staminaAdGain,
} from './homeDialogs';
import { guidePointer } from '../ui/guide';
import { NewbieDialog, CodexDialog, WeeklyDialog } from './featureDialogs';
import { heroSpriteName, heroIdleFrame, newbieActive, newbieRedDot, achRedDot, codexUnclaimed, weeklyRedDot, skinState, skinAdProgress, setBonuses, setOf } from '../meta/goals';
import { SKINS, EQUIP_SETS } from '../data/goals';
import { funnel, reportDailyLogin } from '../meta/telemetry';
import { GAME_INFO, IS_XHS, WEB_RULES, IS_H5, NO_ADS, NO_ADS_PRICE, NEW_UI } from '../data/platformConfig';
import { DEFENSE_LEVEL_COUNT, defenseChapter } from '../data/defense';
import { TOWER_MAPS, commandBonus } from '../data/tower';
import { TowerScene, TowerStageDialog, CommanderDialog, towerCommander } from './towerScene';

/** 战力达到推荐战力的几倍可以碾压（免挑战直接拿胜利奖励） */
const SWEEP_K = 2;

type Tab = 'shop' | 'equip' | 'battle' | 'arena' | 'talent' | 'hero';
const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'shop', name: '商店', icon: 'chest_gold' },
  { id: 'equip', name: '装备', icon: 'e_armor' },
  { id: 'battle', name: '征战', icon: 'w_spear' },
  { id: 'arena', name: '演武', icon: 'atk' },
  { id: 'talent', name: '军略', icon: 'p_book' },
  { id: 'hero', name: '武将', icon: 'p_flag' },
];

export class HomeScene implements Scene {
  tab: Tab = 'battle';
  private bg!: HomeBackground;
  private camp!: HomeCamp;
  private flashPower = 0;
  private lastPower = 0;
  private autoPopped = false;
  private lastPreparationStage = '';

  /** 加载页已经预热过（enter + 画过一帧）：真正切进来时不再重复初始化 */
  private entered = false;
  enter() {
    if (this.entered) { playBgm('bgm_home'); return; }
    this.entered = true;
    const p = getPlatform();
    this.bg = new HomeBackground(p.width, p.height);
    this.camp = new HomeCamp();
    playBgm('bgm_home');
    checkUpdateNotice();
    if (IS_XHS) void refreshPublishSupport();
    if (getPlatform().supportsRecommend()) getPlatform().preloadRecommend();
    rolloverDaily();
    tickStamina();
    this.lastPower = combatPower();
    if (save.stats.runs >= 1) funnel('home_first');
    reportDailyLogin();
    flushSave(true);
  }

  private lastGuide = -1;
  update(dt: number) {
    const ui = game.ui;
    // 埋点：新手引导每推进一步上报一次
    if (save.guide !== this.lastGuide) { if (this.lastGuide >= 0) getPlatform().report('guide_step', { step: String(save.guide) }); this.lastGuide = save.guide; }
    tickStamina();
    rolloverDaily();
    this.syncMode();
    if (this.tab === 'battle') {
      // 营地：篝火放在「征战 / 守城」页签上方，留出闲逛武将的位置
      const S = Math.max(2, Math.round(Math.min(ui.W, ui.H) / 280));
      this.camp.draw(ui.ctx, dt, ui.W, ui.H, this.battleLayout(ui).cy - 84 * ui.u - 46 * S, S);
    }
    else this.drawPlainBg(ui);
    const power = combatPower();
    if (power !== this.lastPower) { this.flashPower = 1.2; this.lastPower = power; }
    this.flashPower = Math.max(0, this.flashPower - dt);

    switch (this.tab) {
      case 'battle': this.drawBattleTab(ui); break;
      case 'arena': this.drawArenaTab(ui); break;
      case 'equip': this.drawEquipTab(ui); break;
      case 'talent': this.drawTalentTab(ui); break;
      case 'hero': this.drawHeroTab(ui); break;
      case 'shop': this.drawShopTab(ui); break;
    }
    this.drawTopBar(ui, power);
    this.drawNav(ui);
    this.drawGuide(ui);
    this.autoPopups();
  }

  /** 非征战页的背景：深色砖纹 */
  private drawPlainBg(ui: UI) {
    const g = ui.ctx;
    if (!NEW_UI) {
      g.fillStyle = '#211a2c';
      g.fillRect(0, 0, ui.W, ui.H);
      const bw = 96 * ui.u, bh = 48 * ui.u;
      g.fillStyle = '#2a2236';
      for (let y = 0, r = 0; y < ui.H; y += bh, r++)
        for (let x = (r % 2) * -bw / 2; x < ui.W; x += bw) g.fillRect(x + 3 * ui.u, y + 3 * ui.u, bw - 6 * ui.u, bh - 6 * ui.u);
      const grad = g.createLinearGradient(0, 0, 0, ui.H);
      grad.addColorStop(0, 'rgba(90,40,60,0.35)');
      grad.addColorStop(1, 'rgba(10,8,16,0.6)');
      g.fillStyle = grad;
      g.fillRect(0, 0, ui.W, ui.H);
      return;
    }

    // 内页底：整张熟宣 + 上下两抹远山（整屏缓存）
    ui.markPaper(0, 0, ui.W, ui.H);
    const bg = cachedLayer('home_plain', `${ui.u}`, ui.W, ui.H, (cg) => paintPageBg(cg, ui.W, ui.H, ui.u));
    g.drawImage(bg, 0, 0);
  }

  /**
   * 主界面只放「征战」「天机签」；守城、布阵、无尽、每周挑战收进「演武」页。
   * save.homeMode 仍是四个取值（备战按它判断征战 / 守城）：征战页 ⇔ chapter / tianji，演武页 ⇔ defense / tower。
   * 从守城、布阵打完回来，或者别处改了 homeMode，这里把页签带过去。
   */
  private arenaSel: 'defense' | 'tower' | 'endless' = 'defense';
  private battleMode: 'chapter' | 'tianji' = 'chapter';
  private lastHomeMode = '';
  private syncMode() {
    const hm = save.homeMode || 'chapter';
    if (hm === this.lastHomeMode) return;
    this.lastHomeMode = hm;
    if (hm === 'defense' || hm === 'tower') { this.arenaSel = hm; if (this.tab === 'battle') this.tab = 'arena'; }
    else { this.battleMode = hm; if (this.tab === 'arena') this.tab = 'battle'; }
  }
  private setMode(m: 'chapter' | 'defense' | 'tower' | 'tianji') {
    save.homeMode = m; this.lastHomeMode = m; markDirty();
    if (m === 'defense' || m === 'tower') this.arenaSel = m; else this.battleMode = m;
  }

  /** 进入主城时自动弹出：签到 */
  private autoPopups() {
    if (this.autoPopped || game.dialogs.length || save.guide > 0 && save.guide < 99) return;
    this.autoPopped = true;
    if (save.guide >= 99 && canSignin()) game.openDialog(new SigninDialog());
    else if (getPlatform().isFromSidebar() && !save.daily.sidebar) game.openDialog(new SidebarDialog());
  }

  // —— 顶栏 ——
  private drawTopBar(ui: UI, power: number) {
    const u = ui.u;
    const y = ui.safeTop + 6 * u;
    if (!NEW_UI) {
      // 头像与战力
      const av = 92 * u;
      ui.qualityFrame(16 * u, y, av, '#feae34');
      ui.icon(`${heroSpriteName(save.hero)}_0`, 16 * u + av / 2, y + av / 2, av * 0.9);
      ui.pixRect(16 * u, y + av - 4 * u, av, 30 * u, '#120d0c');
      ui.text('Lv.' + save.heroes[save.hero].lv, 16 * u + av / 2, y + av + 11 * u, 18, '#fff');
      ui.text('战力', 124 * u, y + 24 * u, 20, C.textDim, 'left');
      const pc = this.flashPower > 0 ? (Math.floor(this.flashPower * 10) % 2 ? '#fee761' : '#fff') : '#fee761';
      ui.text(fmtNum(power), 124 * u, y + 62 * u, 34, pc, 'left');
      // 货币
      const cw = 196 * u;
      const cx = ui.W - cw - 16 * u;
      const st = staminaNextSeconds();
      if (currencyBar(ui, cx, y, cw, 'stamina', `${save.stamina}/${STAMINA.max}`, 'top_stamina')) game.openDialog(new StaminaDialog());
      if (st > 0) ui.text(fmtTime(st), cx + cw / 2 + 10 * u, y + 66 * u, 16, C.textDim);
      currencyBar(ui, cx - cw - 10 * u, y, cw, 'gold', fmtNum(save.gold));
      if (currencyBar(ui, cx - cw - 10 * u, y + 62 * u + 20 * u, cw, 'yuanbao', fmtNum(save.yuanbao), 'top_yb')) this.tab = 'shop';
      currencyBar(ui, cx, y + 62 * u + 20 * u, cw, 'iron', fmtNum(save.iron));
      return;
    }

    const ctx = ui.ctx;
    // 左上：头像 + 墨漆战力牌
    const av = 92 * u, ax = 16 * u;
    const px = ax + av - 22 * u, pw = 218 * u, ph = 54 * u, py = y + 4 * u;
    ui.markDark(px, py, pw, ph);
    drawSkin(ctx, 'power', px, py, pw, ph, 10 * u, (g, w0, h0) => paintInkPill(g, w0, h0, u, 0.9));
    ui.text('战力', px + 34 * u, py + ph / 2 + 1 * u, 19, '#e2c078', 'left', null);
    const pc = this.flashPower > 0 ? (Math.floor(this.flashPower * 10) % 2 ? '#ffffff' : '#ffe9a8') : '#ffe9a8';
    ui.text(fmtNum(power), px + 82 * u, py + ph / 2 + 1 * u, 30, pc, 'left', null);
    const hero = HERO_BY_ID[save.hero];
    ui.text(`${hero.name} · Lv.${save.heroes[save.hero].lv}`, px + 34 * u, py + ph + 22 * u, 20, '#2a2018', 'left', 'rgba(250,242,224,0.9)');
    ui.qualityFrame(ax, y, av, '#feae34');
    ui.icon(`${heroSpriteName(save.hero)}_0`, ax + av / 2, y + av / 2, av * 0.86);
    if (ui.clicked('top_hero_badge', ax, y, av + pw - 8 * u, av + 14 * u)) {
      this.openHero(save.hero);
    }

    // 货币区（2×2）
    const cw = 196 * u;
    const cx = ui.W - cw - 16 * u;
    const st = staminaNextSeconds();
    if (currencyBar(ui, cx, y, cw, 'stamina', `${save.stamina}/${STAMINA.max}`, 'top_stamina')) game.openDialog(new StaminaDialog());
    currencyBar(ui, cx - cw - 10 * u, y, cw, 'gold', fmtNum(save.gold));
    if (currencyBar(ui, cx - cw - 10 * u, y + 58 * u, cw, 'yuanbao', fmtNum(save.yuanbao), 'top_yb')) this.tab = 'shop';
    currencyBar(ui, cx, y + 58 * u, cw, 'iron', fmtNum(save.iron));
    if (st > 0) ui.text('体力 ' + fmtTime(st), cx + cw - 8 * u, y + 122 * u, 17, '#3a2c20', 'right', 'rgba(250,242,224,0.9)');
  }

  // —— 底部导航 ——
  private navRects: Record<string, [number, number, number, number]> = {};
  private drawNav(ui: UI) {
    const u = ui.u;
    const h = (NEW_UI ? 128 : 140) * u;
    const y = ui.H - h - ui.safeBottom;
    if (!NEW_UI) {
      ui.ctx.fillStyle = '#120d0c';
      ui.ctx.fillRect(0, y - 6 * u, ui.W, h + 6 * u + ui.safeBottom);
      ui.ctx.fillStyle = C.border;
      ui.ctx.fillRect(0, y - 6 * u, ui.W, 4 * u);
      const tw = ui.W / TABS.length;
      TABS.forEach((t, i) => {
        const x = i * tw;
        const active = this.tab === t.id;
        const big = t.id === 'battle';
        this.navRects[t.id] = [x, y, tw, h];
        if (active) {
          ui.pixRect(x + 6 * u, y + 4 * u, tw - 12 * u, h - 8 * u, '#5a3a24');
          ui.pixRect(x + 10 * u, y + 8 * u, tw - 20 * u, h - 16 * u, '#7a5030');
        }
        const isz = (big ? 78 : 60) * u * (active ? 1.1 : 1);
        ui.icon(t.icon, x + tw / 2, y + (big ? 52 : 56) * u - (active ? 6 * u : 0), isz);
        ui.text(t.name, x + tw / 2, y + h - 26 * u, active ? 28 : 24, active ? C.gold : C.textDim);
        const dot = (t.id === 'shop' && this.shopRedDot()) || (t.id === 'talent' && this.talentRedDot()) || (t.id === 'hero' && anyHeroRedDot());
        if (dot) ui.redDot(x + tw - 22 * u, y + 18 * u);
        if (ui.clicked('nav_' + t.id, x, y, tw, h)) {
          this.tab = t.id;
          if (save.guide === 1 && t.id === 'equip') save.guide = 2;
          if (save.guide === 3 && t.id === 'talent') save.guide = 4;
          if (save.guide === 5 && t.id === 'battle') save.guide = 6;
        }
      });
      return;
    }

    const ctx = ui.ctx;
    // 墨漆描金导航栏：整条缓存；选中的页签是一块升起来的朱漆牌
    const bh = h + ui.safeBottom;
    ui.markDark(0, y - 14 * u, ui.W, bh + 14 * u);
    drawSkin(ctx, 'navbar', 0, y, ui.W, bh, 16 * u, (g, w0, h0) => {
      const sh = g.createLinearGradient(0, -14 * u, 0, 0);
      sh.addColorStop(0, 'rgba(30,18,8,0)'); sh.addColorStop(1, 'rgba(30,18,8,0.3)');
      g.fillStyle = sh; g.fillRect(0, -14 * u, w0, 14 * u);
      const body = g.createLinearGradient(0, 0, 0, h0);
      body.addColorStop(0, '#3a2d23'); body.addColorStop(0.35, '#261c15'); body.addColorStop(1, '#140e0a');
      g.fillStyle = body; g.fillRect(0, 0, w0, h0);
      const gl = g.createLinearGradient(0, 0, w0, 0);
      gl.addColorStop(0, '#8a6226'); gl.addColorStop(0.5, '#f6dc9a'); gl.addColorStop(1, '#8a6226');
      g.fillStyle = gl; g.fillRect(0, 0, w0, Math.max(2, 2.6 * u));
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, Math.max(2, 2.6 * u), w0, Math.max(1, u));
      g.fillStyle = 'rgba(255,226,160,0.1)'; g.fillRect(0, 6 * u, w0, Math.max(1, u));
    });
    const tw = ui.W / TABS.length;
    TABS.forEach((t, i) => {
      const x = i * tw;
      const active = this.tab === t.id;
      this.navRects[t.id] = [x, y, tw, h];
      if (i > 0 && !active && this.tab !== TABS[i - 1].id) {
        ctx.fillStyle = 'rgba(255,226,160,0.1)';
        ctx.fillRect(Math.round(x), y + 26 * u, Math.max(1, u), h - 52 * u);
      }
      const pressed = ui.isPressed('nav_' + t.id);
      if (active) {
        const ay = y - 16 * u, ah = h + 6 * u;
        drawSkin(ctx, 'navon', x + 5 * u, ay, tw - 10 * u, ah, 16 * u, (g, w0, h0) => paintLacquerButton(g, w0, h0, u, LACQUER.red, false));
      }
      const isz = (active ? 64 : 52) * u;
      const iy = y + (active ? 36 : 46) * u + (pressed && !active ? 2 * u : 0);
      ui.icon(t.icon, x + tw / 2, iy, isz, active ? 1 : 0.92);
      ui.text(t.name, x + tw / 2, y + h - (active ? 30 : 26) * u, active ? 25 : 22, active ? '#fff6e0' : '#d9c59a', 'center', active ? '#4a0d09' : null);
      const dot = (t.id === 'shop' && this.shopRedDot()) || (t.id === 'talent' && this.talentRedDot()) || (t.id === 'hero' && anyHeroRedDot()) || (t.id === 'arena' && this.arenaRedDot());
      if (dot && !active) ui.redDot(x + tw - 20 * u, y + 20 * u);
      if (ui.clicked('nav_' + t.id, x, y, tw, h)) {
        this.tab = t.id;
        if (t.id === 'hero') this.heroDetail = false;
        if (t.id === 'battle' && (save.homeMode === 'defense' || save.homeMode === 'tower')) this.setMode(this.battleMode);
        if (t.id === 'arena') this.setMode(this.arenaSel === 'tower' ? 'tower' : 'defense');
        if (save.guide === 1 && t.id === 'equip') save.guide = 2;
        if (save.guide === 3 && t.id === 'talent') save.guide = 4;
        if (save.guide === 5 && t.id === 'battle') save.guide = 6;
      }
    });
  }

  private arenaRedDot() {
    const today = new Date().toISOString().slice(0, 10);
    return save.defense?.day !== today || endlessOpen() && weeklyRedDot();
  }

  private shopRedDot() {
    return !save.daily.freeGift || CHESTS.some(c => {
      if ((save.daily.chestAd[c.id] || 0) < c.adDaily) return true;
      if (IS_XHS && c.id === 'gold') {
        const step = goldTenStep();
        return step < 2 && canPublish(step === 0 ? 'comment' : 'note');
      }
      return WEB_RULES && !save.daily.chestTenAd?.[c.id];
    });
  }
  private talentRedDot() {
    return TALENTS.some((t) => (save.talents[t.id] || 0) < t.max && save.maxCleared >= t.unlockChapter && save.gold >= talentCost(t, save.talents[t.id] || 0));
  }

  private contentTop(ui: UI) { return ui.safeTop + 190 * ui.u; }
  private contentBottom(ui: UI) { return ui.H - (NEW_UI ? 152 : 150) * ui.u - ui.safeBottom; }

  // —— 征战页 ——
  private sideBtnRect: Record<string, [number, number, number, number]> = {};
  /** 征战页的纵向布局：出征按钮贴底，章节卡在其上方，人物站在章节卡上面 */
  private battleLayout(ui: UI) {
    const u = ui.u;
    const chH = 240 * u, bh = 124 * u;
    const by = this.contentBottom(ui) - bh - 16 * u;
    const cy = by - 20 * u - chH;
    return { chH, bh, by, cy };
  }

  private drawBattleTab(ui: UI) {
    if (WEB_RULES && save.homeMode !== 'tower' && save.homeMode !== 'tianji') {
      const { defense, chapter } = selectedPreparationStage();
      const key = `${save.hero}:${defense}:${chapter}`;
      if (this.lastPreparationStage && key !== this.lastPreparationStage) {
        const hero = HERO_BY_ID[save.hero], plan = activePreparationFor(hero.id);
        const pool = skillPoolFor(hero, save.maxCleared, chapter, defense);
        const skipped = plan.skills.length - fitPreparation(plan.skills, pool, [hero.weapon]).length;
        if (plan.core && !coreWeaponFits(plan.core, pool, defense)) ui.toast('本关暂缓核心武器：' + WEAPONS[plan.core].name);
        else if (skipped) ui.toast(`备战预设有变动，本关暂缓${skipped}项`);
      }
      this.lastPreparationStage = key;
    }
    const u = ui.u;
    const top = this.contentTop(ui);
    const L = this.battleLayout(ui);
    const ctx = ui.ctx;

    // 标题牌匾与副标题
    const ty = top + 62 * u;
    if (!NEW_UI) {
      ui.text(GAME_INFO.shortName, ui.W / 2 + 4 * u, ty + 4 * u, 88, '#3a0d12', 'center', null);
      ui.text(GAME_INFO.shortName, ui.W / 2, ty, 88, '#fee761', 'center', '#7a1c24');
      ui.text('— 乱世幸存者 —', ui.W / 2, ty + 66 * u, 28, '#fff4d6');
    } else {
      this.drawTitle(ui, ty - 14 * u);
    }

    // 点人物进武将页
    const hr = this.camp.heroBox;
    if (ui.clicked('home_hero', hr[0], hr[1], hr[2], hr[3])) this.openHero(save.hero);
    // 点营地里闲逛的武将：看他的详情
    for (const w of this.camp.heroRects) if (ui.clicked('camp_' + w.id, w.r[0], w.r[1], w.r[2], w.r[3])) this.openHero(w.id);

    // 侧边功能按钮
    const side: { id: string; icon: string; label: string; dot: boolean; on: () => void; show?: boolean; now?: boolean }[] = [
      { id: 'signin', icon: 'calendar', label: '签到', dot: canSignin(), on: () => game.openDialog(new SigninDialog()) },
      ...(newbieActive() ? [{ id: 'newbie', icon: 'chest_gold', label: '七日', dot: newbieRedDot(), on: () => game.openDialog(new NewbieDialog()) }] : []),
      { id: 'tasks', icon: 'scroll', label: '任务', dot: tasksRedDot(), on: () => game.openDialog(new TasksDialog()) },
      { id: 'patrol', icon: 'tent', label: '巡营', dot: patrolPending().minutes >= 60, on: () => game.openDialog(new PatrolDialog()) },
    ];
    const sideR: typeof side = [
      { id: 'rank', icon: 'trophy', label: IS_H5 ? '战绩' : '排行', dot: false, on: () => game.openDialog(new RankDialog()) },
      { id: 'codex', icon: 'p_book', label: '图鉴', dot: achRedDot() || codexUnclaimed() > 0, on: () => game.openDialog(new CodexDialog()) },
      { id: 'settings', icon: 'gear', label: '设置', dot: false, on: () => game.openDialog(new SettingsDialog()) },
    ];
    // 平台 / 社交类入口：哪边短排哪边
    const social: typeof side = [
      ...(IS_XHS && !save.xhsFollowClaimed ? [{ id: 'xhs', icon: 'hero_sunshangxiang_0', label: '关注', dot: true, on: () => game.openDialog(new XhsFollowDialog()) }] : []),
      ...(getPlatform().supportsGameClub() ? [{ id: 'club', icon: 'club', label: '游戏圈', dot: !save.daily.club, now: true, on: () => {
        save.daily.club = true; markDirty();
        getPlatform().report('game_club', { from: 'home' });
        getPlatform().openGameClub().then((ok) => { if (!ok) ui.toast('游戏圈暂时打不开，请稍后再试'); });
      } }] : []),
      ...(getPlatform().supportsRecommend() ? [{ id: 'recommend', icon: 'thumb', label: '推荐', dot: false, now: true, on: () => openRecommend('home') }] : []),
      ...(getPlatform().supportsUpdateNotice() && updateNotice !== 'accept' ? [{ id: 'notice', icon: 'bell', label: '更新提醒', dot: !save.tips.notice, now: true, on: () => {
        save.tips.notice = true; markDirty();
        getPlatform().requestUpdateNotice().then((r) => {
          getPlatform().report('update_notice', { ok: r === 'accept' ? 1 : 0 });
          if (r === 'accept') { updateNotice = 'accept'; ui.toast('订阅成功！新版本上线时会通知你'); }
          else if (r === 'reject') ui.toast('没有订阅。之前选过「不再询问」的话，可以在小游戏的设置里打开');
          else if (r === 'ban') ui.toast('更新提醒暂时不可用');
          else ui.toast('订阅失败：' + r);
        });
      } }] : []),
      ...(IS_H5 ? [] : [{ id: 'share', icon: 'share', label: '分享', dot: false, on: () => getPlatform().share('长坂坡七进七出，你能撑过几分钟？') }]),
    ];
    if (getPlatform().supportsSidebar() || getPlatform().name === 'tt') social.push({ id: 'sidebar', icon: 'sidebar', label: '侧边栏', dot: !save.daily.sidebar, on: () => game.openDialog(new SidebarDialog()) });
    for (const it of social) (side.length <= sideR.length ? side : sideR).push(it);
    const mh = 76 * u, my = L.cy - mh - 14 * u;
    const bs = 82 * u;
    const sy = top + 150 * u;
    const drawSide = (list: typeof side, x0: number, right: boolean) => list.forEach((s, i) => {
      // 按钮多时自动压缩间距、缩小按钮，不压到下面的模式页签
      const step = Math.min(bs + 44 * u, (my - 8 * u - sy) / list.length);
      const b = Math.min(bs, step - 34 * u);
      const x = right ? x0 + bs - b : x0;
      const y = sy + i * step;
      this.sideBtnRect[s.id] = [x, y, b, b];
      const pressed = ui.isPressed('side_' + s.id);
      if (!NEW_UI) {
        ui.panel(x, y + (pressed ? 3 * u : 0), b, b, 'dark');
        ui.icon(s.icon, x + b / 2, y + b * 0.5, b * 0.56);
        ui.text(s.label, x + b / 2, y + b + 16 * u, 20, '#fff');
      } else {
        drawSkin(ctx, 'medal' + (pressed ? 'P' : ''), x, y, b, b, 12 * u, (g, s0) => paintMedal(g, s0, u, pressed));
        ui.icon(s.icon, x + b / 2, y + b / 2 + (pressed ? 1.5 * u : 0), b * 0.56);
        ui.text(s.label, x + b / 2, y + b + 14 * u, 19, '#2a2018', 'center', 'rgba(250,242,224,0.92)');
      }
      if (s.dot) ui.redDot(x + b - 8 * u, y + 8 * u);
      if (s.now) ui.tapNow('side_' + s.id, x, y, b, b, s.on);
      else if (ui.clicked('side_' + s.id, x, y, b, b)) s.on();
    });
    drawSide(side, 20 * u, false);
    drawSide(sideR, ui.W - bs - 20 * u, true);

    // 模式切换：征战 / 天机签（守城、布阵在「演武」页）
    const mode = save.homeMode === 'tianji' ? 'tianji' : 'chapter';
    {
      const mw = 322 * u, gap = 14 * u;
      (['chapter', 'tianji'] as const).forEach((m, i) => {
        const mx = ui.W / 2 - mw - gap / 2 + i * (mw + gap);
        const label = m === 'chapter' ? '征  战' : '天 机 签';
        const on = mode === m;
        const pressed = ui.isPressed('mode_' + m);
        const lac = m === 'chapter' ? LACQUER.red : LACQUER.purple;
        if (on) {
          ui.markDark(mx, my, mw, mh);
          drawSkin(ctx, 'mode_' + m, mx, my, mw, mh, 16 * u, (g, w0, h0) => paintLacquerButton(g, w0, h0, u, lac, false));
        } else {
          ui.markPaper(mx, my, mw, mh);
          drawSkin(ctx, 'modeoff' + (pressed ? 'P' : ''), mx, my, mw, mh, 12 * u, (g, w0, h0) => paintSlipButton(g, w0, h0, u, m === 'chapter' ? '#b02c22' : '#6d3f8a', pressed, false));
        }
        const cyy = my + (mh - 5 * u) / 2 + (pressed && !on ? 3 * u : 0);
        const tw0 = ui.measure(label, 29);
        ui.icon(m === 'chapter' ? 'atk' : 'tj_tong', mx + mw / 2 - tw0 / 2 - 28 * u, cyy, 40 * u);
        ui.text(label, mx + mw / 2 + 18 * u, cyy + 1 * u, 29, on ? '#fff6e0' : '#2a2018', 'center', on ? lac.ink : null);
        if (m === 'tianji' && !on && !save.daily.tianjiRuns) ui.redDot(mx + mw - 10 * u, my + 8 * u);
        if (ui.clicked('mode_' + m, mx, my, mw, mh)) this.setMode(m);
      });
    }
    if (mode === 'tianji') { this.drawTianjiCard(ui, L); return; }

    // 章节卡（含难度切换）
    const ch = CHAPTERS[Math.min(CHAPTERS.length, save.selectedChapter) - 1];
    const d = save.selectedDiff || 0;
    const diff = DIFFICULTIES[d];
    const unlocked = chapterOpen(ch.id, d);
    const cw = ui.W - 80 * u, chH = L.chH;
    const cx = 40 * u, cy = L.cy;
    ui.panel(cx, cy, cw, chH, 'wood');
    // 难度页签：古籍乌丝栏 · 朱砂圈点样式（去掉笨重凹槽与实心绿砖）
    const tw = (cw - 60 * u) / 3;
    if (NEW_UI) {
      ctx.fillStyle = 'rgba(72,56,42,0.32)';
      ctx.fillRect(cx + 30 * u, cy + 64 * u, cw - 60 * u, Math.max(1, u * 1.2));
    }
    DIFFICULTIES.forEach((df, i) => {
      const open = diffOpen(df.id);
      const tx = cx + 30 * u + i * tw, ty = cy + 18 * u;
      const on = d === df.id;
      if (!NEW_UI) {
        ui.pixRect(tx + 4 * u, ty, tw - 8 * u, 46 * u, on ? df.color : '#231917');
        ui.text(df.name, tx + tw / 2, ty + 23 * u, 24, on ? '#1a1210' : open ? df.color : '#666', 'center', null);
      } else {
        const accent = df.id === 0 ? '#2b6e3f' : df.id === 1 ? '#b86818' : '#a82219';
        if (i > 0) {
          ctx.fillStyle = 'rgba(72,56,42,0.22)';
          ctx.fillRect(tx, ty + 10 * u, Math.max(1, u), 24 * u);
        }
        if (on) {
          const p = Math.max(2, Math.round(u * 2));
          ui.pixRect(tx + 8 * u, ty + 2 * u, tw - 16 * u, 40 * u, '#fbf5e6', p);
          ctx.strokeStyle = accent;
          ctx.lineWidth = Math.max(1.2, u * 1.5);
          ctx.strokeRect(tx + 10 * u, ty + 4 * u, tw - 20 * u, 36 * u);
          ctx.fillStyle = accent;
          ctx.fillRect(tx + 22 * u, ty + 4 * u, tw - 44 * u, 3 * u);
        }
        ui.text(on ? `◆ ${df.name} ◆` : df.name, tx + tw / 2, ty + 22 * u, 22, on ? accent : open ? '#3b2f24' : '#8a7c6c', 'center', null);
      }
      if (!open) ui.icon('lock', tx + tw - 26 * u, ty + 22 * u, 24 * u);
      if (ui.clicked('diff_' + df.id, tx, ty, tw, 46 * u)) {
        if (!open) ui.toast(`通关${DIFFICULTIES[df.id - 1].name}难度第1章解锁`);
        else { save.selectedDiff = df.id; markDirty(); }
      }
    });
    const oy = cy + 66 * u;
    if (!NEW_UI) {
      ui.text(`第${ch.id}章`, ui.W / 2, oy + 22 * u, 22, C.textDim);
      ui.text(ch.name, ui.W / 2, oy + 62 * u, 46, unlocked ? '#fff4d6' : '#8b8b8b');
      ui.text(ch.subtitle, ui.W / 2, oy + 104 * u, 22, C.gold);
    } else {
      ui.text(`— 第 ${ch.id} 章 —`, ui.W / 2, oy + 20 * u, 21, '#5c4d3e', 'center', null);
      // 章节名两侧对称水墨乌丝 + 朱砂菱印
      const nameW = ui.measure(ch.name, 46);
      const wingL = 56 * u;
      for (const dir of [-1, 1]) {
        const wx = ui.W / 2 + dir * (nameW / 2 + 18 * u);
        const wy = oy + 60 * u;
        ctx.fillStyle = '#382c22';
        ctx.fillRect(dir > 0 ? wx : wx - wingL, wy - 1.5 * u, wingL, 3 * u);
        ctx.fillStyle = '#b5281f';
        ctx.beginPath();
        ctx.moveTo(wx, wy - 5 * u);
        ctx.lineTo(wx + dir * 6 * u, wy);
        ctx.lineTo(wx, wy + 5 * u);
        ctx.lineTo(wx - dir * 6 * u, wy);
        ctx.closePath();
        ctx.fill();
      }
      ui.text(ch.name, ui.W / 2, oy + 60 * u, 46, unlocked ? '#1a1410' : '#7a6e62', 'center', 'rgba(255,248,234,0.85)');
      ui.text(`【 ${ch.subtitle} 】`, ui.W / 2, oy + 102 * u, 22, '#a8241b', 'center', null);
    }
    const best = getBest(d, ch.id);
    const cleared = isCleared(d, ch.id);
    const info = cleared ? `${diff.name}已通关 ${starRating(chapterStars(d, ch.id))}` : best ? `最佳坚守 ${fmtTime(best)}` : '尚未挑战';
    const power = combatPower();
    const short = recommendedPower(ch, diff, 5), long = recommendedPower(ch, diff, 10);
    // 碾压直接获三星，两个可选时长都要达到碾压门槛。
    const need = short === null || long === null ? null : Math.max(short, long);
    let powerLabel = '推荐战力 ' + powerGuideText(short);
    if (short === null && long === null) powerLabel = '极限挑战';
    else if (short !== null && long !== null && short !== long) {
      powerLabel = `推荐 ${powerGuideText(Math.min(short, long))}～${powerGuideText(need)}`;
    } else if (short !== long) powerLabel = `推荐 ${powerGuideText(short ?? long)}起 · 含极限`;
    else if (!WEB_RULES && need !== null) powerLabel = '推荐战力 ' + fmtNum(need);
    // 进度与推荐战力放在同一行
    if (NEW_UI) {
      const barW = cw - 96 * u, barH = 34 * u, barX = cx + 48 * u, barY = oy + 124 * u;
      ui.pixRect(barX, barY, barW, barH, 'rgba(255,250,240,0.48)', Math.max(2, Math.round(u * 2)));
      ctx.strokeStyle = 'rgba(120,98,74,0.38)';
      ctx.lineWidth = Math.max(1, u);
      ctx.strokeRect(barX + 1, barY + 1, barW - 2, barH - 2);
    }
    ui.text(info, ui.W / 2 - 14 * u, oy + 141 * u, 20, cleared ? '#9be37a' : '#e6d3b3', 'right', NEW_UI ? null : undefined);
    ui.text(powerLabel, ui.W / 2 + 14 * u, oy + 141 * u, 20, need !== null && power >= need ? '#9be37a' : '#ff8a80', 'left', NEW_UI ? null : undefined);
    ui.pixRect(ui.W / 2 - 1 * u, oy + 131 * u, 2 * u, 20 * u, '#8c663b');
    if (!unlocked) {
      ui.ctx.fillStyle = 'rgba(20,16,12,0.58)';
      ui.ctx.fillRect(cx + 12 * u, oy + 2 * u, cw - 24 * u, chH - 78 * u);
      ui.icon('lock', ui.W / 2, oy + 52 * u, 70 * u);
      ui.text(d === 0 ? `通关第${ch.id - 1}章解锁` : `通关${DIFFICULTIES[d - 1].name}难度第${ch.id}章解锁`, ui.W / 2, oy + 112 * u, 26, '#fff4d6', 'center', '#140e0b');
    }
    if (ui.clicked('chapter_story', cx + 100 * u, oy, cw - 200 * u, chH - 70 * u)) game.openDialog(new ChapterStoryDialog(ch.id, d));
    // 左右切换
    const aw = 70 * u;
    const arrowCols = NEW_UI ? ['#5c4f42', '#362d25', '#8a7866'] : C.btnGray;
    if (save.selectedChapter > 1 && ui.button('ch_prev', cx - 10 * u, oy + 66 * u - aw / 2, aw, aw, '◀', arrowCols, { size: 26 })) { save.selectedChapter--; markDirty(); }
    if (save.selectedChapter < CHAPTERS.length && ui.button('ch_next', cx + cw - aw + 10 * u, oy + 66 * u - aw / 2, aw, aw, '▶', arrowCols, { size: 26 })) { save.selectedChapter++; markDirty(); }

    // 出征按钮
    const bw = 400 * u, bh = L.bh;
    const by = L.by;
    // 战力碾压：战力达到推荐的 SWEEP_K 倍，可以不打直接拿胜利奖励（出征按钮让出一半位置）
    const canSweep = unlocked && power >= (need ?? legacyChapterPower(ch, diff)) * SWEEP_K;
    if (canSweep) {
      if (ui.button('start_battle', ui.W / 2 - 200 * u, by, 250 * u, bh, '出 征', C.btnRed, { size: 42, sub: `体力 ${STAMINA.costPerRun}` })) this.withPrepCheck(() => this.chooseCampaign(ch.id, d));
      const sweepLabel = WEB_RULES ? (chapterStars(d, ch.id) === THREE_STARS ? undefined : '三星领元宝') : '免挑战';
      if (ui.button('sweep_battle', ui.W / 2 + 60 * u, by, 140 * u, bh, '碾压', C.btnGold, { size: 34, sub: sweepLabel })) {
        this.sweep(() => settleRun(ch, diff, true, WEB_RULES ? null : ch.duration, 150, 1500, 2, 2, THREE_STARS), `第${ch.id}章 ${ch.name}`, 'chapter', ch.id, d);
      }
    } else if (ui.button('start_battle', ui.W / 2 - bw / 2, by, bw, bh, '出 征', C.btnRed, { size: 48, disabled: !unlocked, sub: `消耗体力 ${STAMINA.costPerRun}` })) this.withPrepCheck(() => this.chooseCampaign(ch.id, d));
    this.startRect = [ui.W / 2 - bw / 2, by, bw, bh];
    // 备战（兵器 / 兵法预设）
    const ew = 150 * u;
    if (ui.button('side_prepare', 20 * u, by, ew, bh, '备战', C.btnGold, { size: 32, sub: '兵器兵法' })) game.openDialog(new PreparationDialog());
    // 章节总览
    if (ui.button('chapters', ui.W - ew - 20 * u, by, ew, bh, '章节', C.btnBlue, { size: 32, sub: `${save.maxCleared}/${CHAPTERS.length}` })) game.openDialog(new ChapterListDialog((c, dd) => { save.selectedChapter = c; save.selectedDiff = dd; markDirty(); }));
  }
  private startRect: [number, number, number, number] = [0, 0, 0, 0];

  /** 天机签卡片：无名剑客待机 + 规则一句话 + 纪录 + 今日奖励次数；不耗体力 */
  private drawTianjiCard(ui: UI, L: { chH: number; bh: number; by: number; cy: number }) {
    const u = ui.u, ctx = ui.ctx, st = save.tianji;
    const y = L.cy, cx = ui.W / 2, cw = ui.W - 80 * u;
    ui.panel(40 * u, y, cw, L.chH, 'paper');
    this.cardBanner(ui, y, '◆ 天机签 · 无名剑客 ◆', '#6d3f8a');
    void ctx;
    // 左：剑客站在签筒旁（待机动画）
    const sx = 160 * u, sy = y + 66 * u + (L.chH - 66 * u) * 0.48;
    ui.icon(heroIdleFrame('hero_wuming_awk', ui.time), sx, sy, Math.min(200 * u, (L.chH - 70 * u) * 1.05));
    ui.icon('tj_tong', sx + 96 * u, sy + 34 * u, 64 * u);
    // 右：规则与纪录
    const tx = 300 * u;
    // 卡片高度随屏幕变化（约 230 单位），四行按卡高均分
    const row = (L.chH - 70 * u) / 4.2;
    ui.text('生存十分钟 · 全凭签运', tx, y + 70 * u + row * 0.55, 29, '#2a1d14', 'left', null);
    ui.text('砍树打怪攒金币，摇签得兵器、借名将', tx, y + 70 * u + row * 1.55, 19, '#5c4d3e', 'left', null);

    ui.text(st.bestDmg ? `天命伤害最佳 ${fmtNum(st.bestDmg)} · 养成带入 装备10% 军略50%` : '养成带入：装备 10% · 军略 50%', tx, y + 70 * u + row * 2.5, 19, '#6a3a9a', 'left', null);
    ui.text('每局都有奖励 · 活得越久、伤害越高越多', tx, y + 70 * u + row * 3.45, 19, '#a22633', 'left', null);
    if (ui.button('tj_rules', 30 * u, L.by, 150 * u, L.bh, '玩法', C.btnGray, { size: 27, sub: '签与概率' })) game.openDialog(new TianjiRulesDialog());
    if (ui.button('tj_rank', 190 * u, L.by, 150 * u, L.bh, '排行', C.btnBlue, { size: 27, sub: '天命伤害' })) game.openDialog(new RankDialog('tianji'));
    this.startRect = [350 * u, L.by, 370 * u, L.bh];
    if (ui.button('tj_start', ...this.startRect, '入 局', C.btnRed, { size: 44, sub: `体力 ${TIANJI_STAMINA}` })) {
      if (!spendStamina(TIANJI_STAMINA)) { game.openDialog(new StaminaDialog()); return; }
      if (save.guide === 6) save.guide = 99;
      flushSave(true);
      playSfx('boss');
      game.setScene(new BattleScene(-4));
    }
  }

  private drawTowerCard(ui: UI, L: { chH: number; bh: number; by: number; cy: number }) {
    const u = ui.u, st = save.tower;
    const map = TOWER_MAPS[st.selected - 1] || TOWER_MAPS[0];
    const open = map.id <= st.cleared + 1, y = L.cy, cx = ui.W / 2;
    ui.panel(40 * u, y, ui.W - 80 * u, L.chH, 'paper');
    this.cardBanner(ui, y, `◆ 布阵 · 第 ${map.id} 关 ◆`, '#2f6488');
    ui.text(map.name, cx, y + 88 * u, 44, C.text);
    ui.text(map.hint, cx, y + 138 * u, 23, C.textDim);
    const stars = st.stars[map.id] || 0;
    ui.text(open ? '★'.repeat(stars) + '☆'.repeat(3 - stars) + `   ·   ${map.waves} 波进攻` : `通关第 ${map.id - 1} 关解锁`, cx, y + 192 * u, 23, C.gold);
    if (map.id > 1 && ui.button('td_prev', 34 * u, y + 56 * u, 76 * u, 82 * u, '◀', C.btnGray)) { st.selected = map.id - 1; markDirty(); }
    if (map.id < TOWER_MAPS.length && ui.button('td_next', ui.W - 110 * u, y + 56 * u, 76 * u, 82 * u, '▶', C.btnGray)) { st.selected = map.id + 1; markDirty(); }
    const hero = towerCommander(), state = save.heroes[hero];
    const pct = Math.round(100 * commandBonus(state.lv, state.star, state.peak || 0));
    if (ui.button('td_list', 30 * u, L.by, 142 * u, L.bh, '选关', C.btnGray, { size: 27, sub: `${st.cleared}/${TOWER_MAPS.length}` })) game.openDialog(new TowerStageDialog());
    if (ui.button('td_commander', 182 * u, L.by, 238 * u, L.bh, '将令 · ' + HERO_BY_ID[hero].name, C.btnBlue, { size: 27, sub: `全塔加成 +${pct}% · 换将` })) game.openDialog(new CommanderDialog());
    this.startRect = [432 * u, L.by, 288 * u, L.bh];
    if (ui.button('td_start', ...this.startRect, '布 阵', C.btnRed, { disabled: !open, sub: `体力 ${STAMINA.costPerRun}` })) {
      if (!spendStamina()) { game.openDialog(new StaminaDialog()); return; }
      if (save.guide === 6) save.guide = 99;
      flushSave(true); game.setScene(new TowerScene(map.id));
    }
  }

  /** 守城关卡卡片：和章节卡同样的位置与布局，十关依次解锁 */
  private drawDefenseCard(ui: UI, L: { chH: number; bh: number; by: number; cy: number }) {
    const u = ui.u;
    const ctx = ui.ctx;
    const n = DEFENSE_LEVEL_COUNT;
    const lv = Math.max(1, Math.min(n, save.selectedDefense || 1));
    const ch = defenseChapter(lv);
    const open = defenseOpen(lv);
    const cleared = (save.defense?.cleared || 0) >= lv;
    const cw = ui.W - 80 * u, chH = L.chH;
    const cx = 40 * u, cy = L.cy;
    ui.panel(cx, cy, cw, chH, 'wood');
    if (!NEW_UI) {
      ui.pixRect(cx + 30 * u, cy + 20 * u, cw - 60 * u, 46 * u, '#2f7a3a');
      ui.text(`守城 · 第${lv}关`, ui.W / 2, cy + 43 * u, 24, '#fff4d6', 'center', null);
    } else {
      this.cardBanner(ui, cy, `◆ 守城 · 第 ${lv} 关 ◆`, '#2d7848');
    }
    const oy = cy + 66 * u;
    ui.text(WEB_RULES ? '守护城池 · 击败攻城主将' : '坚守五分钟 · 四面御敌', ui.W / 2, oy + 20 * u, 21, NEW_UI ? '#5c4d3e' : C.textDim);
    if (!NEW_UI) {
      ui.text(ch.name, ui.W / 2, oy + 62 * u, 46, open ? '#fff4d6' : '#8b8b8b');
      ui.text(ch.subtitle, ui.W / 2, oy + 104 * u, 22, C.gold);
    } else {
      const nameW = ui.measure(ch.name, 46);
      const wingL = 56 * u;
      for (const dir of [-1, 1]) {
        const wx = ui.W / 2 + dir * (nameW / 2 + 18 * u);
        const wy = oy + 60 * u;
        ctx.fillStyle = '#382c22';
        ctx.fillRect(dir > 0 ? wx : wx - wingL, wy - 1.5 * u, wingL, 3 * u);
        ctx.fillStyle = '#255c35';
        ctx.beginPath();
        ctx.moveTo(wx, wy - 5 * u);
        ctx.lineTo(wx + dir * 6 * u, wy);
        ctx.lineTo(wx, wy + 5 * u);
        ctx.lineTo(wx - dir * 6 * u, wy);
        ctx.closePath();
        ctx.fill();
      }
      ui.text(ch.name, ui.W / 2, oy + 60 * u, 46, open ? '#1a1410' : '#7a6e62', 'center', 'rgba(255,248,234,0.85)');
      ui.text(`【 ${ch.subtitle} 】`, ui.W / 2, oy + 102 * u, 22, '#a8241b', 'center', null);
    }
    const power = combatPower();
    if (NEW_UI) {
      const barW = cw - 96 * u, barH = 34 * u, barX = cx + 48 * u, barY = oy + 124 * u;
      ui.pixRect(barX, barY, barW, barH, 'rgba(255,250,240,0.48)', Math.max(2, Math.round(u * 2)));
      ctx.strokeStyle = 'rgba(120,98,74,0.38)';
      ctx.lineWidth = Math.max(1, u);
      ctx.strokeRect(barX + 1, barY + 1, barW - 2, barH - 2);
    }
    ui.text(cleared ? (WEB_RULES ? '已守住 ' + starRating(defenseStars(lv)) : '已守住 ✓') : '尚未守住', ui.W / 2 - 14 * u, oy + 141 * u, 20, cleared ? '#9be37a' : '#e6d3b3', 'right', NEW_UI ? null : undefined);
    ui.text(`推荐战力 ${fmtNum(ch.power)}`, ui.W / 2 + 14 * u, oy + 141 * u, 20, power >= ch.power ? '#9be37a' : '#ff8a80', 'left', NEW_UI ? null : undefined);
    ui.pixRect(ui.W / 2 - 1 * u, oy + 131 * u, 2 * u, 20 * u, '#8c663b');
    if (!open) {
      ui.ctx.fillStyle = 'rgba(20,16,12,0.58)';
      ui.ctx.fillRect(cx + 12 * u, oy + 2 * u, cw - 24 * u, chH - 78 * u);
      ui.icon('lock', ui.W / 2, oy + 52 * u, 70 * u);
      ui.text(`守住第${lv - 1}关解锁`, ui.W / 2, oy + 112 * u, 26, '#fff4d6', 'center', '#140e0b');
    }
    if (ui.clicked('def_story', cx + 100 * u, oy, cw - 200 * u, chH - 70 * u)) game.openDialog(new TextDialog(`守城 · ${ch.name}`, ch.story));
    const aw = 70 * u;
    const arrowCols = NEW_UI ? ['#5c4f42', '#362d25', '#8a7866'] : C.btnGray;
    if (lv > 1 && ui.button('def_prev', cx - 10 * u, oy + 66 * u - aw / 2, aw, aw, '◀', arrowCols, { size: 26 })) { save.selectedDefense = lv - 1; markDirty(); }
    if (lv < n && ui.button('def_next', cx + cw - aw + 10 * u, oy + 66 * u - aw / 2, aw, aw, '▶', arrowCols, { size: 26 })) { save.selectedDefense = lv + 1; markDirty(); }
    // 出征 / 无尽 / 关卡总览
    const bw = 400 * u, bh = L.bh, by = L.by;
    if (open && power >= ch.power * SWEEP_K) {
      if (ui.button('start_defense', ui.W / 2 - 200 * u, by, 250 * u, bh, '守 城', C.btnGreen, { size: 42, sub: `体力 ${STAMINA.costPerRun}` })) this.withPrepCheck(() => this.startBattle(-3, lv));
      const sweepLabel = WEB_RULES ? (defenseStars(lv) === THREE_STARS ? undefined : '三星领元宝') : '免挑战';
      if (ui.button('sweep_defense', ui.W / 2 + 60 * u, by, 140 * u, bh, '碾压', C.btnGold, { size: 34, sub: sweepLabel })) this.sweep(() => settleDefense(lv, true, WEB_RULES ? null : ch.duration, 120, 1200, 2, 1, 12, WEB_RULES ? THREE_STARS : undefined), `守城 · ${ch.name}`, 'defense', lv, 0);
    } else if (ui.button('start_defense', ui.W / 2 - bw / 2, by, bw, bh, '守 城', C.btnGreen, { size: 48, disabled: !open, sub: `消耗体力 ${STAMINA.costPerRun}` })) this.withPrepCheck(() => this.startBattle(-3, lv));
    this.startRect = [ui.W / 2 - bw / 2, by, bw, bh];
    const ew = 150 * u;
    if (ui.button('side_prepare', 20 * u, by, ew, bh, '备战', C.btnGold, { size: 32, sub: '兵器兵法' })) game.openDialog(new PreparationDialog());
    if (ui.button('def_list', ui.W - ew - 20 * u, by, ew, bh, '关卡', C.btnBlue, { size: 32, sub: `${save.defense?.cleared || 0}/${n}` })) game.openDialog(new DefenseListDialog((l) => { save.selectedDefense = l; markDirty(); }));
  }

  /** 主界面标题：焦墨大字 + 鎏金衬线 + 朱文方印（静态，整条缓存） */
  private drawTitle(ui: UI, ty: number) {
    const u = ui.u, W = ui.W, lh = Math.ceil(230 * u), mid = 92 * u;
    const layer = cachedLayer('home_title', `${u}`, W, lh, (g) => {
      const cx = W / 2, name = GAME_INFO.shortName;
      // 字后面一团绢色云气
      g.save();
      g.translate(cx, mid + 6 * u);
      g.scale(3.4, 1);
      const halo = g.createRadialGradient(0, 0, 8 * u, 0, 0, 88 * u);
      halo.addColorStop(0, 'rgba(252,244,224,0.86)');
      halo.addColorStop(0.6, 'rgba(250,240,214,0.4)');
      halo.addColorStop(1, 'rgba(250,240,214,0)');
      g.fillStyle = halo;
      g.beginPath(); g.arc(0, 0, 88 * u, 0, Math.PI * 2); g.fill();
      g.restore();
      g.font = ui.font(84, true);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.fillStyle = 'rgba(70,40,14,0.28)';
      g.fillText(name, cx + 3 * u, mid + 7 * u);
      g.lineWidth = 15 * u; g.strokeStyle = '#fdf6e4'; g.strokeText(name, cx, mid);
      g.lineWidth = 7 * u; g.strokeStyle = '#e0bf7a'; g.strokeText(name, cx, mid);
      g.lineWidth = 3.4 * u; g.strokeStyle = '#6a4a1c'; g.strokeText(name, cx, mid);
      const tg = g.createLinearGradient(0, mid - 44 * u, 0, mid + 42 * u);
      tg.addColorStop(0, '#4a3a2e'); tg.addColorStop(0.4, '#1e1612'); tg.addColorStop(1, '#0a0705');
      g.fillStyle = tg;
      g.fillText(name, cx, mid);
      // 朱文方印
      const tw = g.measureText(name).width;
      const ss = 46 * u, sx = cx + tw / 2 + 6 * u, sy = mid - 46 * u;
      softShadow(g, sx, sy, ss, ss, 6 * u, 4 * u, 0.2, 2 * u);
      rr(g, sx, sy, ss, ss, 6 * u);
      const sgr = g.createLinearGradient(0, sy, 0, sy + ss);
      sgr.addColorStop(0, '#d44a3a'); sgr.addColorStop(1, '#a3241a');
      g.fillStyle = sgr; g.fill();
      rr(g, sx + 3 * u, sy + 3 * u, ss - 6 * u, ss - 6 * u, 3.5 * u);
      g.strokeStyle = 'rgba(255,240,214,0.9)'; g.lineWidth = Math.max(1, 1.4 * u); g.stroke();
      g.font = ui.font(17, true);
      g.fillStyle = '#fff3dc';
      g.fillText('单', sx + ss / 2, sy + ss * 0.31);
      g.fillText('骑', sx + ss / 2, sy + ss * 0.71);
      // 副标题：两道鎏金线夹一行朱字
      const sy0 = mid + 72 * u, sub = '乱 世 幸 存 者';
      g.font = ui.font(23, true);
      const sw = g.measureText(sub).width;
      g.lineWidth = 6 * u; g.strokeStyle = 'rgba(253,246,228,0.95)'; g.strokeText(sub, cx, sy0);
      g.fillStyle = '#a3241a';
      g.fillText(sub, cx, sy0);
      for (const dir of [-1, 1]) {
        const x0 = cx + dir * (sw / 2 + 22 * u), x1 = cx + dir * (sw / 2 + 150 * u);
        const lg = g.createLinearGradient(x0, 0, x1, 0);
        lg.addColorStop(0, 'rgba(150,104,40,0.95)'); lg.addColorStop(1, 'rgba(150,104,40,0)');
        g.fillStyle = lg;
        g.fillRect(Math.min(x0, x1), sy0 - 1.2 * u, Math.abs(x1 - x0), 2.4 * u);
        g.fillStyle = '#b8862e';
        const dx = cx + dir * (sw / 2 + 12 * u), d = 4.5 * u;
        g.beginPath(); g.moveTo(dx, sy0 - d); g.lineTo(dx + d, sy0); g.lineTo(dx, sy0 + d); g.lineTo(dx - d, sy0); g.closePath(); g.fill();
      }
    });
    ui.ctx.drawImage(layer, 0, Math.round(ty - mid));
  }

  // —— 演武页：守城 / 布阵 / 无尽 / 每周挑战 ——
  private drawArenaTab(ui: UI) {
    const u = ui.u, ctx = ui.ctx, W = ui.W;
    const top = this.contentTop(ui);
    const L = this.battleLayout(ui);
    ui.ribbon(W / 2, top + 26 * u, 330 * u, '演 武 场');
    const today = new Date().toISOString().slice(0, 10);
    const eo = endlessOpen();
    const wk = currentWeekly();
    const tiles: { id: 'defense' | 'tower' | 'endless' | 'weekly'; name: string; sub: string; info: string; lac: typeof LACQUER.red; dot: boolean; lock?: string }[] = [
      { id: 'defense', name: '守 城', sub: '调兵遣将 · 固守城池', info: `已守 ${save.defense?.cleared || 0}/${DEFENSE_LEVEL_COUNT}`, lac: LACQUER.green, dot: save.defense?.day !== today },
      { id: 'tower', name: '布 阵', sub: '据险设塔 · 以阵破敌', info: `通关 ${save.tower.cleared}/${TOWER_MAPS.length}`, lac: LACQUER.blue, dot: false },
      { id: 'endless', name: '无 尽', sub: '敌军无穷 · 能撑多久', info: save.endlessBest ? '最佳 ' + fmtTime(save.endlessBest) : '尚未挑战', lac: LACQUER.purple, dot: false, lock: eo ? undefined : `通关第${ENDLESS_UNLOCK}章解锁` },
      { id: 'weekly', name: '每周挑战', sub: wk.name + ' · 每周一更换', info: `本周最佳 ${fmtNum(save.weekly.best)}`, lac: TILE_AMBER, dot: eo && weeklyRedDot(), lock: eo ? undefined : `通关第${ENDLESS_UNLOCK}章解锁` },
    ];
    const gx = 24 * u, gap = 16 * u, gy = top + 76 * u;
    const tw = (W - gx * 2 - gap) / 2;
    const th = Math.max(150 * u, Math.min(400 * u, (L.cy - 22 * u - gy - gap) / 2));
    const t = ui.time;
    tiles.forEach((tile, i) => {
      const x = gx + (i % 2) * (tw + gap), y = gy + Math.floor(i / 2) * (th + gap);
      const sel = this.arenaSel === tile.id;
      const pressed = ui.isPressed(tile.id === 'weekly' ? 'side_weekly' : 'arena_' + tile.id);
      ui.markDark(x, y, tw, th);
      drawSkin(ctx, 'ar_' + tile.id + (sel ? 'S' : '') + (pressed ? 'P' : ''), x, y, tw, th, 20 * u, (g, w0, h0) => paintArenaTile(g, w0, h0, u, tile.lac, sel, pressed));
      // 插画：用游戏里的像素形象现场摆（会动）
      const ax = x + tw * 0.62, ay = y + th * 0.4, k = Math.min(1, th / (250 * u));
      if (tile.id === 'defense') {
        ui.icon('city', ax, ay + 6 * u, 190 * u * k);
        ui.icon(`u_wei_spear_${Math.floor(t * 5) % 4}`, x + tw * 0.2, ay + 44 * u * k, 56 * u * k);
        ui.icon(`u_wei_shield_${Math.floor(t * 5 + 1) % 4}`, x + tw * 0.31, ay + 62 * u * k, 56 * u * k);
      } else if (tile.id === 'tower') {
        ui.icon('td_gate', x + tw * 0.74, ay - 4 * u, 150 * u * k);
        ui.icon('td_arrow3' + (Math.floor(t * 1.5) % 3 === 1 ? '_p1' : ''), x + tw * 0.4, ay + 22 * u * k, 96 * u * k);
        ui.icon('td_stone2', x + tw * 0.2, ay + 48 * u * k, 84 * u * k);
      } else if (tile.id === 'endless') {
        ui.icon(heroIdleFrame(heroSpriteName(save.hero), t), x + tw * 0.5, ay + 10 * u * k, 130 * u * k, tile.lock ? 0.6 : 1);
        for (let j = 0; j < 5; j++) {
          const a = j / 5 * Math.PI * 2 + 0.5, f = Math.floor(t * 5 + j) % 4;
          ui.icon(`u_${['wei_spear', 'bandit', 'wei_heavy', 'yuan_spear', 'wu_spear'][j]}_${f}${Math.cos(a) > 0 ? '_L' : ''}`, x + tw * 0.5 + Math.cos(a) * tw * 0.34, ay + 16 * u * k + Math.sin(a) * th * 0.16, 50 * u * k, tile.lock ? 0.5 : 0.95);
        }
      } else {
        ui.icon('trophy', x + tw * 0.5, ay + 4 * u + Math.sin(t * 2) * 3 * u, 120 * u * k, tile.lock ? 0.6 : 1);
        ui.icon('w_blade', x + tw * 0.24, ay + 20 * u * k, 64 * u * k, 0.9);
        ui.icon('w_spear', x + tw * 0.77, ay + 20 * u * k, 64 * u * k, 0.9);
      }
      // 左上角进度小牌
      const iw = ui.measure(tile.info, 18) + 30 * u;
      drawSkin(ctx, 'ar_chip', x + 14 * u, y + 14 * u, iw, 34 * u, 6 * u, (g, w0, h0) => paintInkPill(g, w0, h0, u, 0.78, false));
      ui.text(tile.info, x + 14 * u + iw / 2, y + 31.5 * u, 18, '#ffe9c0', 'center', null);
      ui.text(tile.name, x + 24 * u, y + th - 62 * u, 36, '#fff6e0', 'left', tile.lac.ink);
      ui.text(tile.sub, x + 24 * u, y + th - 26 * u, 19, '#ffe9c0', 'left', null);
      if (tile.lock) {
        ctx.fillStyle = 'rgba(16,10,6,0.5)';
        rr(ctx, x + 3 * u, y + 3 * u, tw - 6 * u, th - 6 * u, 13 * u); ctx.fill();
        ui.icon('lock', x + tw / 2, y + th * 0.4, 64 * u);
        ui.text(tile.lock, x + tw / 2, y + th * 0.4 + 56 * u, 22, '#fff4d6', 'center', '#140e0b');
      }
      if (tile.dot) ui.redDot(x + tw - 12 * u, y + 12 * u);
      if (tile.id === 'weekly') {
        if (ui.clicked('side_weekly', x, y, tw, th)) { if (eo) game.openDialog(new WeeklyDialog()); else ui.toast(`通关第${ENDLESS_UNLOCK}章解锁每周挑战`); }
      } else if (ui.clicked('arena_' + tile.id, x, y, tw, th)) {
        this.arenaSel = tile.id;
        if (tile.id !== 'endless') this.setMode(tile.id);
      }
    });
    if (this.arenaSel === 'defense') this.drawDefenseCard(ui, L);
    else if (this.arenaSel === 'tower') this.drawTowerCard(ui, L);
    else this.drawEndlessCard(ui, L);
  }

  private drawEndlessCard(ui: UI, L: { chH: number; bh: number; by: number; cy: number }) {
    const u = ui.u, ctx = ui.ctx, cx = ui.W / 2, cw = ui.W - 80 * u, y = L.cy;
    const eo = endlessOpen();
    ui.panel(40 * u, y, cw, L.chH, 'paper');
    this.cardBanner(ui, y, '◆ 无尽模式 ◆', '#6d3f8a');
    void ctx;
    const row = (L.chH - 70 * u) / 3.3;
    ui.text('敌军源源不绝，越战越强', cx, y + 72 * u + row * 0.55, 30, '#2a1d14', 'center', null);
    ui.text('每坚守 3 分钟：元宝 ×9、武将碎片 ×2 · 15 分钟后敌将成双', cx, y + 72 * u + row * 1.55, 19, '#5c4d3e', 'center', null);
    ui.text(save.endlessBest ? `最佳坚守 ${fmtTime(save.endlessBest)}` : eo ? '尚未挑战 · 看看你能撑多久' : `通关第 ${ENDLESS_UNLOCK} 章解锁`, cx, y + 72 * u + row * 2.5, 22, eo ? '#6d3f8a' : '#a22633', 'center', null);
    const bw = 400 * u, ew = 150 * u;
    if (ui.button('side_prepare', 20 * u, L.by, ew, L.bh, '备战', C.btnGold, { size: 32, sub: '兵器兵法' })) game.openDialog(new PreparationDialog());
    this.startRect = [cx - bw / 2, L.by, bw, L.bh];
    if (ui.button('endless', cx - bw / 2, L.by, bw, L.bh, '出 征', C.btnRed, { size: 48, disabled: !eo, sub: eo ? `消耗体力 ${STAMINA.costPerRun}` : `通关第${ENDLESS_UNLOCK}章解锁` })) this.startBattle(0, 0);
    if (ui.button('endless_rank', ui.W - ew - 20 * u, L.by, ew, L.bh, IS_H5 ? '战绩' : '排行', C.btnBlue, { size: 32, sub: '无尽' })) game.openDialog(new RankDialog());
  }

  /** 卡片顶部的小题签（天机签 / 守城 / 无尽共用） */
  private cardBanner(ui: UI, y: number, label: string, color: string) {
    const u = ui.u, ctx = ui.ctx, cx = ui.W / 2;
    const tw = ui.measure(label, 23);
    const x0 = cx - tw / 2 - 26 * u, x1 = cx + tw / 2 + 26 * u, yy = y + 40 * u;
    for (const dir of [-1, 1]) {
      const xa = dir < 0 ? x0 : x1, xb = dir < 0 ? 84 * u : ui.W - 84 * u;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(Math.min(xa, xb), yy - 0.8 * u, Math.abs(xb - xa), 1.6 * u);
      ctx.globalAlpha = 1;
    }
    ui.text(label, cx, yy, 23, color, 'center', null);
  }

  /** 战力碾压：扣体力，直接按胜利结算 */
  private sweep(settle: () => RunResult, title: string, mode: string, chapter: number, diff: number) {
    if (!spendStamina()) { game.openDialog(new StaminaDialog()); return; }
    const res = settle();
    if (WEB_RULES && save.guide === 6) save.guide = 99;
    save.stats.runs++;
    save.stats.wins++;
    getPlatform().report('battle_end', { mode: 'sweep_' + mode, chapter, diff, hero: save.hero, win: 1, sec: 0, kills: 0, level: 0, boss_sec: 0, revives: 0 });
    flushSave(true);
    playSfx('victory');
    game.openDialog(new SweepDialog(title, res));
  }

  /** 征战 / 守城出发前：备战还没设置（当前方案没有兵器、兵法、核心武器）就先提醒；新手引导期间、今天点过不再提醒时不弹 */
  private withPrepCheck(go: () => void) {
    const plan = activePreparationFor(save.hero);
    const empty = !plan.skills.length && !plan.core;
    if (WEB_RULES && empty && save.guide >= 99 && !save.daily.prepNoRemind) game.openDialog(new PrepReminderDialog(go));
    else go();
  }

  private chooseCampaign(id: number, diff: number) {
    if (WEB_RULES) {
      game.openDialog(new CampaignDurationDialog(id, diff, picked => this.startBattle(id, diff, picked)));
    } else this.startBattle(id, diff);
  }

  private startBattle(id: number, diff = 0, minutes?: 5 | 10) {
    if (!spendStamina()) {
      game.openDialog(new StaminaDialog());
      return;
    }
    if (save.guide === 6) save.guide = 99;
    flushSave(true);
    playSfx('boss');
    game.setScene(new BattleScene(id, diff, minutes));
  }

  // —— 装备页 ——
  private drawEquipTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    const panelH = 590 * u;
    ui.panel(16 * u, top, ui.W - 32 * u, panelH, 'wood');
    // 人物
    if (!NEW_UI) {
      ui.ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ui.ctx.fillRect(ui.W / 2 - 150 * u, top + 60 * u, 300 * u, 330 * u);
    } else {
      // 水墨圆月景窗立绘底座
      const bx = ui.W / 2 - 150 * u, by0 = top + 68 * u, bw0 = 300 * u, bh0 = 320 * u;
      ui.pixRect(bx, by0, bw0, bh0, '#8c7a62', Math.max(2, Math.round(u * 3)));
      ui.pixRect(bx + 3 * u, by0 + 3 * u, bw0 - 6 * u, bh0 - 6 * u, '#ded0b4', Math.max(2, Math.round(u * 2)));
      ui.ctx.fillStyle = 'rgba(255,250,240,0.55)';
      ui.ctx.beginPath();
      ui.ctx.arc(ui.W / 2, by0 + bh0 * 0.48, 112 * u, 0, Math.PI * 2);
      ui.ctx.fill();
      ui.ctx.strokeStyle = 'rgba(72,56,42,0.25)';
      ui.ctx.lineWidth = Math.max(1, 1.5 * u);
      ui.ctx.stroke();
      ui.paperTexture(bx + 3 * u, by0 + 3 * u, bw0 - 6 * u, bh0 - 6 * u, { alpha: 0.78, patina: true });
    }
    ui.icon(heroIdleFrame(heroSpriteName(save.hero), ui.time), ui.W / 2, top + 230 * u, 280 * u);
    ui.text(`${HERO_BY_ID[save.hero].name} · Lv.${save.heroes[save.hero].lv}`, ui.W / 2, top + 50 * u, 28, C.gold);
    const st = computeStats();
    ui.text(`攻击 ${fmtNum(st.atk)}`, ui.W / 2 - 80 * u, top + 425 * u, 26, '#ffb070');
    ui.text(`生命 ${fmtNum(st.hp)}`, ui.W / 2 + 80 * u, top + 425 * u, 26, '#9be37a');
    // 套装
    const tids = SLOTS.map((sl) => getEquipped(sl)).filter((x) => !!x).map((x) => x!.tid);
    const sets = setBonuses(tids).active;
    if (sets.length) ui.text(sets.map((a) => `${a.name}${a.n}/6`).join('  '), ui.W / 2, top + 458 * u, 18, '#dc9be9');
    // 六个槽位
    const ss = 124 * u;
    SLOTS.forEach((slot, i) => {
      const left = i < 3;
      const x = left ? 46 * u : ui.W - 46 * u - ss;
      const y = top + 50 * u + (i % 3) * (ss + 36 * u);
      const it = getEquipped(slot);
      itemSlot(ui, x, y, ss, it, SLOT_ICONS[slot]);
      ui.text(it ? EQUIP_BY_ID[it.tid].name : SLOT_NAMES[slot], x + ss / 2, y + ss + 16 * u, 20, it ? QUALITY_COLORS[it.q] : C.textDim);
      if (slot === 'weapon') this.weaponSlotRect = [x, y, ss, ss];
      if (it && ui.clicked('slot_' + slot, x, y, ss, ss)) {
        game.openDialog(new ItemDialog(it));
      }
    });
    // 一键操作
    const bw = 170 * u, bh = 76 * u;
    const by = top + panelH - bh - 36 * u;
    if (ui.button('equip_best', ui.W / 2 - bw - 10 * u, by, bw, bh, '一键穿戴', C.btnBlue, { size: 26 })) { equipBest(); playSfx('levelup'); }
    if (ui.button('merge_all', ui.W / 2 + 10 * u, by, bw, bh, '一键合成', C.btnPurple, { size: 26 })) {
      const n = mergeAll();
      ui.toast(n ? `合成成功 ${n} 次` : '没有可合成的装备（需3件同部位同品质）');
      if (n) playSfx('evolve');
    }
    // 背包
    const gy = top + panelH + 16 * u;
    const gh = this.contentBottom(ui) - gy - 10 * u;
    ui.panel(16 * u, gy, ui.W - 32 * u, gh, 'dark');
    const items = save.items.slice().sort((a, b) =>
      b.q - a.q || EQUIP_BY_ID[a.tid].slot.localeCompare(EQUIP_BY_ID[b.tid].slot) ||
      (WEB_RULES ? b.lv - a.lv : 0) || a.uid - b.uid);
    const cols = 5, cell = (ui.W - 32 * u - 40 * u) / cols;
    const rows = Math.ceil(items.length / cols);
    const contentH = rows * cell + 30 * u;
    const off = ui.beginScroll('bag', 16 * u, gy + 12 * u, ui.W - 32 * u, gh - 24 * u, contentH);
    if (!items.length) {
      if (!NEW_UI) {
        ui.text('暂无装备，通关章节或开启宝箱获得', ui.W / 2, gy + gh / 2, 24, C.textDim);
      } else {
        const mcx = ui.W / 2, mcy = gy + gh / 2;
        const g = ui.ctx;
        g.save();
        // 水墨古印与交叉双剑淡水印
        g.strokeStyle = 'rgba(92,74,54,0.16)';
        g.lineWidth = Math.max(1.5, u * 2);
        g.beginPath(); g.arc(mcx, mcy - 36 * u, 54 * u, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(180,42,32,0.18)';
        g.lineWidth = Math.max(1, u * 1.2);
        g.strokeRect(mcx - 36 * u, mcy - 72 * u, 72 * u, 72 * u);
        ui.icon('atk', mcx, mcy - 36 * u, 54 * u, 0.22);
        g.restore();
        ui.text('◆ 军械库暂空 ◆', mcx, mcy + 42 * u, 26, '#4a3c30', 'center', null);
        ui.text('通关征战章节或前往「商店」开启宝箱可获神兵甲胄', mcx, mcy + 80 * u, 21, '#786856', 'center', null);
      }
    }
    items.forEach((it, i) => {
      const x = 36 * u + (i % cols) * cell;
      const y = gy + 20 * u + Math.floor(i / cols) * cell + off;
      if (y + cell < gy || y > gy + gh) return;
      itemSlot(ui, x + 4 * u, y + 4 * u, cell - 8 * u, it, undefined, isEquipped(it));
      if (ui.clicked('bag_' + it.uid, x, y, cell, cell)) game.openDialog(new ItemDialog(it));
    });
    ui.endScroll();
  }
  private weaponSlotRect: [number, number, number, number] = [0, 0, 0, 0];

  // —— 军略页 ——
  private talentBtn: [number, number, number, number] = [0, 0, 0, 0];
  private drawTalentTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    ui.ribbon(ui.W / 2, top + 30 * u, 360 * u, '军略');
    ui.text('永久提升全体武将的基础能力', ui.W / 2, top + 90 * u, 24, C.textDim);
    const gy = top + 120 * u;
    const gh = this.contentBottom(ui) - gy - 10 * u;
    const cols = 3, cw = (ui.W - 48 * u) / cols, ch = 330 * u;
    const off = ui.beginScroll('talents', 0, gy, ui.W, gh, Math.ceil(TALENTS.length / cols) * (ch + 14 * u) + 20 * u);
    TALENTS.forEach((t, i) => {
      const x = 24 * u + (i % cols) * cw;
      const y = gy + 10 * u + Math.floor(i / cols) * (ch + 14 * u) + off;
      const lv = save.talents[t.id] || 0;
      const locked = save.maxCleared < t.unlockChapter;
      ui.panel(x + 4 * u, y, cw - 8 * u, ch, locked ? 'dark' : 'wood');
      ui.icon(t.icon, x + cw / 2, y + 70 * u, 70 * u, locked ? 0.4 : 1);
      ui.text(t.name, x + cw / 2, y + 132 * u, 28, locked ? '#888' : '#fff4d6');
      ui.text(`${lv}/${t.max}`, x + cw / 2, y + 166 * u, 22, C.gold);
      const ps = potionStats(lv);
      const eff = t.stat === 'revive' ? '每局可免费复活1次' : t.stat === 'reroll' ? '每局技能刷新+1次'
        : t.stat === 'potion' ? `回血${Math.round(ps.heal * 100)}%·冷却${ps.cd}秒` : `${STAT_NAMES[t.stat]}+${fmtStat(t.stat, t.per)}`;
      ui.text(eff, x + cw / 2, y + 200 * u, 18, '#d9c6a0');
      if (locked) {
        ui.text(`通关第${t.unlockChapter}章解锁`, x + cw / 2, y + 268 * u, 20, '#ff8a80');
        return;
      }
      if (lv >= t.max) { ui.text('已满级', x + cw / 2, y + 268 * u, 24, '#9be37a'); return; }
      const cost = talentCost(t, lv);
      const bx = x + 20 * u, bw = cw - 40 * u, by = y + ch - 96 * u;
      if (i === 0) this.talentBtn = [bx, by, bw, 76 * u];
      if (ui.button('talent_' + t.id, bx, by, bw, 76 * u, fmtNum(cost), save.gold >= cost ? C.btnGold : C.btnGray, { icon: 'gold', size: 24 })) {
        const err = upgradeTalent(t.id);
        if (err) ui.toast(err); else { playSfx('levelup'); if (save.guide === 4) save.guide = 5; }
      }
    });
    ui.endScroll();
  }

  // —— 武将页：名册（按阵营筛选的卡片墙）→ 点开看单个武将的详情 ——
  private viewHero = '';
  private heroDetail = false;
  private lastViewHero = '';
  private heroCamp: Camp | 'all' = 'all';

  /** 名册里的排序：已拥有的在前（品阶高的靠前），没拥有的按碎片进度排 */
  private heroOrder(): HeroDef[] {
    const idx = new Map(HEROES.map((h, i) => [h.id as string, i]));
    const key = (h: HeroDef) => {
      const st = save.heroes[h.id];
      if (h.id === save.hero) return -1e6;
      if (st.owned) return -1e5 - heroRank(h).id * 1000 - st.star * 100 + idx.get(h.id)!;
      return -Math.min(1, st.shards / Math.max(1, h.unlockShards)) * 1000 + idx.get(h.id)!;
    };
    return HEROES.filter((h) => this.heroCamp === 'all' || h.camp === this.heroCamp).sort((a, b) => key(a) - key(b));
  }

  private openHero(id: string) { this.viewHero = this.lastViewHero = id; this.heroDetail = true; this.tab = 'hero'; game.ui.resetScroll('hero_detail'); }

  private drawHeroTab(ui: UI) {
    if (!this.viewHero || !HERO_BY_ID[this.viewHero]) this.viewHero = this.lastViewHero = save.hero;
    // 别处（截图脚本等）直接改了 viewHero：当作要看这位武将的详情
    if (this.viewHero !== this.lastViewHero) { this.lastViewHero = this.viewHero; this.heroDetail = true; }
    if (this.heroDetail) this.drawHeroDetail(ui);
    else this.drawHeroList(ui);
  }

  private drawHeroList(ui: UI) {
    const u = ui.u, ctx = ui.ctx, W = ui.W;
    const top = this.contentTop(ui);
    // 阵营筛选
    const chips: { id: Camp | 'all'; name: string; lac: Lacquer; color: string }[] = [
      { id: 'all', name: '全部', lac: LACQUER.ink, color: '#8a6a40' },
      ...CAMPS.map((c) => ({ id: c.id, name: c.name, lac: CAMP_LACQUER[c.id], color: c.color })),
    ];
    const cw = 96 * u, chh = 58 * u, cgap = 10 * u;
    chips.forEach((c, i) => {
      const x = 20 * u + i * (cw + cgap), y = top;
      const on = this.heroCamp === c.id, pressed = ui.isPressed('hero_camp_' + c.id);
      if (on) { ui.markDark(x, y, cw, chh); drawSkin(ctx, 'chip_' + c.id, x, y, cw, chh, 14 * u, (g, w0, h0) => paintLacquerButton(g, w0, h0, u, c.lac, false)); }
      else drawSkin(ctx, 'chipoff_' + c.id + (pressed ? 'P' : ''), x, y, cw, chh, 12 * u, (g, w0, h0) => paintSlipButton(g, w0, h0, u, c.color, pressed, false));
      ui.text(c.name, x + cw / 2, y + (chh - 4 * u) / 2 + (pressed && !on ? 3 * u : 0), 25, on ? '#fff6e0' : '#2a2018', 'center', on ? c.lac.ink : null);
      if (ui.clicked('hero_camp_' + c.id, x, y, cw, chh)) { this.heroCamp = c.id; ui.resetScroll('hero_list'); }
    });
    const ownedN = HEROES.filter((h) => save.heroes[h.id].owned).length;
    ui.text(`已拥有 ${ownedN}/${HEROES.length}`, W - 22 * u, top + 28 * u, 21, '#5c4d3e', 'right', null);

    // 心愿武将
    const wy = top + 70 * u, wh = 84 * u;
    const wish = wishHero();
    ui.panel(20 * u, wy, W - 40 * u, wh, 'dark');
    if (wish) {
      const wh0 = HERO_BY_ID[wish.id], ws = save.heroes[wish.id];
      const need = !ws.owned ? wh0.unlockShards : ws.star < MAX_STAR ? STAR_COST[ws.star - 1] : peakCost(ws.peak || 0);
      ui.icon('star', 54 * u, wy + wh / 2, 40 * u);
      ui.text(`心愿武将 · ${wh0.name}${wish.auto ? '（自动）' : ''}`, 86 * u, wy + 28 * u, 23, '#2a1d14', 'left', null);
      ui.text(`随机碎片有 ${Math.round(WISH_RATE * 100)}% 归心愿武将 · 在武将详情里可更换`, 86 * u, wy + 58 * u, 17, '#786856', 'left', null);
      ui.bar(W - 250 * u, wy + 22 * u, 200 * u, 22 * u, ws.shards / Math.max(1, need), '#feae34');
      ui.text(`${ws.shards}/${need}`, W - 150 * u, wy + 33 * u, 16, '#fff', 'center', null);
      ui.text(ws.owned ? (ws.star < MAX_STAR ? '升星' : '巅峰') : '解锁', W - 150 * u, wy + 62 * u, 17, '#a22633', 'center', null);
      if (ui.clicked('hero_wish_bar', 20 * u, wy, W - 40 * u, wh)) this.openHero(wish.id);
    } else ui.text('全部武将都已培养到顶，暂无心愿武将', W / 2, wy + wh / 2, 21, '#786856', 'center', null);

    // 名册
    const list = this.heroOrder();
    const cols = 4, gap = 12 * u, gx = 20 * u;
    const kw = (W - gx * 2 - gap * (cols - 1)) / cols, kh = 222 * u;
    const gy = wy + wh + 14 * u, gh = this.contentBottom(ui) - gy - 4 * u;
    const off = ui.beginScroll('hero_list', 0, gy, W, gh, Math.ceil(list.length / cols) * (kh + gap) + 16 * u);
    list.forEach((h, i) => {
      const x = gx + (i % cols) * (kw + gap), y = gy + 8 * u + Math.floor(i / cols) * (kh + gap) + off;
      if (y + kh < gy - 20 * u || y > gy + gh + 20 * u) return;
      const st = save.heroes[h.id], rank = heroRank(h);
      const pressed = ui.isPressed('hero_pick_' + h.id);
      drawSkin(ctx, `hcard_${rank.id}${h.camp}${st.owned ? 'o' : 'x'}${pressed ? 'P' : ''}`, x, y, kw, kh, 14 * u, (g, w0, h0) => paintHeroCard(g, w0, h0, u, rank.color, CAMPS.find((c) => c.id === h.camp)!.color, st.owned, pressed));
      ui.markPaper(x, y, kw, kh);
      const cx = x + kw / 2;
      ui.icon(st.owned ? heroIdleFrame(heroSpriteName(h.id), ui.time + i * 0.37) : `hero_${h.id}_0`, cx, y + 84 * u, 118 * u, st.owned ? 1 : 0.42);
      // 阵营印
      const camp = CAMPS.find((c) => c.id === h.camp)!;
      ctx.fillStyle = camp.color;
      ctx.beginPath(); ctx.arc(x + 24 * u, y + 24 * u, 15 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,210,0.85)'; ctx.lineWidth = Math.max(1, 1.2 * u); ctx.stroke();
      ui.markDark(x + 9 * u, y + 9 * u, 30 * u, 30 * u);
      ui.text(camp.name, x + 24 * u, y + 24.5 * u, 18, '#fff6e0', 'center', null);
      ui.text(h.name, cx, y + 160 * u, 24, st.owned ? '#221a13' : '#6e6050', 'center', null);
      if (st.owned) {
        for (let k = 0; k < st.star; k++) ui.icon('star', cx - (st.star - 1) * 9 * u + k * 18 * u, y + 190 * u, 18 * u);
        ui.text('Lv.' + st.lv, x + kw - 12 * u, y + 22 * u, 17, '#5c4d3e', 'right', null);
      } else if (h.unlockShards > 0) {
        ui.bar(x + 18 * u, y + 180 * u, kw - 36 * u, 18 * u, st.shards / h.unlockShards, '#feae34');
        ui.text(`${st.shards}/${h.unlockShards}`, cx, y + 189.5 * u, 14, '#fff', 'center', null);
        ui.icon('lock', x + kw - 24 * u, y + 24 * u, 24 * u);
      }
      if (save.hero === h.id) {
        ui.markDark(x + kw - 66 * u, y + 108 * u, 60 * u, 28 * u);
        drawSkin(ctx, 'tag_on', x + kw - 66 * u, y + 108 * u, 60 * u, 28 * u, 4 * u, (g, w0, h0) => { rr(g, 0, 0, w0, h0, 6 * u); g.fillStyle = '#b02c22'; g.fill(); g.strokeStyle = '#f6dc9a'; g.lineWidth = Math.max(1, 1.2 * u); g.stroke(); });
        ui.text('出战', x + kw - 36 * u, y + 122 * u, 17, '#fff6e0', 'center', null);
      }
      if (wish && wish.id === h.id) ui.icon('star', x + 24 * u, y + 56 * u, 22 * u);
      if (heroRedDot(h.id)) ui.redDot(x + kw - 8 * u, y + 8 * u);
      if (ui.clicked('hero_pick_' + h.id, x, y, kw, kh)) this.openHero(h.id);
    });
    ui.endScroll();
  }

  private drawHeroDetail(ui: UI) {
    const u = ui.u, ctx = ui.ctx, W = ui.W;
    const top = this.contentTop(ui);
    const h = HERO_BY_ID[this.viewHero];
    const st = save.heroes[h.id];
    const rank = heroRank(h), camp = CAMPS.find((c) => c.id === h.camp)!;
    // 顶行：返回 / 品阶 / 心愿
    if (ui.button('hero_back', 20 * u, top, 150 * u, 58 * u, '◀ 名册', C.btnGray, { size: 24 })) { this.heroDetail = false; return; }
    ui.text(`${camp.name} · ${rank.name}`, W / 2, top + 28 * u, 26, rank.color, 'center', null);
    const wish = wishHero();
    const useful = !st.owned || st.star < MAX_STAR || (st.peak || 0) < PEAK_MAX;
    const isWish = wish?.id === h.id && !wish.auto;
    if (useful && h.unlockShards > 0 && ui.button('hero_wish', W - 190 * u, top, 170 * u, 58 * u, isWish ? '心愿中 ✓' : '设为心愿', isWish ? C.btnGold : C.btnPurple, { size: 23 })) {
      setWishHero(isWish ? undefined : h.id);
      ui.toast(isWish ? '已取消，心愿武将改为自动选择' : `心愿武将：${h.name}（随机碎片 ${Math.round(WISH_RATE * 100)}% 归他）`);
    }

    // 立绘台：阵营底色的漆面画框，武将站在画里
    const sy = top + 70 * u, sh = 300 * u, sx = 20 * u, sw = W - 40 * u;
    ui.markDark(sx, sy, sw, sh);
    drawSkin(ctx, 'hstage_' + h.camp, sx, sy, sw, sh, 20 * u, (g, w0, h0) => paintArenaTile(g, w0, h0, u, CAMP_LACQUER[h.camp || 'shu'], false, false));
    const hx = sx + sw * 0.27, hy = sy + sh * 0.56;
    ctx.fillStyle = 'rgba(10,6,4,0.3)';
    ctx.save(); ctx.translate(hx, hy + 96 * u); ctx.scale(1, 0.28); ctx.beginPath(); ctx.arc(0, 0, 84 * u, 0, Math.PI * 2); ctx.restore(); ctx.fill();
    ui.icon(heroIdleFrame(heroSpriteName(h.id), ui.time), hx, hy, 236 * u, st.owned ? 1 : 0.55);
    const tx = sx + sw * 0.52;
    ui.text(h.name, tx, sy + 62 * u, 52, '#fff6e0', 'left', CAMP_LACQUER[h.camp || 'shu'].ink);
    ui.text(h.title, tx, sy + 112 * u, 22, '#ffe9c0', 'left', null);
    if (st.owned) for (let k = 0; k < 5; k++) ui.icon('star', tx + 14 * u + k * 34 * u, sy + 152 * u, 30 * u, k < st.star ? 1 : 0.25);
    else { ui.icon('lock', tx + 16 * u, sy + 152 * u, 30 * u); ui.text('尚未获得', tx + 40 * u, sy + 152 * u, 22, '#ffe9c0', 'left', null); }
    const rw = ui.measure(h.role, 20) + 32 * u;
    drawSkin(ctx, 'ar_chip', tx, sy + 180 * u, rw, 36 * u, 6 * u, (g, w0, h0) => paintInkPill(g, w0, h0, u, 0.78, false));
    ui.text(h.role, tx + rw / 2, sy + 198.5 * u, 20, '#ffe9c0', 'center', null);
    ui.wrapText(`「${h.quote}」`, tx, sy + 228 * u, sw * 0.45, 19, '#fff4d6', 1.4, 'left', null);
    // 左右切换（按名册当前的顺序）
    const order = this.heroOrder();
    const at = order.findIndex((x) => x.id === h.id);
    if (order.length > 1) {
      const go = (d: number) => { const n = order[(Math.max(0, at) + d + order.length) % order.length]; this.viewHero = this.lastViewHero = n.id; ui.resetScroll('hero_detail'); };
      const as = 62 * u;
      for (const [id, x, d] of [['hero_prev', sx - 6 * u, -1], ['hero_next', sx + sw - as + 6 * u, 1]] as [string, number, number][]) {
        const pressed = ui.isPressed(id);
        drawSkin(ctx, 'medalink' + (pressed ? 'P' : ''), x, sy + sh / 2 - as / 2, as, as, 12 * u, (g, s0) => paintMedal(g, s0, u, pressed, 'ink'));
        ui.text(d < 0 ? '◀' : '▶', x + as / 2 + d * 2 * u, sy + sh / 2, 24, '#ffe9c0', 'center', null);
        if (ui.clicked(id, x - 8 * u, sy + sh / 2 - as / 2 - 8 * u, as + 16 * u, as + 16 * u)) go(d);
      }
    }

    // 属性条
    const hb = heroBase(h.id);
    const py = sy + sh + 14 * u, ph = 92 * u;
    ui.panel(20 * u, py, W - 40 * u, ph, 'paper');
    const pk = st.peak || 0;
    const cells: [string, string, string][] = [
      ['等级', `${st.lv}/${HERO.maxLevel}`, '#c58a2e'], ['攻击', String(hb.atk), '#b0502a'], ['生命', String(hb.hp), '#2d7848'], ['移速', String(h.moveSpeed), '#2f6488'],
    ];
    cells.forEach(([k, v, col], i) => {
      const cxx = 20 * u + (W - 40 * u) * (i + 0.5) / 4;
      ui.text(k, cxx, py + 30 * u, 18, '#786856', 'center', null);
      ui.text(v, cxx, py + 60 * u, 27, col, 'center', null);
      if (i > 0) { ctx.fillStyle = 'rgba(120,90,50,0.3)'; ctx.fillRect(20 * u + (W - 40 * u) * i / 4, py + 20 * u, Math.max(1, u), ph - 40 * u); }
    });

    // 底部操作条（固定）
    const lx = 24 * u, bh = 98 * u;
    const by = this.contentBottom(ui) - bh - 6 * u;
    const bw = (W - lx * 2 - 24 * u) / 3;
    if (st.owned) {
      const cost = heroLevelCost(st.lv);
      const maxLv = st.lv >= HERO.maxLevel;
      if (ui.button('hero_up', lx, by, bw, bh, maxLv ? '满级' : '升级', save.gold >= cost && !maxLv ? C.btnGold : C.btnGray, { size: 30, disabled: maxLv, sub: maxLv ? undefined : `${fmtNum(cost)}金` })) {
        const err = upgradeHero(h.id);
        if (err) ui.toast(err); else playSfx('levelup');
      }
      const maxStar = st.star >= MAX_STAR;
      if (maxStar) {
        // 五星以后：多出来的碎片升巅峰等级
        const pkMax = pk >= PEAK_MAX;
        const pc = peakCost(pk);
        if (ui.button('hero_peak', lx + bw + 12 * u, by, bw, bh, pkMax ? '巅峰已满' : `巅峰${pk + 1}级`, st.shards >= pc && !pkMax ? C.btnPurple : C.btnGray, { size: 28, disabled: pkMax, sub: pkMax ? undefined : `碎片 ${st.shards}/${pc}` })) {
          const err = peakUpHero(h.id);
          if (err) ui.toast(err); else { playSfx('evolve'); ui.toast(`${h.name}巅峰等级 Lv.${st.peak}！`); flushSave(true); }
        }
      } else {
        const sc = STAR_COST[st.star - 1];
        if (ui.button('hero_star', lx + bw + 12 * u, by, bw, bh, '升星', st.shards >= sc ? C.btnPurple : C.btnGray, { size: 30, sub: `碎片 ${st.shards}/${sc}` })) {
          const err = starUpHero(h.id);
          if (err) ui.toast(err);
          else { playSfx('evolve'); ui.toast(st.star >= MAX_STAR ? `${h.name}升至五星！解锁觉醒造型和巅峰等级` : `${h.name}升至${st.star}星！`); flushSave(true); }
        }
      }
      const on = save.hero === h.id;
      if (ui.button('hero_use', lx + (bw + 12 * u) * 2, by, bw, bh, on ? '出战中' : '出 战', on ? C.btnGray : C.btnRed, { size: 30, disabled: on })) {
        save.hero = h.id;
        markDirty();
        playSfx('boss');
        ui.toast(`${h.name}出战！`);
      }
    } else {
      // 没拥有：碎片进度 + 解锁
      const can = h.unlockShards > 0 && st.shards >= h.unlockShards;
      ui.panel(lx, by, W - lx * 2 - 236 * u, bh, 'dark');
      ui.text(h.unlockText, lx + 22 * u, by + 30 * u, 19, '#a22633', 'left', null);
      if (h.unlockShards > 0) {
        ui.icon('shard', lx + 36 * u, by + 66 * u, 32 * u);
        const bw2 = W - lx * 2 - 236 * u - 90 * u;
        ui.bar(lx + 62 * u, by + 54 * u, bw2, 24 * u, st.shards / h.unlockShards, '#feae34');
        ui.text(`${st.shards}/${h.unlockShards}`, lx + 62 * u + bw2 / 2, by + 66 * u, 17, '#fff', 'center', null);
      }
      if (ui.button('hero_unlock', W - lx - 224 * u, by, 224 * u, bh, '解 锁', can ? C.btnRed : C.btnGray, { size: 32, disabled: !can })) {
        const err = unlockHero(h.id);
        if (err) ui.toast(err);
        else { playSfx('victory'); save.hero = h.id; flushSave(true); ui.toast(`获得武将：${h.name}！`); }
      }
    }

    // 中间滚动区：天赋 / 兵器 / 大招 / 联动 / 觉醒 / 皮肤
    const follow = IS_XHS && h.id === 'sunshangxiang' && !save.xhsFollowClaimed;
    const links = heroLinks(h.id);
    const gy = py + ph + 12 * u, gh = by - gy - 12 * u;
    const rowH = 116 * u;
    const contentH = (follow ? 100 : 0) * u + (3 + links.length) * rowH + 46 * u + 176 * u + 170 * u + 20 * u;
    const off = ui.beginScroll('hero_detail', 0, gy, W, gh, contentH);
    let y = gy + 4 * u + off;
    const px0 = 24 * u, pw0 = W - 48 * u;
    if (follow) {
      if (ui.button('hero_xhs', px0, y, pw0, 84 * u, '关注领孙尚香', C.btnGold)) game.openDialog(new XhsFollowDialog());
      y += 100 * u;
    }
    const row = (icon: string, title: string, desc: string, tag: string, tagCol: string) => {
      if (y + rowH > gy - 10 * u && y < gy + gh + 10 * u) {
        ui.panel(px0, y, pw0, rowH - 10 * u, 'dark');
        ui.qualityFrame(px0 + 14 * u, y + 11 * u, 84 * u, tagCol);
        ui.icon(icon, px0 + 56 * u, y + 53 * u, 58 * u);
        ui.text(title, px0 + 116 * u, y + 28 * u, 24, '#2a1d14', 'left', null);
        const tw = ui.measure(tag, 16) + 20 * u;
        ctx.fillStyle = tagCol;
        rr(ctx, px0 + pw0 - tw - 16 * u, y + 14 * u, tw, 28 * u, 6 * u); ctx.fill();
        ui.markDark(px0 + pw0 - tw - 16 * u, y + 14 * u, tw, 28 * u);
        ui.text(tag, px0 + pw0 - tw / 2 - 16 * u, y + 28.5 * u, 16, '#fff6e0', 'center', null);
        ui.wrapText(desc, px0 + 116 * u, y + 44 * u, pw0 - 136 * u, 18, '#5c4d3e', 1.38);
      }
      y += rowH;
    };
    const wd = WEAPONS[h.weapon];
    row('star', '天赋', h.passive, '天赋', '#c58a2e');
    row(wd.icon, wd.name, `${wd.intro}。满级后搭配「${PASSIVES[wd.evoPassive].name}」进化为「${wd.evoName}」`, '专属兵器', '#2f6488');
    row(wd.evoIcon, h.ultName, h.ultDesc, '大招', '#b02c22');
    for (const { weapon, link } of links) {
      const d = WEAPONS[weapon];
      const lock = (d.unlockCh || 0) > save.maxCleared ? `（「${d.name}」通关第${d.unlockCh}章后出现）` : '';
      row(d.evoIcon, link.name, `「${d.name}」搭配「${PASSIVES[d.evoPassive].name}」进化时变为专属形态：${link.desc.replace(/^.*?：/, '')}${lock}`, '专属联动', '#6d3f8a');
    }
    // 星级 / 巅峰加成
    ui.text(`星级加成 +${Math.round((st.owned ? st.star - 1 : 0) * 12)}%${pk ? `   巅峰 Lv.${pk}（攻击生命 +${Math.round(pk * PEAK_BONUS * 100)}%${pk >= 10 ? `，对敌将 +${5 * Math.floor(pk / 10)}%` : ''}）` : ''}${st.owned && st.shards > 0 ? `   持有碎片 ${st.shards}` : ''}`, W / 2, y + 14 * u, 19, pk ? '#6d3f8a' : '#786856', 'center', null);
    y += 46 * u;
    // 五星觉醒造型
    {
      const can = st.owned && st.star >= MAX_STAR;
      ui.panel(px0, y, pw0, 164 * u, 'dark');
      ui.qualityFrame(px0 + 16 * u, y + 16 * u, 132 * u, can ? '#fee761' : '#3a3040');
      ui.icon(`hero_${h.id}_awk_${Math.floor(ui.time * 6) % 8}`, px0 + 82 * u, y + 82 * u, 126 * u, can ? 1 : 0.4);
      ui.text('五星觉醒 · 步战造型', px0 + 168 * u, y + 42 * u, 25, '#a8641a', 'left', null);
      ui.text(`效果：伤害 +${AWAKEN_DMG}%，生命 +${Math.round(AWAKEN_HP * 100)}%`, px0 + 168 * u, y + 80 * u, 19, '#5c4d3e', 'left', null);
      if (!can) ui.text(st.owned ? `升至五星解锁（当前${st.star}星）` : '获得武将并升至五星解锁', px0 + 168 * u, y + 116 * u, 19, '#a22633', 'left', null);
      else if (ui.button('awaken_toggle', px0 + pw0 - 196 * u, y + 42 * u, 180 * u, 80 * u, st.awaken ? '换回骑马' : '启用', st.awaken ? C.btnGray : C.btnGold, { size: 26 })) {
        st.awaken = !st.awaken; markDirty(); playSfx(st.awaken ? 'evolve' : 'click');
      }
    }
    y += 176 * u;
    // 皮肤
    {
      const sk = SKINS[h.id];
      const ss = skinState(h.id);
      ui.panel(px0, y, pw0, 158 * u, 'dark');
      ui.qualityFrame(px0 + 16 * u, y + 16 * u, 126 * u, ss.owned ? '#b55088' : '#3a3040');
      ui.icon(`hero_${h.id}_skin_${Math.floor(ui.time * 6) % 4}`, px0 + 79 * u, y + 79 * u, 118 * u, ss.owned ? 1 : 0.5);
      ui.text(`皮肤 · ${sk.name}`, px0 + 162 * u, y + 42 * u, 25, '#6d3f8a', 'left', null);
      ui.text(`穿戴效果：${sk.bonus}`, px0 + 162 * u, y + 80 * u, 19, '#5c4d3e', 'left', null);
      const bw2 = 180 * u, bx2 = px0 + pw0 - bw2 - 16 * u, by2 = y + 40 * u;
      if (ss.owned) {
        if (ui.button('skin_toggle', bx2, by2, bw2, 80 * u, ss.on ? '卸下' : '穿戴', ss.on ? C.btnGray : C.btnPurple, { size: 26 })) { ss.on = !ss.on; markDirty(); playSfx('click'); }
      } else {
        const skinCost = (sk.ads - ss.ads) * NO_ADS_PRICE.skinPerAd;
        if (NO_ADS) {
          ui.text(`消耗${skinCost}元宝解锁`, px0 + 162 * u, y + 116 * u, 19, '#a8641a', 'left', null);
          if (ui.button('skin_buy', bx2, by2, bw2, 80 * u, String(skinCost), save.yuanbao >= skinCost ? C.btnGold : C.btnGray, { icon: 'yuanbao', size: 24 })) {
            if (save.yuanbao < skinCost) ui.toast('元宝不足');
            else {
              save.yuanbao -= skinCost;
              while (!skinState(h.id).owned) skinAdProgress(h.id);
              playSfx('victory');
              ui.toast(`获得皮肤「${sk.name}」！`);
              flushSave(true);
            }
          }
        } else ui.text(`观看视频 ${ss.ads}/${sk.ads} 解锁`, px0 + 162 * u, y + 116 * u, 19, '#a8641a', 'left', null);
        if (!NO_ADS && adButton(ui, 'skin_ad', bx2, by2, bw2, 80 * u, '解锁', { size: 24 })) {
          getPlatform().showRewardedAd('skin_' + h.id).then((ok) => {
            if (!ok) return;
            progressTask('ad', 1);
            if (skinAdProgress(h.id)) { playSfx('victory'); ui.toast(`获得皮肤「${sk.name}」！`); } else ui.toast(`皮肤进度 ${skinState(h.id).ads}/${sk.ads}`);
            flushSave(true);
          });
        }
      }
    }
    ui.endScroll();
  }

  // —— 商店页 ——
  private drawShopTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    const gh = this.contentBottom(ui) - top - 10 * u;
    const off = ui.beginScroll('shop', 0, top, ui.W, gh, 1820 * u);
    let y = top + off + 10 * u;
    // 宝箱
    ui.ribbon(ui.W / 2, y + 30 * u, 360 * u, '宝箱');
    if (ui.button('chest_odds', ui.W - 170 * u, y + 6 * u, 146 * u, 50 * u, '概率公示', C.btnBlue, { size: 20 })) game.openDialog(new TextDialog('概率公示', chestOddsText()));
    y += 80 * u;
    for (const c of CHESTS) {
      const h = 300 * u;
      ui.panel(24 * u, y, ui.W - 48 * u, h, 'wood');
      ui.icon(c.icon, 140 * u, y + 130 * u, 170 * u);
      ui.text(c.name, 140 * u, y + 240 * u, 28, c.id === 'gold' ? '#fee761' : '#fff4d6');
      const qs = c.weights.map((w, q) => (w > 0 ? q : -1)).filter((q) => q >= 0);
      if (c.id === 'gold') {
        ui.text(`${Math.round(GOLD_CHEST_HERO_RATE * 100)}%直接获得武将，否则得武将碎片×8~15`, 270 * u, y + 40 * u, 20, '#fee761', 'left');
        ui.text('另送装备：' + qs.map((q) => QUALITY_NAMES[q]).join('/'), 270 * u, y + 74 * u, 20, '#d9c6a0', 'left');
        if (c.pity) ui.text(`再开${c.pity - save.goldChestCount}次必得武将`, 270 * u, y + 106 * u, 20, '#dc9be9', 'left');
      } else ui.text('可能获得：' + qs.map((q) => QUALITY_NAMES[q]).join('/') + '装备、武将碎片', 270 * u, y + 56 * u, 20, '#d9c6a0', 'left');
      const claims = save.daily.chestAd;
      const used = claims[c.id] || 0;
      const freeClaims = c.freeDaily ?? 0;
      const bonus = freeClaims > 0 && used >= freeClaims && used < c.adDaily
        ? CHEST_AD_BONUS[Math.min(used - freeClaims, CHEST_AD_BONUS.length - 1)] : 0;
      const bw = 200 * u;
      const buttonH = (WEB_RULES ? 74 : 110) * u;
      if (used < freeClaims) {
        // 每天第一次不用看广告
        if (ui.button('chest_free_' + c.id, 270 * u, y + 140 * u, bw, buttonH, '免费', C.btnGreen, { sub: `${c.adDaily - used}/${c.adDaily}`, size: 28 })) {
          claims[c.id] = used + 1;
          markDirty();
          this.openChestNow(c);
        }
      } else if (adButton(ui, 'chest_ad_' + c.id, 270 * u, y + 140 * u, bw, buttonH, '免费', { disabled: used >= c.adDaily, sub: `${c.adDaily - used}/${c.adDaily}${bonus ? ` 送${bonus}元宝` : ''}`, size: 28 })) {
        getPlatform().showRewardedAd('chest_' + c.id).then((ok) => {
          // 按开始观看时的日期计次，跨午夜完成的广告不会占用新一天的名额。
          if (!ok || (claims[c.id] || 0) !== used) return;
          claims[c.id] = used + 1;
          progressTask('ad', 1);
          if (bonus) { save.yuanbao += bonus; ui.toast(`额外获得元宝×${bonus}`); }
          this.openChestNow(c);
        });
      }
      if (ui.button('chest_buy_' + c.id, 490 * u, y + 140 * u, bw, buttonH, String(c.cost), save.yuanbao >= c.cost ? C.btnGold : C.btnGray, { icon: 'yuanbao', size: 28 })) this.buyChests(c, 1);
      if (WEB_RULES) {
        // 小红书金匣有两次社交十连。元宝十连与每日奖励分别计次。
        const tenAd = (save.daily.chestTenAd ??= {});
        const usedTen = !!tenAd[c.id];
        if (IS_XHS && c.id === 'gold') {
          drawGoldTen(ui, 270 * u, y + 221 * u, 205 * u, 65 * u, () => this.openChestNow(c, 10));
        } else if (adButton(ui, 'chest_tenad_' + c.id, 270 * u, y + 221 * u, 205 * u, 65 * u, usedTen ? '今日已领' : '免费十连', { disabled: usedTen, sub: '每日1次', size: 24 })) {
          const day = save.daily.day;
          getPlatform().showRewardedAd('chest_ten_' + c.id).then((ok) => {
            if (!ok || save.daily.day !== day || save.daily.chestTenAd?.[c.id]) return;
            (save.daily.chestTenAd ??= {})[c.id] = true;
            progressTask('ad', 1);
            this.openChestNow(c, 10);
          });
        }
        if (ui.button('chest_ten_' + c.id, 485 * u, y + 221 * u, 205 * u, 65 * u, `十连·${10 * c.cost}`, save.yuanbao >= 10 * c.cost ? C.btnRed : C.btnGray, { size: 24, icon: 'yuanbao' })) this.buyChests(c, 10);
      }
      y += h + 20 * u;
    }
    // 每日补给
    ui.ribbon(ui.W / 2, y + 30 * u, 360 * u, '每日补给');
    y += 80 * u;
    // 1.0.4：看广告领的补给一次比一次多，卡片上显示「本次 / 下次」
    const supplyMultiplier = WEB_RULES ? 2 : 1;
    const ybAmt = (k: number) => supplyMultiplier * Math.round(SHOP_DAILY.adYuanbao.amount * adStep(SHOP_DAILY.adYuanbao.limit, k));
    const goldAmt = (k: number) => Math.floor(SHOP_DAILY.adGold.minutes * adStep(SHOP_DAILY.adGold.limit, k) * (3 + save.maxCleared * 3));
    const shardAmt = (k: number) => supplyMultiplier * Math.round(SHOP_DAILY.adShards.amount * adStep(SHOP_DAILY.adShards.limit, k));
    const dy = save.daily;
    const nextTxt = (left: number, v: string) => (left > 1 ? `（下次×${v}）` : '');
    const ybLeft = SHOP_DAILY.adYuanbao.limit - dy.adYuanbao, goldLeft = SHOP_DAILY.adGold.limit - dy.adGold;
    const shardLeft = SHOP_DAILY.adShards.limit - dy.adShards, stmLeft = STAMINA.adDailyLimit - dy.adStamina;
    const cards: { id: string; icon: string; name: string; desc: string; left: number; limit: number; free?: boolean; on: () => void }[] = [
      { id: 'gift', icon: 'gold', name: '每日礼包', desc: `金币×${SHOP_DAILY.freeGift.gold}`, left: dy.freeGift ? 0 : 1, limit: 1, free: true, on: () => { dy.freeGift = true; save.gold += SHOP_DAILY.freeGift.gold; ui.toast(`获得金币×${SHOP_DAILY.freeGift.gold}`); playSfx('coin'); } },
      { id: 'yb', icon: 'yuanbao', name: '元宝', desc: `元宝×${ybAmt(dy.adYuanbao)}${nextTxt(ybLeft, String(ybAmt(dy.adYuanbao + 1)))}`, left: ybLeft, limit: SHOP_DAILY.adYuanbao.limit, on: () => { const n = ybAmt(dy.adYuanbao); dy.adYuanbao++; save.yuanbao += n; ui.toast(`获得元宝×${n}`); playSfx('coin'); } },
      { id: 'gold', icon: 'chest', name: '军饷', desc: `金币×${fmtNum(goldAmt(dy.adGold))}${nextTxt(goldLeft, fmtNum(goldAmt(dy.adGold + 1)))}`, left: goldLeft, limit: SHOP_DAILY.adGold.limit, on: () => { const g = goldAmt(dy.adGold); dy.adGold++; save.gold += g; ui.toast(`获得金币×${g}`); playSfx('coin'); } },
      { id: 'shards', icon: 'shard', name: '武将碎片', desc: `随机碎片×${shardAmt(dy.adShards)}${nextTxt(shardLeft, String(shardAmt(dy.adShards + 1)))}`, left: shardLeft, limit: SHOP_DAILY.adShards.limit, on: () => { const n = shardAmt(dy.adShards); dy.adShards++; const h = randomShardHero(true); grantShards(h, n); ui.toast(`获得${HERO_BY_ID[h].name}碎片×${n}`); playSfx('chest'); } },
      { id: 'stamina', icon: 'stamina', name: '体力', desc: `体力×${staminaAdGain(dy.adStamina)}${nextTxt(stmLeft, String(staminaAdGain(dy.adStamina + 1)))}`, left: stmLeft, limit: STAMINA.adDailyLimit, on: () => { const n = staminaAdGain(dy.adStamina); dy.adStamina++; save.stamina += n; ui.toast(`体力+${n}`); playSfx('coin'); } },
      { id: 'iron', icon: 'iron', name: '玄铁兑换', desc: '50元宝换10玄铁', left: 99, limit: 99, free: true, on: () => { if (save.yuanbao < 50) { ui.toast('元宝不足'); return; } save.yuanbao -= 50; save.iron += 10; ui.toast('获得玄铁×10'); playSfx('coin'); } },
    ];
    const cw = (ui.W - 72 * u) / 2, chh = 300 * u;
    cards.forEach((c, i) => {
      const x = 24 * u + (i % 2) * (cw + 24 * u);
      const yy = y + Math.floor(i / 2) * (chh + 20 * u);
      ui.panel(x, yy, cw, chh, 'wood');
      ui.icon(c.icon, x + cw / 2, yy + 80 * u, 90 * u);
      ui.text(c.name, x + cw / 2, yy + 150 * u, 26, '#fff4d6');
      ui.text(c.desc, x + cw / 2, yy + 184 * u, 20, '#d9c6a0');
      const bx = x + 24 * u, bw = cw - 48 * u, by = yy + chh - 96 * u;
      const disabled = c.left <= 0;
      const label = c.id === 'iron' ? '兑换' : c.free ? (disabled ? '已领取' : '领取') : '免费';
      const clicked = c.free
        ? ui.button('shop_' + c.id, bx, by, bw, 80 * u, label, C.btnGold, { disabled, size: 26 })
        : adButton(ui, 'shop_' + c.id, bx, by, bw, 80 * u, label, { disabled, size: 24, sub: `${Math.max(0, c.left)}/${c.limit}` });
      if (clicked) {
        if (c.free) { c.on(); markDirty(); }
        else getPlatform().showRewardedAd('shop_' + c.id).then((ok) => { if (ok) { c.on(); progressTask('ad', 1); markDirty(); } });
      }
    });
    ui.endScroll();
  }

  private buyChests(chest: ChestDef, count: 1 | 10) {
    const cost = chest.cost * count;
    if (save.yuanbao < cost) { game.ui.toast('元宝不足'); return; }
    save.yuanbao -= cost;
    this.openChestNow(chest, count);
  }

  private openChestNow(chest: ChestDef, count: 1 | 10 = 1) {
    const results = Array.from({ length: count }, () => openChest(chest));
    markDirty();
    flushSave(true);
    if (count === 10) game.openDialog(new ChestBatchResultDialog(chest.name, results));
    else {
      const r = results[0];
      game.openDialog(new ChestResultDialog(r.item, chest.id === 'gold', r.shards, r.hero));
    }
  }

  // —— 新手引导 ——
  private drawGuide(ui: UI) {
    if (game.dialogs.length) return;
    const nav = this.navRects;
    switch (save.guide) {
      case 1:
        if (nav.equip) guidePointer(ui, ...nav.equip, '获得了新兵器，去装备看看吧');
        break;
      case 2:
        if (!getEquipped('weapon')) { save.guide = 3; break; }
        if (this.tab === 'equip') guidePointer(ui, ...this.weaponSlotRect, '新兵器已自动穿戴，点击可以强化');
        else if (nav.equip) guidePointer(ui, ...nav.equip, '去装备页强化新兵器');
        break;
      case 3:
        if (nav.talent) guidePointer(ui, ...nav.talent, '军略可以永久提升属性');
        break;
      case 4:
        if (this.tab === 'talent') guidePointer(ui, ...this.talentBtn, '升级「武艺」，提升全部伤害');
        else if (nav.talent) guidePointer(ui, ...nav.talent, '去军略页升级永久属性');
        break;
      case 5:
        if (nav.battle) guidePointer(ui, ...nav.battle, '准备完毕，继续征战吧！');
        break;
      case 6:
        if (this.tab === 'battle') guidePointer(ui, ...this.startRect);
        break;
    }
  }
}

const CAMP_LACQUER: Record<string, Lacquer> = { shu: LACQUER.green, wei: LACQUER.blue, wu: LACQUER.red, qun: LACQUER.purple };

/** 名册里的武将卡：品阶色描边 + 阵营淡染的纸面，上半截一团光托住人物 */
function paintHeroCard(g: CanvasRenderingContext2D, w: number, h: number, u: number, rank: string, camp: string, owned: boolean, pressed: boolean) {
  const r = 12 * u;
  softShadow(g, 0, 0, w, h, r, 7 * u, pressed ? 0.12 : 0.22, pressed ? 1.5 * u : 3.5 * u);
  rr(g, 0, 0, w, h, r);
  g.fillStyle = '#2a2018';
  g.fill();
  const b1 = Math.max(1, 1.4 * u);
  rr(g, b1, b1, w - b1 * 2, h - b1 * 2, r - b1);
  const bg = g.createLinearGradient(0, 0, 0, h);
  const rc = owned ? rank : mix(rank, '#8d8272', 0.65);
  bg.addColorStop(0, mix(rc, '#ffffff', 0.4)); bg.addColorStop(0.5, rc); bg.addColorStop(1, mix(rc, '#1a120c', 0.4));
  g.fillStyle = bg;
  g.fill();
  const b2 = b1 + Math.max(2, 3 * u);
  rr(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2);
  const face = g.createLinearGradient(0, 0, 0, h);
  if (owned) { face.addColorStop(0, mix('#fbf4e2', camp, 0.1)); face.addColorStop(0.62, mix('#f1e4c8', camp, 0.2)); face.addColorStop(0.64, '#f6ecd6'); face.addColorStop(1, '#e6d6b6'); }
  else { face.addColorStop(0, '#d9cfbc'); face.addColorStop(0.62, '#c9bda6'); face.addColorStop(0.64, '#ddd3c0'); face.addColorStop(1, '#cfc4ae'); }
  g.fillStyle = face;
  g.fill();
  paperGrain(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2, u, Math.round(w + h), 0.8);
  g.save();
  rr(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2);
  g.clip();
  const rg = g.createRadialGradient(w / 2, h * 0.36, 4 * u, w / 2, h * 0.36, w * 0.5);
  rg.addColorStop(0, owned ? 'rgba(255,252,240,0.9)' : 'rgba(255,252,240,0.35)');
  rg.addColorStop(1, 'rgba(255,252,240,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, w, h * 0.64);
  // 人物脚下的地台
  g.fillStyle = owned ? mix(camp, '#3a2a1a', 0.3) : '#8d8272';
  g.globalAlpha = 0.22;
  g.save(); g.translate(w / 2, h * 0.585); g.scale(1, 0.26); g.beginPath(); g.arc(0, 0, w * 0.34, 0, Math.PI * 2); g.restore(); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(120,90,50,0.35)';
  g.fillRect(b2 + 8 * u, h * 0.64, w - b2 * 2 - 16 * u, Math.max(1, u));
  if (pressed) { g.fillStyle = 'rgba(40,24,10,0.12)'; g.fillRect(0, 0, w, h); }
  g.restore();
}

const TILE_AMBER = { top: '#e6a850', mid: '#bf7426', bot: '#8a4a14', lip: '#55290a', ink: '#42200a' };

/** 演武页的模式牌：漆面底色 + 远山日轮 + 底部压暗托字；选中时描亮金边 */
function paintArenaTile(g: CanvasRenderingContext2D, w: number, h: number, u: number, c: typeof LACQUER.red, sel: boolean, pressed: boolean) {
  const r = 16 * u;
  softShadow(g, 0, 0, w, h, r, 12 * u, sel ? 0.34 : 0.24, 5 * u);
  if (sel) {
    g.strokeStyle = 'rgba(250,214,120,0.55)';
    g.lineWidth = 7 * u;
    rr(g, -2 * u, -2 * u, w + 4 * u, h + 4 * u, r + 2 * u);
    g.stroke();
  }
  rr(g, 0, 0, w, h, r);
  g.fillStyle = '#231a13';
  g.fill();
  const b1 = Math.max(1, 1.6 * u);
  rr(g, b1, b1, w - b1 * 2, h - b1 * 2, r - b1);
  if (sel) g.fillStyle = goldGrad(g, 0, h);
  else { const gg = g.createLinearGradient(0, 0, 0, h); gg.addColorStop(0, '#b89a5e'); gg.addColorStop(1, '#6e5426'); g.fillStyle = gg; }
  g.fill();
  const b2 = b1 + (sel ? 3.2 : 2) * u;
  rr(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, c.top); bg.addColorStop(0.5, c.mid); bg.addColorStop(1, c.bot);
  g.fillStyle = bg;
  g.fill();
  g.save();
  rr(g, b2, b2, w - b2 * 2, h - b2 * 2, r - b2);
  g.clip();
  // 日轮与光晕
  const sx = w * 0.76, sy = h * 0.3;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.7);
  sg.addColorStop(0, 'rgba(255,244,210,0.42)'); sg.addColorStop(0.3, 'rgba(255,244,210,0.14)'); sg.addColorStop(1, 'rgba(255,244,210,0)');
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,246,222,0.3)';
  g.beginPath(); g.arc(sx, sy, h * 0.16, 0, Math.PI * 2); g.fill();
  // 两重远山
  g.fillStyle = 'rgba(12,8,6,0.16)';
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.5);
  g.quadraticCurveTo(w * 0.16, h * 0.3, w * 0.34, h * 0.5); g.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.66, h * 0.44); g.quadraticCurveTo(w * 0.86, h * 0.3, w, h * 0.52);
  g.lineTo(w, h); g.closePath(); g.fill();
  g.fillStyle = 'rgba(12,8,6,0.2)';
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.66);
  g.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.52, h * 0.68); g.quadraticCurveTo(w * 0.78, h * 0.56, w, h * 0.7);
  g.lineTo(w, h); g.closePath(); g.fill();
  // 地面一抹亮
  const fl = g.createLinearGradient(0, h * 0.56, 0, h * 0.74);
  fl.addColorStop(0, 'rgba(255,240,200,0)'); fl.addColorStop(1, 'rgba(255,240,200,0.12)');
  g.fillStyle = fl; g.fillRect(0, h * 0.56, w, h * 0.18);
  // 底部压暗托字
  const dk = g.createLinearGradient(0, h * 0.52, 0, h);
  dk.addColorStop(0, 'rgba(10,6,4,0)'); dk.addColorStop(1, 'rgba(10,6,4,0.72)');
  g.fillStyle = dk; g.fillRect(0, h * 0.52, w, h * 0.48);
  if (pressed) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 0, w, h); }
  g.restore();
  rr(g, b2 + 5 * u, b2 + 5 * u, w - (b2 + 5 * u) * 2, h - (b2 + 5 * u) * 2, r - b2 - 4 * u);
  g.strokeStyle = 'rgba(255,232,170,0.28)';
  g.lineWidth = Math.max(1, u);
  g.stroke();
}

function fmtStat(stat: string, v: number): string {
  return PERCENT_STATS.has(stat as any) ? `${v}%` : stat === 'regen' ? `${v}/秒` : String(v);
}

export { fmtStat };

/** 游戏更新提醒的订阅状态（进主城时查一次，已订阅就不再显示按钮） */
let updateNotice: 'accept' | 'reject' | 'none' | 'unknown' = 'unknown';
let noticeChecked = false;
export function checkUpdateNotice() {
  if (noticeChecked || !getPlatform().supportsUpdateNotice()) return;
  noticeChecked = true;
  getPlatform().updateNoticeState().then((s) => { updateNotice = s; });
}

/** 打开微信推荐组件（评价与推荐）；官方不提倡用奖励换推荐，这里不发任何奖励 */
export function openRecommend(from: string) {
  getPlatform().showRecommend().then((ok) => {
    if (typeof ok === 'string') { game.ui.toast('推荐组件打不开：' + ok); getPlatform().report('recommend', { from, ok: -2 }); return; }
    getPlatform().report('recommend', { from, ok: ok === null ? -1 : ok ? 1 : 0 });
  });
}
