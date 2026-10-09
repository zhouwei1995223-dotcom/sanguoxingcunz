import { save, markDirty, tickStamina } from './save';
import type { EquipItem } from './save';
import {
  HERO, heroLevelCost, EQUIPS, EQUIP_BY_ID, QUALITY_MAX_LV, QUALITY_STAT_MUL, StatBlock, equipUpgradeCost,
  TALENTS, talentCost, Reward, STAMINA, PATROL, CHESTS, ChestDef, DAILY_TASKS, TaskKind, ACTIVITY_REWARDS, SIGNIN, Slot, SLOTS,
} from '../data/meta';
import { dayKey, weighted, pick } from '../core/math';

// 局外养成的所有操作（纯逻辑，UI 调用）

export interface HeroStats extends Required<StatBlock> {
  revive: number;
  reroll: number;
}

function addStats(into: StatBlock, add: StatBlock, mul = 1) {
  for (const k in add) {
    const key = k as keyof StatBlock;
    into[key] = (into[key] || 0) + (add[key] || 0) * mul;
  }
}

export function itemStats(it: EquipItem): StatBlock {
  const t = EQUIP_BY_ID[it.tid];
  const out: StatBlock = {};
  const qm = QUALITY_STAT_MUL[it.q];
  addStats(out, t.base, qm);
  addStats(out, t.perLv, qm * (it.lv - 1));
  for (const u of t.unlocks) if (it.q >= u.q) addStats(out, u.stats);
  // 主属性取整
  if (out.atk) out.atk = Math.round(out.atk);
  if (out.hp) out.hp = Math.round(out.hp);
  return out;
}

export function computeStats(): HeroStats {
  const s: StatBlock = { atk: HERO.baseAtk + HERO.atkPerLv * (save.heroLv - 1), hp: HERO.baseHp + HERO.hpPerLv * (save.heroLv - 1) };
  for (const slot of SLOTS) {
    const it = getEquipped(slot);
    if (it) addStats(s, itemStats(it));
  }
  let revive = 0, reroll = 0;
  for (const t of TALENTS) {
    const lv = save.talents[t.id] || 0;
    if (!lv) continue;
    if (t.stat === 'revive') revive += lv * t.per;
    else if (t.stat === 'reroll') reroll += lv * t.per;
    else addStats(s, { [t.stat]: lv * t.per });
  }
  const full: HeroStats = {
    atk: 0, hp: 0, def: 0, speed: 0, crit: 5, critDmg: 50, dmg: 0, pickup: 0, exp: 0, gold: 0, cd: 0, area: 0, regen: 0, bossDmg: 0,
    revive, reroll,
  };
  addStats(full, s);
  full.atk = Math.round(full.atk);
  full.hp = Math.round(full.hp);
  return full;
}

/** 战力：用于展示与章节推荐 */
export function combatPower(st = computeStats()): number {
  return Math.round(st.atk * 10 * (1 + st.dmg / 100) * (1 + (st.crit / 100) * (st.critDmg / 100)) + st.hp * 2 * (1 + st.def / 100) + st.regen * 50);
}

export function getEquipped(slot: Slot): EquipItem | null {
  const uid = save.equipped[slot];
  return uid ? save.items.find((i) => i.uid === uid) || null : null;
}

export function isEquipped(it: EquipItem): boolean {
  return save.equipped[EQUIP_BY_ID[it.tid].slot] === it.uid;
}

export function equip(it: EquipItem) {
  save.equipped[EQUIP_BY_ID[it.tid].slot] = it.uid;
  markDirty();
}

export function unequip(slot: Slot) {
  save.equipped[slot] = 0;
  markDirty();
}

export function newItem(tid: string, q: number): EquipItem {
  const it = { uid: save.nextUid++, tid, q, lv: 1 };
  save.items.push(it);
  // 对应部位为空时自动穿戴
  const slot = EQUIP_BY_ID[tid].slot;
  if (!save.equipped[slot]) save.equipped[slot] = it.uid;
  markDirty();
  return it;
}

export function randomItemTemplate(): string {
  return pick(EQUIPS).id;
}

export function canAfford(gold: number, iron = 0, yuanbao = 0) {
  return save.gold >= gold && save.iron >= iron && save.yuanbao >= yuanbao;
}

export function upgradeItem(it: EquipItem): string | null {
  if (it.lv >= QUALITY_MAX_LV[it.q]) return '已达当前品质等级上限，合成提升品质';
  const c = equipUpgradeCost(it.lv);
  if (save.gold < c.gold) return '金币不足';
  if (save.iron < c.iron) return '玄铁不足';
  save.gold -= c.gold;
  save.iron -= c.iron;
  it.lv++;
  progressTask('upgrade', 1);
  markDirty();
  return null;
}

/** 3 件同名同品质 → 1 件高一品质（保留主件等级，素材件等级返还玄铁） */
export function mergeCandidates(it: EquipItem): EquipItem[] {
  return save.items.filter((o) => o.uid !== it.uid && o.tid === it.tid && o.q === it.q);
}

export function mergeItem(it: EquipItem): string | null {
  if (it.q >= 5) return '已是最高品质';
  const mats = mergeCandidates(it).sort((a, b) => (isEquipped(a) ? 1 : 0) - (isEquipped(b) ? 1 : 0) || a.lv - b.lv).slice(0, 2);
  if (mats.length < 2) return '需要3件相同品质的同名装备';
  let refund = 0;
  for (const m of mats) {
    for (let l = 1; l < m.lv; l++) refund += equipUpgradeCost(l).iron;
    if (isEquipped(m)) save.equipped[EQUIP_BY_ID[m.tid].slot] = it.uid;
    save.items = save.items.filter((o) => o.uid !== m.uid);
  }
  it.q++;
  save.iron += refund;
  markDirty();
  return null;
}

/** 一键合成：从低品质开始合成所有可合成的装备 */
export function mergeAll(): number {
  let count = 0;
  for (let q = 0; q < 5; q++) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const it of save.items.filter((i) => i.q === q).sort((a, b) => (isEquipped(b) ? 1 : 0) - (isEquipped(a) ? 1 : 0) || b.lv - a.lv)) {
        if (!save.items.includes(it)) continue;
        if (mergeCandidates(it).length >= 2 && mergeItem(it) === null) { count++; changed = true; break; }
      }
    }
  }
  return count;
}

/** 一键穿戴最佳 */
export function equipBest() {
  for (const slot of SLOTS) {
    let best: EquipItem | null = null, bestScore = -1;
    for (const it of save.items) {
      if (EQUIP_BY_ID[it.tid].slot !== slot) continue;
      const st = itemStats(it);
      const score = (st.atk || 0) * 10 + (st.hp || 0) * 2 + it.q * 100;
      if (score > bestScore) { best = it; bestScore = score; }
    }
    if (best) save.equipped[slot] = best.uid;
  }
  markDirty();
}

export function upgradeHero(): string | null {
  if (save.heroLv >= HERO.maxLevel) return '已达等级上限';
  const c = heroLevelCost(save.heroLv);
  if (save.gold < c) return '金币不足';
  save.gold -= c;
  save.heroLv++;
  progressTask('upgrade', 1);
  markDirty();
  return null;
}

export function upgradeTalent(id: string): string | null {
  const t = TALENTS.find((x) => x.id === id)!;
  const lv = save.talents[id] || 0;
  if (lv >= t.max) return '已满级';
  if (save.maxCleared < t.unlockChapter) return `通关第${t.unlockChapter}章解锁`;
  const c = talentCost(t, lv);
  if (save.gold < c) return '金币不足';
  save.gold -= c;
  save.talents[id] = lv + 1;
  progressTask('upgrade', 1);
  markDirty();
  return null;
}

// —— 奖励 ——
export interface GrantResult {
  reward: Reward;
  items: EquipItem[];
}

export function grantReward(r: Reward, mul = 1): GrantResult {
  const items: EquipItem[] = [];
  if (r.gold) save.gold += Math.round(r.gold * mul);
  if (r.yuanbao) save.yuanbao += Math.round(r.yuanbao * mul);
  if (r.iron) save.iron += Math.round(r.iron * mul);
  if (r.stamina) save.stamina += Math.round(r.stamina * mul);
  if (r.equip) for (let i = 0; i < mul; i++) items.push(newItem(r.equip.id || randomItemTemplate(), r.equip.q));
  markDirty();
  return { reward: r, items };
}

// —— 体力 ——
export function spendStamina(n = STAMINA.costPerRun): boolean {
  tickStamina();
  if (save.stamina < n) return false;
  if (save.stamina >= STAMINA.max) save.staminaTs = Date.now();
  save.stamina -= n;
  markDirty();
  return true;
}

// —— 巡营 ——
export function patrolPending(): { minutes: number; gold: number; iron: number } {
  const minutes = Math.min(PATROL.maxHours * 60, Math.floor((Date.now() - save.patrolTs) / 60000));
  return patrolReward(minutes);
}

export function patrolReward(minutes: number) {
  const gold = Math.floor(minutes * PATROL.goldPerMin(save.maxCleared));
  const iron = Math.floor((minutes / 60) * PATROL.ironPerHour(save.maxCleared));
  return { minutes, gold, iron };
}

export function collectPatrol(mul = 1) {
  const p = patrolPending();
  save.gold += p.gold * mul;
  save.iron += p.iron * mul;
  save.patrolTs = Date.now();
  progressTask('patrol', 1);
  markDirty();
  return p;
}

// —— 宝箱 ——
export function openChest(def: ChestDef): EquipItem {
  let q = weighted([0, 1, 2, 3, 4, 5], (i) => def.weights[i]);
  if (def.pity) {
    save.goldChestCount++;
    if (q >= 3) save.goldChestCount = 0;
    else if (save.goldChestCount >= def.pity) { q = 3; save.goldChestCount = 0; }
  }
  progressTask('chest', 1);
  return newItem(randomItemTemplate(), q);
}

export function chestById(id: string) {
  return CHESTS.find((c) => c.id === id)!;
}

// —— 每日任务 ——
export function progressTask(kind: TaskKind, n: number) {
  for (const t of DAILY_TASKS) {
    if (t.kind !== kind) continue;
    save.daily.progress[t.id] = Math.min(t.target, (save.daily.progress[t.id] || 0) + n);
  }
  markDirty();
}

export function activityPoints(): number {
  let p = 0;
  for (const t of DAILY_TASKS) if (save.daily.claimed[t.id]) p += t.points;
  return p;
}

export function claimTask(id: string): boolean {
  const t = DAILY_TASKS.find((x) => x.id === id)!;
  if (save.daily.claimed[id] || (save.daily.progress[id] || 0) < t.target) return false;
  save.daily.claimed[id] = true;
  markDirty();
  return true;
}

export function claimActivityBox(i: number): GrantResult | null {
  const box = ACTIVITY_REWARDS[i];
  if (save.daily.boxes[i] || activityPoints() < box.points) return null;
  save.daily.boxes[i] = true;
  return grantReward(box.reward);
}

export function tasksRedDot(): boolean {
  for (const t of DAILY_TASKS) if (!save.daily.claimed[t.id] && (save.daily.progress[t.id] || 0) >= t.target) return true;
  const p = activityPoints();
  return ACTIVITY_REWARDS.some((b, i) => !save.daily.boxes[i] && p >= b.points);
}

// —— 签到 ——
export function canSignin(): boolean {
  return save.signinDay !== dayKey();
}

export function signinIndex(): number {
  return save.signinCount % SIGNIN.length;
}

export function doSignin(mul = 1): GrantResult | null {
  if (!canSignin()) return null;
  const r = SIGNIN[signinIndex()];
  save.signinCount++;
  save.signinDay = dayKey();
  return grantReward(r, mul);
}

export function onLogin() {
  progressTask('login', 1);
  save.lastLogin = Date.now();
  markDirty();
}

// —— 关卡结算 ——
export function chapterUnlocked(id: number): boolean {
  return id <= save.maxCleared + 1;
}
