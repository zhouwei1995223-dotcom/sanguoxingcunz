import assert from 'node:assert/strict';
// 布阵：点将令后战斗暂停，点地图落点后继续；取消选点也继续。Q='?skip=1&tower=1' node tools/shot.mjs tower-aim
export default async function ({ page, wait, shot }) {
  const pt = (id) => page.evaluate((id) => { const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect(); return r && [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H, c.x + (r.x + r.w * 0.5) * c.width / ui.W, c.y + (r.y + r.h * 0.45) * c.height / ui.H]; }, id);
  const click = async (id) => { const p = await pt(id); assert.ok(p, 'no ' + id); await page.mouse.click(p[0], p[1]); await wait(120); };
  const clearOffer = () => page.evaluate(() => { const b = window.__game.scene.battle; while (b.offer) b.choose(b.offer.cards[0]); });
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'TowerScene');
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__game.scene.battle.elapsed)) < 6; i++) { await clearOffer(); await wait(300); }
  await clearOffer();
  await page.evaluate(() => { window.__game.scene.battle.commandCd = 0; });
  await wait(200); await clearOffer();
  // 1. 点将令 → 暂停
  await click('td_command');
  const t0 = await page.evaluate(() => ({ aiming: window.__game.scene.aiming, t: window.__game.scene.battle.elapsed }));
  assert.equal(t0.aiming, true);
  await wait(1200);
  const t1 = await page.evaluate(() => window.__game.scene.battle.elapsed);
  assert.equal(t1, t0.t, 'battle should be paused while aiming');
  await shot('tower-aim-paused');
  // 2. 取消选点 → 继续
  await click('td_command');
  await wait(600);
  const t2 = await page.evaluate(() => ({ aiming: window.__game.scene.aiming, t: window.__game.scene.battle.elapsed }));
  assert.equal(t2.aiming, false); assert.ok(t2.t > t1, 'resumes after cancel');
  // 3. 再点将令 → 点地图释放 → 继续
  await clearOffer(); await click('td_command');
  const cd0 = await page.evaluate(() => window.__game.scene.battle.commandCd);
  const map = await pt('td_target');
  await page.mouse.click(map[2], map[3]); await wait(150);
  const t3 = await page.evaluate(() => ({ aiming: window.__game.scene.aiming, t: window.__game.scene.battle.elapsed, cd: window.__game.scene.battle.commandCd }));
  assert.equal(t3.aiming, false); assert.ok(t3.cd > cd0, 'command cast (cooldown started)');
  await wait(600);
  const t4 = await page.evaluate(() => window.__game.scene.battle.elapsed);
  assert.ok(t4 > t3.t, 'resumes after cast');
  console.log('tower-aim ok', JSON.stringify({ paused: t1 - t0.t, cd: t3.cd.toFixed(1) }));
}
