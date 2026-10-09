// 无界面战斗模拟：自动走位 + 自动选技能，用于检验数值平衡与稳定性
// 用法：npm run sim -- [章节] [攻击] [生命] [次数]
import { Battle } from '../src/battle/battle';
import { CHAPTERS } from '../src/data/chapters';
import type { HeroStats } from '../src/meta/ops';

const args = process.argv.slice(2).map(Number);
const chId = args[0] || 1;
const atk = args[1] || 20;
const hp = args[2] || 120;
const runs = args[3] || 3;

function stats(): HeroStats {
  return { atk, hp, def: 0, speed: 0, crit: 5, critDmg: 50, dmg: 0, pickup: 0, exp: 0, gold: 0, cd: 0, area: 0, regen: 0, bossDmg: 0, revive: 0, reroll: 0 };
}

for (let r = 0; r < runs; r++) {
  const b = new Battle(CHAPTERS[chId - 1], stats(), 280, 560);
  if (process.env.EASY) { b.enemyHpMul = 0.75; b.enemyDmgMul = 0.6; }
  const dt = 1 / 30;
  let ang = 0;
  const log: string[] = [];
  let maxEnemies = 0;
  const t0 = Date.now();
  while (!b.dead && !b.won && b.t < 720) {
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
    if (b.rageFull) b.castUlt();
    maxEnemies = Math.max(maxEnemies, b.enemies.length);
    while (b.pendingLevelUps > 0) {
      b.pendingLevelUps--;
      const ch = b.rollChoices();
      // 优先：已有武器升级 > 新武器 > 被动
      const pickC = ch.find((c) => c.kind === 'weapon' && !c.isNew) || ch.find((c) => c.kind === 'weapon') || ch[0];
      b.applyChoice(pickC);
    }
    while (b.pendingChests.length) {
      const c = b.pendingChests.shift()!;
      for (const ch of b.rollChest(c.boss)) {
        if (ch.kind === 'evo') log.push(`${b.t.toFixed(0)}s 进化 ${ch.id}`);
        b.applyChoice(ch);
      }
    }
    if (Math.floor(b.t) % 60 === 0 && Math.floor(b.t - dt) % 60 !== 0) log.push(`${b.t.toFixed(0)}s lv${b.level} hp${Math.round(b.player.hp)}/${b.player.maxHp} kills${b.kills} enemies${b.enemies.filter(e=>!e.dead).length}`);
    if (b.dead && b.revives > 0) { b.revives--; b.revive(); log.push(`${b.t.toFixed(0)}s 复活`); }
  }
  console.log(`--- 第${chId}章 run ${r + 1}: ${b.won ? '胜利' : b.dead ? '阵亡' : '超时'} t=${b.t.toFixed(0)} lv=${b.level} kills=${b.kills} coins=${b.coins} maxEnemies=${maxEnemies} boss=${b.finalBoss ? Math.round(b.finalBoss.hp) + '/' + b.finalBoss.maxHp : '-'} 耗时${Date.now() - t0}ms`);
  console.log('   武器:', b.weapons.map((w) => w.id + (w.evo ? '★' : w.lv)).join(' '), ' 被动:', b.passives.map((p) => p.id + p.lv).join(' '));
  console.log('   ' + log.join(' | '));
}
