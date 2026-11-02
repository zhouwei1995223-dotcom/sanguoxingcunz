import { rand, TAU, weighted } from '../core/math';
import {
  UNITS, UnitKind, ORDERS, OrderId, LINKS, LinkId, ORDER_IDS, LINK_IDS, MAX_ALLIES, CITY_R, DEFENSE_LEASH, DEFENSE_SPAWN_R,
  DEFENSE_POOLS, DEFENSE_MID_AT, DEFENSE_BOSS_AT, DEFENSE_DURATION, HERO_SUMMON_COST, HERO_SUMMON_TIME, HERO_SUMMON_CD, HERO_SUMMON_MAX,
  REPAIR_COST, REPAIR_PCT, REPAIR_CD,
} from '../data/defense';
import type { Battle } from './battle';
import type { Enemy } from './entities';

// 守城模式的局内逻辑：城池、我方士兵 / 武将的自动战斗、角楼 / 拒马 / 滚木、刷怪波次、召唤与修城。

export interface Ally {
  kind: UnitKind | 'hero';
  heroId?: string;
  x: number; y: number; r: number;
  hp: number; maxHp: number;
  atk: number; cd: number; cdT: number; range: number; speed: number;
  /** 武将在场剩余秒数（士兵为 -1） */
  life: number;
  left: boolean; anim: number; flash: number; dead: boolean;
  sprite: string;
  /** 武将大招 / 骑兵冲锋计时 */
  skillT: number;
  /** 冲锋中：速度与已撞过的敌人 */
  dashT: number; dvx: number; dvy: number; dashHit?: Set<number>;
  /** 没有敌人时回到的驻守点 */
  ox: number; oy: number;
}

/** 飞行中的箭（我方弓兵、弩车、角楼），到达时结算 */
export interface AllyArrow {
  x: number; y: number; tx: number; ty: number; t: number; dur: number;
  target: Enemy | null; dmg: number; fire: boolean; pierce: boolean; big: boolean;
}

export interface Log { x: number; y: number; vx: number; vy: number; life: number; hit: Set<number>; dmg: number; rot: number }

export interface HeroInfo { atk: number; hp: number; name: string; ultName: string; sprite: string }

export interface DefenseState {
  cityHp: number; cityMax: number; cityBase: number; cityFlash: number;
  grain: number;
  allies: Ally[];
  arrows: AllyArrow[];
  logs: Log[];
  orders: Partial<Record<OrderId, number>>;
  links: Set<LinkId>;
  heroes: Record<string, HeroInfo>;
  heroCd: Record<string, number>;
  repairCd: number;
  towerT: number[];
  spikeT: number;
  logT: number;
  waveIdx: number;
  nextWave: number;
  trickleT: number;
  midDone: boolean;
  bossDone: boolean;
  /** 武将倒下后重整的倒计时（0 = 在场） */
  downT: number;
  lost: boolean;
  /** 士兵击杀数（结算展示） */
  allyKills: number;
  breakT: number;
  /** 平衡统计：城池受到的伤害按来源累计 */
  dmgBy: Record<string, number>;
}

/** 四座角楼的位置（和城池图对应） */
export const TOWERS: [number, number][] = [[-48, -36], [48, -36], [-48, 16], [48, 16]];
const DIRS = ['东', '南', '西', '北'];

export function createDefense(b: Battle, heroes: Record<string, HeroInfo>): DefenseState {
  const cityBase = Math.round(1200 * Math.max(1, b.enemyDmgMul));
  // 武将从城门口出发
  b.player.x = 0; b.player.y = CITY_R + 24;
  return {
    cityHp: cityBase, cityMax: cityBase, cityBase, cityFlash: 0, grain: 80,
    allies: [], arrows: [], logs: [], orders: {}, links: new Set(), heroes, heroCd: {}, repairCd: 0,
    towerT: [0.5, 0.7, 0.9, 1.1], spikeT: 0.5, logT: 7, waveIdx: 0, nextWave: 12, trickleT: 1, midDone: false, bossDone: false,
    downT: 0, lost: false, allyKills: 0, breakT: 10, dmgBy: {},
  };
}

export const orderLv = (d: DefenseState, id: OrderId) => d.orders[id] || 0;

export function unitUnlocked(d: DefenseState, kind: UnitKind): boolean {
  const u = UNITS[kind];
  return !u.unlock || orderLv(d, u.unlock) > 0;
}

/** 某兵种当前的属性（随军令卡等级成长） */
export function unitStats(b: Battle, kind: UnitKind) {
  const d = b.def!;
  const u = UNITS[kind];
  const oid = (Object.keys(ORDERS) as OrderId[]).find((k) => ORDERS[k].unit === kind)!;
  const lv = orderLv(d, oid);
  const boosts = u.unlock ? Math.max(0, lv - 1) : lv;
  // 军令卡每级 +25%；武将每升一级，士兵也 +3%（打怪升级同样在强化军队）
  const mul = (1 + 0.25 * boosts) * (1 + 0.03 * (b.level - 1));
  const drum = orderLv(d, 'c_drum');
  let hp = b.base.hp * u.hpK * mul;
  let atk = b.base.atk * u.atkK * mul;
  if (kind === 'shield' && d.links.has('l_iron')) hp *= 2;
  if (kind === 'spear' && d.links.has('l_phalanx')) atk *= 1.5;
  const count = u.count + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0) + (kind === 'spear' && d.links.has('l_phalanx') ? 2 : 0);
  return { hp: Math.round(hp), atk: Math.round(atk), count, atkSpd: 1 + 0.1 * drum, speed: u.speed * (1 + 0.06 * drum) };
}

export function grainRate(d: DefenseState): number {
  return 3.5 * (1 + 0.3 * orderLv(d, 'c_beacon'));
}

const soldiers = (d: DefenseState) => d.allies.reduce((n, a) => n + (!a.dead && a.kind !== 'hero' ? 1 : 0), 0);
const heroesOut = (d: DefenseState) => d.allies.filter((a) => !a.dead && a.kind === 'hero');

/** 召唤兵种：返回错误提示或 null */
export function summonUnit(b: Battle, kind: UnitKind): string | null {
  const d = b.def!;
  const u = UNITS[kind];
  if (!unitUnlocked(d, kind)) return `升级时选择「${ORDERS[u.unlock!].name}」解锁${u.name}`;
  if (d.grain < u.cost) return `粮草不足（需要 ${u.cost}）`;
  const st = unitStats(b, kind);
  const room = MAX_ALLIES - soldiers(d);
  if (room <= 0) return `兵力已满（最多 ${MAX_ALLIES} 人）`;
  d.grain -= u.cost;
  const n = Math.min(room, st.count);
  // 从离武将最近的一面城墙出城
  const a0 = Math.atan2(b.player.y, b.player.x);
  for (let i = 0; i < n; i++) {
    const a = a0 + rand(-0.6, 0.6);
    const R = CITY_R + 14;
    const post = a0 + rand(-1.2, 1.2), pr = CITY_R + 30 + rand(0, 50);
    d.allies.push({
      kind, x: Math.cos(a) * R, y: Math.sin(a) * R + 10, r: u.r, hp: st.hp, maxHp: st.hp, atk: st.atk, cd: u.cd, cdT: rand(0, 0.5), range: u.range, speed: st.speed,
      life: -1, left: Math.cos(a) < 0, anim: rand(0, 4), flash: 0, dead: false, sprite: u.sprite, skillT: rand(1, 4), dashT: 0, dvx: 0, dvy: 0,
      ox: Math.cos(post) * pr, oy: Math.sin(post) * pr,
    });
  }
  b.fx.push({ kind: 'ring', x: Math.cos(a0) * (CITY_R + 10), y: Math.sin(a0) * (CITY_R + 10), t: 0, dur: 0.4, r: 26, color: '#9be37a' });
  b.hooks.sfx('horse');
  return null;
}

export function heroCanSummon(b: Battle, id: string): string | null {
  const d = b.def!;
  if (id === b.hero.id) return '出战武将已在场上';
  if ((d.heroCd[id] || 0) > 0) return `冷却中（${Math.ceil(d.heroCd[id])} 秒）`;
  if (heroesOut(d).some((a) => a.heroId === id)) return '已在场上';
  if (heroesOut(d).length >= HERO_SUMMON_MAX) return `最多同时召唤 ${HERO_SUMMON_MAX} 位武将`;
  if (d.grain < HERO_SUMMON_COST) return `粮草不足（需要 ${HERO_SUMMON_COST}）`;
  return null;
}

/** 召唤已解锁的武将：强度按武将自己的等级、星级、巅峰等级 */
export function summonHero(b: Battle, id: string): string | null {
  const err = heroCanSummon(b, id);
  if (err) return err;
  const d = b.def!;
  const h = d.heroes[id];
  d.grain -= HERO_SUMMON_COST;
  d.heroCd[id] = HERO_SUMMON_CD;
  const a = Math.atan2(b.player.y, b.player.x) + rand(-0.5, 0.5);
  const hp = Math.round(h.hp * 5);
  d.allies.push({
    kind: 'hero', heroId: id, x: Math.cos(a) * (CITY_R + 16), y: Math.sin(a) * (CITY_R + 16) + 10, r: 9, hp, maxHp: hp, atk: Math.round(h.atk * 2.2), cd: 0.75, cdT: 0.3,
    range: 26, speed: 70, life: HERO_SUMMON_TIME, left: false, anim: 0, flash: 0, dead: false, sprite: h.sprite, skillT: 4, dashT: 0, dvx: 0, dvy: 0,
    ox: Math.cos(a) * (CITY_R + 50), oy: Math.sin(a) * (CITY_R + 50),
  });
  b.hooks.banner(`${h.name}前来助阵！`, '#fee761');
  b.hooks.sfx('boss');
  b.fx.push({ kind: 'ring', x: Math.cos(a) * (CITY_R + 16), y: Math.sin(a) * (CITY_R + 16), t: 0, dur: 0.6, r: 50, color: '#fee761' });
  return null;
}

export function repairCity(b: Battle): string | null {
  const d = b.def!;
  if (d.repairCd > 0) return `修城冷却中（${Math.ceil(d.repairCd)} 秒）`;
  if (d.cityHp >= d.cityMax) return '城池完好，不需要修';
  if (d.grain < REPAIR_COST) return `粮草不足（需要 ${REPAIR_COST}）`;
  d.grain -= REPAIR_COST;
  d.repairCd = REPAIR_CD;
  d.cityHp = Math.min(d.cityMax, d.cityHp + d.cityMax * REPAIR_PCT);
  b.fx.push({ kind: 'ring', x: 0, y: -8, t: 0, dur: 0.6, r: 70, color: '#9be37a' });
  b.hooks.sfx('evolve');
  return null;
}

/** 选了军令卡 */
export function applyOrder(b: Battle, id: OrderId, lv: number) {
  const d = b.def!;
  d.orders[id] = lv;
  if (id === 'c_wall') {
    const old = d.cityMax;
    d.cityMax = Math.round(d.cityBase * (1 + 0.2 * lv));
    d.cityHp = Math.min(d.cityMax, d.cityHp + (d.cityMax - old) + d.cityMax * 0.3);
  }
  // 已在场的同兵种立刻享受成长
  const kind = ORDERS[id].unit;
  if (kind) {
    const st = unitStats(b, kind);
    for (const a of d.allies) if (!a.dead && a.kind === kind) { const k = st.hp / a.maxHp; a.maxHp = st.hp; a.hp = Math.round(a.hp * k); a.atk = st.atk; a.speed = st.speed; }
  }
}

export function applyLink(b: Battle, id: LinkId) {
  const d = b.def!;
  d.links.add(id);
  const kind = ORDERS[LINKS[id].unit].unit!;
  const st = unitStats(b, kind);
  for (const a of d.allies) if (!a.dead && a.kind === kind) { a.maxHp = st.hp; a.hp = st.hp; a.atk = st.atk; }
  b.hooks.banner(`军令联动 · ${LINKS[id].name}`, '#fee761');
  b.hooks.sfx('evolve');
}

/** 可以选的军令联动 */
export function readyLinks(d: DefenseState): LinkId[] {
  return LINK_IDS.filter((id) => !d.links.has(id) && orderLv(d, LINKS[id].unit) >= ORDERS[LINKS[id].unit].max && orderLv(d, LINKS[id].city) > 0);
}

/** 升级三选一里的军令卡（权重已经按数量归一化） */
export function orderChoices(d: DefenseState): { id: OrderId; lv: number; w: number }[] {
  const out: { id: OrderId; lv: number; w: number }[] = [];
  for (const id of ORDER_IDS) {
    const lv = orderLv(d, id);
    if (lv >= ORDERS[id].max) continue;
    let w = ORDERS[id].unit ? (lv === 0 && id !== 'o_spear' ? 2.6 : 2.2) : 2;
    // 已经点过的卡更容易再出现，方便凑联动
    if (lv > 0) w *= 1.3;
    out.push({ id, lv: lv + 1, w });
  }
  const sum = out.reduce((s, x) => s + x.w, 0);
  const k = Math.min(1, 16 / Math.max(1, sum));
  for (const x of out) x.w *= k;
  return out;
}

/** 敌人当前追击的目标：攻城兵种只打城；武将在附近就打武将；身边有我方士兵就打士兵；否则攻城 */
export function enemyTarget(b: Battle, e: Enemy): { x: number; y: number; ally: Ally | null; city: boolean } {
  const d = b.def!;
  const p = b.player;
  const siege = e.def && (e.def.ai === 'siege' || e.def.id === 'siege_cata');
  if (!siege) {
    const heroUp = d.downT <= 0;
    if (e.boss) return heroUp ? { x: p.x, y: p.y, ally: null, city: false } : { x: 0, y: 0, ally: null, city: true };
    if (heroUp && (p.x - e.x) ** 2 + (p.y - e.y) ** 2 < 90 * 90) return { x: p.x, y: p.y, ally: null, city: false };
    let best: Ally | null = null, bd = 70 * 70;
    for (const a of d.allies) {
      if (a.dead) continue;
      const taunt = a.kind === 'shield' && d.links.has('l_iron') ? 2.2 : 1;
      const dd = ((a.x - e.x) ** 2 + (a.y - e.y) ** 2) / (taunt * taunt);
      if (dd < bd) { bd = dd; best = a; }
    }
    if (best) return { x: best.x, y: best.y, ally: best, city: false };
  }
  return { x: 0, y: 0, ally: null, city: true };
}

/** 敌人碰到城墙 / 士兵时的攻击（battle.updateEnemies 调用），返回 true 表示已经处理（不再接触玩家） */
export function enemyContact(b: Battle, e: Enemy, tgt: { ally: Ally | null; city: boolean }): boolean {
  const d = b.def!;
  if (tgt.city) {
    const dist = Math.hypot(e.x, e.y + 8);
    if (dist < CITY_R + e.r) {
      // 贴在城墙外沿，不再往里挤
      const k = (CITY_R + e.r) / (dist || 1);
      e.x *= k; e.y = (e.y + 8) * k - 8;
      if (e.atkCd <= 0) {
        e.atkCd = e.def?.id === 'siege_ram' ? 2.2 : 1.1;
        // 普通步兵拆城墙很慢，冲车 / 云梯 / 敌将才是真正的威胁
        const siege = e.def && (e.def.ai === 'siege' || e.def.id === 'siege_cata');
        hurtCity(b, e.dmg * (e.boss ? 1 : siege ? 1 : 0.25), e.boss ? 'boss' : e.def!.id);
      }
    }
    return true;
  }
  if (tgt.ally) {
    const a = tgt.ally;
    if ((a.x - e.x) ** 2 + (a.y - e.y) ** 2 < (a.r + e.r) ** 2 && e.atkCd <= 0) {
      e.atkCd = 1.1;
      a.hp -= e.dmg;
      a.flash = 0.12;
      if (a.kind === 'shield' && d.links.has('l_iron')) b.allyDamage(e, e.dmg * 0.5 + a.atk * 0.5);
      if (a.hp <= 0) killAlly(b, a);
    }
    return true;
  }
  return false;
}

export function hurtCity(b: Battle, dmg: number, src = '') {
  const d = b.def!;
  if (d.lost || b.won) return;
  d.dmgBy[src] = (d.dmgBy[src] || 0) + dmg;
  d.cityHp -= dmg;
  d.cityFlash = 0.15;
  if (d.cityHp <= 0) {
    d.cityHp = 0;
    d.lost = true;
    b.dead = true;
    b.hooks.vibrate(true);
  }
}

function killAlly(b: Battle, a: Ally) {
  a.dead = true;
  b.fx.push({ kind: 'puff', x: a.x, y: a.y, t: 0, dur: 0.3 });
}

/** 城池失守后看广告「死守」：城池恢复一半，震开城下敌人 */
export function reviveCity(b: Battle) {
  const d = b.def!;
  d.lost = false;
  d.cityHp = Math.round(d.cityMax * 0.5);
  for (const e of b.enemies) {
    if (e.dead) continue;
    const dist = Math.hypot(e.x, e.y);
    if (dist < 150) {
      if (!e.boss && !e.elite) b.killEnemy(e);
      else { e.kx += (e.x / (dist || 1)) * 300; e.ky += (e.y / (dist || 1)) * 300; }
    }
  }
  b.shots.length = 0;
  b.fx.push({ kind: 'ring', x: 0, y: -8, t: 0, dur: 0.7, r: 160, color: '#fee761' });
  b.hooks.banner('死守城池！', '#fee761');
}

function nearestEnemy(b: Battle, x: number, y: number, maxD: number): Enemy | null {
  let best: Enemy | null = null, bd = maxD * maxD;
  for (const e of b.enemies) {
    if (e.dead) continue;
    // 太远的（还在城外老远）不追，免得士兵跑散
    if (e.x * e.x + e.y * e.y > (DEFENSE_LEASH + 40) ** 2) continue;
    const dd = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}

function shoot(b: Battle, x: number, y: number, e: Enemy, dmg: number, opts: { fire?: boolean; pierce?: boolean; big?: boolean } = {}) {
  const d = b.def!;
  const dist = Math.hypot(e.x - x, e.y - 6 - y);
  d.arrows.push({ x, y, tx: e.x, ty: e.y - 6, t: 0, dur: Math.max(0.12, dist / (opts.pierce ? 420 : 320)), target: e, dmg, fire: !!opts.fire, pierce: !!opts.pierce, big: !!opts.big });
}

function splash(b: Battle, x: number, y: number, r: number, dmg: number, max = 8) {
  let n = 0;
  for (const e of b.enemies) {
    if (e.dead || (e.x - x) ** 2 + (e.y - y) ** 2 > (r + e.r) ** 2) continue;
    b.allyDamage(e, dmg);
    if (++n >= max) break;
  }
}

function updateAllies(b: Battle, dt: number) {
  const d = b.def!;
  const drum = orderLv(d, 'c_drum');
  const atkSpd = 1 + 0.1 * drum;
  for (const a of d.allies) {
    if (a.dead) continue;
    a.flash = Math.max(0, a.flash - dt);
    a.cdT -= dt * (a.kind === 'hero' ? 1 : atkSpd);
    a.skillT -= dt;
    if (a.kind === 'hero') {
      a.life -= dt;
      if (a.life <= 0) { killAlly(b, a); continue; }
    }
    // 骑兵冲锋中
    if (a.dashT > 0) {
      a.dashT -= dt;
      a.x += a.dvx * dt; a.y += a.dvy * dt;
      for (const e of b.enemies) {
        if (e.dead || a.dashHit!.has(e.uid) || (e.x - a.x) ** 2 + (e.y - a.y) ** 2 > (14 + e.r) ** 2) continue;
        a.dashHit!.add(e.uid);
        b.allyDamage(e, a.atk * 2);
        if (!e.dead && !e.boss) { e.kx += a.dvx * 0.8; e.ky += a.dvy * 0.8; }
      }
      a.anim += dt * 14;
      continue;
    }
    const e = nearestEnemy(b, a.x, a.y, a.kind === 'archer' || a.kind === 'xbow' ? 220 : 180);
    let mx = 0, my = 0;
    if (!e) {
      const dx = a.ox - a.x, dy = a.oy - a.y, dist = Math.hypot(dx, dy);
      if (dist > 4) { mx = dx / dist; my = dy / dist; }
    } else {
      const dx = e.x - a.x, dy = e.y - a.y, dist = Math.hypot(dx, dy) || 1;
      a.left = dx < 0;
      if (dist > a.range + e.r) { mx = dx / dist; my = dy / dist; }
      else if (a.cdT <= 0) {
        a.cdT = a.cd;
        attack(b, a, e, dx / dist, dy / dist);
      }
      // 骑兵冲阵：每 4 秒向敌人冲锋
      if (a.kind === 'cav' && d.links.has('l_charge') && a.skillT <= 0 && dist < 120) {
        a.skillT = 4;
        a.dashT = 0.35;
        a.dvx = (dx / dist) * 280; a.dvy = (dy / dist) * 280;
        a.dashHit = new Set();
        b.fx.push({ kind: 'beam', x: a.x, y: a.y - 6, t: 0, dur: 0.35, a: Math.atan2(dy, dx), len: 100, w: 8 });
      }
    }
    if (mx || my) {
      a.x += mx * a.speed * dt;
      a.y += my * a.speed * dt;
      a.anim += dt * (a.speed / 8);
      if (Math.abs(mx) > 0.2) a.left = mx < 0;
    }
    // 武将：每 8 秒放一次大招
    if (a.kind === 'hero' && a.skillT <= 0) {
      a.skillT = 8;
      const h = d.heroes[a.heroId!];
      splash(b, a.x, a.y - 6, 90, a.atk * 5, 40);
      b.fx.push({ kind: 'ring', x: a.x, y: a.y - 6, t: 0, dur: 0.6, r: 90, color: '#fee761' });
      b.fx.push({ kind: 'text', x: a.x, y: a.y - 40, t: 0, dur: 1.4, text: h.ultName, color: '#fee761' });
      b.hooks.shake(3);
      b.hooks.sfx('explode');
    }
    // 不要站进城里
    const cd = Math.hypot(a.x, a.y + 8);
    if (cd < CITY_R + a.r) { const k = (CITY_R + a.r) / (cd || 1); a.x *= k; a.y = (a.y + 8) * k - 8; }
  }
  // 士兵之间轻微分开
  for (let i = 0; i < d.allies.length; i++) {
    const a = d.allies[i];
    if (a.dead) continue;
    for (let j = i + 1; j < d.allies.length; j++) {
      const o = d.allies[j];
      if (o.dead) continue;
      const dx = a.x - o.x, dy = a.y - o.y, rr = a.r + o.r, dd = dx * dx + dy * dy;
      if (dd < rr * rr && dd > 0.01) { const dl = Math.sqrt(dd), push = (rr - dl) / dl * 0.25; a.x += dx * push; a.y += dy * push; o.x -= dx * push; o.y -= dy * push; }
    }
  }
  if (d.allies.length > 40 || (b.t % 2 < dt && d.allies.some((a) => a.dead))) d.allies = d.allies.filter((a) => !a.dead);
}

function attack(b: Battle, a: Ally, e: Enemy, nx: number, ny: number) {
  const d = b.def!;
  switch (a.kind) {
    case 'archer':
      shoot(b, a.x, a.y - 8, e, a.atk, { fire: d.links.has('l_fire') });
      break;
    case 'xbow':
      shoot(b, a.x, a.y - 8, e, a.atk, { pierce: d.links.has('l_thunder'), big: true });
      b.hooks.sfx('shoot');
      break;
    case 'hero':
      splash(b, e.x, e.y, 28, a.atk, 6);
      b.fx.push({ kind: 'slash', x: e.x, y: e.y - 8, t: 0, dur: 0.22, a: Math.atan2(ny, nx), w: 1.4, r: 20, color: '#fee761' });
      break;
    case 'spear':
      if (d.links.has('l_phalanx')) {
        // 长枪方阵：刺穿面前一排
        const cx = a.x + nx * 18, cy = a.y + ny * 18;
        splash(b, cx, cy, 20, a.atk, 6);
        b.fx.push({ kind: 'thrust', x: a.x, y: a.y - 6, t: 0, dur: 0.2, a: Math.atan2(ny, nx), len: 34, w: 3 });
      } else {
        b.allyDamage(e, a.atk);
        b.fx.push({ kind: 'thrust', x: a.x, y: a.y - 6, t: 0, dur: 0.16, a: Math.atan2(ny, nx), len: 18, w: 2 });
      }
      break;
    default:
      b.allyDamage(e, a.atk);
      if (b.fx.length < 260) b.fx.push({ kind: 'slash', x: e.x, y: e.y - 8, t: 0, dur: 0.18, a: Math.atan2(ny, nx), w: 1.1, r: 10, color: '#ffffff' });
  }
}

function updateArrows(b: Battle, dt: number) {
  const d = b.def!;
  for (let i = d.arrows.length - 1; i >= 0; i--) {
    const ar = d.arrows[i];
    ar.t += dt;
    if (ar.target && !ar.target.dead) { ar.tx = ar.target.x; ar.ty = ar.target.y - 6; }
    if (ar.t < ar.dur) continue;
    d.arrows.splice(i, 1);
    if (ar.pierce) {
      // 霹雳弩：贯穿整条线，终点爆炸
      const dx = ar.tx - ar.x, dy = ar.ty - ar.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, L = len + 60;
      for (const e of b.enemies) {
        if (e.dead) continue;
        const ex = e.x - ar.x, ey = e.y - 6 - ar.y, along = ex * ux + ey * uy;
        if (along < 0 || along > L || Math.abs(-ex * uy + ey * ux) > 8 + e.r) continue;
        b.allyDamage(e, ar.dmg);
      }
      const fx = ar.x + ux * L, fy = ar.y + uy * L;
      splash(b, fx, fy, 30, ar.dmg * 0.8);
      b.fx.push({ kind: 'lightning', x: ar.x, y: ar.y, t: 0, dur: 0.25, pts: [ar.x, ar.y, fx, fy] });
      b.fx.push({ kind: 'explo', x: fx, y: fy, t: 0, dur: 0.3 });
      continue;
    }
    if (ar.target && !ar.target.dead) b.allyDamage(ar.target, ar.dmg);
    if (ar.fire) {
      splash(b, ar.tx, ar.ty + 6, 26, ar.dmg * 0.5);
      if (b.fx.length < 260) b.fx.push({ kind: 'explo', x: ar.tx, y: ar.ty + 6, t: 0, dur: 0.25 });
    }
  }
}

function updateCityDefense(b: Battle, dt: number) {
  const d = b.def!;
  // 角楼弓手
  const towers = Math.min(4, orderLv(d, 'c_tower'));
  const tdmg = b.base.atk * 1.0 * (orderLv(d, 'c_tower') >= 5 ? 1.6 : 1);
  for (let i = 0; i < towers; i++) {
    d.towerT[i] -= dt;
    if (d.towerT[i] > 0) continue;
    const [tx, ty] = TOWERS[i];
    const e = nearestEnemy(b, tx, ty, 200);
    if (!e) { d.towerT[i] = 0.2; continue; }
    d.towerT[i] = 0.9;
    shoot(b, tx, ty - 20, e, tdmg, { fire: d.links.has('l_fire') });
  }
  // 拒马
  const spike = orderLv(d, 'c_spike');
  if (spike) {
    d.spikeT -= dt;
    if (d.spikeT <= 0) {
      d.spikeT = 0.5;
      const dmg = b.base.atk * 0.5 * Math.pow(1.5, spike - 1);
      for (const e of b.enemies) {
        if (e.dead || Math.hypot(e.x, e.y + 8) > CITY_R + e.r + 12) continue;
        b.allyDamage(e, dmg);
        if (spike >= 3 && !e.boss) { e.slow = Math.max(e.slow, 0.4); e.slowT = Math.max(e.slowT, 0.6); }
      }
    }
  }
  // 滚木礌石
  const log = orderLv(d, 'c_log');
  if (log) {
    d.logT -= dt;
    if (d.logT <= 0) {
      d.logT = log >= 5 ? 5 : 7;
      const dmg = b.base.atk * 2.5 * Math.pow(1.4, (log >= 2 ? 1 : 0) + (log >= 4 ? 1 : 0) + (log >= 5 ? 1 : 0));
      const per = log >= 3 ? 2 : 1;
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 4;
        for (let j = 0; j < per; j++) {
          const side = per > 1 ? (j - 0.5) * 30 : 0;
          const px = -Math.sin(a) * side, py = Math.cos(a) * side;
          d.logs.push({ x: Math.cos(a) * (CITY_R + 6) + px, y: Math.sin(a) * (CITY_R + 6) + py - 4, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, life: 1.5, hit: new Set(), dmg, rot: a });
        }
      }
      b.hooks.sfx('thrust');
    }
  }
  for (let i = d.logs.length - 1; i >= 0; i--) {
    const l = d.logs[i];
    l.life -= dt;
    if (l.life <= 0) { d.logs.splice(i, 1); continue; }
    l.x += l.vx * dt; l.y += l.vy * dt;
    for (const e of b.enemies) {
      if (e.dead || l.hit.has(e.uid) || (e.x - l.x) ** 2 + (e.y - l.y) ** 2 > (14 + e.r) ** 2) continue;
      l.hit.add(e.uid);
      b.allyDamage(e, l.dmg);
      if (!e.dead && !e.boss) { e.kx += l.vx * 0.6; e.ky += l.vy * 0.6; }
    }
  }
}

function spawnAround(b: Battle, id: string, side: number, spread = 0.7, opts: { elite?: boolean; hpMul?: number } = {}) {
  const a = side * (TAU / 4) + rand(-spread, spread);
  const R = DEFENSE_SPAWN_R + rand(0, 40);
  return b.spawnEnemy(id, Math.cos(a) * R, Math.sin(a) * R, opts);
}

function pool(t: number): [string, number][] {
  let p = DEFENSE_POOLS[0].pool;
  for (const x of DEFENSE_POOLS) if (t >= x.from) p = x.pool;
  return p;
}

/** 刷怪：持续的零散敌人 + 每 20 秒一波主攻（从一两个方向压上来） */
export function updateDefenseSpawner(b: Battle, dt: number) {
  const d = b.def!;
  const t = b.t;
  if (t >= DEFENSE_DURATION) return;
  const bossAlive = !!(b.finalBoss || b.midBoss);
  // 零散敌人
  d.trickleT -= dt;
  if (d.trickleT <= 0) {
    d.trickleT = 0.7;
    const target = Math.min(55, 10 + t * 0.15) * b.densityMul * (bossAlive ? 0.6 : 1);
    b.targetDensity = target;
    let alive = 0;
    for (const e of b.enemies) if (!e.dead && !e.boss) alive++;
    const need = Math.min(4, Math.ceil(target - alive));
    const pl = pool(t);
    for (let i = 0; i < need; i++) spawnAround(b, weighted(pl, (x) => x[1])[0], (Math.random() * 4) | 0, 0.78);
  }
  // 主攻波次
  if (t >= d.nextWave && t < DEFENSE_BOSS_AT) {
    d.waveIdx++;
    d.nextWave += 20;
    const w = d.waveIdx;
    const sides = w >= 4 && Math.random() < 0.5 ? 2 : 1;
    const s0 = (Math.random() * 4) | 0;
    const ss = sides === 2 ? [s0, (s0 + 2) % 4] : [s0];
    const pl = pool(t);
    const n = Math.round((8 + 2 * w) * b.densityMul);
    for (let i = 0; i < n; i++) spawnAround(b, weighted(pl, (x) => x[1])[0], ss[i % ss.length], 0.4);
    if (w >= 4) for (let i = 0; i < 1 + Math.floor((w - 4) / 3); i++) spawnAround(b, 'siege_ram', ss[i % ss.length], 0.3);
    if (w >= 2) for (let i = 0; i < 1 + Math.floor(w / 3); i++) spawnAround(b, 'siege_ladder', ss[i % ss.length], 0.4);
    if (w >= 6) for (let i = 0; i < 1 + Math.floor((w - 6) / 4); i++) spawnAround(b, 'siege_cata', ss[i % ss.length], 0.3);
    if (w === 5 || w === 9 || w === 12) for (let i = 0; i < (w >= 9 ? 2 : 1); i++) spawnAround(b, w >= 9 ? 'wei_heavy' : 'wei_shield', ss[0], 0.3, { elite: true });
    b.hooks.banner(`第 ${w} 波 · 敌军从${ss.map((s) => DIRS[s]).join('、')}面攻城！`, '#e43b44');
    b.hooks.sfx('boss');
  }
  // 中途敌将 / 主将
  if (!d.midDone && t >= DEFENSE_MID_AT) {
    d.midDone = true;
    const s = (Math.random() * 4) | 0, a = s * (TAU / 4);
    b.spawnBoss(b.chapter.midBoss, Math.cos(a) * DEFENSE_SPAWN_R, Math.sin(a) * DEFENSE_SPAWN_R, false, 0.8);
  }
  if (!d.bossDone && t >= DEFENSE_BOSS_AT) {
    d.bossDone = true;
    const s = (Math.random() * 4) | 0, a = s * (TAU / 4);
    b.spawnBoss(b.chapter.boss, Math.cos(a) * DEFENSE_SPAWN_R, Math.sin(a) * DEFENSE_SPAWN_R, true, 0.9);
  }
  // 补几个灯笼 / 粮车（打破掉包子、磁石）
  d.breakT -= dt;
  if (d.breakT <= 0) {
    d.breakT = 20;
    if (b.breakables.length < 3) { const a = rand(TAU), r = rand(CITY_R + 40, DEFENSE_LEASH - 40); b.spawnBreakable(Math.cos(a) * r, Math.sin(a) * r); }
  }
}

/** 每帧：粮草、冷却、士兵、城防、武将倒下与重整、胜利判定 */
export function updateDefense(b: Battle, dt: number) {
  const d = b.def!;
  d.grain += grainRate(d) * dt;
  d.repairCd = Math.max(0, d.repairCd - dt);
  d.cityFlash = Math.max(0, d.cityFlash - dt);
  for (const k in d.heroCd) d.heroCd[k] = Math.max(0, d.heroCd[k] - dt);
  updateAllies(b, dt);
  updateArrows(b, dt);
  updateCityDefense(b, dt);
  // 武将倒下：在城里重整 8 秒后满血归来（城池还在就不算输）
  const p = b.player;
  if (d.downT > 0) {
    d.downT -= dt;
    p.x = 0; p.y = CITY_R - 6;
    p.iframe = Math.max(p.iframe, 0.5);
    if (d.downT <= 0) {
      d.downT = 0;
      p.hp = p.maxHp;
      p.iframe = 2;
      b.fx.push({ kind: 'ring', x: p.x, y: p.y - 8, t: 0, dur: 0.6, r: 60, color: '#fee761' });
      b.hooks.banner(`${b.hero.name}重整完毕，再度出城！`, '#fee761');
    }
  }
  // 不能离城太远
  const pd = Math.hypot(p.x, p.y);
  if (pd > DEFENSE_LEASH) { p.x *= DEFENSE_LEASH / pd; p.y *= DEFENSE_LEASH / pd; }
  // 撑到时间：胜利
  if (b.t >= DEFENSE_DURATION && !b.won && !d.lost) {
    for (const e of b.enemies) if (!e.dead) { e.dead = true; b.fx.push({ kind: 'puff', x: e.x, y: e.y, t: 0, dur: 0.3 }); }
    b.won = true;
  }
}

/** 武将倒下（不是失败，城池还在就能重整） */
export function heroDown(b: Battle) {
  const d = b.def!;
  if (d.downT > 0) return;
  d.downT = 8;
  b.player.hp = 0;
  b.hooks.banner(`${b.hero.name}退回城中重整！`, '#ff8a80');
  b.hooks.vibrate(true);
}

/** 敌方投射物打中城墙 */
export function shotHitsCity(x: number, y: number): boolean {
  return Math.abs(x) < CITY_R - 2 && y > -CITY_R - 4 && y < CITY_R - 10;
}
