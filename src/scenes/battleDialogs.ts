import { game, Dialog } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { dialogFrame, adButton, rewardRow, rewardEntries } from '../ui/widgets';
import type { BattleScene } from './battleScene';
import { choiceInfo } from './battleScene';
import type { Choice } from '../battle/battle';
import { WEAPONS, PASSIVES, MAX_WEAPON_LV, MAX_PASSIVE_LV } from '../data/skills';
import type { BossDef } from '../data/enemies';
import { save, markDirty, flushSave } from '../meta/save';
import { settleRun, RunResult } from '../meta/run';
import { progressTask } from '../meta/ops';
import { playSfx, playBgm, refreshMusic } from '../audio/sound';
import { fmtTime, easeOutBack, fmtNum } from '../core/math';
import { HomeScene } from './homeScene';
import { guidePointer } from '../ui/guide';

const LEVELUP_AD_LIMIT = 5;

/** 技能卡片 */
function choiceCard(ui: UI, id: string, c: Choice, x: number, y: number, w: number, h: number, highlight = false): boolean {
  const u = ui.u;
  const info = choiceInfo(c);
  const pressed = ui.isPressed(id);
  const off = pressed ? 4 * u : 0;
  const border = info.evo ? '#feae34' : info.isNew ? '#2ce8f5' : '#c89b5c';
  ui.pixRect(x, y + off, w, h, '#120d0c');
  ui.pixRect(x + 4 * u, y + 4 * u + off, w - 8 * u, h - 8 * u, border);
  ui.pixRect(x + 8 * u, y + 8 * u + off, w - 16 * u, h - 16 * u, info.evo ? '#5a3a14' : '#3a2c2a');
  if (highlight) {
    ui.ctx.globalAlpha = 0.15 + 0.1 * Math.sin(ui.time * 6);
    ui.pixRect(x + 8 * u, y + 8 * u + off, w - 16 * u, h - 16 * u, '#fee761');
    ui.ctx.globalAlpha = 1;
  }
  const isz = h - 40 * u;
  ui.qualityFrame(x + 20 * u, y + 20 * u + off, isz, border);
  ui.icon(info.icon, x + 20 * u + isz / 2, y + 20 * u + isz / 2 + off, isz * 0.66);
  const tx = x + 40 * u + isz;
  ui.text(info.name, tx, y + 42 * u + off, 32, info.evo ? '#fee761' : '#fff4d6', 'left');
  let tagX = tx + ui.measure(info.name, 32) + 14 * u;
  if (info.isNew) { ui.pixRect(tagX, y + 26 * u + off, 60 * u, 32 * u, '#0099db'); ui.text('新', tagX + 30 * u, y + 42 * u + off, 20, '#fff', 'center', null); tagX += 70 * u; }
  if (info.evo) { ui.pixRect(tagX, y + 26 * u + off, 80 * u, 32 * u, '#e43b44'); ui.text('进化', tagX + 40 * u, y + 42 * u + off, 20, '#fff', 'center', null); }
  // 等级星
  if (info.max) {
    for (let i = 0; i < info.max; i++) {
      const sx = x + w - 30 * u - (info.max - i) * 26 * u, sy = y + 30 * u + off;
      ui.pixRect(sx, sy, 20 * u, 20 * u, i < info.lv ? (i === info.lv - 1 ? '#fee761' : '#feae34') : '#231917', 4 * u);
    }
  }
  ui.wrapText(info.desc, tx, y + 64 * u + off, w - (tx - x) - 24 * u, 24, '#d9c6a0');
  return ui.clicked(id, x, y, w, h);
}

export class LevelUpDialog implements Dialog {
  constructor(private scene: BattleScene, private choices: Choice[]) {}
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const t = this.t || 0;
    ui.ribbon(ui.W / 2, ui.H * 0.2, 420 * u, `升级！Lv.${b.level}`, '#3e8948');
    ui.text('选择一项强化', ui.W / 2, ui.H * 0.2 + 64 * u, 26, C.textDim);
    const cw = ui.W - 70 * u, ch = 190 * u;
    let y = ui.H * 0.2 + 110 * u;
    for (let i = 0; i < this.choices.length; i++) {
      const k = Math.max(0, Math.min(1, (t - i * 0.07) * 5));
      const x = ui.W / 2 - cw / 2 + (1 - easeOutBack(k)) * ui.W;
      if (choiceCard(ui, 'lv_choice_' + i, this.choices[i], x, y, cw, ch, save.guide === 0 && i === 0 && b.level === 2) && t > 0.25) {
        this.scene.choose(this.choices[i]);
        return false;
      }
      y += ch + 20 * u;
    }
    // 刷新
    const bw = 300 * u, bh = 92 * u;
    y += 10 * u;
    if (b.rerolls > 0) {
      if (ui.button('lv_reroll', ui.W / 2 - bw / 2, y, bw, bh, `刷新(${b.rerolls})`, C.btnBlue)) {
        b.rerolls--;
        this.choices = b.rollChoices();
        this.t = 0.2;
      }
    } else {
      const left = LEVELUP_AD_LIMIT - save.daily.levelupAds;
      if (adButton(ui, 'lv_reroll_ad', ui.W / 2 - bw / 2, y, bw, bh, '刷新', { disabled: left <= 0, sub: `今日剩余${Math.max(0, left)}次` })) {
        getPlatform().showRewardedAd('levelup_reroll').then((ok) => {
          if (!ok) return;
          save.daily.levelupAds++;
          progressTask('ad', 1);
          this.choices = b.rollChoices();
          this.t = 0.2;
        });
      }
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
    ui.ribbon(ui.W / 2, cy - 180 * u, 380 * u, hasEvo ? '神兵进化！' : '获得宝物', hasEvo ? '#c96d17' : '#a22633');
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
    ui.text(`第${b.chapter.id}章 ${b.chapter.name}   ${fmtTime(b.t)}   击败 ${fmtNum(b.kills)}`, ui.W / 2, y, 24, C.textDim);
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
      ui.text(`${ps.lv}/${MAX_PASSIVE_LV}`, ix + isz / 2, y + isz + 18 * u, 18, '#fff');
    });
    if (!b.passives.length) ui.text('尚未习得兵法', x, y + 30 * u, 22, C.textDim, 'left');
    y += isz + 56 * u;
    // 进化提示
    ui.text('进化秘诀：武器满级 + 对应兵法，开启宝箱即可进化', ui.W / 2, y, 20, '#9be37a');
    y += 50 * u;
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
    const tw = (w - 100 * u) / 2;
    if (ui.button('p_music', x, y, tw, 76 * u, '音乐:' + (save.settings.music ? '开' : '关'), C.btnGray, { size: 24 })) { save.settings.music = !save.settings.music; refreshMusic(); markDirty(); }
    if (ui.button('p_sfx', x + tw + 20 * u, y, tw, 76 * u, '音效:' + (save.settings.sfx ? '开' : '关'), C.btnGray, { size: 24 })) { save.settings.sfx = !save.settings.sfx; markDirty(); }
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
    ui.text('赵云力竭倒地……是否再战？', ui.W / 2, f.y + 110 * u, 30, '#fff4d6');
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
  private doubled = false;
  private busy = false;
  t?: number;
  constructor(private scene: BattleScene, private win: boolean) {
    const b = scene.battle;
    this.res = settleRun(b.chapter, win, b.t, b.coins, b.kills, b.bossKills, b.equipDrops);
    if (save.guide === 0) save.guide = 1;
    markDirty();
    flushSave(true);
  }
  draw(ui: UI) {
    const u = ui.u;
    const b = this.scene.battle;
    const t = this.t || 0;
    const w = ui.W - 60 * u, h = 1100 * u;
    const f = dialogFrame(ui, w, h, this.win ? '大获全胜' : '战斗结束', t);
    let y = f.y + 90 * u;
    if (this.win) ui.text(this.res.firstClear ? '首次通关！' : '凯旋而归', ui.W / 2, y, 34, C.gold);
    else ui.text(b.t >= b.chapter.duration * 0.5 ? '虽败犹荣' : '胜败乃兵家常事', ui.W / 2, y, 30, '#fff4d6');
    y += 60 * u;
    ui.text(`第${b.chapter.id}章 · ${b.chapter.name}`, ui.W / 2, y, 26, C.textDim);
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
    const entries = rewardEntries({ gold: this.res.gold * mul, iron: this.res.iron * mul, yuanbao: this.res.yuanbao }, this.res.items);
    rewardRow(ui, entries, ui.W / 2, y, 110 * u, t);
    y += entries.length > 4 ? 380 * u : 210 * u;
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
    if (ui.button('res_ok', bx, y, bw, 96 * u, this.doubled ? '收下' : '直接领取', this.doubled ? C.btnGold : C.btnGray) && t > 0.6) {
      // 非首局且未看广告时偶尔展示插屏
      if (!this.doubled && save.stats.runs > 2 && save.stats.runs % 2 === 0) getPlatform().showInterstitialAd();
      playBgm('bgm_home');
      game.setScene(new HomeScene());
      return false;
    }
  }
}
