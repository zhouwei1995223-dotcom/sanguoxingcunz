import assert from 'node:assert/strict';
// 天机签整体巡检：主界面卡片、玩法、开局 HUD、摇签动画三个阶段、各类签的揭晓、砍树、巨人化 / 迷雾 / 陨石 / 夺兵、结算。
// Q='?skip=1' node tools/shot.mjs tianji（ROOT=dist/xhs 测小红书版）
export default async function ({ page, wait, shot }) {
  const pt = (id) => page.evaluate((id) => {
    const ui = window.__game.ui, r = ui.prevRegions.find((v) => v.id === id), c = document.querySelector('canvas').getBoundingClientRect();
    return r && [c.x + (r.x + r.w / 2) * c.width / ui.W, c.y + (r.y + r.h / 2) * c.height / ui.H];
  }, id);
  const click = async (id) => { await page.waitForFunction((id) => window.__game.ui.prevRegions.some((r) => r.id === id), id, { timeout: 8000 }); const p = await pt(id); await page.mouse.click(p[0], p[1]); await wait(150); };
  const S = () => page.evaluate(() => { const s = window.__game.scene, b = s.battle; return { scene: s.constructor.name, dlg: window.__game.dialogs.map((d) => d.constructor.name), t: b?.t, tickets: b?.tj?.tickets, coins: b?.coins, hist: b?.tj?.history.length, weapons: b?.weapons.map((w) => w.id + (w.evo ? '★' : w.lv)) }; });

  // SMOOTH=1：强制 imageSmoothingEnabled 永远为 true，模拟微信画布，检查图标 / 树 / 签筒会不会糊
  if (process.env.SMOOTH) {
    await page.addInitScript(() => { const P = CanvasRenderingContext2D.prototype, d = Object.getOwnPropertyDescriptor(P, 'imageSmoothingEnabled'); Object.defineProperty(P, 'imageSmoothingEnabled', { get() { return true; }, set() { d.set.call(this, true); } }); });
    await page.reload();
  }
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { window.__game.closeAll ? window.__game.closeAll() : (window.__game.dialogs.length = 0); });
  await click('mode_tianji');
  await wait(600);
  await shot('tj-home');
  await click('tj_rules');
  await wait(500);
  await shot('tj-rules');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  await click('tj_rank');
  await wait(500);
  await shot('tj-rank-empty');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(200);
  const stam0 = await page.evaluate(() => window.__saveMod.save.stamina);
  await click('tj_start');
  await page.waitForFunction(() => window.__game.scene.battle?.tj);
  assert.equal(await page.evaluate(() => window.__saveMod.save.stamina), stam0 - 10, 'costs 10 stamina');
  await wait(2500);
  const s0 = await S();
  assert.equal(s0.tickets, 2, 'start with 2 tickets');
  assert.deepEqual(s0.weapons, ['sword2']);
  await shot('tj-hud');

  // 摇签：三个阶段（第一签固定成金币袋，后面的断言才稳定）
  await page.evaluate(() => { window.__game.scene.battle.tj.force = 'coins'; });
  await click('tj_draw');
  await wait(350); await shot('tj-draw-shake');
  await wait(500); await shot('tj-draw-fly');
  await wait(900); await shot('tj-draw-reveal');
  await click('tj_ok');
  const s1 = await S();
  assert.equal(s1.hist, 1); assert.equal(s1.tickets, 1);

  // 指定各类签看揭晓
  const force = async (id, name) => {
    await page.evaluate((id) => { const b = window.__game.scene.battle; b.tj.force = id; b.tj.tickets = Math.max(b.tj.tickets, 1); window.__game.dialogs.length = 0; }, id);
    await page.evaluate(() => window.__game.scene.pressDraw());
    await page.waitForFunction(() => window.__game.dialogs.some((d) => d.constructor.name === 'TianjiDrawDialog'));
    // 跳过摇签（点击可能早于弹窗第一帧登记点击区，所以等到签文卡真正揭晓、按钮出现）
    await wait(100);
    await page.mouse.click(200, 400);
    await page.waitForFunction(() => { const d = window.__game.dialogs.find((x) => x.constructor.name === 'TianjiDrawDialog'); return d && d.t > 1.6; }, null, { timeout: 5000 });
    await wait(200);
    if (name) await shot(name);
  };
  await force('divine', 'tj-sign-divine');
  // 神兵天降：三选一
  assert.ok(await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'tj_opt_2')), 'divine offers 3 choices');
  await click('tj_opt_0');
  await click('tj_ok');
  await force('heroweapon', 'tj-sign-swap');
  const hasOpt = await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'tj_opt_0'));
  assert.ok(hasOpt, 'exclusive swap asks the player');
  await click('tj_opt_0'); await wait(500); await shot('tj-sign-swap-done');
  await click('tj_ok');
  const s2 = await S();
  const excl = s2.weapons.filter((w) => /^(spear|blade|snake|fan|halberd|bow|lance|chakram|ji|meteor)/.test(w));
  assert.equal(excl.length, 1, 'only one exclusive weapon: ' + s2.weapons.join(','));
  await force('gamble', 'tj-sign-gamble');
  await click('tj_opt_0'); await wait(500); await shot('tj-sign-gamble-done'); await click('tj_ok');
  await force('starlord', 'tj-sign-borrow'); await click('tj_ok');
  await wait(400); await shot('tj-borrow-cutin');
  await wait(3000);
  await force('giant'); await click('tj_ok');
  await force('fog'); await click('tj_ok');
  await force('thief', 'tj-sign-thief'); await click('tj_ok');
  // 测试里让盗将耐打一些，免得还没检查就被打死
  await page.evaluate(() => { const t = window.__game.scene.battle.tj.thief; if (t) t.e.hp = t.e.maxHp = 1e9; });
  await wait(1500); await shot('tj-world-effects');
  const th = await page.evaluate(() => { const b = window.__game.scene.battle; return { thief: !!b.tj.thief, timed: b.tj.timed.map((t) => t.id), scale: b.playerScale }; });
  assert.ok(th.thief); assert.equal(th.scale, 1.6); assert.ok(th.timed.includes('fog'));
  // 击败夺兵贼：兵器回来并升一级
  const back = await page.evaluate(() => { const b = window.__game.scene.battle, th = b.tj.thief; const lv = th.lv; b.killEnemy(th.e); const w = b.weapon(th.weapon); return { ok: !!w, lv: w && w.lv, before: lv, thief: b.tj.thief }; });
  assert.ok(back.ok && back.thief === null && back.lv >= Math.min(5, back.before + 1), JSON.stringify(back));
  await force('meteor'); await click('tj_ok');
  await wait(2500); await shot('tj-meteor');

  // 砍树：把一棵树挪到剑客身边
  await page.evaluate(() => { const b = window.__game.scene.battle; b.tj.timed.length = 0; b.recalc(); b.player.maxHp = b.player.hp = 1e9; const t = b.breakables.find((k) => k.kind === 'tree'); if (t) { t.x = b.player.x + 12; t.y = b.player.y + 4; } });
  await wait(900); await shot('tj-tree-chop');
  await wait(3500);
  const chop = await page.evaluate(() => { const b = window.__game.scene.battle; return { falls: b.tj.falls.length, trees: b.breakables.filter((k) => k.kind === 'tree').length }; });
  console.log('trees', JSON.stringify(chop));
  assert.ok(chop.falls >= 1, 'tree chopped down');
  await shot('tj-tree-fallen');

  // 新签：几种看揭晓
  for (const id of ['allstar', 'swordrain', 'midas', 'pickpocket', 'shuffle', 'bounty', 'wuhu', 'dice', 'thunderbolt', 'cavalry']) { await force(id, 'tj-new-' + id); await click('tj_ok'); await wait(300); }
  await wait(1500); await shot('tj-new-world');

  // 自动开签：有签就自己摇，选择签停下来等
  // 前面的五虎上将会排五个大招，自动开签在大招期间会等，这里清掉队列
  await page.evaluate(() => { window.__game.dialogs.length = 0; const b = window.__game.scene.battle; b.tj.timed.length = 0; b.tj.ultQueue.length = 0; b.recalc(); b.player.maxHp = b.player.hp = 1e9; b.tj.tickets = 3; b.coins = 0; });
  await click('tj_auto');
  assert.equal(await page.evaluate(() => window.__saveMod.save.settings.tjAuto), true);
  const a0 = await page.evaluate(() => window.__game.scene.battle.tj.history.length);
  await page.waitForFunction((a0) => { const b = window.__game.scene.battle; return b.tj.history.length >= a0 + 3 || window.__game.dialogs.some((d) => d.res && d.res.options); }, a0, { timeout: 40000 });
  await shot('tj-auto');
  await page.evaluate(() => { window.__saveMod.save.settings.tjAuto = false; const g = window.__game, d = g.dialogs.find((x) => x.res && x.res.options); if (d) d.res.options[0].act(); g.dialogs.length = 0; });
  // 很多兵器时 HUD 图标换行
  await page.evaluate(() => { const b = window.__game.scene.battle; for (const id of ['crossbow', 'horse', 'fire', 'aura', 'rock', 'knife', 'catapult', 'thunder', 'caltrop', 'drum']) if (!b.weapon(id)) b.addWeapon(id); b.recalc(); });
  await wait(400); await shot('tj-many-weapons');
  assert.ok(await page.evaluate(() => window.__game.scene.battle.weapons.length) > 8, 'no weapon cap');

  // 跳过动画：开关打开后抽签直接生效，文字飘在剑客身边；选择签仍弹卡
  await page.evaluate(() => { window.__game.dialogs.length = 0; const b = window.__game.scene.battle; b.tj.timed.length = 0; b.recalc(); });
  await click('tj_skipanim');
  assert.equal(await page.evaluate(() => window.__saveMod.save.settings.tjSkipAnim), true);
  const h0 = await page.evaluate(() => window.__game.scene.battle.tj.history.length);
  await page.evaluate(() => { const b = window.__game.scene.battle; b.tj.tickets = 3; b.tj.force = 'destiny'; });
  await click('tj_draw');
  await wait(300); await shot('tj-skip-float');
  const sk = await page.evaluate(() => ({ dlg: window.__game.dialogs.length, n: window.__game.scene.battle.tj.history.length, atk: window.__game.scene.battle.tj.perm.atk }));
  assert.equal(sk.dlg, 0, 'no dialog when skipping'); assert.equal(sk.n, h0 + 1); assert.ok(sk.atk >= 25);
  await page.evaluate(() => { window.__game.scene.battle.tj.force = 'gamble'; });
  await click('tj_draw'); await wait(200);
  assert.ok(await page.evaluate(() => window.__game.dialogs.some((d) => d.constructor.name === 'TianjiDrawDialog')), 'choice sign still asks');
  await shot('tj-skip-choice');
  await click('tj_opt_1'); await click('tj_ok');
  await click('tj_skipanim');

  // 天命之主：8:30 登场，血量无限，伤害累计
  await page.evaluate(() => { const b = window.__game.scene.battle; window.__game.dialogs.length = 0; b.t = 508; });
  await page.waitForFunction(() => window.__game.scene.battle.tj.final, null, { timeout: 8000 });
  await page.evaluate(() => { const b = window.__game.scene.battle, e = b.tj.final; e.x = b.player.x + 40; e.y = b.player.y; b.player.maxHp = b.player.hp = 1e9; });
  await wait(3500); await shot('tj-final');
  const fb = await page.evaluate(() => { const b = window.__game.scene.battle; return { dmg: b.tj.finalDmg, hp: b.tj.final.hp, max: b.tj.final.maxHp }; });
  console.log('final', JSON.stringify(fb));
  assert.ok(fb.dmg > 0 && fb.hp > fb.max * 0.99, 'final boss takes damage but never dies');
  // 天命三劫：破绽（10 秒）、二劫（30 秒）、三劫（60 秒）
  await page.evaluate(() => { window.__game.scene.battle.tj.finalT = 9.8; });
  await page.waitForFunction(() => window.__game.scene.battle.tj.flaw > 0, null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => window.__game.scene.battle.tj.final.state), 'rest', 'boss staggered during flaw');
  await wait(300); await shot('tj-final-flaw');
  await page.evaluate(() => { window.__game.scene.battle.tj.finalT = 29.8; });
  await page.waitForFunction(() => window.__game.scene.battle.tj.phase === 2, null, { timeout: 4000 });
  await page.evaluate(() => { window.__game.scene.battle.tj.finalT = 59.8; });
  await page.waitForFunction(() => window.__game.scene.battle.tj.phase === 3, null, { timeout: 4000 });
  await wait(1500); await shot('tj-final-phase3');
  const ph = await page.evaluate(() => { const st = window.__game.scene.battle.tj; return { gifted: st.gifted, meteor: st.timed.some((t) => t.id === 'meteor'), enraged: st.final.enraged }; });
  assert.ok(ph.gifted && ph.meteor && ph.enraged, JSON.stringify(ph));

  // 金币不够：看视频抽签弹窗
  await page.evaluate(() => { const b = window.__game.scene.battle; b.tj.tickets = 0; b.tj.bonusDraws = 0; b.coins = 0; window.__game.dialogs.length = 0; });
  await page.evaluate(() => window.__game.scene.pressDraw());
  await wait(400); await shot('tj-ad');
  await page.evaluate(() => { window.__game.dialogs.length = 0; });

  // 结算：天命伤害记入纪录和前五
  await page.evaluate(() => { const s = window.__game.scene; s.battle.t = 600; s.battle.won = true; s.finish(true); });
  await wait(1500); await shot('tj-result');
  const fin = await page.evaluate(() => ({ runs: window.__saveMod.save.tianji.runs, daily: window.__saveMod.save.daily.tianjiRuns, best: window.__saveMod.save.tianji.bestDmg, top: window.__saveMod.save.tianji.top.length }));
  assert.equal(fin.runs, 1); assert.equal(fin.daily, 1); assert.ok(fin.best > 0); assert.equal(fin.top, 1);
  console.log('tianji ok', JSON.stringify(await S()));
}
