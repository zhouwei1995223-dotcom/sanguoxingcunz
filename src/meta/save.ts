import { getPlatform } from '../platform';
import { dayKey } from '../core/math';
import { DEBUG } from '../debug';
import { NEW_PLAYER, STAMINA, SLOTS, Slot } from '../data/meta';
import { SkillId, skillPoolFor, fitPreparation } from '../data/skills';
import { HERO_BY_ID } from '../data/heroes';
import { IS_WEB } from '../data/platformConfig';

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
  /** 巅峰等级（五星后用碎片升级） */
  peak?: number;
  /** 五星觉醒造型是否启用 */
  awaken?: boolean;
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
  /** 今天点过游戏圈（红点只在每天第一次显示） */
  club?: boolean;
  /** 今天每个广告点位看了几次（上报用） */
  adCount?: Record<string, number>;
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
  /** 每名武将的备战技能，依玩家点选的优先顺序保存。 */
  preparedSkills?: Record<string, SkillId[]>;
  preparationPresets?: Record<string, PreparationPresets>;
  talents: Record<string, number>;
  items: EquipItem[];
  equipped: Record<Slot, number>;
  nextUid: number;
  maxCleared: number;
  chapterBest: Record<number, number>; // 旧版字段（普通难度），迁移到 bests
  firstClear: Record<number, boolean>; // 旧版字段，迁移到 clears
  /** 各难度通关记录，键为 "难度-章节" */
  clears: Record<string, boolean>;
  bests: Record<string, number>;
  /** 1.0.4 三星评价：按「难度-章节」存拿到过的星（位：1 通关、2 不复活、4 限时击败最终敌将） */
  stars: Record<string, number>;
  selectedChapter: number;
  selectedDiff: number;
  /** 主界面选中的模式与守城关卡 */
  homeMode?: 'chapter' | 'defense';
  selectedDefense?: number;
  endlessBest: number;
  endlessRuns: number;
  /** 守城模式：最多守到第几波、胜场、当天第一次胜利的日期 */
  defense?: { best: number; wins: number; day: string; cleared?: number; stars?: Record<number, number> };
  patrolTs: number;
  signinCount: number;
  signinDay: string;
  daily: DailyState;
  goldChestCount: number;
  settings: { music: boolean; sfx: boolean; vibrate: boolean; dmgNum: boolean; ultRight: boolean; lowPower: boolean; screenShake: boolean; autoPick: boolean };
  guide: number;
  /** 已经看过的一次性提示（首次遇到某个系统时显示） */
  tips: Record<string, boolean>;
  /** 新手漏斗：已上报过的步骤 */
  funnel: Record<string, boolean>;
  /** 首次安装的日期（YYYY-MM-DD），算第几天回来 */
  installDay: string;
  /** 第一次进游戏的来源：ad（腾讯广告点进来）/ s<场景值> / web */
  src: string;
  /** 最近一次上报登录的日期 */
  loginReportDay: string;
  stats: {
    kills: number; runs: number; bossKills: number; playSec: number; wins: number;
    chests: number; upgrades: number; ads: number; ults: number; evos: number; bestCombo: number;
  };
  /** 最后修改时间（云存档比对用） */
  updatedAt: number;
  achClaimed: Record<string, boolean>;
  codex: { bosses: Record<string, number>; enemies: Record<string, number>; weapons: Record<string, number> };
  codexClaimed: Record<string, boolean>;
  newbieClaimed: Record<string, boolean>;
  newbiePrizes: Record<number, boolean>;
  weekly: { week: string; best: number; claimed: Record<number, boolean> };
  skins: Record<string, { owned: boolean; ads: number; on: boolean }>;
  redeemed: Record<string, boolean>;
  subscribed: boolean;
  videoShareDay: string;
  agreedPrivacy: boolean;
  lastLogin: number;
}

const STANDARD_KEY = 'sgxc_save_v1';
const KEY = DEBUG.webPlaytest ? 'sgxc_web_playtest_v1' : STANDARD_KEY;
const VERSION = 1;

function freshDaily(): DailyState {
  return {
    day: dayKey(), progress: {}, claimed: {}, boxes: {}, adYuanbao: 0, adGold: 0, adStamina: 0,
    chestAd: {}, freeGift: false, sidebar: false, patrolQuick: 0, levelupAds: 0, adShards: 0,
  };
}

function freshHeroes(): Record<string, HeroState> {
  const h: Record<string, HeroState> = {};
  for (const id of ['zhaoyun', 'guanyu', 'zhangfei', 'zhuge', 'lvbu', 'huangzhong', 'machao', 'sunshangxiang', 'dianwei', 'jiangwei']) h[id] = { owned: id === 'zhaoyun', lv: 1, star: id === 'zhaoyun' ? 1 : 0, shards: 0 };
  return h;
}

function freshSave(): SaveData {
  const now = Date.now();
  if (save && save.staminaTs > now) save.staminaTs = now;
  if (save && save.patrolTs > now) save.patrolTs = now;
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
    clears: {},
    bests: {},
    stars: {},
    selectedDiff: 0,
    endlessBest: 0,
    endlessRuns: 0,
    patrolTs: now,
    signinCount: 0,
    signinDay: '',
    daily: freshDaily(),
    goldChestCount: 0,
    settings: { music: true, sfx: true, vibrate: true, dmgNum: true, ultRight: false, lowPower: false, screenShake: true, autoPick: false },
    guide: 0,
    tips: {},
    funnel: {},
    installDay: '',
    src: '',
    loginReportDay: '',
    stats: { kills: 0, runs: 0, bossKills: 0, playSec: 0, wins: 0, chests: 0, upgrades: 0, ads: 0, ults: 0, evos: 0, bestCombo: 0 },
    updatedAt: now,
    achClaimed: {},
    codex: { bosses: {}, enemies: {}, weapons: {} },
    codexClaimed: {},
    newbieClaimed: {},
    newbiePrizes: {},
    weekly: { week: '', best: 0, claimed: {} },
    skins: {},
    redeemed: {},
    subscribed: false,
    videoShareDay: '',
    agreedPrivacy: false,
    lastLogin: now,
  };
}

export let save: SaveData = freshSave();
let dirty = false;

export const PRESET_COUNT = 3;
export interface PreparationPresets { active: number; slots: SkillId[][] }

export function preparationPresetsFor(hero: string): PreparationPresets {
  const saved = save.preparationPresets?.[hero];
  const active = saved?.active ?? 0;
  const pool = skillPoolFor(HERO_BY_ID[hero], Infinity, null, false);
  return {
    active: Number.isInteger(active) && active >= 0 && active < PRESET_COUNT ? active : 0,
    slots: Array.from({ length: PRESET_COUNT }, (_, i) => {
      const ids = saved?.slots?.[i] ?? (i === 0 ? save.preparedSkills?.[hero] : []);
      return fitPreparation(Array.isArray(ids) ? ids : [], pool, [HERO_BY_ID[hero].weapon]);
    }),
  };
}

export function preparedSkillsFor(hero: string): SkillId[] {
  const presets = preparationPresetsFor(hero);
  return presets.slots[presets.active];
}

export function selectedPreparationStage() {
  const defense = save.homeMode === 'defense';
  return { defense, chapter: (defense ? save.selectedDefense : save.selectedChapter) || 1 };
}

export function loadSave() {
  const platform = getPlatform();
  // 第一次进入测试档时沿用原有进度和备战方案，之后分别保存。
  const raw = platform.getItem(KEY) ?? (DEBUG.webPlaytest ? platform.getItem(STANDARD_KEY) : null);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      // 用新存档补齐缺失字段，兼容旧版本
      const base = freshSave();
      save = Object.assign(base, data);
      save.settings = Object.assign(base.settings, data.settings || {});
      save.stats = Object.assign(base.stats, data.stats || {});
      save.daily = Object.assign(freshDaily(), data.daily || {});
      save.codex = Object.assign(base.codex, data.codex || {});
      save.weekly = Object.assign(base.weekly, data.weekly || {});
      save.equipped = Object.assign(base.equipped, data.equipped || {});
      // 旧存档迁移：通关记录改为按难度存储
      if (!data.clears) {
        for (const k in save.firstClear) if (save.firstClear[+k]) save.clears['0-' + k] = true;
        for (const k in save.chapterBest) save.bests['0-' + k] = save.chapterBest[+k];
      }
      // 旧存档迁移：只有赵云时等级存在 heroLv
      save.heroes = Object.assign(freshHeroes(), data.heroes || {});
      if (!data.heroes) save.heroes.zhaoyun.lv = data.heroLv || 1;
      if (!save.heroes[save.hero] || !save.heroes[save.hero].owned) save.hero = 'zhaoyun';
      // 已通关第2章的老玩家直接获得关羽
      if (save.maxCleared >= 2 && !save.heroes.guanyu.owned) { save.heroes.guanyu.owned = true; save.heroes.guanyu.star = 1; }
      // 1.0.4：三星评价上线前通关过的关卡先记 1 颗星（通关）
      for (const k in save.clears) if (save.clears[k] && !save.stars[k]) save.stars[k] = 1;
      // 1.0.3：已通关第4 / 6章的老玩家直接获得黄忠 / 姜维
      if (save.maxCleared >= 4 && !save.heroes.huangzhong.owned) { save.heroes.huangzhong.owned = true; save.heroes.huangzhong.star = 1; }
      if (save.maxCleared >= 6 && !save.heroes.jiangwei.owned) { save.heroes.jiangwei.owned = true; save.heroes.jiangwei.star = 1; }
    } catch (e) {
      save = freshSave();
    }
  }
  if (DEBUG.reset) save = freshSave();
  if (IS_WEB && save.preparedSkills) {
    const presets = (save.preparationPresets ??= {});
    for (const hero of Object.keys(save.preparedSkills)) {
      if (HERO_BY_ID[hero]) presets[hero] = preparationPresetsFor(hero);
    }
    delete save.preparedSkills;
    markDirty();
  }
  applyTestResources();
  if (DEBUG.chapter) save.maxCleared = Math.max(save.maxCleared, DEBUG.chapter - 1);
  if (DEBUG.skipGuide) { save.guide = 99; save.agreedPrivacy = true; }
  rolloverDaily();
  tickStamina();
}

function applyTestResources() {
  if (DEBUG.webPlaytest) {
    // 货币没有库存上限。测试档只在读档时补给，购买、养成和结算仍走正常逻辑。
    const balance = 100_000_000;
    save.gold = Math.max(save.gold, balance);
    save.yuanbao = Math.max(save.yuanbao, balance);
    save.iron = Math.max(save.iron, balance);
    save.stamina = Math.max(save.stamina, STAMINA.max);
  } else if (DEBUG.rich) {
    save.gold = Math.max(save.gold, 999999);
    save.yuanbao = Math.max(save.yuanbao, 99999);
    save.iron = Math.max(save.iron, 9999);
    save.stamina = Math.max(save.stamina, 99);
  }
  if (DEBUG.webPlaytest || DEBUG.allHeroes) {
    for (const hero of Object.values(save.heroes)) {
      hero.owned = true;
      hero.star = Math.max(hero.star || 0, 1);
      if (DEBUG.webPlaytest) hero.shards = Math.max(hero.shards || 0, 9999);
    }
  }
}

export function markDirty() {
  dirty = true;
  save.updatedAt = Date.now();
}

/** 用云端存档替换本地（云存档恢复） */
export function replaceSave(raw: string): boolean {
  try {
    const KEYTMP = getPlatform();
    KEYTMP.setItem(KEY, raw);
    loadSave();
    flushSave(true);
    return true;
  } catch (e) {
    return false;
  }
}

export function rawSave(): string {
  return JSON.stringify(save);
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
  if (save && save.staminaTs > now) save.staminaTs = now;
  if (save && save.patrolTs > now) save.patrolTs = now;
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
  if (DEBUG.webPlaytest) applyTestResources();
  flushSave(true);
}
