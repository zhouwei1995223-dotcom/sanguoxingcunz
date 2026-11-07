import { BOSSES, ENEMIES } from '../data/enemies';
import { AID_LIMIT, ALLY_WEIGHT, ALLY_CARDS, ALLY_IDS, AllyId, Branch, GATE_HP, Point, TACTIC_CARDS, TACTIC_IDS, TacticId, TowerCard, TowerKind, TowerMap, TOWERS, TOWER_KINDS, MARCH_SECONDS, towerRange } from '../data/tower';

export interface Emplacement { kind: TowerKind; level: number; cooldown: number; branch?: Branch }
export interface TowerAlly { id: AllyId; level: number; x: number; y: number; left: boolean; cooldown: number }
export interface Marcher {
  x: number; y: number; route: number; next: number; remaining: number; hp: number; maxHp: number;
  speed: number; armor: boolean; gateDamage: number; bounty: number; sprite: string; left: boolean; stun: number; flash: number;
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
  readonly fallen: Marcher[] = [];
  private readonly lengths: number[];
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
  private nextSpawn = 0;
  private nextElite = 36;
  generalsSent = 0;
  constructor(readonly map: TowerMap, readonly hero: string, readonly bonus: number, private random = Math.random) {
    this.towers = map.sites.map(() => null);
    this.towers[0] = { kind: 'arrow', level: 1, cooldown: 0 };
    this.lengths = map.routes.map(routeLength);
  }
  get over() { return this.phase === 'win' || this.phase === 'loss'; }
  get stars() { return this.phase !== 'win' ? 0 : this.leaks === 0 ? 3 : this.leaks <= 5 ? 2 : 1; }
  get progress() { return Math.min(1, this.elapsed / MARCH_SECONDS); }
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
    for (const e of this.enemies) if (distance(x, y, e.x, e.y) <= radius) {
      this.hit(e, (dragon ? 90 : 62) + (1 + 14 * this.progress) * (dragon ? 6 : 4));
      e.stun = dragon ? 0.9 : 2;
    }
    this.commandCd = dragon ? 28 : 24;
    this.collectKills();
    this.finishStep();
    return true;
  }
  private spawn(rank: 'troop' | 'elite' | 'mid' | 'final') {
    const p = this.progress, boss = rank === 'mid' || rank === 'final', elite = rank === 'elite';
    const mix = this.random(), armorShare = .25 * Math.min(1, this.elapsed / 75);
    const cavalryShare = .30 * Math.min(1, Math.max(0, this.elapsed - 15) / 105);
    const armored = !boss && mix < armorShare, mounted = !boss && mix > 1 - cavalryShare;
    const armorId = mix < armorShare * p / 3 ? 'wei_heavy' : this.map.shield;
    const id = boss ? this.map.bosses[rank === 'mid' ? 0 : 1] : armored ? armorId : mounted ? this.map.cavalry : this.map.troop;
    // 双路关卡先从首塔一侧进入，另一入口在头半分钟逐渐加入。
    const rightShare = this.map.routes.length > 1 ? .5 * Math.min(1, this.elapsed / 30) : 0;
    const route = this.random() < rightShare ? 1 : 0;
    const [x, y] = this.map.routes[route][0];
    const pressure = 1 + (this.map.latePressure - 1) * p * (2 - p);
    const hp = Math.round((27 + 138 * p) * this.map.strength * pressure * (.96 + .08 * this.random())
      * (rank === 'final' ? 12 : rank === 'mid' ? 7 : elite ? 2.5 : armored ? 1.32 : mounted ? .84 : 1));
    this.enemies.push({
      x, y, route, next: 1, remaining: this.lengths[route], hp, maxHp: hp,
      speed: (boss ? 17 : mounted ? 36 : armored ? 21 : 26) * (1 + .08 * p) * (.96 + .08 * this.random()),
      armor: armored, gateDamage: boss ? 5 : elite ? 2 : 1, bounty: boss ? 34 : elite ? 12 : 4,
      sprite: (boss ? BOSSES[id] : ENEMIES[id]).sprite, left: false, stun: 0, flash: 0
    });
  }
  private hit(e: Marcher, damage: number) {
    if (e.hp <= 0) return;
    e.hp -= damage;
    e.flash = .08;
  }

  private collectKills() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp > 0) continue;
      this.fallen.push(e);
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
    if (kind === 'arrow') this.hit(target, damage * (heavy ? 1.5 : 1) * (target.armor ? 0.6 : 1));
    if (kind === 'bolt') {
      const len = distance(x, y, tx, ty) || 1, dx = (tx - x) / len, dy = (ty - y) / len;
      const reach = towerRange(kind, t.branch) + 22;
      endX = x + dx * reach;
      endY = y + dy * reach;
      for (const e of this.enemies) {
        const ex = e.x - x, ey = e.y - y, along = dx * ex + dy * ey;
        if (along >= 0 && along <= reach && Math.abs(ex * dy - ey * dx) <= (wide ? 12 : 6))
          this.hit(e, damage * (heavy ? 1.6 : 1) * (e.armor ? 0.6 : 1));
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
        this.hit(target, damage * (target.gateDamage > 1 ? 1.8 : 1));
        this.strikes.push({ kind: 'arrow', x: a.x, y: a.y, tx: target.x, ty: target.y, age: 0, life: .22, radius: 0 });
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
      const power = 1 + 0.65 * (t.level - 1);
      if (t.id === 'wildfire') {
        this.oil.push({ x: first.x, y: first.y, radius: 33, damage: 13 * power, life: 2.5, tick: 0 });
      } else if (t.id === 'lightning') {
        for (const e of living.slice(0, 3)) {
          this.hit(e, 46 * power);
          this.strikes.push({ kind: 'lightning', x: e.x - 8, y: e.y - 45, tx: e.x, ty: e.y, age: 0, life: .3, radius: 0 });
        }
      } else {
        const radius = 45;
        for (const e of living) if (distance(e.x, e.y, first.x, first.y) <= radius) {
          this.hit(e, 18 * power);
          const duration = Math.min(3.5, 1.4 + .28 * (t.level - 1));
          e.stun = Math.max(e.stun, duration * (e.gateDamage === 5 ? .5 : 1));
        }
        this.strikes.push({ kind: 'frost', x: first.x, y: first.y, tx: first.x, ty: first.y, age: 0, life: .6, radius });
      }
    }
  }

  update(dt: number) {
    if (this.over || this.offer || dt <= 0) return;
    const before = this.elapsed;
    this.elapsed += dt;
    // 存活经验按整秒结算，即使暂时没能击杀，也能逐渐补强。
    this.xp += Math.floor(Math.min(this.elapsed, MARCH_SECONDS)) - Math.floor(Math.min(before, MARCH_SECONDS));
    for (const e of this.enemies) e.flash = Math.max(0, e.flash - dt);
    for (let i = this.fallen.length - 1; i >= 0; i--) {
      if ((this.fallen[i].flash -= dt) <= 0) this.fallen.splice(i, 1);
    }
    this.commandCd = Math.max(0, this.commandCd - dt);
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.age += dt;
      if (s.age < s.life) continue;
      if (s.kind === 'oil' && s.impactDamage) {
        this.oil.push({ x: s.tx, y: s.ty, radius: s.radius, damage: s.impactDamage, life: s.burnTime!, tick: 0 });
      } else if (s.kind === 'stone' && s.impactDamage) {
        for (const e of this.enemies) if (distance(s.tx, s.ty, e.x, e.y) <= s.radius) this.hit(e, s.impactDamage * (e.armor ? 1.4 : 1));
      }
      this.strikes.splice(i, 1);
    }
    while (this.nextSpawn <= this.elapsed && this.nextSpawn < MARCH_SECONDS) {
      const elite = this.nextSpawn >= this.nextElite;
      this.spawn(elite ? 'elite' : 'troop');
      if (elite) this.nextElite += 20;
      this.nextSpawn += (1.55 - .55 * this.progress) * (.92 + .16 * this.random());
    }
    if (this.generalsSent === 0 && this.elapsed >= MARCH_SECONDS / 2) {
      this.spawn('mid');
      this.generalsSent++;
    }
    if (this.generalsSent === 1 && this.elapsed >= MARCH_SECONDS) {
      this.spawn('final');
      this.generalsSent++;
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
        for (const e of this.enemies) if (distance(f.x, f.y, e.x, e.y) <= f.radius) this.hit(e, f.damage);
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
    if (this.generalsSent === 2 && !this.enemies.length) this.phase = 'win';
    this.checkLevel();
  }
}
