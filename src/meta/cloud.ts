import { getPlatform } from '../platform';
import { save, rawSave, replaceSave } from './save';

// 云存档：启动时拉取，运行中定期上传。冲突时以更新时间较新的为准；
// 本地是全新存档（没玩过）而云端有进度时，直接用云端（换手机、清缓存后恢复）。

export type CloudStatus = 'off' | 'syncing' | 'ok' | 'error';
export let cloudStatus: CloudStatus = 'off';
export let lastSyncAt = 0;
let lastUploaded = 0;
let pushing = false;

export function cloudEnabled(): boolean {
  return getPlatform().cloudReady();
}

/** 启动时调用，最多等待 timeoutMs。返回是否用云端覆盖了本地 */
export function cloudPull(timeoutMs = 3000): Promise<boolean> {
  const p = getPlatform();
  if (!p.cloudReady()) return Promise.resolve(false);
  cloudStatus = 'syncing';
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => { if (!done) cloudStatus = 'error'; finish(false); }, timeoutMs);
    p.cloudLoad().then((cloud) => {
      if (done) return;
      cloudStatus = 'ok';
      lastSyncAt = Date.now();
      if (!cloud || !cloud.data) { finish(false); return; }
      const localFresh = save.stats.runs === 0 && save.guide === 0;
      if (localFresh || cloud.updatedAt > save.updatedAt + 5000) {
        const ok = replaceSave(cloud.data);
        lastUploaded = save.updatedAt;
        finish(ok);
      } else finish(false);
    }).catch(() => { cloudStatus = 'error'; finish(false); });
  });
}

/** 上传本地存档（有变化时） */
export function cloudPush(force = false) {
  const p = getPlatform();
  if (!p.cloudReady() || pushing) return;
  if (!force && save.updatedAt <= lastUploaded) return;
  pushing = true;
  cloudStatus = 'syncing';
  const at = save.updatedAt;
  p.cloudSave(rawSave(), at).then((ok) => {
    pushing = false;
    cloudStatus = ok ? 'ok' : 'error';
    if (ok) { lastUploaded = at; lastSyncAt = Date.now(); }
  });
}
