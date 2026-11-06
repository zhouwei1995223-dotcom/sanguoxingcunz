import { rand, TAU } from '../core/math';
import type { Battle } from './battle';
import type { Enemy, Warning } from './entities';

// 首领 AI：追击 → 预警 → 释放技能 → 休整，循环技能表

/** 1.0.3 新增的范围技能：预警结束时按范围结算伤害（battle.fireWarning），这里只负责摆预警 */
const AREA_SKILLS = ['fan', 'rain', 'cross', 'nova', 'encircle'];
const CHARGE_DURATION = 0.65, CHARGE_SPEED = 7.5;

export function updateBoss(b: Battle, e: Enemy, dt: number, dx: number, dy: number, d: number) {
  const boss = e.boss!;
  const p = b.player;
  e.stateT -= dt;
  // 护盾：血量降到 70% 时举盾，计时结束还没打破就狂暴
  if (boss.shield && !e.shieldDone && e.hp < e.maxHp * 0.7) b.raiseShield(e);
  // 二阶段：血量 30% 以下出招更快，范围技能放完有一半几率紧接着再放一个
  if (!e.phase2 && e.minTime > 0 && e.hp < e.maxHp * 0.3) {
    e.phase2 = true;
    b.hooks.banner(`${boss.name}怒火中烧！`, '#ff8a80');
    b.fx.push({ kind: 'ring', x: e.x, y: e.y - 10, t: 0, dur: 0.6, r: 64, color: '#e43b44' });
  }
  if (e.shield > 0) {
    e.shieldT -= dt;
    if (e.shieldT <= 0) b.enrageBoss(e);
  }
  const skill = e.bskills[e.skillIdx % e.bskills.length];
  const spd = e.speed * (1 - e.slow * 0.5);
  switch (e.state) {
    case 'move':
      e.x += dx * spd * dt;
      e.y += dy * spd * dt;
      if (e.stateT <= 0) startSkill(b, e, skill, dx, dy);
      break;
    case 'tele':
      if (skill === 'spin') { e.x += dx * spd * 0.3 * dt; e.y += dy * spd * 0.3 * dt; }
      if (e.stateT <= 0) {
        e.state = 'act';
        if (skill === 'charge') { e.stateT = CHARGE_DURATION; }
        else if (skill === 'spin') { e.stateT = 1.8; e.life = 0; }
        else if (skill === 'slam') { e.stateT = 0.35; e.vx = e.x; e.vy = e.y; }
        else if (skill === 'throw') { e.stateT = 1.05; e.life = 0; }
        else if (skill === 'ring') { e.stateT = 0.9; e.life = 0; }
        else if (skill === 'summon') { e.stateT = 0.2; e.life = 1; }
        else if (AREA_SKILLS.includes(skill)) { e.stateT = 0.25; }
      }
      break;
    case 'act':
      act(b, e, skill, dt, dx, dy, d);
      if (e.stateT <= 0) {
        e.state = 'rest';
        e.stateT = e.enraged ? 0.35 : e.phase2 ? 0.45 : 0.7;
        // 二阶段连招：范围技能后有一半几率直接接下一个技能
        if (e.phase2 && AREA_SKILLS.includes(skill) && Math.random() < 0.5) { e.state = 'move'; e.stateT = 0; }
        e.skillIdx++;
        if (skill === 'slam') {
          b.hooks.shake(4);
          b.hooks.sfx('explode');
          if (e.bossWarning) {
            b.fireWarning({ ...e.bossWarning, dmg: e.dmg * 1.5 });
          } else {
            b.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, dur: 0.4, r: 46, color: '#feae34' });
            if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < 46 * 46) b.hurtPlayer(e.dmg * 1.5);
          }
        }
        e.bossWarning = undefined;
      }
      break;
    case 'rest':
      e.x += dx * spd * 0.4 * dt;
      e.y += dy * spd * 0.4 * dt;
      if (e.stateT <= 0) { e.state = 'move'; e.stateT = e.enraged ? rand(1.2, 1.8) : e.phase2 ? rand(1.4, 2.2) : rand(2.2, 3.4); }
      break;
  }
  // 首领低于一半血量后加快节奏
  if (e.hp < e.maxHp * 0.5 && e.state === 'move' && e.stateT > 1.6) e.stateT = 1.6;
}

/** 技能名：放范围技能时在敌将头上冒字，玩家知道要躲什么 */
function callout(b: Battle, e: Enemy, text: string) {
  b.fx.push({ kind: 'text', x: e.x, y: e.y - 40, t: 0, dur: 1, text, color: '#ff8a80' });
}

function startSkill(b: Battle, e: Enemy, skill: string, dx: number, dy: number) {
  const p = b.player;
  e.state = 'tele';
  switch (skill) {
    case 'charge': {
      e.stateT = 0.8;
      e.tx = dx; e.ty = dy;
      const w: Warning = { kind: 'line', x: e.x, y: e.y, r: 14, a: Math.atan2(dy, dx), len: 200, t: 0, dur: e.stateT };
      if (b.isWebCampaignOrDefense) {
        w.len = e.speed * CHARGE_SPEED * CHARGE_DURATION;
        w.r = e.r * 2;
        w.caster = e;
        e.bossWarning = w;
      }
      b.warnings.push(w);
      break;
    }
    case 'spin':
      e.stateT = 0.7;
      b.warnings.push({ kind: 'circle', x: e.x, y: e.y, r: 44, a: 0, len: 0, t: 0, dur: 0.7 });
      break;
    case 'slam': {
      e.stateT = 0.9;
      e.tx = p.x; e.ty = p.y;
      const w: Warning = { kind: 'circle', x: e.tx, y: e.ty, r: 46, a: 0, len: 0, t: 0, dur: 1.25 };
      if (b.isWebCampaignOrDefense) {
        w.caster = e;
        e.bossWarning = w;
      }
      b.warnings.push(w);
      break;
    }
    case 'throw':
    case 'ring':
      e.stateT = 0.5;
      break;
    case 'summon':
      e.stateT = 0.6;
      b.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, dur: 0.6, r: 40, color: '#e43b44' });
      break;
    case 'fan': {
      // 扇形横扫：朝玩家方向一大片，往两侧或往后退都能躲
      const a = Math.atan2(dy, dx);
      e.stateT = 0.9;
      e.left = dx < 0;
      b.warnings.push({ kind: 'fan', x: e.x, y: e.y, r: 0.95, a, len: 96, t: 0, dur: 0.9, dmg: e.dmg * 1.5, hitFx: 'slash' });
      callout(b, e, '横扫千军');
      break;
    }
    case 'rain': {
      // 箭雨 / 落石：玩家脚下一个，周围再落几个，先后砸下
      const n = e.enraged ? 7 : 5;
      e.stateT = 0.5;
      b.warnings.push({ kind: 'circle', x: p.x, y: p.y, r: 30, a: 0, len: 0, t: 0, dur: 1.0, dmg: e.dmg * 1.1, hitFx: 'explo' });
      for (let i = 1; i < n; i++) {
        const a = rand(TAU), r = rand(40, 100);
        b.warnings.push({ kind: 'circle', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.8, r: 30, a: 0, len: 0, t: 0, dur: 1.0 + i * 0.12, dmg: e.dmg * 1.1, hitFx: 'explo' });
      }
      callout(b, e, e.boss!.proj === 'stone' ? '飞石如雨' : '万箭齐发');
      break;
    }
    case 'cross': {
      // 十字刀气：从敌将身上向四个方向（狂暴后八个）劈出长条，站在斜线上就安全
      const n = e.enraged ? 8 : 4;
      const a0 = Math.random() < 0.5 ? 0 : Math.PI / 4;
      e.stateT = 1.0;
      for (let i = 0; i < n; i++) b.warnings.push({ kind: 'line', x: e.x, y: e.y, r: 24, a: a0 + (i / n) * TAU, len: 280, t: 0, dur: 1.0, dmg: e.dmg * 1.3, hitFx: 'blade' });
      callout(b, e, '刀气纵横');
      break;
    }
    case 'encircle':
      e.stateT = 1.6;
      b.warnings.push({ kind: 'circle', x: e.x, y: e.y, r: 92, innerR: 38, a: 0, len: 0, t: 0, dur: e.stateT, dmg: e.dmg * 1.3, caster: e });
      callout(b, e, '八门锁阵');
      break;
    case 'nova':
      // 震地：以敌将为中心的大圆，赶紧跑出去
      e.stateT = 1.2;
      b.warnings.push({ kind: 'circle', x: e.x, y: e.y, r: 105, a: 0, len: 0, t: 0, dur: 1.2, dmg: e.dmg * 1.8, hitFx: 'explo' });
      callout(b, e, '震地');
      break;
  }
}

function act(b: Battle, e: Enemy, skill: string, dt: number, dx: number, dy: number, d: number) {
  const boss = e.boss!;
  const p = b.player;
  switch (skill) {
    case 'charge': {
      const path = e.bossWarning;
      if (path) {
        // 锁定起手速度，最后一帧只走剩余时间。逐步移动让守城的山林碰撞继续生效。
        const activeDt = Math.min(dt, e.stateT + dt);
        const step = path.len * activeDt / CHARGE_DURATION;
        const dx = Math.cos(path.a), dy = Math.sin(path.a);
        const along = (e.x - path.x) * dx + (e.y - path.y) * dy;
        const advance = Math.min(step, Math.max(0, path.len - along));
        e.x += dx * advance;
        e.y += dy * advance;
      } else {
        e.x += e.tx * e.speed * CHARGE_SPEED * dt;
        e.y += e.ty * e.speed * CHARGE_SPEED * dt;
      }
      e.left = e.tx < 0;
      if (Math.random() < 0.5) b.fx.push({ kind: 'puff', x: e.x, y: e.y, t: 0, dur: 0.3 });
      break;
    }
    case 'spin': {
      e.x += dx * e.speed * 1.3 * dt;
      e.y += dy * e.speed * 1.3 * dt;
      e.life -= dt;
      if (e.life <= 0) {
        e.life = 0.3;
        b.fx.push({ kind: 'ring', x: e.x, y: e.y - 8, t: 0, dur: 0.3, r: 44, color: '#ffffff' });
        if (d < 44 + p.r) b.hurtPlayer(e.dmg * 0.6);
      }
      e.left = !e.left;
      break;
    }
    case 'slam': {
      const k = 1 - Math.max(0, e.stateT) / 0.35;
      e.x = e.vx + (e.tx - e.vx) * k;
      e.y = e.vy + (e.ty - e.vy) * k;
      break;
    }
    case 'throw':
      e.life -= dt;
      if (e.life <= 0) {
        e.life = 0.35;
        const base = Math.atan2(dy, dx);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.22;
          b.enemyShoot(e.x, e.y - 16, Math.cos(a), Math.sin(a), 110, e.dmg * 0.7, boss.proj || 'arrow');
        }
        b.hooks.sfx('shoot');
      }
      break;
    case 'ring':
      e.life -= dt;
      if (e.life <= 0) {
        e.life = 0.45;
        const off = rand(TAU);
        for (let i = 0; i < 16; i++) {
          const a = off + (i / 16) * TAU;
          b.enemyShoot(e.x, e.y - 16, Math.cos(a), Math.sin(a), 85, e.dmg * 0.6, boss.proj || 'arrow');
        }
        b.hooks.sfx('shoot');
      }
      break;
    case 'summon':
      if (e.life > 0 && boss.summon) {
        e.life = 0;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          b.spawnEnemy(boss.summon, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30);
        }
      }
      break;
  }
}
