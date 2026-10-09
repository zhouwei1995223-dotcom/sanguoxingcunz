export default async function ({ page, wait }) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('injected')) return;
    sessionStorage.setItem('injected', '1');
    localStorage.setItem('sgxc_save_v1', JSON.stringify({ v: 1, gold: 5000, heroLv: 12, firstClear: { 1: true, 2: true }, chapterBest: { 1: 600, 2: 600, 3: 320 }, maxCleared: 2, guide: 99, agreedPrivacy: true, items: [], equipped: {} }));
  });
  await page.reload();
  await wait(4000); console.log('scene', await page.evaluate(() => window.__game.scene.constructor.name + ' ' + window.__game.dialogs.map(d=>d.constructor.name)));
  await wait(500);
  console.log(JSON.stringify(await page.evaluate(() => { const s = window.__saveMod.save; return { zy: s.heroes.zhaoyun.lv, gy: s.heroes.guanyu.owned, clears: s.clears, bests: s.bests, hero: s.hero }; })));
}
