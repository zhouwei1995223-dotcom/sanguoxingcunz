import path from 'node:path';
// 征战战斗画风参照：Q='?skip=1' node tools/shot.mjs style-battle
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__game.closeAll());
  await page.evaluate(() => window.__game.scene.startBattle(1));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.closeAll());
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(out, 'style-campaign.png') });
}
