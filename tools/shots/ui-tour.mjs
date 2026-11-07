import fs from 'node:fs';
import path from 'node:path';

// 全游戏界面巡检：Q='?skip=1' node tools/shot.mjs ui-tour
// 主界面五个底栏页签、侧边弹窗、征战战斗 HUD / 升级选卡 / 暂停 / 结算、守城战斗。
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  const capture = name => page.screenshot({ path: path.join(out, 'ui-' + name + '.png') });
  const wait = ms => page.waitForTimeout(ms);
  const pt = async id => page.evaluate(id => {
    const ui = window.__game.ui, r = ui.prevRegions.find(v => v.id === id);
    if (!r) return null;
    const c = document.querySelector('canvas').getBoundingClientRect();
    return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
  }, id);
  const button = async id => { const p = await pt(id); if (!p) { console.log('missing', id); return false; } await page.mouse.click(...p); await wait(350); return true; };
  const close = async () => { await page.evaluate(() => window.__game.closeAll()); await wait(250); };
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(800);
  await close();
  await capture('home');
  const ids = await page.evaluate(() => window.__game.ui.prevRegions.map(r => r.id));
  console.log('regions', ids.join(' '));
  for (const id of ids.filter(i => /^(nav|tab)_/.test(i))) {
    await button(id); await wait(300); await capture(id);
  }
  const navHome = ids.find(i => /^(nav|tab)_.*(battle|home|main)/.test(i));
  if (navHome) await button(navHome);
  for (const id of ['side_signin', 'side_tasks', 'side_settings', 'side_codex']) {
    if (await button(id)) { await wait(300); await capture(id); await close(); }
  }
  // 征战
  await page.evaluate(() => window.__game.scene.startBattle(1));
  await wait(1200);
  await capture('battle-qiyu');
  await close();
  await page.evaluate(() => { const s = window.__game.scene; for (let i = 0; i < 30 * 40; i++) { if (window.__game.dialogs.length) break; s.battle?.update?.(1 / 30); } });
  await wait(600);
  await capture('battle-dialog');
  await close();
  await wait(2500);
  await capture('battle-hud');
  // 升级选卡（用场景自带的测试入口）
  await close();
  await page.evaluate(() => { const sc = window.__game.scene; sc.openLevelUpForTest(sc.battle.rollChoices()); });
  await wait(900);
  await capture('battle-levelup');
  await close();
  await button('pause'); await wait(400); await capture('battle-pause');
}
