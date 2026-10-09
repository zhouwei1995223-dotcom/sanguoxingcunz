import { SpatialGrid } from '../core/grid';
import { clamp, rand, pick, shuffle, weighted, TAU } from '../core/math';
import { ChapterDef } from '../data/chapters';
import { ENEMIES, BOSSES, BossDef } from '../data/enemies';
import { HERO } from '../data/meta';
import {
  WEAPONS, PASSIVES, WeaponId, PassiveId, MAX_WEAPON_LV, MAX_PASSIVE_LV, WEAPON_SLOTS, PASSIVE_SLOTS, expToNext,
} from '../data/skills';
import type { HeroStats } from '../meta/ops';
import {
  Enemy, Player, WeaponState, PassiveState, Projectile, FirePool, EnemyShot, Pickup, Breakable, Fx, Warning, newEnemy,
} from './entities';
import { updateWeapons } from './weapons';
import { updateSpawner } from './spawner';
import { updateBoss } from './boss';

export type Choice =
  | { kind: 'weapon'; id: WeaponId; lv: number; isNew: boolean }
  | { kind: 'passive'; id: PassiveId; lv: number; isNew: boolean }
  | { kind: 'evo'; id: WeaponId }
  | { kind: 'heal' }
  | { kind: 'gold' };

export interface UltState {
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
  speed = HERO.moveSpeed;
  dmgTakenMul = 1;
  regen = 0;
  pickupR = HERO.pickup;
  expMul = 1;
  goldMul = 1;
  crit = 0.05;
  critDmg = 1.5;

  constructor(chapter: ChapterDef, base: HeroStats, viewW: number, viewH: number) {
    this.chapter = chapter;
    this.base = base;
    this.viewW = viewW;
    this.viewH = viewH;
    this.player = { x: 0, y: 0, r: 8, hp: base.hp, maxHp: base.hp, dirX: 1, dirY: 0, left: false, moving: false, anim: 0, iframe: 0, hurtFlash: 0 };
    this.rerolls = base.reroll;
    this.revives = base.revive;
    this.addWeapon(HERO.startWeapon);
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
    this.speed = HERO.moveSpeed * (1 + b.speed / 100 + 0.08 * P('horseshoe'));
    this.dmgTakenMul = (1 - Math.min(0.6, b.def / 100)) * (1 - 0.06 * P('armor')) * (auraEvo ? 0.8 : 1);
    const newMax = Math.round(b.hp * (1 + 0.1 * P('lingzhi')));
    if (newMax > this.player.maxHp) this.player.hp += newMax - this.player.maxHp;
    this.player.maxHp = newMax;
    this.player.hp = Math.min(this.player.hp, newMax);
    this.regen = b.regen + 0.3 * P('lingzhi') + (auraEvo ? newMax * 0.01 : 0);
    this.pickupR = HERO.pickup * (1 + b.pickup / 100 + 0.35 * P('bowl'));
    this.expMul = 1 + b.exp / 100 + 0.08 * P('seal');
    this.goldMul = 1 + b.gold / 100 + 0.1 * P('bowl');
    this.crit = b.crit / 100;
    this.critDmg = 1 + b.critDmg / 100;
  }

  addWeapon(id: WeaponId) {
    this.weapons.push({ id, lv: 1, evo: false, t: 0.3, active: 0, angle: 0, burst: 0, hits: new Map() });
  }

  // —— 主循环 ——
  update(rawDt: number) {
    if (this.dead || this.won) return;
    const p = this.player;
    let dt = rawDt;
    // 大招期间：赵云正常速度冲杀，其余一切慢动作
    if (this.ult) {
      this.updateUlt(rawDt);
      dt = rawDt * 0.12;
    }
    this.t += dt;
    this.hitStopCd = Math.max(0, this.hitStopCd - rawDt);
    this.updateRage(dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // 移动
    let mx = this.ult ? 0 : this.moveX, my = this.ult ? 0 : this.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > 0.05 || !!this.ult;
    if (this.ult) p.anim += rawDt * 16;
    else if (p.moving) {
      p.x += mx * this.speed * dt;
      p.y += my * this.speed * dt;
      const l = Math.hypot(mx, my);
      p.dirX = mx / l;
      p.dirY = my / l;
      if (Math.abs(mx) > 0.1) p.left = mx < 0;
      p.anim += dt * 10;
    } else p.anim = 0;
    p.iframe = Math.max(0, p.iframe - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    if (this.regen > 0) p.hp = Math.min(p.maxHp, p.hp + this.regen * dt);

    // 网格
    this.grid.clear();
    for (const e of this.enemies) if (!e.dead) this.grid.insert(e);

    updateSpawner(this, dt);
    this.updateEnemies(dt);
    updateWeapons(this, dt);
    this.updateProjectiles(dt);
    this.updatePools(dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.updateBreakables(dt);
    this.updateFx(dt);

    // 清理
    if (this.enemies.length > 0 && this.t % 1 < dt) this.enemies = this.enemies.filter((e) => !e.dead);

    if (p.hp <= 0 && !this.dead) {
      this.dead = true;
      this.hooks.vibrate(true);
    }
  }

  // —— 敌人 ——
  spawnEnemy(id: string, x: number, y: number, opts: { elite?: boolean } = {}): Enemy {
    const d = ENEMIES[id];
    const e = newEnemy();
    const ch = this.chapter;
    const minute = this.t / 60;
    const hpScale = ch.hpMul * (1 + ch.growth * minute) * this.enemyHpMul;
    e.uid = this.uidSeq++;
    e.def = d;
    e.x = x;
    e.y = y;
    e.r = d.radius;
    e.maxHp = e.hp = Math.round(d.hp * hpScale * (opts.elite ? 14 : 1));
    e.speed = d.speed * rand(0.92, 1.08) * (opts.elite ? 0.9 : 1);
    e.dmg = d.dmg * ch.dmgMul * (1 + 0.04 * minute) * (opts.elite ? 1.5 : 1) * this.enemyDmgMul;
    e.mass = (d.mass || 1) * (opts.elite ? 8 : 1);
    e.exp = d.exp * (opts.elite ? 20 : 1);
    e.sprite = 'u_' + d.sprite;
    e.elite = !!opts.elite;
    e.scale = opts.elite ? 2 : 1;
    if (opts.elite) e.r = d.radius * 1.8;
    this.enemies.push(e);
    return e;
  }

  spawnBoss(id: string, x: number, y: number, isFinal: boolean): Enemy {
    const d = BOSSES[id];
    const e = newEnemy();
    e.uid = this.uidSeq++;
    e.boss = d;
    e.isMidBoss = !isFinal;
    e.x = x;
    e.y = y;
    e.r = d.radius;
    e.maxHp = e.hp = Math.round(d.hp * this.enemyHpMul);
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
        if (e.shootT <= 0 && d < range + 40) {
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
      if (d < cr && e.atkCd <= 0) {
        e.atkCd = 1;
        this.hurtPlayer(e.dmg);
      }

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

  hurtPlayer(dmg: number) {
    const p = this.player;
    if (p.iframe > 0 || this.dead || this.ult) return;
    const v = Math.max(1, dmg * this.dmgTakenMul);
    p.hp -= v;
    p.iframe = 0.12;
    p.hurtFlash = 0.2;
    this.hooks.sfx('hurt');
    this.hooks.vibrate();
    if (this.showDamage) this.addNum(p.x, p.y - 22, Math.round(v), 'r');
  }

  /** 对敌人造成伤害，返回是否击杀 */
  damage(e: Enemy, base: number, kx = 0, ky = 0, knock = 0, opts: { noCrit?: boolean } = {}): boolean {
    if (e.dead) return false;
    let dmg = base * this.dmgMul;
    if (this.player.hp < this.player.maxHp * 0.3) dmg *= 1.3; // 一身是胆
    if (e.boss) dmg *= 1 + this.base.bossDmg / 100;
    let crit = false;
    if (!opts.noCrit && Math.random() < this.crit) { dmg *= this.critDmg; crit = true; }
    dmg = Math.max(1, Math.round(dmg * rand(0.92, 1.08)));
    e.hp -= dmg;
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
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if (this.combo === 100 || this.combo === 300 || this.combo === 500 || this.combo % 1000 === 0) {
      this.hooks.banner(this.combo >= 1000 ? `${this.combo / 1000}千人斩！` : this.combo === 100 ? '百人斩！' : `${this.combo}连斩！`, '#fee761');
      this.hooks.sfx('levelup');
    }
    if (!this.ult && this.rageLock <= 0) this.rage = Math.min(RAGE_MAX, this.rage + (e.boss ? 30 : e.elite ? 12 : 0.45));
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
      this.fx.push({ kind: 'text', x: e.x, y: e.y - 50, t: 0, dur: 2.2, text: e.boss.quote, color: '#fee761' });
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
      for (let i = 0; i < 3; i++) this.dropPickup('coin', e.x + rand(-10, 10), e.y + rand(-10, 10), 2);
      return;
    }
    if (Math.random() < 0.035) this.dropPickup('coin', e.x, e.y, 1);
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
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.life <= 0) { this.projs.splice(i, 1); continue; }
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
      }
    }
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
    this.hooks.banner('龙胆 · 七进七出', '#fee761');
    this.hooks.sfx('evolve');
    this.hooks.vibrate(true);
    this.ult = { idx: -1, t: 0, dur: 0, x0: 0, y0: 0, x1: 0, y1: 0, finale: 0 };
    this.nextDash();
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
      this.damage(e, dmg, dx * 0.6 - dy * side * 0.8, dy * 0.6 + dx * side * 0.8, 120);
    }
    this.fx.push({ kind: 'beam', x: u.x0, y: u.y0 - 8, t: 0, dur: 0.45, a: Math.atan2(dy, dx), len, w: width });
    this.hooks.shake(3);
    this.hooks.sfx('thrust');
    this.hooks.sfx('horse');
  }

  private updateUlt(dt: number) {
    const u = this.ult!;
    const p = this.player;
    p.iframe = Math.max(p.iframe, 0.6);
    if (u.finale > 0) {
      u.finale -= dt;
      if (u.finale <= 0) {
        // 收尾：全屏冲击波
        const R = Math.max(this.viewW, this.viewH) * 0.6;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < R) this.damage(e, this.base.atk * 10, dx / d, dy / d, 150);
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
      return;
    }
    u.t += dt;
    const k = Math.min(1, u.t / u.dur);
    p.x = u.x0 + (u.x1 - u.x0) * k;
    p.y = u.y0 + (u.y1 - u.y0) * k;
    this.fx.push({ kind: 'ghost', x: p.x, y: p.y, t: 0, dur: 0.3, sprite: `hero_${Math.floor(p.anim) % 4}${p.left ? '_L' : ''}` });
    if (k >= 1) this.nextDash();
  }

  /** 看视频直接充满怒气 */
  fillRage() {
    this.rage = RAGE_MAX;
    this.rageLock = 0;
    this.adRageUsed++;
  }

  // —— 特效 ——
  addNum(x: number, y: number, v: number, color: 'w' | 'y' | 'r' | 'g', big = false) {
    if (this.fx.length > 400) return;
    this.fx.push({ kind: 'num', x, y, t: 0, dur: 0.6, text: String(v), color, big });
  }

  private updateFx(dt: number) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.dur) this.fx.splice(i, 1);
    }
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.t += dt;
      if (w.t >= w.dur) this.warnings.splice(i, 1);
    }
  }

  // —— 升级选项 ——
  rollChoices(n = 3): Choice[] {
    const pool: { c: Choice; w: number }[] = [];
    for (const w of this.weapons) if (!w.evo && w.lv < MAX_WEAPON_LV) pool.push({ c: { kind: 'weapon', id: w.id, lv: w.lv + 1, isNew: false }, w: 3 });
    for (const p of this.passives) if (p.lv < MAX_PASSIVE_LV) pool.push({ c: { kind: 'passive', id: p.id, lv: p.lv + 1, isNew: false }, w: 2.2 });
    if (this.weapons.length < WEAPON_SLOTS)
      for (const id of Object.keys(WEAPONS) as WeaponId[]) if (!this.weapon(id)) pool.push({ c: { kind: 'weapon', id, lv: 1, isNew: true }, w: 2.2 });
    if (this.passives.length < PASSIVE_SLOTS)
      for (const id of Object.keys(PASSIVES) as PassiveId[]) if (!this.passiveLv(id)) pool.push({ c: { kind: 'passive', id, lv: 1, isNew: true }, w: 1.4 });
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
        if (p.lv + pending < MAX_PASSIVE_LV) pool.push({ kind: 'passive', id: p.id, lv: p.lv + pending + 1, isNew: false });
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
      if (e.dead) continue;
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  randomVisibleEnemy(): Enemy | null {
    const p = this.player;
    const vis = this.enemies.filter((e) => !e.dead && Math.abs(e.x - p.x) < this.viewW / 2 && Math.abs(e.y - p.y) < this.viewH / 2);
    return vis.length ? pick(vis) : null;
  }

  /** 视野外圆环上的随机点 */
  spawnPoint(): [number, number] {
    const p = this.player;
    const R = Math.hypot(this.viewW, this.viewH) / 2 + 16;
    const a = rand(TAU);
    return [p.x + Math.cos(a) * R, p.y + Math.sin(a) * R];
  }

  get progress() {
    return clamp(this.t / this.chapter.duration, 0, 1);
  }
}
