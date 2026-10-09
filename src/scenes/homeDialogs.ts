import { game, Dialog } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { dialogFrame, adButton, rewardRow, rewardEntries, itemSlot, RewardEntry } from '../ui/widgets';
import { save, markDirty, flushSave, staminaNextSeconds } from '../meta/save';
import type { EquipItem } from '../meta/save';
import {
  canSignin, signinIndex, doSignin, GrantResult, claimTask, activityPoints, claimActivityBox, patrolPending, patrolReward,
  collectPatrol, itemStats, isEquipped, equip, unequip, upgradeItem, mergeCandidates, mergeItem, grantReward, progressTask,
} from '../meta/ops';
import {
  SIGNIN, DAILY_TASKS, ACTIVITY_REWARDS, PATROL, EQUIP_BY_ID, QUALITY_NAMES, QUALITY_COLORS, QUALITY_MAX_LV, STAT_NAMES,
  PERCENT_STATS, StatBlock, equipUpgradeCost, STAMINA, SIDEBAR_REWARD, Reward, SLOT_NAMES,
} from '../data/meta';
import { CHAPTERS, DIFFICULTIES } from '../data/chapters';
import { isCleared, getBest, chapterOpen } from '../meta/run';
import { BOSSES } from '../data/enemies';
import { fmtNum, fmtTime, easeOutBack } from '../core/math';
import { playSfx, refreshMusic } from '../audio/sound';
import { GAME_INFO } from '../data/platformConfig';
import { USER_AGREEMENT, PRIVACY_POLICY, HEALTH_NOTICE } from '../data/texts';
import { bestScore } from '../meta/run';
import { HERO_BY_ID } from '../data/heroes';
import { setOf, redeem } from '../meta/goals';
import { getEquipped } from '../meta/ops';
import { SLOTS } from '../data/meta';
import { cloudStatus, cloudEnabled, lastSyncAt, cloudPush } from '../meta/cloud';

function statLines(s: StatBlock): string[] {
  const out: string[] = [];
  for (const k in s) {
    const key = k as keyof StatBlock;
    const v = s[key]!;
    if (!v) continue;
    out.push(`${STAT_NAMES[key]} +${PERCENT_STATS.has(key) ? Math.round(v * 10) / 10 + '%' : key === 'regen' ? v.toFixed(1) + '/秒' : Math.round(v)}`);
  }
  return out;
}

/** 通用奖励弹窗 */
export class RewardDialog implements Dialog {
  t?: number;
  private entries: RewardEntry[];
  constructor(private title: string, g: GrantResult | { reward: Reward; items: EquipItem[] }) {
    this.entries = rewardEntries(g.reward, g.items);
    playSfx('chest');
  }
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 100 * u, h = 520 * u;
    const f = dialogFrame(ui, w, h, this.title, this.t);
    rewardRow(ui, this.entries, ui.W / 2, f.y + 120 * u, 120 * u, this.t || 0);
    const bw = 300 * u;
    if (ui.button('rw_ok', ui.W / 2 - bw / 2, f.y + h - 140 * u, bw, 96 * u, '收下', C.btnGold) && (this.t || 0) > 0.4) return false;
  }
}

export class SigninDialog implements Dialog {
  t?: number;
  private busy = false;
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 60 * u, h = 860 * u;
    const f = dialogFrame(ui, w, h, '七日签到', this.t, 'si_close');
    if (f.close) return false;
    const idx = signinIndex();
    const can = canSignin();
    const cw = (w - 80 * u) / 4, ch = 200 * u;
    SIGNIN.forEach((r, i) => {
      const big = i === 6;
      const col = big ? 0 : i % 4, row = big ? 1 : Math.floor(i / 4);
      const x = f.x + 40 * u + (big ? 3 * cw : col * cw);
      const y = f.y + 90 * u + row * (ch + 20 * u);
      const done = i < idx || (i === idx && !can);
      const today = i === idx && can;
      ui.pixRect(x + 6 * u, y, cw - 12 * u, ch, today ? '#feae34' : '#120d0c');
      ui.pixRect(x + 10 * u, y + 4 * u, cw - 20 * u, ch - 8 * u, big ? '#5a3a14' : '#3a2c2a');
      ui.text(r.hero ? `第${i + 1}天·${HERO_BY_ID[r.hero].name}` : `第${i + 1}天`, x + cw / 2, y + 28 * u, 22, today ? '#fee761' : '#fff4d6');
      const e = rewardEntries(r)[0];
      ui.qualityFrame(x + cw / 2 - 45 * u, y + 52 * u, 90 * u, e.frame || '#8b9bb4');
      ui.icon(e.icon, x + cw / 2, y + 97 * u, 56 * u);
      ui.text(e.count, x + cw / 2, y + 168 * u, 22, '#fff');
      if (done) {
        ui.ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ui.ctx.fillRect(x + 10 * u, y + 4 * u, cw - 20 * u, ch - 8 * u);
        ui.text('✓', x + cw / 2, y + ch / 2, 60, '#9be37a', 'center');
      }
    });
    const by = f.y + h - 170 * u;
    const bw = (w - 120 * u) / 2;
    if (can) {
      if (ui.button('si_claim', f.x + 40 * u, by, bw, 100 * u, '签到', C.btnGold)) {
        const g = doSignin(1);
        if (g) game.openDialog(new RewardDialog('签到奖励', g));
        flushSave(true);
      }
      if (adButton(ui, 'si_double', f.x + 80 * u + bw, by, bw, 100 * u, '双倍签到') && !this.busy) {
        this.busy = true;
        getPlatform().showRewardedAd('signin_double').then((ok) => {
          this.busy = false;
          if (!ok) return;
          progressTask('ad', 1);
          const g = doSignin(2);
          if (g) game.openDialog(new RewardDialog('签到奖励×2', { reward: mulReward(g.reward, 2), items: g.items }));
          flushSave(true);
        });
      }
    } else ui.text('今日已签到，明天再来吧', ui.W / 2, by + 50 * u, 26, C.textDim);
  }
}

function mulReward(r: Reward, m: number): Reward {
  return { gold: r.gold && r.gold * m, yuanbao: r.yuanbao && r.yuanbao * m, iron: r.iron && r.iron * m, stamina: r.stamina && r.stamina * m, equip: r.equip };
}

export class TasksDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 50 * u, h = Math.min(ui.H - 200 * u, 1180 * u);
    const f = dialogFrame(ui, w, h, '每日任务', this.t, 'tk_close');
    if (f.close) return false;
    // 活跃度
    const pts = activityPoints();
    const barY = f.y + 110 * u;
    const bx = f.x + 50 * u, bw = w - 100 * u;
    ui.text(`活跃度 ${pts}`, bx, barY - 30 * u, 24, C.gold, 'left');
    ui.bar(bx, barY, bw, 24 * u, pts / 100, '#feae34');
    ACTIVITY_REWARDS.forEach((a, i) => {
      const x = bx + bw * (a.points / 100) - 36 * u;
      const y = barY + 40 * u;
      const can = pts >= a.points && !save.daily.boxes[i];
      const done = save.daily.boxes[i];
      ui.icon(a.points === 100 ? 'chest_gold' : 'chest', x + 36 * u, y + 30 * u, (can ? 70 + Math.sin(ui.time * 8) * 6 : 62) * u, done ? 0.4 : 1);
      ui.text(String(a.points), x + 36 * u, y + 76 * u, 18, '#fff');
      if (can) ui.redDot(x + 66 * u, y + 2 * u);
      if (ui.clicked('tk_box_' + i, x, y - 10 * u, 72 * u, 90 * u)) {
        const g = claimActivityBox(i);
        if (g) { game.openDialog(new RewardDialog('活跃奖励', g)); flushSave(true); }
        else ui.toast(done ? '已领取' : `活跃度达到${a.points}可领取`);
      }
    });
    // 任务列表
    const ly = barY + 150 * u;
    const lh = f.y + h - ly - 30 * u;
    const rowH = 120 * u;
    const off = ui.beginScroll('tasks', f.x + 20 * u, ly, w - 40 * u, lh, DAILY_TASKS.length * (rowH + 10 * u));
    const sorted = DAILY_TASKS.slice().sort((a, b) => rank(a) - rank(b));
    function rank(t: typeof DAILY_TASKS[number]) {
      if (save.daily.claimed[t.id]) return 2;
      return (save.daily.progress[t.id] || 0) >= t.target ? 0 : 1;
    }
    sorted.forEach((t, i) => {
      const y = ly + i * (rowH + 10 * u) + off;
      const prog = save.daily.progress[t.id] || 0;
      const done = save.daily.claimed[t.id];
      ui.pixRect(f.x + 30 * u, y, w - 60 * u, rowH, done ? '#2a2020' : '#4a3630');
      ui.text(t.name, f.x + 56 * u, y + 38 * u, 26, done ? '#888' : '#fff4d6', 'left');
      ui.bar(f.x + 56 * u, y + 70 * u, 280 * u, 22 * u, prog / t.target, '#63c74d');
      ui.text(`${fmtNum(prog)}/${fmtNum(t.target)}`, f.x + 196 * u, y + 81 * u, 16, '#fff');
      ui.text(`活跃+${t.points}`, f.x + 400 * u, y + 81 * u, 20, C.gold, 'left');
      const bw2 = 150 * u;
      const bx2 = f.x + w - 60 * u - bw2;
      if (done) ui.text('已完成', bx2 + bw2 / 2, y + rowH / 2, 24, '#9be37a');
      else if (prog >= t.target) {
        if (ui.button('tk_' + t.id, bx2, y + 20 * u, bw2, 76 * u, '领取', C.btnGold, { size: 26 })) { claimTask(t.id); playSfx('coin'); flushSave(true); }
      } else ui.text('进行中', bx2 + bw2 / 2, y + rowH / 2, 22, C.textDim);
    });
    ui.endScroll();
  }
}

export class PatrolDialog implements Dialog {
  t?: number;
  private busy = false;
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 70 * u, h = 900 * u;
    const f = dialogFrame(ui, w, h, '巡营', this.t, 'pt_close');
    if (f.close) return false;
    const p = patrolPending();
    ui.icon('tent', ui.W / 2, f.y + 170 * u, 170 * u);
    ui.text('将士们正在巡营屯田，离线也能获得收益', ui.W / 2, f.y + 290 * u, 22, C.textDim);
    ui.text(`已巡营 ${fmtTime(p.minutes * 60).replace(/^(\d+):(\d+)$/, (_, m) => Math.floor(+m / 60) + '小时' + (+m % 60) + '分')}`, ui.W / 2, f.y + 336 * u, 26, '#fff4d6');
    ui.text(`（最多累计${PATROL.maxHours}小时）`, ui.W / 2, f.y + 372 * u, 20, C.textDim);
    ui.bar(f.x + 60 * u, f.y + 396 * u, w - 120 * u, 24 * u, p.minutes / (PATROL.maxHours * 60), '#feae34');
    rewardRow(ui, rewardEntries({ gold: p.gold, iron: p.iron }), ui.W / 2, f.y + 450 * u, 110 * u);
    const bw = (w - 120 * u) / 2;
    const by = f.y + 650 * u;
    const can = p.minutes >= PATROL.minMinutes;
    if (ui.button('pt_collect', f.x + 40 * u, by, bw, 100 * u, '领取', C.btnGold, { disabled: !can })) {
      collectPatrol(1);
      playSfx('coin');
      flushSave(true);
      ui.toast(`获得金币×${fmtNum(p.gold)} 玄铁×${p.iron}`);
    }
    if (adButton(ui, 'pt_double', f.x + 80 * u + bw, by, bw, 100 * u, '双倍领取', { disabled: !can }) && !this.busy) {
      this.busy = true;
      getPlatform().showRewardedAd('patrol_double').then((ok) => {
        this.busy = false;
        if (!ok) return;
        const r = collectPatrol(2);
        progressTask('ad', 1);
        flushSave(true);
        ui.toast(`获得金币×${fmtNum(r.gold * 2)} 玄铁×${r.iron * 2}`);
      });
    }
    // 快速巡营
    const left = PATROL.quickDailyLimit - save.daily.patrolQuick;
    const q = patrolReward(PATROL.quickAdMinutes);
    if (adButton(ui, 'pt_quick', ui.W / 2 - 230 * u, by + 120 * u, 460 * u, 90 * u, `快速巡营 (${Math.max(0, left)}/${PATROL.quickDailyLimit})`, { disabled: left <= 0, size: 26 }) && !this.busy) {
      this.busy = true;
      getPlatform().showRewardedAd('patrol_quick').then((ok) => {
        this.busy = false;
        if (!ok) return;
        save.daily.patrolQuick++;
        save.gold += q.gold;
        save.iron += q.iron;
        progressTask('ad', 1);
        progressTask('patrol', 1);
        markDirty();
        flushSave(true);
        game.openDialog(new RewardDialog('快速巡营', { reward: { gold: q.gold, iron: q.iron }, items: [] }));
      });
    }
  }
}

export class StaminaDialog implements Dialog {
  t?: number;
  private busy = false;
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 100 * u, h = 640 * u;
    const f = dialogFrame(ui, w, h, '体力', this.t, 'stm_close');
    if (f.close) return false;
    ui.icon('stamina', ui.W / 2, f.y + 160 * u, 130 * u);
    ui.text(`当前体力 ${save.stamina}/${STAMINA.max}`, ui.W / 2, f.y + 270 * u, 30, '#fff4d6');
    const s = staminaNextSeconds();
    ui.text(s > 0 ? `${fmtTime(s)} 后恢复1点（每${STAMINA.regenSeconds / 60}分钟恢复1点）` : '体力已满', ui.W / 2, f.y + 316 * u, 20, C.textDim);
    const left = STAMINA.adDailyLimit - save.daily.adStamina;
    const bw = w - 140 * u;
    if (adButton(ui, 'stm_ad', ui.W / 2 - bw / 2, f.y + 370 * u, bw, 100 * u, `体力+${STAMINA.adGain}`, { disabled: left <= 0, sub: `今日剩余${Math.max(0, left)}次` }) && !this.busy) {
      this.busy = true;
      getPlatform().showRewardedAd('stamina').then((ok) => {
        this.busy = false;
        if (!ok) return;
        save.daily.adStamina++;
        save.stamina += STAMINA.adGain;
        progressTask('ad', 1);
        markDirty();
        flushSave(true);
        ui.toast(`体力+${STAMINA.adGain}`);
      });
    }
    if (ui.button('stm_buy', ui.W / 2 - bw / 2, f.y + 490 * u, bw, 90 * u, '50 元宝购买10体力', save.yuanbao >= 50 ? C.btnGold : C.btnGray, { size: 26 })) {
      if (save.yuanbao < 50) ui.toast('元宝不足');
      else { save.yuanbao -= 50; save.stamina += 10; markDirty(); ui.toast('体力+10'); }
    }
  }
}

export class ItemDialog implements Dialog {
  t?: number;
  constructor(private it: EquipItem) {}
  draw(ui: UI) {
    const u = ui.u;
    const it = this.it;
    if (!save.items.includes(it)) return false;
    const tpl = EQUIP_BY_ID[it.tid];
    const w = ui.W - 60 * u, h = 1200 * u;
    const f = dialogFrame(ui, w, h, SLOT_NAMES[tpl.slot], this.t, 'it_close');
    if (f.close) return false;
    const x = f.x + 50 * u;
    let y = f.y + 80 * u;
    itemSlot(ui, x, y, 150 * u, it);
    ui.text(tpl.name, x + 180 * u, y + 34 * u, 36, QUALITY_COLORS[it.q], 'left');
    ui.text(`${QUALITY_NAMES[it.q]}  ·  等级 ${it.lv}/${QUALITY_MAX_LV[it.q]}`, x + 180 * u, y + 84 * u, 24, '#fff4d6', 'left');
    ui.text(isEquipped(it) ? '穿戴中' : '未穿戴', x + 180 * u, y + 124 * u, 22, isEquipped(it) ? '#9be37a' : C.textDim, 'left');
    y += 190 * u;
    ui.text('属性', x, y, 26, C.gold, 'left');
    y += 36 * u;
    const st = itemStats(it);
    const base: StatBlock = {};
    for (const k in tpl.base) (base as any)[k] = (st as any)[k];
    statLines({ atk: st.atk, hp: st.hp }).forEach((l, i) => ui.text(l, x + (i % 2) * 300 * u, y + Math.floor(i / 2) * 38 * u, 24, '#fff', 'left'));
    y += 60 * u;
    ui.text('品质特效', x, y, 26, C.gold, 'left');
    y += 38 * u;
    for (const un of tpl.unlocks) {
      const on = it.q >= un.q;
      ui.text(`[${QUALITY_NAMES[un.q]}] ${un.desc}`, x, y, 22, on ? QUALITY_COLORS[un.q] : '#6a6a6a', 'left');
      y += 36 * u;
    }
    y += 10 * u;
    // 套装
    const set = setOf(it.tid);
    if (set) {
      const tids = SLOTS.map((sl) => getEquipped(sl)).filter((x) => !!x).map((x) => x!.tid);
      const n = tids.filter((t) => set.pieces.includes(t)).length;
      ui.text(`${set.name}（已穿${n}/6）`, x, y, 22, '#dc9be9', 'left');
      y += 32 * u;
      for (const b of set.bonus) { ui.text(`${b.n}件：${b.desc}`, x + 20 * u, y, 19, n >= b.n ? '#dc9be9' : '#6a6a6a', 'left'); y += 28 * u; }
      y += 6 * u;
    }
    // 合成信息
    const mats = mergeCandidates(it);
    if (it.q < 5) ui.text(`合成：3件同名${QUALITY_NAMES[it.q]}装备 → ${QUALITY_NAMES[it.q + 1]}（拥有${mats.length + 1}/3）`, x, y, 20, '#dc9be9', 'left');
    y += 50 * u;
    // 按钮
    const bw = (w - 140 * u) / 3, bh = 96 * u;
    const by = f.y + h - bh - 50 * u;
    const eq = isEquipped(it);
    if (ui.button('it_equip', f.x + 40 * u, by, bw, bh, eq ? '卸下' : '穿戴', eq ? C.btnGray : C.btnBlue, { size: 28 })) {
      if (eq) unequip(tpl.slot); else equip(it);
      playSfx('click');
      flushSave(true);
    }
    const cost = equipUpgradeCost(it.lv);
    const maxed = it.lv >= QUALITY_MAX_LV[it.q];
    if (ui.button('it_up', f.x + 70 * u + bw, by, bw, bh, maxed ? '已满级' : '强化', C.btnGold, { size: 28, disabled: maxed, sub: maxed ? undefined : `${fmtNum(cost.gold)}金 ${cost.iron}铁` })) {
      const err = upgradeItem(it);
      if (err) ui.toast(err); else { playSfx('levelup'); flushSave(true); }
    }
    if (ui.button('it_merge', f.x + 100 * u + bw * 2, by, bw, bh, '合成', C.btnPurple, { size: 28, disabled: mats.length < 2 || it.q >= 5 })) {
      const err = mergeItem(it);
      if (err) ui.toast(err); else { playSfx('evolve'); ui.toast(`合成成功！品质提升为${QUALITY_NAMES[it.q]}`); flushSave(true); }
    }
    ui.text(`玄铁 ${fmtNum(save.iron)}   金币 ${fmtNum(save.gold)}`, ui.W / 2, by - 30 * u, 20, C.textDim);
  }
}

export class ChestResultDialog implements Dialog {
  t?: number;
  constructor(private it: EquipItem, private gold: boolean, private shards?: { hero: string; n: number }) { playSfx('chest'); }
  draw(ui: UI) {
    const u = ui.u;
    const t = this.t || 0;
    const cy = ui.H * 0.4;
    if (t < 0.9) {
      const sh = Math.sin(t * 50) * 10 * u * t;
      ui.icon(this.gold ? 'chest_gold' : 'chest', ui.W / 2 + sh, cy, 240 * u);
      return;
    }
    const tpl = EQUIP_BY_ID[this.it.tid];
    const col = QUALITY_COLORS[this.it.q];
    ui.ctx.save();
    ui.ctx.translate(ui.W / 2, cy);
    ui.ctx.rotate(t * 0.6);
    ui.ctx.fillStyle = col;
    ui.ctx.globalAlpha = 0.25;
    for (let i = 0; i < 10; i++) {
      ui.ctx.rotate(Math.PI / 5);
      ui.ctx.beginPath(); ui.ctx.moveTo(0, 0); ui.ctx.lineTo(-50 * u, -460 * u); ui.ctx.lineTo(50 * u, -460 * u); ui.ctx.fill();
    }
    ui.ctx.restore();
    ui.ctx.globalAlpha = 1;
    const k = easeOutBack(Math.min(1, (t - 0.9) * 3));
    const s = 220 * u * k;
    itemSlot(ui, ui.W / 2 - s / 2, cy - s / 2, s, this.it);
    ui.text(tpl.name, ui.W / 2, cy + 170 * u, 44, col);
    ui.text(`${QUALITY_NAMES[this.it.q]} · ${SLOT_NAMES[tpl.slot]}`, ui.W / 2, cy + 226 * u, 28, '#fff4d6');
    statLines(itemStats(this.it)).slice(0, 3).forEach((l, i) => ui.text(l, ui.W / 2, cy + 280 * u + i * 40 * u, 24, '#d9c6a0'));
    if (this.shards) {
      const sy = cy - 260 * u;
      ui.qualityFrame(ui.W / 2 - 180 * u, sy - 50 * u, 100 * u, '#b55088');
      ui.icon(`hero_${this.shards.hero}_0`, ui.W / 2 - 130 * u, sy, 90 * u);
      ui.text(`${HERO_BY_ID[this.shards.hero].name}碎片 ×${this.shards.n}`, ui.W / 2 - 60 * u, sy, 28, '#dc9be9', 'left');
    }
    const bw = 300 * u;
    if (t > 1.3 && ui.button('cr_ok', ui.W / 2 - bw / 2, cy + 420 * u, bw, 96 * u, '确定', C.btnGold)) return false;
  }
}

export class SettingsDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 80 * u, h = 1220 * u;
    const f = dialogFrame(ui, w, h, '设置', this.t, 'st_close');
    if (f.close) return false;
    const toggles: [string, keyof typeof save.settings][] = [['背景音乐', 'music'], ['音效', 'sfx'], ['震动', 'vibrate'], ['伤害数字', 'dmgNum']];
    let y = f.y + 100 * u;
    for (const [name, key] of toggles) {
      ui.text(name, f.x + 60 * u, y + 40 * u, 28, '#fff4d6', 'left');
      const on = save.settings[key];
      if (ui.button('st_' + key, f.x + w - 220 * u, y, 160 * u, 80 * u, on ? '开' : '关', on ? C.btnGreen : C.btnGray, { size: 28 })) {
        save.settings[key] = !on;
        if (key === 'music') refreshMusic();
        markDirty();
        flushSave(true);
      }
      y += 100 * u;
    }
    y += 10 * u;
    const bw = (w - 140 * u) / 2;
    if (ui.button('st_agree', f.x + 40 * u, y, bw, 80 * u, '用户协议', C.btnBlue, { size: 24 })) game.openDialog(new TextDialog('用户协议', USER_AGREEMENT));
    if (ui.button('st_privacy', f.x + 100 * u + bw, y, bw, 80 * u, '隐私政策', C.btnBlue, { size: 24 })) game.openDialog(new TextDialog('隐私政策', PRIVACY_POLICY));
    y += 100 * u;
    if (ui.button('st_health', f.x + 40 * u, y, bw, 80 * u, '健康游戏忠告', C.btnBlue, { size: 22 })) game.openDialog(new TextDialog('健康游戏忠告', HEALTH_NOTICE));
    if (getPlatform().supportsAddShortcut() && ui.button('st_shortcut', f.x + 100 * u + bw, y, bw, 80 * u, '添加到桌面', C.btnGreen, { size: 22 })) {
      getPlatform().addShortcut().then((ok) => ui.toast(ok ? '添加成功' : '添加失败'));
    }
    y += 100 * u;
    // 兑换码 / 提醒
    if (ui.button('st_redeem', f.x + 40 * u, y, bw, 80 * u, '兑换码', C.btnGold, { size: 24 })) {
      getPlatform().inputText('请输入兑换码').then((code) => {
        if (code === null) return;
        const r = redeem(code);
        if (r.ok && r.result) { game.openDialog(new RewardDialog('兑换成功', r.result)); flushSave(true); }
        else ui.toast(r.msg);
      });
    }
    if (ui.button('st_sub', f.x + 100 * u + bw, y, bw, 80 * u, save.subscribed ? '提醒已开启' : '体力满提醒', save.subscribed ? C.btnGray : C.btnGreen, { size: 22 })) {
      getPlatform().requestSubscribe().then((ok) => {
        save.subscribed = ok;
        markDirty();
        ui.toast(ok ? '体力回满、巡营满仓时会提醒你' : '未开启提醒');
      });
    }
    y += 110 * u;
    // 云存档状态
    const cs = !cloudEnabled() ? '未开启（进度仅保存在本机）' : cloudStatus === 'ok' ? `已同步 ${lastSyncAt ? new Date(lastSyncAt).toTimeString().slice(0, 5) : ''}` : cloudStatus === 'syncing' ? '同步中…' : '同步失败，稍后重试';
    ui.text('云存档：' + cs, f.x + 60 * u, y + 20 * u, 22, cloudEnabled() && cloudStatus === 'ok' ? '#9be37a' : C.textDim, 'left');
    if (cloudEnabled() && ui.button('st_sync', f.x + w - 220 * u, y - 10 * u, 160 * u, 60 * u, '立即同步', C.btnBlue, { size: 20 })) cloudPush(true);
    y += 90 * u;
    ui.text(`${GAME_INFO.name}  v${GAME_INFO.version}`, ui.W / 2, y, 22, C.textDim);
    ui.text(GAME_INFO.copyright, ui.W / 2, y + 36 * u, 18, C.textDim);
    ui.text(GAME_INFO.icp, ui.W / 2, y + 66 * u, 18, C.textDim);
    ui.text(`适龄提示：${GAME_INFO.ageRating}+`, ui.W / 2, y + 96 * u, 18, C.textDim);
  }
}

export class TextDialog implements Dialog {
  t?: number;
  constructor(private title: string, private body: string, private onClose?: () => void) {}
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 60 * u, h = ui.H - 260 * u - ui.safeTop;
    const f = dialogFrame(ui, w, h, this.title, this.t, 'tx_close');
    if (f.close) { this.onClose && this.onClose(); return false; }
    const lines = ui.wrapLines(this.body, w - 120 * u, 22);
    const lh = 22 * u * 1.55;
    const top = f.y + 70 * u;
    const vh = h - 110 * u;
    const off = ui.beginScroll('text_' + this.title, f.x + 30 * u, top, w - 60 * u, vh, lines.length * lh + 20 * u);
    ui.pixRect(f.x + 30 * u, top, w - 60 * u, Math.max(vh, lines.length * lh + 20 * u), '#ead4aa');
    lines.forEach((l, i) => {
      const y = top + 10 * u + i * lh + off;
      if (y < top - lh || y > top + vh) return;
      ui.text(l, f.x + 60 * u, y + lh / 2, 22, '#3e2731', 'left', null, false);
    });
    ui.endScroll();
  }
}

export class RankDialog implements Dialog {
  t?: number;
  private key: 'score' | 'endless' = 'score';
  private requested = false;
  draw(ui: UI) {
    const u = ui.u;
    const p = getPlatform();
    const w = ui.W - 60 * u, h = ui.H - 300 * u - ui.safeTop;
    const f = dialogFrame(ui, w, h, '排行榜', this.t, 'rk_close');
    if (f.close) { p.postToOpenData({ type: 'hide' }); return false; }
    const score = bestScore();
    const ch = Math.floor(score / 10000), sec = score % 10000;
    ui.text(`我的最佳：${ch >= 1 ? `通关第${ch}章` : '未通关'}${sec ? ` · 第${Math.min(5, ch + 1)}章坚守${fmtTime(sec)}` : ''}`, ui.W / 2, f.y + 80 * u, 22, C.gold);
    if (p.name === 'wx') {
      const shared = p.getSharedCanvas();
      const tbw = 200 * u;
      (['score', 'endless'] as const).forEach((k, i) => {
        if (ui.button('rk_tab_' + k, ui.W / 2 - tbw - 10 * u + i * (tbw + 20 * u), f.y + 110 * u, tbw, 64 * u, k === 'score' ? '闯关榜' : '无尽榜', this.key === k ? C.btnGold : C.btnGray, { size: 24 })) { this.key = k; this.requested = false; }
      });
      if (!this.requested) {
        this.requested = true;
        if (shared) { shared.width = Math.round(w - 80 * u); shared.height = Math.round(h - 280 * u); }
        p.postToOpenData({ type: 'rank', key: this.key, width: Math.round(w - 80 * u), height: Math.round(h - 280 * u) });
      }
      if (shared) ui.ctx.drawImage(shared, f.x + 40 * u, f.y + 200 * u);
    } else if (p.name === 'tt') {
      ui.text('排行榜由抖音提供', ui.W / 2, f.y + 200 * u, 24, '#fff4d6');
      if (ui.button('rk_open', ui.W / 2 - 180 * u, f.y + 260 * u, 360 * u, 96 * u, '查看好友排行', C.btnGold)) p.showNativeRank();
    } else {
      // 浏览器：展示本地战绩
      let y = f.y + 130 * u;
      ui.text(`无尽模式最佳：${save.endlessBest ? fmtTime(save.endlessBest) : '—'}`, ui.W / 2, y, 26, '#dc9be9');
      y += 40 * u;
      for (const df of DIFFICULTIES) {
        let n = 0;
        for (const c of CHAPTERS) if (isCleared(df.id, c.id)) n++;
        ui.pixRect(f.x + 40 * u, y, w - 80 * u, 80 * u, '#4a3630');
        ui.text(`${df.name}难度`, f.x + 70 * u, y + 40 * u, 26, df.color, 'left');
        ui.text(`已通关 ${n}/${CHAPTERS.length} 章`, f.x + w - 70 * u, y + 40 * u, 24, '#fff', 'right');
        y += 94 * u;
      }
      ui.text('好友排行榜在微信 / 抖音小游戏中可用', ui.W / 2, y + 30 * u, 20, C.textDim);
    }
  }
}

export class SidebarDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const u = ui.u;
    const p = getPlatform();
    const w = ui.W - 100 * u, h = 760 * u;
    const f = dialogFrame(ui, w, h, '侧边栏奖励', this.t, 'sb_close');
    if (f.close) return false;
    ui.wrapText('从抖音「侧边栏 → 最近使用」进入游戏，每天可领取一次奖励！', f.x + 60 * u, f.y + 80 * u, w - 120 * u, 24, '#fff4d6');
    rewardRow(ui, rewardEntries(SIDEBAR_REWARD), ui.W / 2, f.y + 230 * u, 120 * u);
    const bw = w - 160 * u;
    const by = f.y + h - 160 * u;
    if (save.daily.sidebar) ui.text('今日奖励已领取', ui.W / 2, by + 48 * u, 26, '#9be37a');
    else if (p.isFromSidebar()) {
      if (ui.button('sb_claim', ui.W / 2 - bw / 2, by, bw, 100 * u, '领取奖励', C.btnGold)) {
        save.daily.sidebar = true;
        const g = grantReward(SIDEBAR_REWARD);
        flushSave(true);
        game.openDialog(new RewardDialog('侧边栏奖励', g));
        return false;
      }
    } else if (ui.button('sb_go', ui.W / 2 - bw / 2, by, bw, 100 * u, '前往侧边栏', C.btnBlue)) p.navigateToSidebar();
  }
}

export class ChapterStoryDialog implements Dialog {
  t?: number;
  constructor(private id: number, private d = 0) {}
  draw(ui: UI) {
    const u = ui.u;
    const ch = CHAPTERS[this.id - 1];
    const diff = DIFFICULTIES[this.d];
    const w = ui.W - 70 * u, h = 900 * u;
    const f = dialogFrame(ui, w, h, `第${ch.id}章 ${ch.name}`, this.t, 'cs_close');
    if (f.close) return false;
    let y = f.y + 90 * u;
    ui.pixRect(f.x + 40 * u, y, w - 80 * u, 250 * u, '#ead4aa');
    ui.wrapText(ch.story, f.x + 70 * u, y + 20 * u, w - 140 * u, 24, '#3e2731');
    y += 290 * u;
    ui.text('敌军将领', f.x + 50 * u, y, 26, C.gold, 'left');
    ui.text(`当前难度：${diff.name}（敌军生命×${diff.hp}）`, f.x + w - 50 * u, y, 20, diff.color, 'right');
    y += 30 * u;
    [ch.midBoss, ch.boss].forEach((bid, i) => {
      const b = BOSSES[bid];
      const x = f.x + 60 * u + i * (w / 2 - 40 * u);
      ui.qualityFrame(x, y, 150 * u, i ? '#e43b44' : '#feae34');
      ui.icon(`u_${b.sprite}_0_L`, x + 75 * u, y + 75 * u, 130 * u);
      ui.text(b.name, x + 180 * u, y + 50 * u, 30, '#fff4d6', 'left');
      ui.text(b.title, x + 180 * u, y + 92 * u, 20, C.textDim, 'left');
      ui.text(i ? '10:00 出现' : '05:00 出现', x + 180 * u, y + 126 * u, 18, '#ff8a80', 'left');
    });
    y += 200 * u;
    const qn = ['普通', '优良', '精良', '史诗', '传说', '神话'];
    const q = Math.min(5, [1, 2, 2, 3, 3, 3, 4, 4, 4, 5][ch.id - 1] + this.d);
    const extra = this.d === 0 && ch.id === 2 ? ' + 武将关羽' : ch.id >= 3 || this.d > 0 ? ` + 武将碎片×${10 + this.d * 5}` : '';
    ui.text(`首通奖励：元宝×${100 * ch.id * (1 + this.d)} + ${qn[q]}装备${extra}`, ui.W / 2, y, 22, isCleared(this.d, ch.id) ? '#888' : '#9be37a');
    ui.text('坚守10分钟并击败敌军主将即可通关', ui.W / 2, y + 50 * u, 22, C.textDim);
  }
}

/** 章节总览：所有章节在三个难度下的进度 */
export class ChapterListDialog implements Dialog {
  t?: number;
  constructor(private onPick: (c: number, d: number) => void) {}
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 40 * u, h = ui.H - 240 * u - ui.safeTop;
    const f = dialogFrame(ui, w, h, '章节总览', this.t, 'cl_close');
    if (f.close) return false;
    const top = f.y + 70 * u;
    const rowH = 120 * u;
    const off = ui.beginScroll('chapter_list', f.x + 20 * u, top, w - 40 * u, h - 100 * u, CHAPTERS.length * (rowH + 10 * u) + 10 * u);
    let picked = false;
    CHAPTERS.forEach((ch, i) => {
      const y = top + i * (rowH + 10 * u) + off;
      ui.pixRect(f.x + 30 * u, y, w - 60 * u, rowH, '#4a3630');
      ui.text(`${ch.id}. ${ch.name}`, f.x + 54 * u, y + 36 * u, 28, chapterOpen(ch.id, 0) ? '#fff4d6' : '#777', 'left');
      ui.text(ch.subtitle, f.x + 54 * u, y + 80 * u, 20, C.textDim, 'left');
      DIFFICULTIES.forEach((df, k) => {
        const bx = f.x + w - 60 * u - (3 - k) * 116 * u, bw = 106 * u;
        const open = chapterOpen(ch.id, df.id);
        const done = isCleared(df.id, ch.id);
        ui.pixRect(bx, y + 16 * u, bw, rowH - 32 * u, open ? (done ? df.color : '#231917') : '#1a1414');
        ui.text(df.name, bx + bw / 2, y + 44 * u, 20, done ? '#1a1210' : open ? df.color : '#555', 'center', null);
        const best = getBest(df.id, ch.id);
        ui.text(done ? '✓' : open ? (best ? fmtTime(best) : '—') : '未解锁', bx + bw / 2, y + 78 * u, 18, done ? '#1a1210' : open ? '#fff' : '#555', 'center', null);
        if (open && ui.clicked(`cl_${ch.id}_${df.id}`, bx, y + 16 * u, bw, rowH - 32 * u)) { this.onPick(ch.id, df.id); picked = true; }
      });
    });
    ui.endScroll();
    if (picked) return false;
  }
}

/** 首次进入：用户协议与隐私政策确认 */
export class PrivacyDialog implements Dialog {
  t?: number;
  constructor(private onAgree: () => void) {}
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 80 * u, h = 760 * u;
    const f = dialogFrame(ui, w, h, '温馨提示', this.t);
    ui.wrapText(`欢迎来到《${GAME_INFO.name}》！在开始游戏前，请仔细阅读《用户协议》与《隐私政策》。我们仅在本地保存您的游戏进度，不会收集您的个人敏感信息。`, f.x + 60 * u, f.y + 80 * u, w - 120 * u, 24, '#fff4d6');
    const bw = (w - 140 * u) / 2;
    if (ui.button('pv_agree_doc', f.x + 40 * u, f.y + 380 * u, bw, 80 * u, '《用户协议》', C.btnBlue, { size: 24 })) game.openDialog(new TextDialog('用户协议', USER_AGREEMENT));
    if (ui.button('pv_privacy_doc', f.x + 100 * u + bw, f.y + 380 * u, bw, 80 * u, '《隐私政策》', C.btnBlue, { size: 24 })) game.openDialog(new TextDialog('隐私政策', PRIVACY_POLICY));
    if (ui.button('pv_reject', f.x + 40 * u, f.y + h - 150 * u, bw, 96 * u, '不同意', C.btnGray)) {
      ui.toast('需要同意后才能开始游戏');
    }
    if (ui.button('pv_ok', f.x + 100 * u + bw, f.y + h - 150 * u, bw, 96 * u, '同意', C.btnGold)) {
      save.agreedPrivacy = true;
      markDirty();
      flushSave(true);
      this.onAgree();
      return false;
    }
  }
}
