import { lerp, rand, weighted, TAU } from '../core/math';
import { ENEMIES } from '../data/enemies';
import { ChapterEvent, ENDLESS_POOLS } from '../data/chapters';
import type { Battle } from './battle';

// 刷怪：按时间轴维持场上敌人密度 + 触发特殊事件

const MAX_ENEMIES = 460;

/** 每轮补怪数量：缺口越大补得越快，保证后期击杀再快屏幕上也是满的 */
function refill(need: number, density: number) {
  return Math.min(Math.ceil(need), Math.max(2 + Math.floor(density / 25), Math.ceil(need * 0.6)));
}
let breakableT = 20;
let hordeIdx = 0;

// 无尽模式的事件计时
const ENDLESS_BOSSES = ['xiahouen', 'chenying', 'xuhuang', 'hanying', 'suyong', 'huaxiong', 'yanliang', 'caimao', 'zhuran', 'guohuai', 'caochun', 'baolong', 'zhanghe', 'hande', 'caozhen'];
let et = { elite: 60, ring: 100, stampede: 130, swarm: 75, lantern: 40, boss: 180, bossIdx: 0 };

export function setFirstBoss(sec: number) {
  et.boss = sec;
}

function updateEndless(b: Battle, dt: number) {
  const t = b.t, m = t / 60;
  let pool = ENDLESS_POOLS[0].pool;
  for (const p of ENDLESS_POOLS) if (t >= p.from) pool = p.pool;
  if (b.mods?.pool) pool = b.mods.pool;
  const density = Math.min(300, 18 + m * 20) * (1 + 0.4 * b.crowdRamp()) * b.densityMul;
  b.targetDensity = density;
  b.spawnT -= dt;
  if (b.spawnT <= 0) {
    b.spawnT = 0.42;
    let alive = 0;
    for (const e of b.enemies) if (!e.dead && !e.boss && !e.fixedDir) alive++;
    const need = density - alive;
    if (need > 0 && b.enemies.length < MAX_ENEMIES) {
      const n = Math.min(refill(need, density), MAX_ENEMIES - b.enemies.length);
      for (let i = 0; i < n; i++) { const [x, y] = b.spawnPoint(); b.spawnEnemy(weighted(pool, (x2) => x2[1])[0], x, y); }
    }
  }
  const fire = (key: 'elite' | 'ring' | 'stampede' | 'swarm' | 'lantern' | 'boss', every: number, ev: ChapterEvent) => {
    et[key] -= dt;
    if (et[key] > 0) return;
    et[key] = every;
    runEvent(b, ev);
  };
  const strong = t > 420;
  fire('elite', 60, { t, type: 'elite', enemy: strong ? 'elite_guard' : 'wei_heavy', count: 1 + Math.floor(m / 4) });
  fire('ring', 100, { t, type: 'ring', enemy: strong ? 'wu_shield' : 'wei_spear', count: Math.min(80, 30 + Math.floor(m * 3)), text: '四面伏兵！' });
  fire('stampede', 130, { t, type: 'stampede', enemy: strong ? 'tiger_cavalry' : 'wei_cavalry', count: Math.min(30, 12 + Math.floor(m)), text: '骑兵冲阵！' });
  fire('swarm', 75, { t, type: 'swarm', enemy: 'bandit', count: Math.min(60, 20 + Math.floor(m * 2)), text: '流寇来袭！' });
  fire('lantern', 45, { t, type: 'lanterns' });
  et.boss -= dt;
  if (et.boss <= 0) {
    et.boss = b.mods?.bossEvery || 180;
    const id = ENDLESS_BOSSES[et.bossIdx % ENDLESS_BOSSES.length];
    et.bossIdx++;
    const [x, y] = b.spawnPoint();
    // 首领血量随时间成长
    b.spawnBoss(id, x, y, false, 0.4 + m * 0.12);
  }
}

export function updateSpawner(b: Battle, dt: number) {
  const ch = b.chapter;
  const t = b.t;
  if (ch.endless) {
    updateEndless(b, dt);
    breakableT -= dt;
    return;
  }
  while (b.eventIdx < ch.events.length && ch.events[b.eventIdx].t <= t) {
    runEvent(b, ch.events[b.eventIdx]);
    b.eventIdx++;
  }

  const seg = ch.waves.find((s) => t >= s.from && t < s.to);
  if (seg) {
    let density = lerp(seg.density[0], seg.density[1], Math.min(1, (t - seg.from) / Math.max(1, Math.min(seg.to, ch.duration) - seg.from)));
    if (b.finalBoss) density *= 0.55;
    // 后期敌人更多、单个更脆：割草感更强
    density *= (1 + 0.6 * b.crowdRamp()) * b.densityMul;
    b.targetDensity = density;
    b.spawnT -= dt;
    if (b.spawnT <= 0) {
      b.spawnT = seg.interval;
      let alive = 0;
      for (const e of b.enemies) if (!e.dead && !e.boss && !e.fixedDir) alive++;
      const need = density - alive;
      if (need > 0 && b.enemies.length < MAX_ENEMIES) {
        const n = Math.min(refill(need, density), MAX_ENEMIES - b.enemies.length);
        for (let i = 0; i < n; i++) {
          const id = weighted(seg.pool, (x) => x[1])[0];
          const [x, y] = b.spawnPoint();
          b.spawnEnemy(id, x, y);
        }
      }
    }
  }

  // 大军压境：成片的弱小敌人从四面涌来
  if (ch.duration >= 600) {
    const at = [270, 510];
    if (hordeIdx < at.length && t >= at[hordeIdx]) {
      const weakest = ch.waves[0].pool[0][0] as string;
      runEvent(b, { t, type: 'horde', enemy: weakest, count: Math.round((110 + hordeIdx * 50) * b.densityMul), text: '敌军大举压境！' });
      hordeIdx++;
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
    case 'horde': {
      // 四个方向各一股，略带弧形，一碰就倒
      const n = ev.count || 120;
      const R = Math.hypot(b.viewW, b.viewH) / 2 + 24;
      const a0 = rand(TAU);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i % 4) * (TAU / 4) + rand(-0.35, 0.35);
        const d = R + rand(0, 60);
        b.spawnEnemy(ev.enemy!, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { hpMul: 0.5 });
      }
      if (ev.text) b.hooks.banner(ev.text, '#e43b44');
      b.hooks.sfx('boss');
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
  et = { elite: 60, ring: 100, stampede: 130, swarm: 75, lantern: 40, boss: 180, bossIdx: 0 };
  breakableT = 20;
  hordeIdx = 0;
}
