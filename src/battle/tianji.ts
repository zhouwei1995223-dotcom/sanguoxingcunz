import type { Battle } from './battle';
import type { Breakable, Enemy, Warning } from './entities';
import { HEROES, WUMING } from '../data/heroes';
import { WEAPONS, PASSIVES, WeaponId, PassiveId, MAX_WEAPON_LV, passiveMax } from '../data/skills';
import { rand, TAU } from '../core/math';
import { BOSSES } from '../data/enemies';
import type { HeroStats } from '../meta/ops';

/** 无名剑客的白板属性（模拟器用；游戏里走 computeStats('wuming')，装备、套装、军略都算，武将等级星级不算） */
export function tianjiStats(): HeroStats {
  return {
    atk: WUMING.baseAtk, hp: WUMING.baseHp, def: 0, speed: 0, crit: 5, critDmg: 50, dmg: 0, pickup: 0, exp: 0, gold: 0, cd: 0, area: 0, regen: 0, bossDmg: 0,
    revive: 0, reroll: 0, potion: 0, hero: 'wuming', cleared: 99,
  };
}

// 天机签：无名剑客独闯十分钟，一切靠抽签。
// 签分五档：上上 / 上 / 中 / 下 / 怪。下签都带补偿（塞翁失马），怪签是 20~30 秒的规则突变。
// 抽签来源：升级（每级一签）、每 40 秒一签、金币（砍树打怪攒）、看视频。

export type Tier = 0 | 1 | 2 | 3 | 4;
export const TIERS: { name: string; color: string; deep: string; glow: string; sfx: string }[] = [
  { name: '上上签', color: '#fee761', deep: '#a8650f', glow: '#fff3b0', sfx: 'evolve' },
  { name: '上签', color: '#c58cff', deep: '#5a2a8c', glow: '#ead4ff', sfx: 'levelup' },
  { name: '中签', color: '#5fc8ff', deep: '#124e89', glow: '#c8f0ff', sfx: 'chest' },
  { name: '下签', color: '#a8a8a8', deep: '#3a4466', glow: '#e0e0e0', sfx: 'hurt' },
  { name: '怪签', color: '#ff4f6a', deep: '#3e1030', glow: '#ff9ab0', sfx: 'boss' },
];
/** 基础概率：上上 6%、上 18%、中 43%、下 23%、怪 10% */
export const TIER_W = [6, 18, 43, 23, 10];
/** 每 40 秒自动送一签 */
export const FREE_EVERY = 40;
export const AD_DRAW_MAX = 3;
const TREE_TARGET = 9;

export interface DrawOption { label: string; sub?: string; color?: string; icon?: string; act: () => string | void }
export interface DrawResult {
  tier: Tier;
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** 揭晓时执行（有 options 的签由玩家选了再执行） */
  apply?: () => void;
  options?: DrawOption[];
  /** 揭晓后追加的说明（例如赌局结果） */
  outcome?: string;
}

interface Timed { id: string; name: string; left: number; total: number; good: boolean; end?: () => void }

export interface TianjiState {
  tickets: number;
  freeT: number;
  paidDraws: number;
  adDraws: number;
  /** 三连签等：接下来几签免费且不出下签 */
  bonusDraws: number;
  history: Tier[];
  sinceTop: number;
  badStreak: number;
  timed: Timed[];
  /** 永久加成（百分比，加法叠加） */
  perm: { atk: number; hp: number; speed: number; crit: number; area: number; cd: number; dmg: number };
  /** 夺兵贼：抢了兵器（weapon）或签（tickets），击败夺回 */
  thief: { e: Enemy; weapon?: WeaponId; lv: number; evo: boolean; tickets?: number } | null;
  /** 斩将令召来的敌将：击败送两支好签 */
  bounty: Enemy | null;
  /** 万剑归宗：落剑点（只伤敌） */
  strikes: { x: number; y: number; t: number; dmg: number }[];
  swordT: number;
  goldT: number;
  rust: { id: WeaponId; left: number }[];
  meteors: { w: Warning; dmg: number }[];
  meteorT: number;
  treeT: number;
  falls: { x: number; y: number; v: number; t: number; dir: number }[];
  coinsSpent: number;
  /** 最近一次揭晓的签（HUD 飘字用） */
  lastTier: Tier | -1;
  /** 测试用：下一签强制抽这个事件 id */
  force?: string;
  /** 天命之主（8:30 登场、血量无限）与本局对它造成的伤害（排行榜分数） */
  final: Enemy | null;
  finalDmg: number;
  /** 借将连发（群英会）：大招放完接着放下一个 */
  ultQueue: string[];
}

/**
 * 天机签的敌将血量只看时间、不看是哪位：敌将池里基础血量从 1800（夏侯恩）到 32 万（郭淮）差了上百倍，
 * 原样随机会在 3:00 抽到第九章的敌将，怎么打都只掉一两格血（2026-11-08 用户反馈）。
 * 按「虚拟基础血量」换算（3:00 为 800、6:00 为 1300），一场敌将战大约半分钟到一分钟。
 */
export function tianjiBossScale(id: string, t: number, grow: number): number {
  const virtual = t < 270 ? 800 : t < 420 ? 1300 : 1800;
  return grow * virtual / Math.max(1, BOSSES[id]?.hp || virtual);
}

/** 天命之主 8:30 登场，到 10:00 共 90 秒输出时间 */
export const FINAL_AT = 510;
const FINAL_POOL = ['caozhen', 'zhanghe', 'hande', 'guohuai', 'caochun', 'xuhuang', 'huaxiong', 'yanliang'];

/** 开局：青锋剑 2 级、手里 2 支签（开局两分钟只出好签和中签，先把架子搭起来） */
export const START_TICKETS = 2;
export function createTianji(): TianjiState {
  return {
    tickets: START_TICKETS, freeT: FREE_EVERY, paidDraws: 0, adDraws: 0, bonusDraws: 0, history: [], sinceTop: 0, badStreak: 0,
    timed: [], perm: { atk: 0, hp: 0, speed: 0, crit: 0, area: 0, cd: 0, dmg: 0 },
    thief: null, rust: [], meteors: [], meteorT: 0, treeT: 0, falls: [], coinsSpent: 0, lastTier: -1,
    final: null, finalDmg: 0, ultQueue: [], bounty: null, strikes: [], swordT: 0, goldT: 0,
  };
}

// —— 抽签费用 ——
/** 升级换签：20 级以前每级一签，之后每两级一签（后期升级很快，免得签多到抽不完） */
export function levelTickets(from: number, to: number): number {
  let n = 0;
  for (let lv = from + 1; lv <= to; lv++) if (lv <= 20 || lv % 2 === 0) n++;
  return n;
}

export function drawCost(st: TianjiState): number {
  // 越抽越贵：15 金起，每次 +8，封顶 200（手气好的局金币多，也不会抽到停不下来）
  return Math.min(200, 15 + st.paidDraws * 8);
}
export function canDraw(b: Battle): boolean {
  const st = b.tj!;
  return st.bonusDraws > 0 || st.tickets > 0 || b.coins >= drawCost(st);
}

const EXCLUSIVE: WeaponId[] = HEROES.map((h) => h.weapon);
const isExclusive = (id: WeaponId) => EXCLUSIVE.includes(id);
const pick = <T>(a: T[]): T => a[(Math.random() * a.length) | 0];

function heldExclusive(b: Battle) { return b.weapons.find((w) => isExclusive(w.id)); }
function upgradable(b: Battle) { return b.weapons.filter((w) => !w.evo && w.lv < MAX_WEAPON_LV); }
function commonWeapons(b: Battle): WeaponId[] { return b.skillPool.weapons.filter((id) => !isExclusive(id)); }

// —— 计时效果 ——
function addTimed(b: Battle, t: Timed) {
  const st = b.tj!;
  const old = st.timed.find((x) => x.id === t.id);
  if (old) { old.left = Math.max(old.left, t.left); return; }
  st.timed.push(t);
  b.recalc();
}
export function timedActive(st: TianjiState, id: string) { return st.timed.some((t) => t.id === id); }

/** recalc 末尾调用：永久加成 + 计时效果 */
export function tianjiRecalc(b: Battle) {
  const st = b.tj!;
  const p = st.perm;
  b.dmgMul *= 1 + p.atk / 100 + p.dmg / 100;
  b.speed *= 1 + p.speed / 100;
  b.crit += p.crit / 100;
  b.areaMul += p.area / 100;
  b.cdMul *= 1 - p.cd / 100;
  const hpMax = Math.round(b.player.maxHp * (1 + p.hp / 100));
  if (hpMax !== b.player.maxHp) {
    if (hpMax > b.player.maxHp) b.player.hp += hpMax - b.player.maxHp;
    b.player.maxHp = Math.max(1, hpMax);
    b.player.hp = Math.min(b.player.hp, b.player.maxHp);
  }
  const on = (id: string) => timedActive(st, id);
  if (on('swift')) b.speed *= 1.5;
  if (on('haste')) b.cdMul *= 0.6;
  // 每升一级就是一签：经验整体放慢，免得后期一分钟升好几级、签多到抽不完
  b.expMul *= 0.7;
  if (on('wisdom')) b.expMul *= 1.6;
  if (on('giant')) { b.dmgMul *= 1.4; b.areaMul += 0.3; b.dmgTakenMul *= 1.4; }
  if (on('tiny')) { b.dmgMul *= 0.8; b.speed *= 1.4; b.dmgTakenMul *= 0.7; }
  if (on('weaken')) b.dmgTakenMul *= 0.6;
  if (on('golden')) b.dmgTakenMul = 0;
  if (on('heavy')) b.speed *= 0.7;
  b.playerScale = on('giant') ? 1.6 : on('tiny') ? 0.6 : 1;
  b.enemySpeedMul = on('freeze') ? 0 : (on('slowtime') ? 0.5 : 1) * (on('enrage') ? 1.35 : 1);
  b.surgeMul = (on('horde') || on('night') ? 2.5 : 1) * (st.final ? 0.5 : 1);
}

// —— 每帧 ——
/** 天命之主：血量无限，打多少算多少 */
function spawnFinal(b: Battle) {
  const st = b.tj!;
  const id = FINAL_POOL[(Math.random() * FINAL_POOL.length) | 0];
  const a = rand(TAU);
  const e = b.spawnBoss(id, b.player.x + Math.cos(a) * 170, b.player.y + Math.sin(a) * 130, true, 1);
  e.hp = e.maxHp = 1e13;
  e.minTime = 0; // 血量无限，不需要保底时长（否则伤害会被削）
  e.scale = 2.5;
  st.final = e;
  b.recalc();
  b.hooks.banner('天命之主降临 · 90 秒尽情输出！', '#ff4f6a');
}

/** 对天命之主造成的伤害（damage() 里调用） */
export function tianjiFinalHit(b: Battle, dmg: number) {
  const st = b.tj!;
  st.finalDmg += dmg;
  // 血量无限，按血量比例涨怒气会是 0：改成每次命中给一点
  if (!b.ult && b.rageLock <= 0) b.rage = Math.min(100, b.rage + 0.35 * b.rageMul);
}

export function updateTianji(b: Battle, dt: number) {
  const st = b.tj!;
  const p = b.player;
  if (!st.final && b.t >= FINAL_AT) spawnFinal(b);
  if (st.ultQueue.length && !b.ult) {
    const h = HEROES.find((x) => x.id === st.ultQueue[0]);
    st.ultQueue.shift();
    if (h) b.castUlt(h);
  }
  st.freeT -= dt;
  if (st.freeT <= 0) {
    st.freeT += FREE_EVERY;
    st.tickets++;
    b.hooks.banner('天机自现 · 获得一支签', '#fee761');
    b.hooks.sfx('coin');
  }
  // 计时效果结束
  let changed = false;
  for (let i = st.timed.length - 1; i >= 0; i--) {
    const t = st.timed[i];
    t.left -= dt;
    if (t.left <= 0) {
      st.timed.splice(i, 1);
      changed = true;
      if (t.end) t.end();
    }
  }
  if (changed) b.recalc();
  // 生锈的兵器到时恢复，并额外升一级
  for (let i = st.rust.length - 1; i >= 0; i--) {
    const r = st.rust[i];
    r.left -= dt;
    if (r.left > 0) continue;
    st.rust.splice(i, 1);
    const w = b.weapon(r.id);
    if (w && !w.evo) {
      w.lv = Math.min(MAX_WEAPON_LV, w.lv + 2);
      b.hooks.banner(`${WEAPONS[r.id].name}重新开锋 · 升至 ${w.lv} 级`, '#5fc8ff');
      b.recalc();
    }
  }
  // 夺兵贼：被击败在 tianjiOnKill 里处理；被别的方式清掉（胜利清场等）也把兵器还回来
  if (st.thief && st.thief.e.dead && !b.won) returnStolen(b, false);
  // 陨石雨
  if (timedActive(st, 'meteor')) {
    st.meteorT -= dt;
    if (st.meteorT <= 0) {
      st.meteorT = 0.55;
      const p = b.player, a = rand(TAU), d = rand(30, 150);
      const w: Warning = { kind: 'circle', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.8, r: 30, a: 0, len: 0, t: 0, dur: 1.0, dmg: Math.round(b.player.maxHp * 0.1), hitFx: 'explo' };
      b.warnings.push(w);
      b.fx.push({ kind: 'meteor', x: w.x, y: w.y, t: -0.78, dur: 0.22, color: '#ff8a50' });
      st.meteors.push({ w, dmg: b.base.atk * 9 });
    }
  }
  for (let i = st.meteors.length - 1; i >= 0; i--) {
    const m = st.meteors[i];
    if (b.warnings.includes(m.w)) continue;
    st.meteors.splice(i, 1);
    // 陨石落地：敌我不分
    for (const e of b.enemies) if (!e.dead && (e.x - m.w.x) ** 2 + ((e.y - m.w.y) / 0.8) ** 2 < (m.w.r + e.r) ** 2) b.damage(e, m.dmg, 0, 0, 80, { noCrit: true, source: 'other' });
  }
  // 贴着树走就会顺手砍（兵器打不到身边的树时也能砍，砍树不用找角度）
  for (let i = b.breakables.length - 1; i >= 0; i--) {
    const k = b.breakables[i];
    if (k.kind !== 'tree' || (k.hitCd || 0) > 0) continue;
    if ((k.x - p.x) ** 2 + ((k.y - p.y) * 1.4) ** 2 > (k.r + 16) ** 2) continue;
    b.fx.push({ kind: 'slash', x: k.x, y: k.y - 14, t: 0, dur: 0.18, r: 18, w: 0.9, a: Math.atan2(k.y - p.y, k.x - p.x), color: '#ffffff' });
    if (tianjiTreeHit(b, k)) b.breakables.splice(i, 1);
  }
  // 万剑归宗：每 0.18 秒一把剑落在视野内随机敌人身上（只伤敌）
  if (timedActive(st, 'swordrain')) {
    st.swordT -= dt;
    while (st.swordT <= 0) {
      st.swordT += 0.18;
      const vis = b.enemies.filter((e) => !e.dead && b.inView(e.x, e.y));
      const e = vis.length ? vis[(Math.random() * vis.length) | 0] : null;
      if (!e) break;
      b.fx.push({ kind: 'meteor', x: e.x, y: e.y - 6, t: -0.12, dur: 0.22, color: '#9fe8ff' });
      st.strikes.push({ x: e.x, y: e.y, t: 0.1, dmg: b.base.atk * 6 });
    }
  }
  for (let i = st.strikes.length - 1; i >= 0; i--) {
    const k = st.strikes[i];
    k.t -= dt;
    if (k.t > 0) continue;
    st.strikes.splice(i, 1);
    b.fx.push({ kind: 'ring', x: k.x, y: k.y, t: 0, dur: 0.25, r: 22, color: '#9fe8ff' });
    for (const e of b.enemies) if (!e.dead && (e.x - k.x) ** 2 + (e.y - k.y) ** 2 < 26 * 26) b.damage(e, k.dmg, 0, 0, 40, { noCrit: false, source: 'other' });
  }
  // 金身不坏：金光护体，贴身的敌人被烫伤
  if (timedActive(st, 'golden')) {
    st.goldT -= dt;
    if (st.goldT <= 0) {
      st.goldT = 0.35;
      b.fx.push({ kind: 'ring', x: p.x, y: p.y - 8, t: 0, dur: 0.35, r: 30, color: '#fee761' });
      for (const e of b.enemies) if (!e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 34 * 34) b.damage(e, b.base.atk * 3, e.x - p.x, e.y - p.y, 60, { noCrit: true, source: 'other' });
    }
  }
  // 斩将令：召来的敌将被别的方式清掉就作废
  if (st.bounty && st.bounty.dead && !b.won) st.bounty = null;
  // 树：保持视野附近有几棵
  st.treeT -= dt;
  if (st.treeT <= 0) {
    st.treeT = 1.2;
    const trees = b.breakables.filter((k) => k.kind === 'tree').length;
    if (trees < TREE_TARGET) spawnTree(b);
  }
  for (let i = st.falls.length - 1; i >= 0; i--) { st.falls[i].t += dt; if (st.falls[i].t > 7) st.falls.splice(i, 1); }
}

function spawnTree(b: Battle) {
  const p = b.player;
  for (let tries = 0; tries < 6; tries++) {
    const a = rand(TAU), d = rand(Math.min(b.viewW, b.viewH) * 0.35, Math.max(b.viewW, b.viewH) * 0.7);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (b.breakables.some((k) => (k.x - x) ** 2 + (k.y - y) ** 2 < 40 * 40)) continue;
    const v = (Math.random() * 3) | 0;
    b.breakables.push({ x, y, r: 9, hp: 6, maxHp: 6, kind: 'tree', flash: 0, hits: 0, hitCd: 0, shake: 0, v });
    return;
  }
}

/** 树被砍一下。返回 true 表示倒了（调用方移除）。 */
export function tianjiTreeHit(b: Battle, t: Breakable): boolean {
  if ((t.hitCd || 0) > 0) return false;
  t.hitCd = 0.22;
  t.hp--;
  t.flash = 0.1;
  t.shake = 0.3;
  const leaves = t.v === 2 ? ['#63c74d', '#3e8948'] : t.v === 0 ? ['#3e8948', '#265c42'] : ['#63c74d', '#3e8948', '#e43b44'];
  b.burst(t.x, t.y - 20, 4, leaves, 50, 0.6, 60);
  if (Math.random() < 0.5) b.dropPickup('coin', t.x + rand(-8, 8), t.y + rand(-3, 5), 1);
  if (t.hp > 0) return false;
  // 倒下：往远离剑客的方向倒，爆一地金币，偶尔掉包子
  const st = b.tj!;
  st.falls.push({ x: t.x, y: t.y, v: t.v || 0, t: 0, dir: t.x >= b.player.x ? 1 : -1 });
  for (let i = 0; i < 6; i++) b.dropPickup('coin', t.x + rand(-14, 14), t.y + rand(-6, 8), 1);
  if (Math.random() < 0.12) b.dropPickup('bun', t.x, t.y + 4, 1);
  b.burst(t.x, t.y - 16, 14, leaves.concat(['#b86f50']), 90, 0.8, 80);
  b.hooks.sfx('explode');
  return true;
}

export function tianjiOnKill(b: Battle, e: Enemy) {
  const st = b.tj!;
  if (st.thief && st.thief.e === e) { returnStolen(b, true); return; }
  if (st.bounty === e) {
    st.bounty = null;
    st.bonusDraws += 2;
    b.hooks.banner('斩将令达成 · 获得两支好签！', '#fee761');
  }
  if (timedActive(st, 'vampire')) b.player.hp = Math.min(b.player.maxHp, b.player.hp + b.player.maxHp * 0.008);
  const storm = timedActive(st, 'goldrain') || timedActive(st, 'night');
  if (e.boss) for (let i = 0; i < 12; i++) b.dropPickup('coin', e.x + rand(-16, 16), e.y + rand(-10, 10), 2);
  else if (e.elite) for (let i = 0; i < 5; i++) b.dropPickup('coin', e.x + rand(-10, 10), e.y + rand(-8, 8), 2);
  else if (Math.random() < (storm ? 0.35 : 0.04)) b.dropPickup('coin', e.x + rand(-4, 4), e.y + rand(-3, 3), 1);
}

function returnStolen(b: Battle, killed: boolean) {
  const st = b.tj!, th = st.thief!;
  st.thief = null;
  if (th.tickets) {
    const n = killed ? th.tickets * 2 : th.tickets;
    st.tickets += n;
    b.hooks.banner(killed ? `抓住小贼 · 签翻倍还你（${n} 支）` : `签找回来了（${n} 支）`, '#fee761');
    b.hooks.sfx('levelup');
    return;
  }
  if (!th.weapon || b.weapon(th.weapon)) return;
  // 被夺的是专属兵器、这期间又抽到了别的专属兵器：只能带一件，夺回来的折成金币
  if (isExclusive(th.weapon) && heldExclusive(b)) {
    b.coins += 100;
    b.hooks.banner(`夺回${WEAPONS[th.weapon].name}，但已有专属兵器 · 折成 100 金币`, '#fee761');
    return;
  }
  const slotFree = b.weapons.length < b.weaponSlots;
  if (!slotFree) return;
  b.addWeapon(th.weapon);
  const w = b.weapon(th.weapon)!;
  w.lv = Math.min(MAX_WEAPON_LV, th.lv + (killed ? 1 : 0));
  if (th.evo) b.applyChoice({ kind: 'evo', id: th.weapon });
  b.hooks.banner(killed ? `夺回${WEAPONS[th.weapon].name} · 更胜从前！` : `${WEAPONS[th.weapon].name}失而复得`, '#fee761');
  b.hooks.sfx('evolve');
  b.recalc();
}

// —— 抽签 ——
function rollTier(b: Battle): Tier {
  const st = b.tj!;
  if (st.bonusDraws > 0) return pick([0, 1, 1, 2, 2, 2] as Tier[]);
  if (st.sinceTop >= 9) return 0;
  if (st.badStreak >= 3) return Math.random() < 0.3 ? 0 : 1;
  const w = TIER_W.slice();
  if (b.t < 120) { w[3] = 0; w[4] = 0; } // 开局两分钟只出好签和中签
  if (b.t >= 480) w[4] *= 2; // 最后两分钟越来越乱
  const sum = w.reduce((a, c) => a + c, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r < 0) return i as Tier; }
  return 2;
}

/** 扣签 / 扣金币，抽出一支签（还没生效，揭晓时 apply）。返回 null 表示抽不起。 */
export function drawSign(b: Battle, viaAd = false): DrawResult | null {
  const st = b.tj!;
  if (viaAd) st.adDraws++;
  else if (st.bonusDraws > 0) { /* 三连签：揭晓时再扣 */ }
  else if (st.tickets > 0) st.tickets--;
  else {
    const c = drawCost(st);
    if (b.coins < c) return null;
    b.coins -= c;
    st.coinsSpent += c;
    st.paidDraws++;
  }
  const forced = st.force ? EVENTS.find((e) => e.id === st.force) : undefined;
  st.force = undefined;
  const tier = forced ? forced.tier : rollTier(b);
  if (st.bonusDraws > 0) st.bonusDraws--;
  st.history.push(tier);
  st.sinceTop = tier === 0 ? 0 : st.sinceTop + 1;
  st.badStreak = tier === 3 ? st.badStreak + 1 : tier <= 1 ? 0 : st.badStreak;
  st.lastTier = tier;
  const pool = EVENTS.filter((e) => e.tier === tier && (!e.cond || e.cond(b)));
  let total = pool.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * total;
  let ev = forced || pool[0];
  if (!forced) for (const e of pool) { r -= e.w; if (r < 0) { ev = e; break; } }
  if (!ev) ev = EVENTS.find((e) => e.id === 'coins')!;
  void total;
  const res = ev.make(b);
  return { tier, id: ev.id, ...res };
}

// —— 事件表 ——
interface EventDef {
  id: string;
  tier: Tier;
  w: number;
  cond?: (b: Battle) => boolean;
  make: (b: Battle) => Omit<DrawResult, 'tier' | 'id'>;
}

function weaponIcon(id: WeaponId) { return WEAPONS[id].icon; }

/**
 * 专属兵器签：从 n 位名将的专属兵器里挑一件（2026-11-08 用户：拿兵器要让玩家自己选，跳过动画时也弹出）。
 * 已经带着专属兵器时，每个选项写明继承等级，另加「留着原来的」（改得 50 金币）。只能带一件专属兵器。
 */
function exclusiveDraw(b: Battle, lv: number, title: string, n: number): Omit<DrawResult, 'tier' | 'id'> {
  const cur = heldExclusive(b);
  const cands = EXCLUSIVE.filter((id) => id !== cur?.id).sort(() => Math.random() - 0.5).slice(0, n);
  const keepLv = cur ? (cur.evo ? MAX_WEAPON_LV : cur.lv) : 0;
  const newLv = Math.max(lv, keepLv);
  const owner = (id: WeaponId) => HEROES.find((h) => h.weapon === id)!.name;
  const options: DrawOption[] = cands.map((id) => ({
    label: `${owner(id)} · ${WEAPONS[id].name}`,
    sub: cur ? `替换${WEAPONS[cur.id].name} · 继承 ${newLv} 级` : `${lv} 级`,
    icon: WEAPONS[id].icon,
    act: () => {
      if (cur) { const i = b.weapons.indexOf(cur); if (i >= 0) b.weapons.splice(i, 1); }
      b.addWeapon(id);
      b.weapon(id)!.lv = cur ? newLv : lv;
      b.recalc();
      return `获得「${WEAPONS[id].name}」· ${b.weapon(id)!.lv} 级`;
    },
  }));
  if (cur) options.push({ label: `留着${WEAPONS[cur.id].name}`, sub: '改得 50 金币', act: () => { b.coins += 50; return '金币 +50'; } });
  return {
    title, icon: WEAPONS[cands[0]].icon,
    desc: cur ? `${cands.length} 件名将兵器任选其一\n专属兵器只能带一件，选了会替换「${WEAPONS[cur.id].name}」` : `${cands.length} 件名将兵器任选其一`,
    options,
  };
}

function upWeapon(b: Battle, n: number): string {
  const ws = upgradable(b);
  if (!ws.length) { b.coins += 40; return '兵器已臻化境，改得 40 金币'; }
  const w = pick(ws);
  const before = w.lv;
  w.lv = Math.min(MAX_WEAPON_LV, w.lv + n);
  b.recalc();
  return `${WEAPONS[w.id].name} ${before} → ${w.lv} 级`;
}

function upPassive(b: Battle, n: number): { text: string; icon: string } {
  const owned = b.passives.filter((p) => p.lv < passiveMax(p.id));
  const fresh = b.passives.length < b.passiveSlots ? b.skillPool.passives.filter((id) => !b.passives.some((p) => p.id === id)) : [];
  const cands: PassiveId[] = [...owned.map((p) => p.id), ...fresh];
  if (!cands.length) { b.coins += 40; return { text: '兵法已满，改得 40 金币', icon: 'gold' }; }
  const id = pick(cands);
  let p = b.passives.find((x) => x.id === id);
  if (!p) { p = { id, lv: 0 }; b.passives.push(p); }
  const before = p.lv;
  p.lv = Math.min(passiveMax(id), p.lv + n);
  b.recalc();
  return { text: before ? `${PASSIVES[id].name} ${before} → ${p.lv} 级` : `习得兵法「${PASSIVES[id].name}」· ${p.lv} 级`, icon: PASSIVES[id].icon };
}

function gainLevels(b: Battle, n: number) {
  for (let i = 0; i < n; i++) b.gainExp((b.expNeed - b.exp) / b.expMul + 0.01);
}

function borrow(b: Battle, title: string): Omit<DrawResult, 'tier' | 'id'> {
  const h = pick(HEROES);
  return {
    title, icon: 'hero_' + h.id + '_awk_4',
    desc: `${h.name}虚影现身：「${h.ultName}」！`,
    apply: () => { if (!b.castUlt(h)) b.rage = 100; },
  };
}

const STAT_UPS: { key: keyof TianjiState['perm']; name: string; v: number; icon: string }[] = [
  { key: 'atk', name: '攻击', v: 15, icon: 'atk' },
  { key: 'hp', name: '生命', v: 18, icon: 'hp' },
  { key: 'speed', name: '移速', v: 15, icon: 'p_horseshoe' },
  { key: 'crit', name: '暴击率', v: 8, icon: 'p_wine' },
  { key: 'area', name: '技能范围', v: 15, icon: 'p_flag' },
  { key: 'cd', name: '冷却缩减', v: 12, icon: 'p_book' },
];

function timedBuff(b: Battle, id: string, name: string, sec: number, good: boolean, end?: () => void) {
  addTimed(b, { id, name, left: sec, total: sec, good, end });
}

const EVENTS: EventDef[] = [
  // —— 上上签 ——
  { id: 'divine', tier: 0, w: 4, make: (b) => exclusiveDraw(b, 3, '神兵天降', 3) },
  { id: 'evolve', tier: 0, w: 3, cond: (b) => b.weapons.some((w) => !w.evo), make: (b) => {
    const w = pick(b.weapons.filter((x) => !x.evo));
    return { title: '神兵进化', icon: WEAPONS[w.id].evoIcon, desc: `「${WEAPONS[w.id].name}」直接进化为「${WEAPONS[w.id].evoName}」！`, apply: () => { w.lv = MAX_WEAPON_LV; b.applyChoice({ kind: 'evo', id: w.id }); } };
  } },
  { id: 'starlord', tier: 0, w: 2, make: (b) => {
    const r = borrow(b, '将星降世');
    return { ...r, desc: r.desc + '\n怒气同时充满', apply: () => { r.apply!(); b.rage = 100; } };
  } },
  { id: 'destiny', tier: 0, w: 3, make: (b) => ({ title: '天命所归', icon: 'p_seal', desc: '攻击 +25%、生命 +25%、移速 +15%（永久）', apply: () => { const p = b.tj!.perm; p.atk += 25; p.hp += 25; p.speed += 15; b.recalc(); } }) },
  { id: 'triple', tier: 0, w: 3, make: (b) => ({ title: '三连签', icon: 'tj_tong', desc: '签筒满溢！再免费连抽三签（不会出下签）', apply: () => { b.tj!.bonusDraws += 3; } }) },

  // —— 上签 ——
  { id: 'heroweapon', tier: 1, w: 3, make: (b) => exclusiveDraw(b, 1, '名将兵器', 2) },
  { id: 'weapon2', tier: 1, w: 3, cond: (b) => upgradable(b).length > 0, make: (b) => {
    const ws = upgradable(b); const w = pick(ws);
    return { title: '武艺精进', icon: weaponIcon(w.id), desc: `「${WEAPONS[w.id].name}」连升两级`, apply: () => { w.lv = Math.min(MAX_WEAPON_LV, w.lv + 2); b.recalc(); } };
  } },
  { id: 'passive2', tier: 1, w: 2, make: (b) => ({ title: '兵法大成', icon: 'p_book', desc: '随机一部兵法连升两级', apply: () => { const r = upPassive(b, 2); b.hooks.banner(r.text, '#c58cff'); } }) },
  { id: 'borrow', tier: 1, w: 2, make: (b) => borrow(b, '借将') },
  { id: 'chest', tier: 1, w: 2, make: (b) => ({ title: '天降宝箱', icon: 'chest_gold', desc: '一只金宝箱落在身旁', apply: () => { b.dropPickup('chest', b.player.x + 18, b.player.y, 1, true); } }) },
  { id: 'statup', tier: 1, w: 3, make: (b) => {
    const s = pick(STAT_UPS);
    return { title: '根骨奇佳', icon: s.icon, desc: `${s.name} +${s.v}%（永久）`, apply: () => { b.tj!.perm[s.key] += s.v; b.recalc(); } };
  } },
  { id: 'level2', tier: 1, w: 2, make: (b) => ({ title: '醍醐灌顶', icon: 'gem2', desc: '立刻连升三级（升级照样得签）', apply: () => gainLevels(b, 3) }) },

  // —— 中签 ——
  { id: 'weapon', tier: 2, w: 4, make: (b) => {
    const fresh = b.weapons.length < b.weaponSlots ? commonWeapons(b).filter((id) => !b.weapon(id)) : [];
    if (fresh.length) {
      // 新兵器：三选一（跳过动画时也会弹出让玩家选）
      const ids = fresh.sort(() => Math.random() - 0.5).slice(0, 3);
      return { title: '获得兵器', icon: weaponIcon(ids[0]), desc: `${ids.length} 件兵器任选其一`, options: ids.map((id) => ({
        label: WEAPONS[id].name, sub: WEAPONS[id].intro.slice(0, 12), icon: WEAPONS[id].icon,
        act: () => { b.addWeapon(id); b.recalc(); return `获得「${WEAPONS[id].name}」`; },
      })) };
    }
    return { title: '兵器升级', icon: 'atk', desc: '随机一件兵器升一级', apply: () => { b.hooks.banner(upWeapon(b, 1), '#5fc8ff'); } };
  } },
  { id: 'weaponup', tier: 2, w: 3, cond: (b) => upgradable(b).length > 0, make: (b) => {
    const w = pick(upgradable(b));
    return { title: '兵器升级', icon: weaponIcon(w.id), desc: `「${WEAPONS[w.id].name}」升一级`, apply: () => { w.lv = Math.min(MAX_WEAPON_LV, w.lv + 1); b.recalc(); } };
  } },
  { id: 'passive', tier: 2, w: 3, make: (b) => ({ title: '研习兵法', icon: 'p_book', desc: '随机一部兵法升一级', apply: () => { const r = upPassive(b, 1); b.hooks.banner(r.text, '#5fc8ff'); } }) },
  { id: 'coins', tier: 2, w: 3, make: (b) => { const n = 60 + ((Math.random() * 10) | 0) * 10; return { title: '金币袋', icon: 'gold', desc: `金币 +${n}`, apply: () => { b.coins += n; } }; } },
  { id: 'exp', tier: 2, w: 2, make: (b) => ({ title: '心有所悟', icon: 'gem1', desc: '立刻升一级', apply: () => gainLevels(b, 1) }) },
  { id: 'heal', tier: 2, w: 2, cond: (b) => b.player.hp < b.player.maxHp * 0.85, make: (b) => ({ title: '妙手回春', icon: 'bun', desc: '生命回满', apply: () => { b.player.hp = b.player.maxHp; } }) },
  { id: 'magnet', tier: 2, w: 2, make: (b) => ({ title: '吸星', icon: 'magnet', desc: '吸走全场经验宝石', apply: () => { b.dropPickup('magnet', b.player.x, b.player.y, 1); } }) },
  { id: 'bomb', tier: 2, w: 2, make: (b) => ({ title: '震天雷', icon: 'bomb', desc: '轰平眼前的敌军', apply: () => { b.dropPickup('bomb', b.player.x, b.player.y, 1); } }) },
  { id: 'swift', tier: 2, w: 1.5, make: (b) => ({ title: '神行', icon: 'p_horseshoe', desc: '30 秒内移速 +50%', apply: () => timedBuff(b, 'swift', '神行', 30, true) }) },
  { id: 'haste', tier: 2, w: 1.5, make: (b) => ({ title: '疾风', icon: 'p_book', desc: '30 秒内冷却 -40%', apply: () => timedBuff(b, 'haste', '疾风', 30, true) }) },
  { id: 'goldrain', tier: 2, w: 1.5, make: (b) => ({ title: '金币风暴', icon: 'gold', desc: '30 秒内每个敌人都掉金币', apply: () => timedBuff(b, 'goldrain', '金币风暴', 30, true) }) },
  { id: 'wisdom', tier: 2, w: 1.5, make: (b) => ({ title: '悟道', icon: 'gem2', desc: '30 秒内经验 +60%', apply: () => timedBuff(b, 'wisdom', '悟道', 30, true) }) },
  { id: 'slowtime', tier: 2, w: 1.5, make: (b) => ({ title: '光阴凝滞', icon: 'p_seal', desc: '20 秒内敌人移速减半', apply: () => timedBuff(b, 'slowtime', '光阴凝滞', 20, true) }) },

  // —— 下签（都有补偿）——
  { id: 'horde', tier: 3, w: 3, make: (b) => ({ title: '怪潮来袭', icon: 'kills', desc: '30 秒内敌军暴增！\n扛过去送金宝箱和 50 金币', apply: () => {
    b.hooks.banner('怪潮来袭！', '#e43b44');
    timedBuff(b, 'horde', '怪潮', 30, false, () => { b.dropPickup('chest', b.player.x + 20, b.player.y, 1, true); b.coins += 50; b.hooks.banner('怪潮退去 · 金宝箱 + 50 金币', '#fee761'); });
  } }) },
  { id: 'elites', tier: 3, w: 2, make: (b) => ({ title: '精英围剿', icon: 'kills', desc: '三名精英杀到！\n每击败一名都掉宝箱', apply: () => {
    for (let i = 0; i < 3; i++) { const [x, y] = b.spawnPoint(); b.spawnEnemy(b.t > 360 ? 'elite_guard' : 'wei_heavy', x, y, { elite: true }); }
    b.hooks.banner('精英围剿！', '#e43b44');
  } }) },
  { id: 'thief', tier: 3, w: 2, cond: (b) => !b.tj!.thief && b.weapons.length > 1, make: (b) => {
    const w = heldExclusive(b) || pick(b.weapons.filter((x) => x.id !== 'sword')) || b.weapons[b.weapons.length - 1];
    const name = WEAPONS[w.id].name;
    return { title: '夺兵', icon: weaponIcon(w.id), desc: `一名盗将夺走了「${name}」！\n击败他夺回兵器，还能再升一级`, apply: () => {
      const i = b.weapons.indexOf(w);
      if (i < 0) return;
      b.weapons.splice(i, 1);
      const a = rand(TAU);
      const e = b.spawnEnemy('elite_guard', b.player.x + Math.cos(a) * 150, b.player.y + Math.sin(a) * 110, { elite: true, hpMul: 2.5 });
      b.tj!.thief = { e, weapon: w.id, lv: w.lv, evo: w.evo };
      b.recalc();
      b.hooks.banner(`盗将夺走了${name}！`, '#e43b44');
    } };
  } },
  { id: 'enrage', tier: 3, w: 2, make: (b) => ({ title: '敌军狂暴', icon: 'kills', desc: '20 秒内敌人移速 +35%\n熬过去再得一签', apply: () => timedBuff(b, 'enrage', '敌军狂暴', 20, false, () => { b.tj!.tickets++; b.hooks.banner('狂暴平息 · 获得一支签', '#fee761'); }) }) },
  { id: 'fog', tier: 3, w: 2, make: (b) => ({ title: '迷雾', icon: 'p_seal', desc: '20 秒内视野变窄\n雾散后获得一级经验', apply: () => timedBuff(b, 'fog', '迷雾', 20, false, () => gainLevels(b, 1)) }) },
  { id: 'broke', tier: 3, w: 2, cond: (b) => b.coins >= 20, make: (b) => {
    const n = Math.max(10, Math.round(b.coins * 0.3));
    return { title: '破财', icon: 'gold', desc: `丢了 ${n} 金币……\n破财消灾，送你一支签`, apply: () => { b.coins = Math.max(0, b.coins - n); b.tj!.tickets++; } };
  } },
  { id: 'rust', tier: 3, w: 2, cond: (b) => b.weapons.some((w) => !w.evo && w.lv > 1), make: (b) => {
    const w = pick(b.weapons.filter((x) => !x.evo && x.lv > 1));
    return { title: '兵器生锈', icon: weaponIcon(w.id), desc: `「${WEAPONS[w.id].name}」降一级 30 秒\n之后重新开锋，反升一级`, apply: () => { w.lv--; b.tj!.rust.push({ id: w.id, left: 30 }); b.recalc(); } };
  } },

  // —— 怪签 ——
  { id: 'giant', tier: 4, w: 3, make: (b) => ({ title: '巨人化', icon: 'atk', desc: '30 秒内体型变大：伤害 +40%、范围 +30%\n但受到的伤害也 +40%', apply: () => timedBuff(b, 'giant', '巨人化', 30, true) }) },
  { id: 'meteor', tier: 4, w: 3, make: (b) => ({ title: '天降陨石', icon: 'bomb', desc: '20 秒陨石雨，敌我不分！\n看准红圈躲开', apply: () => timedBuff(b, 'meteor', '陨石雨', 20, false) }) },
  { id: 'gamble', tier: 4, w: 3, cond: (b) => upgradable(b).length > 0, make: (b) => {
    const w = pick(upgradable(b));
    const name = WEAPONS[w.id].name;
    return { title: '赌局', icon: weaponIcon(w.id), desc: `押上「${name}」（${w.lv} 级）\n五成升三级，五成降一级`, options: [
      { label: '押！', sub: '升三级 / 降一级', color: '#a22633', act: () => {
        if (Math.random() < 0.5) { w.lv = Math.min(MAX_WEAPON_LV, w.lv + 3); b.recalc(); b.hooks.sfx('evolve'); return `赢了！${name}升至 ${w.lv} 级`; }
        w.lv = Math.max(1, w.lv - 1); b.recalc(); b.hooks.sfx('hurt'); return `输了……${name}降至 ${w.lv} 级`;
      } },
      { label: '不赌', sub: '拿 20 金币走人', act: () => { b.coins += 20; return '金币 +20'; } },
    ] };
  } },
  { id: 'blood', tier: 4, w: 2, make: (b) => ({ title: '以血换力', icon: 'hp', desc: '生命上限永久 -20%\n换取伤害永久 +30%', options: [
    { label: '换！', sub: '生命 -20% · 伤害 +30%', color: '#a22633', act: () => { const p = b.tj!.perm; p.hp -= 20; p.dmg += 30; b.recalc(); return '血气化为杀意'; } },
    { label: '算了', sub: '拿 20 金币', act: () => { b.coins += 20; return '金币 +20'; } },
  ] }) },
  { id: 'night', tier: 4, w: 2, make: (b) => ({ title: '百鬼夜行', icon: 'gold', desc: '30 秒内敌军暴增\n但每个敌人都掉金币', apply: () => timedBuff(b, 'night', '百鬼夜行', 30, false) }) },

  // —— 2026-11-08 第二批：更大胆的签 ——
  { id: 'chestrain', tier: 0, w: 2, make: (b) => ({ title: '宝箱雨', icon: 'chest_gold', desc: '四只金宝箱从天而降', apply: () => {
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; b.dropPickup('chest', b.player.x + Math.cos(a) * 34, b.player.y + Math.sin(a) * 26, 1, true); }
  } }) },
  { id: 'allstar', tier: 0, w: 2, make: (b) => {
    const hs = HEROES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    return { title: '群英会', icon: 'hero_' + hs[0].id + '_awk_4', desc: `${hs.map((h) => h.name).join('、')}\n三位名将接连放出大招！`, apply: () => { b.tj!.ultQueue.push(...hs.map((h) => h.id)); } };
  } },
  { id: 'resonance', tier: 0, w: 2, cond: (b) => b.weapons.some((w) => !w.evo && w.lv < MAX_WEAPON_LV), make: (b) => ({ title: '兵器共鸣', icon: 'atk', desc: '所有兵器同时升一级', apply: () => { for (const w of b.weapons) if (!w.evo) w.lv = Math.min(MAX_WEAPON_LV, w.lv + 1); b.recalc(); } }) },
  { id: 'golden', tier: 0, w: 2, make: (b) => ({ title: '金身不坏', icon: 'p_armor', desc: '15 秒刀枪不入\n贴身的敌人被金光烫伤', apply: () => timedBuff(b, 'golden', '金身不坏', 15, true) }) },

  { id: 'midas', tier: 1, w: 2, make: (b) => ({ title: '点石成金', icon: 'gold', desc: '屏幕内的小兵全部化作金币', apply: () => {
    for (const e of b.enemies) {
      if (e.dead || e.boss || e.elite || !b.inView(e.x, e.y)) continue;
      b.killEnemy(e);
      b.dropPickup('coin', e.x, e.y, 1);
    }
    b.hooks.sfx('coin'); b.hooks.shake(3);
  } }) },
  { id: 'freeze', tier: 1, w: 2, make: (b) => ({ title: '定身法', icon: 'p_seal', desc: '全场敌人定住 6 秒', apply: () => { timedBuff(b, 'freeze', '定身法', 6, true); b.fx.push({ kind: 'shock', x: b.player.x, y: b.player.y, t: 0, dur: 0.6, r: 200, w: 10, color: '#9fe8ff' }); } }) },
  { id: 'jubao', tier: 1, w: 2, cond: (b) => b.tj!.paidDraws >= 3, make: (b) => ({ title: '聚宝盆', icon: 'gold', desc: '金币抽签的价格回到 15\n再送一支签', apply: () => { b.tj!.paidDraws = 0; b.tj!.tickets++; } }) },
  { id: 'swordrain', tier: 1, w: 2, make: (b) => ({ title: '万剑归宗', icon: 'w_sword_evo', desc: '15 秒剑雨倾盆，专斩敌军', apply: () => timedBuff(b, 'swordrain', '万剑归宗', 15, true) }) },
  { id: 'vampire', tier: 1, w: 2, make: (b) => ({ title: '嗜血', icon: 'hp', desc: '30 秒内每击杀一个敌人回一点血', apply: () => timedBuff(b, 'vampire', '嗜血', 30, true) }) },

  { id: 'rage', tier: 2, w: 2, cond: (b) => b.rage < 80, make: (b) => ({ title: '怒发冲冠', icon: 'p_horn', desc: '怒气立刻充满', apply: () => { b.rage = 100; } }) },
  { id: 'weaken', tier: 2, w: 1.5, make: (b) => ({ title: '敌军萎靡', icon: 'p_armor', desc: '30 秒内受到的伤害 -40%', apply: () => timedBuff(b, 'weaken', '敌军萎靡', 30, true) }) },
  { id: 'grove', tier: 2, w: 1.5, make: (b) => ({ title: '天降森林', icon: 'tj_tree1', desc: '身边长出六棵树，砍了全是金币', apply: () => {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.breakables.push({ x: b.player.x + Math.cos(a) * 60, y: b.player.y + Math.sin(a) * 46, r: 9, hp: 6, maxHp: 6, kind: 'tree', flash: 0, hits: 0, hitCd: 0, shake: 0.3, v: (Math.random() * 3) | 0 }); }
  } }) },

  { id: 'pickpocket', tier: 3, w: 2, cond: (b) => !b.tj!.thief && b.tj!.tickets >= 1, make: (b) => {
    const n = Math.min(3, b.tj!.tickets);
    return { title: '签被偷', icon: 'tj_tong', desc: `小贼偷走了 ${n} 支签！\n抓住他，签翻倍还你`, apply: () => {
      const st = b.tj!; const k = Math.min(st.tickets, n); st.tickets -= k;
      const a = rand(TAU);
      const e = b.spawnEnemy('bandit', b.player.x + Math.cos(a) * 120, b.player.y + Math.sin(a) * 90, { elite: true, hpMul: 1.5 });
      e.speed *= 1.3;
      st.thief = { e, lv: 0, evo: false, tickets: k };
    } };
  } },
  { id: 'heavy', tier: 3, w: 1.5, make: (b) => ({ title: '负重', icon: 'p_horseshoe', desc: '20 秒内移速 -30%\n熬过去再得一签', apply: () => timedBuff(b, 'heavy', '负重', 20, false, () => { b.tj!.tickets++; b.hooks.banner('卸下重担 · 获得一支签', '#fee761'); }) }) },
  { id: 'ambush', tier: 3, w: 2, make: (b) => ({ title: '十面埋伏', icon: 'kills', desc: '四面八方围上来一圈敌军\n杀出重围再得一签', apply: () => {
    const n = 28 + Math.floor(b.t / 30);
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; b.spawnEnemy(b.t > 300 ? 'wu_shield' : 'wei_spear', b.player.x + Math.cos(a) * 150, b.player.y + Math.sin(a) * 120); }
    b.hooks.banner('十面埋伏！', '#e43b44');
    timedBuff(b, 'ambush', '十面埋伏', 20, false, () => { b.tj!.tickets++; b.hooks.banner('杀出重围 · 获得一支签', '#fee761'); });
  } }) },

  { id: 'tiny', tier: 4, w: 2, make: (b) => ({ title: '缩小术', icon: 'p_horseshoe', desc: '20 秒内身形变小：移速 +40%、受伤 -30%\n但伤害 -20%', apply: () => timedBuff(b, 'tiny', '缩小术', 20, true) }) },
  { id: 'shuffle', tier: 4, w: 2, cond: (b) => b.weapons.some((w) => !w.evo && !isExclusive(w.id)), make: (b) => ({ title: '乾坤大挪移', icon: 'p_map', desc: '所有通用兵器随机换成别的\n等级保留', apply: () => {
    const pool = commonWeapons(b);
    for (const w of b.weapons.slice()) {
      if (w.evo || isExclusive(w.id)) continue;
      const cands = pool.filter((id) => !b.weapon(id));
      if (!cands.length) break;
      const id = pick(cands), lv = w.lv;
      b.weapons.splice(b.weapons.indexOf(w), 1);
      b.addWeapon(id);
      b.weapon(id)!.lv = lv;
    }
    b.recalc();
    b.hooks.banner('乾坤大挪移！兵器全换了', '#ff4f6a');
  } }) },
  { id: 'allin', tier: 4, w: 2, cond: (b) => b.coins >= 40, make: (b) => {
    const n = b.coins;
    return { title: '孤注一掷', icon: 'gold', desc: `押上全部 ${n} 金币\n五成翻倍，五成归零`, options: [
      { label: '押！', sub: `翻倍到 ${n * 2} / 归零`, color: '#a22633', act: () => {
        if (Math.random() < 0.5) { b.coins += n; b.hooks.sfx('evolve'); return `赢了！金币翻倍到 ${b.coins}`; }
        b.coins = Math.max(0, b.coins - n); b.hooks.sfx('hurt'); return '输光了……下次一定';
      } },
      { label: '不押', sub: '稳一点', act: () => '收手了' },
    ] };
  } },
  { id: 'bounty', tier: 4, w: 2, cond: (b) => !b.tj!.bounty && !b.tj!.final && b.t < 480, make: (b) => ({ title: '斩将令', icon: 'kills', desc: '一员敌将立刻杀到！\n斩了他，送两支好签', apply: () => {
    const ids = ['xiahouen', 'chenying', 'xuhuang', 'hanying', 'suyong', 'huaxiong', 'yanliang', 'caimao'];
    const a = rand(TAU);
    const id = pick(ids);
    const e = b.spawnBoss(id, b.player.x + Math.cos(a) * 160, b.player.y + Math.sin(a) * 120, false, tianjiBossScale(id, b.t, 1 + b.t / 150));
    b.tj!.bounty = e;
  } }) },
];

/** 结算评语：按上上 / 上签占比和怪签数量 */
export function luckVerdict(history: Tier[]): { text: string; color: string } {
  const n = history.length;
  if (!n) return { text: '一签未抽', color: '#a8a8a8' };
  const top = history.filter((t) => t === 0).length, good = history.filter((t) => t <= 1).length;
  const bad = history.filter((t) => t === 3).length, weird = history.filter((t) => t === 4).length;
  const score = (top * 3 + good * 1.2 - bad * 0.8) / n;
  if (top >= 4 || score > 0.75) return { text: '天命所归', color: '#fee761' };
  if (weird >= 4) return { text: '妖孽横生', color: '#ff4f6a' };
  if (score > 0.4) return { text: '鸿运当头', color: '#c58cff' };
  if (bad >= 5 && top >= 1) return { text: '大起大落', color: '#5fc8ff' };
  if (score < 0.05) return { text: '时运不济', color: '#a8a8a8' };
  return { text: '平平安安', color: '#5fc8ff' };
}

