import { TIERS, luckVerdict } from '../battle/tianji';
import { game, Dialog } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { dialogFrame, adButton, rewardRow, rewardEntries } from '../ui/widgets';
import { EvoTableDialog } from './evoTableDialog';
import { hasResultPublish, drawResultPublish } from './xhsRewards';
import { DamageReportDialog } from './damageReportDialog';
import type { BattleScene } from './battleScene';
import { choiceInfo } from './battleScene';
import { Battle } from '../battle/battle';
import type { Choice } from '../battle/battle';
import { WEAPONS, PASSIVES, MAX_WEAPON_LV, passiveMax, weaponLink } from '../data/skills';
import type { BossDef } from '../data/enemies';
import { FINAL_BOSS_LIMIT_SEC } from '../data/chapters';
import { save, markDirty, flushSave } from '../meta/save';
import { settleRun, settleEndless, settleDefense, settleWeeklyRun, settleTutorial, settleTianji, RunResult, runStars, STAR_LABELS, starCount, diffOpen } from '../meta/run';
import { settleWeekly } from '../meta/goals';
import { progressTask } from '../meta/ops';
import { playSfx, playBgm, refreshMusic } from '../audio/sound';
import { fmtTime, easeOutBack, fmtNum } from '../core/math';
import { HomeScene, openRecommend } from './homeScene';
import { HERO_BY_ID } from '../data/heroes';
import { guidePointer, guideHint } from '../ui/guide';
import { IS_XHS, NO_ADS, NO_ADS_PRICE, IS_H5, WEB_RULES, SHARE_CONFIG, NEW_UI } from '../data/platformConfig';
import { STRAT_BY_ID, TIER_NAMES, TIER_COLORS, StratId, StratTier, fmtStratTimes } from '../data/strategies';
import { QIYU_BY_ID, QiyuId } from '../data/qiyu';
import { ORDERS, ORDER_IDS, LINKS, BUILD_KINDS, BUILDS } from '../data/defense';
import { buildLevel } from '../battle/defense';

/** 每局可看广告刷新技能的次数 */
const LEVELUP_AD_LIMIT = WEB_RULES ? Infinity : 5;
/** 每局最多看广告复活几次 */

interface CardExtra {
  /** 推荐选择 */
  rec?: boolean;
  /** 选后即可在宝箱中进化 */
  evoReady?: boolean;
  /** 武将专属联动 */
  link?: boolean;
  /** 进化配方提示 */
  recipe?: string;
  recipeOk?: boolean;
  /** 封禁模式：可封禁 / 不可封禁 */
  banish?: 'yes' | 'no';
}

/** 进化配方与标签：让玩家在选技能时就能看到搭配 */
export function cardExtra(b: Battle, c: Choice): CardExtra {
  const ex: CardExtra = { evoReady: b.completesEvo(c) };
  if (c.kind === 'weapon') {
    const d = WEAPONS[c.id];
    const link = weaponLink(c.id, b.hero.id);
    ex.link = !!link;
    // 守城没有兵法：满级直接进化
    const has = !!b.def || b.passiveLv(d.evoPassive) > 0;
    ex.recipe = b.def ? `进化：满级 → ${link ? '★' + link.name : d.evoName}` : `进化：满级 + ${PASSIVES[d.evoPassive].name} → ${link ? '★' + link.name : d.evoName}`;
    if (WEB_RULES && !has && !b.skillPool.passives.includes(d.evoPassive)) ex.recipe = `本章缺少进化兵法：${PASSIVES[d.evoPassive].name}`;
    ex.recipeOk = has;
  } else if (c.kind === 'order' && b.def) {
    const d = b.def;
    const l = Object.values(LINKS).find((x) => x.unit === c.id || x.city === c.id);
    if (l) {
      const ready = (d.orders[l.unit] || 0) >= ORDERS[l.unit].max || (c.id === l.unit && c.lv >= ORDERS[l.unit].max);
      const city = (d.orders[l.city] || 0) > 0 || c.id === l.city;
      ex.recipe = `联动：${ORDERS[l.unit].name}满级 + ${ORDERS[l.city].name} → ${l.name}`;
      ex.recipeOk = ready && city;
    }
  } else if (c.kind === 'passive') {
    const helps = b.evoTargets(c.id);
    if (helps.length) {
      ex.recipe = '可助进化：' + helps.map((id) => weaponLink(id, b.hero.id)?.name || WEAPONS[id].evoName).join('、');
      ex.recipeOk = true;
    } else {
      const ws = b.skillPool.weapons.filter(id => WEAPONS[id].evoPassive === c.id).map(id => WEAPONS[id].name);
      if (ws.length) ex.recipe = '进化搭配：' + ws.join('、');
    }
  }
  return ex;
}

function tag(ui: UI, x: number, y: number, text: string, color: string): number {
  const u = ui.u;
  const w = ui.measure(text, 20) + 20 * u;
  ui.pixRect(x, y, w, 32 * u, color);
  ui.text(text, x + w / 2, y + 16 * u, 20, '#fff', 'center', null);
  return w + 8 * u;
}

/** 宣纸卡片的内框线：把霓虹色换成同色系的矿物颜料色（石青 / 赭金 / 朱砂 / 石绿 / 紫檀）。 */
const PAPER_BORDER: Record<string, string> = {
  '#2ce8f5': '#3d7f9a', '#fee761': '#b0802a', '#feae34': '#a3281e', '#4fb06a': '#4a8a52',
  '#c89b5c': '#8c765a', '#dc9be9': '#7a3f86', '#dc5bd0': '#7a3f86', '#e43b44': '#a3281e', '#63c74d': '#4a8a52', '#0099db': '#2f6b8a',
};
function battleCardFrame(ui: UI, x: number, y: number, w: number, h: number, border: string, fill: string) {
  const edge = 4 * ui.u;
  if (ui.paperTheme) {
    ui.panel(x, y, w, h, 'paper');
    ui.ctx.strokeStyle = PAPER_BORDER[border.toLowerCase()] || border;
    ui.ctx.lineWidth = Math.max(1, ui.u * 1.8);
    ui.ctx.strokeRect(x + 2 * edge, y + 2 * edge, w - 4 * edge, h - 4 * edge);
    return;
  }
  ui.pixRect(x, y, w, h, '#120d0c');
  ui.pixRect(x + edge, y + edge, w - 2 * edge, h - 2 * edge, border);
  ui.pixRect(x + 2 * edge, y + 2 * edge, w - 4 * edge, h - 4 * edge, fill);
}

/** 技能卡片 */
function choiceCard(ui: UI, id: string, c: Choice, x: number, y: number, w: number, h: number, highlight = false, ex: CardExtra = {}): boolean {
  const u = ui.u;
  const info = choiceInfo(c);
  const pressed = ui.isPressed(id);
  const off = pressed ? 4 * u : 0;
  const border = info.evo || ex.evoReady ? '#feae34' : ex.link ? '#fee761' : info.isNew ? '#2ce8f5' : '#c89b5c';
    if (!NEW_UI) ui.pixRect(x, y + off, w, h, '#120d0c');
  if (!NEW_UI) ui.pixRect(x + 4 * u, y + 4 * u + off, w - 8 * u, h - 8 * u, border);
  if (!NEW_UI) {
      if (!NEW_UI) ui.pixRect(x, y + off, w, h, '#120d0c');
    if (!NEW_UI) ui.pixRect(x + 4 * u, y + 4 * u + off, w - 8 * u, h - 8 * u, border);
    ui.pixRect(x + 8 * u, y + 8 * u + off, w - 16 * u, h - 16 * u, info.evo ? '#5a3a14' : ex.link ? '#4a3418' : '#3a2c2a');
    if (!NEW_UI && (highlight || ex.rec)) {
      ui.ctx.globalAlpha = (highlight ? 0.15 : 0.08) + 0.08 * Math.sin(ui.time * 6);
      ui.pixRect(x + 8 * u, y + 8 * u + off, w - 16 * u, h - 16 * u, '#fee761');
      ui.ctx.globalAlpha = 1;
    }
  } else {
    ui.panel(x, y + off, w, h, 'wood');
    const g = ui.ctx;
    const accent = info.evo || ex.evoReady ? '#b8281e' : ex.link ? '#b85c14' : ex.rec ? '#256b38' : info.isNew ? '#1f5a82' : '#8c765a';
    g.save();
    g.strokeStyle = accent;
    g.lineWidth = Math.max(1.5, u * (info.evo || ex.evoReady || ex.rec ? 2.2 : 1.4));
    g.strokeRect(x + 8 * u, y + 8 * u + off, w - 16 * u, h - 16 * u);
    if (highlight || ex.rec || info.evo) {
      g.fillStyle = info.evo ? 'rgba(184,40,30,0.08)' : 'rgba(37,107,56,0.07)';
      g.fillRect(x + 9 * u, y + 9 * u + off, w - 18 * u, h - 18 * u);
    }
    g.restore();
  }
  if (!NEW_UI && (highlight || ex.rec)) {
    ui.ctx.globalAlpha = (highlight ? 0.15 : 0.08) + 0.08 * Math.sin(ui.time * 6);
    ui.pixRect(x + 8 * u, y + 8 * u + off, w - 16 * u, h - 16 * u, '#fee761');
    ui.ctx.globalAlpha = 1;
  }
  const isz = h - 70 * u;
  ui.qualityFrame(x + 20 * u, y + 20 * u + off, isz, border);
  ui.icon(info.icon, x + 20 * u + isz / 2, y + 20 * u + isz / 2 + off, isz * 0.66);
  const tx = x + 40 * u + isz;
  ui.text(info.name, tx, y + 42 * u + off, 32, info.evo ? '#fee761' : '#fff4d6', 'left');
  let tagX = tx + ui.measure(info.name, 32) + 14 * u;
  const ty = y + 26 * u + off;
  if (ex.rec) tagX += tag(ui, tagX, ty, '推荐', '#c96d17');
  if (info.isNew) tagX += tag(ui, tagX, ty, '新', '#0099db');
  if (info.evo) tagX += tag(ui, tagX, ty, '进化', '#e43b44');
  if (ex.evoReady) tagX += tag(ui, tagX, ty, '可进化', '#e43b44');
  if (ex.link) tagX += tag(ui, tagX, ty, '★专属', '#a2611a');
  // 等级星
  if (info.max) {
    for (let i = 0; i < info.max; i++) {
      const sx = x + w - 30 * u - (info.max - i) * 26 * u, sy = y + 30 * u + off;
      if (sx < tagX) continue;
      if (!NEW_UI) {
        ui.pixRect(sx, sy, 20 * u, 20 * u, i < info.lv ? (i === info.lv - 1 ? '#fee761' : '#feae34') : '#231917', 4 * u);
      } else {
        const active = i < info.lv;
        const newest = i === info.lv - 1;
        ui.pixRect(sx, sy, 18 * u, 18 * u, active ? (newest ? '#b8281e' : '#c97a1c') : '#dfd2ba', Math.max(1.5, Math.round(u * 2)));
        ui.ctx.strokeStyle = active ? '#2b1e16' : '#8c7a64';
        ui.ctx.lineWidth = Math.max(1, u);
        ui.ctx.strokeRect(sx + 0.5, sy + 0.5, 18 * u - 1, 18 * u - 1);
      }
    }
  }
  ui.wrapText(info.desc, tx, y + 64 * u + off, w - (tx - x) - 24 * u, 24, '#d9c6a0');
  if (ex.recipe) {
    if (!NEW_UI) {
      ui.pixRect(x + 20 * u, y + h - 50 * u + off, w - 40 * u, 34 * u, 'rgba(0,0,0,0.3)');
    } else {
      ui.pixRect(x + 20 * u, y + h - 50 * u + off, w - 40 * u, 34 * u, 'rgba(92,72,48,0.12)', Math.max(1.5, Math.round(u * 2)));
      ui.pixRect(x + 20 * u, y + h - 50 * u + off, 4 * u, 34 * u, ex.recipeOk ? '#256b38' : '#b5281f');
    }
    ui.text(ex.recipe, x + 34 * u, y + h - 33 * u + off, 20, ex.recipeOk ? '#9be37a' : ex.link ? '#fee761' : '#a89a86', 'left', NEW_UI ? null : undefined);
  }
  if (ex.banish) {
    ui.ctx.globalAlpha = ex.banish === 'yes' ? 0.35 + 0.1 * Math.sin(ui.time * 8) : 0.55;
    ui.pixRect(x, y + off, w, h, ex.banish === 'yes' ? '#a22633' : '#120d0c');
    ui.ctx.globalAlpha = 1;
    if (ex.banish === 'yes') ui.text('点击封禁', x + w - 100 * u, y + h / 2 + off, 30, '#fff');
  }
  return ui.clicked(id, x, y, w, h);
}

/** 竖卡共用同一行高，较长的说明、进化配方也能完整换行。 */
function drawSkillColumn(ui: UI, id: string, info: ReturnType<typeof choiceInfo>, ex: CardExtra,
  x: number, y: number, w: number, h: number) {
  const u = ui.u, cx = x + w / 2, pad = 16 * u;
  const top = y + (ui.isPressed(id) ? 3 * u : 0);
  const evolution = info.evo || ex.evoReady;
  const border = evolution ? C.gold : ex.link ? '#fee761' : info.isNew ? '#2ce8f5' : C.border;
  const g = ui.ctx;
  battleCardFrame(ui, x, top, w, h, border, evolution ? '#5a3a14' : ex.link ? '#4a3418' : C.panel);
  const badge = ex.banish ? (ex.banish === 'yes' ? '点击封禁' : '不可封禁')
    : evolution ? (info.evo ? '进化' : '可进化') : ex.rec ? '推荐' : '';
  if (badge) {
    const bw = ui.measure(badge, 20) + 20 * u;
    g.fillStyle = ex.banish ? '#a22633' : evolution ? C.red : '#c96d17';
    g.fillRect(x + 3 * u, top + 3 * u, bw, 32 * u);
    ui.text(badge, x + 3 * u + bw / 2, top + 19 * u, 20, '#fbf4e4', 'center', null);
  }
  ui.qualityFrame(cx - 48 * u, top + 35 * u, 96 * u, border);
  ui.icon(info.icon, cx, top + 81 * u, 78 * u);
  ui.text(info.name, cx, top + 153 * u, 30, C.text);
  const state = [ex.link ? '专属' : '', info.evo ? '进化' : info.isNew ? '新' : '', info.max ? `${info.lv}/${info.max}级` : '', ex.evoReady ? '可进化' : ''].filter(Boolean).join(' · ');
  ui.text(state, cx, top + 193 * u, 20, evolution ? C.gold : C.textDim);
  g.fillStyle = C.borderDark;
  g.fillRect(x + pad, top + 217 * u, w - 2 * pad, Math.max(1, u));
  ui.wrapText(info.desc, x + pad, top + 231 * u, w - 2 * pad, 24, '#d9c6a0', 1.3);
  if (ex.recipe) {
    const lineH = 21 * u * 1.25;
    const lines = ui.wrapLines(ex.recipe, w - 2 * pad, 21);
    // 与微信版配方状态对应：已搭配为绿、专属为金、其余为灰。
    const recipeInk = ex.recipeOk ? '#9be37a' : ex.link ? '#fee761' : '#c2ad92';
    lines.forEach((line, i) => ui.text(line, x + pad, top + h - pad - (lines.length - i - 0.5) * lineH,
      21, recipeInk, 'left', null, !!(ex.recipeOk || ex.link)));
  }
  return ui.clicked(id, x, y, w, h);
}

function ownedSkillGroups(b: Battle) {
  const groups = [{ name: '武器', items: b.weapons.map(w => {
    const def = WEAPONS[w.id];
    return w.evo ? (weaponLink(w.id, b.hero.id)?.name || def.evoName) + ' ★' : def.name + ' Lv.' + w.lv;
  }) }];
  const d = b.def;
  if (d) {
    groups.push({ name: '军令', items: ORDER_IDS.filter(id => d.orders[id]).map(id => ORDERS[id].name + ' Lv.' + d.orders[id]) });
    const buildings = BUILD_KINDS.filter(k => buildLevel(d, k)).map(k => BUILDS[k].name + ' Lv.' + buildLevel(d, k));
    if (buildings.length) groups.push({ name: '城防', items: buildings });
    if (d.links.size) groups.push({ name: '联动', items: Array.from(d.links, id => LINKS[id].name) });
  } else groups.push({ name: '兵法', items: b.passives.map(p => PASSIVES[p.id].name + ' Lv.' + p.lv) });
  return groups;
}

function drawOwnedSkills(ui: UI, b: Battle, x: number, y: number, w: number) {
  const groups = ownedSkillGroups(b);
  const u = ui.u, rowH = 42 * u;
  const rows = groups.reduce((n, group) => n + Math.max(1, Math.ceil(group.items.length / 3)), 0);
  const bodyH = Math.min(5, rows) * rowH;
  const h = 66 * u + bodyH;
  ui.panel(x, y, w, h, 'wood');
  ui.text('本局已获得', x + 20 * u, y + 29 * u, 26, C.gold, 'left', null);
  if (b.coreWeapon) ui.text('★ ' + b.coreProgressText(), x + w - 20 * u, y + 29 * u, 20, '#86431b', 'right', null);
  const listY = y + 52 * u;
  const offset = ui.beginScroll('lv_owned', x, listY, w, bodyH, rows * rowH);
  let lineY = listY + offset + rowH / 2;
  for (const group of groups) {
    ui.text(group.name, x + 20 * u, lineY, 22, C.textDim, 'left', null);
    const items = group.items.length ? group.items : ['暂无'];
    items.forEach((item, i) => ui.text(item, x + 94 * u + (i % 3) * (w - 106 * u) / 3,
      lineY + Math.floor(i / 3) * rowH, 22, C.text, 'left', null));
    lineY += Math.ceil(items.length / 3) * rowH;
  }
  ui.endScroll();
  return h;
}

export class LevelUpDialog implements Dialog {
  private banishTip = false;
  private offerPreparedRefresh: boolean;
  private adBusy = false;
  closed = false;
  constructor(private scene: BattleScene, private choices: Choice[]) {
    this.offerPreparedRefresh = scene.hasPreparation && scene.autoPick && !scene.skipPreparedPrompts
      && scene.battle.adRerolls < LEVELUP_AD_LIMIT && !scene.preparedMatch(choices)
      && !!scene.preparedMatch(scene.battle.availableLevelChoices());
    // 第三次升级时提示刷新和封禁（新手局第一次升级有手指引导，先不打扰）
    if (!save.tips.banish && scene.battle.level >= 4) { this.banishTip = true; save.tips.banish = true; markDirty(); }
  }
  private banishMode = false;

  private reroll() {
    this.choices = this.scene.battle.rollChoices();
    this.banishMode = false;
    this.offerPreparedRefresh = false;
    this.t = 0.2;
    if (this.scene.hasPreparation && this.scene.autoPick) {
      this.closed = this.scene.autoChooseUpgrade(this.choices);
      if (!this.closed) game.ui.toast('未刷到备战技能，可继续刷新或手选');
    }
  }

  private async watchRefreshAd() {
    const b = this.scene.battle;
    if (this.adBusy || this.closed || b.adRerolls >= LEVELUP_AD_LIMIT) return;
    this.adBusy = true;
    try {
      const ok = await getPlatform().showRewardedAd('levelup_reroll');
      if (game.scene !== this.scene || !game.dialogs.includes(this) || this.closed) return;
      if (!ok) {
        game.ui.toast('未完成观看，保留原选项');
        return;
      }
      b.adRerolls++;
      progressTask('ad', 1);
      this.reroll();
    } catch {
      game.ui.toast('广告暂时无法播放，保留原选项');
    } finally {
      this.adBusy = false;
    }
  }

  private drawPreparedActions(ui: UI, y: number) {
    const u = ui.u, b = this.scene.battle, h = 90 * u, w = 300 * u;
    const left = ui.W / 2 - w - 10 * u, right = ui.W / 2 + 10 * u;
    const hasFree = b.rerolls > 0;
    if (hasFree && ui.button('prep_free', left, y, w, h, `免费刷新(${b.rerolls})`, C.btnBlue, { size: 26 })) {
      b.rerolls--;
      this.reroll();
      return;
    }
    if (adButton(ui, 'prep_ad', hasFree ? right : (ui.W - w) / 2, y, w, h, '刷新', { size: 26, sub: '不限次数' })) {
      void this.watchRefreshAd();
      return;
    }
    const by = y + h + 16 * u;
    if (ui.button('prep_manual', left, by, w, h, '不刷新，手动选', C.btnGray, { size: 26 })) this.offerPreparedRefresh = false;
    if (ui.button('prep_silence', right, by, w, h, '本局不再提示', C.btnGray, { size: 26 })) {
      this.scene.skipPreparedPrompts = true;
      this.offerPreparedRefresh = false;
      ui.toast('本局未命中时直接手选');
    }
  }

  draw(ui: UI) {
    if (this.closed) return false;
    const u = ui.u;
    const b = this.scene.battle;
    const t = this.t || 0;
    if (this.adBusy) {
      const f = dialogFrame(ui, ui.W - 80 * u, 245 * u, '刷新技能', 1);
      ui.text('正在等待广告结果…', ui.W / 2, f.y + 138 * u, 28);
      return;
    }
    const gap = 12 * u, panelW = ui.W - 46 * u;
    const cw = WEB_RULES ? (panelW - 2 * gap) / 3 : ui.W - 70 * u;
    const cards = this.choices.map(c => ({ info: choiceInfo(c), ex: cardExtra(b, c) }));
    let ch = 220 * u;
    if (WEB_RULES) {
      ch = Math.max(...cards.map(({ info, ex }) => 269 * u
        + ui.wrapLines(info.desc, cw - 32 * u, 24).length * 31.2 * u
        + (ex.recipe ? ui.wrapLines(ex.recipe, cw - 32 * u, 21).length * 26.25 * u : 0)));
    }
    const titleY = WEB_RULES ? Math.max(ui.safeTop + 45 * u, Math.min(ui.H * 0.18, (ui.H - ch - 590 * u) / 2)) : ui.H * 0.2;
    ui.ribbon(ui.W / 2, titleY, 420 * u, `升级！Lv.${Math.max(2, b.level - b.pendingLevelUps)}`, '#3e8948');
    const instruction = this.offerPreparedRefresh ? '本次没有备战技能，要刷新选项吗？'
      : this.banishMode && WEB_RULES ? '选择要封禁的新技能' : '选择一项强化';
    ui.text(instruction, ui.W / 2, titleY + 64 * u, 26, C.textDim);
    const cardTop = titleY + 110 * u;
    const firstX = WEB_RULES ? (ui.W - cards.length * cw - (cards.length - 1) * gap) / 2 : (ui.W - cw) / 2;
    let y = cardTop;
    const tutorial = save.guide === 0 && b.level === 2;
    const rec = tutorial ? -1 : b.recommend(this.choices);
    if (this.banishMode && !WEB_RULES) ui.text('选择要封禁的新技能（本局不再出现）', ui.W / 2, y - 14 * u, 24, '#ff8a80');
    for (let i = 0; i < this.choices.length; i++) {
      const c = this.choices[i];
      const k = Math.max(0, Math.min(1, (t - i * 0.07) * 5));
      const x = WEB_RULES ? firstX + i * (cw + gap) : firstX + (1 - easeOutBack(k)) * ui.W;
      y = WEB_RULES ? cardTop : cardTop + i * (ch + 20 * u);
      const { info, ex } = cards[i];
      ex.rec = i === rec;
      if (this.banishMode) ex.banish = (c.kind === 'weapon' || c.kind === 'passive') && c.isNew ? 'yes' : 'no';
      const id = 'lv_choice_' + i;
      const picked = WEB_RULES ? drawSkillColumn(ui, id, info, ex, x, y, cw, ch)
        : choiceCard(ui, id, c, x, y, cw, ch, tutorial && i === 0, ex);
      if (picked && t > 0.25) {
        if (this.banishMode) {
          if (ex.banish === 'yes' && b.banish(this.choices, i)) {
            this.banishMode = false;
            playSfx('hurt');
            if (this.scene.hasPreparation && this.scene.autoChooseUpgrade(this.choices)) return false;
          }
          else ui.toast('只能封禁新技能');
          continue;
        }
        this.scene.choose(c);
        return false;
      }
    }
    y += ch + 20 * u;
    if (WEB_RULES) y += drawOwnedSkills(ui, b, (ui.W - panelW) / 2, y, panelW) + 10 * u;
    // 刷新 / 封禁
    const bh = 92 * u;
    y += 10 * u;
    if (this.offerPreparedRefresh) {
      this.drawPreparedActions(ui, y);
      return;
    }
    const showBanish = !tutorial && b.banishes > 0;
    const bw = showBanish ? 300 * u : 300 * u;
    const rx = showBanish ? ui.W / 2 - bw - 12 * u : ui.W / 2 - bw / 2;
    if (b.rerolls > 0) {
      if (ui.button('lv_reroll', rx, y, bw, bh, `刷新(${b.rerolls})`, C.btnBlue)) {
        b.rerolls--;
        this.reroll();
        return;
      }
    } else {
      const left = LEVELUP_AD_LIMIT - b.adRerolls;
      if (adButton(ui, 'lv_reroll_ad', rx, y, bw, bh, '刷新', { disabled: left <= 0, sub: WEB_RULES ? '不限次数' : `本局剩余${Math.max(0, left)}次` })) {
        void this.watchRefreshAd();
        return;
      }
    }
    if (showBanish && ui.button('lv_banish', ui.W / 2 + 12 * u, y, bw, bh, this.banishMode ? '取消封禁' : `封禁(${b.banishes})`, this.banishMode ? C.btnGray : C.btnRed)) {
      this.banishMode = !this.banishMode;
    }
    // 自动选择：打开后以后的升级直接领推荐项（暂停里可以关）
    if (!tutorial) {
      const aw = 300 * u;
      const label = this.scene.hasPreparation ? '备战选技：' + (this.scene.autoPick ? '开' : '关') : '自动选择：关';
      if (ui.button('lv_auto', ui.W / 2 - aw / 2, y + bh + 20 * u, aw, 76 * u, label, C.btnGray, { size: 24 })) {
        if (this.scene.hasPreparation) {
          this.scene.autoPick = !this.scene.autoPick;
          if (this.scene.autoChooseUpgrade(this.choices)) return false;
          return;
        }
        this.scene.autoPick = true;
        ui.toast('已开启自动选择（暂停里可以关闭）');
        this.scene.choose(this.choices[Math.max(0, rec)]);
        return false;
      }
    }
    if (tutorial) guidePointer(ui, firstX, cardTop, cw, ch);
    if (this.banishTip) guideHint(ui, '不满意可以「刷新」，不想要的可以「封禁」', y + bh + 150 * u);
  }
  t?: number;
}

/** 开局奇遇：三选一，整局生效 */
export class QiyuDialog implements Dialog {
  t?: number;
  private choices: QiyuId[];
  private freeRerolls = 1;
  private firstTime = false;
  constructor(private scene: BattleScene) {
    this.choices = scene.battle.rollQiyu();
    if (!save.tips.qiyu) { this.firstTime = true; save.tips.qiyu = true; markDirty(); }
  }
  draw(ui: UI) {
    const u = ui.u;
    const t = this.t || 0;
    const top = ui.H * 0.17;
    ui.ribbon(ui.W / 2, top, 440 * u, '开局奇遇', '#1d6b4a');
    ui.text('三选一 · 本局一直生效', ui.W / 2, top + 62 * u, 26, '#9be37a');
    const gap = 12 * u;
    const cw = WEB_RULES ? (ui.W - 46 * u - 2 * gap) / 3 : ui.W - 70 * u;
    const ch = WEB_RULES ? 400 * u : 200 * u;
    let y = top + 104 * u;
    for (let i = 0; i < this.choices.length; i++) {
      const k = Math.max(0, Math.min(1, (t - i * 0.08) * 4));
      const x = WEB_RULES ? 23 * u + i * (cw + gap) : ui.W / 2 - cw / 2 + (1 - easeOutBack(k)) * ui.W;
      if (this.card(ui, 'qiyu_' + i, this.choices[i], x, y, cw, ch) && t > 0.3) {
        this.scene.chooseQiyu(this.choices[i]);
        playSfx('evolve');
        return false;
      }
      if (!WEB_RULES) y += ch + 18 * u;
    }
    if (WEB_RULES) y += ch + 18 * u;
    const bh = 92 * u, bw = 320 * u;
    y += 10 * u;
    if (this.freeRerolls > 0 && ui.button('qiyu_reroll', ui.W / 2 - bw / 2, y, bw, bh, `免费刷新(${this.freeRerolls})`, C.btnBlue)) {
      this.freeRerolls--;
      this.choices = this.scene.battle.rollQiyu();
      this.t = 0.15;
      playSfx('click');
    }
    const unavailable = this.scene.unavailablePreparedNames;
    if (unavailable.length) {
      ui.wrapText('备战预设有变动，本局暂缓：' + unavailable.join('、'), ui.W / 2, y + bh + 26 * u,
        ui.W - 90 * u, 25, '#ffd49b', 1.35, 'center', '#241911');
    } else if (this.firstTime) guideHint(ui, '每局开始选一个奇遇，效果持续整局', y + bh + 60 * u);
  }
  private card(ui: UI, id: string, qid: QiyuId, x: number, y: number, w: number, h: number): boolean {
    const u = ui.u;
    const d = QIYU_BY_ID[qid];
    const off = ui.isPressed(id) ? 4 * u : 0;
    battleCardFrame(ui, x, y + off, w, h, '#4fb06a', '#1c3326');
    if (WEB_RULES) {
      const cy = y + off, cx = x + w / 2;
      ui.qualityFrame(cx - 50 * u, cy + 28 * u, 100 * u, '#4fb06a');
      ui.icon(d.icon, cx, cy + 78 * u, 82 * u);
      ui.text(d.name, cx, cy + 156 * u, 31, C.text);
      ui.wrapText(d.story, cx, cy + 192 * u, w - 32 * u, 20, '#8fbf9a', 1.3, 'center');
      ui.pixRect(x + 16 * u, cy + 262 * u, w - 32 * u, Math.max(1, u), '#497754');
      ui.wrapText(d.desc, x + 16 * u, cy + 280 * u, w - 32 * u, 24, '#fee761', 1.3);
      return ui.clicked(id, x, y, w, h);
    }
    const isz = h - 60 * u;
    ui.qualityFrame(x + 20 * u, y + 30 * u + off, isz, '#4fb06a');
    ui.icon(d.icon, x + 20 * u + isz / 2, y + 30 * u + isz / 2 + off, isz * 0.66);
    const tx = x + 40 * u + isz;
    ui.text(d.name, tx, y + 48 * u + off, 34, '#fff4d6', 'left');
    ui.text(d.story, tx + ui.measure(d.name, 34) + 16 * u, y + 50 * u + off, 20, '#8fbf9a', 'left');
    ui.wrapText(d.desc, tx, y + 92 * u + off, w - (tx - x) - 24 * u, 28, '#fee761');
    return ui.clicked(id, x, y, w, h);
  }
}

const ROUND_NAMES = ['第一计', '第二计', '第三计'];

/** 锦囊妙计：三选一，本局生效 */
export class StrategyDialog implements Dialog {
  t?: number;
  private choices: StratId[];
  private adRerolled = false;
  private firstTime = false;
  constructor(private scene: BattleScene, private tier: StratTier, private round: number) {
    this.choices = scene.battle.rollStrats(tier);
    if (!save.tips.strat) { this.firstTime = true; save.tips.strat = true; markDirty(); }
  }
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const t = this.t || 0;
    const col = TIER_COLORS[this.tier];
    const top = ui.H * 0.17;
    ui.ribbon(ui.W / 2, top, 440 * u, `锦囊妙计 · ${ROUND_NAMES[this.round] || '奇谋'}`, this.tier === 2 ? '#7a2a78' : this.tier === 1 ? '#a2611a' : '#124e89');
    ui.text(`本次为「${TIER_NAMES[this.tier]}」 · 三选一，本局生效`, ui.W / 2, top + 62 * u, 26, col);
    const cw = ui.W - 70 * u, ch = 200 * u;
    let y = top + 104 * u;
    for (let i = 0; i < this.choices.length; i++) {
      const d = STRAT_BY_ID[this.choices[i]];
      const k = Math.max(0, Math.min(1, (t - i * 0.08) * 4));
      const x = ui.W / 2 - cw / 2 + (1 - easeOutBack(k)) * ui.W;
      if (this.stratCard(ui, 'strat_' + i, d.id, x, y, cw, ch) && t > 0.3) {
        b.applyStrat(d.id);
        return false;
      }
      y += ch + 18 * u;
    }
    const bh = 92 * u, bw = 320 * u;
    y += 10 * u;
    if (b.stratFreeRerolls > 0) {
      if (ui.button('strat_reroll', ui.W / 2 - bw / 2, y, bw, bh, '免费刷新', C.btnBlue, { sub: '本局1次' })) {
        b.stratFreeRerolls--;
        this.reroll();
      }
    } else if (!NO_ADS && adButton(ui, 'strat_reroll_ad', ui.W / 2 - bw / 2, y, bw, bh, '刷新', { disabled: this.adRerolled, sub: this.adRerolled ? '本计已刷新' : '每计可再刷新1次' })) {
      getPlatform().showRewardedAd('strat_reroll').then((ok) => {
        if (!ok) return;
        this.adRerolled = true;
        progressTask('ad', 1);
        this.reroll();
      });
    }
    if (!IS_H5 && ui.button('strat_ask', ui.W / 2 + bw / 2 + 20 * u, y + 6 * u, 150 * u, bh - 12 * u, '问好友', C.btnGreen, { size: 24 })) {
      const names = this.choices.map((id) => STRAT_BY_ID[id].name).join(' / ');
      getPlatform().share(`三个锦囊只能选一个：${names}，你选哪个？`, 'from=strat', SHARE_CONFIG.images.strat);
      getPlatform().report('share', { scene: 'strat' });
    }
    if (b.strats.length) {
      const names = b.strats.map((id) => STRAT_BY_ID[id].name).join('、');
      ui.text('已有：' + names, ui.W / 2, y + bh + 40 * u, 22, C.textDim);
    }
    if (this.firstTime) guideHint(ui, `${fmtStratTimes(b.stratTimes)} 各得一条锦囊，本局一直生效`, y + bh + 100 * u);
  }
  private reroll() {
    this.choices = this.scene.battle.rollStrats(this.tier);
    this.t = 0.15;
    playSfx('click');
  }
  private stratCard(ui: UI, id: string, sid: StratId, x: number, y: number, w: number, h: number): boolean {
    const u = ui.u;
    const d = STRAT_BY_ID[sid];
    const pressed = ui.isPressed(id);
    const off = pressed ? 4 * u : 0;
    // 边框按品质固定颜色（神机原来是流光变色，看着像在闪，改成固定的）
    const border = TIER_COLORS[d.tier];
    battleCardFrame(ui, x, y + off, w, h, border, d.tier === 2 ? '#3a2240' : d.tier === 1 ? '#4a3418' : '#1f2c40');
    const isz = h - 60 * u;
    ui.qualityFrame(x + 20 * u, y + 30 * u + off, isz, border);
    ui.icon('jinnang', x + 20 * u + isz / 2, y + 30 * u + isz / 2 + off, isz * 0.66);
    const tx = x + 40 * u + isz;
    ui.text(d.name, tx, y + 48 * u + off, 34, '#fff4d6', 'left');
    tag(ui, tx + ui.measure(d.name, 34) + 14 * u, y + 32 * u + off, TIER_NAMES[d.tier], d.tier === 2 ? '#9b3a96' : d.tier === 1 ? '#c96d17' : '#0b6fa8');
    ui.wrapText(d.desc, tx, y + 80 * u + off, w - (tx - x) - 24 * u, 26, '#d9c6a0');
    return ui.clicked(id, x, y, w, h);
  }
}

export class PauseDialog implements Dialog {
  constructor(private scene: BattleScene) {}
  t?: number;
  private confirmQuit = false;
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const w = ui.W - 60 * u, h = (b.qiyu ? 1176 : 1130) * u;
    const f = dialogFrame(ui, w, h, '暂停', this.t);
    let y = f.y + 70 * u;
    const x = f.x + 40 * u;
    ui.text(`${this.scene.label}   ${fmtTime(b.t)}   击败 ${fmtNum(b.kills)}`, ui.W / 2, y, 24, C.textDim);
    y += 46 * u;
    ui.text('武器', x, y, 26, C.gold, 'left');
    y += 30 * u;
    const isz = 84 * u;
    b.weapons.forEach((wp, i) => {
      const ix = x + i * (isz + 12 * u);
      ui.qualityFrame(ix, y, isz, wp.evo ? '#feae34' : '#5a6988');
      ui.icon(wp.evo ? WEAPONS[wp.id].evoIcon : WEAPONS[wp.id].icon, ix + isz / 2, y + isz / 2, isz * 0.66);
      ui.text(wp.evo ? '★' : `${wp.lv}/${MAX_WEAPON_LV}`, ix + isz / 2, y + isz + 18 * u, 18, wp.evo ? C.gold : '#fff');
    });
    y += isz + 50 * u;
    ui.text('兵法', x, y, 26, C.gold, 'left');
    y += 30 * u;
    b.passives.forEach((ps, i) => {
      const ix = x + i * (isz + 12 * u);
      ui.qualityFrame(ix, y, isz, '#3a4466');
      ui.icon(PASSIVES[ps.id].icon, ix + isz / 2, y + isz / 2, isz * 0.6);
      ui.text(`${ps.lv}/${passiveMax(ps.id)}`, ix + isz / 2, y + isz + 18 * u, 18, '#fff');
    });
    if (!b.passives.length) ui.text('尚未习得兵法', x, y + 30 * u, 22, C.textDim, 'left');
    y += isz + 44 * u;
    // 锦囊
    ui.text('锦囊', x, y, 26, C.gold, 'left');
    if (b.strats.length) {
      let sx = x + 70 * u;
      for (const id of b.strats) {
        const d = STRAT_BY_ID[id];
        ui.text(d.name, sx, y, 22, TIER_COLORS[d.tier], 'left');
        sx += ui.measure(d.name, 22) + 24 * u;
      }
    } else ui.text(`${fmtStratTimes(b.stratTimes)} 各获得一条计策`, x + 70 * u, y, 20, C.textDim, 'left');
    if (b.qiyu) {
      const q = QIYU_BY_ID[b.qiyu];
      y += 46 * u;
      ui.text('奇遇', x, y, 26, C.gold, 'left');
      ui.text(`${q.name}：${q.desc}`, x + 70 * u, y, 22, '#9be37a', 'left');
    }
    y += 56 * u;
    // 进化表
    if (ui.button('p_evo', ui.W / 2 - 180 * u, y - 30 * u, 360 * u, 64 * u, '查看进化表', C.btnGreen, { size: 24 })) game.openDialog(new EvoTableDialog(b));
    y += 60 * u;
    const stats: [string, string][] = [
      ['攻击', String(b.base.atk)], ['生命', `${Math.ceil(b.player.hp)}/${b.player.maxHp}`],
      ['伤害加成', `${Math.round((b.dmgMul - 1) * 100)}%`], ['冷却缩减', `${Math.round((1 - b.cdMul) * 100)}%`],
      ['暴击率', `${Math.round(b.crit * 100)}%`], ['移动速度', `${Math.round(b.speed)}`],
    ];
    stats.forEach((s, i) => {
      const sx = x + (i % 2) * (w / 2 - 20 * u), sy = y + Math.floor(i / 2) * 40 * u;
      ui.text(s[0], sx, sy, 22, C.textDim, 'left');
      ui.text(s[1], sx + 130 * u, sy, 22, '#fff', 'left');
    });
    y += 140 * u;
    // 设置开关：每行三个（开着的显示绿色）
    const tw = (w - 80 * u - 40 * u) / 3;
    const toggles: [string, string, () => void, boolean][] = [
      ['p_music', '音乐:' + (save.settings.music ? '开' : '关'), () => { save.settings.music = !save.settings.music; refreshMusic(); }, save.settings.music],
      ['p_sfx', '音效:' + (save.settings.sfx ? '开' : '关'), () => { save.settings.sfx = !save.settings.sfx; }, save.settings.sfx],
      ['p_vib', '震动:' + (save.settings.vibrate ? '开' : '关'), () => { save.settings.vibrate = !save.settings.vibrate; }, save.settings.vibrate],
      ['p_shake', '震屏:' + (save.settings.screenShake ? '开' : '关'), () => { save.settings.screenShake = !save.settings.screenShake; }, save.settings.screenShake],
      ['p_ult', '大招:' + (save.settings.ultRight ? '右' : '左'), () => { save.settings.ultRight = !save.settings.ultRight; }, false],
      ['p_power', '省电:' + (save.settings.lowPower ? '开' : '关'), () => { save.settings.lowPower = !save.settings.lowPower; }, save.settings.lowPower],
      ['p_auto', (this.scene.hasPreparation ? '备战选技:' : '自动选技能:') + (this.scene.autoPick ? '开' : '关'), () => { this.scene.autoPick = !this.scene.autoPick; }, this.scene.autoPick],
      ['p_num', '伤害数字:' + (save.settings.dmgNum ? '开' : '关'), () => { save.settings.dmgNum = !save.settings.dmgNum; b.showDamage = save.settings.dmgNum; }, save.settings.dmgNum],
    ];
    toggles.forEach(([id, label, fn, on], i) => {
      if (ui.button(id, x + (i % 3) * (tw + 20 * u), y + Math.floor(i / 3) * 90 * u, tw, 76 * u, label, on ? C.btnGreen : C.btnGray, { size: 22 })) { fn(); markDirty(); }
    });
    y += Math.ceil(toggles.length / 3) * 90 * u;
    y += 10 * u;
    const bw = (w - 100 * u) / 2;
    if (!this.confirmQuit) {
      if (ui.button('p_quit', x, y, bw, 92 * u, '撤退', C.btnRed)) this.confirmQuit = true;
      if (ui.button('p_resume', x + bw + 20 * u, y, bw, 92 * u, '继续', C.btnGold)) return false;
    } else {
      ui.text('撤退将按当前进度结算，确定吗？', ui.W / 2, y - 16 * u, 22, '#ffb0b0');
      if (ui.button('p_quit2', x, y + 10 * u, bw, 92 * u, '确定撤退', C.btnRed)) { this.scene.finish(false); return false; }
      if (ui.button('p_cancel', x + bw + 20 * u, y + 10 * u, bw, 92 * u, '取消', C.btnGray)) this.confirmQuit = false;
    }
  }
}

export class ReviveDialog implements Dialog {
  constructor(private scene: BattleScene) {}
  t?: number;
  private busy = false;
  /** 倒计时：看广告期间暂停，没看完回来再给几秒，免得一回来就判定放弃 */
  private remain = 10;
  private gaveUp = false;
  draw(ui: UI, dt = 0) {
    const u = ui.u;
    const b = this.scene.battle;
    const w = ui.W - 100 * u, h = 640 * u;
    const f = dialogFrame(ui, w, h, b.def?.lost ? '城池失守' : b.def ? '武将阵亡' : '力竭', this.t);
    if (!this.busy) this.remain -= dt;
    const left = Math.max(0, this.remain);
    ui.text(b.def?.lost ? '城池被攻破……是否死守？' : `${this.scene.battle.hero.name}力竭倒地……是否再战？`, ui.W / 2, f.y + 110 * u, 30, '#fff4d6');
    if (ui.paperTheme) {
      // 倒计时改成朱砂进度环 + 墨字，原来的金币图标垫在数字下面看不清。
      const g = ui.ctx, cx = ui.W / 2, cy = f.y + 230 * u, r = 58 * u, TAU = Math.PI * 2;
      g.save();
      g.lineWidth = 9 * u;
      g.strokeStyle = 'rgba(110,88,62,0.2)';
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
      g.strokeStyle = left <= 3 ? '#a3281e' : '#b8392f';
      g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, left / 10)); g.stroke();
      g.lineWidth = Math.max(1, u);
      g.strokeStyle = 'rgba(60,46,32,0.5)';
      g.beginPath(); g.arc(cx, cy, r - 9 * u, 0, TAU); g.stroke();
      g.restore();
      const pop = 1 + 0.12 * Math.max(0, (left % 1) - 0.8) / 0.2;
      ui.text(String(Math.ceil(left)), cx, cy + 2 * u, 52 * pop, left <= 3 ? '#a3281e' : '#2b2119', 'center', null);
    } else {
      ui.icon('revive', ui.W / 2, f.y + 230 * u, 140 * u);
      ui.text(String(Math.ceil(left)), ui.W / 2, f.y + 230 * u, 48, '#fff');
    }
    let y = f.y + 340 * u;
    const bw = w - 120 * u;
    const bx = ui.W / 2 - bw / 2;
    // 每局最多复活 REVIVE_MAX 次：先用免费次数（军略「不屈」、新手免费），其余看视频（无广告版花元宝）。
    const used = b.reviveCount, left3 = Battle.REVIVE_MAX - used;
    const bonus = Battle.reviveBonusText(used + 1);
    const sub = `第${used + 1}次复活${bonus ? ' · ' + bonus : ''}`;
    if (left3 <= 0) {
      ui.text(`本局已复活 ${Battle.REVIVE_MAX} 次`, ui.W / 2, y + 40 * u, 26, '#a89a86');
      y += 96 * u;
    } else if (b.revives > 0) {
      if (ui.button('rv_free', bx, y, bw, 96 * u, `免费复活（${b.revives}）`, C.btnGold, { sub })) {
        b.revives--;
        this.scene.revive();
        return false;
      }
      y += 116 * u;
    } else if (NO_ADS) {
      // 无广告版本：花元宝复活
      const cost = NO_ADS_PRICE.revive;
      if (ui.button('rv_yb', bx, y, bw, 96 * u, `${cost}元宝复活`, save.yuanbao >= cost ? C.btnGold : C.btnGray, { icon: 'yuanbao', sub })) {
        if (save.yuanbao < cost) ui.toast(`元宝不足（拥有${save.yuanbao}）`);
        else {
          save.yuanbao -= cost;
          b.adReviveUsed = true;
          markDirty();
          this.scene.revive();
          return false;
        }
      }
      y += 116 * u;
    } else {
      if (adButton(ui, 'rv_ad', bx, y, bw, 96 * u, '看视频复活', { sub: `${sub} · 还可${left3}次` }) && !this.busy) {
        this.busy = true;
        getPlatform().showRewardedAd('revive').then((ok) => {
          this.busy = false;
          if (this.gaveUp) return;
          if (!ok) this.remain = Math.max(this.remain, 5);
          if (ok) {
            b.adRevives++;
            progressTask('ad', 1);
            this.scene.revive();
            this.closed = true;
          }
        });
      }
      y += 116 * u;
    }
    if ((ui.button('rv_giveup', bx, y, bw, 86 * u, '放弃', C.btnGray) && !this.busy) || (left <= 0 && !this.busy)) {
      this.gaveUp = true;
      this.scene.finish(false);
      return false;
    }
  }
  closed?: boolean;
}

/** 直取敌将确认：跳过多久、补多少经验，确认后再跳，防止误触 */
export class RushConfirmDialog implements Dialog {
  t?: number;
  private busy = false;
  private done = false;
  constructor(private scene: BattleScene) {}
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const w = ui.W - 120 * u, h = 520 * u;
    const f = dialogFrame(ui, w, h, '直取敌将', this.t, 'rush_close');
    if (f.close || !b.canRush()) return false;
    let y = f.y + 120 * u;
    ui.text(`跳过约 ${Math.round(b.rushSkip())} 秒小兵`, ui.W / 2, y, 32, '#fff4d6');
    y += 60 * u;
    ui.text(`直接迎战「${b.nextBossName()}」`, ui.W / 2, y, 32, C.gold);
    y += 60 * u;
    ui.text('跳过的部分只补一半经验，锦囊照常发放', ui.W / 2, y, 22, C.textDim);
    if (b.chapter.campaignMinutes === 10) ui.text('跳过的波次放弃截粮，也不计长战材料加成', ui.W / 2, y + 34 * u, 21, C.textDim);
    else if (b.chapter.campaignMinutes === 5) ui.text('路上的运粮车也将一并跳过', ui.W / 2, y + 34 * u, 21, C.textDim);
    y += 80 * u;
    const bw = (w - 140 * u) / 2;
    if (ui.button('rush_no', f.x + 50 * u, y, bw, 96 * u, '再等等', C.btnGray)) return false;
    const go = () => { if (b.rush()) getPlatform().report('rush', { chapter: b.chapter.id, sec: Math.floor(b.t) }); };
    if (NO_ADS) {
      if (ui.button('rush_go', f.x + 90 * u + bw, y, bw, 96 * u, '出发！', C.btnRed)) { go(); return false; }
    } else if (adButton(ui, 'rush_go', f.x + 90 * u + bw, y, bw, 96 * u, '出发！') && !this.busy) {
      // 1.0.4：直取敌将要看一次广告
      this.busy = true;
      getPlatform().showRewardedAd('rush').then((ok) => {
        this.busy = false;
        if (ok) { progressTask('ad', 1); go(); this.done = true; }
      });
    }
    if (this.done) return false;
  }
}

export class BossIntroDialog implements Dialog {
  noDim = true;
  t?: number;
  constructor(private d: BossDef, private final: boolean) {}
  draw(ui: UI) {
    const u = ui.u;
    const t = this.t || 0;
    if (t > 2.2) return false;
    const a = t < 0.3 ? t / 0.3 : t > 1.8 ? (2.2 - t) / 0.4 : 1;
    ui.ctx.globalAlpha = a * 0.7;
    ui.ctx.fillStyle = '#2a0508';
    ui.ctx.fillRect(0, ui.H * 0.32, ui.W, ui.H * 0.26);
    ui.ctx.globalAlpha = a;
    ui.ctx.fillStyle = '#e43b44';
    ui.ctx.fillRect(0, ui.H * 0.32, ui.W, 4 * u);
    ui.ctx.fillRect(0, ui.H * 0.58 - 4 * u, ui.W, 4 * u);
    const slide = (1 - Math.min(1, t * 3)) * ui.W * 0.5;
    ui.icon(`u_${this.d.sprite}_0_L`, ui.W * 0.24 + slide, ui.H * 0.45, 240 * u);
    ui.text(this.final ? '敌军主将' : '敌将来袭', ui.W * 0.62 - slide, ui.H * 0.38, 30, '#ffb0b0');
    ui.text(this.d.name, ui.W * 0.62 - slide, ui.H * 0.45, 72, '#fff4d6', 'center', '#3a0d12');
    ui.text(this.d.title, ui.W * 0.62 - slide, ui.H * 0.52, 28, C.gold);
    ui.ctx.globalAlpha = 1;
  }
}

export class ResultDialog implements Dialog {
  private res: RunResult;
  private report?: DamageReportDialog;
  private weeklyBest = 0;
  private tierCount = 0;
  private video: string | null = null;
  private shared = false;
  private doubled = false;
  private busy = false;
  t?: number;
  constructor(private scene: BattleScene, private win: boolean) {
    const b = scene.battle;
    if (WEB_RULES) this.report = new DamageReportDialog(b);
    if (scene.weekly) {
      this.res = settleWeeklyRun(b.t, b.coins, b.kills, b.bossKills, b.equipDrops);
      const w = settleWeekly(b.kills);
      this.res.newBest = w.newBest;
      this.weeklyBest = save.weekly.best;
      for (const g of w.rewards) {
        this.res.gold += g.reward.gold || 0;
        this.res.iron += g.reward.iron || 0;
        this.res.yuanbao += g.reward.yuanbao || 0;
        if (g.reward.shards) this.res.shardReward = g.reward.shards;
      }
      this.tierCount = w.rewards.length;
    } else {
      this.res = b.tj
        ? settleTianji(win, b.t, b.kills, b.bossKills, b.tj.history)
        : b.def
        ? settleDefense(b.chapter.id, win, b.t, b.coins, b.kills, b.bossKills, b.equipDrops, b.def.waveIdx, WEB_RULES ? runStars(win, b.reviveCount, b.finalBossSec) : undefined)
        : b.chapter.tutorial
        ? settleTutorial(win, b.coins, b.kills)
        : b.chapter.endless
        ? settleEndless(b.t, b.coins, b.kills, b.bossKills, b.equipDrops)
        : settleRun(b.chapter, scene.diff, win, b.t, b.coins, b.kills, b.bossKills, b.equipDrops, runStars(win, b.reviveCount, b.finalBossSec), b.skippedSeconds, b.convoysCaptured);
    }
    if (scene.videoPath) scene.videoPath.then((p) => { this.video = p; });
    if (save.guide === 0) save.guide = 1;
    markDirty();
    flushSave(true);
  }
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const t = this.t || 0;
    const nEntries = 3 + (this.res.yuanbao ? 1 : 0) + this.res.items.length + (this.res.heroReward ? 1 : 0) + (this.res.shardReward ? 1 : 0);
    const showStars = this.res.stars !== undefined && this.win && !this.scene.weekly;
    const w = ui.W - 60 * u, h = (nEntries > 5 ? 1130 : 960) * u - (this.doubled ? 120 * u : 0) + (this.video && !this.shared ? 104 * u : 0) + (showStars ? 128 * u : 0) + (this.canRecommend ? 84 * u : 0) + (IS_XHS && hasResultPublish() ? 100 * u : 0) + (b.tj ? 170 * u : 0);
    const f = dialogFrame(ui, w, h, b.tj ? '签运报告' : this.win ? '大获全胜' : '战斗结束', t);
    let y = f.y + 90 * u;
    if (b.tj) ui.text(this.win ? '活过十分钟！天命在我' : `撑过 ${fmtTime(b.t)}${this.res.newBest ? '（新纪录）' : ''}`, ui.W / 2, y, 32, this.win ? C.gold : '#fff4d6');
    else if (this.scene.weekly) ui.text(this.res.newBest ? `本周新纪录！击败 ${b.kills}` : `本周最佳 ${this.weeklyBest}`, ui.W / 2, y, 30, this.res.newBest ? C.gold : '#fff4d6');
    else if (this.res.defense) ui.text(this.win ? (this.res.firstClear ? `首次守住${b.chapter.name}！${b.chapter.id < 10 ? '下一关已解锁' : ''}` : this.res.defense.dailyFirst ? '城池守住了！今日首胜碎片翻倍' : '城池守住了！') : `城池失守 · 守到第 ${this.res.defense.waves} 波${this.res.newBest ? '（新纪录）' : ''}`, ui.W / 2, y, 30, this.win ? C.gold : '#fff4d6');
    else if (this.win) ui.text(this.res.heroReward ? `首次通关！获得武将${HERO_BY_ID[this.res.heroReward].name}！` : this.res.firstClear ? '首次通关！' : '凯旋而归', ui.W / 2, y, 34, C.gold);
    else if (this.res.endless) ui.text(this.res.newBest ? `新纪录！坚持 ${fmtTime(b.t)}` : `最佳纪录 ${fmtTime(this.res.best || 0)}`, ui.W / 2, y, 30, this.res.newBest ? C.gold : '#fff4d6');
    else if (b.bossTimedOut) ui.text(`斩将超时 · ${this.report?.bossStatus ?? FINAL_BOSS_LIMIT_SEC + '秒内未击败主将'}`, ui.W / 2, y, 30, '#ff8a80');
    else ui.text(b.t >= b.chapter.duration * 0.5 ? '虽败犹荣' : '胜败乃兵家常事', ui.W / 2, y, 30, '#fff4d6');
    y += 60 * u;
    ui.text(this.scene.label, ui.W / 2, y, 26, this.scene.diff.id ? this.scene.diff.color : C.textDim);
    if (this.res.newSkills) ui.text('解锁新技能：' + this.res.newSkills.join('、'), ui.W / 2, y + 34 * u, 20, '#9be37a');
    y += 60 * u;
    if (showStars) {
      // 三星评价：通关 / 不复活 / 限时击败最终敌将
      const st = this.res.stars || 0;
      const sw = (w - 80 * u) / 3;
      STAR_LABELS.forEach((label, i) => {
        const on = !!(st & (1 << i));
        const cx = f.x + 40 * u + sw * i + sw / 2;
        ui.icon('star', cx, y + 10 * u, 52 * u, on ? 1 : 0.2);
        ui.text(label, cx, y + 54 * u, 18, on ? C.gold : '#7a6a5a');
      });
      y += 92 * u;
      const tip = this.res.starBonus ? `集齐三星！额外元宝×${this.res.starBonus}` : !this.res.defense && starCount(st) < 3 ? '集齐三星可额外领取元宝' : '';
      const hard = !this.res.defense && this.res.firstClear && this.scene.diff.id === 0 && this.scene.chapter.id === 1 && diffOpen(1) ? '困难难度已解锁，去挑战吧！' : '';
      if (tip || hard) ui.text(hard || tip, ui.W / 2, y, 20, this.res.starBonus ? C.gold : '#9be37a');
      y += 36 * u;
    }
    if (b.tj) {
      // 签运：五档签各抽到几支 + 评语
      const hist = b.tj.history, verdict = luckVerdict(hist);
      const sw = (w - 100 * u) / 5;
      TIERS.forEach((T, i) => {
        const n = hist.filter((x) => x === i).length;
        const cx = f.x + 50 * u + sw * i + sw / 2;
        const sh = 70 * u;
        ui.ctx.fillStyle = '#2a1d14'; ui.ctx.fillRect(cx - 9 * u, y - 2 * u, 18 * u, sh + 4 * u);
        ui.ctx.fillStyle = '#f1e2bd'; ui.ctx.fillRect(cx - 7 * u, y, 14 * u, sh);
        ui.ctx.fillStyle = T.color; ui.ctx.fillRect(cx - 7 * u, y, 14 * u, sh * 0.28);
        ui.text(T.name, cx, y + sh + 24 * u, 19, n ? T.color : '#7a6a5a');
        ui.text('×' + n, cx + 22 * u, y + sh * 0.6, 22, n ? '#fff' : '#7a6a5a', 'left');
      });
      y += 128 * u;
      ui.text(`共 ${hist.length} 签 · ${verdict.text}${this.res.tianji && !this.res.tianji.rewarded ? ' · 今日奖励次数已用完' : this.res.tianji ? ` · 今日奖励还剩 ${this.res.tianji.left} 次` : ''}`, ui.W / 2, y, 24, verdict.color);
      y += 42 * u;
    }
    const rows: [string, string][] = [['坚守时间', fmtTime(b.t)], ['击败敌军', fmtNum(b.kills)], ['武将等级', 'Lv.' + b.level], ['斩获敌将', String(b.bossKills)]];
    rows.forEach((r, i) => {
      const sx = f.x + 60 * u + (i % 2) * (w / 2 - 30 * u);
      const sy = y + Math.floor(i / 2) * 50 * u;
      if (i === 3 && this.report) {
        if (ui.button('res_dps', sx - 12 * u, sy - 23 * u, w / 2 - 69 * u, 48 * u,
          `DPS ${fmtNum(Math.round(this.report.dps))} · 战报 ›`, C.btnBlue, { size: 22 })) this.report.open();
        return;
      }
      ui.text(r[0], sx, sy, 24, C.textDim, 'left');
      ui.text(r[1], sx + 140 * u, sy, 26, '#fff', 'left');
    });
    if (this.res.convoyLoot) {
      const loot = this.res.convoyLoot;
      const detail = this.win ? `含截粮 ${loot.count} 车 · 军饷 +${loot.gold * (this.doubled ? 2 : 1)} · 元宝 +${loot.yuanbao}`
        : `截获 ${loot.count} 车 · 本局未通关，截粮奖励未发放`;
      ui.text(detail, ui.W / 2, y + 94 * u, 21, this.win ? C.gold : C.textDim);
    }
    y += 120 * u;
    ui.ctx.fillStyle = C.borderDark;
    ui.ctx.fillRect(f.x + 40 * u, y, w - 80 * u, 3 * u);
    y += 40 * u;
    const lootTitle = this.doubled ? '奖励（已翻倍）' : '战利品';
    const factor = this.res.materialMultiplier ?? 1;
    ui.text(factor > 1 ? `${lootTitle} · 基础军饷、玄铁 ×${factor.toFixed(2)}` : lootTitle, ui.W / 2, y, factor > 1 ? 24 : 28, C.gold);
    y += 40 * u;
    const mul = this.doubled ? 2 : 1;
    const entries = rewardEntries({ gold: this.res.gold * mul, iron: this.res.iron * mul, yuanbao: this.res.yuanbao, hero: this.res.heroReward, shards: this.res.shardReward }, this.res.items);
    rewardRow(ui, entries, ui.W / 2, y, 110 * u, t);
    y += entries.length > 5 ? 380 * u : 210 * u;
    const bw = w - 140 * u;
    const bx = ui.W / 2 - bw / 2;
    if (!this.doubled && !NO_ADS) {
      if (adButton(ui, 'res_double', bx, y, bw, 100 * u, '双倍领取', { sub: '金币与玄铁翻倍' }) && !this.busy) {
        this.busy = true;
        getPlatform().showRewardedAd('result_double').then((ok) => {
          this.busy = false;
          if (!ok) return;
          this.doubled = true;
          save.gold += this.res.gold;
          save.iron += this.res.iron;
          progressTask('ad', 1);
          markDirty();
          flushSave(true);
        });
      }
      y += 120 * u;
    }
    // 抖音：分享本局录屏集锦（每日首次分享奖励元宝）
    if (this.video && !this.shared) {
      const today = new Date().toDateString();
      const bonus = save.videoShareDay !== today;
      if (ui.button('res_video', bx, y, bw, 86 * u, bonus ? '分享战斗视频 +30元宝' : '分享战斗视频', C.btnBlue, { size: 26 })) {
        getPlatform().shareVideo(this.video, `${this.scene.label}，一骑当千斩敌${b.kills}！`).then((ok) => {
          if (!ok) return;
          this.shared = true;
          getPlatform().report('video_share', { mode: this.scene.modeName });
          if (save.videoShareDay !== today) { save.videoShareDay = today; save.yuanbao += 30; markDirty(); ui.toast('分享成功，元宝+30'); }
        });
      }
      y += 104 * u;
    }
    // 炫耀战绩：带上本局真实数据，按本局亮点配图（分享不给奖励，避免诱导分享）
    const canShare = !IS_H5 && !this.video;
    const okW = canShare ? (bw - 20 * u) / 2 : bw;
    if (canShare && ui.button('res_share', bx + okW + 20 * u, y, okW, 96 * u, '炫耀战绩', C.btnBlue, { size: 28 })) {
      const combo = b.bestCombo >= 50 ? `，最高${b.bestCombo}连斩` : '';
      const useUlt = b.ultCasts >= 3 && b.bestCombo < 100;
      getPlatform().share(`我在长坂坡斩敌${b.kills}人${combo}，你能超过我吗？`, 'from=result', useUlt ? SHARE_CONFIG.images.ult : SHARE_CONFIG.images.combo);
      getPlatform().report('share', { scene: 'result' });
    }
    if (ui.button('res_ok', bx, y, okW, 96 * u, this.doubled || NO_ADS ? '收下' : '直接领取', this.doubled || NO_ADS ? C.btnGold : C.btnGray) && t > 0.6) {
      // 非首局且未看广告时偶尔展示插屏
      if (!this.doubled && save.stats.runs > 2 && save.stats.runs % 2 === 0) getPlatform().showInterstitialAd();
      playBgm('bgm_home');
      game.setScene(new HomeScene());
      return false;
    }
    if (IS_XHS && hasResultPublish()) {
      const title = b.hero.name + (this.win ? '拿下' : '挑战') + this.scene.label;
      const content = title + '，坚守' + fmtTime(b.t) + '，斩敌' + b.kills + '人。';
      drawResultPublish(ui, 'res', bx, y + 110 * u, bw, { title, content, comment: content });
    }
    // 打赢了是推荐的好时机（官方建议在高光时刻拉起推荐组件；不发奖励）
    if (this.canRecommend) ui.button('res_recommend', ui.W / 2 - 170 * u, y + 116 * u, 340 * u, 64 * u, '觉得好玩？推荐给好友', C.btnGreen, { size: 22, icon: 'thumb', tap: () => openRecommend('result') });
  }
  private get canRecommend() {
    return this.win && !this.res.endless && getPlatform().supportsRecommend();
  }
}
