import { SpatialGrid } from '../core/grid';
import { clamp, rand, pick, shuffle, weighted, TAU } from '../core/math';
import { ChapterDef } from '../data/chapters';
import { ENEMIES, BOSSES, BossDef } from '../data/enemies';
import { HERO_BY_ID, HeroDef, UltKind } from '../data/heroes';
import type { WeeklyDef } from '../data/goals';
import {
  WEAPONS, WeaponId, PassiveId, weaponsForHero, passivesFor, passiveMax, weaponLink, MAX_WEAPON_LV, WEAPON_SLOTS, PASSIVE_SLOTS, expToNext,
} from '../data/skills';
import type { HeroStats } from '../meta/ops';
import { potionStats } from '../data/meta';
import { STRATS, STRAT_TIMES, STRAT_TIER_WEIGHTS, STRAT_HP_STEP, StratId, StratTier, STRAT_BY_ID } from '../data/strategies';
import {
  Enemy, Player, WeaponState, PassiveState, Projectile, FirePool, EnemyShot, Pickup, Breakable, Fx, Warning, newEnemy, newProjectile,
} from './entities';
import { updateWeapons } from './weapons';
import { skipHordesBefore, updateSpawner } from './spawner';
import { updateBoss } from './boss';

export type Choice =
  | { kind: 'weapon'; id: WeaponId; lv: number; isNew: boolean }
  | { kind: 'passive'; id: PassiveId; lv: number; isNew: boolean }
  | { kind: 'evo'; id: WeaponId }
  | { kind: 'heal' }
  | { kind: 'gold' };

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
}

const noopHooks: BattleHooks = { sfx() {}, shake() {}, banner() {}, vibrate() {}, bossAppear() {} };

/**
 * 章节难度节奏（敌人血量倍率）：爽是一个过程——先轻松上手，再逐步加压，
 * 5:00 首领 + 宝箱进化后迎来一波疯狂割草，然后再加压直到最终决战。
 *   0:00~1:00 热身   1:30~5:00 加压   5:00 首领出场后回落，进化后爽割到 7:00   7:00~9:00 再加压
 */
const TENSION: [number, number][] = [[0, 0.8], [60, 0.9], [90, 1.45], [270, 2.4], [300, 2.4], [345, 1.3], [420, 1.3], [540, 1.55], [9999, 1.55]];
/** 接触伤害倍率：小怪出手变慢（贴身蓄力 + 玩家受击后短暂无敌）后，单次伤害相应提高 */
const CONTACT_DMG = 1.25;
export function tension(t: number, chapterId = 2): number {
  let v = TENSION[TENSION.length - 1][1];
  for (let i = 1; i < TENSION.length; i++) {
    const [t1, v1] = TENSION[i];
    if (t <= t1) { const [t0, v0] = TENSION[i - 1]; v = v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); break; }
  }
  // 第 1 章是新玩家的第一关：起伏减半
  return chapterId === 1 ? 1 + (v - 1) * 0.5 : v;
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
  dead = false;
  won = false;
  finalBoss: Enemy | null = null;
  midBoss: Enemy | null = null;
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
    this.rerolls = base.reroll;
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
    const qianli = this.weapon('horse')?.link && hid === 'guanyu';
    this.speed = this.hero.moveSpeed * (1 + b.speed / 100 + 0.08 * P('horseshoe') + (hid === 'lvbu' ? 0.08 : 0) + (qianli ? 0.2 : 0));
    this.dmgTakenMul = (1 - Math.min(0.6, b.def / 100)) * (1 - 0.06 * P('armor')) * (auraEvo ? 0.8 : 1) * (hid === 'zhangfei' ? 0.85 : 1);
    const hpStrat = (this.stratSet.has('shengou') ? 1.15 : 1) * (this.stratSet.has('kurou') ? 0.8 : 1);
    const newMax = Math.round(b.hp * (1 + 0.1 * P('lingzhi')) * hpStrat);
    if (newMax > this.player.maxHp) this.player.hp += newMax - this.player.maxHp;
    this.player.maxHp = newMax;
    this.player.hp = Math.min(this.player.hp, newMax);
    this.regen = b.regen + 0.3 * P('lingzhi') + (auraEvo ? newMax * 0.01 : 0);
    this.pickupR = this.hero.pickup * (1 + b.pickup / 100 + 0.35 * P('bowl'));
    // 新手试炼只有一分多钟：经验和怒气加快，升级、大招都能体验到
    const tut = this.chapter.tutorial ? 3 : 1;
    const tutRage = this.chapter.tutorial ? 6 : 1;
    this.expMul = (1 + b.exp / 100 + 0.08 * P('seal')) * (this.mods?.expMul || 1) * tut;
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
    if (this.stratRound < STRAT_TIMES.length && this.t >= STRAT_TIMES[this.stratRound] && this.t < this.chapter.duration) {
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
    this.contactIframe = Math.max(0, this.contactIframe - dt);
    this.updateRage(dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // 移动
    const dashing = !!this.ult && this.ult.kind === 'dragon';
    let mx = dashing ? 0 : this.moveX, my = dashing ? 0 : this.moveY;
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
    updateWeapons(this, dt);
    this.updateProjectiles(dt);
    this.updatePools(dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.updateBreakables(dt);
    this.updateJiedao();
    this.updateFx(dt);

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
      this.dead = true;
      this.hooks.vibrate(true);
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

  /** 下一个首领事件（没有就返回 null） */
  private nextBossEvent() {
    const evs = this.chapter.events;
    for (let i = this.eventIdx; i < evs.length; i++) if (evs[i].type === 'boss' || evs[i].type === 'midboss') return evs[i];
    return null;
  }
  /** 可以「直取敌将」：普通章节、场上没有首领、开局 1 分钟后、已经稳稳压制敌军 10 秒以上 */
  canRush(): boolean {
    const ch = this.chapter;
    if (ch.endless || ch.tutorial || this.finalBoss || this.midBoss || this.ult || this.t < 60) return false;
    return this.dominantT >= 10 && !!this.nextBossEvent();
  }
  /** 直取敌将：时间直接推进到下一个首领登场前，中间的小规模事件跳过（锦囊照常补发） */
  rush(): boolean {
    const ev = this.nextBossEvent();
    if (!ev || !this.canRush()) return false;
    const to = ev.t - 0.5;
    if (to <= this.t) return false;
    while (this.eventIdx < this.chapter.events.length && this.chapter.events[this.eventIdx].t < to && this.chapter.events[this.eventIdx] !== ev) this.eventIdx++;
    skipHordesBefore(to);
    this.t = to;
    this.dominantT = 0;
    this.rushes++;
    this.hooks.banner('直取敌将！', '#ff8a80');
    this.hooks.shake(4);
    this.hooks.sfx('horse');
    return true;
  }
  rushes = 0;
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
    this.dominantT = this.screenFill < 0.08 && this.recentDmg < this.player.maxHp * 0.04 ? this.dominantT + 1 : 0;
    if (this.screenFill < 0.03 && this.t > 120) this.director = Math.min(3, this.director + 0.04);
    else if (this.screenFill > 0.06) this.director = Math.max(1, this.director - 0.02);
  }

  /** 后期人海程度：4 分钟起逐步提高，10 分钟达到最大 */
  crowdRamp(): number {
    return clamp((this.t - 240) / 360, 0, 1);
  }

  spawnEnemy(id: string, x: number, y: number, opts: { elite?: boolean; hpMul?: number } = {}): Enemy {
    const d = ENEMIES[id];
    const e = newEnemy();
    const ch = this.chapter;
    const minute = this.t / 60;
    // 无尽模式：二次曲线成长，后期压力越来越大
    const late = Math.max(0, minute - 4);
    const grow = ch.endless ? 1 + ch.growth * minute + 0.05 * minute * minute : 1 + ch.growth * minute + 0.05 * late * late;
    // 后期敌人更多，同时血量再略微提高
    const hpScale = ch.hpMul * grow * this.enemyHpMul * (opts.hpMul || 1) * (1 + 0.3 * this.crowdRamp()) * this.director * this.stratHpMul * (ch.endless || ch.tutorial ? 1 : tension(this.t, ch.id));
    e.uid = this.uidSeq++;
    e.def = d;
    e.x = x;
    e.y = y;
    e.r = d.radius;
    e.maxHp = e.hp = Math.round(d.hp * hpScale * (opts.elite ? 14 : 1));
    e.speed = d.speed * rand(0.92, 1.08) * (opts.elite ? 0.9 : 1);
    e.dmg = d.dmg * ch.dmgMul * (ch.endless ? 1 + 0.1 * minute + 0.012 * minute * minute : 1 + 0.04 * minute) * (opts.elite ? 1.5 : 1) * this.enemyDmgMul;
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
    e.maxHp = e.hp = Math.round(d.hp * this.enemyHpMul * hpScale * this.stratHpMul);
    e.speed = d.speed;
    e.dmg = d.dmg * this.enemyDmgMul;
    e.mass = 50;
    e.exp = isFinal ? 200 : 100;
    e.sprite = 'u_' + d.sprite;
    e.scale = 2;
    e.state = 'move';
    e.stateT = 2;
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
      let dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;

      if (e.boss) {
        updateBoss(this, e, dt, dx, dy, d);
      } else if (e.fixedDir) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.life -= dt;
        if (e.life <= 0) { e.dead = true; continue; }
      } else if (e.def!.ai === 'ranged') {
        const range = e.def!.range || 90;
        let mv = 0;
        if (d > range + 10) mv = 1; else if (d < range - 20) mv = -0.6;
        e.x += dx * spd * mv * dt;
        e.y += dy * spd * mv * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && d < range + 40 && e.slow < 1) {
          e.shootT = e.def!.shootCd || 3;
          this.enemyShoot(e.x, e.y - 6, dx, dy, 90, e.dmg, e.def!.proj || 'arrow');
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
      if (!e.boss && !e.elite && !e.fixedDir && d > viewR + 120) {
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
    if (p.iframe > 0 || this.dead || this.ult) return;
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

  /** 对敌人造成伤害，返回是否击杀 */
  damage(e: Enemy, base: number, kx = 0, ky = 0, knock = 0, opts: { noCrit?: boolean; force?: boolean } = {}): boolean {
    if (e.dead) return false;
    // 屏幕外的敌人打不到：敌人一定会先出现在玩家眼前（大招除外）
    if (!opts.force && !e.boss && !this.canHit(e)) return false;
    let dmg = base * this.dmgMul * this.dynMul;
    if (this.hero.id === 'zhaoyun' && this.player.hp < this.player.maxHp * 0.3) dmg *= 1.3; // 一身是胆
    if (e.boss) dmg *= 1 + this.base.bossDmg / 100;
    if (e.boss || e.elite) dmg *= 1 + this.eliteDmg;
    let crit = false;
    if (!opts.noCrit && Math.random() < this.crit) { dmg *= this.critDmg; crit = true; }
    dmg = Math.max(1, Math.round(dmg * rand(0.92, 1.08)));
    e.hp -= dmg;
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
        this.finalBoss = null;
        // 清场
        for (const o of this.enemies) if (!o.dead && o !== e) { o.dead = true; this.fx.push({ kind: 'puff', x: o.x, y: o.y, t: 0, dur: 0.3 }); }
        this.won = true;
      }
      if (e === this.midBoss) this.midBoss = null;
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
    if (this.gemCount > 260) {
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
          this.hooks.shake(1.2);
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
            this.hooks.shake(pr.scale >= 4 ? 4 : 2.5);
            this.hooks.sfx('explode');
            if (pr.second) {
              // 霹雳炮：碎石二次爆裂
              const sec = newProjectile('rock');
              sec.tx = sec.x = pr.tx; sec.ty = sec.y = pr.ty;
              sec.dur = 0.3; sec.area = pr.area * 0.8; sec.dmg = pr.dmg * 0.5; sec.knock = pr.knock * 0.6; sec.life = 1; sec.scale = 0;
              this.projs.push(sec);
            }
          } else {
            this.fx.push({ kind: 'puff', x: pr.tx, y: pr.ty - 2, t: 0, dur: 0.3, big: pr.scale >= 3 });
            if (pr.scale === 0) this.fx.push({ kind: 'explo', x: pr.tx, y: pr.ty + 6, t: 0, dur: 0.35 });
            this.hooks.shake(pr.scale >= 3 ? 1.5 : 0.8);
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
      if (!k.pulled && (k.kind === 'gem' || k.kind === 'coin') && (d2 < pr2 || (k.t > 9 && d2 < 220 * 220))) k.pulled = true;
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
    this.hitStopCd = 0.18;
  }

  private spawnCorpse(e: Enemy) {
    if (e.boss) return;
    let corpses = 0;
    for (const f of this.fx) if (f.kind === 'corpse') corpses++;
    if (corpses > 90) { this.fx.push({ kind: 'puff', x: e.x, y: e.y - 4 * e.scale, t: 0, dur: 0.3, big: e.scale > 1 }); return; }
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
    this.hooks.banner(this.hero.ultName.replace('·', ' · '), this.hero.color);
    this.hooks.sfx('evolve');
    this.hooks.vibrate(true);
    const p = this.player;
    const st: UltState = { kind, slow: 1, tickT: 0, rings: [], spawned: 0, idx: -1, t: 0, dur: 0, x0: p.x, y0: p.y, x1: 0, y1: 0, finale: 0 };
    this.ult = st;
    switch (kind) {
      case 'dragon': st.slow = 0.12; this.nextDash(); break;
      case 'crescent': st.slow = 0.25; st.dur = 1.35; break;
      case 'roar': st.slow = 0.2; st.dur = 0.7; this.doRoar(); break;
      case 'tornado': st.slow = 0.3; st.dur = 0.5; this.spawnTornados(); break;
      case 'whirl': st.slow = 1; st.dur = 5; break;
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
          if (Math.random() < 0.3) this.hooks.shake(1.5);
          this.hooks.sfx('thrust');
        }
        if (u.t >= u.dur) this.ultEnd(u);
        return 1;
      }
    }
    return 1;
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
      this.damage(e, this.base.atk * 6, dx / d, dy / d, 220, { force: true });
    }
    this.shots.length = 0;
    for (let i = 0; i < 3; i++) this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.1 + i * 0.05, r: Math.max(this.viewW, this.viewH) * (0.5 + i * 0.15), color: '#ffffff' });
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
    if (this.fx.length > 400 || (this.numAlive >= 60 && !big)) return;
    this.numAlive++;
    this.fx.push({ kind: 'num', x, y, t: 0, dur: 0.6, text: String(v), color, big });
  }

  private updateFx(dt: number) {
    // 原地压缩数组（几百个特效时逐个 splice 很慢）
    let n = 0, nums = 0;
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t < f.dur) { this.fx[n++] = f; if (f.kind === 'num') nums++; }
    }
    this.fx.length = n;
    this.numAlive = nums;
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.t += dt;
      if (w.t >= w.dur) this.warnings.splice(i, 1);
    }
  }

  // —— 升级选项 ——
  rollChoices(n = 3): Choice[] {
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

  /** 封禁一个新技能选项：本局不再出现，并换一个新的 */
  banish(choices: Choice[], i: number): boolean {
    const c = choices[i];
    if (this.banishes <= 0 || (c.kind !== 'weapon' && c.kind !== 'passive') || !c.isNew) return false;
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
    }
    this.recalc();
  }

  /** 可进化的武器：5 级 + 拥有对应兵法 */
  evolvable(): WeaponId[] {
    return this.weapons.filter((w) => !w.evo && w.lv >= MAX_WEAPON_LV && this.passiveLv(WEAPONS[w.id].evoPassive) > 0).map((w) => w.id);
  }

  /** 开宝箱：优先进化，其次随机升级已有技能 */
  rollChest(boss: boolean): Choice[] {
    const out: Choice[] = [];
    const evo = this.evolvable();
    let count = boss ? 3 : Math.random() < 0.08 ? 5 : Math.random() < 0.3 ? 3 : 1;
    if (evo.length) { out.push({ kind: 'evo', id: evo[0] }); count--; }
    for (let i = 0; i < count; i++) {
      const pool: Choice[] = [];
      for (const w of this.weapons) {
        const pending = out.filter((c) => c.kind === 'weapon' && c.id === w.id).length;
        if (!w.evo && w.lv + pending < MAX_WEAPON_LV) pool.push({ kind: 'weapon', id: w.id, lv: w.lv + pending + 1, isNew: false });
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
  revive() {
    const p = this.player;
    this.dead = false;
    p.hp = p.maxHp;
    if (this.stratSet.has('qixing')) this.qixingBuff = true;
    p.iframe = 2.5;
    this.hooks.sfx('evolve');
    this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.6, r: 120, color: '#fee761' });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 120) {
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
