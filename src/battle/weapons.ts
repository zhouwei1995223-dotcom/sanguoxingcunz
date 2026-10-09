import { WEAPONS, WeaponLevel } from '../data/skills';
import { rand, TAU } from '../core/math';
import type { Battle } from './battle';
import { Enemy, WeaponState, newProjectile } from './entities';

// 各武器的行为逻辑

export function levelData(w: WeaponState): WeaponLevel {
  const d = WEAPONS[w.id];
  return w.evo ? w.evoL || d.evo : d.levels[w.lv - 1];
}

/** 计入「舆图」数量加成后的数值 */
function withBonus(b: Battle, w: WeaponState): WeaponLevel {
  const L = levelData(w);
  return b.countBonus && WEAPONS[w.id].countable ? { ...L, count: L.count + b.countBonus } : L;
}

const near: Enemy[] = [];

export function updateWeapons(b: Battle, dt: number) {
  for (const w of b.weapons) {
    const L = withBonus(b, w);
    switch (w.id) {
      case 'spear': spear(b, w, L, dt); break;
      case 'sword': sword(b, w, L, dt); break;
      case 'crossbow': crossbow(b, w, L, dt); break;
      case 'horse': horse(b, w, L, dt); break;
      case 'fire': fire(b, w, L, dt); break;
      case 'aura': aura(b, w, L, dt); break;
      case 'blade': blade(b, w, L, dt); break;
      case 'snake': snake(b, w, L, dt); break;
      case 'fan': fan(b, w, L, dt); break;
      case 'halberd': halberd(b, w, L, dt); break;
      case 'knife': knife(b, w, L, dt); break;
      case 'thunder': thunder(b, w, L, dt); break;
      case 'rock': rock(b, w, L, dt); break;
      case 'drum': drum(b, w, L, dt); break;
      case 'catapult': catapult(b, w, L, dt); break;
      case 'caltrop': caltrop(b, w, L, dt); break;
    }
  }
}

function spear(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const len = L.area * b.areaMul;
  const width = 11 * Math.sqrt(b.areaMul) * (w.evo ? 1.3 : 1);
  let baseA: number;
  if (w.evo) {
    w.angle += 0.45;
    baseA = w.angle;
  } else {
    const t = b.nearestEnemy(len * 1.6);
    baseA = t ? Math.atan2(t.y - 4 * t.scale - (p.y - 8), t.x - p.x) : Math.atan2(p.dirY, p.dirX);
  }
  const offsets: number[] = [];
  if (L.count === 1) offsets.push(0);
  else if (L.count === 2) offsets.push(0, Math.PI);
  else if (L.count === 3) offsets.push(0, (TAU / 3), -(TAU / 3));
  else for (let i = 0; i < L.count; i++) offsets.push((i * TAU) / L.count);
  const dmg = L.dmg * b.base.atk;
  let hits = 0;
  for (const off of offsets) {
    const a = baseA + off;
    const ox = p.x, oy = p.y - 8;
    const dx = Math.cos(a), dy = Math.sin(a);
    b.fx.push({ kind: 'thrust', x: ox, y: oy, a, len, w: width, t: 0, dur: 0.2, color: w.evo ? '#fee761' : '#ffffff' });
    const mx = ox + dx * len / 2, my = oy + dy * len / 2;
    b.grid.query(mx, my, len / 2 + width + 16, near);
    for (const e of near) {
      if (e.dead) continue;
      const ex = e.x - ox, ey = e.y - 4 * e.scale - oy;
      const proj = ex * dx + ey * dy;
      if (proj < -e.r || proj > len + e.r) continue;
      const perp = Math.abs(ex * -dy + ey * dx);
      if (perp > width / 2 + e.r) continue;
      b.damage(e, dmg, dx, dy, L.knock || 0);
      if (hits++ < 8) b.fx.push({ kind: 'spark', x: e.x, y: e.y - 5 * e.scale, t: 0, dur: 0.18 });
    }
    // 可破坏物：沿枪身取样
    for (let s = 0.3; s <= 1; s += 0.35) b.hitBreakables(ox + dx * len * s, oy + dy * len * s, width / 2);
  }
  // 一枪捅穿多人：轻震屏 + 短暂顿帧
  if (hits >= 3) { b.hooks.shake(w.evo ? 2.5 : 1.5); b.addHitStop(0.03); }
  b.hooks.sfx('thrust');
}

function sword(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  const p = b.player;
  if (!w.evo) {
    if (w.active <= 0) {
      w.t -= dt;
      if (w.t <= 0) { w.active = (L.duration || 3) * b.durMul; w.t = L.cd * b.cdMul; }
      return;
    }
    w.active -= dt;
  } else w.active = 1;
  w.angle += (L.speed || 3.6) * dt;
  const R = L.area * b.areaMul;
  const dmg = L.dmg * b.base.atk;
  const hitR = 7 * Math.sqrt(b.areaMul);
  const now = b.t;
  for (let i = 0; i < L.count; i++) {
    const a = w.angle + (i * TAU) / L.count;
    const sx = p.x + Math.cos(a) * R, sy = p.y - 8 + Math.sin(a) * R * 0.85;
    b.grid.query(sx, sy, hitR + 16, near);
    for (const e of near) {
      if (e.dead) continue;
      if ((e.x - sx) ** 2 + (e.y - 4 * e.scale - sy) ** 2 > (hitR + e.r) ** 2) continue;
      if ((w.hits.get(e.uid) || 0) > now) continue;
      w.hits.set(e.uid, now + 0.45);
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      b.damage(e, dmg, dx / d, dy / d, L.knock || 0);
    }
    b.hitBreakables(sx, sy, hitR);
  }
  if (w.hits.size > 600) w.hits.clear();
}

function crossbow(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const dmg = L.dmg * b.base.atk;
  const ox = p.x, oy = p.y - 10;
  let targets: Enemy[];
  if (w.link && b.hero.id === 'lvbu') {
    // 辕门射戟：一支巨箭贯穿一线
    const t = b.nearestEnemy(b.viewW);
    const a = t ? Math.atan2(t.y - 4 * t.scale - oy, t.x - ox) : Math.atan2(b.player.dirY, b.player.dirX);
    const pr = newProjectile('bolt');
    pr.x = ox; pr.y = oy;
    pr.vx = Math.cos(a) * (L.speed || 380); pr.vy = Math.sin(a) * (L.speed || 380);
    pr.rot = a; pr.dmg = dmg; pr.pierce = 9999; pr.knock = 60; pr.r = 9; pr.life = 1.4;
    pr.sprite = 'bolt_evo'; pr.scale = 3;
    b.projs.push(pr);
    b.hooks.shake(1.5);
    b.hooks.sfx('shoot');
    return;
  }
  if (w.link && b.hero.id === 'zhuge') {
    // 元戎弩：一弩十矢，扇形齐射
    const t = b.nearestEnemy(b.viewW);
    const base = t ? Math.atan2(t.y - 4 * t.scale - oy, t.x - ox) : Math.atan2(b.player.dirY, b.player.dirX);
    for (let i = 0; i < L.count; i++) {
      const a = base + (i - (L.count - 1) / 2) * 0.11;
      const pr = newProjectile('bolt');
      pr.x = ox; pr.y = oy;
      pr.vx = Math.cos(a) * (L.speed || 320); pr.vy = Math.sin(a) * (L.speed || 320);
      pr.rot = a; pr.dmg = dmg; pr.pierce = L.pierce || 8; pr.knock = 10; pr.r = 3; pr.life = 1.4;
      pr.sprite = 'bolt_evo';
      b.projs.push(pr);
    }
    b.hooks.sfx('shoot');
    return;
  }
  if (w.evo) {
    // 随机射向附近的敌人
    const cands = b.enemies.filter((e) => !e.dead && b.inView(e.x, e.y, -10));
    if (!cands.length) return;
    cands.sort((a, c) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((c.x - p.x) ** 2 + (c.y - p.y) ** 2));
    targets = [cands[(Math.random() * Math.min(8, cands.length)) | 0]];
  } else {
    const cands = b.enemies.filter((e) => !e.dead && b.inView(e.x, e.y, -10));
    if (!cands.length) return;
    cands.sort((a, c) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((c.x - p.x) ** 2 + (c.y - p.y) ** 2));
    targets = [];
    for (let i = 0; i < L.count; i++) targets.push(cands[i % cands.length]);
  }
  targets.forEach((t, i) => {
    let a = Math.atan2(t.y - 4 * t.scale - oy, t.x - ox);
    if (i >= 1 && t === targets[0]) a += (i % 2 ? 1 : -1) * 0.12 * Math.ceil(i / 2);
    const pr = newProjectile('bolt');
    pr.x = ox; pr.y = oy;
    const sp = L.speed || 230;
    pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.rot = a;
    pr.dmg = dmg;
    pr.pierce = L.pierce || 1;
    pr.knock = 8;
    pr.r = 3;
    pr.life = 1.6;
    pr.sprite = w.evo ? 'bolt_evo' : 'bolt';
    b.projs.push(pr);
  });
  b.hooks.sfx('shoot');
}

function horse(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const dmg = L.dmg * b.base.atk;
  const sp = L.speed || 230;
  for (let i = 0; i < L.count; i++) {
    const pr = newProjectile('horse');
    let dirX = i % 2 === 0 ? 1 : -1, dirY = 0;
    if (w.evo && i >= 4) {
      // 进化后增加斜向冲锋
      dirX = i % 2 === 0 ? 0.7 : -0.7;
      dirY = i < 6 ? 0.7 : -0.7;
    }
    const span = b.viewH * 0.38;
    const lane = L.count === 1 ? rand(-20, 20) : -span + (2 * span * (i + 0.5)) / L.count + rand(-6, 6);
    const startDist = Math.hypot(b.viewW, b.viewH) / 2 + 20;
    if (dirY === 0) { pr.x = p.x - dirX * (b.viewW / 2 + 24); pr.y = p.y + lane; }
    else { pr.x = p.x - dirX * startDist * 0.7 + rand(-30, 30); pr.y = p.y - dirY * startDist * 0.7 + rand(-30, 30); }
    pr.vx = dirX * sp; pr.vy = dirY * sp;
    pr.left = dirX < 0;
    pr.dmg = dmg;
    pr.pierce = 9999;
    pr.knock = L.knock || 90;
    pr.r = L.area * Math.sqrt(b.areaMul);
    pr.life = (b.viewW + 100) / sp + 0.4;
    pr.sprite = 'u_baima';
    b.projs.push(pr);
  }
  b.hooks.shake(w.evo ? 3 : 2);
  b.hooks.sfx('horse');
}

function fire(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  for (let i = 0; i < L.count; i++) {
    const t = b.randomVisibleEnemy();
    const a = rand(TAU);
    const tx = t ? t.x + rand(-6, 6) : p.x + Math.cos(a) * rand(30, 80);
    const ty = t ? t.y + rand(-6, 6) : p.y + Math.sin(a) * rand(30, 80);
    const pr = newProjectile('pot');
    pr.x = p.x; pr.y = p.y - 10;
    pr.tx = tx; pr.ty = ty;
    pr.dur = 0.45 + i * 0.06;
    pr.vx = (tx - pr.x) / pr.dur;
    pr.vy = (ty - pr.y) / pr.dur;
    pr.area = L.area * b.areaMul;
    pr.burn = (L.duration || 2.5) * b.durMul;
    pr.tick = L.tick || 0.35;
    pr.dmg = L.dmg * b.base.atk;
    pr.slow = L.slow || 0;
    pr.life = 5;
    b.projs.push(pr);
  }
}

function aura(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.angle += dt * 2;
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.tick || 0.5;
  const p = b.player;
  const R = L.area * b.areaMul;
  const dmg = L.dmg * b.base.atk;
  b.grid.query(p.x, p.y, R + 16, near);
  for (const e of near) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > R + e.r) continue;
    if (L.slow) { e.slow = Math.max(e.slow, L.slow); e.slowT = 0.6; }
    b.damage(e, dmg, dx / (d || 1), dy / (d || 1), L.knock || 0, { noCrit: true });
  }
  b.hitBreakables(p.x, p.y, R * 0.8);
}

/** 扇形 / 圆形范围内伤害，返回命中数 */
function sweep(b: Battle, cx: number, cy: number, R: number, dir: number, arc: number, dmg: number, knock: number, stun = 0): number {
  let hits = 0;
  b.grid.query(cx, cy, R + 16, near);
  for (const e of near) {
    if (e.dead) continue;
    const dx = e.x - cx, dy = e.y - 4 * e.scale - cy;
    const d = Math.hypot(dx, dy) || 1;
    if (d > R + e.r || (!e.boss && !b.canHit(e))) continue;
    if (arc < Math.PI) {
      let da = Math.atan2(dy, dx) - dir;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      if (Math.abs(da) > arc + e.r / d) continue;
    }
    b.damage(e, dmg, dx / d, dy / d, knock);
    if (stun) { e.slow = 1; e.slowT = Math.max(e.slowT, e.boss ? stun * 0.3 : stun); }
    if (hits++ < 8) b.fx.push({ kind: 'spark', x: e.x, y: e.y - 5 * e.scale, t: 0, dur: 0.18 });
  }
  b.hitBreakables(cx + Math.cos(dir) * R * 0.6, cy + Math.sin(dir) * R * 0.6, R * 0.5);
  return hits;
}

/** 关羽：青龙偃月刀半月横扫 */
function blade(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const R = L.area * b.areaMul;
  const t = b.nearestEnemy(R * 1.6);
  const dir = t ? Math.atan2(t.y - 4 * t.scale - (p.y - 8), t.x - p.x) : Math.atan2(p.dirY, p.dirX);
  const arc = L.arc || 1.2;
  let hits = 0;
  for (let i = 0; i < L.count; i++) {
    const a = dir + i * Math.PI;
    hits += sweep(b, p.x, p.y - 8, R, a, arc, L.dmg * b.base.atk, L.knock || 80);
    b.fx.push({ kind: 'slash', x: p.x, y: p.y - 8, t: 0, dur: 0.25, a, r: R, w: arc, color: w.evo ? '#fee761' : '#63c74d' });
  }
  if (hits >= 3) { b.hooks.shake(w.evo ? 3 : 2); b.addHitStop(0.04); }
  b.hooks.sfx('thrust');
}

/** 张飞：丈八蛇矛周身横扫 + 眩晕 */
function snake(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const R = L.area * b.areaMul;
  w.angle += 2.1;
  const hits = sweep(b, p.x, p.y - 6, R, 0, Math.PI, L.dmg * b.base.atk, L.knock || 70, L.stun || 0);
  b.fx.push({ kind: 'slash', x: p.x, y: p.y - 6, t: 0, dur: 0.28, a: w.angle, r: R, w: Math.PI, color: w.evo ? '#fee761' : '#ff8a80' });
  if (w.evo) b.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.35, r: R * 1.4, color: '#ffffff' });
  if (hits >= 3) { b.hooks.shake(w.evo ? 3 : 2); b.addHitStop(0.04); }
  b.hooks.sfx('thrust');
}

/** 诸葛亮：羽扇追踪风刃 */
function fan(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const t = b.nearestEnemy(150);
  const base = t ? Math.atan2(t.y - (p.y - 10), t.x - p.x) : Math.atan2(p.dirY, p.dirX);
  for (let i = 0; i < L.count; i++) {
    const a = w.evo ? base + (i / L.count) * TAU : base + (i - (L.count - 1) / 2) * 0.35;
    const pr = newProjectile('wind');
    pr.x = p.x; pr.y = p.y - 10;
    const sp = L.speed || 160;
    pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.rot = a;
    pr.dmg = L.dmg * b.base.atk;
    pr.pierce = L.pierce || 2;
    pr.knock = L.knock || 10;
    pr.r = 5 * Math.sqrt(b.areaMul);
    pr.life = 1.6;
    pr.t = 0.15;
    b.projs.push(pr);
  }
  b.hooks.sfx('shoot');
}

/** 吕布：方天画戟旋风斩 */
function halberd(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  const p = b.player;
  if (!w.evo) {
    if (w.active <= 0) {
      w.t -= dt;
      if (w.t <= 0) { w.active = (L.duration || 1) * b.durMul; w.t = L.cd * b.cdMul; }
      return;
    }
    w.active -= dt;
  } else w.active = 1;
  w.angle += dt * 16;
  w.burst -= dt;
  if (w.burst > 0) return;
  w.burst = L.tick || 0.2;
  const R = L.area * b.areaMul;
  const hits = sweep(b, p.x, p.y - 6, R, 0, Math.PI, L.dmg * b.base.atk, L.knock || 40);
  if (hits >= 4 && Math.random() < 0.4) b.hooks.shake(1.2);
  b.hooks.sfx('thrust');
}


/** 回旋飞刀：飞出后折返，往返都能伤害 */
function knife(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const t = b.nearestEnemy(L.area * 1.5);
  const base = t ? Math.atan2(t.y - 4 * t.scale - (p.y - 8), t.x - p.x) : Math.atan2(p.dirY, p.dirX);
  const sp = L.speed || 200;
  const range = L.area * Math.sqrt(b.areaMul);
  for (let i = 0; i < L.count; i++) {
    const a = w.evo ? base + (i / L.count) * TAU : base + (i - (L.count - 1) / 2) * 0.32;
    const pr = newProjectile('knife');
    pr.x = p.x; pr.y = p.y - 8;
    pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.dmg = L.dmg * b.base.atk;
    pr.pierce = 9999;
    pr.knock = L.knock || 15;
    pr.r = 6 * Math.sqrt(b.areaMul);
    pr.dur = range / sp;
    pr.life = pr.dur * 2 + 1.5;
    b.projs.push(pr);
  }
  b.hooks.sfx('shoot');
}

/** 天雷：劈中一名敌人后连锁跳跃 */
function thunder(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const hit = new Set<number>();
  const dmg = L.dmg * b.base.atk;
  const jump = L.area * Math.sqrt(b.areaMul);
  let strikes = 0;
  for (let s = 0; s < L.count; s++) {
    let cur = b.randomVisibleEnemy();
    if (!cur || hit.has(cur.uid)) cur = b.randomVisibleEnemy();
    if (!cur || hit.has(cur.uid)) continue;
    strikes++;
    const pts = [cur.x + rand(-8, 8), cur.y - 110];
    for (let c = 0; c <= (L.pierce || 3) && cur; c++) {
      hit.add(cur.uid);
      pts.push(cur.x, cur.y - 6 * cur.scale);
      b.damage(cur, dmg, 0, 0, 0);
      if (L.stun && !cur.dead) { cur.slow = 1; cur.slowT = Math.max(cur.slowT, cur.boss ? L.stun * 0.3 : L.stun); }
      b.grid.query(cur.x, cur.y, jump, near);
      let next: Enemy | null = null, bd = jump * jump;
      for (const e of near) {
        if (e.dead || hit.has(e.uid) || (!e.boss && !b.canHit(e))) continue;
        const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
        if (d < bd) { bd = d; next = e; }
      }
      cur = next;
    }
    b.fx.push({ kind: 'lightning', x: 0, y: 0, t: 0, dur: 0.28, pts, color: w.evo ? '#fee761' : '#8be9ff' });
  }
  if (strikes) { b.hooks.shake(w.evo ? 2 : 1); b.hooks.sfx('explode'); }
}

/** 滚木礌石：从天而降砸向敌群 */
function rock(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  for (let i = 0; i < L.count; i++) {
    const t = b.randomVisibleEnemy();
    const a = rand(TAU);
    const pr = newProjectile('rock');
    pr.tx = t ? t.x + rand(-8, 8) : p.x + Math.cos(a) * rand(30, 90);
    pr.ty = t ? t.y + rand(-6, 6) : p.y + Math.sin(a) * rand(30, 90);
    pr.x = pr.tx; pr.y = pr.ty;
    pr.dur = 0.5 + i * 0.07;
    pr.area = L.area * b.areaMul;
    pr.dmg = L.dmg * b.base.atk;
    pr.knock = L.knock || 50;
    pr.stun = L.stun || 0;
    pr.life = 3;
    pr.scale = w.evo ? 3 : 2;
    b.projs.push(pr);
  }
}

/** 霹雳车：远抛巨石，大范围爆炸 */
function catapult(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  // 优先砸远处的敌群
  const vis = b.enemies.filter((e) => !e.dead && b.inView(e.x, e.y, -24));
  vis.sort((a, c) => (c.x - p.x) ** 2 + (c.y - p.y) ** 2 - ((a.x - p.x) ** 2 + (a.y - p.y) ** 2));
  for (let i = 0; i < L.count; i++) {
    const t = vis.length ? vis[Math.floor(Math.random() * Math.min(vis.length, 12))] : null;
    const a = rand(TAU);
    const pr = newProjectile('boulder');
    pr.x = p.x; pr.y = p.y - 10;
    pr.tx = t ? t.x : p.x + Math.cos(a) * 90;
    pr.ty = t ? t.y : p.y + Math.sin(a) * 90;
    pr.dur = 0.8 + i * 0.1;
    pr.vx = (pr.tx - pr.x) / pr.dur;
    pr.vy = (pr.ty - pr.y) / pr.dur;
    pr.area = L.area * b.areaMul;
    pr.dmg = L.dmg * b.base.atk;
    pr.knock = L.knock || 90;
    pr.second = w.evo;
    pr.scale = w.link ? 4 : 3;
    pr.life = 3;
    b.projs.push(pr);
  }
  b.hooks.sfx('horse');
}

/** 战鼓：冲击波击退周围敌人 */
function drum(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  const p = b.player;
  if (w.burst > 0) {
    w.active -= dt;
    if (w.active > 0) return;
    w.burst--;
    w.active = 0.28;
    const R = L.area * b.areaMul;
    const hits = sweep(b, p.x, p.y - 6, R, 0, Math.PI, L.dmg * b.base.atk, L.knock || 120, L.stun || 0);
    b.fx.push({ kind: 'drum', x: p.x, y: p.y - 6, t: 0, dur: 0.4, r: R, color: w.link ? (b.hero.id === 'guanyu' ? '#63c74d' : '#ff8a80') : w.evo ? '#fee761' : '#feae34' });
    if (w.link && b.hero.id === 'guanyu') {
      // 温酒斩华雄：四道青龙刀气
      const R2 = R * 1.5;
      for (let i = 0; i < 4; i++) {
        const a = w.angle + (i * Math.PI) / 2;
        sweep(b, p.x, p.y - 8, R2, a, 0.45, L.dmg * b.base.atk * 1.3, 90);
        b.fx.push({ kind: 'slash', x: p.x, y: p.y - 8, t: 0, dur: 0.3, a, r: R2, w: 0.45, color: '#63c74d' });
      }
      w.angle += Math.PI / 4;
    }
    if (hits >= 3) b.hooks.shake(w.evo ? 2.5 : 1.5);
    b.hooks.sfx('boss');
    return;
  }
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  w.burst = L.count;
  w.active = 0;
}

/** 铁蒺藜：在身后撒下减速陷阱 */
function caltrop(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  w.t -= dt;
  if (w.t > 0) return;
  w.t = L.cd * b.cdMul;
  const p = b.player;
  const life = (L.duration || 4) * b.durMul;
  // 同时存在的铁蒺藜有上限，避免越叠越多
  const max = w.evo ? 8 : 2 + w.lv;
  const mine = b.pools.filter((f) => f.kind === 'caltrop');
  if (mine.length >= max) b.pools.splice(b.pools.indexOf(mine[0]), 1);
  b.pools.push({
    kind: 'caltrop', x: p.x - p.dirX * 10 + rand(-4, 4), y: p.y - p.dirY * 8 + rand(-3, 3), r: L.area * b.areaMul,
    dmg: L.dmg * b.base.atk, tick: L.tick || 0.4, tickT: 0, life, maxLife: life, slow: L.slow || 0.3,
  });
}
