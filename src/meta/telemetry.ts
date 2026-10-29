import { getPlatform } from '../platform';
import { save, markDirty } from './save';
import { GAME_INFO } from '../data/platformConfig';

// 数据与报错：报错写实时日志并上报 js_error；新手漏斗每步只报一次；每天首次进入报一次 login

const seen = new Set<string>();

export function reportError(msg: string) {
  const key = msg.slice(0, 160);
  if (seen.has(key) || seen.size > 20) return;
  seen.add(key);
  const p = getPlatform();
  const scene = (globalThis as any).__sceneName || '';
  p.logError(`[v${GAME_INFO.version}] [${scene}] ${msg}`);
  p.report('js_error', { msg: msg.slice(0, 120), scene, ver: GAME_INFO.version });
}

export type FunnelStep =
  | 'privacy_ok' | 'b1_start' | 'b1_levelup' | 'b1_45s' | 'b1_end' | 'home_first' | 'b2_start' | 'b2_end';

/** 新手漏斗：每个步骤每位玩家只上报一次 */
export function funnel(step: FunnelStep) {
  if (save.funnel[step]) return;
  save.funnel[step] = true;
  markDirty();
  getPlatform().report('funnel', { step });
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 每天第一次进入游戏时上报，day = 安装后的第几天（0 = 安装当天） */
export function reportDailyLogin() {
  // 同意隐私政策之前不上报
  if (!save.agreedPrivacy) return;
  const t = today();
  if (!save.installDay) save.installDay = t;
  if (save.loginReportDay === t) return;
  save.loginReportDay = t;
  markDirty();
  const day = Math.round((Date.parse(t) - Date.parse(save.installDay)) / 86400000);
  getPlatform().report('login', { day, runs: save.stats.runs });
}

export function initTelemetry() {
  getPlatform().onError(reportError);
}
