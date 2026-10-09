import { lerp, rand, weighted, TAU } from '../core/math';
import { ENEMIES } from '../data/enemies';
import type { ChapterEvent } from '../data/chapters';
import type { Battle } from './battle';

// 刷怪：按时间轴维持场上敌人密度 + 触发特殊事件

const MAX_ENEMIES = 380;
let breakableT = 20;

export function updateSpawner(b: Battle, dt: number) {
  const ch = b.chapter;
  const t = b.t;
  while (b.eventIdx < ch.events.length && ch.events[b.eventIdx].t <= t) {
    runEvent(b, ch.events[b.eventIdx]);
    b.eventIdx++;
  }

  const seg = ch.waves.find((s) => t >= s.from && t < s.to);
  if (seg) {
    let density = lerp(seg.density[0], seg.density[1], Math.min(1, (t - seg.from) / Math.max(1, Math.min(seg.to, ch.duration) - seg.from)));
    if (b.finalBoss) density *= 0.55;
    b.spawnT -= dt;
    if (b.spawnT <= 0) {
      b.spawnT = seg.interval;
      let alive = 0;
      for (const e of b.enemies) if (!e.dead && !e.boss && !e.fixedDir) alive++;
      const need = density - alive;
      if (need > 0 && b.enemies.length < MAX_ENEMIES) {
        const n = Math.min(Math.ceil(need), 2 + Math.floor(density / 25));
        for (let i = 0; i < n; i++) {
          const id = weighted(seg.pool, (x) => x[1])[0];
          const [x, y] = b.spawnPoint();
          b.spawnEnemy(id, x, y);
        }
      }
    }
  }

  // 补充可破坏物（灯笼 / 粮车）
  breakableT -= dt;
  if (breakableT <= 0) {
    breakableT = 18;
    if (b.breakables.length < 3) spawnBreakablesNear(b, 1);
  }
}

function spawnBreakablesNear(b: Battle, n: number) {
  const p = b.player;
  for (let i = 0; i < n; i++) {
    const a = rand(TAU);
    const d = rand(70, Math.min(b.viewW, b.viewH) * 0.45 + 40);
    b.spawnBreakable(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
}

function runEvent(b: Battle, ev: ChapterEvent) {
  const p = b.player;
  switch (ev.type) {
    case 'elite':
      for (let i = 0; i < (ev.count || 1); i++) {
        const [x, y] = b.spawnPoint();
        b.spawnEnemy(ev.enemy!, x, y, { elite: true });
      }
      b.hooks.banner('精英敌军出现！', '#feae34');
      break;
    case 'ring': {
      const n = ev.count || 30;
      const R = Math.max(b.viewW, b.viewH) * 0.55;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        b.spawnEnemy(ev.enemy!, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
      }
      if (ev.text) b.hooks.banner(ev.text, '#e43b44');
      break;
    }
    case 'stampede': {
      const n = ev.count || 12;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const def = ENEMIES[ev.enemy!];
      const sp = def.speed * 1.7;
      for (let i = 0; i < n; i++) {
        const e = b.spawnEnemy(ev.enemy!, p.x - dir * (b.viewW / 2 + 30 + (i % 3) * 18), p.y - b.viewH * 0.4 + (b.viewH * 0.8 * i) / n + rand(-5, 5));
        e.fixedDir = true;
        e.vx = dir * sp;
        e.vy = 0;
        e.left = dir < 0;
        e.life = (b.viewW + 140) / sp + 1;
      }
      if (ev.text) b.hooks.banner(ev.text, '#e43b44');
      break;
    }
    case 'swarm': {
      const n = ev.count || 20;
      const a = rand(TAU);
      const R = Math.hypot(b.viewW, b.viewH) / 2 + 20;
      const cx = p.x + Math.cos(a) * R, cy = p.y + Math.sin(a) * R;
      for (let i = 0; i < n; i++) b.spawnEnemy(ev.enemy!, cx + rand(-30, 30), cy + rand(-30, 30));
      if (ev.text) b.hooks.banner(ev.text, '#feae34');
      break;
    }
    case 'lanterns':
      spawnBreakablesNear(b, 3);
      break;
    case 'midboss': {
      const [x, y] = b.spawnPoint();
      b.spawnBoss(ev.enemy!, x, y, false);
      break;
    }
    case 'boss': {
      const [x, y] = b.spawnPoint();
      b.spawnBoss(ev.enemy!, x, y, true);
      break;
    }
  }
}

export function resetSpawner() {
  breakableT = 20;
}
