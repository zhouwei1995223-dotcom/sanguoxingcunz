import { game, Dialog } from '../game';
import { getPlatform } from '../platform';
import { C, UI } from '../ui/ui';
import { dialogFrame, rewardEntries, RewardEntry } from '../ui/widgets';
import { save, flushSave } from '../meta/save';
import { spendStamina } from '../meta/ops';
import {
  metric, goalDone, claimAch, newbieDay, newbieDone, claimNewbie, claimNewbiePrize, codexEntries, CodexKind, claimCodexAll,
  codexUnclaimed, currentWeekly, achRedDot,
} from '../meta/goals';
import { ACHIEVEMENTS, NEWBIE_DAYS, NEWBIE_PRIZES, NEWBIE_WINDOW_DAYS, WEEKLY_TIERS, WEEKLY_DURATION, GoalDef } from '../data/goals';
import { STAMINA } from '../data/meta';
import { fmtNum, fmtTime } from '../core/math';
import { playSfx } from '../audio/sound';
import { RewardDialog, StaminaDialog } from './homeDialogs';
import { BattleScene } from './battleScene';

/** 一行奖励小图标（横向） */
function miniRewards(ui: UI, entries: RewardEntry[], x: number, y: number, size: number) {
  const u = ui.u;
  entries.slice(0, 3).forEach((e, i) => {
    const ix = x + i * (size + 8 * u);
    ui.qualityFrame(ix, y, size, e.frame || '#8b9bb4');
    ui.icon(e.icon, ix + size / 2, y + size / 2, size * 0.6);
    if (e.count) ui.text(e.count, ix + size - 4 * u, y + size - 10 * u, 16, '#fff', 'right');
  });
}

function goalRow(ui: UI, id: string, g: GoalDef, x: number, y: number, w: number, h: number, claimed: boolean, locked: boolean, onClaim: () => void) {
  const u = ui.u;
  const v = metric(g.metric);
  const done = v >= g.target;
  ui.pixRect(x, y, w, h, claimed ? '#2a2020' : '#4a3630');
  ui.text(g.name, x + 24 * u, y + 32 * u, 24, claimed ? '#888' : '#fff4d6', 'left');
  const fmt = (n: number) => (g.metric === 'endlessBest' ? fmtTime(n) : fmtNum(n));
  ui.bar(x + 24 * u, y + 58 * u, 220 * u, 20 * u, v / g.target, '#63c74d');
  ui.text(`${fmt(Math.min(v, g.target))}/${fmt(g.target)}`, x + 134 * u, y + 68 * u, 14, '#fff');
  miniRewards(ui, rewardEntries(g.reward), x + 270 * u, y + 14 * u, h - 28 * u);
  const bw = 130 * u, bx = x + w - bw - 16 * u;
  if (claimed) ui.text('已领取', bx + bw / 2, y + h / 2, 22, '#9be37a');
  else if (locked) ui.text('未开放', bx + bw / 2, y + h / 2, 20, '#888');
  else if (done) { if (ui.button(id, bx, y + 14 * u, bw, h - 28 * u, '领取', C.btnGold, { size: 24 })) onClaim(); }
  else ui.text('进行中', bx + bw / 2, y + h / 2, 20, C.textDim);
}

// —— 新手七日目标 ——
export class NewbieDialog implements Dialog {
  t?: number;
  private day = Math.min(7, newbieDay());
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 40 * u, h = ui.H - 240 * u - ui.safeTop;
    const f = dialogFrame(ui, w, h, '七日目标', this.t, 'nb_close');
    if (f.close) return false;
    const today = newbieDay();
    ui.text(`开放至第${NEWBIE_WINDOW_DAYS}天 · 今天是第${Math.min(today, NEWBIE_WINDOW_DAYS)}天`, ui.W / 2, f.y + 70 * u, 20, C.textDim);
    // 大奖进度
    const done = newbieDone();
    const by = f.y + 110 * u;
    ui.text(`已完成 ${done}/21`, f.x + 40 * u, by, 24, C.gold, 'left');
    const pw = (w - 80 * u) / NEWBIE_PRIZES.length;
    NEWBIE_PRIZES.forEach((p, i) => {
      const x = f.x + 40 * u + i * pw;
      const can = done >= p.need && !save.newbiePrizes[i];
      const got = save.newbiePrizes[i];
      ui.pixRect(x + 6 * u, by + 26 * u, pw - 12 * u, 120 * u, can ? '#7a5030' : '#231917');
      const e = rewardEntries(p.reward)[0];
      ui.icon(e.icon, x + pw / 2, by + 70 * u, 60 * u, got ? 0.4 : 1);
      ui.text(`${p.need}个 · ${p.label}`, x + pw / 2, by + 126 * u, 18, got ? '#888' : '#fff4d6');
      if (can) ui.redDot(x + pw - 14 * u, by + 34 * u);
      if (ui.clicked('nb_prize_' + i, x, by + 26 * u, pw, 120 * u)) {
        const g = claimNewbiePrize(i);
        if (g) { game.openDialog(new RewardDialog('七日大奖', g)); flushSave(true); }
        else ui.toast(got ? '已领取' : `完成${p.need}个目标可领取`);
      }
    });
    // 天数页签
    const ty = by + 170 * u;
    const tw = (w - 60 * u) / 7;
    for (let d = 1; d <= 7; d++) {
      const x = f.x + 30 * u + (d - 1) * tw;
      const open = d <= today;
      const on = this.day === d;
      ui.pixRect(x + 3 * u, ty, tw - 6 * u, 60 * u, on ? '#feae34' : open ? '#5a4038' : '#231917');
      ui.text(`第${d}天`, x + tw / 2, ty + 30 * u, 20, on ? '#1a1210' : open ? '#fff4d6' : '#666', 'center', null);
      const dot = open && NEWBIE_DAYS[d - 1].some((g) => !save.newbieClaimed[g.id] && goalDone(g));
      if (dot) ui.redDot(x + tw - 10 * u, ty + 4 * u);
      if (ui.clicked('nb_day_' + d, x, ty, tw, 60 * u)) this.day = d;
    }
    // 目标列表
    let y = ty + 80 * u;
    const locked = this.day > today;
    for (const g of NEWBIE_DAYS[this.day - 1]) {
      goalRow(ui, 'nb_' + g.id, g, f.x + 30 * u, y, w - 60 * u, 110 * u, !!save.newbieClaimed[g.id], locked, () => {
        const r = claimNewbie(g);
        if (r) { playSfx('coin'); game.openDialog(new RewardDialog('目标奖励', r)); flushSave(true); }
      });
      y += 122 * u;
    }
    if (locked) ui.text(`第${this.day}天开放`, ui.W / 2, y + 20 * u, 22, '#ff8a80');
  }
}

// —— 图鉴与成就 ——
type CodexTab = 'ach' | CodexKind;
const CODEX_TABS: { id: CodexTab; name: string }[] = [
  { id: 'ach', name: '成就' },
  { id: 'bosses', name: '敌将' },
  { id: 'enemies', name: '兵种' },
  { id: 'weapons', name: '神兵' },
];

export class CodexDialog implements Dialog {
  t?: number;
  private tab: CodexTab = 'ach';
  draw(ui: UI) {
    const u = ui.u;
    const w = ui.W - 40 * u, h = ui.H - 240 * u - ui.safeTop;
    const f = dialogFrame(ui, w, h, '图鉴', this.t, 'cx_close');
    if (f.close) return false;
    const tw = (w - 60 * u) / CODEX_TABS.length;
    CODEX_TABS.forEach((tb, i) => {
      const x = f.x + 30 * u + i * tw, y = f.y + 66 * u;
      const on = this.tab === tb.id;
      ui.pixRect(x + 4 * u, y, tw - 8 * u, 60 * u, on ? '#feae34' : '#231917');
      ui.text(tb.name, x + tw / 2, y + 30 * u, 24, on ? '#1a1210' : '#fff4d6', 'center', null);
      const dot = tb.id === 'ach' ? achRedDot() : codexEntries(tb.id).some((e) => e.count > 0 && !save.codexClaimed[tb.id + ':' + e.id]);
      if (dot) ui.redDot(x + tw - 12 * u, y + 6 * u);
      if (ui.clicked('cx_tab_' + tb.id, x, y, tw, 60 * u)) this.tab = tb.id;
    });
    const top = f.y + 140 * u;
    const vh = f.y + h - top - 30 * u;
    if (this.tab === 'ach') this.drawAch(ui, f.x, top, w, vh);
    else this.drawCodex(ui, this.tab, f.x, top, w, vh);
  }

  private drawAch(ui: UI, fx: number, top: number, w: number, vh: number) {
    const u = ui.u;
    // 可领取的排前面，已领取的排最后
    const list = ACHIEVEMENTS.slice().sort((a, b) => rank(a) - rank(b));
    function rank(a: GoalDef) { return save.achClaimed[a.id] ? 2 : goalDone(a) ? 0 : 1; }
    const rowH = 110 * u;
    const off = ui.beginScroll('ach', fx + 20 * u, top, w - 40 * u, vh, list.length * (rowH + 10 * u));
    list.forEach((a, i) => {
      const y = top + i * (rowH + 10 * u) + off;
      if (y < top - rowH || y > top + vh) return;
      goalRow(ui, 'ach_' + a.id, a, fx + 30 * u, y, w - 60 * u, rowH, !!save.achClaimed[a.id], false, () => {
        const r = claimAch(a);
        if (r) { playSfx('coin'); game.openDialog(new RewardDialog('成就奖励', r)); flushSave(true); }
      });
    });
    ui.endScroll();
  }

  private drawCodex(ui: UI, kind: CodexKind, fx: number, top: number, w: number, vh: number) {
    const u = ui.u;
    const list = codexEntries(kind);
    const lit = list.filter((e) => e.count > 0).length;
    ui.text(`已点亮 ${lit}/${list.length}`, fx + 40 * u, top + 10 * u, 22, C.gold, 'left');
    const n = codexUnclaimed();
    if (ui.button('cx_claim', fx + w - 260 * u, top - 14 * u, 220 * u, 56 * u, n ? `一键领取(${n})` : '暂无奖励', n ? C.btnGold : C.btnGray, { size: 20, disabled: !n })) {
      const yb = claimCodexAll();
      if (yb) { playSfx('coin'); ui.toast(`点亮奖励：元宝+${yb}`); flushSave(true); }
    }
    const cols = 4, cell = (w - 60 * u) / cols;
    const gy = top + 50 * u;
    const off = ui.beginScroll('codex_' + kind, fx + 20 * u, gy, w - 40 * u, vh - 50 * u, Math.ceil(list.length / cols) * (cell + 40 * u));
    list.forEach((e, i) => {
      const x = fx + 30 * u + (i % cols) * cell;
      const y = gy + Math.floor(i / cols) * (cell + 40 * u) + off;
      if (y < gy - cell - 40 * u || y > gy + vh) return;
      const on = e.count > 0;
      ui.qualityFrame(x + 6 * u, y, cell - 12 * u, on ? (kind === 'bosses' ? '#e43b44' : kind === 'weapons' ? '#feae34' : '#5a6988') : '#2a2030');
      ui.icon(e.sprite.replace(/^icon_/, ''), x + cell / 2, y + (cell - 12 * u) / 2, (cell - 12 * u) * 0.78, on ? 1 : 0.15);
      ui.text(on ? e.name : '？？？', x + cell / 2, y + cell + 6 * u, 18, on ? '#fff4d6' : '#666');
      if (on) ui.text(kind === 'weapons' ? `进化${e.count}次` : `×${fmtNum(e.count)}`, x + cell - 14 * u, y + cell - 26 * u, 14, '#fff', 'right');
      if (on && !save.codexClaimed[kind + ':' + e.id]) ui.redDot(x + cell - 14 * u, y + 8 * u);
    });
    ui.endScroll();
  }
}

// —— 每周挑战 ——
export class WeeklyDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const u = ui.u;
    const wk = currentWeekly();
    const w = ui.W - 60 * u, h = 960 * u;
    const f = dialogFrame(ui, w, h, '每周挑战', this.t, 'wk_close');
    if (f.close) return false;
    let y = f.y + 90 * u;
    ui.text(wk.name, ui.W / 2, y, 48, '#dc9be9', 'center', '#2a0d30');
    y += 60 * u;
    ui.text(wk.desc, ui.W / 2, y, 24, '#fff4d6');
    y += 46 * u;
    ui.text(`坚守 ${fmtTime(WEEKLY_DURATION)}，击败敌人越多奖励越好 · 每周一更换`, ui.W / 2, y, 20, C.textDim);
    y += 60 * u;
    ui.text(`本周最佳：击败 ${fmtNum(save.weekly.best)}`, ui.W / 2, y, 30, C.gold);
    y += 50 * u;
    WEEKLY_TIERS.forEach((tier, i) => {
      const got = !!save.weekly.claimed[i];
      ui.pixRect(f.x + 40 * u, y, w - 80 * u, 110 * u, got ? '#2a3a20' : '#4a3630');
      ui.text(`击败 ${fmtNum(tier.kills)}`, f.x + 70 * u, y + 55 * u, 26, got ? '#9be37a' : '#fff4d6', 'left');
      miniRewards(ui, rewardEntries(tier.reward), f.x + 280 * u, y + 15 * u, 80 * u);
      ui.text(got ? '已获得' : '未达成', f.x + w - 70 * u, y + 55 * u, 22, got ? '#9be37a' : C.textDim, 'right');
      y += 124 * u;
    });
    y += 20 * u;
    const bw = 420 * u;
    if (ui.button('wk_start', ui.W / 2 - bw / 2, y, bw, 120 * u, '开始挑战', C.btnPurple, { size: 40, sub: `消耗体力 ${STAMINA.costPerRun}` })) {
      if (!spendStamina()) { game.openDialog(new StaminaDialog()); return; }
      flushSave(true);
      playSfx('boss');
      getPlatform().report('weekly_start', { id: wk.id });
      game.setScene(new BattleScene(-1));
      return false;
    }
  }
}
