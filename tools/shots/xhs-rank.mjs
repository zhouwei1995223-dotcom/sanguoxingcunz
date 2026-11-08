import assert from 'node:assert/strict';
// 小红书全员榜：模拟 window.xhs（9.53）的 submitScore / getRankList / getMyRank，第一次取榜返回 2002 验证退避；
// 结算按「万」提交本局天命伤害；排行框显示总榜 / 日榜。ROOT=dist/xhs Q='?skip=1' node tools/shot.mjs xhs-rank
export default async function ({ page, wait, shot }) {
  await page.addInitScript(() => {
    const calls = (window.__rankCalls = { submit: [], list: 0, my: 0 });
    let first = true;
    const rows = Array.from({ length: 30 }, (_, i) => ({ rank: i + 1, score: Math.round((80000 - i * 2300) * 10) / 10, nickname: i === 3 ? null : '玩家' + (i + 1) }));
    window.xhs = {
      launchOptions: { miniToolEnv: { buildVersion: '9530004', userDataPath: '/usr' } },
      miniTool: {
        getStorage: () => Promise.resolve({ errMsg: 'getStorage:ok', data: null }),
        setStorage: () => Promise.resolve({ errMsg: 'setStorage:ok' }),
        getStorageInfo: () => Promise.resolve({ errMsg: 'getStorageInfo:ok', keys: [], usedBytes: 0, limitBytes: 10485760 }),
        removeStorage: () => Promise.resolve({}), clearStorage: () => Promise.resolve({}),
        submitScore: (o) => { calls.submit.push(o); return Promise.resolve({ score: o.score }); },
        getRankList: (o) => { calls.list++; if (first) { first = false; return Promise.reject({ errCode: 2002, errMsg: 'not ready' }); } return Promise.resolve({ data: o.period === 'day' ? rows.slice(0, 5) : rows }); },
        getMyRank: () => { calls.my++; return Promise.resolve({ status: 'EXACT', rank: 7, score: 63210.5 }); },
      },
    };
  });
  await page.reload();
  // reload 之后旧页面可能还没换掉：确认是新页面（有模拟的排行接口）且已进主界面
  await page.waitForFunction(() => window.__rankCalls && window.__game?.scene?.constructor.name === 'HomeScene', null, { timeout: 20000 });
  await wait(800);
  // 新存档会自动弹签到、读档也可能晚一步覆盖设置：反复设置直到天机卡片的按钮出现
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => { const g = window.__game, s = window.__saveMod.save; g.dialogs.length = 0; s.homeMode = 'tianji'; s.guide = 99; s.agreedPrivacy = true; s.stamina = 60; g.scene.tab = 'battle'; g.scene.autoPopped = true; const d = new Date(); s.signinDay = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); });
    await wait(250);
    if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'tj_rank'))) break;
  }
  const pt = (id) => page.evaluate((id) => { const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect(); return r && [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H]; }, id);
  const click = async (id) => { await page.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id, { timeout: 8000 }); const p = await pt(id); await page.mouse.click(p[0], p[1]); await wait(200); };
  for (let i = 0; i < 5; i++) {
    await click('tj_rank');
    const d = await page.evaluate(() => window.__game.dialogs.map((x) => x.constructor.name));
    if (d.includes('RankDialog')) break;
    await page.evaluate(() => { window.__game.dialogs.length = 0; window.__game.scene.autoPopped = true; });
    await wait(300);
  }
  await wait(300); await shot('xhs-rank-loading');
  await page.waitForFunction(() => window.__rankCalls.list >= 2, null, { timeout: 8000 });
  await wait(600); await shot('xhs-rank-all');
  await click('rk_xhs_day');
  await wait(1200); await shot('xhs-rank-day');
  // 结算提交：直接跑一局天机签结算
  for (let i = 0; i < 6 && !(await page.evaluate(() => !!window.__game.scene.battle)); i++) {
    await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; if (g.scene.autoPopped !== undefined) g.scene.autoPopped = true; window.__saveMod.save.stamina = 60; });
    await wait(200);
    if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'tj_start'))) await click('tj_start');
    await wait(400);
  }
  await page.waitForFunction(() => window.__game.scene.battle?.tj, null, { timeout: 8000 });
  await page.evaluate(() => { const s = window.__game.scene, b = s.battle; b.tj.finalDmg = 632105000; b.t = 600; b.won = true; s.finish(true); });
  await wait(800);
  const calls = await page.evaluate(() => window.__rankCalls);
  console.log('rank calls', JSON.stringify(calls));
  assert.deepEqual(calls.submit[calls.submit.length - 1], { board: 1, score: 63210.5 });
  assert.ok(calls.list >= 3, 'retried after 2002 and loaded two periods');
  console.log('xhs-rank ok');
}
