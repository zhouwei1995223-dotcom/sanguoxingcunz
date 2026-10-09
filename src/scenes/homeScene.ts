import { game, Scene } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { HomeBackground } from './homeBg';
import { save, markDirty, flushSave, tickStamina, staminaNextSeconds, rolloverDaily } from '../meta/save';
import {
  computeStats, combatPower, getEquipped, isEquipped, equipBest, mergeAll, upgradeHero, upgradeTalent, chapterUnlocked,
  canSignin, tasksRedDot, patrolPending, spendStamina, chestById, openChest, progressTask,
} from '../meta/ops';
import {
  HERO, heroLevelCost, SLOTS, SLOT_NAMES, SLOT_ICONS, EQUIP_BY_ID, TALENTS, talentCost, STAT_NAMES, PERCENT_STATS, STAMINA,
  CHESTS, SHOP_DAILY, QUALITY_NAMES, QUALITY_COLORS,
} from '../data/meta';
import { CHAPTERS } from '../data/chapters';
import { fmtNum, fmtTime } from '../core/math';
import { itemSlot, currencyBar, adButton } from '../ui/widgets';
import { playBgm, playSfx } from '../audio/sound';
import { BattleScene } from './battleScene';
import {
  SigninDialog, TasksDialog, PatrolDialog, SettingsDialog, ItemDialog, ChestResultDialog, StaminaDialog, RankDialog,
  SidebarDialog, ChapterStoryDialog,
} from './homeDialogs';
import { guidePointer } from '../ui/guide';
import { GAME_INFO } from '../data/platformConfig';

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
  private flashPower = 0;
  private lastPower = 0;
  private autoPopped = false;

  enter() {
    const p = getPlatform();
    this.bg = new HomeBackground(p.width, p.height);
    playBgm('bgm_home');
    rolloverDaily();
    tickStamina();
    this.lastPower = combatPower();
    flushSave(true);
  }

  update(dt: number) {
    const ui = game.ui;
    tickStamina();
    rolloverDaily();
    if (this.tab === 'battle') this.bg.draw(ui.ctx, dt);
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
    // 头像与战力
    const av = 92 * u;
    ui.qualityFrame(16 * u, y, av, '#feae34');
    ui.icon('hero_0', 16 * u + av / 2, y + av / 2, av * 0.9);
    ui.pixRect(16 * u, y + av - 4 * u, av, 30 * u, '#120d0c');
    ui.text('Lv.' + save.heroLv, 16 * u + av / 2, y + av + 11 * u, 18, '#fff');
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
  }

  // —— 底部导航 ——
  private navRects: Record<string, [number, number, number, number]> = {};
  private drawNav(ui: UI) {
    const u = ui.u;
    const h = 140 * u;
    const y = ui.H - h - ui.safeBottom;
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
      const dot = (t.id === 'shop' && this.shopRedDot()) || (t.id === 'talent' && this.talentRedDot()) || (t.id === 'hero' && save.gold >= heroLevelCost(save.heroLv) && save.heroLv < HERO.maxLevel);
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
    return !save.daily.freeGift || CHESTS.some((c) => (save.daily.chestAd[c.id] || 0) < c.adDaily);
  }
  private talentRedDot() {
    return TALENTS.some((t) => (save.talents[t.id] || 0) < t.max && save.maxCleared >= t.unlockChapter && save.gold >= talentCost(t, save.talents[t.id] || 0));
  }

  private contentTop(ui: UI) { return ui.safeTop + 190 * ui.u; }
  private contentBottom(ui: UI) { return ui.H - 150 * ui.u - ui.safeBottom; }

  // —— 征战页 ——
  private sideBtnRect: Record<string, [number, number, number, number]> = {};
  private drawBattleTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    // 标题
    const ty = top + 70 * u;
    ui.text(GAME_INFO.shortName, ui.W / 2 + 4 * u, ty + 4 * u, 96, '#3a0d12', 'center', null);
    ui.text(GAME_INFO.shortName, ui.W / 2, ty, 96, '#fee761', 'center', '#7a1c24');
    ui.text('— 三国幸存者 —', ui.W / 2, ty + 74 * u, 30, '#fff4d6');

    // 侧边功能按钮
    const side: { id: string; icon: string; label: string; dot: boolean; on: () => void; show?: boolean }[] = [
      { id: 'signin', icon: 'calendar', label: '签到', dot: canSignin(), on: () => game.openDialog(new SigninDialog()) },
      { id: 'tasks', icon: 'scroll', label: '任务', dot: tasksRedDot(), on: () => game.openDialog(new TasksDialog()) },
      { id: 'patrol', icon: 'tent', label: '巡营', dot: patrolPending().minutes >= 60, on: () => game.openDialog(new PatrolDialog()) },
    ];
    const sideR: typeof side = [
      { id: 'rank', icon: 'trophy', label: '排行', dot: false, on: () => game.openDialog(new RankDialog()) },
      { id: 'settings', icon: 'gear', label: '设置', dot: false, on: () => game.openDialog(new SettingsDialog()) },
      { id: 'share', icon: 'share', label: '分享', dot: false, on: () => getPlatform().share('长坂坡七进七出，你能撑过几分钟？') },
    ];
    if (getPlatform().supportsSidebar() || getPlatform().name === 'tt') sideR.push({ id: 'sidebar', icon: 'sidebar', label: '侧边栏', dot: !save.daily.sidebar, on: () => game.openDialog(new SidebarDialog()) });
    const bs = 96 * u;
    const sy = top + 200 * u;
    const drawSide = (list: typeof side, x: number) => list.forEach((s, i) => {
      const y = sy + i * (bs + 46 * u);
      this.sideBtnRect[s.id] = [x, y, bs, bs];
      const pressed = ui.isPressed('side_' + s.id);
      ui.panel(x, y + (pressed ? 3 * u : 0), bs, bs, 'dark');
      ui.icon(s.icon, x + bs / 2, y + bs / 2 + (pressed ? 3 * u : 0), bs * 0.58);
      ui.text(s.label, x + bs / 2, y + bs + 18 * u, 22, '#fff');
      if (s.dot) ui.redDot(x + bs - 6 * u, y + 6 * u);
      if (ui.clicked('side_' + s.id, x, y, bs, bs)) s.on();
    });
    drawSide(side, 18 * u);
    drawSide(sideR, ui.W - bs - 18 * u);

    // 章节卡
    const ch = CHAPTERS[save.selectedChapter - 1];
    const unlocked = chapterUnlocked(ch.id);
    const cw = ui.W - 80 * u, chH = 250 * u;
    const cx = 40 * u, cy = this.contentBottom(ui) - chH - 170 * u;
    ui.panel(cx, cy, cw, chH, 'wood');
    ui.text(`第${ch.id}章`, ui.W / 2, cy + 46 * u, 26, C.textDim);
    ui.text(ch.name, ui.W / 2, cy + 96 * u, 50, unlocked ? '#fff4d6' : '#8b8b8b');
    ui.text(ch.subtitle, ui.W / 2, cy + 146 * u, 24, C.gold);
    const best = save.chapterBest[ch.id] || 0;
    const info = save.firstClear[ch.id] ? '已通关 ✓' : best ? `最佳坚守 ${fmtTime(best)}` : '尚未挑战';
    ui.text(info, ui.W / 2, cy + 190 * u, 22, save.firstClear[ch.id] ? '#9be37a' : '#d9c6a0');
    const power = combatPower();
    ui.text(`推荐战力 ${fmtNum(ch.power)}`, ui.W / 2, cy + 224 * u, 20, power >= ch.power ? '#9be37a' : '#ff8a80');
    if (!unlocked) {
      ui.ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ui.ctx.fillRect(cx + 12 * u, cy + 12 * u, cw - 24 * u, chH - 24 * u);
      ui.icon('lock', ui.W / 2, cy + chH / 2, 80 * u);
      ui.text(`通关第${ch.id - 1}章解锁`, ui.W / 2, cy + chH / 2 + 70 * u, 26, '#fff');
    }
    if (ui.clicked('chapter_story', cx + 100 * u, cy, cw - 200 * u, chH)) game.openDialog(new ChapterStoryDialog(ch.id));
    // 左右切换
    const aw = 70 * u;
    if (save.selectedChapter > 1 && ui.button('ch_prev', cx - 10 * u, cy + chH / 2 - aw / 2, aw, aw, '◀', C.btnGray, { size: 26 })) { save.selectedChapter--; markDirty(); }
    if (save.selectedChapter < CHAPTERS.length && ui.button('ch_next', cx + cw - aw + 10 * u, cy + chH / 2 - aw / 2, aw, aw, '▶', C.btnGray, { size: 26 })) { save.selectedChapter++; markDirty(); }

    // 出征按钮
    const bw = 420 * u, bh = 130 * u;
    const by = cy + chH + 24 * u;
    if (ui.button('start_battle', ui.W / 2 - bw / 2, by, bw, bh, '出 征', C.btnRed, { size: 48, disabled: !unlocked, sub: `消耗体力 ${STAMINA.costPerRun}` })) this.startBattle(ch.id);
    this.startRect = [ui.W / 2 - bw / 2, by, bw, bh];
  }
  private startRect: [number, number, number, number] = [0, 0, 0, 0];

  private startBattle(id: number) {
    if (!spendStamina()) {
      game.openDialog(new StaminaDialog());
      return;
    }
    if (save.guide === 6) save.guide = 99;
    flushSave(true);
    playSfx('boss');
    game.setScene(new BattleScene(id));
  }

  // —— 装备页 ——
  private drawEquipTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    const panelH = 590 * u;
    ui.panel(16 * u, top, ui.W - 32 * u, panelH, 'wood');
    // 人物
    ui.ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ui.ctx.fillRect(ui.W / 2 - 150 * u, top + 60 * u, 300 * u, 330 * u);
    ui.icon('hero_' + (Math.floor(ui.time * 6) % 4), ui.W / 2, top + 230 * u, 280 * u);
    ui.text('赵云 · Lv.' + save.heroLv, ui.W / 2, top + 50 * u, 28, C.gold);
    const st = computeStats();
    ui.text(`攻击 ${fmtNum(st.atk)}`, ui.W / 2 - 80 * u, top + 425 * u, 26, '#ffb070');
    ui.text(`生命 ${fmtNum(st.hp)}`, ui.W / 2 + 80 * u, top + 425 * u, 26, '#9be37a');
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
        if (save.guide === 2) save.guide = 3;
        game.openDialog(new ItemDialog(it));
      }
    });
    // 一键操作
    const bw = 170 * u, bh = 76 * u;
    const by = top + panelH - bh - 36 * u;
    if (ui.button('equip_best', ui.W / 2 - bw - 10 * u, by, bw, bh, '一键穿戴', C.btnBlue, { size: 26 })) { equipBest(); playSfx('levelup'); }
    if (ui.button('merge_all', ui.W / 2 + 10 * u, by, bw, bh, '一键合成', C.btnPurple, { size: 26 })) {
      const n = mergeAll();
      ui.toast(n ? `合成成功 ${n} 次` : '没有可合成的装备（需3件同名同品质）');
      if (n) playSfx('evolve');
    }
    // 背包
    const gy = top + panelH + 16 * u;
    const gh = this.contentBottom(ui) - gy - 10 * u;
    ui.panel(16 * u, gy, ui.W - 32 * u, gh, 'dark');
    const items = save.items.slice().sort((a, b) => b.q - a.q || (EQUIP_BY_ID[a.tid].slot < EQUIP_BY_ID[b.tid].slot ? -1 : 1) || b.lv - a.lv);
    const cols = 5, cell = (ui.W - 32 * u - 40 * u) / cols;
    const rows = Math.ceil(items.length / cols);
    const contentH = rows * cell + 30 * u;
    const off = ui.beginScroll('bag', 16 * u, gy + 12 * u, ui.W - 32 * u, gh - 24 * u, contentH);
    if (!items.length) ui.text('暂无装备，通关章节或开启宝箱获得', ui.W / 2, gy + gh / 2, 24, C.textDim);
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
    ui.text('永久提升赵云的基础能力', ui.W / 2, top + 90 * u, 24, C.textDim);
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
      const eff = t.stat === 'revive' ? '每局可免费复活1次' : t.stat === 'reroll' ? '每局技能刷新+1次' : `${STAT_NAMES[t.stat]}+${fmtStat(t.stat, t.per)}`;
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
  private drawHeroTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    const ph = this.contentBottom(ui) - top - 10 * u;
    ui.panel(16 * u, top, ui.W - 32 * u, ph, 'wood');
    ui.ribbon(ui.W / 2, top + 10 * u, 360 * u, HERO.title);
    ui.ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ui.ctx.fillRect(60 * u, top + 70 * u, ui.W - 120 * u, 360 * u);
    ui.icon('hero_' + (Math.floor(ui.time * 6) % 4), ui.W / 2, top + 250 * u, 330 * u);
    ui.text(`「${HERO.quote}」`, ui.W / 2, top + 460 * u, 26, '#fff4d6');
    let y = top + 520 * u;
    const st = computeStats();
    ui.text(`等级 ${save.heroLv}/${HERO.maxLevel}`, 60 * u, y, 28, C.gold, 'left');
    ui.text(`攻击 ${HERO.baseAtk + HERO.atkPerLv * (save.heroLv - 1)}  (+${HERO.atkPerLv}/级)`, 60 * u, y + 50 * u, 24, '#fff', 'left');
    ui.text(`生命 ${HERO.baseHp + HERO.hpPerLv * (save.heroLv - 1)}  (+${HERO.hpPerLv}/级)`, 60 * u, y + 90 * u, 24, '#fff', 'left');
    ui.text(`总战力 ${fmtNum(combatPower(st))}`, ui.W - 60 * u, y, 26, '#fee761', 'right');
    y += 140 * u;
    ui.text('武将天赋', 60 * u, y, 26, C.gold, 'left');
    ui.wrapText(HERO.passive, 60 * u, y + 20 * u, ui.W - 120 * u, 22, '#d9c6a0');
    ui.text('初始武器：龙胆枪', 60 * u, y + 100 * u, 22, '#d9c6a0', 'left');
    y += 150 * u;
    // 升级
    const cost = heroLevelCost(save.heroLv);
    const bw = 400 * u;
    if (save.heroLv < HERO.maxLevel) {
      if (ui.button('hero_up', ui.W / 2 - bw / 2, y, bw, 110 * u, `升级  ${fmtNum(cost)}`, save.gold >= cost ? C.btnGold : C.btnGray, { icon: 'gold', size: 32 })) {
        const err = upgradeHero();
        if (err) ui.toast(err); else playSfx('levelup');
      }
    } else ui.text('已达等级上限', ui.W / 2, y + 50 * u, 30, '#9be37a');
    y += 150 * u;
    // 后续武将
    if (y + 160 * u < top + ph) {
      ui.text('更多名将 · 敬请期待', ui.W / 2, y, 24, C.textDim);
      const names = ['关羽', '张飞', '马超', '黄忠'];
      names.forEach((n, i) => {
        const x = ui.W / 2 - 2 * 140 * u + i * 140 * u + 10 * u;
        ui.qualityFrame(x, y + 24 * u, 120 * u, '#3a3040');
        ui.icon('lock', x + 60 * u, y + 76 * u, 50 * u, 0.6);
        ui.text(n, x + 60 * u, y + 128 * u, 20, '#888');
      });
    }
  }

  // —— 商店页 ——
  private drawShopTab(ui: UI) {
    const u = ui.u;
    const top = this.contentTop(ui);
    const gh = this.contentBottom(ui) - top - 10 * u;
    const off = ui.beginScroll('shop', 0, top, ui.W, gh, 1500 * u);
    let y = top + off + 10 * u;
    // 宝箱
    ui.ribbon(ui.W / 2, y + 30 * u, 360 * u, '宝箱');
    y += 80 * u;
    for (const c of CHESTS) {
      const h = 300 * u;
      ui.panel(24 * u, y, ui.W - 48 * u, h, 'wood');
      ui.icon(c.icon, 140 * u, y + 130 * u, 170 * u);
      ui.text(c.name, 140 * u, y + 240 * u, 28, c.id === 'gold' ? '#fee761' : '#fff4d6');
      const qs = c.weights.map((w, q) => (w > 0 ? q : -1)).filter((q) => q >= 0);
      ui.text('可能获得：' + qs.map((q) => QUALITY_NAMES[q]).join('/'), 270 * u, y + 56 * u, 20, '#d9c6a0', 'left');
      if (c.pity) ui.text(`再开${c.pity - save.goldChestCount}次必得史诗`, 270 * u, y + 92 * u, 20, '#dc9be9', 'left');
      const used = save.daily.chestAd[c.id] || 0;
      const bw = 200 * u;
      if (adButton(ui, 'chest_ad_' + c.id, 270 * u, y + 140 * u, bw, 110 * u, '免费', { disabled: used >= c.adDaily, sub: `${c.adDaily - used}/${c.adDaily}`, size: 28 })) {
        getPlatform().showRewardedAd('chest_' + c.id).then((ok) => {
          if (!ok) return;
          save.daily.chestAd[c.id] = used + 1;
          progressTask('ad', 1);
          this.openChestNow(c.id);
        });
      }
      if (ui.button('chest_buy_' + c.id, 490 * u, y + 140 * u, bw, 110 * u, String(c.cost), save.yuanbao >= c.cost ? C.btnGold : C.btnGray, { icon: 'yuanbao', size: 28 })) {
        if (save.yuanbao < c.cost) ui.toast('元宝不足');
        else { save.yuanbao -= c.cost; this.openChestNow(c.id); }
      }
      y += h + 20 * u;
    }
    // 每日补给
    ui.ribbon(ui.W / 2, y + 30 * u, 360 * u, '每日补给');
    y += 80 * u;
    const cards: { id: string; icon: string; name: string; desc: string; left: number; limit: number; free?: boolean; on: () => void }[] = [
      { id: 'gift', icon: 'gold', name: '每日礼包', desc: `金币×${SHOP_DAILY.freeGift.gold}`, left: save.daily.freeGift ? 0 : 1, limit: 1, free: true, on: () => { save.daily.freeGift = true; save.gold += SHOP_DAILY.freeGift.gold; ui.toast(`获得金币×${SHOP_DAILY.freeGift.gold}`); playSfx('coin'); } },
      { id: 'yb', icon: 'yuanbao', name: '元宝', desc: `元宝×${SHOP_DAILY.adYuanbao.amount}`, left: SHOP_DAILY.adYuanbao.limit - save.daily.adYuanbao, limit: SHOP_DAILY.adYuanbao.limit, on: () => { save.daily.adYuanbao++; save.yuanbao += SHOP_DAILY.adYuanbao.amount; ui.toast(`获得元宝×${SHOP_DAILY.adYuanbao.amount}`); playSfx('coin'); } },
      { id: 'gold', icon: 'chest', name: '军饷', desc: '2小时巡营金币', left: SHOP_DAILY.adGold.limit - save.daily.adGold, limit: SHOP_DAILY.adGold.limit, on: () => { save.daily.adGold++; const g = Math.floor(SHOP_DAILY.adGold.minutes * (3 + save.maxCleared * 3)); save.gold += g; ui.toast(`获得金币×${g}`); playSfx('coin'); } },
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

  private openChestNow(id: string) {
    const it = openChest(chestById(id));
    markDirty();
    flushSave(true);
    game.openDialog(new ChestResultDialog(it, id === 'gold'));
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
        if (this.tab === 'equip') guidePointer(ui, ...this.weaponSlotRect, '新兵器已自动穿戴，点击可以强化');
        else if (nav.equip) guidePointer(ui, ...nav.equip);
        break;
      case 3:
        if (nav.talent) guidePointer(ui, ...nav.talent, '军略可以永久提升属性');
        break;
      case 4:
        if (this.tab === 'talent') guidePointer(ui, ...this.talentBtn, '升级「武艺」，提升全部伤害');
        else if (nav.talent) guidePointer(ui, ...nav.talent);
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
