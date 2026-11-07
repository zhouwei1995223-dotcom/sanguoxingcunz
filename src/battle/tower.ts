import { BOSSES, ENEMIES } from '../data/enemies';
import { AID_LIMIT, ALLY_CARDS, ALLY_IDS, AllyId, Branch, GATE_HP, Point, TACTIC_CARDS, TACTIC_IDS, TacticId, TowerCard, TowerKind, TowerMap, TOWERS, TOWER_KINDS, WAVES, towerRange } from '../data/tower';

export interface Emplacement { kind: TowerKind; level: number; cooldown: number; branch?: Branch }
export interface TowerAlly { id: AllyId; level: number; x: number; y: number; left: boolean; cooldown: number }
export interface Marcher {
  x: number; y: number; route: number; next: number; remaining: number; hp: number; maxHp: number;
  speed: number; armor: boolean; gateDamage: number; bounty: number; sprite: string; left: boolean; stun: number;
}
export interface Strike {
  kind: TowerKind | 'command' | 'slash' | 'roar' | 'frost' | 'lightning' | 'deploy'; x: number; y: number; tx: number; ty: number;
  age: number; life: number; radius: number; impactDamage?: number; burnTime?: number;
}
interface OilPatch { x: number; y: number; radius: number; damage: number; life: number; tick: number }

const distance = (x: number, y: number, a: number, b: number) => Math.hypot(x - a, y - b);
const routeLength = (path: Point[]) => path.slice(1).reduce((s, p, i) => s + distance(...p, ...path[i]), 0);

export class TowerBattle {
  readonly towers: (Emplacement | null)[];
  readonly enemies: Marcher[] = [];
  readonly strikes: Strike[] = [];
  readonly oil: OilPatch[] = [];
  private readonly lengths: number[];
  level = 1;
  xp = 0;
  aidUsed = 0;
  offer: { cards: TowerCard[]; aid: boolean } | null = null;
  readonly allies: TowerAlly[] = [];
  readonly tactics: { id: TacticId; level: number; cooldown: number }[] = [];
  hp = GATE_HP;
  wave = 0;
  cleared = 0;
  leaks = 0;
  kills = 0;
  elapsed = 0;
  phase: 'ready' | 'wave' | 'win' | 'loss' = 'ready';
  countdown = 6;
  commandCd = 0;
  repaired = false;
  private remainingSpawns = 0;
  private spawnTimer = 0;
  private waveScale = 1;
  constructor(readonly map: TowerMap, readonly hero: string, readonly bonus: number, private random = Math.random) {
    this.towers = map.sites.map(() => null);
    this.towers[map.starter] = { kind: 'arrow', level: 1, cooldown: 0 };
    this.lengths = map.routes.map(routeLength);
  }
  get over() { return this.phase === 'win' || this.phase === 'loss'; }
  get stars() { return this.phase !== 'win' ? 0 : this.leaks === 0 ? 3 : this.leaks <= 5 ? 2 : 1; }
  get earlyXP() { return Math.ceil(Math.max(0, this.countdown) / 2); }
  get xpNeeded() { return this.level === 1 ? 8 : 14 + this.level * 4; }
  get canReinforce() { return !this.over && !this.offer && this.aidUsed < AID_LIMIT; }


  /** 优先覆盖更多道路；战鼓额外考虑周围已有的攻击塔。 */
  private siteScore(slot: number, kind: TowerKind) {
    const [x, y] = this.map.sites[slot], range = TOWERS[kind].range;
    let score = 0;
    for (const road of this.map.routes) {
      for (let i = 1; i < road.length; i++) {
        const [ax, ay] = road[i - 1], [bx, by] = road[i];
        const length = distance(ax, ay, bx, by), steps = Math.ceil(length / 12);
        for (let j = 0; j < steps; j++) {
          const f = (j + 0.5) / steps;
          if (distance(x, y, ax + (bx - ax) * f, ay + (by - ay) * f) < range) score += length / steps;
        }
      }
    }
    if (kind === 'drum') this.towers.forEach((t, i) => {
      if (t && t.kind !== 'drum' && distance(x, y, ...this.map.sites[i]) <= range) score += 120;
    });
    return score;
  }

  /** 新建、已有塔的有效升级/分支、援将及阵法共同参与抽取。 */
  private rewardPool(): TowerCard[] {
    const pool: TowerCard[] = [], free: number[] = [];
    this.towers.forEach((t, slot) => {
      if (!t) {
        if (!this.map.aidSites.includes(slot)) free.push(slot);
      } else if (t.level === 1) {
        pool.push({ type: 'tower', kind: t.kind, slot, level: 2 });
      } else if (t.level === 2) {
        for (const branch of [0, 1] as const) pool.push({ type: 'tower', kind: t.kind, slot, level: 3, branch });
      }
    });
    if (free.length) {
      for (const kind of TOWER_KINDS) {
        let slot = free[0], best = -1;
        for (const i of free) {
          const score = this.siteScore(i, kind);
          if (score > best) { best = score; slot = i; }
        }
        pool.push({ type: 'tower', kind, slot, level: 1 });
      }
    }
    for (const id of ALLY_IDS) pool.push({ type: 'ally', id });
    for (const id of TACTIC_IDS) pool.push({ type: 'tactic', id });
    return pool;
  }

  /** 从候选奖励中等概率、不放回抽取三项。 */
  private drawThree(pool: TowerCard[]) {
    const cards: TowerCard[] = [];
    while (cards.length < 3) {
      const [card] = pool.splice(Math.floor(this.random() * pool.length), 1);
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
    const slot = this.map.aidSites[this.aidUsed];
    const pool: TowerCard[] = TOWER_KINDS.map(kind => ({ type: 'tower', kind, slot, level: 1 }));
    this.offer = { aid: true, cards: this.drawThree(pool) };
    return true;
  }

  choose(card: TowerCard) {
    if (this.over || !this.offer?.cards.includes(card)) return false;
    if (card.type === 'tower') {
      const current = this.towers[card.slot];
      if (card.level !== (current?.level ?? 0) + 1) return false;
      this.towers[card.slot] = { kind: card.kind, level: card.level, branch: card.branch, cooldown: current?.cooldown ?? 0 };
      const [x, y] = this.map.sites[card.slot];
      this.strikes.push({ kind: 'deploy', x, y, tx: x, ty: y - 7, age: 0, life: 1, radius: 27 });
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
    if (this.offer.aid) this.aidUsed++;
    this.offer = null;
    this.checkLevel();
    return true;
  }
  startWave(early = true) {
    if (this.phase !== 'ready' || this.offer) return false;
    if (early) this.xp += this.earlyXP;
    this.phase = 'wave';
    this.wave++;
    this.countdown = 0;
    this.remainingSpawns = 5 + this.wave;
    this.spawnTimer = 0;
    this.waveScale = 0.86 + 0.28 * this.random();
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
    if (this.offer || this.phase !== 'wave' || this.commandCd > 0) return false;
    const dragon = this.hero === 'zhaoyun', radius = dragon ? 69 : 80;
    this.strikes.push({ kind: 'command', x, y, tx: x, ty: y, age: 0, life: 0.8, radius });
    for (const e of this.enemies) if (distance(x, y, e.x, e.y) <= radius) {
      e.hp -= (dragon ? 90 : 62) + this.wave * (dragon ? 6 : 4);
      e.stun = dragon ? 0.9 : 2;
    }
    this.commandCd = dragon ? 28 : 24;
    this.collectKills();
    this.finishStep();
    return true;
  }
  private spawn() {
    const w = this.wave, boss = this.remainingSpawns === 1 && (w === 8 || w === WAVES);
    const elite = !boss && w >= 3 && this.remainingSpawns === 2;
    const mix = this.random();
    const armored = !boss && w >= 2 && mix < 0.23, mounted = !boss && w >= 3 && mix > 0.67;
    const armorId = w >= 6 && mix < 0.08 ? 'wei_heavy' : this.map.shield;
    const id = boss ? this.map.bosses[w === 8 ? 0 : 1] : armored ? armorId : mounted ? this.map.cavalry : this.map.troop;
    const route = Math.floor(this.random() * this.map.routes.length);
    const [x, y] = this.map.routes[route][0];
    const pressure = 1 + (this.map.latePressure - 1) * (w - 1) / (WAVES - 1);
    const hp = Math.round((20 + w * 8 + w * w * 0.8) * pressure * this.map.strength * this.waveScale * (0.9 + 0.2 * this.random())
      * (boss ? (w === 8 ? 8 : 13) : elite ? 3 : armored ? 1.32 : mounted ? 0.84 : 1));
    this.enemies.push({
      x, y, route, next: 1, remaining: this.lengths[route], hp, maxHp: hp,
      speed: (boss ? 17 : mounted ? 43 : armored ? 21 : 26) * (0.9 + this.random() * 0.2),
      armor: armored, gateDamage: boss ? 5 : elite ? 2 : 1, bounty: boss ? 34 : elite ? 12 : 4,
      sprite: (boss ? BOSSES[id] : ENEMIES[id]).sprite, left: false, stun: 0
    });
    this.remainingSpawns--;
  }
  private collectKills() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp > 0) continue;
      this.xp += e.bounty;
      this.kills++;
      this.enemies.splice(i, 1);
    }
  }
  private attack(t: Emplacement, x: number, y: number, target: Marcher) {
    const kind = t.kind, spec = TOWERS[kind], damage = spec.damage * (1 + this.bonus) * (1 + 0.55 * (t.level - 1));
    const heavy = t.branch === 0, wide = t.branch === 1;
    const tx = target.x, ty = target.y;
    let endX = tx, endY = ty, radius = 0;
    if (kind === 'arrow') target.hp -= damage * (heavy ? 1.5 : 1) * (target.armor ? 0.6 : 1);
    if (kind === 'bolt') {
      const len = distance(x, y, tx, ty) || 1, dx = (tx - x) / len, dy = (ty - y) / len;
      const reach = towerRange(kind, t.branch) + 22;
      endX = x + dx * reach;
      endY = y + dy * reach;
      for (const e of this.enemies) {
        const ex = e.x - x, ey = e.y - y, along = dx * ex + dy * ey;
        if (along >= 0 && along <= reach && Math.abs(ex * dy - ey * dx) <= (wide ? 12 : 6))
          e.hp -= damage * (heavy ? 1.6 : 1) * (e.armor ? 0.6 : 1);
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
      const damage = spec.damage * (1 + (a.level - 1) * 0.65);
      if (a.id === 'huangzhong') {
        target.hp -= damage * (target.gateDamage > 1 ? 1.8 : 1);
        this.strikes.push({ kind: 'arrow', x: a.x, y: a.y, tx: target.x, ty: target.y, age: 0, life: .22, radius: 0 });
      } else {
        const roar = a.id === 'zhangfei', radius = roar ? 46 : 33;
        for (const e of line) if (distance(target.x, target.y, e.x, e.y) <= radius) {
          e.hp -= damage;
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
      const power = 1 + 0.65 * (t.level - 1);
      if (t.id === 'wildfire') {
        this.oil.push({ x: first.x, y: first.y, radius: 33, damage: 13 * power, life: 2.5, tick: 0 });
      } else if (t.id === 'lightning') {
        for (const e of living.slice(0, 3)) {
          e.hp -= 46 * power;
          this.strikes.push({ kind: 'lightning', x: e.x - 8, y: e.y - 45, tx: e.x, ty: e.y, age: 0, life: .3, radius: 0 });
        }
      } else {
        const radius = 45;
        for (const e of living) if (distance(e.x, e.y, first.x, first.y) <= radius) {
          e.hp -= 18 * power;
          const duration = Math.min(3.5, 1.4 + .28 * (t.level - 1));
          e.stun = Math.max(e.stun, duration * (e.gateDamage === 5 ? .5 : 1));
        }
        this.strikes.push({ kind: 'frost', x: first.x, y: first.y, tx: first.x, ty: first.y, age: 0, life: .6, radius });
      }
    }
  }

  update(dt: number) {
    if (this.over || this.offer || dt <= 0) return;
    this.elapsed += dt;
    this.commandCd = Math.max(0, this.commandCd - dt);
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.age += dt;
      if (s.age < s.life) continue;
      if (s.kind === 'oil' && s.impactDamage) {
        this.oil.push({ x: s.tx, y: s.ty, radius: s.radius, damage: s.impactDamage, life: s.burnTime!, tick: 0 });
      } else if (s.kind === 'stone' && s.impactDamage) {
        for (const e of this.enemies) if (distance(s.tx, s.ty, e.x, e.y) <= s.radius) e.hp -= s.impactDamage * (e.armor ? 1.4 : 1);
      }
      this.strikes.splice(i, 1);
    }
    if (this.phase === 'ready') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.startWave(false);
      return;
    }
    this.spawnTimer -= dt;
    while (this.spawnTimer <= 0 && this.remainingSpawns > 0) {
      this.spawn();
      this.spawnTimer += 0.52 + this.random() * 0.45;
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
        for (const e of this.enemies) if (distance(f.x, f.y, e.x, e.y) <= f.radius) e.hp -= f.damage;
      }
      if (f.life <= 0) this.oil.splice(i, 1);
    }
    this.fightAlongsideTowers(dt);
    this.collectKills();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i], path = this.map.routes[e.route];
      if (e.stun > 0) {
        e.stun -= dt;
        continue;
      }
      let slow = 0;
      for (const d of drums) if (distance(e.x, e.y, ...d.p) <= d.range) slow = Math.max(slow, d.slow);
      let step = e.speed * dt * (1 - slow);
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
    if (this.phase === 'wave' && !this.remainingSpawns && !this.enemies.length) {
      this.cleared = this.wave;
      this.xp += 12 + this.wave;
      this.oil.length = 0;
      for (const strike of this.strikes) strike.impactDamage = undefined;
      this.phase = this.wave === WAVES ? 'win' : 'ready';
      this.countdown = 6;
    }
    this.checkLevel();
  }
}
