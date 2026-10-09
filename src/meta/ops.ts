import { getPlatform } from '../platform';
import { save, markDirty, tickStamina } from './save';
import type { EquipItem } from './save';
import {
  HERO, heroLevelCost, EQUIPS, EQUIP_BY_ID, QUALITY_MAX_LV, QUALITY_STAT_MUL, StatBlock, equipUpgradeCost,
  TALENTS, talentCost, Reward, STAMINA, PATROL, CHESTS, ChestDef, DAILY_TASKS, TaskKind, ACTIVITY_REWARDS, SIGNIN, Slot, SLOTS, QUALITY_NAMES,
} from '../data/meta';
import { dayKey, weighted, pick } from '../core/math';
import { HERO_BY_ID, HEROES, STAR_COST, MAX_STAR, STAR_BONUS } from '../data/heroes';
import { setBonuses, skinOn } from './goals';
import { SKIN_DMG_BONUS } from '../data/goals';

// 局外养成的所有操作（纯逻辑，UI 调用）

export interface HeroStats extends Required<StatBlock> {
  revive: number;
  reroll: number;
  hero: string;
  /** 已通关章节数（决定局内技能池） */
  cleared?: number;
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

/** 武将自身（等级 + 星级）的攻击与生命 */
export function heroBase(id: string): { atk: number; hp: number } {
  const h = HERO_BY_ID[id];
  const st = save.heroes[id];
  const lv = st ? st.lv : 1;
  const mul = 1 + STAR_BONUS * Math.max(0, (st ? st.star : 1) - 1);
  return { atk: Math.round((h.baseAtk + h.atkPerLv * (lv - 1)) * mul), hp: Math.round((h.baseHp + h.hpPerLv * (lv - 1)) * mul) };
}

export function computeStats(heroId = save.hero): HeroStats {
  const hb = heroBase(heroId);
  const s: StatBlock = { atk: hb.atk, hp: hb.hp };
  for (const slot of SLOTS) {
    const it = getEquipped(slot);
    if (it) addStats(s, itemStats(it));
  }
  // 套装加成
  const tids: string[] = [];
  for (const slot of SLOTS) { const it = getEquipped(slot); if (it) tids.push(it.tid); }
  for (const st of setBonuses(tids).stats) addStats(s, st);
  // 皮肤加成
  if (skinOn(heroId)) addStats(s, { dmg: SKIN_DMG_BONUS });
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
    revive, reroll, hero: heroId, cleared: save.maxCleared,
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

export function upgradeHero(id = save.hero): string | null {
  const st = save.heroes[id];
  if (!st.owned) return '尚未获得该武将';
  if (st.lv >= HERO.maxLevel) return '已达等级上限';
  const c = heroLevelCost(st.lv);
  if (save.gold < c) return '金币不足';
  save.gold -= c;
  st.lv++;
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

// —— 武将 ——
export function grantShards(hero: string, n: number) {
  save.heroes[hero].shards += n;
  markDirty();
}

/** 获得武将：已拥有则转为 20 碎片 */
export function grantHero(hero: string): 'new' | 'shards' {
  const st = save.heroes[hero];
  if (st.owned) { st.shards += 20; markDirty(); return 'shards'; }
  st.owned = true;
  st.star = 1;
  markDirty();
  getPlatform().report('hero_unlock', { hero, way: 'reward' });
  return 'new';
}

export function unlockHero(id: string): string | null {
  const st = save.heroes[id];
  const def = HERO_BY_ID[id];
  if (st.owned) return '已拥有';
  if (st.shards < def.unlockShards) return `碎片不足（${st.shards}/${def.unlockShards}）`;
  st.shards -= def.unlockShards;
  st.owned = true;
  st.star = 1;
  markDirty();
  getPlatform().report('hero_unlock', { hero: id, way: 'shards' });
  return null;
}

export function starUpHero(id: string): string | null {
  const st = save.heroes[id];
  if (!st.owned) return '尚未获得该武将';
  if (st.star >= MAX_STAR) return '已达最高星级';
  const cost = STAR_COST[st.star - 1];
  if (st.shards < cost) return `碎片不足（${st.shards}/${cost}）`;
  st.shards -= cost;
  st.star++;
  progressTask('upgrade', 1);
  markDirty();
  return null;
}

export function heroRedDot(id: string): boolean {
  const st = save.heroes[id];
  const def = HERO_BY_ID[id];
  if (!st.owned) return def.unlockShards > 0 && st.shards >= def.unlockShards;
  return (st.star < MAX_STAR && st.shards >= STAR_COST[st.star - 1]) || (st.lv < HERO.maxLevel && save.gold >= heroLevelCost(st.lv));
}

export function anyHeroRedDot(): boolean {
  return HEROES.some((h) => heroRedDot(h.id));
}

/** 随机碎片：偏向需要碎片解锁的诸葛亮与吕布 */
/** 武将碎片的武将分布：名将宝匣 / 其他来源 */
export const SHARD_WEIGHTS_RARE: Record<string, number> = { zhuge: 35, lvbu: 40, guanyu: 10, zhangfei: 10, zhaoyun: 5 };
export const SHARD_WEIGHTS_COMMON: Record<string, number> = { zhuge: 50, lvbu: 10, guanyu: 15, zhangfei: 15, zhaoyun: 10 };
/** 军资箱附带武将碎片的概率 */
export const WOOD_SHARD_RATE = 0.4;

export function randomShardHero(rare: boolean): string {
  const w = rare ? SHARD_WEIGHTS_RARE : SHARD_WEIGHTS_COMMON;
  return weighted(Object.keys(w), (k) => w[k]);
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
  if (r.shards) grantShards(r.shards.hero, r.shards.n * mul);
  if (r.hero) grantHero(r.hero);
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
  // 订阅了提醒：登记体力回满时间
  if (save.subscribed) getPlatform().scheduleReminder('stamina', save.staminaTs + (STAMINA.max - save.stamina) * STAMINA.regenSeconds * 1000);
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
  if (save.subscribed) getPlatform().scheduleReminder('patrol', save.patrolTs + PATROL.maxHours * 3600000);
  progressTask('patrol', 1);
  markDirty();
  return p;
}

// —— 宝箱 ——
export interface ChestResult {
  item: EquipItem;
  shards?: { hero: string; n: number };
  /** 名将宝匣开出整将（已拥有则转为碎片） */
  hero?: { id: string; got: 'new' | 'shards' };
}

/** 名将宝匣：每次开启出整将的概率 */
export const GOLD_CHEST_HERO_RATE = 0.05;

export function openChest(def: ChestDef): ChestResult {
  const q = weighted([0, 1, 2, 3, 4, 5], (i) => def.weights[i]);
  progressTask('chest', 1);
  getPlatform().report('chest_open', { chest: def.id });
  const item = newItem(randomItemTemplate(), q);
  let shards: ChestResult['shards'];
  let hero: ChestResult['hero'];
  if (def.id === 'gold') {
    // 名将宝匣以武将为主：概率直接出整将，N 次保底；否则必出大量武将碎片
    save.goldChestCount++;
    if (Math.random() < GOLD_CHEST_HERO_RATE || (def.pity && save.goldChestCount >= def.pity)) {
      save.goldChestCount = 0;
      const notOwned = Object.keys(save.heroes).filter((id) => !save.heroes[id].owned);
      let id = randomShardHero(true);
      if (notOwned.length && save.heroes[id].owned) id = notOwned[Math.floor(Math.random() * notOwned.length)];
      hero = { id, got: grantHero(id) };
    } else shards = { hero: randomShardHero(true), n: 8 + Math.floor(Math.random() * 8) };
  } else if (Math.random() < WOOD_SHARD_RATE) shards = { hero: randomShardHero(false), n: 2 + Math.floor(Math.random() * 3) };
  if (shards) grantShards(shards.hero, shards.n);
  return { item, shards, hero };
}

export function chestById(id: string) {
  return CHESTS.find((c) => c.id === id)!;
}

// —— 每日任务 ——
export function progressTask(kind: TaskKind, n: number) {
  // 累计统计（成就 / 新手目标使用）
  if (kind === 'chest') save.stats.chests += n;
  else if (kind === 'upgrade') save.stats.upgrades += n;
  else if (kind === 'ad') save.stats.ads += n;
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

/** 宝箱概率公示文本（直接由配置生成，修改概率后自动同步） */
export function chestOddsText(): string {
  const pct = (v: number, total: number) => `${+((v / total) * 100).toFixed(2)}%`;
  const heroDist = (w: Record<string, number>) => {
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    return Object.keys(w).map((id) => `${HERO_BY_ID[id].name} ${pct(w[id], total)}`).join('、');
  };
  const lines: string[] = ['宝箱概率公示', '', '宝箱可使用游戏内元宝开启，或每日观看视频免费开启。元宝只能在游戏内免费获得，不能用人民币购买。', ''];
  for (const c of CHESTS) {
    const total = c.weights.reduce((a, b) => a + b, 0);
    lines.push(`【${c.name}】`);
    lines.push('每次开启必得 1 件装备，品质概率：');
    c.weights.forEach((w, q) => { if (w > 0) lines.push(`  ${QUALITY_NAMES[q]}：${pct(w, total)}`); });
    if (c.id === 'gold') {
      lines.push(`另外：${pct(GOLD_CHEST_HERO_RATE, 1)} 概率直接获得 1 名完整武将（优先从尚未拥有的武将中等概率抽取；全部已拥有时转化为 20 个碎片）；`);
      lines.push(`未获得武将时，必得 8～15 个武将碎片（每个数量等概率），碎片所属武将概率：${heroDist(SHARD_WEIGHTS_RARE)}。`);
      if (c.pity) lines.push(`保底：连续 ${c.pity} 次未获得武将时，第 ${c.pity} 次必定获得武将。`);
    } else {
      lines.push(`另外：${pct(WOOD_SHARD_RATE, 1)} 概率附赠 2～4 个武将碎片（每个数量等概率），碎片所属武将概率：${heroDist(SHARD_WEIGHTS_COMMON)}。`);
    }
    lines.push('');
  }
  lines.push('装备的具体部位与套装在同品质装备中等概率随机。');
  return lines.join('\n');
}
