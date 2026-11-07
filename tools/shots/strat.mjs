// 锦囊妙计：三种品质的选择界面 + 各计策实战效果
export default async function ({ page, wait, shot, tap }) {
  // 按按钮 / 卡片 id 点击（界面改版后坐标会变，固定坐标容易失效）
  const clickId = async (id) => {
    await page.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id, { timeout: 8000 });
    const p = await page.evaluate((id) => {
      const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
      return [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
    }, id);
    await page.mouse.click(...p);
    await wait(150);
  };
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await clickId('start_battle'); // 出征
  // 网页版出征前先选对局时长（5 / 10 分钟）
  if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await clickId('duration_5');
  else { await wait(300); if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'duration_5'))) await clickId('duration_5'); }
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(500);
  for (const tier of [0, 1, 2]) {
    await page.evaluate((tier) => { const g = window.__game; g.dialogs.length = 0; g.scene.openStrategyForTest(tier, tier); }, tier);
    await wait(900);
    await shot('strat_tier' + tier);
  }
  // 自然触发：时间推进到第一个锦囊时间点之前半秒（各版本时间点不同，从战斗里读）
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; b.t = b.stratTimes[0] - 0.5; });
  await page.waitForFunction(() => window.__game.dialogs.length && window.__game.dialogs[0].constructor.name === 'StrategyDialog', null, { timeout: 8000 });
  console.log('natural trigger ok, round', await page.evaluate(() => window.__game.scene.battle.stratRound));
  // 点第一张卡
  await wait(800);
  await clickId('strat_0');
  await wait(400);
  console.log('strats', await page.evaluate(() => window.__game.scene.battle.strats.join(',')));
  // 实战：一次拿齐主动类计策
  await page.evaluate(() => {
    const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle;
    b.player.maxHp = b.player.hp = 99999; b.base.atk = 60;
    ['wanjian', 'bazhen', 'shimian', 'huoshao', 'lianhuan', 'jiedao'].forEach((id) => b.applyStrat(id));
    b.t = 300; b.pendingLevelUps = 0;
  });
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.battle.pendingLevelUps = 0; g.scene.battle.pendingChests.length = 0; g.scene.battle.pendingStrats.length = 0; });
    await page.keyboard.down(['d', 's', 'a', 'w'][i % 4]); await wait(400); await page.keyboard.up(['d', 's', 'a', 'w'][i % 4]);
  }
  await page.evaluate(() => { const b = window.__game.scene.battle; b.stratT.wanjian = 0.01; });
  await wait(450);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await shot('strat_play');
  console.log(JSON.stringify(await page.evaluate(() => { const b = window.__game.scene.battle; return { kills: b.kills, strats: b.strats, hp: b.player.hp }; })));
}
