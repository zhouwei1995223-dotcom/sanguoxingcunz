// 在 Node 中模拟微信 / 抖音小游戏环境运行 game.js，检查小游戏代码路径是否报错
// 用法：node tools/mock-minigame.mjs wechat|douyin
import fs from 'node:fs';
import vm from 'node:vm';

const target = process.argv[2] || 'wechat';
const errors = [];
const calls = {};
const note = (n) => { calls[n] = (calls[n] || 0) + 1; };

function mockCtx() {
  const base = {
    measureText: (s) => ({ width: String(s).length * 10 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[a-z]/.test(k) && !['font', 'fillStyle', 'strokeStyle', 'globalAlpha', 'lineWidth', 'textAlign', 'textBaseline', 'lineJoin', 'imageSmoothingEnabled'].includes(k) ? () => {} : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
}
const mkCanvas = () => ({ width: 300, height: 150, getContext: () => mockCtx() });
let touchStart, touchEnd, showCb;
const hideCbs = [];
const frames = [];
const api = {
  createCanvas: () => { note('createCanvas'); return mkCanvas(); },
  getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3, safeArea: { top: 47, bottom: 810, left: 0, right: 390 }, statusBarHeight: 47 }),
  getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3, safeArea: { top: 47, bottom: 810, left: 0, right: 390 } }),
  getMenuButtonBoundingClientRect: () => ({ top: 51, bottom: 83, left: 296, right: 383 }),
  onTouchStart: (cb) => (touchStart = cb), onTouchMove: () => {}, onTouchEnd: (cb) => (touchEnd = cb), onTouchCancel: () => {},
  getStorageSync: (k) => store[k] ?? '', setStorageSync: (k, v) => { note('setStorage'); store[k] = v; },
  createInnerAudioContext: () => ({ play() { note('audio.play'); }, stop() {}, destroy() {}, set src(v) {}, set volume(v) {} }),
  vibrateShort: () => note('vibrate'), vibrateLong: () => {},
  createRewardedVideoAd: () => ({ onError() {}, onClose(cb) { this.cb = cb; }, offClose() {}, show() { note('ad.show'); setTimeout(() => this.cb && this.cb({ isEnded: true }), 10); return Promise.resolve(); }, load: () => Promise.resolve() }),
  createInterstitialAd: () => ({ onError() {}, show: () => Promise.resolve() }),
  showShareMenu: () => {}, onShareAppMessage: () => {}, onShareTimeline: () => {}, shareAppMessage: () => note('share'),
  onShow: (cb) => (showCb = cb), onHide: (cb) => hideCbs.push(cb),
  getLaunchOptionsSync: () => ({ scene: target === 'douyin' ? '021036' : 1001 }),
  checkScene: (o) => o.success({ isExist: true }), navigateToScene: () => {},
  getOpenDataContext: () => ({ canvas: mkCanvas(), postMessage: () => note('openData.post') }),
  requirePrivacyAuthorize: (o) => { note('privacy'); o.success && o.success(); }, getPrivacySetting: (o) => o.success({ needAuthorization: false }),
  setUserCloudStorage: () => note('cloudStorage'), setImRankData: () => note('imRank'), getImRankList: () => {},
  showToast: () => {}, showModal: () => {}, getUpdateManager: () => ({ onUpdateReady() {} }),
  addShortcut: (o) => o.success && o.success(),
  createPageManager: () => ({ load: () => { note('pageManager.load'); return Promise.resolve({}); }, show: () => note('pageManager.show') }),
};
const store = {};
const sandbox = {
  console, setTimeout, setInterval, clearTimeout, clearInterval, Promise, Date, Math, JSON,
  requestAnimationFrame: (cb) => { frames.push(cb); return frames.length; },
};
sandbox[target === 'wechat' ? 'wx' : 'tt'] = api;
// 让 game.js 把 __game / __saveMod 挂到全局，便于下面按按钮 id 驱动（正式包没有这个标志）
sandbox.__MOCK_MINIGAME = true;
vm.createContext(sandbox);
try {
  vm.runInContext(fs.readFileSync(`dist/${target}/game.js`, 'utf8'), sandbox, { filename: 'game.js' });
} catch (e) { errors.push('load: ' + e.stack); }

let now = Date.now();
const realNow = Date.now;
sandbox.Date.now = () => now;
const runFrames = (n, ms = 16) => {
  for (let i = 0; i < n; i++) {
    now += ms;
    const cbs = frames.splice(0);
    for (const cb of cbs) { try { cb(now); } catch (e) { errors.push('frame: ' + e.stack); return; } }
  }
};
const tap = (x, y) => { const t = { changedTouches: [{ identifier: 1, clientX: x, clientY: y }] }; touchStart(t); runFrames(2); touchEnd(t); runFrames(2); };
const G = () => sandbox.__game;
/** 按 UI 区域 id 点击（逻辑坐标换算成屏幕坐标） */
const tapId = (id) => {
  const ui = G().ui, r = ui.prevRegions.find((v) => v.id === id);
  if (!r) return false;
  const k = 390 / ui.W;
  tap((r.x + r.w / 2) * k, (r.y + r.h / 2) * k);
  return true;
};
const log = [];
const step = async (name, fn) => { try { const v = await fn(); log.push(name + (v === undefined ? '' : ' ' + JSON.stringify(v))); } catch (e) { errors.push(name + ': ' + e.stack); } };
/** 广告回调走真实计时器：点完广告按钮后让真实时间走一下再继续帧 */
const tick = async (ms = 60) => { await new Promise((r) => setTimeout(r, ms)); runFrames(5); };
runFrames(150); // 启动页
// 加载页会等云存档拉取（真实计时器最多 3 秒），这里让真实时间走一下
await new Promise((r) => setTimeout(r, 3300));
runFrames(120);
// 新手试炼另有覆盖：这里跳过引导，同意隐私后直接进主界面，驱动各模式
if (sandbox.__saveMod) { sandbox.__saveMod.save.guide = 99; }
if (!tapId('pv_ok')) tap(280, 563); // 同意隐私
runFrames(600); // 教学战斗 10 秒
await new Promise((r) => setTimeout(r, 200));
if (process.env.DEBUG_MOCK && G()) console.log('debug', G().scene.constructor.name, G().dialogs.map((d) => d.constructor.name), G().ui.prevRegions.map((r) => r.id).join(' '), JSON.stringify(G().scene.state ?? G().scene.t ?? ''));
if (G()) {
  const S = () => sandbox.__saveMod.save;
  const scene = () => G().scene.constructor.name;
  // 跑若干秒战斗：弹窗一律关掉（升级 / 奇遇等），保证流程继续
  /** 结束当前战斗并点结算的「收下 / 返回营地」回到主界面 */
  const goHome = () => {
    for (let k = 0; k < 4 && scene() !== 'HomeScene'; k++) {
      const sc = G().scene;
      if (scene() === 'BattleScene') { G().closeAll(); if (!sc.ended) sc.finish(false); runFrames(60); tapId('res_ok'); runFrames(10); }
      else if (scene() === 'TowerScene') { G().closeAll(); if (!sc.result) sc.giveUp(); runFrames(10); tapId('td_home'); runFrames(10); }
    }
    G().closeAll(); runFrames(5);
    return scene();
  };
  const play = (sec) => { for (let i = 0; i < sec * 30; i++) { if (G().dialogs.length) G().closeAll(); runFrames(1, 33); } };
  await step('setup', async () => {
    const s = S(); s.agreedPrivacy = true; s.guide = 99; s.stamina = 999; s.yuanbao = 99999; s.gold = 999999;
    for (const id of ['guanyu', 'zhangfei', 'huangzhong']) { s.heroes[id].owned = true; }
    sandbox.__saveMod.markDirty();
    G().closeAll(); runFrames(5);
    return scene();
  });
  // 征战：出征 → 选时长 → 战斗 30 秒 → 阵亡 → 看视频复活
  await step('campaign', async () => {
    if (scene() !== 'HomeScene') G().setScene(new (G().scene.constructor)()), runFrames(5);
    G().scene.startBattle(1, 0, 5); runFrames(10);
    play(30);
    const b = G().scene.battle; b.player.iframe = 0; b.hurtPlayer(b.player.maxHp * 99); runFrames(20);
    const dlg = G().dialogs.map((d) => d.constructor.name).join(',');
    const before = b.reviveCount;
    tapId('rv_free') || tapId('rv_ad'); await tick(); runFrames(60);
    return { scene: scene(), dlg, revived: b.reviveCount - before, dmg: b.reviveDmg };
  });
  // 守城：开局 → 召唤武将放技能 → 战斗 30 秒 → 武将阵亡判负弹复活
  await step('defense', async () => {
    goHome();
    G().scene.startBattle(-3, 1); runFrames(10);
    const b = G().scene.battle;
    b.applyChoice({ kind: 'order', id: 'o_cav', lv: 1 });
    b.applyChoice({ kind: 'hero', id: 'guanyu' });
    const hero = b.def.allies.find((a) => a.kind === 'hero'); if (hero) hero.skillT = 0;
    play(30);
    b.player.iframe = 0; b.hurtPlayer(b.player.maxHp * 99); runFrames(20);
    const dlg = G().dialogs.map((d) => d.constructor.name).join(',');
    b.revives = 0; // 跳过免费次数，走看视频复活
    runFrames(2); tapId('rv_ad'); await tick(); runFrames(20);
    return { scene: scene(), allies: b.def.allies.length, dlg, adRevived: b.adRevives, dead: b.dead };
  });
  // 回主界面 → 布阵：1.5 倍速看视频 → 打一段 → 城门失守看视频复活
  await step('tower', async () => {
    if (goHome() !== 'HomeScene') return { scene: scene(), note: '未能回到主界面' };
    tapId('nav_arena'); runFrames(5); tapId('arena_tower'); runFrames(5); tapId('td_start'); runFrames(10);
    if (scene() !== 'TowerScene') return { scene: scene() };
    const sc = G().scene, b = sc.battle;
    tapId('td_speed'); await tick(); runFrames(30);
    for (let i = 0; i < 30 * 40; i++) { if (b.offer) b.choose(b.offer.cards[0]); runFrames(1, 33); }
    b.hp = 0; b.phase = 'loss'; runFrames(5);
    tapId('td_revive'); await tick(); runFrames(30);
    return { speed: sc.speed, speedOpen: sc.speedOpen, wave: b.waveIdx + 1, phase: b.phase, revives: b.reviveCount };
  });
  // 商店：宝箱每日看视频十连
  await step('shop', async () => {
    goHome();
    tapId('nav_shop'); runFrames(10);
    const ok = tapId('chest_tenad_wood'); await tick(); runFrames(30);
    const dlg = G().dialogs.map((d) => d.constructor.name).join(',');
    return { scene: scene(), tapped: ok, ten: !!S().daily.chestTenAd?.wood, dlg };
  });
  // 天机签：从第四个页签入局 → 摇一签收下 → 打一分钟（检查小游戏画布下抽签动画、树、HUD 不报错）
  await step('tianji', async () => {
    if (goHome() !== 'HomeScene') return { scene: scene(), note: '未能回到主界面' };
    tapId('nav_battle'); runFrames(5);
    S().homeMode = 'tianji'; runFrames(5);
    tapId('tj_start'); runFrames(20);
    if (scene() !== 'BattleScene' || !G().scene.battle.tj) return { scene: scene() };
    const b = G().scene.battle;
    G().dialogs.length = 0;
    G().scene.pressDraw(); runFrames(90);
    const dlg = G().dialogs.map((d) => d.constructor.name).join(',');
    if (!tapId('tj_ok')) G().dialogs.length = 0;
    runFrames(10);
    b.player.maxHp = b.player.hp = 1e9;
    for (let i = 0; i < 60 * 30; i++) { G().dialogs.length = 0; runFrames(1, 33); }
    return { dlg, draws: b.tj.history.length, t: Math.round(b.t), trees: b.breakables.filter((k) => k.kind === 'tree').length, coins: b.coins };
  });
  console.log(log.join('\n'));
}
hideCbs.forEach((f) => f());
const keys = Object.keys(store);
const sv = JSON.parse(store.sgxc_save_v1 || '{}'); console.log('agreed', sv.agreedPrivacy, 'playSec', Math.round((sv.stats||{}).playSec||0));
console.log(target, 'frames ok, storage keys:', keys.join(','), 'calls:', JSON.stringify(calls));
Date.now = realNow;
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 5).join('\n') : 'no errors');
process.exit(errors.length ? 1 : 0);
