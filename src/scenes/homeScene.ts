import { game, Scene } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { cachedLayer } from '../ui/layerCache';
import { drawXuanTexture } from '../ui/xuanPaper';
import { HomeBackground } from './homeBg';
import { HomeCamp } from './homeCamp';
import { canPublish, refreshPublishSupport } from '../platform/xhsPublish';
import { goldTenStep, drawGoldTen } from './xhsRewards';
import { save, markDirty, flushSave, tickStamina, staminaNextSeconds, rolloverDaily, activePreparationFor, selectedPreparationStage } from '../meta/save';
import { HEROES, HERO_BY_ID, STAR_COST, MAX_STAR, PEAK_MAX, PEAK_BONUS, peakCost, AWAKEN_DMG, AWAKEN_HP } from '../data/heroes';
import { WEAPONS, PASSIVES, heroLinks, skillPoolFor, fitPreparation, coreWeaponFits } from '../data/skills';
import {
  heroBase, heroRedDot, anyHeroRedDot, unlockHero, starUpHero, peakUpHero, randomShardHero, grantShards,
  computeStats, combatPower, getEquipped, isEquipped, equipBest, mergeAll, upgradeHero, upgradeTalent, chapterUnlocked,
  canSignin, tasksRedDot, patrolPending, spendStamina, openChest, progressTask, GOLD_CHEST_HERO_RATE, chestOddsText,
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
import { TIANJI_DAILY } from '../meta/run';
import {
  XhsFollowDialog, SigninDialog, TasksDialog, PatrolDialog, SettingsDialog, ItemDialog, ChestResultDialog, ChestBatchResultDialog, StaminaDialog, RankDialog,
  SidebarDialog, PreparationDialog, CampaignDurationDialog, ChapterStoryDialog, ChapterListDialog, DefenseListDialog, SweepDialog, TextDialog, staminaAdGain,
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

type Tab = 'shop' | 'equip' | 'battle' | 'talent' | 'hero';
const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'shop', name: '商店', icon: 'chest_gold' },
  { id: 'equip', name: '装备', icon: 'e_armor' },
  { id: 'battle', name: '征战', icon: 'w_spear' },
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
    if (this.tab === 'battle') {
      // 营地：篝火放在「征战 / 守城」页签上方，留出闲逛武将的位置
      const S = Math.max(2, Math.round(Math.min(ui.W, ui.H) / 280));
      this.camp.draw(ui.ctx, dt, ui.W, ui.H, this.battleLayout(ui).cy - 66 * ui.u - 46 * S, S);
    }
    else this.drawPlainBg(ui);
    const power = combatPower();
    if (power !== this.lastPower) { this.flashPower = 1.2; this.lastPower = power; }
    this.flashPower = Math.max(0, this.flashPower - dt);

    switch (this.tab) {
      case 'battle': this.drawBattleTab(ui); break;
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

    // 新版水墨山河宣纸内页底纹：整张温润宣纸长卷 + 远山叠嶂淡墨剪影
    ui.markPaper(0, 0, ui.W, ui.H);
    const bg = cachedLayer('home_plain', `${ui.u}`, ui.W, ui.H, (g) => {
      const bgGrad = g.createLinearGradient(0, 0, 0, ui.H);
      bgGrad.addColorStop(0, '#f0e7d5');
      bgGrad.addColorStop(0.5, '#e3d5bb');
      bgGrad.addColorStop(1, '#d2c0a0');
      g.fillStyle = bgGrad;
      g.fillRect(0, 0, ui.W, ui.H);
      drawXuanTexture(g, 0, 0, ui.W, ui.H, ui.u, { alpha: 0.96, patina: true, patinaStrength: 1.2, stains: true });
      // 宣纸横丝纹理
      g.fillStyle = 'rgba(92,72,50,0.032)';
      for (let y = 0; y < ui.H; y += Math.max(4, Math.round(12 * ui.u))) {
        g.fillRect(0, y, ui.W, Math.max(1, Math.round(ui.u)));
      }
      // 顶部水墨远山淡影
      g.fillStyle = 'rgba(60,52,44,0.08)';
      g.beginPath();
      g.moveTo(0, 360 * ui.u);
      g.lineTo(0, 220 * ui.u);
      g.quadraticCurveTo(ui.W * 0.28, 150 * ui.u, ui.W * 0.55, 235 * ui.u);
      g.quadraticCurveTo(ui.W * 0.82, 165 * ui.u, ui.W, 215 * ui.u);
      g.lineTo(ui.W, 360 * ui.u);
      g.closePath();
      g.fill();
      // 底部远山叠嶂水墨剪影
      g.fillStyle = 'rgba(54,46,38,0.09)';
      g.beginPath();
      g.moveTo(0, ui.H);
      g.lineTo(0, ui.H - 280 * ui.u);
      g.quadraticCurveTo(ui.W * 0.25, ui.H - 350 * ui.u, ui.W * 0.52, ui.H - 260 * ui.u);
      g.quadraticCurveTo(ui.W * 0.78, ui.H - 340 * ui.u, ui.W, ui.H - 250 * ui.u);
      g.lineTo(ui.W, ui.H);
      g.closePath();
      g.fill();
    });
    g.drawImage(bg, 0, 0);
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
    // 顶部轻柔宣纸云雾衬底，无生硬黑块
    const topH = y + 146 * u;
    const topGrad = ctx.createLinearGradient(0, 0, 0, topH);
    topGrad.addColorStop(0, 'rgba(236,226,206,0.75)');
    topGrad.addColorStop(0.65, 'rgba(236,226,206,0.28)');
    topGrad.addColorStop(1, 'rgba(236,226,206,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, ui.W, topH);

    // 左上角：轻盈水墨宣纸帅印牌 + 连体战力笺
    const av = 94 * u;
    const ax = 16 * u;
    const p = Math.max(2, Math.round(u * 2.5));
    const b = Math.max(1.5, Math.round(u * 1.6));
    const px = ax + av - 6 * u;
    const pw = 198 * u;
    const ph = av;
    const py = y;
    ui.pixRect(px, py + b, pw, ph, 'rgba(28,20,14,0.14)', p);
    ui.pixRect(px, py, pw, ph, '#3d3025', p);
    const pGrad = ctx.createLinearGradient(px, py + b, px, py + ph - b);
    pGrad.addColorStop(0, '#f7f0e0');
    pGrad.addColorStop(1, '#e6d7bc');
    ui.pixRect(px + b, py + b, pw - b * 2, ph - b * 2, pGrad as unknown as string, Math.max(1, p - 1));
    ui.paperTexture(px + b, py + b, pw - b * 2, ph - b * 2, { alpha: 0.9, patina: true });
    ctx.strokeStyle = 'rgba(130,108,82,0.42)';
    ctx.lineWidth = Math.max(1, u);
    ctx.strokeRect(px + b * 2, py + b * 2, pw - b * 4, ph - b * 4);
    // 战力标题朱砂签条
    ui.pixRect(px + 12 * u, py + 9 * u, pw - 24 * u, 25 * u, '#a8261d', Math.max(1, p - 1));
    ui.icon('atk', px + 28 * u, py + 21.5 * u, 20 * u);
    ui.text('主公战力', px + 44 * u, py + 21.5 * u, 18, '#fbf4e4', 'left', null);
    const pc = this.flashPower > 0 ? (Math.floor(this.flashPower * 10) % 2 ? '#b5281f' : '#1e1814') : '#1e1814';
    ui.text(fmtNum(power), px + 20 * u, py + 64 * u, 34, pc, 'left', null);

    // 头像框与宣纸等级签
    ui.qualityFrame(ax, y, av, '#b86818');
    ui.icon(`${heroSpriteName(save.hero)}_0`, ax + av / 2, y + av / 2 - 2 * u, av * 0.88);
    // 底部等级宣纸小横匾
    const lvY = y + av - 6 * u;
    ui.pixRect(ax + 4 * u, lvY, av - 8 * u, 28 * u, '#3d3025', Math.max(1, p - 1));
    ui.pixRect(ax + 4 * u + b, lvY + b, av - 8 * u - b * 2, 28 * u - b * 2, '#f5ecda', Math.max(1, p - 1));
    ui.text('Lv.' + save.heroes[save.hero].lv, ax + av / 2, lvY + 14 * u, 18, '#1e1814', 'center', null);
    if (ui.clicked('top_hero_badge', ax, y, av + pw - 8 * u, av + 24 * u)) {
      this.viewHero = save.hero;
      this.tab = 'hero';
    }

    // 货币区（2×2 矩阵）
    const cw = 196 * u;
    const cx = ui.W - cw - 16 * u;
    const st = staminaNextSeconds();
    if (currencyBar(ui, cx, y, cw, 'stamina', `${save.stamina}/${STAMINA.max}`, 'top_stamina')) game.openDialog(new StaminaDialog());
    if (st > 0) ui.text(fmtTime(st), cx + cw / 2 + 10 * u, y + 64 * u, 16, '#5c4d3e', 'center', 'rgba(246,238,222,0.85)');
    currencyBar(ui, cx - cw - 10 * u, y, cw, 'gold', fmtNum(save.gold));
    if (currencyBar(ui, cx - cw - 10 * u, y + 62 * u + 20 * u, cw, 'yuanbao', fmtNum(save.yuanbao), 'top_yb')) this.tab = 'shop';
    currencyBar(ui, cx, y + 62 * u + 20 * u, cw, 'iron', fmtNum(save.iron));
  }

  // —— 底部导航 ——
  private navRects: Record<string, [number, number, number, number]> = {};
  private drawNav(ui: UI) {
    const u = ui.u;
    const h = 140 * u;
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
    // 底部轻盈古籍宣纸长卷导航栏（去掉沉重黑底板，改用熟宣卷尾底座）
    ui.markPaper(0, y - 8 * u, ui.W, h + 8 * u + ui.safeBottom);
    const navGrad = ctx.createLinearGradient(0, y - 6 * u, 0, ui.H);
    navGrad.addColorStop(0, '#e6d8be');
    navGrad.addColorStop(0.5, '#d8c6a6');
    navGrad.addColorStop(1, '#c8b490');
    ctx.fillStyle = navGrad;
    ctx.fillRect(0, y - 6 * u, ui.W, h + 6 * u + ui.safeBottom);
    ui.paperTexture(0, y - 6 * u, ui.W, h + 6 * u + ui.safeBottom, { alpha: 0.92, patina: true });
    // 顶部古籍双层乌丝栏墨线
    ctx.fillStyle = '#3d3024';
    ctx.fillRect(0, y - 7 * u, ui.W, 2.5 * u);
    ctx.fillStyle = 'rgba(72,56,42,0.35)';
    ctx.fillRect(0, y - 2 * u, ui.W, 1.2 * u);

    const tw = ui.W / TABS.length;
    const p = Math.max(2, Math.round(u * 3));
    const b = Math.max(1.5, Math.round(u * 1.6));
    TABS.forEach((t, i) => {
      const x = i * tw;
      const active = this.tab === t.id;
      const big = t.id === 'battle';
      this.navRects[t.id] = [x, y, tw, h];

      // 页签之间的乌丝细竖线
      if (i > 0) {
        ctx.fillStyle = 'rgba(72,56,42,0.22)';
        ctx.fillRect(x - 0.6 * u, y + 16 * u, 1.2 * u, h - 32 * u);
      }

      if (active) {
        // 选中态：轻巧升起的宣纸朱砂书签
        const ay = y - (big ? 10 * u : 4 * u);
        const ah = h - 4 * u + (big ? 6 * u : 0);
        ui.pixRect(x + 7 * u, ay + b, tw - 14 * u, ah, 'rgba(28,20,14,0.14)', p);
        ui.pixRect(x + 7 * u, ay, tw - 14 * u, ah, '#3b2e22', p);
        const tabGrad = ctx.createLinearGradient(x, ay + b, x, ay + ah - b);
        tabGrad.addColorStop(0, '#fbf5e6');
        tabGrad.addColorStop(1, '#ede0c6');
        ui.pixRect(x + 7 * u + b, ay + b, tw - 14 * u - b * 2, ah - b * 2, tabGrad as unknown as string, Math.max(1, p - 1));
        ui.paperTexture(x + 7 * u + b, ay + b, tw - 14 * u - b * 2, ah - b * 2, { alpha: 0.9, patina: true });
        ctx.strokeStyle = 'rgba(168,38,29,0.45)';
        ctx.lineWidth = Math.max(1, u);
        ctx.strokeRect(x + 7 * u + b * 2.2, ay + b * 2.2, tw - 14 * u - b * 4.4, ah - b * 4.4);
        // 顶部朱砂书签红条
        ctx.fillStyle = '#b5281f';
        ctx.fillRect(x + 22 * u, ay + b * 2.2, tw - 44 * u, 4 * u);
      } else if (big) {
        // 未选中时的中央「征战」淡墨圆晕
        ctx.fillStyle = 'rgba(72,56,42,0.08)';
        ctx.beginPath();
        ctx.arc(x + tw / 2, y + 54 * u, 40 * u, 0, Math.PI * 2);
        ctx.fill();
      }

      const isz = (big ? 78 : 60) * u * (active ? 1.1 : 1);
      const iy = y + (big ? 50 : 54) * u - (active ? 7 * u : 0);
      if (active) {
        ctx.fillStyle = 'rgba(181,40,31,0.10)';
        ctx.beginPath();
        ctx.arc(x + tw / 2, iy, isz * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ui.icon(t.icon, x + tw / 2, iy, isz);
      ui.text(t.name, x + tw / 2, y + h - 24 * u, active ? 27 : 24, active ? '#a82219' : '#3b2f24', 'center', null);
      const dot = (t.id === 'shop' && this.shopRedDot()) || (t.id === 'talent' && this.talentRedDot()) || (t.id === 'hero' && anyHeroRedDot());
      if (dot) ui.redDot(x + tw - 22 * u, y + 18 * u);
      if (ui.clicked('nav_' + t.id, x, y, tw, h)) {
        this.tab = t.id;
        if (save.guide === 1 && t.id === 'equip') save.guide = 2;
        if (save.guide === 3 && t.id === 'talent') save.guide = 4;
        if (save.guide === 5 && t.id === 'battle') save.guide = 6;
      }
    });
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
  private contentBottom(ui: UI) { return ui.H - 150 * ui.u - ui.safeBottom; }

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
      // 标题背后柔和宣纸云雾衬底（自然晕染，烘托焦墨大字）
      ctx.save();
      ctx.translate(ui.W / 2, ty + 4 * u);
      ctx.scale(3.3, 1);
      const rGrad = ctx.createRadialGradient(0, 0, 12 * u, 0, 0, 92 * u);
      rGrad.addColorStop(0, 'rgba(244,235,216,0.78)');
      rGrad.addColorStop(0.55, 'rgba(232,218,192,0.42)');
      rGrad.addColorStop(1, 'rgba(232,218,192,0)');
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 92 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 焦墨重彩书法大标题（外衬宣纸白边 + 浓墨渐变字芯）
      ctx.save();
      ctx.font = ui.font(86, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      // 宣纸飞白外轮廓与淡墨投影
      ctx.fillStyle = 'rgba(20,15,12,0.32)';
      ctx.fillText(GAME_INFO.shortName, ui.W / 2 + 4 * u, ty + 6 * u);
      ctx.lineWidth = 14 * u;
      ctx.strokeStyle = '#f6efe0';
      ctx.strokeText(GAME_INFO.shortName, ui.W / 2, ty);
      ctx.lineWidth = 6 * u;
      ctx.strokeStyle = '#c9b694';
      ctx.strokeText(GAME_INFO.shortName, ui.W / 2, ty);
      const tGrad = ctx.createLinearGradient(0, ty - 42 * u, 0, ty + 40 * u);
      tGrad.addColorStop(0, '#362c25');
      tGrad.addColorStop(0.45, '#1c1613');
      tGrad.addColorStop(1, '#0d0a08');
      ctx.fillStyle = tGrad;
      ctx.fillText(GAME_INFO.shortName, ui.W / 2, ty);
      ctx.restore();

      // 标题右上角：传统朱文方印「单骑」
      const sealX = ui.W / 2 + 236 * u, sealY = ty - 38 * u, sealS = 44 * u;
      ui.pixRect(sealX, sealY, sealS, sealS, '#a82219', Math.max(2, Math.round(u * 2.5)));
      ctx.strokeStyle = '#f4ead5';
      ctx.lineWidth = Math.max(1.5, 2 * u);
      ctx.strokeRect(sealX + 3 * u, sealY + 3 * u, sealS - 6 * u, sealS - 6 * u);
      ui.text('单骑', sealX + sealS / 2, sealY + sealS / 2 + 1 * u, 16, '#f7efe0', 'center', null);

      // 副标题宣纸乌丝栏横匾 + 两侧对称水墨飞白线
      const sw = 276 * u, sh = 38 * u, sy0 = ty + 66 * u;
      const p = Math.max(2, Math.round(u * 3));
      for (const dir of [-1, 1]) {
        const wx = ui.W / 2 + dir * (sw / 2 + 10 * u);
        ctx.fillStyle = 'rgba(28,22,18,0.68)';
        ctx.fillRect(dir > 0 ? wx : wx - 54 * u, sy0 - 1.5 * u, 54 * u, 3 * u);
      }
      ui.pixRect(ui.W / 2 - sw / 2, sy0 - sh / 2, sw, sh, '#1c1613', p);
      ui.pixRect(ui.W / 2 - sw / 2 + p * 0.8, sy0 - sh / 2 + p * 0.8, sw - p * 1.6, sh - p * 1.6, '#8c7960', p);
      ui.pixRect(ui.W / 2 - sw / 2 + p * 1.6, sy0 - sh / 2 + p * 1.6, sw - p * 3.2, sh - p * 3.2, '#f0e5cf', Math.max(1, p - 1));
      ui.text('◆  乱 世 幸 存 者  ◆', ui.W / 2, sy0, 21, '#9e1e18', 'center', null);
    }

    // 点人物进武将页
    const hr = this.camp.heroBox;
    if (ui.clicked('home_hero', hr[0], hr[1], hr[2], hr[3])) { this.viewHero = save.hero; this.tab = 'hero'; }
    // 点营地里闲逛的武将：看他的详情
    for (const w of this.camp.heroRects) if (ui.clicked('camp_' + w.id, w.r[0], w.r[1], w.r[2], w.r[3])) { this.viewHero = w.id; this.tab = 'hero'; }

    // 侧边功能按钮
    const side: { id: string; icon: string; label: string; dot: boolean; on: () => void; show?: boolean; now?: boolean }[] = [
      { id: 'signin', icon: 'calendar', label: '签到', dot: canSignin(), on: () => game.openDialog(new SigninDialog()) },
      ...(newbieActive() ? [{ id: 'newbie', icon: 'chest_gold', label: '七日', dot: newbieRedDot(), on: () => game.openDialog(new NewbieDialog()) }] : []),
      { id: 'tasks', icon: 'scroll', label: '任务', dot: tasksRedDot(), on: () => game.openDialog(new TasksDialog()) },
      { id: 'patrol', icon: 'tent', label: '巡营', dot: patrolPending().minutes >= 60, on: () => game.openDialog(new PatrolDialog()) },
      { id: 'weekly', icon: 'atk', label: '挑战', dot: endlessOpen() && weeklyRedDot(), on: () => { if (endlessOpen()) game.openDialog(new WeeklyDialog()); else ui.toast(`通关第${ENDLESS_UNLOCK}章解锁每周挑战`); } },
    ];
    const sideR: typeof side = [
      ...(IS_XHS && !save.xhsFollowClaimed ? [{ id: 'xhs', icon: 'hero_sunshangxiang_0', label: '关注', dot: true, on: () => game.openDialog(new XhsFollowDialog()) }] : []),
      ...(WEB_RULES && save.homeMode !== 'tower' && save.homeMode !== 'tianji' ? [{ id: 'prepare', icon: 'p_flag', label: '备战', dot: false, on: () => game.openDialog(new PreparationDialog()) }] : []),
      { id: 'rank', icon: 'trophy', label: IS_H5 ? '战绩' : '排行', dot: false, on: () => game.openDialog(new RankDialog()) },
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
      { id: 'codex', icon: 'p_book', label: '图鉴', dot: achRedDot() || codexUnclaimed() > 0, on: () => game.openDialog(new CodexDialog()) },
      { id: 'settings', icon: 'gear', label: '设置', dot: false, on: () => game.openDialog(new SettingsDialog()) },
      ...(IS_H5 ? [] : [{ id: 'share', icon: 'share', label: '分享', dot: false, on: () => getPlatform().share('长坂坡七进七出，你能撑过几分钟？') }]),
    ];
    if (getPlatform().supportsSidebar() || getPlatform().name === 'tt') sideR.push({ id: 'sidebar', icon: 'sidebar', label: '侧边栏', dot: !save.daily.sidebar, on: () => game.openDialog(new SidebarDialog()) });
    const bs = 84 * u;
    const sy = top + 160 * u;
    // 按钮多时自动压缩间距，避免压住章节卡
    const cardTop = L.cy;
    const drawSide = (list: typeof side, x0: number, right: boolean) => list.forEach((s, i) => {
      const step = Math.min(bs + 40 * u, (cardTop - sy - 20 * u) / list.length);
      // 空间不够时缩小按钮，保证下面的文字不被下一个按钮挡住
      const b = Math.min(bs, step - 34 * u);
      const x = right ? x0 + bs - b : x0;
      const y = sy + i * step;
      this.sideBtnRect[s.id] = [x, y, b, b];
      const pressed = ui.isPressed('side_' + s.id);
      const off = pressed ? 3 * u : 0;
      ui.panel(x, y + off, b, b, 'dark');
      ui.icon(s.icon, x + b / 2, y + b * (NEW_UI ? 0.45 : 0.5) + off, b * 0.56);
      if (!NEW_UI) {
        ui.text(s.label, x + b / 2, y + b + 16 * u, 20, '#fff');
      } else {
        // 底部轻巧宣纸细框题签
        const lw = b + 4 * u, lh = 24 * u;
        const lx = x - 2 * u, ly = y + b - 7 * u + off;
        const lp = Math.max(1.5, Math.round(u * 2));
        const lb = Math.max(1, Math.round(u * 1.4));
        ui.pixRect(lx, ly, lw, lh, '#3d3126', lp);
        ui.pixRect(lx + lb, ly + lb, lw - lb * 2, lh - lb * 2, '#f7f0e0', Math.max(1, lp - 1));
        ui.text(s.label, x + b / 2, ly + lh / 2 + 0.5 * u, 17, '#1e1814', 'center', null);
      }
      if (s.dot) ui.redDot(x + b - 6 * u, y + 6 * u);
      if (s.now) ui.tapNow('side_' + s.id, x, y, b, b, s.on);
      else if (ui.clicked('side_' + s.id, x, y, b, b)) s.on();
    });
    drawSide(side, 18 * u, false);
    drawSide(sideR, ui.W - bs - 18 * u, true);

    // 模式切换：征战 / 守城（章节卡上方两个轻盈宣纸/篆印页签）
    const mode = save.homeMode || 'chapter';
    {
      // 四个页签收窄到两侧按钮之间（两侧按钮占 18~102 和 648~732）
      const mw = 128 * u, mh = 66 * u, my = L.cy - mh - 8 * u, gap = 8 * u;
      const today = new Date().toISOString().slice(0, 10);
      (['tianji', 'chapter', 'defense', 'tower'] as const).forEach((m, i) => {
        const mx = ui.W / 2 - (mw * 4 + gap * 3) / 2 + i * (mw + gap);
        const label = { chapter: '征 战', defense: '守 城', tower: '布 阵', tianji: '天 机' }[m];
        const on = mode === m;
        if (!NEW_UI) {
          ui.pixRect(mx, my, mw, mh, on ? (m === 'chapter' ? '#a22633' : '#2f7a3a') : 'rgba(20,12,10,0.78)');
          ui.pixRect(mx, my + mh - 4 * u, mw, 4 * u, on ? '#fee761' : '#5a4038');
          ui.text(label, mx + mw / 2, my + mh / 2 - 2 * u, 28, on ? '#fff4d6' : '#a89a86', 'center', on ? '#3a0d12' : null);
        } else {
          const p = Math.max(2, Math.round(u * 2.5));
          const b = Math.max(1.5, Math.round(u * 1.6));
          ui.pixRect(mx, my + b, mw, mh, 'rgba(28,20,14,0.14)', p);
          ui.pixRect(mx, my, mw, mh, '#3b2f24', p);
          if (on) {
            ui.pixRect(mx + b, my + b, mw - b * 2, mh - b * 2, '#f5ecda', p);
            const tGrad = ctx.createLinearGradient(mx, my + b * 2, mx, my + mh - b * 2);
            if (m === 'chapter') {
              tGrad.addColorStop(0, '#bf3428');
              tGrad.addColorStop(1, '#962016');
            } else if (m === 'tianji') {
              tGrad.addColorStop(0, '#6a3a9a');
              tGrad.addColorStop(1, '#43216a');
            } else {
              tGrad.addColorStop(0, '#3b8050');
              tGrad.addColorStop(1, '#265c36');
            }
            ui.pixRect(mx + b * 2, my + b * 2, mw - b * 4, mh - b * 4, tGrad as unknown as string, Math.max(1, p - 1));
          } else {
            const tGrad = ctx.createLinearGradient(mx, my + b, mx, my + mh - b);
            tGrad.addColorStop(0, '#f5eddc');
            tGrad.addColorStop(1, '#e0d0b2');
            ui.pixRect(mx + b, my + b, mw - b * 2, mh - b * 2, tGrad as unknown as string, Math.max(1, p - 1));
            ctx.strokeStyle = 'rgba(120,98,74,0.4)';
            ctx.lineWidth = Math.max(1, u);
            ctx.strokeRect(mx + b * 2.2, my + b * 2.2, mw - b * 4.4, mh - b * 4.4);
          }
          const iconName = m === 'chapter' ? 'atk' : m === 'defense' ? 'p_armor' : m === 'tower' ? 'td_arrow1' : 'tj_tong';
          ui.icon(iconName, mx + mw / 2 - 38 * u, my + mh / 2, 28 * u, on ? 1 : 0.72);
          ui.text(label, mx + mw / 2 + 14 * u, my + mh / 2, 24, on ? '#fbf4e4' : '#2e241c', 'center', on ? (m === 'chapter' ? '#4a100b' : m === 'tianji' ? '#2a0e40' : '#102e19') : null);
        }
        if (m === 'defense' && !on && save.defense?.day !== today) ui.redDot(mx + mw - 8 * u, my + 6 * u);
        if (m === 'tianji' && !on && (save.daily.tianjiRuns || 0) < TIANJI_DAILY) ui.redDot(mx + mw - 8 * u, my + 6 * u);
        if (ui.clicked('mode_' + m, mx, my, mw, mh)) { save.homeMode = m; markDirty(); }
      });
    }
    if (mode === 'defense') { this.drawDefenseCard(ui, L); return; }
    if (mode === 'tower') { this.drawTowerCard(ui, L); return; }
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
      if (ui.button('start_battle', ui.W / 2 - 200 * u, by, 250 * u, bh, '出 征', C.btnRed, { size: 42, sub: `体力 ${STAMINA.costPerRun}` })) this.chooseCampaign(ch.id, d);
      const sweepLabel = WEB_RULES ? (chapterStars(d, ch.id) === THREE_STARS ? undefined : '三星领元宝') : '免挑战';
      if (ui.button('sweep_battle', ui.W / 2 + 60 * u, by, 140 * u, bh, '碾压', C.btnGold, { size: 34, sub: sweepLabel })) {
        this.sweep(() => settleRun(ch, diff, true, WEB_RULES ? null : ch.duration, 150, 1500, 2, 2, THREE_STARS), `第${ch.id}章 ${ch.name}`, 'chapter', ch.id, d);
      }
    } else if (ui.button('start_battle', ui.W / 2 - bw / 2, by, bw, bh, '出 征', C.btnRed, { size: 48, disabled: !unlocked, sub: `消耗体力 ${STAMINA.costPerRun}` })) this.chooseCampaign(ch.id, d);
    this.startRect = [ui.W / 2 - bw / 2, by, bw, bh];
    // 无尽模式入口
    const eo = endlessOpen();
    const ew = 150 * u;
    const ex = 20 * u;
    if (ui.button('endless', ex, by, ew, bh, '无尽', eo ? C.btnPurple : C.btnGray, { size: 32, sub: eo ? (save.endlessBest ? fmtTime(save.endlessBest) : '挑战') : `通关第${ENDLESS_UNLOCK}章` })) {
      if (!eo) ui.toast(`通关第${ENDLESS_UNLOCK}章解锁无尽模式`);
      else this.startBattle(0, 0);
    }
    // 章节总览
    if (ui.button('chapters', ui.W - ew - 20 * u, by, ew, bh, '章节', C.btnBlue, { size: 32, sub: `${save.maxCleared}/${CHAPTERS.length}` })) game.openDialog(new ChapterListDialog((c, dd) => { save.selectedChapter = c; save.selectedDiff = dd; markDirty(); }));
  }
  private startRect: [number, number, number, number] = [0, 0, 0, 0];

  /** 天机签卡片：无名剑客待机 + 规则一句话 + 纪录 + 今日奖励次数；不耗体力 */
  private drawTianjiCard(ui: UI, L: { chH: number; bh: number; by: number; cy: number }) {
    const u = ui.u, ctx = ui.ctx, st = save.tianji;
    const y = L.cy, cx = ui.W / 2, cw = ui.W - 80 * u;
    ui.panel(40 * u, y, cw, L.chH, 'paper');
    const p = Math.max(2, Math.round(u * 2));
    ui.pixRect(76 * u, y + 18 * u, cw - 72 * u, 42 * u, '#fbf5e6', p);
    ctx.strokeStyle = '#5a2a8c'; ctx.lineWidth = Math.max(1.2, u * 1.5);
    ctx.strokeRect(78 * u, y + 20 * u, cw - 76 * u, 38 * u);
    ctx.fillStyle = '#5a2a8c'; ctx.fillRect(104 * u, y + 20 * u, cw - 128 * u, 3 * u);
    ui.text('◆ 天机签 · 无名剑客 ◆', cx, y + 39 * u, 23, '#43216a', 'center', null);
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
    const left = Math.max(0, TIANJI_DAILY - (save.daily.tianjiRuns || 0));
    ui.text(st.bestDmg ? `天命伤害最佳 ${fmtNum(st.bestDmg)}` : st.runs ? `最久 ${fmtTime(st.best)} · 活满 ${st.wins} 次` : '8:30 天命之主登场 · 伤害上排行', tx, y + 70 * u + row * 2.5, 19, '#6a3a9a', 'left', null);
    ui.text(left ? `今日奖励还剩 ${left}/${TIANJI_DAILY} 次` : '今日奖励已领完 · 仍可随便玩', tx, y + 70 * u + row * 3.45, 20, left ? '#a22633' : '#8a7c6c', 'left', null);
    if (ui.button('tj_rules', 30 * u, L.by, 150 * u, L.bh, '玩法', C.btnGray, { size: 27, sub: '签与概率' })) game.openDialog(new TianjiRulesDialog());
    if (ui.button('tj_rank', 190 * u, L.by, 150 * u, L.bh, '排行', C.btnBlue, { size: 27, sub: '天命伤害' })) game.openDialog(new RankDialog('tianji'));
    this.startRect = [350 * u, L.by, 370 * u, L.bh];
    if (ui.button('tj_start', ...this.startRect, '入 局', C.btnRed, { size: 44, sub: '不耗体力' })) {
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
    ui.text(`布阵 · 第 ${map.id} 关`, cx, y + 40 * u, 23, C.gold);
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
      const p = Math.max(2, Math.round(u * 2));
      ui.pixRect(cx + 36 * u, cy + 18 * u, cw - 72 * u, 42 * u, '#fbf5e6', p);
      ctx.strokeStyle = '#2b6e3f';
      ctx.lineWidth = Math.max(1.2, u * 1.5);
      ctx.strokeRect(cx + 38 * u, cy + 20 * u, cw - 76 * u, 38 * u);
      ctx.fillStyle = '#2b6e3f';
      ctx.fillRect(cx + 64 * u, cy + 20 * u, cw - 128 * u, 3 * u);
      ui.text(`◆ 守城 · 第 ${lv} 关 ◆`, ui.W / 2, cy + 39 * u, 23, '#205930', 'center', null);
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
      if (ui.button('start_defense', ui.W / 2 - 200 * u, by, 250 * u, bh, '守 城', C.btnGreen, { size: 42, sub: `体力 ${STAMINA.costPerRun}` })) this.startBattle(-3, lv);
      const sweepLabel = WEB_RULES ? (defenseStars(lv) === THREE_STARS ? undefined : '三星领元宝') : '免挑战';
      if (ui.button('sweep_defense', ui.W / 2 + 60 * u, by, 140 * u, bh, '碾压', C.btnGold, { size: 34, sub: sweepLabel })) this.sweep(() => settleDefense(lv, true, WEB_RULES ? null : ch.duration, 120, 1200, 2, 1, 12, WEB_RULES ? THREE_STARS : undefined), `守城 · ${ch.name}`, 'defense', lv, 0);
    } else if (ui.button('start_defense', ui.W / 2 - bw / 2, by, bw, bh, '守 城', C.btnGreen, { size: 48, disabled: !open, sub: `消耗体力 ${STAMINA.costPerRun}` })) this.startBattle(-3, lv);
    this.startRect = [ui.W / 2 - bw / 2, by, bw, bh];
    const ew = 150 * u;
    const eo = endlessOpen();
    if (ui.button('endless', 20 * u, by, ew, bh, '无尽', eo ? C.btnPurple : C.btnGray, { size: 32, sub: eo ? (save.endlessBest ? fmtTime(save.endlessBest) : '挑战') : `通关第${ENDLESS_UNLOCK}章` })) {
      if (!eo) ui.toast(`通关第${ENDLESS_UNLOCK}章解锁无尽模式`);
      else this.startBattle(0, 0);
    }
    if (ui.button('def_list', ui.W - ew - 20 * u, by, ew, bh, '关卡', C.btnBlue, { size: 32, sub: `${save.defense?.cleared || 0}/${n}` })) game.openDialog(new DefenseListDialog((l) => { save.selectedDefense = l; markDirty(); }));
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

  // —— 武将页 ——
  private viewHero = '';
  private drawHeroTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    if (!this.viewHero) this.viewHero = save.hero;
    // 武将列表：每行 5 个
    const cols = 5;
    const cw = (ui.W - 40 * u) / cols;
    const rowH = cw + 22 * u;
    HEROES.forEach((h, i) => {
      const st = save.heroes[h.id];
      const x = 20 * u + (i % cols) * cw, y = top + Math.floor(i / cols) * rowH;
      const sz = cw - 12 * u;
      const sel = this.viewHero === h.id;
      ui.qualityFrame(x + 6 * u, y, sz, sel ? '#feae34' : st.owned ? '#8b9bb4' : '#3a3040');
      ui.icon(`hero_${h.id}_${sel ? Math.floor(ui.time * 6) % 4 : 0}`, x + 6 * u + sz / 2, y + sz / 2, sz * 0.9, st.owned ? 1 : 0.35);
      if (!st.owned) ui.icon('lock', x + 6 * u + sz - 18 * u, y + 20 * u, 26 * u);
      ui.text(h.name, x + cw / 2, y + sz + 18 * u, 22, sel ? C.gold : st.owned ? '#fff4d6' : '#888');
      if (st.owned) for (let k = 0; k < st.star; k++) ui.icon('star', x + cw / 2 - (st.star - 1) * 8 * u + k * 16 * u, y + sz - 12 * u, 16 * u);
      if (save.hero === h.id) { ui.pixRect(x + 6 * u, y, 56 * u, 26 * u, '#a22633'); ui.text('出战', x + 34 * u, y + 13 * u, 16, '#fff', 'center', null); }
      if (heroRedDot(h.id)) ui.redDot(x + cw - 10 * u, y + 6 * u);
      if (ui.clicked('hero_pick_' + h.id, x, y, cw, sz + 30 * u)) this.viewHero = h.id;
    });
    const h = HERO_BY_ID[this.viewHero];
    const st = save.heroes[h.id];
    const py = top + Math.ceil(HEROES.length / cols) * rowH + 8 * u;
    const ph = this.contentBottom(ui) - py - 10 * u;
    ui.panel(16 * u, py, ui.W - 32 * u, ph, 'wood');
    const follow = IS_XHS && h.id === 'sunshangxiang' && !save.xhsFollowClaimed;
    const off = ui.beginScroll('hero_detail', 16 * u, py + 12 * u, ui.W - 32 * u, ph - 24 * u, (1470 + (follow ? 104 : 0) + 108 * heroLinks(this.viewHero || save.hero).length) * u);
    let y = py + 20 * u + off;
    // 立绘区
    if (!NEW_UI) {
      ui.ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ui.ctx.fillRect(50 * u, y, ui.W - 100 * u, 260 * u);
    } else {
      // 水墨山水圆月画框
      const bx = 50 * u, bw0 = ui.W - 100 * u, bh0 = 260 * u;
      ui.pixRect(bx, y, bw0, bh0, '#8c7a62', Math.max(2, Math.round(u * 3)));
      ui.pixRect(bx + 3 * u, y + 3 * u, bw0 - 6 * u, bh0 - 6 * u, '#dfd0b4', Math.max(2, Math.round(u * 2)));
      ui.ctx.fillStyle = 'rgba(255,250,240,0.58)';
      ui.ctx.beginPath();
      ui.ctx.arc(ui.W / 2, y + bh0 * 0.5, 102 * u, 0, Math.PI * 2);
      ui.ctx.fill();
      ui.ctx.strokeStyle = 'rgba(72,56,42,0.26)';
      ui.ctx.lineWidth = Math.max(1, 1.5 * u);
      ui.ctx.stroke();
      ui.paperTexture(bx + 3 * u, y + 3 * u, bw0 - 6 * u, bh0 - 6 * u, { alpha: 0.78, patina: true });
    }
    ui.icon(heroIdleFrame(heroSpriteName(h.id), ui.time), ui.W / 2, y + 130 * u, 250 * u, st.owned ? 1 : 0.5);
    ui.text(h.title, ui.W / 2, y + 290 * u, 34, h.color);
    ui.text(`「${h.quote}」`, ui.W / 2, y + 334 * u, 22, '#fff4d6');
    ui.pixRect(60 * u, y + 14 * u, 140 * u, 40 * u, NEW_UI ? '#2b221c' : '#231917');
    ui.text(h.role, 130 * u, y + 34 * u, 20, NEW_UI ? '#f5ead4' : h.color, 'center', null);
    if (st.owned) for (let k = 0; k < 5; k++) ui.icon('star', ui.W - 90 * u - (4 - k) * 30 * u, y + 34 * u, 26 * u, k < st.star ? 1 : 0.2);
    y += 370 * u;
    if (follow) {
      if (ui.button('hero_xhs', 50 * u, y, ui.W - 100 * u, 80 * u, '关注领孙尚香', C.btnGold)) game.openDialog(new XhsFollowDialog());
      y += 104 * u;
    }
    const hb = heroBase(h.id);
    const lx = 50 * u;
    ui.text(`等级 ${st.lv}/${HERO.maxLevel}`, lx, y, 26, C.gold, 'left');
    ui.text(`攻击 ${hb.atk}`, lx + 230 * u, y, 24, '#ffb070', 'left');
    ui.text(`生命 ${hb.hp}`, lx + 400 * u, y, 24, '#9be37a', 'left');
    y += 40 * u;
    const pk = st.peak || 0;
    ui.text(`移速 ${h.moveSpeed}   星级加成 +${Math.round((st.owned ? st.star - 1 : 0) * 12)}%${pk ? `   巅峰 Lv.${pk}（攻击生命 +${Math.round(pk * PEAK_BONUS * 100)}%${pk >= 10 ? `，对敌将 +${5 * Math.floor(pk / 10)}%` : ''}）` : ''}`, lx, y, 20, pk ? '#dc9be9' : C.textDim, 'left');
    y += 50 * u;
    const row = (icon: string, title: string, desc: string) => {
      ui.qualityFrame(lx, y, 84 * u, '#5a6988');
      ui.icon(icon, lx + 42 * u, y + 42 * u, 56 * u);
      ui.text(title, lx + 104 * u, y + 20 * u, 24, C.gold, 'left');
      ui.wrapText(desc, lx + 104 * u, y + 36 * u, ui.W - lx * 2 - 110 * u, 20, '#d9c6a0');
      y += 108 * u;
    };
    const wd = WEAPONS[h.weapon];
    row('star', '天赋', h.passive);
    row(wd.icon, `专属武器 · ${wd.name}`, `${wd.intro}。满级后搭配「${PASSIVES[wd.evoPassive].name}」进化为「${wd.evoName}」`);
    row(wd.evoIcon, `大招 · ${h.ultName}`, h.ultDesc);
    for (const { weapon, link } of heroLinks(h.id)) {
      const d = WEAPONS[weapon];
      const lock = (d.unlockCh || 0) > save.maxCleared ? `（「${d.name}」通关第${d.unlockCh}章后出现）` : '';
      row(d.evoIcon, `专属联动 · ${link.name}`, `「${d.name}」搭配「${PASSIVES[d.evoPassive].name}」进化时，变为专属形态：${link.desc.replace(/^.*?：/, '')}${lock}`);
    }
    y += 10 * u;
    // 操作按钮
    const bw = (ui.W - 140 * u) / 3, bh = 96 * u;
    if (st.owned) {
      const cost = heroLevelCost(st.lv);
      const maxLv = st.lv >= HERO.maxLevel;
      if (ui.button('hero_up', lx, y, bw, bh, maxLv ? '满级' : '升级', save.gold >= cost && !maxLv ? C.btnGold : C.btnGray, { size: 28, disabled: maxLv, sub: maxLv ? undefined : `${fmtNum(cost)}金` })) {
        const err = upgradeHero(h.id);
        if (err) ui.toast(err); else playSfx('levelup');
      }
      const maxStar = st.star >= MAX_STAR;
      if (maxStar) {
        // 五星以后：多出来的碎片升巅峰等级
        const pkMax = pk >= PEAK_MAX;
        const pc = peakCost(pk);
        if (ui.button('hero_peak', lx + bw + 20 * u, y, bw, bh, pkMax ? '巅峰已满' : `巅峰${pk + 1}级`, st.shards >= pc && !pkMax ? C.btnPurple : C.btnGray, { size: 26, disabled: pkMax, sub: pkMax ? undefined : `碎片 ${st.shards}/${pc}` })) {
          const err = peakUpHero(h.id);
          if (err) ui.toast(err); else { playSfx('evolve'); ui.toast(`${h.name}巅峰等级 Lv.${st.peak}！`); flushSave(true); }
        }
      } else {
        const sc = STAR_COST[st.star - 1];
        if (ui.button('hero_star', lx + bw + 20 * u, y, bw, bh, '升星', st.shards >= sc ? C.btnPurple : C.btnGray, { size: 28, sub: `碎片 ${st.shards}/${sc}` })) {
          const err = starUpHero(h.id);
          if (err) ui.toast(err);
          else { playSfx('evolve'); ui.toast(st.star >= MAX_STAR ? `${h.name}升至五星！解锁觉醒造型和巅峰等级` : `${h.name}升至${st.star}星！`); flushSave(true); }
        }
      }
      const on = save.hero === h.id;
      if (ui.button('hero_use', lx + bw * 2 + 40 * u, y, bw, bh, on ? '出战中' : '出战', on ? C.btnGray : C.btnRed, { size: 28, disabled: on })) {
        save.hero = h.id;
        markDirty();
        playSfx('boss');
        ui.toast(`${h.name}出战！`);
      }
    } else {
      ui.text(h.unlockText, ui.W / 2, y + 10 * u, 22, '#ff8a80');
      if (h.unlockShards > 0) {
        ui.icon('shard', lx + 20 * u, y + 60 * u, 36 * u);
        ui.bar(lx + 50 * u, y + 46 * u, ui.W - lx * 2 - 300 * u, 28 * u, st.shards / h.unlockShards, '#feae34');
        ui.text(`${st.shards}/${h.unlockShards}`, lx + 50 * u + (ui.W - lx * 2 - 300 * u) / 2, y + 60 * u, 18, '#fff');
        const can = st.shards >= h.unlockShards;
        if (ui.button('hero_unlock', ui.W - lx - 220 * u, y + 30 * u, 220 * u, 86 * u, '解锁', can ? C.btnGold : C.btnGray, { size: 28, disabled: !can })) {
          const err = unlockHero(h.id);
          if (err) ui.toast(err);
          else { playSfx('victory'); save.hero = h.id; flushSave(true); ui.toast(`获得武将：${h.name}！`); }
        }
      }
    }
    if (st.owned && st.shards > 0) ui.text(`持有碎片 ${st.shards}`, ui.W / 2, y + bh + 30 * u, 20, C.textDim);
    // 五星觉醒造型
    {
      const ay = y + bh + 60 * u;
      const can = st.owned && st.star >= MAX_STAR;
      ui.pixRect(lx, ay, ui.W - lx * 2, 160 * u, '#231917');
      ui.qualityFrame(lx + 14 * u, ay + 14 * u, 132 * u, can ? '#fee761' : '#3a3040');
      ui.icon(`hero_${h.id}_awk_${Math.floor(ui.time * 6) % 8}`, lx + 80 * u, ay + 80 * u, 126 * u, can ? 1 : 0.35);
      ui.text('五星觉醒 · 步战造型', lx + 166 * u, ay + 40 * u, 26, '#fee761', 'left');
      ui.text(`效果：伤害 +${AWAKEN_DMG}%，生命 +${Math.round(AWAKEN_HP * 100)}%`, lx + 166 * u, ay + 80 * u, 20, '#d9c6a0', 'left');
      if (!can) ui.text(st.owned ? `升至五星解锁（当前${st.star}星）` : '获得武将并升至五星解锁', lx + 166 * u, ay + 116 * u, 20, '#ff8a80', 'left');
      else if (ui.button('awaken_toggle', ui.W - lx - 194 * u, ay + 40 * u, 180 * u, 80 * u, st.awaken ? '换回骑马' : '启用', st.awaken ? C.btnGray : C.btnGold, { size: 26 })) {
        st.awaken = !st.awaken; markDirty(); playSfx(st.awaken ? 'evolve' : 'click');
      }
    }
    y += 180 * u;
    // 皮肤
    {
      const sk = SKINS[h.id];
      const ss = skinState(h.id);
      const sy2 = y + bh + 60 * u;
      ui.pixRect(lx, sy2, ui.W - lx * 2, 150 * u, '#231917');
      ui.qualityFrame(lx + 14 * u, sy2 + 14 * u, 122 * u, ss.owned ? '#b55088' : '#3a3040');
      ui.icon(`hero_${h.id}_skin_${Math.floor(ui.time * 6) % 4}`, lx + 75 * u, sy2 + 75 * u, 116 * u, ss.owned ? 1 : 0.45);
      ui.text(`皮肤 · ${sk.name}`, lx + 156 * u, sy2 + 40 * u, 26, '#dc9be9', 'left');
      ui.text(`穿戴效果：${sk.bonus}`, lx + 156 * u, sy2 + 80 * u, 20, '#d9c6a0', 'left');
      const bw2 = 180 * u, bx2 = ui.W - lx - bw2 - 14 * u, by2 = sy2 + 36 * u;
      if (ss.owned) {
        if (ui.button('skin_toggle', bx2, by2, bw2, 80 * u, ss.on ? '卸下' : '穿戴', ss.on ? C.btnGray : C.btnPurple, { size: 26 })) { ss.on = !ss.on; markDirty(); playSfx('click'); }
      } else {
        const skinCost = (sk.ads - ss.ads) * NO_ADS_PRICE.skinPerAd;
        if (NO_ADS) {
          ui.text(`消耗${skinCost}元宝解锁`, lx + 156 * u, sy2 + 116 * u, 20, C.gold, 'left');
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
        } else ui.text(`观看视频 ${ss.ads}/${sk.ads} 解锁`, lx + 156 * u, sy2 + 116 * u, 20, C.gold, 'left');
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
