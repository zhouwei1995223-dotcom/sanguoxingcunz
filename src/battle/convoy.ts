import { rand, TAU } from '../core/math';
import type { Battle } from './battle';
import type { Enemy } from './entities';

/** 运粮车不能被攻击。截获条件是其三名护卫都在时限内被击败。 */
export interface Convoy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  expiresAt: number;
  guards: Enemy[];
  defeated: number;
}

const LIFETIME = 30;
const FORMATION = [[-26, 9], [26, 9], [0, -20]] as const;

/** 前、中、后段各一车。每个窗口都留足出场时间，并和下一车分开。 */
export function convoySchedule(duration: number): number[] {
  const segment = duration / 3;
  return [0, 1, 2].map(i => Math.round(rand(i * segment + 16, (i + 1) * segment - LIFETIME - 8)));
}

function dispatch(b: Battle) {
  const angle = rand(TAU), distance = Math.max(85, Math.min(b.viewW, b.viewH) * 0.38);
  const dir = Math.random() < 0.5 ? 1 : -1;
  const convoy: Convoy = {
    x: b.player.x + Math.cos(angle) * distance, y: b.player.y + Math.sin(angle) * distance,
    vx: -Math.sin(angle) * 9 * dir, vy: Math.cos(angle) * 9 * dir,
    expiresAt: b.t + LIFETIME, guards: [], defeated: 0,
  };
  const troop = b.chapter.events.find(ev => ev.type === 'elite' && ev.enemy)?.enemy ?? 'wei_heavy';
  for (const [ox, oy] of FORMATION) {
    const e = b.spawnEnemy(troop, convoy.x + ox, convoy.y + oy, { elite: true, hpMul: 0.65 });
    e.convoyGuard = { ox, oy, engaged: false };
    e.exp = 0;
    convoy.guards.push(e);
  }
  b.convoy = convoy;
  b.hooks.banner('运粮车 · 击败三卫，通关领奖', '#fee761');
}

export function withdrawConvoy(b: Battle) {
  if (!b.convoy) return;
  for (const e of b.convoy.guards) e.dead = true;
  b.convoy = null;
}

export function updateConvoy(b: Battle, dt: number) {
  if (b.convoy && b.t >= b.convoy.expiresAt) {
    withdrawConvoy(b);
    b.hooks.banner('运粮车已撤离', '#d9c6a0');
  }
  if (b.convoy) {
    b.convoy.x += b.convoy.vx * dt;
    b.convoy.y += b.convoy.vy * dt;
  } else if (b.convoyTimes.length && b.t >= b.convoyTimes[0]) {
    b.convoyTimes.shift();
    dispatch(b);
  }
}

/** 离车太远后收队。即使被远程擦中，护卫也不会一路追出护送区域。 */
export function escortGuard(b: Battle, e: Enemy, speed: number, dt: number): boolean {
  const guard = e.convoyGuard!, cart = b.convoy!;
  const dx = b.player.x - e.x, dy = b.player.y - e.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 126 || Math.hypot(b.player.x - cart.x, b.player.y - cart.y) > 142) guard.engaged = false;
  else if (distance <= 42) guard.engaged = true;
  if (guard.engaged) return false;
  const gx = cart.x + guard.ox - e.x, gy = cart.y + guard.oy - e.y;
  const remaining = Math.hypot(gx, gy);
  const step = Math.min(remaining, speed * dt);
  if (remaining > 0) {
    e.x += gx / remaining * step;
    e.y += gy / remaining * step;
    e.left = gx < 0;
    e.anim += step / 8;
  }
  e.kx = e.ky = 0;
  e.touching = false;
  return true;
}

export function guardDefeated(b: Battle, e: Enemy) {
  const cart = b.convoy;
  if (!cart || !cart.guards.includes(e) || b.t >= cart.expiresAt) return;
  cart.defeated++;
  if (cart.defeated === FORMATION.length) {
    b.convoy = null;
    b.convoysCaptured++;
    b.hooks.convoyCaptured?.();
  }
}
