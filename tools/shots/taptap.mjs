// ROOT=dist/taptap Q='?skip=1&rich=1' node tools/shot.mjs taptap
// Windows 可设置 BROWSER_CHANNEL=msedge，使用已安装的 Edge。
import assert from 'node:assert/strict';

export default async function ({ page, wait, shot, errors }) {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(() => {
    window.__drawnTexts = new Set();
    const raw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.__drawnTexts.add(String(text));
      return raw.call(this, text, ...args);
    };
  });
  const texts = async () => {
    await page.evaluate(() => window.__drawnTexts.clear());
    await wait(150);
    return page.evaluate(() => [...window.__drawnTexts].join('\n'));
  };
  const click = async (id) => {
    await page.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id);
    const r = await page.evaluate((id) => {
      const g = window.__game, r = g.ui.prevRegions.find((r) => r.id === id);
      const c = g.ui.ctx.canvas.getBoundingClientRect();
      return { x: c.left + (r.x + r.w / 2) * c.width / g.ui.W, y: c.top + (r.y + r.h / 2) * c.height / g.ui.H };
    }, id);
    await page.touchscreen.tap(r.x, r.y);
    await wait(250);
  };
  const ids = () => page.evaluate(() => window.__game.ui.prevRegions.map((r) => r.id));
  const close = async () => { await page.evaluate(() => { window.__game.dialogs.length = 0; }); await wait(150); };

  // 在非 localhost 地址模拟平台部署：调试参数与测试全局对象都不能生效。
  const url = new URL(page.url());
  url.hostname = '127.0.0.1';
  url.search = '?skip=1&rich=1&heroes=1&cloud=1&sidebar=1';
  await page.goto(url.href);
  await wait(2400);
  assert.equal(await page.evaluate(() => typeof window.__game), 'undefined');
  assert.match(await texts(), /温馨提示/);
  await shot('taptap_privacy');

  // 开发地址完整走首启 → 同意 → 教学战斗 → 结算 → 主城。
  url.hostname = 'localhost';
  url.search = '';
  await page.goto(url.href);
  await page.waitForFunction(() => window.__game?.dialogs.some((d) => d.constructor.name === 'PrivacyDialog'));
  await wait(500);
  await click('pv_ok');
  await page.waitForFunction(() => window.__game.scene.battle);
  await wait(1000);
  assert.equal(await page.evaluate(() => window.__saveMod.save.agreedPrivacy), true);
  await shot('taptap_tutorial');
  await page.evaluate(() => { window.__game.dialogs.length = 0; window.__game.scene.finish(false); });
  await wait(1400);
  assert(!(await ids()).includes('res_double'));
  assert.doesNotMatch(await texts(), /双倍领取|直接领取|看视频/);
  await click('res_ok');
  await page.waitForFunction(() => window.__game.scene.constructor.name === 'HomeScene');

  // 商店免费宝箱：直接到账、计数增加；本日上限不能越过。
  url.search = '?skip=1&rich=1';
  await page.goto(url.href);
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await close();
  const side = await page.evaluate(() => Object.keys(window.__game.scene.sideBtnRect));
  assert(!side.includes('share'));
  await page.evaluate(() => { window.__game.scene.tab = 'shop'; });
  await wait(300);
  assert.doesNotMatch(await texts(), /看视频|观看视频|模拟激励视频/);
  await click('chest_ad_wood');
  assert.equal(await page.evaluate(() => window.__saveMod.save.daily.chestAd.wood), 1);
  assert.equal(await page.locator('#__adc').count(), 0);
  await close();
  await page.evaluate(() => { window.__saveMod.save.daily.chestAd.wood = 3; });
  await wait(250);
  assert(!(await ids()).includes('chest_ad_wood'));
  await shot('taptap_shop');

  // 用元宝复活，确实扣费；同局第二次死亡不再提供元宝复活。
  await page.evaluate(() => { window.__game.scene.tab = 'battle'; });
  await wait(200);
  await click('start_battle');
  await page.waitForFunction(() => window.__game.scene.battle);
  await close();
  await page.evaluate(() => { const b = window.__game.scene.battle; b.revives = 0; b.player.hp = 0; });
  await page.waitForFunction(() => window.__game.dialogs.some((d) => d.constructor.name === 'ReviveDialog'));
  const before = await page.evaluate(() => window.__saveMod.save.yuanbao);
  await shot('taptap_revive');
  await click('rv_yb');
  assert.equal(await page.evaluate(() => window.__saveMod.save.yuanbao), before - 100);
  assert.equal(await page.evaluate(() => window.__game.scene.battle.adReviveUsed), true);
  await page.evaluate(() => { window.__game.scene.battle.player.hp = 0; });
  await page.waitForFunction(() => window.__game.dialogs.some((d) => d.constructor.name === 'ReviveDialog'));
  assert(!(await ids()).some((id) => id === 'rv_yb' || id === 'rv_ad'));
  await click('rv_giveup');
  await wait(1400);
  await shot('taptap_result');
  await click('res_ok');
  await page.waitForFunction(() => window.__game.scene.constructor.name === 'HomeScene');
  await close();
  await shot('taptap_home');

  // 持久化：强制刷新后保留资源；不再开启调试参数。
  await page.evaluate(() => { window.__saveMod.save.gold = 12345; window.__saveMod.save.guide = 99; window.__saveMod.flushSave(true); });
  url.search = '?cloud=1&sidebar=1';
  await page.goto(url.href);
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  assert.equal(await page.evaluate(() => window.__saveMod.save.gold), 12345);
  assert.equal(await page.evaluate(() => window.__cloudMod.cloudEnabled()), false);
  assert.equal(requests.filter((r) => !/\/(index\.html|game\.js)(\?|$)/.test(r)).length, 0);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: 平台地址禁用调试、首启教学、免费宝箱与上限、元宝复活与次数、结算、本机存档、无外部请求');
}
