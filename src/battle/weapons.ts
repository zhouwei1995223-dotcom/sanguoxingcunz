import { WEAPONS, WeaponLevel } from '../data/skills';
import { rand, TAU } from '../core/math';
import type { Battle } from './battle';
import { Enemy, WeaponState, newProjectile } from './entities';

// 各武器的行为逻辑

export function levelData(w: WeaponState): WeaponLevel {
  const d = WEAPONS[w.id];
  return w.evo ? d.evo : d.levels[w.lv - 1];
}

const near: Enemy[] = [];

export function updateWeapons(b: Battle, dt: number) {
  for (const w of b.weapons) {
    const L = levelData(w);
    switch (w.id) {
      case 'spear': spear(b, w, L, dt); break;
      case 'sword': sword(b, w, L, dt); break;
      case 'crossbow': crossbow(b, w, L, dt); break;
      case 'horse': horse(b, w, L, dt); break;
      case 'fire': fire(b, w, L, dt); break;
      case 'aura': aura(b, w, L, dt); break;
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
    }
    // 可破坏物：沿枪身取样
    for (let s = 0.3; s <= 1; s += 0.35) b.hitBreakables(ox + dx * len * s, oy + dy * len * s, width / 2);
  }
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
  if (w.evo) {
    // 随机射向附近的敌人
    const cands = b.enemies.filter((e) => !e.dead && Math.abs(e.x - p.x) < b.viewW * 0.55 && Math.abs(e.y - p.y) < b.viewH * 0.55);
    if (!cands.length) return;
    cands.sort((a, c) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((c.x - p.x) ** 2 + (c.y - p.y) ** 2));
    targets = [cands[(Math.random() * Math.min(8, cands.length)) | 0]];
  } else {
    const cands = b.enemies.filter((e) => !e.dead && Math.abs(e.x - p.x) < b.viewW * 0.6 && Math.abs(e.y - p.y) < b.viewH * 0.6);
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
