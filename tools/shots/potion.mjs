// 金疮药：战斗按钮（就绪 / 冷却 / 低血发光）与军略页
export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await tap(195, 722);
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.player.hp = b.player.maxHp * 0.3; });
  await wait(400);
  await shot('potion_low');
  // 点击按钮喝药
  const r = await page.evaluate(() => { const s = window.__game.scene; return s.potionBtn; });
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await tap(r.x / dpr, r.y / dpr);
  await wait(300);
  const st = await page.evaluate(() => { const b = window.__game.scene.battle; return { hp: Math.round(b.player.hp), max: b.player.maxHp, cd: b.potionCd, uses: b.potionUses }; });
  console.log('after tap', JSON.stringify(st));
  await wait(1500);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await shot('potion_cd');
  // 右侧模式
  await page.evaluate(() => { const s = window.__saveMod.save; s.settings.ultRight = true; window.__game.dialogs.length = 0; });
  await wait(300);
  await shot('potion_right');
  // 军略页
  await page.evaluate(() => { const s = window.__saveMod.save; s.gold = 99999; s.talents.t_potion = 3; });
  const scn = await page.evaluate(() => { window.__game.dialogs.length = 0; return window.__game.scene.constructor.name; });
  console.log(scn);
}
