import assert from 'node:assert/strict';

// Q='?skip=1' node tools/shot.mjs tower-formations
export default async function({ page }) {
  async function enter(map) {
    const url = new URL(page.url());
    url.search = '?skip=1&tower=' + map;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game?.scene?.battle?.map?.id > 0);
  }
  await enter(2);
  const cases = await page.evaluate(() => {
    const live = window.__game.scene.battle;
    function battle() {
      return new live.constructor(live.map, live.hero, 0, () => .5);
    }
    function take(b, type, id) {
      const card = b.rewardPool().find(c => c.type === type && (type === 'tower' ? c.kind === id && c.level === 1 : c.id === id));
      b.offer = { aid: false, cards: [card] };
      return b.choose(card);
    }
    function put(b, x, y, rank = 'troop') {
      b.spawn(rank);
      const e = b.enemies[b.enemies.length - 1];
      Object.assign(e, { x, y, hp: 1000, maxHp: 1000 });
      return e;
    }
    const results = [];
    for (const [kind, id] of [['stone', 'frost'], ['bolt', 'lightning'], ['oil', 'wildfire']]) {
      for (const reverse of [false, true]) {
        const b = battle(), picks = [['tower', kind], ['tactic', id]];
        if (reverse) picks.reverse();
        take(b, ...picks[0]);
        results.push(b.formations.size === 0);
        take(b, ...picks[1]);
        results.push(b.formations.size === 1 && b.formations.has(id));
      }
      // 同一组敌人，分别核对有联动与缺阵法时的实际受伤者。
      for (const active of [false, true]) {
        const b = battle();
        take(b, 'tower', kind);
        if (active) take(b, 'tactic', id);
        const hit = put(b, 40, 40), side = put(b, 40, 68);
        if (kind === 'bolt') {
          b.attack(b.towers[1], 0, 40, hit);
          results.push(hit.hp < 1000 && (side.hp < 1000) === active);
        } else {
          const missile = { kind, x: 0, y: 40, tx: 40, ty: 40, age: 0, life: .2, radius: 24, impactDamage: 20, burnTime: 2 };
          b.impact(missile);
          results.push(side.hp === 1000);
          hit.frozenUntil = b.elapsed + 1;
          b.impact(missile);
          results.push((side.hp < 1000) === active);
        }
      }
    }
    function march(stun) {
      const b = battle();
      b.towers.fill(null);
      const flag = put(b, 0, 59, 'elite'), troop = put(b, 0, 59);
      flag.stun = stun;
      b.update(1 / 30);
      return troop.x;
    }
    results.push(Math.abs(march(0) / march(1) - 1.12) < .001);
    return results;
  });
  assert.ok(cases.every(Boolean), JSON.stringify(cases));
  await enter(3);
  const shield = await page.evaluate(() => {
    const live = window.__game.scene.battle, b = new live.constructor(live.map, live.hero, 0, () => .5);
    b.spawn('elite');
    const e = b.enemies[0], hp = e.hp, shield = e.shield;
    b.hit(e, 1);
    const normal = e.shield === shield - 1 && e.hp === hp;
    b.hit(e, 1, true);
    const siege = e.shield === shield - 3 && e.hp === hp;
    b.hit(e, e.shield / 2 + 2, true);
    return normal && siege && e.hp === hp - 2 && e.shield === 0 && b.strikes.filter(s => s.kind === 'breakShield').length === 1;
  });
  assert.ok(shield);
}
