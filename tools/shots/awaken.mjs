// 五星觉醒造型 + 巅峰等级：武将页、主界面、战斗中
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => {
    const g = window.__game; const sv = window.__saveMod.save; g.dialogs.length = 0;
    const h = sv.heroes.lvbu; h.owned = true; h.star = 5; h.shards = 300; h.peak = 12; h.awaken = true; sv.hero = 'lvbu';
    g.scene.tab = 'hero'; g.scene.viewHero = 'lvbu';
  });
  await wait(500);
  await shot('awk_herotab');
  await page.evaluate(() => { const g = window.__game; const s = Object.values(g.ui.scrolls || {}); for (const x of s) x.offset = x.max; });
  await wait(400);
  await shot('awk_herotab2');
  await page.evaluate(() => { const g = window.__game; g.scene.tab = 'battle'; });
  await wait(500);
  await shot('awk_home');
  await page.evaluate(() => { const g = window.__game; g.scene.startBattle(1); });
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(2500);
  await shot('awk_battle');
}
