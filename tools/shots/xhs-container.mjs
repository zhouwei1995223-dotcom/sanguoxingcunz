import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 小红书容器能力：注入模拟的 window.xhs（客户端 9.53），验证 Storage 迁移与读写、顶部按钮避让、平台振动。
// ROOT=dist/xhs Q='?skip=1' node tools/shot.mjs xhs-container
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  // 1) 不带容器先跑一次：存档写在 localStorage（模拟旧版客户端 / 旧版本留下的进度）
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene', null, { timeout: 20000 });
  await page.evaluate(() => {
    const m = window.__saveMod; m.save.gold = 123456; m.markDirty(); m.flushSave(true);
  });
  assert.ok(await page.evaluate(() => (localStorage.getItem('sgxc_save_v1') || '').includes('123456')), '旧存档写在 localStorage');

  // 2) 注入模拟容器（存储落在 localStorage 的 mockxhs: 前缀下，跨刷新保留）
  await page.addInitScript(() => {
    const store = {
      get(k) { return localStorage.getItem('mockxhs:' + k); },
      set(k, v) { localStorage.setItem('mockxhs:' + k, v); },
      keys() { const r = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mockxhs:')) r.push(k.slice(8)); } return r; },
    };
    window.__xhsCalls = { vibrateShort: 0, vibrateLong: 0, setStorage: 0, getWindowInfo: 0 };
    window.xhs = {
      launchOptions: { miniToolEnv: { buildVersion: '9530004', userDataPath: '/usr' } },
      miniTool: {
        setStorage({ key, data }) {
          window.__xhsCalls.setStorage++;
          if (typeof data !== 'string') return Promise.reject({ errMsg: 'setStorage:fail data must be string' });
          JSON.parse(data); store.set(key, data); return Promise.resolve({ errMsg: 'setStorage:ok' });
        },
        getStorage({ key }) { const d = store.get(key); return Promise.resolve({ errMsg: 'getStorage:ok', data: d === null ? null : d }); },
        getStorageInfo() { return Promise.resolve({ errMsg: 'getStorageInfo:ok', keys: store.keys(), usedBytes: 0, limitBytes: 10485760 }); },
        removeStorage() { return Promise.resolve({}); }, clearStorage() { return Promise.resolve({}); },
        getWindowInfo() {
          window.__xhsCalls.getWindowInfo++;
          return Promise.resolve({
            errMsg: 'getWindowInfo:ok', pixelRatio: 2, windowWidth: 390, windowHeight: 844, statusBarHeight: 47,
            safeArea: { left: 0, top: 47, right: 390, bottom: 810, width: 390, height: 763 },
            menuButtons: { back: { left: 12, top: 52, right: 44, bottom: 84, width: 32, height: 32 }, me: null, share: { left: 300, top: 52, right: 378, bottom: 84, width: 78, height: 32 } },
          });
        },
        vibrateShort({ type }) { if (!type) return Promise.reject({ errMsg: 'vibrateShort:fail type required' }); window.__xhsCalls.vibrateShort++; return Promise.resolve({}); },
        vibrateLong() { window.__xhsCalls.vibrateLong++; return Promise.resolve({}); },
      },
    };
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene', null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const migrated = await page.evaluate(() => ({
    gold: window.__saveMod.save.gold,
    stored: (() => { const d = localStorage.getItem('mockxhs:sgxc_save_v1'); return d ? JSON.parse(d).includes('123456') : false; })(),
    safeTop: window.__game.ui.safeTop, dpr: Math.min(window.devicePixelRatio || 1, 2),
    calls: window.__xhsCalls,
  }));
  console.log(JSON.stringify(migrated));
  assert.equal(migrated.gold, 123456, '迁移后读到旧进度');
  assert.ok(migrated.stored, '旧存档已迁移进小红书 Storage（data 为 JSON 字符串）');
  assert.equal(migrated.safeTop, (84 + 6) * migrated.dpr, '顶部按按钮底边 + 6 避让');
  assert.ok(migrated.calls.getWindowInfo >= 1);
  await page.screenshot({ path: path.join(out, 'xhs-container-home.png') });

  // 3) 改进度 → 删除 localStorage 里的存档 → 刷新：仍能从小红书 Storage 读回
  await page.evaluate(() => { const m = window.__saveMod; m.save.gold = 654321; m.markDirty(); m.flushSave(true); });
  await page.waitForTimeout(300);
  await page.evaluate(() => localStorage.removeItem('sgxc_save_v1'));
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene', null, { timeout: 20000 });
  const reloaded = await page.evaluate(() => window.__saveMod.save.gold);
  assert.equal(reloaded, 654321, '从小红书 Storage 读回最新进度');

  // 4) 振动走平台接口：守城里武将阵亡会触发长振动
  await page.evaluate(() => { window.__game.closeAll(); window.__saveMod.save.settings.vibrate = true; window.__game.scene.startBattle(-3, 1); });
  await page.waitForFunction(() => window.__game.scene.battle?.def);
  await page.evaluate(() => { const b = window.__game.scene.battle; window.__game.closeAll(); b.player.iframe = 0; b.hurtPlayer(b.player.maxHp * 99); });
  await page.waitForTimeout(300);
  const calls = await page.evaluate(() => window.__xhsCalls);
  console.log(JSON.stringify(calls));
  assert.ok(calls.vibrateShort + calls.vibrateLong >= 1, '振动走 miniTool.vibrateShort / vibrateLong');
  console.log('xhs-container ok');
}
