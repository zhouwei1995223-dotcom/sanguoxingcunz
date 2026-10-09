export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const TAU = Math.PI * 2;

export function rand(a = 1, b?: number): number {
  if (b === undefined) return Math.random() * a;
  return a + Math.random() * (b - a);
}
export function randInt(a: number, b: number): number {
  return Math.floor(a + Math.random() * (b - a + 1));
}
export function pick<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0];
}
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/** 按权重抽取 */
export function weighted<T>(items: T[], weight: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

/** 确定性哈希，用于地图装饰的稳定随机 */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

/** 大数字缩写：12345 -> 1.2万 */
export function fmtNum(n: number): string {
  n = Math.floor(n);
  if (n >= 100000000) return (n / 100000000).toFixed(n >= 1e9 ? 0 : 1) + '亿';
  if (n >= 100000) return (n / 10000).toFixed(n >= 1e6 ? 0 : 1) + '万';
  return String(n);
}

export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
