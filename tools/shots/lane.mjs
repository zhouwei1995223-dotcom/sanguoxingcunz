// 小红书塔防：主页页签、兵线对冲、升级三选一。ROOT=dist/xhs Q='?skip=1'
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await shot('lane_tabs');
  await page.evaluate(() => { window.__game.ui.clickedId = 'mode_lane'; });
  await wait(400);
  await shot('lane_home');
  await page.evaluate(() => { window.__game.ui.clickedId = 'start_lane'; });
  await page.waitForFunction(() => window.__game.scene && window.__game.scene.constructor.name === 'LaneScene');
  await wait(600);
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const rect = await page.evaluate(() => {
    const s = window.__game.scene;
    const cards = s.battle.hand.map((c, i) => ({ i, cost: c.cost, food: s.battle.food, name: c.name }));
    return { cards, rects: s.cardRects, food: s.battle.food };
  });
  console.log('hand', JSON.stringify(rect.cards));
  const playable = rect.cards.find((c) => c.cost <= rect.food);
  if (!playable) throw new Error('no affordable card');
  const r = rect.rects[playable.i];
  await tap(r.x / dpr + r.w / dpr / 2, r.y / dpr + r.h / dpr / 2);
  await wait(400);
  const spawned = await page.evaluate(() => window.__game.scene.battle.units.filter((u) => u.side === 'ally').length);
  console.log('spawned', spawned);
  if (spawned < 1) throw new Error('tap did not spawn');
  await page.evaluate(() => { window.__game.scene.battle.step(2.2); });
  await wait(500);
  await shot('lane_battle');
  await page.evaluate(() => { window.__game.scene.battle.debugOffer(); });
  await wait(400);
  await shot('lane_upgrade');
  const names = await page.evaluate(() => window.__game.scene.battle.pending.map((u) => u.name));
  console.log('upgrade', names.join(','));
  if (!names || names.length !== 3) throw new Error('upgrade not 3');
}
