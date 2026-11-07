// Q='?skip=1' node tools/shot.mjs tower-placement
import assert from 'node:assert/strict';

export default async function ({ page }) {
  async function point(id, slot) {
    return page.evaluate(([id, slot]) => {
      const { ui, scene } = window.__game;
      const r = ui.prevRegions.find(v => v.id === id);
      const [x, y] = slot === null ? [0.5, 0.5] : scene.battle.map.sites[slot].map((n, axis) => n / (axis ? 400 : 320));
      const c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w * x) * c.width / ui.W, c.y + (r.y + r.h * y) * c.height / ui.H];
    }, [id, slot ?? null]);
  }
  async function tap(id, slot) {
    await page.waitForFunction(id => window.__game.ui.prevRegions.some(v => v.id === id), id);
    await page.mouse.click(...await point(id, slot));
    await page.waitForTimeout(80);
  }
  for (const [level, expected] of [[1, 16], [2, 18], [3, 20]]) {
    const url = new URL(page.url());
    url.search = '?skip=1&rich=1&tower=' + level;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game?.ui.prevRegions.some(r => r.id === 'td_ground'));
    const layout = await page.evaluate(() => {
      const { ui, scene } = window.__game, r = ui.prevRegions.find(v => v.id === 'td_ground');
      return { width: r.w / ui.W, slots: scene.battle.map.sites.length, grain: scene.battle.grain };
    });
    assert.ok(layout.width >= 0.97);
    assert.equal(layout.slots, expected);
    await tap('td_pick_arrow');
    // 按住能看射程，拖开取消。单击一块空位只买一座，塔种保持选中。
    const [x, y] = await point('td_ground', 0);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 32, y + 10, { steps: 4 }); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__game.scene.battle.grain), layout.grain);
    for (let slot = 0; slot < expected; slot++) {
      await tap('td_ground', slot);
      const result = await page.evaluate(i => {
        const s = window.__game.scene;
        return [s.battle.towers[i]?.kind, s.battle.grain, s.buildKind];
      }, slot);
      assert.deepEqual(result, ['arrow', layout.grain - (slot + 1) * 55, 'arrow']);
    }
    await tap('td_ground', 0);
    await tap('td_sell');
    await tap('td_ground', 0);
    await tap('td_pick_oil');
    assert.equal(await page.evaluate(() => window.__game.scene.battle.towers[0].kind), 'oil');
    await tap('td_ground', 1);
    await tap('td_sell');
    await tap('td_ground', 2);
    await tap('td_sell');
    await page.evaluate(() => { window.__game.scene.battle.grain = 55; });
    await tap('td_pick_arrow');
    await tap('td_ground', 1);
    await tap('td_ground', 2);
    // 花光粮草后，点空位继续连建或点击灰色按钮都不会扣费。
    await tap('td_pick_arrow:disabled');
    assert.deepEqual(await page.evaluate(() => {
      const b = window.__game.scene.battle; return [b.grain, b.towers[2]];
    }), [0, null]);
  }
}
