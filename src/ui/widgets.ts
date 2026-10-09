import { C, UI } from './ui';
import { EQUIP_BY_ID, QUALITY_COLORS, QUALITY_NAMES, Reward } from '../data/meta';
import type { EquipItem } from '../meta/save';
import { fmtNum, easeOutBack } from '../core/math';
import { HERO_BY_ID } from '../data/heroes';

// 通用界面组件

export interface RewardEntry {
  icon: string;
  count: string;
  frame?: string;
  label?: string;
}

export function rewardEntries(r: Reward, items: EquipItem[] = []): RewardEntry[] {
  const out: RewardEntry[] = [];
  if (r.hero) out.push({ icon: `hero_${r.hero}_0`, count: '', frame: '#feae34', label: HERO_BY_ID[r.hero].name });
  if (r.shards) out.push({ icon: `hero_${r.shards.hero}_0`, count: '×' + r.shards.n, frame: '#b55088', label: HERO_BY_ID[r.shards.hero].name + '碎片' });
  if (r.gold) out.push({ icon: 'gold', count: fmtNum(r.gold), label: '金币' });
  if (r.yuanbao) out.push({ icon: 'yuanbao', count: fmtNum(r.yuanbao), label: '元宝' });
  if (r.iron) out.push({ icon: 'iron', count: fmtNum(r.iron), label: '玄铁' });
  if (r.stamina) out.push({ icon: 'stamina', count: fmtNum(r.stamina), label: '体力' });
  for (const it of items) out.push(itemEntry(it));
  if (r.equip && !items.length) out.push({ icon: 'e_weapon', count: QUALITY_NAMES[r.equip.q], frame: QUALITY_COLORS[r.equip.q], label: '随机装备' });
  return out;
}

export function itemEntry(it: EquipItem): RewardEntry {
  const t = EQUIP_BY_ID[it.tid];
  return { icon: t.icon, count: '', frame: QUALITY_COLORS[it.q], label: t.name };
}

/** 一行奖励图标，居中排列；t 用于弹出动画 */
export function rewardRow(ui: UI, entries: RewardEntry[], cx: number, y: number, size: number, t = 1) {
  const u = ui.u;
  const gap = 16 * u;
  const perRow = Math.max(1, Math.floor((ui.W - 80 * u) / (size + gap)));
  entries.forEach((e, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, entries.length - row * perRow);
    const col = i % perRow;
    const x = cx - (inRow * (size + gap) - gap) / 2 + col * (size + gap);
    const yy = y + row * (size + 56 * u);
    const k = Math.max(0, Math.min(1, (t - i * 0.08) * 4));
    if (k <= 0) return;
    const s = size * easeOutBack(k);
    const ox = x + (size - s) / 2, oy = yy + (size - s) / 2;
    ui.qualityFrame(ox, oy, s, e.frame || '#8b9bb4');
    ui.icon(e.icon, ox + s / 2, oy + s / 2, s * 0.62);
    if (e.count) ui.text(e.count, x + size - 6 * u, yy + size - 12 * u, 22, '#fff', 'right');
    if (e.label) ui.text(e.label, x + size / 2, yy + size + 20 * u, 20, e.frame || C.textDim, 'center');
  });
}

export function itemSlot(ui: UI, x: number, y: number, size: number, it: EquipItem | null, placeholder?: string, equipped = false) {
  const u = ui.u;
  if (!it) {
    ui.qualityFrame(x, y, size, '#3a3040');
    if (placeholder) ui.icon(placeholder, x + size / 2, y + size / 2, size * 0.5, 0.3);
    return;
  }
  const t = EQUIP_BY_ID[it.tid];
  ui.qualityFrame(x, y, size, QUALITY_COLORS[it.q]);
  ui.icon(t.icon, x + size / 2, y + size / 2 - 4 * u, size * 0.6);
  ui.text('Lv' + it.lv, x + size - 8 * u, y + size - 14 * u, 18, '#fff', 'right');
  if (equipped) {
    ui.pixRect(x + 4 * u, y + 4 * u, 34 * u, 26 * u, '#3e8948');
    ui.text('装', x + 21 * u, y + 17 * u, 18, '#fff', 'center', null);
  }
}

/** 弹窗面板，返回内容区左上角 */
export function dialogFrame(ui: UI, w: number, h: number, title: string, t = 1, closeId?: string): { x: number; y: number; close: boolean } {
  const u = ui.u;
  const k = Math.min(1, t * 5);
  const s = 0.85 + 0.15 * easeOutBack(k);
  const W = w * s, H = h * s;
  const x = ui.W / 2 - W / 2;
  const y = ui.H / 2 - H / 2;
  ui.panel(x, y, W, H, 'wood');
  ui.ribbon(ui.W / 2, y + 6 * u, Math.min(W * 0.7, 380 * u), title);
  let close = false;
  if (closeId) {
    const cs = 64 * u;
    const cx = x + W - cs + 10 * u, cy = y - 10 * u;
    close = ui.clicked(closeId, cx - 10 * u, cy - 10 * u, cs + 20 * u, cs + 20 * u);
    ui.pixRect(cx, cy, cs, cs, '#120d0c');
    ui.pixRect(cx + 4 * u, cy + 4 * u, cs - 8 * u, cs - 8 * u, '#a22633');
    ui.text('✕', cx + cs / 2, cy + cs / 2, 30, '#fff', 'center', null);
  }
  return { x: ui.W / 2 - w / 2, y: ui.H / 2 - h / 2, close };
}

/** 看广告按钮 */
export function adButton(ui: UI, id: string, x: number, y: number, w: number, h: number, label: string, opts: { disabled?: boolean; sub?: string; size?: number } = {}): boolean {
  return ui.button(id, x, y, w, h, label, C.btnGreen, { icon: 'video', ...opts });
}

export function currencyBar(ui: UI, x: number, y: number, w: number, icon: string, value: string, plusId?: string): boolean {
  const u = ui.u;
  const h = 52 * u;
  ui.pixRect(x, y, w, h, 'rgba(10,6,8,0.65)');
  ui.icon(icon, x + 26 * u, y + h / 2, 40 * u);
  ui.text(value, x + 52 * u, y + h / 2, 24, '#fff', 'left');
  if (plusId) {
    const ps = 40 * u;
    const px = x + w - ps - 6 * u, py = y + (h - ps) / 2;
    ui.pixRect(px, py, ps, ps, '#3e8948');
    ui.text('+', px + ps / 2, py + ps / 2, 30, '#fff', 'center', null);
    return ui.clicked(plusId, x, y, w, h);
  }
  return false;
}
