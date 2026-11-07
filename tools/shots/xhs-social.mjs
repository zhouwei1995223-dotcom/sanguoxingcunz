import assert from 'node:assert/strict';
import { clickId, startCampaign } from './_lib.mjs';

// ROOT=dist/xhs Q='?skip=1' node tools/shot.mjs xhs-social
export default async function({ page }) {
  await page.addInitScript(() => {
    window.social = { follow: 0, comment: false, note: false, calls: [] };
    const state = window.social;
    window.xhs = {
      launchOptions: { miniToolEnv: { buildVersion: 9530001 } },
      miniTool: {
        getFollowStatus: async () => ({ follow_status: state.follow }),
        followAuthor: async () => ({ follow_status: state.follow }),
        writeTempFile: async () => ({ filePath: 'mock://shot.jpg' }),
        interactionOpenApi: async () => {
          state.calls.push('comment');
          if (state.hold) await new Promise(resolve => { state.resume = resolve; });
          return { routed: state.comment };
        },
        postNote: async () => { state.calls.push('note'); if (!state.note) throw Error('cancel'); },
      },
    };
  });
  const home = async () => {
    await page.reload();
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
    await page.evaluate(() => window.__game.closeAll());
  };
  const click = id => clickId(page, id);
  const save = () => page.evaluate(() => window.__saveMod.save);
  await home();
  await click('side_xhs');
  await click('xhs_follow');
  assert.equal(!!(await save()).xhsFollowClaimed, false);
  await page.evaluate(() => window.social.follow = 1);
  await click('xhs_follow');
  assert.equal((await save()).heroes.sunshangxiang.owned, true);
  await home();
  assert.equal((await save()).xhsFollowClaimed, true);
  await click('nav_shop');
  await click('chest_social_gold');
  assert.equal((await save()).daily.xhsGoldTenStep, undefined);
  await page.evaluate(() => { window.social.comment = true; window.social.hold = true; });
  await click('chest_social_gold');
  // 同一发布请求等待期间再次点击相同坐标。
  await page.mouse.down(); await page.mouse.up();
  await page.evaluate(() => { window.social.resume(); window.social.hold = false; });
  await page.waitForFunction(() => window.__game.dialogs.some(d => d.results?.length === 10));
  await click('cr_batch_ok');
  assert.equal((await save()).daily.xhsGoldTenStep, 1);
  await click('chest_social_gold'); // 取消发布笔记
  assert.equal((await save()).daily.xhsGoldTenStep, 1);
  await page.evaluate(() => window.social.note = true);
  await click('chest_social_gold');
  await click('cr_batch_ok');
  assert.equal((await save()).daily.xhsGoldTenStep, 2);
  assert.deepEqual(await page.evaluate(() => window.social.calls), ['comment', 'comment', 'note', 'note']);
  await home();
  assert.equal((await save()).daily.xhsGoldTenStep, 2);
  await startCampaign(page);
  await page.evaluate(() => { window.__game.closeAll(); window.__game.scene.finish(false); });
  await page.waitForFunction(() => window.__game.ui.prevRegions.some(r => r.id === 'res_comment'));
  const before = (await save()).yuanbao;
  await page.evaluate(() => { window.social.note = true; window.social.comment = true; });
  await click('res_comment'); await click('res_comment');
  await click('res_note'); await click('res_note');
  assert.equal((await save()).yuanbao, before + 4000);
  assert.equal((await save()).daily.xhsGoldTenStep, 2);
  await page.evaluate(() => {
    const m = window.__saveMod;
    // 从上一版升级当天已经使用过免费金匣十连。
    delete m.save.daily.xhsGoldTenStep;
    m.save.daily.chestTenAd.gold = true;
    m.flushSave(true);
  });
  await home();
  await page.evaluate(() => window.social.note = true);
  await click('nav_shop'); await click('chest_social_gold'); await click('cr_batch_ok');
  assert.deepEqual(await page.evaluate(() => window.social.calls), ['note']);
  await page.evaluate(() => {
    window.__saveMod.save.daily.day = 'yesterday';
    window.__saveMod.rolloverDaily();
    window.social.comment = true;
  });
  await click('chest_social_gold'); await click('cr_batch_ok');
  assert.equal((await save()).daily.xhsGoldTenStep, 1);
  console.log('XHS follow, ordered chest draws, retries, persistence and independent daily yuanbao OK');
}
