import { BOSSES, ENEMIES } from '../data/enemies';
import { AID_LIMIT, ALLY_WEIGHT, ALLY_CARDS, ALLY_IDS, AllyId, Branch, FORMATIONS, GATE_HP, Point, TACTIC_CARDS, TACTIC_IDS, TacticId, TowerCard, TowerKind, TowerMap, TOWERS, TOWER_KINDS, WAVE_NAMES, towerRange } from '../data/tower';

export interface Emplacement { kind: TowerKind; level: number; cooldown: number; firedAt: number; left: boolean; branch?: Branch }
export interface TowerAlly { id: AllyId; level: number; x: number; y: number; left: boolean; cooldown: number }
export interface Marcher {
  x: number; y: number; route: number; next: number; remaining: number; hp: number; maxHp: number;
  speed: number; armor: boolean; gateDamage: number; bounty: number; sprite: string; left: boolean; stun: number; flash: number; frozenUntil: number;
  banner: boolean; shield: number; maxShield: number;
  /** 敌将名，仅用于画面横幅。 */
  name?: string;
}
export interface Strike {
  kind: TowerKind | 'command' | 'slash' | 'roar' | 'frost' | 'lightning' | 'deploy' | 'iceShard' | 'arc' | 'blast' | 'dust' | 'breakShield'; x: number; y: number; tx: number; ty: number;
  age: number; life: number; radius: number; impactDamage?: number; burnTime?: number; target?: Marcher;
}
export interface OilPatch { x: number; y: number; radius: number; damage: number; life: number; maxLife: number; tick: number }
/** 只给画面用的战斗事件：场景每帧取走；模拟器不开 fxOn，不会堆积。 */
export type TowerEvent =
  | { t: 'hit'; e: Marcher; dmg: number }
  | { t: 'kill'; e: Marcher }
  | { t: 'leak'; e: Marcher }
  | { t: 'fire'; slot: number; kind: TowerKind; tx: number; ty: number }
  | { t: 'impact'; kind: 'arrow' | 'stone' | 'oil' | 'blast'; x: number; y: number; r: number }
  | { t: 'build'; slot: number; level: number }
  | { t: 'boss'; e: Marcher; final: boolean }
  | { t: 'tactic'; id: TacticId; x: number; y: number }
  | { t: 'ally'; id: AllyId; x: number; y: number; tx: number; ty: number }
  | { t: 'command'; x: number; y: number; r: number }
  | { t: 'shield'; x: number; y: number }
  | { t: 'wave'; index: number; total: number; name: string; boss: boolean }
  | { t: 'revive'; n: number };

export type WaveKind = 'first' | 'troop' | 'mounted' | 'armored' | 'swarm' | 'boss';
export interface WavePlan { kind: WaveKind; count: number; gap: number; elites: number; boss?: 'mid' | 'final'; name: string }
/** 两波之间的休整秒数；第一波前的准备秒数。 */
export const WAVE_REST = 7, FIRST_REST = 4;
/** 布阵复活：最多次数与每次的全塔增伤 */
export const TOWER_REVIVE_MAX = 3;
export const TOWER_REVIVE_BONUS = [0.1, 0.15, 0.2];

/** 按关卡波数生成固定的波次表：每三波穿插一次骑兵 / 盾阵，第四波起偶尔大军压境，中间一波敌将、最后一波主将。 */
export function wavePlan(map: TowerMap): WavePlan[] {
  const n = map.waves, mid = Math.floor((n - 1) / 2), plan: WavePlan[] = [];
  for (let i = 0; i < n; i++) {
    const p = n > 1 ? i / (n - 1) : 1;
    const boss = i === mid ? 'mid' as const : i === n - 1 ? 'final' as const : undefined;
    const kind: WaveKind = i === 0 ? 'first' : boss ? 'boss' : i % 3 === 2 ? (Math.floor(i / 3) % 2 ? 'armored' : 'mounted') : i % 4 === 3 ? 'swarm' : 'troop';
    const count = Math.round((9 + 15 * p) * (kind === 'swarm' ? 1.4 : kind === 'mounted' ? 1.1 : 1));
    const gap = (kind === 'swarm' ? .78 : 1.15) - .35 * p;
    const elites = i < 2 ? 0 : 1 + Math.floor(i / 4);
    const name = boss ? (boss === 'final' ? '主将亲征' : '敌将率部') : WAVE_NAMES[kind as keyof typeof WAVE_NAMES];
    plan.push({ kind, count, gap, elites, boss, name });
  }
  return plan;
}

const distance = (x: number, y: number, a: number, b: number) => Math.hypot(x - a, y - b);
const routeLength = (path: Point[]) => path.slice(1).reduce((s, p, i) => s + distance(...p, ...path[i]), 0);

export class TowerBattle {
  readonly towers: (Emplacement | null)[];
  readonly enemies: Marcher[] = [];
  readonly strikes: Strike[] = [];
  readonly oil: OilPatch[] = [];
  readonly formations = new Set<TacticId>();
  readonly fallen: Marcher[] = [];
  readonly lengths: number[];
  /** 打开后记录 events 供画面使用（模拟器保持关闭）。 */
  fxOn = false;
  readonly events: TowerEvent[] = [];
  level = 1;
  xp = 0;
  aidUsed = 0;
  offer: { cards: TowerCard[]; aid: boolean } | null = null;
  readonly allies: TowerAlly[] = [];
  readonly tactics: { id: TacticId; level: number; cooldown: number }[] = [];
  hp = GATE_HP;
  leaks = 0;
  kills = 0;
  elapsed = 0;
  phase: 'fight' | 'win' | 'loss' = 'fight';
  commandCd = 0;
  repaired = false;
  generalsSent = 0;
  /** 波次 */
  readonly plan: WavePlan[];
  waveIdx = -1;
  restT = FIRST_REST;
  allSpawned = false;
  private queue: ('troop' | 'armored' | 'mounted' | 'elite' | 'mid' | 'final')[] = [];
  private queueT = 0;
  private waveCount = 0;
  /** 复活 */
  reviveCount = 0;
  reviveBonus = 0;
  /** 玩家主动撤军（不提供复活） */
  quit = false;
  /** 援将强度倍率：按局外武将实际攻击（含等级、星级、装备、军略）折算，1 = 一级新武将 */
  readonly allyPower: Partial<Record<AllyId, number>>;
  constructor(readonly map: TowerMap, readonly hero: string, readonly bonus: number, private random = Math.random, allyPower: Partial<Record<AllyId, number>> = {}) {
    this.towers = map.sites.map(() => null);
    this.towers[0] = { kind: 'arrow', level: 1, cooldown: 0, firedAt: -1, left: false };
    this.lengths = map.routes.map(routeLength);
    this.plan = wavePlan(map);
    this.allyPower = allyPower;
  }
  get waveTotal() { return this.plan.length; }
  /** 当前（或下一）波的序号，从 1 起 */
  get waveNo() { return Math.min(this.waveTotal, this.waveIdx + 1 + (this.queue.length || this.waveIdx < 0 ? 0 : 0)); }
  get resting() { return !this.allSpawned && !this.queue.length && this.restT > 0; }
  get canRevive() { return this.phase === 'loss' && !this.quit && this.reviveCount < TOWER_REVIVE_MAX; }
  /** 全塔伤害倍率：将令加成 + 复活加成 */
  private get towerPower() { return 1 + this.bonus + this.reviveBonus; }
  private emit(ev: TowerEvent) {
    if (this.fxOn && this.events.length < 400) this.events.push(ev);
  }
  get over() { return this.phase === 'win' || this.phase === 'loss'; }
  get stars() { return this.phase !== 'win' ? 0 : this.leaks === 0 ? 3 : this.leaks <= 5 ? 2 : 1; }
  get progress() {
    if (this.allSpawned) return 1;
    if (this.waveIdx < 0) return 0;
    const w = this.plan[this.waveIdx], total = w.count + w.elites + (w.boss ? 1 : 0);
    return Math.min(1, (this.waveIdx + (total - this.queue.length) / total) / this.waveTotal);
  }
  get openSites() { return this.towers.length - AID_LIMIT + this.aidUsed; }
  get xpNeeded() { return this.level === 1 ? 8 : 14 + this.level * 4; }
  get canReinforce() { return !this.over && !this.offer && this.aidUsed < AID_LIMIT; }


  /** 新建、已有塔的有效升级/分支、援将及阵法共同参与抽取。 */
  private rewardPool(): TowerCard[] {
    const pool: TowerCard[] = [];
    this.towers.forEach((t, slot) => {
      if (!t) return;
      if (t.level === 1) {
        pool.push({ type: 'tower', kind: t.kind, slot, level: 2 });
      } else if (t.level === 2) {
        for (const branch of [0, 1] as const) pool.push({ type: 'tower', kind: t.kind, slot, level: 3, branch });
      }
    });
    const slot = this.towers.indexOf(null);
    if (slot >= 0 && slot < this.openSites) {
      for (const kind of TOWER_KINDS) pool.push({ type: 'tower', kind, slot, level: 1 });
    }
    for (const id of ALLY_IDS) pool.push({ type: 'ally', id });
    for (const id of TACTIC_IDS) pool.push({ type: 'tactic', id });
    return pool;
  }

  /** 从候选奖励中按单牌权重、不放回抽取三项。 */
  private drawThree(pool: TowerCard[]) {
    const cards: TowerCard[] = [];
    const weight = (card: TowerCard) => card.type === 'ally' ? ALLY_WEIGHT : 1;
    while (cards.length < 3 && pool.length) {
      let ticket = this.random() * pool.reduce((sum, c) => sum + weight(c), 0);
      let i = 0;
      while (i < pool.length - 1 && ticket >= weight(pool[i])) {
        ticket -= weight(pool[i]);
        i++;
      }
      const [card] = pool.splice(i, 1);
      cards.push(card);
    }
    return cards;
  }

  private checkLevel() {
    if (this.offer || this.over || this.xp < this.xpNeeded) return;
    this.xp -= this.xpNeeded;
    this.level++;
    this.offer = { aid: false, cards: this.drawThree(this.rewardPool()) };
  }

  offerAid() {
    if (!this.canReinforce) return false;
    const slot = this.towers.indexOf(null);
    if (slot < 0) return false;
    const pool: TowerCard[] = TOWER_KINDS.map(kind => ({ type: 'tower', kind, slot, level: 1 }));
    this.offer = { aid: true, cards: this.drawThree(pool) };
    return true;
  }

  choose(card: TowerCard) {
    if (this.over || !this.offer?.cards.includes(card)) return false;
    if (card.type === 'tower') {
      const current = this.towers[card.slot];
      if (card.level !== (current?.level ?? 0) + 1) return false;
      this.towers[card.slot] = { kind: card.kind, level: card.level, branch: card.branch, cooldown: current?.cooldown ?? 0, firedAt: -1, left: current?.left ?? false };
      const [x, y] = this.map.sites[card.slot];
      this.strikes.push({ kind: 'deploy', x, y, tx: x, ty: y - 7, age: 0, life: 1, radius: 27 });
      this.emit({ t: 'build', slot: card.slot, level: card.level });
    } else if (card.type === 'ally') {
      const ally = this.allies.find(a => a.id === card.id);
      if (ally) ally.level++;
      else {
        const road = this.map.routes[0], [x, y] = road[road.length - 1];
        this.allies.push({ id: card.id, level: 1, x, y: y - 18, cooldown: 0, left: false });
      }
    } else {
      const tactic = this.tactics.find(t => t.id === card.id);
      if (tactic) tactic.level++;
      else this.tactics.push({ id: card.id, level: 1, cooldown: 0 });
    }
    for (const tactic of this.tactics) {
      if (this.towers.some(t => t?.kind === FORMATIONS[tactic.id].kind)) this.formations.add(tactic.id);
    }
    if (this.offer.aid) this.aidUsed++;
    this.offer = null;
    this.checkLevel();
    return true;
  }
  repair() {
    if (this.over || this.repaired || this.hp >= GATE_HP) return false;
    this.hp = Math.min(GATE_HP, this.hp + 5);
    this.repaired = true;
    return true;
  }
  cast(x: number, y: number) {
    if (this.offer || this.over || this.commandCd > 0) return false;
    const dragon = this.hero === 'zhaoyun', radius = dragon ? 69 : 80;
    this.strikes.push({ kind: 'command', x, y, tx: x, ty: y, age: 0, life: 0.8, radius });
    this.emit({ t: 'command', x, y, r: radius });
    for (const e of this.enemies) if (distance(x, y, e.x, e.y) <= radius) {
      this.hit(e, (dragon ? 90 : 62) + (1 + 14 * this.progress) * (dragon ? 6 : 4));
      e.stun = dragon ? 0.9 : 2;
    }
    this.commandCd = dragon ? 28 : 24;
    this.collectKills();
    this.finishStep();
    return true;
  }
  /** 开始下一波：按波次类型排好出兵顺序（精英均匀穿插，敌将在中段出阵）。 */
  private startWave() {
    this.waveIdx++;
    const w = this.plan[this.waveIdx], p = this.waveTotal > 1 ? this.waveIdx / (this.waveTotal - 1) : 1;
    const q: typeof this.queue = [];
    const armorShare = w.kind === 'armored' ? .65 : w.kind === 'first' ? 0 : .25 * Math.min(1, p * 3);
    const cavalryShare = w.kind === 'mounted' ? .7 : w.kind === 'first' ? 0 : .3 * Math.min(1, p * 2.2);
    for (let i = 0; i < w.count; i++) {
      const mix = this.random();
      q.push(w.kind === 'swarm' ? 'troop' : mix < armorShare ? 'armored' : mix > 1 - cavalryShare ? 'mounted' : 'troop');
    }
    for (let k = 0; k < w.elites; k++) q.splice(Math.round((k + 1) * q.length / (w.elites + 1)), 0, 'elite');
    if (w.boss) q.splice(Math.ceil(q.length / 2), 0, w.boss);
    this.queue = q;
    this.queueT = 0;
    this.waveCount = 0;
    this.emit({ t: 'wave', index: this.waveIdx + 1, total: this.waveTotal, name: w.name, boss: !!w.boss });
  }
  /** 休整中提前出击：剩余秒数按 1.5 倍折成军阵经验。 */
  callNext() {
    if (!this.resting || this.over || this.offer) return 0;
    const gain = Math.round(this.restT * 1.5);
    this.xp += gain;
    this.restT = 0;
    this.checkLevel();
    return gain;
  }
  /** 城门失守后复活：城门恢复一半，清掉逼近城门的敌人，全塔增伤一档。 */
  revive() {
    if (!this.canRevive) return false;
    this.reviveBonus += TOWER_REVIVE_BONUS[this.reviveCount];
    this.reviveCount++;
    this.hp = Math.ceil(GATE_HP / 2);
    this.phase = 'fight';
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.remaining > 80 || e.gateDamage === 5) continue;
      this.enemies.splice(i, 1);
      this.fallen.push(e);
      this.emit({ t: 'kill', e });
    }
    this.emit({ t: 'revive', n: this.reviveCount });
    return true;
  }
  private spawn(rank: 'troop' | 'armored' | 'mounted' | 'elite' | 'mid' | 'final') {
    const p = this.progress, boss = rank === 'mid' || rank === 'final', elite = rank === 'elite';
    const armored = rank === 'armored', mounted = rank === 'mounted';
    const armorId = armored && this.random() < p / 3 ? 'wei_heavy' : this.map.shield;
    const id = boss ? this.map.bosses[rank === 'mid' ? 0 : 1] : armored ? armorId : mounted ? this.map.cavalry : this.map.troop;
    // 只从已开放的路线出兵；首波偏向首塔一侧。
    const open = this.map.routes.map((_, i) => i).filter(i => (this.map.routeWave?.[i] ?? 0) <= Math.max(0, this.waveIdx));
    const route = open.length === 1 || (this.waveIdx === 0 && this.random() < .6) ? open[0] : open[Math.floor(this.random() * open.length)];
    const [x, y] = this.map.routes[route][0];
    const pressure = 1 + (this.map.latePressure - 1) * p * (2 - p);
    const hp = Math.round((27 + 138 * p) * this.map.strength * pressure * (.96 + .08 * this.random())
      * (rank === 'final' ? 12 : rank === 'mid' ? 7 : elite ? 2.5 : armored ? 1.32 : mounted ? .84 : 1));
    const shieldy = this.map.elite === 'shield' || this.map.elite === 'both', bannered = this.map.elite === 'banner' || this.map.elite === 'both';
    const shield = elite && shieldy ? Math.round(hp * .18) : 0;
    this.enemies.push({
      x, y, route, next: 1, remaining: this.lengths[route], hp, maxHp: hp,
      speed: (boss ? 17 : mounted ? 36 : armored ? 21 : 26) * (1 + .08 * p) * (.96 + .08 * this.random()),
      armor: armored, gateDamage: boss ? 5 : elite ? 2 : 1, bounty: boss ? 34 : elite ? 12 : 4,
      sprite: (boss ? BOSSES[id] : ENEMIES[id]).sprite, left: false, stun: 0, flash: 0, frozenUntil: 0,
      banner: elite && bannered, shield, maxShield: shield, name: boss ? BOSSES[id].name : undefined
    });
    if (boss) { this.generalsSent++; this.emit({ t: 'boss', e: this.enemies[this.enemies.length - 1], final: rank === 'final' }); }
  }
  private hit(e: Marcher, damage: number, siege = false) {
    if (e.hp <= 0) return;
    if (e.shield > 0) {
      const multiplier = siege ? 2 : 1;
      const absorbed = Math.min(damage, e.shield / multiplier);
      e.shield -= absorbed * multiplier;
      damage -= absorbed;
      if (e.shield <= 0) {
        this.strikes.push({ kind: 'breakShield', x: e.x, y: e.y, tx: e.x, ty: e.y, age: 0, life: .32, radius: 14 });
        this.emit({ t: 'shield', x: e.x, y: e.y });
      }
    }
    e.hp -= damage;
    e.flash = .08;
    this.emit({ t: 'hit', e, dmg: damage });
  }

  private collectKills() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp > 0) continue;
      this.fallen.push(e);
      this.emit({ t: 'kill', e });
      this.xp += e.bounty;
      this.kills++;
      this.enemies.splice(i, 1);
    }
  }
  private attack(t: Emplacement, x: number, y: number, target: Marcher) {
    const kind = t.kind, spec = TOWERS[kind], damage = spec.damage * this.towerPower * (1 + 0.55 * (t.level - 1));
    const heavy = t.branch === 0, wide = t.branch === 1;
    const tx = target.x, ty = target.y;
    t.firedAt = this.elapsed;
    t.left = tx < x;
    this.emit({ t: 'fire', slot: this.towers.indexOf(t), kind, tx, ty });
    let endX = tx, endY = ty, radius = 0;
    if (kind === 'arrow') {
      this.strikes.push({ kind, x, y: y - 17, tx, ty, age: 0, life: .14, radius: 0,
        target, impactDamage: damage * (heavy ? 1.5 : 1) * (target.armor ? .6 : 1) });
      return;
    }
    if (kind === 'bolt') {
      const len = distance(x, y, tx, ty) || 1, dx = (tx - x) / len, dy = (ty - y) / len;
      const reach = towerRange(kind, t.branch) + 22;
      endX = x + dx * reach;
      endY = y + dy * reach;
      let jump: Marcher | undefined, nearest = 57;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const ex = e.x - x, ey = e.y - y, along = dx * ex + dy * ey;
        if (along >= 0 && along <= reach && Math.abs(ex * dy - ey * dx) <= (wide ? 12 : 6)) {
          this.hit(e, damage * (heavy ? 1.6 : 1) * (e.armor ? 0.6 : 1));
        } else if (this.formations.has('lightning')) {
          const dist = distance(tx, ty, e.x, e.y);
          if (dist < nearest) { nearest = dist; jump = e; }
        }
      }
      if (jump) {
        this.hit(jump, damage * .65);
        this.strikes.push({ kind: 'arc', x: tx, y: ty, tx: jump.x, ty: jump.y, age: 0, life: .24, radius: 0 });
      }
    }
    if (kind === 'stone' || kind === 'oil') {
      const stone = kind === 'stone';
      radius = stone ? (wide ? 40 : 24) : (wide ? 30 : 21);
      this.strikes.push({
        kind, x, y, tx, ty, age: 0, life: stone ? 0.32 : 0.24, radius,
        impactDamage: damage * (heavy ? (stone ? 1.65 : 1.6) : 1), burnTime: wide ? 3 : 2
      });
      return;
    }
    this.strikes.push({ kind, x, y, tx: endX, ty: endY, age: 0, life: 0.18, radius });
  }
  private fightAlongsideTowers(dt: number) {
    if (!this.enemies.length || (!this.allies.length && !this.tactics.length)) return;
    const line = this.enemies.filter(e => e.hp > 0).sort((a, b) => a.remaining - b.remaining);
    for (const a of this.allies) {
      a.cooldown = Math.max(0, a.cooldown - dt);
      const target = line.find(e => e.hp > 0);
      if (!target) break;
      const spec = ALLY_CARDS[a.id], dx = target.x - a.x, dy = target.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 1) a.left = dx < 0;
      if (dist > spec.range) {
        const step = Math.min(96 * dt, dist - spec.range);
        a.x += dx / dist * step;
        a.y += dy / dist * step;
        continue;
      }
      if (a.cooldown > 0) continue;
      a.cooldown = spec.interval;
      const damage = spec.damage * (1 + (a.level - 1) * 0.65) * (this.allyPower[a.id] ?? 1);
      this.emit({ t: 'ally', id: a.id, x: a.x, y: a.y, tx: target.x, ty: target.y });
      if (a.id === 'huangzhong') {
        this.strikes.push({ kind: 'arrow', x: a.x, y: a.y - 14, tx: target.x, ty: target.y, age: 0, life: .18, radius: 0,
          target, impactDamage: damage * (target.gateDamage > 1 ? 1.8 : 1) });
      } else {
        const roar = a.id === 'zhangfei', radius = roar ? 46 : 33;
        for (const e of line) if (distance(target.x, target.y, e.x, e.y) <= radius) {
          this.hit(e, damage);
          if (roar) e.stun = Math.max(e.stun, e.gateDamage === 5 ? .3 : .85);
        }
        this.strikes.push({ kind: roar ? 'roar' : 'slash', x: a.x, y: a.y, tx: target.x, ty: target.y, age: 0, life: .4, radius });
      }
    }
    for (const t of this.tactics) {
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const living = line.filter(e => e.hp > 0), first = living[0];
      if (!first) break;
      t.cooldown = TACTIC_CARDS[t.id].interval;
      if (t.id !== 'lightning') this.emit({ t: 'tactic', id: t.id, x: first.x, y: first.y });
      const power = 1 + 0.65 * (t.level - 1);
      if (t.id === 'wildfire') {
        this.oil.push({ x: first.x, y: first.y, radius: 33, damage: 13 * power, life: 2.5, maxLife: 2.5, tick: 0 });
      } else if (t.id === 'lightning') {
        for (const e of living.slice(0, 3)) {
          this.emit({ t: 'tactic', id: 'lightning', x: e.x, y: e.y });
          this.hit(e, 46 * power);
          this.strikes.push({ kind: 'lightning', x: e.x - 8, y: e.y - 45, tx: e.x, ty: e.y, age: 0, life: .3, radius: 0 });
        }
      } else {
        const radius = 45;
        for (const e of living) if (distance(e.x, e.y, first.x, first.y) <= radius) {
          this.hit(e, 18 * power);
          const duration = Math.min(3.5, 1.4 + .28 * (t.level - 1));
          const frozen = duration * (e.gateDamage === 5 ? .5 : 1);
          e.stun = Math.max(e.stun, frozen);
          e.frozenUntil = this.elapsed + frozen;
        }
        this.strikes.push({ kind: 'frost', x: first.x, y: first.y, tx: first.x, ty: first.y, age: 0, life: .6, radius });
      }
    }
  }

  private impact(s: Strike) {
    const damage = s.impactDamage!;
    if (s.target) {
      if (this.enemies.includes(s.target)) {
        this.hit(s.target, damage);
        this.emit({ t: 'impact', kind: 'arrow', x: s.target.x, y: s.target.y, r: 0 });
      }
      return;
    }
    if (s.kind === 'oil') {
      if (this.formations.has('wildfire') && this.oil.some(f => distance(s.tx, s.ty, f.x, f.y) <= f.radius)) {
        const radius = s.radius + 13;
        for (const e of this.enemies) if (distance(s.tx, s.ty, e.x, e.y) <= radius) this.hit(e, damage, true);
        this.strikes.push({ ...s, kind: 'blast', age: 0, life: .36, radius, impactDamage: undefined });
        this.emit({ t: 'impact', kind: 'blast', x: s.tx, y: s.ty, r: radius });
      }
      this.oil.push({ x: s.tx, y: s.ty, radius: s.radius, damage, life: s.burnTime!, maxLife: s.burnTime!, tick: 0 });
      this.emit({ t: 'impact', kind: 'oil', x: s.tx, y: s.ty, r: s.radius });
      return;
    }
    let frozen = false;
    for (const e of this.enemies) {
      if (e.hp <= 0 || distance(s.tx, s.ty, e.x, e.y) > s.radius) continue;
      if (e.frozenUntil > this.elapsed) frozen = true;
      this.hit(e, damage * (e.armor ? 1.4 : 1), true);
    }
    this.strikes.push({ ...s, kind: 'dust', age: 0, life: .32, impactDamage: undefined });
    this.emit({ t: 'impact', kind: 'stone', x: s.tx, y: s.ty, r: s.radius });
    if (frozen && this.formations.has('frost')) {
      const outer = this.enemies.filter(e => {
        const dist = distance(s.tx, s.ty, e.x, e.y);
        return e.hp > 0 && dist > s.radius && dist <= s.radius + 38;
      }).sort((a, b) => a.remaining - b.remaining);
      for (const e of outer.slice(0, 2)) {
        this.hit(e, damage * .65);
        this.strikes.push({ kind: 'iceShard', x: s.tx, y: s.ty, tx: e.x, ty: e.y, age: 0, life: .24, radius: 0 });
      }
    }
  }

  update(dt: number) {
    if (this.over || this.offer || dt <= 0) return;
    const before = this.elapsed;
    this.elapsed += dt;
    // 存活经验按整秒结算（出兵结束前），即使暂时没能击杀，也能逐渐补强。
    if (!this.allSpawned) this.xp += Math.floor(this.elapsed) - Math.floor(before);
    for (const e of this.enemies) e.flash = Math.max(0, e.flash - dt);
    for (let i = this.fallen.length - 1; i >= 0; i--) {
      if ((this.fallen[i].flash -= dt) <= 0) this.fallen.splice(i, 1);
    }
    this.commandCd = Math.max(0, this.commandCd - dt);
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      if (s.target) { s.tx = s.target.x; s.ty = s.target.y; }
      s.age += dt;
      if (s.age < s.life) continue;
      if (s.impactDamage) this.impact(s);
      this.strikes.splice(i, 1);
    }
    if (!this.allSpawned) {
      if (this.queue.length) {
        this.queueT -= dt;
        const w = this.plan[this.waveIdx];
        while (this.queue.length && this.queueT <= 0) {
          this.spawn(this.queue.shift()!);
          this.waveCount++;
          this.queueT += w.gap * (.92 + .16 * this.random());
        }
        if (!this.queue.length) {
          if (this.waveIdx >= this.waveTotal - 1) this.allSpawned = true;
          else this.restT = WAVE_REST;
        }
      } else {
        this.restT -= dt;
        if (this.restT <= 0) { this.restT = 0; this.startWave(); }
      }
    }
    // 同种鼓效果取最高，攻击塔可以利用布在拐角处的同一座战鼓。
    const drums: { p: Point; range: number; haste: number; slow: number }[] = [];
    this.towers.forEach((t, i) => {
      if (t?.kind === 'drum') drums.push({
        p: this.map.sites[i], range: towerRange('drum', t.branch),
        haste: (t.branch === 0 ? 0.55 : 0.15 + 0.06 * t.level) * (1 + this.bonus),
        slow: t.branch === 1 ? 0.32 : 0.08 + 0.025 * t.level
      });
    });
    this.towers.forEach((t, i) => {
      if (!t || t.kind === 'drum') return;
      const [x, y] = this.map.sites[i], r = towerRange(t.kind, t.branch);
      let haste = 0;
      for (const d of drums) if (distance(x, y, ...d.p) <= d.range) haste = Math.max(haste, d.haste);
      t.cooldown -= dt * (1 + haste);
      if (t.cooldown > 0) return;
      let target: Marcher | undefined;
      for (const e of this.enemies) if (e.hp > 0 && distance(x, y, e.x, e.y) <= r && (!target || e.remaining < target.remaining)) target = e;
      if (!target) {
        t.cooldown = 0;
        return;
      }
      this.attack(t, x, y, target);
      t.cooldown = TOWERS[t.kind].interval * (t.branch === 1 && t.kind === 'arrow' ? 0.58 : t.branch === 1 && t.kind === 'bolt' ? 0.7 : 1);
    });
    for (let i = this.oil.length - 1; i >= 0; i--) {
      const f = this.oil[i];
      f.tick -= dt;
      f.life -= dt;
      if (f.tick <= 0) {
        f.tick += 0.5;
        for (const e of this.enemies) if (distance(f.x, f.y, e.x, e.y) <= f.radius) this.hit(e, f.damage, true);
      }
      if (f.life <= 0) this.oil.splice(i, 1);
    }
    this.fightAlongsideTowers(dt);
    this.collectKills();
    const banners = this.map.id === 2 ? this.enemies.filter(e => e.banner && e.stun <= 0) : [];
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i], path = this.map.routes[e.route];
      if (e.stun > 0) {
        e.stun -= dt;
        continue;
      }
      let slow = 0;
      for (const d of drums) if (distance(e.x, e.y, ...d.p) <= d.range) slow = Math.max(slow, d.slow);
      const urged = e.gateDamage === 1 && banners.some(flag => distance(e.x, e.y, flag.x, flag.y) <= 43);
      let step = e.speed * dt * (1 - slow) * (urged ? 1.12 : 1);
      while (step > 0 && e.next < path.length) {
        const [tx, ty] = path[e.next], dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.01) e.left = dx < 0;
        if (step < len) {
          e.x += dx * step / len;
          e.y += dy * step / len;
          e.remaining -= step;
          break;
        }
        step -= len;
        e.remaining -= len;
        e.x = tx;
        e.y = ty;
        e.next++;
      }
      if (e.next === path.length) {
        this.emit({ t: 'leak', e });
        this.leaks++;
        this.hp = Math.max(0, this.hp - e.gateDamage);
        this.enemies.splice(i, 1);
        if (!this.hp) {
          this.phase = 'loss';
          return;
        }
      }
    }
    this.finishStep();
  }

  private finishStep() {
    if (this.allSpawned && !this.enemies.length) this.phase = 'win';
    this.checkLevel();
  }
}
