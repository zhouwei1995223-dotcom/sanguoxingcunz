// 武器伤害测算：同样的攻击力下，每把武器对「密集人群」和「单个目标」每秒造成多少伤害
// 用法：node tools/build.mjs --dps && node dist/sim/dps.js
import { Battle } from '../src/battle/battle';
import { CHAPTERS } from '../src/data/chapters';
import { WEAPONS, WeaponId, weaponLink } from '../src/data/skills';
import { HERO_BY_ID } from '../src/data/heroes';
import type { HeroStats } from '../src/meta/ops';

const ATK = 100;
const SEC = 30;
const CROWD = Number(process.env.CROWD || 150);

function stats(hero: string): HeroStats {
  return { atk: ATK, hp: 1e9, def: 0, speed: 0, crit: 0, critDmg: 0, dmg: 0, pickup: 0, exp: 0, gold: 0, cd: 0, area: 0, regen: 0, bossDmg: 0, revive: 0, reroll: 0, hero, cleared: 99 };
}

function measure(id: WeaponId, mode: 'lv5' | 'evo' | 'link', hero: string, crowd: number): number {
  const ch = { ...CHAPTERS[0], waves: [], events: [], duration: 1e9 };
  const b = new Battle(ch as any, stats(hero), 280, 560);
  b.weapons.length = 0;
  b.addWeapon(id);
  const w = b.weapon(id)!;
  w.lv = 5;
  if (mode !== 'lv5') b.applyChoice({ kind: 'evo', id });
  b.recalc();
  // 武将天赋（冷却/范围/伤害）保留，暴击去掉，便于横向比较
  b.crit = 0;
  let total = 0;
  const orig = b.damage.bind(b);
  b.damage = (e, base, kx, ky, knock, opts) => { const hp = e.hp; const r = orig(e, base, kx, ky, knock, opts); total += hp - Math.max(0, e.hp); return r; };
  const spawn = (n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = crowd === 1 ? 30 : 20 + Math.random() * 130;
      const e = b.spawnEnemy('wei_spear', b.player.x + Math.cos(a) * d, b.player.y + Math.sin(a) * d);
      e.maxHp = e.hp = 1e12;
      // 单体：模拟首领（体型大、不被击退、贴身）
      if (crowd === 1) { e.mass = 1e9; e.r = 14; e.scale = 2; e.speed = 20; }
    }
  };
  spawn(crowd);
  const dt = 1 / 30;
  for (let t = 0; t < SEC; t += dt) {
    b.player.hp = b.player.maxHp;
    b.update(dt);
    // 被打飞太远的补回来，保持人群密度
    for (const e of b.enemies) if (Math.hypot(e.x - b.player.x, e.y - b.player.y) > 200) { const a = Math.random() * 6.28; e.x = b.player.x + Math.cos(a) * 120; e.y = b.player.y + Math.sin(a) * 120; }
    b.pendingLevelUps = 0; b.pendingChests.length = 0;
  }
  return total / SEC / ATK;
}

const heroOf = (id: WeaponId) => WEAPONS[id].hero || 'zhaoyun';
const rows: string[] = [];
for (const id of Object.keys(WEAPONS) as WeaponId[]) {
  const d = WEAPONS[id];
  const h = heroOf(id);
  const r = [measure(id, 'lv5', h, CROWD), measure(id, 'evo', h, CROWD), measure(id, 'lv5', h, 1), measure(id, 'evo', h, 1)];
  rows.push(`${(d.name + '　　　　').slice(0, 5)} 人群:Lv5 ${r[0].toFixed(1).padStart(6)}  进化 ${r[1].toFixed(1).padStart(6)} | 单体:Lv5 ${r[2].toFixed(1).padStart(5)}  进化 ${r[3].toFixed(1).padStart(5)}`);
  for (const l of d.links || []) {
    if (l.hero === h && d.hero) continue;
    const x = [measure(id, 'link', l.hero, CROWD), measure(id, 'link', l.hero, 1)];
    rows.push(`  ★${(l.name + '　　　　').slice(0, 5)}(${HERO_BY_ID[l.hero].name}) 人群:专属 ${x[0].toFixed(1).padStart(6)} | 单体:专属 ${x[1].toFixed(1).padStart(5)}`);
  }
}
console.log(`每秒伤害 ÷ 攻击力（${CROWD}人密集人群 / 单个目标，${SEC}秒平均，无暴击）`);
console.log(rows.join('\n'));
void weaponLink;
