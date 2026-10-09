// 无界面战斗模拟：自动走位 + 自动选技能，用于检验数值平衡与稳定性
// 用法：npm run sim -- [章节] [攻击] [生命] [次数]
import { Battle } from '../src/battle/battle';
import { CHAPTERS, DIFFICULTIES, ENDLESS } from '../src/data/chapters';
import { resetSpawner } from '../src/battle/spawner';
import type { HeroStats } from '../src/meta/ops';
import { weaponLink } from '../src/data/skills';
import { HERO_BY_ID } from '../src/data/heroes';

const args = process.argv.slice(2).map(Number);
const chId = Number.isNaN(args[0]) ? 1 : args[0];
const atk = args[1] || 20;
const hp = args[2] || 120;
const runs = args[3] || 3;

// POWER=0.7 表示按章节推荐战力的 70% 换算攻击与生命（按武将攻血比例）
function powerStats(): { atk: number; hp: number } {
  const P = Number(process.env.POWER);
  if (!P || chId === 0) return { atk, hp };
  const h = HERO_BY_ID[process.env.HERO || 'zhaoyun'];
  const ratio = h.baseHp / h.baseAtk;
  const a = (CHAPTERS[chId - 1].power * P) / (10.25 + 2 * ratio);
  return { atk: Math.round(a), hp: Math.round(a * ratio) };
}

function stats(): HeroStats {
  const { atk, hp } = powerStats();
  return { atk, hp, def: 0, speed: 0, crit: 5, critDmg: 50, dmg: 0, pickup: 0, exp: 0, gold: 0, cd: 0, area: 0, regen: 0, bossDmg: 0, revive: 0, reroll: 0, hero: process.env.HERO || 'zhaoyun', cleared: Number(process.env.UNLOCK ?? 10) };
}

for (let r = 0; r < runs; r++) {
  resetSpawner();
  const b = new Battle(chId === 0 ? ENDLESS : CHAPTERS[chId - 1], stats(), 280, 560);
  const D = DIFFICULTIES[Number(process.env.DIFF || 0)];
  b.enemyHpMul *= D.hp; b.enemyDmgMul *= D.dmg;
  if (chId === 0) { const c = Number(process.env.CLEARED || 3); b.enemyHpMul *= Math.pow(1.45, c); b.enemyDmgMul *= Math.pow(1.22, c); }
  if (process.env.EASY) { b.enemyHpMul = 0.75; b.enemyDmgMul = 0.6; }
  const dt = 1 / 30;
  let ang = 0;
  const log: string[] = [];
  let maxEnemies = 0;
  let lateNear = 0, lateScreen = 0, lateN = 0;
  const t0 = Date.now();
  while (!b.dead && !b.won && b.t < (chId === 0 ? 3600 : 720)) {
    // 走位：危险时躲避，安全时去捡经验、贴近敌人输出
    let fx = 0, fy = 0, danger = 0;
    let nearest = 1e9, nx = 0, ny = 0;
    for (const e of b.enemies) {
      if (e.dead) continue;
      const dx = b.player.x - e.x, dy = b.player.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearest) { nearest = d2; nx = -dx; ny = -dy; }
      const rr = e.boss ? 70 : 34;
      if (d2 < rr * rr) { const d = Math.sqrt(d2) + 0.1; fx += dx / d / d * 30; fy += dy / d / d * 30; danger++; }
    }
    for (const s of b.shots) { const dx = b.player.x - s.x, dy = b.player.y - s.y; const d2 = dx*dx+dy*dy; if (d2 < 40*40) { fx += dx/(d2+1)*20; fy += dy/(d2+1)*20; } }
    for (const w of b.warnings) { const dx = b.player.x - w.x, dy = b.player.y - w.y; const d2 = dx*dx+dy*dy; if (d2 < 80*80) { fx += dx/(d2+1)*40; fy += dy/(d2+1)*40; } }
    if (danger < 3) {
      let best: any = null, bd = 160 * 160;
      for (const k of b.pickups) { const dx = k.x - b.player.x, dy = k.y - b.player.y; const d2 = dx*dx+dy*dy; if (d2 < bd) { bd = d2; best = k; } }
      if (best) { const d = Math.sqrt(bd) + 1; fx += (best.x - b.player.x) / d * 0.5; fy += (best.y - b.player.y) / d * 0.5; }
      else if (nearest > 45 * 45) { const d = Math.sqrt(nearest); fx += nx / d * 0.3; fy += ny / d * 0.3; }
    }
    ang += dt * 0.5;
    fx += Math.cos(ang) * 0.15; fy += Math.sin(ang) * 0.15;
    const l = Math.hypot(fx, fy) || 1;
    b.moveX = fx / l; b.moveY = fy / l;
    b.update(dt);
    // 后期压力：6~10 分钟里，玩家周围 100 像素内平均有多少敌人
    if (b.t > 360 && b.t < 600) {
      let near = 0, onScreen = 0;
      for (const e of b.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.x - b.player.x) < 100 && Math.abs(e.y - b.player.y) < 100) near++;
        if (Math.abs(e.x - b.player.x) < 140 && Math.abs(e.y - b.player.y) < 280) onScreen++;
      }
      lateNear += near; lateScreen += onScreen; lateN++;
    }
    if (b.rageFull) b.castUlt();
    maxEnemies = Math.max(maxEnemies, b.enemies.length);
    while (b.pendingLevelUps > 0) {
      b.pendingLevelUps--;
      const ch = b.rollChoices();
      // 按游戏内「推荐」标签选择（不动脑玩家的路线）
      const pickC = process.env.PICK === 'weapon'
        ? ch.find((c) => c.kind === 'weapon' && !c.isNew) || ch.find((c) => c.kind === 'weapon') || ch[0]
        : ch[Math.max(0, b.recommend(ch))];
      b.applyChoice(pickC);
    }
    while (b.pendingChests.length) {
      const c = b.pendingChests.shift()!;
      for (const ch of b.rollChest(c.boss)) {
        if (ch.kind === 'evo') log.push(`${b.t.toFixed(0)}s 进化 ${ch.id}${weaponLink(ch.id, b.hero.id) ? '(专属)' : ''}`);
        b.applyChoice(ch);
      }
    }
    if (Math.floor(b.t) % 60 === 0 && Math.floor(b.t - dt) % 60 !== 0) log.push(`${b.t.toFixed(0)}s lv${b.level} hp${Math.round(b.player.hp)}/${b.player.maxHp} kills${b.kills} enemies${b.enemies.filter(e=>!e.dead).length}`);
    if (b.dead && b.revives > 0) { b.revives--; b.revive(); log.push(`${b.t.toFixed(0)}s 复活`); }
  }
  console.log(`--- 第${chId}章 run ${r + 1}: ${b.won ? '胜利' : b.dead ? '阵亡' : '超时'} t=${b.t.toFixed(0)} lv=${b.level} kills=${b.kills} coins=${b.coins} maxEnemies=${maxEnemies} boss=${b.finalBoss ? Math.round(b.finalBoss.hp) + '/' + b.finalBoss.maxHp : '-'} 后期身边/同屏=${lateN ? (lateNear / lateN).toFixed(0) + '/' + (lateScreen / lateN).toFixed(0) : '-'} 动态血量=${b.director.toFixed(2)} 击杀耗时=${b.killAge.toFixed(1)}s 耗时${Date.now() - t0}ms`);
  console.log('   武器:', b.weapons.map((w) => w.id + (w.evo ? '★' : w.lv)).join(' '), ' 被动:', b.passives.map((p) => p.id + p.lv).join(' '));
  console.log('   ' + log.join(' | '));
}
