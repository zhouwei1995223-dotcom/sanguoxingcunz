// 文字缓存命中情况：主界面 / 征战各 120 帧的未命中与清空次数
import { startCampaign } from './_lib.mjs';
const stat = (page, label) => page.evaluate((label) => new Promise((res) => {
  const tc = window.__game.ui.textCache; const m0 = tc.misses, c0 = tc.clears; const seen = new Set();
  let f = 0; const tick = () => { seen.add(tc.lastMiss); if (++f < 120) requestAnimationFrame(tick); else res(label + ' misses/frame=' + ((tc.misses - m0) / 120).toFixed(2) + ' clears=' + (tc.clears - c0) + ' sample=' + JSON.stringify([...seen].slice(-8))); };
  requestAnimationFrame(tick);
}), label);
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(1000);
  console.log(await stat(page, 'home'));
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await startCampaign(page);
  await page.waitForFunction(() => window.__game.scene.battle);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.player.maxHp = b.player.hp = 1e9; b.t = 200; });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; }); await wait(300); }
  console.log(await stat(page, 'battle'));
}
