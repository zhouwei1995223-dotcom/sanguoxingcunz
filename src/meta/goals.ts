import { save, markDirty } from './save';
import { grantReward, GrantResult, grantShards, grantHero, newItem, randomItemTemplate } from './ops';
import { isCleared } from './run';
import { CHAPTERS } from '../data/chapters';
import { ACHIEVEMENTS, NEWBIE_DAYS, NEWBIE_PRIZES, NEWBIE_WINDOW_DAYS, Metric, GoalDef, WEEKLY_CHALLENGES, WEEKLY_TIERS, SKINS, EQUIP_SETS } from '../data/goals';
import { BOSSES, ENEMIES } from '../data/enemies';
import { WEAPONS } from '../data/skills';
import { HEROES } from '../data/heroes';
import { REDEEM_CODES } from '../data/platformConfig';
import type { StatBlock } from '../data/meta';
import { EQUIP_BY_ID } from '../data/meta';

// 成就 / 新手七日 / 图鉴 / 每周挑战 / 皮肤 / 套装 / 兑换码

export function metric(m: Metric): number {
  const st = save.stats;
  switch (m) {
    case 'runs': return st.runs;
    case 'kills': return st.kills;
    case 'bossKills': return st.bossKills;
    case 'wins': return st.wins;
    case 'maxCleared': return save.maxCleared;
    case 'hardClears': return CHAPTERS.filter((c) => isCleared(1, c.id)).length;
    case 'nightmareClears': return CHAPTERS.filter((c) => isCleared(2, c.id)).length;
    case 'endlessBest': return save.endlessBest;
    case 'heroesOwned': return HEROES.filter((h) => save.heroes[h.id].owned).length;
    case 'maxStar': return Math.max(...HEROES.map((h) => (save.heroes[h.id].owned ? save.heroes[h.id].star : 0)));
    case 'totalStars': return HEROES.reduce((a, h) => a + (save.heroes[h.id].owned ? save.heroes[h.id].star : 0), 0);
    case 'heroLvMax': return Math.max(...HEROES.map((h) => (save.heroes[h.id].owned ? save.heroes[h.id].lv : 0)));
    case 'bestCombo': return st.bestCombo;
    case 'ults': return st.ults;
    case 'evos': return st.evos;
    case 'chests': return st.chests;
    case 'upgrades': return st.upgrades;
    case 'ads': return st.ads;
    case 'signin': return save.signinCount;
    case 'mythic': return save.items.filter((i) => i.q >= 5).length;
    case 'codexBosses': return Object.keys(save.codex.bosses).length;
    case 'weeklyBest': return save.weekly.best;
  }
  return 0;
}

export const goalDone = (g: GoalDef) => metric(g.metric) >= g.target;

// —— 成就 ——
export function achRedDot(): boolean {
  return ACHIEVEMENTS.some((a) => !save.achClaimed[a.id] && goalDone(a));
}

export function claimAch(a: GoalDef): GrantResult | null {
  if (save.achClaimed[a.id] || !goalDone(a)) return null;
  save.achClaimed[a.id] = true;
  return grantReward(a.reward);
}

// —— 新手七日 ——
export function newbieDay(): number {
  const start = new Date(save.created);
  start.setHours(0, 0, 0, 0);
  return Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
}

export function newbieActive(): boolean {
  if (newbieDay() > NEWBIE_WINDOW_DAYS) return false;
  return !NEWBIE_PRIZES.every((_, i) => save.newbiePrizes[i]) || NEWBIE_DAYS.some((d) => d.some((g) => !save.newbieClaimed[g.id]));
}

export function newbieDone(): number {
  return NEWBIE_DAYS.reduce((a, d) => a + d.filter((g) => save.newbieClaimed[g.id]).length, 0);
}

export function newbieRedDot(): boolean {
  if (!newbieActive()) return false;
  const day = newbieDay();
  if (NEWBIE_DAYS.some((d, i) => i < day && d.some((g) => !save.newbieClaimed[g.id] && goalDone(g)))) return true;
  const done = newbieDone();
  return NEWBIE_PRIZES.some((p, i) => !save.newbiePrizes[i] && done >= p.need);
}

export function claimNewbie(g: GoalDef): GrantResult | null {
  if (save.newbieClaimed[g.id] || !goalDone(g)) return null;
  save.newbieClaimed[g.id] = true;
  return grantReward(g.reward);
}

export function claimNewbiePrize(i: number): GrantResult | null {
  const p = NEWBIE_PRIZES[i];
  if (save.newbiePrizes[i] || newbieDone() < p.need) return null;
  save.newbiePrizes[i] = true;
  return grantReward(p.reward);
}

// —— 图鉴 ——
export type CodexKind = 'bosses' | 'enemies' | 'weapons';
export const CODEX_REWARD: Record<CodexKind, number> = { bosses: 20, enemies: 5, weapons: 10 };

export function codexEntries(kind: CodexKind): { id: string; name: string; sprite: string; count: number }[] {
  if (kind === 'bosses') return Object.values(BOSSES).map((b) => ({ id: b.id, name: b.name, sprite: `u_${b.sprite}_0_L`, count: save.codex.bosses[b.id] || 0 }));
  if (kind === 'enemies') return Object.values(ENEMIES).map((e) => ({ id: e.id, name: e.name, sprite: `u_${e.sprite}_0_L`, count: save.codex.enemies[e.id] || 0 }));
  return Object.values(WEAPONS).map((w) => ({ id: w.id, name: w.evoName, sprite: 'icon_' + w.evoIcon, count: save.codex.weapons[w.id] || 0 }));
}

export function codexUnclaimed(): number {
  let n = 0;
  for (const k of ['bosses', 'enemies', 'weapons'] as CodexKind[]) for (const e of codexEntries(k)) if (e.count > 0 && !save.codexClaimed[k + ':' + e.id]) n++;
  return n;
}

/** 一键领取所有新点亮的图鉴奖励，返回元宝数 */
export function claimCodexAll(): number {
  let yb = 0;
  for (const k of ['bosses', 'enemies', 'weapons'] as CodexKind[])
    for (const e of codexEntries(k)) {
      const key = k + ':' + e.id;
      if (e.count > 0 && !save.codexClaimed[key]) { save.codexClaimed[key] = true; yb += CODEX_REWARD[k]; }
    }
  if (yb) { save.yuanbao += yb; markDirty(); }
  return yb;
}

/** 战斗结束时记录图鉴数据 */
export function recordCodex(killsBy: Record<string, number>, bossesKilled: string[], evolved: string[]) {
  for (const id in killsBy) save.codex.enemies[id] = (save.codex.enemies[id] || 0) + killsBy[id];
  for (const id of bossesKilled) save.codex.bosses[id] = (save.codex.bosses[id] || 0) + 1;
  for (const id of evolved) save.codex.weapons[id] = (save.codex.weapons[id] || 0) + 1;
  markDirty();
}

// —— 每周挑战 ——
export function weekKey(t = Date.now()): string {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return d.getFullYear() + '-W' + wk;
}

export function currentWeekly() {
  const key = weekKey();
  if (save.weekly.week !== key) { save.weekly = { week: key, best: 0, claimed: {} }; markDirty(); }
  const n = parseInt(key.split('W')[1], 10) || 0;
  return WEEKLY_CHALLENGES[n % WEEKLY_CHALLENGES.length];
}

/** 本周挑战结束：记录最好成绩，按击杀数解锁档位奖励 */
export function settleWeekly(kills: number): { newBest: boolean; rewards: GrantResult[] } {
  currentWeekly();
  const newBest = kills > save.weekly.best;
  if (newBest) save.weekly.best = kills;
  const rewards: GrantResult[] = [];
  WEEKLY_TIERS.forEach((t, i) => {
    if (!save.weekly.claimed[i] && save.weekly.best >= t.kills) { save.weekly.claimed[i] = true; rewards.push(grantReward(t.reward)); }
  });
  markDirty();
  return { newBest, rewards };
}

export function weeklyRedDot(): boolean {
  currentWeekly();
  return save.weekly.best === 0;
}

// —— 皮肤 ——
export function skinState(hero: string) {
  if (!save.skins[hero]) save.skins[hero] = { owned: false, ads: 0, on: false };
  return save.skins[hero];
}

export function skinOn(hero: string): boolean {
  const s = save.skins[hero];
  return !!(s && s.owned && s.on);
}

/** 武将当前造型的精灵名前缀（穿戴皮肤时换成皮肤） */
export function heroSpriteName(hero: string): string {
  return skinOn(hero) ? `hero_${hero}_skin` : `hero_${hero}`;
}

/** 看一次视频推进皮肤进度，达到次数后解锁并自动穿上 */
export function skinAdProgress(hero: string): boolean {
  const s = skinState(hero);
  if (s.owned) return false;
  s.ads++;
  if (s.ads >= SKINS[hero].ads) { s.owned = true; s.on = true; }
  markDirty();
  return s.owned;
}

// —— 套装 ——
export function setBonuses(equippedTids: string[]): { stats: StatBlock[]; active: { name: string; n: number; desc: string[] }[] } {
  const stats: StatBlock[] = [];
  const active: { name: string; n: number; desc: string[] }[] = [];
  for (const set of EQUIP_SETS) {
    const n = equippedTids.filter((t) => set.pieces.includes(t)).length;
    if (!n) continue;
    const desc: string[] = [];
    for (const b of set.bonus) if (n >= b.n) { stats.push(b.stats); desc.push(`${b.n}件：${b.desc}`); }
    active.push({ name: set.name, n, desc });
  }
  return { stats, active };
}

export function setOf(tid: string) {
  return EQUIP_SETS.find((s) => s.pieces.includes(tid)) || null;
}

// —— 兑换码 ——
export function redeem(raw: string): { ok: boolean; msg: string; result?: GrantResult } {
  const code = (raw || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: '请输入兑换码' };
  const r = REDEEM_CODES[code];
  if (!r) return { ok: false, msg: '兑换码无效' };
  if (save.redeemed[code]) return { ok: false, msg: '该兑换码已使用过' };
  save.redeemed[code] = true;
  return { ok: true, msg: '兑换成功', result: grantReward(r) };
}

export { grantShards, grantHero, newItem, randomItemTemplate, EQUIP_BY_ID };
