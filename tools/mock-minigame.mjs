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
  setUserCloudStorage: () => note('cloudStorage'), setImRankData: () => note('imRank'), getImRankList: () => {},
  showToast: () => {}, showModal: () => {}, getUpdateManager: () => ({ onUpdateReady() {} }),
  addShortcut: (o) => o.success && o.success(),
};
const store = {};
const sandbox = {
  console, setTimeout, setInterval, clearTimeout, clearInterval, Promise, Date, Math, JSON,
  requestAnimationFrame: (cb) => { frames.push(cb); return frames.length; },
};
sandbox[target === 'wechat' ? 'wx' : 'tt'] = api;
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
runFrames(150); // 启动页
tap(280, 563); // 同意隐私
runFrames(600); // 教学战斗 10 秒
hideCbs.forEach((f) => f());
const keys = Object.keys(store);
const sv = JSON.parse(store.sgxc_save_v1 || '{}'); console.log('agreed', sv.agreedPrivacy, 'playSec', Math.round((sv.stats||{}).playSec||0));
console.log(target, 'frames ok, storage keys:', keys.join(','), 'calls:', JSON.stringify(calls));
Date.now = realNow;
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 5).join('\n') : 'no errors');
process.exit(errors.length ? 1 : 0);
