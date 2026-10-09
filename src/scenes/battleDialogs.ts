import { game, Dialog } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { dialogFrame, adButton, rewardRow, rewardEntries } from '../ui/widgets';
import type { BattleScene } from './battleScene';
import { choiceInfo } from './battleScene';
import type { Battle, Choice } from '../battle/battle';
import { WEAPONS, PASSIVES, MAX_WEAPON_LV, passiveMax, weaponLink, weaponsForHero, WeaponId } from '../data/skills';
import type { BossDef } from '../data/enemies';
import { save, markDirty, flushSave } from '../meta/save';
import { settleRun, settleEndless, settleWeeklyRun, RunResult } from '../meta/run';
import { settleWeekly } from '../meta/goals';
import { progressTask } from '../meta/ops';
import { playSfx, playBgm, refreshMusic } from '../audio/sound';
import { fmtTime, easeOutBack, fmtNum } from '../core/math';
import { HomeScene } from './homeScene';
import { HERO_BY_ID } from '../data/heroes';
import { guidePointer } from '../ui/guide';

const LEVELUP_AD_LIMIT = 5;

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
    const has = b.passiveLv(d.evoPassive) > 0;
    ex.recipe = `进化：满级 + ${PASSIVES[d.evoPassive].name} → ${link ? '★' + link.name : d.evoName}`;
    ex.recipeOk = has;
  } else if (c.kind === 'passive') {
    const helps = b.evoTargets(c.id);
    if (helps.length) {
      ex.recipe = '可助进化：' + helps.map((id) => weaponLink(id, b.hero.id)?.name || WEAPONS[id].evoName).join('、');
      ex.recipeOk = true;
    } else {
      const ws = weaponsForHero(b.hero.id, b.cleared).filter((id) => WEAPONS[id].evoPassive === c.id).map((id) => WEAPONS[id].name);
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

/** 技能卡片 */
function choiceCard(ui: UI, id: string, c: Choice, x: number, y: number, w: number, h: number, highlight = false, ex: CardExtra = {}): boolean {
  const u = ui.u;
  const info = choiceInfo(c);
  const pressed = ui.isPressed(id);
  const off = pressed ? 4 * u : 0;
  const border = info.evo || ex.evoReady ? '#feae34' : ex.link ? '#fee761' : info.isNew ? '#2ce8f5' : '#c89b5c';
  ui.pixRect(x, y + off, w, h, '#120d0c');
  ui.pixRect(x + 4 * u, y + 4 * u + off, w - 8 * u, h - 8 * u, border);
  ui.pixRect(x + 8 * u, y + 8 * u + off, w - 16 * u, h - 16 * u, info.evo ? '#5a3a14' : ex.link ? '#4a3418' : '#3a2c2a');
  if (highlight || ex.rec) {
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
      ui.pixRect(sx, sy, 20 * u, 20 * u, i < info.lv ? (i === info.lv - 1 ? '#fee761' : '#feae34') : '#231917', 4 * u);
    }
  }
  ui.wrapText(info.desc, tx, y + 64 * u + off, w - (tx - x) - 24 * u, 24, '#d9c6a0');
  if (ex.recipe) {
    ui.pixRect(x + 20 * u, y + h - 50 * u + off, w - 40 * u, 34 * u, 'rgba(0,0,0,0.3)');
    ui.text(ex.recipe, x + 34 * u, y + h - 33 * u + off, 20, ex.recipeOk ? '#9be37a' : ex.link ? '#fee761' : '#a89a86', 'left');
  }
  if (ex.banish) {
    ui.ctx.globalAlpha = ex.banish === 'yes' ? 0.35 + 0.1 * Math.sin(ui.time * 8) : 0.55;
    ui.pixRect(x, y + off, w, h, ex.banish === 'yes' ? '#a22633' : '#120d0c');
    ui.ctx.globalAlpha = 1;
    if (ex.banish === 'yes') ui.text('点击封禁', x + w - 100 * u, y + h / 2 + off, 30, '#fff');
  }
  return ui.clicked(id, x, y, w, h);
}

export class LevelUpDialog implements Dialog {
  constructor(private scene: BattleScene, private choices: Choice[]) {}
  private banishMode = false;
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const t = this.t || 0;
    ui.ribbon(ui.W / 2, ui.H * 0.2, 420 * u, `升级！Lv.${b.level}`, '#3e8948');
    ui.text('选择一项强化', ui.W / 2, ui.H * 0.2 + 64 * u, 26, C.textDim);
    const cw = ui.W - 70 * u, ch = 220 * u;
    let y = ui.H * 0.2 + 110 * u;
    const tutorial = save.guide === 0 && b.level === 2;
    const rec = tutorial ? -1 : b.recommend(this.choices);
    if (this.banishMode) ui.text('选择要封禁的新技能（本局不再出现）', ui.W / 2, y - 14 * u, 24, '#ff8a80');
    for (let i = 0; i < this.choices.length; i++) {
      const c = this.choices[i];
      const k = Math.max(0, Math.min(1, (t - i * 0.07) * 5));
      const x = ui.W / 2 - cw / 2 + (1 - easeOutBack(k)) * ui.W;
      const ex = cardExtra(b, c);
      ex.rec = i === rec;
      if (this.banishMode) ex.banish = (c.kind === 'weapon' || c.kind === 'passive') && c.isNew ? 'yes' : 'no';
      if (choiceCard(ui, 'lv_choice_' + i, c, x, y, cw, ch, tutorial && i === 0, ex) && t > 0.25) {
        if (this.banishMode) {
          if (ex.banish === 'yes' && b.banish(this.choices, i)) { this.banishMode = false; playSfx('hurt'); }
          else ui.toast('只能封禁新技能');
          continue;
        }
        this.scene.choose(c);
        return false;
      }
      y += ch + 20 * u;
    }
    // 刷新 / 封禁
    const bh = 92 * u;
    y += 10 * u;
    const showBanish = !tutorial && b.banishes > 0;
    const bw = showBanish ? 300 * u : 300 * u;
    const rx = showBanish ? ui.W / 2 - bw - 12 * u : ui.W / 2 - bw / 2;
    if (b.rerolls > 0) {
      if (ui.button('lv_reroll', rx, y, bw, bh, `刷新(${b.rerolls})`, C.btnBlue)) {
        b.rerolls--;
        this.choices = b.rollChoices();
        this.banishMode = false;
        this.t = 0.2;
      }
    } else {
      const left = LEVELUP_AD_LIMIT - save.daily.levelupAds;
      if (adButton(ui, 'lv_reroll_ad', rx, y, bw, bh, '刷新', { disabled: left <= 0, sub: `今日剩余${Math.max(0, left)}次` })) {
        getPlatform().showRewardedAd('levelup_reroll').then((ok) => {
          if (!ok) return;
          save.daily.levelupAds++;
          progressTask('ad', 1);
          this.choices = b.rollChoices();
          this.banishMode = false;
          this.t = 0.2;
        });
      }
    }
    if (showBanish && ui.button('lv_banish', ui.W / 2 + 12 * u, y, bw, bh, this.banishMode ? '取消封禁' : `封禁(${b.banishes})`, this.banishMode ? C.btnGray : C.btnRed)) {
      this.banishMode = !this.banishMode;
    }
    if (save.guide === 0 && b.level === 2) guidePointer(ui, ui.W / 2 - cw / 2, ui.H * 0.2 + 110 * u, cw, ch);
  }
  t?: number;
}

export class ChestDialog implements Dialog {
  private opened = false;
  constructor(private scene: BattleScene, private rewards: Choice[]) {}
  t?: number;
  draw(ui: UI) {
    const u = ui.u;
    const t = this.t || 0;
    const cy = ui.H * 0.36;
    const hasEvo = this.rewards.some((r) => r.kind === 'evo');
    if (t < 1.0) {
      // 宝箱抖动
      const shake = Math.sin(t * 50) * 8 * u * t;
      ui.ctx.globalAlpha = Math.min(1, t * 3);
      const glow = ui.ctx.createRadialGradient(ui.W / 2, cy, 10, ui.W / 2, cy, 300 * u);
      glow.addColorStop(0, hasEvo ? 'rgba(254,231,97,0.8)' : 'rgba(255,255,255,0.5)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ui.ctx.fillStyle = glow;
      ui.ctx.fillRect(0, cy - 300 * u, ui.W, 600 * u);
      ui.ctx.globalAlpha = 1;
      ui.icon(hasEvo ? 'chest_gold' : 'chest', ui.W / 2 + shake, cy, 220 * u);
      ui.text('开启宝箱…', ui.W / 2, cy + 180 * u, 32, C.gold);
      return;
    }
    if (!this.opened) {
      this.opened = true;
      playSfx(hasEvo ? 'evolve' : 'chest');
      for (const r of this.rewards) this.scene.choose(r);
    }
    // 光芒
    ui.ctx.save();
    ui.ctx.translate(ui.W / 2, cy);
    ui.ctx.rotate(t * 0.5);
    ui.ctx.fillStyle = hasEvo ? 'rgba(254,231,97,0.18)' : 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 12; i++) {
      ui.ctx.rotate(Math.PI / 6);
      ui.ctx.beginPath();
      ui.ctx.moveTo(0, 0);
      ui.ctx.lineTo(-40 * u, -500 * u);
      ui.ctx.lineTo(40 * u, -500 * u);
      ui.ctx.fill();
    }
    ui.ctx.restore();
    ui.icon('chest_open', ui.W / 2, cy, 200 * u);
    const linkEvo = this.rewards.some((r) => r.kind === 'evo' && weaponLink(r.id, this.scene.battle.hero.id));
    ui.ribbon(ui.W / 2, cy - 180 * u, 420 * u, linkEvo ? '★专属联动觉醒！' : hasEvo ? '神兵进化！' : '获得宝物', linkEvo ? '#a2611a' : hasEvo ? '#c96d17' : '#a22633');
    const cw = ui.W - 70 * u, chh = 150 * u;
    let y = cy + 140 * u;
    this.rewards.forEach((r, i) => {
      const k = Math.max(0, Math.min(1, (t - 1 - i * 0.12) * 5));
      if (k <= 0) return;
      ui.ctx.globalAlpha = k;
      choiceCardStatic(ui, r, ui.W / 2 - cw / 2, y, cw, chh);
      ui.ctx.globalAlpha = 1;
      y += chh + 12 * u;
    });
    const bw = 300 * u;
    if (t > 1.4 && ui.button('chest_ok', ui.W / 2 - bw / 2, Math.min(y + 10 * u, ui.H - 140 * u), bw, 92 * u, '确定', C.btnGold)) return false;
  }
}

function choiceCardStatic(ui: UI, c: Choice, x: number, y: number, w: number, h: number) {
  const u = ui.u;
  const info = choiceInfo(c);
  ui.pixRect(x, y, w, h, '#120d0c');
  ui.pixRect(x + 4 * u, y + 4 * u, w - 8 * u, h - 8 * u, info.evo ? '#feae34' : '#c89b5c');
  ui.pixRect(x + 8 * u, y + 8 * u, w - 16 * u, h - 16 * u, info.evo ? '#5a3a14' : '#3a2c2a');
  const isz = h - 36 * u;
  ui.qualityFrame(x + 18 * u, y + 18 * u, isz, info.evo ? '#feae34' : '#8b9bb4');
  ui.icon(info.icon, x + 18 * u + isz / 2, y + 18 * u + isz / 2, isz * 0.66);
  const tx = x + 36 * u + isz;
  ui.text(info.name + (info.lv ? `  Lv.${info.lv}` : ''), tx, y + 40 * u, 30, info.evo ? '#fee761' : '#fff4d6', 'left');
  ui.wrapText(info.desc, tx, y + 62 * u, w - (tx - x) - 20 * u, 22, '#d9c6a0');
}

export class PauseDialog implements Dialog {
  constructor(private scene: BattleScene) {}
  t?: number;
  private confirmQuit = false;
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const w = ui.W - 60 * u, h = 980 * u;
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
    y += isz + 56 * u;
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
    // 设置开关
    const tw = (w - 120 * u) / 3;
    if (ui.button('p_music', x, y, tw, 76 * u, '音乐:' + (save.settings.music ? '开' : '关'), C.btnGray, { size: 22 })) { save.settings.music = !save.settings.music; refreshMusic(); markDirty(); }
    if (ui.button('p_sfx', x + tw + 20 * u, y, tw, 76 * u, '音效:' + (save.settings.sfx ? '开' : '关'), C.btnGray, { size: 22 })) { save.settings.sfx = !save.settings.sfx; markDirty(); }
    if (ui.button('p_ult', x + (tw + 20 * u) * 2, y, tw, 76 * u, '大招:' + (save.settings.ultRight ? '右' : '左'), C.btnGray, { size: 22 })) { save.settings.ultRight = !save.settings.ultRight; markDirty(); }
    y += 100 * u;
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
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const w = ui.W - 100 * u, h = 640 * u;
    const f = dialogFrame(ui, w, h, '力竭', this.t);
    const left = Math.max(0, 10 - (this.t || 0));
    ui.text(`${this.scene.battle.hero.name}力竭倒地……是否再战？`, ui.W / 2, f.y + 110 * u, 30, '#fff4d6');
    ui.icon('revive', ui.W / 2, f.y + 230 * u, 140 * u);
    ui.text(String(Math.ceil(left)), ui.W / 2, f.y + 230 * u, 48, '#fff');
    let y = f.y + 340 * u;
    const bw = w - 120 * u;
    const bx = ui.W / 2 - bw / 2;
    if (b.revives > 0) {
      if (ui.button('rv_free', bx, y, bw, 96 * u, `不屈复活（${b.revives}）`, C.btnGold)) {
        b.revives--;
        this.scene.revive();
        return false;
      }
      y += 116 * u;
    } else if (!b.adReviveUsed) {
      if (adButton(ui, 'rv_ad', bx, y, bw, 96 * u, '看视频复活') && !this.busy) {
        this.busy = true;
        getPlatform().showRewardedAd('revive').then((ok) => {
          this.busy = false;
          if (ok) {
            b.adReviveUsed = true;
            save.daily.adStamina += 0;
            progressTask('ad', 1);
            this.scene.revive();
            this.closed = true;
          }
        });
      }
      y += 116 * u;
    }
    if (ui.button('rv_giveup', bx, y, bw, 86 * u, '放弃', C.btnGray) || (left <= 0 && !this.busy)) {
      this.scene.finish(false);
      return false;
    }
  }
  closed?: boolean;
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
  private weeklyBest = 0;
  private tierCount = 0;
  private video: string | null = null;
  private shared = false;
  private doubled = false;
  private busy = false;
  t?: number;
  constructor(private scene: BattleScene, private win: boolean) {
    const b = scene.battle;
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
      this.res = b.chapter.endless
        ? settleEndless(b.t, b.coins, b.kills, b.bossKills, b.equipDrops)
        : settleRun(b.chapter, scene.diff, win, b.t, b.coins, b.kills, b.bossKills, b.equipDrops);
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
    const w = ui.W - 60 * u, h = (nEntries > 5 ? 1130 : 960) * u - (this.doubled ? 120 * u : 0) + (this.video && !this.shared ? 104 * u : 0);
    const f = dialogFrame(ui, w, h, this.win ? '大获全胜' : '战斗结束', t);
    let y = f.y + 90 * u;
    if (this.scene.weekly) ui.text(this.res.newBest ? `本周新纪录！击败 ${b.kills}` : `本周最佳 ${this.weeklyBest}`, ui.W / 2, y, 30, this.res.newBest ? C.gold : '#fff4d6');
    else if (this.win) ui.text(this.res.heroReward ? `首次通关！获得武将${HERO_BY_ID[this.res.heroReward].name}！` : this.res.firstClear ? '首次通关！' : '凯旋而归', ui.W / 2, y, 34, C.gold);
    else if (this.res.endless) ui.text(this.res.newBest ? `新纪录！坚持 ${fmtTime(b.t)}` : `最佳纪录 ${fmtTime(this.res.best || 0)}`, ui.W / 2, y, 30, this.res.newBest ? C.gold : '#fff4d6');
    else ui.text(b.t >= b.chapter.duration * 0.5 ? '虽败犹荣' : '胜败乃兵家常事', ui.W / 2, y, 30, '#fff4d6');
    y += 60 * u;
    ui.text(this.scene.label, ui.W / 2, y, 26, this.scene.diff.id ? this.scene.diff.color : C.textDim);
    if (this.res.newSkills) ui.text('解锁新技能：' + this.res.newSkills.join('、'), ui.W / 2, y + 34 * u, 20, '#9be37a');
    y += 60 * u;
    const rows: [string, string][] = [['坚守时间', fmtTime(b.t)], ['击败敌军', fmtNum(b.kills)], ['武将等级', 'Lv.' + b.level], ['斩获敌将', String(b.bossKills)]];
    rows.forEach((r, i) => {
      const sx = f.x + 60 * u + (i % 2) * (w / 2 - 30 * u);
      const sy = y + Math.floor(i / 2) * 50 * u;
      ui.text(r[0], sx, sy, 24, C.textDim, 'left');
      ui.text(r[1], sx + 140 * u, sy, 26, '#fff', 'left');
    });
    y += 120 * u;
    ui.ctx.fillStyle = C.borderDark;
    ui.ctx.fillRect(f.x + 40 * u, y, w - 80 * u, 3 * u);
    y += 40 * u;
    ui.text(this.doubled ? '奖励（已翻倍）' : '战利品', ui.W / 2, y, 28, C.gold);
    y += 40 * u;
    const mul = this.doubled ? 2 : 1;
    const entries = rewardEntries({ gold: this.res.gold * mul, iron: this.res.iron * mul, yuanbao: this.res.yuanbao, hero: this.res.heroReward, shards: this.res.shardReward }, this.res.items);
    rewardRow(ui, entries, ui.W / 2, y, 110 * u, t);
    y += entries.length > 5 ? 380 * u : 210 * u;
    const bw = w - 140 * u;
    const bx = ui.W / 2 - bw / 2;
    if (!this.doubled) {
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
    if (ui.button('res_ok', bx, y, bw, 96 * u, this.doubled ? '收下' : '直接领取', this.doubled ? C.btnGold : C.btnGray) && t > 0.6) {
      // 非首局且未看广告时偶尔展示插屏
      if (!this.doubled && save.stats.runs > 2 && save.stats.runs % 2 === 0) getPlatform().showInterstitialAd();
      playBgm('bgm_home');
      game.setScene(new HomeScene());
      return false;
    }
  }
}

/** 局内进化表：本局可用武器的进化配方，专属联动高亮 */
export class EvoTableDialog implements Dialog {
  t?: number;
  constructor(private b: Battle) {}
  draw(ui: UI) {
    const u = ui.u;
    const b = this.b;
    const w = ui.W - 50 * u, h = Math.min(ui.H - 200 * u - ui.safeTop, 1300 * u);
    const f = dialogFrame(ui, w, h, '进化表', this.t, 'evo_close');
    if (f.close) return false;
    ui.text('武器升满级 + 拥有对应兵法，开宝箱即可进化', ui.W / 2, f.y + 80 * u, 22, '#9be37a');
    const ids = weaponsForHero(b.hero.id, b.cleared);
    // 专属武器与联动排在前面
    const rank = (id: WeaponId) => (WEAPONS[id].hero ? 0 : weaponLink(id, b.hero.id) ? 1 : 2);
    ids.sort((a, c) => rank(a) - rank(c));
    const rh = 120 * u;
    const top = f.y + 110 * u, vh = h - 140 * u;
    const off = ui.beginScroll('evo_table', f.x + 20 * u, top, w - 40 * u, vh, ids.length * (rh + 10 * u));
    ids.forEach((id, i) => {
      const d = WEAPONS[id];
      const link = weaponLink(id, b.hero.id);
      const y = top + i * (rh + 10 * u) + off;
      if (y + rh < top || y > top + vh) return;
      const own = b.weapon(id);
      ui.pixRect(f.x + 24 * u, y, w - 48 * u, rh, link || d.hero ? '#4a3418' : '#2a2030');
      const isz = 84 * u, iy = y + (rh - isz) / 2;
      let x = f.x + 40 * u;
      const cell = (icon: string, name: string, col: string, active: boolean) => {
        ui.qualityFrame(x, iy, isz, active ? '#feae34' : '#5a6988');
        ui.icon(icon, x + isz / 2, iy + isz / 2, isz * 0.66, active ? 1 : 0.7);
        ui.text(name, x + isz / 2, iy + isz + 2 * u, 16, col);
        x += isz;
      };
      cell(d.icon, d.name, '#fff4d6', !!own);
      ui.text('+', x + 22 * u, iy + isz / 2, 34, C.gold);
      x += 44 * u;
      cell(PASSIVES[d.evoPassive].icon, PASSIVES[d.evoPassive].name, '#fff4d6', b.passiveLv(d.evoPassive) > 0);
      ui.text('→', x + 26 * u, iy + isz / 2, 34, C.gold);
      x += 52 * u;
      cell(d.evoIcon, '', '#fff', !!own?.evo);
      const tx = x + 20 * u;
      ui.text(link ? link.name : d.evoName, tx, iy + 20 * u, 28, link ? '#fee761' : '#fff4d6', 'left');
      const sub = link ? '★' + b.hero.name + '专属联动' : d.hero ? '★专属武器' : own?.evo ? '已进化' : own ? `已拥有 Lv.${own.lv}` : '';
      ui.text(sub, tx, iy + 60 * u, 20, link || d.hero ? '#feae34' : '#9be37a', 'left');
    });
    ui.endScroll();
  }
}
