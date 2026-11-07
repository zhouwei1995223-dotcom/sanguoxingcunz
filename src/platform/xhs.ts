// 小红书小工具容器能力（window.xhs.miniTool）。写法按小工具在线文档（2026-11-06）：
// §3.6 客户端版本判断、§3.7 Storage 本地缓存、§3.11 getWindowInfo 顶部按钮避让、§3.13 振动反馈。
// 所有调用前都检查 window.xhs / miniTool / 具体方法是否存在；普通浏览器里没有注入时全部走降级。

/** 小红书容器注入的端能力对象；未注入（普通浏览器）时为 undefined */
function miniTool(): any {
  const xhs = typeof window !== 'undefined' ? (window as any).xhs : undefined;
  return xhs && xhs.miniTool;
}

function readBuildVersion(launchOptions: any): number {
  const env = launchOptions && launchOptions.miniToolEnv;
  return Number(env && env.buildVersion) || 0;
}

/** 客户端 buildVersion（末 3 位是编译序号）。同步值优先，取不到再异步读；都取不到返回 0（按不支持处理） */
async function getBuildVersion(): Promise<number> {
  const xhs = typeof window !== 'undefined' ? (window as any).xhs : undefined;
  const sync = readBuildVersion(xhs && xhs.launchOptions);
  if (sync) return sync;
  const m = miniTool();
  if (!m || typeof m.getLaunchOptions !== 'function') return 0;
  try { return readBuildVersion(await m.getLaunchOptions()); } catch (e) { return 0; }
}

/** 例如 9462004 → 9462，即客户端 9.46.2 */
const atLeast = (buildVersion: number, min: number) => Math.floor(buildVersion / 1000) >= min;
const STORAGE_MIN = 9460, WINDOW_INFO_MIN = 9490, VIBRATE_MIN = 9500;

let buildVersion = 0;

/**
 * 本地存档：客户端 9.46+ 用 Storage JS API；低版本降级到 localStorage（容器不保证其持久，读写都兜底）。
 * 游戏的存档读写是同步的，所以启动时先把已有缓存读进内存，之后读走内存、写入在后台按顺序落盘。
 * 第一次在新版客户端启动时，把旧版留在 localStorage 里的存档迁移过来，老玩家进度不丢。
 */
export function createXhsStorage() {
  const cache: Record<string, string> = {};
  let native = false;
  let queue: Promise<unknown> = Promise.resolve();

  const localGet = (k: string) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const localSet = (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  /** Storage 的 data 必须是 JSON 字符串：存档本身是字符串，这里再序列化一层 */
  const nativeWrite = (k: string, v: string) => {
    const m = miniTool();
    queue = queue.then(() => m.setStorage({ key: k, data: JSON.stringify(v) })).catch(() => {
      // 写入失败（如超出单 key 1MB）时退回浏览器存储，尽量不丢进度
      localSet(k, v);
    });
  };

  const ready = (async () => {
    buildVersion = await getBuildVersion();
    const m = miniTool();
    if (!atLeast(buildVersion, STORAGE_MIN) || !m || typeof m.setStorage !== 'function' || typeof m.getStorage !== 'function') return;
    native = true;
    let keys: string[] = [];
    if (typeof m.getStorageInfo === 'function') {
      try { const info = await m.getStorageInfo(); keys = (info && info.keys) || []; } catch (e) { keys = []; }
    }
    for (const k of keys) {
      try {
        const r = await m.getStorage({ key: k });
        if (r && typeof r.data === 'string') {
          const v = JSON.parse(r.data);
          if (typeof v === 'string') cache[k] = v;
        }
      } catch (e) { /* 单条读失败不影响其他 */ }
    }
    // 迁移：旧版客户端 / 旧版本只写过 localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !/^sgxc/.test(k) || cache[k] !== undefined) continue;
        const v = localStorage.getItem(k);
        if (v === null) continue;
        cache[k] = v;
        nativeWrite(k, v);
      }
    } catch (e) { /* localStorage 不可用时跳过迁移 */ }
  })().catch(() => { native = false; });

  return {
    ready,
    get(k: string): string | null {
      if (native) return cache[k] !== undefined ? cache[k] : localGet(k);
      return localGet(k);
    },
    set(k: string, v: string) {
      if (!native) { localSet(k, v); return; }
      cache[k] = v;
      nativeWrite(k, v);
    },
  };
}

/** 振动：客户端 9.50+ 用平台 vibrateShort / vibrateLong，低版本退回网页振动（有则用） */
export function xhsVibrate(long: boolean) {
  const m = miniTool();
  if (atLeast(buildVersion, VIBRATE_MIN) && m) {
    const fn = long ? m.vibrateLong : m.vibrateShort;
    if (typeof fn === 'function') {
      try {
        const p = long ? m.vibrateLong() : m.vibrateShort({ type: 'medium' });
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* 无马达或关闭触感时忽略 */ }
      return;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(long ? 300 : 15);
}

/**
 * 顶部按钮避让：客户端 9.49+ 读 getWindowInfo 的 menuButtons（back / me / share，隐藏时为 null），
 * 返回需要留出的顶部高度（逻辑像素，按钮底边 + 6）；取不到时返回 null，由调用方用默认留白兜底。
 */
export async function xhsTopInset(): Promise<number | null> {
  if (!buildVersion) buildVersion = await getBuildVersion();
  const m = miniTool();
  if (!atLeast(buildVersion, WINDOW_INFO_MIN) || !m || typeof m.getWindowInfo !== 'function') return null;
  try {
    const info = await m.getWindowInfo();
    if (!info) return null;
    let top = (info.safeArea && Number(info.safeArea.top)) || Number(info.statusBarHeight) || 0;
    const btns = info.menuButtons || {};
    for (const k of ['back', 'me', 'share']) {
      const r = btns[k];
      if (r && isFinite(r.bottom)) top = Math.max(top, Number(r.bottom) + 6);
    }
    return top;
  } catch (e) {
    return null;
  }
}
