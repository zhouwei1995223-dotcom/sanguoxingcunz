import { WEAPONS, WeaponLevel } from '../data/skills';
import type { ExStyle } from '../data/skills2';
import { rand, TAU } from '../core/math';
import type { Battle } from './battle';
import { Enemy, WeaponState, newProjectile } from './entities';
import { sweep } from './weapons';

// 1.1.0 新武将专属兵器的行为：十二种出手方式（突刺 / 横扫 / 回旋 / 环身 / 射击 / 投掷 / 砸地 / 连锁雷 / 落符 / 水波 / 弹射 / 回旋镖），
// 每件兵器在 data/skills2.ts 里选一种方式、配上颜色和附加效果。数值含义与老兵器一致。

const near: Enemy[] = [];

/** 返回 true 表示这件兵器由这里处理 */
export function updateExWeapon(b: Battle, w: WeaponState, L: WeaponLevel, dt: number): boolean {
  const st = WEAPONS[w.id].style;
  if (!st) return false;
  switch (st.mode) {
    case 'orbit': orbit(b, w, L, dt); return true;
    case 'spin': spin(b, w, L, dt, st); return true;
  }
  w.t -= dt;
  if (w.t > 0) return true;
  w.t = L.cd * b.cdMul;
  switch (st.mode) {
    case 'thrust': thrust(b, w, L, st); break;
    case 'sweep': sweepCut(b, w, L, st); break;
    case 'shot': shot(b, w, L, st); break;
    case 'lob': lob(b, w, L, st); break;
    case 'slam': slam(b, w, L, st); break;
    case 'chain': chain(b, w, L, st); break;
    case 'pillar': pillar(b, w, L, st); break;
    case 'pulse': pulse(b, w, L, st); break;
    case 'bounce': bounce(b, w, L, st); break;
    case 'boomerang': boomerang(b, w, L, st); break;
  }
  return true;
}

const col = (w: WeaponState, st: ExStyle) => (w.evo ? st.evoColor : st.color);

function heal(b: Battle, st: ExStyle, w: WeaponState) {
  if (!st.heal || b.dead) return;
  const p = b.player;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * st.heal * (w.evo ? 2 : 1));
}

function aimNearest(b: Battle, range: number): number {
  const p = b.player;
  const t = b.nearestEnemy(range);
  return t ? Math.atan2(t.y - 4 * t.scale - (p.y - 8), t.x - p.x) : Math.atan2(p.dirY, p.dirX);
}

/** 突刺：朝最近的敌人扇形刺出 count 路，贯穿一线 */
function thrust(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  const len = L.area * b.areaMul;
  const wide = L.count <= 2 || w.id === 'goulian';
  const width = (wide ? 17 : 12) * Math.sqrt(b.areaMul) * (w.evo ? 1.25 : 1);
  const baseA = aimNearest(b, len * 1.1);
  const dmg = L.dmg * b.base.atk;
  let hits = 0;
  for (let i = 0; i < L.count; i++) {
    const a = baseA + (i - (L.count - 1) / 2) * (wide ? 0.3 : 0.36);
    const ox = p.x, oy = p.y - 8;
    const dx = Math.cos(a), dy = Math.sin(a);
    b.fx.push({ kind: 'thrust', x: ox, y: oy, a, len, w: width, t: 0, dur: 0.22, color: col(w, st) });
    b.grid.query(ox + dx * len / 2, oy + dy * len / 2, len / 2 + width + 16, near);
    for (const e of near) {
      if (e.dead) continue;
      const ex = e.x - ox, ey = e.y - 4 * e.scale - oy;
      const proj = ex * dx + ey * dy;
      if (proj < -e.r || proj > len + e.r) continue;
      if (Math.abs(ex * -dy + ey * dx) > width / 2 + e.r) continue;
      b.damage(e, dmg, dx, dy, L.knock || 0, { source: w.id });
      if (hits++ < 8) b.fx.push({ kind: 'spark', x: e.x, y: e.y - 5 * e.scale, t: 0, dur: 0.18 });
    }
    for (let s = 0.3; s <= 1; s += 0.35) b.hitBreakables(ox + dx * len * s, oy + dy * len * s, width / 2);
  }
  if (hits >= 3) b.addHitStop(0.03);
  b.hooks.sfx('thrust');
}

/** 横扫：朝最近的敌人半月横劈（count 2 时身后再劈一刀）；可带剑气、震晕、点燃地面 */
function sweepCut(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  const R = L.area * b.areaMul;
  const dir = aimNearest(b, R * 1.2);
  const arc = L.arc || 1.2;
  const atk = b.base.atk;
  let hits = 0;
  for (let i = 0; i < L.count; i++) {
    const a = dir + i * Math.PI;
    hits += sweep(b, w.id, p.x, p.y - 8, R, a, arc, L.dmg * atk, L.knock || 80, L.stun || 0);
    b.fx.push({ kind: 'slash', x: p.x, y: p.y - 8, t: 0, dur: 0.26, a, r: R, w: arc, color: col(w, st) });
    if (st.wave) {
      // 剑气：贯穿敌阵的飞剑
      const n = w.evo ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const wa = a + (k - (n - 1) / 2) * 0.34;
        const pr = newProjectile('bolt', w.id);
        pr.x = p.x; pr.y = p.y - 10;
        const sp = L.speed || 300;
        pr.vx = Math.cos(wa) * sp; pr.vy = Math.sin(wa) * sp;
        pr.rot = wa + Math.PI / 2; pr.dmg = L.dmg * atk * 0.6; pr.pierce = L.pierce || 5; pr.knock = 20;
        pr.r = 6 * Math.sqrt(b.areaMul); pr.life = 1.1;
        pr.sprite = st.sprite || 'fsword'; pr.scale = w.evo ? 2 : 1;
        b.projs.push(pr);
      }
    }
    if (st.evoBurn && w.evo && b.pools.length < 18) {
      b.pools.push({ source: w.id, x: p.x + Math.cos(a) * R * 0.6, y: p.y + Math.sin(a) * R * 0.6, r: R * 0.5, dmg: atk * 0.36, tick: 0.35, tickT: 0, life: 2.4 * b.durMul, maxLife: 2.4 * b.durMul, slow: 0 });
    }
  }
  if (hits) heal(b, st, w);
  if (hits >= 3) b.addHitStop(0.04);
  b.hooks.sfx('thrust');
}

/** 回旋：冷却到了连斩 count 刀，每刀都是一整圈 */
function spin(b: Battle, w: WeaponState, L: WeaponLevel, dt: number, st: ExStyle) {
  if (w.active <= 0) {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = L.cd * b.cdMul;
    w.active = L.count;
    w.burst = 0;
  }
  w.burst -= dt;
  if (w.burst > 0) return;
  w.burst = 0.17;
  w.active -= 1;
  const p = b.player;
  const R = L.area * b.areaMul;
  w.angle += 2.1;
  const hits = sweep(b, w.id, p.x, p.y - 6, R, 0, Math.PI, L.dmg * b.base.atk, L.knock || 60, L.stun || 0);
  b.fx.push({ kind: 'slash', x: p.x, y: p.y - 6, t: 0, dur: 0.26, a: w.angle, r: R, w: Math.PI, color: col(w, st) });
  if (hits) heal(b, st, w);
  if (hits >= 3) b.addHitStop(0.03);
  b.hooks.sfx('thrust');
}

/** 环身：count 个物件绕身飞旋（贴图在 render.ts 里按 style.sprite 画） */
function orbit(b: Battle, w: WeaponState, L: WeaponLevel, dt: number) {
  const p = b.player;
  if (!w.evo || L.cd > 0) {
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
      b.damage(e, dmg, dx / d, dy / d, L.knock || 0, { source: w.id });
    }
    b.hitBreakables(sx, sy, hitR);
  }
  if (w.hits.size > 600) w.hits.clear();
}

/** 射击：near 朝最近的敌人扇射；strong 专射血最多的；可带命中爆裂 */
function shot(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  const ox = p.x, oy = p.y - 10;
  const atk = b.base.atk;
  let cands: Enemy[] = [];
  if (st.target === 'strong') {
    cands = b.enemies.filter((e) => !e.dead && b.inView(e.x, e.y, -28));
    if (!cands.length) { w.t = 0.2; return; }
    cands.sort((a, c) => c.hp - a.hp);
  }
  const base = st.target === 'strong' ? 0 : aimNearest(b, b.viewW * 0.55);
  for (let i = 0; i < L.count; i++) {
    let a: number;
    if (st.target === 'strong') {
      const t = cands[i % cands.length];
      a = Math.atan2(t.y - 4 * t.scale - oy, t.x - ox) + (i >= cands.length ? (i % 2 ? 0.1 : -0.1) : 0);
    } else a = base + (i - (L.count - 1) / 2) * 0.15;
    const pr = newProjectile('bolt', w.id);
    pr.x = ox; pr.y = oy;
    const sp = L.speed || 320;
    pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.rot = a; pr.dmg = L.dmg * atk; pr.pierce = L.pierce || 1; pr.knock = L.knock || 10;
    pr.r = st.splash ? 5 : 3.5; pr.life = 1.5;
    pr.sprite = w.evo ? 'bolt_evo' : st.sprite || 'bolt';
    pr.scale = st.splash ? (w.evo ? 3 : 2) : w.evo ? 2 : 1;
    if (st.splash) pr.splash = st.splash * (w.evo ? 1.5 : 1) * b.areaMul;
    b.projs.push(pr);
  }
  b.hooks.sfx('shoot');
}

/** 投掷：抛向敌群，落地爆开并留下火海 / 药雾 */
function lob(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  for (let i = 0; i < L.count; i++) {
    const t = b.randomVisibleEnemy();
    const a = rand(TAU);
    const tx = t ? t.x + rand(-6, 6) : p.x + Math.cos(a) * rand(30, 80);
    const ty = t ? t.y + rand(-6, 6) : p.y + Math.sin(a) * rand(30, 80);
    const pr = newProjectile('pot', w.id);
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
    if (st.pool === 'poison') pr.color = col(w, st);
    b.projs.push(pr);
  }
  heal(b, st, w);
}

/** 砸地：砸向最近的敌人脚下，震晕落点一片；count 多时依次砸向不同敌人 */
function slam(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  const R = L.area * b.areaMul;
  const reach = 46 + R * 0.5;
  const cands = b.grid.query(p.x, p.y, reach + 30, near).filter((e) => !e.dead && b.canHit(e));
  cands.sort((a, c) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((c.x - p.x) ** 2 + (c.y - p.y) ** 2));
  const base = Math.atan2(p.dirY, p.dirX);
  const targets: [number, number][] = [];
  for (let i = 0; i < L.count; i++) {
    const e = cands[Math.min(cands.length - 1, i * 3)];
    if (e && i * 3 < cands.length + 2) {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, reach / d);
      targets.push([p.x + dx * k, p.y + dy * k]);
    } else {
      const a = base + i * (TAU / Math.max(1, L.count));
      targets.push([p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30]);
    }
  }
  const c = col(w, st);
  targets.forEach(([x, y], i) => {
    const go = () => {
      b.impact(x, y, R, L.dmg * b.base.atk, L.knock || 100, L.stun || 0, w.id);
      b.fx.push({ kind: 'explo', x, y: y + 6, t: 0, dur: 0.35 });
      b.fx.push({ kind: 'shock', x, y: y - 2, t: 0, dur: 0.35, r: R * 1.25, w: 9, color: c });
      b.fx.push({ kind: 'ring', x, y, t: 0, dur: 0.3, r: R * 1.1, color: c });
      b.hooks.sfx('explode');
    };
    if (i === 0) go(); else b.later(i * 0.16, go);
  });
  b.addHitStop(0.03);
}

/** 连锁雷：落向随机敌人，再在敌群里跳 pierce 次 */
function chain(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
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
      b.damage(cur, dmg, 0, 0, 0, { source: w.id });
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
    b.fx.push({ kind: 'lightning', x: 0, y: 0, t: 0, dur: 0.3, pts, color: col(w, st) });
  }
  if (strikes) b.hooks.sfx('explode');
}

/** 落符：光柱 / 八卦阵落在随机敌人脚下，稍后引爆一片 */
function pillar(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  const R = L.area * b.areaMul;
  const c = col(w, st);
  for (let i = 0; i < L.count; i++) {
    const t = b.randomVisibleEnemy();
    const a = rand(TAU);
    const x = t ? t.x + rand(-5, 5) : p.x + Math.cos(a) * rand(30, 80);
    const y = t ? t.y + rand(-4, 4) : p.y + Math.sin(a) * rand(30, 80);
    const delay = st.fx === 'bagua' ? 0.4 : 0.14 + i * 0.05;
    if (st.fx === 'bagua') b.fx.push({ kind: 'bagua', x, y, t: 0, dur: 0.7, r: R * 1.05, color: c });
    else b.fx.push({ kind: 'pillar', x, y, t: -i * 0.05, dur: 0.4, w: Math.max(8, R * 0.5), len: 150, color: c });
    b.later(delay, () => {
      b.impact(x, y, R, L.dmg * b.base.atk, L.knock || 40, L.stun || 0, w.id);
      b.fx.push({ kind: 'shock', x, y: y - 2, t: 0, dur: 0.3, r: R * 1.2, w: 7, color: c });
      if (st.fx === 'bagua') b.fx.push({ kind: 'explo', x, y: y + 6, t: 0, dur: 0.35 });
    });
  }
  b.hooks.sfx(st.fx === 'bagua' ? 'evolve' : 'explode');
}

/** 水波：从身上荡开一圈，伤害、减速（进化后冻结），count 2 时紧跟第二圈更大的 */
function pulse(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const c = col(w, st);
  const ring = (k: number) => {
    const p = b.player;
    const R = L.area * b.areaMul * k;
    b.grid.query(p.x, p.y, R + 16, near);
    for (const e of near) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R + e.r || (!e.boss && !b.canHit(e))) continue;
      b.damage(e, L.dmg * b.base.atk, dx / d, dy / d, L.knock || 0, { source: w.id });
      if (e.dead) continue;
      if (L.stun) { e.slow = 1; e.slowT = Math.max(e.slowT, e.boss ? L.stun * 0.3 : L.stun); }
      else if (L.slow && e.slow < 1) { e.slow = Math.max(e.slow, L.slow * (e.boss ? 0.5 : 1)); e.slowT = Math.max(e.slowT, (L.duration || 1.5) * b.durMul); }
    }
    b.hitBreakables(p.x, p.y, R * 0.8);
    b.fx.push({ kind: 'shock', x: p.x, y: p.y - 6, t: 0, dur: 0.4, r: R, w: 8, color: c });
    b.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.35, r: R * 0.8, color: '#ffffff' });
  };
  ring(1);
  for (let i = 1; i < L.count; i++) b.later(i * 0.28, () => ring(1 + i * 0.22));
  b.hooks.sfx('gem');
}

/** 弹射：在敌人之间来回弹，可附带减速 / 失神 */
function bounce(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  const dmg = L.dmg * b.base.atk;
  const jump = L.area * Math.sqrt(b.areaMul);
  const hit = new Set<number>();
  const c = col(w, st);
  let thrown = 0;
  for (let s = 0; s < L.count; s++) {
    let cur = s === 0 ? b.nearestEnemy(b.viewW * 0.42) : b.randomVisibleEnemy();
    if (!cur || hit.has(cur.uid)) cur = b.randomVisibleEnemy();
    if (!cur || hit.has(cur.uid)) continue;
    thrown++;
    const pts = [p.x, p.y - 10];
    for (let k = 0; k < (L.pierce || 4) && cur; k++) {
      hit.add(cur.uid);
      pts.push(cur.x, cur.y - 6 * cur.scale);
      const dx = cur.x - pts[pts.length - 4], dy = cur.y - pts[pts.length - 3];
      const d = Math.hypot(dx, dy) || 1;
      b.damage(cur, dmg, dx / d, dy / d, L.knock || 0, { source: w.id });
      if (!cur.dead) {
        if (L.stun) { cur.slow = 1; cur.slowT = Math.max(cur.slowT, cur.boss ? L.stun * 0.3 : L.stun); }
        else if (L.slow && cur.slow < 1) { cur.slow = Math.max(cur.slow, L.slow * (cur.boss ? 0.5 : 1)); cur.slowT = Math.max(cur.slowT, (L.duration || 1.5) * b.durMul); }
      }
      if (k < 4) b.fx.push({ kind: 'ring', x: cur.x, y: cur.y - 6 * cur.scale, t: 0, dur: 0.25, r: 10, color: c });
      b.grid.query(cur.x, cur.y, jump, near);
      let next: Enemy | null = null, bd = jump * jump;
      for (const e of near) {
        if (e.dead || hit.has(e.uid) || (!e.boss && !b.canHit(e))) continue;
        const dd = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
        if (dd < bd) { bd = dd; next = e; }
      }
      cur = next;
    }
    b.fx.push({ kind: 'lightning', x: 0, y: 0, t: 0, dur: 0.3, pts, color: c });
  }
  if (thrown) b.hooks.sfx('shoot');
}

/** 回旋镖：掷出后折返，往返都伤害 */
function boomerang(b: Battle, w: WeaponState, L: WeaponLevel, st: ExStyle) {
  const p = b.player;
  const base = aimNearest(b, L.area * 1.15);
  const sp = L.speed || 200;
  const range = L.area * Math.sqrt(b.areaMul);
  for (let i = 0; i < L.count; i++) {
    const a = w.evo ? base + (i / L.count) * TAU : base + (i - (L.count - 1) / 2) * 0.32;
    const pr = newProjectile('knife', w.id);
    pr.x = p.x; pr.y = p.y - 8;
    pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.dmg = L.dmg * b.base.atk;
    pr.pierce = 9999;
    pr.knock = L.knock || 15;
    pr.r = 6 * Math.sqrt(b.areaMul);
    pr.dur = range / sp;
    pr.life = pr.dur * 2 + 1.5;
    pr.sprite = st.sprite || 'icon_w_knife';
    b.projs.push(pr);
  }
  b.hooks.sfx('shoot');
}
