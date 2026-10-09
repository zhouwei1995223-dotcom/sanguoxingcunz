import type { Platform, SoundHandle, TouchKind, TouchPoint } from './types';

// 浏览器实现：用于开发调试与验收。广告用 2 秒模拟弹窗代替。

class WebSound implements SoundHandle {
  private el: HTMLAudioElement;
  constructor(path: string, loop: boolean) {
    this.el = new Audio(path);
    this.el.loop = loop;
    this.el.preload = 'auto';
  }
  play() {
    try {
      if (!this.el.loop) this.el.currentTime = 0;
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  stop() {
    this.el.pause();
    try { this.el.currentTime = 0; } catch (e) {}
  }
  setVolume(v: number) { this.el.volume = Math.max(0, Math.min(1, v)); }
  destroy() { this.el.pause(); this.el.src = ''; }
}

export function createWebPlatform(): Platform {
  const canvas = document.createElement('canvas');
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  document.body.appendChild(canvas);

  // 桌面浏览器上模拟手机竖屏比例
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let cssW = window.innerWidth;
  let cssH = window.innerHeight;
  if (cssW / cssH > 0.62) cssW = Math.round(cssH * 0.5);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const listeners: ((k: TouchKind, t: TouchPoint[]) => void)[] = [];
  const emit = (k: TouchKind, t: TouchPoint[]) => listeners.forEach((l) => l(k, t));
  const toPoint = (id: number, cx: number, cy: number): TouchPoint => {
    const r = canvas.getBoundingClientRect();
    return { id, x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) };
  };
  const touchList = (e: TouchEvent) => Array.from(e.changedTouches).map((t) => toPoint(t.identifier, t.clientX, t.clientY));
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); emit('start', touchList(e)); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); emit('move', touchList(e)); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); emit('end', touchList(e)); }, { passive: false });
  canvas.addEventListener('touchcancel', (e) => { e.preventDefault(); emit('end', touchList(e)); }, { passive: false });
  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => { mouseDown = true; emit('start', [toPoint(-1, e.clientX, e.clientY)]); });
  window.addEventListener('mousemove', (e) => { if (mouseDown) emit('move', [toPoint(-1, e.clientX, e.clientY)]); });
  window.addEventListener('mouseup', (e) => { if (mouseDown) { mouseDown = false; emit('end', [toPoint(-1, e.clientX, e.clientY)]); } });
  canvas.addEventListener('wheel', (e) => {
    // 鼠标滚轮模拟拖动，方便桌面验收列表
    const p = toPoint(-2, e.clientX, e.clientY);
    emit('start', [p]);
    emit('move', [{ id: -2, x: p.x, y: p.y - e.deltaY * dpr }]);
    emit('end', [{ id: -2, x: p.x, y: p.y - e.deltaY * dpr }]);
  });

  // 键盘 WASD 映射到全局，战斗场景读取
  (window as any).__keys = {} as Record<string, boolean>;
  window.addEventListener('keydown', (e) => { (window as any).__keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { (window as any).__keys[e.key.toLowerCase()] = false; });

  const showListeners: (() => void)[] = [];
  const hideListeners: (() => void)[] = [];
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hideListeners.forEach((f) => f());
    else showListeners.forEach((f) => f());
  });

  let toastTimer: any = 0;
  const showToast = (text: string) => {
    let el = document.getElementById('__toast');
    if (!el) {
      el = document.createElement('div');
      el.id = '__toast';
      el.style.cssText = 'position:fixed;left:50%;top:45%;transform:translate(-50%,-50%);background:rgba(0,0,0,.8);color:#fff;padding:10px 18px;border-radius:6px;font:14px sans-serif;z-index:99;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el!.style.display = 'none'; }, 1500);
  };

  const fakeAd = (placement: string): Promise<boolean> => new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:16px sans-serif;z-index:100';
    mask.innerHTML = `<div>【模拟激励视频】${placement}</div><div id="__adc" style="margin-top:12px;font-size:28px">2</div><button id="__adskip" style="margin-top:16px">关闭（不发奖励）</button>`;
    document.body.appendChild(mask);
    let n = 2;
    const iv = setInterval(() => {
      n--;
      const c = document.getElementById('__adc');
      if (c) c.textContent = String(n);
      if (n <= 0) { clearInterval(iv); mask.remove(); resolve(true); }
    }, 1000);
    mask.querySelector('#__adskip')!.addEventListener('click', () => { clearInterval(iv); mask.remove(); resolve(false); });
  });

  return {
    name: 'web',
    canvas,
    width: canvas.width,
    height: canvas.height,
    dpr,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    createCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
    onTouch(cb) { listeners.push(cb); },
    requestFrame(cb) { requestAnimationFrame(cb); },
    now() { return performance.now(); },
    getItem(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    createSound(path, loop) { return new WebSound(path, loop); },
    vibrateShort() { if (navigator.vibrate) navigator.vibrate(15); },
    vibrateLong() { if (navigator.vibrate) navigator.vibrate(300); },
    showRewardedAd: fakeAd,
    showInterstitialAd() {},
    share(title) { showToast('分享：' + title); },
    onShow(cb) { showListeners.push(cb); },
    onHide(cb) { hideListeners.push(cb); },
    supportsSidebar() { return /sidebar/.test(location.search); },
    isFromSidebar() { return /fromSidebar/.test(location.search); },
    navigateToSidebar() { showToast('（模拟）前往侧边栏'); },
    supportsAddShortcut() { return false; },
    addShortcut() { return Promise.resolve(false); },
    submitScore() {},
    supportsRank() { return false; },
    getSharedCanvas() { return null; },
    postToOpenData() {},
    showNativeRank() {},
    showToast,
    exit() {},
  };
}
