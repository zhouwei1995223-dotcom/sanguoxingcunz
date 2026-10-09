// 主城各页签与弹窗截图
export default async function ({ page, wait, shot, tap }) {
  await wait(2700);
  const open = async (name, fn) => { await page.evaluate(fn); await wait(700); await shot(name); await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(200); };
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await shot('home_battle');
  const tabs = { shop: 39, equip: 117, talent: 273, hero: 351 };
  for (const [name, x] of Object.entries(tabs)) { await tap(x, 805); await wait(500); await shot('home_' + name); }
  await tap(195, 805); await wait(400);
  // 侧边按钮：按实际位置点击（布局会随屏幕高度变化）
  const side = async (id, name) => {
    const [x, y] = await page.evaluate((id) => { const r = window.__game.scene.sideBtnRect[id]; const k = window.devicePixelRatio; return [(r[0] + r[2] / 2) / k, (r[1] + r[3] / 2) / k]; }, id);
    await tap(x, y); await wait(700); await shot(name); await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(200);
  };
  await side('signin', 'dlg_signin');
  await side('tasks', 'dlg_tasks');
  await side('patrol', 'dlg_patrol');
  await side('settings', 'dlg_settings');
  await side('rank', 'dlg_rank');
  // 商店开箱
  await tap(39, 805); await wait(400);
  await tap(330, 360); await wait(2200); await shot('dlg_chest_result'); await page.evaluate(() => { window.__game.dialogs.length = 0; });
  // 装备详情
  await tap(117, 805); await wait(400);
  await tap(50, 140); await wait(700); await shot('dlg_item');
}
