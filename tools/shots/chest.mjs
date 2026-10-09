// 名将宝匣：保底出整将，结果弹窗
export default async function ({ page, wait, shot }) {
  await wait(2700);
  const r = await page.evaluate(() => {
    const g = window.__game; g.dialogs.length = 0;
    const out = [];
    for (let i = 0; i < 15; i++) { g.scene.openChestNow('gold'); const d = g.dialogs[g.dialogs.length - 1]; out.push(d.hero ? 'H:' + d.hero.id + ':' + d.hero.got : 'S'); g.dialogs.length = 0; }
    g.scene.openChestNow('gold');
    return out.join(' ');
  });
  console.log(r);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openChestNow('gold'); const d = g.dialogs[0]; if (!d.hero) d.hero = { id: 'zhuge', got: 'new' }; });
  await wait(2000);
  await shot('chest_hero');
}
