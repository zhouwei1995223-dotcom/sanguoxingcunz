// 兵线对冲的局内规则：一条路径、两侧兵营、手牌、粮草、升级。不依赖画布，方便直接模拟。

import { HEROES, HERO_BY_ID, type HeroDef } from '../data/heroes';
import {
  GRAIN_PER_SEC, HERO_CARD_COST, HERO_DECK_WEIGHT, LANE_CAP, LANE_GAP_PX, LANE_LEVELS, LANE_LV_COST, LANE_LV_STAT,
  LANE_RANGED_HEROES, LANE_SKILL_BY_HERO, LANE_UNIT_BY_ID, LANE_UNITS, LANE_UPGRADES, laneXpNeed, rollLaneLevel,
  type LaneLevelDef, type LaneSkillDef, type LaneUnitDef, type LaneUpgradeDef,
} from '../data/lane';

export interface LanePt { x: number; y: number }
export interface LanePath { pts: LanePt[]; cum: number[]; len: number }

export function makePath(pts: LanePt[]): LanePath {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, len: Math.max(1, cum[cum.length - 1]) };
}

/** 战场矩形里的一条来回弯的路：起点是我方兵营，终点是敌营 */
export function buildLanePath(x: number, y: number, w: number, h: number): LanePath {
  // 我军营在起点、敌营在终点。只走横竖直线，拐角 90°。比上一版多两道折返。相邻点必须共用 x 或 y。
  const L = 0.12;
  const R = 0.88;
  return makePath([
    { x: x + w * 0.50, y: y + h * 0.87 },
    { x: x + w * L, y: y + h * 0.87 },
    { x: x + w * L, y: y + h * 0.74 },
    { x: x + w * R, y: y + h * 0.74 },
    { x: x + w * R, y: y + h * 0.61 },
    { x: x + w * L, y: y + h * 0.61 },
    { x: x + w * L, y: y + h * 0.48 },
    { x: x + w * R, y: y + h * 0.48 },
    { x: x + w * R, y: y + h * 0.35 },
    { x: x + w * L, y: y + h * 0.35 },
    { x: x + w * L, y: y + h * 0.22 },
    { x: x + w * R, y: y + h * 0.22 },
    { x: x + w * R, y: y + h * 0.12 },
    { x: x + w * 0.50, y: y + h * 0.12 },
  ]);
}

export function pointAt(path: LanePath, s: number): { x: number; y: number; nx: number; ny: number; tx: number; ty: number } {
  const d = Math.max(0, Math.min(1, s)) * path.len;
  let i = 1;
  while (i < path.cum.length - 1 && path.cum[i] < d) i++;
  const span = path.cum[i] - path.cum[i - 1] || 1;
  const k = Math.max(0, Math.min(1, (d - path.cum[i - 1]) / span));
  const a = path.pts[i - 1];
  const b = path.pts[i];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const inv = 1 / (Math.hypot(dx, dy) || 1);
  return { x: a.x + dx * k, y: a.y + dy * k, tx: dx * inv, ty: dy * inv, nx: -dy * inv, ny: dx * inv };
}

export interface LaneHeroSnap {
  /** 主界面这名武将当前的基础攻击 / 生命（含等级、星级、巅峰、觉醒） */
  atk: number;
  hp: number;
  speed: number;
  sprite: string;
  frames: number;
}

export interface LaneCard {
  uid: number;
  kind: 'unit' | 'hero';
  id: string;
  lv: 1 | 2 | 3;
  /** 不含「简政」的费用，简政时按这个重算 */
  baseCost: number;
  cost: number;
  /** 不含全局攻击 / 生命加成的数值，卡面再乘当前加成 */
  atk: number;
  hp: number;
  name: string;
  blurb: string;
  sprite: string;
  frames: number;
  color: string;
  grain: boolean;
  scale: number;
  range: number;
  speed: number;
  interval: number;
  hero?: string;
}

export interface LaneUnit {
  id: number;
  side: 'ally' | 'enemy';
  kind: string;
  name: string;
  lv: number;
  s: number;
  lat: number;
  x: number;
  y: number;
  left: boolean;
  moving: boolean;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  range: number;
  interval: number;
  atkCd: number;
  stunT: number;
  burnT: number;
  burnDps: number;
  skillCd: number;
  skill?: LaneSkillDef;
  atkBuffT: number;
  atkBuff: number;
  spdBuffT: number;
  spdBuff: number;
  sprite: string;
  frames: number;
  scale: number;
  grain: boolean;
  hero: boolean;
  alive: boolean;
  flashT: number;
  color: string;
}

export interface LaneFloat { x: number; y: number; text: string; color: string; t: number }
export interface LaneBolt { x: number; y: number; tx: number; ty: number; t: number; life: number; color: string }
export interface LaneRing { x: number; y: number; r: number; t: number; color: string }
export interface LaneBanner { text: string; color: string }
export type LaneEventKind = 'play' | 'kill' | 'skill' | 'win' | 'lose' | 'upgrade' | 'camp';
export interface LaneEvent { kind: LaneEventKind; hero?: boolean }

const PLAYER_UNITS = LANE_UNITS.filter((u) => !u.enemy && u.weight > 0);
const PLAYER_WEIGHT = PLAYER_UNITS.reduce((s, u) => s + u.weight, 0);
const SKILL_CD = 8.6;
const RANGED = 80;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class LaneBattle {
  readonly level: LaneLevelDef;
  readonly path: LanePath;
  readonly rng: () => number;
  t = 0;
  food: number;
  hand: LaneCard[] = [];
  units: LaneUnit[] = [];
  allyHp: number;
  allyMax: number;
  enemyHp: number;
  enemyMax: number;
  xp = 0;
  /** 下一次升级所需；升过几次就是当前兵法等级 */
  rank = 1;
  xpNeed: number;
  pending: LaneUpgradeDef[] | null = null;
  result: 'win' | 'lose' | null = null;
  kills = 0;
  atkMul = 1;
  hpMul = 1;
  speedMul = 1;
  incomeMul = 1;
  dropMul = 1;
  costMul = 1;
  grainRateMul = 1;
  grainAuraMul = 1;
  skillMul = 1;
  skillCdCut = 0;
  rare = 0;
  floats: LaneFloat[] = [];
  bolts: LaneBolt[] = [];
  rings: LaneRing[] = [];
  bannerText = '';
  bannerColor = '#fee761';
  bannerT = 0;
  events: LaneEvent[] = [];
  private bannerQ: LaneBanner[] = [];
  private nextId = 1;
  private nextCard = 1;
  private enemyBudget: number;
  private enemyCd = 0.4;
  private grainFx = 0.6;
  private siegeT = 0.4;
  private siegeBag = { ally: 0, enemy: 0 };
  private forceNext: string | null = null;
  private heroSnap: (id: string) => LaneHeroSnap;

  constructor(opts: { levelId?: number; path: LanePath; seed?: number; heroSnap: (id: string) => LaneHeroSnap }) {
    this.level = LANE_LEVELS.find((l) => l.id === (opts.levelId || 1)) || LANE_LEVELS[0];
    this.path = opts.path;
    this.rng = mulberry32(opts.seed == null ? 1 : opts.seed);
    this.heroSnap = opts.heroSnap;
    this.food = this.level.startFood;
    this.allyMax = this.allyHp = this.level.allyHp;
    this.enemyMax = this.enemyHp = this.level.enemyHp;
    this.enemyBudget = this.level.enemyBudget0;
    this.xpNeed = laneXpNeed(1);
    for (let i = 0; i < 5; i++) this.hand.push(this.drawCard());
    if (!this.hand.some((c) => c.kind === 'unit' && c.baseCost <= 24)) this.hand[0] = this.drawCard('spear');
  }

  grainCount() {
    let n = 0;
    for (const u of this.units) if (u.alive && u.grain && u.side === 'ally') n++;
    return n;
  }

  /** 自然产出 + 在场粮卒。界面上的「每秒」用这个 */
  incomePerSec() {
    return this.level.income * this.incomeMul + this.grainCount() * GRAIN_PER_SEC * this.grainRateMul;
  }

  /** 有粮卒在场时，击败掉落的额外倍率（1 表示没有加成） */
  grainAura() {
    const n = this.grainCount();
    if (!n) return 1;
    return 1 + Math.min(1, n * 0.45) * this.grainAuraMul;
  }

  cardAtk(c: LaneCard) { return Math.max(1, Math.round(c.atk * this.atkMul)); }
  cardHp(c: LaneCard) { return Math.max(1, Math.round(c.hp * this.hpMul)); }

  step(dt: number) {
    if (this.result || this.pending) return;
    let left = dt;
    let guard = 0;
    while (left > 1e-4 && !this.result && !this.pending && guard++ < 40) {
      const h = Math.min(0.05, left);
      this.tick(h);
      left -= h;
    }
  }

  /** 点第 i 张手牌。成功返回 null，否则是给玩家看的短句。己方没有人数上限，粮草够就一直能出。 */
  play(index: number): string | null {
    if (this.result || this.pending) return null;
    const c = this.hand[index];
    if (!c) return null;
    if (this.food < c.cost) return '粮草不足';
    this.food -= c.cost;
    this.spawnFromCard(c);
    this.hand[index] = this.drawCard();
    this.pushEvent({ kind: 'play', hero: c.kind === 'hero' });
    return null;
  }

  pickUpgrade(index: number) {
    if (!this.pending) return;
    const up = this.pending[Math.max(0, Math.min(this.pending.length - 1, index))];
    this.pending = null;
    if (up) this.applyUpgrade(up.id);
    this.pushEvent({ kind: 'upgrade' });
    this.checkLevel();
  }

  /** 截图 / 调试：立刻弹出三选一 */
  debugOffer() {
    if (!this.pending && !this.result) this.pending = this.rollThree();
  }

  /** 截图：把最后一张手牌换成指定兵种，方便看到粮卒 */
  debugDeal(id: string) {
    this.hand[this.hand.length - 1] = this.makeUnitCard(id, 1);
  }

  consumeEvents(): LaneEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private tick(dt: number) {
    this.t += dt;
    this.food += this.level.income * this.incomeMul * dt;
    const grains = this.units.filter((u) => u.alive && u.grain && u.side === 'ally');
    if (grains.length) this.food += grains.length * GRAIN_PER_SEC * this.grainRateMul * dt;
    this.grainFx -= dt;
    if (this.grainFx <= 0) {
      this.grainFx = 1;
      for (const g of grains) this.float(g.x, g.y - 36, '+粮', '#9be37a');
    }
    for (const u of this.units) if (u.alive) this.cool(u, dt);
    this.moveSide('ally', dt);
    this.moveSide('enemy', dt);
    for (const u of this.units) if (u.alive) this.place(u);
    for (const u of this.units) {
      if (!u.alive || !u.skill || u.skillCd > 0) continue;
      this.castSkill(u);
      const cut = u.side === 'ally' ? this.skillCdCut : 0;
      u.skillCd = Math.max(4.2, SKILL_CD - cut);
    }
    const actors = this.units.filter((u) => u.alive);
    for (const u of actors) if (u.alive) this.strike(u);
    this.director(dt);
    this.siege(dt);
    this.decayFx(dt);
    this.units = this.units.filter((u) => u.alive);
    this.checkLevel();
    if (this.enemyHp <= 0) this.finish('win');
    else if (this.allyHp <= 0) this.finish('lose');
  }

  private cool(u: LaneUnit, dt: number) {
    u.atkCd = Math.max(0, u.atkCd - dt);
    u.stunT = Math.max(0, u.stunT - dt);
    u.flashT = Math.max(0, u.flashT - dt);
    u.skillCd = Math.max(0, u.skillCd - dt);
    if (u.atkBuffT > 0) u.atkBuffT = Math.max(0, u.atkBuffT - dt);
    if (u.spdBuffT > 0) u.spdBuffT = Math.max(0, u.spdBuffT - dt);
    if (u.burnT > 0) {
      u.burnT = Math.max(0, u.burnT - dt);
      this.hurt(u, u.burnDps * dt);
    }
  }

  private moveSide(side: 'ally' | 'enemy', dt: number) {
    const dir = side === 'ally' ? 1 : -1;
    const list = this.units.filter((u) => u.alive && u.side === side);
    list.sort((a, b) => {
      const ds = dir > 0 ? b.s - a.s : a.s - b.s;
      return Math.abs(ds) > 1e-4 ? ds : a.id - b.id;
    });
    const gap = LANE_GAP_PX / this.path.len;
    for (const u of list) {
      const prev = u.s;
      const step = (this.effSpeed(u) * dt) / this.path.len;
      let next = u.s;
      const held = u.stunT > 0 || this.grainHold(u);
      const foe = this.nearestFoe(u);
      const fighting = !!(foe && this.pathDist(u.s, foe.s) <= u.range);
      // 人多或血厚的一侧把交战线往前顶，避免两边站在路中间对耗到超时
      if (!held && !fighting) next = u.s + dir * step;
      else if (!held && fighting && foe && u.range < RANGED) {
        const myN = this.count(side);
        const foeN = this.count(side === 'ally' ? 'enemy' : 'ally');
        const my = u.hp / u.maxHp;
        const th = foe.hp / Math.max(1, foe.maxHp);
        let push = 0;
        if (myN > foeN + 1) push += 0.55;
        else if (foeN > myN + 1) push -= 0.42;
        if (my > th + 0.06) push += 0.65;
        else if (th > my + 0.1) push -= 0.48;
        // 已经压过中线还在占上风时加速冲营，不要在坡道中间耗死
        if (push > 0.15 && ((side === 'ally' && u.s > 0.6) || (side === 'enemy' && u.s < 0.4))) push += 0.4;
        if (push > 0) next = u.s + dir * step * push;
        else if (push < 0) next = u.s - dir * step * -push;
      }
      if (dir > 0) next = Math.min(0.955, next);
      else next = Math.max(0.045, next);
      for (const o of list) {
        if (o === u || !this.blocks(o, u)) continue;
        const ahead = dir > 0
          ? (o.s > u.s + 1e-4 || (o.s >= u.s - 1e-4 && o.id < u.id))
          : (o.s < u.s - 1e-4 || (o.s <= u.s + 1e-4 && o.id < u.id));
        if (!ahead) continue;
        const limit = o.s - dir * gap;
        if (dir > 0) next = Math.min(next, limit);
        else next = Math.max(next, limit);
      }
      if (held) {
        if (dir > 0) next = Math.min(next, u.s);
        else next = Math.max(next, u.s);
      }
      u.s = Math.max(0.04, Math.min(0.96, next));
      u.moving = Math.abs(u.s - prev) > 1e-5;
    }
  }

  /** 粮卒没有敌情时停在我方营前，让「在产粮」看得清楚 */
  private grainHold(u: LaneUnit) {
    if (!u.grain) return false;
    const foe = this.nearestFoe(u);
    if (foe && this.pathDist(u.s, foe.s) < 170) return false;
    return u.side === 'ally' ? u.s >= 0.175 : u.s <= 0.825;
  }

  private blocks(front: LaneUnit, back: LaneUnit) {
    if (front.grain) return false;
    if (front.range < RANGED) return true;
    return back.range >= RANGED;
  }

  private strike(u: LaneUnit) {
    if (!u.alive || u.stunT > 0 || u.atkCd > 0) return;
    const foe = this.nearestFoe(u);
    if (foe && this.pathDist(u.s, foe.s) <= u.range + 4) {
      this.hurt(foe, this.effAtk(u));
      u.atkCd = u.interval;
      if (u.range >= RANGED) this.bolt(u, foe, u.side === 'ally' ? '#ffe08a' : '#9fd4ff');
      return;
    }
    const atGate = u.side === 'ally' ? u.s >= 0.88 : u.s <= 0.12;
    if (!atGate) return;
    if (foe && this.pathDist(u.s, foe.s) <= u.range + 30) return;
    this.hitCamp(u.side === 'ally' ? 'enemy' : 'ally', this.effAtk(u));
    u.atkCd = u.interval;
  }

  private hurt(u: LaneUnit, dmg: number) {
    if (!u.alive || dmg <= 0) return;
    u.hp -= dmg;
    u.flashT = 0.12;
    if (u.hp > 0) return;
    u.alive = false;
    this.puff(u.x, u.y);
    if (u.side === 'enemy') {
      const gain = Math.max(3, Math.round((4 + u.maxHp * 0.018) * this.dropMul * this.grainAura()));
      this.food += gain;
      this.xp += 5 + Math.ceil(u.maxHp / 90);
      this.kills++;
      this.float(u.x, u.y - 20, '+' + gain, '#fee761');
      this.pushEvent({ kind: 'kill' });
    }
  }

  private hitCamp(which: 'ally' | 'enemy', dmg: number) {
    if (dmg <= 0 || this.result) return;
    if (which === 'enemy') {
      this.enemyHp = Math.max(0, this.enemyHp - dmg);
      const p = this.path.pts[this.path.pts.length - 1];
      this.float(p.x, p.y - 46, '-' + Math.round(dmg), '#ff8a80');
    } else {
      this.allyHp = Math.max(0, this.allyHp - dmg);
      const p = this.path.pts[0];
      this.float(p.x, p.y - 46, '-' + Math.round(dmg), '#ff8a80');
    }
    this.pushEvent({ kind: 'camp' });
  }

  private director(dt: number) {
    this.enemyBudget = Math.min(220, this.enemyBudget + (this.level.enemyRate + this.t * this.level.enemyRamp) * dt);
    this.enemyCd -= dt;
    if (this.enemyCd > 0 || this.count('enemy') >= LANE_CAP.enemy) return;
    const pool = this.enemyPool().filter((p) => p.cost <= this.enemyBudget);
    if (!pool.length) return;
    let sum = 0;
    for (const p of pool) sum += p.w;
    let r = this.rng() * sum;
    let pick = pool[pool.length - 1];
    for (const p of pool) { r -= p.w; if (r <= 0) { pick = p; break; } }
    this.enemyBudget -= pick.cost;
    this.spawnEnemy(pick.id);
    this.enemyCd = 0.42;
  }

  private enemyPool(): { id: string; w: number; cost: number }[] {
    const t = this.t;
    const list: { id: string; w: number; cost: number }[] = [{ id: 'e_spear', w: 10, cost: LANE_UNIT_BY_ID.e_spear.cost }];
    if (t > 10) list.push({ id: 'e_shield', w: 6, cost: LANE_UNIT_BY_ID.e_shield.cost });
    if (t > 16) list.push({ id: 'e_archer', w: 6, cost: LANE_UNIT_BY_ID.e_archer.cost });
    if (t > 6) list.push({ id: 'hero', w: 5, cost: LANE_UNIT_BY_ID.e_spear.cost });
    if (t > 28) list.push({ id: 'e_cav', w: 4, cost: LANE_UNIT_BY_ID.e_cav.cost });
    if (t > 48) list.push({ id: 'e_heavy', w: 3, cost: LANE_UNIT_BY_ID.e_heavy.cost });
    return list;
  }

  private drawCard(force?: string): LaneCard {
    const lv = rollLaneLevel(this.rng, this.rare);
    if (!force && this.forceNext) {
      const id = this.forceNext;
      this.forceNext = null;
      return this.makeUnitCard(id, lv);
    }
    if (force) return this.makeUnitCard(force, lv);
    const heroSlice = HERO_DECK_WEIGHT * HEROES.length;
    if (this.rng() * (PLAYER_WEIGHT + heroSlice) >= PLAYER_WEIGHT) {
      const h = HEROES[Math.floor(this.rng() * HEROES.length)];
      return this.makeHeroCard(h, lv);
    }
    let r = this.rng() * PLAYER_WEIGHT;
    for (const u of PLAYER_UNITS) {
      r -= u.weight;
      if (r <= 0) return this.makeUnitCard(u.id, lv);
    }
    return this.makeUnitCard('spear', lv);
  }

  private price(base: number) {
    return Math.max(8, Math.round(base * this.costMul));
  }

  private makeUnitCard(id: string, lv: 1 | 2 | 3): LaneCard {
    const d = LANE_UNIT_BY_ID[id] || LANE_UNIT_BY_ID.spear;
    const stat = LANE_LV_STAT[lv - 1];
    const baseCost = Math.round(d.cost * LANE_LV_COST[lv - 1]);
    return {
      uid: this.nextCard++, kind: 'unit', id: d.id, lv, baseCost, cost: this.price(baseCost),
      atk: Math.round(d.atk * stat), hp: Math.round(d.hp * stat),
      name: d.name, blurb: d.blurb, sprite: d.sprite, frames: 4, color: d.color,
      grain: !!d.grain, scale: d.scale || 1, range: d.range, speed: d.speed, interval: d.interval,
    };
  }

  private makeHeroCard(h: HeroDef, lv: 1 | 2 | 3): LaneCard {
    const snap = this.heroSnap(h.id);
    const stat = LANE_LV_STAT[lv - 1];
    // 比例跟主界面的基础攻击 / 生命一致；养成最多把这一关抬高一截，避免数值把试玩关打穿
    const grow = Math.min(1.8, Math.max(1, snap.atk / h.baseAtk));
    const invest = 0.78 + 0.22 * grow;
    const ranged = LANE_RANGED_HEROES.has(h.id);
    const skill = LANE_SKILL_BY_HERO[h.id];
    const baseCost = Math.round(HERO_CARD_COST * LANE_LV_COST[lv - 1]);
    return {
      uid: this.nextCard++, kind: 'hero', id: h.id, lv, baseCost, cost: this.price(baseCost),
      atk: Math.max(8, Math.round(h.baseAtk * 1.22 * stat * invest)),
      hp: Math.max(40, Math.round(h.baseHp * 1.5 * stat * invest)),
      name: h.name, blurb: skill ? skill.short : '武将', sprite: snap.sprite, frames: snap.frames || 4,
      color: h.color, grain: false, scale: 1.05, range: ranged ? 172 : 64,
      speed: (snap.speed || h.moveSpeed) * 0.8, interval: 0.78, hero: h.id,
    };
  }

  private spawnFromCard(c: LaneCard) {
    const u = this.makeUnit({
      side: 'ally', kind: c.id, name: c.name, lv: c.lv,
      hp: this.cardHp(c), atk: this.cardAtk(c), speed: c.speed, range: c.range, interval: c.interval,
      sprite: c.sprite, frames: c.frames, scale: c.scale, grain: c.grain, hero: c.kind === 'hero',
      color: c.color, skill: c.hero ? LANE_SKILL_BY_HERO[c.hero] : undefined,
    });
    u.s = 0.055 + (u.id % 5) * 0.004;
    this.place(u);
    this.units.push(u);
    if (u.skill) {
      u.skillCd = 0.28;
    }
    this.float(u.x, u.y - 30, c.name, '#fff4d6');
  }

  private spawnEnemy(id: string) {
    if (id === 'hero') {
      const h = HEROES[Math.floor(this.rng() * HEROES.length)];
      this.spawnEnemyHero(h);
      return;
    }
    const d = LANE_UNIT_BY_ID[id];
    if (!d) return;
    // 拖久了敌军越来越厚，中期还没推到敌营就会被顶回来
    const growHp = 1 + Math.min(1.15, this.t * 0.006);
    const growAtk = 1 + Math.min(0.75, this.t * 0.0042);
    const u = this.makeUnit({
      side: 'enemy', kind: d.id, name: d.name, lv: 1,
      hp: Math.round(d.hp * this.level.enemyHpMul * growHp), atk: Math.round(d.atk * this.level.enemyAtkMul * growAtk),
      speed: d.speed, range: d.range, interval: d.interval, sprite: d.sprite, frames: 4,
      scale: d.scale || 1, grain: false, hero: false, color: d.color,
    });
    u.s = 0.94 - (u.id % 4) * 0.004;
    this.place(u);
    this.units.push(u);
  }

  /** 敌营出武将：用武将表的基础攻击、生命和默认骑马造型，技能同一套 */
  private spawnEnemyHero(h: HeroDef) {
    const growHp = 1 + Math.min(1.15, this.t * 0.006);
    const growAtk = 1 + Math.min(0.75, this.t * 0.0042);
    const ranged = LANE_RANGED_HEROES.has(h.id);
    const u = this.makeUnit({
      side: 'enemy', kind: h.id, name: h.name, lv: 1,
      hp: Math.max(40, Math.round(h.baseHp * 1.5 * this.level.enemyHpMul * growHp)),
      atk: Math.max(8, Math.round(h.baseAtk * 1.22 * this.level.enemyAtkMul * growAtk)),
      speed: h.moveSpeed * 0.8, range: ranged ? 172 : 64, interval: 0.78,
      sprite: 'hero_' + h.id, frames: 4, scale: 1.05, grain: false, hero: true, color: h.color,
      skill: LANE_SKILL_BY_HERO[h.id],
    });
    u.s = 0.93 - (u.id % 3) * 0.004;
    u.skillCd = 0.45;
    this.place(u);
    this.units.push(u);
    this.float(u.x, u.y - 36, h.name, h.color);
  }

  private makeUnit(p: {
    side: 'ally' | 'enemy'; kind: string; name: string; lv: number; hp: number; atk: number; speed: number;
    range: number; interval: number; sprite: string; frames: number; scale: number; grain: boolean; hero: boolean;
    color: string; skill?: LaneSkillDef;
  }): LaneUnit {
    const id = this.nextId++;
    const spread = p.hero ? 6 : p.grain ? 0 : 10;
    return {
      id, side: p.side, kind: p.kind, name: p.name, lv: p.lv, s: 0.5, lat: ((id % 5) - 2) * spread,
      x: 0, y: 0, left: p.side === 'enemy', moving: true, hp: p.hp, maxHp: p.hp, atk: p.atk, speed: p.speed,
      range: p.range, interval: p.interval, atkCd: 0.25, stunT: 0, burnT: 0, burnDps: 0,
      skillCd: 999, skill: p.skill, atkBuffT: 0, atkBuff: 1, spdBuffT: 0, spdBuff: 1,
      sprite: p.sprite, frames: p.frames, scale: p.scale, grain: p.grain, hero: p.hero, alive: true, flashT: 0, color: p.color,
    };
  }

  private castSkill(u: LaneUnit) {
    const sk = u.skill;
    if (!sk || !u.alive) return;
    const atk = this.effAtk(u) * (u.side === 'ally' ? this.skillMul : 1);
    this.banner(`${u.name} · ${sk.name}`, u.color || '#fee761');
    this.pushEvent({ kind: 'skill', hero: true });
    this.ring(u.x, u.y, sk.kind === 'snipe' || sk.kind === 'volley' ? 18 : 34, u.color || '#fee761');
    if (sk.kind === 'dash') this.dash(u, 96, atk * 2.15);
    else if (sk.kind === 'cleave') this.cleave(u, atk * 2.5);
    else if (sk.kind === 'stun') this.stunNear(u, 110, 1.7, atk * 1.15);
    else if (sk.kind === 'burn') this.burnNear(u, 150, atk * 0.62, 3);
    else if (sk.kind === 'fury') { u.atkBuff = 1.85; u.atkBuffT = 3.2; this.poke(u, atk * 1.6); }
    else if (sk.kind === 'snipe') this.snipe(u, atk * 3.3);
    else if (sk.kind === 'charge') { u.spdBuff = 1.75; u.spdBuffT = 3.4; this.dash(u, 70, atk * 1.9); }
    else if (sk.kind === 'volley') this.volley(u, atk * 1.05);
    else if (sk.kind === 'guard') this.guard(u);
    else if (sk.kind === 'meteor') this.meteor(u, atk * 2.25);
  }

  private dash(u: LaneUnit, dist: number, dmg: number) {
    const from = u.s;
    const dir = u.side === 'ally' ? 1 : -1;
    u.s = Math.max(0.045, Math.min(0.955, u.s + dir * (dist / this.path.len)));
    u.moving = true;
    this.place(u);
    for (const e of this.foes(u)) {
      if (e.s >= Math.min(from, u.s) - 0.012 && e.s <= Math.max(from, u.s) + 0.012) this.hurt(e, dmg);
    }
  }

  private cleave(u: LaneUnit, dmg: number) {
    const foe = this.nearestFoe(u);
    if (!foe) return;
    this.hurt(foe, dmg);
    this.ring(foe.x, foe.y, 40, '#9be37a');
    for (const e of this.foes(u)) if (e !== foe && this.pathDist(e.s, foe.s) < 70) this.hurt(e, dmg * 0.72);
  }

  private stunNear(u: LaneUnit, dist: number, dur: number, dmg: number) {
    let n = 0;
    for (const e of this.foes(u)) if (this.pathDist(u.s, e.s) <= dist) { e.stunT = Math.max(e.stunT, dur); this.hurt(e, dmg); n++; }
    if (!n) this.float(u.x, u.y - 24, '无人可震', '#fff');
  }

  private burnNear(u: LaneUnit, dist: number, dps: number, dur: number) {
    for (const e of this.foes(u)) if (this.pathDist(u.s, e.s) <= dist) { e.burnT = Math.max(e.burnT, dur); e.burnDps = Math.max(e.burnDps, dps); }
  }

  private poke(u: LaneUnit, dmg: number) {
    const foe = this.nearestFoe(u);
    if (foe && this.pathDist(u.s, foe.s) < 260) { this.hurt(foe, dmg); this.bolt(u, foe, '#ffb070'); }
  }

  private snipe(u: LaneUnit, dmg: number) {
    let best: LaneUnit | null = null;
    for (const e of this.foes(u)) if (!best || e.hp > best.hp) best = e;
    if (!best) return;
    this.hurt(best, dmg);
    this.bolt(u, best, '#fee761');
    this.ring(best.x, best.y, 26, '#fee761');
  }

  private volley(u: LaneUnit, dmg: number) {
    const list = this.foes(u).sort((a, b) => this.pathDist(u.s, a.s) - this.pathDist(u.s, b.s)).slice(0, 4);
    for (const e of list) { this.hurt(e, dmg); this.bolt(u, e, '#f5a3c7'); }
  }

  private guard(u: LaneUnit) {
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3);
    this.float(u.x, u.y - 28, '回血', '#9be37a');
    for (const a of this.units) {
      if (!a.alive || a.side !== u.side || a === u) continue;
      if (this.pathDist(u.s, a.s) <= 130) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.12);
    }
  }

  private meteor(u: LaneUnit, dmg: number) {
    const foes = this.foes(u);
    if (!foes.length) return;
    let best = foes[0];
    let bestN = -1;
    for (const e of foes) {
      let n = 0;
      for (const o of foes) if (this.pathDist(e.s, o.s) < 80) n++;
      if (n > bestN) { bestN = n; best = e; }
    }
    this.ring(best.x, best.y, 48, '#8fb8ff');
    for (const e of foes) if (this.pathDist(e.s, best.s) <= 80) this.hurt(e, dmg);
  }

  private applyUpgrade(id: string) {
    if (id === 'income') this.incomeMul *= 1.28;
    else if (id === 'drop') this.dropMul *= 1.4;
    else if (id === 'grain') { this.grainRateMul *= 1.55; this.grainAuraMul *= 1.2; }
    else if (id === 'atk') {
      this.atkMul *= 1.15;
      for (const u of this.units) if (u.alive && u.side === 'ally') u.atk *= 1.15;
    } else if (id === 'hp') {
      this.hpMul *= 1.18;
      for (const u of this.units) if (u.alive && u.side === 'ally') { u.maxHp *= 1.18; u.hp *= 1.18; }
    } else if (id === 'cost') {
      this.costMul = Math.max(0.55, this.costMul * 0.92);
      for (const c of this.hand) c.cost = this.price(c.baseCost);
    } else if (id === 'rare') this.rare++;
    else if (id === 'camp') {
      const add = this.allyMax * 0.22;
      this.allyMax += add;
      this.allyHp = Math.min(this.allyMax, this.allyHp + add);
    } else if (id === 'speed') this.speedMul *= 1.12;
    else if (id === 'skill') { this.skillMul *= 1.25; this.skillCdCut += 1; }
    else if (id === 'spear') this.forceNext = 'spear';
    else if (id === 'bonus') { this.food += 48; this.float(this.path.pts[0].x, this.path.pts[0].y - 40, '+48', '#fee761'); }
    const def = LANE_UPGRADES.find((u) => u.id === id);
    if (def) this.banner(def.name, '#9be37a');
  }

  private rollThree(): LaneUpgradeDef[] {
    const bag = LANE_UPGRADES.slice();
    const out: LaneUpgradeDef[] = [];
    while (out.length < 3 && bag.length) {
      const i = Math.floor(this.rng() * bag.length);
      out.push(bag.splice(i, 1)[0]);
    }
    return out;
  }

  /** 压过中线的单位会持续打兵营，交战线不会在坡道中间耗到没完 */
  private siege(dt: number) {
    let ally = 0;
    let enemy = 0;
    for (const u of this.units) {
      if (!u.alive || u.grain) continue;
      if (u.side === 'ally' && u.s > 0.52) enemy += this.effAtk(u) * Math.min(1, (u.s - 0.52) / 0.32);
      else if (u.side === 'enemy' && u.s < 0.48) ally += this.effAtk(u) * Math.min(1, (0.48 - u.s) / 0.32);
    }
    const rate = 0.38;
    if (enemy > 0) this.enemyHp = Math.max(0, this.enemyHp - enemy * rate * dt);
    if (ally > 0) this.allyHp = Math.max(0, this.allyHp - ally * rate * dt);
    this.siegeBag.ally += ally * rate * dt;
    this.siegeBag.enemy += enemy * rate * dt;
    this.siegeT -= dt;
    if (this.siegeT > 0) return;
    this.siegeT = 0.75;
    const end = this.path.pts[this.path.pts.length - 1];
    const start = this.path.pts[0];
    if (this.siegeBag.enemy >= 6) { this.float(end.x, end.y - 52, '-' + Math.round(this.siegeBag.enemy), '#ff8a80'); this.siegeBag.enemy = 0; }
    if (this.siegeBag.ally >= 6) { this.float(start.x, start.y - 52, '-' + Math.round(this.siegeBag.ally), '#ff8a80'); this.siegeBag.ally = 0; }
  }

  private checkLevel() {
    if (this.pending || this.result) return;
    if (this.xp < this.xpNeed) return;
    this.xp -= this.xpNeed;
    this.rank++;
    this.xpNeed = laneXpNeed(this.rank);
    this.pending = this.rollThree();
  }

  private finish(result: 'win' | 'lose') {
    if (this.result) return;
    this.result = result;
    this.pending = null;
    this.banner(result === 'win' ? '敌营已破' : '兵营失守', result === 'win' ? '#9be37a' : '#ff8a80');
    this.pushEvent({ kind: result });
  }

  private count(side: 'ally' | 'enemy') {
    let n = 0;
    for (const u of this.units) if (u.alive && u.side === side) n++;
    return n;
  }

  private foes(u: LaneUnit) {
    const out: LaneUnit[] = [];
    for (const o of this.units) if (o.alive && o.side !== u.side) out.push(o);
    return out;
  }

  private nearestFoe(u: LaneUnit): LaneUnit | null {
    let best: LaneUnit | null = null;
    let bestD = 1e9;
    for (const o of this.units) {
      if (!o.alive || o.side === u.side) continue;
      const d = this.pathDist(u.s, o.s);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  private pathDist(a: number, b: number) { return Math.abs(a - b) * this.path.len; }

  private effAtk(u: LaneUnit) {
    return u.atk * (u.atkBuffT > 0 ? u.atkBuff : 1);
  }

  private effSpeed(u: LaneUnit) {
    const mul = u.side === 'ally' ? this.speedMul : 1;
    return u.speed * mul * (u.spdBuffT > 0 ? u.spdBuff : 1);
  }

  private place(u: LaneUnit) {
    const p = pointAt(this.path, u.s);
    const dir = u.side === 'ally' ? 1 : -1;
    const ahead = pointAt(this.path, u.s + dir * 0.015);
    u.x = p.x + p.nx * u.lat;
    u.y = p.y + p.ny * u.lat;
    u.left = ahead.x < p.x - 0.4;
  }

  private bolt(from: LaneUnit, to: LaneUnit, color: string) {
    if (this.bolts.length > 24) this.bolts.shift();
    this.bolts.push({ x: from.x, y: from.y - 16, tx: to.x, ty: to.y - 16, t: 0, life: 0.18, color });
  }

  private ring(x: number, y: number, r: number, color: string) {
    if (this.rings.length > 16) this.rings.shift();
    this.rings.push({ x, y, r, t: 0, color });
  }

  private puff(x: number, y: number) {
    this.ring(x, y, 14, '#c9b48e');
  }

  private float(x: number, y: number, text: string, color: string) {
    if (this.floats.length > 28) this.floats.shift();
    this.floats.push({ x, y, text, color, t: 0 });
  }

  private banner(text: string, color: string) {
    this.bannerQ.push({ text, color });
    if (this.bannerQ.length > 4) this.bannerQ.shift();
    if (this.bannerT <= 0) this.flushBanner();
  }

  private flushBanner() {
    const b = this.bannerQ.shift();
    if (!b) return;
    this.bannerText = b.text;
    this.bannerColor = b.color;
    this.bannerT = 1.35;
  }

  private decayFx(dt: number) {
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 1.05);
    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter((b) => b.t < b.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.45);
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.flushBanner();
    }
  }

  private pushEvent(e: LaneEvent) {
    this.events.push(e);
    if (this.events.length > 24) this.events.shift();
  }
}

/** 给模拟和自动试玩用的出牌。idle 什么都不做。 */
export function laneAiAction(b: LaneBattle, style: 'smart' | 'random' | 'idle', rng: () => number): { play?: number; upgrade?: number } | null {
  if (b.result || style === 'idle') return null;
  if (b.pending) {
    if (style === 'random') return { upgrade: Math.floor(rng() * b.pending.length) };
    const order = ['atk', 'hp', 'skill', 'drop', 'income', 'grain', 'speed', 'camp', 'cost', 'rare', 'bonus', 'spear'];
    let best = 0;
    let score = 99;
    b.pending.forEach((u, i) => {
      const s = order.indexOf(u.id);
      if (s >= 0 && s < score) { score = s; best = i; }
    });
    return { upgrade: best };
  }
  const afford: number[] = [];
  b.hand.forEach((c, i) => { if (c.cost <= b.food) afford.push(i); });
  if (!afford.length) return null;
  if (style === 'random') {
    if (rng() < 0.32) return null;
    return { play: afford[Math.floor(rng() * afford.length)] };
  }
  const grains = b.grainCount();
  let best = -1;
  let bestScore = -1e9;
  for (const i of afford) {
    const c = b.hand[i];
    if (b.food - c.cost < 6 && c.kind !== 'hero' && c.cost > 20) continue;
    let score = (b.cardAtk(c) * 1.3 + b.cardHp(c) * 0.15) / c.cost;
    if (c.grain) score = grains === 0 ? 8 : grains === 1 ? 3.2 : -1;
    if (c.kind === 'hero') score += 1.4;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best < 0) return null;
  return { play: best };
}
