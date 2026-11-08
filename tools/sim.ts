// 无界面战斗模拟：自动走位 + 自动选技能，用于检验数值平衡与稳定性
// 用法：npm run sim -- [章节] [攻击] [生命] [次数]
import { Battle } from '../src/battle/battle';
import { CHAPTERS, DIFFICULTIES, ENDLESS, TIANJI, campaignChapter } from '../src/data/chapters';
import { createTianji, tianjiStats, drawSign, canDraw, levelTickets } from '../src/battle/tianji';
import { resetSpawner } from '../src/battle/spawner';
import { combatPower, type HeroStats } from '../src/meta/ops';
import { weaponLink } from '../src/data/skills';
import { HERO_BY_ID } from '../src/data/heroes';
import { IS_WEB } from '../src/data/platformConfig';
import { campaignProfile } from './campaign-profile';

const args = process.argv.slice(2).map(Number);
const chId = Number.isInteger(args[0]) ? args[0] : 1;
const atk = args[1] || 20;
const hp = args[2] || 120;
const runs = args[3] || 3;
const target = Number(process.env.TARGET_POWER);
// 第 -4 章 = 天机签（无名剑客固定属性，自动抽签）
const TJ = chId === -4;
const chapter = TJ ? TIANJI : chId === 0 ? ENDLESS : IS_WEB ? campaignChapter(chId, process.env.MINUTES === '10' ? 10 : 5) : CHAPTERS[chId - 1];
if (target && (!IS_WEB || chId === 0)) throw new Error('TARGET_POWER 用于 --campaign-sim 构建的征战章节');
const profile = target ? campaignProfile(process.env.HERO || 'zhaoyun', target, Number(process.env.UNLOCK ?? 10)) : null;

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
  return { atk, hp, def: 0, speed: 0, crit: 5, critDmg: 50, dmg: 0, pickup: 0, exp: 0, gold: 0, cd: 0, area: 0, regen: 0, bossDmg: 0, revive: 0, reroll: 0, potion: Number(process.env.POTION || 0), hero: process.env.HERO || 'zhaoyun', cleared: Number(process.env.UNLOCK ?? 10) };
}

// 按分钟汇总（所有局平均）：一击秒杀比例、击杀耗时、每分钟受到伤害（占生命上限的百分比）
const per: { n: number; one: number; kills: number; age: number; dmg: number; alive: number }[] = [];
for (let r = 0; r < runs; r++) {
  if (process.env.SEED !== undefined) {
    let seed = Number(process.env.SEED) + r;
    Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
  }
  let mk = 0, mo = 0, md = 0;
  resetSpawner();
  const b = new Battle(chapter, TJ ? tianjiStats() : profile || stats(), Number(process.env.VW || 308), Number(process.env.VH || 667));
  const D = DIFFICULTIES[Number(process.env.DIFF || 0)];
  b.enemyHpMul *= D.hp; b.enemyDmgMul *= D.dmg;
  if (chId === 0 && !TJ) { const c = Number(process.env.CLEARED || 3); b.enemyHpMul *= Math.pow(1.45, c); b.enemyDmgMul *= Math.pow(1.22, c); }
  if (process.env.EASY) { b.enemyHpMul = 0.75; b.enemyDmgMul = 0.6; }
  if (chId > 0) b.powerRatio = Number(process.env.POWER) || 1;
  // 开局奇遇：QIYU=none 不选，QIYU=<id> 指定，默认随机三选一里随便拿一个
  const tierN = [0, 0, 0, 0, 0];
  // 每分钟：伤害总量 / 命中次数 / 最大单次、新刷小怪的平均血量、被打一下掉多少（占生命上限）
  const mins: { dmg: number; hits: number; max: number; hp: number; hpN: number; taken: number; takenN: number; bossHit: number }[] = [];
  const row = () => mins[Math.floor(b.t / 60)] || (mins[Math.floor(b.t / 60)] = { dmg: 0, hits: 0, max: 0, hp: 0, hpN: 0, taken: 0, takenN: 0, bossHit: 0 });
  if (TJ && process.env.STATS) {
    const od = b.damage.bind(b);
    (b as any).damage = (e: any, base: number, ...rest: any[]) => { const before = e.hp; const r = od(e, base, ...rest); const d = Math.max(0, before - e.hp); const m = row(); m.dmg += d; m.hits++; if (d > m.max) m.max = d; return r; };
    const os = b.spawnEnemy.bind(b);
    (b as any).spawnEnemy = (...a: any[]) => { const e = os(...a); if (!e.elite) { const m = row(); m.hp += e.maxHp; m.hpN++; } return e; };
    const oh = b.hurtPlayer.bind(b);
    (b as any).hurtPlayer = (d: number, c?: boolean) => { const hp0 = b.player.hp; oh(d, c); const m = row(); const lost = (hp0 - b.player.hp) / b.player.maxHp; if (lost > 0) { m.taken += lost; m.takenN++; } };
  }
  let mbStart = -1; const bossSecs: number[] = [];
  let coinsEarned = 0;
  if (TJ) {
    b.tj = createTianji(); b.weapon('sword')!.lv = 2; b.recalc(); b.revives = Number(process.env.REV ?? 1);
    b.fxCap = 200; b.numCap = 14; b.gemCap = 60; b.weaponSlots = b.passiveSlots = 999;
    // GEAR=2：模拟有装备军略的号（攻击、生命 ×2），并按游戏里的规则让敌人跟着变强（战力比 ^0.75 / ^0.45）
    const gear = Number(process.env.GEAR || 1);
    if (gear > 1) { b.base.atk *= gear; b.base.hp *= gear; b.player.maxHp = b.player.hp = b.base.hp; b.recalc(); b.tj.power = Math.max(1, combatPower(b.base) / combatPower(tianjiStats())); }
  }
  if (process.env.QIYU !== 'none' && !TJ) b.applyQiyu((process.env.QIYU as any) || b.rollQiyu(1)[0]);
  const dt = 1 / 30;
  let ang = 0;
  const log: string[] = [];
  let maxEnemies = 0;
  let lateNear = 0, lateScreen = 0, lateN = 0;
  const t0 = Date.now();
  while (!b.dead && !b.won && b.t < (chId === 0 ? 3600 : 720)) {
    const coinsBefore = b.coins;
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
    if (TJ) {
      const mb = b.midBoss && !b.midBoss.dead ? b.midBoss : null;
      if (mb && mbStart < 0) mbStart = b.t;
      if (!mb && mbStart >= 0) { log.push(`${b.t.toFixed(0)}s 中途敌将用时${(b.t - mbStart).toFixed(0)}s`); bossSecs.push(b.t - mbStart); mbStart = -1; }
    }
    if (b.coins > coinsBefore) coinsEarned += b.coins - coinsBefore;
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
    if (b.rageFull && !(b.finalBoss && process.env.FINALULT === 'off')) b.castUlt();
    // 金疮药：血量低于 40% 时喝（NOPOTION=1 模拟不会用药的玩家）
    if (!process.env.NOPOTION && b.player.hp < b.player.maxHp * 0.4) b.usePotion();
    maxEnemies = Math.max(maxEnemies, b.enemies.length);
    if (TJ) {
      // 天机签：升级换签，能抽就抽（选择签总选第一项）
      b.tj!.tickets += levelTickets(b.level - b.pendingLevelUps, b.level); b.pendingLevelUps = 0;
      let guard = 0;
      while (canDraw(b) && !b.ult && guard++ < 6 && !b.dead) {
        const c0 = b.coins;
        const r = drawSign(b);
        if (!r) break;
        tierN[r.tier]++;
        if (r.options) r.options[0].act(); else if (r.apply) r.apply();
        if (b.coins > c0) coinsEarned += b.coins - c0;
        if (process.env.LOGDRAW) log.push(`${b.t.toFixed(0)}s ${r.tier}:${r.id}`);
      }
    }
    while (b.pendingLevelUps > 0) {
      b.pendingLevelUps--;
      const ch = b.rollChoices();
      // 按游戏内「推荐」标签选择（不动脑玩家的路线）
      const pickC = process.env.PICK === 'weapon'
        ? ch.find((c) => c.kind === 'weapon' && !c.isNew) || ch.find((c) => c.kind === 'weapon') || ch[0]
        : ch[Math.max(0, b.recommend(ch))];
      b.applyChoice(pickC);
    }
    // FORCE=xxx：开局 2 分钟时直接获得指定计策（测单条计策强度），之后不再给锦囊
    if (process.env.FORCE) { if (b.t >= 120 && !b.strats.length) b.applyStrat(process.env.FORCE as any); b.pendingStrats.length = 0; }
    // 锦囊：随机选一个（STRAT=xxx 时只要出现就选它）
    while (b.pendingStrats.length) {
      const st = b.pendingStrats.shift()!;
      if (process.env.NOSTRAT) continue;
      const ch = b.rollStrats(st.tier);
      const want = process.env.STRAT && ch.find((x) => x === process.env.STRAT);
      const pickS = want || ch[(Math.random() * ch.length) | 0];
      b.applyStrat(pickS);
      log.push(`${b.t.toFixed(0)}s 锦囊 ${pickS}`);
    }
    while (b.pendingChests.length) {
      const c = b.pendingChests.shift()!;
      for (const ch of b.rollChest(c.boss)) {
        if (ch.kind === 'evo') log.push(`${b.t.toFixed(0)}s 进化 ${ch.id}${weaponLink(ch.id, b.hero.id) ? '(专属)' : ''}`);
        b.applyChoice(ch);
      }
    }
    if (Math.floor(b.t) % 60 === 0 && Math.floor(b.t - dt) % 60 !== 0) {
      const m = Math.round(b.t / 60) - 1;
      const row = per[m] || (per[m] = { n: 0, one: 0, kills: 0, age: 0, dmg: 0, alive: 0 });
      row.n++; row.kills += b.statKills - mk; row.one += b.statOneShots - mo; row.age += b.killAge; row.dmg += (b.statDmgTaken - md) / b.player.maxHp * 100; row.alive++;
      mk = b.statKills; mo = b.statOneShots; md = b.statDmgTaken;
    }
    if (Math.floor(b.t) % 60 === 0 && Math.floor(b.t - dt) % 60 !== 0) log.push(`${b.t.toFixed(0)}s fill${b.screenFill.toFixed(2)} dens${Math.round(b.targetDensity)} dir${b.director.toFixed(2)} lv${b.level} hp${Math.round(b.player.hp)}/${b.player.maxHp} kills${b.kills} enemies${b.enemies.filter(e=>!e.dead).length}`);
    if (b.dead && !b.bossTimedOut && b.revives > 0) { b.revives--; b.revive(); log.push(`${b.t.toFixed(0)}s 复活`); }
  }
  console.log(`--- 第${chId}章 run ${r + 1}: ${b.won ? '胜利' : b.dead ? '阵亡' : '超时'} t=${b.t.toFixed(0)} lv=${b.level} kills=${b.kills} coins=${b.coins} maxEnemies=${maxEnemies} boss=${b.finalBoss ? Math.round(b.finalBoss.hp) + '/' + b.finalBoss.maxHp : '-'} 后期身边/同屏=${lateN ? (lateNear / lateN).toFixed(0) + '/' + (lateScreen / lateN).toFixed(0) : '-'} 动态血量=${b.director.toFixed(2)} 击杀耗时=${b.killAge.toFixed(1)}s 破盾/狂暴=${b.statShield.join("/")} 敌将战=${b.statBossSec.toFixed(0)}s 受伤=${Math.round(b.statDmgTaken)} 耗时${Date.now() - t0}ms`);
  if (profile) console.log('CAL', JSON.stringify({ chapter: chId, diff: D.id, minutes: chapter.duration / 60, hero: b.hero.id, target, power: combatPower(profile), win: b.won, bossSec: b.finalBossSec, timeout: b.bossTimedOut }));
  if (TJ) console.log(`   中途敌将用时：${bossSecs.map((x) => x.toFixed(0) + 's').join(' / ') || '-'}  天命伤害${Math.round(b.tj!.finalDmg)}`);
  if (TJ) console.log(`   签：上上${tierN[0]} 上${tierN[1]} 中${tierN[2]} 下${tierN[3]} 怪${tierN[4]} 共${b.tj!.history.length}  金币收入${coinsEarned} 花费${b.tj!.coinsSpent} 复活${b.reviveCount}`);
  if (TJ && process.env.STATS) mins.forEach((m, i) => m && console.log(`   ${i + 1}分: 每秒伤害 ${Math.round(m.dmg / 60)} 平均一击 ${Math.round(m.dmg / Math.max(1, m.hits))} 最大一击 ${Math.round(m.max)} 小怪平均血 ${Math.round(m.hp / Math.max(1, m.hpN))} 平均受击 ${(m.taken / Math.max(1, m.takenN) * 100).toFixed(1)}%血`));
  console.log('   武器:', b.weapons.map((w) => w.id + (w.evo ? '★' : w.lv)).join(' '), ' 被动:', b.passives.map((p) => p.id + p.lv).join(' '));
  console.log('   ' + log.join(' | '));
}
if (process.env.CURVE) {
  console.log('分钟 | 一击秒杀 | 击杀耗时 | 每分钟受伤(%血) | 存活局数');
  per.forEach((r, m) => r && console.log(`${String(m + 1).padStart(2)}   | ${(r.one / Math.max(1, r.kills) * 100).toFixed(0).padStart(4)}%   | ${(r.age / r.n).toFixed(1).padStart(5)}s  | ${(r.dmg / r.n).toFixed(0).padStart(5)}%  | ${r.alive}`));
}
