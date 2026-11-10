import type { Battle, UltState } from './battle';
import type { HeroDef } from '../data/heroes';
import { Enemy, newProjectile } from './entities';
import { rand, TAU } from '../core/math';

// 1.1.0 新武将的二十个大招，外加数据化天赋里需要逐帧 / 按事件结算的部分（反震、击杀回血、大招留下的限时增益）。
// 大招期间武将本来就不受伤害（battle.hurtPlayer 里判断），所以「无敌 N 秒」的大招只要把持续时间设成 N 秒。

/** 大招留下的限时增益（大招结束后仍然生效，可以被打） */
export interface ExBuff {
  t: number;
  /** 伤害 +比例 */
  dmg?: number;
  /** 受伤倍率 */
  taken?: number;
  /** 冷却倍率 */
  cd?: number;
  /** 击杀回血（最大生命比例） */
  killHeal?: number;
  /** 环身光环：每 every 秒对半径 r 内敌人造成 mul 倍攻击 */
  aura?: { r: number; mul: number; every: number; acc: number; color: string; slow?: number };
}

interface Ring { r: number; hit: Set<number>; max: number; speed: number; dmg: number; boss: number; stun: number; knock: number }

const tmp: Enemy[] = [];
const SRC = { source: 'ultimate' as const, force: true };

function seen(b: Battle, e: Enemy, margin = 30) { return !e.dead && b.inView(e.x, e.y, margin); }

function stunAll(b: Battle, sec: number, bossSec: number) {
  for (const e of b.enemies) if (seen(b, e)) { e.slow = 1; e.slowT = Math.max(e.slowT, e.boss ? bossSec : sec); }
}

/** 全屏结算一次伤害，返回命中数 */
function hitAll(b: Battle, mul: number, bossMul: number, knock: number): number {
  const p = b.player;
  let n = 0;
  for (const e of b.enemies) {
    if (!seen(b, e)) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    b.damage(e, b.base.atk * (e.boss ? bossMul : mul), dx / d, dy / d, knock, SRC);
    n++;
  }
  return n;
}

function strongest(b: Battle, skip?: Set<number>): Enemy | null {
  let best: Enemy | null = null;
  for (const e of b.enemies) if (seen(b, e, 0) && !(skip && skip.has(e.uid)) && (!best || e.hp > best.hp)) best = e;
  return best;
}

function ring(u: UltState, max: number, time: number, dmg: number, boss: number, stun = 0, knock = 140) {
  (u.ex!.rings as Ring[]).push({ r: 0, hit: new Set(), max, speed: max / time, dmg, boss, stun, knock });
}

function updateRings(b: Battle, u: UltState, dt: number) {
  const p = b.player;
  for (const rg of u.ex!.rings as Ring[]) {
    if (rg.r > rg.max) continue;
    rg.r += rg.speed * dt;
    for (const e of b.enemies) {
      if (e.dead || rg.hit.has(e.uid)) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d > rg.r + e.r) continue;
      rg.hit.add(e.uid);
      b.damage(e, b.base.atk * (e.boss ? rg.boss : rg.dmg), dx / d, dy / d, rg.knock, SRC);
      if (rg.stun && !e.dead) { e.slow = 1; e.slowT = Math.max(e.slowT, e.boss ? rg.stun * 0.35 : rg.stun); }
    }
  }
}

function heal(b: Battle, ratio: number) {
  const p = b.player;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * ratio);
  b.fx.push({ kind: 'pillar', x: p.x, y: p.y, t: 0, dur: 0.6, w: 22, len: 160, color: '#9be37a', real: true });
}

function buff(b: Battle, x: ExBuff) { b.exBuff = x; b.recalc(); }

const SCREEN = (b: Battle) => Math.hypot(b.viewW, b.viewH) * 0.56;

/** 发动：返回 false 表示不是这里的大招 */
export function startUltEx(b: Battle, u: UltState, hero: HeroDef): boolean {
  const p = b.player, atk = b.base.atk, c = hero.color;
  u.ex = { rings: [] };
  switch (u.kind) {
    case 'oath': // 刘备：桃园结义
      u.slow = 0.25; u.dur = 1.5;
      heal(b, 0.3);
      for (const [id, dx] of [['guanyu', -26], ['zhangfei', 26]] as [string, number][]) b.fx.push({ kind: 'ghost', x: p.x + dx, y: p.y, t: 0, dur: 1.3, sprite: `hero_${id}_awk_${dx < 0 ? 4 : '4_L'}`, real: true });
      break;
    case 'bladestorm': u.slow = 1; u.dur = 4; break;
    case 'warlord': // 曹操：魏武挥鞭
      u.slow = 0.4; u.dur = 1.6;
      lanes(b, 8, 'u_tiger_cavalry', 9, false);
      buff(b, { t: 8, dmg: 0.4 });
      break;
    case 'guard': // 夏侯惇：刚烈无双
      u.slow = 0.25; u.dur = 1.0;
      buff(b, { t: 6, taken: 0.4, aura: { r: 52, mul: 1.5, every: 0.5, acc: 0, color: c } });
      break;
    case 'blitz': u.slow = 0.15; u.dur = 10 * 0.14 + 0.25; u.ex.hit = new Set<number>(); break;
    case 'berserk': // 许褚：裸衣死战
      u.slow = 1; u.dur = 7;
      buff(b, { t: 7, dmg: 0.7, cd: 0.5, killHeal: 0.01 });
      b.fx.push({ kind: 'pillar', x: p.x, y: p.y, t: 0, dur: 0.7, w: 30, len: 200, color: c, real: true });
      b.fx.push({ kind: 'text', x: p.x, y: p.y - 40, t: 0, dur: 0.8, text: hero.quote, color: '#ffd9a0' });
      break;
    case 'execute': // 司马懿：鹰视狼顾
      u.slow = 0.3; u.dur = 8 * 0.17 + 0.45;
      stunAll(b, 3, 1);
      hitAll(b, 3, 3, 0);
      b.fx.push({ kind: 'bagua', x: p.x, y: p.y, t: 0, dur: 1.6, r: 90, color: c, real: true });
      break;
    case 'raid': u.slow = 1; u.dur = 3; break;
    case 'frost': // 甄姬：洛神赋
      u.slow = 0.5; u.dur = 3;
      stunAll(b, 3.5, 1.2);
      hitAll(b, 5, 8, 0);
      for (let i = 0; i < 3; i++) b.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: -i * 0.12, dur: 0.7, r: SCREEN(b), w: 16, color: i === 1 ? '#ffffff' : c, real: true });
      b.burst(p.x, p.y - 8, 36, [c, '#ffffff', '#d8f4ff'], 240, 0.9);
      break;
    case 'quake': u.slow = 0.25; u.dur = 1.45; break;
    case 'firewall': u.slow = 0.3; u.dur = 1.75; u.ex.hit = new Set<number>(); u.x0 = p.x - b.viewW * 0.62; u.x1 = p.x + b.viewW * 0.62; break;
    case 'bells': u.slow = 0.6; u.dur = 1.6; break;
    case 'snipe': u.slow = 0.3; u.dur = 6 * 0.22 + 0.35; break;
    case 'wildfire': u.slow = 0.5; u.dur = 3; break;
    case 'petal': // 小乔：流风回雪
      u.slow = 0.5; u.dur = 0.6;
      heal(b, 0.25);
      buff(b, { t: 6, aura: { r: 64, mul: 1.8, every: 0.3, acc: 0, color: c, slow: 0.5 } });
      b.burst(p.x, p.y - 8, 30, [c, '#ffffff', '#fbe4dc'], 160, 0.9, 30);
      break;
    case 'charm': // 貂蝉：闭月倾城
      u.slow = 0.25; u.dur = 1.35;
      stunAll(b, 4, 1.5);
      break;
    case 'tyrant': { // 董卓：焚城
      u.slow = 0.2; u.dur = 0.9;
      const n = hitAll(b, 16, 26, 180);
      heal(b, Math.min(0.4, n * 0.015));
      b.shots.length = 0;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU, d = 70;
        b.pools.push({ source: 'ultimate', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.8, r: 34, dmg: atk * 0.6, tick: 0.3, tickT: 0, life: 4, maxLife: 4, slow: 0.3 });
        b.fx.push({ kind: 'explo', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.8, t: -i * 0.04, dur: 0.45 });
      }
      for (let i = 0; i < 3; i++) b.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: -i * 0.1, dur: 0.6, r: SCREEN(b), w: 22, color: i === 1 ? '#fee761' : '#e43b44', real: true });
      b.fx.push({ kind: 'rays', x: p.x, y: p.y - 8, t: 0, dur: 0.8, r: 240, color: '#f77622', real: true });
      b.burst(p.x, p.y, 44, ['#e43b44', '#f77622', '#fee761'], 280, 0.9);
      b.hooks.shake(10);
      b.hooks.sfx('explode');
      break;
    }
    case 'thunderrain': u.slow = 0.5; u.dur = 3.5; break;
    case 'panacea': // 华佗：青囊济世
      u.slow = 1; u.dur = 4;
      heal(b, 0.5);
      b.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: 0, dur: 0.7, r: SCREEN(b), w: 18, color: c, real: true });
      break;
    case 'vortex': // 左慈：奇门遁甲
      u.slow = 0.6; u.dur = 1.7;
      b.fx.push({ kind: 'bagua', x: p.x, y: p.y, t: 0, dur: 1.9, r: 110, color: c, real: true });
      break;
    default:
      return false;
  }
  return true;
}

/** 一排骑兵横冲（直冲 + 可选斜冲） */
function lanes(b: Battle, n: number, sprite: string, mul: number, diag: boolean) {
  const p = b.player, sp = 340;
  for (let i = 0; i < n; i++) {
    const pr = newProjectile('horse', 'ultimate');
    const dirX = i % 2 === 0 ? 1 : -1;
    if (!diag) {
      const lane = -b.viewH * 0.42 + (b.viewH * 0.84 * (i + 0.5)) / n;
      pr.x = p.x - dirX * (b.viewW / 2 + 24); pr.y = p.y + lane;
      pr.vx = dirX * sp; pr.vy = 0;
    } else {
      const dirY = i < n / 2 ? 0.7 : -0.7, dist = Math.hypot(b.viewW, b.viewH) / 2 + 20;
      pr.x = p.x - dirX * 0.7 * dist + rand(-40, 40); pr.y = p.y - dirY * dist + rand(-40, 40);
      pr.vx = dirX * 0.7 * sp; pr.vy = dirY * sp;
    }
    pr.left = dirX < 0;
    pr.dmg = b.base.atk * mul;
    pr.pierce = 9999; pr.knock = 130; pr.r = 22;
    pr.life = (Math.hypot(b.viewW, b.viewH) + 120) / sp + 0.4;
    pr.sprite = sprite;
    b.projs.push(pr);
  }
  b.hooks.shake(4);
  b.hooks.sfx('horse');
}

/** 每帧推进：返回世界时间倍率；null 表示不是这里的大招 */
export function updateUltEx(b: Battle, u: UltState, dt: number): number | null {
  if (!u.ex) return null;
  const p = b.player, atk = b.base.atk, hero = b.ultHero || b.hero, c = hero.color;
  const ex = u.ex;
  const every = (sec: number): boolean => { u.tickT -= dt; if (u.tickT > 0) return false; u.tickT += sec; return true; };
  const wave = (n: number, gap: number): boolean => { if (u.spawned < n && u.t >= u.spawned * gap) { u.spawned++; return true; } return false; };
  let scale = u.slow;
  switch (u.kind) {
    case 'oath': {
      const R = SCREEN(b);
      while (wave(3, 0.38)) {
        const k = u.spawned;
        const col = k === 1 ? '#63c74d' : k === 2 ? '#e43b44' : '#fee761';
        ring(u, R, 0.5, k === 2 ? 6 : 9, k === 2 ? 20 : 12, k === 2 ? 2 : 0);
        b.fx.push({ kind: 'shock', x: p.x, y: p.y - 6, t: 0, dur: 0.55, r: R * 0.8, w: 16, color: col, real: true });
        b.burst(p.x, p.y - 6, 18, [col, '#ffffff'], 220, 0.6);
        b.hooks.shake(k === 2 ? 8 : 5);
        b.hooks.sfx(k === 2 ? 'boss' : 'explode');
      }
      updateRings(b, u, dt);
      break;
    }
    case 'bladestorm': // 魏延：刀轮风暴（可移动）
      scale = 1;
      if (every(0.12)) {
        const R = 58;
        let hits = 0;
        b.grid.query(p.x, p.y, R + 16, tmp);
        for (const e of tmp) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d < R + e.r) { b.damage(e, atk * 2.4, dx / d, dy / d, 80, SRC); hits++; }
        }
        if (hits) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.004);
        b.hitBreakables(p.x, p.y, R);
        b.fx.push({ kind: 'slash', x: p.x, y: p.y - 6, t: 0, dur: 0.2, a: u.t * 14, r: R, w: Math.PI, color: u.spawned++ % 2 ? '#ff7a3d' : c });
        if (b.fx.length < 400) for (let i = 0; i < 4; i++) {
          const a = rand(TAU), rr = rand(20, 60);
          b.fx.push({ kind: 'particle', x: p.x + Math.cos(a) * rr, y: p.y - 6 + Math.sin(a) * rr * 0.8, t: 0, dur: 0.5, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 90 - 40, color: ['#e43b44', '#ff7a3d', '#fee761', '#ffffff'][i], r: 3.5, real: true });
        }
        b.hooks.sfx('thrust');
      }
      break;
    case 'warlord':
      if (u.t >= 0.6 && !ex.second) { ex.second = true; lanes(b, 6, 'u_tiger_cavalry', 9, true); b.fx.push({ kind: 'rays', x: p.x, y: p.y - 8, t: 0, dur: 0.7, r: 180, color: c, real: true }); }
      break;
    case 'guard': {
      const R = SCREEN(b);
      while (wave(2, 0.4)) {
        ring(u, R, 0.5, 8, 14, 2);
        b.fx.push({ kind: 'shock', x: p.x, y: p.y - 6, t: 0, dur: 0.55, r: R * 0.8, w: 18, color: u.spawned === 1 ? c : '#ffffff', real: true });
        b.burst(p.x, p.y - 6, 20, [c, '#ffffff', '#c0cbdc'], 230, 0.6);
        b.hooks.shake(6);
        b.hooks.sfx('explode');
      }
      updateRings(b, u, dt);
      break;
    }
    case 'blitz': // 张辽：连续闪击最强的敌人
      if (u.spawned < 10 && u.t >= u.spawned * 0.14) {
        u.spawned++;
        const hit = ex.hit as Set<number>;
        let t = strongest(b, hit);
        if (!t) { hit.clear(); t = strongest(b); }
        if (t) {
          hit.add(t.uid);
          const ox = p.x, oy = p.y;
          const a = rand(TAU);
          p.x = t.x + Math.cos(a) * 14; p.y = t.y + Math.sin(a) * 10;
          p.left = t.x < p.x;
          const len = Math.hypot(p.x - ox, p.y - oy);
          b.fx.push({ kind: 'beam', x: ox, y: oy - 8, t: 0, dur: 0.3, a: Math.atan2(p.y - oy, p.x - ox), len, w: 12 });
          b.fx.push({ kind: 'ghost', x: ox, y: oy, t: 0, dur: 0.3, sprite: `${b.heroSprite}_${Math.floor(p.anim) % 4}${p.left ? '_L' : ''}` });
          const R = 48;
          b.grid.query(p.x, p.y, R + 16, tmp);
          for (const e of tmp) {
            if (e.dead) continue;
            const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
            if (d < R + e.r) b.damage(e, atk * (e.boss ? 18 : 9), dx / d, dy / d, 110, SRC);
          }
          b.fx.push({ kind: 'slash', x: p.x, y: p.y - 6, t: 0, dur: 0.25, a: rand(TAU), r: R, w: Math.PI, color: u.spawned % 2 ? c : '#ffffff' });
          b.burst(p.x, p.y - 8, 8, [c, '#ffffff'], 150, 0.4);
          b.hooks.shake(3);
          b.hooks.sfx('thrust');
        }
      }
      break;
    case 'berserk':
      scale = 1;
      if (every(0.25)) {
        b.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.4, r: 34, color: c });
        if (b.fx.length < 400) for (let i = 0; i < 7; i++) b.fx.push({ kind: 'particle', x: p.x + rand(-18, 18), y: p.y + rand(-2, 4), t: 0, dur: 0.7, vx: rand(-12, 12), vy: rand(-110, -60), color: ['#feae34', '#f77622', '#fee761', '#ffffff'][i % 4], r: 4, real: true });
      }
      break;
    case 'execute':
      if (u.spawned < 8 && u.t >= 0.25 + u.spawned * 0.17) {
        u.spawned++;
        const t = strongest(b);
        if (t) {
          const x = t.x, y = t.y;
          b.fx.push({ kind: 'lightning', x: 0, y: 0, t: 0, dur: 0.3, pts: [x + rand(-14, 14), y - 150, x + rand(-8, 8), y - 80, x, y - 6], color: c, real: true });
          b.fx.push({ kind: 'pillar', x, y, t: 0, dur: 0.4, w: 16, len: 170, color: c, real: true });
          b.fx.push({ kind: 'shock', x, y: y - 4, t: 0, dur: 0.35, r: 54, w: 9, color: '#ffffff', real: true });
          b.damage(t, atk * (t.boss ? 26 : 12), 0, 1, 40, SRC);
          b.impact(x, y, 42, atk * 5, 60, 0, 'ultimate');
          b.hooks.shake(4);
          b.hooks.sfx('explode');
        }
      }
      break;
    case 'raid': // 夏侯渊：连珠疾射（可移动）
      scale = 1;
      if (every(0.1)) {
        const t = b.nearestEnemy(b.viewW * 0.6);
        const base = t ? Math.atan2(t.y - 6 - (p.y - 10), t.x - p.x) : Math.atan2(p.dirY, p.dirX);
        for (let k = -1; k <= 1; k++) {
          const a = base + k * 0.16 + rand(-0.04, 0.04);
          const pr = newProjectile('bolt', 'ultimate');
          pr.x = p.x; pr.y = p.y - 10;
          pr.vx = Math.cos(a) * 400; pr.vy = Math.sin(a) * 400;
          pr.rot = a; pr.dmg = atk * 3.2; pr.pierce = 6; pr.knock = 30; pr.r = 4; pr.life = 1;
          pr.sprite = 'bolt_evo'; pr.scale = 2;
          b.projs.push(pr);
        }
        if (u.spawned++ % 3 === 0) b.hooks.sfx('shoot');
        if (u.spawned % 5 === 0) b.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: 0, dur: 0.3, r: 40, w: 6, color: c, real: true });
      }
      break;
    case 'frost':
      if (every(0.25)) {
        for (let k = 0; k < 5; k++) {
          const e = b.randomVisibleEnemy();
          const x = e ? e.x + rand(-6, 6) : p.x + rand(-90, 90), y = e ? e.y + rand(-5, 5) : p.y + rand(-120, 120);
          b.fx.push({ kind: 'meteor', x, y, t: 0, dur: 0.2, color: c });
          b.later(0.2, () => {
            b.impact(x, y, 36, atk * 6, 40, 0.6, 'ultimate');
            b.fx.push({ kind: 'shock', x, y, t: 0, dur: 0.3, r: 44, w: 7, color: '#d8f4ff', real: true });
            b.burst(x, y - 4, 5, ['#ffffff', c], 110, 0.45);
          });
        }
        b.hooks.sfx('gem');
      }
      break;
    case 'quake': // 孙策：三记重击，一记比一记远
      while (wave(3, 0.45)) {
        const k = u.spawned;
        const R = k === 1 ? 90 : k === 2 ? 150 : SCREEN(b) * 1.1;
        for (const e of b.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d > R + e.r) continue;
          b.damage(e, atk * (e.boss ? 12 + k * 4 : 6 + k * 2), dx / d, dy / d, 120 + k * 30, SRC);
          if (!e.dead) { e.slow = 1; e.slowT = Math.max(e.slowT, e.boss ? 0.5 : 1.5); }
        }
        b.fx.push({ kind: 'shock', x: p.x, y: p.y - 4, t: 0, dur: 0.5, r: Math.min(R, SCREEN(b)), w: 14 + k * 4, color: k === 3 ? '#fee761' : c, real: true });
        b.fx.push({ kind: 'pillar', x: p.x, y: p.y, t: 0, dur: 0.5, w: 18 + k * 8, len: 180 + k * 30, color: c, real: true });
        b.fx.push({ kind: 'explo', x: p.x, y: p.y + 4, t: 0, dur: 0.4 });
        b.burst(p.x, p.y, 16 + k * 8, ['#c28569', '#e8b796', c], 200 + k * 40, 0.7);
        b.hooks.shake(4 + k * 2);
        b.hooks.vibrate(k === 3);
        b.hooks.sfx('explode');
        if (k === 3) b.shots.length = 0;
      }
      break;
    case 'firewall': { // 周瑜：火墙从屏幕一侧扫到另一侧
      const k = Math.min(1, u.t / (u.dur - 0.15));
      const x = u.x0 + (u.x1 - u.x0) * k;
      const hit = ex.hit as Set<number>;
      for (const e of b.enemies) {
        if (e.dead || hit.has(e.uid) || e.x > x + 14) continue;
        if (Math.abs(e.y - p.y) > b.viewH * 0.62 || e.x < u.x0 - 40) continue;
        hit.add(e.uid);
        b.damage(e, atk * (e.boss ? 34 : 22), 1, 0, 90, SRC);
      }
      if (every(0.05)) {
        for (let i = 0; i < 5; i++) {
          const y = p.y + rand(-0.5, 0.5) * b.viewH;
          if (b.fx.length < 400) b.fx.push({ kind: 'pillar', x: x + rand(-8, 8), y, t: 0, dur: 0.4, w: 14, len: rand(70, 130), color: i % 2 ? '#f77622' : '#fee761', real: true });
          if (b.fx.length < 400) b.fx.push({ kind: 'particle', x, y: y - 6, t: 0, dur: 0.6, vx: rand(20, 90), vy: rand(-90, -30), color: ['#e43b44', '#f77622', '#fee761'][i % 3], r: 3.5, real: true });
        }
        if (u.spawned++ % 4 === 0 && b.pools.length < 22) b.pools.push({ source: 'ultimate', x, y: p.y + rand(-0.4, 0.4) * b.viewH, r: 30, dmg: atk * 0.5, tick: 0.3, tickT: 0, life: 3.5, maxLife: 3.5, slow: 0.2 });
        if (u.spawned % 6 === 0) b.hooks.sfx('fire');
      }
      break;
    }
    case 'bells': // 甘宁：三轮飞刃往返
      while (wave(3, 0.5)) {
        const off = u.spawned * 0.22;
        for (let k = 0; k < 14; k++) {
          const a = off + (k / 14) * TAU;
          const pr = newProjectile('knife', 'ultimate');
          pr.x = p.x; pr.y = p.y - 8;
          pr.vx = Math.cos(a) * 300; pr.vy = Math.sin(a) * 300;
          pr.dmg = atk * 5; pr.pierce = 9999; pr.knock = 40; pr.r = 8;
          pr.dur = 0.5; pr.life = 2.6;
          pr.sprite = 'icon_w_jinfan';
          b.projs.push(pr);
        }
        b.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: 0, dur: 0.4, r: 80, w: 9, color: c, real: true });
        b.burst(p.x, p.y - 8, 10, [c, '#ffffff'], 160, 0.5);
        b.hooks.sfx('shoot');
      }
      break;
    case 'snipe': // 太史慈：六支裂地巨箭
      if (u.spawned < 6 && u.t >= 0.15 + u.spawned * 0.22) {
        u.spawned++;
        const t = strongest(b);
        if (t) {
          const a = Math.atan2(t.y - p.y, t.x - p.x), len = Math.hypot(t.x - p.x, t.y - p.y);
          b.fx.push({ kind: 'beam', x: p.x, y: p.y - 8, t: 0, dur: 0.35, a, len, w: 12 });
          const x = t.x, y = t.y;
          b.damage(t, atk * (t.boss ? 34 : 14), Math.cos(a), Math.sin(a), 150, SRC);
          b.impact(x, y, 52, atk * 6, 100, 0, 'ultimate');
          b.fx.push({ kind: 'explo', x, y, t: 0, dur: 0.4 });
          b.fx.push({ kind: 'shock', x, y: y - 6, t: 0, dur: 0.4, r: 64, w: 11, color: c, real: true });
          b.burst(x, y - 6, 12, ['#fee761', '#ffffff', c], 190, 0.6);
          b.hooks.shake(4);
          b.hooks.sfx('shoot');
          b.hooks.sfx('explode');
        }
      }
      break;
    case 'wildfire':
    case 'thunderrain': {
      const fire = u.kind === 'wildfire';
      if (every(fire ? 0.28 : 0.22)) {
        const n = fire ? 5 : 4;
        for (let k = 0; k < n; k++) {
          const e = b.randomVisibleEnemy();
          const x = e ? e.x + rand(-6, 6) : p.x + rand(-90, 90), y = e ? e.y + rand(-5, 5) : p.y + rand(-120, 120);
          if (fire) {
            b.fx.push({ kind: 'meteor', x, y, t: 0, dur: 0.22, color: '#ff9a4d' });
            b.later(0.22, () => {
              b.impact(x, y, 38, atk * 5.5, 60, 0, 'ultimate');
              b.fx.push({ kind: 'explo', x, y: y + 6, t: 0, dur: 0.35 });
              if (b.pools.length < 24) b.pools.push({ source: 'ultimate', x, y, r: 26, dmg: atk * 0.35, tick: 0.3, tickT: 0, life: 3, maxLife: 3, slow: 0 });
            });
          } else {
            b.fx.push({ kind: 'lightning', x: 0, y: 0, t: 0, dur: 0.28, pts: [x + rand(-16, 16), y - 150, x + rand(-8, 8), y - 70, x, y - 4], color: c, real: true });
            b.fx.push({ kind: 'shock', x, y: y - 2, t: 0, dur: 0.3, r: 40, w: 7, color: c, real: true });
            b.impact(x, y, 34, atk * 6, 50, 0.8, 'ultimate');
          }
        }
        b.hooks.sfx(fire ? 'fire' : 'explode');
        if (!fire && u.spawned++ % 3 === 0) b.hooks.shake(3);
      }
      break;
    }
    case 'charm': {
      const R = SCREEN(b);
      while (wave(3, 0.32)) {
        ring(u, R, 0.55, 7, 11, 0, 30);
        b.fx.push({ kind: 'shock', x: p.x, y: p.y - 6, t: 0, dur: 0.6, r: R * 0.8, w: 14, color: u.spawned === 2 ? '#ffffff' : c, real: true });
        b.burst(p.x, p.y - 6, 20, [c, '#ffffff', '#fbe4dc'], 200, 0.9, 40);
        b.hooks.sfx('gem');
      }
      updateRings(b, u, dt);
      break;
    }
    case 'panacea': // 华佗：药雾弥漫全场（可移动）
      scale = 1;
      if (every(0.4)) {
        let shown = 0;
        for (const e of b.enemies) {
          if (!seen(b, e)) continue;
          b.damage(e, atk * 1.6, 0, 0, 0, { source: 'ultimate', force: true, noCrit: true });
          if (shown++ < 16 && b.fx.length < 400) b.fx.push({ kind: 'particle', x: e.x + rand(-4, 4), y: e.y - 4, t: 0, dur: 0.6, vx: rand(-10, 10), vy: rand(-50, -20), color: shown % 2 ? c : '#b8ffcc', r: 3, real: true });
        }
        b.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.4, r: 40, color: c });
      }
      break;
    case 'vortex': { // 左慈：先吸后爆
      const pulling = u.t < u.dur - 0.25;
      if (pulling) {
        for (const e of b.enemies) {
          if (!seen(b, e, 60) || e.boss) continue;
          const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
          if (d > 26) { const v = Math.min(d - 24, 260 * dt / Math.max(0.2, u.slow)); e.x += (dx / d) * v; e.y += (dy / d) * v; }
        }
        if (every(0.2)) {
          hitAll(b, 1, 1, 0);
          const a = rand(TAU);
          if (b.fx.length < 400) for (let i = 0; i < 8; i++) { const aa = a + (i / 8) * TAU; b.fx.push({ kind: 'particle', x: p.x + Math.cos(aa) * 120, y: p.y - 6 + Math.sin(aa) * 90, t: 0, dur: 0.4, vx: -Math.cos(aa) * 260, vy: -Math.sin(aa) * 200, color: i % 2 ? c : '#ffffff', r: 3, real: true }); }
        }
      } else if (!ex.boom) {
        ex.boom = true;
        for (const e of b.enemies) {
          if (!seen(b, e, 60)) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d < 130 + e.r) b.damage(e, atk * (e.boss ? 34 : 24), dx / d, dy / d, 220, SRC);
        }
        b.shots.length = 0;
        b.fx.push({ kind: 'explo', x: p.x, y: p.y, t: 0, dur: 0.5 });
        b.fx.push({ kind: 'shock', x: p.x, y: p.y - 8, t: 0, dur: 0.7, r: 220, w: 22, color: c, real: true });
        b.fx.push({ kind: 'rays', x: p.x, y: p.y - 8, t: 0, dur: 0.9, r: 220, color: '#ffffff', real: true });
        b.fx.push({ kind: 'pillar', x: p.x, y: p.y, t: 0, dur: 0.8, w: 34, len: 240, color: c, real: true });
        b.burst(p.x, p.y - 8, 44, [c, '#ffffff', '#fee761'], 280, 0.9);
        b.hooks.shake(9);
        b.hooks.vibrate(true);
        b.hooks.sfx('explode');
      }
      break;
    }
  }
  if (u.t >= u.dur) b.ultEnd(u);
  return scale;
}

/** 每帧：限时增益倒计时与光环、击杀回血额度回满 */
export function tickEx(b: Battle, dt: number) {
  const tr = b.hero.traits;
  if (b.exThornCd > 0) b.exThornCd -= dt;
  const kh = (tr?.killHeal || 0) + (b.exBuff?.killHeal || 0);
  if (kh > 0) b.exHealPool = Math.min(b.player.maxHp * kh * 5, b.exHealPool + b.player.maxHp * kh * 5 * dt);
  const x = b.exBuff;
  if (!x) return;
  x.t -= dt;
  const p = b.player;
  if (x.aura && !b.dead) {
    x.aura.acc += dt;
    if (x.aura.acc >= x.aura.every) {
      x.aura.acc = 0;
      const R = x.aura.r;
      b.grid.query(p.x, p.y, R + 16, tmp);
      for (const e of tmp) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > R + e.r) continue;
        b.damage(e, b.base.atk * x.aura.mul, dx / d, dy / d, 20, { source: 'ultimate', noCrit: true });
        if (x.aura.slow && !e.dead && e.slow < 1) { e.slow = Math.max(e.slow, x.aura.slow * (e.boss ? 0.5 : 1)); e.slowT = Math.max(e.slowT, 0.6); }
      }
      b.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.35, r: R, color: x.aura.color });
      if (b.fx.length < 380) for (let i = 0; i < 4; i++) { const a = rand(TAU); b.fx.push({ kind: 'particle', x: p.x + Math.cos(a) * R * 0.8, y: p.y - 6 + Math.sin(a) * R * 0.6, t: 0, dur: 0.6, vx: -Math.sin(a) * 60, vy: Math.cos(a) * 40 - 20, color: i % 2 ? x.aura.color : '#ffffff', r: 3 }); }
    }
  }
  if (x.t <= 0) { b.exBuff = null; b.recalc(); }
}

/** 击败敌人：按天赋 / 增益回血（额度每秒回满，割草时不会瞬间回满血） */
export function onKillEx(b: Battle) {
  const kh = (b.hero.traits?.killHeal || 0) + (b.exBuff?.killHeal || 0);
  if (kh <= 0 || b.dead) return;
  const p = b.player;
  const v = Math.min(p.maxHp * kh, b.exHealPool);
  if (v <= 0) return;
  b.exHealPool -= v;
  p.hp = Math.min(p.maxHp, p.hp + v);
}

/** 武将受击：反震周围敌人（1 秒一次） */
export function onHurtEx(b: Battle) {
  const th = b.hero.traits?.thorns;
  if (!th || b.exThornCd > 0) return;
  b.exThornCd = 1;
  const p = b.player, R = 46;
  b.grid.query(p.x, p.y, R + 16, tmp);
  for (const e of tmp) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < R + e.r) b.damage(e, b.base.atk * th, dx / d, dy / d, 70, { source: 'other' });
  }
  b.fx.push({ kind: 'shock', x: p.x, y: p.y - 6, t: 0, dur: 0.3, r: R, w: 7, color: b.hero.color });
}
