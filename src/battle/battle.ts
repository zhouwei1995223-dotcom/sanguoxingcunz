import { SpatialGrid } from '../core/grid';
import { clamp, rand, pick, shuffle, weighted, TAU } from '../core/math';
import { ChapterDef, CHAPTER_TIME_SCALE } from '../data/chapters';
import { ENEMIES, BOSSES, BossDef, BASIC_BOSS_SKILLS } from '../data/enemies';
import { HERO_BY_ID, HeroDef, UltKind } from '../data/heroes';
import type { WeeklyDef } from '../data/goals';
import {
  WEAPONS, WeaponId, PassiveId, weaponsForHero, passivesFor, passiveMax, weaponLink, MAX_WEAPON_LV, WEAPON_SLOTS, PASSIVE_SLOTS, expToNext,
} from '../data/skills';
import type { HeroStats } from '../meta/ops';
import { potionStats } from '../data/meta';
import { QiyuId, QIYUS } from '../data/qiyu';
import { STRATS, STRAT_TIMES, STRAT_TIMES_ENDLESS, STRAT_TIMES_DEFENSE, STRAT_TIER_WEIGHTS, STRAT_HP_STEP, StratId, StratTier, STRAT_BY_ID } from '../data/strategies';
import {
  Enemy, Player, WeaponState, PassiveState, Projectile, FirePool, EnemyShot, Pickup, Breakable, Fx, Warning, newEnemy, newProjectile,
} from './entities';
import { updateWeapons } from './weapons';
import { skipHordesBefore, updateSpawner } from './spawner';
import { updateBoss } from './boss';
import {
  DefenseState, updateDefense, reviveCity, enemyTarget, enemyContact, heroDown, shotHitsCity, hurtCity, orderChoices, readyLinks, applyOrder, applyLink, orderLv,
  buildChoices, applyBuild, heroCanSummon, summonHero, repairCity,
} from './defense';
import { ORDERS, LINKS, OrderId, LinkId, DEF_HERO_DMG, DEF_EXP, ARENA_R, BuildKind } from '../data/defense';

export type Choice =
  | { kind: 'weapon'; id: WeaponId; lv: number; isNew: boolean }
  | { kind: 'passive'; id: PassiveId; lv: number; isNew: boolean }
  | { kind: 'evo'; id: WeaponId }
  | { kind: 'heal' }
  | { kind: 'gold' }
  /** 守城模式：军令卡（兵种 / 城防）与军令联动 */
  | { kind: 'order'; id: OrderId; lv: number; isNew: boolean }
  | { kind: 'link'; id: LinkId }
  /** 守城模式：建筑（建在城边 / 升级）、召唤武将、修城 */
  | { kind: 'build'; id: BuildKind; lv: number; isNew: boolean }
  | { kind: 'hero'; id: string }
  | { kind: 'repair' };

export interface UltRing {
  r: number;
  hit: Set<number>;
}

export interface UltState {
  kind: UltKind;
  slow: number; // 大招期间世界时间倍率
  tickT: number;
  rings: UltRing[];
  spawned: number;
  idx: number; // 第几次冲杀
  t: number;
  dur: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  finale: number; // 收尾冲击波计时
}

export const ULT_DASHES = 7;
export const RAGE_MAX = 100;

export interface BattleHooks {
  sfx(name: string): void;
  shake(power: number): void;
  banner(text: string, color?: string): void;
  vibrate(long?: boolean): void;
  bossAppear(def: BossDef): void;
  /** 放大招（场景播放立绘切入） */
  ultCast?(): void;
}

const noopHooks: BattleHooks = { sfx() {}, shake() {}, banner() {}, vibrate() {}, bossAppear() {} };

/**
 * 章节难度节奏（敌人血量倍率）：爽是一个过程——先轻松上手，再逐步加压，
 * 5:00 首领 + 宝箱进化后迎来一波疯狂割草，然后再加压直到最终决战。
 *   0:00~1:00 热身   1:30~5:00 加压   5:00 首领出场后回落，进化后爽割到 7:00   7:00~9:00 再加压
 * 表里是「章节时间」（按 10 分钟写）；章节一局 6 分钟，实际时间 = 表里时间 × 0.6（见 ct）。
 */
const TENSION: [number, number][] = [[0, 0.8], [60, 0.9], [90, 1.45], [270, 2.4], [300, 2.4], [345, 1.3], [420, 1.3], [540, 1.55], [9999, 1.55]];
/** 接触伤害倍率：小怪出手变慢（贴身蓄力 + 玩家受击后短暂无敌）后，单次伤害相应提高 */
const CONTACT_DMG = 1.25;
/** 小兵弓箭 / 飞石伤害倍率：子弹密集，单发伤害略低，不选回血技能也能过关 */
const SHOT_DMG = 0.8;
/** 敌将血量 / 伤害倍率（新手试炼除外） */
const BOSS_HP = 1.6, BOSS_DMG = 1.45;
/** 敌将护盾：最大血量的 15%，限时 12 秒 */
const BOSS_SHIELD = 0.15, BOSS_SHIELD_TIME = 12;
/**
 * 1.0.4：敌将不能被秒杀。
 * - 血量跟玩家战力部分挂钩：战力超出推荐值时 ×(战力比^0.6)，超出 1 倍约 ×1.5（第 1 章 ^0.4）
 * - 保底战斗时长：血量掉得比「按时间匀速」快时，受到的伤害只剩 1/4（中途 30 秒 / 最终 50 秒，第 1 章 15 / 25 秒）
 */
const BOSS_POWER_EXP = 0.6;
/** 直取敌将：游戏时间 2:30 以后才出现，每局只能用一次 */
/** 1.0.4：章节敌人攻击力整体提高（第 1 章不加，新手友好）；血量和数量不动，割草手感不变 */
const CHAPTER_DMG = 1.5;
const chapterDmgMul = (ch: ChapterDef) => (ch.tutorial || ch.endless || ch.defense || ch.id === 1 ? 1 : CHAPTER_DMG);
const BOSS_MIN_TIME = { mid: 30, final: 50, ch1Mid: 15, ch1Final: 25 };

/** 点 (x,y) 是否在预警范围内（margin 用来算上角色的身体半径）。和 render.ts 画出来的形状一致 */
export function inWarning(w: Warning, x: number, y: number, margin = 0): boolean {
  const dx = x - w.x, dy = y - w.y;
  if (w.kind === 'circle') {
    const R = w.r + margin;
    return dx * dx + (dy / 0.8) * (dy / 0.8) < R * R;
  }
  if (w.kind === 'line') {
    const c = Math.cos(w.a), s = Math.sin(w.a);
    const along = dx * c + dy * s, side = -dx * s + dy * c;
    return along > -margin && along < w.len + margin && Math.abs(side) < w.r / 2 + margin;
  }
  const fy = dy / 0.85;
  const d = Math.hypot(dx, fy);
  if (d > w.len + margin) return false;
  if (d < margin + 4) return true;
  let da = Math.atan2(fy, dx) - w.a;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  return Math.abs(da) < w.r;
}
export function tension(t: number, chapterId = 2): number {
  let v = TENSION[TENSION.length - 1][1];
  for (let i = 1; i < TENSION.length; i++) {
    const [t1, v1] = TENSION[i];
    if (t <= t1) { const [t0, v0] = TENSION[i - 1]; v = v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); break; }
  }
  // 第 1 章是新玩家的第一关：起伏减半；7 章以后本身数值已经很高，起伏只留三成（实测再大胜率明显下降）
  const amp = chapterId === 1 ? 0.5 : chapterId >= 7 ? 0.3 : 1;
  return 1 + (v - 1) * amp;
}

export class Battle {
  chapter: ChapterDef;
  base: HeroStats;
  hooks: BattleHooks = noopHooks;
  viewW: number;
  viewH: number;

  t = 0;
  player: Player;
  enemies: Enemy[] = [];
  projs: Projectile[] = [];
  pools: FirePool[] = [];
  shots: EnemyShot[] = [];
  pickups: Pickup[] = [];
  breakables: Breakable[] = [];
  fx: Fx[] = [];
  warnings: Warning[] = [];
  weapons: WeaponState[] = [];
  passives: PassiveState[] = [];

  level = 1;
  exp = 0;
  expNeed = expToNext(1);
  pendingLevelUps = 0;
  pendingChests: { boss: boolean }[] = [];
  kills = 0;
  coins = 0;
  bossKills = 0;
  equipDrops = 0;
  rerolls = 0;
  /** 本局已看广告刷新的次数 */
  adRerolls = 0;
  revives = 0;
  adReviveUsed = false;
  /** 本局看广告复活的次数（最多 AD_REVIVE_MAX 次） */
  adRevives = 0;
  /** 锦囊免费刷新：每局 1 次，三计共用 */
  stratFreeRerolls = 1;
  dead = false;
  won = false;
  /** 平衡统计：护盾 [打破次数, 狂暴次数]；敌将战总秒数 */
  statShield = [0, 0];
  statBossSec = 0;
  /** 玩家战力 ÷ 推荐战力（场景里算好传进来，敌将血量用） */
  powerRatio = 1;
  /** 当前这场敌将战打了多久（spawner 用：前 50 秒不刷小怪） */
  bossFightT = 0;
  reinforced = false;
  finalBoss: Enemy | null = null;
  midBoss: Enemy | null = null;
  /** 守城模式的状态（其他模式为 null） */
  def: DefenseState | null = null;
  eventIdx = 0;
  spawnT = 0;
  moveX = 0;
  moveY = 0;
  showDamage = true;
  enemyHpMul = 1;
  enemyDmgMul = 1;

  // 锦囊妙计
  strats: StratId[] = [];
  private stratSet = new Set<StratId>();
  /** 开局奇遇（整局生效） */
  qiyu: QiyuId | null = null;
  /** 典韦大招期间 */
  frenzy = false;
  /** 本局复活次数（三星评价用） */
  reviveCount = 0;
  /** 最终敌将从登场到被击败用了多少秒（-1 表示没打下来） */
  finalBossSec = -1;
  /** 1.0.4：看广告复活第 2 / 3 次给的本局加成 */
  reviveDmg = 0;
  reviveSpd = 0;
  /** 已触发到第几次锦囊 */
  stratRound = 0;
  /** 待选择的锦囊：品质与第几计 */
  pendingStrats: { tier: StratTier; round: number }[] = [];
  /** 动态伤害倍率（背水一战、趁火打劫等，每帧计算） */
  private dynMul = 1;
  private jinchanUsed = false;
  private qixingBuff = false;
  private ultBuffT = -1;
  private yiqiBase = 0;
  private caochuanCd = 0;
  private stratT = { huoshao: 6, shimian: 4, wanjian: 5, bazhen: 0 };
  private chainQueue: { x: number; y: number }[] = [];
  private delayed: { t: number; fn: () => void }[] = [];

  // 金疮药：手动使用，冷却结束后可再次使用
  potionHeal = 0.25;
  potionCdMax = 60;
  potionCd = 0;
  potionUses = 0;
  private potionBase = { heal: 0.25, cd: 60 };

  // 怒气 / 大招
  rage = 0;
  rageLock = 0;
  ult: UltState | null = null;
  ultCasts = 0;
  adRageUsed = 0;
  // 打击感
  hitStop = 0;
  private hitStopCd = 0;
  combo = 0;
  comboT = 0;
  bestCombo = 0;
  // 图鉴与成就统计
  killsBy: Record<string, number> = {};
  bossesKilled: string[] = [];
  evolved: string[] = [];
  /** 每周挑战规则 */
  mods: WeeklyDef | null = null;
  // 磁石保底
  private magnetT = 60;
  private magnetCd = 0;

  grid = new SpatialGrid<Enemy>(32);
  private uidSeq = 1;
  private gemCount = 0;
  private overflowGem: Pickup | null = null;
  private tmp: Enemy[] = [];

  // 局内派生属性
  dmgMul = 1;
  cdMul = 1;
  areaMul = 1;
  durMul = 1;
  hero: HeroDef;
  speed = 78;
  dmgTakenMul = 1;
  regen = 0;
  pickupR = 40;
  expMul = 1;
  goldMul = 1;
  crit = 0.05;
  private critBonus = 0;
  private critDmgBonus = 0;
  critDmg = 1.5;
  /** 舆图：技能数量加成 */
  countBonus = 0;
  /** 号角：怒气获取倍率 */
  rageMul = 1;
  /** 磨刀石：对精英与首领的伤害加成 */
  eliteDmg = 0;
  /** 护心镜：格挡冷却（0 = 未拥有） */
  mirrorCd = 0;
  mirrorT = 0;
  /** 已通关章节数：决定技能池 */
  cleared = 99;
  /** 本局封禁的选项（kind:id） */
  banned = new Set<string>();
  banishes = 2;
  /** 刷怪密度倍率（低端机自动下调） */
  densityMul = 1;
  /** 当前目标同屏敌人数（刷怪器写入） */
  targetDensity = 0;
  /** 动态难度：屏幕长时间被清空时，新敌人血量逐步提高（1～3 倍） */
  director = 1;
  private directorT = 0;

  constructor(chapter: ChapterDef, base: HeroStats, viewW: number, viewH: number) {
    this.chapter = chapter;
    this.base = base;
    this.viewW = viewW;
    this.viewH = viewH;
    this.player = { x: 0, y: 0, r: 8, hp: base.hp, maxHp: base.hp, dirX: 1, dirY: 0, left: false, moving: false, anim: 0, iframe: 0, hurtFlash: 0 };
    // 升级刷新：每局送 1 次免费，军略「奇谋」再加
    this.rerolls = base.reroll + 1;
    this.revives = base.revive;
    this.potionBase = potionStats(base.potion || 0);
    this.hero = HERO_BY_ID[base.hero] || HERO_BY_ID.zhaoyun;
    this.cleared = base.cleared ?? 99;
    this.addWeapon(this.hero.weapon);
    this.recalc();
  }

  // —— 属性 ——
  passiveLv(id: PassiveId): number {
    const p = this.passives.find((x) => x.id === id);
    return p ? p.lv : 0;
  }

  weapon(id: WeaponId): WeaponState | undefined {
    return this.weapons.find((w) => w.id === id);
  }

  recalc() {
    const P = (id: PassiveId) => this.passiveLv(id);
    const b = this.base;
    const auraEvo = this.weapon('aura')?.evo;
    this.dmgMul = 1 + b.dmg / 100 + 0.1 * P('tiger');
    this.cdMul = Math.max(0.35, (1 - b.cd / 100) * (1 - 0.06 * P('book')));
    this.areaMul = 1 + b.area / 100 + 0.1 * P('flag');
    this.durMul = 1 + 0.12 * P('pouch');
    const hid = this.hero.id;
    // 武将天赋
    if (hid === 'guanyu') { this.critBonus = 0.08; this.critDmgBonus = 0.4; }
    if (hid === 'zhuge') this.cdMul *= 0.9;
    if (hid === 'zhaoyun') this.dmgMul += 0.1;
    if (hid === 'lvbu') this.dmgMul += 0.2;
    if (hid === 'huangzhong') this.critBonus = 0.1;
    if (hid === 'sunshangxiang') this.cdMul *= 0.92;
    if (this.frenzy) { this.dmgMul += 0.6; this.cdMul *= 0.5; }
    this.dmgMul += this.reviveDmg;
    const qianli = this.weapon('horse')?.link && hid === 'guanyu';
    this.speed = this.hero.moveSpeed * (1 + b.speed / 100 + 0.08 * P('horseshoe') + (hid === 'lvbu' ? 0.08 : 0) + (hid === 'machao' ? 0.1 : 0) + (qianli ? 0.2 : 0) + this.reviveSpd);
    this.dmgTakenMul = (1 - Math.min(0.6, b.def / 100)) * (1 - 0.06 * P('armor')) * (auraEvo ? 0.8 : 1) * (hid === 'zhangfei' ? 0.85 : 1);
    const Q = (id: QiyuId) => this.qiyu === id;
    const hpStrat = (this.stratSet.has('shengou') ? 1.15 : 1) * (this.stratSet.has('kurou') ? 0.8 : 1) * (Q('hanzhong') ? 1.25 : 1) * (Q('pofu') ? 0.75 : 1);
    const newMax = Math.round(b.hp * (1 + 0.1 * P('lingzhi')) * hpStrat * (hid === 'dianwei' ? 1.2 : 1));
    if (newMax > this.player.maxHp) this.player.hp += newMax - this.player.maxHp;
    this.player.maxHp = newMax;
    this.player.hp = Math.min(this.player.hp, newMax);
    this.regen = b.regen + 0.3 * P('lingzhi') + (auraEvo ? newMax * 0.01 : 0);
    this.pickupR = this.hero.pickup * (1 + b.pickup / 100 + 0.35 * P('bowl')) * (hid === 'sunshangxiang' ? 1.3 : 1);
    if (hid === 'jiangwei') this.areaMul += 0.1;
    // 新手试炼只有一分多钟：经验和怒气加快，升级、大招都能体验到
    const tut = this.chapter.tutorial ? 3 : 1;
    const tutRage = this.chapter.tutorial ? 6 : 1;
    // 1.0.4：章节一局压到 6 分钟，经验 ×1.3 补回来，阵容能在敌将前成型
    const shortRun = !this.chapter.endless && !this.chapter.tutorial ? 1.3 : 1;
    this.expMul = (1 + b.exp / 100 + 0.08 * P('seal')) * (this.mods?.expMul || 1) * tut * shortRun * (hid === 'jiangwei' ? 1.15 : 1) * (this.chapter.defense ? DEF_EXP : 1);
    if (this.mods?.playerDmg) this.dmgMul *= this.mods.playerDmg;
    this.goldMul = 1 + b.gold / 100 + 0.1 * P('bowl');
    this.crit = b.crit / 100 + this.critBonus + 0.04 * P('wine');
    this.critDmg = 1 + b.critDmg / 100 + this.critDmgBonus + 0.15 * P('wine');
    this.countBonus = P('map');
    this.rageMul = (1 + 0.15 * P('horn')) * tutRage;
    this.eliteDmg = 0.15 * P('whetstone');
    this.mirrorCd = P('mirror') ? 14 - 2 * P('mirror') : 0;
    // 锦囊妙计
    const S = (id: StratId) => this.stratSet.has(id);
    if (S('libing')) this.dmgMul += 0.2;
    if (S('kurou')) this.dmgMul += 0.35;
    if (S('shengou')) this.dmgTakenMul *= 0.88;
    if (S('shensu')) { this.speed *= 1.12; this.cdMul *= 0.92; }
    if (S('wolong')) { this.cdMul *= 0.85; this.areaMul += 0.15; this.durMul += 0.15; }
    this.cdMul = Math.max(0.3, this.cdMul);
    if (S('jiliang')) { this.goldMul += 0.4; this.expMul *= 1.1; }
    if (S('qinwang')) this.eliteDmg += 0.3;
    this.potionHeal = this.potionBase.heal + (S('yangjing') ? 0.1 : 0);
    this.potionCdMax = Math.round(this.potionBase.cd * (S('yangjing') ? 0.6 : 1));
    this.potionCd = Math.min(this.potionCd, this.potionCdMax);
    // 开局奇遇
    if (Q('qinggang')) this.dmgMul += 0.15;
    if (Q('pofu')) this.dmgMul += 0.3;
    if (Q('qixingdao')) { this.crit += 0.08; this.critDmg += 0.3; }
    if (Q('dilu')) { this.speed *= 1.12; this.pickupR *= 1.4; }
    if (Q('chitu')) this.rageMul *= 1.4;
    if (Q('huatuo')) { this.potionHeal += 0.1; this.potionCdMax = Math.round(this.potionCdMax * 0.7); this.potionCd = Math.min(this.potionCd, this.potionCdMax); }
    if (Q('tengjia')) this.dmgTakenMul *= 0.85;
    if (Q('shuijing')) this.expMul *= 1.25;
    if (Q('dunjia')) this.cdMul = Math.max(0.3, this.cdMul * 0.9);
    if (Q('sunzi')) { this.areaMul += 0.15; this.durMul += 0.15; }
    if (Q('tongque')) this.goldMul += 0.5;
    if (Q('zhanjiang')) this.eliteDmg += 0.3;
  }

  /** 开局奇遇：随机 3 个 */
  rollQiyu(n = 3): QiyuId[] {
    // 守城只用当前武将的专属武器，「神兵天降」（送一件别的兵器）不出现
    return shuffle(QIYUS.map((q) => q.id).filter((id) => !(this.chapter.defense && id === 'shenbing'))).slice(0, n);
  }

  applyQiyu(id: QiyuId) {
    this.qiyu = id;
    if (id === 'shenbing' && this.weapons.length < WEAPON_SLOTS) {
      // 神兵天降：送一件还没有的兵器，直接 2 级
      const ids = weaponsForHero(this.hero.id, this.cleared).filter((w) => !this.weapon(w));
      if (ids.length) {
        const w = pick(ids);
        this.addWeapon(w);
        this.weapon(w)!.lv = 2;
      }
    }
    this.recalc();
  }

  // —— 锦囊妙计 ——
  hasStrat(id: StratId): boolean {
    return this.stratSet.has(id);
  }

  /** 随机一组同品质的计策（不重复已拥有的） */
  rollStrats(tier: StratTier, n = 3): StratId[] {
    let pool = STRATS.filter((s) => s.tier === tier && !this.stratSet.has(s.id)).map((s) => s.id);
    // 同品质不够时从其他品质补
    if (pool.length < n) pool = pool.concat(STRATS.filter((s) => s.tier !== tier && !this.stratSet.has(s.id) && !pool.includes(s.id)).map((s) => s.id));
    return shuffle(pool.slice()).slice(0, n);
  }

  applyStrat(id: StratId) {
    if (this.stratSet.has(id)) return;
    this.strats.push(id);
    this.stratSet.add(id);
    const p = this.player;
    switch (id) {
      case 'paozhuan': this.pendingLevelUps += 2; break;
      case 'qixing': this.revives++; break;
      case 'yiqi': this.yiqiBase = this.kills; break;
      case 'taoyuan':
        for (const w of this.weapons) if (!w.evo && w.lv < MAX_WEAPON_LV) w.lv++;
        for (const ps of this.passives) if (ps.lv < passiveMax(ps.id)) ps.lv++;
        break;
    }
    this.recalc();
    this.fx.push({ kind: 'ring', x: p.x, y: p.y - 8, t: 0, dur: 0.6, r: 80, color: '#fee761' });
    this.hooks.banner(`锦囊 · ${STRAT_BY_ID[id].name}`, '#fee761');
    this.hooks.sfx('evolve');
  }

  private later(sec: number, fn: () => void) {
    this.delayed.push({ t: sec, fn });
  }

  private updateStrats(dt: number) {
    // 到点发放锦囊
    const st = this.stratTimes;
    if (this.stratRound < st.length && this.t >= st[this.stratRound] && this.t < this.chapter.duration) {
      const w = STRAT_TIER_WEIGHTS[this.stratRound];
      this.pendingStrats.push({ tier: weighted([0, 1, 2] as StratTier[], (k) => w[k]), round: this.stratRound });
      this.stratRound++;
    }
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= dt;
      if (d.t <= 0) { this.delayed.splice(i, 1); d.fn(); }
    }
    // 动态伤害倍率
    const p = this.player;
    const S = (id: StratId) => this.stratSet.has(id);
    let m = 1;
    if (S('beishui') && p.hp < p.maxHp * 0.4) m *= 1.5;
    if (S('chenhuo')) m *= 1 + Math.min(0.4, Math.floor(this.coins / 25) * 0.01);
    if (this.t < this.ultBuffT) m *= 1.5;
    if (this.qixingBuff) m *= 1.25;
    if (S('yiqi')) m *= 1 + 0.04 * Math.floor((this.kills - this.yiqiBase) / 100);
    this.dynMul = m;
    if (!this.strats.length) return;
    const atk = this.base.atk;
    if (S('yiyi') && !p.moving) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.02 * dt);
    this.caochuanCd = Math.max(0, this.caochuanCd - dt);
    // 连环计：每帧最多引爆几次，避免连锁卡顿
    for (let n = 0; n < 6 && this.chainQueue.length; n++) {
      const c = this.chainQueue.shift()!;
      const near: Enemy[] = [];
      this.grid.query(c.x, c.y, 40, near);
      for (const e of near) {
        if (e.dead) continue;
        const dx = e.x - c.x, dy = e.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 30 + e.r) this.damage(e, atk * 1.8, dx / d, dy / d, 50, { noCrit: true });
      }
      if (this.fx.length < 300) this.fx.push({ kind: 'explo', x: c.x, y: c.y + 6, t: 0, dur: 0.3 });
    }
    if (this.chainQueue.length > 40) this.chainQueue.length = 40;
    if (S('huoshao')) {
      this.stratT.huoshao -= dt;
      if (this.stratT.huoshao <= 0) {
        this.stratT.huoshao = 10;
        // 在几个候选敌人里挑周围最拥挤的
        let best: Enemy | null = null, bn = -1;
        for (let i = 0; i < 6; i++) {
          const e = this.randomVisibleEnemy();
          if (!e) break;
          const n = this.grid.query(e.x, e.y, 40, this.tmp).length;
          if (n > bn) { bn = n; best = e; }
        }
        if (best) {
          this.pools.push({ x: best.x, y: best.y, r: 50 * this.areaMul, dmg: atk * 0.9, tick: 0.4, tickT: 0, life: 5 * this.durMul, maxLife: 5 * this.durMul, slow: 0 });
          this.fx.push({ kind: 'explo', x: best.x, y: best.y + 6, t: 0, dur: 0.4 });
          this.hooks.sfx('fire');
        }
      }
    }
    if (S('shimian')) {
      this.stratT.shimian -= dt;
      if (this.stratT.shimian <= 0) {
        this.stratT.shimian = 8;
        const R = 90 * this.areaMul;
        this.grid.query(p.x, p.y, R + 16, this.tmp);
        for (const e of this.tmp.slice()) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < R + e.r) this.damage(e, atk * 5, dx / d, dy / d, 160);
        }
        this.fx.push({ kind: 'drum', x: p.x, y: p.y - 4, t: 0, dur: 0.45, r: R, color: '#c0cbdc' });
        this.hooks.shake(2);
        this.hooks.sfx('thrust');
      }
    }
    if (S('wanjian')) {
      this.stratT.wanjian -= dt;
      if (this.stratT.wanjian <= 0) {
        this.stratT.wanjian = 15;
        const targets = this.enemies.filter((e) => !e.dead && this.inView(e.x, e.y, 10));
        let shown = 0;
        for (const e of targets) {
          const delay = 0.25 + Math.random() * 0.35;
          if (shown++ < 70) this.fx.push({ kind: 'volley', x: e.x + rand(-4, 4), y: e.y - 4, t: -delay + 0.35, dur: 0.35 });
          this.later(delay, () => { if (!e.dead) this.damage(e, atk * 7, 0, 1, 30, { force: true }); });
        }
        this.later(0.3, () => { this.hooks.shake(3); this.hooks.sfx('explode'); });
        this.hooks.sfx('shoot');
        this.fx.push({ kind: 'text', x: p.x, y: p.y - 50, t: 0, dur: 1.2, text: '万箭齐发！', color: '#fee761' });
      }
    }
    if (S('bazhen')) {
      this.stratT.bazhen -= dt;
      if (this.stratT.bazhen <= 0) {
        this.stratT.bazhen = 0.5;
        const R = this.bazhenR;
        this.grid.query(p.x, p.y, R + 16, this.tmp);
        for (const e of this.tmp.slice()) {
          if (e.dead) continue;
          if ((e.x - p.x) ** 2 + ((e.y - p.y) * 1.25) ** 2 > (R + e.r) ** 2) continue;
          if (!e.boss) { e.slow = Math.max(e.slow, 0.5); e.slowT = Math.max(e.slowT, 0.6); }
          this.damage(e, atk * 1.6, 0, 0, 0, { noCrit: true });
        }
      }
    }
  }

  /** 每过一个锦囊时间点，敌人血量提高一些，抵消计策带来的战力 */
  get stratHpMul(): number {
    return 1 + STRAT_HP_STEP * this.stratRound;
  }

  /** 八阵图半径 */
  get bazhenR(): number {
    return 66 * this.areaMul;
  }

  /** 借刀杀人：飞出的尸体撞伤沿途敌人 */
  private updateJiedao() {
    if (!this.stratSet.has('jiedao')) return;
    const atk = this.base.atk;
    const near: Enemy[] = [];
    for (const f of this.fx) {
      if (f.kind !== 'corpse' || f.t > 0.45) continue;
      const x = f.x + f.vx! * f.t, y = f.y + (f.vy! + 60) * f.t;
      this.grid.query(x, y, 14, near);
      for (const e of near) {
        if (e.dead) continue;
        if ((e.x - x) ** 2 + (e.y - y) ** 2 > (10 + e.r) ** 2) continue;
        if (!f.hit) f.hit = new Set();
        if (f.hit.has(e.uid) || f.hit.size >= 3) continue;
        f.hit.add(e.uid);
        const vl = Math.hypot(f.vx!, 1) || 1;
        this.damage(e, atk * 1.4, f.vx! / vl, 0, 60, { noCrit: true, force: true });
      }
    }
  }

  addWeapon(id: WeaponId) {
    this.weapons.push({ id, lv: 1, evo: false, t: 0.3, active: 0, angle: 0, burst: 0, hits: new Map(), link: false });
  }

  // —— 主循环 ——
  update(rawDt: number) {
    if (this.dead || this.won) return;
    const p = this.player;
    let dt = rawDt;
    // 大招期间：赵云正常速度冲杀，其余一切慢动作
    if (this.ult) dt = rawDt * this.updateUlt(rawDt);
    this.t += dt;
    // 每周挑战 / 新手试炼：坚持到时间即胜利
    if ((this.chapter.endless || this.chapter.tutorial) && this.chapter.duration < 1e8 && this.t >= this.chapter.duration) {
      for (const e of this.enemies) if (!e.dead) { e.dead = true; this.fx.push({ kind: 'puff', x: e.x, y: e.y, t: 0, dur: 0.3 }); }
      this.won = true;
      return;
    }
    this.hitStopCd = Math.max(0, this.hitStopCd - rawDt);
    if (this.finalBoss || this.midBoss) { this.statBossSec += dt; this.bossFightT += dt; } else this.bossFightT = 0;
    this.contactIframe = Math.max(0, this.contactIframe - dt);
    this.updateRage(dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // 移动
    const dashing = !!this.ult && this.ult.kind === 'dragon';
    const down = !!this.def && this.def.downT > 0;
    let mx = dashing || down ? 0 : this.moveX, my = dashing || down ? 0 : this.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > 0.05 || dashing;
    // 天下无双期间移速提升；其他大招慢动作时赵云以外的武将正常移动
    const moveDt = this.ult && this.ult.kind !== 'dragon' ? rawDt : dt;
    const spd = this.speed * (this.ult && this.ult.kind === 'whirl' ? 1.5 : 1) * (this.t < this.ultBuffT ? 1.2 : 1);
    if (dashing) p.anim += rawDt * 16;
    else if (p.moving) {
      p.x += mx * spd * moveDt;
      p.y += my * spd * moveDt;
      const l = Math.hypot(mx, my);
      p.dirX = mx / l;
      p.dirY = my / l;
      if (Math.abs(mx) > 0.1) p.left = mx < 0;
      p.anim += dt * 10;
    } else p.anim = 0;
    p.iframe = Math.max(0, p.iframe - dt);
    if (this.mirrorT > 0) this.mirrorT -= dt;
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    if (this.regen > 0) p.hp = Math.min(p.maxHp, p.hp + this.regen * dt);
    if (this.potionCd > 0) this.potionCd = Math.max(0, this.potionCd - dt);
    this.updateStrats(dt);

    // 网格
    this.grid.clear();
    for (const e of this.enemies) if (!e.dead) this.grid.insert(e);

    updateSpawner(this, dt);
    this.updateDirector(dt);
    this.updateEnemies(dt);
    if (!down) updateWeapons(this, dt);
    if (this.def) updateDefense(this, dt);
    this.updateProjectiles(dt);
    this.updatePools(dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.updateBreakables(dt);
    this.updateJiedao();
    this.updateFx(dt, rawDt);

    // 清理
    if (this.enemies.length > 0 && this.t % 1 < dt) this.enemies = this.enemies.filter((e) => !e.dead);

    if (p.hp <= 0 && !this.dead && this.stratSet.has('jinchan') && !this.jinchanUsed) {
      // 金蝉脱壳：免死一次
      this.jinchanUsed = true;
      p.hp = Math.round(p.maxHp * 0.5);
      p.iframe = 3;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 100) { e.kx += (dx / d) * 260; e.ky += (dy / d) * 260; }
      }
      this.shots.length = 0;
      this.fx.push({ kind: 'ring', x: p.x, y: p.y - 8, t: 0, dur: 0.6, r: 90, color: '#fee761' });
      this.hooks.banner('金蝉脱壳！', '#fee761');
      this.hooks.sfx('evolve');
    }
    if (p.hp <= 0 && !this.dead) {
      // 守城：武将倒下只是回城重整，城池失守才算输
      if (this.def) heroDown(this);
      else {
        this.dead = true;
        this.hooks.vibrate(true);
      }
    }
  }

  // —— 敌人 ——
  /** 普通敌人从出生到被击杀的平均秒数（指数平均） */
  killAge = 8;
  /** 平衡统计：普通敌人击杀数、其中一击即死的数量、玩家受到的总伤害 */
  statKills = 0;
  statOneShots = 0;
  statDmgTaken = 0;
  /** 接触伤害的无敌时间（远程攻击不受影响） */
  contactIframe = 0;
  /** 最近受到的伤害（约 10 秒的滑动累计）；伤害很少、身边也没几个敌人，说明已经稳稳压制住了 */
  recentDmg = 0;
  /** 持续压制的秒数（每秒在 updateDirector 里更新） */
  dominantT = 0;
  /** 每秒获得的经验（平滑，未乘经验加成），用于直取敌将的经验补偿 */
  expRate = 0;
  private expRaw = 0;
  /** 本局累计拿到的经验（未乘加成）：直取敌将按「平均经验速度」补偿，开局就跳也有经验 */
  private expTotal = 0;

  /** 下一个首领事件（没有就返回 null） */
  private nextBossEvent() {
    const evs = this.chapter.events;
    for (let i = this.eventIdx; i < evs.length; i++) if (evs[i].type === 'boss' || evs[i].type === 'midboss') return evs[i];
    return null;
  }
  /** 可以「直取敌将」：普通章节、击败中途敌将以后、每局一次、场上没有敌将、后面还有敌将（点了要看一次广告） */
  canRush(): boolean {
    const ch = this.chapter;
    if (ch.endless || ch.tutorial || ch.defense || this.finalBoss || this.midBoss || this.ult || this.dead || this.won) return false;
    if (!this.midBossDown || this.rushes > 0) return false;
    const ev = this.nextBossEvent();
    return !!ev && ev.t - this.t > 3;
  }
  /** 下一个敌将的名字 */
  nextBossName(): string {
    const ev = this.nextBossEvent();
    return (ev && ev.enemy && BOSSES[ev.enemy] && BOSSES[ev.enemy].name) || '敌将';
  }
  /** 直取敌将会跳过多少秒 */
  rushSkip(): number {
    const ev = this.nextBossEvent();
    return ev ? Math.max(0, ev.t - 0.5 - this.t) : 0;
  }
  /** 直取敌将：时间直接推进到下一个首领登场前，中间的小规模事件跳过（锦囊照常补发） */
  rush(): boolean {
    const ev = this.nextBossEvent();
    if (!ev || !this.canRush()) return false;
    const to = ev.t - 0.5;
    if (to <= this.t) return false;
    while (this.eventIdx < this.chapter.events.length && this.chapter.events[this.eventIdx].t < to && this.chapter.events[this.eventIdx] !== ev) this.eventIdx++;
    skipHordesBefore(to);
    // 跳过的时间按经验速度补一半：取最近速度和本局平均速度里大的那个（最近速度是平滑过的，刚开局时还没跟上）
    const rate = Math.max(this.expRate, this.expTotal / Math.max(30, this.t));
    const bonus = rate * (to - this.t) * 0.5;
    this.t = to;
    if (bonus > 0) this.gainExp(bonus);
    this.dominantT = 0;
    this.rushes++;
    this.hooks.banner('直取敌将！', '#ff8a80');
    this.hooks.shake(4);
    this.hooks.sfx('horse');
    return true;
  }
  rushes = 0;
  /** 本局已击败中途敌将（之后才出现直取敌将） */
  midBossDown = false;
  /** 身边敌人 / 目标数量（平滑） */
  screenFill = 0.1;

  private updateDirector(dt: number) {
    this.directorT -= dt;
    if (this.directorT > 0) return;
    this.directorT = 1;
    // 玩家身边（约 200×200 范围）的敌人远少于应有数量，说明敌人还没靠近就被清光：慢慢加血；身边热闹起来后回落
    if (this.targetDensity <= 0) return;
    const p = this.player;
    let near = 0;
    for (const e of this.enemies) if (!e.dead && !e.boss && Math.abs(e.x - p.x) < 100 && Math.abs(e.y - p.y) < 100) near++;
    const fill = near / this.targetDensity;
    this.screenFill += (fill - this.screenFill) * 0.15;
    this.recentDmg *= 0.9;
    this.expRate += (this.expRaw - this.expRate) * 0.1;
    this.expRaw = 0;
    this.dominantT = this.screenFill < 0.08 && this.recentDmg < this.player.maxHp * 0.04 ? this.dominantT + 1 : 0;
    if (this.screenFill < 0.03 && this.t > 120) this.director = Math.min(3, this.director + 0.04);
    else if (this.screenFill > 0.06) this.director = Math.max(1, this.director - 0.02);
  }

  /** 后期人海程度：4 分钟起逐步提高，10 分钟达到最大 */
  crowdRamp(): number {
    return clamp((this.ct - 240) / 360, 0, 1);
  }

  /** 本模式的锦囊时间点 */
  get stratTimes(): number[] {
    return this.chapter.defense ? STRAT_TIMES_DEFENSE : this.chapter.endless ? STRAT_TIMES_ENDLESS : STRAT_TIMES;
  }

  /** 章节时间：章节一局压到 6 分钟后，成长曲线仍按 10 分钟设计，用实际秒数 ÷ 0.6 换算；无尽 / 新手试炼就是实际秒数 */
  get ct(): number {
    const ch = this.chapter;
    return ch.endless || ch.tutorial || ch.defense ? this.t : this.t / CHAPTER_TIME_SCALE;
  }

  spawnEnemy(id: string, x: number, y: number, opts: { elite?: boolean; hpMul?: number } = {}): Enemy {
    const d = ENEMIES[id];
    const e = newEnemy();
    const ch = this.chapter;
    const minute = this.ct / 60;
    // 无尽模式：二次曲线成长，后期压力越来越大
    const late = Math.max(0, minute - 4);
    // 1.0.4：无尽模式后段涨得更快（二次项 0.05→0.22），一局压到 12~18 分钟；每周挑战（有时长）不变
    const endlessQ = ch.endless && ch.duration >= 1e8 ? 0.22 : 0.05;
    const grow = ch.endless ? 1 + ch.growth * minute + endlessQ * minute * minute : 1 + ch.growth * minute + 0.05 * late * late;
    // 后期敌人更多，同时血量再略微提高
    const hpScale = ch.hpMul * grow * this.enemyHpMul * (opts.hpMul || 1) * (1 + 0.3 * this.crowdRamp()) * this.director * this.stratHpMul * (ch.endless || ch.tutorial || ch.defense ? 1 : tension(this.ct, ch.id));
    e.uid = this.uidSeq++;
    e.def = d;
    e.x = x;
    e.y = y;
    e.r = d.radius;
    e.maxHp = e.hp = Math.round(d.hp * hpScale * (opts.elite ? 14 : 1));
    e.speed = d.speed * rand(0.92, 1.08) * (opts.elite ? 0.9 : 1);
    e.dmg = d.dmg * ch.dmgMul * (ch.endless ? 1 + 0.1 * minute + (endlessQ > 0.05 ? 0.06 : 0.012) * minute * minute : (1 + 0.04 * minute) * chapterDmgMul(ch)) * (opts.elite ? 1.5 : 1) * this.enemyDmgMul;
    e.mass = (d.mass || 1) * (opts.elite ? 8 : 1);
    // 敌人变多后单个经验相应减少，升级节奏不变（大军压境的弱兵经验减半）
    // 动态难度加血时经验同比减少，强势构筑不会越滚越快
    e.exp = (d.exp * (opts.elite ? 20 : 1) * (opts.hpMul || 1)) / (opts.elite ? 1 : (1 + this.crowdRamp()) * this.director);
    e.sprite = 'u_' + d.sprite;
    e.elite = !!opts.elite;
    e.born = this.t;
    e.scale = opts.elite ? 2 : 1;
    if (opts.elite) e.r = d.radius * 1.8;
    this.enemies.push(e);
    return e;
  }

  spawnBoss(id: string, x: number, y: number, isFinal: boolean, hpScale = 1): Enemy {
    const d = BOSSES[id];
    const e = newEnemy();
    e.uid = this.uidSeq++;
    e.boss = d;
    e.isMidBoss = !isFinal;
    e.x = x;
    e.y = y;
    e.r = d.radius;
    const ch = this.chapter;
    const strong = ch.tutorial ? 1 : BOSS_HP;
    const normal = !ch.tutorial && !ch.endless && !ch.defense;
    // 第 1 章也按战力加血，但幅度小一些（新手友好）
    const over = normal ? Math.pow(Math.max(1, this.powerRatio), ch.id > 1 ? BOSS_POWER_EXP : 0.4) : 1;
    e.maxHp = e.hp = Math.round(d.hp * this.enemyHpMul * hpScale * this.stratHpMul * strong * over);
    e.born = this.t;
    if (normal) e.minTime = ch.id === 1 ? (isFinal ? BOSS_MIN_TIME.ch1Final : BOSS_MIN_TIME.ch1Mid) : isFinal ? BOSS_MIN_TIME.final : BOSS_MIN_TIME.mid;
    e.speed = d.speed;
    e.dmg = d.dmg * this.enemyDmgMul * (this.chapter.tutorial ? 1 : BOSS_DMG);
    e.mass = 50;
    e.exp = isFinal ? 200 : 100;
    e.sprite = 'u_' + d.sprite;
    e.scale = 2;
    e.state = 'move';
    e.stateT = 2;
    e.bskills = this.chapter.tutorial ? d.skills.filter((s) => BASIC_BOSS_SKILLS.includes(s)) : d.skills.slice();
    this.enemies.push(e);
    if (isFinal) this.finalBoss = e; else this.midBoss = e;
    this.hooks.bossAppear(d);
    return e;
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    const viewR = Math.hypot(this.viewW, this.viewH) / 2;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.atkCd = Math.max(0, e.atkCd - dt);
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      const spd = e.speed * (1 - e.slow);
      // 守城：敌人的目标可能是城池或我方士兵
      const tgt = this.def ? enemyTarget(this, e) : null;
      let dx = (tgt ? tgt.x : p.x) - e.x, dy = (tgt ? tgt.y : p.y) - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;

      if (e.boss) {
        updateBoss(this, e, dt, dx, dy, d);
      } else if (e.fixedDir) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.life -= dt;
        if (e.life <= 0) { e.dead = true; continue; }
      } else if (e.def!.ai === 'ranged' && !(tgt && tgt.path)) {
        const range = e.def!.range || 90;
        let mv = 0;
        if (d > range + 10) mv = 1; else if (d < range - 20) mv = -0.6;
        e.x += dx * spd * mv * dt;
        e.y += dy * spd * mv * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && d < range + 40 && e.slow < 1) {
          e.shootT = e.def!.shootCd || 3;
          this.enemyShoot(e.x, e.y - 6, dx, dy, 90, e.dmg * SHOT_DMG, e.def!.proj || 'arrow');
        }
      } else {
        e.x += dx * spd * dt;
        e.y += dy * spd * dt;
      }
      if (!e.fixedDir) e.left = dx < 0;
      e.anim += dt * (spd / 8);

      // 击退
      if (e.kx || e.ky) {
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        const damp = Math.pow(0.0005, dt);
        e.kx *= damp;
        e.ky *= damp;
        if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0;
      }

      // 分离（避免挤成一团）
      if (!e.fixedDir) {
        const near = this.grid.query(e.x, e.y, e.r * 2, this.tmp);
        for (let i = 0; i < near.length; i++) {
          const o = near[i];
          if (o === e || o.dead) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const rr = e.r + o.r;
          const dd = ox * ox + oy * oy;
          if (dd < rr * rr && dd > 0.0001) {
            const dl = Math.sqrt(dd);
            const push = ((rr - dl) / dl) * 0.5;
            const wE = o.mass / (e.mass + o.mass);
            e.x += ox * push * wE;
            e.y += oy * push * wE;
          }
        }
      }

      // 守城：攻城 / 打士兵
      if (tgt && (tgt.city || tgt.ally || tgt.path) && !e.fixedDir) { if (!tgt.path) enemyContact(this, e, tgt); continue; }
      // 接触伤害
      const cr = e.r + p.r * 0.7;
      if (d < cr) {
        if (!e.touching) { e.touching = true; e.atkCd = Math.max(e.atkCd, 0.35); }
        if (e.atkCd <= 0) {
          e.atkCd = 1.1;
          if (this.contactIframe <= 0 && p.iframe <= 0 && !this.ult) this.fx.push({ kind: 'slash', x: p.x, y: p.y - 8, t: 0, dur: 0.2, a: Math.atan2(-dy, -dx), w: 1.1, r: 11, color: '#e43b44' });
          this.hurtPlayer(e.dmg * CONTACT_DMG, true);
        }
      } else e.touching = false;

      // 远离玩家的普通敌人：重新放到玩家前进方向的视野外
      if (!this.def && !e.boss && !e.elite && !e.fixedDir && d > viewR + 120) {
        const a = Math.atan2(p.dirY, p.dirX) + rand(-1.2, 1.2);
        e.x = p.x + Math.cos(a) * (viewR + 20);
        e.y = p.y + Math.sin(a) * (viewR + 20);
      }
    }
  }

  enemyShoot(x: number, y: number, dx: number, dy: number, speed: number, dmg: number, sprite: string) {
    this.shots.push({ x, y, vx: dx * speed, vy: dy * speed, r: 3, dmg, life: 4, sprite, rot: Math.atan2(dy, dx), spin: sprite === 'stone' || sprite === 'fork' });
  }

  hurtPlayer(dmg: number, contact = false) {
    const p = this.player;
    if (p.iframe > 0 || this.dead || this.ult || (this.def && this.def.downT > 0)) return;
    if (contact && this.contactIframe > 0) return;
    if (this.mirrorCd > 0 && this.mirrorT <= 0) {
      // 护心镜：抵挡这次伤害
      this.mirrorT = this.mirrorCd;
      p.iframe = 0.5;
      this.fx.push({ kind: 'ring', x: p.x, y: p.y - 8, t: 0, dur: 0.35, r: 26, color: '#c0cbdc' });
      this.hooks.sfx('hit');
      return;
    }
    const v = Math.max(1, dmg * this.dmgTakenMul);
    p.hp -= v;
    this.recentDmg += v;
    this.statDmgTaken += v;
    p.iframe = 0.12;
    if (contact) this.contactIframe = 0.3;
    if (this.hero.id === 'zhangfei' && this.rageLock <= 0) this.rage = Math.min(RAGE_MAX, this.rage + 6 * this.rageMul);
    p.hurtFlash = 0.2;
    this.hooks.sfx('hurt');
    this.hooks.vibrate();
    if (this.showDamage) this.addNum(p.x, p.y - 22, Math.round(v), 'r');
  }

  /** 守城：我方士兵 / 城防造成的伤害（不吃武将自身的加成），返回是否击杀 */
  allyDamage(e: Enemy, dmg: number): boolean {
    if (e.dead) return false;
    let v = Math.max(1, Math.round(dmg * rand(0.92, 1.08)));
    if (e.boss || e.elite) v = Math.round(v * 0.6);
    if (e.shield > 0) {
      const a = Math.min(e.shield, v);
      e.shield -= a; v -= a;
      if (e.shield <= 0) this.breakShield(e);
    }
    e.hp -= v;
    e.flash = 0.06;
    if (this.showDamage && v > 0 && Math.random() < 0.25) this.addNum(e.x + rand(-4, 4), e.y - 10 * e.scale, v, 'g');
    if (e.hp <= 0) {
      if (this.def) this.def.allyKills++;
      this.killEnemy(e);
      return true;
    }
    return false;
  }

  /** 对敌人造成伤害，返回是否击杀 */
  damage(e: Enemy, base: number, kx = 0, ky = 0, knock = 0, opts: { noCrit?: boolean; force?: boolean } = {}): boolean {
    if (e.dead) return false;
    // 屏幕外的敌人打不到：敌人一定会先出现在玩家眼前（大招除外）
    if (!opts.force && !e.boss && !this.canHit(e)) return false;
    let dmg = base * this.dmgMul * this.dynMul;
    // 守城主打兵种和建筑：武将本人伤害打折
    if (this.def) dmg *= DEF_HERO_DMG;
    if (this.hero.id === 'zhaoyun' && this.player.hp < this.player.maxHp * 0.3) dmg *= 1.3; // 一身是胆
    if (this.hero.id === 'dianwei' && this.player.hp < this.player.maxHp * 0.5) dmg *= 1.25; // 古之恶来
    if (this.hero.id === 'machao' && this.player.moving) dmg *= 1.15; // 神威天将军
    if (e.boss) dmg *= (1 + this.base.bossDmg / 100) * (this.hero.id === 'zhangfei' ? 1.3 : this.hero.id === 'huangzhong' ? 1.2 : 1);
    if (e.boss || e.elite) dmg *= 1 + this.eliteDmg;
    let crit = false;
    if (!opts.noCrit && Math.random() < this.crit) { dmg *= this.critDmg; crit = true; }
    dmg = Math.max(1, Math.round(dmg * rand(0.92, 1.08)));
    // 护盾先挡伤害，打破时敌将硬直（护盾不受保底时长影响，否则战力高的玩家反而难破盾）
    let toHp = dmg, broke = false;
    if (e.shield > 0) {
      const a = Math.min(e.shield, dmg);
      e.shield -= a;
      toHp -= a;
      broke = e.shield <= 0;
    }
    // 敌将保底战斗时长：血量比「按时间匀速掉」还低时，打到血条上的伤害只剩 1/4
    if (toHp > 0 && e.minTime > 0 && (e.hp - toHp) / e.maxHp < 1 - (this.t - e.born) / e.minTime) {
      const cut = Math.max(1, Math.round(toHp * 0.25));
      dmg -= toHp - cut;
      toHp = cut;
    }
    e.hp -= toHp;
    if (broke) this.breakShield(e);
    // 敌将战没有小怪攒怒气：打敌将本身也涨怒气（打掉一整条血约 80 点）
    if (e.boss && !this.ult && this.rageLock <= 0) this.rage = Math.min(RAGE_MAX, this.rage + (dmg / e.maxHp) * 80 * this.rageMul);
    e.hits++;
    e.flash = 0.08;
    if (kx || ky) { e.hx = kx; e.hy = ky; }
    if (knock && !e.boss) {
      const k = knock / Math.sqrt(e.mass);
      e.kx += kx * k * 3;
      e.ky += ky * k * 3;
    }
    if (crit && knock >= 50) this.addHitStop(0.035);
    if (this.showDamage) this.addNum(e.x + rand(-4, 4), e.y - 10 * e.scale - rand(0, 6), dmg, crit ? 'y' : 'w', crit);
    this.hooks.sfx('hit');
    if (e.hp <= 0) {
      this.killEnemy(e);
      return true;
    }
    return false;
  }

  /** 敌将举盾：限时内打破就硬直，打不破就狂暴（boss.ts 里计时） */
  raiseShield(e: Enemy) {
    e.shieldDone = true;
    e.shieldMax = e.shield = Math.round(e.maxHp * BOSS_SHIELD);
    e.shieldT = BOSS_SHIELD_TIME;
    this.hooks.banner(`${e.boss!.name}举盾固守！${BOSS_SHIELD_TIME}秒内打破护盾`, '#2ce8f5');
    this.hooks.sfx('boss');
    this.fx.push({ kind: 'ring', x: e.x, y: e.y - 10, t: 0, dur: 0.6, r: 60, color: '#2ce8f5' });
  }

  private breakShield(e: Enemy) {
    this.statShield[0]++;
    e.shield = 0;
    e.shieldT = 0;
    e.state = 'rest';
    e.stateT = 3.5;
    e.slow = 1;
    e.slowT = 3.5;
    this.hooks.banner('护盾击破！敌将硬直', '#fee761');
    this.hooks.shake(5);
    this.hooks.sfx('explode');
    this.fx.push({ kind: 'ring', x: e.x, y: e.y - 10, t: 0, dur: 0.5, r: 70, color: '#ffffff' });
    this.fx.push({ kind: 'text', x: e.x, y: e.y - 44, t: 0, dur: 1.4, text: '破盾！', color: '#2ce8f5' });
  }

  enrageBoss(e: Enemy) {
    this.statShield[1]++;
    e.shield = 0;
    e.shieldT = 0;
    e.enraged = true;
    e.dmg *= 1.25;
    e.speed *= 1.25;
    this.hooks.banner(`${e.boss!.name}狂暴了！`, '#e43b44');
    this.hooks.sfx('boss');
    this.fx.push({ kind: 'text', x: e.x, y: e.y - 44, t: 0, dur: 1.4, text: '狂暴！', color: '#e43b44' });
  }

  killEnemy(e: Enemy) {
    e.dead = true;
    this.kills++;
    this.combo++;
    this.comboT = 2.5;
    if (e.def) this.killsBy[e.def.id] = (this.killsBy[e.def.id] || 0) + 1;
    if (!e.boss && !e.elite && !e.fixedDir) {
      this.killAge += (this.t - e.born - this.killAge) * 0.01;
      this.statKills++;
      if (e.hits <= 1) this.statOneShots++;
    }
    if (e.boss) this.bossesKilled.push(e.boss.id);
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if (this.combo === 100 || this.combo === 300 || this.combo === 500 || this.combo % 1000 === 0) {
      this.hooks.banner(this.combo >= 1000 ? `${this.combo / 1000}千人斩！` : this.combo === 100 ? '百人斩！' : `${this.combo}连斩！`, '#fee761');
      this.hooks.sfx('levelup');
    }
    if (!this.ult && this.rageLock <= 0) this.rage = Math.min(RAGE_MAX, this.rage + (e.boss ? 30 : e.elite ? 12 : 0.45) * this.rageMul);
    const ration = this.passiveLv('ration');
    if (ration) this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.0002 * ration);
    this.hooks.sfx('kill');
    this.spawnCorpse(e);
    // 掉落
    if (e.boss) {
      this.bossKills++;
      this.equipDrops++;
      this.addHitStop(0.3, true);
      this.hooks.shake(8);
      this.hooks.vibrate(true);
      this.hooks.sfx('explode');
      this.fx.push({ kind: 'explo', x: e.x, y: e.y - 10, t: 0, dur: 0.5 });
      this.fx.push({ kind: 'text', x: e.x, y: e.y - 50, t: 0, dur: 2.2, text: (this.hero.id === 'zhaoyun' && e.boss.zyQuote) || e.boss.quote.replace('{name}', this.hero.name), color: '#fee761' });
      this.dropPickup('chest', e.x, e.y, 1, true);
      for (let i = 0; i < 12; i++) this.dropPickup('coin', e.x + rand(-20, 20), e.y + rand(-20, 20), 5);
      this.dropGem(e.x + 10, e.y, e.exp);
      if (e === this.finalBoss) {
        this.finalBossSec = this.t - e.born;
        this.finalBoss = null;
        // 清场
        for (const o of this.enemies) if (!o.dead && o !== e) { o.dead = true; this.fx.push({ kind: 'puff', x: o.x, y: o.y, t: 0, dur: 0.3 }); }
        this.won = true;
      }
      if (e === this.midBoss) { this.midBoss = null; this.midBossDown = true; }
      return;
    }
    if (e.elite) {
      this.addHitStop(0.08, true);
      this.hooks.shake(3);
      this.hooks.vibrate();
      this.dropPickup('chest', e.x, e.y, 1, false);
      this.dropPickup('magnet', e.x + 12, e.y + 4, 1);
      this.dropGem(e.x + 6, e.y, e.exp);
      for (let i = 0; i < (this.stratSet.has('chenhuo') ? 6 : 3); i++) this.dropPickup('coin', e.x + rand(-10, 10), e.y + rand(-10, 10), 2);
      return;
    }
    if (this.stratSet.has('lianhuan') && Math.random() < 0.2) this.chainQueue.push({ x: e.x, y: e.y });
    if (Math.random() < (this.stratSet.has('chenhuo') ? 0.07 : 0.035)) this.dropPickup('coin', e.x, e.y, 1);
    // 小兵小概率掉磁石（有冷却，避免刷屏）
    if (this.magnetCd <= 0 && Math.random() < 0.004) { this.dropPickup('magnet', e.x, e.y, 1); this.magnetCd = 25; }
    this.dropGem(e.x, e.y, e.exp);
  }

  dropGem(x: number, y: number, value: number) {
    if (this.gemCount > 150) {
      // 宝石过多：合并到一颗大宝石里，避免卡顿
      if (!this.overflowGem || !this.pickups.includes(this.overflowGem)) {
        this.overflowGem = this.dropPickup('gem', x, y, 0);
      }
      this.overflowGem.value += value;
      return;
    }
    this.dropPickup('gem', x, y, value);
  }

  dropPickup(kind: Pickup['kind'], x: number, y: number, value: number, boss = false): Pickup {
    // 守城：掉在山林外（敌人在出怪口外被打死）的东西挪到场地里面，保证捡得到
    if (this.def) { const dd = Math.hypot(x, y), R = ARENA_R - 16; if (dd > R) { x *= R / dd; y *= R / dd; } }
    const pk: Pickup = { kind, x, y, value, vx: 0, vy: 0, pulled: false, t: 0, boss };
    if (kind === 'gem') this.gemCount++;
    this.pickups.push(pk);
    return pk;
  }

  // —— 投射物 ——
  private updateProjectiles(dt: number) {
    const near: Enemy[] = [];
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.life -= dt;
      if (pr.kind === 'pot') {
        pr.t += dt;
        const k = Math.min(1, pr.t / pr.dur);
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.rot += dt * 12;
        if (k >= 1) {
          // 落地先爆炸，再留下火海
          const near2: Enemy[] = [];
          this.grid.query(pr.tx, pr.ty, pr.area + 12, near2);
          for (const e of near2) {
            if (e.dead) continue;
            const dx = e.x - pr.tx, dy = e.y - pr.ty;
            const d = Math.hypot(dx, dy) || 1;
            if (d < pr.area + e.r) this.damage(e, pr.dmg * 4, dx / d, dy / d, 40);
          }
          this.fx.push({ kind: 'explo', x: pr.tx, y: pr.ty + 6, t: 0, dur: 0.35 });
          this.pools.push({ x: pr.tx, y: pr.ty, r: pr.area, dmg: pr.dmg, tick: pr.tick, tickT: 0, life: pr.burn, maxLife: pr.burn, slow: pr.slow });
          this.hooks.sfx('fire');
          this.projs.splice(i, 1);
        }
        continue;
      }
      if (pr.kind === 'rock' || pr.kind === 'boulder') {
        pr.t += dt;
        if (pr.kind === 'boulder') { pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.rot += dt * 6; }
        if (pr.t >= pr.dur) {
          this.impact(pr.tx, pr.ty, pr.area, pr.dmg, pr.knock, pr.stun);
          if (pr.kind === 'boulder') {
            this.fx.push({ kind: 'explo', x: pr.tx, y: pr.ty + 6, t: 0, dur: 0.4 });
            this.fx.push({ kind: 'ring', x: pr.tx, y: pr.ty, t: 0, dur: 0.35, r: pr.area * 1.2, color: '#feae34' });
            this.hooks.sfx('explode');
            if (pr.second) {
              // 霹雳炮：碎石二次爆裂
              const sec = newProjectile('rock');
              sec.tx = sec.x = pr.tx; sec.ty = sec.y = pr.ty;
              sec.dur = 0.3; sec.area = pr.area * 0.8; sec.dmg = pr.dmg * 0.5; sec.knock = pr.knock * 0.6; sec.life = 1; sec.scale = 0;
              this.projs.push(sec);
            }
          } else if (pr.sprite === 'icon_w_meteor') {
            // 姜维的星辰：落地迸出星芒（进化后八道）
            this.fx.push({ kind: 'ring', x: pr.tx, y: pr.ty, t: 0, dur: 0.3, r: pr.area * 1.3, color: '#8fb8ff' });
            const n = pr.second ? 8 : 4, a0 = rand(TAU);
            for (let k = 0; k < n; k++) {
              const a = a0 + (k / n) * TAU;
              const sh = newProjectile('bolt');
              sh.x = pr.tx; sh.y = pr.ty - 4;
              sh.vx = Math.cos(a) * 200; sh.vy = Math.sin(a) * 200;
              sh.rot = a; sh.dmg = pr.dmg * 0.4; sh.pierce = 2; sh.knock = 10; sh.r = 3; sh.life = 0.4;
              sh.sprite = 'bolt_evo';
              this.projs.push(sh);
            }
            this.hooks.sfx('hit');
          } else {
            this.fx.push({ kind: 'puff', x: pr.tx, y: pr.ty - 2, t: 0, dur: 0.3, big: pr.scale >= 3 });
            if (pr.scale === 0) this.fx.push({ kind: 'explo', x: pr.tx, y: pr.ty + 6, t: 0, dur: 0.35 });
            this.hooks.sfx('hit');
          }
          this.projs.splice(i, 1);
        }
        continue;
      }
      if (pr.kind === 'knife') {
        pr.t += dt;
        pr.rot += dt * 22;
        if (!pr.back && pr.t >= pr.dur) { pr.back = true; pr.hitSet.clear(); }
        if (pr.back) {
          const dx = this.player.x - pr.x, dy = this.player.y - 8 - pr.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 10) { this.projs.splice(i, 1); continue; }
          const sp = Math.max(Math.hypot(pr.vx, pr.vy), 120);
          pr.vx = (dx / d) * sp; pr.vy = (dy / d) * sp;
        }
      }
      if (pr.kind === 'tornado') {
        if (pr.life <= 0) { this.projs.splice(i, 1); continue; }
        this.updateTornado(pr, dt, near);
        continue;
      }
      if (pr.kind === 'wind') {
        // 追踪：缓慢转向最近的敌人
        pr.t -= dt;
        if (pr.t <= 0) {
          pr.t = 0.12;
          this.grid.query(pr.x, pr.y, 90, near);
          let best: Enemy | null = null, bd = 1e9;
          for (const e of near) { if (e.dead || pr.hitSet.has(e.uid)) continue; const d = (e.x - pr.x) ** 2 + (e.y - 6 - pr.y) ** 2; if (d < bd) { bd = d; best = e; } }
          if (best) { pr.tx = best.x; pr.ty = best.y - 6; }
        }
        if (pr.tx || pr.ty) {
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          const want = Math.atan2(pr.ty - pr.y, pr.tx - pr.x), cur = Math.atan2(pr.vy, pr.vx);
          let da = want - cur;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const na = cur + clamp(da, -6 * dt, 6 * dt);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
        pr.rot = Math.atan2(pr.vy, pr.vx);
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.life <= 0) { this.projs.splice(i, 1); continue; }
      // 飞出屏幕的弩箭、风刃、飞刀直接消失
      if (pr.kind !== 'horse' && pr.kind !== 'knife' && !this.inView(pr.x, pr.y, this.finalBoss || this.midBoss ? 120 : 6)) { this.projs.splice(i, 1); continue; }
      this.grid.query(pr.x, pr.y, pr.r + 20, near);
      let removed = false;
      for (const e of near) {
        if (e.dead || pr.hitSet.has(e.uid)) continue;
        const rr = pr.r + e.r;
        if ((e.x - pr.x) ** 2 + (e.y - 4 * e.scale - pr.y) ** 2 > rr * rr) continue;
        pr.hitSet.add(e.uid);
        const vl = Math.hypot(pr.vx, pr.vy) || 1;
        this.damage(e, pr.dmg, pr.vx / vl, pr.vy / vl, pr.knock);
        if (pr.kind === 'bolt') this.fx.push({ kind: 'spark', x: pr.x, y: pr.y, t: 0, dur: 0.18 });
        pr.pierce--;
        if (pr.pierce <= 0) { this.projs.splice(i, 1); removed = true; break; }
      }
      if (!removed) this.hitBreakables(pr.x, pr.y, pr.r);
    }
  }

  /** 落点范围伤害（礌石 / 巨石） */
  private impact(x: number, y: number, R: number, dmg: number, knock: number, stun: number) {
    const near: Enemy[] = [];
    this.grid.query(x, y, R + 12, near);
    for (const e of near) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R + e.r || (!e.boss && !this.canHit(e))) continue;
      this.damage(e, dmg, dx / d, dy / d, knock);
      if (stun && !e.dead) { e.slow = 1; e.slowT = Math.max(e.slowT, e.boss ? stun * 0.3 : stun); }
    }
    this.hitBreakables(x, y, R);
  }

  private updateTornado(pr: Projectile, dt: number, near: Enemy[]) {
    // 游走：随机转向，并略微追向敌群
    pr.rot += dt * 14;
    if (Math.random() < dt * 1.5) { const a = rand(TAU); pr.vx = pr.vx * 0.5 + Math.cos(a) * 30; pr.vy = pr.vy * 0.5 + Math.sin(a) * 30; }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.t -= dt;
    this.grid.query(pr.x, pr.y, pr.r * 1.8, near);
    for (const e of near) {
      if (e.dead || e.boss) continue;
      const dx = pr.x - e.x, dy = pr.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < pr.r * 1.8) { e.x += (dx / d) * 50 * dt; e.y += (dy / d) * 50 * dt; }
    }
    if (pr.t <= 0) {
      pr.t = pr.tick;
      for (const e of near) {
        if (e.dead) continue;
        if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 > (pr.r + e.r) ** 2) continue;
        this.damage(e, pr.dmg, 0, 0, 0, { noCrit: true, force: true });
      }
      this.hitBreakables(pr.x, pr.y, pr.r);
    }
  }

  private updatePools(dt: number) {
    const near: Enemy[] = [];
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const f = this.pools[i];
      f.life -= dt;
      if (f.life <= 0) { this.pools.splice(i, 1); continue; }
      f.tickT -= dt;
      if (f.tickT <= 0) {
        f.tickT = f.tick;
        this.grid.query(f.x, f.y, f.r + 10, near);
        for (const e of near) {
          if (e.dead) continue;
          if ((e.x - f.x) ** 2 + ((e.y - f.y) * 1.4) ** 2 > (f.r + e.r) ** 2) continue;
          if (f.slow) { e.slow = Math.max(e.slow, f.slow); e.slowT = 0.5; }
          this.damage(e, f.dmg, 0, 0, 0, { noCrit: true });
        }
        this.hitBreakables(f.x, f.y, f.r);
      }
    }
  }

  private updateShots(dt: number) {
    const p = this.player;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.spin) s.rot += dt * 10;
      if (s.life <= 0) { this.shots.splice(i, 1); continue; }
      if (this.def && shotHitsCity(s.x, s.y)) { hurtCity(this, s.dmg * (s.sprite === 'stone' ? 1 : 0.25), 'shot_' + s.sprite); this.shots.splice(i, 1); continue; }
      if ((s.x - p.x) ** 2 + (s.y - (p.y - 8)) ** 2 < (s.r + p.r * 0.8) ** 2) {
        this.hurtPlayer(s.dmg);
        this.shots.splice(i, 1);
        if (this.stratSet.has('caochuan') && this.caochuanCd <= 0) this.caochuanVolley();
      }
    }
  }

  /** 草船借箭：向四周射出箭矢 */
  private caochuanVolley() {
    this.caochuanCd = 0.6;
    const p = this.player;
    const a0 = rand(TAU);
    for (let i = 0; i < 8; i++) {
      const a = a0 + (i / 8) * TAU;
      const pr = newProjectile('bolt');
      pr.x = p.x; pr.y = p.y - 8;
      pr.vx = Math.cos(a) * 260; pr.vy = Math.sin(a) * 260;
      pr.rot = a; pr.dmg = this.base.atk * 2; pr.pierce = 2; pr.knock = 20; pr.r = 4; pr.life = 1.2;
      this.projs.push(pr);
    }
    this.hooks.sfx('shoot');
  }

  // —— 拾取 ——
  private updatePickups(dt: number) {
    const p = this.player;
    const pr2 = this.pickupR * this.pickupR;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      const dx = p.x - k.x, dy = p.y - 6 - k.y;
      const d2 = dx * dx + dy * dy;
      if (!k.pulled && (k.kind === 'gem' || k.kind === 'coin') && (d2 < pr2 || (k.t > 9 && d2 < 220 * 220) || (this.def && k.t > 0.6))) k.pulled = true;
      if (!k.pulled && k.kind !== 'gem' && k.kind !== 'coin' && d2 < 18 * 18) k.pulled = true;
      if (k.pulled) {
        const d = Math.sqrt(d2) || 1;
        const sp = 140 + k.t * 60;
        k.vx += (dx / d) * sp * dt * 8;
        k.vy += (dy / d) * sp * dt * 8;
        const vl = Math.hypot(k.vx, k.vy);
        const maxV = 260 + k.t * 40;
        if (vl > maxV) { k.vx *= maxV / vl; k.vy *= maxV / vl; }
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        if (d < 8) {
          this.collect(k);
          this.pickups.splice(i, 1);
        }
      }
    }
  }

  private collect(k: Pickup) {
    const p = this.player;
    switch (k.kind) {
      case 'gem':
        this.gemCount--;
        this.gainExp(k.value);
        this.hooks.sfx('gem');
        break;
      case 'coin':
        this.coins += Math.max(1, Math.round(k.value * this.goldMul));
        this.hooks.sfx('coin');
        break;
      case 'bun': {
        const heal = Math.round(p.maxHp * 0.3);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        this.addNum(p.x, p.y - 24, heal, 'g');
        this.hooks.sfx('coin');
        break;
      }
      case 'magnet':
        for (const o of this.pickups) if (o.kind === 'gem' || o.kind === 'coin') { o.pulled = true; o.t = Math.max(o.t, 1.5); }
        this.hooks.sfx('levelup');
        this.hooks.vibrate();
        this.hooks.banner('磁石：吸取全部经验！', '#2ce8f5');
        this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.5, r: Math.max(this.viewW, this.viewH) * 0.7, color: '#2ce8f5' });
        break;
      case 'bomb':
        this.hooks.sfx('explode');
        this.hooks.shake(5);
        this.fx.push({ kind: 'explo', x: p.x, y: p.y, t: 0, dur: 0.5 });
        this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.5, r: Math.max(this.viewW, this.viewH) * 0.7, color: '#feae34' });
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - p.x) < this.viewW / 2 + 10 && Math.abs(e.y - p.y) < this.viewH / 2 + 10) {
            if (e.boss || e.elite) this.damage(e, this.base.atk * 8, 0, 0, 0);
            else this.killEnemy(e);
          }
        }
        break;
      case 'chest':
        this.pendingChests.push({ boss: k.boss });
        this.hooks.sfx('chest');
        break;
    }
  }

  gainExp(v: number) {
    this.expRaw += v;
    this.expTotal += v;
    this.exp += v * this.expMul;
    while (this.exp >= this.expNeed) {
      this.exp -= this.expNeed;
      this.level++;
      this.expNeed = expToNext(this.level);
      this.pendingLevelUps++;
    }
  }

  // —— 可破坏物 ——
  spawnBreakable(x: number, y: number) {
    this.breakables.push({ x, y, r: 6, hp: 1, kind: Math.random() < 0.6 ? 'lantern' : 'cart', flash: 0, hits: 0 });
  }

  hitBreakables(x: number, y: number, r: number) {
    for (let i = this.breakables.length - 1; i >= 0; i--) {
      const b = this.breakables[i];
      if ((b.x - x) ** 2 + (b.y - 6 - y) ** 2 > (b.r + r) ** 2) continue;
      this.breakables.splice(i, 1);
      this.fx.push({ kind: 'puff', x: b.x, y: b.y - 6, t: 0, dur: 0.3 });
      const roll = Math.random();
      const kind = roll < 0.35 ? 'bun' : roll < 0.55 ? 'magnet' : roll < 0.7 ? 'bomb' : 'coin';
      if (kind === 'coin') for (let j = 0; j < 4; j++) this.dropPickup('coin', b.x + rand(-8, 8), b.y + rand(-6, 6), 2);
      else this.dropPickup(kind, b.x, b.y, 1);
    }
  }

  private updateBreakables(dt: number) {
    const p = this.player;
    for (let i = this.breakables.length - 1; i >= 0; i--) {
      const b = this.breakables[i];
      // 太远就移除
      if (Math.abs(b.x - p.x) > this.viewW * 1.5 || Math.abs(b.y - p.y) > this.viewH * 1.5) this.breakables.splice(i, 1);
    }
    void dt;
  }

  // —— 打击感 ——
  addHitStop(sec: number, force = false) {
    if (this.ult) return;
    if (!force && this.hitStopCd > 0) return;
    this.hitStop = Math.max(this.hitStop, sec);
    // 普通命中的顿帧至少隔 0.6 秒一次，太密会像画面一卡一卡
    this.hitStopCd = 0.6;
  }

  private spawnCorpse(e: Enemy) {
    if (e.boss) return;
    let corpses = 0;
    for (const f of this.fx) if (f.kind === 'corpse') corpses++;
    if (corpses > 45) { this.fx.push({ kind: 'puff', x: e.x, y: e.y - 4 * e.scale, t: 0, dur: 0.3, big: e.scale > 1 }); return; }
    let hx = e.hx, hy = e.hy;
    if (!hx && !hy) { const dx = e.x - this.player.x, dy = e.y - this.player.y; const d = Math.hypot(dx, dy) || 1; hx = dx / d; hy = dy / d; }
    const power = rand(110, 170) * (this.ult ? 1.6 : 1);
    this.fx.push({
      kind: 'corpse', x: e.x, y: e.y, t: 0, dur: 0.55, sprite: `${e.sprite}_${Math.floor(e.anim) % 4}${e.left ? '_L' : ''}`,
      vx: hx * power, vy: -rand(90, 140) + hy * power * 0.5, rot: (hx >= 0 ? 1 : -1) * rand(10, 16), scale: e.scale,
    });
    this.fx.push({ kind: 'spark', x: e.x, y: e.y - 6 * e.scale, t: 0, dur: 0.18 });
  }

  // —— 怒气与大招 ——
  private updateRage(dt: number) {
    if (this.rageLock > 0) { this.rageLock -= dt; return; }
    if (!this.ult) this.rage = Math.min(RAGE_MAX, this.rage + dt * 0.6);
    // 磁石保底：场上没有磁石时，每隔一段时间在附近刷一个
    this.magnetCd = Math.max(0, this.magnetCd - dt);
    this.magnetT -= dt;
    if (this.magnetT <= 0) {
      this.magnetT = rand(65, 85);
      if (!this.pickups.some((k) => k.kind === 'magnet')) {
        const a = rand(TAU), d = rand(60, 100);
        this.dropPickup('magnet', this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, 1);
      }
    }
  }

  get rageFull() {
    return this.rage >= RAGE_MAX;
  }

  castUlt(): boolean {
    if (!this.rageFull || this.ult || this.dead || this.won) return false;
    this.rage = 0;
    this.rageLock = 18;
    this.ultCasts++;
    if (this.stratSet.has('guohe')) this.ultBuffT = this.t + 17;
    const kind = this.hero.ult;
    // 有立绘切入时不再弹横幅
    if (!this.hooks.ultCast) this.hooks.banner(this.hero.ultName.replace('·', ' · '), this.hero.color);
    this.hooks.sfx('evolve');
    this.hooks.vibrate(true);
    const p = this.player;
    const st: UltState = { kind, slow: 1, tickT: 0, rings: [], spawned: 0, idx: -1, t: 0, dur: 0, x0: p.x, y0: p.y, x1: 0, y1: 0, finale: 0 };
    this.ult = st;
    // 起手：武将本色的冲击波 + 放射光 + 粒子
    const col = this.hero.color;
    this.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: 0, dur: 0.55, r: 120, w: 14, color: col, real: true });
    this.fx.push({ kind: 'rays', x: p.x, y: p.y - 8, t: 0, dur: 0.75, r: 140, a: rand(TAU), color: col, real: true });
    this.burst(p.x, p.y - 8, 28, [col, '#ffffff', '#fee761'], 170, 0.7);
    if (this.hooks.ultCast) this.hooks.ultCast();
    switch (kind) {
      case 'dragon': st.slow = 0.12; this.nextDash(); break;
      case 'crescent': st.slow = 0.25; st.dur = 1.35; break;
      case 'roar': st.slow = 0.2; st.dur = 0.7; this.doRoar(); break;
      case 'tornado':
        st.slow = 0.3; st.dur = 0.5; this.spawnTornados();
        this.fx.push({ kind: 'bagua', x: p.x, y: p.y, t: 0, dur: 1.8, r: 78, color: '#2ce8f5', real: true });
        this.burst(p.x, p.y - 8, 24, ['#f77622', '#fee761', '#e43b44'], 120, 0.9, -60);
        break;
      case 'whirl': st.slow = 1; st.dur = 5; break;
      case 'arrowrain': st.slow = 0.35; st.dur = 1.6; break;
      case 'cavalry': st.slow = 0.4; st.dur = 1.3; this.spawnUltCavalry(); break;
      case 'arrowstorm': st.slow = 1; st.dur = 2.5; break;
      case 'frenzy':
        st.slow = 1; st.dur = 6;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
        this.frenzy = true;
        this.recalc();
        this.fx.push({ kind: 'pillar', x: p.x, y: p.y, t: 0, dur: 0.7, w: 30, len: 200, color: '#e43b44', real: true });
        this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.5, r: 60, color: '#e43b44' });
        this.fx.push({ kind: 'text', x: p.x, y: p.y - 40, t: 0, dur: 0.8, text: '主公快走，典韦在此！', color: '#ff8a80' });
        break;
      case 'starfall': st.slow = 0.5; st.dur = 3; break;
    }
    return true;
  }

  private nextDash() {
    const u = this.ult!;
    const p = this.player;
    u.idx++;
    if (u.idx >= ULT_DASHES) { u.finale = 0.45; return; }
    // 冲向敌人最密集的方向，穿过去
    let tx = 0, ty = 0;
    const vis = this.enemies.filter((e) => !e.dead && Math.abs(e.x - p.x) < this.viewW * 0.55 && Math.abs(e.y - p.y) < this.viewH * 0.5);
    if (vis.length) {
      const t = vis[(Math.random() * vis.length) | 0];
      tx = t.x - p.x; ty = t.y - p.y;
    } else { const a = rand(TAU); tx = Math.cos(a); ty = Math.sin(a); }
    const d = Math.hypot(tx, ty) || 1;
    const len = clamp(d + 50, 90, Math.min(this.viewW, this.viewH) * 0.75);
    u.x0 = p.x; u.y0 = p.y;
    u.x1 = p.x + (tx / d) * len; u.y1 = p.y + (ty / d) * len;
    u.t = 0;
    u.dur = 0.13;
    p.left = tx < 0;
    p.dirX = tx / d; p.dirY = ty / d;
    // 路径伤害
    const dx = (u.x1 - u.x0) / len, dy = (u.y1 - u.y0) / len;
    const width = 26;
    const dmg = this.base.atk * 14;
    const mx = (u.x0 + u.x1) / 2, my = (u.y0 + u.y1) / 2;
    const near = this.grid.query(mx, my, len / 2 + width + 20, []);
    for (const e of near) {
      if (e.dead) continue;
      const ex = e.x - u.x0, ey = e.y - u.y0;
      const proj = ex * dx + ey * dy;
      if (proj < -e.r || proj > len + e.r) continue;
      if (Math.abs(ex * -dy + ey * dx) > width / 2 + e.r) continue;
      const side = ex * -dy + ey * dx >= 0 ? 1 : -1;
      this.damage(e, dmg, dx * 0.6 - dy * side * 0.8, dy * 0.6 + dx * side * 0.8, 120, { force: true });
    }
    this.fx.push({ kind: 'beam', x: u.x0, y: u.y0 - 8, t: 0, dur: 0.45, a: Math.atan2(dy, dx), len, w: width });
    // 白龙：沿冲刺路线留下一条蜿蜒的发光龙身
    this.fx.push({ kind: 'dragon', x: u.x0, y: u.y0 - 8, t: 0, dur: 0.6, a: Math.atan2(dy, dx), len, w: 24, color: '#2ce8f5' });
    this.burst(u.x1, u.y1 - 8, 10, ['#ffffff', '#2ce8f5', '#8be9ff'], 140, 0.5);
    this.hooks.shake(3);
    this.hooks.sfx('thrust');
    this.hooks.sfx('horse');
  }

  /** 返回世界时间倍率 */
  private updateUlt(dt: number): number {
    const u = this.ult!;
    const p = this.player;
    p.iframe = Math.max(p.iframe, 0.6);
    if (u.kind !== 'dragon') return this.updateOtherUlt(u, dt);
    if (u.finale > 0) {
      u.finale -= dt;
      if (u.finale <= 0) {
        // 收尾：全屏冲击波
        const R = Math.max(this.viewW, this.viewH) * 0.6;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < R) this.damage(e, this.base.atk * 10, dx / d, dy / d, 150, { force: true });
        }
        this.shots.length = 0;
        this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.6, r: R, color: '#fee761' });
        this.fx.push({ kind: 'explo', x: p.x, y: p.y, t: 0, dur: 0.5 });
        // 七进七出收尾：金色巨浪 + 光柱 + 放射光
        this.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: 0, dur: 0.7, r: R * 0.9, w: 22, color: '#fee761', real: true });
        this.fx.push({ kind: 'pillar', x: p.x, y: p.y, t: 0, dur: 0.8, w: 34, len: 240, color: '#feae34', real: true });
        this.fx.push({ kind: 'rays', x: p.x, y: p.y - 8, t: 0, dur: 0.9, r: 220, color: '#fee761', real: true });
        this.burst(p.x, p.y - 8, 44, ['#fee761', '#ffffff', '#2ce8f5'], 260, 0.9);
        this.hooks.shake(9);
        this.hooks.vibrate(true);
        this.hooks.sfx('explode');
        this.ult = null;
        p.iframe = 1;
      }
      return u.slow;
    }
    u.t += dt;
    const k = Math.min(1, u.t / u.dur);
    p.x = u.x0 + (u.x1 - u.x0) * k;
    p.y = u.y0 + (u.y1 - u.y0) * k;
    this.fx.push({ kind: 'ghost', x: p.x, y: p.y, t: 0, dur: 0.3, sprite: `${this.heroSprite}_${Math.floor(p.anim) % 4}${p.left ? '_L' : ''}` });
    if (k >= 1) this.nextDash();
    return u.slow;
  }

  /** 由场景根据皮肤设置 */
  heroSpriteName = '';
  get heroSprite() {
    return this.heroSpriteName || 'hero_' + this.hero.id;
  }

  private ultEnd(u: UltState) {
    if (this.ult === u) { this.ult = null; this.player.iframe = Math.max(this.player.iframe, 0.8); }
    if (this.frenzy) { this.frenzy = false; this.recalc(); }
  }

  private updateOtherUlt(u: UltState, dt: number): number {
    const p = this.player;
    const atk = this.base.atk;
    u.t += dt;
    switch (u.kind) {
      case 'crescent': {
        // 关羽：三道巨型刀气环向外扩散
        const R = Math.hypot(this.viewW, this.viewH) * 0.55;
        while (u.spawned < 3 && u.t >= u.spawned * 0.35) {
          u.rings.push({ r: 0, hit: new Set() });
          u.spawned++;
          this.fx.push({ kind: 'shock', x: p.x, y: p.y - 6, t: 0, dur: 0.5, r: 150, w: 16, color: '#63c74d', real: true });
          this.burst(p.x, p.y - 6, 18, ['#63c74d', '#e8ffd8', '#3e8948'], 220, 0.6);
          this.hooks.shake(5);
          this.hooks.sfx('thrust');
          this.hooks.sfx('explode');
        }
        for (const ring of u.rings) {
          if (ring.r > R) continue;
          ring.r += (R / 0.55) * dt;
          for (const e of this.enemies) {
            if (e.dead || ring.hit.has(e.uid)) continue;
            const dx = e.x - p.x, dy = e.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d <= ring.r + e.r) { ring.hit.add(e.uid); this.damage(e, atk * 9, dx / d, dy / d, 140, { force: true }); }
          }
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return u.slow;
      }
      case 'roar':
        if (u.t >= u.dur) this.ultEnd(u);
        return u.slow;
      case 'tornado':
        if (u.t >= u.dur) this.ultEnd(u);
        return u.slow;
      case 'whirl': {
        // 吕布：5 秒无敌旋风
        u.tickT -= dt;
        if (u.tickT <= 0) {
          u.tickT = 0.12;
          const R = 62;
          this.grid.query(p.x, p.y, R + 16, this.tmp);
          for (const e of this.tmp) {
            if (e.dead) continue;
            const dx = e.x - p.x, dy = e.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < R + e.r) this.damage(e, atk * 2.6, dx / d, dy / d, 90, { force: true });
          }
          this.hitBreakables(p.x, p.y, R);
          this.hooks.sfx('thrust');
          // 吕布旋风：周身腾起赤紫色火焰
          if (this.fx.length < 400) for (let i = 0; i < 6; i++) {
            const a = rand(TAU), rr = rand(20, 64);
            this.fx.push({ kind: 'particle', x: p.x + Math.cos(a) * rr, y: p.y - 6 + Math.sin(a) * rr * 0.8, t: 0, dur: 0.55, vx: -Math.sin(a) * 110, vy: Math.cos(a) * 80 - 60, color: ['#e43b44', '#b55088', '#fee761', '#ff7a6b', '#ffffff', '#dc9be9'][i], r: 4, real: true });
          }
          if (Math.floor(u.t / 0.8) !== Math.floor((u.t - dt) / 0.8)) this.fx.push({ kind: 'shock', x: p.x, y: p.y - 6, t: 0, dur: 0.45, r: 90, w: 10, color: '#b55088', real: true });
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return 1;
      }
      case 'arrowrain': {
        // 黄忠：四轮箭雨覆盖全屏，最后一支神箭射向血最多的敌人
        while (u.spawned < 4 && u.t >= u.spawned * 0.3) {
          u.spawned++;
          let shown = 0;
          for (const e of this.enemies) {
            if (e.dead || !this.inView(e.x, e.y)) continue;
            if (shown++ < 50) this.fx.push({ kind: 'volley', x: e.x + rand(-4, 4), y: e.y - 4, t: 0, dur: 0.35 });
            if (shown < 14) this.fx.push({ kind: 'particle', x: e.x, y: e.y - 4, t: -0.3, dur: 0.6, vx: rand(-30, 30), vy: rand(-60, -20), color: '#fee761', r: 2.5, g: 120 });
            this.damage(e, atk * 4, 0, 1, 30, { force: true });
          }
          this.hooks.sfx('shoot');
        }
        if (u.spawned === 4 && u.t >= 1.3 && u.idx < 0) {
          u.idx = 0;
          let best: Enemy | null = null;
          for (const e of this.enemies) if (!e.dead && this.inView(e.x, e.y) && (!best || e.hp > best.hp)) best = e;
          if (best) {
            const a = Math.atan2(best.y - p.y, best.x - p.x), len = Math.hypot(best.x - p.x, best.y - p.y);
            this.fx.push({ kind: 'beam', x: p.x, y: p.y - 8, t: 0, dur: 0.4, a, len, w: 14 });
            this.damage(best, atk * (best.boss ? 40 : 15), Math.cos(a), Math.sin(a), 150, { force: true });
            this.fx.push({ kind: 'explo', x: best.x, y: best.y, t: 0, dur: 0.4 });
            // 定军神箭：金色光柱 + 冲击波
            this.fx.push({ kind: 'pillar', x: best.x, y: best.y, t: 0, dur: 0.7, w: 26, len: 220, color: '#feae34', real: true });
            this.fx.push({ kind: 'shock', x: best.x, y: best.y - 6, t: 0, dur: 0.5, r: 90, w: 14, color: '#fee761', real: true });
            this.fx.push({ kind: 'rays', x: best.x, y: best.y - 6, t: 0, dur: 0.6, r: 110, color: '#fee761', real: true });
            this.burst(best.x, best.y - 6, 26, ['#fee761', '#ffffff', '#f77622'], 200, 0.7);
            this.hooks.shake(5);
            this.hooks.sfx('explode');
          }
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return u.slow;
      }
      case 'cavalry':
        // 西凉铁骑：马蹄扬起尘土和蓝色光尘
        u.tickT -= dt;
        if (u.tickT <= 0 && this.fx.length < 400) {
          u.tickT = 0.04;
          for (const pr of this.projs) if (pr.kind === 'horse') this.fx.push({ kind: 'particle', x: pr.x - Math.sign(pr.vx) * 14, y: pr.y + 6, t: 0, dur: 0.45, vx: -Math.sign(pr.vx) * rand(20, 60), vy: rand(-40, -10), color: Math.random() < 0.5 ? '#e8b796' : '#8be9ff', r: 3, real: true });
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return u.slow;
      case 'arrowstorm': {
        // 孙尚香：连珠齐射，四面八方
        u.tickT -= dt;
        if (u.tickT <= 0) {
          u.tickT = 0.2;
          u.spawned++;
          const off = u.spawned * 0.13;
          for (let k = 0; k < 14; k++) {
            const a = off + (k / 14) * TAU;
            const pr = newProjectile('bolt');
            pr.x = p.x; pr.y = p.y - 10;
            pr.vx = Math.cos(a) * 300; pr.vy = Math.sin(a) * 300;
            pr.rot = a; pr.dmg = atk * 3; pr.pierce = 3; pr.knock = 20; pr.r = 4; pr.life = 0.9;
            pr.sprite = 'bolt_evo'; pr.scale = 2;
            this.projs.push(pr);
          }
          // 弓腰姬：每轮齐射脚下一圈粉色光环和花瓣
          this.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: 0, dur: 0.35, r: 60, w: 8, color: '#f6757a', real: true });
          this.burst(p.x, p.y - 8, 8, ['#f6757a', '#ffffff', '#b55088'], 120, 0.6, 40);
          this.hooks.sfx('shoot');
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return 1;
      }
      case 'frenzy':
        // 典韦：狂战，期间伤害和攻速提升（recalc 里按 frenzy 计算），周身红光
        u.tickT -= dt;
        if (u.tickT <= 0) {
          u.tickT = 0.25;
          this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.4, r: 34, color: '#e43b44' });
          // 恶来狂战：脚下燃起血色战意
          if (this.fx.length < 400) for (let i = 0; i < 8; i++) this.fx.push({ kind: 'particle', x: p.x + rand(-18, 18), y: p.y + rand(-2, 4), t: 0, dur: 0.7, vx: rand(-12, 12), vy: rand(-110, -60), color: ['#e43b44', '#f77622', '#fee761', '#ff7a6b'][i % 4], r: 4, real: true });
          this.fx.push({ kind: 'ghost', x: p.x + rand(-3, 3), y: p.y, t: 0, dur: 0.25, sprite: `${this.heroSprite}_${Math.floor(p.anim) % 4}${p.left ? '_L' : ''}` });
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return 1;
      case 'starfall': {
        // 姜维：群星连坠
        u.tickT -= dt;
        if (u.tickT <= 0) {
          u.tickT = 0.3;
          for (let k = 0; k < 6; k++) {
            const e = this.randomVisibleEnemy();
            const x = e ? e.x + rand(-6, 6) : p.x + rand(-90, 90), y = e ? e.y + rand(-5, 5) : p.y + rand(-120, 120);
            // 星落五丈原：流星从高空坠下，落地再结算
            this.fx.push({ kind: 'meteor', x, y, t: 0, dur: 0.22, color: '#8fb8ff' });
            this.later(0.22, () => {
              this.impact(x, y, 40, atk * 7, 80, 0);
              this.fx.push({ kind: 'explo', x, y: y + 6, t: 0, dur: 0.35 });
              this.fx.push({ kind: 'shock', x, y, t: 0, dur: 0.35, r: 50, w: 8, color: '#8fb8ff', real: true });
              this.fx.push({ kind: 'pillar', x, y, t: 0, dur: 0.4, w: 12, len: 120, color: '#8fb8ff', real: true });
              this.burst(x, y - 4, 6, ['#ffffff', '#8fb8ff', '#2ce8f5'], 120, 0.5);
            });
          }
          this.hooks.sfx('explode');
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return u.slow;
      }
    }
    return 1;
  }

  /** 马超：西凉铁骑，八路骑兵往返冲阵 */
  private spawnUltCavalry() {
    const p = this.player;
    const sp = 330;
    for (let i = 0; i < 8; i++) {
      const pr = newProjectile('horse');
      const dirX = i % 2 === 0 ? 1 : -1;
      const lane = -this.viewH * 0.42 + (this.viewH * 0.84 * (i + 0.5)) / 8;
      pr.x = p.x - dirX * (this.viewW / 2 + 24); pr.y = p.y + lane;
      pr.vx = dirX * sp; pr.vy = 0;
      pr.left = dirX < 0;
      pr.dmg = this.base.atk * 10;
      pr.pierce = 9999;
      pr.knock = 130;
      pr.r = 22;
      pr.life = (this.viewW + 100) / sp + 0.4;
      pr.sprite = 'u_baima';
      this.projs.push(pr);
    }
    this.fx.push({ kind: 'rays', x: p.x, y: p.y - 8, t: 0, dur: 0.7, r: 180, color: '#2ce8f5', real: true });
    this.hooks.shake(4);
    this.hooks.sfx('horse');
  }

  /** 张飞：据水断桥，全屏震退眩晕 */
  private doRoar() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - p.x) > this.viewW * 0.6 || Math.abs(e.y - p.y) > this.viewH * 0.6) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      e.slow = 1;
      e.slowT = e.boss ? 1.5 : 4;
      // 敌将：断喝震碎护盾并重创
      if (e.boss && e.shield > 0) this.breakShield(e);
      this.damage(e, this.base.atk * (e.boss ? 30 : 6), dx / d, dy / d, 220, { force: true });
    }
    this.shots.length = 0;
    for (let i = 0; i < 3; i++) this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.1 + i * 0.05, r: Math.max(this.viewW, this.viewH) * (0.5 + i * 0.15), color: '#ffffff' });
    // 当阳桥断喝：三道音浪 + 血色放射 + 漫天尘土
    for (let i = 0; i < 3; i++) this.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: -i * 0.12, dur: 0.6, r: Math.max(this.viewW, this.viewH) * 0.65, w: 20, color: i === 1 ? '#e43b44' : '#ffffff', real: true });
    this.fx.push({ kind: 'rays', x: p.x, y: p.y - 8, t: 0, dur: 0.8, r: 240, color: '#e43b44', real: true });
    this.burst(p.x, p.y, 40, ['#c28569', '#e8b796', '#ffffff'], 260, 0.8);
    this.fx.push({ kind: 'text', x: p.x, y: p.y - 40, t: 0, dur: 0.5, text: '燕人张翼德在此！', color: '#ff8a80' });
    this.hooks.shake(10);
    this.hooks.sfx('boss');
  }

  /** 诸葛亮：借东风，召出火焰龙卷 */
  private spawnTornados() {
    const p = this.player;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rand(-0.3, 0.3);
      const pr = newProjectile('tornado');
      pr.x = p.x + Math.cos(a) * 30;
      pr.y = p.y + Math.sin(a) * 30;
      pr.vx = Math.cos(a) * 40;
      pr.vy = Math.sin(a) * 40;
      pr.r = 26;
      pr.dmg = this.base.atk * 1.6;
      pr.pierce = 99999;
      pr.life = 6.5;
      pr.tick = 0.2;
      this.projs.push(pr);
    }
    this.hooks.shake(4);
    this.hooks.sfx('fire');
  }

  /** 大招特效：一圈向外飞散的发光粒子（特效太多时不再加） */
  private burst(x: number, y: number, n: number, colors: string[], speed = 80, life = 0.6, g = 0) {
    if (this.fx.length > 420) return;
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = speed * rand(0.35, 1);
      this.fx.push({ kind: 'particle', x, y, t: 0, dur: life * rand(0.6, 1), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.8, color: colors[i % colors.length], r: rand(1.5, 3.5), g, real: true });
    }
  }

  /** 金疮药：回复生命，进入冷却 */
  usePotion(): boolean {
    const p = this.player;
    if (this.potionCd > 0 || this.dead || this.won) return false;
    const heal = Math.round(p.maxHp * this.potionHeal);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    this.potionCd = this.potionCdMax;
    this.potionUses++;
    this.addNum(p.x, p.y - 24, heal, 'g');
    this.fx.push({ kind: 'ring', x: p.x, y: p.y - 8, t: 0, dur: 0.4, r: 30, color: '#63c74d' });
    this.hooks.sfx('coin');
    return true;
  }

  /** 看视频直接充满怒气 */
  fillRage() {
    this.rage = RAGE_MAX;
    this.rageLock = 0;
    this.adRageUsed++;
  }

  // —— 特效 ——
  private numAlive = 0;
  addNum(x: number, y: number, v: number, color: 'w' | 'y' | 'r' | 'g', big = false) {
    if (this.fx.length > 400 || (this.numAlive >= 30 && !big)) return;
    this.numAlive++;
    this.fx.push({ kind: 'num', x, y, t: 0, dur: 0.6, text: String(v), color, big });
  }

  private updateFx(dt: number, rawDt = dt) {
    // 原地压缩数组（几百个特效时逐个 splice 很慢）
    let n = 0, nums = 0;
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      f.t += f.real ? rawDt : dt;
      if (f.t < f.dur) { this.fx[n++] = f; if (f.kind === 'num') nums++; }
    }
    this.fx.length = n;
    this.numAlive = nums;
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.t += dt;
      if (w.t >= w.dur) {
        this.warnings.splice(i, 1);
        if (w.dmg) this.fireWarning(w);
      }
    }
  }

  /** 预警结束：放出特效，玩家还在范围里就受伤 */
  private fireWarning(w: Warning) {
    const p = this.player;
    if (w.hitFx === 'slash') {
      this.fx.push({ kind: 'slash', x: w.x, y: w.y - 6, t: 0, dur: 0.3, r: w.len, w: w.r, a: w.a, color: '#e43b44' });
    } else if (w.hitFx === 'blade') {
      this.fx.push({ kind: 'blade', x: w.x, y: w.y, t: 0, dur: 0.35, a: w.a, len: w.len, w: w.r });
    } else {
      this.fx.push({ kind: 'explo', x: w.x, y: w.y, t: 0, dur: 0.4 });
      this.fx.push({ kind: 'ring', x: w.x, y: w.y, t: 0, dur: 0.35, r: w.r * 1.1, color: '#feae34' });
    }
    if (w.kind === 'circle' && w.r >= 80) { this.hooks.shake(3); this.hooks.sfx('explode'); }
    if (inWarning(w, p.x, p.y, p.r * 0.6)) this.hurtPlayer(w.dmg!);
  }

  // —— 升级选项 ——
  rollChoices(n = 3): Choice[] {
    if (this.def) return this.rollDefenseChoices(n);
    const pool: { c: Choice; w: number }[] = [];
    const ok = (kind: string, id: string) => !this.banned.has(kind + ':' + id);
    // 已有武器对应的进化兵法：出现几率更高，方便凑出进化
    const wanted = new Set(this.weapons.filter((w) => !w.evo).map((w) => WEAPONS[w.id].evoPassive));
    for (const w of this.weapons) if (!w.evo && w.lv < MAX_WEAPON_LV) pool.push({ c: { kind: 'weapon', id: w.id, lv: w.lv + 1, isNew: false }, w: 3 });
    for (const p of this.passives) if (p.lv < passiveMax(p.id)) pool.push({ c: { kind: 'passive', id: p.id, lv: p.lv + 1, isNew: false }, w: 2.2 });
    // 新技能的总出现几率不随技能总数膨胀，避免已有技能升不上去
    if (this.weapons.length < WEAPON_SLOTS) {
      const ids = weaponsForHero(this.hero.id, this.cleared).filter((id) => !this.weapon(id) && ok('weapon', id));
      const k = Math.min(1, 6 / Math.max(1, ids.length));
      for (const id of ids) pool.push({ c: { kind: 'weapon', id, lv: 1, isNew: true }, w: (weaponLink(id, this.hero.id) ? 2.8 : 2.2) * k });
    }
    if (this.passives.length < PASSIVE_SLOTS) {
      const ids = passivesFor(this.cleared).filter((id) => !this.passiveLv(id) && ok('passive', id));
      const k = Math.min(1, 8 / Math.max(1, ids.length));
      for (const id of ids) pool.push({ c: { kind: 'passive', id, lv: 1, isNew: true }, w: (wanted.has(id) ? 3 : 1.4) * k });
    }
    return this.pickChoices(pool, n);
  }

  private pickChoices(pool: { c: Choice; w: number }[], n: number): Choice[] {
    const out: Choice[] = [];
    const items = shuffle(pool.slice());
    while (out.length < n && items.length) {
      const it = weighted(items, (x) => x.w);
      out.push(it.c);
      items.splice(items.indexOf(it), 1);
    }
    if (out.length === 0) { out.push({ kind: 'heal' }, { kind: 'gold' }); }
    return out;
  }

  /**
   * 守城的升级三选一：兵种营 / 城防军令、建筑、召唤武将、修城，外加当前武将自己的专属武器（满级直接可以进化）。
   * 别的武器和兵法不出现——守城靠兵和建筑，不用再凑技能。
   */
  private rollDefenseChoices(n: number): Choice[] {
    const d = this.def!;
    const pool: { c: Choice; w: number }[] = [];
    const ok = (kind: string, id: string) => !this.banned.has(kind + ':' + id);
    for (const o of orderChoices(d)) if (ok('order', o.id)) pool.push({ c: { kind: 'order', id: o.id, lv: o.lv, isNew: o.lv === 1 }, w: o.w });
    for (const id of readyLinks(d)) pool.push({ c: { kind: 'link', id }, w: 8 });
    for (const bc of buildChoices(d)) if (ok('build', bc.id)) pool.push({ c: { kind: 'build', id: bc.id, lv: bc.lv, isNew: bc.lv === 1 }, w: bc.lv === 1 ? 3 : 2.4 });
    const hs = Object.keys(d.heroes).filter((id) => heroCanSummon(this, id));
    for (const id of hs) pool.push({ c: { kind: 'hero', id }, w: Math.min(2.4, 4 / hs.length) });
    if (d.cityHp < d.cityMax * 0.85) pool.push({ c: { kind: 'repair' }, w: 2 + 10 * (1 - d.cityHp / d.cityMax) });
    const w = this.weapon(this.hero.weapon);
    if (w && !w.evo && w.lv < MAX_WEAPON_LV) pool.push({ c: { kind: 'weapon', id: w.id, lv: w.lv + 1, isNew: false }, w: 2.6 });
    if (w && !w.evo && w.lv >= MAX_WEAPON_LV) pool.push({ c: { kind: 'evo', id: w.id }, w: 6 });
    return this.pickChoices(pool, n);
  }

  /** 封禁一个新技能选项：本局不再出现，并换一个新的 */
  banish(choices: Choice[], i: number): boolean {
    const c = choices[i];
    if (this.banishes <= 0 || (c.kind !== 'weapon' && c.kind !== 'passive' && c.kind !== 'order') || !c.isNew) return false;
    this.banishes--;
    this.banned.add(c.kind + ':' + c.id);
    const key = (x: Choice) => x.kind + ':' + ('id' in x ? x.id : '');
    const others = new Set(choices.map(key));
    const fresh = this.rollChoices(8).find((x) => !others.has(key(x)));
    if (fresh) choices[i] = fresh; else choices.splice(i, 1);
    return true;
  }

  /** 选这一项后能否凑齐进化条件 */
  completesEvo(c: Choice): boolean {
    if (c.kind === 'weapon') {
      const w = this.weapon(c.id);
      return !!w && !w.evo && c.lv >= MAX_WEAPON_LV && this.passiveLv(WEAPONS[c.id].evoPassive) > 0;
    }
    if (c.kind === 'passive' && c.isNew) return this.weapons.some((w) => !w.evo && w.lv >= MAX_WEAPON_LV && WEAPONS[w.id].evoPassive === c.id);
    if (c.kind === 'order' && this.def) {
      const d = this.def;
      return Object.values(LINKS).some((l) => !d.links.has(l.id) && (
        (l.unit === c.id && c.lv >= ORDERS[c.id].max && orderLv(d, l.city) > 0) ||
        (l.city === c.id && c.lv === 1 && orderLv(d, l.unit) >= ORDERS[l.unit].max)));
    }
    return false;
  }

  /** 这项兵法能帮助哪些已有武器进化 */
  evoTargets(id: PassiveId): WeaponId[] {
    return this.weapons.filter((w) => !w.evo && WEAPONS[w.id].evoPassive === id).map((w) => w.id);
  }

  /** 推荐选项：照着推荐点也能玩得很爽 */
  recommend(choices: Choice[]): number {
    let best = -1, bs = -1;
    choices.forEach((c, i) => {
      let s = 0;
      if (this.completesEvo(c)) s += 100;
      if (c.kind === 'weapon') {
        const link = !!weaponLink(c.id, this.hero.id);
        if (c.isNew) s += 35 + (link ? 30 : 0) - (this.weapons.length >= 4 ? 12 : 0);
        else s += 50 + (WEAPONS[c.id].hero ? 25 : 0) + (link ? 15 : 0) + c.lv * 2;
      } else if (c.kind === 'passive') {
        const helps = this.evoTargets(c.id).length > 0;
        s += c.isNew ? 25 + (helps ? 35 : 0) : 30 + (helps ? 12 : 0);
      } else if (c.kind === 'link' || c.kind === 'evo') s += 120;
      else if (c.kind === 'repair' && this.def) s += this.def.cityHp < this.def.cityMax * 0.5 ? 95 : 30;
      else if (c.kind === 'build') s += c.isNew ? 54 : 46;
      else if (c.kind === 'hero') s += 47;
      else if (c.kind === 'order' && this.def) {
        // 城快守不住时优先加固城防；兵种卡先解锁、再升级
        const hurt = this.def.cityHp < this.def.cityMax * 0.5;
        s += c.id === 'c_wall' && hurt ? 90 : ORDERS[c.id].unit ? (c.isNew ? 52 : 44 + c.lv * 2) : 42 + c.lv * 2;
      }
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }

  applyChoice(c: Choice) {
    switch (c.kind) {
      case 'weapon': {
        const w = this.weapon(c.id);
        if (w) w.lv++;
        else this.addWeapon(c.id);
        break;
      }
      case 'passive': {
        const p = this.passives.find((x) => x.id === c.id);
        if (p) p.lv++;
        else this.passives.push({ id: c.id, lv: 1 });
        break;
      }
      case 'evo': {
        const w = this.weapon(c.id)!;
        w.evo = true;
        const link = weaponLink(c.id, this.hero.id);
        if (link) {
          w.link = true;
          w.evoL = { ...WEAPONS[c.id].evo, ...link.evo, desc: link.desc };
        }
        this.evolved.push(c.id);
        w.t = 0;
        break;
      }
      case 'heal':
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.3);
        break;
      case 'gold':
        this.coins += 30;
        break;
      case 'order':
        if (this.def) applyOrder(this, c.id, c.lv);
        break;
      case 'link':
        if (this.def) applyLink(this, c.id);
        break;
      case 'build':
        if (this.def) applyBuild(this, c.id);
        break;
      case 'hero':
        if (this.def) summonHero(this, c.id);
        break;
      case 'repair':
        if (this.def) repairCity(this);
        break;
    }
    this.recalc();
  }

  /** 可进化的武器：5 级 + 拥有对应兵法 */
  evolvable(): WeaponId[] {
    // 守城没有兵法：专属武器满级就能进化
    return this.weapons.filter((w) => !w.evo && w.lv >= MAX_WEAPON_LV && (this.def || this.passiveLv(WEAPONS[w.id].evoPassive) > 0)).map((w) => w.id);
  }

  /**
   * 开宝箱：优先进化，其次升级已有技能。
   * 敌将宝箱保底：没有能进化的武器时，满级武器缺进化兵法就直接送这本兵法并当场进化；
   * 还是进化不了就给 5 个升级，并优先升最接近满级的武器（下一个宝箱更容易进化）。
   */
  rollChest(boss: boolean): Choice[] {
    // 守城：宝箱直接给守城的升级项（不重复）
    if (this.def) return this.rollDefenseChoices(boss ? 3 : Math.random() < 0.3 ? 2 : 1).filter((c) => c.kind !== 'heal' && c.kind !== 'gold');
    const out: Choice[] = [];
    let evo = this.evolvable();
    let count = boss ? 3 : Math.random() < 0.08 ? 5 : Math.random() < 0.3 ? 3 : 1;
    if (boss && !evo.length && this.passives.length < PASSIVE_SLOTS) {
      const w = this.weapons.find((x) => !x.evo && x.lv >= MAX_WEAPON_LV && !this.passiveLv(WEAPONS[x.id].evoPassive));
      if (w) { out.push({ kind: 'passive', id: WEAPONS[w.id].evoPassive, lv: 1, isNew: true }); evo = [w.id]; count--; }
    }
    if (evo.length) { out.push({ kind: 'evo', id: evo[0] }); count--; }
    else if (boss) count = 5;
    for (let i = 0; i < count; i++) {
      const pool: Choice[] = [];
      for (const w of this.weapons) {
        const pending = out.filter((c) => c.kind === 'weapon' && c.id === w.id).length;
        if (!w.evo && w.lv + pending < MAX_WEAPON_LV) {
          const c: Choice = { kind: 'weapon', id: w.id, lv: w.lv + pending + 1, isNew: false };
          pool.push(c);
          // 敌将宝箱：等级越高的武器权重越大
          if (boss) for (let k = 0; k < w.lv + pending; k++) pool.push(c);
        }
      }
      for (const p of this.passives) {
        const pending = out.filter((c) => c.kind === 'passive' && c.id === p.id).length;
        if (p.lv + pending < passiveMax(p.id)) pool.push({ kind: 'passive', id: p.id, lv: p.lv + pending + 1, isNew: false });
      }
      if (!pool.length) { out.push({ kind: 'gold' }); continue; }
      out.push(pick(pool));
    }
    return out;
  }

  /** 复活：回满血并震开周围敌人 */
  /** 第 n 次看广告复活的本局加成：第 2 次伤害 +20%、移速 +10%；第 3 次伤害再 +30%、3 秒无敌、震开更大范围 */
  static reviveBonusText(n: number): string {
    return n === 2 ? '本局伤害+20%、移速+10%' : n === 3 ? '本局伤害再+30%、3秒无敌' : '';
  }

  revive(adRevive = 0) {
    const p = this.player;
    this.dead = false;
    this.reviveCount++;
    if (adRevive === 2) { this.reviveDmg += 0.2; this.reviveSpd += 0.1; }
    if (adRevive === 3) this.reviveDmg += 0.3;
    if (adRevive >= 2) {
      this.recalc();
      this.hooks.banner(Battle.reviveBonusText(adRevive), '#fee761');
    }
    // 守城：复活的是城池
    if (this.def) { reviveCity(this); return; }
    p.hp = p.maxHp;
    if (this.stratSet.has('qixing')) this.qixingBuff = true;
    p.iframe = adRevive === 3 ? 3 : 2.5;
    const R = adRevive === 3 ? 180 : 120;
    this.hooks.sfx('evolve');
    this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.6, r: R, color: '#fee761' });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        if (!e.boss && !e.elite) this.killEnemy(e);
        else { e.kx += (dx / d) * 300; e.ky += (dy / d) * 300; }
      }
    }
    this.shots.length = 0;
  }

  nearestEnemy(maxD = 9999, from = this.player): Enemy | null {
    let best: Enemy | null = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (e.dead || (!e.boss && !this.inView(e.x, e.y))) continue;
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** 普通技能能否打到这个敌人（在屏幕内） */
  canHit(e: Enemy): boolean {
    return this.inView(e.x, e.y - 6 * e.scale, 4);
  }

  /** 是否在屏幕内（镜头以玩家为中心；margin 为负表示更靠里） */
  inView(x: number, y: number, margin = 0): boolean {
    const p = this.player;
    return Math.abs(x - p.x) < this.viewW / 2 + margin && Math.abs(y - (p.y - 8)) < this.viewH / 2 + margin;
  }

  /** 屏幕内侧的随机敌人：范围技能只瞄准看得见的敌人，不会在屏幕边缘守株待兔 */
  randomVisibleEnemy(): Enemy | null {
    const vis = this.enemies.filter((e) => !e.dead && this.inView(e.x, e.y, -24));
    return vis.length ? pick(vis) : null;
  }

  /** 视野外圆环上的随机点 */
  spawnPoint(): [number, number] {
    const p = this.player;
    const R = Math.hypot(this.viewW, this.viewH) / 2 + 16;
    // 移动时四成敌人出现在前进方向，迎面撞上
    const a = p.moving && Math.random() < 0.4 ? Math.atan2(p.dirY, p.dirX) + rand(-1.1, 1.1) : rand(TAU);
    return [p.x + Math.cos(a) * R, p.y + Math.sin(a) * R];
  }

  get progress() {
    return clamp(this.t / this.chapter.duration, 0, 1);
  }
}
