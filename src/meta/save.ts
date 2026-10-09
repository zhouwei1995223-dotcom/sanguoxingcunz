import { getPlatform } from '../platform';
import { dayKey } from '../core/math';
import { DEBUG } from '../debug';
import { NEW_PLAYER, STAMINA, SLOTS, Slot } from '../data/meta';

// 存档：本地 JSON，带版本号便于后续迁移。

export interface EquipItem {
  uid: number;
  tid: string; // 模板 id
  q: number; // 品质
  lv: number;
}

export interface HeroState {
  owned: boolean;
  lv: number;
  star: number;
  shards: number;
}

export interface DailyState {
  day: string;
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
  boxes: Record<number, boolean>;
  adYuanbao: number;
  adGold: number;
  adStamina: number;
  chestAd: Record<string, number>;
  freeGift: boolean;
  sidebar: boolean;
  patrolQuick: number;
  levelupAds: number;
  adShards: number;
}

export interface SaveData {
  v: number;
  created: number;
  gold: number;
  yuanbao: number;
  iron: number;
  stamina: number;
  staminaTs: number;
  heroLv: number; // 旧版字段，迁移到 heroes.zhaoyun.lv
  heroes: Record<string, HeroState>;
  hero: string; // 当前出战武将
  talents: Record<string, number>;
  items: EquipItem[];
  equipped: Record<Slot, number>;
  nextUid: number;
  maxCleared: number;
  chapterBest: Record<number, number>;
  firstClear: Record<number, boolean>;
  selectedChapter: number;
  patrolTs: number;
  signinCount: number;
  signinDay: string;
  daily: DailyState;
  goldChestCount: number;
  settings: { music: boolean; sfx: boolean; vibrate: boolean; dmgNum: boolean };
  guide: number;
  stats: { kills: number; runs: number; bossKills: number; playSec: number; wins: number };
  agreedPrivacy: boolean;
  lastLogin: number;
}

const KEY = 'sgxc_save_v1';
const VERSION = 1;

function freshDaily(): DailyState {
  return {
    day: dayKey(), progress: {}, claimed: {}, boxes: {}, adYuanbao: 0, adGold: 0, adStamina: 0,
    chestAd: {}, freeGift: false, sidebar: false, patrolQuick: 0, levelupAds: 0, adShards: 0,
  };
}

function freshHeroes(): Record<string, HeroState> {
  const h: Record<string, HeroState> = {};
  for (const id of ['zhaoyun', 'guanyu', 'zhangfei', 'zhuge', 'lvbu']) h[id] = { owned: id === 'zhaoyun', lv: 1, star: id === 'zhaoyun' ? 1 : 0, shards: 0 };
  return h;
}

function freshSave(): SaveData {
  const now = Date.now();
  const equipped = {} as Record<Slot, number>;
  SLOTS.forEach((s) => (equipped[s] = 0));
  return {
    v: VERSION,
    created: now,
    gold: NEW_PLAYER.gold,
    yuanbao: NEW_PLAYER.yuanbao,
    iron: NEW_PLAYER.iron,
    stamina: NEW_PLAYER.stamina,
    staminaTs: now,
    heroLv: 1,
    heroes: freshHeroes(),
    hero: 'zhaoyun',
    talents: {},
    items: [],
    equipped,
    nextUid: 1,
    maxCleared: 0,
    chapterBest: {},
    firstClear: {},
    selectedChapter: 1,
    patrolTs: now,
    signinCount: 0,
    signinDay: '',
    daily: freshDaily(),
    goldChestCount: 0,
    settings: { music: true, sfx: true, vibrate: true, dmgNum: true },
    guide: 0,
    stats: { kills: 0, runs: 0, bossKills: 0, playSec: 0, wins: 0 },
    agreedPrivacy: false,
    lastLogin: now,
  };
}

export let save: SaveData = freshSave();
let dirty = false;

export function loadSave() {
  const raw = getPlatform().getItem(KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      // 用新存档补齐缺失字段，兼容旧版本
      const base = freshSave();
      save = Object.assign(base, data);
      save.settings = Object.assign(base.settings, data.settings || {});
      save.stats = Object.assign(base.stats, data.stats || {});
      save.daily = Object.assign(freshDaily(), data.daily || {});
      save.equipped = Object.assign(base.equipped, data.equipped || {});
      // 旧存档迁移：只有赵云时等级存在 heroLv
      save.heroes = Object.assign(freshHeroes(), data.heroes || {});
      if (!data.heroes) save.heroes.zhaoyun.lv = data.heroLv || 1;
      if (!save.heroes[save.hero] || !save.heroes[save.hero].owned) save.hero = 'zhaoyun';
      // 已通关第2章的老玩家直接获得关羽
      if (save.maxCleared >= 2 && !save.heroes.guanyu.owned) { save.heroes.guanyu.owned = true; save.heroes.guanyu.star = 1; }
    } catch (e) {
      save = freshSave();
    }
  }
  if (DEBUG.reset) save = freshSave();
  if (DEBUG.rich) { save.gold = Math.max(save.gold, 999999); save.yuanbao = Math.max(save.yuanbao, 99999); save.iron = Math.max(save.iron, 9999); save.stamina = Math.max(save.stamina, 99); }
  if (DEBUG.chapter) save.maxCleared = Math.max(save.maxCleared, DEBUG.chapter - 1);
  if (DEBUG.skipGuide) { save.guide = 99; save.agreedPrivacy = true; }
  if (DEBUG.allHeroes) for (const id in save.heroes) if (!save.heroes[id].owned) { save.heroes[id].owned = true; save.heroes[id].star = 1; }
  rolloverDaily();
  tickStamina();
}

export function markDirty() {
  dirty = true;
}

export function flushSave(force = false) {
  if (!dirty && !force) return;
  dirty = false;
  try {
    getPlatform().setItem(KEY, JSON.stringify(save));
  } catch (e) {}
}

/** 跨天重置每日数据 */
export function rolloverDaily() {
  const today = dayKey();
  if (save.daily.day !== today) {
    save.daily = freshDaily();
    markDirty();
  }
}

/** 体力自然恢复 */
export function tickStamina() {
  const now = Date.now();
  if (save.stamina >= STAMINA.max) {
    save.staminaTs = now;
    return;
  }
  const elapsed = Math.max(0, now - save.staminaTs);
  const gained = Math.floor(elapsed / (STAMINA.regenSeconds * 1000));
  if (gained > 0) {
    save.stamina = Math.min(STAMINA.max, save.stamina + gained);
    save.staminaTs += gained * STAMINA.regenSeconds * 1000;
    if (save.stamina >= STAMINA.max) save.staminaTs = now;
    markDirty();
  }
}

export function staminaNextSeconds(): number {
  if (save.stamina >= STAMINA.max) return 0;
  return Math.max(0, Math.ceil((save.staminaTs + STAMINA.regenSeconds * 1000 - Date.now()) / 1000));
}

export function resetSave() {
  save = freshSave();
  flushSave(true);
}
