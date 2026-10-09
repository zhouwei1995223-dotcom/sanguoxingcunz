export default async function ({ page, wait, shot, tap }) {
  const home = async () => { await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene'); await wait(400); await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(300); };
  const open = async (name, cls) => { await page.evaluate((c) => { window.__game.dialogs.length = 0; }, cls); await wait(200); };
  await home();
  // 造一些进度数据
  await page.evaluate(() => { const s = window.__saveMod.save; s.stats.kills = 12345; s.stats.bossKills = 7; s.codex.bosses = { xiahouen: 2, caochun: 1 }; s.codex.enemies = { wei_spear: 300, wei_shield: 80, bandit: 50 }; s.codex.weapons = { spear: 1 }; s.stats.runs = 3; });
  await shot('f_home');
  const sideTap = async (label, x, y) => { await tap(x, y); await wait(600); await shot('f_' + label); await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(300); };
  // 左列：签到、七日、任务、巡营、挑战；右列：排行、图鉴、设置、分享
  const pos = await page.evaluate(() => { const u = window.__game.ui.u, top = window.__game.ui.safeTop + 190 * u, sy = top + 180 * u; return { u, sy, W: window.__game.ui.W }; });
  const css = (v) => v / 2;
  const step = 124 * pos.u;
  await sideTap('newbie', css(18 * pos.u + 42 * pos.u), css(pos.sy + step * 1 + 42 * pos.u));
  await sideTap('weekly', css(18 * pos.u + 42 * pos.u), css(pos.sy + step * 4 + 42 * pos.u));
  await sideTap('codex', css(pos.W - 60 * pos.u), css(pos.sy + step * 1 + 42 * pos.u));
  await tap(css(pos.W - 60 * pos.u), css(pos.sy + step * 1 + 42 * pos.u)); await wait(500);
  await page.evaluate(() => { const d = window.__game.dialogs[0]; if (d) d.tab = 'bosses'; }); await wait(300); await shot('f_codex_boss');
  await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(300);
  await sideTap('settings', css(pos.W - 60 * pos.u), css(pos.sy + step * 2 + 42 * pos.u));
  // 武将页皮肤
  await tap(351, 805); await wait(400);
  await page.mouse.move(195, 650); await page.mouse.down(); await page.mouse.move(195, 250, { steps: 10 }); await page.mouse.up(); await wait(600);
  await shot('f_skin');
}
