import type { Platform, SoundHandle, TouchKind, TouchPoint } from './types';
import { AD_CONFIG, SHARE_CONFIG, CLOUD_CONFIG, SUBSCRIBE_CONFIG } from '../data/platformConfig';

// 微信 / 抖音小游戏通用实现。两家 API 绝大部分同名，差异点单独判断。

declare const wx: any;
declare const tt: any;
declare const requestAnimationFrame: (cb: (t: number) => void) => number;

class MiniSound implements SoundHandle {
  private pool: any[] = [];
  private idx = 0;
  private volume = 1;
  constructor(private api: any, private path: string, private loop: boolean) {
    const n = loop ? 1 : 3; // 音效用 3 个实例轮换，避免同一音效频繁触发时被截断
    for (let i = 0; i < n; i++) {
      let a: any;
      try { a = api.createInnerAudioContext({ useWebAudioImplement: !loop }); } catch (e) { a = api.createInnerAudioContext(); }
      a.src = path;
      a.loop = loop;
      a.autoplay = false;
      this.pool.push(a);
    }
  }
  play() {
    const a = this.pool[this.idx];
    this.idx = (this.idx + 1) % this.pool.length;
    try {
      a.volume = this.volume;
      if (!this.loop) { a.stop(); }
      a.play();
    } catch (e) {}
  }
  stop() { this.pool.forEach((a) => { try { a.stop(); } catch (e) {} }); }
  setVolume(v: number) { this.volume = v; this.pool.forEach((a) => { try { a.volume = v; } catch (e) {} }); }
  destroy() { this.pool.forEach((a) => { try { a.destroy(); } catch (e) {} }); this.pool = []; }
}

export function createMiniGamePlatform(kind: 'wx' | 'tt'): Platform {
  const api: any = kind === 'wx' ? wx : tt;
  let sys: any = {};
  try { sys = api.getSystemInfoSync(); } catch (e) {}
  try {
    if (api.getWindowInfo) sys = Object.assign({}, sys, api.getWindowInfo());
  } catch (e) {}
  const dpr = Math.min(sys.pixelRatio || 2, 3);
  const winW = sys.windowWidth || sys.screenWidth || 375;
  const winH = sys.windowHeight || sys.screenHeight || 667;

  const canvas: HTMLCanvasElement = api.createCanvas();
  canvas.width = Math.round(winW * dpr);
  canvas.height = Math.round(winH * dpr);

  const sa = sys.safeArea;
  const safeArea = sa
    ? { top: sa.top * dpr, bottom: (winH - sa.bottom) * dpr, left: sa.left * dpr, right: (winW - sa.right) * dpr }
    : { top: (sys.statusBarHeight || 20) * dpr, bottom: 0, left: 0, right: 0 };
  // 右上角胶囊按钮区域：微信 / 抖音都有，至少留出状态栏高度
  try {
    const menu = api.getMenuButtonBoundingClientRect && api.getMenuButtonBoundingClientRect();
    if (menu && menu.bottom) safeArea.top = Math.max(safeArea.top, (menu.bottom + 4) * dpr);
  } catch (e) {}
  if (safeArea.top < 24 * dpr) safeArea.top = 24 * dpr;

  const listeners: ((k: TouchKind, t: TouchPoint[]) => void)[] = [];
  const conv = (res: any): TouchPoint[] => (res.changedTouches || res.touches || []).map((t: any) => ({
    id: t.identifier, x: (t.clientX !== undefined ? t.clientX : t.x) * dpr, y: (t.clientY !== undefined ? t.clientY : t.y) * dpr,
  }));
  api.onTouchStart((r: any) => listeners.forEach((l) => l('start', conv(r))));
  api.onTouchMove((r: any) => listeners.forEach((l) => l('move', conv(r))));
  api.onTouchEnd((r: any) => listeners.forEach((l) => l('end', conv(r))));
  api.onTouchCancel((r: any) => listeners.forEach((l) => l('end', conv(r))));

  // —— 广告 ——
  const rewardedAds: Record<string, any> = {};
  const getRewarded = (unitId: string) => {
    if (!unitId) return null;
    if (!rewardedAds[unitId]) {
      try {
        rewardedAds[unitId] = api.createRewardedVideoAd({ adUnitId: unitId });
        rewardedAds[unitId].onError(() => {});
      } catch (e) { return null; }
    }
    return rewardedAds[unitId];
  };
  const adCfg = kind === 'wx' ? AD_CONFIG.wx : AD_CONFIG.tt;
  let interstitial: any = null;
  let lastInterstitial = 0;
  if (adCfg.interstitial) {
    try { interstitial = api.createInterstitialAd({ adUnitId: adCfg.interstitial }); interstitial.onError(() => {}); } catch (e) {}
  }

  let fromSidebar = false;
  try {
    const opt = api.getLaunchOptionsSync ? api.getLaunchOptionsSync() : null;
    if (opt && kind === 'tt' && opt.scene === '021036') fromSidebar = true;
  } catch (e) {}
  let sidebarSupported = false;
  if (kind === 'tt') {
    try { api.checkScene({ scene: 'sidebar', success: (r: any) => { sidebarSupported = !!r.isExist; }, fail: () => {} }); } catch (e) {}
  }

  const showListeners: (() => void)[] = [];
  const hideListeners: (() => void)[] = [];
  api.onShow((res: any) => {
    if (kind === 'tt' && res && (res.scene === '021036' || (res.launch_from === 'homepage' && res.location === 'sidebar_card'))) fromSidebar = true;
    showListeners.forEach((f) => f());
  });
  api.onHide(() => hideListeners.forEach((f) => f()));

  // 被动分享（右上角菜单）
  try {
    api.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    api.onShareAppMessage(() => ({ title: SHARE_CONFIG.title, imageUrl: SHARE_CONFIG.imageUrl || undefined }));
    if (kind === 'wx' && api.onShareTimeline) api.onShareTimeline(() => ({ title: SHARE_CONFIG.title }));
  } catch (e) {}

  // 版本更新：新版本下载完成后提示重启
  try {
    const um = api.getUpdateManager && api.getUpdateManager();
    if (um) {
      um.onUpdateReady(() => {
        api.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: (r: any) => { if (r.confirm) um.applyUpdate(); },
        });
      });
    }
  } catch (e) {}

  // —— 云开发 ——
  const cloudEnv = kind === 'wx' ? CLOUD_CONFIG.wx.env : CLOUD_CONFIG.tt.env;
  let db: any = null;
  try {
    if (cloudEnv && kind === 'wx' && api.cloud) {
      api.cloud.init({ env: cloudEnv, traceUser: true });
      db = api.cloud.database();
    } else if (cloudEnv && kind === 'tt' && api.createCloud) {
      const c = api.createCloud({ envID: cloudEnv });
      db = c.database();
    }
  } catch (e) { db = null; }
  let saveDocId: string | null = null;
  const subTpl = kind === 'wx' ? SUBSCRIBE_CONFIG.wx : SUBSCRIBE_CONFIG.tt;

  // —— 录屏（仅抖音）——
  let recorder: any = null;
  let recording = false;
  const clips: number[] = [];
  let stopResolve: ((p: string | null) => void) | null = null;
  if (kind === 'tt') {
    try {
      recorder = api.getGameRecorderManager();
      recorder.onStop((res: any) => {
        recording = false;
        const path = res && res.videoPath;
        const finish = (p: string | null) => { if (stopResolve) { stopResolve(p); stopResolve = null; } };
        if (!path) { finish(null); return; }
        // 有精彩片段就剪辑成集锦，否则使用整段录屏
        if (clips.length && recorder.clipVideo) {
          recorder.clipVideo({ path, clipRange: clips.slice(-6), success: (r: any) => finish(r.videoPath || path), fail: () => finish(path) });
        } else finish(path);
        clips.length = 0;
      });
      recorder.onError(() => { recording = false; if (stopResolve) { stopResolve(null); stopResolve = null; } });
    } catch (e) { recorder = null; }
  }

  let openData: any = null;
  if (kind === 'wx') {
    try { openData = api.getOpenDataContext(); } catch (e) {}
  }

  return {
    name: kind,
    canvas,
    width: canvas.width,
    height: canvas.height,
    dpr,
    safeArea,
    createCanvas(w, h) { const c = api.createCanvas(); c.width = w; c.height = h; return c; },
    onTouch(cb) { listeners.push(cb); },
    requestFrame(cb) { requestAnimationFrame(cb); },
    now() { return Date.now(); },
    getItem(k) { try { const v = api.getStorageSync(k); return v === '' || v === undefined ? null : v; } catch (e) { return null; } },
    setItem(k, v) { try { api.setStorageSync(k, v); } catch (e) {} },
    createSound(path, loop) { return new MiniSound(api, path, loop); },
    vibrateShort() { try { api.vibrateShort({ type: 'light' }); } catch (e) {} },
    vibrateLong() { try { api.vibrateLong(); } catch (e) {} },
    showRewardedAd(placement) {
      return new Promise((resolve) => {
        const ad = getRewarded(adCfg.rewarded);
        if (!ad) {
          // 未配置广告位：开发阶段直接发奖，正式上线前务必在 platformConfig 里填写
          resolve(!adCfg.rewarded ? AD_CONFIG.grantWhenNoAd : false);
          return;
        }
        const onClose = (res: any) => {
          ad.offClose(onClose);
          resolve(!res || res.isEnded);
        };
        ad.onClose(onClose);
        ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => {
          ad.offClose(onClose);
          try { api.showToast({ title: '广告暂时无法播放，请稍后再试', icon: 'none' }); } catch (e) {}
          resolve(false);
        }));
        void placement;
      });
    },
    showInterstitialAd() {
      const now = Date.now();
      if (!interstitial || now - lastInterstitial < 60000) return; // 插屏频控 60s
      lastInterstitial = now;
      try { interstitial.show().catch(() => {}); } catch (e) {}
    },
    share(title, query) {
      try { api.shareAppMessage({ title, query: query || '', imageUrl: SHARE_CONFIG.imageUrl || undefined }); } catch (e) {}
    },
    onShow(cb) { showListeners.push(cb); },
    onHide(cb) { hideListeners.push(cb); },
    supportsSidebar() { return kind === 'tt' && sidebarSupported; },
    isFromSidebar() { return fromSidebar; },
    navigateToSidebar() { try { api.navigateToScene({ scene: 'sidebar', fail: () => {} }); } catch (e) {} },
    supportsAddShortcut() { return kind === 'tt' && typeof api.addShortcut === 'function'; },
    addShortcut() {
      return new Promise((resolve) => {
        try { api.addShortcut({ success: () => resolve(true), fail: () => resolve(false) }); } catch (e) { resolve(false); }
      });
    },
    submitScore(key, value) {
      try {
        if (kind === 'wx') {
          api.setUserCloudStorage({ KVDataList: [{ key, value: JSON.stringify({ wxgame: { score: value, update_time: Math.floor(Date.now() / 1000) } }) }] });
        } else if (api.setImRankData) {
          api.setImRankData({ dataType: 0, value: String(value), priority: 0, zoneId: key === 'endless' ? 'endless' : 'default' });
        }
      } catch (e) {}
    },
    supportsRank() { return kind === 'wx' ? !!openData : typeof api.getImRankList === 'function'; },
    getSharedCanvas() { return openData ? openData.canvas : null; },
    postToOpenData(msg) { try { if (openData) openData.postMessage(msg); } catch (e) {} },
    showNativeRank() {
      try {
        api.getImRankList({ relationType: 'default', dataType: 0, rankType: 'week', suffix: '关', rankTitle: '长坂单骑传·周榜', zoneId: 'default' });
      } catch (e) {}
    },
    showToast(text) { try { api.showToast({ title: text, icon: 'none' }); } catch (e) {} },
    cloudReady() { return !!db; },
    cloudLoad() {
      return new Promise((resolve) => {
        if (!db) { resolve(null); return; }
        try {
          db.collection(CLOUD_CONFIG.collection).limit(1).get().then((res: any) => {
            const doc = res && res.data && res.data[0];
            if (!doc) { resolve(null); return; }
            saveDocId = doc._id;
            resolve({ data: doc.data, updatedAt: doc.updatedAt || 0 });
          }).catch(() => resolve(null));
        } catch (e) { resolve(null); }
      });
    },
    cloudSave(data, updatedAt) {
      return new Promise((resolve) => {
        if (!db) { resolve(false); return; }
        try {
          const col = db.collection(CLOUD_CONFIG.collection);
          const body = { data, updatedAt };
          const p = saveDocId ? col.doc(saveDocId).set({ data: body }) : col.add({ data: body }).then((r: any) => { saveDocId = r._id; });
          p.then(() => resolve(true)).catch(() => resolve(false));
        } catch (e) { resolve(false); }
      });
    },
    report(event, data) {
      try {
        if (kind === 'wx' && api.reportEvent) api.reportEvent(event, data);
        else if (kind === 'tt' && api.reportAnalytics) api.reportAnalytics(event, data);
      } catch (e) {}
    },
    supportsRecorder() { return !!recorder; },
    recorderStart() {
      if (!recorder || recording) return;
      try { clips.length = 0; recorder.start({ duration: 300 }); recording = true; } catch (e) {}
    },
    recorderMark() {
      if (!recorder || !recording) return;
      try { recorder.recordClip({ timeRange: [6, 2], success: (r: any) => { if (r && r.index !== undefined) clips.push(r.index); } }); } catch (e) {}
    },
    recorderStop() {
      return new Promise((resolve) => {
        if (!recorder || !recording) { resolve(null); return; }
        stopResolve = resolve;
        try { recorder.stop(); } catch (e) { resolve(null); }
        setTimeout(() => { if (stopResolve === resolve) { stopResolve = null; resolve(null); } }, 8000);
      });
    },
    shareVideo(videoPath, title) {
      return new Promise((resolve) => {
        try {
          api.shareAppMessage({
            channel: 'video', title,
            extra: { videoPath, videoTopics: ['长坂单骑传', '三国'], hashtag_list: ['长坂单骑传', '三国'] },
            success: () => resolve(true), fail: () => resolve(false),
          });
        } catch (e) { resolve(false); }
      });
    },
    inputText(title) {
      return new Promise((resolve) => {
        try {
          let value = '';
          const onInput = (r: any) => { value = r.value; };
          const onConfirm = (r: any) => { cleanup(); resolve(r.value || value); };
          const onComplete = (r: any) => { cleanup(); resolve((r && r.value) || value || null); };
          const cleanup = () => { api.offKeyboardInput(onInput); api.offKeyboardConfirm(onConfirm); api.offKeyboardComplete(onComplete); };
          api.onKeyboardInput(onInput);
          api.onKeyboardConfirm(onConfirm);
          api.onKeyboardComplete(onComplete);
          api.showKeyboard({ defaultValue: '', maxLength: 32, multiple: false, confirmHold: false, confirmType: 'done' });
          void title;
        } catch (e) { resolve(null); }
      });
    },
    requestSubscribe() {
      return new Promise((resolve) => {
        const ids = [subTpl.stamina, subTpl.patrol].filter(Boolean);
        if (!ids.length || !api.requestSubscribeMessage) { resolve(false); return; }
        try {
          api.requestSubscribeMessage({
            tmplIds: ids,
            success: (r: any) => resolve(ids.some((id) => r[id] === 'accept')),
            fail: () => resolve(false),
          });
        } catch (e) { resolve(false); }
      });
    },
    scheduleReminder(kindName, at) {
      // 只登记，真正的推送由云函数 notify 定时完成（见 cloudfunctions/notify）
      if (!db) return;
      const tmpl = kindName === 'stamina' ? subTpl.stamina : subTpl.patrol;
      if (!tmpl) return;
      try { db.collection(CLOUD_CONFIG.reminderCollection).add({ data: { kind: kindName, at, tmpl, sent: false } }); } catch (e) {}
    },
    exit() { try { api.exitMiniProgram && api.exitMiniProgram({}); } catch (e) {} },
  };
}
