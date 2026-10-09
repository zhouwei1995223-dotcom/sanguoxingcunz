export default async function ({ page, wait, shot, tap }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  console.log(await page.evaluate(() => window.__game.dialogs.map(d => d.constructor.name).join(',')));
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await tap(351, 805); await wait(500);
  console.log('tab', await page.evaluate(() => window.__game.scene.tab), await page.evaluate(() => window.__game.dialogs.map(d => d.constructor.name).join(',')));
}
