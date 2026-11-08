import type { Battle } from './battle';
import type { Breakable, Enemy, Warning } from './entities';
import { HEROES } from '../data/heroes';
import { WEAPONS, PASSIVES, WeaponId, PassiveId, MAX_WEAPON_LV, WEAPON_SLOTS, PASSIVE_SLOTS, passiveMax } from '../data/skills';
import { rand, TAU } from '../core/math';
import type { HeroStats } from '../meta/ops';

/** 无名剑客的固定属性：不吃任何局外养成（装备、军略、武将等级），人人一样，全凭签运 */
export const TIANJI_ATK = 32, TIANJI_HP = 180;
export function tianjiStats(): HeroStats {
  return {
    atk: TIANJI_ATK, hp: TIANJI_HP, def: 0, speed: 0, crit: 5, critDmg: 50, dmg: 0, pickup: 0, exp: 0, gold: 0, cd: 0, area: 0, regen: 0, bossDmg: 0,
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
/** 基础概率：上上 5%、上 15%、中 45%、下 25%、怪 10% */
const TIER_W = [5, 15, 45, 25, 10];
/** 每 40 秒自动送一签 */
export const FREE_EVERY = 40;
export const AD_DRAW_MAX = 3;
const TREE_TARGET = 9;

export interface DrawOption { label: string; sub?: string; color?: string; act: () => string | void }
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
  thief: { e: Enemy; weapon: WeaponId; lv: number; evo: boolean } | null;
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
}

/** 开局：青锋剑 2 级、手里 2 支签（开局两分钟只出好签和中签，先把架子搭起来） */
export const START_TICKETS = 2;
export function createTianji(): TianjiState {
  return {
    tickets: START_TICKETS, freeT: FREE_EVERY, paidDraws: 0, adDraws: 0, bonusDraws: 0, history: [], sinceTop: 0, badStreak: 0,
    timed: [], perm: { atk: 0, hp: 0, speed: 0, crit: 0, area: 0, cd: 0, dmg: 0 },
    thief: null, rust: [], meteors: [], meteorT: 0, treeT: 0, falls: [], coinsSpent: 0, lastTier: -1,
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
  b.playerScale = on('giant') ? 1.6 : 1;
  b.enemySpeedMul = (on('slowtime') ? 0.5 : 1) * (on('enrage') ? 1.35 : 1);
  b.surgeMul = on('horde') || on('night') ? 2.5 : 1;
}

// —— 每帧 ——
export function updateTianji(b: Battle, dt: number) {
  const st = b.tj!;
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
  const p = b.player;
  for (let i = b.breakables.length - 1; i >= 0; i--) {
    const k = b.breakables[i];
    if (k.kind !== 'tree' || (k.hitCd || 0) > 0) continue;
    if ((k.x - p.x) ** 2 + ((k.y - p.y) * 1.4) ** 2 > (k.r + 16) ** 2) continue;
    b.fx.push({ kind: 'slash', x: k.x, y: k.y - 14, t: 0, dur: 0.18, r: 18, w: 0.9, a: Math.atan2(k.y - p.y, k.x - p.x), color: '#ffffff' });
    if (tianjiTreeHit(b, k)) b.breakables.splice(i, 1);
  }
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
  const storm = timedActive(st, 'goldrain') || timedActive(st, 'night');
  if (e.boss) for (let i = 0; i < 12; i++) b.dropPickup('coin', e.x + rand(-16, 16), e.y + rand(-10, 10), 2);
  else if (e.elite) for (let i = 0; i < 5; i++) b.dropPickup('coin', e.x + rand(-10, 10), e.y + rand(-8, 8), 2);
  else if (Math.random() < (storm ? 0.35 : 0.04)) b.dropPickup('coin', e.x + rand(-4, 4), e.y + rand(-3, 3), 1);
}

function returnStolen(b: Battle, killed: boolean) {
  const st = b.tj!, th = st.thief!;
  st.thief = null;
  if (b.weapon(th.weapon)) return;
  const slotFree = b.weapons.length < WEAPON_SLOTS;
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

/** 获得一件专属武器：已有专属武器时让玩家选择是否替换（继承等级） */
function exclusiveDraw(b: Battle, lv: number, title: string): Omit<DrawResult, 'tier' | 'id'> {
  const cur = heldExclusive(b);
  const choices = EXCLUSIVE.filter((id) => id !== cur?.id);
  const id = pick(choices);
  const owner = HEROES.find((h) => h.weapon === id)!;
  const name = WEAPONS[id].name;
  if (!cur) {
    const full = b.weapons.length >= WEAPON_SLOTS;
    return {
      title, icon: weaponIcon(id),
      desc: full ? `${owner.name}的${name}……可惜兵器位已满，化作 60 金币` : `获得${owner.name}的专属兵器「${name}」· ${lv} 级`,
      apply: () => {
        if (full) { b.coins += 60; return; }
        b.addWeapon(id);
        b.weapon(id)!.lv = lv;
        b.recalc();
      },
    };
  }
  const keepLv = cur.evo ? MAX_WEAPON_LV : cur.lv;
  const newLv = Math.max(lv, keepLv);
  const curName = WEAPONS[cur.id].name;
  return {
    title, icon: weaponIcon(id),
    desc: `${owner.name}的专属兵器「${name}」！\n只能携带一件专属兵器，是否替换「${curName}」？`,
    options: [
      { label: `换成${name}`, sub: `继承等级 · ${newLv} 级${cur.evo ? '（需重新进化）' : ''}`, color: '#a22633', act: () => {
        const i = b.weapons.indexOf(cur);
        b.weapons.splice(i, 1);
        b.addWeapon(id);
        b.weapon(id)!.lv = newLv;
        b.recalc();
        return `${curName} → ${name} · ${newLv} 级`;
      } },
      { label: `留着${curName}`, sub: '改得 50 金币', act: () => { b.coins += 50; return '金币 +50'; } },
    ],
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
  const fresh = b.passives.length < PASSIVE_SLOTS ? b.skillPool.passives.filter((id) => !b.passives.some((p) => p.id === id)) : [];
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
  { key: 'atk', name: '攻击', v: 10, icon: 'atk' },
  { key: 'hp', name: '生命', v: 12, icon: 'hp' },
  { key: 'speed', name: '移速', v: 10, icon: 'p_horseshoe' },
  { key: 'crit', name: '暴击率', v: 6, icon: 'p_wine' },
  { key: 'area', name: '技能范围', v: 10, icon: 'p_flag' },
  { key: 'cd', name: '冷却缩减', v: 8, icon: 'p_book' },
];

function timedBuff(b: Battle, id: string, name: string, sec: number, good: boolean, end?: () => void) {
  addTimed(b, { id, name, left: sec, total: sec, good, end });
}

const EVENTS: EventDef[] = [
  // —— 上上签 ——
  { id: 'divine', tier: 0, w: 4, make: (b) => exclusiveDraw(b, 3, '神兵天降') },
  { id: 'evolve', tier: 0, w: 3, cond: (b) => b.weapons.some((w) => !w.evo), make: (b) => {
    const w = pick(b.weapons.filter((x) => !x.evo));
    return { title: '神兵进化', icon: WEAPONS[w.id].evoIcon, desc: `「${WEAPONS[w.id].name}」直接进化为「${WEAPONS[w.id].evoName}」！`, apply: () => { w.lv = MAX_WEAPON_LV; b.applyChoice({ kind: 'evo', id: w.id }); } };
  } },
  { id: 'starlord', tier: 0, w: 2, make: (b) => {
    const r = borrow(b, '将星降世');
    return { ...r, desc: r.desc + '\n怒气同时充满', apply: () => { r.apply!(); b.rage = 100; } };
  } },
  { id: 'destiny', tier: 0, w: 3, make: (b) => ({ title: '天命所归', icon: 'p_seal', desc: '攻击 +15%、生命 +15%、移速 +10%（永久）', apply: () => { const p = b.tj!.perm; p.atk += 15; p.hp += 15; p.speed += 10; b.recalc(); } }) },
  { id: 'triple', tier: 0, w: 3, make: (b) => ({ title: '三连签', icon: 'tj_tong', desc: '签筒满溢！再免费连抽三签（不会出下签）', apply: () => { b.tj!.bonusDraws += 3; } }) },

  // —— 上签 ——
  { id: 'heroweapon', tier: 1, w: 3, make: (b) => exclusiveDraw(b, 1, '名将兵器') },
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
  { id: 'level2', tier: 1, w: 2, make: (b) => ({ title: '醍醐灌顶', icon: 'gem2', desc: '立刻连升两级（每级再得一签）', apply: () => gainLevels(b, 2) }) },

  // —— 中签 ——
  { id: 'weapon', tier: 2, w: 4, make: (b) => {
    const fresh = b.weapons.length < WEAPON_SLOTS ? commonWeapons(b).filter((id) => !b.weapon(id)) : [];
    if (fresh.length) {
      const id = pick(fresh);
      return { title: '获得兵器', icon: weaponIcon(id), desc: `获得「${WEAPONS[id].name}」`, apply: () => { b.addWeapon(id); b.recalc(); } };
    }
    return { title: '兵器升级', icon: 'atk', desc: '随机一件兵器升一级', apply: () => { b.hooks.banner(upWeapon(b, 1), '#5fc8ff'); } };
  } },
  { id: 'weaponup', tier: 2, w: 3, cond: (b) => upgradable(b).length > 0, make: (b) => {
    const w = pick(upgradable(b));
    return { title: '兵器升级', icon: weaponIcon(w.id), desc: `「${WEAPONS[w.id].name}」升一级`, apply: () => { w.lv = Math.min(MAX_WEAPON_LV, w.lv + 1); b.recalc(); } };
  } },
  { id: 'passive', tier: 2, w: 3, make: (b) => ({ title: '研习兵法', icon: 'p_book', desc: '随机一部兵法升一级', apply: () => { const r = upPassive(b, 1); b.hooks.banner(r.text, '#5fc8ff'); } }) },
  { id: 'coins', tier: 2, w: 3, make: (b) => { const n = 40 + ((Math.random() * 5) | 0) * 10; return { title: '金币袋', icon: 'gold', desc: `金币 +${n}`, apply: () => { b.coins += n; } }; } },
  { id: 'exp', tier: 2, w: 2, make: (b) => ({ title: '心有所悟', icon: 'gem1', desc: '获得半级经验', apply: () => b.gainExp((b.expNeed * 0.55) / b.expMul) }) },
  { id: 'heal', tier: 2, w: 2, cond: (b) => b.player.hp < b.player.maxHp * 0.85, make: (b) => ({ title: '妙手回春', icon: 'bun', desc: '生命回满', apply: () => { b.player.hp = b.player.maxHp; } }) },
  { id: 'magnet', tier: 2, w: 2, make: (b) => ({ title: '吸星', icon: 'magnet', desc: '吸走全场经验宝石', apply: () => { b.dropPickup('magnet', b.player.x, b.player.y, 1); } }) },
  { id: 'bomb', tier: 2, w: 2, make: (b) => ({ title: '震天雷', icon: 'bomb', desc: '轰平眼前的敌军', apply: () => { b.dropPickup('bomb', b.player.x, b.player.y, 1); } }) },
  { id: 'swift', tier: 2, w: 1.5, make: (b) => ({ title: '神行', icon: 'p_horseshoe', desc: '30 秒内移速 +50%', apply: () => timedBuff(b, 'swift', '神行', 30, true) }) },
  { id: 'haste', tier: 2, w: 1.5, make: (b) => ({ title: '疾风', icon: 'p_book', desc: '30 秒内冷却 -40%', apply: () => timedBuff(b, 'haste', '疾风', 30, true) }) },
  { id: 'goldrain', tier: 2, w: 1.5, make: (b) => ({ title: '金币风暴', icon: 'gold', desc: '30 秒内每个敌人都掉金币', apply: () => timedBuff(b, 'goldrain', '金币风暴', 30, true) }) },
  { id: 'wisdom', tier: 2, w: 1.5, make: (b) => ({ title: '悟道', icon: 'gem2', desc: '30 秒内经验 +60%', apply: () => timedBuff(b, 'wisdom', '悟道', 30, true) }) },
  { id: 'slowtime', tier: 2, w: 1.5, make: (b) => ({ title: '光阴凝滞', icon: 'p_seal', desc: '20 秒内敌人移速减半', apply: () => timedBuff(b, 'slowtime', '光阴凝滞', 20, true) }) },

  // —— 下签（都有补偿）——
  { id: 'horde', tier: 3, w: 3, make: (b) => ({ title: '怪潮来袭', icon: 'kills', desc: '30 秒内敌军暴增！\n扛过去送一只金宝箱', apply: () => {
    b.hooks.banner('怪潮来袭！', '#e43b44');
    timedBuff(b, 'horde', '怪潮', 30, false, () => { b.dropPickup('chest', b.player.x + 20, b.player.y, 1, true); b.hooks.banner('怪潮退去 · 天降金宝箱', '#fee761'); });
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

