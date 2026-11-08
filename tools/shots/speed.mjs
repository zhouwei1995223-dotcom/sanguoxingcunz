import assert from 'node:assert/strict';
// 1.5 倍速：征战免费；守城 / 无尽 / 每周挑战先看一次视频（网页模拟广告约 2 秒）再开启。
// Q='?skip=1' node tools/shot.mjs speed（ROOT=dist/xhs 时全部免费）
export default async function ({ page, wait, shot }) {
  const noAds = (process.env.ROOT || '').includes('xhs');
  const clickId = async (id) => {
    const p = await page.evaluate((id) => { const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect(); return r && [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H]; }, id);
    assert.ok(p, 'no region ' + id); await page.mouse.click(p[0], p[1]);
  };
  const clean = () => page.evaluate(() => { const g = window.__game, b = g.scene.battle; if (!b) return; g.dialogs.length = 0; b.player.maxHp = b.player.hp = 1e9; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; if (b.def) b.def.cityHp = b.def.cityMax; });
  for (const [name, id, arg] of [['campaign', 1, 0], ['defense', -3, 1], ['endless', 0, 0], ['weekly', -1, 0]]) {
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
    await page.evaluate(([id, arg]) => { const g = window.__game; g.dialogs.length = 0; window.__saveMod.save.stamina = 99; g.scene.startBattle(id, arg, 5); }, [id, arg]);
    await page.waitForFunction(() => window.__game.scene.battle);
    for (let i = 0; i < 4; i++) { await clean(); await wait(200); }
    await clean(); await wait(100);
    await clickId('speed');
    await wait(100);
    const st = await page.evaluate(() => { const s = window.__game.scene; return { fast: s.fast, pending: s.speedAdPending }; });
    const needAd = name !== 'campaign' && !noAds;
    if (needAd) {
      assert.equal(st.fast, false, name + ' should wait for ad'); assert.equal(st.pending, true, name + ' ad pending');
      await page.waitForFunction(() => window.__game.scene.fast, null, { timeout: 8000 });
    } else assert.equal(st.fast, true, name + ' should be free');
    await clean();
    const r = await page.evaluate(() => new Promise((res) => { const s = window.__game.scene, b = s.battle; const t0 = b.t, w0 = performance.now(); let f = 0; const tick = () => { const g = window.__game; g.dialogs.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (++f < 90) requestAnimationFrame(tick); else res({ ratio: (b.t - t0) / ((performance.now() - w0) / 1000), mul: s.speedMul }); }; requestAnimationFrame(tick); }));
    if (name === 'campaign' || name === 'defense') await shot('speed-' + name);
    // 再点一次切回 ×1（已解锁，不再看视频）
    await clickId('speed'); await wait(100);
    const back = await page.evaluate(() => ({ fast: window.__game.scene.fast, pending: window.__game.scene.speedAdPending }));
    assert.deepEqual(back, { fast: false, pending: false });
    console.log(name, 'ad:', needAd, 'game/real =', (r.ratio / r.mul).toFixed(2), 'x (weekly rule ×' + r.mul + ')');
    assert.ok(Math.abs(r.ratio / r.mul - 1.5) < 0.2, name + ' ratio ' + r.ratio);
    await page.reload(); // 回到主界面开下一种模式
  }
  console.log('speed ok');
}
